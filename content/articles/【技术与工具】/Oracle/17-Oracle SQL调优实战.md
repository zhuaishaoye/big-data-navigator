---
title: Oracle SQL调优实战
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
  - 数据库开发与运维人员
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-22
updated: 2026-10-10
---


# Oracle SQL调优实战

## SQL调优基础概念

SQL调优是提升Oracle数据库性能的核心技能，特别在银行系统中，良好的SQL性能直接影响客户体验和业务处理效率。SQL调优不仅涉及语句重写，还包括索引优化、统计信息管理和执行计划分析。

### 1. SQL调优的基本原则

**减少数据访问量**
- 只查询需要的列和行
- 使用WHERE条件过滤数据
- 避免不必要的排序和分组

**优化连接操作**
- 选择合适的连接类型
- 根据连接方式、选择性及实际执行计划评估是否为连接列建立索引
- 控制连接顺序

**充分利用索引**
- 根据过滤选择性、排序与分组需求、组合索引顺序及写入维护成本评估索引，不必为所有相关列建立索引
- 避免在索引列上使用函数
- 合理使用复合索引

**减少IO操作**
- 使用绑定变量
- 合理使用HINT
- 优化执行计划

## 执行计划分析

### 1. 查看和分析执行计划

```sql
-- 查看SQL执行计划的几种方法

-- 方法1：使用EXPLAIN PLAN
EXPLAIN PLAN FOR
SELECT c.customer_name, a.account_id, a.balance
FROM customer_info c
JOIN account_info a ON c.customer_id = a.customer_id
WHERE c.customer_grade = 'GOLD'
AND a.balance > 100000;

-- 查看执行计划
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);

-- 方法2：使用DBMS_XPLAN.DISPLAY_CURSOR（实际执行计划）
SELECT /*+ GATHER_PLAN_STATISTICS */ 
    c.customer_name, a.account_id, a.balance
FROM customer_info c
JOIN account_info a ON c.customer_id = a.customer_id
WHERE c.customer_grade = 'GOLD'
AND a.balance > 100000;

-- 查看实际执行计划
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'ALLSTATS LAST'));

-- 方法3：使用SQL Developer或Enterprise Manager的图形化界面
```

### 2. 执行计划关键信息解读

```sql
-- 创建执行计划分析函数
CREATE OR REPLACE FUNCTION analyze_execution_plan(
    p_sql_id VARCHAR2
) RETURN CLOB AS
    v_plan_output CLOB;
    v_analysis CLOB;
    v_cost NUMBER;
    v_rows NUMBER;
    v_time NUMBER;
BEGIN
    -- 获取执行计划
    SELECT plan_table_output
    INTO v_plan_output
    FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(p_sql_id, NULL, 'ADVANCED'));
    
    -- 获取基本统计信息
    SELECT cost, cardinality, elapsed_time
    INTO v_cost, v_rows, v_time
    FROM v$sql
    WHERE sql_id = p_sql_id
    AND ROWNUM = 1;
    
    v_analysis := '=== SQL执行计划分析 ===' || CHR(10) ||
                  'SQL ID: ' || p_sql_id || CHR(10) ||
                  '成本: ' || v_cost || CHR(10) ||
                  '预估行数: ' || v_rows || CHR(10) ||
                  '执行时间: ' || ROUND(v_time/1000000, 2) || ' 秒' || CHR(10) || CHR(10) ||
                  '=== 详细执行计划 ===' || CHR(10) ||
                  v_plan_output || CHR(10) || CHR(10);
    
    -- 添加优化建议
    v_analysis := v_analysis || '=== 优化建议 ===' || CHR(10);
    
    IF v_cost > 1000 THEN
        v_analysis := v_analysis || '• 成本较高，检查是否缺少索引' || CHR(10);
    END IF;
    
    IF v_time > 5000000 THEN -- 超过5秒
        v_analysis := v_analysis || '• 执行时间过长，考虑重写SQL或优化索引' || CHR(10);
    END IF;
    
    RETURN v_analysis;
    
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN 'SQL ID ' || p_sql_id || ' 未找到';
    WHEN OTHERS THEN
        RETURN '分析执行计划时出错: ' || SQLERRM;
END analyze_execution_plan;
/
```

## 银行业务SQL调优实例

