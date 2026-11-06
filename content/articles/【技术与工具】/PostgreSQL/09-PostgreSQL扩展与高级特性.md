---
title: PostgreSQL扩展与高级特性
tags:
  - PostgreSQL
  - 扩展
  - PostGIS
  - 全文搜索
  - JSON
  - 外部数据
  - 分区
  - 继承
difficulty: 高级
duration: 50分钟
description: 探索PostgreSQL的强大扩展能力和高级特性，包括PostGIS、全文搜索、JSON处理、外部数据包装器等现代化功能。
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据分析师
  - 数据科学家
stability: slow-changing
status: maintenance
access_tier: free
updated: 2026-10-10
---


# 🚀 PostgreSQL扩展与高级特性

## 📚 学习目标

通过本章节的学习，你将能够：
- **了解PostgreSQL的扩展机制**和生态系统
- **掌握全文搜索功能**的配置和使用
- **熟练使用JSON/JSONB**进行文档数据库操作
- **学会使用PostGIS**进行地理空间数据处理
- **理解外部数据包装器**和数据联邦
- **掌握表分区**和表继承等高级特性

> [!tip] 💡 学习建议
> PostgreSQL的扩展能力是其最大的优势之一，**不要试图一次学会所有扩展**。根据实际需求选择合适的特性来深入学习。就像学习一个工具箱一样，**先了解有哪些工具，再学会在合适的场景下使用它们**。每个扩展都是一个专门的领域，值得深入探索。

## 🔧 PostgreSQL扩展机制

### 1. 扩展系统概述

```sql
-- 查看已安装的扩展
SELECT 
    extname as extension_name,
    extversion as version,
    nspname as schema,
    extrelocatable as relocatable
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
ORDER BY extname;

-- 查看可用的扩展
SELECT name, comment FROM pg_available_extensions 
ORDER BY name;

-- 查看扩展的详细信息
SELECT 
    name,
    default_version,
    installed_version,
    comment
FROM pg_available_extensions 
WHERE name LIKE '%contrib%' OR name LIKE '%json%'
ORDER BY name;

-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "hstore";

-- 查看扩展提供的对象
SELECT 
    pg_describe_object(classid, objid, objsubid) as object
FROM pg_depend 
WHERE refclassid = 'pg_extension'::regclass 
  AND refobjid = (SELECT oid FROM pg_extension WHERE extname = 'uuid-ossp');
```

### 2. 常用扩展介绍

```sql
-- uuid-ossp: UUID生成
SELECT uuid_generate_v4() as random_uuid;
SELECT uuid_generate_v1() as time_based_uuid;

-- pgcrypto: 加密函数
SELECT 
    crypt('password123', gen_salt('bf')) as bcrypt_hash,
    digest('sensitive_data', 'sha256') as sha256_hash,
    encode(digest('data', 'md5'), 'hex') as md5_hex;

-- hstore: 键值对存储
CREATE TABLE user_attributes (
    user_id INTEGER,
    attributes HSTORE
);

INSERT INTO user_attributes VALUES 
(1, 'name=>John, age=>30, city=>Beijing'),
(2, 'name=>Alice, age=>25, occupation=>Engineer');

SELECT 
    user_id,
    attributes->'name' as name,
    attributes->'age' as age,
    attributes ? 'occupation' as has_occupation
FROM user_attributes;

-- ltree: 层次数据
CREATE EXTENSION IF NOT EXISTS ltree;

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    path LTREE,
    name TEXT
);

INSERT INTO categories (path, name) VALUES
('electronics', 'Electronics'),
('electronics.computers', 'Computers'),
('electronics.computers.laptops', 'Laptops'),
('electronics.phones', 'Phones'),
('electronics.phones.smartphones', 'Smartphones');

-- 查询子分类
SELECT * FROM categories WHERE path <@ 'electronics.computers';

-- 查询所有祖先
SELECT * FROM categories WHERE 'electronics.computers.laptops' ~ (path::text || '.*')::lquery;
```

