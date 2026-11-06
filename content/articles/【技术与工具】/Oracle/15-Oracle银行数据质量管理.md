---
title: Oracle银行数据质量管理
tags:
  - 技术工具
  - Oracle
date: 2026-03-22
difficulty: 高级
duration: 60分钟
knowledge_type: technical-practice
target_audience:
  - 数据治理工程师
  - 数据开发工程师
  - 数据架构师
  - Oracle数据库开发与运维人员
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-22
updated: 2026-10-10
---


# Oracle银行数据质量管理

## 数据质量管理概述

数据质量管理是银行数据治理的核心组成部分，直接影响业务决策、风险控制和监管合规。在Oracle数据库环境中，数据质量管理体系可用于检查和改善银行数据的准确性、完整性、一致性和时效性；本文展示简化的规则与实现思路，不保证数据质量或监管合规。

### 1. 数据质量维度

**准确性（Accuracy）**
- 数据值正确反映真实世界的实体或事件
- 符合业务规则和约束条件

**完整性（Completeness）**
- 必要的数据字段都有值
- 记录数量符合预期

**一致性（Consistency）**
- 同一数据在不同系统中保持一致
- 数据格式和编码标准统一

**时效性（Timeliness）**
- 数据更新及时
- 历史数据保留适当

**有效性（Validity）**
- 数据符合定义的格式和范围
- 通过各种验证规则

## 数据质量检查框架

### 1. 数据质量规则定义表

```sql
-- 数据质量规则配置表
CREATE TABLE dq_rule_config (
    rule_id VARCHAR2(20) PRIMARY KEY,
    rule_name VARCHAR2(100) NOT NULL,
    rule_type VARCHAR2(20) NOT NULL, -- COMPLETENESS, ACCURACY, CONSISTENCY, VALIDITY
    table_name VARCHAR2(100) NOT NULL,
    column_name VARCHAR2(100),
    rule_description VARCHAR2(500),
    check_sql CLOB,
    threshold_warning NUMBER(5,2) DEFAULT 95, -- 告警阈值
    threshold_error NUMBER(5,2) DEFAULT 90,   -- 错误阈值
    is_active CHAR(1) DEFAULT 'Y',
    create_time DATE DEFAULT SYSDATE,
    update_time DATE DEFAULT SYSDATE
);

-- 数据质量检查结果表
CREATE TABLE dq_check_result (
    result_id NUMBER PRIMARY KEY,
    rule_id VARCHAR2(20),
    check_time DATE,
    total_records NUMBER,
    passed_records NUMBER,
    failed_records NUMBER,
    pass_rate NUMBER(5,2),
    status VARCHAR2(20), -- PASS, WARNING, ERROR
    error_details CLOB,
    check_duration NUMBER(10,3), -- 检查耗时（秒）
    FOREIGN KEY (rule_id) REFERENCES dq_rule_config(rule_id)
);

-- 数据质量问题明细表
CREATE TABLE dq_issue_detail (
    issue_id NUMBER PRIMARY KEY,
    result_id NUMBER,
    table_name VARCHAR2(100),
    column_name VARCHAR2(100),
    record_id VARCHAR2(100),
    issue_type VARCHAR2(50),
    issue_description VARCHAR2(1000),
    current_value VARCHAR2(1000),
    expected_value VARCHAR2(1000),
    severity VARCHAR2(20), -- LOW, MEDIUM, HIGH, CRITICAL
    create_time DATE DEFAULT SYSDATE,
    FOREIGN KEY (result_id) REFERENCES dq_check_result(result_id)
);

-- 创建序列
CREATE SEQUENCE dq_result_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE dq_issue_seq START WITH 1 INCREMENT BY 1;
```

### 2. 银行业务数据质量规则

