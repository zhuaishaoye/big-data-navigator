---
title: ClickHouse数据类型与表引擎
tags:
  - ClickHouse
  - 数据类型
  - 表引擎
  - MergeTree
  - 数据建模
difficulty: 中级
duration: 40分钟
description: 掌握ClickHouse丰富的数据类型系统和多样化的表引擎，学会设计高效的数据模型和存储结构。
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据分析师
  - BI分析师
stability: slow-changing
status: maintenance
access_tier: free
updated: 2026-10-10
---


# 🗂️ ClickHouse数据类型与表引擎

## 📚 学习目标

通过本章节的学习，你将能够：
- **掌握ClickHouse的数据类型体系**和使用场景
- **理解各种表引擎的特点**和适用场景
- **学会设计高效的表结构**和分区策略
- **掌握数据建模的最佳实践**
- **理解存储优化和性能调优**技巧

> [!tip] 💡 学习建议
> 数据类型和表引擎是ClickHouse的核心概念，**就像建房子需要选择合适的材料和结构一样**。**重点理解每种类型和引擎的适用场景**，而不是记忆所有细节。通过实际例子来加深理解。

## 📊 数据类型系统

### 1. 数值类型

王医生带着大家来到医院的电子病历设计中心："要建立高效的智能病历系统，我们首先要了解患者数据的不同类型，就像ClickHouse需要为不同的数据选择合适的数据类型一样。"

"你们看，"他指向病历系统的数据分类图表，"患者的年龄、体重、血压等数值信息，需要用不同精度的数字格式来存储。年龄用小整数就够了，但是精密的血液检查数据就需要高精度的小数类型。"

"我来给大家演示一下我们医院的数值数据分类标准，"王医生打开病历系统界面。

"就像我们给不同的检查项目选择不同精度的测量仪器，"他一边演示一边解释：

**专业技术对应**：
```sql
-- 医疗数值数据分类系统 (ClickHouse数值类型)
CREATE TABLE patient_vital_signs (
    -- 基础生命体征 (小范围整数)
    age Int8,             -- 年龄: -128 to 127 (足够用)
    heart_rate UInt16,    -- 心率: 0 to 65,535 (每分钟心跳数)
    patient_id UInt32,    -- 患者ID: 0 to 4,294,967,295
    record_id UInt64,     -- 病历记录ID: 超大范围
    
    -- 精密检查数据 (浮点数)
    body_temp Float32,    -- 体温: 单精度足够
    blood_pressure_sys Float64,  -- 收缩压: 高精度测量
    
    -- 财务相关数据 (高精度小数)
    medication_cost Decimal(10, 2),      -- 药费: 10位数字，2位小数
    lab_test_result Decimal128(6)        -- 精密检验结果: 128位定点数，小数位数为6
) ENGINE = MergeTree()
ORDER BY patient_id;

-- 插入示例数据
INSERT INTO patient_vital_signs VALUES 
    (25, 72, 10001, 1000000001, 36.5, 120.5, 50.00, 7.85),
    (45, 88, 10002, 1000000002, 37.2, 135.8, 75.50, 6.42),
    (67, 65, 10003, 1000000003, 36.8, 140.2, 120.00, 8.91);

-- 查看数据
SELECT * FROM patient_vital_signs;

-- 数值计算示例
SELECT 
    patient_id,
    age,
    heart_rate,
    body_temp,
    blood_pressure_sys,
    medication_cost + CAST('10.50' AS Decimal(10, 2)) as adjusted_cost,
    round(lab_test_result, 2) as rounded_result
FROM patient_vital_signs;
```

### 2. 字符串类型

王医生走向病历系统的文本数据区域："除了数字，患者信息中还有大量的文本数据需要处理，比如姓名、症状描述、诊断结果等。我们需要为不同类型的文本选择最合适的存储方式。"

"你们看，"他指着不同的数据字段，"患者姓名长短不一，用变长字符串；科室代码长度固定，用定长字符串节省空间；病情状态就那几种，用枚举类型效率更高。"

