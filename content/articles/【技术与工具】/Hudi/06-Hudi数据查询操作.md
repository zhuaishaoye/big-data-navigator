---
title: Hudi数据查询操作
tags:
  - Hudi
  - 数据查询
  - 快照查询
  - 增量查询
  - 时间旅行
  - SQL
difficulty: 高级
duration: 25分钟
description: 掌握Hudi的各种查询类型和操作技巧，包括快照查询、增量查询、时间旅行查询等高级特性。
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据治理工程师
  - 数据分析师
  - BI分析师
  - 数据科学家
stability: slow-changing
status: maintenance
access_tier: free
updated: 2026-10-10
---


# 🔍 Apache Hudi数据查询操作

## 📚 学习目标

通过本章节的学习，你将能够：
- **掌握本文介绍的四种查询方式**：快照查询、增量查询、时间旅行查询、只读优化查询
- **理解不同查询类型的适用场景**和性能特点
- **学会使用Spark SQL和DataFrame API**进行复杂查询
- **掌握查询性能优化技巧**
- **处理实际业务场景中的查询需求**

> [!tip] 💡 学习建议
> Hudi的查询功能是它的核心优势之一，**不要被多种查询类型搞混**。就像不同的交通工具适合不同的路况一样，不同的查询类型也适合不同的业务场景。先理解每种查询的特点，然后在实践中选择合适的查询方式。

## 🎯 Hudi查询类型概述

> [!info] 🔍 Hudi查询类型理解
> **类比理解**：Hudi的查询类型就像不同的档案查阅方式：
> - **快照查询**：像查看档案的最新状态，看到所有当前有效的文件
> - **增量查询**：像查看某个时间段内新增或修改的文件清单
> - **时间旅行查询**：像翻阅历史档案，查看过去某个时点的状态
> - **只读优化查询**：像查看已归档的稳定文件，可省去日志合并开销，但可能不是最新的，速度须实测
> 
> **专业表述**：本文介绍快照、增量、时间旅行和只读优化四种查询方式。快照查询提供最新的完整数据视图，普通增量查询读取提交窗口内变更记录的状态，完整CDC需要单独的启用与读取配置；时间旅行通过as.of.instant指定历史时点，并非独立的query.type值；只读优化查询读取基础文件。各方式在延迟、吞吐量和数据新鲜度之间有不同的权衡。

### 查询类型对比

| 查询类型 | 英文名称 | 数据内容 | 性能特点 | 适用场景 |
|---|---|---|---|---|
| **快照查询** | Snapshot Query | 最新完整数据 | MoR表可能需要合并日志 | 常规分析查询 |
| **增量查询** | Incremental Query | 窗口内变更记录的状态 | 取决于窗口和变更规模 | 增量数据同步 |
| **时间旅行查询** | Time Travel Query | 保留范围内的历史时点数据 | 取决于历史文件与读取计划 | 历史数据分析 |
| **只读优化查询** | Read Optimized Query | 基础文件数据 | MoR表可省去日志合并，性能须实测 | 容许数据滞后的大规模分析 |

## 📊 快照查询 (Snapshot Query)

> [!info] 📸 快照查询理解
> **类比理解**：快照查询就像拍照一样，拍下当前时刻数据表的完整状态。无论之前数据如何变化（插入、更新、删除），快照查询都只显示"现在"这一刻的最终结果。就像照片记录的是按下快门瞬间的画面，不会显示拍摄前的任何变化过程。
> 
> **专业表述**：快照查询提供表在查询时刻的最新完整视图，整合了所有历史变更操作的最终结果。对于CoW表，直接读取Parquet文件；对于MoR表，会合并基础文件和日志文件。这是OLAP场景中最常用的查询类型，提供数据一致性保证。

### 1. 基本快照查询

