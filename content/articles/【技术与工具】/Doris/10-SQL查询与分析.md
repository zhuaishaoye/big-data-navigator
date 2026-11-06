---
title: Doris SQL查询与分析 - 高效数据洞察
tags:
  - 技能实操
  - Doris
  - SQL
  - 数据分析
difficulty: 高级
duration: 30分钟
knowledge_type: technical-practice
target_audience:
  - 数据分析师
  - 数据开发工程师
  - BI分析师
  - 数据架构师
  - 数据科学家
  - 数据运营
  - 数据产品经理
stability: slow-changing
status: maintenance
access_tier: free
updated: 2026-10-10
---


# Doris SQL查询与分析 - 高效数据洞察

> [!abstract] 📋 本节概览
> - 🎯 学习目标：掌握Doris SQL查询特性与高效分析技巧
> - 📚 前置知识：09-数据导入方案详解|数据导入方案详解
> - ⏱️ 预计用时：30分钟

## 🎯 实际应用价值

Doris SQL查询与分析可用于聚合统计、业务指标计算与查询性能排查；实际效率改善取决于数据规模、表设计、执行计划和资源配置。

在实际工作环境中，这样的挑战每天都在发生。理解相关知识不仅能解决当前问题，更能提升整体的专业能力。
## 💡 Doris SQL语法特性

Doris支持标准SQL语法，同时提供了许多针对OLAP场景优化的扩展功能。

### 基本查询语法

```sql
-- 基本查询结构
SELECT [ALL | DISTINCT] select_expr [, select_expr ...]
FROM table_reference [, table_reference ...]
[WHERE where_condition]
[GROUP BY {col_name | expr | position} [ASC | DESC], ... [WITH ROLLUP]]
[HAVING where_condition]
[ORDER BY {col_name | expr | position} [ASC | DESC], ...]
[LIMIT {[offset,] row_count | row_count OFFSET offset}]
```

### Doris特有SQL扩展

```sql
-- 1. 多表JOIN优化语法
SELECT /*+ SHUFFLE_JOIN(t1, t2) */ 
    t1.id, t1.name, t2.amount
FROM table1 t1
JOIN table2 t2 ON t1.id = t2.id;

-- 2. 分区裁剪提示
SELECT /*+ PARTITION(p1, p2) */ 
    * 
FROM partitioned_table;

-- 3. 广播JOIN提示
SELECT /*+ BROADCAST_JOIN(small_table) */
    big_table.id, small_table.name
FROM big_table JOIN small_table ON big_table.id = small_table.id;
```

## 🔍 常用分析操作

### 1. 聚合查询

```sql
-- 基本聚合
SELECT 
    region,
    COUNT(*) AS total_orders,
    SUM(amount) AS total_amount,
    AVG(amount) AS avg_amount,
    MIN(amount) AS min_amount,
    MAX(amount) AS max_amount
FROM orders
WHERE order_date BETWEEN '2023-01-01' AND '2023-12-31'
GROUP BY region
ORDER BY total_amount DESC;

-- 多维聚合
SELECT 
    region,
    product_category,
    COUNT(*) AS order_count,
    SUM(amount) AS total_amount
FROM orders
GROUP BY region, product_category
ORDER BY region, total_amount DESC;
```

### 2. 窗口函数

```sql
-- 排名函数
SELECT 
    user_id,
    order_date,
    amount,
    ROW_NUMBER() OVER(PARTITION BY user_id ORDER BY amount DESC) AS amount_rank,
    RANK() OVER(PARTITION BY user_id ORDER BY amount DESC) AS amount_rank_with_gaps,
    DENSE_RANK() OVER(PARTITION BY user_id ORDER BY amount DESC) AS amount_dense_rank
FROM orders;

-- 分析函数
SELECT 
    product_id,
    order_date,
    amount,
    SUM(amount) OVER(PARTITION BY product_id ORDER BY order_date) AS cumulative_amount,
    AVG(amount) OVER(PARTITION BY product_id ORDER BY order_date ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS moving_avg_3rows
FROM orders;
```

### 3. 复杂条件过滤

