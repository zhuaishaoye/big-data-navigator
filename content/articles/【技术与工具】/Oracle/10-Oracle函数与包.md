---
title: Oracle函数与包
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
  - 银行业务数据库开发人员
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-22
updated: 2026-10-10
---


# Oracle函数与包

## Oracle函数概述

Oracle函数是返回一个值的PL/SQL程序单元，可以接受参数；只有满足SQL调用限制、参数与返回类型兼容的函数才能在SQL语句中调用，本文含写表或提交事务的函数不能直接作为查询函数使用。在银行业务中，函数常用于数据计算、格式转换、业务规则实现等场景。

### 1. 函数的基本语法

```sql
CREATE [OR REPLACE] FUNCTION function_name
    [(parameter_name [IN | OUT | IN OUT] datatype [, ...])]
RETURN datatype
[DETERMINISTIC]
[PARALLEL_ENABLE]
AS|IS
    -- 声明部分
BEGIN
    -- 执行部分
    RETURN expression;
EXCEPTION
    -- 异常处理部分
END function_name;
```

## 银行业务函数实例

### 1. 金融计算函数

```sql
-- 复利计算函数
CREATE OR REPLACE FUNCTION calculate_compound_interest(
    p_principal IN NUMBER,      -- 本金
    p_annual_rate IN NUMBER,    -- 年利率
    p_years IN NUMBER,          -- 投资年限
    p_compound_frequency IN NUMBER DEFAULT 12  -- 复利频率(月)
) RETURN NUMBER
DETERMINISTIC
AS
    v_result NUMBER;
BEGIN
    -- 复利公式: A = P(1 + r/n)^(nt)
    v_result := p_principal * POWER(
        1 + (p_annual_rate / p_compound_frequency), 
        p_compound_frequency * p_years
    );
    
    -- 四舍五入到分
    RETURN ROUND(v_result, 2);
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END calculate_compound_interest;
/

-- 贷款月供计算函数
CREATE OR REPLACE FUNCTION calculate_monthly_payment(
    p_loan_amount IN NUMBER,    -- 贷款金额
    p_annual_rate IN NUMBER,    -- 年利率
    p_months IN NUMBER          -- 贷款月数
) RETURN NUMBER
DETERMINISTIC
AS
    v_monthly_rate NUMBER;
    v_payment NUMBER;
BEGIN
    -- 月利率
    v_monthly_rate := p_annual_rate / 12;
    
    -- 等额本息月供公式
    IF v_monthly_rate = 0 THEN
        v_payment := p_loan_amount / p_months;
    ELSE
        v_payment := p_loan_amount * v_monthly_rate * 
                    POWER(1 + v_monthly_rate, p_months) /
                    (POWER(1 + v_monthly_rate, p_months) - 1);
    END IF;
    
    RETURN ROUND(v_payment, 2);
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END calculate_monthly_payment;
/

-- 年化收益率计算函数
CREATE OR REPLACE FUNCTION calculate_annual_return(
    p_initial_value IN NUMBER,  -- 初始价值
    p_final_value IN NUMBER,    -- 最终价值
    p_days IN NUMBER            -- 投资天数
) RETURN NUMBER
DETERMINISTIC
AS
    v_annual_return NUMBER;
BEGIN
    IF p_initial_value <= 0 OR p_days <= 0 THEN
        RETURN NULL;
    END IF;
    
    -- 年化收益率 = (最终价值/初始价值)^(365/天数) - 1
    v_annual_return := POWER(p_final_value / p_initial_value, 365 / p_days) - 1;
    
    RETURN ROUND(v_annual_return * 100, 4); -- 返回百分比，保留4位小数
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END calculate_annual_return;
/

-- 使用示例
SELECT 
    calculate_compound_interest(100000, 0.05, 5, 12) as compound_interest,
    calculate_monthly_payment(300000, 0.045, 360) as monthly_payment,
    calculate_annual_return(100000, 110000, 365) as annual_return_pct
FROM dual;
```

### 2. 业务规则函数

