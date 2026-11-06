---
title: DISTINCT去重
tags:
  - SQL
  - 查询
  - 基础
  - 去重
  - 唯一值
created: 2024-06-29
updated: 2026-10-10
difficulty: 中级
duration: 60分钟
knowledge_type: technical-practice
target_audience:
  - 数据分析师
  - 数据开发工程师
  - 数据治理工程师
  - BI分析师
stability: stable
status: maintenance
access_tier: free
---


# 🧹 SQL DISTINCT去重操作

> [!abstract] 📋 本节概览
> - 🎯 **学习目标**：掌握DISTINCT关键字的使用方法，实现查询结果的去重和唯一值提取
> - 📚 **前置知识**：[[【技术与工具】/SQL/06-SELECT语句结构|SELECT语句结构]]
> - ⏱️ **预计用时**：15分钟
> - 🔧 **开发环境**：MySQL/PostgreSQL/SQLite
> - 📊 **数据集**：users、orders等关系型表结构

## 🔧 技术定义

**DISTINCT关键字**是SQL中用于去除查询结果中重复行的关键字，它对SELECT语句返回的结果集进行去重处理，确保每一行数据都是唯一的。DISTINCT基于指定列的值进行比较，相同值的多行记录将被合并为一行。

### 🛠️ 工作机制

**处理流程**：
1. **数据获取**：执行基础的SELECT查询获取原始数据集
2. **重复识别**：按SELECT输出列的值组合识别重复；具体执行方式由数据库和执行计划决定
3. **去重处理**：移除重复行，每个唯一值只保留一行
4. **结果输出**：返回去重后的唯一值结果集

**核心特征**：
- **行级去重**：基于整行数据或指定列进行重复判断
- **值比较**：使用精确匹配进行重复性判断（包括NULL值处理）
- **性能影响**：可能增加排序、哈希或其他去重处理的开销，也可能利用索引；具体取决于执行计划
- **结果唯一性**：保证返回结果中每个值组合的唯一性

## 📝 基础语法结构

### 🔨 标准语法

```sql title="DISTINCT基本语法"
SELECT DISTINCT column1, column2, ...
FROM table_name
[WHERE condition]
[ORDER BY column];

-- 单列去重
SELECT DISTINCT column_name FROM table_name;

-- 多列组合去重
SELECT DISTINCT column1, column2 FROM table_name;
```

### 🎯 单列去重

```sql title="单列去重示例"
-- 获取所有不同的城市
SELECT DISTINCT city
FROM users;

-- 获取所有不同的部门
SELECT DISTINCT department
FROM employees
ORDER BY department;

-- 获取所有不同的产品类别
SELECT DISTINCT category
FROM products
WHERE active = 1;

-- 获取所有不同的订单状态
SELECT DISTINCT order_status
FROM orders
WHERE order_date >= '2024-01-01';
```

### 📊 多列组合去重

多列去重时，只有当所有指定列的值完全相同时才被视为重复：

```sql title="多列组合去重示例"
-- 获取城市和省份的唯一组合
SELECT DISTINCT city, province
FROM users
ORDER BY province, city;

-- 获取部门和职位的唯一组合
SELECT DISTINCT department, job_title
FROM employees
WHERE status = 'active';

-- 获取产品类别和品牌的唯一组合
SELECT DISTINCT category, brand
FROM products
WHERE stock_quantity > 0;

-- 获取年月和订单状态的唯一组合
SELECT DISTINCT 
    DATE_FORMAT(order_date, '%Y-%m') as order_month,
    order_status
FROM orders
ORDER BY order_month DESC;
```

## 🔍 DISTINCT的高级应用

### 📈 与聚合函数结合

```sql title="DISTINCT与聚合函数结合"
-- 统计不同城市的数量
SELECT COUNT(DISTINCT city) as unique_cities_count
FROM users;

-- 统计指定日期范围内有订单的不同非NULL用户数
SELECT COUNT(DISTINCT user_id) as unique_customers
FROM orders
WHERE order_date >= '2024-01-01';

-- 计算不同价格值的平均数；多个产品价格相同时，该价格只参与一次计算
SELECT AVG(DISTINCT price) as avg_unique_price
FROM products
WHERE category = 'electronics';

-- 统计每个部门的不同职位数量
SELECT 
    department,
    COUNT(DISTINCT job_title) as unique_positions
FROM employees
GROUP BY department
ORDER BY unique_positions DESC;
```

### 🔗 与子查询结合

```sql title="DISTINCT在子查询中的应用"
-- 查找有订单的用户的详细信息
SELECT user_id, username, email
FROM users
WHERE user_id IN (
    SELECT DISTINCT user_id 
    FROM orders 
    WHERE order_status = 'completed'
);

-- 查找销售过的产品类别
SELECT category, COUNT(*) as product_count
FROM products
WHERE category IN (
    SELECT DISTINCT category
    FROM order_items oi
    INNER JOIN products p ON oi.product_id = p.product_id
)
GROUP BY category;

-- 使用EXISTS进行去重检查
SELECT DISTINCT u.city
FROM users u
WHERE EXISTS (
    SELECT 1 
    FROM orders o 
    WHERE o.user_id = u.user_id 
      AND o.order_date >= '2024-01-01'
);
```

