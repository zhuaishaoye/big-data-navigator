---
title: DuckDB Python集成与数据交换
tags:
  - DuckDB
  - Python
  - Pandas
  - Polars
  - Arrow
aliases:
  - DuckDB Python API
  - DuckDB数据交换
created: 2026-08-16
updated: 2026-10-10
duration: 50分钟
difficulty: 中级
status: maintenance
knowledge_type: technical-practice
stability: fast-changing
last_verified: 2026-08-16
next_review: 2026-11-16
applies_to:
  - DuckDB Python client
  - Python 3.9+
source_level: primary
sources:
  - https://duckdb.org/docs/current/clients/python/overview
  - https://duckdb.org/docs/current/clients/python/conversion
  - https://duckdb.org/docs/current/clients/python/dbapi
target_audience:
  - 数据分析师
  - 数据开发工程师
  - 数据科学家
  - BI分析师
access_tier: free
---


# DuckDB Python集成与数据交换

> [!abstract] 学习目标
> 建立显式连接，在 Python 中参数化执行 SQL，并根据消费方选择 Pandas、Polars、Arrow 或分批结果；避免默认连接、隐式复制和过早物化带来的问题。

DuckDB 的 Python 客户端把 SQL 引擎嵌入当前进程。它既能查询文件，也能识别 Python 作用域中的 DataFrame。建议先完成 [[【技术与工具】/DuckDB/01-直接查询文件与SQL实践|直接查询文件与SQL实践]]，并用 [[【技术与工具】/Python/41-从Pandas到Polars与DuckDB|从Pandas到Polars与DuckDB]] 建立整体选择框架。

## 1. 安装与连接生命周期

```bash
python -m pip install duckdb pandas polars pyarrow
```

```python
import duckdb

with duckdb.connect("analytics.duckdb") as con:
    answer = con.execute("SELECT 42 AS answer").fetchone()
    print(answer)
```

预期输出 `(42,)`，并在当前目录创建持久化数据库文件。探索代码可以使用内存数据库；应用代码更适合显式传递连接，便于控制数据库路径、只读模式、配置与关闭时机。

> [!warning]
> 模块级便捷函数通常使用默认连接。多测试、多线程或多租户场景若隐式共享状态，会让临时表、配置和事务边界难以判断。

## 2. 参数化执行，而不是拼字符串

```python
sql = """
SELECT pay_date, SUM(amount) AS gmv
FROM read_parquet(?)
WHERE status = ? AND pay_date >= ?
GROUP BY pay_date
ORDER BY pay_date
"""

with duckdb.connect() as con:
    rows = con.execute(
        sql,
        ["orders.parquet", "paid", "2026-08-01"],
    ).fetchall()
```

参数化查询能把数据值和 SQL 结构分开，降低注入风险，也避免手工处理引号。表名、列名等标识符通常不能当普通参数传入；必须动态生成时，应使用受控白名单而非原样拼接用户输入。

## 3. 查询 Pandas、Polars 与 Arrow

```python
import duckdb
import pandas as pd

orders_df = pd.DataFrame(
    {
        "status": ["paid", "cancelled", "paid"],
        "amount": [99.0, 30.0, 120.0],
    }
)

with duckdb.connect() as con:
    result = con.sql("""
        SELECT status, SUM(amount) AS amount
        FROM orders_df
        GROUP BY status
        ORDER BY status
    """).df()

print(result)
```

预期有两行：`cancelled=30.0`、`paid=219.0`。DuckDB 的 replacement scan 能发现作用域中的 DataFrame，但这种便利依赖变量名和作用域；长期代码可显式 `register`，让依赖更清楚。

```python
with duckdb.connect() as con:
    con.register("orders_input", orders_df)
    relation = con.sql("SELECT * FROM orders_input WHERE status = 'paid'")
    pandas_result = relation.df()
    polars_result = relation.pl()
    arrow_result = relation.arrow()
```

这里的关键不是“哪个格式最快”，而是下游真正需要什么。已有 Pandas 可视化链路用 `.df()`；Polars 转换链路用 `.pl()`；跨语言、列式交换或写 Parquet 可优先 Arrow。相关基础见 [[【技术与工具】/Python/09-Pandas数据结构|Pandas数据结构]] 与 [[【技术与工具】/Polars/01-表达式与常用数据操作|Polars表达式与常用数据操作]]。

