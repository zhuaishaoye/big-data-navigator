---
title: PostgreSQL事务与并发控制
tags:
  - PostgreSQL
  - 事务
  - ACID
  - MVCC
  - 锁
  - 并发控制
  - 隔离级别
difficulty: 中级
duration: 35分钟
description: 深入理解PostgreSQL的事务机制、MVCC并发控制、锁机制和隔离级别，掌握并发环境下的数据一致性保证。
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据科学家
stability: slow-changing
status: active
access_tier: free
updated: 2026-10-10
---


# 🔒 PostgreSQL事务与并发控制

## 📚 学习目标

通过本章节的学习，你将能够：
- **理解ACID事务特性**和PostgreSQL的实现机制
- **掌握MVCC并发控制**原理和优势
- **了解各种锁机制**和死锁处理
- **理解不同隔离级别**的特点和应用场景
- **掌握事务管理**的最佳实践

> [!tip] 💡 学习建议
> 事务和并发控制是数据库的核心概念，**理解比记忆更重要**。就像理解交通规则一样，不仅要知道规则是什么，更要理解为什么需要这些规则。**通过实际例子来体验不同的并发场景**，这样能更好地理解这些抽象概念。

## 🎯 ACID事务特性

### 1. 原子性（Atomicity）

原子性确保事务中的所有操作要么全部成功，要么全部失败。

```sql
-- 创建测试表
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    account_number VARCHAR(20) UNIQUE NOT NULL,
    balance DECIMAL(10,2) NOT NULL CHECK (balance >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入测试数据
INSERT INTO accounts (account_number, balance) VALUES
('ACC001', 1000.00),
('ACC002', 500.00),
('ACC003', 750.00);

-- 原子性示例：银行转账
BEGIN;
    -- 从账户ACC001转出100元
    UPDATE accounts 
    SET balance = balance - 100 
    WHERE account_number = 'ACC001';
    
    -- 向账户ACC002转入100元
    UPDATE accounts 
    SET balance = balance + 100 
    WHERE account_number = 'ACC002';
    
    -- 检查余额是否足够
    SELECT balance FROM accounts WHERE account_number = 'ACC001';
COMMIT;

-- 演示回滚：转账失败的情况
BEGIN;
    UPDATE accounts 
    SET balance = balance - 2000  -- 超出余额
    WHERE account_number = 'ACC001';
    
    UPDATE accounts 
    SET balance = balance + 2000 
    WHERE account_number = 'ACC002';
    
    -- 检查约束违反，触发回滚
ROLLBACK;

-- 查看账户余额（应该没有变化）
SELECT * FROM accounts;

-- 使用SAVEPOINT实现部分回滚
BEGIN;
    UPDATE accounts SET balance = balance - 50 WHERE account_number = 'ACC001';
    
    SAVEPOINT sp1;  -- 创建保存点
    
    UPDATE accounts SET balance = balance + 50 WHERE account_number = 'ACC002';
    UPDATE accounts SET balance = balance - 1000 WHERE account_number = 'ACC003';  -- 这会失败
    
    ROLLBACK TO sp1;  -- 回滚到保存点
    
    -- 这个操作会成功
    UPDATE accounts SET balance = balance + 50 WHERE account_number = 'ACC003';
COMMIT;

SELECT * FROM accounts;
```

### 2. 一致性（Consistency）

一致性确保数据库始终处于有效状态，满足所有约束条件。

