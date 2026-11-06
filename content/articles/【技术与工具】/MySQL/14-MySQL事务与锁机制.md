---
title: MySQL事务与锁机制 - ACID特性与并发控制详解
tags:
  - MySQL
  - 事务
  - 锁机制
  - ACID
  - 隔离级别
  - 并发控制
created: 2024-06-29
updated: 2026-10-10
difficulty: 高级
duration: 100分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据治理工程师
stability: slow-changing
status: maintenance
access_tier: free
---


# 🔐 MySQL事务与锁机制 - ACID特性与并发控制详解

> [!abstract] 📋 本节概览
> - 🎯 **学习目标**：深入理解MySQL事务机制和锁的工作原理
> - 📚 **前置知识**：[[【技术与工具】/MySQL/06-InnoDB存储引擎|InnoDB存储引擎]] | [[【技术与工具】/PostgreSQL/00-PostgreSQL学习路线图|PostgreSQL/PostgreSQL]] | [[【技术与工具】/MySQL/05-MySQL架构原理|MySQL架构]]
> - ⏱️ **预计用时**：100分钟
> - 🔧 **技术重点**：ACID特性、事务隔离级别、锁类型、死锁处理

## 🎯 事务基础概念

### ACID特性详解

> [!note] 💡 什么是ACID特性？
> ACID是数据库事务必须具备的四个特性，可以用银行转账来理解：
> - **原子性(Atomicity)**：转账要么全部成功，要么全部失败，不能出现钱被扣了但没到账的情况
> - **一致性(Consistency)**：转账前后，总金额保持不变，符合业务规则
> - **隔离性(Isolation)**：多个转账操作不会互相干扰
> - **持久性(Durability)**：转账成功后，即使系统崩溃，数据也不会丢失

```sql title="ACID特性演示"
-- 创建测试表
CREATE TABLE accounts (
    id INT PRIMARY KEY,
    name VARCHAR(50),
    balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO accounts (id, name, balance) VALUES
(1, 'Alice', 1000.00),
(2, 'Bob', 500.00),
(3, 'Charlie', 1500.00);

-- 1. 原子性(Atomicity)演示
-- 转账操作：要么全部成功，要么全部失败
START TRANSACTION;

    UPDATE accounts SET balance = balance - 200 WHERE id = 1;  -- Alice转出200
    UPDATE accounts SET balance = balance + 200 WHERE id = 2;  -- Bob收到200
    
    -- 检查余额是否足够
    SELECT balance FROM accounts WHERE id = 1;
    
    -- 如果Alice余额不足，回滚整个事务
    -- ROLLBACK;
    
    -- 一切正常，提交事务
    COMMIT;

-- 2. 一致性(Consistency)演示
-- 业务规则：账户余额不能为负数
DELIMITER $$
CREATE TRIGGER check_balance_before_update
BEFORE UPDATE ON accounts
FOR EACH ROW
BEGIN
    IF NEW.balance < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Balance cannot be negative';
    END IF;
END$$
DELIMITER ;

-- 3. 持久性(Durability)演示
-- 提交后的数据即使系统崩溃也不会丢失
START TRANSACTION;
UPDATE accounts SET balance = balance + 100 WHERE id = 1;
COMMIT;  -- 提交后数据持久化到磁盘

-- 查看InnoDB事务日志
SHOW ENGINE INNODB STATUS\G
```

### 事务隔离级别

