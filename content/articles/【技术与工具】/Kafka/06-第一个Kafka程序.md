---
title: 第一个Kafka程序 - Hello World级别的生产者消费者
tags:
  - Kafka
  - 入门
  - 生产者
  - 消费者
  - 编程
difficulty: 基础
duration: 40分钟
date: 2026-03-21
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - Java开发者
  - Kafka初学者
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-21
updated: 2026-10-10
---


# 第一个Kafka程序 - Hello World级别的生产者消费者

> [!info] 前置知识
> - [[【技术与工具】/Kafka/05-Kafka环境安装与配置|Kafka 环境安装与配置]] - 确保本地已有可用的 Kafka 集群
> - [[【技术与工具】/Kafka/03-Kafka核心术语|Kafka 核心术语]] - 理解 Topic、Partition、Offset 等基本概念
> - [[【技术与工具】/Kafka/02-Kafka架构概述|Kafka 架构概述]] - 了解 Producer 和 Consumer 在系统中的角色

本文带你写出第一个能跑的 Kafka 程序。目标很具体：一个 Producer 把消息发到 Topic，一个 Consumer 从 Topic 拉取消息并打印出来。所有代码都配有逐行注释，你不需要事先了解 Kafka 客户端 API 的细节。

---

## 开发环境准备

### Maven 依赖

创建一个 Maven 项目，在 `pom.xml` 中添加 Kafka 客户端依赖：

```xml
<dependencies>
    <!-- Kafka 客户端核心库，包含 Producer 和 Consumer API -->
    <dependency>
        <groupId>org.apache.kafka</groupId>
        <artifactId>kafka-clients</artifactId>
        <version>3.6.1</version>
    </dependency>

    <!-- SLF4J + Logback，用于日志输出 -->
    <dependency>
        <groupId>org.slf4j</groupId>
        <artifactId>slf4j-api</artifactId>
        <version>2.0.9</version>
    </dependency>
    <dependency>
        <groupId>ch.qos.logback</groupId>
        <artifactId>logback-classic</artifactId>
        <version>1.4.11</version>
    </dependency>
</dependencies>
```

### 项目目录结构

```text
kafka-hello-world/
├── pom.xml
└── src/main/java/com/example/
    ├── KafkaProducerExample.java   ← 生产者示例
    └── KafkaConsumerExample.java   ← 消费者示例
```

### 提前创建 Topic

在运行代码之前，先在命令行创建测试用的 Topic：

```bash
# 创建一个名为 hello-kafka 的 Topic，3 个分区，1 个副本（本地测试用）
kafka-topics.sh --create \
    --topic hello-kafka \
    --partitions 3 \
    --replication-factor 1 \
    --bootstrap-server localhost:9092

# 确认创建成功
kafka-topics.sh --describe \
    --topic hello-kafka \
    --bootstrap-server localhost:9092
```

---

## 生产者代码

> [!note] 理解 KafkaProducer 的工作方式
> KafkaProducer 是线程安全的，一个进程内可以共享同一个实例。它内部维护一个消息缓冲区（RecordAccumulator），消息先进入缓冲区，由后台 Sender 线程批量发送到 Broker。这是 Kafka 高吞吐的关键设计之一。

