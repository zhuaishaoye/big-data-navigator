---
title: Doris用户定义函数UDF - 扩展分析能力
tags:
  - 技能实操
  - Doris
  - UDF
  - 函数扩展
difficulty: 高级
duration: 30分钟
knowledge_type: technical-practice
target_audience:
  - 数据分析师
  - 数据开发工程师
  - 数据治理工程师
  - 数据架构师
stability: slow-changing
status: maintenance
access_tier: free
updated: 2026-10-10
---


# Doris用户定义函数UDF - 扩展分析能力

> [!abstract] 📋 本节概览
> - 🎯 **学习目标**：掌握Doris用户定义函数(UDF)的开发与应用
> - 📚 **前置知识**：11-物化视图应用|物化视图应用、Java基础
> - ⏱️ **预计用时**：30分钟
> - 💡 **核心收获**：能够通过UDF扩展Doris的分析能力

数据分析师小赵遇到难题：需要根据复杂的业务规则计算客户信用评分，涉及十几个字段的加权计算和条件判断。Doris内置函数无法满足需求，写子查询又过于复杂。"如果能像写Java方法一样定义自己的函数就好了，"他想。这时候UDF（用户定义函数）成了救星，让复杂业务逻辑可以封装成简洁的SQL函数。
## 💡 Doris UDF类型与原理

Doris支持多种类型的用户自定义函数，每种类型适用于不同的场景：

### 1. 标量函数(UDF)

输入一行数据，返回一个结果值。

**适用场景**：
- 数据转换和格式化
- 复杂计算
- 业务规则应用

### 2. 表值函数(UDTF)

输入一行数据，返回多行结果。

**适用场景**：
- 字符串拆分为多行
- JSON/数组展开
- 时间序列生成

### 3. 聚合函数(UDAF)

输入多行数据，返回一个聚合结果。

**适用场景**：
- 自定义统计指标
- 复杂业务聚合逻辑
- 高级数据分析

## 🛠️ UDF开发环境准备

### 开发环境要求

- JDK 1.8+
- Maven 3.5+
- Doris客户端

### Maven依赖配置

下方 Maven 片段使用 `doris-fe-common`，与原说明中的 `hudi-fe-common` 名称不一致。普通 Java 标量 UDF 不需要为继承 Doris 内部函数类而引入该依赖；此依赖的版本可用性及运行时是否提供尚未核验，请勿直接将该片段视为可构建配置。

```xml
<project>
    <properties>
        <doris.version>2.0.2</doris.version>
    </properties>

    <dependencies>
        <!-- 原稿依赖示例；provided 表示预期由运行环境提供，不证明 Doris 运行时已包含，仍须核验 -->
        <dependency>
            <groupId>org.apache.doris</groupId>
            <artifactId>doris-fe-common</artifactId>
            <version>${doris.version}</version>
            <scope>provided</scope>
        </dependency>
        <!-- 单元测试 -->
        <dependency>
            <groupId>junit</groupId>
            <artifactId>junit</artifactId>
            <version>4.13.2</version>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <!-- 打包时包含所有依赖（除 provided 外）-->
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-assembly-plugin</artifactId>
                <configuration>
                    <descriptorRefs>
                        <descriptorRef>jar-with-dependencies</descriptorRef>
                    </descriptorRefs>
                </configuration>
                <executions>
                    <execution>
                        <id>make-assembly</id>
                        <phase>package</phase>
                        <goals><goal>single</goal></goals>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>
</project>
```

完成开发后，执行 `mvn package -DskipTests` 生成 `target/your-udf-jar-with-dependencies.jar`，将该 JAR 上传到 FE 可访问的路径（或 HDFS），再通过 `CREATE FUNCTION` 注册。

## 📝 UDF开发实战

### 1. 标量函数(UDF)开发

**示例：手机号脱敏函数**

```java
package com.example.doris.udf;

import org.apache.doris.analysis.FunctionCallExpr;
import org.apache.doris.catalog.PrimitiveType;
import org.apache.doris.catalog.ScalarFunction;
import org.apache.doris.catalog.Type;
import org.apache.doris.common.AnalysisException;

import java.io.IOException;

public class MaskPhoneNumber {
    
    public MaskPhoneNumber() {
        // 默认构造函数
    }
    
    // 函数名称与 SQL 参数、返回类型在 CREATE FUNCTION 中声明；计算逻辑由 evaluate 方法提供。
    
    public String evaluate(String phoneNumber) {
        if (phoneNumber == null || phoneNumber.length() != 11) {
            return phoneNumber;
        }
        
        // 保留前3位和后4位，中间用****替代
        return phoneNumber.substring(0, 3) + "****" + phoneNumber.substring(7);
    }
}
```

### 📝 **关键代码解释**
- **条件判断**: `if (phoneNumber == null || phoneNumber.length() != 11)` - 检查手机号是否为空或长度不等于11位

### 注册UDF

