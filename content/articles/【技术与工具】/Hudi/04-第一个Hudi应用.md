---
title: 第一个Hudi应用
tags:
  - Hudi
  - 入门
  - 实践
  - Spark
  - 数据操作
difficulty: 中级
duration: 25分钟
description: 通过创建第一个Hudi应用，掌握基本的数据写入和查询操作，为后续深入学习打下基础。
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据分析师
  - BI分析师
stability: slow-changing
status: maintenance
access_tier: free
updated: 2026-10-10
---


# 🚀 第一个Hudi应用

## 📚 学习目标

通过本章节的学习，你将能够：
- **创建第一个Hudi表**并理解基本配置
- **掌握数据写入操作**，包括插入和更新
- **学会查询Hudi表**中的数据
- **理解Hudi的基本工作流程**
- **验证数据的正确性**和一致性

> [!tip] 💡 学习建议
> 这是你第一次真正接触Hudi的实际操作，**不要急于求成**。就像学习骑自行车一样，先掌握基本动作，然后逐步提高。每个步骤都要亲自动手实践，理解每个配置的作用。

## 🎯 项目准备

### 1. 创建项目结构

> [!info] 📁 项目结构理解
> **类比理解**：创建Hudi项目就像准备一个整理有序的工作台：src文件夹是你的工具箱（存放代码），data文件夹是原料仓库（存放数据文件），logs文件夹是工作日志本（记录运行情况），conf文件夹是说明书柜（存放各种配置）。
> 
> **专业表述**：规范的项目目录结构有助于代码组织和维护。src目录存放源代码，data目录存放数据文件，logs目录存放日志文件，conf目录存放配置文件，这样的结构符合软件工程最佳实践。

```bash
# 创建项目目录
mkdir -p ~/hudi-demo
cd ~/hudi-demo

# 创建目录结构
mkdir -p {src,data,logs,conf}

# 验证目录结构
tree . || ls -la
```

### 2. 准备测试数据

> [!info] 📊 测试数据设计理解
> **类比理解**：准备测试数据就像为餐厅试菜准备样品：我们需要不同种类的菜品（多样化的数据字段），不同的分量（不同的数据量），还要考虑客人的喜好（业务场景需求）。员工表包含了ID、姓名、年龄等基本信息，就像菜品的基本属性一样。
> 
> **专业表述**：测试数据应该具备代表性和多样性，包含主键字段（emp_id）、普通字段（name、age、salary）、分区字段（city）和时间戳字段（ts），这样可以全面测试Hudi的各种功能特性，包括主键去重、分区管理和时间序列查询。

```python
# 创建测试数据文件 - generate_test_data.py
import json
import random
from datetime import datetime, timedelta

def generate_test_data():
    """生成测试数据"""
    cities = ["北京", "上海", "广州", "深圳", "杭州", "南京", "成都", "武汉"]
    departments = ["技术部", "销售部", "市场部", "人事部", "财务部"]
    
    employees = []
    for i in range(1, 51):  # 生成50个员工
        emp = {
            "emp_id": i,
            "name": f"员工{i:02d}",
            "age": random.randint(22, 55),
            "department": random.choice(departments),
            "city": random.choice(cities),
            "salary": random.randint(5000, 25000),
            "hire_date": (datetime.now() - timedelta(days=random.randint(0, 1000))).strftime("%Y-%m-%d"),
            "ts": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        employees.append(emp)
    
    return employees

# 生成数据并保存
if __name__ == "__main__":
    data = generate_test_data()
    with open("data/employees.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 生成了{len(data)}条测试数据")
```

运行数据生成脚本：
```bash
python generate_test_data.py
```

## 🔧 第一个Hudi应用

### 1. 第一个Hudi应用代码

> [!info] 🚀 Hudi应用开发理解
> **类比理解**：开发Hudi应用就像建造一个智能仓库管理系统：首先要连接电源（创建Spark会话），然后导入货物（加载数据），建立仓库（创建Hudi表），最后验证货物是否正确存放（读取和查询数据）。每个步骤都有特定的配置，就像仓库的各种管理规则。
> 
> **专业表述**：Hudi应用开发遵循标准的ETL模式：Extract（数据提取）、Transform（数据转换）、Load（数据加载）。通过Spark作为计算引擎，配置Hudi特定的参数（表类型、主键、分区键、索引类型等），实现数据的高效写入、查询和管理。

