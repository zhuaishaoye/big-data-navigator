---
title: 07 Sink输出详解
tags:
  - 技术工具
  - Flume
  - 大数据采集
  - 数据管道
difficulty: 高级
duration: 25分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
stability: slow-changing
status: maintenance
access_tier: free
created: 2025-07-27
updated: 2026-10-10
---


> [!warning] 关联材料边界
> 以下原引用目标缺失或无法唯一确认，已取消跳转并保留提及：06-Channel通道详解；08-Flume拦截器详解；09-Flume Channel Selector；10-Flume Sink Processor。相关素材/延伸说明暂不可用，不能据此声称已经提供配套材料。

# Sink 输出详解

> [!info] 前置知识
> - [[【技术与工具】/Flume/05-Source数据源详解|Source 数据源详解]]：了解数据如何进入管道
> - Channel 通道详解（原引用“06-Channel通道详解”未能确定有效目标，暂不可跳转）：了解 Sink 从哪里取数据
> - [[【技术与工具】/Flume/04-第一个Flume应用|第一个 Flume 应用]]：已跑通基础的 netcat → logger 示例

Sink 是 Flume 管道的出口端，负责把 Channel 中的 Event 写入目标系统。常见 Sink 以 Channel 事务为单位取出 Event，按目标端的成功判定完成写入后提交事务，失败则回滚，供后续重试。Channel 事务不与目标系统构成跨系统原子事务：目标端已写入但本地未提交时，重试可能造成重复；实际交付保证还取决于 Channel 持久性及目标端确认配置。

理解 Sink 有一个关键认知：**Sink 从 Channel 拉取 Event，再向目标系统输出**。Sink Runner 通过 Sink Processor 调用 Sink 的 `process()` 方法，具体取数批量由 Sink 实现及配置决定。批量大小和处理延迟会影响吞吐量，Channel 性能、目标系统容量及并发配置也会形成瓶颈；不同 Sink 的批量参数名称并不相同。

---

## Sink 分类总览

| Sink 类型 | 目标系统 | 核心用途 | 生产可用 |
|-----------|----------|----------|----------|
| [[【技术与工具】/Flume/07-Sink输出详解|HDFS Sink]] | HDFS 分布式文件系统 | 数据仓库离线存储 | 是 |
| [[【技术与工具】/Flume/07-Sink输出详解|Kafka Sink]] | Kafka 消息队列 | 流式处理中转、系统解耦 | 是 |
| [[【技术与工具】/Flume/07-Sink输出详解|Avro Sink]] | 下游 Flume Agent | 多级 Agent 级联 | 是 |
| HBase Sink | HBase NoSQL | 实时随机读写 | 是 |
| Logger Sink | 日志文件/控制台 | 开发调试 | 否（调试用） |
| File Roll Sink | 本地文件系统 | 本地归档 | 有限场景 |

---

## HDFS Sink 详解

HDFS Sink 用于将数据按时间或大小分文件写入 HDFS，供 Hive、Spark 等框架做离线分析；本文未提供其使用普及程度的统计依据。

### 核心配置参数说明

**路径与文件命名**：

`hdfs.path` 是路径配置参数，支持时间转义变量，路径中可以嵌入 `%Y`（年）、`%m`（月）、`%d`（日）、`%H`（小时）。未启用 `hdfs.useLocalTimeStamp` 时，这些变量需要 Event Header 中有效的 `timestamp` 字段，可通过 Source 上的 `timestamp` 拦截器补充；启用 `hdfs.useLocalTimeStamp = true` 时则使用 Agent 本机时间，无需依赖该 Header。

```properties
# 按天按小时分区存储，路径示例：/warehouse/logs/2024-01-15/14/
agent.sinks.hdfs_sink.hdfs.path = /warehouse/logs/%Y-%m-%d/%H

# 文件前缀和后缀
agent.sinks.hdfs_sink.hdfs.filePrefix = events-
agent.sinks.hdfs_sink.hdfs.fileSuffix = .log
```

