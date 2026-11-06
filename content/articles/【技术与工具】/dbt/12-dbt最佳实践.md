---
title: dbt 最佳实践 - 项目规范、性能优化与团队协作
tags:
  - dbt
  - 最佳实践
  - 性能优化
  - 团队协作
  - dbt-Mesh
  - 代码规范
aliases:
  - dbt规范
  - dbt优化
  - dbt团队协作
date: 2026-03-18
difficulty: 高级
duration: 25分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据治理工程师
  - 有完整 dbt 项目开发经验的团队成员
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


# dbt 最佳实践 - 项目规范、性能优化与团队协作

> [!abstract] 本文核心
> 一个人用 dbt 和一个团队用 dbt 是两件完全不同的事。
> 本文整理了让 dbt 项目在团队中长期可维护的核心规范，以及提升运行性能的实用技巧。

---

## 项目结构规范

### 文件命名原则

严格的命名规范是可读性的基础：

```text
模型命名规范：
  staging:      stg_{source}__{entity}.sql   (双下划线分隔 source 和 entity)
  intermediate: int_{entity}_{verb}.sql
  marts/fct:    fct_{entity}.sql
  marts/dim:    dim_{entity}.sql
  snapshot:     snap_{entity}.sql

示例：
  stg_shopify__orders.sql         ← Shopify 的 orders 表
  stg_shopify__customers.sql
  int_orders_with_payments.sql    ← 订单关联支付信息
  fct_orders.sql                  ← 订单事实表
  dim_customers.sql               ← 客户维度表
  snap_customers.sql              ← 客户快照
```

### YAML 文件组织

```text
每个目录的 YAML 文件命名约定：
  _sources.yml            ← 数据源定义（staging 目录）
  _{dir_name}_models.yml  ← 该目录的模型测试和文档

例如：
  models/staging/shopify/
  ├── _shopify_sources.yml      ← Shopify 数据源
  ├── _stg_shopify_models.yml   ← Shopify staging 模型文档
  └── stg_shopify__*.sql

  models/marts/core/
  ├── _core_models.yml          ← Core 层模型文档
  └── fct_*.sql / dim_*.sql
```

> [!note] 下划线开头的惯例
> YAML 配置文件以 `_` 开头，是 dbt 社区的约定（不是语法要求）。
> 这样做的好处是：在文件浏览器中，配置文件排在 SQL 文件前面，便于查找。

---

## SQL 风格指南

一致的 SQL 风格让代码更易读、易维护：

### 基本格式规范

```sql
-- 好的风格
WITH orders AS (

    SELECT
        -- 主键：放第一位
        order_id,

        -- 外键
        customer_id,
        product_id,

        -- 日期
        created_at,

        -- 度量值
        total_price_cents,
        total_items,

        -- 派生字段/布尔值：放最后
        (financial_status = 'paid') AS is_paid

    FROM {{ ref('stg_shopify__orders') }}
    WHERE financial_status != 'test'

),

final AS (

    SELECT * FROM orders

)

SELECT * FROM final
```

```sql
-- 不好的风格（避免）
select order_id, customer_id, total_price_cents from {{ ref('stg_shopify__orders') }} where financial_status != 'test'
-- 关键字小写、没有缩进、所有内容在一行
```

### 具体规范

| 规则 | 说明 |
|------|------|
| 关键字大写 | `SELECT`, `FROM`, `WHERE`, `JOIN`, `GROUP BY` |
| 字段名小写 | `order_id`, `customer_id`, `total_price_cents` |
| 使用 AS 命名别名 | `id AS order_id`（不省略 AS） |
| 逗号放行尾 | 与本文示例一致，使用 `order_id,`；团队也可统一采用行首逗号，但应保持一致 |
| 使用 WITH CTE | 避免嵌套子查询，提高可读性 |
| 结尾用 final CTE | 最后一个 CTE 命名为 `final`，`SELECT * FROM final` |

### CTE 命名规范

```sql
-- 按功能命名 CTE，而不是 tmp1, tmp2

WITH
-- 原始数据：source / raw_*
source AS (...),

-- 过滤后：filtered_*
filtered_orders AS (...),

-- 关联后：joined_* 或 enriched_*
orders_with_customers AS (...),

-- 聚合后：aggregated_* 或 summarized_*
daily_totals AS (...),

-- 最终输出：final（固定命名）
final AS (...)

SELECT * FROM final
```

