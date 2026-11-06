---
title: Airflow 进阶实践 - 分布式部署、自定义 Operator 与 dbt 集成
tags:
  - Airflow
  - CeleryExecutor
  - KubernetesExecutor
  - 自定义Operator
  - Hook
  - Plugin
  - REST API
  - dbt
aliases:
  - Airflow进阶
  - Airflow分布式
  - 自定义Operator
difficulty: 高级
duration: 35分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
stability: fast-changing
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


# Airflow 进阶实践

> [!abstract] 本文核心内容
> - CeleryExecutor 分布式部署（多 Worker 配置示例，投产前须补齐初始化、存储与安全设计）
> - KubernetesExecutor 云原生方案
> - 自定义 Operator 和 Hook（封装复用逻辑）
> - Plugin 开发（扩展 Web UI）
> - Airflow REST API 编程控制
> - 与 dbt 集成（现代数据转换工具）

---

## CeleryExecutor 分布式部署

CeleryExecutor 通过 Redis 或 RabbitMQ 消息队列，将任务分发到多个 Worker 节点执行，是中大型环境中可选的分布式执行方案；选型还需评估运维能力、隔离需求与资源规模。

### 架构

```text
Scheduler → Redis Queue → Worker 1
                       → Worker 2
                       → Worker 3
```

### docker-compose 多 Worker 配置

```yaml
# docker-compose.prod.yaml
version: '3.8'

x-airflow-common:
  &airflow-common
  image: apache/airflow:2.8.1
  environment: &airflow-common-env
    AIRFLOW__CORE__EXECUTOR: CeleryExecutor
    AIRFLOW__DATABASE__SQL_ALCHEMY_CONN: postgresql+psycopg2://airflow:${POSTGRES_PASSWORD}@postgres/airflow
    AIRFLOW__CELERY__BROKER_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
    AIRFLOW__CELERY__RESULT_BACKEND: db+postgresql://airflow:${POSTGRES_PASSWORD}@postgres/airflow
    # 性能调优
    AIRFLOW__CORE__PARALLELISM: 64          # 全局最大并行任务数
    AIRFLOW__CORE__MAX_ACTIVE_TASKS_PER_DAG: 16
    AIRFLOW__CELERY__WORKER_CONCURRENCY: 8  # 每个 Worker 的并发数
    # 安全
    AIRFLOW__CORE__FERNET_KEY: ${FERNET_KEY}
    AIRFLOW__WEBSERVER__SECRET_KEY: ${WEBSERVER_SECRET_KEY}
  volumes:
    - ./dags:/opt/airflow/dags
    - ./logs:/opt/airflow/logs
    - ./plugins:/opt/airflow/plugins

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: airflow
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: airflow
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7.0
    command: redis-server --requirepass ${REDIS_PASSWORD}

  airflow-webserver:
    <<: *airflow-common
    command: webserver
    ports:
      - "8080:8080"
    healthcheck:
      test: ["CMD", "curl", "--fail", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 5

  airflow-scheduler:
    <<: *airflow-common
    command: scheduler

  # Worker 1：处理高优先级 ETL 任务
  airflow-worker-etl:
    <<: *airflow-common
    command: celery worker -q etl,default
    environment:
      <<: *airflow-common-env
      # 处理 etl 和 default 队列的任务
      AIRFLOW__CELERY__WORKER_CONCURRENCY: 8

  # Worker 2：处理机器学习任务（大内存机器）
  airflow-worker-ml:
    <<: *airflow-common
    command: celery worker -q ml_tasks
    environment:
      <<: *airflow-common-env

      AIRFLOW__CELERY__WORKER_CONCURRENCY: 2  # ML 任务并发少，但内存需求大

volumes:
  postgres_data:
```

### 任务指定 Queue

```python
# 在 Task 中指定执行队列
heavy_spark_task = SparkSubmitOperator(
    task_id="run_ml_training",
    application="/jobs/train_model.py",
    queue="ml_tasks",  # 只由 ml_worker 执行
    # ...
)

normal_etl_task = BashOperator(
    task_id="sync_data",
    bash_command="python sync.py",
    queue="etl",  # 由 etl_worker 执行
)
```

