---
title: WHERE条件筛选
tags:
  - SQL
  - 查询
  - 基础
  - 条件筛选
  - 过滤
created: 2024-06-29
updated: 2026-10-10
difficulty: 中级
duration: 45分钟
knowledge_type: technical-practice
target_audience:
  - 数据分析师
  - 数据开发工程师
  - BI分析师
  - 数据科学家
stability: slow-changing
status: maintenance
access_tier: free
---


# 🔍 SQL WHERE条件筛选

> [!abstract] 📋 本节概览
> - 🎯 **学习目标**：掌握WHERE子句的使用方法，实现精确的数据筛选和条件过滤
> - 📚 **前置知识**：[[【技术与工具】/SQL/06-SELECT语句结构|SELECT语句结构]]
> - ⏱️ **预计用时**：20分钟
> - 🔧 **开发环境**：基础WHERE语法可用于MySQL/PostgreSQL/SQLite；日期函数及部分业务、聚合示例采用MySQL写法，其他数据库需调整函数和语法。进阶示例另需JOIN、GROUP BY、HAVING、子查询及索引基础。
> - 📊 **数据集**：users、orders等关系型表结构

## 🔧 技术定义

**WHERE子句**是SQL中用于指定数据筛选条件的子句，它通过布尔表达式对数据进行过滤，只返回满足条件的记录。WHERE子句是数据库查询的核心组件，支持多种比较运算符、逻辑运算符和函数，实现复杂的数据筛选逻辑。

### 🛠️ 执行机制

**处理顺序**：
1. **数据访问**：逻辑上从FROM指定的数据源取得候选行；实际执行可能使用表扫描、索引访问等路径，由优化器选择
2. **条件评估**：对每一行记录评估WHERE条件
3. **行过滤**：只保留WHERE条件为TRUE的记录
4. **结果传递**：将过滤后的结果传递给后续处理阶段

**核心特征**：
- **行级过滤**：对每一行记录进行条件判断
- **三值逻辑**：条件可能评估为TRUE、FALSE或UNKNOWN；WHERE只保留结果为TRUE的行
- **索引优化**：可以利用索引加速条件筛选
- **早期过滤**：在查询处理的早期阶段执行，提高效率

## 📝 基础条件筛选

### 🔨 基本语法结构

```sql title="WHERE基本语法"
SELECT column1, column2, ...
FROM table_name
WHERE condition;

-- 条件可以是：
-- 1. 比较表达式：column operator value
-- 2. 逻辑表达式：condition1 AND/OR condition2
-- 3. 函数表达式：FUNCTION(column) operator value
```

### 📊 比较运算符

```sql title="基础比较运算符示例"
-- 等于运算符
SELECT user_id, username, age
FROM users
WHERE age = 25;

-- 不等于运算符
SELECT product_id, product_name, price
FROM products
WHERE category != 'electronics';

-- 大于/小于运算符
SELECT employee_id, name, salary
FROM employees
WHERE salary > 50000;

-- 大于等于/小于等于运算符
SELECT order_id, order_date, order_amount
FROM orders
WHERE order_amount >= 1000 AND order_amount <= 5000;

-- 范围查询 BETWEEN
SELECT user_id, username, registration_date
FROM users
WHERE registration_date BETWEEN '2024-01-01' AND '2024-12-31';
```

### 🎭 模式匹配与字符串查询

```sql title="字符串匹配和模糊查询"
-- LIKE模糊匹配
SELECT user_id, username, email
FROM users
WHERE username LIKE 'admin%';  -- 以admin开头

SELECT product_id, product_name
FROM products
WHERE product_name LIKE '%phone%';  -- 包含phone

SELECT customer_name, phone
FROM customers
WHERE phone LIKE '138________';  -- 匹配138开头、后接8个字符的值；不保证后8个字符均为数字

-- 不区分大小写的匹配（MySQL）
SELECT user_id, username
FROM users
WHERE LOWER(username) LIKE 'john%';

-- 正则表达式匹配（MySQL）
SELECT user_id, email
FROM users
WHERE email REGEXP '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$';
```

### 🔄 NULL值处理

```sql title="NULL值条件查询"
-- 查找NULL值
SELECT user_id, username, phone
FROM users
WHERE phone IS NULL;

-- 查找非NULL值
SELECT user_id, username, last_login_date
FROM users
WHERE last_login_date IS NOT NULL;

-- 使用COALESCE处理NULL值
SELECT user_id, username, COALESCE(phone, 'N/A') as phone_display
FROM users
WHERE COALESCE(phone, '') != '';

-- NULL值的比较特性
SELECT user_id, username, age
FROM users
WHERE age IS NOT NULL AND age > 18;
```

