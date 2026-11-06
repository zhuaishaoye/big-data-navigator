---
title: LIMIT分页查询
tags:
  - SQL
  - 查询
  - 基础
  - 分页
  - 限制
created: 2024-06-29
updated: 2026-10-10
difficulty: 中级
duration: 60分钟
knowledge_type: technical-practice
target_audience:
  - 数据分析师
  - 数据开发工程师
  - BI分析师
stability: slow-changing
status: maintenance
access_tier: free
---


# 📏 SQL LIMIT分页查询操作

> [!abstract] 📋 本节概览
> - 🎯 **学习目标**：掌握LIMIT和OFFSET子句的使用方法，实现数据分页和结果集限制
> - 📚 **前置知识**：[[【技术与工具】/SQL/08-ORDER BY排序|ORDER BY排序]]
> - ⏱️ **预计用时**：20分钟
> - 🔧 **开发环境**：MySQL/PostgreSQL/SQLite
> - 📊 **数据集**：users、orders等关系型表结构

## 🔧 技术定义

**LIMIT子句**是SQL中用于限制查询结果集大小的子句，它指定了要返回的最大记录数。**OFFSET子句**与LIMIT结合使用，指定从结果集的哪个位置开始返回记录，两者共同实现数据分页功能。

### 🛠️ 执行机制

**处理顺序**：
1. **数据过滤**：执行WHERE子句进行记录筛选
2. **数据分组**：执行GROUP BY进行数据分组（如果有）
3. **结果排序**：执行ORDER BY对结果集排序
4. **结果限制**：最后执行LIMIT和OFFSET限制返回的记录数和位置

**核心特征**：
- **结果集切片**：对排序后的结果集进行切片操作
- **结果传输优化**：减少返回给客户端的数据量；数据库内部的扫描、排序和内存开销仍取决于执行计划
- **分页支持**：为Web应用和API提供分页功能基础
- **返回量控制**：限制返回记录数，但不保证避免全表扫描、排序或其他高成本操作

## 📝 基础语法结构

### 🔨 标准语法

```sql title="LIMIT基本语法"
SELECT column1, column2, ...
FROM table_name
[WHERE condition]
[ORDER BY column]
LIMIT row_count [OFFSET offset_value];

-- MySQL的替代语法
LIMIT offset_value, row_count;
```

### 📊 基础限制操作

```sql title="基础LIMIT使用示例"
-- 获取前10条记录
SELECT user_id, username, email
FROM users
LIMIT 10;

-- 获取薪资最高的前5名员工
SELECT employee_id, name, salary
FROM employees
ORDER BY salary DESC
LIMIT 5;

-- 获取最新注册的20个用户
SELECT user_id, username, registration_date
FROM users
ORDER BY registration_date DESC
LIMIT 20;

-- 获取指定条件下的前N条记录
SELECT order_id, user_id, order_amount
FROM orders
WHERE order_status = 'completed'
ORDER BY order_date DESC
LIMIT 50;
```

### 🔄 OFFSET分页操作

```sql title="OFFSET分页查询示例"
-- 标准语法：获取第2页数据（每页10条，跳过前10条）
SELECT user_id, username, email
FROM users
ORDER BY user_id
LIMIT 10 OFFSET 10;

-- 获取第3页数据（每页20条，跳过前40条）
SELECT product_id, product_name, price
FROM products
ORDER BY product_id
LIMIT 20 OFFSET 40;

-- MySQL专用语法：LIMIT offset, count
SELECT order_id, user_id, order_amount
FROM orders
ORDER BY order_date DESC
LIMIT 30, 10;  -- 跳过30条，取10条

-- PostgreSQL示例：获取大数据集的分页
SELECT customer_id, customer_name, city
FROM customers
ORDER BY customer_name
LIMIT 25 OFFSET 100;
```

## 🔍 高级分页特性

### 📱 动态分页计算