## 🔍 全文搜索

### 1. 全文搜索基础

```sql
-- 创建全文搜索示例表
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    title TEXT,
    content TEXT,
    author TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    search_vector TSVECTOR
);

-- 插入测试数据
INSERT INTO documents (title, content, author) VALUES
('PostgreSQL Guide', 'PostgreSQL is a powerful open-source database system. It supports advanced data types and performance optimization.', 'Database Expert'),
('Full Text Search', 'Full text search allows you to search for documents based on the content. PostgreSQL provides excellent full text search capabilities.', 'Search Specialist'),
('JSON in PostgreSQL', 'PostgreSQL has native JSON support. You can store, query and index JSON data efficiently.', 'JSON Developer'),
('Database Performance', 'Optimizing database performance requires understanding of indexes, queries and system configuration.', 'Performance Tuner');

-- 更新搜索向量
UPDATE documents SET search_vector = 
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || coalesce(author, ''));

-- 创建GIN索引
CREATE INDEX idx_documents_search ON documents USING GIN(search_vector);

-- 基本全文搜索
SELECT 
    id,
    title,
    ts_rank(search_vector, to_tsquery('english', 'PostgreSQL')) as rank
FROM documents
WHERE search_vector @@ to_tsquery('english', 'PostgreSQL')
ORDER BY rank DESC;

-- 高级搜索查询
SELECT 
    id,
    title,
    ts_rank_cd(search_vector, query) as rank,
    ts_headline('english', content, query) as highlighted_content
FROM documents, to_tsquery('english', 'database & (performance | optimization)') query
WHERE search_vector @@ query
ORDER BY rank DESC;
```

### 2. 中文全文搜索

```sql
-- 安装中文分词扩展（需要系统支持）
-- CREATE EXTENSION IF NOT EXISTS zhparser;

-- 创建中文文档表
CREATE TABLE chinese_documents (
    id SERIAL PRIMARY KEY,
    title TEXT,
    content TEXT,
    search_vector TSVECTOR
);

INSERT INTO chinese_documents (title, content) VALUES
('数据库学习指南', 'PostgreSQL是一个功能强大的开源数据库系统，支持高级数据类型和性能优化。'),
('全文搜索教程', '全文搜索允许您根据内容搜索文档。PostgreSQL提供出色的全文搜索功能。'),
('JSON数据处理', 'PostgreSQL原生支持JSON数据类型，可以高效地存储、查询和索引JSON数据。');

-- 使用simple配置演示文本向量生成；该配置不提供中文词语切分，不能保证后续“数据库”查询匹配连续中文正文
UPDATE chinese_documents SET search_vector = 
    to_tsvector('simple', title || ' ' || content);

-- 中文搜索示例
SELECT 
    id,
    title,
    ts_rank(search_vector, to_tsquery('simple', '数据库')) as rank
FROM chinese_documents
WHERE search_vector @@ to_tsquery('simple', '数据库')
ORDER BY rank DESC;
```

### 3. 搜索配置和优化

```sql
-- 自定义搜索配置
CREATE TEXT SEARCH CONFIGURATION my_config (COPY = english);

-- 查看文本搜索配置
SELECT cfgname, cfgowner FROM pg_ts_config;

-- 分析文本
SELECT * FROM ts_debug('english', 'PostgreSQL database performance optimization');

-- 创建自动更新搜索向量的触发器
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        to_tsvector('english', 
            coalesce(NEW.title, '') || ' ' || 
            coalesce(NEW.content, '') || ' ' || 
            coalesce(NEW.author, '')
        );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_search_update
    BEFORE INSERT OR UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_search_vector();

-- 测试触发器
INSERT INTO documents (title, content, author) VALUES
('Advanced PostgreSQL', 'Learn advanced PostgreSQL features including extensions and optimization techniques.', 'Expert User');

SELECT title, search_vector FROM documents WHERE id = (SELECT MAX(id) FROM documents);
```