创建完整的Hudi应用文件 `src/first_hudi_app.py`：

```python
# 创建主程序文件 - first_hudi_app.py
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, lit, current_timestamp
from pyspark.sql.types import *
import json

def create_spark_session():
    """创建Spark会话"""
    spark = SparkSession.builder \
        .appName("FirstHudiApp") \
        .config("spark.jars", "/opt/hudi/hudi-spark3.4-bundle_2.12-0.14.0.jar") \
        .config("spark.serializer", "org.apache.spark.serializer.KryoSerializer") \
        .config("spark.sql.extensions", "org.apache.spark.sql.hudi.HoodieSparkSessionExtension") \
        .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.hudi.catalog.HoodieCatalog") \
        .config("spark.kryo.registrator", "org.apache.spark.HoodieSparkKryoRegistrar") \
        .getOrCreate()
    
 # 设置日志级别
    spark.sparkContext.setLogLevel("WARN")
    return spark

def load_test_data(spark):
    """加载测试数据"""
 # 读取JSON文件
    with open("data/employees.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    
 # 创建DataFrame
    df = spark.createDataFrame(data)
    
 # 添加时间戳字段
    df = df.withColumn("ts", current_timestamp())
    
    print("📊 测试数据预览:")
    df.show(5)
    df.printSchema()
    
    return df

def create_hudi_table(spark, df):
    """创建第一个Hudi表"""
    print("🔧 创建Hudi表...")
    
 # Hudi表配置
    hudi_options = {
 # 表基本信息
        "hoodie.table.name": "employee_table",
        "hoodie.datasource.write.table.name": "employee_table",
        "hoodie.datasource.write.table.type": "COPY_ON_WRITE",
        
 # 主键配置
        "hoodie.datasource.write.recordkey.field": "emp_id",
        "hoodie.datasource.write.precombine.field": "ts",
        
 # 分区配置
        "hoodie.datasource.write.partitionpath.field": "city",
        
 # 操作类型
        "hoodie.datasource.write.operation": "insert",
        
 # 索引配置
        "hoodie.index.type": "BLOOM",
        "hoodie.bloom.index.parallelism": "4",
        
 # 并行度配置
        "hoodie.insert.shuffle.parallelism": "4",
        "hoodie.upsert.shuffle.parallelism": "4"
    }
```

> [!info] ⚙️ Hudi配置参数理解
> **类比理解**：Hudi的配置参数就像建立图书馆的规章制度：
> - **table.name**：图书馆名称（employee_table）
> - **table.type**：管理方式（COPY_ON_WRITE像每次更新都重新整理书架）
> - **recordkey.field**：图书唯一编号（emp_id作为员工唯一标识）
> - **precombine.field**：版本判断依据（ts时间戳决定哪个版本更新）
> - **partitionpath.field**：分区存放规则（按city城市分不同区域存放）
> - **index.type**：查找索引类型（BLOOM像书籍快速检索卡片）
> 
> **专业表述**：Hudi配置参数定义了表的存储结构和操作行为。table.type决定存储模式，recordkey.field指定记录键字段，precombine.field指定版本比较字段，partitionpath.field定义分区策略，index.type选择写入时定位已有记录的索引机制。本例使用普通BLOOM索引，不能将emp_id视为自动获得跨分区唯一性保证的数据库主键，也不能把该索引等同于查询加速索引。