### 1. 客户查询优化

```sql
-- 原始业务查询示例：效率需结合实际执行计划和测量判断
SELECT c.customer_id, c.customer_name, c.phone, c.email,
       a.account_id, a.balance, a.account_type,
       t.trans_count, t.total_amount
FROM customer_info c
LEFT JOIN account_info a ON c.customer_id = a.customer_id
LEFT JOIN (
    SELECT account_id, 
           COUNT(*) as trans_count,
           SUM(amount) as total_amount
    FROM transaction_log
    WHERE trans_date >= TRUNC(SYSDATE) - 30
    GROUP BY account_id
) t ON a.account_id = t.account_id
WHERE c.customer_grade IN ('GOLD', 'PLATINUM', 'DIAMOND')
ORDER BY c.customer_name;

-- 候选查询：添加索引提示并改变日期、状态及NULL口径，不是原查询的等价重写
SELECT /*+ INDEX(c idx_customer_grade)
           INDEX(a idx_account_customer) */
       c.customer_id, c.customer_name, c.phone, c.email,
       a.account_id, a.balance, a.account_type,
       NVL(t.trans_count, 0) as trans_count,
       NVL(t.total_amount, 0) as total_amount
FROM customer_info c
LEFT JOIN account_info a ON c.customer_id = a.customer_id
LEFT JOIN (
    SELECT account_id, 
           COUNT(*) as trans_count,
           SUM(amount) as total_amount
    FROM transaction_log
    WHERE trans_date BETWEEN TRUNC(SYSDATE) - 30 AND TRUNC(SYSDATE)
    AND status = 'SUCCESS'  -- 添加状态过滤
    GROUP BY account_id
) t ON a.account_id = t.account_id
WHERE c.customer_grade IN ('GOLD', 'PLATINUM', 'DIAMOND')
AND c.status = 'ACTIVE'  -- 添加客户状态过滤
ORDER BY c.customer_name;

-- 创建必要的索引
CREATE INDEX idx_customer_grade ON customer_info(customer_grade, status);
CREATE INDEX idx_account_customer ON account_info(customer_id, status);
CREATE INDEX idx_trans_date_account ON transaction_log(trans_date, account_id, status);
```

### 2. 交易统计查询优化

```sql
-- 原始交易统计示例：访问路径与性能需由实际执行计划和测量确认
SELECT DATE_TRUNC('month', trans_date) as month_year,
       trans_type,
       COUNT(*) as trans_count,
       SUM(amount) as total_amount,
       AVG(amount) as avg_amount
FROM transaction_log
WHERE trans_date >= DATE '2023-01-01'
GROUP BY DATE_TRUNC('month', trans_date), trans_type
ORDER BY month_year, trans_type;

-- 候选交易统计查询：使用并行提示并改变日期、状态和均值口径；本查询未展示分区定义或读取预计算结果
SELECT /*+ PARALLEL(tl, 4) */
       TRUNC(trans_date, 'MM') as month_year,
       trans_type,
       COUNT(*) as trans_count,
       SUM(amount) as total_amount,
       ROUND(AVG(amount), 2) as avg_amount
FROM transaction_log tl
WHERE trans_date >= DATE '2023-01-01'
AND trans_date < DATE '2024-01-01'  -- 使用范围查询
AND status = 'SUCCESS'  -- 只统计成功交易
GROUP BY TRUNC(trans_date, 'MM'), trans_type
ORDER BY month_year, trans_type;

-- 创建月度统计物化视图
CREATE MATERIALIZED VIEW mv_monthly_transaction_stats
BUILD IMMEDIATE
REFRESH FAST ON DEMAND
AS
SELECT TRUNC(trans_date, 'MM') as month_year,
       trans_type,
       COUNT(*) as trans_count,
       SUM(amount) as total_amount,
       ROUND(AVG(amount), 2) as avg_amount,
       COUNT(*) as mv_count  -- 用于快速刷新
FROM transaction_log
WHERE status = 'SUCCESS'
GROUP BY TRUNC(trans_date, 'MM'), trans_type;

-- 创建物化视图日志以支持快速刷新
CREATE MATERIALIZED VIEW LOG ON transaction_log
WITH ROWID, SEQUENCE(trans_date, trans_type, amount, status)
INCLUDING NEW VALUES;
```

