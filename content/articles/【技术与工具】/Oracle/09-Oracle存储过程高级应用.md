---
title: Oracle存储过程高级应用
tags:
  - 技术工具
  - Oracle
date: 2026-03-22
difficulty: 高级
duration: 45分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据治理工程师
  - Oracle数据库开发人员
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-22
updated: 2026-10-10
---


# Oracle存储过程高级应用

## 游标(Cursor)使用技巧

游标是处理查询结果集的强大工具，特别适合在银行业务中处理大量数据记录。

### 1. 显式游标基础

```sql
CREATE OR REPLACE PROCEDURE process_overdue_accounts
AS
    -- 声明游标
    CURSOR c_overdue_accounts IS
        SELECT ai.account_id, customer_id, balance, last_payment_date
        FROM account_info ai
        JOIN loan_info li ON ai.account_id = li.account_id
        WHERE li.next_payment_date < SYSDATE
        AND li.status = 'ACTIVE';
    
    -- 声明游标记录类型
    v_account_rec c_overdue_accounts%ROWTYPE;
    v_penalty_amount NUMBER;
    v_processed_count NUMBER := 0;
BEGIN
    -- 打开游标
    OPEN c_overdue_accounts;
    
    LOOP
        -- 提取数据
        FETCH c_overdue_accounts INTO v_account_rec;
        EXIT WHEN c_overdue_accounts%NOTFOUND;
        
        -- 计算逾期罚金
        v_penalty_amount := v_account_rec.balance * 0.01; -- 1%罚金
        
        -- 更新账户信息
        UPDATE account_info 
        SET balance = balance + v_penalty_amount,
            last_update_time = SYSDATE
        WHERE account_id = v_account_rec.account_id;
        
        -- 记录罚金交易
        INSERT INTO transaction_log (
            trans_id, account_id, trans_type, amount, 
            trans_date, description
        ) VALUES (
            trans_seq.NEXTVAL, v_account_rec.account_id, 
            'PENALTY', v_penalty_amount, SYSDATE,
            '逾期罚金'
        );
        
        v_processed_count := v_processed_count + 1;
        
        -- 每处理100条记录提交一次
        IF MOD(v_processed_count, 100) = 0 THEN
            COMMIT;
            DBMS_OUTPUT.PUT_LINE('已处理 ' || v_processed_count || ' 条记录');
        END IF;
    END LOOP;
    
    -- 关闭游标
    CLOSE c_overdue_accounts;
    
    COMMIT;
    DBMS_OUTPUT.PUT_LINE('逾期账户处理完成，共处理 ' || v_processed_count || ' 条记录');
    
EXCEPTION
    WHEN OTHERS THEN
        IF c_overdue_accounts%ISOPEN THEN
            CLOSE c_overdue_accounts;
        END IF;
        ROLLBACK;
        RAISE;
END process_overdue_accounts;
/
```

### 2. 游标FOR循环

```sql
CREATE OR REPLACE PROCEDURE generate_monthly_statement(
    p_year IN NUMBER,
    p_month IN NUMBER
)
AS
    v_statement_count NUMBER := 0;
    v_total_amount NUMBER;
BEGIN
    -- 使用游标FOR循环，自动处理游标打开、提取、关闭
    FOR customer_rec IN (
        SELECT c.customer_id, c.customer_name, c.email,
               COUNT(ai.account_id) as account_count,
               SUM(ai.balance) as total_balance
        FROM customer_info c
        JOIN account_info ai ON c.customer_id = ai.customer_id
        WHERE ai.status = 'ACTIVE'
        GROUP BY c.customer_id, c.customer_name, c.email
        HAVING SUM(ai.balance) > 0
    ) LOOP
        
        -- 计算月度交易汇总
        SELECT NVL(SUM(amount), 0) INTO v_total_amount
        FROM transaction_log tl
        JOIN account_info ai ON tl.account_id = ai.account_id
        WHERE ai.customer_id = customer_rec.customer_id
        AND EXTRACT(YEAR FROM tl.trans_date) = p_year
        AND EXTRACT(MONTH FROM tl.trans_date) = p_month;
        
        -- 生成月度对账单
        INSERT INTO monthly_statement (
            statement_id, customer_id, customer_name,
            statement_year, statement_month,
            account_count, total_balance, total_transactions,
            generate_date, email_sent
        ) VALUES (
            statement_seq.NEXTVAL, customer_rec.customer_id, 
            customer_rec.customer_name, p_year, p_month,
            customer_rec.account_count, customer_rec.total_balance,
            v_total_amount, SYSDATE, 'N'
        );
        
        v_statement_count := v_statement_count + 1;
    END LOOP;
    
    COMMIT;
    DBMS_OUTPUT.PUT_LINE('月度对账单生成完成，共生成 ' || v_statement_count || ' 份');
END generate_monthly_statement;
/
```

