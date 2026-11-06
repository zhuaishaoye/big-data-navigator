---
title: MapReduce故障处理 - 分布式计算诊断指南
tags:
  - Hadoop
  - MapReduce
  - 故障排查
  - 调试
  - 容错机制
  - 运维
created: 2024-06-29
updated: 2026-10-10
difficulty: 高级
duration: 90分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
stability: slow-changing
status: maintenance
access_tier: free
---


# 🩺 MapReduce故障处理 - 分布式计算诊断指南

> [!abstract] 📋 学习目标
> - 🔍 **掌握故障诊断思路**：系统化地定位和分析MapReduce任务问题
> - 🛠️ **学会调试技巧**：使用日志、界面、工具进行问题排查
> - 🔧 **理解容错机制**：了解Hadoop如何自动处理各种故障
> - 📊 **建立监控体系**：预防性监控和告警机制

> [!tip] 💡 前置知识
> 建议先学习 [[【技术与工具】/Hadoop/06-MapReduce开发实战|MapReduce开发]] 和 [[【技术与工具】/Hadoop/07-MapReduce性能优化|MapReduce性能优化]]，理解MapReduce的执行流程

---

## 🩺 故障诊断思维

### MapReduce故障排查就像医生看病

想象你是一位"集群医生"，需要诊断分布式系统的"病情"：

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"PingFang SC, -apple-system, Source Han Serif SC, serif","fontSize":"16px","background":"#FDFBF5","primaryColor":"#FDFBF5","primaryTextColor":"#2D2A26","primaryBorderColor":"#6E6A60","secondaryColor":"#E8EFE8","secondaryBorderColor":"#8FA890","secondaryTextColor":"#2D2A26","tertiaryColor":"#FDFBF5","tertiaryBorderColor":"#9A9488","tertiaryTextColor":"#6E6A60","lineColor":"#6E6A60","textColor":"#2D2A26","mainBkg":"#FDFBF5","nodeBorder":"#2D5A3D","clusterBkg":"#F3EEDF","clusterBorder":"#9A9488","edgeLabelBackground":"#FDFBF5"},"flowchart":{"htmlLabels":true,"curve":"basis","padding":20,"nodeSpacing":60,"rankSpacing":70,"useMaxWidth":false},"themeCSS":".node rect, .node polygon, .node circle { stroke-width: 1.5px; } .edgePath .path { stroke-width: 1.5px; } .cluster-label .nodeLabel, .cluster-label foreignObject { color: #2D2A26 !important; } .edgeLabel, .edgeLabel foreignObject { color: #2D2A26 !important; background-color: #FDFBF5; } .edgeLabel rect { fill: #FDFBF5; }"}}%%
flowchart TD
    classDef default fill:#FDFBF5,stroke:#6E6A60,color:#2D2A26,stroke-width:1.5px
    classDef startend fill:#2D2A26,stroke:#2D2A26,color:#FDFBF5,font-weight:bold
    classDef decision fill:#F6EAD8,stroke:#C08A1A,color:#2D2A26,font-weight:bold
    classDef hub fill:#3B5A80,stroke:#3B5A80,color:#FDFBF5,font-weight:bold
    classDef io fill:#E5EAF0,stroke:#3B5A80,color:#2D2A26
    classDef accent fill:#A6432C,stroke:#A6432C,color:#FDFBF5,font-weight:bold
    classDef storage fill:#F3EEDF,stroke:#9A9488,color:#2D2A26
    subgraph "医生诊断流程"
        A[患者症状]
        B[初步检查]
        C[详细诊断]
        D[病因分析]
        E[制定治疗方案]
        F[治疗和康复]
        
        A --> B
        B --> C
        C --> D
        D --> E
        E --> F
    end
    
    subgraph "故障诊断流程"
        B1[任务失败]
        B2[查看监控]
        C1[分析日志]
        D1[定位根因]
        E1[修复问题]
        F1[验证恢复]
        
        B1 --> B2
        B2 --> C1
        C1 --> D1
        D1 --> E1
        E1 --> F1
    end
    class A,B,C,D,E,F,B1,B2,C1,D1,E1,F1 default
