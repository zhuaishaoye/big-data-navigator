---
title: ClickHouse SQL语法基础
tags:
  - ClickHouse
  - SQL语法
  - 查询分析
  - 聚合函数
  - 窗口函数
difficulty: 中级
duration: 45分钟
description: 掌握ClickHouse SQL语法的核心特性，学会使用强大的分析函数进行高效的数据查询和分析。
knowledge_type: technical-practice
target_audience:
  - 数据分析师
  - 数据开发工程师
  - BI分析师
  - 数据科学家
  - 数据架构师
stability: slow-changing
status: maintenance
access_tier: free
updated: 2026-10-10
---


# 📝 ClickHouse SQL语法基础

## 📚 学习目标

通过本章节的学习，你将能够：
- **掌握ClickHouse SQL基础语法**和特殊语法特性
- **熟练使用各种查询操作**进行数据检索和分析
- **掌握聚合函数和窗口函数**的使用方法
- **学会处理复杂数据类型**如数组、JSON、嵌套结构
- **理解ClickHouse特有的函数**和优化技巧

> [!tip] 💡 学习建议
> ClickHouse的SQL语法与标准SQL高度兼容，**但增加了许多强大的分析功能**。就像学习一种方言一样，**先掌握基础语法，再学习特色功能**。重点理解ClickHouse在分析查询方面的独特优势。

## 🔤 基础查询语法

### 1. SELECT基础结构

王医生带着大家来到医院的医疗查询中心："现在我们来学习如何从智能病历系统中查询和分析患者数据，这就像掌握ClickHouse的SQL查询语言一样重要。"

"医生每天的工作就是通过各种方式查询患者信息，"他指着查询终端，"从简单的'查看某个患者的基本信息'，到复杂的'分析全院患者的治疗效果趋势'，都需要熟练的查询技巧。"

"ClickHouse的查询语法就像我们医院的标准化询问流程，"他演示着操作界面，"结构清晰，逻辑性强。"

**专业技术对应**：
```sql
-- 医疗查询标准流程 (ClickHouse SELECT语法)
SELECT [DISTINCT] 检查项目1, 检查项目2, ...
FROM 病历数据库
[WHERE 筛选条件]
[GROUP BY 分组条件]
[HAVING 分组筛选]
[ORDER BY 排序规则]
[LIMIT 查询数量限制]
[FORMAT 结果输出格式];

-- 创建患者诊疗数据表
CREATE TABLE patient_treatments (
    treatment_date Date,
    patient_id UInt32,
    department LowCardinality(String),
    treatment_cost Decimal(10,2),
    session_count UInt32,
    doctor_id UInt64,
    hospital_area LowCardinality(String)
) ENGINE = MergeTree()
ORDER BY (treatment_date, patient_id);

-- 插入示例数据
INSERT INTO patient_treatments VALUES
    ('2024-01-01', 101, '心内科', 1299.99, 1, 1001, '北区'),
    ('2024-01-01', 102, '皮肤科', 89.99, 2, 1002, '南区'),
    ('2024-01-02', 103, '心内科', 599.99, 1, 1003, '北区'),
    ('2024-01-02', 104, '儿科', 29.99, 3, 1001, '东区'),
    ('2024-01-03', 105, '皮肤科', 149.99, 1, 1004, '西区');
```

### 2. 基本查询操作

"现在我来演示几种常见的患者信息查询方式，"王医生开始在查询终端上操作。

"第一种是完整病历查询，"他输入指令，"就像查看患者的完整档案，所有信息一目了然。"

"第二种是重点信息查询，"他调整查询条件，"只看医生关心的核心数据，比如诊断日期、患者编号、科室、治疗费用等，并且给这些字段起个更容易理解的名字。"

"第三种是条件筛选查询，"他设置了筛选条件，"比如只查看心内科的患者，并且治疗费用超过500元的病例，这样可以重点关注复杂病情。"

