---
title: 第一个Presto查询 - 快速上手分布式SQL查询
tags:
  - Presto
  - SQL查询
  - 快速入门
  - 实践操作
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
updated: 2026-10-10
---


# 第一个Presto查询 - 快速上手分布式SQL查询

> [!abstract] 📋 本节概览
> - 🎯 学习目标：通过实际操作掌握Presto查询的基本使用方法和核心特性
> - 📚 前置知识：03-Presto环境搭建|Presto环境搭建 和 基础SQL语法
> - ⏱️ 预计用时：45分钟

## 🚀 连接到Presto

### 🖥️ 使用Presto CLI

**启动CLI客户端**：
```bash
# 连接到本地Presto服务器
/opt/presto/presto-cli --server localhost:8080

# 指定用户名连接
/opt/presto/presto-cli --server localhost:8080 --user your_username

# 连接到远程服务器
/opt/presto/presto-cli --server presto.company.com:8080 --user your_username
```

**CLI界面说明**：
```bash
presto> 
# 看到这个提示符表示CLI已启动
# 执行SELECT 1;并成功返回结果后，再确认服务器可访问且查询可执行

# 查看帮助信息
presto> help;

# 退出CLI
presto> quit;
```

### 🌐 使用Web UI

**访问Web界面**：
1. 打开浏览器
2. 访问：`http://localhost:8080`
3. 使用Web UI查看集群和查询信息；只有部署提供Query Editor时才可在其中执行SQL，否则使用CLI或其他SQL客户端

**Web UI主要功能**：
- **Overview**：集群状态概览
- **Query Details**：查询详情和性能统计
- **Live Plan**：实时执行计划
- **Stage Performance**：各阶段性能分析

## 📊 基础查询操作

### 🔍 系统信息查询

**查看可用的Catalog**：
```sql
-- 显示所有已配置的数据源
SHOW CATALOGS;

-- 预期输出示例：
--  Catalog
-- ---------
--  memory
--  hive
--  system
```

**查看Schema**：
```sql
-- 查看指定catalog下的schema
SHOW SCHEMAS FROM memory;

-- 输出示例：
--    Schema
-- ------------
--  default
--  information_schema
```

**查看表**：
```sql
-- 查看指定schema下的表
SHOW TABLES FROM memory.default;

-- 查看系统表
SHOW TABLES FROM system.runtime;
```

### 🖥️ 系统监控查询

**集群节点信息**：
```sql
-- 查看集群节点状态
SELECT 
    node_id,
    http_uri,
    node_version,
    coordinator,
    state
FROM system.runtime.nodes;
```

**查询历史记录**：
```sql
-- 查看最近的查询记录
SELECT 
    query_id,
    state,
    user,
    source,
    query,
    created,
    started,
    "end",
    elapsed
FROM system.runtime.queries 
ORDER BY created DESC 
LIMIT 10;
```

**正在运行的查询**：
```sql
-- 查看当前正在执行的查询
SELECT 
    query_id,
    state,
    user,
    elapsed,
    progress,
    query
FROM system.runtime.queries 
WHERE state = 'RUNNING';
```

## 💾 使用内存连接器

### 📊 创建测试数据

**创建简单表**：
```sql
-- 创建包含基础数据类型的表
CREATE TABLE memory.default.employees AS
SELECT * FROM (VALUES
    (1, 'Alice', 'Engineering', 85000, DATE '1990-01-15'),
    (2, 'Bob', 'Marketing', 65000, DATE '1985-03-22'),
    (3, 'Charlie', 'Engineering', 90000, DATE '1988-07-10'),
    (4, 'Diana', 'Sales', 70000, DATE '1992-11-05'),
    (5, 'Eve', 'Engineering', 95000, DATE '1987-09-18')
) AS t(id, name, department, salary, hire_date);
```

**创建订单数据表**：
```sql
-- 创建订单表用于演示JOIN操作
CREATE TABLE memory.default.orders AS
SELECT * FROM (VALUES
    (101, 1, 'Widget A', 2, 29.99, DATE '2024-01-15'),
    (102, 2, 'Widget B', 1, 49.99, DATE '2024-01-16'),
    (103, 1, 'Widget C', 3, 19.99, DATE '2024-01-17'),
    (104, 3, 'Widget A', 1, 29.99, DATE '2024-01-18'),
    (105, 4, 'Widget D', 2, 39.99, DATE '2024-01-19')
) AS t(order_id, customer_id, product, quantity, price, order_date);
```

### 🔍 基础查询示例

**简单SELECT查询**：
```sql
-- 查询所有员工信息
SELECT * FROM memory.default.employees;

-- 查询特定列
SELECT name, department, salary 
FROM memory.default.employees;

-- 条件过滤
SELECT name, salary 
FROM memory.default.employees 
WHERE department = 'Engineering';

-- 排序
SELECT name, salary 
FROM memory.default.employees 
ORDER BY salary DESC;

-- 限制结果数量
SELECT name, salary 
FROM memory.default.employees 
ORDER BY salary DESC 
LIMIT 3;
```