```sql
-- 客户等级评定函数
CREATE OR REPLACE FUNCTION get_customer_grade(
    p_customer_id IN VARCHAR2
) RETURN VARCHAR2
AS
    v_total_assets NUMBER;
    v_product_count NUMBER;
    v_relationship_months NUMBER;
    v_transaction_volume NUMBER;
    v_grade VARCHAR2(20);
BEGIN
    -- 获取客户资产信息
    SELECT 
        NVL(SUM(balance), 0),
        COUNT(DISTINCT product_id)
    INTO v_total_assets, v_product_count
    FROM account_info
    WHERE customer_id = p_customer_id
    AND status = 'ACTIVE';
    
    -- 获取客户关系长度
    SELECT MONTHS_BETWEEN(SYSDATE, MIN(create_time))
    INTO v_relationship_months
    FROM customer_info
    WHERE customer_id = p_customer_id;
    
    -- 获取年交易量
    SELECT NVL(SUM(amount), 0)
    INTO v_transaction_volume
    FROM transaction_log tl
    JOIN account_info ai ON tl.account_id = ai.account_id
    WHERE ai.customer_id = p_customer_id
    AND tl.trans_time >= ADD_MONTHS(SYSDATE, -12);
    
    -- 评定等级
    IF v_total_assets >= 10000000 AND v_product_count >= 5 THEN
        v_grade := 'DIAMOND';
    ELSIF v_total_assets >= 1000000 AND v_product_count >= 3 THEN
        v_grade := 'PLATINUM';
    ELSIF v_total_assets >= 500000 OR v_transaction_volume >= 500000 THEN
        v_grade := 'GOLD';
    ELSIF v_total_assets >= 100000 OR v_relationship_months >= 24 THEN
        v_grade := 'SILVER';
    ELSE
        v_grade := 'BRONZE';
    END IF;
    
    RETURN v_grade;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN 'UNKNOWN';
    WHEN OTHERS THEN
        RETURN 'ERROR';
END get_customer_grade;
/

-- 风险评分函数
CREATE OR REPLACE FUNCTION calculate_risk_score(
    p_customer_id IN VARCHAR2
) RETURN NUMBER
AS
    v_age NUMBER;
    v_income NUMBER;
    v_debt_ratio NUMBER;
    v_overdue_count NUMBER;
    v_risk_score NUMBER := 0;
BEGIN
    -- 获取客户基本信息
    SELECT 
        FLOOR(MONTHS_BETWEEN(SYSDATE, birth_date) / 12),
        NVL(annual_income, 0)
    INTO v_age, v_income
    FROM customer_info
    WHERE customer_id = p_customer_id;
    
    -- 计算负债率
    SELECT 
        CASE 
            WHEN SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END) = 0 THEN 0
            ELSE SUM(CASE WHEN balance < 0 THEN ABS(balance) ELSE 0 END) / 
                 SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END)
        END
    INTO v_debt_ratio
    FROM account_info
    WHERE customer_id = p_customer_id;
    
    -- 计算逾期次数
    SELECT COUNT(*)
    INTO v_overdue_count
    FROM loan_overdue_history
    WHERE customer_id = p_customer_id
    AND overdue_date >= ADD_MONTHS(SYSDATE, -24);
    
    -- 风险评分计算
    -- 年龄评分 (20分)
    v_risk_score := v_risk_score + 
        CASE 
            WHEN v_age BETWEEN 25 AND 55 THEN 20
            WHEN v_age BETWEEN 18 AND 65 THEN 15
            ELSE 5
        END;
    
    -- 收入评分 (30分)
    v_risk_score := v_risk_score +
        CASE 
            WHEN v_income >= 500000 THEN 30
            WHEN v_income >= 200000 THEN 25
            WHEN v_income >= 100000 THEN 20
            WHEN v_income >= 50000 THEN 15
            ELSE 5
        END;
    
    -- 负债率评分 (30分)
    v_risk_score := v_risk_score +
        CASE 
            WHEN v_debt_ratio <= 0.3 THEN 30
            WHEN v_debt_ratio <= 0.5 THEN 20
            WHEN v_debt_ratio <= 0.7 THEN 10
            ELSE 0
        END;
    
    -- 信用记录评分 (20分)
    v_risk_score := v_risk_score +
        CASE 
            WHEN v_overdue_count = 0 THEN 20
            WHEN v_overdue_count <= 2 THEN 10
            WHEN v_overdue_count <= 5 THEN 5
            ELSE 0
        END;
    
    RETURN v_risk_score;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN 0;
    WHEN OTHERS THEN
        RETURN -1;
END calculate_risk_score;
/
```

### 3. 数据格式化函数

