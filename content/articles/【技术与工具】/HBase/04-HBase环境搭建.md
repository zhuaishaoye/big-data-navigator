---
title: HBase 环境搭建
tags:
  - HBase
  - 环境搭建
  - Hadoop
  - Zookeeper
  - 分布式集群
  - NoSQL
difficulty: 高级
duration: 60分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
stability: fast-changing
status: maintenance
access_tier: free
created: 2024-12-11
updated: 2026-10-10
---


> [!warning] 关联材料边界
> 以下原引用目标缺失或无法唯一确认，已取消跳转并保留提及：01-HBase概述与应用场景。相关素材/延伸说明暂不可用，不能据此声称已经提供配套材料。

# HBase 环境搭建

> [!info] 前置知识
> - HBase 概述（原引用“01-HBase概述与应用场景”未能确定有效目标，暂不可跳转） — 了解 HBase 是什么及其适用场景
> - [[【技术与工具】/HBase/02-HBase架构原理|HBase 架构原理]] — 理解 HMaster、RegionServer、ZooKeeper 各自的角色
> - Linux 基本命令操作（文件管理、环境变量配置）
> - Java 基础（HBase 运行在 JVM 上）

HBase 运行需要 Java，并使用 ZooKeeper 协调服务；Standalone 模式使用本地文件系统，不需要 HDFS，伪分布式和本文的完全分布式配置则使用 HDFS。搭建时应按所选模式准备依赖，再安装 HBase 本身。本文提供从单机模式到完全分布式集群的示例流程，完全分布式部署仍需补齐跨节点安装、配置分发和 Hadoop 工作节点配置。

---

## 版本兼容性矩阵

选错版本是新手最常见的坑。HBase 对 Hadoop 和 Java 有严格的版本绑定关系。

| HBase 版本 | 推荐 Hadoop 版本 | Java 最低要求 | 维护状态 |
|---|---|---|---|
| 2.4.x (LTS) | 2.10.x / 3.1.x / 3.3.x | Java 8 | 活跃维护 |
| 2.5.x | 3.1.x / 3.3.x | Java 8 / 11 | 活跃维护 |
| 2.6.x | 3.3.x | Java 8 / 11 | 当前稳定 |
| 1.7.x | 2.8.x / 2.9.x / 2.10.x | Java 8 | 维护期结束 |

> [!warning] 版本匹配原则
> - HBase 2.4.x 与 Hadoop 3.2.x 存在兼容性问题，不要混用
> - Java 17 尚未被 HBase 2.x 主线官方支持，生产环境用 Java 8 或 Java 11
> - ZooKeeper 推荐 3.5.x 或 3.6.x，HBase 2.4+ 内置了 ZooKeeper 3.5，可以不单独安装（单机/伪分布式模式）

---

## 部署模式选择

| 部署模式 | 适用场景 | 最低内存 | ZooKeeper 方式 | 推荐程度 |
|---|---|---|---|---|
| **Standalone（单机）** | 本地开发、功能学习 | 2 GB | 内置，自动启动 | 入门首选 |
| **Pseudo-Distributed（伪分布式）** | 功能验证、开发测试 | 4 GB | 内置或外部 | 进阶练习 |
| **Fully Distributed（完全分布式）** | 生产环境、性能测试 | 每节点 8 GB+ | 独立集群（奇数节点）| 生产部署 |

---

## 一、基础环境准备

### 1.1 操作系统

推荐使用 CentOS 7 / Ubuntu 20.04 LTS。以下示例兼容两者，差异处会注明。

```bash
# CentOS 7 — 更新系统并安装基础工具
sudo yum update -y
sudo yum install -y wget curl net-tools

# Ubuntu 20.04 — 等效操作
sudo apt update && sudo apt upgrade -y
sudo apt install -y wget curl net-tools
```

**关闭 SELinux（CentOS）和防火墙（开发环境）：**

```bash
# setenforce 0 临时切换为宽容模式；配置文件中的 disabled 设置需重启生效，仅用于隔离实验环境
sudo setenforce 0
sudo sed -i 's/SELINUX=enforcing/SELINUX=disabled/' /etc/selinux/config

# 关闭防火墙（开发环境可关闭，生产环境需要放行端口）
sudo systemctl stop firewalld && sudo systemctl disable firewalld
```

**生产环境需要放行的端口：**