**专业技术对应**：
```sql
-- 医疗文本数据分类系统 (ClickHouse字符串类型)
CREATE TABLE patient_records (
    patient_id UInt32,
    -- 基本患者信息 (变长文本)
    patient_name String,                    -- 患者姓名: 变长字符串
    id_number FixedString(18),              -- 身份证号: 固定18位
    
    -- 分类信息 (优化存储)
    department LowCardinality(String),      -- 科室: 低基数字符串(重复值多)
    visit_status Enum8('registered' = 1, 'examining' = 2, 'completed' = 3), -- 就诊状态
    
    -- 唯一标识符
    medical_record_uuid UUID                -- 病历唯一ID
) ENGINE = MergeTree()
ORDER BY patient_id;

-- 插入数据
INSERT INTO patient_records VALUES 
    (10001, '张三', '110101199001011234', '心内科', 'registered', generateUUIDv4()),
    (10002, '李四', '110101199502152345', '心内科', 'examining', generateUUIDv4()),
    (10003, '王五', '110101198805203456', '神经科', 'completed', generateUUIDv4());

-- 字符串函数演示
SELECT 
    patient_id,
    patient_name,
    lengthUTF8(patient_name) as name_length,
    upper(patient_name) as upper_name,
    substring(id_number, 1, 6) as birth_area,
    department,
    visit_status,
    toString(medical_record_uuid) as uuid_string
FROM patient_records;

-- LowCardinality的优势
SELECT 
    department,
    count() as patient_count,
    uniq(department) as unique_departments
FROM patient_records
GROUP BY department;
```

### 3. 日期和时间类型

```sql
-- 时间类型演示
CREATE TABLE datetime_demo (
    id UInt32,
    
    -- 日期类型
    event_date Date,                    -- 日期（年-月-日）
    event_date32 Date32,                -- 支持更大范围的日期
    
    -- 时间类型  
    event_datetime DateTime,            -- 日期时间（秒精度）
    event_datetime64 DateTime64(3),     -- 高精度日期时间（毫秒精度）
    event_datetime_tz DateTime('Asia/Shanghai'), -- 带时区的日期时间
    
    -- 时间间隔
    duration UInt32                    -- 持久化时长，单位为秒；Interval用于时间运算表达式
) ENGINE = MergeTree()
ORDER BY id;

-- 插入时间数据
INSERT INTO datetime_demo VALUES 
    (1, '2024-01-01', '2024-01-01', 
     '2024-01-01 10:30:00', '2024-01-01 10:30:00.123',
     '2024-01-01 10:30:00', 3600),
    (2, today(), today(),
     now(), now64(3),
     now('Asia/Shanghai'), 7200);

-- 时间函数演示
SELECT 
    id,
    event_date,
    toYYYYMM(event_date) as year_month,
    toDayOfWeek(event_date) as day_of_week,
    formatDateTime(event_datetime, '%Y-%m-%d %H:%i:%s') as formatted_datetime,
    event_datetime64,
    toUnixTimestamp(event_datetime) as unix_timestamp,
    addDays(event_date, 7) as next_week,
    dateDiff('day', event_date, today()) as days_ago
FROM datetime_demo;
```

### 4. 复合数据类型

```sql
-- 复合类型演示
CREATE TABLE composite_demo (
    id UInt32,
    
    -- 数组类型
    tags Array(String),              -- 字符串数组
    scores Array(Float64),           -- 数值数组
    nested_array Array(Array(UInt32)), -- 嵌套数组
    
    -- 元组类型
    coordinates Tuple(Float64, Float64), -- 经纬度坐标
    user_info Tuple(name String, age UInt8, active Bool), -- 复杂元组
    
    -- 映射类型
    properties Map(String, String),   -- 键值对映射
    metrics Map(String, Float64),     -- 数值映射
    
    -- 可空类型
    optional_field Nullable(String), -- 可为NULL的字符串
    
    -- JSON类型（较新版本）
    json_data JSON                   -- JSON数据
) ENGINE = MergeTree()
ORDER BY id;

-- 插入复合数据
INSERT INTO composite_demo VALUES 
    (1, 
     ['tag1', 'tag2', 'tag3'],       -- 数组
     [95.5, 87.2, 92.0],            -- 数值数组
     [[1, 2], [3, 4, 5]],           -- 嵌套数组
     (116.4074, 39.9042),           -- 北京坐标
     ('Alice', 25, true),           -- 用户信息元组
     {'color': 'red', 'size': 'large'}, -- 属性映射
     {'score': 95.5, 'rating': 4.8},    -- 指标映射
     'optional value',               -- 可空字段
     '{"name": "test", "value": 123}'    -- JSON数据
    );

-- 复合类型查询
SELECT 
    id,
    tags,
    arrayJoin(tags) as individual_tag,  -- 数组展开
    scores[1] as first_score,           -- 数组元素访问
    tupleElement(coordinates, 1) as longitude, -- 元组元素访问
    tupleElement(coordinates, 2) as latitude,
    user_info.name as user_name,        -- 元组字段访问
    user_info.age as user_age,
    properties['color'] as color,       -- 映射值访问
    metrics['score'] as score_metric,
    isNull(optional_field) as is_null,
    json_data.name.:String as json_name
FROM composite_demo;

-- 数组函数演示
SELECT 
    id,
    length(tags) as tag_count,
    arrayFilter(x -> x > 90, scores) as high_scores,
    arraySum(scores) as total_score,
    arrayAvg(scores) as avg_score,
    has(tags, 'tag1') as has_tag1,
    arrayStringConcat(tags, ', ') as tags_concat
FROM composite_demo;
```

