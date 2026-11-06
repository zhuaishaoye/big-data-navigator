---
title: PostgreSQL高级查询与函数
tags:
  - PostgreSQL
  - 高级查询
  - 窗口函数
  - CTE
  - 函数
  - 存储过程
  - 聚合函数
difficulty: 中级
duration: 45分钟
description: 深入学习PostgreSQL的高级查询技巧、窗口函数、内置函数和自定义函数，提升SQL技能到专业水平。
knowledge_type: technical-practice
target_audience:
  - 数据分析师
  - 数据开发工程师
  - 数据科学家
  - BI分析师
stability: stable
status: active
access_tier: free
updated: 2026-10-10
---


# 🚀 PostgreSQL高级查询与函数

## 📚 学习目标

通过本章节的学习，你将能够：
- **掌握窗口函数**的使用和各种应用场景
- **熟练使用高级CTE**和递归查询
- **理解PostgreSQL内置函数**的丰富功能
- **学会创建自定义函数**、触发器函数和自定义聚合函数
- **掌握高级聚合**和分析查询技巧

> [!tip] 💡 学习建议
> 高级查询是PostgreSQL的精髓所在，**不要急于理解所有概念**。就像学习高等数学一样，需要在理解基础概念的基础上逐步深入。**每个函数都有其特定的应用场景**，通过实际例子来理解它们的用途和价值。

## 🎯 窗口函数详解

窗口函数是PostgreSQL最强大的特性之一，它允许在不使用GROUP BY的情况下进行聚合计算。

### 1. 窗口函数基础

```sql
-- 创建示例数据
CREATE TABLE sales_data (
    id SERIAL PRIMARY KEY,
    salesperson VARCHAR(50),
    region VARCHAR(50),
    sale_date DATE,
    amount DECIMAL(10,2),
    product_category VARCHAR(50)
);

INSERT INTO sales_data (salesperson, region, sale_date, amount, product_category) VALUES
('张三', '华北', '2024-01-01', 10000.00, '电子产品'),
('李四', '华北', '2024-01-02', 15000.00, '家电'),
('王五', '华南', '2024-01-03', 12000.00, '电子产品'),
('赵六', '华南', '2024-01-04', 8000.00, '家电'),
('张三', '华北', '2024-01-05', 18000.00, '电子产品'),
('李四', '华北', '2024-01-06', 20000.00, '家电'),
('王五', '华南', '2024-01-07', 14000.00, '电子产品'),
('赵六', '华南', '2024-01-08', 11000.00, '家电'),
('张三', '华北', '2024-01-09', 16000.00, '电子产品'),
('李四', '华北', '2024-01-10', 13000.00, '家电');

-- 基本窗口函数语法
SELECT 
    salesperson,
    region,
    amount,
    -- 总计和平均值
    SUM(amount) OVER () as total_sales,
    AVG(amount) OVER () as avg_sales,
    COUNT(*) OVER () as total_records,
    
    -- 按区域分组的统计
    SUM(amount) OVER (PARTITION BY region) as region_total,
    AVG(amount) OVER (PARTITION BY region) as region_avg,
    COUNT(*) OVER (PARTITION BY region) as region_count
FROM sales_data
ORDER BY region, salesperson;
```

### 2. 排名函数

```sql
-- 排名函数示例
SELECT 
    salesperson,
    region,
    amount,
    
    -- 全局排名
    ROW_NUMBER() OVER (ORDER BY amount DESC) as row_num,
    RANK() OVER (ORDER BY amount DESC) as rank_num,
    DENSE_RANK() OVER (ORDER BY amount DESC) as dense_rank_num,
    NTILE(4) OVER (ORDER BY amount DESC) as quartile,
    
    -- 分区排名
    ROW_NUMBER() OVER (PARTITION BY region ORDER BY amount DESC) as region_row_num,
    RANK() OVER (PARTITION BY region ORDER BY amount DESC) as region_rank,
    DENSE_RANK() OVER (PARTITION BY region ORDER BY amount DESC) as region_dense_rank,
    
    -- 百分位排名
    PERCENT_RANK() OVER (ORDER BY amount) as percent_rank,
    CUME_DIST() OVER (ORDER BY amount) as cumulative_dist
FROM sales_data
ORDER BY amount DESC;

-- 查找每个区域的前3名销售
SELECT * FROM (
    SELECT 
        salesperson,
        region,
        amount,
        ROW_NUMBER() OVER (PARTITION BY region ORDER BY amount DESC) as rn
    FROM sales_data
) ranked
WHERE rn <= 3;

-- 查找销售额超过区域平均值的记录
SELECT
    salesperson,
    region,
    amount,
    region_avg,
    amount - region_avg as diff_from_avg
FROM (
    SELECT
        salesperson,
        region,
        amount,
        AVG(amount) OVER (PARTITION BY region) as region_avg
    FROM sales_data
) sales_with_avg
WHERE amount > region_avg;
```

