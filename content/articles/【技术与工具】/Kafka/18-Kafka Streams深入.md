---
title: Kafka Streams深入 - 掌握高级流处理技术
tags:
  - Kafka
  - Streams
  - 高级特性
  - 状态存储
  - 时间语义
  - 监控
  - KSQL
difficulty: 高级
duration: 50分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
stability: slow-changing
status: maintenance
access_tier: free
updated: 2026-10-10
---


# Kafka Streams深入 - 掌握高级流处理技术

> [!abstract] 本节概览
> - 学习目标：掌握 Kafka Streams 的时间语义、状态管理、容错与监控
> - 前置知识：[[【技术与工具】/Kafka/17-Kafka Streams基础|Kafka Streams 基础]]
> - 预计用时：50分钟
> - 后续学习：[[【技术与工具】/Kafka/19-Schema Registry|Schema Registry]]

高级架构师老陈收到一个棘手需求：实时风控系统需要在毫秒级内完成用户画像聚合、异常检测和决策输出，同时要处理网络延迟导致的乱序事件。"这已经不是简单的流处理了，"老陈深吸一口气，"需要搞清楚时间语义、水位线、状态管理和错误处理——这才是流处理的真正难点。"

---

## 流处理时间语义

### 三种时间概念

理解时间语义是流处理的基础，不同的时间定义会导致完全不同的计算结果。

| 时间类型 | 定义 | 特点 | 适用场景 |
|----------|------|------|----------|
| **Event Time（事件时间）** | 事件在数据源实际发生的时间 | 最准确，但可能乱序、延迟到达 | 业务分析、精确统计 |
| **Ingestion Time（摄入时间）** | 事件进入 Kafka Broker 的时间，可由 LogAppendTime 表示 | 更接近摄入时刻，但不保证事件时间有序或跨分区全局有序 | 近实时场景 |
| **Processing Time（处理时间）** | 事件被 Streams 处理时的系统时间 | 最简单，但跨实例不一致 | 监控、低精度统计 |

**类比说明：** 一封信在北京寄出（Event Time），在路上走了3天（网络延迟），今天到你手上（Processing Time），信封上的邮戳时间（Ingestion Time）。如果你要统计"本周北京寄出的信件数量"，必须用 Event Time，而不是你拿到信的时间。

### Timestamp Extractor 配置

Streams 通过 Timestamp Extractor 决定每条记录的时间戳。

```java
// 内置 Timestamp Extractor
// 1. FailOnInvalidTimestamp（默认）：使用 Kafka 消息时间戳，时间戳无效则抛异常
// 2. LogAndSkipOnInvalidTimestamp：时间戳无效时跳过该消息
// 3. UsePartitionTimeOnInvalidTimestamp：时间戳无效时使用分区最新时间
// 4. WallclockTimestampExtractor：始终用处理时间（不推荐用于精确统计）

// 自定义 Timestamp Extractor：从消息内容提取事件时间
public class EventTimeExtractor implements TimestampExtractor {

    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public long extract(ConsumerRecord<Object, Object> record, long partitionTime) {
        if (record.value() instanceof String) {
            try {
                JsonNode node = mapper.readTree((String) record.value());
                if (node.has("event_time")) {
                    return node.get("event_time").asLong();
                }
            } catch (Exception e) {
                // 解析失败，回退到分区时间
            }
        }
        // 回退到 Kafka 消息时间戳
        return record.timestamp() >= 0 ? record.timestamp() : partitionTime;
    }
}

// 在 Streams 配置中指定
props.put(StreamsConfig.DEFAULT_TIMESTAMP_EXTRACTOR_CLASS_CONFIG,
          EventTimeExtractor.class.getName());

// 也可以在 stream() 调用时单独指定（覆盖全局配置）
KStream<String, String> stream = builder.stream(
    "events",
    Consumed.with(Serdes.String(), Serdes.String())
            .withTimestampExtractor(new EventTimeExtractor())
);
```

### 水位线（Watermark）与 Grace Period

Kafka Streams 没有像 Flink 那样显式的水位线概念，而是通过 **Grace Period** 来处理迟到数据。

Grace Period 的含义：以 stream-time 为依据，在窗口结束时间加宽限期所界定的关闭条件之前接纳迟到记录；它不是按系统时钟在窗口结束后固定等待 N 时间。