## 4. 延迟关系与结果物化

`con.sql()` 返回关系对象，可继续投影、过滤和聚合。创建关系不代表数据已经全部进入 Python；`.fetchall()`、`.df()` 和 `.pl()` 会执行查询并将结果转换为对应的 Python 对象，`.show()` 用于执行并展示结果。`.arrow()` 的返回类型应按所用 DuckDB 版本确认：若返回 Arrow 批次读取器，获取读取器不等于已完整消费或物化全部结果，后续迭代读取与 `read_all()` 的内存开销也不同。

```python
with duckdb.connect() as con:
    rel = con.read_parquet("orders.parquet")
    paid = rel.filter("status = 'paid'").project("pay_date, amount")
    print(paid.limit(5).df())
```

边界在于最终结果仍可能超过内存。应先聚合、过滤、抽样或直接 `COPY` 到文件；不要把“DuckDB 能扫描大文件”误解为“`.df()` 能容纳任意大结果”。

## 5. 类型与空值边界

Python、DuckDB、Pandas、Polars、Arrow 的类型集合不同。重点验证：

- `DECIMAL` 转换后是否仍保留精度；
- 带时区与不带时区时间戳是否符合业务口径；
- nullable integer 是否被转成浮点；
- `NULL`、`NaN` 与 `NaT` 是否被混淆；
- list、struct 等嵌套类型的下游支持情况。

可以把 schema 断言纳入测试，而不是只比较行数。数据清洗原则可参考 [[【技术与工具】/Python/11-Pandas数据清洗|Pandas数据清洗]]。

## 6. 并发与状态管理

同一 Python 进程可以使用多连接，但线程安全、写入并发和事务策略必须按官方并发说明设计。常见做法是每个工作线程创建独立 cursor 或连接，并避免多个进程同时写同一个数据库文件。分析服务若需要高并发、多用户写入，应重新评估是否应使用服务型数据库。

## 7. 练习与验收

1. 用参数化 SQL 查询一个日期区间，并验证恶意字符串不会改变 SQL 结构。
2. 把同一结果分别转成 Pandas、Polars、Arrow，比较 schema、空值和金额精度。
3. 构造百万行关系，只取聚合结果，观察与直接 `.df()` 全量物化的差异。
4. 写一个函数，接收显式连接而非调用全局默认连接，并为临时表生命周期写测试。

完成后继续 [[【技术与工具】/DuckDB/03-性能优化与扩展管理|性能优化与扩展管理]]；如果希望把表达式切换到不同后端，阅读 [[【技术与工具】/Ibis/01-表达式与延迟执行|Ibis表达式与延迟执行]] 与 [[【技术与工具】/Ibis/02-后端连接与数据读写|Ibis后端连接与数据读写]]。

## 8. 延伸阅读

- [[【技术与工具】/Polars/00-Polars学习路线图|Polars学习路线图]]
- [[【技术与工具】/Polars/02-Lazy执行与性能优化|Polars Lazy执行与性能优化]]
- [[【技术与工具】/Polars/03-从Pandas迁移到Polars|从Pandas迁移到Polars]]
- [[【技术与工具】/Ibis/00-Ibis学习路线图|Ibis学习路线图]]
- [[【技术与工具】/Ibis/03-跨后端迁移与测试|Ibis跨后端迁移与测试]]
- [[【技术与工具】/Python/10-Pandas数据操作|Pandas数据操作]]
- [[【技术与工具】/Python/12-数据读取与存储|Python数据读取与存储]]
- [[【技术与工具】/Python/36-Python数据工程与大数据|Python数据工程与大数据]]
- [[【技术与工具】/SQL/00-SQL学习路线图|SQL学习路线图]]
- [[【技术与工具】/SQL/33-AI时代分析SQL实战|AI时代分析SQL实战]]

## 官方来源

- [DuckDB Python API](https://duckdb.org/docs/current/clients/python/overview)
- [DuckDB 与 Python 之间的类型转换](https://duckdb.org/docs/current/clients/python/conversion)
- [DuckDB Python DB API](https://duckdb.org/docs/current/clients/python/dbapi)
- [DuckDB Python 多线程指南](https://duckdb.org/docs/current/guides/python/multiple_threads)