## 🏗️ 表引擎详解

### 1. MergeTree引擎族

王医生来到医院的科室规划部："现在我们来讨论医院最重要的组织结构——各个专科科室的设置。这就像ClickHouse的表引擎，不同的科室有不同的专业特长和运作方式。"

"我们先从最基础、最通用的综合内科开始，"他指向科室分布图，"这就像ClickHouse的MergeTree引擎，是处理大部分医疗数据的标准选择。"

#### 基础MergeTree引擎（综合内科模式）

"综合内科是我们医院的核心科室，"王医生详细介绍道，"它按照患者病情的时间顺序和严重程度来安排治疗，定期整合病历资料，确保诊疗的连续性和高效性。"

```sql
-- 标准MergeTree表
CREATE TABLE events_basic (
    date Date,
    user_id UInt64,
    event_type String,
    event_time DateTime,
    properties String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)         -- 按月分区
ORDER BY (user_id, event_time)     -- 排序键
PRIMARY KEY user_id                 -- 主键（稀疏索引）
SETTINGS index_granularity = 8192; -- 索引粒度

-- 查看表结构
DESCRIBE events_basic;

-- 插入测试数据
INSERT INTO events_basic VALUES 
    ('2024-01-01', 1001, 'page_view', '2024-01-01 10:00:00', '{}'),
    ('2024-01-01', 1002, 'click', '2024-01-01 10:05:00', '{}'),
    ('2024-01-02', 1001, 'purchase', '2024-01-02 15:30:00', '{}');

-- 查看分区信息
SELECT 
    partition,
    name,
    rows,
    bytes_on_disk,
    modification_time
FROM system.parts 
WHERE table = 'events_basic' AND active = 1;
```

#### ReplacingMergeTree引擎（档案更新科模式）

"接下来是我们的档案更新科，"王医生指向另一个科室，"这个科室专门负责患者信息的更新和去重工作。当同一个患者有多次就诊记录时，我们需要保留最新、最准确的信息。"

"就像某个患者多次更换联系方式，我们的系统会自动保留最新版本的联系信息，避免重复和混乱。"

**专业技术对应**：
```sql
-- 患者档案更新系统 (ReplacingMergeTree引擎)
CREATE TABLE patient_profiles (
    patient_id UInt64,
    name String,
    phone String,
    last_visit DateTime,
    version UInt64,
    updated_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(version)  -- 使用版本号自动去重
PARTITION BY patient_id % 16  -- 教学用固定桶，确保同一患者的各版本位于同一分区
ORDER BY patient_id;

-- 插入重复数据测试去重
INSERT INTO patient_profiles VALUES 
    (10001, '张三', '13800138000', '2024-01-01 10:00:00', 1, '2024-01-01 10:00:00'),
    (10002, '李四', '13900139000', '2024-01-01 11:00:00', 1, '2024-01-01 11:00:00');

-- 更新患者信息（插入新版本）
INSERT INTO patient_profiles VALUES 
    (10001, '张三丰', '13800138001', '2024-01-02 10:00:00', 2, '2024-01-02 10:00:00');

-- 查询结果（可能看到重复数据，需要手动优化或等待后台合并）
SELECT * FROM patient_profiles ORDER BY patient_id, version;

-- 教学环境中手动触发分区内合并；生产环境慎用，可能产生较高I/O开销
OPTIMIZE TABLE patient_profiles FINAL;

-- 使用FINAL按排序键和版本号在查询时去重；这不等于后台已完成物理去重
SELECT * FROM patient_profiles FINAL ORDER BY patient_id;
```