```sql title="四种隔离级别对比"
-- 查看当前隔离级别
SELECT @@transaction_isolation;
SHOW VARIABLES LIKE 'transaction_isolation';

-- 1. READ UNCOMMITTED（读未提交）- 最低隔离级别，会产生脏读
-- 会话1
SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
START TRANSACTION;
SELECT balance FROM accounts WHERE id = 1;  -- 读取到1000

-- 会话2
START TRANSACTION;
UPDATE accounts SET balance = 1200 WHERE id = 1;  -- 修改但未提交
-- 此时会话1再次查询会看到1200（脏读：读到了未提交的数据）

-- 2. READ COMMITTED（读已提交）- 避免脏读，但会产生不可重复读
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
START TRANSACTION;
SELECT balance FROM accounts WHERE id = 1;  -- 第一次读取：1000
-- 其他会话提交修改后
SELECT balance FROM accounts WHERE id = 1;  -- 第二次读取：1200（不可重复读：同一事务中两次读取结果不同）

-- 3. REPEATABLE READ（可重复读，MySQL默认）
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
START TRANSACTION;
SELECT * FROM accounts WHERE balance > 800;  -- 第一次查询
-- 其他会话插入新记录后
SELECT * FROM accounts WHERE balance > 800;  -- 在REPEATABLE READ下，普通一致性读通常沿用同一事务快照，不会仅因其他会话插入而读到新增行

-- 4. SERIALIZABLE（串行化）
SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE;
START TRANSACTION;
SELECT * FROM accounts WHERE id = 1;
-- 此时其他会话的写操作会被阻塞

-- 隔离级别对比测试
CREATE TABLE isolation_test (
    id INT AUTO_INCREMENT PRIMARY KEY,
    value INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 测试脚本：模拟并发场景下不同隔离级别的表现
```

## 🔒 MySQL锁机制详解

### 锁的分类

```sql title="MySQL锁类型演示"
-- 1. 表级锁
-- 显式锁表
LOCK TABLES accounts READ;
SELECT * FROM accounts;  -- 可以读取
-- UPDATE accounts SET balance = 1000 WHERE id = 1;  -- 报错，READ锁不允许写

UNLOCK TABLES;

LOCK TABLES accounts WRITE;
SELECT * FROM accounts;   -- 可以读取
UPDATE accounts SET balance = 1000 WHERE id = 1;  -- 可以写入
UNLOCK TABLES;

-- 2. 行级锁演示
-- 共享锁(S锁)
START TRANSACTION;
SELECT * FROM accounts WHERE id = 1 LOCK IN SHARE MODE;
-- 其他会话可以读取但不能修改该行
COMMIT;

-- 排他锁(X锁)
START TRANSACTION;
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;
-- 其他会话对该行的加锁读或修改通常需要等待；普通一致性读通常不受此锁阻塞
COMMIT;

-- 3. InnoDB的三种行锁类型
CREATE TABLE lock_demo (
    id INT PRIMARY KEY,
    num INT,
    INDEX idx_num (num)
);

INSERT INTO lock_demo VALUES (1, 10), (5, 20), (10, 30), (15, 40);

-- 记录锁(Record Lock)：锁定具体的一行数据
-- 🔒 就像给特定的座位贴上"占用"标签
START TRANSACTION;
SELECT * FROM lock_demo WHERE id = 5 FOR UPDATE;  -- 只锁定id=5这一行

-- 间隙锁(Gap Lock)：锁定记录之间的"空隙"
-- 🚧 防止其他事务在这个区间插入新数据
START TRANSACTION;
SELECT * FROM lock_demo WHERE num = 25 FOR UPDATE;  -- 锁定(20,30)之间的空隙，防止插入num=25的记录

-- 临键锁(Next-Key Lock)：记录锁 + 间隙锁的组合
-- 🔒+🚧 既锁定记录，又锁定它前面的间隙
START TRANSACTION;
SELECT * FROM lock_demo WHERE num <= 20 FOR UPDATE;  -- 锁定所有num<=20的记录及其间隙
```

### 锁等待与死锁

