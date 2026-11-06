---
title: Oracle性能监控与诊断
tags:
  - 技术工具
  - Oracle
date: 2026-03-22
difficulty: 高级
duration: 60分钟
knowledge_type: technical-practice
target_audience:
  - 数据库管理员（DBA）
  - 数据开发工程师
  - 数据架构师
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-22
updated: 2026-10-10
---


# Oracle性能监控与诊断

## 性能监控概述

Oracle数据库性能监控是确保银行系统稳定运行的关键环节。通过建立完善的监控体系，可以及时发现性能瓶颈、预防系统故障，并为性能优化提供数据支撑。

### 1. 性能监控层次

**系统级监控**
- CPU使用率、内存使用情况
- 磁盘I/O性能、网络带宽
- 操作系统资源利用率

**实例级监控**
- SGA内存区域使用情况
- 后台进程状态
- 等待事件统计

**SQL级监控**
- SQL执行时间、执行次数
- 执行计划变化
- 资源消耗统计

**会话级监控**
- 用户会话状态
- 锁等待情况
- 事务处理性能

## 核心性能视图和指标

### 1. 实例性能监控

```sql
-- 实例总体性能视图
CREATE OR REPLACE VIEW v_instance_performance AS
SELECT 
    i.instance_name,
    i.host_name,
    i.startup_time,
    ROUND((SYSDATE - i.startup_time) * 24, 2) as uptime_hours,
    s1.value as user_commits,
    s2.value as user_rollbacks,
    s3.value as physical_reads,
    s4.value as logical_reads,
    ROUND(s4.value / NULLIF(s3.value, 0), 2) as logical_to_physical_reads_ratio,
    s5.value as redo_size,
    s6.value as sorts_memory,
    s7.value as sorts_disk,
    ROUND(s6.value / NULLIF(s6.value + s7.value, 0) * 100, 2) as sort_memory_pct
FROM 
    v$instance i,
    v$sysstat s1,
    v$sysstat s2,
    v$sysstat s3,
    v$sysstat s4,
    v$sysstat s5,
    v$sysstat s6,
    v$sysstat s7
WHERE 
    s1.name = 'user commits' AND
    s2.name = 'user rollbacks' AND
    s3.name = 'physical reads' AND
    s4.name = 'session logical reads' AND
    s5.name = 'redo size' AND
    s6.name = 'sorts (memory)' AND
    s7.name = 'sorts (disk)';

-- 内存使用情况监控
CREATE OR REPLACE VIEW v_memory_usage AS
SELECT 
    'SGA' as memory_type,
    ROUND(SUM(value) / 1024 / 1024, 2) as size_mb
FROM v$sga
UNION ALL
SELECT 
    'PGA' as memory_type,
    ROUND(value / 1024 / 1024, 2) as size_mb
FROM v$pgastat 
WHERE name = 'total PGA allocated'
UNION ALL
SELECT 
    component,
    ROUND(current_size / 1024 / 1024, 2) as size_mb
FROM v$memory_dynamic_components
WHERE current_size > 0
ORDER BY size_mb DESC;

-- 等待事件监控
CREATE OR REPLACE VIEW v_wait_events AS
SELECT 
    event,
    total_waits,
    time_waited,
    ROUND(time_waited / NULLIF(total_waits, 0), 2) as avg_wait_time,
    ROUND(time_waited * 100 / SUM(time_waited) OVER(), 2) as pct_time
FROM v$system_event
WHERE event NOT LIKE '%message%'
AND event NOT LIKE '%timer%'
AND time_waited > 0
ORDER BY time_waited DESC;
```

### 2. SQL性能监控

```sql
-- TOP SQL监控视图
CREATE OR REPLACE VIEW v_top_sql AS
SELECT 
    sql_id,
    plan_hash_value,
    executions,
    ROUND(elapsed_time / 1000000, 2) as elapsed_seconds,
    ROUND(cpu_time / 1000000, 2) as cpu_seconds,
    ROUND(user_io_wait_time / 1000000, 2) as io_wait_seconds,
    buffer_gets,
    disk_reads,
    ROUND(buffer_gets / NULLIF(executions, 0), 2) as gets_per_exec,
    ROUND(disk_reads / NULLIF(executions, 0), 2) as reads_per_exec,
    ROUND(elapsed_time / NULLIF(executions, 0) / 1000000, 3) as avg_elapsed_seconds,
    last_active_time
FROM v$sql
WHERE executions > 0
AND elapsed_time > 0
ORDER BY elapsed_time DESC;

-- SQL文本查询
CREATE OR REPLACE FUNCTION get_sql_text(p_sql_id VARCHAR2) 
RETURN CLOB AS
    v_sql_text CLOB;
BEGIN
    SELECT sql_fulltext
    INTO v_sql_text
    FROM v$sql
    WHERE sql_id = p_sql_id
    AND ROWNUM = 1;
    
    RETURN v_sql_text;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN 'SQL not found in memory';
END get_sql_text;
/

-- 银行业务SQL性能监控
CREATE OR REPLACE VIEW v_banking_sql_performance AS
SELECT 
    s.sql_id,
    s.executions,
    ROUND(s.elapsed_time / 1000000, 2) as elapsed_seconds,
    ROUND(s.elapsed_time / s.executions / 1000000, 3) as avg_elapsed_seconds,
    s.buffer_gets,
    s.disk_reads,
    CASE 
        WHEN UPPER(st.sql_text) LIKE '%CUSTOMER_INFO%' THEN 'Customer'
        WHEN UPPER(st.sql_text) LIKE '%ACCOUNT_INFO%' THEN 'Account'
        WHEN UPPER(st.sql_text) LIKE '%TRANSACTION_LOG%' THEN 'Transaction'
        WHEN UPPER(st.sql_text) LIKE '%LOAN%' THEN 'Loan'
        ELSE 'Other'
    END as business_module,
    st.sql_text
FROM v$sql s
JOIN v$sqltext st ON s.sql_id = st.sql_id AND st.piece = 0
WHERE s.executions > 10
AND s.elapsed_time > 10000000 -- 超过10秒的SQL
ORDER BY s.elapsed_time DESC;
```

