---
title: GROUP BY分组操作
tags:
- SQL
- 查询
- 基础
- 分组
- 聚合
created: 2024-06-29
updated: '2026-10-09'
difficulty: 中级
duration: 45分钟
knowledge_type: technical-practice
target_audience:
- 数据分析师
- 数据开发工程师
- BI分析师
stability: slow-changing
status: active
access_tier: free
---


# 🧩 SQL GROUP BY分组操作

> [!abstract] 📋 本节概览
> - 🎯 **学习目标**：掌握GROUP BY子句的语法和应用，实现数据分组聚合操作
> - 📚 **前置知识**：[[【技术与工具】/SQL/11-聚合函数详解|聚合函数]]
> - ⏱️ **预计用时**：20分钟
> - 🔧 **开发环境**：日期函数示例主要采用MySQL语法；PostgreSQL和SQLite需替换相应日期函数，SQLite默认不提供STDDEV；PostgreSQL部分索引示例单独标注
> - 📊 **数据集**：users、orders等关系型表结构

## 🔧 技术定义

**GROUP BY子句**是SQL中用于数据分组的子句，它将查询结果按照指定的列值进行分组，相同值的记录将被归类到同一组中，然后对每个组执行聚合计算。

### 🛠️ 工作机制

**执行顺序**：
1. **数据过滤**：先执行WHERE子句进行记录过滤
2. **数据分组**：按GROUP BY指定的列将数据分为不同组
3. **聚合计算**：对每个组执行聚合函数计算
4. **HAVING过滤**：对聚合结果进行过滤（如果有）
5. **结果排序**：按ORDER BY进行最终排序

**核心特征**：
- **结果集压缩**：多行记录合并为一行组统计信息
- **SELECT限制**：为保持可移植性，非聚合表达式应由分组字段或常量构成；部分数据库还支持满足函数依赖条件的非分组列
- **组内计算**：聚合函数仅对当前组内数据计算

## 📈 基础语法结构

### 📝 标准语法

```sql title="GROUP BY基本语法"
SELECT 
    grouping_column(s),
    aggregate_function(column)
FROM table_name
[WHERE condition]
GROUP BY grouping_column(s)
[HAVING aggregate_condition]
[ORDER BY column];
```

### 📁 单字段分组

```sql title="按单个字段分组"
-- 按城市统计用户数量
SELECT 
    city,
    COUNT(*) as user_count
FROM users 
GROUP BY city
ORDER BY user_count DESC;

-- 按部门统计平均薪资
SELECT 
    department,
    AVG(salary) as avg_salary,
    COUNT(*) as employee_count
FROM employees 
GROUP BY department;

-- 按订单状态统计总金额
SELECT 
    order_status,
    SUM(order_amount) as total_amount,
    COUNT(*) as order_count
FROM orders
GROUP BY order_status;
```

### 📂 多字段分组

```sql title="按多个字段组合分组"
-- 按城市和年龄段分组统计
SELECT 
    city,
    CASE 
        WHEN age < 25 THEN '青年'
        WHEN age BETWEEN 25 AND 35 THEN '中青年'
        ELSE '中年'
    END as age_group,
    COUNT(*) as user_count
FROM users
GROUP BY city, age_group
ORDER BY city, age_group;

-- 按年月和产品类别统计销售金额
SELECT 
    DATE_FORMAT(order_date, '%Y-%m') as order_month,
    product_category,
    SUM(order_amount) as monthly_sales,
    COUNT(*) as order_count
FROM orders
WHERE order_date >= '2024-01-01'
GROUP BY order_month, product_category
ORDER BY order_month, product_category;
```

## 🔍 WHERE与GROUP BY结合使用

### 📋 数据过滤后分组

WHERE子句在GROUP BY之前执行，用于在分组前过滤原始数据：

