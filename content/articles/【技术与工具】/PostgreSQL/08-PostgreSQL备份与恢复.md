---
title: PostgreSQL备份与恢复
tags:
  - PostgreSQL
  - 备份
  - 恢复
  - pg_dump
  - PITR
  - WAL
  - 高可用
difficulty: 高级
duration: 30分钟
description: 掌握PostgreSQL的各种备份恢复策略，包括逻辑备份、物理备份、时间点恢复等，确保数据安全。
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据库管理员
stability: slow-changing
status: maintenance
access_tier: free
updated: 2026-10-10
---


# 💾 PostgreSQL备份与恢复

## 📚 学习目标

通过本章节的学习，你将能够：
- **掌握PostgreSQL的备份策略**和选择原则
- **熟练使用pg_dump/pg_restore**进行逻辑备份恢复
- **理解WAL和PITR**时间点恢复机制
- **学会配置和管理**物理备份
- **建立完整的备份恢复**体系和最佳实践

> [!tip] 💡 学习建议
> 备份是数据库管理的生命线，**没有备份就没有安全感**。就像给重要文件做备份一样，数据库备份需要定期、可靠、可验证。**不要等到数据丢失才考虑备份**，而是要在平时就建立完善的备份体系。记住：能备份不算本事，能恢复才是真功夫！

## 🎯 备份策略概述

### 1. 备份类型对比

| 备份类型 | 速度 | 大小 | 恢复粒度 | 适用场景 |
|---------|------|------|---------|---------|
| 逻辑备份 | 慢 | 大 | 表/数据库 | 小型数据库 |
| 物理备份 | 快 | 小 | 整个集群 | 大型数据库 |
| 增量备份 | 快 | 小 | 时间点 | 频繁变更 |
| 连续归档 | 中等 | 中等 | 时间点 | 高可用性 |

```sql
-- 查看数据库基本信息
SELECT
    pg_database_size(current_database()) as database_size_bytes,
    pg_size_pretty(pg_database_size(current_database())) as database_size,
    current_database() as database_name,
    version() as postgresql_version;
```

### 2. 备份频率规划

```sql
-- 创建备份策略表
CREATE TABLE backup_strategy (
    backup_type VARCHAR(20),
    frequency VARCHAR(20),
    retention_days INTEGER,
    description TEXT
);

INSERT INTO backup_strategy VALUES
('FULL', 'Daily', 30, '每日全量逻辑备份'),
('DIFFERENTIAL', 'Hourly', 7, '每小时差异备份'),
('WAL_ARCHIVE', 'Continuous', 30, '连续WAL归档'),
('SNAPSHOT', 'Weekly', 90, '每周物理快照');

SELECT * FROM backup_strategy;
```

## 🗂️ 逻辑备份（pg_dump）

### 1. 基本pg_dump使用

```bash
# 备份单个数据库
pg_dump -h localhost -U postgres -d company_db > company_backup.sql

# 压缩备份
pg_dump -h localhost -U postgres -d company_db | gzip > company_backup.sql.gz

# 自定义格式备份（推荐）
pg_dump -h localhost -U postgres -d company_db -Fc > company_backup.backup

# 目录格式备份（并行）
pg_dump -h localhost -U postgres -d company_db -Fd -j 4 -f company_backup_dir

# 只备份结构
pg_dump -h localhost -U postgres -d company_db -s > schema_only.sql

# 只备份数据
pg_dump -h localhost -U postgres -d company_db -a > data_only.sql

# 备份特定表
pg_dump -h localhost -U postgres -d company_db -t employees > employees_backup.sql

# 备份特定模式
pg_dump -h localhost -U postgres -d company_db -n hr > hr_schema_backup.sql

# 排除特定表
pg_dump -h localhost -U postgres -d company_db -T logs -T temp_data > main_backup.sql
```

### 2. 高级pg_dump选项

