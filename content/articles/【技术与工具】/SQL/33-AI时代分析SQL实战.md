---
title: AI时代分析SQL实战
tags:
  - SQL
  - 数据分析
  - AI时代数据人
  - Text-to-SQL
  - 实战
aliases:
  - 分析SQL实战
  - AI时代SQL实战
created: 2026-05-18
updated: 2026-10-10
difficulty: 中级
duration: 60分钟
status: maintenance
knowledge_type: technical-practice
target_audience:
  - 数据分析师
  - BI分析师
  - 数据运营
  - 数据开发工程师
  - 数据产品经理
stability: slow-changing
access_tier: free
---


# AI时代分析SQL实战

> [!abstract] 本文定位
> 这不是 SQL 语法复习，而是一组“AI 最容易写错、但数据人必须写对”的分析模板：留存、漏斗、分群、归因、异常。你可以把它当成 Text-to-SQL 的人工验收样本，也可以当成数据分析师的实战训练题。

前置建议：先读 [[【学习路线】/AI时代数据人/12-AI时代SQL能力地图|AI时代SQL能力地图]]，再回到本文练习。

---

## 1. 一套通用业务表

假设我们有一个电商业务，核心表如下：

| 表名 | 粒度 | 核心字段 | 用途 |
|---|---|---|---|
| users | 一行一个用户 | user_id, register_date, channel, city | 用户维度 |
| events | 一行一个行为事件 | user_id, event_time, event_name, session_id | 行为分析 |
| orders | 一行一个订单 | order_id, user_id, pay_time, amount, status | 交易分析 |
| products | 一行一个商品 | product_id, category, brand | 商品分析 |
| order_items | 一行一个订单明细 | order_id, product_id, quantity, item_amount | 品类分析 |

> [!warning] 粒度先行
> 写任何分析 SQL 前，先问一句：我现在处理的是“用户粒度、订单粒度、明细粒度，还是事件粒度”？AI 生成 SQL 最常见的错误，就是在错误粒度上 join 和聚合。

---

## 2. 模板一：新增用户次日留存

业务问题：某渠道新增用户的次日留存率是多少？

```sql
WITH new_users AS (
    SELECT
        user_id,
        DATE(register_date) AS register_dt,
        channel
    FROM users
    WHERE DATE(register_date) BETWEEN DATE '2026-04-01' AND DATE '2026-04-30'
),
next_day_active AS (
    SELECT DISTINCT
        e.user_id,
        DATE(e.event_time) AS active_dt
    FROM events e
    WHERE e.event_name = 'app_open'
)
SELECT
    n.register_dt,
    n.channel,
    COUNT(DISTINCT n.user_id) AS new_user_cnt,
    COUNT(DISTINCT a.user_id) AS retained_user_cnt,
    COUNT(DISTINCT a.user_id) * 1.0 / NULLIF(COUNT(DISTINCT n.user_id), 0) AS d1_retention_rate
FROM new_users n
LEFT JOIN next_day_active a
    ON n.user_id = a.user_id
   AND a.active_dt = n.register_dt + INTERVAL '1' DAY
GROUP BY n.register_dt, n.channel
ORDER BY n.register_dt, n.channel;
```

### AI 容易写错的点

1. 把“次日留存”写成“任意后续活跃”。
2. 用 `COUNT(*)` 代替 `COUNT(DISTINCT user_id)`。
3. 忘记 `LEFT JOIN`，导致没有留存的用户被排除，分母变小。
4. 没有区分注册日期和活跃日期。

### 人工验收问题

- 次日是自然日，还是 24 小时后？
- 留存事件是 app_open、login，还是任意事件？
- 新用户是否排除测试账号、内部账号？

相关：[[【数据分析与数据运营】/02-数据分析专业能力/04-业务分析框架/01-AARRR模型|AARRR模型]]、[[【技术与工具】/SQL/19-窗口函数|窗口函数]]。

---

## 3. 模板二：支付漏斗转化

业务问题：统计窗口内访问商品详情、加购、下单、支付成功的独立用户数及相邻事件用户数之比；这些比值不等同于同一路径的有序漏斗转化率。