### 3. 锁和阻塞监控

```sql
-- 锁等待监控视图
CREATE OR REPLACE VIEW v_lock_waits AS
SELECT 
    sw.sid as waiting_session,
    sw.serial# as waiting_serial,
    sw.username as waiting_user,
    sw.program as waiting_program,
    bw.sid as blocking_session,
    bw.serial# as blocking_serial,
    bw.username as blocking_user,
    bw.program as blocking_program,
    lo.object_name as locked_object,
    w.event as wait_event,
    w.seconds_in_wait,
    l1.type as lock_type,
    DECODE(l1.lmode, 
        0, 'None',
        1, 'Null',
        2, 'Row-S',
        3, 'Row-X',
        4, 'Share',
        5, 'S/Row-X',
        6, 'Exclusive'
    ) as lock_mode_held,
    DECODE(l1.request,
        0, 'None',
        1, 'Null',
        2, 'Row-S',
        3, 'Row-X',
        4, 'Share',
        5, 'S/Row-X',
        6, 'Exclusive'
    ) as lock_mode_requested
FROM 
    v$session sw,
    v$session bw,
    v$lock l1,
    v$lock l2,
    v$session_wait w,
    (SELECT object_id, object_name FROM dba_objects) lo
WHERE 
    sw.sid = w.sid
    AND l1.sid = sw.sid
    AND l2.sid = bw.sid
    AND l1.id1 = l2.id1
    AND l1.id2 = l2.id2
    AND l1.type = l2.type
    AND l1.request > 0
    AND l2.lmode > 0
    AND l1.id1 = lo.object_id (+)
ORDER BY w.seconds_in_wait DESC;

-- 长时间运行的事务监控
CREATE OR REPLACE VIEW v_long_transactions AS
SELECT 
    s.sid,
    s.serial#,
    s.username,
    s.program,
    s.machine,
    s.osuser,
    ROUND((SYSDATE - s.logon_time) * 24 * 60, 2) as session_minutes,
    t.start_time,
    ROUND((SYSDATE - t.start_date) * 24 * 60, 2) as transaction_minutes,
    t.used_ublk * 8192 / 1024 / 1024 as undo_mb,
    s.last_call_et as seconds_since_last_call
FROM 
    v$session s,
    v$transaction t
WHERE 
    s.taddr = t.addr
    AND (SYSDATE - t.start_date) * 24 * 60 > 30 -- 超过30分钟的事务
ORDER BY transaction_minutes DESC;
```

## 性能监控自动化

### 1. 性能数据收集包

