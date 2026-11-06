---
title: ClickHouse数据导入导出
tags:
  - ClickHouse
  - 数据导入
  - 数据导出
  - ETL
  - 实时数据流
difficulty: 高级
duration: 50分钟
description: 掌握ClickHouse多种数据导入导出方法，包括批量导入、实时流处理、外部系统集成和高性能数据传输技巧。
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据治理工程师
  - 数据运营
  - 数据分析师
  - BI分析师
stability: slow-changing
status: maintenance
access_tier: free
updated: 2026-10-10
---


# 📥📤 ClickHouse数据导入导出

## 📚 学习目标

通过本章节的学习，你将能够：
- **掌握多种数据导入方法**，包括批量和实时导入
- **理解不同数据格式**的处理和转换技巧
- **学会与外部系统集成**，如Kafka、MySQL等
- **掌握高性能数据传输**的最佳实践
- **理解数据导出和备份**的各种方案

> [!tip] 💡 学习建议
> 数据导入导出是ClickHouse使用的核心环节，**就像水管系统的进水和出水一样重要**。**先理解不同方法的适用场景，再深入具体实现**。重点关注性能优化和错误处理，这在生产环境中至关重要。

## 📥 数据导入基础

### 1. INSERT语句导入

张护士长来到医院的患者信息录入中心："欢迎来到我们的数据流转中心！这里就像人体的血液循环系统，负责将各种患者信息安全、高效地输送到医院的智能病历系统中。"

"你们看，"她指向几个不同的工作台，"我们有多种患者信息录入方式，就像ClickHouse有多种数据导入方法一样，每种方式都有其最适合的应用场景。"

#### 基础INSERT操作（单个患者信息录入）

"最基础的是单个患者信息录入，"张护士长演示着操作，"就像患者来医院挂号时，我们逐一记录他们的基本信息。虽然速度不是最快的，但对于日常零散的信息更新很适用。"

**专业技术对应**：
```sql
-- 创建患者就诊记录表 (医疗数据表结构)
CREATE TABLE patient_visits (
    patient_id UInt64,           -- 患者唯一标识
    visit_time DateTime,         -- 就诊时间
    visit_type LowCardinality(String), -- 就诊类型：挂号、检查、复诊等
    department String,           -- 就诊科室
    session_id String,          -- 会话标识
    medical_info JSON           -- 医疗信息，如症状、费用等
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(visit_time)  -- 按月分区，便于查询和管理
ORDER BY (patient_id, visit_time); -- 按患者和时间排序

-- 单个患者信息录入示例
INSERT INTO patient_visits VALUES 
    (1001, '2024-01-01 10:00:00', '挂号', '心内科', 'session_123', '{"症状": "胸闷"}');

-- 批量患者信息录入 (一批挂号患者)
INSERT INTO patient_visits VALUES 
    (1002, '2024-01-01 10:01:00', '检查', '放射科', 'session_124', '{"检查项目": "胸片"}'),
    (1003, '2024-01-01 10:02:00', '挂号', '外科', 'session_125', '{"症状": "腹痛"}'),
    (1001, '2024-01-01 10:03:00', '复诊', '心内科', 'session_123', '{"费用": 299.99}');

-- 使用SELECT子查询进行批量数据生成（推荐用于大数据量测试）
INSERT INTO patient_visits 
SELECT 
    number + 1000 as patient_id,
    now() - number as visit_time,
    arrayElement(['挂号', '检查', '复诊'], number % 3 + 1) as visit_type,
    arrayElement(['心内科', '外科', '急诊科'], number % 3 + 1) as department,
    concat('session_', toString(number)) as session_id,
    concat('{"费用": ', toString(number * 10), '}') as medical_info
FROM numbers(10000); -- 生成1万条测试数据
```

#### 高性能批量插入优化策略

**王医生进一步解释道：**"对于大批量患者数据的导入，我们需要采用一些优化技巧，就像医院在流感高峰期需要采用更高效的接诊流程一样。"