```python
from pyspark.sql import SparkSession

def create_spark_session():
    spark = SparkSession.builder \
        .appName("HudiQueryExample") \
        .config("spark.jars", "/opt/hudi/hudi-spark3.4-bundle_2.12-0.14.0.jar") \
        .config("spark.serializer", "org.apache.spark.serializer.KryoSerializer") \
        .config("spark.sql.extensions", "org.apache.spark.sql.hudi.HoodieSparkSessionExtension") \
        .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.hudi.catalog.HoodieCatalog") \
        .config("spark.kryo.registrator", "org.apache.spark.HoodieSparkKryoRegistrar") \
        .getOrCreate()
    
    spark.sparkContext.setLogLevel("WARN")
    return spark

def snapshot_query_example():
    """快照查询示例"""
    spark = create_spark_session()
    
 # 方法1: DataFrame API
    print("📊 使用DataFrame API进行快照查询")
    df = spark.read \
        .format("hudi") \
        .option("hoodie.datasource.query.type", "snapshot") \
        .load("/path/to/hudi/employee_table")
    
    print(f"总记录数: {df.count()}")
    df.show(10)
    
 # 方法2: 创建临时视图进行SQL查询
    print("📊 使用SQL进行快照查询")
    df.createOrReplaceTempView("employees")
    
 # 基本统计查询
    spark.sql("""
        SELECT 
            department,
            COUNT(*) as emp_count,
            AVG(salary) as avg_salary,
            MAX(salary) as max_salary
        FROM employees
        GROUP BY department
        ORDER BY avg_salary DESC
    """).show()
    
 # 复杂查询示例
    spark.sql("""
        SELECT 
            city,
            department,
            COUNT(*) as count,
            AVG(age) as avg_age
        FROM employees
        WHERE salary > 15000
        GROUP BY city, department
        HAVING COUNT(*) > 2
        ORDER BY city, avg_age DESC
    """).show()
    
    spark.stop()
```

### 2. 高级快照查询

```python
def advanced_snapshot_query():
    """高级快照查询示例"""
    数据读取与写入 = create_spark_session()
    
 # 读取数据
    df = 数据读取与写入.read \
        .format("hudi") \
        .option("hoodie.datasource.query.type", "snapshot") \
        .load("/path/to/hudi/employee_table")
    
    df.createOrReplaceTempView("employees")
    
 # 1. 窗口函数查询
    print("📈 窗口函数查询 - 每个部门的薪资排名")
    数据读取与写入.sql("""
        SELECT 
            name,
            department,
            salary,
            ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) as rank_in_dept,
            RANK() OVER (PARTITION BY department ORDER BY salary DESC) as salary_rank,
            DENSE_RANK() OVER (PARTITION BY department ORDER BY salary DESC) as dense_rank
        FROM employees
    """).show()
    
 # 2. 分析函数查询
    print("📈 分析函数查询 - 累计薪资分析")
    数据读取与写入.sql("""
        SELECT 
            department,
            name,
            salary,
            SUM(salary) OVER (PARTITION BY department ORDER BY salary) as running_total,
            AVG(salary) OVER (PARTITION BY department) as dept_avg,
            salary - AVG(salary) OVER (PARTITION BY department) as diff_from_avg
        FROM employees
        ORDER BY department, salary
    """).show()
    
 # 3. 复杂聚合查询
    print("📈 复杂聚合查询 - 多维度分析")
    数据读取与写入.sql("""
        SELECT 
            city,
            department,
            COUNT(*) as emp_count,
            AVG(salary) as avg_salary,
            PERCENTILE_APPROX(salary, 0.5) as median_salary,
            PERCENTILE_APPROX(salary, 0.9) as p90_salary,
            MIN(age) as min_age,
            MAX(age) as max_age
        FROM employees
        GROUP BY city, department
        ORDER BY avg_salary DESC
    """).show()
    
    数据读取与写入.stop()
```

## 🔄 增量查询 (Incremental Query)

> [!info] 📊 增量查询理解
> **类比理解**：普通增量查询更像查看某个时间段内发生变化的账户状态清单，而不是逐条银行流水；它不能据此还原每次修改和所有删除事件。若要追踪完整变更过程，需要单独配置和读取CDC。
> 
> **专业表述**：普通增量查询通过指定起始和结束提交时间戳，读取窗口内变更记录的状态，不保证返回逐条操作历史或完整删除事件。本文所示0.14.0普通增量读取使用起点不含、终点包含的提交窗口；升级时须核对边界语义。完整CDC需单独启用与配置读取方式，下游同步还需处理消费位点、删除传播和幂等。

### 1. 基本增量查询

