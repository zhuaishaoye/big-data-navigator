---
title: 基于Paimon的实时数仓 - 架构设计与分层实战
tags:
  - Paimon
  - 实时数仓
  - 架构设计
  - ODS
  - DWD
  - Lakehouse
created: 2024-12-05
updated: 2026-10-10
difficulty: 高级
duration: 35分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
stability: slow-changing
status: maintenance
access_tier: free
---


# 🏗️ 基于Paimon的实时数仓 - 架构设计与分层实战

> [!abstract] 📋 本节概览
> - 🎯 **学习目标**:掌握基于Apache Paimon构建流批一体实时数仓的完整方法论
> - 📚 **前置知识**:[[【技术与工具】/Paimon/13-Paimon性能调优|Paimon性能调优]]
> - ⏱️ **预计用时**:35分钟
> - 🔧 **核心内容**:ODS/DWD/DWS分层设计、流式ETL、数据回溯
> - 💡 **关键收获**:学习以秒级响应、控制存储成本和支持历史修正为目标的现代数仓设计；实际效果取决于数据规模、部署资源和作业配置

## 🎯 架构演进：从Lambda到Lakehouse

### 传统痛点 (Lambda架构)
- **两条链路**：实时链路(Kafka+Flink+Redis) + 离线链路(Hive+Spark)。
- **逻辑割裂**：开发两套代码，口径难以对齐。
- **存储冗余**：数据存多份。

### Paimon解决方案 (Streaming Lakehouse)
- **统一存储**：所有分层数据(ODS, DWD, DWS)都存储在Paimon中。
- **流批一体**：Flink流式写入，Spark/Flink批量修正。
- **分层可见**：每一层数据都实时可见，下游可直接订阅。

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"PingFang SC, -apple-system, Source Han Serif SC, serif","fontSize":"16px","background":"#FDFBF5","primaryColor":"#FDFBF5","primaryTextColor":"#2D2A26","primaryBorderColor":"#6E6A60","secondaryColor":"#E8EFE8","secondaryBorderColor":"#8FA890","secondaryTextColor":"#2D2A26","tertiaryColor":"#FDFBF5","tertiaryBorderColor":"#9A9488","tertiaryTextColor":"#6E6A60","lineColor":"#6E6A60","textColor":"#2D2A26","mainBkg":"#FDFBF5","nodeBorder":"#2D5A3D","clusterBkg":"#F3EEDF","clusterBorder":"#9A9488","edgeLabelBackground":"#FDFBF5"},"flowchart":{"htmlLabels":true,"curve":"basis","padding":20,"nodeSpacing":60,"rankSpacing":70,"useMaxWidth":false},"themeCSS":".node rect, .node polygon, .node circle { stroke-width: 1.5px; } .edgePath .path { stroke-width: 1.5px; } .cluster-label .nodeLabel, .cluster-label foreignObject { color: #2D2A26 !important; } .edgeLabel, .edgeLabel foreignObject { color: #2D2A26 !important; background-color: #FDFBF5; } .edgeLabel rect { fill: #FDFBF5; }"}}%%
flowchart LR
    Source[MySQL/Logs] -->|CDC/Log| ODS[Paimon ODS]
    ODS -->|Flink ETL| DWD[Paimon DWD]
    DWD -->|Flink Agg| DWS[Paimon DWS]
    DWS -->|OLAP Query| BI[StarRocks/Trino]
    
    style ODS fill:#e1f5fe
    style DWD fill:#e1f5fe
    style DWS fill:#e1f5fe