| 端口 | 服务 | 协议 |
|---|---|---|
| 2181 | ZooKeeper 客户端 | TCP |
| 9000 / 8020 | HDFS NameNode RPC | TCP |
| 50070 / 9870 | HDFS Web UI | TCP |
| 16000 | HMaster RPC | TCP |
| 16010 | HMaster Web UI | TCP |
| 16020 | RegionServer RPC | TCP |
| 16030 | RegionServer Web UI | TCP |

### 1.2 配置主机名和 hosts

```bash
# 单机模式只需设置本机
sudo hostnamectl set-hostname hbase-master

# 完全分布式模式，在每台机器上写入集群所有节点
sudo tee -a /etc/hosts << 'EOF'
192.168.1.10  hbase-master
192.168.1.11  hbase-worker1
192.168.1.12  hbase-worker2
EOF
```

### 1.3 配置 SSH 免密登录（分布式模式必须）

HBase 的 `start-hbase.sh` 脚本依赖 SSH 免密来远程启动各节点服务。

```bash
# 在 master 节点生成密钥对
ssh-keygen -t rsa -b 2048 -f ~/.ssh/id_rsa -N ""

# 将公钥分发到所有节点（包括自身）
for host in hbase-master hbase-worker1 hbase-worker2; do
    ssh-copy-id -i ~/.ssh/id_rsa.pub hadoop@${host}
done

# 验证免密登录
ssh hbase-worker1 "hostname"
```

### 1.4 安装 Java

```bash
# CentOS — 安装 OpenJDK 8
sudo yum install -y java-1.8.0-openjdk java-1.8.0-openjdk-devel

# Ubuntu — 安装 OpenJDK 8
sudo apt install -y openjdk-8-jdk

# 验证
java -version
# 期望输出：openjdk version "1.8.0_xxx"

# 配置 JAVA_HOME（自动获取当前 java 的安装路径，写入 /etc/profile.d/java.sh）
JAVA_PATH=$(dirname $(dirname $(readlink -f $(which java))))
echo "export JAVA_HOME=${JAVA_PATH}" | sudo tee /etc/profile.d/java.sh
source /etc/profile.d/java.sh
```

---

## 二、安装 Hadoop

本文的伪分布式和完全分布式模式使用 HDFS 存储 HFile，需要先配置 Hadoop；仅练习 Standalone 模式时可跳过本节。

### 2.1 下载和解压

```bash
# 下载原稿示例版本 Hadoop 2.10.2；与所选 HBase 版本的兼容性需另行核对
wget https://archive.apache.org/dist/hadoop/common/hadoop-2.10.2/hadoop-2.10.2.tar.gz

sudo tar -xzf hadoop-2.10.2.tar.gz -C /opt/
sudo ln -sfn /opt/hadoop-2.10.2 /opt/hadoop
sudo chown -R $(whoami):$(whoami) /opt/hadoop-2.10.2

# 配置环境变量
cat >> ~/.bashrc << 'EOF'
export HADOOP_HOME=/opt/hadoop
export HADOOP_CONF_DIR=$HADOOP_HOME/etc/hadoop
export PATH=$HADOOP_HOME/bin:$HADOOP_HOME/sbin:$PATH
EOF
source ~/.bashrc
```

### 2.2 核心配置文件

**`$HADOOP_HOME/etc/hadoop/hadoop-env.sh`** — 告知 Hadoop Java 路径：

```bash
echo "export JAVA_HOME=${JAVA_HOME}" >> $HADOOP_HOME/etc/hadoop/hadoop-env.sh
```

**`$HADOOP_HOME/etc/hadoop/core-site.xml`**：

```xml
<configuration>
    <property>
        <name>fs.defaultFS</name>
        <value>hdfs://hbase-master:9000</value>
    </property>
    <property>
        <name>hadoop.tmp.dir</name>
        <value>/opt/hadoop/tmp</value>
    </property>
</configuration>
```

**`$HADOOP_HOME/etc/hadoop/hdfs-site.xml`**：

```xml
<configuration>
    <!-- 副本数：单机为 1，分布式推荐 3 -->
    <property>
        <name>dfs.replication</name>
        <value>1</value>
    </property>
    <property>
        <name>dfs.namenode.name.dir</name>
        <value>/opt/hadoop/data/namenode</value>
    </property>
    <property>
        <name>dfs.datanode.data.dir</name>
        <value>/opt/hadoop/data/datanode</value>
    </property>
</configuration>
```

