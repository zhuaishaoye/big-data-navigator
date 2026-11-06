---
title: Oracle高可用性方案
tags:
  - 技术工具
  - Oracle
date: 2026-03-22
difficulty: 高级
duration: 60分钟
knowledge_type: technical-practice
target_audience:
  - 数据库管理员（DBA）
  - 数据库运维工程师
  - 数据架构师
  - 数据开发工程师
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-22
updated: 2026-10-10
---


# Oracle高可用性方案

## 高可用性概念与原则

Oracle高可用性是银行核心系统稳定运行的基石。在7×24小时不间断服务的金融环境中，系统停机可能造成巨大的业务损失和声誉风险。Oracle提供了多层次的高可用性解决方案，从单实例的故障转移到多地域的灾难恢复。

### 1. 高可用性指标

**可用性等级定义**
- 99.9%：年停机时间约8.76小时
- 99.95%：年停机时间约4.38小时  
- 99.99%：年停机时间约52.56分钟
- 99.999%：年停机时间约5.26分钟

**银行业务可用性目标示例（以下数值为方案假设，不代表统一监管要求）**
- 核心交易系统：99.99%以上
- 客户服务系统：99.95%以上
- 内部管理系统：99.9%以上

**关键指标**
- RTO（恢复时间目标）：系统故障后恢复时间
- RPO（恢复点目标）：故障后允许恢复到多早的数据时间点，通常以可容忍的数据丢失时间窗口表示
- MTBF（平均故障间隔）：系统稳定运行时间
- MTTR（平均恢复时间）：故障修复平均时间

### 2. 故障类型分析

**硬件故障**
- 服务器硬件故障
- 存储设备故障
- 网络设备故障

**软件故障**
- 操作系统故障
- Oracle软件故障
- 应用程序故障

**人为错误**
- 误操作导致的数据丢失
- 配置错误
- 维护操作失误

**灾难事件**
- 自然灾害
- 机房故障
- 网络中断

## RAC集群架构

### 1. RAC集群基础架构

```sql
-- RAC集群信息查询
CREATE OR REPLACE VIEW v_rac_cluster_info AS
SELECT 
    i.instance_number,
    i.instance_name,
    i.host_name,
    i.version,
    i.status,
    i.database_status,
    i.instance_role,
    d.name as database_name,
    d.open_mode,
    d.database_role
FROM gv$instance i
CROSS JOIN v$database d
ORDER BY i.instance_number;

-- RAC节点状态监控
CREATE OR REPLACE PROCEDURE monitor_rac_cluster AS
    v_total_nodes NUMBER;
    v_active_nodes NUMBER;
    v_alert_threshold NUMBER := 0.5; -- 50%节点可用告警阈值
BEGIN
    -- 统计集群节点状态
    SELECT COUNT(*) INTO v_total_nodes
    FROM gv$instance;
    
    SELECT COUNT(*) INTO v_active_nodes
    FROM gv$instance
    WHERE status = 'OPEN' AND database_status = 'ACTIVE';
    
    DBMS_OUTPUT.PUT_LINE('RAC集群状态监控');
    DBMS_OUTPUT.PUT_LINE('================');
    DBMS_OUTPUT.PUT_LINE('总节点数: ' || v_total_nodes);
    DBMS_OUTPUT.PUT_LINE('活跃节点数: ' || v_active_nodes);
    DBMS_OUTPUT.PUT_LINE('可用率: ' || ROUND(v_active_nodes * 100 / v_total_nodes, 2) || '%');
    
    -- 详细节点状态
    DBMS_OUTPUT.PUT_LINE('');
    DBMS_OUTPUT.PUT_LINE('节点详细状态:');
    
    FOR node_rec IN (
        SELECT instance_number, instance_name, host_name, status, database_status
        FROM gv$instance
        ORDER BY instance_number
    ) LOOP
        DBMS_OUTPUT.PUT_LINE(
            '节点' || node_rec.instance_number || ' (' || node_rec.host_name || '): ' ||
            node_rec.status || ' / ' || node_rec.database_status
        );
    END LOOP;
    
    -- 告警检查
    IF v_active_nodes < v_total_nodes * v_alert_threshold THEN
        DBMS_OUTPUT.PUT_LINE('');
        DBMS_OUTPUT.PUT_LINE('⚠️  警告: 可用节点数低于阈值，请立即检查集群状态！');
    END IF;
    
END monitor_rac_cluster;
/

-- RAC服务管理
CREATE OR REPLACE PROCEDURE manage_rac_service(
    p_service_name VARCHAR2,
    p_action VARCHAR2, -- START, STOP, RELOCATE
    p_target_instance VARCHAR2 DEFAULT NULL
) AS
    v_current_status VARCHAR2(20);
    v_preferred_instances VARCHAR2(100);
BEGIN
    -- 查询服务当前状态
    SELECT LISTAGG(inst_id, ',') WITHIN GROUP (ORDER BY inst_id)
    INTO v_preferred_instances
    FROM gv$active_services
    WHERE name = p_service_name;
    
    DBMS_OUTPUT.PUT_LINE('管理RAC服务: ' || p_service_name);
    DBMS_OUTPUT.PUT_LINE('当前运行实例: ' || NVL(v_preferred_instances, '无'));
    DBMS_OUTPUT.PUT_LINE('执行操作: ' || p_action);
    
    CASE p_action
        WHEN 'START' THEN
            -- 启动服务
            DBMS_OUTPUT.PUT_LINE('启动服务 ' || p_service_name);
            -- 实际环境中使用 srvctl start service 命令
            
        WHEN 'STOP' THEN
            -- 停止服务
            DBMS_OUTPUT.PUT_LINE('停止服务 ' || p_service_name);
            -- 实际环境中使用 srvctl stop service 命令
            
        WHEN 'RELOCATE' THEN
            -- 迁移服务
            IF p_target_instance IS NOT NULL THEN
                DBMS_OUTPUT.PUT_LINE('迁移服务 ' || p_service_name || ' 到实例 ' || p_target_instance);
                -- 实际环境中使用 srvctl relocate service 命令
            ELSE
                DBMS_OUTPUT.PUT_LINE('错误: 迁移操作需要指定目标实例');
            END IF;
            
        ELSE
            DBMS_OUTPUT.PUT_LINE('错误: 不支持的操作 ' || p_action);
    END CASE;
    
END manage_rac_service;
/
```

