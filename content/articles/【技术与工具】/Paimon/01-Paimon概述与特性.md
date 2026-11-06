---
title: Paimon概述与特性 - 新一代流式数据湖
tags:
  - Paimon
  - 数据湖
  - 流批一体
  - 技术选型
created: 2024-12-04
updated: 2026-10-10
difficulty: 中级
duration: 15分钟
knowledge_type: concept
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据分析师
  - BI分析师
stability: slow-changing
status: maintenance
access_tier: free
---


# 🌊 Paimon概述与特性 - 新一代流式数据湖

> [!abstract] 📋 本节概览
> - 🎯 **学习目标**:理解Apache Paimon是什么,为什么需要它
> - 📚 **前置知识**:了解基本的数据湖概念
> - ⏱️ **预计用时**:15分钟
> - 🔧 **核心内容**:数据湖演进、Paimon定位、核心特性
> - 💡 **关键收获**:明白Paimon在现代数据架构中的价值

## 🎯 什么是Apache Paimon

### 📖 定义

Apache Paimon(原名Flink Table Store)是一个**流式数据湖存储系统**,专为流批一体化数据处理设计。它是Apache软件基金会的顶级项目,由阿里巴巴开源并贡献给社区。

**生活化理解**:就像智能仓库系统
- **传统数据湖**:像普通仓库,货物堆放整齐,但找东西要翻箱倒柜
- **传统数据库**:像便利店,东西好找但容量有限,存储成本高
- **Paimon**:像智能仓库,既有大容量,又能快速定位,还支持实时补货

### 🌐 项目背景

**诞生时间**:2022年作为Flink Table Store发布,2023年捐献给Apache基金会并更名为Paimon

**核心团队**:阿里巴巴大数据团队,拥有丰富的大规模数据处理经验

**应用场景**:阿里巴巴内部广泛使用,支撑电商、物流、金融等多个核心业务

## 🤔 为什么需要Paimon

### 📊 数据湖技术演进

让我们看看数据存储技术的演进历程:

**第一代:传统数据仓库** (2000年代)
```text
特点:结构化存储,SQL查询
问题:
- 存储成本高 💰
- 扩展性差 📊
- 不支持非结构化数据 ❌
```

**第二代:Hadoop数据湖** (2010年代)
```text
特点:海量存储,批处理为主
问题:
- 实时性差 ⏰
- 数据质量难保证 ⚠️
- 小文件问题严重 📁
```

**第三代:云原生数据湖** (2015-2020)
```text
代表:Apache Hudi, Iceberg, Delta Lake
特点:ACID事务,Schema演进
问题:
- 流批割裂,需要两套处理逻辑 🔀
- 实时更新性能有限 ⚡
```

**第四代:流式数据湖** (2020年至今)
```text
代表:Apache Paimon
特点:流批一体,实时ACID,高性能
优势:
- 同一份数据支持流批查询 ✅
- 支持低延迟数据更新；若以毫秒级为目标，需在具体提交配置、负载和存储环境下验证 ⚡
- 原生支持变更数据捕获(CDC) 🔄
```

### 🎯 业务痛点

**场景1:电商实时数仓**

小王负责电商公司的数据平台,面临这样的问题:
- **批处理数仓**:T+1延迟,业务看不到实时销售数据
- **实时数据库**:成本太高,无法存储海量历史数据
- **传统数据湖**:查询慢,无法支持实时更新

**Paimon解决方案**:
```text
✅ 实时写入销售数据；秒级可见可作为场景目标，需结合提交配置、负载和存储环境验证
✅ 支持海量历史数据存储,成本可控
✅ 同时支持实时大屏和离线分析
```

**场景2:用户画像更新**

数据分析师小李需要维护用户画像表:
- 每天有数百万用户行为数据需要更新
- 需要支持按用户ID更新(UPSERT)
- 下游系统既要批量读取,又要实时订阅变更

**Paimon解决方案**:
```text
✅ 主键表支持高效的UPSERT操作
✅ 支持增量读取,下游实时感知变更
✅ 批量查询性能优异,支持大规模分析
```

## 🌟 Paimon核心特性

### 1️⃣ 流批一体架构

**专业定义**:Paimon采用统一的存储格式,同一份数据可以同时被流式和批量计算引擎读取,无需数据复制和转换。