### 2.3 初始化并启动 HDFS

```bash
# 创建数据目录
mkdir -p /opt/hadoop/data/namenode /opt/hadoop/data/datanode /opt/hadoop/tmp

# 格式化 NameNode（仅首次，重复执行会丢数据！）
hdfs namenode -format

# 启动 HDFS
start-dfs.sh

# 验证 — 应看到 NameNode 和 DataNode 进程
jps | grep -E "NameNode|DataNode"

# 在 HDFS 上创建 HBase 根目录
hdfs dfs -mkdir -p /hbase
```

---

## 三、安装 ZooKeeper（完全分布式模式）

单机和伪分布式模式在使用默认的 HBase 管理 ZooKeeper 配置时，可跳过此节；后续 hbase-env.sh 中需选择 HBASE_MANAGES_ZK=true。本文的完全分布式方案使用独立的 ZooKeeper 集群，投票节点通常选择奇数个，如 3、5、7；奇数并非运行的硬性要求，而是避免增加节点却不提高容错能力。

```bash
# 下载 ZooKeeper 3.6.3
wget https://archive.apache.org/dist/zookeeper/zookeeper-3.6.3/apache-zookeeper-3.6.3-bin.tar.gz
sudo tar -xzf apache-zookeeper-3.6.3-bin.tar.gz -C /opt/
sudo ln -sfn /opt/apache-zookeeper-3.6.3-bin /opt/zookeeper
sudo chown -R $(whoami):$(whoami) /opt/apache-zookeeper-3.6.3-bin

cat >> ~/.bashrc << 'EOF'
export ZOOKEEPER_HOME=/opt/zookeeper
export PATH=$ZOOKEEPER_HOME/bin:$PATH
EOF
source ~/.bashrc
```

**创建配置文件 `$ZOOKEEPER_HOME/conf/zoo.cfg`：**

```properties
# ZooKeeper 基本配置
tickTime=2000
initLimit=10
syncLimit=5
dataDir=/opt/zookeeper/data
clientPort=2181

# 三节点集群配置（格式：server.id=host:节点间通信端口:选举端口）
server.1=hbase-master:2888:3888
server.2=hbase-worker1:2888:3888
server.3=hbase-worker2:2888:3888
```

```bash
# 在各节点创建 myid 文件（内容为节点编号，与 server.X 的 X 一致）
mkdir -p /opt/zookeeper/data
echo "1" > /opt/zookeeper/data/myid          # master 节点执行
# echo "2" > /opt/zookeeper/data/myid        # worker1 节点执行
# echo "3" > /opt/zookeeper/data/myid        # worker2 节点执行

# 启动 ZooKeeper（每个节点都需要执行）
zkServer.sh start

# 验证 — 应看到 leader/follower 状态
zkServer.sh status
```

---

## 四、安装和配置 HBase

### 4.1 下载安装

```bash
# 下载原稿示例版本 HBase 2.4.18；此处不代表已核验其 LTS 状态或是否为最新版本
wget https://archive.apache.org/dist/hbase/2.4.18/hbase-2.4.18-bin.tar.gz
sudo tar -xzf hbase-2.4.18-bin.tar.gz -C /opt/
sudo ln -sfn /opt/hbase-2.4.18 /opt/hbase
sudo chown -R $(whoami):$(whoami) /opt/hbase-2.4.18

cat >> ~/.bashrc << 'EOF'
export HBASE_HOME=/opt/hbase
export PATH=$HBASE_HOME/bin:$PATH
EOF
source ~/.bashrc

# 验证安装
hbase version
```

### 4.2 配置 `hbase-env.sh`

```bash
# $HBASE_HOME/conf/hbase-env.sh — 关键环境变量

# Java 路径（必填，先验证已安装的 Java，再按本机路径配置）
export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java))))

# JVM 堆内存（生产环境按机器实际内存调整）
# 机器内存 8 GB 时的参考配置：
export HBASE_HEAPSIZE=4G
export HBASE_MASTER_OPTS="-Xms1g -Xmx2g -XX:+UseG1GC"
export HBASE_REGIONSERVER_OPTS="-Xms2g -Xmx4g -XX:+UseG1GC -XX:MaxGCPauseMillis=100"

# 使用外部 ZooKeeper（分布式模式必须设为 false）
export HBASE_MANAGES_ZK=false     # 分布式模式
# export HBASE_MANAGES_ZK=true    # 单机/伪分布式模式（默认值）
```

