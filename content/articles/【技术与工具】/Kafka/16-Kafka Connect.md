---
title: Kafka Connect - 构建数据管道的利器
tags:
  - Kafka
  - Connect
  - 数据集成
  - ETL
  - 数据管道
  - CDC
difficulty: 高级
duration: 45分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
stability: slow-changing
status: maintenance
access_tier: free
updated: 2026-10-10
---


# Kafka Connect - 构建数据管道的利器

> [!abstract] 本节概览
> - 学习目标：全面掌握 Kafka Connect 的架构、配置与生产实践
> - 前置知识：[[【技术与工具】/Kafka/15-安全配置|Kafka 安全配置]]
> - 预计用时：45分钟
> - 后续学习：[[【技术与工具】/Kafka/17-Kafka Streams基础|Kafka Streams 基础]]

假设数据工程师小陈需要将 MySQL 中的订单数据、MongoDB 中的用户行为数据统一导入 Kafka，供下游 20 多个系统消费。若各系统分别建设同步链路，可能需要维护多个同步程序，但程序数量并不必然等于消费系统数量。Kafka Connect 可通过适配的 Connector 统一接入；断点续传、并行处理与故障恢复的具体能力取决于连接器实现、源端条件和部署配置。

---

## Connect 架构解析

### 核心组件分工

```text
外部数据源（MySQL / MongoDB / S3 / API）
          |
   Source Connector
   （从数据源读取，转为 SourceRecord）
          |
   Connect Worker 进程
   （分布式模式：多个 Worker 组成集群）
          |
   Kafka Cluster
          |
   Sink Connector
   （从 Kafka 读取，写入目标系统）
          |
目标系统（数据仓库 / Elasticsearch / HDFS）
```

| 组件 | 职责 | 关键点 |
|------|------|--------|
| Worker 进程 | Connect 的运行环境，负责管理 Connector 和 Task | 无状态，可水平扩展 |
| Connector | 定义数据源/目标的连接逻辑，决定创建多少 Task | 不做数据处理，只分配配置 |
| Task | 实际执行数据读写的工作单元 | 可并行，是真正的处理线程 |
| SMT (Single Message Transform) | 在消息写入/读出时做轻量级转换 | 链式执行，不可有副作用 |

### 分布式模式 vs 单机模式

| 维度 | 分布式模式（Distributed） | 单机模式（Standalone） |
|------|--------------------------|----------------------|
| 部署方式 | 多个 Worker 进程，形成集群 | 单个 Worker 进程 |
| 状态存储 | Offset/Config/Status 存在 Kafka Topic 中 | Source Offset 通常持久化到本地文件；Connector 配置由配置文件提供，运行状态由进程管理 |
| 高可用 | Worker 宕机后，Task 自动迁移到其他 Worker | 无高可用 |
| 适用场景 | 生产环境 | 本地测试、简单 ETL |
| 配置文件 | `connect-distributed.properties` | `connect-standalone.properties` |

---

## Worker 配置与启动

### 分布式 Worker 核心配置

```properties
# connect-distributed.properties

# 连接的 Kafka 集群
bootstrap.servers=kafka-01:9092,kafka-02:9092,kafka-03:9092

# Connect 集群 ID（同一集群的所有 Worker 必须相同）
group.id=connect-cluster-prod

# 三个内部 Topic，存储 Connect 的状态（首次启动会自动创建）
config.storage.topic=connect-configs
config.storage.replication.factor=3
offset.storage.topic=connect-offsets
offset.storage.replication.factor=3
offset.storage.partitions=25
status.storage.topic=connect-status
status.storage.replication.factor=3
status.storage.partitions=5

# 默认序列化器（推荐 JSON，生产可考虑 Avro + Schema Registry）
key.converter=org.apache.kafka.connect.json.JsonConverter
value.converter=org.apache.kafka.connect.json.JsonConverter
key.converter.schemas.enable=false
value.converter.schemas.enable=false

# Connector 插件路径（可指定多个目录，逗号分隔）
plugin.path=/opt/kafka/connectors,/usr/share/java

# REST API 配置
listeners=HTTP://:8083
rest.advertised.host.name=connect-worker-01
rest.advertised.port=8083

# 任务配置
task.shutdown.graceful.timeout.ms=10000
offset.flush.interval.ms=10000
offset.flush.timeout.ms=5000
```