**专业技术对应**：
```sql
-- 完整病历查询
SELECT * FROM patient_treatments;

-- 重点信息查询（列选择和别名）
SELECT 
    treatment_date as visit_date,
    patient_id,
    department,
    treatment_cost as cost,
    session_count as sessions
FROM patient_treatments;

-- 条件筛选查询
SELECT *
FROM patient_treatments
WHERE department = '心内科'
  AND treatment_cost > 500;

-- 模糊匹配
SELECT *
FROM patient_treatments
WHERE department LIKE '%科'  -- 以'科'结尾
  OR department ILIKE '心%'; -- 不区分大小写，以'心'开头

-- 范围查询
SELECT *
FROM patient_treatments
WHERE treatment_date BETWEEN '2024-01-01' AND '2024-01-02'
  AND treatment_cost IN (89.99, 599.99, 1299.99);

-- 空值处理
SELECT 
    patient_id,
    department,
    CASE 
        WHEN treatment_cost IS NULL THEN 0
        ELSE treatment_cost
    END as safe_cost
FROM patient_treatments;
```

### 3. 排序和限制

```sql
-- 排序
SELECT *
FROM patient_treatments
ORDER BY treatment_cost DESC, treatment_date ASC;

-- 分页查询
SELECT *
FROM patient_treatments
ORDER BY treatment_date DESC
LIMIT 2 OFFSET 1;  -- 跳过1行，取2行

-- Top N查询
SELECT *
FROM patient_treatments
ORDER BY treatment_cost DESC
LIMIT 3;

-- 随机采样
SELECT *
FROM patient_treatments
ORDER BY rand()
LIMIT 2;

-- 去重查询
SELECT DISTINCT department, hospital_area
FROM patient_treatments
ORDER BY department;
```

## 📊 聚合函数详解

### 1. 基础聚合函数

```sql
-- 基本统计函数
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT patient_id) as unique_patients,
    SUM(treatment_cost) as total_cost,
    AVG(treatment_cost) as average_cost,
    MIN(treatment_cost) as min_cost,
    MAX(treatment_cost) as max_cost,
    STDDEV(treatment_cost) as cost_stddev,
    VAR(treatment_cost) as cost_variance
FROM patient_treatments;

-- 分组聚合
SELECT 
    department,
    COUNT(*) as treatment_count,
    SUM(treatment_cost) as total_cost,
    AVG(treatment_cost) as avg_cost,
    SUM(session_count) as total_sessions
FROM patient_treatments
GROUP BY department
ORDER BY total_cost DESC;

-- 多维分组
SELECT 
    category,
    region,
    COUNT(*) as orders,
    SUM(sales_amount) as revenue,
    AVG(sales_amount) as avg_revenue
FROM sales_data
GROUP BY category, region
ORDER BY category, revenue DESC;

-- 条件聚合
SELECT 
    category,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN sales_amount > 100 THEN 1 END) as high_value_orders,
    SUM(CASE WHEN region = 'North' THEN sales_amount ELSE 0 END) as north_revenue
FROM sales_data
GROUP BY category;
```

### 2. ClickHouse特有聚合函数

```sql
-- 近似聚合函数（高性能）
SELECT 
    category,
    uniqExact(customer_id) as exact_unique_customers,
    uniqHLL12(customer_id) as approx_unique_customers,
    quantile(0.5)(sales_amount) as median_sale,
    quantiles(0.25, 0.5, 0.75)(sales_amount) as quartiles
FROM sales_data
GROUP BY category;

-- 统计分布函数
SELECT 
    category,
    histogram(5)(sales_amount) as sales_histogram,
    topK(3)(product_id) as top_products,
    groupArray(sales_amount) as all_sales_amounts,
    groupUniqArray(customer_id) as unique_customers_array
FROM sales_data
GROUP BY category;

-- 字符串聚合
SELECT 
    region,
    groupConcat(category, ', ') as categories,
    groupArray(category) as category_array,
    arrayStringConcat(groupUniqArray(category), ' | ') as unique_categories
FROM sales_data
GROUP BY region;

-- 时间序列聚合（仅演示月内事件集合，不代表用户级转化或留存）
-- sequenceMatch需让两个类别进入同一分组；相同时间戳事件的先后顺序不确定
-- retention返回条件是否出现的标志数组，不直接返回留存率
SELECT 
    toYYYYMM(date) as month,

    sequenceMatch('(?1)(?2)')(date, category = 'Electronics', category = 'Clothing') as pattern_match,
    retention(date = '2024-01-01', date = '2024-01-02') as retention_flags
FROM sales_data
GROUP BY month;
```

### 3. HAVING子句