```

---

## 🏭 数仓分层设计详解

### 1. ODS层 (Operational Data Store)
**目标**：1:1 镜像保留原始数据，不做处理。

**表类型**：
- **仅追加表 (Append-Only)**：适合日志数据，高吞吐。
- **主键表 (Primary Key)**：适合CDC数据，保持与MySQL一致。

**实战示例**：
```sql
-- ODS层：Nginx访问日志
CREATE TABLE ods_access_log (
    user_id BIGINT,
    url STRING,
    ts TIMESTAMP(3)
) WITH (
    'bucket' = '-1', -- 动态分桶，追求最大写入性能
    'kafka.topic' = 'nginx_logs' -- 如果使用Paimon Kafka集成
);
```

### 2. DWD层 (Data Warehouse Detail)
**目标**：数据清洗、维度补全(宽表化)、脱敏。

**关键技术**：
- **Lookup Join**：关联维表补全信息。
- **Partial Update**：多流拼接（如 订单主表 + 支付表 + 物流表 拼成一张宽表）。

**实战示例**：
```sql
-- DWD层：订单宽表
CREATE TABLE dwd_order_wide (
    order_id BIGINT PRIMARY KEY NOT ENFORCED,
    user_id BIGINT,
    user_name STRING,  -- 补全字段
    city STRING,       -- 补全字段
    amount DECIMAL(10,2),
    order_status STRING,
    pay_status STRING,
    update_time TIMESTAMP(3)
) WITH (
    'merge-engine' = 'partial-update', -- 支持多流更新
    'changelog-producer' = 'lookup'    -- 生成完整变更流给下游
);
```

### 3. DWS层 (Data Warehouse Service)
**目标**：轻度汇总，计算各维度的指标。

**关键技术**：
- **Aggregation Engine**：实时预聚合。

**实战示例**：
```sql
-- DWS层：城市粒度每日销售额
CREATE TABLE dws_city_sales_daily (
    dt STRING,
    city STRING,
    total_sales DECIMAL(20, 2),
    order_cnt BIGINT,
    PRIMARY KEY (dt, city) NOT ENFORCED
) WITH (
    'merge-engine' = 'aggregation',
    'fields.total_sales.aggregate-function' = 'sum',
    'fields.order_cnt.aggregate-function' = 'sum'
);
```

---

## 🔄 核心流程：流式ETL与回溯

### 1. 实时链路 (Streaming)
```sql
-- ODS -> DWD: 清洗并关联维表
INSERT INTO dwd_order_wide
SELECT 
    o.order_id, 
    o.user_id,
    u.name,
    u.city,
    o.amount,
    ...
FROM ods_orders o
LEFT JOIN dim_users FOR SYSTEM_TIME AS OF o.proc_time AS u
ON o.user_id = u.id;
```

### 2. 数据回溯 (Backfill/Correction)
当DWD层代码逻辑有误，或者维表数据修正了，需要重跑历史数据。

**传统方案**：清空Hive分区，重跑Spark任务。
**Paimon方案**：
- **方法A (流式重跑)**：指定 `scan.mode` = `from-snapshot` 从某个历史快照开始重新流读。
- **方法B (批式覆写)**：使用 Spark/Flink Batch 模式执行 `INSERT OVERWRITE`。

```sql
-- 批处理模式：修正 2024-01-01 的数据
SET 'execution.runtime-mode' = 'batch';

INSERT OVERWRITE dwd_order_wide PARTITION (dt='2024-01-01')
SELECT ...
```

---

## 🌟 Paimon数仓的优势总结

| 特性 | Paimon Lakehouse | 传统 Hive+Kafka |
|---|---|---|
| **数据时效性** | 秒级/分钟级 | 常见离线Hive链路为T+1，Kafka实时链路可达秒级；Kafka历史数据的可用范围取决于保留策略 |
| **数据修正** | 支持 Upsert/Delete | 取决于Hive表类型与事务配置；非事务表通常通过分区覆写等方式修正 |
| **存储成本** | 列式存储 + HDFS/S3 | Kafka存储成本取决于数据规模、副本数与部署方式，历史保留范围取决于保留策略 |
| **查询能力** | 支持 Ad-hoc SQL 查询 | Kafka本身不是SQL查询引擎，可结合流处理或查询引擎提供SQL能力 |
| **架构复杂度** | 一套存储，统一接口 | 多套组件维护困难 |

---

## 📋 本节要点回顾

### ✅ 核心技能掌握检查
- [ ] 理解 ODS/DWD/DWS 在Paimon中的表类型选择
- [ ] 掌握利用 `partial-update` 构建实时宽表的方法
- [ ] 掌握利用 `aggregation` 构建实时指标表的方法
- [ ] 知道如何进行历史数据修正 (Backfill)

### 🔗 学习路径连接
**已完成**：✅ 13-性能调优 → ✅ 14-实时数仓构建
**下一步**：[[【技术与工具】/Paimon/15-Paimon CDC数据同步|Paimon CDC数据同步]] - 学习如何一键同步全库数据

> [!tip] 思考题
> 在DWD层构建宽表时，如果"订单数据"先到，"用户数据"晚到了10分钟（乱序），Lookup Join还能关联上吗？
> *答案：如果订单到达并执行Processing Time Lookup Join时用户记录尚不可见，该次查找无法补全用户信息；用户记录随后到达通常不会自动重新关联已经输出的订单。可根据事件时间、维表版本及状态保留条件设计Temporal Join或双流Join，也可设计基于Paimon `partial-update` 的多流补全，但需要先明确如何把用户信息映射到对应订单主键，以及迟到更新和字段覆盖策略。*

---

**创建时间**:2024-12-05
**最后更新**:2024-12-05
**学习时长**:35分钟
**难度等级**:⭐⭐⭐ (高级)

#Paimon #实时数仓 #架构设计 #Lakehouse #ETL
