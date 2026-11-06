---
title: PostgreSQL索引与性能优化
tags:
  - PostgreSQL
  - 索引
  - 性能优化
  - 查询计划
  - EXPLAIN
  - B-tree
  - GIN
  - GiST
difficulty: 高级
duration: 40分钟
description: 深入学习PostgreSQL的索引机制和性能优化技巧，掌握如何分析和优化查询性能。
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据分析师
  - BI分析师
  - 数据库开发与运维人员
stability: slow-changing
status: maintenance
access_tier: free
updated: 2026-10-10
---


# ⚡ PostgreSQL索引与性能优化

## 📚 学习目标

通过本章节的学习，你将能够：
- **理解PostgreSQL的各种索引类型**和使用场景
- **掌握查询计划分析**和性能诊断技巧
- **学会创建和优化索引**策略
- **理解查询优化器**的工作原理
- **掌握实际的性能调优**方法和最佳实践

> [!tip] 💡 学习建议
> 性能优化是一门艺术，也是一门科学。**不要追求完美的理论，而要关注实际效果**。就像给汽车调优一样，需要在不同的场景下测试和调整。**每个优化都要有数据支撑**，使用EXPLAIN ANALYZE来验证你的假设。

## 🎯 PostgreSQL索引类型详解

### 1. B-tree索引（默认索引）

B-tree索引是最常用的索引类型，适合等值查询和范围查询。

```sql
-- 创建测试表
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200),
    category VARCHAR(100),
    price DECIMAL(10,2),
    stock_quantity INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    tags TEXT[]
);

-- 插入测试数据
INSERT INTO products (name, category, price, stock_quantity, tags)
SELECT 
    'Product ' || generate_series,
    CASE (generate_series % 5)
        WHEN 0 THEN 'Electronics'
        WHEN 1 THEN 'Clothing'
        WHEN 2 THEN 'Books'
        WHEN 3 THEN 'Home'
        ELSE 'Sports'
    END,
    ROUND((RANDOM() * 1000 + 10)::NUMERIC, 2),
    FLOOR(RANDOM() * 1000),
    ARRAY['tag' || (generate_series % 10), 'category' || (generate_series % 3)]
FROM generate_series(1, 100000);

-- 创建B-tree索引
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_created_at ON products(created_at);

-- 复合B-tree索引
CREATE INDEX idx_products_category_price ON products(category, price);
CREATE INDEX idx_products_price_stock ON products(price, stock_quantity);

-- 测试B-tree索引性能
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM products WHERE name = 'Product 1000';

EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM products WHERE category = 'Electronics' AND price BETWEEN 100 AND 500;

-- 部分索引（条件索引）
CREATE INDEX idx_products_active_price ON products(price) WHERE is_active = TRUE;
CREATE INDEX idx_products_expensive ON products(name) WHERE price > 500;

-- 表达式索引
CREATE INDEX idx_products_upper_name ON products(UPPER(name));
CREATE INDEX idx_products_year ON products(EXTRACT(YEAR FROM created_at));
```

### 2. Hash索引

Hash索引适合等值查询，但不支持范围查询。

```sql
-- 创建Hash索引
CREATE INDEX idx_products_id_hash ON products USING HASH(id);
CREATE INDEX idx_products_category_hash ON products USING HASH(category);

-- 测试Hash索引
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM products WHERE id = 5000;

-- Hash索引不适合范围查询
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM products WHERE id > 5000;  -- 不会使用Hash索引
```

### 3. GIN索引（通用倒排索引）

GIN索引适合包含查询，如数组、JSON、全文搜索等。

```sql
-- 为数组创建GIN索引
CREATE INDEX idx_products_tags_gin ON products USING GIN(tags);

-- 测试数组查询
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM products WHERE tags @> ARRAY['tag1'];

EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM products WHERE tags && ARRAY['tag1', 'tag2'];

-- 为JSON创建GIN索引
ALTER TABLE products ADD COLUMN attributes JSONB;
UPDATE products SET attributes = json_build_object(
    'brand', 'Brand ' || (id % 10),
    'model', 'Model ' || (id % 20),
    'features', ARRAY['feature' || (id % 5), 'feature' || (id % 7)]
);

CREATE INDEX idx_products_attributes_gin ON products USING GIN(attributes);

-- 测试JSON查询
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM products WHERE attributes @> '{"brand": "Brand 1"}';

EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM products WHERE attributes ? 'model';

-- 全文搜索GIN索引
ALTER TABLE products ADD COLUMN search_vector TSVECTOR;
UPDATE products SET search_vector = to_tsvector('english', name || ' ' || category);

CREATE INDEX idx_products_search_gin ON products USING GIN(search_vector);

-- 测试全文搜索
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM products WHERE search_vector @@ to_tsquery('english', 'Product & Electronics');
```

