---
title: Paimon与Spark集成 - 批量处理与SQL查询
tags:
  - Paimon
  - Spark
  - OLAP
  - 批处理
  - DataLake
created: 2024-12-05
updated: 2026-10-10
difficulty: 中级
duration: 25分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
stability: slow-changing
status: maintenance
access_tier: free
---


# ⚡ Paimon与Spark集成 - 批量处理与SQL查询

> [!abstract] 📋 本节概览
> - 🎯 **学习目标**:掌握使用Spark进行Paimon数据的批量读写和复杂分析
> - 📚 **前置知识**:[[【技术与工具】/Paimon/11-Paimon与Flink集成|Paimon与Flink集成]]
> - ⏱️ **预计用时**:25分钟
> - 🔧 **核心内容**:Spark Catalog配置、MERGE INTO语法、Time Travel查询、结构化流
> - 💡 **关键收获**:利用Spark强大的计算能力进行复杂ETL和OLAP分析

## 🎯 为什么需要 Spark + Paimon?

虽然Flink是Paimon流式写入的最佳搭档，但Spark在以下场景中具有不可替代的优势：
1.  **复杂OLAP查询**：Spark SQL的优化器非常成熟，适合处理大规模数据的Join和聚合。
2.  **批量数据修正**：使用 `MERGE INTO` 或 `UPDATE` 批量修复历史数据。
3.  **离线数仓ETL**：处理T+1的离线报表任务。
4.  **AI/ML集成**：读取Paimon数据进行机器学习模型训练。

---

## ⚙️ 环境集成 (Configuration)

### 1. 依赖准备
下载对应的 `paimon-spark` jar包，并放入Spark的 `jars` 目录或通过 `--packages` 指定。
- `paimon-spark-3.5.jar` (对应Spark 3.5)
- `paimon-spark-3.3.jar` (对应Spark 3.3)

### 2. Catalog配置
在 `spark-defaults.conf` 或启动命令中配置Catalog。

```bash
spark-sql \
    --conf spark.sql.catalog.paimon=org.apache.paimon.spark.SparkCatalog \
    --conf spark.sql.catalog.paimon.warehouse=hdfs://namenode:8020/paimon \
    --conf spark.sql.extensions=org.apache.paimon.spark.extensions.PaimonSparkSessionExtensions
```

> [!tip] 扩展项
> `PaimonSparkSessionExtensions` 是可选的，但强烈建议添加。它提供了Paimon特有的SQL语法扩展（如 `CALL sys.compact`）。

---

## 📖 数据读取 (Query)

### 1. 标准SQL查询
```sql
USE paimon.default;
SELECT region, sum(sales) 
FROM orders 
GROUP BY region;
```

### 2. Time Travel (历史回溯)
Spark SQL支持标准的 `VERSION AS OF` 或 `TIMESTAMP AS OF` 语法。

```sql
-- 查询快照ID为 10 的数据
SELECT * FROM orders VERSION AS OF 10;

-- 查询 2024-01-01 12:00:00 的数据
SELECT * FROM orders TIMESTAMP AS OF '2024-01-01 12:00:00';
```

### 3. 结构化流 (Structured Streaming)
Spark Structured Streaming 也可以流式读取Paimon。

```scala
val df = spark.readStream
    .format("paimon")
    .load("hdfs://namenode:8020/paimon/default.db/orders")

df.writeStream
    .format("console")
    .start()
```

---

## ✍️ 数据写入与维护 (Write & DML)

Spark提供了比Flink更丰富的批量DML语法。

### 1. 批量写入
```sql
-- INSERT写入：追加表追加记录；主键表按主键及表配置处理写入，不等同于仅追加
INSERT INTO orders VALUES (1, 'book', 100);

-- Overwrite覆写 (重跑分区)
INSERT OVERWRITE orders PARTITION (dt='2024-01-01')
SELECT ... FROM source_table;
```

### 2. 复杂更新 (MERGE INTO)
这是Spark的一大杀器，适合行级更新、CDC重放等场景。

```sql
MERGE INTO target_table AS t
USING source_table AS s
ON t.id = s.id
WHEN MATCHED THEN
  UPDATE SET t.name = s.name, t.price = s.price
WHEN NOT MATCHED THEN
  INSERT (id, name, price) VALUES (s.id, s.name, s.price);
```

### 3. 删除与更新
```sql
-- 删除符合条件的数据
DELETE FROM orders WHERE dt < '2023-01-01';

-- 更新数据
UPDATE orders SET status = 'archived' WHERE dt < '2023-01-01';
```

> [!warning] 性能提示
> `DELETE` 和 `UPDATE` 在Paimon中是重操作（特别是对于主键表），可能会产生大量Writer消耗。大批量操作可评估使用 `INSERT OVERWRITE`，但须明确整表或分区覆写范围，并生成该范围内全部应保留的数据；不能仅写入变更行。

---

## 🔧 系统运维 (Procedures)

通过Spark SQL可以直接调用Paimon的存储过程，进行运维操作。

```sql
-- 1. 手动触发合并 (Compaction)
CALL paimon.sys.compact('default.orders');

-- 2. 清理过期快照
CALL paimon.sys.expire_snapshots('default.orders');

-- 3. 创建Tag
CALL paimon.sys.create_tag('default.orders', 'v1.0');
```

---

## 📋 本节要点回顾

### ✅ 核心技能掌握检查
- [ ] 能够配置 Spark Catalog 访问 Paimon
- [ ] 掌握 `VERSION AS OF` 进行历史查询
- [ ] 会使用 `MERGE INTO` 进行复杂数据同步
- [ ] 知道如何通过 `CALL` 执行Paimon运维命令

### 🔗 学习路径连接
**已完成**：✅ 11-Flink集成 → ✅ 12-Spark集成
**下一步**：[[【技术与工具】/Paimon/13-Paimon性能调优|Paimon性能调优]] - 压榨系统性能的极限

> [!tip] 最佳实践
> "流写批读"是Paimon最经典的架构：
> - 使用 **Flink** 进行秒级实时写入和简单ETL。
> - 使用 **Spark** 进行复杂的T+1离线分析、数据修正和定期Compaction。

---

**创建时间**:2024-12-05
**最后更新**:2024-12-05
**学习时长**:25分钟
**难度等级**:⭐⭐ (中级)

#Paimon #Spark #OLAP #DataLake #批处理