```bash
# 创建详细的备份脚本
cat > backup_database.sh << 'EOF'
# !/bin/bash

# 配置变量
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="postgres"
DB_NAME="company_db"
BACKUP_DIR="/backup/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p "$BACKUP_DIR"

echo "开始备份数据库: $DB_NAME"
echo "备份时间: $(date)"

# 全量备份
pg_dump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --format=custom \
    --compress=9 \
    --verbose \
    --file="$BACKUP_DIR/${DB_NAME}_full_${DATE}.backup"

if [ $? -eq 0 ]; then
    echo "备份成功: ${DB_NAME}_full_${DATE}.backup"
    
 # 验证备份文件
    pg_restore --list "$BACKUP_DIR/${DB_NAME}_full_${DATE}.backup" > /dev/null
    if [ $? -eq 0 ]; then
        echo "备份归档目录读取成功；尚未验证实际恢复及数据完整性"
    else
        echo "警告: 备份文件验证失败"
    fi
    
 # 清理旧备份（保留7天）
    find "$BACKUP_DIR" -name "${DB_NAME}_full_*.backup" -mtime +7 -delete
    
else
    echo "备份失败"
    exit 1
fi

echo "备份完成: $(date)"
EOF

chmod +x backup_database.sh
```

### 3. pg_dumpall备份整个集群

```bash
# 备份整个PostgreSQL集群
pg_dumpall -h localhost -U postgres > cluster_backup.sql

# 只备份全局对象（用户、角色、表空间等）
pg_dumpall -h localhost -U postgres -g > globals_backup.sql

# 只备份角色
pg_dumpall -h localhost -U postgres -r > roles_backup.sql

# 只备份表空间
pg_dumpall -h localhost -U postgres -t > tablespaces_backup.sql
```

## 🔄 恢复操作

### 1. 使用psql恢复

```bash
# 恢复SQL格式备份
psql -h localhost -U postgres -d new_database < company_backup.sql

# 恢复压缩备份
gunzip -c company_backup.sql.gz | psql -h localhost -U postgres -d new_database

# 在恢复前创建数据库
createdb -h localhost -U postgres new_database
psql -h localhost -U postgres -d new_database < company_backup.sql
```

### 2. 使用pg_restore恢复

```bash
# 恢复自定义格式备份
pg_restore -h localhost -U postgres -d new_database company_backup.backup

# 恢复到新数据库（自动创建）
pg_restore -h localhost -U postgres -C -d postgres company_backup.backup

# 并行恢复
pg_restore -h localhost -U postgres -d new_database -j 4 company_backup.backup

# 只恢复特定表
pg_restore -h localhost -U postgres -d new_database -t employees company_backup.backup

# 只恢复结构
pg_restore -h localhost -U postgres -d new_database -s company_backup.backup

# 只恢复数据
pg_restore -h localhost -U postgres -d new_database -a company_backup.backup

# 查看备份内容
pg_restore --list company_backup.backup

# 清理目标数据库后恢复
pg_restore -h localhost -U postgres -d new_database -c company_backup.backup
```

### 3. 选择性恢复

```bash
# 创建恢复脚本
cat > selective_restore.sh << 'EOF'
# !/bin/bash

BACKUP_FILE="company_backup.backup"
TARGET_DB="restored_db"

# 查看备份内容
echo "备份文件内容:"
pg_restore --list "$BACKUP_FILE"

# 创建目标数据库
createdb "$TARGET_DB"

# 只恢复特定的表
echo "恢复employees表..."
pg_restore -d "$TARGET_DB" -t employees "$BACKUP_FILE"

echo "恢复departments表..."
pg_restore -d "$TARGET_DB" -t departments "$BACKUP_FILE"

# 恢复特定模式
echo "恢复hr模式..."
pg_restore -d "$TARGET_DB" -n hr "$BACKUP_FILE"

echo "选择性恢复完成"
EOF

chmod +x selective_restore.sh
```

## 📜 WAL和连续归档

### 1. 配置WAL归档

```sql
-- 查看当前WAL设置
SHOW wal_level;
SHOW archive_mode;
SHOW archive_command;
SHOW max_wal_senders;

-- 在postgresql.conf中配置WAL归档
/*
# WAL设置
wal_level = replica                    # 启用WAL复制
archive_mode = on                      # 启用归档模式
archive_command = 'cp %p /archive/%f' # 归档命令
max_wal_senders = 3                    # 最大WAL发送者

# WAL段设置
wal_keep_segments = 32                 # 保留的WAL段数
checkpoint_segments = 8                # 检查点间隔
checkpoint_completion_target = 0.7     # 检查点完成目标
*/
```

