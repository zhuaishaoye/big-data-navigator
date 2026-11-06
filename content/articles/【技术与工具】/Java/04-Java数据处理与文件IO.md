---
title: Java数据处理与文件IO - 数据开发的核心技能
type: 技术教程
tags:
  - Java
  - 文件IO
  - 数据处理
  - 流操作
  - JSON
  - CSV
  - 数据格式
difficulty: 中级
duration: 120分钟
created: 2024-12
updated: 2026-10-10
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据分析师
  - BI分析师
stability: slow-changing
status: maintenance
access_tier: free
---


# Java数据处理与文件IO - 数据开发的核心技能

> [!abstract] 📋 Java数据处理与IO：数据开发的核心技能
> 
> 🔍 **为什么文件IO和数据处理很重要？**
> 在数据开发工作中，我们需要从各种数据源读取数据、处理数据、然后输出到不同的目标系统。Java提供了丰富的IO类库和数据处理工具，掌握这些技能是数据开发者的必备基础。
> 
> 🎯 **本教程将帮助你掌握**：
> - 📁 **文件IO基础**：字节流、字符流的原理和应用
> - 🔄 **数据格式处理**：JSON、CSV、XML等常见格式的读写
> - 🗂️ **大文件处理**：高效处理大数据文件的技巧
> - 🌐 **网络数据获取**：从API和远程服务获取数据
> - 🔧 **数据转换**：不同格式间的数据转换和清洗
> - 📊 **实战项目**：完整的数据处理管道实现
> 
> ⏱️ **学习时长**：预计120分钟完成核心示例练习，实际用时取决于Java基础和环境配置

## 📁 Java IO基础原理

### 🌊 流的概念和分类

Java中的IO操作基于流（Stream）的概念：

```java
/**
 * IO流的基础概念演示
 */
public class IOStreamBasics {
    public static void main(String[] args) {
        System.out.println("=== Java IO流分类 ===");
        
        /*
         * 按方向分类：
         * - 输入流(InputStream/Reader)：从数据源读取数据
         * - 输出流(OutputStream/Writer)：向目标写入数据
         * 
         * 按数据类型分类：
         * - 字节流(Byte Stream)：处理二进制数据，以字节为单位
         * - 字符流(Character Stream)：处理文本数据，以字符为单位
         * 
         * 按功能分类：
         * - 节点流：直接连接数据源/目标的流
         * - 处理流：对其他流进行包装，提供附加功能
         */
        
        demonstrateStreamTypes();
    }
    
    private static void demonstrateStreamTypes() {
        System.out.println("\n=== 流类型演示 ===");
        
        // 字节流示例
        System.out.println("字节流特点：");
        System.out.println("- 以byte为单位读写数据");
        System.out.println("- 适合处理二进制文件（图片、音频、压缩包等）");
        System.out.println("- 基类：InputStream/OutputStream");
        
        // 字符流示例
        System.out.println("\n字符流特点：");
        System.out.println("- 以char为单位读写数据");
        System.out.println("- 适合处理文本文件");
        System.out.println("- 基类：Reader/Writer");
        System.out.println("- 自动处理字符编码转换");
        
        // 缓冲流示例
        System.out.println("\n缓冲流特点：");
        System.out.println("- 内置缓冲区，减少系统调用次数");
        System.out.println("- 显著提高IO性能");
        System.out.println("- BufferedInputStream/BufferedReader");
    }
}
```

### 📝 文本文件读写