```python
def incremental_query_example():
    """增量查询示例"""
    数据读取与写入 = create_spark_session()
    
 # 首先查看可用的时间戳
    print("📅 查看可用的时间戳")
    timeline_df = 数据读取与写入.read \
        .format("hudi") \
        .option("hoodie.datasource.query.type", "snapshot") \
        .load("/path/to/hudi/employee_table")
    
 # 显示时间戳信息
    timeline_df.select("_hoodie_commit_time").distinct().orderBy("_hoodie_commit_time").show()
    
 # 获取时间范围
    commits = timeline_df.select("_hoodie_commit_time").distinct().orderBy("_hoodie_commit_time").collect()
    if len(commits) >= 2:
        start_time = commits[0]["_hoodie_commit_time"]
        end_time = commits[-1]["_hoodie_commit_time"]
        
        print(f"📊 查询时间范围: {start_time} 到 {end_time}")
        
 # 执行增量查询
        incremental_df = 数据读取与写入.read \
            .format("hudi") \
            .option("hoodie.datasource.query.type", "incremental") \
            .option("hoodie.datasource.read.begin.instanttime", start_time) \
            .option("hoodie.datasource.read.end.instanttime", end_time) \
            .load("/path/to/hudi/employee_table")
        
        print(f"📊 增量数据记录数: {incremental_df.count()}")
        incremental_df.show()
        
 # 分析增量数据
        print("📈 增量数据分析")
        incremental_df.createOrReplaceTempView("incremental_data")
        
        数据读取与写入.sql("""
            SELECT 
                _hoodie_operation,
                COUNT(*) as operation_count
            FROM incremental_data
            GROUP BY _hoodie_operation
        """).show()
    
    数据读取与写入.stop()
```

### 2. 实时增量处理

```python
def real_time_incremental_processing():
    """实时增量处理示例"""
    数据读取与写入 = create_spark_session()
    
 # 模拟实时增量查询处理
    def process_incremental_data(start_time, end_time):
        print(f"🔄 处理增量数据: {start_time} -> {end_time}")
        
        incremental_df = 数据读取与写入.read \
            .format("hudi") \
            .option("hoodie.datasource.query.type", "incremental") \
            .option("hoodie.datasource.read.begin.instanttime", start_time) \
            .option("hoodie.datasource.read.end.instanttime", end_time) \
            .load("/path/to/hudi/employee_table")
        
        if incremental_df.count() > 0:
 # 处理增量数据
            incremental_df.createOrReplaceTempView("incremental_changes")
            
 # 统计变化情况
            changes_summary = 数据读取与写入.sql("""
                SELECT 
                    _hoodie_operation as operation,
                    department,
                    COUNT(*) as change_count
                FROM incremental_changes
                GROUP BY _hoodie_operation, department
                ORDER BY department, operation
            """)
            
            print("📊 变化统计:")
            changes_summary.show()
            
 # 处理具体业务逻辑
 # 例如：更新下游系统、发送通知等
            
            return incremental_df
        else:
            print("ℹ️ 没有增量数据")
            return None
    
 # 获取时间戳列表
    timeline_df = 数据读取与写入.read \
        .format("hudi") \
        .option("hoodie.datasource.query.type", "snapshot") \
        .load("/path/to/hudi/employee_table")
    
    commits = [row["_hoodie_commit_time"] for row in 
               timeline_df.select("_hoodie_commit_time").distinct().collect()]
    commits.sort()
    
 # 模拟增量处理
    for i in range(1, len(commits)):
        start_time = commits[i-1]
        end_time = commits[i]
        process_incremental_data(start_time, end_time)
    
    数据读取与写入.stop()
```

## ⏰ 时间旅行查询 (Time Travel Query)

> [!info] ⏰ 时间旅行查询理解
> **类比理解**：时间旅行查询就像翻阅仍被保留的历史相册，你可以指定受支持且历史文件仍可用的时点，查看当时数据表的"照片"。比如你想知道3个月前员工表的状态，就像翻到3个月前的照片，看看那时候有哪些员工、他们的薪资是多少。这对于数据审计、回溯分析特别有用。
> 
> **专业表述**：时间旅行查询通过指定历史提交时间戳（as.of.instant），读取该时点的数据状态。历史读取受清理策略、时间线及数据文件保留情况限制，不能保证任意历史版本都可访问；可用于保留范围内的数据审计、回溯和趋势分析，但查询本身不执行错误恢复。

