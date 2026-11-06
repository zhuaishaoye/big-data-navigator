---
title: Oracle银行业务建模
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
  - 银行业务数据建模人员
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-22
updated: 2026-10-10
---


# Oracle银行业务建模

## 银行业务模型概述

银行业务建模是将复杂的银行业务流程、数据关系和业务规则转化为数据库模型的过程。在Oracle数据库中实现银行业务建模需要深入理解银行核心业务，合理设计表结构，确保数据完整性和业务规则的正确实施。

## 银行核心业务理解

### 1. 银行基础业务概念

**客户关系管理**
- 个人客户 vs 企业客户
- 客户等级和分类
- 客户生命周期管理

**账户体系**
- 储蓄账户、活期账户、定期账户
- 信用卡账户、贷款账户
- 账户状态管理

**产品体系**
- 存款产品、贷款产品、理财产品
- 产品定价和费率管理
- 产品组合销售

### 2. 银行业务流程

```sql
-- 银行客户开户流程建模
CREATE OR REPLACE PROCEDURE customer_account_opening(
    p_customer_info IN customer_info_type,
    p_account_info IN account_info_type,
    p_initial_deposit IN NUMBER,
    p_result OUT VARCHAR2
)
AS
    v_customer_id VARCHAR2(20);
    v_account_id VARCHAR2(20);
    v_risk_level VARCHAR2(10);
BEGIN
    -- 1. 客户身份验证和反洗钱检查
    validate_customer_identity(p_customer_info, p_result);
    IF p_result != 'SUCCESS' THEN
        RETURN;
    END IF;
    
    -- 2. 客户风险评级
    assess_customer_risk(p_customer_info, v_risk_level);
    
    -- 3. 创建客户记录
    v_customer_id := generate_customer_id();
    INSERT INTO customer_info (
        customer_id, customer_name, id_card, phone, email,
        birth_date, gender, address, risk_level, create_time, status
    ) VALUES (
        v_customer_id, p_customer_info.customer_name, p_customer_info.id_card,
        p_customer_info.phone, p_customer_info.email, p_customer_info.birth_date,
        p_customer_info.gender, p_customer_info.address, v_risk_level, SYSDATE, 'ACTIVE'
    );
    
    -- 4. 创建账户记录
    v_account_id := generate_account_id(p_account_info.account_type);
    INSERT INTO account_info (
        account_id, customer_id, account_type, currency_code,
        balance, available_balance, open_date, status, branch_code
    ) VALUES (
        v_account_id, v_customer_id, p_account_info.account_type, 'CNY',
        p_initial_deposit, p_initial_deposit, SYSDATE, 'ACTIVE', p_account_info.branch_code
    );
    
    -- 5. 记录初始存款交易
    IF p_initial_deposit > 0 THEN
        INSERT INTO transaction_log (
            trans_id, account_id, trans_type, amount, balance_after,
            trans_time, channel_code, description, status
        ) VALUES (
            generate_trans_id(), v_account_id, 'INITIAL_DEPOSIT', p_initial_deposit,
            p_initial_deposit, SYSDATE, 'BRANCH', '开户初始存款', 'SUCCESS'
        );
    END IF;
    
    -- 6. 客户关系建立
    INSERT INTO customer_account_relationship (
        customer_id, account_id, relationship_type, create_time
    ) VALUES (
        v_customer_id, v_account_id, 'PRIMARY_HOLDER', SYSDATE
    );
    
    COMMIT;
    p_result := 'SUCCESS|' || v_customer_id || '|' || v_account_id;
    
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        p_result := 'ERROR: ' || SQLERRM;
END customer_account_opening;
/
```

## 客户、账户、交易建模

### 1. 客户信息模型