## 🔗 逻辑运算符与复合条件

### 🧩 AND、OR、NOT逻辑

```sql title="逻辑运算符组合条件"
-- AND逻辑：所有条件都必须为TRUE
SELECT user_id, username, city, age
FROM users
WHERE city = 'Beijing' AND age > 25 AND status = 'active';

-- OR逻辑：任一条件为TRUE即可
SELECT order_id, user_id, order_status
FROM orders
WHERE order_status = 'pending' OR order_status = 'processing';

-- NOT逻辑：条件取反
SELECT user_id, username, city
FROM users
WHERE NOT (city = 'Shanghai' OR city = 'Beijing');

-- 复杂逻辑组合
SELECT product_id, product_name, category, price
FROM products
WHERE (category = 'electronics' AND price > 1000)
   OR (category = 'books' AND price > 100)
   AND stock_quantity > 0;
```

### 📋 IN和NOT IN操作

```sql title="IN操作符多值匹配"
-- IN操作符：匹配多个值
SELECT user_id, username, city
FROM users
WHERE city IN ('Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen');

-- NOT IN操作符：排除多个值
SELECT product_id, product_name, category
FROM products
WHERE category NOT IN ('electronics', 'clothing');

-- IN与子查询结合
SELECT user_id, username, email
FROM users
WHERE user_id IN (
    SELECT DISTINCT user_id
    FROM orders
    WHERE order_date >= '2024-01-01'
);

-- 处理IN中的NULL值问题
SELECT user_id, username
FROM users
WHERE city IN ('Beijing', 'Shanghai', NULL);  -- 匹配前两项时为TRUE，否则为UNKNOWN；WHERE只保留TRUE。NOT IN列表含NULL时也需特别注意
```

## 🔍 高级条件筛选

### 📅 日期和时间条件

```sql title="日期时间条件查询"
-- 日期范围查询
SELECT order_id, user_id, order_date, order_amount
FROM orders
WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY);

-- 特定日期格式查询
SELECT user_id, username, registration_date
FROM users
WHERE DATE(registration_date) = '2024-01-01';

-- 时间范围查询
SELECT log_id, user_id, action, created_at
FROM user_activity_log
WHERE created_at >= '2024-01-01 00:00:00'
  AND created_at < '2024-02-01 00:00:00';

-- 按周、月、年筛选
SELECT order_id, order_date, order_amount
FROM orders
WHERE YEAR(order_date) = 2024 AND MONTH(order_date) = 1;

-- 工作日筛选
SELECT user_id, login_time
FROM user_login_log
WHERE DAYOFWEEK(login_time) BETWEEN 2 AND 6;  -- 周一到周五
```

### 🎯 条件表达式和CASE

```sql title="条件表达式查询"
-- CASE表达式在WHERE中的应用
SELECT user_id, username, age,
       CASE 
           WHEN age < 25 THEN '年轻用户'
           WHEN age BETWEEN 25 AND 35 THEN '中年用户'
           ELSE '成熟用户'
       END as user_category
FROM users
WHERE CASE 
          WHEN age < 25 THEN 'young'
          WHEN age BETWEEN 25 AND 35 THEN 'middle'
          ELSE 'mature'
      END = 'young';

-- IF函数条件筛选（MySQL）
SELECT user_id, username, status
FROM users
WHERE IF(last_login_date IS NULL, 0, 
         DATEDIFF(CURDATE(), last_login_date)) <= 7;

-- 复杂业务逻辑条件
SELECT order_id, user_id, order_amount, discount_rate
FROM orders
WHERE (order_amount > 1000 AND discount_rate < 0.1)
   OR (order_amount <= 1000 AND discount_rate < 0.05);
```

### 🔢 数值计算条件

```sql title="数值计算和函数条件"
-- 数学运算条件
SELECT product_id, product_name, price, discount_price
FROM products
WHERE (price - discount_price) / price > 0.2;  -- 折扣超过20%

-- 聚合函数条件（需要在子查询中使用）
SELECT user_id, username
FROM users
WHERE user_id IN (
    SELECT user_id
    FROM orders
    GROUP BY user_id
    HAVING COUNT(*) > 5 AND SUM(order_amount) > 10000
);

-- 字符串函数条件
SELECT user_id, username, email
FROM users
WHERE LENGTH(username) > 10 
  AND SUBSTRING(email, LOCATE('@', email) + 1) = 'company.com';
```