**文件滚动策略**（三选一或组合）：

滚动策略决定什么时候关闭当前文件、新建下一个文件。三个参数任意一个先触发，文件就会滚动：

```properties
# 按时间滚动：每 3600 秒（1小时）滚动一次，0 表示禁用
agent.sinks.hdfs_sink.hdfs.rollInterval = 3600

# 按文件大小滚动：128MB 时滚动，0 表示禁用
agent.sinks.hdfs_sink.hdfs.rollSize = 134217728

# 按 Event 数量滚动：0 表示禁用（推荐禁用，避免产生大量小文件）
agent.sinks.hdfs_sink.hdfs.rollCount = 0
```

> [!warning] 小文件陷阱
> `rollCount` 默认值是 10，不显式设为 0 的话，每写 10 条就会新建一个文件，会在 HDFS 上产生海量小文件，严重拖慢 NameNode 和下游 Hive 查询。日志批量落盘场景通常可将 `rollCount` 设为 0，主要用时间或大小控制滚动；是否禁用按条数滚动应结合文件大小和业务需求决定。

**文件类型与写入格式**：

`hdfs.fileType` 控制底层文件格式，`hdfs.writeFormat` 控制 Event Body 如何序列化：

```properties
# SequenceFile：适合存储二进制数据，支持压缩
agent.sinks.hdfs_sink.hdfs.fileType = SequenceFile
agent.sinks.hdfs_sink.hdfs.writeFormat = Writable

# DataStream：纯文本流，适合日志类文本数据
agent.sinks.hdfs_sink.hdfs.fileType = DataStream
agent.sinks.hdfs_sink.hdfs.writeFormat = Text

# CompressedStream：带压缩的数据流，需要同时指定 codeC
agent.sinks.hdfs_sink.hdfs.fileType = CompressedStream
agent.sinks.hdfs_sink.hdfs.codeC = snappy
```

**完整生产配置示例**：

```properties
agent.sinks.hdfs_sink.type = hdfs
agent.sinks.hdfs_sink.channel = file_channel

# 路径（本例启用 useLocalTimeStamp，使用 Agent 本机时间）
agent.sinks.hdfs_sink.hdfs.path = /warehouse/app_logs/%Y-%m-%d/%H
agent.sinks.hdfs_sink.hdfs.filePrefix = app-
agent.sinks.hdfs_sink.hdfs.fileSuffix = .log
agent.sinks.hdfs_sink.hdfs.useLocalTimeStamp = true

# 文件滚动：1小时或 128MB，按先触发的为准
agent.sinks.hdfs_sink.hdfs.rollInterval = 3600
agent.sinks.hdfs_sink.hdfs.rollSize = 134217728
agent.sinks.hdfs_sink.hdfs.rollCount = 0

# 文件格式：文本 + gzip 压缩
agent.sinks.hdfs_sink.hdfs.fileType = CompressedStream
agent.sinks.hdfs_sink.hdfs.codeC = gzip

# 性能参数
agent.sinks.hdfs_sink.hdfs.batchSize = 1000
agent.sinks.hdfs_sink.hdfs.threadsPoolSize = 10
agent.sinks.hdfs_sink.hdfs.callTimeout = 30000

# 最低块副本阈值（可选；不是 HDFS 高可用开关，设为 1 需评估可靠性取舍）
agent.sinks.hdfs_sink.hdfs.minBlockReplicas = 1
```

> [!tip] useLocalTimeStamp
> 将 `hdfs.useLocalTimeStamp` 设为 `true` 后，路径中的时间变量使用 Flume Agent 本机时间，而不是 Event Header 里的 timestamp。适合 Source 没有打时间戳的场景，但这意味着文件分区时间是数据到达 Flume 的时间，不是数据产生的时间，要注意区别。

---

## Kafka Sink 详解

