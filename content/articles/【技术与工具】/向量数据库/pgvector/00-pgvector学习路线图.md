---
title: pgvector 学习路线图
tags:
  - pgvector
  - 向量数据库
  - PostgreSQL
  - 学习路线
  - AI应用
aliases:
  - pgvector路线图
  - pgvector学习指南
date: 2026-03-11
difficulty: 高级
duration: 15分钟
knowledge_type: learning-path
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 后端工程师
  - AI开发者
  - 需要在现有数据库中增加语义搜索能力的团队
  - 技术决策者
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-11
updated: 2026-10-10
---


# pgvector 学习路线图

## 老房子装电梯：一个比喻讲清 pgvector 的本质

想象你在一栋住了十年的老公寓楼里生活。你熟悉每一个邻居，知道哪个门牌号住的是谁，知道哪层楼有噪音，知道物业大爷几点开门。这栋楼就是你的 **PostgreSQL**。

现在，AI 时代来了，你需要一个电梯（向量搜索能力）。

你有两个选择：
1. 搬进一栋全新的、专门为电梯设计的大楼——比如 Milvus 或 Qdrant。宽敞、现代、电梯超快。但你得重新认识所有邻居，重新装修，重新学一套管理规则。
2. 给你住了十年的老楼**加装一部电梯**——这就是 **pgvector**。电梯速度不是最快的，但你什么都不用换，所有的邻居（数据）、门禁系统（权限）、物业规则（事务）都还在。

pgvector 火起来的原因，不是因为它是最好的电梯，而是因为**大多数人根本不需要搬家**。

---

## 这份路线图适合谁

> [!tip] 读前确认
> 这份路线图面向以下人群：
> - 已经在使用 PostgreSQL 的后端工程师或数据工程师
> - 正在构建 RAG（检索增强生成）应用的 AI 开发者
> - 需要在现有数据库中增加语义搜索能力的团队
> - 想评估"要不要引入专用向量库"的技术决策者

如果你从零开始构建，数据量预计超过 5000 万条，且向量搜索是核心业务，那你可能需要先看看 向量数据库选型指南，再决定是否选择 pgvector。

---