---

## KubernetesExecutor

KubernetesExecutor 为每个 Task 动态创建一个 Pod，天然隔离，适合云原生环境。

### 核心优势

- 每个 Task 有独立的资源（CPU/Memory 限制）
- 任务环境完全隔离（不同 Task 可以用不同镜像）
- 按任务创建执行 Pod；空闲时可没有任务 Pod，但调度器、数据库等基础组件仍占用资源
- Pod 隔离可降低任务之间的直接影响，但共享节点、集群资源或基础服务故障仍可能影响其他 Task

### 配置

```ini
# airflow.cfg
[kubernetes]
namespace = airflow               # Task Pod 所在的 Kubernetes 命名空间
worker_container_repository = my-registry.example.com/airflow  # 镜像仓库
worker_container_tag = 2.8.1
delete_worker_pods = True         # Task 完成后删除 Pod
delete_worker_pods_on_failure = False  # 失败时保留 Pod（方便排查）
```

### 在 Task 中覆盖资源配置

```python
from airflow.providers.cncf.kubernetes.operators.kubernetes_pod import KubernetesPodOperator
from kubernetes.client import models as k8s

# 使用 KubernetesPodOperator 直接运行 Pod
k8s_task = KubernetesPodOperator(
    task_id="k8s_etl_task",
    name="etl-pod",
    namespace="airflow",
    image="my-registry.example.com/data-tools:latest",
    cmds=["python"],
    arguments=["/app/etl.py", "--date", "{{ ds }}"],
    # 资源限制
    container_resources=k8s.V1ResourceRequirements(
        requests={"cpu": "500m", "memory": "1Gi"},
        limits={"cpu": "2000m", "memory": "4Gi"},
    ),
    # 节点亲和性（调度到有 GPU 的节点）
    node_selector={"node-type": "gpu"},
    # 环境变量
    env_vars=[
        k8s.V1EnvVar(name="TARGET_DATE", value="{{ ds }}"),
    ],
    # 将 Secret 中的键值注入容器环境变量
    env_from=[
        k8s.V1EnvFromSource(
            secret_ref=k8s.V1SecretEnvSource(name="db-credentials")
        )
    ],
    is_delete_operator_pod=True,
)
```

---

## 自定义 Operator

当内置 Operator 满足不了需求时，可以继承 `BaseOperator` 创建自定义 Operator。

### 场景：HTTP API 数据抽取 Operator

```python
# plugins/operators/http_extract_operator.py
from typing import Any, Optional
import requests
import json

from airflow.models import BaseOperator
from airflow.exceptions import AirflowException
from airflow.hooks.base import BaseHook


class HttpExtractOperator(BaseOperator):
    """
    从 HTTP API 抽取数据并保存到文件
    可以在多个 DAG 中复用，封装了 Bearer 认证和状态码错误处理；
    未实现请求级重试，任务级重试需通过 retries 等参数配置
    """

    # 声明哪些参数支持 Jinja 模板渲染
    template_fields = ["endpoint", "output_path", "params"]

    def __init__(
        self,
        http_conn_id: str,              # Airflow Connection ID
        endpoint: str,                  # API 路径（支持模板变量）
        output_path: str,               # 输出文件路径（支持模板变量）
        method: str = "GET",            # HTTP 方法
        params: Optional[dict] = None,  # 查询参数（支持模板变量）
        data_key: str = "data",         # 响应 JSON 中数据的 key
        page_size: int = 1000,          # 分页大小
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.http_conn_id = http_conn_id
        self.endpoint = endpoint
        self.output_path = output_path
        self.method = method
        self.params = params or {}
        self.data_key = data_key
        self.page_size = page_size

    def execute(self, context: Any) -> dict:
        """Task 执行时调用的核心方法"""
        import os
        import pandas as pd

        self.log.info(f"开始从 {self.endpoint} 抽取数据")

        # 获取连接信息（Host、Token 等）
        conn = BaseHook.get_connection(self.http_conn_id)
        base_url = f"{conn.schema or 'https'}://{conn.host}"
        headers = {
            "Authorization": f"Bearer {conn.password}",
            "Content-Type": "application/json",
        }

        # 分页抽取
        all_data = []
        page = 1

        while True:
            params = {**self.params, "page": page, "page_size": self.page_size}

            response = requests.request(
                method=self.method,
                url=f"{base_url}{self.endpoint}",
                headers=headers,
                params=params,
                timeout=60,
            )

            if response.status_code != 200:
                raise AirflowException(
                    f"API 请求失败：{response.status_code} - {response.text}"
                )

            result = response.json()
            page_data = result.get(self.data_key, [])

            if not page_data:
                break  # 没有更多数据

            all_data.extend(page_data)
            self.log.info(f"第 {page} 页：{len(page_data)} 条，累计 {len(all_data)} 条")

            if len(page_data) < self.page_size:
                break  # 最后一页

            page += 1

        # 保存数据
        os.makedirs(os.path.dirname(self.output_path), exist_ok=True)
        df = pd.DataFrame(all_data)
        df.to_csv(self.output_path, index=False)

        self.log.info(f"数据已保存到：{self.output_path}，共 {len(df)} 行")

        return {"row_count": len(df), "output_path": self.output_path}
```