```sql
-- 个人客户信息表
CREATE TABLE individual_customer (
    customer_id VARCHAR2(20) PRIMARY KEY,
    customer_name VARCHAR2(100) NOT NULL,
    id_card VARCHAR2(18) UNIQUE,
    phone VARCHAR2(11),
    email VARCHAR2(100),
    birth_date DATE,
    gender CHAR(1) CHECK (gender IN ('M', 'F')),
    nationality VARCHAR2(50) DEFAULT '中国',
    education_level VARCHAR2(20),
    occupation VARCHAR2(50),
    annual_income NUMBER(15,2),
    marital_status VARCHAR2(20),
    address VARCHAR2(200),
    postal_code VARCHAR2(6),
    emergency_contact_name VARCHAR2(100),
    emergency_contact_phone VARCHAR2(11),
    risk_tolerance VARCHAR2(20),
    customer_grade VARCHAR2(20) DEFAULT 'BRONZE',
    kyc_status VARCHAR2(20) DEFAULT 'PENDING',
    kyc_date DATE,
    register_date DATE DEFAULT SYSDATE,
    last_update_date DATE DEFAULT SYSDATE,
    status VARCHAR2(20) DEFAULT 'ACTIVE'
);

-- 企业客户信息表
CREATE TABLE corporate_customer (
    customer_id VARCHAR2(20) PRIMARY KEY,
    company_name VARCHAR2(200) NOT NULL,
    registered_name VARCHAR2(200),
    business_license VARCHAR2(50) UNIQUE,
    tax_id VARCHAR2(50),
    legal_representative VARCHAR2(100),
    registered_capital NUMBER(20,2),
    establishment_date DATE,
    business_scope VARCHAR2(1000),
    industry_code VARCHAR2(20),
    company_type VARCHAR2(50),
    registered_address VARCHAR2(200),
    business_address VARCHAR2(200),
    contact_person VARCHAR2(100),
    contact_phone VARCHAR2(11),
    contact_email VARCHAR2(100),
    annual_revenue NUMBER(20,2),
    employee_count NUMBER(8),
    credit_rating VARCHAR2(20),
    risk_level VARCHAR2(20),
    relationship_manager VARCHAR2(50),
    register_date DATE DEFAULT SYSDATE,
    last_update_date DATE DEFAULT SYSDATE,
    status VARCHAR2(20) DEFAULT 'ACTIVE'
);

-- 客户关系表（支持多重关系）
CREATE TABLE customer_relationship (
    relationship_id VARCHAR2(20) PRIMARY KEY,
    primary_customer_id VARCHAR2(20),
    related_customer_id VARCHAR2(20),
    relationship_type VARCHAR2(50), -- SPOUSE, CHILD, PARENT, BUSINESS_PARTNER, GUARANTOR
    start_date DATE DEFAULT SYSDATE,
    end_date DATE,
    notes VARCHAR2(500),
    create_time DATE DEFAULT SYSDATE,
    FOREIGN KEY (primary_customer_id) REFERENCES individual_customer(customer_id),
    FOREIGN KEY (related_customer_id) REFERENCES individual_customer(customer_id)
);
```

### 2. 产品和账户模型