```sql
-- 创建带约束的表
CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    warehouse_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    reserved_quantity INTEGER DEFAULT 0 CHECK (reserved_quantity >= 0),
    
    -- 确保预留数量不超过总数量
    CHECK (reserved_quantity <= quantity),
    
    UNIQUE(product_id, warehouse_id)
);

INSERT INTO inventory (product_id, warehouse_id, quantity) VALUES
(1, 1, 100),
(1, 2, 50),
(2, 1, 75);

-- 一致性示例：库存预留
CREATE OR REPLACE FUNCTION reserve_inventory(
    p_product_id INTEGER,
    p_warehouse_id INTEGER,
    p_reserve_qty INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    current_available INTEGER;
BEGIN
    -- 获取当前可用库存
    SELECT (quantity - reserved_quantity) INTO current_available
    FROM inventory
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id
    FOR UPDATE;  -- 锁定行
    
    -- 检查库存是否足够
    IF current_available IS NULL THEN
        RAISE EXCEPTION 'Product not found in warehouse';
    END IF;
    
    IF current_available < p_reserve_qty THEN
        RAISE EXCEPTION 'Insufficient inventory. Available: %, Requested: %', 
                       current_available, p_reserve_qty;
    END IF;
    
    -- 更新预留数量
    UPDATE inventory 
    SET reserved_quantity = reserved_quantity + p_reserve_qty
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 测试一致性
BEGIN;
    SELECT reserve_inventory(1, 1, 30);  -- 成功
    SELECT reserve_inventory(1, 1, 80);  -- 失败：库存不足
ROLLBACK;

-- 查看库存状态
SELECT *, (quantity - reserved_quantity) as available 
FROM inventory;
```

### 3. 隔离性（Isolation）

隔离性确保并发事务之间不会相互干扰。

```sql
-- 创建测试表
CREATE TABLE counters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE,
    value INTEGER DEFAULT 0
);

INSERT INTO counters (name, value) VALUES ('page_views', 0);

-- 在两个会话中模拟并发更新
-- 会话1：
BEGIN;
SELECT value FROM counters WHERE name = 'page_views';  -- 假设返回0
-- ... 处理时间 ...
UPDATE counters SET value = value + 1 WHERE name = 'page_views';
COMMIT;

-- 会话2（同时进行）：
BEGIN;
SELECT value FROM counters WHERE name = 'page_views';  -- 也返回0
-- ... 处理时间 ...
UPDATE counters SET value = value + 1 WHERE name = 'page_views';
COMMIT;

-- 在默认READ COMMITTED下，两次UPDATE均成功提交且没有其他写入时，最终值为2；
-- 关键是SET value = value + 1在数据库中执行增量更新，不能据此认为所有先读后写流程都不会丢失更新
```

### 4. 持久性（Durability）

持久性确保已提交的事务更改永久保存。

```sql
-- 持久性通过WAL（写前日志）实现
-- 查看WAL配置
SHOW wal_level;
SHOW fsync;
SHOW synchronous_commit;
SHOW wal_sync_method;

-- 创建测试表
CREATE TABLE important_data (
    id SERIAL PRIMARY KEY,
    data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入重要数据
BEGIN;
    INSERT INTO important_data (data) VALUES ('Critical business data');
    -- 在fsync开启且synchronous_commit不为off等相应持久性配置下，提交确认前会完成要求的WAL持久化；并不要求此时数据页本身已写入磁盘
COMMIT;

-- 即使数据库重启，数据也会保留
SELECT * FROM important_data;
```

## 🔄 MVCC多版本并发控制

PostgreSQL使用MVCC来实现高并发性能，允许读操作不被写操作阻塞。

### 1. MVCC基本原理

```sql
-- 创建测试表
CREATE TABLE mvcc_demo (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50),
    value INTEGER,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO mvcc_demo (name, value) VALUES ('test', 100);

-- 查看当前事务ID
SELECT txid_current();

-- 查看表的系统列（通常不显示）
SELECT 
    ctid,           -- 行标识符
    xmin,           -- 创建该行版本的事务ID
    xmax,           -- 删除该行版本的事务ID（0表示未删除）
    name,
    value
FROM mvcc_demo;

-- 模拟MVCC行为
-- 会话1：使用可重复读观察事务级快照
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
    SELECT 
        txid_current() as current_txid,
        name, 
        value,
        xmin,
        xmax
    FROM mvcc_demo WHERE id = 1;
    
    -- 不要提交，保持事务打开
    -- COMMIT;

-- 会话2：更新数据
BEGIN;
    UPDATE mvcc_demo 
    SET value = 200, updated_at = CURRENT_TIMESTAMP 
    WHERE id = 1;
COMMIT;

-- 再次查看系统列
SELECT 
    ctid,
    xmin,
    xmax,
    name,
    value,
    updated_at
FROM mvcc_demo;

-- 会话1仍然能看到旧版本的数据（快照隔离）
-- 会话2能看到新版本的数据
```

