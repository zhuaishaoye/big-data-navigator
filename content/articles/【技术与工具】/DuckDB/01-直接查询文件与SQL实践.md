---
title: DuckDB直接查询文件与SQL实践
tags:
  - DuckDB
  - SQL
  - CSV
  - Parquet
  - 本地分析
aliases:
  - DuckDB查询文件
  - SQL on Files
created: 2026-08-16
updated: 2026-10-10
duration: 45分钟
difficulty: 中级
status: maintenance
knowledge_type: technical-practice
stability: slow-changing
last_verified: 2026-08-16
next_review: 2026-11-16
applies_to:
  - DuckDB current documentation
  - DuckDB Python client
source_level: primary
sources:
  - https://duckdb.org/docs/current/guides/file_formats/query_parquet
  - https://duckdb.org/docs/current/data/csv/overview
  - https://duckdb.org/docs/current/sql/statements/copy
target_audience:
  - 数据分析师
  - 数据开发工程师
  - BI分析师
  - 数据科学家
  - 数据治理工程师
access_tier: free
---


# DuckDB直接查询文件与SQL实践

> [!abstract] 学习目标
> 不先导入数据库，直接用 SQL 查询 CSV、Parquet 和一组分区文件；理解自动推断、显式类型、列裁剪、过滤下推和 `COPY` 导出各自解决什么问题。

DuckDB 的高价值入口不是“先建表”，而是把文件当表查询。它适合一次性探索、质量检查和本地数据集市的入口层。开始前可先看 [[【技术与工具】/DuckDB/00-DuckDB学习路线图|DuckDB学习路线图]] 与 [[【技术与工具】/SQL/00-SQL学习路线图|SQL学习路线图]]。

## 1. 从一个可复现数据集开始

```sql
CREATE TABLE orders AS
SELECT * FROM (VALUES
  (1, DATE '2026-08-01', 'paid', 99.00),
  (2, DATE '2026-08-01', 'cancelled', 30.00),
  (3, DATE '2026-08-02', 'paid', 120.00)
) AS t(order_id, pay_date, status, amount);

COPY orders TO 'orders.parquet' (FORMAT parquet);
COPY orders TO 'orders.csv' (HEADER, DELIMITER ',');
```

预期结果：当前目录生成两个文件，各有 3 行数据。这个样例避免依赖外部下载，第2、4、5节 SQL 可使用这两个文件执行；第3节的多文件与分区路径为示意，需自行准备匹配目录和文件。

## 2. 直接查询 CSV 与 Parquet

文件路径可以直接出现在 `FROM` 中；需要更多读取参数时，使用表函数。

```sql
SELECT pay_date, SUM(amount) AS gmv
FROM 'orders.parquet'
WHERE status = 'paid'
GROUP BY pay_date
ORDER BY pay_date;
```

预期得到 `2026-08-01 → 99.00`、`2026-08-02 → 120.00`。Parquet 查询会自动做列裁剪，并在可行时把过滤条件下推到扫描层，因此不要习惯性先 `SELECT *` 再交给 Python 过滤。

CSV 依赖采样推断。生产脚本应在日期、金额、前导零编码等关键字段上显式声明类型：

```sql
SELECT *
FROM read_csv(
  'orders.csv',
  header = true,
  columns = {
    'order_id': 'BIGINT',
    'pay_date': 'DATE',
    'status': 'VARCHAR',
    'amount': 'DECIMAL(18,2)'
  }
);
```

> [!warning]
> 自动推断适合探索，不是长期数据契约。后续批次出现空值、异常日期或超长编码时，推断结果可能变化；金额也不应无条件使用浮点数。

## 3. 多文件与分区目录

DuckDB 表函数接受 glob。`filename = true` 能保留来源文件，便于审计坏批次；结构随批次新增列时可评估 `union_by_name = true`。

```sql
SELECT filename, status, COUNT(*) AS rows
FROM read_parquet('lake/orders/**/*.parquet', filename = true)
GROUP BY filename, status;
```

