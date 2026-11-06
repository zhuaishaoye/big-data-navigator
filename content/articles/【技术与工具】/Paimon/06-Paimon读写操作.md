---
title: Paimon读写操作 - SQL与API实战
tags:
  - Paimon
  - SQL
  - 读写操作
  - 流式读写
  - Time Travel
created: 2024-12-05
updated: 2026-10-10
difficulty: 中级
duration: 25分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
stability: slow-changing
status: maintenance
access_tier: free
---


# 📝 Paimon读写操作 - SQL与API实战

> [!abstract] 📋 本节概览
> - 🎯 **学习目标**:掌握Paimon的批量与流式读写操作
> - 📚 **前置知识**:[[【技术与工具】/Paimon/05-Paimon表类型详解|Paimon表类型详解]]
> - ⏱️ **预计用时**:25分钟
> - 🔧 **核心内容**:INSERT语句、流式查询、Time Travel、Consumer ID
> - 💡 **关键收获**:能够熟练进行数据的写入、查询和历史回溯

## 🎯 统一的读写体验

Paimon最强大的特性之一是**流批一体**的读写体验。
- **写入端**：支持批处理写入（历史数据初始化）和流处理写入（实时数据同步）。
- **读取端**：支持快照查询（Batch Read）和流式查询（Streaming Read）。

---

## ✍️ 数据写入操作 (Write)

### 1. 标准写入 (INSERT INTO)

这是最基础的写入方式，适用于初始化数据或追加少量数据。

```sql
-- 插入具体数值
INSERT INTO user_profile 
VALUES (1, 'Alice', 25, '2024-01-01 10:00:00');

-- 从其他表查询插入 (Batch ETL常用)
INSERT INTO user_profile
SELECT id, name, age, now() 
FROM source_table 
WHERE dt = '2024-01-01';
```

### 2. 覆写分区 (INSERT OVERWRITE)

**适用场景**：重跑数据、修正历史分区数据。
**注意**：`INSERT OVERWRITE` 会删除指定分区内的**所有**旧数据，然后写入新数据。

```sql
-- 覆写 dt='2024-01-01' 分区的所有数据
INSERT OVERWRITE user_profile PARTITION (dt = '2024-01-01')
SELECT id, name, age, update_time 
FROM source_table 
WHERE dt = '2024-01-01';

-- 动态覆写示意：仅在所用引擎及配置支持并启用动态分区覆写时，按SELECT结果涉及的分区覆写；执行前须确认实际范围
INSERT OVERWRITE user_profile
SELECT * FROM source_table;
```

### 3. 流式写入 (Streaming Write)

在Flink流式执行模式下，可将Kafka等流式源持续写入Paimon；运行还需要正确配置源表、Paimon目标表及任务提交机制，不能仅凭源类型确定执行模式。

```sql
-- Flink SQL Job
-- 从Kafka读取JSON数据，实时写入Paimon
INSERT INTO paimon_user_log
SELECT 
    user_id, 
    event_type, 
    PROCTIME() 
FROM kafka_source;
```

---

## 📖 数据读取操作 (Read)

### 1. 批量/快照查询 (Batch/Snapshot Query)

读取表在**当前时刻**的完整快照。这是默认的查询模式（在Spark或Flink Batch模式下）。

```sql
-- 查询当前最新状态
SELECT * FROM user_profile WHERE age > 20;
```

### 2. 流式查询 (Streaming Query)

实时订阅表的变更。当新数据写入Paimon时，查询会自动输出新数据。

**如何开启**：先确保Flink SQL使用流式执行模式，再通过Hints或表配置指定Paimon扫描方式；扫描参数本身不会将批执行模式切换为流式执行模式。

```sql
-- 方法1: 使用Hints指定流读模式 (推荐)
-- 'scan.mode'='latest': 从当前最新数据开始读(只读增量)
SELECT * FROM user_profile /*+ OPTIONS('scan.mode'='latest') */;

-- 方法2: 读取全量快照后，自动切换为增量流读
-- 'scan.mode'='from-snapshot-full': 先读历史全量，再读后续增量
SELECT * FROM user_profile /*+ OPTIONS('scan.mode'='from-snapshot-full') */;
```

### 3. 时间旅行 (Time Travel)

Paimon支持查询历史版本的数据，这对于排查问题、回溯历史状态非常有用。

**语法支持**：
- **按快照ID** (`scan.snapshot-id`)
- **按时间点** (`scan.timestamp-millis`)
- **按Tag** (`scan.tag-name`)

