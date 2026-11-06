---
title: Kafka Streams基础 - 实时流处理的艺术
tags:
  - Kafka
  - Streams
  - 流处理
  - 实时计算
  - KStream
  - KTable
difficulty: 高级
duration: 40分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
stability: slow-changing
status: maintenance
access_tier: free
updated: 2026-10-10
---


# Kafka Streams基础 - 实时流处理的艺术

> [!abstract] 本节概览
> - 学习目标：掌握 Kafka Streams 的核心概念和基础应用
> - 前置知识：[[【技术与工具】/Kafka/16-Kafka Connect|Kafka Connect]]
> - 预计用时：40分钟
> - 后续学习：[[【技术与工具】/Kafka/18-Kafka Streams深入|Kafka Streams 深入]]

产品经理急匆匆找到开发团队："我们需要实时统计每个用户过去1小时内的点击次数，超过100次就触发风控预警。传统批处理要等几小时，根本来不及。"开发leader微微一笑："这种需求正是 Kafka Streams 的强项，几行代码就能搞定，还不需要部署额外的集群。"

---

## Kafka Streams 的核心优势

Kafka Streams 是一个嵌入式 Java 流处理库，不是独立的服务框架。它的独特价值在于：

- **零额外依赖**：不需要 Spark、Flink 那样的独立集群，直接作为库嵌入 Java 应用
- **精确一次语义**：基于 Kafka 事务机制，原生支持 Exactly-Once
- **本地状态存储**：基于 RocksDB，状态存在本地磁盘，低延迟访问
- **弹性扩展**：增加实例就能增加处理并行度，无需手动分配分区

---

## 核心抽象：KStream、KTable、GlobalKTable

### 三者对比

| 抽象类型 | 数据模型 | 语义 | 典型场景 |
|----------|----------|------|----------|
| **KStream** | 无界事件序列 | 每条记录独立，不会被覆盖 | 点击流、日志、交易事件 |
| **KTable** | 键值状态表 | 相同 Key 的新记录**覆盖**旧记录，表示最新状态 | 用户信息、库存数量、配置 |
| **GlobalKTable** | 全局复制的 KTable | 每个应用实例都有完整的数据副本 | 小型维度表、广播配置 |

### 流表对偶性（Duality）

```text
KStream → KTable：使用 toTable()
  将每条事件转为"当前状态"（同 Key 后来者覆盖先来者）

KTable → KStream：使用 toStream()
  将每次状态变更发出为一条事件流
```

**示例：**

```java
StreamsBuilder builder = new StreamsBuilder();

// KStream：每次点击都是一条独立事件
KStream<String, String> clickStream = builder.stream("user-clicks");

// KStream → KTable：统计每个用户最新状态
KTable<String, Long> userClickCount = clickStream
    .groupByKey()
    .count();  // count() 返回 KTable<Key, Long>

// KTable → KStream：将状态变更发出为事件流
KStream<String, Long> countUpdates = userClickCount.toStream();
countUpdates.to("click-count-updates", Produced.with(Serdes.String(), Serdes.Long()));
```

---

## 拓扑（Topology）概念

Streams 应用的处理逻辑是一个有向无环图（DAG），称为 Topology。

```text
Source Processor（从 Kafka Topic 读取）
      ↓
Stream Processor（过滤、转换、聚合等）
      ↓
Sink Processor（写入 Kafka Topic）
```

查看拓扑结构（调试利器）：

```java
StreamsBuilder builder = new StreamsBuilder();
// ... 构建拓扑 ...
Topology topology = builder.build();
System.out.println(topology.describe());
// 输出类似：
// Sub-topology: 0
//   Source: KSTREAM-SOURCE-0000000000 (topics: [text-input])
//   Processor: KSTREAM-FLATMAPVALUES-... (stores: [])
//   Processor: KSTREAM-GROUPBYKEY-... (stores: [counts-store])
//   Sink: KSTREAM-SINK-0000000003 (topic: word-count-output)
```

