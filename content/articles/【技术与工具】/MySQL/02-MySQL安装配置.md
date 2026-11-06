---
title: MySQL安装配置完全指南 - 多平台部署与环境配置
tags:
  - MySQL
  - 安装配置
  - 环境搭建
  - Docker部署
created: 2024-06-29
updated: 2026-10-10
difficulty: 高级
duration: 60分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据治理工程师
  - 数据从业者
stability: slow-changing
status: maintenance
access_tier: free
---


# 🚀 MySQL安装配置完全指南 - 多平台部署与环境配置

> [!abstract] 📋 本节概览
> - 🎯 **学习目标**：掌握MySQL在不同平台的安装和基础配置
> - 📚 **前置知识**：[[【技术与工具】/MySQL/01-MySQL介绍与特性|MySQL介绍与特性]] | 基础Linux命令
> - ⏱️ **预计用时**：60分钟
> - 🔧 **技术重点**：多平台安装、配置文件、安全设置、Docker部署

## 🎯 安装方式选择指南

### 安装方式对比

| 安装方式 | 优势 | 劣势 | 适用场景 |
|---|---|---|---|
| **官方二进制包** | 稳定、官方支持 | 版本更新较慢 | 生产环境 |
| **包管理器** | 安装简单、依赖自动解决 | 版本可能不是最新 | 开发环境 |
| **源码编译** | 可定制构建选项，性能取决于构建配置与实际负载 | 编译复杂、耗时长 | 有定制构建需求的场景 |
| **Docker容器** | 环境隔离、部署快速 | 需要容器技术 | 开发测试 |
| **云服务** | 免运维、高可用 | 成本高、限制多 | 快速上线 |

---

## 🐧 Linux平台安装

### CentOS/RHEL 8+ 安装

```bash title="CentOS 8 安装MySQL 8.0"
# 1. 下载MySQL官方YUM源
sudo dnf install -y https://dev.mysql.com/get/mysql80-community-release-el8-1.noarch.rpm

# 2. 查看可用的MySQL版本
sudo dnf repolist enabled | grep mysql

# 3. 安装MySQL服务器
sudo dnf install -y mysql-community-server

# 4. 启动MySQL服务
sudo systemctl start mysqld
sudo systemctl enable mysqld

# 5. 获取临时root密码
sudo grep 'temporary password' /var/log/mysqld.log

# 6. 安全初始化配置
sudo mysql_secure_installation
```

### Ubuntu/Debian 安装

```bash title="Ubuntu 20.04+ 安装MySQL 8.0"
# 1. 更新包索引
sudo apt update

# 2. 安装MySQL服务器
sudo apt install -y mysql-server

# 3. 启动并设置开机自启
sudo systemctl start mysql
sudo systemctl enable mysql

# 4. 安全配置
sudo mysql_secure_installation

# 5. 登录MySQL（Ubuntu默认使用auth_socket插件）
sudo mysql
```

```sql title="Ubuntu MySQL用户配置"
-- 在MySQL中创建新用户并设置密码认证
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'your_strong_password';

-- 或者创建新的管理员用户
CREATE USER 'admin'@'localhost' IDENTIFIED BY 'admin_password';
GRANT ALL PRIVILEGES ON *.* TO 'admin'@'localhost' WITH GRANT OPTION;
FLUSH PRIVILEGES;
```

### 从源码编译安装

