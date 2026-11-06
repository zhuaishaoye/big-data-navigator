---
title: Presto SQL语法基础 - 掌握分布式SQL查询语言
tags:
  - Presto
  - SQL语法
  - 查询语言
  - 数据库操作
difficulty: 中级
duration: 90分钟
knowledge_type: technical-practice
target_audience:
  - 数据分析师
  - 数据开发工程师
  - BI分析师
  - 数据科学家
stability: slow-changing
status: active
access_tier: free
updated: 2026-10-10
---


# Presto SQL语法基础 - 掌握分布式SQL查询语言

> [!abstract] 📋 本节概览
> - 🎯 学习目标：全面掌握Presto SQL语法，能够编写复杂的分析查询
> - 📚 前置知识：04-第一个Presto查询|第一个Presto查询 和 SQL基础概念
> - ⏱️ 预计用时：90分钟

## 📝 Presto SQL标准兼容性

### 🎯 SQL标准支持

**Presto SQL特点**：
- 遵循ANSI SQL标准
- 支持SQL:2016核心特性
- 提供丰富的分析函数
- 兼容主流数据库SQL语法

**与标准SQL的差异**：
```sql
-- Presto不支持的功能
-- 1. 存储过程和触发器
-- 2. 用户定义类型（除了DISTINCT类型）
-- 3. 递归查询（WITH RECURSIVE）
-- 4. 某些DDL操作（依赖于连接器）

-- Presto扩展功能
-- 1. UNNEST函数展开数组
-- 2. 丰富的JSON函数
-- 3. 地理空间函数
-- 4. 正则表达式函数
```

## 🔍 基础查询语法

### 📊 SELECT语句结构

```sql
-- 完整的SELECT语句结构
SELECT [DISTINCT] select_list
FROM table_reference
[WHERE condition]
[GROUP BY expression [, ...]]
[HAVING condition]
[WINDOW window_definition [, ...]]
[ORDER BY expression [ASC | DESC] [, ...]]
[OFFSET start]
[LIMIT count]
```

### 🎯 SELECT子句详解

**基础选择**：
```sql
-- 选择所有列
SELECT * FROM orders;

-- 选择特定列
SELECT customer_id, product_name, price FROM orders;

-- 列别名
SELECT 
    customer_id AS id,
    product_name AS product,
    price AS unit_price
FROM orders;

-- 计算列
SELECT 
    customer_id,
    quantity,
    price,
    quantity * price AS total_amount
FROM orders;
```

**DISTINCT去重**：
```sql
-- 去除重复值
SELECT DISTINCT department FROM employees;

-- 多列去重
SELECT DISTINCT department, location FROM employees;

-- 统计唯一值数量
SELECT COUNT(DISTINCT customer_id) AS unique_customers
FROM orders;
```

## 🔍 WHERE子句条件过滤

### 🎯 比较运算符

```sql
-- 基础比较
SELECT * FROM employees WHERE salary > 50000;
SELECT * FROM employees WHERE department = 'Engineering';
SELECT * FROM employees WHERE hire_date >= DATE '2020-01-01';

-- 范围查询
SELECT * FROM employees WHERE salary BETWEEN 40000 AND 80000;
SELECT * FROM orders WHERE order_date BETWEEN DATE '2024-01-01' AND DATE '2024-03-31';

-- NULL值处理
SELECT * FROM employees WHERE bonus IS NULL;
SELECT * FROM employees WHERE bonus IS NOT NULL;
```

### 🔗 逻辑运算符

```sql
-- AND、OR、NOT
SELECT * FROM employees 
WHERE department = 'Engineering' AND salary > 70000;

SELECT * FROM employees 
WHERE department = 'Sales' OR department = 'Marketing';

SELECT * FROM employees 
WHERE NOT (department = 'Engineering' AND salary < 50000);

-- 复杂条件组合
SELECT * FROM employees
WHERE (department = 'Engineering' AND salary > 80000)
   OR (department = 'Sales' AND salary > 60000);
```

