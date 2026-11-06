---
title: Oracle环境安装与配置
tags:
  - 技术工具
  - Oracle
date: 2026-03-22
difficulty: 中级
duration: 30分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据库管理员
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-22
updated: 2026-10-10
---


# Oracle环境安装与配置

> [!NOTE] 📋 前置知识
> - [[【技术与工具】/Oracle/01-Oracle概述与特性|Oracle概述与特性]] - 了解Oracle基础概念
> - [[【技术与工具】/Oracle/02-Oracle架构深度解析|Oracle架构]] - 理解Oracle架构原理
> - Linux基础操作知识

## 学习目标

> [!IMPORTANT] 🎯 本章学习目标
> 完成本章学习后，你将能够：
> - 理解Oracle数据库安装和配置的主要步骤，并在系统依赖及权限等前提满足后开展单机实验
> - 掌握Oracle监听器的配置和管理
> - 了解密码策略、审计和归档配置示例及其在银行环境中的适用限制
> - 具备Oracle数据库的基本运维能力

## 安装前准备

### 1. 系统要求

**Linux系统要求**
- Red Hat Enterprise Linux 7.x 或更高版本
- CentOS 7.x 或更高版本
- 最小内存：2GB，推荐8GB或更多
- 最小磁盘空间：20GB，推荐100GB或更多

**检查系统资源**
```bash
# 检查内存
free -h

# 检查磁盘空间
df -h

# 检查CPU信息
cat /proc/cpuinfo | grep processor | wc -l
```

### 2. 用户和组配置

```bash
# 创建Oracle用户组
groupadd oinstall
groupadd dba
groupadd oper

# 创建Oracle用户
useradd -g oinstall -G dba,oper oracle
passwd oracle
```

### 3. 内核参数配置

编辑 `/etc/sysctl.conf`：
```bash
# Oracle推荐的内核参数
kernel.shmmax = 4398046511104
kernel.shmmni = 4096
kernel.shmall = 1073741824
kernel.sem = 250 32000 100 128
fs.file-max = 6815744
net.ipv4.ip_local_port_range = 9000 65500
net.core.rmem_default = 262144
net.core.rmem_max = 4194304
net.core.wmem_default = 262144
net.core.wmem_max = 1048576
```

应用配置：
```bash
sysctl -p
```

## Oracle软件安装

### 1. 下载Oracle软件

从Oracle官网下载Oracle Database 19c安装包：
```bash
# 解压安装包
unzip LINUX.X64_193000_db_home.zip -d /u01/app/oracle/product/19.3.0/dbhome_1/
```

### 2. 设置环境变量

编辑 `/home/oracle/.bash_profile`：
```bash
export ORACLE_BASE=/u01/app/oracle
export ORACLE_HOME=/u01/app/oracle/product/19.3.0/dbhome_1
export ORACLE_SID=ORCL
export PATH=$ORACLE_HOME/bin:$PATH
export LD_LIBRARY_PATH=$ORACLE_HOME/lib:/lib:/usr/lib
```

应用环境变量：
```bash
source ~/.bash_profile
```

### 3. 静默安装Oracle软件

创建响应文件 `db_install.rsp`：
```ini
oracle.install.option=INSTALL_DB_SWONLY
UNIX_GROUP_NAME=oinstall
INVENTORY_LOCATION=/u01/app/oraInventory
ORACLE_HOME=/u01/app/oracle/product/19.3.0/dbhome_1
ORACLE_BASE=/u01/app/oracle
oracle.install.db.InstallEdition=EE
oracle.install.db.OSDBA_GROUP=dba
oracle.install.db.OSOPER_GROUP=oper
oracle.install.db.OSBACKUPDBA_GROUP=dba
oracle.install.db.OSDGDBA_GROUP=dba
oracle.install.db.OSKMDBA_GROUP=dba
oracle.install.db.OSRACDBA_GROUP=dba
DECLINE_SECURITY_UPDATES=true
```

执行安装：
```bash
./runInstaller -silent -responseFile /home/oracle/db_install.rsp
```

## 数据库创建

### 1. 使用DBCA创建数据库

**图形界面方式**
```bash
# 启动DBCA
dbca
```

**静默方式创建**
```bash
dbca -silent \
-createDatabase \
-templateName General_Purpose.dbc \
-gdbName ORCL \
-sid ORCL \
-sysPassword Oracle123 \
-systemPassword Oracle123 \
-datafileDestination /u01/app/oracle/oradata \
-recoveryAreaDestination /u01/app/oracle/fast_recovery_area \
-storageType FS \
-characterSet AL32UTF8 \
-nationalCharacterSet AL16UTF16 \
-listeners LISTENER \
-sampleSchema true
```

### 2. 手动创建数据库