## 📄 JSON/JSONB高级应用

### 1. JSON vs JSONB

```sql
-- 创建JSON测试表
CREATE TABLE json_comparison (
    id SERIAL PRIMARY KEY,
    data_json JSON,
    data_jsonb JSONB
);

-- 插入测试数据
INSERT INTO json_comparison (data_json, data_jsonb) VALUES 
('{"name": "John", "age": 30, "skills": ["PostgreSQL", "Python"]}',
 '{"name": "John", "age": 30, "skills": ["PostgreSQL", "Python"]}'),
('{"city": "Beijing", "population": 21540000, "coordinates": {"lat": 39.9042, "lng": 116.4074}}',
 '{"city": "Beijing", "population": 21540000, "coordinates": {"lat": 39.9042, "lng": 116.4074}}');

-- 比较存储大小
SELECT 
    pg_column_size(data_json) as json_size,
    pg_column_size(data_jsonb) as jsonb_size,
    data_json,
    data_jsonb
FROM json_comparison;

-- JSONB的优势：支持索引
CREATE INDEX idx_jsonb_data ON json_comparison USING GIN(data_jsonb);

-- JSON路径查询
SELECT 
    id,
    data_jsonb->>'name' as name,
    data_jsonb->'skills'->0 as first_skill,
    data_jsonb#>'{coordinates,lat}' as latitude
FROM json_comparison;
```

### 2. 复杂JSON操作

```sql
-- 创建产品目录表
CREATE TABLE product_catalog (
    id SERIAL PRIMARY KEY,
    product_info JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入复杂产品数据
INSERT INTO product_catalog (product_info) VALUES 
('{"name": "Laptop Pro", "category": "Electronics", "price": 1299.99, "specs": {"cpu": "Intel i7", "ram": "16GB", "storage": "512GB SSD"}, "tags": ["professional", "portable"], "reviews": [{"rating": 5, "comment": "Excellent"}, {"rating": 4, "comment": "Good value"}]}'),
('{"name": "Smartphone X", "category": "Electronics", "price": 899.99, "specs": {"cpu": "A15 Bionic", "ram": "6GB", "storage": "128GB"}, "tags": ["mobile", "camera"], "reviews": [{"rating": 5, "comment": "Amazing camera"}, {"rating": 5, "comment": "Fast performance"}]}'),
('{"name": "Office Chair", "category": "Furniture", "price": 299.99, "specs": {"material": "Leather", "adjustable": true, "warranty": "5 years"}, "tags": ["ergonomic", "comfortable"], "reviews": [{"rating": 4, "comment": "Very comfortable"}]}');

-- 复杂查询示例
-- 1. 查找特定价格范围的产品
SELECT 
    product_info->>'name' as product_name,
    (product_info->>'price')::NUMERIC as price
FROM product_catalog
WHERE (product_info->>'price')::NUMERIC BETWEEN 500 AND 1000;

-- 2. 查找具有特定规格的产品
SELECT 
    product_info->>'name' as product_name,
    product_info->'specs' as specifications
FROM product_catalog
WHERE product_info->'specs' ? 'cpu';

-- 3. 查找包含特定标签的产品
SELECT 
    product_info->>'name' as product_name,
    product_info->'tags' as tags
FROM product_catalog
WHERE product_info->'tags' ? 'professional';

-- 4. 计算平均评分
SELECT 
    product_info->>'name' as product_name,
    ROUND(AVG((review->>'rating')::NUMERIC), 2) as avg_rating
FROM product_catalog,
     jsonb_array_elements(product_info->'reviews') as review
GROUP BY product_info->>'name';

-- 5. 更新JSON数据
UPDATE product_catalog 
SET product_info = jsonb_set(
    product_info, 
    '{specs,warranty}', 
    '"2 years"'
) 
WHERE product_info->>'category' = 'Electronics';

-- 6. 添加新的JSON字段
UPDATE product_catalog 
SET product_info = product_info || '{"featured": true}'
WHERE (product_info->>'price')::NUMERIC > 1000;
```

