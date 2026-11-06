---
title: HiveQL基础语法 - 掌握Hive SQL的核心技能
tags:
  - HiveQL
  - SQL
  - DDL
  - DML
  - 查询
  - 数据导入
  - 数据导出
created: 2024-06-29
updated: 2026-10-10
difficulty: 高级
duration: 120分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据分析师
  - BI分析师
  - 数据架构师
  - 数据科学家
  - 数据治理工程师
stability: slow-changing
status: maintenance
access_tier: free
---


# 📝 HiveQL基础语法 - 掌握Hive SQL的核心技能

> [!abstract] 📋 本节概览
> - 🎯 **学习目标**：熟练掌握HiveQL的语法规则和基本操作
> - 📚 **前置知识**：[[【技术与工具】/Hive/03-Hive数据模型|Hive数据]] | [[【数据分析与数据运营】/01-共同能力基础/03-工具掌握/01-SQL基本概念|SQL基本概念]]
> - ⏱️ **预计用时**：120分钟
> - 🔧 **技术重点**：DDL操作、DML操作、查询语法、数据导入导出

> [!tip] 💡 前置知识
> 建议先掌握标准SQL语法和Hive数据模型概念

---

## 🏗️ DDL (数据定义语言) - 数据结构的建筑师

### 数据库操作

> [!note] 💡 数据库就像"城市规划" 🏙️
> - **创建数据库**：规划一个新的城市区域
> - **使用数据库**：进入特定的城市区域工作
> - **删除数据库**：拆除整个城市区域（谨慎操作！）
> - **修改数据库**：调整城市区域的配置和属性

```sql
-- 🏙️ 创建数据库 - 规划新的数据区域
CREATE DATABASE IF NOT EXISTS ecommerce_analytics
COMMENT '电商数据分析数据库'
LOCATION '/user/hive/warehouse/ecommerce.db'
WITH DBPROPERTIES (
    'creator' = 'data_team',
    'created_date' = '2024-06-29',
    'purpose' = 'business_intelligence'
);

-- 🔍 查看数据库列表 - 浏览所有城市区域
SHOW DATABASES;

-- 📊 查看数据库详细信息
DESCRIBE DATABASE EXTENDED ecommerce_analytics;

-- 🎯 切换到指定数据库 - 进入特定工作区域
USE ecommerce_analytics;

-- 🔧 修改数据库属性 - 更新区域配置
ALTER DATABASE ecommerce_analytics
SET DBPROPERTIES (
    'last_modified' = '2024-06-29',
    'version' = '2.0',
    'maintainer' = 'analytics_team'
);

-- ⚠️ 删除数据库 - 拆除整个区域（慎用！）
-- DROP DATABASE IF EXISTS ecommerce_analytics CASCADE;
```

### 表操作 - 设计数据的家园

> [!note] 💡 创建表就像"建造房屋" 🏠
> - **基础结构**：确定房间布局（字段定义）
> - **装修风格**：选择存储格式（ORC、Parquet等）
> - **门牌号码**：设置分区规则（按时间、地区等）
> - **收纳系统**：配置分桶策略（数据分布）

#### 创建表的多种方式