---

## 依赖配置（Maven）

```xml
<dependencies>
    <dependency>
        <groupId>org.apache.kafka</groupId>
        <artifactId>kafka-streams</artifactId>
        <version>3.6.0</version>
    </dependency>
    <!-- 测试专用 -->
    <dependency>
        <groupId>org.apache.kafka</groupId>
        <artifactId>kafka-streams-test-utils</artifactId>
        <version>3.6.0</version>
        <scope>test</scope>
    </dependency>
</dependencies>
```

---

## WordCount：完整入门示例

这是 Streams 世界的 "Hello World"，涵盖了 Source -> Processor -> Sink 完整流程。

```java
import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.streams.*;
import org.apache.kafka.streams.kstream.*;

import java.util.Arrays;
import java.util.Properties;

public class WordCountApplication {

    public static void main(String[] args) throws InterruptedException {
        Properties props = buildConfig();
        Topology topology = buildTopology();

        KafkaStreams streams = new KafkaStreams(topology, props);

        // 注册优雅关闭钩子
        Runtime.getRuntime().addShutdownHook(new Thread(streams::close));

        // 启动前清理旧的本地状态（开发时有用，生产慎用）
        // streams.cleanUp();

        streams.start();
        System.out.println("WordCount 应用已启动，等待数据...");

        // 等待直到应用关闭
        Thread.currentThread().join();
    }

    static Properties buildConfig() {
        Properties props = new Properties();
        // 应用 ID：同一个 ID 的多个实例组成一个 Streams 集群
        props.put(StreamsConfig.APPLICATION_ID_CONFIG, "wordcount-v1");
        props.put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        props.put(StreamsConfig.DEFAULT_KEY_SERDE_CLASS_CONFIG,
                  Serdes.String().getClass().getName());
        props.put(StreamsConfig.DEFAULT_VALUE_SERDE_CLASS_CONFIG,
                  Serdes.String().getClass().getName());
        // 本地状态存储目录
        props.put(StreamsConfig.STATE_DIR_CONFIG, "/tmp/kafka-streams/wordcount");
        // 精确一次语义（需要 Kafka 2.5+，推荐生产使用）
        props.put(StreamsConfig.PROCESSING_GUARANTEE_CONFIG,
                  StreamsConfig.EXACTLY_ONCE_V2);
        return props;
    }

    static Topology buildTopology() {
        StreamsBuilder builder = new StreamsBuilder();

        // 1. 从 text-input Topic 读取文本行
        KStream<String, String> textLines = builder.stream("text-input");

        // 2. 构建处理管道
        KTable<String, Long> wordCounts = textLines
            // 将每行文本拆分为单词列表（flatMapValues：一行 -> 多个单词，Key 不变）
            .flatMapValues(line -> Arrays.asList(line.toLowerCase().split("\\W+")))
            // 过滤空单词
            .filter((key, word) -> !word.isEmpty())
            // 将单词作为新 Key（后续 groupByKey 聚合会按新 Key 重新分区）
            .selectKey((ignoredKey, word) -> word)
            // 按 Key（单词）分组
            .groupByKey()
            // 计数，结果物化到名为 "wordcount-store" 的状态存储
            .count(Materialized.as("wordcount-store"));

        // 3. 将 KTable 的变更写入输出 Topic
        wordCounts
            .toStream()
            .to("word-count-output",
                Produced.with(Serdes.String(), Serdes.Long()));

        return builder.build();
    }
}
```

准备测试数据：

```bash
# 创建 Topic
kafka-topics.sh --bootstrap-server localhost:9092 \
  --create --topic text-input --partitions 3 --replication-factor 1

kafka-topics.sh --bootstrap-server localhost:9092 \
  --create --topic word-count-output --partitions 3 --replication-factor 1

# 发送测试数据
echo -e "hello kafka streams\nhello world\nkafka is great" | \
  kafka-console-producer.sh --bootstrap-server localhost:9092 --topic text-input

# 查看输出（Long 类型值为二进制，需要指定 deserializer）
kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic word-count-output --from-beginning \
  --property print.key=true \
  --property key.separator=" => " \
  --value-deserializer org.apache.kafka.common.serialization.LongDeserializer
```