```sql
-- 插入银行业务数据质量规则
BEGIN
    -- 客户信息完整性检查
    INSERT INTO dq_rule_config VALUES (
        'CUST_COMPLETENESS_01',
        '客户基本信息完整性检查',
        'COMPLETENESS',
        'customer_info',
        'customer_name,id_card,phone',
        '检查客户姓名、身份证号、手机号是否为空',
        'SELECT customer_id FROM customer_info WHERE customer_name IS NULL OR id_card IS NULL OR phone IS NULL',
        98, 95, 'Y', SYSDATE, SYSDATE
    );
    
    -- 身份证号格式检查
    INSERT INTO dq_rule_config VALUES (
        'CUST_VALIDITY_01',
        '身份证号格式有效性检查',
        'VALIDITY',
        'customer_info',
        'id_card',
        '检查身份证号是否符合18位格式规范',
        'SELECT customer_id FROM customer_info WHERE id_card IS NOT NULL AND NOT REGEXP_LIKE(id_card, ''^[0-9]{17}[0-9X]$'')',
        99, 97, 'Y', SYSDATE, SYSDATE
    );
    
    -- 手机号格式检查
    INSERT INTO dq_rule_config VALUES (
        'CUST_VALIDITY_02',
        '手机号格式有效性检查',
        'VALIDITY',
        'customer_info',
        'phone',
        '检查手机号是否符合11位格式规范',
        'SELECT customer_id FROM customer_info WHERE phone IS NOT NULL AND NOT REGEXP_LIKE(phone, ''^1[3-9][0-9]{9}$'')',
        99, 97, 'Y', SYSDATE, SYSDATE
    );
    
    -- 账户余额准确性检查
    INSERT INTO dq_rule_config VALUES (
        'ACCT_ACCURACY_01',
        '账户余额准确性检查',
        'ACCURACY',
        'account_info',
        'balance',
        '检查账户余额与交易记录计算结果是否一致',
        'SELECT ai.account_id FROM account_info ai WHERE ai.balance != (
            SELECT NVL(SUM(CASE WHEN tl.trans_type IN (''DEPOSIT'', ''TRANSFER_IN'') THEN tl.amount
                              WHEN tl.trans_type IN (''WITHDRAW'', ''TRANSFER_OUT'') THEN -tl.amount
                              ELSE 0 END), 0)
            FROM transaction_log tl WHERE tl.account_id = ai.account_id AND tl.status = ''SUCCESS'')',
        95, 90, 'Y', SYSDATE, SYSDATE
    );
    
    -- 交易金额有效性检查
    INSERT INTO dq_rule_config VALUES (
        'TRANS_VALIDITY_01',
        '交易金额有效性检查',
        'VALIDITY',
        'transaction_log',
        'amount',
        '检查交易金额是否为正数且在合理范围内',
        'SELECT trans_id FROM transaction_log WHERE amount <= 0 OR amount > 100000000',
        99, 95, 'Y', SYSDATE, SYSDATE
    );
    
    -- 账户状态一致性检查
    INSERT INTO dq_rule_config VALUES (
        'ACCT_CONSISTENCY_01',
        '账户状态一致性检查',
        'CONSISTENCY',
        'account_info',
        'status',
        '检查关闭账户是否还有未完成的交易',
        'SELECT ai.account_id FROM account_info ai WHERE ai.status = ''CLOSED'' 
         AND EXISTS (SELECT 1 FROM transaction_log tl WHERE tl.account_id = ai.account_id 
                     AND tl.status = ''PENDING'' AND tl.trans_time > ai.close_date)',
        100, 95, 'Y', SYSDATE, SYSDATE
    );
    
    COMMIT;
END;
/
```

## 数据质量检查引擎

### 1. 核心检查引擎

