---
title: dbt 与调度集成 - 自动化运行与 CI/CD
tags:
  - dbt
  - Airflow
  - CI/CD
  - GitHub-Actions
  - 调度
  - 部署
  - 自动化
aliases:
  - dbt调度
  - dbt Airflow集成
  - dbt CI/CD
date: 2026-03-18
difficulty: 高级
duration: 30分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据分析师
  - BI分析师
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


# dbt 与调度集成 - 自动化运行与 CI/CD

> [!abstract] 本文核心
> dbt 本身只是"执行转换"的工具，不管"什么时候执行"。
> 本文讲如何把 dbt 接入调度系统（Airflow）和 CI/CD 流水线（GitHub Actions），
> 实现自动化、可靠的生产运行。

---

## dbt 命令行全览

在学调度集成之前，先掌握所有常用的 dbt 命令：

### 核心运行命令

```bash
# 运行所有模型
dbt run

# 运行特定模型
dbt run --select stg_orders                  # 单个模型
dbt run --select staging                     # 整个目录
dbt run --select +fct_orders                 # 某模型及所有上游
dbt run --select fct_orders+                 # 某模型及所有下游
dbt run --select +fct_orders+                # 某模型及完整上下游

# 排除某些模型
dbt run --exclude staging                    # 排除 staging 层
dbt run --exclude tag:slow                   # 排除打了 slow 标签的

# 运行时传入变量
dbt run --vars '{"start_date": "2024-01-01"}'

# 增量模型全量刷新
dbt run --full-refresh
```

### 测试命令

```bash
# 运行所有测试
dbt test

# 只运行特定模型的测试
dbt test --select fct_orders

# 只运行某类测试
dbt test --select test_type:generic          # 只跑 schema 测试
dbt test --select test_type:singular         # 只跑自定义 SQL 测试
```

### 构建命令（推荐）

```bash
# dbt build 按依赖顺序运行选中的 seed、snapshot、模型及测试
# 错误级测试失败会影响相关下游节点的执行；测试时机取决于依赖图
dbt build

# 推荐的生产命令
dbt build --select +fct_orders
```

### 其他常用命令

```bash
# 加载 seed 文件
dbt seed

# 运行 snapshot
dbt snapshot

# 生成文档
dbt docs generate

# 编译（只生成 SQL，不执行）
dbt compile

# 查看模型列表
dbt ls --select staging

# 检查环境配置
dbt debug

# 清理编译产物
dbt clean
```

---

## 与 Airflow 集成

[[【技术与工具】/Airflow/02-Airflow核心概念|Airflow核心概念]] 是最常见的 dbt 调度方案。有两种集成方式：

### 方式一：BashOperator（简单但有效）

```python
# dags/dbt_daily_pipeline.py

from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.bash import BashOperator

# DAG 配置
default_args = {
    'owner': 'data-team',
    'depends_on_past': False,
    'start_date': datetime(2024, 1, 1),
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
    'email_on_failure': True,
    'email': ['data-alerts@company.com'],
}

with DAG(
    dag_id='dbt_daily_build',
    default_args=default_args,
    description='每日 dbt 构建与测试（增量模型按其增量逻辑执行）',
    schedule_interval='0 3 * * *',    # 每天凌晨 3 点运行
    catchup=False,
    tags=['dbt', 'daily'],
) as dag:

    # 环境变量配置
    dbt_env = {
        'DBT_PROFILES_DIR': '/home/airflow/dbt',    # profiles.yml 所在目录
        'DB_HOST': '{{ var.value.db_host }}',       # 从 Airflow Variables 读取
        'DB_PASSWORD': '{{ var.value.db_password }}',
    }
    dbt_project_dir = '/home/airflow/dbt/my_analytics_project'

    # 步骤 1：安装依赖
    install_deps = BashOperator(
        task_id='dbt_deps',
        bash_command=f'cd {dbt_project_dir} && dbt deps',
        env=dbt_env,
    )

    # 步骤 2：加载 seed 数据
    seed = BashOperator(
        task_id='dbt_seed',
        bash_command=f'cd {dbt_project_dir} && dbt seed',
        env=dbt_env,
    )

    # 步骤 3：运行 snapshot
    snapshot = BashOperator(
        task_id='dbt_snapshot',
        bash_command=f'cd {dbt_project_dir} && dbt snapshot',
        env=dbt_env,
    )

    # 步骤 4：构建所有模型并运行测试
    build = BashOperator(
        task_id='dbt_build',
        bash_command=f'cd {dbt_project_dir} && dbt build --fail-fast',
        env=dbt_env,
    )

    # 步骤 5：生成文档（可选）
    docs = BashOperator(
        task_id='dbt_docs',
        bash_command=f'cd {dbt_project_dir} && dbt docs generate',
        env=dbt_env,
    )

    # 定义执行顺序
    install_deps >> seed >> snapshot >> build >> docs
```