```sql
-- 银行产品目录表
CREATE TABLE bank_product_catalog (
    product_id VARCHAR2(20) PRIMARY KEY,
    product_name VARCHAR2(100) NOT NULL,
    product_type VARCHAR2(50), -- SAVINGS, CURRENT, FIXED_DEPOSIT, LOAN, CREDIT_CARD, WEALTH_MANAGEMENT
    product_category VARCHAR2(50),
    currency_code VARCHAR2(3) DEFAULT 'CNY',
    min_balance NUMBER(15,2) DEFAULT 0,
    min_deposit_amount NUMBER(15,2) DEFAULT 0,
    max_balance NUMBER(20,2),
    interest_rate NUMBER(8,6),
    fee_structure VARCHAR2(1000), -- JSON格式存储费用结构
    term_months NUMBER(4), -- 产品期限（月）
    risk_level VARCHAR2(20),
    target_customer_type VARCHAR2(50), -- INDIVIDUAL, CORPORATE, VIP
    is_active CHAR(1) DEFAULT 'Y',
    launch_date DATE,
    discontinue_date DATE,
    description VARCHAR2(1000),
    create_time DATE DEFAULT SYSDATE,
    update_time DATE DEFAULT SYSDATE
);

-- 账户信息表
CREATE TABLE account_info (
    account_id VARCHAR2(20) PRIMARY KEY,
    customer_id VARCHAR2(20) NOT NULL,
    product_id VARCHAR2(20) NOT NULL,
    account_name VARCHAR2(100),
    account_type VARCHAR2(50),
    currency_code VARCHAR2(3) DEFAULT 'CNY',
    balance NUMBER(20,2) DEFAULT 0,
    available_balance NUMBER(20,2) DEFAULT 0,
    frozen_amount NUMBER(20,2) DEFAULT 0,
    overdraft_limit NUMBER(15,2) DEFAULT 0,
    credit_limit NUMBER(15,2) DEFAULT 0,
    interest_rate NUMBER(8,6),
    maturity_date DATE, -- 定期产品到期日
    open_date DATE DEFAULT SYSDATE,
    last_trans_date DATE,
    last_interest_date DATE,
    branch_code VARCHAR2(10),
    account_manager VARCHAR2(50),
    status VARCHAR2(20) DEFAULT 'ACTIVE', -- ACTIVE, FROZEN, CLOSED, DORMANT
    close_date DATE,
    close_reason VARCHAR2(100),
    create_time DATE DEFAULT SYSDATE,
    update_time DATE DEFAULT SYSDATE,
    FOREIGN KEY (customer_id) REFERENCES individual_customer(customer_id),
    FOREIGN KEY (product_id) REFERENCES bank_product_catalog(product_id)
);

-- 账户持有人关系表（支持联名账户）
CREATE TABLE account_holder_relationship (
    relationship_id VARCHAR2(20) PRIMARY KEY,
    account_id VARCHAR2(20),
    customer_id VARCHAR2(20),
    holder_type VARCHAR2(20), -- PRIMARY, SECONDARY, AUTHORIZED_USER, BENEFICIARY
    authority_level VARCHAR2(20), -- FULL, VIEW_ONLY, LIMITED_TRANSACTION
    start_date DATE DEFAULT SYSDATE,
    end_date DATE,
    create_time DATE DEFAULT SYSDATE,
    FOREIGN KEY (account_id) REFERENCES account_info(account_id),
    FOREIGN KEY (customer_id) REFERENCES individual_customer(customer_id)
);
```

### 3. 交易模型设计

```sql
-- 交易主表
CREATE TABLE transaction_master (
    trans_id VARCHAR2(30) PRIMARY KEY,
    business_date DATE NOT NULL,
    trans_time TIMESTAMP(6) DEFAULT SYSTIMESTAMP,
    trans_type VARCHAR2(20) NOT NULL, -- DEPOSIT, WITHDRAW, TRANSFER, PAYMENT, FEE
    trans_subtype VARCHAR2(30),
    amount NUMBER(20,2) NOT NULL,
    currency_code VARCHAR2(3) DEFAULT 'CNY',
    exchange_rate NUMBER(10,6) DEFAULT 1,
    channel_code VARCHAR2(20), -- ATM, MOBILE, INTERNET, BRANCH, POS
    branch_code VARCHAR2(10),
    terminal_id VARCHAR2(20),
    employee_id VARCHAR2(20),
    reference_no VARCHAR2(50), -- 外部参考号
    description VARCHAR2(200),
    status VARCHAR2(20) DEFAULT 'SUCCESS', -- PENDING, SUCCESS, FAILED, REVERSED
    reversal_flag CHAR(1) DEFAULT 'N',
    original_trans_id VARCHAR2(30), -- 冲正交易的原交易ID
    batch_id VARCHAR2(20),
    create_time DATE DEFAULT SYSDATE
);

-- 交易明细表（借贷记录）
CREATE TABLE transaction_detail (
    detail_id VARCHAR2(30) PRIMARY KEY,
    trans_id VARCHAR2(30) NOT NULL,
    account_id VARCHAR2(20) NOT NULL,
    debit_credit_flag CHAR(1) NOT NULL, -- D:借记, C:贷记
    amount NUMBER(20,2) NOT NULL,
    balance_before NUMBER(20,2),
    balance_after NUMBER(20,2),
    available_balance_before NUMBER(20,2),
    available_balance_after NUMBER(20,2),
    memo VARCHAR2(200),
    FOREIGN KEY (trans_id) REFERENCES transaction_master(trans_id),
    FOREIGN KEY (account_id) REFERENCES account_info(account_id)
);

-- 交易费用表
CREATE TABLE transaction_fee (
    fee_id VARCHAR2(30) PRIMARY KEY,
    trans_id VARCHAR2(30) NOT NULL,
    fee_type VARCHAR2(50), -- TRANSACTION_FEE, SERVICE_FEE, PENALTY_FEE
    fee_amount NUMBER(10,2) NOT NULL,
    fee_rate NUMBER(8,6),
    calculation_base NUMBER(20,2),
    fee_account_id VARCHAR2(20), -- 费用收入账户
    waiver_flag CHAR(1) DEFAULT 'N',
    waiver_reason VARCHAR2(100),
    FOREIGN KEY (trans_id) REFERENCES transaction_master(trans_id)
);
```