### 1. 基本时间旅行查询

```python
def time_travel_query_example():
    """时间旅行查询示例"""
    数据读取与写入 = create_spark_session()
    
 # 获取可用的时间戳
    timeline_df = 数据读取与写入.read \
        .format("hudi") \
        .option("hoodie.datasource.query.type", "snapshot") \
        .load("/path/to/hudi/employee_table")
    
    commits = timeline_df.select("_hoodie_commit_time").distinct().orderBy("_hoodie_commit_time").collect()
    
    if len(commits) > 0:
 # 选择一个历史时间点
        historical_time = commits[0]["_hoodie_commit_time"]
        
        print(f"📅 查询历史时间点: {historical_time}")
        
 # 执行时间旅行查询
        historical_df = 数据读取与写入.read \
            .format("hudi") \
            .option("hoodie.datasource.query.type", "snapshot") \
            .option("as.of.instant", historical_time) \
            .load("/path/to/hudi/employee_table")
        
        print(f"📊 历史数据记录数: {historical_df.count()}")
        historical_df.show()
        
 # 与当前数据对比
        current_df = 数据读取与写入.read \
            .format("hudi") \
            .option("hoodie.datasource.query.type", "snapshot") \
            .load("/path/to/hudi/employee_table")
        
        print("📈 数据变化分析:")
        print(f"历史记录数: {historical_df.count()}")
        print(f"当前记录数: {current_df.count()}")
        print(f"记录变化: {current_df.count() - historical_df.count()}")
    
    数据读取与写入.stop()
```

### 2. 历史数据分析

```python
def historical_data_analysis():
    """历史数据分析示例"""
    数据读取与写入 = create_spark_session()
    
 # 获取所有时间戳
    timeline_df = 数据读取与写入.read \
        .format("hudi") \
        .option("hoodie.datasource.query.type", "snapshot") \
        .load("/path/to/hudi/employee_table")
    
    commits = [row["_hoodie_commit_time"] for row in 
               timeline_df.select("_hoodie_commit_time").distinct().collect()]
    commits.sort()
    
 # 分析每个时间点的数据
    historical_stats = []
    
    for commit_time in commits:
        print(f"📅 分析时间点: {commit_time}")
        
        historical_df = 数据读取与写入.read \
            .format("hudi") \
            .option("hoodie.datasource.query.type", "snapshot") \
            .option("as.of.instant", commit_time) \
            .load("/path/to/hudi/employee_table")
        
 # 统计信息
        total_count = historical_df.count()
        avg_salary = historical_df.agg({"salary": "avg"}).first()[0]
        
        historical_stats.append({
            "commit_time": commit_time,
            "total_employees": total_count,
            "avg_salary": avg_salary
        })
        
 # 部门统计
        dept_stats = historical_df.groupBy("department").count().collect()
        print(f"  部门分布: {[(row['department'], row['count']) for row in dept_stats]}")
    
 # 创建趋势分析
    print("📈 历史趋势分析:")
    stats_df = 数据读取与写入.createDataFrame(historical_stats)
    stats_df.show()
    
 # 趋势分析
    stats_df.createOrReplaceTempView("historical_stats")
    
    数据读取与写入.sql("""
        SELECT 
            commit_time,
            total_employees,
            avg_salary,
            total_employees - LAG(total_employees) OVER (ORDER BY commit_time) as employee_change,
            avg_salary - LAG(avg_salary) OVER (ORDER BY commit_time) as salary_change
        FROM historical_stats
        ORDER BY commit_time
    """).show()
    
    数据读取与写入.stop()
```

## ⚡ 只读优化查询 (Read Optimized Query)

> [!info] ⚡ 只读优化查询理解
> **类比理解**：只读优化查询就像只看已经装订成册的正式书籍，而不看散页的草稿和修订笔记。虽然可能错过最新的修改内容，但省去了合并修订内容的过程，可能降低读取开销，适合能够接受数据滞后的大量数据浏览场景，比如做统计报告时；实际速度仍须测量。
> 
> **专业表述**：只读优化查询读取基础文件；在本文的Parquet基础文件示例中，MoR（Merge on Read）表会跳过日志合并，因此可能遗漏尚未合并到基础文件的变更。CoW表上其结果通常与快照读取一致。省去日志合并可能降低读取开销，但不保证性能最高，适用于能够接受相应数据新鲜度的大规模分析和BI报表。