### 3. JSON索引和性能优化

```sql
-- 创建不同类型的JSON索引
-- GIN索引：支持包含查询
CREATE INDEX idx_product_gin ON product_catalog USING GIN(product_info);

-- 表达式索引：针对特定字段
CREATE INDEX idx_product_category ON product_catalog((product_info->>'category'));
CREATE INDEX idx_product_price ON product_catalog(((product_info->>'price')::NUMERIC));

-- 部分索引：仅索引特定条件的数据
CREATE INDEX idx_product_electronics ON product_catalog 
USING GIN(product_info) 
WHERE product_info->>'category' = 'Electronics';

-- 性能测试
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM product_catalog 
WHERE product_info @> '{"category": "Electronics"}';

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM product_catalog 
WHERE product_info->>'category' = 'Electronics';
```

## 🌍 PostGIS地理空间扩展

### 1. PostGIS安装和基础

```sql
-- 安装PostGIS扩展
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- 查看PostGIS版本
SELECT PostGIS_Version();

-- 创建地理位置表
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    type VARCHAR(50),
    coordinates GEOMETRY(POINT, 4326),  -- 使用WGS84坐标系
    area GEOMETRY(POLYGON, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入地理数据
INSERT INTO locations (name, type, coordinates) VALUES
('北京天安门', '景点', ST_GeomFromText('POINT(116.3974 39.9093)', 4326)),
('上海外滩', '景点', ST_GeomFromText('POINT(121.4944 31.2304)', 4326)),
('广州塔', '建筑', ST_GeomFromText('POINT(113.3191 23.1090)', 4326)),
('深圳湾公园', '公园', ST_GeomFromText('POINT(113.9492 22.4818)', 4326));

-- 插入区域数据
INSERT INTO locations (name, type, area) VALUES
('北京市', '行政区', ST_GeomFromText('POLYGON((115.5 39.5, 117.5 39.5, 117.5 41.0, 115.5 41.0, 115.5 39.5))', 4326));

-- 创建空间索引
CREATE INDEX idx_locations_coordinates ON locations USING GIST(coordinates);
CREATE INDEX idx_locations_area ON locations USING GIST(area);
```

### 2. 空间查询和分析

```sql
-- 距离计算
SELECT 
    l1.name as location1,
    l2.name as location2,
    ROUND(ST_Distance(l1.coordinates, l2.coordinates)::NUMERIC, 2) as distance_degrees,
    ROUND(ST_DistanceSphere(l1.coordinates, l2.coordinates)::NUMERIC, 2) as distance_meters
FROM locations l1, locations l2
WHERE l1.id < l2.id 
  AND l1.coordinates IS NOT NULL 
  AND l2.coordinates IS NOT NULL;

-- 查找某点周围的地点
SELECT 
    name,
    type,
    ROUND(ST_DistanceSphere(coordinates, ST_GeomFromText('POINT(116.3974 39.9093)', 4326))::NUMERIC, 2) as distance_from_tiananmen
FROM locations
WHERE coordinates IS NOT NULL
  AND ST_DWithin(coordinates, ST_GeomFromText('POINT(116.3974 39.9093)', 4326), 5)  -- 5度范围内
ORDER BY distance_from_tiananmen;

-- 缓冲区分析
SELECT 
    name,
    ST_Area(ST_Buffer(coordinates::geography, 1000)) as buffer_area_1km_square_meters
FROM locations
WHERE coordinates IS NOT NULL;

-- 点在多边形内的查询
SELECT 
    p.name as point_name,
    a.name as area_name
FROM locations p, locations a
WHERE p.coordinates IS NOT NULL 
  AND a.area IS NOT NULL
  AND ST_Within(p.coordinates, a.area);
```