### 3. 参数化游标

```sql
CREATE OR REPLACE PROCEDURE analyze_customer_transactions(
    p_customer_id IN NUMBER,
    p_start_date IN DATE,
    p_end_date IN DATE
)
AS
    -- 参数化游标
    CURSOR c_transactions(cp_customer_id NUMBER, cp_start_date DATE, cp_end_date DATE) IS
        SELECT tl.trans_date, tl.trans_type, tl.amount, tl.description,
               ai.account_id, ai.account_type
        FROM transaction_log tl
        JOIN account_info ai ON tl.account_id = ai.account_id
        WHERE ai.customer_id = cp_customer_id
        AND tl.trans_date BETWEEN cp_start_date AND cp_end_date
        ORDER BY tl.trans_date DESC;
    
    v_deposit_total NUMBER := 0;
    v_withdraw_total NUMBER := 0;
    v_transfer_total NUMBER := 0;
    v_transaction_count NUMBER := 0;
BEGIN
    FOR trans_rec IN c_transactions(p_customer_id, p_start_date, p_end_date) LOOP
        
        v_transaction_count := v_transaction_count + 1;
        
        CASE trans_rec.trans_type
            WHEN 'DEPOSIT' THEN
                v_deposit_total := v_deposit_total + trans_rec.amount;
            WHEN 'WITHDRAW' THEN
                v_withdraw_total := v_withdraw_total + trans_rec.amount;
            WHEN 'TRANSFER' THEN
                v_transfer_total := v_transfer_total + trans_rec.amount;
            ELSE
                NULL; -- 本示例仅汇总上述三类金额；其他类型仍计入总交易次数
        END CASE;
    END LOOP;
    
    -- 输出分析结果
    DBMS_OUTPUT.PUT_LINE('客户交易分析报告');
    DBMS_OUTPUT.PUT_LINE('客户ID: ' || p_customer_id);
    DBMS_OUTPUT.PUT_LINE('分析期间: ' || TO_CHAR(p_start_date, 'YYYY-MM-DD') || 
                        ' 至 ' || TO_CHAR(p_end_date, 'YYYY-MM-DD'));
    DBMS_OUTPUT.PUT_LINE('总交易次数: ' || v_transaction_count);
    DBMS_OUTPUT.PUT_LINE('存款总额: ' || v_deposit_total);
    DBMS_OUTPUT.PUT_LINE('取款总额: ' || v_withdraw_total);
    DBMS_OUTPUT.PUT_LINE('转账总额: ' || v_transfer_total);
END analyze_customer_transactions;
/
```

## 动态SQL构建

动态SQL允许在运行时构建和执行SQL语句，在银行数据仓库ETL过程中特别有用。

### 1. 基础动态SQL

```sql
CREATE OR REPLACE PROCEDURE dynamic_table_stats(
    p_table_name IN VARCHAR2,
    p_owner IN VARCHAR2 DEFAULT USER
)
AS
    v_sql VARCHAR2(4000);
    v_count NUMBER;
    v_max_date DATE;
BEGIN
    -- 构建动态SQL统计记录数
    v_sql := 'SELECT COUNT(*) FROM ' || p_owner || '.' || p_table_name;
    EXECUTE IMMEDIATE v_sql INTO v_count;
    
    DBMS_OUTPUT.PUT_LINE('表 ' || p_table_name || ' 记录数: ' || v_count);
    
    -- 动态检查是否有日期列
    BEGIN
        v_sql := 'SELECT MAX(create_time) FROM ' || p_owner || '.' || p_table_name;
        EXECUTE IMMEDIATE v_sql INTO v_max_date;
        DBMS_OUTPUT.PUT_LINE('最新记录时间: ' || TO_CHAR(v_max_date, 'YYYY-MM-DD HH24:MI:SS'));
    EXCEPTION
        WHEN OTHERS THEN
            DBMS_OUTPUT.PUT_LINE('未找到create_time列');
    END;
    
EXCEPTION
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('查询表 ' || p_table_name || ' 时发生错误: ' || SQLERRM);
END dynamic_table_stats;
/
```

### 2. 银行ETL动态处理