```sql
WITH user_funnel AS (
    SELECT
        user_id,
        MAX(CASE WHEN event_name = 'view_product' THEN 1 ELSE 0 END) AS viewed,
        MAX(CASE WHEN event_name = 'add_to_cart' THEN 1 ELSE 0 END) AS carted,
        MAX(CASE WHEN event_name = 'submit_order' THEN 1 ELSE 0 END) AS submitted,
        MAX(CASE WHEN event_name = 'pay_success' THEN 1 ELSE 0 END) AS paid
    FROM events
    WHERE event_time >= TIMESTAMP '2026-04-01 00:00:00'
      AND event_time <  TIMESTAMP '2026-05-01 00:00:00'
    GROUP BY user_id
)
SELECT
    SUM(viewed) AS view_users,
    SUM(carted) AS cart_users,
    SUM(submitted) AS submit_users,
    SUM(paid) AS pay_users,
    SUM(carted) * 1.0 / NULLIF(SUM(viewed), 0) AS view_to_cart_rate,
    SUM(submitted) * 1.0 / NULLIF(SUM(carted), 0) AS cart_to_submit_rate,
    SUM(paid) * 1.0 / NULLIF(SUM(submitted), 0) AS submit_to_pay_rate
FROM user_funnel;
```

### AI 容易写错的点

- 不控制时间窗口，导致用户跨月行为混入。
- 用事件数算转化，而不是用户数算转化。
- 没有保证漏斗顺序，用户先支付后浏览的脏数据也被算入。

如果业务要求严格顺序，需要补事件时间约束：浏览时间 < 加购时间 < 下单时间 < 支付时间。

---

## 4. 模板三：Cohort 月度复购

业务问题：每月首购用户在后续月份的复购情况如何？

```sql
WITH first_order AS (
    SELECT
        user_id,
        MIN(DATE_TRUNC('month', pay_time)) AS cohort_month
    FROM orders
    WHERE status = 'paid'
    GROUP BY user_id
),
user_month_orders AS (
    SELECT DISTINCT
        user_id,
        DATE_TRUNC('month', pay_time) AS order_month
    FROM orders
    WHERE status = 'paid'
),
cohort_activity AS (
    SELECT
        f.cohort_month,
        DATE_DIFF('month', f.cohort_month, u.order_month) AS month_index,
        COUNT(DISTINCT f.user_id) AS active_users
    FROM first_order f
    JOIN user_month_orders u
      ON f.user_id = u.user_id
     AND u.order_month >= f.cohort_month
    GROUP BY f.cohort_month, DATE_DIFF('month', f.cohort_month, u.order_month)
),
cohort_size AS (
    SELECT
        cohort_month,
        COUNT(DISTINCT user_id) AS cohort_users
    FROM first_order
    GROUP BY cohort_month
)
SELECT
    a.cohort_month,
    a.month_index,
    s.cohort_users,
    a.active_users,
    a.active_users * 1.0 / NULLIF(s.cohort_users, 0) AS retention_rate
FROM cohort_activity a
JOIN cohort_size s
  ON a.cohort_month = s.cohort_month
ORDER BY a.cohort_month, a.month_index;
```

### 为什么这个模板适合训练 AI

Cohort 分析的难点不是 SQL 复杂，而是“首购月”“行为月”“第几个月”这三个概念必须对齐。AI 经常把首购月和注册月混在一起。

建议和 [[【数据分析与数据运营】/02-数据分析专业能力/01-分析方法论/01-指标体系构建|指标体系构建]] 联合练习：先写指标定义，再写 SQL。

---

## 5. 模板四：用户分层与运营动作

业务问题：在近 90 天有已支付订单的用户中，按示例阈值及 CASE 优先顺序划分高价值、潜力、沉睡、流失风险、普通五类；这些标签是业务规则假设，不覆盖近 90 天无支付用户，也不直接证明用户已经流失。