```sql
-- 🏗️ 方式1：完整建表语句 - 精装修新房
CREATE TABLE customer_profiles (
    -- 🆔 基础身份信息
    customer_id BIGINT COMMENT '客户唯一标识',
    first_name STRING COMMENT '名字',
    last_name STRING COMMENT '姓氏',
    email STRING COMMENT '邮箱地址',
    phone STRING COMMENT '联系电话',
    
    -- 📍 地址信息（复杂数据类型演示）
    address STRUCT<
        street: STRING,
        city: STRING,
        state: STRING,
        zip_code: STRING,
        country: STRING
    > COMMENT '详细地址信息',
    
    -- 📅 时间信息
    birth_date DATE COMMENT '出生日期',
    registration_date TIMESTAMP COMMENT '注册时间',
    last_login_date TIMESTAMP COMMENT '最后登录时间',
    
    -- 💰 业务信息
    account_balance DECIMAL(12,2) COMMENT '账户余额',
    credit_score INT COMMENT '信用评分',
    membership_level STRING COMMENT '会员等级',
    
    -- 📊 行为偏好（集合类型演示）
    favorite_categories ARRAY<STRING> COMMENT '喜欢的商品类别',
    purchase_history MAP<STRING, INT> COMMENT '购买历史统计',
    
    -- 🏷️ 标签和属性
    customer_tags ARRAY<STRING> COMMENT '客户标签列表（如需集合语义，写入前去重）',
    preferences MAP<STRING, STRING> COMMENT '个人偏好设置'
)
COMMENT '客户画像详细信息表'
PARTITIONED BY (
    region STRING COMMENT '地理区域',
    reg_year INT COMMENT '注册年份',
    reg_month INT COMMENT '注册月份'
)
CLUSTERED BY (customer_id) INTO 16 BUCKETS
STORED AS ORC
LOCATION '/user/hive/warehouse/ecommerce.db/customer_profiles'
TBLPROPERTIES (
    'orc.compress' = 'SNAPPY',
    'orc.stripe.size' = '268435456',
    'orc.row.index.stride' = '10000',
    'orc.bloom.filter.columns' = 'customer_id,email',
    'table.type' = 'MANAGED_TABLE',
    'last_modified_time' = '2024-06-29'
);

-- 🏠 方式2：基于查询结果创建表 - 复制装修
CREATE TABLE high_value_customers AS
SELECT 
    customer_id,
    first_name,
    last_name,
    email,
    account_balance,
    membership_level,
    registration_date
FROM customer_profiles
WHERE account_balance > 10000
    AND membership_level IN ('Gold', 'Platinum', 'Diamond');

-- 🏗️ 方式3：创建表结构（不复制数据） - 毛坯房
CREATE TABLE customer_backup
LIKE customer_profiles;

-- 📋 方式4：外部表创建 - 租赁房屋
CREATE EXTERNAL TABLE external_customer_data (
    customer_id BIGINT,
    name STRING,
    email STRING,
    purchase_amount DECIMAL(10,2)
)
COMMENT '外部客户数据源'
ROW FORMAT DELIMITED
    FIELDS TERMINATED BY ','
    LINES TERMINATED BY '\n'
STORED AS TEXTFILE
LOCATION '/external/customer_data/'
TBLPROPERTIES ('external.table' = 'true');
```

#### 表结构管理

```sql
-- 🔍 查看表信息 - 房屋检查
SHOW TABLES;
SHOW TABLES LIKE 'customer*';

-- 📊 查看表详细信息
DESCRIBE customer_profiles;
DESCRIBE FORMATTED customer_profiles;
DESCRIBE EXTENDED customer_profiles;

-- 🏗️ 修改表结构 - 房屋改造

-- 添加新列 - 扩建房间
ALTER TABLE customer_profiles 
ADD COLUMNS (
    social_media_handles MAP<STRING, STRING> COMMENT '社交媒体账号',
    loyalty_points BIGINT COMMENT '积分余额',
    referral_code STRING COMMENT '推荐码'
);

-- 修改列属性 - 房间装修
ALTER TABLE customer_profiles 
CHANGE COLUMN phone contact_phone STRING COMMENT '主要联系电话';

-- 重命名表 - 门牌号变更
ALTER TABLE customer_backup 
RENAME TO customer_profiles_backup;

-- 修改表属性 - 房屋配置更新
ALTER TABLE customer_profiles 
SET TBLPROPERTIES (
    'last_modified_time' = '2024-06-29',
    'data_quality_score' = '95',
    'backup_frequency' = 'daily'
);

-- 添加分区 - 扩建楼层
ALTER TABLE customer_profiles 
ADD PARTITION (region='North America', reg_year=2024, reg_month=6)
LOCATION '/user/hive/warehouse/ecommerce.db/customer_profiles/region=North America/reg_year=2024/reg_month=6';

-- 删除分区 - 拆除楼层
ALTER TABLE customer_profiles 
DROP PARTITION (region='Test Region', reg_year=2023, reg_month=1);
```

### 视图操作 - 数据的观景台

