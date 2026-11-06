---
title: Oracle银行数仓架构设计
tags:
  - 技术工具
  - Oracle
date: 2026-03-22
difficulty: 高级
duration: 60分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据治理工程师
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-22
updated: 2026-10-10
---


# Oracle银行数仓架构设计

## 银行数据仓库概述

银行数据仓库是支撑银行业务决策、风险管控、监管报告的核心基础设施。Oracle作为银行业主流数据库平台，在构建企业级数据仓库方面有着丰富的技术支撑和最佳实践。

## 银行数仓整体架构

### 1. 分层架构设计

**ODS层 (Operational Data Store)**
- 数据源头：核心银行系统、信贷系统、风控系统
- 数据特点：接近源系统结构、最小化转换
- 更新频率：实时或准实时

**DW层 (Data Warehouse)**
- 数据模型：维度建模，星型/雪花模型
- 数据特点：清洗、整合、标准化
- 更新频率：日/小时批量

**DM层 (Data Mart)**
- 面向主题：客户、产品、渠道、风险
- 数据特点：聚合、汇总、预计算
- 更新频率：日/周/月

### 2. Oracle架构组件选择

```sql
-- 创建表空间规划示例
-- ODS层表空间
CREATE TABLESPACE ODS_DATA
DATAFILE '/u01/oradata/bankdw/ods_data01.dbf' SIZE 10G
AUTOEXTEND ON NEXT 1G MAXSIZE 50G;

-- DW层表空间  
CREATE TABLESPACE DW_DATA
DATAFILE '/u01/oradata/bankdw/dw_data01.dbf' SIZE 20G
AUTOEXTEND ON NEXT 2G MAXSIZE 100G;

-- DM层表空间
CREATE TABLESPACE DM_DATA
DATAFILE '/u01/oradata/bankdw/dm_data01.dbf' SIZE 5G
AUTOEXTEND ON NEXT 500M MAXSIZE 20G;

-- 索引表空间
CREATE TABLESPACE DW_INDEX
DATAFILE '/u01/oradata/bankdw/dw_index01.dbf' SIZE 10G
AUTOEXTEND ON NEXT 1G MAXSIZE 30G;
```

## ODS层设计实现

### 1. 源系统数据接入

**核心银行系统客户表**
```sql
CREATE TABLE ods_customer_info (
    customer_id VARCHAR2(20) NOT NULL,
    customer_name VARCHAR2(100),
    id_card VARCHAR2(18),
    phone VARCHAR2(11),
    email VARCHAR2(100),
    birth_date DATE,
    gender CHAR(1),
    address VARCHAR2(200),
    postal_code VARCHAR2(6),
    education_level VARCHAR2(20),
    occupation VARCHAR2(50),
    annual_income NUMBER(15,2),
    create_time DATE,
    update_time DATE,
    source_system VARCHAR2(20) DEFAULT 'CORE_BANK',
    etl_batch_id VARCHAR2(20),
    etl_time DATE DEFAULT SYSDATE
) TABLESPACE ODS_DATA;

-- 创建分区表优化查询性能
CREATE TABLE ods_transaction_log (
    trans_id VARCHAR2(30) NOT NULL,
    account_id VARCHAR2(20),
    trans_type VARCHAR2(10),
    amount NUMBER(15,2),
    balance_after NUMBER(15,2),
    trans_time DATE,
    channel_code VARCHAR2(10),
    branch_code VARCHAR2(10),
    teller_id VARCHAR2(20),
    description VARCHAR2(200),
    source_system VARCHAR2(20),
    etl_batch_id VARCHAR2(20),
    etl_time DATE
) 
PARTITION BY RANGE (trans_time) (
    PARTITION p_202301 VALUES LESS THAN (DATE '2023-02-01'),
    PARTITION p_202302 VALUES LESS THAN (DATE '2023-03-01'),
    PARTITION p_202303 VALUES LESS THAN (DATE '2023-04-01')
) TABLESPACE ODS_DATA;
```

### 2. 数据增量抽取策略