### 3. 高级地理空间分析

```sql
-- 创建道路网络表
CREATE TABLE roads (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    road_type VARCHAR(50),
    geometry GEOMETRY(LINESTRING, 4326),
    length_meters NUMERIC
);

-- 插入道路数据
INSERT INTO roads (name, road_type, geometry) VALUES
('长安街', '主干道', ST_GeomFromText('LINESTRING(116.3500 39.9085, 116.4500 39.9085)', 4326)),
('王府井大街', '商业街', ST_GeomFromText('LINESTRING(116.4100 39.9150, 116.4100 39.9050)', 4326));

-- 更新道路长度
UPDATE roads SET length_meters = ST_Length(geometry::geography);

-- 最近点查询
SELECT 
    l.name as location,
    r.name as nearest_road,
    ROUND(ST_Distance(l.coordinates, r.geometry)::NUMERIC, 6) as distance_degrees
FROM locations l
CROSS JOIN LATERAL (
    SELECT name, geometry
    FROM roads
    ORDER BY l.coordinates <-> geometry
    LIMIT 1
) r
WHERE l.coordinates IS NOT NULL;

-- 空间聚类分析
WITH clustered_locations AS (
    SELECT 
        name,
        coordinates,
        ST_ClusterDBSCAN(coordinates, 0.1, 2) OVER () as cluster_id
    FROM locations
    WHERE coordinates IS NOT NULL
)
SELECT 
    cluster_id,
    COUNT(*) as point_count,
    ST_AsText(ST_Centroid(ST_Collect(coordinates))) as cluster_center
FROM clustered_locations
WHERE cluster_id IS NOT NULL
GROUP BY cluster_id;
```

## 🔗 外部数据包装器(FDW)

### 1. file_fdw文件数据包装器

```sql
-- 安装file_fdw扩展
CREATE EXTENSION IF NOT EXISTS file_fdw;

-- 创建外部服务器
CREATE SERVER file_server FOREIGN DATA WRAPPER file_fdw;

-- 创建外部表映射CSV文件
CREATE FOREIGN TABLE external_sales (
    date DATE,
    product_id INTEGER,
    sales_amount NUMERIC(10,2),
    region VARCHAR(50)
) SERVER file_server
OPTIONS (filename '/tmp/sales_data.csv', format 'csv', header 'true');

-- 假设CSV文件内容：
-- date,product_id,sales_amount,region
-- 2024-01-01,1,1000.00,North
-- 2024-01-02,2,1500.00,South

-- 查询外部数据
SELECT 
    region,
    SUM(sales_amount) as total_sales,
    COUNT(*) as transaction_count
FROM external_sales
GROUP BY region;
```

### 2. postgres_fdw数据库间连接

```sql
-- 安装postgres_fdw扩展
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

-- 创建外部服务器连接
CREATE SERVER remote_server 
FOREIGN DATA WRAPPER postgres_fdw
OPTIONS (host 'remote-host', port '5432', dbname 'remote_db');

-- 创建用户映射
CREATE USER MAPPING FOR current_user
SERVER remote_server
OPTIONS (user 'remote_user', password 'remote_password');

-- 创建外部表
CREATE FOREIGN TABLE remote_customers (
    id INTEGER,
    name VARCHAR(100),
    email VARCHAR(100),
    created_at TIMESTAMP
) SERVER remote_server
OPTIONS (schema_name 'public', table_name 'customers');

-- 跨数据库查询
SELECT 
    rc.name as customer_name,
    COUNT(o.id) as order_count
FROM remote_customers rc
LEFT JOIN orders o ON rc.id = o.customer_id
GROUP BY rc.id, rc.name;
```

## 📊 表分区

### 1. 范围分区