```sql
CREATE OR REPLACE PROCEDURE etl_daily_summary(
    p_table_name IN VARCHAR2,
    p_date_column IN VARCHAR2,
    p_process_date IN DATE
)
AS
    v_sql VARCHAR2(4000);
    v_source_table VARCHAR2(100);
    v_target_table VARCHAR2(100);
    v_partition_name VARCHAR2(100);
    v_record_count NUMBER;
BEGIN
    -- 构建源表和目标表名
    v_source_table := 'ODS_' || p_table_name;
    v_target_table := 'DW_' || p_table_name || '_DAILY';
    v_partition_name := 'P' || TO_CHAR(p_process_date, 'YYYYMMDD');
    
    -- 检查源表数据量
    v_sql := 'SELECT COUNT(*) FROM ' || v_source_table || 
             ' WHERE ' || p_date_column || ' = :1';
    EXECUTE IMMEDIATE v_sql INTO v_record_count USING p_process_date;
    
    DBMS_OUTPUT.PUT_LINE('源表 ' || v_source_table || ' 待处理记录数: ' || v_record_count);
    
    IF v_record_count = 0 THEN
        DBMS_OUTPUT.PUT_LINE('没有数据需要处理');
        RETURN;
    END IF;
    
    -- 创建分区（如果不存在）
    BEGIN
        v_sql := 'ALTER TABLE ' || v_target_table || 
                ' ADD PARTITION ' || v_partition_name ||
                ' VALUES LESS THAN (DATE ''' || 
                TO_CHAR(p_process_date + 1, 'YYYY-MM-DD') || ''')';
        EXECUTE IMMEDIATE v_sql;
        DBMS_OUTPUT.PUT_LINE('创建分区: ' || v_partition_name);
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -14012 THEN -- 分区名称已被使用；该异常本身不能证明已有分区边界符合本次处理要求
                DBMS_OUTPUT.PUT_LINE('分区 ' || v_partition_name || ' 已存在');
            ELSE
                RAISE;
            END IF;
    END;
    
    -- 删除目标表中当日数据
    v_sql := 'DELETE FROM ' || v_target_table || 
             ' WHERE ' || p_date_column || ' = :1';
    EXECUTE IMMEDIATE v_sql USING p_process_date;
    DBMS_OUTPUT.PUT_LINE('删除目标表旧数据: ' || SQL%ROWCOUNT || ' 条');
    
    -- 插入汇总数据
    v_sql := 'INSERT INTO ' || v_target_table || 
             ' SELECT * FROM ' || v_source_table ||
             ' WHERE ' || p_date_column || ' = :1';
    EXECUTE IMMEDIATE v_sql USING p_process_date;
    DBMS_OUTPUT.PUT_LINE('插入新数据: ' || SQL%ROWCOUNT || ' 条');
    
    COMMIT;
    DBMS_OUTPUT.PUT_LINE('ETL处理完成');
    
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        DBMS_OUTPUT.PUT_LINE('ETL处理失败: ' || SQLERRM);
        RAISE;
END etl_daily_summary;
/
```

### 3. 动态数据质量检查

```sql
CREATE OR REPLACE PROCEDURE dynamic_data_quality_check(
    p_table_name IN VARCHAR2,
    p_check_date IN DATE DEFAULT SYSDATE
)
AS
    TYPE t_check_results IS TABLE OF VARCHAR2(4000);
    v_results t_check_results := t_check_results();
    v_sql VARCHAR2(4000);
    v_count NUMBER;
    v_check_item VARCHAR2(100);
BEGIN
    -- 检查1: 空值检查
    v_check_item := '空值检查';
    v_sql := 'SELECT COUNT(*) FROM ' || p_table_name || 
             ' WHERE customer_id IS NULL OR account_id IS NULL';
    EXECUTE IMMEDIATE v_sql INTO v_count;
    v_results.EXTEND;
    v_results(v_results.COUNT) := v_check_item || ': ' || v_count || ' 条空值记录';
    
    -- 检查2: 重复数据检查
    v_check_item := '重复数据检查';
    v_sql := 'SELECT NVL(SUM(group_count - 1), 0) FROM (SELECT COUNT(*) AS group_count FROM ' || p_table_name || ' GROUP BY customer_id, account_id)';
    EXECUTE IMMEDIATE v_sql INTO v_count;
    v_results.EXTEND;
    v_results(v_results.COUNT) := v_check_item || ': ' || v_count || ' 条重复记录';
    
    -- 检查3: 异常金额检查
    v_check_item := '异常金额检查';
    v_sql := 'SELECT COUNT(*) FROM ' || p_table_name || 
             ' WHERE balance < 0 OR balance > 99999999';
    EXECUTE IMMEDIATE v_sql INTO v_count;
    v_results.EXTEND;
    v_results(v_results.COUNT) := v_check_item || ': ' || v_count || ' 条异常金额记录';
    
    -- 输出检查结果
    DBMS_OUTPUT.PUT_LINE('数据质量检查报告 - ' || p_table_name);
    DBMS_OUTPUT.PUT_LINE('检查时间: ' || TO_CHAR(p_check_date, 'YYYY-MM-DD HH24:MI:SS'));
    DBMS_OUTPUT.PUT_LINE('----------------------------------------');
    
    FOR i IN 1..v_results.COUNT LOOP
        DBMS_OUTPUT.PUT_LINE(v_results(i));
    END LOOP;
    
    -- 记录检查结果到日志表
    INSERT INTO data_quality_log (
        table_name, check_date, check_results
    ) VALUES (
        p_table_name, p_check_date, 
        v_results(1) || '|' || v_results(2) || '|' || v_results(3)
    );
    
    COMMIT;
END dynamic_data_quality_check;
/
```

