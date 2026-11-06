---
title: PostgreSQL安装与配置
tags:
  - PostgreSQL
  - 安装
  - 配置
  - 环境搭建
  - psql
  - pgAdmin
difficulty: 中级
duration: 35分钟
description: 详细介绍PostgreSQL在不同操作系统上的安装方法、基本配置和常用工具的使用。
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据分析师
  - BI分析师
  - 数据库初学者
stability: slow-changing
status: maintenance
access_tier: free
updated: 2026-10-10
---


# 🔧 PostgreSQL安装与配置

## 📚 学习目标

通过本章节的学习，你将能够：
- **掌握PostgreSQL在不同操作系统上的安装方法**
- **理解PostgreSQL的基本配置**和目录结构
- **熟练使用psql命令行工具**进行基本操作
- **配置和使用pgAdmin图形化管理工具**
- **解决常见的安装和配置问题**

> [!tip] 💡 学习建议
> 安装和配置可能是最容易让初学者感到挫折的环节，**不要担心**！就像组装一台电脑，看起来复杂，但按照步骤来就很简单。如果遇到问题，**这是学习的好机会**，每个问题的解决都会让你对PostgreSQL有更深入的理解。

## 🎯 安装前的准备

### 系统要求检查

| 操作系统 | 最低版本 | 推荐版本 | 最小内存 | 推荐内存 | 磁盘空间 |
|---|---|---|---|---|---|
| **Windows** | Windows 10 | Windows 11 | 2GB | 4GB+ | 1GB+ |
| **macOS** | macOS 10.15 | macOS 12+ | 2GB | 4GB+ | 1GB+ |
| **Ubuntu** | 18.04 LTS | 22.04 LTS+ | 1GB | 2GB+ | 1GB+ |
| **CentOS/RHEL** | CentOS 7 | Rocky 8+ | 1GB | 2GB+ | 1GB+ |

### 版本选择策略

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"PingFang SC, -apple-system, Source Han Serif SC, serif","fontSize":"16px","background":"#FDFBF5","primaryColor":"#FDFBF5","primaryTextColor":"#2D2A26","primaryBorderColor":"#6E6A60","secondaryColor":"#E8EFE8","secondaryBorderColor":"#8FA890","secondaryTextColor":"#2D2A26","tertiaryColor":"#FDFBF5","tertiaryBorderColor":"#9A9488","tertiaryTextColor":"#6E6A60","lineColor":"#6E6A60","textColor":"#2D2A26","mainBkg":"#FDFBF5","nodeBorder":"#2D5A3D","clusterBkg":"#F3EEDF","clusterBorder":"#9A9488","edgeLabelBackground":"#FDFBF5"},"flowchart":{"htmlLabels":true,"curve":"basis","padding":20,"nodeSpacing":60,"rankSpacing":70,"useMaxWidth":false},"themeCSS":".node rect, .node polygon, .node circle { stroke-width: 1.5px; } .edgePath .path { stroke-width: 1.5px; } .cluster-label .nodeLabel, .cluster-label foreignObject { color: #2D2A26 !important; } .edgeLabel, .edgeLabel foreignObject { color: #2D2A26 !important; background-color: #FDFBF5; } .edgeLabel rect { fill: #FDFBF5; }"}}%%
graph TD
    A[PostgreSQL版本选择] --> B[新项目开发]
    A --> C[生产环境部署]
    A --> D[企业长期使用]
    A --> E[学习和测试]
    
    B --> B1[PostgreSQL 16.x<br/>原文开发版本示例]
    C --> C1[PostgreSQL 15.x<br/>稳定成熟]
    D --> D1[PostgreSQL 14.x<br/>原文企业版本示例]
    E --> E1[PostgreSQL 16.x<br/>本文学习测试版本]
    
    style B1 fill:#e1f5fe
    style C1 fill:#e8f5e8
    style D1 fill:#fff3e0
    style E1 fill:#f3e5f5
```

> [!abstract] 📖 版本选择建议
> - **学习和开发**：本文使用16.x作为安装示例，不将其视为持续有效的最新版本声明
> - **生产环境**：结合当前支持周期、扩展兼容性和实际测试结果选择版本，15.x仅为原文选型示例
> - **企业环境**：14.x仅为原文版本示例，并非独有的长期支持版本；应按各主要版本的支持周期制定维护计划
> - **迁移升级**：是否直接跨主要版本升级取决于升级工具、源版本、扩展兼容性与测试结果，不必一律逐版本升级

## 🪟 Windows系统安装

### 方法1：官方安装包（推荐新手）

```powershell
# 1. 下载官方安装包
# 访问 https://www.postgresql.org/download/windows/
# 选择适合的版本：postgresql-16.1-1-windows-x64.exe

# 2. 运行安装向导
# - 双击下载的.exe文件
# - 选择安装目录（默认：C:\Program Files\PostgreSQL\16）
# - 选择组件（Database Server、pgAdmin、Command Line Tools）
# - 设置数据目录（默认：C:\Program Files\PostgreSQL\16\data）
# - 设置超级用户(postgres)密码（请牢记此密码！）
# - 设置端口号（默认：5432）
# - 选择区域设置（默认：Default locale）

# 3. 验证安装
# 打开命令提示符（以管理员身份运行）
psql --version
# 应该显示：psql (PostgreSQL) 16.1