```sql
-- 金额格式化函数
CREATE OR REPLACE FUNCTION format_amount(
    p_amount IN NUMBER,
    p_currency IN VARCHAR2 DEFAULT 'CNY'
) RETURN VARCHAR2
DETERMINISTIC
AS
    v_formatted VARCHAR2(100);
    v_currency_symbol VARCHAR2(10);
BEGIN
    -- 获取货币符号
    v_currency_symbol := CASE p_currency
        WHEN 'CNY' THEN '¥'
        WHEN 'USD' THEN '$'
        WHEN 'EUR' THEN '€'
        WHEN 'GBP' THEN '£'
        ELSE p_currency || ' '
    END;
    
    -- 格式化金额
    IF ABS(p_amount) >= 100000000 THEN -- 亿
        v_formatted := v_currency_symbol || TO_CHAR(p_amount / 100000000, 'FM999,990.00') || '亿';
    ELSIF ABS(p_amount) >= 10000 THEN -- 万
        v_formatted := v_currency_symbol || TO_CHAR(p_amount / 10000, 'FM999,990.00') || '万';
    ELSE
        v_formatted := v_currency_symbol || TO_CHAR(p_amount, 'FM999,990.00');
    END IF;
    
    RETURN v_formatted;
EXCEPTION
    WHEN OTHERS THEN
        RETURN TO_CHAR(p_amount);
END format_amount;
/

-- 账号脱敏函数
CREATE OR REPLACE FUNCTION mask_account_number(
    p_account_number IN VARCHAR2,
    p_mask_char IN VARCHAR2 DEFAULT '*',
    p_show_first IN NUMBER DEFAULT 4,
    p_show_last IN NUMBER DEFAULT 4
) RETURN VARCHAR2
DETERMINISTIC
AS
    v_masked VARCHAR2(100);
    v_length NUMBER;
BEGIN
    v_length := LENGTH(p_account_number);
    
    IF v_length <= p_show_first + p_show_last THEN
        -- 如果账号太短，只显示部分
        RETURN SUBSTR(p_account_number, 1, 2) || 
               RPAD(p_mask_char, v_length - 2, p_mask_char);
    ELSE
        -- 正常脱敏
        v_masked := SUBSTR(p_account_number, 1, p_show_first) ||
                   RPAD(p_mask_char, v_length - p_show_first - p_show_last, p_mask_char) ||
                   SUBSTR(p_account_number, -p_show_last);
    END IF;
    
    RETURN v_masked;
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END mask_account_number;
/

-- 身份证脱敏函数
CREATE OR REPLACE FUNCTION mask_id_card(
    p_id_card IN VARCHAR2
) RETURN VARCHAR2
DETERMINISTIC
AS
BEGIN
    IF LENGTH(p_id_card) = 18 THEN
        RETURN SUBSTR(p_id_card, 1, 6) || '********' || SUBSTR(p_id_card, 15);
    ELSIF LENGTH(p_id_card) = 15 THEN
        RETURN SUBSTR(p_id_card, 1, 6) || '******' || SUBSTR(p_id_card, 13);
    ELSE
        RAISE_APPLICATION_ERROR(-20003, '身份证长度不符合本示例要求，拒绝返回原值');
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END mask_id_card;
/

-- 使用示例
SELECT 
    format_amount(1234567.89, 'CNY') as formatted_cny,
    format_amount(50000, 'USD') as formatted_usd,
    mask_account_number('6225881234567890') as masked_account,
    mask_id_card('110101199001011234') as masked_id
FROM dual;
```

## Oracle包(Package)详解

### 1. 包的基本概念

Oracle包是相关函数、存储过程、变量、常量、游标、异常的集合，分为包规范(Package Specification)和包体(Package Body)两部分。

### 2. 银行客户服务包

