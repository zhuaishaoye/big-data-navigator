---
title: HDFS操作与管理 - 分布式文件系统实战指南
tags:
  - Hadoop
  - HDFS
  - 文件系统
  - 命令行
  - Java API
  - 运维管理
created: 2024-06-29
updated: 2026-10-10
difficulty: 中级
duration: 90分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据治理工程师
stability: slow-changing
status: maintenance
access_tier: free
---


# 📁 HDFS操作与管理 - 分布式文件系统实战指南

> [!abstract] 📋 学习目标
> - 🎯 **掌握HDFS命令行操作**：文件上传、下载、管理等基础操作
> - 🔧 **学会Java API编程**：开发HDFS客户端应用程序
> - 📊 **理解HDFS管理维护**：监控、备份、性能优化等运维技能
> - 🛠️ **解决常见问题**：权限、配额、安全等实际问题处理

> [!tip] 💡 前置知识
> 建议先学习 [[【技术与工具】/Hadoop/03-HDFS分布式文件系统|HDFS分布式文件系统]] 了解HDFS的基本架构和原理

---

## 🖥️ HDFS命令行操作

### 基础命令格式

HDFS命令行工具就像是操作分布式文件系统的"遥控器"，让我们能够方便地管理存储在集群中的文件。

```bash title="HDFS命令基本格式"
# 基础格式
hadoop fs -command [options] [arguments]

# 或者使用hdfs命令（推荐）
hdfs dfs -command [options] [arguments]

# 查看帮助
hdfs dfs -help
hdfs dfs -help put  # 查看特定命令帮助
```

> [!note] 💡 命令前缀说明
> - `hadoop fs`：通用文件系统命令，支持多种文件系统
> - `hdfs dfs`：本篇用于操作HDFS；实际文件系统仍由URI或默认文件系统配置决定
> - `hdfs dfsadmin`：管理员命令，用于集群管理

### hdfs dfs 常用命令速查表

| 命令 | 等价 Linux 命令 | 说明 | 常用选项 |
|------|-----------------|------|----------|
| `hdfs dfs -ls <path>` | `ls` | 列出目录内容 | `-h`（人性化大小）、`-R`（递归） |
| `hdfs dfs -mkdir <path>` | `mkdir` | 创建目录 | `-p`（递归创建父目录） |
| `hdfs dfs -put <src> <dst>` | `cp` | 从本地上传到 HDFS | `-f`（强制覆盖） |
| `hdfs dfs -get <src> <dst>` | `cp` | 从 HDFS 下载到本地 | `-ignoreCrc`（忽略校验和，仅在明确接受完整性风险时使用） |
| `hdfs dfs -cat <path>` | `cat` | 查看文件内容 | — |
| `hdfs dfs -tail <path>` | `tail` | 查看文件末尾 | `-f`（持续监听） |
| `hdfs dfs -rm <path>` | `rm` | 删除文件 | `-r`（递归）、`-skipTrash`（跳过回收站） |
| `hdfs dfs -cp <src> <dst>` | `cp` | HDFS 内部复制 | `-f`（覆盖） |
| `hdfs dfs -mv <src> <dst>` | `mv` | 移动或重命名 | — |
| `hdfs dfs -chmod <mode> <path>` | `chmod` | 修改权限 | `-R`（递归） |
| `hdfs dfs -chown <owner> <path>` | `chown` | 修改所有者 | `-R`（递归） |
| `hdfs dfs -du <path>` | `du` | 查看目录大小 | `-h`（人性化）、`-s`（汇总） |
| `hdfs dfs -count <path>` | — | 统计文件/目录数量及大小 | `-q`（含配额信息） |
| `hdfs dfs -df` | `df` | 查看文件系统使用情况 | `-h`（人性化） |
| `hdfs dfs -expunge` | — | 清理回收站中过期的检查点并创建新检查点，不会立即清空全部内容 | — |
| `hdfs dfs -setrep <n> <path>` | — | 修改文件副本数 | `-w`（等待复制完成） |

### hdfs dfsadmin 管理员命令速查表

