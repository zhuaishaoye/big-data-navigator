---
title: DataX 常用 Reader 插件详解 - MySQL/Oracle/HDFS/OSS 完整配置
tags:
  - DataX
  - Reader
  - mysqlreader
  - oraclereader
  - hdfsreader
  - ossreader
  - 插件配置
aliases:
  - DataX Reader插件
  - DataX读取插件
difficulty: 中级
duration: 30分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


# DataX 常用 Reader 插件详解 - MySQL/Oracle/HDFS/OSS 完整配置

> [!abstract] 本文核心内容
> - mysqlreader：从 MySQL 读取数据（含增量同步配置）
> - postgresqlreader：从 PostgreSQL 读取
> - oraclereader：从 Oracle 读取（注意驱动版本）
> - hdfsreader：从 HDFS 读取 ORC/Text/Parquet 文件
> - ossreader：从阿里云 OSS 读取
> - txtfilereader：从本地文本文件读取

---

## 通用配置结构

所有 Reader 插件都遵循相同的配置结构，放在 job.content[].reader 里：

```json
"reader": {
    "name": "插件名称",
    "parameter": {
        // 各插件独有的参数
    }
}
```

---

## mysqlreader

最常用的 Reader，从 MySQL 数据库读取数据。底层通过 JDBC 执行 SELECT 语句。

### 基础配置（单表全量）

```json
{
    "reader": {
        "name": "mysqlreader",
        "parameter": {
            "username": "readonly_user",
            "password": "your_password",
            "column": [
                "order_id",
                "user_id",
                "order_status",
                "amount",
                "create_time",
                "update_time"
            ],
            "splitPk": "order_id",
            "connection": [
                {
                    "table": ["orders"],
                    "jdbcUrl": [
                        "jdbc:mysql://10.0.0.1:3306/shop_db?useUnicode=true&characterEncoding=utf8&useSSL=false&serverTimezone=Asia/Shanghai"
                    ]
                }
            ]
        }
    }
}
```

### 增量同步配置

增量同步通过在配置中注入日期参数实现，结合调度系统的变量传参：

```json
{
    "reader": {
        "name": "mysqlreader",
        "parameter": {
            "username": "readonly_user",
            "password": "your_password",
            "column": ["*"],
            "where": "update_time >= '${yesterday}' AND update_time < '${today}'",
            "splitPk": "order_id",
            "connection": [
                {
                    "table": ["orders"],
                    "jdbcUrl": [
                        "jdbc:mysql://10.0.0.1:3306/shop_db?useUnicode=true&characterEncoding=utf8"
                    ]
                }
            ]
        }
    }
}
```

运行时传入参数：
```bash
python3 datax.py job.json \
    -p "-Dyesterday=2026-03-17 -Dtoday=2026-03-18"
```

### 自定义 SQL（querySql）

当 `table` + `where` 的方式不够灵活时，使用 `querySql` 直接写 SQL：

```json
{
    "reader": {
        "name": "mysqlreader",
        "parameter": {
            "username": "readonly_user",
            "password": "your_password",
            "connection": [
                {
                    "querySql": [
                        "SELECT o.order_id, o.user_id, u.username, o.amount FROM orders o LEFT JOIN users u ON o.user_id = u.user_id WHERE o.create_time >= '2026-03-17'"
                    ],
                    "jdbcUrl": [
                        "jdbc:mysql://10.0.0.1:3306/shop_db"
                    ]
                }
            ]
        }
    }
}
```

> [!warning] querySql 与 splitPk 不兼容
> 使用 `querySql` 时，不能同时配置 `splitPk`，因为 DataX 无法对自定义 SQL 进行切分。
> 如果要并发，需要在多个 connection 中配置多个 querySql，手动分片。

### 多表同步（同一数据库）

```json
{
    "reader": {
        "name": "mysqlreader",
        "parameter": {
            "username": "readonly_user",
            "password": "your_password",
            "column": ["id", "name", "status", "created_at"],
            "connection": [
                {
                    "table": ["orders_2024", "orders_2025", "orders_2026"],
                    "jdbcUrl": [
                        "jdbc:mysql://10.0.0.1:3306/shop_db"
                    ]
                }
            ]
        }
    }
}
```

### 从从库读取（推荐生产使用）

```json
"jdbcUrl": [
    "jdbc:mysql://10.0.0.2:3306/shop_db"
]
```

将 jdbcUrl 改成可访问的从库地址可把查询负载转移到从库，但仍需评估复制延迟、从库资源竞争及对复制链路的间接影响，不能保证对主库完全无影响。

### 关键参数速查

