---
title: Airflow 最佳实践与踩坑 - 生产环境避坑指南
tags:
  - Airflow
  - 最佳实践
  - 踩坑
  - 性能调优
  - 幂等性
  - 生产checklist
  - DAG设计
aliases:
  - Airflow最佳实践
  - Airflow踩坑
  - Airflow生产环境
difficulty: 高级
duration: 25分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据平台运维工程师
stability: fast-changing
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


# Airflow 最佳实践与踩坑

> [!abstract] 本文核心内容
> - DAG 设计原则：幂等性、原子性、单一职责
> - 性能调优：Scheduler 配置、Worker 并发、MetaDB 优化
> - 常见坑：start_date 陷阱、zombie task、数据库连接耗尽
> - 生产环境上线 checklist

这篇是经验总结，适合在掌握基础用法后反复查阅。

---

## DAG 设计原则

### 原则一：幂等性（最重要）

**幂等（Idempotent）**：同一个 Task 运行 N 次，结果和运行 1 次相同。

幂等性保证了可以安全地重试、重跑历史数据，而不用担心数据重复。

```python
# 不幂等的写法（INSERT 会导致重复数据）
def load_data_bad(**context):
    ds = context["ds"]
    df = read_data(ds)
    df.to_sql("ods_orders", engine, if_exists="append")  # 重跑会产生重复数据

# 幂等的写法（先删除再插入，或用 REPLACE/UPSERT）
def load_data_good(**context):
    ds = context["ds"]
    df = read_data(ds)
    from sqlalchemy import text
    # 在支持事务的表上，使用同一连接完成删除与插入
    # 前提：df 仅包含 ds 分区的数据，且没有并发任务写同一分区
    with engine.begin() as conn:
        conn.execute(
            text("DELETE FROM ods_orders WHERE partition_date = :ds"),
            {"ds": ds},
        )
        df.to_sql("ods_orders", conn, if_exists="append", index=False)
```

**各系统实现幂等的惯用方式：**

| 系统 | 幂等写入方式 |
|------|------------|
| Hive | `INSERT OVERWRITE ... PARTITION (dt=...)` |
| MySQL | `DELETE WHERE dt=... + INSERT` 或 `REPLACE INTO` |
| PostgreSQL | `DELETE WHERE dt=... + INSERT` 或 `INSERT ... ON CONFLICT DO UPDATE` |
| HDFS | 先 `hdfs dfs -rm -r /path/dt=xxx`，再写入 |
| Parquet/ORC | 覆盖写分区目录 |

### 原则二：原子性

每个 Task 要么完全成功，要么完全失败，不要留下"半成品"数据。

```python
# 不好：分步写入，如果第二步失败，第一步的数据已经落盘
def load_two_tables(**context):
    write_to_table_a(data)  # 成功
    write_to_table_b(data)  # 失败！table_a 有数据，table_b 没有，状态不一致

# 好：使用事务或先写临时表再 rename
def load_atomically(**context):
    # 先写到临时表
    write_to_temp_table(data)
    # 前提：两个目标表支持同一数据库事务；临时表需隔离不同运行
    from sqlalchemy import text
    # 在一个事务中完成两步操作
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO table_a SELECT * FROM temp_a"))
        conn.execute(text("INSERT INTO table_b SELECT * FROM temp_b"))
```

### 原则三：单一职责

一个 Task 只做一件事。过大的 Task 难以排查问题，也无法从中间步骤重试。

```python
# 不好：一个 Task 做太多事
def do_everything(**context):
    data = extract_from_mysql()
    clean_data(data)
    validate_data(data)
    write_to_hive(data)
    generate_report(data)
    send_email()

# 好：拆分为多个 Task，每个只做一件事
extract >> clean >> validate >> write_to_hive >> generate_report >> send_email
```

### 原则四：避免在 DAG 顶层执行代价高的操作

DAG 文件会被 DAG 解析进程反复解析，顶层代码可能频繁执行；实际间隔取决于 Airflow 版本、解析配置、文件更新时间和处理负载，并非固定每隔 30 秒。

```python
# 危险：在顶层查询数据库（可能随反复解析频繁执行）
import mysql.connector
conn = mysql.connector.connect(...)  # 顶层代码，频繁建连接
try:
    with conn.cursor() as cursor:
        cursor.execute("SELECT name FROM tables")  # 频繁查询
        TABLES = cursor.fetchall()
finally:
    conn.close()

# 安全：将查询放在函数内（只在 Task 执行时运行一次）
TABLES = ["orders", "users", "products"]  # 静态配置，或从 JSON 文件读取

# 如果必须动态读取，可评估缓存；以下缓存仅在当前 Python 进程内有效
# 若在 DAG 顶层调用，不能保证后续解析进程不再访问 MetaDB
import functools

@functools.lru_cache(maxsize=1)
def get_tables():
    """带缓存的配置读取"""
    from airflow.models import Variable
    return Variable.get("tables_to_sync", deserialize_json=True)
```