```java
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.List;
import java.util.ArrayList;

/**
 * 文本文件读写操作详解
 */
public class TextFileOperations {
    
    public static void main(String[] args) {
        String filePath = "data/sample-data.txt";
        String outputPath = "data/processed-data.txt";
        
        // 确保目录存在
        createDirectoryIfNotExists("data");
        
        // 1. 传统IO方式
        System.out.println("=== 传统IO方式 ===");
        traditionalFileWrite(filePath);
        traditionalFileRead(filePath);
        
        // 2. NIO.2方式（推荐）
        System.out.println("\n=== NIO.2方式 ===");
        nioFileWrite(outputPath);
        nioFileRead(outputPath);
        
        // 3. 缓冲流方式（高性能）
        System.out.println("\n=== 缓冲流方式 ===");
        bufferedFileOperations("data/buffered-data.txt");
    }
    
    /**
     * 传统IO方式写文件
     */
    private static void traditionalFileWrite(String filePath) {
        System.out.println("使用传统IO写文件: " + filePath);
        
        try (FileWriter writer = new FileWriter(filePath, StandardCharsets.UTF_8)) {
            writer.write("# 数据处理示例文件\n");
            writer.write("timestamp,user_id,action,value\n");
            writer.write("2024-01-15 10:30:00,user001,login,1\n");
            writer.write("2024-01-15 10:31:15,user001,view_page,home\n");
            writer.write("2024-01-15 10:32:30,user002,login,1\n");
            writer.write("2024-01-15 10:33:45,user001,purchase,299.99\n");
            writer.write("2024-01-15 10:35:00,user002,view_page,product\n");
            
            System.out.println("文件写入完成");
        } catch (IOException e) {
            System.err.println("写文件出错: " + e.getMessage());
        }
    }
    
    /**
     * 传统IO方式读文件
     */
    private static void traditionalFileRead(String filePath) {
        System.out.println("使用传统IO读文件: " + filePath);
        
        try (FileReader reader = new FileReader(filePath, StandardCharsets.UTF_8);
             BufferedReader bufferedReader = new BufferedReader(reader)) {
            
            String line;
            int lineNumber = 0;
            
            while ((line = bufferedReader.readLine()) != null) {
                lineNumber++;
                System.out.println("第" + lineNumber + "行: " + line);
            }
            
            System.out.println("共读取 " + lineNumber + " 行数据");
            
        } catch (IOException e) {
            System.err.println("读文件出错: " + e.getMessage());
        }
    }
    
    /**
     * NIO.2方式文件操作（Java 7+推荐方式）
     */
    private static void nioFileWrite(String filePath) {
        System.out.println("使用NIO.2写文件: " + filePath);
        
        List<String> lines = new ArrayList<>();
        lines.add("# 使用NIO.2处理的数据文件");
        lines.add("product_id,product_name,category,price,stock");
        lines.add("P001,笔记本电脑,电子产品,8999.00,50");
        lines.add("P002,无线鼠标,电子产品,199.00,200");
        lines.add("P003,机械键盘,电子产品,599.00,100");
        lines.add("P004,显示器,电子产品,2999.00,30");
        lines.add("P005,充电宝,电子产品,299.00,150");
        
        try {
            Path path = Paths.get(filePath);
            Files.write(path, lines, StandardCharsets.UTF_8, 
                       StandardOpenOption.CREATE, StandardOpenOption.WRITE, StandardOpenOption.TRUNCATE_EXISTING);
            
            System.out.println("NIO.2文件写入完成，共写入 " + lines.size() + " 行");
            
        } catch (IOException e) {
            System.err.println("NIO.2写文件出错: " + e.getMessage());
        }
    }
    
    /**
     * NIO.2方式读文件
     */
    private static void nioFileRead(String filePath) {
        System.out.println("使用NIO.2读文件: " + filePath);
        
        try {
            Path path = Paths.get(filePath);
            
            // 方式1: 读取所有行
            List<String> allLines = Files.readAllLines(path, StandardCharsets.UTF_8);
            System.out.println("读取到 " + allLines.size() + " 行数据:");
            
            for (int i = 0; i < allLines.size(); i++) {
                System.out.println("  " + (i + 1) + ": " + allLines.get(i));
            }
            
            // 方式2: 流式读取（适合大文件）
            System.out.println("\n流式读取示例:");
            try (java.util.stream.Stream<String> lines = Files.lines(path, StandardCharsets.UTF_8)) {
                lines.filter(line -> !line.startsWith("#")) // 过滤注释行
                     .filter(line -> line.contains("电子产品")) // 过滤特定类别
                     .forEach(line -> System.out.println("  电子产品: " + line));
            }
                 
        } catch (IOException e) {
            System.err.println("NIO.2读文件出错: " + e.getMessage());
        }
    }
    
    /**
     * 缓冲流高性能文件操作
     */
    private static void bufferedFileOperations(String filePath) {
        System.out.println("使用缓冲流进行高性能文件操作: " + filePath);
        
        // 写入大量数据来演示性能
        long startTime = System.currentTimeMillis();
        
        try (BufferedWriter writer = Files.newBufferedWriter(Paths.get(filePath), StandardCharsets.UTF_8)) {
            
            writer.write("# 大数据量测试文件\n");
            writer.write("id,random_value,timestamp\n");
            
            // 生成10000条测试数据
            for (int i = 1; i <= 10000; i++) {
                String line = String.format("%d,%.2f,%d\n", 
                    i, Math.random() * 1000, System.currentTimeMillis());
                writer.write(line);
                
                // 每1000行打印一次进度
                if (i % 1000 == 0) {
                    System.out.println("  已写入 " + i + " 行数据");
                }
            }
            
        } catch (IOException e) {
            System.err.println("缓冲写入出错: " + e.getMessage());
        }
        
        long writeTime = System.currentTimeMillis() - startTime;
        System.out.println("写入完成，耗时: " + writeTime + " ms");
        
        // 读取和分析数据
        startTime = System.currentTimeMillis();
        
        try (BufferedReader reader = Files.newBufferedReader(Paths.get(filePath), StandardCharsets.UTF_8)) {
            
            String line;
            int totalLines = 0;
            double sum = 0.0;
            double max = Double.NEGATIVE_INFINITY;
            double min = Double.MAX_VALUE;
            
            // 跳过标题行
            reader.readLine(); // #注释行
            reader.readLine(); // 标题行
            
            while ((line = reader.readLine()) != null) {
                String[] parts = line.split(",");
                if (parts.length >= 2) {
                    try {
                        double value = Double.parseDouble(parts[1]);
                        sum += value;
                        max = Math.max(max, value);
                        min = Math.min(min, value);
                        totalLines++;
                    } catch (NumberFormatException e) {
                        System.err.println("数据格式错误: " + line);
                    }
                }
            }
            
            if (totalLines > 0) {
                double average = sum / totalLines;
                System.out.println("数据分析结果:");
                System.out.println("  总行数: " + totalLines);
                System.out.println("  数值总和: " + String.format("%.2f", sum));
                System.out.println("  平均值: " + String.format("%.2f", average));
                System.out.println("  最大值: " + String.format("%.2f", max));
                System.out.println("  最小值: " + String.format("%.2f", min));
            }
            
        } catch (IOException e) {
            System.err.println("缓冲读取出错: " + e.getMessage());
        }
        
        long readTime = System.currentTimeMillis() - startTime;
        System.out.println("读取分析完成，耗时: " + readTime + " ms");
    }
    
    /**
     * 创建目录（如果不存在）
     */
    private static void createDirectoryIfNotExists(String dirPath) {
        try {
            Path path = Paths.get(dirPath);
            if (!Files.exists(path)) {
                Files.createDirectories(path);
                System.out.println("创建目录: " + dirPath);
            }
        } catch (IOException e) {
            System.err.println("创建目录失败: " + e.getMessage());
        }
    }
}
```