### 2. RAC负载均衡配置

```sql
-- RAC服务配置表
CREATE TABLE rac_service_config (
    service_id NUMBER PRIMARY KEY,
    service_name VARCHAR2(50) UNIQUE,
    preferred_instances VARCHAR2(100), -- 首选实例列表
    available_instances VARCHAR2(100), -- 可用实例列表
    load_balancing_method VARCHAR2(20), -- ROUND_ROBIN, LEAST_CONNECTIONS, THROUGHPUT
    failover_type VARCHAR2(20), -- SELECT, SESSION, TRANSACTION
    failover_method VARCHAR2(20), -- BASIC, PRECONNECT
    connection_pool_min NUMBER DEFAULT 5,
    connection_pool_max NUMBER DEFAULT 100,
    business_priority VARCHAR2(20), -- HIGH, MEDIUM, LOW
    status CHAR(1) DEFAULT 'A',
    create_time DATE DEFAULT SYSDATE
);

-- 银行业务服务配置
INSERT INTO rac_service_config VALUES (
    1, 'BANK_CORE_SVC', '1,2', '1,2,3,4', 'THROUGHPUT', 'SESSION', 'BASIC',
    20, 200, 'HIGH', 'A', SYSDATE
);

INSERT INTO rac_service_config VALUES (
    2, 'BANK_QUERY_SVC', '3,4', '1,2,3,4', 'ROUND_ROBIN', 'SELECT', 'PRECONNECT',
    10, 150, 'MEDIUM', 'A', SYSDATE
);

INSERT INTO rac_service_config VALUES (
    3, 'BANK_BATCH_SVC', '4', '3,4', 'LEAST_CONNECTIONS', 'SESSION', 'BASIC',
    5, 50, 'LOW', 'A', SYSDATE
);

-- 生成RAC服务创建脚本
CREATE OR REPLACE PROCEDURE generate_rac_service_script AS
    v_script CLOB;
BEGIN
    v_script := '#!/bin/bash' || CHR(10) ||
                '# Oracle RAC服务配置脚本' || CHR(10) ||
                '# 生成时间: ' || TO_CHAR(SYSDATE, 'YYYY-MM-DD HH24:MI:SS') || CHR(10) ||
                CHR(10);
    
    FOR svc_rec IN (
        SELECT * FROM rac_service_config WHERE status = 'A' ORDER BY service_id
    ) LOOP
        v_script := v_script || 
                   '# 创建服务: ' || svc_rec.service_name || CHR(10) ||
                   '# HIGH/MEDIUM/LOW仅为业务优先级元数据，不作为srvctl -P参数传入' || CHR(10) ||
                   'srvctl add service -d BANKPROD -s ' || svc_rec.service_name || ' \' || CHR(10) ||
                   '  -r "' || svc_rec.preferred_instances || '" \' || CHR(10) ||
                   '  -a "' || svc_rec.available_instances || '" \' || CHR(10) ||
                   '  -e ' || svc_rec.failover_type || ' \' || CHR(10) ||
                   '  -m ' || svc_rec.failover_method || ' \' || CHR(10) ||
                   '  -z 180 -w 5' || CHR(10) || CHR(10) ||
                   
                   '# 启动服务: ' || svc_rec.service_name || CHR(10) ||
                   'srvctl start service -d BANKPROD -s ' || svc_rec.service_name || CHR(10) ||
                   CHR(10);
    END LOOP;
    
    v_script := v_script || 
               '# 检查服务状态' || CHR(10) ||
               'srvctl status service -d BANKPROD' || CHR(10);
    
    DBMS_OUTPUT.PUT_LINE(v_script);
END generate_rac_service_script;
/
```

## Data Guard配置

### 1. Data Guard架构设计

