---
title: Iceberg V3 深度解析：扩展类型、行级血缘与删除向量
tags:
  - Iceberg
  - 表格式
  - Lakehouse
  - RowLineage
  - DeletionVector
aliases:
  - IcebergV3
  - ApacheIcebergV3
created: 2026-04-19
updated: 2026-10-10
status: active
knowledge_type: concept
stability: fast-changing
last_verified: 2026-08-16
next_review: 2026-11-16
applies_to:
  - Apache Iceberg table spec v3
  - 具体引擎支持以对应版本文档为准
source_level: primary
sources:
  - https://iceberg.apache.org/spec/
  - https://github.com/apache/iceberg/blob/main/format/spec.md
difficulty: 高级
duration: 30分钟
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据治理工程师
  - 数据科学家
access_tier: free
---

# Iceberg V3 深度解析：扩展类型、行级血缘与删除向量

> [!abstract] 先说结论
> Iceberg 官方把 V3 定义为“扩展类型与能力”的表格式版本。它新增扩展数据类型、列默认值、多参数分区与排序变换、Row Lineage、二进制删除向量和表加密密钥。本文讨论 AI 场景时，会明确标注为工程推论，不把它写成官方设计目标。

前置阅读：[[【技术与工具】/Iceberg/02-Iceberg核心架构与表演进|Iceberg核心架构与表演进]]、[[【数据开发与数据架构】/05-数据存储架构/05-数据湖架构|数据湖架构]]。

## 1. 先区分规范、实现与产品支持

Iceberg 表格式版本描述的是元数据和数据文件应遵守的协议，不等于所有计算引擎已经完整实现。

| 层次 | 要回答的问题 | 核验入口 |
|---|---|---|
| 规范 | V3 允许或要求表达什么 | Apache Iceberg Table Spec |
| Iceberg 实现 | Java API、Spark/Flink 集成是否已经实现 | 对应 Iceberg 版本文档与 Release Notes |
| 计算引擎 | 是否能读、写、升级以及使用某项特性 | Spark、Flink、Trino 等各自版本文档 |
| 云厂商产品 | 托管 Catalog、查询服务是否开放该能力 | 厂商文档与区域发布说明 |

> [!warning] 升级原则
> “规范已采纳”不代表现有生产引擎可以安全读写。升级前必须建立读者、写者、Catalog 和维护任务的兼容矩阵，并用非关键表做往返验证。

## 2. V3 新增了什么

官方规范列出的 V3 变化包括：

- 纳秒精度的 `timestamp_ns` 与 `timestamptz_ns`
- `unknown`、`variant`、`geometry`、`geography` 类型
- 列默认值
- 多参数分区与排序变换
- Row Lineage
- 二进制 Deletion Vector
- 表加密密钥

这些能力解决的不是同一个问题。扩展类型提升表达能力；Row Lineage 为行提供稳定标识与最近更新时间序号；Deletion Vector 改变位置删除的编码方式；默认值则让 Schema Evolution 的读写语义更清晰。

## 3. 扩展数据类型

### 3.1 Variant

`variant` 用于表示半结构化数据。它比“把 JSON 塞进字符串列”更有结构语义，但是否支持字段访问、谓词下推和何种 SQL 语法，仍取决于具体引擎。

适合候选场景：

- 来源系统字段不稳定的事件属性
- 文档解析后的异构元数据
- 需要保留原始层次结构、又不适合频繁改表的载荷

不应把所有列都改成 Variant。稳定且高频过滤的业务字段仍应使用明确类型，便于统计信息、约束和查询优化。

### 3.2 Geometry 与 Geography

两者让表格式可以原生描述空间数据。`geometry` 面向平面坐标语义，`geography` 面向地理坐标语义。类型进入规范并不自动带来空间索引和完整 GIS 函数，实际能力要看引擎。

### 3.3 纳秒时间戳与 Unknown

纳秒时间戳用于需要高于微秒精度的事件时间。`unknown` 是类型尚未确定时的占位类型，不应作为长期业务字段类型。

## 4. Row Lineage 的真实语义

V3 要求表为新创建的行维护两个行级字段：

- `_row_id`：表内唯一的 `long` 标识
- `_last_updated_sequence_number`：最后一次修改该行的提交序号

这两个值通过继承机制完成分配。提交成功之前，写入器还不知道最终的起始行 ID 和提交序号，因此数据文件可以先写出，再由快照、Manifest 和数据文件元数据共同推导。

### 4.1 行移动与行修改

当 Compaction 只把一行移动到另一个数据文件、并未修改业务值时，写入器必须保留原 `_row_id` 和 `_last_updated_sequence_number`。当业务值被修改时，必须保留 `_row_id`，并让最近更新序号继承本次提交的序号。

这一区分很关键：

- 文件位置变化不等于业务数据变化
- 增量消费者可以避免把纯文件重写误判为业务更新
- 行标识可以跨快照保持稳定

### 4.2 两个重要边界

第一，V1/V2 表升级到 V3 后，历史快照和历史文件中的行不一定都有 Row Lineage 值；不能假设升级会自动回填所有旧行。

第二，通过 Equality Delete 完成的更新无法保留旧行 ID。规范把这种更新视为“删除旧行并新增一行”，因为执行引擎没有读取旧行，也就拿不到原 `_row_id`。