```sql title="锁等待和死锁分析"
-- 1. 锁等待监控
-- 查看当前锁等待情况：以下 innodb_lock_waits 查询适用于 MySQL 5.7
-- MySQL 8.0 应使用 performance_schema.data_lock_waits 等接口，不能直接执行此查询
SELECT 
    r.trx_id waiting_trx_id,
    r.trx_mysql_thread_id waiting_thread,
    r.trx_query waiting_query,
    b.trx_id blocking_trx_id,
    b.trx_mysql_thread_id blocking_thread,
    b.trx_query blocking_query,
    w.requesting_lock_id,
    w.blocking_lock_id
FROM information_schema.innodb_lock_waits w
INNER JOIN information_schema.innodb_trx b ON b.trx_id = w.blocking_trx_id
INNER JOIN information_schema.innodb_trx r ON r.trx_id = w.requesting_trx_id;

-- 查看所有活跃事务
SELECT 
    trx_id,
    trx_state,
    trx_started,
    trx_mysql_thread_id,
    trx_query,
    trx_rows_locked,
    trx_rows_modified,
    trx_lock_structs,
    trx_weight
FROM information_schema.innodb_trx
ORDER BY trx_started;

-- 2. 死锁演示和处理
-- 会话1
START TRANSACTION;
UPDATE accounts SET balance = balance + 100 WHERE id = 1;
-- 等待一段时间后
UPDATE accounts SET balance = balance + 100 WHERE id = 2;

-- 会话2（同时执行）
START TRANSACTION;
UPDATE accounts SET balance = balance - 50 WHERE id = 2;
-- 等待一段时间后
UPDATE accounts SET balance = balance - 50 WHERE id = 1;  -- 死锁发生

-- 查看最近的死锁信息
SHOW ENGINE INNODB STATUS\G

-- 死锁检测配置
SHOW VARIABLES LIKE '%deadlock%';
SHOW VARIABLES LIKE '%innodb_lock_wait_timeout%';

-- 设置锁等待超时时间
SET SESSION innodb_lock_wait_timeout = 10;  -- 10秒超时
```

## 📊 MVCC多版本并发控制

### MVCC工作原理

```sql title="MVCC机制演示"
-- MVCC通过undo log实现多版本
-- 创建测试表
CREATE TABLE mvcc_demo (
    id INT PRIMARY KEY,
    name VARCHAR(50),
    version INT DEFAULT 1
) ENGINE=InnoDB;

INSERT INTO mvcc_demo VALUES (1, 'Initial', 1);

-- 演示MVCC的可重复读
-- 会话1：长事务
START TRANSACTION;
SELECT * FROM mvcc_demo WHERE id = 1;  -- 看到版本1

-- 会话2：修改数据
START TRANSACTION;
UPDATE mvcc_demo SET name = 'Updated', version = 2 WHERE id = 1;
COMMIT;

-- 回到会话1
SELECT * FROM mvcc_demo WHERE id = 1;  -- 仍然看到版本1（可重复读）
COMMIT;

-- 现在会话1提交后再查询
SELECT * FROM mvcc_demo WHERE id = 1;  -- 看到版本2

-- 查看InnoDB行格式和隐藏列
-- InnoDB为每行添加了隐藏列：
-- DB_TRX_ID: 事务ID
-- DB_ROLL_PTR: 回滚指针
-- DB_ROW_ID: 行ID（如果没有主键）

-- 查看活跃事务统计（以下查询并不统计undo log用量）
SELECT 
    COUNT(*) as active_transactions,
    MIN(trx_started) as oldest_trx,
    SUM(trx_rows_locked) as total_rows_locked
FROM information_schema.innodb_trx;

SHOW ENGINE INNODB STATUS\G  -- 查看History list length
```

## 🚀 事务优化实践

### 事务设计最佳实践