### 🎭 条件去重

```sql title="条件性去重查询"
-- 按条件获取不同的用户类型
SELECT DISTINCT
    CASE 
        WHEN age < 25 THEN '青年用户'
        WHEN age BETWEEN 25 AND 35 THEN '中年用户'
        ELSE '成熟用户'
    END as user_type
FROM users
WHERE status = 'active';

-- 获取不同价格区间的产品
SELECT DISTINCT
    CASE 
        WHEN price < 100 THEN '低价产品'
        WHEN price BETWEEN 100 AND 1000 THEN '中价产品'
        ELSE '高价产品'
    END as price_range
FROM products
ORDER BY price_range;

-- 条件性多字段去重
SELECT DISTINCT 
    department,
    CASE 
        WHEN salary >= 10000 THEN '高薪'
        WHEN salary >= 5000 THEN '中薪'
        ELSE '基础薪'
    END as salary_level
FROM employees
WHERE hire_date >= '2023-01-01';
```

## 🏢 业务应用场景

### 📊 数据分析与报表

```sql title="数据分析中的去重应用"
-- 客户地域分布分析
SELECT DISTINCT 
    city,
    province,
    COUNT(*) as customer_count
FROM users
WHERE registration_date >= '2024-01-01'
GROUP BY city, province
ORDER BY customer_count DESC;

-- 产品销售渠道分析
SELECT DISTINCT 
    sales_channel,
    COUNT(DISTINCT product_id) as products_sold,
    SUM(sales_amount) as total_revenue
FROM sales_records
WHERE sales_date >= '2024-01-01'
GROUP BY sales_channel;

-- 用户行为路径分析
SELECT DISTINCT 
    page_from,
    page_to,
    COUNT(*) as transition_count
FROM user_page_visits
WHERE visit_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY page_from, page_to
HAVING transition_count > 100
ORDER BY transition_count DESC;
```

### 🎯 营销和用户分析

```sql title="营销分析去重应用"
-- 获取活跃用户的唯一设备类型
SELECT DISTINCT device_type
FROM user_sessions
WHERE last_activity >= DATE_SUB(NOW(), INTERVAL 7 DAY);

-- 分析不同营销渠道的用户来源
SELECT DISTINCT 
    marketing_channel,
    COUNT(DISTINCT user_id) as unique_users,
    AVG(conversion_rate) as avg_conversion
FROM user_acquisition
WHERE acquisition_date >= '2024-01-01'
GROUP BY marketing_channel
ORDER BY unique_users DESC;

-- 客户生命周期阶段分析
SELECT DISTINCT 
    customer_segment,
    lifecycle_stage,
    COUNT(*) as customer_count
FROM customer_analysis
WHERE analysis_date = (SELECT MAX(analysis_date) FROM customer_analysis)
GROUP BY customer_segment, lifecycle_stage;
```

### 🔍 数据质量检查

```sql title="数据质量分析去重"
-- 检查重复的用户邮箱
SELECT email, COUNT(*) as duplicate_count
FROM users
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 查找可能的重复订单
SELECT 
    user_id,
    order_amount,
    DATE(order_date) as order_day,
    COUNT(*) as potential_duplicates
FROM orders
GROUP BY user_id, order_amount, DATE(order_date)
HAVING COUNT(*) > 1;

-- 识别数据完整性问题
SELECT DISTINCT
    CASE WHEN email IS NULL THEN '缺少邮箱' END,
    CASE WHEN phone IS NULL THEN '缺少电话' END,
    CASE WHEN city IS NULL THEN '缺少城市' END
FROM users
WHERE email IS NULL OR phone IS NULL OR city IS NULL;
```

## ⚡ 性能优化要点

### 🚀 DISTINCT性能优化

1. **索引优化**：为DISTINCT字段创建适当索引
2. **限制结果集**：配合WHERE条件减少数据量
3. **避免不必要的DISTINCT**：确认是否真的需要去重
4. **使用GROUP BY替代**：某些场景下GROUP BY性能更好

```sql title="性能优化示例"
-- ❌ 性能较差：对大表全列去重
SELECT DISTINCT * FROM large_table;

-- ✅ 性能优化：添加WHERE条件和索引
CREATE INDEX idx_users_city_active ON users(city, status);
SELECT DISTINCT city
FROM users
WHERE status = 'active';

-- ❌ 性能较差：不必要的DISTINCT
SELECT DISTINCT user_id FROM orders GROUP BY user_id;

-- ✅ 性能优化：使用GROUP BY
SELECT user_id FROM orders GROUP BY user_id;

-- 复杂去重的优化：使用窗口函数
SELECT user_id, email, registration_date
FROM (
    SELECT 
        user_id, 
        email, 
        registration_date,
        ROW_NUMBER() OVER (PARTITION BY email ORDER BY registration_date) as rn
    FROM users
) ranked
WHERE rn = 1;
```

