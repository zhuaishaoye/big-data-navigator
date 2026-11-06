---
title: Java数据库操作与数据仓库开发 - 企业级数据存储解决方案
type: 技术教程
tags:
  - Java
  - 数据库
  - 数据仓库
  - JDBC
  - MyBatis
  - 数据建模
difficulty: 高级
duration: 150分钟
created: 2024-12
updated: 2026-10-10
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据治理工程师
  - BI分析师
  - 数据分析师
stability: slow-changing
status: maintenance
access_tier: free
---


# Java数据库操作与数据仓库开发 - 企业级数据存储解决方案

> [!abstract] 📋 Java数据库与数据仓库开发概览
> 
> 🔍 **为什么数据库操作是数据开发的核心？**
> 数据库操作是数据开发工作的基础，无论是OLTP业务系统还是OLAP分析系统，都需要高效、可靠的数据存储和访问机制。Java作为企业级开发的主流语言，提供了丰富的数据库操作框架和工具。
> 
> 🎯 **本教程将帮助你掌握**：
> - 🔗 **JDBC高级应用**：连接池管理、事务处理、批量操作优化
> - 🏗️ **MyBatis应用示例**：动态SQL、查询服务与Redis结果缓存
> - 🏢 **数据仓库设计**：维度建模、ETL开发、数据质量管理
> - 📊 **分析型数据库**：ClickHouse、Doris等OLAP引擎集成
> - ⚡ **性能优化实战**：SQL调优、索引设计、分库分表策略
> 
> ⏱️ **预计学习时长**：约150分钟阅读与练习示例；补全工程、验证兼容性和掌握相关技能需另行安排时间

## 🔗 JDBC高级应用与优化

### 💎 企业级数据库连接管理

现代企业应用中，数据库连接管理是性能和稳定性的关键：