#### SummingMergeTree引擎

```sql
-- 自动聚合数值列的表引擎
CREATE TABLE daily_stats (
    date Date,
    user_id UInt64,
    page_views UInt64,
    clicks UInt64,
    purchases UInt64
) ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, user_id);

-- 插入统计数据
INSERT INTO daily_stats VALUES 
    ('2024-01-01', 1001, 10, 2, 1),
    ('2024-01-01', 1001, 5, 1, 0),    -- 同一用户的额外数据
    ('2024-01-01', 1002, 8, 3, 2);

-- 查看原始数据
SELECT * FROM daily_stats ORDER BY date, user_id;

-- 手动触发合并
OPTIMIZE TABLE daily_stats;

-- 查看聚合后的结果
SELECT 
    date,
    user_id,
    sum(page_views) as total_page_views,
    sum(clicks) as total_clicks,
    sum(purchases) as total_purchases
FROM daily_stats 
GROUP BY date, user_id
ORDER BY date, user_id;
```

#### AggregatingMergeTree引擎

```sql
-- 支持复杂聚合状态的表引擎
CREATE TABLE user_metrics_agg (
    date Date,
    user_segment String,
    total_users AggregateFunction(uniq, UInt64),
    total_revenue AggregateFunction(sum, Decimal(10,2)),
    avg_session_duration AggregateFunction(avg, UInt32)
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, user_segment);

-- 插入聚合状态数据
INSERT INTO user_metrics_agg 
SELECT 
    date,
    user_segment,
    uniqState(toUInt64(user_id)) as total_users,
    sumState(CAST(revenue AS Decimal(10, 2))) as total_revenue,
    avgState(toUInt32(session_duration)) as avg_session_duration
FROM (
    SELECT 
        '2024-01-01' as date,
        'premium' as user_segment,
        1001 as user_id,
        100.50 as revenue,
        1800 as session_duration
    UNION ALL
    SELECT '2024-01-01', 'premium', 1002, 200.75, 2100
    UNION ALL
    SELECT '2024-01-01', 'basic', 1003, 50.25, 900
) as raw_data
GROUP BY date, user_segment;

-- 查询最终聚合结果
SELECT 
    date,
    user_segment,
    uniqMerge(total_users) as unique_users,
    sumMerge(total_revenue) as total_revenue,
    avgMerge(avg_session_duration) as avg_duration
FROM user_metrics_agg
GROUP BY date, user_segment
ORDER BY date, user_segment;
```

### 2. 特殊用途引擎

#### Memory引擎

```sql
-- 内存表引擎（数据存储在内存中）
CREATE TABLE temp_calculations (
    id UInt32,
    calculation_result Float64,
    timestamp DateTime DEFAULT now()
) ENGINE = Memory;

-- 适用于临时计算、缓存等场景
INSERT INTO temp_calculations (id, calculation_result) VALUES 
    (1, 3.14159), (2, 2.71828), (3, 1.41421);

SELECT * FROM temp_calculations;
```

#### URL引擎

```sql
-- 直接查询外部URL数据
CREATE TABLE web_data (
    id UInt32,
    name String,
    value Float64
) ENGINE = URL('https://raw.githubusercontent.com/example/data.csv', 'CSV');

-- 查询远程数据（示例，实际URL需要存在）
-- SELECT * FROM web_data LIMIT 5;
```

#### File引擎

```sql
-- 直接读取本地文件
CREATE TABLE file_data (
    id UInt32,
    name String,
    value Float64
) ENGINE = File(CSV, 'data.csv');

-- 需要先在服务器配置的user_files_path目录下创建data.csv，并确保ClickHouse具有读取权限
-- SELECT * FROM file_data;
```

### 3. 分布式表引擎

```sql
-- 分布式表引擎（将在集群章节详细介绍）
CREATE TABLE events_distributed AS events_basic
ENGINE = Distributed(cluster_name, database_name, events_basic, rand());

-- 查看分布式表信息
SELECT 
    engine,
    engine_full,
    data_paths
FROM system.tables 
WHERE name = 'events_distributed';
```