| 命令 | 说明 |
|------|------|
| `hdfs dfsadmin -report` | 查看集群整体状态（节点数、容量、已用空间） |
| `hdfs dfsadmin -safemode get` | 查看当前安全模式状态 |
| `hdfs dfsadmin -safemode enter` | 手动进入安全模式（只读） |
| `hdfs dfsadmin -safemode leave` | 手动退出安全模式 |
| `hdfs dfsadmin -safemode wait` | 阻塞等待直到自动退出安全模式 |
| `hdfs dfsadmin -refreshNodes` | 重新读取 include/exclude 节点列表 |
| `hdfs dfsadmin -printTopology` | 打印集群拓扑（机架分布） |
| `hdfs dfsadmin -setQuota <n> <dir>` | 设置目录的文件数配额 |
| `hdfs dfsadmin -clrQuota <dir>` | 清除文件数配额 |
| `hdfs dfsadmin -setSpaceQuota <size> <dir>` | 设置目录的空间配额 |
| `hdfs dfsadmin -clrSpaceQuota <dir>` | 清除空间配额 |
| `hdfs dfsadmin -fetchImage <dir>` | 从 NameNode 下载最新 FsImage |
| `hdfs dfsadmin -rollEdits` | 强制滚动 EditLog |
| `hdfs dfsadmin -metasave <file>` | 将 NameNode 的节点及块管理诊断信息写入服务端日志目录，不是元数据备份 |

### hdfs fsck 文件系统检查命令

```bash
# 检查整个文件系统健康状况
hdfs fsck /

# 检查指定路径，显示文件、块、块位置详细信息
hdfs fsck /user/data -files -blocks -locations

# 列出所有损坏文件
hdfs fsck / -list-corruptfileblocks

# 移动损坏文件到 /lost+found
hdfs fsck / -move

# 删除损坏文件（谨慎使用）
hdfs fsck / -delete
```

---

### 📂 文件和目录操作

#### 目录管理

```bash title="目录基础操作"
# 📁 创建目录（类似 mkdir -p）
hdfs dfs -mkdir /user/data
hdfs dfs -mkdir -p /user/data/logs/2024/06  # 递归创建

# 📋 列出目录内容（类似 ls）
hdfs dfs -ls /user/data           # 列出目录
hdfs dfs -ls -h /user/data        # 人性化显示文件大小
hdfs dfs -ls -R /user/data        # 递归列出所有子目录

# 🗑️ 删除目录（类似 rm -r）
hdfs dfs -rm -r /user/data/temp   # 删除目录及内容
hdfs dfs -rm -r -skipTrash /path  # 跳过回收站直接删除
```

#### 文件传输操作

```bash title="文件上传下载"
# ⬆️ 上传文件到HDFS
hdfs dfs -put localfile.txt /user/data/        # 上传单个文件
hdfs dfs -put *.log /user/data/logs/           # 上传多个文件
hdfs dfs -put -f local.txt /user/data/         # 强制覆盖
hdfs dfs -copyFromLocal local.txt /user/data/  # 等同于put

# ⬇️ 从HDFS下载文件
hdfs dfs -get /user/data/file.txt ./           # 下载到当前目录
hdfs dfs -get /user/data/*.txt ./downloads/    # 下载多个文件
hdfs dfs -copyToLocal /user/data/file.txt ./   # 等同于get

# 📄 查看文件内容
hdfs dfs -cat /user/data/file.txt              # 显示文件内容
hdfs dfs -head /user/data/largefile.txt        # 显示文件开头
hdfs dfs -tail /user/data/logfile.txt          # 显示文件结尾
```

#### 文件操作进阶

```bash title="文件管理进阶操作"
# 📋 复制文件
hdfs dfs -cp /user/data/file1.txt /user/backup/    # HDFS内部复制
hdfs dfs -cp /user/data/*.txt /user/archive/       # 批量复制

# 🔄 移动/重命名文件
hdfs dfs -mv /user/data/old.txt /user/data/new.txt # 重命名
hdfs dfs -mv /user/data/temp/ /user/archive/       # 移动目录

# 🔗 链接限制：HDFS不支持此处的硬链接操作
# 原示例 hdfs dfs -ln /user/data/important.txt /user/shortcuts/ 不可执行；需要独立副本时可使用 -cp

# 📊 统计信息
hdfs dfs -du /user/data/                        # 显示目录大小
hdfs dfs -du -h /user/data/                     # 人性化显示大小
hdfs dfs -dus /user/data/                       # 汇总目录大小
hdfs dfs -count /user/data/                     # 文件和目录计数
```

---

### 🔍 文件系统查看和监控

```bash title="系统状态查看"
# 📊 文件系统状态
hdfs dfsadmin -report                    # 集群状态报告
hdfs dfsadmin -printTopology             # 集群拓扑结构
hdfs dfsadmin -getDatanodeInfo node1:<DataNode_IPC端口>  # 将占位符替换为实际IPC端口；不是数据传输端口

# 💾 磁盘使用情况
hdfs dfs -df                             # 文件系统使用情况
hdfs dfs -df -h                          # 人性化显示

# 🔍 检查文件完整性
hdfs fsck /user/data/                    # 检查目录完整性
hdfs fsck /user/data/file.txt -files -blocks -locations  # 详细信息
```