---

## 常见踩坑

### 坑一：start_date 设置错误

**问题**：把 start_date 设成今天或明天，然后疑惑为什么 DAG 不运行。

```python
# 错误：start_date 是今天，@daily DAG 要明天才会第一次运行
start_date = datetime.now()  # 动态值，每次解析都变，本身就是问题

# 错误：start_date 是明天
start_date = datetime.now() + timedelta(days=1)  # 永远不会运行

# 正确：固定的过去日期
start_date = datetime(2024, 1, 1)
```

**问题**：修改了已运行过的 DAG 的 start_date。

```python
# 问题：修改 start_date 不会自动改写已有 DAG Run 的历史状态；
# 后续调度还取决于 timetable、catchup 和已有运行记录。

# 处理前先明确要调整未来调度，还是补跑历史区间，并在测试环境验证。
# 以下是破坏性删除命令，不是修改 start_date 的常规解决方案；
# 仅在明确需要删除该 DAG 的元数据、已备份并暂停相关运行时考虑使用。
airflow dags delete my_dag  # 删除该 DAG 的元数据，不删除 DAG 文件
# 文件仍在解析目录时，DAG 可能再次被发现。

# max_active_runs 只限制同时活跃的 DAG Run 数量，不控制起始日期。
# 不要依赖修改 start_date 来直接改写或跳过已有历史。
```

### 坑二：catchup=True + 旧的 start_date

**问题**：新部署的 DAG 若采用日调度、start_date 设为 2023-01-01 且启用 catchup，可能逐步创建大量历史 DAG Run；数量取决于当前日期和 timetable，创建速度受调度限制。catchup 的默认值取决于版本与配置，应显式设置。

```python
# 危险配置
with DAG(
    start_date=datetime(2023, 1, 1),  # 固定的历史日期
    catchup=True,  # 显式启用补数；是否产生周期运行还取决于 schedule
) as dag:
    pass
```

**解决**：
1. 新 DAG 永远先设 `catchup=False`
2. 如果确实需要补历史，手动执行 `airflow dags backfill`，可控制并发

### 坑三：depends_on_past + 历史失败 = 全线阻塞

**问题**：某个 Task 设置了 `depends_on_past=True`，某天失败了，后续所有天的该 Task 都被阻塞。

```python
task = PythonOperator(
    task_id="sequential_task",
    depends_on_past=True,  # 上一次必须成功，才能运行本次
    python_callable=process,
)
```

**解决**：
- 手动清除历史失败的 Task Instance（Web UI → Clear，或命令行）
- 或者将失败的 Task Instance 标记为 Success（如果数据已手动修复）

```bash
# 清除指定日期的 Task，让它重新运行
airflow tasks clear my_dag --task-id sequential_task \
    --start-date 2024-01-10 --end-date 2024-01-10
```

### 坑四：Zombie Task（僵尸任务）

**症状**：任务状态显示 running，但对应的进程已经不存在了。

**原因**：Worker 进程意外终止（OOM、服务器重启），没来得及更新 MetaDB。

**解决**：

```bash
# 方法 1：通过 Web UI 强制标记失败
# 点击任务 → Mark Failed → Clear → 等待重新调度

# 方法 2：命令行清除
airflow tasks clear my_dag \
    --task-id zombie_task \
    --start-date 2024-01-15 \
    --end-date 2024-01-15

# 配置 Scheduler 自动检测僵尸任务
# airflow.cfg：
# [scheduler]
# zombie_threshold_in_seconds = 300
# zombie_cleanup_interval = 10
```

### 坑五：数据库连接耗尽

**症状**：任务大量失败，日志显示 `SQLAlchemy: could not connect to server`。

**原因**：
- Worker 并发太高，每个任务都建立数据库连接
- 连接没有正确关闭（Context Manager 没用好）
- MetaDB 连接池太小

**解决**：

```python
# 错误：手动建连接，可能泄漏
def process(**context):
    engine = create_engine("mysql://...")
    df = pd.read_sql("SELECT ...", engine)
    # 未显式管理连接池生命周期；不能仅凭 pd.read_sql 抛错就断言连接泄漏

# 正确：使用 Context Manager，确保连接释放
def process(**context):
    engine = create_engine("mysql://...")
    try:
        with engine.connect() as conn:
            df = pd.read_sql("SELECT ...", conn)
    finally:
        engine.dispose()  # 关闭连接池
```