## 🎯 数据建模最佳实践

### 1. 表结构设计原则

```sql
-- 优化的表设计示例
CREATE TABLE user_behavior_optimized (
    -- 1. 时间字段用于分区；列的声明顺序不决定分区效果
    date Date,
    hour UInt8,
    
    -- 2. 示例按用户与会话排序；排序键顺序应依据常用过滤条件和数据分布选择
    user_id UInt64,
    session_id String,
    
    -- 3. 低基数字段使用LowCardinality
    event_type LowCardinality(String),
    page_category LowCardinality(String),
    device_type LowCardinality(String),
    
    -- 4. 数值字段选择合适的类型
    duration UInt32,              -- 秒数，UInt32足够
    page_depth UInt8,             -- 页面深度，UInt8足够
    
    -- 5. 可选字段使用Nullable
    referrer Nullable(String),
    
    -- 6. 复杂数据使用JSON
    custom_properties JSON,
    
    -- 7. 时间戳字段
    created_at DateTime64(3) DEFAULT now64(3)
    
) ENGINE = MergeTree()
PARTITION BY (toYYYYMM(date), hour % 4)  -- 细粒度分区
ORDER BY (user_id, session_id, date, hour) -- 优化常用查询
SETTINGS 
    index_granularity = 8192,
    ttl_only_drop_parts = 1;

-- 添加TTL（生存时间）
ALTER TABLE user_behavior_optimized 
MODIFY TTL date + INTERVAL 90 DAY;

-- 添加二级索引
ALTER TABLE user_behavior_optimized 
ADD INDEX idx_event_type event_type TYPE set(100) GRANULARITY 1;

ALTER TABLE user_behavior_optimized 
ADD INDEX idx_duration duration TYPE minmax GRANULARITY 1;
```

### 2. 分区策略设计

```sql
-- 不同分区策略的对比

-- 策略1：按天分区（适合按日管理数据的需求，须控制分区和数据片段数量）
CREATE TABLE events_daily_partition (
    date Date,
    user_id UInt64,
    event_type String
) ENGINE = MergeTree()
PARTITION BY date
ORDER BY user_id;

-- 策略2：按月分区（常用策略）
CREATE TABLE events_monthly_partition (
    date Date,
    user_id UInt64,
    event_type String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY user_id;

-- 策略3：组合分区（用于按月份与区域管理数据，须评估组合基数，不能仅按数据量选择）
CREATE TABLE events_combined_partition (
    date Date,
    user_id UInt64,
    event_type LowCardinality(String),
    region LowCardinality(String)
) ENGINE = MergeTree()
PARTITION BY (toYYYYMM(date), region)
ORDER BY (user_id, date);

-- 查看分区效果
SELECT 
    table,
    partition,
    rows,
    formatReadableSize(bytes_on_disk) as size
FROM system.parts 
WHERE table LIKE 'events_%_partition' AND active = 1
ORDER BY table, partition;
```

### 3. 索引设计策略

```sql
-- 索引优化示例表
CREATE TABLE products_with_indexes (
    id UInt64,
    name String,
    category LowCardinality(String),
    price Decimal(10,2),
    tags Array(String),
    description String,
    created_at DateTime
) ENGINE = MergeTree()
ORDER BY id;

-- 添加不同类型的索引
-- 1. minmax索引 - 适合范围查询
ALTER TABLE products_with_indexes 
ADD INDEX idx_price price TYPE minmax GRANULARITY 1;

-- 2. set索引 - 适合枚举值查询
ALTER TABLE products_with_indexes 
ADD INDEX idx_category category TYPE set(100) GRANULARITY 1;

-- 3. bloom_filter索引 - 可用于受支持的等值、IN等谓词，不等同于任意子串包含索引
ALTER TABLE products_with_indexes 
ADD INDEX idx_description description TYPE bloom_filter GRANULARITY 1;

-- 4. ngrambf_v1索引 - 适合模糊匹配
ALTER TABLE products_with_indexes 
ADD INDEX idx_name name TYPE ngrambf_v1(3, 512, 3, 0) GRANULARITY 1;

-- 5. tokenbf_v1索引 - 适合分词搜索
ALTER TABLE products_with_indexes 
ADD INDEX idx_tags tags TYPE tokenbf_v1(512, 3, 0) GRANULARITY 1;

-- 插入测试数据
INSERT INTO products_with_indexes VALUES 
    (1, 'iPhone 15 Pro', 'Electronics', 999.99, ['smartphone', 'apple'], 'Latest iPhone with advanced features', now()),
    (2, 'MacBook Air', 'Electronics', 1299.99, ['laptop', 'apple'], 'Lightweight laptop for professionals', now()),
    (3, 'Nike Air Max', 'Fashion', 129.99, ['shoes', 'nike'], 'Comfortable running shoes', now());

-- 测试索引效果
EXPLAIN indexes = 1
SELECT * FROM products_with_indexes 
WHERE price BETWEEN 100 AND 1000
  AND category = 'Electronics'
  AND hasAny(tags, ['apple']);
```