---

## 基础算子详解

### 无状态转换算子

```java
KStream<String, String> stream = builder.stream("input");

// filter：保留满足条件的记录
KStream<String, String> filtered = stream
    .filter((key, value) -> value != null && value.length() > 5);

// filterNot：丢弃满足条件的记录（filter 的反义）
KStream<String, String> notNull = stream
    .filterNot((key, value) -> value == null);

// map：同时变换 Key 和 Value（后续按 Key 聚合或连接时可能需要重新分区）
KStream<String, Integer> mapped = stream
    .map((key, value) -> KeyValue.pair(key.toUpperCase(), value.length()));

// mapValues：只变换 Value，Key 不变（不触发 repartition，性能更好）
KStream<String, String> upperCased = stream
    .mapValues(String::toUpperCase);

// flatMap：一条记录 -> 多条记录（Key 和 Value 都可变）
KStream<String, String> flattened = stream
    .flatMap((key, value) -> {
        String[] words = value.split(" ");
        return Arrays.stream(words)
            .map(word -> KeyValue.pair(key, word))
            .collect(Collectors.toList());
    });

// flatMapValues：一条记录 -> 多条记录（只变换 Value）
KStream<String, String> words = stream
    .flatMapValues(value -> Arrays.asList(value.split(" ")));

// selectKey：重新指定 Key（本身不立即重新分区，后续按 Key 操作时可能需要重新分区）
KStream<String, String> rekeyed = stream
    .selectKey((key, value) -> extractUserId(value));

// peek：旁路观察，不修改记录（常用于调试/监控）
stream.peek((key, value) ->
    log.info("Processing key={}, value={}", key, value));

// merge：合并两个 KStream
KStream<String, String> otherStream = builder.stream("other-input");
KStream<String, String> merged = stream.merge(otherStream);

// branch：按条件分流（返回 KStream 数组）
// Kafka Streams 2.8+ 推荐使用 split().branch() API
Map<String, KStream<String, String>> branches = stream.split(Named.as("branch-"))
    .branch((key, value) -> value.startsWith("ERROR"), Branched.as("error"))
    .branch((key, value) -> value.startsWith("WARN"),  Branched.as("warn"))
    .defaultBranch(Branched.as("info"));

branches.get("branch-error").to("error-topic");
branches.get("branch-warn").to("warn-topic");
branches.get("branch-info").to("info-topic");
```

### 有状态聚合算子

```java
KStream<String, Long> numericStream = builder.stream("numeric-events",
    Consumed.with(Serdes.String(), Serdes.Long()));

// groupByKey：按当前 Key 分组（若上游未改变 Key，通常无需重新分区；上游改变 Key 后可能需要重新分区）
KGroupedStream<String, Long> grouped = numericStream.groupByKey();

// groupBy：按新 Key 分组（触发 repartition）
KGroupedStream<String, Long> groupedByDomain = numericStream
    .groupBy((key, value) -> extractDomain(key),
             Grouped.with(Serdes.String(), Serdes.Long()));

// count：计数
KTable<String, Long> counts = grouped.count(Materialized.as("count-store"));

// reduce：归约（新值与累积值合并）
KTable<String, Long> sums = grouped.reduce(Long::sum);

// aggregate：最灵活的聚合（自定义初始值和聚合逻辑）
KTable<String, Double> averages = grouped.aggregate(
    // 初始化器：返回聚合的初始值
    () -> new double[]{0.0, 0.0},  // [sum, count]
    // 聚合器：(key, newValue, currentAggregate) -> newAggregate
    (key, newValue, aggregate) -> {
        aggregate[0] += newValue;
        aggregate[1]++;
        return aggregate;
    },
    Materialized.<String, double[], KeyValueStore<Bytes, byte[]>>as("avg-store")
        .withValueSerde(/* 自定义 Serde */)
).mapValues(agg -> agg[1] > 0 ? agg[0] / agg[1] : 0.0);
```

