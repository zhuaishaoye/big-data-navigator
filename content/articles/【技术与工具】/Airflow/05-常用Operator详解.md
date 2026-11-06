---
title: Airflow 常用 Operator 详解 - 数据工程实战手册
tags:
  - Airflow
  - Operator
  - BashOperator
  - PythonOperator
  - SQLExecuteQueryOperator
  - HiveOperator
  - SparkSubmitOperator
  - EmailOperator
  - Sensor
aliases:
  - Airflow Operator
  - Airflow算子
difficulty: 中级
duration: 30分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据治理工程师
  - 数据分析师
  - BI分析师
  - 数据科学家
stability: fast-changing
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


# 常用 Operator 详解

> [!abstract] 本文核心内容
> - BashOperator、PythonOperator 深度使用技巧
> - SQLExecuteQueryOperator 对接 MySQL/PostgreSQL 实战
> - HiveOperator 数仓操作场景
> - SparkSubmitOperator 提交 Spark 作业
> - EmailOperator 发送报表通知
> - HttpSensor、FileSensor 等传感器的使用

---

## Operator 分类概览

Airflow 的 Operator 分为三大类：

| 类别 | 作用 | 常见 Operator |
|------|------|-------------|
| **Action Operators** | 执行某个动作 | BashOperator、PythonOperator、EmailOperator |
| **Transfer Operators** | 在系统间传输数据 | S3ToGCSOperator、MySqlToHiveOperator |
| **Sensor Operators** | 等待某个条件满足 | FileSensor、HttpSensor、ExternalTaskSensor |

安装 Provider 包来获取额外的 Operator：

```bash
# 安装常用 Provider
pip install apache-airflow-providers-mysql       # MySQL
pip install apache-airflow-providers-postgres    # PostgreSQL
pip install apache-airflow-providers-apache-hive # Hive
pip install apache-airflow-providers-apache-spark # Spark
pip install apache-airflow-providers-http        # HTTP
pip install apache-airflow-providers-common-sql  # 通用 SQL
```

---

## BashOperator

**BashOperator** 执行 Shell 命令，是最通用的 Operator。

### 基础用法

```python
from datetime import timedelta
from airflow.operators.bash import BashOperator

# 简单命令
echo_task = BashOperator(
    task_id="echo_date",
    bash_command="echo '执行日期：{{ ds }}'",
)

# 多行命令（使用三引号）
multi_cmd = BashOperator(
    task_id="multi_command",
    bash_command="""
        set -e  # 任何命令失败立即退出
        echo "开始执行"
        cd /data/scripts
        python sync_data.py --date {{ ds }}
        echo "执行完成"
    """,
)
```

### 实战场景：调用数据同步脚本

```python
# 场景：调用现有的 Python/Shell 脚本，不需要改造脚本本身
sync_mysql_task = BashOperator(
    task_id="sync_mysql_to_hdfs",
    bash_command="""
        set -e
        # 激活 Python 虚拟环境
        source /opt/venv/data-pipeline/bin/activate

        # 执行数据同步脚本
        python /opt/scripts/mysql_to_hdfs.py \
            --date {{ ds }} \
            --table orders \
            --output hdfs://namenode:9000/data/raw/orders/dt={{ ds_nodash }}

        # 验证输出文件是否存在
        hdfs dfs -test -e "hdfs://namenode:9000/data/raw/orders/dt={{ ds_nodash }}/_SUCCESS"
        echo "同步成功！"
    """,
    # 执行超时：2 小时
    execution_timeout=timedelta(hours=2),
    # 环境变量：保留 Worker 现有环境并追加以下配置
    append_env=True,
    env={
        "JAVA_HOME": "/usr/lib/jvm/java-8-openjdk",
        "HADOOP_HOME": "/opt/hadoop",
    },
)
```

> [!tip] BashOperator 的最佳实践
> 1. 脚本开头加 `set -e`，让一般命令失败时尽早退出；条件判断等语境存在例外，管道还需结合 `set -o pipefail`，不能把它视为所有失败都会终止的保证
> 2. 使用 `execution_timeout` 防止脚本挂死
> 3. 把复杂逻辑写在独立脚本文件中，BashOperator 只做调用