### 📊 大数据集去重策略

```sql title="企业级去重优化"
-- 分批次处理大数据集去重
WITH batch_distinct AS (
    SELECT DISTINCT user_id, city
    FROM users
    WHERE user_id BETWEEN 1 AND 100000
)
SELECT COUNT(*) as unique_user_city_combinations
FROM batch_distinct;

-- 使用临时表进行复杂去重
CREATE TEMPORARY TABLE temp_distinct_analysis AS
SELECT DISTINCT 
    DATE_FORMAT(order_date, '%Y-%m') as order_month,
    user_id,
    product_category
FROM orders o
INNER JOIN products p ON o.product_id = p.product_id
WHERE o.order_date >= '2024-01-01';

-- 对临时表进行进一步分析
SELECT order_month, COUNT(DISTINCT user_id) as unique_customers
FROM temp_distinct_analysis
GROUP BY order_month;
```

## ⚠️ 常见错误与注意事项

### 🚫 易错点分析

1. **NULL值处理**：DISTINCT将NULL视为相同值
2. **性能影响**：大数据集上的DISTINCT可能很慢
3. **与ORDER BY配合**：DISTINCT查询对排序表达式的限制因数据库而异；使用SELECT输出列排序更具可移植性，不要求所有去重字段都出现在ORDER BY中
4. **误用场景**：某些情况下GROUP BY更合适

```sql title="常见错误示例及修正"
-- ❌ 错误：ORDER BY字段不在DISTINCT中
SELECT DISTINCT city FROM users ORDER BY registration_date;

-- 注意：加入registration_date后，去重粒度变为城市与注册日期的组合，不再是仅按城市去重
SELECT DISTINCT city, registration_date FROM users ORDER BY registration_date;
-- 或者
SELECT DISTINCT city FROM users ORDER BY city;

-- 保留缺失值类别：合法查询，多个NULL在去重结果中只保留一个
SELECT DISTINCT phone FROM users;

-- 仅需非空电话号码时，显式排除NULL
SELECT DISTINCT phone FROM users WHERE phone IS NOT NULL;

-- 统计每个用户的订单数后，返回其中不同的计数值；不是不同用户总数
SELECT DISTINCT COUNT(*) FROM orders GROUP BY user_id;

-- 若需求是统计不同的非NULL用户数，使用以下查询；两者统计口径不同
SELECT COUNT(DISTINCT user_id) FROM orders;
```

## 📋 最佳实践

### ✅ 设计原则

1. **明确去重需求**：确认是否真的需要去重处理
2. **性能优先考虑**：为去重字段建立合适索引
3. **结果可预期**：理解NULL值在去重中的表现
4. **选择合适方法**：根据场景选择DISTINCT或GROUP BY

```sql title="最佳实践示例"
-- 标准的去重查询模板
SELECT DISTINCT 
    u.city,
    u.province,
    COUNT(*) as user_count
FROM users u
WHERE u.status = 'active'
  AND u.registration_date >= '2024-01-01'
GROUP BY u.city, u.province
HAVING user_count >= 10
ORDER BY user_count DESC;

-- 高效的存在性检查
SELECT DISTINCT category
FROM products p
WHERE EXISTS (
    SELECT 1 
    FROM order_items oi 
    WHERE oi.product_id = p.product_id
);

-- 结合业务逻辑的去重
SELECT DISTINCT
    customer_id,
    customer_name,
    FIRST_VALUE(last_order_date) OVER (
        PARTITION BY customer_id 
        ORDER BY last_order_date DESC
    ) as latest_order_date
FROM customer_orders
WHERE order_status = 'completed';
```

## ✅ 技能检查清单

**基础技能认证**：
- [ ] 理解DISTINCT关键字的基本概念和工作原理
- [ ] 掌握单列和多列去重的语法差异
- [ ] 了解DISTINCT对NULL值的处理方式
- [ ] 能够将DISTINCT与WHERE、ORDER BY子句组合使用
- [ ] 掌握DISTINCT与聚合函数的结合应用
- [ ] 理解DISTINCT对查询性能的影响

**进阶技能**：
- [ ] 能够在复杂业务场景中合理使用去重
- [ ] 掌握DISTINCT与GROUP BY的选择原则
- [ ] 熟练处理大数据集的去重优化
- [ ] 能够设计高效的去重查询方案
- [ ] 了解去重在数据质量分析中的应用

**下一步学习**：[[【技术与工具】/Presto/10-JOIN优化与子查询|Presto/JOIN优化与子查询]] - 学习嵌套查询和复杂数据检索

---