```sql title="事务优化技巧"
-- 1. 减少事务持续时间
-- ❌ 错误：长时间持有事务
START TRANSACTION;
SELECT SLEEP(10);  -- 模拟耗时操作
UPDATE accounts SET balance = balance + 100 WHERE id = 1;
COMMIT;

-- ✅ 缩短事务，同时避免用事务外读取的旧余额覆盖并发更新
START TRANSACTION;
UPDATE accounts SET balance = balance + 100 WHERE id = 1;
COMMIT;

-- 2. 避免大事务
-- ❌ 错误：在事务中处理大量数据
START TRANSACTION;
UPDATE accounts SET balance = balance * 1.1;  -- 更新所有记录
COMMIT;

-- ✅ 正确：分批处理
DELIMITER $$
CREATE PROCEDURE UpdateBalanceInBatches()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE batch_size INT DEFAULT 1000;
    DECLARE offset_val INT DEFAULT 0;
    
    WHILE NOT done DO
        START TRANSACTION;
        
        UPDATE accounts 
        SET balance = balance * 1.1 
        WHERE id >= offset_val 
        ORDER BY id 
        LIMIT batch_size;
        
        COMMIT;
        
        IF ROW_COUNT() < batch_size THEN
            SET done = TRUE;
        END IF;
        
        SET offset_val = offset_val + batch_size;
    END WHILE;
END$$
DELIMITER ;

-- 3. 合理选择隔离级别
-- 根据业务需求选择最低的满足需求的隔离级别
-- 对于统计查询，可以使用READ COMMITTED
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
START TRANSACTION;
SELECT COUNT(*), AVG(balance) FROM accounts;
COMMIT;

-- 4. 使用乐观锁减少锁争用
-- 添加版本号字段
ALTER TABLE accounts ADD COLUMN version INT DEFAULT 1;

-- 乐观锁更新
UPDATE accounts 
SET balance = balance - 100, version = version + 1
WHERE id = 1 AND version = @current_version;

-- 检查更新是否成功
SELECT ROW_COUNT() as affected_rows;
```

### 死锁预防和处理

```sql title="死锁预防策略"
-- 1. 统一的锁获取顺序
-- ❌ 容易产生死锁的代码
-- 事务1: 先锁A后锁B
-- 事务2: 先锁B后锁A

-- ✅ 预防死锁：按ID顺序加锁
DELIMITER $$
CREATE PROCEDURE TransferMoney(
    IN from_id INT,
    IN to_id INT,
    IN amount DECIMAL(10,2)
)
BEGIN
    DECLARE min_id INT;
    DECLARE max_id INT;
    
    -- 确定加锁顺序
    IF from_id < to_id THEN
        SET min_id = from_id;
        SET max_id = to_id;
    ELSE
        SET min_id = to_id;
        SET max_id = from_id;
    END IF;
    
    START TRANSACTION;
    
    -- 按顺序加锁
    SELECT balance FROM accounts WHERE id = min_id FOR UPDATE;
    SELECT balance FROM accounts WHERE id = max_id FOR UPDATE;
    
    -- 执行转账
    UPDATE accounts SET balance = balance - amount WHERE id = from_id;
    UPDATE accounts SET balance = balance + amount WHERE id = to_id;
    
    COMMIT;
END$$
DELIMITER ;

-- 2. 减少锁持有时间
-- 分解复杂事务
-- ✅ 预先查询，减少事务内的查询时间
SELECT id, balance FROM accounts WHERE id IN (1, 2);  -- 事务外查询

START TRANSACTION;
-- 只做必要的更新操作
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;

-- 3. 使用合适的索引减少锁范围
-- 确保WHERE条件使用索引，避免全表扫描加锁
CREATE INDEX idx_account_status ON accounts (status, id);

-- ✅ 使用索引的更新（锁范围小）
UPDATE accounts SET balance = balance * 1.05 
WHERE status = 'active' AND id BETWEEN 1000 AND 2000;

-- 4. 设置合理的锁等待超时
SET SESSION innodb_lock_wait_timeout = 5;  -- 5秒超时

-- 5. 死锁重试机制
DELIMITER $$
CREATE PROCEDURE TransferWithRetry(
    IN from_id INT,
    IN to_id INT,
    IN amount DECIMAL(10,2),
    IN max_retries INT
)
BEGIN
    DECLARE retry_count INT DEFAULT 0;
    DECLARE error_code INT;
    DECLARE CONTINUE HANDLER FOR 1213  -- 死锁错误码
    BEGIN
        SET error_code = 1213;
    END;
    
    retry_loop: LOOP
        SET error_code = 0;
        
        START TRANSACTION;
        
        UPDATE accounts SET balance = balance - amount WHERE id = from_id;
        UPDATE accounts SET balance = balance + amount WHERE id = to_id;
        
        IF error_code = 1213 THEN  -- 死锁发生
            ROLLBACK;
            SET retry_count = retry_count + 1;
            
            IF retry_count >= max_retries THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Max retries exceeded due to deadlocks';
            END IF;
            
            -- 随机等待后重试
            SELECT SLEEP(RAND() * 0.1);
            ITERATE retry_loop;
        END IF;
        
        COMMIT;
        LEAVE retry_loop;
    END LOOP;
END$$
DELIMITER ;
```