> [!note] 💡 视图就像"观景台" 🏔️
> - **普通视图**：固定角度的观景台，每次都重新观看
> - **物化视图**：拍好的风景照片，快速查看但需要更新
> - **虚拟窗口**：不占用实际空间，提供特定视角

```sql
-- 🏔️ 创建视图 - 搭建观景台
CREATE VIEW customer_summary AS
SELECT 
    region,
    membership_level,
    COUNT(*) as customer_count,
    AVG(account_balance) as avg_balance,
    SUM(account_balance) as total_balance,
    MIN(registration_date) as earliest_registration,
    MAX(last_login_date) as latest_activity
FROM customer_profiles
WHERE account_balance > 0
GROUP BY region, membership_level;

-- 🖼️ 创建物化视图 - 预制风景照
CREATE MATERIALIZED VIEW customer_monthly_stats AS
SELECT 
    reg_year,
    reg_month,
    region,
    COUNT(*) as new_customers,
    AVG(account_balance) as avg_initial_balance,
    COUNT(CASE WHEN membership_level = 'Premium' THEN 1 END) as premium_customers
FROM customer_profiles
GROUP BY reg_year, reg_month, region;

-- 🔄 刷新物化视图 - 更新风景照
ALTER MATERIALIZED VIEW customer_monthly_stats REBUILD;

-- 🔍 查看视图
SHOW VIEWS;
DESCRIBE customer_summary;

-- 🗑️ 删除视图
DROP VIEW IF EXISTS customer_summary;
```

---

## 📝 DML（数据操作语言）

### 数据插入操作

```sql
-- 📥 数据插入操作示例

-- 1. 直接插入值
INSERT INTO users VALUES 
(1, 'alice', 'alice@example.com', '13800138001', 'F', '1990-05-15', '2024-01-01', '2024-06-29 10:30:00', true, MAP('vip_level', 'gold', 'region', 'north')),
(2, 'bob', 'bob@example.com', '13800138002', 'M', '1988-08-20', '2024-01-15', '2024-06-28 15:45:00', true, MAP('vip_level', 'silver', 'region', 'south')),
(3, 'charlie', 'charlie@example.com', '13800138003', 'M', '1985-12-10', '2024-02-01', '2024-06-27 09:20:00', false, MAP('vip_level', 'bronze', 'region', 'east'));

-- 2. 插入指定列
INSERT INTO users (user_id, username, email, register_date, is_active)
VALUES 
(4, 'diana', 'diana@example.com', '2024-06-29', true);

-- 3. 从查询结果插入
INSERT INTO user_summary
SELECT 
    gender,
    YEAR(register_date) as register_year,
    COUNT(*) as user_count,
    AVG(DATEDIFF(CURRENT_DATE, birth_date)/365) as avg_age
FROM users
WHERE is_active = true
GROUP BY gender, YEAR(register_date);

-- 4. 覆盖插入
INSERT OVERWRITE TABLE user_summary
SELECT 
    gender,
    YEAR(register_date) as register_year,
    COUNT(*) as user_count,
    AVG(DATEDIFF(CURRENT_DATE, birth_date)/365) as avg_age
FROM users
WHERE is_active = true
  AND register_date >= '2024-01-01'
GROUP BY gender, YEAR(register_date);

-- 5. 多表插入
FROM users
INSERT OVERWRITE TABLE male_users
    SELECT * WHERE gender = 'M'
INSERT OVERWRITE TABLE female_users
    SELECT * WHERE gender = 'F';

-- 6. 分区表插入
INSERT INTO products PARTITION (year=2024, month=6)
SELECT 
    product_id,
    product_name,
    category_id,
    category_name,
    brand,
    price,
    cost,
    description,
    attributes,
    tags,
    is_available,
    created_date,
    updated_date
FROM products_staging
WHERE YEAR(created_date) = 2024 AND MONTH(created_date) = 6;

-- 7. 动态分区插入
SET hive.exec.dynamic.partition = true;
SET hive.exec.dynamic.partition.mode = nonstrict;

INSERT INTO products PARTITION (year, month)
SELECT 
    product_id,
    product_name,
    category_id,
    category_name,
    brand,
    price,
    cost,
    description,
    attributes,
    tags,
    is_available,
    created_date,
    updated_date,
    YEAR(created_date) as year,
    MONTH(created_date) as month
FROM products_staging;
```