### 📝 模式匹配

```sql
-- LIKE模式匹配
SELECT * FROM employees WHERE name LIKE 'John%';  -- 以John开头
SELECT * FROM employees WHERE name LIKE '%son';   -- 以son结尾
SELECT * FROM employees WHERE name LIKE '%ar%';   -- 包含ar

-- 正则表达式（Presto扩展）
SELECT * FROM employees WHERE regexp_like(name, '^[A-M].*');  -- 名字以A-M开头
SELECT * FROM employees WHERE regexp_like(email, '.*@company\.com$');  -- 公司邮箱

-- IN操作符
SELECT * FROM employees WHERE department IN ('Engineering', 'Sales', 'Marketing');
SELECT * FROM orders WHERE customer_id IN (1, 2, 3, 5, 8);
```

## 📊 聚合函数与GROUP BY

### 🧮 基础聚合函数

```sql
-- 常用聚合函数
SELECT 
    COUNT(*) AS total_records,
    COUNT(bonus) AS non_null_bonus,  -- 不计算NULL值
    COUNT(DISTINCT department) AS unique_departments,
    SUM(salary) AS total_salary,
    AVG(salary) AS average_salary,
    MIN(salary) AS min_salary,
    MAX(salary) AS max_salary,
    STDDEV(salary) AS salary_stddev,
    VARIANCE(salary) AS salary_variance
FROM employees;
```

### 📈 GROUP BY分组聚合

```sql
-- 单列分组
SELECT 
    department,
    COUNT(*) AS employee_count,
    AVG(salary) AS avg_salary,
    MAX(salary) AS max_salary
FROM employees
GROUP BY department
ORDER BY avg_salary DESC;

-- 多列分组
SELECT 
    department,
    EXTRACT(YEAR FROM hire_date) AS hire_year,
    COUNT(*) AS count,
    AVG(salary) AS avg_salary
FROM employees
GROUP BY department, EXTRACT(YEAR FROM hire_date)
ORDER BY department, hire_year;
```

### 🎯 HAVING子句

```sql
-- 对分组结果进行过滤
SELECT 
    department,
    COUNT(*) AS employee_count,
    AVG(salary) AS avg_salary
FROM employees
GROUP BY department
HAVING COUNT(*) >= 3 AND AVG(salary) > 60000
ORDER BY avg_salary DESC;

-- 复杂HAVING条件
SELECT 
    customer_id,
    COUNT(*) AS order_count,
    SUM(quantity * price) AS total_spent
FROM orders
GROUP BY customer_id
HAVING COUNT(*) > 2 
   AND SUM(quantity * price) > 100
ORDER BY total_spent DESC;
```

## 🪟 窗口函数

### 📊 基础窗口函数

```sql
-- ROW_NUMBER() - 行号
SELECT 
    name,
    department,
    salary,
    ROW_NUMBER() OVER (ORDER BY salary DESC) AS overall_rank,
    ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS dept_rank
FROM employees;

-- RANK() 和 DENSE_RANK()
SELECT 
    name,
    department,
    salary,
    RANK() OVER (ORDER BY salary DESC) AS rank_with_gaps,
    DENSE_RANK() OVER (ORDER BY salary DESC) AS dense_rank
FROM employees;
```

### 📈 聚合窗口函数

```sql
-- 累计求和
SELECT 
    name,
    department,
    salary,
    SUM(salary) OVER (ORDER BY salary) AS running_total,
    SUM(salary) OVER (PARTITION BY department ORDER BY salary) AS dept_running_total
FROM employees
ORDER BY department, salary;

-- 最近三条日期聚合记录的移动平均；日期不连续时不代表连续三个自然日
SELECT 
    order_date,
    daily_revenue,
    AVG(daily_revenue) OVER (
        ORDER BY order_date 
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) AS moving_avg_3rows
FROM (
    SELECT 
        order_date,
        SUM(quantity * price) AS daily_revenue
    FROM orders
    GROUP BY order_date
) daily_stats
ORDER BY order_date;
```