```

**故障诊断四步法**：
1. **🚨 症状观察**：任务失败、性能下降、资源异常等
2. **🔍 信息收集**：日志、监控数据、系统状态等
3. **💡 原因分析**：代码问题、配置错误、资源不足等
4. **🔧 问题解决**：修复代码、调整配置、扩容资源等

> [!tip] 💡 诊断原则
> - **先急后缓**：优先解决影响生产的问题
> - **由表及里**：从表面现象深入到根本原因
> - **系统思维**：考虑问题的关联性和影响范围
> - **记录经验**：建立故障知识库

---

## 🔍 常见故障类型

### 任务执行失败

> [!note] 🚨 常见失败症状
> - **任务反复重启**：Map/Reduce任务多次失败重试
> - **任务hang住不动**：长时间没有进度更新
> - **内存溢出**：OutOfMemoryError异常
> - **权限错误**：Permission denied错误
> - **连接超时**：网络相关的timeout错误

### 应用程序错误分类

```java title="MapReduce异常分类和处理"
public class MapReduceErrorHandler {
    
    /**
     * 📝 常见异常类型和处理策略
     */
    public enum ErrorType {
        
        // 🧠 内存相关错误
        OUT_OF_MEMORY("java.lang.OutOfMemoryError", 
            "增加JVM堆内存或优化代码内存使用"),
            
        // 🗂️ 文件系统错误  
        FILE_NOT_FOUND("java.io.FileNotFoundException",
            "检查输入路径是否存在，权限是否正确"),
            
        // 🌐 网络连接错误
        CONNECT_TIMEOUT("java.net.ConnectException",
            "检查网络连接，增加超时时间配置"),
            
        // 🔐 权限错误
        PERMISSION_DENIED("org.apache.hadoop.security.AccessControlException",
            "检查HDFS权限设置，确认用户权限"),
            
        // 📊 数据格式错误
        NUMBER_FORMAT("java.lang.NumberFormatException",
            "检查输入数据格式，增加数据验证"),
            
        // 🔄 资源不足
        RESOURCE_SHORTAGE("Container killed by ResourceManager",
            "增加内存/CPU配置或优化资源使用");
        
        private final String pattern;
        private final String solution;
        
        ErrorType(String pattern, String solution) {
            this.pattern = pattern;
            this.solution = solution;
        }
        
        public static String getSolution(String errorMessage) {
            for (ErrorType type : values()) {
                if (errorMessage.contains(type.pattern)) {
                    return type.solution;
                }
            }
            return "未知错误，请检查完整日志进行分析";
        }
    }
}
```

---

## 📊 日志分析和调试

### 日志文件位置

```bash title="MapReduce日志位置"
# 🗂️ YARN应用日志
yarn logs -applicationId application_xxx

# 📍 具体容器日志
yarn logs -applicationId application_xxx -containerId container_xxx

# 🖥️ JobHistory日志
ls $HADOOP_HOME/logs/history/

# 📁 本地任务日志（开发调试）
ls $HADOOP_HOME/logs/userlogs/

# 🔍 实时查看运行中的任务日志
yarn logs -applicationId application_xxx -log_files stdout -f
```

### 日志分析工具

```bash title="日志分析脚本"
#!/bin/bash
# mapreduce_log_analyzer.sh - MapReduce日志分析工具

APPLICATION_ID=$1
ERROR_KEYWORDS="ERROR|Exception|OutOfMemory|killed|failed"

if [ -z "$APPLICATION_ID" ]; then
    echo "🩺 MapReduce日志分析工具"
    echo "用法: $0 <application_id>"
    echo "示例: $0 application_1234567890123_0001"
    exit 1
fi

echo "🔍 分析应用日志: $APPLICATION_ID"
echo "开始时间: $(date)"
echo "─" | tr '─' '─' | head -c 50; echo

# 1️⃣ 获取应用基本信息
echo "📋 应用基本信息:"
yarn application -status $APPLICATION_ID | grep -E "(Application-Id|Application-Name|State|Final-State)"

# 2️⃣ 分析错误日志
echo -e "\n🚨 错误信息统计:"
yarn logs -applicationId $APPLICATION_ID 2>/dev/null | \
    grep -iE "$ERROR_KEYWORDS" | \
    cut -d' ' -f4- | \
    sort | uniq -c | sort -rn | head -10