```sql
-- 增量抽取存储过程
CREATE OR REPLACE PROCEDURE extract_customer_incremental(
    p_extract_date IN DATE DEFAULT SYSDATE
)
AS
    v_last_extract_time DATE;
    v_current_batch_id VARCHAR2(20);
    v_extracted_count NUMBER := 0;
BEGIN
    -- 生成批次ID
    v_current_batch_id := 'CUST_' || TO_CHAR(p_extract_date, 'YYYYMMDDHH24MISS');
    
    -- 获取上次抽取时间
    SELECT MAX(etl_time) INTO v_last_extract_time
    FROM ods_customer_info
    WHERE source_system = 'CORE_BANK';
    
    -- 如果是首次抽取，则抽取所有数据
    IF v_last_extract_time IS NULL THEN
        v_last_extract_time := DATE '1900-01-01';
    END IF;
    
    -- 从源系统抽取增量数据
    INSERT INTO ods_customer_info (
        customer_id, customer_name, id_card, phone, email,
        birth_date, gender, address, postal_code, education_level,
        occupation, annual_income, create_time, update_time,
        source_system, etl_batch_id, etl_time
    )
    SELECT customer_id, customer_name, id_card, phone, email,
           birth_date, gender, address, postal_code, education_level,
           occupation, annual_income, create_time, update_time,
           'CORE_BANK', v_current_batch_id, SYSDATE
    FROM core_bank.customer_info@core_bank_link
    WHERE update_time > v_last_extract_time;
    
    v_extracted_count := SQL%ROWCOUNT;
    
    COMMIT;
    
    -- 记录抽取日志
    INSERT INTO etl_log (
        batch_id, table_name, extract_type, record_count,
        start_time, end_time, status
    ) VALUES (
        v_current_batch_id, 'ods_customer_info', 'INCREMENTAL',
        v_extracted_count, SYSDATE, SYSDATE, 'SUCCESS'
    );
    
    COMMIT;
    
    DBMS_OUTPUT.PUT_LINE('客户信息增量抽取完成，抽取记录数：' || v_extracted_count);
    
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        INSERT INTO etl_log (
            batch_id, table_name, extract_type, record_count,
            start_time, end_time, status, error_message
        ) VALUES (
            v_current_batch_id, 'ods_customer_info', 'INCREMENTAL',
            0, SYSDATE, SYSDATE, 'FAILED', SQLERRM
        );
        COMMIT;
        RAISE;
END extract_customer_incremental;
/
```

## DW层维度建模

### 1. 客户维度表设计