## 学习路径总览

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"PingFang SC, -apple-system, Source Han Serif SC, serif","fontSize":"16px","background":"#FDFBF5","primaryColor":"#FDFBF5","primaryTextColor":"#2D2A26","primaryBorderColor":"#6E6A60","secondaryColor":"#E8EFE8","secondaryBorderColor":"#8FA890","secondaryTextColor":"#2D2A26","tertiaryColor":"#FDFBF5","tertiaryBorderColor":"#9A9488","tertiaryTextColor":"#6E6A60","lineColor":"#6E6A60","textColor":"#2D2A26","mainBkg":"#FDFBF5","nodeBorder":"#2D5A3D","clusterBkg":"#F3EEDF","clusterBorder":"#9A9488","edgeLabelBackground":"#FDFBF5"},"flowchart":{"htmlLabels":true,"curve":"basis","padding":20,"nodeSpacing":60,"rankSpacing":70,"useMaxWidth":false},"themeCSS":".node rect, .node polygon, .node circle { stroke-width: 1.5px; } .edgePath .path { stroke-width: 1.5px; } .cluster-label .nodeLabel, .cluster-label foreignObject { color: #2D2A26 !important; } .edgeLabel, .edgeLabel foreignObject { color: #2D2A26 !important; background-color: #FDFBF5; } .edgeLabel rect { fill: #FDFBF5; }"}}%%
flowchart TD
    classDef default fill:#FDFBF5,stroke:#6E6A60,color:#2D2A26,stroke-width:1.5px
    classDef startend fill:#2D2A26,stroke:#2D2A26,color:#FDFBF5,font-weight:bold
    classDef decision fill:#F6EAD8,stroke:#C08A1A,color:#2D2A26,font-weight:bold
    classDef hub fill:#3B5A80,stroke:#3B5A80,color:#FDFBF5,font-weight:bold
    classDef io fill:#E5EAF0,stroke:#3B5A80,color:#2D2A26
    classDef accent fill:#A6432C,stroke:#A6432C,color:#FDFBF5,font-weight:bold
    classDef storage fill:#F3EEDF,stroke:#9A9488,color:#2D2A26
    A["开始学习 pgvector"] --> B{"前置条件检查"}
    B --> |"已有 PostgreSQL 基础"| C["入门阶段<br/>（1-2周）"]
    B --> |"PostgreSQL 不熟悉"| B1["先学 PostgreSQL 基础<br/>再回来"]

    C --> C1["理解 pgvector 定位<br/>它是扩展，不是新数据库"]
    C1 --> C2["安装与配置<br/>启用扩展、创建向量列"]
    C2 --> C3["基础操作<br/>写入向量、精确搜索 FLAT"]
    C3 --> C4["第一个实战<br/>文本语义搜索 Demo"]

    C4 --> D["进阶阶段<br/>（2-3周）"]
    D --> D1["索引原理<br/>IVFFlat vs HNSW"]
    D1 --> D2["索引调优<br/>参数设置与性能测试"]
    D2 --> D3["混合查询<br/>向量搜索 + SQL 过滤"]
    D3 --> D4["向量类型进阶<br/>halfvec、sparsevec、bit"]
    D4 --> D5["距离度量选择<br/>L2 / 余弦 / 内积"]

    D5 --> E["生产阶段<br/>（持续迭代）"]
    E --> E1["性能基准测试<br/>确认数据量边界"]
    E1 --> E2["生产配置优化<br/>内存、并行、连接池"]
    E2 --> E3["监控与运维<br/>慢查询、索引健康"]
    E3 --> E4["架构决策<br/>继续用 pgvector 还是迁移"]

    E4 --> F{"按假设规模规划基准测试<br/>结合召回、过滤、并发和硬件评估"}
    F --> |"< 1000万条：测试规模示例"| G["测试 pgvector 是否满足目标<br/>不保证可直接留用"]
    F --> |"1000万-1亿条：测试规模示例"| H["对比 pgvector、pgvectorscale<br/>及专用向量库"]
    F --> |"> 1亿条：测试规模示例"| I["评估扩展与迁移方案<br/>不按行数直接决定迁移"]
    class B,F decision
    class A,C,B1,C1,C2,C3,C4,D,D1,D2,D3,D4,D5,E,E1,E2,E3,E4,G,H,I default
```

---

## 入门阶段：装上电梯，跑起来

### 阶段目标

能在已有的 PostgreSQL 实例上启用 pgvector，完成基本的向量写入和搜索操作。结束标志：跑通一个真实的文本语义搜索 Demo。

### 必学内容

#### 1. 理解 pgvector 是什么（概念层）

在写任何代码之前，先把这个问题想清楚：pgvector 是一个 **PostgreSQL 扩展**，不是一个独立的数据库。这意味着：

- 它运行在你已有的 PostgreSQL 进程里
- 用 SQL 操作，没有新的 API 需要学
- 你的备份、主从复制、连接池一切照旧
- 你现在用的所有工具（psql、pgAdmin、DBeaver）都能直接用

这一点至关重要，因为它决定了 pgvector 的上限和下限：**上限是 PostgreSQL 能做到的，下限也是 PostgreSQL 能承受的**。

参考文档：pgvector 概述与核心定位

#### 2. 安装与启用

```sql
-- 方式一：在支持 pgvector 的云数据库（RDS、Supabase、Neon）上直接启用
CREATE EXTENSION IF NOT EXISTS vector;

