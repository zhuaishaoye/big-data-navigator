---
title: 从Pandas迁移到Polars
tags:
  - Polars
  - Pandas
  - 迁移
  - Python
  - DataFrame
aliases:
  - Pandas迁移Polars
  - Polars迁移指南
created: 2026-08-16
updated: 2026-10-10
duration: 60分钟
difficulty: 中级
status: active
knowledge_type: technical-practice
stability: fast-changing
last_verified: 2026-08-16
next_review: 2026-11-16
applies_to:
  - Polars Python current documentation
  - Pandas users
source_level: primary
sources:
  - https://docs.pola.rs/user-guide/migration/pandas/
  - https://docs.pola.rs/user-guide/concepts/expressions-and-contexts/
  - https://docs.pola.rs/user-guide/concepts/lazy-api/
target_audience:
  - 数据分析师
  - 数据开发工程师
  - 数据科学家
  - BI分析师
access_tier: free
---


# 从Pandas迁移到Polars

> [!abstract] 学习目标
> 识别 Pandas 与 Polars 的模型差异，逐步迁移选择、派生列、分组、连接和文件管道，并用 schema 与结果测试避免“语法翻译正确、语义却变化”。

迁移不是把 `pd` 全局替换成 `pl`。Polars 官方迁移指南强调：Polars 没有 Pandas 式 index，使用 Arrow 内存格式，类型更严格，表达式 API 更普遍，并同时支持 eager 与 lazy。建议先复习 [[【技术与工具】/Python/09-Pandas数据结构|Pandas数据结构]]、[[【技术与工具】/Python/10-Pandas数据操作|Pandas数据操作]] 和 [[【技术与工具】/Polars/01-表达式与常用数据操作|Polars表达式]]。

## 1. 先迁移边界清晰的管道

适合优先迁移：大 CSV/Parquet 清洗、列式转换、分组聚合和明确 schema 的特征工程。不适合第一批迁移：高度依赖 index/MultiIndex、第三方仅接收 Pandas、逐行自定义 Python 对象或大量隐式类型变化的脚本。

迁移前保存输入样例、输出 schema、主键、行数、空值统计与核心指标，作为黄金合同。

## 2. 语法映射不是语义证明

| 意图 | Pandas | Polars |
|---|---|---|
| 选列 | `df.loc[:, ["a", "b"]]` | `df.select("a", "b")` |
| 过滤 | `df[df["a"] > 0]` | `df.filter(pl.col("a") > 0)` |
| 新列 | `df.assign(c=...)` | `df.with_columns(...alias("c"))` |
| 分组 | `df.groupby("k").agg(...)` | `df.group_by("k").agg(...)` |
| 排序 | `df.sort_values("a")` | `df.sort("a")` |
| 连接 | `df.merge(dim, on="id")` | `df.join(dim, on="id")` |

Polars 没有 `.loc`、`.iloc` 的标签索引模型；行身份应由显式业务键表达。Pandas 的 `reset_index()` 在 Polars 中通常不需要，若 index 原本承载业务字段，应在迁移前把它变成普通列。

## 3. 一个端到端改写

Pandas eager 写法：

```python
import pandas as pd

df = pd.read_csv("orders.csv", usecols=["customer_id", "status", "amount"])
result_pd = (
    df.loc[df["status"] == "paid"]
    .groupby("customer_id", as_index=False)["amount"]
    .sum()
    .rename(columns={"amount": "gmv"})
)
```

Polars lazy 写法：

```python
import polars as pl

result_pl = (
    pl.scan_csv("orders.csv")
    .filter(pl.col("status") == "paid")
    .group_by("customer_id")
    .agg(pl.col("amount").sum().alias("gmv"))
    .collect()
)
```

Polars 优化器可以识别只需要三个列，并尽早过滤。预期两份结果在按 `customer_id` 排序后具有同样业务值；列类型可能不同，应按合同判断而非强行转成一致字符串。

## 4. 列赋值与表达式组合

Pandas 常用 `assign(lambda ...)`，Polars 用原生表达式：

```python
result = df_pl.with_columns(
    (pl.col("amount") * 1.06).round(2).alias("gross_amount"),
    pl.when(pl.col("amount") >= 100)
    .then(pl.lit("high"))
    .otherwise(pl.lit("normal"))
    .alias("amount_level"),
)
```

同一上下文中的独立表达式可并行。避免把 Pandas 的逐行 `apply(axis=1)` 原样改为 Polars Python UDF；先组合 `when-then-otherwise`、字符串、列表、结构体与窗口表达式。