# 3️⃣ 任务执行时间分析
echo -e "\n⏱️ 任务执行时间分析:"
yarn logs -applicationId $APPLICATION_ID 2>/dev/null | \
    grep -E "Task.*finished|Task.*failed" | \
    tail -20

# 4️⃣ 资源使用分析
echo -e "\n💾 资源使用情况:"
yarn logs -applicationId $APPLICATION_ID 2>/dev/null | \
    grep -E "Memory|CPU|Container" | \
    head -10

# 5️⃣ 输出详细错误日志
echo -e "\n📄 详细错误信息:"
yarn logs -applicationId $APPLICATION_ID 2>/dev/null | \
    grep -iE -A 5 -B 5 "$ERROR_KEYWORDS" | head -50

echo -e "\n✅ 日志分析完成"
```

### 调试技巧

```java title="MapReduce调试工具类"
public class MapReduceDebugger {
    
    /**
     * 🐛 在Mapper中添加调试信息
     */
    public static class DebugMapper extends Mapper<LongWritable, Text, Text, IntWritable> {
        
        private long lineNumber = 0;
        private static final int DEBUG_INTERVAL = 1000;
        
        @Override
        public void map(LongWritable key, Text value, Context context) 
                throws IOException, InterruptedException {
            
            lineNumber++;
            
            try {
                // 📊 定期输出调试信息
                if (lineNumber % DEBUG_INTERVAL == 0) {
                    System.out.println(String.format(
                        "🐛 DEBUG: 已处理 %d 行，当前行: %s", 
                        lineNumber, value.toString().substring(0, Math.min(50, value.toString().length()))));
                }
                
                // 正常处理逻辑
                String[] words = value.toString().split("\\s+");
                for (String word : words) {
                    if (!word.isEmpty()) {
                        context.write(new Text(word), new IntWritable(1));
                    }
                }
                
            } catch (Exception e) {
                // 🚨 记录异常信息
                System.err.println(String.format(
                    "❌ ERROR at line %d: %s, data: %s", 
                    lineNumber, e.getMessage(), value.toString()));
                
                // 💾 写入错误计数器
                context.getCounter("DEBUG", "PROCESSING_ERRORS").increment(1);
                
                // 📊 继续处理还是抛出异常？
                // throw e;  // 严格模式：遇到错误就停止
                // 或者跳过错误行继续处理
            }
        }
        
        @Override
        protected void cleanup(Context context) throws IOException, InterruptedException {
            System.out.println(String.format("✅ Mapper完成，总计处理 %d 行", lineNumber));
        }
    }
    
    /**
     * 📊 数据质量检查Mapper
     */
    public static class DataQualityMapper extends Mapper<LongWritable, Text, Text, Text> {
        
        enum DataQuality {
            TOTAL_RECORDS,
            EMPTY_LINES,
            INVALID_FORMAT,
            NULL_VALUES,
            DUPLICATES
        }
        
        @Override
        public void map(LongWritable key, Text value, Context context) 
                throws IOException, InterruptedException {
            
            context.getCounter(DataQuality.TOTAL_RECORDS).increment(1);
            
            String line = value.toString().trim();
            
            // ✅ 检查空行
            if (line.isEmpty()) {
                context.getCounter(DataQuality.EMPTY_LINES).increment(1);
                return;
            }
            
            // ✅ 检查数据格式
            String[] fields = line.split(",", -1);
            if (fields.length < 3) {
                context.getCounter(DataQuality.INVALID_FORMAT).increment(1);
                context.write(new Text("INVALID_FORMAT"), value);
                return;
            }
            
            // ✅ 检查空值
            for (String field : fields) {
                if (field.trim().isEmpty() || "null".equals(field.toLowerCase())) {
                    context.getCounter(DataQuality.NULL_VALUES).increment(1);
                    context.write(new Text("NULL_VALUE"), value);
                    return;
                }
            }
            
            // ✅ 正常数据
            context.write(new Text("VALID_DATA"), value);
        }
    }
}
```

---

## 🛡️ 容错机制详解

### 任务级容错

Hadoop有强大的自动容错能力，就像是"自动修复系统"。

```xml title="容错相关配置"
<configuration>
    <!-- 🔄 Map任务最大重试次数 -->
    <property>
        <name>mapreduce.map.maxattempts</name>
        <value>4</value>
        <description>Map任务失败后最多重试3次</description>
    </property>
    
    <!-- 🔄 Reduce任务最大重试次数 -->
    <property>
        <name>mapreduce.reduce.maxattempts</name>
        <value>4</value>
        <description>Reduce任务失败后最多重试3次</description>
    </property>
    
    <!-- ⏱️ 任务超时时间 -->
    <property>
        <name>mapreduce.task.timeout</name>
        <value>600000</value>
        <description>任务无响应10分钟后被杀死</description>
    </property>
    
    <!-- 🚫 失败任务比例阈值 -->
    <property>
        <name>mapreduce.map.failures.maxpercent</name>
        <value>0</value>
        <description>允许的Map任务失败比例</description>
    </property>
    
    <!-- 🔧 推测执行开关 -->
    <property>
        <name>mapreduce.map.speculative</name>
        <value>true</value>
        <description>启用Map任务推测执行</description>
    </property>