```sql title="分页计算公式应用"
-- 分页公式：OFFSET = (page_number - 1) * page_size
-- 第1页：OFFSET = (1-1) * 20 = 0
SELECT user_id, username FROM users ORDER BY user_id LIMIT 20 OFFSET 0;

-- 第3页：OFFSET = (3-1) * 20 = 40
SELECT user_id, username FROM users ORDER BY user_id LIMIT 20 OFFSET 40;

-- 第5页：OFFSET = (5-1) * 20 = 80
SELECT user_id, username FROM users ORDER BY user_id LIMIT 20 OFFSET 80;

-- 固定参数分页示例：第3页，每页20条
-- 动态分页应由应用层计算偏移量，并按驱动支持的方式绑定整数参数
SELECT 
    user_id,
    username,
    email,
    registration_date
FROM users
WHERE status = 'active'
ORDER BY registration_date DESC
LIMIT 20 OFFSET 40;
```

### 📊 总数统计与分页

```sql title="分页与总数统计结合"
-- 获取总记录数（用于计算总页数）
SELECT COUNT(*) as total_count
FROM users
WHERE status = 'active';

-- 获取分页数据和总数（MySQL）
SELECT 
    user_id,
    username,
    email,
    COUNT(*) OVER() as total_count
FROM users
WHERE status = 'active'
ORDER BY registration_date DESC
LIMIT 20 OFFSET 0;

-- 使用子查询方式
SELECT 
    u.*,
    (SELECT COUNT(*) FROM users WHERE status = 'active') as total_count
FROM (
    SELECT user_id, username, email
    FROM users
    WHERE status = 'active'
    ORDER BY registration_date DESC
    LIMIT 20 OFFSET 0
) u;
```

### 🔀 不同数据库的语法差异

```sql title="数据库兼容性语法"
-- MySQL: 支持两种语法
SELECT * FROM users ORDER BY user_id LIMIT 10 OFFSET 20;
SELECT * FROM users ORDER BY user_id LIMIT 20, 10;

-- PostgreSQL: 标准语法
SELECT * FROM users ORDER BY user_id LIMIT 10 OFFSET 20;

-- SQL Server: 使用OFFSET-FETCH
SELECT * FROM users 
ORDER BY user_id 
OFFSET 20 ROWS 
FETCH NEXT 10 ROWS ONLY;

-- Oracle: 使用ROW_NUMBER()按user_id生成排序行号（假设user_id唯一）
SELECT * FROM (
    SELECT u.*, ROW_NUMBER() OVER (ORDER BY user_id) rn FROM users u
) WHERE rn BETWEEN 21 AND 30
ORDER BY rn;

-- SQLite: 标准语法
SELECT * FROM users ORDER BY user_id LIMIT 10 OFFSET 20;
```

## 🏢 业务应用场景

### 📱 Web应用分页

```sql title="典型Web分页查询"
-- 用户列表分页（每页15条）
SELECT 
    user_id,
    username,
    email,
    registration_date,
    last_login_date
FROM users
WHERE status = 'active'
ORDER BY last_login_date DESC NULLS LAST
LIMIT 15 OFFSET 0;  -- 第1页

-- 产品列表分页带筛选
SELECT 
    product_id,
    product_name,
    category,
    price,
    stock_quantity
FROM products
WHERE category = 'electronics' 
  AND price BETWEEN 100 AND 1000
  AND stock_quantity > 0
ORDER BY price ASC
LIMIT 12 OFFSET 24;  -- 第3页，每页12个产品

-- 订单历史分页查询
SELECT 
    order_id,
    order_date,
    order_status,
    order_amount,
    customer_name
FROM orders o
INNER JOIN customers c ON o.customer_id = c.customer_id
WHERE o.order_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
ORDER BY o.order_date DESC
LIMIT 25 OFFSET 50;  -- 第3页，每页25条
```

### 📊 数据分析中的采样