**Worker 调优参数：**

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `offset.flush.interval.ms` | `60000` | Offset 刷新到 Kafka 的间隔，影响崩溃后的重复数据量 |
| `offset.flush.timeout.ms` | `5000` | Offset 刷新超时，超时不影响处理但会有警告 |
| `task.shutdown.graceful.timeout.ms` | `5000` | Task 优雅停机等待时间 |
| `consumer.max.poll.records` | `500` | Sink Task 每次 poll 的最大消息数（覆盖消费者参数） |
| `producer.batch.size` | `16384` | Source Task 生产者批量发送大小（覆盖生产者参数） |
| `producer.linger.ms` | `0` | 生产者批量等待时间 |

### 启动 Worker

```bash
# 分布式模式启动
bin/connect-distributed.sh config/connect-distributed.properties &

# 验证启动状态
curl -s http://localhost:8083/ | python3 -m json.tool
# 输出：{"version":"3.6.0","commit":"...","kafka_cluster_id":"..."}
```

---

## REST API 完整操作指南

### Connector 生命周期管理

```bash
# 查看所有 Connector
curl -s http://localhost:8083/connectors

# 查看特定 Connector 状态
curl -s http://localhost:8083/connectors/mysql-orders-source/status | python3 -m json.tool

# 创建 Connector（POST）
curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d @connector-config.json

# 更新 Connector 配置（PUT，会触发重启）
curl -X PUT http://localhost:8083/connectors/mysql-orders-source/config \
  -H "Content-Type: application/json" \
  -d @new-config.json

# 暂停 Connector（停止消费/生产，保留状态）
curl -X PUT http://localhost:8083/connectors/mysql-orders-source/pause

# 恢复 Connector
curl -X PUT http://localhost:8083/connectors/mysql-orders-source/resume

# 重启 Connector
curl -X POST http://localhost:8083/connectors/mysql-orders-source/restart

# 重启特定 Task（常用于 Task FAILED 时）
curl -X POST http://localhost:8083/connectors/mysql-orders-source/tasks/0/restart

# 删除 Connector
curl -X DELETE http://localhost:8083/connectors/mysql-orders-source

# 查看可用的 Connector 插件
curl -s http://localhost:8083/connector-plugins | python3 -m json.tool
```

---

## Source Connector 实战

### FileStreamSourceConnector（快速验证）

```json
{
  "name": "file-source-demo",
  "config": {
    "connector.class": "org.apache.kafka.connect.file.FileStreamSourceConnector",
    "tasks.max": "1",
    "file": "/var/log/app/application.log",
    "topic": "app-logs",
    "key.converter": "org.apache.kafka.connect.storage.StringConverter",
    "value.converter": "org.apache.kafka.connect.storage.StringConverter"
  }
}
```

### JDBC Source Connector（MySQL 增量同步）

```json
{
  "name": "mysql-orders-source",
  "config": {
    "connector.class": "io.confluent.connect.jdbc.JdbcSourceConnector",
    "tasks.max": "3",

    "connection.url": "jdbc:mysql://mysql-host:3306/ecommerce?useSSL=true&serverTimezone=UTC",
    "connection.user": "kafka_sync",
    "connection.password": "sync-pass-2024",

    "table.whitelist": "orders,order_items",
    "topic.prefix": "mysql.ecommerce.",

    "mode": "timestamp+incrementing",
    "timestamp.column.name": "updated_at",
    "incrementing.column.name": "id",

    "poll.interval.ms": "5000",
    "batch.max.rows": "1000",
    "numeric.mapping": "best_fit",
    "timestamp.delay.interval.ms": "1000",

    "key.converter": "org.apache.kafka.connect.json.JsonConverter",
    "key.converter.schemas.enable": "false",
    "value.converter": "org.apache.kafka.connect.json.JsonConverter",
    "value.converter.schemas.enable": "false"
  }
}
```

**JDBC Source 同步模式对比：**

| 模式 | 适用场景 | 局限性 |
|------|----------|--------|
| `bulk` | 全量同步，每次 poll 读全表 | 数据量大时性能差，不适合增量 |
| `incrementing` | 有自增主键的表，只读新插入记录 | 无法捕获 UPDATE/DELETE |
| `timestamp` | 有更新时间戳的表，捕获新增和修改 | 时钟漂移可能导致丢数据 |
| `timestamp+incrementing` | 两者结合，最常用 | 仍无法捕获 DELETE |

**关键配置项说明：**

| 配置项 | 示例值 | 说明 |
|--------|--------|------|
| `mode` | `timestamp+incrementing` | 同步模式 |
| `timestamp.column.name` | `updated_at` | 时间戳列名 |
| `incrementing.column.name` | `id` | 自增列名 |
| `poll.interval.ms` | `5000` | 两次查询间隔（毫秒） |
| `batch.max.rows` | `1000` | 单次查询最大行数 |
| `timestamp.delay.interval.ms` | `1000` | 时间戳查询延迟，避免读到"未完成"的事务 |