### 1. 只读优化查询示例

```python
def read_optimized_query_example():
    """只读优化查询示例"""
    数据读取与写入 = create_spark_session()
    
 # 只读优化查询 - 只读取基础文件
    print("⚡ 只读优化查询")
    read_optimized_df = 数据读取与写入.read \
        .format("hudi") \
        .option("hoodie.datasource.query.type", "read_optimized") \
        .load("/path/to/hudi/employee_table")
    
    print(f"只读优化记录数: {read_optimized_df.count()}")
    read_optimized_df.show()
    
 # 对比快照查询
    print("📊 快照查询对比")
    snapshot_df = 数据读取与写入.read \
        .format("hudi") \
        .option("hoodie.datasource.query.type", "snapshot") \
        .load("/path/to/hudi/employee_table")
    
    print(f"快照查询记录数: {snapshot_df.count()}")
    
 # 性能对比
    import time
    
 # 只读优化查询性能
    start_time = time.time()
    read_optimized_count = read_optimized_df.count()
    ro_time = time.time() - start_time
    
 # 快照查询性能
    start_time = time.time()
    snapshot_count = snapshot_df.count()
    snapshot_time = time.time() - start_time
    
    print(f"📈 性能对比:")
    print(f"只读优化查询: {read_optimized_count} 条记录, 耗时: {ro_time:.2f}s")
    print(f"快照查询: {snapshot_count} 条记录, 耗时: {snapshot_time:.2f}s")
    
    数据读取与写入.stop()
```

## 🚀 查询性能优化

### 1. 分区剪枝优化

```python
def partition_pruning_example():
    """分区剪枝优化示例"""
    数据读取与写入 = create_spark_session()
    
 # 读取表
    df = 数据读取与写入.read \
        .format("hudi") \
        .option("hoodie.datasource.query.type", "snapshot") \
        .load("/path/to/hudi/employee_table")
    
    df.createOrReplaceTempView("employees")
    
 # 1. 分区过滤查询
    print("📊 分区过滤查询")
    
 # 使用分区字段过滤
    beijing_employees = 数据读取与写入.sql("""
        SELECT name, department, salary
        FROM employees
        WHERE city = '北京'  -- 分区过滤
        AND salary > 15000
    """)
    
    print("北京高薪员工:")
    beijing_employees.show()
    
 # 2. 多分区查询
    print("📊 多分区查询")
    
    tier1_cities = 数据读取与写入.sql("""
        SELECT city, COUNT(*) as emp_count, AVG(salary) as avg_salary
        FROM employees
        WHERE city IN ('北京', '上海', '广州', '深圳')  -- 多分区过滤
        GROUP BY city
        ORDER BY avg_salary DESC
    """)
    
    tier1_cities.show()
    
 # 3. 查看执行计划
    print("📊 查看执行计划")
    tier1_cities.explain(True)
    
    数据读取与写入.stop()
```

### 2. 索引优化查询

```python
def index_optimized_query():
    """索引优化查询示例"""
    数据读取与写入 = create_spark_session()
    
 # 配置索引优化
    数据读取与写入.conf.set("hoodie.metadata.enable", "true")
    数据读取与写入.conf.set("hoodie.enable.data.skipping", "true")
    
 # 读取表
    df = 数据读取与写入.read \
        .format("hudi") \
        .option("hoodie.datasource.query.type", "snapshot") \
        .load("/path/to/hudi/employee_table")
    
    df.createOrReplaceTempView("employees")
    
 # 1. 主键查询优化
    print("🔍 主键查询优化")
    
    specific_employee = 数据读取与写入.sql("""
        SELECT *
        FROM employees
        WHERE id = 1001  -- 主键查询
    """)
    
    specific_employee.show()
    
 # 2. 范围查询优化
    print("🔍 范围查询优化")
    
    id_range_query = 数据读取与写入.sql("""
        SELECT name, department, salary
        FROM employees
        WHERE id BETWEEN 1000 AND 1010  -- 范围查询
        ORDER BY id
    """)
    
    id_range_query.show()
    
 # 3. 复合条件查询优化
    print("🔍 复合条件查询优化")
    
    complex_query = 数据读取与写入.sql("""
        SELECT department, COUNT(*) as count
        FROM employees
        WHERE salary > 15000  -- 范围条件
        AND city IN ('北京', '上海')  -- 分区条件
        GROUP BY department
        ORDER BY count DESC
    """)
    
    complex_query.show()
    
    数据读取与写入.stop()
```