## 📈 性能监控

### 事务和锁的监控

```sql title="事务性能监控"
-- 1. 监控长事务
SELECT 
    trx_id,
    trx_state,
    trx_started,
    TIMESTAMPDIFF(SECOND, trx_started, NOW()) as duration_seconds,
    trx_mysql_thread_id,
    LEFT(trx_query, 100) as query_sample,
    trx_rows_locked,
    trx_rows_modified
FROM information_schema.innodb_trx
WHERE TIMESTAMPDIFF(SECOND, trx_started, NOW()) > 30  -- 超过30秒的事务
ORDER BY trx_started;

-- 2. 锁等待统计
SELECT 
    EVENT_NAME,
    COUNT_STAR as total_waits,
    ROUND(SUM_TIMER_WAIT/1000000000000, 3) as total_wait_time_sec,
    ROUND(AVG_TIMER_WAIT/1000000000000, 6) as avg_wait_time_sec,
    ROUND(MAX_TIMER_WAIT/1000000000000, 6) as max_wait_time_sec
FROM performance_schema.events_waits_summary_global_by_event_name
WHERE EVENT_NAME LIKE '%lock%'
  AND COUNT_STAR > 0
ORDER BY SUM_TIMER_WAIT DESC;

-- 3. 死锁监控
SELECT 
    VARIABLE_NAME,
    VARIABLE_VALUE
FROM performance_schema.global_status 
WHERE VARIABLE_NAME IN (
    'Innodb_deadlocks',
    'Innodb_row_lock_waits',
    'Innodb_row_lock_time',
    'Innodb_row_lock_time_avg',
    'Innodb_row_lock_time_max'
);

-- 4. 事务日志监控
SHOW ENGINE INNODB STATUS\G

-- 从状态信息中提取关键指标：
-- Log sequence number: 日志序列号
-- Log flushed up to: 已刷新到磁盘的日志
-- Pages flushed up to: 已刷新的页面
-- Last checkpoint at: 最后检查点
```

> [!tip] 💡 事务设计最佳实践
> 
> **设计原则**
> - 保持事务简短：减少锁持有时间
> - 避免用户交互：不在事务中等待用户输入
> - 合理选择隔离级别：根据业务需求选择最低级别
> - 统一锁顺序：避免死锁
> 
> **性能优化**
> - 使用索引：减少锁范围
> - 批量处理：避免长事务
> - 乐观锁：减少锁争用
> - 读写分离：分散锁压力

> [!warning] ⚠️ 常见陷阱
> - 忘记提交事务导致长时间锁定
> - 在事务中执行耗时操作
> - 不当的异常处理导致事务泄露
> - 隔离级别设置过高导致性能问题

## 🔗 下一步学习

掌握事务和锁机制后，建议学习：

- MySQL - 主从复制原理与配置
- MySQL - 数据安全保障策略  
- MySQL - 集群架构设计
- SQL - 查询层面优化

---

*最后更新：2024-06-29* 