```sql
-- 数据质量检查包
CREATE OR REPLACE PACKAGE pkg_data_quality AS
    
    -- 执行单个规则检查
    PROCEDURE execute_rule_check(
        p_rule_id IN VARCHAR2,
        p_result_id OUT NUMBER
    );
    
    -- 执行批量规则检查
    PROCEDURE execute_batch_check(
        p_rule_type IN VARCHAR2 DEFAULT NULL,
        p_table_name IN VARCHAR2 DEFAULT NULL
    );
    
    -- 生成数据质量报告
    PROCEDURE generate_quality_report(
        p_start_date IN DATE,
        p_end_date IN DATE,
        p_report_type IN VARCHAR2 DEFAULT 'SUMMARY'
    );
    
    -- 修复数据质量问题
    PROCEDURE fix_quality_issues(
        p_issue_type IN VARCHAR2,
        p_auto_fix IN BOOLEAN DEFAULT FALSE
    );
    
END pkg_data_quality;
/

CREATE OR REPLACE PACKAGE BODY pkg_data_quality AS
    
    -- 执行单个规则检查
    PROCEDURE execute_rule_check(
        p_rule_id IN VARCHAR2,
        p_result_id OUT NUMBER
    ) AS
        v_rule_config dq_rule_config%ROWTYPE;
        v_failed_count NUMBER := 0;
        v_total_count NUMBER := 0;
        v_pass_rate NUMBER;
        v_status VARCHAR2(20);
        v_start_time TIMESTAMP;
        v_end_time TIMESTAMP;
        v_duration NUMBER;
        v_error_details CLOB;
        
        CURSOR c_failed_records IS
            SELECT column_value as failed_id FROM TABLE(
                CAST(MULTISET(
                    SELECT REGEXP_SUBSTR(result_column, '[^,]+', 1, level)
                    FROM (
                        SELECT LISTAGG(subquery_result, ',') WITHIN GROUP (ORDER BY 1) as result_column
                        FROM (
                            EXECUTE IMMEDIATE v_rule_config.check_sql
                        )
                    )
                    CONNECT BY REGEXP_SUBSTR(result_column, '[^,]+', 1, level) IS NOT NULL
                ) AS sys.odcivarchar2list)
            );
    BEGIN
        v_start_time := SYSTIMESTAMP;
        
        -- 获取规则配置
        SELECT * INTO v_rule_config
        FROM dq_rule_config
        WHERE rule_id = p_rule_id AND is_active = 'Y';
        
        -- 获取表总记录数
        EXECUTE IMMEDIATE 'SELECT COUNT(*) FROM ' || v_rule_config.table_name
        INTO v_total_count;
        
        -- 执行检查SQL获取失败记录数
        BEGIN
            EXECUTE IMMEDIATE 'SELECT COUNT(*) FROM (' || v_rule_config.check_sql || ')'
            INTO v_failed_count;
        EXCEPTION
            WHEN OTHERS THEN
                v_error_details := 'SQL执行失败: ' || SQLERRM;
                v_failed_count := -1;
        END;
        
        -- 计算通过率
        IF v_total_count > 0 AND v_failed_count >= 0 THEN
            v_pass_rate := ((v_total_count - v_failed_count) / v_total_count) * 100;
        ELSE
            v_pass_rate := 0;
        END IF;
        
        -- 确定状态
        IF v_failed_count = -1 THEN
            v_status := 'ERROR';
        ELSIF v_pass_rate >= v_rule_config.threshold_warning THEN
            v_status := 'PASS';
        ELSIF v_pass_rate >= v_rule_config.threshold_error THEN
            v_status := 'WARNING';
        ELSE
            v_status := 'ERROR';
        END IF;
        
        v_end_time := SYSTIMESTAMP;
        v_duration := EXTRACT(DAY FROM (v_end_time - v_start_time)) * 86400
                    + EXTRACT(HOUR FROM (v_end_time - v_start_time)) * 3600
                    + EXTRACT(MINUTE FROM (v_end_time - v_start_time)) * 60
                    + EXTRACT(SECOND FROM (v_end_time - v_start_time));
        
        -- 插入检查结果
        INSERT INTO dq_check_result (
            result_id, rule_id, check_time, total_records,
            passed_records, failed_records, pass_rate, status,
            error_details, check_duration
        ) VALUES (
            dq_result_seq.NEXTVAL, p_rule_id, SYSDATE, v_total_count,
            v_total_count - v_failed_count, v_failed_count, v_pass_rate, v_status,
            v_error_details, v_duration
        ) RETURNING result_id INTO p_result_id;
        
        -- 记录问题明细（仅在有失败记录且数量不太多时）
        IF v_failed_count > 0 AND v_failed_count <= 1000 THEN
            FOR rec IN c_failed_records LOOP
                INSERT INTO dq_issue_detail (
                    issue_id, result_id, table_name, column_name,
                    record_id, issue_type, issue_description, severity
                ) VALUES (
                    dq_issue_seq.NEXTVAL, p_result_id, v_rule_config.table_name,
                    v_rule_config.column_name, rec.failed_id, v_rule_config.rule_type,
                    v_rule_config.rule_description, 
                    CASE WHEN v_status = 'ERROR' THEN 'HIGH' ELSE 'MEDIUM' END
                );
            END LOOP;
        END IF;
        
        COMMIT;
        
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RAISE_APPLICATION_ERROR(-20001, '规则不存在或已禁用: ' || p_rule_id);
        WHEN OTHERS THEN
            ROLLBACK;
            RAISE;
    END execute_rule_check;
    
    -- 执行批量规则检查
    PROCEDURE execute_batch_check(
        p_rule_type IN VARCHAR2 DEFAULT NULL,
        p_table_name IN VARCHAR2 DEFAULT NULL
    ) AS
        v_result_id NUMBER;
        v_check_count NUMBER := 0;
    BEGIN
        FOR rule_rec IN (
            SELECT rule_id
            FROM dq_rule_config
            WHERE is_active = 'Y'
            AND (p_rule_type IS NULL OR rule_type = p_rule_type)
            AND (p_table_name IS NULL OR table_name = p_table_name)
            ORDER BY rule_id
        ) LOOP
            BEGIN
                execute_rule_check(rule_rec.rule_id, v_result_id);
                v_check_count := v_check_count + 1;
                
                DBMS_OUTPUT.PUT_LINE('规则 ' || rule_rec.rule_id || ' 检查完成，结果ID: ' || v_result_id);
                
            EXCEPTION
                WHEN OTHERS THEN
                    DBMS_OUTPUT.PUT_LINE('规则 ' || rule_rec.rule_id || ' 检查失败: ' || SQLERRM);
            END;
        END LOOP;
        
        DBMS_OUTPUT.PUT_LINE('批量检查完成，共执行 ' || v_check_count || ' 个规则');
    END execute_batch_check;
    
    -- 生成数据质量报告
    PROCEDURE generate_quality_report(
        p_start_date IN DATE,
        p_end_date IN DATE,
        p_report_type IN VARCHAR2 DEFAULT 'SUMMARY'
    ) AS
        v_report CLOB;
        v_total_checks NUMBER;
        v_pass_count NUMBER;
        v_warning_count NUMBER;
        v_error_count NUMBER;
        v_avg_pass_rate NUMBER;
    BEGIN
        -- 获取统计数据
        SELECT 
            COUNT(*),
            SUM(CASE WHEN status = 'PASS' THEN 1 ELSE 0 END),
            SUM(CASE WHEN status = 'WARNING' THEN 1 ELSE 0 END),
            SUM(CASE WHEN status = 'ERROR' THEN 1 ELSE 0 END),
            AVG(pass_rate)
        INTO v_total_checks, v_pass_count, v_warning_count, v_error_count, v_avg_pass_rate
        FROM dq_check_result
        WHERE check_time BETWEEN p_start_date AND p_end_date;
        
        -- 生成报告头部
        v_report := '数据质量检查报告' || CHR(10) ||
                   '报告期间: ' || TO_CHAR(p_start_date, 'YYYY-MM-DD') || 
                   ' 至 ' || TO_CHAR(p_end_date, 'YYYY-MM-DD') || CHR(10) ||
                   '生成时间: ' || TO_CHAR(SYSDATE, 'YYYY-MM-DD HH24:MI:SS') || CHR(10) ||
                   RPAD('=', 50, '=') || CHR(10) || CHR(10);
        
        -- 添加汇总信息
        v_report := v_report ||
                   '检查汇总:' || CHR(10) ||
                   '  总检查次数: ' || v_total_checks || CHR(10) ||
                   '  通过次数: ' || v_pass_count || ' (' || 
                   ROUND(v_pass_count * 100 / v_total_checks, 2) || '%)' || CHR(10) ||
                   '  警告次数: ' || v_warning_count || ' (' || 
                   ROUND(v_warning_count * 100 / v_total_checks, 2) || '%)' || CHR(10) ||
                   '  错误次数: ' || v_error_count || ' (' || 
                   ROUND(v_error_count * 100 / v_total_checks, 2) || '%)' || CHR(10) ||
                   '  平均通过率: ' || ROUND(v_avg_pass_rate, 2) || '%' || CHR(10) || CHR(10);
        
        -- 按规则类型统计
        v_report := v_report || '按规则类型统计:' || CHR(10);
        FOR type_rec IN (
            SELECT 
                rc.rule_type,
                COUNT(*) as check_count,
                AVG(cr.pass_rate) as avg_pass_rate,
                SUM(CASE WHEN cr.status = 'ERROR' THEN 1 ELSE 0 END) as error_count
            FROM dq_check_result cr
            JOIN dq_rule_config rc ON cr.rule_id = rc.rule_id
            WHERE cr.check_time BETWEEN p_start_date AND p_end_date
            GROUP BY rc.rule_type
            ORDER BY rc.rule_type
        ) LOOP
            v_report := v_report ||
                       '  ' || type_rec.rule_type || ': ' ||
                       '检查次数=' || type_rec.check_count ||
                       ', 平均通过率=' || ROUND(type_rec.avg_pass_rate, 2) || '%' ||
                       ', 错误次数=' || type_rec.error_count || CHR(10);
        END LOOP;
        
        -- 详细报告
        IF p_report_type = 'DETAIL' THEN
            v_report := v_report || CHR(10) || '详细检查结果:' || CHR(10);
            FOR detail_rec IN (
                SELECT 
                    cr.rule_id,
                    rc.rule_name,
                    cr.check_time,
                    cr.pass_rate,
                    cr.status,
                    cr.failed_records
                FROM dq_check_result cr
                JOIN dq_rule_config rc ON cr.rule_id = rc.rule_id
                WHERE cr.check_time BETWEEN p_start_date AND p_end_date
                AND cr.status IN ('WARNING', 'ERROR')
                ORDER BY cr.check_time DESC
            ) LOOP
                v_report := v_report ||
                           '  规则: ' || detail_rec.rule_name || CHR(10) ||
                           '    检查时间: ' || TO_CHAR(detail_rec.check_time, 'YYYY-MM-DD HH24:MI:SS') || CHR(10) ||
                           '    通过率: ' || detail_rec.pass_rate || '%' || CHR(10) ||
                           '    状态: ' || detail_rec.status || CHR(10) ||
                           '    失败记录数: ' || detail_rec.failed_records || CHR(10) || CHR(10);
            END LOOP;
        END IF;
        
        -- 输出报告
        DBMS_OUTPUT.PUT_LINE(v_report);
        
        -- 保存报告到表
        INSERT INTO dq_quality_report (
            report_id, report_date, report_type, report_content, create_time
        ) VALUES (
            dq_report_seq.NEXTVAL, TRUNC(SYSDATE), p_report_type, v_report, SYSDATE
        );
        
    END generate_quality_report;
    
    -- 修复数据质量问题
    PROCEDURE fix_quality_issues(
        p_issue_type IN VARCHAR2,
        p_auto_fix IN BOOLEAN DEFAULT FALSE
    ) AS
        v_fixed_count NUMBER := 0;
    BEGIN
        IF p_issue_type = 'PHONE_FORMAT' THEN
            -- 修复手机号格式问题
            FOR phone_rec IN (
                SELECT customer_id, phone
                FROM customer_info
                WHERE phone IS NOT NULL 
                AND LENGTH(phone) = 11
                AND SUBSTR(phone, 1, 1) = '1'
                AND NOT REGEXP_LIKE(phone, '^1[3-9][0-9]{9}$')
            ) LOOP
                IF p_auto_fix THEN
                    -- 自动修复：去除非数字字符
                    UPDATE customer_info 
                    SET phone = REGEXP_REPLACE(phone_rec.phone, '[^0-9]', '')
                    WHERE customer_id = phone_rec.customer_id;
                    
                    v_fixed_count := v_fixed_count + 1;
                ELSE
                    DBMS_OUTPUT.PUT_LINE('客户 ' || phone_rec.customer_id || 
                                       ' 手机号格式异常: ' || phone_rec.phone);
                END IF;
            END LOOP;
            
        ELSIF p_issue_type = 'DUPLICATE_ID_CARD' THEN
            -- 处理重复身份证号
            FOR dup_rec IN (
                SELECT id_card, COUNT(*) as dup_count
                FROM customer_info
                WHERE id_card IS NOT NULL
                GROUP BY id_card
                HAVING COUNT(*) > 1
            ) LOOP
                DBMS_OUTPUT.PUT_LINE('发现重复身份证号: ' || dup_rec.id_card || 
                                   ', 重复次数: ' || dup_rec.dup_count);
                
                -- 重复身份证号需要人工处理，不能自动修复
            END LOOP;
            
        ELSIF p_issue_type = 'NEGATIVE_BALANCE' THEN
            -- 处理负余额账户
            FOR neg_rec IN (
                SELECT account_id, balance
                FROM account_info
                WHERE balance < 0
                AND status = 'ACTIVE'
            ) LOOP
                IF p_auto_fix THEN
                    -- 自动冻结负余额账户
                    UPDATE account_info
                    SET status = 'FROZEN',
                        freeze_reason = '余额为负自动冻结'
                    WHERE account_id = neg_rec.account_id;
                    
                    v_fixed_count := v_fixed_count + 1;
                ELSE
                    DBMS_OUTPUT.PUT_LINE('账户 ' || neg_rec.account_id || 
                                       ' 余额为负: ' || neg_rec.balance);
                END IF;
            END LOOP;
        END IF;
        
        IF p_auto_fix THEN
            COMMIT;
            DBMS_OUTPUT.PUT_LINE('自动修复完成，共修复 ' || v_fixed_count || ' 条记录');
        END IF;
        
    END fix_quality_issues;
    
END pkg_data_quality;
/
```