### 3. 缓存优化

```python
def cache_optimization_example():
    """缓存优化示例"""
    数据读取与写入 = create_spark_session()
    
 # 启用自适应查询执行；缓存由下方df.cache()启用
    数据读取与写入.conf.set("spark.sql.adaptive.enabled", "true")
    数据读取与写入.conf.set("spark.sql.adaptive.coalescePartitions.enabled", "true")
    
 # 读取表并缓存
    df = 数据读取与写入.read \
        .format("hudi") \
        .option("hoodie.datasource.query.type", "snapshot") \
        .load("/path/to/hudi/employee_table")
    
 # 缓存常用数据
    df.cache()
    df.createOrReplaceTempView("employees")
    
 # 执行多个查询来测试缓存效果
    print("📊 缓存效果测试")
    
    import time
    
 # 第一次查询
    start_time = time.time()
    result1 = 数据读取与写入.sql("SELECT COUNT(*) as total FROM employees").collect()
    first_query_time = time.time() - start_time
    
 # 第二次查询（使用缓存）
    start_time = time.time()
    result2 = 数据读取与写入.sql("SELECT COUNT(*) as total FROM employees").collect()
    second_query_time = time.time() - start_time
    
    print(f"第一次查询耗时: {first_query_time:.2f}s")
    print(f"第二次查询耗时: {second_query_time:.2f}s")
    print(f"缓存加速比: {first_query_time/second_query_time:.2f}x")
    
 # 复杂查询缓存测试
    complex_query = """
        SELECT 
            department,
            city,
            COUNT(*) as emp_count,
            AVG(salary) as avg_salary,
            MAX(salary) as max_salary
        FROM employees
        GROUP BY department, city
        ORDER BY avg_salary DESC
    """
    
 # 执行复杂查询
    start_time = time.time()
    result = 数据读取与写入.sql(complex_query)
    result.show()
    complex_query_time = time.time() - start_time
    
    print(f"复杂查询耗时: {complex_query_time:.2f}s")
    
 # 清理缓存
    df.unpersist()
    
    数据读取与写入.stop()
```

## 📊 实际业务场景查询示例

### 1. 数据审计查询

```python
def data_audit_queries():
    """数据审计查询示例"""
    数据读取与写入 = create_spark_session()
    
 # 创建审计报告
    print("📋 数据审计报告")
    
 # 1. 数据质量检查
    df = 数据读取与写入.read \
        .format("hudi") \
        .option("hoodie.datasource.query.type", "snapshot") \
        .load("/path/to/hudi/employee_table")
    
    df.createOrReplaceTempView("employees")
    
 # 空值检查
    null_check = 数据读取与写入.sql("""
        SELECT 
            'name' as field, COUNT(*) - COUNT(name) as null_count FROM employees
        UNION ALL
        SELECT 
            'age' as field, COUNT(*) - COUNT(age) as null_count FROM employees
        UNION ALL
        SELECT 
            'salary' as field, COUNT(*) - COUNT(salary) as null_count FROM employees
    """)
    
    print("空值检查:")
    null_check.show()
    
 # 2. 数据分布检查
    distribution_check = 数据读取与写入.sql("""
        SELECT 
            department,
            COUNT(*) as count,
            MIN(salary) as min_salary,
            MAX(salary) as max_salary,
            AVG(salary) as avg_salary,
            STDDEV(salary) as salary_stddev
        FROM employees
        GROUP BY department
        ORDER BY count DESC
    """)
    
    print("数据分布检查:")
    distribution_check.show()
    
 # 3. 异常值检查
    outlier_check = 数据读取与写入.sql("""
        SELECT 
            name,
            age,
            salary,
            department,
            CASE 
                WHEN age < 18 OR age > 65 THEN 'age_outlier'
                WHEN salary < 3000 OR salary > 50000 THEN 'salary_outlier'
                ELSE 'normal'
            END as outlier_type
        FROM employees
        WHERE age < 18 OR age > 65 OR salary < 3000 OR salary > 50000
    """)
    
    print("异常值检查:")
    outlier_check.show()
    
    数据读取与写入.stop()
```