```sql title="先过滤后分组的查询"
-- 只统计成年用户的城市分布
SELECT 
    city,
    COUNT(*) as adult_user_count
FROM users 
WHERE age >= 18
GROUP BY city
HAVING COUNT(*) > 100  -- 只显示成年用户数超过100的城市
ORDER BY adult_user_count DESC;

-- 统计最近30天各产品类别的销售情况
SELECT 
    product_category,
    COUNT(*) as order_count,
    SUM(order_amount) as total_sales,
    AVG(order_amount) as avg_order_value
FROM orders
WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
  AND order_status = 'completed'
GROUP BY product_category
ORDER BY total_sales DESC;
```

### 📊 HAVING子句过滤聚合结果

HAVING在GROUP BY之后执行，用于对聚合结果进行过滤：

```sql title="HAVING子句过滤组统计结果"
-- 查找平均薪资超过万元的部门
SELECT 
    department,
    AVG(salary) as avg_salary,
    COUNT(*) as employee_count
FROM employees
GROUP BY department
HAVING AVG(salary) > 10000
ORDER BY avg_salary DESC;

-- 查找订单数量超过50的用户
SELECT 
    user_id,
    COUNT(*) as order_count,
    SUM(order_amount) as total_spent
FROM orders
WHERE order_status = 'completed'
GROUP BY user_id
HAVING COUNT(*) > 50
ORDER BY order_count DESC;
```

## ⚠️ 常见错误与规则

### 🚫 SELECT子句限制规则

在使用GROUP BY时，为保持可移植性，SELECT子句通常使用以下元素；部分数据库还允许满足函数依赖条件的非分组列：
1. **分组字段**：GROUP BY中指定的列
2. **聚合函数**：COUNT、SUM、AVG、MAX、MIN等
3. **常量**：字面值或表达式

```sql title="常见错误示例"
-- ❌ 错误：非分组字段出现在SELECT中
SELECT department, employee_name, COUNT(*)
FROM employees
GROUP BY department;  -- employee_name不在GROUP BY中

-- ✅ 正确：只选择分组字段和聚合函数
SELECT 
    department,
    COUNT(*) as employee_count,
    AVG(salary) as avg_salary
FROM employees
GROUP BY department;

-- ❌ 错误：在WHERE中使用聚合函数
SELECT department, COUNT(*)
FROM employees
WHERE COUNT(*) > 5  -- WHERE中不能使用聚合函数
GROUP BY department;

-- ✅ 正确：在HAVING中使用聚合函数
SELECT department, COUNT(*) as emp_count
FROM employees
GROUP BY department
HAVING COUNT(*) > 5;
```

### 🛠️ WHERE vs HAVING区别

| 特征 | WHERE | HAVING |
|------|-------|--------|
| **执行时机** | 分组前 | 分组后 |
| **作用对象** | 原始记录 | 聚合结果 |
| **可用表达式** | 原始记录字段及标量表达式，不可直接使用本层查询的聚合函数 | 分组字段、聚合函数及基于它们的表达式 |
| **性能影响** | 减少分组数据量 | 过滤聚合结果 |

```sql title="WHERE与HAVING的对比使用"
-- 统计2024年各部门高薪员工（>8000）的情况
SELECT 
    department,
    COUNT(*) as high_salary_count,
    AVG(salary) as dept_avg_salary
FROM employees
WHERE hire_date >= '2024-01-01'  -- 过滤原始记录
  AND hire_date < '2025-01-01'   -- 将入职日期限制在2024年
  AND salary > 8000             -- 过滤原始记录
GROUP BY department
HAVING COUNT(*) >= 3             -- 过滤聚合结果
ORDER BY dept_avg_salary DESC;
```

## 🏢 业务实战案例

### 📊 电商数据分析