```sql
-- 使用INSERT...SELECT进行批量数据迁移
-- 适用场景：从历史系统迁移患者数据到新系统
INSERT INTO patient_visits
SELECT 
    patient_id,
    visit_time,
    visit_type,
    department,
    session_id,
    medical_info
FROM legacy_patient_system
WHERE visit_time >= '2024-01-01';

-- 性能优化设置（提高插入效率）
SET max_insert_threads = 8;           -- 使用8个线程并行插入
SET max_insert_block_size = 1048576;  -- 插入块的行数设置，不是1MB字节大小；实际分块取决于导入方式
SET min_insert_block_size_rows = 262144; -- 最少26万行一个块

-- 异步插入设置（适合实时数据流）
SET async_insert = 1;                 -- 启用异步插入
SET wait_for_async_insert = 0;        -- 仅等待进入异步缓冲，不等待落表；后续写入失败可能不返回给调用方，可靠写入通常应使用1
SET async_insert_max_data_size = 10485760; -- 缓冲区10MB

-- 异步插入示例（常用于实时患者监控数据）
INSERT INTO patient_visits VALUES 
    (9999, now(), '监控', 'ICU', 'monitor_session', '{"心率": 75, "血压": "120/80"}');
```

> [!tip] 💡 性能优化建议
> **批量插入最佳实践**：
> - **数据块大小**：原稿给出的单次100万-1000万行仅为未验证的压测候选范围，不是通用最佳值；须结合行宽、内存、分区数和延迟目标确定
> - **并发控制**：根据服务器CPU核心数设置插入线程
> - **内存管理**：监控内存使用，避免OOM错误
> - **网络优化**：使用压缩传输减少网络开销

### 2. 文件格式导入

#### CSV文件导入（患者数据批量导入）

"很多时候，我们需要从Excel表格或其他系统导入大量患者数据，"张护士长解释道，"CSV是最常用的数据交换格式，就像医院各科室之间传递患者信息的标准表格。"

```sql
-- 直接CSV格式导入（内嵌数据）
INSERT INTO patient_visits FORMAT CSV
1001,'2024-01-01 10:00:00','挂号','心内科','session_123','{"症状": "胸闷"}'
1002,'2024-01-01 10:01:00','检查','放射科','session_124','{"检查项目": "胸片"}'
1003,'2024-01-01 10:02:00','治疗','外科','session_125','{"手术费用": 1999.99}';

-- 从外部CSV文件导入患者数据
-- 步骤1：准备CSV文件 /tmp/patients.csv，内容如下：
-- patient_id,visit_time,visit_type,department,session_id,medical_info
-- 1001,"2024-01-01 10:00:00","挂号","心内科","session_123","{""症状"": ""胸闷""}"
-- 
-- 步骤2：使用命令行导入
-- clickhouse-client --query="INSERT INTO patient_visits FORMAT CSVWithNames" < /tmp/patients.csv

-- 带标题行的CSV文件处理（推荐方式）
INSERT INTO patient_visits FORMAT CSVWithNames
patient_id,visit_time,visit_type,department,session_id,medical_info
1004,'2024-01-01 10:04:00','复诊','心内科','session_126','{"血压": "130/85"}'
1005,'2024-01-01 10:05:00','咨询','全科','session_127','{"咨询类型": "健康体检"}';

-- Tab分隔符格式（制表符分隔）
INSERT INTO patient_visits FORMAT TabSeparated
1006	2024-01-01 10:06:00	检查	影像科	session_128	{"检查类型": "CT"}
1007	2024-01-01 10:07:00	治疗	康复科	session_129	{"治疗项目": "物理治疗"};
```

> [!warning] ⚠ 数据格式注意事项
> **CSV导入常见问题**：
> - **字符编码**：确保文件使用UTF-8编码，避免中文乱码
> - **特殊字符**：JSON字段中的引号需要转义处理
> - **日期格式**：保持统一的日期时间格式 'YYYY-MM-DD HH:MM:SS'
> - **字段对应**：确保CSV列顺序与表结构字段顺序一致

#### JSON格式导入（复杂医疗数据处理）

