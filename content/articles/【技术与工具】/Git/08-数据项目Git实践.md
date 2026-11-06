---
title: 数据项目Git实践 - SQL脚本、ETL代码与大文件管理
tags:
  - Git
  - 数据工程
  - SQL版本管理
  - ETL代码
  - Git-LFS
  - 数据项目
  - 最佳实践
aliases:
  - 数据工程Git实践
  - 数仓Git管理
difficulty: 高级
duration: 45分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据分析师
  - 数据治理工程师
  - 数据架构师
  - 数据科学家
  - BI分析师
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


# 数据项目 Git 实践 - SQL 脚本、ETL 代码与大文件管理

> [!abstract] 本章概要
> - SQL 脚本的版本管理规范
> - ETL 代码（Spark/Flink/Python）的 Git 管理策略
> - 配置文件与敏感信息的安全管理
> - Git LFS 处理大文件
> - 数据项目的目录结构最佳实践

---

## 数据项目的 Git 挑战

数据工程项目和普通软件项目有几个特殊之处：

1. **SQL 文件不是代码？** 很多团队不对 SQL 做版本管理，这是大坑
2. **数据文件太大** 大型数据文件（CSV、Parquet）不宜直接进 Git；小型、脱敏的示例或测试数据可按团队规则纳入版本管理
3. **配置文件含密码** 数据库连接信息、API Key 必须妥善处理
4. **多环境配置** 开发/测试/生产环境配置各不同
5. **跑批脚本的版本** 调度配置、Airflow DAG 也需要版本管理

---

## SQL 脚本版本管理

### 为什么 SQL 尤其需要版本管理

SQL 是数据仓库的核心资产，却经常被忽视：

- 一个维度表的建表 SQL 可能维护了 3 年，谁也不知道每次改了什么
- 生产上的 SQL 和代码仓库里的不一致（手动修改没回写）
- 分析 SQL 和生产 ETL SQL 混在一起，难以区分

### SQL 文件的组织方式

按数据分层组织（与数仓分层对应）：

```text
sql/
├── ods/                    # 原始数据层
│   ├── ods_order_info_full.sql
│   └── ods_user_info_full.sql
├── dwd/                    # 明细数据层
│   ├── dwd_trade_order_detail_di.sql
│   └── dwd_user_behavior_di.sql
├── dws/                    # 汇总数据层
│   ├── dws_trade_user_order_1d.sql
│   └── dws_trade_user_gmv_weekly.sql
├── ads/                    # 应用数据层
│   ├── ads_gmv_daily.sql
│   └── ads_user_retention.sql
├── dim/                    # 维度层
│   ├── dim_user_full.sql
│   └── dim_product_full.sql
└── ddl/                    # 建表语句
    ├── create_ods_tables.sql
    ├── create_dwd_tables.sql
    └── create_ads_tables.sql
```

### SQL 文件的 commit 规范

```bash
# 新增指标表
git commit -m "feat(dws): 新增用户周度GMV汇总表 dws_trade_user_gmv_weekly"

# 修复逻辑
git commit -m "fix(dwd): 修复dwd_trade_order_detail中退款订单被错误包含的问题"

# 性能优化
git commit -m "perf(ads): 优化ads_gmv_daily查询，用分区裁剪替代全表扫描"

# 修改表结构
git commit -m "feat(dim): 为dim_user添加user_level字段（用户等级）"
```

### SQL 文件的注释规范

在 SQL 文件头部加上版本注释，方便追溯：

```sql
-- ==================================================
-- 文件名：dws_trade_user_gmv_weekly.sql
-- 描述：用户周度GMV汇总，用于周报分析
-- 数据粒度：user_id + 自然周
-- 产出表：dws_trade_user_gmv_weekly
-- 依赖表：dwd_trade_order_detail_di
-- 调度周期：每周一 03:00
-- 负责人：Zhang San
-- ==================================================

INSERT OVERWRITE TABLE dws_trade_user_gmv_weekly
PARTITION (dt = '${dt}')
SELECT
  user_id,
  DATE_TRUNC('week', order_date) AS week_start,
  ...
```

> [!tip] 让 Git log 替代注释里的变更历史
> 很多老 SQL 文件头部有几十行"变更历史"注释，这是在没有版本控制时代的做法。用了 Git 后，直接 `git log --follow sql/xxx.sql` 就能看到完整变更历史，注释里不需要再维护这些内容了。

---

## ETL 代码（Python/Spark/Flink）管理

### Python ETL 项目结构