```sql
-- Data Guard配置信息表
CREATE TABLE dg_config_info (
    config_id NUMBER PRIMARY KEY,
    database_role VARCHAR2(20), -- PRIMARY, STANDBY
    database_name VARCHAR2(30),
    host_name VARCHAR2(100),
    db_unique_name VARCHAR2(30),
    protection_mode VARCHAR2(30), -- MAXIMUM_AVAILABILITY, MAXIMUM_PERFORMANCE, MAXIMUM_PROTECTION
    transport_mode VARCHAR2(20), -- SYNC, ASYNC
    apply_mode VARCHAR2(20), -- REAL_TIME, MANUAL
    compression_enabled CHAR(1) DEFAULT 'Y',
    encryption_enabled CHAR(1) DEFAULT 'Y',
    network_timeout NUMBER DEFAULT 30,
    status CHAR(1) DEFAULT 'A',
    create_time DATE DEFAULT SYSDATE
);

-- 银行Data Guard配置
INSERT INTO dg_config_info VALUES (
    1, 'PRIMARY', 'BANKPROD', 'bank-db-01.local', 'BANKPROD',
    'MAXIMUM_AVAILABILITY', 'SYNC', 'REAL_TIME', 'Y', 'Y', 30, 'A', SYSDATE
);

INSERT INTO dg_config_info VALUES (
    2, 'STANDBY', 'BANKSTBY', 'bank-db-dr.local', 'BANKSTBY',
    'MAXIMUM_AVAILABILITY', 'SYNC', 'REAL_TIME', 'Y', 'Y', 30, 'A', SYSDATE
);

-- Data Guard状态监控
CREATE OR REPLACE PROCEDURE monitor_dataguard_status AS
    v_db_role VARCHAR2(30);
    v_protection_mode VARCHAR2(30);
    v_switchover_status VARCHAR2(30);
    v_log_mode VARCHAR2(20);
    v_force_logging VARCHAR2(10);
    v_gap_count NUMBER;
BEGIN
    -- 获取当前数据库角色和状态
    SELECT database_role, protection_mode, switchover_status, 
           log_mode, force_logging
    INTO v_db_role, v_protection_mode, v_switchover_status,
         v_log_mode, v_force_logging
    FROM v$database;
    
    DBMS_OUTPUT.PUT_LINE('Data Guard状态监控');
    DBMS_OUTPUT.PUT_LINE('==================');
    DBMS_OUTPUT.PUT_LINE('数据库角色: ' || v_db_role);
    DBMS_OUTPUT.PUT_LINE('保护模式: ' || v_protection_mode);
    DBMS_OUTPUT.PUT_LINE('切换状态: ' || v_switchover_status);
    DBMS_OUTPUT.PUT_LINE('日志模式: ' || v_log_mode);
    DBMS_OUTPUT.PUT_LINE('强制日志: ' || v_force_logging);
    
    -- 如果是主库，检查备库状态
    IF v_db_role = 'PRIMARY' THEN
        DBMS_OUTPUT.PUT_LINE('');
        DBMS_OUTPUT.PUT_LINE('备库状态:');
        
        FOR dest_rec IN (
            SELECT dest_id, destination, status, error,
                   applied_scn, last_applied_time
            FROM v$archive_dest_status
            WHERE status IN ('VALID', 'DEFERRED', 'ERROR', 'INACTIVE')
            AND destination IS NOT NULL
            ORDER BY dest_id
        ) LOOP
            DBMS_OUTPUT.PUT_LINE(
                '目标' || dest_rec.dest_id || ' (' || dest_rec.destination || '): ' ||
                dest_rec.status || 
                CASE WHEN dest_rec.error IS NOT NULL THEN ' - ' || dest_rec.error ELSE '' END
            );
        END LOOP;
        
        -- 检查日志传输延迟
        BEGIN
            SELECT COUNT(*) INTO v_gap_count
            FROM v$archive_gap;
            
            IF v_gap_count > 0 THEN
                DBMS_OUTPUT.PUT_LINE('');
                DBMS_OUTPUT.PUT_LINE('⚠️  发现归档日志间隙: ' || v_gap_count || ' 个');
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                NULL; -- 忽略错误，可能是没有配置Data Guard
        END;
    END IF;
    
    -- 如果是备库，检查应用状态
    IF v_db_role IN ('PHYSICAL STANDBY', 'LOGICAL STANDBY') THEN
        DBMS_OUTPUT.PUT_LINE('');
        DBMS_OUTPUT.PUT_LINE('日志应用状态:');
        
        FOR apply_rec IN (
            SELECT process, status, client_process, sequence#,
                   block#, blocks, delay_mins
            FROM v$managed_standby
            WHERE process IN ('MRP0', 'LSP0', 'RFS')
            ORDER BY process
        ) LOOP
            DBMS_OUTPUT.PUT_LINE(
                apply_rec.process || ': ' || apply_rec.status ||
                CASE WHEN apply_rec.sequence# IS NOT NULL 
                     THEN ' (序列号: ' || apply_rec.sequence# || ')' 
                     ELSE '' END
            );
        END LOOP;
    END IF;
    
END monitor_dataguard_status;
/

-- Data Guard切换操作
CREATE OR REPLACE PROCEDURE perform_dataguard_switchover(
    p_operation VARCHAR2, -- SWITCHOVER, FAILOVER
    p_target_standby VARCHAR2 DEFAULT NULL,
    p_force CHAR(1) DEFAULT 'N'
) AS
    v_current_role VARCHAR2(30);
    v_switchover_status VARCHAR2(30);
    v_can_switchover BOOLEAN := FALSE;
BEGIN
    -- 获取当前状态
    SELECT database_role, switchover_status
    INTO v_current_role, v_switchover_status
    FROM v$database;
    
    DBMS_OUTPUT.PUT_LINE('Data Guard切换操作');
    DBMS_OUTPUT.PUT_LINE('==================');
    DBMS_OUTPUT.PUT_LINE('当前角色: ' || v_current_role);
    DBMS_OUTPUT.PUT_LINE('切换状态: ' || v_switchover_status);
    DBMS_OUTPUT.PUT_LINE('操作类型: ' || p_operation);
    
    -- 检查切换条件
    IF p_operation = 'SWITCHOVER' THEN
        IF v_current_role = 'PRIMARY' AND v_switchover_status = 'TO STANDBY' THEN
            v_can_switchover := TRUE;
        ELSIF v_current_role LIKE '%STANDBY' AND v_switchover_status = 'TO PRIMARY' THEN
            v_can_switchover := TRUE;
        END IF;
        
        IF v_can_switchover THEN
            DBMS_OUTPUT.PUT_LINE('');
            DBMS_OUTPUT.PUT_LINE('✓ 当前角色与切换状态通过示例检查；实际切换仍需核对备库类型、完整前置条件与操作流程');
            DBMS_OUTPUT.PUT_LINE('请在主库执行以下命令:');
            
            IF v_current_role = 'PRIMARY' THEN
                DBMS_OUTPUT.PUT_LINE('ALTER DATABASE COMMIT TO SWITCHOVER TO STANDBY WITH SESSION SHUTDOWN;');
                DBMS_OUTPUT.PUT_LINE('SHUTDOWN IMMEDIATE;');
                DBMS_OUTPUT.PUT_LINE('STARTUP MOUNT;');
                DBMS_OUTPUT.PUT_LINE('ALTER DATABASE OPEN READ ONLY;');
            ELSE
                DBMS_OUTPUT.PUT_LINE('ALTER DATABASE COMMIT TO SWITCHOVER TO PRIMARY WITH SESSION SHUTDOWN;');
                DBMS_OUTPUT.PUT_LINE('SHUTDOWN IMMEDIATE;');
                DBMS_OUTPUT.PUT_LINE('STARTUP;');
            END IF;
        ELSE
            DBMS_OUTPUT.PUT_LINE('');
            DBMS_OUTPUT.PUT_LINE('✗ 不满足切换条件，当前状态: ' || v_switchover_status);
        END IF;
        
    ELSIF p_operation = 'FAILOVER' THEN
        IF v_current_role LIKE '%STANDBY' THEN
            DBMS_OUTPUT.PUT_LINE('');
            DBMS_OUTPUT.PUT_LINE('⚠️  故障转移操作，请确认主库确实不可用');
            DBMS_OUTPUT.PUT_LINE('请在备库执行以下命令:');
            
            IF p_force = 'Y' THEN
                DBMS_OUTPUT.PUT_LINE('ALTER DATABASE ACTIVATE STANDBY DATABASE;');
            ELSE
                DBMS_OUTPUT.PUT_LINE('ALTER DATABASE RECOVER MANAGED STANDBY DATABASE FINISH;');
                DBMS_OUTPUT.PUT_LINE('ALTER DATABASE ACTIVATE STANDBY DATABASE;');
            END IF;
            
            DBMS_OUTPUT.PUT_LINE('SHUTDOWN IMMEDIATE;');
            DBMS_OUTPUT.PUT_LINE('STARTUP;');
        ELSE
            DBMS_OUTPUT.PUT_LINE('');
            DBMS_OUTPUT.PUT_LINE('✗ 故障转移只能在备库上执行');
        END IF;
    END IF;
    
END perform_dataguard_switchover;
/
```