---

## Sink Connector 实战

### JDBC Sink Connector（写回 MySQL）

```json
{
  "name": "mysql-users-sink",
  "config": {
    "connector.class": "io.confluent.connect.jdbc.JdbcSinkConnector",
    "tasks.max": "2",

    "connection.url": "jdbc:mysql://mysql-target:3306/warehouse",
    "connection.user": "kafka_write",
    "connection.password": "write-pass-2024",

    "topics": "mysql.ecommerce.orders",
    "table.name.format": "${topic}",

    "insert.mode": "upsert",
    "pk.mode": "record_key",
    "pk.fields": "id",

    "auto.create": "false",
    "auto.evolve": "false",
    "batch.size": "500",

    "key.converter": "org.apache.kafka.connect.json.JsonConverter",
    "key.converter.schemas.enable": "false",
    "value.converter": "org.apache.kafka.connect.json.JsonConverter",
    "value.converter.schemas.enable": "false"
  }
}
```

**`insert.mode` 参数说明：**

| 值 | 行为 |
|----|------|
| `insert` | 始终 INSERT，主键冲突时报错 |
| `upsert` | 有则更新，无则插入（推荐）|
| `update` | 始终 UPDATE，记录不存在时忽略 |

---

## Debezium CDC 实时捕获

CDC（Change Data Capture）基于数据库 binlog，可以捕获 INSERT/UPDATE/DELETE 全部变更，是 JDBC Source 无法做到的。

### Debezium MySQL Connector 配置

```json
{
  "name": "debezium-mysql-cdc",
  "config": {
    "connector.class": "io.debezium.connector.mysql.MySqlConnector",
    "tasks.max": "1",

    "database.hostname": "mysql-primary",
    "database.port": "3306",
    "database.user": "debezium",
    "database.password": "debezium-pass",
    "database.server.id": "184054",
    "database.server.name": "mysql-prod",

    "database.include.list": "ecommerce",
    "table.include.list": "ecommerce.orders,ecommerce.users",

    "database.history.kafka.bootstrap.servers": "kafka-01:9092",
    "database.history.kafka.topic": "schema-changes.ecommerce",

    "snapshot.mode": "initial",
    "snapshot.locking.mode": "minimal",

    "include.schema.changes": "true",
    "decimal.handling.mode": "string",
    "time.precision.mode": "connect",

    "key.converter": "org.apache.kafka.connect.json.JsonConverter",
    "key.converter.schemas.enable": "true",
    "value.converter": "org.apache.kafka.connect.json.JsonConverter",
    "value.converter.schemas.enable": "true"
  }
}
```

**关键配置说明：**

| 配置项 | 说明 |
|--------|------|
| `database.server.id` | 在 MySQL 集群中唯一标识 Debezium，不能与其他 replica 重复 |
| `snapshot.mode` | `initial`=首次全量快照再增量；`never`=不做初始快照、直接捕获增量；旧版 `schema_only`=仅做表结构快照、不读取存量数据，随后继续捕获增量变更 |
| `database.history.kafka.topic` | 存储 DDL 变更历史的 Topic，Debezium 重启时用于恢复状态 |
| `snapshot.locking.mode` | `minimal`=最短锁表时间；`none`=不锁表（可能不一致） |

**Debezium 变更事件格式：**

```json
{
  "before": {"id": 1, "status": "pending"},
  "after":  {"id": 1, "status": "shipped"},
  "source": {
    "db": "ecommerce",
    "table": "orders",
    "ts_ms": 1711000000000
  },
  "op": "u",
  "ts_ms": 1711000001234
}
```

`op` 字段含义：`c`=创建、`u`=更新、`d`=删除、`r`=快照读取。

---

## MirrorMaker 2（跨集群复制）

MirrorMaker 2（MM2）基于 Kafka Connect 框架，用于跨 Kafka 集群数据复制。

### MM2 配置文件（mm2.properties）

```properties
# 定义集群别名
clusters = source, target

# 集群连接地址
source.bootstrap.servers = kafka-source-01:9092,kafka-source-02:9092
target.bootstrap.servers = kafka-target-01:9092,kafka-target-02:9092

# 复制规则：source -> target
source->target.enabled = true
source->target.topics = .*
source->target.groups = .*

# Topic 排除规则（支持正则）
source->target.topics.blacklist = _.*,connect-.*

# Replication Factor
source->target.replication.factor = 3

# 心跳 Topic（用于监控延迟）
source->target.emit.heartbeats.enabled = true
source->target.emit.heartbeats.interval.seconds = 5

# Checkpoint（同步消费者 Offset，用于故障切换）
source->target.emit.checkpoints.enabled = true
source->target.emit.checkpoints.interval.seconds = 60
source->target.sync.group.offsets.enabled = true
source->target.sync.group.offsets.interval.seconds = 60

# Worker 配置
replication.factor = 3
tasks.max = 4
```