---

## 状态存储：RocksDB 与内存存储

```java
// 默认：持久化 RocksDB 存储（支持故障恢复）
Materialized<String, Long, KeyValueStore<Bytes, byte[]>> persistent =
    Materialized.<String, Long, KeyValueStore<Bytes, byte[]>>as("persistent-store")
        .withKeySerde(Serdes.String())
        .withValueSerde(Serdes.Long());

// 内存存储（本地内容不跨进程保留；默认启用 changelog 时可重放恢复，延迟取决于负载与配置）
Materialized<String, Long, KeyValueStore<Bytes, byte[]>> inMemory =
    Materialized.<String, Long, KeyValueStore<Bytes, byte[]>>as(
        Stores.inMemoryKeyValueStore("in-memory-store"))
        .withKeySerde(Serdes.String())
        .withValueSerde(Serdes.Long());
```

**状态存储与 Changelog Topic：**

每个持久化状态存储都会对应一个内部 Changelog Topic（命名为 `{app-id}-{store-name}-changelog`）。当 Task 迁移到新实例时，新实例通过重放 Changelog 来恢复状态。这就是 Kafka Streams 容错的核心机制。

---

## 时间窗口聚合

### 三种窗口类型对比

| 窗口类型 | 大小 | 重叠 | 触发条件 | 典型场景 |
|----------|------|------|----------|----------|
| **Tumbling Window（滚动窗口）** | 固定 | 无 | 事件到达时更新；窗口关闭取决于流时间及宽限期，不默认仅在关闭时输出 | 每分钟统计 |
| **Hopping Window（跳跃窗口）** | 固定 | 有（advance < size）| 事件到达时更新所属窗口；advance 定义窗口起点间隔，不是输出定时器 | 最近5分钟的滑动统计 |
| **Session Window（会话窗口）** | 动态 | 无 | 事件到达时更新或合并会话；关闭取决于流时间、gap 及宽限期 | 用户会话分析 |

```java
KStream<String, Long> events = builder.stream("user-events",
    Consumed.with(Serdes.String(), Serdes.Long()));

KGroupedStream<String, Long> grouped = events.groupByKey();

// 滚动窗口：每10分钟一个独立窗口，无重叠
KTable<Windowed<String>, Long> tumbling = grouped
    .windowedBy(TimeWindows.ofSizeWithNoGrace(Duration.ofMinutes(10)))
    .count(Materialized.as("tumbling-store"));

// 跳跃窗口：窗口大小10分钟，每2分钟滑动一次（重叠）
KTable<Windowed<String>, Long> hopping = grouped
    .windowedBy(
        TimeWindows.ofSizeWithNoGrace(Duration.ofMinutes(10))
                   .advanceBy(Duration.ofMinutes(2))
    )
    .count(Materialized.as("hopping-store"));

// 会话窗口：按30分钟不活动间隔划分会话；关闭依赖流时间推进，并非墙钟等待30分钟
KTable<Windowed<String>, Long> session = grouped
    .windowedBy(SessionWindows.ofInactivityGapWithNoGrace(Duration.ofMinutes(30)))
    .count(Materialized.as("session-store"));

// 输出窗口结果（Windowed Key 需要特殊处理）
tumbling.toStream()
    .map((windowedKey, count) -> {
        String key = String.format("%s[%d-%d]",
            windowedKey.key(),
            windowedKey.window().start(),
            windowedKey.window().end());
        return KeyValue.pair(key, count);
    })
    .to("tumbling-results", Produced.with(Serdes.String(), Serdes.Long()));
```