### 4. GiST索引（通用搜索树）

GiST索引适合几何数据、范围查询等。

```sql
-- 添加几何数据列
ALTER TABLE products ADD COLUMN location POINT;
UPDATE products SET location = POINT(
    RANDOM() * 180 - 90,  -- 平面x坐标
    RANDOM() * 90 - 45    -- 平面y坐标
);

-- 创建GiST索引
CREATE INDEX idx_products_location_gist ON products USING GiST(location);

-- 测试几何查询
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM products 
ORDER BY location <-> POINT(0, 0)
LIMIT 10;  -- 平面坐标最近邻查询，可用于观察GiST距离排序计划

-- 为范围类型创建GiST索引
ALTER TABLE products ADD COLUMN price_range NUMRANGE;
UPDATE products SET price_range = NUMRANGE(price, price * 1.2);

CREATE INDEX idx_products_price_range_gist ON products USING GiST(price_range);

-- 测试范围查询
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM products 
WHERE price_range @> 100.0;  -- 包含查询
```

### 5. SP-GiST索引（空间分区通用搜索树）

SP-GiST索引适合分层数据和空间数据。

```sql
-- 为TEXT类型创建SP-GiST索引
CREATE INDEX idx_products_name_spgist ON products USING SPGIST(name);

-- 测试前缀查询
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM products WHERE name ^@ 'Product 1';  -- 前缀匹配
```

### 6. BRIN索引（块范围索引）

BRIN索引适合大表中的有序数据，占用空间小。

```sql
-- 为时间序列数据创建BRIN索引
CREATE INDEX idx_products_created_brin ON products USING BRIN(created_at);
CREATE INDEX idx_products_id_brin ON products USING BRIN(id);

-- 测试BRIN索引
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM products 
WHERE created_at >= '2024-01-01' AND created_at < '2024-02-01';
```

## 📊 查询计划分析

### 1. EXPLAIN命令详解

```sql
-- 基本EXPLAIN
EXPLAIN SELECT * FROM products WHERE category = 'Electronics';

-- EXPLAIN ANALYZE（实际执行）
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM products WHERE category = 'Electronics' AND price > 100;

-- 详细的EXPLAIN选项
EXPLAIN (
    ANALYZE TRUE,     -- 实际执行查询
    BUFFERS TRUE,     -- 显示缓冲区信息
    TIMING TRUE,      -- 显示执行时间
    COSTS TRUE,       -- 显示成本估算
    VERBOSE TRUE,     -- 详细输出
    FORMAT JSON       -- JSON格式输出
)
SELECT p.name, p.price, p.category
FROM products p
WHERE p.category = 'Electronics'
  AND p.price BETWEEN 100 AND 500
ORDER BY p.price DESC
LIMIT 10;
```

### 2. 读懂查询计划

```sql
-- 创建更复杂的查询来分析
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    customer_id INTEGER,
    quantity INTEGER,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending'
);

-- 插入订单数据
INSERT INTO orders (product_id, customer_id, quantity)
SELECT 
    FLOOR(RANDOM() * 100000)::INTEGER + 1,
    (RANDOM() * 10000 + 1)::INTEGER,
    (RANDOM() * 10 + 1)::INTEGER
FROM generate_series(1, 50000);

-- 创建索引
CREATE INDEX idx_orders_product_id ON orders(product_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_order_date ON orders(order_date);

-- 分析复杂查询
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT 
    p.name,
    p.category,
    p.price,
    COUNT(o.id) as order_count,
    SUM(o.quantity) as total_quantity,
    AVG(o.quantity) as avg_quantity
FROM products p
LEFT JOIN orders o ON p.id = o.product_id
WHERE p.category IN ('Electronics', 'Books')
  AND p.price > 50
  AND (o.order_date IS NULL OR o.order_date >= '2024-01-01')
GROUP BY p.id, p.name, p.category, p.price
HAVING COUNT(o.id) > 0
ORDER BY total_quantity DESC
LIMIT 20;

-- 查看查询计划中的关键信息
/*
关键指标解读：
1. Seq Scan：顺序扫描，读取较大比例数据时可能是合理选择
2. Index Scan：索引扫描，效果取决于选择率和回表成本
3. Index Only Scan：仅索引扫描，是否避免堆访问还取决于可见性映射；三者没有固定优劣顺序
4. Nested Loop：嵌套循环连接
5. Hash Join：哈希连接
6. Merge Join：合并连接
7. cost：估算成本
8. rows：估算行数
9. actual time：实际执行时间
10. buffers：缓冲区使用情况
*/
```