### 3. 复杂报表查询优化

```sql
-- 银行客户价值分析报表优化
-- 原始报表查询：包含多次相关子查询，效率需实测
SELECT c.customer_id,
       c.customer_name,
       c.customer_grade,
       (SELECT SUM(balance) FROM account_info WHERE customer_id = c.customer_id) as total_balance,
       (SELECT COUNT(*) FROM account_info WHERE customer_id = c.customer_id) as account_count,
       (SELECT COUNT(*) FROM transaction_log tl 
        JOIN account_info ai ON tl.account_id = ai.account_id 
        WHERE ai.customer_id = c.customer_id 
        AND tl.trans_date >= TRUNC(SYSDATE) - 365) as yearly_trans_count,
       (SELECT SUM(amount) FROM transaction_log tl 
        JOIN account_info ai ON tl.account_id = ai.account_id 
        WHERE ai.customer_id = c.customer_id 
        AND tl.trans_date >= TRUNC(SYSDATE) - 365
        AND tl.trans_type = 'DEPOSIT') as yearly_deposit_amount
FROM customer_info c
WHERE c.status = 'ACTIVE'
ORDER BY total_balance DESC;

-- 候选报表查询：使用预聚合和JOIN，同时改变账户状态、交易状态、NULL及排序口径，不是等价重写
WITH customer_accounts AS (
    SELECT customer_id,
           SUM(balance) as total_balance,
           COUNT(*) as account_count
    FROM account_info
    WHERE status = 'ACTIVE'
    GROUP BY customer_id
),
customer_transactions AS (
    SELECT ai.customer_id,
           COUNT(*) as yearly_trans_count,
           SUM(CASE WHEN tl.trans_type = 'DEPOSIT' THEN tl.amount ELSE 0 END) as yearly_deposit_amount
    FROM transaction_log tl
    JOIN account_info ai ON tl.account_id = ai.account_id
    WHERE tl.trans_date >= TRUNC(SYSDATE) - 365
    AND tl.status = 'SUCCESS'
    AND ai.status = 'ACTIVE'
    GROUP BY ai.customer_id
)
SELECT c.customer_id,
       c.customer_name,
       c.customer_grade,
       NVL(ca.total_balance, 0) as total_balance,
       NVL(ca.account_count, 0) as account_count,
       NVL(ct.yearly_trans_count, 0) as yearly_trans_count,
       NVL(ct.yearly_deposit_amount, 0) as yearly_deposit_amount
FROM customer_info c
LEFT JOIN customer_accounts ca ON c.customer_id = ca.customer_id
LEFT JOIN customer_transactions ct ON c.customer_id = ct.customer_id
WHERE c.status = 'ACTIVE'
ORDER BY ca.total_balance DESC NULLS LAST;
```

## SQL重写技巧

### 1. 条件优化技巧

```sql
-- 避免在WHERE子句中使用函数
-- 错误示例
SELECT * FROM transaction_log 
WHERE TO_CHAR(trans_date, 'YYYY-MM') = '2023-12';

-- 正确示例
SELECT * FROM transaction_log 
WHERE trans_date >= DATE '2023-12-01' 
AND trans_date < DATE '2024-01-01';

-- 对比IN与EXISTS的等价写法；性能取决于实际执行计划和数据分布
-- IN查询示例，效率需实测
SELECT * FROM customer_info 
WHERE customer_id IN (
    SELECT customer_id FROM account_info WHERE balance > 1000000
);

-- EXISTS查询示例，效率需实测
SELECT * FROM customer_info c
WHERE EXISTS (
    SELECT 1 FROM account_info a 
    WHERE a.customer_id = c.customer_id 
    AND a.balance > 1000000
);

-- 使用UNION ALL替代UNION（当确定没有重复数据时）
SELECT customer_id, 'HIGH_VALUE' as type FROM customer_info WHERE customer_grade = 'DIAMOND'
UNION ALL
SELECT customer_id, 'MEDIUM_VALUE' as type FROM customer_info WHERE customer_grade = 'GOLD'
UNION ALL
SELECT customer_id, 'LOW_VALUE' as type FROM customer_info WHERE customer_grade = 'SILVER';
```

### 2. 连接优化技巧

