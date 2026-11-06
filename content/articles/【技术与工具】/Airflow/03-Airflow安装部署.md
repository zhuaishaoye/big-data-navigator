---
title: Airflow 3.3 安装部署：本地验证与生产边界
tags:
  - Airflow
  - 安装部署
  - Docker-Compose
  - PostgreSQL
  - Airflow配置
  - 配置管理
aliases:
  - Airflow安装
  - Airflow部署
  - Airflow Docker
updated: 2026-10-10
status: maintenance
knowledge_type: technical-practice
last_verified: 2026-08-12
next_review: 2026-09-12
stability: fast-changing
applies_to:
  - Apache Airflow 3.3
  - Python 3.10-3.14
  - Docker Compose quick-start
source_level: primary
sources:
  - https://airflow.apache.org/docs/apache-airflow/stable/start.html
  - https://airflow.apache.org/docs/apache-airflow/stable/installation/index.html
  - https://airflow.apache.org/docs/apache-airflow/stable/installation/installing-from-pypi.html
  - https://airflow.apache.org/docs/apache-airflow/stable/howto/docker-compose/index.html
  - https://airflow.apache.org/docs/apache-airflow/stable/installation/upgrading_to_airflow3.html
  - https://airflow.apache.org/docs/apache-airflow/stable/administration-and-deployment/logging-monitoring/check-health.html
difficulty: 高级
duration: 30分钟
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据平台运维工程师
access_tier: free
created: 2026-03-18
---


# Airflow 3.3 安装部署

> [!abstract] 本文核心内容
> - Airflow 3.3 的可重复安装基线
> - Docker Compose 快速体验与生产边界
> - 从 Airflow 2.x 升级到 3.x 的关键门禁
> - 原 Airflow 2.8.1 命令的 Legacy 参考

> [!danger] 版本边界
> 本文原有命令全部基于 Airflow 2.8.1，因维护规则不改动现有代码块而保留。它们不是 Airflow 3.3 的当前安装方案。执行任何命令前先确认所在章节是“当前基线”还是“Legacy 2.8.1”。

---

## Airflow 3.3 当前基线

截至 2026-08-12，官方稳定文档为 Airflow 3.3.0，支持 Python 3.10～3.14。PyPI 可重复安装需要为 Airflow 版本和当前 Python 小版本使用对应的官方 constraints 文件。

**本地验证的最短路径**：

```bash
pipx run "apache-airflow==3.3.0" standalone
```

成功信号是进程持续运行、能够取得 Simple Auth Manager 生成的本地凭据，并且浏览器可以打开 Web UI。凭据可能显示在终端，也可能写入 `$AIRFLOW_HOME/simple_auth_manager_passwords.json.generated`；以当前命令输出和生成文件为准。若命令非零退出、凭据无法取得、端口无法访问或日志持续出现数据库迁移失败，则本地验证不通过。Standalone 会同时启动多个组件，只用于学习和本地功能验证，不是生产部署方式。

**需要可重复环境时**：

```bash
python3 -m venv .venv
. .venv/bin/activate

AIRFLOW_VERSION=3.3.0
PYTHON_VERSION="$(python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
CONSTRAINT_URL="https://raw.githubusercontent.com/apache/airflow/constraints-${AIRFLOW_VERSION}/constraints-${PYTHON_VERSION}.txt"
python -m pip install --upgrade pip
python -m pip install "apache-airflow[celery]==${AIRFLOW_VERSION}" --constraint "${CONSTRAINT_URL}"
```

创建虚拟环境的解释器必须位于上文支持范围内。激活后用同一个 `python` 生成 constraints 地址、调用 pip 和执行依赖检查，避免把一个 Python 小版本的约束文件装进另一个解释器或现有业务环境。

安装后至少执行版本与依赖一致性检查：

```bash
airflow version
python -m pip check
```

预期 Airflow 版本为 3.3.0，且依赖检查不报告冲突。这里验证的是“软件能够安装”，不代表数据库、Executor、Provider 或 DAG 已经完成生产验收。

