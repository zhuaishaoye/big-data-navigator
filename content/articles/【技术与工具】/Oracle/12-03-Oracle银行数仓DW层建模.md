---
title: Oracle银行数仓DW层建模
tags:
  - 技术工具
  - Oracle
date: 2026-03-22
difficulty: 高级
duration: 45分钟
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


# Oracle银行数仓DW层建模

## 📋 概述

DW（Data Warehouse）层是银行数据仓库的核心层，采用维度建模方法，将ODS层的数据进行整合和规范化，形成面向主题的数据模型。

## 🏗️ 维度建模设计

### 1. 维度模型选择
- **星型模型**：适用于简单的分析场景
- **雪花模型**：适用于复杂的层次维度
- **星座模型**：多个事实表共享维度表

## 📊 核心维度表设计

### 1. 客户维度表
```sql
CREATE TABLE DIM_CUSTOMER (
    cust_key         NUMBER PRIMARY KEY,      -- 代理键
    cust_id          VARCHAR2(20),           -- 业务键
    cust_name        VARCHAR2(100),
    cust_type        VARCHAR2(20),
    cust_level       VARCHAR2(10),           -- 客户等级
    age_group        VARCHAR2(20),           -- 年龄段
    gender           VARCHAR2(10),
    education        VARCHAR2(20),
    occupation       VARCHAR2(50),
    income_level     VARCHAR2(20),           -- 收入水平
    region_code      VARCHAR2(10),
    region_name      VARCHAR2(50),
    branch_code      VARCHAR2(10),
    branch_name      VARCHAR2(50),
    -- SCD Type 2 字段
    effective_date   DATE,
    expiry_date      DATE,
    current_flag     VARCHAR2(1),
    version          NUMBER,
    create_date      DATE,
    update_date      DATE
);

-- 创建索引
CREATE UNIQUE INDEX idx_dim_cust_bk ON DIM_CUSTOMER (
    CASE WHEN current_flag = 'Y' THEN cust_id END
);
CREATE BITMAP INDEX idx_dim_cust_type ON DIM_CUSTOMER(cust_type);
```

### 2. 产品维度表
```sql
CREATE TABLE DIM_PRODUCT (
    product_key      NUMBER PRIMARY KEY,
    product_code     VARCHAR2(20),
    product_name     VARCHAR2(100),
    product_type     VARCHAR2(20),
    product_category VARCHAR2(50),
    product_line     VARCHAR2(50),
    risk_level       VARCHAR2(10),
    interest_rate    NUMBER(5,4),
    term_months      NUMBER,
    min_amount       NUMBER(18,2),
    max_amount       NUMBER(18,2),
    status           VARCHAR2(10),
    launch_date      DATE,
    end_date         DATE,
    create_date      DATE,
    update_date      DATE
);
```

### 3. 时间维度表
```sql
CREATE TABLE DIM_DATE (
    date_key         NUMBER PRIMARY KEY,      -- YYYYMMDD格式
    full_date        DATE,
    year             NUMBER(4),
    quarter          NUMBER(1),
    month            NUMBER(2),
    week_of_year     NUMBER(2),
    day_of_month     NUMBER(2),
    day_of_week      NUMBER(1),
    day_name         VARCHAR2(20),
    month_name       VARCHAR2(20),
    is_weekend       VARCHAR2(1),
    is_holiday       VARCHAR2(1),
    holiday_name     VARCHAR2(50),
    fiscal_year      NUMBER(4),
    fiscal_quarter   NUMBER(1),
    fiscal_month     NUMBER(2)
);

-- 生成时间维度数据
DECLARE
    v_date DATE := DATE '2020-01-01';
BEGIN
    WHILE v_date <= DATE '2030-12-31' LOOP
        INSERT INTO DIM_DATE VALUES (
            TO_NUMBER(TO_CHAR(v_date, 'YYYYMMDD')),
            v_date,
            EXTRACT(YEAR FROM v_date),
            TO_NUMBER(TO_CHAR(v_date, 'Q')),
            EXTRACT(MONTH FROM v_date),
            TO_NUMBER(TO_CHAR(v_date, 'WW')),
            EXTRACT(DAY FROM v_date),
            TO_NUMBER(TO_CHAR(v_date, 'D')),
            TO_CHAR(v_date, 'DAY'),
            TO_CHAR(v_date, 'MONTH'),
            CASE WHEN TRUNC(v_date) - TRUNC(v_date, 'IW') IN (5, 6) THEN 'Y' ELSE 'N' END,
            'N',  -- 需要单独维护节假日
            NULL,
            EXTRACT(YEAR FROM v_date),
            TO_NUMBER(TO_CHAR(v_date, 'Q')),
            EXTRACT(MONTH FROM v_date)
        );
        v_date := v_date + 1;
    END LOOP;
    COMMIT;
END;
/
```

## 📈 核心事实表设计

### 1. 账户余额事实表
```sql
CREATE TABLE FACT_ACCOUNT_BALANCE (
    date_key         NUMBER,
    cust_key         NUMBER,
    product_key      NUMBER,
    account_key      NUMBER,
    branch_key       NUMBER,
    -- 度量
    balance          NUMBER(18,2),
    available_balance NUMBER(18,2),
    frozen_amount    NUMBER(18,2),
    overdraft_limit  NUMBER(18,2),
    interest_accrued NUMBER(18,2),
    -- 审计字段
    etl_date         DATE,
    CONSTRAINT pk_fact_balance PRIMARY KEY (date_key, account_key)
) PARTITION BY RANGE (date_key)
(
    PARTITION p_202401 VALUES LESS THAN (20240201),
    PARTITION p_202402 VALUES LESS THAN (20240301)
);
```