```java
// 10分钟滚动窗口，接受最多2分钟的迟到数据
TimeWindows window = TimeWindows
    .ofSizeAndGrace(Duration.ofMinutes(10), Duration.ofMinutes(2));

KTable<Windowed<String>, Long> counts = stream
    .groupByKey()
    .windowedBy(window)
    .count(Materialized.as("windowed-count-store"));
```

**Grace Period 的权衡：** 更大的宽限期可接纳更多迟到记录，但不保证数据完整或结果更准确，也不会单独强制延迟每次结果更新；若等待窗口关闭后再输出最终结果，等待时间才受宽限期影响。状态保留配置需覆盖窗口大小与宽限期。可将实时大屏 0-10 秒、精确统计 1-5 分钟作为配置假设，再按实际迟到分布、输出需求和存储预算评估，而非视为通用生产标准。

---

## 窗口操作深入

### 三种窗口对比

```text
滚动窗口（Tumbling Window）：size=10min
|--10min--|--10min--|--10min--|
  窗口1     窗口2     窗口3

跳跃窗口（Hopping Window）：size=10min, advance=5min
|----10min----|
     |----10min----|
          |----10min----|
 窗口1      窗口2      窗口3（每条记录属于多个窗口）

会话窗口（Session Window）：gap=5min
|--活动--|   |--活动--|
  会话1   5m静默  会话2（窗口大小动态，由活动决定）
```

### 窗口结果更新触发机制

KTable 的窗口结果不是在窗口关闭时才输出，而是**每收到一条新记录就更新一次**（除非启用了 Cache）。

```java
// 关闭 Cache：每条记录立即触发下游更新（低延迟但高吞吐压力）
Materialized<String, Long, WindowStore<Bytes, byte[]>> materialized =
    Materialized.<String, Long, WindowStore<Bytes, byte[]>>as("no-cache-store")
        .withCachingDisabled();

// 启用 Cache（默认）：攒批后更新（高吞吐但有延迟）
// 通过 cache.max.bytes.buffering 控制缓存大小
// 通过 commit.interval.ms 控制最长延迟
```

---

## 状态存储高级用法

### 自定义状态存储

```java
// 注册自定义 KeyValue 状态存储
StoreBuilder<KeyValueStore<String, UserProfile>> storeBuilder =
    Stores.keyValueStoreBuilder(
        Stores.persistentKeyValueStore("user-profile-store"),
        Serdes.String(),
        new UserProfileSerde()
    )
    .withLoggingEnabled(
        // Changelog Topic 的额外配置
        Map.of("cleanup.policy", "compact",
               "min.cleanable.dirty.ratio", "0.1")
    )
    .withCachingEnabled();  // 启用读写缓存

builder.addStateStore(storeBuilder);
```

在 Processor 中使用状态存储：

```java
public class UserEnrichmentTransformer
        implements Transformer<String, ClickEvent, KeyValue<String, EnrichedEvent>> {

    private ProcessorContext context;
    private KeyValueStore<String, UserProfile> profileStore;

    @Override
    public void init(ProcessorContext context) {
        this.context = context;
        // 获取注册的状态存储
        this.profileStore = context.getStateStore("user-profile-store");

        // 注册定时任务（每30秒清理过期状态）
        context.schedule(Duration.ofSeconds(30),
                         PunctuationType.WALL_CLOCK_TIME,
                         this::cleanupExpiredProfiles);
    }

    @Override
    public KeyValue<String, EnrichedEvent> transform(String key, ClickEvent event) {
        UserProfile profile = profileStore.get(event.getUserId());
        if (profile == null) {
            profile = UserProfile.anonymous();
        }
        return KeyValue.pair(key, new EnrichedEvent(event, profile));
    }

    private void cleanupExpiredProfiles(long timestamp) {
        long expiryMs = Duration.ofHours(24).toMillis();
        try (KeyValueIterator<String, UserProfile> it = profileStore.all()) {
            while (it.hasNext()) {
                KeyValue<String, UserProfile> entry = it.next();
                if (timestamp - entry.value.getLastSeenMs() > expiryMs) {
                    profileStore.delete(entry.key);
                }
            }
        }
    }

    @Override
    public void close() { }
}

// 在 Topology 中使用（指定关联的状态存储名称）
stream.transform(
    () -> new UserEnrichmentTransformer(),
    "user-profile-store"   // 必须与 addStateStore 中的名称一致
).to("enriched-events");
```