> [!warning] BashOperator 的常见坑
> `bash_command` 以 `.sh` 或 `.bash` 结尾时，可能按模板文件路径加载；不是末尾空格导致命令被当作文件。
> 若只想执行脚本而不加载其内容作为模板，可在脚本路径后加空格：
> ```python
> bash_command="/opt/scripts/sync.sh"   # 会尝试按模板文件加载，需配置模板搜索路径
> bash_command="/opt/scripts/sync.sh "  # 末尾空格可避免按模板文件加载
> ```
> `bash_command="python script.py "` 不会仅因末尾空格而查找名为 `script.py ` 的文件。

---

## PythonOperator

**PythonOperator** 执行 Python 函数，最适合复杂的数据处理逻辑。

### 基础用法

```python
from airflow.operators.python import PythonOperator

def process_data(execution_date, **context):
    """
    数据处理函数
    execution_date 是一个 pendulum.DateTime 对象
    context 包含所有上下文变量
    """
    ds = context["ds"]  # '2024-01-15'
    ti = context["ti"]  # TaskInstance 对象

    # 你的数据处理逻辑
    print(f"处理 {ds} 的数据")
    return {"processed_rows": 1000}

process_task = PythonOperator(
    task_id="process_data",
    python_callable=process_data,
    # op_kwargs 向函数传入额外参数
    op_kwargs={"batch_size": 500, "target_table": "ods_orders"},
    # op_args 向函数传入位置参数
    # op_args=[500, "ods_orders"],
)
```

### 实战场景：数据质量检查

```python
def check_data_quality(**context):
    """
    数据质量检查：检查行数、空值率、重复率
    """
    import pandas as pd
    from sqlalchemy import create_engine

    ds = context["ds"]
    ti = context["ti"]

    # 连接数据库（通过 Airflow Connection）
    from airflow.hooks.base import BaseHook
    conn = BaseHook.get_connection("mysql_dw")
    engine = create_engine(
        f"mysql+pymysql://{conn.login}:{conn.password}@{conn.host}:{conn.port}/{conn.schema}"
    )

    # 读取数据
    df = pd.read_sql(
        f"SELECT * FROM ods_orders WHERE partition_date = '{ds}'",
        engine
    )

    # 质量检查
    checks = {
        "row_count": len(df),
        "null_rate_amount": df["amount"].isnull().mean(),
        "null_rate_user_id": df["user_id"].isnull().mean(),
        "duplicate_rate": df.duplicated(subset=["order_id"]).mean(),
    }

    print("数据质量检查结果：")
    for metric, value in checks.items():
        print(f"  {metric}: {value}")

    # 教学示例阈值：生产使用需按业务口径调整；显式异常不会被 Python 优化模式移除
    if checks["row_count"] <= 0:
        raise ValueError("数据量为零，可能同步失败")
    if not checks["null_rate_amount"] < 0.05:
        raise ValueError(f"金额空值率 {checks['null_rate_amount']:.1%} 达到或超过 5%")
    if not checks["duplicate_rate"] < 0.01:
        raise ValueError(f"重复率 {checks['duplicate_rate']:.1%} 达到或超过 1%")

    # 将检查结果推送到 XCom
    ti.xcom_push(key="quality_metrics", value=checks)
    print("所有检查通过！")

quality_check = PythonOperator(
    task_id="check_data_quality",
    python_callable=check_data_quality,
)
```

---

## SQLExecuteQueryOperator

**SQLExecuteQueryOperator** 由 `apache-airflow-providers-common-sql` 提供，用于通过数据库 Hook 统一执行 SQL。能否替代旧版的 `MySqlOperator`、`PostgresOperator` 等，应按所安装的 common-sql 与数据库 Provider 版本及参数兼容性确认，不能仅凭 Airflow 2.4+ 判断。

### 连接 MySQL

