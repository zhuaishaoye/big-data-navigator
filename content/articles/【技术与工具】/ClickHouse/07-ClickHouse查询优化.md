---
title: ClickHouse查询优化
tags:
  - ClickHouse
  - 查询优化
  - 性能调优
  - 索引策略
  - 执行计划
difficulty: 高级
duration: 55分钟
description: 深入掌握ClickHouse查询优化技巧，包括索引设计、执行计划分析、内存管理和存储优化等高级性能调优方法。
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据分析师
  - BI分析师
  - 数据科学家
stability: slow-changing
status: maintenance
access_tier: free
updated: 2026-10-10
---


# ⚡ ClickHouse查询优化

## 📚 学习目标

通过本章节的学习，你将能够：
- **掌握查询性能分析方法**，识别性能瓶颈
- **理解和设计各种索引策略**，提升查询效率
- **学会执行计划分析**，优化查询逻辑
- **掌握内存和存储优化**技巧
- **建立系统的性能调优方法论**

> [!tip] 💡 学习建议
> 查询优化是ClickHouse使用的高级技能，**就像调优汽车引擎一样需要系统性方法**。**先学会诊断问题，再掌握优化技巧**。重点理解ClickHouse的工作原理，这样才能做出正确的优化决策。

## 🔍 性能诊断基础

### 1. 查询性能诊断（诊疗效率分析体系）

王医生来到医院的诊断效率提升研究中心："作为一名经验丰富的主治医生，我发现诊断效率的提升需要科学的方法和工具，这与ClickHouse的查询优化有着惊人的相似性。"

"你们知道吗，"他指着墙上的诊疗流程图，"一个优秀的医生不仅要会看病，更要会分析为什么有些诊断快、有些诊断慢。就像我们在ICU监护室一样，需要持续监控患者的各项生命体征，ClickHouse查询优化也需要建立完整的性能监控体系。"

"诊断效率分析包含四个关键维度，"王医生在白板上画出框架图：

**🔍 医疗诊断效率四维分析框架**：
1. **症状识别速度** - 对应查询解析和编译时间
2. **检查执行效率** - 对应数据读取和处理速度  
3. **资源使用优化** - 对应内存和CPU使用情况
4. **结果输出质量** - 对应查询结果的准确性和完整性

#### 建立医院诊疗效率监控系统

"让我们先建立一个诊断效率分析系统，"王医生开始演示，"就像给医院的诊疗过程做'体检'一样，监控每个环节的表现。这个系统就像医院的智能监护中心，实时监控每个诊疗过程的效率指标。"

"首先建立患者诊疗效率分析表，"他在系统中操作：

**专业技术对应**：
```sql
-- 创建患者诊疗效率分析表 (ClickHouse性能测试表)
CREATE TABLE diagnosis_efficiency (
    diagnosis_date Date,                    -- 诊断日期
    patient_id UInt64,                     -- 患者ID
    diagnosis_type LowCardinality(String), -- 诊断类型：初诊、复诊、急诊、会诊
    diagnosis_timestamp DateTime64(3),      -- 精确诊断时间戳
    doctor_id UInt32,                      -- 医生ID
    department LowCardinality(String),     -- 科室
    severity_score Float64,               -- 病情严重程度评分(0-10)
    symptoms Array(String),               -- 症状列表
    examination_time_seconds UInt32,       -- 检查耗时(秒)
    medical_records JSON                  -- 医疗记录详情
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(diagnosis_date)     -- 按月分区
ORDER BY (department, doctor_id, diagnosis_timestamp);

-- 插入大量诊疗测试数据（诊断日期覆盖最近30天；时间戳独立生成，与诊断日期不一致，不用于真实时序分析）
INSERT INTO diagnosis_efficiency
SELECT 
    today() - number % 30 as diagnosis_date,
    number % 50000 as patient_id,   -- 5万患者
    arrayElement(['初诊', '复诊', '急诊', '会诊'], number % 4 + 1) as diagnosis_type,
    now() - number * 60 as diagnosis_timestamp,  -- 每分钟一个诊断
    number % 200 + 1 as doctor_id,   -- 200名医生
    arrayElement(['内科', '外科', '急诊科', '儿科', '妇科'], number % 5 + 1) as department,
    (rand() % 1000) / 100.0 as severity_score,  -- 0-10分随机评分
    [arrayElement(['发热', '咳嗽', '头痛', '腹痛', '胸闷'], rand() % 5 + 1)] as symptoms,
    rand() % 3600 + 300 as examination_time_seconds,  -- 5-65分钟检查时间
    concat('{"主诉": "', arrayElement(['发热', '咳嗽', '头痛'], rand() % 3 + 1), 
           '", "费用": ', toString(rand() % 1000 + 100), '}') as medical_records
FROM numbers(1000000);  -- 100万条诊疗记录

-- 基础诊疗效率分析查询
SELECT 
    department,                              -- 科室
    count() as total_diagnosis,             -- 总诊断数
    avg(examination_time_seconds) as avg_exam_time,  -- 平均检查时间
    max(diagnosis_timestamp) as latest_diagnosis,    -- 最新诊断时间
    avg(severity_score) as avg_severity             -- 平均严重程度
FROM diagnosis_efficiency
WHERE diagnosis_date >= today() - 7          -- 最近一周数据
GROUP BY department
ORDER BY total_diagnosis DESC;

-- 监控慢诊断过程（类似慢查询监控）
SELECT 
    patient_id,
    doctor_id,
    department,
    diagnosis_type,
    examination_time_seconds,
    diagnosis_timestamp,
    symptoms,
    substr(medical_records::String, 1, 100) as medical_summary  -- 截取前100字符
FROM diagnosis_efficiency
WHERE examination_time_seconds > 1800        -- 超过30分钟的诊断
  AND diagnosis_date >= today() - 1
ORDER BY examination_time_seconds DESC
LIMIT 20;
```

