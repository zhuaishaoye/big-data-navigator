---
title: Paimon环境搭建 - 快速开始实践
tags:
- Paimon
- 环境搭建
- 配置
- 快速开始
created: 2024-12-04
updated: '2026-10-09'
difficulty: 中级
duration: 20分钟
knowledge_type: technical-practice
target_audience:
- 数据开发工程师
- 数据架构师
- 数据从业者
stability: slow-changing
status: active
access_tier: free
---


# ⚙️ Paimon环境搭建 - 快速开始实践

> [!abstract] 📋 本节概览
> - 🎯 **学习目标**:搭建Paimon本地开发环境,运行第一个示例
> - 📚 **前置知识**:[[【技术与工具】/Paimon/03-Paimon架构原理|Paimon架构原理]]
> - ⏱️ **预计用时**:20分钟
> - 🔧 **核心内容**:环境准备、依赖配置、示例运行、问题排查
> - 💡 **关键收获**:具备独立开发Paimon应用的环境基础

## 🎯 环境搭建概览

### 📋 准备清单

在开始之前,确保你的环境满足以下要求:

**硬件要求**:
```text
CPU: 2核及以上
内存: 4GB及以上(推荐8GB)
磁盘: 10GB可用空间
操作系统: Linux/MacOS/Windows
```

**软件要求**:
```text
Java: JDK 8或JDK 11
Maven: 3.6+
Flink: 1.18+ (可选,用于Flink集成)
IDE: IntelliJ IDEA/VS Code (推荐)
```

### 🛣️ 搭建路径

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"PingFang SC, -apple-system, Source Han Serif SC, serif","fontSize":"16px","background":"#FDFBF5","primaryColor":"#FDFBF5","primaryTextColor":"#2D2A26","primaryBorderColor":"#6E6A60","secondaryColor":"#E8EFE8","secondaryBorderColor":"#8FA890","secondaryTextColor":"#2D2A26","tertiaryColor":"#FDFBF5","tertiaryBorderColor":"#9A9488","tertiaryTextColor":"#6E6A60","lineColor":"#6E6A60","textColor":"#2D2A26","mainBkg":"#FDFBF5","nodeBorder":"#2D5A3D","clusterBkg":"#F3EEDF","clusterBorder":"#9A9488","edgeLabelBackground":"#FDFBF5"},"flowchart":{"htmlLabels":true,"curve":"basis","padding":20,"nodeSpacing":60,"rankSpacing":70,"useMaxWidth":false},"themeCSS":".node rect, .node polygon, .node circle { stroke-width: 1.5px; } .edgePath .path { stroke-width: 1.5px; } .cluster-label .nodeLabel, .cluster-label foreignObject { color: #2D2A26 !important; } .edgeLabel, .edgeLabel foreignObject { color: #2D2A26 !important; background-color: #FDFBF5; } .edgeLabel rect { fill: #FDFBF5; }"}}%%
graph LR
    A[安装JDK] --> B[下载Flink]
    B --> C[添加Paimon依赖]
    C --> D[配置Catalog]
    D --> E[运行示例]
    E --> F[验证成功]

    style A fill:#e1f5fe
    style E fill:#c8e6c9
    style F fill:#a5d6a7
```

## 📦 步骤1:安装Java环境

### ☕ JDK安装

**Linux/MacOS**:
```bash
# 检查Java版本
java -version

# 如果未安装,使用包管理器安装
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install openjdk-11-jdk

# MacOS (使用Homebrew)
brew install openjdk@11

# 配置环境变量：先确认本机JDK 11的实际安装目录
# Linux：将下方占位符替换为实际JDK 11安装目录
# MacOS（Homebrew）：可使用 $(brew --prefix openjdk@11)/libexec/openjdk.jdk/Contents/Home
export JAVA_HOME="<本机JDK 11的实际安装目录>"
export PATH="$JAVA_HOME/bin:$PATH"
```

**Windows**:
```powershell
# 1. 下载JDK
# 访问 https://www.oracle.com/java/technologies/downloads/

# 2. 配置环境变量
# JAVA_HOME = C:\Program Files\Java\jdk-11
# Path 添加 %JAVA_HOME%\bin

# 3. 验证安装
java -version
```

### ✅ 验证安装

```bash
# 查看Java版本
java -version
# 预期输出:
# openjdk version "11.0.x"

# 查看编译器版本
javac -version
# 预期输出:
# javac 11.0.x
```

## 🚀 步骤2:下载并配置Flink

### 📥 下载Flink

**方式1:官网下载**:
```bash
# 访问Flink官网下载
# https://flink.apache.org/downloads.html