<!-- 旧的 Compose 命令骨架开始：缺少目录与 UID 准备，不作为可复制步骤展示。
**Docker Compose 快速体验**：

```bash
curl -LfO 'https://airflow.apache.org/docs/apache-airflow/3.3.0/docker-compose.yaml'
docker compose up airflow-init
docker compose up -d
docker compose ps
```
旧的 Compose 命令骨架结束。 -->

**Docker Compose 完整快速验证路径**：

```bash
set -euo pipefail

mkdir -p airflow-3.3-compose
cd airflow-3.3-compose

curl -LfO 'https://airflow.apache.org/docs/apache-airflow/3.3.0/docker-compose.yaml'
mkdir -p ./dags ./logs ./plugins ./config

if [ "$(uname -s)" = "Linux" ]; then
  printf 'AIRFLOW_UID=%s\n' "$(id -u)" > .env
else
  printf 'AIRFLOW_UID=50000\n' > .env
fi

docker compose up --abort-on-container-exit --exit-code-from airflow-init airflow-init
docker compose up -d --wait --wait-timeout 180
docker compose ps
curl -fsS 'http://localhost:8080/api/v2/monitor/health'
```

Linux 必须把宿主用户 UID 写入 `.env`，否则挂载目录可能由 root 创建；macOS 等其他系统可忽略未设置警告，示例写入官方建议的默认 UID 以消除警告。初始化命令用 `--exit-code-from airflow-init` 把一次性容器的退出码传回 Shell，失败时 `set -e` 会停止后续启动；不要移除这一门禁。`--wait` 会等待其余服务进入运行或健康状态，并在 180 秒后超时；这消除了首次启动后立即请求 API Server 的竞态，超时退出时应先检查容器状态与日志。

**快速验证的通过标准**：

| 检查对象 | 通过条件 | 失败处理 |
|---|---|---|
| 初始化容器 | `airflow-init` 正常退出，日志没有迁移或账号创建错误 | 先查看初始化日志，不继续启动其余服务 |
| Compose 服务 | API Server、Scheduler、DAG Processor、Worker、Triggerer、PostgreSQL、Redis 均为运行或健康状态 | 查看对应服务日志，确认内存、目录权限与依赖状态 |
| 健康接口 | 返回 JSON，MetaDB、Scheduler、Triggerer 和 DAG Processor 的状态均符合当前拓扑预期 | 不能只看 HTTP 200；官方说明 HTTP 状态码只表示接口请求本身成功 |
| Web UI | 本机 8080 端口可访问，并能使用 quick-start 凭据登录 | 检查 API Server 端口、认证服务和容器健康状态 |

> [!warning] Docker Compose 不是生产参考架构
> 官方明确把该 Compose 环境定义为 quick-start，并说明它不是为生产设计的。它适合学习、兼容验证和小型开发环境；生产部署还需要独立完成高可用、备份恢复、密钥、认证授权、日志、监控、升级回滚和容量验收。

### 本地验证与生产验收的边界

| 层级 | 本文可以证明什么 | 仍需单独验收什么 |
|---|---|---|
| Standalone | Airflow 3.3 能在本机启动，UI 和基础组件可访问 | 真实数据库、Executor、认证、容量与故障恢复 |
| Docker Compose quick-start | 官方示例拓扑能运行，DAG 与 Provider 可做兼容测试 | 高可用、密钥管理、备份恢复、滚动升级、日志持久化和资源隔离 |
| 生产发布 | 不由本文中的本地命令直接证明 | 组织级架构评审、恢复演练、容量压测、安全检查、DAG 回归、可观测性和回滚演练全部通过 |

生产门禁应保存可追溯证据：Airflow 与 Provider 锁定版本、镜像摘要、数据库迁移记录、关键 DAG 回归结果、容量和恢复测试报告、权限矩阵、告警演练及回滚记录。任何一项缺失，都不能用“本地启动成功”替代。

### 从 2.x 升级到 3.3 的门禁