```sql
WITH user_metrics AS (
    SELECT
        user_id,
        MAX(pay_time) AS last_pay_time,
        COUNT(DISTINCT order_id) AS order_cnt_90d,
        SUM(amount) AS gmv_90d
    FROM orders
    WHERE status = 'paid'
      AND pay_time >= CURRENT_DATE - INTERVAL '90' DAY
    GROUP BY user_id
),
scored AS (
    SELECT
        user_id,
        DATE_DIFF('day', last_pay_time, CURRENT_DATE) AS recency_days,
        order_cnt_90d,
        gmv_90d,
        CASE
            WHEN gmv_90d >= 3000 AND order_cnt_90d >= 3 THEN '高价值用户'
            WHEN gmv_90d >= 1000 AND order_cnt_90d >= 2 THEN '潜力用户'
            WHEN recency_days BETWEEN 31 AND 60 THEN '沉睡用户'
            WHEN recency_days > 60 THEN '流失风险用户'
            ELSE '普通用户'
        END AS user_segment
    FROM user_metrics
)
SELECT
    user_segment,
    COUNT(*) AS user_cnt,
    AVG(gmv_90d) AS avg_gmv,
    AVG(order_cnt_90d) AS avg_order_cnt
FROM scored
GROUP BY user_segment
ORDER BY user_cnt DESC;
```

### AI 容易写错的点

- 把分层规则当成固定真理，没有说明业务假设。
- 没有处理无订单用户，导致流失用户消失。
- 分层结果没有对应运营动作，只停留在分类。

> [!tip] 真正的分析不是分完层就结束
> 每个分层都要对应动作：高价值用户做权益，潜力用户做转化，沉睡用户做召回，流失风险用户做原因分析。

---

## 6. 模板五：GMV 异常波动定位

业务问题：昨日 GMV 为什么下降？

```sql
WITH daily_metrics AS (
    SELECT
        DATE(pay_time) AS dt,
        COUNT(DISTINCT user_id) AS pay_users,
        COUNT(DISTINCT order_id) AS orders,
        SUM(amount) AS gmv,
        SUM(amount) * 1.0 / NULLIF(COUNT(DISTINCT order_id), 0) AS avg_order_value
    FROM orders
    WHERE status = 'paid'
      AND pay_time >= CURRENT_DATE - INTERVAL '30' DAY
    GROUP BY DATE(pay_time)
),
with_baseline AS (
    SELECT
        dt,
        pay_users,
        orders,
        gmv,
        avg_order_value,
        AVG(gmv) OVER (ORDER BY dt ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING) AS gmv_7d_avg,
        STDDEV(gmv) OVER (ORDER BY dt ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING) AS gmv_7d_std
    FROM daily_metrics
)
SELECT
    dt,
    gmv,
    gmv_7d_avg,
    (gmv - gmv_7d_avg) / NULLIF(gmv_7d_std, 0) AS z_score,
    pay_users,
    orders,
    avg_order_value
FROM with_baseline
ORDER BY dt DESC;
```

### 下一步不是“写结论”，而是拆因子

GMV 可以拆成：

```text
GMV = 支付用户数 × 人均订单数 × 客单价
```

如果 GMV 下降，先看是用户少了、频次低了，还是客单价低了。AI 很容易直接说“用户消费意愿下降”，这通常是过度解释。

相关：[[【技术与工具】/统计学/标准差|标准差]]、[[【技术与工具】/统计学/置信区间|置信区间]]、[[【技术与工具】/统计学/63-AI时代统计推断与反幻觉|AI时代统计推断与反幻觉]]。

---

## 7. Text-to-SQL 验收清单

每当 AI 给你一条 SQL，至少检查：

- [ ] 是否明确业务指标定义
- [ ] 是否明确时间窗口
- [ ] 是否明确数据粒度
- [ ] join 是否会放大数据
- [ ] 分母是否正确
- [ ] NULL 是否处理
- [ ] 去重对象是否正确
- [ ] 是否存在权限风险
- [ ] SQL 是否可读、可复用、可解释
- [ ] 结果是否能用另一种口径交叉验证

---

## 8. 相关学习入口

- [[【技术与工具】/SQL/00-SQL学习路线图|SQL学习路线图]]
- [[【学习路线】/AI时代数据人/12-AI时代SQL能力地图|AI时代SQL能力地图]]
- [[【AI 与大数据】/06-行业应用/03-Text-to-SQL自然语言查询实战|Text-to-SQL自然语言查询实战]]
- [[【数据开发与数据架构】/07-数据服务架构/09-语义层工程实践|语义层工程实践]]
- [[【数据分析与数据运营】/02-数据分析专业能力/05-Agentic-Analytics/02-Text-to-SQL与语义层协同|Text-to-SQL与语义层协同]]
- [[【技术与工具】/SQL/22-SQL优化|SQL优化]]
- [[【技术与工具】/SQL/27-最佳实践|SQL最佳实践]]