### 2. 设置归档脚本

```bash
# 创建WAL归档目录
sudo mkdir -p /archive/wal
sudo chown postgres:postgres /archive/wal

# 创建归档脚本
cat > /usr/local/bin/archive_wal.sh << 'EOF'
# !/bin/bash

# WAL归档脚本
WAL_FILE="$1"
WAL_PATH="$2"
ARCHIVE_DIR="/archive/wal"

# 创建归档目录
mkdir -p "$ARCHIVE_DIR"

# 复制WAL文件
if cp "$WAL_PATH" "$ARCHIVE_DIR/$WAL_FILE"; then
    echo "$(date): WAL文件归档成功: $WAL_FILE" >> /var/log/postgresql/archive.log
    exit 0
else
    echo "$(date): WAL文件归档失败: $WAL_FILE" >> /var/log/postgresql/archive.log
    exit 1
fi
EOF

chmod +x /usr/local/bin/archive_wal.sh

# 在postgresql.conf中设置
# archive_command = '/usr/local/bin/archive_wal.sh %f %p'
```

### 3. 基础备份

```bash
# 创建基础备份脚本
cat > base_backup.sh << 'EOF'
# !/bin/bash

BACKUP_DIR="/backup/base"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/base_backup_$DATE"

echo "开始基础备份: $(date)"

# 创建备份目录
mkdir -p "$BACKUP_PATH"

# 执行基础备份
pg_basebackup \
    -h localhost \
    -U postgres \
    -D "$BACKUP_PATH" \
    -Ft \
    -z \
    -P \
    -v

if [ $? -eq 0 ]; then
    echo "基础备份成功: $BACKUP_PATH"
    
 # 记录备份信息
    echo "BACKUP_DATE=$DATE" > "$BACKUP_PATH/backup_info"
    echo "BACKUP_PATH=$BACKUP_PATH" >> "$BACKUP_PATH/backup_info"
    echo "WAL_START=$(cat "$BACKUP_PATH/backup_label" | grep START | cut -d' ' -f3)" >> "$BACKUP_PATH/backup_info"
    
 # 清理旧备份
    find "$BACKUP_DIR" -name "base_backup_*" -mtime +30 -exec rm -rf {} \;
    
else
    echo "基础备份失败"
    exit 1
fi

echo "基础备份完成: $(date)"
EOF

chmod +x base_backup.sh
```

## ⏰ 时间点恢复（PITR）

### 1. PITR恢复过程

```bash
# 创建PITR恢复脚本
cat > pitr_recovery.sh << 'EOF'
# !/bin/bash

# PITR恢复脚本
BASE_BACKUP="/backup/base/base_backup_20241201_120000"
RECOVERY_TARGET_TIME="2024-12-01 14:30:00"
RECOVERY_DIR="/var/lib/postgresql/recovery"
WAL_ARCHIVE="/archive/wal"

echo "开始PITR恢复: $(date)"
echo "目标时间: $RECOVERY_TARGET_TIME"

# 停止PostgreSQL服务
sudo systemctl stop postgresql

# 清理数据目录
sudo rm -rf "$RECOVERY_DIR"
sudo mkdir -p "$RECOVERY_DIR"
sudo chown postgres:postgres "$RECOVERY_DIR"

# 恢复基础备份
echo "恢复基础备份..."
cd "$RECOVERY_DIR"
sudo -u postgres tar -xzf "$BASE_BACKUP/base.tar.gz"

# 创建recovery.conf
cat > "$RECOVERY_DIR/recovery.conf" << EOC
restore_command = 'cp $WAL_ARCHIVE/%f %p'
recovery_target_time = '$RECOVERY_TARGET_TIME'
recovery_target_timeline = 'latest'
recovery_target_action = 'promote'
EOC

sudo chown postgres:postgres "$RECOVERY_DIR/recovery.conf"

echo "配置文件已创建，准备启动恢复..."
echo "请手动启动PostgreSQL服务以完成恢复"
EOF

chmod +x pitr_recovery.sh
```