### 交互式查询（Interactive Queries）

允许外部服务直接查询 Streams 应用的本地状态存储，实现"实时查询流处理结果"。

```java
KafkaStreams streams = new KafkaStreams(topology, props);
streams.start();

// 等待应用进入 RUNNING 状态
while (streams.state() != KafkaStreams.State.RUNNING) {
    Thread.sleep(100);
}

// 查询 KeyValue 存储
ReadOnlyKeyValueStore<String, Long> countStore =
    streams.store(StoreQueryParameters.fromNameAndType(
        "wordcount-store",
        QueryableStoreTypes.keyValueStore()
    ));

// 点查
Long count = countStore.get("kafka");
System.out.println("kafka 出现次数: " + count);

// 范围查询
try (KeyValueIterator<String, Long> range = countStore.range("a", "k")) {
    range.forEachRemaining(kv ->
        System.out.println(kv.key + ": " + kv.value));
}

// 查询 Window 存储
ReadOnlyWindowStore<String, Long> windowStore =
    streams.store(StoreQueryParameters.fromNameAndType(
        "windowed-count-store",
        QueryableStoreTypes.windowStore()
    ));

// 查询某个 Key 在特定时间范围内的窗口结果
Instant from = Instant.now().minus(Duration.ofHours(1));
Instant to = Instant.now();
try (WindowStoreIterator<Long> it = windowStore.fetch("user-123", from, to)) {
    while (it.hasNext()) {
        KeyValue<Long, Long> kv = it.next();
        System.out.println("窗口开始时间=" + kv.key + ", 计数=" + kv.value);
    }
}
```

> [!note] 分布式查询注意事项
> 在分布式部署中（多个 Streams 实例），每个实例只保存部分分区的状态。如果查询的 Key 不在当前实例，需要通过 `streams.metadataForKey()` 找到持有该 Key 的实例，再通过 HTTP 转发查询。

---

## 流连接深入

### Co-partition 要求详解

KStream-KStream Join 和 KStream-KTable Join 都要求参与连接的 Topic **分区数相同，且使用相同的分区策略**（默认按 Key 哈希）。

```text
为什么需要 Co-partition？
Streams 将同一分区号的 Task 调度到同一线程处理。
如果 orders 的 partition-0 和 payments 的 partition-0 由同一个 Task 处理，
那么相同 Key 的记录就会在同一个 Task 中相遇，Join 才有意义。

如果参与连接的输入不满足共分区要求，不能假定 Kafka Streams 会自动修复源 Topic 的分区数。
应通过满足连接要求的拓扑重分区或重新组织输入，使两侧分区数及按连接键的分区策略一致；内部重分区会增加延迟和存储开销。
```

检查和修复分区数不一致：

```bash
# 检查 Topic 分区数
kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic orders
kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic payments

# 增加分区数的命令示例（只能增加，不能减少）；扩分区不会重分布历史记录，不能单独保证连接输入重新满足共分区要求
kafka-topics.sh --bootstrap-server localhost:9092 \
  --alter --topic payments --partitions 6
```

### Outer Join 与 null 值处理

```java
// KStream-KStream Outer Join：两边都可能为 null
KStream<String, String> orderPaymentJoined = orders.outerJoin(
    payments,
    (orderValue, paymentValue) -> {
        // orderValue 或 paymentValue 可能为 null
        String order = orderValue != null ? orderValue : "NO_ORDER";
        String payment = paymentValue != null ? paymentValue : "NO_PAYMENT";
        return order + " | " + payment;
    },
    JoinWindows.ofTimeDifferenceAndGrace(
        Duration.ofMinutes(5),  // 时间窗口
        Duration.ofSeconds(30)  // 宽限期
    ),
    StreamJoined.with(Serdes.String(), Serdes.String(), Serdes.String())
);
```

---

## 错误处理

### 反序列化异常处理器