**技术实现**:
- **统一存储格式**:基于Parquet/ORC列式存储
- **双模式读取**:支持批量扫描和流式订阅
- **增量快照**:新数据自动形成增量快照,流式消费

**生活化理解**:就像多媒体播放器
- **传统方式**:视频文件和音频文件分开存储
- **Paimon方式**:同一个文件,既能看视频也能只听音频
- **优势**:节省存储空间,避免数据不一致

**代码示例**:
```sql
-- 同一张表,批量查询
SELECT user_id, COUNT(*) FROM user_behavior GROUP BY user_id;

-- 同一张表,流式订阅
SELECT * FROM user_behavior /*+ OPTIONS('scan.mode'='latest') */;
```

### 2️⃣ ACID事务保证

**专业定义**:Paimon提供完整的ACID事务支持,保证数据操作的原子性、一致性、隔离性和持久性。

**关键特性**:
- **主键约束**:支持按主键更新和删除
- **快照隔离**:每次提交生成新快照,读写互不影响
- **乐观并发**:多个写入任务可以并发执行
- **自动合并**:后台自动合并小文件,优化查询性能

**生活化理解**:就像银行转账系统
- **原子性**:转账要么成功,要么失败,不会出现中间状态
- **一致性**:账户总金额始终保持平衡
- **隔离性**:你的转账不会影响他人查询余额
- **持久性**:交易完成后数据永久保存

**使用场景**:
```text
用户画像表:需要按user_id更新用户属性
订单明细表:需要修正错误订单数据
库存管理表:需要实时更新商品库存
```

### 3️⃣ 高性能LSM存储

**专业定义**:Paimon主键表采用LSM(Log-Structured Merge-tree)存储架构,适合处理持续写入和更新,并通过合并策略优化读取；实际查询性能取决于表配置、合并进度、数据分布和查询负载。

**存储结构**:
```text
写入路径:
新数据 → 内存缓冲 → Level0文件 → 后台合并 → Level1+文件

查询路径:
查询请求 → 文件过滤 → 数据扫描 → 结果合并 → 返回结果
```

**性能优势**:
- **高吞吐写入**:顺序写入,无需随机更新
- **智能合并**:多种合并策略,平衡性能和成本
- **文件裁剪**:通过分区、主键索引快速定位数据
- **向量化读取**:批量读取,充分利用CPU缓存

**生活化理解**:就像图书馆管理系统
- **新书上架**:先放在新书区(Level0),方便快速入库
- **定期整理**:定期将新书归类到对应书架(合并到Level1+)
- **快速查找**:通过索引卡片快速定位图书位置
- **批量借阅**:一次取出一整排书,提高效率

### 4️⃣ 丰富的表类型

**主键表(Primary Key Table)**:
```sql
-- 创建主键表,支持UPDATE/DELETE
CREATE TABLE user_info (
    user_id BIGINT,
    name STRING,
    age INT,
    city STRING,
    PRIMARY KEY (user_id) NOT ENFORCED
) WITH (
    'bucket' = '8'
);
```

**特点**:
- 支持UPSERT语义:相同主键的数据会自动合并
- 支持DELETE:可以删除指定主键的数据
- 适用场景:维度表、用户画像、CDC同步

**仅追加表(Append-Only Table)**:
```sql
-- 创建仅追加表,只支持INSERT
CREATE TABLE user_behavior (
    user_id BIGINT,
    action STRING,
    timestamp BIGINT,
    dt STRING
) PARTITIONED BY (dt);
```

**特点**:
- 只支持INSERT操作
- 写入性能更高
- 适用场景:日志数据、事件流、明细数据

**生活化理解**:
- **主键表**:像通讯录,可以修改联系人信息
- **仅追加表**:像聊天记录,只能追加新消息

### 5️⃣ 生态集成

**与[[【技术与工具】/Flink/00-Flink学习路线图|Flink]]深度集成**:
```java
// Flink Table API读写Paimon
TableEnvironment tEnv = TableEnvironment.create(settings);

// 写入Paimon
tEnv.executeSql("INSERT INTO paimon_table SELECT * FROM source");

// 流式读取Paimon
Table result = tEnv.sqlQuery(
    "SELECT * FROM paimon_table /*+ OPTIONS('scan.mode'='latest') */"
);
```

