---
title: PostgreSQL基本SQL操作
tags:
  - PostgreSQL
  - SQL
  - DDL
  - DML
  - DQL
  - 数据操作
  - 数据库管理
difficulty: 中级
duration: 50分钟
description: 全面掌握PostgreSQL的SQL操作技能，从数据定义到复杂查询，构建扎实的数据操作基础。
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据分析师
  - 数据架构师
  - BI分析师
stability: slow-changing
status: maintenance
access_tier: free
updated: 2026-10-10
---


# 🔧 PostgreSQL基本SQL操作

SQL是数据世界的通用语言，而PostgreSQL以其强大的SQL标准支持和丰富的扩展功能，为数据工程师提供了无与伦比的数据操作能力。掌握PostgreSQL SQL操作，就是掌握了现代数据处理的核心技能。

## 🎯 学习目标

通过本章节的深入学习，你将能够：

- **精通数据定义语言(DDL)**：构建和管理数据库架构
- **熟练运用数据操作语言(DML)**：高效处理数据的增删改操作  
- **掌握数据查询语言(DQL)**：从简单查询到复杂分析的全方位查询技能
- **运用现代SQL特性**：CTE、窗口函数、JSON操作等高级功能
- **理解性能优化原理**：编写高效、可维护的SQL代码

## 📊 SQL操作的数据视角

在数据工程中，SQL操作不仅仅是语法的应用，更是数据思维的体现。每一个DDL操作都在构建数据架构，每一个DML操作都在改变数据状态，每一个DQL操作都在挖掘数据价值。

> [!tip] 🚀 实践学习方法
> 
> SQL技能的掌握需要"理论+实践"双轮驱动：
> 1. **理解业务场景**：每个SQL操作都应对应实际的业务需求
> 2. **动手实践**：所有示例代码都要亲自运行和修改
> 3. **性能意识**：从一开始就培养编写高效SQL的习惯
> 4. **渐进学习**：从简单操作逐步过渡到复杂查询

## 🏗️ DDL操作：构建数据架构基础

数据定义语言(DDL)是数据架构师的工具箱，用于创建和管理数据库结构。在数据工程中，良好的DDL设计是高效数据处理的前提。

### 数据库和模式：分层组织的艺术

```sql
-- 现代数据平台的数据库创建
CREATE DATABASE data_warehouse_prod
    WITH 
    OWNER = data_team
    ENCODING = 'UTF8'
    LC_COLLATE = 'C'                    -- 使用C排序规则；需确认其排序语义符合业务要求
    LC_CTYPE = 'C'                      -- 使用C字符分类规则；需确认字符处理语义符合业务要求
    TABLESPACE = pg_default
    CONNECTION LIMIT = 100              -- 连接限制管理
    TEMPLATE = template0;               -- 避免模板数据库影响

-- 数据分层模式设计：体现数据仓库分层思维
CREATE SCHEMA raw_data;                 -- 原始数据层
CREATE SCHEMA cleaned_data;             -- 清理数据层  
CREATE SCHEMA analytics;                -- 分析数据层
CREATE SCHEMA reporting;                -- 报表数据层

-- 查看当前数据库的模式
SELECT 
    schema_name,
    schema_owner,
    CASE 
        WHEN schema_name LIKE 'raw_%' THEN '原始数据层'
        WHEN schema_name LIKE 'cleaned_%' THEN '清理数据层'
        WHEN schema_name = 'analytics' THEN '分析层'
        WHEN schema_name = 'reporting' THEN '报表层'
        ELSE '其他'
    END as layer_description
FROM information_schema.schemata 
WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
ORDER BY schema_name;

-- 设置模式搜索路径：控制未限定对象名的解析顺序，不保证提升查询性能
SET search_path TO analytics, cleaned_data, raw_data, public;
```

### 企业级表设计：数据驱动的结构设计