### 数据更新和删除

```sql
-- 🔄 数据更新删除操作（需要ACID支持）

-- 启用事务支持
SET hive.support.concurrency = true;
SET hive.enforce.bucketing = true;
SET hive.exec.dynamic.partition.mode = nonstrict;
SET hive.txn.manager = org.apache.hadoop.hive.ql.lockmgr.DbTxnManager;

-- 创建支持ACID的表
CREATE TABLE orders_transactional (
    order_id BIGINT,
    customer_id BIGINT,
    order_date DATE,
    status STRING,
    total_amount DECIMAL(10,2),
    updated_time TIMESTAMP
)
PARTITIONED BY (year INT, month INT)
CLUSTERED BY (order_id) INTO 16 BUCKETS
STORED AS ORC
TBLPROPERTIES ('transactional' = 'true');

-- 更新操作
UPDATE orders_transactional 
SET status = 'shipped',
    updated_time = CURRENT_TIMESTAMP
WHERE status = 'processing' 
    AND order_date = CURRENT_DATE;

-- 删除操作
DELETE FROM orders_transactional 
WHERE status = 'cancelled' 
    AND order_date < DATE_SUB(CURRENT_DATE, 90);

-- 合并操作（MERGE）
MERGE INTO orders_transactional AS target
USING (
    SELECT 
        order_id,
        customer_id,
        order_date,
        status,
        total_amount,
        CURRENT_TIMESTAMP as updated_time,
        YEAR(order_date) as year,
        MONTH(order_date) as month
    FROM orders_updates
) AS source
ON target.order_id = source.order_id
WHEN MATCHED THEN 
    UPDATE SET 
        status = source.status,
        total_amount = source.total_amount,
        updated_time = source.updated_time
WHEN NOT MATCHED THEN 
    INSERT VALUES (
        source.order_id,
        source.customer_id,
        source.order_date,
        source.status,
        source.total_amount,
        source.updated_time,
        source.year,
        source.month
    );
```

---

## 🔍 查询语法详解

### 基础查询结构

```sql
-- 📊 HiveQL查询基础结构

-- 完整的SELECT语句结构
SELECT [ALL | DISTINCT] 
    column1,
    column2,
    expression1 AS alias1,
    function(column3) AS alias2
FROM table_name [alias]
[WHERE condition]
[GROUP BY column_list]
[HAVING condition]
[ORDER BY column_list [ASC | DESC]]
[CLUSTER BY column_list | DISTRIBUTE BY column_list [SORT BY column_list]]
[LIMIT number];

-- 实际示例：用户行为分析
SELECT 
    u.gender,
    u.profile['region'] as region,
    COUNT(DISTINCT u.user_id) as user_count,
    AVG(DATEDIFF(CURRENT_DATE, u.birth_date)/365) as avg_age,
    MAX(u.last_login) as latest_login
FROM users u
WHERE u.is_active = true
    AND u.register_date >= '2024-01-01'
    AND u.profile['vip_level'] IN ('gold', 'silver')
GROUP BY u.gender, u.profile['region']
HAVING COUNT(DISTINCT u.user_id) > 10
ORDER BY user_count DESC, avg_age ASC
LIMIT 20;
```

### 复杂查询示例

#### 子查询

```sql
-- 🔍 子查询示例

-- 1. 标量子查询
SELECT 
    user_id,
    username,
    register_date,
    DATEDIFF(register_date, (SELECT MIN(register_date) FROM users)) as days_since_first_user
FROM users
WHERE user_id < 1000;

-- 2. EXISTS子查询
SELECT 
    p.product_id,
    p.product_name,
    p.price
FROM products p
WHERE EXISTS (
    SELECT 1 
    FROM order_items oi 
    WHERE oi.product_id = p.product_id
        AND oi.order_date >= DATE_SUB(CURRENT_DATE, 30)
);

-- 3. IN子查询
SELECT 
    u.user_id,
    u.username,
    u.email
FROM users u
WHERE u.user_id IN (
    SELECT DISTINCT customer_id 
    FROM orders 
    WHERE order_date >= DATE_SUB(CURRENT_DATE, 7)
        AND status = 'completed'
);

-- 4. 相关子查询
SELECT 
    u1.user_id,
    u1.username,
    u1.register_date
FROM users u1
WHERE u1.register_date = (
    SELECT MAX(u2.register_date)
    FROM users u2
    WHERE u2.gender = u1.gender
);
```

