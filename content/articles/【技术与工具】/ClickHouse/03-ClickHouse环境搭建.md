---
title: ClickHouse环境搭建
tags:
  - ClickHouse
  - 安装部署
  - Docker
  - 配置管理
  - 客户端连接
difficulty: 中级
duration: 30分钟
description: 学习ClickHouse的Docker、系统软件包和预编译包安装方法，以及配置和客户端连接；用于开发测试，生产部署还需补充安全、备份与版本验证。
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据分析师
  - BI分析师
  - 数据科学家
stability: fast-changing
status: maintenance
access_tier: free
updated: 2026-10-10
---


# 🛠️ ClickHouse环境搭建

## 📚 学习目标

通过本章节的学习，你将能够：
- **掌握多种ClickHouse安装方法**和适用场景
- **学会Docker快速部署**ClickHouse环境
- **理解配置文件管理**和常用配置项
- **掌握客户端连接方法**和工具使用
- **建立完整的开发测试环境**

> [!tip] 💡 学习建议
> 环境搭建是学习的第一步，**建议优先使用Docker方式快速搭建**。就像装修房子先搭脚手架一样，**有了稳定的环境，后续学习会更顺利**。不要在环境问题上花费太多时间，先跑起来再深入优化。

## 🚀 快速开始 - Docker部署

### 1. 单机Docker部署

陈技师放下手中的设备清单，热情地迎接参观团："欢迎来到我们医院的设备安装部门！大家想了解智能医疗设备的安装过程，对吧？这就像在数据世界里搭建ClickHouse环境一样，有多种安装方式可以选择。"

"对于刚开始学习的朋友，我强烈推荐使用'便携式医疗设备箱'的方式，"他指着一个精巧的设备箱说道，"这就像Docker容器化部署，所有必要的组件都已经打包好了，一键式安装，几分钟就能运行起来。"

"你们看，"他开始演示，"这个便携设备箱包含了心电图机、血压仪、血糖仪等基础设备，插上电源就能立即使用，不需要复杂的安装调试过程。"


陈技师一边操作一边解释："我来演示一下便携设备箱的安装过程，这对应着Docker部署ClickHouse的标准流程。"

**专业技术对应**：
```bash
# 拉取ClickHouse镜像 (下载便携设备箱)
docker pull clickhouse/clickhouse-server:latest

# 启动ClickHouse服务器 (启动主要医疗设备)
docker run -d \
  --name clickhouse-server \
  -p 8123:8123 \
  -p 9000:9000 \
  -v clickhouse_data:/var/lib/clickhouse \
  clickhouse/clickhouse-server:latest

# 启动ClickHouse客户端 (连接控制终端)
docker run -it --rm \
  --link clickhouse-server:clickhouse-server \
  clickhouse/clickhouse-client:latest \
  --host clickhouse-server

# 或者使用HTTP接口测试 (远程健康检查)
curl --get "http://localhost:8123/" --data-urlencode "query=SELECT 'Hello, ClickHouse!'"
```

"第一步是下载设备箱，"陈技师指着屏幕，"就像从设备厂商那里获取最新版本的便携医疗设备包。"

"第二步启动主设备，"他打开设备箱，"我们给设备分配端口号，8123就像是HTTP通讯端口，9000是专用的高速数据传输端口，同时挂载数据存储目录，使容器重建后仍可保留数据；数据卷不等于备份，不能保证数据不会丢失，练习仅使用虚构测试数据。"

"第三步连接控制终端，"他拿起一个平板设备，"医生可以通过这个终端访问和控制所有医疗设备，就像ClickHouse的客户端连接到服务器一样。"

> [!info] 📝 **配置参数说明**
> - **-p 8123:8123**: 映射HTTP端口，用于REST API访问
> - **-p 9000:9000**: 映射Native端口，用于客户端连接
> - **-v clickhouse_data**: 挂载数据卷，持久化存储数据
> - **--link**: 容器间网络连接（已废弃，建议使用网络）

### 2. Docker Compose部署

创建更完整的开发环境：

```yaml
# docker-compose.yml
version: '3.8'

services:
  clickhouse-server:
    image: clickhouse/clickhouse-server:latest
    container_name: clickhouse-server
    hostname: clickhouse-server
    ports:
      - "8123:8123"   # HTTP端口
      - "9000:9000"   # Native端口
      - "9009:9009"   # Inter-server端口
    volumes:
      - ./data:/var/lib/clickhouse
      - ./config:/etc/clickhouse-server/config.d
      - ./logs:/var/log/clickhouse-server
    environment:
      CLICKHOUSE_DB: default
      CLICKHOUSE_USER: default
      CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT: 1
    ulimits:
      nofile:
        soft: 262144
        hard: 262144

  clickhouse-client:
    image: clickhouse/clickhouse-client:latest
    container_name: clickhouse-client
    depends_on:
      - clickhouse-server
    command: ['sleep', 'infinity']

volumes:
  clickhouse_data:
  clickhouse_logs:
```