```sql title="数据采样和分析应用"
-- 随机采样分析（需要配合ORDER BY RANDOM()）
SELECT 
    user_id,
    age,
    city,
    registration_date
FROM users
WHERE status = 'active'
ORDER BY RANDOM()  -- PostgreSQL语法，MySQL使用RAND()
LIMIT 1000;  -- 随机采样1000个用户

-- 时间序列数据分页分析
SELECT 
    DATE(created_at) as date,
    COUNT(*) as daily_registrations,
    AVG(age) as avg_age
FROM users
WHERE created_at >= '2024-01-01'
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 30;  -- 筛选范围内最近最多30个有记录的日期分组，不一定是最近30个自然日

-- 性能数据分页查询
SELECT 
    query_id,
    execution_time,
    query_text,
    executed_at
FROM query_performance_log
WHERE execution_time > 1000  -- 超过1秒的查询
ORDER BY execution_time DESC
LIMIT 20;  -- 最慢的20个查询
```

### 🔄 数据导出和批处理

```sql title="批量处理应用"
-- 分批处理大数据集
SELECT 
    user_id,
    email,
    last_activity_date
FROM users
WHERE last_activity_date < DATE_SUB(CURDATE(), INTERVAL 365 DAY)
ORDER BY user_id
LIMIT 1000 OFFSET 0;  -- 第一批

-- 数据迁移分页处理
SELECT 
    old_id,
    data_field1,
    data_field2,
    created_at
FROM legacy_table
WHERE migrated = FALSE
ORDER BY old_id
LIMIT 500;  -- 每次迁移500条记录

-- 邮件发送分页处理
SELECT 
    user_id,
    email,
    subscription_status
FROM newsletter_subscribers
WHERE subscription_status = 'active'
  AND last_email_sent < DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY last_email_sent ASC
LIMIT 100;  -- 每批发送100封邮件
```

## ⚡ 性能优化要点

### 🚀 分页性能优化

1. **索引优化**：为ORDER BY和WHERE字段创建合适的索引
2. **避免大OFFSET**：大偏移量会导致性能问题
3. **游标分页**：使用基于游标的分页替代OFFSET
4. **缓存总数**：避免每次都重新计算总记录数

```sql title="性能优化示例"
-- ❌ 性能较差：大OFFSET值
SELECT user_id, username
FROM users
ORDER BY user_id
LIMIT 20 OFFSET 100000;  -- 需要跳过10万条记录

-- ✅ 性能优化：使用游标分页
SELECT user_id, username
FROM users
WHERE user_id > 123456  -- 上一页最后一条记录的ID
ORDER BY user_id
LIMIT 20;

-- 为分页查询创建合适的索引
CREATE INDEX idx_users_status_registration ON users(status, registration_date DESC);

-- 优化的分页查询
SELECT user_id, username, registration_date
FROM users
WHERE status = 'active'
ORDER BY registration_date DESC
LIMIT 20 OFFSET 0;
```

### 📊 高性能分页方案

```sql title="企业级分页优化"
-- 使用窗口函数实现行号分页及总数统计；是否高效取决于执行计划和数据规模
WITH paginated_data AS (
    SELECT 
        user_id,
        username,
        email,
        ROW_NUMBER() OVER (ORDER BY registration_date DESC) as row_num,
        COUNT(*) OVER() as total_count
    FROM users
    WHERE status = 'active'
)
SELECT 
    user_id,
    username,
    email,
    total_count
FROM paginated_data
WHERE row_num BETWEEN 21 AND 40;  -- 第2页（21-40）

-- 基于键集分页（Keyset Pagination）
SELECT 
    user_id,
    username,
    registration_date
FROM users
WHERE status = 'active'
  AND (registration_date, user_id) < ('2024-01-15 10:30:00', 12345)
ORDER BY registration_date DESC, user_id DESC
LIMIT 20;

-- 混合索引覆盖查询
CREATE INDEX idx_users_covering ON users(status, registration_date DESC, user_id, username);

SELECT user_id, username, registration_date
FROM users
WHERE status = 'active'
ORDER BY registration_date DESC
LIMIT 20;
```

## ⚠️ 常见错误与注意事项

### 🚫 易错点分析

