---
title: dbt Jinja 与宏 - 让 SQL 具备编程能力
tags:
  - dbt
  - Jinja
  - 宏
  - macro
  - 代码复用
  - dbt-utils
  - DRY原则
aliases:
  - dbt宏
  - dbt Jinja
  - Jinja模板
date: 2026-03-18
difficulty: 中级
duration: 25分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据分析师
  - BI分析师
  - 数据架构师
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


# dbt Jinja 与宏 - 让 SQL 具备编程能力

> [!abstract] 本文核心
> SQL 主要用于声明式查询，本身支持函数；变量与过程控制能力因数据库及其过程语言而异。Jinja 在 dbt 编译阶段提供变量、条件、循环和宏，用来生成 SQL。
> dbt 的宏（Macro）系统让你能把重复的 SQL 逻辑封装成可复用的函数，践行 DRY 原则。

---

## 为什么需要 Jinja

假设你有 15 个不同数据源，每个源都需要做同样的清洗逻辑：

```sql
-- stg_shopify__orders.sql
SELECT
    id AS order_id,
    LOWER(TRIM(status)) AS status,
    ROUND(amount * 100)::BIGINT AS amount_cents,
    ...

-- stg_amazon__orders.sql
SELECT
    order_id,
    LOWER(TRIM(status)) AS status,
    ROUND(amount * 100)::BIGINT AS amount_cents,
    ...

-- stg_wechat__orders.sql
-- 又是一样的逻辑...
```

每次修改逻辑，需要改 15 个文件。这就是 Jinja 宏要解决的问题：**把重复的 SQL 逻辑封装成一个宏，一处定义，处处引用**。

---

## Jinja 基础语法