```bash title="源码编译安装MySQL（高级用户）"
# 1. 安装编译依赖
# CentOS/RHEL
sudo dnf groupinstall -y "Development Tools"
sudo dnf install -y cmake openssl-devel ncurses-devel bison

# Ubuntu/Debian
sudo apt install -y build-essential cmake libssl-dev libncurses5-dev bison

# 2. 下载MySQL源码
wget https://dev.mysql.com/get/Downloads/MySQL-8.0/mysql-8.0.35.tar.gz
tar -xzf mysql-8.0.35.tar.gz
cd mysql-8.0.35

# 3. 编译配置
mkdir build && cd build
cmake .. \
  -DCMAKE_INSTALL_PREFIX=/usr/local/mysql \
  -DMYSQL_DATADIR=/usr/local/mysql/data \
  -DSYSCONFDIR=/etc \
  -DWITH_SSL=system \
  -DWITH_ZLIB=system \
  -DDEFAULT_CHARSET=utf8mb4 \
  -DDEFAULT_COLLATION=utf8mb4_0900_ai_ci \
  -DENABLED_LOCAL_INFILE=1

# 4. 编译和安装（需要较长时间）
make -j$(nproc)
sudo make install

# 5. 创建MySQL用户和组
sudo groupadd mysql
sudo useradd -r -g mysql -s /bin/false mysql

# 6. 设置权限和初始化
sudo chown -R mysql:mysql /usr/local/mysql
sudo /usr/local/mysql/bin/mysqld --initialize --user=mysql

# 7. 复制SysV启动脚本（不是systemd原生服务单元，需确认系统兼容性）
sudo cp /usr/local/mysql/support-files/mysql.server /etc/init.d/mysqld
sudo systemctl enable mysqld
```

---

## 🍎 macOS平台安装

### 使用Homebrew安装（推荐）

```bash title="macOS Homebrew安装"
# 1. 安装Homebrew（如果没有）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. 安装MySQL
brew install mysql

# 3. 启动MySQL服务
brew services start mysql

# 4. 安全配置
mysql_secure_installation

# 5. 设置开机自启（可选）
brew services start mysql
```

### 使用官方DMG包安装

```bash title="macOS DMG包安装后配置"
# 1. 下载并安装DMG包
# 访问：https://dev.mysql.com/downloads/mysql/

# 2. 添加MySQL到PATH（在 ~/.zshrc 或 ~/.bash_profile 中）
export PATH="/usr/local/mysql/bin:$PATH"

# 3. 启动MySQL服务
sudo /usr/local/mysql/support-files/mysql.server start

# 4. 设置root密码
sudo /usr/local/mysql/bin/mysql_secure_installation
```

---

## 🪟 Windows平台安装

### 使用MySQL Installer（推荐）

```powershell title="Windows MySQL Installer安装"
# 1. 下载MySQL Installer
# 访问：https://dev.mysql.com/downloads/installer/

# 2. 选择安装类型
#    - Developer Default: 开发环境完整套件
#    - Server only: 仅服务器
#    - Client only: 仅客户端工具
#    - Full: 完整安装
#    - Custom: 自定义安装

# 3. 配置MySQL服务器
#    - Config Type: Development Computer/Server Computer/Dedicated Computer
#    - Connectivity: TCP/IP Port 3306
#    - Authentication: Use Strong Password Encryption (推荐)

# 4. 设置root密码和创建用户账户

# 5. Windows服务配置
#    - Service Name: MySQL80
#    - Start at System Startup: 是
```

### 使用Chocolatey安装

```powershell title="Windows Chocolatey安装"
# 1. 安装Chocolatey（如果没有）
Set-ExecutionPolicy Bypass -Scope Process -Force
iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

# 2. 安装MySQL
choco install mysql

# 3. 启动MySQL服务
net start mysql80

# 4. 登录配置
mysql -u root -p
```

---

## 🐳 Docker部署（推荐用于开发）

### 单容器部署

```bash title="Docker快速部署MySQL"
# 1. 拉取MySQL 8.0镜像
docker pull mysql:8.0

# 2. 运行MySQL容器
docker run -d \
  --name mysql-dev \
  -e MYSQL_ROOT_PASSWORD=yourpassword \
  -e MYSQL_DATABASE=testdb \
  -e MYSQL_USER=testuser \
  -e MYSQL_PASSWORD=testpass \
  -p 3306:3306 \
  -v mysql-data:/var/lib/mysql \
  mysql:8.0

# 3. 查看容器状态
docker ps
docker logs mysql-dev

# 4. 连接到MySQL
docker exec -it mysql-dev mysql -u root -p

# 5. 从宿主机连接
mysql -h localhost -P 3306 -u root -p
```

### Docker Compose部署