</configuration>
```

### 节点级容错

```bash title="节点故障处理"
# 🔍 检查节点健康状态
yarn node -list -all

# 输出示例：
# node1:8041    RUNNING    0    4096    0    4
# node2:8041    UNHEALTHY  0    4096    0    4  # 不健康节点
# node3:8041    LOST       0    4096    0    4  # 丢失节点

# 🛠️ 节点故障恢复步骤
echo "🩺 节点故障诊断和恢复流程:"

# 1️⃣ 检查节点是否可达
ping -c 3 node2
ssh node2 'echo "节点可访问"'

# 2️⃣ 检查NodeManager服务
ssh node2 'jps | grep NodeManager'
ssh node2 'systemctl status hadoop-yarn-nodemanager'

# 3️⃣ 查看节点日志
ssh node2 'tail -100 $HADOOP_HOME/logs/yarn-hadoop-nodemanager-*.log'

# 4️⃣ 重启NodeManager（如果需要）
# 仅在确认该systemd服务名与部署一致并获得重启授权后执行，避免调用集群级启停脚本
ssh node2 'sudo systemctl restart hadoop-yarn-nodemanager'
```

### 数据级容错

```java title="数据容错和恢复"
public class DataRecoveryMapper extends Mapper<LongWritable, Text, Text, Text> {
    
    private static final String BACKUP_PATH = "/backup/corrupted_data/";
    private FileSystem fs;
    private FSDataOutputStream backupStream;
    
    @Override
    protected void setup(Context context) throws IOException {
        // 📁 初始化备份输出流
        Configuration conf = context.getConfiguration();
        fs = FileSystem.get(conf);
        
        String taskId = context.getTaskAttemptID().toString();
        Path backupFile = new Path(BACKUP_PATH + "corrupted_" + taskId + ".txt");
        backupStream = fs.create(backupFile);
    }
    