---

## 💻 Java API编程

### 环境准备和依赖

```xml title="Maven依赖配置"
<dependencies>
    <!-- Hadoop客户端核心库 -->
    <dependency>
        <groupId>org.apache.hadoop</groupId>
        <artifactId>hadoop-client</artifactId>
        <version>3.3.4</version>
    </dependency>
    
    <!-- HDFS客户端 -->
    <dependency>
        <groupId>org.apache.hadoop</groupId>
        <artifactId>hadoop-hdfs-client</artifactId>
        <version>3.3.4</version>
    </dependency>
</dependencies>
```

### 基础连接和配置

```java title="HDFS客户端基础连接"
import org.apache.hadoop.conf.Configuration;
import org.apache.hadoop.fs.FileSystem;
import org.apache.hadoop.fs.Path;
import java.net.URI;

public class HDFSClient {
    private Configuration conf;
    private FileSystem fs;
    
    // 🔗 初始化HDFS连接
    public void init() throws Exception {
        // 创建配置对象
        conf = new Configuration();
        
        // 设置HDFS地址
        conf.set("fs.defaultFS", "hdfs://namenode:9000");
        
        // 指定非Kerberos测试环境的客户端用户名；仍需具备相应HDFS权限
        System.setProperty("HADOOP_USER_NAME", "hadoop");
        
        // 获取文件系统对象
        fs = FileSystem.get(new URI("hdfs://namenode:9000"), conf, "hadoop");
        
        System.out.println("✅ HDFS连接成功！");
    }
    
    // 🔒 关闭连接
    public void close() throws Exception {
        if (fs != null) {
            fs.close();
            System.out.println("🔒 HDFS连接已关闭");
        }
    }
}
```

### 文件操作API实例

```java title="文件上传下载操作"
import org.apache.hadoop.fs.*;
import org.apache.hadoop.io.IOUtils;
import java.io.*;

public class HDFSFileOperations {
    
    // ⬆️ 上传文件到HDFS
    public void uploadFile(String localPath, String hdfsPath) throws Exception {
        Path srcPath = new Path(localPath);
        Path dstPath = new Path(hdfsPath);
        
        // 检查本地文件是否存在
        File localFile = new File(localPath);
        if (!localFile.exists()) {
            throw new FileNotFoundException("本地文件不存在: " + localPath);
        }
        
        // 执行上传（相当于命令行的 put）
        fs.copyFromLocalFile(srcPath, dstPath);
        System.out.println("✅ 文件上传成功: " + localPath + " -> " + hdfsPath);
    }
    
    // ⬇️ 从HDFS下载文件
    public void downloadFile(String hdfsPath, String localPath) throws Exception {
        Path srcPath = new Path(hdfsPath);
        Path dstPath = new Path(localPath);
        
        // 检查HDFS文件是否存在
        if (!fs.exists(srcPath)) {
            throw new FileNotFoundException("HDFS文件不存在: " + hdfsPath);
        }
        
        // 执行下载（相当于命令行的 get）
        fs.copyToLocalFile(srcPath, dstPath);
        System.out.println("✅ 文件下载成功: " + hdfsPath + " -> " + localPath);
    }
    
    // 📄 读取HDFS文件内容
    public void readFile(String hdfsPath) throws Exception {
        Path path = new Path(hdfsPath);
        
        if (!fs.exists(path)) {
            System.out.println("❌ 文件不存在: " + hdfsPath);
            return;
        }
        
        // 打开文件输入流
        FSDataInputStream inputStream = fs.open(path);
        
        try {
            // 读取并打印文件内容
            IOUtils.copyBytes(inputStream, System.out, 4096, false);
        } finally {
            IOUtils.closeStream(inputStream);
        }
    }
    
    // ✍️ 写入内容到HDFS文件
    public void writeFile(String hdfsPath, String content) throws Exception {
        Path path = new Path(hdfsPath);
        
        // 创建文件输出流（如果文件存在会覆盖）
        FSDataOutputStream outputStream = fs.create(path, true);
        
        try {
            outputStream.write(content.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            outputStream.flush();
            System.out.println("✅ 内容写入成功: " + hdfsPath);
        } finally {
            outputStream.close();
        }
    }
}
```

### 目录和文件管理API