## 银行风控存储过程

### 1. 反洗钱监控

```sql
CREATE OR REPLACE PROCEDURE aml_transaction_monitor(
    p_monitoring_date IN DATE DEFAULT SYSDATE
)
AS
    CURSOR c_suspicious_patterns IS
        -- 大额现金交易
        SELECT customer_id, account_id, SUM(amount) as daily_amount, COUNT(*) as trans_count
        FROM transaction_log
        WHERE trans_date >= TRUNC(p_monitoring_date)
        AND trans_date < TRUNC(p_monitoring_date) + 1
        AND trans_type IN ('DEPOSIT', 'WITHDRAW')
        AND amount >= 10000
        GROUP BY customer_id, account_id
        HAVING SUM(amount) >= 50000 OR COUNT(*) >= 5
        
        UNION ALL
        
        -- 频繁小额交易
        SELECT customer_id, account_id, SUM(amount) as daily_amount, COUNT(*) as trans_count
        FROM transaction_log
        WHERE trans_date >= TRUNC(p_monitoring_date)
        AND trans_date < TRUNC(p_monitoring_date) + 1
        AND trans_type = 'TRANSFER'
        AND amount BETWEEN 1000 AND 9999
        GROUP BY customer_id, account_id
        HAVING COUNT(*) >= 20;
    
    v_alert_count NUMBER := 0;
    v_risk_score NUMBER;
    v_error_message VARCHAR2(4000);
BEGIN
    FOR suspicious_rec IN c_suspicious_patterns LOOP
        
        -- 计算风险评分
        v_risk_score := CASE 
            WHEN suspicious_rec.daily_amount >= 100000 THEN 90
            WHEN suspicious_rec.daily_amount >= 50000 THEN 70
            WHEN suspicious_rec.trans_count >= 20 THEN 60
            ELSE 40
        END;
        
        -- 记录可疑交易警报
        INSERT INTO aml_alerts (
            alert_id, customer_id, account_id, alert_date,
            alert_type, risk_score, daily_amount, trans_count,
            status, create_time
        ) VALUES (
            aml_alert_seq.NEXTVAL, suspicious_rec.customer_id, 
            suspicious_rec.account_id, p_monitoring_date,
            'SUSPICIOUS_PATTERN', v_risk_score, 
            suspicious_rec.daily_amount, suspicious_rec.trans_count,
            'PENDING', SYSDATE
        );
        
        v_alert_count := v_alert_count + 1;
        
        -- 教学假设：按上述示例评分模拟冻结账户，不代表可直接用于生产的风控或合规规则
        IF v_risk_score >= 80 THEN
            UPDATE account_info 
            SET status = 'FROZEN',
                freeze_reason = 'AML_AUTO_FREEZE',
                freeze_time = SYSDATE
            WHERE account_id = suspicious_rec.account_id;
            
            DBMS_OUTPUT.PUT_LINE('高风险账户已冻结: ' || suspicious_rec.account_id);
        END IF;
    END LOOP;
    
    COMMIT;
    DBMS_OUTPUT.PUT_LINE('反洗钱监控完成，生成警报 ' || v_alert_count || ' 条');
    
EXCEPTION
    WHEN OTHERS THEN
        v_error_message := SQLERRM;
        ROLLBACK;
        INSERT INTO error_log (error_time, procedure_name, error_message)
        VALUES (SYSDATE, 'aml_transaction_monitor', v_error_message);
        COMMIT;
        RAISE;
END aml_transaction_monitor;
/
```

