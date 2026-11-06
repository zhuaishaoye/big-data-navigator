---
title: 第一个Doris应用 - 快速入门实践
tags:
  - 技能实操
  - Doris
  - 入门实践
difficulty: 中级
duration: 25分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据分析师
  - BI分析师
  - 数据架构师
stability: slow-changing
status: maintenance
access_tier: free
updated: 2026-10-10
---


# 第一个Doris应用 - 快速入门实践

> [!abstract] 📋 本节概览
> - 🎯 **学习目标**：创建并运行第一个Doris应用，掌握基础操作
> - 📚 **前置知识**：05-Doris环境安装与配置|Doris环境安装与配置、基础SQL语法
> - ⏱️ **预计用时**：25分钟
> - 🛠️ **核心技能**：创建数据库、表设计、数据导入、查询分析

## 🎯 我们要实现什么？

在本教程中，我们将创建一个简单的电商销售数据分析应用，实现以下功能：

1. 创建数据库和表结构
2. 导入销售数据
3. 执行基础分析查询
4. 创建简单的物化视图优化查询

## 📝 操作步骤

### 步骤1：连接Doris服务器

首先，我们需要连接到已安装好的Doris服务器：

```bash
# 使用MySQL客户端连接Doris
mysql -h 127.0.0.1 -P 9030 -u root
```

> [!info] 📌 提示
> Doris兼容MySQL协议，可以使用任何MySQL客户端工具连接，如MySQL命令行、Navicat、DBeaver等。

### 步骤2：创建数据库和表

#### 创建数据库

```sql
-- 创建电商分析数据库
CREATE DATABASE IF NOT EXISTS ecommerce;

-- 切换到该数据库
USE ecommerce;
```

#### 创建商品维度表

```sql
-- 创建商品表（使用Unique模型，支持更新）
CREATE TABLE product (
    product_id INT,
    product_name VARCHAR(100),
    category VARCHAR(50),
    brand VARCHAR(50),
    price DECIMAL(10, 2),
    create_time DATETIME,
    update_time DATETIME
)
ENGINE=OLAP
UNIQUE KEY(product_id)
DISTRIBUTED BY HASH(product_id) BUCKETS 10;
```

> [!info] 📚 表模型解释
> 我们使用了**Unique模型**，它按product_id维护唯一记录，适合维度表场景；同键记录的覆盖顺序取决于导入顺序及Sequence列等配置，并不会仅因存在update_time字段就自动保留业务时间最新的数据。

#### 创建销售明细表

```sql
-- 创建销售明细表（使用Duplicate模型，保留所有明细）
CREATE TABLE sales_detail (
    order_id BIGINT,
    order_time DATETIME,
    product_id INT,
    user_id INT,
    quantity INT,
    sale_price DECIMAL(10, 2)
)
ENGINE=OLAP
DUPLICATE KEY(order_id, order_time, product_id)
PARTITION BY RANGE(order_time) (
    PARTITION p202301 VALUES [('2023-01-01'), ('2023-02-01')),
    PARTITION p202302 VALUES [('2023-02-01'), ('2023-03-01')),
    PARTITION p202303 VALUES [('2023-03-01'), ('2023-04-01'))
)
DISTRIBUTED BY HASH(order_id) BUCKETS 20;
```

> [!info] 📚 表结构解释
> - **Duplicate模型**：保留所有明细数据，不做聚合
> - **分区设计**：按月分区，方便管理历史数据
> - **分桶设计**：按order_id哈希分布，提高并行度

#### 创建销售汇总表

```sql
-- 创建销售汇总表（使用Aggregate模型，自动聚合）
CREATE TABLE sales_agg (
    sale_date DATE,
    product_id INT,
    category VARCHAR(50),
    total_quantity BIGINT SUM,
    total_amount DECIMAL(20, 2) SUM
)
ENGINE=OLAP
AGGREGATE KEY(sale_date, product_id, category)
PARTITION BY RANGE(sale_date) (
    PARTITION p202301 VALUES [('2023-01-01'), ('2023-02-01')),
    PARTITION p202302 VALUES [('2023-02-01'), ('2023-03-01')),
    PARTITION p202303 VALUES [('2023-03-01'), ('2023-04-01'))
)
DISTRIBUTED BY HASH(product_id) BUCKETS 10;
```

> [!info] 📚 表模型解释
> 我们使用了**Aggregate模型**，它会按维度列(sale_date, product_id, category)聚合指标列(total_quantity, total_amount)；对适合预聚合的负载，可减少存储量和查询计算，但收益取决于维度基数、数据分布及查询方式。

### 步骤3：导入数据

#### 导入商品数据