"现代医疗设备和系统经常生成JSON格式的数据，"陈技师补充道，"比如监护设备的实时数据、检验结果的详细报告等，JSON格式能够很好地保存这些复杂的结构化信息。"

```sql
-- JSON Lines格式导入（每行一个JSON对象）
-- 适用于流式数据处理，如实时监护数据
INSERT INTO patient_visits FORMAT JSONEachRow
{"patient_id": 1008, "visit_time": "2024-01-01 10:08:00", "visit_type": "监护", "department": "ICU", "session_id": "icu_130", "medical_info": {"心率": 75, "血压": "120/80"}}
{"patient_id": 1009, "visit_time": "2024-01-01 10:09:00", "visit_type": "检查", "department": "检验科", "session_id": "lab_131", "medical_info": {"血糖": 5.6, "血脂": "正常"}}
{"patient_id": 1010, "visit_time": "2024-01-01 10:10:00", "visit_type": "治疗", "department": "药房", "session_id": "pharmacy_132", "medical_info": {"药费": 299.99, "药品数量": 3}};

-- 处理复杂嵌套的医疗设备数据
CREATE TABLE medical_device_data (
    device_id UInt64,                  -- 设备编号
    timestamp DateTime,               -- 数据时间戳
    patient_info JSON,               -- 患者信息：{id, name, age, room}
    device_info JSON,                -- 设备信息：{type, model, location}
    vital_signs JSON                 -- 生命体征：{heart_rate, blood_pressure, temperature}
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (device_id, timestamp);

-- 导入复杂医疗设备JSON数据
INSERT INTO medical_device_data FORMAT JSONEachRow
{"device_id": 1001, "timestamp": "2024-01-01 10:00:00", "patient_info": {"id": 2001, "name": "张三", "age": 45, "room": "ICU-01"}, "device_info": {"type": "心电监护仪", "model": "ECG-2024", "location": "ICU"}, "vital_signs": {"heart_rate": 72, "blood_pressure": "118/75", "temperature": 36.8}}
{"device_id": 1002, "timestamp": "2024-01-01 10:01:00", "patient_info": {"id": 2002, "name": "李四", "age": 32, "room": "ICU-02"}, "device_info": {"type": "呼吸机", "model": "VENT-2024", "location": "ICU"}, "vital_signs": {"respiratory_rate": 16, "oxygen_saturation": 98, "airway_pressure": 12}};

-- 从JSON中提取特定字段进行查询
SELECT 
    device_id,
    timestamp,
    JSONExtractString(toJSONString(patient_info), 'name') as patient_name,
    JSONExtractUInt(toJSONString(patient_info), 'age') as patient_age,
    JSONExtractString(toJSONString(device_info), 'type') as device_type,
    JSONExtractInt(toJSONString(vital_signs), 'heart_rate') as heart_rate
FROM medical_device_data
WHERE timestamp >= '2024-01-01 10:00:00'
LIMIT 5;
```

> [!info] 💡 JSON数据处理技巧
> **JSON导入优化建议**：
> - **数据验证**：导入前验证JSON格式是否正确
> - **字段映射**：确保JSON字段名与表结构匹配
> - **数据类型**：注意JSON中的数值类型转换
> - **嵌套查询**：善用JSONExtract函数处理嵌套数据

#### Parquet和其他格式

```sql
-- Parquet格式导入（高效的列式格式）
-- 需要先生成或获取Parquet文件，然后使用：
-- clickhouse-client --query="INSERT INTO user_events FORMAT Parquet" < /tmp/events.parquet

-- Avro格式导入
-- clickhouse-client --query="INSERT INTO user_events FORMAT Avro" < /tmp/events.avro

-- 原生ClickHouse格式（最高性能）
-- clickhouse-client --query="INSERT INTO user_events FORMAT Native" < /tmp/events.native

-- 查看支持的所有格式
SELECT name, is_input, is_output 
FROM system.formats 
WHERE is_input = 1
ORDER BY name;
```

## 🔄 实时数据流导入

### 1. Kafka集成

#### Kafka表引擎配置