```java title="目录和文件管理"
import org.apache.hadoop.fs.FileStatus;
import org.apache.hadoop.fs.LocatedFileStatus;
import org.apache.hadoop.fs.RemoteIterator;

public class HDFSDirectoryOperations {
    
    // 📁 创建目录
    public void createDirectory(String dirPath) throws Exception {
        Path path = new Path(dirPath);
        
        if (fs.exists(path)) {
            System.out.println("⚠️ 目录已存在: " + dirPath);
            return;
        }
        
        boolean success = fs.mkdirs(path);
        if (success) {
            System.out.println("✅ 目录创建成功: " + dirPath);
        } else {
            System.out.println("❌ 目录创建失败: " + dirPath);
        }
    }
    
    // 📋 列出目录内容
    public void listDirectory(String dirPath) throws Exception {
        Path path = new Path(dirPath);
        
        if (!fs.exists(path)) {
            System.out.println("❌ 目录不存在: " + dirPath);
            return;
        }
        
        FileStatus[] fileStatuses = fs.listStatus(path);
        
        System.out.println("📂 目录内容: " + dirPath);
        System.out.println("权限\t\t副本数\t用户\t\t组\t\t大小\t\t修改时间\t\t\t名称");
        System.out.println("─".repeat(100));
        
        for (FileStatus status : fileStatuses) {
            String type = status.isDirectory() ? "d" : "-";
            String permission = type + status.getPermission().toString();
            String replication = status.isDirectory() ? "-" : String.valueOf(status.getReplication());
            String owner = status.getOwner();
            String group = status.getGroup();
            String size = formatFileSize(status.getLen());
            String modTime = new java.util.Date(status.getModificationTime()).toString();
            String name = status.getPath().getName();
            
            System.out.printf("%-12s %-6s %-10s %-10s %-12s %-25s %s%n",
                permission, replication, owner, group, size, modTime, name);
        }
    }
    
    // 🔍 递归列出所有文件
    public void listFilesRecursive(String dirPath) throws Exception {
        Path path = new Path(dirPath);
        
        RemoteIterator<LocatedFileStatus> iterator = fs.listFiles(path, true);
        
        System.out.println("🔍 递归列出所有文件: " + dirPath);
        while (iterator.hasNext()) {
            LocatedFileStatus status = iterator.next();
            System.out.println("📄 " + status.getPath().toString() + 
                " (大小: " + formatFileSize(status.getLen()) + 
                ", 副本: " + status.getReplication() + ")");
        }
    }
    
    // 🗑️ 删除文件或目录
    public void delete(String path, boolean recursive) throws Exception {
        Path hadoopPath = new Path(path);
        
        if (!fs.exists(hadoopPath)) {
            System.out.println("❌ 路径不存在: " + path);
            return;
        }
        
        boolean success = fs.delete(hadoopPath, recursive);
        if (success) {
            System.out.println("✅ 删除成功: " + path);
        } else {
            System.out.println("❌ 删除失败: " + path);
        }
    }
    
    // 📊 文件大小格式化（把字节转换为人类可读格式）
    private String formatFileSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.1f KB", bytes / 1024.0);
        if (bytes < 1024 * 1024 * 1024) return String.format("%.1f MB", bytes / (1024.0 * 1024));
        return String.format("%.1f GB", bytes / (1024.0 * 1024 * 1024));
    }
}
```

### 完整的实战示例

```java title="HDFS操作完整示例"
public class HDFSOperationDemo {
    public static void main(String[] args) {
        HDFSClient client = new HDFSClient();
        
        try {
            // 1️⃣ 初始化连接
            client.init();
            
            // 2️⃣ 创建工作目录
            client.createDirectory("/user/demo");
            
            // 3️⃣ 上传测试文件
            // 先创建一个本地测试文件
            createLocalTestFile("test.txt", "Hello HDFS!\n这是一个测试文件。\n");
            client.uploadFile("test.txt", "/user/demo/test.txt");
            
            // 4️⃣ 列出目录内容
            client.listDirectory("/user/demo");
            
            // 5️⃣ 读取文件内容
            System.out.println("\n📄 读取文件内容:");
            client.readFile("/user/demo/test.txt");
            
            // 6️⃣ 写入新文件
            client.writeFile("/user/demo/new_file.txt", 
                "这是通过Java API创建的文件\n当前时间: " + new java.util.Date());
            
            // 7️⃣ 下载文件
            client.downloadFile("/user/demo/new_file.txt", "downloaded.txt");
            
            // 8️⃣ 递归列出所有文件
            client.listFilesRecursive("/user/demo");
            
        } catch (Exception e) {
            System.err.println("❌ 操作失败: " + e.getMessage());
            e.printStackTrace();
        } finally {
            try {
                client.close();
            } catch (Exception e) {
                System.err.println("❌ 关闭连接失败: " + e.getMessage());
            }
        }
    }
    
    // 🛠️ 创建本地测试文件的辅助方法
    private static void createLocalTestFile(String filename, String content) throws Exception {
        try (FileWriter writer = new FileWriter(filename)) {
            writer.write(content);
        }
        System.out.println("✅ 本地测试文件创建成功: " + filename);
    }
}
```