```sql
-- 客户服务包规范
CREATE OR REPLACE PACKAGE pkg_customer_service AS
    
    -- 公共常量
    c_max_daily_withdraw CONSTANT NUMBER := 50000;
    c_max_daily_transfer CONSTANT NUMBER := 200000;
    
    -- 公共类型
    TYPE t_account_list IS TABLE OF VARCHAR2(20);
    
    TYPE t_customer_summary IS RECORD (
        customer_id VARCHAR2(20),
        customer_name VARCHAR2(100),
        total_balance NUMBER(15,2),
        account_count NUMBER(5),
        last_transaction_date DATE
    );
    
    -- 公共异常
    e_customer_not_found EXCEPTION;
    e_account_frozen EXCEPTION;
    e_insufficient_balance EXCEPTION;
    
    -- 公共函数和过程声明
    FUNCTION get_customer_summary(
        p_customer_id IN VARCHAR2
    ) RETURN t_customer_summary;
    
    FUNCTION validate_transaction_limit(
        p_customer_id IN VARCHAR2,
        p_trans_type IN VARCHAR2,
        p_amount IN NUMBER
    ) RETURN BOOLEAN;
    
    PROCEDURE update_customer_info(
        p_customer_id IN VARCHAR2,
        p_phone IN VARCHAR2 DEFAULT NULL,
        p_email IN VARCHAR2 DEFAULT NULL,
        p_address IN VARCHAR2 DEFAULT NULL
    );
    
    PROCEDURE freeze_account(
        p_account_id IN VARCHAR2,
        p_reason IN VARCHAR2
    );
    
    PROCEDURE unfreeze_account(
        p_account_id IN VARCHAR2
    );
    
    FUNCTION get_customer_accounts(
        p_customer_id IN VARCHAR2
    ) RETURN t_account_list PIPELINED;
    
END pkg_customer_service;
/

-- 客户服务包体
CREATE OR REPLACE PACKAGE BODY pkg_customer_service AS
    
    -- 私有变量
    g_package_version CONSTANT VARCHAR2(10) := '1.0.0';
    g_debug_mode BOOLEAN := FALSE;
    
    -- 私有函数
    FUNCTION log_debug(p_message VARCHAR2) RETURN BOOLEAN AS
    BEGIN
        IF g_debug_mode THEN
            DBMS_OUTPUT.PUT_LINE('[DEBUG] ' || TO_CHAR(SYSDATE, 'HH24:MI:SS') || ' - ' || p_message);
        END IF;
        RETURN TRUE;
    END log_debug;
    
    -- 公共函数实现
    FUNCTION get_customer_summary(
        p_customer_id IN VARCHAR2
    ) RETURN t_customer_summary AS
        v_summary t_customer_summary;
    BEGIN
        -- 获取客户基本信息
        SELECT customer_id, customer_name
        INTO v_summary.customer_id, v_summary.customer_name
        FROM customer_info
        WHERE customer_id = p_customer_id;
        
        -- 获取账户汇总信息
        SELECT 
            NVL(SUM(balance), 0),
            COUNT(*),
            MAX(last_trans_date)
        INTO 
            v_summary.total_balance,
            v_summary.account_count,
            v_summary.last_transaction_date
        FROM account_info
        WHERE customer_id = p_customer_id
        AND status = 'ACTIVE';
        
        RETURN v_summary;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RAISE e_customer_not_found;
        WHEN OTHERS THEN
            RAISE;
    END get_customer_summary;
    
    FUNCTION validate_transaction_limit(
        p_customer_id IN VARCHAR2,
        p_trans_type IN VARCHAR2,
        p_amount IN NUMBER
    ) RETURN BOOLEAN AS
        v_daily_amount NUMBER;
        v_limit NUMBER;
        v_result BOOLEAN := TRUE;
    BEGIN
        -- 获取当日累计交易金额
        SELECT NVL(SUM(amount), 0)
        INTO v_daily_amount
        FROM transaction_log tl
        JOIN account_info ai ON tl.account_id = ai.account_id
        WHERE ai.customer_id = p_customer_id
        AND tl.trans_type = p_trans_type
        AND TRUNC(tl.trans_time) = TRUNC(SYSDATE)
        AND tl.status = 'SUCCESS';
        
        -- 获取限额
        v_limit := CASE p_trans_type
            WHEN 'WITHDRAW' THEN c_max_daily_withdraw
            WHEN 'TRANSFER' THEN c_max_daily_transfer
            ELSE 999999999
        END;
        
        -- 检查是否超限
        IF v_daily_amount + p_amount > v_limit THEN
            v_result := FALSE;
        END IF;
        
        -- 记录日志
        INSERT INTO transaction_limit_log (
            customer_id, trans_type, amount, daily_total, 
            limit_amount, is_approved, check_time
        ) VALUES (
            p_customer_id, p_trans_type, p_amount, v_daily_amount,
            v_limit, CASE WHEN v_result THEN 'Y' ELSE 'N' END, SYSDATE
        );
        
        COMMIT;
        RETURN v_result;
    EXCEPTION
        WHEN OTHERS THEN
            RETURN FALSE;
    END validate_transaction_limit;
    
    PROCEDURE update_customer_info(
        p_customer_id IN VARCHAR2,
        p_phone IN VARCHAR2 DEFAULT NULL,
        p_email IN VARCHAR2 DEFAULT NULL,
        p_address IN VARCHAR2 DEFAULT NULL
    ) AS
        v_old_phone VARCHAR2(11);
        v_old_email VARCHAR2(100);
        v_old_address VARCHAR2(500);
    BEGIN
        -- 获取原始信息
        SELECT phone, email, address
        INTO v_old_phone, v_old_email, v_old_address
        FROM customer_info
        WHERE customer_id = p_customer_id;
        
        -- 更新客户信息
        UPDATE customer_info SET
            phone = NVL(p_phone, phone),
            email = NVL(p_email, email),
            address = NVL(p_address, address),
            update_time = SYSDATE
        WHERE customer_id = p_customer_id;
        
        IF SQL%ROWCOUNT = 0 THEN
            RAISE e_customer_not_found;
        END IF;
        
        -- 记录变更日志
        INSERT INTO customer_change_log (
            customer_id, change_type, old_value, new_value, 
            change_time, operator
        ) VALUES (
            p_customer_id, 'CONTACT_UPDATE',
            'phone:' || v_old_phone || '|email:' || v_old_email || '|address:' || v_old_address,
            'phone:' || NVL(p_phone, v_old_phone) || '|email:' || NVL(p_email, v_old_email) || '|address:' || NVL(p_address, v_old_address),
            SYSDATE, USER
        );
        
        COMMIT;
    EXCEPTION
        WHEN e_customer_not_found THEN
            RAISE_APPLICATION_ERROR(-20001, '客户不存在');
        WHEN OTHERS THEN
            ROLLBACK;
            RAISE;
    END update_customer_info;
    
    PROCEDURE freeze_account(
        p_account_id IN VARCHAR2,
        p_reason IN VARCHAR2
    ) AS
    BEGIN
        UPDATE account_info SET
            status = 'FROZEN',
            freeze_reason = p_reason,
            freeze_time = SYSDATE
        WHERE account_id = p_account_id
        AND status = 'ACTIVE';
        
        IF SQL%ROWCOUNT = 0 THEN
            RAISE_APPLICATION_ERROR(-20002, '账户不存在或已被冻结');
        END IF;
        
        -- 记录冻结日志
        INSERT INTO account_status_log (
            account_id, status_change, reason, change_time, operator
        ) VALUES (
            p_account_id, 'ACTIVE->FROZEN', p_reason, SYSDATE, USER
        );
        
        COMMIT;
    END freeze_account;
    
    PROCEDURE unfreeze_account(
        p_account_id IN VARCHAR2
    ) AS
    BEGIN
        UPDATE account_info SET
            status = 'ACTIVE',
            freeze_reason = NULL,
            unfreeze_time = SYSDATE
        WHERE account_id = p_account_id
        AND status = 'FROZEN';
        
        IF SQL%ROWCOUNT = 0 THEN
            RAISE_APPLICATION_ERROR(-20003, '账户不存在或未被冻结');
        END IF;
        
        -- 记录解冻日志
        INSERT INTO account_status_log (
            account_id, status_change, reason, change_time, operator
        ) VALUES (
            p_account_id, 'FROZEN->ACTIVE', '解冻', SYSDATE, USER
        );
        
        COMMIT;
    END unfreeze_account;
    
    FUNCTION get_customer_accounts(
        p_customer_id IN VARCHAR2
    ) RETURN t_account_list PIPELINED AS
    BEGIN
        FOR account_rec IN (
            SELECT account_id
            FROM account_info
            WHERE customer_id = p_customer_id
            ORDER BY open_date
        ) LOOP
            PIPE ROW(account_rec.account_id);
        END LOOP;
        RETURN;
    END get_customer_accounts;
    
END pkg_customer_service;
/
```