```java
/**
 * 企业级数据库连接管理器
 * 支持多数据源、读写分离、故障转移
 */
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class MultiDataSourceManager {
    private static final Logger logger = LoggerFactory.getLogger(MultiDataSourceManager.class);
    
    private final Map<String, HikariDataSource> dataSources = new ConcurrentHashMap<>();
    private final DataSourceRouter dataSourceRouter;
    private final DataSourceHealthChecker healthChecker;
    
    public MultiDataSourceManager(DataSourceConfig config) {
        this.dataSourceRouter = new DataSourceRouter();
        this.healthChecker = new DataSourceHealthChecker();
        
        initializeDataSources(config);
        startHealthCheck();
    }
    
    /**
     * 初始化多数据源
     */
    private void initializeDataSources(DataSourceConfig config) {
        // 主库配置
        HikariDataSource masterDS = createDataSource(config.getMaster(), "master");
        dataSources.put("master", masterDS);
        
        // 从库配置
        config.getSlaves().forEach((name, slaveConfig) -> {
            HikariDataSource slaveDS = createDataSource(slaveConfig, name);
            dataSources.put(name, slaveDS);
        });
        
        // 分析库配置
        if (config.getAnalytical() != null) {
            HikariDataSource analyticalDS = createDataSource(config.getAnalytical(), "analytical");
            dataSources.put("analytical", analyticalDS);
        }
        
        logger.info("数据源初始化完成，总数: {}", dataSources.size());
    }
    
    /**
     * 创建数据源
     */
    private HikariDataSource createDataSource(DatabaseConfig dbConfig, String name) {
        HikariConfig config = new HikariConfig();
        
        // 基础连接配置
        config.setJdbcUrl(dbConfig.getUrl());
        config.setUsername(dbConfig.getUsername());
        config.setPassword(dbConfig.getPassword());
        config.setDriverClassName(dbConfig.getDriverClassName());
        
        // 连接池配置
        config.setMaximumPoolSize(dbConfig.getMaxPoolSize());
        config.setMinimumIdle(dbConfig.getMinIdle());
        config.setConnectionTimeout(30000);  // 30秒连接超时
        config.setIdleTimeout(600000);       // 10分钟空闲超时
        config.setMaxLifetime(1800000);      // 30分钟最大生存时间
        config.setLeakDetectionThreshold(60000);  // 1分钟泄漏检测
        
        // 连接测试配置
        config.setConnectionTestQuery("SELECT 1");
        config.setValidationTimeout(5000);
        
        // 性能优化配置
        config.addDataSourceProperty("cachePrepStmts", "true");
        config.addDataSourceProperty("prepStmtCacheSize", "250");
        config.addDataSourceProperty("prepStmtCacheSqlLimit", "2048");
        config.addDataSourceProperty("useServerPrepStmts", "true");
        config.addDataSourceProperty("useLocalSessionState", "true");
        config.addDataSourceProperty("rewriteBatchedStatements", "true");
        config.addDataSourceProperty("cacheResultSetMetadata", "true");
        config.addDataSourceProperty("cacheServerConfiguration", "true");
        config.addDataSourceProperty("elideSetAutoCommits", "true");
        config.addDataSourceProperty("maintainTimeStats", "false");
        
        config.setPoolName(name + "-pool");
        
        HikariDataSource dataSource = new HikariDataSource(config);
        logger.info("数据源创建成功: {}, URL: {}", name, dbConfig.getUrl());
        
        return dataSource;
    }
    
    /**
     * 获取数据库连接（智能路由）
     */
    public Connection getConnection(DataSourceType type, String hint) throws SQLException {
        String dataSourceName = dataSourceRouter.route(type, hint, getAvailableDataSources());
        
        HikariDataSource dataSource = dataSources.get(dataSourceName);
        if (dataSource == null) {
            throw new SQLException("数据源不存在: " + dataSourceName);
        }
        
        try {
            Connection connection = dataSource.getConnection();
            logger.debug("获取数据库连接成功: {}", dataSourceName);
            return connection;
        } catch (SQLException e) {
            logger.error("获取数据库连接失败: {}", dataSourceName, e);
            
            // 故障转移逻辑
            return handleConnectionFailure(type, dataSourceName, e);
        }
    }
    
    /**
     * 处理连接失败的故障转移
     */
    private Connection handleConnectionFailure(DataSourceType type, String failedDataSource, SQLException originalException) throws SQLException {
        logger.warn("数据源连接失败，尝试故障转移: {}", failedDataSource);
        
        // 标记故障数据源
        healthChecker.markAsUnhealthy(failedDataSource);
        
        // 获取备用数据源
        String fallbackDataSource = dataSourceRouter.getFallback(type, failedDataSource, getAvailableDataSources());
        
        if (fallbackDataSource != null) {
            HikariDataSource fallbackDS = dataSources.get(fallbackDataSource);
            try {
                Connection connection = fallbackDS.getConnection();
                logger.info("故障转移成功: {} -> {}", failedDataSource, fallbackDataSource);
                return connection;
            } catch (SQLException e) {
                logger.error("故障转移失败: {}", fallbackDataSource, e);
            }
        }
        
        // 所有数据源都不可用
        throw new SQLException("所有数据源都不可用", originalException);
    }
    
    /**
     * 批量数据库操作支持
     */
    public <T> BatchResult<T> executeBatch(DataSourceType type, String sql, List<T> data, BatchProcessor<T> processor) {
        BatchResult<T> result = new BatchResult<>();
        result.setStartTime(LocalDateTime.now());
        
        try (Connection conn = getConnection(type, "batch-operation")) {
            conn.setAutoCommit(false);  // 开启事务
            
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                int batchSize = 1000;  // 批处理大小
                int processedCount = 0;
                List<T> currentBatch = new ArrayList<>();
                
                for (T item : data) {
                    currentBatch.add(item);
                    
                    if (currentBatch.size() >= batchSize) {
                        int batchResult = processBatch(stmt, currentBatch, processor);
                        processedCount += batchResult;
                        currentBatch.clear();
                        
                        logger.debug("批处理进度: {}/{}", processedCount, data.size());
                    }
                }
                
                // 处理剩余数据
                if (!currentBatch.isEmpty()) {
                    int batchResult = processBatch(stmt, currentBatch, processor);
                    processedCount += batchResult;
                }
                
                conn.commit();  // 提交事务
                result.setSuccessCount(processedCount);
                result.setStatus(BatchStatus.SUCCESS);
                
                logger.info("批量操作成功，处理记录数: {}", processedCount);
                
            } catch (SQLException e) {
                conn.rollback();  // 回滚事务
                logger.error("批量操作失败，执行回滚: {}", e.getMessage(), e);
                result.setStatus(BatchStatus.FAILED);
                result.setErrorMessage(e.getMessage());
                throw e;
            }
            
        } catch (SQLException e) {
            logger.error("批量操作异常: {}", e.getMessage(), e);
            result.setStatus(BatchStatus.ERROR);
            result.setErrorMessage(e.getMessage());
        } finally {
            result.setEndTime(LocalDateTime.now());
            result.setDuration(Duration.between(result.getStartTime(), result.getEndTime()));
        }
        
        return result;
    }
    
    /**
     * 处理单个批次
     */
    private <T> int processBatch(PreparedStatement stmt, List<T> batch, BatchProcessor<T> processor) throws SQLException {
        for (T item : batch) {
            processor.setParameters(stmt, item);
            stmt.addBatch();
        }
        
        int[] results = stmt.executeBatch();
        stmt.clearBatch();
        
        return Arrays.stream(results).sum();
    }
    
    /**
     * 数据源健康检查
     */
    private void startHealthCheck() {
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
        
        scheduler.scheduleAtFixedRate(() -> {
            for (Map.Entry<String, HikariDataSource> entry : dataSources.entrySet()) {
                String name = entry.getKey();
                HikariDataSource dataSource = entry.getValue();
                
                try (Connection conn = dataSource.getConnection()) {
                    conn.createStatement().execute("SELECT 1");
                    healthChecker.markAsHealthy(name);
                } catch (SQLException e) {
                    logger.warn("数据源健康检查失败: {}", name);
                    healthChecker.markAsUnhealthy(name);
                }
            }
        }, 30, 30, TimeUnit.SECONDS);  // 每30秒检查一次
        
        logger.info("数据源健康检查启动");
    }
    
    /**
     * 获取可用数据源列表
     */
    private Set<String> getAvailableDataSources() {
        return dataSources.entrySet().stream()
            .filter(entry -> healthChecker.isHealthy(entry.getKey()))
            .map(Map.Entry::getKey)
            .collect(Collectors.toSet());
    }
    
    /**
     * 获取数据源统计信息
     */
    public Map<String, DataSourceStats> getDataSourceStats() {
        Map<String, DataSourceStats> stats = new HashMap<>();
        
        for (Map.Entry<String, HikariDataSource> entry : dataSources.entrySet()) {
            String name = entry.getKey();
            HikariDataSource dataSource = entry.getValue();
            
            DataSourceStats stat = new DataSourceStats();
            stat.setName(name);
            stat.setActiveConnections(dataSource.getHikariPoolMXBean().getActiveConnections());
            stat.setIdleConnections(dataSource.getHikariPoolMXBean().getIdleConnections());
            stat.setTotalConnections(dataSource.getHikariPoolMXBean().getTotalConnections());
            stat.setThreadsAwaitingConnection(dataSource.getHikariPoolMXBean().getThreadsAwaitingConnection());
            stat.setHealthy(healthChecker.isHealthy(name));
            
            stats.put(name, stat);
        }
        
        return stats;
    }
    
    /**
     * 关闭所有数据源
     */
    @PreDestroy
    public void shutdown() {
        dataSources.values().forEach(dataSource -> {
            try {
                if (!dataSource.isClosed()) {
                    dataSource.close();
                }
            } catch (Exception e) {
                logger.error("关闭数据源异常", e);
            }
        });
        
        logger.info("所有数据源已关闭");
    }
}

/**
 * 数据源路由器
 */
public class DataSourceRouter {
    private static final Logger logger = LoggerFactory.getLogger(DataSourceRouter.class);
    
    private final LoadBalancer loadBalancer = new RoundRobinLoadBalancer();
    
    /**
     * 路由到合适的数据源
     */
    public String route(DataSourceType type, String hint, Set<String> availableDataSources) {
        switch (type) {
            case MASTER:
                return routeToMaster(availableDataSources);
            case SLAVE:
                return routeToSlave(hint, availableDataSources);
            case ANALYTICAL:
                return routeToAnalytical(availableDataSources);
            default:
                throw new IllegalArgumentException("不支持的数据源类型: " + type);
        }
    }
    
    private String routeToMaster(Set<String> availableDataSources) {
        if (availableDataSources.contains("master")) {
            return "master";
        }
        throw new RuntimeException("主数据源不可用");
    }
    
    private String routeToSlave(String hint, Set<String> availableDataSources) {
        // 优先使用提示的数据源
        if (hint != null && availableDataSources.contains(hint)) {
            return hint;
        }
        
        // 从可用的从库中选择
        List<String> slaves = availableDataSources.stream()
            .filter(name -> name.startsWith("slave"))
            .collect(Collectors.toList());
        
        if (!slaves.isEmpty()) {
            return loadBalancer.select(slaves);
        }
        
        // 降级到主库
        logger.warn("所有从库不可用，降级到主库");
        return routeToMaster(availableDataSources);
    }
    
    private String routeToAnalytical(Set<String> availableDataSources) {
        if (availableDataSources.contains("analytical")) {
            return "analytical";
        }
        
        // 降级到从库
        logger.warn("分析库不可用，降级到从库");
        return routeToSlave(null, availableDataSources);
    }
    
    /**
     * 获取故障转移数据源
     */
    public String getFallback(DataSourceType type, String failedDataSource, Set<String> availableDataSources) {
        switch (type) {
            case MASTER:
                // 主库故障，没有备选方案
                return null;
            case SLAVE:
                // 从库故障，选择其他从库或主库
                List<String> otherSlaves = availableDataSources.stream()
                    .filter(name -> name.startsWith("slave") && !name.equals(failedDataSource))
                    .collect(Collectors.toList());
                
                if (!otherSlaves.isEmpty()) {
                    return loadBalancer.select(otherSlaves);
                } else if (availableDataSources.contains("master")) {
                    return "master";
                }
                return null;
            case ANALYTICAL:
                // 分析库故障，降级到从库
                return routeToSlave(null, availableDataSources);
            default:
                return null;
        }
    }
}

/**
 * 批处理器接口
 */
@FunctionalInterface
public interface BatchProcessor<T> {
    void setParameters(PreparedStatement stmt, T item) throws SQLException;
}

/**
 * 数据源类型枚举
 */
public enum DataSourceType {
    MASTER,     // 主库（读写）
    SLAVE,      // 从库（只读）
    ANALYTICAL  // 分析库（OLAP）
}
```