# 选择版本(推荐1.18或以上)
wget https://archive.apache.org/dist/flink/flink-1.18.0/flink-1.18.0-bin-scala_2.12.tgz

# 解压
tar -xzf flink-1.18.0-bin-scala_2.12.tgz
cd flink-1.18.0
```

**方式2:使用Maven依赖** (推荐开发):
```xml
<!-- pom.xml -->
<properties>
    <flink.version>1.18.0</flink.version>
    <paimon.version>0.6.0</paimon.version>
</properties>

<dependencies>
    <!-- Flink核心依赖 -->
    <dependency>
        <groupId>org.apache.flink</groupId>
        <artifactId>flink-table-api-java-bridge</artifactId>
        <version>${flink.version}</version>
    </dependency>

    <dependency>
        <groupId>org.apache.flink</groupId>
        <artifactId>flink-table-planner_2.12</artifactId>
        <version>${flink.version}</version>
    </dependency>

    <!-- Paimon依赖 -->
    <dependency>
        <groupId>org.apache.paimon</groupId>
        <artifactId>paimon-flink-1.18</artifactId>
        <version>${paimon.version}</version>
    </dependency>
</dependencies>
```

### ⚙️ 启动Flink集群

**本地模式** (开发测试用):
```bash
# 在解压后的Flink目录中，先安装与Flink 1.18匹配的Paimon连接器
# Maven项目中的依赖不会自动加入独立Flink发行版
wget https://repo.maven.apache.org/maven2/org/apache/paimon/paimon-flink-1.18/0.6.0/paimon-flink-1.18-0.6.0.jar
cp paimon-flink-1.18-0.6.0.jar ./lib/

# 若集群已经启动，先停止；若SQL Client已经启动，也先退出该客户端
# ./bin/stop-cluster.sh

# 安装连接器后启动本地Flink集群，再按下一节启动SQL Client
./bin/start-cluster.sh

# 查看进程
jps
# 预期看到:
# StandaloneSessionClusterEntrypoint
# TaskManagerRunner

# 访问Web UI
# 浏览器打开: http://localhost:8081
```

**SQL Client模式** (交互式开发):
```bash
# 启动SQL Client
./bin/sql-client.sh

# 进入交互式命令行
Flink SQL>
```

## 🗄️ 步骤3:配置Paimon Catalog

### 📝 创建Catalog配置

**方式1:SQL Client中配置**:
```sql
-- 创建Paimon Catalog
CREATE CATALOG paimon_catalog WITH (
    'type' = 'paimon',
    'warehouse' = 'file:///tmp/paimon-warehouse'
);

-- 使用Catalog
USE CATALOG paimon_catalog;

-- 查看当前Catalog
SHOW CATALOGS;
-- 输出:
-- default_catalog
-- paimon_catalog
```

**方式2:在代码中配置**:
```java
import org.apache.flink.table.api.EnvironmentSettings;
import org.apache.flink.table.api.TableEnvironment;

public class PaimonExample {
    public static void main(String[] args) {
        // 创建Table Environment
        EnvironmentSettings settings = EnvironmentSettings
            .newInstance()
            .inStreamingMode()
            .build();

        TableEnvironment tEnv = TableEnvironment.create(settings);

        // 创建Paimon Catalog
        tEnv.executeSql(
            "CREATE CATALOG paimon_catalog WITH (" +
            "  'type' = 'paimon'," +
            "  'warehouse' = 'file:///tmp/paimon-warehouse'" +
            ")"
        );

        // 使用Catalog
        tEnv.useCatalog("paimon_catalog");
    }
}
```

### 🗂️ Catalog存储选项

**本地文件系统** (开发测试):
```sql
CREATE CATALOG paimon_local WITH (
    'type' = 'paimon',
    'warehouse' = 'file:///tmp/paimon'
);
```

**HDFS存储** (生产环境):
```sql
CREATE CATALOG paimon_hdfs WITH (
    'type' = 'paimon',
    'warehouse' = 'hdfs://namenode:8020/paimon-warehouse'
);
```

**S3存储** (云环境):
```sql
CREATE CATALOG paimon_s3 WITH (
    'type' = 'paimon',
    'warehouse' = 's3://my-bucket/paimon-warehouse',
    's3.endpoint' = 'https://s3.amazonaws.com',
    's3.access-key' = 'your-access-key',
    's3.secret-key' = 'your-secret-key'
);
```

## 🎯 步骤4:运行第一个示例

### 📝 示例1:创建和查询仅追加表

```sql
-- 1. 创建数据库
CREATE DATABASE IF NOT EXISTS my_db;
USE my_db;