## 星型模型设计

### 1. 客户维度表

```sql
-- 客户维度表（包含所有客户属性）
CREATE TABLE dim_customer_star (
    customer_key NUMBER(10) PRIMARY KEY,
    customer_id VARCHAR2(20) NOT NULL,
    customer_type VARCHAR2(20), -- INDIVIDUAL, CORPORATE
    customer_name VARCHAR2(200),
    customer_short_name VARCHAR2(50),
    
    -- 个人客户属性
    gender VARCHAR2(10),
    age_group VARCHAR2(20),
    education_level VARCHAR2(50),
    occupation_category VARCHAR2(50),
    income_level VARCHAR2(30),
    marital_status VARCHAR2(20),
    
    -- 企业客户属性
    industry_category VARCHAR2(50),
    company_size VARCHAR2(20),
    business_type VARCHAR2(50),
    
    -- 地理信息
    city VARCHAR2(50),
    province VARCHAR2(50),
    region VARCHAR2(30),
    
    -- 银行关系
    customer_grade VARCHAR2(20),
    relationship_length_years NUMBER(5,2),
    primary_branch VARCHAR2(50),
    relationship_manager VARCHAR2(50),
    
    -- 生命周期管理
    is_active CHAR(1),
    risk_level VARCHAR2(20),
    kyc_status VARCHAR2(20),
    
    -- SCD支持
    effective_date DATE,
    expiry_date DATE,
    current_flag CHAR(1),
    record_version NUMBER(5),
    
    create_time DATE,
    update_time DATE
);

-- 产品维度表
CREATE TABLE dim_product_star (
    product_key NUMBER(10) PRIMARY KEY,
    product_id VARCHAR2(20) NOT NULL,
    product_name VARCHAR2(100),
    product_type VARCHAR2(50),
    product_category VARCHAR2(50),
    product_subcategory VARCHAR2(50),
    
    -- 产品特征
    currency_code VARCHAR2(3),
    risk_level VARCHAR2(20),
    liquidity_level VARCHAR2(20),
    term_type VARCHAR2(20), -- SHORT_TERM, MEDIUM_TERM, LONG_TERM
    
    -- 目标客户
    target_customer_type VARCHAR2(50),
    min_customer_grade VARCHAR2(20),
    
    -- 产品状态
    is_active CHAR(1),
    launch_date DATE,
    
    create_time DATE,
    update_time DATE
);

-- 渠道维度表
CREATE TABLE dim_channel_star (
    channel_key NUMBER(10) PRIMARY KEY,
    channel_code VARCHAR2(20) NOT NULL,
    channel_name VARCHAR2(50),
    channel_type VARCHAR2(30), -- DIGITAL, PHYSICAL, PHONE
    channel_category VARCHAR2(30), -- SELF_SERVICE, ASSISTED, AUTOMATED
    
    -- 渠道属性
    is_24x7 CHAR(1),
    supports_cash CHAR(1),
    requires_authentication CHAR(1),
    transaction_limit NUMBER(15,2),
    
    -- 成本和效率
    cost_per_transaction NUMBER(8,2),
    processing_time_minutes NUMBER(5),
    
    create_time DATE,
    update_time DATE
);
```

### 2. 事实表设计