### 4.3 配置 `hbase-site.xml`

这是最关键的配置文件，不同部署模式差异明显：

**单机模式（Standalone）：**

```xml
<configuration>
    <!-- 数据存储在本地文件系统，不依赖 HDFS -->
    <property>
        <name>hbase.rootdir</name>
        <value>file:///opt/hbase/data</value>
    </property>
    <property>
        <name>hbase.zookeeper.property.dataDir</name>
        <value>/opt/hbase/zookeeper</value>
    </property>
</configuration>
```

**伪分布式模式（Pseudo-Distributed）：**

```xml
<configuration>
    <!-- 数据存储在 HDFS，依赖本地 Hadoop -->
    <property>
        <name>hbase.rootdir</name>
        <value>hdfs://hbase-master:9000/hbase</value>
    </property>
    <property>
        <name>hbase.cluster.distributed</name>
        <value>true</value>
    </property>
    <property>
        <name>hbase.zookeeper.quorum</name>
        <value>localhost</value>
    </property>
    <property>
        <name>hbase.zookeeper.property.dataDir</name>
        <value>/opt/zookeeper/data</value>
    </property>
</configuration>
```

**完全分布式模式（Fully Distributed）：**

```xml
<configuration>
    <property>
        <name>hbase.rootdir</name>
        <value>hdfs://hbase-master:9000/hbase</value>
    </property>
    <property>
        <name>hbase.cluster.distributed</name>
        <value>true</value>
    </property>
    <!-- ZooKeeper 集群地址，逗号分隔，不加端口号 -->
    <property>
        <name>hbase.zookeeper.quorum</name>
        <value>hbase-master,hbase-worker1,hbase-worker2</value>
    </property>
    <property>
        <name>hbase.zookeeper.property.clientPort</name>
        <value>2181</value>
    </property>
    <!-- RegionServer 内存分配 — MemStore 上限，默认 0.4 -->
    <property>
        <name>hbase.regionserver.global.memstore.size</name>
        <value>0.4</value>
    </property>
    <!-- BlockCache 占堆内存比例，默认 0.4 -->
    <property>
        <name>hfile.block.cache.size</name>
        <value>0.4</value>
    </property>
    <!-- Region 大小上限，超过后自动分裂，默认 10 GB -->
    <property>
        <name>hbase.hregion.max.filesize</name>
        <value>10737418240</value>
    </property>
    <!-- WAL（Write-Ahead Log）块大小，128 MB -->
    <property>
        <name>hbase.regionserver.hlog.blocksize</name>
        <value>134217728</value>
    </property>
</configuration>
```

### 4.4 配置 RegionServers 列表（完全分布式）

```bash
# $HBASE_HOME/conf/regionservers — 每行一个 RegionServer 主机名
cat > $HBASE_HOME/conf/regionservers << 'EOF'
hbase-worker1
hbase-worker2
EOF
```

### 4.5 将 Hadoop 配置同步到 HBase（完全分布式）

```bash
# HBase 需要读取 Hadoop 的配置来连接 HDFS
# 方式一：软链接（推荐，配置变更自动同步）
ln -sf $HADOOP_CONF_DIR/hdfs-site.xml $HBASE_HOME/conf/hdfs-site.xml
ln -sf $HADOOP_CONF_DIR/core-site.xml $HBASE_HOME/conf/core-site.xml

# 方式二：在 hbase-env.sh 中指定 HADOOP_CONF_DIR
echo "export HADOOP_CONF_DIR=/opt/hadoop/etc/hadoop" >> $HBASE_HOME/conf/hbase-env.sh
```

---

## 五、启动和验证

### 5.1 启动顺序

本文完全分布式方案可按 ZooKeeper → HDFS → HBase 的顺序启动，但 HDFS 本身不依赖 ZooKeeper；启动 HBase 前应确认其所需的 HDFS 和外部 ZooKeeper 已就绪。以下命令以完全分布式方案为例：Standalone 模式只需启动 HBase；使用 HBase 管理 ZooKeeper 的伪分布式模式先启动 HDFS，再启动 HBase，无需单独执行 zkServer.sh。