| 参数 | 必填 | 说明 |
|------|------|------|
| `username` | 是 | 数据库用户名 |
| `password` | 是 | 数据库密码 |
| `column` | 是 | 读取的列，`["*"]` 表示所有列 |
| `splitPk` | 否 | 切分字段，推荐填主键 |
| `where` | 否 | WHERE 过滤条件（增量同步用） |
| `querySql` | 否 | 自定义查询 SQL，与 table 互斥 |
| `connection.table` | 与querySql二选一 | 要读取的表名列表 |
| `connection.jdbcUrl` | 是 | JDBC 连接串列表，可配多个从库 |

> [!tip] 性能建议
> - `column` 不要用 `["*"]`，明确列出需要的字段，避免传输不必要数据
> - 给 `splitPk` 的字段加索引，否则 DataX 查询 MIN/MAX 会慢
> - 生产环境优先评估从**从库**读取，并使用专门的**只读账号**；结合复制延迟、数据一致性要求与资源容量决定读取位置

---

## postgresqlreader

从 PostgreSQL 读取数据，配置结构与 mysqlreader 几乎相同。

```json
{
    "reader": {
        "name": "postgresqlreader",
        "parameter": {
            "username": "readonly_user",
            "password": "your_password",
            "column": ["user_id", "email", "created_at", "status"],
            "splitPk": "user_id",
            "connection": [
                {
                    "table": ["public.users"],
                    "jdbcUrl": [
                        "jdbc:postgresql://10.0.0.3:5432/user_db"
                    ]
                }
            ]
        }
    }
}
```

> [!note] PostgreSQL Schema 的处理
> PostgreSQL 中表有 Schema 的概念。在 `table` 参数里用 `schema.table` 格式指定，如 `public.users`、`analytics.fact_orders`。

---

## oraclereader

从 Oracle 数据库读取数据。注意检查安装包是否已包含兼容的 Oracle JDBC 驱动；需自行补充时，应从官方渠道获取，并依据具体驱动版本的许可条款确认使用和再分发条件。

### 驱动配置

```bash
# 从 Oracle 官网下载对应版本的 JDBC 驱动
# https://www.oracle.com/database/technologies/appdev/jdbc-downloads.html

# 把驱动放到 oraclereader 的 libs 目录下
cp ojdbc8.jar /opt/datax/datax/plugin/reader/oraclereader/libs/
```

### 基础配置

```json
{
    "reader": {
        "name": "oraclereader",
        "parameter": {
            "username": "READONLY_USER",
            "password": "your_password",
            "column": [
                "ACCOUNT_ID",
                "CUSTOMER_NAME",
                "BALANCE",
                "OPEN_DATE",
                "STATUS"
            ],
            "splitPk": "ACCOUNT_ID",
            "connection": [
                {
                    "table": ["FINANCE.ACCOUNTS"],
                    "jdbcUrl": [
                        "jdbc:oracle:thin:@//10.0.0.4:1521/ORCL"
                    ]
                }
            ]
        }
    }
}
```

### 带 Service Name 的连接串

```json
"jdbcUrl": [
    "jdbc:oracle:thin:@//10.0.0.4:1521/ORCLPDB1"
]
```

### 带 SID 的连接串（老版 Oracle）

```json
"jdbcUrl": [
    "jdbc:oracle:thin:@10.0.0.4:1521:ORCL"
]
```

> [!warning] Oracle 的常见坑
> 1. Oracle 列名默认大写，配置时注意大小写匹配
> 2. Oracle 的 `NUMBER` 类型对应 Java 的 `BigDecimal`，可能与目标端类型不匹配
> 3. `CLOB`、`BLOB` 大字段类型支持有限，建议评估后决定是否同步

---

## hdfsreader

从 HDFS 读取文件，支持 TextFile（纯文本）、ORC、Parquet 三种格式，常用于把 HDFS 上的数据同步到关系数据库或其他存储。

### 读取 ORC 文件（最常见）

```json
{
    "reader": {
        "name": "hdfsreader",
        "parameter": {
            "path": "/user/hive/warehouse/ods.db/ods_orders/dt=2026-03-17",
            "defaultFS": "hdfs://namenode:9000",
            "fileType": "orc",
            "encoding": "UTF-8",
            "fieldDelimiter": ",",
            "column": [
                {"index": 0, "type": "long"},
                {"index": 1, "type": "long"},
                {"index": 2, "type": "string"},
                {"index": 3, "type": "double"},
                {"index": 4, "type": "date"}
            ]
        }
    }
}
```

### 读取 Text 文件