### 3. 偏移函数

```sql
-- 偏移函数：访问其他行的数据
SELECT 
    salesperson,
    region,
    sale_date,
    amount,
    
    -- 前一行和后一行的数据
    LAG(amount, 1) OVER (PARTITION BY region ORDER BY sale_date) as prev_amount,
    LEAD(amount, 1) OVER (PARTITION BY region ORDER BY sale_date) as next_amount,
    
    -- 计算环比增长
    amount - LAG(amount, 1) OVER (PARTITION BY region ORDER BY sale_date) as amount_change,
    ROUND(
        (amount - LAG(amount, 1) OVER (PARTITION BY region ORDER BY sale_date)) * 100.0 / 
        NULLIF(LAG(amount, 1) OVER (PARTITION BY region ORDER BY sale_date), 0), 2
    ) as growth_rate,
    
    -- 第一行和最后一行的值
    FIRST_VALUE(amount) OVER (PARTITION BY region ORDER BY sale_date) as first_sale,
    LAST_VALUE(amount) OVER (
        PARTITION BY region 
        ORDER BY sale_date 
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) as last_sale,
    
    -- 第N个值
    NTH_VALUE(amount, 2) OVER (PARTITION BY region ORDER BY sale_date) as second_sale
FROM sales_data
ORDER BY region, sale_date;
```

### 4. 累积计算

```sql
-- 累积计算
SELECT 
    salesperson,
    region,
    sale_date,
    amount,
    
    -- 累积求和
    SUM(amount) OVER (
        PARTITION BY region 
        ORDER BY sale_date 
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) as cumulative_sum,
    
    -- 移动平均（当前行及前两行，不保证覆盖连续3天）
    AVG(amount) OVER (
        PARTITION BY region 
        ORDER BY sale_date 
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) as moving_avg_3days,
    
    -- 累积计数
    COUNT(*) OVER (
        PARTITION BY region 
        ORDER BY sale_date 
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) as cumulative_count,
    
    -- 滚动最大值和最小值
    MAX(amount) OVER (
        PARTITION BY region 
        ORDER BY sale_date 
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) as rolling_max,
    MIN(amount) OVER (
        PARTITION BY region 
        ORDER BY sale_date 
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) as rolling_min
FROM sales_data
ORDER BY region, sale_date;
```

## 🔄 高级CTE和递归查询

### 1. 复杂CTE示例

