---
title: Hudi数据写入详解
tags:
  - Hudi
  - 数据写入
  - Insert
  - Upsert
  - Delete
  - 批量写入
  - 流式写入
difficulty: 高级
duration: 30分钟
description: 深入了解Hudi的数据写入机制，包括各种写入操作类型、批量处理、流式处理和性能优化策略。
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
stability: slow-changing
status: maintenance
access_tier: free
updated: 2026-10-10
---


# ✍️ Apache Hudi数据写入详解

## 📚 学习目标

通过本章节的学习，你将能够：
- **掌握Hudi的各种写入操作类型**和适用场景
- **理解批量写入和流式写入**的区别和配置
- **学会分区策略设计**和数据组织优化
- **掌握写入性能调优**的关键技巧
- **处理复杂的数据写入场景**

> [!tip] 💡 学习建议
> 数据写入是Hudi的核心功能，涉及很多细节配置。**不要试图一次性掌握所有内容**，先理解基本概念，然后在实践中逐步掌握高级特性。就像学习开车一样，先学会基本操作，再逐步提高驾驶技巧。

## 🎯 写入操作类型

> [!info] ✍️ Hudi写入操作类型理解
> **类比理解**：Hudi的写入操作就像管理一个智能档案室的不同工作方式：
> - **Insert**：像初次建档，直接添加新档案，不检查是否重复
> - **Upsert**：像智能更新档案，如果档案存在就更新，不存在就新建
> - **Delete**：像档案销毁，根据编号找到并删除指定档案
> - **Bulk Insert**：像批量建档，一次性处理大量新档案，效率更高
> 
> **专业表述**：Hudi提供多种写入操作类型以适应不同的数据处理场景。Insert用于新数据插入，Upsert实现插入或更新语义，Delete支持数据删除，Bulk Insert针对大批量初始数据加载进行了优化。每种操作类型都有特定的配置参数和性能特征。

### 1. Insert操作

> [!info] 📥 Insert操作理解
> **类比理解**：Insert操作就像往空白档案柜里放入新档案，不会检查是否已有相同编号的档案，直接放入指定位置。适合首次建立数据表或确定没有重复数据的场景。
> 
> **专业表述**：Insert操作直接将新数据写入Hudi表，不执行重复性检查。操作类型设置为"insert"，适用于初次数据加载或确保数据唯一性的批量导入场景。

#### 基本用法

```python
from pyspark.sql import SparkSession
from pyspark.sql.functions import current_timestamp, lit

def create_spark_session():
    spark = SparkSession.builder \
        .appName("HudiInsertExample") \
        .config("spark.jars", "/opt/hudi/hudi-spark3.4-bundle_2.12-0.14.0.jar") \
        .config("spark.serializer", "org.apache.spark.serializer.KryoSerializer") \
        .config("spark.sql.extensions", "org.apache.spark.sql.hudi.HoodieSparkSessionExtension") \
        .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.hudi.catalog.HoodieCatalog") \
        .config("spark.kryo.registrator", "org.apache.spark.HoodieSparkKryoRegistrar") \
        .getOrCreate()
    return spark

def insert_data_example():
    spark = create_spark_session()
    
 # 创建初始数据
    data = [
        {"id": 1, "name": "张三", "age": 25, "city": "北京", "salary": 15000},
        {"id": 2, "name": "李四", "age": 30, "city": "上海", "salary": 18000},
        {"id": 3, "name": "王五", "age": 28, "city": "广州", "salary": 16000}
    ]
    
    df = spark.createDataFrame(data)
    df = df.withColumn("ts", current_timestamp())
    
 # Insert操作配置
    insert_options = {
        "hoodie.table.name": "employee_table",
        "hoodie.datasource.write.table.name": "employee_table",
        "hoodie.datasource.write.table.type": "COPY_ON_WRITE",
        "hoodie.datasource.write.recordkey.field": "id",
        "hoodie.datasource.write.precombine.field": "ts",
        "hoodie.datasource.write.partitionpath.field": "city",
        "hoodie.datasource.write.operation": "insert",  # 指定插入操作
        "hoodie.insert.shuffle.parallelism": "4"
    }
    
 # 执行插入
    df.write \
        .format("hudi") \
        .options(**insert_options) \
        .mode("overwrite") \
        .save("/path/to/hudi/table")
    
    print("✅ Insert操作完成")
    spark.stop()
```