```sql
-- 用户行为事实表：现代数据仓库的典型设计
CREATE TABLE analytics.user_behavior_facts (
    -- 主键和分区键
    event_id BIGSERIAL,
    PRIMARY KEY (event_id, event_date),
    event_date DATE NOT NULL,              -- 分区键
    
    -- 维度键（外键）
    user_id BIGINT NOT NULL,
    product_id BIGINT,
    session_id UUID NOT NULL,
    device_id BIGINT,
    
    -- 事件属性
    event_type VARCHAR(50) NOT NULL,        -- 'page_view', 'click', 'purchase'
    event_timestamp TIMESTAMPTZ NOT NULL,
    
    -- 度量值
    duration_seconds INTEGER DEFAULT 0 CHECK (duration_seconds >= 0),
    page_depth SMALLINT DEFAULT 1 CHECK (page_depth > 0),
    revenue_amount NUMERIC(12,4) DEFAULT 0.00 CHECK (revenue_amount >= 0),
    
    -- 灵活属性（PostgreSQL优势）
    event_properties JSONB DEFAULT '{}',
    user_agent_data JSONB DEFAULT '{}',
    
    -- 数据血缘和质量
    data_source VARCHAR(100) NOT NULL,     -- 数据来源标识
    etl_batch_id BIGINT,                   -- ETL批次ID
    data_quality_score NUMERIC(3,2) DEFAULT 1.00 CHECK (data_quality_score BETWEEN 0 AND 1),
    
    -- 审计字段
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    
) PARTITION BY RANGE (event_date);

-- 创建分区表（按月分区，提升查询性能）
CREATE TABLE analytics.user_behavior_facts_2024_01 
PARTITION OF analytics.user_behavior_facts
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE analytics.user_behavior_facts_2024_02 
PARTITION OF analytics.user_behavior_facts
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- 用户维度表：缓慢变化维度(SCD2)设计
CREATE TABLE analytics.user_dimension (
    user_dim_key BIGSERIAL PRIMARY KEY,    -- 代理键
    user_id BIGINT NOT NULL,               -- 业务键
    
    -- 用户属性
    username VARCHAR(100),
    email VARCHAR(254),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    birth_date DATE,
    
    -- 地理信息
    country_code CHAR(2),
    state_province VARCHAR(100),
    city VARCHAR(100),
    postal_code VARCHAR(20),
    
    -- 用户画像（JSON格式，灵活扩展）
    demographics JSONB DEFAULT '{}',
    preferences JSONB DEFAULT '{}',
    behavior_scores JSONB DEFAULT '{}',
    
    -- SCD2维度管理
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiration_date DATE DEFAULT '9999-12-31',
    is_current BOOLEAN DEFAULT TRUE,
    
    -- 数据治理
    data_source VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- 唯一约束：限制同一用户在同一生效日期只有一条记录；不保证当前记录唯一或有效期不重叠
    UNIQUE (user_id, effective_date),
    
    -- 检查约束：确保日期逻辑正确
    CHECK (effective_date <= expiration_date)
);

-- 产品目录表：支持层次结构的设计
CREATE TABLE analytics.product_catalog (
    product_id BIGSERIAL PRIMARY KEY,
    product_sku VARCHAR(100) NOT NULL UNIQUE,
    product_name VARCHAR(500) NOT NULL,
    
    -- 产品层次结构
    category_id INTEGER,
    subcategory_id INTEGER,
    brand_id INTEGER,
    
    -- 产品属性（充分利用PostgreSQL的JSON能力）
    product_attributes JSONB DEFAULT '{}',
    pricing_data JSONB DEFAULT '{}',
    inventory_data JSONB DEFAULT '{}',
    data_source VARCHAR(100) NOT NULL,
    
    -- 文本搜索支持
    search_vector TSVECTOR,
    
    -- 状态管理
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'seasonal')),
    
    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### 高性能索引策略

```sql
-- 事实表的复合索引：支持常见分析查询
CREATE INDEX idx_user_behavior_user_date ON analytics.user_behavior_facts (user_id, event_date);
CREATE INDEX idx_user_behavior_type_timestamp ON analytics.user_behavior_facts (event_type, event_timestamp);
CREATE INDEX idx_user_behavior_session ON analytics.user_behavior_facts (session_id, event_timestamp);

-- JSON字段的专用索引
CREATE INDEX idx_user_behavior_properties_gin ON analytics.user_behavior_facts USING GIN (event_properties);
CREATE INDEX idx_product_attributes_gin ON analytics.product_catalog USING GIN (product_attributes);

-- 部分索引：只索引有价值的数据
CREATE INDEX idx_user_behavior_purchases ON analytics.user_behavior_facts (user_id, event_timestamp) 
WHERE event_type = 'purchase' AND revenue_amount > 0;