```sql
-- 银行账户余额对账优化
-- 原始SQL：使用逗号连接，已提供两组连接条件，并非笛卡尔积
SELECT c.customer_name, a.account_id, a.balance, 
       SUM(CASE WHEN t.trans_type IN ('DEPOSIT', 'TRANSFER_IN') THEN t.amount ELSE -t.amount END) as calculated_balance
FROM customer_info c, account_info a, transaction_log t
WHERE c.customer_id = a.customer_id
AND a.account_id = t.account_id
GROUP BY c.customer_name, a.account_id, a.balance;

-- 候选对账查询：明确连接并新增过滤，同时改变交易类型处理和无交易账户返回规则，不是等价重写
SELECT c.customer_name, 
       a.account_id, 
       a.balance,
       NVL(calc.calculated_balance, 0) as calculated_balance,
       a.balance - NVL(calc.calculated_balance, 0) as difference
FROM customer_info c
JOIN account_info a ON c.customer_id = a.customer_id
LEFT JOIN (
    SELECT account_id,
           SUM(CASE 
               WHEN trans_type IN ('DEPOSIT', 'TRANSFER_IN') THEN amount 
               WHEN trans_type IN ('WITHDRAW', 'TRANSFER_OUT') THEN -amount 
               ELSE 0 
           END) as calculated_balance
    FROM transaction_log
    WHERE status = 'SUCCESS'
    GROUP BY account_id
) calc ON a.account_id = calc.account_id
WHERE c.status = 'ACTIVE'
AND a.status = 'ACTIVE';
```

## 高级调优技术

### 1. 分析函数优化

```sql
-- 使用分析函数优化排名查询
-- 银行客户资产排名
SELECT customer_id,
       customer_name,
       total_assets,
       RANK() OVER (ORDER BY total_assets DESC) as asset_rank,
       NTILE(10) OVER (ORDER BY total_assets DESC) as asset_decile,
       LAG(total_assets) OVER (ORDER BY total_assets DESC) as prev_customer_assets,
       total_assets - LAG(total_assets) OVER (ORDER BY total_assets DESC) as asset_gap
FROM (
    SELECT c.customer_id,
           c.customer_name,
           SUM(a.balance) as total_assets
    FROM customer_info c
    JOIN account_info a ON c.customer_id = a.customer_id
    WHERE c.status = 'ACTIVE' AND a.status = 'ACTIVE'
    GROUP BY c.customer_id, c.customer_name
);

-- 使用分析函数计算移动平均
SELECT trans_date,
       daily_amount,
       AVG(daily_amount) OVER (
           ORDER BY trans_date 
           ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
       ) as moving_avg_7rows,
       SUM(daily_amount) OVER (
           ORDER BY trans_date 
           ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
       ) as rolling_sum_30rows
FROM (
    SELECT TRUNC(trans_date) as trans_date,
           SUM(amount) as daily_amount
    FROM transaction_log
    WHERE trans_date >= TRUNC(SYSDATE) - 90
    AND status = 'SUCCESS'
    GROUP BY TRUNC(trans_date)
)
ORDER BY trans_date;
```

### 2. 绑定变量使用

```sql
-- 创建使用绑定变量的存储过程
CREATE OR REPLACE PROCEDURE get_customer_transactions(
    p_customer_id IN VARCHAR2,
    p_start_date IN DATE,
    p_end_date IN DATE,
    p_cursor OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_cursor FOR
    SELECT t.trans_id,
           t.trans_date,
           t.trans_type,
           t.amount,
           t.description,
           a.account_id
    FROM transaction_log t
    JOIN account_info a ON t.account_id = a.account_id
    WHERE a.customer_id = p_customer_id
    AND t.trans_date BETWEEN p_start_date AND p_end_date
    AND t.status = 'SUCCESS'
    ORDER BY t.trans_date DESC;
END get_customer_transactions;
/

-- 反例：直接拼接表名和任意条件存在SQL注入风险，不能作为安全绑定变量方案
CREATE OR REPLACE FUNCTION build_dynamic_query(
    p_table_name VARCHAR2,
    p_conditions VARCHAR2
) RETURN VARCHAR2 AS
    v_sql VARCHAR2(4000);
BEGIN
    v_sql := 'SELECT * FROM ' || p_table_name || 
             ' WHERE 1=1 ' || p_conditions;
    RETURN v_sql;
END;
/

-- 正确的动态SQL使用方式
DECLARE
    v_sql VARCHAR2(1000);
    v_cursor SYS_REFCURSOR;
    v_customer_id VARCHAR2(20) := 'CUST001';
    v_start_date DATE := DATE '2023-01-01';
BEGIN
    v_sql := 'SELECT trans_id, amount FROM transaction_log t ' ||
             'JOIN account_info a ON t.account_id = a.account_id ' ||
             'WHERE a.customer_id = :1 AND t.trans_date >= :2';
    
    OPEN v_cursor FOR v_sql USING v_customer_id, v_start_date;
    -- 处理结果
    CLOSE v_cursor;
END;
/
```