---

## 性能优化实践

### 优化一：合理使用物化方式

```yaml
# 性能 vs 成本的平衡

# staging 层：view（没必要物化，逻辑简单）
staging:
  +materialized: view

# intermediate 层：ephemeral（最轻量，避免不必要的物化）
# 如果 intermediate 被多个下游引用，可评估 view 或 table；普通 view 不保证避免重复计算
intermediate:
  +materialized: ephemeral    # 默认
  # 被多次引用的：
  int_order_items_enriched:
    +materialized: view       # 单独覆盖

# marts 层：table（查询性能最重要）
marts:
  +materialized: table
```

### 优化二：分区和聚簇（BigQuery/Snowflake）

```sql
-- BigQuery 分区表
{{ config(
    materialized='incremental',
    partition_by={
        "field": "order_date",
        "data_type": "date",
        "granularity": "day"
    },
    cluster_by=["customer_id", "financial_status"]
) }}
```

```sql
-- Snowflake 聚簇键
{{ config(
    materialized='table',
    cluster_by=["order_date", "customer_id"]
) }}
```

### 优化三：避免在 WHERE 中对列做计算

```sql
-- 对列做函数运算可能影响索引利用或分区裁剪，具体取决于数据库及优化器
WHERE DATE_TRUNC('month', created_at) = '2024-01-01'

-- 好：对值做计算，列保持原样
WHERE created_at >= '2024-01-01'
  AND created_at < '2024-02-01'
```

### 优化四：谨慎使用 SELECT *

```sql
-- 不好：SELECT * 在大宽表上会传输大量不需要的数据
SELECT * FROM {{ ref('stg_orders') }}

-- 好：明确列出需要的字段
SELECT
    order_id,
    customer_id,
    total_price_cents
FROM {{ ref('stg_orders') }}

-- 如果确实需要 SELECT * 但排除几列，用 dbt_utils.star()
SELECT
    {{ dbt_utils.star(from=ref('stg_orders'), except=["internal_notes", "_fivetran_synced"]) }}
FROM {{ ref('stg_orders') }}
```

### 优化五：增量模型的分区策略

```sql
-- 对于按日期分区的大表，可评估按分区覆盖的增量更新；效率取决于适配器、更新范围和数据规模
{{ config(
    materialized='incremental',
    incremental_strategy='insert_overwrite',
    partition_by={"field": "order_date", "data_type": "date"}
) }}

{% if is_incremental() %}
-- BigQuery：选择当天及此前 3 天的数据，用于评估延迟数据回补
WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 3 DAY)
{% endif %}
```

### 优化六：线程并行化

```yaml
# profiles.yml
dev:
  threads: 8    # 本地开发：根据机器配置设置
prod:
  threads: 16   # 生产环境：更多并行
```

> [!note] 线程数设置原则
> - 不超过数据库的最大并发连接数
> - 本地开发：4-8 线程
> - 云数仓（Snowflake/BigQuery）：可以设置更高（16-32）
> - 增加线程并不总是更快，受 DAG 拓扑结构限制（串行依赖无法并行）

---

## 团队协作规范

### Git 工作流

```text
分支策略（推荐 GitHub Flow）：

main                    ← 生产环境，受保护
  └─ feature/add-fct-revenue    ← 功能分支
  └─ fix/orders-duplicate-key   ← 修复分支
  └─ docs/improve-dim-customers ← 文档更新分支

PR 规范：
- 每个 PR 只做一件事（避免大 PR）
- PR 描述说明改了什么、为什么改
- 必须通过 CI（dbt test）才能合并
- 需要至少一人 Code Review
```

```bash
# 每个人的开发流程
git checkout -b feature/add-customer-rfm

# 开发时使用自己的 schema，避免冲突
# 在 profiles.yml 中配置：
# schema: dbt_{{ env_var('USER') }}

dbt run --select +dim_customers    # 运行 dim_customers 及其上游依赖
dbt test --select dim_customers    # 跑测试

git add models/ tests/ macros/
git commit -m "feat: add RFM customer segmentation to dim_customers"
git push origin feature/add-customer-rfm

# 在 GitHub 创建 PR，等 CI 通过后合并
```

### Code Review 检查清单