```python
from airflow.providers.common.sql.operators.sql import SQLExecuteQueryOperator

# 前提：在 Web UI Admin → Connections 中创建 mysql_prod 连接
# conn_type: MySQL
# host: 192.168.1.100
# schema: business_db
# login: etl_user
# password: ****
# port: 3306

# 执行 DDL
create_table = SQLExecuteQueryOperator(
    task_id="create_staging_table",
    conn_id="mysql_prod",
    sql="""
        CREATE TABLE IF NOT EXISTS stg_orders (
            order_id VARCHAR(64) PRIMARY KEY,
            user_id BIGINT NOT NULL,
            amount DECIMAL(10, 2),
            status VARCHAR(20),
            create_time DATETIME,
            partition_date DATE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """,
)

# 执行 DML（带模板变量）
insert_data = SQLExecuteQueryOperator(
    task_id="insert_to_staging",
    conn_id="mysql_prod",
    sql="""
        INSERT INTO stg_orders
        SELECT
            order_id,
            user_id,
            amount,
            status,
            create_time,
            DATE('{{ ds }}') as partition_date
        FROM raw_orders
        WHERE DATE(create_time) = '{{ ds }}'
    """,
    # autocommit=True 自动提交（对于 DML 操作）
    autocommit=True,
)

# 执行多条 SQL（传入列表）
cleanup_and_insert = SQLExecuteQueryOperator(
    task_id="cleanup_and_insert",
    conn_id="mysql_prod",
    sql=[
        "DELETE FROM stg_orders WHERE partition_date = '{{ ds }}'",
        """
        INSERT INTO stg_orders
        SELECT *, '{{ ds }}' FROM raw_orders
        WHERE DATE(create_time) = '{{ ds }}'
        """,
    ],
    autocommit=True,
)
```

### 连接 PostgreSQL

```python
# PostgreSQL 连接配置同理，conn_type 选 Postgres
create_dw_table = SQLExecuteQueryOperator(
    task_id="create_dw_table",
    conn_id="postgres_dw",
    sql="""
        CREATE TABLE IF NOT EXISTS dws_order_daily (
            partition_date DATE NOT NULL,
            total_orders BIGINT,
            total_amount NUMERIC(20, 2),
            avg_amount NUMERIC(10, 2),
            cancel_rate NUMERIC(5, 4),
            PRIMARY KEY (partition_date)
        )
        PARTITION BY RANGE (partition_date);
    """,
)
```

---

## HiveOperator

**HiveOperator** 在 Hive 上执行 HiveQL 语句，用于数仓的 ETL 操作。

```python
from airflow.providers.apache.hive.operators.hive import HiveOperator

# 场景：将 ODS 层数据聚合到 DWS 层
aggregate_to_dws = HiveOperator(
    task_id="aggregate_order_to_dws",
    hql="""
        -- 插入模式：覆盖写入当天分区
        INSERT OVERWRITE TABLE dws.order_daily_summary
        PARTITION (dt='{{ ds }}')
        SELECT
            user_id,
            COUNT(order_id)               AS order_count,
            SUM(amount)                   AS total_amount,
            AVG(amount)                   AS avg_amount,
            SUM(IF(status='cancelled',1,0)) AS cancel_count,
            CURRENT_TIMESTAMP()           AS etl_time
        FROM ods.orders
        WHERE dt = '{{ ds }}'
          AND status != 'test'
        GROUP BY user_id
    """,
    hive_cli_conn_id="hive_default",     # Hive 连接 ID
    mapred_queue="etl",                  # 使用的 YARN 队列
    hiveconf_jinja_translate=True,       # 将 ${var} 形式转换为 Jinja 形式；并非启用 Jinja 的开关
)

# 场景：Hive 建表（如果不存在）
create_hive_table = HiveOperator(
    task_id="create_hive_partition_table",
    hql="""
        CREATE TABLE IF NOT EXISTS ods.orders (
            order_id STRING,
            user_id BIGINT,
            amount DECIMAL(10, 2),
            status STRING,
            create_time TIMESTAMP
        )
        PARTITIONED BY (dt STRING)
        STORED AS ORC
        TBLPROPERTIES ('orc.compress'='SNAPPY');
    """,
    hive_cli_conn_id="hive_default",
)
```