```sql
-- 性能监控数据收集包
CREATE OR REPLACE PACKAGE pkg_performance_monitor AS
    
    -- 收集实例性能快照
    PROCEDURE collect_instance_snapshot;
    
    -- 收集SQL性能统计
    PROCEDURE collect_sql_statistics;
    
    -- 收集等待事件统计
    PROCEDURE collect_wait_events;
    
    -- 收集锁等待信息
    PROCEDURE collect_lock_waits;
    
    -- 生成性能报告
    PROCEDURE generate_performance_report(
        p_start_time IN DATE,
        p_end_time IN DATE
    );
    
    -- 性能告警检查
    PROCEDURE check_performance_alerts;
    
END pkg_performance_monitor;
/

CREATE OR REPLACE PACKAGE BODY pkg_performance_monitor AS
    
    -- 收集实例性能快照
    PROCEDURE collect_instance_snapshot AS
        v_snapshot_id NUMBER;
    BEGIN
        -- 生成快照ID
        SELECT perf_snapshot_seq.NEXTVAL INTO v_snapshot_id FROM dual;
        
        -- 收集实例统计信息
        INSERT INTO perf_instance_stats (
            snapshot_id, snapshot_time, metric_name, metric_value
        )
        SELECT 
            v_snapshot_id,
            SYSDATE,
            name,
            value
        FROM v$sysstat
        WHERE value > 0;
        
        -- 收集内存使用信息
        INSERT INTO perf_memory_stats (
            snapshot_id, snapshot_time, memory_type, size_mb
        )
        SELECT 
            v_snapshot_id,
            SYSDATE,
            memory_type,
            size_mb
        FROM v_memory_usage;
        
        -- 收集会话统计
        INSERT INTO perf_session_stats (
            snapshot_id, snapshot_time, total_sessions,
            active_sessions, waiting_sessions, blocked_sessions
        )
        SELECT 
            v_snapshot_id,
            SYSDATE,
            COUNT(*),
            COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END),
            COUNT(CASE WHEN wait_class != 'Idle' THEN 1 END),
            COUNT(CASE WHEN blocking_session IS NOT NULL THEN 1 END)
        FROM v$session;
        
        COMMIT;
        
        DBMS_OUTPUT.PUT_LINE('实例性能快照收集完成，快照ID: ' || v_snapshot_id);
        
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            RAISE;
    END collect_instance_snapshot;
    
    -- 收集SQL性能统计
    PROCEDURE collect_sql_statistics AS
        v_snapshot_id NUMBER;
    BEGIN
        SELECT perf_snapshot_seq.NEXTVAL INTO v_snapshot_id FROM dual;
        
        -- 采集满足条件的SQL统计，最多100行，未保证按耗时排名
        INSERT INTO perf_sql_stats (
            snapshot_id, snapshot_time, sql_id, plan_hash_value,
            executions, elapsed_time, cpu_time, buffer_gets,
            disk_reads, rows_processed
        )
        SELECT 
            v_snapshot_id,
            SYSDATE,
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
        AND elapsed_time > 100000 -- 超过0.1秒的SQL
        AND ROWNUM <= 100; -- 最多采集100行，未按耗时排序，不代表TOP 100
        
        COMMIT;
        
        DBMS_OUTPUT.PUT_LINE('SQL性能统计收集完成，快照ID: ' || v_snapshot_id);
        
    END collect_sql_statistics;
    
    -- 收集等待事件统计
    PROCEDURE collect_wait_events AS
        v_snapshot_id NUMBER;
    BEGIN
        SELECT perf_snapshot_seq.NEXTVAL INTO v_snapshot_id FROM dual;
        
        INSERT INTO perf_wait_events (
            snapshot_id, snapshot_time, event_name,
            total_waits, time_waited, avg_wait_time
        )
        SELECT 
            v_snapshot_id,
            SYSDATE,
            event,
            total_waits,
            time_waited,
            ROUND(time_waited / NULLIF(total_waits, 0), 2)
        FROM v$system_event
        WHERE time_waited > 0
        AND event NOT LIKE '%message%'
        AND event NOT LIKE '%timer%';
        
        COMMIT;
        
    END collect_wait_events;
    
    -- 收集锁等待信息
    PROCEDURE collect_lock_waits AS
    BEGIN
        -- 记录当前的锁等待情况
        INSERT INTO perf_lock_waits (
            lock_wait_id, snapshot_time, waiting_session, blocking_session,
            locked_object, wait_event, seconds_in_wait, lock_type
        )
        SELECT 
            lock_wait_seq.NEXTVAL, SYSDATE,
            waiting_session,
            blocking_session,
            locked_object,
            wait_event,
            seconds_in_wait,
            lock_type
        FROM v_lock_waits
        WHERE seconds_in_wait > 10; -- 只记录等待超过10秒的
        
        COMMIT;
        
    END collect_lock_waits;
    
    -- 生成性能报告
    PROCEDURE generate_performance_report(
        p_start_time IN DATE,
        p_end_time IN DATE
    ) AS
        v_report CLOB;
        v_avg_cpu NUMBER;
        v_avg_memory NUMBER;
        v_top_wait_event VARCHAR2(100);
        v_sql_count NUMBER;
    BEGIN
        v_report := 'Oracle性能分析报告' || CHR(10) ||
                   '报告期间: ' || TO_CHAR(p_start_time, 'YYYY-MM-DD HH24:MI:SS') ||
                   ' - ' || TO_CHAR(p_end_time, 'YYYY-MM-DD HH24:MI:SS') || CHR(10) ||
                   RPAD('=', 60, '=') || CHR(10) || CHR(10);
        
        -- 实例性能汇总
        v_report := v_report || '一、实例性能汇总' || CHR(10);
        
        -- 获取平均CPU使用率
        SELECT AVG(metric_value)
        INTO v_avg_cpu
        FROM perf_instance_stats
        WHERE metric_name = 'CPU used by this session'
        AND snapshot_time BETWEEN p_start_time AND p_end_time;
        
        v_report := v_report || '  平均CPU使用: ' || ROUND(v_avg_cpu, 2) || CHR(10);
        
        -- 获取平均内存使用
        SELECT AVG(size_mb)
        INTO v_avg_memory
        FROM perf_memory_stats
        WHERE memory_type = 'SGA'
        AND snapshot_time BETWEEN p_start_time AND p_end_time;
        
        v_report := v_report || '  平均SGA使用: ' || ROUND(v_avg_memory, 2) || ' MB' || CHR(10);
        
        -- 获取主要等待事件
        SELECT event_name
        INTO v_top_wait_event
        FROM (
            SELECT event_name, SUM(time_waited) as total_wait
            FROM perf_wait_events
            WHERE snapshot_time BETWEEN p_start_time AND p_end_time
            GROUP BY event_name
            ORDER BY total_wait DESC
        )
        WHERE ROWNUM = 1;
        
        v_report := v_report || '  主要等待事件: ' || v_top_wait_event || CHR(10) || CHR(10);
        
        -- SQL性能分析
        v_report := v_report || '二、SQL性能分析' || CHR(10);
        
        SELECT COUNT(DISTINCT sql_id)
        INTO v_sql_count
        FROM perf_sql_stats
        WHERE snapshot_time BETWEEN p_start_time AND p_end_time;
        
        v_report := v_report || '  监控SQL数量: ' || v_sql_count || CHR(10);
        
        -- TOP 5 耗时SQL
        v_report := v_report || '  TOP 5 耗时SQL:' || CHR(10);
        FOR sql_rec IN (
            SELECT sql_id, SUM(elapsed_time) / 1000000 as total_seconds
            FROM perf_sql_stats
            WHERE snapshot_time BETWEEN p_start_time AND p_end_time
            GROUP BY sql_id
            ORDER BY total_seconds DESC
            FETCH FIRST 5 ROWS ONLY
        ) LOOP
            v_report := v_report || '    ' || sql_rec.sql_id || 
                       ': ' || ROUND(sql_rec.total_seconds, 2) || ' 秒' || CHR(10);
        END LOOP;
        
        -- 锁等待分析
        v_report := v_report || CHR(10) || '三、锁等待分析' || CHR(10);
        
        FOR lock_rec IN (
            SELECT 
                COUNT(*) as wait_count,
                AVG(seconds_in_wait) as avg_wait_time,
                locked_object
            FROM perf_lock_waits
            WHERE snapshot_time BETWEEN p_start_time AND p_end_time
            GROUP BY locked_object
            ORDER BY wait_count DESC
            FETCH FIRST 5 ROWS ONLY
        ) LOOP
            v_report := v_report || '  对象: ' || NVL(lock_rec.locked_object, 'Unknown') ||
                       ', 等待次数: ' || lock_rec.wait_count ||
                       ', 平均等待: ' || ROUND(lock_rec.avg_wait_time, 2) || ' 秒' || CHR(10);
        END LOOP;
        
        -- 输出报告
        DBMS_OUTPUT.PUT_LINE(v_report);
        
        -- 保存报告
        INSERT INTO perf_reports (
            report_id, report_time, start_time, end_time, report_content
        ) VALUES (
            perf_report_seq.NEXTVAL, SYSDATE, p_start_time, p_end_time, v_report
        );
        
        COMMIT;
        
    END generate_performance_report;
    
    -- 性能告警检查
    PROCEDURE check_performance_alerts AS
        v_alert_count NUMBER := 0;
    BEGIN
        -- 检查CPU使用率告警
        FOR cpu_rec IN (
            SELECT metric_value
            FROM perf_instance_stats
            WHERE metric_name = 'CPU used by this session'
            AND snapshot_time >= SYSDATE - 1/24 -- 最近1小时
            AND metric_value > 80 -- CPU使用率超过80%
        ) LOOP
            INSERT INTO performance_alerts (
                alert_id, alert_time, alert_type, severity,
                description, metric_value
            ) VALUES (
                perf_alert_seq.NEXTVAL, SYSDATE, 'HIGH_CPU', 'HIGH',
                'CPU使用率过高', cpu_rec.metric_value
            );
            v_alert_count := v_alert_count + 1;
        END LOOP;
        
        -- 检查累计耗时较高的SQL游标，不判断当前执行时长
        FOR sql_rec IN (
            SELECT sql_id, elapsed_time / 1000000 as elapsed_seconds
            FROM v$sql
            WHERE elapsed_time / 1000000 > 300 -- 游标累计耗时超过300秒，不代表当前单次执行超过5分钟
            AND executions > 0
        ) LOOP
            INSERT INTO performance_alerts (
                alert_id, alert_time, alert_type, severity,
                description, metric_value, sql_id
            ) VALUES (
                perf_alert_seq.NEXTVAL, SYSDATE, 'HIGH_CUMULATIVE_SQL_TIME', 'MEDIUM',
                'SQL游标累计耗时超过阈值，不代表当前执行超时', sql_rec.elapsed_seconds, sql_rec.sql_id
            );
            v_alert_count := v_alert_count + 1;
        END LOOP;
        
        -- 检查锁等待告警
        FOR lock_rec IN (
            SELECT waiting_session, seconds_in_wait
            FROM v_lock_waits
            WHERE seconds_in_wait > 60 -- 等待超过1分钟
        ) LOOP
            INSERT INTO performance_alerts (
                alert_id, alert_time, alert_type, severity,
                description, metric_value, session_id
            ) VALUES (
                perf_alert_seq.NEXTVAL, SYSDATE, 'LOCK_WAIT', 'HIGH',
                '锁等待时间过长', lock_rec.seconds_in_wait, lock_rec.waiting_session
            );
            v_alert_count := v_alert_count + 1;
        END LOOP;
        
        COMMIT;
        
        IF v_alert_count > 0 THEN
            DBMS_OUTPUT.PUT_LINE('性能检查完成，发现 ' || v_alert_count || ' 个告警');
        ELSE
            DBMS_OUTPUT.PUT_LINE('性能检查完成，无告警');
        END IF;
        
    END check_performance_alerts;
    
END pkg_performance_monitor;
/
```