```ini
# airflow.cfg：增大 MetaDB 连接池
[database]
sql_alchemy_pool_size = 10        # 默认 5，根据 Worker 并发数调整
sql_alchemy_max_overflow = 20     # 超出 pool_size 时的额外连接数
sql_alchemy_pool_recycle = 1800   # 连接 1800 秒后回收（防止 MySQL 的 8 小时超时）

# 使用 Pool 限制并发 Task 数量
# Web UI → Admin → Pools：
# mysql_query_pool: 10 slots（最多 10 个 Task 同时查 MySQL）
```

### 坑六：DAG 文件解析超时

**症状**：Scheduler 日志出现 `DagFileProcessorTimeoutError`。

**原因**：DAG 文件解析时间过长（比如在顶层查询数据库、读取大文件）。

**解决**：

```ini
# airflow.cfg：增大解析超时
[core]
dag_file_processor_timeout = 120  # 默认 50 秒
min_file_process_interval = 60    # 两次解析间隔加大
```

```python
# 代码层面：
# 1. 移除顶层的数据库查询
# 2. 把大的 for 循环配置改为读取 JSON 文件
# 3. @dag 可组织 DAG 定义，但不保证仅在需要时解析；
#    创建 DAG 对象时仍会执行相关定义代码，应实际测量解析耗时
```

---

## 性能调优

### Scheduler 性能调优

```ini
# airflow.cfg
[scheduler]
# Scheduler 每隔多少秒扫描一次 DAG 目录
dag_dir_list_interval = 60   # 若目标版本默认值为 300，此处是缩短间隔，会增加扫描频率；需按版本和发现延迟要求评估

# 每次 Scheduler 循环，最多创建多少个 DAG Run（不是解析文件数量）
max_dagruns_to_create_per_loop = 10  # 默认 10，大量 DAG 时可以加大

# 作业与 Scheduler 的心跳相关配置，具体作用及适用组件需按目标版本确认
# 这些值不代表发现任务到分发到 Queue 的最大延迟，也不能据此保证任务更快执行
job_heartbeat_sec = 5
scheduler_heartbeat_sec = 5
```

### 并发配置

```ini
[core]
# 全局并行任务数上限（所有 DAG 加起来）
parallelism = 64               # 根据 Worker 总 CPU 核数设置

# 单个 DAG 的并行任务数上限
max_active_tasks_per_dag = 16

# 单个 DAG 同时运行的 DAG Run 数量上限
max_active_runs_per_dag = 1    # 生产一般设 1，防止并发补数

[celery]
# 每个 Celery Worker 实例的任务并发数（具体执行方式取决于 worker pool）
worker_concurrency = 8         # 一般设为 CPU 核数 × 2
```

### MetaDB 维护

```bash
# 清理指定时间戳之前的历史数据（下方固定日期不等于始终保留最近 90 天）
# 如需保留最近 90 天，应计算对应截止时间；先备份并检查清理范围
airflow db clean \
    --clean-before-timestamp "2024-01-01T00:00:00+00:00" \
    --do-not-ask  # 不交互确认

# 原稿给出的自动清理候选配置，尚未核实为目标 Airflow 版本支持的配置：
# [core]
# max_dag_run_number = 30  # 原稿意图为每个 DAG 保留 30 次运行记录
# 不要直接启用；需要自动清理时，应评估并定期调度版本支持的清理命令
```

---

## 生产环境上线 Checklist

### 基础设施检查

- [ ] MetaDB 使用 PostgreSQL（绝不是 SQLite）
- [ ] MetaDB 有定期备份策略
- [ ] 日志目录磁盘空间 > 50GB，并配置日志清理
- [ ] Executor 选择合理（LocalExecutor 或 CeleryExecutor）
- [ ] Scheduler 和 Webserver 有高可用或监控重启机制

### 安全检查

- [ ] `FERNET_KEY` 已设置随机密钥（加密 Connection 密码）
- [ ] `WEBSERVER_SECRET_KEY` 已设置随机密钥
- [ ] 默认密码（admin/airflow）已修改
- [ ] Web UI 访问有网络限制（不对公网开放）
- [ ] Connection 密码通过 Secrets Backend 或环境变量注入（不通过 UI 明文配置）

### DAG 代码检查