1. 先升级到至少 2.7，推荐先到最新 2.x，再进入 3.x。
2. 停写或保证一致性后备份 MetaDB，并在大库上评估清理和迁移耗时。
3. 使用官方 AIR 规则检查 DAG，迁移已移除的 API 与导入路径。
4. 检查自定义 Task 是否直接访问 Airflow MetaDB；Airflow 3 的 Worker 通过 API Server 与运行时资源交互。
5. 数据库迁移使用 Airflow 3 的 db migrate 命令，并准备可验证的回滚点。
6. 启动脚本必须包含 API Server 和独立 DAG Processor，不能继续把旧 Webserver 拓扑当作 3.x 架构。
7. 验证认证管理器、API v2、Provider 兼容性、历史 DAG 回放和关键告警后再切流。

---

## 三种安装方式对比

| 方式 | 适用场景 | 优点 | 缺点 |
|------|---------|------|------|
| pip 安装 | 本地快速体验 | 命令链较短 | 环境依赖多，隔离性差 |
| Docker Compose | 学习/开发/兼容测试 | 一键部署，环境隔离 | 官方 quick-start 不适合作为生产架构 |
| Helm（Kubernetes）| 大规模生产 | 弹性伸缩，云原生 | 复杂，需要 K8s 经验 |

**推荐路径**：本地 standalone → Docker Compose 兼容验证 → 依据组织平台能力选择 Helm、托管服务或经过正式设计的容器部署

---

## Legacy 2.8.1：pip 安装

> [!warning] 历史命令
> 下方 Python 范围、初始化命令、Webserver 启动方式和版本号都属于 Airflow 2.8.1。学习 Airflow 3.3 请使用前面的当前基线。

适合在本地快速跑通第一个 DAG，不适合生产使用。

### 环境要求

- Python 3.8 ~ 3.11
- pip 21.0+

### 安装步骤

```bash
# 1. 创建虚拟环境（强烈建议，避免依赖冲突）
python3 -m venv airflow_env
source airflow_env/bin/activate  # Linux/macOS
# airflow_env\Scripts\activate   # Windows

# 2. 设置 Airflow 主目录
export AIRFLOW_HOME=~/airflow

# 3. 安装 Airflow（指定版本和约束文件，避免依赖冲突）
AIRFLOW_VERSION=2.8.1
PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
CONSTRAINT_URL="https://raw.githubusercontent.com/apache/airflow/constraints-${AIRFLOW_VERSION}/constraints-${PYTHON_VERSION}.txt"

pip install "apache-airflow==${AIRFLOW_VERSION}" --constraint "${CONSTRAINT_URL}"

# 4. 初始化数据库（默认 SQLite）
airflow db init

# 5. 创建管理员账号
airflow users create \
    --username admin \
    --firstname Admin \
    --lastname User \
    --role Admin \
    --email admin@example.com \
    --password admin123

# 6. 启动（两个终端分别运行）
airflow scheduler &
airflow webserver --port 8080
```

访问 `http://localhost:8080`，用 admin/admin123 登录。

> [!warning] SQLite 的限制
> pip 安装默认使用 SQLite，只支持 SequentialExecutor（串行执行）。
> 这意味着该 Legacy 配置同一时刻只能跑一个 Task，仅供学习用。生产应换用该 Airflow 版本支持的外部数据库，本文以 PostgreSQL 为例。

---

## Legacy 2.8.1：Docker Compose 部署

> [!warning] 历史命令与拓扑
> 下方下载地址、镜像、服务名称和 Webserver 拓扑都属于 2.8.1。即使能够启动，也不代表已经完成 Airflow 3.3 兼容或生产验收。

原文曾把这一 2.8.1 Compose 拓扑作为入门路径；当前学习与兼容验证应使用前文的 Airflow 3.3 quick-start。

### 前置条件

- Docker 20.10+
- Docker Compose 2.0+
- 内存 4GB+（建议 8GB）

参考 [[【技术与工具】/Docker/06-Docker Compose入门|Docker Compose 入门]] 了解 Docker Compose 基础。