> [!tip] 💡 诊疗效率监控要点
> **医疗效率分析的关键指标**：
> - **诊断速度**：平均检查时间，识别效率瓶颈
> - **资源利用率**：医生和设备的工作负荷
> - **患者满意度**：等待时间和诊疗质量平衡
> - **科室协调性**：跨科室会诊的协作效率

#### 使用EXPLAIN分析诊疗流程（查询执行计划分析）

**张护士长补充道：**"我们需要深入分析每个诊疗步骤，就像医生分析病情时需要了解检查的具体过程一样。EXPLAIN命令就是我们的'医疗影像设备'，能够透视查询执行的内部机制。"

```sql
-- 分析复杂诊疗统计的执行计划
EXPLAIN PLAN
SELECT 
    doctor_id,
    department,
    count() as total_patients,
    avg(examination_time_seconds) as avg_exam_time,
    avg(severity_score) as avg_severity
FROM diagnosis_efficiency
WHERE diagnosis_date >= today() - 7
  AND diagnosis_type = '急诊'
  AND severity_score >= 7.0  -- 重症患者
GROUP BY doctor_id, department
ORDER BY total_patients DESC
LIMIT 20;

-- 查看诊疗数据处理管道（像看X光片一样透视处理过程）
EXPLAIN PIPELINE
SELECT 
    department,
    diagnosis_type,
    toStartOfHour(diagnosis_timestamp) as hour,
    count() as patient_count,
    sum(examination_time_seconds) as total_exam_time
FROM diagnosis_efficiency
WHERE diagnosis_date >= today() - 1
GROUP BY department, diagnosis_type, hour
ORDER BY hour DESC, patient_count DESC;

-- 检查索引使用情况（像检查医疗设备工作状态）
EXPLAIN indexes = 1
SELECT count() as patient_count
FROM diagnosis_efficiency
WHERE doctor_id BETWEEN 100 AND 150  -- 特定医生组
  AND diagnosis_date >= today() - 7
  AND severity_score >= 5.0;

-- 查看查询语法解析树（像看病历结构图）
EXPLAIN AST
SELECT 
    doctor_id, 
    department, 
    count() as patient_count
FROM diagnosis_efficiency
WHERE examination_time_seconds > 1200  -- 超过20分钟的诊疗
GROUP BY doctor_id, department;

-- 查看计划的输出列与表达式动作（不执行查询，也不提供实际CPU或内存消耗）
EXPLAIN PLAN header = 1, actions = 1
SELECT 
    department,
    arrayReduce('avg', groupArray(severity_score)) as dept_avg_severity,
    arrayReduce('max', groupArray(examination_time_seconds)) as max_exam_time
FROM diagnosis_efficiency
WHERE diagnosis_date = today()
GROUP BY department
HAVING dept_avg_severity > 5.0;  -- 科室平均严重程度大于5
```

> [!info] 💡 EXPLAIN执行计划分析技巧
> **诊疗流程分析方法**：
> - **PLAN**：查看整体诊疗流程规划
> - **PIPELINE**：观察数据流转的各个阶段
> - **AST**：理解查询语句的逻辑结构
> - **indexes = 1**：在执行计划中检查索引过滤信息；不是独立的EXPLAIN INDEX命令

### 2. 系统性能监控

系统性能监控是查询优化的基础，通过持续监控关键指标，可以及时发现性能瓶颈和优化机会。合理的监控策略包括实时指标收集、历史趋势分析和预警机制。

**性能监控的四个维度**：
- **延迟(Latency)**：查询响应时间和分位数统计
- **吞吐量(Throughput)**：QPS和数据处理速率
- **错误率(Errors)**：查询失败和异常统计
- **饱和度(Saturation)**：系统资源使用率和容量规划

#### 实时性能指标

```sql
-- 当前运行的查询
SELECT 
    query_id,
    user,
    query,
    elapsed,
    read_rows,
    read_bytes,
    memory_usage,
    thread_ids
FROM system.processes
WHERE query != ''
ORDER BY elapsed DESC;

-- 系统负载指标
SELECT 
    metric,
    value,
    description
FROM system.asynchronous_metrics
WHERE metric IN (
    'CPUUsageNormalized',
    'MemoryDataAndStack', 
    'MemoryVirtual',
    'DiskAvailable',
    'NetworkReceiveBytes',
    'NetworkSendBytes'
)
ORDER BY metric;

-- 查询统计
SELECT 
    toStartOfMinute(event_time) as minute,
    count() as query_count,
    avg(query_duration_ms) as avg_duration,
    quantile(0.95)(query_duration_ms) as p95_duration,
    sum(read_rows) as total_read_rows,
    sum(memory_usage) as total_memory
FROM system.query_log
WHERE type = 'QueryFinish'
  AND event_time >= now() - INTERVAL 1 HOUR
GROUP BY minute
ORDER BY minute DESC;
```

