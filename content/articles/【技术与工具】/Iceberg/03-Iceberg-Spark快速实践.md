---
title: Iceberg Spark快速实践
tags:
  - Iceberg
  - Spark
  - Lakehouse
  - SQL
  - Catalog
aliases:
  - Spark操作Iceberg
  - Iceberg快速开始
created: 2026-08-16
updated: 2026-10-10
difficulty: 中级
duration: 30分钟
status: maintenance
knowledge_type: technical-practice
stability: fast-changing
last_verified: 2026-08-16
next_review: 2026-11-16
applies_to:
  - Apache Iceberg 1.11.0
  - Spark 4.1 示例来自核验时的 latest 官方文档
source_level: primary
sources:
  - https://iceberg.apache.org/docs/latest/spark-getting-started/
  - https://iceberg.apache.org/docs/latest/spark-ddl/
  - https://iceberg.apache.org/docs/latest/spark-queries/
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据治理工程师
access_tier: free
---


# Iceberg Spark快速实践

> [!abstract] 本文目标
> - 在本地 Spark SQL 中配置 Iceberg Catalog
> - 完成建表、写入、查询、MERGE 和元数据检查
> - 理解示例配置与生产 Catalog 的边界
> - 用可观察结果判断 Iceberg 是否真正生效

前置阅读：[[【技术与工具】/Spark/00-Spark学习路线图|Spark学习路线图]]、[[【技术与工具】/Iceberg/02-Iceberg核心架构与表演进|Iceberg核心架构与表演进]]。

## 先锁定兼容矩阵

Iceberg 的运行包同时绑定 Spark 主版本、Scala 二进制版本和 Iceberg 版本。原稿将下面命令标注为来自 2026-08-16 读取到的官方 latest 快速开始页面；本轮未验证该读取记录及版本组合，运行前须确认所列制品可用且与本地 Spark/Scala 兼容，仅用于隔离的本地实验：

```bash
spark-sql \
  --packages org.apache.iceberg:iceberg-spark-runtime-4.1_2.13:1.11.0 \
  --conf spark.sql.extensions=org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions \
  --conf spark.sql.catalog.local=org.apache.iceberg.spark.SparkCatalog \
  --conf spark.sql.catalog.local.type=hadoop \
  --conf spark.sql.catalog.local.warehouse="$PWD/warehouse"
```

预期结果：在制品可获取且版本兼容的前提下，Spark SQL Shell 正常启动并加载指定运行包；`--packages` 会解析指定坐标及其依赖，不会自动选择与当前 Spark/Scala 匹配的版本。

> [!warning] 版本边界
> 不要把示例坐标直接复制到其他 Spark 版本。先在官方快速开始页面核对 runtime artifact，再检查计算引擎、Catalog 和对象存储客户端的兼容矩阵。

## Catalog配置是什么意思

示例创建名为 `local` 的 Hadoop Catalog，并把仓库目录指向本地 `warehouse`。它适合学习文件布局和 SQL 能力，但不等于生产 Catalog。

| 配置 | 作用 |
|---|---|
| `spark.sql.extensions` | 启用 Iceberg 的 Spark SQL 扩展 |
| `spark.sql.catalog.local` | 注册 Iceberg Spark Catalog 实现 |
| `spark.sql.catalog.local.type=hadoop` | 使用基于路径的 Hadoop Catalog |
| `spark.sql.catalog.local.warehouse` | 指定表仓库根目录 |

生产环境还要选择 Hive Metastore、REST Catalog、JDBC Catalog 等实现，并验证高可用、权限、认证、原子提交和灾备策略。

## 创建命名空间与表

```sql
CREATE NAMESPACE IF NOT EXISTS local.analytics;

CREATE TABLE IF NOT EXISTS local.analytics.orders (
    order_id BIGINT,
    user_id BIGINT,
    amount DECIMAL(18, 2),
    status STRING,
    event_time TIMESTAMP
)
USING iceberg
PARTITIONED BY (days(event_time));
```

预期结果：`SHOW TABLES IN local.analytics` 能看到 `orders`；仓库目录出现 Iceberg 元数据目录，但业务 SQL 中不需要维护单独的日期分区列。

## 写入与读取

```sql
INSERT INTO local.analytics.orders VALUES
  (1, 101, 99.00, 'paid',    TIMESTAMP '2026-08-16 10:00:00'),
  (2, 102, 39.00, 'created', TIMESTAMP '2026-08-16 10:05:00'),
  (3, 101, 88.00, 'paid',    TIMESTAMP '2026-08-17 09:00:00');

SELECT
    date(event_time) AS dt,
    sum(amount) AS gmv,
    count(*) AS order_count
FROM local.analytics.orders
WHERE status = 'paid'
GROUP BY date(event_time)
ORDER BY dt;
```