## 数据质量监控和预警

### 1. 实时监控触发器

```sql
-- 实时数据质量监控触发器
CREATE OR REPLACE TRIGGER trg_realtime_dq_monitor
AFTER INSERT OR UPDATE ON customer_info
FOR EACH ROW
DECLARE
    v_issue_count NUMBER := 0;
    v_issues VARCHAR2(1000) := '';
BEGIN
    -- 检查手机号格式
    IF :NEW.phone IS NOT NULL AND NOT REGEXP_LIKE(:NEW.phone, '^1[3-9][0-9]{9}$') THEN
        v_issue_count := v_issue_count + 1;
        v_issues := v_issues || '手机号格式错误; ';
    END IF;
    
    -- 检查身份证号格式
    IF :NEW.id_card IS NOT NULL AND NOT REGEXP_LIKE(:NEW.id_card, '^[0-9]{17}[0-9X]$') THEN
        v_issue_count := v_issue_count + 1;
        v_issues := v_issues || '身份证号格式错误; ';
    END IF;
    
    -- 检查邮箱格式
    IF :NEW.email IS NOT NULL AND NOT REGEXP_LIKE(:NEW.email, '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$') THEN
        v_issue_count := v_issue_count + 1;
        v_issues := v_issues || '邮箱格式错误; ';
    END IF;
    
    -- 如果发现问题，记录到实时监控表
    IF v_issue_count > 0 THEN
        INSERT INTO dq_realtime_alert (
            alert_id, table_name, record_id, issue_count,
            issue_description, alert_time
        ) VALUES (
            dq_realtime_seq.NEXTVAL, 'customer_info', :NEW.customer_id,
            v_issue_count, v_issues, SYSDATE
        );
    END IF;
END trg_realtime_dq_monitor;
/
```

