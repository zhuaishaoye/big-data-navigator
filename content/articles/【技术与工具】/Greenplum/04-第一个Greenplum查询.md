---
title: 第一个Greenplum查询 - MPP分布式查询入门
tags:
  - Greenplum
  - SQL
  - MPP
  - 入门实践
  - psql
difficulty: 中级
duration: 30分钟
knowledge_type: technical-practice
target_audience:
  - 数据分析师
  - 数据开发工程师
  - 数据架构师
  - BI分析师
  - 数据科学家
stability: slow-changing
status: maintenance
access_tier: free
updated: 2026-10-10
---


> [!warning] 关联材料边界
> 以下原引用目标缺失或无法唯一确认，已取消跳转并保留提及：02-Greenplum架构与核心概念。相关素材/延伸说明暂不可用，不能据此声称已经提供配套材料。

# 第一个Greenplum查询 - MPP分布式查询入门

> [!info] 前置知识
> - [[【技术与工具】/Greenplum/03-Greenplum环境搭建|Greenplum环境搭建]] — 确保集群已正常启动
> - Greenplum架构（原引用“02-Greenplum架构与核心概念”未能确定有效目标，暂不可跳转） — 了解 Master/Segment 架构
> - SQL 基础（SELECT、GROUP BY、JOIN）

## 🎯 查询前的准备工作

### 🔧 环境检查

#### 📋 连接准备清单

```bash
#!/bin/bash
# Greenplum连接准备检查脚本

echo "🔍 开始Greenplum环境检查..."

# 1. 检查服务状态
check_service_status() {
    echo "📊 检查Greenplum服务状态..."
    
    su - gpadmin -c "
        source /opt/greenplum-db/greenplum_path.sh
        gpstate -s
    "
    
    if [ $? -eq 0 ]; then
        echo "✅ Greenplum服务正常运行"
    else
        echo "❌ Greenplum服务异常，请检查"
        exit 1
    fi
}

# 2. 检查网络连接
check_network() {
    echo "🌐 检查网络连接..."
    
 # 检查端口是否开放
    netstat -ln | grep :5432
    
    if [ $? -eq 0 ]; then
        echo "✅ 数据库端口5432正常监听"
    else
        echo "❌ 端口5432未开放"
    fi
}

# 3. 检查用户权限
check_permissions() {
    echo "👤 检查用户权限..."
    
    su - gpadmin -c "
        source /opt/greenplum-db/greenplum_path.sh
        psql -c 'SELECT version();' -q
    "
    
    if [ $? -eq 0 ]; then
        echo "✅ 用户权限正常"
    else
        echo "❌ 用户权限异常"
    fi
}

# 执行检查
check_service_status
check_network
check_permissions

echo "🔍 检查流程结束；请确认上述各项均通过，并成功连接目标数据库后再开始查询。"
```

**方式2：使用 psql 连接字符串**

```bash
# URI 格式连接字符串（适合在脚本中使用）
psql "postgresql://gpadmin@localhost:5432/postgres"

# 带密码的 URI 连接（不推荐在命令行明文写密码，建议用 .pgpass 文件）
psql "postgresql://gpadmin:your_password@localhost:5432/postgres"

# 通过环境变量传递密码（避免出现在命令行参数中，但仍可能被有权限的进程读取；优先使用权限受限的 .pgpass）
export PGPASSWORD='your_password'
psql -h localhost -p 5432 -U gpadmin -d postgres
unset PGPASSWORD  # 用完后清除
```

> [!note] 分布键选择原则
> Greenplum 最关键的建表决策是选择 `DISTRIBUTED BY` 的分布键，它决定数据如何分散到各个 Segment。
>
> 好的分布键应满足：
> - **高基数**：字段值尽量多，如 user_id、order_id，避免 gender（只有两个值，会导致数据严重倾斜）
> - **均匀分布**：各值出现频率相近，避免某一个值占据 90% 的数据
> - **常用于 JOIN**：如果两张大表经常做等值 JOIN，可考虑将连接字段作为分布键；当完整分布键、数据类型和分布策略兼容且连接条件覆盖分布键时，有机会避免重分布，实际效果应以执行计划和测试结果为准
>
> 不确定如何选择时，可以考虑 `DISTRIBUTED RANDOMLY`（随机分布），但它不保证数据完全均匀，且可能增加 JOIN 的数据移动成本；应结合数据分布和查询负载验证。

**方式3：图形化客户端连接**

| 工具名称 | 连接配置 | 推荐程度 |
|---|---|---|
| **DBeaver** | Host: localhost<br/>Port: 5432<br/>Database: postgres<br/>User: gpadmin | ⭐⭐⭐⭐⭐ |
| **pgAdmin** | 同上配置 | ⭐⭐⭐⭐ |
| **DataGrip** | 同上配置 | ⭐⭐⭐⭐ |
| **Navicat** | 同上配置 | ⭐⭐⭐ |

### 📊 初始数据准备

#### 🏗️ 创建示例数据