```text
data-pipeline/
├── .git/
├── .gitignore
├── README.md
├── requirements.txt          # Python 依赖
├── setup.py                  # 包安装配置（如果需要）
│
├── conf/                     # 配置文件
│   ├── config.yaml           # 非敏感通用配置（进版本库）
│   ├── config.dev.yaml       # 开发环境配置（进版本库）
│   └── config.local.yaml     # 本地敏感配置（不进版本库！）
│
├── sql/                      # SQL 脚本
│   ├── ods/
│   ├── dwd/
│   └── ads/
│
├── src/                      # Python 源码
│   ├── __init__.py
│   ├── etl/                  # ETL 逻辑
│   │   ├── __init__.py
│   │   ├── orders_etl.py
│   │   └── users_etl.py
│   ├── utils/                # 工具函数
│   │   ├── __init__.py
│   │   ├── db_utils.py
│   │   └── date_utils.py
│   └── jobs/                 # Spark Job 入口
│       ├── orders_job.py
│       └── users_job.py
│
├── tests/                    # 单元测试
│   ├── test_orders_etl.py
│   └── test_utils.py
│
├── dags/                     # Airflow DAG（如果用 Airflow）
│   ├── orders_pipeline.py
│   └── users_pipeline.py
│
└── scripts/                  # 辅助脚本
    ├── init_db.sh
    └── run_local.sh
```

### Spark 作业的版本管理

```bash
# Spark 提交脚本也要进版本库
spark/
├── jobs/
│   ├── orders_etl_job.py
│   └── users_etl_job.py
└── submit/
    ├── submit_orders_etl.sh    # Spark submit 命令（不含敏感信息）
    └── submit_users_etl.sh
```

`submit_orders_etl.sh` 示例（不含密码）：

```bash
#!/bin/bash
# 从环境变量或配置中心读取敏感信息，不要硬编码

spark-submit \
  --master yarn \
  --deploy-mode cluster \
  --num-executors 10 \
  --executor-memory 4g \
  --executor-cores 2 \
  --jars ${JDBC_JAR_PATH} \
  --conf spark.app.name=OrdersETL \
  jobs/orders_etl_job.py \
  --date "${1:-$(date +%Y-%m-%d)}"
```

---

## 配置文件与敏感信息管理

这是数据项目最容易出安全问题的地方。

### 分层配置策略

```yaml
# config.yaml（进版本库，只含非敏感配置）
app:
  name: data-pipeline
  log_level: INFO

spark:
  master: yarn
  num_executors: 10
  executor_memory: 4g

hive:
  metastore_uri: thrift://hive-metastore:9083
  # 注意：密码不在这里！

schedule:
  orders_etl: "0 2 * * *"
  users_etl: "0 3 * * *"
```

```yaml
# config.local.yaml（不进版本库，存放敏感信息）
# 在 .gitignore 里添加 config.local.yaml

databases:
  mysql:
    host: 192.168.1.100
    port: 3306
    database: prod_db
    username: etl_user
    password: your_secret_password_here   # 这里放密码

  clickhouse:
    host: 192.168.1.200
    password: another_secret_password
```

### 用环境变量传递敏感信息

```python
import os

db_config = {
    "host": os.environ.get("DB_HOST", "localhost"),
    "port": int(os.environ.get("DB_PORT", "3306")),
    "username": os.environ.get("DB_USER"),
    "password": os.environ.get("DB_PASSWORD"),  # 从环境变量读，不写死
}
```

在 CI/CD 系统（如 GitLab CI、GitHub Actions）中，把密码存在 Secrets 里，运行时自动注入为环境变量。

### 使用模板文件

```bash
# 版本库中提供模板（进版本库）
config.local.yaml.template

# 开发者克隆后根据模板创建自己的本地配置
cp config.local.yaml.template config.local.yaml
# 然后填入自己的配置
```

> [!warning] 密码千万不能进 Git 历史
> 这不是"最好不要"而是"绝对不行"。一旦进了 Git 历史，即使你删掉文件，通过 `git log` 还是能找回来。如果是公开仓库，搜索引擎可能已经爬取了。
>
> 如果已经发生了：
> 1. 立即更换泄露的密码（这是第一优先级！）
> 2. 用 `BFG Repo Cleaner` 清理 Git 历史
> 3. 在备份、确认待改写引用并协调协作者后，强制推送清理后的历史，通知所有协作者重新 clone；远端缓存、fork、备份及旧克隆仍可能保留秘密，需按托管平台和团队流程另行处理，历史清理不能替代凭据撤销或轮换

---

## 多环境管理

数据项目通常有 dev（开发）、test（测试）、prod（生产）三个环境。

### 分支与环境的映射