```json
{
    "reader": {
        "name": "hdfsreader",
        "parameter": {
            "path": "/data/input/orders_20260317.txt",
            "defaultFS": "hdfs://namenode:9000",
            "fileType": "text",
            "encoding": "UTF-8",
            "fieldDelimiter": "\t",
            "column": [
                {"index": 0, "type": "long",   "name": "order_id"},
                {"index": 1, "type": "string", "name": "order_status"},
                {"index": 2, "type": "double", "name": "amount"}
            ]
        }
    }
}
```

### 读取通配符路径（多分区）

```json
"path": "/user/hive/warehouse/ods.db/ods_orders/dt=2026-03-*"
```

DataX 会展开通配符，读取所有匹配的文件。

### 关键参数速查

| 参数 | 必填 | 说明 |
|------|------|------|
| `path` | 是 | HDFS 路径，支持通配符 `*` |
| `defaultFS` | 是 | HDFS NameNode 地址 |
| `fileType` | 是 | 文件格式：`text` / `orc` / `parquet` / `rc` |
| `encoding` | 否 | 文件编码，默认 `UTF-8` |
| `fieldDelimiter` | 否 | text 格式的字段分隔符 |
| `column` | 是 | 列的类型映射配置 |

> [!tip] HA 集群的 defaultFS 配置
> 高可用 HDFS 集群需要配置 nameservice：
> ```json
> "defaultFS": "hdfs://mycluster"
> ```
> 同时还需要在 `hadoopConfig` 中指定 HA 相关参数：
> ```json
> "hadoopConfig": {
>     "dfs.nameservices": "mycluster",
>     "dfs.ha.namenodes.mycluster": "nn1,nn2",
>     "dfs.namenode.rpc-address.mycluster.nn1": "nn1:9000",
>     "dfs.namenode.rpc-address.mycluster.nn2": "nn2:9000",
>     "dfs.client.failover.proxy.provider.mycluster": "org.apache.hadoop.hdfs.server.namenode.ha.ConfiguredFailoverProxyProvider"
> }
> ```

---

## ossreader

从阿里云 OSS 对象存储读取文件，配置与 hdfsreader 类似，但需要 OSS 认证信息。

```json
{
    "reader": {
        "name": "ossreader",
        "parameter": {
            "endpoint": "http://oss-cn-hangzhou-internal.aliyuncs.com",
            "accessId": "your-access-key-id",
            "accessKey": "your-access-key-secret",
            "bucket": "my-data-bucket",
            "object": ["data/orders/dt=2026-03-17/*"],
            "fileType": "csv",
            "encoding": "UTF-8",
            "fieldDelimiter": ",",
            "skipHeader": "true",
            "column": [
                {"index": 0, "type": "long",   "name": "order_id"},
                {"index": 1, "type": "string", "name": "order_status"},
                {"index": 2, "type": "double", "name": "amount"},
                {"index": 3, "type": "date",   "name": "create_time",
                 "format": "yyyy-MM-dd HH:mm:ss"}
            ]
        }
    }
}
```

### 关键参数

| 参数 | 说明 |
|------|------|
| `endpoint` | OSS Endpoint，内网访问用 `-internal` 后缀的地址 |
| `accessId` | 阿里云 AccessKey ID |
| `accessKey` | 阿里云 AccessKey Secret |
| `bucket` | OSS Bucket 名称 |
| `object` | OSS 对象名称或匹配模式的列表；读取示例前缀下的对象使用 `["data/orders/dt=2026-03-17/*"]`，具体匹配规则须核对所用插件版本 |
| `skipHeader` | 是否跳过 CSV 表头，`"true"` / `"false"` |

> [!tip] 安全建议
> 不要在 Job 配置文件里硬编码 AccessKey。以下占位符通过 DataX 的 `-p` 参数替换，并不表示插件会自动读取环境变量；可由受控启动脚本或密钥管理系统提供变量值。使用 RAM 角色前须确认所用插件支持相应的临时凭据认证方式：
> ```json
> "accessId": "${OSS_ACCESS_ID}",
> "accessKey": "${OSS_ACCESS_KEY}"
> ```
> 运行时可通过 `-p` 参数传入，但命令行中的密钥可能暴露于进程列表、日志或 Shell 历史；以下仅演示传参语法，生产环境须限制这些暴露面：
> ```bash
> python3 datax.py job.json -p "-DOSS_ACCESS_ID=xxx -DOSS_ACCESS_KEY=yyy"
> ```

---

## txtfilereader

从本地文本文件读取数据，适合处理 FTP 下载的数据文件、日志文件等场景。

