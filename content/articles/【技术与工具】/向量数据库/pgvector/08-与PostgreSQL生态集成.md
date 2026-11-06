---
title: pgvector 与 PostgreSQL 生态集成
tags:
  - pgvector
  - PostgreSQL
  - SQLAlchemy
  - Django
  - PostGIS
  - TimescaleDB
  - pgai
  - pgvectorscale
  - ORM
  - 生态集成
  - RAG
difficulty: 高级
duration: 90分钟
aliases:
  - pgvector生态
  - pgvector ORM集成
  - pgvector SQLAlchemy
  - pgvector Django
date: 2026-03-11
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - Python后端开发工程师
  - PostgreSQL数据库管理员
stability: fast-changing
status: maintenance
access_tier: free
created: 2026-03-11
updated: 2026-10-10
---


# pgvector 与 PostgreSQL 生态集成

> [!abstract] 本文目标
> - **掌握 ORM 集成**：用 SQLAlchemy 和 Django 优雅地操作向量数据，告别裸写 SQL
> - **理解生态协同**：学会 pgvector + PostGIS、pgvector + TimescaleDB 的组合拳
> - **掌握 pgai 新特性**：直接在 SQL 里调用 AI 模型生成 Embedding（2024 年重大新特性）
> - **了解基础设施透明**：弄清楚备份、连接池、逻辑复制对向量列的处理方式

阅读前置：混合搜索与过滤优化 索引原理与调优 [[【技术与工具】/向量数据库/pgvector/01-pgvector概述与核心定位|pgvector 概述]]

---

## 目录