## 🏗️ MyBatis企业级应用

### 📋 动态SQL与复杂查询

```java
/**
 * 数据查询服务实现
 * 基于MyBatis的复杂查询和动态SQL处理
 */
@Service
@Transactional(readOnly = true)
public class DataQueryServiceImpl implements DataQueryService {
    private static final Logger logger = LoggerFactory.getLogger(DataQueryServiceImpl.class);
    
    private final UserMapper userMapper;
    private final OrderMapper orderMapper;
    private final AnalyticsMapper analyticsMapper;
    private final RedisTemplate<String, Object> redisTemplate;
    
    public DataQueryServiceImpl(UserMapper userMapper, OrderMapper orderMapper, 
                              AnalyticsMapper analyticsMapper, RedisTemplate<String, Object> redisTemplate) {
        this.userMapper = userMapper;
        this.orderMapper = orderMapper;
        this.analyticsMapper = analyticsMapper;
        this.redisTemplate = redisTemplate;
    }
    
    /**
     * 复杂用户查询
     */
    @Override
    public PageResult<UserDTO> queryUsers(UserQueryCondition condition, PageRequest pageRequest) {
        logger.info("查询用户信息，条件: {}, 分页: {}", condition, pageRequest);
        
        // 缓存键生成
        String cacheKey = generateCacheKey("user_query", condition, pageRequest);
        
        // 尝试从缓存获取
        PageResult<UserDTO> cachedResult = (PageResult<UserDTO>) redisTemplate.opsForValue().get(cacheKey);
        if (cachedResult != null) {
            logger.debug("从缓存获取查询结果: {}", cacheKey);
            return cachedResult;
        }
        
        // 数据库查询
        try {
            // 查询总数
            long totalCount = userMapper.countByCondition(condition);
            
            if (totalCount == 0) {
                return PageResult.empty();
            }
            
            // 计算分页参数
            int offset = (pageRequest.getPage() - 1) * pageRequest.getSize();
            condition.setOffset(offset);
            condition.setLimit(pageRequest.getSize());
            
            // 查询数据
            List<User> users = userMapper.selectByCondition(condition);
            
            // 转换为DTO
            List<UserDTO> userDTOs = users.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
            
            // 构建分页结果
            PageResult<UserDTO> result = new PageResult<>(
                userDTOs, totalCount, pageRequest.getPage(), pageRequest.getSize());
            
            // 缓存结果（5分钟）
            redisTemplate.opsForValue().set(cacheKey, result, Duration.ofMinutes(5));
            
            logger.info("用户查询完成，总数: {}, 返回: {}", totalCount, userDTOs.size());
            return result;
            
        } catch (Exception e) {
            logger.error("用户查询失败: {}", e.getMessage(), e);
            throw new DataQueryException("用户查询失败", e);
        }
    }
    
    /**
     * 用户行为分析查询
     */
    @Override
    public UserBehaviorReport getUserBehaviorReport(String userId, LocalDate startDate, LocalDate endDate) {
        logger.info("生成用户行为报告: userId={}, 时间范围: {} - {}", userId, startDate, endDate);
        
        try {
            UserBehaviorReport report = new UserBehaviorReport();
            report.setUserId(userId);
            report.setStartDate(startDate);
            report.setEndDate(endDate);
            report.setGeneratedTime(LocalDateTime.now());
            
            // 基础统计
            UserBehaviorStats basicStats = analyticsMapper.getUserBasicStats(userId, startDate, endDate);
            report.setBasicStats(basicStats);
            
            // 行为分布
            List<ActionDistribution> actionDistribution = analyticsMapper.getUserActionDistribution(userId, startDate, endDate);
            report.setActionDistribution(actionDistribution);
            
            // 时间分布
            List<HourlyActivity> hourlyActivity = analyticsMapper.getUserHourlyActivity(userId, startDate, endDate);
            report.setHourlyActivity(hourlyActivity);
            
            // 页面访问TOP10
            List<PageView> topPages = analyticsMapper.getUserTopPages(userId, startDate, endDate, 10);
            report.setTopPages(topPages);
            
            // 设备类型分布
            List<DeviceDistribution> deviceDistribution = analyticsMapper.getUserDeviceDistribution(userId, startDate, endDate);
            report.setDeviceDistribution(deviceDistribution);
            
            // 会话分析
            SessionAnalysis sessionAnalysis = analyticsMapper.getUserSessionAnalysis(userId, startDate, endDate);
            report.setSessionAnalysis(sessionAnalysis);
            
            logger.info("用户行为报告生成完成: {}", userId);
            return report;
            
        } catch (Exception e) {
            logger.error("用户行为报告生成失败: {}", e.getMessage(), e);
            throw new DataQueryException("用户行为报告生成失败", e);
        }
    }
    
    /**
     * 多维度数据聚合查询
     */
    @Override
    public List<AggregationResult> getMultiDimensionAggregation(AggregationQuery query) {
        logger.info("执行多维度聚合查询: {}", query);
        
        try {
            // 验证查询参数
            validateAggregationQuery(query);
            
            // 根据聚合类型选择不同的查询方法
            List<AggregationResult> results;
            
            switch (query.getAggregationType()) {
                case TIME_SERIES:
                    results = analyticsMapper.getTimeSeriesAggregation(query);
                    break;
                case GEOGRAPHIC:
                    results = analyticsMapper.getGeographicAggregation(query);
                    break;
                case CATEGORICAL:
                    results = analyticsMapper.getCategoricalAggregation(query);
                    break;
                case CUSTOM:
                    results = analyticsMapper.getCustomAggregation(query);
                    break;
                default:
                    throw new IllegalArgumentException("不支持的聚合类型: " + query.getAggregationType());
            }
            
            // 后处理结果
            results = postProcessAggregationResults(results, query);
            
            logger.info("多维度聚合查询完成，结果数量: {}", results.size());
            return results;
            
        } catch (Exception e) {
            logger.error("多维度聚合查询失败: {}", e.getMessage(), e);
            throw new DataQueryException("多维度聚合查询失败", e);
        }
    }
    
    /**
     * 实时数据查询
     */
    @Override
    public RealtimeData getRealtimeData(RealtimeQuery query) {
        logger.debug("查询实时数据: {}", query);
        
        try {
            RealtimeData data = new RealtimeData();
            data.setTimestamp(LocalDateTime.now());
            
            // 实时指标查询
            if (query.getMetrics().contains("active_users")) {
                long activeUsers = analyticsMapper.getActiveUserCount(query.getTimeWindow());
                data.addMetric("active_users", activeUsers);
            }
            
            if (query.getMetrics().contains("page_views")) {
                long pageViews = analyticsMapper.getPageViewCount(query.getTimeWindow());
                data.addMetric("page_views", pageViews);
            }
            
            if (query.getMetrics().contains("orders")) {
                long orders = orderMapper.getRecentOrderCount(query.getTimeWindow());
                data.addMetric("orders", orders);
            }
            
            if (query.getMetrics().contains("revenue")) {
                BigDecimal revenue = orderMapper.getRecentRevenue(query.getTimeWindow());
                data.addMetric("revenue", revenue);
            }
            
            // 实时趋势数据
            if (query.isIncludeTrend()) {
                List<TrendPoint> trend = analyticsMapper.getTrendData(query.getMetrics(), query.getTrendPeriod());
                data.setTrend(trend);
            }
            
            // 实时异常检测
            if (query.isIncludeAnomalies()) {
                List<Anomaly> anomalies = analyticsMapper.detectAnomalies(query.getMetrics(), query.getTimeWindow());
                data.setAnomalies(anomalies);
            }
            
            logger.debug("实时数据查询完成，指标数量: {}", data.getMetrics().size());
            return data;
            
        } catch (Exception e) {
            logger.error("实时数据查询失败: {}", e.getMessage(), e);
            throw new DataQueryException("实时数据查询失败", e);
        }
    }
    
    /**
     * 数据导出查询
     */
    @Override
    @Transactional(readOnly = true, timeout = 3600)  // 1小时超时
    public void exportData(DataExportRequest request, OutputStream outputStream) {
        logger.info("开始数据导出: {}", request);
        
        try {
            // 创建导出处理器
            DataExporter exporter = createDataExporter(request.getFormat(), outputStream);
            
            // 分批查询和导出
            int batchSize = 10000;
            int offset = 0;
            int totalExported = 0;
            
            while (true) {
                // 设置分页参数
                request.setOffset(offset);
                request.setLimit(batchSize);
                
                // 查询数据
                List<Map<String, Object>> batch = queryExportData(request);
                
                if (batch.isEmpty()) {
                    break;
                }
                
                // 导出数据
                exporter.writeBatch(batch);
                
                totalExported += batch.size();
                offset += batchSize;
                
                logger.debug("数据导出进度: {}", totalExported);
                
                // 如果批次小于批处理大小，说明已经是最后一批
                if (batch.size() < batchSize) {
                    break;
                }
            }
            
            // 完成导出
            exporter.finish();
            
            logger.info("数据导出完成，总计: {} 条记录", totalExported);
            
        } catch (Exception e) {
            logger.error("数据导出失败: {}", e.getMessage(), e);
            throw new DataQueryException("数据导出失败", e);
        }
    }
}

/**
 * 用户查询Mapper
 */
@Mapper
public interface UserMapper {
    
    /**
     * 根据条件查询用户总数
     */
    long countByCondition(@Param("condition") UserQueryCondition condition);
    
    /**
     * 根据条件查询用户列表
     */
    List<User> selectByCondition(@Param("condition") UserQueryCondition condition);
    
    /**
     * 批量插入用户
     */
    int batchInsertUsers(@Param("users") List<User> users);
    
    /**
     * 批量更新用户状态
     */
    int batchUpdateUserStatus(@Param("userIds") List<Long> userIds, 
                            @Param("status") UserStatus status,
                            @Param("updateTime") LocalDateTime updateTime);
}
```

