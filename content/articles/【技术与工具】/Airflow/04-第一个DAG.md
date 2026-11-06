---
title: 第一个 DAG - 从零编写数据处理工作流
tags:
  - Airflow
  - DAG
  - BashOperator
  - PythonOperator
  - schedule_interval
  - start_date
  - catchup
aliases:
  - Airflow入门DAG
  - 第一个Airflow DAG
difficulty: 中级
duration: 25分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据分析师
  - 数据科学家
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


# 第一个 DAG

> [!abstract] 本文核心内容
> - 从零开始编写一个完整的 DAG 文件
> - 掌握 BashOperator 和 PythonOperator 的使用
> - 深入理解 `schedule_interval`、`start_date`、`catchup` 的含义
> - 调度周期（execution_date）的工作原理
> - 调试技巧：如何快速验证 DAG 是否正确

---

## 场景设定

我们要构建这样一个简单但完整的数据管道：

1. 检查源数据文件是否存在（BashOperator）
2. 读取 CSV 数据并做基础清洗（PythonOperator）
3. 将清洗结果写入目标文件（PythonOperator）
4. 打印运行报告（PythonOperator）

上述是四个业务步骤；下文将清洗与写出合并在同一个 PythonOperator 中，共定义三个 Task。管道按 DAG 时区每天凌晨 2 点调度，使用逻辑日期对应的文件名读取前一天业务数据；这要求源文件按同一业务日期约定命名。手动触发不保证处理前一天的数据。

---

## 编写第一个 DAG

在 DAG 文件目录（默认 `$AIRFLOW_HOME/dags/`，Docker 中是挂载的 `./dags/` 目录）创建一个文件：