```sql
-- 创建Kafka源表
CREATE TABLE kafka_events (
    user_id UInt64,
    event_time DateTime,
    event_type String,
    page_url String,
    session_id String,
    properties String
) ENGINE = Kafka
SETTINGS 
    kafka_broker_list = 'localhost:9092',
    kafka_topic_list = 'user_events',
    kafka_group_name = 'clickhouse_consumers',
    kafka_format = 'JSONEachRow',
    kafka_num_consumers = 3,
    kafka_max_block_size = 1048576,
    kafka_skip_broken_messages = 100;

-- 创建物化视图处理Kafka数据
CREATE MATERIALIZED VIEW kafka_to_events_mv TO user_events AS
SELECT 
    user_id,
    event_time,
    event_type,
    page_url,
    session_id,
    JSONExtractString(properties, 'device') as device,
    properties
FROM kafka_events;

-- 查看Kafka消费者状态；具体列及嵌套结构须按部署版本核对
SELECT *
FROM system.kafka_consumers
WHERE table LIKE 'kafka_%';
```

#### 高级Kafka配置

```sql
-- 带数据转换的Kafka处理
CREATE MATERIALIZED VIEW kafka_events_transformed_mv TO user_events AS
SELECT 
    user_id,
    parseDateTimeBestEffortOrNull(event_time_str) as event_time,
    event_type,
    page_url,
    session_id,
    CASE 
        WHEN JSONHas(properties, 'device') 
        THEN properties 
        ELSE '{"device": "unknown"}' 
    END as properties
FROM (
    SELECT 
        user_id,
        toString(event_time) as event_time_str,
        event_type,
        page_url,
        session_id,
        properties
    FROM kafka_events
)
WHERE event_time IS NOT NULL;

-- 错误处理和监控
CREATE TABLE kafka_errors (
    timestamp DateTime DEFAULT now(),
    error_message String,
    raw_data String,
    topic String
) ENGINE = MergeTree()
ORDER BY timestamp;

-- 已成功解析记录的业务异常筛选视图；不能捕获Kafka格式解析失败消息
CREATE MATERIALIZED VIEW kafka_errors_mv TO kafka_errors AS
SELECT 
    now() as timestamp,
    'Parsing error' as error_message,
    properties as raw_data,
    'user_events' as topic
FROM kafka_events
WHERE user_id = 0 OR event_time = '1970-01-01 00:00:00';
```

### 2. HTTP接口导入

#### 使用HTTP API导入

```bash
# 单条数据导入
curl -X POST 'http://localhost:8123/' \
  -H 'Content-Type: application/json' \
  -d 'INSERT INTO user_events FORMAT JSONEachRow {"user_id": 2001, "event_time": "2024-01-01 11:00:00", "event_type": "api_test", "page_url": "/api", "session_id": "api_session", "properties": "{}"}'

# 批量数据导入
curl -X POST 'http://localhost:8123/' \
  -H 'Content-Type: application/json' \
  -d @- << EOF
INSERT INTO user_events FORMAT JSONEachRow
{"user_id": 2002, "event_time": "2024-01-01 11:01:00", "event_type": "batch_test", "page_url": "/batch1", "session_id": "batch_session_1", "properties": "{}"}
{"user_id": 2003, "event_time": "2024-01-01 11:02:00", "event_type": "batch_test", "page_url": "/batch2", "session_id": "batch_session_2", "properties": "{}"}
EOF

# CSV格式导入
curl -X POST 'http://localhost:8123/?query=INSERT%20INTO%20user_events%20FORMAT%20CSV' \
  -H 'Content-Type: text/csv' \
  --data-binary @events.csv

# 流式导入（大文件）
curl -X POST 'http://localhost:8123/?query=INSERT%20INTO%20user_events%20FORMAT%20JSONEachRow' \
  -H 'Content-Type: application/x-ndjson' \
  -H 'Transfer-Encoding: chunked' \
  --data-binary @large_events.jsonl
```

#### HTTP导入优化