#### 慢查询分析

```sql
-- 识别慢查询
SELECT 
    query,
    user,
    query_duration_ms,
    read_rows,
    read_bytes,
    memory_usage,
    event_time
FROM system.query_log
WHERE type = 'QueryFinish'
  AND query_duration_ms > 10000  -- 超过10秒的查询
  AND event_time >= now() - INTERVAL 24 HOUR
ORDER BY query_duration_ms DESC
LIMIT 20;

-- 查询模式分析
SELECT 
    normalizeQuery(query) as query_pattern,
    count() as execution_count,
    avg(query_duration_ms) as avg_duration,
    max(query_duration_ms) as max_duration,
    sum(read_rows) as total_read_rows
FROM system.query_log
WHERE type = 'QueryFinish'
  AND event_time >= now() - INTERVAL 24 HOUR
GROUP BY query_pattern
HAVING execution_count > 5
ORDER BY avg_duration DESC
LIMIT 15;
```

## 🎯 索引优化策略

### 1. 主键索引优化（医疗档案索引设计）

#### 理解稀疏索引（医院档案管理系统）

王医生带领大家来到档案管理室："医院的患者档案管理就像ClickHouse的稀疏索引，我们不可能为每份病历都建立详细目录，而是采用分级目录的方式快速定位。"

"你们看，"他指着档案柜，"我们按科室-医生-日期的层级来组织病历，这样既能快速定位，又不会占用太多空间建索引。"

```sql
-- 查看诊疗效率表的索引信息（像查看档案管理规则）
SELECT 
    name as table_name,
    primary_key,           -- 主键（档案的主要分类方式）
    sorting_key,          -- 排序键（档案的排列规则）
    engine_full as engine_definition,  -- 引擎定义；有效索引粒度需结合SHOW CREATE TABLE与表设置核对
    partition_key         -- 分区键（档案柜的分区方式）
FROM system.tables
WHERE name = 'diagnosis_efficiency';

-- 对比不同主键设计的效果
-- 原始设计（效率较低的档案管理）
CREATE TABLE medical_records_basic (
    record_time DateTime64(3),      -- 只按时间排序，像按日期流水号管理
    patient_id UInt64,
    doctor_id UInt32,
    diagnosis_type String,
    treatment_cost Float64
) ENGINE = MergeTree()
ORDER BY record_time;  -- 仅按时间排序，查找患者记录效率低

-- 优化后的设计（高效的档案管理系统）
CREATE TABLE medical_records_optimized (
    record_time DateTime64(3),
    patient_id UInt64,
    doctor_id UInt32,
    diagnosis_type LowCardinality(String),  -- 使用字典压缩
    treatment_cost Float64
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(record_time)         -- 按月分区，像按月度分档案柜
ORDER BY (patient_id, doctor_id, record_time); -- 多级排序：患者->医生->时间

-- 性能对比测试
-- 测试1：按患者ID查询（预期可改善索引裁剪；须填充相同数据并实测，不能据空表断言大幅提升）
EXPLAIN indexes = 1
SELECT count() as record_count
FROM medical_records_optimized
WHERE patient_id = 12345;

-- 测试2：按医生查询某患者的历史记录
EXPLAIN indexes = 1
SELECT 
    record_time,
    diagnosis_type,
    treatment_cost
FROM medical_records_optimized
WHERE patient_id = 12345 
  AND doctor_id = 88
ORDER BY record_time DESC
LIMIT 10;

-- 测试3：时间范围查询的性能差异
EXPLAIN indexes = 1
SELECT count()
FROM medical_records_optimized
WHERE record_time >= now() - INTERVAL 30 DAY;
```

> [!tip] 💡 主键索引设计原则
> **档案管理系统的设计经验**：
> - **过滤模式优先**：本例以患者查询为主，采用患者ID → 医生ID → 时间；不能仅凭基数决定排序键顺序
> - **查询模式匹配**：主键顺序要符合最常见的查询模式
> - **匹配访问模式**：时间戳作为排序键不会必然导致随机写入；是否适合取决于时间范围过滤、其他过滤列及数据分布
> - **合理分区**：按时间分区便于数据管理和查询优化

#### 复合主键设计

```sql
-- 多维度主键设计
CREATE TABLE user_behavior_optimized (
    date Date,
    user_id UInt64,
    session_id String,
    event_type LowCardinality(String),
    timestamp DateTime64(3),
    page_url String,
    value Float64
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
-- 排序键顺序按主要过滤模式与数据分布设计；本例优先支持用户及会话查询，不是通用的高基数优先规则
ORDER BY (user_id, session_id, event_type, timestamp)
SETTINGS index_granularity = 8192;

-- 测试不同查询模式的性能
-- 模式1：按用户ID查询（最优）
SELECT count() FROM user_behavior_optimized WHERE user_id = 12345;

-- 模式2：按用户ID和会话ID查询（很好）
SELECT count() FROM user_behavior_optimized WHERE user_id = 12345 AND session_id = 'session_abc';

-- 模式3：只按事件类型查询（需要全表扫描）
SELECT count() FROM user_behavior_optimized WHERE event_type = 'purchase';
```

### 2. 二级索引设计

ClickHouse的二级索引（Skip Index）是与传统数据库B+树索引不同的创新设计。它们通过粗粒度的数据统计信息来跳过不相关的数据块，从而大幅提高查询性能。