### 2. 定时监控调度

```sql
-- 创建定时数据质量检查作业
BEGIN
    DBMS_SCHEDULER.CREATE_JOB (
        job_name => 'DQ_DAILY_CHECK_JOB',
        job_type => 'PLSQL_BLOCK',
        job_action => 'BEGIN pkg_data_quality.execute_batch_check(); END;',
        start_date => SYSTIMESTAMP,
        repeat_interval => 'FREQ=DAILY; BYHOUR=2; BYMINUTE=0; BYSECOND=0',
        enabled => TRUE,
        comments => '每日凌晨2点执行数据质量检查'
    );
    
    -- 创建周报生成作业
    DBMS_SCHEDULER.CREATE_JOB (
        job_name => 'DQ_WEEKLY_REPORT_JOB',
        job_type => 'PLSQL_BLOCK',
        job_action => 'BEGIN pkg_data_quality.generate_quality_report(SYSDATE-7, SYSDATE, ''DETAIL''); END;',
        start_date => SYSTIMESTAMP,
        repeat_interval => 'FREQ=WEEKLY; BYDAY=MON; BYHOUR=8; BYMINUTE=0; BYSECOND=0',
        enabled => TRUE,
        comments => '每周一上午8点生成数据质量周报'
    );
END;
/
```