### 2. 自动故障检测与切换

```sql
-- Data Guard自动监控和告警
CREATE TABLE dg_monitoring_log (
    log_id NUMBER PRIMARY KEY,
    check_time DATE DEFAULT SYSDATE,
    check_type VARCHAR2(50), -- LAG_CHECK, CONNECTIVITY_CHECK, APPLY_CHECK
    status VARCHAR2(20), -- OK, WARNING, CRITICAL
    message VARCHAR2(4000),
    auto_action_taken VARCHAR2(100),
    alert_sent CHAR(1) DEFAULT 'N'
);

CREATE SEQUENCE dg_monitor_seq START WITH 1 INCREMENT BY 1;

-- Data Guard健康检查
CREATE OR REPLACE PROCEDURE check_dataguard_health AS
    v_log_id NUMBER;
    v_db_role VARCHAR2(30);
    v_current_scn NUMBER;
    v_applied_scn NUMBER;
    v_lag_seconds NUMBER;
    v_transport_lag NUMBER;
    v_apply_lag NUMBER;
    v_alert_message VARCHAR2(4000);
BEGIN
    -- 获取数据库角色
    SELECT database_role INTO v_db_role FROM v$database;
    
    IF v_db_role = 'PRIMARY' THEN
        -- 主库检查备库延迟
        FOR dest_rec IN (
            SELECT dest_id, destination, status, error,
                   (SYSDATE - last_archived_time) * 24 * 3600 as transport_lag_sec
            FROM v$archive_dest_status
            WHERE status = 'VALID'
            AND destination IS NOT NULL
        ) LOOP
            v_log_id := dg_monitor_seq.NEXTVAL;
            
            IF dest_rec.transport_lag_sec > 300 THEN -- 5分钟
                INSERT INTO dg_monitoring_log (
                    log_id, check_type, status, message
                ) VALUES (
                    v_log_id, 'TRANSPORT_LAG', 'CRITICAL',
                    '目标' || dest_rec.dest_id || '传输延迟' || 
                    ROUND(dest_rec.transport_lag_sec, 2) || '秒'
                );
            ELSIF dest_rec.transport_lag_sec > 60 THEN -- 1分钟
                INSERT INTO dg_monitoring_log (
                    log_id, check_type, status, message
                ) VALUES (
                    v_log_id, 'TRANSPORT_LAG', 'WARNING',
                    '目标' || dest_rec.dest_id || '传输延迟' || 
                    ROUND(dest_rec.transport_lag_sec, 2) || '秒'
                );
            ELSE
                INSERT INTO dg_monitoring_log (
                    log_id, check_type, status, message
                ) VALUES (
                    v_log_id, 'TRANSPORT_LAG', 'OK',
                    '目标' || dest_rec.dest_id || '传输正常'
                );
            END IF;
        END LOOP;
        
    ELSIF v_db_role LIKE '%STANDBY' THEN
        -- 备库检查应用延迟
        BEGIN
            SELECT MAX(sequence#) INTO v_current_scn
            FROM v$archived_log
            WHERE dest_id = 1 AND applied = 'YES'
            AND TRUNC(completion_time) >= TRUNC(SYSDATE);
            
            SELECT (SYSDATE - MAX(completion_time)) * 24 * 3600
            INTO v_apply_lag
            FROM v$archived_log
            WHERE dest_id = 1 AND applied = 'YES';
            
            v_log_id := dg_monitor_seq.NEXTVAL;
            
            IF v_apply_lag > 600 THEN -- 10分钟
                INSERT INTO dg_monitoring_log (
                    log_id, check_type, status, message
                ) VALUES (
                    v_log_id, 'APPLY_LAG', 'CRITICAL',
                    '日志应用延迟' || ROUND(v_apply_lag, 2) || '秒'
                );
            ELSIF v_apply_lag > 180 THEN -- 3分钟
                INSERT INTO dg_monitoring_log (
                    log_id, check_type, status, message
                ) VALUES (
                    v_log_id, 'APPLY_LAG', 'WARNING',
                    '日志应用延迟' || ROUND(v_apply_lag, 2) || '秒'
                );
            ELSE
                INSERT INTO dg_monitoring_log (
                    log_id, check_type, status, message
                ) VALUES (
                    v_log_id, 'APPLY_LAG', 'OK',
                    '日志应用正常'
                );
            END IF;
            
        EXCEPTION
            WHEN OTHERS THEN
                v_log_id := dg_monitor_seq.NEXTVAL;
                INSERT INTO dg_monitoring_log (
                    log_id, check_type, status, message, alert_sent
                ) VALUES (
                    v_log_id, 'APPLY_CHECK', 'CRITICAL',
                    '无法检查日志应用状态: ' || SQLERRM, 'Y'
                );
        END;
    END IF;
    
    COMMIT;
    
    -- 发送告警（Critical级别）
    FOR alert_rec IN (
        SELECT * FROM dg_monitoring_log
        WHERE check_time >= SYSDATE - 1/24 -- 最近1小时
        AND status = 'CRITICAL'
        AND alert_sent = 'N'
    ) LOOP
        DBMS_OUTPUT.PUT_LINE('CRITICAL: ' || alert_rec.message);
        
        UPDATE dg_monitoring_log 
        SET alert_sent = 'Y'
        WHERE log_id = alert_rec.log_id;
    END LOOP;
    
    COMMIT;
    
END check_dataguard_health;
/
```