## 📊 常见数据格式处理

### 🎯 CSV文件处理

CSV是数据处理中最常见的格式之一：

```java
import com.opencsv.*;
import com.opencsv.exceptions.CsvException;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * CSV文件处理专业工具类
 */
public class CSVProcessor {
    
    public static void main(String[] args) {
        String csvFile = "data/sales-data.csv";
        String outputFile = "data/processed-sales.csv";
        
        // 创建示例数据
        createSampleCSV(csvFile);
        
        // 读取和处理CSV
        List<SalesRecord> records = readCSVRecords(csvFile);
        
        // 数据分析
        analyzeData(records);
        
        // 处理数据并输出
        List<SalesRecord> processedRecords = processData(records);
        writeCSVRecords(outputFile, processedRecords);
    }
    
    /**
     * 销售记录数据模型
     */
    public static class SalesRecord {
        private String orderId;
        private String productName;
        private String category;
        private double unitPrice;
        private int quantity;
        private String customerType;
        private String orderDate;
        private double totalAmount;
        
        // 构造方法
        public SalesRecord(String orderId, String productName, String category, 
                          double unitPrice, int quantity, String customerType, String orderDate) {
            this.orderId = orderId;
            this.productName = productName;
            this.category = category;
            this.unitPrice = unitPrice;
            this.quantity = quantity;
            this.customerType = customerType;
            this.orderDate = orderDate;
            this.totalAmount = unitPrice * quantity;
        }
        
        // Getter和Setter方法
        public String getOrderId() { return orderId; }
        public String getProductName() { return productName; }
        public String getCategory() { return category; }
        public double getUnitPrice() { return unitPrice; }
        public int getQuantity() { return quantity; }
        public String getCustomerType() { return customerType; }
        public String getOrderDate() { return orderDate; }
        public double getTotalAmount() { return totalAmount; }
        
        public void setTotalAmount(double totalAmount) { this.totalAmount = totalAmount; }
        
        @Override
        public String toString() {
            return String.format("SalesRecord{orderId='%s', product='%s', category='%s', " +
                    "unitPrice=%.2f, quantity=%d, total=%.2f, customer='%s', date='%s'}",
                    orderId, productName, category, unitPrice, quantity, totalAmount, customerType, orderDate);
        }
    }
    
    /**
     * 创建示例CSV文件
     */
    private static void createSampleCSV(String filePath) {
        System.out.println("创建示例CSV文件: " + filePath);
        
        String[] headers = {"订单ID", "商品名称", "类别", "单价", "数量", "客户类型", "订单日期"};
        String[][] data = {
            {"ORD001", "笔记本电脑", "电子产品", "8999.00", "2", "企业客户", "2024-01-15"},
            {"ORD002", "无线鼠标", "电子产品", "199.00", "5", "个人客户", "2024-01-15"},
            {"ORD003", "办公椅", "办公用品", "1299.00", "3", "企业客户", "2024-01-16"},
            {"ORD004", "显示器", "电子产品", "2999.00", "1", "个人客户", "2024-01-16"},
            {"ORD005", "键盘", "电子产品", "599.00", "4", "个人客户", "2024-01-17"},
            {"ORD006", "打印纸", "办公用品", "29.90", "20", "企业客户", "2024-01-17"},
            {"ORD007", "充电宝", "电子产品", "299.00", "8", "个人客户", "2024-01-18"},
            {"ORD008", "文件夹", "办公用品", "15.50", "50", "企业客户", "2024-01-18"}
        };
        
        try (Writer output = new FileWriter(filePath, StandardCharsets.UTF_8);
             CSVWriter writer = new CSVWriter(output)) {
            // 写入UTF-8 BOM，帮助Excel识别中文编码
            output.write("\uFEFF");
            
            // 写入标题行
            writer.writeNext(headers);
            
            // 写入数据行
            for (String[] row : data) {
                writer.writeNext(row);
            }
            
            System.out.println("CSV文件创建完成，共写入 " + (data.length + 1) + " 行");
            
        } catch (IOException e) {
            System.err.println("创建CSV文件失败: " + e.getMessage());
        }
    }
    
    /**
     * 读取CSV文件并转换为对象列表
     */
    private static List<SalesRecord> readCSVRecords(String filePath) {
        System.out.println("读取CSV文件: " + filePath);
        List<SalesRecord> records = new ArrayList<>();
        
        try (CSVReader reader = new CSVReader(new FileReader(filePath, StandardCharsets.UTF_8))) {
            
            // 跳过标题行
            String[] headers = reader.readNext();
            System.out.println("CSV标题: " + String.join(", ", headers));
            
            String[] line;
            int lineNumber = 1;
            
            while ((line = reader.readNext()) != null) {
                lineNumber++;
                
                try {
                    if (line.length >= 7) {
                        SalesRecord record = new SalesRecord(
                            line[0].trim(),                           // 订单ID
                            line[1].trim(),                           // 商品名称
                            line[2].trim(),                           // 类别
                            Double.parseDouble(line[3].trim()),       // 单价
                            Integer.parseInt(line[4].trim()),         // 数量
                            line[5].trim(),                           // 客户类型
                            line[6].trim()                            // 订单日期
                        );
                        
                        records.add(record);
                        
                    } else {
                        System.err.println("第 " + lineNumber + " 行数据格式不正确: " + String.join(",", line));
                    }
                    
                } catch (NumberFormatException e) {
                    System.err.println("第 " + lineNumber + " 行数据类型转换错误: " + e.getMessage());
                }
            }
            
        } catch (IOException | CsvException e) {
            System.err.println("读取CSV文件失败: " + e.getMessage());
        }
        
        System.out.println("成功读取 " + records.size() + " 条销售记录");
        return records;
    }
    
    /**
     * 数据分析
     */
    private static void analyzeData(List<SalesRecord> records) {
        System.out.println("\n=== 销售数据分析 ===");
        
        if (records.isEmpty()) {
            System.out.println("没有数据可分析");
            return;
        }
        
        // 基础统计
        double totalRevenue = records.stream().mapToDouble(SalesRecord::getTotalAmount).sum();
        int totalQuantity = records.stream().mapToInt(SalesRecord::getQuantity).sum();
        double avgOrderValue = totalRevenue / records.size();
        
        System.out.println("基础统计:");
        System.out.println("  总订单数: " + records.size());
        System.out.println("  总销售额: " + String.format("%.2f", totalRevenue));
        System.out.println("  总销售量: " + totalQuantity);
        System.out.println("  平均订单价值: " + String.format("%.2f", avgOrderValue));
        
        // 按类别分析
        Map<String, Double> categoryRevenue = new HashMap<>();
        Map<String, Integer> categoryCount = new HashMap<>();
        
        for (SalesRecord record : records) {
            String category = record.getCategory();
            categoryRevenue.merge(category, record.getTotalAmount(), Double::sum);
            categoryCount.merge(category, 1, Integer::sum);
        }
        
        System.out.println("\n按类别分析:");
        for (String category : categoryRevenue.keySet()) {
            double revenue = categoryRevenue.get(category);
            int count = categoryCount.get(category);
            double percentage = (revenue / totalRevenue) * 100;
            
            System.out.println("  " + category + ":");
            System.out.println("    订单数: " + count);
            System.out.println("    销售额: " + String.format("%.2f", revenue));
            System.out.println("    占比: " + String.format("%.1f%%", percentage));
        }
        
        // 按客户类型分析
        Map<String, Double> customerTypeRevenue = new HashMap<>();
        for (SalesRecord record : records) {
            customerTypeRevenue.merge(record.getCustomerType(), record.getTotalAmount(), Double::sum);
        }
        
        System.out.println("\n按客户类型分析:");
        for (String customerType : customerTypeRevenue.keySet()) {
            double revenue = customerTypeRevenue.get(customerType);
            double percentage = (revenue / totalRevenue) * 100;
            System.out.println("  " + customerType + ": " + 
                String.format("%.2f", revenue) + " (" + String.format("%.1f%%", percentage) + ")");
        }
        
        // 找出最大订单
        SalesRecord maxOrder = records.stream()
            .max(Comparator.comparing(SalesRecord::getTotalAmount))
            .orElse(null);
        
        if (maxOrder != null) {
            System.out.println("\n最大订单:");
            System.out.println("  " + maxOrder);
        }
    }
    
    /**
     * 数据处理：添加折扣计算
     */
    private static List<SalesRecord> processData(List<SalesRecord> records) {
        System.out.println("\n=== 数据处理：计算折扣 ===");
        
        List<SalesRecord> processedRecords = new ArrayList<>();
        
        for (SalesRecord record : records) {
            // 复制记录
            SalesRecord processedRecord = new SalesRecord(
                record.getOrderId(),
                record.getProductName(),
                record.getCategory(),
                record.getUnitPrice(),
                record.getQuantity(),
                record.getCustomerType(),
                record.getOrderDate()
            );
            
            // 应用业务规则计算折扣
            double originalAmount = record.getTotalAmount();
            double discount = calculateDiscount(record);
            double finalAmount = originalAmount * (1 - discount);
            
            processedRecord.setTotalAmount(finalAmount);
            processedRecords.add(processedRecord);
            
            if (discount > 0) {
                System.out.println("订单 " + record.getOrderId() + 
                    " 应用 " + String.format("%.1f%%", discount * 100) + 
                    " 折扣，金额从 " + String.format("%.2f", originalAmount) + 
                    " 调整为 " + String.format("%.2f", finalAmount));
            }
        }
        
        return processedRecords;
    }
    
    /**
     * 计算折扣的业务逻辑
     */
    private static double calculateDiscount(SalesRecord record) {
        double discount = 0.0;
        
        // 企业客户享受5%折扣
        if ("企业客户".equals(record.getCustomerType())) {
            discount += 0.05;
        }
        
        // 大单折扣：订单金额超过10000享受额外3%折扣
        if (record.getTotalAmount() > 10000) {
            discount += 0.03;
        }
        
        // 批量购买折扣：数量超过10件享受2%折扣
        if (record.getQuantity() > 10) {
            discount += 0.02;
        }
        
        // 最大折扣限制10%
        return Math.min(discount, 0.10);
    }
    
    /**
     * 写入处理后的CSV文件
     */
    private static void writeCSVRecords(String filePath, List<SalesRecord> records) {
        System.out.println("\n写入处理后的CSV文件: " + filePath);
        
        try (CSVWriter writer = new CSVWriter(new FileWriter(filePath, StandardCharsets.UTF_8))) {
            
            // 写入标题行
            String[] headers = {"订单ID", "商品名称", "类别", "单价", "数量", "客户类型", "订单日期", "最终金额"};
            writer.writeNext(headers);
            
            // 写入数据行
            for (SalesRecord record : records) {
                String[] row = {
                    record.getOrderId(),
                    record.getProductName(),
                    record.getCategory(),
                    String.valueOf(record.getUnitPrice()),
                    String.valueOf(record.getQuantity()),
                    record.getCustomerType(),
                    record.getOrderDate(),
                    String.format("%.2f", record.getTotalAmount())
                };
                writer.writeNext(row);
            }
            
            System.out.println("CSV文件写入完成，共 " + records.size() + " 条记录");
            
        } catch (IOException e) {
            System.err.println("写入CSV文件失败: " + e.getMessage());
        }
    }
}
```