```sql
-- 连接数据库后执行
-- 1. 创建示例数据库
CREATE DATABASE sales_demo;

-- 2. 切换到示例数据库
\c sales_demo

-- 3. 创建销售数据表
CREATE TABLE sales_data (
    sale_id SERIAL PRIMARY KEY,
    product_name VARCHAR(100),
    category VARCHAR(50),
    sale_date DATE,
    quantity INTEGER,
    unit_price DECIMAL(10,2),
    total_amount DECIMAL(12,2),
    customer_region VARCHAR(50),
    salesperson VARCHAR(50)
) DISTRIBUTED BY (sale_id);

-- 4. 插入示例数据
INSERT INTO sales_data (product_name, category, sale_date, quantity, unit_price, total_amount, customer_region, salesperson) VALUES
('iPhone 14', '手机', '2023-01-15', 2, 6999.00, 13998.00, '北京', '张三'),
('MacBook Pro', '电脑', '2023-01-16', 1, 12999.00, 12999.00, '上海', '李四'),
('iPad Air', '平板', '2023-01-17', 3, 4599.00, 13797.00, '深圳', '王五'),
('Apple Watch', '手表', '2023-01-18', 1, 2999.00, 2999.00, '广州', '赵六'),
('AirPods Pro', '耳机', '2023-01-19', 5, 1999.00, 9995.00, '杭州', '钱七'),
('iPhone 13', '手机', '2023-01-20', 3, 5999.00, 17997.00, '南京', '孙八'),
('MacBook Air', '电脑', '2023-01-21', 2, 8999.00, 17998.00, '武汉', '周九'),
('iPad Pro', '平板', '2023-01-22', 1, 8599.00, 8599.00, '成都', '吴十'),
('Apple TV', '娱乐', '2023-01-23', 2, 1499.00, 2998.00, '西安', '郑一'),
('HomePod', '音响', '2023-01-24', 1, 2299.00, 2299.00, '青岛', '王二');

-- 5. 创建客户信息表
CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    customer_name VARCHAR(100),
    region VARCHAR(50),
    registration_date DATE,
    customer_type VARCHAR(20)
) DISTRIBUTED BY (customer_id);

INSERT INTO customers (customer_name, region, registration_date, customer_type) VALUES
('科技公司A', '北京', '2022-01-01', '企业客户'),
('个人用户B', '上海', '2022-02-01', '个人客户'),
('教育机构C', '深圳', '2022-03-01', '教育客户'),
('医疗机构D', '广州', '2022-04-01', '企业客户'),
('个人用户E', '杭州', '2022-05-01', '个人客户');

-- 6. 创建大数据量测试表
CREATE TABLE large_sales (
    id SERIAL,
    product_id INTEGER,
    customer_id INTEGER,
    sale_date DATE,
    amount DECIMAL(10,2)
) DISTRIBUTED BY (id);

-- 插入大量测试数据
INSERT INTO large_sales (product_id, customer_id, sale_date, amount)
SELECT 
    (random() * 1000)::INTEGER + 1 as product_id,
    (random() * 1000)::INTEGER + 1 as customer_id,
    '2023-01-01'::DATE + (random() * 365)::INTEGER as sale_date,
    (random() * 10000)::DECIMAL(10,2) as amount
FROM generate_series(1, 100000);

\echo '✅ 示例数据创建完成！'
```

## 🎯 第一个基础查询

### 📊 简单查询体验

#### 🔍 数据探索查询

```sql
-- 🎉 你的第一个Greenplum查询！
-- 查看销售数据概览
SELECT '🎊 欢迎来到Greenplum世界！' as welcome_message;

-- 查看数据库版本信息
SELECT version();

-- 查看当前连接信息
SELECT 
    current_database() as 数据库名称,
    current_user as 当前用户,
    current_timestamp as 当前时间;

-- 查看表结构
\d sales_data

-- 基础数据查询
SELECT * FROM sales_data LIMIT 5;

-- 统计数据总览
SELECT 
    COUNT(*) as 总记录数,
    COUNT(DISTINCT product_name) as 产品种类,
    COUNT(DISTINCT customer_region) as 销售区域,
    SUM(total_amount) as 总销售额,
    AVG(total_amount) as 平均订单金额,
    MAX(total_amount) as 最大订单金额,
    MIN(total_amount) as 最小订单金额
FROM sales_data;
```

**预期输出：**
```text
 总记录数 | 产品种类 | 销售区域 |  总销售额   | 平均订单金额 | 最大订单金额 | 最小订单金额
----------+----------+----------+-------------+--------------+--------------+--------------
       10 |       10 |       10 | 103679.00   |   10367.90   |     17998.00 |      2299.00
```

### 📈 分组聚合查询

#### 📊 销售分析查询