```sql
-- 多条件过滤
SELECT 
    *
FROM user_behaviors
WHERE user_id IN (SELECT user_id FROM high_value_users)
  AND behavior_type = 'purchase'
  AND behavior_time BETWEEN '2023-06-01' AND '2023-06-30'
  AND product_id IN (10001, 10002, 10003);

-- HAVING子句过滤
SELECT 
    user_id,
    COUNT(*) AS purchase_count,
    SUM(amount) AS total_amount
FROM orders
WHERE order_date >= '2023-01-01'
GROUP BY user_id
HAVING purchase_count >= 5 AND total_amount > 1000;
```

### 4. 子查询与WITH语句

```sql
-- 相关子查询
SELECT 
    o.order_id,
    o.user_id,
    o.amount,
    (SELECT AVG(amount) FROM orders WHERE user_id = o.user_id) AS user_avg_amount
FROM orders o
WHERE o.amount > (SELECT AVG(amount) * 2 FROM orders);

-- WITH子句(CTE)
WITH user_stats AS (
    SELECT 
        user_id,
        COUNT(*) AS order_count,
        SUM(amount) AS total_spend
    FROM orders
    GROUP BY user_id
),
high_value_users AS (
    SELECT user_id
    FROM user_stats
    WHERE total_spend > 10000
)
SELECT 
    u.user_id,
    u.user_name,
    s.order_count,
    s.total_spend
FROM users u
JOIN high_value_users h ON u.user_id = h.user_id
JOIN user_stats s ON u.user_id = s.user_id;
```

### 5. 日期时间分析

```sql
-- 时间维度分析
SELECT 
    DATE_FORMAT(order_time, '%Y-%m-%d') AS order_date,
    DATE_FORMAT(order_time, '%H') AS order_hour,
    COUNT(*) AS order_count,
    SUM(amount) AS total_amount
FROM orders
WHERE order_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY order_date, order_hour
ORDER BY order_date, order_hour;

-- 时间间隔计算
SELECT 
    user_id,
    order_id,
    order_time,
    LAG(order_time) OVER(PARTITION BY user_id ORDER BY order_time) AS prev_order_time,
    TIMESTAMPDIFF(DAY, 
                  LAG(order_time) OVER(PARTITION BY user_id ORDER BY order_time), 
                  order_time) AS days_since_last_order
FROM orders;
```

## 🚀 查询优化技巧

### 1. 分区裁剪优化

```sql
-- 确保查询条件包含分区列
EXPLAIN SELECT * FROM sales_data 
WHERE sale_date BETWEEN '2023-06-01' AND '2023-06-30';

-- 若sale_date为分区列且分区边界与该日期范围匹配，检查计划是否只扫描相关分区；未提供分区定义，不能预先断定扫描范围
```

### 2. 谓词下推

```sql
-- 尽早过滤数据
SELECT 
    o.order_id, 
    o.amount, 
    u.user_name
FROM orders o
JOIN users u ON o.user_id = u.user_id
WHERE o.amount > 1000 
  AND o.order_date > '2023-01-01'
  AND u.user_type = 'VIP';

-- 对照写法：优化器可能消除这些简单派生表并生成相同计划，不能仅凭写法判定性能优劣
SELECT 
    o.order_id, 
    o.amount, 
    u.user_name
FROM (SELECT * FROM orders) o
JOIN (SELECT * FROM users) u ON o.user_id = u.user_id
WHERE o.amount > 1000 
  AND o.order_date > '2023-01-01'
  AND u.user_type = 'VIP';
```

### 3. JOIN优化

```sql
-- 小表广播JOIN
SELECT /*+ BROADCAST_JOIN(dim_product) */
    f.order_id,
    f.product_id,
    d.product_name,
    f.amount
FROM fact_orders f
JOIN dim_product d ON f.product_id = d.product_id;

-- 大表Shuffle JOIN
SELECT /*+ SHUFFLE_JOIN(fact_orders_1, fact_orders_2) */
    a.order_id,
    a.user_id,
    b.product_id
FROM fact_orders_1 a
JOIN fact_orders_2 b ON a.user_id = b.user_id;
```

### 4. 物化视图加速

```sql
-- 创建物化视图
CREATE MATERIALIZED VIEW mv_daily_sales
DISTRIBUTED BY HASH(sale_date) BUCKETS 10
REFRESH ASYNC
AS SELECT 
    DATE_FORMAT(sale_time, '%Y-%m-%d') AS sale_date,
    product_id,
    SUM(quantity) AS total_quantity,
    SUM(amount) AS total_amount,
    COUNT(DISTINCT user_id) AS user_count
FROM sales_detail
GROUP BY sale_date, product_id;

-- 下例直接查询物化视图，不演示基表查询的自动改写；自动改写是否发生需另行检查执行计划
SELECT 
    sale_date,
    SUM(total_amount) AS daily_amount
FROM mv_daily_sales
GROUP BY sale_date
ORDER BY sale_date;
```