### 2. 交易事实表
```sql
CREATE TABLE FACT_TRANSACTION (
    trans_key        NUMBER PRIMARY KEY,
    date_key         NUMBER,
    time_key         NUMBER,
    cust_key         NUMBER,
    account_key      NUMBER,
    product_key      NUMBER,
    channel_key      NUMBER,
    trans_type_key   NUMBER,
    -- 度量
    trans_amount     NUMBER(18,2),
    trans_count      NUMBER DEFAULT 1,
    fee_amount       NUMBER(18,2),
    -- 退化维度
    trans_id         VARCHAR2(32),
    reference_no     VARCHAR2(32),
    -- 审计字段
    etl_date         DATE
) PARTITION BY RANGE (date_key)
INTERVAL (1)
(
    PARTITION p_init VALUES LESS THAN (20240101)
);

-- 创建索引
CREATE BITMAP INDEX idx_fact_trans_date ON FACT_TRANSACTION(date_key) LOCAL;
CREATE BITMAP INDEX idx_fact_trans_type ON FACT_TRANSACTION(trans_type_key) LOCAL;
```

## 🔄 数据加载策略

### 1. 维度表加载（SCD Type 2）
```sql
-- 缓慢变化维度处理
MERGE INTO DIM_CUSTOMER tgt
USING (
    SELECT * FROM STG_CUSTOMER_CHANGES
) src
ON (tgt.cust_id = src.cust_id)
WHEN MATCHED THEN
    UPDATE SET 
        tgt.expiry_date = SYSDATE - 1,
        tgt.current_flag = 'N'
    WHERE tgt.current_flag = 'Y'
      AND (NVL(tgt.cust_name, 'X') != NVL(src.cust_name, 'X')
        OR NVL(tgt.cust_level, 'X') != NVL(src.cust_level, 'X'));

-- 插入新版本记录
INSERT INTO DIM_CUSTOMER
SELECT 
    SEQ_DIM_CUSTOMER.NEXTVAL,
    src.*,
    SYSDATE as effective_date,
    DATE '9999-12-31' as expiry_date,
    'Y' as current_flag,
    1 as version
FROM STG_CUSTOMER_CHANGES src;
```

### 2. 事实表加载
```sql
-- 每日批量加载
INSERT /*+ APPEND PARALLEL(8) */ INTO FACT_TRANSACTION
SELECT /*+ PARALLEL(8) */
    SEQ_FACT_TRANS.NEXTVAL,
    TO_NUMBER(TO_CHAR(trans_date, 'YYYYMMDD')) as date_key,
    TO_NUMBER(TO_CHAR(trans_date, 'HH24MISS')) as time_key,
    dc.cust_key,
    da.account_key,
    dp.product_key,
    dch.channel_key,
    dt.trans_type_key,
    trans_amount,
    1 as trans_count,
    fee_amount,
    trans_id,
    reference_no,
    SYSDATE
FROM ODS_TRANS_DETAIL otd
JOIN DIM_CUSTOMER dc ON otd.cust_id = dc.cust_id AND dc.current_flag = 'Y'
JOIN DIM_ACCOUNT da ON otd.account_no = da.account_no
JOIN DIM_PRODUCT dp ON otd.product_code = dp.product_code
JOIN DIM_CHANNEL dch ON otd.channel_code = dch.channel_code
JOIN DIM_TRANS_TYPE dt ON otd.trans_type = dt.trans_type_code
WHERE otd.trans_date >= TRUNC(SYSDATE) - 1
  AND otd.trans_date < TRUNC(SYSDATE);

COMMIT;
```

## 📊 聚合表设计

### 1. 月度汇总表
```sql
CREATE MATERIALIZED VIEW MV_MONTHLY_SUMMARY
BUILD IMMEDIATE
REFRESH COMPLETE ON DEMAND
AS
SELECT 
    TRUNC(d.full_date, 'MM') as month_date,
    c.cust_type,
    c.region_code,
    p.product_type,
    COUNT(DISTINCT f.cust_key) as cust_count,
    SUM(f.trans_amount) as total_amount,
    SUM(f.trans_count) as total_count,
    AVG(f.trans_amount) as avg_amount
FROM FACT_TRANSACTION f
JOIN DIM_DATE d ON f.date_key = d.date_key
JOIN DIM_CUSTOMER c ON f.cust_key = c.cust_key
JOIN DIM_PRODUCT p ON f.product_key = p.product_key
GROUP BY TRUNC(d.full_date, 'MM'), c.cust_type, c.region_code, p.product_type;
```

## 🔗 相关文档

- [[【技术与工具】/Oracle/12-01-Oracle银行数仓整体架构|Oracle银行数仓整体]]
- [[【技术与工具】/Oracle/12-02-Oracle银行数仓ODS层设计|Oracle银行数仓ODS层]]
- [[【技术与工具】/Oracle/12-04-Oracle银行数仓DM层设计|Oracle银行数仓DM层]]
- [[【技术与工具】/Oracle/12-05-Oracle银行数仓性能优化|Oracle银行数仓性能优化]]

## 💡 最佳实践

1. **维度一致性**：确保跨事实表的维度一致
2. **代理键使用**：使用代理键而非业务键作为主键
3. **分区策略**：合理设计分区提升查询性能
4. **物化视图**：预计算常用聚合提升响应速度

---

*DW层是数据仓库的核心，良好的维度建模是数据分析的基础*