### 3. 性能监控查询

```sql
-- 查看慢查询
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;

-- 查看表的统计信息
SELECT 
    schemaname,
    tablename,
    seq_scan,           -- 顺序扫描次数
    seq_tup_read,       -- 顺序扫描读取的行数
    idx_scan,           -- 索引扫描次数
    idx_tup_fetch,      -- 索引扫描获取的行数
    n_tup_ins,          -- 插入的行数
    n_tup_upd,          -- 更新的行数
    n_tup_del           -- 删除的行数
FROM pg_stat_user_tables
WHERE tablename IN ('products', 'orders');

-- 查看索引使用情况
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,           -- 索引被使用的次数
    idx_tup_read,       -- 索引读取的行数
    idx_tup_fetch       -- 索引获取的行数
FROM pg_stat_user_indexes
WHERE tablename IN ('products', 'orders')
ORDER BY idx_scan DESC;
```

## 🚀 性能优化策略

### 1. 索引优化

```sql
-- 分析表的大小和索引
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(tablename::regclass)) as table_size,
    pg_size_pretty(pg_relation_size(tablename::regclass)) as table_only_size,
    pg_size_pretty(pg_indexes_size(tablename::regclass)) as index_size
FROM pg_tables 
WHERE tablename IN ('products', 'orders');

-- 查找未使用的索引
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- 查找列名相同的索引候选；还需比较访问方法、唯一性、谓词、表达式、操作符类及包含列，不能直接认定重复或删除
WITH index_columns AS (
    SELECT 
        i.indexrelid,
        i.indrelid,
        array_agg(a.attname ORDER BY a.attnum) as columns
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indexrelid
    WHERE a.attnum > 0
    GROUP BY i.indexrelid, i.indrelid
)
SELECT 
    c1.relname as table_name,
    c2.relname as index1,
    c3.relname as index2,
    ic1.columns
FROM index_columns ic1
JOIN index_columns ic2 ON ic1.indrelid = ic2.indrelid 
    AND ic1.columns = ic2.columns 
    AND ic1.indexrelid < ic2.indexrelid
JOIN pg_class c1 ON c1.oid = ic1.indrelid
JOIN pg_class c2 ON c2.oid = ic1.indexrelid
JOIN pg_class c3 ON c3.oid = ic2.indexrelid;

-- 创建覆盖索引（包含索引）
CREATE INDEX idx_products_category_covering 
ON products(category) 
INCLUDE (name, price);

-- 测试覆盖索引效果
EXPLAIN (ANALYZE, BUFFERS)
SELECT name, price 
FROM products 
WHERE category = 'Electronics';
```

### 2. 查询优化

```sql
-- 优化前的查询
EXPLAIN (ANALYZE, BUFFERS)
SELECT DISTINCT p.category, COUNT(*)
FROM products p
JOIN orders o ON p.id = o.product_id
WHERE p.price > 100
GROUP BY p.category;

-- 改为统计至少有一笔订单的产品数（使用EXISTS，与上面的订单行数统计不等价）
EXPLAIN (ANALYZE, BUFFERS)
SELECT p.category, COUNT(*)
FROM products p
WHERE p.price > 100
  AND EXISTS (SELECT 1 FROM orders o WHERE o.product_id = p.id)
GROUP BY p.category;

-- 使用CTE优化复杂查询
EXPLAIN (ANALYZE, BUFFERS)
WITH popular_products AS (
    SELECT product_id, COUNT(*) as order_count
    FROM orders
    GROUP BY product_id
    HAVING COUNT(*) > 5
),
high_value_products AS (
    SELECT id, name, category, price
    FROM products
    WHERE price > 100
)
SELECT 
    hvp.category,
    COUNT(*) as product_count,
    AVG(hvp.price) as avg_price
FROM high_value_products hvp
JOIN popular_products pp ON hvp.id = pp.product_id
GROUP BY hvp.category;

-- 使用窗口函数计算同类均价；以下SELECT *还会返回category_avg_price，若需保持原输出结构，应显式选择原表列
-- 优化前
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM products p
WHERE p.price > (
    SELECT AVG(price) 
    FROM products p2 
    WHERE p2.category = p.category
);

-- 优化后
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM (
    SELECT *,
           AVG(price) OVER (PARTITION BY category) as category_avg_price
    FROM products
) t
WHERE price > category_avg_price;
```

