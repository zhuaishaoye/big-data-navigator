---
title: Doris环境安装与配置 - 从零搭建分析引擎
tags:
  - 技能实操
  - Doris
  - 安装配置
difficulty: 高级
duration: 25分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
stability: fast-changing
status: maintenance
access_tier: free
updated: 2026-10-10
---


# Doris环境安装与配置 - 从零搭建分析引擎

> [!abstract] 📋 本节概览
> - 🎯 学习目标：掌握Doris的安装部署与基础配置方法
> - 📚 前置知识：04-Doris与其他数据库对比|Doris与其他数据库对比、Linux基础
> - ⏱️ 预计用时：25分钟

## 🤔 为什么要学习安装配置？

生活化类比：
> 安装Doris就像组装一辆高性能自行车——只有正确安装每个零件并调整好，才能发挥最佳性能。一步错，步步错。

## 💡 前置准备

### 硬件推荐配置
- **测试环境**：
  - FE：4核8GB内存，50GB磁盘
  - BE：8核16GB内存，100GB+ SSD
- **生产环境**：
  - FE：8核16GB内存，100GB磁盘
  - BE：16核64GB内存，1TB+ SSD/NVME

### 软件环境要求
- JDK 1.8+（FE节点必需）
- GCC 4.8.2+
- Linux操作系统（CentOS 7+/Ubuntu 16.04+）

## 🚀 安装步骤

### 1. 单机开发环境安装

```bash
# 1. 下载Doris安装包
wget https://archive.apache.org/dist/doris/2.0/2.0.2/apache-doris-2.0.2-bin.tar.gz

# 2. 解压安装包
tar -zxvf apache-doris-2.0.2-bin.tar.gz
cd apache-doris-2.0.2-bin

# 3. 启动FE节点
cd fe
./bin/start_fe.sh --daemon

# 4. 启动BE节点
cd ../be
./bin/start_be.sh --daemon

# 5. 添加BE节点到集群
mysql -h 127.0.0.1 -P 9030 -u root
> ALTER SYSTEM ADD BACKEND "127.0.0.1:9050";
```

### 2. 集群环境安装

集群部署涉及多台机器的协调配置，关键在于正确设置 FE 和 BE 的核心参数，以及确保节点间网络互通。

#### fe.conf 核心配置

```properties
# /path/to/doris/fe/conf/fe.conf

# 指定 FE 监听的网段（多网卡环境必填，避免绑定错误 IP）
priority_networks=192.168.1.0/24

# FE 元数据存储目录（需提前创建，生产环境建议单独挂载磁盘）
meta_dir=/data/doris-meta

# FE Thrift 服务端口（默认 9020，用于 FE RPC 服务；BE 心跳检测由 FE 连接 BE 的心跳端口完成）
rpc_port=9020

# MySQL 协议查询端口（客户端连接入口）
query_port=9030

# FE HTTP 服务端口（Web UI 和 Stream Load 请求入口，Stream Load 请求由 FE 重定向至 BE）
http_port=8030

# 编辑日志端口（FE 高可用选举使用）
edit_log_port=9010
```

#### be.conf 核心配置

```properties
# /path/to/doris/be/conf/be.conf

# 指定 BE 监听的网段（与 FE 保持一致的子网）
priority_networks=192.168.1.0/24

# 数据存储目录（生产环境建议使用 SSD，格式：路径,medium:SSD）
storage_root_path=/data/doris-storage,medium:SSD;/data/doris-storage2,medium:HDD

# BE Thrift 服务端口（不是 gRPC 端口）
be_port=9060

# BE 心跳服务端口（FE 通过此端口检测 BE 健康状态）
heartbeat_service_port=9050

# BE HTTP 服务端口（数据导入和 Web UI）
webserver_port=8040
```

#### 集群启动与注册步骤

```bash
# server1、server2、server3 上均解压安装包
tar -zxvf apache-doris-2.0.2-bin.tar.gz

# 1. 在 server1 修改 fe.conf 后启动 FE
cd /opt/doris/fe
./bin/start_fe.sh --daemon

# 2. 在 server2、server3 修改 be.conf 后启动 BE
cd /opt/doris/be
./bin/start_be.sh --daemon

# 3. 登录 FE，将 BE 注册到集群
mysql -h 192.168.1.1 -P 9030 -u root
ALTER SYSTEM ADD BACKEND "192.168.1.2:9050";
ALTER SYSTEM ADD BACKEND "192.168.1.3:9050";

# 4. 生产环境：添加 Follower FE 实现高可用（至少 3 个 FE）
ALTER SYSTEM ADD FOLLOWER "192.168.1.4:9010";
```

> [!note] FE 高可用原理
> Doris FE 基于 BDB JE 实现元数据复制与选主，参与选举的是 Follower FE，通常部署 3 或 5 个以形成多数派；Observer 不参与选举。Master（Leader）FE 负责元数据写入，其他 FE 同步元数据。三 Follower 配置在一台故障后仍可保有多数派，但自动切换和查询恢复取决于剩余节点、网络及客户端重连情况，不保证查询无中断。

### 3. 检查节点状态
```sql
-- 先在系统终端执行 mysql -h 127.0.0.1 -P 9030 -u root 连接 Doris，再在客户端执行以下 SQL

-- 查看FE节点
SHOW PROC '/frontends';

-- 查看BE节点
SHOW PROC '/backends';

-- 节点应显示"Alive: true"
```

### 4. 创建测试表并验证
```sql
-- 创建数据库
CREATE DATABASE test;

-- 创建测试表
CREATE TABLE test.example (
    id INT,
    name VARCHAR(50),
    score DECIMAL(10, 2)
) DISTRIBUTED BY HASH(id) BUCKETS 10
PROPERTIES ("replication_num" = "1");

-- 单副本仅用于本节测试，避免单 BE 环境无法满足默认副本数；不具备副本容错能力

-- 插入测试数据
INSERT INTO test.example VALUES (1, 'Doris', 90.5), (2, 'Test', 85.0);

-- 查询验证
SELECT * FROM test.example;
```

## ⚠️ 常见问题与解决方案

### 1. FE启动失败
- **症状**：FE进程启动后立即退出
- **可能原因**：
  - JDK版本不兼容
  - 端口冲突
  - 元数据目录权限问题
- **解决方案**：
  ```bash
 # 检查日志
  cat fe/log/fe.log
  
 # 检查JDK版本
  java -version
  
 # 检查端口占用
  netstat -anp | grep 9030
  
 # 检查目录权限
  ls -la /path/to/doris-meta
  ```

### 2. BE节点无法加入集群
- **症状**：添加BE节点后状态不为"Alive"
- **可能原因**：
  - 网络连接问题
  - 心跳端口不通
  - BE配置错误
- **解决方案**：
  ```bash
 # 检查BE日志
  cat be/log/be.INFO
  
 # 在 BE 所在机器检查到 FE RPC 端口的连通性
  telnet fe_host 9020

 # 在 FE 所在机器检查到 BE 心跳端口的连通性（将 be_host 替换为目标 BE 地址）
  telnet be_host 9050
  
 # 检查BE配置
  cat be/conf/be.conf
  ```

## ✅ 掌握检查
- [ ] 能独立完成Doris单机环境搭建
- [ ] 了解FE、BE核心配置参数及作用
- [ ] 能诊断并解决常见安装问题

## 🔗 学习连接
**前置知识**: [[【技术与工具】/Doris/04-Doris与其他数据库对比|Doris与其他数据库对比]]
**下一步**: [[【技术与工具】/Doris/06-第一个Doris应用|第一个Doris]] 