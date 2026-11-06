---
title: dbt 安装与项目初始化
tags:
- dbt
- 安装配置
- 项目初始化
- profiles.yml
- 环境搭建
aliases:
- dbt安装
- dbt配置
- dbt init
date: 2026-03-18
difficulty: 基础
duration: 1.5-2小时
knowledge_type: technical-practice
target_audience:
- 数据开发工程师
- 数据分析师
- BI分析师
stability: slow-changing
status: active
access_tier: free
created: '2026-03-18'
updated: '2026-10-09'
---


# dbt 安装与项目初始化

> [!abstract] 本文目标
> 完成本文后，你将拥有一个能正常运行的 dbt 开发环境，并理解 dbt 项目的目录结构。
> 预计时间：1.5-2 小时

---

## 前置准备

### 需要的工具

| 工具 | 说明 | 必要性 |
|------|------|-------|
| Python | dbt Core 是 Python 包；Python 版本须满足所选 dbt Core 和适配器的支持要求 | 必须 |
| pip 或 pipx | Python 包管理器 | 必须 |
| 一个数据库 | PostgreSQL / DuckDB / BigQuery 等 | 必须 |
| Git | 版本控制（强烈推荐） | 强烈建议 |
| VS Code | 编辑器，安装 dbt 插件体验更好 | 推荐 |

> [!tip] 如果没有数据库怎么办
> 最简单的方案是安装 **DuckDB** —— 它是一个嵌入式分析数据库，不需要服务器，直接作为 Python 库安装：
> ```bash
> pip install dbt-duckdb
> ```
> DuckDB 非常适合本地学习和原型开发。

---

## 安装 dbt Core

### 方案一：使用 pip（推荐新手）

```bash
# 先创建虚拟环境（强烈建议，避免包版本冲突）
python -m venv dbt-env
source dbt-env/bin/activate    # macOS / Linux
# dbt-env\Scripts\activate     # Windows

# 安装 dbt core + 适配器
# 根据你的数据库选择安装对应的适配器

# PostgreSQL 用户
pip install dbt-core dbt-postgres

# DuckDB 用户（最适合本地学习）
pip install dbt-core dbt-duckdb

# MySQL 用户
pip install dbt-core dbt-mysql

# BigQuery 用户
pip install dbt-core dbt-bigquery

# Snowflake 用户
pip install dbt-core dbt-snowflake

# ClickHouse 用户
pip install dbt-core dbt-clickhouse
```

### 方案二：使用 pipx（推荐有经验的用户）

```bash
# pipx 安装工具会隔离在独立环境中，不会污染系统 Python
pipx install dbt-core
pipx inject dbt-core dbt-postgres   # 注入适配器
```

### 验证安装

```bash
dbt --version

# 预期输出类似：
# Core:
#   - installed: 1.8.x
#   - latest:    1.8.x - Up to date!
#
# Plugins:
#   - postgres: 1.8.x - Up to date!
```

> [!warning] 版本兼容性
> dbt Core 和适配器必须满足彼此的依赖约束，不能仅凭主版本号或完整版本号是否相同判断兼容性。
> 本文的 `1.8.x` 输出仅用于展示格式，不代表安装命令会安装该版本，也不代表 Core 和适配器必须使用相同版本号。
> 如果安装后出现错误，首先检查 Python 支持范围及 Core、适配器的依赖要求。

---

## 创建 dbt 项目

### 使用 dbt init

```bash
# 在你想要创建项目的父目录下运行
dbt init my_analytics_project
```

dbt init 会启动一个交互式向导：

```text
Running with dbt=1.8.x
Enter a name for your project (letters, digits, underscore): my_analytics_project
Which database would you like to use?
[1] postgres
[2] duckdb
Enter a number: 1    # 根据你的选择输入

# 然后它会问你数据库连接信息
host (hostname for the instance): localhost
port [5432]:
user (dev username): your_username
pass (dev password):
dbname (default database): analytics
schema (default target schema): dbt_dev   # 推荐用开发专用 schema
threads (1 or more) [1]: 4

# 完成后：
Profile my_analytics_project written to /Users/you/.dbt/profiles.yml
Run `dbt debug` to validate the connection
```