### 🔄 偏移函数

```sql
-- LAG() 和 LEAD()
SELECT 
    name,
    department,
    salary,
    LAG(salary, 1) OVER (PARTITION BY department ORDER BY salary) AS prev_salary,
    LEAD(salary, 1) OVER (PARTITION BY department ORDER BY salary) AS next_salary,
    salary - LAG(salary, 1) OVER (PARTITION BY department ORDER BY salary) AS salary_diff
FROM employees
ORDER BY department, salary;

-- FIRST_VALUE() 和 LAST_VALUE()
SELECT 
    name,
    department,
    salary,
    FIRST_VALUE(salary) OVER (PARTITION BY department ORDER BY salary DESC) AS highest_salary,
    LAST_VALUE(salary) OVER (
        PARTITION BY department 
        ORDER BY salary DESC 
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS lowest_salary
FROM employees;
```

## 🔗 表连接操作

### 🤝 基础JOIN类型

```sql
-- INNER JOIN - 内连接
SELECT 
    e.name,
    e.department,
    o.order_id,
    o.product_name,
    o.quantity * o.price AS order_value
FROM employees e
INNER JOIN orders o ON e.employee_id = o.customer_id
ORDER BY e.name, o.order_date;

-- LEFT JOIN - 左外连接
SELECT 
    e.name,
    e.department,
    COUNT(o.order_id) AS order_count,
    COALESCE(SUM(o.quantity * o.price), 0) AS total_spent
FROM employees e
LEFT JOIN orders o ON e.employee_id = o.customer_id
GROUP BY e.employee_id, e.name, e.department
ORDER BY total_spent DESC;

-- RIGHT JOIN - 右外连接
SELECT 
    o.order_id,
    o.product_name,
    e.name AS customer_name,
    e.department
FROM employees e
RIGHT JOIN orders o ON e.employee_id = o.customer_id;

-- FULL OUTER JOIN - 全外连接
SELECT 
    COALESCE(e.name, 'Unknown') AS customer_name,
    COALESCE(o.order_id, 0) AS order_id
FROM employees e
FULL OUTER JOIN orders o ON e.employee_id = o.customer_id;
```

### 🔄 高级JOIN技巧

```sql
-- 自连接 - 找出同部门的同事
SELECT 
    e1.name AS employee,
    e2.name AS colleague,
    e1.department
FROM employees e1
JOIN employees e2 ON e1.department = e2.department 
                  AND e1.employee_id != e2.employee_id
ORDER BY e1.department, e1.name;

-- 多条件连接
SELECT 
    e.name,
    o.order_id,
    o.product_name
FROM employees e
JOIN orders o ON e.employee_id = o.customer_id 
              AND o.order_date >= e.hire_date  -- 只看入职后的订单
ORDER BY e.name, o.order_date;

-- 非等值连接
SELECT 
    e1.name AS lower_paid,
    e2.name AS higher_paid,
    e1.salary,
    e2.salary
FROM employees e1
JOIN employees e2 ON e1.salary < e2.salary 
                  AND e1.department = e2.department
WHERE e1.department = 'Engineering'
ORDER BY e1.salary, e2.salary;
```

## 🔍 子查询

### 📊 标量子查询

```sql
-- 返回单个值的子查询
SELECT 
    name,
    salary,
    salary - (SELECT AVG(salary) FROM employees) AS salary_vs_avg
FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees)
ORDER BY salary DESC;

-- 在不同子句中使用标量子查询
SELECT 
    department,
    COUNT(*) AS emp_count,
    AVG(salary) AS avg_salary
FROM employees
WHERE hire_date >= (
    SELECT DATE_ADD('year', -2, CURRENT_DATE)  -- 最近两年入职
)
GROUP BY department
HAVING AVG(salary) > (SELECT AVG(salary) FROM employees)
ORDER BY avg_salary DESC;
```

