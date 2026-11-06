---
title: Java在数据开发中的应用 - 从理论到实战的完整指南
type: 技术教程
tags:
  - Java
  - 数据开发
  - JDBC
  - 数据处理
  - ETL
  - 数据管道
difficulty: 高级
duration: 120分钟
created: 2024-12
updated: 2026-10-10
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
stability: slow-changing
status: maintenance
access_tier: free
---


# Java在数据开发中的应用 - 从理论到实战的完整指南

> [!success] Java数据开发实战：从数据存储到智能分析的全栈解决方案
> 
> 如果把数据开发比作建造一座现代化城市，那么Java就是那个**万能的建筑师和工程师**。它不仅能设计蓝图（架构设计），还能亲自动手建造（编码实现），更能确保城市高效运转（性能优化）。
> 
> **Java在数据开发中就像是：**
> - 🏗️ **城市规划师**：设计整体数据架构和处理流程
> - 🚰 **水利工程师**：构建高效的数据流动管道（ETL）
> - 🏭 **工厂管理者**：实现大规模数据的批量处理
> - 📡 **通信专家**：处理实时数据流和消息传递
> - 🏥 **系统医生**：监控和优化系统性能
> 
> **本教程展示以下工程方向，完成相应能力目标还需补全代码、测试与项目实践：**
> - 构建企业级数据存储和访问系统
> - 设计高效的数据处理和转换管道
> - 开发实时数据分析和监控应用
> - 创建可扩展的数据服务API
> - 优化大数据处理的性能瓶颈
> 
> **投入时间**：预估120分钟用于阅读核心示例；补全实现、验证正确性与工程实践需另行安排时间

## 🗄️ 数据库连接与操作进阶

### 📊 JDBC连接池最佳实践

现代数据开发中，高效的数据库连接管理是核心基础：

```java
/**
 * 高性能数据库连接管理器
 * 集成HikariCP连接池，每个管理器实例管理一个数据源
 */
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class DatabaseConnectionManager {
    private static final Logger logger = LoggerFactory.getLogger(DatabaseConnectionManager.class);
    
    private final HikariDataSource dataSource;
    
    public DatabaseConnectionManager(String jdbcUrl, String username, String password) {
        HikariConfig config = new HikariConfig();
        
        // 基础连接配置
        config.setJdbcUrl(jdbcUrl);
        config.setUsername(username);
        config.setPassword(password);
        
        // 连接池优化配置
        config.setMaximumPoolSize(20);                    // 最大连接数
        config.setMinimumIdle(5);                        // 最小空闲连接数
        config.setConnectionTimeout(30000);              // 连接超时30秒
        config.setIdleTimeout(600000);                   // 空闲超时10分钟
        config.setMaxLifetime(1800000);                  // 连接最大生存时间30分钟
        
        // 性能优化配置
        config.setLeakDetectionThreshold(60000);         // 连接泄漏检测1分钟
        // 以下属性以MySQL Connector/J为例，由驱动解释；其他驱动需使用其支持的配置
        config.addDataSourceProperty("cachePrepStmts", "true");
        config.addDataSourceProperty("prepStmtCacheSize", "250");
        config.addDataSourceProperty("prepStmtCacheSqlLimit", "2048");
        
        // 连接测试配置
        config.setConnectionTestQuery("SELECT 1");
        config.setValidationTimeout(5000);
        
        this.dataSource = new HikariDataSource(config);
        logger.info("数据库连接池初始化完成，最大连接数: {}", config.getMaximumPoolSize());
    }
    
    /**
     * 获取数据库连接
     */
    public Connection getConnection() throws SQLException {
        return dataSource.getConnection();
    }
    
    /**
     * 执行查询操作
     */
    public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... params) {
        List<T> results = new ArrayList<>();
        
        try (Connection conn = getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            // 设置参数
            for (int i = 0; i < params.length; i++) {
                stmt.setObject(i + 1, params[i]);
            }
            
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    results.add(rowMapper.mapRow(rs));
                }
            }
            
            logger.debug("查询执行完成，返回 {} 条记录", results.size());
        } catch (SQLException e) {
            logger.error("查询执行失败: {}", e.getMessage(), e);
            throw new RuntimeException("数据库查询失败", e);
        }
        
        return results;
    }
    
    /**
     * 执行批量更新操作
     */
    public int[] batchUpdate(String sql, List<Object[]> batchParams) {
        try (Connection conn = getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            conn.setAutoCommit(false);  // 开启事务
            
            for (Object[] params : batchParams) {
                for (int i = 0; i < params.length; i++) {
                    stmt.setObject(i + 1, params[i]);
                }
                stmt.addBatch();
            }
            
            int[] results = stmt.executeBatch();
            conn.commit();  // 提交事务
            
            logger.info("批量更新完成，影响记录数: {}", Arrays.stream(results).sum());
            return results;
            
        } catch (SQLException e) {
            logger.error("批量更新失败: {}", e.getMessage(), e);
            throw new RuntimeException("批量更新操作失败", e);
        }
    }
    
    /**
     * 关闭连接池
     */
    public void close() {
        if (dataSource != null && !dataSource.isClosed()) {
            dataSource.close();
            logger.info("数据库连接池已关闭");
        }
    }
    
    /**
     * 行映射器接口
     */
    @FunctionalInterface
    public interface RowMapper<T> {
        T mapRow(ResultSet rs) throws SQLException;
    }
}
```