```java
// 实现 DeserializationExceptionHandler：处理反序列化失败的消息
public class DeadLetterDeserializationHandler
        implements DeserializationExceptionHandler {

    @Override
    public DeserializationHandlerResponse handle(
            ProcessorContext context,
            ConsumerRecord<byte[], byte[]> record,
            Exception exception) {

        // 记录错误信息
        log.error("反序列化失败: topic={}, partition={}, offset={}, error={}",
                  record.topic(), record.partition(), record.offset(),
                  exception.getMessage());

        // 可以在这里将原始字节写入 Dead Letter Queue
        // （需要通过额外的 Producer 实现）

        // CONTINUE：跳过此消息，继续处理
        // FAIL：停止处理并报告失败；是否重启取决于外部进程管理或另行实现的恢复策略
        return DeserializationHandlerResponse.CONTINUE;
    }

    @Override
    public void configure(Map<String, ?> configs) { }
}

// 在配置中指定
props.put(StreamsConfig.DEFAULT_DESERIALIZATION_EXCEPTION_HANDLER_CLASS_CONFIG,
          DeadLetterDeserializationHandler.class.getName());
```

### 生产异常处理器

```java
// 实现 ProductionExceptionHandler：处理消息写入 Kafka 失败的情况
public class RetryProductionExceptionHandler
        implements ProductionExceptionHandler {

    @Override
    public ProductionExceptionHandlerResponse handle(
            ProducerRecord<byte[], byte[]> record,
            Exception exception) {

        if (exception instanceof RecordTooLargeException) {
            log.error("消息过大，跳过: topic={}, size={}",
                      record.topic(), record.value().length);
            return ProductionExceptionHandlerResponse.CONTINUE;
        }

        // 其他交由该处理器处理的错误返回 FAIL；此响应本身不保证自动重启
        log.error("写入 Kafka 失败，停止应用: {}", exception.getMessage());
        return ProductionExceptionHandlerResponse.FAIL;
    }

    @Override
    public void configure(Map<String, ?> configs) { }
}

props.put(StreamsConfig.DEFAULT_PRODUCTION_EXCEPTION_HANDLER_CLASS_CONFIG,
          RetryProductionExceptionHandler.class.getName());
```

### 未捕获异常处理器（线程级）

```java
// Streams 2.8+ 推荐使用 StreamsUncaughtExceptionHandler
streams.setUncaughtExceptionHandler(exception -> {
    log.error("Streams 线程遇到未捕获异常: {}", exception.getMessage(), exception);

    if (exception instanceof OutOfMemoryError) {
        // OOM：整个应用需要重启
        return StreamsUncaughtExceptionHandler.StreamThreadExceptionResponse
               .SHUTDOWN_APPLICATION;
    }

    // 其他情况：只替换当前线程，不影响整个应用
    return StreamsUncaughtExceptionHandler.StreamThreadExceptionResponse
           .REPLACE_THREAD;
});
```

---

## 扩展与再均衡

### 线程数与任务分配

```text
Streams 应用的并行模型：
- 一个 JVM 实例 = 多个 Stream Threads（由 num.stream.threads 控制）
- 一个 Stream Thread = 多个 Tasks
- 一个 Task = 处理输入 Topic 的一个分区

单个子拓扑的活动 Task 数通常由该子拓扑输入分区数的最大值决定；应用若包含多个子拓扑，应分别计算 Task 数，不能用全部输入 Topic 分区数的最大值概括整个应用的并行度。
```

```java
// 配置线程数（建议与 CPU 核数相同或略少）
props.put(StreamsConfig.NUM_STREAM_THREADS_CONFIG, 4);

// 运行时动态调整线程数（无需重启）
streams.addStreamThread();   // 增加一个线程
streams.removeStreamThread(); // 减少一个线程
```

### Standby Replica：减少故障转移延迟

```java
// 配置备用副本
props.put(StreamsConfig.NUM_STANDBY_REPLICAS_CONFIG, 1);
```

**工作机制：**

```text
没有 Standby Replica 时的故障转移：
实例A（持有 Task-0 状态）宕机
→ 实例B 接管 Task-0
→ 实例B 从 Changelog Topic 重放所有状态（可能需要几分钟）
→ 恢复正常处理

有 Standby Replica 时的故障转移：
实例A（持有 Task-0 主状态）同时，实例B 保持 Task-0 的备用副本（持续同步）
→ 实例A 宕机
→ 假设实例B 的备用状态接近最新，仅积压几秒的 Changelog
→ 在积压较小且再均衡、资源等条件允许时，追赶并接管可达到秒级；不作为通用恢复保证
```

每个 Standby Replica 会带来额外的存储和网络开销（追 Changelog），并可能减少故障后的状态恢复工作；分钟级恢复缩短到秒级可作为特定负载下的目标假设，实际恢复时间取决于备用状态积压、状态规模、再均衡及可用资源。

---