1. **忘记ORDER BY**：分页查询必须保证排序的一致性
2. **OFFSET性能问题**：大偏移量导致查询缓慢
3. **数据库兼容性**：不同数据库的LIMIT语法差异
4. **总数计算错误**：分页总数计算不准确

```sql title="常见错误示例及修正"
-- ❌ 错误：没有ORDER BY导致结果不一致
SELECT user_id, username FROM users LIMIT 10 OFFSET 20;

-- 添加ORDER BY建立排序顺序；假设user_id唯一，并发数据变更仍可能使OFFSET分页重复或遗漏记录
SELECT user_id, username FROM users 
ORDER BY user_id 
LIMIT 10 OFFSET 20;

-- ❌ 错误：OFFSET值过大导致性能问题
SELECT * FROM large_table LIMIT 10 OFFSET 1000000;

-- 延迟获取完整记录的分页示例：子查询仍使用大OFFSET，是否改善性能取决于索引和执行计划
SELECT * FROM large_table 
WHERE id > (SELECT id FROM large_table ORDER BY id LIMIT 1 OFFSET 999999)
ORDER BY id 
LIMIT 10;

-- ❌ 错误：MySQL语法顺序错误
SELECT * FROM users LIMIT OFFSET 20 10;  -- 语法错误

-- ✅ 正确：MySQL语法
SELECT * FROM users LIMIT 10 OFFSET 20;
-- 或者
SELECT * FROM users LIMIT 20, 10;
```

## 📋 最佳实践

### ✅ 设计原则

1. **一致性排序**：分页查询必须包含ORDER BY子句
2. **索引支持**：为排序和过滤字段建立合适索引
3. **合理页大小**：根据应用场景设置合适的页面大小
4. **性能监控**：监控大偏移量查询的性能表现

```sql title="最佳实践示例"
-- 标准分页查询模板
SELECT 
    u.user_id,
    u.username,
    u.email,
    u.registration_date,
    COUNT(*) OVER() as total_count
FROM users u
WHERE u.status = 'active'
  AND u.registration_date >= '2024-01-01'
ORDER BY u.registration_date DESC, u.user_id DESC  -- 多字段排序确保唯一性
LIMIT 25 OFFSET 0;

-- 分页存储过程示例（MySQL）；封装为存储过程并不自动提高分页性能
DELIMITER $$
CREATE PROCEDURE GetUsersPaginated(
    IN page_number INT,
    IN page_size INT,
    IN status_filter VARCHAR(20),
    OUT total_count INT
)
BEGIN
    DECLARE offset_value INT;
    SET offset_value = (page_number - 1) * page_size;
    -- 调用方须保证page_number和page_size均为正整数
    -- 获取总数
    SELECT COUNT(*) INTO total_count
    FROM users
    WHERE status = status_filter;
    
    -- 获取分页数据
    SELECT 
        user_id,
        username,
        email,
        registration_date
    FROM users
    WHERE status = status_filter
    ORDER BY registration_date DESC, user_id DESC
    LIMIT page_size OFFSET offset_value;
END$$
DELIMITER ;

-- 调用存储过程
CALL GetUsersPaginated(2, 20, 'active', @total);
SELECT @total as total_records;
```

## ✅ 技能检查清单

**基础技能认证**：
- [ ] 理解LIMIT子句的基本概念和执行顺序
- [ ] 掌握LIMIT和OFFSET的基本语法
- [ ] 了解不同数据库系统的LIMIT语法差异
- [ ] 能够计算分页的OFFSET值
- [ ] 理解ORDER BY与分页查询的重要关系
- [ ] 掌握基本的Web应用分页实现

**进阶技能**：
- [ ] 能够实现高性能的分页查询方案
- [ ] 掌握基于游标的分页优化技术
- [ ] 了解大数据集分页的性能考虑
- [ ] 熟练处理分页查询中的总数计算
- [ ] 能够设计适合业务需求的分页策略

**下一步学习**：[[【技术与工具】/SQL/10-DISTINCT去重|DISTINCT去重]] - 学习数据去重和唯一值处理

---