```sql
-- 创建层级数据示例
CREATE TABLE employees_hierarchy (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50),
    manager_id INTEGER REFERENCES employees_hierarchy(id),
    department VARCHAR(50),
    salary DECIMAL(10,2)
);

INSERT INTO employees_hierarchy (name, manager_id, department, salary) VALUES
('CEO', NULL, 'Executive', 200000),
('CTO', 1, 'Technology', 180000),
('CFO', 1, 'Finance', 170000),
('VP Engineering', 2, 'Technology', 150000),
('VP Finance', 3, 'Finance', 140000),
('Senior Engineer', 4, 'Technology', 120000),
('Engineer', 6, 'Technology', 80000),
('Junior Engineer', 6, 'Technology', 60000),
('Accountant', 5, 'Finance', 70000),
('Financial Analyst', 5, 'Finance', 65000);

-- 多层CTE查询
WITH RECURSIVE 
-- CTE 1: 计算每个部门的统计信息
department_stats AS (
    SELECT 
        department,
        COUNT(*) as employee_count,
        AVG(salary) as avg_salary,
        MIN(salary) as min_salary,
        MAX(salary) as max_salary
    FROM employees_hierarchy
    GROUP BY department
),
-- CTE 2: 递归查询组织结构
org_chart AS (
    -- 基础查询：顶级管理者
    SELECT 
        id,
        name,
        manager_id,
        department,
        salary,
        1 as level,
        name::TEXT as path,
        ARRAY[id] as id_path
    FROM employees_hierarchy
    WHERE manager_id IS NULL
    
    UNION ALL
    
    -- 递归查询：下级员工
    SELECT 
        e.id,
        e.name,
        e.manager_id,
        e.department,
        e.salary,
        oc.level + 1,
        oc.path || ' -> ' || e.name,
        oc.id_path || e.id
    FROM employees_hierarchy e
    JOIN org_chart oc ON e.manager_id = oc.id
),
-- CTE 3: 计算每个人的团队信息
team_info AS (
    SELECT 
        oc1.id,
        oc1.name,
        oc1.level,
        oc1.path,
        COUNT(oc2.id) as direct_reports,
        -- 计算所有下属（包括间接下属）
        (SELECT COUNT(*) FROM org_chart oc3 
         WHERE oc1.id = ANY(oc3.id_path) AND oc3.id != oc1.id) as total_reports
    FROM org_chart oc1
    LEFT JOIN org_chart oc2 ON oc2.manager_id = oc1.id
    GROUP BY oc1.id, oc1.name, oc1.level, oc1.path
)
-- 主查询：综合所有信息
SELECT 
    ti.name,
    ti.level,
    ti.path,
    eh.department,
    eh.salary,
    ds.avg_salary as dept_avg_salary,
    ROUND((eh.salary - ds.avg_salary) / ds.avg_salary * 100, 2) as salary_vs_dept_avg,
    ti.direct_reports,
    ti.total_reports
FROM team_info ti
JOIN employees_hierarchy eh ON ti.id = eh.id
JOIN department_stats ds ON eh.department = ds.department
ORDER BY ti.level, eh.department, eh.salary DESC;
```

### 2. 递归查询实际应用

```sql
-- 创建产品分类层级表
CREATE TABLE product_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    parent_id INTEGER REFERENCES product_categories(id),
    level INTEGER,
    is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO product_categories (name, parent_id, level) VALUES
('所有商品', NULL, 1),
('电子产品', 1, 2),
('家居用品', 1, 2),
('服装', 1, 2),
('手机', 2, 3),
('电脑', 2, 3),
('家具', 3, 3),
('厨具', 3, 3),
('男装', 4, 3),
('女装', 4, 3),
('智能手机', 5, 4),
('功能手机', 5, 4),
('笔记本电脑', 6, 4),
('台式电脑', 6, 4);

-- 递归查询：获取完整的分类树
WITH RECURSIVE category_tree AS (
    -- 基础查询：根分类
    SELECT 
        id,
        name,
        parent_id,
        level,
        name::TEXT as full_path,
        ARRAY[id] as path_ids,
        0 as depth
    FROM product_categories
    WHERE parent_id IS NULL
    
    UNION ALL
    
    -- 递归查询：子分类
    SELECT 
        pc.id,
        pc.name,
        pc.parent_id,
        pc.level,
        ct.full_path || ' > ' || pc.name,
        ct.path_ids || pc.id,
        ct.depth + 1
    FROM product_categories pc
    JOIN category_tree ct ON pc.parent_id = ct.id
)
SELECT 
    id,
    REPEAT('  ', depth) || name as indented_name,
    full_path,
    depth,
    (SELECT COUNT(*) FROM category_tree ct2 
     WHERE ct2.parent_id = category_tree.id) as child_count
FROM category_tree
ORDER BY path_ids;

-- 查找特定分类的所有祖先
WITH RECURSIVE ancestors AS (
    -- 基础查询：目标分类
    SELECT id, name, parent_id, 0 as level
    FROM product_categories
    WHERE name = '智能手机'
    
    UNION ALL
    
    -- 递归查询：祖先分类
    SELECT pc.id, pc.name, pc.parent_id, a.level + 1
    FROM product_categories pc
    JOIN ancestors a ON pc.id = a.parent_id
)
SELECT name, level FROM ancestors ORDER BY level DESC;

-- 查找特定分类的所有后代
WITH RECURSIVE descendants AS (
    -- 基础查询：目标分类
    SELECT id, name, parent_id, 0 as level
    FROM product_categories
    WHERE name = '电子产品'
    
    UNION ALL
    
    -- 递归查询：后代分类
    SELECT pc.id, pc.name, pc.parent_id, d.level + 1
    FROM product_categories pc
    JOIN descendants d ON pc.parent_id = d.id
)
SELECT name, level FROM descendants ORDER BY level, name;
```