-- 表达式索引：支持复杂查询
CREATE INDEX idx_product_search ON analytics.product_catalog USING GIN (search_vector);
CREATE INDEX idx_user_email_domain ON analytics.user_dimension ((split_part(email, '@', 2)));
```

### 4. 修改表结构

```sql
-- 添加列
ALTER TABLE hr.employees 
ADD COLUMN birth_date DATE,
ADD COLUMN emergency_contact JSONB;

-- 修改列
ALTER TABLE hr.employees 
ALTER COLUMN phone TYPE VARCHAR(25),
ALTER COLUMN job_title SET NOT NULL,
ALTER COLUMN salary SET DEFAULT 50000;

-- 删除列
ALTER TABLE hr.employees 
DROP COLUMN IF EXISTS temp_column;

-- 重命名列
ALTER TABLE hr.employees 
RENAME COLUMN employee_number TO emp_number;

-- 重命名表
ALTER TABLE hr.projects RENAME TO company_projects;
ALTER TABLE hr.company_projects RENAME TO projects;

-- 添加约束
ALTER TABLE hr.employees 
ADD CONSTRAINT chk_hire_date 
CHECK (hire_date <= CURRENT_DATE);

ALTER TABLE hr.employees 
ADD CONSTRAINT fk_department 
FOREIGN KEY (department_id) REFERENCES hr.departments(department_id);

-- 删除约束
ALTER TABLE hr.employees 
DROP CONSTRAINT IF EXISTS chk_hire_date;
```

### 5. 索引操作

```sql
-- 创建各种类型的索引
CREATE INDEX idx_employees_email ON hr.employees(email);
CREATE INDEX idx_employees_name ON hr.employees(last_name, first_name);
CREATE INDEX idx_employees_dept ON hr.employees(department_id);
CREATE INDEX idx_employees_hire_date ON hr.employees(hire_date);

-- 部分索引
CREATE INDEX idx_employees_active ON hr.employees(employee_id) 
WHERE status = 'active';

-- 表达式索引
CREATE INDEX idx_employees_lower_email ON hr.employees(LOWER(email));
CREATE INDEX idx_employees_full_name ON hr.employees((first_name || ' ' || last_name));

-- JSON索引
CREATE INDEX idx_employees_address_gin ON hr.employees USING GIN(address);
CREATE INDEX idx_employees_city ON hr.employees((address->>'city'));

-- 查看索引
\di hr.*
-- 或者使用SQL查询
SELECT indexname, indexdef FROM pg_indexes 
WHERE schemaname = 'hr';

-- 删除索引
DROP INDEX IF EXISTS idx_employees_temp;
```

## 📊 DML操作：数据的增删改艺术

数据操作语言(DML)是数据工程师的日常工具，用于管理数据的生命周期。在现代数据处理中，DML操作需要兼顾性能、一致性和数据质量。

### 高效数据插入：批量处理的智慧

```sql
-- 高性能批量插入：事实表数据加载
INSERT INTO analytics.user_behavior_facts (
    event_date, user_id, session_id, event_type, event_timestamp,
    duration_seconds, revenue_amount, event_properties, data_source, etl_batch_id
) VALUES 
    ('2024-01-15', 10001, 'sess_001', 'page_view', '2024-01-15 09:30:00+08', 45, 0.00, 
     '{"page_url": "/products", "referrer": "google"}', 'web_analytics', 20240115001),
    ('2024-01-15', 10001, 'sess_001', 'product_view', '2024-01-15 09:31:30+08', 120, 0.00,
     '{"product_id": "P001", "category": "Electronics"}', 'web_analytics', 20240115001),
    ('2024-01-15', 10001, 'sess_001', 'add_to_cart', '2024-01-15 09:33:45+08', 15, 299.99,
     '{"product_id": "P001", "quantity": 1}', 'web_analytics', 20240115001),
    ('2024-01-15', 10002, '00000000-0000-0000-0000-000000000002', 'page_view', '2024-01-15 10:15:20+08', 30, 0.00,
     '{"page_url": "/home", "device": "mobile"}', 'mobile_app', 20240115001);