### 🏭 数据访问层设计模式

```java
/**
 * 数据访问对象模式实现
 * 提供标准的CRUD操作接口
 */
public interface BaseDAO<T, ID> {
    void save(T entity);
    void update(T entity);
    void delete(ID id);
    T findById(ID id);
    List<T> findAll();
    List<T> findByCondition(String condition, Object... params);
    long count();
}

/**
 * 用户数据访问实现
 */
public class UserDAOImpl implements BaseDAO<User, Long> {
    private final DatabaseConnectionManager dbManager;
    
    public UserDAOImpl(DatabaseConnectionManager dbManager) {
        this.dbManager = dbManager;
    }
    
    @Override
    public void save(User user) {
        String sql = "INSERT INTO users (name, email, age, created_time) VALUES (?, ?, ?, ?)";
        
        try (Connection conn = dbManager.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            
            stmt.setString(1, user.getName());
            stmt.setString(2, user.getEmail());
            stmt.setInt(3, user.getAge());
            stmt.setTimestamp(4, new Timestamp(System.currentTimeMillis()));
            
            int affectedRows = stmt.executeUpdate();
            if (affectedRows > 0) {
                try (ResultSet keys = stmt.getGeneratedKeys()) {
                    if (keys.next()) {
                        user.setId(keys.getLong(1));
                    }
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("保存用户失败", e);
        }
    }
    
    @Override
    public User findById(Long id) {
        String sql = "SELECT * FROM users WHERE id = ?";
        
        List<User> users = dbManager.query(sql, rs -> {
            User user = new User();
            user.setId(rs.getLong("id"));
            user.setName(rs.getString("name"));
            user.setEmail(rs.getString("email"));
            user.setAge(rs.getInt("age"));
            user.setCreatedTime(rs.getTimestamp("created_time").toLocalDateTime());
            return user;
        }, id);
        
        return users.isEmpty() ? null : users.get(0);
    }
    
    @Override
    public List<User> findByCondition(String condition, Object... params) {
        String sql = "SELECT * FROM users WHERE " + condition;
        
        return dbManager.query(sql, rs -> {
            User user = new User();
            user.setId(rs.getLong("id"));
            user.setName(rs.getString("name"));
            user.setEmail(rs.getString("email"));
            user.setAge(rs.getInt("age"));
            user.setCreatedTime(rs.getTimestamp("created_time").toLocalDateTime());
            return user;
        }, params);
    }
    
    /**
     * 分页查询实现
     */
    public PageResult<User> findByPage(int page, int size, String orderBy) {
        int offset = (page - 1) * size;
        String sql = "SELECT * FROM users ORDER BY " + orderBy + " LIMIT ? OFFSET ?";
        
        List<User> users = dbManager.query(sql, rs -> {
            User user = new User();
            user.setId(rs.getLong("id"));
            user.setName(rs.getString("name"));
            user.setEmail(rs.getString("email"));
            user.setAge(rs.getInt("age"));
            user.setCreatedTime(rs.getTimestamp("created_time").toLocalDateTime());
            return user;
        }, size, offset);
        
        long total = count();
        return new PageResult<>(users, total, page, size);
    }
}
```

## 📊 ETL数据处理管道

### 🔄 数据抽取转换加载框架

