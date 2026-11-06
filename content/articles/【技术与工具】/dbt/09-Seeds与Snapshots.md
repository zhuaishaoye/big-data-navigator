---
title: dbt Seeds 与 Snapshots - 维度表与历史数据管理
tags:
  - dbt
  - seed
  - snapshot
  - SCD
  - 缓慢变化维
  - 维度建模
aliases:
  - dbt seed
  - dbt snapshot
  - SCD Type 2
  - 缓慢变化维
date: 2026-03-18
difficulty: 中级
duration: 25分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据分析师
  - 数据架构师
  - BI分析师
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


# dbt Seeds 与 Snapshots - 维度表与历史数据管理

> [!abstract] 本文核心
> - **Seeds**：用 CSV 文件管理小型维度映射表和配置数据，让这类数据也纳入版本控制
> - **Snapshots**：捕获数据的历史变更，实现 SCD Type 2（缓慢变化维），让你能查询"昨天这个客户是什么分层"

---

## Seeds：管理配置数据的正确方式

### 什么是 Seed

Seed 就是 `seeds/` 目录下的 CSV 文件。`dbt seed` 命令会把这些 CSV 文件加载到数据库中，变成可以被模型 `ref()` 引用的表。

### 适合用 Seed 管理的数据

| 数据类型 | 示例 | 说明 |
|---------|------|------|
| 维度映射表 | 城市代码 → 城市名 | 数据量小，变化少 |
| 状态码描述 | 1=待付款, 2=已付款 | 枚举值的描述 |
| 汇率配置 | USD→CNY: 7.2 | 静态配置（不适合实时汇率） |
| 业务规则 | 不同区域的费率 | 硬编码在代码里难维护 |
| 测试数据 | 已知的测试订单 | 用于对比测试 |

> [!warning] Seed 不适合的场景
> - 数据量较大 —— 应结合文件大小、加载成本和适配器能力评估，通常更适合从数据库加载；几千行不是统一硬性上限
> - 频繁更新 —— 每次更新都需要改 CSV 并重新 commit，成本较高
> - 敏感数据 —— CSV 会在 Git 仓库中明文存储

### 创建和使用 Seed

```csv
country_code,country_name,region,currency
CN,中国,Asia,CNY
US,美国,Americas,USD
GB,英国,Europe,GBP
JP,日本,Asia,JPY
DE,德国,Europe,EUR
```

```yaml
# dbt_project.yml 中配置 seed（可选）
seeds:
  my_analytics_project:
    country_codes:
      +column_types:
        country_code: varchar(2)    # 手动指定列类型（默认类型由 CSV 内容推断，具体类型取决于适配器）
        country_name: varchar(100)
```

```bash
# 加载所有 seed 到数据库
dbt seed

# 只加载特定 seed
dbt seed --select country_codes

# 全量重新加载（seed 变化时）
dbt seed --full-refresh
```

在模型中使用：

```sql
-- models/marts/core/fct_orders.sql

SELECT
    o.order_id,
    o.customer_id,
    o.total_price_cents,
    c.country_name,      -- 来自 seed
    c.region,
    c.currency
FROM {{ ref('fct_orders_base') }} o
LEFT JOIN {{ ref('country_codes') }} c    -- 直接 ref() 引用 seed
    ON o.shipping_country_code = c.country_code
```

### 复杂的业务规则映射表

```csv
min_ltv_cents,max_ltv_cents,tier_name,discount_percentage,support_level
0,9999,bronze,0,standard
10000,49999,silver,5,priority
50000,199999,gold,10,dedicated
200000,999999999,platinum,15,white-glove
```

```sql
-- models/marts/dim_customers.sql
-- 使用 seed 中的规则动态计算客户等级

SELECT
    c.customer_id,
    c.email,
    c.lifetime_value_cents,
    t.tier_name,
    t.discount_percentage,
    t.support_level
FROM {{ ref('stg_customers') }} c
LEFT JOIN {{ ref('customer_tier_rules') }} t
    ON c.lifetime_value_cents BETWEEN t.min_ltv_cents AND t.max_ltv_cents
```

这种做法的好处：如果客户等级规则变了，只需修改 CSV 文件，提交 Git，重新运行，无需改 SQL。

---

## Snapshots：捕获历史变更

### 为什么需要 Snapshot

假设你有一张客户维度表：

```text
今天的 dim_customers：
customer_id | segment | lifetime_value_cents
1001        | gold    | 55000

三个月后，这个客户可能：
customer_id | segment | lifetime_value_cents
1001        | silver  | 48000  ← 消费减少，降级了
```