```markdown
## dbt PR Review Checklist

### 结构
- [ ] 遵循 staging/intermediate/marts 分层原则
- [ ] 模型命名遵循 stg_/int_/fct_/dim_ 规范
- [ ] YAML 配置文件完整

### 代码质量
- [ ] SQL 格式规范（关键字大写，适当缩进）
- [ ] 所有列有明确的 AS 别名
- [ ] 使用 ref() 而不是硬编码表名
- [ ] 没有不必要的 SELECT *

### 数据质量
- [ ] 主键字段有 unique + not_null 测试
- [ ] 外键字段有 relationships 测试
- [ ] 枚举字段有 accepted_values 测试
- [ ] 新模型有 description

### 性能
- [ ] 大表根据数据规模、更新模式和成本选择了适当的物化方式
- [ ] 增量模型有合理的过滤条件
- [ ] 已结合目标数仓的执行计划评估 WHERE 中列上函数运算的影响
```

### 避免常见的团队协作问题

> [!warning] 问题一：多人开发时的 schema 冲突
> **问题**：A 和 B 都在开发，写入同一个 `dbt_dev.fct_orders`，互相覆盖。
> **解决**：在 profiles.yml 中给每人独立 schema：
> ```yaml
> dev:
>   schema: "dbt_{{ env_var('USER', 'dev') }}"
>   # A 的表在 dbt_alice.fct_orders
>   # B 的表在 dbt_bob.fct_orders
> ```

> [!warning] 问题二：文档不更新
> **问题**：代码改了，但 schema.yml 里的 description 还是旧的。
> **解决**：把文档更新写进 Code Review 检查清单，强制要求。

> [!warning] 问题三：测试不够
> **问题**：每次发现数据问题都是业务方反馈，而不是测试告警。
> **解决**：设立"测试覆盖率"目标，要求每个 marts 层模型至少有主键测试和数据新鲜度测试。

---

## dbt Mesh 简介（多项目协作）

当数据团队扩大，或者有多个独立的业务域时，可评估单一 dbt 项目的管理成本；团队超过 10 人可作为讨论信号，而不是采用 Mesh 的必要或充分条件。**dbt Mesh** 是 dbt 对多项目协作的解决方案。

### 核心概念

```text
单一项目（小团队）：
  一个仓库 → 所有模型 → 所有团队共用

dbt Mesh（多团队）：
  foundation_project    ← 基础层（staging、核心维度）
       ↓
  finance_project       ← 财务团队（引用 foundation 的公共模型）
  marketing_project     ← 市场团队（引用 foundation 的公共模型）
  operations_project    ← 运营团队
```

### 公共接口（Public Models）

```yaml
# foundation_project/models/marts/core/_core_models.yml

models:
  - name: fct_orders
    access: public        # 声明为公共模型，其他项目可以引用
    description: "核心订单事实表"

  - name: dim_customers
    access: public

  - name: int_order_items_enriched
    access: private       # 私有模型，仅允许同一 group 内的模型引用；默认访问级别为 protected
```

在其他项目中引用：

```sql
-- finance_project/models/fct_revenue.sql

SELECT
    o.order_id,
    o.total_price_cents
FROM {{ ref('foundation_project', 'fct_orders') }}    -- 跨项目引用
WHERE o.financial_status = 'paid'
```

> [!note] dbt Mesh 的适用时机
> 小团队（< 10 人）通常可以优先评估单一项目，但是否需要 Mesh 仍取决于数据域边界、治理要求和跨项目协作需求。
> 当以下情况出现时，考虑引入 Mesh：
> - 不同团队的模型互相干扰（修改一个影响另一个团队）
> - 构建时间超过 30 分钟，大部分时间在等不相关的模型
> - 有明确的数据域边界（finance、marketing 彼此独立）

---

## 可观测性：监控 dbt 项目健康

```yaml
# dbt_project.yml 中配置 meta 字段用于追踪
models:
  my_project:
    marts:
      +meta:
        owner: "@data-team"           # 模型负责人
        slack_channel: "#data-alerts" # 告警发送渠道
        tier: critical                # 重要性等级：critical/standard/experimental
```

```bash
# 追踪 dbt 运行性能
dbt run --record-timing-info target/run_timing.json    # 将运行计时信息写入指定文件

# 查看 target/run_timing.json
cat target/run_timing.json | python -m json.tool | head -50
```