### 2. 恢复配置选项

```sql
-- 在recovery.conf中的常用配置选项
/*
# 基本恢复设置
restore_command = 'cp /archive/wal/%f %p'
recovery_target_timeline = 'latest'

# 时间点恢复选项（任选其一）
recovery_target_time = '2024-12-01 14:30:00'          # 恢复到特定时间
recovery_target_xid = '12345'                          # 恢复到特定事务ID
recovery_target_name = 'before_major_update'           # 恢复到命名的恢复点
recovery_target_lsn = '0/15000000'                     # 恢复到特定LSN

# 恢复完成后的行为
recovery_target_action = 'promote'                     # 提升为主服务器
# recovery_target_action = 'pause'                     # 暂停等待手动操作
# recovery_target_action = 'shutdown'                  # 关闭服务器

# 其他选项
recovery_target_inclusive = true                       # 包含目标事务
standby_mode = off                                      # 不作为备用服务器
*/
```

### 3. 创建恢复点

```sql
-- 创建命名恢复点
SELECT pg_create_restore_point('before_major_update');

-- 查看当前LSN
SELECT pg_current_wal_lsn();

-- 强制WAL切换
SELECT pg_switch_wal();

-- 查看WAL文件信息
SELECT 
    file_name,
    file_offset 
FROM pg_walfile_name_offset(pg_current_wal_lsn());
```

## 🔧 自动化备份系统

### 1. 完整备份脚本

```bash
# 创建企业级备份脚本
cat > enterprise_backup.sh << 'EOF'
# !/bin/bash

# 企业级PostgreSQL备份脚本
set -e

# 配置部分
CONFIG_FILE="/etc/postgresql/backup.conf"
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
else
 # 默认配置
    DB_HOST="localhost"
    DB_PORT="5432"
    DB_USER="postgres"
    BACKUP_ROOT="/backup/postgresql"
    RETENTION_DAYS="30"
    COMPRESS_LEVEL="9"
    PARALLEL_JOBS="4"
    EMAIL_NOTIFY="admin@company.com"
fi

# 函数定义
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

send_notification() {
    local subject="$1"
    local message="$2"
    echo "$message" | mail -s "$subject" "$EMAIL_NOTIFY"
}

# 初始化
DATE=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$BACKUP_ROOT/logs/backup_$DATE.log"
mkdir -p "$BACKUP_ROOT/logs"
mkdir -p "$BACKUP_ROOT/logical"
mkdir -p "$BACKUP_ROOT/physical"

log_message "开始备份作业"

# 获取数据库列表
DATABASES=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -t -c "SELECT datname FROM pg_database WHERE NOT datistemplate AND datname != 'postgres';" | grep -v '^$')

# 逻辑备份
log_message "开始逻辑备份"
for db in $DATABASES; do
    log_message "备份数据库: $db"
    
    BACKUP_FILE="$BACKUP_ROOT/logical/${db}_${DATE}.backup"
    
    pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$db" \
        -Fc \
        -Z "$COMPRESS_LEVEL" \
        -v \
        -f "$BACKUP_FILE" 2>> "$LOG_FILE"
    
    if [ $? -eq 0 ]; then
        log_message "数据库 $db 备份成功"
        
 # 验证备份
        pg_restore --list "$BACKUP_FILE" > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            log_message "备份文件 $db 的归档目录读取成功；尚未验证实际恢复及数据完整性"
        else
            log_message "警告: 备份文件 $db 验证失败"
        fi
    else
        log_message "错误: 数据库 $db 备份失败"
    fi
done

# 全局对象备份
log_message "备份全局对象"
pg_dumpall \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -g > "$BACKUP_ROOT/logical/globals_${DATE}.sql"

# 物理备份（基础备份）
log_message "开始物理备份"
BASE_BACKUP_DIR="$BACKUP_ROOT/physical/base_backup_$DATE"
mkdir -p "$BASE_BACKUP_DIR"

pg_basebackup \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -D "$BASE_BACKUP_DIR" \
    -Ft \
    -z \
    -P \
    -v 2>> "$LOG_FILE"

if [ $? -eq 0 ]; then
    log_message "物理备份成功"
else
    log_message "错误: 物理备份失败"
fi

# 清理旧备份
log_message "清理旧备份文件"
find "$BACKUP_ROOT/logical" -name "*.backup" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_ROOT/logical" -name "*.sql" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_ROOT/physical" -name "base_backup_*" -mtime +$RETENTION_DAYS -exec rm -rf {} \;
find "$BACKUP_ROOT/logs" -name "*.log" -mtime +7 -delete

# 生成备份报告
BACKUP_SIZE=$(du -sh "$BACKUP_ROOT" | cut -f1)
log_message "备份作业完成，总大小: $BACKUP_SIZE"

# 发送通知
send_notification "PostgreSQL备份完成 - $DATE" "备份作业成功完成，总大小: $BACKUP_SIZE"

log_message "备份脚本执行完成"
EOF

chmod +x enterprise_backup.sh
```