# 4. 测试连接
psql -U postgres
# 输入之前设置的密码，成功连接后会看到：
# postgres=#
```

### 方法2：使用包管理器安装

```powershell
# 使用Scoop包管理器（轻量级）
# 1. 安装Scoop（如果还没有安装）
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# 2. 安装PostgreSQL
scoop install postgresql

# 3. 初始化数据库
initdb -D $env:USERPROFILE\scoop\apps\postgresql\current\data

# 4. 启动服务
pg_ctl -D $env:USERPROFILE\scoop\apps\postgresql\current\data start

# 使用Chocolatey包管理器
# 1. 安装Chocolatey（以管理员身份运行PowerShell）
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# 2. 使用Chocolatey安装PostgreSQL
choco install postgresql --params '/Password:mypassword123'

# 3. 验证安装
psql --version
```

### Windows配置优化

```powershell
# 1. 设置环境变量（方便命令行使用）
# 将以下路径添加到系统PATH环境变量：
# C:\Program Files\PostgreSQL\16\bin
# C:\Program Files\PostgreSQL\16\lib

# 2. 启动/停止服务
# 方法1：使用服务管理器
services.msc
# 找到 "postgresql-x64-16" 服务

# 方法2：使用命令行
net start postgresql-x64-16
net stop postgresql-x64-16

# 3. 设置开机自启动
sc config postgresql-x64-16 start=auto

# 4. 创建快捷连接
# 创建批处理文件 connect_postgres.bat
echo @echo off > connect_postgres.bat
echo psql -U postgres >> connect_postgres.bat
echo pause >> connect_postgres.bat
```

## 🍎 macOS系统安装

### 方法1：使用Homebrew（强烈推荐）

```bash
# 1. 安装Homebrew（如果还没有安装）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. 更新Homebrew
brew update

# 3. 安装本文示例使用的PostgreSQL 16
brew install postgresql@16

# 4. 设置环境变量（添加到~/.zshrc或~/.bash_profile）
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# 5. 初始化数据库
initdb /opt/homebrew/var/postgresql@16

# 6. 启动PostgreSQL服务
brew services start postgresql@16

# 7. 创建与用户名同名的数据库（PostgreSQL惯例）
createdb $USER

# 8. 测试连接
psql
# 应该能直接连接，无需密码（本地信任连接）
```

### 方法2：使用官方安装包

```bash
# 1. 下载官方安装包
# 访问 https://www.postgresql.org/download/macosx/
# 下载 postgresql-16.1-1-osx.dmg

# 2. 安装.dmg文件
# 双击下载的.dmg文件，按照安装向导操作

# 3. 配置环境变量
echo 'export PATH="/Library/PostgreSQL/16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# 4. 验证安装
psql --version

# 5. 连接数据库
psql -U postgres
# 输入安装时设置的密码
```

### 方法3：使用Docker（开发推荐）

```bash
# 1. 安装Docker Desktop for Mac
# 从 https://www.docker.com/products/docker-desktop 下载安装

# 2. 拉取PostgreSQL镜像并运行
docker run --name postgres-dev \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_USER=devuser \
  -e POSTGRES_DB=devdb \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  -d postgres:16

# 3. 验证容器运行
docker ps | grep postgres

# 4. 连接数据库
docker exec -it postgres-dev psql -U devuser -d devdb

# 5. 创建开发环境别名（添加到~/.zshrc）
echo 'alias pgdev="docker exec -it postgres-dev psql -U devuser -d devdb"' >> ~/.zshrc
source ~/.zshrc

# 现在可以使用 pgdev 命令快速连接
pgdev
```

### macOS维护命令

```bash
# 查看服务状态
brew services list | grep postgresql

# 重启服务
brew services restart postgresql@16

# 停止服务
brew services stop postgresql@16

# 查看日志
tail -f /opt/homebrew/var/log/postgresql@16.log

# 升级PostgreSQL
brew upgrade postgresql@16
```

## 🐧 Linux系统安装

### Ubuntu/Debian系统

```bash
# 方法1：使用apt安装（官方仓库版本）
# 1. 更新包索引
sudo apt update

# 2. 安装PostgreSQL和扩展工具
sudo apt install postgresql postgresql-contrib postgresql-client-common

# 3. 检查安装版本
sudo -u postgres psql -c "SELECT version();"

# 方法2：安装最新版本（PostgreSQL官方APT仓库）
# 1. 导入GPG密钥
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# 2. 添加PostgreSQL官方APT仓库
echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" | sudo tee /etc/apt/sources.list.d/postgresql.list

# 3. 更新包索引
sudo apt update

# 4. 安装指定版本的PostgreSQL
sudo apt install postgresql-16 postgresql-contrib-16

# 5. 启动和启用服务
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 6. 检查服务状态
sudo systemctl status postgresql

# 7. 切换到postgres用户并设置密码
sudo -i -u postgres
psql
\password postgres
# 输入新密码
\q
exit

# 8. 创建普通数据库用户
sudo -u postgres createuser --interactive --pwprompt
# 输入用户名、密码和权限设置

# 9. 创建数据库
sudo -u postgres createdb -O your_username your_database_name