```sql
-- 设置HTTP导入参数
SET http_max_multipart_form_data_size = 1073741824; -- 1GB
SET max_http_get_redirects = 10;
SET input_format_skip_unknown_fields = 1;
SET input_format_import_nested_json = 1;

-- 异步HTTP导入
SET async_insert = 1;
SET wait_for_async_insert = 0;
SET async_insert_max_data_size = 10485760; -- 10MB
```

## 🔗 外部系统集成

### 1. MySQL集成

#### MySQL表引擎

```sql
-- 创建MySQL表引擎
CREATE TABLE mysql_users (
    id UInt32,
    name String,
    email String,
    created_at DateTime,
    updated_at DateTime
) ENGINE = MySQL('mysql_host:3306', 'database_name', 'users', 'username', 'password');

-- 从MySQL导入数据
INSERT INTO user_events
SELECT 
    id as user_id,
    created_at as event_time,
    'user_registered' as event_type,
    '/register' as page_url,
    concat('mysql_session_', toString(id)) as session_id,
    concat('{"email": "', email, '"}') as properties
FROM mysql_users
WHERE created_at >= '2024-01-01';

-- 插入触发视图示意：不会轮询MySQL，也不会自动捕获源库新增或更新
-- 实时同步须另行部署CDC；此视图不能替代CDC管道
CREATE MATERIALIZED VIEW mysql_sync_mv TO user_events AS
SELECT 
    id as user_id,
    updated_at as event_time,
    'profile_updated' as event_type,
    '/profile' as page_url,
    concat('mysql_update_', toString(id)) as session_id,
    concat('{"action": "profile_update", "email": "', email, '"}') as properties
FROM mysql_users;
```

#### PostgreSQL集成

```sql
-- PostgreSQL表引擎
CREATE TABLE postgres_orders (
    order_id UInt64,
    user_id UInt64,
    amount Decimal(10,2),
    order_date DateTime,
    status String
) ENGINE = PostgreSQL('postgres_host:5432', 'database_name', 'orders', 'username', 'password');

-- 订单数据同步
INSERT INTO user_events
SELECT 
    user_id,
    order_date as event_time,
    'order_placed' as event_type,
    '/checkout' as page_url,
    concat('order_', toString(order_id)) as session_id,
    concat('{"order_id": ', toString(order_id), ', "amount": ', toString(amount), ', "status": "', status, '"}') as properties
FROM postgres_orders
WHERE order_date >= today() - 1;
```

### 2. URL和S3集成

#### 从URL导入数据

```sql
-- 从HTTP URL导入
INSERT INTO user_events
SELECT *
FROM url('https://example.com/events.csv', 'CSV', 
    'user_id UInt64, event_time DateTime, event_type String, page_url String, session_id String, properties String');

-- 从S3导入数据
INSERT INTO user_events
SELECT *
FROM s3('https://my-bucket.s3.amazonaws.com/events/*.parquet', 
    'access_key_id', 'secret_access_key', 'Parquet',
    'user_id UInt64, event_time DateTime, event_type String, page_url String, session_id String, properties String');

-- 分批处理S3数据
INSERT INTO user_events
SELECT *
FROM s3Cluster('cluster_name', 'https://my-bucket.s3.amazonaws.com/events/year=2024/month=01/*.parquet',
    'access_key_id', 'secret_access_key', 'Parquet');
```

### 3. 文件系统集成

```sql
-- 从本地文件系统导入
INSERT INTO user_events
SELECT *
FROM file('/data/events/*.csv', 'CSV');

-- 使用glob模式
INSERT INTO user_events
SELECT *
FROM file('/data/events/2024/01/*/events.jsonl', 'JSONEachRow');

-- HDFS集成
INSERT INTO user_events
SELECT *
FROM hdfs('hdfs://namenode:9000/data/events/*.parquet', 'Parquet');
```

## 📤 数据导出方法

### 1. 基础查询导出