### 2. 性能数据存储表

```sql
-- 创建性能监控相关表
CREATE TABLE perf_instance_stats (
    snapshot_id NUMBER,
    snapshot_time DATE,
    metric_name VARCHAR2(100),
    metric_value NUMBER,
    PRIMARY KEY (snapshot_id, metric_name)
);

CREATE TABLE perf_memory_stats (
    snapshot_id NUMBER,
    snapshot_time DATE,
    memory_type VARCHAR2(50),
    size_mb NUMBER(10,2),
    PRIMARY KEY (snapshot_id, memory_type)
);

CREATE TABLE perf_session_stats (
    snapshot_id NUMBER PRIMARY KEY,
    snapshot_time DATE,
    total_sessions NUMBER,
    active_sessions NUMBER,
    waiting_sessions NUMBER,
    blocked_sessions NUMBER
);

CREATE TABLE perf_sql_stats (
    snapshot_id NUMBER,
    snapshot_time DATE,
    sql_id VARCHAR2(13),
    plan_hash_value NUMBER,
    executions NUMBER,
    elapsed_time NUMBER,
    cpu_time NUMBER,
    buffer_gets NUMBER,
    disk_reads NUMBER,
    rows_processed NUMBER,
    PRIMARY KEY (snapshot_id, sql_id, plan_hash_value)
);

CREATE TABLE perf_wait_events (
    snapshot_id NUMBER,
    snapshot_time DATE,
    event_name VARCHAR2(100),
    total_waits NUMBER,
    time_waited NUMBER,
    avg_wait_time NUMBER(10,2),
    PRIMARY KEY (snapshot_id, event_name)
);

CREATE TABLE perf_lock_waits (
    lock_wait_id NUMBER PRIMARY KEY,
    snapshot_time DATE,
    waiting_session NUMBER,
    blocking_session NUMBER,
    locked_object VARCHAR2(100),
    wait_event VARCHAR2(100),
    seconds_in_wait NUMBER,
    lock_type VARCHAR2(20)
);

CREATE TABLE performance_alerts (
    alert_id NUMBER PRIMARY KEY,
    alert_time DATE,
    alert_type VARCHAR2(50),
    severity VARCHAR2(20),
    description VARCHAR2(500),
    metric_value NUMBER,
    sql_id VARCHAR2(13),
    session_id NUMBER,
    acknowledged CHAR(1) DEFAULT 'N'
);

CREATE TABLE perf_reports (
    report_id NUMBER PRIMARY KEY,
    report_time DATE,
    start_time DATE,
    end_time DATE,
    report_content CLOB
);

-- 创建序列
CREATE SEQUENCE perf_snapshot_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE perf_alert_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE perf_report_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE lock_wait_seq START WITH 1 INCREMENT BY 1;
```