```java
/**
 * ETL处理框架
 * 支持可配置的数据处理管道
 */
public class ETLPipeline<S, T> {
    private static final Logger logger = LoggerFactory.getLogger(ETLPipeline.class);
    
    private final DataExtractor<S> extractor;
    private final DataTransformer<S, T> transformer;
    private final DataLoader<T> loader;
    private final ETLConfig config;
    
    public ETLPipeline(DataExtractor<S> extractor, 
                      DataTransformer<S, T> transformer, 
                      DataLoader<T> loader,
                      ETLConfig config) {
        this.extractor = extractor;
        this.transformer = transformer;
        this.loader = loader;
        this.config = config;
    }
    
    /**
     * 执行ETL处理流程
     */
    public ETLResult execute() {
        ETLResult result = new ETLResult();
        result.setStartTime(LocalDateTime.now());
        
        try {
            logger.info("开始执行ETL任务: {}", config.getJobName());
            
            // 第一阶段：数据抽取
            logger.info("开始数据抽取阶段...");
            List<S> sourceData = extractor.extract(config);
            result.setExtractedCount(sourceData.size());
            logger.info("数据抽取完成，共抽取 {} 条记录", sourceData.size());
            
            if (sourceData.isEmpty()) {
                logger.warn("没有抽取到任何数据，ETL任务结束");
                result.setStatus(ETLStatus.COMPLETED_WITH_WARNING);
                return result;
            }
            
            // 第二阶段：数据转换（批处理）
            logger.info("开始数据转换阶段...");
            List<T> transformedData = new ArrayList<>();
            List<DataError> errors = new ArrayList<>();
            
            int batchSize = config.getBatchSize();
            int totalBatches = (sourceData.size() + batchSize - 1) / batchSize;
            
            for (int i = 0; i < totalBatches; i++) {
                int start = i * batchSize;
                int end = Math.min(start + batchSize, sourceData.size());
                List<S> batch = sourceData.subList(start, end);
                
                logger.debug("处理批次 {}/{}, 记录数: {}", i + 1, totalBatches, batch.size());
                
                try {
                    List<T> batchResult = transformer.transform(batch);
                    transformedData.addAll(batchResult);
                } catch (DataTransformException e) {
                    logger.error("批次 {} 转换失败: {}", i + 1, e.getMessage());
                    errors.add(new DataError(e.getMessage(), batch.toString()));
                    
                    if (!config.isContinueOnError()) {
                        throw e;
                    }
                }
            }
            
            result.setTransformedCount(transformedData.size());
            result.setErrorCount(errors.size());
            logger.info("数据转换完成，成功转换 {} 条记录，错误 {} 条", 
                transformedData.size(), errors.size());
            
            // 第三阶段：数据加载
            if (!transformedData.isEmpty()) {
                logger.info("开始数据加载阶段...");
                int loadedCount = loader.load(transformedData, config);
                result.setLoadedCount(loadedCount);
                logger.info("数据加载完成，成功加载 {} 条记录", loadedCount);
            }
            
            result.setStatus(errors.isEmpty() ? ETLStatus.SUCCESS : ETLStatus.COMPLETED_WITH_ERRORS);
            result.setErrors(errors);
            
        } catch (Exception e) {
            logger.error("ETL任务执行失败: {}", e.getMessage(), e);
            result.setStatus(ETLStatus.FAILED);
            result.setErrorMessage(e.getMessage());
        } finally {
            result.setEndTime(LocalDateTime.now());
            result.setDuration(Duration.between(result.getStartTime(), result.getEndTime()));
            
            logger.info("ETL任务完成，耗时: {} 秒", result.getDuration().getSeconds());
        }
        
        return result;
    }
}

/**
 * 数据库数据抽取器
 */
public class DatabaseExtractor implements DataExtractor<Map<String, Object>> {
    private final DatabaseConnectionManager dbManager;
    
    public DatabaseExtractor(DatabaseConnectionManager dbManager) {
        this.dbManager = dbManager;
    }
    
    @Override
    public List<Map<String, Object>> extract(ETLConfig config) {
        String sql = config.getExtractSQL();
        List<Object> params = config.getExtractParams();
        
        return dbManager.query(sql, rs -> {
            Map<String, Object> row = new HashMap<>();
            ResultSetMetaData metadata = rs.getMetaData();
            
            for (int i = 1; i <= metadata.getColumnCount(); i++) {
                String columnName = metadata.getColumnName(i);
                Object value = rs.getObject(i);
                row.put(columnName, value);
            }
            
            return row;
        }, params.toArray());
    }
}

/**
 * 数据清洗转换器
 */
public class DataCleaningTransformer implements DataTransformer<Map<String, Object>, CleanedData> {
    private static final Logger logger = LoggerFactory.getLogger(DataCleaningTransformer.class);
    
    @Override
    public List<CleanedData> transform(List<Map<String, Object>> sourceData) {
        return sourceData.stream()
            .map(this::transformSingle)
            .filter(Objects::nonNull)
            .collect(Collectors.toList());
    }
    
    private CleanedData transformSingle(Map<String, Object> source) {
        try {
            CleanedData cleaned = new CleanedData();
            
            // 数据清洗规则
            String name = cleanString((String) source.get("name"));
            if (name == null || name.trim().isEmpty()) {
                logger.warn("姓名为空，跳过记录: {}", source);
                return null;
            }
            
            String email = cleanEmail((String) source.get("email"));
            if (email == null) {
                logger.warn("邮箱格式不正确，跳过记录: {}", source);
                return null;
            }
            
            Integer age = cleanAge(source.get("age"));
            if (age == null || age < 0 || age > 150) {
                logger.warn("年龄不合法，跳过记录: {}", source);
                return null;
            }
            
            // 数据转换
            cleaned.setName(name);
            cleaned.setEmail(email);
            cleaned.setAge(age);
            cleaned.setProcessedTime(LocalDateTime.now());
            
            // 数据增强
            cleaned.setAgeGroup(calculateAgeGroup(age));
            cleaned.setEmailDomain(extractEmailDomain(email));
            
            return cleaned;
            
        } catch (Exception e) {
            logger.error("数据转换失败: {}", e.getMessage(), e);
            return null;
        }
    }
    
    private String cleanString(String str) {
        if (str == null) return null;
        return str.trim().replaceAll("\\s+", " ");
    }
    
    private String cleanEmail(String email) {
        if (email == null) return null;
        email = email.trim().toLowerCase();
        return email.matches("^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$") ? email : null;
    }
    
    private Integer cleanAge(Object ageObj) {
        if (ageObj == null) return null;
        
        try {
            if (ageObj instanceof Integer) {
                return (Integer) ageObj;
            } else if (ageObj instanceof String) {
                return Integer.parseInt(((String) ageObj).trim());
            } else {
                return Integer.parseInt(ageObj.toString());
            }
        } catch (NumberFormatException e) {
            return null;
        }
    }
    
    private String calculateAgeGroup(int age) {
        if (age < 18) return "未成年";
        else if (age < 30) return "青年";
        else if (age < 50) return "中年";
        else return "老年";
    }
    
    private String extractEmailDomain(String email) {
        int atIndex = email.indexOf('@');
        return atIndex > 0 ? email.substring(atIndex + 1) : "";
    }
}
```