### 3. 分区表优化

```sql
-- 创建分区表
CREATE TABLE sales_partitioned (
    id SERIAL,
    sale_date DATE NOT NULL,
    product_id INTEGER,
    amount DECIMAL(10,2),
    region VARCHAR(50)
) PARTITION BY RANGE (sale_date);

-- 创建分区
CREATE TABLE sales_2024_q1 PARTITION OF sales_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');

CREATE TABLE sales_2024_q2 PARTITION OF sales_partitioned
    FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');

CREATE TABLE sales_2024_q3 PARTITION OF sales_partitioned
    FOR VALUES FROM ('2024-07-01') TO ('2024-10-01');

CREATE TABLE sales_2024_q4 PARTITION OF sales_partitioned
    FOR VALUES FROM ('2024-10-01') TO ('2025-01-01');

-- 以下仅在2024年第一季度分区上创建索引
CREATE INDEX idx_sales_2024_q1_date ON sales_2024_q1(sale_date);
CREATE INDEX idx_sales_2024_q1_product ON sales_2024_q1(product_id);

-- 插入测试数据
INSERT INTO sales_partitioned (sale_date, product_id, amount, region)
SELECT 
    '2024-01-01'::date + (generate_series % 365),
    (RANDOM() * 1000 + 1)::INTEGER,
    ROUND((RANDOM() * 1000 + 10)::NUMERIC, 2),
    CASE (generate_series % 4)
        WHEN 0 THEN 'North'
        WHEN 1 THEN 'South'
        WHEN 2 THEN 'East'
        ELSE 'West'
    END
FROM generate_series(1, 100000);

-- 测试分区剪裁
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM sales_partitioned 
WHERE sale_date BETWEEN '2024-02-01' AND '2024-02-28';
```

### 4. 配置优化

```sql
-- 查看当前配置
SHOW shared_buffers;
SHOW work_mem;
SHOW maintenance_work_mem;
SHOW effective_cache_size;
SHOW random_page_cost;

-- 查看统计信息更新情况
SELECT 
    schemaname,
    tablename,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze,
    vacuum_count,
    autovacuum_count,
    analyze_count,
    autoanalyze_count
FROM pg_stat_user_tables
WHERE tablename IN ('products', 'orders');

-- 手动更新统计信息
ANALYZE products;
ANALYZE orders;

-- 查看表的膨胀情况
SELECT 
    schemaname,
    tablename,
    n_dead_tup,
    n_live_tup,
    ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) as dead_tuple_percent
FROM pg_stat_user_tables
WHERE n_dead_tup > 0
ORDER BY dead_tuple_percent DESC;
```

## 🔧 实际优化案例

### 1. 慢查询优化案例

```sql
-- 问题查询：查找热门产品和相关订单
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
    p.name,
    p.category,
    p.price,
    COUNT(o.id) as order_count,
    SUM(o.quantity * p.price) as total_revenue
FROM products p
JOIN orders o ON p.id = o.product_id
WHERE o.order_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY p.id, p.name, p.category, p.price
ORDER BY total_revenue DESC
LIMIT 10;

-- 优化步骤1：创建复合索引
CREATE INDEX idx_orders_date_product ON orders(order_date, product_id);

-- 优化步骤2：创建覆盖索引
CREATE INDEX idx_products_covering_revenue 
ON products(id) 
INCLUDE (name, category, price);

-- 优化步骤3：重新分析
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
    p.name,
    p.category,
    p.price,
    COUNT(o.id) as order_count,
    SUM(o.quantity * p.price) as total_revenue
FROM products p
JOIN orders o ON p.id = o.product_id
WHERE o.order_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY p.id, p.name, p.category, p.price
ORDER BY total_revenue DESC
LIMIT 10;

-- 优化步骤4：使用物化视图（对于复杂的聚合查询）
CREATE MATERIALIZED VIEW mv_product_revenue AS
SELECT 
    p.id,
    p.name,
    p.category,
    p.price,
    COUNT(o.id) as order_count,
    SUM(o.quantity * p.price) as total_revenue,
    MAX(o.order_date) as last_order_date
FROM products p
LEFT JOIN orders o ON p.id = o.product_id
WHERE o.order_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY p.id, p.name, p.category, p.price;

-- 为物化视图创建索引
CREATE INDEX idx_mv_product_revenue_total ON mv_product_revenue(total_revenue DESC);
CREATE INDEX idx_mv_product_revenue_category ON mv_product_revenue(category);

-- 使用物化视图的查询
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM mv_product_revenue
WHERE last_order_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY total_revenue DESC
LIMIT 10;

-- 刷新物化视图
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_product_revenue;
```