-- 基于ETL流程的批量插入：从临时表到事实表
INSERT INTO analytics.user_behavior_facts (
    event_date, user_id, session_id, event_type, event_timestamp,
    duration_seconds, revenue_amount, event_properties, data_source, etl_batch_id
)
SELECT 
    event_timestamp::DATE as event_date,
    user_id,
    session_id,
    event_type,
    event_timestamp,
    COALESCE(duration_seconds, 0) as duration_seconds,
    COALESCE(revenue_amount, 0.00) as revenue_amount,
    COALESCE(raw_properties, '{}') as event_properties,
    'daily_etl' as data_source,
    20240115001 as etl_batch_id
FROM raw_data.user_events_staging 
WHERE processed_date = CURRENT_DATE
  AND data_quality_check = 'PASSED';

-- 同日维度属性UPSERT：覆盖同一生效日期的记录，不保留该日内的变更历史，也不替代完整SCD2版本管理
INSERT INTO analytics.user_dimension (
    user_id, username, email, first_name, last_name, 
    demographics, preferences, data_source
) VALUES (
    10001, 'data_analyst', 'analyst@company.com', '张', '三',
    '{"age_group": "25-34", "location": "beijing"}',
    '{"language": "zh-CN", "theme": "dark"}',
    'user_profile_sync'
)
ON CONFLICT (user_id, effective_date) 
DO UPDATE SET 
    username = EXCLUDED.username,
    email = EXCLUDED.email,
    demographics = EXCLUDED.demographics,
    preferences = EXCLUDED.preferences,
    updated_at = CURRENT_TIMESTAMP
WHERE analytics.user_dimension.username IS DISTINCT FROM EXCLUDED.username
   OR analytics.user_dimension.email IS DISTINCT FROM EXCLUDED.email
   OR analytics.user_dimension.demographics IS DISTINCT FROM EXCLUDED.demographics
   OR analytics.user_dimension.preferences IS DISTINCT FROM EXCLUDED.preferences;

-- 返回插入结果：用于日志和后续处理
INSERT INTO analytics.product_catalog (
    product_sku, product_name, category_id, product_attributes, data_source
) VALUES 
    ('SKU001', 'MacBook Pro 16"', 101, '{"brand": "Apple", "color": "Space Gray", "storage": "512GB"}', 'product_sync'),
    ('SKU002', 'iPhone 15 Pro', 102, '{"brand": "Apple", "color": "Natural Titanium", "storage": "256GB"}', 'product_sync')
RETURNING product_id, product_sku, created_at;
```

### 智能数据更新：精确的数据维护

```sql
-- 基于业务规则的批量更新
UPDATE analytics.user_behavior_facts 
SET data_quality_score = 0.8,
    updated_at = CURRENT_TIMESTAMP
WHERE event_type = 'page_view' 
  AND duration_seconds < 5 
  AND event_date >= CURRENT_DATE - INTERVAL '30 days';

-- JSON字段的精确更新：保持数据结构的完整性
UPDATE analytics.user_dimension 
SET preferences = jsonb_set(
    preferences, 
    '{notifications}', 
    '{"email": true, "push": false, "sms": true}'
),
    updated_at = CURRENT_TIMESTAMP
WHERE user_id = 10001 AND is_current = TRUE;

-- 复杂的多表关联更新：维护数据一致性
UPDATE analytics.user_behavior_facts facts
SET revenue_amount = pricing.unit_price * (facts.event_properties->>'quantity')::INTEGER
FROM analytics.product_catalog catalog,
     cleaned_data.pricing_data pricing
WHERE facts.event_type = 'purchase'
  AND (facts.event_properties->>'product_id') = catalog.product_sku
  AND catalog.product_id = pricing.product_id
  AND facts.revenue_amount = 0;

-- 缓慢变化维度的版本管理更新
UPDATE analytics.user_dimension 
SET is_current = FALSE,
    expiration_date = CURRENT_DATE - 1,
    updated_at = CURRENT_TIMESTAMP
WHERE user_id = 10001 
  AND is_current = TRUE
  AND (demographics->>'location') != 'shanghai';

-- 插入新的当前版本记录
INSERT INTO analytics.user_dimension (
    user_id, username, email, first_name, last_name,
    demographics, effective_date, is_current, data_source
)
SELECT user_id, username, email, first_name, last_name,
       demographics || '{"location": "shanghai"}',
       CURRENT_DATE, TRUE, 'location_update'