## 银行业务性能监控

### 1. 业务响应时间监控

```sql
-- 银行业务响应时间监控
CREATE OR REPLACE VIEW v_banking_response_time AS
SELECT 
    'Customer Query' as business_function,
    AVG(elapsed_time / executions / 1000000) as avg_response_seconds,
    COUNT(*) as sql_count,
    SUM(executions) as total_executions
FROM v$sql
WHERE UPPER(sql_text) LIKE '%CUSTOMER_INFO%'
AND UPPER(sql_text) LIKE '%SELECT%'
AND executions > 0
UNION ALL
SELECT 
    'Account Balance',
    AVG(elapsed_time / executions / 1000000),
    COUNT(*),
    SUM(executions)
FROM v$sql
WHERE UPPER(sql_text) LIKE '%ACCOUNT_INFO%'
AND UPPER(sql_text) LIKE '%BALANCE%'
AND executions > 0
UNION ALL
SELECT 
    'Transaction Processing',
    AVG(elapsed_time / executions / 1000000),
    COUNT(*),
    SUM(executions)
FROM v$sql
WHERE UPPER(sql_text) LIKE '%TRANSACTION_LOG%'
AND UPPER(sql_text) LIKE '%INSERT%'
AND executions > 0
UNION ALL
SELECT 
    'Loan Application',
    AVG(elapsed_time / executions / 1000000),
    COUNT(*),
    SUM(executions)
FROM v$sql
WHERE UPPER(sql_text) LIKE '%LOAN%'
AND executions > 0;

-- 银行核心交易TPS监控
CREATE OR REPLACE FUNCTION get_banking_tps(p_minutes NUMBER DEFAULT 5)
RETURN NUMBER AS
    v_transaction_count NUMBER;
BEGIN
    SELECT COUNT(*)
    INTO v_transaction_count
    FROM transaction_log
    WHERE trans_time >= SYSDATE - p_minutes / (24 * 60)
    AND status = 'SUCCESS';
    
    RETURN ROUND(v_transaction_count / (p_minutes * 60), 2); -- 转换为每秒，p_minutes须大于0
END get_banking_tps;
/
```