```bash
# 1. 启动 ZooKeeper（分布式模式，每个 ZK 节点都要执行）
zkServer.sh start
zkServer.sh status   # 确认 Mode: leader 或 follower

# 2. 启动 HDFS
start-dfs.sh
jps | grep -E "NameNode|DataNode"  # 验证

# 3. 启动 HBase
start-hbase.sh

# 4. 验证 HBase 进程
jps | grep -E "HMaster|HRegionServer"
# 期望输出：
# 12345 HMaster
# 12346 HRegionServer
```

### 5.2 功能验证

```bash
# 进入 HBase Shell
hbase shell

# 在 Shell 中执行验证命令
hbase(main):001:0> status
# 期望：1 active master, 0 backup masters, 2 servers, 0 dead, 1.0000 average load

hbase(main):002:0> version
# 期望：输出 HBase 版本号

# 创建测试表、写入数据、查询
hbase(main):003:0> create 'test', 'cf'
hbase(main):004:0> put 'test', 'row1', 'cf:col1', 'hello'
hbase(main):005:0> get 'test', 'row1'
hbase(main):006:0> disable 'test'
hbase(main):007:0> drop 'test'
hbase(main):008:0> exit
```

### 5.3 Web UI 访问

| 服务 | 地址 | 主要信息 |
|---|---|---|
| HMaster Web UI | `http://hbase-master:16010` | 集群状态、Region 分布、RegionServer 列表 |
| RegionServer Web UI | `http://hbase-worker1:16030` | 本节点 Region、读写请求量、内存使用 |
| HDFS NameNode UI | `http://hbase-master:50070` | HDFS 存储用量、DataNode 状态 |

---

## 六、常见问题排查

### 6.1 HMaster 无法启动

```bash
# 查看启动日志
tail -100 $HBASE_HOME/logs/hbase-*-master-*.log | grep -i "error\|exception"

# 常见原因 1：ZooKeeper 未启动
zkServer.sh status

# 常见原因 2：HDFS SafeMode — HDFS 刚启动时处于安全模式，等待 30 秒后重试
hdfs dfsadmin -safemode get
hdfs dfsadmin -safemode leave  # 手动退出（调试用）

# 常见原因 3：hbase.rootdir 对应的 HDFS 目录不存在
hdfs dfs -mkdir -p /hbase
hdfs dfs -chown $(whoami) /hbase
```

### 6.2 RegionServer 无法注册到 Master

```bash
# 检查所有节点的时钟偏差（HBase 要求各节点时钟差 < 30 秒）
# 安装并同步 NTP
sudo yum install -y ntpdate
sudo ntpdate pool.ntp.org

# 检查 /etc/hosts 配置是否一致（每台机器都要检查）
cat /etc/hosts | grep hbase
```

### 6.3 内存不足导致频繁 GC

```bash
# 查看 RegionServer GC 日志
grep "GC\|Full GC\|pause" $HBASE_HOME/logs/hbase-*-regionserver-*.log | tail -20

# 表级配置调整（通过 HBase Shell，不是临时 JVM 调整；设置会持久化，测试后需显式恢复 BLOCKCACHE => true）
hbase shell
hbase(main):001:0> alter 'your_table', {NAME => 'cf', BLOCKCACHE => false}

# 永久调整 — 修改 hbase-env.sh 后重启
# 建议：RegionServer 堆内存 = 机器内存 × 0.5，最大不超过 32 GB
# 机器内存 16 GB 时：
export HBASE_REGIONSERVER_OPTS="-Xms6g -Xmx8g -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:InitiatingHeapOccupancyPercent=70"
```

### 6.4 快速诊断脚本