> [!note] 工程推论：增量 AI 管道
> 稳定行 ID 和最近更新序号可以帮助定位需要重算特征、Embedding 或索引的行。但这是建立在规范能力之上的应用设计，不代表 Iceberg 自带向量索引、训练编排或模型血缘系统。

## 5. 二进制 Deletion Vector

V2 的位置删除文件通过“数据文件路径 + 行位置”记录删除。V3 的 Deletion Vector 仍然表达位置删除，但把某个数据文件的删除位置编码为二进制位图，并存放在 Puffin 文件的 Blob 中。

关键约束包括：

- 一个 Deletion Vector 只引用一个数据文件
- Manifest 中要记录被引用的数据文件
- `content_offset` 与 `content_size_in_bytes` 用于直接定位 Puffin Blob
- Reader 必须把 Deletion Vector 与对应数据文件合并，过滤已删除行

Deletion Vector 通常比逐行记录位置更紧凑，但不能据此承诺固定的性能倍数或 Compaction 降幅。收益取决于删除密度、文件大小、缓存、对象存储请求和引擎实现。

## 6. 列默认值与 Schema Evolution

V3 支持在 Schema 中携带列默认值。默认值的主要价值是明确新列在不同写入阶段的语义，避免把“旧文件中没有该列”简单等同于业务上的 `NULL`。

使用时要回答三个问题：

1. 默认值是供新写入使用，还是供读取历史数据使用？
2. 引擎是否完整实现对应的默认值语义？
3. 默认值改变后，历史快照查询应该保持什么结果？

不要在未做跨引擎验证时把默认值当成替代数据回填的万能方案。

## 7. AI 场景能得到什么、得不到什么

| 场景 | V3 可以提供的基础能力 | 仍需外部系统承担 |
|---|---|---|
| Embedding 增量重算 | 用行标识和更新序号筛选候选变更 | 模型推理、任务调度、失败重试 |
| 向量索引同步 | 稳定的表内行标识 | ANN 索引、向量查询、索引一致性 |
| 多模态元数据 | Variant、Geometry、Geography 等表达能力 | 图片/音视频对象存储与专用处理 |
| 训练数据审计 | 快照、序号、行级标识 | 模型版本、审批、数据合约与审计平台 |

> [!important] 不要越界
> Iceberg V3 没有原生向量列索引，也不会自动构建 RAG 或训练数据管道。把 `_row_id` 直接当跨系统业务主键也不稳妥：它是表内行标识，跨表、跨重建和 Equality Delete 更新的语义需要单独设计。

## 8. 升级与验收清单

- [ ] 列出所有读写引擎、版本和任务所有者
- [ ] 核对每个引擎对 V3 及目标特性的读写支持，不只看“支持 Iceberg”
- [ ] 检查 Catalog 是否能保存并返回 V3 元数据字段
- [ ] 先验证 V3 基础读写，再逐项验证 Row Lineage、Deletion Vector 和扩展类型
- [ ] 用旧读者读取 V3 测试表，确认失败方式可识别，避免静默错误
- [ ] 验证快照回滚、分支或标签、Schema Evolution 和分区演进
- [ ] 验证 Compaction 后 `_row_id` 是否保持、更新序号是否符合预期
- [ ] 验证 Equality Delete 更新的行标识变化
- [ ] 记录回退边界；一旦写入旧引擎不能理解的 V3 特性，不能把改属性当成安全降级
- [ ] 为版本、引擎支持和官方规范设置季度复核

## 9. 掌握检查

- [ ] 能区分“规范已采纳”和“引擎已实现”
- [ ] 能解释 `_row_id` 与 `_last_updated_sequence_number` 的职责
- [ ] 知道升级表的历史行为什么可能没有 Row Lineage 值
- [ ] 知道 Equality Delete 为什么不能保留旧行 ID
- [ ] 能解释 Deletion Vector 与位置删除文件的关系
- [ ] 能说清 V3 对 AI 管道的帮助与边界

## 10. 官方资料

- [Apache Iceberg Table Spec](https://iceberg.apache.org/spec/)
- [Iceberg GitHub 中的规范源文件](https://github.com/apache/iceberg/blob/main/format/spec.md)
- [Apache Iceberg Documentation](https://iceberg.apache.org/docs/latest/)
- [Iceberg Schema Evolution](https://iceberg.apache.org/docs/latest/evolution/)

## 相关文档

- [[【技术与工具】/Iceberg/00-Iceberg学习路线图|Iceberg学习路线图]]
- [[【技术与工具】/Iceberg/02-Iceberg核心架构与表演进|Iceberg核心架构与表演进]]
- [[【技术与工具】/Iceberg/03-Iceberg-Spark快速实践|Iceberg Spark快速实践]]
- [[【技术与工具】/Iceberg/04-Iceberg表维护与小文件治理|Iceberg表维护与小文件治理]]
- [[【技术与工具】/Hudi/01-Hudi概述与特性|Hudi概述与特性]]
- [[【技术与工具】/Paimon/01-Paimon概述与特性|Paimon概述与特性]]
- [[【数据开发与数据架构】/05-数据存储架构/05-数据湖架构|数据湖架构]]