#### 窗口函数

```sql
-- 🪟 窗口函数示例

-- 用户排名分析
SELECT 
    user_id,
    username,
    register_date,
    last_login,
    -- 按注册日期排名
    ROW_NUMBER() OVER (ORDER BY register_date) as register_rank,
    -- 按最后登录时间排名
    RANK() OVER (ORDER BY last_login DESC) as login_rank,
    -- 按性别分组排名
    DENSE_RANK() OVER (PARTITION BY gender ORDER BY register_date) as gender_register_rank,
    -- 累计用户数
    COUNT(*) OVER (ORDER BY register_date ROWS UNBOUNDED PRECEDING) as cumulative_users,
    -- 前一个用户的注册日期
    LAG(register_date, 1) OVER (ORDER BY register_date) as prev_user_register_date,
    -- 后一个用户的注册日期
    LEAD(register_date, 1) OVER (ORDER BY register_date) as next_user_register_date,
    -- 移动平均（按注册日期排序，前后各3行；不是前后各3天）
    AVG(user_id) OVER (ORDER BY register_date ROWS BETWEEN 3 PRECEDING AND 3 FOLLOWING) as moving_avg_user_id
FROM users
WHERE is_active = true
ORDER BY register_date;

-- 销售数据分析
SELECT 
    order_date,
    total_amount,
    -- 当日销售总额（同一日期的每行返回相同总额）
    SUM(total_amount) OVER (PARTITION BY order_date) as daily_total,
    -- 月累计销售额
    SUM(total_amount) OVER (
        PARTITION BY YEAR(order_date), MONTH(order_date) 
        ORDER BY order_date 
        ROWS UNBOUNDED PRECEDING
    ) as monthly_cumulative,
    -- 最近7行订单金额的移动平均（不是7天移动平均）
    AVG(total_amount) OVER (
        ORDER BY order_date 
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) as week_moving_avg,
    -- 销售额百分位数
    PERCENT_RANK() OVER (ORDER BY total_amount) as amount_percentile
FROM orders
WHERE order_date >= DATE_SUB(CURRENT_DATE, 30)
ORDER BY order_date, total_amount DESC;
```

#### JOIN操作

```sql
-- 🔗 JOIN操作示例

-- 1. 内连接
SELECT 
    u.user_id,
    u.username,
    o.order_id,
    o.order_date,
    o.total_amount
FROM users u
INNER JOIN orders o ON u.user_id = o.customer_id
WHERE u.is_active = true
    AND o.order_date >= DATE_SUB(CURRENT_DATE, 30);

-- 2. 左外连接
SELECT 
    u.user_id,
    u.username,
    COUNT(o.order_id) as order_count,
    COALESCE(SUM(o.total_amount), 0) as total_spent
FROM users u
LEFT OUTER JOIN orders o ON u.user_id = o.customer_id
    AND o.order_date >= DATE_SUB(CURRENT_DATE, 30)
GROUP BY u.user_id, u.username;

-- 3. 右外连接
SELECT 
    o.order_id,
    o.order_date,
    o.total_amount,
    u.username,
    u.email
FROM users u
RIGHT OUTER JOIN orders o ON u.user_id = o.customer_id;

-- 4. 全外连接
SELECT 
    COALESCE(u.user_id, o.customer_id) as user_id,
    u.username,
    o.order_id,
    o.total_amount
FROM users u
FULL OUTER JOIN orders o ON u.user_id = o.customer_id;

-- 5. 交叉连接（笛卡尔积）
SELECT 
    p.product_id,
    p.product_name,
    c.category_id,
    c.category_name
FROM products p
CROSS JOIN categories c
WHERE p.category_id IS NULL;  -- 将分类为空的商品与每个分类组合；categories为空时不返回结果

-- 6. 自连接
SELECT 
    u1.user_id as user1_id,
    u1.username as user1_name,
    u2.user_id as user2_id,
    u2.username as user2_name
FROM users u1
JOIN users u2 ON u1.gender = u2.gender
    AND u1.user_id < u2.user_id
    AND u1.profile['region'] = u2.profile['region']
LIMIT 100;

-- 7. 半连接（使用EXISTS模拟）
SELECT 
    u.user_id,
    u.username
FROM users u
WHERE EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.customer_id = u.user_id
        AND o.order_date >= DATE_SUB(CURRENT_DATE, 30)
);

-- 8. 反连接（使用NOT EXISTS模拟）
SELECT 
    u.user_id,
    u.username
FROM users u
WHERE NOT EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.customer_id = u.user_id
);
```

