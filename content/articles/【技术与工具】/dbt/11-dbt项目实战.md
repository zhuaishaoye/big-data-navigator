---
title: dbt 项目实战 - 电商数据仓库完整构建
tags:
  - dbt
  - 项目实战
  - 电商数仓
  - 数据建模
  - 端到端
aliases:
  - dbt实战
  - dbt电商案例
  - dbt完整项目
date: 2026-03-18
difficulty: 高级
duration: 60分钟
knowledge_type: project
target_audience:
  - 数据开发工程师
  - 数据架构师
  - BI分析师
  - 有完整 dbt 项目运行经验的数据分析师
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


# dbt 项目实战 - 电商数据仓库完整构建

> [!abstract] 实战项目说明
> 本文通过一个电商数据仓库项目骨架，把前面学的所有知识串联起来；完整运行仍需补齐缺失材料并处理维护说明中的适用边界。
> **场景**：某电商平台的数据分析团队，需要构建一个可靠的数据仓库，支撑 BI 报表和用户画像分析。
> **覆盖**：source 定义 → staging 清洗 → intermediate 关联 → marts 聚合 → 测试 → 文档

---

## 项目背景

某电商平台有以下原始数据：

| 数据库 | 表 | 描述 |
|--------|-----|------|
| shopify | orders | 订单主表 |
| shopify | order_items | 订单商品明细 |
| shopify | customers | 客户信息 |
| shopify | products | 产品信息 |
| stripe | payments | 支付记录 |

**业务分析需求**：
1. 每日/每月 GMV 和订单量
2. 客户分层（新客、回客、高价值客户）
3. 产品品类销售分析
4. 支付方式分布

---

## 第一步：项目初始化

```bash
# 创建项目
dbt init ecommerce_analytics
cd ecommerce_analytics

# 创建目录结构
mkdir -p models/staging/shopify
mkdir -p models/staging/stripe
mkdir -p models/intermediate
mkdir -p models/marts/core
mkdir -p models/marts/finance
mkdir -p seeds
mkdir -p snapshots
mkdir -p macros
```

### dbt_project.yml 配置

```yaml
# dbt_project.yml

name: 'ecommerce_analytics'
version: '1.0.0'
config-version: 2

profile: 'ecommerce_analytics'

model-paths: ["models"]
seed-paths: ["seeds"]
test-paths: ["tests"]
macro-paths: ["macros"]
snapshot-paths: ["snapshots"]

target-path: "target"
clean-targets: ["target", "dbt_packages"]

vars:
  # 数据起始日期（控制历史数据加载范围）
  data_start_date: '2022-01-01'
  # 测试环境只处理最近 30 天
  is_test_run: false

models:
  ecommerce_analytics:
    staging:
      +materialized: view
      +schema: staging
    intermediate:
      +materialized: view
      +schema: intermediate
    marts:
      +materialized: table
      core:
        +schema: core
      finance:
        +schema: finance
```

### packages.yml

```yaml
# packages.yml

packages:
  - package: dbt-labs/dbt_utils
    version: [">=1.2.0", "<2.0.0"]
  - package: calogica/dbt_expectations
    version: [">=0.10.0", "<0.11.0"]
```

```bash
dbt deps
```

---

## 第二步：定义数据源（Source）

```yaml
# models/staging/shopify/_shopify_sources.yml

version: 2

sources:
  - name: shopify
    description: "Shopify 电商平台原始数据，通过 Fivetran 同步"
    database: raw_db
    schema: shopify_raw
    loaded_at_field: _fivetran_synced

    freshness:
      warn_after: {count: 6, period: hour}
      error_after: {count: 24, period: hour}

    tables:
      - name: orders
        description: "Shopify 订单表，一行代表一个订单"
        freshness:
          warn_after: {count: 2, period: hour}    # 订单数据要求更高的新鲜度
        columns:
          - name: id
            tests: [unique, not_null]
          - name: created_at
            tests: [not_null]

      - name: order_items
        description: "订单商品明细，一行代表一个订单的一个商品"
        columns:
          - name: id
            tests: [unique, not_null]

      - name: customers
        description: "客户基础信息"
        columns:
          - name: id
            tests: [unique, not_null]

      - name: products
        description: "产品信息"
        columns:
          - name: id
            tests: [unique, not_null]
```