## 🔧 存储优化技巧

### 1. 压缩策略

```sql
-- 自定义压缩策略
CREATE TABLE events_compressed (
    date Date CODEC(Delta, LZ4),           -- 日期使用Delta+LZ4
    user_id UInt64 CODEC(Delta, ZSTD),     -- 整数使用Delta+ZSTD
    event_type LowCardinality(String) CODEC(ZSTD), -- 字符串使用ZSTD
    properties String CODEC(ZSTD(3)),      -- JSON使用ZSTD级别3
    timestamp DateTime64(3) CODEC(Delta, LZ4), -- 时间戳使用Delta+LZ4
    metrics Array(Float64) CODEC(Gorilla, ZSTD) -- 浮点数组使用Gorilla后再压缩，效果需实测
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (user_id, timestamp);

-- 查看压缩效果
SELECT 
    name AS column_name,
    type,
    data_compressed_bytes,
    data_uncompressed_bytes,
    round(data_uncompressed_bytes / nullIf(data_compressed_bytes, 0), 2) as compression_ratio,
    formatReadableSize(data_compressed_bytes) as compressed_size,
    formatReadableSize(data_uncompressed_bytes) as uncompressed_size
FROM system.columns 
WHERE table = 'events_compressed'
ORDER BY compression_ratio DESC;
```

### 2. 物化视图优化

```sql
-- 原始事件表
CREATE TABLE raw_events (
    timestamp DateTime64(3),
    user_id UInt64,
    event_type LowCardinality(String),
    page_url String,
    session_duration UInt32
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (user_id, timestamp);

-- 预聚合物化视图
CREATE MATERIALIZED VIEW hourly_user_stats
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (hour, user_id)
AS SELECT 
    toStartOfHour(timestamp) as hour,
    user_id,
    countState() as event_count,
    uniqState(page_url) as unique_pages,
    sumState(session_duration) as total_duration
FROM raw_events
GROUP BY hour, user_id;

-- 测试物化视图
INSERT INTO raw_events VALUES 
    ('2024-01-01 10:15:30', 1001, 'page_view', '/home', 120),
    ('2024-01-01 10:25:30', 1001, 'click', '/products', 60),
    ('2024-01-01 10:35:30', 1002, 'page_view', '/about', 90);

-- 查询聚合结果
SELECT
    hour,
    user_id,
    countMerge(event_count) AS event_count,
    uniqMerge(unique_pages) AS unique_pages,
    sumMerge(total_duration) AS total_duration
FROM hourly_user_stats
GROUP BY hour, user_id
ORDER BY hour, user_id;
```

## 🎯 数据建模实战案例

### 1. 电商用户行为分析表