```sql
-- 客户维度表
CREATE TABLE dim_customer (
    customer_key NUMBER(10) NOT NULL,
    customer_id VARCHAR2(20) NOT NULL,
    customer_name VARCHAR2(100),
    id_card VARCHAR2(18),
    phone VARCHAR2(11),
    email VARCHAR2(100),
    birth_date DATE,
    age NUMBER(3),
    age_group VARCHAR2(20),
    gender CHAR(1),
    gender_desc VARCHAR2(10),
    address VARCHAR2(200),
    city VARCHAR2(50),
    province VARCHAR2(50),
    postal_code VARCHAR2(6),
    education_level VARCHAR2(20),
    education_level_desc VARCHAR2(50),
    occupation VARCHAR2(50),
    occupation_category VARCHAR2(30),
    annual_income NUMBER(15,2),
    income_level VARCHAR2(20),
    customer_grade VARCHAR2(20),
    vip_flag CHAR(1),
    register_date DATE,
    first_transaction_date DATE,
    last_transaction_date DATE,
    account_count NUMBER(3),
    total_balance NUMBER(15,2),
    is_active CHAR(1),
    effective_date DATE,
    expiry_date DATE,
    current_flag CHAR(1),
    create_time DATE,
    update_time DATE
) TABLESPACE DW_DATA;

-- 创建代理键序列
CREATE SEQUENCE dim_customer_key_seq START WITH 1 INCREMENT BY 1;

-- 客户维度ETL处理
CREATE OR REPLACE PROCEDURE load_dim_customer
AS
    v_processed_count NUMBER := 0;
BEGIN
    -- 处理新增客户
    INSERT INTO dim_customer (
        customer_key, customer_id, customer_name, id_card,
        phone, email, birth_date, age, age_group, gender, gender_desc,
        address, city, province, postal_code, education_level,
        education_level_desc, occupation, occupation_category,
        annual_income, income_level, customer_grade, vip_flag,
        register_date, account_count, total_balance, is_active,
        effective_date, expiry_date, current_flag, create_time, update_time
    )
    SELECT 
        dim_customer_key_seq.NEXTVAL,
        ods.customer_id,
        ods.customer_name,
        ods.id_card,
        ods.phone,
        ods.email,
        ods.birth_date,
        FLOOR(MONTHS_BETWEEN(SYSDATE, ods.birth_date) / 12) as age,
        CASE 
            WHEN FLOOR(MONTHS_BETWEEN(SYSDATE, ods.birth_date) / 12) < 25 THEN '青年'
            WHEN FLOOR(MONTHS_BETWEEN(SYSDATE, ods.birth_date) / 12) < 45 THEN '中年'
            ELSE '老年'
        END as age_group,
        ods.gender,
        CASE ods.gender WHEN 'M' THEN '男' WHEN 'F' THEN '女' ELSE '未知' END as gender_desc,
        ods.address,
        REGEXP_SUBSTR(ods.address, '[^省]+省?([^市]+市?)') as city,
        REGEXP_SUBSTR(ods.address, '[^省]+省?') as province,
        ods.postal_code,
        ods.education_level,
        CASE ods.education_level
            WHEN 'PHD' THEN '博士'
            WHEN 'MASTER' THEN '硕士'
            WHEN 'BACHELOR' THEN '本科'
            WHEN 'COLLEGE' THEN '大专'
            WHEN 'HIGH_SCHOOL' THEN '高中'
            ELSE '其他'
        END as education_level_desc,
        ods.occupation,
        get_occupation_category(ods.occupation) as occupation_category,
        ods.annual_income,
        CASE 
            WHEN ods.annual_income >= 1000000 THEN '高收入'
            WHEN ods.annual_income >= 200000 THEN '中高收入'
            WHEN ods.annual_income >= 100000 THEN '中等收入'
            WHEN ods.annual_income >= 50000 THEN '中低收入'
            ELSE '低收入'
        END as income_level,
        'BRONZE' as customer_grade, -- 初始等级
        'N' as vip_flag,
        ods.create_time as register_date,
        0 as account_count,
        0 as total_balance,
        'Y' as is_active,
        SYSDATE as effective_date,
        DATE '9999-12-31' as expiry_date,
        'Y' as current_flag,
        SYSDATE as create_time,
        SYSDATE as update_time
    FROM ods_customer_info ods
    WHERE NOT EXISTS (
        SELECT 1 FROM dim_customer dim 
        WHERE dim.customer_id = ods.customer_id 
        AND dim.current_flag = 'Y'
    );
    
    v_processed_count := SQL%ROWCOUNT;
    
    -- 处理客户信息变更（SCD Type 2）
    -- 先关闭旧记录
    UPDATE dim_customer 
    SET expiry_date = SYSDATE - 1/86400,
        current_flag = 'N',
        update_time = SYSDATE
    WHERE customer_id IN (
        SELECT ods.customer_id
        FROM ods_customer_info ods
        JOIN dim_customer dim ON ods.customer_id = dim.customer_id
        WHERE dim.current_flag = 'Y'
        AND (ods.customer_name != dim.customer_name
             OR ods.phone != dim.phone
             OR ods.email != dim.email
             OR ods.address != dim.address)
    );
    
    -- 插入新版本记录
    INSERT INTO dim_customer (
        customer_key, customer_id, customer_name, id_card,
        phone, email, birth_date, age, age_group, gender, gender_desc,
        address, city, province, postal_code, education_level,
        education_level_desc, occupation, occupation_category,
        annual_income, income_level, customer_grade, vip_flag,
        register_date, account_count, total_balance, is_active,
        effective_date, expiry_date, current_flag, create_time, update_time
    )
    SELECT 
        dim_customer_key_seq.NEXTVAL,
        ods.customer_id,
        ods.customer_name,
        ods.id_card,
        ods.phone,
        ods.email,
        ods.birth_date,
        FLOOR(MONTHS_BETWEEN(SYSDATE, ods.birth_date) / 12) as age,
        CASE 
            WHEN FLOOR(MONTHS_BETWEEN(SYSDATE, ods.birth_date) / 12) < 25 THEN '青年'
            WHEN FLOOR(MONTHS_BETWEEN(SYSDATE, ods.birth_date) / 12) < 45 THEN '中年'
            ELSE '老年'
        END as age_group,
        ods.gender,
        CASE ods.gender WHEN 'M' THEN '男' WHEN 'F' THEN '女' ELSE '未知' END as gender_desc,
        ods.address,
        REGEXP_SUBSTR(ods.address, '[^省]+省?([^市]+市?)') as city,
        REGEXP_SUBSTR(ods.address, '[^省]+省?') as province,
        ods.postal_code,
        ods.education_level,
        CASE ods.education_level
            WHEN 'PHD' THEN '博士'
            WHEN 'MASTER' THEN '硕士'
            WHEN 'BACHELOR' THEN '本科'
            WHEN 'COLLEGE' THEN '大专'
            WHEN 'HIGH_SCHOOL' THEN '高中'
            ELSE '其他'
        END as education_level_desc,
        ods.occupation,
        get_occupation_category(ods.occupation) as occupation_category,
        ods.annual_income,
        CASE 
            WHEN ods.annual_income >= 1000000 THEN '高收入'
            WHEN ods.annual_income >= 200000 THEN '中高收入'
            WHEN ods.annual_income >= 100000 THEN '中等收入'
            WHEN ods.annual_income >= 50000 THEN '中低收入'
            ELSE '低收入'
        END as income_level,
        dim_old.customer_grade,
        dim_old.vip_flag,
        dim_old.register_date,
        dim_old.account_count,
        dim_old.total_balance,
        'Y' as is_active,
        SYSDATE as effective_date,
        DATE '9999-12-31' as expiry_date,
        'Y' as current_flag,
        SYSDATE as create_time,
        SYSDATE as update_time
    FROM ods_customer_info ods
    JOIN dim_customer dim_old ON ods.customer_id = dim_old.customer_id
    WHERE dim_old.current_flag = 'N'
    AND dim_old.expiry_date = SYSDATE - 1/86400;
    
    COMMIT;
    
    DBMS_OUTPUT.PUT_LINE('客户维度表加载完成，处理记录数：' || v_processed_count);
    
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END load_dim_customer;
/
```