**步骤1：准备初始化参数文件**
创建 `$ORACLE_HOME/dbs/initORCL.ora`：
```ini
db_name = ORCL
memory_target = 2G
processes = 300
audit_file_dest = /u01/app/oracle/admin/ORCL/adump
control_files = (/u01/app/oracle/oradata/ORCL/control01.ctl,
                 /u01/app/oracle/oradata/ORCL/control02.ctl)
db_block_size = 8192
compatible = 19.0.0
```

**步骤2：启动实例到NOMOUNT状态**
```sql
export ORACLE_SID=ORCL
sqlplus / as sysdba

STARTUP NOMOUNT;
```

**步骤3：执行CREATE DATABASE语句**
```sql
CREATE DATABASE ORCL
USER SYS IDENTIFIED BY Oracle123
USER SYSTEM IDENTIFIED BY Oracle123
LOGFILE GROUP 1 ('/u01/app/oracle/oradata/ORCL/redo01.log') SIZE 100M,
        GROUP 2 ('/u01/app/oracle/oradata/ORCL/redo02.log') SIZE 100M,
        GROUP 3 ('/u01/app/oracle/oradata/ORCL/redo03.log') SIZE 100M
MAXLOGFILES 3
MAXLOGMEMBERS 3
MAXDATAFILES 100
CHARACTER SET AL32UTF8
NATIONAL CHARACTER SET AL16UTF16
DATAFILE '/u01/app/oracle/oradata/ORCL/system01.dbf' SIZE 700M REUSE
SYSAUX DATAFILE '/u01/app/oracle/oradata/ORCL/sysaux01.dbf' SIZE 550M REUSE
DEFAULT TABLESPACE USERS
   DATAFILE '/u01/app/oracle/oradata/ORCL/users01.dbf' SIZE 500M REUSE
DEFAULT TEMPORARY TABLESPACE TEMP
   TEMPFILE '/u01/app/oracle/oradata/ORCL/temp01.dbf' SIZE 20M REUSE
UNDO TABLESPACE UNDOTBS1
   DATAFILE '/u01/app/oracle/oradata/ORCL/undotbs01.dbf' SIZE 200M REUSE;
```

## 监听器配置

### 1. 配置listener.ora

编辑 `$ORACLE_HOME/network/admin/listener.ora`：
```ini
LISTENER =
  (DESCRIPTION_LIST =
    (DESCRIPTION =
      (ADDRESS = (PROTOCOL = TCP)(HOST = localhost)(PORT = 1521))
      (ADDRESS = (PROTOCOL = IPC)(KEY = EXTPROC1521))
    )
  )

SID_LIST_LISTENER =
  (SID_LIST =
    (SID_DESC =
      (SID_NAME = ORCL)
      (ORACLE_HOME = /u01/app/oracle/product/19.3.0/dbhome_1)
    )
  )
```

### 2. 配置tnsnames.ora

编辑 `$ORACLE_HOME/network/admin/tnsnames.ora`：
```ini
ORCL =
  (DESCRIPTION =
    (ADDRESS = (PROTOCOL = TCP)(HOST = localhost)(PORT = 1521))
    (CONNECT_DATA =
      (SERVER = DEDICATED)
      (SERVICE_NAME = ORCL)
    )
  )
```

### 3. 启动监听器

```bash
# 启动监听器
lsnrctl start

# 检查监听器状态
lsnrctl status

# 重新加载配置
lsnrctl reload
```

## 数据库启动和关闭

### 1. 数据库启动

```sql
-- 连接到数据库
sqlplus / as sysdba

-- 启动数据库
STARTUP;

-- 分步启动
STARTUP NOMOUNT;  -- 启动实例
ALTER DATABASE MOUNT;  -- 挂载数据库
ALTER DATABASE OPEN;   -- 打开数据库
```

### 2. 数据库关闭

```sql
-- 正常关闭
SHUTDOWN NORMAL;

-- 立即关闭
SHUTDOWN IMMEDIATE;

-- 强制关闭
SHUTDOWN ABORT;
```

## 银行环境特殊配置

### 1. 安全配置

```sql
-- 设置密码策略
ALTER PROFILE DEFAULT LIMIT
PASSWORD_LIFE_TIME 90
PASSWORD_GRACE_TIME 7
PASSWORD_REUSE_TIME 365
PASSWORD_REUSE_MAX 5
FAILED_LOGIN_ATTEMPTS 3
PASSWORD_LOCK_TIME 1;
```

### 2. 审计配置

```sql
-- 启用审计
ALTER SYSTEM SET audit_trail = DB_EXTENDED SCOPE = SPFILE;

-- 重启数据库使审计生效
SHUTDOWN IMMEDIATE;
STARTUP;
```

### 3. 归档模式配置

```sql
-- 启用归档模式
SHUTDOWN IMMEDIATE;
STARTUP MOUNT;
ALTER DATABASE ARCHIVELOG;
ALTER DATABASE OPEN;

-- 设置归档目录
ALTER SYSTEM SET log_archive_dest_1 = 'LOCATION=/u01/app/oracle/archivelog';
```