### 2. 业务分析查询

```python
def business_analysis_queries():
    """业务分析查询示例"""
    数据读取与写入 = create_spark_session()
    
    df = 数据读取与写入.read \
        .format("hudi") \
        .option("hoodie.datasource.query.type", "snapshot") \
        .load("/path/to/hudi/employee_table")
    
    df.createOrReplaceTempView("employees")
    
 # 1. 薪资分析
    print("💰 薪资分析")
    
    salary_analysis = 数据读取与写入.sql("""
        SELECT 
            department,
            COUNT(*) as emp_count,
            AVG(salary) as avg_salary,
            PERCENTILE_APPROX(salary, 0.25) as q1_salary,
            PERCENTILE_APPROX(salary, 0.5) as median_salary,
            PERCENTILE_APPROX(salary, 0.75) as q3_salary,
            MAX(salary) as max_salary,
            MIN(salary) as min_salary
        FROM employees
        GROUP BY department
        ORDER BY avg_salary DESC
    """)
    
    salary_analysis.show()
    
 # 2. 年龄分析
    print("👥 年龄分析")
    
    age_analysis = 数据读取与写入.sql("""
        SELECT 
            CASE 
                WHEN age < 25 THEN '年轻组(<25)'
                WHEN age BETWEEN 25 AND 35 THEN '中年组(25-35)'
                WHEN age BETWEEN 36 AND 45 THEN '资深组(36-45)'
                ELSE '经验组(>45)'
            END as age_group,
            COUNT(*) as emp_count,
            AVG(salary) as avg_salary,
            MAX(salary) as max_salary
        FROM employees
        GROUP BY 
            CASE 
                WHEN age < 25 THEN '年轻组(<25)'
                WHEN age BETWEEN 25 AND 35 THEN '中年组(25-35)'
                WHEN age BETWEEN 36 AND 45 THEN '资深组(36-45)'
                ELSE '经验组(>45)'
            END
        ORDER BY avg_salary DESC
    """)
    
    age_analysis.show()
    
 # 3. 地域分析
    print("🌍 地域分析")
    
    regional_analysis = 数据读取与写入.sql("""
        SELECT 
            city,
            COUNT(*) as emp_count,
            AVG(salary) as avg_salary,
            COUNT(DISTINCT department) as dept_count,
            MAX(salary) as max_salary
        FROM employees
        GROUP BY city
        ORDER BY emp_count DESC
    """)
    
    regional_analysis.show()
    
    数据读取与写入.stop()
```

## 🎯 小结

通过本章节的学习，我们掌握了：

1. **本文介绍的四种查询方式**：快照查询、增量查询、时间旅行查询、只读优化查询
2. **不同查询类型的适用场景**和性能特点
3. **查询性能优化技巧**：分区剪枝、索引优化、缓存策略
4. **实际业务场景的查询应用**：数据审计、业务分析

> [!abstract] 📚 下一步学习
> 掌握了查询操作后，接下来我们将学习[[【技术与工具】/Hudi/07-Hudi表管理|Hudi表]]，了解如何进行表的维护、压缩、清理等操作。

## 🔗 相关资源

- [[【技术与工具】/Hudi/05-Hudi数据写入详解|Hudi数据写入]] - 了解数据写入机制
- [[【技术与工具】/Hudi/02-Hudi架构与核心特性|Hudi架构与核心特性]] - 理解查询原理
- [[【技术与工具】/Hudi/00-Hudi学习路线图|Hudi]] - 返回学习路线图

---

> 💡 **记住**：选择合适的查询类型是提高性能的关键。**快照查询适合常规分析**，**增量查询适合实时处理**，**时间旅行查询适合历史分析**，**只读优化查询适合高性能场景**。在实际应用中，要根据具体的业务需求选择合适的查询方式。