### 方式二：Cosmos（推荐，更强大）

[astronomer-cosmos](https://github.com/astronomer/astronomer-cosmos) 是 Astronomer 出品的 dbt + Airflow 集成包，它能把 dbt 项目自动转换为 Airflow DAG，每个 dbt 模型变成一个独立的 Task：

```python
# dags/dbt_cosmos_pipeline.py

from cosmos import DbtDag, ProjectConfig, ProfileConfig, ExecutionConfig
from cosmos.profiles import PostgresUserPasswordProfileMapping
from datetime import datetime

# 配置数据库连接（从 Airflow Connection 读取）
profile_config = ProfileConfig(
    profile_name='my_analytics_project',
    target_name='prod',
    profile_mapping=PostgresUserPasswordProfileMapping(
        conn_id='postgres_analytics',    # Airflow Connection ID
        profile_args={
            'schema': 'analytics'
        },
    ),
)

# 定义 DAG：dbt 项目自动转换为 Airflow Task Graph
dbt_dag = DbtDag(
    project_config=ProjectConfig(
        '/home/airflow/dbt/my_analytics_project',
    ),
    profile_config=profile_config,
    execution_config=ExecutionConfig(
        dbt_executable_path='/home/airflow/.venv/dbt/bin/dbt',
    ),
    schedule_interval='@daily',
    start_date=datetime(2024, 1, 1),
    catchup=False,
    dag_id='dbt_cosmos_dag',
    default_args={'retries': 1},
)
```

使用 Cosmos 的优势：
- dbt 的每个 Model 在 Airflow UI 中都是独立的 Task，可以单独重跑
- 自动展示 dbt 的血缘依赖关系
- 支持跳过、重试单个模型

### 分层调度策略

实际生产中，不同层次的更新频率不同：

```python
# 分层调度：不同层次不同频率

# 每小时刷新 staging 层（接近实时）
with DAG('dbt_hourly_staging', schedule_interval='0 * * * *') as dag_hourly:
    BashOperator(
        task_id='build_staging',
        bash_command='dbt build --select staging',
    )

# 每天凌晨重建 marts 层
with DAG('dbt_daily_marts', schedule_interval='0 2 * * *') as dag_daily:
    BashOperator(
        task_id='build_marts',
        bash_command='dbt build --select marts --fail-fast',
    )
```

---

## 与 CI/CD 集成（GitHub Actions）

CI/CD 集成的核心目标：**每次代码合并前自动运行 dbt 测试，并结合分支保护中的必需状态检查，阻止未通过指定检查的代码合并；测试覆盖范围决定能发现哪些问题**。

### PR 触发的测试流水线

```yaml
# .github/workflows/dbt-ci.yml
# 每次 PR 创建或更新时触发

name: dbt CI - Run Tests

on:
  pull_request:
    branches: [main, develop]
    paths:
      - 'models/**'
      - 'tests/**'
      - 'macros/**'
      - 'seeds/**'
      - 'snapshots/**'
      - 'dbt_project.yml'
      - 'packages.yml'

jobs:
  dbt-test:
    name: Run dbt Tests
    runs-on: ubuntu-latest

    services:
      # 启动临时 PostgreSQL 数据库供测试使用
      postgres:
        image: postgres:14
        env:
          POSTGRES_USER: dbt_ci
          POSTGRES_PASSWORD: ci_password
          POSTGRES_DB: analytics_ci
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Install dbt
        run: pip install dbt-core dbt-postgres

      - name: Create profiles.yml for CI
        run: |
          mkdir -p ~/.dbt
          cat > ~/.dbt/profiles.yml << EOF
          my_analytics_project:
            target: ci
            outputs:
              ci:
                type: postgres
                host: localhost
                port: 5432
                user: dbt_ci
                password: ci_password
                dbname: analytics_ci
                schema: dbt_ci_${{ github.run_id }}
                threads: 4
          EOF

      - name: Install dbt packages
        run: dbt deps

      - name: Load seeds
        run: dbt seed

      - name: Build and test changed models
        run: |
          # 找出 PR 中改变的模型，只测试相关的
          dbt build --select state:modified+  --state ./target
        # 注意：这里用了 state: 选择器，只跑变更了的模型及其下游

      - name: Comment PR with test results
        uses: marocchino/sticky-pull-request-comment@v2
        if: always()
        with:
          message: |
            ## dbt CI Results
            ${{ job.status == 'success' && '✅ All dbt tests passed!' || '❌ Some dbt tests failed!' }}
```

### 主分支合并后的完整构建

```yaml
# .github/workflows/dbt-prod.yml
# 合并到 main 分支后触发生产构建

name: dbt Production Build

on:
  push:
    branches: [main]

jobs:
  dbt-prod:
    name: Production dbt Build
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dbt
        run: pip install dbt-core dbt-postgres

      - name: Install packages
        run: dbt deps
        env:
          DBT_PROFILES_DIR: ${{ github.workspace }}/ci

      - name: Run dbt seed
        run: dbt seed --target prod

      - name: Run dbt snapshot
        run: dbt snapshot --target prod

      - name: Build dbt (seed + snapshot + run + test)
        run: dbt build --target prod --fail-fast

      - name: Generate docs
        run: dbt docs generate --target prod

      - name: Deploy docs to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        if: success()
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./target

      # 失败时发送 Slack 告警
      - name: Notify Slack on failure
        uses: slackapi/slack-github-action@v1
        if: failure()
        with:
          payload: |
            {
              "text": "⚠️ dbt Production Build FAILED!\nRepo: ${{ github.repository }}\nCommit: ${{ github.sha }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## dbt Cloud 调度（SaaS 方案）

如果不想自己维护 Airflow，dbt Cloud 提供了内置的调度功能：

```yaml
# dbt Cloud 的调度配置（通过 Web UI 或 API 设置）
job:
  name: "Daily Production Build"
  commands:
    - dbt deps
    - dbt seed
    - dbt snapshot
    - dbt build --fail-fast
  schedule:
    cron: "0 3 * * *"    # 每天凌晨 3 点
  environment_id: 123     # 配置了数据库连接的环境 ID
```

dbt Cloud 的优势：
- 内置 IDE（Cloud IDE）
- 自动生成并发布文档
- 任务历史和日志管理
- 团队协作权限管理

---

## 部署最佳实践

### 环境分离

```text
开发环境（dev）    →    测试环境（staging）    →    生产环境（prod）

数据库 schema：
- dbt_yourname_dev
- dbt_staging
- analytics（生产 schema）
```

在 profiles.yml 中定义多个 target：

```yaml
# profiles.yml

my_analytics_project:
  target: dev    # 默认目标
  outputs:
    dev:
      type: postgres
      schema: "dbt_{{ env_var('DBT_USER', 'dev') }}"    # 每人独立 schema
      ...

    staging:
      type: postgres
      schema: dbt_staging
      ...

    prod:
      type: postgres
      schema: analytics
      ...
```

```bash
# 指定 target 运行
dbt run --target prod
dbt run --target staging
```

### 生产环境 checklist

```bash
# 推荐的生产运行命令序列

# 1. 安装项目声明及锁定配置所确定的依赖包（不等同于升级到最新版本）
dbt deps

# 2. 加载 seed（如果有变更）
dbt seed --full-refresh

# 3. 运行 snapshot（捕获变更）
dbt snapshot

# 4. 构建所选资源并运行测试（增量模型仍按其增量逻辑执行）
dbt build --fail-fast   # 遇到错误级失败时尽快停止执行

# 5. 生成文档
dbt docs generate
```

> [!warning] 关于 --fail-fast
> `--fail-fast` 标志让 dbt 在遇到错误级失败时尽快停止执行；告警级测试默认不会触发失败，已启动任务的终止也不是原子操作。
> 在希望错误级失败后尽快结束作业的生产场景中可以使用。即使不设置该标志，dbt build 也会依据依赖图和测试结果跳过受错误级测试失败影响的下游节点。
> 在开发环境可以不用，方便收集更多问题。

---

## 监控与告警

```python
# 在 Airflow DAG 中添加失败告警

from airflow.operators.email import EmailOperator

def on_failure_callback(context):
    """任务失败时输出告警日志；此示例尚未实现邮件发送"""
    task_instance = context['task_instance']
    dag_id = context['dag'].dag_id
    task_id = task_instance.task_id
    execution_date = context['execution_date']
    log_url = task_instance.log_url

    # 构造告警主题与邮件正文；此处尚未调用邮件发送接口
    subject = f"[ALERT] dbt Task Failed: {dag_id}.{task_id}"
    html_content = f"""
    <h2>dbt 任务失败告警</h2>
    <p><b>DAG:</b> {dag_id}</p>
    <p><b>Task:</b> {task_id}</p>
    <p><b>执行时间:</b> {execution_date}</p>
    <p><b>日志链接:</b> <a href="{log_url}">查看日志</a></p>
    """

    # 当前仅输出日志；实际发送邮件需配置 SMTP 并调用邮件发送接口
    print(f"Alert: {subject}")

default_args = {
    'on_failure_callback': on_failure_callback,
}
```

---

## 总结

| 场景 | 推荐方案 | 关键配置 |
|------|---------|---------|
| 个人项目 / 小团队 | cron + bash 脚本 | 简单有效 |
| 中型团队 | Airflow + BashOperator | 可视化、可重试 |
| 大型团队 | Airflow + Cosmos | 每个模型独立 Task |
| 不想维护基础设施 | dbt Cloud | SaaS，开箱即用 |
| PR 代码审查 | GitHub Actions | 自动测试；结合必需状态检查阻止未通过检查的代码合并 |

---

## 下一步

掌握了调度集成后，来看一个完整的端到端实战项目：

[[【技术与工具】/dbt/11-dbt项目实战]] - 从零开始构建一个电商数仓，覆盖 source 定义到 marts 输出的全流程

---

*最后更新：2026-03-18*

#dbt #Airflow #CI/CD #GitHub-Actions #调度 #部署

---

> [!info] 前置知识
> - 能独立运行完整的 dbt 项目（dbt seed + snapshot + build），参考 [[【技术与工具】/dbt/09-Seeds与Snapshots|Seeds 与 Snapshots]]
> - 了解 Airflow 的基本概念（DAG、BashOperator），参考 [[【技术与工具】/Airflow/01-工作流调度概述|工作流调度概述]]（如已学习）
> - 了解 GitHub Actions 的基本概念（workflow、job、step）

---

## 掌握检查

- [ ] 能用 `BashOperator` 在 Airflow DAG 中调用 `dbt run --select tag:daily --target prod` 命令，并配置失败告警
- [ ] 理解 Airflow + dbt 的职责分工：Airflow 负责调度和数据抽取（EL），dbt 负责数据转换（T）
- [ ] 能写一个 GitHub Actions workflow，实现 PR 时自动运行 `dbt test`（测试分支代码），合并后自动运行 `dbt build` 部署生产
- [ ] 知道 `dbt build --fail-fast` 的含义：遇到错误级失败时尽快停止执行；告警级测试不默认触发失败，已启动任务的终止也不是原子操作
- [ ] 能说出 dbt Cloud 调度和 Airflow 调度各自的适用场景（小团队用 dbt Cloud 更省运维，大型复杂管道用 Airflow 更灵活）

---

## 实践练习

**基础题**：在 Airflow 中创建一个 DAG，包含两个 Task：第一个用 BashOperator 运行 `dbt snapshot`，第二个运行 `dbt build --select tag:daily --fail-fast`。两个 Task 顺序执行，第一个失败则第二个不运行。触发一次，查看日志确认 dbt 命令正常执行。

**进阶题**：在 GitHub 上创建一个 dbt 项目仓库，配置两个 workflow：（1）PR workflow：在每个 PR 上运行 `dbt test`，测试通过才允许合并；（2）Main workflow：合并到 main 分支后自动运行 `dbt build --target prod`。（可以使用 dbt 官方的 GitHub Actions 示例作为参考。）