#### 批量插入优化

```python
def bulk_insert_example():
    """批量插入示例"""
    spark = create_spark_session()
    
 # 生成大量数据
    import random
    large_data = []
    for i in range(1, 10001):  # 生成1万条数据
        large_data.append({
            "id": i,
            "name": f"用户{i}",
            "age": random.randint(20, 60),
            "city": random.choice(["北京", "上海", "广州", "深圳"]),
            "salary": random.randint(5000, 30000)
        })
    
    df = spark.createDataFrame(large_data)
    df = df.withColumn("ts", current_timestamp())
    
 # 批量插入配置
    bulk_insert_options = {
        "hoodie.table.name": "large_employee_table",
        "hoodie.datasource.write.table.name": "large_employee_table",
        "hoodie.datasource.write.table.type": "COPY_ON_WRITE",
        "hoodie.datasource.write.recordkey.field": "id",
        "hoodie.datasource.write.precombine.field": "ts",
        "hoodie.datasource.write.partitionpath.field": "city",
        "hoodie.datasource.write.operation": "bulk_insert",  # 批量插入
        "hoodie.bulkinsert.shuffle.parallelism": "10",
        "hoodie.bulkinsert.sort.columns": "id",  # 排序字段
        "hoodie.datasource.write.row.writer.enable": "true"  # 启用行写入器
    }
    
 # 执行批量插入
    df.write \
        .format("hudi") \
        .options(**bulk_insert_options) \
        .mode("overwrite") \
        .save("/path/to/hudi/large_table")
    
    print("✅ 批量插入完成")
    spark.stop()
```

### 2. Upsert操作

> [!info] 🔄 Upsert操作理解
> **类比理解**：Upsert操作就像智能档案管理系统的自动处理功能：当你提交一份档案时，系统会自动检查档案编号是否已存在。如果存在，就用新信息更新旧档案（Update）；如果不存在，就创建新档案（Insert）。这是一个"有则更新，无则插入"的智能操作。
> 
> **专业表述**：Upsert（Update + Insert）是Hudi的核心操作，通过主键字段识别记录是否存在。对于存在的记录，使用precombine字段（通常是时间戳）进行版本比较后更新；对于不存在的记录，直接插入。这是实时数据处理场景中最常用的操作类型。

#### 基本用法

```python
def upsert_example():
    """Upsert操作示例"""
    spark = create_spark_session()
    
 # 准备更新数据
    update_data = [
        {"id": 1, "name": "张三", "age": 26, "city": "北京", "salary": 16000},  # 更新现有记录
        {"id": 4, "name": "赵六", "age": 32, "city": "深圳", "salary": 20000}   # 插入新记录
    ]
    
    df = spark.createDataFrame(update_data)
    df = df.withColumn("ts", current_timestamp())
    
 # Upsert操作配置
    upsert_options = {
        "hoodie.table.name": "employee_table",
        "hoodie.datasource.write.table.name": "employee_table",
        "hoodie.datasource.write.table.type": "COPY_ON_WRITE",
        "hoodie.datasource.write.recordkey.field": "id",
        "hoodie.datasource.write.precombine.field": "ts",
        "hoodie.datasource.write.partitionpath.field": "city",
        "hoodie.datasource.write.operation": "upsert",  # Upsert操作
        "hoodie.upsert.shuffle.parallelism": "4",
        "hoodie.index.type": "BLOOM"  # 使用布隆过滤器索引
    }
    
 # 执行Upsert
    df.write \
        .format("hudi") \
        .options(**upsert_options) \
        .mode("append") \
        .save("/path/to/hudi/table")
    
    print("✅ Upsert操作完成")
    spark.stop()
```

#### 高级Upsert配置