Kafka Sink 将 Event 发布到 Kafka Topic，常见于以下两种架构：一是 Flume 作为日志收集前端，把数据汇入 Kafka 供 Flink 或 Spark Streaming 消费；二是跨数据中心的数据同步（Flume 采集 → Kafka Sink → 远端 Kafka Source → 目标系统）。

```properties
agent.sinks.kafka_sink.type = org.apache.flume.sink.kafka.KafkaSink
agent.sinks.kafka_sink.channel = memory_channel

# Kafka 集群地址
agent.sinks.kafka_sink.kafka.bootstrap.servers = kafka01:9092,kafka02:9092,kafka03:9092

# 目标 Topic（也可从 Event Header 的 topic 字段动态读取）
agent.sinks.kafka_sink.kafka.topic = app-logs

# 批量大小：每次从 Channel 取多少条 Event 组成一批发送
agent.sinks.kafka_sink.kafka.flumeBatchSize = 20

# Acks 可靠性级别：0=不确认，1=Leader 确认，all=当前 ISR 中所有副本确认；需结合 min.insync.replicas 评估可靠性
agent.sinks.kafka_sink.kafka.producer.acks = 1

# 压缩：降低网络带宽消耗
agent.sinks.kafka_sink.kafka.producer.compression.type = snappy

# 分区键：在上游为 Event Header 设置 key 字段，由 Kafka Sink 读取
# kafka.producer.key 不是用于读取 Event Header 的有效配置，此处不设置该属性
# 未提供 key 时，分区选择取决于 Kafka 客户端版本及分区器配置，不保证轮询
```

> [!note] Topic 动态路由
> Kafka Sink 支持从 Event Header 中读取 `topic` 字段来动态选择目标 Topic。在 Source 端用正则拦截器给不同类型的日志打上不同的 `topic` Header，Kafka Sink 就能将它们路由到不同 Topic，实现一条管道按内容分类投递。

---

## Avro Sink 详解

Avro Sink 用于构建多级 Agent 拓扑。它把 Event 序列化为 Avro 格式，通过 RPC 发送给下游的 Avro Source。典型场景是：多台应用服务器各跑一个 Collector Agent，都用 Avro Sink 指向同一台 Aggregator Agent 的 Avro Source，实现日志汇聚。

```properties
agent.sinks.avro_sink.type = avro
agent.sinks.avro_sink.channel = memory_channel

# 下游 Avro Source 的地址和端口
agent.sinks.avro_sink.hostname = aggregator-host
agent.sinks.avro_sink.port = 41414

# 批量大小
agent.sinks.avro_sink.batch-size = 100

# 连接超时（毫秒）
agent.sinks.avro_sink.connect-timeout = 20000
agent.sinks.avro_sink.request-timeout = 20000

# 可选：启用压缩（deflate 级别 1-9）
agent.sinks.avro_sink.compression-type = deflate
agent.sinks.avro_sink.compression-level = 6
```

---

## 自定义 Sink 开发

当内置 Sink 无法满足需求时（例如写入私有存储、调用第三方 API），需要开发自定义 Sink。

### 实现接口

自定义 Sink 需继承 `AbstractSink` 并实现 `Configurable` 接口：