### 📋 表子查询

```sql
-- 在FROM子句中使用子查询
SELECT 
    dept_stats.department,
    dept_stats.avg_salary,
    dept_stats.emp_count,
    CASE 
        WHEN dept_stats.avg_salary > overall_avg.avg_salary THEN 'Above Average'
        ELSE 'Below Average'
    END AS salary_level
FROM (
    SELECT 
        department,
        AVG(salary) AS avg_salary,
        COUNT(*) AS emp_count
    FROM employees
    GROUP BY department
) dept_stats
CROSS JOIN (
    SELECT AVG(salary) AS avg_salary FROM employees
) overall_avg
ORDER BY dept_stats.avg_salary DESC;
```

### 🎯 EXISTS和IN子查询

```sql
-- EXISTS子查询
SELECT 
    e.name,
    e.department,
    e.salary
FROM employees e
WHERE EXISTS (
    SELECT 1 
    FROM orders o 
    WHERE o.customer_id = e.employee_id 
      AND o.quantity * o.price > 100
);

-- NOT EXISTS子查询
SELECT 
    e.name,
    e.department
FROM employees e
WHERE NOT EXISTS (
    SELECT 1 
    FROM orders o 
    WHERE o.customer_id = e.employee_id
);

-- IN子查询
SELECT 
    name,
    department,
    salary
FROM employees
WHERE department IN (
    SELECT department 
    FROM employees 
    GROUP BY department 
    HAVING AVG(salary) > 70000
);

-- ANY/SOME 和 ALL
SELECT name, salary
FROM employees
WHERE salary > ANY (
    SELECT salary 
    FROM employees 
    WHERE department = 'Engineering'
);

SELECT name, salary
FROM employees
WHERE salary > ALL (
    SELECT salary 
    FROM employees 
    WHERE department = 'Marketing'
);
```

## 📚 WITH子句（CTE）

### 🔧 基础CTE用法

```sql
-- 简单CTE
WITH high_earners AS (
    SELECT name, department, salary
    FROM employees
    WHERE salary > 75000
)
SELECT 
    department,
    COUNT(*) AS high_earner_count,
    AVG(salary) AS avg_high_salary
FROM high_earners
GROUP BY department
ORDER BY avg_high_salary DESC;
```

### 🔄 多个CTE

```sql
-- 多个CTE定义
WITH 
department_stats AS (
    SELECT 
        department,
        COUNT(*) AS emp_count,
        AVG(salary) AS avg_salary,
        MAX(salary) AS max_salary
    FROM employees
    GROUP BY department
),
order_stats AS (
    SELECT 
        customer_id,
        COUNT(*) AS order_count,
        SUM(quantity * price) AS total_spent
    FROM orders
    GROUP BY customer_id
),
employee_performance AS (
    SELECT 
        e.employee_id,
        e.name,
        e.department,
        e.salary,
        COALESCE(os.order_count, 0) AS order_count,
        COALESCE(os.total_spent, 0) AS total_spent
    FROM employees e
    LEFT JOIN order_stats os ON e.employee_id = os.customer_id
)
SELECT 
    ep.department,
    ds.emp_count,
    ds.avg_salary,
    AVG(ep.total_spent) AS avg_customer_value,
    SUM(ep.order_count) AS total_orders
FROM employee_performance ep
JOIN department_stats ds ON ep.department = ds.department
GROUP BY ep.department, ds.emp_count, ds.avg_salary
ORDER BY avg_customer_value DESC;
```

### 🔄 递归CTE（有限支持）