预期结果：返回两天的支付金额汇总。本查询仅过滤 `status`，不能据此验证基于 `event_time` 的隐藏分区裁剪；需另加 `event_time` 时间范围条件并检查执行计划或扫描结果，验证裁剪是否生效，而不必添加物理分区字段。

## 使用MERGE处理更新

```sql
CREATE OR REPLACE TEMP VIEW order_updates AS
SELECT * FROM VALUES
  (2L, 102L, CAST(39.00 AS DECIMAL(18, 2)), 'paid', TIMESTAMP '2026-08-16 10:05:00'),
  (4L, 103L, CAST(59.00 AS DECIMAL(18, 2)), 'paid', TIMESTAMP '2026-08-17 11:00:00')
AS t(order_id, user_id, amount, status, event_time);

MERGE INTO local.analytics.orders AS target
USING order_updates AS source
ON target.order_id = source.order_id
WHEN MATCHED THEN UPDATE SET *
WHEN NOT MATCHED THEN INSERT *;
```

预期结果：订单 2 的状态更新为 `paid`，订单 4 被插入。随后查看快照表，应新增一次提交记录。

## 检查快照而不是只看结果

```sql
SELECT committed_at, snapshot_id, parent_id, operation
FROM local.analytics.orders.snapshots
ORDER BY committed_at DESC;

SELECT file_path, file_size_in_bytes, record_count
FROM local.analytics.orders.all_data_files
ORDER BY file_path;
```

第一条查询检查快照及其父快照关系，第二条查询观察各保留快照中的数据文件信息；`all_data_files` 不提供 `snapshot_id` 列，不能通过此查询直接确定每次提交新增了哪些文件。具体元数据表能力可能随引擎和 Iceberg 版本变化，使用前以当前官方文档为准。

## 常见失败与定位顺序

### 找不到数据源`iceberg`

优先检查 runtime artifact 是否与 Spark、Scala 和 Iceberg 版本匹配，再检查包是否实际加载。仅配置 Catalog 而未加载 runtime 包也会失败。

### `MERGE INTO`语法不可用

确认已配置 `IcebergSparkSessionExtensions`。同时核对当前 Catalog 和表是否由 Iceberg 管理，不能对普通 Parquet 表直接使用 Iceberg 行级操作。

### 写入成功但别的引擎看不到

确认不同引擎连接的是同一 Catalog、同一 warehouse 和同一对象存储路径。不要只比较表名；命名空间相同不代表元数据服务相同。

### 本地示例迁移到对象存储失败

对象存储还涉及凭据、endpoint、region、路径风格、文件系统实现和权限。先用只读列表与小表写入验证基础连通性，再迁移生产表。

## 练习

1. 新增 `region` 列，验证 Schema Evolution 后旧数据读取结果。
2. 将分区规则从 `days(event_time)` 演进为 `hours(event_time)`，观察旧文件是否被立即重写。
3. 连续执行十次小批量写入，查询 `files` 元数据表并统计文件大小分布。
4. 使用时间旅行查询读取某个历史快照，再说明快照过期会产生什么影响。

## 学习连接

- [[【技术与工具】/Iceberg/00-Iceberg学习路线图|Iceberg学习路线图]]
- [[【技术与工具】/Iceberg/01-Iceberg-V3深度解析|Iceberg V3深度解析]]
- [[【技术与工具】/Iceberg/04-Iceberg表维护与小文件治理|Iceberg表维护与小文件治理]]
- [[【技术与工具】/Spark/00-Spark学习路线图|Spark学习路线图]]
- [[【技术与工具】/Flink/00-Flink学习路线图|Flink学习路线图]]
- [[【技术与工具】/Hive/00-Hive学习路线图|Hive学习路线图]]
- [[【技术与工具】/SQL/00-SQL学习路线图|SQL学习路线图]]
- [[【数据开发与数据架构】/06-数据处理架构/02-批处理架构|批处理架构]]
- [[【数据开发与数据架构】/06-数据处理架构/05-实时处理架构|实时处理架构]]
- [[【技术与工具】/Hudi/01-Hudi概述与特性|Hudi概述与特性]]
- [[【技术与工具】/Paimon/01-Paimon概述与特性|Paimon概述与特性]]

## 官方资料

- [Apache Iceberg Spark Getting Started](https://iceberg.apache.org/docs/latest/spark-getting-started/)
- [Apache Iceberg Spark DDL](https://iceberg.apache.org/docs/latest/spark-ddl/)
- [Apache Iceberg Spark Queries](https://iceberg.apache.org/docs/latest/spark-queries/)