```sql
-- 交易事实表
CREATE TABLE fact_transaction_star (
    -- 代理键
    transaction_key NUMBER(15) PRIMARY KEY,
    customer_key NUMBER(10),
    account_key NUMBER(10),
    product_key NUMBER(10),
    channel_key NUMBER(10),
    branch_key NUMBER(10),
    date_key NUMBER(8),
    time_key NUMBER(6),
    
    -- 业务键
    trans_id VARCHAR2(30) NOT NULL,
    account_id VARCHAR2(20),
    
    -- 度量值
    transaction_amount NUMBER(20,2),
    transaction_count NUMBER DEFAULT 1,
    fee_amount NUMBER(10,2),
    balance_after NUMBER(20,2),
    
    -- 半加性度量值
    daily_balance NUMBER(20,2),
    monthly_avg_balance NUMBER(20,2),
    
    -- 非加性度量值
    transaction_rate NUMBER(8,6),
    
    -- 标志和状态
    is_reversal CHAR(1) DEFAULT 'N',
    is_international CHAR(1) DEFAULT 'N',
    is_high_value CHAR(1) DEFAULT 'N',
    
    -- 审计信息
    created_date DATE,
    batch_id VARCHAR2(20)
) 
PARTITION BY RANGE (date_key) (
    PARTITION p_202301 VALUES LESS THAN (20230201),
    PARTITION p_202302 VALUES LESS THAN (20230301),
    PARTITION p_202303 VALUES LESS THAN (20230401)
);

-- 客户账户快照事实表
CREATE TABLE fact_account_snapshot_star (
    snapshot_key NUMBER(15) PRIMARY KEY,
    customer_key NUMBER(10),
    account_key NUMBER(10),
    product_key NUMBER(10),
    date_key NUMBER(8),
    
    -- 余额度量值
    end_of_day_balance NUMBER(20,2),
    available_balance NUMBER(20,2),
    frozen_amount NUMBER(20,2),
    credit_limit NUMBER(15,2),
    utilized_credit NUMBER(15,2),
    
    -- 日度活动度量值
    daily_deposits NUMBER(15,2),
    daily_withdrawals NUMBER(15,2),
    daily_transaction_count NUMBER(5),
    daily_fee_amount NUMBER(10,2),
    
    -- 累积度量值
    ytd_interest_earned NUMBER(15,2),
    ytd_fees_paid NUMBER(10,2),
    account_age_days NUMBER(10),
    
    -- 比率度量值
    utilization_ratio NUMBER(5,4),
    average_balance_30d NUMBER(20,2),
    
    created_date DATE
) 
PARTITION BY RANGE (date_key) (
    PARTITION p_202301 VALUES LESS THAN (20230201),
    PARTITION p_202302 VALUES LESS THAN (20230301),
    PARTITION p_202303 VALUES LESS THAN (20230401)
);
```

## 历史数据处理

### 1. 缓慢变化维度(SCD)处理

```sql
-- SCD Type 2 处理示例：客户信息变更
CREATE OR REPLACE PROCEDURE handle_customer_scd_type2(
    p_customer_id IN VARCHAR2,
    p_new_data IN customer_info_type
)
AS
    v_current_key NUMBER;
    v_new_key NUMBER;
BEGIN
    -- 获取当前活跃记录的代理键
    SELECT customer_key INTO v_current_key
    FROM dim_customer_star
    WHERE customer_id = p_customer_id
    AND current_flag = 'Y';
    
    -- 检查是否有实质性变更
    IF customer_data_changed(p_customer_id, p_new_data) THEN
        
        -- 关闭当前记录
        UPDATE dim_customer_star
        SET expiry_date = SYSDATE - 1/86400,
            current_flag = 'N',
            update_time = SYSDATE
        WHERE customer_key = v_current_key;
        
        -- 创建新记录
        SELECT dim_customer_key_seq.NEXTVAL INTO v_new_key FROM dual;
        
        INSERT INTO dim_customer_star (
            customer_key, customer_id, customer_name,
            gender, age_group, education_level, occupation_category,
            income_level, city, province, customer_grade,
            effective_date, expiry_date, current_flag, record_version,
            create_time, update_time
        )
        SELECT 
            v_new_key,
            p_customer_id,
            p_new_data.customer_name,
            derive_gender_desc(p_new_data.gender),
            derive_age_group(p_new_data.birth_date),
            derive_education_desc(p_new_data.education_level),
            derive_occupation_category(p_new_data.occupation),
            derive_income_level(p_new_data.annual_income),
            derive_city(p_new_data.address),
            derive_province(p_new_data.address),
            calculate_customer_grade(p_customer_id),
            SYSDATE,
            DATE '9999-12-31',
            'Y',
            NVL(MAX(record_version), 0) + 1,
            SYSDATE,
            SYSDATE
        FROM dim_customer_star
        WHERE customer_id = p_customer_id;
        
    ELSE
        -- 只更新不敏感字段
        UPDATE dim_customer_star
        SET last_transaction_date = SYSDATE,
            update_time = SYSDATE
        WHERE customer_key = v_current_key;
    END IF;
    
    COMMIT;
    
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        -- 新客户，直接插入
        insert_new_customer_dimension(p_customer_id, p_new_data);
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END handle_customer_scd_type2;
/
```