启动 MM2：

```bash
bin/connect-mirror-maker.sh mm2.properties
```

复制后的 Topic 命名规则：目标集群中的 Topic 会加上源集群前缀，如 `source.orders`。

---

## Single Message Transforms（SMT）

SMT 在消息进入 Kafka 或离开 Kafka 时进行轻量级转换，多个 SMT 通过逗号分隔链式执行。

### 常用 SMT 配置示例

```json
{
  "name": "mysql-enriched-source",
  "config": {
    "connector.class": "io.confluent.connect.jdbc.JdbcSourceConnector",
    "connection.url": "jdbc:mysql://localhost/ecommerce",
    "connection.user": "kafka_sync",
    "connection.password": "sync-pass",
    "table.whitelist": "orders",
    "mode": "incrementing",
    "incrementing.column.name": "id",
    "topic.prefix": "raw.",

    "transforms": "addTimestamp,maskPhone,dropInternal,renameField",

    "transforms.addTimestamp.type": "org.apache.kafka.connect.transforms.InsertField$Value",
    "transforms.addTimestamp.timestamp.field": "sync_at",

    "transforms.maskPhone.type": "org.apache.kafka.connect.transforms.MaskField$Value",
    "transforms.maskPhone.fields": "phone,id_card",
    "transforms.maskPhone.replacement": "***",

    "transforms.dropInternal.type": "org.apache.kafka.connect.transforms.ReplaceField$Value",
    "transforms.dropInternal.blacklist": "internal_flag,debug_info",

    "transforms.renameField.type": "org.apache.kafka.connect.transforms.ReplaceField$Value",
    "transforms.renameField.renames": "user_id:userId,created_at:createdAt",

    "value.converter": "org.apache.kafka.connect.json.JsonConverter",
    "value.converter.schemas.enable": "false"
  }
}
```

**常用 SMT 类型速查：**

| SMT 类型 | 作用 |
|----------|------|
| `InsertField$Value` | 插入新字段（静态值或时间戳）|
| `ReplaceField$Value` | 删除字段（blacklist）或重命名字段（renames）|
| `MaskField$Value` | 将指定字段值替换为 `0`/`null`/自定义字符串（脱敏）|
| `ExtractField$Key` | 从记录键的 Struct 或 Map 中提取单个字段作为新键；处理记录值使用 `ExtractField$Value` |
| `RegexRouter` | 用正则表达式修改 Topic 路由 |
| `TimestampConverter` | 时间格式转换（Unix 毫秒 <-> String） |
| `Flatten$Value` | 将嵌套 Struct 展平为单层 |
| `Filter` | 基于条件丢弃消息（需配合 `predicates`）|

---

## 自定义 Connector 开发

### SourceConnector 骨架

```java
public class HttpPollingSourceConnector extends SourceConnector {

    private String apiUrl;
    private String topicName;
    private int pollIntervalMs;

    @Override
    public void start(Map<String, String> props) {
        this.apiUrl = props.get("api.url");
        this.topicName = props.get("topic");
        this.pollIntervalMs = Integer.parseInt(
            props.getOrDefault("poll.interval.ms", "5000")
        );
    }

    @Override
    public Class<? extends Task> taskClass() {
        return HttpPollingSourceTask.class;
    }

    @Override
    public List<Map<String, String>> taskConfigs(int maxTasks) {
        // 简单示例：所有 Task 使用相同配置
        // 实际可按 API 路径、分片等方式分配
        List<Map<String, String>> configs = new ArrayList<>();
        for (int i = 0; i < Math.min(maxTasks, 1); i++) {
            Map<String, String> config = new HashMap<>();
            config.put("api.url", apiUrl);
            config.put("topic", topicName);
            config.put("poll.interval.ms", String.valueOf(pollIntervalMs));
            configs.add(config);
        }
        return configs;
    }

    @Override
    public void stop() { }

    @Override
    public ConfigDef config() {
        return new ConfigDef()
            .define("api.url", ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "API 地址")
            .define("topic", ConfigDef.Type.STRING, ConfigDef.Importance.HIGH, "目标 Topic")
            .define("poll.interval.ms", ConfigDef.Type.INT, 5000,
                    ConfigDef.Importance.MEDIUM, "轮询间隔（毫秒）");
    }

    @Override
    public String version() { return "1.0.0"; }
}
```