```bash
# 启动服务
docker-compose up -d

# 连接到客户端
docker exec -it clickhouse-client clickhouse-client --host clickhouse-server

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f clickhouse-server

# 停止服务
docker-compose down
```

### 3. 基本连接测试

```sql
-- 测试连接和基本功能
SELECT 'ClickHouse is running!' as message;

-- 查看版本信息
SELECT version();

-- 查看系统信息
SELECT 
    hostName() as host,
    uptime() as uptime_seconds,
    formatReadableSize(total_memory) as total_memory
FROM system.one
CROSS JOIN (SELECT sum(value) as total_memory FROM system.asynchronous_metrics WHERE metric = 'MemoryDataAndStack');

-- 创建测试表
CREATE TABLE test_table (
    id UInt32,
    name String,
    timestamp DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY id;

-- 插入测试数据
INSERT INTO test_table (id, name) VALUES (1, 'Hello'), (2, 'ClickHouse');

-- 查询测试数据
SELECT * FROM test_table ORDER BY id;
```

## 📦 生产环境安装

### 1. Ubuntu/Debian安装

陈技师带大家来到医院的主设备安装车间："刚才我们看的是便携式设备箱，适合快速部署和学习测试。但是对于医院的正式运营，我们需要安装更专业、更稳定的固定式医疗设备。"

"这就像ClickHouse的生产环境安装，"他指向一套大型的医疗设备系统，"需要更详细的安装配置过程，但也提供了更强的性能和可靠性保障。"

"我们先来看Ubuntu系统的医疗设备安装流程，"他打开设备安装手册。

```bash
# 添加官方仓库
sudo apt-get install -y apt-transport-https ca-certificates dirmngr
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 8919F6BD2B48D754

echo "deb https://packages.clickhouse.com/deb stable main" | sudo tee \
    /etc/apt/sources.list.d/clickhouse.list

# 更新包列表并安装
sudo apt-get update
sudo apt-get install -y clickhouse-server clickhouse-client

# 启动服务
sudo systemctl start clickhouse-server
sudo systemctl enable clickhouse-server

# 检查服务状态
sudo systemctl status clickhouse-server

# 查看日志
sudo journalctl -u clickhouse-server -f
```

### 2. CentOS/RHEL安装

```bash
# 添加官方仓库
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://packages.clickhouse.com/rpm/clickhouse.repo

# 安装ClickHouse
sudo yum install -y clickhouse-server clickhouse-client

# 启动服务
sudo systemctl start clickhouse-server
sudo systemctl enable clickhouse-server

# 检查服务状态
sudo systemctl status clickhouse-server
```

### 3. 手动安装（通用方法）

```bash
# 下载安装包
LATEST_VERSION=$(curl -s https://api.github.com/repos/ClickHouse/ClickHouse/releases/latest | grep -Po '"tag_name": "v\K[^"]*')
wget https://github.com/ClickHouse/ClickHouse/releases/download/v${LATEST_VERSION}/clickhouse-common-static-${LATEST_VERSION}.tgz
wget https://github.com/ClickHouse/ClickHouse/releases/download/v${LATEST_VERSION}/clickhouse-server-${LATEST_VERSION}.tgz
wget https://github.com/ClickHouse/ClickHouse/releases/download/v${LATEST_VERSION}/clickhouse-client-${LATEST_VERSION}.tgz

# 解压并安装
tar -xzf clickhouse-common-static-${LATEST_VERSION}.tgz
tar -xzf clickhouse-server-${LATEST_VERSION}.tgz
tar -xzf clickhouse-client-${LATEST_VERSION}.tgz

sudo ./clickhouse-common-static-${LATEST_VERSION}/install/doinst.sh
sudo ./clickhouse-server-${LATEST_VERSION}/install/doinst.sh
sudo ./clickhouse-client-${LATEST_VERSION}/install/doinst.sh

# 创建用户和目录
sudo groupadd clickhouse
sudo useradd -g clickhouse --no-create-home --shell /bin/false clickhouse
sudo mkdir -p /var/lib/clickhouse /var/log/clickhouse-server /etc/clickhouse-server
sudo chown clickhouse:clickhouse /var/lib/clickhouse /var/log/clickhouse-server
```