- [[#一、pgvector 的真正护城河：生态，不是性能]]
- [[#二、SQLAlchemy 集成：Python 后端的主战场]]
- [[#三、Django ORM 集成：django-pgvector 全解析]]
- [[#四、pgvector + PostGIS：地理位置 × 语义相似]]
- [[#五、pgvector + TimescaleDB/pgvectorscale：时序 × 向量]]
- [[#六、pgai 扩展：让 SQL 直接调用 AI 模型]]
- [[#七、连接池：pgBouncer 的注意事项]]
- [[#八、逻辑复制：向量列如何被复制]]
- #九、备份与恢复：pg_dump 的零配置支持
- [[#十、集成方案选型参考]]

---

## 一、pgvector 的真正护城河：生态，不是性能

先讲一个对比故事。

你手头有两个方案：方案 A 是某个专用向量数据库，QPS 比 pgvector 高 3 倍；方案 B 是 pgvector。但方案 A 要求你：

- 单独学习它的 SDK
- 单独部署、运维一套新系统
- 写数据同步管道，把业务数据库的更新同步过去
- 单独配备备份方案、监控方案、告警方案
- 重新处理事务一致性——你更新了业务数据，向量数据什么时候更新？

方案 B 是 pgvector。你的 SQLAlchemy model 加一个字段类型，你的 Django ORM 加一行导入，你的 pg_dump 脚本不用改，你的 Prometheus 不用改，你的连接池不用改，你的备份策略不用改。

**索引调优可能缩小性能差距，但能否弥补取决于负载、召回要求与硬件；复用已有 PostgreSQL 运维体系则可能降低集成成本。** 这才是 pgvector 对于已有 PostgreSQL 技术栈的团队来说最大的护城河。

本文的目标，就是把这个"生态优势"从理念落实到具体代码。

---

## 二、SQLAlchemy 集成：Python 后端的主战场

SQLAlchemy 是 Python 生态里最主流的 ORM 框架，FastAPI、Flask、Celery 等框架都与它深度集成。pgvector 官方维护的 `pgvector-python` 库对 SQLAlchemy 提供了一等公民级别的支持。

### 2.1 安装依赖

```bash
pip install pgvector sqlalchemy psycopg2-binary
# 如果使用异步，还需要：
pip install asyncpg sqlalchemy[asyncio]
```

### 2.2 Model 定义：从"加一个字段"开始

从外部看，在 SQLAlchemy 模型里使用向量，就像加一个普通字段一样简单：

```python
from sqlalchemy import Column, Integer, String, Text, create_engine
from sqlalchemy.orm import declarative_base, Session
from pgvector.sqlalchemy import Vector

Base = declarative_base()

class Document(Base):
    """文档表：存储原始内容 + 对应的向量 Embedding"""
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    source = Column(String(200))                    # 来源：URL、文件名等
    # 核心字段：1536 维向量（OpenAI text-embedding-3-small 的输出维度）
    embedding = Column(Vector(1536))

    def __repr__(self):
        return f"<Document id={self.id} title='{self.title}'>"
```

> [!note] 维度要和你的 Embedding 模型匹配
> `Vector(1536)` 中的 1536 是 OpenAI `text-embedding-3-small` 和 `text-embedding-ada-002` 的输出维度。
> 如果用 `text-embedding-3-large`，维度是 3072；用 `nomic-embed-text`（本地 Ollama），维度是 768。
> **更改向量维度需要进行数据与索引迁移**，不能直接混用不同维度的向量；可根据现有数据采用新增列、转换列类型等方案，不一定要重建整张表。

### 2.3 建表与索引：用 DDL 事件注册 HNSW 索引

推荐在 model 里同时声明向量索引，这样 `Base.metadata.create_all()` 时会自动创建：

```python
from sqlalchemy import Column, Integer, String, Text, Index, event
from sqlalchemy.orm import declarative_base
from pgvector.sqlalchemy import Vector

Base = declarative_base()

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    source = Column(String(200))
    category = Column(String(100))                  # 业务分类，用于过滤
    embedding = Column(Vector(1536))

    # 声明 HNSW 索引——注意 postgresql_using 和 postgresql_with 的写法
    __table_args__ = (
        Index(
            "idx_documents_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )

# 初始化数据库连接
engine = create_engine(
    "postgresql+psycopg2://user:password@localhost:5432/mydb",
    pool_size=10,
    max_overflow=20,
)

# 启用 pgvector 扩展（首次运行需要）
with engine.connect() as conn:
    conn.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS vector")
    conn.commit()

# 建表（幂等操作）
Base.metadata.create_all(engine)
```

### 2.4 写入数据：插入向量记录

```python
import openai
from sqlalchemy.orm import Session

openai_client = openai.OpenAI(api_key="your-api-key")

def get_embedding(text: str, model: str = "text-embedding-3-small") -> list[float]:
    """调用 OpenAI API 获取文本的 Embedding 向量"""
    response = openai_client.embeddings.create(input=text, model=model)
    return response.data[0].embedding

def insert_document(title: str, content: str, source: str, category: str) -> Document:
    """插入一条文档记录，自动生成 Embedding"""
    embedding = get_embedding(content)

    with Session(engine) as session:
        doc = Document(
            title=title,
            content=content,
            source=source,
            category=category,
            embedding=embedding,    # 直接传 Python list，pgvector-python 自动转换
        )
        session.add(doc)
        session.commit()
        session.refresh(doc)
        return doc

# 使用示例
doc = insert_document(
    title="pgvector 入门指南",
    content="pgvector 是 PostgreSQL 的向量扩展，支持精确和近似最近邻搜索...",
    source="internal_docs",
    category="技术文档",
)
print(f"插入成功，ID: {doc.id}")
```

### 2.5 相似度查询：四种距离函数

`pgvector-python` 提供了四个距离函数，直接作为 SQLAlchemy 的 `order_by` 参数使用：

```python
from pgvector.sqlalchemy import Vector
from sqlalchemy import select, text
from sqlalchemy.orm import Session

# 距离通过向量列方法调用，无需导入模块级距离函数：
# Document.embedding.cosine_distance(query_embedding)
# Document.embedding.l2_distance(query_embedding)
# Document.embedding.max_inner_product(query_embedding)  # 负内积
# Document.embedding.l1_distance(query_embedding)

def semantic_search(
    query_text: str,
    top_k: int = 5,
    category: str = None,
) -> list[dict]:
    """
    语义搜索：找到与 query_text 最相似的文档
    支持按 category 过滤
    """
    query_embedding = get_embedding(query_text)

    with Session(engine) as session:
        stmt = (
            select(
                Document.id,
                Document.title,
                Document.content,
                Document.source,
                Document.category,
                # 计算距离并作为列返回，用于显示相似度分数
                cosine_distance(Document.embedding, query_embedding).label("distance"),
            )
            .order_by(cosine_distance(Document.embedding, query_embedding))
            .limit(top_k)
        )

        # 可选：按 category 过滤；是否使用业务或向量索引取决于查询计划，近似搜索还需评估过滤后的召回率
        if category:
            stmt = stmt.where(Document.category == category)

        results = session.execute(stmt).mappings().all()

    return [
        {
            "id": r["id"],
            "title": r["title"],
            "content": r["content"][:200] + "...",
            "source": r["source"],
            "category": r["category"],
            "similarity_score": round(1 - r["distance"], 4),  # 转换为余弦相似度，理论范围为 -1~1
        }
        for r in results
    ]

# 使用示例
results = semantic_search("如何优化 PostgreSQL 向量搜索性能", top_k=5)
for r in results:
    print(f"[{r['similarity_score']:.4f}] {r['title']}")
```

### 2.6 批量插入：高效处理大量文档

当需要批量写入数千条文档时，逐条插入效率极低。推荐分批获取 Embedding + 批量 insert：

```python
import time
from typing import Generator

def batch_get_embeddings(
    texts: list[str],
    model: str = "text-embedding-3-small",
    batch_size: int = 100,
) -> list[list[float]]:
    """
    批量获取 Embedding，按批次调用 API
    OpenAI API 单次最多支持 2048 条，建议 100 条一批
    """
    all_embeddings = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        response = openai_client.embeddings.create(input=batch, model=model)
        batch_embeddings = [item.embedding for item in response.data]
        all_embeddings.extend(batch_embeddings)
        print(f"已处理 {min(i + batch_size, len(texts))}/{len(texts)} 条")
        time.sleep(0.1)  # 避免触发 API 速率限制
    return all_embeddings


def bulk_insert_documents(documents: list[dict]) -> int:
    """
    批量插入文档，使用 SQLAlchemy bulk_insert_mappings 提升性能
    documents: [{"title": ..., "content": ..., "source": ..., "category": ...}]
    """
    # 1. 批量获取所有 Embedding
    contents = [doc["content"] for doc in documents]
    embeddings = batch_get_embeddings(contents)

    # 2. 组装插入数据
    insert_data = [
        {
            "title": doc["title"],
            "content": doc["content"],
            "source": doc["source"],
            "category": doc.get("category", "未分类"),
            "embedding": emb,
        }
        for doc, emb in zip(documents, embeddings)
    ]

    # 3. 批量写入（假设在特定测试条件下可比逐条 session.add 快 5-10 倍；本文未提供测试，实际收益需测量）
    with Session(engine) as session:
        session.bulk_insert_mappings(Document, insert_data)
        session.commit()

    return len(insert_data)


# 使用示例：批量导入 1000 条文档
sample_docs = [
    {"title": f"文档 {i}", "content": f"这是第 {i} 篇文档的内容...", "source": "batch_import"}
    for i in range(1000)
]
count = bulk_insert_documents(sample_docs)
print(f"成功插入 {count} 条文档")
```

### 2.7 异步 SQLAlchemy：FastAPI 的最佳搭档

现代 Python Web 应用越来越多地采用异步框架。`pgvector-python` 完整支持 `asyncpg` 驱动和 SQLAlchemy 的异步接口：

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
# 余弦距离通过 Document.embedding.cosine_distance(...) 调用，无需导入模块级函数

# 异步引擎：注意驱动是 asyncpg
async_engine = create_async_engine(
    "postgresql+asyncpg://user:password@localhost:5432/mydb",
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = sessionmaker(
    async_engine, class_=AsyncSession, expire_on_commit=False
)


async def async_semantic_search(query_text: str, top_k: int = 5) -> list[dict]:
    """异步语义搜索，适合 FastAPI 等 async 框架"""
    query_embedding = get_embedding(query_text)  # 实际应改为 async 版本

    async with AsyncSessionLocal() as session:
        stmt = (
            select(Document, cosine_distance(Document.embedding, query_embedding).label("distance"))
            .order_by(cosine_distance(Document.embedding, query_embedding))
            .limit(top_k)
        )
        result = await session.execute(stmt)
        rows = result.all()

    return [
        {
            "id": doc.id,
            "title": doc.title,
            "similarity": round(1 - distance, 4),
        }
        for doc, distance in rows
    ]


# FastAPI 集成示例
from fastapi import FastAPI, Depends
from contextlib import asynccontextmanager

app = FastAPI()

@app.get("/search")
async def search_endpoint(q: str, k: int = 5):
    results = await async_semantic_search(q, top_k=k)
    return {"query": q, "results": results}
```

> [!tip] 异步 vs 同步的选择
> - **FastAPI / Starlette**：用异步 SQLAlchemy + asyncpg，吞吐量提升显著
> - **Flask / Django（传统同步）**：用同步 SQLAlchemy + psycopg2，更简单
> - **Celery 任务**：批量 Embedding 更新通常在后台任务中，用同步接口即可

---

## 三、Django ORM 集成：django-pgvector 全解析

Django 是 Python 生态里另一大 Web 框架，拥有完整的 ORM、Admin、认证等全套工具。`django-pgvector` 库让 Django 模型直接支持向量字段。

### 3.1 安装与配置

```bash
pip install pgvector django
```

在 `settings.py` 中添加应用：

```python
# settings.py
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    # ... 其他 apps
    "pgvector.django",      # 添加这一行
    "myapp",
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "mydb",
        "USER": "myuser",
        "PASSWORD": "mypassword",
        "HOST": "localhost",
        "PORT": "5432",
    }
}
```

### 3.2 Model 定义：四种向量字段类型

`django-pgvector` 提供了与 pgvector 数据类型一一对应的 Django 字段：

```python
# models.py
from django.db import models
from pgvector.django import HnswIndex
from pgvector.django import (
    VectorField,        # 标准浮点向量（float32），最常用
    HalfVectorField,    # 半精度向量（float16），内存减半，精度略降
    BitField,           # 二值向量，用于哈希指纹
    SparseVectorField,  # 稀疏向量，适合 BM25 等稀疏表示
)


class Article(models.Model):
    """文章模型：包含向量 Embedding 字段"""

    title = models.CharField(max_length=500)
    content = models.TextField()
    author = models.CharField(max_length=100)
    published_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    category = models.CharField(max_length=100, db_index=True)

    # 标准向量字段（float32，1536 维）
    embedding = VectorField(dimensions=1536)

    # 可选：半精度版本，用于节省存储（精度损失很小）
    # embedding_half = HalfVectorField(dimensions=1536)

    class Meta:
        verbose_name = "文章"
        verbose_name_plural = "文章"
        # 在 Meta 里声明向量索引
        indexes = [
            # HNSW 索引——推荐生产环境使用
            HnswIndex(
                fields=["embedding"],
                name="idx_article_embedding_hnsw",
                m=16,
                ef_construction=64,
                opclasses=["vector_cosine_ops"],
            ),
        ]

    def __str__(self):
        return f"{self.title} ({self.category})"
```

> [!warning] Django 向量索引的注意事项
> Django 原生 `models.Index` 不会仅因设置 `vector_cosine_ops` 就变成 HNSW 索引。
> 可在 `Meta.indexes` 中使用 `pgvector.django.HnswIndex` 声明 HNSW 及其参数（见下文），
> 或者在迁移中显式编写对应的 `RunSQL`。

### 3.3 使用专用索引类

`django-pgvector` 提供了 `HnswIndex` 和 `IvfflatIndex`，支持完整的参数配置：

```python
# models.py（推荐写法）
from pgvector.django import HnswIndex, IvfflatIndex

class Article(models.Model):
    # ... 字段定义同上

    class Meta:
        indexes = [
            # HNSW 索引：高查询性能，推荐生产使用
            HnswIndex(
                name="idx_article_hnsw_cosine",
                fields=["embedding"],
                m=16,                       # 每个节点的最大连接数
                ef_construction=64,         # 构建时搜索范围（越大越精准但构建越慢）
                opclasses=["vector_cosine_ops"],   # 余弦距离
            ),
            # 或者 IVFFlat 索引：适合超大数据集，构建更快
            # IvfflatIndex(
            #     name="idx_article_ivfflat",
            #     fields=["embedding"],
            #     lists=100,
            #     opclasses=["vector_cosine_ops"],
            # ),
        ]
```

### 3.4 生成迁移文件并应用

```bash
# 生成迁移文件
python manage.py makemigrations

# 查看生成的迁移（确认向量字段和索引都正确）
python manage.py sqlmigrate myapp 0001_initial

# 应用迁移
python manage.py migrate
```

向量字段不会自动生成启用扩展的迁移操作。需在创建向量字段之前的迁移中加入 `from pgvector.django import VectorExtension`，并将 `VectorExtension()` 放在相关 `CreateModel` 或 `AddField` 操作之前；执行账号还需具备创建扩展的权限。完成这些操作并使用上文的 `HnswIndex` 后，`sqlmigrate` 可预览类似以下 SQL（这里只展示部分字段）：

```sql
-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS "vector";

-- 建表
CREATE TABLE "myapp_article" (
    "id" bigserial NOT NULL PRIMARY KEY,
    "title" varchar(500) NOT NULL,
    "content" text NOT NULL,
    "embedding" vector(1536)
);

-- 建索引
CREATE INDEX "idx_article_hnsw_cosine"
ON "myapp_article"
USING hnsw ("embedding" vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### 3.5 QuerySet 查询：距离函数和注解

`django-pgvector` 提供了对应的 Django ORM 注解函数：

```python
# views.py 或 services.py
from django.db.models import F
from pgvector.django import (
    CosineDistance,     # 余弦距离
    L2Distance,         # 欧氏距离
    MaxInnerProduct,    # 负内积（越小越相似）
    L1Distance,         # 曼哈顿距离
)
from .models import Article


def search_articles(query_text: str, top_k: int = 10, category: str = None):
    """
    语义搜索文章
    返回最相似的 top_k 篇文章，附带相似度分数
    """
    query_embedding = get_embedding(query_text)

    queryset = Article.objects.annotate(
        distance=CosineDistance("embedding", query_embedding)
    ).order_by("distance")

    # 链式过滤：向量搜索 + 业务条件——这正是 pgvector 的优势
    if category:
        queryset = queryset.filter(category=category)

    # 过滤掉相似度太低的结果（distance > 0.5 表示余弦相似度 < 0.5）
    queryset = queryset.filter(distance__lt=0.5)

    results = queryset[:top_k].values(
        "id", "title", "author", "category", "published_at", "distance"
    )

    return [
        {
            **r,
            "similarity": round(1 - r["distance"], 4),
        }
        for r in results
    ]


def find_similar_articles(article_id: int, top_k: int = 5):
    """
    找出与指定文章最相似的其他文章——"猜你喜欢"功能的核心
    """
    source_article = Article.objects.get(id=article_id)

    similar = (
        Article.objects.exclude(id=article_id)  # 排除自身
        .annotate(distance=CosineDistance("embedding", source_article.embedding))
        .order_by("distance")[:top_k]
        .values("id", "title", "category", "distance")
    )

    return list(similar)
```

### 3.6 Django Admin 集成

pgvector 的向量字段在 Django Admin 中默认显示为文本框（不实用）。推荐在 Admin 中隐藏向量字段，展示业务字段：

```python
# admin.py
from django.contrib import admin
from .models import Article


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ["id", "title", "author", "category", "published_at"]
    list_filter = ["category", "published_at"]
    search_fields = ["title", "content", "author"]

    # 在编辑表单中排除向量字段（向量由后台自动生成，不手动输入）
    exclude = ["embedding"]

    # 添加只读字段和自定义操作
    readonly_fields = ["published_at", "updated_at"]
    actions = ["regenerate_embeddings"]

    def regenerate_embeddings(self, request, queryset):
        """管理操作：重新生成选中文章的 Embedding"""
        count = 0
        for article in queryset:
            article.embedding = get_embedding(article.content)
            article.save(update_fields=["embedding"])
            count += 1
        self.message_user(request, f"成功重新生成了 {count} 篇文章的 Embedding")

    regenerate_embeddings.short_description = "重新生成 Embedding"
```

### 3.7 Django Signals：自动维护 Embedding

向量数据最怕的问题是"过期"——业务数据更新了，Embedding 还是旧的。Django Signals 可以优雅地解决这个问题：

```python
# signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from .models import Article
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Article)
def update_article_embedding(sender, instance, created, **kwargs):
    """
    文章保存后自动更新 Embedding
    使用 transaction.on_commit 确保在事务提交后才执行，避免脏读
    """
    # 当前模型未配置内容变更跟踪，因此每次触发 post_save 都重新生成向量。
    # 如需仅在 content 变化时更新，应另行实现变更比较或配置相应跟踪器。

    def _update():
        try:
            new_embedding = get_embedding(instance.content)
            Article.objects.filter(id=instance.id).update(embedding=new_embedding)
            logger.info(f"文章 {instance.id} Embedding 已更新")
        except Exception as e:
            logger.error(f"文章 {instance.id} Embedding 更新失败: {e}")

    # 在事务提交后执行回调；on_commit 本身不会异步执行，生产异步处理可使用 Celery 任务
    transaction.on_commit(_update)
```

> [!tip] 生产建议
> Signals 里直接调用 Embedding API 会阻塞主线程。生产环境推荐：
> 1. Signal 触发时，把任务放入 Celery 队列
> 2. Celery Worker 异步调用 Embedding API
> 3. 更新向量字段
> 这样主业务流程不受影响，Embedding 更新异步完成。

---

## 四、pgvector + PostGIS：地理位置 × 语义相似

这是 pgvector 生态最有趣的组合之一。想象这样一个场景：**找附近 5 公里内，与你描述最匹配的餐厅**。这需要同时满足两个条件：

1. 地理位置在范围内（空间过滤）
2. 语义描述最相似（向量搜索）

两个条件都发生在 PostgreSQL 里，一次查询搞定，不需要任何跨系统通信。

### 4.1 安装与启用 PostGIS

```bash
# Ubuntu/Debian
sudo apt install postgresql-15-postgis-3

# 或使用 Docker（推荐）
docker pull postgis/postgis:15-3.4
```

```sql
-- 在数据库中启用两个扩展
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS postgis;
```

### 4.2 表设计：同时存储地理坐标和向量

```sql
-- 创建一个同时包含地理位置和向量的表
CREATE TABLE restaurants (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200)    NOT NULL,
    description TEXT            NOT NULL,
    address     TEXT,
    -- PostGIS 地理位置类型：经纬度坐标，使用 WGS84 坐标系（SRID=4326）
    location    GEOGRAPHY(POINT, 4326),
    -- pgvector 向量字段：餐厅描述的 Embedding
    embedding   VECTOR(1536),
    -- 业务字段
    cuisine_type    VARCHAR(50),
    price_level     INT,            -- 1=便宜 2=中等 3=贵
    rating          DECIMAL(3, 1),
    created_at  TIMESTAMP DEFAULT NOW()
);

-- 地理空间索引（PostGIS）
CREATE INDEX idx_restaurants_location ON restaurants USING GIST(location);

-- 向量相似度索引（pgvector）
CREATE INDEX idx_restaurants_embedding ON restaurants
USING HNSW(embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 业务字段索引
CREATE INDEX idx_restaurants_cuisine ON restaurants(cuisine_type);
CREATE INDEX idx_restaurants_price ON restaurants(price_level);
```

### 4.3 插入数据

```sql
-- 插入几条示例数据（向量用占位符，实际由应用层生成）
INSERT INTO restaurants (name, description, address, location, cuisine_type, price_level, rating, embedding)
VALUES
(
    '川味人家',
    '正宗四川火锅，麻辣鲜香，锅底纯正，配菜新鲜，适合朋友聚餐',
    '北京市朝阳区三里屯路 15 号',
    ST_SetSRID(ST_MakePoint(116.455, 39.937), 4326),  -- 经度, 纬度
    '川菜',
    2,
    4.7,
    '[0.1, 0.2, ...]'::vector  -- 实际 Embedding，这里省略
),
(
    '江南小馆',
    '清淡江浙菜，精致细腻，适合商务宴请，环境优雅',
    '北京市朝阳区工体北路 8 号',
    ST_SetSRID(ST_MakePoint(116.451, 39.934), 4326),
    '浙菜',
    3,
    4.5,
    '[0.3, 0.4, ...]'::vector
);
```

### 4.4 核心查询：附近 + 语义搜索

```sql
-- 场景：用户在三里屯（116.454, 39.936），想找"辛辣刺激的聚会场所"
-- 范围：5 公里内，相似度最高的前 10 家

WITH query_params AS (
    SELECT
        ST_SetSRID(ST_MakePoint(116.454, 39.936), 4326) AS user_location,
        '[用户描述的 Embedding 向量]'::vector             AS query_vector
)
SELECT
    r.id,
    r.name,
    r.description,
    r.cuisine_type,
    r.price_level,
    r.rating,
    -- 计算距离（PostGIS，单位：米）
    ST_Distance(r.location, q.user_location) AS distance_meters,
    -- 计算语义相似度（pgvector）
    1 - (r.embedding <=> q.query_vector)     AS semantic_similarity
FROM
    restaurants r,
    query_params q
WHERE
    -- 空间过滤：5 公里范围（ST_DWithin 会用到空间索引，非常高效）
    ST_DWithin(r.location::geography, q.user_location, 5000)
    -- 可选：价格过滤
    AND r.price_level <= 2
ORDER BY
    -- 综合排序：语义相似度（权重 0.7）+ 距离衰减（权重 0.3）
    (1 - (r.embedding <=> q.query_vector)) * 0.7
    - (ST_Distance(r.location, q.user_location) / 5000) * 0.3
    DESC
LIMIT 10;
```

### 4.5 Python 封装

```python
from sqlalchemy import text

def find_nearby_restaurants(
    user_lat: float,
    user_lng: float,
    query_text: str,
    radius_km: float = 5.0,
    max_price: int = 3,
    top_k: int = 10,
) -> list[dict]:
    """
    附近语义搜索餐厅
    结合 PostGIS 地理过滤 + pgvector 向量相似度
    """
    query_embedding = get_embedding(query_text)

    sql = text("""
        WITH query_params AS (
            SELECT
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) AS user_location,
                CAST(:query_vector AS vector) AS query_vector
        )
        SELECT
            r.id, r.name, r.description, r.cuisine_type,
            r.price_level, r.rating,
            ST_Distance(r.location::geography, q.user_location) AS distance_m,
            1 - (r.embedding <=> q.query_vector) AS similarity
        FROM restaurants r, query_params q
        WHERE
            ST_DWithin(r.location::geography, q.user_location, :radius_m)
            AND r.price_level <= :max_price
        ORDER BY
            (1 - (r.embedding <=> q.query_vector)) * 0.7
            - (ST_Distance(r.location::geography, q.user_location) / :radius_m) * 0.3
            DESC
        LIMIT :top_k
    """)

    with engine.connect() as conn:
        result = conn.execute(
            sql,
            {
                "lat": user_lat,
                "lng": user_lng,
                "query_vector": str(query_embedding),
                "radius_m": radius_km * 1000,
                "max_price": max_price,
                "top_k": top_k,
            },
        )
        return [dict(row._mapping) for row in result]
```

> [!note] 为什么这个组合很有价值
> PostGIS 提供空间索引和精确地理计算能力，pgvector 提供向量距离与近邻检索能力。
> 本节展示两者在 PostgreSQL 内组合空间过滤与语义排序的方式。
> 专用向量数据库是否具备所需空间功能，应按具体产品和版本比较，不能由本示例一概判定。

---

## 五、pgvector + TimescaleDB/pgvectorscale：时序 × 向量

另一个强大组合：把向量搜索和时序数据结合起来。典型场景：

- **日志 Embedding 搜索**：找出过去一周内，语义上最相似的错误日志
- **监控异常检测**：找出当前指标状态与历史哪个时间段最相似
- **用户行为分析**：找出某时间段内，行为模式最相似的用户群体

### 5.1 TimescaleDB 与 pgvectorscale 简介

这两个扩展都来自 Timescale 公司：

| 扩展 | 功能 | 核心价值 |
|------|------|----------|
| **TimescaleDB** | 时序数据管理 | 自动分区（hypertable）、时间维度索引、压缩 |
| **pgvectorscale** | 增强向量搜索 | StreamingDiskANN 索引，比 HNSW 在大规模数据下更高效 |
| **pgai** | AI 模型调用 | 在 SQL 里直接调用 OpenAI、Ollama 等模型 |

三者配合使用，构成 Timescale 称为"AI Ready PostgreSQL"的完整方案。

### 5.2 启用扩展

```sql
-- 启用三个扩展（需先安装对应软件包）
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS vectorscale CASCADE;  -- 依赖 vector
```

### 5.3 表设计：hypertable + 向量字段

```sql
-- 创建日志表：带时间戳的向量数据
CREATE TABLE log_embeddings (
    time        TIMESTAMPTZ     NOT NULL,           -- 时间戳（TimescaleDB 必须有）
    log_id      TEXT            NOT NULL,
    service     VARCHAR(100)    NOT NULL,
    level       VARCHAR(20)     NOT NULL,           -- ERROR, WARN, INFO
    message     TEXT            NOT NULL,
    embedding   VECTOR(768),                        -- 日志文本的 Embedding
    extra       JSONB                               -- 额外结构化字段
);

-- 将普通表转换为 hypertable（按时间自动分区）
-- chunk_time_interval = 1 day：每天一个分区
SELECT create_hypertable('log_embeddings', 'time',
    chunk_time_interval => INTERVAL '1 day');

-- pgvectorscale 的 StreamingDiskANN 索引
-- 比 HNSW 在磁盘上的性能更好，适合超大规模数据
CREATE INDEX idx_log_diskann ON log_embeddings
USING diskann (embedding);

-- TimescaleDB 时序索引（自动创建 time 的索引，但也可以手动指定）
CREATE INDEX idx_log_time_service ON log_embeddings(time DESC, service);
```

### 5.4 时序向量查询：过去 N 天内最相似的日志

```sql
-- 场景：找出过去 7 天内，与当前错误日志最相似的历史记录
-- 用于快速定位"我见过这种错误吗？上次怎么解决的？"

WITH current_error AS (
    -- 假设这是当前出现的新错误
    SELECT '[当前错误日志的 Embedding]'::vector AS query_vec
)
SELECT
    l.time,
    l.service,
    l.level,
    l.message,
    l.embedding <=> c.query_vec AS distance,
    1 - (l.embedding <=> c.query_vec) AS similarity
FROM
    log_embeddings l,
    current_error c
WHERE
    -- 时间过滤：最近 7 天（TimescaleDB 会做时间分区裁剪，非常高效）
    l.time >= NOW() - INTERVAL '7 days'
    -- 服务过滤
    AND l.service = 'payment-service'
    -- 只看错误级别
    AND l.level IN ('ERROR', 'CRITICAL')
ORDER BY
    l.embedding <=> c.query_vec
LIMIT 20;
```

> [!note] TimescaleDB 的时间裁剪优势
> 当你加上 `WHERE time >= NOW() - INTERVAL '7 days'` 这样的条件时，
> TimescaleDB 会自动跳过不相关的时间分区（chunk exclusion），
> 只扫描最近 7 天的数据块，性能远好于没有时间分区的普通表。
> 向量搜索 + 时间裁剪 = 范围大幅缩小，索引效率大幅提升。

### 5.5 pgvectorscale vs HNSW 的选择

```text
待压测的场景假设（本文未提供这些阈值的测试依据）：

数据量 < 500 万：           可先评估 pgvector 原生 HNSW，不能仅据条数判断是否足够
数据量 500 万 ~ 5000 万：   可将 pgvectorscale StreamingDiskANN 纳入比较
数据量 > 5000 万：          可同时评估 Milvus 或 Citus 分片方案，而非必然迁移

内存充裕（索引能全部放内存）：  可优先测试 HNSW
内存紧张（磁盘数据多）：        可测试面向磁盘场景的 StreamingDiskANN

最终选择需结合向量维度、过滤条件、召回率、并发、硬件和维护成本，不能把上述条数视为通用选型界线。
```

---

## 六、pgai 扩展：让 SQL 直接调用 AI 模型

pgai 是 Timescale 在 2024 年发布的重要扩展。它的核心思路很简单，但非常有冲击力：

**把 Embedding 生成这件事从应用层移到数据库层。**

### 6.1 传统方式 vs pgai 方式

传统方式的数据流：

```text
应用代码 → 调用 Embedding API → 拿到向量 → 写入 PostgreSQL
```

pgai 方式：

```text
SQL 语句 → PostgreSQL 调用 Embedding API → 向量直接存入表
```

这个改变看起来只是少了几行代码，但带来的好处很实际：
- 批量处理时，不需要把数据从数据库拉到应用层再推回去
- 直接 SQL 调用可将向量写入纳入当前数据库事务，但外部模型请求不受数据库回滚控制；Vectorizer 的后台异步更新不保证提交时向量已同步
- 定时任务可以直接写 SQL，不需要维护 Python 脚本

### 6.2 安装与配置

```bash
# Docker 方式（最简单）
docker run -d \
  --name pgai-demo \
  -e POSTGRES_PASSWORD=pgvector \
  -e OPENAI_API_KEY=your-api-key \
  -p 5432:5432 \
  timescale/timescaledb-ha:pg16-latest
```

```sql
-- 启用 pgai 扩展
CREATE EXTENSION IF NOT EXISTS ai CASCADE;

-- 配置 OpenAI API Key（也可以通过环境变量设置）
SELECT ai.set_secret('OPENAI_API_KEY', 'your-openai-api-key');
```

### 6.3 在 SQL 里调用 OpenAI 生成 Embedding

```sql
-- 直接在 SQL 里生成 Embedding
SELECT ai.openai_embed(
    'text-embedding-3-small',       -- 模型名
    '这是一段需要生成向量的文本',     -- 输入文本
    api_key => current_setting('ai.openai_api_key')
);
-- 返回：vector(1536) 类型的值

-- 批量给表里的数据生成 Embedding
UPDATE documents
SET embedding = ai.openai_embed(
    'text-embedding-3-small',
    content,
    api_key => current_setting('ai.openai_api_key')
)
WHERE embedding IS NULL;

-- 插入时自动生成 Embedding（一条 INSERT 搞定）
INSERT INTO documents (title, content, embedding)
VALUES (
    'pgai 使用指南',
    'pgai 让你在 SQL 里直接调用 OpenAI API...',
    ai.openai_embed(
        'text-embedding-3-small',
        'pgai 让你在 SQL 里直接调用 OpenAI API...',
        api_key => current_setting('ai.openai_api_key')
    )
);
```

### 6.4 调用本地 Ollama 模型

以下代码展示 Ollama 调用和查询的结构，不可直接接在前文的 1536 维 `documents.embedding` 上执行：`nomic-embed-text` 示例输出为 768 维，需要另建匹配维度的列或表，并用同一模型重新生成全部待检索向量。`localhost:11434` 只有在执行模型请求的进程能够通过该地址访问 Ollama 时才适用；数据库容器中的 localhost 通常不是宿主机。pgai 接口与运行条件仍受下一节所述维护边界限制。

```sql
-- 前提：本地运行着 Ollama，并已拉取 nomic-embed-text 模型
-- ollama pull nomic-embed-text

-- 调用本地 Ollama 生成 Embedding（完全离线，数据不出本地）
SELECT ai.ollama_embed(
    'nomic-embed-text',             -- Ollama 模型名
    '这是需要生成向量的本地文本',
    host => 'http://localhost:11434'  -- Ollama 服务地址
);
-- 返回：vector(768) 类型

-- 使用 Ollama Embedding 做语义搜索
SELECT
    title,
    content,
    1 - (embedding <=> ai.ollama_embed(
        'nomic-embed-text',
        '查询文本',
        host => 'http://localhost:11434'
    )) AS similarity
FROM documents
ORDER BY embedding <=> ai.ollama_embed(
    'nomic-embed-text',
    '查询文本',
    host => 'http://localhost:11434'
)
LIMIT 5;
```

### 6.5 pgai Vectorizer：自动化 Embedding 同步

pgai Vectorizer 是 pgai 最强大的功能——它可以监听表的变化，自动保持 Embedding 与原始数据同步：

```sql
-- 为 documents 表创建 Vectorizer
-- 它会：1. 自动生成 embeddings 表  2. 监听 documents 变化  3. 自动更新 Embedding
SELECT ai.create_vectorizer(
    'documents'::regclass,              -- 源表
    embedding => ai.embedding_openai(   -- 使用 OpenAI 模型
        'text-embedding-3-small',
        1536
    ),
    chunking => ai.chunking_recursive_character_text_splitter(
        'content',                      -- 对 content 列进行分块
        chunk_size => 500,
        chunk_overlap => 50
    ),
    formatting => ai.formatting_python_template('标题：$title 内容：$chunk')
);

-- Vectorizer 会自动创建一个视图 documents_embedding_store
-- 可以直接查询
SELECT
    chunk,
    embedding <=> '[查询向量]'::vector AS distance
FROM documents_embedding_store
ORDER BY distance
LIMIT 5;
```

> [!note] pgai Vectorizer 的工作原理
> 1. 在源表上创建触发器，监听 INSERT/UPDATE/DELETE
> 2. 把待处理的变更放入工作队列
> 3. 后台 Worker 异步调用 Embedding API
> 4. 将结果写入专用的 embedding 存储表
> 5. 暴露一个视图，方便查询
>
> 整个过程对应用代码透明——你只需要维护业务表，Embedding 自动跟上。

---

## 七、连接池：pgBouncer 的注意事项

pgBouncer 是 PostgreSQL 最流行的连接池方案。好消息是：pgvector 的向量查询和普通 SQL 查询一样，对连接池没有特殊要求。但有几个细节需要注意。

### 7.1 pgBouncer 连接模式选择

pgBouncer 有三种连接模式，对 pgvector 的影响不同：

```text
Session Mode（会话模式）
  连接绑定到会话生命周期，客户端连接 = 后端连接
  优点：完全兼容所有 PG 特性，包括 SET 语句
  缺点：连接复用效果最差
  pgvector 影响：无影响，推荐初期使用

Transaction Mode（事务模式）
  连接在事务期间保持，事务结束后归还连接池
  优点：最高的连接复用效率
  缺点：不支持 SET 语句跨事务保留
  pgvector 影响：需要注意 SET LOCAL 的使用方式

Statement Mode（语句模式）
  每条语句执行完即归还连接
  基本不兼容多语句事务
  pgvector 影响：不推荐使用
```

### 7.2 Transaction Mode 下的注意事项

pgvector 有一些查询参数通过 `SET` 语句配置，在 Transaction Mode 下需要特别处理：

```sql
-- 这些 SET 语句在 Transaction Mode 下不会跨事务保留
SET hnsw.ef_search = 100;       -- HNSW 查询时的搜索范围
SET ivfflat.probes = 10;        -- IVFFlat 的探针数量

-- 解决方案 1：在每个事务开头重新 SET
BEGIN;
SET LOCAL hnsw.ef_search = 100;  -- SET LOCAL 只在当前事务有效，符合 Transaction Mode
SELECT * FROM documents ORDER BY embedding <=> '[...]'::vector LIMIT 5;
COMMIT;

-- 事务池优先在每个事务内使用 SET LOCAL。
-- server_reset_query 默认不在 transaction 模式执行，不能直接作为此处的默认参数方案。
```

### 7.3 pgBouncer 配置参考

```ini
# pgbouncer.ini 配置示例
[databases]
mydb = host=127.0.0.1 port=5432 dbname=mydb

[pgbouncer]
listen_port = 6432
listen_addr = *
auth_type = hba

# 推荐向量应用使用 transaction 模式
pool_mode = transaction

# 连接池大小配置
# max_client_conn 限制客户端连接数，default_pool_size 控制各数据库/用户池的服务端连接规模；后端总连接预算还需结合池数量及 PostgreSQL max_connections 计算
max_client_conn = 1000          # 客户端最大连接数
default_pool_size = 25          # 每个数据库的连接池大小

# 向量查询通常耗时较长，适当调大超时
query_timeout = 30              # 单条查询超时（秒）
client_idle_timeout = 60        # 客户端空闲超时

# 关键：确保 pgvector 扩展在连接初始化时已加载
# server_reset_query 是否在归还连接时执行取决于池模式及相关配置；transaction 模式默认不执行
server_reset_query = DISCARD ALL
```

> [!warning] 向量查询的超时设置
> 向量的 HNSW 近似搜索通常在毫秒级完成，但如果发生 seq scan（全表向量扫描），
> 对于百万行级别的数据可能需要几十秒。
> 生产环境务必设置合理的 `statement_timeout`，避免慢查询占满连接池。
> ```sql
> SET statement_timeout = '10s';  -- 超过 10 秒自动终止
> ```

---

## 八、逻辑复制：向量列如何被复制

pgvector 的向量列在逻辑复制中的行为与其他列完全一致。这个"理所当然"的特性，放在专用向量数据库里其实是一个很难解决的问题。

### 8.1 向量列与逻辑复制的兼容性

```sql
-- 前置：发布端需配置 wal_level=logical、复制权限、连接访问规则和足够的复制资源。
-- 订阅端需预建兼容的表结构，并安装、启用 vector 及涉及的其他扩展；DDL 不会随逻辑复制自动同步。
-- UPDATE/DELETE 还需为发布表配置适用的副本标识。
-- 在发布端创建发布；向量列可随表数据参与复制
CREATE PUBLICATION pgvector_pub
FOR TABLE documents, restaurants, articles
WITH (publish = 'insert, update, delete');

-- 在从库上：创建订阅（Subscription）
-- 以下仅展示订阅语句，需先满足上文复制与目标端环境前置
CREATE SUBSCRIPTION pgvector_sub
CONNECTION 'host=primary port=5432 dbname=mydb user=replicator password=xxx'
PUBLICATION pgvector_pub;
```

### 8.2 复制注意事项

```sql
-- 检查复制状态
SELECT
    subname,
    pid,
    received_lsn,
    latest_end_lsn,
    last_msg_receipt_time AS last_message_received_at
FROM pg_stat_subscription;

-- 检查复制延迟（向量列数据量大，可能影响复制延迟）
SELECT
    client_addr,
    state,
    sent_lsn - replay_lsn AS replication_lag_bytes,
    EXTRACT(EPOCH FROM replay_lag) AS reported_replay_lag_seconds
FROM pg_stat_replication;
```

> [!note] 向量列对复制带宽的影响
> 1536 维 float32 向量每行占 6 KB。如果批量插入大量向量数据（如每天导入 10 万行），
> 相当于每天要复制约 600 MB 的向量数据。
> 这对复制延迟有直接影响。建议：
> - 批量导入时关注从库复制延迟
> - 读写分离场景下，向量搜索读请求路由到从库时，注意复制延迟导致的"数据短暂不一致"

---

## 九、备份与恢复：pg_dump 的零配置支持

这是最让人放心的部分。**pgvector 的向量数据备份完全透明，不需要任何特殊处理。**

### 9.1 pg_dump 直接备份

```bash
# 备份整个数据库（包含向量数据）
pg_dump -h localhost -U myuser -d mydb -F c -f backup_$(date +%Y%m%d).dump

# 只备份包含向量的表
pg_dump -h localhost -U myuser -d mydb \
  -t documents -t restaurants \
  -F c -f vectors_backup_$(date +%Y%m%d).dump

# 恢复
pg_restore -h localhost -U myuser -d mydb backup_20260311.dump

# 或使用 pg_dumpall 备份所有数据库（包含扩展信息）
pg_dumpall -h localhost -U postgres -f full_backup.sql
```

> [!tip] pg_dump 备份的内容
> 完整数据库备份通常包含：
> - `CREATE EXTENSION vector` 语句；恢复端仍需预先安装兼容的扩展软件，并具备创建扩展的权限
> - 向量数据（custom 归档格式不等同于 COPY 二进制数据格式）
> - 向量索引的定义（恢复时重建索引）
> 使用 `-t` 按表备份时，不保证包含所选表依赖的扩展等对象，恢复前需准备相应依赖。备份不会打包扩展二进制软件。

### 9.2 增量备份：WAL 归档

```bash
# 启用 WAL 归档（postgresql.conf）
# wal_level = replica
# archive_mode = on
# archive_command = 'cp %p /backup/wal/%f'

# pgBackRest 是生产环境推荐的备份工具，支持 WAL 增量备份
# 向量数据对 pgBackRest 完全透明，无需特殊配置
pgbackrest --stanza=mydb backup --type=incr
```

### 9.3 备份大向量表的性能考虑

```bash
# 对于包含大量向量数据的表，备份时需考虑：
# 1. 压缩：此处使用 pg_dump -Z 9；压缩率约 40% 仅作为未测试的示例假设，实际结果取决于数据、压缩方式和客户端版本
pg_dump -h localhost -U myuser -d mydb -Z 9 -F c -f backup_compressed.dump

# 2. 并行备份：使用目录格式和 4 个 worker；并行目录备份并非 PostgreSQL 14 才开始支持
pg_dump -h localhost -U myuser -d mydb \
  -F d \
  -j 4 \
  -f backup_dir/

# 3. 只备份向量数据（不包含索引，恢复后重建）
# pre-data 包含表结构等前置定义，data 包含数据；此处省略 post-data 中的索引等定义
pg_dump -h localhost -U myuser -d mydb \
  --section=pre-data \
  --section=data \
  -F c -f backup_no_index.dump
# 此备份省略索引定义，恢复后需另行创建索引；pg_dump 原本也只保存索引定义，常规恢复时同样会重建索引
```

---

## 十、集成方案选型参考

用一张表格总结各种集成场景的选择建议：

| 场景 | 推荐方案 | 关键理由 |
|------|----------|----------|
| Python FastAPI + 向量搜索 | SQLAlchemy async + asyncpg | 适合 FastAPI 异步调用链，吞吐收益取决于负载与实现 |
| Python Flask/Django + 向量搜索 | django-pgvector / SQLAlchemy sync | 简单直接，与现有项目无缝集成 |
| 需要地理位置 + 语义搜索 | pgvector + PostGIS | 可在 PostgreSQL 单库内组合空间过滤与语义搜索 |
| 日志/时序数据 + 向量搜索 | pgvector + TimescaleDB | 时间分区裁剪大幅提升性能 |
| 大规模向量（>1000 万） | pgvector + pgvectorscale | StreamingDiskANN 磁盘优化 |
| Embedding 自动同步 | pgai Vectorizer | 减少应用层同步代码，以后台任务异步更新向量 |
| 本地私有化部署 | pgai + Ollama | 数据不出境，完全离线 |
| 高并发连接管理 | pgBouncer Transaction Mode | 连接复用效率最高 |
| 数据同步/读副本 | PostgreSQL 逻辑复制 | 可复制向量列；需配置复制前置，不能单凭订阅语句构成完整高可用方案 |
| 数据备份 | pg_dump | 可备份向量数据；按表备份依赖及恢复端扩展环境需单独准备 |

---

## 小结

pgvector 的生态优势体现在每一个细节里：

1. **ORM 层**：SQLAlchemy 和 Django 都有成熟的官方支持，向量字段就是一个普通字段，不破坏现有代码结构
2. **空间与语义组合查询**：PostGIS 与 pgvector 可在 PostgreSQL 内组合地理过滤和语义排序，是否可由其他系统替代需按具体功能需求比较
3. **时序扩展**：TimescaleDB 的分区裁剪 + pgvectorscale 的磁盘优化，把单节点能力推向更高上限
4. **pgai 自动化**：把 Embedding 生成这件繁琐的事交给数据库，应用代码更干净
5. **基础设施透明**：连接池、复制、备份——许多现有工具可继续使用，但连接池参数、复制前置和恢复端扩展环境仍需按部署条件配置

这套生态的价值，在你第一次用 `pg_dump` 一键备份了向量数据，或者第一次用 Django QuerySet 链式过滤了向量搜索结果的时候，会有深刻的体会。

下一步：生产运维与性能调优 — 把 pgvector 调到生产最优状态。

---

> [!summary] 本文核心要点
> - **SQLAlchemy**：`pgvector-python` 提供 `Vector` 类型和四个距离函数，支持同步/异步
> - **Django**：`django-pgvector` 提供 `VectorField`、`HnswIndex`、`CosineDistance` 等完整工具链
> - **PostGIS 组合**：`ST_DWithin`（空间过滤）+ `<=>` 运算符（向量相似），一次查询完成地理+语义搜索
> - **TimescaleDB 组合**：hypertable 时间分区裁剪 + diskann 索引，应对时序向量场景
> - **pgai**：`ai.openai_embed()` 和 `ai.ollama_embed()` 直接在 SQL 里生成 Embedding；Vectorizer 自动同步
> - **pgBouncer**：Transaction Mode 下需注意 `SET LOCAL` 而非 `SET`
> - **备份/复制**：可复用 PostgreSQL 工具，但逻辑复制前置、按表备份依赖和恢复端扩展环境仍需配置