## 5. 类型、空值与字符串

Pandas 可能因缺失值把整数隐式变成浮点；Polars 类型更严格，通常更早暴露问题。重点建立以下测试：

- `null` 与浮点 `NaN` 分开统计；
- 字符串到日期使用明确格式和 strict 策略；
- categorical、decimal、时区字段逐列核对；
- join 键两侧类型一致；
- 从 Pandas 转换时检查 object 列是否混合类型。

清洗策略可结合 [[【技术与工具】/Python/11-Pandas数据清洗|Pandas数据清洗]]，但实现应使用 Polars 原生表达式。

## 6. 互操作与渐进迁移

不必一次改完全部系统。可把一个稳定清洗阶段迁到 Polars，然后在边界转回 Pandas：

```python
polars_df = pl.from_pandas(pandas_df)
cleaned = transform(polars_df)
pandas_out = cleaned.to_pandas()
```

每次转换都要检查复制、Arrow 扩展类型、时区和下游兼容。若管道中反复来回转换，性能收益可能被复制抵消。涉及 SQL 探索时也可考虑 [[【技术与工具】/DuckDB/02-Python集成与数据交换|DuckDB Python集成与数据交换]]。

## 7. 双跑与切换门禁

迁移期让旧 Pandas 与新 Polars 对同一固定输入双跑，比较：

1. schema 与列顺序；
2. 行数、主键唯一性与未匹配率；
3. NULL/NaN 数量；
4. 核心聚合指标；
5. 排序（仅当业务依赖）；
6. 端到端耗时和峰值内存。

浮点结果使用合理容差，金额优先精确类型。只有在黄金数据、异常数据和代表性规模上同时通过，才逐步切换消费者；保留回滚路径。

## 8. 常见失败

- 继续按 Pandas 心智逐行处理，导致 Polars 优势消失；
- 把无默认顺序的结果当作稳定顺序比较；
- 忽略 index 中的业务信息；
- 只比较速度，不比较结果；
- 全量 `collect` 后才过滤；
- 为兼容旧代码频繁 `to_pandas()`；
- 测试只覆盖无空值、无重复的小净数据。

## 9. 练习

1. 选择一段 30 行以内 Pandas 清洗脚本，先写黄金输出再迁移。
2. 把两段 `apply` 改成原生表达式并测量耗时。
3. 构造 nullable integer、NaN、时区时间戳，核对来回转换结果。
4. 将 `read_csv` 改成 `scan_csv`，用 `explain` 检查列与过滤下推。
5. 写一个双跑比较器，报告 schema、行数、键和指标差异。

## 10. 延伸阅读

- [[【技术与工具】/Polars/00-Polars学习路线图|Polars学习路线图]]
- [[【技术与工具】/Polars/02-Lazy执行与性能优化|Polars Lazy执行]]
- [[【技术与工具】/DuckDB/00-DuckDB学习路线图|DuckDB学习路线图]]
- [[【技术与工具】/DuckDB/01-直接查询文件与SQL实践|DuckDB直接查询文件]]
- [[【技术与工具】/DuckDB/03-性能优化与扩展管理|DuckDB性能优化]]
- [[【技术与工具】/Ibis/00-Ibis学习路线图|Ibis学习路线图]]
- [[【技术与工具】/Ibis/01-表达式与延迟执行|Ibis表达式]]
- [[【技术与工具】/Ibis/02-后端连接与数据读写|Ibis后端连接]]
- [[【技术与工具】/Ibis/03-跨后端迁移与测试|Ibis跨后端测试]]
- [[【技术与工具】/Python/12-数据读取与存储|Python数据读取与存储]]
- [[【技术与工具】/Python/19-特征工程|Python特征工程]]
- [[【技术与工具】/Python/27-模型评估与交叉验证|模型评估与交叉验证]]
- [[【技术与工具】/Python/36-Python数据工程与大数据|Python数据工程与大数据]]
- [[【技术与工具】/SQL/00-SQL学习路线图|SQL学习路线图]]

## 官方来源

- [Polars：从 Pandas 迁移](https://docs.pola.rs/user-guide/migration/pandas/)
- [Polars：表达式与上下文](https://docs.pola.rs/user-guide/concepts/expressions-and-contexts/)
- [Polars：Lazy API](https://docs.pola.rs/user-guide/concepts/lazy-api/)
- [Polars：与外部库交互](https://docs.pola.rs/user-guide/misc/arrow/)