### 使用自定义 Operator

```python
# 在 DAG 中使用
from plugins.operators.http_extract_operator import HttpExtractOperator

extract_api_data = HttpExtractOperator(
    task_id="extract_from_api",
    http_conn_id="crm_api",
    endpoint="/api/v2/customers",
    output_path="/data/raw/customers/dt={{ ds }}/customers.csv",
    params={"updated_since": "{{ ds }}", "status": "active"},
    page_size=500,
)
```

---

## 自定义 Hook

Hook 封装了与外部系统的交互逻辑，被 Operator 调用。

```python
# plugins/hooks/custom_mysql_hook.py
from airflow.providers.mysql.hooks.mysql import MySqlHook
import pandas as pd
from typing import Optional


class DataWarehouseMySqlHook(MySqlHook):
    """
    封装了数仓 MySQL 的常用操作，包括：
    - 分页读取并汇总增量数据
    - 使用继承的 insert_rows 执行 REPLACE INTO 写入
    - 其他连接及底层操作沿用 MySqlHook；本例未实现专用写入重试或表存在检查
    """

    conn_name_attr = "mysql_conn_id"
    default_conn_name = "mysql_dw"

    def read_incremental(
        self,
        table: str,
        date_col: str,
        start_date: str,
        end_date: str,
        chunk_size: int = 10000,
    ) -> pd.DataFrame:
        """分批读取后汇总增量数据；最终仍将全部结果保存在内存中，不能保证避免 OOM"""
        sql = f"""
            SELECT * FROM {table}
            WHERE {date_col} >= '{start_date}'
              AND {date_col} < '{end_date}'
        """

        chunks = []
        offset = 0

        while True:
            chunk_sql = f"{sql} LIMIT {chunk_size} OFFSET {offset}"
            chunk = self.get_pandas_df(chunk_sql)

            if chunk.empty:
                break

            chunks.append(chunk)
            offset += chunk_size

            if len(chunk) < chunk_size:
                break

        return pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame()

    def upsert(self, df: pd.DataFrame, table: str, key_cols: list) -> int:
        """通过 MySqlHook 的 replace=True 执行 REPLACE INTO；不是 INSERT ON DUPLICATE KEY UPDATE，key_cols 当前未使用，冲突由表的主键或唯一索引决定，并可能产生删除后插入的副作用"""
        rows = df.values.tolist()
        self.insert_rows(
            table=table,
            rows=rows,
            target_fields=df.columns.tolist(),
            replace=True,
        )
        return len(rows)
```

---

## REST API：编程控制 Airflow

Airflow 2.x 提供了完整的 REST API，可以从外部系统控制 DAG 运行。

### 常用 API