-- 验证安装
SELECT * FROM pg_extension WHERE extname = 'vector';
```

本地安装需要根据操作系统选择不同方式，macOS 用 Homebrew，Linux 用包管理器或源码编译。

#### 3. 创建第一张向量表

```sql
-- 创建一张包含向量列的表
-- 1536 是 OpenAI text-embedding-ada-002 的维度
CREATE TABLE documents (
    id          BIGSERIAL PRIMARY KEY,
    content     TEXT NOT NULL,
    metadata    JSONB,
    embedding   VECTOR(1536)
);
```

> [!note] 维度选择原则
> 向量维度必须与你使用的 Embedding 模型一致：
> - OpenAI text-embedding-ada-002：1536 维
> - OpenAI text-embedding-3-small：1536 维（可压缩到 512）
> - OpenAI text-embedding-3-large：3072 维
> - BGE-M3（本地模型）：1024 维
> - nomic-embed-text：768 维
> 已声明的向量维度必须与写入数据一致；更换维度时需要调整列类型或新建向量列，并重新生成或转换已有向量及处理相关索引，不一定需要重建整张表。

#### 4. 写入向量数据

```python
import openai
import psycopg2

# 生成 Embedding
client = openai.OpenAI()
response = client.embeddings.create(
    input="PostgreSQL 是世界上最先进的开源关系型数据库",
    model="text-embedding-ada-002"
)
embedding = response.data[0].embedding  # 长度为 1536 的列表

# 写入 PostgreSQL
conn = psycopg2.connect("postgresql://user:pass@localhost/mydb")
cur = conn.cursor()
cur.execute(
    "INSERT INTO documents (content, embedding) VALUES (%s, %s)",
    ("PostgreSQL 是世界上最先进的开源关系型数据库", embedding)
)
conn.commit()
```

#### 5. 第一次向量搜索（精确搜索）

```sql
-- 找最相似的 5 条记录（余弦距离，值越小越相似）
-- 下方 '[0.1, 0.2, ...]' 仅为占位表示，不能直接执行；需替换为同一 Embedding 模型生成的完整 1536 维查询向量
SELECT
    id,
    content,
    1 - (embedding <=> '[0.1, 0.2, ...]'::vector) AS similarity
FROM documents
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;
```

三种距离运算符：

| 运算符   | 距离类型    | 适用场景        |
| ----- | ------- | ----------- |
| `<->` | L2 欧氏距离 | 图像、坐标类向量    |
| `<=>` | 余弦距离    | 文本语义搜索（最常用） |
| `<#>` | 内积（负值）  | 归一化向量，性能稍好  |

### 阶段实战：文本语义搜索 Demo

目标：给一个知识库（100 条文档）建立语义搜索，输入任意问题，返回最相关的文档。

完成这个 Demo 后，你就练习了向量写入和基础语义搜索；索引调优、混合查询及生产运维仍需后续学习。

---

## 进阶阶段：把电梯调快一点

### 阶段目标

理解索引原理，会根据数据量和业务需求选择合适的索引类型，能写出高效的混合查询语句。

### 必学内容

#### 1. 为什么需要索引

不加索引时，每次搜索都要扫描整张表（Sequential Scan），计算每一行的向量距离。数据量小时（1 万条以内）感觉不到，但到了 10 万条，搜索延迟就会明显上升。

#### 2. IVFFlat 索引：把向量分桶

**类比**：图书馆把书按类别分区。找书时不用翻遍所有书架，只翻相关分区。

工作原理：
1. 训练阶段：把所有向量聚类成 N 个簇（lists），记录每个簇的中心点
2. 搜索阶段：先找最近的 K 个簇（probes），只在这些簇里搜索

```sql
-- 创建 IVFFlat 索引（余弦距离）
-- lists = sqrt(总行数) 是推荐起点
CREATE INDEX ON documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 搜索时设置 probes（越大越准，越慢）
SET ivfflat.probes = 10;
```

**IVFFlat 的注意事项**：聚类质量依赖建索引时的数据规模和代表性，lists * 100 不应作为统一硬性下限；新增数据尤其是分布变化可能影响召回率，应通过测试判断是否需要调整参数或重建索引。

#### 3. HNSW 索引：建立向量的"高速路网"

**类比**：城市里的高速公路网络。从 A 点到 B 点，先上高速（跳层），再走省道，再走县道，层层精确。

工作原理：构建一个多层图结构，上层是稀疏的长距离连接（"高速路"），下层是密集的短距离连接（"小路"），搜索时从顶层向下缩小范围。