```sql
-- 创建分区主表
CREATE TABLE sales_data (
    id SERIAL,
    sale_date DATE NOT NULL,
    product_id INTEGER,
    customer_id INTEGER,
    amount NUMERIC(10,2),
    region VARCHAR(50)
) PARTITION BY RANGE (sale_date);

-- 创建分区表
CREATE TABLE sales_2024_q1 PARTITION OF sales_data
    FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');

CREATE TABLE sales_2024_q2 PARTITION OF sales_data
    FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');

CREATE TABLE sales_2024_q3 PARTITION OF sales_data
    FOR VALUES FROM ('2024-07-01') TO ('2024-10-01');

CREATE TABLE sales_2024_q4 PARTITION OF sales_data
    FOR VALUES FROM ('2024-10-01') TO ('2025-01-01');

-- 在分区上创建索引
CREATE INDEX idx_sales_2024_q1_product ON sales_2024_q1(product_id);
CREATE INDEX idx_sales_2024_q1_customer ON sales_2024_q1(customer_id);

-- 插入数据（自动路由到正确分区）
INSERT INTO sales_data (sale_date, product_id, customer_id, amount, region) VALUES
('2024-02-15', 1, 100, 1500.00, 'North'),
('2024-05-20', 2, 101, 2000.00, 'South'),
('2024-08-10', 3, 102, 1200.00, 'East'),
('2024-11-05', 1, 103, 1800.00, 'West');

-- 查看分区消除效果
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM sales_data 
WHERE sale_date BETWEEN '2024-02-01' AND '2024-02-28';
```

### 2. 哈希分区

```sql
-- 创建哈希分区表
CREATE TABLE user_data (
    id SERIAL,
    user_id INTEGER NOT NULL,
    username VARCHAR(50),
    email VARCHAR(100),
    data JSONB
) PARTITION BY HASH (user_id);

-- 创建哈希分区
CREATE TABLE user_data_0 PARTITION OF user_data
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);

CREATE TABLE user_data_1 PARTITION OF user_data
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);

CREATE TABLE user_data_2 PARTITION OF user_data
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);

CREATE TABLE user_data_3 PARTITION OF user_data
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- 插入测试数据
INSERT INTO user_data (user_id, username, email) 
SELECT 
    generate_series,
    'user' || generate_series,
    'user' || generate_series || '@example.com'
FROM generate_series(1, 1000);

-- 查看数据分布
SELECT 
    schemaname,
    tablename,
    n_live_tup
FROM pg_stat_user_tables 
WHERE tablename LIKE 'user_data_%'
ORDER BY tablename;
```

### 3. 列表分区

```sql
-- 创建列表分区表
CREATE TABLE regional_sales (
    id SERIAL,
    region VARCHAR(50) NOT NULL,
    product_id INTEGER,
    sales_amount NUMERIC(10,2),
    sale_date DATE
) PARTITION BY LIST (region);

-- 创建区域分区
CREATE TABLE sales_north PARTITION OF regional_sales
    FOR VALUES IN ('North', 'Northeast', 'Northwest');

CREATE TABLE sales_south PARTITION OF regional_sales
    FOR VALUES IN ('South', 'Southeast', 'Southwest');

CREATE TABLE sales_east PARTITION OF regional_sales
    FOR VALUES IN ('East', 'Eastern');

CREATE TABLE sales_west PARTITION OF regional_sales
    FOR VALUES IN ('West', 'Western');

-- 默认分区（捕获其他值）
CREATE TABLE sales_other PARTITION OF regional_sales DEFAULT;

-- 测试数据插入
INSERT INTO regional_sales (region, product_id, sales_amount, sale_date) VALUES
('North', 1, 1000, '2024-01-01'),
('Unknown', 2, 500, '2024-01-02');  -- 进入默认分区

-- 查看regional_sales的直接子分区边界
SELECT
    n.nspname as schemaname,
    c.relname as tablename,
    pg_get_expr(c.relpartbound, c.oid) as partition_bound
FROM pg_inherits i
JOIN pg_class c ON c.oid = i.inhrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE i.inhparent = 'regional_sales'::regclass
ORDER BY c.relname;
```