```sql
-- 聚合结果过滤
SELECT 
    category,
    COUNT(*) as order_count,
    SUM(sales_amount) as total_revenue
FROM sales_data
GROUP BY category
HAVING order_count >= 2
   AND total_revenue > 200
ORDER BY total_revenue DESC;

-- 复杂HAVING条件
SELECT 
    region,
    category,
    COUNT(*) as orders,
    AVG(sales_amount) as avg_amount
FROM sales_data
GROUP BY region, category
HAVING COUNT(DISTINCT customer_id) > 1
   OR AVG(sales_amount) > 100
ORDER BY avg_amount DESC;
```

## 🪟 窗口函数

### 1. 基础窗口函数

```sql
-- 创建更多测试数据
INSERT INTO sales_data VALUES
    ('2024-01-04', 106, 'Electronics', 899.99, 1, 1002, 'North'),
    ('2024-01-04', 107, 'Clothing', 199.99, 1, 1003, 'South'),
    ('2024-01-05', 108, 'Books', 39.99, 2, 1005, 'East'),
    ('2024-01-05', 109, 'Electronics', 1599.99, 1, 1001, 'West');

-- 排名函数
SELECT 
    date,
    product_id,
    category,
    sales_amount,
    -- 全局排名
    row_number() OVER (ORDER BY sales_amount DESC) as global_rank,
    rank() OVER (ORDER BY sales_amount DESC) as global_rank_with_ties,
    dense_rank() OVER (ORDER BY sales_amount DESC) as dense_rank,
    -- 分类排名
    row_number() OVER (PARTITION BY category ORDER BY sales_amount DESC) as category_rank,
    -- 百分位排名
    percent_rank() OVER (ORDER BY sales_amount) as percentile_rank
FROM sales_data
ORDER BY sales_amount DESC;

-- 偏移函数
SELECT 
    date,
    category,
    sales_amount,
    -- 获取前一行的值
    lag(sales_amount) OVER (PARTITION BY category ORDER BY date) as prev_amount,
    -- 获取后一行的值
    lead(sales_amount) OVER (PARTITION BY category ORDER BY date) as next_amount,
    -- 计算增长率
    round((sales_amount - lag(sales_amount) OVER (PARTITION BY category ORDER BY date)) / lag(sales_amount) OVER (PARTITION BY category ORDER BY date) * 100, 2) as growth_rate
FROM sales_data
ORDER BY category, date;

-- 聚合窗口函数
SELECT 
    date,
    category,
    sales_amount,
    -- 累计求和
    sum(sales_amount) OVER (PARTITION BY category ORDER BY date) as running_total,
    -- 移动平均
    avg(sales_amount) OVER (PARTITION BY category ORDER BY date ROWS 2 PRECEDING) as moving_avg_3,
    -- 累计计数
    count(*) OVER (PARTITION BY category ORDER BY date) as running_count,
    -- 最大值到当前
    max(sales_amount) OVER (PARTITION BY category ORDER BY date) as running_max
FROM sales_data
ORDER BY category, date;
```

### 2. 窗口帧定义

```sql
-- 不同的窗口帧类型
SELECT 
    date,
    sales_amount,
    -- 从开始到当前行
    sum(sales_amount) OVER (ORDER BY date ROWS UNBOUNDED PRECEDING) as cumulative_sum,
    -- 当前行和前后各1行
    avg(sales_amount) OVER (ORDER BY date ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) as centered_avg,
    -- 当前行到结束
    min(sales_amount) OVER (ORDER BY date ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING) as min_remaining,
    -- 固定窗口大小（最近3行）
    max(sales_amount) OVER (ORDER BY date ROWS 2 PRECEDING) as max_last_3
FROM sales_data
ORDER BY date;

-- 基于值范围的窗口
SELECT 
    date,
    sales_amount,
    -- 基于值范围的窗口（相同金额范围内）
    count(*) OVER (ORDER BY sales_amount RANGE BETWEEN 50 PRECEDING AND 50 FOLLOWING) as similar_amount_count,
    -- 获取排序后的首尾值
    first_value(sales_amount) OVER (ORDER BY sales_amount) as min_in_dataset,
    last_value(sales_amount) OVER (ORDER BY sales_amount ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as max_in_dataset
FROM sales_data
ORDER BY sales_amount;
```

### 3. 高级窗口分析