# 10. 测试连接
psql -h localhost -U your_username -d your_database_name
```

### CentOS/RHEL/Rocky Linux系统

```bash
# 1. 安装PostgreSQL官方RPM仓库
sudo yum install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-$(rpm -E %rhel)-x86_64/pgdg-redhat-repo-latest.noarch.rpm

# 2. 安装PostgreSQL 16
sudo yum install -y postgresql16-server postgresql16 postgresql16-contrib

# 3. 初始化数据库
sudo /usr/pgsql-16/bin/postgresql-16-setup initdb

# 4. 启动和启用服务
sudo systemctl enable postgresql-16
sudo systemctl start postgresql-16

# 5. 检查服务状态
sudo systemctl status postgresql-16

# 6. 配置防火墙（如果启用了firewalld）
sudo firewall-cmd --permanent --add-port=5432/tcp
sudo firewall-cmd --reload

# 7. 配置PostgreSQL用户
sudo -i -u postgres
psql
\password postgres
\q
exit

# 8. 修改认证配置（允许密码认证）
sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /var/lib/pgsql/16/data/postgresql.conf
sudo sed -i "s/local   all             all                                     peer/local   all             all                                     md5/" /var/lib/pgsql/16/data/pg_hba.conf

# 9. 重启服务应用配置
sudo systemctl restart postgresql-16

# 10. 测试连接
psql -h localhost -U postgres
```

### 使用Docker在Linux上运行

```bash
# 1. 安装Docker
# Ubuntu/Debian
sudo apt update
sudo apt install docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# CentOS/RHEL
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# 2. 退出并重新登录以应用组权限

# 3. 创建PostgreSQL容器
docker run --name postgres-prod \
  -e POSTGRES_PASSWORD=securepassword \
  -e POSTGRES_DB=myapp \
  -p 5432:5432 \
  -v /opt/postgres_data:/var/lib/postgresql/data \
  -d postgres:16

# 4. 创建docker-compose.yml文件（本地测试示例，不是完整生产配置）
# 固定密码仅作占位；生产环境需另行配置密钥管理、网络访问控制、备份与监控。
cat > docker-compose.yml << EOF
version: '3.8'
services:
  postgres:
    image: postgres:16
    container_name: postgres-prod
    environment:
      POSTGRES_PASSWORD: securepassword
      POSTGRES_DB: myapp
      POSTGRES_USER: appuser
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    restart: unless-stopped
    
volumes:
  postgres_data:
EOF

# 5. 启动服务
docker-compose up -d

# 6. 检查运行状态
docker-compose ps
```

## ⚙️ 基本配置详解

### 配置文件位置和查找

```bash
# 查找PostgreSQL配置文件位置
psql -U postgres -c "SHOW config_file;"
psql -U postgres -c "SHOW hba_file;" 
psql -U postgres -c "SHOW data_directory;"

# 常见配置文件路径：
# Ubuntu/Debian: /etc/postgresql/16/main/
# CentOS/RHEL: /var/lib/pgsql/16/data/
# macOS (Homebrew): /opt/homebrew/var/postgresql@16/
# Windows: C:\Program Files\PostgreSQL\16\data\
```

### 主配置文件 postgresql.conf

```ini
# =============================
# 连接和认证设置
# =============================
listen_addresses = 'localhost'          # 监听地址，'*' 表示所有接口
port = 5432                             # 默认端口
max_connections = 100                   # 最大并发连接数

# =============================
# 内存配置（根据服务器配置调整）
# =============================
shared_buffers = 128MB                  # 共享缓冲区（推荐：总内存的25%）
work_mem = 4MB                          # 每个查询操作的内存
maintenance_work_mem = 64MB             # 维护操作的内存
effective_cache_size = 4GB              # 操作系统缓存大小估计

# =============================
# 写入和持久化配置
# =============================
wal_level = replica                     # WAL级别（minimal/replica/logical）
max_wal_senders = 3                     # 最大WAL发送进程数
checkpoint_timeout = 5min               # 检查点间隔
checkpoint_completion_target = 0.7      # 检查点完成目标

# =============================
# 查询优化配置
# =============================
random_page_cost = 1.1                 # SSD设置为1.1，HDD设置为4
effective_io_concurrency = 200         # 并发I/O操作数

# =============================
# 日志配置
# =============================
logging_collector = on                 # 启用日志收集器
log_directory = 'log'                  # 日志目录
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_size = 10MB               # 日志轮转大小
log_rotation_age = 1d                  # 日志轮转周期
log_statement = 'none'                 # 记录语句（none/ddl/mod/all）
log_duration = off                     # 记录语句执行时间
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '

# =============================
# 统计信息配置
# =============================
track_counts = on                      # 收集统计信息
track_functions = none                 # 跟踪函数调用
track_activity_query_size = 1024       # 跟踪活动查询大小
```

### 认证配置文件 pg_hba.conf

```ini
# PostgreSQL Client Authentication Configuration File
# ===================================================
# 
# 格式: TYPE  DATABASE  USER  ADDRESS  METHOD  [OPTIONS]
#
# TYPE: local（Unix套接字）| host（TCP/IP）| hostssl（SSL连接）| hostnossl（非SSL连接）
# DATABASE: 数据库名 | all
# USER: 用户名 | all  
# ADDRESS: IP地址/掩码 | 主机名
# METHOD: trust | reject | md5 | password | scram-sha-256 | peer | ident