-- 2. 创建仅追加表
CREATE TABLE access_log (
    user_id BIGINT,
    page STRING,
    action STRING,
    access_time TIMESTAMP(3)
) WITH (
    'bucket' = '-1'  -- 仅追加表使用无桶模式
);

-- 3. 插入测试数据
INSERT INTO access_log VALUES
    (1001, '/home', 'view', TIMESTAMP '2024-01-01 10:00:00'),
    (1002, '/product', 'click', TIMESTAMP '2024-01-01 10:05:00'),
    (1003, '/cart', 'add', TIMESTAMP '2024-01-01 10:10:00');

-- 4. 查询数据
SELECT * FROM access_log;

-- 5. 聚合查询
SELECT
    page,
    COUNT(*) as visit_count
FROM access_log
GROUP BY page;
```

### 🔑 示例2:创建和更新主键表

```sql
-- 1. 创建主键表
CREATE TABLE user_profile (
    user_id BIGINT,
    username STRING,
    age INT,
    city STRING,
    update_time TIMESTAMP(3),
    PRIMARY KEY (user_id) NOT ENFORCED
) WITH (
    'bucket' = '4'
);

-- 2. 插入初始数据
INSERT INTO user_profile VALUES
    (1001, 'Alice', 25, 'Beijing', TIMESTAMP '2024-01-01 10:00:00'),
    (1002, 'Bob', 30, 'Shanghai', TIMESTAMP '2024-01-01 10:00:00'),
    (1003, 'Charlie', 28, 'Guangzhou', TIMESTAMP '2024-01-01 10:00:00');

-- 3. 查询数据
SELECT * FROM user_profile;

-- 4. 更新数据(UPSERT)
INSERT INTO user_profile VALUES
    (1001, 'Alice', 26, 'Shenzhen', TIMESTAMP '2024-01-02 10:00:00');

-- 5. 验证更新
SELECT * FROM user_profile WHERE user_id = 1001;
-- 预期: Alice, 26, Shenzhen (已更新)
```

### 🔄 示例3:流式读取

```sql
-- 1. 创建流式查询
SELECT * FROM user_profile
/*+ OPTIONS('scan.mode' = 'latest') */;

-- 2. 在另一个窗口启动SQL Client，并建立相同的会话上下文
-- 新会话不会继承原会话的Catalog；warehouse必须与原会话一致
CREATE CATALOG paimon_catalog WITH (
    'type' = 'paimon',
    'warehouse' = 'file:///tmp/paimon-warehouse'
);
USE CATALOG paimon_catalog;
USE my_db;

-- 插入新数据，观察原窗口中的流式查询输出
INSERT INTO user_profile VALUES
    (1004, 'David', 32, 'Hangzhou', CURRENT_TIMESTAMP);

-- 3. 观察流式查询输出实时数据
```

## ✅ 步骤5:验证环境

### 🔍 验证清单

**1. 检查Catalog**:
```sql
-- 查看所有Catalog
SHOW CATALOGS;

-- 切换到Paimon Catalog
USE CATALOG paimon_catalog;

-- 查看数据库
SHOW DATABASES;
```

**2. 检查表**:
```sql
-- 查看当前数据库的表
SHOW TABLES;

-- 查看表结构
DESCRIBE user_profile;

-- 查看表属性
SHOW CREATE TABLE user_profile;
```

**3. 检查数据文件**:
```bash
# 查看warehouse目录
ls -lh /tmp/paimon-warehouse/my_db.db/user_profile/

# 预期看到:
# manifest/      - Manifest文件目录
# schema/        - Schema文件目录
# snapshot/      - 快照目录
# bucket-0/      - Bucket 0的数据文件
# bucket-1/      - Bucket 1的数据文件
# ...
```

**4. 查看快照**:
```sql
-- 查看表的快照历史
SELECT * FROM user_profile$snapshots;

-- 输出示例:
-- snapshot_id | schema_id | commit_time         | commit_kind
-- 1           | 0         | 2024-01-01 10:00:00 | APPEND
-- 2           | 0         | 2024-01-02 10:00:00 | APPEND
```

## 🛠️ 常见问题排查

### ❌ 问题1:找不到Paimon类

**症状**:
```text
ClassNotFoundException: org.apache.paimon.flink.FlinkCatalog
```

**解决方案**:
```bash
# 1. 检查依赖版本匹配
# Flink 1.18 → paimon-flink-1.18
# Flink 1.17 → paimon-flink-1.17