```sql
-- 🏆 体验Greenplum的分析威力

-- 1. 按产品类别统计销售情况
SELECT 
    category as 产品类别,
    COUNT(*) as 销售次数,
    SUM(quantity) as 总销量,
    SUM(total_amount) as 总销售额,
    AVG(unit_price) as 平均单价,
    ROUND(AVG(total_amount), 2) as 平均订单金额
FROM sales_data
GROUP BY category
ORDER BY 总销售额 DESC;

-- 2. 按地区统计销售情况
SELECT 
    customer_region as 销售区域,
    COUNT(*) as 订单数量,
    SUM(total_amount) as 区域销售额,
    ROUND(
        SUM(total_amount) * 100.0 / (SELECT SUM(total_amount) FROM sales_data), 
        2
    ) as 销售占比
FROM sales_data
GROUP BY customer_region
ORDER BY 区域销售额 DESC;

-- 3. 按销售人员统计业绩
SELECT 
    salesperson as 销售人员,
    COUNT(*) as 订单数量,
    SUM(total_amount) as 个人业绩,
    AVG(total_amount) as 平均订单金额,
    MAX(total_amount) as 最大订单,
    RANK() OVER (ORDER BY SUM(total_amount) DESC) as 业绩排名
FROM sales_data
GROUP BY salesperson
ORDER BY 个人业绩 DESC;

-- 4. 按时间统计销售趋势
SELECT 
    DATE_TRUNC('month', sale_date) as 销售月份,
    COUNT(*) as 月度订单数,
    SUM(total_amount) as 月度销售额,
    AVG(total_amount) as 月度平均订单
FROM sales_data
GROUP BY DATE_TRUNC('month', sale_date)
ORDER BY 销售月份;
```

### 🔍 复杂查询示例

#### 📊 多表关联分析

```sql
-- 🌟 展示Greenplum高级查询能力

-- 1. 窗口函数分析
WITH sales_ranking AS (
    SELECT 
        product_name,
        category,
        total_amount,
        customer_region,
        ROW_NUMBER() OVER (PARTITION BY category ORDER BY total_amount DESC) as category_rank,
        PERCENT_RANK() OVER (ORDER BY total_amount) as sales_percentile,
        LAG(total_amount) OVER (ORDER BY sale_date) as prev_sale_amount,
        SUM(total_amount) OVER (PARTITION BY customer_region) as region_total
    FROM sales_data
)
SELECT 
    product_name as 产品名称,
    category as 类别,
    total_amount as 销售额,
    category_rank as 类别内排名,
    ROUND((sales_percentile * 100)::NUMERIC, 1) as 销售额百分位,
    COALESCE(total_amount - prev_sale_amount, 0) as 与上笔订单差额,
    region_total as 所在区域总销售额
FROM sales_ranking
WHERE category_rank <= 3
ORDER BY category, category_rank;

-- 2. 复杂聚合分析
SELECT 
    customer_region as 销售区域,
    COUNT(*) as 订单数量,
    COUNT(DISTINCT product_name) as 产品种类,
    SUM(total_amount) as 总销售额,
    AVG(total_amount) as 平均订单金额,
    STDDEV(total_amount) as 订单金额标准差,
    -- 计算销售额分布
    COUNT(CASE WHEN total_amount < 5000 THEN 1 END) as 小额订单数,
    COUNT(CASE WHEN total_amount BETWEEN 5000 AND 15000 THEN 1 END) as 中额订单数,
    COUNT(CASE WHEN total_amount > 15000 THEN 1 END) as 大额订单数,
    -- 拼接月份与销售金额明细（不计算月度增长）
    STRING_AGG(
        DATE_PART('month', sale_date)::TEXT || ':' || total_amount::TEXT, 
        ', ' ORDER BY sale_date
    ) as 月度明细
FROM sales_data
GROUP BY customer_region
HAVING SUM(total_amount) > 10000
ORDER BY 总销售额 DESC;
```

## ⚡ 体验MPP并行计算

### 📊 并行执行验证

#### 🔍 查看执行计划

```sql
-- 🚀 查看Greenplum如何并行执行查询

-- 1. 查看简单查询的执行计划
EXPLAIN SELECT * FROM sales_data WHERE category = '手机';

-- 2. 查看聚合查询的执行计划
EXPLAIN (ANALYZE, BUFFERS) 
SELECT 
    customer_region,
    COUNT(*),
    SUM(total_amount)
FROM sales_data
GROUP BY customer_region;

-- 3. 查看大数据量查询的执行计划
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT 
    product_id,
    COUNT(*) as order_count,
    SUM(amount) as total_sales,
    AVG(amount) as avg_sale
FROM large_sales
WHERE sale_date >= '2023-06-01'
GROUP BY product_id
HAVING COUNT(*) > 50
ORDER BY total_sales DESC
LIMIT 10;
```

**EXPLAIN ANALYZE 输出解读：**