```sql
-- 时间序列分析
SELECT 
    date,
    category,
    sales_amount,
    -- 各年份季度内的累计销售额
    sum(sales_amount) OVER (PARTITION BY toYear(date), toQuarter(date), category ORDER BY date) as quarterly_total,
    -- 同类别、同星期几的前一条记录对比（不是同比）
    lag(sales_amount, 1) OVER (PARTITION BY category, toDayOfWeek(date) ORDER BY date) as same_weekday_prev,
    -- 趋势分析
    case 
        when sales_amount > lag(sales_amount) OVER (PARTITION BY category ORDER BY date) then 'UP'
        when sales_amount < lag(sales_amount) OVER (PARTITION BY category ORDER BY date) then 'DOWN'
        else 'FLAT'
    end as trend
FROM sales_data
ORDER BY category, date;

-- 分位数分析
SELECT 
    product_id,
    category,
    sales_amount,
    -- 分位数排名
    ntile(4) OVER (ORDER BY sales_amount) as quartile,
    ntile(10) OVER (PARTITION BY category ORDER BY sales_amount) as decile_in_category,
    -- 分位数值
    quantileExact(0.25)(sales_amount) OVER () as q25,
    quantileExact(0.5)(sales_amount) OVER () as median,
    quantileExact(0.75)(sales_amount) OVER () as q75
FROM sales_data
ORDER BY sales_amount;
```

## 🔧 特殊数据类型处理

### 1. 数组函数

```sql
-- 创建包含数组的示例表
CREATE TABLE user_behavior (
    user_id UInt64,
    date Date,
    visited_pages Array(String),
    session_durations Array(UInt32),
    tags Array(String),
    coordinates Tuple(Float64, Float64)
) ENGINE = MergeTree()
ORDER BY (user_id, date);

-- 插入测试数据
INSERT INTO user_behavior VALUES
    (1001, '2024-01-01', ['home', 'products', 'cart'], [30, 120, 45], ['mobile', 'new_user'], (40.7128, -74.0060)),
    (1002, '2024-01-01', ['home', 'about', 'contact'], [25, 60, 15], ['desktop', 'returning'], (34.0522, -118.2437)),
    (1003, '2024-01-02', ['products', 'cart', 'checkout'], [90, 30, 180], ['mobile', 'premium'], (41.8781, -87.6298));

-- 数组基础操作
SELECT 
    user_id,
    visited_pages,
    -- 数组长度
    length(visited_pages) as page_count,
    -- 数组元素访问
    visited_pages[1] as first_page,
    visited_pages[-1] as last_page,
    -- 数组切片
    arraySlice(visited_pages, 2, 2) as middle_pages,
    -- 数组包含检查
    has(visited_pages, 'cart') as visited_cart,
    arrayStringConcat(visited_pages, ' -> ') as user_journey
FROM user_behavior;

-- 数组聚合和计算
SELECT 
    user_id,
    session_durations,
    -- 数组聚合
    arraySum(session_durations) as total_duration,
    arrayAvg(session_durations) as avg_duration,
    arrayMax(session_durations) as max_session,
    arrayMin(session_durations) as min_session,
    -- 数组过滤
    arrayFilter(x -> x > 60, session_durations) as long_sessions,
    arrayCount(x -> x > 60, session_durations) as long_session_count,
    -- 数组映射
    arrayMap(x -> x / 60, session_durations) as duration_minutes
FROM user_behavior;

-- 数组展开（按位置配对，要求两个数组长度相同）
SELECT 
    user_id,
    date,
    page,
    duration
FROM user_behavior
ARRAY JOIN visited_pages AS page, session_durations AS duration;

-- 数组JOIN操作
SELECT 
    user_id,
    arrayJoin(arrayZip(visited_pages, session_durations)) as page_duration
FROM user_behavior;
```

### 2. 元组和映射