# ===================================================
# 本地连接配置
# ===================================================

# Unix套接字连接（仅限本地）
local   all             postgres                                peer
local   all             all                                     peer

# ===================================================
# IPv4本地连接
# ===================================================

# 本地回环地址连接
host    all             all             127.0.0.1/32            scram-sha-256

# ===================================================
# IPv6本地连接  
# ===================================================

# IPv6本地回环
host    all             all             ::1/128                 scram-sha-256

# ===================================================
# 局域网连接配置（根据需要启用）
# ===================================================

# 允许局域网192.168.1.0/24网段连接
# host    all             all             192.168.1.0/24          scram-sha-256

# 允许特定IP连接
# host    mydb            myuser          192.168.1.100/32        scram-sha-256

# ===================================================
# 开发环境配置（仅用于开发，生产环境禁用）
# ===================================================

# 开发环境信任连接（不推荐用于生产）
# host    all             all             192.168.0.0/16          trust

# ===================================================
# SSL连接配置
# ===================================================

# 要求SSL连接
# hostssl all             all             0.0.0.0/0               scram-sha-256

# 禁止非SSL连接
# hostnossl all           all             0.0.0.0/0               reject
```

### 应用配置更改

```bash
# 方法1：重启PostgreSQL服务（所有配置生效）
# Linux
sudo systemctl restart postgresql

# macOS (Homebrew)
brew services restart postgresql@16

# Windows
net stop postgresql-x64-16
net start postgresql-x64-16

# 方法2：重新加载配置（部分配置生效，无需重启）
psql -U postgres -c "SELECT pg_reload_conf();"

# 或者发送SIGHUP信号
sudo kill -HUP $(head -1 /var/lib/postgresql/16/main/postmaster.pid)

# 查看哪些配置需要重启
psql -U postgres -c "SELECT name, setting, pending_restart FROM pg_settings WHERE pending_restart = true;"
```

## 💻 psql命令行工具精通

### 连接数据库的多种方式

```bash
# 基本连接语法
psql -h hostname -p port -U username -d database

# 常用连接示例
psql -U postgres                           # 以postgres用户连接默认数据库
psql -d mydb                               # 连接到mydb数据库
psql -h localhost -p 5432 -U user -d db   # 完整连接参数

# 使用连接字符串（URI格式）
psql "postgresql://username:password@localhost:5432/database"
psql "postgresql://user@localhost/mydb?sslmode=require"

# 使用环境变量
export PGHOST=localhost
export PGPORT=5432
export PGUSER=myuser
export PGDATABASE=mydb
export PGPASSWORD=mypassword
psql  # 直接连接，使用环境变量中的配置

# 使用.pgpass文件（推荐的安全方式）
# 创建~/.pgpass文件（权限设置为600）
echo "localhost:5432:mydb:myuser:mypassword" > ~/.pgpass
chmod 600 ~/.pgpass
psql -h localhost -U myuser -d mydb  # 无需输入密码
```

### 常用psql元命令大全

```sql
-- =============================
-- 帮助和信息命令
-- =============================
\?                          -- 显示所有psql命令帮助
\h                          -- 显示SQL命令帮助
\h CREATE TABLE             -- 显示特定SQL命令帮助

-- =============================
-- 数据库操作命令
-- =============================
\l                          -- 列出所有数据库
\l+                         -- 显示数据库详细信息
\c database_name            -- 连接到指定数据库
\c - username               -- 切换用户但保持当前数据库
\conninfo                   -- 显示当前连接信息

-- =============================
-- 表和视图操作
-- =============================
\dt                         -- 列出当前数据库的所有表
\dt+                        -- 显示表的详细信息（大小等）
\dt schema_name.*           -- 列出指定模式的表
\d table_name               -- 描述表结构
\d+ table_name              -- 显示表的详细信息
\dv                         -- 列出所有视图
\di                         -- 列出所有索引
\ds                         -- 列出所有序列

-- =============================
-- 用户和权限命令
-- =============================
\du                         -- 列出所有用户和角色
\du+                        -- 显示用户详细信息
\dp table_name              -- 显示表的权限信息
\z table_name               -- 同\dp，显示权限信息

-- =============================
-- 模式和函数命令
-- =============================
\dn                         -- 列出所有模式
\df                         -- 列出所有函数
\df+                        -- 显示函数详细信息
\dT                         -- 列出所有数据类型

-- =============================
-- 查询和输出控制
-- =============================
\x                          -- 切换扩展显示模式（垂直显示）
\x auto                     -- 自动选择显示模式
\timing                     -- 显示/隐藏SQL语句执行时间
\pset pager off             -- 关闭分页器
\pset null '[NULL]'         -- 设置NULL值的显示方式

-- =============================
-- 文件操作命令
-- =============================
\i filename                 -- 执行文件中的SQL命令
\o filename                 -- 将查询结果输出到文件
\o                          -- 停止输出到文件，恢复到标准输出
\copy table FROM 'file.csv' WITH CSV HEADER;  -- 从文件导入数据

-- =============================
-- 编辑和历史命令
-- =============================
\e                          -- 在外部编辑器中编辑查询缓冲区
\e filename                 -- 编辑文件
\s                          -- 显示命令历史
\s filename                 -- 将命令历史保存到文件