**二级索引选择指南**：
- **MinMax索引**：适合连续数值的范围查询
- **Set索引**：适合低基数字段的IN和等值查询
- **Bloom Filter**：通用bloom_filter主要用于等值、IN及支持的存在性判断；任意字符串子串匹配需考虑专门的N-gram索引
- **N-gram**：适合模糊匹配和LIKE查询

#### 跳数索引（Skip Index）

```sql
-- 添加不同类型的跳数索引
ALTER TABLE performance_test ADD INDEX idx_value_minmax value TYPE minmax GRANULARITY 3;
ALTER TABLE performance_test ADD INDEX idx_event_type_set event_type TYPE set(100) GRANULARITY 1;
ALTER TABLE performance_test ADD INDEX idx_properties_bloom properties TYPE bloom_filter GRANULARITY 1;

-- 强制物化索引
ALTER TABLE performance_test MATERIALIZE INDEX idx_value_minmax;
ALTER TABLE performance_test MATERIALIZE INDEX idx_event_type_set;
ALTER TABLE performance_test MATERIALIZE INDEX idx_properties_bloom;

-- 测试索引效果
EXPLAIN indexes = 1
SELECT count()
FROM performance_test
WHERE value BETWEEN 100 AND 200;

EXPLAIN indexes = 1
SELECT count()
FROM performance_test
WHERE event_type IN ('purchase', 'signup');

-- 查看索引使用统计
SELECT 
    table,
    name,
    type,
    expr as index_expression,
    data_compressed_bytes,
    data_uncompressed_bytes
FROM system.data_skipping_indices
WHERE table = 'performance_test';
```

#### 高级索引类型

```sql
-- 创建包含各种索引的表
CREATE TABLE advanced_indexes_demo (
    id UInt64,
    timestamp DateTime,
    user_name String,
    email String,
    description Text,
    tags Array(String),
    location_lat Float64,
    location_lon Float64,
    price Decimal(10,2)
) ENGINE = MergeTree()
ORDER BY id;

-- 添加各种类型的索引
-- 1. MinMax索引 - 适合范围查询
ALTER TABLE advanced_indexes_demo ADD INDEX idx_price_minmax price TYPE minmax GRANULARITY 4;

-- 2. Set索引 - 适合IN查询和等值查询
ALTER TABLE advanced_indexes_demo ADD INDEX idx_tags_set tags TYPE set(1000) GRANULARITY 1;

-- 3. 通用Bloom Filter索引 - 适合支持的等值或存在性条件，不适用于任意子串LIKE
ALTER TABLE advanced_indexes_demo ADD INDEX idx_description_bloom description TYPE bloom_filter GRANULARITY 1;

-- 4. N-gram Bloom Filter索引 - 适合LIKE查询
ALTER TABLE advanced_indexes_demo ADD INDEX idx_email_ngram email TYPE ngrambf_v1(3, 256, 2, 0) GRANULARITY 1;

-- 5. Token Bloom Filter索引 - 适合分词搜索
ALTER TABLE advanced_indexes_demo ADD INDEX idx_description_token description TYPE tokenbf_v1(256, 2, 0) GRANULARITY 1;

-- 插入测试数据
INSERT INTO advanced_indexes_demo
SELECT 
    number as id,
    now() - number as timestamp,
    concat('user_', toString(number % 1000)) as user_name,
    concat('user', toString(number % 1000), '@example.com') as email,
    concat('This is description number ', toString(number), ' with some random text') as description,
    [arrayElement(['tag1', 'tag2', 'tag3'], number % 3 + 1)] as tags,
    rand() % 90 + rand() / 1000000 as location_lat,
    rand() % 180 + rand() / 1000000 as location_lon,
    rand() % 10000 / 100 as price
FROM numbers(100000);

-- 测试不同索引的效果
-- MinMax索引测试
EXPLAIN indexes = 1
SELECT count() FROM advanced_indexes_demo WHERE price BETWEEN 50 AND 100;

-- Set索引测试
EXPLAIN indexes = 1
SELECT count() FROM advanced_indexes_demo WHERE has(tags, 'tag1');

-- 子串匹配对照测试：通用bloom_filter不支持用此条件裁剪数据；该词还存在于全部示例记录中
EXPLAIN indexes = 1
SELECT count() FROM advanced_indexes_demo WHERE description LIKE '%random%';

-- N-gram索引测试
EXPLAIN indexes = 1
SELECT count() FROM advanced_indexes_demo WHERE email LIKE '%123%';
```

### 3. 分区策略优化

#### 分区设计原则

```sql
-- 不同的分区策略比较

-- 策略1：按天分区（数据量小时）
CREATE TABLE events_daily_partition (
    timestamp DateTime,
    user_id UInt64,
    event_type String,
    value Float64
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (user_id, timestamp);

-- 策略2：按月分区（推荐）
CREATE TABLE events_monthly_partition (
    timestamp DateTime,
    user_id UInt64,
    event_type String,
    value Float64
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (user_id, timestamp);

-- 策略3：按周分区
CREATE TABLE events_weekly_partition (
    timestamp DateTime,
    user_id UInt64,
    event_type String,
    value Float64
) ENGINE = MergeTree()
PARTITION BY toYearWeek(timestamp)
ORDER BY (user_id, timestamp);

-- 策略4：多维分区（大数据量）
CREATE TABLE events_multi_partition (
    timestamp DateTime,
    user_id UInt64,
    event_type LowCardinality(String),
    region LowCardinality(String),
    value Float64
) ENGINE = MergeTree()
PARTITION BY (toYYYYMM(timestamp), region)
ORDER BY (user_id, timestamp);

-- 查看分区效果
SELECT 
    table,
    partition,
    rows,
    bytes_on_disk,
    formatReadableSize(bytes_on_disk) as size_readable,
    min_date,
    max_date
FROM system.parts
WHERE table LIKE 'events_%_partition'
  AND active = 1
ORDER BY table, partition;
```

