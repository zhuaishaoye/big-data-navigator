---
title: pgvector SQL 向量查询实战
tags:
  - pgvector
  - SQL
  - 向量查询
  - 混合搜索
  - 全文检索
  - 窗口函数
  - PostgreSQL
  - RAG
  - AI应用
aliases:
  - pgvector查询
  - 向量SQL查询
  - pgvector混合搜索
  - pgvector实战
date: 2026-03-11
difficulty: 高级
duration: 60分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据科学家
  - 数据架构师
  - 数据分析师
  - BI分析师
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-11
updated: 2026-10-10
---


# pgvector SQL 向量查询实战

## 为什么这个话题值得单独一章

pgvector 最让人着迷的地方不是它的向量搜索有多快，而是它让你**用 SQL 做向量搜索**。

这句话听起来平淡，但对于一个已经写了五年 SQL 的数据工程师来说，这意味着什么？

- 你不需要学新的查询语言（Milvus 有自己的 Python API，Qdrant 有自己的 REST API）
- 你可以把向量搜索结果直接 JOIN 业务表——这在专用向量库里几乎做不到
- 你可以用 GROUP BY、窗口函数、CTE 组合出各种业务逻辑
- 你的 DBA 可以直接看懂和优化这些查询

这种"熟悉感"是无价的。它意味着团队无需招募专门的向量数据库专家，意味着快速迭代，意味着更低的运维成本。

本章从最基础的查询写起，一直到复杂的混合搜索、窗口函数、查询执行计划分析，每个例子都有完整的背景和解释。

---

## 目录