    @Override
    public void map(LongWritable key, Text value, Context context) 
            throws IOException, InterruptedException {
        
        try {
            // 🧹 尝试处理数据
            processData(value, context);
            
        } catch (Exception e) {
            // 🚨 处理失败，备份原始数据
            String errorRecord = String.format(
                "输入字节偏移:%d, 错误:%s, 数据:%s%n", 
                key.get(), e.getMessage(), value.toString());
            
            backupStream.write(errorRecord.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            backupStream.flush();
            
            // 📊 记录错误统计
            context.getCounter("DATA_RECOVERY", "CORRUPTED_RECORDS").increment(1);
            
            // 💡 决定是否继续处理
            if (shouldContinueOnError(e)) {
                System.err.println("⚠️ 跳过错误数据: " + e.getMessage());
            } else {
                throw new IOException("严重错误，停止处理", e);
            }
        }
    }
    
    private void processData(Text value, Context context) throws IOException, InterruptedException {
        // 正常的数据处理逻辑（仅适用于不含引号、转义或字段内逗号的简单分隔文本）
        String[] fields = value.toString().split(",", -1);
        
        if (fields.length < 2) {
            throw new IllegalArgumentException("数据格式错误：字段数不足");
        }
        
        // 验证数据格式
        validateData(fields);
        
        // 输出处理结果：以第一个字段作为键
        context.write(new Text(fields[0]), value);
    }
    
    private void validateData(String[] fields) {
        // 🔍 数据验证逻辑
        for (String field : fields) {
            if (field.trim().isEmpty()) {
                throw new IllegalArgumentException("包含空字段");
            }
        }
    }
    
    private boolean shouldContinueOnError(Exception e) {
        // 💡 决定哪些错误可以跳过
        return e instanceof IllegalArgumentException || 
               e instanceof NumberFormatException;
    }
    
    @Override
    protected void cleanup(Context context) throws IOException {
        if (backupStream != null) {
            backupStream.close();
        }
    }
}
```

---

## 🛠️ 实际问题排查案例

### 案例1：内存溢出问题

```bash title="内存溢出诊断流程"
# 🚨 问题症状：任务频繁失败，日志显示OutOfMemoryError

echo "🩺 内存溢出问题诊断"

# 1️⃣ 检查错误日志
yarn logs -applicationId application_xxx | grep -i "outofmemory" -A 10 -B 10

# 2️⃣ 查看当前内存配置
# 在JobHistory或作业详情中查看该作业实际提交的配置，检索mapreduce.*memory与java.opts；
# 不应仅以集群配置文件代替作业配置，应用代码和提交参数可能覆盖它们。

# 3️⃣ 分析堆转储文件（如果有）
ls -la /tmp/hadoop-*/heap_dump_*.hprof

# 4️⃣ 检查数据特征
hdfs dfs -du -h /input/path/
echo "检查是否有异常大的输入文件"
```

```xml title="内存溢出解决方案"
<!-- 💾 增加内存配置 -->
<property>
    <name>mapreduce.map.java.opts</name>
    <value>-Xmx4096m -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/tmp/</value>
</property>

<property>
    <name>mapreduce.map.memory.mb</name>
    <value>6144</value>
</property>

<!-- 🗜️ Map输出压缩用于减少中间数据传输量，不保证降低堆内存使用或解决内存溢出 -->
<property>
    <name>mapreduce.map.output.compress</name>
    <value>true</value>
</property>
```

### 案例2：数据倾斜导致任务挂起

```java title="数据倾斜检测工具"
public class DataSkewDetector extends Mapper<LongWritable, Text, Text, LongWritable> {
    
    private Map<String, Long> keyCountMap = new HashMap<>();
    private static final int SAMPLE_SIZE = 10000;
    private int recordCount = 0;
    
    @Override
    public void map(LongWritable key, Text value, Context context) 
            throws IOException, InterruptedException {
        
        recordCount++;
        String[] fields = value.toString().split(",", -1);
        
        // 📊 采样分析
        if (recordCount <= SAMPLE_SIZE) {
            if (fields.length > 0) {
                String keyField = fields[0];  // 假设第一个字段是key
                keyCountMap.merge(keyField, 1L, Long::sum);
            }
        }
        
        // 📈 定期报告采样结果
        if (recordCount == SAMPLE_SIZE) {
            analyzeDataDistribution(context);
        }
        
        // 正常处理：以第一个字段作为键
        context.write(new Text(fields[0]), new LongWritable(1));
    }
    