```bash
# 设置基础认证
AIRFLOW_URL="http://localhost:8080"
AUTH="admin:admin"

# 1. 列出所有 DAG
curl -u $AUTH "$AIRFLOW_URL/api/v1/dags"

# 2. 手动触发 DAG Run
curl -u $AUTH -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "execution_date": "2024-01-15T02:00:00+00:00",
        "conf": {"source_date": "2024-01-14", "force_rerun": true}
    }' \
    "$AIRFLOW_URL/api/v1/dags/ecommerce_daily_etl/dagRuns"

# 3. 查看 DAG Run 状态
curl -u $AUTH \
    "$AIRFLOW_URL/api/v1/dags/ecommerce_daily_etl/dagRuns/scheduled__2024-01-15T02:00:00+00:00"

# 4. 获取 Task Instance 列表
curl -u $AUTH \
    "$AIRFLOW_URL/api/v1/dags/ecommerce_daily_etl/dagRuns/scheduled__2024-01-15T02:00:00+00:00/taskInstances"
```

### Python SDK 调用

```python
import requests
from datetime import datetime

class AirflowClient:
    def __init__(self, base_url: str, username: str, password: str):
        self.base_url = base_url
        self.auth = (username, password)
        self.session = requests.Session()
        self.session.auth = self.auth

    def trigger_dag(self, dag_id: str, conf: dict = None) -> dict:
        """触发 DAG Run"""
        payload = {
            "execution_date": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S+00:00"),
            "conf": conf or {},
        }
        resp = self.session.post(
            f"{self.base_url}/api/v1/dags/{dag_id}/dagRuns",
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()

    def get_dag_run_status(self, dag_id: str, run_id: str) -> str:
        """查询 DAG Run 状态"""
        resp = self.session.get(
            f"{self.base_url}/api/v1/dags/{dag_id}/dagRuns/{run_id}"
        )
        resp.raise_for_status()
        return resp.json()["state"]

# 使用示例
client = AirflowClient("http://airflow:8080", "admin", "admin")

# 从上游系统触发 DAG（比如数据上传完成后触发）
run = client.trigger_dag("ecommerce_daily_etl", conf={"source": "s3://bucket/data"})
print(f"触发成功，Run ID：{run['run_id']}")
```

---

## 与 dbt 集成

dbt（data build tool）是现代数仓的 SQL 转换工具，可与 Airflow 配合，由 Airflow 编排 dbt 的转换和测试任务。

**分工**：
- **Airflow**：调度控制，数据抽取（Extract + Load），编排 dbt 运行
- **dbt**：数据转换（Transform），SQL 模型管理，血缘追踪

### 方式一：BashOperator 运行 dbt（简单）

```python
from airflow.operators.bash import BashOperator

# 运行 dbt 的所有 models
dbt_run = BashOperator(
    task_id="dbt_run",
    bash_command="""
        cd /opt/dbt/my_project && \
        dbt run \
            --profiles-dir /opt/dbt/profiles \
            --vars '{"execution_date": "{{ ds }}"}'
    """,
    env={
        "DBT_TARGET": "prod",
    },
)

# 只运行指定 tag 的 models
dbt_run_daily = BashOperator(
    task_id="dbt_run_daily_models",
    bash_command="""
        cd /opt/dbt/my_project && \
        dbt run \
            --select tag:daily \
            --vars '{"run_date": "{{ ds }}"}'
    """,
)

# 运行 dbt test（数据质量测试）
dbt_test = BashOperator(
    task_id="dbt_test",
    bash_command="cd /opt/dbt/my_project && dbt test --select tag:daily",
)

# EL 完成 → dbt Transform → dbt Test
extract_load >> dbt_run >> dbt_test
```

### 方式二：使用 Cosmos（dbt 与 Airflow 集成库）