```yaml
# models/staging/stripe/_stripe_sources.yml

version: 2

sources:
  - name: stripe
    description: "Stripe 支付平台数据"
    database: raw_db
    schema: stripe_raw
    loaded_at_field: _fivetran_synced
    freshness:
      warn_after: {count: 6, period: hour}

    tables:
      - name: payments
        description: "Stripe 支付记录"
        columns:
          - name: id
            tests: [unique, not_null]
```

---

## 第三步：Staging 层（数据清洗）

### 订单 Staging

```sql
-- models/staging/shopify/stg_shopify__orders.sql

WITH source AS (
    SELECT * FROM {{ source('shopify', 'orders') }}
),

renamed AS (
    SELECT
        -- 主键
        id                                          AS order_id,

        -- 外键
        customer_id,

        -- 日期
        CAST(created_at AS TIMESTAMP)               AS created_at,
        CAST(updated_at AS TIMESTAMP)               AS updated_at,
        CAST(processed_at AS DATE)                  AS processed_date,
        CAST(cancelled_at AS TIMESTAMP)             AS cancelled_at,

        -- 金额（统一为分）
        ROUND(total_price::NUMERIC * 100)::BIGINT   AS total_price_cents,
        ROUND(subtotal_price::NUMERIC * 100)::BIGINT AS subtotal_price_cents,
        ROUND(total_discounts::NUMERIC * 100)::BIGINT AS total_discounts_cents,
        ROUND(total_tax::NUMERIC * 100)::BIGINT     AS total_tax_cents,
        ROUND(total_shipping::NUMERIC * 100)::BIGINT AS total_shipping_cents,

        -- 状态（标准化）
        LOWER(TRIM(financial_status))               AS financial_status,
        LOWER(TRIM(fulfillment_status))             AS fulfillment_status,
        LOWER(TRIM(cancel_reason))                  AS cancel_reason,

        -- 地址
        LOWER(TRIM(shipping_address_country_code))  AS shipping_country_code,
        LOWER(TRIM(billing_address_country_code))   AS billing_country_code,

        -- 来源渠道
        LOWER(TRIM(source_name))                    AS source_name,

        -- 元数据
        _fivetran_synced                            AS synced_at

    FROM source
),

filtered AS (
    SELECT *
    FROM renamed
    WHERE order_id IS NOT NULL
      AND financial_status != 'test'

    {% if var('is_test_run', false) %}
    -- 开发模式：只取最近 30 天
    AND created_at >= CURRENT_DATE - INTERVAL '30 days'
    {% else %}
    AND created_at >= '{{ var("data_start_date") }}'
    {% endif %}
)

SELECT * FROM filtered
```

### 订单明细 Staging

```sql
-- models/staging/shopify/stg_shopify__order_items.sql

WITH source AS (
    SELECT * FROM {{ source('shopify', 'order_items') }}
),

renamed AS (
    SELECT
        id                                          AS order_item_id,
        order_id,
        product_id,
        variant_id,

        -- 字符串标准化
        LOWER(TRIM(name))                           AS product_name,
        LOWER(TRIM(sku))                            AS sku,

        -- 数量和价格
        quantity::INTEGER                           AS quantity,
        ROUND(price::NUMERIC * 100)::BIGINT         AS unit_price_cents,
        ROUND(total_discount::NUMERIC * 100)::BIGINT AS item_discount_cents,

        -- 计算行小计（折后价格）
        ROUND(
            (price::NUMERIC * quantity - total_discount::NUMERIC) * 100
        )::BIGINT                                   AS line_total_cents,

        -- 是否赠品
        (gift_card = 'true')::BOOLEAN               AS is_gift_card,
        (requires_shipping = 'true')::BOOLEAN       AS requires_shipping

    FROM source
)

SELECT * FROM renamed
```