```python
 # 写入数据
    df.write \
        .format("hudi") \
        .options(**hudi_options) \
        .mode("overwrite") \
        .save("data/hudi_table/employee_table")
    
    print("✅ Hudi表创建成功!")
    return hudi_options

def read_hudi_table(spark, table_path):
    """读取Hudi表"""
    print("📖 读取Hudi表...")
    
 # 读取数据
    df = spark.read \
        .format("hudi") \
        .load(table_path)
    
    print(f"📊 表中共有 {df.count()} 条记录")
    print("前10条记录:")
    df.show(10)
    
    return df

def main():
    """主函数"""
    print("🚀 第一个Hudi应用开始运行...")
    
 # 1. 创建Spark会话
    spark = create_spark_session()
    
    try:
 # 2. 加载测试数据
        df = load_test_data(spark)
        
 # 3. 创建Hudi表
        hudi_options = create_hudi_table(spark, df)
        
 # 4. 读取并验证数据
        result_df = read_hudi_table(spark, "data/hudi_table/employee_table")
        
 # 5. 简单的数据分析
        print("📈 数据分析:")
        print("按城市统计员工数量:")
        result_df.groupBy("city").count().orderBy("count", ascending=False).show()
        
        print("按部门统计平均薪资:")
        result_df.groupBy("department").avg("salary").orderBy("avg(salary)", ascending=False).show()
        
        print("✅ 第一个Hudi应用运行成功!")
        
    except Exception as e:
        print(f"❌ 程序运行出错: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
 # 关闭Spark会话
        spark.stop()

if __name__ == "__main__":
    main()
```

### 2. 运行第一个应用

```bash
# 在~/hudi-demo项目根目录运行应用
python src/first_hudi_app.py
```

预期输出：
```text
🚀 第一个Hudi应用开始运行...
📊 测试数据预览:
+------+------+---+--------+----+------+----------+--------------------+
|emp_id|  name|age|department|city|salary| hire_date|                  ts|
+------+------+---+--------+----+------+----------+--------------------+
|     1|员工01| 35|    技术部|北京| 15000|2023-05-15|2024-12-02 10:30:45|
|     2|员工02| 28|    销售部|上海| 12000|2023-08-20|2024-12-02 10:30:45|
...
✅ Hudi表创建成功!
📖 读取Hudi表...
📊 表中共有 50 条记录
...
✅ 第一个Hudi应用运行成功!
```

## 🔄 数据更新操作

> [!info] 🔄 Hudi UPSERT操作理解
> **类比理解**：Hudi的UPSERT操作就像智能的图书管理：如果图书馆已经有某本书（相同ID），就更新这本书的信息（比如新版本、新位置）；如果没有这本书，就添加新书到合适的书架上。这个过程是自动的，不需要管理员手动查找和判断。
> 
> **专业表述**：UPSERT（Update + Insert）是Hudi的核心功能，通过主键（recordkey.field）识别记录是否存在：如果存在则更新，不存在则插入。操作类型设置为"upsert"，模式设置为"append"，Hudi会自动处理数据的版本控制和存储优化。

### 1. 数据更新示例