## 🚀 查询优化技巧

### 1. SQL查询优化

#### WHERE子句优化

```sql
-- 优化前：低效的查询
SELECT user_id, count() as events
FROM performance_test
WHERE toString(user_id) LIKE '123%'  -- 避免在WHERE中使用函数
  AND date + INTERVAL 1 DAY > today() -- 避免在列上进行计算
GROUP BY user_id;

-- 保持结果语义的改写：日期条件移除列侧计算；用户ID前缀条件仍需实测，不能保证整体更快
SELECT user_id, count() as events
FROM performance_test
WHERE startsWith(toString(user_id), '123')  -- 保留原数字字符串前缀语义；没有固定长度约束时不能改为12300至12399
  AND date > today() - INTERVAL 1 DAY   -- 直接比较
GROUP BY user_id;

-- PREWHERE优化（ClickHouse特有）
-- PREWHERE先读取过滤所需列，再按过滤结果读取其他列；是否更高效取决于选择性、列大小和优化器自动迁移行为
SELECT user_id, event_type, value
FROM performance_test
PREWHERE date >= today() - 7  -- 高选择性条件放在PREWHERE
WHERE value > 100             -- 其他条件放在WHERE
  AND event_type = 'purchase';

-- 条件选择性示例：书写顺序不保证实际求值顺序，应以执行计划和实测为准
SELECT count()
FROM performance_test
WHERE user_id = 12345        -- 高选择性条件在前
  AND date >= today() - 7    -- 中等选择性
  AND event_type = 'click';  -- 低选择性条件在后
```

#### JOIN优化

```sql
-- 创建维度表
CREATE TABLE user_profiles (
    user_id UInt64,
    name String,
    age UInt8,
    city LowCardinality(String),
    registration_date Date
) ENGINE = MergeTree()
ORDER BY user_id;

-- 插入维度数据
INSERT INTO user_profiles
SELECT 
    number as user_id,
    concat('User_', toString(number)) as name,
    20 + number % 60 as age,
    arrayElement(['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen'], number % 4 + 1) as city,
    today() - number % 365 as registration_date
FROM numbers(100000);

-- JOIN优化技巧

-- 1. 小表在右边（ClickHouse优化）
SELECT 
    e.user_id,
    e.event_type,
    u.name,
    u.city
FROM performance_test e
JOIN user_profiles u ON e.user_id = u.user_id  -- 小表在右边
WHERE e.date >= today() - 7;

-- 2. ANY JOIN每个左表行最多匹配一个右表行；仅在无需保留全部匹配或右表键唯一时使用
SELECT 
    e.user_id,
    e.event_type,
    u.name
FROM performance_test e
ANY LEFT JOIN user_profiles u ON e.user_id = u.user_id
WHERE e.date >= today() - 7;

-- 3. 预聚合减少JOIN数据量
WITH user_events AS (
    SELECT 
        user_id,
        count() as event_count,
        max(timestamp) as last_seen
    FROM performance_test
    WHERE date >= today() - 7
    GROUP BY user_id
)
SELECT 
    ue.user_id,
    ue.event_count,
    u.name,
    u.city
FROM user_events ue
JOIN user_profiles u ON ue.user_id = u.user_id;

-- 4. 字典表优化（适合小维度表）
CREATE DICTIONARY user_dict (
    user_id UInt64,
    name String,
    city String
) PRIMARY KEY user_id
SOURCE(CLICKHOUSE(
    HOST 'localhost' PORT 9000
    USER 'default' PASSWORD ''
    DB 'default' TABLE 'user_profiles'
))
LAYOUT(HASHED())
LIFETIME(3600);

-- 使用字典查询
SELECT 
    user_id,
    event_type,
    dictGet('user_dict', 'name', user_id) as name,
    dictGet('user_dict', 'city', user_id) as city
FROM performance_test
WHERE date >= today() - 7;
```

#### 聚合查询优化

```sql
-- 聚合优化技巧

-- 1. 使用近似聚合函数
SELECT 
    event_type,
    count() as exact_count,
    uniqExact(user_id) as exact_unique_users,
    uniqHLL12(user_id) as approx_unique_users,  -- 更快，略有误差
    quantileExact(0.5)(value) as exact_median,
    quantile(0.5)(value) as approx_median       -- 更快，略有误差
FROM performance_test
GROUP BY event_type;

-- 2. 分阶段聚合
-- 第一阶段：预聚合
WITH daily_stats AS (
    SELECT 
        date,
        user_id,
        event_type,
        count() as daily_events,
        sum(value) as daily_value
    FROM performance_test
    WHERE date >= today() - 30
    GROUP BY date, user_id, event_type
)
-- 第二阶段：最终聚合
SELECT 
    user_id,
    sum(daily_events) as total_events,
    avg(daily_value) as avg_daily_value
FROM daily_stats
GROUP BY user_id
ORDER BY total_events DESC
LIMIT 100;

-- 3. 使用物化视图预计算
CREATE MATERIALIZED VIEW user_daily_stats_mv
ENGINE = SummingMergeTree()
ORDER BY (date, user_id, event_type)
AS SELECT 
    date,
    user_id,
    event_type,
    count() as event_count,
    sum(value) as total_value,
    uniq(timestamp) as unique_timestamps
FROM performance_test
GROUP BY date, user_id, event_type;

-- 查询预计算结果
SELECT 
    user_id,
    sum(event_count) as total_events,
    sum(total_value) as total_value
FROM user_daily_stats_mv
WHERE date >= today() - 7
GROUP BY user_id
ORDER BY total_events DESC
LIMIT 10;
```