FROM analytics.user_dimension 
WHERE user_id = 10001 AND expiration_date = CURRENT_DATE - 1;
```

### 数据删除：软删除与数据生命周期管理

```sql
-- 软删除：保持数据血缘的完整性
UPDATE analytics.user_behavior_facts 
SET data_quality_score = 0.0,
    event_properties = event_properties || '{"deleted": true, "delete_reason": "data_quality_issue"}',
    updated_at = CURRENT_TIMESTAMP
WHERE etl_batch_id = 20240115001 
  AND data_quality_score < 0.5;

-- 基于数据保留策略的清理
DELETE FROM raw_data.user_events_staging 
WHERE processed_date < CURRENT_DATE - INTERVAL '7 days'
  AND processing_status = 'COMPLETED';

-- 高级删除：使用EXISTS优化大表删除性能
DELETE FROM analytics.user_behavior_facts 
WHERE EXISTS (
    SELECT 1 FROM cleaned_data.invalid_sessions inv
    WHERE inv.session_id = analytics.user_behavior_facts.session_id
      AND inv.reason = 'bot_traffic'
);

-- 条件删除与统计：了解删除影响
WITH deleted_records AS (
    DELETE FROM analytics.user_behavior_facts 
    WHERE event_date < CURRENT_DATE - INTERVAL '2 years'
      AND data_source = 'deprecated_system'
    RETURNING event_id, event_date, event_type
)
SELECT 
    COUNT(*) as total_deleted,
    MIN(event_date) as earliest_deleted,
    MAX(event_date) as latest_deleted,
    COUNT(DISTINCT event_type) as event_types_affected
FROM deleted_records;
```


## 🔍 DQL操作：数据查询的分析之道

数据查询语言(DQL)是数据分析的核心技能。在PostgreSQL中，DQL不仅支持标准SQL查询，更提供了强大的分析功能和现代SQL特性。

### 分析型查询：挖掘数据价值

```sql
-- 用户行为分析：基础指标计算
SELECT 
    user_id,
    COUNT(*) as total_events,
    COUNT(DISTINCT event_type) as unique_event_types,
    COUNT(DISTINCT DATE(event_timestamp)) as active_days,
    SUM(revenue_amount) as total_revenue,
    AVG(duration_seconds) as avg_event_duration,
    
    -- JSON数据的深度分析
    COUNT(*) FILTER (WHERE event_properties->>'device' = 'mobile') as mobile_events,
    COUNT(*) FILTER (WHERE event_type = 'purchase') as purchase_events,
    
    -- 时间维度分析
    MIN(event_timestamp) as first_activity,
    MAX(event_timestamp) as last_activity,
    
    -- 计算用户活跃度分数
    CASE 
        WHEN COUNT(DISTINCT DATE(event_timestamp)) > 20 THEN 'highly_active'
        WHEN COUNT(DISTINCT DATE(event_timestamp)) > 10 THEN 'moderately_active'
        WHEN COUNT(DISTINCT DATE(event_timestamp)) > 5 THEN 'slightly_active'
        ELSE 'low_activity'
    END as activity_level

FROM analytics.user_behavior_facts 
WHERE event_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY user_id
HAVING COUNT(*) > 50  -- 只分析活跃用户
ORDER BY total_revenue DESC, total_events DESC;

-- 高级聚合分析：使用现代SQL分析函数
WITH daily_metrics AS (
    SELECT 
        event_date,
        COUNT(*) as daily_events,
        COUNT(DISTINCT user_id) as daily_active_users,
        SUM(revenue_amount) as daily_revenue,
        COUNT(DISTINCT session_id) as daily_sessions,
        
        -- 计算不同事件类型的占比
        COUNT(*) FILTER (WHERE event_type = 'page_view') * 100.0 / COUNT(*) as page_view_pct,
        COUNT(*) FILTER (WHERE event_type = 'purchase') * 100.0 / COUNT(*) as purchase_pct
        
    FROM analytics.user_behavior_facts 
    WHERE event_date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY event_date
)
SELECT 
    event_date,
    daily_events,
    daily_active_users,
    daily_revenue,
    daily_sessions,
    ROUND(page_view_pct, 2) as page_view_percentage,
    ROUND(purchase_pct, 2) as purchase_percentage,
    
    -- 最近最多7条日汇总记录的移动平均；缺失日期未补齐时不等于连续7个自然日
    AVG(daily_revenue) OVER (
        ORDER BY event_date 
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) as revenue_7day_avg,
    
    -- 环比增长率
    LAG(daily_revenue) OVER (ORDER BY event_date) as prev_day_revenue,
    CASE 
        WHEN LAG(daily_revenue) OVER (ORDER BY event_date) > 0 THEN
            (daily_revenue - LAG(daily_revenue) OVER (ORDER BY event_date)) * 100.0 / 
            LAG(daily_revenue) OVER (ORDER BY event_date)
        ELSE NULL 
    END as day_over_day_growth_pct