```java
package com.example;

import org.apache.kafka.clients.producer.*;
import org.apache.kafka.common.serialization.StringSerializer;

import java.util.Properties;
import java.util.concurrent.ExecutionException;

public class KafkaProducerExample {

    public static void main(String[] args) throws InterruptedException, ExecutionException {

        // === 第一步：配置 Producer ===
        Properties props = new Properties();

        // 必填：Kafka Broker 地址，填一个或多个都行，客户端会自动发现其余 Broker
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");

        // 必填：Key 和 Value 的序列化方式，这里 Key/Value 都是字符串
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());

        // acks=all（Kafka 3.6.1 默认）：要求 Leader 和当前 ISR 副本确认写入；可靠性还取决于副本配置等条件
        // acks=1：只等待 Leader 确认；Leader 故障且消息尚未复制时可能丢失
        // acks=0：不等待 Broker 确认，无法据此判断消息是否写入成功；吞吐表现取决于实际负载
        props.put(ProducerConfig.ACKS_CONFIG, "all");

        // 发送失败时最多重试 3 次（网络抖动、Leader 切换等短暂异常会自动恢复）
        props.put(ProducerConfig.RETRIES_CONFIG, 3);

        // 批量发送相关：Producer 积累到 16KB 或等待 1ms 后，批量发送一批消息
        // 适当调大 LINGER_MS 可以显著提升吞吐量，代价是轻微增加延迟
        props.put(ProducerConfig.BATCH_SIZE_CONFIG, 16384);
        props.put(ProducerConfig.LINGER_MS_CONFIG, 1);

        // === 第二步：创建 Producer 实例 ===
        // try-with-resources 确保程序结束时自动调用 producer.close()，刷新缓冲区并释放资源
        try (KafkaProducer<String, String> producer = new KafkaProducer<>(props)) {

            // === 第三步：同步发送（简单但阻塞）===
            System.out.println("--- 同步发送示例 ---");
            for (int i = 0; i < 3; i++) {
                String key = "sync-key-" + i;
                String value = "同步消息 #" + i;

                // ProducerRecord 封装了消息的元信息：Topic、Key、Value
                // 使用默认按 Key 分区策略且分区数量不变时，相同序列化 Key 的消息会进入同一分区
                ProducerRecord<String, String> record =
                        new ProducerRecord<>("hello-kafka", key, value);

                // send() 返回 Future<RecordMetadata>，调用 .get() 会阻塞直到发送完成
                RecordMetadata metadata = producer.send(record).get();

                System.out.printf("同步发送成功 | Topic=%s | Partition=%d | Offset=%d | Key=%s%n",
                        metadata.topic(), metadata.partition(), metadata.offset(), key);
            }

            // === 第四步：异步发送 + Callback（推荐用法）===
            // send() 通常异步返回，但元数据不可用或缓冲区不足时仍可能阻塞；Callback 通常由生产者 IO 线程执行
            System.out.println("\n--- 异步发送示例（带 Callback）---");
            for (int i = 0; i < 5; i++) {
                String key = "async-key-" + i;
                String value = "异步消息 #" + i;

                ProducerRecord<String, String> record =
                        new ProducerRecord<>("hello-kafka", key, value);

                // Callback 的两个参数：成功时 metadata 有值、exception 为 null；
                //                      失败时 metadata 为 null、exception 包含错误信息
                producer.send(record, (metadata, exception) -> {
                    if (exception == null) {
                        System.out.printf("异步发送成功 | Partition=%d | Offset=%d | Key=%s%n",
                                metadata.partition(), metadata.offset(), key);
                    } else {
                        // 生产环境应记录告警并考虑是否需要人工干预
                        System.err.println("发送失败，Key=" + key + "，原因：" + exception.getMessage());
                    }
                });
            }

            // === 第五步：无 Key 的消息（默认分区策略）===
            System.out.println("\n--- 无 Key 消息（默认分区策略）---");
            for (int i = 0; i < 3; i++) {
                // 不传 Key 时，Kafka 3.6.1 默认使用粘性分区策略，不保证逐条轮询分区
                ProducerRecord<String, String> record =
                        new ProducerRecord<>("hello-kafka", "无 Key 消息 #" + i);

                producer.send(record, (metadata, exception) -> {
                    if (exception == null) {
                        System.out.printf("无 Key 消息 | Partition=%d | Offset=%d%n",
                                metadata.partition(), metadata.offset());
                    }
                });
            }

            // producer.close() 由 try-with-resources 自动调用
            // close() 会等待未完成的发送结束并释放资源；发送仍可能失败，需检查发送结果
            System.out.println("\n发送调用已完成，即将关闭 Producer；请结合 Future 和 Callback 判断发送结果。");
        }
    }
}
```

> [!tip] 同步 vs 异步发送选哪个
> - **同步发送**（`.get()`）：代码简单，便于排查错误，但每条消息都会阻塞线程，吞吐量低，适合低频、关键消息场景。
> - **异步发送 + Callback**：通常无需逐条等待发送结果，有利于提高吞吐量；send() 仍可能因元数据或缓冲区等待而阻塞，Callback 负责处理成功/失败逻辑，适合需要并发发送的场景。

---

## 消费者代码

> [!note] 理解 KafkaConsumer 的工作方式
> KafkaConsumer 不是线程安全的，每个线程必须独立持有一个实例。消费者通过 poll() 主动拉取消息（Pull 模型），可以配合批量大小和处理逻辑调节消费节奏；这并不保证避免消息积压或资源耗尽，处理耗时过长还可能触发再均衡。