## Kafka Streams vs KSQL（ksqlDB）

| 维度 | Kafka Streams | ksqlDB（KSQL）|
|------|--------------|---------------|
| 使用方式 | Java 代码（编程式）| SQL 语句（声明式）|
| 灵活性 | 极高（可实现任意逻辑）| 受限于 SQL 语法 |
| 上手难度 | 需要 Java 开发能力 | SQL 即可 |
| 部署方式 | 嵌入业务应用 | 独立的 ksqlDB 服务 |
| 调试能力 | 标准 Java 工具链 | KSQL CLI / REST API |
| 状态管理 | 完全控制 | 自动管理 |
| 适用场景 | 复杂业务逻辑、需要精确控制 | 快速原型、数据探索、简单 ETL |

**选型建议：**
- 如果团队有 Java 能力且逻辑复杂（自定义状态、特殊 Join 语义、与业务代码集成）→ Kafka Streams
- 如果需要快速上线、逻辑相对简单、团队偏 SQL 背景 → ksqlDB
- 两者底层机制相同（都基于 Kafka），可以共存于同一数据平台

---

## 监控指标

### JMX 关键指标

Kafka Streams 通过 JMX 暴露指标，命名空间为 `kafka.streams`。

**应用级指标（kafka.streams:type=stream-metrics,client-id=...）：**

| 指标名 | 含义 | 告警阈值参考 |
|--------|------|-------------|
| `state` | 应用状态（按相应版本的状态编码解释；使用枚举序号时，2=RUNNING、1=REBALANCING）| 对持续异常状态告警，正常再均衡需区别处理 |

**线程级指标（kafka.streams:type=stream-thread-metrics,thread-id=...）：**

| 指标名 | 含义 | 告警阈值参考 |
|--------|------|-------------|
| `process-rate` | 每秒处理的记录数 | 持续为0时告警 |
| `process-latency-avg` | 平均处理延迟（ms）| >1000ms 告警 |
| `commit-rate` | 每秒 Commit 次数 | 过低说明处理堵塞 |
| `poll-rate` | 每秒 Poll 次数 | |
| `task-created-total` | 创建的 Task 总数 | 频繁变化说明再均衡 |

**Task 级指标（kafka.streams:type=stream-task-metrics,task-id=...）：**

| 指标名 | 含义 |
|--------|------|
| `process-rate` | Task 的处理速率 |
| `record-latency-avg` | 从消息生产到被处理的平均延迟 |
| `dropped-records-total` | 被丢弃的记录总数（反序列化失败等）|

**消费者 Lag 指标（最重要的延迟指标）：**

```bash
# 通过 kafka-consumer-groups.sh 查看 Streams 应用的 Lag
# Streams 的消费者组 ID 就是 application.id
kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --describe --group wordcount-v1

# 输出示例：
# GROUP          TOPIC                PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG
# wordcount-v1   text-input           0          12345           12400           55
# wordcount-v1   text-input           1          8901            8901            0
```

### 使用 Micrometer 暴露指标到 Prometheus

```java
// 添加依赖：kafka-streams-micrometer（第三方库）或自定义收集

// 通过 KafkaStreams.metrics() 获取所有指标
Map<MetricName, ? extends Metric> metrics = streams.metrics();

// 定期采集并上报
ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
scheduler.scheduleAtFixedRate(() -> {
    metrics.forEach((name, metric) -> {
        Object value = metric.metricValue();
        if (value instanceof Double) {
            // 上报到 Prometheus / Grafana
            Gauge.builder(normalizeMetricName(name), () -> (Double) value)
                 .tag("group", name.group())
                 .tag("client-id", name.tags().getOrDefault("client-id", ""))
                 .register(meterRegistry);
        }
    });
}, 0, 15, TimeUnit.SECONDS);
```

---

## 生产环境部署要点

### 推荐配置（高吞吐 + 高可靠）