### 快速部署步骤

```bash
# 1. 创建项目目录
mkdir ~/airflow-docker && cd ~/airflow-docker

# 2. 下载官方 docker-compose.yaml（Airflow 2.8）
curl -LfO 'https://airflow.apache.org/docs/apache-airflow/2.8.1/docker-compose.yaml'

# 3. 创建必要的目录
mkdir -p ./dags ./logs ./plugins ./config

# 4. 设置 AIRFLOW_UID（Linux 必须，macOS 可选）
echo -e "AIRFLOW_UID=$(id -u)" > .env

# 5. 初始化数据库（仅第一次需要）
docker compose up airflow-init

# 6. 等待初始化完成后，启动所有服务
docker compose up -d

# 7. 查看服务状态
docker compose ps
```

正常启动后，应该看到以下服务都是 `healthy` 状态：

```text
NAME                        STATUS
airflow-docker-airflow-scheduler-1   Up (healthy)
airflow-docker-airflow-webserver-1   Up (healthy)
airflow-docker-airflow-worker-1      Up (healthy)
airflow-docker-airflow-triggerer-1   Up (healthy)
airflow-docker-postgres-1            Up (healthy)
airflow-docker-redis-1               Up (healthy)
```

访问 `http://localhost:8080`，默认账号 `airflow` / `airflow`。

### docker-compose.yaml 关键配置解读

```yaml
# 节选自官方 docker-compose.yaml，添加了注释

version: '3.8'

x-airflow-common:
  &airflow-common
  # 使用官方镜像，可以换成自定义镜像
  image: ${AIRFLOW_IMAGE_NAME:-apache/airflow:2.8.1}
  environment:
    &airflow-common-env
    # 核心配置：使用 Celery 执行器（支持分布式）
    AIRFLOW__CORE__EXECUTOR: CeleryExecutor

    # 数据库连接（PostgreSQL）
    AIRFLOW__DATABASE__SQL_ALCHEMY_CONN: postgresql+psycopg2://airflow:airflow@postgres/airflow

    # Celery 消息队列（Redis）
    AIRFLOW__CELERY__RESULT_BACKEND: db+postgresql://airflow:airflow@postgres/airflow
    AIRFLOW__CELERY__BROKER_URL: redis://:@redis:6379/0

    # 安全配置（生产环境必须修改！）
    AIRFLOW__CORE__FERNET_KEY: ''
    AIRFLOW__CORE__DAGS_ARE_PAUSED_AT_CREATION: 'true'  # 新DAG默认暂停
    AIRFLOW__CORE__LOAD_EXAMPLES: 'false'               # 不加载示例DAG

    # Webserver 签名密钥，不是开启用户名密码登录的开关
    AIRFLOW__WEBSERVER__SECRET_KEY: ''

  volumes:
    # DAG 文件目录挂载到容器（在这里写 DAG 文件）
    - ${AIRFLOW_PROJ_DIR:-.}/dags:/opt/airflow/dags
    # 日志目录挂载（查看任务日志）
    - ${AIRFLOW_PROJ_DIR:-.}/logs:/opt/airflow/logs
    # 插件目录
    - ${AIRFLOW_PROJ_DIR:-.}/plugins:/opt/airflow/plugins
```

### 自定义镜像（安装额外依赖）

如果你的 DAG 需要额外的 Python 包（比如 `pandas`、`sqlalchemy`），需要构建自定义镜像：

```dockerfile
# Dockerfile
FROM apache/airflow:2.8.1

# 安装额外依赖
COPY requirements.txt /requirements.txt
RUN pip install --no-cache-dir -r /requirements.txt
```

```text
# requirements.txt
pandas==2.1.0
sqlalchemy==2.0.0
apache-airflow-providers-mysql==5.5.0
apache-airflow-providers-apache-hive==7.0.0
apache-airflow-providers-apache-spark==4.3.0
```