### 2. 信用风险评估

```sql
CREATE OR REPLACE PROCEDURE credit_risk_assessment(
    p_customer_id IN NUMBER,
    p_risk_score OUT NUMBER,
    p_risk_level OUT VARCHAR2
)
AS
    v_total_balance NUMBER;
    v_avg_monthly_income NUMBER;
    v_overdue_count NUMBER;
    v_account_age_months NUMBER;
    v_transaction_pattern_score NUMBER;
    
    -- 计算交易模式评分
    FUNCTION calculate_transaction_pattern_score(p_cust_id NUMBER) RETURN NUMBER
    AS
        v_regular_deposits NUMBER;
        v_pattern_score NUMBER := 0;
    BEGIN
        -- 检查是否有规律性收入
        SELECT COUNT(*)
        INTO v_regular_deposits
        FROM (
            SELECT EXTRACT(DAY FROM trans_date) as day_of_month
            FROM transaction_log tl
            JOIN account_info ai ON tl.account_id = ai.account_id
            WHERE ai.customer_id = p_cust_id
            AND tl.trans_type = 'DEPOSIT'
            AND tl.trans_date >= ADD_MONTHS(SYSDATE, -6)
            GROUP BY EXTRACT(DAY FROM trans_date)
            HAVING COUNT(*) >= 3
        );
        
        v_pattern_score := LEAST(v_regular_deposits * 10, 50);
        RETURN v_pattern_score;
    END calculate_transaction_pattern_score;
    
BEGIN
    -- 获取客户基础数据
    SELECT NVL(SUM(ai.balance), 0),
           MONTHS_BETWEEN(SYSDATE, MIN(ai.open_date))
    INTO v_total_balance, v_account_age_months
    FROM account_info ai
    WHERE ai.customer_id = p_customer_id;
    
    -- 计算平均月收入
    SELECT NVL(AVG(monthly_income), 0)
    INTO v_avg_monthly_income
    FROM (
        SELECT EXTRACT(YEAR FROM tl.trans_date) as year,
               EXTRACT(MONTH FROM tl.trans_date) as month,
               SUM(tl.amount) as monthly_income
        FROM transaction_log tl
        JOIN account_info ai ON tl.account_id = ai.account_id
        WHERE ai.customer_id = p_customer_id
        AND tl.trans_type = 'DEPOSIT'
        AND tl.trans_date >= ADD_MONTHS(SYSDATE, -12)
        GROUP BY EXTRACT(YEAR FROM tl.trans_date), EXTRACT(MONTH FROM tl.trans_date)
    );
    
    -- 计算逾期记录
    SELECT COUNT(*)
    INTO v_overdue_count
    FROM loan_info li
    JOIN account_info ai ON li.account_id = ai.account_id
    WHERE ai.customer_id = p_customer_id
    AND li.overdue_days > 0;
    
    -- 计算交易模式评分
    v_transaction_pattern_score := calculate_transaction_pattern_score(p_customer_id);
    
    -- 综合风险评分计算
    p_risk_score := 0;
    
    -- 余额评分 (0-30分)
    p_risk_score := p_risk_score + CASE 
        WHEN v_total_balance >= 100000 THEN 30
        WHEN v_total_balance >= 50000 THEN 25
        WHEN v_total_balance >= 10000 THEN 20
        WHEN v_total_balance >= 1000 THEN 10
        ELSE 0
    END;
    
    -- 收入评分 (0-25分)
    p_risk_score := p_risk_score + CASE 
        WHEN v_avg_monthly_income >= 20000 THEN 25
        WHEN v_avg_monthly_income >= 10000 THEN 20
        WHEN v_avg_monthly_income >= 5000 THEN 15
        WHEN v_avg_monthly_income >= 2000 THEN 10
        ELSE 0
    END;
    
    -- 账户历史评分 (0-20分)
    p_risk_score := p_risk_score + CASE 
        WHEN v_account_age_months >= 24 THEN 20
        WHEN v_account_age_months >= 12 THEN 15
        WHEN v_account_age_months >= 6 THEN 10
        ELSE 5
    END;
    
    -- 交易模式评分 (0-15分)
    p_risk_score := p_risk_score + LEAST(v_transaction_pattern_score, 15);
    
    -- 逾期记录扣分 (最多扣30分)
    p_risk_score := p_risk_score - LEAST(v_overdue_count * 10, 30);
    
    -- 确保评分在0-100范围内
    p_risk_score := GREATEST(0, LEAST(100, p_risk_score));
    
    -- 确定风险等级
    p_risk_level := CASE 
        WHEN p_risk_score >= 80 THEN 'LOW'
        WHEN p_risk_score >= 60 THEN 'MEDIUM'
        WHEN p_risk_score >= 40 THEN 'HIGH'
        ELSE 'VERY_HIGH'
    END;
    
    -- 记录评估结果
    INSERT INTO credit_risk_assessment_log (
        customer_id, assessment_date, risk_score, risk_level,
        total_balance, avg_monthly_income, overdue_count, account_age_months
    ) VALUES (
        p_customer_id, SYSDATE, p_risk_score, p_risk_level,
        v_total_balance, v_avg_monthly_income, v_overdue_count, v_account_age_months
    );
    
    COMMIT;
    
EXCEPTION
    WHEN OTHERS THEN
        p_risk_score := 0;
        p_risk_level := 'ERROR';
        RAISE;
END credit_risk_assessment;
/
```