### 2. 资源使用分析

```sql
-- 数据库连接池监控
CREATE OR REPLACE VIEW v_connection_pool_status AS
SELECT 
    machine,
    program,
    COUNT(*) as connection_count,
    COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_connections,
    COUNT(CASE WHEN status = 'INACTIVE' THEN 1 END) as idle_connections,
    AVG(SYSDATE - logon_time) * 24 as avg_session_hours
FROM v$session
WHERE type = 'USER'
GROUP BY machine, program
ORDER BY connection_count DESC;

-- 表空间增长趋势分析
CREATE OR REPLACE PROCEDURE analyze_tablespace_growth AS
    CURSOR c_tablespaces IS
        SELECT tablespace_name FROM dba_tablespaces 
        WHERE contents = 'PERMANENT';
    
    v_current_size NUMBER;
    v_used_size NUMBER;
    v_growth_rate NUMBER;
BEGIN
    DBMS_OUTPUT.PUT_LINE('表空间增长趋势分析:');
    DBMS_OUTPUT.PUT_LINE(RPAD('表空间名称', 20) || RPAD('当前大小(MB)', 15) || 
                        RPAD('已用大小(MB)', 15) || '假设增长量(MB/天，按已用量1%)');
    DBMS_OUTPUT.PUT_LINE(RPAD('-', 65, '-'));
    
    FOR ts_rec IN c_tablespaces LOOP
        -- 获取当前表空间大小
        SELECT NVL(SUM(bytes) / 1024 / 1024, 0)
        INTO v_current_size
        FROM dba_data_files
        WHERE tablespace_name = ts_rec.tablespace_name;
        
        -- 获取已使用大小
        SELECT v_current_size - NVL(SUM(bytes) / 1024 / 1024, 0)
        INTO v_used_size
        FROM dba_free_space
        WHERE tablespace_name = ts_rec.tablespace_name;
        
        -- 计算增长率（简化计算，实际应基于历史数据）
        v_growth_rate := v_used_size * 0.01; -- 假设每天增长1%
        
        DBMS_OUTPUT.PUT_LINE(
            RPAD(ts_rec.tablespace_name, 20) ||
            RPAD(TO_CHAR(v_current_size, '999,999.99'), 15) ||
            RPAD(TO_CHAR(v_used_size, '999,999.99'), 15) ||
            TO_CHAR(v_growth_rate, '999.99')
        );
    END LOOP;
END analyze_tablespace_growth;
/
```

## 性能诊断工具

### 1. SQL性能诊断