```sql
-- 元组操作
SELECT 
    user_id,
    coordinates,
    -- 元组元素访问
    tupleElement(coordinates, 1) as latitude,
    tupleElement(coordinates, 2) as longitude,
    coordinates.1 as lat_short,
    coordinates.2 as lng_short
FROM user_behavior;

-- 创建映射类型示例
CREATE TABLE product_metrics (
    product_id UInt32,
    date Date,
    metrics Map(String, Float64),
    attributes Map(String, String)
) ENGINE = MergeTree()
ORDER BY (product_id, date);

-- 插入映射数据
INSERT INTO product_metrics VALUES
    (101, '2024-01-01', 
     {'views': 1500, 'clicks': 150, 'conversions': 15, 'revenue': 1500.00},
     {'color': 'red', 'size': 'large', 'brand': 'BrandA'}),
    (102, '2024-01-01',
     {'views': 800, 'clicks': 80, 'conversions': 8, 'revenue': 800.00},
     {'color': 'blue', 'size': 'medium', 'brand': 'BrandB'});

-- 映射操作
SELECT 
    product_id,
    metrics,
    -- 映射值访问
    metrics['views'] as page_views,
    metrics['clicks'] as clicks,
    metrics['clicks'] / metrics['views'] as ctr,
    -- 映射键操作
    mapKeys(metrics) as metric_names,
    mapValues(metrics) as metric_values,
    -- 映射过滤
    mapFilter((k, v) -> v > 100, metrics) as high_value_metrics
FROM product_metrics;
```

### 3. JSON处理

```sql
-- 创建JSON数据表
CREATE TABLE event_logs (
    event_id UInt64,
    timestamp DateTime,
    event_data JSON,
    raw_data String
) ENGINE = MergeTree()
ORDER BY event_id;

-- 插入JSON数据
INSERT INTO event_logs VALUES
    (1, '2024-01-01 10:00:00', 
     '{"user_id": 1001, "action": "login", "device": {"type": "mobile", "os": "iOS"}, "location": {"country": "US", "city": "NYC"}}',
     '{"user_id": 1001, "action": "login", "device": {"type": "mobile", "os": "iOS"}}'),
    (2, '2024-01-01 10:05:00',
     '{"user_id": 1002, "action": "purchase", "amount": 299.99, "items": [{"id": 101, "qty": 2}, {"id": 102, "qty": 1}]}',
     '{"user_id": 1002, "action": "purchase", "amount": 299.99, "items": [{"id": 101, "qty": 2}, {"id": 102, "qty": 1}]}');

-- JSON查询操作
SELECT 
    event_id,
    timestamp,
    -- 从JSON列提取数据
    event_data.user_id as user_id,
    event_data.action as action,
    event_data.device.type as device_type,
    event_data.device.os as device_os,
    -- 从字符串JSON提取数据
    JSONExtractInt(raw_data, 'user_id') as user_id_from_string,
    JSONExtractString(raw_data, 'action') as action_from_string,
    JSONExtractFloat(raw_data, 'amount') as amount,
    -- 检查JSON键是否存在
    JSONHas(raw_data, 'amount') as has_amount,
    -- 提取JSON键
    JSONExtractKeys(raw_data) as json_keys
FROM event_logs;

-- JSON数组处理
SELECT 
    event_id,
    JSONExtractArrayRaw(raw_data, 'items') as items_array,
    arrayMap(x -> JSONExtractInt(x, 'id'), JSONExtractArrayRaw(raw_data, 'items')) as item_ids,
    arrayMap(x -> JSONExtractInt(x, 'qty'), JSONExtractArrayRaw(raw_data, 'items')) as item_quantities
FROM event_logs
WHERE JSONHas(raw_data, 'items');
```

## 📈 高级查询技巧

### 1. 子查询和CTE

```sql
-- 子查询
SELECT 
    category,
    avg_amount,
    CASE 
        WHEN avg_amount > overall_avg THEN 'Above Average'
        WHEN avg_amount < overall_avg THEN 'Below Average'
        ELSE 'Average'
    END as performance
FROM (
    SELECT 
        category,
        AVG(sales_amount) as avg_amount,
        (SELECT AVG(sales_amount) FROM sales_data) as overall_avg
    FROM sales_data
    GROUP BY category
) as category_stats;

-- Common Table Expressions (CTE)
WITH daily_sales AS (
    SELECT 
        date,
        SUM(sales_amount) as daily_total,
        COUNT(*) as daily_orders
    FROM sales_data
    GROUP BY date
),
sales_growth AS (
    SELECT 
        date,
        daily_total,
        lag(daily_total) OVER (ORDER BY date) as prev_day_total,
        daily_total - lag(daily_total) OVER (ORDER BY date) as daily_growth
    FROM daily_sales
)
SELECT 
    date,
    daily_total,
    daily_growth,
    CASE 
        WHEN daily_growth > 0 THEN 'Growth'
        WHEN daily_growth < 0 THEN 'Decline'
        ELSE 'Stable'
    END as trend
FROM sales_growth
ORDER BY date;

-- 递归CTE（递增层数的语法演示，不包含真实父子层级关系）
WITH RECURSIVE category_hierarchy AS (
    SELECT 
        category as category_name,
        category as root_category,
        1 as level
    FROM (SELECT DISTINCT category FROM sales_data)
    
    UNION ALL
    
    SELECT 
        ch.category_name,
        ch.root_category,
        ch.level + 1
    FROM category_hierarchy ch
    WHERE ch.level < 3  -- 防止无限递归
)
SELECT * FROM category_hierarchy;
```