```text
feature/* → 开发环境（本地跑或 dev 集群）
develop   → 测试环境（自动部署触发）
main      → 生产环境（手动 merge 触发，严格审查）
```

### 环境变量在不同环境的配置

```python
# settings.py
import os

ENV = os.environ.get("APP_ENV", "dev")  # dev / test / prod

CONFIG_FILES = {
    "dev": "config.dev.yaml",
    "test": "config.test.yaml",
    "prod": "config.prod.yaml",
}

if ENV not in CONFIG_FILES:
    raise ValueError(f"Unsupported APP_ENV: {ENV}")
config_file = CONFIG_FILES[ENV]
```

---

## Git LFS：处理大文件

数据文件（CSV、Parquet、模型文件）不应该直接进 Git 仓库，因为：
- Git 不适合管理频繁变化的大二进制文件；虽然打包时可能采用差分压缩，历史版本仍可能使仓库显著增大
- clone 和 pull 会极慢

### 什么是 Git LFS

Git LFS（Large File Storage）是 Git 的扩展，把大文件存储在独立的对象存储中，Git 仓库里只保留指向这些文件的指针。

```bash
# 安装 Git LFS
# macOS
brew install git-lfs
# Linux
apt install git-lfs  # 或 yum install git-lfs

# 初始化（只需要做一次）
git lfs install

# 追踪特定类型的文件
git lfs track "*.parquet"
git lfs track "*.csv"
git lfs track "*.model"
git lfs track "data/**"

# 查看当前追踪规则（存储在 .gitattributes）
git lfs track

# 若采用后文 .gitignore，先移除或调整会忽略 data/sample.parquet 的规则
# 提交 .gitattributes，确保协作者获得相同的 LFS 追踪规则
# 正常地 add/commit/push，LFS 自动处理
git add .gitattributes data/sample.parquet
git commit -m "chore: 添加示例数据"
git push
```

### .gitattributes 示例

```text
# 让 Git LFS 管理数据文件
*.parquet filter=lfs diff=lfs merge=lfs -text
*.csv filter=lfs diff=lfs merge=lfs -text
*.orc filter=lfs diff=lfs merge=lfs -text
*.avro filter=lfs diff=lfs merge=lfs -text
*.model filter=lfs diff=lfs merge=lfs -text
*.pkl filter=lfs diff=lfs merge=lfs -text
data/** filter=lfs diff=lfs merge=lfs -text
```

### 更好的替代方案：数据与代码分离

对于真正的大规模数据文件，更推荐的方式是完全不放进 Git：

- **大型数据文件** → 放 HDFS 等分布式文件系统或 S3、OSS 等对象存储，在代码里写路径
- **模型文件** → 用 MLflow 等模型管理工具
- **小型示例数据** → 生成脚本（而不是存实际数据文件）

```python
# bad: 直接引用大文件路径（文件不进 Git）
data_path = "/data/warehouse/ads/orders_20240101.parquet"

# good: 路径写在配置文件里，代码引用配置
data_path = config.get("data.orders_path")
```

---

## 数据项目的 Git 工作流案例

### 案例：新增一张指标表

从需求开发到合入测试分支的 Git 操作流示例（生产上线还需合入生产分支、通过发布审批并完成部署验证）：

```bash
# 1. 同步最新代码
git switch develop
git pull origin develop

# 2. 创建功能分支
git switch -c feature/ads-user-retention-metric

# 3. 开发
# 创建 SQL 文件
touch sql/ads/ads_user_retention_weekly.sql
# 写 SQL 逻辑...

# 创建调度 DAG
touch dags/user_retention_pipeline.py

# 4. 分批次提交（有意义的小步提交）
git add sql/ads/ads_user_retention_weekly.sql
git commit -m "feat(ads): 新增用户留存率指标SQL"

git add dags/user_retention_pipeline.py
git commit -m "feat(dags): 新增用户留存率指标调度DAG"

# 5. 推送分支，创建 PR
git push -u origin feature/ads-user-retention-metric
# 在 GitHub/GitLab 上创建 PR，填写描述

# 6. 根据 Review 意见修改
git add sql/ads/ads_user_retention_weekly.sql
git commit -m "fix: 根据review意见修复新用户定义（首单用户而非注册用户）"
git push

# 7. PR 合并到 develop 后，打测试分支里程碑 tag（如果需要）
# 此标签不代表已完成生产上线；生产发布标签应指向实际部署的提交
git switch develop
git pull
git tag -a retention-v1.0 -m "用户留存率指标体系v1.0测试分支里程碑"
git push origin retention-v1.0
```

---

## 团队 Git 规范文档示例