```sql
-- SQL性能诊断包
CREATE OR REPLACE PACKAGE pkg_sql_diagnosis AS
    
    PROCEDURE analyze_sql_performance(p_sql_id VARCHAR2);
    PROCEDURE compare_execution_plans(p_sql_id VARCHAR2);
    PROCEDURE identify_resource_intensive_sql;
    FUNCTION get_sql_recommendations(p_sql_id VARCHAR2) RETURN CLOB;
    
END pkg_sql_diagnosis;
/

CREATE OR REPLACE PACKAGE BODY pkg_sql_diagnosis AS
    
    PROCEDURE analyze_sql_performance(p_sql_id VARCHAR2) AS
        v_sql_text CLOB;
        v_executions NUMBER;
        v_avg_elapsed NUMBER;
        v_avg_cpu NUMBER;
        v_avg_io NUMBER;
        v_buffer_gets NUMBER;
        v_disk_reads NUMBER;
    BEGIN
        -- 获取SQL基本信息
        SELECT 
            sql_fulltext,
            executions,
            elapsed_time / executions / 1000000,
            cpu_time / executions / 1000000,
            user_io_wait_time / executions / 1000000,
            buffer_gets / executions,
            disk_reads / executions
        INTO 
            v_sql_text,
            v_executions,
            v_avg_elapsed,
            v_avg_cpu,
            v_avg_io,
            v_buffer_gets,
            v_disk_reads
        FROM v$sql
        WHERE sql_id = p_sql_id
        AND ROWNUM = 1;
        
        DBMS_OUTPUT.PUT_LINE('SQL性能分析报告');
        DBMS_OUTPUT.PUT_LINE('SQL ID: ' || p_sql_id);
        DBMS_OUTPUT.PUT_LINE(RPAD('=', 50, '='));
        DBMS_OUTPUT.PUT_LINE('执行次数: ' || v_executions);
        DBMS_OUTPUT.PUT_LINE('平均执行时间: ' || ROUND(v_avg_elapsed, 3) || ' 秒');
        DBMS_OUTPUT.PUT_LINE('平均CPU时间: ' || ROUND(v_avg_cpu, 3) || ' 秒');
        DBMS_OUTPUT.PUT_LINE('平均IO等待: ' || ROUND(v_avg_io, 3) || ' 秒');
        DBMS_OUTPUT.PUT_LINE('平均逻辑读: ' || ROUND(v_buffer_gets));
        DBMS_OUTPUT.PUT_LINE('平均物理读: ' || ROUND(v_disk_reads));
        
        -- 性能评估
        IF v_avg_elapsed > 5 THEN
            DBMS_OUTPUT.PUT_LINE('⚠ 警告: 平均执行时间较长');
        END IF;
        
        IF v_buffer_gets > 10000 THEN
            DBMS_OUTPUT.PUT_LINE('⚠ 警告: 逻辑读次数过多');
        END IF;
        
        IF v_disk_reads > 1000 THEN
            DBMS_OUTPUT.PUT_LINE('⚠ 警告: 物理读次数过多，考虑优化索引');
        END IF;
        
        DBMS_OUTPUT.PUT_LINE(CHR(10) || 'SQL文本:');
        DBMS_OUTPUT.PUT_LINE(SUBSTR(v_sql_text, 1, 1000));
        
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            DBMS_OUTPUT.PUT_LINE('错误: SQL ID ' || p_sql_id || ' 不存在');
    END analyze_sql_performance;
    
    PROCEDURE compare_execution_plans(p_sql_id VARCHAR2) AS
    BEGIN
        DBMS_OUTPUT.PUT_LINE('SQL执行计划对比: ' || p_sql_id);
        DBMS_OUTPUT.PUT_LINE(RPAD('=', 50, '='));
        
        FOR plan_rec IN (
            SELECT 
                plan_hash_value,
                executions,
                ROUND(elapsed_time / executions / 1000000, 3) as avg_elapsed,
                buffer_gets / executions as avg_buffer_gets,
                disk_reads / executions as avg_disk_reads
            FROM v$sql
            WHERE sql_id = p_sql_id
            ORDER BY executions DESC
        ) LOOP
            DBMS_OUTPUT.PUT_LINE('计划哈希值: ' || plan_rec.plan_hash_value);
            DBMS_OUTPUT.PUT_LINE('  执行次数: ' || plan_rec.executions);
            DBMS_OUTPUT.PUT_LINE('  平均执行时间: ' || plan_rec.avg_elapsed || ' 秒');
            DBMS_OUTPUT.PUT_LINE('  平均逻辑读: ' || ROUND(plan_rec.avg_buffer_gets));
            DBMS_OUTPUT.PUT_LINE('  平均物理读: ' || ROUND(plan_rec.avg_disk_reads));
            DBMS_OUTPUT.PUT_LINE('');
        END LOOP;
    END compare_execution_plans;
    
    PROCEDURE identify_resource_intensive_sql AS
    BEGIN
        DBMS_OUTPUT.PUT_LINE('资源密集型SQL识别');
        DBMS_OUTPUT.PUT_LINE(RPAD('=', 80, '='));
        DBMS_OUTPUT.PUT_LINE(RPAD('SQL_ID', 15) || RPAD('执行次数', 10) || 
                            RPAD('总耗时(秒)', 12) || RPAD('平均耗时(秒)', 12) || '资源类型');
        DBMS_OUTPUT.PUT_LINE(RPAD('-', 80, '-'));
        
        -- CPU密集型SQL
        FOR cpu_rec IN (
            SELECT sql_id, executions, 
                   ROUND(cpu_time / 1000000, 2) as total_cpu,
                   ROUND(cpu_time / executions / 1000000, 3) as avg_cpu
            FROM v$sql
            WHERE executions > 10
            AND cpu_time > 60000000 -- 总CPU时间超过60秒
            ORDER BY cpu_time DESC
            FETCH FIRST 5 ROWS ONLY
        ) LOOP
            DBMS_OUTPUT.PUT_LINE(
                RPAD(cpu_rec.sql_id, 15) ||
                RPAD(cpu_rec.executions, 10) ||
                RPAD(cpu_rec.total_cpu, 12) ||
                RPAD(cpu_rec.avg_cpu, 12) ||
                'CPU密集型'
            );
        END LOOP;
        
        -- IO密集型SQL
        FOR io_rec IN (
            SELECT sql_id, executions,
                   ROUND(user_io_wait_time / 1000000, 2) as total_io,
                   ROUND(user_io_wait_time / executions / 1000000, 3) as avg_io
            FROM v$sql
            WHERE executions > 10
            AND user_io_wait_time > 60000000 -- 总IO等待超过60秒
            ORDER BY user_io_wait_time DESC
            FETCH FIRST 5 ROWS ONLY
        ) LOOP
            DBMS_OUTPUT.PUT_LINE(
                RPAD(io_rec.sql_id, 15) ||
                RPAD(io_rec.executions, 10) ||
                RPAD(io_rec.total_io, 12) ||
                RPAD(io_rec.avg_io, 12) ||
                'IO密集型'
            );
        END LOOP;
    END identify_resource_intensive_sql;
    
    FUNCTION get_sql_recommendations(p_sql_id VARCHAR2) RETURN CLOB AS
        v_recommendations CLOB;
        v_sql_text CLOB;
        v_buffer_gets NUMBER;
        v_disk_reads NUMBER;
        v_executions NUMBER;
    BEGIN
        -- 获取SQL统计信息
        SELECT sql_fulltext, buffer_gets, disk_reads, executions
        INTO v_sql_text, v_buffer_gets, v_disk_reads, v_executions
        FROM v$sql
        WHERE sql_id = p_sql_id AND ROWNUM = 1;
        
        v_recommendations := 'SQL优化建议 (' || p_sql_id || ')' || CHR(10) || CHR(10);
        
        -- 基于统计信息给出建议
        IF v_disk_reads / v_executions > 1000 THEN
            v_recommendations := v_recommendations || 
                '• 物理读次数过多，建议检查和优化索引' || CHR(10);
        END IF;
        
        IF v_buffer_gets / v_executions > 10000 THEN
            v_recommendations := v_recommendations || 
                '• 逻辑读次数过多，考虑重写SQL或优化表结构' || CHR(10);
        END IF;
        
        -- 基于SQL文本给出建议
        IF UPPER(v_sql_text) LIKE '%SELECT%*%FROM%' THEN
            v_recommendations := v_recommendations || 
                '• 避免使用SELECT *，只选择需要的列' || CHR(10);
        END IF;
        
        IF UPPER(v_sql_text) LIKE '%ORDER BY%' AND 
           UPPER(v_sql_text) NOT LIKE '%INDEX%' THEN
            v_recommendations := v_recommendations || 
                '• ORDER BY操作可能导致排序，考虑创建相应索引' || CHR(10);
        END IF;
        
        IF UPPER(v_sql_text) LIKE '%GROUP BY%' THEN
            v_recommendations := v_recommendations || 
                '• GROUP BY操作，确保分组列上有合适的索引' || CHR(10);
        END IF;
        
        IF UPPER(v_sql_text) LIKE '%LIKE ''%' THEN
            v_recommendations := v_recommendations || 
                '• 文本规则命中LIKE片段，但不能确认存在前导通配符；若确为前导通配符查询，普通B-tree索引通常难以进行有效范围扫描，应结合执行计划、索引类型和业务需求评估优化方案' || CHR(10);
        END IF;
        
        RETURN v_recommendations;
        
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RETURN 'SQL ID ' || p_sql_id || ' 不存在或已从内存中清除';
    END get_sql_recommendations;
    
END pkg_sql_diagnosis;
/
```