```bash
#!/bin/bash
# hbase-diagnose.sh — 一键环境检查

echo "=== HBase 环境诊断 ==="

echo "[1] Java 版本"
java -version 2>&1 | head -1

echo "[2] 环境变量"
echo "  JAVA_HOME = $JAVA_HOME"
echo "  HADOOP_HOME = $HADOOP_HOME"
echo "  HBASE_HOME = $HBASE_HOME"

echo "[3] 进程状态"
for proc in NameNode DataNode HMaster HRegionServer QuorumPeerMain; do
    pid=$(jps | grep $proc | awk '{print $1}')
    if [ -n "$pid" ]; then
        echo "  [OK] $proc (PID: $pid)"
    else
        echo "  [MISSING] $proc"
    fi
done

echo "[4] ZooKeeper 连通性"
zk_reply=$(printf 'ruok' | nc -w 3 localhost 2181 2>/dev/null)
if [ "$zk_reply" = "imok" ]; then
    echo "  ZK: 已返回 imok（不代表集群整体健康）"
else
    echo "  ZK: 未返回 imok，请检查 nc、连接及四字命令白名单配置"
fi

echo "[5] HDFS /hbase 目录"
hdfs dfs -ls /hbase 2>/dev/null && echo "  HDFS 目录正常" || echo "  HDFS 目录不存在"

echo "[6] 最近错误日志"
grep -h "ERROR\|FATAL" $HBASE_HOME/logs/*.log 2>/dev/null | tail -5

echo "=== 诊断完成 ==="
```

---

## 七、生产环境性能调优配置

以下是 RegionServer 内存 16 GB 场景下的推荐 `hbase-site.xml` 关键参数：

```xml
<configuration>
    <!-- MemStore：RegionServer 堆内存中用于写缓冲的比例（上限），默认 0.4 -->
    <property>
        <name>hbase.regionserver.global.memstore.size</name>
        <value>0.4</value>
    </property>
    <!-- MemStore 触发 flush 的单个 Region 阈值，默认 128 MB -->
    <property>
        <name>hbase.hregion.memstore.flush.size</name>
        <value>134217728</value>
    </property>
    <!-- BlockCache：用于缓存 HFile 数据块，与 MemStore 之和不要超过 0.8 -->
    <property>
        <name>hfile.block.cache.size</name>
        <value>0.4</value>
    </property>
    <!-- Minor Compaction 触发文件数，默认 3 -->
    <property>
        <name>hbase.hstore.compactionThreshold</name>
        <value>5</value>
    </property>
    <!-- Compaction 最大文件数，默认 10 -->
    <property>
        <name>hbase.hstore.compaction.max</name>
        <value>10</value>
    </property>
    <!-- RegionServer RPC 处理线程数，默认 30，高并发场景可调高 -->
    <property>
        <name>hbase.regionserver.handler.count</name>
        <value>150</value>
    </property>
    <!-- 默认压缩算法，建议 SNAPPY（需安装 native 库）或 LZ4 -->
    <property>
        <name>hbase.hregion.default.compression</name>
        <value>SNAPPY</value>
    </property>
</configuration>
```

> [!note] MemStore + BlockCache 内存分配原则
> 在使用堆内 MemStore 和堆内 BlockCache 的示例配置中，两者之和通常不宜超过堆内存的 80%，还需结合负载验证 GC 压力。示例分配为 MemStore 0.4 + BlockCache 0.4 = 0.8，剩余 0.2 留给 JVM 堆内其他对象；操作系统、堆外内存及其他进程需要另行预留物理内存。

---

## 掌握检查

- [ ] 能说清楚 HBase、Hadoop、ZooKeeper 三者的依赖关系和启动顺序
- [ ] 知道 `hbase-site.xml` 中 `hbase.rootdir` 单机模式和分布式模式的配置差异
- [ ] 能通过 `jps` 判断 HMaster 和 RegionServer 是否正常运行
- [ ] 能访问 HBase Master Web UI（16010 端口）查看集群状态
- [ ] 了解 MemStore 和 BlockCache 的内存分配原则

## 实践练习

1. **基础题**：在本机搭建单机模式 HBase，创建一张表并写入 3 行数据后查询
2. **进阶题**：搭建伪分布式模式，对比单机模式下 `hbase-site.xml` 的配置差异，说明每个改动的原因
3. **挑战题**：用 3 台虚拟机搭建完全分布式集群，部署独立的 ZooKeeper 集群，完成搭建后运行 `hbase pe` 基准测试并记录读写性能数据

## 下一步

掌握环境搭建后，建议继续学习：
- [[【技术与工具】/HBase/05-第一个HBase应用|第一个 HBase 应用]] — 用 Java API 编写第一个 HBase 读写程序
- [[【技术与工具】/HBase/06-HBase Shell操作|HBase Shell 操作]] — 熟悉日常运维常用的 Shell 命令

---

**创建时间**：2024-12-11
**更新时间**：2026-03-21
**预计学习时长**：60 分钟

#HBase #环境搭建 #Hadoop #Zookeeper #分布式集群 #NoSQL