## 🧮 内置函数详解

### 1. 字符串函数

```sql
-- 字符串处理函数
SELECT 
    -- 基本字符串函数
    LENGTH('PostgreSQL') as str_length,
    CHAR_LENGTH('中文测试') as char_length,
    UPPER('hello world') as upper_case,
    LOWER('HELLO WORLD') as lower_case,
    INITCAP('hello world') as title_case,
    
    -- 字符串拼接和分割
    CONCAT('Hello', ' ', 'World') as concat_result,
    'Hello' || ' ' || 'World' as concat_operator,
    STRING_AGG(name, ', ' ORDER BY name) as aggregated_names,
    
    -- 字符串查找和替换
    POSITION('SQL' IN 'PostgreSQL') as position_result,
    STRPOS('PostgreSQL', 'SQL') as strpos_result,
    REPLACE('Hello World', 'World', 'PostgreSQL') as replace_result,
    TRANSLATE('Hello', 'elo', '310') as translate_result,
    
    -- 字符串截取和填充
    SUBSTRING('PostgreSQL' FROM 1 FOR 5) as substring_result,
    LEFT('PostgreSQL', 5) as left_result,
    RIGHT('PostgreSQL', 3) as right_result,
    LPAD('123', 6, '0') as lpad_result,
    RPAD('123', 6, '0') as rpad_result,
    
    -- 字符串清理
    TRIM('  Hello World  ') as trim_result,
    LTRIM('  Hello World  ') as ltrim_result,
    RTRIM('  Hello World  ') as rtrim_result,
    TRIM(BOTH '[]' FROM '[Hello World]') as trim_chars
FROM employees_hierarchy
LIMIT 1;

-- 实际应用：格式化员工姓名
SELECT 
    name,
    UPPER(name) as name_upper,
    INITCAP(LOWER(name)) as name_proper,
    CONCAT(SUBSTRING(name FROM 1 FOR 1), '***') as name_masked,
    CASE 
        WHEN LENGTH(name) > 10 THEN SUBSTRING(name FROM 1 FOR 10) || '...'
        ELSE name
    END as name_truncated
FROM employees_hierarchy;
```

### 2. 数学函数

```sql
-- 数学计算函数
SELECT 
    -- 基本数学函数
    ABS(-42) as absolute_value,
    CEIL(4.3) as ceiling_value,
    FLOOR(4.7) as floor_value,
    ROUND(4.567, 2) as rounded_value,
    TRUNC(4.567, 1) as truncated_value,
    
    -- 三角函数
    SIN(PI() / 2) as sine_90_degrees,
    COS(0) as cosine_0_degrees,
    TAN(PI() / 4) as tangent_45_degrees,
    
    -- 对数和指数函数
    LN(10) as natural_log,
    LOG(100) as log_base_10,
    EXP(1) as e_to_power_1,
    POWER(2, 10) as power_result,
    SQRT(16) as square_root,
    
    -- 随机数
    RANDOM() as random_0_to_1,
    FLOOR(RANDOM() * 100) as random_0_to_99,
    
    -- 统计函数
    GREATEST(1, 5, 3, 9, 2) as greatest_value,
    LEAST(1, 5, 3, 9, 2) as least_value;

-- 实际应用：薪资统计和计算
SELECT 
    name,
    salary,
    ROUND(salary * 0.8, 2) as assumed_after_tax_salary, -- 假设统一扣减20%，不代表实际税后薪资
    ROUND(salary / 12, 2) as monthly_salary,
    CASE 
        WHEN salary >= 150000 THEN '高级'
        WHEN salary >= 100000 THEN '中级'
        ELSE '初级'
    END as salary_level,
    ROUND((salary - 60000) / 60000.0 * 100, 2) as salary_index
FROM employees_hierarchy
WHERE salary IS NOT NULL;
```

### 3. 日期时间函数