```python
# 创建数据更新脚本 - update_data.py
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, lit, current_timestamp
import json

def create_spark_session():
    """创建Spark会话"""
    spark = SparkSession.builder \
        .appName("HudiUpdateApp") \
        .config("spark.jars", "/opt/hudi/hudi-spark3.4-bundle_2.12-0.14.0.jar") \
        .config("spark.serializer", "org.apache.spark.serializer.KryoSerializer") \
        .config("spark.sql.extensions", "org.apache.spark.sql.hudi.HoodieSparkSessionExtension") \
        .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.hudi.catalog.HoodieCatalog") \
        .config("spark.kryo.registrator", "org.apache.spark.HoodieSparkKryoRegistrar") \
        .getOrCreate()
    
    spark.sparkContext.setLogLevel("WARN")
    return spark

def generate_update_data(spark):
    """生成更新数据"""
    updates = [
        {"emp_id": 1, "name": "员工01", "age": 36, "department": "技术部", "city": "北京", "salary": 18000, "hire_date": "2023-05-15"},
        {"emp_id": 2, "name": "员工02", "age": 29, "department": "销售部", "city": "上海", "salary": 13000, "hire_date": "2023-08-20"},
        {"emp_id": 51, "name": "新员工51", "age": 25, "department": "技术部", "city": "深圳", "salary": 14000, "hire_date": "2024-01-01"},
        {"emp_id": 52, "name": "新员工52", "age": 27, "department": "市场部", "city": "杭州", "salary": 12000, "hire_date": "2024-01-15"}
    ]
    
    df = spark.createDataFrame(updates)
    df = df.withColumn("ts", current_timestamp())
    
    print("📊 更新数据预览:")
    df.show()
    
    return df

def update_hudi_table(spark, df):
    """更新Hudi表"""
    print("🔄 更新Hudi表...")
    
 # 更新配置
    hudi_options = {
        "hoodie.table.name": "employee_table",
        "hoodie.datasource.write.table.name": "employee_table",
        "hoodie.datasource.write.table.type": "COPY_ON_WRITE",
        "hoodie.datasource.write.recordkey.field": "emp_id",
        "hoodie.datasource.write.precombine.field": "ts",
        "hoodie.datasource.write.partitionpath.field": "city",
        "hoodie.datasource.write.operation": "upsert",  # 关键：使用upsert操作
        "hoodie.index.type": "BLOOM",
        "hoodie.upsert.shuffle.parallelism": "4"
    }
    
 # 执行更新
    df.write \
        .format("hudi") \
        .options(**hudi_options) \
        .mode("append") \
        .save("data/hudi_table/employee_table")
    
    print("✅ 数据更新成功!")

def verify_updates(spark):
    """验证更新结果"""
    print("🔍 验证更新结果...")
    
 # 读取更新后的数据
    df = spark.read \
        .format("hudi") \
        .load("data/hudi_table/employee_table")
    
    print(f"📊 更新后表中共有 {df.count()} 条记录")
    
 # 查看特定员工的更新情况
    print("员工1和员工2的更新情况:")
    df.filter(col("emp_id").isin([1, 2])).show()
    
 # 查看新增员工
    print("新增员工:")
    df.filter(col("emp_id") > 50).show()
    
    return df

def main():
    """主函数"""
    print("🔄 Hudi数据更新操作开始...")
    
    spark = create_spark_session()
    
    try:
 # 1. 生成更新数据
        update_df = generate_update_data(spark)
        
 # 2. 执行更新操作
        update_hudi_table(spark, update_df)
        
 # 3. 验证更新结果
        verify_updates(spark)
        
        print("✅ 数据更新操作完成!")
        
    except Exception as e:
        print(f"❌ 更新操作出错: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        spark.stop()

if __name__ == "__main__":
    main()
```

### 2. 运行更新操作

```bash
# 运行更新脚本
python update_data.py
```

## 📊 数据查询操作

> [!info] 📊 Hudi查询操作理解
> **类比理解**：查询Hudi表就像在智能图书馆里检索信息：你可以按作者查找（groupBy）、统计不同类别的书籍数量（count）、找出价格最高的书（max）、按条件筛选（filter），还可以用复杂的检索语句（SQL）找到精确的信息。图书馆的智能系统会自动优化搜索路径，确保快速找到你要的资料。
> 
> **专业表述**：本例通过Spark读取Hudi表后，使用Spark SQL和DataFrame API进行聚合查询、条件过滤及窗口计算。这里未指定其他查询类型，按快照读取理解；其他查询模式的可见数据范围需要单独配置和验证。分区剪裁及其他查询优化是否生效取决于查询条件、版本和配置，不保证查询性能。可以通过createOrReplaceTempView注册临时视图，使用Spark SQL进行复杂查询。

### 1. 基本查询示例