```sql
-- 导出为CSV格式
SELECT user_id, event_time, event_type, page_url
FROM user_events
WHERE event_time >= '2024-01-01'
FORMAT CSV;

-- 导出为JSON格式
SELECT user_id, event_time, event_type, properties
FROM user_events
WHERE event_type = 'purchase'
FORMAT JSONEachRow;

-- 导出为Parquet（高效压缩）
SELECT *
FROM user_events
WHERE toYYYYMM(event_time) = 202401
FORMAT Parquet;

-- 导出为原生格式（最快）
SELECT *
FROM user_events
WHERE user_id IN (1001, 1002, 1003)
FORMAT Native;
```

### 2. 命令行导出

```bash
# 导出到CSV文件
clickhouse-client --query="SELECT * FROM user_events FORMAT CSV" > events.csv

# 导出到JSON Lines文件
clickhouse-client --query="SELECT * FROM user_events FORMAT JSONEachRow" > events.jsonl

# 压缩导出
clickhouse-client --query="SELECT * FROM user_events FORMAT CSV" | gzip > events.csv.gz

# 分页导出大数据集
clickhouse-client --query="SELECT * FROM user_events ORDER BY event_time LIMIT 1000000 OFFSET 0 FORMAT CSV" > events_part1.csv
clickhouse-client --query="SELECT * FROM user_events ORDER BY event_time LIMIT 1000000 OFFSET 1000000 FORMAT CSV" > events_part2.csv

# 条件导出
clickhouse-client --query="SELECT * FROM user_events WHERE event_time >= '2024-01-01' AND event_type = 'purchase' FORMAT JSONEachRow" > purchases.jsonl
```

### 3. HTTP API导出

```bash
# HTTP导出
curl "http://localhost:8123/?query=SELECT * FROM user_events FORMAT CSV" > events.csv

# 带参数的导出
curl "http://localhost:8123/" -d "SELECT user_id, count() as events FROM user_events GROUP BY user_id FORMAT TabSeparated" > user_stats.tsv

# 流式导出（大数据量）
curl "http://localhost:8123/" -d "SELECT * FROM user_events FORMAT JSONEachRow" --output events_stream.jsonl

# 导出到S3
curl "http://localhost:8123/" -d "INSERT INTO FUNCTION s3('https://my-bucket.s3.amazonaws.com/export/events.parquet', 'access_key', 'secret_key', 'Parquet') SELECT * FROM user_events"
```

## ⚡ 性能优化技巧

### 1. 批量导入优化

```sql
-- 优化导入性能的设置
SET max_insert_block_size = 1048576;    -- 行数设置，不是每块1MB；实际分块取决于导入方式
SET min_insert_block_size_rows = 262144; -- 256K rows per block
SET min_insert_block_size_bytes = 268435456; -- 256MB per block
SET max_insert_threads = 8;             -- 并行线程数
SET max_block_size = 65536;             -- 处理块大小

-- 不要求副本quorum确认（仅相关复制表适用，不等于禁用同步写入）
-- 是否采用须按一致性要求决定；quorum未启用时，其超时值不提供保护
SET insert_quorum = 0;
SET insert_quorum_timeout = 0;

-- 异步插入设置
SET async_insert = 1;
SET wait_for_async_insert = 0;
SET async_insert_max_data_size = 104857600; -- 100MB
SET async_insert_busy_timeout_ms = 200;

-- 内存表缓冲（适用于小数据量高频写入）
CREATE TABLE user_events_buffer AS user_events
ENGINE = Buffer(default, user_events, 16, 10, 100, 10000, 1000000, 10000000, 100000000);
```

### 2. 数据格式优化

```sql
-- 使用最高效的数据格式
-- 1. Native格式 - ClickHouse原生二进制格式，也可由兼容客户端读写；是否最快须按数据和链路压测
-- 2. Parquet格式 - 压缩效率高，通用性好
-- 3. Arrow格式 - 内存效率高
-- 4. RowBinary格式 - 紧凑的二进制格式

-- 压缩优化
SET output_format_parquet_compression_method = 'snappy'; -- 快速压缩
-- SET output_format_parquet_compression_method = 'gzip';   -- 高压缩比

-- JSON导入优化
SET input_format_import_nested_json = 1;
SET input_format_skip_unknown_fields = 1;
SET input_format_with_names_use_header = 1;
```