```sql
-- 创建 HNSW 索引
-- m：每个节点的连接数，越大越准，内存越多（推荐 16）
-- ef_construction：构建时搜索范围，越大越准，构建越慢（推荐 64）
CREATE INDEX ON documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 搜索时设置 ef_search（越大越准，越慢，建议从 40 开始调）
SET hnsw.ef_search = 40;
```

#### 4. IVFFlat vs HNSW：怎么选

| 对比维度 | IVFFlat | HNSW |
|----------|---------|------|
| 索引构建速度 | 快（约 128 秒/百万条） | 慢（约 4065 秒/百万条） |
| 索引占用内存 | 较小（约 257MB/百万条） | 较大（约 729MB/百万条） |
| 查询速度（高召回） | 慢（约 2.6 QPS @ 99.8%召回） | 快（约 40.5 QPS @ 99.8%召回） |
| 新数据友好度 | 差（需要定期重建） | 支持增量插入（召回率仍需随数据分布和索引参数变化持续测试） |
| 推荐场景 | 数据相对静态、内存有限 | 数据频繁更新、查询性能优先 |

> [!tip] 2024 年后的最佳实践
> pgvector 0.6.0 之后引入了 HNSW 并行构建，0.7.0 起 HNSW 构建速度提升高达 30 倍。**对于大多数场景，现在推荐优先使用 HNSW**，除非你的机器内存非常有限。

#### 5. 混合查询：向量搜索的真正威力

pgvector 最大的优势之一：可以把向量搜索和普通 SQL 条件自然地结合起来。

```sql
-- 场景：在某个用户的文档中，找与问题最相似的 5 篇
-- 本例假设 documents 已另行定义 title、user_id、created_at、status；前文基础表不含这些列，不能直接执行本查询
-- $1 为客户端绑定的完整查询向量，模型和维度需与存量向量一致
SELECT
    d.id,
    d.title,
    d.content,
    1 - (d.embedding <=> $1::vector) AS similarity
FROM documents d
WHERE
    d.user_id = 12345              -- 普通 SQL 过滤
    AND d.created_at > '2024-01-01'  -- 时间过滤
    AND d.status = 'published'       -- 状态过滤
ORDER BY d.embedding <=> $1::vector
LIMIT 5;
```

这个查询在专用向量库里实现起来要麻烦得多——你需要在应用层把 SQL 过滤和向量过滤拼接起来，还要处理两个系统之间的事务一致性。

#### 6. 向量类型进阶（v0.7.0+）

pgvector 0.7.0 引入了新的向量类型，对降低内存和提升性能很有帮助：

```sql
-- halfvec：半精度浮点，向量元素存储占用较小；4000 是相关近似索引的维度限制，不是类型存储上限，需按所用版本和索引确认
CREATE TABLE documents_half (
    id       BIGSERIAL PRIMARY KEY,
    embedding halfvec(1536)
);

-- sparsevec：稀疏向量，适合 BM25 等稀疏表示
-- bit：二值向量，适合二值化后的哈希检索；64000 是相关近似索引的维度限制，不是 bit 类型自身的存储上限，需按所用版本和索引确认
```

> [!note] 何时用 halfvec
> 可将超过 100 万条且内存成为瓶颈作为评估 halfvec(1536) 的示例场景。半精度表示可减少向量元素存储，但不保证整表、索引或运行时总内存减半；本文的 1-2% 仅可作为精度损失评估的假设区间，不能称为通常结果。是否可接受应以业务数据上的召回率和任务效果测试为准。

---

## 生产阶段：让电梯稳定运行

### 阶段目标

能够在生产环境中运维 pgvector，知道性能瓶颈在哪、怎么监控、什么时候该"换楼"。

### 必学内容

#### 1. 关键性能参数配置