### 2. 事务快照

```sql
-- 查看当前事务快照信息
SELECT 
    txid_current() as current_txid,
    txid_current_snapshot() as snapshot;

-- 创建并发测试场景
CREATE TABLE snapshot_test (
    id SERIAL PRIMARY KEY,
    data TEXT,
    modified_by INTEGER,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO snapshot_test (data, modified_by) VALUES 
('Initial data', txid_current());

-- 开始事务A：使用可重复读保持事务级快照
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
    SELECT txid_current() as txid_a;
    SELECT * FROM snapshot_test;  -- 记录快照
    
    -- 在另一个会话中修改数据
    -- 这个事务看不到其他事务的修改
    
-- 在另一个会话中：
-- BEGIN;
--     UPDATE snapshot_test SET data = 'Modified data', modified_by = txid_current();
-- COMMIT;

    -- 事务A仍然看到原始数据
    SELECT * FROM snapshot_test;
COMMIT;

-- 现在能看到修改后的数据
SELECT * FROM snapshot_test;
```

### 3. 死元组和VACUUM

```sql
-- 查看表的统计信息
SELECT 
    schemaname,
    tablename,
    n_live_tup,     -- 活跃元组数
    n_dead_tup,     -- 死亡元组数
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables 
WHERE tablename = 'mvcc_demo';

-- 执行多次更新产生死元组
UPDATE mvcc_demo SET value = value + 1;
UPDATE mvcc_demo SET value = value + 1;
UPDATE mvcc_demo SET value = value + 1;

-- 再次查看统计信息
SELECT 
    schemaname,
    tablename,
    n_live_tup,
    n_dead_tup,
    n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0) as dead_ratio
FROM pg_stat_user_tables 
WHERE tablename = 'mvcc_demo';

-- 手动执行VACUUM清理死元组
VACUUM mvcc_demo;

-- 查看清理后的统计信息
SELECT 
    schemaname,
    tablename,
    n_live_tup,
    n_dead_tup
FROM pg_stat_user_tables 
WHERE tablename = 'mvcc_demo';
```

## 🔐 锁机制

PostgreSQL使用多种锁机制来控制并发访问。

### 1. 表级锁

```sql
-- 查看当前的锁信息
SELECT 
    l.locktype,
    l.database,
    l.relation::regclass,
    l.mode,
    l.granted,
    a.query
FROM pg_locks l
LEFT JOIN pg_stat_activity a ON l.pid = a.pid
WHERE l.relation IS NOT NULL;

-- 显式表级锁
BEGIN;
    LOCK TABLE accounts IN ACCESS EXCLUSIVE MODE;
    -- 这会阻止其他事务对表的任何访问
    SELECT * FROM accounts;
COMMIT;

-- 不同的锁模式
BEGIN;
    LOCK TABLE accounts IN SHARE MODE;  -- 允许读，阻止写
    SELECT * FROM accounts;
    -- 其他会话可以读取，但不能修改
COMMIT;

-- 查看锁的兼容性
CREATE TABLE lock_demo (id INTEGER, data TEXT);

-- 会话1：
BEGIN;
    LOCK TABLE lock_demo IN SHARE MODE;
    SELECT pg_sleep(30);  -- 保持锁30秒
COMMIT;

-- 会话2（同时运行）：
BEGIN;
    LOCK TABLE lock_demo IN SHARE MODE;        -- 成功（兼容）
    -- LOCK TABLE lock_demo IN EXCLUSIVE MODE; -- 不兼容，等待会话1释放锁；使用NOWAIT才会立即报错
COMMIT;
```