### 2. 时间维度表设计

```sql
-- 时间维度表
CREATE TABLE dim_date (
    date_key NUMBER(8) NOT NULL,
    full_date DATE NOT NULL,
    year_num NUMBER(4),
    quarter_num NUMBER(1),
    quarter_name VARCHAR2(10),
    month_num NUMBER(2),
    month_name VARCHAR2(20),
    month_short_name VARCHAR2(10),
    day_num NUMBER(2),
    day_name VARCHAR2(20),
    day_short_name VARCHAR2(10),
    day_of_week NUMBER(1),
    day_of_month NUMBER(2),
    day_of_quarter NUMBER(3),
    day_of_year NUMBER(3),
    week_of_month NUMBER(1),
    week_of_quarter NUMBER(2),
    week_of_year NUMBER(2),
    is_weekend CHAR(1),
    is_holiday CHAR(1),
    holiday_name VARCHAR2(50),
    is_workday CHAR(1),
    fiscal_year NUMBER(4),
    fiscal_quarter NUMBER(1),
    fiscal_month NUMBER(2)
) TABLESPACE DW_DATA;

-- 时间维度数据生成
CREATE OR REPLACE PROCEDURE populate_dim_date(
    p_start_date IN DATE,
    p_end_date IN DATE
)
AS
    v_date DATE := p_start_date;
BEGIN
    WHILE v_date <= p_end_date LOOP
        INSERT INTO dim_date VALUES (
            TO_NUMBER(TO_CHAR(v_date, 'YYYYMMDD')), -- date_key
            v_date, -- full_date
            EXTRACT(YEAR FROM v_date), -- year_num
            CEIL(EXTRACT(MONTH FROM v_date) / 3), -- quarter_num
            'Q' || CEIL(EXTRACT(MONTH FROM v_date) / 3), -- quarter_name
            EXTRACT(MONTH FROM v_date), -- month_num
            TO_CHAR(v_date, 'MONTH', 'NLS_DATE_LANGUAGE=SIMPLIFIED CHINESE'), -- month_name
            TO_CHAR(v_date, 'MON', 'NLS_DATE_LANGUAGE=SIMPLIFIED CHINESE'), -- month_short_name
            EXTRACT(DAY FROM v_date), -- day_num
            TO_CHAR(v_date, 'DAY', 'NLS_DATE_LANGUAGE=SIMPLIFIED CHINESE'), -- day_name
            TO_CHAR(v_date, 'DY', 'NLS_DATE_LANGUAGE=SIMPLIFIED CHINESE'), -- day_short_name
            TO_NUMBER(TO_CHAR(v_date, 'D')), -- day_of_week
            EXTRACT(DAY FROM v_date), -- day_of_month
            v_date - TRUNC(v_date, 'Q') + 1, -- day_of_quarter
            TO_NUMBER(TO_CHAR(v_date, 'DDD')), -- day_of_year
            CEIL(EXTRACT(DAY FROM v_date) / 7), -- week_of_month
            CEIL((v_date - TRUNC(v_date, 'Q') + 1) / 7), -- week_of_quarter
            TO_NUMBER(TO_CHAR(v_date, 'WW')), -- week_of_year
            CASE WHEN TO_CHAR(v_date, 'D') IN ('1', '7') THEN 'Y' ELSE 'N' END, -- is_weekend
            'N', -- is_holiday (需要根据实际情况更新)
            NULL, -- holiday_name
            CASE WHEN TO_CHAR(v_date, 'D') NOT IN ('1', '7') THEN 'Y' ELSE 'N' END, -- is_workday
            CASE WHEN EXTRACT(MONTH FROM v_date) >= 1 THEN EXTRACT(YEAR FROM v_date) 
                 ELSE EXTRACT(YEAR FROM v_date) - 1 END, -- fiscal_year
            CASE WHEN EXTRACT(MONTH FROM v_date) BETWEEN 1 AND 3 THEN 1
                 WHEN EXTRACT(MONTH FROM v_date) BETWEEN 4 AND 6 THEN 2
                 WHEN EXTRACT(MONTH FROM v_date) BETWEEN 7 AND 9 THEN 3
                 ELSE 4 END, -- fiscal_quarter
            EXTRACT(MONTH FROM v_date) -- fiscal_month（此示例按自然年设置财务月份）
        );
        
        v_date := v_date + 1;
    END LOOP;
    
    COMMIT;
END populate_dim_date;
/
```