### 客户 Staging

```sql
-- models/staging/shopify/stg_shopify__customers.sql

WITH source AS (
    SELECT * FROM {{ source('shopify', 'customers') }}
),

renamed AS (
    SELECT
        id                                          AS customer_id,

        -- 基础信息
        LOWER(TRIM(email))                          AS email,
        TRIM(first_name)                            AS first_name,
        TRIM(last_name)                             AS last_name,
        first_name || ' ' || last_name              AS full_name,
        phone,

        -- 状态
        (accepts_marketing = 'true')::BOOLEAN       AS accepts_marketing,
        (tax_exempt = 'true')::BOOLEAN              AS is_tax_exempt,
        LOWER(TRIM(state))                          AS account_state,

        -- 时间
        CAST(created_at AS TIMESTAMP)               AS created_at,
        CAST(updated_at AS TIMESTAMP)               AS updated_at

    FROM source
)

SELECT * FROM renamed
```

### Staging 层测试配置

```yaml
# models/staging/shopify/_stg_shopify_models.yml

version: 2

models:
  - name: stg_shopify__orders
    description: "Shopify 订单清洗层"
    columns:
      - name: order_id
        tests: [unique, not_null]
      - name: financial_status
        tests:
          - accepted_values:
              values: ['pending', 'authorized', 'paid', 'partially_paid',
                       'refunded', 'partially_refunded', 'voided']
      - name: total_price_cents
        tests:
          - not_null
          - dbt_expectations.expect_column_values_to_be_between:
              min_value: 0
              max_value: 100000000

  - name: stg_shopify__order_items
    description: "Shopify 订单明细清洗层"
    columns:
      - name: order_item_id
        tests: [unique, not_null]
      - name: order_id
        tests:
          - not_null
          - relationships:
              to: ref('stg_shopify__orders')
              field: order_id

  - name: stg_shopify__customers
    description: "Shopify 客户清洗层"
    columns:
      - name: customer_id
        tests: [unique, not_null]
      - name: email
        tests: [not_null]
```

---

## 第四步：Intermediate 层（业务逻辑关联）

```sql
-- models/intermediate/int_order_items_enriched.sql
-- 把订单明细和产品、订单信息关联，形成富化后的行级数据

WITH order_items AS (
    SELECT * FROM {{ ref('stg_shopify__order_items') }}
),

orders AS (
    SELECT
        order_id,
        customer_id,
        created_at      AS order_created_at,
        financial_status,
        shipping_country_code
    FROM {{ ref('stg_shopify__orders') }}
),

final AS (
    SELECT
        oi.order_item_id,
        oi.order_id,
        oi.product_id,
        oi.sku,
        oi.product_name,

        -- 来自 orders 的信息
        o.customer_id,
        o.order_created_at,
        o.financial_status,
        o.shipping_country_code,

        -- 明细度量
        oi.quantity,
        oi.unit_price_cents,
        oi.item_discount_cents,
        oi.line_total_cents,
        oi.is_gift_card,
        oi.requires_shipping,

        -- 派生字段
        (oi.item_discount_cents > 0)    AS has_discount,
        CASE
            WHEN oi.item_discount_cents > 0
            THEN oi.item_discount_cents * 1.0 / NULLIF(oi.unit_price_cents * oi.quantity, 0)
            ELSE 0
        END                             AS discount_rate

    FROM order_items oi
    LEFT JOIN orders o ON oi.order_id = o.order_id
)

SELECT * FROM final
```

---

## 第五步：Marts 层（最终数据产品）

### 订单事实表