> [!note] Grace Period（宽限期）
> 上面使用 `ofSizeWithNoGrace` 是为了简单，生产中应设置宽限期以容许迟到数据：
> ```java
> TimeWindows.ofSizeAndGrace(Duration.ofMinutes(10), Duration.ofMinutes(2))
> ```
> 这允许最多迟到2分钟的事件仍被计入对应窗口。

---

## 流 Join 操作

```java
KStream<String, Order> orders = builder.stream("orders");
KStream<String, Payment> payments = builder.stream("payments");
KTable<String, Customer> customers = builder.table("customers");
GlobalKTable<String, Product> products = builder.globalTable("products");

// KStream-KStream Join：需要时间窗口，两边 Key 必须相同且分区数相同
KStream<String, String> orderWithPayment = orders.join(
    payments,
    (order, payment) -> "Order: " + order.getId() + ", Paid: " + payment.getAmount(),
    JoinWindows.ofTimeDifferenceWithNoGrace(Duration.ofMinutes(5)),
    StreamJoined.with(Serdes.String(), orderSerde, paymentSerde)
);

// KStream-KTable Join：无需时间窗口，实时用最新 Table 状态匹配
KStream<String, String> orderWithCustomer = orders.join(
    customers,
    (order, customer) -> order.getId() + " from " + customer.getName()
    // 无需 JoinWindows，KTable 提供最新状态
);

// KStream-GlobalKTable Join：支持不同分区键的连接
KStream<String, String> orderWithProduct = orders.join(
    products,
    // KeyValueMapper：从 Stream 记录中提取 GlobalKTable 的查找 Key
    (orderKey, order) -> order.getProductId(),
    (order, product) -> order.getId() + " -> " + product.getName()
);
```

**Join 类型与时间对齐要求：**

| Join 类型 | 是否需要窗口 | Co-partition 要求 | 能否捕获 null |
|-----------|------------|------------------|---------------|
| KStream-KStream inner join | 需要 | 是（分区数相同）| 否 |
| KStream-KStream left join | 需要 | 是 | 是（右边可为 null）|
| KStream-KStream outer join | 需要 | 是 | 未匹配时任一侧可为 null，但不是两侧同时为 null |
| KStream-KTable join / leftJoin | 不需要 | 是 | inner join 不输出未匹配记录；leftJoin 的 Table 端可为 null |
| KStream-GlobalKTable join / leftJoin | 不需要 | 否 | inner join 不输出未匹配记录；leftJoin 的 Table 端可为 null |

---

## 本地测试：TopologyTestDriver

TopologyTestDriver 无需真实 Kafka，完全在内存中运行，是单元测试的首选。

```java
import org.apache.kafka.streams.TopologyTestDriver;
import org.apache.kafka.streams.TestInputTopic;
import org.apache.kafka.streams.TestOutputTopic;

public class WordCountTest {

    private TopologyTestDriver testDriver;
    private TestInputTopic<String, String> inputTopic;
    private TestOutputTopic<String, Long> outputTopic;

    @BeforeEach
    void setUp() {
        Properties props = WordCountApplication.buildConfig();
        Topology topology = WordCountApplication.buildTopology();

        testDriver = new TopologyTestDriver(topology, props);

        inputTopic = testDriver.createInputTopic(
            "text-input",
            Serdes.String().serializer(),
            Serdes.String().serializer()
        );
        outputTopic = testDriver.createOutputTopic(
            "word-count-output",
            Serdes.String().deserializer(),
            Serdes.Long().deserializer()
        );
    }

    @AfterEach
    void tearDown() {
        testDriver.close();
    }

    @Test
    void testWordCount() {
        // 发送测试数据
        inputTopic.pipeInput("key1", "hello kafka streams");
        inputTopic.pipeInput("key2", "hello world");

        // 读取输出结果
        Map<String, Long> results = outputTopic.readKeyValuesToMap();

        // 验证
        assertEquals(2L, results.get("hello"));
        assertEquals(1L, results.get("kafka"));
        assertEquals(1L, results.get("streams"));
        assertEquals(1L, results.get("world"));
    }

    @Test
    void testWordCountWithTimestamps() {
        // 演示带时间戳的输入；当前 WordCount 拓扑不含窗口
        Instant baseTime = Instant.parse("2026-03-21T10:00:00Z");

        inputTopic.pipeInput("u1", "click", baseTime);
        inputTopic.pipeInput("u1", "click", baseTime.plusSeconds(30));
        inputTopic.pipeInput("u1", "click", baseTime.plusSeconds(60));

        // 输入时间更晚的记录；当前拓扑不会因此关闭任何窗口
        inputTopic.pipeInput("u1", "click", baseTime.plusSeconds(15 * 60));

        // 验证普通 WordCount 计数，不验证窗口语义
        Map<String, Long> results = outputTopic.readKeyValuesToMap();
        assertEquals(4L, results.get("click"));
    }
}
```

