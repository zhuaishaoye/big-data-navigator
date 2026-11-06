---
title: DataX 常用 Writer 插件详解 - HDFS/Hive/MySQL/OSS 完整配置
tags:
  - DataX
  - Writer
  - hdfswriter
  - hivewriter
  - mysqlwriter
  - osswriter
  - 插件配置
aliases:
  - DataX Writer插件
  - DataX写入插件
difficulty: 中级
duration: 30分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据治理工程师
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


# DataX 常用 Writer 插件详解 - HDFS/Hive/MySQL/OSS 完整配置

> [!abstract] 本文核心内容
> - hdfswriter：写入 HDFS（包括 ORC、Text、Parquet 格式）
> - hivewriter：写入 Hive 表（本质是写 HDFS + 刷 Hive 元数据）
> - mysqlwriter：写入 MySQL（INSERT/REPLACE/INSERT_IGNORE 三种模式）
> - oraclewriter：写入 Oracle
> - osswriter：写入阿里云 OSS
> - streamwriter：测试用，输出到控制台

---

## 通用配置结构

```json
"writer": {
    "name": "插件名称",
    "parameter": {
        // 各插件独有的参数
    }
}
```

---

## hdfswriter

最常用的 Writer，把数据写入 HDFS，是 MySQL → Hive 同步链路中的核心组件。

### 写入 ORC 格式（推荐）

ORC 是 Hive 的推荐存储格式，压缩率高，查询性能好。

```json
{
    "writer": {
        "name": "hdfswriter",
        "parameter": {
            "defaultFS": "hdfs://namenode:9000",
            "path": "/user/hive/warehouse/ods.db/ods_orders/dt=2026-03-18",
            "fileType": "orc",
            "fileName": "ods_orders",
            "writeMode": "append",
            "fieldDelimiter": "\t",
            "compress": "SNAPPY",
            "encoding": "UTF-8",
            "column": [
                {"name": "order_id",     "type": "BIGINT"},
                {"name": "user_id",      "type": "BIGINT"},
                {"name": "order_status", "type": "STRING"},
                {"name": "amount",       "type": "DECIMAL"},
                {"name": "create_time",  "type": "TIMESTAMP"},
                {"name": "update_time",  "type": "TIMESTAMP"}
            ]
        }
    }
}
```

### 写入 Text 格式

```json
{
    "writer": {
        "name": "hdfswriter",
        "parameter": {
            "defaultFS": "hdfs://namenode:9000",
            "path": "/user/hive/warehouse/ods.db/ods_orders/dt=2026-03-18",
            "fileType": "text",
            "fileName": "ods_orders",
            "writeMode": "append",
            "fieldDelimiter": "\u0001",
            "encoding": "UTF-8",
            "column": [
                {"name": "order_id",     "type": "BIGINT"},
                {"name": "user_id",      "type": "BIGINT"},
                {"name": "order_status", "type": "STRING"},
                {"name": "amount",       "type": "DECIMAL"},
                {"name": "create_time",  "type": "STRING"}
            ]
        }
    }
}
```

> [!note] Hive 的默认字段分隔符
> 对采用默认 LazySimpleSerDe 的 Hive 文本表，默认字段分隔符通常是 `\u0001`（SOH 字符，ASCII 1）。DataX 写入 Text 文件时应与目标表的实际 SerDe 和分隔符设置一致；这一规则不适用于 ORC、Parquet 等列式格式。
>
> 检查 Hive 表的分隔符：
> ```sql
> SHOW CREATE TABLE ods_orders;
> ```

### writeMode 的三种选项

| writeMode | 行为 | 适用场景 |
|-----------|------|---------|
| `append` | 追加写入，不删除已有文件 | 增量同步，每次追加新数据 |
| `overwrite` | 先删除 path 下所有文件，再写入 | 全量同步，每次全量覆盖 |
| `nonConflict` | 如果 path 下有文件则报错 | 严格幂等场景，不允许重复写 |

> [!warning] overwrite 的风险
> `writeMode: overwrite` 会删除目标路径下的**所有文件**，然后重新写入。
>
> 如果你的 Hive 分区目录里有多个数据文件（比如多次追加的历史数据），使用 overwrite 会把它们全部删掉。
>
> **生产建议**：全量同步用 overwrite，增量同步用 append。全量同步前先确认目标路径是否有需要保留的数据。

### 写 Parquet 格式