## 自动故障转移

### 1. Fast Application Notification (FAN)

```sql
-- FAN事件监控表
CREATE TABLE fan_event_log (
    event_id NUMBER PRIMARY KEY,
    event_time DATE DEFAULT SYSDATE,
    event_type VARCHAR2(50), -- NODE_DOWN, NODE_UP, SERVICE_DOWN, SERVICE_UP
    instance_name VARCHAR2(30),
    service_name VARCHAR2(50),
    event_details VARCHAR2(4000),
    action_taken VARCHAR2(100),
    notification_sent CHAR(1) DEFAULT 'N'
);

CREATE SEQUENCE fan_event_seq START WITH 1 INCREMENT BY 1;

-- FAN事件处理器
CREATE OR REPLACE PROCEDURE handle_fan_event(
    p_event_type VARCHAR2,
    p_instance_name VARCHAR2,
    p_service_name VARCHAR2 DEFAULT NULL,
    p_event_details VARCHAR2 DEFAULT NULL
) AS
    v_event_id NUMBER;
    v_action_taken VARCHAR2(100);
BEGIN
    v_event_id := fan_event_seq.NEXTVAL;
    
    CASE p_event_type
        WHEN 'NODE_DOWN' THEN
            v_action_taken := '记录服务自动转移预案；本示例未执行迁移';
            
            -- 记录事件
            INSERT INTO fan_event_log (
                event_id, event_type, instance_name, event_details, action_taken
            ) VALUES (
                v_event_id, p_event_type, p_instance_name, p_event_details, v_action_taken
            );
            
            -- 执行故障转移逻辑
            DBMS_OUTPUT.PUT_LINE('节点故障检测: ' || p_instance_name);
            DBMS_OUTPUT.PUT_LINE('生成自动故障转移提示；本示例未执行故障转移');
            
            -- 迁移关键服务到其他节点
            FOR svc_rec IN (
                SELECT service_name, preferred_instances, available_instances
                FROM rac_service_config
                WHERE ',' || preferred_instances || ',' LIKE '%,' || SUBSTR(p_instance_name, -1) || ',%'
                AND status = 'A'
            ) LOOP
                DBMS_OUTPUT.PUT_LINE('迁移服务: ' || svc_rec.service_name);
                -- 实际环境中调用 srvctl relocate service 命令
            END LOOP;
            
        WHEN 'SERVICE_DOWN' THEN
            v_action_taken := '尝试重启服务';
            
            INSERT INTO fan_event_log (
                event_id, event_type, instance_name, service_name, 
                event_details, action_taken
            ) VALUES (
                v_event_id, p_event_type, p_instance_name, p_service_name,
                p_event_details, v_action_taken
            );
            
            DBMS_OUTPUT.PUT_LINE('服务故障检测: ' || p_service_name || ' @ ' || p_instance_name);
            
            -- 尝试在其他实例上启动服务
            FOR inst_rec IN (
                SELECT instance_name
                FROM gv$instance
                WHERE status = 'OPEN'
                AND instance_name != p_instance_name
                ORDER BY instance_number
                FETCH FIRST 1 ROWS ONLY
            ) LOOP
                DBMS_OUTPUT.PUT_LINE('在实例 ' || inst_rec.instance_name || ' 上启动服务');
                -- 实际环境中调用服务启动命令
            END LOOP;
            
        WHEN 'NODE_UP' THEN
            v_action_taken := '节点恢复，重新平衡服务';
            
            INSERT INTO fan_event_log (
                event_id, event_type, instance_name, event_details, action_taken
            ) VALUES (
                v_event_id, p_event_type, p_instance_name, p_event_details, v_action_taken
            );
            
            DBMS_OUTPUT.PUT_LINE('节点恢复: ' || p_instance_name);
            DBMS_OUTPUT.PUT_LINE('重新分布服务负载...');
            
        ELSE
            v_action_taken := '记录事件，无特定操作';
            
            INSERT INTO fan_event_log (
                event_id, event_type, instance_name, service_name,
                event_details, action_taken
            ) VALUES (
                v_event_id, p_event_type, p_instance_name, p_service_name,
                p_event_details, v_action_taken
            );
    END CASE;
    
    COMMIT;
    
    DBMS_OUTPUT.PUT_LINE('FAN事件处理完成，事件ID: ' || v_event_id);
    
END handle_fan_event;
/
```

### 2. 应用层故障转移