```sql
-- 提高 HNSW 索引构建的并行度（PostgreSQL 15+）
SET max_parallel_maintenance_workers = 7;  -- 根据 CPU 核数调整

-- 以下内存值仅为配置示例，不是生产默认建议；需结合可用内存和并发评估
-- work_mem 可由单查询多个执行节点及多个并发查询分别使用，总内存并非每连接仅 256MB
-- 提高维护操作内存上限可能加速索引构建，但需避免与其他负载争抢内存
SET maintenance_work_mem = '8GB';

-- 搜索时的内存（影响排序、Hash Join 等）
SET work_mem = '256MB';
```

#### 2. 连接池配置

pgvector 的查询本质上是 PostgreSQL 查询，连接管理与普通 PG 一致。建议配合 PgBouncer 使用连接池，避免高并发下的连接数爆炸。

#### 3. 慢查询监控

```sql
-- 前提：已按 PostgreSQL 环境要求启用 pg_stat_statements
-- 按平均执行时间降序查看包含余弦距离运算符的查询；本查询没有筛选耗时超过 1 秒的记录
SELECT
    query,
    calls,
    mean_exec_time,
    total_exec_time
FROM pg_stat_statements
WHERE query LIKE '%<=>%'  -- 包含向量操作符的查询
ORDER BY mean_exec_time DESC
LIMIT 20;
```

#### 4. 索引健康检查

```sql
-- 查看索引使用情况
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,       -- 索引被使用的次数
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE indexname LIKE '%embedding%';
```

#### 5. 什么时候该"换楼"：迁移决策框架

| 信号 | 含义 | 建议行动 |
|------|------|----------|
| 查询延迟 P99 > 200ms | 示例评估阈值；是否超标取决于业务延迟目标 | 先定位瓶颈，再评估优化或迁移 |
| 向量数据量 > 5000 万条 | 示例测试规模，不代表固定性能边界 | 在实际维度、召回、过滤和并发条件下开展 POC |
| 写入 QPS > 1000 | 示例负载水平，不代表索引维护必然成为瓶颈 | 测量写入延迟及索引维护开销，再评估方案 |
| 需要多种索引算法 | pgvector 只支持 IVFFlat/HNSW | 评估专用向量库 |
| 团队开始抱怨向量相关运维成本 | 这是最真实的信号 | 认真评估迁移成本 vs 收益 |

> [!warning] 关于"性能边界"的真实数据
> 根据 2024-2025 年的基准测试数据：
> - **pgvector（HNSW）**：在 5000 万条向量时，高召回（99%+）下约 40 QPS
> - **pgvectorscale（streaming diskann）**：同等条件下约 471 QPS
> - **Qdrant**：同等条件下约 41 QPS（与原生 pgvector 接近，但内存效率更高）
> - **Milvus**：在数亿条向量时依然保持低延迟，QPS 可达数千
>
> 评估建议：**可将 1000 万条和 5000 万条作为本文规划测试的假设规模，而非 pgvector 的性能保证或固定容量边界；是否留用或迁移，应以实际维度、召回目标、过滤条件、并发和硬件上的测试结果决定。**

---

## 知识地图：pgvector 在整个向量数据库生态中的位置

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"PingFang SC, -apple-system, Source Han Serif SC, serif","fontSize":"16px","background":"#FDFBF5","primaryColor":"#FDFBF5","primaryTextColor":"#2D2A26","primaryBorderColor":"#6E6A60","secondaryColor":"#E8EFE8","secondaryBorderColor":"#8FA890","secondaryTextColor":"#2D2A26","tertiaryColor":"#FDFBF5","tertiaryBorderColor":"#9A9488","tertiaryTextColor":"#6E6A60","lineColor":"#6E6A60","textColor":"#2D2A26","mainBkg":"#FDFBF5","nodeBorder":"#2D5A3D","clusterBkg":"#F3EEDF","clusterBorder":"#9A9488","edgeLabelBackground":"#FDFBF5"},"flowchart":{"htmlLabels":true,"curve":"basis","padding":20,"nodeSpacing":60,"rankSpacing":70,"useMaxWidth":false},"themeCSS":".node rect, .node polygon, .node circle { stroke-width: 1.5px; } .edgePath .path { stroke-width: 1.5px; } .cluster-label .nodeLabel, .cluster-label foreignObject { color: #2D2A26 !important; } .edgeLabel, .edgeLabel foreignObject { color: #2D2A26 !important; background-color: #FDFBF5; } .edgeLabel rect { fill: #FDFBF5; }"}}%%
graph LR
    A["向量数据库生态"] --> B["扩展型"]
    A --> C["专用型"]
    A --> D["云托管型"]

    B --> B1["pgvector<br/>PostgreSQL 扩展"]
    B --> B2["elasticsearch<br/>dense_vector"]
    B --> B3["Redis Stack<br/>RediSearch"]

    C --> C1["Milvus<br/>亿级向量专家"]
    C --> C2["Qdrant<br/>Rust 高性能"]
    C --> C3["Weaviate<br/>多模态"]
    C --> C4["Chroma<br/>开发友好"]

    D --> D1["Pinecone<br/>全托管"]
    D --> D2["Zilliz Cloud<br/>Milvus 云版"]

    style B1 fill:#4CAF50,color:#fff
    style C1 fill:#2196F3,color:#fff
    style C2 fill:#2196F3,color:#fff