#### 集合操作

```sql
-- 🔢 集合操作示例

-- 1. UNION（合并去重）
SELECT user_id, username, 'active' as status 
FROM users 
WHERE is_active = true
UNION
SELECT user_id, username, 'inactive' as status 
FROM users 
WHERE is_active = false;

-- 2. UNION ALL（合并不去重）
SELECT product_id, product_name, 'online' as channel
FROM online_products
UNION ALL
SELECT product_id, product_name, 'offline' as channel
FROM offline_products;

-- 3. 使用子查询实现INTERSECT（交集）
SELECT DISTINCT u1.user_id, u1.username
FROM users u1
JOIN users u2 ON u1.user_id = u2.user_id
WHERE u1.user_id IN (SELECT customer_id FROM orders WHERE order_date >= '2024-01-01')
    AND u1.user_id IN (SELECT customer_id FROM orders WHERE order_date >= '2024-06-01');

-- 4. 使用子查询实现EXCEPT（差集）
SELECT u.user_id, u.username
FROM users u
WHERE u.user_id NOT IN (
    SELECT DISTINCT customer_id 
    FROM orders 
    WHERE customer_id IS NOT NULL
);
```

---

## 📤 数据导入导出

### 数据导入

#### LOAD语句

```sql
-- 📥 LOAD数据导入

-- 1. 从本地文件系统导入
LOAD DATA LOCAL INPATH '/tmp/users.txt'
INTO TABLE users;

-- 2. 从HDFS导入
LOAD DATA INPATH '/data/input/users.txt'
INTO TABLE users;

-- 3. 覆盖导入
LOAD DATA INPATH '/data/input/users_new.txt'
OVERWRITE INTO TABLE users;

-- 4. 导入到分区表
LOAD DATA INPATH '/data/input/products_202406.txt'
INTO TABLE products PARTITION (year=2024, month=6);

-- 5. 动态分区导入（Hive 3.0及以上的LOAD重写能力；需核对动态分区配置，输入末尾字段须对应year、month）
LOAD DATA INPATH '/data/input/products_all.txt'
INTO TABLE products;
```

#### 外部数据源导入

```sql
-- 🔌 外部数据源导入示例

-- 1. 从CSV文件创建外部表
CREATE EXTERNAL TABLE users_csv (
    user_id STRING,
    username STRING,
    email STRING,
    register_date STRING
)
ROW FORMAT SERDE 'org.apache.hadoop.hive.serde2.OpenCSVSerde'
WITH SERDEPROPERTIES (
   'separatorChar' = ',',
   'quoteChar' = '"',
   'escapeChar' = '\\'
)
STORED AS TEXTFILE
LOCATION '/data/csv/users/'
TBLPROPERTIES ('skip.header.line.count'='1');

-- 2. 从JSON文件创建外部表
CREATE EXTERNAL TABLE users_json (
    user_data STRING
)
STORED AS TEXTFILE
LOCATION '/data/json/users/';

-- 使用JSON函数解析
SELECT 
    get_json_object(user_data, '$.user_id') as user_id,
    get_json_object(user_data, '$.username') as username,
    get_json_object(user_data, '$.email') as email
FROM users_json;

-- 3. 从Parquet文件导入
CREATE EXTERNAL TABLE users_parquet (
    user_id BIGINT,
    username STRING,
    email STRING,
    register_date DATE
)
STORED AS PARQUET
LOCATION '/data/parquet/users/';

-- 4. 通过INSERT导入处理后的数据
INSERT INTO users
SELECT 
    cast(user_id as bigint) as user_id,
    username,
    email,
    null as phone,
    null as gender,
    null as birth_date,
    cast(register_date as date) as register_date,
    null as last_login,
    true as is_active,
    map() as profile
FROM users_csv
WHERE user_id IS NOT NULL;
```