```sql
-- 应用连接池监控
CREATE TABLE app_connection_monitor (
    monitor_id NUMBER PRIMARY KEY,
    check_time DATE DEFAULT SYSDATE,
    instance_name VARCHAR2(30),
    service_name VARCHAR2(50),
    active_connections NUMBER,
    idle_connections NUMBER,
    failed_connections NUMBER,
    avg_response_time NUMBER, -- 毫秒
    status VARCHAR2(20), -- HEALTHY, WARNING, CRITICAL
    auto_action VARCHAR2(100)
);

CREATE SEQUENCE app_monitor_seq START WITH 1 INCREMENT BY 1;

-- 连接健康检查
CREATE OR REPLACE PROCEDURE check_connection_health AS
    v_monitor_id NUMBER;
    v_total_sessions NUMBER;
    v_active_sessions NUMBER;
    v_blocked_sessions NUMBER;
    v_avg_response_time NUMBER;
    v_status VARCHAR2(20);
    v_action VARCHAR2(100);
BEGIN
    FOR inst_rec IN (
        SELECT instance_number, instance_name
        FROM gv$instance
        WHERE status = 'OPEN'
        ORDER BY instance_number
    ) LOOP
        v_monitor_id := app_monitor_seq.NEXTVAL;
        
        -- 获取会话统计信息
        SELECT COUNT(*) INTO v_total_sessions
        FROM gv$session
        WHERE inst_id = inst_rec.instance_number
        AND type = 'USER';
        
        SELECT COUNT(*) INTO v_active_sessions
        FROM gv$session
        WHERE inst_id = inst_rec.instance_number
        AND type = 'USER'
        AND status = 'ACTIVE';
        
        SELECT COUNT(*) INTO v_blocked_sessions
        FROM gv$session
        WHERE inst_id = inst_rec.instance_number
        AND blocking_session IS NOT NULL;
        
        -- 计算平均响应时间（简化模拟）
        v_avg_response_time := ROUND(DBMS_RANDOM.VALUE(10, 500), 2);
        
        -- 判断健康状态
        IF v_blocked_sessions > 10 OR v_avg_response_time > 1000 THEN
            v_status := 'CRITICAL';
            v_action := '需要立即处理阻塞会话';
        ELSIF v_blocked_sessions > 5 OR v_avg_response_time > 500 THEN
            v_status := 'WARNING';
            v_action := '监控会话性能';
        ELSE
            v_status := 'HEALTHY';
            v_action := '正常运行';
        END IF;
        
        -- 记录监控数据
        INSERT INTO app_connection_monitor (
            monitor_id, instance_name, active_connections, idle_connections,
            failed_connections, avg_response_time, status, auto_action
        ) VALUES (
            v_monitor_id, inst_rec.instance_name, v_active_sessions,
            v_total_sessions - v_active_sessions, v_blocked_sessions,
            v_avg_response_time, v_status, v_action
        );
        
        -- 如果状态为CRITICAL，执行自动操作
        IF v_status = 'CRITICAL' THEN
            DBMS_OUTPUT.PUT_LINE('实例 ' || inst_rec.instance_name || ' 状态严重');
            DBMS_OUTPUT.PUT_LINE('阻塞会话数: ' || v_blocked_sessions);
            DBMS_OUTPUT.PUT_LINE('平均响应时间: ' || v_avg_response_time || 'ms');
            
            -- 自动处理阻塞会话
            FOR blocked_rec IN (
                SELECT sid, serial#, blocking_session
                FROM gv$session
                WHERE inst_id = inst_rec.instance_number
                AND blocking_session IS NOT NULL
                AND last_call_et > 300 -- 超过5分钟的阻塞
            ) LOOP
                DBMS_OUTPUT.PUT_LINE('终止阻塞会话: ' || blocked_rec.sid || ',' || blocked_rec.serial#);
                -- 实际环境中执行 ALTER SYSTEM KILL SESSION
            END LOOP;
        END IF;
    END LOOP;
    
    COMMIT;
    
END check_connection_health;
/
```

## 灾难恢复方案

### 1. 异地灾备架构