## 🏢 业务应用场景

### 📊 电商业务筛选

```sql title="电商业务条件查询"
-- 活跃高价值客户筛选
SELECT u.user_id, u.username, u.email, u.registration_date
FROM users u
WHERE u.status = 'active'
  AND u.registration_date >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)
  AND u.user_id IN (
      SELECT o.user_id
      FROM orders o
      WHERE o.order_status = 'completed'
        AND o.order_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
      GROUP BY o.user_id
      HAVING SUM(o.order_amount) > 5000
  );

-- 库存预警商品查询
SELECT p.product_id, p.product_name, p.category, p.stock_quantity, p.reorder_point
FROM products p
WHERE p.stock_quantity <= p.reorder_point
  AND p.status = 'active'
  AND p.category IN ('electronics', 'clothing', 'books')
ORDER BY (p.reorder_point - p.stock_quantity) DESC;

-- 异常订单检测
SELECT o.order_id, o.user_id, o.order_amount, o.created_at
FROM orders o
WHERE (
    (o.order_amount > 10000 AND HOUR(o.created_at) BETWEEN 0 AND 6)  -- 深夜大额订单
    OR (o.order_amount < 1 AND o.order_status = 'completed')  -- 异常小额订单
    OR (TIMESTAMPDIFF(MINUTE, o.created_at, o.updated_at) < 1 AND o.order_status = 'completed')  -- 快速完成订单
);
```

### 👥 用户行为分析

```sql title="用户行为筛选查询"
-- 流失用户识别
SELECT u.user_id, u.username, u.last_login_date, u.registration_date
FROM users u
WHERE u.last_login_date < DATE_SUB(CURDATE(), INTERVAL 90 DAY)
  AND u.registration_date < DATE_SUB(CURDATE(), INTERVAL 180 DAY)
  AND u.status = 'active'
  AND NOT EXISTS (
      SELECT 1 FROM orders o 
      WHERE o.user_id = u.user_id 
        AND o.order_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
  );

-- 新用户转化分析
SELECT u.user_id, u.username, u.registration_date, 
       COUNT(o.order_id) as first_month_orders
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id 
    AND o.order_date BETWEEN u.registration_date 
    AND DATE_ADD(u.registration_date, INTERVAL 30 DAY)
WHERE u.registration_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY u.user_id, u.username, u.registration_date
HAVING first_month_orders > 0;

-- 多平台用户活跃度
SELECT ul.user_id, COUNT(DISTINCT ul.platform) as platform_count,
       COUNT(*) as total_logins
FROM user_login_log ul
WHERE ul.login_time >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
  AND ul.platform IN ('web', 'mobile_app', 'wechat_mini')
GROUP BY ul.user_id
HAVING platform_count >= 2 AND total_logins >= 10;
```

## ⚡ 性能优化要点

### 🚀 WHERE条件优化策略

1. **索引设计**：为WHERE条件中的列创建合适索引
2. **条件评估**：不要把WHERE条件的书写顺序当作执行顺序；结合索引、统计信息和执行计划评估筛选效率
3. **避免函数计算**：避免在列上直接使用函数
4. **范围查询优化**：合理使用BETWEEN和比较运算符

```sql title="性能优化示例"
-- 待评估写法：在列上使用函数可能影响普通索引的利用；实际性能取决于索引类型和执行计划
SELECT user_id, username, registration_date
FROM users
WHERE YEAR(registration_date) = 2024;

-- 候选优化写法：使用范围查询可能更利于普通索引访问，是否提速需比较实际执行计划和耗时
SELECT user_id, username, registration_date
FROM users
WHERE registration_date >= '2024-01-01' 
  AND registration_date < '2025-01-01';

-- 创建合适的复合索引
CREATE INDEX idx_users_status_regdate ON users(status, registration_date);

-- 优化后的查询
SELECT user_id, username, registration_date
FROM users
WHERE status = 'active'
  AND registration_date >= '2024-01-01';

-- 候选原查询：OR条件能否有效使用索引取决于数据库优化器、索引和数据分布
SELECT user_id, username FROM users 
WHERE city = 'Beijing' OR age > 30;

-- 候选改写：使用UNION，需比较执行计划和耗时；UNION会去重，只有确认所选列能唯一标识原行等条件时才能保证结果等价
SELECT user_id, username FROM users WHERE city = 'Beijing'
UNION
SELECT user_id, username FROM users WHERE age > 30;
```