---

## 🛠️ HDFS管理与维护

### 集群状态监控

> [!tip] 💡 监控思维
> HDFS监控就像是给医院做"健康体检"，我们需要定期检查各项"指标"是否正常

```bash title="集群健康检查"
# 📊 综合状态报告（最重要的命令）
hdfs dfsadmin -report

# 输出解读：
# Live datanodes：活跃的数据节点数量
# Dead datanodes：死亡的数据节点数量  
# Decommissioning datanodes：正在下线的节点
# DFS Used：HDFS已使用空间
# DFS Remaining：HDFS剩余空间
# Block pool used：块池使用情况

# 🔍 文件系统检查（类似磁盘扫描）
hdfs fsck /                              # 检查整个文件系统
hdfs fsck /user/data -files              # 显示文件列表
hdfs fsck /user/data -blocks             # 显示块信息
hdfs fsck /user/data -locations          # 显示块位置
hdfs fsck /user/data -racks              # 显示机架信息

# 📈 实时监控命令
watch -n 30 'hdfs dfsadmin -report'      # 每30秒刷新状态
```

### 配额管理

配额管理就像是给每个"租户"分配固定的"房间大小"和"房间数量"。

```bash title="空间和文件数量配额"
# 📏 设置空间配额（以字节为单位）
hdfs dfsadmin -setSpaceQuota 10G /user/alice    # 设置10GB空间限制
hdfs dfsadmin -setSpaceQuota 1T /user/bigdata   # 设置1TB空间限制

# 🗃️ 设置文件数量配额
hdfs dfsadmin -setQuota 1000 /user/alice        # 最多1000个文件/目录

# 🔍 查看配额使用情况
hdfs dfs -count -q /user/alice
# 输出格式：QUOTA REM_QUOTA SPACE_QUOTA REM_SPACE_QUOTA DIR_COUNT FILE_COUNT CONTENT_SIZE PATHNAME

# 🚫 清除配额限制
hdfs dfsadmin -clrSpaceQuota /user/alice         # 清除空间配额
hdfs dfsadmin -clrQuota /user/alice              # 清除文件数量配额
```

### Snapshot 管理

Snapshot（快照）是 HDFS 目录在某一时刻的只读视图，相当于给目录拍了一张"照片"。创建时不复制数据块，主要记录元数据差异；后续修改或删除可能因保留历史数据而占用存储空间。它适合误操作恢复，但仍依赖同一集群的数据块，不能替代独立或异地备份。

> [!warning] 前提条件
> 目录必须先开启快照功能（allowSnapshot），才能创建快照。开启快照需要管理员权限。

```bash
# 第一步：开启目录的快照功能（管理员操作）
hdfs dfsadmin -allowSnapshot /user/hive/warehouse

# 禁用快照功能（先删除所有已有快照）
hdfs dfsadmin -disallowSnapshot /user/hive/warehouse

# 创建快照（在目录下的 .snapshot/ 隐藏目录中可见）
hdfs dfs -createSnapshot /user/hive/warehouse
# 创建带名称的快照（推荐：名称包含时间戳便于管理）
hdfs dfs -createSnapshot /user/hive/warehouse daily-2024-06-29

# 列出目录下的所有快照
hdfs dfs -ls /user/hive/warehouse/.snapshot/

# 查看快照时的文件（访问历史版本）
hdfs dfs -ls /user/hive/warehouse/.snapshot/daily-2024-06-29/

# 从快照恢复误删的文件
hdfs dfs -cp \
  /user/hive/warehouse/.snapshot/daily-2024-06-29/orders/data.parquet \
  /user/hive/warehouse/orders/data.parquet

# 重命名快照
hdfs dfs -renameSnapshot /user/hive/warehouse \
  daily-2024-06-29 daily-backup-20240629

# 删除快照
hdfs dfs -deleteSnapshot /user/hive/warehouse daily-backup-20240629

# 对比两个快照的差异（或快照与当前状态的差异）
hdfs snapshotDiff /user/hive/warehouse \
  daily-2024-06-28 daily-2024-06-29
# 输出格式：M（修改）、C（创建）、D（删除）、R（重命名）
```

### 安全模式管理

安全模式就像是给HDFS加了一把"只读锁"，只能查看不能修改。