### 2. 内存优化

#### 内存使用控制

```sql
-- 查询级内存限制
SET max_memory_usage = 8000000000;  -- 8GB
SET max_memory_usage_for_user = 20000000000;  -- 20GB

-- 大数据量处理优化
SET max_bytes_before_external_group_by = 2000000000;  -- 示例：2GB阈值低于8GB查询上限，仍需预留合并及其他操作内存
SET max_bytes_before_external_sort = 2000000000;      -- 示例：2GB后允许外部排序，需检查临时磁盘容量

-- 减少内存使用的查询技巧

-- 1. 避免SELECT *
-- 不好的做法
-- SELECT * FROM performance_test WHERE date >= today() - 7;

-- 好的做法
SELECT user_id, event_type, timestamp, value
FROM performance_test
WHERE date >= today() - 7;

-- 2. 使用LIMIT控制结果集大小
SELECT user_id, count() as events
FROM performance_test
WHERE date >= today() - 7
GROUP BY user_id
ORDER BY events DESC
LIMIT 1000;  -- 限制结果数量

-- 3. 流式处理大结果集
SELECT user_id, event_type, timestamp
FROM performance_test
WHERE date >= today() - 7
ORDER BY timestamp
LIMIT 10000000
SETTINGS max_block_size = 65536;  -- 控制块大小
```

#### 缓存优化

```sql
-- 查看缓存使用情况
SELECT 
    metric,
    value,
    formatReadableSize(value) as readable_value
FROM system.asynchronous_metrics
WHERE metric LIKE '%Cache%'
ORDER BY metric;

-- 标记缓存使用
SELECT 
    file_segment_range_begin,
    file_segment_range_end,
    size,
    state
FROM system.filesystem_cache
LIMIT 10;

-- 查询缓存（如果启用）
SET use_query_cache = 1;
SET query_cache_ttl = 60;  -- 缓存60秒

SELECT 
    event_type,
    count() as events
FROM performance_test
WHERE date = today()
GROUP BY event_type;

-- 查看查询缓存状态
SELECT * FROM system.query_cache;
```

## 📊 存储优化

### 1. 数据压缩优化

#### 压缩算法选择

```sql
-- 不同压缩算法的性能比较表
CREATE TABLE compression_test (
    id UInt64,
    timestamp DateTime CODEC(Delta, LZ4),
    user_id UInt64 CODEC(Delta, ZSTD),
    event_type LowCardinality(String) CODEC(ZSTD),
    properties String CODEC(ZSTD(3)),
    metrics Array(Float64) CODEC(FPC),
    raw_data String CODEC(LZ4HC)
) ENGINE = MergeTree()
ORDER BY id;

-- 插入测试数据
INSERT INTO compression_test
SELECT 
    number as id,
    now() - number as timestamp,
    number % 100000 as user_id,
    arrayElement(['page_view', 'click', 'purchase'], number % 3 + 1) as event_type,
    concat('{"key": "value', toString(number), '"}') as properties,
    [rand() % 1000, rand() % 1000, rand() % 1000] as metrics,
    repeat('data', 100) as raw_data
FROM numbers(1000000);

-- 查看压缩效果
SELECT 
    column,
    type,
    data_compressed_bytes,
    data_uncompressed_bytes,
    round(data_uncompressed_bytes / data_compressed_bytes, 2) as compression_ratio,
    formatReadableSize(data_compressed_bytes) as compressed_size,
    formatReadableSize(data_uncompressed_bytes) as uncompressed_size
FROM system.columns
WHERE table = 'compression_test'
ORDER BY compression_ratio DESC;
```

#### 存储策略优化

```sql
-- 多层存储策略
CREATE TABLE tiered_storage (
    date Date,
    user_id UInt64,
    event_type String,
    data String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (user_id, date)
-- TTL策略：7天后迁移至hot磁盘，30天后迁移至cold磁盘，365天后异步删除；需预配置磁盘及存储策略，初始存放位置由策略决定
TTL date + INTERVAL 7 DAY TO DISK 'hot',
    date + INTERVAL 30 DAY TO DISK 'cold',
    date + INTERVAL 365 DAY DELETE;

-- 查看TTL状态
SELECT 
    table,
    partition,
    name,
    delete_ttl_info_min,
    delete_ttl_info_max
FROM system.parts
WHERE table = 'tiered_storage'
  AND active = 1;
```

### 2. 分区管理优化

#### 分区维护