FROM daily_metrics 
ORDER BY event_date DESC;
```

### PostgreSQL特色查询：JSON和数组的威力

```sql
-- JSON数据的复杂查询和分析
SELECT 
    user_id,
    event_timestamp,
    event_type,
    
    -- JSON字段提取和转换
    event_properties->>'product_id' as product_id,
    (event_properties->>'quantity')::INTEGER as quantity,
    event_properties->'user_agent'->>'browser' as browser,
    
    -- JSON数组处理
    jsonb_array_length(event_properties->'tags') as tag_count,
    event_properties->'tags' as all_tags,
    
    -- 条件JSON查询
    CASE WHEN event_properties ? 'referrer' 
         THEN event_properties->>'referrer' 
         ELSE 'direct' 
    END as traffic_source,
    
    -- JSON聚合和统计
    jsonb_object_keys(event_properties) as property_keys

FROM analytics.user_behavior_facts 
WHERE event_properties @> '{"category": "electronics"}'  -- 包含特定键值对
   OR event_properties ? 'promotion_code'                 -- 包含特定键
   OR event_properties->'tags' ? 'high_value'             -- JSON数组包含特定值
ORDER BY event_timestamp DESC;

-- 复杂的多维度分析：结合CTE和窗口函数
WITH user_segments AS (
    -- 第一步：计算用户细分指标
    SELECT 
        user_id,
        COUNT(*) as total_events,
        COALESCE(SUM(revenue_amount) FILTER (WHERE event_type = 'purchase'), 0) as total_spent,
        COUNT(DISTINCT event_date) as active_days,
        MAX(event_timestamp) as last_activity,
        
        -- 计算RFM分析指标
        CURRENT_DATE - MAX(event_date) as days_since_last_activity,
        COUNT(DISTINCT CASE WHEN event_type = 'purchase' THEN event_date END) as purchase_frequency,
        AVG(revenue_amount) FILTER (WHERE event_type = 'purchase' AND revenue_amount > 0) as avg_purchase_event_revenue
        
    FROM analytics.user_behavior_facts 
    WHERE event_date >= CURRENT_DATE - INTERVAL '365 days'
    GROUP BY user_id
),
user_scores AS (
    -- 第二步：计算分数和排名
    SELECT *,
        NTILE(5) OVER (ORDER BY days_since_last_activity DESC) as recency_score,
        NTILE(5) OVER (ORDER BY purchase_frequency) as frequency_score,  
        NTILE(5) OVER (ORDER BY total_spent) as monetary_score
    FROM user_segments
)
-- 第三步：生成用户细分报告
SELECT 
    CASE 
        WHEN recency_score >= 4 AND frequency_score >= 4 AND monetary_score >= 4 THEN 'VIP客户'
        WHEN recency_score >= 3 AND frequency_score >= 3 AND monetary_score >= 3 THEN '忠诚客户'
        WHEN recency_score <= 2 AND frequency_score <= 2 THEN '流失风险客户'
        WHEN recency_score >= 4 AND frequency_score <= 2 THEN '新客户'
        ELSE '普通客户'
    END as customer_segment,
    
    COUNT(*) as segment_size,
    AVG(total_spent) as avg_total_spent,
    AVG(active_days) as avg_active_days,
    AVG(days_since_last_activity) as avg_days_since_last_activity,
    
    -- 分布统计
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_spent) as median_spent,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY total_spent) as p75_spent