```yaml title="docker-compose.yml - 完整开发环境"
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: mysql-dev
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: appdb
      MYSQL_USER: appuser
      MYSQL_PASSWORD: apppassword
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./config/my.cnf:/etc/mysql/conf.d/my.cnf
      - ./init:/docker-entrypoint-initdb.d
    command: --default-authentication-plugin=mysql_native_password

  phpmyadmin:
    image: phpmyadmin:5.2
    container_name: phpmyadmin-dev
    restart: always
    ports:
      - "8080:80"
    environment:
      PMA_HOST: mysql
      PMA_PORT: 3306
      MYSQL_ROOT_PASSWORD: rootpassword
    depends_on:
      - mysql

volumes:
  mysql_data:
```

```bash title="Docker Compose操作命令"
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs mysql

# 停止服务
docker-compose down

# 停止并删除数据
docker-compose down -v
```

---

## ⚙️ 配置文件详解

### 配置文件位置

| 平台 | 配置文件路径 | 说明 |
|---|---|---|
| **Linux** | `/etc/my.cnf` 或 `/etc/mysql/my.cnf` | 常见系统级配置位置，以实际安装为准 |
| **macOS** | `$(brew --prefix)/etc/my.cnf` | Homebrew安装；先运行 `brew --prefix` 获取实际安装前缀 |
| **Windows** | `C:\ProgramData\MySQL\MySQL Server 8.0\my.ini` | 默认位置 |
| **Docker** | 本文Compose示例挂载至容器内 `/etc/mysql/conf.d/my.cnf` | 主配置位置及附加配置目录以所用镜像为准 |

### 基础配置模板

```ini title="my.cnf - 基础配置模板"
[mysql]
# 客户端默认字符集
default-character-set = utf8mb4

[mysqld]
# 基础配置
port = 3306
bind-address = 0.0.0.0
server-id = 1

# 字符集配置
character-set-server = utf8mb4
collation-server = utf8mb4_0900_ai_ci

# 数据目录
datadir = /var/lib/mysql
socket = /var/lib/mysql/mysql.sock

# 日志配置
log-error = /var/log/mysql/error.log
slow-query-log = 1
slow-query-log-file = /var/log/mysql/slow.log
long_query_time = 2

# 二进制日志（用于复制和备份）
log-bin = mysql-bin
binlog-format = ROW
expire-logs-days = 7

# InnoDB配置
innodb_buffer_pool_size = 1G  # 设置为内存的60-80%
innodb_log_file_size = 256M
innodb_flush_log_at_trx_commit = 1
innodb_file_per_table = 1

# 连接配置
max_connections = 200
max_connect_errors = 10000
wait_timeout = 3600
interactive_timeout = 3600

# 查询缓存（MySQL 5.7及之前版本）
# query_cache_type = 1
# query_cache_size = 32M

# 安全配置
sql_mode = STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO

[mysqld_safe]
log-error = /var/log/mysql/error.log
pid-file = /var/lib/mysql/mysqld.pid
```

### 性能优化配置

```ini title="my.cnf - 性能优化配置"
[mysqld]
# 内存相关配置（假设8GB内存服务器）
innodb_buffer_pool_size = 5G
innodb_buffer_pool_instances = 8
innodb_log_buffer_size = 64M

# I/O相关配置
innodb_io_capacity = 2000
innodb_io_capacity_max = 4000
innodb_flush_method = O_DIRECT
innodb_file_per_table = 1

# 线程相关配置
thread_cache_size = 50
table_open_cache = 4000
table_definition_cache = 2000

# 临时表配置
tmp_table_size = 64M
max_heap_table_size = 64M

# 排序配置
sort_buffer_size = 2M
read_buffer_size = 1M
read_rnd_buffer_size = 2M
join_buffer_size = 2M

# 网络配置
max_allowed_packet = 64M
```

---

## 🔐 安全配置

### 初始安全设置