### 2. 备份监控

```sql
-- 创建备份监控表
CREATE TABLE backup_log (
    id SERIAL PRIMARY KEY,
    backup_type VARCHAR(20),
    database_name VARCHAR(100),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration INTERVAL,
    backup_size_bytes BIGINT,
    backup_file_path TEXT,
    status VARCHAR(20),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建备份监控函数
CREATE OR REPLACE FUNCTION log_backup_result(
    p_backup_type VARCHAR(20),
    p_database_name VARCHAR(100),
    p_start_time TIMESTAMP,
    p_end_time TIMESTAMP,
    p_backup_size BIGINT,
    p_backup_path TEXT,
    p_status VARCHAR(20),
    p_error_message TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    backup_id INTEGER;
BEGIN
    INSERT INTO backup_log (
        backup_type,
        database_name,
        start_time,
        end_time,
        duration,
        backup_size_bytes,
        backup_file_path,
        status,
        error_message
    ) VALUES (
        p_backup_type,
        p_database_name,
        p_start_time,
        p_end_time,
        p_end_time - p_start_time,
        p_backup_size,
        p_backup_path,
        p_status,
        p_error_message
    ) RETURNING id INTO backup_id;
    
    RETURN backup_id;
END;
$$ LANGUAGE plpgsql;

-- 查看备份历史
SELECT 
    backup_type,
    database_name,
    start_time,
    duration,
    pg_size_pretty(backup_size_bytes) as backup_size,
    status
FROM backup_log
ORDER BY start_time DESC
LIMIT 10;
```

### 3. Cron作业配置

```bash
# 配置定时备份
cat > /etc/cron.d/postgresql-backup << 'EOF'
# PostgreSQL自动备份计划

# 每日凌晨2点执行完整备份
0 2 * * * postgres /usr/local/bin/enterprise_backup.sh

# 每小时执行WAL归档检查
0 * * * * postgres /usr/local/bin/check_wal_archive.sh

# 每周日凌晨1点执行备份验证
0 1 * * 0 postgres /usr/local/bin/verify_backups.sh

# 每月第一天清理归档日志
0 3 1 * * postgres /usr/local/bin/cleanup_old_archives.sh
EOF
```

## 🔍 备份验证和测试

### 1. 备份验证脚本