强烈建议在项目根目录创建 `CONTRIBUTING.md`，写清楚团队约定：

```markdown
# 贡献指南

## 分支命名规范
- feature/功能描述
- fix/问题描述
- hotfix/紧急修复描述

## Commit Message 规范
格式：type(scope): description
- feat: 新功能
- fix: 修复bug
- perf: 性能优化
- refactor: 重构
- docs: 文档

## PR 合并规则
- 至少需要 1 人 Review 通过
- CI 测试（如有）必须全部通过
- 合并方式统一用 Squash merge

## 分支保护
- main 和 develop 分支不允许直接 push
- 所有变更必须通过 PR 合并
```

---

## .gitignore 数据项目完整版

```gitignore
# =====================
# 数据文件（用对象存储，不进 Git）
# =====================
data/raw/
data/processed/
data/output/
*.parquet
*.orc
*.avro
*.csv
# 允许小型示例数据
!tests/fixtures/*.csv

# =====================
# 敏感配置
# =====================
.env
.env.local
.env.*.local
config.local.yaml
conf/config.local.yaml
config/local.yaml
config/local.ini
config/*.prod.yaml
credentials/
secrets/
*.pem
*.key
*.p12

# =====================
# Python
# =====================
__pycache__/
*.py[cod]
*$py.class
.Python
.venv/
venv/
env/
*.egg-info/
dist/
build/
.pytest_cache/
.coverage
htmlcov/

# =====================
# Jupyter
# =====================
.ipynb_checkpoints/
*.ipynb_checkpoints

# =====================
# 日志和临时文件
# =====================
*.log
logs/
tmp/
temp/
.cache/

# =====================
# IDE
# =====================
.idea/
.vscode/
*.swp
.DS_Store
Thumbs.db

# =====================
# Spark
# =====================
derby.log
metastore_db/
spark-warehouse/

# =====================
# 依赖
# =====================
node_modules/
```

---

## 小结：数据项目 Git 核实践

| 场景 | 最佳实践 |
|------|---------|
| SQL 脚本 | 按数仓分层组织目录，每次改动写清楚 commit message |
| 敏感配置 | 环境变量或配置中心，绝对不硬编码在代码里 |
| 多环境配置 | 非敏感配置进 Git，敏感配置用模板 + 本地覆盖 |
| 大数据文件 | 不进 Git，用 HDFS 等分布式文件系统或 S3/OSS 等对象存储 |
| 调度配置 | DAG 文件、调度脚本都应进版本库 |
| 代码审查 | 所有进 main/develop 的变更必须经过 PR 审查 |

---

---

> [!info] 前置知识
> - [[【技术与工具】/Git/07-Git进阶技巧|Git进阶技巧]] - stash、rebase 等进阶操作在数据项目中会高频用到
> - [[【技术与工具】/Git/05-远程仓库协作|远程仓库协作]] - Pull Request 工作流是数据团队协作的标准模式

---

## 掌握检查

- [ ] 能按数仓分层（ODS/DWD/DWS/ADS）组织 SQL 脚本目录结构，不把所有 SQL 堆在同一个目录
- [ ] 数据库连接密码等敏感信息绝不硬编码到代码中，知道用环境变量或配置模板代替
- [ ] 知道 `.parquet`、`.csv`（大文件）不进 Git，而是存 HDFS/OSS，代码里只引用路径
- [ ] commit message 能清楚说明 SQL 改动的业务含义，如 `fix(dws): 修正用户留存率分母定义为自然月活跃用户`
- [ ] 新增指标从需求到合入测试分支的 Git 流程：新建分支 → 提交 SQL + DAG → PR → Review → 合并；生产上线还需合入生产分支、完成测试与发布审批、准备回滚并验证实际部署

---

## 实践练习

**基础题**：为一个数据项目创建标准目录结构（`sql/ods/`、`sql/dwd/`、`sql/ads/`、`dags/`、`scripts/`、`docs/`），在其中创建一个示例 SQL 文件，写好有意义的 commit message 提交，推送到远程。

**进阶题**：为该仓库配置完整的 `.gitignore`（包括数据文件、Python 环境、IDE 配置、日志文件），用 `git status` 验证这些文件不会被追踪，用 `git check-ignore -v` 验证规则生效，并提交 `.gitignore` 文件本身。

---

下一步：[[【技术与工具】/Git/09-Git常用命令速查|Git命令速查]] - 按场景整理的命令速查表，随时翻阅。

上一步：[[【技术与工具】/Git/07-Git进阶技巧|Git进阶技巧]] | 返回：[[【技术与工具】/Git/00-Git学习路线图|Git学习路线图]]