```sql
-- 直接通过INSERT语句导入少量数据
INSERT INTO product VALUES
(1001, 'iPhone 14', 'Smartphone', 'Apple', 799.00, '2023-01-01 10:00:00', '2023-01-01 10:00:00'),
(1002, 'Galaxy S23', 'Smartphone', 'Samsung', 699.00, '2023-01-02 11:00:00', '2023-01-02 11:00:00'),
(1003, 'iPad Pro', 'Tablet', 'Apple', 999.00, '2023-01-03 12:00:00', '2023-01-03 12:00:00'),
(1004, 'MacBook Air', 'Laptop', 'Apple', 1299.00, '2023-01-04 13:00:00', '2023-01-04 13:00:00'),
(1005, 'ThinkPad X1', 'Laptop', 'Lenovo', 1499.00, '2023-01-05 14:00:00', '2023-01-05 14:00:00');
```

#### 导入销售明细数据

```sql
-- 通过INSERT语句导入示例数据
INSERT INTO sales_detail VALUES
(10001, '2023-01-05 10:30:00', 1001, 101, 1, 799.00),
(10001, '2023-01-05 10:30:00', 1003, 101, 1, 999.00),
(10002, '2023-01-06 11:20:00', 1002, 102, 1, 699.00),
(10003, '2023-01-10 09:15:00', 1001, 103, 2, 1598.00),
(10004, '2023-01-15 16:40:00', 1005, 104, 1, 1499.00),
(10005, '2023-01-20 14:25:00', 1004, 105, 1, 1299.00),
(10006, '2023-01-25 11:10:00', 1001, 106, 1, 799.00),
(10007, '2023-02-01 10:00:00', 1002, 107, 2, 1398.00),
(10008, '2023-02-05 13:30:00', 1003, 108, 1, 999.00),
(10009, '2023-02-10 15:45:00', 1004, 109, 1, 1299.00);
```

#### 导入销售汇总数据

```sql
-- 从明细表计算并导入汇总数据
INSERT INTO sales_agg
SELECT DATE(order_time) AS sale_date, 
       s.product_id, 
       p.category,
       SUM(quantity) AS total_quantity,
       SUM(sale_price) AS total_amount
FROM sales_detail s
JOIN product p ON s.product_id = p.product_id
GROUP BY DATE(order_time), s.product_id, p.category;
```

> [!tip] 💡 实际应用中的数据导入
> 在实际应用中，我们通常会使用 Stream Load、Broker Load 或 Routine Load 等方式从文件或消息队列导入大量数据。这里使用INSERT语句完成少量数据测试；生产环境应按数据来源、规模和可靠性要求选择导入方式，下面的Stream Load命令仅作本地实验示例。

#### 使用 Stream Load 导入 CSV 文件

Stream Load 是 Doris 最常用的批量导入方式，通过 HTTP 接口直接将本地文件推送给 BE 节点，延迟低、吞吐高。

首先准备一个 CSV 文件 `sales_detail.csv`：
```text
10010,2023-03-01 09:00:00,1001,201,1,799.00
10011,2023-03-02 10:30:00,1002,202,2,1398.00
10012,2023-03-03 14:15:00,1004,203,1,1299.00
```

然后使用 curl 触发导入：

```bash
# Stream Load 导入命令
# -u root: 认证用户名（密码为空时直接写用户名）
# -H "label:load_20230301": 每次导入需要唯一的 label，用于去重和状态查询
# -H "column_separator:,": 列分隔符
# -H "columns:order_id,order_time,product_id,user_id,quantity,sale_price": 列映射
# -T sales_detail.csv: 要导入的本地文件
# http://fe_host:8030/api/ecommerce/sales_detail/_stream_load: 目标表路径

curl -v --location-trusted \
  -u root: \
  -H "label:load_20230301_001" \
  -H "column_separator:," \
  -H "columns:order_id,order_time,product_id,user_id,quantity,sale_price" \
  -T sales_detail.csv \
  http://127.0.0.1:8030/api/ecommerce/sales_detail/_stream_load
```

导入成功后，返回 JSON 中 `Status` 字段为 `Success`，`NumberLoadedRows` 显示实际入库行数：

```json
{
    "TxnId": 1001,
    "Label": "load_20230301_001",
    "Status": "Success",
    "Message": "OK",
    "NumberTotalRows": 3,
    "NumberLoadedRows": 3,
    "NumberFilteredRows": 0,
    "LoadBytes": 156,
    "LoadTimeMs": 80
}
```

> [!note] Stream Load 关键参数说明
> - `label`：用于标识导入任务；在label有效期内，已成功任务的label可用于防止重复提交。发生错误或响应超时时，应先确认原事务状态，再决定重试方式，不能假定所有失败都能直接复用同一label。
> - `max_filter_ratio`：允许的错误行比例（默认值需按目标版本核对）；设为`0.05`表示允许一定比例的行被过滤，并非通用生产建议，应明确丢弃数据的业务容忍度并核查过滤行。
> - `timeout`：超时秒数，大文件需要适当调大（默认 600 秒）
> - 分区表导入时，Doris 自动将数据路由到对应分区，无需手动指定

### 步骤4：执行基础查询