### 2. JOIN优化案例

```sql
-- 创建客户表
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100),
    city VARCHAR(50),
    registration_date DATE
);

INSERT INTO customers (name, email, city, registration_date)
SELECT 
    'Customer ' || generate_series,
    'customer' || generate_series || '@example.com',
    CASE (generate_series % 5)
        WHEN 0 THEN 'Beijing'
        WHEN 1 THEN 'Shanghai'
        WHEN 2 THEN 'Guangzhou'
        WHEN 3 THEN 'Shenzhen'
        ELSE 'Hangzhou'
    END,
    '2020-01-01'::date + (generate_series % 1460)
FROM generate_series(1, 10000);

-- 更新orders表添加客户关联
UPDATE orders SET customer_id = (id % 10000) + 1;

-- 问题查询：三表连接
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
    c.name as customer_name,
    c.city,
    p.name as product_name,
    p.category,
    o.quantity,
    o.order_date
FROM customers c
JOIN orders o ON c.id = o.customer_id
JOIN products p ON o.product_id = p.id
WHERE c.city = 'Beijing'
  AND o.order_date >= '2024-01-01'
  AND p.category = 'Electronics';

-- 优化：创建合适的索引
CREATE INDEX idx_customers_city ON customers(city);
CREATE INDEX idx_orders_customer_date ON orders(customer_id, order_date);
CREATE INDEX idx_orders_product_date ON orders(product_id, order_date);

-- 重新测试查询性能
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
    c.name as customer_name,
    c.city,
    p.name as product_name,
    p.category,
    o.quantity,
    o.order_date
FROM customers c
JOIN orders o ON c.id = o.customer_id
JOIN products p ON o.product_id = p.id
WHERE c.city = 'Beijing'
  AND o.order_date >= '2024-01-01'
  AND p.category = 'Electronics';
```

## 📊 性能监控和维护

### 1. 自动化监控

```sql
-- 创建性能监控视图
CREATE VIEW v_table_stats AS
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    n_tup_ins + n_tup_upd + n_tup_del as total_writes,
    CASE 
        WHEN seq_scan + idx_scan = 0 THEN 0
        ELSE COALESCE(ROUND(seq_tup_read * 100.0 / NULLIF(seq_tup_read + idx_tup_fetch, 0), 2), 0)
    END as seq_tuple_read_ratio
FROM pg_stat_user_tables;

-- 查看表统计
-- 此比例为累计元组读取比例，不是扫描次数比例；顺序与索引统计的计数口径也存在差异
SELECT * FROM v_table_stats ORDER BY seq_tuple_read_ratio DESC;

-- 创建索引效率监控
CREATE VIEW v_index_efficiency AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    CASE 
        WHEN idx_scan = 0 THEN 0
        ELSE ROUND(idx_tup_fetch * 1.0 / idx_scan, 2)
    END as avg_tuples_per_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- 查看索引效率
SELECT * FROM v_index_efficiency;
```

### 2. 维护任务

```sql
-- 创建维护函数
CREATE OR REPLACE FUNCTION maintain_table_stats(schema_name TEXT DEFAULT 'public')
RETURNS TABLE(
    table_name TEXT,
    action TEXT,
    result TEXT
) AS $$
DECLARE
    table_record RECORD;
    dead_ratio NUMERIC;
BEGIN
    FOR table_record IN 
        SELECT schemaname, tablename, n_dead_tup, n_live_tup
        FROM pg_stat_user_tables 
        WHERE schemaname = schema_name
    LOOP
        -- 计算死亡元组比例
        IF table_record.n_live_tup + table_record.n_dead_tup > 0 THEN
            dead_ratio := table_record.n_dead_tup * 100.0 / 
                         (table_record.n_live_tup + table_record.n_dead_tup);
        ELSE
            dead_ratio := 0;
        END IF;
        
        -- 根据死亡元组比例决定维护策略
        IF dead_ratio > 20 THEN
            EXECUTE format('VACUUM ANALYZE %I.%I', 
                          table_record.schemaname, table_record.tablename);
            RETURN QUERY SELECT 
                table_record.tablename::TEXT,
                'VACUUM ANALYZE'::TEXT,
                format('Dead ratio: %.2f%%', dead_ratio)::TEXT;
        ELSIF dead_ratio > 10 THEN
            EXECUTE format('ANALYZE %I.%I', 
                          table_record.schemaname, table_record.tablename);
            RETURN QUERY SELECT 
                table_record.tablename::TEXT,
                'ANALYZE'::TEXT,
                format('Dead ratio: %.2f%%', dead_ratio)::TEXT;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 执行维护
SELECT * FROM maintain_table_stats();
```