```bash title="安全模式操作"
# 🔒 进入安全模式
hdfs dfsadmin -safemode enter
# 此时只能读取，不能写入、删除或重命名

# 🔓 退出安全模式  
hdfs dfsadmin -safemode leave

# 📊 查看安全模式状态
hdfs dfsadmin -safemode get

# ⏰ 等待自动退出安全模式
hdfs dfsadmin -safemode wait
# 这个命令会一直等待，直到HDFS自动退出安全模式
```

### 节点管理

```bash title="数据节点管理"
# 📋 查看所有节点状态
hdfs dfsadmin -printTopology             # 集群拓扑
hdfs dfsadmin -report                    # 节点详细信息

# 🔄 刷新节点列表
hdfs dfsadmin -refreshNodes              # 重新读取include/exclude文件

# 🚫 下线节点（优雅下线）
# 1. 将节点添加到exclude文件
echo "node3.example.com" >> /etc/hadoop/conf/dfs.exclude
# 2. 刷新节点配置
hdfs dfsadmin -refreshNodes
# 3. 等待数据迁移完成
hdfs dfsadmin -report

# ✅ 上线节点
# 1. 从exclude文件中移除节点
# 2. 将节点添加到include文件
echo "node3.example.com" >> /etc/hadoop/conf/dfs.include
# 3. 刷新配置
hdfs dfsadmin -refreshNodes
```

### 数据平衡和优化

**何时需要运行 Balancer**：
- 新增 DataNode 后，新节点数据量远少于老节点
- 批量删除大文件后，部分节点磁盘使用率骤降
- 集群磁盘使用率差异超过 10%（通过 `hdfs dfsadmin -report` 观察）

```bash
# 启动数据平衡器（均衡各节点磁盘使用率）
# -threshold：允许的使用率偏差（百分比），默认 10
hdfs balancer -threshold 10

# 限制平衡器带宽，避免影响正常业务（单位：字节/秒）
hdfs dfsadmin -setBalancerBandwidth 10485760    # 设置各DataNode的Balancer带宽上限为10MiB/s
hdfs balancer -threshold 10

# 排除特定节点不参与平衡
hdfs balancer -threshold 10 -exclude -f /etc/hadoop/exclude_nodes.txt

# 仅对指定节点做平衡
hdfs balancer -threshold 10 -include node3,node4

# 前台运行并实时查看进度（Balancer 输出会打印每轮移动的数据量）
hdfs balancer -threshold 5 2>&1 | tee /tmp/balancer.log

# 磁盘内平衡器（同一节点的多块磁盘间均衡，此处以 Hadoop 3.x 为例）
hdfs diskbalancer -plan datanode1.example.com      # 生成平衡计划
hdfs diskbalancer -execute datanode1.example.com.plan.json  # 执行计划
hdfs diskbalancer -query datanode1.example.com     # 查询执行状态
hdfs diskbalancer -cancel datanode1.example.com.plan.json   # 取消执行
```

> [!tip] Balancer 最佳实践
> - 在业务低峰期（夜间）运行，避免影响读写吞吐
> - 通过 `hdfs dfsadmin -setBalancerBandwidth` 限速；原稿“不超过网卡带宽的 30%”为未核实的调试参考，需结合实际业务、磁盘与网络负载验证
> - Balancer 是一次性命令，运行完自动退出；可加入 cron 定期执行
> - `threshold` 不必设太小；原稿 5%~10% 的偏差仅作未核实的调试参考，不能据此断言性能影响微乎其微，应以实际读写和负载测试为准

---

## 🔧 常见问题与解决方案

### 权限问题

> [!warning] ⚠️ 常见错误
> `Permission denied: user=xxx, access=WRITE`

```bash title="权限问题解决"
# 🔐 检查文件权限
hdfs dfs -ls /user/data/

# 🛠️ 修改权限
hdfs dfs -chmod 755 /user/data/           # 修改目录权限
hdfs dfs -chmod -R 644 /user/data/*.txt   # 递归修改文件权限

# 👤 修改所有者
hdfs dfs -chown alice:hadoop /user/data/  # 改变所有者和组
hdfs dfs -chown -R alice /user/data/      # 递归修改所有者

# 🔧 仅限受控、非Kerberos开发环境的身份测试；不能绕过真实授权，勿在生产中冒用管理员身份
export HADOOP_USER_NAME=hdfs             # 设置环境变量
# 或在Java代码中：System.setProperty("HADOOP_USER_NAME", "hdfs");
```

### 磁盘空间不足