> [!note] schema 的命名建议
> 开发环境用 `dbt_yourname` 或 `dbt_dev`，这样你的开发表和其他人的不冲突。
> 生产环境通常用 `analytics` 或按业务域命名，如 `mart_finance`。

---

## profiles.yml 详解

`profiles.yml` 是 dbt 的数据库连接配置文件，**默认存放在 `~/.dbt/profiles.yml`**（用户主目录下的 `.dbt` 文件夹）。

> [!warning] 安全警告
> `profiles.yml` 包含数据库密码，**绝对不要提交到 Git 仓库**！
> 它存放在项目目录之外正是为了避免这个问题。
> 如果该文件位于 Git 仓库内，应在 `.gitignore` 中添加相应忽略规则，并确认它未被 Git 跟踪；忽略规则不会自动移除已被跟踪的文件。

### PostgreSQL 连接配置示例

```yaml
# ~/.dbt/profiles.yml

my_analytics_project:            # 与 dbt_project.yml 中的 profile 名称对应
  target: dev                    # 默认使用哪个 target
  outputs:
    dev:                         # 开发环境
      type: postgres
      host: localhost
      port: 5432
      user: dbt_user
      password: your_password
      dbname: analytics_db
      schema: dbt_dev            # 开发时写入这个 schema
      threads: 4                 # 并行运行的线程数
      keepalives_idle: 0         # 连接保活设置

    prod:                        # 生产环境
      type: postgres
      host: prod-db.company.com
      port: 5432
      user: dbt_prod_user
      password: "{{ env_var('DBT_PROD_PASSWORD') }}"  # 生产密码用环境变量
      dbname: analytics_db
      schema: analytics          # 生产环境写入 analytics schema
      threads: 8
```

### DuckDB 连接配置示例（最简单）

```yaml
my_analytics_project:
  target: dev
  outputs:
    dev:
      type: duckdb
      path: /path/to/my_database.duckdb  # 数据库文件路径
      threads: 4
```

### BigQuery 连接配置示例

```yaml
my_analytics_project:
  target: dev
  outputs:
    dev:
      type: bigquery
      method: oauth                      # 使用 gcloud auth 认证
      project: my-gcp-project-id
      dataset: dbt_dev                   # BigQuery 里 dataset = schema
      threads: 4
      timeout_seconds: 300
      location: US
      priority: interactive
```

### 使用环境变量（最佳实践）

在生产环境，密码不应该硬编码在配置文件里：

```yaml
# profiles.yml 中引用环境变量
my_analytics_project:
  target: prod
  outputs:
    prod:
      type: postgres
      host: "{{ env_var('DB_HOST') }}"
      user: "{{ env_var('DB_USER') }}"
      password: "{{ env_var('DB_PASSWORD') }}"
      dbname: "{{ env_var('DB_NAME') }}"
      schema: analytics
      threads: 8
```

```bash
# 在 shell 中设置环境变量
export DB_HOST=prod-db.company.com
export DB_USER=dbt_prod
export DB_PASSWORD=secret_password
export DB_NAME=analytics_db
```

---

## 项目目录结构详解

下面是初始化模板及后续按需添加文件的项目结构示例；具体初始化产物随版本、模板而异，packages.yml是声明包依赖时按需添加的文件：

```text
my_analytics_project/
│
├── dbt_project.yml          # 项目配置文件（核心配置）
│
├── models/                  # 存放所有 SQL 模型（最重要的目录）
│   └── example/             # dbt 自带的示例模型
│       ├── my_first_dbt_model.sql
│       ├── my_second_dbt_model.sql
│       └── schema.yml
│
├── tests/                   # 自定义测试（高级用法）
│
├── macros/                  # Jinja 宏（代码复用）
│
├── seeds/                   # CSV 文件（维度映射表等）
│
├── snapshots/               # 快照（实现 SCD Type 2）
│
├── analyses/                # 可编译的分析SQL，不由dbt run物化为模型
│
├── packages.yml             # 包依赖（类似 Python 的 requirements.txt）
│
└── README.md                # 项目说明
```