```sql
-- Presto不支持完整的递归CTE，但可以用UNNEST模拟简单递归
WITH RECURSIVE sequence(n) AS (
    SELECT 1 as n
    UNION ALL
    SELECT n + 1 FROM sequence WHERE n < 10
)
-- 上述语法在Presto中不支持

-- 替代方案：使用UNNEST生成序列
SELECT n
FROM UNNEST(SEQUENCE(1, 10)) AS t(n);

-- 以下仅适用于另行提供generate_series的扩展环境，不是可默认依赖的Presto内置方案
SELECT generate_series(1, 10) AS n;
```

## 🔧 高级SQL特性

### 📊 UNION操作

```sql
-- UNION - 合并结果集（去重）
SELECT name, 'Employee' AS type FROM employees
WHERE department = 'Engineering'
UNION
SELECT product_name, 'Product' AS type FROM orders
WHERE quantity > 5;

-- UNION ALL - 合并结果集（不去重）
SELECT department FROM employees
UNION ALL
SELECT department FROM departments;

-- INTERSECT - 交集
SELECT department FROM employees
INTERSECT
SELECT dept_name FROM departments;

-- EXCEPT - 差集
SELECT department FROM employees
EXCEPT
SELECT dept_name FROM departments;
```

### 🎯 CASE表达式

```sql
-- 简单CASE表达式
SELECT 
    name,
    salary,
    CASE department
        WHEN 'Engineering' THEN 'Tech'
        WHEN 'Sales' THEN 'Business'
        WHEN 'Marketing' THEN 'Business'
        ELSE 'Other'
    END AS division
FROM employees;

-- 搜索CASE表达式
SELECT 
    name,
    salary,
    CASE 
        WHEN salary >= 90000 THEN 'Senior'
        WHEN salary >= 70000 THEN 'Mid-level'
        WHEN salary >= 50000 THEN 'Junior'
        ELSE 'Entry-level'
    END AS level,
    CASE 
        WHEN salary > (SELECT AVG(salary) FROM employees) THEN 'Above Average'
        ELSE 'Below Average'
    END AS salary_comparison
FROM employees
ORDER BY salary DESC;
```

### 🔍 条件聚合

```sql
-- 使用CASE进行条件聚合
SELECT 
    department,
    COUNT(*) AS total_employees,
    COUNT(CASE WHEN salary > 70000 THEN 1 END) AS high_earners,
    COUNT(CASE WHEN salary <= 70000 THEN 1 END) AS regular_earners,
    AVG(CASE WHEN department = 'Engineering' THEN salary END) AS eng_avg_salary,
    SUM(CASE WHEN hire_date >= DATE '2023-01-01' THEN 1 ELSE 0 END) AS recent_hires
FROM employees
GROUP BY department;

-- 透视表效果
SELECT 
    EXTRACT(YEAR FROM order_date) AS year,
    SUM(CASE WHEN EXTRACT(MONTH FROM order_date) = 1 THEN quantity * price ELSE 0 END) AS jan_sales,
    SUM(CASE WHEN EXTRACT(MONTH FROM order_date) = 2 THEN quantity * price ELSE 0 END) AS feb_sales,
    SUM(CASE WHEN EXTRACT(MONTH FROM order_date) = 3 THEN quantity * price ELSE 0 END) AS mar_sales,
    SUM(quantity * price) AS total_sales
FROM orders
GROUP BY EXTRACT(YEAR FROM order_date)
ORDER BY year;
```

## 📅 日期时间处理

### 🕒 日期时间函数

```sql
-- 当前日期时间
SELECT 
    CURRENT_DATE AS today,
    CURRENT_TIME AS now_time,
    CURRENT_TIMESTAMP AS now_timestamp,
    NOW() AS now_function;

-- 日期提取
SELECT 
    hire_date,
    EXTRACT(YEAR FROM hire_date) AS hire_year,
    EXTRACT(MONTH FROM hire_date) AS hire_month,
    EXTRACT(DAY FROM hire_date) AS hire_day,
    EXTRACT(DOW FROM hire_date) AS day_of_week,  -- 1=Monday，7=Sunday
    EXTRACT(DOY FROM hire_date) AS day_of_year
FROM employees;

-- 日期格式化
SELECT 
    hire_date,
    DATE_FORMAT(hire_date, '%Y-%m-%d') AS formatted_date,
    DATE_FORMAT(hire_date, '%M %d, %Y') AS readable_date,
    CONCAT(CAST(EXTRACT(YEAR FROM hire_date) AS VARCHAR), '-Q', CAST(EXTRACT(QUARTER FROM hire_date) AS VARCHAR)) AS quarter
FROM employees;
```