```sql
-- 创建示例时间数据
CREATE TEMP TABLE time_examples AS
SELECT 
    generate_series(1, 10) as id,
    CURRENT_DATE + (generate_series(1, 10) - 1) * INTERVAL '1 day' as sample_date,
    CURRENT_TIMESTAMP + (generate_series(1, 10) - 1) * INTERVAL '1 hour' as sample_timestamp;

-- 日期时间函数
SELECT 
    -- 当前时间函数
    CURRENT_DATE as current_date,
    CURRENT_TIME as current_time,
    CURRENT_TIMESTAMP as current_timestamp,
    NOW() as now_timestamp,
    CLOCK_TIMESTAMP() as clock_timestamp,
    
    -- 日期时间提取
    EXTRACT(YEAR FROM CURRENT_DATE) as current_year,
    EXTRACT(MONTH FROM CURRENT_DATE) as current_month,
    EXTRACT(DAY FROM CURRENT_DATE) as current_day,
    EXTRACT(DOW FROM CURRENT_DATE) as day_of_week,  -- 0=Sunday
    EXTRACT(DOY FROM CURRENT_DATE) as day_of_year,
    EXTRACT(WEEK FROM CURRENT_DATE) as week_number,
    
    -- 日期时间格式化
    TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') as formatted_date,
    TO_CHAR(CURRENT_TIMESTAMP, 'YYYY-MM-DD HH24:MI:SS') as formatted_timestamp,
    TO_CHAR(CURRENT_TIMESTAMP, 'Day, Month DD, YYYY') as formatted_full,
    
    -- 日期时间运算
    CURRENT_DATE + INTERVAL '30 days' as plus_30_days,
    CURRENT_DATE - INTERVAL '1 year' as minus_1_year,
    AGE(CURRENT_DATE, '1990-01-01') as age_from_date,
    
    -- 日期时间截断
    DATE_TRUNC('month', CURRENT_DATE) as month_start,
    DATE_TRUNC('week', CURRENT_DATE) as week_start,
    DATE_TRUNC('hour', CURRENT_TIMESTAMP) as hour_start;

-- 实际应用：生成时间序列和统计
WITH date_series AS (
    SELECT generate_series(
        '2024-01-01'::date,
        '2024-12-31'::date,
        '1 day'::interval
    )::date as date_value
)
SELECT 
    EXTRACT(YEAR FROM date_value) as year,
    EXTRACT(MONTH FROM date_value) as month,
    TO_CHAR(date_value, 'Month') as month_name,
    COUNT(*) as days_in_month,
    MIN(date_value) as month_start,
    MAX(date_value) as month_end,
    SUM(CASE WHEN EXTRACT(DOW FROM date_value) IN (0, 6) THEN 1 ELSE 0 END) as weekend_days,
    SUM(CASE WHEN EXTRACT(DOW FROM date_value) NOT IN (0, 6) THEN 1 ELSE 0 END) as weekdays
FROM date_series
GROUP BY 
    EXTRACT(YEAR FROM date_value),
    EXTRACT(MONTH FROM date_value),
    TO_CHAR(date_value, 'Month')
ORDER BY year, month;
```

### 4. JSON函数

```sql
-- 创建JSON数据示例
CREATE TEMP TABLE json_examples (
    id SERIAL PRIMARY KEY,
    user_info JSONB,
    settings JSONB,
    metadata JSON
);

INSERT INTO json_examples (user_info, settings, metadata) VALUES
('{"name": "张三", "age": 30, "skills": ["Python", "SQL", "PostgreSQL"], "address": {"city": "北京", "district": "朝阳区"}}',
 '{"theme": "dark", "language": "zh-CN", "notifications": {"email": true, "sms": false}}',
 '{"created_at": "2024-01-01", "version": "1.0", "tags": ["user", "active"]}'),
('{"name": "李四", "age": 25, "skills": ["Java", "JavaScript", "React"], "address": {"city": "上海", "district": "浦东新区"}}',
 '{"theme": "light", "language": "en-US", "notifications": {"email": false, "sms": true}}',
 '{"created_at": "2024-01-02", "version": "1.1", "tags": ["user", "premium"]}');

-- JSON操作函数
SELECT 
    id,
    -- JSON提取操作符
    user_info->>'name' as name,
    user_info->'age' as age_json,
    (user_info->>'age')::INTEGER as age_integer,
    user_info->'address'->>'city' as city,
    user_info->'skills'->0 as first_skill,
    
    -- JSON路径查询
    user_info #> '{address,city}' as city_path,
    user_info #>> '{address,city}' as city_text,
    
    -- JSON数组操作
    JSONB_ARRAY_LENGTH(user_info->'skills') as skills_count,
    user_info->'skills' ? 'Python' as has_python_skill,
    user_info->'skills' ?| ARRAY['Python', 'Java'] as has_any_language,
    user_info->'skills' ?& ARRAY['Python', 'SQL'] as has_all_basic,
    
    -- JSON包含操作
    user_info @> '{"age": 30}' as is_age_30,
    user_info @> '{"address": {"city": "北京"}}' as is_beijing,
    
    -- JSON键和值操作
    JSONB_OBJECT_KEYS(settings) as setting_keys,
    JSONB_EACH(settings) as setting_pairs,
    JSONB_EACH_TEXT(settings) as setting_text_pairs
FROM json_examples;

-- JSON聚合和构建
SELECT 
    -- 聚合JSON
    JSONB_AGG(user_info) as all_users,
    JSONB_OBJECT_AGG(id, user_info->>'name') as id_name_map,
    
    -- 构建JSON对象
    JSON_BUILD_OBJECT(
        'total_users', COUNT(*),
        'average_age', AVG((user_info->>'age')::INTEGER),
        'cities', JSONB_AGG(DISTINCT user_info->'address'->>'city')
    ) as summary_stats
FROM json_examples;

-- JSON修改和更新
SELECT 
    id,
    user_info,
    -- 添加或更新字段
    JSONB_SET(user_info, '{last_login}', '"2024-01-15"') as with_last_login,
    JSONB_SET(user_info, '{address,postal_code}', '"100000"') as with_postal_code,
    
    -- 删除字段
    user_info - 'age' as without_age,
    user_info #- '{address,district}' as without_district,
    
    -- 合并JSON
    user_info || '{"status": "active", "verified": true}' as merged_info,
    
    -- 在skills数组的首个元素之前插入新元素
    JSONB_INSERT(user_info, '{skills,0}', '"PostgreSQL"') as skills_with_postgresql
FROM json_examples;
```