> [!note] Hive 连接配置
> 在 Admin → Connections 创建连接：
> - conn_type: Hive Client Wrapper
> - 此示例通过 Hive CLI/Beeline 执行，需在 Worker 上安装相应客户端
> - 使用 Beeline 连接 HiveServer2 时，host 填 HiveServer2 地址，port 通常为 10000，并在连接 extra 中配置 `use_beeline: true`
> - 未使用 Beeline 时，不应把 host/port 配置直接当作 HiveServer2 连接已生效
> - login: hive 用户名

---

## SparkSubmitOperator

**SparkSubmitOperator** 提交 Spark 作业到集群，适合大规模数据处理。

```python
from airflow.providers.apache.spark.operators.spark_submit import SparkSubmitOperator

# 场景：提交 Spark ETL 作业
spark_etl_job = SparkSubmitOperator(
    task_id="spark_order_etl",
    application="/opt/spark-jobs/order_etl.py",  # Spark 脚本路径
    conn_id="spark_default",                      # Spark 集群连接
    name="order_etl_{{ ds }}",                   # 作业名称（在 YARN/Spark UI 中显示）
    # 执行参数（传入 Spark 脚本的 sys.argv）
    application_args=["--date", "{{ ds }}", "--env", "prod"],
    # Spark 配置
    conf={
        "spark.executor.memory": "4g",
        "spark.executor.cores": "2",
        "spark.executor.instances": "10",
        "spark.driver.memory": "2g",
        "spark.sql.shuffle.partitions": "200",
    },
    # 依赖的 Python 包（zip 格式）
    py_files="/opt/spark-jobs/libs/utils.zip",
    # 依赖的 JAR 包（如 MySQL JDBC Driver）
    jars="/opt/jars/mysql-connector-java-8.0.33.jar",
    # 执行模式：提交到 YARN；在 spark_default Connection 的 host 中配置 yarn
    # master 由连接配置提供，不作为 SparkSubmitOperator 的直接参数
    deploy_mode="cluster",
    # 执行超时：使用 timedelta
    execution_timeout=timedelta(hours=3),
    verbose=True,  # 输出详细日志
)
```

**被提交的 Spark 脚本（order_etl.py）：**

```python
# /opt/spark-jobs/order_etl.py
import argparse
from pyspark.sql import SparkSession
from pyspark.sql import functions as F

def main(date: str, env: str):
    spark = SparkSession.builder \
        .appName(f"order_etl_{date}") \
        .enableHiveSupport() \
        .getOrCreate()

    # 读取 ODS 层数据
    df = spark.sql(f"""
        SELECT * FROM ods.orders
        WHERE dt = '{date}'
    """)

    print(f"读取 {df.count()} 条记录")

    # 数据处理
    result = df \
        .filter(F.col("status") != "test") \
        .groupBy("user_id") \
        .agg(
            F.count("order_id").alias("order_count"),
            F.sum("amount").alias("total_amount"),
        )

    # 聚合后补回日期分区列
    result = result.withColumn("dt", F.lit(date))

    # 写入 DWS 层：overwrite 的实际覆盖范围须按表类型和配置验证，仅在隔离测试表练习
    result.write \
        .mode("overwrite") \
        .partitionBy("dt") \
        .saveAsTable("dws.user_order_daily")

    spark.stop()
    print("Spark 作业完成！")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", required=True)
    parser.add_argument("--env", default="dev")
    args = parser.parse_args()
    main(args.date, args.env)
```

---

## EmailOperator

**EmailOperator** 发送邮件，常用于报表推送和告警通知。