## 数据清洗和标准化

### 1. 数据清洗函数

```sql
-- 数据清洗函数包
CREATE OR REPLACE PACKAGE pkg_data_cleansing AS
    
    FUNCTION clean_phone_number(p_phone VARCHAR2) RETURN VARCHAR2;
    FUNCTION clean_id_card(p_id_card VARCHAR2) RETURN VARCHAR2;
    FUNCTION clean_email(p_email VARCHAR2) RETURN VARCHAR2;
    FUNCTION standardize_address(p_address VARCHAR2) RETURN VARCHAR2;
    FUNCTION clean_amount(p_amount VARCHAR2) RETURN NUMBER;
    
END pkg_data_cleansing;
/

CREATE OR REPLACE PACKAGE BODY pkg_data_cleansing AS
    
    FUNCTION clean_phone_number(p_phone VARCHAR2) RETURN VARCHAR2 AS
        v_cleaned VARCHAR2(32767);
    BEGIN
        IF p_phone IS NULL THEN
            RETURN NULL;
        END IF;
        
        -- 去除所有非数字字符
        v_cleaned := REGEXP_REPLACE(p_phone, '[^0-9]', '');
        
        -- 检查长度和格式
        IF LENGTH(v_cleaned) = 11 AND SUBSTR(v_cleaned, 1, 1) = '1' THEN
            RETURN v_cleaned;
        ELSE
            RETURN NULL; -- 无法清洗的返回NULL
        END IF;
    END clean_phone_number;
    
    FUNCTION clean_id_card(p_id_card VARCHAR2) RETURN VARCHAR2 AS
        v_cleaned VARCHAR2(32767);
    BEGIN
        IF p_id_card IS NULL THEN
            RETURN NULL;
        END IF;
        
        -- 转换为大写并去除空格
        v_cleaned := UPPER(TRIM(p_id_card));
        
        -- 检查格式
        IF REGEXP_LIKE(v_cleaned, '^[0-9]{17}[0-9X]$') THEN
            RETURN v_cleaned;
        ELSE
            RETURN NULL;
        END IF;
    END clean_id_card;
    
    FUNCTION clean_email(p_email VARCHAR2) RETURN VARCHAR2 AS
        v_cleaned VARCHAR2(100);
    BEGIN
        IF p_email IS NULL THEN
            RETURN NULL;
        END IF;
        
        -- 转换为小写并去除空格
        v_cleaned := LOWER(TRIM(p_email));
        
        -- 检查格式
        IF REGEXP_LIKE(v_cleaned, '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$') THEN
            RETURN v_cleaned;
        ELSE
            RETURN NULL;
        END IF;
    END clean_email;
    
    FUNCTION standardize_address(p_address VARCHAR2) RETURN VARCHAR2 AS
        v_standardized VARCHAR2(500);
    BEGIN
        IF p_address IS NULL THEN
            RETURN NULL;
        END IF;
        
        v_standardized := TRIM(p_address);
        
        -- 标准化常见地址词汇
        v_standardized := REPLACE(v_standardized, '　', ' '); -- 全角空格转半角
        v_standardized := REGEXP_REPLACE(v_standardized, '\s+', ' '); -- 多个空格合并
        v_standardized := REPLACE(v_standardized, '路口', '路');
        v_standardized := REPLACE(v_standardized, '大厦', '大厦');
        v_standardized := REPLACE(v_standardized, '小区', '小区');
        
        RETURN v_standardized;
    END standardize_address;
    
    FUNCTION clean_amount(p_amount VARCHAR2) RETURN NUMBER AS
        v_cleaned VARCHAR2(50);
        v_amount NUMBER;
    BEGIN
        IF p_amount IS NULL THEN
            RETURN NULL;
        END IF;
        
        -- 去除货币符号和千分位分隔符
        v_cleaned := TRIM(p_amount);
        v_cleaned := REPLACE(v_cleaned, '¥', '');
        v_cleaned := REPLACE(v_cleaned, '$', '');
        v_cleaned := REPLACE(v_cleaned, ',', '');
        v_cleaned := TRIM(v_cleaned);
        
        -- 转换为数字
        BEGIN
            v_amount := TO_NUMBER(v_cleaned);
            RETURN v_amount;
        EXCEPTION
            WHEN OTHERS THEN
                RETURN NULL;
        END;
    END clean_amount;
    
END pkg_data_cleansing;
/
```