### 📈 日期计算

```sql
-- 日期运算
SELECT 
    name,
    hire_date,
    CURRENT_DATE AS today,
    DATE_DIFF('day', hire_date, CURRENT_DATE) AS days_employed,
    DATE_DIFF('month', hire_date, CURRENT_DATE) AS months_employed,
    DATE_DIFF('year', hire_date, CURRENT_DATE) AS years_employed,
    DATE_ADD('day', 90, hire_date) AS probation_end,
    DATE_ADD('year', 1, hire_date) AS first_anniversary
FROM employees
ORDER BY hire_date;

-- 日期截断
SELECT 
    order_date,
    DATE_TRUNC('month', order_date) AS month_start,
    DATE_TRUNC('quarter', order_date) AS quarter_start,
    DATE_TRUNC('year', order_date) AS year_start
FROM orders;
```

## 🔤 字符串处理

### 📝 基础字符串函数

```sql
-- 字符串操作
SELECT 
    name,
    LENGTH(name) AS name_length,
    UPPER(name) AS upper_name,
    LOWER(name) AS lower_name,
    CONCAT(UPPER(SUBSTR(name, 1, 1)), LOWER(SUBSTR(name, 2))) AS initial_cap_name,  -- 仅将整个字符串首字母大写，其余小写，不是逐词首字母大写
    REVERSE(name) AS reversed_name
FROM employees;

-- 字符串连接和截取
SELECT 
    name,
    department,
    CONCAT(name, ' - ', department) AS full_info,
    name || ' (' || department || ')' AS full_info_alt,
    SUBSTR(name, 1, 3) AS name_prefix,
    SUBSTR(name, 1, 3) AS left_3_chars,
    SUBSTR(name, -3) AS right_3_chars
FROM employees;
```

### 🔍 字符串查找和替换

```sql
-- 字符串查找
SELECT 
    name,
    POSITION('a' IN LOWER(name)) AS first_a_position,
    STRPOS(LOWER(name), 'a') AS first_a_position_alt,
    (STRPOS(LOWER(name), 'john') > 0) AS contains_john
FROM employees;

-- 字符串替换和修剪
SELECT 
    '  ' || name || '  ' AS padded_name,
    TRIM('  ' || name || '  ') AS trimmed_name,
    LTRIM('  ' || name) AS left_trimmed,
    RTRIM(name || '  ') AS right_trimmed,
    REPLACE(name, 'a', '@') AS replaced_name,
    REPLACE(department, 'Engineering', 'Tech') AS updated_dept
FROM employees;
```

### ✂️ 字符串分割

```sql
-- 字符串分割（需要数组支持）
SELECT 
    'John,Doe,Engineer' AS full_info,
    SPLIT('John,Doe,Engineer', ',') AS name_parts,
    SPLIT('John,Doe,Engineer', ',')[1] AS first_name,
    SPLIT('John,Doe,Engineer', ',')[2] AS last_name,
    SPLIT('John,Doe,Engineer', ',')[3] AS role;

-- 正则表达式
SELECT 
    name,
    REGEXP_EXTRACT(name, '([A-Z][a-z]+)', 1) AS first_word,
    REGEXP_REPLACE(name, '[aeiou]', '*') AS vowels_replaced,
    REGEXP_LIKE(name, '^[A-M].*') AS starts_with_a_to_m
FROM employees;
```