# 2. 下载Paimon JAR包
wget https://repo.maven.apache.org/maven2/org/apache/paimon/paimon-flink-1.18/0.6.0/paimon-flink-1.18-0.6.0.jar

# 3. 确保FLINK_HOME指向解压后的Flink目录，再复制连接器
cp paimon-flink-1.18-0.6.0.jar "$FLINK_HOME/lib/"

# 4. 退出当前SQL Client，重启已启动的集群以加载新增JAR
"$FLINK_HOME/bin/stop-cluster.sh"
"$FLINK_HOME/bin/start-cluster.sh"
"$FLINK_HOME/bin/sql-client.sh"
# 新SQL Client会话需重新创建或选择Catalog及数据库上下文
```

### ❌ 问题2:权限不足

**症状**:
```text
Permission denied: /tmp/paimon-warehouse
```

**解决方案**:
```bash
# 1. 创建目录并赋予权限
sudo mkdir -p /tmp/paimon-warehouse
sudo chmod 777 /tmp/paimon-warehouse

# 2. 或使用用户目录
CREATE CATALOG paimon_catalog WITH (
    'type' = 'paimon',
    'warehouse' = 'file:///home/username/paimon-warehouse'
);
```

### ❌ 问题3:内存不足

**症状**:
```text
java.lang.OutOfMemoryError: Java heap space
```

**解决方案**:
```bash
# 1. 增加Flink JVM内存
# 编辑 conf/flink-conf.yaml
taskmanager.memory.process.size: 2048m
jobmanager.memory.process.size: 1024m

# 2. 并行度配置示例（不增加JVM堆内存，是否有助于缓解内存压力取决于负载）
tEnv.getConfig().set("table.exec.resource.default-parallelism", "2");
```

### ❌ 问题4:端口冲突

**症状**:
```text
Address already in use: 8081
```

**解决方案**:
```bash
# 1. 查找占用端口的进程
lsof -i :8081

# 2. 杀死进程
kill -9 <PID>

# 3. 或修改Flink端口
# 编辑 conf/flink-conf.yaml
rest.port: 8082
```

## 🎯 环境配置最佳实践

### 📋 开发环境推荐配置

```yaml
# conf/flink-conf.yaml

# JVM配置
taskmanager.memory.process.size: 4096m
jobmanager.memory.process.size: 2048m

# 并行度
parallelism.default: 2

# 检查点
execution.checkpointing.interval: 60s
state.backend: filesystem
state.checkpoints.dir: file:///tmp/flink-checkpoints

# Web UI
rest.port: 8081
```

### 🔧 生产环境配置建议

```sql
-- 1. 使用分布式存储
CREATE CATALOG paimon_prod WITH (
    'type' = 'paimon',
    'warehouse' = 'hdfs://namenode:8020/paimon-prod'
);

-- 2. 配置合理的表属性
CREATE TABLE production_table (
    ...
) WITH (
    'bucket' = '16',                    -- 合理的bucket数
    'write-buffer-size' = '256mb',      -- 写缓冲
    'compaction.max-sorted-run-num' = '5',  -- 合并阈值
    'snapshot.time-retained' = '1h',    -- 快照保留
    'snapshot.num-retained.min' = '10'  -- 最少保留快照数
);
```

---

## 📋 本节要点回顾

### ✅ 环境搭建检查
- [ ] 成功安装JDK和Flink
- [ ] 配置Paimon Catalog并验证
- [ ] 运行示例创建表和插入数据
- [ ] 验证数据文件和快照生成
- [ ] 掌握常见问题的排查方法

### 🎯 下一步学习
- [ ] 深入学习表类型和配置选项
- [ ] 掌握读写API的使用方法
- [ ] 了解与[[【技术与工具】/Flink/00-Flink学习路线图|Flink]]的深度集成

### 🔗 学习路径连接
**已完成**:✅ 01-概述 → ✅ 02-核心概念 → ✅ 03-架构原理 → ✅ 04-环境搭建
**下一步**:[[【技术与工具】/Paimon/05-Paimon表类型详解|Paimon表类型详解]] - 深入理解主键表和仅追加表

> [!success] 恭喜完成环境搭建!
> 你已经具备了开发Paimon应用的基础环境。建议多运行示例,熟悉SQL操作,为后续深入学习打好基础。

---

**创建时间**:2024-12-04
**最后更新**:2026-10-09
**学习时长**:20分钟
**难度等级**:中级

#Paimon #环境搭建 #Flink #快速开始 #配置