## ⚙️ 配置文件管理

### 1. 主配置文件结构

陈技师来到设备控制中心："现在我来介绍最关键的部分—— 设备配置管理。每台医疗设备都有自己的配置文件，就像ClickHouse的配置系统一样，需要精心调整才能发挥最佳性能。"

"我们医院的设备配置中心就设在这里，"他指向一排服务器机柜，"所有设备的参数配置都统一管理，这样确保整个医疗系统协调运作。"

```xml
<?xml version="1.0"?>
<!-- /etc/clickhouse-server/config.xml -->
<clickhouse>
    <!-- 基本配置 -->
    <logger>
        <level>debug</level>
        <log>/var/log/clickhouse-server/clickhouse-server.log</log>
        <errorlog>/var/log/clickhouse-server/clickhouse-server.err.log</errorlog>
        <size>1000M</size>
        <count>10</count>
    </logger>

    <!-- 网络配置 -->
    <http_port>8123</http_port>
    <tcp_port>9000</tcp_port>
    <interserver_http_port>9009</interserver_http_port>
    
    <!-- 监听地址 -->
    <listen_host>0.0.0.0</listen_host>

    <!-- 数据目录 -->
    <path>/var/lib/clickhouse/</path>
    <tmp_path>/var/lib/clickhouse/tmp/</tmp_path>
    <user_files_path>/var/lib/clickhouse/user_files/</user_files_path>

    <!-- 用户配置 -->
    <users_config>users.xml</users_config>

    <!-- 默认配置 -->
    <default_profile>default</default_profile>
    <default_database>default</default_database>

    <!-- 内存和性能配置 -->
    <max_server_memory_usage>0</max_server_memory_usage>
    <max_concurrent_queries>100</max_concurrent_queries>
    <max_connections>4096</max_connections>
</clickhouse>
```

### 2. 用户配置

```xml
<?xml version="1.0"?>
<!-- /etc/clickhouse-server/users.xml -->
<clickhouse>
    <profiles>
        <default>
            <max_memory_usage>10000000000</max_memory_usage>
            <max_memory_usage_for_user>20000000000</max_memory_usage_for_user>
            <max_execution_time>600</max_execution_time>
            <max_rows_to_read>1000000000</max_rows_to_read>
            <max_bytes_to_read>100000000000</max_bytes_to_read>
            <use_uncompressed_cache>0</use_uncompressed_cache>
            <load_balancing>in_order</load_balancing>
        </default>

        <readonly>
            <readonly>1</readonly>
            <max_memory_usage>5000000000</max_memory_usage>
        </readonly>
    </profiles>

    <users>
        <default>
            <password></password>
            <networks>
                <ip>::/0</ip>
            </networks>
            <profile>default</profile>
            <quota>default</quota>
        </default>

        <admin>
            <password_sha256_hex>ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad</password_sha256_hex>
            <networks>
                <ip>127.0.0.1</ip>
                <ip>localhost</ip>
            </networks>
            <profile>default</profile>
            <quota>default</quota>
        </admin>

        <readonly_user>
            <password>readonly_password</password>
            <networks>
                <ip>10.0.0.0/8</ip>
            </networks>
            <profile>readonly</profile>
            <quota>default</quota>
        </readonly_user>
    </users>

    <quotas>
        <default>
            <interval>
                <duration>3600</duration>
                <queries>0</queries>
                <errors>0</errors>
                <result_rows>0</result_rows>
                <read_rows>0</read_rows>
                <execution_time>0</execution_time>
            </interval>
        </default>
    </quotas>
</clickhouse>
```

### 3. 自定义配置

```xml
<!-- /etc/clickhouse-server/config.d/custom.xml -->
<clickhouse>
    <!-- 性能优化配置 -->
    <max_table_size_to_drop>0</max_table_size_to_drop>
    <max_partition_size_to_drop>0</max_partition_size_to_drop>
    
    <!-- 压缩配置 -->
    <compression>
        <case>
            <method>zstd</method>
            <level>3</level>
        </case>
    </compression>

    <!-- 日志配置 -->
    <query_log>
        <database>system</database>
        <table>query_log</table>
        <partition_by>toYYYYMM(event_date)</partition_by>
        <flush_interval_milliseconds>7500</flush_interval_milliseconds>
    </query_log>

    <!-- 分布式DDL配置 -->
    <distributed_ddl>
        <path>/clickhouse/task_queue/ddl</path>
    </distributed_ddl>
</clickhouse>
```

## 🔌 客户端连接方法

### 1. 命令行客户端