    private void analyzeDataDistribution(Context context) {
        
        long totalSamples = keyCountMap.values().stream().mapToLong(Long::longValue).sum();
        long avgCount = totalSamples / keyCountMap.size();
        
        System.out.println("📊 数据分布分析结果:");
        System.out.println("采样记录数: " + totalSamples);
        System.out.println("唯一键数量: " + keyCountMap.size());
        System.out.println("平均每键记录数: " + avgCount);
        
        // 🚨 检测数据倾斜
        keyCountMap.entrySet().stream()
            .filter(entry -> entry.getValue() > avgCount * 10)  // 超过平均值10倍
            .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
            .limit(5)
            .forEach(entry -> {
                System.out.println(String.format(
                    "⚠️ 数据倾斜键: %s (记录数: %d, 是平均值的 %.1f 倍)",
                    entry.getKey(), entry.getValue(), 
                    (double) entry.getValue() / avgCount));
                
                // 📊 写入倾斜计数器
                context.getCounter("DATA_SKEW", "SKEWED_KEYS").increment(1);
            });
    }
}
```

### 案例3：网络连接问题

```bash title="网络问题诊断"
#!/bin/bash
# network_diagnosis.sh - 网络连接问题诊断

echo "🌐 网络连接问题诊断"

# 1️⃣ 检查关键端口连通性
NAMENODE_HOST="namenode"
RESOURCEMANAGER_HOST="resourcemanager"

echo "📍 检查HDFS连接..."
nc -zv $NAMENODE_HOST 9000 2>&1 | grep -E "(succeeded|refused)"

echo "📍 检查YARN连接..."
nc -zv $RESOURCEMANAGER_HOST 8032 2>&1 | grep -E "(succeeded|refused)"

# 2️⃣ 检查DNS解析
echo "🔍 DNS解析检查..."
nslookup $NAMENODE_HOST
nslookup $RESOURCEMANAGER_HOST

# 3️⃣ 检查网络延迟
echo "⏱️ 网络延迟检查..."
ping -c 5 $NAMENODE_HOST | tail -1
ping -c 5 $RESOURCEMANAGER_HOST | tail -1

# 4️⃣ 检查防火墙状态
echo "🔒 防火墙状态..."
systemctl status firewalld 2>/dev/null || echo "firewalld未安装"
iptables -L | grep -E "(REJECT|DROP)" | head -5

# 5️⃣ 检查网络配置
echo "⚙️ 网络配置..."
cat /etc/hosts | grep -E "(namenode|resourcemanager)"
```

---

## 📊 监控和预警系统

### 自定义监控脚本

```bash title="mapreduce_health_monitor.sh"
#!/bin/bash
# MapReduce健康监控脚本

ALERT_EMAIL="admin@company.com"
LOG_FILE="/var/log/mapreduce_monitor.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

check_resource_manager() {
    log "🔍 检查ResourceManager状态..."
    
    if ! curl -s http://localhost:8088/ws/v1/cluster/info > /dev/null; then
        log "❌ ResourceManager无响应"
        return 1
    fi
    
 # 检查活跃节点数
    ACTIVE_NODES=$(curl -s http://localhost:8088/ws/v1/cluster/nodes | jq '[.nodes.node[]? | select(.state == "RUNNING")] | length')
    
    if [ "$ACTIVE_NODES" -lt 3 ]; then  # 假设最少需要3个节点
        log "⚠️ 活跃节点数过少: $ACTIVE_NODES"
        return 1
    fi
    
    log "✅ ResourceManager状态正常，活跃节点: $ACTIVE_NODES"
    return 0
}

check_failed_applications() {
    log "🔍 检查失败的应用程序..."
    
    FAILED_APPS=$(yarn application -list -appStates FAILED | grep -c "application_")
    
    if [ "$FAILED_APPS" -gt 5 ]; then  # 失败应用超过5个
        log "⚠️ 失败应用过多: $FAILED_APPS"
        return 1
    fi
    
    log "✅ 失败应用数量正常: $FAILED_APPS"
    return 0
}

check_cluster_memory() {
    log "🔍 检查集群内存使用..."
    
    MEMORY_INFO=$(curl -s http://localhost:8088/ws/v1/cluster/metrics | jq '.clusterMetrics')
    TOTAL_MEMORY=$(echo $MEMORY_INFO | jq '.totalMB')
    AVAILABLE_MEMORY=$(echo $MEMORY_INFO | jq '.availableMB')
    
    if [ "$TOTAL_MEMORY" -gt 0 ]; then
        USAGE_PERCENT=$((($TOTAL_MEMORY - $AVAILABLE_MEMORY) * 100 / $TOTAL_MEMORY))
        
        if [ "$USAGE_PERCENT" -gt 85 ]; then  # 内存使用超过85%
            log "⚠️ 集群内存使用率过高: ${USAGE_PERCENT}%"
            return 1
        fi
        
        log "✅ 集群内存使用正常: ${USAGE_PERCENT}%"
    fi
    
    return 0
}

send_alert() {
    local message="$1"
    log "📧 发送告警: $message"
    
 # 发送邮件告警
    echo "$message" | mail -s "MapReduce集群告警" $ALERT_EMAIL
    
 # 可以添加其他告警方式：钉钉、微信、Slack等
}

main() {
    log "🚀 开始MapReduce健康检查..."
    
    local issues=0
    
 # 执行各项检查
    check_resource_manager || ((issues++))
    check_failed_applications || ((issues++))
    check_cluster_memory || ((issues++))
    
    if [ $issues -eq 0 ]; then
        log "✅ 所有检查项正常"
    else
        log "❌ 发现 $issues 个问题"
        send_alert "MapReduce集群存在 $issues 个问题，请及时处理"
    fi
    
    log "🏁 健康检查完成"
}

# 设置定时执行：*/5 * * * * /path/to/mapreduce_health_monitor.sh
main
```

### 性能指标收集

```java title="MapReduce性能指标收集器"
public class MetricsCollector extends Mapper<LongWritable, Text, Text, IntWritable> {
    
    private long startTime;
    private long recordCount = 0;
    private long totalBytes = 0;
    
    // 📊 性能指标
    private static final String METRICS_PREFIX = "PERFORMANCE_";
    
    @Override
    protected void setup(Context context) {
        startTime = System.currentTimeMillis();
        
        // 📝 记录任务开始
        System.out.println(String.format(
            "📊 [%s] 任务开始 - TaskID: %s",
            new java.util.Date(), context.getTaskAttemptID()));
    }
    
    @Override
    public void map(LongWritable key, Text value, Context context) 
            throws IOException, InterruptedException {
        
        recordCount++;
        totalBytes += value.getLength();
        
        // 📈 定期收集性能指标
        if (recordCount % 10000 == 0) {
            collectMetrics(context);
        }
        
        // 正常处理逻辑...
        context.write(new Text("processed"), new IntWritable(1));
    }
    
    private void collectMetrics(Context context) {
        long currentTime = System.currentTimeMillis();
        long elapsedTime = currentTime - startTime;
        
        // 📊 计算性能指标
        double recordsPerSecond = (double) recordCount / (elapsedTime / 1000.0);
        double mbPerSecond = (double) totalBytes / (1024 * 1024) / (elapsedTime / 1000.0);
        
        // 💾 获取内存使用情况
        Runtime runtime = Runtime.getRuntime();
        long usedMemory = runtime.totalMemory() - runtime.freeMemory();
        double memoryUsageMB = usedMemory / (1024.0 * 1024.0);
        
        // 📝 记录指标
        System.out.println(String.format(
            "📊 性能指标 - 记录数/秒: %.2f, MB/秒: %.2f, 内存使用: %.2f MB",
            recordsPerSecond, mbPerSecond, memoryUsageMB));
        
        // 📈 写入计数器
        context.getCounter(METRICS_PREFIX + "RECORDS_PER_SECOND", 
            String.valueOf((int) recordsPerSecond)).increment(1);
        context.getCounter(METRICS_PREFIX + "MEMORY_USAGE_MB", 
            String.valueOf((int) memoryUsageMB)).increment(1);
    }
    
    @Override
    protected void cleanup(Context context) {
        long totalTime = System.currentTimeMillis() - startTime;
        
        // 📊 最终性能报告
        double avgRecordsPerSecond = (double) recordCount / (totalTime / 1000.0);
        double avgMBPerSecond = (double) totalBytes / (1024 * 1024) / (totalTime / 1000.0);
        
        System.out.println(String.format(
            "✅ [%s] 任务完成 - 总记录: %d, 总耗时: %d ms, 平均速度: %.2f 记录/秒, %.2f MB/秒",
            new java.util.Date(), recordCount, totalTime, avgRecordsPerSecond, avgMBPerSecond));
        
        // 📊 写入最终指标
        context.getCounter("FINAL_METRICS", "TOTAL_RECORDS").setValue(recordCount);
        context.getCounter("FINAL_METRICS", "TOTAL_TIME_MS").setValue(totalTime);
        context.getCounter("FINAL_METRICS", "AVG_RECORDS_PER_SEC").setValue((long) avgRecordsPerSecond);
    }
}
```

---

## 🎯 故障预防最佳实践

### 代码层面预防

> [!success] ✅ 代码质量检查清单
> - **输入验证**：检查输入数据格式和范围
> - **异常处理**：捕获和处理可能的异常
> - **资源管理**：正确关闭文件和连接
> - **内存管理**：避免内存泄漏和过度使用
> - **日志记录**：记录关键操作和错误信息

### 配置层面预防

```xml title="健壮性配置"
<configuration>
    <!-- 🛡️ 增强容错配置 -->
    <property>
        <name>mapreduce.map.maxattempts</name>
        <value>4</value>
        <description>Map任务最大尝试次数，包含首次执行；值为4时失败后最多重试3次</description>
    </property>
    
    <!-- ⏱️ 合理的超时设置 -->
    <property>
        <name>mapreduce.task.timeout</name>
        <value>1800000</value>
        <description>30分钟超时</description>
    </property>
    
    <!-- 💾 内存安全边际 -->
    <property>
        <name>mapreduce.map.java.opts</name>
        <value>-Xmx2048m -XX:+UseG1GC -XX:+HeapDumpOnOutOfMemoryError</value>
        <description>保守的内存配置和GC优化</description>
    </property>
    
    <!-- 🔍 配置任务环境变量（此项不启用详细日志） -->
    <property>
        <name>mapreduce.admin.user.env</name>
        <value>LD_LIBRARY_PATH=/usr/local/lib</value>
        <description>环境变量配置</description>
    </property>
</configuration>
```

### 运维层面预防

```bash title="预防性维护脚本"
#!/bin/bash
# preventive_maintenance.sh - 预防性维护

echo "🛠️ MapReduce预防性维护"

# 1️⃣ 清理临时文件
echo "🧹 清理临时文件..."
# 先列出候选文件；确认不属于运行中的任务、满足日志保留要求并获得授权后再单独清理
find /tmp/hadoop* -type f -mtime +7 -print
find "$HADOOP_HOME/logs" -name "*.log.*" -mtime +30 -print

# 2️⃣ 检查磁盘空间
echo "💿 检查磁盘空间..."
df -P | awk 'NR > 1 {usage = $5; sub(/%$/, "", usage); if (usage + 0 > 85) print "⚠️ 磁盘使用率过高: " $0}'

# 3️⃣ 检查系统负载
echo "📊 检查系统负载..."
# Linux环境：读取1分钟平均负载，避免依赖uptime输出格式
LOAD=$(awk '{print $1}' /proc/loadavg)
CPU_COUNT=$(nproc)
if (( $(echo "$LOAD > $CPU_COUNT * 0.8" | bc -l) )); then
    echo "⚠️ 系统负载过高: $LOAD"
fi

# 4️⃣ 检查网络连接
echo "🌐 检查网络连接..."
netstat -tuln | grep -E ":8088|:9000|:50070" | grep LISTEN || echo "⚠️ 关键端口未监听"

# 5️⃣ 检查Java进程
echo "☕ 检查Java进程..."
jps | grep -E "(NameNode|DataNode|ResourceManager|NodeManager)" || echo "⚠️ 关键进程未运行"

echo "✅ 预防性维护完成"
```

---

## 🔗 下一步学习

掌握MapReduce故障处理后，建议继续学习：

1. **[[【技术与工具】/Hadoop/09-YARN资源管理架构|YARN资源管理]]** - 深入理解任务调度和资源分配
2. **[[【技术与工具】/Hadoop/11-YARN集群管理|YARN集群]]** - 学习集群级别的运维管理
3. **[[【技术与工具】/Hadoop/20-性能监控与调优|性能监控与调优]]** - 建立完整的监控体系
4. **[[【技术与工具】/Hadoop/22-故障排查与运维|故障排查与运维]]** - 掌握企业级运维技能

> [!tip] 💡 故障处理建议
> - **预防为主**：通过监控和维护减少故障发生
> - **快速响应**：建立故障告警和响应机制
> - **经验积累**：记录故障案例和解决方案
> - **持续改进**：根据故障经验优化系统
> - **团队协作**：建立故障处理标准流程

---

*最后更新：2024-06-29* 