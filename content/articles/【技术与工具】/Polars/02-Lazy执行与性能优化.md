---
title: Polars Lazy执行与性能优化
tags:
  - Polars
  - LazyFrame
  - 查询优化
  - 性能优化
  - Parquet
aliases:
  - Polars Lazy API
  - Polars性能优化
created: 2026-08-16
updated: 2026-10-10
duration: 55分钟
difficulty: 中级
status: active
knowledge_type: technical-practice
stability: fast-changing
last_verified: 2026-08-16
next_review: 2026-11-16
applies_to:
  - Polars Python current documentation
source_level: primary
sources:
  - https://docs.pola.rs/user-guide/concepts/lazy-api/
  - https://docs.pola.rs/user-guide/lazy/using/
  - https://docs.pola.rs/user-guide/lazy/optimizations/
target_audience:
  - 数据分析师
  - 数据开发工程师
  - 数据科学家
access_tier: free
---


# Polars Lazy执行与性能优化

> [!abstract] 学习目标
> 从文件扫描构建 LazyFrame，使用 explain 检查查询计划，理解谓词、投影、切片与公共子计划优化，并用基准和结果断言验证调优。

Polars 同时支持 eager 与 lazy。Lazy API 先收集完整查询计划，到 `collect()` 时执行，使优化器有机会把过滤、列选择等动作推到扫描端。官方指南建议多数确定的数据管道优先使用 lazy；探索中需要即时中间结果时再用 eager。表达式基础见 [[【技术与工具】/Polars/01-表达式与常用数据操作|表达式与常用数据操作]]。

## 1. scan 与 read 的区别

```python
import polars as pl

query = (
    pl.scan_parquet("orders.parquet")
    .filter(pl.col("status") == "paid")
    .group_by("customer_id")
    .agg(pl.col("amount").sum().alias("gmv"))
    .sort("gmv", descending=True)
)

print(type(query))
result = query.collect()
```

`scan_parquet` 返回 LazyFrame，定义查询时不会立即把数据全部读入；`read_parquet` 返回已经物化的 DataFrame。预期在 `collect()` 时得到按客户汇总的结果。若数据已经在内存，可通过 `df.lazy()` 进入 lazy 管道，但已发生的文件读取无法被优化器“退回”扫描端。

## 2. 查看逻辑计划

```python
print(query.explain())
```

计划文本应能看到 Parquet 扫描、所需列和过滤条件。官方示例展示了 predicate pushdown 与 projection pushdown：过滤尽可能靠近扫描执行，只读取最终需要的列。计划格式会随版本变化，测试不要对完整字符串做脆弱快照；更适合检查关键行为和最终结果。

## 3. 主要优化类型

官方优化页面列出的能力包括：

| 优化 | 作用 |
|---|---|
| Predicate pushdown | 尽早应用过滤，减少行 |
| Projection pushdown | 扫描时只读取所需列 |
| Slice pushdown | 尽早限制所需切片 |
| Common subplan elimination | 复用重复子计划或文件扫描 |
| Simplify expressions | 常量折叠与表达式简化 |
| Join ordering | 调整连接顺序以降低内存压力 |
| Type coercion | 选择可执行且更合适的类型 |
| Cardinality estimation | 为聚合等选择策略 |

这些是优化器机会，不是对任意查询都生效的保证。自定义 Python UDF、不透明逻辑或先物化中间结果，可能阻断优化。

## 4. 一条端到端管道

```python
query = (
    pl.scan_csv(
        "orders/*.csv",
        schema_overrides={"order_id": pl.Int64, "amount": pl.Float64},
        try_parse_dates=True,
    )
    .filter(
        (pl.col("status") == "paid")
        & (pl.col("pay_date") >= pl.date(2026, 8, 1))
    )
    .select("order_id", "customer_id", "pay_date", "amount")
    .group_by("pay_date")
    .agg(
        pl.col("order_id").n_unique().alias("orders"),
        pl.col("amount").sum().alias("gmv"),
    )
)

result = query.collect()
```