### 2. UNION和集合操作

```sql
-- UNION操作
SELECT 'Q1' as quarter, SUM(sales_amount) as revenue
FROM sales_data 
WHERE toQuarter(date) = 1

UNION ALL

SELECT 'Q2' as quarter, SUM(sales_amount) as revenue  
FROM sales_data
WHERE toQuarter(date) = 2

ORDER BY quarter;

-- 数据透视
SELECT 
    category,
    SUM(CASE WHEN region = 'North' THEN sales_amount ELSE 0 END) as North,
    SUM(CASE WHEN region = 'South' THEN sales_amount ELSE 0 END) as South,
    SUM(CASE WHEN region = 'East' THEN sales_amount ELSE 0 END) as East,
    SUM(CASE WHEN region = 'West' THEN sales_amount ELSE 0 END) as West
FROM sales_data
GROUP BY category;

-- 条件聚合
SELECT 
    date,
    countIf(category = 'Electronics') as electronics_orders,
    countIf(category = 'Clothing') as clothing_orders,
    sumIf(sales_amount, sales_amount > 100) as high_value_sales,
    avgIf(sales_amount, quantity > 1) as avg_multi_item_sale
FROM sales_data
GROUP BY date
ORDER BY date;
```

### 3. 采样和估算

```sql
-- 数据采样
SELECT *
FROM sales_data
SAMPLE 0.5;  -- 需表引擎及SAMPLE BY采样键支持，选取约50%的采样范围

-- 按近似目标行数采样（需采样键支持）
SELECT *
FROM sales_data
SAMPLE 1000;  -- 目标约1000行，不保证实际返回恰好1000行

-- 对采样结果按类别聚合（需采样键支持，不等同于按类别分层抽样）
SELECT 
    category,
    COUNT(*) as sampled_count,
    AVG(sales_amount) as avg_amount
FROM sales_data
SAMPLE 0.3
GROUP BY category;

-- 近似计算
SELECT 
    uniqExact(customer_id) as exact_unique_customers,
    uniqHLL12(customer_id) as approx_unique_customers,
    uniqCombined(customer_id) as combined_unique_customers,
    quantilesTiming(0.5, 0.95, 0.99)(toUInt32(sales_amount)) as integer_sale_amount_percentiles
FROM sales_data;
```

## 🎯 查询性能优化

### 1. 索引利用

```sql
-- 查看查询执行计划
EXPLAIN PLAN 
SELECT *
FROM sales_data
WHERE date >= '2024-01-01' 
  AND category = 'Electronics'
ORDER BY sales_amount DESC;

-- 查看索引使用情况
EXPLAIN indexes = 1
SELECT COUNT(*)
FROM sales_data
WHERE product_id IN (101, 102, 103);

-- 检查查询是否满足主键索引使用条件；不满足时抛错，并非强制选择索引
SELECT *
FROM sales_data
WHERE date = '2024-01-01'
SETTINGS force_primary_key = 1;
```

### 2. 查询优化技巧

```sql
-- 使用PREWHERE先读取过滤列，可能减少后续列的读取量，效果需实测
SELECT product_id, sales_amount
FROM sales_data
PREWHERE date >= '2024-01-01'  -- 先读取date列并过滤
WHERE category = 'Electronics'; -- 再对通过PREWHERE的数据应用此条件

-- 列式查询优化
-- 避免SELECT *，只选择需要的列
SELECT product_id, sales_amount  -- 好的做法
FROM sales_data
WHERE date >= '2024-01-01';

-- 聚合查询优化
SELECT 
    category,
    COUNT(*) as cnt,
    SUM(sales_amount) as total
FROM sales_data
WHERE date >= '2024-01-01'
GROUP BY category
ORDER BY total DESC
LIMIT 10;

-- 使用物化视图预计算
CREATE MATERIALIZED VIEW daily_category_stats
ENGINE = SummingMergeTree()
ORDER BY (date, category)
AS SELECT 
    date,
    category,
    COUNT(*) as order_count,
    SUM(sales_amount) as total_sales,
    SUM(quantity) as total_quantity
FROM sales_data
GROUP BY date, category;
```