## ⚡ 实时数据处理

### 🔄 Kafka消息处理集成

```java
/**
 * Kafka实时数据处理器
 * 支持高吞吐量的实时数据流处理
 */
public class RealTimeDataProcessor {
    private static final Logger logger = LoggerFactory.getLogger(RealTimeDataProcessor.class);
    
    private final KafkaConsumer<String, String> consumer;
    private final DataProcessor dataProcessor;
    private final ResultHandler resultHandler;
    private volatile boolean running = false;
    
    public RealTimeDataProcessor(Properties kafkaConfig, 
                               DataProcessor dataProcessor,
                               ResultHandler resultHandler) {
        this.consumer = new KafkaConsumer<>(kafkaConfig);
        this.dataProcessor = dataProcessor;
        this.resultHandler = resultHandler;
    }
    
    /**
     * 启动实时数据处理
     */
    public void start(List<String> topics) {
        running = true;
        consumer.subscribe(topics);
        
        logger.info("开始实时数据处理，监听主题: {}", topics);
        
        // 创建处理线程池
        ExecutorService executorService = Executors.newFixedThreadPool(
            Runtime.getRuntime().availableProcessors());
        
        try {
            while (running) {
                ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(1000));
                
                if (!records.isEmpty()) {
                    logger.debug("接收到 {} 条消息", records.count());
                    
                    // 按分区分组提交；跨poll批次仍可能并发，当前实现不保证同分区顺序
                    for (TopicPartition partition : records.partitions()) {
                        List<ConsumerRecord<String, String>> partitionRecords = records.records(partition);
                        
                        // 异步处理每个分区的数据
                        executorService.submit(() -> processPartitionRecords(partitionRecords));
                    }
                }
            }
        } catch (WakeupException e) {
            logger.info("收到停止信号，正在停止数据处理...");
        } catch (Exception e) {
            logger.error("实时数据处理异常: {}", e.getMessage(), e);
        } finally {
            consumer.close();
            executorService.shutdown();
            try {
                if (!executorService.awaitTermination(30, TimeUnit.SECONDS)) {
                    executorService.shutdownNow();
                }
            } catch (InterruptedException e) {
                executorService.shutdownNow();
            }
            logger.info("实时数据处理已停止");
        }
    }
    
    /**
     * 处理分区内的消息记录
     */
    private void processPartitionRecords(List<ConsumerRecord<String, String>> records) {
        try {
            List<ProcessedData> processedBatch = new ArrayList<>();
            
            for (ConsumerRecord<String, String> record : records) {
                try {
                    // 解析JSON数据
                    ObjectMapper mapper = new ObjectMapper();
                    RawData rawData = mapper.readValue(record.value(), RawData.class);
                    
                    // 数据处理
                    ProcessedData processed = dataProcessor.process(rawData);
                    if (processed != null) {
                        processedBatch.add(processed);
                    }
                    
                } catch (JsonProcessingException e) {
                    logger.error("JSON解析失败，消息: {}, 错误: {}", record.value(), e.getMessage());
                } catch (DataProcessingException e) {
                    logger.error("数据处理失败，消息: {}, 错误: {}", record.value(), e.getMessage());
                }
            }
            
            // 批量处理结果
            if (!processedBatch.isEmpty()) {
                resultHandler.handleBatch(processedBatch);
                logger.debug("批量处理完成，处理记录数: {}", processedBatch.size());
            }
            
        } catch (Exception e) {
            logger.error("分区数据处理失败: {}", e.getMessage(), e);
        }
    }
    
    /**
     * 停止数据处理
     */
    public void stop() {
        running = false;
        consumer.wakeup();
    }
}

/**
 * 用户行为数据处理器
 */
public class UserBehaviorProcessor implements DataProcessor {
    private static final Logger logger = LoggerFactory.getLogger(UserBehaviorProcessor.class);
    
    @Override
    public ProcessedData process(RawData rawData) {
        try {
            // 数据验证
            if (!isValidUserBehavior(rawData)) {
                logger.warn("无效的用户行为数据: {}", rawData);
                return null;
            }
            
            ProcessedData processed = new ProcessedData();
            
            // 基础信息提取
            processed.setUserId(rawData.getUserId());
            processed.setAction(rawData.getAction());
            processed.setTimestamp(parseTimestamp(rawData.getTimestamp()));
            
            // 数据增强
            processed.setSessionId(extractSessionId(rawData));
            processed.setDeviceType(inferDeviceType(rawData.getUserAgent()));
            processed.setLocation(parseLocation(rawData.getIp()));
            
            // 业务逻辑处理
            processed.setActionScore(calculateActionScore(rawData.getAction()));
            processed.setRiskLevel(assessRiskLevel(rawData));
            
            // 实时统计更新
            updateRealtimeStats(processed);
            
            return processed;
            
        } catch (Exception e) {
            logger.error("用户行为数据处理失败: {}", e.getMessage(), e);
            return null;
        }
    }
    
    private boolean isValidUserBehavior(RawData data) {
        return data.getUserId() != null && 
               !data.getUserId().trim().isEmpty() &&
               data.getAction() != null &&
               data.getTimestamp() != null;
    }
    
    private LocalDateTime parseTimestamp(String timestamp) {
        try {
            return LocalDateTime.parse(timestamp, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (DateTimeParseException e) {
            return LocalDateTime.now();
        }
    }
    
    private String extractSessionId(RawData data) {
        // 从请求头或Cookie中提取会话ID
        Map<String, String> headers = data.getHeaders();
        return headers != null ? headers.get("session-id") : generateSessionId();
    }
    
    private String generateSessionId() {
        return UUID.randomUUID().toString();
    }
    
    private int calculateActionScore(String action) {
        // 根据用户行为类型计算分值
        switch (action.toLowerCase()) {
            case "login": return 10;
            case "view": return 1;
            case "click": return 2;
            case "purchase": return 50;
            case "share": return 15;
            default: return 0;
        }
    }
    
    private String assessRiskLevel(RawData data) {
        // 简单的风险评估逻辑
        int score = 0;
        
        // 检查IP地址
        if (isHighRiskIP(data.getIp())) {
            score += 30;
        }
        
        // 检查用户行为频率
        if (isHighFrequencyUser(data.getUserId())) {
            score += 20;
        }
        
        // 检查异常时间
        if (isOffHours(data.getTimestamp())) {
            score += 10;
        }
        
        if (score >= 50) return "HIGH";
        else if (score >= 30) return "MEDIUM";
        else return "LOW";
    }
}
```