## 🔧 自定义函数、触发器和聚合函数

### 1. 简单函数

```sql
-- 创建简单函数：计算圆面积
CREATE OR REPLACE FUNCTION calculate_circle_area(radius NUMERIC)
RETURNS NUMERIC AS $$
BEGIN
    RETURN PI() * radius * radius;
END;
$$ LANGUAGE plpgsql;

-- 使用函数
SELECT calculate_circle_area(5) as area;

-- 创建函数：格式化姓名
CREATE OR REPLACE FUNCTION format_name(first_name TEXT, last_name TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN INITCAP(TRIM(first_name)) || ' ' || UPPER(TRIM(last_name));
END;
$$ LANGUAGE plpgsql;

-- 使用函数
SELECT format_name('john', 'doe') as formatted_name;

-- 创建函数：计算年龄
CREATE OR REPLACE FUNCTION calculate_age(birth_date DATE)
RETURNS INTEGER AS $$
BEGIN
    RETURN EXTRACT(YEAR FROM AGE(birth_date));
END;
$$ LANGUAGE plpgsql;

-- 使用函数
SELECT calculate_age('1990-01-01') as age;
```

### 2. 复杂函数

```sql
-- 创建函数：薪资等级评估
CREATE OR REPLACE FUNCTION evaluate_salary_grade(
    salary NUMERIC,
    department TEXT DEFAULT NULL
)
RETURNS TABLE(
    grade TEXT,
    description TEXT,
    adjustment_needed BOOLEAN
) AS $$
DECLARE
    dept_avg NUMERIC;
    grade_result TEXT;
    desc_result TEXT;
    adjustment BOOLEAN := FALSE;
BEGIN
    -- 获取部门平均薪资
    IF department IS NOT NULL THEN
        SELECT AVG(e.salary) INTO dept_avg
        FROM employees_hierarchy e
        WHERE e.department = evaluate_salary_grade.department;
    END IF;
    
    -- 判断薪资等级
    CASE 
        WHEN salary >= 150000 THEN
            grade_result := 'A';
            desc_result := '高级薪资';
        WHEN salary >= 100000 THEN
            grade_result := 'B';
            desc_result := '中级薪资';
        WHEN salary >= 60000 THEN
            grade_result := 'C';
            desc_result := '标准薪资';
        ELSE
            grade_result := 'D';
            desc_result := '入门薪资';
            adjustment := TRUE;
    END CASE;
    
    -- 检查是否需要调整
    IF dept_avg IS NOT NULL AND salary < dept_avg * 0.8 THEN
        adjustment := TRUE;
    END IF;
    
    RETURN QUERY SELECT grade_result, desc_result, adjustment;
END;
$$ LANGUAGE plpgsql;

-- 使用函数
SELECT 
    name,
    salary,
    department,
    (evaluate_salary_grade(salary, department)).*
FROM employees_hierarchy
WHERE salary IS NOT NULL;
```