```python
def advanced_upsert_example():
    """高级Upsert配置示例"""
    spark = create_spark_session()
    
 # 模拟实时数据更新
    streaming_data = [
        {"id": 1, "name": "张三", "age": 27, "city": "北京", "salary": 17000, "update_reason": "晋升"},
        {"id": 2, "name": "李四", "age": 31, "city": "上海", "salary": 19000, "update_reason": "调薪"},
        {"id": 5, "name": "孙七", "age": 29, "city": "杭州", "salary": 15000, "update_reason": "入职"}
    ]
    
    df = spark.createDataFrame(streaming_data)
    df = df.withColumn("ts", current_timestamp())
    
 # 高级Upsert配置
    advanced_upsert_options = {
        "hoodie.table.name": "employee_mor_table",
        "hoodie.datasource.write.table.name": "employee_mor_table",
        "hoodie.datasource.write.table.type": "MERGE_ON_READ",  # 使用MoR类型
        "hoodie.datasource.write.recordkey.field": "id",
        "hoodie.datasource.write.precombine.field": "ts",
        "hoodie.datasource.write.partitionpath.field": "city",
        "hoodie.datasource.write.operation": "upsert",
        
 # 性能优化配置
        "hoodie.upsert.shuffle.parallelism": "8",
        "hoodie.index.type": "BLOOM",
        "hoodie.bloom.index.parallelism": "4",
        
 # 压缩配置
        "hoodie.compact.inline": "false",
        "hoodie.compact.inline.max.delta.commits": "3",
        
 # 内存配置
        "hoodie.memory.merge.max.size": "1073741824",  # 1GB
        "hoodie.memory.spillable.map.path": "/tmp/hudi-spillable-map",
        
 # 文件大小配置
        "hoodie.parquet.max.file.size": "134217728",  # 128MB
        "hoodie.parquet.small.file.limit": "104857600"  # 100MB
    }
    
 # 执行高级Upsert
    df.write \
        .format("hudi") \
        .options(**advanced_upsert_options) \
        .mode("append") \
        .save("/path/to/hudi/employee_mor_table")
    
    print("✅ 高级Upsert操作完成")
    spark.stop()
```

### 3. Delete操作

> [!info] 🗑️ Delete操作理解
> **类比理解**：Delete操作就像档案室的销毁处理：
> - **软删除**：像在档案上贴"已作废"标签，档案仍在；使用业务删除标记时，需要查询显式过滤
> - **硬删除**：像从当前有效档案目录中移除档案；历史文件是否仍保留，取决于表服务与保留策略
> 
> **专业表述**：Hudi支持软删除和硬删除。软删除可通过将非键业务字段置空，或维护业务删除标记并在查询中显式过滤来实现。设置"_hoodie_is_deleted"为true配合支持该标记的payload，或使用"delete"操作，均可实现硬删除，使记录不再出现在当前快照中；历史文件与日志的物理清理及空间回收取决于表类型、表服务和保留策略，并非写入删除后立即完成。

#### 使用删除标记的硬删除示例

```python
def soft_delete_example():
    """使用删除标记的硬删除示例；保留原函数名便于对照"""
    spark = create_spark_session()
    
 # 创建删除标记数据
    delete_data = [
        {"id": 2, "name": "李四", "age": 31, "city": "上海", "salary": 19000, "_hoodie_is_deleted": True},
        {"id": 3, "name": "王五", "age": 28, "city": "广州", "salary": 16000, "_hoodie_is_deleted": True}
    ]
    
    df = spark.createDataFrame(delete_data)
    df = df.withColumn("ts", current_timestamp())
    
 # 使用删除标记的硬删除配置
    delete_options = {
        "hoodie.table.name": "employee_table",
        "hoodie.datasource.write.table.name": "employee_table",
        "hoodie.datasource.write.table.type": "COPY_ON_WRITE",
        "hoodie.datasource.write.recordkey.field": "id",
        "hoodie.datasource.write.precombine.field": "ts",
        "hoodie.datasource.write.partitionpath.field": "city",
        "hoodie.datasource.write.operation": "upsert",  # 配合_hoodie_is_deleted标记进行硬删除
        "hoodie.datasource.write.payload.class": "org.apache.hudi.common.model.DefaultHoodieRecordPayload"
    }
    
 # 执行基于删除标记的硬删除
    df.write \
        .format("hudi") \
        .options(**delete_options) \
        .mode("append") \
        .save("/path/to/hudi/table")
    
    print("✅ 删除标记硬删除操作完成")
    spark.stop()
```

