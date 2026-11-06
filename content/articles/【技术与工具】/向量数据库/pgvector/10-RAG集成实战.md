---
title: pgvector RAG 集成实战：用 PostgreSQL 构建生产级知识库
tags:
  - pgvector
  - RAG
  - LangChain
  - LlamaIndex
  - Supabase
  - PostgreSQL
  - 向量数据库
  - 混合搜索
  - RLS
  - 多租户
difficulty: 高级
duration: 120分钟
aliases:
  - pgvector RAG
  - pgvector LangChain
  - pgvector 知识库
date: 2026-03-11
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据科学家
  - 数据治理工程师
stability: fast-changing
status: maintenance
access_tier: free
created: 2026-03-11
updated: 2026-10-10
---


# pgvector RAG 集成实战：用 PostgreSQL 构建生产级知识库

> [!abstract] 本文目标
> - **理解 pgvector RAG 的独特价值**：为什么"少一套系统"有时比"多一点性能"更重要
> - **设计 pgvector 专属 RAG Schema**：充分利用关系型数据库的 JOIN、事务、RLS 能力
> - **实现真正的混合搜索**：pgvector 语义搜索 + tsvector 全文搜索 + RRF 融合排序，全用 SQL 实现
> - **集成 LangChain 和 LlamaIndex**：展示框架接入与元数据过滤示例；生产使用还需完成接口适配、数据库权限策略及身份上下文衔接
> - **掌握 Supabase 托管方案**：利用托管基础设施减少实例管理工作；仍需配置权限、评估成本并维护性能与恢复能力
> - **给出迁移决策建议**：明确什么时候应该从 pgvector 换到 Milvus

pgvector 做 RAG，最大的优势不是速度，而是**简单**。你的文档元数据、用户信息、权限控制——全在同一个数据库里，没有数据同步的烦恼，没有跨系统一致性的问题。这就是 pgvector 派的 RAG 哲学：**宁愿少一点性能，也不要多一套系统**。

想象一下专用向量数据库的典型架构：PostgreSQL 存业务数据，Milvus/Qdrant 存向量，Redis 做缓存，三套系统需要保持同步。文档删除了要同时删 PG 和 Milvus；用户权限变了要重新过滤 payload；出了 bug 要跨三个系统排查日志。而 pgvector 的架构只有一个数据库，所有这些问题天然消失。

当然，pgvector 不是银弹。本文最后会给出明确的迁移阈值——超过这个规模，你就应该认真考虑换专用向量库了。

**阅读前置**：RAG 架构设计模式 向量搜索原理 混合搜索工程实践

**对比参考**：Milvus RAG 集成实战 Qdrant RAG 集成实战

---

## 目录