Hive 风格路径如 `dt=2026-08-01/region=cn/part.parquet` 在启用 Hive 分区识别时可把目录值作为分区列。对分区列 `dt` 添加可用于裁剪的过滤条件，可以减少需要扫描的文件；实际裁剪效果应通过执行计划确认。不要把成千上万个微小文件当成“天然并行”：文件打开与元数据处理也有成本。

## 4. 用 SQL 做一次完整分析

```sql
WITH paid AS (
  SELECT pay_date, order_id, amount
  FROM read_parquet('orders.parquet')
  WHERE status = 'paid'
), daily AS (
  SELECT pay_date,
         COUNT(DISTINCT order_id) AS orders,
         SUM(amount) AS gmv
  FROM paid
  GROUP BY pay_date
)
SELECT *, gmv / NULLIF(orders, 0) AS avg_order_value
FROM daily
ORDER BY pay_date;
```

这段 SQL 把读取、过滤、聚合和指标计算放在一次查询中。复杂业务口径可参考 [[【技术与工具】/SQL/33-AI时代分析SQL实战|AI时代分析SQL实战]]；输出前先验证行数、唯一键、空值和金额范围。

## 5. 导出可复用结果

```sql
COPY (
  SELECT * FROM 'orders.parquet' WHERE status = 'paid'
) TO 'paid_orders.parquet' (FORMAT parquet, COMPRESSION zstd);
```

`COPY` 适合把查询结果固化为下游文件。边界是：写出成功不等于数据正确；应同时记录源文件范围、SQL 版本、结果行数和校验摘要。若需要进入 Python、Arrow 或 Polars，继续阅读 [[【技术与工具】/DuckDB/02-Python集成与数据交换|Python集成与数据交换]]。

## 6. 常见误区与边界

- DuckDB 是单机嵌入式分析引擎，不是高并发交易数据库。
- CSV 没有可靠 schema，关键任务要显式指定类型与日期格式。
- 直接查文件不等于没有治理：路径、分区、命名和口径仍需稳定。
- `LIMIT 10` 只能看样例，不能替代完整质量校验。
- 远程对象存储还涉及凭据、网络重试与缓存，本篇只覆盖本地文件。

## 7. 练习

1. 增加一条 `amount IS NULL` 的记录，比较 `SUM`、`COUNT(*)` 与 `COUNT(amount)`。
2. 创建两个列顺序不同的 Parquet 文件，测试按名称合并并核对 schema。
3. 用 `EXPLAIN` 查看按状态过滤时的扫描计划，确认只读取所需列。
4. 导出每日 GMV，写出行数、日期范围与 GMV 合计三个验收断言。

## 8. 延伸阅读

- [[【技术与工具】/DuckDB/03-性能优化与扩展管理|性能优化与扩展管理]]
- [[【技术与工具】/Polars/01-表达式与常用数据操作|Polars表达式与常用数据操作]]
- [[【技术与工具】/Polars/02-Lazy执行与性能优化|Polars Lazy执行与性能优化]]
- [[【技术与工具】/Ibis/01-表达式与延迟执行|Ibis表达式与延迟执行]]
- [[【技术与工具】/Ibis/02-后端连接与数据读写|Ibis后端连接与数据读写]]
- [[【技术与工具】/Python/09-Pandas数据结构|Pandas数据结构]]
- [[【技术与工具】/Python/10-Pandas数据操作|Pandas数据操作]]
- [[【技术与工具】/Python/11-Pandas数据清洗|Pandas数据清洗]]
- [[【技术与工具】/Python/12-数据读取与存储|Python数据读取与存储]]
- [[【技术与工具】/Python/41-从Pandas到Polars与DuckDB|从Pandas到Polars与DuckDB]]
- [[【技术与工具】/dbt/14-dbt-Fusion与AI时代SQL语义工程|dbt Fusion与AI时代SQL语义工程]]

## 官方来源

- [DuckDB：查询 Parquet 文件](https://duckdb.org/docs/current/guides/file_formats/query_parquet)
- [DuckDB：CSV 概览](https://duckdb.org/docs/current/data/csv/overview)
- [DuckDB：多文件读取](https://duckdb.org/docs/current/data/multiple_files/overview)
- [DuckDB：COPY 语句](https://duckdb.org/docs/current/sql/statements/copy)