```java
package com.example;

import org.apache.kafka.clients.consumer.*;
import org.apache.kafka.common.serialization.StringDeserializer;

import java.time.Duration;
import java.util.Collections;
import java.util.Properties;

public class KafkaConsumerExample {

    public static void main(String[] args) {

        // === 第一步：配置 Consumer ===
        Properties props = new Properties();

        // 必填：Broker 地址
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");

        // 必填：消费者组 ID。同一个 Group 内的消费者共同消费 Topic 的所有分区
        // 不同 Group 之间相互独立，各自维护自己的消费进度
        props.put(ConsumerConfig.GROUP_ID_CONFIG, "hello-consumer-group");

        // 必填：反序列化方式，要与生产者的序列化方式对应
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());

        // 没有有效提交位点（包括首次消费或提交位点已超出保留范围）时，从哪里开始消费：
        // earliest：无有效提交位点时，从当前仍保留的最早 offset 开始；不会重新读取已因保留策略删除的消息
        // latest（默认）：无有效提交位点时，从执行位点重置时的日志末尾开始，消费此后写入的消息
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");

        // 关闭自动提交 offset，改用手动提交，更安全（防止消息处理失败但 offset 已提交）
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "false");

        // === 第二步：创建 Consumer 并订阅 Topic ===
        try (KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props)) {

            // subscribe() 订阅 Topic 列表，Kafka 会自动为该消费者分配分区（Rebalance）
            consumer.subscribe(Collections.singletonList("hello-kafka"));
            System.out.println("Consumer 已启动，开始消费 hello-kafka，按 Ctrl+C 停止...");

            // === 第三步：Poll 循环 ===
            // 消费者的核心是一个无限循环，不断调用 poll() 拉取消息
            while (true) {
                // poll(Duration)：可等待最多 500ms 获取消息；本次调用可能阻塞，超时仍无消息则返回空集合
                ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));

                if (records.isEmpty()) {
                    // 没有新消息时可以做其他轻量工作，或直接继续下一次 poll
                    continue;
                }

                // === 第四步：处理消息 ===
                for (ConsumerRecord<String, String> record : records) {
                    System.out.printf("收到消息 | Topic=%s | Partition=%d | Offset=%d | Key=%s | Value=%s%n",
                            record.topic(),
                            record.partition(),
                            record.offset(),
                            record.key(),
                            record.value());

                    // 在这里执行业务逻辑：写数据库、调接口、更新缓存等
                    processMessage(record);
                }

                // === 第五步：手动提交 offset ===
                // commitSync()：同步提交，等待提交完成或抛出异常；处理成功后提交有助于实现 at-least-once，仍需处理提交失败和重复消费
                // commitAsync()：异步提交，不阻塞，吞吐更高，但提交失败时不重试
                try {
                    consumer.commitSync();
                    System.out.println("本批 " + records.count() + " 条消息已提交 offset");
                } catch (CommitFailedException e) {
                    // 提交失败通常意味着 Consumer 被踢出 Group（如 poll 间隔超时）
                    System.err.println("Offset 提交失败：" + e.getMessage());
                }
            }
        }
    }

    private static void processMessage(ConsumerRecord<String, String> record) {
        // 模拟业务处理耗时
        // 生产环境中这里应写入数据库、发 HTTP 请求、更新内存状态等
        System.out.println("  -> 业务处理中：" + record.value());
    }
}
```

> [!warning] 手动提交 offset 的关键原则
> **先处理，后提交**。如果先提交 offset 再处理消息，程序崩溃时已提交的消息不会被重新消费，导致数据丢失（at-most-once）。在消息仍可读取、业务处理成功后才提交且妥善处理提交失败等条件下，先处理后提交可用于实现 at-least-once；程序崩溃时可能重复消费同一批消息，业务代码需要做幂等处理。

---

## 运行演示

### 启动顺序

以下沿用安装篇的实际路径，先用 `ls /opt/kafka/current/libs/kafka-clients-*.jar` 查看所用客户端版本；这只是版本自检，不是缺失的 Broker 准备流程。目录不存在或版本不符合本文 3.6.1 说明时，须先完成相应环境配置，不能仅创建 Topic 就当作环境已准备。

```bash
# 终端 1：先启动消费者（让它等待消息）
javac -cp "$(ls /opt/kafka/current/libs/*.jar | tr '\n' ':')" \
    src/main/java/com/example/*.java -d out/
java -cp "$(ls /opt/kafka/current/libs/*.jar | tr '\n' ':'):out" \
    com.example.KafkaConsumerExample

# 终端 2：再启动生产者（发送消息）
java -cp "$(ls /opt/kafka/current/libs/*.jar | tr '\n' ':'):out" \
    com.example.KafkaProducerExample
```

### 预期输出

生产者端：