```sql title="电商平台数据统计"
-- 月度销售报表
SELECT 
    DATE_FORMAT(order_date, '%Y-%m') as sales_month,
    COUNT(*) as total_orders,
    COUNT(DISTINCT user_id) as active_customers,
    SUM(order_amount) as monthly_revenue,
    AVG(order_amount) as avg_order_value
FROM orders
WHERE order_status = 'completed'
  AND order_date >= '2024-01-01'
GROUP BY sales_month
ORDER BY sales_month;

-- 用户消费分层分析
SELECT 
    CASE 
        WHEN total_spent < 1000 THEN '低价值用户'
        WHEN total_spent BETWEEN 1000 AND 5000 THEN '中价值用户'
        ELSE '高价值用户'
    END as customer_segment,
    COUNT(*) as customer_count,
    AVG(order_count) as avg_orders_per_customer,
    SUM(total_spent) as segment_revenue
FROM (
    SELECT 
        user_id,
        COUNT(*) as order_count,
        SUM(order_amount) as total_spent
    FROM orders
    WHERE order_status = 'completed'
    GROUP BY user_id
) customer_stats
GROUP BY customer_segment
ORDER BY segment_revenue DESC;
```

### 🏭 人力资源统计

```sql title="HR薪酬统计分析"
-- 部门薪酬结构分析
SELECT 
    department,
    COUNT(*) as employee_count,
    MIN(salary) as min_salary,
    MAX(salary) as max_salary,
    AVG(salary) as avg_salary,
    STDDEV(salary) as salary_stddev,  -- 薪资标准差
    SUM(salary) as total_payroll
FROM employees
WHERE status = 'active'
GROUP BY department
HAVING COUNT(*) >= 5  -- 只统计人数≥ 5的部门
ORDER BY avg_salary DESC;

-- 入职年份与薪资关系分析
SELECT 
    YEAR(hire_date) as hire_year,
    department,
    COUNT(*) as hired_count,
    AVG(salary) as avg_salary  -- 仅当salary记录入职薪资时，才能解释为平均起薪
FROM employees
WHERE hire_date >= '2020-01-01'
GROUP BY hire_year, department
HAVING COUNT(*) >= 3
ORDER BY hire_year DESC, department;
```

## ⚡ 性能优化要点

### 🚀 GROUP BY性能优化

1. **索引优化**：为GROUP BY字段创建适当索引
2. **分组字段顺序**：结合索引列顺序、过滤条件和执行计划评估，不存在按基数从小到大排列就普遍更快的规则
3. **WHERE过滤优先**：先用WHERE减少数据量再分组
4. **选择性投影**：只选择需要的列，避免SELECT *

```sql title="性能优化示例"
-- 优化前：缺少索引，数据量大
SELECT department, COUNT(*)
FROM employees
GROUP BY department;

-- 另一统计需求示例：创建候选索引，仅统计在职员工；与上方全体员工统计范围不同，不能直接作为等价查询的性能对比
CREATE INDEX idx_employees_dept_status ON employees(department, status);

SELECT 
    department,
    COUNT(*) as active_count
FROM employees
WHERE status = 'active'  -- 先过滤再分组
GROUP BY department
ORDER BY department;  -- 是否利用索引顺序避免额外排序，需检查执行计划
```

### 📊 存储引擎针对性优化

```sql title="MySQL与PostgreSQL的优化差异"
-- MySQL: 使用覆盖索引优化
CREATE INDEX idx_orders_status_date_amount 
ON orders(order_status, order_date, order_amount);

-- PostgreSQL: 利用部分索引
CREATE INDEX CONCURRENTLY idx_orders_completed 
ON orders(order_date, order_amount) 
WHERE order_status = 'completed';
```

## ✅ 技能检查清单

**基础技能认证**：
- [ ] 理解GROUP BY的工作原理和执行顺序
- [ ] 掌握单字段和多字段分组语法
- [ ] 了解SELECT子句在GROUP BY中的限制规则
- [ ] 熟练使用WHERE和HAVING子句的区别
- [ ] 能够结合聚合函数进行数据统计分析
- [ ] 掌握ORDER BY与GROUP BY的组合使用

**进阶技能**：
- [ ] 能够设计复杂的分组统计查询
- [ ] 理解GROUP BY的性能影响和优化方法
- [ ] 掌握子查询与GROUP BY的结合使用
- [ ] 熟练解决实际业务中的数据分析问题

**下一步学习**：[[【技术与工具】/SQL/08-ORDER BY排序|ORDER BY排序]] - 学习结果集排序和性能优化