```yaml
# docker-compose.override.yaml（覆盖官方配置）
version: '3.8'
services:
  airflow-webserver:
    build: .
  airflow-scheduler:
    build: .
  airflow-worker:
    build: .
```

```bash
# 重新构建并启动
docker compose build
docker compose up -d
```

---

## Legacy 2.x：airflow.cfg 配置示例

> [!warning] 配置项需逐项映射
> Airflow 3 将 Webserver 改为 API Server，部分配置节已重命名或移除。下方配置只用于理解 2.x，不应整段复制到 3.3。

`airflow.cfg` 是 Airflow 的主配置文件，位于 `$AIRFLOW_HOME/airflow.cfg`。

在 Docker 部署中，推荐用环境变量覆盖配置（`AIRFLOW__SECTION__KEY` 格式），而不是直接修改 cfg 文件。

### 核心配置项解读

```ini
[core]
# DAG 文件目录（Scheduler 会扫描这个目录下的所有 .py 文件）
dags_folder = /opt/airflow/dags

# 并行执行的 Task 数量上限（全局）
parallelism = 32

# 每个 DAG 最多同时运行的 Task 数量
max_active_tasks_per_dag = 16

# 每个 DAG 最多同时运行的 DAG Run 数量
max_active_runs_per_dag = 16

# 使用的 Executor 类型
executor = CeleryExecutor

# 是否加载内置示例 DAG（生产环境建议关闭）
load_examples = False

# 新创建的 DAG 是否默认暂停
dags_are_paused_at_creation = True

[database]
# MetaDB 连接字符串
sql_alchemy_conn = postgresql+psycopg2://airflow:password@localhost:5432/airflow

# 数据库连接池大小
sql_alchemy_pool_size = 5
sql_alchemy_pool_recycle = 1800

[scheduler]
# Scheduler 扫描 DAG 目录的间隔（秒）
dag_dir_list_interval = 30

# 同一 DAG 文件两次解析之间的最小间隔（秒），不是 Task 调度间隔
min_file_process_interval = 30

# Scheduler 心跳间隔（秒）
scheduler_heartbeat_sec = 5

[webserver]
# Web 服务监听端口
web_server_port = 8080

# Webserver worker 超时时间（秒），不是用户 Session 超时
web_server_worker_timeout = 120

# 历史原稿配置：authenticate 不是 Airflow 2.8.1 的有效登录控制项
# authenticate = True
# 登录与访问权限应通过该版本的认证机制配置并验证

[celery]
# 每个 Celery Worker 的并发执行槽位数，不是 Worker 实例数量
worker_concurrency = 16

# 消息队列地址
broker_url = redis://localhost:6379/0
result_backend = db+postgresql://airflow:password@localhost:5432/airflow
```

---

## Legacy 2.x：从 SQLite 到 PostgreSQL

> [!warning] 原则仍有效，命令已过时
> 生产使用受支持的外部数据库这一原则仍然成立，但下方 init 命令与版本依赖属于 2.x；Airflow 3 的升级迁移使用 db migrate。

### 为什么要换 PostgreSQL

| 特性 | SQLite | PostgreSQL |
|------|--------|-----------|
| 并发写入 | 不支持 | 支持 |
| 支持的 Executor | 仅 Sequential | 所有 Executor |
| 连接与写入限制 | 可有多个连接，但同时仅允许一个写者 | 可有多个连接，连接数上限取决于配置与资源 |
| 适用场景 | 本地调试 | 生产环境 |

### 从头配置 PostgreSQL

```bash
# 方式一：Docker 启动 PostgreSQL
docker run -d \
    --name airflow-postgres \
    -e POSTGRES_USER=airflow \
    -e POSTGRES_PASSWORD=airflow_password \
    -e POSTGRES_DB=airflow \
    -p 5432:5432 \
    postgres:13

# 方式二：系统安装 PostgreSQL（CentOS 7）
yum install -y postgresql-server postgresql-contrib
postgresql-setup initdb
systemctl start postgresql
systemctl enable postgresql

# 创建 Airflow 数据库和用户
sudo -u postgres psql -c "CREATE USER airflow WITH PASSWORD 'airflow_password';"
sudo -u postgres psql -c "CREATE DATABASE airflow OWNER airflow;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE airflow TO airflow;"
```