```bash
# 创建备份验证脚本
cat > verify_backups.sh << 'EOF'
# !/bin/bash

BACKUP_DIR="/backup/postgresql"
TEST_DB="backup_test_$(date +%s)"
LOG_FILE="/tmp/backup_verification.log"

echo "开始备份验证: $(date)" > "$LOG_FILE"

# 查找最新的备份文件
LATEST_BACKUP=$(find "$BACKUP_DIR/logical" -name "*.backup" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)

if [ -z "$LATEST_BACKUP" ]; then
    echo "错误: 未找到备份文件" >> "$LOG_FILE"
    exit 1
fi

echo "验证备份文件: $LATEST_BACKUP" >> "$LOG_FILE"

# 创建测试数据库
createdb "$TEST_DB" 2>> "$LOG_FILE"

# 恢复备份
pg_restore -d "$TEST_DB" "$LATEST_BACKUP" 2>> "$LOG_FILE"

if [ $? -eq 0 ]; then
    echo "备份恢复成功" >> "$LOG_FILE"
    
 # 统计public模式表数量，不代表数据完整性验证
    TABLE_COUNT=$(psql -d "$TEST_DB" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>> "$LOG_FILE")
    echo "恢复的表数量: $TABLE_COUNT" >> "$LOG_FILE"
    
 # 清理测试数据库
    dropdb "$TEST_DB" 2>> "$LOG_FILE"
    echo "本次测试库恢复和public模式表数量统计完成；尚未验证业务数据完整性及其他备份" >> "$LOG_FILE"
else
    echo "备份验证失败" >> "$LOG_FILE"
    dropdb "$TEST_DB" 2>/dev/null
    exit 1
fi

echo "备份验证结束: $(date)" >> "$LOG_FILE"
EOF

chmod +x verify_backups.sh
```

### 2. 恢复测试

```sql
-- 创建恢复测试存储过程
CREATE OR REPLACE FUNCTION test_backup_restore(backup_file_path TEXT)
RETURNS TABLE(
    test_result TEXT,
    table_count INTEGER,
    row_count BIGINT,
    test_duration INTERVAL
) AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    test_db_name TEXT;
    table_cnt INTEGER;
    row_cnt BIGINT;
BEGIN
    start_time := CURRENT_TIMESTAMP;
    test_db_name := 'restore_test_' || extract(epoch from start_time)::text;
    
    -- 这里需要在外部脚本中实际执行恢复操作
    -- 返回测试结果
    end_time := CURRENT_TIMESTAMP;
    
    RETURN QUERY 
    SELECT 
        'NOT_EXECUTED: 示例占位，未执行恢复测试'::TEXT,
        NULL::INTEGER,
        NULL::BIGINT,
        (end_time - start_time)::INTERVAL;
END;
$$ LANGUAGE plpgsql;
```

## 🎯 灾难恢复计划

### 1. 灾难恢复步骤

```bash
# 创建灾难恢复文档
cat > disaster_recovery_plan.md << 'EOF'
# PostgreSQL灾难恢复计划

## 1. 评估阶段
- [ ] 确定灾难类型和影响范围
- [ ] 评估数据丢失程度
- [ ] 确定恢复目标时间点
- [ ] 准备恢复环境

## 2. 恢复步骤

### 2.1 完全数据丢失
1. 准备新的服务器环境
2. 安装PostgreSQL（相同版本）
3. 恢复最新的基础备份
4. 应用WAL文件到目标时间点
5. 验证数据完整性
6. 切换应用连接

### 2.2 部分数据损坏
1. 停止应用写入
2. 评估损坏范围
3. 从备份中恢复特定表/数据库
4. 验证数据一致性
5. 重启应用服务

### 2.3 逻辑错误（误删除等）
1. 立即停止相关操作
2. 创建当前状态的快照
3. 使用PITR恢复到错误前时间点
4. 提取正确的数据
5. 将数据合并到当前系统

## 3. 验证清单
- [ ] 数据库可以正常启动
- [ ] 所有表和索引完整
- [ ] 应用程序可以正常连接
- [ ] 关键业务功能正常
- [ ] 性能达到预期水平

## 4. 后续工作
- [ ] 更新备份策略
- [ ] 总结经验教训
- [ ] 更新恢复计划
- [ ] 进行恢复演练
EOF
```

## 🎯 最佳实践

### 1. 备份策略建议