## 🏗️ 表继承

### 1. 基本表继承

```sql
-- 创建基础表
CREATE TABLE vehicle (
    id SERIAL PRIMARY KEY,
    brand VARCHAR(50),
    model VARCHAR(50),
    year INTEGER,
    price NUMERIC(10,2)
);

-- 创建继承表
CREATE TABLE car (
    doors INTEGER,
    fuel_type VARCHAR(20)
) INHERITS (vehicle);

CREATE TABLE motorcycle (
    engine_size INTEGER,
    has_sidecar BOOLEAN DEFAULT FALSE
) INHERITS (vehicle);

-- 插入数据
INSERT INTO car (brand, model, year, price, doors, fuel_type) VALUES
('Toyota', 'Camry', 2024, 25000, 4, 'Gasoline'),
('Tesla', 'Model 3', 2024, 35000, 4, 'Electric');

INSERT INTO motorcycle (brand, model, year, price, engine_size) VALUES
('Harley Davidson', 'Street 750', 2024, 8000, 750),
('Honda', 'CBR600RR', 2024, 12000, 600);

-- 查询所有车辆
SELECT * FROM vehicle;

-- 查询仅基础表
SELECT * FROM ONLY vehicle;

-- 查询特定类型
SELECT brand, model, doors, fuel_type FROM car;
```

### 2. 继承和约束

```sql
-- 为继承表添加约束
ALTER TABLE car ADD CONSTRAINT check_doors CHECK (doors > 0 AND doors <= 5);
ALTER TABLE motorcycle ADD CONSTRAINT check_engine CHECK (engine_size > 0);

-- 创建带约束的继承表
CREATE TABLE truck (
    payload_capacity INTEGER CHECK (payload_capacity > 1000),
    axles INTEGER CHECK (axles >= 2)
) INHERITS (vehicle);

-- 插入验证约束
INSERT INTO truck (brand, model, year, price, payload_capacity, axles) VALUES
('Ford', 'F-150', 2024, 40000, 2000, 2);

-- 尝试插入无效数据（将失败）
-- INSERT INTO car (brand, model, doors) VALUES ('Invalid', 'Car', 0);
```

## 🔧 高级特性配置

### 1. 并行查询

```sql
-- 查看并行查询设置
SHOW max_parallel_workers_per_gather;
SHOW max_parallel_workers;
SHOW parallel_tuple_cost;

-- 创建大表测试并行查询
CREATE TABLE large_table AS
SELECT 
    generate_series as id,
    random() * 1000000 as value,
    md5(generate_series::text) as hash_value
FROM generate_series(1, 1000000);

-- 分析表
ANALYZE large_table;

-- 测试并行查询
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) FROM large_table WHERE value > 500000;

-- 降低并行计划的成本估计；是否采用并行计划及启动工作进程仍取决于查询、配置和可用资源
SET parallel_tuple_cost = 0;
SET parallel_setup_cost = 0;

EXPLAIN (ANALYZE, BUFFERS)
SELECT 
    hash_value,
    COUNT(*),
    AVG(value)
FROM large_table 
GROUP BY hash_value
HAVING COUNT(*) > 1;
```

### 2. JIT编译

```sql
-- 查看JIT设置
SHOW jit;
SHOW jit_above_cost;

-- 启用JIT
SET jit = on;
SET jit_above_cost = 0;

-- 测试JIT效果
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
    id % 1000 as bucket,
    COUNT(*),
    SUM(value),
    AVG(value),
    MIN(value),
    MAX(value)
FROM large_table 
GROUP BY id % 1000
ORDER BY bucket;
```

## 🎯 扩展开发

### 1. 自定义聚合函数