#### 硬删除示例

```python
def hard_delete_example():
    """硬删除示例"""
    spark = create_spark_session()
    
 # 只提供要删除的记录的主键
    delete_keys = [
        {"id": 2, "city": "上海"},  # 需要提供分区键
        {"id": 3, "city": "广州"}
    ]
    
    df = spark.createDataFrame(delete_keys)
    df = df.withColumn("ts", current_timestamp())
    
 # 硬删除配置
    hard_delete_options = {
        "hoodie.table.name": "employee_table",
        "hoodie.datasource.write.table.name": "employee_table",
        "hoodie.datasource.write.table.type": "COPY_ON_WRITE",
        "hoodie.datasource.write.recordkey.field": "id",
        "hoodie.datasource.write.precombine.field": "ts",
        "hoodie.datasource.write.partitionpath.field": "city",
        "hoodie.datasource.write.operation": "delete",  # 删除操作
        "hoodie.delete.shuffle.parallelism": "4"
    }
    
 # 执行硬删除
    df.write \
        .format("hudi") \
        .options(**hard_delete_options) \
        .mode("append") \
        .save("/path/to/hudi/table")
    
    print("✅ 硬删除操作完成")
    spark.stop()
```

## 📊 分区策略设计

> [!info] 📂 分区策略设计理解
> **类比理解**：分区策略就像规划图书馆的书架分类系统：
> - **时间分区**：按出版年月分类，方便按时间范围查找
> - **地理分区**：按地区分类，便于地域性查询
> - **业务分区**：按学科分类，符合使用习惯
> - **多级分区**：先按楼层，再按学科，然后按年份的层次分类
> 
> 好的分区策略能让查询更快（直接到对应书架），写入更均衡（避免某个书架过满）。
> 
> **专业表述**：分区策略是Hudi性能优化的关键，通过partitionpath.field定义分区键。合理的分区设计可以实现查询剪裁、并行处理和数据管理优化。常见策略包括时间分区、范围分区、哈希分区和多级分区，需要平衡查询模式、数据倾斜和管理复杂度。

### 1. 基本分区策略

```python
def partition_strategy_example():
    """分区策略示例"""
    spark = create_spark_session()
    
 # 时间分区数据
    time_partitioned_data = [
        {"id": 1, "name": "订单1", "amount": 100, "date": "2024-01-01", "hour": "10"},
        {"id": 2, "name": "订单2", "amount": 200, "date": "2024-01-01", "hour": "11"},
        {"id": 3, "name": "订单3", "amount": 150, "date": "2024-01-02", "hour": "09"}
    ]
    
    df = spark.createDataFrame(time_partitioned_data)
    df = df.withColumn("ts", current_timestamp())
    
 # 时间分区配置
    time_partition_options = {
        "hoodie.table.name": "order_table",
        "hoodie.datasource.write.table.name": "order_table",
        "hoodie.datasource.write.table.type": "COPY_ON_WRITE",
        "hoodie.datasource.write.recordkey.field": "id",
        "hoodie.datasource.write.precombine.field": "ts",
        "hoodie.datasource.write.partitionpath.field": "date",  # 按日期分区
        "hoodie.datasource.write.operation": "upsert",
        "hoodie.datasource.write.keygenerator.class": "org.apache.hudi.keygen.SimpleKeyGenerator"
    }
    
 # 写入时间分区表
    df.write \
        .format("hudi") \
        .options(**time_partition_options) \
        .mode("overwrite") \
        .save("/path/to/hudi/order_table")
    
    print("✅ 时间分区表创建完成")
    spark.stop()
```

### 2. 多级分区策略