## SQL调优工具和监控

### 1. SQL调优包

```sql
-- SQL调优分析包
CREATE OR REPLACE PACKAGE pkg_sql_tuning AS
    
    PROCEDURE analyze_slow_sql(p_threshold_seconds NUMBER DEFAULT 5);
    PROCEDURE generate_tuning_report(p_sql_id VARCHAR2);
    PROCEDURE auto_create_index_suggestions;
    FUNCTION get_sql_profile_recommendations(p_sql_id VARCHAR2) RETURN CLOB;
    
END pkg_sql_tuning;
/

CREATE OR REPLACE PACKAGE BODY pkg_sql_tuning AS
    
    PROCEDURE analyze_slow_sql(p_threshold_seconds NUMBER DEFAULT 5) AS
    BEGIN
        DBMS_OUTPUT.PUT_LINE('慢SQL分析报告（执行时间 > ' || p_threshold_seconds || ' 秒）');
        DBMS_OUTPUT.PUT_LINE(RPAD('=', 80, '='));
        DBMS_OUTPUT.PUT_LINE(RPAD('SQL_ID', 15) || RPAD('执行次数', 10) || 
                            RPAD('平均耗时', 12) || RPAD('总耗时', 12) || '业务模块');
        DBMS_OUTPUT.PUT_LINE(RPAD('-', 80, '-'));
        
        FOR slow_sql IN (
            SELECT sql_id,
                   executions,
                   ROUND(elapsed_time / executions / 1000000, 2) as avg_seconds,
                   ROUND(elapsed_time / 1000000, 2) as total_seconds,
                   CASE 
                       WHEN UPPER(sql_text) LIKE '%CUSTOMER_INFO%' THEN 'Customer'
                       WHEN UPPER(sql_text) LIKE '%ACCOUNT_INFO%' THEN 'Account'
                       WHEN UPPER(sql_text) LIKE '%TRANSACTION_LOG%' THEN 'Transaction'
                       ELSE 'Other'
                   END as module
            FROM v$sql
            WHERE executions > 0
            AND elapsed_time / executions / 1000000 > p_threshold_seconds
            ORDER BY elapsed_time DESC
            FETCH FIRST 20 ROWS ONLY
        ) LOOP
            DBMS_OUTPUT.PUT_LINE(
                RPAD(slow_sql.sql_id, 15) ||
                RPAD(slow_sql.executions, 10) ||
                RPAD(slow_sql.avg_seconds, 12) ||
                RPAD(slow_sql.total_seconds, 12) ||
                slow_sql.module
            );
        END LOOP;
    END analyze_slow_sql;
    
    PROCEDURE generate_tuning_report(p_sql_id VARCHAR2) AS
        v_task_name VARCHAR2(30);
        v_report CLOB;
    BEGIN
        -- 创建SQL调优任务
        v_task_name := 'TUNE_' || p_sql_id || '_' || TO_CHAR(SYSDATE, 'YYYYMMDDHH24MI');
        
        v_task_name := DBMS_SQLTUNE.CREATE_TUNING_TASK(
            sql_id => p_sql_id,
            task_name => v_task_name
        );
        
        -- 执行调优任务
        DBMS_SQLTUNE.EXECUTE_TUNING_TASK(v_task_name);
        
        -- 获取调优报告
        v_report := DBMS_SQLTUNE.REPORT_TUNING_TASK(v_task_name);
        
        DBMS_OUTPUT.PUT_LINE('SQL调优报告:');
        DBMS_OUTPUT.PUT_LINE(v_report);
        
        -- 清理调优任务
        DBMS_SQLTUNE.DROP_TUNING_TASK(v_task_name);
        
    EXCEPTION
        WHEN OTHERS THEN
            DBMS_OUTPUT.PUT_LINE('生成调优报告失败: ' || SQLERRM);
    END generate_tuning_report;
    
    PROCEDURE auto_create_index_suggestions AS
        v_suggestion_count NUMBER := 0;
    BEGIN
        DBMS_OUTPUT.PUT_LINE('自动索引建议分析');
        DBMS_OUTPUT.PUT_LINE(RPAD('=', 60, '='));
        
        -- 分析缺少索引的WHERE条件
        FOR idx_suggestion IN (
            SELECT DISTINCT 
                   table_name,
                   column_name,
                   COUNT(*) as usage_count
            FROM (
                SELECT 
                    REGEXP_SUBSTR(UPPER(sql_text), 'FROM\s+(\w+)', 1, 1, NULL, 1) as table_name,
                    REGEXP_SUBSTR(UPPER(sql_text), 'WHERE\s+(\w+)', 1, 1, NULL, 1) as column_name
                FROM v$sql
                WHERE UPPER(sql_text) LIKE '%WHERE%'
                AND executions > 10
                AND elapsed_time / executions > 1000000 -- 平均执行时间超过1秒
            )
            WHERE table_name IS NOT NULL 
            AND column_name IS NOT NULL
            AND table_name IN ('CUSTOMER_INFO', 'ACCOUNT_INFO', 'TRANSACTION_LOG')
            GROUP BY table_name, column_name
            HAVING COUNT(*) >= 5 -- 至少匹配5条游标记录，不代表SQL执行次数
            ORDER BY usage_count DESC
        ) LOOP
            -- 检查索引是否已存在
            DECLARE
                v_index_exists NUMBER;
            BEGIN
                SELECT COUNT(*)
                INTO v_index_exists
                FROM user_ind_columns
                WHERE table_name = idx_suggestion.table_name
                AND column_name = idx_suggestion.column_name;
                
                IF v_index_exists = 0 THEN
                    DBMS_OUTPUT.PUT_LINE(
                        '建议创建索引: CREATE INDEX idx_' || 
                        LOWER(idx_suggestion.table_name) || '_' || 
                        LOWER(idx_suggestion.column_name) || 
                        ' ON ' || idx_suggestion.table_name || 
                        '(' || idx_suggestion.column_name || ');'
                    );
                    v_suggestion_count := v_suggestion_count + 1;
                END IF;
            END;
        END LOOP;
        
        DBMS_OUTPUT.PUT_LINE('');
        DBMS_OUTPUT.PUT_LINE('共生成 ' || v_suggestion_count || ' 个索引建议');
    END auto_create_index_suggestions;
    
    FUNCTION get_sql_profile_recommendations(p_sql_id VARCHAR2) RETURN CLOB AS
        v_recommendations CLOB;
    BEGIN
        v_recommendations := 'SQL Profile建议 (' || p_sql_id || ')' || CHR(10) || CHR(10);
        
        -- 这里可以添加具体的SQL Profile分析逻辑
        -- 基于执行计划、统计信息等给出建议
        
        v_recommendations := v_recommendations || 
            '1. 检查表统计信息是否最新' || CHR(10) ||
            '2. 考虑使用HINT强制优化器选择更好的执行计划' || CHR(10) ||
            '3. 评估是否需要创建SQL Profile辅助优化器估算；SQL Profile不保证固定执行计划' || CHR(10);
        
        RETURN v_recommendations;
    END get_sql_profile_recommendations;
    
END pkg_sql_tuning;
/
```