---

## 总结：一张清单

| 类别 | 最佳实践 |
|------|---------|
| 项目结构 | staging/intermediate/marts 三层，命名遵循 stg_/int_/fct_/dim_ 前缀 |
| SQL 风格 | 关键字大写，使用 CTE，字段逻辑分组注释 |
| 测试 | 主键测试必须有，关键外键要测，枚举值要测，新鲜度要测 |
| 文档 | description 说清楚粒度、来源、注意事项，不要写废话 |
| 物化 | staging=view，intermediate=ephemeral/view，marts=table/incremental |
| 性能 | 大表用 incremental，加分区，避免 WHERE 对列做计算 |
| 团队协作 | 每人独立 schema，PR 前跑 dbt test，Code Review checklist |
| CI/CD | PR 自动触发 `dbt test`，合并后自动部署生产 |
| 调度 | 生产用 Airflow 或 dbt Cloud，--fail-fast 快速失败 |

---

## 学习完成

恭喜你！你已经完成了 dbt 完整系列的学习。

回顾一下我们学了什么：

1. [[【技术与工具】/dbt/00-dbt学习路线图]] - 全局视角，dbt 在现代数据栈的位置
2. [[【技术与工具】/dbt/01-dbt概述与理念]] - 为什么需要 dbt，ELT vs ETL，Analytics Engineering
3. [[【技术与工具】/dbt/02-dbt安装与项目初始化]] - 环境搭建，项目结构
4. [[【技术与工具】/dbt/03-Model基础]] - Model 是 SELECT，ref() 建立依赖
5. [[【技术与工具】/dbt/04-数据建模分层]] - staging/intermediate/marts 三层架构
6. [[【技术与工具】/dbt/05-增量模型]] - incremental 物化，高效处理大表
7. [[【技术与工具】/dbt/06-测试与数据质量]] - 数据质量即代码
8. [[【技术与工具】/dbt/07-文档与数据血缘]] - 自动生成文档和血缘图
9. [[【技术与工具】/dbt/08-Jinja与宏]] - Jinja 模板，宏和包管理
10. [[【技术与工具】/dbt/09-Seeds与Snapshots]] - 配置表管理，SCD Type 2
11. [[【技术与工具】/dbt/10-dbt与调度集成]] - Airflow 集成，CI/CD 自动化
12. [[【技术与工具】/dbt/11-dbt项目实战]] - 端到端电商数仓项目
13. [[【技术与工具】/dbt/12-dbt最佳实践]] - 本文，规范和进阶

---

*最后更新：2026-03-18*

#dbt #最佳实践 #性能优化 #团队协作 #代码规范 #dbt-Mesh

---

> [!info] 前置知识
> - 已完成 dbt 系列 01-11，有完整项目的实际开发经验
> - 理解 dbt 的核心工作流（run/test/build/docs）和增量模型

---

## 掌握检查

- [ ] 能说出 dbt 命名规范的核心规则：staging 用 `stg_source__table` 格式，事实表用 `fct_` 前缀，维度表用 `dim_` 前缀
- [ ] 能识别并评估以下性能问题：大表全量物化是否应改为 incremental，需结合更新模式、正确性和运行成本判断；WHERE 子句对字段做函数计算可能影响索引利用或分区裁剪，需要结合执行计划判断
- [ ] 理解"每人独立开发 schema"的团队协作模式：每个开发者在自己的 schema 下调试，避免互相污染
- [ ] 知道 `pre-commit` 和 `sqlfluff` 在 dbt 项目中的作用：提交前自动检查 SQL 格式和 dbt 规范
- [ ] 能结合数据域边界、治理要求和跨项目协作需求评估 dbt Mesh；理解团队人数和构建时长只是评估信号，小团队采用 Mesh 也需权衡维护成本

---

## 实践练习

**基础题**：审查你的 dbt 项目，对照本文的最佳实践 checklist 做一次自检：命名规范是否遵守、每个 marts 层模型是否有主键测试、description 是否填写、物化方式是否合理。列出你发现的 3 个问题并改进。

**进阶题**：你的团队新加入了 2 名数据工程师，需要并行开发同一个 dbt 项目。参考本文的"开发工作流"章节，设计一套团队协作规范：包括各人使用独立 dev schema、PR 前必须运行的检查命令、Code Review 应该关注的清单。