```sql
-- 查看分区大小和状态
SELECT 
    partition,
    count() as parts_count,
    sum(rows) as total_rows,
    sum(bytes_on_disk) as total_bytes,
    formatReadableSize(sum(bytes_on_disk)) as readable_size,
    min(min_date) as oldest_date,
    max(max_date) as newest_date
FROM system.parts
WHERE table = 'performance_test'
  AND active = 1
GROUP BY partition
ORDER BY partition;

-- 手动优化分区
OPTIMIZE TABLE performance_test PARTITION '202401';

-- 删除旧分区
ALTER TABLE performance_test DROP PARTITION '202312';

-- 分离分区（暂时移出查询范围；不是独立备份，不能代替备份恢复方案）
ALTER TABLE performance_test DETACH PARTITION '202401';

-- 重新附加分区
ALTER TABLE performance_test ATTACH PARTITION '202401';

-- 分区合并策略
ALTER TABLE performance_test MODIFY SETTING merge_with_ttl_timeout = 3600;
```

## 🎛️ 高级优化技术

### 1. 物化视图优化

#### 预计算聚合

```sql
-- 创建预计算的物化视图
CREATE MATERIALIZED VIEW hourly_user_stats
ENGINE = SummingMergeTree()
ORDER BY (hour, user_id, event_type)
AS SELECT 
    toStartOfHour(timestamp) as hour,
    user_id,
    event_type,
    count() as event_count,
    sum(value) as total_value,
    uniq(tags) as unique_tags
FROM performance_test
GROUP BY hour, user_id, event_type;

-- 使用预计算结果进行快速查询
SELECT 
    hour,
    sum(event_count) as total_events,
    avg(total_value) as avg_value
FROM hourly_user_stats
WHERE hour >= toStartOfHour(now()) - INTERVAL 24 HOUR
GROUP BY hour
ORDER BY hour;

-- 链式物化视图
CREATE MATERIALIZED VIEW daily_summary
ENGINE = SummingMergeTree()
ORDER BY (date, event_type)
AS SELECT 
    toDate(hour) as date,
    event_type,
    sum(event_count) as daily_events,
    sum(total_value) as daily_value
FROM hourly_user_stats
GROUP BY date, event_type;
```

### 2. 查询并行化

#### 并行查询优化

```sql
-- 设置并行查询参数
SET max_threads = 16;  -- CPU核心数
SET max_alter_threads = 8;
SET max_final_threads = 16;

-- 分布式查询优化
SET distributed_aggregation_memory_efficient = 1;
SET distributed_group_by_no_merge = 0;

-- 大表查询优化
SELECT 
    user_id,
    count() as events
FROM performance_test
WHERE date >= today() - 30
GROUP BY user_id
SETTINGS 
    max_threads = 16,
    max_block_size = 65536,
    max_execution_time = 300;
```

### 3. 自适应优化

#### 动态参数调整

```sql
-- 查看当前设置
SELECT name, value, description
FROM system.settings
WHERE name LIKE '%max_memory%'
   OR name LIKE '%max_threads%'
   OR name LIKE '%timeout%'
ORDER BY name;

-- 针对不同查询类型的优化设置

-- 大数据量聚合查询
SET max_memory_usage = 20000000000;        -- 20GB
SET max_threads = 16;                      -- 最大线程
SET max_execution_time = 1800;             -- 30分钟超时
SET group_by_two_level_threshold = 100000; -- 两级GROUP BY

-- 实时查询优化
SET max_memory_usage = 1000000000;         -- 1GB
SET max_execution_time = 30;               -- 30秒超时
SET max_block_size = 8192;                 -- 小块大小

-- OLAP分析查询
SET max_memory_usage = 50000000000;        -- 50GB
SET max_threads = 32;                      -- 更多线程
SET max_execution_time = 3600;             -- 1小时超时
```

## 📈 性能监控和调优

### 1. 性能基准测试

#### 基准查询集合

```sql
-- 创建基准查询集合视图：仅保存SQL文本，不是存储过程，也不会自动执行测试
CREATE VIEW benchmark_queries AS
SELECT 
    'point_query' as query_type,
    'SELECT count() FROM performance_test WHERE user_id = 12345' as query_sql
UNION ALL
SELECT 
    'range_query' as query_type,
    'SELECT count() FROM performance_test WHERE date BETWEEN today()-7 AND today()' as query_sql
UNION ALL
SELECT 
    'aggregation_query' as query_type,
    'SELECT event_type, count(), avg(value) FROM performance_test WHERE date >= today()-7 GROUP BY event_type' as query_sql
UNION ALL
SELECT 
    'join_query' as query_type,
    'SELECT e.user_id, u.name FROM performance_test e JOIN user_profiles u ON e.user_id = u.user_id LIMIT 1000' as query_sql;

-- 汇总已执行且写入query_log的基准查询；本语句不执行基准查询
SELECT 
    query_type,
    avg(query_duration_ms) as avg_duration,
    min(query_duration_ms) as min_duration,
    max(query_duration_ms) as max_duration,
    count() as execution_count
FROM (
    SELECT 
        normalizeQuery(query) as normalized_query,
        query_duration_ms
    FROM system.query_log
    WHERE type = 'QueryFinish'
      AND event_time >= now() - INTERVAL 1 HOUR
) q
JOIN benchmark_queries b ON q.normalized_query = normalizeQuery(b.query_sql)
GROUP BY query_type
ORDER BY avg_duration DESC;
```

### 2. 自动化优化建议

#### 优化建议系统