```text
--- 同步发送示例 ---
同步发送成功 | Topic=hello-kafka | Partition=2 | Offset=0 | Key=sync-key-0
同步发送成功 | Topic=hello-kafka | Partition=1 | Offset=0 | Key=sync-key-1
同步发送成功 | Topic=hello-kafka | Partition=0 | Offset=0 | Key=sync-key-2

--- 异步发送示例（带 Callback）---
异步发送成功 | Partition=1 | Offset=1 | Key=async-key-0
异步发送成功 | Partition=0 | Offset=1 | Key=async-key-1
...
发送调用已完成，即将关闭 Producer；请结合 Future 和 Callback 判断发送结果。
```

消费者端：

```text
Consumer 已启动，开始消费 hello-kafka，按 Ctrl+C 停止...
收到消息 | Topic=hello-kafka | Partition=0 | Offset=0 | Key=sync-key-2 | Value=同步消息 #2
  -> 业务处理中：同步消息 #2
收到消息 | Topic=hello-kafka | Partition=1 | Offset=0 | Key=sync-key-1 | Value=同步消息 #1
  -> 业务处理中：同步消息 #1
...
本批 11 条消息已提交 offset
```

> [!note] 为什么消息不是按发送顺序输出的
> Kafka保证单个分区内的记录顺序，不保证跨分区的固定遍历顺序或全局顺序。使用默认按Key分区策略且分区数量不变时，相同Key会进入同一分区；生产者发送顺序还须满足相应配置条件。需要所有记录共享分区顺序时可使用单分区Topic。

---

## 关键配置项速查

### 生产者常用配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `bootstrap.servers` | 无（必填） | Broker 地址列表 |
| `acks` | `all`（Kafka 3.6.1） | 确认级别：`0`/`1`/`all` |
| `retries` | `2147483647` | 失败重试次数 |
| `batch.size` | `16384`（16KB） | 批量发送的最大字节数 |
| `linger.ms` | `0` | 批量等待时间，适当调大可提升吞吐 |
| `buffer.memory` | `33554432`（32MB） | 发送缓冲区总大小 |
| `compression.type` | `none` | 压缩算法：`gzip`/`snappy`/`lz4`/`zstd` |

### 消费者常用配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `bootstrap.servers` | 无（必填） | Broker 地址列表 |
| `group.id` | 无（必填） | 消费者组 ID |
| `auto.offset.reset` | `latest` | 无有效提交位点时的重置策略；latest 从重置时的日志末尾开始 |
| `enable.auto.commit` | `true` | 是否自动提交 offset |
| `auto.commit.interval.ms` | `5000` | 自动提交间隔（ms） |
| `max.poll.records` | `500` | 单次 poll() 返回的最大消息数 |
| `session.timeout.ms` | `45000` | 消费者超时时间，超时触发 Rebalance |

---

## 消息流向总结

```java
Producer 线程
    │
    │  new ProducerRecord(topic, key, value)
    ▼
RecordAccumulator（内存缓冲区）
    │
    │  Sender 线程批量打包
    ▼
Kafka Broker（Leader 分区）
    │
    │  副本同步（ISR）
    ▼
Consumer poll() 拉取
    │
    │  业务处理
    ▼
commitSync() / commitAsync() 提交 offset
```

---

## 掌握检查

- [ ] 能够独立配置 KafkaProducer 并成功发送消息（同步和异步两种方式）
- [ ] 理解 Callback 的两个参数（metadata 和 exception）各在何时有值
- [ ] 能够配置 KafkaConsumer 并在 poll 循环中处理消息
- [ ] 理解 `enable.auto.commit=false` 加 `commitSync()` 的意义
- [ ] 知道 `auto.offset.reset=earliest` 和 `latest` 的区别及适用场景

## 实践练习

**基础题**：修改消费者代码，改用 `commitAsync()` 替换 `commitSync()`，并在 Callback 中打印提交结果。观察两种方式在输出顺序上的差异。

**进阶题**：尝试用 `consumer.seek(partition, offset)` 方法，让消费者从指定 offset 开始消费，而不是从最早或最新位置开始。提示：seek 只能用于已分配给当前消费者的分区；subscribe 后由 poll 驱动分区分配，可在 `onPartitionsAssigned` 回调中调用 seek，使后续消费从指定 offset 开始。

---

**前置知识**：[[【技术与工具】/Kafka/05-Kafka环境安装与配置|Kafka 环境安装与配置]]
**下一步学习**：[[【技术与工具】/Kafka/07-生产者深入剖析|生产者深入剖析]] - 深入了解分区策略、拦截器、幂等生产者等高级特性
**相关文档**：[[【技术与工具】/Kafka/08-消费者深入剖析|消费者深入剖析]] | [[【技术与工具】/Kafka/11-偏移量管理|偏移量管理]] | [[【技术与工具】/Kafka/09-主题与分区设计|主题与分区设计]]