dbt 使用 [Jinja2](https://jinja.palletsprojects.com/) 模板引擎，有三种基本语法：

```json
{{ expression }}    # 输出表达式的值（变量、函数调用等）
{% statement %}     # 执行语句（if/for/set 等，不输出内容）
{# comment #}       # 注释（不输出到最终 SQL）
```

### 变量

```sql
-- 在 SQL 文件中使用 Jinja 变量
{% set start_date = '2024-01-01' %}
{% set end_date = '2024-12-31' %}

SELECT *
FROM {{ ref('fct_orders') }}
WHERE order_date BETWEEN '{{ start_date }}' AND '{{ end_date }}'
```

编译后的 SQL：
```sql
SELECT *
FROM analytics.fct_orders
WHERE order_date BETWEEN '2024-01-01' AND '2024-12-31'
```

### 条件语句

```sql
-- 根据 target（dev/prod）改变行为
SELECT
    order_id,
    customer_id,
    total_price_cents
FROM {{ ref('stg_orders') }}

{% if target.name == 'dev' %}
    -- 开发环境只取最近 30 天数据，加快查询速度
    WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
{% elif target.name == 'prod' %}
    -- 生产环境取 2020-01-01 起的数据；若需全量，应按业务范围调整或移除此过滤条件
    WHERE created_at >= '2020-01-01'
{% endif %}
```

> [!tip] target 变量
> `target.name` 返回当前使用的 target 名称（在 profiles.yml 中定义）。
> 其他有用的 target 属性：`target.schema`、`target.database`、`target.type`（数据库类型）

### 循环

```sql
-- 生成多个 UNION ALL（不同状态的聚合）
{% set statuses = ['pending', 'paid', 'refunded', 'cancelled'] %}

{% for status in statuses %}
SELECT
    '{{ status }}'  AS status,
    COUNT(*)        AS order_count,
    SUM(total_price_cents) AS total_cents
FROM {{ ref('fct_orders') }}
WHERE financial_status = '{{ status }}'

{% if not loop.last %}
UNION ALL
{% endif %}
{% endfor %}
```

---

## 自定义宏（Macro）

宏是 dbt 中的"函数"——接收参数，返回 SQL 片段。

### 创建宏

```sql
-- macros/cents_to_dollars.sql
-- 宏：把分转换为元（带格式化）

{% macro cents_to_dollars(column_name, decimal_places=2) %}
    ROUND({{ column_name }} / 100.0, {{ decimal_places }})
{% endmacro %}
```

### 调用宏

```sql
-- models/marts/core/fct_orders.sql

SELECT
    order_id,
    customer_id,
    total_price_cents,
    -- 调用宏，生成可读的金额字段
    {{ cents_to_dollars('total_price_cents') }}    AS total_price,
    {{ cents_to_dollars('total_price_cents', 0) }} AS total_price_rounded

FROM {{ ref('stg_orders') }}
```

编译后的 SQL：
```sql
SELECT
    order_id,
    customer_id,
    total_price_cents,
    ROUND(total_price_cents / 100.0, 2)  AS total_price,
    ROUND(total_price_cents / 100.0, 0)  AS total_price_rounded
FROM analytics.stg_orders
```

### 实用宏示例：动态日期截断

```sql
-- macros/date_spine.sql
-- 宏：生成一系列时间维度字段

{% macro date_dimensions(date_column) %}
    {{ date_column }}                                  AS raw_date,
    DATE_TRUNC('day', {{ date_column }})               AS date_day,
    DATE_TRUNC('week', {{ date_column }})              AS date_week,
    DATE_TRUNC('month', {{ date_column }})             AS date_month,
    DATE_TRUNC('quarter', {{ date_column }})           AS date_quarter,
    DATE_TRUNC('year', {{ date_column }})              AS date_year,
    EXTRACT(DOW FROM {{ date_column }})                AS day_of_week,
    EXTRACT(DAY FROM {{ date_column }})                AS day_of_month,
    TO_CHAR({{ date_column }}, 'YYYY-MM')              AS year_month
{% endmacro %}
```

使用：

```sql
-- models/marts/fct_orders.sql

SELECT
    order_id,
    {{ date_dimensions('created_at') }},
    total_price_cents
FROM {{ ref('stg_orders') }}
```

### 实用宏示例：安全除法与代理键

以下宏展示安全除法和多字段拼接哈希。它们不提供日期函数适配；函数支持、类型转换及 NULL 处理需按目标数据库确认。

```sql
-- macros/safe_divide.sql
-- 安全除法：分母为零时返回 NULL；表达式类型与数据库适用性需按目标环境确认

{% macro safe_divide(numerator, denominator) %}
    CASE
        WHEN ({{ denominator }}) = 0 THEN NULL
        ELSE ({{ numerator }}) * 1.0 / ({{ denominator }})
    END
{% endmacro %}
```

```sql
-- macros/generate_surrogate_key.sql
-- 生成代理键（将多个字段拼接哈希）

{% macro generate_surrogate_key(field_list) %}
    MD5(CONCAT_WS('|',
        {% for field in field_list %}
            CAST({{ field }} AS TEXT)
            {% if not loop.last %}, {% endif %}
        {% endfor %}
    ))
{% endmacro %}
```

使用：

```sql
SELECT
    {{ generate_surrogate_key(['order_id', 'item_id']) }} AS surrogate_key,
    order_id,
    item_id,
    quantity,
    {{ safe_divide('amount_cents', 'quantity') }} AS unit_price_cents
FROM {{ ref('stg_order_items') }}
```

---

## 常用内置宏

dbt 提供了一些非常有用的内置宏：

### var()：读取项目变量

```yaml
# dbt_project.yml
vars:
  start_date: '2024-01-01'
  payment_methods: ['credit_card', 'alipay', 'wechat_pay']
  is_test_run: false
```

```sql
-- models/fct_orders.sql

{% set payment_methods = var('payment_methods') %}

SELECT
    order_id,
    {% for method in payment_methods %}
    SUM(CASE WHEN payment_method = '{{ method }}' THEN amount_cents END)
        AS {{ method }}_amount_cents
    {% if not loop.last %},{% endif %}
    {% endfor %}
FROM {{ ref('stg_orders') }}
WHERE created_at >= '{{ var("start_date") }}'
GROUP BY order_id

{% if var('is_test_run', default=false) %}
LIMIT 100
{% endif %}
```

命令行覆盖变量：

```bash
# 临时覆盖变量值
dbt run --vars '{"start_date": "2024-06-01", "is_test_run": true}'
```

### env_var()：读取环境变量

```sql
-- 在 SQL 中读取环境变量
SELECT *
FROM {{ ref('stg_orders') }}
WHERE shop_id = '{{ env_var("SHOP_ID") }}'
```

### run_query()：在宏中执行 SQL 查询

```sql
-- macros/get_column_values.sql
-- 宏：动态获取某列的所有唯一值

{% macro get_column_values(table, column) %}
    {% set query %}
        SELECT DISTINCT {{ column }}
        FROM {{ table }}
        ORDER BY 1
    {% endset %}

    {% set results = run_query(query) %}
    {% if execute %}
        {% set values = results.columns[0].values() %}
        {{ return(values) }}
    {% endif %}
{% endmacro %}
```

---

## 包管理（packages.yml）

dbt 包是可复用的宏和模型集合，类似 Python 的 pip 包：

### 安装包

```yaml
# packages.yml（项目根目录）

packages:
  # dbt 官方出品的实用工具包（必装）
  - package: dbt-labs/dbt_utils
    version: [">=1.0.0", "<2.0.0"]

  # 丰富的数据质量测试（强烈推荐）
  - package: calogica/dbt_expectations
    version: [">=0.10.0", "<0.11.0"]

  # 日期维度表生成
  - package: dbt-labs/dbt_date
    version: [">=0.10.0", "<0.11.0"]

  # 数据审计比较（用于比较关系或查询结果，不会自动添加元数据列）
  - package: dbt-labs/audit_helper
    version: [">=0.9.0", "<0.10.0"]
```

```bash
# 安装包
dbt deps
```

### dbt-utils 核心功能

`dbt-utils` 是最常用的 dbt 扩展包：

```sql
-- 1. generate_surrogate_key：生成代理键
SELECT
    {{ dbt_utils.generate_surrogate_key(['order_id', 'item_id']) }} AS sk,
    order_id,
    item_id
FROM {{ ref('stg_order_items') }}


-- 2. star：SELECT 全部列并排除某些列（解决 SELECT * 的问题）
SELECT
    {{ dbt_utils.star(from=ref('stg_orders'), except=["internal_notes", "_fivetran_synced"]) }}
FROM {{ ref('stg_orders') }}


-- 3. pivot：生成行转列的聚合表达式；此例汇总整张支付表
SELECT
    {{ dbt_utils.pivot(
        column='payment_method',
        values=dbt_utils.get_column_values(ref('stg_payments'), 'payment_method'),
        agg='SUM',
        then_value='amount_cents'
    ) }}
FROM {{ ref('stg_payments') }}


-- 4. date_spine：生成日期序列（用于日期维度表）
{{ dbt_utils.date_spine(
    datepart="day",
    start_date="cast('2020-01-01' as date)",
    end_date="cast('2025-12-31' as date)"
) }}
```

```yaml
# 在测试中使用 dbt-utils

models:
  - name: fct_orders
    tests:
      # 组合唯一性（多字段联合唯一）
      - dbt_utils.unique_combination_of_columns:
          combination_of_columns:
            - order_id
            - item_id

      # 数据新鲜度测试（检查 created_at 的最新值是否在近 24 小时内）
      - dbt_utils.recency:
          datepart: hour
          field: created_at
          interval: 24

      # 表间相同列比较
      - dbt_utils.equality:
          compare_model: ref('fct_orders_v2')
          compare_columns:
            - order_id
            - total_price_cents
```

---

## DRY 原则在 dbt 中的实践

DRY（Don't Repeat Yourself）是软件工程的基本原则：**同一段逻辑只写一次**。

### 反例：重复的业务逻辑

```sql
-- fct_orders.sql
CASE
    WHEN order_count = 0 THEN 'no_orders'
    WHEN order_count = 1 THEN 'new'
    WHEN order_count BETWEEN 2 AND 5 THEN 'repeat'
    ELSE 'loyal'
END AS customer_segment

-- fct_customer_monthly.sql
CASE
    WHEN order_count = 0 THEN 'no_orders'
    WHEN order_count = 1 THEN 'new'
    WHEN order_count BETWEEN 2 AND 5 THEN 'repeat'
    ELSE 'loyal'
END AS customer_segment

-- 如果分层逻辑变了，需要改两处（很容易遗漏）
```

### 正例：用宏封装

```sql
-- macros/customer_segment.sql

{% macro get_customer_segment(order_count_column) %}
    CASE
        WHEN {{ order_count_column }} = 0 THEN 'no_orders'
        WHEN {{ order_count_column }} = 1 THEN 'new'
        WHEN {{ order_count_column }} BETWEEN 2 AND 5 THEN 'repeat'
        ELSE 'loyal'
    END
{% endmacro %}
```

使用：

```sql
-- fct_orders.sql
SELECT
    order_id,
    {{ get_customer_segment('lifetime_order_count') }} AS customer_segment

-- fct_customer_monthly.sql
SELECT
    customer_id,
    {{ get_customer_segment('monthly_order_count') }} AS customer_segment
```

**修改逻辑时只改宏定义一处，所有引用自动更新。**

---

## 调试 Jinja

在 dbt 中调试 Jinja 的技巧：

```bash
# 查看 Jinja 编译后的 SQL
dbt compile --select my_model
cat target/compiled/my_project/models/my_model.sql

# 在宏中打印调试信息
{% do log("Debug: variable = " ~ my_variable, info=True) %}
```

---

## 总结

| 概念 | 作用 | 示例 |
|------|------|------|
| `{{ }}` | 输出表达式 | `{{ ref('stg_orders') }}` |
| `{% %}` | 执行逻辑 | `{% if target.name == 'dev' %}` |
| 宏（Macro） | 封装可复用的 SQL 逻辑 | `{{ cents_to_dollars('amount') }}` |
| var() | 读取项目变量 | `{{ var('start_date') }}` |
| dbt-utils | 常用工具包 | `{{ dbt_utils.generate_surrogate_key([...]) }}` |
| packages.yml | 管理外部依赖 | `dbt deps` 安装 |

---

## 下一步

[[【技术与工具】/dbt/09-Seeds与Snapshots]] - 用 seed 管理配置表，用 snapshot 实现历史数据追踪（SCD Type 2）

---

*最后更新：2026-03-18*

#dbt #Jinja #宏 #代码复用 #dbt-utils #DRY原则

---

> [!info] 前置知识
> - 掌握基础 dbt Model 的写法，参考 [[【技术与工具】/dbt/03-Model基础|dbt Model 基础]]
> - 了解 Jinja2 模板语言的基本语法（`{{ }}`、`{% %}`）
> - 熟悉 Python 的函数定义概念（宏本质上是可复用的函数）

---

## 掌握检查

- [ ] 能在 dbt Model 中使用 `{% if target.name == 'dev' %}` 条件语句，实现开发环境只处理近 7 天数据的效果
- [ ] 能写一个简单的宏函数（如"金额分转元的除法"），并在多个模型中通过 `{{ cents_to_dollars('amount') }}` 调用
- [ ] 知道 `dbt compile --select 模型名` 的作用，以及在哪个目录找到编译后的 SQL 来调试 Jinja 问题
- [ ] 能用 `dbt-utils` 的 `generate_surrogate_key()` 生成代理键，以及用 `star()` 实现排除特定列的 SELECT
- [ ] 理解 `var()` 和 `env_var()` 的区别：前者从 `dbt_project.yml` 或命令行读取，后者读取操作系统环境变量

---

## 实践练习

**基础题**：你的项目中有 3 个模型都需要把金额从"分"转成"元"（除以 100）。把这个逻辑写成一个宏 `cents_to_dollars(column_name)`，放在 `macros/` 目录，然后在这 3 个模型中替换掉重复的除法表达式。运行 `dbt compile` 验证宏展开后的 SQL 正确。

**进阶题**：用 Jinja 实现一个"环境感知"的数据过滤宏：在 dev 环境只处理过去 30 天的数据（加速开发调试），在 prod 环境处理全量数据。在 fct_orders 模型中使用这个宏，运行 `dbt run --target dev` 和 `--target prod` 对比执行结果。