```sql
-- 1. 查询快照ID为 10 的数据版本
SELECT * FROM user_profile /*+ OPTIONS('scan.snapshot-id'='10') */;

-- 2. 查询北京时间（UTC+08:00）2024-01-01 12:00:00 对应的历史状态，前提是相关快照仍可用
SELECT * FROM user_profile /*+ OPTIONS('scan.timestamp-millis'='1704081600000') */;

-- 3. 查询标记为 'release-v1' 的版本
SELECT * FROM user_profile /*+ OPTIONS('scan.tag-name'='release-v1') */;
```

> [!tip] 如何获取快照ID?
> 执行 `SELECT * FROM table_name$snapshots;` 即可查看所有可用的快照历史。

---

## 🎮 进阶特性: Consumer ID (消费进度管理)

在流式消费Paimon时，如果任务重启，如何确保不重读、不漏读？
Paimon提供了类似Kafka Group ID的机制，称为 `consumer-id`。

**作用**：
- 记录消费进度（Offset）。
- 在消费进度已有效提交、消费者未过期且所需快照仍可用等条件下，重启时可利用记录的进度恢复消费。
- **参与快照保留**：有效消费者记录可参与相关快照的保留；消费者过期后不能保证所需快照继续保留，也不能据此保证端到端不重不漏。

```sql
SELECT * FROM user_profile /*+ OPTIONS(
    'consumer-id' = 'app_group_1',  -- 消费者组ID
    'consumer.expiration-time' = '24 h' -- 如果24小时无消费，进度失效
) */;
```

---

## ⚙️ 常用查询参数速查 (Options)

| 参数名 (`/*+ OPTIONS(...) */`) | 可选值 | 说明 | 适用场景 |
|---|---|---|---|
| `scan.mode` | `latest` | 只读最新增量 | 实时监控、报警 |
| | `from-snapshot` | 从指定快照开始读 | 断点续传 |
| | `from-snapshot-full` | 全量快照 + 增量流 | 实时数仓分层计算 |
| `scan.snapshot-id` | Long (e.g., 10) | 指定读取的快照ID | Time Travel |
| `scan.timestamp-millis` | Long (Unix ms) | 指定读取的时间点 | Time Travel |
| `consumer-id` | String | 消费者唯一标识 | 需要消费进度管理与相关快照保留的流读场景 |

---

## 🧪 动手实践：流批一体体验

假设你已经配置好了Flink SQL Client。

**步骤1：创建表**
```sql
CREATE TABLE orders (
    order_id BIGINT PRIMARY KEY NOT ENFORCED,
    amount DECIMAL(10,2)
);
```

**步骤2：开启一个流式查询窗口**
```sql
-- 窗口1：实时监控订单
SELECT * FROM orders /*+ OPTIONS('scan.mode'='from-snapshot-full') */;
-- 此时没有输出，处于等待状态
```

**步骤3：在另一个窗口写入数据**
```sql
-- 窗口2：写入数据
INSERT INTO orders VALUES (1, 100.00);
INSERT INTO orders VALUES (2, 200.00);
```

**预期结果**：在表配置和流式查询条件正确、写入提交成功且查询发现新快照后，窗口1可输出这两条数据；实际延迟取决于提交和扫描配置。

**步骤4：更新数据**
```sql
-- 窗口2：修改订单1的金额
INSERT INTO orders VALUES (1, 150.00);
```

**结果**：若当前版本、扫描方式及表的变更日志配置支持读取该更新，窗口1可观察到相应变更；是否包含旧值撤回或仅输出新值，取决于实际变更日志语义与查询结果呈现方式，不能仅由Flink显示模式确定。

---

## 📋 本节要点回顾

### ✅ 核心技能掌握检查
- [ ] 会使用 `INSERT INTO` 和 `INSERT OVERWRITE`
- [ ] 掌握 `scan.mode` 的几种关键模式 (`latest`, `from-snapshot-full`)
- [ ] 能够使用 Time Travel 查询历史数据
- [ ] 理解 `consumer-id` 在流式消费中的作用

### 🔗 学习路径连接
**已完成**：✅ 05-表类型详解 → ✅ 06-读写操作
**下一步**：[[【技术与工具】/Paimon/07-Paimon主键表管理|Paimon主键表管理]] - 深入学习主键表的CRUD和合并机制

> [!tip] 最佳实践
> 在生产环境进行流式读取时，**强烈建议**配置 `consumer-id`。在消费进度已有效提交、消费者未过期且所需快照仍可用等条件下，consumer-id可用于恢复消费位置并参与快照保留；它不能单独保证端到端不重不漏，也不能保证消费者过期后所需数据仍被保留。

---

**创建时间**:2024-12-05
**最后更新**:2024-12-05
**学习时长**:25分钟
**难度等级**:⭐⭐ (中级)

#Paimon #SQL #流批一体 #TimeTravel #ConsumerID