```sql
-- models/marts/core/fct_orders.sql

{{ config(
    materialized='incremental',
    unique_key='order_id',
    incremental_strategy='merge'
) }}

WITH orders AS (
    SELECT * FROM {{ ref('stg_shopify__orders') }}
),

order_item_aggregates AS (
    -- 把订单明细聚合到订单粒度
    SELECT
        order_id,
        COUNT(DISTINCT product_id)                      AS unique_products,
        SUM(quantity)                                   AS total_items,
        SUM(line_total_cents)                           AS items_subtotal_cents,
        SUM(item_discount_cents)                        AS total_item_discounts_cents,
        BOOL_OR(is_gift_card)                           AS has_gift_card,
        BOOL_OR(requires_shipping)                      AS requires_shipping
    FROM {{ ref('stg_shopify__order_items') }}
    GROUP BY order_id
),

-- 识别首单
customer_first_order AS (
    SELECT
        customer_id,
        created_at AS first_order_at,
        order_id AS first_order_id
    FROM (
        SELECT
            customer_id,
            created_at,
            order_id,
            ROW_NUMBER() OVER (
                PARTITION BY customer_id
                ORDER BY created_at, order_id
            ) AS order_rank
        FROM {{ ref('stg_shopify__orders') }}
        WHERE financial_status IN ('paid', 'partially_paid')
    ) ranked_orders
    WHERE order_rank = 1
),

final AS (
    SELECT
        -- 主键
        o.order_id,

        -- 外键
        o.customer_id,

        -- 时间维度
        o.created_at,
        o.processed_date,
        DATE_TRUNC('week', o.created_at)::DATE      AS order_week,
        DATE_TRUNC('month', o.created_at)::DATE     AS order_month,
        DATE_TRUNC('quarter', o.created_at)::DATE   AS order_quarter,

        -- 状态
        o.financial_status,
        o.fulfillment_status,
        o.shipping_country_code,
        o.source_name,

        -- 度量值
        o.total_price_cents,
        o.subtotal_price_cents,
        o.total_discounts_cents,
        o.total_tax_cents,
        o.total_shipping_cents,
        COALESCE(oia.unique_products, 0)            AS unique_products,
        COALESCE(oia.total_items, 0)                AS total_items,

        -- 布尔标志
        (o.order_id = cfo.first_order_id)           AS is_first_order,
        COALESCE(oia.has_gift_card, FALSE)          AS has_gift_card,
        (o.cancelled_at IS NOT NULL)                AS is_cancelled

    FROM orders o
    LEFT JOIN order_item_aggregates oia ON o.order_id = oia.order_id
    LEFT JOIN customer_first_order cfo ON o.customer_id = cfo.customer_id

    {% if is_incremental() %}
    WHERE o.updated_at > (SELECT MAX(created_at) - INTERVAL '3 days' FROM {{ this }})
    {% endif %}
)

SELECT * FROM final
```

### 客户维度表

```sql
-- models/marts/core/dim_customers.sql

{{ config(materialized='table') }}

WITH customers AS (
    SELECT * FROM {{ ref('stg_shopify__customers') }}
),

-- 聚合每个客户的订单指标
customer_orders AS (
    SELECT
        customer_id,
        COUNT(*)                                        AS total_orders,
        COUNT(*) FILTER (WHERE financial_status = 'paid') AS paid_orders,
        SUM(total_price_cents) FILTER (WHERE financial_status = 'paid') AS lifetime_value_cents,
        MIN(created_at)                                 AS first_order_at,
        MAX(created_at)                                 AS most_recent_order_at,
        BOOL_OR(is_first_order)                        AS has_made_first_order
    FROM {{ ref('fct_orders') }}
    GROUP BY customer_id
),

final AS (
    SELECT
        c.customer_id,
        c.email,
        c.first_name,
        c.last_name,
        c.full_name,
        c.phone,
        c.accepts_marketing,
        c.account_state,
        c.created_at                                    AS customer_since,

        -- 订单统计
        COALESCE(co.total_orders, 0)                    AS total_orders,
        COALESCE(co.paid_orders, 0)                     AS paid_orders,
        COALESCE(co.lifetime_value_cents, 0)            AS lifetime_value_cents,
        co.first_order_at,
        co.most_recent_order_at,

        -- 客户分层（引用 seed 规则表）
        COALESCE(t.tier_name, 'new')                    AS customer_tier,
        COALESCE(t.discount_percentage, 0)              AS tier_discount_pct,

        -- 活跃度标志
        CASE
            WHEN co.most_recent_order_at >= CURRENT_DATE - INTERVAL '90 days' THEN 'active'
            WHEN co.most_recent_order_at >= CURRENT_DATE - INTERVAL '365 days' THEN 'at_risk'
            WHEN co.most_recent_order_at IS NOT NULL THEN 'churned'
            ELSE 'never_ordered'
        END                                             AS activity_status

    FROM customers c
    LEFT JOIN customer_orders co ON c.customer_id = co.customer_id
    LEFT JOIN {{ ref('customer_tier_rules') }} t    -- 引用 seed
        ON co.lifetime_value_cents BETWEEN t.min_ltv_cents AND t.max_ltv_cents
)

SELECT * FROM final
```