### 3. 网络和存储优化

```sql
-- 网络传输优化
SET network_compression_method = 'lz4';
SET network_zstd_compression_level = 1;

-- 并发控制
SET max_concurrent_queries_for_user = 10;
SET max_memory_usage_for_user = 20000000000; -- 20GB

-- 磁盘I/O优化
SET max_bytes_before_external_group_by = 20000000000; -- 20GB
SET max_bytes_before_external_sort = 20000000000;     -- 20GB

-- 查看导入性能指标
SELECT 
    query,
    event_time,
    query_duration_ms,
    read_rows,
    read_bytes,
    written_rows,
    written_bytes,
    memory_usage
FROM system.query_log
WHERE type = 'QueryFinish' 
  AND query LIKE '%INSERT INTO user_events%'
ORDER BY event_time DESC
LIMIT 10;
```

## 🔄 数据备份和恢复

### 1. 数据备份

```sql
-- 全表备份
CREATE TABLE user_events_backup AS user_events;
INSERT INTO user_events_backup SELECT * FROM user_events;

-- 按事件时间水位追加的简化增量备份示例：会遗漏迟到记录及等于当前最大时间戳的新记录，也不捕获更新或删除；空备份表的初始水位须另行处理，不能视为完整增量备份
INSERT INTO user_events_backup 
SELECT * FROM user_events 
WHERE event_time > (SELECT max(event_time) FROM user_events_backup);

-- 分区备份
ALTER TABLE user_events FREEZE PARTITION '202401';

-- 导出备份到文件
SELECT * FROM user_events
INTO OUTFILE '/backup/user_events_20240101.csv'
FORMAT CSV;

-- S3备份
INSERT INTO FUNCTION s3('https://backup-bucket.s3.amazonaws.com/clickhouse/user_events/backup.parquet',
    'access_key', 'secret_key', 'Parquet')
SELECT * FROM user_events;
```

### 2. 数据恢复

```sql
-- 从备份表恢复
INSERT INTO user_events SELECT * FROM user_events_backup;

-- 从文件恢复
INSERT INTO user_events
SELECT * FROM file('/backup/user_events_20240101.csv', 'CSV');

-- 从S3恢复
INSERT INTO user_events
SELECT * FROM s3('https://backup-bucket.s3.amazonaws.com/clickhouse/user_events/backup.parquet',
    'access_key', 'secret_key', 'Parquet');

-- 从兼容备份表附加分区；须先确认该表包含202401分区及兼容结构
ALTER TABLE user_events ATTACH PARTITION '202401' FROM user_events_backup;
-- 原示例路径/backup/partition_202401不能直接用于FROM；FREEZE快照恢复须按部署版本把分区部件放入目标表detached目录，再执行ATTACH PARTITION
```

## 🚨 错误处理和监控

### 1. 错误处理策略

```sql
-- 创建错误日志表
CREATE TABLE import_errors (
    timestamp DateTime DEFAULT now(),
    source_system String,
    error_type String,
    error_message String,
    failed_data String,
    retry_count UInt8 DEFAULT 0
) ENGINE = MergeTree()
ORDER BY timestamp;

-- 容错导入设置
SET input_format_allow_errors_num = 100;
SET input_format_allow_errors_ratio = 0.01; -- 1%错误率

-- 跳过损坏的消息：Kafka表引擎设置，不是会话SET；可能造成数据遗漏
ALTER TABLE kafka_events MODIFY SETTING kafka_skip_broken_messages = 1000;

-- 数据验证
INSERT INTO user_events
SELECT 
    user_id,
    event_time,
    event_type,
    page_url,
    session_id,
    properties
FROM (
    SELECT 
        user_id,
        event_time,
        event_type,
        page_url,
        session_id,
        properties
    FROM input('user_id UInt64, event_time DateTime, event_type String, page_url String, session_id String, properties String')

)
WHERE user_id > 0 
  AND event_time >= '2000-01-01' 
  AND event_time <= now() + INTERVAL 1 DAY
FORMAT CSV;
-- 执行时须另行提供CSV数据流，例如通过clickhouse-client --query传入上述查询并从标准输入读取数据
```