```python
# 创建查询脚本 - query_data.py
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, count, avg, max, min, desc

def create_spark_session():
    """创建Spark会话"""
    spark = SparkSession.builder \
        .appName("HudiQueryApp") \
        .config("spark.jars", "/opt/hudi/hudi-spark3.4-bundle_2.12-0.14.0.jar") \
        .config("spark.serializer", "org.apache.spark.serializer.KryoSerializer") \
        .config("spark.sql.extensions", "org.apache.spark.sql.hudi.HoodieSparkSessionExtension") \
        .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.hudi.catalog.HoodieCatalog") \
        .config("spark.kryo.registrator", "org.apache.spark.HoodieSparkKryoRegistrar") \
        .getOrCreate()
    
    spark.sparkContext.setLogLevel("WARN")
    return spark

def basic_queries(spark):
    """基本查询操作"""
    print("📊 基本查询操作...")
    
 # 读取Hudi表
    df = spark.read \
        .format("hudi") \
        .load("data/hudi_table/employee_table")
    
 # 注册为临时视图
    df.createOrReplaceTempView("employees")
    
 # 1. 统计查询
    print("1. 基本统计信息:")
    df.describe("age", "salary").show()
    
 # 2. 分组统计
    print("2. 按城市统计员工数:")
    df.groupBy("city").count().orderBy(desc("count")).show()
    
 # 3. 聚合查询
    print("3. 按部门统计薪资情况:")
    df.groupBy("department") \
        .agg(
            count("*").alias("员工数"),
            avg("salary").alias("平均薪资"),
            max("salary").alias("最高薪资"),
            min("salary").alias("最低薪资")
        ) \
        .orderBy(desc("平均薪资")) \
        .show()
    
 # 4. 条件查询
    print("4. 高薪员工 (薪资 > 15000):")
    df.filter(col("salary") > 15000) \
        .select("name", "department", "city", "salary") \
        .orderBy(desc("salary")) \
        .show()
    
 # 5. SQL查询
    print("5. 使用SQL查询:")
    spark.sql("""
        SELECT department, 
               COUNT(*) as emp_count,
               AVG(salary) as avg_salary
        FROM employees 
        WHERE age > 30
        GROUP BY department
        ORDER BY avg_salary DESC
    """).show()

def advanced_queries(spark):
    """高级查询操作"""
    print("📈 高级查询操作...")
    
    df = spark.read \
        .format("hudi") \
        .load("data/hudi_table/employee_table")
    
 # 1. 窗口函数
    from pyspark.sql.window import Window
    from pyspark.sql.functions import row_number, rank, dense_rank
    
    print("1. 每个部门薪资排名:")
    window_spec = Window.partitionBy("department").orderBy(desc("salary"))
    
    df.select("name", "department", "salary") \
        .withColumn("rank", rank().over(window_spec)) \
        .withColumn("dense_rank", dense_rank().over(window_spec)) \
        .withColumn("row_number", row_number().over(window_spec)) \
        .filter(col("rank") <= 3) \
        .orderBy("department", "rank") \
        .show()
    
 # 2. 复杂条件查询
    print("2. 复杂条件查询 - 北京技术部高薪员工:")
    df.filter(
        (col("city") == "北京") & 
        (col("department") == "技术部") & 
        (col("salary") > 12000)
    ).show()

def metadata_queries(spark):
    """元数据查询"""
    print("🔍 元数据查询...")
    
 # 查看表的元数据信息
    df = spark.read \
        .format("hudi") \
        .load("data/hudi_table/employee_table")
    
    print("表结构信息:")
    df.printSchema()
    
    print("分区信息:")
    df.select("city").distinct().show()
    
 # 查看Hudi特有的元数据字段
    print("Hudi元数据字段:")
    hudi_columns = [col for col in df.columns if col.startswith("_hoodie")]
    if hudi_columns:
        df.select(hudi_columns).show(5)
    else:
        print("没有找到Hudi元数据字段")

def main():
    """主函数"""
    print("📊 Hudi数据查询操作开始...")
    
    spark = create_spark_session()
    
    try:
 # 1. 基本查询
        basic_queries(spark)
        
 # 2. 高级查询
        advanced_queries(spark)
        
 # 3. 元数据查询
        metadata_queries(spark)
        
        print("✅ 数据查询操作完成!")
        
    except Exception as e:
        print(f"❌ 查询操作出错: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        spark.stop()

if __name__ == "__main__":
    main()
```

### 2. 运行查询操作

```bash
# 运行查询脚本
python query_data.py
```

## 🔍 数据验证

### 1. 完整性验证