## 📈 聚合查询操作

### 🧮 基础聚合函数

**统计函数**：
```sql
-- 计算总数、平均值、最大值、最小值
SELECT 
    COUNT(*) AS total_employees,
    AVG(salary) AS avg_salary,
    MAX(salary) AS max_salary,
    MIN(salary) AS min_salary,
    SUM(salary) AS total_salary
FROM memory.default.employees;
```

**分组聚合**：
```sql
-- 按部门统计
SELECT 
    department,
    COUNT(*) AS emp_count,
    AVG(salary) AS avg_salary,
    MAX(salary) AS max_salary
FROM memory.default.employees
GROUP BY department
ORDER BY avg_salary DESC;
```

**HAVING子句**：
```sql
-- 查找平均薪资超过80000的部门
SELECT 
    department,
    COUNT(*) AS emp_count,
    AVG(salary) AS avg_salary
FROM memory.default.employees
GROUP BY department
HAVING AVG(salary) > 80000;
```

### 📊 高级聚合示例

**多维聚合**：
```sql
-- 使用CUBE进行多维聚合
SELECT 
    department,
    EXTRACT(YEAR FROM hire_date) AS hire_year,
    COUNT(*) AS emp_count,
    AVG(salary) AS avg_salary
FROM memory.default.employees
GROUP BY CUBE(department, EXTRACT(YEAR FROM hire_date))
ORDER BY department, hire_year;
```

**窗口函数**：
```sql
-- 计算部门内薪资排名
SELECT 
    name,
    department,
    salary,
    RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS dept_rank,
    ROW_NUMBER() OVER (ORDER BY salary DESC) AS overall_rank
FROM memory.default.employees;
```

## 🔗 表连接操作

### 🤝 基础JOIN示例

**内连接（INNER JOIN）**：
```sql
-- 查询员工及其订单信息
SELECT 
    e.name,
    e.department,
    o.order_id,
    o.product,
    o.quantity,
    o.price
FROM memory.default.employees e
INNER JOIN memory.default.orders o ON e.id = o.customer_id
ORDER BY e.name, o.order_date;
```

**左外连接（LEFT JOIN）**：
```sql
-- 查询所有员工，包括没有订单的员工
SELECT 
    e.name,
    e.department,
    COUNT(o.order_id) AS order_count,
    COALESCE(SUM(o.price * o.quantity), 0) AS total_spent
FROM memory.default.employees e
LEFT JOIN memory.default.orders o ON e.id = o.customer_id
GROUP BY e.id, e.name, e.department
ORDER BY total_spent DESC;
```

### 🔄 复杂JOIN查询

**多表连接**：
```sql
-- 创建部门表
CREATE TABLE memory.default.departments AS
SELECT * FROM (VALUES
    ('Engineering', 'John Smith', 'Building A'),
    ('Marketing', 'Jane Doe', 'Building B'),
    ('Sales', 'Mike Johnson', 'Building C')
) AS t(dept_name, manager, location);

-- 三表连接查询
SELECT 
    e.name AS employee_name,
    e.salary,
    d.manager AS dept_manager,
    d.location,
    COUNT(o.order_id) AS order_count
FROM memory.default.employees e
JOIN memory.default.departments d ON e.department = d.dept_name
LEFT JOIN memory.default.orders o ON e.id = o.customer_id
GROUP BY e.name, e.salary, d.manager, d.location
ORDER BY e.salary DESC;
```

## 📊 数据分析示例

### 💹 销售分析

**销售统计报表**：
```sql
-- 综合销售分析
WITH sales_summary AS (
    SELECT 
        o.customer_id,
        e.name,
        e.department,
        COUNT(o.order_id) AS order_count,
        SUM(o.quantity) AS total_quantity,
        SUM(o.price * o.quantity) AS total_amount,
        AVG(o.price * o.quantity) AS avg_order_value,
        MIN(o.order_date) AS first_order,
        MAX(o.order_date) AS last_order
    FROM memory.default.orders o
    JOIN memory.default.employees e ON o.customer_id = e.id
    GROUP BY o.customer_id, e.name, e.department
)
SELECT 
    name,
    department,
    order_count,
    total_quantity,
    total_amount,
    ROUND(avg_order_value, 2) as avg_order_value,
    first_order,
    last_order,
    CASE 
        WHEN total_amount >= 100 THEN 'High Value'
        WHEN total_amount >= 50 THEN 'Medium Value'
        ELSE 'Low Value'
    END AS customer_segment
FROM sales_summary
ORDER BY total_amount DESC;
```