陈技师带大家来到医生工作站："设备安装完成后，医生们需要通过各种方式连接和使用这些设备。我来演示几种不同的连接方式，这就像ClickHouse的多种客户端连接方法。"

"最基础的是命令行控制终端，"他指着一台黑屏设备，"就像程序员常用的命令行界面，虽然界面朴素，但功能强大，可以执行各种复杂的设备操作指令。"

```bash
# 基本连接
clickhouse-client

# 指定主机和端口
clickhouse-client --host localhost --port 9000

# 使用用户名和密码
clickhouse-client --user admin --password

# 指定数据库
clickhouse-client --database test_db

# 执行单个查询
clickhouse-client --query "SELECT version()"

# 从文件执行SQL
clickhouse-client --queries-file script.sql

# 格式化输出
clickhouse-client --query "SELECT * FROM system.tables" --format PrettyCompact

# 导出数据
clickhouse-client --query "SELECT * FROM events" --format CSV > events.csv
```

### 2. HTTP接口

"除了命令行，我们还有基于网络的远程控制接口，"陈技师指着一个平板设备，"这就像HTTP接口，医生可以通过网页或手机APP远程查看设备状态，发送控制指令。"

"你们看，"他演示操作，"通过简单的网络请求就可以获取设备信息，上传患者数据，非常方便。"

**专业技术对应**：
```bash
# 基本HTTP查询 (远程设备状态检查)
curl --get "http://localhost:8123/" --data-urlencode "query=SELECT version()"

# POST方式执行查询 (发送复杂指令)
curl -X POST "http://localhost:8123/" -d "SELECT count() FROM system.tables"

# 使用认证 (安全访问控制)
curl --user admin --get "http://localhost:8123/" --data-urlencode "query=SELECT 1"

# 指定格式 (选择数据输出格式)
curl --get "http://localhost:8123/" --data-urlencode "query=SELECT * FROM system.tables FORMAT JSON"

# 上传数据 (传输患者检查结果)
echo -e "1\tHello\n2\tWorld" | curl "http://localhost:8123/?query=INSERT%20INTO%20test_table%20%28id%2C%20name%29%20FORMAT%20TSV" --data-binary @-
```

### 3. 编程语言客户端

#### Python客户端

```python
# 使用clickhouse-driver
from clickhouse_driver import Client

client = Client('localhost')

# 执行查询
result = client.execute('SELECT version()')
print(result)

# 插入数据
client.execute('CREATE TABLE IF NOT EXISTS test (id UInt32, name String) ENGINE = Memory')
client.execute('INSERT INTO test VALUES', [(1, 'Alice'), (2, 'Bob')])

# 查询数据
rows = client.execute('SELECT * FROM test')
for row in rows:
    print(row)

# 将结果转换为字典列表
rows, column_types = client.execute('SELECT * FROM test', with_column_types=True)
columns = [name for name, type_name in column_types]
data = [dict(zip(columns, row)) for row in rows]
print(data)
```

#### Java客户端

```java
// 使用JDBC驱动
import java.sql.*;

public class ClickHouseExample {
    public static void main(String[] args) throws SQLException {
        String url = "jdbc:clickhouse://localhost:8123/default";
        String user = "default";
        String password = "";
        
        Connection connection = DriverManager.getConnection(url, user, password);
        Statement statement = connection.createStatement();
        
        // 执行查询
        ResultSet rs = statement.executeQuery("SELECT version()");
        while (rs.next()) {
            System.out.println("Version: " + rs.getString(1));
        }
        
        // 插入数据
        statement.execute("CREATE TABLE IF NOT EXISTS test (id UInt32, name String) ENGINE = Memory");
        statement.execute("INSERT INTO test VALUES (1, 'Hello'), (2, 'World')");
        
        connection.close();
    }
}
```

## 🛠️ 开发工具集成

### 1. DBeaver连接

```text
连接配置步骤：
1. 新建连接 -> 分析型 -> ClickHouse
2. 服务器: localhost
3. 端口: 常用HTTP JDBC连接填写8123；仅在所选驱动明确支持Native协议时填写9000，二者不可直接互换
4. 数据库: default
5. 用户名: default
6. 密码: (空)
7. 测试连接确保成功
```

### 2. DataGrip连接

```text
连接步骤：
1. 新建数据源 -> ClickHouse
2. 配置连接参数：
   - Host: localhost
   - Port: 8123
   - Database: default
   - User: default
   - Password: (空)
3. 高级设置：useSSL=false
4. 测试连接
5. 配置SSH隧道（如需要）
```

### 3. VS Code插件

安装ClickHouse插件并配置：