### 3. 事实表设计

```sql
-- 交易事实表
CREATE TABLE fact_transaction (
    trans_key NUMBER(15) NOT NULL,
    trans_id VARCHAR2(30) NOT NULL,
    customer_key NUMBER(10),
    account_key NUMBER(10),
    product_key NUMBER(10),
    channel_key NUMBER(10),
    branch_key NUMBER(10),
    date_key NUMBER(8),
    time_key NUMBER(6),
    trans_type_key NUMBER(5),
    amount NUMBER(15,2),
    balance_before NUMBER(15,2),
    balance_after NUMBER(15,2),
    fee_amount NUMBER(10,2),
    trans_count NUMBER DEFAULT 1,
    create_time DATE
) 
PARTITION BY RANGE (date_key) (
    PARTITION p_202301 VALUES LESS THAN (20230201),
    PARTITION p_202302 VALUES LESS THAN (20230301),
    PARTITION p_202303 VALUES LESS THAN (20230401)
) TABLESPACE DW_DATA;

-- 客户账户余额快照事实表
CREATE TABLE fact_account_balance_daily (
    balance_key NUMBER(15) NOT NULL,
    customer_key NUMBER(10),
    account_key NUMBER(10),
    product_key NUMBER(10),
    date_key NUMBER(8),
    balance_amount NUMBER(15,2),
    available_balance NUMBER(15,2),
    frozen_amount NUMBER(15,2),
    interest_amount NUMBER(15,2),
    daily_deposit_amount NUMBER(15,2),
    daily_withdraw_amount NUMBER(15,2),
    daily_trans_count NUMBER(5),
    account_age_days NUMBER(10),
    create_time DATE
) 
PARTITION BY RANGE (date_key) (
    PARTITION p_202301 VALUES LESS THAN (20230201),
    PARTITION p_202302 VALUES LESS THAN (20230301),
    PARTITION p_202303 VALUES LESS THAN (20230401)
) TABLESPACE DW_DATA;
```

## DM层数据集市

### 1. 客户分析数据集市