### 2. 自动化SQL监控

```sql
-- SQL性能监控表
CREATE TABLE sql_performance_history (
    capture_time DATE,
    sql_id VARCHAR2(13),
    plan_hash_value NUMBER,
    executions NUMBER,
    elapsed_time NUMBER,
    cpu_time NUMBER,
    buffer_gets NUMBER,
    disk_reads NUMBER,
    rows_processed NUMBER
);

-- 自动收集SQL性能数据的作业
CREATE OR REPLACE PROCEDURE collect_sql_performance AS
BEGIN
    INSERT INTO sql_performance_history
    SELECT SYSDATE,
           sql_id,
           plan_hash_value,
           executions,
           elapsed_time,
           cpu_time,
           buffer_gets,
           disk_reads,
           rows_processed
    FROM v$sql
    WHERE executions > 0
    AND elapsed_time > 0
    AND sql_text NOT LIKE '%sql_performance_history%'; -- 排除自身
    
    COMMIT;
    
    -- 清理30天前的数据
    DELETE FROM sql_performance_history 
    WHERE capture_time < SYSDATE - 30;
    
    COMMIT;
END collect_sql_performance;
/

-- 创建定时作业
BEGIN
    DBMS_SCHEDULER.CREATE_JOB (
        job_name => 'SQL_PERFORMANCE_COLLECTOR',
        job_type => 'PLSQL_BLOCK',
        job_action => 'BEGIN collect_sql_performance; END;',
        start_date => SYSTIMESTAMP,
        repeat_interval => 'FREQ=HOURLY; INTERVAL=1',
        enabled => TRUE,
        comments => '每小时收集SQL性能数据'
    );
END;
/
```