```sql
-- 创建UDF函数
CREATE FUNCTION mask_phone(string) 
RETURNS string 
PROPERTIES (
    "file" = "file:///path/to/doris-udf-example-1.0.0.jar",
    "symbol" = "com.example.doris.udf.MaskPhoneNumber",
    "type" = "JAVA_UDF"
);

-- 创建UDTF函数
CREATE FUNCTION string_split(string, string) 
RETURNS TABLE(word string)
PROPERTIES (
    "file" = "file:///path/to/doris-udf-example-1.0.0.jar",
    "symbol" = "com.example.doris.udf.StringSplitter",
    "type" = "JAVA_UDF_TABLE_FUNCTION"
);

-- 创建UDAF函数
CREATE AGGREGATE FUNCTION weighted_avg(double, double) 
RETURNS double 
PROPERTIES (
    "file" = "file:///path/to/doris-udf-example-1.0.0.jar",
    "symbol" = "com.example.doris.udf.WeightedAverage",
    "type" = "JAVA_UDAF"
);
```

### 使用UDF

```sql
-- 使用标量函数UDF
SELECT 
    user_id, 
    mask_phone(phone_number) AS masked_phone
FROM user_info;

-- 使用表值函数UDTF
SELECT word
FROM user_tags, LATERAL TABLE(string_split(tags, ',')) AS t(word);

-- 使用聚合函数UDAF
SELECT 
    product_category,
    weighted_avg(rating, sales_count) AS weighted_rating
FROM product_reviews
GROUP BY product_category;
```

## 🌟 UDF应用场景案例

### 1. 地理位置计算

**需求**：计算两个地理坐标点之间的距离

```java
public class GeoDistance {
    
    private static final double EARTH_RADIUS = 6371.0; // 地球半径，单位km
    
    public Double evaluate(Double lat1, Double lng1, Double lat2, Double lng2) {
        if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) {
            return null;
        }
        
        double radLat1 = Math.toRadians(lat1);
        double radLat2 = Math.toRadians(lat2);
        double deltaLat = Math.toRadians(lat2 - lat1);
        double deltaLng = Math.toRadians(lng2 - lng1);
        
        double a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                Math.cos(radLat1) * Math.cos(radLat2) *
                Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
        return EARTH_RADIUS * c;
    }
}
```

**使用示例**：
```sql
-- 注册函数
CREATE FUNCTION geo_distance(double, double, double, double) 
RETURNS double 
PROPERTIES (
    "file" = "file:///path/to/geo-udf.jar",
    "symbol" = "com.example.doris.udf.GeoDistance",
    "type" = "JAVA_UDF"
);

-- 查找用户附近的商店
SELECT 
    store_id,
    store_name,
    geo_distance(user_lat, user_lng, store_lat, store_lng) AS distance_km
FROM stores
WHERE geo_distance(user_lat, user_lng, store_lat, store_lng) <= 5.0
ORDER BY distance_km;
```

### 2. 复杂业务规则应用

**需求**：根据企业复杂积分规则计算用户积分

```java
public class PointsCalculator {
    
    public Long evaluate(Double amount, String userLevel, Integer dayOfWeek) {
        if (amount == null || userLevel == null || dayOfWeek == null) {
            return 0L;
        }
        
        // 基础积分：消费金额取整
        long basePoints = amount.longValue();
        
        // 会员等级倍数
        double levelMultiplier = 1.0;
        switch (userLevel.toLowerCase()) {
            case "gold":
                levelMultiplier = 1.5;
                break;
            case "platinum":
                levelMultiplier = 2.0;
                break;
            case "diamond":
                levelMultiplier = 3.0;
                break;
        }
        
        // 周末额外积分
        double dayMultiplier = (dayOfWeek == 1 || dayOfWeek == 7) ? 1.2 : 1.0;
        
        // 计算最终积分
        return Math.round(basePoints * levelMultiplier * dayMultiplier);
    }
}
```

**使用示例**：
```sql
-- 注册函数
CREATE FUNCTION calculate_points(double, string, int) 
RETURNS bigint 
PROPERTIES (
    "file" = "file:///path/to/business-udf.jar",
    "symbol" = "com.example.doris.udf.PointsCalculator",
    "type" = "JAVA_UDF"
);

-- 计算用户积分
SELECT 
    user_id,
    user_name,
    user_level,
    SUM(calculate_points(order_amount, user_level, DAYOFWEEK(order_time))) AS total_points
FROM orders
GROUP BY user_id, user_name, user_level;
```

### 3. 数据质量检查

**需求**：检查数据是否符合业务规则

```java
public class DataQualityChecker {
    
    public String evaluate(String value, String pattern, String fieldName) {
        if (value == null) {
            return fieldName + ": 值为空";
        }
        
        if (pattern != null && !value.matches(pattern)) {
            return fieldName + ": 格式不符合要求";
        }
        
        return "PASS";
    }
}
```