### 🎯 JSON数据处理

JSON是现代数据交换的主要格式：

```java
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.fasterxml.jackson.core.type.TypeReference;
import java.io.*;
import java.util.*;

/**
 * JSON数据处理工具类
 */
public class JSONProcessor {
    
    private static final ObjectMapper objectMapper = new ObjectMapper();
    
    public static void main(String[] args) {
        // 1. 创建示例JSON数据
        createSampleJSON();
        
        // 2. 读取和解析JSON
        parseJSONData();
        
        // 3. JSON数据转换
        transformJSONData();
        
        // 4. 处理复杂嵌套JSON
        processNestedJSON();
    }
    
    /**
     * 用户数据模型
     */
    public static class User {
        private String userId;
        private String username;
        private String email;
        private int age;
        private List<String> interests;
        private Map<String, Object> metadata;
        
        // 构造方法
        public User() {}
        
        public User(String userId, String username, String email, int age) {
            this.userId = userId;
            this.username = username;
            this.email = email;
            this.age = age;
            this.interests = new ArrayList<>();
            this.metadata = new HashMap<>();
        }
        
        // Getter和Setter方法
        public String getUserId() { return userId; }
        public void setUserId(String userId) { this.userId = userId; }
        
        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
        
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        
        public int getAge() { return age; }
        public void setAge(int age) { this.age = age; }
        
        public List<String> getInterests() { return interests; }
        public void setInterests(List<String> interests) { this.interests = interests; }
        
        public Map<String, Object> getMetadata() { return metadata; }
        public void setMetadata(Map<String, Object> metadata) { this.metadata = metadata; }
        
        @Override
        public String toString() {
            return String.format("User{userId='%s', username='%s', email='%s', age=%d, interests=%s}",
                    userId, username, email, age, interests);
        }
    }
    
    /**
     * 创建示例JSON数据文件
     */
    private static void createSampleJSON() {
        System.out.println("=== 创建示例JSON数据 ===");
        
        try {
            // 创建用户数据
            List<User> users = new ArrayList<>();
            
            User user1 = new User("U001", "张三", "zhangsan@example.com", 28);
            user1.getInterests().addAll(Arrays.asList("编程", "数据分析", "机器学习"));
            user1.getMetadata().put("registerDate", "2023-01-15");
            user1.getMetadata().put("loginCount", 125);
            user1.getMetadata().put("vipLevel", "Gold");
            
            User user2 = new User("U002", "李四", "lisi@example.com", 32);
            user2.getInterests().addAll(Arrays.asList("大数据", "云计算", "人工智能"));
            user2.getMetadata().put("registerDate", "2023-02-20");
            user2.getMetadata().put("loginCount", 89);
            user2.getMetadata().put("vipLevel", "Silver");
            
            User user3 = new User("U003", "王五", "wangwu@example.com", 25);
            user3.getInterests().addAll(Arrays.asList("前端开发", "用户体验", "产品设计"));
            user3.getMetadata().put("registerDate", "2023-03-10");
            user3.getMetadata().put("loginCount", 256);
            user3.getMetadata().put("vipLevel", "Platinum");
            
            users.add(user1);
            users.add(user2);
            users.add(user3);
            
            // 写入JSON文件
            objectMapper.writerWithDefaultPrettyPrinter()
                       .writeValue(new File("data/users.json"), users);
            
            System.out.println("用户JSON文件创建完成");
            
            // 创建复杂的嵌套JSON
            createComplexJSON();
            
        } catch (IOException e) {
            System.err.println("创建JSON文件失败: " + e.getMessage());
        }
    }
    
    /**
     * 创建复杂的嵌套JSON结构
     */
    private static void createComplexJSON() throws IOException {
        // 使用JsonNode构建复杂结构
        ObjectNode rootNode = objectMapper.createObjectNode();
        rootNode.put("reportId", "RPT-2024-001");
        rootNode.put("generatedAt", System.currentTimeMillis());
        rootNode.put("reportType", "用户行为分析");
        
        // 添加数据汇总
        ObjectNode summaryNode = objectMapper.createObjectNode();
        summaryNode.put("totalUsers", 1250);
        summaryNode.put("activeUsers", 892);
        summaryNode.put("newUsers", 156);
        summaryNode.put("avgSessionTime", 18.5);
        rootNode.set("summary", summaryNode);
        
        // 添加分类数据
        ArrayNode categoriesNode = objectMapper.createArrayNode();
        
        ObjectNode category1 = objectMapper.createObjectNode();
        category1.put("name", "移动端用户");
        category1.put("count", 750);
        category1.put("percentage", 60.0);
        
        ArrayNode topPages1 = objectMapper.createArrayNode();
        topPages1.add("首页");
        topPages1.add("产品列表");
        topPages1.add("个人中心");
        category1.set("topPages", topPages1);
        
        ObjectNode category2 = objectMapper.createObjectNode();
        category2.put("name", "桌面端用户");
        category2.put("count", 500);
        category2.put("percentage", 40.0);
        
        ArrayNode topPages2 = objectMapper.createArrayNode();
        topPages2.add("数据分析");
        topPages2.add("报表查看");
        topPages2.add("系统设置");
        category2.set("topPages", topPages2);
        
        categoriesNode.add(category1);
        categoriesNode.add(category2);
        rootNode.set("categories", categoriesNode);
        
        // 添加时间序列数据
        ArrayNode timeSeriesNode = objectMapper.createArrayNode();
        String[] dates = {"2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"};
        int[] values = {120, 135, 98, 156, 142};
        
        for (int i = 0; i < dates.length; i++) {
            ObjectNode dataPoint = objectMapper.createObjectNode();
            dataPoint.put("date", dates[i]);
            dataPoint.put("activeUsers", values[i]);
            dataPoint.put("growth", i > 0 ? ((double)(values[i] - values[i-1]) / values[i-1] * 100) : 0.0);
            timeSeriesNode.add(dataPoint);
        }
        rootNode.set("timeSeries", timeSeriesNode);
        
        // 写入文件
        objectMapper.writerWithDefaultPrettyPrinter()
                   .writeValue(new File("data/complex-report.json"), rootNode);
        
        System.out.println("复杂JSON报表文件创建完成");
    }
    
    /**
     * 解析JSON数据
     */
    private static void parseJSONData() {
        System.out.println("\n=== 解析JSON数据 ===");
        
        try {
            // 方式1: 解析为对象列表
            System.out.println("方式1: 解析为Java对象");
            List<User> users = objectMapper.readValue(
                new File("data/users.json"), 
                new TypeReference<List<User>>() {}
            );
            
            System.out.println("读取到 " + users.size() + " 个用户:");
            for (User user : users) {
                System.out.println("  " + user);
                System.out.println("    兴趣: " + user.getInterests());
                System.out.println("    元数据: " + user.getMetadata());
            }
            
            // 方式2: 解析为JsonNode（更灵活）
            System.out.println("\n方式2: 解析为JsonNode");
            JsonNode rootNode = objectMapper.readTree(new File("data/users.json"));
            
            if (rootNode.isArray()) {
                System.out.println("JSON数组，包含 " + rootNode.size() + " 个元素");
                
                for (int i = 0; i < rootNode.size(); i++) {
                    JsonNode userNode = rootNode.get(i);
                    String userId = userNode.get("userId").asText();
                    String username = userNode.get("username").asText();
                    int age = userNode.get("age").asInt();
                    
                    System.out.println("  用户 " + (i + 1) + ": " + username + " (ID: " + userId + ", 年龄: " + age + ")");
                    
                    // 处理数组类型的字段
                    JsonNode interestsNode = userNode.get("interests");
                    if (interestsNode.isArray()) {
                        List<String> interests = new ArrayList<>();
                        for (JsonNode interestNode : interestsNode) {
                            interests.add(interestNode.asText());
                        }
                        System.out.println("    兴趣: " + interests);
                    }
                }
            }
            
        } catch (IOException e) {
            System.err.println("解析JSON数据失败: " + e.getMessage());
        }
    }
    
    /**
     * JSON数据转换
     */
    private static void transformJSONData() {
        System.out.println("\n=== JSON数据转换 ===");
        
        try {
            // 读取原始数据
            List<User> users = objectMapper.readValue(
                new File("data/users.json"), 
                new TypeReference<List<User>>() {}
            );
            
            // 数据转换：创建用户统计报告
            Map<String, Object> report = new HashMap<>();
            report.put("reportTitle", "用户数据分析报告");
            report.put("generatedAt", new Date().toString());
            report.put("totalUsers", users.size());
            
            // 年龄分布统计
            Map<String, Integer> ageGroups = new HashMap<>();
            ageGroups.put("18-25", 0);
            ageGroups.put("26-35", 0);
            ageGroups.put("36-45", 0);
            ageGroups.put("46+", 0);
            
            for (User user : users) {
                int age = user.getAge();
                if (age <= 25) {
                    ageGroups.merge("18-25", 1, Integer::sum);
                } else if (age <= 35) {
                    ageGroups.merge("26-35", 1, Integer::sum);
                } else if (age <= 45) {
                    ageGroups.merge("36-45", 1, Integer::sum);
                } else {
                    ageGroups.merge("46+", 1, Integer::sum);
                }
            }
            report.put("ageDistribution", ageGroups);
            
            // 兴趣统计
            Map<String, Integer> interestCount = new HashMap<>();
            for (User user : users) {
                for (String interest : user.getInterests()) {
                    interestCount.merge(interest, 1, Integer::sum);
                }
            }
            report.put("popularInterests", interestCount);
            
            // VIP等级统计
            Map<String, Integer> vipLevels = new HashMap<>();
            for (User user : users) {
                Object vipLevel = user.getMetadata().get("vipLevel");
                if (vipLevel != null) {
                    vipLevels.merge(vipLevel.toString(), 1, Integer::sum);
                }
            }
            report.put("vipDistribution", vipLevels);
            
            // 平均登录次数
            double avgLoginCount = users.stream()
                .mapToInt(u -> (Integer) u.getMetadata().getOrDefault("loginCount", 0))
                .average()
                .orElse(0.0);
            report.put("averageLoginCount", Math.round(avgLoginCount * 100.0) / 100.0);
            
            // 写入转换后的报告
            objectMapper.writerWithDefaultPrettyPrinter()
                       .writeValue(new File("data/user-report.json"), report);
            
            System.out.println("用户分析报告已生成: data/user-report.json");
            System.out.println("报告内容:");
            System.out.println("  总用户数: " + report.get("totalUsers"));
            System.out.println("  年龄分布: " + report.get("ageDistribution"));
            System.out.println("  热门兴趣: " + report.get("popularInterests"));
            System.out.println("  VIP分布: " + report.get("vipDistribution"));
            System.out.println("  平均登录次数: " + report.get("averageLoginCount"));
            
        } catch (IOException e) {
            System.err.println("JSON数据转换失败: " + e.getMessage());
        }
    }
    
    /**
     * 处理复杂嵌套JSON
     */
    private static void processNestedJSON() {
        System.out.println("\n=== 处理复杂嵌套JSON ===");
        
        try {
            JsonNode reportNode = objectMapper.readTree(new File("data/complex-report.json"));
            
            System.out.println("报告ID: " + reportNode.get("reportId").asText());
            System.out.println("报告类型: " + reportNode.get("reportType").asText());
            
            // 处理汇总数据
            JsonNode summaryNode = reportNode.get("summary");
            if (summaryNode != null) {
                System.out.println("\n数据汇总:");
                System.out.println("  总用户数: " + summaryNode.get("totalUsers").asInt());
                System.out.println("  活跃用户数: " + summaryNode.get("activeUsers").asInt());
                System.out.println("  新用户数: " + summaryNode.get("newUsers").asInt());
                System.out.println("  平均会话时长: " + summaryNode.get("avgSessionTime").asDouble() + " 分钟");
            }
            
            // 处理分类数据
            JsonNode categoriesNode = reportNode.get("categories");
            if (categoriesNode != null && categoriesNode.isArray()) {
                System.out.println("\n用户分类:");
                for (JsonNode categoryNode : categoriesNode) {
                    String name = categoryNode.get("name").asText();
                    int count = categoryNode.get("count").asInt();
                    double percentage = categoryNode.get("percentage").asDouble();
                    
                    System.out.println("  " + name + ": " + count + " 用户 (" + percentage + "%)");
                    
                    JsonNode topPagesNode = categoryNode.get("topPages");
                    if (topPagesNode != null && topPagesNode.isArray()) {
                        System.out.print("    热门页面: ");
                        List<String> pages = new ArrayList<>();
                        for (JsonNode pageNode : topPagesNode) {
                            pages.add(pageNode.asText());
                        }
                        System.out.println(String.join(", ", pages));
                    }
                }
            }
            
            // 处理时间序列数据
            JsonNode timeSeriesNode = reportNode.get("timeSeries");
            if (timeSeriesNode != null && timeSeriesNode.isArray()) {
                System.out.println("\n时间序列数据:");
                for (JsonNode dataPoint : timeSeriesNode) {
                    String date = dataPoint.get("date").asText();
                    int activeUsers = dataPoint.get("activeUsers").asInt();
                    double growth = dataPoint.get("growth").asDouble();
                    
                    System.out.println("  " + date + ": " + activeUsers + " 活跃用户 (增长: " + 
                        String.format("%.1f%%", growth) + ")");
                }
            }
            
            // 数据处理：计算样本期间累计活跃人次和相邻日期平均增长率
            processTimeSeriesData(timeSeriesNode);
            
        } catch (IOException e) {
            System.err.println("处理复杂JSON失败: " + e.getMessage());
        }
    }
    
    /**
     * 处理时间序列数据并计算统计指标
     */
    private static void processTimeSeriesData(JsonNode timeSeriesNode) {
        if (timeSeriesNode == null || !timeSeriesNode.isArray()) {
            return;
        }
        
        System.out.println("\n时间序列数据分析:");
        
        int totalActiveUsers = 0;
        double totalGrowth = 0.0;
        int dataPoints = 0;
        int maxUsers = 0;
        int minUsers = Integer.MAX_VALUE;
        String maxDate = "";
        String minDate = "";
        
        for (JsonNode dataPoint : timeSeriesNode) {
            int activeUsers = dataPoint.get("activeUsers").asInt();
            double growth = dataPoint.get("growth").asDouble();
            String date = dataPoint.get("date").asText();
            
            totalActiveUsers += activeUsers;
            // 首日growth为占位值，不纳入相邻日期增长率的平均值
            if (dataPoints > 0) {
                totalGrowth += growth;
            }
            dataPoints++;
            
            if (activeUsers > maxUsers) {
                maxUsers = activeUsers;
                maxDate = date;
            }
            
            if (activeUsers < minUsers) {
                minUsers = activeUsers;
                minDate = date;
            }
        }
        
        if (dataPoints > 0) {
            double avgActiveUsers = (double) totalActiveUsers / dataPoints;
            double avgGrowth = dataPoints > 1 ? totalGrowth / (dataPoints - 1) : 0.0;
            
            System.out.println("  数据点数量: " + dataPoints);
            System.out.println("  样本期间累计活跃人次（未跨日去重）: " + totalActiveUsers);
            System.out.println("  平均活跃用户数: " + String.format("%.1f", avgActiveUsers));
            System.out.println("  相邻日期平均增长率: " + (dataPoints > 1 ? String.format("%.2f%%", avgGrowth) : "无可比较日期，导出值以0占位"));
            System.out.println("  最高活跃用户数: " + maxUsers + " (" + maxDate + ")");
            System.out.println("  最低活跃用户数: " + minUsers + " (" + minDate + ")");
            
            // 创建处理后的数据摘要
            Map<String, Object> analysisSummary = new HashMap<>();
            analysisSummary.put("totalDataPoints", dataPoints);
            // 保留原导出字段名；此值为逐日活跃数之和，并非期间去重用户数
            analysisSummary.put("totalActiveUsers", totalActiveUsers);
            analysisSummary.put("averageActiveUsers", Math.round(avgActiveUsers * 100.0) / 100.0);
            analysisSummary.put("averageGrowthRate", Math.round(avgGrowth * 100.0) / 100.0);
            analysisSummary.put("maxActiveUsers", maxUsers);
            analysisSummary.put("maxActiveUsersDate", maxDate);
            analysisSummary.put("minActiveUsers", minUsers);
            analysisSummary.put("minActiveUsersDate", minDate);
            
            try {
                objectMapper.writerWithDefaultPrettyPrinter()
                           .writeValue(new File("data/timeseries-analysis.json"), analysisSummary);
                System.out.println("  时间序列分析结果已保存: data/timeseries-analysis.json");
            } catch (IOException e) {
                System.err.println("保存分析结果失败: " + e.getMessage());
            }
        }
    }
}
```

## 相关学习资源

### 继续学习
- **学习路线图**：[[【技术与工具】/Java/00-Java学习路线图|Java]]
- **基础语法入门**：[[【技术与工具】/Java/01-Java基础语法入门|Java基础语法]]
- **面向对象编程**：[[【技术与工具】/Java/03-Java面向对象编程|Java面向对象编程]]
- **Java在数据开发中的应用**：[[【技术与工具】/Java/05-Java在数据开发中的应用|Java在数据开发中的]]

### 高级主题
- **Java大数据技术栈**：[[【技术与工具】/Java/06-Java大数据技术栈|Java大数据技术栈]]
- **数据库操作与数据仓库开发**：[[【技术与工具】/Java/07-Java数据库操作与数据仓库开发|Java数据库操作与数据仓库开发]]