## 🎯 性能优化最佳实践

### 1. 索引设计原则

```sql
-- 1. 观察列的数据分布；选择性不能单独决定复合索引列顺序
SELECT 
    column_name,
    n_distinct,
    correlation
FROM pg_stats 
WHERE tablename = 'products' 
  AND schemaname = 'public'
ORDER BY n_distinct DESC;

-- 2. 复合索引的列顺序很重要
-- 复合索引候选：列顺序应结合等值条件、范围条件、排序需求及实际执行计划确定
CREATE INDEX idx_products_good ON products(category, price, name);

-- 另一复合索引候选：低选择性列在前不必然无效，需结合查询条件和执行计划判断
-- CREATE INDEX idx_products_bad ON products(is_active, category, price);

-- 3. 避免过多的索引
SELECT 
    tablename,
    COUNT(*) as index_count,
    pg_size_pretty(SUM(pg_relation_size(indexrelid))) as total_index_size
FROM pg_stat_user_indexes
GROUP BY tablename
ORDER BY index_count DESC;
```

### 2. 查询优化技巧

```sql
-- 1. 使用LIMIT避免大结果集
-- 不好的查询
-- SELECT * FROM products ORDER BY price DESC;

-- 好的查询
SELECT * FROM products ORDER BY price DESC LIMIT 10;

-- 2. 避免SELECT *
-- 不好的查询
-- SELECT * FROM products WHERE category = 'Electronics';

-- 好的查询
SELECT id, name, price FROM products WHERE category = 'Electronics';

-- 3. 合理使用EXISTS vs IN
-- EXISTS与IN应先比较结果语义，再结合数据分布和执行计划评估性能，不能仅凭表大小判断
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM products p
WHERE EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.product_id = p.id 
      AND o.order_date >= '2024-01-01'
);

-- 4. 使用适当的JOIN类型
-- 内连接 vs 外连接的性能差异
EXPLAIN (ANALYZE, BUFFERS)
SELECT p.name, COUNT(o.id)
FROM products p
INNER JOIN orders o ON p.id = o.product_id
GROUP BY p.id, p.name;

EXPLAIN (ANALYZE, BUFFERS)
SELECT p.name, COUNT(o.id)
FROM products p
LEFT JOIN orders o ON p.id = o.product_id
GROUP BY p.id, p.name;
```

## 🎯 小结

通过本章节的学习，我们掌握了：

1. **索引类型**：B-tree、Hash、GIN、GiST、SP-GiST、BRIN的特点和用途
2. **查询计划分析**：使用EXPLAIN分析和优化查询性能
3. **索引优化**：创建、维护和监控索引的策略
4. **查询优化**：各种查询优化技巧和最佳实践
5. **性能监控**：监控数据库性能和自动化维护

> [!abstract] 📚 下一步学习
> 现在你已经掌握了PostgreSQL的索引和性能优化技巧，接下来我们将学习07-PostgreSQL事务与并发控制|PostgreSQL事务与并发控制，了解如何在并发环境中保证数据一致性。

## 🔗 相关资源

- [[【技术与工具】/PostgreSQL/05-PostgreSQL高级查询与函数|PostgreSQL高级查询与函数]]
- [[【技术与工具】/PostgreSQL/00-PostgreSQL学习路线图|PostgreSQL]]
- SQL - 通用索引概念

---

> 💡 **记住**：性能优化是一个**持续的过程**，不是一次性的任务。**总是基于实际的性能数据进行优化**，避免过早优化。索引不是越多越好，**每个索引都有维护成本**。定期监控和维护数据库，**保持统计信息的准确性**对查询优化器很重要！