-- =============================
-- 其他实用命令
-- =============================
\q                          -- 退出psql
\! command                  -- 执行shell命令
\cd directory               -- 改变当前目录
\! pwd                      -- 在类Unix系统中通过shell显示当前目录；Windows使用\! cd
```

### psql个性化配置

```bash
# 创建.psqlrc配置文件
vi ~/.psqlrc
```

```sql
-- ~/.psqlrc 配置示例

-- 设置提示符（显示用户@数据库）
\set PROMPT1 '%[%033[1;32m%]%n@%/%R%[%033[0m%]%# '
\set PROMPT2 '%[%033[1;32m%]%n@%/%R%[%033[0m%]%# '
\set PROMPT3 '>> '

-- 自动开启执行时间显示
\timing

-- 设置命令历史记录数量
\set HISTSIZE 2000
\set HISTCONTROL ignoredups

-- 设置NULL值显示
\pset null '[NULL]'

-- 自动扩展显示
\x auto

-- 设置分页器
\pset pager off

-- 定义常用查询别名
\set version 'SELECT version();'
\set extensions 'SELECT * FROM pg_available_extensions ORDER BY name;'
\set activity 'SELECT datname, pid, usename, application_name, client_addr, state, query FROM pg_stat_activity WHERE state <> \'idle\' ORDER BY query_start;'
\set locks 'SELECT l.mode, l.locktype, l.database, l.relation, l.page, l.tuple, l.classid, l.granted, l.objid, l.objsubid, l.pid, l.transactionid FROM pg_locks l;'
\set waits 'SELECT pid, query, wait_event_type, wait_event, now() - query_start AS totaltime, backend_start FROM pg_stat_activity WHERE state = \'active\' AND wait_event IS NOT NULL;'

-- 设置默认编码
\encoding UTF8

-- 打印欢迎信息
\echo '\n欢迎使用PostgreSQL! 输入 :version 查看版本信息\n'
```

### 常用查询快捷脚本

创建一个查询脚本文件 `~/postgres_queries.sql`：

```sql
-- 常用PostgreSQL管理查询脚本

-- 查看数据库大小
SELECT datname AS database_name, 
       pg_size_pretty(pg_database_size(datname)) AS size
FROM pg_database 
WHERE datistemplate = false 
ORDER BY pg_database_size(datname) DESC;

-- 查看表大小
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
       pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS non_main_relation_size
FROM pg_tables 
WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 查看活动连接
SELECT pid, usename, application_name, client_addr, state, 
       query_start, now() - query_start AS duration, query
FROM pg_stat_activity 
WHERE state <> 'idle' AND pid <> pg_backend_pid()
ORDER BY query_start;

-- 查看累计执行耗时较高的语句（PostgreSQL 16示例）
-- 前置：已安装pg_stat_statements，已将其加入shared_preload_libraries并重启服务，
-- 且已在当前数据库执行CREATE EXTENSION pg_stat_statements。
SELECT query, calls, total_exec_time, mean_exec_time, rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- 查看索引使用情况
SELECT schemaname, relname AS tablename, indexrelname AS indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes 
ORDER BY idx_scan ASC;

-- 查看表统计信息
SELECT schemaname, relname AS tablename, n_tup_ins, n_tup_upd, n_tup_del, n_live_tup, n_dead_tup
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;
```

在psql中使用：`\i ~/postgres_queries.sql`

## 🖥️ pgAdmin图形化管理工具

### 安装pgAdmin 4

```bash
# Windows
# 从官网下载安装包: https://www.pgadmin.org/download/pgadmin-4-windows/

# macOS
brew install --cask pgadmin4

# Ubuntu/Debian
curl -fsS https://www.pgadmin.org/static/packages_pgadmin_org.pub | sudo gpg --dearmor -o /usr/share/keyrings/packages-pgadmin-org.gpg
sudo sh -c 'echo "deb [signed-by=/usr/share/keyrings/packages-pgadmin-org.gpg] https://ftp.postgresql.org/pub/pgadmin/pgadmin4/apt/$(lsb_release -cs) pgadmin4 main" > /etc/apt/sources.list.d/pgadmin4.list'
sudo apt update
sudo apt install pgadmin4

# 或者使用Docker（推荐用于开发）
docker run --name pgadmin4 \
  -e PGADMIN_DEFAULT_EMAIL=admin@example.com \
  -e PGADMIN_DEFAULT_PASSWORD=admin123 \
  -e PGADMIN_LISTEN_PORT=80 \
  -p 8080:80 \
  -v pgadmin_data:/var/lib/pgadmin \
  -d dpage/pgadmin4

# 访问 http://localhost:8080
```

### pgAdmin基本配置和使用

```sql
-- 1. 首次启动配置
-- 启动pgAdmin后，会要求设置主密码（Master Password）
-- 这个密码用于加密存储的服务器连接信息

-- 2. 添加服务器连接
-- 右键"Servers" -> "Register" -> "Server"
-- General选项卡:
--   Name: Local PostgreSQL Server
-- Connection选项卡:
--   Host name/address: localhost
--   Port: 5432  
--   Maintenance database: postgres
--   Username: postgres
--   Password: [your_password]
--   Save password: ✓