- [[#环境准备与示例数据]]
- [[#基础向量查询]]
- [[#三种距离算子详解]]
- [[#向量查询与业务表 JOIN]]
- [[#混合过滤：WHERE 子句 + 向量排序]]
- [[#全文检索与向量融合]]
- [[#聚合与分组]]
- [[#窗口函数]]
- [[#CTE 与复杂查询组合]]
- [[#EXPLAIN ANALYZE 读懂执行计划]]
- [[#常见陷阱与调试方法]]
- [[#生产级查询模板]]

---

## 环境准备与示例数据

在正式开始前，我们建立一套贯穿全文的示例数据，模拟一个**知识库文章检索**的真实场景。

### 数据库结构

```sql
-- 确保 pgvector 扩展已启用
CREATE EXTENSION IF NOT EXISTS vector;
-- 全文检索需要的语言配置（中文场景建议安装 zhparser）
-- 本文示例用英文演示全文检索语法

-- 用户表
CREATE TABLE users (
    id          bigserial PRIMARY KEY,
    username    text NOT NULL,
    email       text UNIQUE NOT NULL,
    role        text DEFAULT 'reader',  -- reader, author, admin
    created_at  timestamptz DEFAULT now()
);

-- 文章分类表
CREATE TABLE categories (
    id      serial PRIMARY KEY,
    name    text NOT NULL,
    slug    text UNIQUE NOT NULL
);

-- 核心文章表（带向量）
CREATE TABLE articles (
    id              bigserial PRIMARY KEY,
    title           text NOT NULL,
    content         text NOT NULL,
    summary         text,
    category_id     integer REFERENCES categories(id),
    author_id       bigint REFERENCES users(id),
    tags            text[],
    view_count      integer DEFAULT 0,
    is_published    boolean DEFAULT true,
    published_at    timestamptz,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),
    -- 向量列：用 text-embedding-3-small 生成，1536 维
    embedding       vector(1536),
    -- 全文检索列
    search_vector   tsvector GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
    ) STORED
);

-- 用户阅读历史表
CREATE TABLE reading_history (
    id          bigserial PRIMARY KEY,
    user_id     bigint REFERENCES users(id),
    article_id  bigint REFERENCES articles(id),
    read_at     timestamptz DEFAULT now(),
    duration_s  integer,    -- 阅读时长（秒）
    UNIQUE(user_id, article_id)
);

-- 索引
CREATE INDEX idx_articles_hnsw ON articles
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_articles_fts ON articles USING gin(search_vector);
CREATE INDEX idx_articles_category ON articles (category_id, is_published);
CREATE INDEX idx_articles_published ON articles (published_at DESC) WHERE is_published = true;
CREATE INDEX idx_reading_history_user ON reading_history (user_id, read_at DESC);
```

### 插入测试数据

```sql
-- 插入分类
INSERT INTO categories (name, slug) VALUES
    ('机器学习', 'machine-learning'),
    ('数据工程', 'data-engineering'),
    ('数据库', 'database'),
    ('大数据', 'big-data'),
    ('AI应用', 'ai-applications');

-- 插入用户（略，假设已有数据）

-- 插入文章（embedding 部分用随机向量代替，实际应用中由 Embedding 模型生成）
-- 这里展示结构，不展示具体向量值
INSERT INTO articles (title, content, category_id, embedding, published_at) VALUES
    ('Transformer 架构深度解析', '...', 1, '[...]'::vector, now()),
    ('Apache Kafka 实战指南', '...', 2, '[...]'::vector, now()),
    -- ...
;
```

> [!note] 真实项目中如何生成向量
> 实际应用中，向量通常由应用层调用 Embedding API 生成后写入数据库：
> ```python
> import openai
> import psycopg2
>
> def embed_and_store(article_id, text, conn):
>     response = openai.embeddings.create(
>         model="text-embedding-3-small",
>         input=text
>     )
>     embedding = response.data[0].embedding
>     with conn.cursor() as cur:
>         cur.execute(
>             "UPDATE articles SET embedding = %s WHERE id = %s",
>             (embedding, article_id)
>         )
>     conn.commit()
> ```

---

## 基础向量查询

### 最简单的语义搜索

向量搜索的最基本形式就一句话：

```sql
-- 假设 query_embedding 是查询文本的向量表示
-- 找 10 篇与查询最相关的文章
SELECT
    id,
    title,
    embedding <-> '[0.1, 0.2, ...]'::vector AS distance
FROM articles
ORDER BY embedding <-> '[0.1, 0.2, ...]'::vector
LIMIT 10;
```

**逐部分解释：**

`embedding <-> '[0.1, 0.2, ...]'::vector`

| 部分 | 说明 |
|------|------|
| `embedding` | 表中存储的向量列名 |
| `<->` | L2 欧氏距离算子 |
| `'[0.1, 0.2, ...]'::vector` | 查询向量：你要找"像这个"的内容 |

- `ORDER BY ... ASC`（距离从小到大，最相似的排在前面）
- `LIMIT 10` 只取最相似的前 10 条
- 距离值越小，表示越相似（L2 距离）

**实际查询模式（应用层调用）：**

```sql
-- 使用参数化查询（推荐，防止 SQL 注入，且支持查询计划缓存）
PREPARE find_similar (vector) AS
    SELECT id, title, $1 <-> embedding AS distance
    FROM articles
    WHERE is_published = true
    ORDER BY embedding <-> $1
    LIMIT 10;

-- 执行
EXECUTE find_similar('[0.1, 0.2, 0.3, ...]'::vector);
```

### 返回相似度分数而不是距离

"距离"和"相似度"是相反的概念——距离越小越相似。但有时业务层更习惯看一个 0 到 1 之间的相似度分数：

```sql
-- 余弦相似度：1 - 余弦距离
-- <=> 是余弦距离，值域 [0, 2]
-- 余弦相似度 = 1 - 余弦距离，值域 [-1, 1]；若需要映射到 [0, 1]，可使用 1 - 余弦距离/2，但该映射值不是原始余弦相似度
SELECT
    id,
    title,
    1 - (embedding <=> query_vec) AS similarity_score
FROM articles
WHERE is_published = true
ORDER BY embedding <=> query_vec  -- 仍然按距离排序
LIMIT 10;
```

> [!tip] 余弦相似度与余弦距离的换算
> - pgvector 的 `<=>` 返回余弦距离，值域 `[0, 2]`
> - 对非零向量：余弦相似度 = 1 - 余弦距离；这一换算不要求向量事先完成 L2 归一化
> - 大多数 Embedding 模型（如 OpenAI text-embedding-3）输出的向量已经归一化，可以直接用这个公式

---

## 三种距离算子详解

pgvector 提供三种常用距离算子，选错了不只是精度问题，还会导致**索引失效**。

```sql
-- L2 欧氏距离：<->
-- 适合：距离本身有物理意义的场景（如坐标、图像特征）
SELECT id, embedding <-> query_vec AS l2_distance FROM articles;

-- 余弦距离：<=>
-- 适合：关注方向不关注大小的场景（文本语义搜索的主流选择）
SELECT id, embedding <=> query_vec AS cosine_distance FROM articles;

-- 负内积：<#>
-- 适合：向量已经 L2 归一化的场景（结果是 -1 * 内积，值越小越相似）
SELECT id, embedding <#> query_vec AS neg_inner_product FROM articles;

-- pgvector 0.7+ 新增
-- Hamming 距离（仅用于 bit 类型）：<~>
SELECT id, phash <~> query_phash AS hamming FROM images;

-- Jaccard 距离（仅用于 bit 类型）：<%>
SELECT id, phash <%> query_phash AS jaccard FROM images;
```

**如何选择？**

| 算子 | 算法 | 最适合 |
|------|------|--------|
| `<->` | L2 欧氏距离 | 坐标系距离、图像特征 |
| `<=>` | 余弦距离 | 文本语义搜索（最常用） |
| `<#>` | 负内积 | 向量已归一化、推荐系统 |

> [!warning] 算子必须与索引操作符类匹配
> 若要让该 `vector_cosine_ops` 距离索引支持向量排序，查询需使用 `<=>` 算子；使用其他距离算子不能利用该索引完成相应排序，但仍可能使用其他索引过滤。算子匹配也不保证规划器一定选择该索引。
>
> ```sql
> -- 索引：cosine
> CREATE INDEX ON articles USING hnsw (embedding vector_cosine_ops);
>
> -- 查询：必须用 <=>
> SELECT * FROM articles ORDER BY embedding <=> query_vec LIMIT 10; -- 算子匹配，可由规划器选择该距离索引
> SELECT * FROM articles ORDER BY embedding <-> query_vec LIMIT 10; -- 不能使用上述 cosine 距离索引完成 L2 排序
> ```
>
> 操作符对照表：
> | 操作符类 | 对应距离算子 |
> |----------|-------------|
> | `vector_l2_ops` | `<->` |
> | `vector_cosine_ops` | `<=>` |
> | `vector_ip_ops` | `<#>` |

---

## 向量查询与业务表 JOIN

**这是 pgvector 相对于专用向量库最大的优势。** 在 Milvus 里，你找到了 10 个向量 ID，还需要另一次查询去业务数据库拿具体信息。在 pgvector 里，一条 SQL 搞定。

### 基础 JOIN：关联分类和作者信息

```sql
SELECT
    a.id,
    a.title,
    a.summary,
    c.name AS category_name,
    u.username AS author_name,
    a.published_at,
    a.embedding <=> query_vec AS similarity
FROM articles a
JOIN categories c ON c.id = a.category_id
JOIN users u ON u.id = a.author_id
WHERE a.is_published = true
ORDER BY a.embedding <=> query_vec
LIMIT 10;
```

**业务场景：** 用户在知识库搜索"Transformer 注意力机制"，不仅要看到文章标题，还需要知道这篇文章属于哪个分类、是谁写的、什么时候发布的。

### 关联阅读历史：个性化排除已读

```sql
-- 找到用户还没读过的相似文章
SELECT
    a.id,
    a.title,
    a.embedding <=> query_vec AS similarity
FROM articles a
LEFT JOIN reading_history rh
    ON rh.article_id = a.id AND rh.user_id = 42
WHERE a.is_published = true
  AND rh.id IS NULL  -- 过滤掉已读文章
ORDER BY a.embedding <=> query_vec
LIMIT 10;
```

**业务价值：** 不向用户推荐他已经读过的内容，这在专用向量库里需要在应用层手动过滤，而在 pgvector 里一条 SQL 完成。

### 多表聚合：带统计信息的搜索结果

```sql
SELECT
    a.id,
    a.title,
    c.name AS category,
    a.view_count,
    COUNT(rh.id) AS total_readers,
    AVG(rh.duration_s) AS avg_read_duration_s,
    a.embedding <=> query_vec AS similarity
FROM articles a
JOIN categories c ON c.id = a.category_id
LEFT JOIN reading_history rh ON rh.article_id = a.id
WHERE a.is_published = true
GROUP BY a.id, a.title, c.name, a.view_count, a.embedding
ORDER BY a.embedding <=> query_vec
LIMIT 10;
```

> [!note] GROUP BY 中向量列与主键函数依赖
> 非聚合表达式涉及的列通常需要出现在 GROUP BY 中；但 PostgreSQL 在 GROUP BY 包含基表主键时，可允许引用由该主键函数依赖确定的其他列。本例按 articles 的主键 a.id 分组，因此 a.embedding 不必另行列入 GROUP BY。

---

## 混合过滤：WHERE 子句 + 向量排序

这是实际业务中最常用的查询模式——既要语义相关，又要满足业务条件。

### 基础混合过滤

```sql
-- 在"机器学习"分类下，找最近一年发布的相关文章
SELECT
    id,
    title,
    published_at,
    embedding <=> query_vec AS similarity
FROM articles
WHERE category_id = 1                              -- 指定分类
  AND published_at > now() - INTERVAL '1 year'    -- 时间范围
  AND is_published = true                          -- 只看已发布
ORDER BY embedding <=> query_vec
LIMIT 10;
```

### 多条件过滤

```sql
-- 复杂过滤：多个分类、标签、时间
SELECT
    a.id,
    a.title,
    a.tags,
    a.embedding <=> query_vec AS similarity
FROM articles a
WHERE a.category_id = ANY(ARRAY[1, 2, 3])         -- 多个分类
  AND a.tags && ARRAY['深度学习', 'NLP']           -- 包含指定标签之一
  AND a.view_count > 1000                          -- 热门文章
  AND a.published_at BETWEEN '2024-01-01' AND '2025-12-31'
  AND a.is_published = true
ORDER BY a.embedding <=> query_vec
LIMIT 20;
```

### 过滤时的性能陷阱

> [!warning] 过滤太严格会导致召回率下降
>
> 假设你有 100 万篇文章，但某个分类只有 1000 篇。当你加了 `WHERE category_id = 99` 后，pgvector 的 HNSW 索引仍然在 100 万个向量构成的图中导航，找到的候选集里大多数会被 WHERE 过滤掉，最终可能凑不够 LIMIT 要求的数量。
>
> **解决方案一：** 为过滤列 + 向量创建局部索引
> ```sql
> -- 只对机器学习分类的文章建索引
> CREATE INDEX idx_hnsw_ml ON articles
> USING hnsw (embedding vector_cosine_ops)
> WHERE category_id = 1;
>
> -- WHERE 条件可证明满足局部索引谓词时，规划器可以选择该索引，但不保证使用
> SELECT * FROM articles
> WHERE category_id = 1
> ORDER BY embedding <=> query_vec
> LIMIT 10;
> ```
>
> **解决方案二：** 增大 ef_search 提高候选集
> ```sql
> SET hnsw.ef_search = 200;  -- 探索更多候选，提高过滤后的召回
> SELECT * FROM articles WHERE category_id = 1 ORDER BY embedding <=> query_vec LIMIT 10;
> ```

### 使用 CTE 实现"先过滤再搜索"

对于过滤条件非常严格、能大幅减少数据集的情况，可在支持 MATERIALIZED CTE 的 PostgreSQL 版本中显式建立过滤结果边界，再对该结果计算距离并排序；普通可内联 CTE 不保证这一执行顺序，过滤阶段是否使用普通索引仍由规划器决定：

```sql
-- 策略：先物化过滤结果，再在该结果内计算向量距离并排序
WITH filtered_articles AS MATERIALIZED (
    -- 第一步：过滤并物化结果；是否使用普通索引及耗时取决于实际执行计划
    SELECT id, title, embedding
    FROM articles
    WHERE category_id = 1
      AND is_published = true
      AND published_at > '2024-01-01'
)
-- 第二步：在过滤后的子集上做精确向量搜索
SELECT
    id,
    title,
    embedding <=> query_vec AS similarity
FROM filtered_articles
ORDER BY embedding <=> query_vec
LIMIT 10;
```

**注意：** 这种方式对物化后的候选集进行精确距离排序，通常适合过滤后数据量较小的情况；若仍有数十万条数据，应与使用 HNSW 索引带 WHERE 条件的方案比较实际耗时和召回效果，不能仅凭候选数量断定哪种方案更快。

---

## 全文检索与向量融合

这是 pgvector 作为 PostgreSQL 扩展的独特优势之一：可以把传统关键词搜索和语义向量搜索结合在一起，实现**混合搜索（Hybrid Search）**。

### 为什么需要混合搜索

| 搜索方式 | 优势 | 劣势 |
|---------|------|------|
| 关键词搜索（BM25/全文检索） | 精确匹配、新词友好、可解释 | 无法理解同义词、语义变体 |
| 向量搜索（语义搜索） | 理解含义、跨语言、处理同义词 | 新词/专有名词可能找不到 |
| **混合搜索** | 两者兼得 | 需要融合策略、稍复杂 |

**实例：** 用户搜索"GPT-4o 图片理解"
- 纯关键词搜索：可以找到包含"GPT-4o"精确关键词的文章，不会漏掉新发布的内容
- 纯向量搜索：可以找到讨论"多模态大语言模型"的文章，即使没有提到"GPT-4o"
- 混合搜索：两者都能找到，结合排名取最优

### PostgreSQL 内置全文检索

```sql
-- 查看文章的 tsvector 内容
SELECT id, to_tsvector('english', title || ' ' || content) AS ts
FROM articles
LIMIT 3;

-- 基础全文检索
SELECT id, title
FROM articles
WHERE search_vector @@ to_tsquery('english', 'transformer & attention')
ORDER BY ts_rank(search_vector, to_tsquery('english', 'transformer & attention')) DESC
LIMIT 10;

-- 更灵活的查询语法（plainto_tsquery 不需要手动加 & 和 |）
SELECT id, title,
    ts_rank(search_vector, plainto_tsquery('english', 'transformer attention mechanism')) AS fts_rank
FROM articles
WHERE search_vector @@ plainto_tsquery('english', 'transformer attention mechanism')
ORDER BY fts_rank DESC
LIMIT 10;
```

### 混合搜索：RRF（Reciprocal Rank Fusion）方法

RRF 是目前最实用的混合搜索融合算法。原理简单：把两种搜索的结果分别排名，然后用一个公式把排名融合成综合分数。

**RRF 公式：** `score = 1 / (k + rank_in_list)`，k 通常取 60。

```sql
-- 完整的混合搜索实现
WITH
-- 第一路：向量语义搜索
vector_search AS (
    SELECT
        id,
        ROW_NUMBER() OVER (ORDER BY embedding <=> query_vec) AS vector_rank
    FROM articles
    WHERE is_published = true
    ORDER BY embedding <=> query_vec
    LIMIT 50  -- 取 Top-50 候选
),
-- 第二路：全文关键词搜索
fts_search AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            ORDER BY ts_rank(search_vector, plainto_tsquery('english', :query_text)) DESC
        ) AS fts_rank
    FROM articles
    WHERE is_published = true
      AND search_vector @@ plainto_tsquery('english', :query_text)
    ORDER BY ts_rank(search_vector, plainto_tsquery('english', :query_text)) DESC
    LIMIT 50  -- 取 Top-50 候选
),
-- 用 RRF 融合两路结果
rrf_scores AS (
    SELECT
        COALESCE(vs.id, fs.id) AS id,
        COALESCE(1.0 / (60 + vs.vector_rank), 0) +
        COALESCE(1.0 / (60 + fs.fts_rank), 0) AS rrf_score
    FROM vector_search vs
    FULL OUTER JOIN fts_search fs ON vs.id = fs.id
)
-- 最终结果：关联原始数据，按 RRF 分数排序
SELECT
    a.id,
    a.title,
    a.summary,
    rs.rrf_score
FROM rrf_scores rs
JOIN articles a ON a.id = rs.id
ORDER BY rs.rrf_score DESC
LIMIT 10;
```

**解读：**
- `FULL OUTER JOIN`：确保只出现在其中一路的结果也被包含
- `COALESCE(..., 0)`：如果某篇文章在某一路里没有出现，该路贡献 0 分
- 同时出现在两路里的文章，RRF 分数更高（两路加分）

### 加权混合搜索

有时候你希望向量搜索贡献更大权重（比如用户意图模糊时），或者关键词搜索贡献更大权重（比如搜索特定产品名）：

```sql
-- 可调权重的混合搜索（向量权重 0.7，关键词权重 0.3）
WITH
vector_search AS (
    SELECT id,
        1 - (embedding <=> query_vec) AS vector_score  -- 转换为相似度（越大越好）
    FROM articles
    WHERE is_published = true
    ORDER BY embedding <=> query_vec
    LIMIT 100
),
fts_search AS (
    SELECT id,
        ts_rank_cd(search_vector, plainto_tsquery('english', :query_text)) AS fts_score
    FROM articles
    WHERE is_published = true
      AND search_vector @@ plainto_tsquery('english', :query_text)
    ORDER BY ts_rank_cd(search_vector, plainto_tsquery('english', :query_text)) DESC
    LIMIT 100
),
-- 对两路分数分别归一化到 [0,1]
normalized AS (
    SELECT
        COALESCE(vs.id, fs.id) AS id,
        COALESCE((vs.vector_score + 1) / 2.0, 0) AS norm_vector,
        COALESCE(
            fs.fts_score / NULLIF(MAX(fs.fts_score) OVER (), 0),
            0
        ) AS norm_fts
    FROM vector_search vs
    FULL OUTER JOIN fts_search fs ON vs.id = fs.id
)
SELECT
    a.id,
    a.title,
    n.norm_vector * 0.7 + n.norm_fts * 0.3 AS hybrid_score
FROM normalized n
JOIN articles a ON a.id = n.id
ORDER BY hybrid_score DESC
LIMIT 10;
```

---

## 聚合与分组

这是向量查询结合 SQL 能力的一个进阶用法，在"找每个类别中最相似的文章"这类需求中非常有用。

### 找每个分类中与查询最相关的 Top-1 文章

```sql
-- 使用 DISTINCT ON（PostgreSQL 特有语法）
SELECT DISTINCT ON (category_id)
    a.category_id,
    c.name AS category_name,
    a.id AS article_id,
    a.title,
    a.embedding <=> query_vec AS similarity
FROM articles a
JOIN categories c ON c.id = a.category_id
WHERE a.is_published = true
ORDER BY a.category_id, a.embedding <=> query_vec  -- 同一分类内按相似度排序
;

-- 结果：每个分类返回一篇最相关的文章
```

**`DISTINCT ON` 的逻辑：** 按 `category_id` 分组，每组只保留第一行（`ORDER BY` 决定了哪行是第一行）。这是 PostgreSQL 的非标准但极其实用的语法。

### 统计每个分类的平均相似度

```sql
-- 找出"整体上"和查询向量最接近的分类
SELECT
    c.name AS category_name,
    COUNT(a.id) AS article_count,
    AVG(a.embedding <=> query_vec) AS avg_distance,  -- 平均距离（越小越相关）
    MIN(a.embedding <=> query_vec) AS min_distance   -- 最相似的文章距离
FROM articles a
JOIN categories c ON c.id = a.category_id
WHERE a.is_published = true
GROUP BY c.id, c.name
ORDER BY avg_distance ASC
LIMIT 5;
```

**业务场景：** 用户搜索某个主题时，除了返回具体文章，还告诉用户"这个主题在哪个分类下最集中"。

### 向量聚类：找到数据中的自然分组

```sql
-- 找出每篇文章的"最相似邻居"（自连接）
-- 注意：这个查询在大数据量时很慢，仅用于分析
SELECT
    a.id AS article_id,
    a.title AS article_title,
    b.id AS neighbor_id,
    b.title AS neighbor_title,
    a.embedding <-> b.embedding AS distance
FROM articles a
CROSS JOIN LATERAL (
    SELECT id, title, embedding
    FROM articles b
    WHERE b.id != a.id
    ORDER BY a.embedding <-> b.embedding
    LIMIT 1
) b
WHERE a.id BETWEEN 1 AND 100  -- 只分析前 100 篇
ORDER BY a.id;
```

---

## 窗口函数

窗口函数是 SQL 的高级特性，结合向量查询可以解决很多"排名类"业务问题。

### 找每个用户最相关的 Top-3 推荐文章

```sql
-- 场景：给多个用户批量生成推荐（离线任务）
-- 假设每个用户有一个"兴趣向量"（由历史行为计算得到）

WITH user_recommendations AS (
    SELECT
        u.id AS user_id,
        u.username,
        a.id AS article_id,
        a.title,
        a.embedding <=> u.interest_vector AS relevance_distance,
        ROW_NUMBER() OVER (
            PARTITION BY u.id
            ORDER BY a.embedding <=> u.interest_vector
        ) AS rank_for_user
    FROM users u
    CROSS JOIN articles a
    WHERE a.is_published = true
      AND NOT EXISTS (
          SELECT 1 FROM reading_history rh
          WHERE rh.user_id = u.id AND rh.article_id = a.id
      )
)
SELECT
    user_id,
    username,
    article_id,
    title,
    relevance_distance,
    rank_for_user
FROM user_recommendations
WHERE rank_for_user <= 3  -- 每个用户最多 3 篇推荐
ORDER BY user_id, rank_for_user;
```

> [!warning] CROSS JOIN 的性能警告
> `CROSS JOIN` 是笛卡尔积，用户数 × 文章数。如果有 1000 个用户和 100 万篇文章，这个查询要计算 10 亿个距离，会非常慢。实际使用时：
> - 先用 WHERE 过滤掉明显不相关的文章
> - 或者用 LATERAL 子查询（见下文）
> - 或者在应用层批量处理

### LATERAL 子查询：更高效的"每用户 Top-K"

```sql
-- 使用 LATERAL 子查询，更高效
SELECT
    u.id AS user_id,
    u.username,
    recs.article_id,
    recs.title,
    recs.distance
FROM users u
CROSS JOIN LATERAL (
    SELECT
        a.id AS article_id,
        a.title,
        a.embedding <=> u.interest_vector AS distance
    FROM articles a
    WHERE a.is_published = true
      AND NOT EXISTS (
          SELECT 1 FROM reading_history rh
          WHERE rh.user_id = u.id AND rh.article_id = a.id
      )
    ORDER BY a.embedding <=> u.interest_vector
    LIMIT 3  -- 每个用户取 3 篇
) recs
ORDER BY u.id, recs.distance;
```

**LATERAL 的优势：** 子查询可以引用外层查询的列（`u.interest_vector`），并且 `LIMIT` 在子查询内部生效，大幅减少了中间结果的数量。

### 相对排名：文章在各自分类中的排名

```sql
-- 找出搜索结果中，每篇文章在自己分类内的相似度排名
SELECT
    a.id,
    a.title,
    c.name AS category,
    a.embedding <=> query_vec AS distance,
    RANK() OVER (
        PARTITION BY a.category_id
        ORDER BY a.embedding <=> query_vec
    ) AS rank_in_category,
    PERCENT_RANK() OVER (
        PARTITION BY a.category_id
        ORDER BY a.embedding <=> query_vec
    ) AS percentile_in_category
FROM articles a
JOIN categories c ON c.id = a.category_id
WHERE a.is_published = true
ORDER BY a.embedding <=> query_vec
LIMIT 50;
```

---

## CTE 与复杂查询组合

### 完整的推荐系统查询（协同过滤 + 向量搜索）

```sql
-- 场景：给用户 42 推荐文章
-- 策略：找到"和用户 42 读过相同文章的人"，看他们还读了什么

WITH
-- 第一步：找出用户 42 读过的文章
user_reads AS (
    SELECT article_id
    FROM reading_history
    WHERE user_id = 42
),
-- 第二步：找到"口味相似的用户"（读过相同文章的人）
similar_users AS (
    SELECT
        rh.user_id,
        COUNT(*) AS shared_articles  -- 共同读过的文章数
    FROM reading_history rh
    JOIN user_reads ur ON ur.article_id = rh.article_id
    WHERE rh.user_id != 42
    GROUP BY rh.user_id
    HAVING COUNT(*) >= 3  -- 至少 3 篇共同文章才算"相似"
    ORDER BY shared_articles DESC
    LIMIT 20  -- 取前 20 个相似用户
),
-- 第三步：找出这些相似用户读过但用户 42 没读过的文章
candidate_articles AS (
    SELECT DISTINCT rh.article_id
    FROM reading_history rh
    JOIN similar_users su ON su.user_id = rh.user_id
    WHERE NOT EXISTS (
        SELECT 1 FROM user_reads ur WHERE ur.article_id = rh.article_id
    )
),
-- 第四步：用向量搜索在候选文章中找最相关的
-- （需要一个"用户兴趣向量"，这里假设已有）
user_interest AS (
    -- 用用户历史阅读文章的向量平均值作为兴趣向量
    SELECT AVG(a.embedding) AS interest_vector
    FROM articles a
    JOIN user_reads ur ON ur.article_id = a.id
    WHERE a.embedding IS NOT NULL
)
SELECT
    a.id,
    a.title,
    c.name AS category,
    a.embedding <=> ui.interest_vector AS relevance,
    COUNT(su_count.user_id) AS recommended_by_count
FROM candidate_articles ca
JOIN articles a ON a.id = ca.article_id
JOIN categories c ON c.id = a.category_id
CROSS JOIN user_interest ui
LEFT JOIN (
    SELECT rh.article_id, su.user_id
    FROM reading_history rh
    JOIN similar_users su ON su.user_id = rh.user_id
) su_count ON su_count.article_id = a.id
WHERE a.is_published = true
  AND a.embedding IS NOT NULL
GROUP BY a.id, a.title, c.name, a.embedding, ui.interest_vector
ORDER BY
    a.embedding <=> ui.interest_vector,  -- 主排序：语义相关性
    COUNT(su_count.user_id) DESC          -- 次排序：被相似用户推荐次数
LIMIT 10;
```

> [!note] 关于向量求平均
> `AVG(embedding)` 对向量列做分量平均，pgvector 支持这个操作。得到的平均向量可以理解为"这批文章的语义重心"，用它代表用户的兴趣是一个合理的近似。

---

## EXPLAIN ANALYZE 读懂执行计划

这是诊断查询性能问题最重要的工具。向量查询有一些特有的现象，需要知道如何读懂。

### 基础用法

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, title
FROM articles
ORDER BY embedding <=> query_vec
LIMIT 10;
```

### 识别执行计划中的关键信息

**情况一：使用 HNSW 索引的假设执行计划示例（以下数值仅用于演示阅读方法，不代表实测基准）**

```javascript
Limit  (cost=0.26..2.80 rows=10 width=44) (actual time=1.234..1.267 rows=10 loops=1)
  ->  Index Scan using idx_articles_hnsw on articles  (cost=0.26..13457.26 rows=48231 ...)
        Order By: (embedding <=> '[0.1, 0.2, ...]'::vector)
Planning Time: 0.182 ms
Execution Time: 1.289 ms
```

关键标志：
- `Index Scan using idx_articles_hnsw`：HNSW 索引被使用
- `Execution Time: 1.289 ms`：非常快
- `Order By: (embedding <=> ...)` ：排序操作在索引层完成

**情况二：顺序扫描的假设执行计划示例（以下数值不构成与前例的受控性能对比）**

```javascript
Limit  (cost=87234.56..87234.58 rows=10 width=44) (actual time=892.123..892.145 rows=10 loops=1)
  ->  Sort  (cost=87234.56..88447.63 rows=485228 ...)
        Sort Key: ((embedding <=> '[0.1, ...]'::vector))
        ->  Seq Scan on articles  (cost=0.00..73821.58 rows=485228 ...)
Planning Time: 0.234 ms
Execution Time: 892.156 ms
```

关键标志：
- `Seq Scan on articles`：没有使用索引，全表扫描
- `Sort`：执行排序；可能使用内存或磁盘，需结合 Sort Method、内存或磁盘用量及输入规模判断成本
- `Execution Time: 892.156 ms`：仅为假设示例中的耗时；不能据此认定顺序扫描比 HNSW 慢固定倍数

### 为什么会出现 Seq Scan？

```sql
-- 诊断 1：检查查询算子与索引类型是否匹配
-- 索引用了 cosine_ops，查询用了 <->（L2）
-- 解决：改用 <=>

-- 诊断 2：LIMIT 太大触发 planner 倾向顺序扫描
EXPLAIN (ANALYZE)
SELECT * FROM articles ORDER BY embedding <=> query_vec LIMIT 1000;
-- LIMIT 1000 时，planner 可能判断"顺序扫描更划算"

-- 强制使用索引（调试专用，不建议生产使用）
SET enable_seqscan = off;
EXPLAIN (ANALYZE)
SELECT * FROM articles ORDER BY embedding <=> query_vec LIMIT 1000;
SET enable_seqscan = on;  -- 用完记得改回来！

-- 诊断 3：统计信息过旧
ANALYZE articles;  -- 更新统计信息
-- 再次 EXPLAIN ANALYZE 查看是否改善
```

### 读懂 Buffers 信息

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM articles ORDER BY embedding <=> query_vec LIMIT 10;

-- 输出示例
-- Buffers: shared hit=1247 read=89
--          hit：从内存(shared_buffers)读取的块数
--          read：读入 PostgreSQL 共享缓冲区的块数，可能命中操作系统缓存，不等同于物理磁盘读取
-- read 较大时需结合相关计划节点及 I/O 时间判断，不能仅据此认定索引驻留不足或磁盘成为瓶颈
```

**优化建议：**
- 不以固定的 `read` 占比直接决定调参；应结合工作集、操作系统缓存、I/O 时间和并发负载评估 `shared_buffers`
- 减小 HNSW 的 `m` 可降低索引空间需求，但需要重建索引，并重新评估召回率与查询性能

### 使用 auto_explain 自动记录慢查询

```sql
-- 在 postgresql.conf 中启用
-- shared_preload_libraries = 'auto_explain'
-- auto_explain.log_min_duration = 1000  -- 超过 1 秒自动记录

-- 或者在会话中临时启用
LOAD 'auto_explain';
SET auto_explain.log_min_duration = 100;  -- 超过 100ms 就记录
SET auto_explain.log_analyze = true;

-- 执行你的查询，慢查询会自动出现在 PostgreSQL 日志中
```

---

## 常见陷阱与调试方法

### 陷阱 1：加了索引反而更慢

**现象：** 建了 HNSW 索引，但查询时间反而比没有索引时更长。

**可能原因：**

```sql
-- 原因一：索引没有加载进内存
-- 首次查询时需要从磁盘加载索引，"预热"后才快
-- 测试方法：连续执行同一个查询 5 次，看后几次的时间
SELECT id FROM articles ORDER BY embedding <=> query_vec LIMIT 10;
SELECT id FROM articles ORDER BY embedding <=> query_vec LIMIT 10;
SELECT id FROM articles ORDER BY embedding <=> query_vec LIMIT 10;
-- 如果第3次明显快于第1次，可能存在缓存预热效应；需结合 Buffers、I/O 时间和负载变化进一步判断

-- 解决方案：预热索引
-- 安装 pg_prewarm 扩展
CREATE EXTENSION pg_prewarm;
SELECT pg_prewarm('idx_articles_hnsw');

-- 原因二：ef_search 过高，探索节点太多
-- 检查当前 ef_search 值
SHOW hnsw.ef_search;
-- 尝试降低
SET hnsw.ef_search = 20;  -- 默认是 40
```

### 陷阱 2：相似度结果不符合预期

**现象：** 搜索"机器学习"，返回的结果和机器学习没什么关系。

**排查清单：**

```sql
-- 检查 1：向量是否正确写入
SELECT id, title,
    array_length(embedding::float4[], 1) AS dimensions,  -- 检查维度
    embedding IS NULL AS is_null
FROM articles
LIMIT 10;

-- 检查 2：查询向量和数据库向量的维度是否一致
-- 如果维度不一致，PostgreSQL 会报错，所以通常能被发现

-- 检查 3：距离算子是否和 Embedding 模型匹配
-- OpenAI text-embedding-3 系列推荐用余弦相似度（<=>）
-- 而不是 L2 距离（<->）

-- 检查 4：查询向量本身是否正确（不要用全零向量测试）
SELECT embedding <=> '[0,0,0,...,0]'::vector AS dist_to_zero
FROM articles LIMIT 1;
-- 全零向量的余弦距离没有定义，不能用该结果是否接近 0 判断数据质量；应检查向量维度、是否为零向量，以及查询与入库所用模型是否一致
```

### 陷阱 3：`NULL` 向量导致结果缺失

```sql
-- 检查有多少条记录没有向量
SELECT COUNT(*) FILTER (WHERE embedding IS NULL) AS null_count,
       COUNT(*) AS total_count
FROM articles;

-- 向量为 NULL 的行在 ORDER BY 时会被排到最后（NULL 排序规则）
-- 精确升序排序默认将 NULL 放在最后；若非 NULL 行少于 LIMIT，仍可能返回 NULL 行。向量索引不包含 NULL 向量

-- 过滤掉 NULL 向量的行
SELECT id, title
FROM articles
WHERE embedding IS NOT NULL
ORDER BY embedding <=> query_vec
LIMIT 10;
```

### 陷阱 4：高并发下向量查询性能下降

**现象：** 单次查询很快（< 10ms），但高并发时响应时间急剧升高。

**诊断：**

```sql
-- 查看锁等待情况
SELECT pid, query, state, wait_event_type, wait_event, query_start
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;

-- 查看慢查询
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - query_start > interval '1 second'
ORDER BY duration DESC;
```

**优化方向：**

```sql
-- 1. 增加并行工作线程数
SET max_parallel_workers_per_gather = 4;

-- 2. 使用连接池（PgBouncer）减少连接开销
-- （连接池配置在 pgbouncer.ini 中，不在 SQL 中）

-- 3. 对只读查询使用只读副本
-- 在应用层路由：写操作 → 主库，读操作 → 副本
```

---

## 生产级查询模板

### 模板 A：使用预备语句的实时语义搜索（不缓存检索结果）

```sql
-- 使用 prepared statement 提高重复查询性能
PREPARE semantic_search (vector, integer, boolean) AS
    SELECT
        a.id,
        a.title,
        a.summary,
        c.name AS category,
        a.published_at,
        a.embedding <=> $1 AS similarity_distance
    FROM articles a
    JOIN categories c ON c.id = a.category_id
    WHERE a.is_published = $3
      AND a.embedding IS NOT NULL
    ORDER BY a.embedding <=> $1
    LIMIT $2;

-- 调用
EXECUTE semantic_search(
    '[0.1, 0.2, ...]'::vector,  -- 查询向量
    10,                          -- 返回条数
    true                         -- 只返回已发布的
);
```

### 模板 B：RAG 应用的上下文检索

```sql
-- 场景：RAG 应用中检索相关文档片段
-- 此处只限制每篇文章的字符数；总 token 预算需在应用层使用目标模型的分词器计算并截断
SELECT
    a.id,
    a.title,
    LEFT(a.content, 500) AS content_preview,  -- 限制长度
    a.embedding <=> query_vec AS relevance
FROM articles a
WHERE a.is_published = true
  AND a.embedding IS NOT NULL
  AND a.published_at > now() - INTERVAL '2 years'  -- 只用近期内容
ORDER BY a.embedding <=> query_vec
LIMIT 5;  -- RAG 通常取 3-5 个上下文
```

### 模板 C：相似内容推荐（基于当前文章）

```sql
-- 查看当前阅读文章的相关推荐
-- 输入：当前文章 ID
WITH current_article AS (
    SELECT embedding, category_id
    FROM articles
    WHERE id = :current_article_id
)
SELECT
    a.id,
    a.title,
    c.name AS category,
    a.embedding <=> ca.embedding AS similarity
FROM articles a
JOIN categories c ON c.id = a.category_id
CROSS JOIN current_article ca
WHERE a.id != :current_article_id     -- 排除自身
  AND a.is_published = true
  AND a.embedding IS NOT NULL
ORDER BY a.embedding <=> ca.embedding
LIMIT 6;  -- 通常推荐 6 篇相关文章
```

### 模板 D：去重/聚类（找重复内容）

```sql
-- 找出数据库中高度相似的文章对（疑似重复）
-- 注意：这个查询复杂度 O(n²)，只在小数据集或定期批量运行
WITH article_pairs AS (
    SELECT
        a1.id AS id1,
        a1.title AS title1,
        a2.id AS id2,
        a2.title AS title2,
        a1.embedding <=> a2.embedding AS distance
    FROM articles a1
    JOIN articles a2
        ON a2.id > a1.id  -- 避免重复对（id2 > id1）
        AND a1.embedding <=> a2.embedding < 0.05  -- 余弦距离 < 0.05 视为高度相似
    WHERE a1.embedding IS NOT NULL
      AND a2.embedding IS NOT NULL
)
SELECT *
FROM article_pairs
ORDER BY distance ASC
LIMIT 50;
```

---

## 本章小结

本章覆盖了 pgvector 在实际业务场景中的主要 SQL 查询模式：

| 查询模式 | 核心要点 |
|---------|---------|
| **基础语义搜索** | `ORDER BY embedding <=> query_vec LIMIT N`，算子必须与索引匹配 |
| **业务表 JOIN** | pgvector 最大优势，一条 SQL 融合向量结果与业务数据 |
| **混合过滤** | 结果需满足 WHERE 条件；HNSW 路径可能在获取候选后过滤，严格过滤时注意召回率 |
| **全文检索融合** | tsvector + pgvector，用 RRF 算法融合两路排名 |
| **窗口函数** | PARTITION BY 实现"每组 Top-K"，LATERAL 提高性能 |
| **EXPLAIN ANALYZE** | 重点看 Seq Scan vs Index Scan，关注 Buffers hit/read |
| **常见陷阱** | 算子不匹配、NULL 向量、索引未预热、LIMIT 过大 |

> [!tip] 推荐学习路径
> - 深入理解索引原理：[[【技术与工具】/向量数据库/pgvector/06-索引类型与选型|索引类型与选型]]
> - 了解向量数据库的全局视野：[[【技术与工具】/向量数据库/00-向量数据库选型指南|向量数据库选型指南]]
> - 对比其他向量数据库方案：Qdrant 概述与核心优势