### 3. 风险管理包

```sql
-- 风险管理包规范
CREATE OR REPLACE PACKAGE pkg_risk_management AS
    
    -- 风险等级常量
    c_risk_low CONSTANT VARCHAR2(10) := 'LOW';
    c_risk_medium CONSTANT VARCHAR2(10) := 'MEDIUM';
    c_risk_high CONSTANT VARCHAR2(10) := 'HIGH';
    c_risk_critical CONSTANT VARCHAR2(10) := 'CRITICAL';
    
    -- 风险评估记录类型
    TYPE t_risk_assessment IS RECORD (
        customer_id VARCHAR2(20),
        risk_score NUMBER(5,2),
        risk_level VARCHAR2(10),
        assessment_date DATE,
        factors VARCHAR2(1000)
    );
    
    -- 反洗钱检查函数
    FUNCTION check_aml_risk(
        p_customer_id IN VARCHAR2,
        p_transaction_amount IN NUMBER,
        p_transaction_type IN VARCHAR2
    ) RETURN VARCHAR2;
    
    -- 信用风险评估
    FUNCTION assess_credit_risk(
        p_customer_id IN VARCHAR2
    ) RETURN t_risk_assessment;
    
    -- 欺诈检测
    FUNCTION detect_fraud_pattern(
        p_customer_id IN VARCHAR2,
        p_transaction_data IN VARCHAR2
    ) RETURN BOOLEAN;
    
    -- 风险预警处理
    PROCEDURE process_risk_alert(
        p_customer_id IN VARCHAR2,
        p_alert_type IN VARCHAR2,
        p_alert_level IN VARCHAR2,
        p_description IN VARCHAR2
    );
    
END pkg_risk_management;
/

-- 风险管理包体
CREATE OR REPLACE PACKAGE BODY pkg_risk_management AS
    
    FUNCTION check_aml_risk(
        p_customer_id IN VARCHAR2,
        p_transaction_amount IN NUMBER,
        p_transaction_type IN VARCHAR2
    ) RETURN VARCHAR2 AS
        v_daily_cash_amount NUMBER;
        v_monthly_transfer_count NUMBER;
        v_risk_level VARCHAR2(10) := c_risk_low;
        v_customer_grade VARCHAR2(20);
    BEGIN
        -- 获取客户等级
        v_customer_grade := get_customer_grade(p_customer_id);
        
        -- 检查当日现金交易累计金额
        SELECT NVL(SUM(amount), 0)
        INTO v_daily_cash_amount
        FROM transaction_log tl
        JOIN account_info ai ON tl.account_id = ai.account_id
        WHERE ai.customer_id = p_customer_id
        AND tl.trans_type IN ('CASH_DEPOSIT', 'CASH_WITHDRAW')
        AND TRUNC(tl.trans_time) = TRUNC(SYSDATE);
        
        -- 检查当月转账频率
        SELECT COUNT(*)
        INTO v_monthly_transfer_count
        FROM transaction_log tl
        JOIN account_info ai ON tl.account_id = ai.account_id
        WHERE ai.customer_id = p_customer_id
        AND tl.trans_type = 'TRANSFER'
        AND tl.trans_time >= TRUNC(SYSDATE, 'MM');
        
        -- 风险等级判断
        IF p_transaction_amount >= 200000 THEN
            v_risk_level := c_risk_high;
        ELSIF v_daily_cash_amount + p_transaction_amount >= 50000 THEN
            v_risk_level := c_risk_medium;
        ELSIF v_monthly_transfer_count >= 100 THEN
            v_risk_level := c_risk_medium;
        END IF;
        
        -- 记录AML检查日志
        INSERT INTO aml_check_log (
            customer_id, transaction_amount, transaction_type,
            daily_cash_amount, monthly_transfer_count, risk_level,
            check_time
        ) VALUES (
            p_customer_id, p_transaction_amount, p_transaction_type,
            v_daily_cash_amount, v_monthly_transfer_count, v_risk_level,
            SYSDATE
        );
        
        RETURN v_risk_level;
    END check_aml_risk;
    
    FUNCTION assess_credit_risk(
        p_customer_id IN VARCHAR2
    ) RETURN t_risk_assessment AS
        v_assessment t_risk_assessment;
        v_income NUMBER;
        v_debt_ratio NUMBER;
        v_overdue_count NUMBER;
        v_credit_history_months NUMBER;
        v_factors VARCHAR2(1000);
    BEGIN
        v_assessment.customer_id := p_customer_id;
        v_assessment.assessment_date := SYSDATE;
        
        -- 获取客户收入信息
        SELECT NVL(annual_income, 0)
        INTO v_income
        FROM customer_info
        WHERE customer_id = p_customer_id;
        
        -- 计算负债率
        SELECT 
            CASE 
                WHEN SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END) = 0 THEN 0
                ELSE SUM(CASE WHEN balance < 0 THEN ABS(balance) ELSE 0 END) / 
                     SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END)
            END
        INTO v_debt_ratio
        FROM account_info
        WHERE customer_id = p_customer_id;
        
        -- 统计逾期次数
        SELECT COUNT(*)
        INTO v_overdue_count
        FROM loan_overdue_history
        WHERE customer_id = p_customer_id
        AND overdue_date >= ADD_MONTHS(SYSDATE, -24);
        
        -- 计算信用历史长度
        SELECT MONTHS_BETWEEN(SYSDATE, MIN(open_date))
        INTO v_credit_history_months
        FROM account_info
        WHERE customer_id = p_customer_id;
        
        -- 风险评分计算
        v_assessment.risk_score := 
            CASE WHEN v_income >= 200000 THEN 25 ELSE v_income / 8000 END + -- 收入评分(25分)
            CASE WHEN v_debt_ratio <= 0.3 THEN 25 WHEN v_debt_ratio <= 0.5 THEN 15 ELSE 5 END + -- 负债率评分(25分)
            CASE WHEN v_overdue_count = 0 THEN 25 WHEN v_overdue_count <= 2 THEN 15 ELSE 5 END + -- 信用记录评分(25分)
            CASE WHEN v_credit_history_months >= 36 THEN 25 WHEN v_credit_history_months >= 12 THEN 15 ELSE 5 END; -- 信用历史评分(25分)
        
        -- 风险等级判定
        v_assessment.risk_level := 
            CASE 
                WHEN v_assessment.risk_score >= 80 THEN c_risk_low
                WHEN v_assessment.risk_score >= 60 THEN c_risk_medium
                WHEN v_assessment.risk_score >= 40 THEN c_risk_high
                ELSE c_risk_critical
            END;
        
        -- 风险因子描述
        v_factors := '收入:' || v_income || '|负债率:' || ROUND(v_debt_ratio * 100, 2) || 
                    '%|逾期次数:' || v_overdue_count || '|信用历史:' || v_credit_history_months || '月';
        v_assessment.factors := v_factors;
        
        -- 保存评估结果
        INSERT INTO credit_risk_assessment (
            customer_id, risk_score, risk_level, assessment_date, factors
        ) VALUES (
            v_assessment.customer_id, v_assessment.risk_score, 
            v_assessment.risk_level, v_assessment.assessment_date, v_assessment.factors
        );
        
        RETURN v_assessment;
    END assess_credit_risk;
    
    FUNCTION detect_fraud_pattern(
        p_customer_id IN VARCHAR2,
        p_transaction_data IN VARCHAR2
    ) RETURN BOOLEAN AS
        v_is_fraud BOOLEAN := FALSE;
        v_unusual_time_count NUMBER;
        v_unusual_location_count NUMBER;
        v_large_amount_count NUMBER;
    BEGIN
        -- 检查异常时间交易（深夜交易）
        SELECT COUNT(*)
        INTO v_unusual_time_count
        FROM transaction_log tl
        JOIN account_info ai ON tl.account_id = ai.account_id
        WHERE ai.customer_id = p_customer_id
        AND (EXTRACT(HOUR FROM CAST(tl.trans_time AS TIMESTAMP)) >= 23
             OR EXTRACT(HOUR FROM CAST(tl.trans_time AS TIMESTAMP)) <= 5)
        AND tl.trans_time >= SYSDATE - 7;
        
        -- 检查异地交易
        SELECT COUNT(*)
        INTO v_unusual_location_count
        FROM transaction_log tl
        JOIN account_info ai ON tl.account_id = ai.account_id
        WHERE ai.customer_id = p_customer_id
        AND tl.location_code NOT IN (
            SELECT DISTINCT location_code 
            FROM customer_usual_locations 
            WHERE customer_id = p_customer_id
        )
        AND tl.trans_time >= SYSDATE - 1;
        
        -- 检查大额交易
        SELECT COUNT(*)
        INTO v_large_amount_count
        FROM transaction_log tl
        JOIN account_info ai ON tl.account_id = ai.account_id
        WHERE ai.customer_id = p_customer_id
        AND tl.amount > 50000
        AND tl.trans_time >= SYSDATE - 1;
        
        -- 欺诈模式判断
        IF v_unusual_time_count >= 3 OR 
           v_unusual_location_count >= 2 OR 
           v_large_amount_count >= 3 THEN
            v_is_fraud := TRUE;
        END IF;
        
        -- 记录检测结果
        INSERT INTO fraud_detection_log (
            customer_id, unusual_time_count, unusual_location_count,
            large_amount_count, is_fraud_detected, detection_time
        ) VALUES (
            p_customer_id, v_unusual_time_count, v_unusual_location_count,
            v_large_amount_count, CASE WHEN v_is_fraud THEN 'Y' ELSE 'N' END, SYSDATE
        );
        
        RETURN v_is_fraud;
    END detect_fraud_pattern;
    
    PROCEDURE process_risk_alert(
        p_customer_id IN VARCHAR2,
        p_alert_type IN VARCHAR2,
        p_alert_level IN VARCHAR2,
        p_description IN VARCHAR2
    ) AS
        v_alert_id NUMBER;
    BEGIN
        -- 生成告警ID
        SELECT risk_alert_seq.NEXTVAL INTO v_alert_id FROM dual;
        
        -- 插入风险告警记录
        INSERT INTO risk_alert (
            alert_id, customer_id, alert_type, alert_level,
            description, alert_time, status
        ) VALUES (
            v_alert_id, p_customer_id, p_alert_type, p_alert_level,
            p_description, SYSDATE, 'OPEN'
        );
        
        -- 根据告警级别采取相应措施
        IF p_alert_level = c_risk_critical THEN
            -- 高风险：冻结所有账户
            FOR account_rec IN (
                SELECT account_id FROM account_info 
                WHERE customer_id = p_customer_id AND status = 'ACTIVE'
            ) LOOP
                pkg_customer_service.freeze_account(
                    account_rec.account_id, 
                    '高风险告警自动冻结'
                );
            END LOOP;
            
        ELSIF p_alert_level = c_risk_high THEN
            -- 中高风险：限制大额交易
            UPDATE customer_info SET
                transaction_limit = 10000
            WHERE customer_id = p_customer_id;
        END IF;
        
        COMMIT;
    END process_risk_alert;
    
END pkg_risk_management;
/
```

