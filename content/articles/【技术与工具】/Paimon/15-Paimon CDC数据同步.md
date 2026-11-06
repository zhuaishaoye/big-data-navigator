---
title: Paimon CDC数据同步 - 数据库整库入湖
tags:
  - Paimon
  - CDC
  - Flink
  - MySQL
  - 数据同步
created: 2024-12-05
updated: 2026-10-10
difficulty: 中级
duration: 35分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
stability: slow-changing
status: maintenance
access_tier: free
---


# 🔄 Paimon CDC数据同步 - 数据库整库入湖

> [!abstract] 📋 本节概览
> - 🎯 **学习目标**:掌握利用Flink CDC Action将MySQL/Postgres等数据库整库同步到Paimon
> - 📚 **前置知识**:[[【技术与工具】/Paimon/14-基于Paimon的实时数仓|基于Paimon的实时数仓]]
> - ⏱️ **预计用时**:35分钟
> - 🔧 **核心内容**:Mysql-Sync-Database、Schema自动演进、全增量一体化
> - 💡 **关键收获**:无需写一行SQL，一行命令实现百张表的实时入湖

## 🎯 为什么选择 Paimon 做 CDC 入湖？

传统入湖方案（如Sqoop T+1，或Canal+Kafka+Hive）通常面临以下痛点：
1.  **链路长**：DB -> Canal -> Kafka -> Flink -> Hive，组件多，维护难。
2.  **Schema变更痛**：源表加列，下游全链路都要手动改。
3.  **更新难**：Hive不支持高频更新，需要复杂的Merge逻辑。

Paimon CDC 方案优势**：
- **一步到位**：DB -> Flink CDC -> Paimon。
- **Schema自动同步**：源表加列，Paimon自动加列。
- **全增量一体**：先读取全量快照，再衔接增量Binlog；快照阶段是否涉及锁及切换行为，取决于CDC版本、快照模式和源库配置，不能统一保证不锁表。

---

## 🛠️ 工具准备：CDC Action Jar

Paimon提供了一个专门的 Action Jar 包，封装了CDC同步逻辑。你需要下载：
`paimon-flink-action-0.x.jar`

支持的数据源：MySQL, PostgreSQL, MongoDB, Kafka, Pulsar 等。

---

## 💻 实战1：单表同步 (Sync Table)

适用于只想同步个别核心表的场景。

```bash
<FLINK_HOME>/bin/flink run \
    -Dexecution.checkpointing.interval=30s \
    paimon-flink-action-0.6.0.jar \
    mysql-sync-table \
    --warehouse hdfs:///path/to/warehouse \
    --database paimon_db \
    --table paimon_table \
    --primary-keys id \
    --mysql-conf hostname=127.0.0.1 \
    --mysql-conf username=root \
    --mysql-conf password=pwd \
    --mysql-conf database-name=mysql_db \
    --mysql-conf table-name=mysql_table
```

**参数说明**：
- `mysql-sync-table`: 动作名称。
- `--primary-keys`: 指定Paimon表的主键（通常与MySQL一致）。
- `--mysql-conf`: MySQL连接配置。

---

## 🚀 实战2：整库同步 (Sync Database)

这是最强大的功能。一行命令同步整个数据库的几十张表。

```bash
<FLINK_HOME>/bin/flink run \
    -Dexecution.checkpointing.interval=30s \
    paimon-flink-action-0.6.0.jar \
    mysql-sync-database \
    --warehouse hdfs:///path/to/warehouse \
    --database paimon_ods_db \
    --mysql-conf hostname=127.0.0.1 \
    --mysql-conf username=root \
    --mysql-conf password=pwd \
    --mysql-conf database-name=order_db \
    --including-tables "order_.*|user_.*" \
    --excluding-tables "temp_.*" \
    --table-conf bucket=4 \
    --table-conf sink.parallelism=4
```

**关键特性**：
1.  **自动建表**：Paimon会自动根据MySQL表结构创建对应的Paimon表。
2.  **正则匹配**：通过 `--including-tables` 选择需要同步的表。
3.  **拓扑合并**：默认情况下，所有表的同步会合并在一个Flink Job中运行，极大地节省资源（Source复用）。

---


## 🧬 Schema 自动演进 (Schema Evolution)

这是Paimon CDC的杀手级特性。

**场景**：业务在MySQL的 `users` 表中执行了 `ALTER TABLE users ADD COLUMN age INT`。

**Paimon的处理**：
1.  Flink CDC Source 捕获到 Binlog 中的 DDL 事件。
2.  Paimon Sink 检测到 Schema 变更。
3.  Paimon 自动执行 `ALTER TABLE users ADD COLUMN age INT`。
4.  后续的数据流自动包含 `age` 字段。

**预期结果**：在所用版本支持该加列操作、配置兼容且任务正常运行的条件下，可自动演进Schema，无需为此次加列手动重启任务；这不构成数据同步绝不中断的保证。

---


## ⚠️ 生产环境注意事项

### 1. 全量阶段的并发控制
在初始全量同步阶段，为了加快速度，Flink CDC 会对表进行分片（Chunk）读取。
建议配置 `--table-conf scan.incremental.snapshot.chunk.size=8096` 来调整分片大小。

### 2. MySQL服务器压力
整库同步虽然复用了Source，但如果一次性同步几百张大表，Snapshot阶段可能会给MySQL造成读取压力。
建议：分批次同步，或者配合 `--scan.newly-added-table.enabled` 逐步加表。

### 3. 类型映射
大部分MySQL类型都能自动映射到Paimon类型。
- `TINYINT(1)` -> `BOOLEAN`
- `DATETIME` -> `TIMESTAMP`
- `DECIMAL` -> `DECIMAL`

如果遇到不支持的自定义类型，可能需要手动处理或转换。

---


## 📋 本节要点回顾

### ✅ 核心技能掌握检查
- [ ] 掌握 `mysql-sync-database` 命令的使用
- [ ] 理解 Paimon 如何处理 Schema 变更
- [ ] 知道如何通过正则匹配过滤需要同步的表
- [ ] 了解全量同步阶段的原理

### 🔗 学习路径连接
**已完成**：✅ 14-实时数仓构建 → ✅ 15-CDC数据同步
**下一步**：[[【技术与工具】/Paimon/16-Paimon生产最佳实践|Paimon生产最佳实践]] - 学习部署、监控与故障排查

> [!tip] 最佳实践
> 对于ODS层建设，可评估使用 `mysql-sync-database` 方案以减少逐表开发工作。例如，可将“原本需要几周、采用该方案后仅需几小时”作为待验证的工期假设，而非已证实收益；实际工期和维护成本取决于表规模、类型兼容性、源库配置及运维要求。

---

**创建时间**:2024-12-05
**最后更新**:2024-12-05
**学习时长**:35分钟
**难度等级**:⭐⭐ (中级)

#Paimon #CDC #Flink #数据同步 #MySQL