```python
# 创建验证脚本 - verify_data.py
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, count, isnan, when, isnull
import os

def create_spark_session():
    """创建Spark会话"""
    spark = SparkSession.builder \
        .appName("HudiVerifyApp") \
        .config("spark.jars", "/opt/hudi/hudi-spark3.4-bundle_2.12-0.14.0.jar") \
        .config("spark.serializer", "org.apache.spark.serializer.KryoSerializer") \
        .config("spark.sql.extensions", "org.apache.spark.sql.hudi.HoodieSparkSessionExtension") \
        .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.hudi.catalog.HoodieCatalog") \
        .config("spark.kryo.registrator", "org.apache.spark.HoodieSparkKryoRegistrar") \
        .getOrCreate()
    
    spark.sparkContext.setLogLevel("WARN")
    return spark

def verify_data_integrity(spark):
    """验证数据完整性"""
    print("🔍 数据完整性验证...")
    
    df = spark.read \
        .format("hudi") \
        .load("data/hudi_table/employee_table")
    
 # 1. 记录数量验证
    total_records = df.count()
    print(f"📊 总记录数: {total_records}")
    
 # 2. 主键唯一性验证
    unique_keys = df.select("emp_id").distinct().count()
    print(f"🔑 唯一主键数: {unique_keys}")
    
    if total_records == unique_keys:
        print("✅ 主键唯一性验证通过")
    else:
        print(f"❌ 主键唯一性验证失败: 总记录数({total_records}) != 唯一主键数({unique_keys})")
    
 # 3. 空值检查
    print("🔍 空值检查:")
    null_counts = df.select(*[
        count(when(col(c).isNull(), 1)).alias(c) for c in df.columns
    ]).collect()[0]
    
    for col_name, null_count in null_counts.asDict().items():
        if null_count > 0:
            print(f"  {col_name}: {null_count} 个空值")
    
 # 4. 数据范围验证
    print("📊 数据范围验证:")
    from pyspark.sql import functions as F
    age_stats = df.agg(F.min("age"), F.max("age")).collect()[0]
    salary_stats = df.agg(F.min("salary"), F.max("salary")).collect()[0]
    
    print(f"  年龄范围: {age_stats['min(age)']} - {age_stats['max(age)']}")
    print(f"  薪资范围: {salary_stats['min(salary)']} - {salary_stats['max(salary)']}")

def verify_file_structure():
    """验证文件结构"""
    print("📁 文件结构验证...")
    
    table_path = "data/hudi_table/employee_table"
    
    if os.path.exists(table_path):
        print("✅ 表目录存在")
        
 # 检查.hoodie目录
        hoodie_path = os.path.join(table_path, ".hoodie")
        if os.path.exists(hoodie_path):
            print("✅ .hoodie元数据目录存在")
            
 # 列出关键文件
            for root, dirs, files in os.walk(hoodie_path):
                for file in files:
                    if file.endswith('.commit') or file.endswith('.properties'):
                        print(f"  📄 {os.path.relpath(os.path.join(root, file), table_path)}")
        else:
            print("❌ .hoodie元数据目录不存在")
        
 # 检查分区目录
        partitions = [d for d in os.listdir(table_path) if d.startswith("city=")]
        if partitions:
            print(f"✅ 发现 {len(partitions)} 个分区:")
            for partition in partitions:
                print(f"  📂 {partition}")
        else:
            print("❌ 没有发现分区目录")
    else:
        print("❌ 表目录不存在")

def verify_operations():
    """验证操作结果"""
    print("🔄 操作结果验证...")
    
    spark = create_spark_session()
    
    try:
        df = spark.read \
            .format("hudi") \
            .load("data/hudi_table/employee_table")
        
 # 验证插入操作
        print("1. 插入操作验证:")
        initial_count = df.filter(col("emp_id") <= 50).count()
        print(f"   初始员工数: {initial_count}")
        
 # 验证更新操作
        print("2. 更新操作验证:")
        updated_emp1 = df.filter(col("emp_id") == 1).collect()
        if updated_emp1:
            emp1_salary = updated_emp1[0]['salary']
            print(f"   员工1当前薪资: {emp1_salary}")
            if emp1_salary == 18000:
                print("   ✅ 员工1薪资更新成功")
            else:
                print("   ❌ 员工1薪资更新失败")
        
 # 验证插入操作
        print("3. 新增操作验证:")
        new_employees = df.filter(col("emp_id") > 50).count()
        print(f"   新增员工数: {new_employees}")
        
        if new_employees > 0:
            print("   ✅ 新增员工成功")
        else:
            print("   ❌ 新增员工失败")
        
    finally:
        spark.stop()

def main():
    """主函数"""
    print("🔍 Hudi数据验证开始...")
    
    spark = create_spark_session()
    
    try:
 # 1. 数据完整性验证
        verify_data_integrity(spark)
        
 # 2. 文件结构验证
        verify_file_structure()
        
 # 3. 操作结果验证
        verify_operations()
        
        print("✅ 数据验证完成!")
        
    except Exception as e:
        print(f"❌ 验证过程出错: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        spark.stop()

if __name__ == "__main__":
    main()
```