```sql
-- 灾备站点配置
CREATE TABLE dr_site_config (
    site_id NUMBER PRIMARY KEY,
    site_name VARCHAR2(50),
    site_type VARCHAR2(20), -- PRIMARY, DR, BACKUP
    location VARCHAR2(100),
    network_latency_ms NUMBER, -- 网络延迟
    bandwidth_mbps NUMBER,     -- 带宽
    rto_minutes NUMBER,        -- 恢复时间目标
    rpo_minutes NUMBER,        -- 恢复点目标
    auto_failover_enabled CHAR(1) DEFAULT 'N',
    last_sync_time DATE,
    sync_status VARCHAR2(20),  -- SYNC, LAG, FAILED
    status CHAR(1) DEFAULT 'A',
    create_time DATE DEFAULT SYSDATE
);

-- 银行灾备站点配置
INSERT INTO dr_site_config VALUES (
    1, '主数据中心', 'PRIMARY', '北京亦庄', 0, 10000, 0, 0, 'N', 
    SYSDATE, 'SYNC', 'A', SYSDATE
);

INSERT INTO dr_site_config VALUES (
    2, '同城灾备中心', 'DR', '北京昌平', 2, 1000, 30, 5, 'Y',
    SYSDATE, 'SYNC', 'A', SYSDATE
);

INSERT INTO dr_site_config VALUES (
    3, '异地灾备中心', 'DR', '上海张江', 50, 100, 120, 60, 'N',
    SYSDATE, 'LAG', 'A', SYSDATE
);

-- 灾备切换预案
CREATE TABLE dr_procedure_config (
    procedure_id NUMBER PRIMARY KEY,
    disaster_type VARCHAR2(50),  -- DATACENTER_FAILURE, NETWORK_OUTAGE, SYSTEM_CRASH
    severity_level VARCHAR2(20), -- LOW, MEDIUM, HIGH, CRITICAL
    target_site_id NUMBER,
    estimated_rto_minutes NUMBER,
    estimated_rpo_minutes NUMBER,
    approval_required CHAR(1) DEFAULT 'Y',
    procedure_steps CLOB,
    rollback_steps CLOB,
    last_tested_date DATE,
    test_result VARCHAR2(20),
    status CHAR(1) DEFAULT 'A',
    CONSTRAINT fk_dr_target_site FOREIGN KEY (target_site_id) 
        REFERENCES dr_site_config(site_id)
);

-- 灾备预案配置
INSERT INTO dr_procedure_config VALUES (
    1, '主数据中心完全故障', 'CRITICAL', 2, 30, 5, 'Y',
    '1. 确认主数据中心完全不可用
     2. 启动同城灾备中心
     3. 激活Data Guard standby数据库
     4. 切换网络路由到灾备中心
     5. 启动应用服务
     6. 验证核心业务功能
     7. 通知相关业务部门',
    '1. 确认主数据中心恢复
     2. 同步数据到主数据中心
     3. 执行switchover回到主数据中心
     4. 切换网络路由
     5. 验证业务正常运行',
    SYSDATE - 30, 'SUCCESS', 'A'
);

-- 灾备切换执行
CREATE OR REPLACE PROCEDURE execute_dr_procedure(
    p_disaster_type VARCHAR2,
    p_manual_override CHAR(1) DEFAULT 'N'
) AS
    v_procedure_rec dr_procedure_config%ROWTYPE;
    v_target_site dr_site_config%ROWTYPE;
    v_can_execute BOOLEAN := FALSE;
    v_execution_log CLOB;
BEGIN
    -- 获取匹配的灾备预案
    SELECT * INTO v_procedure_rec
    FROM dr_procedure_config
    WHERE disaster_type = p_disaster_type
    AND status = 'A'
    ORDER BY severity_level DESC
    FETCH FIRST 1 ROWS ONLY;
    
    -- 获取目标站点信息
    SELECT * INTO v_target_site
    FROM dr_site_config
    WHERE site_id = v_procedure_rec.target_site_id;
    
    v_execution_log := '灾备切换执行日志' || CHR(10) ||
                      '执行时间: ' || TO_CHAR(SYSDATE, 'YYYY-MM-DD HH24:MI:SS') || CHR(10) ||
                      '灾难类型: ' || p_disaster_type || CHR(10) ||
                      '目标站点: ' || v_target_site.site_name || CHR(10) ||
                      '预计RTO: ' || v_procedure_rec.estimated_rto_minutes || ' 分钟' || CHR(10) ||
                      '预计RPO: ' || v_procedure_rec.estimated_rpo_minutes || ' 分钟' || CHR(10) ||
                      RPAD('=', 60, '=') || CHR(10) || CHR(10);
    
    -- 检查执行条件
    IF v_procedure_rec.approval_required = 'Y' AND p_manual_override = 'N' THEN
        v_execution_log := v_execution_log || '✗ 该预案标记为需要批准；本示例仅检查输入标志，不校验管理员身份或真实审批记录' || CHR(10);
    ELSIF v_target_site.status != 'A' THEN
        v_execution_log := v_execution_log || '✗ 目标站点状态异常，无法执行切换' || CHR(10);
    ELSIF v_target_site.sync_status NOT IN ('SYNC', 'LAG') THEN
        v_execution_log := v_execution_log || '✗ 目标站点同步状态异常: ' || v_target_site.sync_status || CHR(10);
    ELSE
        v_can_execute := TRUE;
    END IF;
    
    IF v_can_execute THEN
        v_execution_log := v_execution_log || '✓ 满足示例标志与站点状态检查，开始生成灾备切换步骤；未执行真实审批或切换' || CHR(10) || CHR(10);
        v_execution_log := v_execution_log || '执行步骤:' || CHR(10);
        v_execution_log := v_execution_log || v_procedure_rec.procedure_steps || CHR(10) || CHR(10);
        
        -- 实际环境中在这里执行具体的切换操作
        -- 1. Data Guard switchover/failover
        -- 2. 网络路由切换
        -- 3. 应用服务启动
        -- 4. 负载均衡配置更新
        
        v_execution_log := v_execution_log || '灾备切换步骤已生成；本示例未启动实际切换操作' || CHR(10);
        v_execution_log := v_execution_log || '切换完成后请执行业务验证测试' || CHR(10);
        
    ELSE
        v_execution_log := v_execution_log || '灾备切换执行被阻止，请检查上述问题' || CHR(10);
    END IF;
    
    DBMS_OUTPUT.PUT_LINE(v_execution_log);
    
    -- 记录执行日志
    INSERT INTO dr_execution_log (
        log_id, disaster_type, target_site_id, execution_time,
        can_execute, execution_log, manual_override
    ) VALUES (
        dr_exec_log_seq.NEXTVAL, p_disaster_type, v_target_site.site_id, SYSDATE,
        CASE WHEN v_can_execute THEN 'Y' ELSE 'N' END, v_execution_log, p_manual_override
    );
    
    COMMIT;
    
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        DBMS_OUTPUT.PUT_LINE('错误: 未找到匹配的灾备预案 - ' || p_disaster_type);
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('执行灾备切换时发生错误: ' || SQLERRM);
        ROLLBACK;
END execute_dr_procedure;
/

-- 创建必要的表和序列
CREATE TABLE dr_execution_log (
    log_id NUMBER PRIMARY KEY,
    disaster_type VARCHAR2(50),
    target_site_id NUMBER,
    execution_time DATE DEFAULT SYSDATE,
    can_execute CHAR(1),
    execution_log CLOB,
    manual_override CHAR(1) DEFAULT 'N',
    execution_result VARCHAR2(20)
);

CREATE SEQUENCE dr_exec_log_seq START WITH 1 INCREMENT BY 1;
```

### 2. 灾备演练管理