## 性能优化要点

### 1. 批量处理优化

```sql
CREATE OR REPLACE PROCEDURE bulk_process_transactions
AS
    TYPE t_account_ids IS TABLE OF VARCHAR2(20);
    TYPE t_amounts IS TABLE OF NUMBER;
    
    v_account_ids t_account_ids;
    v_amounts t_amounts;
    
    CURSOR c_pending_transactions IS
        SELECT account_id, amount
        FROM pending_transactions
        WHERE status = 'PENDING'
        AND ROWNUM <= 10000; -- 限制批量大小
BEGIN
    OPEN c_pending_transactions;
    
    LOOP
        FETCH c_pending_transactions 
        BULK COLLECT INTO v_account_ids, v_amounts
        LIMIT 1000; -- 每次处理1000条
        
        EXIT WHEN v_account_ids.COUNT = 0;
        
        -- 批量更新
        FORALL i IN 1..v_account_ids.COUNT
            UPDATE account_info 
            SET balance = balance + v_amounts(i)
            WHERE account_id = v_account_ids(i);
        
        -- 批量删除已处理的记录
        FORALL i IN 1..v_account_ids.COUNT
            DELETE FROM pending_transactions
            WHERE account_id = v_account_ids(i)
            AND amount = v_amounts(i);
        
        COMMIT;
        
        DBMS_OUTPUT.PUT_LINE('已处理 ' || v_account_ids.COUNT || ' 条记录');
    END LOOP;
    
    CLOSE c_pending_transactions;
END bulk_process_transactions;
/
```

### 2. 异常处理最佳实践

```sql
CREATE OR REPLACE PROCEDURE robust_bank_procedure(
    p_customer_id IN NUMBER,
    p_result OUT VARCHAR2
)
AS
    v_step VARCHAR2(50);
    v_error_code NUMBER;
    v_error_message VARCHAR2(4000);
BEGIN
    v_step := 'VALIDATION';
    
    -- 参数验证
    IF p_customer_id IS NULL OR p_customer_id <= 0 THEN
        p_result := 'INVALID_CUSTOMER_ID';
        RETURN;
    END IF;
    
    v_step := 'BUSINESS_LOGIC';
    
    -- 主要业务逻辑
    -- ... 业务处理代码 ...
    
    p_result := 'SUCCESS';
    
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        p_result := 'NO_DATA_FOUND_AT_' || v_step;
        log_procedure_error('robust_bank_procedure', v_step, 'NO_DATA_FOUND', SQLERRM);
    WHEN DUP_VAL_ON_INDEX THEN
        p_result := 'DUPLICATE_VALUE_AT_' || v_step;
        log_procedure_error('robust_bank_procedure', v_step, 'DUP_VAL_ON_INDEX', SQLERRM);
    WHEN OTHERS THEN
        v_error_code := SQLCODE;
        v_error_message := SQLERRM;
        p_result := 'ERROR_AT_' || v_step || '_CODE_' || v_error_code;
        log_procedure_error('robust_bank_procedure', v_step, v_error_code, v_error_message);
END robust_bank_procedure;
/
```

掌握Oracle存储过程的高级特性能够帮助开发人员在银行等复杂业务场景中构建高效、可靠的数据处理解决方案。这些技术是成为Oracle专家的重要技能。