## 函数和包的最佳实践

### 1. 性能优化

```sql
-- 年龄计算依赖当前日期，不能声明为DETERMINISTIC
CREATE OR REPLACE FUNCTION calculate_age(p_birth_date DATE) 
RETURN NUMBER
AS
BEGIN
    RETURN FLOOR(MONTHS_BETWEEN(SYSDATE, p_birth_date) / 12);
END;
/

-- 格式化结果依赖会话NLS设置，不声明DETERMINISTIC；PARALLEL_ENABLE不保证查询实际并行执行
CREATE OR REPLACE FUNCTION format_currency(p_amount NUMBER)
RETURN VARCHAR2
PARALLEL_ENABLE
AS
BEGIN
    RETURN TO_CHAR(p_amount, 'L999,999,990.00');
END;
/

-- 查询当日汇率：函数内部依赖当前日期，不使用RESULT_CACHE
CREATE OR REPLACE FUNCTION get_exchange_rate(
    p_from_currency VARCHAR2,
    p_to_currency VARCHAR2
) RETURN NUMBER
AS
    v_rate NUMBER;
BEGIN
    SELECT rate INTO v_rate
    FROM exchange_rates
    WHERE from_currency = p_from_currency
    AND to_currency = p_to_currency
    AND rate_date = TRUNC(SYSDATE);
    
    RETURN v_rate;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN 1;
END;
/
```