```python
from airflow.operators.email import EmailOperator

# 前提：在 airflow.cfg 配置 SMTP
# [smtp]
# smtp_host = smtp.company.com
# smtp_starttls = True
# smtp_ssl = False
# smtp_port = 587
# smtp_user = airflow@company.com
# smtp_password = your_password
# smtp_mail_from = airflow@company.com

# 发送简单通知
send_notification = EmailOperator(
    task_id="send_completion_email",
    to=["data-team@company.com", "manager@company.com"],
    subject="[Airflow] 每日 ETL 完成 - {{ ds }}",
    html_content="""
        <h3>数据管道运行完成</h3>
        <p>运行日期：{{ ds }}</p>
        <p>所有任务已成功完成，请查看 BI 报表。</p>
        <br>
        <p>Airflow 自动发送</p>
    """,
)

# 发送带附件的报表邮件
def generate_report_file(**context):
    """生成报表文件并返回路径"""
    import pandas as pd

    ds = context["ds"]
    report_path = f"/tmp/daily_report_{ds}.xlsx"

    # 生成报表数据（示例）
    df = pd.DataFrame({
        "日期": [ds],
        "订单数": [12345],
        "销售额": [987654.32],
        "取消率": ["2.3%"],
    })
    df.to_excel(report_path, index=False)

    return report_path

generate_report = PythonOperator(
    task_id="generate_report",
    python_callable=generate_report_file,
)

send_report = EmailOperator(
    task_id="send_report_email",
    to=["manager@company.com"],
    subject="每日销售报表 - {{ ds }}",
    html_content="""
        <h3>每日销售报表</h3>
        <p>日期：{{ ds }}</p>
        <p>请查看附件中的详细报表。</p>
    """,
    # 附件路径（从 XCom 读取上游任务生成的文件路径）
    files=[
        "{{ task_instance.xcom_pull(task_ids='generate_report') }}"
    ],
)

generate_report >> send_report
```

---

## FileSensor

**FileSensor** 等待某个文件出现后，才允许下游任务继续执行。

```python
from airflow.sensors.filesystem import FileSensor

# 场景：等待上游系统生成的数据文件就绪
wait_for_source_file = FileSensor(
    task_id="wait_for_orders_file",
    filepath="/data/incoming/orders_{{ ds }}.csv",
    # 检查间隔（秒）：每 60 秒检查一次
    poke_interval=60,
    # 超时时间（秒）：超过 2 小时还没有文件就失败
    timeout=7200,
    # mode="reschedule" 表示等待时释放 Worker slot，推荐用于长时间等待
    mode="reschedule",
    # mode="poke" 表示持续占用 Worker slot（仅适合短时间等待）
)

# 文件出现后再执行处理
wait_for_source_file >> process_task
```

---

## HttpSensor

**HttpSensor** 等待某个 HTTP 接口返回预期结果，常用于等待上游 API 就绪。

```python
from airflow.providers.http.sensors.http import HttpSensor

# 场景：等待数据接口的数据就绪标志位
wait_for_api = HttpSensor(
    task_id="wait_for_data_api",
    http_conn_id="data_api",                    # HTTP 连接 ID
    endpoint="/api/v1/data-ready",              # 接口路径
    request_params={"date": "{{ ds }}"},        # 请求参数
    # 响应检查函数（返回 True 表示条件满足）
    response_check=lambda response: response.json().get("ready") is True,
    poke_interval=120,      # 每 2 分钟检查一次
    timeout=3600,           # 最多等待 1 小时
    mode="reschedule",
)
```

---

## ExternalTaskSensor

**ExternalTaskSensor** 等待另一个 DAG 的某个 Task 完成。

```python
from airflow.sensors.external_task import ExternalTaskSensor

# 场景：DWS 层的 DAG 需要等待 ODS 层 DAG 的 load_to_ods 任务成功完成；若需等待整个 DAG，设置 external_task_id=None
wait_for_ods = ExternalTaskSensor(
    task_id="wait_for_ods_dag",
    external_dag_id="ods_orders_daily_etl",      # 被等待的 DAG ID
    external_task_id="load_to_ods",              # 被等待的 Task ID（None 表示等待整个 DAG）
    # 相对于当前任务逻辑日期的偏移；零偏移要求目标任务逻辑日期相同，不会自动解决时区或调度差异
    execution_delta=timedelta(hours=0),
    poke_interval=120,
    timeout=7200,
    mode="reschedule",
)
```

---

## Operator 对比速查表