[Astronomer Cosmos](https://astronomer.github.io/astronomer-cosmos/) 是 Astronomer 提供的 dbt 与 Airflow 集成库，可将 dbt 模型及其依赖映射为 Airflow 的 TaskGroup 和任务；具体支持范围取决于所用版本与配置。

```python
# pip install astronomer-cosmos

from cosmos import DbtTaskGroup, ProjectConfig, ProfileConfig, ExecutionConfig, RenderConfig
from cosmos.profiles import PostgresUserPasswordProfileMapping

# 将整个 dbt 项目映射为一个 TaskGroup
dbt_tg = DbtTaskGroup(
    group_id="dbt_transform",
    project_config=ProjectConfig("/opt/dbt/my_project"),
    profile_config=ProfileConfig(
        profile_name="default",
        target_name="prod",
        profile_mapping=PostgresUserPasswordProfileMapping(
            conn_id="postgres_dw",
            profile_args={"schema": "public"},
        ),
    ),
    execution_config=ExecutionConfig(dbt_executable_path="/usr/local/bin/dbt"),

    render_config=RenderConfig(
        # 只选择 daily tag 的 model
        select=["tag:daily"],
        # 每个 dbt model 变成一个独立的 Airflow Task
        # 依赖关系自动映射
    ),
)

# 集成到完整管道
extract_load >> dbt_tg >> send_notification
```

---

## 小结

| 场景 | 推荐方案 |
|------|---------|
| 生产分布式执行 | CeleryExecutor（成熟稳定）|
| 云原生弹性扩展 | KubernetesExecutor |
| 封装复用的操作 | 自定义 Operator 继承 BaseOperator |
| 封装外部系统连接 | 自定义 Hook |
| 外部系统触发 Airflow | REST API |
| 现代数仓 SQL 转换 | dbt + Airflow（Cosmos 集成）|

下一篇：[[【技术与工具】/Airflow/12-Airflow最佳实践与踩坑|12-Airflow最佳实践与踩坑]] — 生产环境 checklist 和常见坑

---

*所属系列：[[【技术与工具】/Airflow/00-Airflow学习路线图|00-Airflow学习路线图]] | 上一篇：[[【技术与工具】/Airflow/10-数据管道实战|10-数据管道实战]] | 下一篇：[[【技术与工具】/Airflow/12-Airflow最佳实践与踩坑|12-Airflow最佳实践与踩坑]]*

#Airflow #CeleryExecutor #KubernetesExecutor #自定义Operator #dbt #REST_API #进阶

---

> [!info] 前置知识
> - 掌握 Airflow 基础操作，能独立编写并运行完整 DAG
> - 了解 Docker Compose 和网络配置基础（CeleryExecutor 需要 Redis）
> - 熟悉 Python 类继承的语法（自定义 Operator 需要继承 BaseOperator）
> - 了解 dbt 的基本概念（可先参考 [[【技术与工具】/dbt/01-dbt概述与理念|dbt 概述与理念]]）

---

## 掌握检查

- [ ] 能说出 LocalExecutor、CeleryExecutor、KubernetesExecutor 三者的适用规模和核心区别
- [ ] 能描述自定义 Operator 的最简实现：继承 `BaseOperator`，实现 `execute(self, context)` 方法
- [ ] 理解 Hook 和 Operator 的职责划分：Hook 负责封装连接和底层操作，Operator 负责编排逻辑
- [ ] 能说出 Airflow REST API 触发 DAG 的场景（外部系统事件驱动）及认证方式
- [ ] 知道 Airflow + dbt 集成的两种方式（BashOperator 运行 dbt 命令 vs Cosmos 库的 DbtTaskGroup）的优劣

---

## 实践练习

**基础题**：把你在 [[【技术与工具】/Airflow/05-常用Operator详解|常用 Operator 详解]] 中经常用到的 BashOperator 调用某个内部脚本的模式，封装成一个自定义 Operator（如 `DataSyncOperator`），让 DAG 代码更简洁。写出完整的 Operator 类和使用示例。

**进阶题**：用 Airflow REST API 实现以下场景：当一个文件上传到指定目录后（用 Python 的文件系统监控），自动调用 Airflow API 触发对应的 ETL DAG，并传入文件路径作为 conf 参数。写出触发 API 的完整代码。