### 2. 历史数据归档策略

```sql
-- 交易数据归档处理
CREATE OR REPLACE PROCEDURE archive_transaction_data(
    p_archive_before_date IN DATE
)
AS
    v_archive_count NUMBER := 0;
    v_batch_size CONSTANT NUMBER := 10000;
    
    CURSOR c_archive_candidates IS
        SELECT trans_id, business_date
        FROM transaction_master
        WHERE business_date < p_archive_before_date
        AND status IN ('SUCCESS', 'FAILED')
        ORDER BY business_date;
BEGIN
    -- 创建归档表分区（如果不存在）
    create_archive_partition(p_archive_before_date);
    
    -- 批量归档处理
    FOR trans_rec IN c_archive_candidates LOOP
        
        -- 归档交易主记录
        INSERT INTO transaction_master_archive
        SELECT * FROM transaction_master
        WHERE trans_id = trans_rec.trans_id;
        
        -- 归档交易明细
        INSERT INTO transaction_detail_archive
        SELECT * FROM transaction_detail
        WHERE trans_id = trans_rec.trans_id;
        
        -- 归档交易费用
        INSERT INTO transaction_fee_archive
        SELECT * FROM transaction_fee
        WHERE trans_id = trans_rec.trans_id;
        
        -- 删除原始数据
        DELETE FROM transaction_fee WHERE trans_id = trans_rec.trans_id;
        DELETE FROM transaction_detail WHERE trans_id = trans_rec.trans_id;
        DELETE FROM transaction_master WHERE trans_id = trans_rec.trans_id;
        
        v_archive_count := v_archive_count + 1;
        
        -- 批量提交
        IF MOD(v_archive_count, v_batch_size) = 0 THEN
            COMMIT;
            DBMS_OUTPUT.PUT_LINE('已归档 ' || v_archive_count || ' 笔交易');
        END IF;
    END LOOP;
    
    COMMIT;
    
    -- 更新统计信息
    DBMS_STATS.GATHER_TABLE_STATS('BANK_USER', 'TRANSACTION_MASTER');
    DBMS_STATS.GATHER_TABLE_STATS('BANK_USER', 'TRANSACTION_MASTER_ARCHIVE');
    
    DBMS_OUTPUT.PUT_LINE('交易数据归档完成，总计归档 ' || v_archive_count || ' 笔交易');
    
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END archive_transaction_data;
/
```

## 业务规则实现

### 1. 客户等级评定规则