如果你只保存最新状态，**你永远不知道这个客户以前是什么等级**。这在分析"客户流失"、"等级变化"时会造成严重问题。

Snapshot 解决的就是这个问题：**记录每次运行时捕获的数据状态变化历史，不会自动补回启用前历史，也不保证捕获两次运行之间的所有变化**。

这是 维度建模基础 中 SCD（Slowly Changing Dimension，缓慢变化维）Type 2 的标准实现方式。

### Snapshot 的工作原理

每次运行 `dbt snapshot` 时，dbt 会：
1. 查询源数据
2. 与快照表中的最新记录对比
3. 如果发现变化，关闭旧记录（填入 `dbt_valid_to`），插入新记录

```text
快照表的结构：
dbt_scd_id  | customer_id | segment | dbt_valid_from      | dbt_valid_to
abc123      | 1001        | silver  | 2024-01-01 00:00:00 | 2024-06-15 10:00:00  ← 已失效
def456      | 1001        | gold    | 2024-06-15 10:00:00 | 2024-09-01 14:30:00  ← 已失效
ghi789      | 1001        | silver  | 2024-09-01 14:30:00 | null                 ← 当前有效
```

通过 `dbt_valid_to IS NULL` 可以查到每个记录的当前最新状态。

### 创建 Snapshot

```sql
-- snapshots/snap_customers.sql

{% snapshot snap_customers %}

{{
    config(
        target_schema='snapshots',         -- 快照表写入哪个 schema
        strategy='timestamp',              -- 检测变化的策略
        unique_key='customer_id',          -- 哪个字段是主键
        updated_at='updated_at',           -- 用哪个字段判断记录是否更新
    )
}}

-- 快照的来源查询：通常是 staging 层
SELECT
    customer_id,
    email,
    first_name,
    last_name,
    customer_segment,
    lifetime_value_cents,
    updated_at
FROM {{ ref('stg_customers') }}

{% endsnapshot %}
```

### 两种变化检测策略

#### strategy = 'timestamp'（推荐）

```sql
{{
    config(
        strategy='timestamp',
        unique_key='customer_id',
        updated_at='updated_at',          -- 通过 updated_at 字段的变化来检测
    )
}}
```

- **优点**：性能好，准确
- **前提**：源数据有可靠的 `updated_at` 字段
- **适用**：大多数业务表（有 updated_at 维护的）

#### strategy = 'check'（兜底方案）

```sql
-- 监控 customer_segment、email 和 lifetime_value_cents 的变化
-- 可将 check_cols 改为 'all' 以监控所有字段；性能取决于数据规模、字段数量和数据库
{{
    config(
        strategy='check',
        unique_key='customer_id',
        check_cols=['customer_segment', 'email', 'lifetime_value_cents']
    )
}}
```

- **优点**：不依赖 updated_at
- **缺点**：每次运行需要对比查询结果中记录的 check_cols 指定字段；使用 check_cols='all' 时对比所有字段，实际性能取决于数据规模、字段数量和数据库。
- **适用**：源数据没有 updated_at，或者 updated_at 不可信

### 运行 Snapshot

```bash
# 运行所有 snapshot
dbt snapshot

# 只运行特定 snapshot
dbt snapshot --select snap_customers

# 同时运行模型、测试、snapshot
dbt build
```

### 查询快照数据

```sql
-- 查询所有客户的当前状态
SELECT *
FROM snapshots.snap_customers
WHERE dbt_valid_to IS NULL    -- 当前有效的记录

-- 查询某客户的历史状态
SELECT
    customer_id,
    customer_segment,
    lifetime_value_cents,
    dbt_valid_from,
    dbt_valid_to
FROM snapshots.snap_customers
WHERE customer_id = 1001
ORDER BY dbt_valid_from

-- 时间旅行：某客户在 2024-06-01 的状态是什么？
SELECT *
FROM snapshots.snap_customers
WHERE customer_id = 1001
  AND dbt_valid_from <= '2024-06-01'
  AND (dbt_valid_to > '2024-06-01' OR dbt_valid_to IS NULL)
```

### 在模型中使用快照

快照数据可以被 `ref()` 引用：