## 🏗️ 数据服务API开发

### 🌐 RESTful数据服务

```java
/**
 * 数据查询API控制器
 * 提供RESTful接口访问数据服务
 */
@RestController
@RequestMapping("/api/v1/data")
@Slf4j
public class DataQueryController {
    
    private final DataQueryService dataQueryService;
    private final CacheManager cacheManager;
    
    public DataQueryController(DataQueryService dataQueryService, CacheManager cacheManager) {
        this.dataQueryService = dataQueryService;
        this.cacheManager = cacheManager;
    }
    
    /**
     * 用户数据查询接口
     */
    @GetMapping("/users")
    public ResponseEntity<ApiResponse<PageResult<UserData>>> queryUsers(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) Integer minAge,
            @RequestParam(required = false) Integer maxAge) {
        
        try {
            // 构建查询条件
            UserQueryCondition condition = UserQueryCondition.builder()
                .name(name)
                .email(email)
                .minAge(minAge)
                .maxAge(maxAge)
                .build();
            
            // 分页查询
            PageResult<UserData> result = dataQueryService.queryUsers(condition, page, size);
            
            return ResponseEntity.ok(ApiResponse.success(result));
            
        } catch (Exception e) {
            log.error("用户查询失败: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("查询失败: " + e.getMessage()));
        }
    }
    
    /**
     * 用户行为统计接口
     */
    @GetMapping("/users/{userId}/behavior-stats")
    @Cacheable(value = "user-behavior-stats", key = "#userId + '_' + #startDate + '_' + #endDate")
    public ResponseEntity<ApiResponse<UserBehaviorStats>> getUserBehaviorStats(
            @PathVariable String userId,
            @RequestParam String startDate,
            @RequestParam String endDate) {
        
        try {
            LocalDate start = LocalDate.parse(startDate);
            LocalDate end = LocalDate.parse(endDate);
            
            // 验证日期范围
            if (start.isAfter(end)) {
                return ResponseEntity.badRequest()
                    .body(ApiResponse.error("开始日期不能晚于结束日期"));
            }
            
            if (ChronoUnit.DAYS.between(start, end) > 90) {
                return ResponseEntity.badRequest()
                    .body(ApiResponse.error("查询时间范围不能超过90天"));
            }
            
            UserBehaviorStats stats = dataQueryService.getUserBehaviorStats(userId, start, end);
            return ResponseEntity.ok(ApiResponse.success(stats));
            
        } catch (DateTimeParseException e) {
            return ResponseEntity.badRequest()
                .body(ApiResponse.error("日期格式错误，请使用YYYY-MM-DD格式"));
        } catch (Exception e) {
            log.error("用户行为统计查询失败: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("查询失败: " + e.getMessage()));
        }
    }
    
    /**
     * 数据导出接口
     */
    @PostMapping("/export")
    public ResponseEntity<?> exportData(@RequestBody DataExportRequest request) {
        try {
            // 验证导出请求
            if (!isValidExportRequest(request)) {
                return ResponseEntity.badRequest()
                    .body(ApiResponse.error("导出请求参数不合法"));
            }
            
            // 异步导出处理
            String taskId = dataQueryService.submitExportTask(request);
            
            Map<String, String> response = new HashMap<>();
            response.put("taskId", taskId);
            response.put("status", "SUBMITTED");
            response.put("message", "导出任务已提交，请使用taskId查询进度");
            
            return ResponseEntity.accepted().body(ApiResponse.success(response));
            
        } catch (Exception e) {
            log.error("数据导出失败: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("导出失败: " + e.getMessage()));
        }
    }
    
    /**
     * 导出任务状态查询
     */
    @GetMapping("/export/{taskId}/status")
    public ResponseEntity<ApiResponse<ExportTaskStatus>> getExportStatus(@PathVariable String taskId) {
        try {
            ExportTaskStatus status = dataQueryService.getExportTaskStatus(taskId);
            
            if (status == null) {
                return ResponseEntity.notFound().build();
            }
            
            return ResponseEntity.ok(ApiResponse.success(status));
            
        } catch (Exception e) {
            log.error("查询导出任务状态失败: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("查询失败: " + e.getMessage()));
        }
    }
}

/**
 * 数据查询服务实现
 */
@Service
@Transactional(readOnly = true)
public class DataQueryServiceImpl implements DataQueryService {
    private static final Logger log = LoggerFactory.getLogger(DataQueryServiceImpl.class);
    
    private final UserDAO userDAO;
    private final BehaviorDAO behaviorDAO;
    private final ExecutorService exportExecutor;
    private final Map<String, ExportTask> exportTasks = new ConcurrentHashMap<>();
    
    public DataQueryServiceImpl(UserDAO userDAO, BehaviorDAO behaviorDAO) {
        this.userDAO = userDAO;
        this.behaviorDAO = behaviorDAO;
        this.exportExecutor = Executors.newFixedThreadPool(5);
    }
    
    @Override
    public PageResult<UserData> queryUsers(UserQueryCondition condition, int page, int size) {
        // 构建动态SQL查询
        StringBuilder sqlBuilder = new StringBuilder("SELECT * FROM users WHERE 1=1");
        List<Object> params = new ArrayList<>();
        
        if (condition.getName() != null && !condition.getName().trim().isEmpty()) {
            sqlBuilder.append(" AND name LIKE ?");
            params.add("%" + condition.getName().trim() + "%");
        }
        
        if (condition.getEmail() != null && !condition.getEmail().trim().isEmpty()) {
            sqlBuilder.append(" AND email LIKE ?");
            params.add("%" + condition.getEmail().trim() + "%");
        }
        
        if (condition.getMinAge() != null) {
            sqlBuilder.append(" AND age >= ?");
            params.add(condition.getMinAge());
        }
        
        if (condition.getMaxAge() != null) {
            sqlBuilder.append(" AND age <= ?");
            params.add(condition.getMaxAge());
        }
        
        sqlBuilder.append(" ORDER BY created_time DESC");
        
        // 执行分页查询
        return userDAO.queryByPage(sqlBuilder.toString(), params, page, size);
    }
    
    @Override
    public UserBehaviorStats getUserBehaviorStats(String userId, LocalDate startDate, LocalDate endDate) {
        // 查询用户行为数据
        List<UserBehavior> behaviors = behaviorDAO.findByUserIdAndDateRange(userId, startDate, endDate);
        
        // 统计分析
        UserBehaviorStats stats = new UserBehaviorStats();
        stats.setUserId(userId);
        stats.setStartDate(startDate);
        stats.setEndDate(endDate);
        stats.setTotalActions(behaviors.size());
        
        // 按行为类型分组统计
        Map<String, Long> actionCounts = behaviors.stream()
            .collect(Collectors.groupingBy(UserBehavior::getAction, Collectors.counting()));
        stats.setActionCounts(actionCounts);
        
        // 按日期分组统计
        Map<LocalDate, Long> dailyCounts = behaviors.stream()
            .collect(Collectors.groupingBy(
                behavior -> behavior.getTimestamp().toLocalDate(),
                Collectors.counting()));
        stats.setDailyCounts(dailyCounts);
        
        // 活跃时段统计
        Map<Integer, Long> hourlyCounts = behaviors.stream()
            .collect(Collectors.groupingBy(
                behavior -> behavior.getTimestamp().getHour(),
                Collectors.counting()));
        stats.setHourlyCounts(hourlyCounts);
        
        return stats;
    }
    
    @Override
    public String submitExportTask(DataExportRequest request) {
        String taskId = UUID.randomUUID().toString();
        ExportTask task = new ExportTask(taskId, request);
        exportTasks.put(taskId, task);
        
        // 异步执行导出任务
        exportExecutor.submit(() -> executeExportTask(task));
        
        log.info("提交导出任务: {}, 类型: {}", taskId, request.getExportType());
        return taskId;
    }
    
    private void executeExportTask(ExportTask task) {
        try {
            task.setStatus(ExportStatus.RUNNING);
            task.setStartTime(LocalDateTime.now());
            
            log.info("开始执行导出任务: {}", task.getTaskId());
            
            // 根据导出类型执行不同的导出逻辑
            switch (task.getRequest().getExportType()) {
                case "USER_DATA":
                    exportUserData(task);
                    break;
                case "BEHAVIOR_DATA":
                    exportBehaviorData(task);
                    break;
                default:
                    throw new UnsupportedOperationException("不支持的导出类型: " + task.getRequest().getExportType());
            }
            
            task.setStatus(ExportStatus.COMPLETED);
            task.setEndTime(LocalDateTime.now());
            
            log.info("导出任务完成: {}, 耗时: {} 秒", 
                task.getTaskId(), 
                Duration.between(task.getStartTime(), task.getEndTime()).getSeconds());
            
        } catch (Exception e) {
            log.error("导出任务执行失败: {}", task.getTaskId(), e);
            task.setStatus(ExportStatus.FAILED);
            task.setErrorMessage(e.getMessage());
            task.setEndTime(LocalDateTime.now());
        }
    }
}
```