```bash title="磁盘空间管理"
# 📊 检查磁盘使用情况
hdfs dfs -df -h                          # 文件系统使用情况
hdfs dfs -du -h /user/                   # 各用户目录使用情况

# 🗑️ 清理策略
# 1. 清理回收站中过期的检查点；默认不会立即清空全部内容或释放所有回收站占用
hdfs dfs -expunge

# 2. 删除旧日志文件
hdfs dfs -rm -r /user/logs/2023/

# 3. 复制大文件（DistCp不执行压缩，也不会因此节省空间）
hadoop distcp /user/data/large.txt /user/compressed/
# 目录名称不代表已压缩；如需压缩，应另行选择格式和工具，验证完整性及下游兼容性后再评估是否删除原文件

# 4. 设置自动清理策略
# 在hdfs-site.xml中配置：
# fs.trash.interval=1440  # 回收站保留时间（分钟）
```

### 数据节点失效处理

```bash title="节点故障处理"
# 🔍 识别问题节点
hdfs dfsadmin -report | grep "Dead"      # 查看死亡节点

# 📊 检查数据完整性
hdfs fsck / -list-corruptfileblocks      # 列出损坏的文件

# 🔄 数据恢复
# 1. 如果有备份，直接恢复
hdfs dfs -cp /backup/data/* /user/data/

# 2. 如果副本足够，HDFS会自动恢复
hdfs dfsadmin -triggerBlockReport node1:<DataNode_IPC端口>  # 替换为实际IPC端口；触发块报告本身不会重建丢失数据

# 3. 若文件因客户端异常仍处于写入状态，可尝试恢复租约；不能修复已丢失或损坏的数据块
hdfs debug recoverLease -path /user/data/corrupted.txt
```

### 性能优化配置

```xml title="hdfs-site.xml优化配置"
<!-- 🚀 性能优化配置 -->
<configuration>
    <!-- 块大小优化：大文件使用更大的块 -->
    <property>
        <name>dfs.blocksize</name>
        <value>268435456</value> <!-- 256MiB -->
        <description>大文件使用256MB块大小</description>
    </property>
    
    <!-- 副本数优化 -->
    <property>
        <name>dfs.replication</name>
        <value>3</value>
        <description>保持3个副本确保可靠性</description>
    </property>
    
    <!-- 缓存优化 -->
    <property>
        <name>dfs.client.read.shortcircuit</name>
        <value>true</value>
        <description>启用短路读取提升性能</description>
    </property>
    
    <!-- 写入缓冲区大小 -->
    <property>
        <name>io.file.buffer.size</name>
        <value>131072</value> <!-- 128KiB -->
        <description>增加缓冲区大小</description>
    </property>
</configuration>
```

---

## 📊 HDFS监控脚本

### 自动化监控脚本

```bash title="HDFS健康检查脚本"
#!/bin/bash
# hdfs_health_check.sh - HDFS健康检查脚本

echo "🏥 HDFS健康检查报告 - $(date)"
echo "═" | tr '═' '=' | head -c 50; echo

# 1️⃣ 检查NameNode状态
echo "📊 NameNode状态:"
if jps | grep -q NameNode; then
    echo "✅ NameNode运行正常"
else
    echo "❌ NameNode未运行！"
    exit 1
fi

# 2️⃣ 检查DataNode数量
echo -e "\n📊 DataNode状态:"
LIVE_NODES=$(hdfs dfsadmin -report | sed -n 's/^[[:space:]]*Live datanodes (\([0-9][0-9]*\)).*/\1/p')
DEAD_NODES=$(hdfs dfsadmin -report | sed -n 's/^[[:space:]]*Dead datanodes (\([0-9][0-9]*\)).*/\1/p')

echo "✅ 活跃节点: $LIVE_NODES"
if [ "$DEAD_NODES" -gt 0 ]; then
    echo "⚠️  死亡节点: $DEAD_NODES"
else
    echo "✅ 死亡节点: $DEAD_NODES"
fi

# 3️⃣ 检查磁盘使用率
echo -e "\n💽 磁盘使用情况:"
DISK_USAGE=$(hdfs dfs -df | grep hdfs | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
    echo "🚨 磁盘使用率: ${DISK_USAGE}% (紧急清理！)"
elif [ "$DISK_USAGE" -gt 80 ]; then
    echo "⚠️  磁盘使用率: ${DISK_USAGE}% (建议清理)"
else
    echo "✅ 磁盘使用率: ${DISK_USAGE}%"
fi

# 4️⃣ 检查文件系统完整性
echo -e "\n🔍 文件系统完整性:"
CORRUPT_BLOCKS=$(hdfs fsck / | awk '/Corrupt(ed)? blocks:/ {print $NF}')
if [ "$CORRUPT_BLOCKS" -eq 0 ]; then
    echo "✅ 无损坏块"
else
    echo "⚠️  发现 $CORRUPT_BLOCKS 个损坏块"
fi

# 5️⃣ 检查安全模式
echo -e "\n🔒 安全模式状态:"
SAFE_MODE=$(hdfs dfsadmin -safemode get)
if printf '%s\n' "$SAFE_MODE" | grep -q 'Safe mode is OFF'; then
    echo "✅ 安全模式: 关闭"
else
    echo "⚠️  安全模式: 开启"
fi

echo -e "\n✅ 健康检查完成！"
```