### 📄 MyBatis动态SQL映射文件

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" 
    "http://mybatis.org/dtd/mybatis-3-mapper.dtd">

<mapper namespace="com.example.mapper.UserMapper">
    
    <!-- 结果映射 -->
    <resultMap id="UserResultMap" type="com.example.model.User">
        <id property="id" column="id"/>
        <result property="username" column="username"/>
        <result property="email" column="email"/>
        <result property="age" column="age"/>
        <result property="status" column="status" typeHandler="org.apache.ibatis.type.EnumTypeHandler"/>
        <result property="createdTime" column="created_time"/>
        <result property="updatedTime" column="updated_time"/>
        <result property="lastLoginTime" column="last_login_time"/>
        
        <!-- 关联查询用户标签 -->
        <collection property="tags" ofType="com.example.model.UserTag">
            <id property="id" column="tag_id"/>
            <result property="name" column="tag_name"/>
            <result property="category" column="tag_category"/>
        </collection>
    </resultMap>
    
    <!-- 通用查询条件片段 -->
    <sql id="userConditions">
        <where>
            <if test="condition.username != null and condition.username != ''">
                AND u.username LIKE CONCAT('%', #{condition.username}, '%')
            </if>
            <if test="condition.email != null and condition.email != ''">
                AND u.email LIKE CONCAT('%', #{condition.email}, '%')
            </if>
            <if test="condition.minAge != null">
                AND u.age >= #{condition.minAge}
            </if>
            <if test="condition.maxAge != null">
                AND u.age &lt;= #{condition.maxAge}
            </if>
            <if test="condition.status != null">
                AND u.status = #{condition.status}
            </if>
            <if test="condition.startDate != null">
                AND u.created_time >= #{condition.startDate}
            </if>
            <if test="condition.endDate != null">
                AND u.created_time &lt;= #{condition.endDate}
            </if>
            <if test="condition.hasTag != null and condition.hasTag">
                AND EXISTS (SELECT 1 FROM user_tags ut WHERE ut.user_id = u.id)
            </if>
            <if test="condition.tagIds != null and condition.tagIds.size() > 0">
                AND EXISTS (
                    SELECT 1 FROM user_tags ut 
                    WHERE ut.user_id = u.id 
                    AND ut.tag_id IN
                    <foreach collection="condition.tagIds" item="tagId" open="(" separator="," close=")">
                        #{tagId}
                    </foreach>
                )
            </if>
            <if test="condition.excludeIds != null and condition.excludeIds.size() > 0">
                AND u.id NOT IN
                <foreach collection="condition.excludeIds" item="excludeId" open="(" separator="," close=")">
                    #{excludeId}
                </foreach>
            </if>
        </where>
    </sql>
    
    <!-- 用户统计查询 -->
    <select id="countByCondition" resultType="long">
        SELECT COUNT(DISTINCT u.id)
        FROM users u
        <if test="condition.hasTag != null and condition.hasTag">
            LEFT JOIN user_tags ut ON u.id = ut.user_id
        </if>
        <include refid="userConditions"/>
    </select>
    
    <!-- 用户列表查询 -->
    <select id="selectByCondition" resultMap="UserResultMap">
        SELECT 
            u.id, u.username, u.email, u.age, u.status, 
            u.created_time, u.updated_time, u.last_login_time,
            t.id as tag_id, t.name as tag_name, t.category as tag_category
        FROM users u
        LEFT JOIN user_tags ut ON u.id = ut.user_id
        LEFT JOIN tags t ON ut.tag_id = t.id
        <include refid="userConditions"/>
        
        <!-- 动态排序 -->
        ORDER BY
        <choose>
            <when test="condition.orderBy != null and condition.orderBy == 'age'">
                u.age
                <choose>
                    <when test="condition.orderDirection == 'ASC'">ASC</when>
                    <otherwise>DESC</otherwise>
                </choose>
            </when>
            <when test="condition.orderBy != null and condition.orderBy == 'created_time'">
                u.created_time
                <choose>
                    <when test="condition.orderDirection == 'ASC'">ASC</when>
                    <otherwise>DESC</otherwise>
                </choose>
            </when>
            <when test="condition.orderBy != null and condition.orderBy == 'last_login_time'">
                u.last_login_time
                <choose>
                    <when test="condition.orderDirection == 'ASC'">ASC</when>
                    <otherwise>DESC</otherwise>
                </choose>
            </when>
            <otherwise>
                u.id DESC
            </otherwise>
        </choose>
        
        <!-- 分页 -->
        <if test="condition.offset != null and condition.limit != null">
            LIMIT #{condition.offset}, #{condition.limit}
        </if>
    </select>
    
    <!-- 批量插入用户 -->
    <insert id="batchInsertUsers" parameterType="list">
        INSERT INTO users (username, email, age, status, created_time, updated_time)
        VALUES
        <foreach collection="users" item="user" separator=",">
            (#{user.username}, #{user.email}, #{user.age}, #{user.status}, 
             #{user.createdTime}, #{user.updatedTime})
        </foreach>
    </insert>
    
    <!-- 批量更新用户状态 -->
    <update id="batchUpdateUserStatus">
        UPDATE users 
        SET status = #{status}, updated_time = #{updateTime}
        WHERE id IN
        <foreach collection="userIds" item="userId" open="(" separator="," close=")">
            #{userId}
        </foreach>
    </update>
    
    <!-- 复杂聚合查询 - 用户年龄分布 -->
    <select id="getUserAgeDistribution" resultType="com.example.dto.AgeDistribution">
        SELECT 
            CASE 
                WHEN age BETWEEN 0 AND 17 THEN '未成年'
                WHEN age BETWEEN 18 AND 25 THEN '青少年'
                WHEN age BETWEEN 26 AND 35 THEN '青年'
                WHEN age BETWEEN 36 AND 50 THEN '中年'
                ELSE '老年'
            END as ageGroup,
            COUNT(*) as userCount,
            AVG(age) as avgAge,
            MIN(age) as minAge,
            MAX(age) as maxAge
        FROM users 
        WHERE status = 'ACTIVE'
            <if test="startDate != null">
                AND created_time >= #{startDate}
            </if>
            <if test="endDate != null">
                AND created_time &lt;= #{endDate}
            </if>
        GROUP BY 
            CASE 
                WHEN age BETWEEN 0 AND 17 THEN '未成年'
                WHEN age BETWEEN 18 AND 25 THEN '青少年'
                WHEN age BETWEEN 26 AND 35 THEN '青年'
                WHEN age BETWEEN 36 AND 50 THEN '中年'
                ELSE '老年'
            END
        ORDER BY avgAge
    </select>
    
    <!-- 用户活跃度统计 -->
    <select id="getUserActivityStats" resultType="com.example.dto.UserActivityStats">
        SELECT 
            u.id as userId,
            u.username,
            u.email,
            COUNT(ul.id) as loginCount,
            MAX(ul.login_time) as lastLoginTime,
            DATEDIFF(CURDATE(), MAX(ul.login_time)) as daysSinceLastLogin,
            COUNT(DISTINCT DATE(ul.login_time)) as activeDays
        FROM users u
        LEFT JOIN user_login_logs ul ON u.id = ul.user_id
            AND ul.login_time >= #{startDate}
            AND ul.login_time <= #{endDate}
        WHERE u.status = 'ACTIVE'
        GROUP BY u.id, u.username, u.email
        HAVING COUNT(ul.id) >= #{minLoginCount}
        ORDER BY loginCount DESC, lastLoginTime DESC
        <if test="limit != null">
            LIMIT #{limit}
        </if>
    </select>
</mapper>
```

## 🏢 数据仓库设计与建模

### 📊 维度建模实现

```java
/**
 * 数据仓库建模服务
 * 实现星型模式和雪花模式的维度建模
 */
@Service
public class DataWarehouseModelingService {
    private static final Logger logger = LoggerFactory.getLogger(DataWarehouseModelingService.class);
    
    private final DimensionTableManager dimensionManager;
    private final FactTableManager factManager;
    private final ETLPipelineManager etlManager;
    
    public DataWarehouseModelingService(DimensionTableManager dimensionManager,
                                      FactTableManager factManager,
                                      ETLPipelineManager etlManager) {
        this.dimensionManager = dimensionManager;
        this.factManager = factManager;
        this.etlManager = etlManager;
    }
    
    /**
     * 销售数据仓库建模
     */
    public void buildSalesDataWarehouse() {
        logger.info("开始构建销售数据仓库");
        
        try {
            // 1. 创建维度表
            createTimeDimension();
            createProductDimension();
            createCustomerDimension();
            createGeographyDimension();
            createSalesChannelDimension();
            
            // 2. 创建事实表
            createSalesFactTable();
            
            // 3. 建立ETL流程
            setupSalesETLPipeline();
            
            // 4. 创建聚合表
            createSalesAggregationTables();
            
            logger.info("销售数据仓库构建完成");
            
        } catch (Exception e) {
            logger.error("销售数据仓库构建失败: {}", e.getMessage(), e);
            throw new DataWarehouseException("销售数据仓库构建失败", e);
        }
    }
    
    /**
     * 创建时间维度表
     */
    private void createTimeDimension() {
        logger.info("创建时间维度表");
        
        TimeDimensionBuilder builder = new TimeDimensionBuilder();
        
        // 构建时间维度数据（2020-2030年）
        List<TimeDimension> timeDimensions = builder
            .withDateRange(LocalDate.of(2020, 1, 1), LocalDate.of(2030, 12, 31))
            .withFiscalYearStart(4)  // 4月开始的财年
            .withHolidays(getHolidayConfig())
            .build();
        
        // 批量插入时间维度数据
        dimensionManager.batchInsertTimeDimension(timeDimensions);
        
        logger.info("时间维度表创建完成，记录数: {}", timeDimensions.size());
    }
    
    /**
     * 创建产品维度表
     */
    private void createProductDimension() {
        logger.info("创建产品维度表");
        
        // 从源系统提取产品数据
        List<SourceProduct> sourceProducts = etlManager.extractProductData();
        
        // 产品维度转换
        List<ProductDimension> productDimensions = sourceProducts.stream()
            .map(this::transformToProductDimension)
            .collect(Collectors.toList());
        
        // 处理层次结构（类别 -> 子类别 -> 产品）
        buildProductHierarchy(productDimensions);
        
        // 插入产品维度数据
        dimensionManager.batchInsertProductDimension(productDimensions);
        
        logger.info("产品维度表创建完成，记录数: {}", productDimensions.size());
    }
    
    /**
     * 创建客户维度表
     */
    private void createCustomerDimension() {
        logger.info("创建客户维度表");
        
        CustomerDimensionProcessor processor = new CustomerDimensionProcessor();
        
        // 设置处理规则
        processor
            .withDataQualityRules(getCustomerDataQualityRules())
            .withSegmentationRules(getCustomerSegmentationRules())
            .withPrivacyMasking(true);
        
        // 提取和转换客户数据
        List<CustomerDimension> customerDimensions = processor.processCustomerData();
        
        // 插入客户维度数据
        dimensionManager.batchInsertCustomerDimension(customerDimensions);
        
        logger.info("客户维度表创建完成，记录数: {}", customerDimensions.size());
    }
    
    /**
     * 创建销售事实表
     */
    private void createSalesFactTable() {
        logger.info("创建销售事实表");
        
        SalesFactProcessor processor = new SalesFactProcessor();
        
        // 配置事实表处理规则
        processor
            .withDimensionLookup(dimensionManager)
            .withAggregationRules(getSalesAggregationRules())
            .withDataValidationRules(getSalesValidationRules());
        
        // 分批处理销售数据
        LocalDate startDate = LocalDate.now().minusMonths(12);
        LocalDate endDate = LocalDate.now();
        
        for (LocalDate date = startDate; !date.isAfter(endDate); date = date.plusDays(1)) {
            logger.debug("处理销售数据: {}", date);
            
            // 提取当日销售数据
            List<SourceSalesOrder> dailySales = etlManager.extractSalesData(date);
            
            if (!dailySales.isEmpty()) {
                // 转换为事实记录
                List<SalesFact> salesFacts = processor.processDailySales(dailySales, date);
                
                // 插入事实表
                factManager.batchInsertSalesFacts(salesFacts);
                
                logger.debug("插入销售事实记录: {} 条", salesFacts.size());
            }
        }
        
        logger.info("销售事实表创建完成");
    }
    
    /**
     * 设置ETL流程
     */
    private void setupSalesETLPipeline() {
        logger.info("设置销售数据ETL流程");
        
        // 创建ETL管道
        ETLPipeline salesETL = ETLPipeline.builder()
            .name("sales_data_etl")
            .description("销售数据ETL流程")
            .schedule("0 2 * * *")  // 每天凌晨2点执行
            .build();
        
        // 配置抽取阶段
        ExtractStage extractStage = ExtractStage.builder()
            .name("extract_sales_data")
            .dataSource(getTransactionalDataSource())
            .extractQuery(getSalesExtractQuery())
            .incrementalColumn("updated_time")
            .build();
        
        // 配置转换阶段
        TransformStage transformStage = TransformStage.builder()
            .name("transform_sales_data")
            .transformationRules(getSalesTransformationRules())
            .dataQualityRules(getSalesDataQualityRules())
            .build();
        
        // 配置加载阶段
        LoadStage loadStage = LoadStage.builder()
            .name("load_sales_data")
            .targetDataSource(getDataWarehouseDataSource())
            .loadStrategy(LoadStrategy.MERGE)
            .build();
        
        // 组装ETL流程
        salesETL.addStage(extractStage);
        salesETL.addStage(transformStage);
        salesETL.addStage(loadStage);
        
        // 注册ETL流程
        etlManager.registerPipeline(salesETL);
        
        logger.info("销售数据ETL流程设置完成");
    }
    
    /**
     * 创建聚合表
     */
    private void createSalesAggregationTables() {
        logger.info("创建销售聚合表");
        
        // 日销售汇总表
        createDailySalesSummary();
        
        // 月销售汇总表
        createMonthlySalesSummary();
        
        // 产品销售汇总表
        createProductSalesSummary();
        
        // 客户销售汇总表
        createCustomerSalesSummary();
        
        // 地区销售汇总表
        createRegionSalesSummary();
        
        logger.info("销售聚合表创建完成");
    }
    
    /**
     * 创建日销售汇总表
     */
    private void createDailySalesSummary() {
        String sql = """
            CREATE TABLE IF NOT EXISTS daily_sales_summary AS
            SELECT 
                t.date_key,
                t.date_actual,
                t.year_number,
                t.quarter_number,
                t.month_number,
                t.day_of_week,
                COUNT(DISTINCT sf.order_id) as order_count,
                COUNT(sf.order_line_id) as line_item_count,
                SUM(sf.quantity) as total_quantity,
                SUM(sf.sales_amount) as total_sales_amount,
                SUM(sf.cost_amount) as total_cost_amount,
                SUM(sf.profit_amount) as total_profit_amount,
                AVG(sf.unit_price) as avg_unit_price,
                COUNT(DISTINCT sf.customer_key) as unique_customers,
                COUNT(DISTINCT sf.product_key) as unique_products
            FROM sales_fact sf
            JOIN time_dimension t ON sf.date_key = t.date_key
            GROUP BY 
                t.date_key, t.date_actual, t.year_number, 
                t.quarter_number, t.month_number, t.day_of_week
            """;
        
        factManager.executeAggregationQuery(sql);
        logger.info("日销售汇总表创建完成");
    }
    
    /**
     * 产品维度转换
     */
    private ProductDimension transformToProductDimension(SourceProduct source) {
        ProductDimension dimension = new ProductDimension();
        
        // 基础信息
        dimension.setProductKey(generateProductKey(source.getId()));
        dimension.setProductId(source.getId());
        dimension.setProductName(source.getName());
        dimension.setProductDescription(source.getDescription());
        dimension.setProductCode(source.getCode());
        
        // 分类信息
        dimension.setCategoryId(source.getCategoryId());
        dimension.setCategoryName(source.getCategoryName());
        dimension.setSubcategoryId(source.getSubcategoryId());
        dimension.setSubcategoryName(source.getSubcategoryName());
        
        // 属性信息
        dimension.setBrand(source.getBrand());
        dimension.setModel(source.getModel());
        dimension.setColor(source.getColor());
        dimension.setSize(source.getSize());
        dimension.setWeight(source.getWeight());
        
        // 价格信息
        dimension.setStandardCost(source.getStandardCost());
        dimension.setListPrice(source.getListPrice());
        
        // 状态信息
        dimension.setStatus(source.getStatus());
        dimension.setIsActive(source.isActive());
        
        // SCD Type 2 所需字段示例；此处仅初始化，尚未实现历史版本变更处理
        dimension.setEffectiveDate(LocalDate.now());
        dimension.setExpirationDate(LocalDate.of(9999, 12, 31));
        dimension.setIsCurrent(true);
        
        // 审计字段
        dimension.setCreatedTime(LocalDateTime.now());
        dimension.setUpdatedTime(LocalDateTime.now());
        
        return dimension;
    }
    
    /**
     * 构建产品层次结构
     */
    private void buildProductHierarchy(List<ProductDimension> products) {
        // 按类别分组
        Map<String, List<ProductDimension>> categoryGroups = products.stream()
            .collect(Collectors.groupingBy(ProductDimension::getCategoryName));
        
        for (Map.Entry<String, List<ProductDimension>> entry : categoryGroups.entrySet()) {
            String categoryName = entry.getKey();
            List<ProductDimension> categoryProducts = entry.getValue();
            
            // 为每个类别的产品设置层次路径
            for (ProductDimension product : categoryProducts) {
                String hierarchyPath = String.format("%s|%s|%s", 
                    product.getCategoryName(),
                    product.getSubcategoryName(),
                    product.getProductName());
                
                product.setHierarchyPath(hierarchyPath);
                product.setHierarchyLevel(3);  // 产品级别
            }
        }
    }
    
    /**
     * 生成产品代理键
     */
    private Long generateProductKey(String productId) {
        // 教学示例：哈希值可能碰撞，不能保证代理键唯一；生产环境需使用唯一键生成机制，并为SCD Type 2各历史版本分配不同代理键
        return (long) (productId.hashCode() & 0x7FFFFFFF);
    }
}
```

### 📈 OLAP数据库集成

```java
/**
 * ClickHouse OLAP引擎集成
 * 用于高性能分析查询
 */
@Service
public class ClickHouseAnalyticsService {
    private static final Logger logger = LoggerFactory.getLogger(ClickHouseAnalyticsService.class);
    
    private final NamedParameterJdbcTemplate clickHouseTemplate;
    private final RedisTemplate<String, Object> redisTemplate;
    private final MeterRegistry meterRegistry;
    
    public ClickHouseAnalyticsService(
            @Qualifier("clickHouseJdbcTemplate") NamedParameterJdbcTemplate clickHouseTemplate,
            RedisTemplate<String, Object> redisTemplate,
            MeterRegistry meterRegistry) {
        this.clickHouseTemplate = clickHouseTemplate;
        this.redisTemplate = redisTemplate;
        this.meterRegistry = meterRegistry;
    }
    
    /**
     * 用户行为漏斗分析
     */
    public FunnelAnalysisResult analyzeFunnel(FunnelAnalysisRequest request) {
        logger.info("执行漏斗分析: {}", request);
        
        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            String sql = """
                SELECT 
                    step,
                    step_name,
                    user_count,
                    conversion_rate,
                    drop_off_rate
                FROM (
                    SELECT 
                        1 as step,
                        '页面访问' as step_name,
                        uniqExact(user_id) as user_count,
                        100.0 as conversion_rate,
                        0.0 as drop_off_rate
                    FROM user_events 
                    WHERE event_date BETWEEN :startDate AND :endDate
                        AND event_name = 'page_view'
                        AND page_url = :landingPage
                    
                    UNION ALL
                    
                    SELECT 
                        2 as step,
                        '产品查看' as step_name,
                        uniqExact(user_id) as user_count,
                        user_count * 100.0 / (
                            SELECT uniqExact(user_id) 
                            FROM user_events 
                            WHERE event_date BETWEEN :startDate AND :endDate
                                AND event_name = 'page_view'
                                AND page_url = :landingPage
                        ) as conversion_rate,
                        100.0 - conversion_rate as drop_off_rate
                    FROM user_events 
                    WHERE event_date BETWEEN :startDate AND :endDate
                        AND event_name = 'product_view'
                        AND user_id IN (
                            SELECT user_id 
                            FROM user_events 
                            WHERE event_date BETWEEN :startDate AND :endDate
                                AND event_name = 'page_view'
                                AND page_url = :landingPage
                        )
                    
                    UNION ALL
                    
                    SELECT 
                        3 as step,
                        '加入购物车' as step_name,
                        uniqExact(user_id) as user_count,
                        user_count * 100.0 / (
                            SELECT uniqExact(user_id) 
                            FROM user_events 
                            WHERE event_date BETWEEN :startDate AND :endDate
                                AND event_name = 'page_view'
                                AND page_url = :landingPage
                        ) as conversion_rate,
                        100.0 - conversion_rate as drop_off_rate
                    FROM user_events 
                    WHERE event_date BETWEEN :startDate AND :endDate
                        AND event_name = 'add_to_cart'
                        AND user_id IN (
                            SELECT user_id 
                            FROM user_events 
                            WHERE event_date BETWEEN :startDate AND :endDate
                                AND event_name = 'page_view'
                                AND page_url = :landingPage
                        )
                    
                    UNION ALL
                    
                    SELECT 
                        4 as step,
                        '下单购买' as step_name,
                        uniqExact(user_id) as user_count,
                        user_count * 100.0 / (
                            SELECT uniqExact(user_id) 
                            FROM user_events 
                            WHERE event_date BETWEEN :startDate AND :endDate
                                AND event_name = 'page_view'
                                AND page_url = :landingPage
                        ) as conversion_rate,
                        100.0 - conversion_rate as drop_off_rate
                    FROM orders 
                    WHERE order_date BETWEEN :startDate AND :endDate
                        AND user_id IN (
                            SELECT user_id 
                            FROM user_events 
                            WHERE event_date BETWEEN :startDate AND :endDate
                                AND event_name = 'page_view'
                                AND page_url = :landingPage
                        )
                ) 
                ORDER BY step
                """;
            
            MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("startDate", request.getStartDate())
                .addValue("endDate", request.getEndDate())
                .addValue("landingPage", request.getLandingPage());
            
            List<FunnelStep> steps = clickHouseTemplate.query(sql, params, (rs, rowNum) -> {
                FunnelStep step = new FunnelStep();
                step.setStep(rs.getInt("step"));
                step.setStepName(rs.getString("step_name"));
                step.setUserCount(rs.getLong("user_count"));
                step.setConversionRate(rs.getDouble("conversion_rate"));
                step.setDropOffRate(rs.getDouble("drop_off_rate"));
                return step;
            });
            
            FunnelAnalysisResult result = new FunnelAnalysisResult();
            result.setSteps(steps);
            result.setRequest(request);
            result.setGeneratedTime(LocalDateTime.now());
            
            // 计算总体转化率
            if (!steps.isEmpty()) {
                FunnelStep firstStep = steps.get(0);
                FunnelStep lastStep = steps.get(steps.size() - 1);
                double overallConversionRate = (double) lastStep.getUserCount() / firstStep.getUserCount() * 100;
                result.setOverallConversionRate(overallConversionRate);
            }
            
            sample.stop(Timer.builder("clickhouse.query.time")
                .tag("operation", "funnel_analysis")
                .register(meterRegistry));
            
            logger.info("漏斗分析完成，步骤数: {}", steps.size());
            return result;
            
        } catch (Exception e) {
            sample.stop(Timer.builder("clickhouse.query.time")
                .tag("operation", "funnel_analysis")
                .tag("status", "error")
                .register(meterRegistry));
            
            logger.error("漏斗分析失败: {}", e.getMessage(), e);
            throw new AnalyticsException("漏斗分析失败", e);
        }
    }
    
    /**
     * 实时数据流处理查询
     */
    public RealtimeMetrics getRealtimeMetrics(Duration timeWindow) {
        logger.debug("获取实时指标，时间窗口: {}", timeWindow);
        
        try {
            LocalDateTime endTime = LocalDateTime.now();
            LocalDateTime startTime = endTime.minus(timeWindow);
            
            String sql = """
                SELECT 
                    countDistinct(user_id) as active_users,
                    count(*) as total_events,
                    countIf(event_name = 'page_view') as page_views,
                    countIf(event_name = 'product_view') as product_views,
                    countIf(event_name = 'add_to_cart') as add_to_cart,
                    countIf(event_name = 'purchase') as purchases,
                    avg(session_duration) as avg_session_duration,
                    quantile(0.5)(session_duration) as median_session_duration,
                    quantile(0.95)(session_duration) as p95_session_duration
                FROM user_events 
                WHERE event_time BETWEEN :startTime AND :endTime
                """;
            
            MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("startTime", startTime)
                .addValue("endTime", endTime);
            
            RealtimeMetrics metrics = clickHouseTemplate.queryForObject(sql, params, (rs, rowNum) -> {
                RealtimeMetrics m = new RealtimeMetrics();
                m.setActiveUsers(rs.getLong("active_users"));
                m.setTotalEvents(rs.getLong("total_events"));
                m.setPageViews(rs.getLong("page_views"));
                m.setProductViews(rs.getLong("product_views"));
                m.setAddToCart(rs.getLong("add_to_cart"));
                m.setPurchases(rs.getLong("purchases"));
                m.setAvgSessionDuration(rs.getDouble("avg_session_duration"));
                m.setMedianSessionDuration(rs.getDouble("median_session_duration"));
                m.setP95SessionDuration(rs.getDouble("p95_session_duration"));
                m.setTimestamp(LocalDateTime.now());
                m.setTimeWindow(timeWindow);
                return m;
            });
            
            // 计算转化率
            if (metrics.getPageViews() > 0) {
                double conversionRate = (double) metrics.getPurchases() / metrics.getPageViews() * 100;
                metrics.setConversionRate(conversionRate);
            }
            
            logger.debug("实时指标获取完成: 活跃用户={}, 总事件={}", metrics.getActiveUsers(), metrics.getTotalEvents());
            return metrics;
            
        } catch (Exception e) {
            logger.error("获取实时指标失败: {}", e.getMessage(), e);
            throw new AnalyticsException("获取实时指标失败", e);
        }
    }
    
    /**
     * 用户留存分析
     */
    public RetentionAnalysisResult analyzeRetention(RetentionAnalysisRequest request) {
        logger.info("执行用户留存分析: {}", request);
        
        try {
            String sql = """
                WITH first_visit AS (
                    SELECT 
                        user_id,
                        min(toDate(event_time)) as first_visit_date
                    FROM user_events
                    WHERE event_date BETWEEN :startDate AND :endDate
                        AND event_name = 'page_view'
                    GROUP BY user_id
                ),
                retention_data AS (
                    SELECT 
                        fv.first_visit_date as cohort_date,
                        dateDiff('day', fv.first_visit_date, toDate(ue.event_time)) as day_diff,
                        count(DISTINCT ue.user_id) as retained_users
                    FROM first_visit fv
                    JOIN user_events ue ON fv.user_id = ue.user_id
                    WHERE ue.event_name = 'page_view'
                        AND toDate(ue.event_time) >= fv.first_visit_date
                        AND dateDiff('day', fv.first_visit_date, toDate(ue.event_time)) <= :maxDays
                    GROUP BY fv.first_visit_date, dateDiff('day', fv.first_visit_date, toDate(ue.event_time))
                ),
                cohort_sizes AS (
                    SELECT 
                        first_visit_date as cohort_date,
                        count(DISTINCT user_id) as cohort_size
                    FROM first_visit
                    GROUP BY first_visit_date
                )
                SELECT 
                    rd.cohort_date,
                    rd.day_diff,
                    rd.retained_users,
                    cs.cohort_size,
                    rd.retained_users * 100.0 / cs.cohort_size as retention_rate
                FROM retention_data rd
                JOIN cohort_sizes cs ON rd.cohort_date = cs.cohort_date
                ORDER BY rd.cohort_date, rd.day_diff
                """;
            
            MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("startDate", request.getStartDate())
                .addValue("endDate", request.getEndDate())
                .addValue("maxDays", request.getMaxDays());
            
            List<RetentionDataPoint> dataPoints = clickHouseTemplate.query(sql, params, (rs, rowNum) -> {
                RetentionDataPoint point = new RetentionDataPoint();
                point.setCohortDate(rs.getDate("cohort_date").toLocalDate());
                point.setDayDiff(rs.getInt("day_diff"));
                point.setRetainedUsers(rs.getLong("retained_users"));
                point.setCohortSize(rs.getLong("cohort_size"));
                point.setRetentionRate(rs.getDouble("retention_rate"));
                return point;
            });
            
            RetentionAnalysisResult result = new RetentionAnalysisResult();
            result.setDataPoints(dataPoints);
            result.setRequest(request);
            result.setGeneratedTime(LocalDateTime.now());
            
            // 计算平均留存率
            Map<Integer, Double> averageRetentionByDay = dataPoints.stream()
                .collect(Collectors.groupingBy(
                    RetentionDataPoint::getDayDiff,
                    Collectors.averagingDouble(RetentionDataPoint::getRetentionRate)
                ));
            
            result.setAverageRetentionByDay(averageRetentionByDay);
            
            logger.info("用户留存分析完成，数据点数量: {}", dataPoints.size());
            return result;
            
        } catch (Exception e) {
            logger.error("用户留存分析失败: {}", e.getMessage(), e);
            throw new AnalyticsException("用户留存分析失败", e);
        }
    }
}
```

---

> [!quote] 💭 Java数据库与数据仓库开发实践心得
> 
> 🎯 **架构设计**：合理设计数据模型和维度结构是数据仓库成功的关键
> 💪 **性能优化**：重视SQL优化、索引设计和分区策略
> 🔍 **数据质量**：建立完善的数据质量监控和治理机制
> 🛠️ **工具选择**：根据业务需求选择合适的OLTP和OLAP数据库

## 🔗 相关学习资源

### 继续学习
- **学习路线图**：[[【技术与工具】/Java/00-Java学习路线图|Java]]
- **Java数据处理与文件IO**：[[【技术与工具】/Java/04-Java数据处理与文件IO|Java数据处理与文件IO]]
- **Java在数据开发中的应用**：[[【技术与工具】/Java/05-Java在数据开发中的应用|Java在数据开发中的]]
- **Java大数据技术栈**：[[【技术与工具】/Java/06-Java大数据技术栈|Java大数据技术栈]]

### 配套数据库学习
- **MySQL数据库**：[[【技术与工具】/MySQL/00-MySQL学习路线图|MySQL/MySQL]]
- **SQL语言基础**：[[【技术与工具】/SQL/00-SQL学习路线图|SQL/SQL]]
- **Hive数据仓库**：[[【技术与工具】/Hive/00-Hive学习路线图|Hive/Hive]]

> [!tip] 🌟 开发建议
> 
> Java数据库开发需要深入理解业务需求和数据特点。重视数据建模的合理性，关注查询性能的优化，建立完善的数据质量保障体系。在企业实践中，要平衡开发效率和系统性能，选择合适的技术架构和工具栈。