-- 3. 使用查询工具
-- 右键数据库 -> "Query Tool"
-- 或使用快捷键: Alt+Shift+Q

-- 示例查询1：检查连接和版本
SELECT 
    version() AS postgres_version,
    current_database() AS current_db,
    current_user AS current_user,
    inet_server_addr() AS server_ip,
    inet_server_port() AS server_port;

-- 示例查询2：数据库统计
SELECT 
    datname AS database_name,
    numbackends AS active_connections,
    xact_commit AS transactions_committed,
    xact_rollback AS transactions_rolled_back,
    blks_read AS blocks_read,
    blks_hit AS blocks_hit,
    tup_returned AS tuples_returned,
    tup_fetched AS tuples_fetched,
    tup_inserted AS tuples_inserted,
    tup_updated AS tuples_updated,
    tup_deleted AS tuples_deleted
FROM pg_stat_database 
WHERE datname NOT IN ('template0', 'template1')
ORDER BY active_connections DESC;

-- 4. 图形化操作示例
-- 创建数据库：右键"Databases" -> "Create" -> "Database"
-- 创建表：展开数据库 -> 右键"Tables" -> "Create" -> "Table"
-- 查看数据：右键表 -> "View/Edit Data" -> "All Rows"
-- 导入数据：右键表 -> "Import/Export Data"
```

### pgAdmin高级功能

```sql
-- 性能监控仪表板
-- 在服务器节点下可以看到"Dashboard"
-- 显示：
-- - 服务器活动 (Server Activity)
-- - 数据库统计 (Database Statistics)  
-- - 图表监控 (Charts)

-- 查询历史和解释计划
-- 在Query Tool中：
-- 1. 执行查询
-- 2. 点击"Explain"按钮查看执行计划
-- 3. 点击"Explain Analyze"查看实际执行统计

-- 示例：分析查询性能
-- 本文未提供products和categories的建表与数据；仅在已有对应表时运行，
-- 或将表名、字段和连接条件替换为实际结构。ANALYZE会实际执行查询。
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) 
SELECT p.product_name, c.category_name, p.price 
FROM products p 
JOIN categories c ON p.category_id = c.id 
WHERE p.price > 100 
ORDER BY p.price DESC;

-- 备份和恢复（通过pgAdmin界面）
-- 右键数据库 -> "Backup"
-- 选择格式：Custom, Tar, Plain
-- 设置文件名和选项

-- 恢复：右键数据库 -> "Restore"
-- 选择备份文件和恢复选项
```

## 🔍 安装验证和测试

### 全面安装验证脚本

创建验证脚本 `verify_installation.sql`：

```sql
-- PostgreSQL安装验证脚本
-- ======================

\echo '================================================='
\echo '           PostgreSQL安装验证开始'
\echo '================================================='

-- 1. 版本信息检查
\echo '\n1. 检查PostgreSQL版本信息:'
SELECT version() AS postgresql_version;

-- 2. 当前连接信息
\echo '\n2. 当前连接信息:'
SELECT 
    current_database() AS database_name,
    current_user AS current_user,
    session_user AS session_user,
    inet_server_addr() AS server_address,
    inet_server_port() AS server_port;

-- 3. 数据库列表
\echo '\n3. 可用数据库列表:'
\l

-- 4. 创建测试数据库
-- 警告：以下语句会删除已有的installation_test数据库及其数据。
-- 仅在隔离测试环境中、确认该库没有需要保留的数据后执行。
\echo '\n4. 创建测试数据库...'
DROP DATABASE IF EXISTS installation_test;
CREATE DATABASE installation_test;
\c installation_test

-- 5. 测试基本SQL功能
\echo '\n5. 测试基本SQL功能:'

-- 创建测试表
CREATE TABLE test_basic (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    age INTEGER CHECK (age >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB,
    tags TEXT[]
);

-- 插入测试数据
INSERT INTO test_basic (name, email, age, metadata, tags) VALUES 
    ('张三', 'zhangsan@example.com', 28, '{"department": "IT", "level": "senior"}', ARRAY['developer', 'python']),
    ('李四', 'lisi@example.com', 32, '{"department": "Sales", "level": "manager"}', ARRAY['sales', 'manager']),
    ('王五', 'wangwu@example.com', 25, '{"department": "IT", "level": "junior"}', ARRAY['developer', 'javascript']);

-- 测试查询功能
\echo '\n基本查询测试:'
SELECT COUNT(*) AS total_records FROM test_basic;

\echo '\nJSON功能测试:'
SELECT name, metadata->>'department' AS department FROM test_basic WHERE metadata->>'level' = 'senior';

\echo '\n数组功能测试:'
SELECT name, tags FROM test_basic WHERE 'developer' = ANY(tags);

-- 6. 测试索引功能
\echo '\n6. 测试索引功能:'
CREATE INDEX idx_test_email ON test_basic(email);
CREATE INDEX idx_test_metadata ON test_basic USING GIN(metadata);
CREATE INDEX idx_test_tags ON test_basic USING GIN(tags);

\echo '索引创建完成，检查索引:'
\di

-- 7. 测试事务功能
\echo '\n7. 测试事务功能:'
BEGIN;
    INSERT INTO test_basic (name, email, age) VALUES ('测试用户', 'test@example.com', 30);
    SELECT name FROM test_basic WHERE email = 'test@example.com';
    \echo '事务中可以看到新插入的数据'
ROLLBACK;

SELECT name FROM test_basic WHERE email = 'test@example.com';
\echo '事务回滚后，数据不存在（如果上面查询无结果，说明事务功能正常）'

-- 8. 测试函数和存储过程
\echo '\n8. 测试自定义函数:'
CREATE OR REPLACE FUNCTION get_user_age(user_name TEXT) 
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT age FROM test_basic WHERE name = user_name);
END;
$$ LANGUAGE plpgsql;