### 2. 行级锁

```sql
-- 行级锁示例
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER,
    product_id INTEGER,
    quantity INTEGER,
    price DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'pending'
);

INSERT INTO order_items (order_id, product_id, quantity, price) VALUES
(1, 101, 2, 25.50),
(1, 102, 1, 45.00),
(2, 101, 3, 25.50);

-- FOR UPDATE：排他行锁
BEGIN;
    SELECT * FROM order_items 
    WHERE order_id = 1 
    FOR UPDATE;  -- 锁定选中的行
    
    -- 其他事务无法修改这些行
    UPDATE order_items 
    SET status = 'processing' 
    WHERE order_id = 1;
COMMIT;

-- FOR SHARE：共享行锁
BEGIN;
    SELECT * FROM order_items 
    WHERE order_id = 1 
    FOR SHARE;  -- 共享锁，允许其他读取，阻止修改
    
    -- 其他事务可以读取，但不能修改
COMMIT;

-- FOR UPDATE SKIP LOCKED：跳过已锁定的行
BEGIN;
    -- 仅更新本次实际选中并锁定的订单项
    WITH selected_item AS (
        SELECT id FROM order_items
        WHERE status = 'pending'
        ORDER BY id
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    UPDATE order_items AS oi
    SET status = 'processing'
    FROM selected_item AS selected
    WHERE oi.id = selected.id
    RETURNING oi.*;
COMMIT;

-- FOR UPDATE NOWAIT：立即返回而不等待
BEGIN;
    SELECT * FROM order_items 
    WHERE order_id = 1 
    FOR UPDATE NOWAIT;  -- 如果有锁冲突，立即失败
COMMIT;
```

### 3. 死锁检测和处理

```sql
-- 创建可能导致死锁的场景
CREATE TABLE resource_a (id INTEGER PRIMARY KEY, data TEXT);
CREATE TABLE resource_b (id INTEGER PRIMARY KEY, data TEXT);

INSERT INTO resource_a VALUES (1, 'Data A');
INSERT INTO resource_b VALUES (1, 'Data B');

-- 模拟死锁场景
-- 会话1：
BEGIN;
    UPDATE resource_a SET data = 'Modified by Session 1' WHERE id = 1;
    -- 等待一下，然后执行下一条语句
    SELECT pg_sleep(5);
    UPDATE resource_b SET data = 'Modified by Session 1' WHERE id = 1;
COMMIT;

-- 会话2（同时进行）：
BEGIN;
    UPDATE resource_b SET data = 'Modified by Session 2' WHERE id = 1;
    -- 等待一下，然后执行下一条语句
    SELECT pg_sleep(5);
    UPDATE resource_a SET data = 'Modified by Session 2' WHERE id = 1;  -- 死锁！
COMMIT;

-- PostgreSQL会自动检测死锁并回滚其中一个事务

-- 查看死锁检测配置
SHOW deadlock_timeout;  -- 死锁检测超时时间

-- 监控死锁
SELECT 
    application_name,
    state,
    query,
    wait_event_type,
    wait_event,
    query_start,
    state_change
FROM pg_stat_activity 
WHERE state != 'idle';
```

## 📊 事务隔离级别

PostgreSQL支持四种标准的事务隔离级别。

### 1. READ UNCOMMITTED

```sql
-- 读未提交（实际上PostgreSQL将其实现为READ COMMITTED）
-- 创建测试表
CREATE TABLE isolation_test (
    id INTEGER PRIMARY KEY,
    value INTEGER,
    description TEXT
);

INSERT INTO isolation_test VALUES (1, 100, 'Initial value');

-- 会话1：READ UNCOMMITTED
BEGIN TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
    SELECT * FROM isolation_test WHERE id = 1;
    -- 在会话2中修改数据（但不提交）
    SELECT pg_sleep(10);
    SELECT * FROM isolation_test WHERE id = 1;  -- 不会看到未提交的更改
COMMIT;
```