**与[[【技术与工具】/Spark/00-Spark学习路线图|Spark]]集成**:
```scala
// Spark批量处理Paimon数据
spark.sql("SELECT * FROM paimon_catalog.db.table WHERE dt='2024-01-01'")
```

**与Hive兼容**:
```sql
-- Hive可以直接查询Paimon表
SELECT * FROM paimon_table WHERE dt='2024-01-01';
```

## 🆚 Paimon vs 其他数据湖方案

### 📊 技术对比

| 特性维度        | Paimon | Iceberg | Hudi   | Delta Lake |
| ----------- | ------ | ------- | ------ | ---------- |
| **流式更新延迟**  | 毫秒级 ⚡  | 秒级      | 秒级     | 秒级         |
| **主键更新性能**  | 优秀 ✅   | 一般      | 优秀     | 良好         |
| **流批一体**    | 原生支持   | 需要额外组件  | 需要额外组件 | 需要额外组件     |
| **Flink集成** | 深度集成   | 基础支持    | 基础支持   | 基础支持       |
| **小文件问题**   | 自动合并   | 手动触发    | 自动合并   | 自动合并       |
| **生态成熟度**   | 快速发展   | 成熟      | 成熟     | 成熟         |

### 🎯 选择Paimon的最佳场景

**强烈推荐Paimon的场景**:
- ✅ **实时数仓**:需要秒级数据更新和查询
- ✅ **CDC同步**:需要将数据库变更实时同步到数据湖
- ✅ **用户画像**:需要高频更新用户属性
- ✅ **流批一体**:同一份数据支持流批处理
- ✅ **Flink生态**:已经使用Flink作为计算引擎

**考虑其他方案的场景**:
- Iceberg:需要多引擎支持,对流式处理要求不高
- Hudi:重度使用Spark生态
- Delta Lake:重度使用Databricks平台

## 🚀 快速开始

### 💡 第一个Paimon示例

```sql
-- 1. 创建Catalog
CREATE CATALOG paimon_catalog WITH (
    'type' = 'paimon',
    'warehouse' = 'file:///tmp/paimon'
);

USE CATALOG paimon_catalog;

-- 2. 创建数据库
CREATE DATABASE IF NOT EXISTS my_db;
USE my_db;

-- 3. 创建表
CREATE TABLE user_behavior (
    user_id BIGINT,
    item_id BIGINT,
    behavior STRING,
    ts TIMESTAMP(3),
    PRIMARY KEY (user_id, item_id) NOT ENFORCED
);

-- 4. 插入数据
INSERT INTO user_behavior VALUES
    (1001, 2001, 'click', TIMESTAMP '2024-01-01 10:00:00'),
    (1002, 2002, 'purchase', TIMESTAMP '2024-01-01 10:05:00');

-- 5. 查询数据
SELECT * FROM user_behavior;
```

### 🎯 核心价值总结

> [!success] Paimon的三大核心价值
> 1. **统一存储**:一份数据,流批共享,降低存储和维护成本
> 2. **实时更新**:支持高频数据变更；毫秒级延迟只能作为待验证目标，实际延迟取决于提交配置、负载和存储环境
> 3. **简化架构**:减少数据搬运和ETL,加速数据流转

---

## 📋 本节要点回顾

### ✅ 核心知识点检查
- [ ] 理解Paimon是什么,解决什么问题
- [ ] 掌握数据湖技术的演进历程
- [ ] 了解Paimon的五大核心特性
- [ ] 明白Paimon与其他数据湖方案的区别
- [ ] 知道何时选择Paimon

### 🔗 学习路径连接
**当前位置**:✅ 01-Paimon概述
**下一步**:[[【技术与工具】/Paimon/02-Paimon核心概念|Paimon核心概念]] - 深入理解表、快照、文件等核心概念

> [!tip] 学习建议
> Paimon是一个快速发展的项目,建议关注官方文档获取最新特性。学习时结合实际业务场景,理解技术选型的业务价值。

---

**创建时间**:2024-12-04
**最后更新**:2024-12-04
**学习时长**:15分钟
**难度等级**:⭐ (初级)

#Paimon #数据湖 #流批一体 #技术选型 #实时数仓