### 5. 查询计划分析

```sql
-- 使用EXPLAIN分析查询计划
EXPLAIN SELECT 
    u.user_id,
    u.user_name,
    COUNT(o.order_id) AS order_count,
    SUM(o.amount) AS total_amount
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
WHERE u.register_time >= '2023-01-01'
GROUP BY u.user_id, u.user_name
HAVING order_count > 0;

-- 使用EXPLAIN VERBOSE获取更详细信息
EXPLAIN VERBOSE SELECT * FROM orders WHERE amount > 1000;
```

## 📊 高级分析场景

### 1. 用户行为漏斗分析

```sql
-- 当日行为覆盖统计：未验证view、add_cart、purchase的先后顺序，不是严格有序漏斗；conversion_rate为当日有行为用户中的购买用户占比
WITH user_behaviors AS (
    SELECT 
        user_id,
        SUM(CASE WHEN behavior_type = 'view' THEN 1 ELSE 0 END) AS view_count,
        SUM(CASE WHEN behavior_type = 'add_cart' THEN 1 ELSE 0 END) AS cart_count,
        SUM(CASE WHEN behavior_type = 'purchase' THEN 1 ELSE 0 END) AS purchase_count
    FROM user_behavior_log
    WHERE behavior_date = '2023-06-01'
    GROUP BY user_id
)
SELECT 
    COUNT(DISTINCT user_id) AS total_users,
    SUM(CASE WHEN view_count > 0 THEN 1 ELSE 0 END) AS viewed_users,
    SUM(CASE WHEN cart_count > 0 THEN 1 ELSE 0 END) AS carted_users,
    SUM(CASE WHEN purchase_count > 0 THEN 1 ELSE 0 END) AS purchased_users,
    SUM(CASE WHEN purchase_count > 0 THEN 1 ELSE 0 END) / COUNT(DISTINCT user_id) AS conversion_rate
FROM user_behaviors;
```

### 2. 同环比分析

```sql
-- 销售额同比环比分析
SELECT 
    current_month.month_date,
    current_month.total_amount AS current_amount,
    last_month.total_amount AS last_month_amount,
    last_year.total_amount AS last_year_amount,
    (current_month.total_amount - last_month.total_amount) / NULLIF(last_month.total_amount, 0) AS mom_growth,
    (current_month.total_amount - last_year.total_amount) / NULLIF(last_year.total_amount, 0) AS yoy_growth
FROM (
    SELECT DATE_FORMAT(order_time, '%Y-%m') AS month_date, SUM(amount) AS total_amount
    FROM orders
    WHERE order_time >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 1 MONTH)
      AND order_time < DATE_FORMAT(NOW(), '%Y-%m-01')
    GROUP BY month_date
) current_month
LEFT JOIN (
    SELECT DATE_FORMAT(order_time, '%Y-%m') AS month_date, SUM(amount) AS total_amount
    FROM orders
    WHERE order_time >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 2 MONTH)
      AND order_time < DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 1 MONTH)
    GROUP BY month_date
) last_month ON 1=1
LEFT JOIN (
    SELECT DATE_FORMAT(order_time, '%Y-%m') AS month_date, SUM(amount) AS total_amount
    FROM orders
    WHERE order_time >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 13 MONTH)
      AND order_time < DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 12 MONTH)
    GROUP BY month_date
) last_year ON 1=1;
```

### 3. 用户留存分析