```json
{
    "writer": {
        "name": "hdfswriter",
        "parameter": {
            "defaultFS": "hdfs://namenode:9000",
            "path": "/user/hive/warehouse/ods.db/ods_orders/dt=2026-03-18",
            "fileType": "parquet",
            "fileName": "ods_orders",
            "writeMode": "append",
            "compress": "SNAPPY",
            "column": [
                {"name": "order_id",     "type": "INT64"},
                {"name": "user_id",      "type": "INT64"},
                {"name": "order_status", "type": "BINARY"},
                {"name": "amount",       "type": "DOUBLE"},
                {"name": "create_time",  "type": "INT96"}
            ]
        }
    }
}
```

> [!note] Parquet 的类型映射
> 以下是 Parquet 层面的类型信息，不代表当前 hdfswriter 支持将它们直接填入 `column.type`；上方配置须先核验插件是否支持 Parquet 及其列类型约定。
> - 整数物理类型：`INT32`（32位）/ `INT64`（64位）
> - 字符串通常使用 `BINARY` 物理类型，并带字符串逻辑类型标注
> - 时间戳可能使用历史 `INT96` 表示，或使用带时间戳逻辑类型、单位及时区语义的 `INT64`；应核验写入端与 Hive 的兼容性

### 关键参数速查

| 参数 | 必填 | 说明 |
|------|------|------|
| `defaultFS` | 是 | HDFS NameNode 地址 |
| `path` | 是 | 写入的 HDFS 路径（分区目录） |
| `fileType` | 是 | 文件格式：`text` / `orc` / `parquet` |
| `fileName` | 是 | 写入文件的前缀名称 |
| `writeMode` | 是 | `append` / `overwrite` / `nonConflict` |
| `fieldDelimiter` | text格式必填 | 字段分隔符 |
| `compress` | 否 | 压缩格式：`SNAPPY` / `GZIP` / `BZIP2` / `LZO` |
| `column` | 是 | 列定义（name + type） |

---

## hivewriter

> [!warning] hivewriter 的实际工作方式
> DataX 的 hivewriter **本质上还是写 HDFS**，只是会在写完后执行 `LOAD DATA INPATH` 命令把数据加载到 Hive 表。
>
> **实际生产中更推荐的方式**：用 hdfswriter 写数据到 Hive 表对应的 HDFS 分区目录，然后用 Hive 的 `ALTER TABLE ... ADD PARTITION` 或 `MSCK REPAIR TABLE` 刷新分区元数据。
>
> 这样避免了 hivewriter 的各种限制（如对 Hive Server 的依赖），也更灵活。

hivewriter 配置示例（需要 Hive JDBC 连接）：

```json
{
    "writer": {
        "name": "hivewriter",
        "parameter": {
            "jdbcUrl": "jdbc:hive2://hiveserver:10000/ods_db",
            "username": "hive_user",
            "password": "",
            "fullTableName": "ods_db.ods_orders",
            "partition": {
                "dt": "2026-03-18"
            },
            "writeType": "LOAD",
            "defaultFS": "hdfs://namenode:9000",
            "fileType": "orc",
            "column": [
                {"name": "order_id",     "type": "BIGINT"},
                {"name": "order_status", "type": "STRING"}
            ]
        }
    }
}
```

---

## mysqlwriter

把数据写入 MySQL，支持三种写入模式，是数据反向同步（数仓 → 业务库）或跨 MySQL 实例同步的核心 Writer。

### INSERT 模式（不处理冲突，新数据插入）

```json
{
    "writer": {
        "name": "mysqlwriter",
        "parameter": {
            "username": "write_user",
            "password": "your_password",
            "writeMode": "insert",
            "column": [
                "order_id",
                "user_id",
                "order_status",
                "amount",
                "create_time"
            ],
            "preSql": ["DELETE FROM orders_backup WHERE create_time >= '2026-03-18'"],
            "postSql": ["ANALYZE TABLE orders_backup"],
            "connection": [
                {
                    "table": ["orders_backup"],
                    "jdbcUrl": "jdbc:mysql://10.0.0.5:3306/backup_db?useUnicode=true&characterEncoding=utf8"
                }
            ],
            "batchSize": 1024
        }
    }
}
```

### REPLACE 模式（主键或唯一键冲突时删除旧行并插入新行，需评估重复执行的副作用）