```python
# dags/first_etl_dag.py

from datetime import datetime, timedelta
import pandas as pd
import os

from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.python import PythonOperator

# ============================================================
# 第一步：定义 DAG 级别的默认参数
# ============================================================
# 这些参数会作为默认值传给 DAG 中的每个 Task
# Task 可以单独覆盖这些参数
default_args = {
    "owner": "data_team",                    # 负责人，在 Web UI 中显示
    "depends_on_past": False,                # 是否依赖上一次运行成功（False = 独立运行）
    "start_date": datetime(2024, 1, 1),      # 调度开始日期（重要！见下文说明）
    "retries": 2,                            # 失败后重试次数
    "retry_delay": timedelta(minutes=5),     # 每次重试间隔
    "email_on_failure": True,               # 失败时发邮件
    "email": ["data-team@company.com"],     # 收件人
}

# ============================================================
# 第二步：创建 DAG 对象
# ============================================================
with DAG(
    dag_id="first_etl_dag",                  # 唯一标识，不能包含空格
    default_args=default_args,               # 传入默认参数
    schedule_interval="0 2 * * *",           # cron 表达式：每天凌晨 2 点
    catchup=False,                           # 不补跑历史（重要！见下文说明）
    description="第一个 ETL DAG：数据清洗示例",
    tags=["tutorial", "ETL", "数据清洗"],
    max_active_runs=1,                       # 同一时刻最多 1 个 DAG Run 在执行
) as dag:

    # ============================================================
    # Task 1：BashOperator - 检查源文件是否存在
    # ============================================================
    # BashOperator 执行 bash 命令
    # {{ ds }} 是模板变量，会被替换为逻辑日期的日期部分（格式：YYYY-MM-DD），不是任务实际启动日期
    check_source_file = BashOperator(
        task_id="check_source_file",
        bash_command="""
            SOURCE_FILE="/data/raw/orders_{{ ds }}.csv"
            if [ -f "$SOURCE_FILE" ]; then
                echo "找到源文件：$SOURCE_FILE"
                wc -l "$SOURCE_FILE"
            else
                echo "ERROR: 源文件不存在：$SOURCE_FILE"
                exit 1   # 返回非零退出码，Task 标记为失败
            fi
        """,
    )

    # ============================================================
    # Task 2：PythonOperator - 数据清洗
    # ============================================================
    def clean_data(**context):
        """
        数据清洗函数
        context 包含当前 DAG Run 的所有上下文信息
        **context 是模板参数的 Python 访问方式
        """
        # 从 context 获取执行日期
        execution_date = context["ds"]          # 格式：'2024-01-15'
        run_id = context["run_id"]              # 当前 DAG Run 的 ID

        print(f"开始处理 {execution_date} 的数据，Run ID: {run_id}")

        source_path = f"/data/raw/orders_{execution_date}.csv"
        output_path = f"/data/cleaned/orders_{execution_date}.csv"

        # 读取数据
        df = pd.read_csv(source_path)
        original_count = len(df)
        print(f"原始数据：{original_count} 行")

        # 数据清洗操作
        # 1. 删除重复行
        df = df.drop_duplicates(subset=["order_id"])

        # 2. 过滤异常金额（订单金额 > 0 且 < 100000）
        df = df[(df["amount"] > 0) & (df["amount"] < 100000)]

        # 3. 标准化状态字段
        df["status"] = df["status"].str.strip().str.lower()
        valid_statuses = ["paid", "cancelled", "refunded", "pending"]
        df = df[df["status"].isin(valid_statuses)]

        # 4. 填充缺失值
        df["city"] = df["city"].fillna("unknown")

        cleaned_count = len(df)
        print(f"清洗后数据：{cleaned_count} 行（过滤了 {original_count - cleaned_count} 行）")

        # 创建输出目录
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        df.to_csv(output_path, index=False)

        # 通过 XCom 传递数据量信息给下游任务
        # return 的值会自动以 key='return_value' 存入 XCom
        return {
            "original_count": original_count,
            "cleaned_count": cleaned_count,
            "output_path": output_path,
        }

    clean_task = PythonOperator(
        task_id="clean_data",
        python_callable=clean_data,
        # provide_context 在 Airflow 2.x 中已废弃，只需 **context 即可
        # Airflow 2.x 默认会把 context 传入
    )

    # ============================================================
    # Task 3：PythonOperator - 生成运行报告
    # ============================================================
    def generate_report(**context):
        """从 XCom 读取上游任务的结果，生成简单报告"""
        # xcom_pull 拉取上游任务的返回值
        result = context["task_instance"].xcom_pull(
            task_ids="clean_data",
            key="return_value"
        )

        execution_date = context["ds"]

        print("=" * 50)
        print(f"ETL 运行报告 - {execution_date}")
        print("=" * 50)
        print(f"原始数据量：{result['original_count']} 行")
        print(f"清洗后数据量：{result['cleaned_count']} 行")
        filter_rate = (
            1 - result['cleaned_count'] / result['original_count']
            if result['original_count'] > 0 else None
        )
        if filter_rate is None:
            print("数据过滤率：不适用（原始数据为 0 行）")
        else:
            print(f"数据过滤率：{filter_rate * 100:.1f}%")
        print(f"输出文件：{result['output_path']}")
        print("=" * 50)

        # 如果数据过滤率超过 30%，打印警告
        if filter_rate is not None and filter_rate > 0.3:
            print(f"WARNING: 数据过滤率 {filter_rate:.1%} 超过 30%，请检查数据质量！")

    report_task = PythonOperator(
        task_id="generate_report",
        python_callable=generate_report,
    )

    # ============================================================
    # 第三步：定义任务依赖关系
    # ============================================================
    # >> 表示左边的任务完成后，才执行右边的任务
    check_source_file >> clean_task >> report_task
```

---

## 理解调度参数

### start_date：调度开始日期

`start_date` 是这个 DAG 最早可以被调度的日期，**不是 DAG 第一次运行的时间**。

> [!warning] start_date 是 Airflow 最容易踩坑的地方
> 很多人以为 `start_date=datetime(2024, 1, 1)` 意味着 DAG 从 2024-01-01 开始跑。
> 实际上，对于采用标准 cron 数据区间调度的 `@daily` DAG，若 `start_date` 为 DAG 时区的 2024-01-01 00:00，首个区间在 **2024-01-02 00:00** 结束，此后才具备调度资格。
> 这是首个区间的理论时间，不保证任务立即启动；若较晚部署且 `catchup=False`，不会从这个历史区间开始补跑。

**正确的理解方式：**