```bash title="mysql_secure_installation详解"
# 运行安全配置脚本
mysql_secure_installation

# 配置选项说明：
# 1. 设置root密码强度验证插件
#    - LOW: 长度>=8
#    - MEDIUM: 长度>=8，包含数字、大小写字母、特殊字符
#    - STRONG: 长度>=8，包含数字、大小写字母、特殊字符、字典文件

# 2. 设置root密码

# 3. 删除匿名用户 (选择 Yes)

# 4. 禁止root远程登录 (生产环境选择 Yes)

# 5. 删除test数据库 (选择 Yes)

# 6. 重新加载权限表 (选择 Yes)
```

### 用户权限管理

```sql title="MySQL用户和权限管理"
-- 创建数据库和用户
CREATE DATABASE production_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- 创建应用用户（限制权限）
CREATE USER 'app_user'@'localhost' IDENTIFIED BY 'strong_password';
CREATE USER 'app_user'@'192.168.1.%' IDENTIFIED BY 'strong_password';

-- 授予应用权限（只授予必要权限）
GRANT SELECT, INSERT, UPDATE, DELETE ON production_db.* TO 'app_user'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON production_db.* TO 'app_user'@'192.168.1.%';

-- 创建只读用户
CREATE USER 'readonly_user'@'%' IDENTIFIED BY 'readonly_password';
GRANT SELECT ON production_db.* TO 'readonly_user'@'%';

-- 创建备份用户
CREATE USER 'backup_user'@'localhost' IDENTIFIED BY 'backup_password';
GRANT SELECT, LOCK TABLES, SHOW VIEW, EVENT, TRIGGER ON *.* TO 'backup_user'@'localhost';

-- 刷新权限
FLUSH PRIVILEGES;

-- 查看用户权限
SHOW GRANTS FOR 'app_user'@'localhost';
```

### SSL/TLS配置

```sql title="启用SSL连接"
-- 检查SSL状态
SHOW VARIABLES LIKE '%ssl%';

-- 查看SSL证书信息
SHOW STATUS LIKE 'ssl_cipher';

-- 要求用户使用SSL连接
ALTER USER 'app_user'@'192.168.1.%' REQUIRE SSL;

-- 验证SSL连接
\s  -- 在mysql客户端中显示连接状态
```

```ini title="my.cnf SSL配置"
[mysqld]
# SSL配置
ssl-ca = /etc/mysql/ssl/ca-cert.pem
ssl-cert = /etc/mysql/ssl/server-cert.pem
ssl-key = /etc/mysql/ssl/server-key.pem

# 要求使用安全传输；TCP连接须使用TLS，本地Unix socket等安全传输仍可使用
require_secure_transport = ON
```

---

## 🔧 常用管理命令

### 服务管理

```bash title="MySQL服务管理命令"
# Linux systemd
sudo systemctl start mysqld     # 启动
sudo systemctl stop mysqld      # 停止
sudo systemctl restart mysqld   # 重启
sudo systemctl status mysqld    # 状态
sudo systemctl enable mysqld    # 开机自启

# macOS
brew services start mysql       # 启动
brew services stop mysql        # 停止
brew services restart mysql     # 重启

# Windows
net start mysql80              # 启动
net stop mysql80               # 停止
sc query mysql80               # 状态

# 手动启动（调试用）
mysqld_safe --user=mysql &
```

### 连接和基础操作

```bash title="MySQL连接命令"
# 本地连接
mysql -u root -p

# 远程连接
mysql -h hostname -P 3306 -u username -p database_name

# 指定字符集连接
mysql -u root -p --default-character-set=utf8mb4

# 执行SQL文件
mysql -u root -p database_name < script.sql

# 备份数据库
mysqldump -u root -p database_name > backup.sql

# 导入数据库
mysql -u root -p database_name < backup.sql
```

---

## 🧪 安装验证

### 验证安装

```sql title="安装验证SQL命令"
-- 1. 检查MySQL版本
SELECT VERSION();

-- 2. 查看当前用户
SELECT USER();

-- 3. 查看数据库列表
SHOW DATABASES;

-- 4. 查看存储引擎
SHOW ENGINES;

-- 5. 查看字符集
SHOW VARIABLES LIKE 'character_set%';
SHOW VARIABLES LIKE 'collation%';

-- 6. 查看服务器状态
SHOW STATUS;

-- 7. 测试基本功能
CREATE DATABASE test_install;
USE test_install;
CREATE TABLE test_table (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO test_table (name) VALUES ('Test Data');
SELECT * FROM test_table;
DROP DATABASE test_install;
```