```java
import org.apache.flume.Channel;
import org.apache.flume.Context;
import org.apache.flume.Event;
import org.apache.flume.EventDeliveryException;
import org.apache.flume.Transaction;
import org.apache.flume.conf.Configurable;
import org.apache.flume.sink.AbstractSink;

public class MyCustomSink extends AbstractSink implements Configurable {

    private String targetUrl;
    private int batchSize;

    // 从配置文件读取参数，在 Agent 启动时调用一次
    @Override
    public void configure(Context context) {
        this.targetUrl = context.getString("targetUrl", "http://localhost:8080/ingest");
        this.batchSize = context.getInteger("batchSize", 100);
    }

    // 核心处理方法，由 Sink Runner 线程反复调用
    @Override
    public Status process() throws EventDeliveryException {
        Channel channel = getChannel();
        Transaction transaction = channel.getTransaction();
        Status status = Status.READY;

        try {
            transaction.begin();

            for (int i = 0; i < batchSize; i++) {
                Event event = channel.take();
                if (event == null) {
                    // Channel 为空，本轮没有数据
                    status = Status.BACKOFF;
                    break;
                }
                // 在此处理 event，例如发送 HTTP 请求
                sendToTarget(event);
            }

            transaction.commit();

        } catch (Exception e) {
            transaction.rollback();
            throw new EventDeliveryException("Failed to process events", e);
        } finally {
            transaction.close();
        }

        return status;
    }

    private void sendToTarget(Event event) {
        // 教学占位：需实现实际发送，并在确认目标端成功接收后才能返回
        // 未实现时显式失败，避免事务提交导致未发送的 Event 被移除
        throw new UnsupportedOperationException("Target delivery is not implemented");
    }
}
```

关键点说明：
- `Status.READY` 表示本次成功处理了数据，Runner 立刻进行下一次调用
- `Status.BACKOFF` 表示 Channel 暂时为空，Runner 会短暂休眠后再试，避免空轮询耗 CPU
- 事务必须在 finally 块中 `close()`，防止资源泄漏
- `rollback()` 后数据回到 Channel，下次会重新处理，所以自定义写入逻辑要考虑幂等性

### 配置文件引用

```properties
agent.sinks.my_sink.type = com.example.flume.MyCustomSink
agent.sinks.my_sink.channel = memory_channel
agent.sinks.my_sink.targetUrl = http://data-api.example.com/ingest
agent.sinks.my_sink.batchSize = 50
```

---

## Sink 性能调优要点

| 调优点 | 说明 | 建议值 |
|--------|------|--------|
| `batchSize` | 每次从 Channel 取多少条 Event | HDFS: 1000，Kafka: 20-100 |
| 文件滚动间隔 | HDFS Sink 的 rollInterval | 生产环境 3600（1小时）|
| 文件大小阈值 | HDFS Sink 的 rollSize | 128MB（HDFS block size）|
| 压缩格式 | snappy 压缩比和速度平衡好 | 日志类用 snappy 或 gzip |
| 线程池大小 | HDFS Sink 的 threadsPoolSize | CPU 核数 × 2 |

---

## 掌握检查

- [ ] 能解释 HDFS Sink 三个滚动参数（rollInterval、rollSize、rollCount）各自的触发条件
- [ ] 知道 `rollCount` 不设为 0 会带来什么问题
- [ ] 能写出 Kafka Sink 的基础配置，包括 bootstrap.servers 和 acks 参数
- [ ] 能说出 Avro Sink 在多级 Agent 拓扑中扮演的角色
- [ ] 理解自定义 Sink 中 `Status.BACKOFF` 和 `Status.READY` 的区别

## 实践练习

**基础题**：将以下需求翻译成 HDFS Sink 配置：按天分区存储（路径格式 `/data/logs/2024-01-15/`），每 2 小时或 256MB 滚动一次文件，使用 snappy 压缩，batchSize 500。

**进阶题**：设计一个场景：10 台 Web 服务器的 Nginx 访问日志，要同时写入 HDFS（按天存档）和 Kafka（供实时报警消费）。画出 Agent 拓扑图，说明需要哪些 Sink 和 Channel 配置。

## 下一步

学完 Sink 输出，数据管道的三个核心组件已全部覆盖。接下来建议学习：

- 拦截器（Interceptor）详解（原引用“08-Flume拦截器详解”未能确定有效目标，暂不可跳转）：在 Source 和 Channel 之间对数据做过滤、打标签
- Channel Selector（原引用“09-Flume Channel Selector”未能确定有效目标，暂不可跳转）：控制一条 Event 应该发往哪个 Channel
- Sink Processor（原引用“10-Flume Sink Processor”未能确定有效目标，暂不可跳转）：配置 Sink 的故障转移和负载均衡