### 2. 批量数据清洗

```sql
-- 批量数据清洗过程
CREATE OR REPLACE PROCEDURE batch_data_cleansing AS
    v_processed_count NUMBER := 0;
    v_cleaned_count NUMBER := 0;
BEGIN
    DBMS_OUTPUT.PUT_LINE('开始批量数据清洗...');
    
    -- 清洗客户信息表
    FOR cust_rec IN (
        SELECT customer_id, phone, id_card, email, address
        FROM customer_info
        WHERE update_time < SYSDATE - 1 -- 只处理一天前的数据
    ) LOOP
        DECLARE
            v_new_phone VARCHAR2(11);
            v_new_id_card VARCHAR2(18);
            v_new_email VARCHAR2(100);
            v_new_address VARCHAR2(500);
            v_has_changes BOOLEAN := FALSE;
        BEGIN
            v_processed_count := v_processed_count + 1;
            
            -- 清洗手机号
            v_new_phone := pkg_data_cleansing.clean_phone_number(cust_rec.phone);
            IF v_new_phone != cust_rec.phone OR (v_new_phone IS NULL AND cust_rec.phone IS NOT NULL) THEN
                v_has_changes := TRUE;
            END IF;
            
            -- 清洗身份证号
            v_new_id_card := pkg_data_cleansing.clean_id_card(cust_rec.id_card);
            IF v_new_id_card != cust_rec.id_card OR (v_new_id_card IS NULL AND cust_rec.id_card IS NOT NULL) THEN
                v_has_changes := TRUE;
            END IF;
            
            -- 清洗邮箱
            v_new_email := pkg_data_cleansing.clean_email(cust_rec.email);
            IF v_new_email != cust_rec.email OR (v_new_email IS NULL AND cust_rec.email IS NOT NULL) THEN
                v_has_changes := TRUE;
            END IF;
            
            -- 清洗地址
            v_new_address := pkg_data_cleansing.standardize_address(cust_rec.address);
            IF v_new_address != cust_rec.address THEN
                v_has_changes := TRUE;
            END IF;
            
            -- 如果有变更，更新记录
            IF v_has_changes THEN
                UPDATE customer_info SET
                    phone = v_new_phone,
                    id_card = v_new_id_card,
                    email = v_new_email,
                    address = v_new_address,
                    update_time = SYSDATE
                WHERE customer_id = cust_rec.customer_id;
                
                v_cleaned_count := v_cleaned_count + 1;
                
                -- 记录清洗日志
                INSERT INTO data_cleansing_log (
                    log_id, table_name, record_id, 
                    original_values, cleaned_values, cleansing_time
                ) VALUES (
                    cleansing_log_seq.NEXTVAL, 'customer_info', cust_rec.customer_id,
                    'phone:' || cust_rec.phone || '|id_card:' || cust_rec.id_card || 
                    '|email:' || cust_rec.email || '|address:' || cust_rec.address,
                    'phone:' || v_new_phone || '|id_card:' || v_new_id_card || 
                    '|email:' || v_new_email || '|address:' || v_new_address,
                    SYSDATE
                );
            END IF;
            
            -- 每1000条提交一次
            IF MOD(v_processed_count, 1000) = 0 THEN
                COMMIT;
                DBMS_OUTPUT.PUT_LINE('已处理 ' || v_processed_count || ' 条记录');
            END IF;
            
        EXCEPTION
            WHEN OTHERS THEN
                DBMS_OUTPUT.PUT_LINE('处理客户 ' || cust_rec.customer_id || ' 时出错: ' || SQLERRM);
        END;
    END LOOP;
    
    COMMIT;
    
    DBMS_OUTPUT.PUT_LINE('批量数据清洗完成');
    DBMS_OUTPUT.PUT_LINE('总处理记录数: ' || v_processed_count);
    DBMS_OUTPUT.PUT_LINE('清洗记录数: ' || v_cleaned_count);
    DBMS_OUTPUT.PUT_LINE('清洗率: ' || ROUND(v_cleaned_count * 100 / v_processed_count, 2) || '%');
    
END batch_data_cleansing;
/
```