### 3. 触发器函数

```sql
-- 创建审计表
CREATE TABLE salary_audit (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER,
    old_salary NUMERIC,
    new_salary NUMERIC,
    change_amount NUMERIC,
    change_percentage NUMERIC,
    changed_by TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建触发器函数
CREATE OR REPLACE FUNCTION salary_change_audit()
RETURNS TRIGGER AS $$
BEGIN
    -- 只在薪资变化时记录
    IF OLD.salary IS DISTINCT FROM NEW.salary THEN
        INSERT INTO salary_audit (
            employee_id,
            old_salary,
            new_salary,
            change_amount,
            change_percentage,
            changed_by
        ) VALUES (
            NEW.id,
            OLD.salary,
            NEW.salary,
            NEW.salary - OLD.salary,
            ROUND((NEW.salary - OLD.salary) / NULLIF(OLD.salary, 0) * 100, 2),
            CURRENT_USER
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER salary_audit_trigger
    AFTER UPDATE ON employees_hierarchy
    FOR EACH ROW
    EXECUTE FUNCTION salary_change_audit();

-- 测试触发器
UPDATE employees_hierarchy 
SET salary = salary * 1.1 
WHERE name = 'Engineer';

-- 查看审计记录
SELECT * FROM salary_audit;
```

### 4. 聚合函数

```sql
-- 创建自定义聚合函数：产品（相乘）
CREATE OR REPLACE FUNCTION multiply_values(state NUMERIC, next_val NUMERIC)
RETURNS NUMERIC AS $$
BEGIN
    RETURN COALESCE(state, 1) * COALESCE(next_val, 1);
END;
$$ LANGUAGE plpgsql;

-- 创建聚合函数
CREATE AGGREGATE product(NUMERIC) (
    SFUNC = multiply_values,
    STYPE = NUMERIC,
    INITCOND = 1
);

-- 使用自定义聚合函数
SELECT 
    department,
    COUNT(*) as employee_count,
    AVG(salary) as avg_salary,
    product(CASE WHEN salary > 0 THEN salary / 100000.0 ELSE 1 END) as salary_product
FROM employees_hierarchy
WHERE salary IS NOT NULL
GROUP BY department;
```

## 🎯 高级查询实战

### 1. 复杂分析查询

```sql
-- 综合分析：以薪资比例模拟绩效标签，仅演示查询逻辑，不代表真实员工绩效
WITH employee_metrics AS (
    SELECT 
        e.*,
        -- 计算相对薪资水平
        e.salary / AVG(e.salary) OVER (PARTITION BY e.department) as salary_ratio,
        
        -- 排名信息
        ROW_NUMBER() OVER (PARTITION BY e.department ORDER BY e.salary DESC) as dept_salary_rank,
        PERCENT_RANK() OVER (PARTITION BY e.department ORDER BY e.salary) as dept_salary_percentile,
        
        -- 团队信息
        (SELECT COUNT(*) FROM employees_hierarchy e2 WHERE e2.manager_id = e.id) as direct_reports,
        
        -- 层级信息
        CASE 
            WHEN e.manager_id IS NULL THEN 0
            ELSE (WITH RECURSIVE levels AS (
                SELECT id, manager_id, 1 as level
                FROM employees_hierarchy
                WHERE id = e.id
                UNION ALL
                SELECT eh.id, eh.manager_id, l.level + 1
                FROM employees_hierarchy eh
                JOIN levels l ON eh.id = l.manager_id
            ) SELECT MAX(level) - 1 FROM levels)
        END as hierarchy_level
    FROM employees_hierarchy e
),
performance_categories AS (
    SELECT 
        *,
        CASE 
            WHEN salary_ratio >= 1.2 THEN '高绩效'
            WHEN salary_ratio >= 0.9 THEN '标准绩效'
            ELSE '待提升'
        END as performance_category,
        
        CASE 
            WHEN dept_salary_percentile >= 0.8 THEN '顶级'
            WHEN dept_salary_percentile >= 0.6 THEN '优秀'
            WHEN dept_salary_percentile >= 0.4 THEN '良好'
            WHEN dept_salary_percentile >= 0.2 THEN '一般'
            ELSE '待改进'
        END as salary_grade
    FROM employee_metrics
)
SELECT 
    name,
    department,
    salary,
    ROUND(salary_ratio, 2) as salary_vs_dept_avg,
    dept_salary_rank,
    salary_grade,
    performance_category,
    direct_reports,
    hierarchy_level,
    CASE 
        WHEN direct_reports > 0 THEN '管理者'
        WHEN hierarchy_level <= 2 THEN '高级员工'
        ELSE '普通员工'
    END as role_type
FROM performance_categories
ORDER BY department, salary DESC;
```