```sql
-- 电商用户行为完整表设计
CREATE TABLE ecommerce_events (
    -- 时间维度
    event_date Date,
    event_hour UInt8,
    event_timestamp DateTime64(3),
    
    -- 用户维度
    user_id UInt64,
    session_id String,
    user_type LowCardinality(String),  -- 'new', 'returning', 'vip'
    
    -- 事件维度
    event_type LowCardinality(String), -- 'page_view', 'click', 'add_cart', 'purchase'
    event_category LowCardinality(String),
    
    -- 产品维度
    product_id Nullable(UInt64),
    product_category LowCardinality(Nullable(String)),
    product_price Nullable(Decimal(10,2)),
    
    -- 技术维度
    device_type LowCardinality(String), -- 'mobile', 'desktop', 'tablet'
    browser LowCardinality(String),
    os LowCardinality(String),
    
    -- 地理维度
    country LowCardinality(String),
    city LowCardinality(String),
    
    -- 业务指标
    page_load_time Nullable(UInt32),   -- 毫秒
    session_duration UInt32,            -- 秒
    revenue Nullable(Decimal(10,2)),
    
    -- 扩展信息
    utm_source LowCardinality(Nullable(String)),
    utm_medium LowCardinality(Nullable(String)),
    custom_attributes Map(String, String)
    
) ENGINE = MergeTree()
PARTITION BY (toYYYYMM(event_date), event_hour % 6)  -- 每月6个小时余数桶，并非连续4小时分区
ORDER BY (user_id, session_id, event_timestamp)
SETTINGS 
    index_granularity = 8192,
    ttl_only_drop_parts = 1;

-- 添加TTL - 6个月后删除详细数据
ALTER TABLE ecommerce_events 
MODIFY TTL event_date + INTERVAL 6 MONTH;

-- 添加二级索引
ALTER TABLE ecommerce_events ADD INDEX idx_event_type event_type TYPE set(20) GRANULARITY 1;
ALTER TABLE ecommerce_events ADD INDEX idx_product_category product_category TYPE set(100) GRANULARITY 1;
ALTER TABLE ecommerce_events ADD INDEX idx_device_type device_type TYPE set(10) GRANULARITY 1;
ALTER TABLE ecommerce_events ADD INDEX idx_revenue revenue TYPE minmax GRANULARITY 1;
```

### 2. 配套的聚合表

```sql
-- 每日汇总表
CREATE TABLE daily_user_summary (
    summary_date Date,
    user_id UInt64,
    total_events UInt32,
    unique_sessions UInt16,
    total_revenue Decimal(12,2),
    first_event_time DateTime,
    last_event_time DateTime,
    device_types Array(String),
    visited_categories Array(String)
) ENGINE = ReplacingMergeTree(last_event_time)
PARTITION BY toYYYYMM(summary_date)
ORDER BY (summary_date, user_id);

-- 每小时实时汇总物化视图
CREATE MATERIALIZED VIEW hourly_realtime_stats
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(event_hour_start)
ORDER BY (event_hour_start, event_type, device_type)
AS SELECT 
    toStartOfHour(event_timestamp) as event_hour_start,
    event_type,
    device_type,
    countState() as event_count,
    uniqState(user_id) as unique_users,
    sumState(ifNull(revenue, CAST(0 AS Decimal(10, 2)))) as total_revenue,
    avgState(session_duration) as avg_session_duration
FROM ecommerce_events
GROUP BY event_hour_start, event_type, device_type;

-- 查询该视图时按event_hour_start、event_type、device_type分组，
-- 分别使用countMerge(event_count)、uniqMerge(unique_users)、
-- sumMerge(total_revenue)、avgMerge(avg_session_duration)合并状态；不能直接读取状态作为结果。
```

## 🎯 学习重点总结

通过本章节的学习，我们掌握了：

1. **数据类型系统** - 数值、字符串、时间、复合类型的使用
2. **表引擎选择** - MergeTree族、特殊引擎的适用场景
3. **表结构设计** - 分区、排序、索引的最佳实践
4. **存储优化** - 压缩策略、物化视图、TTL管理
5. **实战建模** - 电商场景的完整数据建模案例

> [!abstract] 📚 下一步学习
> 现在你已经掌握了ClickHouse的数据建模技能，接下来我们将学习[[【技术与工具】/ClickHouse/05-ClickHouse SQL语法基础|ClickHouse SQL语法]]，学习如何高效地查询和分析数据。

## 🔗 相关资源

- [[【技术与工具】/ClickHouse/03-ClickHouse环境搭建|ClickHouse环境搭建]] - 环境准备
- [[【技术与工具】/ClickHouse/00-ClickHouse学习路线图|ClickHouse]] - 返回学习路线图
- [[【技术与工具】/PostgreSQL/00-PostgreSQL学习路线图|PostgreSQL]] - 通用数据类型概念

---

> 💡 **记住**：**好的数据模型是高性能查询的基础**。选择合适的数据类型和表引擎，**可以大大提升查询性能和存储效率**。在设计时要考虑业务查询模式，**优化最常用的查询路径**。实践是掌握这些概念的最好方法！