```sql
-- 创建备份策略评估函数
CREATE OR REPLACE FUNCTION evaluate_backup_strategy(
    database_size_gb NUMERIC,
    change_rate_percent NUMERIC,
    rto_hours INTEGER,
    rpo_minutes INTEGER
) RETURNS TABLE(
    strategy_name TEXT,
    backup_frequency TEXT,
    estimated_cost TEXT,
    pros_cons TEXT
) AS $$
BEGIN
    IF database_size_gb < 10 THEN
        RETURN QUERY VALUES 
            ('Simple Daily Dump', 'Daily', 'Low', 'Simple, but limited recovery options'),
            ('Physical Base Backup + WAL', 'Daily + Continuous', 'Medium', 'Illustrative PITR option; requires a valid physical base backup and continuous WAL, with RTO/RPO tested separately');
    ELSIF database_size_gb < 100 THEN
        RETURN QUERY VALUES 
            ('Physical + WAL', 'Daily + Continuous', 'Medium', 'Fast backup/recovery'),
            ('Streaming Replication', 'Continuous', 'High', 'Illustrative availability option; RPO depends on replication mode, lag and failure conditions; not a substitute for historical backups');
    ELSE
        RETURN QUERY VALUES 
            ('Incremental + WAL', 'Hourly + Continuous', 'High', 'Illustrative option for large databases; requires a supported incremental backup implementation, a valid backup chain and continuous WAL; suitability must be tested'),
            ('Multi-tier Strategy', 'Mixed', 'Very High', 'Enterprise-grade solution');
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 测试不同场景的备份策略
SELECT * FROM evaluate_backup_strategy(5, 10, 4, 60);    -- 小型数据库
SELECT * FROM evaluate_backup_strategy(50, 20, 2, 30);   -- 中型数据库
SELECT * FROM evaluate_backup_strategy(500, 30, 1, 15);  -- 大型数据库
```

### 2. 监控和告警

```sql
-- 创建备份监控视图
CREATE VIEW v_backup_health AS
SELECT 
    'Logical Backup' as backup_type,
    CASE 
        WHEN last_backup IS NULL THEN 'UNKNOWN'
        WHEN last_backup < CURRENT_TIMESTAMP - INTERVAL '1 day' THEN 'CRITICAL'
        WHEN last_backup < CURRENT_TIMESTAMP - INTERVAL '12 hours' THEN 'WARNING'
        ELSE 'OK'
    END as status,
    last_backup,
    CURRENT_TIMESTAMP - last_backup as time_since_last
FROM (
    SELECT MAX(end_time) as last_backup
    FROM backup_log 
    WHERE backup_type = 'LOGICAL' AND status = 'SUCCESS'
) lb

UNION ALL

SELECT 
    'WAL Archive' as backup_type,
    CASE 
        WHEN last_wal < CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN 'CRITICAL'
        WHEN last_wal < CURRENT_TIMESTAMP - INTERVAL '30 minutes' THEN 'WARNING'
        ELSE 'OK'
    END as status,
    last_wal,
    CURRENT_TIMESTAMP - last_wal as time_since_last
FROM (
    SELECT MAX(modification) as last_wal
    FROM pg_stat_file('/archive/wal/')
) wa;

-- 查看备份健康状态
SELECT * FROM v_backup_health;
```

## 🎯 小结

通过本章节的学习，我们掌握了：

1. **备份策略**：逻辑备份、物理备份、增量备份的选择
2. **pg_dump/pg_restore**：完整的备份恢复工具使用
3. **WAL和PITR**：连续归档和时间点恢复机制
4. **自动化系统**：企业级备份监控和管理
5. **灾难恢复**：完整的灾难恢复计划和最佳实践

> [!abstract] 📚 下一步学习
> 现在你已经掌握了PostgreSQL的备份恢复体系，接下来我们将学习09-PostgreSQL扩展与高级特性|PostgreSQL扩展与进阶内容特性，探索PostgreSQL的强大扩展能力。

## 🔗 相关资源

- [[【技术与工具】/PostgreSQL/07-PostgreSQL事务与并发控制|PostgreSQL事务与并发控制]]
- [[【技术与工具】/PostgreSQL/00-PostgreSQL学习路线图|PostgreSQL]]
- MySQL - 数据库监控概念

---

> 💡 **记住**：备份是数据库管理的**核心责任**，没有备份就没有安全感。**定期测试恢复过程**比制定备份计划更重要。建立**多层次的备份策略**，不要把鸡蛋放在一个篮子里。**自动化是关键**，但人工验证同样重要。记住：备份的目的是为了恢复，**能恢复的备份才是好备份**！