- [ ] 所有写入操作都满足重试幂等性（可采用原子覆盖、事务内替换或基于唯一键的 UPSERT；不能仅凭覆盖或追加方式判断）
- [ ] `catchup=False`（除非有明确的补数需求）
- [ ] `start_date` 使用固定日期，不使用 `datetime.now()`
- [ ] 长时间任务设置了 `execution_timeout`
- [ ] 关键任务配置了失败回调（钉钉/飞书告警）
- [ ] 数据库连接使用 Connection 管理（不硬编码密码）
- [ ] DAG 文件顶层没有数据库查询或网络请求
- [ ] 新 DAG 经过 `airflow tasks test` 验证可以运行

### 运行时检查

- [ ] 部署后观察 Scheduler 日志 10 分钟，无 ERROR
- [ ] 第一次手动触发成功
- [ ] 告警通知测试正常（手动让一个 Task 失败，验证能收到告警）
- [ ] 日志可以在 Web UI 中正常查看
- [ ] 监控系统（Prometheus/Grafana）已接入 Airflow 指标

---

## 最终建议总结

给数据工程师的 Airflow 使用建议：

1. **先把基础设施搭好**：PostgreSQL + CeleryExecutor + Fernet Key，不要在 SQLite 上生产
2. **幂等性优先**：按任务的数据区间设计写入，可用事务内删除再插入、UPSERT 或原子分区覆盖；不要无条件先删除当天数据
3. **小而专一**：DAG 拆细，Task 拆细，便于排查和重试
4. **告警先行**：在第一个 DAG 就配好告警，不要等出了问题再配
5. **catchup=False**：新 DAG 上线默认关闭补数，避免意外
6. **日志是最好的朋友**：出了问题先看日志；原稿“90% 的问题在日志里有答案”为未核实的经验性表述，不是统计结论，必要时还需结合指标、数据库状态和进程状态排查

---

## 版本升级建议

| 场景 | 建议 |
|------|------|
| 新项目 | 原稿建议 Airflow 2.8+，但未核实其当前支持状态；应选择仍受支持且与 Python、Provider、执行器兼容的版本 |
| 1.x 升级 2.x | 评估 DAG、插件和依赖的兼容性，按目标版本迁移要求修改；并非所有 DAG 都必须重写 |
| 2.x 小版本升级 | 先备份 MetaDB 并在测试环境验证；原稿使用 `airflow db upgrade`，实际迁移命令应按目标版本确认，不直接套用 |

---

*所属系列：[[【技术与工具】/Airflow/00-Airflow学习路线图|00-Airflow学习路线图]] | 上一篇：[[【技术与工具】/Airflow/11-Airflow进阶实践|11-Airflow进阶实践]]*

*这是 Airflow 系列的最后一篇，完成全部内容后建议配合 [[【技术与工具】/Airflow/10-数据管道实战|数据管道实战]] 动手做一个完整项目。*

#Airflow #最佳实践 #踩坑 #性能调优 #生产环境 #幂等性 #checklist

---

> [!info] 前置知识
> - 已完成 Airflow 系列的基础和进阶内容（01-11 篇），有实际运行 DAG 的经验
> - 理解 Airflow 各组件（Scheduler、MetaDB、Worker）的交互原理

---

## 掌握检查

- [ ] 能解释幂等性的具体含义，并说出三种在 Airflow Task 中实现幂等性的写法（INSERT OVERWRITE、先 DELETE 再 INSERT、UPSERT）
- [ ] 能说出"DAG 文件不应在顶层做 I/O 操作"的原因（DAG 解析进程会反复解析文件并执行顶层代码；实际频率取决于版本、解析配置、文件更新时间和处理负载）
- [ ] 知道 Scheduler 性能下降时应该检查哪些配置（`dag_dir_list_interval`、`min_file_process_interval`、`parallelism`）
- [ ] 能说出 MetaDB 连接耗尽（`too many connections`）的根因，以及通过 `sql_alchemy_pool_size` 调整的方向
- [ ] 在上线新 DAG 前，能完整过一遍本文的生产 checklist，不遗漏关键安全和性能配置

---

## 实践练习

**基础题**：检查你目前写过的 DAG，找出其中不幂等的写法（如无唯一键约束或去重机制的纯 INSERT、未完整替换目标分区的写入），并参考本文的最佳实践改写成幂等版本；覆盖写入不一定需要预先删除旧数据。

**进阶题**：你有一个 DAG 包含 50 个 Task，Scheduler 日志显示 DAG 解析时间超过 10 秒。结合本文的性能调优章节，列出至少 3 个可能的优化方向，并说明每个方向的验证方法。