```sql
-- 灾备演练计划表
CREATE TABLE dr_drill_schedule (
    drill_id NUMBER PRIMARY KEY,
    drill_name VARCHAR2(100),
    drill_type VARCHAR2(30), -- PLANNED, SURPRISE, COMPLIANCE
    disaster_scenario VARCHAR2(100),
    scheduled_date DATE,
    duration_hours NUMBER,
    participants VARCHAR2(500),
    success_criteria CLOB,
    drill_status VARCHAR2(20), -- PLANNED, IN_PROGRESS, COMPLETED, CANCELLED
    actual_start_time DATE,
    actual_end_time DATE,
    drill_result VARCHAR2(20), -- SUCCESS, PARTIAL_SUCCESS, FAILED
    lessons_learned CLOB,
    next_drill_date DATE,
    create_time DATE DEFAULT SYSDATE
);

CREATE SEQUENCE dr_drill_seq START WITH 1 INCREMENT BY 1;

-- 创建银行灾备演练计划
INSERT INTO dr_drill_schedule VALUES (
    dr_drill_seq.NEXTVAL, '2024年第一季度灾备演练', 'PLANNED', 
    '主数据中心网络中断', DATE '2024-03-15', 4,
    'DBA团队,运维团队,业务测试团队,风险管理部',
    '1. 30分钟内完成数据库切换
     2. 核心业务功能正常运行
     3. 数据零丢失
     4. 应用响应时间不超过平时1.5倍',
    'PLANNED', NULL, NULL, NULL, NULL, DATE '2024-06-15', SYSDATE
);

-- 灾备演练执行和评估
CREATE OR REPLACE PROCEDURE execute_dr_drill(p_drill_id NUMBER) AS
    v_drill_rec dr_drill_schedule%ROWTYPE;
    v_start_time DATE;
    v_test_results CLOB;
    v_success_count NUMBER := 0;
    v_total_tests NUMBER := 0;
BEGIN
    -- 获取演练计划
    SELECT * INTO v_drill_rec
    FROM dr_drill_schedule
    WHERE drill_id = p_drill_id;
    
    v_start_time := SYSDATE;
    
    -- 更新演练状态为进行中
    UPDATE dr_drill_schedule
    SET drill_status = 'IN_PROGRESS',
        actual_start_time = v_start_time
    WHERE drill_id = p_drill_id;
    
    COMMIT;
    
    v_test_results := '灾备演练执行报告' || CHR(10) ||
                     '演练名称: ' || v_drill_rec.drill_name || CHR(10) ||
                     '开始时间: ' || TO_CHAR(v_start_time, 'YYYY-MM-DD HH24:MI:SS') || CHR(10) ||
                     RPAD('=', 60, '=') || CHR(10) || CHR(10);
    
    -- 测试1: 数据库切换时间
    v_total_tests := v_total_tests + 1;
    v_test_results := v_test_results || '测试1: 数据库切换时间' || CHR(10);
    
    -- 模拟切换操作
    DBMS_LOCK.SLEEP(2); -- 模拟切换时间
    
    DECLARE
        v_switch_time NUMBER := 25; -- 模拟25分钟切换时间
    BEGIN
        IF v_switch_time <= 30 THEN
            v_test_results := v_test_results || '✓ 切换时间: ' || v_switch_time || ' 分钟 (≤30分钟) - 通过' || CHR(10);
            v_success_count := v_success_count + 1;
        ELSE
            v_test_results := v_test_results || '✗ 切换时间: ' || v_switch_time || ' 分钟 (>30分钟) - 失败' || CHR(10);
        END IF;
    END;
    
    -- 测试2: 数据完整性验证
    v_total_tests := v_total_tests + 1;
    v_test_results := v_test_results || CHR(10) || '测试2: 数据完整性验证' || CHR(10);
    
    DECLARE
        v_data_loss NUMBER := 0; -- 模拟数据丢失量
    BEGIN
        IF v_data_loss = 0 THEN
            v_test_results := v_test_results || '✓ 数据零丢失 - 通过' || CHR(10);
            v_success_count := v_success_count + 1;
        ELSE
            v_test_results := v_test_results || '✗ 数据丢失: ' || v_data_loss || ' 条记录 - 失败' || CHR(10);
        END IF;
    END;
    
    -- 测试3: 业务功能验证
    v_total_tests := v_total_tests + 1;
    v_test_results := v_test_results || CHR(10) || '测试3: 核心业务功能验证' || CHR(10);
    
    DECLARE
        v_function_tests NUMBER := 8; -- 通过的功能测试数
        v_total_functions NUMBER := 10;
    BEGIN
        IF v_function_tests >= v_total_functions * 0.9 THEN
            v_test_results := v_test_results || '✓ 业务功能: ' || v_function_tests || '/' || 
                            v_total_functions || ' 通过 (≥90%) - 通过' || CHR(10);
            v_success_count := v_success_count + 1;
        ELSE
            v_test_results := v_test_results || '✗ 业务功能: ' || v_function_tests || '/' || 
                            v_total_functions || ' 通过 (<90%) - 失败' || CHR(10);
        END IF;
    END;
    
    -- 测试4: 性能验证
    v_total_tests := v_total_tests + 1;
    v_test_results := v_test_results || CHR(10) || '测试4: 应用响应时间验证' || CHR(10);
    
    DECLARE
        v_response_ratio NUMBER := 1.3; -- 模拟响应时间比例
    BEGIN
        IF v_response_ratio <= 1.5 THEN
            v_test_results := v_test_results || '✓ 响应时间比例: ' || v_response_ratio || 
                            ' (≤1.5倍) - 通过' || CHR(10);
            v_success_count := v_success_count + 1;
        ELSE
            v_test_results := v_test_results || '✗ 响应时间比例: ' || v_response_ratio || 
                            ' (>1.5倍) - 失败' || CHR(10);
        END IF;
    END;
    
    -- 演练总结
    v_test_results := v_test_results || CHR(10) || RPAD('=', 60, '=') || CHR(10);
    v_test_results := v_test_results || '演练总结:' || CHR(10);
    v_test_results := v_test_results || '通过测试: ' || v_success_count || '/' || v_total_tests || CHR(10);
    v_test_results := v_test_results || '成功率: ' || ROUND(v_success_count * 100 / v_total_tests, 2) || '%' || CHR(10);
    
    DECLARE
        v_drill_result VARCHAR2(20);
    BEGIN
        IF v_success_count = v_total_tests THEN
            v_drill_result := 'SUCCESS';
            v_test_results := v_test_results || '演练结果: 成功' || CHR(10);
        ELSIF v_success_count >= v_total_tests * 0.75 THEN
            v_drill_result := 'PARTIAL_SUCCESS';
            v_test_results := v_test_results || '演练结果: 部分成功' || CHR(10);
        ELSE
            v_drill_result := 'FAILED';
            v_test_results := v_test_results || '演练结果: 失败' || CHR(10);
        END IF;
        
        -- 更新演练记录
        UPDATE dr_drill_schedule
        SET drill_status = 'COMPLETED',
            actual_end_time = SYSDATE,
            drill_result = v_drill_result,
            lessons_learned = v_test_results
        WHERE drill_id = p_drill_id;
    END;
    
    COMMIT;
    
    DBMS_OUTPUT.PUT_LINE(v_test_results);
    
EXCEPTION
    WHEN OTHERS THEN
        -- 更新演练状态为失败
        UPDATE dr_drill_schedule
        SET drill_status = 'COMPLETED',
            actual_end_time = SYSDATE,
            drill_result = 'FAILED',
            lessons_learned = '演练执行过程中发生异常: ' || SQLERRM
        WHERE drill_id = p_drill_id;
        
        COMMIT;
        RAISE;
END execute_dr_drill;
/
```

Oracle高可用性方案是银行信息系统稳定运营的重要保障。综合运用RAC集群、Data Guard、自动故障转移和灾难恢复等技术，可将99.99%以上的系统可用性作为方案设计目标；能否达到该目标取决于端到端架构、故障覆盖、运维流程与实际测量，本文的模拟代码不构成达标证明。在实际部署时，需要根据业务重要性、成本预算和监管要求，选择合适的高可用性架构和策略。