FROM user_scores 
GROUP BY customer_segment
ORDER BY avg_total_spent DESC;
```

### 现代SQL特性：CTE和窗口函数

```sql
-- 递归CTE：分析产品类别层次结构
WITH RECURSIVE category_hierarchy AS (
    -- 基础查询：顶级分类
    SELECT 
        category_id,
        category_name,
        parent_category_id,
        1 as level,
        category_name as category_path,
        ARRAY[category_id] as category_lineage
    FROM analytics.product_categories 
    WHERE parent_category_id IS NULL
    
    UNION ALL
    
    -- 递归查询：子分类
    SELECT 
        pc.category_id,
        pc.category_name,
        pc.parent_category_id,
        ch.level + 1,
        ch.category_path || ' > ' || pc.category_name,
        ch.category_lineage || pc.category_id
    FROM analytics.product_categories pc
    JOIN category_hierarchy ch ON pc.parent_category_id = ch.category_id
    WHERE ch.level < 5  -- 防止无限递归
)
-- 分析各级分类直接归属产品的销售表现；未汇总子类别销售额
SELECT 
    ch.level,
    ch.category_path,
    COUNT(DISTINCT p.product_id) as product_count,
    COALESCE(SUM(ubf.revenue_amount), 0) as total_revenue,
    COUNT(DISTINCT ubf.user_id) as unique_customers
    
FROM category_hierarchy ch
LEFT JOIN analytics.product_catalog p ON ch.category_id = p.category_id
LEFT JOIN analytics.user_behavior_facts ubf
    ON p.product_sku = (ubf.event_properties->>'product_id')
   AND ubf.event_type = 'purchase'
GROUP BY ch.level, ch.category_path, ch.category_lineage
ORDER BY ch.level, total_revenue DESC;
```

## 🎯 SQL最佳实践与性能优化

### 查询性能优化原则

```sql
-- ✅ 优秀的查询写法
SELECT 
    user_id,
    event_type,
    SUM(revenue_amount) as total_revenue
FROM analytics.user_behavior_facts 
WHERE event_date BETWEEN '2024-01-01' AND '2024-01-31'  -- 利用分区pruning
  AND event_type IN ('purchase', 'add_to_cart')         -- 精确的条件过滤
  AND user_id IS NOT NULL                               -- 本表user_id已声明NOT NULL，此条件冗余
GROUP BY user_id, event_type
ORDER BY total_revenue DESC
LIMIT 100;                                              -- 限制结果集大小

-- ❌ 避免的查询模式
-- SELECT * FROM analytics.user_behavior_facts WHERE EXTRACT(YEAR FROM event_date) = 2024;
-- 问题：列上表达式通常不能直接利用该列的普通索引；匹配的表达式索引等情况需结合执行计划判断

-- 使用EXPLAIN分析查询性能
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) 
SELECT user_id, COUNT(*) 
FROM analytics.user_behavior_facts 
WHERE event_date >= '2024-01-01' 
GROUP BY user_id;
```

## 📚 核心要点总结

1. **DDL思维**：将表设计视为数据架构的基础，考虑分区、索引和约束
2. **DML效率**：批量操作优于单行操作，UPSERT处理数据冲突
3. **DQL分析**：利用窗口函数、CTE和JSON功能进行深度数据分析
4. **性能意识**：始终考虑查询性能，合理使用索引和分区
5. **现代特性**：充分利用PostgreSQL的JSON、数组等高级数据类型

> [!success] 🚀 进阶路径
> 
> 掌握了基本SQL操作后，建议深入学习：
> 1. **高级查询技巧**：在[[【技术与工具】/PostgreSQL/05-PostgreSQL高级查询与函数|PostgreSQL高级查询与函数]]中学习窗口函数、分析函数
> 2. **性能调优**：在[[【技术与工具】/PostgreSQL/06-PostgreSQL索引与性能优化|PostgreSQL索引与性能优化]]中掌握索引策略和查询优化
> 3. **企业应用**：在[[【技术与工具】/PostgreSQL/10-PostgreSQL实践案例|PostgreSQL实践案例]]中学习实际项目应用

## 🔗 学习资源

- [[【技术与工具】/PostgreSQL/03-PostgreSQL数据类型与表设计|PostgreSQL数据类型与表]] - 理解类型对查询的影响
- [[【技术与工具】/PostgreSQL/00-PostgreSQL学习路线图|PostgreSQL]] - 系统化学习路径
- [[【技术与工具】/PostgreSQL/01-PostgreSQL基础概念与特性|PostgreSQL基础概念与特性]] - 了解PostgreSQL独特优势

---

**SQL是数据的语言，PostgreSQL是这门语言最优雅的方言**。通过系统化的学习和大量实践，您将能够用SQL优雅地表达复杂的数据分析需求，让数据真正发挥价值。