| Operator | 安装包 | 主要参数 | 典型场景 |
|----------|--------|---------|---------|
| BashOperator | 内置 | `bash_command`, `env` | 调用脚本、Shell 操作 |
| PythonOperator | 内置 | `python_callable`, `op_kwargs` | 数据处理、业务逻辑 |
| SQLExecuteQueryOperator | common-sql | `conn_id`, `sql`, `autocommit` | 执行 SQL 语句 |
| HiveOperator | apache-hive | `hql`, `hive_cli_conn_id` | Hive 数仓操作 |
| SparkSubmitOperator | apache-spark | `application`, `conf` | 提交 Spark 作业 |
| EmailOperator | 内置 | `to`, `subject`, `html_content` | 发送邮件通知 |
| FileSensor | 内置 | `filepath`, `poke_interval` | 等待文件生成 |
| HttpSensor | http | `endpoint`, `response_check` | 等待接口就绪 |
| ExternalTaskSensor | 内置 | `external_dag_id`, `external_task_id` | 等待其他 DAG |

---

## 小结

- **BashOperator**：适合调用已有命令和脚本，前提是 Worker 具备所需客户端与权限；注意 `set -e` 的例外及 `.sh`/`.bash` 模板文件加载规则
- **PythonOperator**：复杂逻辑首选，通过 `**context` 获取上下文，`return` 值自动进 XCom
- **SQLExecuteQueryOperator**：common-sql Provider 提供的统一 SQL 执行接口，需核对 Airflow、common-sql 和数据库 Provider 的版本兼容性
- **SparkSubmitOperator**：提交 Spark 作业，记得配置好内存和并行度
- **Sensor**：用 `mode="reschedule"` 避免长时间等待占用 Worker

下一篇：[[【技术与工具】/Airflow/06-任务依赖与编排|06-任务依赖与编排]] — 掌握复杂依赖、条件分支和动态 DAG

---

*所属系列：[[【技术与工具】/Airflow/00-Airflow学习路线图|00-Airflow学习路线图]] | 上一篇：[[【技术与工具】/Airflow/04-第一个DAG|04-第一个DAG]] | 下一篇：[[【技术与工具】/Airflow/06-任务依赖与编排|06-任务依赖与编排]]*

#Airflow #Operator #BashOperator #PythonOperator #HiveOperator #Spark #Sensor

---

> [!info] 前置知识
> - 能写出一个基础 DAG 文件，参考 [[【技术与工具】/Airflow/04-第一个DAG|第一个 DAG]]
> - 了解 Airflow Connection 的概念（conn_id 是什么），参考 [[【技术与工具】/Airflow/02-Airflow核心概念|Airflow 核心概念]]
> - 熟悉 Python 函数、参数传递、装饰器基本概念

---

## 掌握检查

- [ ] 能写出 BashOperator 调用一个带日期参数的 Python 脚本的完整代码（包含模板变量 `{{ ds }}`）
- [ ] 能解释 BashOperator 的脚本模板加载规则——为什么 `.sh`/`.bash` 路径可能被当作模板文件，以及末尾空格如何避免这种加载
- [ ] 能写出 PythonOperator 通过 `op_kwargs` 传参、并通过 `return` 将数据存入 XCom 的完整示例
- [ ] 知道 Sensor 的 `mode="reschedule"` 和 `mode="poke"` 的区别，以及什么场景各用哪个
- [ ] 能说明 `SQLExecuteQueryOperator` 的统一 SQL 执行用途，以及替代 `MySqlOperator`/`PostgresOperator` 前需要核对的 Provider 版本与参数兼容性

---

## 实践练习

**基础题**：用 `SQLExecuteQueryOperator` 写一个 Task，连接到本地 MySQL，查询某张表中某一天（`{{ ds }}`）的行数，并通过 XCom 把这个数字传给下游 Task 用于数据质量判断。

**进阶题**：用 `FileSensor` + `PythonOperator` 实现以下逻辑：等待 `/data/incoming/orders_{{ ds }}.csv` 文件出现（最多等 2 小时），文件出现后用 Python 读取并打印行数。要求 Sensor 使用 `mode="reschedule"`，并解释为什么不用 `mode="poke"`。