理解Greenplum执行计划时，可从叶子节点向父节点梳理数据流；下面仅为并行聚合的概念示意，不是所给SQL的实测计划，实际节点名称、Motion、排序及汇总位置会随版本、优化器和统计信息变化：

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"PingFang SC, -apple-system, Source Han Serif SC, serif","fontSize":"16px","background":"#FDFBF5","primaryColor":"#FDFBF5","primaryTextColor":"#2D2A26","primaryBorderColor":"#6E6A60","secondaryColor":"#E8EFE8","secondaryBorderColor":"#8FA890","secondaryTextColor":"#2D2A26","tertiaryColor":"#FDFBF5","tertiaryBorderColor":"#9A9488","tertiaryTextColor":"#6E6A60","lineColor":"#6E6A60","textColor":"#2D2A26","mainBkg":"#FDFBF5","nodeBorder":"#2D5A3D","clusterBkg":"#F3EEDF","clusterBorder":"#9A9488","edgeLabelBackground":"#FDFBF5"},"flowchart":{"htmlLabels":true,"curve":"basis","padding":20,"nodeSpacing":60,"rankSpacing":70,"useMaxWidth":false},"themeCSS":".node rect, .node polygon, .node circle { stroke-width: 1.5px; } .edgePath .path { stroke-width: 1.5px; } .cluster-label .nodeLabel, .cluster-label foreignObject { color: #2D2A26 !important; } .edgeLabel, .edgeLabel foreignObject { color: #2D2A26 !important; background-color: #FDFBF5; } .edgeLabel rect { fill: #FDFBF5; }"}}%%
flowchart BT
    classDef default fill:#FDFBF5,stroke:#6E6A60,color:#2D2A26,stroke-width:1.5px
    classDef startend fill:#2D2A26,stroke:#2D2A26,color:#FDFBF5,font-weight:bold
    classDef decision fill:#F6EAD8,stroke:#C08A1A,color:#2D2A26,font-weight:bold
    classDef hub fill:#3B5A80,stroke:#3B5A80,color:#FDFBF5,font-weight:bold
    classDef io fill:#E5EAF0,stroke:#3B5A80,color:#2D2A26
    classDef accent fill:#A6432C,stroke:#A6432C,color:#FDFBF5,font-weight:bold
    classDef storage fill:#F3EEDF,stroke:#9A9488,color:#2D2A26
    A["Seq Scan on large_sales\n(各 Segment 并行扫描)"] --> B
    B["Partial HashAggregate\n(各 Segment 本地聚合)"] --> C
    C["Redistribute Motion N:N\n(按 product_id 重分布数据)"] --> D
    D["Finalize HashAggregate\n(汇总各 Segment 结果)"] --> E
    E["Sort\n(ORDER BY total_sales DESC)"] --> F
    F["Limit\n(LIMIT 10，返回前 10 行)"]
    class A,B,C,D,E,F default
```

关键指标说明：

| 指标 | 含义 | 优化方向 |
|------|------|---------|
| `cost=X..Y` | 估算启动成本和总成本（优化器成本单位，不是毫秒） | 在同一查询、同一环境中辅助比较候选计划，不代表实际耗时 |
| `rows=N` | 估算返回行数（基于统计信息） | 与实际差距大时需 `ANALYZE` 更新统计 |
| `actual time=X..Y` | 实际执行时间（ANALYZE 时显示，注意循环次数及分布式汇总口径） | 不可直接与cost比较；结合实际行数、估算行数、I/O和数据移动定位原因 |
| `Redistribute Motion N:N` | 数据在 Segment 间重分布，有网络开销 | 检查连接是否覆盖完整分布键、分布策略是否兼容；聚合等操作也可能需要重分布 |
| `Broadcast Motion` | 将源执行节点的数据复制发送到目标Segment，不一定由Master发送 | 优化器可能为较小输入选择广播，需结合输入规模、计划和网络开销判断 |

> [!tip] EXPLAIN ANALYZE 使用技巧
> - `EXPLAIN` 只显示执行计划（不实际执行），适合快速检查计划是否合理
> - `EXPLAIN ANALYZE` 实际执行查询并显示真实时间，适合定位性能瓶颈
> - `EXPLAIN (ANALYZE, BUFFERS, VERBOSE)` 同时显示缓冲区命中情况，适合深度调优
> - 看到 `Redistribute Motion` 频繁出现时，检查 JOIN 字段是否与分布键对齐

#### 📈 性能对比测试

```sql
-- 🏁 当前集群内的查询计时练习（未设置单节点对照）

-- 1. 创建性能测试函数
CREATE OR REPLACE FUNCTION performance_test(query_name TEXT, sql_query TEXT)
RETURNS TABLE(
    test_name TEXT,
    execution_time INTERVAL,
    rows_processed BIGINT
) AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    row_count BIGINT;
BEGIN
    start_time := clock_timestamp();
    
    EXECUTE sql_query;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    
    end_time := clock_timestamp();
    
    RETURN QUERY SELECT query_name, end_time - start_time, row_count;
END;
$$ LANGUAGE plpgsql;

-- 2. 执行性能测试
SELECT * FROM performance_test(
    '大数据聚合查询',
    'SELECT product_id, COUNT(*), SUM(amount), AVG(amount) 
     FROM large_sales 
     GROUP BY product_id 
     HAVING COUNT(*) > 10'
);

-- 3. 比较不同查询复杂度的性能
\timing on

-- 简单查询
SELECT COUNT(*) FROM large_sales;

-- 复杂聚合查询
SELECT 
    DATE_TRUNC('month', sale_date) as month,
    COUNT(*) as order_count,
    SUM(amount) as total_amount,
    AVG(amount) as avg_amount,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount) as median_amount,
    STDDEV(amount) as amount_stddev
FROM large_sales
GROUP BY DATE_TRUNC('month', sale_date)
ORDER BY month;