```python
def multi_level_partition_example():
    """多级分区策略示例"""
    spark = create_spark_session()
    
 # 多级分区数据
    multi_level_data = [
        {"id": 1, "product": "手机", "category": "电子", "region": "华北", "date": "2024-01-01"},
        {"id": 2, "product": "电脑", "category": "电子", "region": "华东", "date": "2024-01-01"},
        {"id": 3, "product": "书籍", "category": "文教", "region": "华南", "date": "2024-01-02"}
    ]
    
    df = spark.createDataFrame(multi_level_data)
    df = df.withColumn("ts", current_timestamp())
    
 # 多级分区配置
    multi_partition_options = {
        "hoodie.table.name": "product_table",
        "hoodie.datasource.write.table.name": "product_table",
        "hoodie.datasource.write.table.type": "COPY_ON_WRITE",
        "hoodie.datasource.write.recordkey.field": "id",
        "hoodie.datasource.write.precombine.field": "ts",
        "hoodie.datasource.write.partitionpath.field": "category,region",  # 多级分区
        "hoodie.datasource.write.operation": "upsert",
        "hoodie.datasource.write.keygenerator.class": "org.apache.hudi.keygen.ComplexKeyGenerator"
    }
    
 # 写入多级分区表
    df.write \
        .format("hudi") \
        .options(**multi_partition_options) \
        .mode("overwrite") \
        .save("/path/to/hudi/product_table")
    
    print("✅ 多级分区表创建完成")
    spark.stop()
```

### 3. 自定义分区策略

```python
def custom_partition_example():
    """自定义分区策略示例"""
    spark = create_spark_session()
    
 # 需要自定义分区的数据
    custom_data = [
        {"id": 1, "user_id": 10001, "action": "login", "timestamp": 1640995200},
        {"id": 2, "user_id": 10002, "action": "purchase", "timestamp": 1640995300},
        {"id": 3, "user_id": 20001, "action": "view", "timestamp": 1640995400}
    ]
    
    df = spark.createDataFrame(custom_data)
    df = df.withColumn("ts", current_timestamp())
    
 # 添加自定义分区字段
    from pyspark.sql.functions import col, when
    df = df.withColumn("user_segment", 
                       when(col("user_id") < 20000, "segment_a")
                       .otherwise("segment_b"))
    
 # 自定义分区配置
    custom_partition_options = {
        "hoodie.table.name": "user_action_table",
        "hoodie.datasource.write.table.name": "user_action_table",
        "hoodie.datasource.write.table.type": "MERGE_ON_READ",
        "hoodie.datasource.write.recordkey.field": "id",
        "hoodie.datasource.write.precombine.field": "ts",
        "hoodie.datasource.write.partitionpath.field": "user_segment",
        "hoodie.datasource.write.operation": "upsert",
        "hoodie.datasource.write.keygenerator.class": "org.apache.hudi.keygen.SimpleKeyGenerator"
    }
    
 # 写入自定义分区表
    df.write \
        .format("hudi") \
        .options(**custom_partition_options) \
        .mode("overwrite") \
        .save("/path/to/hudi/user_action_table")
    
    print("✅ 自定义分区表创建完成")
    spark.stop()
```

## 🚀 流式写入

### 1. 结构化流式写入

```python
def structured_streaming_example():
    """结构化流式写入示例"""
    spark = create_spark_session()
    
 # 设置流式数据源（这里用rate source模拟）
    streaming_df = spark \
        .readStream \
        .format("rate") \
        .option("rowsPerSecond", 10) \
        .load()
    
 # 转换数据格式
    from pyspark.sql.functions import col, rand, when, current_timestamp
    
    processed_df = streaming_df \
        .withColumn("id", col("value")) \
        .withColumn("name", col("value").cast("string")) \
        .withColumn("age", (rand() * 40 + 20).cast("int")) \
        .withColumn("city", when(col("value") % 4 == 0, "北京")
                           .when(col("value") % 4 == 1, "上海")
                           .when(col("value") % 4 == 2, "广州")
                           .otherwise("深圳")) \
        .withColumn("salary", (rand() * 20000 + 10000).cast("int")) \
        .withColumn("ts", current_timestamp()) \
        .drop("timestamp", "value")
    
 # 流式写入配置
    streaming_options = {
        "hoodie.table.name": "streaming_employee_table",
        "hoodie.datasource.write.table.name": "streaming_employee_table",
        "hoodie.datasource.write.table.type": "MERGE_ON_READ",
        "hoodie.datasource.write.recordkey.field": "id",
        "hoodie.datasource.write.precombine.field": "ts",
        "hoodie.datasource.write.partitionpath.field": "city",
        "hoodie.datasource.write.operation": "upsert",
        
 # 流式写入特殊配置
        "hoodie.datasource.write.streaming.ignore.failed.batch": "false",  # 不忽略失败批次，失败后需排查并恢复
        "hoodie.datasource.write.streaming.retry.count": "3",
        "hoodie.datasource.write.streaming.retry.interval.ms": "2000",
        
 # 检查点配置
        "checkpointLocation": "/path/to/checkpoint"
    }
    
 # 启动流式写入
    streaming_query = processed_df \
        .writeStream \
        .format("hudi") \
        .options(**streaming_options) \
        .trigger(processingTime="10 seconds") \
        .start("/path/to/hudi/streaming_table")
    
    print("✅ 流式写入已启动")
    
 # 运行一段时间后停止
    streaming_query.awaitTermination(timeout=60)
    streaming_query.stop()
    
    print("✅ 流式写入已停止")
    spark.stop()
```