```json
// settings.json
{
    "clickhouse.connections": [
        {
            "name": "local",
            "host": "localhost",
            "port": 8123,
            "username": "default",
            "password": "",
            "database": "default"
        }
    ]
}
```

## 🔧 常见问题解决

### 1. 端口访问问题

```bash
# 检查端口监听
sudo netstat -tlnp | grep clickhouse

# 检查防火墙
sudo ufw status
sudo ufw allow 8123
sudo ufw allow 9000

# 检查ClickHouse配置
grep -n "listen_host" /etc/clickhouse-server/config.xml
```

### 2. 权限问题

```bash
# 检查文件权限
ls -la /var/lib/clickhouse/
ls -la /var/log/clickhouse-server/

# 修复权限
sudo chown -R clickhouse:clickhouse /var/lib/clickhouse/
sudo chown -R clickhouse:clickhouse /var/log/clickhouse-server/

# 检查SELinux（CentOS/RHEL）
sudo setenforce 0  # 临时关闭
sudo getenforce    # 查看状态
```

### 3. 内存配置

```xml
<!-- 服务端内存比例配置：放入config.xml或config.d中的clickhouse根节点；0.9为示例，须按资源预算调整 -->
<max_server_memory_usage_to_ram_ratio>0.9</max_server_memory_usage_to_ram_ratio>

<!-- 以下查询内存限制按字节计，放入users.xml或users.d中相应的profile，而非服务端配置根节点 -->
<max_memory_usage>10000000000</max_memory_usage>
<max_memory_usage_for_user>20000000000</max_memory_usage_for_user>
```

## 🎯 环境验证清单

完成环境搭建后，使用以下清单验证：

### ✅ 基础功能验证

```sql
-- 1. 版本信息
SELECT version();

-- 2. 系统状态
SELECT 
    uptime() as uptime_seconds,
    formatReadableTimeDelta(uptime()) as uptime_readable;

-- 3. 存储引擎测试
CREATE TABLE test_engine (
    id UInt32,
    data String
) ENGINE = MergeTree()
ORDER BY id;

INSERT INTO test_engine VALUES (1, 'test data');
SELECT * FROM test_engine;

-- 4. 数据类型测试
CREATE TABLE test_types (
    int_col UInt64,
    str_col String,
    date_col Date,
    datetime_col DateTime,
    array_col Array(String)
) ENGINE = Memory;

INSERT INTO test_types VALUES 
    (123, 'hello', today(), now(), ['a', 'b', 'c']);

SELECT * FROM test_types;

-- 5. 按展开后的数组元素进行聚合测试；每个原始行可参与多个元素组
SELECT
    count() as cnt,
    sum(int_col) as sum_val,
    element
FROM test_types
ARRAY JOIN array_col AS element
GROUP BY element;
```

### ✅ 性能验证

```sql
-- 创建大表测试性能
CREATE TABLE perf_test (
    id UInt64,
    timestamp DateTime,
    value Float64
) ENGINE = MergeTree()
ORDER BY id;

-- 插入测试数据
INSERT INTO perf_test 
SELECT 
    number,
    now() - number,
    rand() / 1000000
FROM numbers(1000000);

-- 测试查询性能
SELECT count() FROM perf_test;
SELECT avg(value) FROM perf_test WHERE id % 1000 = 0;
```

## 🎯 环境搭建总结

通过本章节的学习，我们完成了：

1. **Docker快速部署** - 最简单的开始方式
2. **生产环境安装** - 介绍系统安装步骤；用于正式环境前仍需完成版本验证、安全加固和备份恢复设计
3. **配置管理** - 理解和自定义ClickHouse配置
4. **客户端连接** - 多种连接方式和工具使用
5. **问题解决** - 常见问题的诊断和解决方法

> [!abstract] 📚 下一步学习
> 环境搭建完成后，接下来我们将学习[[【技术与工具】/ClickHouse/04-ClickHouse数据类型与表引擎|ClickHouse数据类型与表引擎]]，深入了解如何设计高效的数据模型。

## 🔗 相关资源

- [[【技术与工具】/ClickHouse/02-ClickHouse架构原理|ClickHouse架构]] - 理解底层原理
- [[【技术与工具】/ClickHouse/00-ClickHouse学习路线图|ClickHouse]] - 返回学习路线图
- [ClickHouse官方文档](https://clickhouse.com/docs/) - 官方安装指南

---

> 💡 **记住**：**好的开始是成功的一半**。花时间搭建稳定的环境是值得的，这将为后续学习提供坚实的基础。**遇到问题时不要灰心，环境问题很常见，解决过程也是学习的一部分**！