## Docker环境快速搭建

### 1. 拉取Oracle镜像

```bash
# 拉取Oracle 19c镜像
docker pull container-registry.oracle.com/database/enterprise:19.3.0.0

# 或使用Oracle XE免费版
docker pull gvenzl/oracle-xe:21-slim
```

### 2. 运行Oracle容器

```bash
# 运行Oracle XE
docker run -d \
  --name oracle-xe \
  -p 1521:1521 \
  -p 5500:5500 \
  -e ORACLE_PASSWORD=Oracle123 \
  -e ORACLE_CHARACTERSET=AL32UTF8 \
  -v oracle-data:/opt/oracle/oradata \
  gvenzl/oracle-xe:21-slim
```

### 3. 连接到容器数据库

```bash
# 进入容器
docker exec -it oracle-xe bash

# 连接数据库
sqlplus sys/Oracle123@localhost:1521/XE as sysdba
```

## 自动化安装脚本

### 1. 目录准备与DBCA建库脚本（需先完成软件安装及用户环境配置）

```bash
#!/bin/bash
# Oracle 19c目录准备与DBCA建库脚本，需先完成软件安装及用户环境配置

# 设置变量
ORACLE_BASE=/u01/app/oracle
ORACLE_HOME=/u01/app/oracle/product/19.3.0/dbhome_1
ORACLE_SID=ORCL

# 创建目录
mkdir -p $ORACLE_BASE
mkdir -p $ORACLE_HOME
mkdir -p /u01/app/oracle/oradata
mkdir -p /u01/app/oracle/archivelog

# 设置权限
chown -R oracle:oinstall /u01/app/oracle
chmod -R 775 /u01/app/oracle

# 创建数据库
su - oracle -c "
dbca -silent \
-createDatabase \
-templateName General_Purpose.dbc \
-gdbName $ORACLE_SID \
-sid $ORACLE_SID \
-sysPassword Oracle123 \
-systemPassword Oracle123 \
-datafileDestination /u01/app/oracle/oradata \
-storageType FS \
-characterSet AL32UTF8
"

if [ "$?" -eq 0 ]; then
  echo "DBCA执行成功；仍需检查数据库和监听器状态。"
else
  echo "DBCA执行失败，请检查日志。" >&2
  exit 1
fi
```

## 常见问题解决

### 1. 安装权限问题

```bash
# 修改文件权限
chmod +x runInstaller
chown oracle:oinstall -R /u01/app/oracle
```

### 2. 内存不足问题

```sql
-- 调整内存参数
ALTER SYSTEM SET memory_target = 1G;
ALTER SYSTEM SET sga_target = 800M;
ALTER SYSTEM SET pga_aggregate_target = 200M;
```

### 3. 监听器连接问题

```bash
# 检查网络配置
ping localhost
telnet localhost 1521

# 重新生成网络配置
netca -silent -responseFile netca.rsp
```

## 实践练习

> [!TIP] 💻 动手练习
> 
> ### 练习1：Docker快速安装
> 1. 使用Docker安装Oracle XE
> 2. 配置基础的数据库连接
> 3. 创建测试用户和表空间
> 
> **Docker命令参考**：

```bash
docker run -d \
  --name oracle-xe \
  -p 1521:1521 \
  -p 5500:5500 \
  -e ORACLE_PWD=OraclePass123 \
  oracle/database:21.3.0-xe
```

> 
> ### 练习2：银行环境配置
> 1. 配置用户密码策略
> 2. 启用数据库审计功能
> 3. 配置归档模式和备份策略
> 
> ### 练习3：网络配置测试
> 1. 配置监听器支持多个服务
> 2. 测试远程连接功能
> 3. 排查常见的连接问题

## 相关文档

> [!INFO] 📖 深入学习
> - **前置学习**：[[【技术与工具】/Oracle/02-Oracle架构深度解析|Oracle架构]] - 理解安装的架构基础
> - **下一步**：[[【技术与工具】/Oracle/04-Oracle基础SQL操作|Oracle基础SQL操作]] - 开始SQL学习
> - **运维进阶**：[[【技术与工具】/Oracle/21-Oracle高可用性方案|Oracle高可用性方案]] - 生产级配置

## 总结

掌握Oracle的安装和配置是Oracle学习的第一步。在银行等生产环境中，经过验证并符合适用运维与安全要求的标准化安装和配置流程，有助于提高系统的稳定性和一致性；本文的实验片段不能单独提供此类保证。

**本章重点回顾**：
- Oracle数据库安装与建库的主要步骤及尚未覆盖的前提和初始化环节
- 监听器配置和网络连接管理
- 密码、审计和归档配置示例及银行环境适用边界
- 常见安装问题的排查和解决方法