```bash title="使用方式"
# 赋予执行权限
chmod +x hdfs_health_check.sh

# 手动执行
./hdfs_health_check.sh

# 设置定时任务（每小时检查一次）
crontab -e
# 添加：0 * * * * /path/to/hdfs_health_check.sh >> /var/log/hdfs_health.log 2>&1
```

---

## 🎯 实战练习

### 练习1：文件管理操作

```bash title="基础文件操作练习"
# 🎯 任务：创建一个完整的数据管理流程

# 1. 创建项目目录结构
hdfs dfs -mkdir -p /project/data/{input,output,backup}
hdfs dfs -mkdir -p /project/logs/{2024/06,2024/07}

# 2. 上传测试数据
echo -e "id,name,age\n1,Alice,25\n2,Bob,30\n3,Charlie,35" > users.csv
hdfs dfs -put users.csv /project/data/input/

# 3. 设置合适的权限
hdfs dfs -chmod -R 755 /project/
hdfs dfs -chown -R $(whoami):hadoop /project/

# 4. 创建备份
hdfs dfs -cp /project/data/input/users.csv /project/data/backup/users_$(date +%Y%m%d).csv

# 5. 验证操作结果
hdfs dfs -ls -R /project/
```

### 练习2：Java API开发

```java title="完整的数据处理程序"
import org.apache.hadoop.conf.Configuration;
import org.apache.hadoop.fs.*;
import java.io.*;
import java.net.URI;

public class DataProcessor {
    private FileSystem fs;
    
    public void processData() throws Exception {
        // 初始化
        Configuration conf = new Configuration();
        conf.set("fs.defaultFS", "hdfs://localhost:9000");
        fs = FileSystem.get(new URI("hdfs://localhost:9000"), conf);
        
        String inputDir = "/project/data/input";
        String outputDir = "/project/data/output";
        
        try {
            // 读取输入目录中的所有CSV文件
            FileStatus[] files = fs.listStatus(new Path(inputDir));
            
            for (FileStatus file : files) {
                if (file.getPath().getName().endsWith(".csv")) {
                    processCSVFile(file.getPath(), outputDir);
                }
            }
            
            System.out.println("✅ 数据处理完成！");
            
        } finally {
            fs.close();
        }
    }
    
    private void processCSVFile(Path inputFile, String outputDir) throws Exception {
        // 读取CSV文件并进行简单处理（比如统计行数）
        FSDataInputStream in = fs.open(inputFile);
        BufferedReader reader = new BufferedReader(new InputStreamReader(in));
        
        String line;
        int lineCount = 0;
        StringBuilder summary = new StringBuilder();
        
        while ((line = reader.readLine()) != null) {
            lineCount++;
            if (lineCount == 1) {
                summary.append("Header: ").append(line).append("\n");
            }
        }
        
        summary.append("Total lines: ").append(lineCount).append("\n");
        summary.append("Processed at: ").append(new java.util.Date()).append("\n");
        
        // 写入处理结果
        String outputFile = outputDir + "/" + inputFile.getName() + "_summary.txt";
        FSDataOutputStream out = fs.create(new Path(outputFile));
        out.write(summary.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
        out.close();
        
        reader.close();
        
        System.out.println("📄 处理完成: " + inputFile.getName());
    }
    
    public static void main(String[] args) throws Exception {
        new DataProcessor().processData();
    }
}
```

---

## 🔗 下一步学习

掌握HDFS操作后，建议继续学习：

1. **[[【技术与工具】/Hadoop/06-MapReduce开发实战|MapReduce开发]]** - 学习分布式计算编程
2. **[[【技术与工具】/Hadoop/07-MapReduce性能优化|MapReduce性能优化]]** - 深入理解计算优化
3. **[[【技术与工具】/Hadoop/09-YARN资源管理架构|YARN资源管理]]** - 了解集群资源管理
4. **[[【技术与工具】/Hadoop/11-YARN集群管理|YARN集群]]** - 学习生产环境运维

> [!tip] 💡 学习建议
> - **多实践**：命令行操作需要反复练习才能熟练
> - **写代码**：Java API是开发HDFS应用的基础
> - **关注监控**：生产环境中监控和维护同样重要
> - **理解原理**：操作背后的原理有助于问题排查

---

*最后更新：2024-06-29* 