-- 窗口函数查询
SELECT 
    id,
    amount,
    ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY amount DESC) as rank,
    SUM(amount) OVER (PARTITION BY product_id) as product_total,
    amount / SUM(amount) OVER (PARTITION BY product_id) as percentage
FROM large_sales
WHERE product_id <= 10
ORDER BY product_id, rank;

\timing off
```

### 🔍 数据分布查询

#### 📊 查看数据在Segment间的分布

```sql
-- 🗂️ 查看数据分布情况

-- 1. 查看各Segment的数据分布
SELECT 
    gp_segment_id as 节点ID,
    COUNT(*) as 数据行数,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as 数据占比
FROM sales_data
GROUP BY gp_segment_id
ORDER BY gp_segment_id;

-- 2. 查看大表的数据分布
SELECT 
    gp_segment_id as 节点ID,
    COUNT(*) as 数据行数,
    MIN(id) as 最小ID,
    MAX(id) as 最大ID,
    AVG(amount) as 平均金额,
    SUM(amount) as 总金额
FROM large_sales
GROUP BY gp_segment_id
ORDER BY gp_segment_id;

-- 3. 检查数据分布均匀性
WITH segment_stats AS (
    SELECT 
        gp_segment_id,
        COUNT(*) as row_count
    FROM large_sales
    GROUP BY gp_segment_id
),
distribution_stats AS (
    SELECT 
        AVG(row_count) as avg_rows,
        STDDEV(row_count) as stddev_rows,
        MIN(row_count) as min_rows,
        MAX(row_count) as max_rows
    FROM segment_stats
)
SELECT 
    '数据分布统计' as 统计项,
    ROUND(avg_rows) as 平均行数,
    ROUND(stddev_rows) as 标准差,
    min_rows as 最少行数,
    max_rows as 最多行数,
    ROUND((max_rows - min_rows) * 100.0 / avg_rows, 2) as 分布差异百分比
FROM distribution_stats;
```

## 🎨 查询优化初体验

### 📈 查询性能分析

#### 🔍 分析查询瓶颈

```sql
-- 🔧 查询性能分析和优化

-- 1. 查看当前活跃查询
SELECT 
    pid as 进程ID,
    usename as 用户名,
    datname as 数据库,
    state as 状态,
    now() - query_start as 运行时长,
    substring(query, 1, 80) as 查询预览
FROM pg_stat_activity
WHERE state = 'active'
AND query NOT LIKE '%pg_stat_activity%'
ORDER BY query_start;

-- 2. 查看查询统计信息
SELECT 
    schemaname as 模式名,
    relname as 表名,
    n_tup_ins as 插入行数,
    n_tup_upd as 更新行数,
    n_tup_del as 删除行数,
    n_live_tup as 活跃行数,
    n_dead_tup as 死亡行数,
    last_vacuum as 最后清理时间,
    last_analyze as 最后分析时间
FROM pg_stat_user_tables
WHERE schemaname = 'public';

-- 3. 分析表的访问模式
SELECT 
    schemaname as 模式名,
    relname as 表名,
    seq_scan as 顺序扫描次数,
    seq_tup_read as 顺序读取行数,
    idx_scan as 索引扫描次数,
    idx_tup_fetch as 索引获取行数,
    CASE 
        WHEN seq_scan + idx_scan > 0 
        THEN ROUND(idx_scan * 100.0 / (seq_scan + idx_scan), 2)
        ELSE 0
    END as 索引使用率
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan + idx_scan DESC;
```

#### 🚀 简单优化示例

```sql
-- ⚡ 查询优化实例

-- 基准查询（实际耗时需测量）
EXPLAIN ANALYZE
SELECT *
FROM large_sales l
WHERE l.sale_date >= '2023-06-01'
AND l.amount > 5000
ORDER BY l.amount DESC;

-- 修改查询示例（与基准查询结果语义不同，不保证更快）
-- 1. 显式列出字段，但这里仍选择了表的全部五列
-- 2. 改变日期与金额筛选范围
-- 3. 改变排序并限制返回100行；仍然包含排序
EXPLAIN ANALYZE
SELECT 
    id, 
    product_id, 
    customer_id, 
    sale_date, 
    amount
FROM large_sales
WHERE sale_date BETWEEN '2023-06-01' AND '2023-12-31'
AND amount BETWEEN 5000 AND 50000
ORDER BY sale_date, amount DESC
LIMIT 100;

-- 创建索引优化查询（如果需要）
-- 注意：Greenplum中索引使用较少，主要依靠分布式扫描
CREATE INDEX idx_large_sales_date_amount 
ON large_sales (sale_date, amount)
WHERE amount > 1000;

-- 验证索引效果
EXPLAIN (ANALYZE, BUFFERS)
SELECT product_id, COUNT(*), SUM(amount)
FROM large_sales
WHERE sale_date >= '2023-09-01'
AND amount > 1000
GROUP BY product_id;
```

### 📊 数据统计信息

#### 🔍 更新表统计信息

```sql
-- 📈 维护统计信息以提升查询性能