## ✅ 综合实践案例

### 📊 销售分析报表

```sql
-- 综合销售分析案例
WITH monthly_sales AS (
    SELECT 
        DATE_TRUNC('month', order_date) AS month,
        customer_id,
        product_name,
        SUM(quantity) AS total_quantity,
        SUM(quantity * price) AS total_revenue,
        COUNT(*) AS order_count
    FROM orders
    GROUP BY DATE_TRUNC('month', order_date), customer_id, product_name
),
customer_metrics AS (
    SELECT 
        ms.month,
        ms.customer_id,
        e.name AS customer_name,
        e.department,
        COUNT(DISTINCT ms.product_name) AS unique_products,
        SUM(ms.total_quantity) AS monthly_quantity,
        SUM(ms.total_revenue) AS monthly_revenue,
        1.0 * SUM(ms.total_revenue) / NULLIF(SUM(ms.order_count), 0) AS avg_order_value,
        RANK() OVER (PARTITION BY ms.month ORDER BY SUM(ms.total_revenue) DESC) AS revenue_rank
    FROM monthly_sales ms
    JOIN employees e ON ms.customer_id = e.employee_id
    GROUP BY ms.month, ms.customer_id, e.name, e.department
),
department_summary AS (
    SELECT 
        month,
        department,
        COUNT(DISTINCT customer_id) AS active_customers,
        SUM(monthly_revenue) AS dept_revenue,
        AVG(monthly_revenue) AS avg_customer_revenue
    FROM customer_metrics
    GROUP BY month, department
)
SELECT 
    cm.month,
    cm.customer_name,
    cm.department,
    cm.monthly_revenue,
    cm.revenue_rank,
    ds.dept_revenue,
    ROUND(100.0 * cm.monthly_revenue / ds.dept_revenue, 2) AS revenue_share_pct,
    CASE 
        WHEN cm.revenue_rank <= 3 THEN 'Top Performer'
        WHEN cm.monthly_revenue > ds.avg_customer_revenue THEN 'Above Average'
        ELSE 'Standard'
    END AS performance_tier
FROM customer_metrics cm
JOIN department_summary ds ON cm.month = ds.month AND cm.department = ds.department
WHERE cm.month >= DATE '2024-01-01'
ORDER BY cm.month, cm.department, cm.revenue_rank;
```

## 🔗 学习连接

### 📚 本节核心技能

- **基础语法**：SELECT、WHERE、GROUP BY、ORDER BY的完整用法
- **聚合分析**：各种聚合函数和分组分析技巧
- **窗口函数**：排名、累计、移动计算等高级分析
- **表连接**：多种JOIN类型和连接策略
- **子查询**：标量、表、EXISTS等不同类型子查询
- **高级特性**：CTE、CASE表达式、字符串和日期处理

### 🎯 下一步学习

**SQL掌握检查**：
- ✅ 能够编写复杂的多表连接查询？
- ✅ 掌握窗口函数的使用方法？
- ✅ 理解CTE和子查询的应用场景？

**继续学习路径**：
- [[【技术与工具】/Presto/06-数据类型与函数|数据类型与函数]] - 数据类型
- [[【技术与工具】/Presto/07-连接器详解|连接器]] - 连接器应用
- [[【技术与工具】/Presto/08-表操作与DDL|表操作与DDL]] - 表操作

---

> [!tip] 💡 SQL语法精通要点
> 
> 📝 **Presto SQL核心优势**：
> - 🎯 **标准兼容** - 遵循ANSI SQL标准，易于学习
> - ⚡ **丰富函数** - 强大的分析和窗口函数支持
> - 🔗 **灵活连接** - 支持复杂的多表关联查询
> - 📊 **高级分析** - CTE、窗口函数等现代SQL特性
> 
> 🚀 **进阶应用**：SQL语法掌握后，进入 06-数据类型与函数|数据类型与函数 学习更多内置函数和数据处理技巧！