## 🚀 性能优化与监控

### ⚡ JVM性能调优

```java
/**
 * 性能监控和指标收集
 */
@Component
public class PerformanceMonitor {
    private static final Logger logger = LoggerFactory.getLogger(PerformanceMonitor.class);
    
    private final MeterRegistry meterRegistry;
    private final MemoryMXBean memoryBean;
    private final List<GarbageCollectorMXBean> gcBeans;
    
    public PerformanceMonitor(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        this.memoryBean = ManagementFactory.getMemoryMXBean();
        this.gcBeans = ManagementFactory.getGarbageCollectorMXBeans();
        
        // 注册JVM指标监控
        registerJVMMetrics();
    }
    
    private void registerJVMMetrics() {
        // 内存使用监控
        Gauge.builder("jvm.memory.heap.used", this,
                monitor -> monitor.memoryBean.getHeapMemoryUsage().getUsed())
            .register(meterRegistry);
        
        Gauge.builder("jvm.memory.heap.max", this,
                monitor -> monitor.memoryBean.getHeapMemoryUsage().getMax())
            .register(meterRegistry);
        
        Gauge.builder("jvm.memory.nonheap.used", this,
                monitor -> monitor.memoryBean.getNonHeapMemoryUsage().getUsed())
            .register(meterRegistry);
        
        // GC监控
        for (GarbageCollectorMXBean gcBean : gcBeans) {
            Gauge.builder("jvm.gc.collection.count", gcBean, GarbageCollectorMXBean::getCollectionCount)
                .tag("gc", gcBean.getName())
                .register(meterRegistry);
            
            Gauge.builder("jvm.gc.collection.time", gcBean, GarbageCollectorMXBean::getCollectionTime)
                .tag("gc", gcBean.getName())
                .register(meterRegistry);
        }
    }
    
    /**
     * 数据库连接池监控
     */
    public void monitorConnectionPool(HikariDataSource dataSource, String poolName) {
        // 在连接池已初始化且未关闭时注册、采集这些指标
        Gauge.builder("hikari.connections.active", dataSource,
                ds -> ds.getHikariPoolMXBean().getActiveConnections())
            .tag("pool", poolName)
            .register(meterRegistry);
        
        Gauge.builder("hikari.connections.idle", dataSource,
                ds -> ds.getHikariPoolMXBean().getIdleConnections())
            .tag("pool", poolName)
            .register(meterRegistry);
        
        Gauge.builder("hikari.connections.total", dataSource,
                ds -> ds.getHikariPoolMXBean().getTotalConnections())
            .tag("pool", poolName)
            .register(meterRegistry);
    }
    
    /**
     * 应用性能指标统计
     */
    @EventListener
    public void handleApplicationEvent(ApplicationEvent event) {
        if (event instanceof DataProcessingEvent) {
            DataProcessingEvent dpEvent = (DataProcessingEvent) event;
            
            Timer.Sample sample = Timer.start(meterRegistry);
            sample.stop(Timer.builder("data.processing.time")
                .tag("type", dpEvent.getProcessType())
                .register(meterRegistry));
            
            Counter.builder("data.processing.count")
                .tag("type", dpEvent.getProcessType())
                .tag("status", dpEvent.getStatus())
                .register(meterRegistry)
                .increment();
        }
    }
}

/**
 * 缓存管理器
 */
@Component
public class CacheManager {
    private static final Logger logger = LoggerFactory.getLogger(CacheManager.class);
    
    private final Cache<String, Object> cache;
    private final Timer cacheTimer;
    private final Counter cacheHitCounter;
    private final Counter cacheMissCounter;
    
    public CacheManager(MeterRegistry meterRegistry) {
        // 配置Caffeine缓存
        this.cache = Caffeine.newBuilder()
            .maximumSize(10000)
            .expireAfterWrite(Duration.ofMinutes(30))
            .expireAfterAccess(Duration.ofMinutes(10))
            .recordStats()
            .build();
        
        // 缓存指标监控
        this.cacheTimer = Timer.builder("cache.operation.time").register(meterRegistry);
        this.cacheHitCounter = Counter.builder("cache.hit").register(meterRegistry);
        this.cacheMissCounter = Counter.builder("cache.miss").register(meterRegistry);
        
        // 定期输出缓存统计
        scheduleCacheStatsLogging();
    }
    
    public <T> T get(String key, Class<T> type, Supplier<T> valueLoader) {
        Timer.Sample sample = Timer.start();
        
        try {
            Object cached = cache.getIfPresent(key);
            
            if (cached != null) {
                cacheHitCounter.increment();
                logger.debug("缓存命中: {}", key);
                return type.cast(cached);
            } else {
                cacheMissCounter.increment();
                logger.debug("缓存未命中，加载数据: {}", key);
                
                T value = valueLoader.get();
                if (value != null) {
                    cache.put(key, value);
                }
                return value;
            }
        } finally {
            sample.stop(cacheTimer);
        }
    }
    
    public void put(String key, Object value) {
        cache.put(key, value);
        logger.debug("缓存写入: {}", key);
    }
    
    public void evict(String key) {
        cache.invalidate(key);
        logger.debug("缓存删除: {}", key);
    }
    
    public void clear() {
        cache.invalidateAll();
        logger.info("缓存已清空");
    }
    
    private void scheduleCacheStatsLogging() {
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
        scheduler.scheduleAtFixedRate(() -> {
            CacheStats stats = cache.stats();
            logger.info("缓存统计 - 命中率: {}%, 缓存内部统计加载次数: {}, 驱逐次数: {}", 
                stats.hitRate() * 100,
                stats.loadCount(),
                stats.evictionCount());
        }, 1, 5, TimeUnit.MINUTES);
    }
}
```