-- 1. 查看当前统计信息状态
SELECT 
    schemaname,
    tablename,
    attname as column_name,
    n_distinct as distinct_values,
    correlation,
    most_common_vals as common_values,
    most_common_freqs as common_frequencies
FROM pg_stats
WHERE schemaname = 'public'
AND tablename IN ('sales_data', 'large_sales')
ORDER BY schemaname, tablename, attname;

-- 2. 手动更新统计信息
ANALYZE sales_data;
ANALYZE large_sales;

-- 3. 查看表的详细统计信息
SELECT 
    tablename as 表名,
    attname as 列名,
    n_distinct as 唯一值数量,
    CASE 
        WHEN n_distinct > 0 THEN n_distinct
        WHEN n_distinct < 0 THEN ABS(n_distinct) * reltuples
        ELSE NULL
    END as 估计唯一值,
    correlation as 数据相关性,
    most_common_vals[1:3] as 最常见值前3
FROM pg_stats s
JOIN pg_class c ON s.tablename = c.relname
WHERE s.schemaname = 'public'
AND s.tablename = 'large_sales'
ORDER BY attname;

-- 4. 检查数据分布倾斜
WITH skew_check AS (
    SELECT 
        gp_segment_id,
        COUNT(*) as row_count,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount,
        AVG(amount) as avg_amount
    FROM large_sales
    GROUP BY gp_segment_id
)
SELECT 
    gp_segment_id as 节点ID,
    row_count as 行数,
    ROUND(avg_amount, 2) as 平均金额,
    min_amount as 最小金额,
    max_amount as 最大金额,
    ROUND(
        (row_count - AVG(row_count) OVER ()) * 100.0 / AVG(row_count) OVER (),
        2
    ) as 行数偏差百分比
FROM skew_check
ORDER BY gp_segment_id;
```

## 🎓 查询实践练习

### 📚 练习题目

#### 🏆 初级练习题

```sql
-- 🎯 初级练习：基础查询技能

-- 练习1：基础统计查询
-- 题目：查询每个销售人员的订单数量和总销售额
-- 要求：按总销售额降序排列

-- 你的答案：
SELECT 
    salesperson as 销售人员,
    COUNT(*) as 订单数量,
    SUM(total_amount) as 总销售额
FROM sales_data
GROUP BY salesperson
ORDER BY 总销售额 DESC;

-- 练习2：时间范围查询
-- 题目：查询2023年1月18日之后的所有销售记录
-- 要求：显示产品名称、销售日期、数量、总金额

-- 你的答案：
SELECT 
    product_name as 产品名称,
    sale_date as 销售日期,
    quantity as 数量,
    total_amount as 总金额
FROM sales_data
WHERE sale_date > '2023-01-18'
ORDER BY sale_date;

-- 练习3：条件筛选查询
-- 题目：查询总金额大于10000元的订单
-- 要求：显示所有字段，并按总金额降序排列

-- 你的答案：
SELECT *
FROM sales_data
WHERE total_amount > 10000
ORDER BY total_amount DESC;
```

#### 🌟 中级练习题

```sql
-- 🎯 中级练习：分析函数和复杂查询

-- 练习4：窗口函数练习
-- 题目：为每个销售区域的订单按金额排名
-- 要求：显示区域、产品、金额、区域内排名

-- 你的答案：
SELECT 
    customer_region as 销售区域,
    product_name as 产品名称,
    total_amount as 销售金额,
    RANK() OVER (
        PARTITION BY customer_region 
        ORDER BY total_amount DESC
    ) as 区域内排名
FROM sales_data
ORDER BY customer_region, 区域内排名;

-- 练习5：数据透视分析
-- 题目：创建产品类别和销售区域的交叉分析
-- 要求：显示每个类别在各区域的销售额

-- 你的答案：
SELECT 
    category as 产品类别,
    SUM(CASE WHEN customer_region = '北京' THEN total_amount ELSE 0 END) as 北京销售额,
    SUM(CASE WHEN customer_region = '上海' THEN total_amount ELSE 0 END) as 上海销售额,
    SUM(CASE WHEN customer_region = '深圳' THEN total_amount ELSE 0 END) as 深圳销售额,
    SUM(CASE WHEN customer_region = '广州' THEN total_amount ELSE 0 END) as 广州销售额,
    SUM(total_amount) as 总销售额
FROM sales_data
GROUP BY category
ORDER BY 总销售额 DESC;

-- 练习6：复杂聚合查询
-- 题目：分析大数据表中各产品的销售模式
-- 要求：包含产品ID、订单数、总销售额、平均订单、标准差

-- 你的答案：
SELECT 
    product_id as 产品ID,
    COUNT(*) as 订单数量,
    SUM(amount) as 总销售额,
    ROUND(AVG(amount), 2) as 平均订单金额,
    ROUND(STDDEV(amount), 2) as 金额标准差,
    MIN(amount) as 最小订单,
    MAX(amount) as 最大订单,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount) as 订单金额中位数
FROM large_sales
WHERE product_id <= 20
GROUP BY product_id
HAVING COUNT(*) >= 50
ORDER BY 总销售额 DESC
LIMIT 10;
```

#### 🏆 高级练习题

```sql
-- 🎯 高级练习：优化和分布式特性