```sql
-- 客户价值分析汇总表
CREATE TABLE dm_customer_value_analysis (
    customer_id VARCHAR2(20),
    customer_name VARCHAR2(100),
    analysis_date DATE,
    total_assets NUMBER(15,2),
    total_liabilities NUMBER(15,2),
    net_worth NUMBER(15,2),
    monthly_avg_balance NUMBER(15,2),
    monthly_transaction_count NUMBER(8),
    monthly_transaction_amount NUMBER(15,2),
    product_count NUMBER(3),
    relationship_score NUMBER(5,2),
    profitability_score NUMBER(5,2),
    risk_score NUMBER(5,2),
    customer_lifetime_value NUMBER(15,2),
    customer_segment VARCHAR2(20),
    next_best_action VARCHAR2(100),
    create_time DATE
) TABLESPACE DM_DATA;

-- 客户行为分析汇总表
CREATE TABLE dm_customer_behavior_analysis (
    customer_id VARCHAR2(20),
    analysis_month VARCHAR2(7), -- YYYY-MM
    login_frequency NUMBER(5),
    transaction_frequency NUMBER(8),
    channel_preference VARCHAR2(20),
    transaction_time_pattern VARCHAR2(50),
    product_usage_pattern VARCHAR2(100),
    risk_behavior_score NUMBER(5,2),
    churn_probability NUMBER(5,4),
    cross_sell_opportunity VARCHAR2(200),
    create_time DATE
) TABLESPACE DM_DATA;
```

### 2. 数据集市ETL实现

```sql
-- 客户价值分析ETL
CREATE OR REPLACE PROCEDURE load_dm_customer_value_analysis(
    p_analysis_date IN DATE DEFAULT SYSDATE
)
AS
    v_analysis_month VARCHAR2(7) := TO_CHAR(p_analysis_date, 'YYYY-MM');
BEGIN
    -- 删除当月已有数据
    DELETE FROM dm_customer_value_analysis 
    WHERE TO_CHAR(analysis_date, 'YYYY-MM') = v_analysis_month;
    
    -- 插入客户价值分析数据
    INSERT INTO dm_customer_value_analysis (
        customer_id, customer_name, analysis_date,
        total_assets, total_liabilities, net_worth,
        monthly_avg_balance, monthly_transaction_count, monthly_transaction_amount,
        product_count, relationship_score, profitability_score, risk_score,
        customer_lifetime_value, customer_segment, next_best_action, create_time
    )
    WITH customer_assets AS (
        SELECT 
            dc.customer_id,
            dc.customer_name,
            SUM(CASE WHEN ap.product_type IN ('SAVINGS', 'CURRENT', 'FIXED') 
                     THEN fab.balance_amount ELSE 0 END) as total_assets,
            SUM(CASE WHEN ap.product_type = 'LOAN' 
                     THEN fab.balance_amount ELSE 0 END) as total_liabilities,
            AVG(fab.balance_amount) as monthly_avg_balance,
            SUM(fab.daily_trans_count) as monthly_transaction_count,
            SUM(fab.daily_deposit_amount + fab.daily_withdraw_amount) as monthly_transaction_amount,
            COUNT(DISTINCT ap.product_key) as product_count
        FROM dim_customer dc
        JOIN fact_account_balance_daily fab ON dc.customer_key = fab.customer_key
        JOIN dim_account_product ap ON fab.product_key = ap.product_key
        JOIN dim_date dd ON fab.date_key = dd.date_key
        WHERE dc.current_flag = 'Y'
        AND dd.year_num = EXTRACT(YEAR FROM p_analysis_date)
        AND dd.month_num = EXTRACT(MONTH FROM p_analysis_date)
        GROUP BY dc.customer_id, dc.customer_name
    )
    SELECT 
        ca.customer_id,
        ca.customer_name,
        p_analysis_date as analysis_date,
        ca.total_assets,
        ca.total_liabilities,
        ca.total_assets - ca.total_liabilities as net_worth,
        ca.monthly_avg_balance,
        ca.monthly_transaction_count,
        ca.monthly_transaction_amount,
        ca.product_count,
        -- 关系评分计算
        LEAST(100, ca.product_count * 20 + 
              CASE WHEN ca.monthly_transaction_count > 50 THEN 40
                   WHEN ca.monthly_transaction_count > 20 THEN 30
                   WHEN ca.monthly_transaction_count > 10 THEN 20
                   ELSE 10 END) as relationship_score,
        -- 盈利能力评分
        LEAST(100, CASE WHEN ca.monthly_avg_balance >= 100000 THEN 80
                       WHEN ca.monthly_avg_balance >= 50000 THEN 60
                       WHEN ca.monthly_avg_balance >= 10000 THEN 40
                       ELSE 20 END +
                   CASE WHEN ca.monthly_transaction_amount >= 50000 THEN 20
                        WHEN ca.monthly_transaction_amount >= 20000 THEN 15
                        WHEN ca.monthly_transaction_amount >= 5000 THEN 10
                        ELSE 5 END) as profitability_score,
        -- 风险评分（简化版本）
        CASE WHEN ca.total_liabilities / NULLIF(ca.total_assets, 0) > 0.8 THEN 80
             WHEN ca.total_liabilities / NULLIF(ca.total_assets, 0) > 0.6 THEN 60
             WHEN ca.total_liabilities / NULLIF(ca.total_assets, 0) > 0.4 THEN 40
             ELSE 20 END as risk_score,
        -- 客户生命周期价值（简化计算）
        ca.monthly_avg_balance * 0.02 * 12 as customer_lifetime_value,
        -- 客户分群
        CASE WHEN ca.total_assets >= 1000000 THEN 'VIP'
             WHEN ca.total_assets >= 100000 THEN 'HIGH_VALUE'
             WHEN ca.total_assets >= 10000 THEN 'MEDIUM_VALUE'
             ELSE 'LOW_VALUE' END as customer_segment,
        -- 下一步最佳行动
        CASE WHEN ca.product_count = 1 THEN '推荐理财产品'
             WHEN ca.monthly_transaction_count < 5 THEN '提升活跃度'
             WHEN ca.total_assets > 500000 AND ca.product_count < 3 THEN '推荐投资产品'
             ELSE '维护关系' END as next_best_action,
        SYSDATE as create_time
    FROM customer_assets ca;
    
    COMMIT;
    
    DBMS_OUTPUT.PUT_LINE('客户价值分析数据加载完成');
    
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END load_dm_customer_value_analysis;
/
```