**使用示例**：
```sql
-- 注册函数
CREATE FUNCTION check_data_quality(string, string, string) 
RETURNS string 
PROPERTIES (
    "file" = "file:///path/to/quality-udf.jar",
    "symbol" = "com.example.doris.udf.DataQualityChecker",
    "type" = "JAVA_UDF"
);

-- 检查数据质量
SELECT 
    id,
    email,
    phone,
    check_data_quality(email, '^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$', 'Email') AS email_check,
    check_data_quality(phone, '^1[3-9]\\d{9}$', 'Phone') AS phone_check
FROM user_data
WHERE check_data_quality(email, '^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$', 'Email') != 'PASS'
   OR check_data_quality(phone, '^1[3-9]\\d{9}$', 'Phone') != 'PASS';
```

## ⚠️ UDF开发最佳实践

### 1. 性能优化

- **避免过度计算**：只处理必要的数据
- **合理使用缓存**：缓存重复计算结果
- **减少内存分配**：重用对象，避免频繁创建

```java
// 优化前：每次调用都创建新对象
public String evaluate(String input) {
    StringBuilder result = new StringBuilder();
    // 处理逻辑...
    return result.toString();
}

// 优化后：重用对象
private final StringBuilder buffer = new StringBuilder(1024);

public String evaluate(String input) {
    buffer.setLength(0); // 清空缓冲区
    // 处理逻辑...
    return buffer.toString();
}
```

### 2. 异常处理

- **防御性编程**：检查空值和边界条件
- **优雅降级**：出错时返回默认值而非抛出异常
- **日志记录**：记录异常但不中断查询

```java
public String evaluate(String input) {
    try {
        if (input == null) {
            return null; // 处理空值
        }
        
        // 处理逻辑...
        return result;
    } catch (Exception e) {
        // 记录异常但不抛出
        System.err.println("Error processing input: " + input + ", error: " + e.getMessage());
        return null; // 返回默认值
    }
}
```

### 3. 测试与调试

- **单元测试**：编写全面的测试用例
- **边界测试**：测试极端情况和边界值
- **性能测试**：评估大数据量下的性能

```java
// 单元测试示例
@Test
public void testMaskPhoneNumber() {
    MaskPhoneNumber udf = new MaskPhoneNumber();
    
    // 正常情况
    assertEquals("123****8901", udf.evaluate("12345678901"));
    
    // 边界情况
    assertNull(udf.evaluate(null));
    assertEquals("", udf.evaluate(""));
    assertEquals("123", udf.evaluate("123")); // 长度不足
}
```

## ⚠️ 常见问题与解决方案

### 1. UDF加载失败

- **问题**：创建UDF时报错"找不到类"
- **解决方案**：
  - 检查JAR文件路径是否正确
  - 确认类名包含完整包名
  - 验证JAR文件是否包含所有依赖

```sql
-- 检查UDF状态
SHOW FUNCTIONS LIKE 'mask_phone';

-- 如果失败，重新创建并指定正确路径
DROP FUNCTION IF EXISTS mask_phone(string);
CREATE FUNCTION mask_phone(string) 
RETURNS string 
PROPERTIES (
    "file" = "file:///path/to/correct/doris-udf-example-1.0.0.jar",
    "symbol" = "com.example.doris.udf.MaskPhoneNumber",
    "type" = "JAVA_UDF"
);
```

### 2. 性能问题

- **问题**：UDF执行速度慢
- **解决方案**：
  - 优化算法复杂度
  - 减少数据转换和序列化
  - 考虑使用缓存

```java
// 添加缓存优化
public class OptimizedUDF {
    
    // 使用LRU缓存存储计算结果
    private final Map<String, String> cache = new LinkedHashMap<String, String>(1000, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, String> eldest) {
            return size() > 1000; // 限制缓存大小
        }
    };
    
    public String evaluate(String input) {
        // 检查缓存
        if (cache.containsKey(input)) {
            return cache.get(input);
        }
        
        // 计算结果
        String result = computeResult(input);
        
        // 存入缓存
        cache.put(input, result);
        
        return result;
    }
    
    private String computeResult(String input) {
        // 复杂计算逻辑
        return result;
    }
}
```

### 3. 内存泄漏

- **问题**：长时间运行后内存占用增加
- **解决方案**：
  - 避免在UDF中存储大量数据
  - 及时释放不再使用的对象
  - 限制缓存大小

## ✅ 掌握检查
- [ ] 理解UDF、UDTF和UDAF的区别和应用场景
- [ ] 能够开发简单的Java UDF函数
- [ ] 掌握UDF部署和注册方法
- [ ] 了解UDF性能优化的关键点
- [ ] 能够应用UDF解决实际业务问题

## 🔗 学习连接
**前置知识**: [[【技术与工具】/Doris/11-物化视图应用|物化视图]]
**下一步**: [[【技术与工具】/Kafka/13-集群管理与运维|集群管理与运维]]
**相关概念**: [[【技术与工具】/Doris/10-SQL查询与分析|SQL查询与]] 