显式 schema 可以减少推断漂移；选择列和过滤条件被纳入同一计划。CSV 仍需解析文本，稳定管道可评估先转 Parquet。文件格式取舍也可参考 [[【技术与工具】/DuckDB/01-直接查询文件与SQL实践|DuckDB直接查询文件]]。

## 5. Streaming 与超内存数据

Lazy API 可为 streaming engine 提供执行机会，但不是每个算子和组合都能完全流式。具体参数和兼容性变化较快，必须以当前 `collect` API 与执行计划为准。即使使用 streaming，最终结果若巨大，仍会在返回 DataFrame 时占用内存。

优化顺序通常是：减少列、减少行、降低 join 放大、分批或聚合输出，最后才考虑引擎选项。不要把 streaming 当成绕过数据设计的开关。

## 6. 基准方法

```python
from time import perf_counter

started = perf_counter()
out = query.collect()
elapsed = perf_counter() - started

assert out.height > 0
print({"seconds": elapsed, "rows": out.height, "schema": out.schema})
```

基准应固定 Polars 版本、数据、硬件、线程环境、缓存状态和输出口径，并进行多次运行。必须同时断言结果；只测速度可能把漏算数据当成优化。端到端管道还要记录读、算、写的整体时间。

## 7. 常见性能反模式

- `scan` 后立刻 `collect`，再继续多步 eager 处理；
- 大量 `map_elements` 或 Python 循环；
- 在过滤前展开或复制不需要的宽列；
- 多次独立扫描同一文件而未复用计划；
- 依赖 `maintain_order=True` 却没有业务必要；
- 为了看中间结果频繁物化整表；
- 把许多微小文件当作单个高效数据集。

## 8. 练习与验收

1. 用 `read_csv` 和 `scan_csv` 实现同一查询，比较计划与端到端耗时。
2. 增加十个无关列，确认 projection pushdown 仍只扫描必要列。
3. 把原生字符串表达式替换为 Python UDF，测量差异并恢复原生写法。
4. 设计一个会放大的 join，用键唯一性和结果行数阻止错误。
5. 分别记录冷缓存、热缓存三次结果，报告中位数而非最好一次。

## 9. 延伸阅读

- [[【技术与工具】/Polars/00-Polars学习路线图|Polars学习路线图]]
- [[【技术与工具】/Polars/03-从Pandas迁移到Polars|从Pandas迁移到Polars]]
- [[【技术与工具】/DuckDB/00-DuckDB学习路线图|DuckDB学习路线图]]
- [[【技术与工具】/DuckDB/02-Python集成与数据交换|DuckDB Python集成]]
- [[【技术与工具】/DuckDB/03-性能优化与扩展管理|DuckDB性能优化]]
- [[【技术与工具】/Ibis/00-Ibis学习路线图|Ibis学习路线图]]
- [[【技术与工具】/Ibis/01-表达式与延迟执行|Ibis表达式]]
- [[【技术与工具】/Ibis/02-后端连接与数据读写|Ibis后端连接]]
- [[【技术与工具】/Ibis/03-跨后端迁移与测试|Ibis跨后端测试]]
- [[【技术与工具】/Python/12-数据读取与存储|Python数据读取与存储]]
- [[【技术与工具】/Python/19-特征工程|Python特征工程]]
- [[【技术与工具】/Python/33-系统监控|Python系统监控]]
- [[【技术与工具】/Python/36-Python数据工程与大数据|Python数据工程与大数据]]
- [[【技术与工具】/SQL/33-AI时代分析SQL实战|AI时代分析SQL实战]]

## 官方来源

- [Polars：Lazy API 概念](https://docs.pola.rs/user-guide/concepts/lazy-api/)
- [Polars：使用 Lazy API](https://docs.pola.rs/user-guide/lazy/using/)
- [Polars：查询优化](https://docs.pola.rs/user-guide/lazy/optimizations/)
- [Polars：执行 Lazy 查询](https://docs.pola.rs/user-guide/lazy/execution/)