### 性能基准测试

```bash title="使用mysqlslap进行基准测试"
# 测试并发插入性能
mysqlslap \
  --user=root \
  --password \
  --host=localhost \
  --concurrency=10 \
  --iterations=100 \
  --create-schema=test_bench \
  --query="INSERT INTO t1 VALUES (NULL, 'test_data', NOW())" \
  --create="CREATE TABLE t1 (id INT AUTO_INCREMENT PRIMARY KEY, data VARCHAR(100), created_at TIMESTAMP)" \
  --engine=InnoDB

# 测试混合查询性能
mysqlslap \
  --user=root \
  --password \
  --host=localhost \
  --concurrency=20 \
  --iterations=50 \
  --number-of-queries=1000 \
  --auto-generate-sql \
  --auto-generate-sql-load-type=mixed \
  --engine=InnoDB
```

---

## 🐛 常见问题解决

### 连接问题

```bash title="解决常见连接问题"
# 1. 找不到socket文件
# 检查socket文件位置
mysql --help | grep socket
# 或者指定socket路径
mysql -u root -p --socket=/var/lib/mysql/mysql.sock

# 2. 权限问题
# 检查MySQL用户和组
ps aux | grep mysql
# 修复权限
sudo chown -R mysql:mysql /var/lib/mysql

# 3. 端口被占用
# 检查端口占用
netstat -tlnp | grep 3306
# 或使用ss命令
ss -tlnp | grep 3306

# 4. 防火墙问题
# CentOS/RHEL
sudo firewall-cmd --permanent --add-service=mysql
sudo firewall-cmd --reload

# Ubuntu
sudo ufw allow mysql
```

### 密码重置

```bash title="重置root密码"
# 方法1：跳过权限表启动
sudo systemctl stop mysqld
sudo mysqld_safe --skip-grant-tables &

mysql -u root
mysql> FLUSH PRIVILEGES;
mysql> ALTER USER 'root'@'localhost' IDENTIFIED BY 'new_password';
mysql> FLUSH PRIVILEGES;
mysql> EXIT;

sudo systemctl restart mysqld

# 已能通过有效管理员认证访问时，可使用安全初始化工具调整安全设置；这不是遗忘密码时的独立恢复方法
sudo mysql_secure_installation
```

---

## 🎓 最佳实践建议

> [!tip] 💡 安装配置最佳实践
> 1. **版本选择**：生产环境使用LTS版本，开发环境可用最新版
> 2. **安全优先**：立即运行mysql_secure_installation
> 3. **配置备份**：安装后立即备份配置文件
> 4. **监控配置**：从一开始就配置慢查询日志
> 5. **用户权限**：遵循最小权限原则
> 6. **字符集设置**：始终使用utf8mb4字符集
> 7. **备份策略**：安装后立即制定备份计划

> [!warning] ⚠️ 常见安装陷阱
> - 忘记设置字符集为utf8mb4，导致中文乱码
> - 生产环境使用默认配置，性能不佳
> - 不定期更新MySQL版本，存在安全风险
> - 忽视日志配置和监控，问题难以追踪
> - root用户的密码设置过于简单
> - 在公网对外开放3306端口

---

## 🔗 下一步学习

安装配置完成后，建议继续学习：

> [!success] ✅ 安装成功检查列表
> - [ ] 能够正常启动MySQL服务
> - [ ] 能使用root用户登录
> - [ ] 已运行mysql_secure_installation
> - [ ] 字符集设置为utf8mb4
> - [ ] 已创建应用用户并授予正确权限
> - [ ] 慢查询日志已启用
> - [ ] 能够正常创建数据库和表

- **MySQL工具生态** - 掌握各种管理工具
- **字符集与校对规则** - 处理中文和国际化
- [[【技术与工具】/MySQL/05-MySQL架构原理|MySQL架构]] - 理解内部工作原理

---

*最后更新：2024-06-29* 