### dbt_project.yml 详解

这是最重要的配置文件：

```yaml
# dbt_project.yml

name: 'my_analytics_project'    # 项目名称
version: '1.0.0'
config-version: 2

# 指向 profiles.yml 中的哪个 profile
profile: 'my_analytics_project'

# 各目录的路径配置（通常保持默认即可）
model-paths: ["models"]
analysis-paths: ["analyses"]
test-paths: ["tests"]
seed-paths: ["seeds"]
macro-paths: ["macros"]
snapshot-paths: ["snapshots"]

# 编译产物存放目录（不要提交到 Git）
target-path: "target"
clean-targets:
  - "target"
  - "dbt_packages"

# 模型的默认配置
models:
  my_analytics_project:
    # staging 层：默认物化为 view（节省存储空间）
    staging:
      +materialized: view
      +schema: staging

    # intermediate 层：默认物化为 view
    intermediate:
      +materialized: view
      +schema: intermediate

    # marts 层：默认物化为 table（查询性能好）
    marts:
      +materialized: table
      +schema: marts
```

> [!note] `+` 前缀的含义
> 在 `dbt_project.yml` 中，配置项前加 `+` 表示这是模型配置（而不是文件夹名）。
> 推荐用 `+` 前缀明确区分配置项与目录名；部分配置支持不带 `+` 的写法，因此不能将所有未加前缀的键都视为子目录名。

---

## 测试连接

项目创建后，立即验证连接是否正常：

```bash
cd my_analytics_project

dbt debug
```

成功的输出：

```text
All checks passed!
```

失败时会给出具体错误，常见问题：

```markdown
# 连接超时：检查 host 和 port
Connection refused

# 认证失败：检查用户名密码
password authentication failed for user "..."

# 数据库不存在：检查 dbname
database "..." does not exist

# schema 权限不足：检查用户权限
permission denied for schema "..."
```

---

## 运行第一次 dbt

```bash
# 运行所有模型
dbt run

# 预期输出：
# Running with dbt=1.8.x
# Found 2 models, 4 tests, 0 snapshots...
#
# 09:01:23  Concurrency: 4 threads...
# 09:01:23  1 of 2 START sql view model dbt_dev.my_first_dbt_model ......... [RUN]
# 09:01:23  1 of 2 OK created sql view model dbt_dev.my_first_dbt_model ... [CREATE VIEW in 0.35s]
# 09:01:23  2 of 2 START sql view model dbt_dev.my_second_dbt_model ....... [RUN]
# 09:01:24  2 of 2 OK created sql view model dbt_dev.my_second_dbt_model .. [CREATE VIEW in 0.27s]
#
# Finished running 2 view models in 0 hours 0 minutes and 0.84 seconds.
# Completed successfully
```

```bash
# 运行测试
dbt test

# 查看生成的文档
dbt docs generate
dbt docs serve    # 在浏览器打开 http://localhost:8080
```

---

## 推荐的项目初始结构

dbt 官方推荐的成熟项目结构如下（这是实际项目应该长的样子）：

```text
models/
├── staging/                 # 源数据清洗层
│   ├── _sources.yml         # 定义数据源
│   ├── stg_orders.sql
│   └── stg_customers.sql
│
├── intermediate/            # 中间逻辑层（可选）
│   └── int_order_items_joined.sql
│
└── marts/                   # 数据集市层（最终产出）
    ├── core/                # 核心指标
    │   ├── fct_orders.sql
    │   └── dim_customers.sql
    └── finance/             # 按业务域分组
        └── fct_revenue.sql
```

关于这套分层架构的详细解释，见 [[【技术与工具】/dbt/04-数据建模分层]]。

---

## VS Code 插件推荐

提升开发体验的必装插件：

| 插件 | 功能 |
|------|------|
| dbt Power User | 模型跳转、自动补全、内联预览、血缘图 |
| Rainbow CSV | CSV 文件高亮（查看 seed 文件很有用） |
| YAML | YAML 语法高亮和验证 |
| GitLens | Git 历史查看 |