-- 练习7：性能优化练习
-- 题目：优化这个查询的性能
-- 原始查询（需要优化）：
SELECT *
FROM large_sales l1
WHERE EXISTS (
    SELECT 1 
    FROM large_sales l2 
    WHERE l2.customer_id = l1.customer_id 
    AND l2.amount > l1.amount
)
ORDER BY l1.amount DESC;

-- 保持结果语义的等价改写候选（是否更快需用执行计划和计时验证）：
WITH customer_max_amounts AS (
    SELECT 
        customer_id,
        MAX(amount) as max_amount
    FROM large_sales
    GROUP BY customer_id
)
SELECT 
    l.id,
    l.product_id,
    l.customer_id,
    l.sale_date,
    l.amount
FROM large_sales l
JOIN customer_max_amounts c ON l.customer_id = c.customer_id
WHERE l.amount < c.max_amount
ORDER BY l.amount DESC;

-- 练习8：分布式特性验证
-- 题目：验证查询的并行执行效果
-- 要求：使用EXPLAIN分析执行计划

EXPLAIN (ANALYZE, VERBOSE, BUFFERS)
WITH monthly_sales AS (
    SELECT 
        DATE_TRUNC('month', sale_date) as month,
        product_id,
        SUM(amount) as monthly_amount,
        COUNT(*) as monthly_count
    FROM large_sales
    WHERE sale_date >= '2023-01-01'
    GROUP BY DATE_TRUNC('month', sale_date), product_id
),
product_trends AS (
    SELECT 
        product_id,
        month,
        monthly_amount,
        LAG(monthly_amount) OVER (
            PARTITION BY product_id 
            ORDER BY month
        ) as prev_month_amount,
        monthly_amount - LAG(monthly_amount) OVER (
            PARTITION BY product_id 
            ORDER BY month
        ) as month_growth
    FROM monthly_sales
)
SELECT 
    product_id as 产品ID,
    COUNT(CASE WHEN month_growth > 0 THEN 1 END) as 增长月数,
    COUNT(CASE WHEN month_growth < 0 THEN 1 END) as 下降月数,
    AVG(monthly_amount) as 平均月销售额,
    MAX(month_growth) as 最大月增长额,
    MIN(month_growth) as 最大月下降额
FROM product_trends
WHERE month_growth IS NOT NULL
GROUP BY product_id
HAVING COUNT(*) >= 6  -- 至少6个月数据
ORDER BY 平均月销售额 DESC
LIMIT 20;
```

## 🔧 常用查询工具和技巧

### 📊 系统信息查询

#### 🔍 集群状态查询

```sql
-- 🏗️ Greenplum集群状态和配置查询

-- 1. 查看集群配置信息
SELECT 
    name as 配置参数,
    setting as 当前值,
    unit as 单位,
    category as 分类,
    short_desc as 描述
FROM pg_settings
WHERE category LIKE '%Greenplum%'
OR name IN ('max_connections', 'shared_buffers', 'work_mem')
ORDER BY category, name;

-- 2. 查看Segment节点信息
SELECT 
    content as 节点ID,
    hostname as 主机名,
    address as IP地址,
    port as 端口,
    CASE 
        WHEN content = -1 THEN 'Master'
        ELSE 'Segment'
    END as 节点类型,
    CASE 
        WHEN preferred_role = 'p' THEN 'Primary'
        WHEN preferred_role = 'm' THEN 'Mirror'
        ELSE 'Unknown'
    END as 角色
FROM gp_segment_configuration
ORDER BY content, preferred_role;

-- 3. 查看当前连接信息
SELECT 
    datname as 数据库,
    usename as 用户,
    client_addr as 客户端IP,
    state as 状态,
    COUNT(*) as 连接数
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
GROUP BY datname, usename, client_addr, state
ORDER BY 连接数 DESC;

-- 4. 查看表空间使用情况
SELECT 
    schemaname as 模式,
    tablename as 表名,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as 表大小,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as 数据大小,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as 索引大小
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 🛠️ 实用查询函数

#### 📚 常用函数示例

