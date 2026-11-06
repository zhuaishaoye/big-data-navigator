---
title: "Iceberg 学习路线图"
tags: [Iceberg, 表格式, Lakehouse, 学习路线]
created: 2026-04-19
updated: 2026-10-09
difficulty: "中级"
duration: 15分钟
status: "active"
knowledge_type: "learning-path"
stability: "slow-changing"
last_verified: 2026-08-16
next_review: 2026-11-16
applies_to: ["Apache Iceberg latest documentation"]
source_level: primary
sources: ["https://iceberg.apache.org/docs/latest/", "https://iceberg.apache.org/spec/"]
target_audience: ["数据开发工程师","数据架构师","数据治理工程师"]
access_tier: "free"
---

# Iceberg 学习路线图

> [!info] 这个目录适合谁
> 你已经知道数据湖是什么，用过 Hive 或 Parquet，想搞清楚表格式如何管理快照、文件与表演进。完全零基础请先看 [[【数据开发与数据架构】/05-数据存储架构/05-数据湖架构|数据湖架构基础]]。

## Iceberg 是什么

Apache Iceberg 是一种开放的**表格式规范**（Table Format），不是存储引擎，也不是计算引擎。它解决的问题很具体：如何在分布式文件系统（HDFS、S3、OSS）上，让 Spark、Flink、Trino 这些不同引擎**像操作数据库表一样**操作文件——有 ACID 事务、有 Schema Evolution、有时间旅行，还不锁死你的引擎选择。

一句话定位：**Iceberg 是数据湖的"表管理层"**，Parquet/ORC 是物理格式，S3 是存储，Iceberg 是中间那层让一切变得可管理的规范。

## 为什么值得专门学

Iceberg 官方文档把它定位为面向大型分析数据集的开放表格式。它让 Spark、Flink、Trino 等引擎通过统一表元数据管理文件，并提供 Schema Evolution、Hidden Partitioning、Partition Evolution、Time Travel 和 Rollback 等能力。

学习重点不是背诵特性，而是建立三层认识：

1. **表元数据如何索引文件**：理解 Snapshot、Manifest List 和 Manifest File。
2. **表如何安全演进**：理解字段 ID、隐藏分区和多代 Partition Spec。
3. **生产表如何维护**：理解快照过期、孤儿文件、小文件与 Manifest 治理。

V3 新能力属于进阶专题，基础架构、引擎兼容和生产运维仍应先掌握。

## 学习路径

```text
第一阶段：基础认知（V1/V2）
├── 理解表格式解决的本质问题（vs Hive 分区）
├── Metadata 三层结构：Snapshot → Manifest List → Manifest File
├── ACID 事务与快照隔离的实现原理
└── Schema Evolution 与 Partition Evolution

第二阶段：Spark 实践
├── Catalog 与 warehouse 配置
├── 建表、写入、查询与 MERGE
├── 元数据表与快照检查
└── 版本兼容和故障定位

第三阶段：生产实践
├── 快照保留与孤儿文件清理
├── 小文件合并与 Manifest 重写
├── 维护任务的安全门禁
└── 查询与写入验收

第四阶段：V3 新特性
├── 新数据类型与默认值
├── Row Lineage
├── Deletion Vector
└── 迁移边界与引擎支持
```

## 本目录文档索引

| 文档 | 内容 | 难度 |
|------|------|------|
| [[【技术与工具】/Iceberg/01-Iceberg-V3深度解析|01 - V3 深度解析]] | 扩展类型、Row Lineage、Deletion Vector、AI 场景边界与迁移检查 | 进阶 |
| [[【技术与工具】/Iceberg/02-Iceberg核心架构与表演进|02 - 核心架构与表演进]] | 元数据树、快照、Schema 与 Partition Evolution | 中级 |
| [[【技术与工具】/Iceberg/03-Iceberg-Spark快速实践|03 - Spark 快速实践]] | Catalog、建表、MERGE 与元数据验收 | 中级 |
| [[【技术与工具】/Iceberg/04-Iceberg表维护与小文件治理|04 - 表维护与小文件治理]] | 快照、孤儿文件、Compaction 与安全门禁 | 进阶 |

> [!tip] 横向对比
> 学完 Iceberg 后建议横向对比 [[【技术与工具】/Hudi/01-Hudi概述与特性|Hudi 概述]] 和 [[【技术与工具】/Paimon/01-Paimon概述与特性|Paimon 概述]]。选型时要比较引擎支持、更新模式、维护成本和团队运维能力，不能只看功能清单。

---

下一步：先读 [[【技术与工具】/Iceberg/02-Iceberg核心架构与表演进|Iceberg核心架构与表演进]]，再进入 [[【技术与工具】/Iceberg/03-Iceberg-Spark快速实践|Iceberg Spark快速实践]]。完成基础与实践后，再学习 [[【技术与工具】/Iceberg/01-Iceberg-V3深度解析|Iceberg V3深度解析]]。

## 官方资料

- [Apache Iceberg Documentation](https://iceberg.apache.org/docs/latest/)
- [Apache Iceberg Spark Getting Started](https://iceberg.apache.org/docs/latest/spark-getting-started/)
- [Apache Iceberg Maintenance](https://iceberg.apache.org/docs/latest/maintenance/)