## 性能优化策略

### 1. 分区策略

```sql
-- 按日期范围分区的大表
ALTER TABLE fact_transaction ADD PARTITION p_202304 
VALUES LESS THAN (20230501);

-- 子分区策略（按日期和客户分区）
CREATE TABLE fact_transaction_subpart (
    trans_key NUMBER(15),
    customer_id VARCHAR2(20),
    trans_date DATE,
    amount NUMBER(15,2)
)
PARTITION BY RANGE (trans_date)
SUBPARTITION BY HASH (customer_id) SUBPARTITIONS 4
(
    PARTITION p_2023_q1 VALUES LESS THAN (DATE '2023-04-01'),
    PARTITION p_2023_q2 VALUES LESS THAN (DATE '2023-07-01')
);
```

### 2. 索引优化

```sql
-- 创建位图索引用于数据仓库查询
CREATE BITMAP INDEX idx_customer_gender_bitmap 
ON dim_customer(gender) TABLESPACE DW_INDEX;

CREATE BITMAP INDEX idx_customer_age_group_bitmap 
ON dim_customer(age_group) TABLESPACE DW_INDEX;

-- 创建复合索引支持常用查询
CREATE INDEX idx_fact_trans_cust_date 
ON fact_transaction(customer_key, date_key) TABLESPACE DW_INDEX;

-- 创建函数索引
CREATE INDEX idx_customer_upper_name 
ON dim_customer(UPPER(customer_name)) TABLESPACE DW_INDEX;
```

### 3. 物化视图

```sql
-- 创建汇总物化视图
CREATE MATERIALIZED VIEW mv_customer_monthly_summary
BUILD IMMEDIATE
REFRESH FAST ON DEMAND
AS
SELECT 
    dc.customer_id,
    dd.year_num,
    dd.month_num,
    SUM(ft.amount) as total_amount,
    COUNT(*) as trans_count,
    AVG(ft.amount) as avg_amount
FROM fact_transaction ft
JOIN dim_customer dc ON ft.customer_key = dc.customer_key
JOIN dim_date dd ON ft.date_key = dd.date_key
WHERE dc.current_flag = 'Y'
GROUP BY dc.customer_id, dd.year_num, dd.month_num;

-- 创建物化视图日志以支持快速刷新
CREATE MATERIALIZED VIEW LOG ON fact_transaction 
WITH ROWID, SEQUENCE (customer_key, date_key, amount);
```

银行数据仓库的设计需要综合考虑业务需求、数据质量、性能要求和监管合规等多个方面。Oracle提供了丰富的技术特性来支撑大规模银行数据仓库的建设和运维。