### 2. 运行验证

```bash
# 运行验证脚本
python verify_data.py
```

## 🎯 完整的运行流程

### 1. 一键运行脚本

```bash
#!/bin/bash
# 创建运行脚本 - run_hudi_demo.sh

echo "🚀 开始运行Hudi演示..."

# 1. 生成测试数据
echo "1. 生成测试数据"
python generate_test_data.py

# 2. 创建第一个Hudi表
echo "2. 创建第一个Hudi表"
python src/first_hudi_app.py

# 3. 更新数据
echo "3. 更新数据"
python update_data.py

# 4. 查询数据
echo "4. 查询数据"
python query_data.py

# 5. 验证数据
echo "5. 验证数据"
python verify_data.py

echo "✅ Hudi演示完成!"
```

### 2. 设置执行权限并运行

```bash
# 设置执行权限
chmod +x run_hudi_demo.sh

# 运行完整演示
./run_hudi_demo.sh
```

## 📊 学习总结

> [!info] 🎓 第一个Hudi应用学习总结
> **类比理解**：完成第一个Hudi应用就像成功建立并运营了一个小型智能仓库：你学会了如何规划仓库布局（配置参数），如何入库和出库货物（数据写入和查询），如何更新库存（UPSERT操作），如何验证库存准确性（数据验证）。现在你已经掌握了仓库管理的基本技能。
> 
> **专业表述**：通过第一个Hudi应用的实践，我们掌握了Hudi的核心工作流程：SparkSession配置、Hudi表创建、数据写入（Insert/Upsert）、数据查询和验证。理解了主键、分区键、时间戳字段的作用，以及Hudi如何通过这些配置实现高效的数据湖管理。

### 关键概念回顾

1. **Hudi配置要点**：
   - `hoodie.datasource.write.recordkey.field`：主键字段
   - `hoodie.datasource.write.precombine.field`：时间戳字段
   - `hoodie.datasource.write.partitionpath.field`：分区字段
   - `hoodie.datasource.write.operation`：操作类型（insert/upsert/delete）

2. **基本操作类型**：
   - **Insert**：插入新数据
   - **Upsert**：更新已存在的数据，插入新数据
   - **Delete**：删除指定数据

3. **数据验证的重要性**：
   - 确保数据完整性
   - 验证操作结果
   - 检查文件结构

## 🔧 常见问题解决

### 1. 配置问题

> [!warning] ⚠️ 常见错误
> 
> **错误信息**：
> ```text
> java.lang.IllegalArgumentException: Missing required property hoodie.datasource.write.recordkey.field
> ```
> 
> **解决方案**：
> 确保配置了所有必需的Hudi选项，特别是主键字段配置。

### 2. 数据类型问题

> [!warning] ⚠️ 常见错误
> 
> **错误信息**：
> ```text
> org.apache.spark.sql.AnalysisException: cannot resolve 'ts' given input columns
> ```
> 
> **解决方案**：
> 确保precombine字段存在且为正确的数据类型（通常是时间戳）。

## 🎯 小结

通过本章节的学习，我们成功：

1. **创建了第一个Hudi表**并理解了基本配置
2. **掌握了基本的数据操作**，包括插入、更新和查询
3. **学会了数据验证**，确保操作的正确性
4. **理解了Hudi的工作流程**和核心概念

> [!abstract] 📚 下一步学习
> 现在你已经掌握了Hudi的基本操作，接下来我们将深入学习[[【技术与工具】/Hudi/05-Hudi数据写入详解|Hudi数据写入]]，了解更多高级特性和优化技巧。

## 🔗 相关资源

- [[【技术与工具】/Hudi/03-Hudi环境搭建与配置|Hudi环境搭建与配置]] - 回顾环境配置
- [[【技术与工具】/Hudi/00-Hudi学习路线图|Hudi]] - 返回学习路线图
- [[【技术与工具】/Hudi/02-Hudi架构与核心特性|Hudi架构与核心特性]] - 深入理解原理

---

> 💡 **记住**：第一个应用是学习的重要里程碑，**不要小看这些基本操作**。每个成功的项目都是从这些基础开始的。建议多实践几次，加深对Hudi工作机制的理解。