```sql
-- 用户留存分析
WITH user_first_date AS (
    SELECT 
        user_id,
        MIN(DATE(login_time)) AS first_date
    FROM user_login_log
    GROUP BY user_id
),
daily_logins AS (
    SELECT 
        user_id,
        DATE(login_time) AS login_date
    FROM user_login_log
    GROUP BY user_id, login_date
)
SELECT 
    u.first_date,
    COUNT(DISTINCT u.user_id) AS new_users,
    COUNT(DISTINCT CASE WHEN DATEDIFF(d.login_date, u.first_date) = 1 THEN u.user_id END) AS day1_retained,
    COUNT(DISTINCT CASE WHEN DATEDIFF(d.login_date, u.first_date) = 7 THEN u.user_id END) AS day7_retained,
    COUNT(DISTINCT CASE WHEN DATEDIFF(d.login_date, u.first_date) = 30 THEN u.user_id END) AS day30_retained,
    COUNT(DISTINCT CASE WHEN DATEDIFF(d.login_date, u.first_date) = 1 THEN u.user_id END) / COUNT(DISTINCT u.user_id) AS day1_retention_rate,
    COUNT(DISTINCT CASE WHEN DATEDIFF(d.login_date, u.first_date) = 7 THEN u.user_id END) / COUNT(DISTINCT u.user_id) AS day7_retention_rate,
    COUNT(DISTINCT CASE WHEN DATEDIFF(d.login_date, u.first_date) = 30 THEN u.user_id END) / COUNT(DISTINCT u.user_id) AS day30_retention_rate
FROM user_first_date u
LEFT JOIN daily_logins d ON u.user_id = d.user_id
WHERE u.first_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 60 DAY) AND DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY u.first_date
ORDER BY u.first_date;
```

## ⚠️ 常见问题与解决方案

### 1. 查询性能慢

- **问题**：复杂查询执行时间过长
- **解决方案**：
  - 使用EXPLAIN分析查询计划
  - 确保利用分区裁剪
  - 添加适当的JOIN提示
  - 考虑创建物化视图
  - 优化表结构和索引

```sql
-- 使用EXPLAIN分析慢查询
EXPLAIN SELECT 
    u.user_id,
    u.user_name,
    COUNT(o.order_id) AS order_count
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
GROUP BY u.user_id, u.user_name;

-- 添加JOIN提示优化
SELECT /*+ BROADCAST_JOIN(users) */
    u.user_id,
    u.user_name,
    COUNT(o.order_id) AS order_count
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
GROUP BY u.user_id, u.user_name;
```

### 2. 内存溢出

- **问题**：查询执行时出现"Memory limit exceeded"错误
- **解决方案**：
  - 增加查询内存限制
  - 减少查询的数据量
  - 优化JOIN策略
  - 分阶段执行复杂查询

```sql
-- 设置会话级内存限制
SET exec_mem_limit = 8589934592;  -- 8GB

-- 分阶段执行复杂查询
-- 步骤1：创建普通中间表存储结果（tmp_前缀不会使其成为临时表；使用后按权限和数据保留要求清理）
CREATE TABLE tmp_user_stats AS
SELECT 
    user_id,
    COUNT(*) AS order_count,
    SUM(amount) AS total_amount
FROM orders
GROUP BY user_id;

-- 步骤2：基于普通中间表执行后续查询
SELECT 
    u.user_id,
    u.user_name,
    t.order_count,
    t.total_amount
FROM users u
JOIN tmp_user_stats t ON u.user_id = t.user_id
WHERE t.total_amount > 1000;
```

### 3. 结果不一致

- **问题**：聚合结果与预期不符
- **解决方案**：
  - 检查数据类型转换
  - 注意NULL值处理
  - 验证GROUP BY列的完整性
  - 检查JOIN条件是否正确

```sql
-- 处理NULL值
SELECT 
    region,
    COUNT(*) AS total_orders,
    SUM(COALESCE(amount, 0)) AS total_amount,  -- 处理NULL值
    AVG(CASE WHEN amount IS NOT NULL THEN amount END) AS avg_amount  -- 忽略NULL值计算平均值
FROM orders
GROUP BY region;

-- 检查JOIN条件
SELECT 
    o.order_id,
    o.user_id,
    u.user_name
FROM orders o
LEFT JOIN users u ON o.user_id = u.user_id
WHERE u.user_id IS NULL;  -- 检查未匹配的记录
```

## ✅ 掌握检查
- [ ] 能熟练使用Doris SQL进行基本查询和聚合分析
- [ ] 掌握窗口函数的应用场景和用法
- [ ] 了解Doris特有的SQL优化提示
- [ ] 能分析和优化复杂查询的性能
- [ ] 掌握高级分析场景的SQL实现方法

## 🔗 学习连接
**前置知识**: [[【技术与工具】/Doris/09-数据导入方案详解|数据导入方案]]
**下一步**: [[【技术与工具】/Doris/11-物化视图应用|物化视图]]

---

#Doris #SQL查询 #数据分析 #聚合分析 #窗口函数