```sql
-- models/marts/fct_customer_tier_changes.sql
-- 分析客户等级变化

WITH tier_history AS (
    SELECT
        customer_id,
        customer_segment AS new_tier,
        LAG(customer_segment) OVER (
            PARTITION BY customer_id
            ORDER BY dbt_valid_from
        ) AS prev_tier,
        dbt_valid_from AS changed_at
    FROM {{ ref('snap_customers') }}
)

SELECT
    customer_id,
    prev_tier,
    new_tier,
    changed_at,
    CASE
        WHEN prev_tier IS NULL THEN 'new_customer'
        WHEN (
            ARRAY_POSITION(ARRAY['bronze','silver','gold','platinum'], new_tier) >
            ARRAY_POSITION(ARRAY['bronze','silver','gold','platinum'], prev_tier)
        ) THEN 'upgrade'
        ELSE 'downgrade'
    END AS change_type
FROM tier_history
WHERE prev_tier IS NOT NULL    -- 排除初次出现的记录
  AND prev_tier != new_tier    -- 排除没有变化的记录
```

---

## 实战案例：完整的维度管理

一个电商项目中 seeds + snapshots 的典型用法：

```text
seeds/
├── country_codes.csv          # 国家代码映射
├── customer_tier_rules.csv    # 客户等级规则
├── product_categories.csv     # 产品分类映射
└── holiday_calendar.csv       # 节假日日历

snapshots/
├── snap_customers.sql         # 客户信息变化历史
├── snap_products.sql          # 产品信息变化历史（价格、分类调整）
└── snap_vendor_contracts.sql  # 供应商合同条款变化
```

---

## 总结

| 功能 | Seeds | Snapshots |
|------|-------|----------|
| 解决的问题 | 静态配置/映射表的版本控制 | 历史变更追踪（SCD Type 2） |
| 数据来源 | CSV 文件 | 数据库中的已有表 |
| 使用命令 | `dbt seed` | `dbt snapshot` |
| 引用方式 | `ref('seed_name')` | `ref('snapshot_name')` |
| 数据量考虑 | 适合小型静态数据，容量需结合文件大小和加载成本评估 | 历史表持续增长，容量与性能受数据库、运行频率及变更规模影响 |
| 更新方式 | 修改 CSV，重新 seed | 每次 snapshot 自动追加变更 |

---

## 下一步

[[【技术与工具】/dbt/10-dbt与调度集成]] - 学习如何把 dbt 命令接入 Airflow 和 CI/CD，实现自动化运行

---

*最后更新：2026-03-18*

#dbt #seed #snapshot #SCD #缓慢变化维 #维度建模

---

> [!info] 前置知识
> - 掌握 dbt Model 和三层分层架构，参考 [[【技术与工具】/dbt/04-数据建模分层|数据建模分层]]
> - 了解维度建模的基本概念（事实表、维度表、SCD）
> - 理解缓慢变化维（SCD）的业务场景：客户地址变更、产品价格调整等

---

## 掌握检查

- [ ] 能创建一个 seed 文件（CSV 格式），用 `dbt seed` 加载到数据库，并在 Model 中通过 `ref('seed_name')` 引用
- [ ] 能说出 seed 的使用限制：适合小型静态配置数据，具体容量需结合文件大小、加载成本和适配器能力评估，不适合频繁变化的数据
- [ ] 能写一个 snapshot 文件，配置 `strategy`（timestamp 或 check）、`unique_key`、`updated_at`，运行 `dbt snapshot` 后在数据库中查到 `dbt_scd_id`、`dbt_valid_from`、`dbt_valid_to` 字段
- [ ] 理解 SCD Type 2 的数据结构：当前有效行的 `dbt_valid_to` 为 NULL，历史行的 `dbt_valid_to` 为变更时间
- [ ] 知道 snapshot 和增量模型的本质区别：snapshot 按变化检测策略追踪运行时捕获的历史版本；增量模型是否保留历史取决于模型逻辑和增量策略，并非只能保留最新状态

---

## 实践练习

**基础题**：创建一个 seed 文件 `customer_segments.csv`，包含客户等级（bronze/silver/gold）和对应的折扣率。用 `dbt seed` 加载，在 `dim_customers.sql` 中通过 `ref('customer_segments')` 关联，给每个客户打上等级标签。

**进阶题**：为客户表创建一个 snapshot，追踪客户 email 和 tier 字段的历史变化。运行 `dbt snapshot` 首次创建，然后在原始表中修改某个客户的 tier，再次运行 `dbt snapshot`，查询 snapshot 表验证历史记录是否正确保存（旧记录的 `dbt_valid_to` 应该被填上变更时间）。