```json
{
    "writer": {
        "name": "mysqlwriter",
        "parameter": {
            "username": "write_user",
            "password": "your_password",
            "writeMode": "replace",
            "column": ["order_id", "user_id", "order_status", "amount"],
            "connection": [
                {
                    "table": ["orders_sync"],
                    "jdbcUrl": "jdbc:mysql://10.0.0.5:3306/sync_db"
                }
            ]
        }
    }
}
```

### INSERT IGNORE 模式（有冲突时跳过，不覆盖已有数据）

```json
"writeMode": "insert ignore"
```

### preSql 和 postSql

这两个参数允许在写入前后执行任意 SQL，非常实用：

```json
"preSql": [
    "TRUNCATE TABLE orders_daily_backup"
],
"postSql": [
    "UPDATE sync_status SET last_sync_time = NOW() WHERE table_name = 'orders'"
]
```

### 三种 writeMode 对比

| writeMode | SQL 语义 | 主键冲突时 | 适用场景 |
|-----------|---------|---------|---------|
| `insert` | `INSERT INTO` | 报错，任务失败 | 确保数据不重复时 |
| `replace` | `REPLACE INTO` | 删除旧行，插入新行 | 需要覆盖更新 |
| `insert ignore` | `INSERT IGNORE INTO` | 忽略，保留旧数据 | 只同步新增，不更新已有 |

> [!tip] 关于 batchSize
> mysqlwriter 是批量写入的，默认每批 1024 条。如果单条数据很大（比如有 TEXT 字段），适当减小 batchSize；如果数据量大、字段少，适当增大到 2048-4096 可以提升性能。

---

## oraclewriter

写入 Oracle 数据库，驱动配置同 oraclereader。

```json
{
    "writer": {
        "name": "oraclewriter",
        "parameter": {
            "username": "WRITE_USER",
            "password": "your_password",
            "writeMode": "insert",
            "column": [
                "ACCOUNT_ID",
                "CUSTOMER_NAME",
                "BALANCE",
                "SYNC_TIME"
            ],
            "preSql": ["DELETE FROM FINANCE.ACCOUNTS_SYNC WHERE SYNC_DATE = TRUNC(SYSDATE)"],
            "connection": [
                {
                    "table": ["FINANCE.ACCOUNTS_SYNC"],
                    "jdbcUrl": "jdbc:oracle:thin:@//10.0.0.4:1521/ORCL"
                }
            ],
            "batchSize": 1024
        }
    }
}
```

> [!note] Oracle 的 writeMode 说明
> oraclewriter 不支持 `replace` 模式（Oracle 没有 REPLACE INTO 语法）。
> 如果需要 upsert，可先把输入数据写入暂存表，再以暂存表为源执行 `MERGE INTO`；仅在 `preSql` 中放入 MERGE 并不能自动对尚未写入的输入流完成 upsert。先 DELETE 再 INSERT 则需明确删除范围，并设计失败恢复与事务边界。

---

## osswriter

把数据写入阿里云 OSS，适合数据归档、跨云数据迁移等场景。

```json
{
    "writer": {
        "name": "osswriter",
        "parameter": {
            "endpoint": "http://oss-cn-hangzhou-internal.aliyuncs.com",
            "accessId": "your-access-key-id",
            "accessKey": "your-access-key-secret",
            "bucket": "my-data-bucket",
            "object": "data/orders/dt=2026-03-18/orders",
            "writeMode": "overwrite",
            "fieldDelimiter": ",",
            "encoding": "UTF-8",
            "compress": "gzip",
            "fileType": "csv",
            "header": ["order_id", "user_id", "order_status", "amount", "create_time"],
            "column": [
                {"name": "order_id",     "type": "long"},
                {"name": "user_id",      "type": "long"},
                {"name": "order_status", "type": "string"},
                {"name": "amount",       "type": "double"},
                {"name": "create_time",  "type": "date",
                 "format": "yyyy-MM-dd HH:mm:ss"}
            ]
        }
    }
}
```

> [!note] OSS object 命名规则
> `object` 参数是文件前缀，DataX 会在后面追加随机数字生成最终的文件名。
> 比如 `object: "data/orders/dt=2026-03-18/orders"`，最终文件可能是 `data/orders/dt=2026-03-18/orders_0.csv.gz`。

---

## streamwriter

用于测试的 Writer，把数据输出到控制台，不写入任何存储系统。

```json
{
    "writer": {
        "name": "streamwriter",
        "parameter": {
            "print": true,
            "encoding": "UTF-8"
        }
    }
}
```