#### 查询商品信息

```sql
-- 查询所有苹果品牌商品
SELECT * FROM product WHERE brand = 'Apple';
```

#### 查询销售明细

```sql
-- 查询特定日期范围的销售明细
SELECT 
    s.order_id,
    s.order_time,
    p.product_name,
    p.category,
    s.quantity,
    s.sale_price
FROM sales_detail s
JOIN product p ON s.product_id = p.product_id
WHERE s.order_time >= '2023-01-01' AND s.order_time < '2023-02-01'
ORDER BY s.order_time;
```

#### 分析销售趋势

```sql
-- 按日期统计销售额
SELECT 
    sale_date,
    SUM(total_amount) AS daily_sales
FROM sales_agg
GROUP BY sale_date
ORDER BY sale_date;
```

#### 分析品类销售

```sql
-- 按品类统计销售情况
SELECT 
    category,
    SUM(total_quantity) AS total_quantity,
    SUM(total_amount) AS total_amount,
    COUNT(DISTINCT sale_date) AS sale_days
FROM sales_agg
GROUP BY category;
```

### 步骤5：创建物化视图优化查询

如果我们经常按品牌分析销售情况，可以创建物化视图来加速查询：

```sql
-- 创建按品牌聚合的物化视图
CREATE MATERIALIZED VIEW mv_brand_sales
BUILD IMMEDIATE
REFRESH COMPLETE ON MANUAL
DISTRIBUTED BY HASH(brand) BUCKETS 10
AS SELECT 
    DATE(order_time) AS sale_date,
    p.brand,
    SUM(quantity) AS total_quantity,
    SUM(sale_price) AS total_amount
FROM sales_detail s
JOIN product p ON s.product_id = p.product_id
GROUP BY DATE(order_time), p.brand;
```

> [!info] 📚 物化视图说明
> 这里使用异步物化视图预计算并存储多表聚合结果，需要目标Doris版本支持相应语法。该示例配置为手动全量刷新，后续源表变更需显式执行REFRESH MATERIALIZED VIEW mv_brand_sales；查询是否改写到物化视图取决于构建与刷新状态、版本能力、配置及查询形态，应通过EXPLAIN确认，不能保证自动命中或性能提升幅度。

使用物化视图查询：

```sql
-- 查询各品牌销售情况（是否使用物化视图需通过EXPLAIN确认）
SELECT 
    p.brand,
    SUM(s.quantity) AS total_quantity,
    SUM(s.sale_price) AS total_amount
FROM sales_detail s
JOIN product p ON s.product_id = p.product_id
GROUP BY p.brand;
```

## 📊 查看执行计划

要了解查询是否使用了物化视图，可以使用EXPLAIN命令：

```sql
-- 查看执行计划
EXPLAIN
SELECT 
    p.brand,
    SUM(s.quantity) AS total_quantity,
    SUM(s.sale_price) AS total_amount
FROM sales_detail s
JOIN product p ON s.product_id = p.product_id
GROUP BY p.brand;
```

如果看到输出中包含物化视图名称，说明查询使用了物化视图。

## ⚠️ 常见问题与解决方案

> [!warning] 🚨 注意事项
> - **分区设计**：实际应用中应根据数据量和查询模式设计合适的分区策略
> - **数据类型选择**：为节省空间，应选择合适的数据类型和长度
> - **导入失败**：检查数据格式、分区范围是否匹配
> - **查询慢**：考虑添加合适的排序键、创建物化视图或优化表结构

## 🎯 实践练习

1. **基础练习**：创建一个用户维度表，包含用户ID、姓名、性别、注册时间等字段
2. **进阶练习**：创建一个按小时统计销售额的物化视图
3. **实战应用**：尝试使用Stream Load从CSV文件导入数据

## ✅ 掌握检查
- [ ] 能独立创建不同模型的Doris表
- [ ] 掌握基本的数据导入方法
- [ ] 能编写并执行分析查询
- [ ] 了解物化视图的创建和使用

## 🔗 学习连接
**前置知识**: [[【技术与工具】/Doris/05-Doris环境安装与配置|Doris环境安装与配置]]
**下一步**: [[【技术与工具】/Doris/07-数据模型设计详解|数据模型设计]]
**相关概念**: [[【技术与工具】/Doris/03-Doris核心概念|Doris核心概念]], [[【技术与工具】/Doris/10-SQL查询与分析|SQL查询与]]

---

> [!tip] 💡 实战成功要点
> 
> 完成第一个Doris应用的关键：
> - 🎯 **业务驱动**：以实际业务场景为导向设计表结构
> - 📊 **数据建模**：选择合适的数据模型和分区策略
> - 🔍 **分析思路**：从简单到复杂逐步深入分析
> - ⚡ **性能关注**：及时检查和优化查询性能
> - 🔄 **迭代优化**：根据实际使用效果持续改进
> 
> 第一个成功的应用是掌握Doris的重要里程碑！ 