## 数据质量指标和度量

### 1. 质量指标计算

```sql
-- 数据质量指标视图
CREATE OR REPLACE VIEW v_data_quality_metrics AS
SELECT 
    'customer_info' as table_name,
    'completeness' as metric_type,
    'customer_name' as column_name,
    ROUND((COUNT(*) - COUNT(CASE WHEN customer_name IS NULL THEN 1 END)) * 100.0 / COUNT(*), 2) as score,
    COUNT(*) as total_records,
    COUNT(CASE WHEN customer_name IS NULL THEN 1 END) as null_count
FROM customer_info
UNION ALL
SELECT 
    'customer_info',
    'validity',
    'phone',
    ROUND(COUNT(CASE WHEN phone IS NOT NULL AND REGEXP_LIKE(phone, '^1[3-9][0-9]{9}$') THEN 1 END) * 100.0 / 
          COUNT(CASE WHEN phone IS NOT NULL THEN 1 END), 2),
    COUNT(CASE WHEN phone IS NOT NULL THEN 1 END),
    COUNT(CASE WHEN phone IS NOT NULL AND NOT REGEXP_LIKE(phone, '^1[3-9][0-9]{9}$') THEN 1 END)
FROM customer_info
UNION ALL
SELECT 
    'account_info',
    'consistency',
    'balance',
    ROUND(COUNT(CASE WHEN ai.balance = (
        SELECT NVL(SUM(CASE WHEN tl.trans_type IN ('DEPOSIT', 'TRANSFER_IN') THEN tl.amount
                          WHEN tl.trans_type IN ('WITHDRAW', 'TRANSFER_OUT') THEN -tl.amount
                          ELSE 0 END), 0)
        FROM transaction_log tl 
        WHERE tl.account_id = ai.account_id AND tl.status = 'SUCCESS'
    ) THEN 1 END) * 100.0 / COUNT(*), 2),
    COUNT(*),
    COUNT(*) - COUNT(CASE WHEN ai.balance = (
        SELECT NVL(SUM(CASE WHEN tl.trans_type IN ('DEPOSIT', 'TRANSFER_IN') THEN tl.amount
                          WHEN tl.trans_type IN ('WITHDRAW', 'TRANSFER_OUT') THEN -tl.amount
                          ELSE 0 END), 0)
        FROM transaction_log tl 
        WHERE tl.account_id = ai.account_id AND tl.status = 'SUCCESS'
    ) THEN 1 END)
FROM account_info ai;
```

### 2. 质量趋势分析

```sql
-- 数据质量趋势分析函数
CREATE OR REPLACE FUNCTION analyze_quality_trend(
    p_days IN NUMBER DEFAULT 30
) RETURN CLOB AS
    v_result CLOB;
    v_current_score NUMBER;
    v_previous_score NUMBER;
    v_trend VARCHAR2(20);
BEGIN
    v_result := '数据质量趋势分析（最近' || p_days || '天）' || CHR(10) || CHR(10);
    
    -- 分析各个质量维度的趋势
    FOR metric_rec IN (
        SELECT DISTINCT rule_type FROM dq_rule_config WHERE is_active = 'Y'
    ) LOOP
        -- 获取最近平均分数
        SELECT AVG(pass_rate)
        INTO v_current_score
        FROM dq_check_result cr
        JOIN dq_rule_config rc ON cr.rule_id = rc.rule_id
        WHERE rc.rule_type = metric_rec.rule_type
        AND cr.check_time >= SYSDATE - 7;
        
        -- 获取之前平均分数
        SELECT AVG(pass_rate)
        INTO v_previous_score
        FROM dq_check_result cr
        JOIN dq_rule_config rc ON cr.rule_id = rc.rule_id
        WHERE rc.rule_type = metric_rec.rule_type
        AND cr.check_time BETWEEN SYSDATE - p_days AND SYSDATE - 7;
        
        -- 判断趋势
        IF v_current_score > v_previous_score + 2 THEN
            v_trend := '上升 ↗';
        ELSIF v_current_score < v_previous_score - 2 THEN
            v_trend := '下降 ↘';
        ELSE
            v_trend := '平稳 →';
        END IF;
        
        v_result := v_result || 
                   metric_rec.rule_type || ': ' ||
                   '当前=' || ROUND(v_current_score, 2) || '%, ' ||
                   '之前=' || ROUND(v_previous_score, 2) || '%, ' ||
                   '趋势=' || v_trend || CHR(10);
    END LOOP;
    
    RETURN v_result;
END analyze_quality_trend;
/
```

本文以简化示例展示Oracle银行数据质量管理中的检查规则、自动化监控、数据清洗和质量度量机制，目标是为业务决策和风险控制提供数据质量支持；实际效果取决于业务口径、数据覆盖、实现正确性和运行控制，不能据此保证银行数据达到高质量标准。