```ini
schedule_interval = "0 2 * * *"（按 DAG 时区每天凌晨 2 点）
start_date = 2024-01-01 00:00（按 DAG 时区解释）

首个完整调度区间 = [2024-01-01 02:00, 2024-01-02 02:00)
该区间的 logical_date（旧称 execution_date）= 2024-01-01 02:00
该区间的 ds = 2024-01-01
最早可调度时间 = 2024-01-02 02:00
（任务实际启动还取决于 Scheduler、Executor 和资源；较晚部署且 catchup=False 时不补跑这个首个历史区间）
```

**关于 `start_date` 的最佳实践：**

```python
# 不要用动态时间（比如 datetime.now()），会导致每次重新加载 DAG 时 start_date 变化
# 错误写法：
start_date = datetime.now() - timedelta(days=1)

# 正确写法：使用固定日期
start_date = datetime(2024, 1, 1)
```

### schedule_interval：调度频率

下面介绍 `schedule_interval` 的常用预设配置和 cron 表达式，并非全部支持形式：

**预设别名（简单场景）：**

| 别名 | 等价 cron | 含义 |
|------|----------|------|
| `@once` | - | 只运行一次 |
| `@hourly` | `0 * * * *` | 每小时整点 |
| `@daily` | `0 0 * * *` | 每天 0 点（按 DAG 时区；未显式指定时采用环境默认时区）|
| `@weekly` | `0 0 * * 0` | 每周日 0 点 |
| `@monthly` | `0 0 1 * *` | 每月 1 日 0 点 |
| `None` | - | 不自动调度，只能手动触发 |

**cron 表达式（灵活场景）：**

```text
分 时 日 月 周
0  2  *  *  *    → 每天凌晨 2 点
0  */6 * *  *    → 每 6 小时执行一次
0  2  *  *  1-5  → 工作日凌晨 2 点（周一到周五）
0  2  1  *  *    → 每月 1 日凌晨 2 点
*/15 * *  *  *   → 每 15 分钟执行一次
```

> [!tip] 推荐使用 crontab.guru
> 可视化 cron 表达式生成工具，地址：https://crontab.guru

### catchup：是否补跑历史

`catchup=True` 时，Scheduler 会为符合条件、已经结束且尚未创建运行的历史数据区间创建 DAG Run；并非重启后重跑所有已有运行。未显式指定 `catchup` 时，默认行为取决于环境的 `catchup_by_default` 配置，因此应在 DAG 中明确设置。

**举个例子：**

```python
# DAG 配置
start_date = datetime(2024, 1, 1)
schedule_interval = "@daily"
catchup = True  # 此示例显式启用历史补跑
```

作为教学示例，若在 DAG 时区的 2024-03-01 00:00 或之后、下一个日区间结束之前部署并启用这个 DAG，且这些区间没有已有运行，2024-01-01 到 2024-02-29 对应 60 个已结束的日区间，可被创建为 60 次 DAG Run；创建和执行进度还受调度器配置与并发限制影响。

> [!warning] catchup 的生产风险
> 在生产环境，突然涌入 60 个 DAG Run 同时排队执行，可能让数据库和下游系统崩溃。
> **建议：新部署的 DAG 默认设置 `catchup=False`**，需要补数时再手动触发特定日期的 DAG Run。

```python
# 推荐设置
catchup = False

# 如果需要手动补跑特定日期范围
# 在 Web UI 中使用 Backfill 功能，或用命令行：
# airflow dags backfill -s 2024-01-01 -e 2024-01-31 my_dag_id
```

---

## 模板变量（Jinja 模板）

Airflow 支持在 Operator 的参数中使用 Jinja 模板语法（`{{ }}`），动态传入运行时信息。

**常用模板变量：**