### 每日收入聚合表

```sql
-- models/marts/finance/fct_daily_revenue.sql

{{ config(
    materialized='incremental',
    unique_key='revenue_date',
    incremental_strategy='delete+insert'
) }}

WITH orders AS (
    SELECT * FROM {{ ref('fct_orders') }}
    WHERE financial_status IN ('paid', 'partially_paid')
      AND NOT is_cancelled
),

daily_aggregated AS (
    SELECT
        processed_date                              AS revenue_date,

        -- 订单量
        COUNT(DISTINCT order_id)                    AS order_count,
        COUNT(DISTINCT customer_id)                 AS unique_customers,
        COUNT(DISTINCT order_id) FILTER (WHERE is_first_order) AS new_customer_orders,

        -- 金额
        SUM(total_price_cents)                      AS gross_revenue_cents,
        SUM(total_discounts_cents)                  AS total_discounts_cents,
        SUM(total_price_cents - total_discounts_cents) AS net_revenue_cents,
        SUM(total_shipping_cents)                   AS shipping_revenue_cents,
        SUM(total_tax_cents)                        AS tax_collected_cents,

        -- 平均值
        AVG(total_price_cents)                      AS avg_order_value_cents,
        AVG(total_items)                            AS avg_items_per_order,

        -- 渠道分布
        SUM(total_price_cents) FILTER (WHERE source_name = 'web')   AS web_revenue_cents,
        SUM(total_price_cents) FILTER (WHERE source_name = 'mobile') AS mobile_revenue_cents

    FROM orders
    GROUP BY processed_date
)

SELECT * FROM daily_aggregated

{% if is_incremental() %}
WHERE revenue_date >= (SELECT MAX(revenue_date) - INTERVAL '7 days' FROM {{ this }})
{% endif %}
```

---

## 第六步：Marts 层测试和文档

```yaml
# models/marts/core/_core_models.yml

version: 2

models:
  - name: fct_orders
    description: |
      **订单事实表**
      每行代表一个订单，包含订单金额、状态、来源和关联的客户信息。
      **粒度**：订单（order_id 唯一）
      **更新频率**：增量，每小时

    tests:
      # 表级：确保数据足够新鲜
      - dbt_expectations.expect_row_values_to_have_recent_data:
          column_name: created_at
          datepart: hour
          interval: 6
          row_condition: "financial_status = 'paid'"

    columns:
      - name: order_id
        description: "订单唯一标识"
        tests: [unique, not_null]

      - name: customer_id
        description: "客户 ID，外键"
        tests:
          - not_null
          - relationships:
              to: ref('dim_customers')
              field: customer_id

      - name: financial_status
        tests:
          - accepted_values:
              values: ['pending', 'authorized', 'paid', 'partially_paid',
                       'refunded', 'partially_refunded', 'voided']

      - name: total_price_cents
        tests:
          - not_null
          - dbt_expectations.expect_column_values_to_be_between:
              min_value: 0

  - name: dim_customers
    description: "客户维度表，包含客户属性和历史聚合指标"
    columns:
      - name: customer_id
        tests: [unique, not_null]
      - name: email
        tests: [not_null]
      - name: customer_tier
        tests:
          - accepted_values:
              values: ['new', 'bronze', 'silver', 'gold', 'platinum']
```

---

## 第七步：Snapshot（历史追踪）