```java
Properties props = new Properties();

// 基础配置
props.put(StreamsConfig.APPLICATION_ID_CONFIG, "risk-control-streams");
props.put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG,
          "kafka-01:9092,kafka-02:9092,kafka-03:9092");

// 精确一次语义（EXACTLY_ONCE_V2 需 Kafka Streams 客户端 3.0+，并要求 Broker 2.5+；具体性能应按负载评估）
props.put(StreamsConfig.PROCESSING_GUARANTEE_CONFIG,
          StreamsConfig.EXACTLY_ONCE_V2);

// 线程和副本
props.put(StreamsConfig.NUM_STREAM_THREADS_CONFIG, 4);
props.put(StreamsConfig.NUM_STANDBY_REPLICAS_CONFIG, 1);
props.put(StreamsConfig.REPLICATION_FACTOR_CONFIG, 3);

// 状态存储
props.put(StreamsConfig.STATE_DIR_CONFIG, "/data/kafka-streams");

// 性能调优
props.put(StreamsConfig.COMMIT_INTERVAL_MS_CONFIG, 1000);     // 1秒提交一次
props.put(StreamsConfig.CACHE_MAX_BYTES_BUFFERING_CONFIG,
          50 * 1024 * 1024);  // 50MB 缓存

// 覆盖消费者参数（用于优化 Sink Task）
props.put(StreamsConfig.consumerPrefix(ConsumerConfig.MAX_POLL_RECORDS_CONFIG), 1000);
props.put(StreamsConfig.consumerPrefix(ConsumerConfig.SESSION_TIMEOUT_MS_CONFIG), 30000);

// 覆盖生产者参数
props.put(StreamsConfig.producerPrefix(ProducerConfig.COMPRESSION_TYPE_CONFIG), "lz4");
props.put(StreamsConfig.producerPrefix(ProducerConfig.BATCH_SIZE_CONFIG), 65536);

// 指标采集级别
props.put(StreamsConfig.METRICS_RECORDING_LEVEL_CONFIG, "INFO");
```

### 优雅关闭

```java
KafkaStreams streams = new KafkaStreams(topology, props);
streams.start();

// 注册 JVM 关闭钩子
Runtime.getRuntime().addShutdownHook(new Thread(() -> {
    log.info("收到关闭信号，开始优雅关闭...");
    // 等待最多30秒完成正在处理的记录和 Offset 提交
    streams.close(Duration.ofSeconds(30));
    log.info("Streams 应用已关闭");
}));
```

---

## 掌握检查

- [ ] 能解释 Event Time、Processing Time 的区别，并说明何时应选哪种
- [ ] 能实现自定义 Timestamp Extractor 从消息 payload 中提取事件时间
- [ ] 能解释 Grace Period 与乱序处理的关系
- [ ] 能用交互式查询（Interactive Queries）实现实时状态查询接口
- [ ] 能配置 DeserializationExceptionHandler 实现 Dead Letter Queue 模式
- [ ] 能解释 Standby Replica 的工作机制及其对故障恢复时间的影响
- [ ] 能在 JMX 或 `kafka-consumer-groups.sh` 中找到 Streams 应用的关键指标

## 练习题

1. 你的风控 Streams 应用使用事件时间聚合，但发现有些手机 App 在弱网环境下会延迟上报数据（最长延迟30分钟）。如何配置才能既准确捕获这些事件，又不让状态存储无限增长？
2. 生产中 Streams 应用突然出现 `process-rate` 接近0的情况，但应用还在运行，有哪些可能的原因？排查步骤是什么？
3. 你需要实现一个功能：实时查询任意用户的"最近1小时内的消费总额"，并通过 HTTP API 对外提供查询服务。基于交互式查询，写出关键实现思路。
4. 将 Kafka Streams 方案与 ksqlDB 方案对比：实现"用户每分钟下单超过5次则触发异常告警"这个需求，分别需要写什么代码/SQL？各有什么优劣？

---

## 学习连接

**前置知识**: [[【技术与工具】/Kafka/17-Kafka Streams基础|Kafka Streams 基础]]
**下一步学习**: [[【技术与工具】/Kafka/19-Schema Registry|Schema Registry - 数据模式管理]]
**相关概念**:
- Flink 时间语义对比
- 流处理架构设计
- 分布式系统监控

---

> [!tip] 生产环境核心建议
> 部署生产级 Streams 应用的三个关键决策：
> 1. **时间语义**：默认用 Event Time，只有在没有可靠事件时间戳时才用 Processing Time
> 2. **容错配置**：按业务一致性要求选择处理保证；需要精确一次时可考虑 `EXACTLY_ONCE_V2`，需要缩短有状态任务恢复时间时可配置至少1个 Standby Replica，但二者不是所有生产应用的统一底线
> 3. **监控优先**：consumer lag 是最重要的健康指标，持续 lag 增长意味着处理跟不上消费