### 数据导出

#### INSERT导出

```sql
-- 📤 INSERT数据导出

-- 1. 导出到本地文件系统
INSERT OVERWRITE LOCAL DIRECTORY '/tmp/user_export'
ROW FORMAT DELIMITED
FIELDS TERMINATED BY '\t'
LINES TERMINATED BY '\n'
SELECT user_id, username, email, register_date
FROM users
WHERE is_active = true;

-- 2. 导出到HDFS
INSERT OVERWRITE DIRECTORY '/data/export/users'
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
LINES TERMINATED BY '\n'
SELECT user_id, username, email, register_date
FROM users
WHERE register_date >= '2024-01-01';

-- 3. 导出为不同格式
-- 导出为ORC格式
INSERT OVERWRITE DIRECTORY '/data/export/users_orc'
STORED AS ORC
SELECT * FROM users WHERE is_active = true;

-- 导出为Parquet格式
INSERT OVERWRITE DIRECTORY '/data/export/users_parquet'
STORED AS PARQUET
SELECT * FROM users WHERE is_active = true;

-- 4. 导出时附加年份列（不会自动创建按年份分区的目录）
INSERT OVERWRITE DIRECTORY '/data/export/users_by_year'
SELECT 
    user_id,
    username,
    email,
    register_date,
    YEAR(register_date) as year
FROM users
WHERE is_active = true;
```

#### 使用Sqoop导出

```bash
#!/bin/bash
# 🔄 使用Sqoop导出到关系数据库

# 导出整个表到MySQL
sqoop export \
    --connect jdbc:mysql://localhost:3306/analytics \
    --username sqoop_user \
    --password-file /user/sqoop/mysql.password \
    --table user_export \
    --export-dir /user/hive/warehouse/ecommerce.db/users \
    --input-fields-terminated-by '\t' \
    --input-lines-terminated-by '\n' \
    --num-mappers 4

# 将预先生成的文本数据按user_id更新或插入目标表（本命令不执行查询）
sqoop export \
    --connect jdbc:mysql://localhost:3306/analytics \
    --username sqoop_user \
    --password-file /user/sqoop/mysql.password \
    --table user_summary \
    --export-dir /tmp/user_summary_export \
    --input-fields-terminated-by ',' \
    --update-key user_id \
    --update-mode allowinsert
```

### 数据格式转换

```sql
-- 🔄 数据格式转换示例

-- 1. TextFile转ORC
CREATE TABLE users_orc 
STORED AS ORC
TBLPROPERTIES ('orc.compress'='SNAPPY')
AS SELECT * FROM users_textfile;

-- 2. 添加数据转换逻辑
CREATE TABLE users_transformed AS
SELECT 
    user_id,
    upper(username) as username,  -- 用户名大写
    lower(email) as email,        -- 邮箱小写
    CASE 
        WHEN phone LIKE '1%' THEN concat('+86-', phone)
        ELSE phone 
    END as formatted_phone,       -- 格式化手机号
    gender,
    birth_date,
    register_date,
    last_login,
    is_active,
    -- 扩展profile信息
    map_concat(
        profile,
        map('age', cast(datediff(current_date, birth_date)/365 as string))
    ) as enhanced_profile
FROM users
WHERE is_active = true;

-- 3. 数据清洗和标准化
CREATE TABLE users_cleaned AS
SELECT 
    user_id,
    trim(username) as username,
    regexp_replace(email, '[^a-zA-Z0-9@._-]', '') as clean_email,
    regexp_replace(phone, '[^0-9]', '') as clean_phone,
    CASE 
        WHEN upper(gender) IN ('M', 'MALE', '男') THEN 'M'
        WHEN upper(gender) IN ('F', 'FEMALE', '女') THEN 'F'
        ELSE 'U'
    END as standardized_gender,
    birth_date,
    register_date,
    last_login,
    is_active,
    profile
FROM users
WHERE user_id IS NOT NULL
    AND username IS NOT NULL
    AND email RLIKE '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$';
```