### 📈 时间序列分析

**按日期分析订单趋势**：
```sql
-- 按日期统计订单
SELECT 
    order_date,
    COUNT(*) AS order_count,
    SUM(quantity) AS total_quantity,
    SUM(price * quantity) AS daily_revenue,
    AVG(price * quantity) AS avg_order_value
FROM memory.default.orders
GROUP BY order_date
ORDER BY order_date;
```

**移动平均计算**：
```sql
-- 计算3日移动平均
SELECT 
    order_date,
    daily_revenue,
    AVG(daily_revenue) OVER (
        ORDER BY order_date 
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) AS moving_avg_3day
FROM (
    SELECT 
        order_date,
        SUM(price * quantity) AS daily_revenue
    FROM memory.default.orders
    GROUP BY order_date
) daily_sales
ORDER BY order_date;
```

## 🔧 实用查询技巧

### 🎯 条件逻辑

**CASE WHEN表达式**：
```sql
-- 根据薪资水平分类员工
SELECT 
    name,
    salary,
    department,
    CASE 
        WHEN salary >= 90000 THEN 'Senior'
        WHEN salary >= 70000 THEN 'Mid-level'
        ELSE 'Junior'
    END AS level
FROM memory.default.employees
ORDER BY salary DESC;
```

### 🔍 子查询

**相关子查询**：
```sql
-- 查找薪资高于部门平均值的员工
SELECT 
    name,
    department,
    salary,
    (SELECT AVG(salary) 
     FROM memory.default.employees e2 
     WHERE e2.department = e1.department) AS dept_avg_salary
FROM memory.default.employees e1
WHERE salary > (
    SELECT AVG(salary) 
    FROM memory.default.employees e2 
    WHERE e2.department = e1.department
)
ORDER BY department, salary DESC;
```

**非相关子查询**：
```sql
-- 查找薪资不低于近似中位数的员工；并列值和近似计算可能使人数不等于总人数的50%
SELECT 
    name,
    department,
    salary
FROM memory.default.employees
WHERE salary >= (
    SELECT approx_percentile(salary, 0.5)
    FROM memory.default.employees
)
ORDER BY salary DESC;
```

### 📊 WITH子句（CTE）

**复杂分析查询**：
```sql
-- 使用CTE进行复杂分析
WITH 
-- 计算部门统计
dept_stats AS (
    SELECT 
        department,
        COUNT(*) AS emp_count,
        AVG(salary) AS avg_salary,
        STDDEV(salary) AS salary_stddev
    FROM memory.default.employees
    GROUP BY department
),
-- 计算员工绩效评分
emp_performance AS (
    SELECT 
        e.name,
        e.department,
        e.salary,
        COUNT(o.order_id) AS order_count,
        COALESCE(SUM(o.price * o.quantity), 0) AS total_sales
    FROM memory.default.employees e
    LEFT JOIN memory.default.orders o ON e.id = o.customer_id
    GROUP BY e.name, e.department, e.salary
)
-- 综合分析
SELECT 
    ep.name,
    ep.department,
    ep.salary,
    ds.avg_salary AS dept_avg_salary,
    ep.salary - ds.avg_salary AS salary_diff,
    ep.order_count,
    ep.total_sales,
    CASE 
        WHEN ep.salary > ds.avg_salary AND ep.total_sales > 50 THEN 'Star Performer'
        WHEN ep.salary > ds.avg_salary THEN 'High Paid'
        WHEN ep.total_sales > 50 THEN 'High Sales'
        ELSE 'Standard'
    END AS performance_category
FROM emp_performance ep
JOIN dept_stats ds ON ep.department = ds.department
ORDER BY ep.total_sales DESC, ep.salary DESC;
```

## 🎛️ 查询优化提示

### ⚡ 性能优化技巧

**使用EXPLAIN查看执行计划**：
```sql
-- 查看查询执行计划
EXPLAIN (TYPE DISTRIBUTED, FORMAT TEXT)
SELECT 
    e.name,
    COUNT(o.order_id) AS order_count
FROM memory.default.employees e
LEFT JOIN memory.default.orders o ON e.id = o.customer_id
GROUP BY e.name;
```

**使用ANALYZE查看详细统计**：
```sql
-- 分析查询性能
EXPLAIN ANALYZE
SELECT 
    department,
    AVG(salary) AS avg_salary
FROM memory.default.employees
GROUP BY department;
```

### 💡 最佳实践建议

**查询优化建议**：
1. **尽早过滤**：在JOIN之前先过滤数据
2. **选择合适的JOIN类型**：根据数据分布选择JOIN策略
3. **使用列投影**：只查询需要的列
4. **合理使用索引**：在支持的连接器中使用索引