| 变量 | 含义 | 示例值 |
|------|------|--------|
| `{{ ds }}` | 逻辑日期的日期部分（YYYY-MM-DD），不是实际启动日期 | `2024-01-15` |
| `{{ ds_nodash }}` | 逻辑日期的日期部分（无连字符）| `20240115` |
| `{{ ts }}` | 逻辑日期的 ISO 8601 时间戳，不是当前时间 | `2024-01-15T02:00:00+00:00` |
| `{{ data_interval_start }}` | 数据区间开始时间 | `2024-01-15T00:00:00+00:00` |
| `{{ data_interval_end }}` | 数据区间结束时间 | `2024-01-16T00:00:00+00:00` |
| `{{ run_id }}` | 当前 DAG Run ID | `scheduled__2024-01-15T02:00:00+00:00` |
| `{{ dag.dag_id }}` | DAG ID | `first_etl_dag` |
| `{{ task.task_id }}` | Task ID | `clean_data` |

```python
# BashOperator 中使用模板变量
extract_task = BashOperator(
    task_id="extract_data",
    bash_command="""
        echo "处理日期：{{ ds }}"
        python extract.py \
            --date {{ ds }} \
            --output /data/{{ ds_nodash }}/orders.csv
    """,
)

# SQLExecuteQueryOperator 中使用模板变量
query_task = SQLExecuteQueryOperator(
    task_id="query_orders",
    conn_id="mysql_prod",
    sql="""
        SELECT *
        FROM orders
        WHERE create_date = '{{ ds }}'
    """,
)
```

---

## 验证与调试 DAG

### 方法一：命令行验证

```bash
# 1. 检查 DAG 文件语法是否有错误
python dags/first_etl_dag.py
# 没有报错就说明 Python 语法没问题

# 2. 列出解析到的 DAG
airflow dags list | grep first_etl

# 3. 列出 DAG 的所有 Task
airflow tasks list first_etl_dag

# 4. 查看 DAG 的任务依赖关系（树状图）
airflow tasks list first_etl_dag --tree

# 5. 测试单个 Task（不由 Scheduler 调度，不作为正常调度运行更新任务状态）
# 会实际执行任务代码，可能读写文件、访问外部系统或产生 XCom 等元数据；不要视为无副作用测试
airflow tasks test first_etl_dag check_source_file 2024-01-15
airflow tasks test first_etl_dag clean_data 2024-01-15
```

### 方法二：Web UI 验证

1. 在 DAGs 列表找到 `first_etl_dag`
2. 点击进入 DAG 详情页
3. 切换到 **Graph View** 查看任务依赖关系图
4. 点击 **Trigger DAG** 手动触发一次运行
5. 点击任意 Task 节点，选择 **Log** 查看日志

### 常见错误排查

```bash
# DAG 文件解析错误
# 在 Web UI 的 DAG 列表会看到红色警告
# 查看 Scheduler 日志定位问题
docker compose logs airflow-scheduler | tail -50

# 或直接
airflow dags list-import-errors
```

**常见的 Python 语法错误：**

```python
# 错误：import 语句在函数外，但用了相对路径
from .utils import helper  # ❌ DAG 文件不支持相对导入

# 正确：使用绝对导入
from utils.helper import helper_func  # ✓ 需要 utils 在 PYTHONPATH 中
# 或直接在 DAG 文件中放代码
```

---

## 一个完整可运行的最小 DAG

下面是一个无需外部业务数据源的最小 DAG：在兼容下列导入路径和参数的 Airflow 2.x 环境中、任务运行环境具备 Bash 时，可复制到 DAG 目录进行验证。

```python
# dags/minimal_dag.py
"""
最小化 DAG 示例：无需外部业务数据源，需已部署兼容的 Airflow 环境并具备 Bash
"""

from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator

def say_hello(**context):
    execution_date = context["ds"]
    print(f"Hello from Airflow! 处理日期：{execution_date}")
    return f"success_{execution_date}"

def say_goodbye(**context):
    # 从上游任务拉取 XCom 数据
    prev_result = context["ti"].xcom_pull(task_ids="say_hello")
    print(f"Goodbye! 上一步返回：{prev_result}")

with DAG(
    dag_id="minimal_dag",
    start_date=datetime(2024, 1, 1),
    schedule_interval="@daily",
    catchup=False,
    tags=["tutorial"],
    default_args={
        "owner": "tutorial",
        "retries": 1,
        "retry_delay": timedelta(minutes=1),
    },
) as dag:

    bash_task = BashOperator(
        task_id="print_date",
        bash_command="echo '当前执行日期：{{ ds }}'",
    )

    hello_task = PythonOperator(
        task_id="say_hello",
        python_callable=say_hello,
    )

    goodbye_task = PythonOperator(
        task_id="say_goodbye",
        python_callable=say_goodbye,
    )

    # 依赖关系：print_date → say_hello → say_goodbye
    bash_task >> hello_task >> goodbye_task
```