### 2. Kafka流式写入

```python
def kafka_streaming_example():
    """Kafka流式写入示例"""
    spark = create_spark_session()
    
 # 从Kafka读取数据
    kafka_df = spark \
        .readStream \
        .format("kafka") \
        .option("kafka.bootstrap.servers", "localhost:9092") \
        .option("subscribe", "user_events") \
        .option("startingOffsets", "latest") \
        .load()
    
 # 解析Kafka消息
    from pyspark.sql.functions import from_json, col
    from pyspark.sql.types import StructType, StructField, StringType, IntegerType, TimestampType
    
 # 定义JSON schema
    json_schema = StructType([
        StructField("user_id", IntegerType(), True),
        StructField("action", StringType(), True),
        StructField("product_id", IntegerType(), True),
        StructField("timestamp", TimestampType(), True)
    ])
    
 # 解析JSON数据
    parsed_df = kafka_df \
        .select(from_json(col("value").cast("string"), json_schema).alias("data")) \
        .select("data.*") \
        .withColumn("partition_key", col("user_id") % 10)
    
 # Kafka流式写入配置
    kafka_streaming_options = {
        "hoodie.table.name": "kafka_user_events",
        "hoodie.datasource.write.table.name": "kafka_user_events",
        "hoodie.datasource.write.table.type": "MERGE_ON_READ",
        "hoodie.datasource.write.recordkey.field": "user_id,timestamp",
        "hoodie.datasource.write.keygenerator.class": "org.apache.hudi.keygen.ComplexKeyGenerator",
        "hoodie.datasource.write.precombine.field": "timestamp",
        "hoodie.datasource.write.partitionpath.field": "partition_key",
        "hoodie.datasource.write.operation": "upsert",
        
 # 流式优化配置
        "hoodie.compact.inline": "false",
        "hoodie.compact.inline.max.delta.commits": "10",
        "hoodie.clean.automatic": "false",
        
 # 检查点配置
        "checkpointLocation": "/path/to/kafka_checkpoint"
    }
    
 # 启动Kafka流式写入
    kafka_query = parsed_df \
        .writeStream \
        .format("hudi") \
        .options(**kafka_streaming_options) \
        .trigger(processingTime="30 seconds") \
        .start("/path/to/hudi/kafka_events")
    
    print("✅ Kafka流式写入已启动")
    
 # 运行并监控
    kafka_query.awaitTermination()
    spark.stop()
```

## ⚡ 性能优化

### 1. 并行度优化