## 🔧 实用函数集合

### 1. 时间函数

```sql
-- 时间处理函数
SELECT 
    date,
    -- 时间提取
    toYear(date) as year,
    toMonth(date) as month,
    toDayOfMonth(date) as day,
    toDayOfWeek(date) as weekday,
    toQuarter(date) as quarter,
    -- 时间格式化
    formatDateTime(date, '%Y-%m-%d') as formatted_date,
    -- 时间计算
    addDays(date, 7) as next_week,
    subtractDays(date, 30) as last_month,
    dateDiff('day', date, today()) as days_ago,
    -- 时间截断
    toStartOfMonth(date) as month_start,
    toLastDayOfMonth(date) as month_end,
    toMonday(date) as week_start
FROM sales_data;
```

### 2. 字符串函数

```sql
-- 字符串处理
SELECT 
    category,
    -- 基础字符串操作
    length(category) as category_length,
    upper(category) as uppercase,
    lower(category) as lowercase,
    reverse(category) as reversed,
    -- 字符串截取
    substring(category, 1, 4) as first_4_chars,
    left(category, 3) as left_3,
    right(category, 3) as right_3,
    -- 字符串替换
    replace(category, 'ing', 'ING') as replaced,
    -- 字符串分割
    splitByChar('n', category) as split_parts,
    -- 正则表达式
    match(category, '.*ing$') as ends_with_ing,
    extract(category, '([A-Z][a-z]+)') as extracted_word
FROM sales_data;
```

### 3. 数学函数

```sql
-- 数学计算函数
SELECT 
    sales_amount,
    quantity,
    -- 基础数学
    round(sales_amount, 1) as rounded,
    ceil(sales_amount) as ceiling,
    floor(sales_amount) as floored,
    abs(sales_amount - 100) as absolute_diff,
    -- 对数和指数
    log(sales_amount) as natural_log,
    log10(sales_amount) as log_base_10,
    exp(sales_amount / 1000) as exponential,
    -- 三角函数
    sin(sales_amount / 100) as sine,
    cos(sales_amount / 100) as cosine,
    -- 统计函数
    power(sales_amount, 0.5) as square_root,
    greatest(sales_amount, quantity * 10) as max_value,
    least(sales_amount, 1000) as min_value
FROM sales_data;
```

## 🎯 SQL语法学习重点

通过本章节的学习，我们掌握了：

1. **基础查询语法** - SELECT、WHERE、ORDER BY、LIMIT等标准SQL操作
2. **聚合函数应用** - COUNT、SUM、AVG及ClickHouse特有的聚合函数
3. **窗口函数掌握** - 排名、偏移、累计等高级分析功能
4. **复杂数据类型** - 数组、JSON、元组、映射的查询操作
5. **高级查询技巧** - 子查询、CTE、UNION、采样等

> [!abstract] 📚 下一步学习
> 现在你已经掌握了ClickHouse SQL语法的核心功能，接下来我们将学习[[【技术与工具】/ClickHouse/06-ClickHouse数据导入导出|ClickHouse数据导入导出]]，了解如何高效地将数据导入ClickHouse并导出分析结果。

## 🔗 相关资源

- [[【技术与工具】/ClickHouse/04-ClickHouse数据类型与表引擎|ClickHouse数据类型与表引擎]] - 数据建模基础
- [[【技术与工具】/ClickHouse/00-ClickHouse学习路线图|ClickHouse]] - 返回学习路线图
- [[【技术与工具】/PostgreSQL/00-PostgreSQL学习路线图|PostgreSQL]] - SQL基础语法参考

---

> 💡 **记住**：**ClickHouse的SQL语法是其强大分析能力的基础**。掌握这些语法不仅能让你高效查询数据，**更能帮你充分发挥ClickHouse在数据分析方面的优势**。多练习复杂查询，培养数据分析思维，这将是你最宝贵的技能！