### SourceTask 的 poll() 方法

```java
public class HttpPollingSourceTask extends SourceTask {

    private String apiUrl;
    private String topicName;
    private int pollIntervalMs;
    private Map<String, Object> sourcePartition;

    @Override
    public void start(Map<String, String> props) {
        this.apiUrl = props.get("api.url");
        this.topicName = props.get("topic");
        this.pollIntervalMs = Integer.parseInt(props.get("poll.interval.ms"));
        this.sourcePartition = Collections.singletonMap("url", apiUrl);
    }

    @Override
    public List<SourceRecord> poll() throws InterruptedException {
        Thread.sleep(pollIntervalMs);

        // 获取上次处理到的 Offset（用于断点续传）
        Map<String, Object> offset = context.offsetStorageReader()
            .offset(sourcePartition);
        long lastId = offset != null
            ? (Long) offset.getOrDefault("last_id", 0L)
            : 0L;

        // 调用 API 获取新数据
        List<Map<String, Object>> newItems = fetchNewItems(lastId);
        if (newItems.isEmpty()) {
            return Collections.emptyList();
        }

        List<SourceRecord> records = new ArrayList<>();
        long maxId = lastId;

        for (Map<String, Object> item : newItems) {
            long id = (Long) item.get("id");
            maxId = Math.max(maxId, id);

            // 构造 SourceRecord
            // sourcePartition: 标识这条数据的来源（用于 Offset 存储 key）
            // sourceOffset: 标识这条数据在源系统的位置（断点续传用）
            records.add(new SourceRecord(
                sourcePartition,
                Collections.singletonMap("last_id", maxId),
                topicName,
                null,                              // Key Schema
                String.valueOf(id),                // Key
                null,                              // Value Schema
                new ObjectMapper().writeValueAsString(item)  // Value
            ));
        }
        return records;
    }

    private List<Map<String, Object>> fetchNewItems(long lastId) {
        // 实现 HTTP 请求逻辑，返回 id > lastId 的记录
        return Collections.emptyList();
    }

    @Override
    public void stop() { }

    @Override
    public String version() { return "1.0.0"; }
}
```

> [!note] poll() 方法的关键契约
> - `poll()` 在没有可用记录时可以返回 null 或空列表，框架会继续调用；避免无数据时忙轮询
> - `poll()` 是阻塞的，内部 sleep 是可接受的方式
> - Offset 由框架负责提交，Task 只需在 `SourceRecord` 中声明正确的 offset

---

## 掌握检查

- [ ] 能描述 Worker、Connector、Task 三者的分工
- [ ] 能用 curl 完成 Connector 的增删改查和状态管理
- [ ] 能配置 JDBC Source Connector 的三种同步模式，并说明各自局限
- [ ] 能区分 Debezium CDC 和 JDBC Source 的适用场景
- [ ] 能为一个实际需求选择并配置合适的 SMT 链
- [ ] 理解 SourceTask 的 `poll()` 方法和 Offset 存储机制

## 练习题

1. 你需要将 MySQL `orders` 表的新增和修改同步到 Kafka，但也需要捕获删除操作，应选择哪种方案？写出关键配置。
2. 业务要求将 `users` Topic 中的 `phone` 字段脱敏后写入 Elasticsearch，请设计包含 SMT 的 Sink Connector 配置。
3. 现有一个 JDBC Source Connector 的 Task 进入 FAILED 状态，写出诊断和恢复的完整步骤（包括 curl 命令）。
4. 解释 `tasks.max` 与实际运行 Task 数量的关系——什么情况下实际 Task 数会少于 `tasks.max`？

---

## 学习连接

**前置知识**: [[【技术与工具】/Kafka/15-安全配置|Kafka 安全配置]]
**下一步学习**: [[【技术与工具】/Kafka/17-Kafka Streams基础|Kafka Streams 基础]]
**相关概念**:
- Flink 流处理
- CDC 变更数据捕获
- 数据集成架构

---

> [!tip] Connect 核心价值
> Kafka Connect 的价值不在于功能，而在于**标准化**：统一的部署模型、统一的监控接口、统一的 Offset 管理。理解这套框架后，对于已有适配 Connector 的数据源，可复用统一部署与管理方式；实际接入仍需满足插件兼容性、源端权限、数据契约和运行条件，缺少适配插件时可能需要自行开发。