- [[#一、pgvector RAG 的独特价值体系]]
- [[#二、RAG 专用 Schema 设计]]
- [[#三、文档处理流水线]]
- [[#四、混合搜索实现（SQL 版）]]
- [[#五、LangChain 集成]]
- [[#六、LlamaIndex 集成]]
- [[#七、Supabase 托管方案]]
- [[#八、pgvector vs 专用向量库的选择建议]]
- [[#九、生产运维要点]]

---

## 一、pgvector RAG 的独特价值体系

### 1.1 架构对比：一个数据库 vs 三套系统

先用一张图说清楚 pgvector RAG 和专用向量库方案在架构上的本质差异。

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"PingFang SC, -apple-system, Source Han Serif SC, serif","fontSize":"16px","background":"#FDFBF5","primaryColor":"#FDFBF5","primaryTextColor":"#2D2A26","primaryBorderColor":"#6E6A60","secondaryColor":"#E8EFE8","secondaryBorderColor":"#8FA890","secondaryTextColor":"#2D2A26","tertiaryColor":"#FDFBF5","tertiaryBorderColor":"#9A9488","tertiaryTextColor":"#6E6A60","lineColor":"#6E6A60","textColor":"#2D2A26","mainBkg":"#FDFBF5","nodeBorder":"#2D5A3D","clusterBkg":"#F3EEDF","clusterBorder":"#9A9488","edgeLabelBackground":"#FDFBF5"},"flowchart":{"htmlLabels":true,"curve":"basis","padding":20,"nodeSpacing":60,"rankSpacing":70,"useMaxWidth":false},"themeCSS":".node rect, .node polygon, .node circle { stroke-width: 1.5px; } .edgePath .path { stroke-width: 1.5px; } .cluster-label .nodeLabel, .cluster-label foreignObject { color: #2D2A26 !important; } .edgeLabel, .edgeLabel foreignObject { color: #2D2A26 !important; background-color: #FDFBF5; } .edgeLabel rect { fill: #FDFBF5; }"}}%%
flowchart LR
    subgraph "专用向量库方案"
        direction TB
        A1["PostgreSQL<br/>业务数据 / 用户权限"]
        A2["Milvus / Qdrant<br/>向量数据"]
        A3["应用层<br/>手动同步"]
        A1 <-->|"需要保持同步"| A3
        A2 <-->|"需要保持同步"| A3
    end

    subgraph "pgvector 方案"
        direction TB
        B1["PostgreSQL + pgvector<br/>业务数据 + 向量数据<br/>统一存储 / 统一事务 / 统一权限"]
        B2["应用层<br/>单一数据源"]
        B1 <-->|"直接访问"| B2
    end

    style A1 fill:#fee2e2,stroke:#ef4444
    style A2 fill:#fee2e2,stroke:#ef4444
    style A3 fill:#fef9c3,stroke:#ca8a04
    style B1 fill:#dcfce7,stroke:#16a34a
    style B2 fill:#dbeafe,stroke:#3b82f6
```

这不是在说专用向量库不好。专用向量库在大规模场景下性能碾压 pgvector。问题是：**你真的到了那个规模吗？**

### 1.2 pgvector RAG 的四大结构性优势

**优势一：向量数据和业务数据 JOIN 随意写**

这是 pgvector 最被低估的能力。假设你要实现"只返回用户有权限访问的文档中的相关内容"，在专用向量库方案里：

```text
① 查向量库，获取 Top-50 候选
② 查 PostgreSQL，过滤出用户有权限的文档 ID
③ 在应用层做交集
④ 如果交集不足 Top-5，重复步骤①但扩大召回范围
```

在 pgvector 里只需要一条 SQL：

```sql
SELECT c.content, c.embedding <=> $1 AS distance
FROM chunks c
JOIN documents d ON c.document_id = d.id
JOIN document_permissions dp ON d.id = dp.document_id
WHERE dp.user_id = $2
  AND d.tenant_id = $3
ORDER BY distance
LIMIT 5;
```

**优势二：事务保证向量和元数据的原子一致性**

文档更新时，你不可能同时更新两个系统并保证原子性。在 pgvector 里：

```sql
BEGIN;
  UPDATE documents SET title = '新标题', updated_at = NOW() WHERE id = $1;
  UPDATE chunks SET content = $2, embedding = $3 WHERE document_id = $1;
COMMIT;
-- 要么全成功，要么全回滚，不存在"PG 更新了但向量库没更新"的中间状态
```

**优势三：Row Level Security 实现多租户隔离**

这是 pgvector 比 Milvus/Qdrant 的 payload filter 更优雅的地方。RLS 是数据库级别的安全保证，不依赖应用层代码。即使开发者写了个 bug 忘记加 tenant_id 过滤，RLS 也能兜底。

**优势四：复用已有的 PostgreSQL 运维体系**

你的 DBA 已经有 PG 的监控、备份、告警体系。pgvector 不需要额外学习成本，`pg_stat_statements`、`EXPLAIN ANALYZE`、`pgBadger` 这些工具全都能用。

### 1.3 pgvector RAG 完整数据流

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"PingFang SC, -apple-system, Source Han Serif SC, serif","fontSize":"16px","background":"#FDFBF5","primaryColor":"#FDFBF5","primaryTextColor":"#2D2A26","primaryBorderColor":"#6E6A60","secondaryColor":"#E8EFE8","secondaryBorderColor":"#8FA890","secondaryTextColor":"#2D2A26","tertiaryColor":"#FDFBF5","tertiaryBorderColor":"#9A9488","tertiaryTextColor":"#6E6A60","lineColor":"#6E6A60","textColor":"#2D2A26","mainBkg":"#FDFBF5","nodeBorder":"#2D5A3D","clusterBkg":"#F3EEDF","clusterBorder":"#9A9488","edgeLabelBackground":"#FDFBF5"},"flowchart":{"htmlLabels":true,"curve":"basis","padding":20,"nodeSpacing":60,"rankSpacing":70,"useMaxWidth":false},"themeCSS":".node rect, .node polygon, .node circle { stroke-width: 1.5px; } .edgePath .path { stroke-width: 1.5px; } .cluster-label .nodeLabel, .cluster-label foreignObject { color: #2D2A26 !important; } .edgeLabel, .edgeLabel foreignObject { color: #2D2A26 !important; background-color: #FDFBF5; } .edgeLabel rect { fill: #FDFBF5; }"}}%%
flowchart TB
    subgraph "离线阶段（文档索引）"
        direction LR
        D1["原始文档<br/>PDF / Word / MD / HTML"]
        D2["文档解析<br/>提取文本 + 元数据"]
        D3["语义分块<br/>按段落 / 滑动窗口"]
        D4["生成 Embedding<br/>OpenAI / BGE / Qwen"]
        D5["单事务写入 PostgreSQL<br/>documents + chunks 表"]
        D1 --> D2 --> D3 --> D4 --> D5
    end

    subgraph "在线阶段（检索生成）"
        direction LR
        Q1["用户提问"]
        Q2["Query 向量化<br/>同模型生成"]
        Q3["pgvector 混合搜索<br/>向量搜索 + 全文搜索<br/>RLS 权限过滤"]
        Q4["RRF 融合排序<br/>SQL CTE 实现"]
        Q5["Reranker 精排<br/>可选"]
        Q6["LLM 生成答案<br/>GPT-4 / Claude / Qwen"]
        Q7["含引用来源的回答"]
        Q1 --> Q2 --> Q3 --> Q4 --> Q5 --> Q6 --> Q7
    end

    D5 -.->|"PostgreSQL 统一存储"| Q3

    style D1 fill:#dbeafe,stroke:#3b82f6
    style D5 fill:#dcfce7,stroke:#16a34a
    style Q3 fill:#fef9c3,stroke:#ca8a04
    style Q6 fill:#fce7f3,stroke:#db2777
    style Q7 fill:#f0fdf4,stroke:#16a34a
```

---

## 二、RAG 专用 Schema 设计

### 2.1 核心表设计思路

pgvector RAG 的 Schema 设计要充分利用关系型数据库的优势。不要像设计 NoSQL 那样把所有信息塞进一张宽表，要充分利用规范化设计和外键约束。

**四张核心表的关系**：

| 层级 | 表名 | 说明 |
|------|------|------|
| 顶层 | `tenants` | 租户（多租户隔离） |
| 子层 | `users` | 用户，归属于某租户 |
| 子层 | `documents` | 文档，归属于某租户 |
| 最底层 | `chunks` | 文本块（含向量），归属于某文档 |

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"PingFang SC, -apple-system, Source Han Serif SC, serif","fontSize":"16px","background":"#FDFBF5","primaryColor":"#FDFBF5","primaryTextColor":"#2D2A26","primaryBorderColor":"#6E6A60","secondaryColor":"#E8EFE8","secondaryBorderColor":"#8FA890","secondaryTextColor":"#2D2A26","tertiaryColor":"#FDFBF5","tertiaryBorderColor":"#9A9488","tertiaryTextColor":"#6E6A60","lineColor":"#6E6A60","textColor":"#2D2A26","mainBkg":"#FDFBF5","nodeBorder":"#2D5A3D","clusterBkg":"#F3EEDF","clusterBorder":"#9A9488","edgeLabelBackground":"#FDFBF5"},"flowchart":{"htmlLabels":true,"curve":"basis","padding":20,"nodeSpacing":60,"rankSpacing":70,"useMaxWidth":false},"themeCSS":".node rect, .node polygon, .node circle { stroke-width: 1.5px; } .edgePath .path { stroke-width: 1.5px; } .cluster-label .nodeLabel, .cluster-label foreignObject { color: #2D2A26 !important; } .edgeLabel, .edgeLabel foreignObject { color: #2D2A26 !important; background-color: #FDFBF5; } .edgeLabel rect { fill: #FDFBF5; }"}}%%
erDiagram
    tenants {
        uuid id PK
        varchar name
        jsonb settings
        timestamp created_at
    }
    users {
        uuid id PK
        uuid tenant_id FK
        varchar email
        varchar role
        timestamp created_at
    }
    documents {
        uuid id PK
        uuid tenant_id FK
        uuid created_by FK
        varchar title
        text source_url
        varchar mime_type
        integer total_chunks
        jsonb metadata
        varchar status
        timestamp created_at
        timestamp updated_at
    }
    chunks {
        uuid id PK
        uuid document_id FK
        integer chunk_index
        text content
        vector embedding
        tsvector content_tsv
        integer token_count
        jsonb metadata
        timestamp created_at
    }
    document_permissions {
        uuid id PK
        uuid document_id FK
        uuid user_id FK
        varchar permission_level
    }

    tenants ||--o{ users : "has"
    tenants ||--o{ documents : "owns"
    users ||--o{ documents : "creates"
    documents ||--o{ chunks : "splits_into"
    documents ||--o{ document_permissions : "has"
    users ||--o{ document_permissions : "granted"
```

### 2.2 完整建表 SQL

```sql
-- 启用扩展
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 租户表
-- ============================================================
CREATE TABLE tenants (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(255) NOT NULL,
    settings    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 用户表
-- ============================================================
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email       VARCHAR(255) UNIQUE NOT NULL,
    role        VARCHAR(50) NOT NULL DEFAULT 'viewer',  -- admin, editor, viewer
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_tenant ON users(tenant_id);

-- ============================================================
-- 文档表
-- ============================================================
CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES users(id),
    title           VARCHAR(500) NOT NULL,
    source_url      TEXT,
    mime_type       VARCHAR(100) DEFAULT 'text/plain',
    total_chunks    INTEGER DEFAULT 0,
    metadata        JSONB DEFAULT '{}',
    -- metadata 示例：
    -- {"category": "技术文档", "tags": ["Python", "数据库"], "version": "2.0"}
    status          VARCHAR(50) DEFAULT 'processing',  -- processing, indexed, failed
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_tenant ON documents(tenant_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_metadata ON documents USING GIN(metadata);

-- ============================================================
-- 文本块表（核心表，含向量）
-- ============================================================
CREATE TABLE chunks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index     INTEGER NOT NULL,           -- 在文档中的顺序
    content         TEXT NOT NULL,              -- 原始文本
    embedding       VECTOR(1536),               -- OpenAI text-embedding-3-small
    content_tsv     TSVECTOR,                   -- 全文搜索索引（自动维护）
    token_count     INTEGER,                    -- token 数量
    metadata        JSONB DEFAULT '{}',
    -- metadata 示例：
    -- {"page": 3, "section": "第二章", "heading": "安装配置"}
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, chunk_index)
);

-- 向量索引（HNSW，生产推荐）
CREATE INDEX idx_chunks_embedding ON chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- 全文搜索索引
CREATE INDEX idx_chunks_tsv ON chunks USING GIN(content_tsv);

-- 普通索引
CREATE INDEX idx_chunks_document ON chunks(document_id);
CREATE INDEX idx_chunks_metadata ON chunks USING GIN(metadata);

-- 自动维护 tsvector（中文需要 zhparser 扩展，英文用默认）
CREATE OR REPLACE FUNCTION update_chunks_tsv()
RETURNS TRIGGER AS $$
BEGIN
    NEW.content_tsv := to_tsvector('english', NEW.content);
    -- 中文环境改为：to_tsvector('zhparser', NEW.content)
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chunks_tsv
    BEFORE INSERT OR UPDATE OF content
    ON chunks
    FOR EACH ROW
    EXECUTE FUNCTION update_chunks_tsv();

-- ============================================================
-- 文档权限表（细粒度访问控制）
-- ============================================================
CREATE TABLE document_permissions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id         UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_level    VARCHAR(50) NOT NULL DEFAULT 'read',  -- read, write, admin
    granted_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, user_id)
);

CREATE INDEX idx_permissions_user ON document_permissions(user_id);
CREATE INDEX idx_permissions_document ON document_permissions(document_id);

-- ============================================================
-- 自动更新 updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
```

### 2.3 Row Level Security 多租户隔离

RLS 是 pgvector 多租户方案中最强大的武器。一旦启用，即使应用层代码忘记加 tenant_id 过滤，数据库也会自动隔离数据。

```sql
-- ============================================================
-- 启用 RLS
-- ============================================================
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_permissions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 设置当前会话的用户上下文（应用层在每次连接时调用）
-- ============================================================
-- 在连接池中，每次从池里取连接后执行：
-- SET LOCAL app.current_user_id = '用户UUID';
-- SET LOCAL app.current_tenant_id = '租户UUID';

-- ============================================================
-- documents 表的 RLS 策略
-- ============================================================

-- 策略1：用户可以看到自己租户的所有文档（基础隔离）
CREATE POLICY tenant_isolation ON documents
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- 策略2：细粒度权限（叠加在租户隔离之上）
-- 用户只能看到：自己创建的 OR 被显式授权的文档
CREATE POLICY user_document_access ON documents
    FOR SELECT
    USING (
        created_by = current_setting('app.current_user_id')::UUID
        OR EXISTS (
            SELECT 1 FROM document_permissions dp
            WHERE dp.document_id = documents.id
              AND dp.user_id = current_setting('app.current_user_id')::UUID
        )
    );

-- ============================================================
-- chunks 表的 RLS 策略（通过 JOIN documents 继承权限）
-- ============================================================
CREATE POLICY chunks_via_documents ON chunks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM documents d
            WHERE d.id = chunks.document_id
              AND d.tenant_id = current_setting('app.current_tenant_id')::UUID
              AND (
                  d.created_by = current_setting('app.current_user_id')::UUID
                  OR EXISTS (
                      SELECT 1 FROM document_permissions dp
                      WHERE dp.document_id = d.id
                        AND dp.user_id = current_setting('app.current_user_id')::UUID
                  )
              )
        )
    );

-- ============================================================
-- 应用层调用方式（Python 示例）
-- ============================================================
-- async with pool.acquire() as conn:
--     await conn.execute(
--         "SET LOCAL app.current_user_id = $1; "
--         "SET LOCAL app.current_tenant_id = $2",
--         str(user_id), str(tenant_id)
--     )
--     # 之后所有查询自动应用 RLS，无需手动加 WHERE 条件
```

> [!tip] RLS vs Payload Filter 的关键区别
> Milvus/Qdrant 的 payload filter 是**应用层控制**：如果开发者忘记加过滤条件，数据就会泄露。
> pgvector 的 RLS 是**数据库层控制**：在正确配置策略、使用受 RLS 约束的运行角色，并由可信服务设置身份上下文时，可降低漏写应用过滤条件的风险；超级用户、BYPASSRLS 角色以及通常情况下的表所有者不受同等约束。
> 在金融、医疗等合规要求严格的场景，这个差异非常重要。

### 2.4 权限分配辅助函数

```sql
-- 批量授权：将文档访问权限授予用户
CREATE OR REPLACE FUNCTION grant_document_access(
    p_document_id   UUID,
    p_user_id       UUID,
    p_level         VARCHAR DEFAULT 'read'
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO document_permissions (document_id, user_id, permission_level)
    VALUES (p_document_id, p_user_id, p_level)
    ON CONFLICT (document_id, user_id)
    DO UPDATE SET permission_level = p_level;
END;
$$ LANGUAGE plpgsql;

-- 批量授权给整个团队
CREATE OR REPLACE FUNCTION grant_tenant_document_access(
    p_document_id   UUID,
    p_tenant_id     UUID,
    p_level         VARCHAR DEFAULT 'read'
)
RETURNS INTEGER AS $$
DECLARE
    affected_count INTEGER;
BEGIN
    INSERT INTO document_permissions (document_id, user_id, permission_level)
    SELECT p_document_id, u.id, p_level
    FROM users u
    WHERE u.tenant_id = p_tenant_id
    ON CONFLICT (document_id, user_id) DO NOTHING;

    GET DIAGNOSTICS affected_count = ROW_COUNT;
    RETURN affected_count;
END;
$$ LANGUAGE plpgsql;
```

---

## 三、文档处理流水线

### 3.1 流水线整体设计

文档处理流水线的核心原则：**解析、分块、向量化、入库这四个步骤必须在同一个事务中完成**（或者有幂等的补偿机制）。任何中途失败都应该让文档回到 `processing` 状态，而不是留下"半入库"的脏数据。

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"PingFang SC, -apple-system, Source Han Serif SC, serif","fontSize":"16px","background":"#FDFBF5","primaryColor":"#FDFBF5","primaryTextColor":"#2D2A26","primaryBorderColor":"#6E6A60","secondaryColor":"#E8EFE8","secondaryBorderColor":"#8FA890","secondaryTextColor":"#2D2A26","tertiaryColor":"#FDFBF5","tertiaryBorderColor":"#9A9488","tertiaryTextColor":"#6E6A60","lineColor":"#6E6A60","textColor":"#2D2A26","mainBkg":"#FDFBF5","nodeBorder":"#2D5A3D","clusterBkg":"#F3EEDF","clusterBorder":"#9A9488","edgeLabelBackground":"#FDFBF5"},"flowchart":{"htmlLabels":true,"curve":"basis","padding":20,"nodeSpacing":60,"rankSpacing":70,"useMaxWidth":false},"themeCSS":".node rect, .node polygon, .node circle { stroke-width: 1.5px; } .edgePath .path { stroke-width: 1.5px; } .cluster-label .nodeLabel, .cluster-label foreignObject { color: #2D2A26 !important; } .edgeLabel, .edgeLabel foreignObject { color: #2D2A26 !important; background-color: #FDFBF5; } .edgeLabel rect { fill: #FDFBF5; }"}}%%
flowchart TD
    START["上传文档"]
    P1["创建 documents 记录<br/>status = processing"]
    P2["解析文档内容<br/>提取纯文本 + 元数据"]
    P3["文本分块<br/>RecursiveCharacterTextSplitter"]
    P4["批量生成 Embedding<br/>并发调用 Embedding API"]
    P5["单事务批量写入 chunks<br/>含 content + embedding"]
    P6["更新 documents.status = indexed<br/>更新 total_chunks"]
    END["索引完成"]
    ERR["更新 status = failed<br/>记录错误信息"]

    START --> P1 --> P2 --> P3 --> P4 --> P5 --> P6 --> END
    P2 -->|"解析失败"| ERR
    P4 -->|"API 调用失败"| ERR
    P5 -->|"写入失败"| ERR

    style START fill:#dbeafe,stroke:#3b82f6
    style END fill:#dcfce7,stroke:#16a34a
    style ERR fill:#fee2e2,stroke:#ef4444
    style P5 fill:#fef9c3,stroke:#ca8a04
```

### 3.2 完整流水线代码

```python
"""
pgvector RAG 文档处理流水线
依赖：pip install asyncpg openai langchain-text-splitters pypdf python-docx
"""

import asyncio
import uuid
from typing import Optional
from dataclasses import dataclass

import asyncpg
from openai import AsyncOpenAI
from langchain_text_splitters import RecursiveCharacterTextSplitter


# ============================================================
# 配置
# ============================================================
DATABASE_URL = "postgresql://user:password@localhost:5432/rag_db"
OPENAI_API_KEY = "sk-..."
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536
CHUNK_SIZE = 512        # tokens
CHUNK_OVERLAP = 50
BATCH_SIZE = 100        # 每批插入的 chunk 数量
EMBED_BATCH_SIZE = 20   # 每次调用 Embedding API 的文本数量


@dataclass
class DocumentInfo:
    title: str
    content: str
    source_url: Optional[str] = None
    mime_type: str = "text/plain"
    metadata: dict = None


# ============================================================
# Embedding 服务
# ============================================================
class EmbeddingService:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=OPENAI_API_KEY)

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """批量生成 Embedding，自动分批处理"""
        all_embeddings = []

        for i in range(0, len(texts), EMBED_BATCH_SIZE):
            batch = texts[i: i + EMBED_BATCH_SIZE]
            # 清理文本（API 不接受空字符串）
            batch = [t.replace("\n", " ").strip() or " " for t in batch]

            response = await self.client.embeddings.create(
                model=EMBEDDING_MODEL,
                input=batch
            )
            batch_embeddings = [item.embedding for item in response.data]
            all_embeddings.extend(batch_embeddings)

        return all_embeddings


# ============================================================
# 文档处理流水线
# ============================================================
class DocumentPipeline:
    def __init__(self, db_pool: asyncpg.Pool):
        self.pool = db_pool
        self.embedder = EmbeddingService()
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            length_function=len,  # 生产环境改为 tiktoken 计数
            separators=["\n\n", "\n", "。", "！", "？", ".", "!", "?", " ", ""]
        )

    async def process_document(
        self,
        doc: DocumentInfo,
        tenant_id: str,
        user_id: str
    ) -> str:
        """
        处理单个文档：解析 → 分块 → 向量化 → 写入
        返回 document_id
        使用单事务保证原子性
        """
        document_id = str(uuid.uuid4())

        async with self.pool.acquire() as conn:
            # ── 步骤 1：创建文档记录 ──────────────────────────
            await conn.execute("""
                INSERT INTO documents
                    (id, tenant_id, created_by, title, source_url, mime_type, metadata, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'processing')
            """,
                document_id,
                tenant_id,
                user_id,
                doc.title,
                doc.source_url,
                doc.mime_type,
                str(doc.metadata or {}).replace("'", '"')
            )

            try:
                # ── 步骤 2：文本分块 ──────────────────────────
                chunks_text = self.splitter.split_text(doc.content)
                if not chunks_text:
                    raise ValueError(f"文档 '{doc.title}' 分块结果为空")

                print(f"文档 '{doc.title}' 分块完成，共 {len(chunks_text)} 个 chunk")

                # ── 步骤 3：生成 Embedding ────────────────────
                embeddings = await self.embedder.embed_batch(chunks_text)

                print(f"Embedding 生成完成，维度 {len(embeddings[0])}")

                # ── 步骤 4：单事务批量写入 ────────────────────
                async with conn.transaction():
                    # 批量插入 chunks
                    chunk_records = [
                        (
                            str(uuid.uuid4()),   # id
                            document_id,          # document_id
                            idx,                  # chunk_index
                            text,                 # content
                            embeddings[idx],      # embedding（list[float]）
                            len(text.split()),    # token_count 估算
                        )
                        for idx, text in enumerate(chunks_text)
                    ]

                    await conn.executemany("""
                        INSERT INTO chunks
                            (id, document_id, chunk_index, content, embedding, token_count)
                        VALUES ($1, $2, $3, $4, $5::vector, $6)
                    """, chunk_records)

                    # 更新文档状态
                    await conn.execute("""
                        UPDATE documents
                        SET status = 'indexed',
                            total_chunks = $1,
                            updated_at = NOW()
                        WHERE id = $2
                    """, len(chunks_text), document_id)

                print(f"文档 '{doc.title}' 索引完成，document_id = {document_id}")
                return document_id

            except Exception as e:
                # 任何步骤失败，更新状态为 failed
                await conn.execute("""
                    UPDATE documents
                    SET status = 'failed',
                        metadata = metadata || $1::jsonb,
                        updated_at = NOW()
                    WHERE id = $2
                """, f'{{"error": "{str(e)[:200]}"}}', document_id)
                raise

    async def process_documents_batch(
        self,
        docs: list[DocumentInfo],
        tenant_id: str,
        user_id: str,
        concurrency: int = 3
    ) -> list[str]:
        """
        并发处理多个文档
        concurrency 控制并发数，避免 Embedding API 限速
        """
        semaphore = asyncio.Semaphore(concurrency)

        async def process_with_semaphore(doc):
            async with semaphore:
                return await self.process_document(doc, tenant_id, user_id)

        results = await asyncio.gather(
            *[process_with_semaphore(doc) for doc in docs],
            return_exceptions=True
        )

        successful = [r for r in results if isinstance(r, str)]
        failed = [r for r in results if isinstance(r, Exception)]

        print(f"批量处理完成：{len(successful)} 成功，{len(failed)} 失败")
        return successful


# ============================================================
# 文档解析器（支持多格式）
# ============================================================
class DocumentParser:

    @staticmethod
    def parse_pdf(file_path: str) -> DocumentInfo:
        """解析 PDF 文件"""
        import pypdf

        reader = pypdf.PdfReader(file_path)
        text_parts = []

        for page_num, page in enumerate(reader.pages):
            page_text = page.extract_text()
            if page_text.strip():
                text_parts.append(page_text)

        full_text = "\n\n".join(text_parts)

        return DocumentInfo(
            title=file_path.split("/")[-1].replace(".pdf", ""),
            content=full_text,
            source_url=file_path,
            mime_type="application/pdf",
            metadata={"total_pages": len(reader.pages)}
        )

    @staticmethod
    def parse_docx(file_path: str) -> DocumentInfo:
        """解析 Word 文档"""
        import docx

        doc = docx.Document(file_path)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        full_text = "\n\n".join(paragraphs)

        return DocumentInfo(
            title=file_path.split("/")[-1].replace(".docx", ""),
            content=full_text,
            source_url=file_path,
            mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )

    @staticmethod
    def parse_markdown(file_path: str) -> DocumentInfo:
        """解析 Markdown 文件"""
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        # 提取标题
        lines = content.split("\n")
        title = next(
            (line.lstrip("#").strip() for line in lines if line.startswith("#")),
            file_path.split("/")[-1].replace(".md", "")
        )

        return DocumentInfo(
            title=title,
            content=content,
            source_url=file_path,
            mime_type="text/markdown"
        )


# ============================================================
# 使用示例
# ============================================================
async def main():
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)

    pipeline = DocumentPipeline(pool)
    parser = DocumentParser()

    # 解析文档
    docs = [
        parser.parse_pdf("/docs/技术手册.pdf"),
        parser.parse_markdown("/docs/API文档.md"),
        DocumentInfo(
            title="产品介绍",
            content="这是一段产品介绍文本...",
            metadata={"category": "产品", "version": "1.0"}
        )
    ]

    # 批量处理，最多 3 并发
    doc_ids = await pipeline.process_documents_batch(
        docs=docs,
        tenant_id="tenant-uuid-xxx",
        user_id="user-uuid-xxx",
        concurrency=3
    )

    print(f"成功索引文档 IDs：{doc_ids}")
    await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
```

### 3.3 增量更新与文档删除

```python
class DocumentManager:
    def __init__(self, db_pool: asyncpg.Pool):
        self.pool = db_pool
        self.pipeline = DocumentPipeline(db_pool)

    async def update_document(
        self,
        document_id: str,
        new_doc: DocumentInfo,
        tenant_id: str,
        user_id: str
    ):
        """
        更新文档：删除旧 chunks，重新索引
        当前示例使用两个事务，不保证新旧版本切换的原子性；新索引失败时旧 chunks 已被删除
        """
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                # 删除旧 chunks（CASCADE 自动处理）
                await conn.execute(
                    "DELETE FROM chunks WHERE document_id = $1",
                    document_id
                )

                # 重置文档状态
                await conn.execute("""
                    UPDATE documents
                    SET title = $1, status = 'processing',
                        updated_at = NOW(), total_chunks = 0
                    WHERE id = $2
                """, new_doc.title, document_id)

        # 事务提交后重新索引（避免长事务持有锁）
        # 注意：这里有短暂的"已删除旧数据但新数据未就绪"窗口
        # 生产环境可用 Blue-Green 策略（先写新版本再删旧版本）
        chunks_text = self.pipeline.splitter.split_text(new_doc.content)
        embeddings = await self.pipeline.embedder.embed_batch(chunks_text)

        async with self.pool.acquire() as conn:
            async with conn.transaction():
                chunk_records = [
                    (str(uuid.uuid4()), document_id, idx, text, embeddings[idx], len(text.split()))
                    for idx, text in enumerate(chunks_text)
                ]
                await conn.executemany("""
                    INSERT INTO chunks (id, document_id, chunk_index, content, embedding, token_count)
                    VALUES ($1, $2, $3, $4, $5::vector, $6)
                """, chunk_records)

                await conn.execute("""
                    UPDATE documents
                    SET status = 'indexed', total_chunks = $1, updated_at = NOW()
                    WHERE id = $2
                """, len(chunks_text), document_id)

    async def delete_document(self, document_id: str):
        """
        删除文档（chunks 通过 CASCADE 自动删除）
        """
        async with self.pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM documents WHERE id = $1",
                document_id
            )
            print(f"已删除文档 {document_id}，影响行数：{result}")
```

---

## 四、混合搜索实现（SQL 版）

### 4.1 为什么要混合搜索

假设某评测中纯向量搜索召回率为 62%，混合搜索为 84%，则相对提升约为 35%，绝对提升为 22 个百分点；这里的数值仅为说明计算方式的假设，不代表本文提供了实测结果。原因很直观：

- **向量搜索**擅长语义相似，能找到意思相近但措辞不同的内容
- **全文搜索**擅长精确关键词匹配，能找到包含特定术语、型号、代码的内容

两者互补，覆盖了不同类型的用户查询。

### 4.2 RRF（倒数排名融合）原理

RRF 的公式极其简洁：

```text
RRF_score(d) = Σ (1 / (k + rank_i(d)))
```

其中 `k = 60`（默认值），`rank_i(d)` 是文档 d 在第 i 个检索结果列表中的排名。

```text
示例：文档 A 在向量搜索中排名第 2，在全文搜索中排名第 5
RRF(A) = 1/(60+2) + 1/(60+5) = 0.01613 + 0.01538 = 0.03151

文档 B 在向量搜索中排名第 1，未出现在全文搜索结果中
RRF(B) = 1/(60+1) + 0 = 0.01639

最终排序：B(0.01639) > A(0.03151)?
→ 不对！A > B，因为 A 在两个列表都出现了
```

关键洞察：**同时出现在两个列表中的文档可以累加两项 RRF 得分，但是否超过单列表第一名仍取决于各列表排名与 k 值**。上例中 A 的累加得分高于 B，不能推广为所有双列表命中文档都必然排在前面。

### 4.3 混合搜索 SQL 实现

```sql
-- ============================================================
-- 混合搜索：向量搜索 + 全文搜索 + RRF 融合
-- 参数：
--   $1: 查询向量（float4[]）
--   $2: 查询文本（text）
--   $3: 返回结果数（integer）
--   $4: 候选集大小（integer，建议 50-100）
--   $5: RRF k 值（integer，默认 60）
-- ============================================================

WITH
-- ── CTE 1：向量搜索 ────────────────────────────────────────
vector_search AS (
    SELECT
        c.id          AS chunk_id,
        c.document_id,
        c.content,
        c.metadata    AS chunk_metadata,
        d.title       AS doc_title,
        d.metadata    AS doc_metadata,
        c.embedding <=> $1::vector   AS distance,
        ROW_NUMBER() OVER (ORDER BY c.embedding <=> $1::vector) AS vector_rank
    FROM chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE d.status = 'indexed'
    -- RLS 已在会话级别启用，这里不需要手动加 tenant_id 过滤
    ORDER BY distance
    LIMIT $4  -- 候选集大小（建议 50-100）
),

-- ── CTE 2：全文搜索 ────────────────────────────────────────
fulltext_search AS (
    SELECT
        c.id          AS chunk_id,
        c.document_id,
        c.content,
        c.metadata    AS chunk_metadata,
        d.title       AS doc_title,
        d.metadata    AS doc_metadata,
        ts_rank(c.content_tsv, query) AS ts_score,
        ROW_NUMBER() OVER (ORDER BY ts_rank(c.content_tsv, query) DESC) AS text_rank
    FROM chunks c
    JOIN documents d ON c.document_id = d.id,
    plainto_tsquery('english', $2) query   -- 中文改为 plainto_tsquery('zhparser', $2)
    WHERE d.status = 'indexed'
      AND c.content_tsv @@ query
    ORDER BY ts_score DESC
    LIMIT $4
),

-- ── CTE 3：RRF 融合排序 ───────────────────────────────────
rrf_fusion AS (
    SELECT
        COALESCE(vs.chunk_id, fs.chunk_id)                          AS chunk_id,
        COALESCE(vs.document_id, fs.document_id)                    AS document_id,
        COALESCE(vs.content, fs.content)                            AS content,
        COALESCE(vs.chunk_metadata, fs.chunk_metadata)              AS chunk_metadata,
        COALESCE(vs.doc_title, fs.doc_title)                        AS doc_title,
        COALESCE(vs.doc_metadata, fs.doc_metadata)                  AS doc_metadata,
        -- RRF 得分计算（k=$5，默认60）
        COALESCE(1.0 / ($5::float + vs.vector_rank), 0)
        + COALESCE(1.0 / ($5::float + fs.text_rank), 0)             AS rrf_score,
        vs.distance                                                  AS vector_distance,
        fs.ts_score                                                  AS text_score
    FROM vector_search vs
    FULL OUTER JOIN fulltext_search fs ON vs.chunk_id = fs.chunk_id
)

SELECT
    chunk_id,
    document_id,
    content,
    chunk_metadata,
    doc_title,
    doc_metadata,
    rrf_score,
    vector_distance,
    text_score
FROM rrf_fusion
ORDER BY rrf_score DESC
LIMIT $3;
```

### 4.4 封装成 Python 函数

```python
from pgvector.asyncpg import register_vector
import json


class HybridSearcher:
    def __init__(self, db_pool: asyncpg.Pool):
        self.pool = db_pool
        self.embedder = EmbeddingService()

    async def search(
        self,
        query: str,
        tenant_id: str,
        user_id: str,
        top_k: int = 5,
        candidate_size: int = 50,
        rrf_k: int = 60,
        filter_metadata: dict = None
    ) -> list[dict]:
        """
        混合搜索：向量 + 全文 + RRF
        自动应用 RLS 权限过滤
        """
        # 生成查询向量
        query_embedding = (await self.embedder.embed_batch([query]))[0]

        async with self.pool.acquire() as conn:
            # 注册 pgvector 类型
            await register_vector(conn)

            # 设置用户上下文（触发 RLS）
            await conn.execute(
                "SELECT set_config('app.current_user_id', $1, true), "
                "       set_config('app.current_tenant_id', $2, true)",
                str(user_id), str(tenant_id)
            )

            rows = await conn.fetch("""
                WITH
                vector_search AS (
                    SELECT
                        c.id AS chunk_id, c.document_id, c.content,
                        c.metadata AS chunk_metadata,
                        d.title AS doc_title, d.metadata AS doc_metadata,
                        c.embedding <=> $1::vector AS distance,
                        ROW_NUMBER() OVER (ORDER BY c.embedding <=> $1::vector) AS vector_rank
                    FROM chunks c
                    JOIN documents d ON c.document_id = d.id
                    WHERE d.status = 'indexed'
                    ORDER BY distance
                    LIMIT $4
                ),
                fulltext_search AS (
                    SELECT
                        c.id AS chunk_id, c.document_id, c.content,
                        c.metadata AS chunk_metadata,
                        d.title AS doc_title, d.metadata AS doc_metadata,
                        ts_rank(c.content_tsv, query) AS ts_score,
                        ROW_NUMBER() OVER (ORDER BY ts_rank(c.content_tsv, query) DESC) AS text_rank
                    FROM chunks c
                    JOIN documents d ON c.document_id = d.id,
                    plainto_tsquery('english', $2) query
                    WHERE d.status = 'indexed' AND c.content_tsv @@ query
                    ORDER BY ts_score DESC
                    LIMIT $4
                ),
                rrf_fusion AS (
                    SELECT
                        COALESCE(vs.chunk_id, fs.chunk_id) AS chunk_id,
                        COALESCE(vs.document_id, fs.document_id) AS document_id,
                        COALESCE(vs.content, fs.content) AS content,
                        COALESCE(vs.chunk_metadata, fs.chunk_metadata) AS chunk_metadata,
                        COALESCE(vs.doc_title, fs.doc_title) AS doc_title,
                        COALESCE(vs.doc_metadata, fs.doc_metadata) AS doc_metadata,
                        COALESCE(1.0 / ($5::float + vs.vector_rank), 0)
                        + COALESCE(1.0 / ($5::float + fs.text_rank), 0) AS rrf_score,
                        vs.distance AS vector_distance,
                        fs.ts_score AS text_score
                    FROM vector_search vs
                    FULL OUTER JOIN fulltext_search fs ON vs.chunk_id = fs.chunk_id
                )
                SELECT * FROM rrf_fusion
                ORDER BY rrf_score DESC
                LIMIT $3
            """, query_embedding, query, top_k, candidate_size, rrf_k)

        return [
            {
                "chunk_id": str(row["chunk_id"]),
                "document_id": str(row["document_id"]),
                "content": row["content"],
                "doc_title": row["doc_title"],
                "rrf_score": float(row["rrf_score"]),
                "vector_distance": float(row["vector_distance"]) if row["vector_distance"] else None,
                "text_score": float(row["text_score"]) if row["text_score"] else None,
                "metadata": dict(row["chunk_metadata"] or {}),
            }
            for row in rows
        ]

    async def vector_only_search(
        self,
        query: str,
        tenant_id: str,
        user_id: str,
        top_k: int = 5
    ) -> list[dict]:
        """纯向量搜索（速度更快，适合实时场景）"""
        query_embedding = (await self.embedder.embed_batch([query]))[0]

        async with self.pool.acquire() as conn:
            await register_vector(conn)
            await conn.execute(
                "SELECT set_config('app.current_user_id', $1, true), "
                "       set_config('app.current_tenant_id', $2, true)",
                str(user_id), str(tenant_id)
            )

            rows = await conn.fetch("""
                SELECT
                    c.id AS chunk_id,
                    c.document_id,
                    c.content,
                    d.title AS doc_title,
                    c.embedding <=> $1::vector AS distance,
                    c.metadata AS chunk_metadata
                FROM chunks c
                JOIN documents d ON c.document_id = d.id
                WHERE d.status = 'indexed'
                ORDER BY distance
                LIMIT $2
            """, query_embedding, top_k)

        return [dict(row) for row in rows]
```

### 4.5 存储过程版本（性能更优）

对于高频查询，可以将混合搜索封装成 PostgreSQL 函数，减少网络往返：

```sql
-- 在数据库中创建混合搜索函数
CREATE OR REPLACE FUNCTION hybrid_search(
    query_embedding VECTOR(1536),
    query_text      TEXT,
    match_count     INTEGER DEFAULT 5,
    candidate_count INTEGER DEFAULT 50,
    rrf_k           INTEGER DEFAULT 60
)
RETURNS TABLE (
    chunk_id        UUID,
    document_id     UUID,
    content         TEXT,
    doc_title       VARCHAR,
    rrf_score       FLOAT,
    vector_distance FLOAT,
    text_score      FLOAT,
    metadata        JSONB
)
LANGUAGE SQL STABLE
AS $$
    WITH
    vector_search AS (
        SELECT
            c.id, c.document_id, c.content, d.title,
            c.metadata, c.embedding <=> query_embedding AS distance,
            ROW_NUMBER() OVER (ORDER BY c.embedding <=> query_embedding) AS vrank
        FROM chunks c
        JOIN documents d ON c.document_id = d.id
        WHERE d.status = 'indexed'
        ORDER BY distance LIMIT candidate_count
    ),
    fulltext_search AS (
        SELECT
            c.id, c.document_id, c.content, d.title,
            c.metadata, ts_rank(c.content_tsv, q) AS ts_score,
            ROW_NUMBER() OVER (ORDER BY ts_rank(c.content_tsv, q) DESC) AS frank
        FROM chunks c
        JOIN documents d ON c.document_id = d.id,
        plainto_tsquery('english', query_text) q
        WHERE d.status = 'indexed' AND c.content_tsv @@ q
        ORDER BY ts_score DESC LIMIT candidate_count
    ),
    fused AS (
        SELECT
            COALESCE(vs.id, fs.id)                               AS chunk_id,
            COALESCE(vs.document_id, fs.document_id)             AS document_id,
            COALESCE(vs.content, fs.content)                     AS content,
            COALESCE(vs.title, fs.title)                         AS doc_title,
            COALESCE(1.0/(rrf_k + vs.vrank), 0)
            + COALESCE(1.0/(rrf_k + fs.frank), 0)               AS rrf_score,
            vs.distance, fs.ts_score,
            COALESCE(vs.metadata, fs.metadata)                   AS metadata
        FROM vector_search vs
        FULL OUTER JOIN fulltext_search fs ON vs.id = fs.id
    )
    SELECT chunk_id, document_id, content, doc_title,
           rrf_score, distance, ts_score, metadata
    FROM fused
    ORDER BY rrf_score DESC
    LIMIT match_count;
$$;

-- 调用方式（假设特定测试出现 20-30% 提速，也不能外推为通用结论；本文未提供对应测试，函数封装本身不保证加速）
SELECT * FROM hybrid_search(
    '[0.1, 0.2, ...]'::vector,  -- 查询向量
    'pgvector 安装配置',          -- 查询文本
    5,                            -- 返回 5 条
    50,                           -- 候选集 50 条
    60                            -- RRF k=60
);
```

---

## 五、LangChain 集成

### 5.1 基础配置

```python
"""
LangChain + pgvector 集成
依赖：pip install langchain-postgres langchain-openai psycopg2-binary
"""

from langchain_postgres import PGVector
from langchain_postgres.vectorstores import PGVector
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.schema import Document
from langchain.prompts import ChatPromptTemplate
from langchain.schema.runnable import RunnablePassthrough
from langchain.schema.output_parser import StrOutputParser


# ============================================================
# 数据库连接字符串
# ============================================================
CONNECTION_STRING = "postgresql+psycopg2://user:password@localhost:5432/rag_db"


# ============================================================
# 初始化 PGVector Vectorstore
# ============================================================
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

vectorstore = PGVector(
    embeddings=embeddings,
    collection_name="rag_documents",   # 对应 PostgreSQL 中的集合名称
    connection=CONNECTION_STRING,
    use_jsonb=True                      # 使用 JSONB 存储元数据，支持过滤
)


# ============================================================
# 批量写入文档
# ============================================================
def index_documents(documents: list[Document]) -> list[str]:
    """
    将 LangChain Document 对象批量写入 pgvector
    Document 格式：Document(page_content="...", metadata={"source": "...", "tenant_id": "..."})
    """
    ids = vectorstore.add_documents(documents)
    print(f"已写入 {len(ids)} 个文档块")
    return ids


# ============================================================
# 基础检索
# ============================================================
retriever = vectorstore.as_retriever(
    search_type="similarity",
    search_kwargs={"k": 5}
)

# 带分数的检索
docs_with_scores = vectorstore.similarity_search_with_score(
    query="pgvector 如何安装",
    k=5
)

for doc, score in docs_with_scores:
    print(f"距离：{score:.4f} | 来源：{doc.metadata.get('source', 'unknown')}")
    print(f"内容：{doc.page_content[:100]}...")
    print()
```

### 5.2 带权限过滤的 Retriever

这是 pgvector + LangChain 集成中最有价值的部分：利用 metadata filter 实现租户隔离。

```python
from langchain_core.vectorstores import VectorStoreRetriever
from langchain_core.callbacks import CallbackManagerForRetrieverRun
from typing import List
import asyncpg


class RLSAwareRetriever(VectorStoreRetriever):
    """
    感知 RLS 的 Retriever
    通过在每次检索前设置数据库会话变量来激活 Row Level Security
    """

    user_id: str
    tenant_id: str
    db_pool: asyncpg.Pool = None

    class Config:
        arbitrary_types_allowed = True

    def _get_relevant_documents(
        self,
        query: str,
        *,
        run_manager: CallbackManagerForRetrieverRun
    ) -> List[Document]:
        raise NotImplementedError("请使用 aget_relevant_documents 异步方法")

    async def aget_relevant_documents(
        self,
        query: str,
        *,
        run_manager: CallbackManagerForRetrieverRun = None
    ) -> List[Document]:
        """
        异步检索，在查询前设置 RLS 上下文
        """
        # 方案1：通过 metadata filter 实现软隔离（不需要 RLS）
        # 适合多数场景，简单可靠
        docs = await self.vectorstore.asimilarity_search(
            query=query,
            k=self.search_kwargs.get("k", 5),
            filter={
                "tenant_id": self.tenant_id,
                # 可以加更多过滤条件
                # "category": "技术文档"
            }
        )
        return docs

    @classmethod
    def from_vectorstore(
        cls,
        vectorstore: PGVector,
        user_id: str,
        tenant_id: str,
        k: int = 5
    ) -> "RLSAwareRetriever":
        return cls(
            vectorstore=vectorstore,
            user_id=user_id,
            tenant_id=tenant_id,
            search_kwargs={"k": k}
        )


# ============================================================
# 使用权限感知 Retriever 构建 RAG Chain
# ============================================================
def build_rag_chain(user_id: str, tenant_id: str):

    # 带权限过滤的检索器
    retriever = RLSAwareRetriever.from_vectorstore(
        vectorstore=vectorstore,
        user_id=user_id,
        tenant_id=tenant_id,
        k=5
    )

    # Prompt 模板
    prompt = ChatPromptTemplate.from_template("""
你是一个知识库问答助手。请根据以下检索到的上下文回答用户问题。
如果上下文中没有相关信息，请直接说"我在知识库中没有找到相关信息"，不要编造答案。

上下文：
{context}

用户问题：{question}

回答：""")

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    def format_docs(docs: list[Document]) -> str:
        return "\n\n---\n\n".join([
            f"来源：{doc.metadata.get('source', '未知')}\n{doc.page_content}"
            for doc in docs
        ])

    # LCEL 链
    chain = (
        {"context": retriever | format_docs, "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )

    return chain


# ============================================================
# 完整使用示例
# ============================================================
async def demo_langchain_rag():
    # 1. 写入文档
    docs = [
        Document(
            page_content="pgvector 是 PostgreSQL 的向量扩展，支持精确和近似向量搜索。",
            metadata={"source": "pgvector文档", "tenant_id": "tenant-001", "category": "技术"}
        ),
        Document(
            page_content="安装 pgvector：CREATE EXTENSION vector; 即可启用。",
            metadata={"source": "安装指南", "tenant_id": "tenant-001", "category": "教程"}
        ),
        Document(
            page_content="pgvector 支持 L2 距离、余弦相似度和内积三种距离度量方式。",
            metadata={"source": "pgvector文档", "tenant_id": "tenant-001", "category": "技术"}
        ),
    ]
    index_documents(docs)

    # 2. 构建 RAG 链（指定用户和租户）
    chain = build_rag_chain(
        user_id="user-123",
        tenant_id="tenant-001"
    )

    # 3. 提问
    answer = await chain.ainvoke("pgvector 支持哪些距离度量方式？")
    print(f"回答：{answer}")
```

### 5.3 流式输出 RAG

```python
from langchain.callbacks import StreamingStdOutCallbackHandler


async def streaming_rag_demo():
    """流式输出 RAG 响应"""

    retriever = vectorstore.as_retriever(
        search_kwargs={"k": 5, "filter": {"tenant_id": "tenant-001"}}
    )

    llm_streaming = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0,
        streaming=True
    )

    prompt = ChatPromptTemplate.from_template("""
基于以下上下文回答问题：
{context}

问题：{question}
""")

    chain = (
        {"context": retriever | (lambda docs: "\n\n".join(d.page_content for d in docs)),
         "question": RunnablePassthrough()}
        | prompt
        | llm_streaming
        | StrOutputParser()
    )

    print("回答（流式）：", end="", flush=True)
    async for chunk in chain.astream("pgvector 的安装方式是什么？"):
        print(chunk, end="", flush=True)
    print()


# ============================================================
# 带引用来源的 RAG
# ============================================================
async def rag_with_citations():
    """返回答案的同时返回引用来源"""

    retriever = vectorstore.as_retriever(
        search_kwargs={"k": 5, "filter": {"tenant_id": "tenant-001"}}
    )

    query = "pgvector 支持哪些索引类型？"

    # 同时获取文档和生成答案
    retrieved_docs = await retriever.aget_relevant_documents(query)

    context = "\n\n".join([
        f"[文档{i+1}] {doc.page_content}"
        for i, doc in enumerate(retrieved_docs)
    ])

    prompt = ChatPromptTemplate.from_template("""
基于以下上下文回答问题，回答时请标注引用的文档编号（如[文档1]）：
{context}

问题：{question}
""")

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    chain = prompt | llm | StrOutputParser()

    answer = await chain.ainvoke({"context": context, "question": query})

    print(f"回答：{answer}")
    print("\n引用来源：")
    for i, doc in enumerate(retrieved_docs):
        print(f"  [文档{i+1}] {doc.metadata.get('source', '未知')}")
```

---

## 六、LlamaIndex 集成

### 6.1 PGVectorStore 基础配置

```python
"""
LlamaIndex + pgvector 集成
依赖：pip install llama-index llama-index-vector-stores-postgres llama-index-embeddings-openai
"""

from llama_index.core import VectorStoreIndex, StorageContext, Settings
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.schema import TextNode, Document
from llama_index.vector_stores.postgres import PGVectorStore
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI
import psycopg2


# ============================================================
# 全局配置
# ============================================================
Settings.embed_model = OpenAIEmbedding(
    model="text-embedding-3-small",
    embed_batch_size=20
)
Settings.llm = OpenAI(model="gpt-4o-mini", temperature=0)
Settings.chunk_size = 512
Settings.chunk_overlap = 50


# ============================================================
# 初始化 PGVectorStore
# ============================================================
def create_vector_store(table_name: str = "llamaindex_chunks") -> PGVectorStore:
    """
    创建 LlamaIndex 的 pgvector 存储
    """
    vector_store = PGVectorStore.from_params(
        database="rag_db",
        host="localhost",
        password="password",
        port=5432,
        user="postgres",
        table_name=table_name,
        embed_dim=1536,
        # HNSW 索引配置
        hnsw_kwargs={
            "hnsw_m": 16,
            "hnsw_ef_construction": 64,
            "hnsw_ef_search": 40,
            "hnsw_dist_method": "vector_cosine_ops",
        },
        # 混合搜索配置
        hybrid_search=True,
        text_search_config="english",  # 中文改为 "zhparser"
    )
    return vector_store


# ============================================================
# 构建索引并写入文档
# ============================================================
def build_index(documents: list[Document], table_name: str = "llamaindex_chunks") -> VectorStoreIndex:
    """
    从文档列表构建 pgvector 索引
    """
    vector_store = create_vector_store(table_name)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)

    # 直接从文档构建索引（LlamaIndex 自动分块和向量化）
    index = VectorStoreIndex.from_documents(
        documents,
        storage_context=storage_context,
        show_progress=True
    )

    print(f"索引构建完成，表名：{table_name}")
    return index


# ============================================================
# 从已有数据库加载索引
# ============================================================
def load_existing_index(table_name: str = "llamaindex_chunks") -> VectorStoreIndex:
    """
    从已有的 pgvector 表加载索引（不重新索引，节省费用）
    """
    vector_store = create_vector_store(table_name)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)

    index = VectorStoreIndex.from_vector_store(
        vector_store=vector_store,
        storage_context=storage_context
    )
    return index
```

### 6.2 查询引擎配置

```python
from llama_index.core.retrievers import VectorIndexRetriever
from llama_index.core.query_engine import RetrieverQueryEngine
from llama_index.core.postprocessor import SimilarityPostprocessor
from llama_index.core.response_synthesizers import get_response_synthesizer


def build_query_engine(
    index: VectorStoreIndex,
    top_k: int = 5,
    similarity_cutoff: float = 0.7,
    use_hybrid: bool = True
) -> RetrieverQueryEngine:
    """
    构建带过滤和后处理的查询引擎
    """
    # 配置检索器
    retriever = VectorIndexRetriever(
        index=index,
        similarity_top_k=top_k,
        vector_store_query_mode="hybrid" if use_hybrid else "default",
        alpha=0.5,           # hybrid 模式下向量搜索的权重（0.5 表示均等）
    )

    # 相似度过滤（过滤相关性太低的结果）
    postprocessor = SimilarityPostprocessor(similarity_cutoff=similarity_cutoff)

    # 响应合成器
    response_synthesizer = get_response_synthesizer(
        response_mode="compact",  # compact / tree_summarize / simple_summarize
        verbose=True
    )

    query_engine = RetrieverQueryEngine(
        retriever=retriever,
        node_postprocessors=[postprocessor],
        response_synthesizer=response_synthesizer
    )

    return query_engine


# ============================================================
# 带元数据过滤的查询
# ============================================================
from llama_index.core.vector_stores.types import MetadataFilter, MetadataFilters, FilterOperator


def query_with_filter(
    index: VectorStoreIndex,
    query: str,
    tenant_id: str,
    category: str = None,
    top_k: int = 5
):
    """
    带元数据过滤的查询（实现租户隔离和类别过滤）
    """
    filters = [
        MetadataFilter(
            key="tenant_id",
            value=tenant_id,
            operator=FilterOperator.EQ
        )
    ]

    if category:
        filters.append(MetadataFilter(
            key="category",
            value=category,
            operator=FilterOperator.EQ
        ))

    retriever = VectorIndexRetriever(
        index=index,
        similarity_top_k=top_k,
        filters=MetadataFilters(filters=filters),
        vector_store_query_mode="hybrid"
    )

    query_engine = RetrieverQueryEngine.from_args(
        retriever=retriever,
        response_mode="compact"
    )

    response = query_engine.query(query)

    print(f"问题：{query}")
    print(f"回答：{response.response}")
    print("\n引用节点：")
    for node in response.source_nodes:
        print(f"  - 相似度：{node.score:.4f} | {node.metadata.get('source', 'unknown')}")

    return response


# ============================================================
# 完整使用示例
# ============================================================
async def demo_llamaindex_rag():
    from llama_index.core import SimpleDirectoryReader

    # 1. 加载文档
    documents = SimpleDirectoryReader("/path/to/docs").load_data()

    # 添加租户元数据
    for doc in documents:
        doc.metadata["tenant_id"] = "tenant-001"
        doc.metadata["category"] = "技术文档"

    # 2. 构建索引
    index = build_index(documents)

    # 3. 查询（带过滤）
    response = query_with_filter(
        index=index,
        query="pgvector 的 HNSW 索引如何配置？",
        tenant_id="tenant-001",
        category="技术文档",
        top_k=5
    )
```

### 6.3 高级：Text-to-SQL + 向量搜索联合查询

LlamaIndex 的一个独特能力：在 pgvector 上同时做 Text-to-SQL（结构化查询）和向量搜索，非常适合"半结构化"知识库场景。

```python
from llama_index.core.indices.struct_store import PGVectorSQLQueryEngine
from sqlalchemy import create_engine, MetaData


def build_sql_vector_engine():
    """
    Text-to-SQL + Vector Search 联合查询引擎
    适合场景：知识库中既有结构化数据（表格、统计）又有非结构化文本
    """
    engine = create_engine(
        "postgresql+psycopg2://user:password@localhost:5432/rag_db"
    )

    # 让 LlamaIndex 感知数据库 schema
    metadata = MetaData()
    metadata.reflect(bind=engine)

    vector_store = create_vector_store()

    # 联合查询引擎
    query_engine = PGVectorSQLQueryEngine(
        engine=engine,
        schema=metadata,
        vector_store=vector_store,
        embed_model=Settings.embed_model,
        llm=Settings.llm
    )

    # 示例查询：自动判断用 SQL 还是向量搜索
    response = query_engine.query(
        "2024 年第四季度销售额最高的产品类别是哪个，相关的产品介绍文档有什么内容？"
        # 这个查询会被拆分为：
        # ① SQL 查询：SELECT category, SUM(sales) FROM ... WHERE quarter = 'Q4 2024' GROUP BY ...
        # ② 向量查询：搜索相关产品介绍
        # ③ 综合两个结果回答
    )

    return response
```

---

## 七、Supabase 托管方案

### 7.1 为什么选 Supabase

Supabase 是目前最成熟的 pgvector 托管方案。它内置 pgvector，提供了：

- **托管基础设施**：减少 PostgreSQL 实例管理工作，但仍需关注套餐限制、权限、性能、备份覆盖与恢复演练
- **内置 API**：自动生成 REST API 和实时订阅
- **Auth 集成**：用户认证和 RLS 深度集成
- **Edge Functions**：可以在数据库旁边运行 Serverless 函数
- **免费套餐**：足够个人项目和 POC 使用

可将存储超过 160 万个向量 Embedding 作为容量评估的假设场景；本文未提供对应用户案例或测试条件，不能据此认定性能表现良好。

### 7.2 Supabase RAG 快速上手

```sql
-- 在 Supabase SQL Editor 中执行

-- 1. 启用 pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 创建文档表
CREATE TABLE documents (
    id          BIGSERIAL PRIMARY KEY,
    content     TEXT NOT NULL,
    embedding   VECTOR(1536),
    metadata    JSONB DEFAULT '{}',
    user_id     UUID REFERENCES auth.users(id),   -- 关联 Supabase Auth
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 创建 HNSW 索引
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops);

-- 4. 启用 RLS（关联 Supabase Auth 用户）
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own documents"
    ON documents FOR ALL
    USING (auth.uid() = user_id);

-- 5. 创建向量搜索函数（供 Python/JS 客户端调用；此处不含全文检索或 RRF 融合）
CREATE OR REPLACE FUNCTION match_documents (
    query_embedding VECTOR(1536),
    match_count     INT DEFAULT 5,
    filter          JSONB DEFAULT '{}'
)
RETURNS TABLE (
    id          BIGINT,
    content     TEXT,
    metadata    JSONB,
    similarity  FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.content,
        d.metadata,
        1 - (d.embedding <=> query_embedding) AS similarity
    FROM documents d
    WHERE d.metadata @> filter
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
```

### 7.3 Python 客户端集成

```python
"""
Supabase + pgvector Python 集成
依赖：pip install supabase openai
"""

import os
from openai import OpenAI
from supabase import create_client, Client


SUPABASE_URL = os.getenv("SUPABASE_URL")           # https://xxx.supabase.co
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")       # anon public key
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
openai_client = OpenAI(api_key=OPENAI_API_KEY)


def get_embedding(text: str) -> list[float]:
    """生成文本 Embedding"""
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text.replace("\n", " ")
    )
    return response.data[0].embedding


def insert_document(content: str, metadata: dict = None) -> dict:
    """
    插入文档到 Supabase（RLS 自动应用当前登录用户）
    需要先调用 supabase.auth.sign_in_with_password() 登录
    """
    embedding = get_embedding(content)

    result = supabase.table("documents").insert({
        "content": content,
        "embedding": embedding,
        "metadata": metadata or {}
    }).execute()

    return result.data[0] if result.data else None


def search_documents(
    query: str,
    match_count: int = 5,
    filter_metadata: dict = None
) -> list[dict]:
    """
    语义搜索（调用 Supabase RPC 函数）
    RLS 自动过滤，只返回当前用户的文档
    """
    query_embedding = get_embedding(query)

    result = supabase.rpc(
        "match_documents",
        {
            "query_embedding": query_embedding,
            "match_count": match_count,
            "filter": filter_metadata or {}
        }
    ).execute()

    return result.data


def rag_query(question: str, match_count: int = 5) -> str:
    """
    完整 RAG 流程：检索 + 生成
    """
    # 1. 语义检索
    relevant_docs = search_documents(question, match_count=match_count)

    if not relevant_docs:
        return "我在知识库中没有找到相关信息。"

    # 2. 构建上下文
    context = "\n\n".join([
        f"相关度：{doc['similarity']:.2%}\n{doc['content']}"
        for doc in relevant_docs
    ])

    # 3. LLM 生成答案
    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "你是一个知识库问答助手。只根据提供的上下文回答问题，如果上下文中没有答案，请直接说明。"
            },
            {
                "role": "user",
                "content": f"上下文：\n{context}\n\n问题：{question}"
            }
        ],
        temperature=0
    )

    return response.choices[0].message.content


# ============================================================
# 使用示例
# ============================================================
if __name__ == "__main__":
    # 登录（Supabase Auth）
    supabase.auth.sign_in_with_password({
        "email": "user@example.com",
        "password": "password"
    })

    # 写入文档
    insert_document(
        content="pgvector 支持三种距离度量：L2 距离（<->）、余弦相似度（<=>）、内积（<#>）。",
        metadata={"category": "技术文档", "source": "pgvector官方文档"}
    )

    # RAG 问答
    answer = rag_query("pgvector 支持哪些距离计算方式？")
    print(f"回答：{answer}")
```

### 7.4 JavaScript/TypeScript 集成

```typescript
// 依赖：npm install @supabase/supabase-js openai

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })


// 生成 Embedding
async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.replace(/\n/g, ' ')
  })
  return response.data[0].embedding
}


// 语义搜索
async function searchDocuments(
  query: string,
  matchCount: number = 5
): Promise<Array<{ id: number; content: string; similarity: number }>> {
  const embedding = await getEmbedding(query)

  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: embedding,
    match_count: matchCount,
    filter: {}
  })

  if (error) throw error
  return data
}


// RAG 问答（流式）
async function streamingRag(question: string): Promise<void> {
  const docs = await searchDocuments(question)

  const context = docs
    .map(d => d.content)
    .join('\n\n---\n\n')

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    stream: true,
    messages: [
      { role: 'system', content: '你是知识库助手，只根据提供的上下文回答。' },
      { role: 'user', content: `上下文：\n${context}\n\n问题：${question}` }
    ]
  })

  process.stdout.write('回答：')
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content ?? ''
    process.stdout.write(content)
  }
  console.log()
}


// Edge Function 示例（部署到 Supabase Edge）
// supabase/functions/rag-query/index.ts
export default async function handler(req: Request): Promise<Response> {
  const { question, userId } = await req.json()

  // 验证用户身份（使用 JWT）
  const authHeader = req.headers.get('Authorization')!
  const supabaseUser = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const docs = await searchDocuments(question)
  const context = docs.map(d => d.content).join('\n\n')

  // 生成答案...
  const answer = `基于检索到的 ${docs.length} 个文档块的回答...`

  return new Response(JSON.stringify({ answer, sources: docs }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
```

### 7.5 Supabase 生产优化建议

```sql
-- 1. 为高频过滤字段创建 GIN 索引
CREATE INDEX ON documents USING GIN(metadata);

-- 2. 分区表（超过 100 万行时考虑）
-- 对 user_id 做哈希分区以组织数据；多个用户可能落入同一分区，分区本身不提供访问隔离，仍需独立配置权限与 RLS
CREATE TABLE documents_partitioned (
    LIKE documents INCLUDING ALL
) PARTITION BY HASH (user_id);

CREATE TABLE documents_p0 PARTITION OF documents_partitioned
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE documents_p1 PARTITION OF documents_partitioned
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
-- ...

-- 3. 使用 pg_cron 定期更新统计信息
SELECT cron.schedule('0 2 * * *', 'VACUUM ANALYZE documents');
```

---

## 八、pgvector vs 专用向量库的选择建议

### 8.1 核心选择框架

这是本文最务实的部分。把话说清楚：pgvector 不适合所有人。知道什么时候应该换工具，比知道怎么用工具更重要。

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"PingFang SC, -apple-system, Source Han Serif SC, serif","fontSize":"16px","background":"#FDFBF5","primaryColor":"#FDFBF5","primaryTextColor":"#2D2A26","primaryBorderColor":"#6E6A60","secondaryColor":"#E8EFE8","secondaryBorderColor":"#8FA890","secondaryTextColor":"#2D2A26","tertiaryColor":"#FDFBF5","tertiaryBorderColor":"#9A9488","tertiaryTextColor":"#6E6A60","lineColor":"#6E6A60","textColor":"#2D2A26","mainBkg":"#FDFBF5","nodeBorder":"#2D5A3D","clusterBkg":"#F3EEDF","clusterBorder":"#9A9488","edgeLabelBackground":"#FDFBF5"},"flowchart":{"htmlLabels":true,"curve":"basis","padding":20,"nodeSpacing":60,"rankSpacing":70,"useMaxWidth":false},"themeCSS":".node rect, .node polygon, .node circle { stroke-width: 1.5px; } .edgePath .path { stroke-width: 1.5px; } .cluster-label .nodeLabel, .cluster-label foreignObject { color: #2D2A26 !important; } .edgeLabel, .edgeLabel foreignObject { color: #2D2A26 !important; background-color: #FDFBF5; } .edgeLabel rect { fill: #FDFBF5; }"}}%%
flowchart TD
    S1{"数据规模<br/>向量数量"}
    S2{"并发查询<br/>QPS"}
    S3{"是否有<br/>现有 PG 基础设施"}
    S4{"团队是否有<br/>PG 运维经验"}
    S5{"是否需要<br/>多模态向量"}

    S1 -->|"< 100 万"| S2
    S1 -->|"> 500 万"| R_MILVUS["考虑迁移到<br/>Milvus / Qdrant"]
    S1 -->|"100-500 万"| S3

    S2 -->|"< 100 QPS"| S3
    S2 -->|"> 500 QPS"| R_MILVUS
    S2 -->|"100-500 QPS"| S4

    S3 -->|"是"| R_PGVECTOR["推荐 pgvector<br/>复用现有基础设施"]
    S3 -->|"否"| S4

    S4 -->|"是"| R_PGVECTOR
    S4 -->|"否"| S5

    S5 -->|"是"| R_MILVUS
    S5 -->|"否"| R_SUPABASE["推荐 Supabase<br/>托管 pgvector"]

    style R_PGVECTOR fill:#dcfce7,stroke:#16a34a
    style R_MILVUS fill:#fee2e2,stroke:#ef4444
    style R_SUPABASE fill:#dbeafe,stroke:#3b82f6
```

### 8.2 量化的迁移阈值

以下数值作为容量与迁移讨论的假设分档，不代表本文提供了社区实测或生产案例证据；实际边界取决于硬件、向量维度、索引、过滤条件、负载及业务目标：

| 指标 | pgvector 舒适区 | 警戒线 | 建议迁移到专用向量库 |
|------|----------------|--------|---------------------|
| 向量数量 | < 100 万 | 100-500 万 | > 500 万 |
| 向量维度 | 768 / 1536 | 3072 | 自定义超大维度 |
| 单次查询延迟（P99） | < 100ms | 100-500ms | > 500ms（且业务敏感） |
| 并发 QPS | < 100 | 100-500 | > 500 |
| 每日新增向量 | < 10 万 | 10-100 万 | > 100 万 |
| 索引构建时间 | < 1 小时 | 1-8 小时 | > 8 小时（影响业务） |

> [!warning] 警戒线不是绝对红线
> 500 万向量的 pgvector 集群通过合理的硬件配置（NVMe SSD + 大内存）可以跑得很好。
> 真正该触发迁移讨论的，是当**你开始把大量精力花在优化 pgvector 性能**而不是业务功能上的时候。

### 8.3 详细场景对比

| 场景 | pgvector | Milvus | Qdrant | 推荐 |
|------|----------|--------|--------|------|
| 企业内部知识库（< 50 万文档） | 优秀 | 过度 | 合适 | pgvector |
| 多租户 SaaS 产品（RLS 需求强） | 优秀 | 需额外实现 | 需额外实现 | pgvector |
| 电商商品向量搜索（> 1000 万 SKU） | 勉强 | 优秀 | 优秀 | Milvus/Qdrant |
| 实时推荐系统（< 50ms 延迟要求） | 有风险 | 优秀 | 优秀 | Milvus/Qdrant |
| 个人项目 / POC | 优秀 | 复杂 | 合适 | pgvector (Supabase) |
| 多模态（图像 + 文本向量）| 有限 | 原生支持 | 原生支持 | Milvus |
| 已有 PostgreSQL 技术栈 | 天然优势 | 额外学习 | 额外学习 | pgvector |
| Serverless 架构 | 受限 | 不适合 | 适合 | Qdrant Cloud |

### 8.4 渐进式迁移策略

如果你从 pgvector 出发，未来可能需要迁移，建议从一开始就保留迁移的灵活性：

```python
"""
抽象层设计：隐藏底层向量库的差异
该抽象可减少调用层改动；实际迁移仍需实现后端方法，并迁移数据、重建索引、适配过滤与授权语义及评估检索结果
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class SearchResult:
    id: str
    content: str
    score: float
    metadata: dict


class VectorSearchBackend(ABC):
    """向量搜索后端的抽象接口"""

    @abstractmethod
    async def insert(self, texts: list[str], metadata: list[dict]) -> list[str]:
        pass

    @abstractmethod
    async def search(
        self,
        query: str,
        top_k: int = 5,
        filter_metadata: Optional[dict] = None
    ) -> list[SearchResult]:
        pass

    @abstractmethod
    async def delete(self, ids: list[str]) -> None:
        pass


class PGVectorBackend(VectorSearchBackend):
    """pgvector 实现"""

    def __init__(self, db_pool, embedder):
        self.pool = db_pool
        self.embedder = embedder

    async def insert(self, texts, metadata):
        # pgvector 实现...
        pass

    async def search(self, query, top_k=5, filter_metadata=None):
        # pgvector 混合搜索实现...
        pass

    async def delete(self, ids):
        pass


class MilvusBackend(VectorSearchBackend):
    """Milvus 实现（迁移时替换）"""

    def __init__(self, collection_name: str, embedder):
        self.collection_name = collection_name
        self.embedder = embedder

    async def insert(self, texts, metadata):
        # Milvus 实现...
        pass

    async def search(self, query, top_k=5, filter_metadata=None):
        # Milvus 实现...
        pass

    async def delete(self, ids):
        pass


class RAGService:
    """RAG 服务（与底层向量库解耦）"""

    def __init__(self, backend: VectorSearchBackend, llm_client):
        self.backend = backend
        self.llm = llm_client

    async def query(self, question: str, tenant_id: str) -> str:
        # 检索
        results = await self.backend.search(
            query=question,
            top_k=5,
            filter_metadata={"tenant_id": tenant_id}
        )

        # 组装上下文
        context = "\n\n".join([r.content for r in results])

        # 生成答案（与向量库无关）
        # ...
        return "答案"


# 使用示意：完成后端实现、数据迁移及授权与检索验证后，可在此切换后端实例
# backend = PGVectorBackend(pool, embedder)       # 当前方案
# backend = MilvusBackend("rag_docs", embedder)   # 迁移后方案
# rag_service = RAGService(backend, llm_client)   # 代码不变
```

### 8.5 pgvector 性能调优参考

在决定迁移之前，先确认你已经做了这些优化：

```sql
-- ============================================================
-- 1. HNSW 索引调优
-- ============================================================
-- 默认参数（m=16, ef_construction=64）适合大多数场景
-- 如果召回率不够，增大 m 和 ef_construction
-- 如果构建速度太慢，减小 ef_construction
DROP INDEX IF EXISTS idx_chunks_embedding;
CREATE INDEX idx_chunks_embedding ON chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- 查询时的 ef_search（越大越精确，越慢）
SET hnsw.ef_search = 100;  -- 默认 40

-- ============================================================
-- 2. 内存配置（关键！）
-- ============================================================
-- postgresql.conf 优化
-- shared_buffers = 内存的 25%（例如 32GB 内存 → 8GB）
-- effective_cache_size = 内存的 75%（例如 → 24GB）
-- work_mem = 256MB  （排序、哈希等查询操作的内存基准，并非每连接固定预算；同一查询、并行工作进程及并发查询可能累计多份内存）
-- maintenance_work_mem = 4GB  （索引构建内存）

-- ============================================================
-- 3. 并行查询
-- ============================================================
-- 允许并行向量扫描
ALTER TABLE chunks SET (parallel_workers = 4);
SET max_parallel_workers_per_gather = 4;

-- ============================================================
-- 4. 分区（超过 100 万行时）
-- ============================================================
-- 按 document_id 的哈希值分区，实现并行检索
-- 参考上文 Supabase 分区示例

-- ============================================================
-- 5. 监控慢查询
-- ============================================================
-- 开启 pg_stat_statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 查看最慢的向量查询
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%<=>%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## 九、生产运维要点

### 9.1 连接池管理

pgvector 的向量运算是 CPU 密集型操作。连接池配置直接影响性能。

```python
"""
生产级连接池配置
"""
import asyncpg
from contextlib import asynccontextmanager


async def create_optimized_pool(database_url: str) -> asyncpg.Pool:
    """
    创建针对 pgvector 优化的连接池
    """
    async def init_connection(conn):
        """每个连接初始化时执行"""
        # 注册 pgvector 类型
        from pgvector.asyncpg import register_vector
        await register_vector(conn)

        # 设置每个连接的向量搜索参数
        await conn.execute("SET hnsw.ef_search = 100")
        await conn.execute("SET work_mem = '256MB'")

    pool = await asyncpg.create_pool(
        dsn=database_url,
        min_size=5,           # 最小保持 5 个连接
        max_size=20,          # 最大 20 个连接（根据机器 CPU 核心数调整）
        max_queries=50000,    # 每个连接最多执行 5 万次查询后自动重建
        max_inactive_connection_lifetime=300,  # 5 分钟不用自动关闭
        init=init_connection  # 连接初始化回调
    )

    return pool


class RAGDatabaseManager:
    def __init__(self):
        self.pool: asyncpg.Pool = None

    async def initialize(self, database_url: str):
        self.pool = await create_optimized_pool(database_url)

    async def close(self):
        if self.pool:
            await self.pool.close()

    @asynccontextmanager
    async def get_user_connection(self, user_id: str, tenant_id: str):
        """
        获取带用户上下文的连接（自动设置 RLS 变量）
        使用 async with 确保连接归还连接池
        """
        async with self.pool.acquire() as conn:
            # 设置会话级别的用户上下文（仅对当前事务有效）
            await conn.execute("""
                SELECT
                    set_config('app.current_user_id', $1, true),
                    set_config('app.current_tenant_id', $2, true)
            """, str(user_id), str(tenant_id))
            yield conn
```

### 9.2 监控指标

```sql
-- ============================================================
-- 关键监控查询
-- ============================================================

-- 1. 查看向量索引状态
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE indexdef LIKE '%hnsw%' OR indexdef LIKE '%ivfflat%';

-- 2. 查看各表大小（向量占用空间）
SELECT
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(oid)) AS total_size,
    pg_size_pretty(pg_relation_size(oid)) AS data_size,
    pg_size_pretty(pg_total_relation_size(oid) - pg_relation_size(oid)) AS index_size
FROM pg_class
WHERE relname IN ('chunks', 'documents')
ORDER BY pg_total_relation_size(oid) DESC;

-- 3. 查看 chunks 表的向量数量和文档覆盖
SELECT
    COUNT(*) AS total_chunks,
    COUNT(DISTINCT document_id) AS total_documents,
    AVG(token_count) AS avg_token_count,
    MAX(created_at) AS latest_chunk
FROM chunks;

-- 4. 慢查询监控（需要 pg_stat_statements）
SELECT
    LEFT(query, 100) AS query_preview,
    round(mean_exec_time::numeric, 2) AS avg_ms,
    calls,
    round(total_exec_time::numeric, 2) AS total_ms
FROM pg_stat_statements
WHERE query LIKE '%chunks%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- 5. 索引使用率（确认向量查询走了 HNSW 索引）
SELECT
    indexrelname AS index_name,
    idx_scan AS index_scans,
    idx_tup_read AS tuples_read
FROM pg_stat_user_indexes
WHERE relname = 'chunks'
ORDER BY idx_scan DESC;
```

### 9.3 数据备份与恢复

```bash
# pgvector 数据和普通 PG 数据备份方式完全相同，这是 pgvector 的一大优势

# 完整备份（含向量数据）
pg_dump -h localhost -U postgres -d rag_db \
  --format=custom \
  --file=/backup/rag_db_$(date +%Y%m%d).dump

# 只备份 chunks 表（向量数据较大，可单独备份）
pg_dump -h localhost -U postgres -d rag_db \
  --table=chunks \
  --format=custom \
  --file=/backup/chunks_$(date +%Y%m%d).dump

# 恢复
pg_restore -h localhost -U postgres -d rag_db_restore \
  --format=custom \
  /backup/rag_db_20260101.dump

# Supabase 自动备份（无需手动操作）
# Pro 计划每天自动备份，保留 7 天；团队计划保留 30 天
```

### 9.4 常见问题排查

```sql
-- ============================================================
-- 问题1：向量搜索很慢（> 1 秒）
-- ============================================================

-- 检查是否走了索引
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, content, embedding <=> '[0.1, 0.2, ...]'::vector AS distance
FROM chunks
ORDER BY distance LIMIT 5;

-- 如果看到 Seq Scan，说明没走 HNSW 索引，检查：
-- ① 索引是否存在
-- ② 数据量是否太小（PG 优化器认为全表扫描更快）
-- ③ ef_search 是否设置合理

-- 强制使用索引（测试用）
SET enable_seqscan = OFF;
EXPLAIN (ANALYZE) SELECT ...;

-- ============================================================
-- 问题2：全文搜索没有结果
-- ============================================================

-- 检查 tsvector 是否正确更新
SELECT content, content_tsv FROM chunks LIMIT 3;

-- 手动更新（如果 trigger 没触发）
UPDATE chunks SET content_tsv = to_tsvector('english', content);

-- 测试查询
SELECT * FROM chunks
WHERE content_tsv @@ plainto_tsquery('english', '你的搜索词');

-- ============================================================
-- 问题3：RLS 导致查询返回空结果
-- ============================================================

-- 检查当前会话的 RLS 设置
SELECT current_setting('app.current_user_id', true),
       current_setting('app.current_tenant_id', true);

-- 检查 RLS 是否会影响查询（row_security = OFF 不会授予普通角色绕过权限；若查询会受策略过滤，可能报错）
SET row_security = OFF;
SELECT COUNT(*) FROM chunks;  -- 看总数
SET row_security = ON;

-- 检查特定用户的权限
SELECT dp.* FROM document_permissions dp
JOIN documents d ON dp.document_id = d.id
WHERE dp.user_id = '你的用户UUID';

-- ============================================================
-- 问题4：Embedding 维度不匹配
-- ============================================================

-- 查看当前 chunks 表的向量维度定义
SELECT pg_typeof(embedding),
       vector_dims(embedding) AS actual_dim
FROM chunks LIMIT 1;

-- 如果需要修改维度（不会自动删除现有向量；现有值维度不兼容时类型修改会失败，需重新生成向量并迁移）
-- ALTER TABLE chunks ALTER COLUMN embedding TYPE VECTOR(3072);
-- 生产环境应该创建新表，迁移数据，再切换
```

---

## 总结与最佳实践

### 核心要点回顾

pgvector RAG 的价值不在于"它是最快的向量数据库"，而在于它让你的系统**从三层架构变成一层架构**。当你把所有复杂性降低之后，才有余力去打磨真正重要的东西：提示词质量、分块策略、Embedding 模型选择。

**Schema 设计原则**：充分利用关系型数据库的规范化、外键、事务特性，不要把 pgvector 当成 MongoDB 用。

**RLS 多租户**：这是 pgvector 相比专用向量库最独特的优势。在合规场景下，数据库层面的安全远比应用层过滤可靠。

**混合搜索**：向量搜索 + tsvector 全文搜索 + RRF 融合，可用 SQL CTE 实现。62% 到 84% 仅作为假设评测数值；实际召回率与性能需在业务数据、权限过滤及目标负载下评估。

**框架集成**：LangChain 的 `PGVector` 和 LlamaIndex 的 `PGVectorStore` 都有成熟的 pgvector 支持。如果你已经在用这些框架，接入成本极低。

**迁移决策**：向量数量超过 500 万，或并发 QPS 超过 500，且 pgvector 调优已经达到瓶颈，这时候认真考虑专用向量库。在此之前，pgvector 够用。

### 进阶学习路径

- RAG 架构设计模式 - 了解 Naive RAG、Advanced RAG、Agentic RAG 的架构演进
- 混合搜索工程实践 - 深入学习 BM25、稀疏向量、RRF 等混合搜索技术
- Embedding 模型选型指南 - 选择最适合你场景的 Embedding 模型
- Milvus RAG 集成实战 - 了解专用向量库的 RAG 方案，做对比参考
- [[【技术与工具】/向量数据库/00-向量数据库选型指南|向量数据库选型指南]] - 全面的向量数据库选型决策框架

---

> [!note] 关于中文支持
> 本文全文搜索部分使用 `'english'` 配置。若中文项目选择 zhparser 路径，需要安装扩展，并另行创建采用该解析器、配置好词典映射的文本搜索配置；随后让 to_tsvector、plainto_tsquery 与框架 text_search_config 使用同一实际配置名。扩展名称不代表同名文本搜索配置已经存在。Supabase 目前不支持 zhparser，纯中文项目建议只用向量搜索，不用全文搜索，或改用 `pg_bigm` 扩展做中文二元语法检索。

> [!tip] 生产部署推荐配置
> - **小型项目（< 50 万向量，作为评估分档）**：可评估 Supabase 免费/Pro 套餐；托管可减少实例管理工作，但仍需承担权限、容量、性能和恢复维护
> - **中型项目（50-500 万向量）**：自建 PostgreSQL 16 + pgvector 0.8+，HNSW 索引，32GB+ 内存
> - **大型项目（> 500 万向量）**：评估迁移到 Milvus，或 Supabase 企业版 + 分区表