## 调优最佳实践

### 1. 银行业务SQL标准

```sql
-- 银行SQL编写规范示例
-- 1. 客户查询标准模板
CREATE OR REPLACE FUNCTION get_customer_summary_std(
    p_customer_id VARCHAR2
) RETURN SYS_REFCURSOR AS
    v_cursor SYS_REFCURSOR;
BEGIN
    OPEN v_cursor FOR
    SELECT /*+ FIRST_ROWS(1) */
           c.customer_id,
           c.customer_name,
           c.customer_grade,
           c.phone,
           c.email,
           COUNT(a.account_id) as account_count,
           SUM(a.balance) as total_balance
    FROM customer_info c
    LEFT JOIN account_info a ON c.customer_id = a.customer_id 
                            AND a.status = 'ACTIVE'
    WHERE c.customer_id = p_customer_id
    AND c.status = 'ACTIVE'
    GROUP BY c.customer_id, c.customer_name, c.customer_grade, c.phone, c.email;
    
    RETURN v_cursor;
END;
/

-- 2. 交易查询标准模板
CREATE OR REPLACE PROCEDURE get_transaction_history_std(
    p_account_id IN VARCHAR2,
    p_start_date IN DATE,
    p_end_date IN DATE,
    p_cursor OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_cursor FOR
    SELECT /*+ INDEX(t idx_trans_account_date) */
           t.trans_id,
           t.trans_date,
           t.trans_type,
           t.amount,
           t.balance_after,
           t.description
    FROM transaction_log t
    WHERE t.account_id = p_account_id
    AND t.trans_date BETWEEN p_start_date AND p_end_date
    AND t.status = 'SUCCESS'
    ORDER BY t.trans_date DESC;
END;
/
```

### 2. 性能监控指标

```sql
-- 关键性能指标监控视图
CREATE OR REPLACE VIEW v_sql_performance_kpi AS
SELECT 
    'Unweighted mean of cursor cumulative average elapsed seconds' as metric_name,
    ROUND(AVG(elapsed_time / executions / 1000000), 3) as avg_value,
    ROUND(MAX(elapsed_time / executions / 1000000), 3) as max_value,
    COUNT(*) as sql_count
FROM v$sql
WHERE executions > 0
AND UPPER(sql_text) LIKE '%CUSTOMER_INFO%'
UNION ALL
SELECT 
    'Cumulative SQL executions / 3600 (not TPS)',
    ROUND(SUM(executions) / 3600, 2), -- 累计SQL执行次数除以3600，不代表一小时吞吐量或业务TPS
    ROUND(MAX(executions), 2),
    COUNT(*)
FROM v$sql
WHERE executions > 0
AND UPPER(sql_text) LIKE '%TRANSACTION_LOG%'
UNION ALL
SELECT 
    'Resource Usage',
    ROUND(AVG(buffer_gets / executions), 2),
    ROUND(MAX(buffer_gets / executions), 2),
    COUNT(*)
FROM v$sql
WHERE executions > 0
AND buffer_gets > 0;
```

Oracle SQL调优是一个系统性工程，需要结合业务特点、数据特征和系统资源进行综合考虑。在银行环境中，稳定性和准确性同样重要，调优时需要充分测试确保不影响业务正确性。