把这个文件放到已配置的 DAG 目录后，等待解析与序列化结果出现在 Web UI；耗时取决于扫描配置、部署方式和负载，不保证最多 30 秒。启用 DAG 后可等待自动调度，也可点击 Trigger DAG 手动触发一次；检查三个 Task 的状态与日志，确认是否依次成功执行。

---

## 小结

| 概念 | 要点 |
|------|------|
| `start_date` | 固定日期，不要用 `datetime.now()`；调度从此日期**之后**开始 |
| `schedule_interval` | 支持 cron 表达式和 `@daily`、`@hourly` 等别名 |
| `catchup` | 新 DAG 建议设 `False`，避免历史补跑压垮系统 |
| 模板变量 | `{{ ds }}` 取逻辑日期的日期部分，不是任务实际启动日期，可在 Bash 命令和 SQL 中动态替换 |
| `**context` | PythonOperator 函数中访问上下文信息的方式 |
| `xcom_pull` | 在下游任务中拉取上游任务的返回值 |

下一篇：[[【技术与工具】/Airflow/05-常用Operator详解|05-常用Operator详解]] — BashOperator、SQLExecuteQueryOperator、HiveOperator 等实战用法

---

*所属系列：[[【技术与工具】/Airflow/00-Airflow学习路线图|00-Airflow学习路线图]] | 上一篇：[[【技术与工具】/Airflow/03-Airflow安装部署|03-Airflow安装部署]] | 下一篇：[[【技术与工具】/Airflow/05-常用Operator详解|05-常用Operator详解]]*

#Airflow #DAG #BashOperator #PythonOperator #schedule_interval #catchup

---

> [!info] 前置知识
> - Airflow 环境已成功部署并可访问 Web UI，参考 [[【技术与工具】/Airflow/03-Airflow安装部署|Airflow 安装部署]]
> - 熟悉 Python 函数定义、`with` 语句、`datetime` 模块基本用法
> - 理解 DAG、Task、Operator 的概念区别，参考 [[【技术与工具】/Airflow/02-Airflow核心概念|Airflow 核心概念]]

---

## 掌握检查

- [ ] 能从空白文件写出一个包含至少 2 个 Task、有正确 `start_date` 和 `schedule_interval` 的 DAG
- [ ] 能在明确 DAG 时区、采用标准 cron 数据区间调度的前提下，说出 `start_date=2024-01-01 00:00` 时 `@daily` DAG 的首个完整数据区间及最早具备调度资格的时刻，并说明首次实际启动还受部署时间、`catchup`、Scheduler、Executor 和资源影响
- [ ] 知道新 DAG 应该设置 `catchup=False` 的原因，以及不设置会发生什么
- [ ] 能在 PythonOperator 函数中通过 `context["ds"]` 和 `context["ti"].xcom_pull()` 正确获取数据
- [ ] 能用 `airflow tasks test` 命令在不触发调度的情况下测试单个 Task

---

## 实践练习

**基础题**：把本文的 `first_etl_dag` 中的 `check_source_file` Task 改为检查一个实际存在的目录（如 `/tmp`）。注意后续 Task 仍会读取订单 CSV：需根据本次运行的 `ds` 准备 `/data/raw/orders_<ds>.csv`，至少包含 `order_id,amount,status,city` 四列及一条有效记录，确保执行环境已安装 pandas、各任务可访问相同的 `/data` 路径且输出目录可写。将 DAG 放入 Airflow 的 DAG 目录，触发运行，在 Web UI 中确认所有 Task 成功执行。

**进阶题**：在 `first_etl_dag` 基础上增加一个 Task：读取 `clean_data` Task 通过 XCom 返回的清洗统计数字，如果清洗后的记录数为 0，则抛出异常让 DAG 失败（而不是静默成功）。思考这个模式在生产中有什么价值。