### 2. 时间序列分析

```sql
-- 创建销售时间序列数据
CREATE TEMP TABLE daily_sales AS
SELECT 
    date_series.date_value as sale_date,
    CASE 
        WHEN EXTRACT(DOW FROM date_series.date_value) IN (0, 6) THEN 
            ROUND((RANDOM() * 5000 + 2000)::NUMERIC, 2)  -- 周末销售额较低
        ELSE 
            ROUND((RANDOM() * 10000 + 5000)::NUMERIC, 2)  -- 工作日销售额较高
    END as daily_amount,
    CASE 
        WHEN EXTRACT(MONTH FROM date_series.date_value) IN (11, 12, 1) THEN '旺季'
        WHEN EXTRACT(MONTH FROM date_series.date_value) IN (6, 7, 8) THEN '淡季'
        ELSE '平季'
    END as season
FROM (
    SELECT generate_series(
        '2024-01-01'::date,
        '2024-12-31'::date,
        '1 day'::interval
    )::date as date_value
) date_series;

-- 时间序列分析查询
SELECT 
    sale_date,
    daily_amount,
    season,
    
    -- 移动平均
    ROUND(AVG(daily_amount) OVER (
        ORDER BY sale_date 
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ), 2) as ma_7_days,
    
    ROUND(AVG(daily_amount) OVER (
        ORDER BY sale_date 
        ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
    ), 2) as ma_30_days,
    
    -- 环比增长
    ROUND((daily_amount - LAG(daily_amount, 1) OVER (ORDER BY sale_date)) / 
          LAG(daily_amount, 1) OVER (ORDER BY sale_date) * 100, 2) as daily_growth,
    
    -- 相对前7天的增长率（本示例每日一行且日期连续，并非去年同期同比）
    ROUND((daily_amount - LAG(daily_amount, 7) OVER (ORDER BY sale_date)) / 
          LAG(daily_amount, 7) OVER (ORDER BY sale_date) * 100, 2) as weekly_growth,
    
    -- 累积销售额
    SUM(daily_amount) OVER (
        ORDER BY sale_date 
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) as cumulative_sales,
    
    -- 本月累积
    SUM(daily_amount) OVER (
        PARTITION BY DATE_TRUNC('month', sale_date)
        ORDER BY sale_date 
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) as monthly_cumulative,
    
    -- 排名
    ROW_NUMBER() OVER (
        PARTITION BY DATE_TRUNC('month', sale_date) 
        ORDER BY daily_amount DESC
    ) as monthly_rank
FROM daily_sales
ORDER BY sale_date
LIMIT 50;
```

## 🎯 小结

通过本章节的学习，我们掌握了：

1. **窗口函数**：排名、偏移、累积计算等高级分析技巧
2. **高级CTE**：复杂查询组织和递归查询应用
3. **内置函数**：字符串、数学、日期时间、JSON处理函数
4. **自定义函数**：创建函数、触发器、聚合函数
5. **高级查询实战**：复杂分析和时间序列处理

> [!abstract] 📚 下一步学习
> 现在你已经掌握了PostgreSQL的高级查询技巧，接下来我们将学习06-PostgreSQL索引与性能优化|PostgreSQL索引与性能优化，了解如何让你的查询运行得更快。

## 🔗 相关资源

- [[【技术与工具】/PostgreSQL/04-PostgreSQL基本SQL操作|PostgreSQL基本SQL操作]]
- [[【技术与工具】/PostgreSQL/00-PostgreSQL学习路线图|PostgreSQL]]
- SQL - 通用窗口函数概念

---

> 💡 **记住**：高级查询技巧需要**大量的实践来熟练掌握**。窗口函数特别强大，**先理解基本概念，再逐步学习复杂应用**。自定义函数可以让你的代码更加模块化和可重用，**但要注意性能影响**。在生产环境中，**始终关注查询性能**，使用EXPLAIN ANALYZE来验证你的优化效果！