```

---

## 推荐学习顺序与时间规划

### 第一周：跑通基础

- Day 1-2：阅读 pgvector 概述与核心定位，理解定位和适用场景
- Day 3-4：本地安装 pgvector，跑通向量写入和搜索
- Day 5-7：完成文本语义搜索 Demo（用自己项目的数据）

### 第二周：理解索引

- Day 8-9：理解 IVFFlat 原理，在测试数据上对比有无索引的性能差距
- Day 10-11：理解 HNSW 原理，体验参数调优对召回率和速度的影响
- Day 12-14：实践混合查询，结合业务场景写几个真实的查询 SQL

### 第三周：生产准备

- Day 15-16：配置生产环境参数，测试并发性能
- Day 17-18：搭建监控，学会看慢查询日志
- Day 19-21：根据数据量规划，明确是否需要后续迁移

---

## 常见问题速查

**Q：pgvector 支持多少维度的向量？**
A：应区分向量类型的存储维度限制与近似索引的维度限制。2000、4000 和 64000 不能直接作为 vector、halfvec 和 bit 类型自身的统一上限；具体索引限制应按所用 pgvector 版本和索引类型确认。本文 vector(1536) 示例还要求写入和查询向量均为 1536 维。

**Q：数据已经在 PostgreSQL 里，怎么加向量搜索能力？**
A：只需 `CREATE EXTENSION vector;`，然后给现有表加一列 `ALTER TABLE your_table ADD COLUMN embedding VECTOR(1536);`，其他一切不变。

**Q：pgvector 支持分布式部署吗？**
A：pgvector 本身不支持，受限于 PostgreSQL 的单机架构。如果需要分布式，可以考虑 Citus（PostgreSQL 分布式扩展）+ pgvector，或者直接迁移到 Milvus。

**Q：向量搜索结果为什么和预期不符？**
A：最常见的原因是 Embedding 模型和向量的余弦相似度计算没有对齐。确认：1）写入和查询用的是同一个 Embedding 模型；2）余弦距离已按向量范数计算，不要求预先归一化，应检查是否存在零向量以及距离度量是否符合模型用途；3）probes/ef_search 设置是否太小导致召回率不够。

**Q：能在向量搜索里做分页吗？**
A：可以，但不推荐用 OFFSET。向量搜索的"第 2 页"语义上很模糊，通常业务上不需要深度分页。如果确实需要，可以先 `LIMIT 100` 拿回来，在应用层做分页。

---

## 延伸阅读

- 向量数据库选型指南 — 帮你决定要不要用 pgvector
- pgvector 概述与核心定位 — 深入理解 pgvector 的原理和定位
- Milvus 完整指南 — 当 pgvector 不够用时的下一站
- Qdrant 完整指南 — 追求极致性能的选择
- RAG 应用架构设计 — pgvector 最主流的使用场景

---

#pgvector #向量数据库 #PostgreSQL #AI应用 #语义搜索 #学习路线