```sql
-- 创建优化建议视图
CREATE VIEW optimization_suggestions AS
-- 建议1：识别需要索引的查询
SELECT 
    'add_index' as suggestion_type,
    'Consider adding index on frequently filtered columns' as suggestion,
    query,
    query_duration_ms,
    read_rows
FROM system.query_log
WHERE type = 'QueryFinish'
  AND query_duration_ms > 5000
  AND read_rows > 1000000
  AND query LIKE '%WHERE%'
  AND event_time >= now() - INTERVAL 24 HOUR
LIMIT 5

UNION ALL

-- 建议2：识别内存使用过高的查询
SELECT 
    'optimize_memory' as suggestion_type,
    'Consider reducing memory usage or adding LIMIT' as suggestion,
    query,
    query_duration_ms,
    memory_usage
FROM system.query_log
WHERE type = 'QueryFinish'
  AND memory_usage > 10000000000  -- 10GB
  AND event_time >= now() - INTERVAL 24 HOUR
LIMIT 5

UNION ALL

-- 建议3：识别频繁执行的慢查询
SELECT 
    'optimize_frequent_slow' as suggestion_type,
    'Consider optimizing this frequently executed slow query' as suggestion,
    normalizeQuery(query) as query,
    avg(query_duration_ms) as avg_duration,
    count() as execution_count
FROM system.query_log
WHERE type = 'QueryFinish'
  AND query_duration_ms > 1000
  AND event_time >= now() - INTERVAL 24 HOUR
GROUP BY normalizeQuery(query)
HAVING execution_count > 10
ORDER BY avg_duration * execution_count DESC
LIMIT 5;

-- 查看优化建议
SELECT * FROM optimization_suggestions;
```

## 🎯 优化最佳实践

### 1. 查询优化检查清单

> [!info] 📋 查询优化检查清单
> 
> **索引策略**：
> - ✅ 排序键符合主要过滤模式，并结合基数与数据分布验证索引裁剪效果
> - ✅ 为常用WHERE条件添加跳数索引
> - ✅ 分区策略适合查询模式
> 
> **查询编写**：
> - ✅ 结合列读取成本与选择性评估PREWHERE，不机械替代WHERE
> - ✅ 检查WHERE中的函数是否妨碍索引裁剪，改写前验证结果等价
> - ✅ 只选择需要的列，避免SELECT *
> 
> **内存管理**：
> - ✅ 设置合理的内存限制
> - ✅ 对大结果集使用LIMIT
> - ✅ 使用近似聚合函数
> 
> **存储优化**：
> - ✅ 选择合适的压缩算法
> - ✅ 定期清理旧分区
> - ✅ 使用物化视图预计算

### 2. 性能调优流程

```sql
-- 性能调优标准流程
-- 1. 识别问题查询
WITH slow_queries AS (
    SELECT 
        query,
        query_duration_ms,
        read_rows,
        memory_usage,
        event_time
    FROM system.query_log
    WHERE type = 'QueryFinish'
      AND query_duration_ms > 5000
      AND event_time >= now() - INTERVAL 1 HOUR
    ORDER BY query_duration_ms DESC
    LIMIT 10
)
-- 2. 分析查询特征
SELECT 
    'Analysis' as step,
    count() as slow_query_count,
    avg(query_duration_ms) as avg_duration,
    max(memory_usage) as max_memory
FROM slow_queries;

-- 3. 生成优化计划
CREATE VIEW optimization_plan AS
SELECT 
    'Check indexes' as optimization_step,
    1 as priority,
    'Review primary key and skip indexes for main tables' as action
UNION ALL
SELECT 
    'Analyze query patterns' as optimization_step,
    2 as priority,
    'Use EXPLAIN to understand query execution' as action
UNION ALL
SELECT 
    'Optimize memory usage' as optimization_step,
    3 as priority,
    'Set appropriate memory limits and use streaming' as action
UNION ALL
SELECT 
    'Consider materialized views' as optimization_step,
    4 as priority,
    'Pre-calculate frequent aggregations' as action
ORDER BY priority;
```

## 🎯 查询优化总结

通过本章节的学习，我们掌握了：

1. **性能诊断方法** - 查询分析、执行计划、系统监控
2. **索引优化策略** - 主键设计、二级索引、分区策略
3. **查询优化技巧** - SQL优化、内存管理、并行处理
4. **存储优化方案** - 压缩策略、分区管理、TTL设置
5. **高级优化技术** - 物化视图、自动调优、性能监控

> [!abstract] 📚 下一步学习
> 现在你已经掌握了ClickHouse查询优化的核心技能，接下来我们将学习[[【技术与工具】/ClickHouse/08-ClickHouse集群管理|ClickHouse集群]]，了解如何在分布式环境中部署和管理ClickHouse。

## 🔗 相关资源

- [[【技术与工具】/ClickHouse/06-ClickHouse数据导入导出|ClickHouse数据导入导出]]
- [[【技术与工具】/ClickHouse/00-ClickHouse学习路线图|ClickHouse]]
- [[【技术与工具】/ClickHouse/04-ClickHouse数据类型与表引擎|ClickHouse数据类型与表引擎]]

---

> 💡 **记住**：**查询优化是一个持续的过程**，需要根据实际的查询模式和数据特征来调整策略。**掌握性能诊断方法比记住具体优化技巧更重要**，这样你就能根据具体情况制定最合适的优化方案。实践是最好的老师！