```sql
-- snapshots/snap_customers.sql
-- 追踪客户等级的历史变化

{% snapshot snap_customers %}

{{
    config(
        target_schema='snapshots',
        strategy='check',
        unique_key='customer_id',
        check_cols=['email', 'account_state', 'customer_tier', 'lifetime_value_cents', 'activity_status'],
    )
}}

SELECT
    customer_id,
    email,
    account_state,
    customer_tier,
    lifetime_value_cents,
    activity_status
FROM {{ ref('dim_customers') }}

{% endsnapshot %}
```

---

## 完整的运行序列

```bash
# 1. 安装包
dbt deps

# 2. 检查连接
dbt debug

# 3. 加载 seed
dbt seed

# 4. 检查数据源新鲜度
dbt source freshness

# 5. 全量构建（首次或 --full-refresh）
dbt build --full-refresh

# 6. 查看结果
dbt docs generate
dbt docs serve
```

日常增量运行：

```bash
# 每日例行运行
dbt snapshot && dbt build --fail-fast
```

---

## 项目最终结构

```text
ecommerce_analytics/
├── dbt_project.yml
├── packages.yml
│
├── models/
│   ├── staging/
│   │   ├── shopify/
│   │   │   ├── _shopify_sources.yml
│   │   │   ├── _stg_shopify_models.yml
│   │   │   ├── stg_shopify__orders.sql
│   │   │   ├── stg_shopify__order_items.sql
│   │   │   └── stg_shopify__customers.sql
│   │   └── stripe/
│   │       ├── _stripe_sources.yml
│   │       └── stg_stripe__payments.sql
│   │
│   ├── intermediate/
│   │   ├── _int_models.yml
│   │   └── int_order_items_enriched.sql
│   │
│   └── marts/
│       ├── core/
│       │   ├── _core_models.yml
│       │   ├── fct_orders.sql
│       │   └── dim_customers.sql
│       └── finance/
│           ├── _finance_models.yml
│           └── fct_daily_revenue.sql
│
├── seeds/
│   └── customer_tier_rules.csv
│
├── snapshots/
│   └── snap_customers.sql
│
└── macros/
    ├── cents_to_dollars.sql
    └── date_dimensions.sql
```

---

## 下一步

[[【技术与工具】/dbt/12-dbt最佳实践]] - 团队协作规范、性能优化、dbt Mesh 多项目架构介绍

---

*最后更新：2026-03-18*

#dbt #项目实战 #电商数仓 #数据建模 #端到端

---

> [!info] 前置知识
> - 完成 dbt 系列 01-10 的核心内容（尤其是三层分层、增量模型、测试、Jinja 宏）
> - 理解电商业务的基本数据模型（订单、客户、商品之间的关系）
> - 有在本地或云端运行完整 dbt 项目的实际经验

---

## 掌握检查

- [ ] 能按照 staging → intermediate → marts 的顺序，独立搭建本项目的模型文件结构，不遗漏核心模型
- [ ] 能为 `fct_orders` 配置增量模型（`is_incremental()` 过滤 + `unique_key`），并在 `dim_customers` 使用 snapshot 追踪等级变化历史
- [ ] 能为本项目所有 marts 层模型配置主键测试（unique + not_null），并为关键外键配置 relationships 测试
- [ ] 知道如何用 `dbt docs generate` 生成项目文档，并在血缘图中看到完整的 staging → intermediate → marts 数据流
- [ ] 能按照本文的运行步骤（deps → debug → seed → snapshot → build → docs）完整跑通一次项目

---

## 实践练习

**综合实战**：按照本文的完整步骤，在你的本地环境中还原这个电商数仓项目：从 `dbt init` 开始，到所有 marts 层模型正常运行、所有测试通过、文档网站可访问为止。记录你遇到的错误和解决过程。

**扩展挑战**：在本项目基础上，增加一个新的业务需求：计算每个商品分类（category）的月度销售额排名（用窗口函数 RANK()）。从原始数据到最终输出，确定这个需求需要新增或修改哪些 staging/intermediate/marts 层的模型，并实现它。