```sql
-- 创建自定义聚合函数：几何平均数
CREATE OR REPLACE FUNCTION geometric_mean_state(state NUMERIC[], value NUMERIC)
RETURNS NUMERIC[] AS $$
BEGIN
    IF value <= 0 THEN
        RAISE EXCEPTION 'Geometric mean requires positive values';
    END IF;
    
    RETURN ARRAY[
        COALESCE(state[1], 0) + LN(value),  -- 对数和
        COALESCE(state[2], 0) + 1           -- 计数
    ];
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION geometric_mean_final(state NUMERIC[])
RETURNS NUMERIC AS $$
BEGIN
    IF state[2] = 0 THEN
        RETURN NULL;
    END IF;
    
    RETURN EXP(state[1] / state[2]);
END;
$$ LANGUAGE plpgsql;

-- 创建聚合函数
CREATE AGGREGATE geometric_mean(NUMERIC) (
    SFUNC = geometric_mean_state,
    STYPE = NUMERIC[],
    FINALFUNC = geometric_mean_final,
    INITCOND = '{}'
);

-- 测试自定义聚合函数
SELECT 
    region,
    AVG(sales_amount) as arithmetic_mean,
    geometric_mean(sales_amount) as geometric_mean
FROM regional_sales
WHERE sales_amount > 0
GROUP BY region;
```

### 2. 自定义数据类型

```sql
-- 创建复数类型
CREATE TYPE complex AS (
    real FLOAT8,
    imaginary FLOAT8
);

-- 创建复数运算函数
CREATE OR REPLACE FUNCTION complex_add(a complex, b complex)
RETURNS complex AS $$
BEGIN
    RETURN ROW(a.real + b.real, a.imaginary + b.imaginary)::complex;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION complex_multiply(a complex, b complex)
RETURNS complex AS $$
BEGIN
    RETURN ROW(
        a.real * b.real - a.imaginary * b.imaginary,
        a.real * b.imaginary + a.imaginary * b.real
    )::complex;
END;
$$ LANGUAGE plpgsql;

-- 创建操作符
CREATE OPERATOR + (
    LEFTARG = complex,
    RIGHTARG = complex,
    FUNCTION = complex_add
);

CREATE OPERATOR * (
    LEFTARG = complex,
    RIGHTARG = complex,
    FUNCTION = complex_multiply
);

-- 测试自定义类型
SELECT 
    ROW(3, 4)::complex as c1,
    ROW(1, 2)::complex as c2,
    ROW(3, 4)::complex + ROW(1, 2)::complex as sum,
    ROW(3, 4)::complex * ROW(1, 2)::complex as product;
```

## 🎯 小结

通过本章节的学习，我们探索了：

1. **扩展机制**：PostgreSQL强大的扩展能力和生态系统
2. **全文搜索**：企业级搜索功能的配置和使用
3. **JSON处理**：现代化的文档数据库功能
4. **PostGIS**：专业的地理空间数据处理能力
5. **FDW外部数据**：数据联邦和跨系统集成
6. **分区和继承**：大数据处理和面向对象特性
7. **高级特性**：并行查询、JIT编译等现代化功能

> [!abstract] 📚 下一步学习
> 现在你已经了解了PostgreSQL的强大扩展能力，最后让我们通过[[【技术与工具】/PostgreSQL/10-PostgreSQL实践案例|PostgreSQL实践案例]]来综合运用这些知识，解决实际的业务问题。

## 🔗 相关资源

- [[【技术与工具】/PostgreSQL/08-PostgreSQL备份与恢复|PostgreSQL备份与恢复]] - 数据安全保障
- [[【技术与工具】/PostgreSQL/00-PostgreSQL学习路线图|PostgreSQL]] - 返回学习路线图
- Python - 数据分析应用

---

> 💡 **记住**：PostgreSQL的扩展能力是其最大的优势，**不要试图掌握所有扩展**，而是要根据业务需求选择合适的工具。每个扩展都是一个专业领域，**深入学习比广泛了解更有价值**。在生产环境中使用扩展时，**要考虑维护成本和团队技能**。最重要的是，**先解决问题，再优化方案**！