---

## 🔧 HiveQL高级特性

### 动态SQL

```sql
-- 🔄 动态SQL示例

-- 使用变量
SET hivevar:start_date = 2024-01-01;
SET hivevar:end_date = 2024-06-29;

SELECT 
    user_id,
    username,
    register_date
FROM users
WHERE register_date BETWEEN '${hivevar:start_date}' AND '${hivevar:end_date}';

-- 使用配置参数
SET hive.exec.parallel = true;
SET hive.exec.parallel.thread.number = 8;

-- 条件执行
SET hivevar:enable_filter = true;

SELECT 
    user_id,
    username,
    email
FROM users
WHERE 
    CASE 
        WHEN '${hivevar:enable_filter}' = 'true' THEN is_active = true
        ELSE 1 = 1
    END;
```

### 内置函数使用

```sql
-- 🔧 内置函数示例

-- 字符串函数
SELECT 
    user_id,
    concat('User:', username) as display_name,
    length(email) as email_length,
    substr(email, 1, instr(email, '@')-1) as email_prefix,
    regexp_replace(phone, '(\\d{3})(\\d{4})(\\d{4})', '$1-$2-$3') as formatted_phone
FROM users;

-- 日期函数
SELECT 
    user_id,
    register_date,
    year(register_date) as register_year,
    month(register_date) as register_month,
    dayofweek(register_date) as register_dow,
    datediff(current_date, register_date) as days_since_register,
    add_months(register_date, 12) as one_year_later
FROM users;

-- 数学函数
SELECT 
    product_id,
    price,
    round(price, 2) as rounded_price,
    ceil(price) as ceiling_price,
    floor(price) as floor_price,
    power(price, 2) as price_squared,
    sqrt(price) as price_sqrt,
    ln(price) as price_log
FROM products;

-- 聚合函数
SELECT 
    gender,
    count(*) as user_count,
    avg(datediff(current_date, birth_date)/365) as avg_age,
    min(register_date) as earliest_register,
    max(last_login) as latest_login,
    stddev(datediff(current_date, birth_date)/365) as age_stddev,
    percentile_approx(datediff(current_date, birth_date)/365, 0.5) as median_age
FROM users
WHERE birth_date IS NOT NULL
GROUP BY gender;
```

---

## 🔗 学习路径

### 下一步学习建议

1. **[[【技术与工具】/Hive/05-Hive表类型与设计|Hive表类型与]]** - 深入学习表设计最佳实践
2. **[[【技术与工具】/Hive/10-HiveQL高级查询|HiveQL高级查询]]** - 掌握复杂查询和分析函数
3. **[[【技术与工具】/Hive/12-用户定义函数UDF|用户定义函数UDF]]** - 学习自定义函数开发

### 实践建议

- 在实际数据集上练习各种SQL操作
- 尝试不同的数据导入导出方式
- 比较各种查询写法的性能差异
- 练习复杂的多表JOIN和窗口函数

---

## 📚 参考资料

### 官方文档
- [HiveQL Language Manual](https://cwiki.apache.org/confluence/display/Hive/LanguageManual)
- [Hive DDL](https://cwiki.apache.org/confluence/display/Hive/LanguageManual+DDL)
- [Hive DML](https://cwiki.apache.org/confluence/display/Hive/LanguageManual+DML)

---

> [!tip] 💡 关键收获
> - HiveQL基本兼容标准SQL，但有自己的扩展和限制
> - DDL操作支持丰富的表类型和存储格式选项
> - DML操作支持批量数据处理，ACID事务需要特殊配置
> - 查询语法支持复杂的分析操作，包括窗口函数和子查询
> - 数据导入导出提供多种方式，适应不同的数据源和格式

> [!warning] ⚠️ 语法注意事项
> - Hive不支持行级索引，主要依靠分区进行数据过滤
> - 某些SQL标准功能可能不支持或语法略有差异
> - 事务操作需要特定的表格式和配置
> - 性能优化需要理解Hive的执行机制 