---
title: Greenplum 环境搭建 - 生产级集群部署完全指南
tags:
  - Greenplum
  - 环境搭建
  - 集群部署
  - MPP数据库
  - 运维
difficulty: 高级
duration: 60分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
stability: slow-changing
status: maintenance
access_tier: free
updated: 2026-10-10
---


> [!warning] 关联材料边界
> 以下原引用目标缺失或无法唯一确认，已取消跳转并保留提及：01-Greenplum概述与架构；04-Greenplum基本操作；02-Greenplum数据分布原理。相关素材/延伸说明暂不可用，不能据此声称已经提供配套材料。

# Greenplum 环境搭建 - 生产级集群部署完全指南

> [!abstract] 本节概览
> - 学习目标：掌握 Greenplum 集群从规划到初始化验证的完整流程
> - 前置知识：Greenplum 架构（原引用“01-Greenplum概述与架构”未能确定有效目标，暂不可跳转） 、Linux 基础运维
> - 预计用时：60 分钟
> - 后续学习：Greenplum 基本操作（原引用“04-Greenplum基本操作”未能确定有效目标，暂不可跳转）

## 目录

- [[【技术与工具】/Greenplum/03-Greenplum环境搭建#节点角色与硬件规划|#节点角色与硬件规划]]
- [[【技术与工具】/Greenplum/03-Greenplum环境搭建#操作系统与内核准备|#操作系统与内核准备]]
- [[【技术与工具】/Greenplum/03-Greenplum环境搭建#用户、目录与 SSH 配置|#用户、目录与 SSH 配置]]
- [[【技术与工具】/Greenplum/03-Greenplum环境搭建#软件安装|#软件安装]]
- [[【技术与工具】/Greenplum/03-Greenplum环境搭建#gpinitsystem 配置文件详解|#gpinitsystem 配置文件详解]]
- [[【技术与工具】/Greenplum/03-Greenplum环境搭建#集群初始化|#集群初始化]]
- [[【技术与工具】/Greenplum/03-Greenplum环境搭建#集群验证|#集群验证]]
- [[【技术与工具】/Greenplum/03-Greenplum环境搭建#常见安装问题|#常见安装问题]]
- [[【技术与工具】/Greenplum/03-Greenplum环境搭建#掌握检查与练习题|#掌握检查与练习题]]

---

## 节点角色与硬件规划

### 节点角色说明

一套标准的 Greenplum 集群由三类节点组成：

| 节点角色 | 英文名 | 数量 | 核心职责 |
|---|---|---|---|
| 主 Master | Master | 1 | 接收客户端连接，解析 SQL，生成查询计划，协调所有 Segment 执行 |
| 备 Master | Standby Master | 1 | 实时同步 Master 的系统目录，Master 故障时接管服务 |
| 数据节点 | Segment Host | N | 存储数据分片，并行执行查询计划，数量决定集群并行度 |

> [!note] 关于 Primary 与 Mirror
> 本文带镜像的部署示例在 Segment Host 上同时配置 Primary Segment 和 Mirror Segment；不启用镜像的集群不适用此描述。Primary 处理读写，Mirror 是 Primary 的热备副本。Primary 故障时，符合故障检测与镜像可用条件的 Mirror 可自动接管；高可用还取决于副本跨主机布局、同步状态及剩余节点容量，不能仅凭配置镜像保证。

### 推荐硬件规格

**Master / Standby Master 节点**

| 组件 | 最低配置 | 生产推荐 | 说明 |
|---|---|---|---|
| CPU | 8 核 | 16 核 | Master 主要处理查询规划，非计算密集 |
| 内存 | 16 GB | 64 GB | 系统目录、连接池、日志缓冲 |
| 系统盘 | 200 GB SSD | 500 GB SSD | 系统目录、WAL 日志、审计日志 |
| 网络 | 1 GbE | 10 GbE | 管理网络 + 互联网络 |

**Segment Host 节点**

| 组件 | 最低配置 | 生产推荐 | 说明 |
|---|---|---|---|
| CPU | 16 核 | 32～64 核 | 并行计算核心，每个 Segment 实例独占若干核 |
| 内存 | 64 GB | 256 GB | 规则：每个 Segment 实例分配 8 GB 以上 |
| 数据盘 | 4 块 × 1 TB HDD | 8 块 × 4 TB NL-SAS/SSD | 建议 JBOD，多目录分散 I/O |
| 网络 | 10 GbE | 25 GbE 双网口 | 数据网络带宽决定 Redistribute 性能 |

> [!tip] Segment 实例数量经验值
> 每台 Segment Host 建议部署 **4～8 个 Primary Segment 实例**。过多会导致进程竞争，过少无法充分利用多核 CPU 和多块磁盘。常见做法：磁盘数量 = Primary Segment 数量，每个实例独占一块盘的一个目录。

---

## 操作系统与内核准备

> [!warning] 所有节点均需执行
> 以下步骤需要在 **Master、Standby Master、所有 Segment Host** 上执行，建议使用批量工具（如 Ansible）并发推送，或等 SSH 免密配置完成后用 `gpssh` 批量执行。

### 支持的操作系统

| 操作系统 | 推荐版本 | 备注 |
|---|---|---|
| RHEL / CentOS | 7.x、8.x | 官方认证，生产首选 |
| Rocky Linux / AlmaLinux | 8.x | RHEL 社区替代，兼容性好 |
| Ubuntu Server | 18.04 LTS、20.04 LTS | 社区支持，测试环境可用 |

### 内核参数配置

将以下内容追加到 `/etc/sysctl.conf`，然后执行 `sysctl -p` 使其生效。

```bash
# /etc/sysctl.conf - Greenplum 必要内核参数

# 共享内存：SHMMAX 建议设为物理内存的一半
kernel.shmmax = 68719476736       # 64 GB
kernel.shmmni = 4096
kernel.shmall = 4000000000
kernel.sem = 500 2048000 200 4096

# 消息队列
kernel.msgmnb = 65536
kernel.msgmax = 65536
kernel.msgmni = 2048

# 网络调优
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.tcp_max_syn_backlog = 4096
net.core.netdev_max_backlog = 10000
net.core.rmem_max = 2097152
net.core.wmem_max = 2097152
net.ipv4.tcp_rmem = 4096 87380 2097152
net.ipv4.tcp_wmem = 4096 65536 2097152

# 虚拟内存：overcommit_memory=2 限制内存过量承诺，但不能保证不会发生 OOM；须结合内存、交换空间和数据库配置评估
vm.overcommit_memory = 2
vm.overcommit_ratio = 95

# 页缓存回写策略
vm.dirty_background_ratio = 3
vm.dirty_ratio = 10
vm.swappiness = 10
```

```bash
# 使内核参数立即生效
sysctl -p
```

### ulimit 资源限制配置

编辑 `/etc/security/limits.conf`，为 gpadmin 用户设置充足的资源限制：

```bash
# /etc/security/limits.conf

gpadmin soft nofile 524288
gpadmin hard nofile 524288
gpadmin soft nproc 131072
gpadmin hard nproc 131072
gpadmin soft stack 8192
gpadmin hard stack 8192
```

同时检查 `/etc/security/limits.d/` 目录下是否有覆盖配置（尤其是 CentOS 下的 `20-nproc.conf`），确保 gpadmin 的 nproc 不被限制到 1024。

### NTP 时间同步

集群各节点应保持时间同步，以便日志关联和运行诊断；原稿“时间偏差超过 1 秒会导致分布式事务异常”的阈值未核实，不应作为故障判定标准。

```bash
# 安装并配置 chrony（RHEL 7/8 推荐）
yum install -y chrony
systemctl enable chronyd && systemctl start chronyd

# 验证时间同步状态
chronyc tracking
chronyc sources -v
```

### /etc/hosts 配置

所有节点的 `/etc/hosts` 中需要包含集群全部节点的主机名解析，**不要依赖 DNS**，避免单点故障。

```bash
# /etc/hosts 示例（所有节点均需配置）
192.168.10.10   mdw      mdw.example.com      # Master
192.168.10.11   smdw     smdw.example.com     # Standby Master
192.168.10.20   sdw1     sdw1.example.com     # Segment 1
192.168.10.21   sdw2     sdw2.example.com     # Segment 2
192.168.10.22   sdw3     sdw3.example.com     # Segment 3
192.168.10.23   sdw4     sdw4.example.com     # Segment 4
```

> [!note] 主机名规范
> Greenplum 官方文档惯例：Master 节点命名为 `mdw`，Standby Master 为 `smdw`，Segment Host 为 `sdw1`、`sdw2` 依次递增。遵循此惯例便于管理脚本兼容。

### 关闭防火墙与 SELinux

```bash
# 关闭防火墙（生产环境建议使用 iptables 精细化控制，测试环境可直接关闭）
systemctl stop firewalld && systemctl disable firewalld

# 本示例关闭 SELinux；是否需要关闭须按目标版本的支持要求与安全策略确认，不是所有环境的通用要求
setenforce 0
sed -i 's/^SELINUX=enforcing/SELINUX=disabled/' /etc/selinux/config
```

---

## 用户、目录与 SSH 配置

### 创建 gpadmin 用户和数据目录

**在所有节点执行：**

```bash
# 创建 gpadmin 用户和用户组
groupadd gpadmin
useradd -g gpadmin -m -s /bin/bash gpadmin
echo "gpadmin:your_password" | chpasswd

# 为 gpadmin 授予 sudo 权限（安装阶段需要）
echo "gpadmin ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers

# 创建数据目录
mkdir -p /data/master        # Master 数据目录
mkdir -p /data/primary1      # Primary Segment 数据目录（每块盘一个）
mkdir -p /data/primary2
mkdir -p /data/mirror1       # Mirror Segment 数据目录
mkdir -p /data/mirror2

# 设置目录所有权
chown -R gpadmin:gpadmin /data
```

### 配置 SSH 免密登录（gpssh-exkeys）

Greenplum 提供了 `gpssh-exkeys` 工具来自动化完成全集群 SSH 密钥交换，替代手动的 `ssh-copy-id` 操作。

**步骤 1：在 Master 节点，以 gpadmin 用户生成 SSH 密钥对**

```bash
su - gpadmin
ssh-keygen -t rsa -b 4096 -N "" -f ~/.ssh/id_rsa
```

**步骤 2：创建集群主机名文件**

```bash
# /home/gpadmin/all_hosts - 包含所有节点
cat > ~/all_hosts << 'EOF'
mdw
smdw
sdw1
sdw2
sdw3
sdw4
EOF

# /home/gpadmin/seg_hosts - 仅包含 Segment Host
cat > ~/seg_hosts << 'EOF'
sdw1
sdw2
sdw3
sdw4
EOF
```

**步骤 3：执行 gpssh-exkeys 交换密钥**

```bash
# source 环境变量（安装 Greenplum 软件后才能使用此命令）
source /usr/local/greenplum-db/greenplum_path.sh

# 执行密钥交换（会提示输入各节点 gpadmin 密码）
gpssh-exkeys -f ~/all_hosts
```

**步骤 4：验证 SSH 免密登录**

```bash
# 测试对所有节点的无密码连接
gpssh -f ~/all_hosts -e "hostname"
```

所有节点均返回主机名则配置成功。

---

## 软件安装

### 下载与安装 RPM 包

Greenplum Database 开源版（GPDB）可从 VMware Tanzu Network 或 GitHub Releases 获取。

```bash
# 以 root 身份在所有节点安装 RPM
# 方式 1：直接使用 rpm 命令
rpm -ivh greenplum-db-7.x.x-rhel8-x86_64.rpm

# 方式 2：如已有本地仓库
yum install -y greenplum-db-7.x.x

# 默认安装路径：/usr/local/greenplum-db-7.x.x
# 同时会创建符号链接：/usr/local/greenplum-db -> /usr/local/greenplum-db-7.x.x
```

用 `gpssh` 批量在所有 Segment Host 安装：

```bash
# 先将 rpm 包分发到所有节点
gpscp -f ~/seg_hosts greenplum-db-7.x.x-rhel8-x86_64.rpm =:/tmp/

# 批量安装
gpssh -f ~/seg_hosts -e "sudo rpm -ivh /tmp/greenplum-db-7.x.x-rhel8-x86_64.rpm"
```

### 设置安装目录所有权

```bash
# 在所有节点将安装目录所有权转给 gpadmin
sudo chown -R gpadmin:gpadmin /usr/local/greenplum-db*
gpssh -f ~/all_hosts -e "sudo chown -R gpadmin:gpadmin /usr/local/greenplum-db*"
```

### 配置环境变量

`greenplum_path.sh` 是 Greenplum 的环境变量脚本，必须在每次使用 `gp*` 工具前 source。将其加入 gpadmin 的 bash profile 实现自动加载。

```bash
# 在 Master 节点，以 gpadmin 用户编辑 ~/.bashrc
cat >> ~/.bashrc << 'EOF'

# Greenplum 环境变量
source /usr/local/greenplum-db/greenplum_path.sh

# Master 数据目录（仅 Master/Standby Master 节点需要）
export MASTER_DATA_DIRECTORY=/data/master/gpseg-1

# 连接参数
export PGPORT=5432
export PGUSER=gpadmin
export PGDATABASE=postgres
EOF

source ~/.bashrc
```

同样在所有 Segment Host 上 source `greenplum_path.sh`（无需设置 `MASTER_DATA_DIRECTORY`）：

```bash
gpssh -f ~/seg_hosts -e "echo 'source /usr/local/greenplum-db/greenplum_path.sh' >> ~/.bashrc"
```

---

## gpinitsystem 配置文件详解

`gpinitsystem_config` 是 Greenplum 初始化集群的核心配置文件。以下逐参数说明每项含义和注意事项。

```bash
# /home/gpadmin/gpinitsystem_config
# 完整示例：4 台 Segment Host，每台 2 个 Primary + 2 个 Mirror

# -----------------------------------------------
# 集群基本信息
# -----------------------------------------------

# 集群描述名称，显示在管理工具中，可自定义
ARRAY_NAME="Production GP Cluster"

# -----------------------------------------------
# Segment 实例配置
# -----------------------------------------------

# Segment 数据目录的前缀名。
# 实际目录为 DATA_DIRECTORY[i]/SEG_PREFIX + segment_id
# 例如：/data/primary1/gpseg0、/data/primary1/gpseg1
SEG_PREFIX=gpseg

# Primary Segment 的起始端口号。
# 第一个 Primary 使用 PORT_BASE，第二个使用 PORT_BASE+1，依此类推
# 确保该端口范围在所有 Segment Host 上未被占用
PORT_BASE=40000

# Primary Segment 的数据目录列表。
# 数组元素数量 = 每台 Segment Host 上的 Primary 实例数
# 建议：每个目录对应一块独立磁盘，最大化 I/O 并行
declare -a DATA_DIRECTORY=(/data/primary1 /data/primary2)

# -----------------------------------------------
# Master 节点配置
# -----------------------------------------------

# Master 节点的主机名（必须与 /etc/hosts 完全一致）
MASTER_HOSTNAME=mdw

# Master 数据目录的父目录，实际目录为 MASTER_DIRECTORY/gpseg-1
MASTER_DIRECTORY=/data/master

# Master 监听端口，客户端连接此端口
MASTER_PORT=5432

# -----------------------------------------------
# Mirror（镜像）配置（生产环境必须开启）
# -----------------------------------------------

# Mirror Segment 的起始端口号，不能与 PORT_BASE 范围重叠
# 通常设为 PORT_BASE + 10000
MIRROR_PORT_BASE=50000

# Mirror Segment 的数据目录列表，数组长度须与 DATA_DIRECTORY 相同
# Mirror 建议放在与 Primary 不同的磁盘上
declare -a MIRROR_DATA_DIRECTORY=(/data/mirror1 /data/mirror2)

# -----------------------------------------------
# 其他配置
# -----------------------------------------------

# 节点间通信使用 SSH（固定值，不要修改）
TRUSTED_SHELL=ssh

# WAL checkpoint 段数，影响恢复时间和磁盘空间
# 生产环境建议 16～32
CHECK_POINT_SEGMENTS=16

# 数据库字符集，推荐 UTF-8
ENCODING=UTF8

# 初始化时创建的数据库名称；此参数不用于设置 locale
DATABASE_NAME=gpadmin
```

> [!tip] Mirror 布局策略
> Greenplum 支持两种 Mirror 布局：
> - **Grouped Mirroring（默认）**：同一 Segment Host 上各 Primary 的 Mirror 集中放在另一台固定的 Segment Host 上。配置简单，但镜像所在主机宕机会同时失去多个 Mirror；默认策略须以目标版本为准。
> - **Spread Mirroring**：Mirror 均匀分散到其他所有 Segment Host。容灾能力更强，需在 `gpinitsystem` 命令中加 `-S` 参数启用。

---

## 集群初始化

### 执行 gpinitsystem

```bash
# 以 gpadmin 用户在 Master 节点执行
su - gpadmin
source /usr/local/greenplum-db/greenplum_path.sh

# 基本初始化命令
# -c：指定配置文件
# -h：指定 Segment Host 列表文件
# -a：自动接受所有提示（非交互模式）
gpinitsystem -c ~/gpinitsystem_config -h ~/seg_hosts -a

# 以下命令是上一条初始化命令的替代方案，不要在同一数据目录连续执行两次初始化；若要启用 Spread Mirroring，加 -S 参数，并先核对目标版本是否支持
gpinitsystem -c ~/gpinitsystem_config -h ~/seg_hosts -S -a
```

初始化过程的关键阶段如下：

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"PingFang SC, -apple-system, Source Han Serif SC, serif","fontSize":"16px","background":"#FDFBF5","primaryColor":"#FDFBF5","primaryTextColor":"#2D2A26","primaryBorderColor":"#6E6A60","secondaryColor":"#E8EFE8","secondaryBorderColor":"#8FA890","secondaryTextColor":"#2D2A26","tertiaryColor":"#FDFBF5","tertiaryBorderColor":"#9A9488","tertiaryTextColor":"#6E6A60","lineColor":"#6E6A60","textColor":"#2D2A26","mainBkg":"#FDFBF5","nodeBorder":"#2D5A3D","clusterBkg":"#F3EEDF","clusterBorder":"#9A9488","edgeLabelBackground":"#FDFBF5"},"flowchart":{"htmlLabels":true,"curve":"basis","padding":20,"nodeSpacing":60,"rankSpacing":70,"useMaxWidth":false},"themeCSS":".node rect, .node polygon, .node circle { stroke-width: 1.5px; } .edgePath .path { stroke-width: 1.5px; } .cluster-label .nodeLabel, .cluster-label foreignObject { color: #2D2A26 !important; } .edgeLabel, .edgeLabel foreignObject { color: #2D2A26 !important; background-color: #FDFBF5; } .edgeLabel rect { fill: #FDFBF5; }"}}%%
flowchart LR
    classDef default fill:#FDFBF5,stroke:#6E6A60,color:#2D2A26,stroke-width:1.5px
    classDef startend fill:#2D2A26,stroke:#2D2A26,color:#FDFBF5,font-weight:bold
    classDef decision fill:#F6EAD8,stroke:#C08A1A,color:#2D2A26,font-weight:bold
    classDef hub fill:#3B5A80,stroke:#3B5A80,color:#FDFBF5,font-weight:bold
    classDef io fill:#E5EAF0,stroke:#3B5A80,color:#2D2A26
    classDef accent fill:#A6432C,stroke:#A6432C,color:#FDFBF5,font-weight:bold
    classDef storage fill:#F3EEDF,stroke:#9A9488,color:#2D2A26
    A[参数校验] --> B[SSH 连通性测试]
    B --> C[创建 Master 数据目录]
    C --> D[初始化 Master Catalog]
    D --> E[分发初始化指令到 Segment Host]
    E --> F[各 Segment Host 并发创建实例]
    F --> G[注册所有 Segment 到 Master]
    G --> H[初始化 Standby Master]
    H --> I[集群启动验证]
    class A,B,C,D,E,F,G,H,I default
```

初始化时间取决于 Segment 数量，通常 5～20 分钟。成功后会打印 `Greenplum Database instance successfully created.`

### 添加 Standby Master

如果初始化时未创建 Standby Master，可以在初始化后单独添加；不要仅凭配置文件是否含有 `STANDBY_HOSTNAME` 判断是否已创建，应先检查实际集群状态：

```bash
gpinitstandby -s smdw
```

### 配置 pg_hba.conf

初始化完成后，配置客户端访问控制规则：

```bash
# /data/master/gpseg-1/pg_hba.conf
# 允许 gpadmin 本地无密码连接
local   all         gpadmin                                trust
host    all         gpadmin         127.0.0.1/32           trust
host    all         gpadmin         ::1/128                trust

# 允许内网应用服务器连接（使用 md5 密码认证）
host    all         all             192.168.10.0/24        md5

```

在 shell 中执行以下命令重载配置，不要将其写入 `pg_hba.conf`：

```bash
# 重载配置（无需重启）
gpstop -u
```

---

## 集群验证

### gpstate 状态检查

```bash
# 查看集群整体状态（快速概览）
gpstate

# 查看所有实例的详细状态（含端口、数据目录、同步状态）
gpstate -s

# 查看 Mirror 同步状态
gpstate -m

# 查看 Standby Master 状态
gpstate -f
```

正常集群的 `gpstate` 输出示例：

```text
20240301:10:00:00 gpstate:mdw:gpadmin-[INFO]:-Starting gpstate with args:
20240301:10:00:00 gpstate:mdw:gpadmin-[INFO]:-local Greenplum Version: ...
20240301:10:00:00 gpstate:mdw:gpadmin-[INFO]:-Master instance                 = Active
20240301:10:00:00 gpstate:mdw:gpadmin-[INFO]:-Master standby                  = smdw
20240301:10:00:00 gpstate:mdw:gpadmin-[INFO]:-Standby master state            = Standby host passive
20240301:10:00:00 gpstate:mdw:gpadmin-[INFO]:-Total segment instance count from initdb = 16
20240301:10:00:00 gpstate:mdw:gpadmin-[INFO]:-Primary Segment Status
20240301:10:00:00 gpstate:mdw:gpadmin-[INFO]:----------------------------
20240301:10:00:00 gpstate:mdw:gpadmin-[INFO]:-Total primary segments          = 8
20240301:10:00:00 gpstate:mdw:gpadmin-[INFO]:-Total primary segment valid (at master) = 8
20240301:10:00:00 gpstate:mdw:gpadmin-[INFO]:-Total primary segment failures   = 0
```

### psql 连接测试

```bash
# 连接默认数据库
psql -d postgres

# 查看集群版本和 Segment 信息
psql -c "SELECT version();"
psql -c "SELECT * FROM gp_segment_configuration ORDER BY dbid;"
```

`gp_segment_configuration` 输出解读：

| 字段 | 说明 |
|---|---|
| dbid | 实例在集群中的唯一 ID |
| content | Segment ID（-1 = Master） |
| role | p=Primary，m=Mirror |
| status | u=Up，d=Down |
| mode | s=Synchronized，r=Recovering，n=Not Sync |
| address | 实例所在主机 IP/主机名 |
| port | 实例监听端口 |

在本文带镜像的示例中，所有 Primary 的 status 为 `u`、mode 为 `s` 可作为实例在线及副本同步的检查项；字段取值须按目标版本解释，还应结合 Mirror、Standby、日志、磁盘和连接测试判断整体健康状态。

### 分布式写入验证

```bash
psql -d postgres << 'EOF'
-- 创建分布式测试表
CREATE TABLE verify_test (
    id    BIGSERIAL,
    val   TEXT,
    ts    TIMESTAMP DEFAULT NOW()
) DISTRIBUTED BY (id);

-- 插入测试数据
INSERT INTO verify_test (val)
SELECT 'row_' || generate_series(1, 10000);

-- 验证数据均匀分布到各 Segment
SELECT gp_segment_id, COUNT(*) AS row_count
FROM verify_test
GROUP BY gp_segment_id
ORDER BY gp_segment_id;

-- 清理测试数据
DROP TABLE verify_test;
EOF
```

正常情况下每个 Segment 分配的行数大致相等（10000 / Segment 数量）。

---

## 常见安装问题

| 问题现象 | 根因分析 | 解决方案 |
|---|---|---|
| `gpinitsystem` 报 SSH 连接失败 | SSH 密钥未正确分发，或 known_hosts 未更新 | 重新执行 `gpssh-exkeys`，检查 `~/.ssh/authorized_keys` 权限为 600 |
| 初始化报 `permission denied` 到数据目录 | 数据目录所有者不是 gpadmin | `chown -R gpadmin:gpadmin /data` |
| 端口冲突：`address already in use` | `PORT_BASE` 或 `MIRROR_PORT_BASE` 范围内端口被占用 | `ss -tlnp` 检查端口占用，调整配置文件端口范围 |
| `shmmax` 不足导致 Segment 启动失败 | 内核参数未生效，或 `SHMMAX` 值过小 | 检查 `/etc/sysctl.conf` 并执行 `sysctl -p`，确保 SHMMAX >= 物理内存的 50% |
| Segment 数量与预期不符 | `DATA_DIRECTORY` 数组配置错误 | 检查 `gpinitsystem_config` 中 `declare -a DATA_DIRECTORY=()` 语法，括号和空格不能有误 |
| `gpstate` 显示 Mirror not synchronized | Mirror 数据目录权限问题或磁盘写入失败 | 检查 Mirror 目录权限，从 `gp_segment_configuration` 查询对应实例的主机和 `datadir`，登录该 Segment Host 后检查实际日志目录；日志子目录名称以目标版本与日志配置为准 |
| 时区相关报错 | 各节点时区不一致 | `timedatectl set-timezone Asia/Shanghai`（所有节点执行） |

> [!warning] 重新初始化集群
> 如果初始化失败需要重新来过，应先检查失败日志、残留进程和目录状态。以下清理操作仅适用于确认可丢弃的失败初始化测试目录；不得清空已有业务数据的集群。删除前须逐节点核实路径、停机状态及备份，优先按初始化日志提供的回退指引处理：
> ```bash
> # 在 Master 节点查看初始化失败日志；若生成回退脚本，核对内容后按对应版本指引执行
> # 不使用原稿未经核实的 gpinitsystem --rollback 参数
> # 或在确认目录可丢弃、相关进程已停止且备份已核实后手动清空
> rm -rf /data/master/*
> gpssh -f ~/seg_hosts -e "rm -rf /data/primary*/* /data/mirror*/*"
> ```

---

## 掌握检查与练习题

### 掌握检查

完成本节后，确认以下能力：

- [ ] 能够说明 Master、Standby Master、Segment Host 三类节点各自的职责
- [ ] 能够独立完成 `/etc/sysctl.conf` 的内核参数配置并解释每个参数的作用
- [ ] 理解 `gpssh-exkeys` 的作用并能手动完成 SSH 免密配置的验证
- [ ] 能够逐项解释 `gpinitsystem_config` 中各参数的含义
- [ ] 能够通过 `gpstate -s` 判断集群健康状态
- [ ] 掌握至少 3 种常见安装报错的排查方法

### 练习题

1. **硬件规划题**：若要搭建一套每天处理 10 TB 数据的数据仓库，计划使用 6 台 Segment Host，每台 32 核 / 128 GB 内存 / 8 块 4 TB HDD，请给出 `DATA_DIRECTORY`、`PORT_BASE`、`MIRROR_PORT_BASE` 的合理配置，并说明每台节点应部署多少个 Primary Segment 实例。

2. **故障排查题**：执行 `gpstate -m` 发现有 2 个 Mirror 处于 `Not Synchronized` 状态，请列出排查步骤。

3. **参数解释题**：解释以下内核参数设置 `vm.overcommit_memory = 2` 的含义，以及为什么 Greenplum 要求使用此值而不是默认的 0 或 1。

---

**相关文档**：Greenplum 架构（原引用“01-Greenplum概述与架构”未能确定有效目标，暂不可跳转） | 基本操作（原引用“04-Greenplum基本操作”未能确定有效目标，暂不可跳转） | 数据分布原理（原引用“02-Greenplum数据分布原理”未能确定有效目标，暂不可跳转）