```sql
-- 客户等级评定函数示例：以下等级与金额门槛为教学假设，不代表通用银行政策
CREATE OR REPLACE FUNCTION calculate_customer_grade(
    p_customer_id IN VARCHAR2
) RETURN VARCHAR2
AS
    v_total_balance NUMBER;
    v_monthly_avg_balance NUMBER;
    v_product_count NUMBER;
    v_transaction_volume NUMBER;
    v_relationship_months NUMBER;
    v_grade VARCHAR2(20);
BEGIN
    -- 计算客户资产
    SELECT NVL(SUM(balance), 0),
           COUNT(DISTINCT product_id)
    INTO v_total_balance, v_product_count
    FROM account_info
    WHERE customer_id = p_customer_id
    AND status = 'ACTIVE';
    
    -- 计算最近6个月平均余额
    SELECT NVL(AVG(balance), 0)
    INTO v_monthly_avg_balance
    FROM account_balance_history
    WHERE customer_id = p_customer_id
    AND balance_date >= ADD_MONTHS(SYSDATE, -6);
    
    -- 计算最近12个月交易金额
    SELECT NVL(SUM(amount), 0)
    INTO v_transaction_volume
    FROM transaction_master tm
    JOIN account_info ai ON tm.account_id = ai.account_id
    WHERE ai.customer_id = p_customer_id
    AND tm.business_date >= ADD_MONTHS(SYSDATE, -12)
    AND tm.status = 'SUCCESS';
    
    -- 计算客户关系长度
    SELECT MONTHS_BETWEEN(SYSDATE, MIN(register_date))
    INTO v_relationship_months
    FROM individual_customer
    WHERE customer_id = p_customer_id;
    
    -- 综合评定等级
    IF v_total_balance >= 5000000 
       AND v_product_count >= 5 
       AND v_relationship_months >= 24 THEN
        v_grade := 'DIAMOND';
    ELSIF v_total_balance >= 1000000 
          AND (v_product_count >= 3 OR v_transaction_volume >= 1000000) THEN
        v_grade := 'PLATINUM';
    ELSIF v_total_balance >= 500000 
          OR v_monthly_avg_balance >= 100000 THEN
        v_grade := 'GOLD';
    ELSIF v_total_balance >= 100000 
          OR v_relationship_months >= 12 THEN
        v_grade := 'SILVER';
    ELSE
        v_grade := 'BRONZE';
    END IF;
    
    RETURN v_grade;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN 'UNKNOWN';
END calculate_customer_grade;
/
```

### 2. 风险控制规则

```sql
-- 大额交易监控规则示例：以下金额阈值为教学假设，不代表监管标准或机构实际规则
CREATE OR REPLACE TRIGGER trg_large_transaction_monitor
    BEFORE INSERT ON transaction_master
    FOR EACH ROW
DECLARE
    v_daily_total NUMBER;
    v_customer_id VARCHAR2(20);
    v_risk_level VARCHAR2(20);
BEGIN
    -- 只监控大额交易
    IF :NEW.amount >= 50000 THEN
        
        -- 获取客户信息
        SELECT ai.customer_id, ic.risk_level
        INTO v_customer_id, v_risk_level
        FROM account_info ai
        JOIN individual_customer ic ON ai.customer_id = ic.customer_id
        WHERE ai.account_id = :NEW.account_id;
        
        -- 计算当日累计交易金额
        SELECT NVL(SUM(amount), 0)
        INTO v_daily_total
        FROM transaction_master tm
        JOIN account_info ai ON tm.account_id = ai.account_id
        WHERE ai.customer_id = v_customer_id
        AND tm.business_date = :NEW.business_date
        AND tm.status = 'SUCCESS';
        
        -- 风险检查
        IF v_daily_total + :NEW.amount > 200000 THEN
            -- 记录风险预警
            INSERT INTO risk_alert (
                alert_id, customer_id, alert_type, alert_level,
                amount, description, create_time
            ) VALUES (
                risk_alert_seq.NEXTVAL, v_customer_id, 'LARGE_TRANSACTION', 'HIGH',
                :NEW.amount, '当日大额交易超限', SYSDATE
            );
            
            -- 高风险客户直接拒绝
            IF v_risk_level = 'HIGH' THEN
                RAISE_APPLICATION_ERROR(-20001, '高风险客户大额交易被拒绝');
            END IF;
        END IF;
    END IF;
END;
/
```

银行业务建模是一个复杂的过程，需要深入理解银行业务逻辑、监管要求和数据关系。通过Oracle的强大功能，可以构建出既满足业务需求又具备良好性能的银行业务模型。