SELECT get_user_age('张三') AS zhangsan_age;

-- 9. 测试窗口函数
\echo '\n9. 测试窗口函数:'
SELECT 
    name, 
    age, 
    ROW_NUMBER() OVER (ORDER BY age DESC) AS age_rank,
    AVG(age) OVER () AS avg_age
FROM test_basic;

-- 10. 测试CTE（公共表表达式）
\echo '\n10. 测试CTE功能:'
WITH age_stats AS (
    SELECT 
        AVG(age) as avg_age,
        MIN(age) as min_age,
        MAX(age) as max_age
    FROM test_basic
)
SELECT 
    name,
    age,
    CASE 
        WHEN age > (SELECT avg_age FROM age_stats) THEN '高于平均年龄'
        ELSE '低于等于平均年龄'
    END as age_category
FROM test_basic;

-- 11. 性能测试
\echo '\n11. 简单性能测试:'
\timing on

-- 创建大一点的测试表
CREATE TABLE performance_test AS 
SELECT 
    generate_series(1, 10000) as id,
    'User ' || generate_series(1, 10000) as name,
    random() * 100 as score,
    NOW() - (random() * 365)::int * INTERVAL '1 day' as created_date;

CREATE INDEX idx_perf_score ON performance_test(score);

-- 执行一些查询测试性能
SELECT COUNT(*) FROM performance_test;
SELECT AVG(score) FROM performance_test;
SELECT * FROM performance_test WHERE score > 90 ORDER BY score DESC LIMIT 10;

\timing off

-- 12. 扩展测试
\echo '\n12. 测试可用扩展:'
SELECT name, installed_version, comment 
FROM pg_available_extensions 
WHERE name IN ('uuid-ossp', 'pgcrypto', 'hstore', 'ltree')
ORDER BY name;

-- 13. 清理测试数据
\echo '\n13. 清理测试环境:'
\c postgres
DROP DATABASE installation_test;

\echo '\n================================================='
\echo '           PostgreSQL安装验证完成'
\echo '           如果以上测试都成功，说明安装正常'
\echo '================================================='
```

运行验证脚本：

```bash
psql -U postgres -f verify_installation.sql
```

## 🔧 常见问题诊断和解决

### 连接问题排查

```bash
# 问题1：无法连接到服务器
# 错误信息：psql: error: connection to server on socket "/tmp/.s.PGSQL.5432" failed

# 解决步骤：
# 1. 检查PostgreSQL服务状态
sudo systemctl status postgresql     # Linux
brew services list | grep postgresql # macOS
sc query postgresql-x64-16          # Windows

# 2. 检查端口监听
sudo netstat -tlnp | grep :5432     # Linux
netstat -an | grep :5432            # macOS/Windows

# 3. 检查配置文件
psql -U postgres -c "SHOW config_file;" 2>/dev/null || echo "服务未运行"
```

```sql
-- 检查监听配置
SHOW listen_addresses;
SHOW port;
SHOW max_connections;

-- 检查当前连接数
SELECT count(*) as current_connections, max_conn, 
       round((count(*) * 100.0 / max_conn), 2) as percent_used
FROM pg_stat_activity, (SELECT setting::int as max_conn FROM pg_settings WHERE name = 'max_connections') mc
GROUP BY max_conn;
```

### 认证问题解决

```bash
# 问题2：认证失败
# 错误信息：psql: FATAL: password authentication failed for user "postgres"

# 解决方案：
# 1. 重置postgres用户密码（Linux/macOS）
sudo -u postgres psql -c "\password postgres"

# 2. 检查pg_hba.conf配置
sudo find / -name pg_hba.conf 2>/dev/null | head -1
# 编辑文件，确保有正确的认证配置

# 3. 重启服务应用更改
sudo systemctl restart postgresql

# 4. Windows系统重置密码
# 以管理员身份运行命令提示符
psql -U postgres
# 如果能连接，执行：\password postgres
```

### 权限问题修复

```sql
-- 问题3：权限不足
-- 错误信息：ERROR: permission denied for table/database

-- 解决方案：
-- 1. 以超级用户身份连接
-- psql -U postgres

-- 2. 检查用户权限
\du

-- 3. 授予必要权限
-- 数据库级权限
GRANT ALL PRIVILEGES ON DATABASE mydb TO myuser;
GRANT CONNECT ON DATABASE mydb TO myuser;
GRANT USAGE ON SCHEMA public TO myuser;

-- 表级权限
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO myuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO myuser;

-- 默认权限（新建对象自动授权）
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO myuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO myuser;