```python
def parallelism_optimization_example():
    """并行度优化示例"""
    spark = create_spark_session()
    
 # 大数据量示例
    large_data = []
    for i in range(100000):
        large_data.append({
            "id": i,
            "data": f"data_{i}",
            "partition": i % 100
        })
    
    df = spark.createDataFrame(large_data)
    df = df.withColumn("ts", current_timestamp())
    
 # 并行度优化配置
    parallelism_options = {
        "hoodie.table.name": "large_table",
        "hoodie.datasource.write.table.name": "large_table",
        "hoodie.datasource.write.table.type": "COPY_ON_WRITE",
        "hoodie.datasource.write.recordkey.field": "id",
        "hoodie.datasource.write.precombine.field": "ts",
        "hoodie.datasource.write.partitionpath.field": "partition",
        "hoodie.datasource.write.operation": "bulk_insert",
        
 # 并行度配置
        "hoodie.bulkinsert.shuffle.parallelism": "50",  # 根据数据量调整
        "hoodie.insert.shuffle.parallelism": "50",
        "hoodie.upsert.shuffle.parallelism": "50",
        "hoodie.delete.shuffle.parallelism": "50",
        
 # 索引并行度
        "hoodie.bloom.index.parallelism": "20",
        
 # 文件大小配置
        "hoodie.parquet.max.file.size": "134217728",  # 128MB
        "hoodie.parquet.small.file.limit": "104857600",  # 100MB
        
 # 写入器配置
        "hoodie.datasource.write.row.writer.enable": "true"
    }
    
 # 执行优化写入
    df.write \
        .format("hudi") \
        .options(**parallelism_options) \
        .mode("overwrite") \
        .save("/path/to/hudi/large_table")
    
    print("✅ 并行度优化写入完成")
    spark.stop()
```

### 2. 内存优化

```python
def memory_optimization_example():
    """内存优化示例"""
    spark = create_spark_session()
    
 # 内存优化配置
    memory_options = {
        "hoodie.table.name": "memory_optimized_table",
        "hoodie.datasource.write.table.name": "memory_optimized_table",
        "hoodie.datasource.write.table.type": "MERGE_ON_READ",
        "hoodie.datasource.write.recordkey.field": "id",
        "hoodie.datasource.write.precombine.field": "ts",
        "hoodie.datasource.write.partitionpath.field": "partition",
        "hoodie.datasource.write.operation": "upsert",
        
 # 内存配置
        "hoodie.memory.merge.max.size": "2147483648",  # 2GB
        "hoodie.memory.spillable.map.path": "/tmp/hudi-spillable-map",
        "hoodie.memory.compaction.max.size": "1073741824",  # 1GB
        
 # 缓存配置
        "hoodie.index.bloom.use.caching": "true",
        "hoodie.metadata.enable": "true",
        "hoodie.metadata.cache.enable": "true",
        
 # 压缩配置
        "hoodie.parquet.compression.codec": "snappy",
        "hoodie.parquet.page.size": "1048576",  # 1MB
        "hoodie.parquet.dictionary.page.size": "1048576"  # 1MB
    }
    
 # 模拟数据写入
    data = [{"id": i, "data": f"data_{i}", "partition": i % 10} for i in range(10000)]
    df = spark.createDataFrame(data)
    df = df.withColumn("ts", current_timestamp())
    
 # 执行内存优化写入
    df.write \
        .format("hudi") \
        .options(**memory_options) \
        .mode("overwrite") \
        .save("/path/to/hudi/memory_optimized_table")
    
    print("✅ 内存优化写入完成")
    spark.stop()
```

## 🎯 小结

通过本章节的学习，我们深入了解了：

1. **Hudi的各种写入操作**：Insert、Upsert、Delete及其适用场景
2. **分区策略设计**：单级分区、多级分区和自定义分区
3. **流式写入**：结构化流处理和Kafka集成
4. **性能优化**：并行度调优、内存优化和配置调优

> [!abstract] 📚 下一步学习
> 掌握了数据写入的各种技巧后，接下来我们将学习[[【技术与工具】/Hudi/06-Hudi数据查询操作|Hudi数据查询操作]]，了解如何高效地查询和分析Hudi表中的数据。

## 🔗 相关资源

- [[【技术与工具】/Hudi/04-第一个Hudi应用|第一个Hudi]] - 回顾基础操作
- [[【技术与工具】/Hudi/02-Hudi架构与核心特性|Hudi架构与核心特性]] - 理解写入原理
- [[【技术与工具】/Hudi/00-Hudi学习路线图|Hudi]] - 返回学习路线图

---

> 💡 **记住**：数据写入是Hudi的核心功能，**掌握好写入操作是使用Hudi的关键**。不同的写入操作适用于不同的场景，选择合适的操作类型和配置参数，可以显著提升系统性能。在实际项目中，建议根据具体的业务需求进行配置调优。