---

## Streams 关键配置参数

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `application.id` | 无（必填）| 应用唯一标识，同时作为消费者组 ID 和内部 Topic 前缀 |
| `num.stream.threads` | `1` | 每个实例的处理线程数，建议等于 CPU 核数 |
| `processing.guarantee` | `at_least_once` | 处理语义：`at_least_once` 或 `exactly_once_v2` |
| `state.dir` | `/tmp/kafka-streams` | 本地状态存储目录，生产应指向持久化路径 |
| `commit.interval.ms` | `30000`（EOS: 100）| Offset 提交间隔，影响处理延迟和故障恢复窗口 |
| `cache.max.bytes.buffering` | `10485760`（10MB）| 状态缓存大小，设为0可立即看到每次更新（调试用）|
| `num.standby.replicas` | `0` | 备用副本数，设为1可大幅减少故障转移时间 |
| `replication.factor` | `-1`（继承集群默认）| 内部 Topic 的副本数 |

---

## 掌握检查

- [ ] 能用自己的话解释 KStream 和 KTable 的本质区别
- [ ] 能完整写出 WordCount 的 Topology 代码（从 stream 到 to）
- [ ] 知道哪些算子会触发 repartition（重新分区）
- [ ] 能区分三种窗口类型的适用场景
- [ ] 能用 TopologyTestDriver 编写单元测试
- [ ] 了解 Changelog Topic 在状态恢复中的作用

## 练习题

1. 实现一个"用户每分钟点击次数超过10次则输出告警"的 Streams 应用，写出完整的 Topology 构建代码。
2. 有两个 Topic：`orders`（含 `userId`、`amount`）和 `users`（含 `userId`、`name`、`vipLevel`），要将订单与用户信息关联后输出，应选哪种 Join 类型？为什么？
3. 解释为什么在做 KStream-KStream Join 之前，两个 Stream 必须有相同的分区数（Co-partition 要求）。
4. 你发现 Streams 应用重启后需要很长时间才能恢复到正常处理状态，排查方向有哪些？

---

## 学习连接

**前置知识**: [[【技术与工具】/Kafka/16-Kafka Connect|Kafka Connect]]
**下一步学习**: [[【技术与工具】/Kafka/18-Kafka Streams深入|Kafka Streams 深入]]
**相关概念**:
- Flink 流处理对比
- 实时数据处理架构
- 事件驱动架构

---

> [!tip] Streams 思维转变
> 学习 Kafka Streams 最难的不是 API，而是**思维方式的转变**：
> - 从"批处理思维"（处理有限集合）转向"流处理思维"（处理无限序列）
> - 从"拉取计算"（我去查数据库）转向"推送计算"（数据来了我处理）
> - 从"Point-in-time 查询"转向"持续计算更新"
>
> 一旦建立这种思维框架，Kafka Streams 的每个 API 都会变得自然而然。