### 2. READ COMMITTED（默认级别）

```sql
-- 读已提交
BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;
    SELECT value FROM isolation_test WHERE id = 1;  -- 第一次读取
    
    -- 在另一个会话中修改并提交数据
    SELECT pg_sleep(10);
    
    SELECT value FROM isolation_test WHERE id = 1;  -- 第二次读取（不可重复读）
COMMIT;

-- 演示幻读现象
BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;
    SELECT COUNT(*) FROM isolation_test WHERE value > 50;  -- 第一次计数
    
    -- 在另一个会话中插入新记录
    SELECT pg_sleep(10);
    
    SELECT COUNT(*) FROM isolation_test WHERE value > 50;  -- 第二次计数（幻读）
COMMIT;
```

### 3. REPEATABLE READ

```sql
-- 可重复读
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
    SELECT value FROM isolation_test WHERE id = 1;  -- 第一次读取
    
    -- 在另一个会话中修改并提交数据
    SELECT pg_sleep(10);
    
    SELECT value FROM isolation_test WHERE id = 1;  -- 第二次读取（相同结果）
    
    -- 尝试修改可能导致序列化失败
    UPDATE isolation_test SET value = 200 WHERE id = 1;
COMMIT;

-- 演示序列化失败
-- 会话1：
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
    SELECT value FROM isolation_test WHERE id = 1;
    -- 基于读取的值进行计算
    UPDATE isolation_test SET value = value + 50 WHERE id = 1;
COMMIT;

-- 会话2（同时进行）：
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
    SELECT value FROM isolation_test WHERE id = 1;
    -- 基于相同的值进行计算
    UPDATE isolation_test SET value = value + 30 WHERE id = 1;  -- 可能失败
COMMIT;
```

### 4. SERIALIZABLE

```sql
-- 可序列化
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
    SELECT SUM(value) FROM isolation_test;
    
    -- 基于汇总结果进行操作
    INSERT INTO isolation_test VALUES (2, 150, 'Calculated value');
COMMIT;

-- 并发SERIALIZABLE事务发生不可序列化的读写依赖时，可能出现序列化失败；
-- 修改相同数据并不必然触发该错误，修改不同数据也可能触发；调用方应重试整个事务
```

### 5. 隔离级别对比

```sql
-- 创建隔离级别比较函数
CREATE OR REPLACE FUNCTION test_isolation_level(isolation_level TEXT)
RETURNS TABLE(
    read_count INTEGER,
    phantom_possible BOOLEAN,
    dirty_read_possible BOOLEAN
) AS $$
BEGIN
    -- 此函数仅返回隔离级别特性标记，不改变调用事务的隔离级别。
    -- 实际并发实验应在独立会话中使用BEGIN TRANSACTION ISOLATION LEVEL。
    isolation_level := upper(trim(isolation_level));
    IF isolation_level IS NULL OR isolation_level NOT IN
        ('READ UNCOMMITTED', 'READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE') THEN
        RAISE EXCEPTION 'Unsupported isolation level: %', isolation_level;
    END IF;
    
    -- 执行测试查询
    SELECT COUNT(*) INTO read_count FROM isolation_test;
    
    -- 根据隔离级别设置可能性
    CASE isolation_level
        WHEN 'READ UNCOMMITTED' THEN
            phantom_possible := TRUE;
            dirty_read_possible := FALSE;  -- PostgreSQL按READ COMMITTED实现
        WHEN 'READ COMMITTED' THEN
            phantom_possible := TRUE;
            dirty_read_possible := FALSE;
        WHEN 'REPEATABLE READ' THEN
            phantom_possible := FALSE;
            dirty_read_possible := FALSE;
        WHEN 'SERIALIZABLE' THEN
            phantom_possible := FALSE;
            dirty_read_possible := FALSE;
    END CASE;
    
    -- 函数内不提交事务；事务边界由调用方控制。
    RETURN QUERY SELECT read_count, phantom_possible, dirty_read_possible;
END;
$$ LANGUAGE plpgsql;

-- 测试不同隔离级别
SELECT 'READ COMMITTED' as level, * FROM test_isolation_level('READ committed');
SELECT 'REPEATABLE READ' as level, * FROM test_isolation_level('repeatable read');
SELECT 'SERIALIZABLE' as level, * FROM test_isolation_level('serializable');
```