```bash
# 安装 PostgreSQL 驱动
pip install "apache-airflow[postgres]"
# 或
pip install psycopg2-binary

# 更新 airflow.cfg 中的连接字符串
# [database]
# sql_alchemy_conn = postgresql+psycopg2://airflow:airflow_password@localhost:5432/airflow

# 重新初始化数据库
airflow db init
```

---

## Legacy 2.8.1：初始化与启动

> [!danger] 不要用于 Airflow 3
> 下方命令仍启动旧 Webserver，并使用 2.8.1 的初始化流程。Airflow 3 需要 API Server 和独立 DAG Processor，升级数据库使用 db migrate。

### 完整初始化流程

```bash
# 步骤 1：设置环境变量
export AIRFLOW_HOME=/opt/airflow
export AIRFLOW__DATABASE__SQL_ALCHEMY_CONN="postgresql+psycopg2://airflow:password@localhost:5432/airflow"
export AIRFLOW__CORE__EXECUTOR=LocalExecutor

# 步骤 2：安装 Airflow 和必要的 Provider
pip install apache-airflow==2.8.1
pip install apache-airflow-providers-postgres apache-airflow-providers-mysql

# 步骤 3：初始化数据库（建表）
airflow db init

# 步骤 4：创建管理员账号
airflow users create \
    --username admin \
    --firstname Admin \
    --lastname User \
    --role Admin \
    --email admin@company.com \
    --password "YourStrongPassword123!"

# 步骤 5：启动 Webserver（Airflow 2.8.1 使用 Gunicorn，--daemon 表示后台运行）
airflow webserver --port 8080 --daemon

# 步骤 6：启动 Scheduler
airflow scheduler --daemon

# 步骤 7：验证
airflow dags list
```

### 常用管理命令

```bash
# 查看所有 DAG
airflow dags list

# 查看某个 DAG 的任务列表
airflow tasks list my_dag

# 手动触发一个 DAG
airflow dags trigger my_dag

# 查看 DAG 运行记录
airflow dags list-runs -d my_dag

# 测试单个 Task（不写入 MetaDB，纯测试）
airflow tasks test my_dag my_task_id 2024-01-01

# 数据库升级（升级 Airflow 版本后运行）
airflow db upgrade

# 查看配置信息
airflow config get-value core executor

# 停止服务
cat $AIRFLOW_HOME/airflow-webserver.pid | xargs kill
cat $AIRFLOW_HOME/airflow-scheduler.pid | xargs kill
```

---

## Legacy 2.x 生产检查清单

> [!warning] 仅作迁移输入
> 清单里的数据库、密钥、权限和日志原则可以复用，但 Webserver、认证管理器、API、DAG Processor、Worker 隔离与升级回滚必须按 Airflow 3.3 重新验收。

> [!tip] 上生产前必须检查的事项
> - [ ] MetaDB 使用 PostgreSQL（而非 SQLite）
> - [ ] `AIRFLOW__CORE__FERNET_KEY` 已设置为随机密钥（用于加密 Connection 密码）
> - [ ] `AIRFLOW__WEBSERVER__SECRET_KEY` 已设置为随机密钥
> - [ ] 管理员密码已修改（不使用默认 `airflow`）
> - [ ] `AIRFLOW__CORE__LOAD_EXAMPLES` 设为 `false`
> - [ ] DAG 目录权限正确（Scheduler 可读，其他人不可写）
> - [ ] 日志目录有足够磁盘空间，并配置日志清理策略
> - [ ] Executor 根据规模选择（LocalExecutor 或 CeleryExecutor）

生成 Fernet Key 的方法：

```python
# 生成安全的 Fernet Key
from cryptography.fernet import Fernet
fernet_key = Fernet.generate_key()
print(fernet_key.decode())
# 输出类似：ZmDfcTF7_60GrrY167zsiPd67pEvs0aGOv2oasOM1Pg=
```