```sql
-- 🔧 Greenplum实用函数集合

-- 1. 数据类型转换函数
SELECT 
    '数据类型转换示例' as 示例类型,
    '123'::INTEGER as 字符转整数,
    123::TEXT as 整数转字符,
    '2023-01-15'::DATE as 字符转日期,
    NOW()::DATE as 时间戳转日期,
    ROUND(123.456, 2) as 数值四舍五入,
    TRUNC(123.456, 1) as 数值截断;

-- 2. 字符串处理函数
SELECT 
    '字符串处理示例' as 示例类型,
    LENGTH('Hello Greenplum') as 字符串长度,
    UPPER('hello world') as 转大写,
    LOWER('HELLO WORLD') as 转小写,
    SUBSTRING('Greenplum', 1, 5) as 字符串截取,
    REPLACE('Hello World', 'World', 'Greenplum') as 字符串替换,
    CONCAT('Hello', ' ', 'Greenplum') as 字符串连接,
    SPLIT_PART('apple,banana,orange', ',', 2) as 字符串分割;

-- 3. 日期时间函数
SELECT 
    '日期时间处理示例' as 示例类型,
    NOW() as 当前时间,
    CURRENT_DATE as 当前日期,
    EXTRACT(YEAR FROM NOW()) as 提取年份,
    EXTRACT(MONTH FROM NOW()) as 提取月份,
    DATE_TRUNC('month', NOW()) as 截断到月,
    NOW() + INTERVAL '7 days' as 七天后,
    AGE('2023-12-31', '2023-01-01') as 计算时间差;

-- 4. 数学统计函数
SELECT 
    '数学统计函数示例' as 示例类型,
    ABS(-123) as 绝对值,
    CEIL(123.456) as 向上取整,
    FLOOR(123.456) as 向下取整,
    POWER(2, 3) as 幂运算,
    SQRT(16) as 平方根,
    RANDOM() as 随机数,
    GENERATE_SERIES(1, 5) as 生成序列;

-- 5. 条件判断函数
SELECT 
    product_name,
    total_amount,
    CASE 
        WHEN total_amount > 15000 THEN '大额订单'
        WHEN total_amount > 10000 THEN '中额订单'
        ELSE '小额订单'
    END as 订单级别,
    COALESCE(NULL, total_amount, 0) as 空值处理,
    NULLIF(total_amount, 0) as 零值转空,
    GREATEST(quantity, unit_price) as 最大值,
    LEAST(quantity, unit_price) as 最小值
FROM sales_data;
```

## 🎉 成功体验总结

### ✅ 完成成就清单

完成相应操作并核对结果后，可用以下清单确认学习成果：

- [x] **🔗 连接数据库**：掌握了多种连接Greenplum的方式
- [x] **📊 执行查询**：完成了第一个SQL查询并获得结果
- [x] **⚡ 体验并行**：理解了MPP架构的并行执行特性
- [x] **📈 分析数据**：使用聚合函数进行数据统计分析
- [x] **🔍 查看计划**：学会查看和理解执行计划
- [x] **📊 分布验证**：验证了数据在Segment间的分布
- [x] **🎯 性能分析**：初步了解了查询性能分析方法
- [x] **💪 实践练习**：完成了多个难度递增的练习题

### 🌟 关键收获

1. **🎯 理解MPP威力**
   - 体验了分布式并行计算的强大能力
   - 看到了数据在多个节点间的分布处理
   - 学习了观察并行查询的方法；是否比其他数据库更快，需在相同数据、查询语义和资源条件下进行对照测试

2. **📊 掌握基础技能**
   - 熟悉了Greenplum的SQL语法特性
   - 学会了使用分析函数和窗口函数
   - 掌握了查看执行计划的方法

3. **🔧 获得实战经验**
   - 完成了从简单到复杂的查询实践
   - 学会了基础的性能分析技巧
   - 了解了常用的系统管理查询

### 🚀 下一步学习建议

#### 📚 继续深入方向

1. **SQL技能提升**
   - 学习更复杂的窗口函数
   - 掌握CTE（通用表表达式）
   - 练习复杂的多表关联

2. **性能优化技能**
   - 深入学习查询优化原理
   - 掌握索引使用技巧
   - 学习表设计最佳实践

3. **分布式特性**
   - 理解数据分布策略
   - 学习分区表设计
   - 掌握并行查询调优

#### 🛠️ 实践项目建议

1. **创建自己的分析项目**
   - 导入真实业务数据
   - 设计分析报表
   - 建立数据看板

2. **性能测试项目**
   - 对比不同查询写法的性能
   - 测试不同数据量的查询速度
   - 分析瓶颈和优化方案

3. **自动化脚本**
   - 编写数据导入脚本
   - 创建定时分析任务
   - 建立监控告警机制

## 💡 学习心得分享

### 🎯 初学者常见问题

| 问题类型 | 常见症状 | 解决方案 | 预防措施 |
|---|---|---|---|
| **连接问题** | 无法连接数据库 | 检查服务状态和网络 | 确认环境变量设置 |
| **权限问题** | 查询被拒绝 | 检查用户权限 | 使用正确的数据库用户 |
| **语法错误** | SQL执行失败 | 参考PostgreSQL语法 | 多练习基础SQL |
| **性能问题** | 查询很慢 | 检查执行计划 | 学习查询优化技巧 |

### 🌟 学习效果自评

**请诚实回答以下问题，检验学习效果：**

1. **基础连接**：我能独立连接到Greenplum数据库吗？ □ 是 □ 否
2. **查询编写**：我能编写基本的SELECT查询吗？ □ 是 □ 否  
3. **分组聚合**：我能使用GROUP BY进行数据统计吗？ □ 是 □ 否
4. **执行计划**：我能看懂基本的执行计划吗？ □ 是 □ 否
5. **并行理解**：我理解MPP并行执行的原理吗？ □ 是 □ 否

**如果有任何"否"的回答，建议重新练习相关部分！**

---

**🎉 恭喜！你已经成功执行了第一个Greenplum查询，正式踏入了分布式数据分析的世界！接下来我们将学习更深入的SQL操作技巧。** 🚀✨