当 `print: false` 时，数据被消费但不打印，可以用来测试 Reader 的读取速度。

---

## Writer 选型建议

| 目标端 | 推荐 Writer | 备注 |
|--------|-----------|------|
| Hive 表（主流） | hdfswriter | 写 HDFS 分区目录，手动刷新分区 |
| MySQL（回写） | mysqlwriter | replace 可用于按主键或唯一键替换，需验证重复执行的结果与副作用 |
| Oracle | oraclewriter | 注意驱动版本 |
| HDFS 文件 | hdfswriter | 推荐 ORC + SNAPPY |
| OSS | osswriter | 归档场景，注意 Endpoint 选内网 |
| 调试验证 | streamwriter | 快速验证 Reader 配置 |

---

## 相关文档

- [[【技术与工具】/DataX/04-常用Reader插件|04-常用Reader插件]] - 从哪里读数据
- [[【技术与工具】/DataX/06-DataX实战场景|06-DataX实战场景]] - Reader + Writer 的完整组合示例
- [[【技术与工具】/DataX/07-DataX调优与运维|07-DataX调优与运维]] - Writer 侧的性能调优

---

#DataX #Writer #hdfswriter #mysqlwriter #osswriter #hivewriter #插件配置

---

> [!info] 前置知识
> - 掌握各种 Reader 插件的配置，参考 [[【技术与工具】/DataX/04-常用Reader插件|04-常用Reader插件]]
> - 了解 Hive 分区表的基本概念（分区目录结构 `/data/table/dt=2024-01-01/`）
> - 理解幂等写入的概念：同样的数据写多次结果相同；`writeMode: replace` 的删除再插入语义并不自动保证整个同步任务幂等，还需检查唯一键、默认值、触发器及关联约束

---

## 掌握检查

- [ ] 能配置 `hdfswriter`，正确设置 `path`（实际目标 HDFS 目录；写入指定 Hive 分区时可包含 `dt=...` 分区子目录）、`fileType: orc`，并按插件版本确认 SNAPPY 的参数取值，解释 ORC+SNAPPY 在兼容 Hive 分析场景中的常见优势（列式存储与压缩），而非假定所有场景性能最优
- [ ] 能解释 `hdfswriter` 写入 Hive 分区表的流程：DataX 先写到 HDFS 分区目录，然后需要手动执行 `ALTER TABLE ... ADD PARTITION` 或 `MSCK REPAIR TABLE` 才能让 Hive 感知到新分区
- [ ] 能配置 `mysqlwriter`，并说明本文三种 `writeMode` 选项（`insert`/`replace`/`insert ignore`）的区别：`insert` 遇重复主键通常报错，`replace` 在主键或唯一键冲突时先删后插，`insert ignore` 对重复键冲突跳过而不更新已有记录；同时说明 REPLACE 的副作用及幂等性验证条件
- [ ] 能解释 `streamwriter` 的用途：将数据打印到控制台，不写入任何存储，专门用于调试 Reader 配置是否正确（快速验证数据读取效果）
- [ ] 能说明写入 OSS 时应根据运行环境、地域及网络连通性选择 Endpoint，在满足内网访问条件时评估其流量成本优势，并说明 `osswriter` 的 `object` 参数如何配置路径前缀

---

## 实践练习

**基础题**：编写一个完整的 DataX Job（mysqlreader + mysqlwriter），将 MySQL `source_db.orders` 表的数据同步到 `target_db.orders_backup` 表，使用 `writeMode: replace`，并在隔离测试库中通过重复执行验证幂等性。明确目标表主键或唯一键、初始数据及同步范围，检查默认值、触发器和关联约束的影响。运行后验证目标表在同步范围内的数据与源表一致，并说明 REPLACE 不会自动删除源表已不存在的目标记录。

**进阶题**：设计一个 MySQL→Hive 分区表的同步任务。源表：MySQL `orders`，目标：Hive `ods.orders` 分区表（按 `dt` 分区）。编写 Job JSON，配置 `mysqlreader`（过滤昨日数据）和 `hdfswriter`（写入对应昨日日期的分区目录，ORC 格式；若假设运行日为 2024-01-16，则示例目录为 `/data/ods/orders/dt=2024-01-15/`）。说明同步完成后还需要执行什么操作才能在 Hive 中查询到数据。

---

## 下一步

[[【技术与工具】/DataX/06-DataX实战场景|06-DataX实战场景]] - 学习 MySQL→Hive 全量和增量同步的完整生产方案