---

## 常见安装问题（Legacy 2.8.1）

本节命令沿用 Airflow 2.8.1，不适用于前文 3.3 基线；`--constraint "..."` 是未填入的占位符，不能直接执行，须替换为与 Airflow 版本和 Python 小版本匹配的 constraints 地址。

### 问题 1：`ModuleNotFoundError` 安装后找不到模块

```bash
# 原因：Python 环境混乱
# 解决：使用虚拟环境
python3 -m venv ~/airflow-venv
source ~/airflow-venv/bin/activate
pip install apache-airflow==2.8.1 --constraint "..."
```

### 问题 2：Docker Compose 启动后 Webserver 一直 `unhealthy`

```bash
# 查看详细日志
docker compose logs airflow-webserver

# 常见原因：内存不足
# 解决：增加 Docker 内存限制到 4GB+
```

### 问题 3：`airflow db init` 报数据库连接错误

```bash
# 检查连接字符串
echo $AIRFLOW__DATABASE__SQL_ALCHEMY_CONN

# 测试数据库连接
python3 -c "
import sqlalchemy
engine = sqlalchemy.create_engine('postgresql+psycopg2://airflow:password@localhost:5432/airflow')
conn = engine.connect()
print('连接成功')
conn.close()
"
```

### 问题 4：Provider 安装失败（网络问题）

```bash
# 配置国内 pip 镜像
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

# 或使用 -i 参数
pip install apache-airflow==2.8.1 -i https://pypi.tuna.tsinghua.edu.cn/simple
```

---

## 小结

- **本地学习**：使用 Airflow 3.3 standalone 或受约束的 PyPI 安装
- **开发/测试**：使用官方 Docker Compose quick-start，但不把它视为生产架构
- **生产环境**：根据平台能力完成数据库、执行器、API Server、DAG Processor、认证授权、可观测性和回滚验收
- **升级原则**：先到最新 2.x，再迁移 DAG、Provider、数据库和启动拓扑

下一篇：[[【技术与工具】/Airflow/04-第一个DAG|第一个 DAG]] — 从零编写一个完整的数据处理 DAG

---

## 官方资料与复核范围