## 🎯 事务管理最佳实践

### 1. 事务设计原则

```sql
-- 1. 保持事务简短
-- 不好的做法：长事务
-- BEGIN;
--     SELECT pg_sleep(300);  -- 长时间操作
--     UPDATE accounts SET balance = balance + 1;
-- COMMIT;

-- 好的做法：将长操作移到事务外
SELECT pg_sleep(1);  -- 准备工作在事务外完成
BEGIN;
    UPDATE accounts SET balance = balance + 1;  -- 快速事务
COMMIT;

-- 2. 避免在事务中进行用户交互
-- 不好的做法：
-- BEGIN;
--     UPDATE accounts SET balance = balance - 100 WHERE id = 1;
--     -- 等待用户确认...
--     UPDATE accounts SET balance = balance + 100 WHERE id = 2;
-- COMMIT;

-- 好的做法：先验证，再执行
DO $$
DECLARE
    source_balance DECIMAL(10,2);
BEGIN
    -- 预检查
    SELECT balance INTO source_balance FROM accounts WHERE id = 1;
    IF source_balance < 100 THEN
        RAISE EXCEPTION 'Insufficient funds';
    END IF;
    
    -- 快速事务
    BEGIN
        UPDATE accounts SET balance = balance - 100 WHERE id = 1;
        UPDATE accounts SET balance = balance + 100 WHERE id = 2;
    EXCEPTION WHEN OTHERS THEN
        RAISE;
    END;
END;
$$;
```

### 2. 错误处理

```sql
-- 事务中的错误处理
CREATE OR REPLACE FUNCTION safe_transfer(
    from_account TEXT,
    to_account TEXT,
    amount DECIMAL(10,2)
) RETURNS BOOLEAN AS $$
DECLARE
    from_balance DECIMAL(10,2);
BEGIN
    -- 开始事务
    BEGIN
        -- 检查源账户余额
        SELECT balance INTO from_balance 
        FROM accounts 
        WHERE account_number = from_account
        FOR UPDATE;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Source account not found: %', from_account;
        END IF;
        
        IF from_balance < amount THEN
            RAISE EXCEPTION 'Insufficient funds. Available: %, Requested: %', 
                           from_balance, amount;
        END IF;
        
        -- 执行转账
        UPDATE accounts 
        SET balance = balance - amount 
        WHERE account_number = from_account;
        
        UPDATE accounts 
        SET balance = balance + amount 
        WHERE account_number = to_account;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Target account not found: %', to_account;
        END IF;
        
        RETURN TRUE;
        
    EXCEPTION 
        WHEN OTHERS THEN
            -- 记录错误日志
            RAISE NOTICE 'Transfer failed: %', SQLERRM;
            RAISE;
    END;
END;
$$ LANGUAGE plpgsql;

-- 测试错误处理
SELECT safe_transfer('ACC001', 'ACC002', 50.00);   -- 成功
SELECT safe_transfer('ACC001', 'INVALID', 50.00);  -- 失败：账户不存在
SELECT safe_transfer('ACC001', 'ACC002', 5000.00); -- 失败：余额不足
```

### 3. 并发控制策略