```json
{
    "reader": {
        "name": "txtfilereader",
        "parameter": {
            "path": ["/data/input/orders_*.csv"],
            "encoding": "UTF-8",
            "fieldDelimiter": ",",
            "dateFormat": "yyyy-MM-dd",
            "nullFormat": "\\N",
            "skipHeader": "true",
            "compress": "",
            "column": [
                {"index": 0, "type": "long"},
                {"index": 1, "type": "string"},
                {"index": 2, "type": "double"},
                {"index": 3, "type": "date"}
            ]
        }
    }
}
```

支持的压缩格式：`gz`（gzip）、`bz2`（bzip2）、`zip`、`lzo`。

```json
"compress": "gz",
"path": ["/data/input/orders_20260317.csv.gz"]
```

---

## 数据类型映射参考

DataX 的 Reader 在读取数据时，需要把源端数据类型映射到 DataX 内部的类型。下表仅供类型对应关系参考，不代表所有 JDBC Reader 的固定转换规则；实际转换须核对插件实现。DECIMAL、NUMBER 等高精度数值不宜直接按表转为 double，应验证精度、范围及目标端写入后的值。

| DataX 类型 | 说明 | MySQL 对应 | Oracle 对应 |
|-----------|------|-----------|------------|
| `long` | 整数 | INT, BIGINT, TINYINT | NUMBER(p,0) |
| `double` | 浮点数 | FLOAT, DOUBLE, DECIMAL | NUMBER(p,s) |
| `string` | 字符串 | VARCHAR, TEXT, CHAR | VARCHAR2, CLOB |
| `date` | 日期时间 | DATE, DATETIME, TIMESTAMP | DATE, TIMESTAMP |
| `bool` | 布尔 | TINYINT(1), BIT | NUMBER(1) |
| `bytes` | 二进制 | BLOB, BINARY | BLOB, RAW |

---

## 相关文档

- [[【技术与工具】/DataX/05-常用Writer插件|05-常用Writer插件]] - 把读取的数据写到哪里
- [[【技术与工具】/DataX/06-DataX实战场景|06-DataX实战场景]] - 完整的端到端配置示例
- [[【技术与工具】/DataX/02-DataX核心架构|02-DataX核心架构]] - 理解 Reader 在整体架构中的角色

---

#DataX #Reader #mysqlreader #oraclereader #hdfsreader #ossreader #插件配置

---

> [!info] 前置知识
> - 能运行基本的 DataX 任务，参考 [[【技术与工具】/DataX/03-DataX安装与配置|03-DataX安装与配置]]
> - 了解 MySQL JDBC 连接串格式（`jdbc:mysql://host:port/database`）
> - 了解 HDFS 的基本概念（路径格式如 `hdfs://namenode:9000/path`）

---

## 掌握检查

- [ ] 能配置 `mysqlreader`，正确填写 `jdbcUrl`（列表格式）、`username`、`password`、`table`、`column`，并使用 `where` 参数实现增量过滤（如 `"where": "update_time > '${yesterday}'"` ）
- [ ] 能说明 `mysqlreader` 的 `splitPk` 参数用途：按指定整数列的范围切分数据块实现并行读取；索引是性能建议，不是与整数类型相同的强制条件
- [ ] 能配置 `hdfsreader`，正确设置 `path`（支持通配符如 `/data/orders/dt=2024-01-*`）、`fileType`（orc/text/parquet）、`fieldDelimiter`
- [ ] 能解释 `ossreader` 中 `endpoint` 填内网地址（`oss-cn-hangzhou-internal.aliyuncs.com`）和外网地址的区别，并根据运行位置、地域和网络可达性选择地址，而非一律要求生产环境使用内网地址
- [ ] 能描述 DataX 内部数据类型（long/double/string/date/bool/bytes）和各数据库类型的映射关系，说明 `DECIMAL(18,4)` 转为 `double` 可能损失精度，并按所用插件与目标端类型验证精确值的传输方式

---

## 实践练习

**基础题**：编写一个 `mysqlreader` 配置，从 MySQL 的 `orders` 表中读取 `order_id`、`user_id`、`amount`、`created_at` 四个字段，只读取 `created_at >= '2024-01-01'` 的记录，配置 `splitPk: order_id`，并在 `job.setting.speed.channel` 设置并发通道数为 `4`；运行验证时还需补齐 Writer。

**进阶题**：你需要从 HDFS 读取存储在 `/data/ods/orders/dt=2024-01-*/` 目录下的 ORC 格式文件（字段分隔符无意义，因为是 ORC 列式存储），目标是读取 5 个字段并写入 MySQL。编写完整的 `hdfsreader` 配置，并说明如何验证读取到了正确数量的记录。

---

## 下一步

[[【技术与工具】/DataX/05-常用Writer插件|05-常用Writer插件]] - 学习各种目标端的写入配置，与 Reader 组合成完整同步任务