- [Airflow 3.3 安装总览](https://airflow.apache.org/docs/apache-airflow/stable/installation/index.html)
- [Airflow 3.3 Standalone Quick Start 与生成凭据](https://airflow.apache.org/docs/apache-airflow/stable/start.html)
- [从 PyPI 可重复安装 Airflow 3.3](https://airflow.apache.org/docs/apache-airflow/stable/installation/installing-from-pypi.html)
- [Airflow 3.3 支持的 Python、数据库和 Kubernetes 版本](https://airflow.apache.org/docs/apache-airflow/stable/installation/prerequisites.html)
- [官方 Docker Compose quick-start 及生产限制](https://airflow.apache.org/docs/apache-airflow/stable/howto/docker-compose/index.html)
- [从 Airflow 2.x 升级到 Airflow 3](https://airflow.apache.org/docs/apache-airflow/stable/installation/upgrading_to_airflow3.html)
- [Airflow 3 健康检查与判定边界](https://airflow.apache.org/docs/apache-airflow/stable/administration-and-deployment/logging-monitoring/check-health.html)

原稿声明已复核安装版本、依赖约束、Compose 初始化准备、健康检查边界和 3.x 升级门禁，但未附对应版本的核验记录，本轮不将该声明视为已完成核验。原有 2.8.1 代码块没有迁移，仍为 Legacy；Provider 与 Executor 的具体组合需要结合实际平台单独做兼容矩阵。

### 关联知识

- [[【技术与工具】/Airflow/01-工作流调度概述|工作流调度概述]]
- [[【技术与工具】/Airflow/05-常用Operator详解|常用 Operator 详解]]
- [[【技术与工具】/Airflow/06-任务依赖与编排|任务依赖与编排]]
- [[【技术与工具】/Airflow/07-调度策略与时间管理|调度策略与时间管理]]
- [[【技术与工具】/Airflow/08-变量连接与配置管理|变量、连接与配置管理]]
- [[【技术与工具】/Airflow/09-监控告警与故障处理|监控告警与故障处理]]
- [[【技术与工具】/Airflow/10-数据管道实战|数据管道实战]]
- [[【技术与工具】/Airflow/11-Airflow进阶实践|Airflow 进阶实践]]
- [[【技术与工具】/Airflow/12-Airflow最佳实践与踩坑|Airflow 最佳实践与踩坑]]

---

*所属系列：[[【技术与工具】/Airflow/00-Airflow学习路线图|Airflow 学习路线图]] | 上一篇：[[【技术与工具】/Airflow/02-Airflow核心概念|Airflow 核心概念]] | 下一篇：[[【技术与工具】/Airflow/04-第一个DAG|第一个 DAG]]*

---

> [!info] 前置知识
> - 掌握 Airflow 核心概念（DAG、Executor、MetaDB），参考 [[【技术与工具】/Airflow/02-Airflow核心概念|Airflow 核心概念]]
> - 熟悉 Docker 基本操作（`docker compose up/down`、查看容器日志）
> - 了解 Linux 命令行（环境变量设置、文件权限）

---

## 掌握检查

<!-- Legacy 2.x 掌握检查开始：保留原文以便审计，不对外展示。

- [ ] 能在本机用 Docker Compose 成功启动 Airflow，并在浏览器打开 Web UI（localhost:8080）
- [ ] 能说出 `airflow.cfg` 中 `executor`、`sql_alchemy_conn`、`parallelism` 三个配置项的作用
- [ ] 知道 `AIRFLOW__CORE__FERNET_KEY` 是什么，以及为什么生产环境必须设置它
- [ ] 能用命令行完成：列出所有 DAG、手动触发一个 DAG、测试单个 Task（`airflow tasks test`）
- [ ] 理解为什么生产环境必须将 SQLite 替换为 PostgreSQL

---

## 实践练习

**基础题**：用 Docker Compose 启动 Airflow，进入 Web UI，找到内置示例 DAG `example_bash_operator`，手动触发一次，观察每个 Task 的执行状态和日志。

**进阶题**：修改 Docker Compose 配置，将 Executor 从默认的 LocalExecutor 切换为 SequentialExecutor，观察并发行为的变化。然后查阅文档，说明什么规模的生产环境应该升级到 CeleryExecutor。

#Airflow #安装部署 #Docker #PostgreSQL #配置管理 #数据工程
Legacy 2.x 掌握检查结束。 -->

- [ ] 能解释 Standalone、Compose quick-start 与生产部署分别能验证什么
- [ ] 能按操作系统正确准备挂载目录和 `.env`，并说明 Linux 需要设置宿主 UID 的原因
- [ ] 能确认初始化容器成功退出，并识别 API Server、Scheduler 和 DAG Processor 的运行状态
- [ ] 能读取健康接口 JSON，且知道 HTTP 200 本身不等于所有 Airflow 组件健康
- [ ] 能用锁定版本和 constraints 安装 Airflow 3.3，并通过版本与依赖一致性检查
- [ ] 能列出生产发布所需的数据库、认证授权、密钥、日志、监控、容量、备份恢复和回滚证据

---

## 实践练习

**基础题**：按本文的 Airflow 3.3 Compose 完整路径启动 quick-start。保存初始化日志、服务状态与健康接口 JSON；只有四项快速验证标准全部通过，才记录为成功。

**进阶题**：选取一条真实 DAG，在隔离环境中完成 Airflow 3.3 兼容验证。提交版本锁定文件、Provider 兼容矩阵、DAG 解析结果、一次成功运行记录、一次故障注入后的告警证据，以及回滚步骤。不要通过切换到 SequentialExecutor 模拟生产容量结论。

#Airflow #安装部署 #Docker #PostgreSQL #配置管理 #数据工程