### 2. 异常处理和调试

```sql
-- 包级别异常处理
CREATE OR REPLACE PACKAGE pkg_utilities AS
    
    -- 自定义异常
    e_invalid_parameter EXCEPTION;
    PRAGMA EXCEPTION_INIT(e_invalid_parameter, -20100);
    
    -- 调试日志函数
    PROCEDURE debug_log(p_message VARCHAR2);
    
    -- 通用验证函数
    FUNCTION validate_amount(p_amount NUMBER) RETURN BOOLEAN;
    
END pkg_utilities;
/

CREATE OR REPLACE PACKAGE BODY pkg_utilities AS
    
    g_debug_enabled BOOLEAN := TRUE;
    
    PROCEDURE debug_log(p_message VARCHAR2) AS
    BEGIN
        IF g_debug_enabled THEN
            INSERT INTO debug_log (log_time, message)
            VALUES (SYSTIMESTAMP, p_message);
        END IF;
    END debug_log;
    
    FUNCTION validate_amount(p_amount NUMBER) RETURN BOOLEAN AS
    BEGIN
        IF p_amount IS NULL OR p_amount < 0 THEN
            RAISE e_invalid_parameter;
        END IF;
        
        RETURN TRUE;
    EXCEPTION
        WHEN e_invalid_parameter THEN
            debug_log('无效金额: ' || TO_CHAR(p_amount));
            RAISE_APPLICATION_ERROR(-20100, '金额不能为空且必须大于或等于0');
    END validate_amount;
    
END pkg_utilities;
/
```

Oracle函数和包可用于组织银行业务逻辑。合理的设计和优化有助于提高代码复用性、维护性和执行效率，但不能单独保证银行系统稳定运行；本文的业务阈值和处理流程仅作为教学假设，实际应用还需满足业务规则、事务一致性、并发控制及安全要求。