**示例优化前后对比**：
```sql
-- 写法一：在WHERE中声明过滤条件；优化器可能将过滤下推
SELECT e.name, o.product
FROM memory.default.employees e
JOIN memory.default.orders o ON e.id = o.customer_id
WHERE e.department = 'Engineering' AND o.price > 30;

-- 写法二：在子查询中声明过滤条件；是否改善性能需比较执行计划和实际测量结果
SELECT e.name, o.product
FROM (SELECT id, name FROM memory.default.employees WHERE department = 'Engineering') e
JOIN (SELECT customer_id, product FROM memory.default.orders WHERE price > 30) o 
ON e.id = o.customer_id;
```

## 🔧 常见错误处理

### ❌ 错误类型和解决方案

**语法错误**：
```sql
-- 合法别名写法：只返回name列，并将输出列命名为department
SELECT name department FROM memory.default.employees;

-- 如果需要同时查询name和department两列，应使用逗号分隔
SELECT name, department FROM memory.default.employees;
```

**类型转换错误**：
```sql
-- 错误示例
SELECT '123' + 456;
-- 字符串和数字相加

-- 正确写法
SELECT CAST('123' AS INTEGER) + 456;
-- 或者
SELECT TRY_CAST('123' AS INTEGER) + 456;
```

**内存不足错误**：
```sql
-- 在部署允许且权限满足时设置查询内存上限；此操作不保证解决内存不足
SET SESSION query_max_memory = '2GB';

-- LIMIT限制返回行数，但不能普遍降低连接、聚合等算子的中间内存占用
-- large_table为占位表名，需替换为实际表
SELECT * FROM large_table LIMIT 10000;
```

## ✅ 实践检验

### 🎯 基础能力验证

完成以下练习来验证你的理解：

**练习1：基础查询**
```sql
-- 编写查询来回答以下问题：
-- 1. 哪个部门的平均薪资最高？
-- 2. 入职时间最早的3名员工是谁？
-- 3. Engineering部门有多少员工？
```

**练习2：连接查询**
```sql
-- 编写查询来回答以下问题：
-- 1. 哪位员工的订单总金额最高？
-- 2. 哪个部门的员工购买了最多的商品？
-- 3. 列出所有没有订单的员工。
```

**练习3：高级分析**
```sql
-- 创建一个综合报表，包含：
-- 1. 每个员工的基本信息
-- 2. 他们的订单统计
-- 3. 他们相对于部门平均薪资的位置
-- 4. 按绩效排名
```

### 🚀 进阶挑战

**挑战1：创建更复杂的测试数据**
```sql
-- 创建包含1000行的随机测试数据
-- customer_id范围为1至100，并非全部对应前文5名员工
CREATE TABLE memory.default.large_orders AS
SELECT
    x AS order_id,
    CAST(floor(random() * 100) AS INTEGER) + 1 AS customer_id,
    'Product_' || CAST(CAST(floor(random() * 50) AS INTEGER) AS VARCHAR) AS product_name,
    CAST(floor(random() * 10) AS INTEGER) + 1 AS quantity,
    CAST(random() * 100 + 10 AS DECIMAL(10,2)) AS price,
    date_add('day', -CAST(floor(random() * 365) AS BIGINT), current_date) AS order_date
FROM UNNEST(sequence(1, 1000)) AS t(x);
```

**挑战2：性能对比测试**
```sql
-- 对比不同查询方法的性能
-- 使用EXPLAIN ANALYZE比较执行时间
```

## 🔗 学习连接

### 📚 本节核心技能

- **基础操作**：连接Presto、系统信息查询、基础SQL操作
- **数据操作**：创建表、插入数据、数据类型处理
- **查询技巧**：聚合函数、JOIN操作、子查询、CTE
- **性能优化**：执行计划分析、查询优化技巧

### 🎯 下一步学习

**基础掌握检查**：
- ✅ 能够成功连接到Presto并执行查询？
- ✅ 理解基本的SQL查询语法？
- ✅ 掌握JOIN和聚合操作？

**继续学习路径**：
- [[【技术与工具】/Presto/05-Presto SQL语法基础|Presto SQL语法]] - 深入SQL
- [[【技术与工具】/Presto/06-数据类型与函数|数据类型与函数]] - 数据类型
- [[【技术与工具】/Presto/07-连接器详解|连接器]] - 连接器

---

> [!tip] 💡 查询成功要点
> 
> 🎯 **第一次查询的收获**：
> - 🔍 **SQL熟练度** - Presto使用标准SQL语法
> - ⚡ **性能体验** - 感受秒级查询响应
> - 🔗 **连接能力** - 体验多表关联查询
> - 📊 **分析功能** - 掌握聚合和分析函数
> 
> 🚀 **继续深入**：基础查询掌握后，进入 05-Presto SQL语法基础|Presto SQL语法基础 学习更高级的SQL特性！