```bash
# VS Code 插件安装（或在 VS Code 扩展市场搜索）
# dbt Power User 是最值得安装的，它把 dbt 的很多命令行操作变成了图形界面操作
```

---

## 常见安装问题

> [!warning] 常见坑：Python 版本问题
> Python 版本须满足所选 dbt Core 和适配器的支持要求，不能将 Python 3.8 视为所有版本的通用最低要求。如果系统 Python 是 2.7，需要先升级到所选版本支持的 Python。
> 推荐使用 pyenv 管理多个 Python 版本。

> [!warning] 常见坑：profiles.yml 路径
> 默认路径是 `~/.dbt/profiles.yml`，不是项目目录内。
> 如果 `dbt debug` 提示找不到 profile，检查这个文件是否存在。

> [!warning] 常见坑：数据库权限
> dbt 运行的数据库用户需要有创建 schema、创建表和视图的权限。
> PostgreSQL 示例：
> ```sql
> -- 给 dbt 用户必要的权限
> CREATE USER dbt_user WITH PASSWORD 'password';
> GRANT CREATE ON DATABASE analytics_db TO dbt_user;
> GRANT USAGE ON SCHEMA public TO dbt_user;
> GRANT CREATE ON SCHEMA public TO dbt_user;
> ```

---

## 总结

| 步骤 | 命令 | 说明 |
|------|------|------|
| 安装 | `pip install dbt-core dbt-postgres` | 根据数据库选择适配器 |
| 初始化 | `dbt init project_name` | 创建项目目录结构 |
| 配置连接 | 编辑 `~/.dbt/profiles.yml` | 填写数据库连接信息 |
| 验证 | `dbt debug` | 检查连接是否正常 |
| 运行 | `dbt run` | 执行所有模型 |
| 测试 | `dbt test` | 运行数据质量测试 |

---

## 下一步

环境搭好了，开始学 dbt 的核心概念：

[[【技术与工具】/dbt/03-Model基础]] - 理解 dbt 模型是什么，如何写你的第一个模型

---

*最后更新：2026-10-09*

#dbt #安装配置 #profiles #项目初始化 #环境搭建

---

> [!info] 前置知识
> - 理解 dbt 的核心理念（它是做 Transform 的，不是 ETL 全链路工具），参考 [[【技术与工具】/dbt/01-dbt概述与理念|dbt 概述与理念]]
> - Python 基础（pip 安装、虚拟环境）
> - 有一个可连接的数据库（PostgreSQL、BigQuery、Snowflake 或本地 DuckDB 均可）

---

## 掌握检查

- [ ] 能在本机成功运行 `dbt debug`，输出全部 OK（连接正常、profiles 配置正确）
- [ ] 理解 `profiles.yml` 中 `dev` 和 `prod` 两个 target 的用途，能切换 target 运行 `dbt run --target prod`
- [ ] 能解释 `dbt_project.yml` 中 `models` 配置块的作用（指定每个子目录的默认物化方式）
- [ ] 知道 `dbt deps` 命令的作用：下载 `packages.yml` 中声明的第三方包（如 dbt-utils）
- [ ] 能运行 `dbt run` 并在数据库中找到 dbt 创建的视图或表

---

## 实践练习

**基础题**：按照本文步骤，在本地 PostgreSQL（或 DuckDB）中完成 dbt 项目初始化：安装 dbt、创建项目、配置 `profiles.yml`、运行 `dbt debug` 确认连接正常、执行 `dbt run` 跑通内置示例模型。

**进阶题**：在 `profiles.yml` 中添加一个 `dev` target 和一个名为 `prod` 的模拟生产 target，分别指向隔离测试数据库中的 `dbt_dev` 和 `analytics` schema。用 `dbt run --target dev` 和 `dbt run --target prod` 分别运行，验证数据确实写入了不同的 schema。这里的 `prod` 仅是练习用目标名称，不应连接真实生产数据库；真实生产运行须另行确认授权、写入范围与发布流程。