### 2. 定时监控作业

```sql
-- 创建性能监控定时作业
BEGIN
    -- 每5分钟收集一次实例快照
    DBMS_SCHEDULER.CREATE_JOB (
        job_name => 'PERF_INSTANCE_MONITOR',
        job_type => 'PLSQL_BLOCK',
        job_action => 'BEGIN pkg_performance_monitor.collect_instance_snapshot; END;',
        start_date => SYSTIMESTAMP,
        repeat_interval => 'FREQ=MINUTELY; INTERVAL=5',
        enabled => TRUE,
        comments => '每5分钟收集实例性能快照'
    );
    
    -- 每小时收集SQL统计
    DBMS_SCHEDULER.CREATE_JOB (
        job_name => 'PERF_SQL_MONITOR',
        job_type => 'PLSQL_BLOCK',
        job_action => 'BEGIN pkg_performance_monitor.collect_sql_statistics; END;',
        start_date => SYSTIMESTAMP,
        repeat_interval => 'FREQ=HOURLY; INTERVAL=1',
        enabled => TRUE,
        comments => '每小时收集SQL性能统计'
    );
    
    -- 每10分钟检查性能告警
    DBMS_SCHEDULER.CREATE_JOB (
        job_name => 'PERF_ALERT_CHECK',
        job_type => 'PLSQL_BLOCK',
        job_action => 'BEGIN pkg_performance_monitor.check_performance_alerts; END;',
        start_date => SYSTIMESTAMP,
        repeat_interval => 'FREQ=MINUTELY; INTERVAL=10',
        enabled => TRUE,
        comments => '每10分钟检查性能告警'
    );
    
    -- 每日生成性能报告
    DBMS_SCHEDULER.CREATE_JOB (
        job_name => 'PERF_DAILY_REPORT',
        job_type => 'PLSQL_BLOCK',
        job_action => 'BEGIN pkg_performance_monitor.generate_performance_report(SYSDATE-1, SYSDATE); END;',
        start_date => SYSTIMESTAMP,
        repeat_interval => 'FREQ=DAILY; BYHOUR=6; BYMINUTE=0',
        enabled => TRUE,
        comments => '每日早上6点生成性能报告'
    );
    
END;
/
```

本文示例展示了Oracle性能采集、预警和诊断的组织方式；在修正代码与统计口径、补足业务表和部署前置并验证采样策略后，可辅助银行数据库的周期性监控与问题定位，但不能保证核心业务系统稳定高效运行。