### 2. 性能监控

```sql
-- 监控导入性能
SELECT 
    toStartOfMinute(event_time) as minute,
    sum(read_rows) as total_rows_read,
    sum(written_rows) as total_rows_written,
    avg(query_duration_ms) as avg_duration_ms,
    sum(memory_usage) as total_memory_used
FROM system.query_log
WHERE type = 'QueryFinish'
  AND query LIKE '%INSERT INTO%'
  AND event_time >= now() - INTERVAL 1 HOUR
GROUP BY minute
ORDER BY minute;

-- Kafka消费监控：先查看消费者的实际字段与分区信息
-- topic/partition/offset并非这里可直接假定存在的顶层列
SELECT *
FROM system.kafka_consumers
WHERE table = 'kafka_events';

-- 系统资源监控
SELECT 
    metric,
    value,
    description
FROM system.asynchronous_metrics
WHERE metric LIKE '%Insert%' OR metric LIKE '%Memory%'
ORDER BY metric;
```

## 🎯 最佳实践总结

### 1. 导入最佳实践

> [!info] 💡 导入优化建议
> 
> **批量大小**：
> - 原稿的单次100万-1000万行仅为未验证的压测候选范围，不保证最佳；应按行宽、内存、分区数和延迟目标调整
> - 避免过于频繁的小批量插入
> 
> **数据格式**：
> - 优先使用Parquet或Native格式
> - JSON适合灵活性，CSV适合简单数据
> 
> **并发控制**：
> - 合理设置插入线程数
> - 避免过多并发导致资源竞争
> 
> **错误处理**：
> - 设置合理的错误容忍度
> - 建立完善的错误监控和重试机制

### 2. 实时流处理建议

```sql
-- 实时流处理架构示例
-- 1. Kafka作为消息队列
-- 2. ClickHouse Kafka引擎消费
-- 3. 物化视图进行数据转换
-- 4. 目标表存储最终数据

-- 监控实时流处理健康状态
CREATE VIEW stream_health AS
SELECT 
    'kafka_consumer_entries' as metric,
    count() as value
FROM system.kafka_consumers
WHERE table = 'kafka_events'
-- 此项仅统计消费者条目，不代表消费延迟；lag须结合Kafka分区末端offset与消费offset计算

UNION ALL

SELECT 
    'materialized_view_rows' as metric,
    count() as value
FROM user_events
WHERE event_time >= now() - INTERVAL 5 MINUTE;
```

## 🎯 数据导入导出总结

通过本章节的学习，我们掌握了：

1. **多种导入方法** - INSERT语句、文件导入、实时流处理
2. **外部系统集成** - MySQL、PostgreSQL、Kafka、S3等
3. **格式处理技巧** - CSV、JSON、Parquet、Native等格式
4. **性能优化策略** - 批量大小、并发控制、压缩优化
5. **错误处理机制** - 容错设置、监控告警、数据验证

> [!abstract] 📚 下一步学习
> 现在你已经掌握了ClickHouse数据导入导出的各种方法，接下来我们将学习07-ClickHouse查询优化|ClickHouse查询优化，了解如何提升查询性能和优化存储效率。

## 🔗 相关资源

- [[【技术与工具】/ClickHouse/05-ClickHouse SQL语法基础|ClickHouse SQL语法]]
- [[【技术与工具】/ClickHouse/00-ClickHouse学习路线图|ClickHouse]]
- [[【技术与工具】/Kafka/00-Kafka学习路线图|Kafka]] - 实时数据流处理

---

> 💡 **记住**：**数据导入导出是ClickHouse应用的关键环节**。选择合适的导入方法和格式，**能够大大提升系统性能和稳定性**。在生产环境中，重点关注错误处理、性能监控和数据一致性，并通过故障测试、对账和恢复演练验证数据管道的可靠性；这些措施本身不构成稳定可靠的保证。