```sql
-- 创建库存管理示例
CREATE TABLE product_inventory (
    product_id INTEGER PRIMARY KEY,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    reserved INTEGER DEFAULT 0 CHECK (reserved >= 0),
    version INTEGER DEFAULT 1,
    
    CHECK (reserved <= quantity)
);

INSERT INTO product_inventory (product_id, quantity) VALUES 
(1, 100), (2, 50), (3, 75);

-- 乐观锁策略
CREATE OR REPLACE FUNCTION reserve_product_optimistic(
    p_product_id INTEGER,
    p_quantity INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    current_version INTEGER;
    available_qty INTEGER;
BEGIN
    -- 读取当前版本和可用数量
    SELECT version, (quantity - reserved) 
    INTO current_version, available_qty
    FROM product_inventory 
    WHERE product_id = p_product_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found: %', p_product_id;
    END IF;
    
    IF available_qty < p_quantity THEN
        RAISE EXCEPTION 'Insufficient inventory';
    END IF;
    
    -- 尝试更新（检查版本）
    UPDATE product_inventory 
    SET 
        reserved = reserved + p_quantity,
        version = version + 1
    WHERE product_id = p_product_id 
      AND version = current_version;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Concurrent modification detected';
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 悲观锁策略
CREATE OR REPLACE FUNCTION reserve_product_pessimistic(
    p_product_id INTEGER,
    p_quantity INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    available_qty INTEGER;
BEGIN
    -- 立即锁定行
    SELECT (quantity - reserved) INTO available_qty
    FROM product_inventory 
    WHERE product_id = p_product_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found: %', p_product_id;
    END IF;
    
    IF available_qty < p_quantity THEN
        RAISE EXCEPTION 'Insufficient inventory';
    END IF;
    
    -- 更新库存
    UPDATE product_inventory 
    SET reserved = reserved + p_quantity
    WHERE product_id = p_product_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 测试并发控制
BEGIN;
    SELECT reserve_product_pessimistic(1, 10);
COMMIT;

SELECT * FROM product_inventory;
```

### 4. 事务监控

```sql
-- 创建事务监控视图
CREATE VIEW v_transaction_monitor AS
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    state,
    query_start,
    state_change,
    EXTRACT(EPOCH FROM (NOW() - query_start)) as duration_seconds,
    EXTRACT(EPOCH FROM (NOW() - xact_start)) as transaction_duration,
    wait_event_type,
    wait_event,
    query
FROM pg_stat_activity 
WHERE state != 'idle' 
  AND pid != pg_backend_pid();

-- 查看长时间运行的事务
SELECT * FROM v_transaction_monitor 
WHERE transaction_duration > 10 
ORDER BY transaction_duration DESC;

-- 查看阻塞信息
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity 
    ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity 
    ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.GRANTED;
```

## 🎯 小结

通过本章节的学习，我们掌握了：

1. **ACID特性**：原子性、一致性、隔离性、持久性的概念和实现
2. **MVCC机制**：多版本并发控制的工作原理和优势
3. **锁机制**：表级锁、行级锁、死锁检测和处理
4. **隔离级别**：四种标准隔离级别的特点和应用
5. **最佳实践**：事务设计、错误处理、并发控制、监控

> [!abstract] 📚 下一步学习
> 现在你已经理解了PostgreSQL的事务和并发控制机制，接下来我们将学习08-PostgreSQL备份与恢复|PostgreSQL备份与恢复，了解如何保护你的数据安全。

## 🔗 相关资源

- [[【技术与工具】/PostgreSQL/06-PostgreSQL索引与性能优化|PostgreSQL索引与性能优化]]
- [[【技术与工具】/PostgreSQL/00-PostgreSQL学习路线图|PostgreSQL]]
- SQL - 通用事务概念

---

> 💡 **记住**：理解事务和并发控制是**数据库编程的核心技能**。在设计应用时，**始终考虑并发场景**，选择合适的隔离级别和锁策略。**保持事务简短**，避免长时间持有锁。当遇到并发问题时，**先理解问题的本质**，再选择合适的解决方案。实践是掌握这些概念的最好方法！