---

> [!quote] 💭 Java数据开发实践心得
> 
> 🎯 **架构设计**：合理的分层架构是高质量数据应用的基础
> 💪 **性能优化**：关注数据库连接池、缓存策略和并发处理
> 🔍 **监控告警**：完善的监控体系帮助及时发现和解决问题
> 🛠️ **工程实践**：重视代码质量、测试覆盖和文档完善

## 相关学习资源

### 继续学习
- **学习路线图**：[[【技术与工具】/Java/00-Java学习路线图|Java]]
- **数据处理与文件IO**：[[【技术与工具】/Java/04-Java数据处理与文件IO|Java数据处理与文件IO]]
- **Java大数据技术栈**：[[【技术与工具】/Java/06-Java大数据技术栈|Java大数据技术栈]]
- **数据库操作与数据仓库开发**：[[【技术与工具】/Java/07-Java数据库操作与数据仓库开发|Java数据库操作与数据仓库开发]]

### 配套技术栈
- **分布式存储与计算**：[[【技术与工具】/Hadoop/00-Hadoop学习路线图|Hadoop/Hadoop]]
- **大数据处理引擎**：[[【技术与工具】/Spark/00-Spark学习路线图|Spark/Spark]]
- **流式数据处理**：[[【技术与工具】/Flink/00-Flink学习路线图|Flink/Flink]]

> [!tip] 🌟 实践建议
> 
> Java在数据开发中的应用需要深厚的基础知识和丰富的实践经验。建议从简单的数据处理项目开始，逐步掌握性能优化、并发处理和大数据框架集成等高级技能。重视工程实践，关注代码质量和系统可维护性。