### 📊 大数据集查询优化

```sql title="大数据集优化策略"
-- 比较IN与EXISTS的执行计划和耗时，不能仅凭数据集较大判断哪种更快
-- IN写法
SELECT u.user_id, u.username
FROM users u
WHERE u.user_id IN (
    SELECT o.user_id FROM orders o WHERE o.order_date >= '2024-01-01'
);

-- EXISTS候选写法，不保证比上述IN写法更快
SELECT u.user_id, u.username
FROM users u
WHERE EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.user_id = u.user_id 
      AND o.order_date >= '2024-01-01'
);

-- 分页查询优化
SELECT user_id, username, email
FROM users
WHERE status = 'active'
  AND registration_date >= '2024-01-01'
ORDER BY user_id
LIMIT 1000 OFFSET 0;

-- 创建覆盖索引
CREATE INDEX idx_users_covering ON users(status, registration_date, user_id, username, email);
```

## ⚠️ 常见错误与注意事项

### 🚫 易错点分析

1. **NULL值处理错误**：使用=NULL而不是IS NULL
2. **字符串引号遗漏**：字符串值没有使用引号
3. **逻辑运算符优先级**：AND/OR优先级导致的逻辑错误
4. **数据类型不匹配**：不同数据类型的比较

```sql title="常见错误示例及修正"
-- ❌ 错误：NULL值比较错误
SELECT user_id FROM users WHERE phone = NULL;

-- ✅ 正确：使用IS NULL
SELECT user_id FROM users WHERE phone IS NULL;

-- ❌ 错误：字符串没有引号
SELECT user_id FROM users WHERE city = Beijing;

-- ✅ 正确：字符串使用引号
SELECT user_id FROM users WHERE city = 'Beijing';

-- ❌ 错误：逻辑运算符优先级错误
SELECT * FROM users WHERE age > 18 AND city = 'Beijing' OR city = 'Shanghai';

-- ✅ 正确：使用括号明确优先级
SELECT * FROM users WHERE age > 18 AND (city = 'Beijing' OR city = 'Shanghai');

-- 不推荐：假设age为数值列，与字符串字面量比较可能触发隐式类型转换；在MySQL中不一定报错
SELECT user_id FROM users WHERE age = '25';  -- 数值与字符串比较

-- 推荐：假设age为数值列，使用数值字面量保持类型一致
SELECT user_id FROM users WHERE age = 25;
```

## 📋 最佳实践

### ✅ 设计原则

1. **条件明确性**：编写清晰、易理解的WHERE条件
2. **性能优先**：考虑索引和查询性能
3. **安全防护**：防止SQL注入攻击
4. **可维护性**：使用括号明确逻辑优先级

```sql title="最佳实践示例"
-- 标准的业务查询模板
SELECT 
    u.user_id,
    u.username,
    u.email,
    u.registration_date,
    COUNT(o.order_id) as order_count,
    COALESCE(SUM(o.order_amount), 0) as total_spent
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id 
    AND o.order_status = 'completed'
    AND o.order_date >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)
WHERE u.status = 'active'
  AND u.registration_date >= '2023-01-01'
  AND (u.email IS NOT NULL AND u.email != '')
  AND (u.city IN ('Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen') 
       OR u.user_type = 'premium')
GROUP BY u.user_id, u.username, u.email, u.registration_date
HAVING total_spent > 1000
ORDER BY total_spent DESC;

-- 使用参数化查询防止SQL注入（示例）
-- 应用程序代码应该使用参数绑定
-- SELECT user_id, username FROM users WHERE city = ? AND age > ?
```

## ✅ 技能检查清单

**基础技能认证**：
- [ ] 理解WHERE子句的基本概念和执行顺序
- [ ] 掌握各种比较运算符的使用方法
- [ ] 熟练使用AND、OR、NOT逻辑运算符
- [ ] 了解NULL值的正确处理方式
- [ ] 掌握LIKE模式匹配和通配符使用
- [ ] 理解IN和NOT IN操作符的应用场景

**进阶技能**：
- [ ] 能够编写复杂的复合条件查询
- [ ] 掌握日期时间条件的各种查询方式
- [ ] 熟练处理字符串和数值计算条件
- [ ] 理解WHERE条件对查询性能的影响
- [ ] 能够优化WHERE条件以提高查询效率
- [ ] 掌握WHERE条件的最佳实践和安全考虑

**下一步学习**：[[【技术与工具】/SQL/08-ORDER BY排序|ORDER BY排序]] - 学习查询结果的排序操作

---