-- 4. 创建具有特定权限的用户
CREATE USER readonly_user WITH PASSWORD 'password123';
GRANT CONNECT ON DATABASE mydb TO readonly_user;
GRANT USAGE ON SCHEMA public TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly_user;
```

### 性能问题诊断

```sql
-- 问题4：查询性能慢

-- 1. 检查慢查询
-- 首先启用慢查询日志（在postgresql.conf中）
-- log_min_duration_statement = 1000  # 记录超过1秒的查询

-- 2. 实时查看慢查询
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes' AND state = 'active';

-- 3. 分析具体查询
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) 
SELECT * FROM large_table WHERE some_column = 'some_value';

-- 4. 检查索引使用情况
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats 
WHERE schemaname = 'public' AND tablename = 'your_table_name';

-- 5. 查看表与索引的空间构成（此比例不能直接判断表膨胀）
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
       pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
       round((pg_relation_size(schemaname||'.'||tablename) * 100.0 / pg_total_relation_size(schemaname||'.'||tablename)), 2) AS table_ratio
FROM pg_tables 
WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 6. 更新表统计信息
ANALYZE your_table_name;
-- 或者全数据库更新
ANALYZE;
```

### 磁盘空间问题

```bash
# 问题5：磁盘空间不足

# 1. 检查PostgreSQL数据目录占用
du -sh /var/lib/postgresql/16/main/    # Linux
du -sh /opt/homebrew/var/postgresql@16/ # macOS

# 2. 检查各数据库大小
psql -U postgres -c "
SELECT datname as database_name,
       pg_size_pretty(pg_database_size(datname)) as size,
       (pg_database_size(datname) * 100.0 / (SELECT SUM(pg_database_size(datname)) FROM pg_database)) as percent
FROM pg_database 
WHERE datistemplate = false 
ORDER BY pg_database_size(datname) DESC;"

# 3. 检查日志文件大小
find /var/lib/postgresql/16/main/log/ -name "*.log" -exec du -sh {} \; | sort -hr

# 4. 排查WAL空间占用（不要手工清理活动pg_wal目录）
# 即使没有复制设置，也不能据此删除实例所需的WAL。
# pg_archivecleanup用于独立归档目录，并需要明确的保留截止文件参数；
# 归档清理须同时满足备份恢复和复制保留要求，不适用于这里的活动pg_wal路径。
```

```sql
-- 清理策略
-- 1. 删除不必要的数据
-- 2. 使用VACUUM FULL重写表并回收空间
-- 此操作需要ACCESS EXCLUSIVE锁并占用额外磁盘空间；应在评估空间和维护窗口后执行。
-- 普通VACUUM主要使空间可供数据库重用，通常不会将其归还操作系统。
VACUUM FULL VERBOSE table_name;

-- 3. 重建索引
-- 普通REINDEX TABLE会阻塞表上的写入，并需要额外空间；应评估维护窗口后执行。
REINDEX TABLE table_name;

-- 4. 配置自动清理
-- 在postgresql.conf中设置：
-- autovacuum = on
-- autovacuum_max_workers = 3
-- autovacuum_naptime = 1min
```

## 🎯 小结

通过本章节的学习，我们全面掌握了PostgreSQL的安装与配置：

### 核心收获

1. **多平台安装方法**：掌握了Windows、macOS、Linux系统的多种安装方式
2. **配置文件理解**：深入了解postgresql.conf和pg_hba.conf的配置
3. **命令行精通**：熟练使用psql工具和元命令
4. **图形化工具**：学会使用pgAdmin进行数据库管理
5. **问题诊断能力**：具备了解决常见安装配置问题的能力

### 最佳实践建议

- **开发环境**：推荐使用Docker或Homebrew，便于版本管理和环境隔离
- **生产环境**：使用官方包管理器安装，确保稳定性和安全更新
- **配置管理**：使用版本控制管理配置文件，便于环境一致性
- **监控设置**：从安装开始就配置好日志和监控，便于后续运维

> [!abstract] 📚 下一步学习
> 现在你已经成功安装并配置了PostgreSQL，接下来我们将学习[[【技术与工具】/PostgreSQL/03-PostgreSQL数据类型与表设计|PostgreSQL数据类型与表]]，开始真正的数据库设计和开发之旅。

## 🔗 相关资源

在PostgreSQL安装配置学习过程中，推荐了解以下相关内容：

### 基础链接
- [[【技术与工具】/PostgreSQL/00-PostgreSQL学习路线图|PostgreSQL]] - 回到整体学习规划
- [[【技术与工具】/PostgreSQL/01-PostgreSQL基础概念与特性|PostgreSQL基础概念与特性]] - 理解PostgreSQL特性

### 进阶资源  
- Docker容器技术 - 容器化部署PostgreSQL
- Linux系统管理 - 系统管理和运维基础
- 数据库安全 - 生产环境安全配置

### 工具链接
- [[【数据分析与数据运营】/01-共同能力基础/03-工具掌握/01-SQL基本概念|共同能力基础/SQL基本概念]] - SQL语言基础
- 数据库设计原理 - 关系型数据库理论

---

> 💡 **记住**：安装和配置是学习PostgreSQL的重要基础，**不要急于求成**。每个配置选项都有其意义，随着学习的深入，你会逐渐理解它们的作用。**遇到问题是正常的**，解决问题的过程也是学习的过程。建议将常用的配置和命令记录下来，形成自己的知识库！