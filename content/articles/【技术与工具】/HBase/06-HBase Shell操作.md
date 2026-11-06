---
title: HBase Shell 操作
tags:
  - HBase
  - Shell
  - 命令行
  - 数据库管理
  - NoSQL
  - 运维工具
difficulty: 中级
duration: 60分钟
knowledge_type: technical-practice
target_audience:
  - 数据库管理员
  - 开发者
  - 数据开发工程师
  - 数据架构师
stability: slow-changing
status: maintenance
access_tier: free
created: 2024-12-11
updated: 2026-10-10
---


# HBase Shell 操作

> [!info] 前置知识
> - [[【技术与工具】/HBase/04-HBase环境搭建|HBase 环境搭建]] — 确保 HBase 集群已正常运行
> - [[【技术与工具】/HBase/02-HBase架构原理|HBase 架构原理]] — 了解 Region、ColumnFamily 等核心概念
> - [[【技术与工具】/HBase/03-HBase数据模型|HBase 数据模型]] — 理解 RowKey、列族、Cell 的结构

HBase Shell 是基于 JRuby 实现的交互式命令行工具，所有 DDL/DML 操作都可以在这里完成。对于数据库管理员来说，Shell 是日常运维最直接的入口；对于开发者来说，Shell 是验证数据和调试逻辑的快速工具。

---

## Shell 命令分类

| 命令类别 | 典型命令 | 用途 |
|---|---|---|
| **DDL（表定义）** | create, alter, drop, disable, enable | 表结构管理 |
| **DML（数据操作）** | put, get, scan, delete, deleteall | 数据读写 |
| **管理类** | status, version, flush, compact, split | 集群运维 |
| **命名空间** | create_namespace, list_namespace, drop_namespace | 多租户隔离 |
| **快照** | snapshot, restore_snapshot, clone_snapshot | 数据备份恢复 |

---

## 一、进入 Shell

```bash
# 启动 HBase Shell
hbase shell

# 以特定配置文件启动（指向远程集群时常用）
HBASE_CONF_DIR=/path/to/conf hbase shell

# 进入后看到提示符
hbase(main):001:0>
```

```shell
# 查看集群基本状态
hbase(main):001:0> status
# 输出示例：
# 1 active master, 0 backup masters, 3 servers, 0 dead, 21.6667 average load

hbase(main):002:0> version
# 输出：HBase 2.4.18, r..., compiled...

hbase(main):003:0> whoami
# 输出当前用户（Kerberos 环境会显示 principal）
```

---

## 二、DDL 操作

### 2.1 创建表

```shell
# 最简单的创建：表名 + 列族名
hbase(main):001:0> create 'users', 'info', 'contact'

# 创建时指定列族属性
# VERSIONS：保留多少个历史版本（默认 1）
# COMPRESSION：压缩算法（NONE/SNAPPY/LZO/GZ/LZ4）
# TTL：数据过期时间，单位秒（86400 = 1 天）
# BLOCKCACHE：是否启用读缓存（默认 true）
# IN_MEMORY：为该列族的数据块设置更高的 BlockCache 保留优先级，不表示预加载或保证整表驻留内存
hbase(main):002:0> create 'orders',
  {NAME => 'order_info', COMPRESSION => 'SNAPPY', VERSIONS => 1, TTL => 7776000},
  {NAME => 'payment',    COMPRESSION => 'SNAPPY', VERSIONS => 3, IN_MEMORY => true}

# 创建预分区表（根据预计数据量和 RowKey 分布规划，可缓解初始写入热点）
# SPLITS 定义了 Region 边界，N 个边界 = N+1 个 Region
hbase(main):003:0> create 'user_events', 'events',
  {SPLITS => ['10', '20', '30', '40', '50', '60', '70', '80', '90']}
# 效果：初始 10 个 Region，数据按 RowKey 字节序与分区边界分配；是否均匀取决于实际 RowKey 分布

# 用 Ruby Range 生成分区键（更简洁）
hbase(main):004:0> create 'sensor_data', 'metrics',
  {SPLITS => (1..9).map{|i| "sensor_#{i}0"}}

# 从文件读取分区键（适合大量分区点）
# 先创建文件：echo -e "row10\nrow20\nrow30" > /tmp/splits.txt
hbase(main):005:0> create 'large_table', 'cf',
  {SPLITS_FILE => '/tmp/splits.txt'}
```

> [!tip] 预分区的重要性
> 按本文未指定分区边界的普通建表方式，表初始只有 1 个 Region，写入由其所在的 RegionServer 承担，高并发时可能形成热点。Region 自动分裂不必然触发 Major Compaction；Compaction 与分裂的调度条件不同，均需评估资源开销。生产环境应根据数据量和 RowKey 分布决定是否预分区及分区数量，预分区本身不保证消除热点。

### 2.2 查看和修改表

```shell
# 列出所有表
hbase(main):001:0> list
# 用正则过滤
hbase(main):002:0> list 'user.*'

# 查看表描述信息（列族属性、表级配置等）；Region 分布另用 list_regions 查看
hbase(main):003:0> describe 'orders'

# 检查表是否存在
hbase(main):004:0> exists 'orders'

# 检查表是否处于启用状态
hbase(main):005:0> is_enabled 'orders'
hbase(main):006:0> is_disabled 'orders'

# 修改列族属性（不需要 disable 表）
hbase(main):007:0> alter 'orders', {NAME => 'order_info', COMPRESSION => 'LZ4'}

# 修改表级属性：调整最大 Region 大小（字节）
hbase(main):008:0> alter 'orders', MAX_FILESIZE => '21474836480'  # 20 GB

# 添加新列族
hbase(main):009:0> alter 'orders', {NAME => 'logistics', VERSIONS => 1}

# 删除列族（HBase 2.x 支持在线 alter；此例主动 disable，删除会丢失该列族数据）
hbase(main):010:0> disable 'orders'
hbase(main):011:0> alter 'orders', {NAME => 'logistics', METHOD => 'delete'}
hbase(main):012:0> enable 'orders'
```

### 2.3 禁用、启用和删除表

```shell
# disable：让表下线（所有 Region 关闭），drop 之前必须先 disable
hbase(main):001:0> disable 'orders'

# enable：重新上线
hbase(main):002:0> enable 'orders'

# drop：删除表（只能对 disabled 表执行）
hbase(main):003:0> disable 'test_table'
hbase(main):004:0> drop 'test_table'

# 批量禁用/删除（正则匹配）
hbase(main):005:0> disable_all 'test.*'
hbase(main):006:0> drop_all 'test.*'

# 截断表（删除所有数据，保留表结构）
# 等价于 disable + drop + create，会重建表
hbase(main):007:0> truncate 'orders'
```

---

## 三、DML 操作

### 3.1 写入数据（put）

```shell
# 基本格式：put '表名', 'RowKey', '列族:列名', '值'
hbase(main):001:0> put 'users', 'user_001', 'info:name', 'Alice'
hbase(main):002:0> put 'users', 'user_001', 'info:age', '28'
hbase(main):003:0> put 'users', 'user_001', 'info:city', 'Shanghai'
hbase(main):004:0> put 'users', 'user_001', 'contact:email', 'alice@example.com'
hbase(main):005:0> put 'users', 'user_001', 'contact:phone', '13812345678'

# 指定时间戳（毫秒级 Unix 时间戳）
hbase(main):006:0> put 'users', 'user_001', 'info:city', 'Beijing', 1700000000000

# HBase 的 put 是覆盖写：相同 RowKey + 列 + 时间戳 → 覆盖已有 Cell
# 如果时间戳不同，则会保存为新版本（VERSIONS 控制保留数量）
```

### 3.2 查询数据（get）

```shell
# 获取整行（所有列族的所有列）
hbase(main):001:0> get 'users', 'user_001'

# 只获取特定列族
hbase(main):002:0> get 'users', 'user_001', 'info'

# 只获取特定列
hbase(main):003:0> get 'users', 'user_001', 'info:name'

# 获取多列（数组语法）
hbase(main):004:0> get 'users', 'user_001', ['info:name', 'info:city', 'contact:email']

# 获取多个历史版本
hbase(main):005:0> get 'users', 'user_001', {COLUMN => 'info:city', VERSIONS => 3}

# 获取指定时间范围内的版本
hbase(main):006:0> get 'users', 'user_001', {COLUMN => 'info:city', TIMERANGE => [1699000000000, 1700000000000]}
```

### 3.3 扫描数据（scan）

`scan` 是 HBase 中最重要也最需要小心的操作，全表 scan 在大表上代价极高。

```shell
# 全表扫描（大表禁止这样用！）
hbase(main):001:0> scan 'users'

# 限制返回行数（调试时常用）
hbase(main):002:0> scan 'users', {LIMIT => 10}

# 指定 RowKey 范围（STARTROW 包含，STOPROW 不包含）
hbase(main):003:0> scan 'users', {STARTROW => 'user_001', STOPROW => 'user_010'}

# 前缀扫描 — 扫描所有以 'user_' 开头的行
hbase(main):004:0> scan 'users', {ROWPREFIXFILTER => 'user_'}

# 只返回特定列族或列
hbase(main):005:0> scan 'users', {COLUMNS => ['info:name', 'info:city'], LIMIT => 20}

# 设置扫描器 caching（每次 RPC 期望拉取的行数，实际返回量还受其他限制）
# 默认值需结合目标版本和配置确认；调大 CACHE 可能减少 RPC，但会增加单次请求开销
hbase(main):006:0> scan 'users', {LIMIT => 1000, CACHE => 100}

# 使用过滤器：只返回存在 info:age 且值等于字符串 28 的行
# 最后两个参数分别为 filterIfMissing 和 latestVersionOnly
hbase(main):007:0> scan 'users', {FILTER => "SingleColumnValueFilter('info','age',=,'binary:28',true,true)"}

# 使用行过滤器：RowKey 包含 'vip' 的行
hbase(main):008:0> scan 'users', {FILTER => "RowFilter(=,'substring:vip')"}

# 组合过滤器（AND/OR）；下例 binary:25 按字节序比较字符串，不等价于整数年龄 >= 25
hbase(main):009:0> scan 'users', {
  FILTER => "RowFilter(>=,'binary:user_100') AND SingleColumnValueFilter('info','age',>=,'binary:25')"
}
```

> [!warning] scan 性能注意事项
> - 避免全表 scan 大表，应始终设置 STARTROW/STOPROW 或 ROWPREFIXFILTER
> - CACHE 默认值需结合目标版本和配置确认；可在限定扫描范围内测试 100~500 等取值，并观察耗时、内存及超时情况，不保证固定提速幅度
> - 过滤器（Filter）在 RegionServer 端执行，可减少网络传输，但不能替代 RowKey 范围扫描的效率

### 3.4 删除数据（delete）

```shell
# 删除单个 Cell（默认删除最新版本）
hbase(main):001:0> delete 'users', 'user_001', 'info:city'

# 删除指定时间戳的 Cell
hbase(main):002:0> delete 'users', 'user_001', 'info:city', 1700000000000

# 删除整行所有 Cell
hbase(main):003:0> deleteall 'users', 'user_001'

# 统计表的行数（每 1000 行报告一次进度）
hbase(main):004:0> count 'users'
hbase(main):005:0> count 'users', INTERVAL => 1000, CACHE => 500
```

> [!note] HBase 的删除机制
> HBase 的 delete 是"标记删除"：写入一个 Tombstone 标记，数据并不立即从磁盘删除。正常 get/scan 会过滤被删除的版本，不会仅因尚未 Compaction 而将其展示出来。旧数据和删除标记可能继续占用存储空间；Major Compaction 是常见的清理时机，实际清理还受删除标记保留、时间范围及快照引用等条件影响，不能保证下一次执行就释放所有相关存储。

---

## 四、管理类操作

### 4.1 集群状态查看

```shell
# 简单状态概览
hbase(main):001:0> status
# 详细状态（含 RegionServer 列表和各节点负载）
hbase(main):002:0> status 'detailed'

# 查看某张表的 Region 分布
hbase(main):003:0> list_regions 'orders'

# 定位某个 RowKey 所在的 Region 和 RegionServer
hbase(main):004:0> locate_region 'orders', 'order_20240101_001'
```

### 4.2 Flush 和 Compaction

```shell
# Flush：将 MemStore 中的数据刷写到 HDFS（生成 HFile）
# 场景：重启 RegionServer 前，确保内存数据落盘
hbase(main):001:0> flush 'orders'

# 仅 flush hbase:meta 表，不会 flush 整个集群的所有表
hbase(main):002:0> flush 'hbase:meta'

# Minor Compaction：合并同一 Store 的部分 HFile（速度快）
hbase(main):003:0> compact 'orders'

# Major Compaction：合并 Store 内的 HFile，并在满足清理条件时清除被删除的数据和 Tombstone 标记
# 注意：Major Compaction 会消耗大量 IO，建议安排在业务低峰期
hbase(main):004:0> major_compact 'orders'

# 对单个 Region 做 compaction（避免整表压缩的影响）
hbase(main):005:0> major_compact 'orders,,1700000000000.abc123.'  # Region 名称从 list_regions 获取
```

### 4.3 快照管理

```shell
# 创建在线快照（无需禁用表，但可能触发 flush 并带来资源开销）
hbase(main):001:0> snapshot 'orders', 'orders_snapshot_20240101'

# 查看所有快照
hbase(main):002:0> list_snapshots

# 从快照克隆出新表（克隆后两张表独立）
hbase(main):003:0> clone_snapshot 'orders_snapshot_20240101', 'orders_backup'

# 从快照恢复（会覆盖当前表数据，需先 disable）
hbase(main):004:0> disable 'orders'
hbase(main):005:0> restore_snapshot 'orders_snapshot_20240101'
hbase(main):006:0> enable 'orders'

# 删除快照
hbase(main):007:0> delete_snapshot 'orders_snapshot_20240101'
```

### 4.4 命名空间管理

命名空间（Namespace）相当于关系型数据库中的 Database，用于多项目隔离。

```shell
# 查看所有命名空间（默认有 hbase 和 default 两个）
hbase(main):001:0> list_namespace

# 创建命名空间
hbase(main):002:0> create_namespace 'dw_prod'

# 在命名空间下创建表（格式：namespace:tablename）
hbase(main):003:0> create 'dw_prod:orders', 'order_info', 'payment'

# 查看命名空间下的表
hbase(main):004:0> list_namespace_tables 'dw_prod'

# 删除命名空间（必须先删除其下所有表）
hbase(main):005:0> drop_namespace 'dw_prod'
```

---

## 五、常见操作陷阱

### 5.1 大表 scan 无限等待

```shell
# 错误：对百亿行的大表不加限制地 scan
hbase(main):001:0> scan 'huge_table'   # 不要这样做

# 正确：始终设置范围或限制
hbase(main):001:0> scan 'huge_table', {STARTROW => 'row_prefix_001', STOPROW => 'row_prefix_002', LIMIT => 1000, CACHE => 100}
```

### 5.2 删表前未创建备份

```shell
# 错误：直接 disable + drop
hbase(main):001:0> disable 'important_table'
hbase(main):002:0> drop 'important_table'

# 正确：先快照备份，再操作
hbase(main):001:0> snapshot 'important_table', 'important_table_backup_20240101'
hbase(main):002:0> count 'important_table'   # 记录行数，用于恢复后验证
hbase(main):003:0> disable 'important_table'
hbase(main):004:0> drop 'important_table'
```

### 5.3 逐行写入导致性能极差

```shell
# 在 Shell 中批量插入测试数据时，用循环是合理的（小批量调试）
# 但生产环境大批量写入应使用 Java API 的 BufferedMutator 或 BulkLoad

# Shell 中循环写入示例（仅适合写入数百行的测试场景）
hbase(main):001:0> (1..100).each do |i|
  put 'users', "user_#{i.to_s.rjust(5,'0')}", 'info:seq', i.to_s
end; nil
# 末尾加 '; nil' 避免 Shell 打印每次 put 的返回值，减少输出噪音
```

### 5.4 忘记 disable 就 drop

```shell
hbase(main):001:0> drop 'active_table'
# 报错：ERROR: Table active_table is enabled. Disable it first.
# HBase 会拒绝 drop 一个 enabled 的表，这是保护机制
```

---

## 六、实用运维脚本

HBase Shell 底层是 JRuby，可以编写完整的 Ruby 脚本通过 `hbase shell script.rb` 执行。

### 6.1 批量检查表健康状态

```ruby
# check_tables.rb — 检查所有表的状态
list.each do |table_name|
  enabled = is_enabled(table_name) ? "ENABLED" : "DISABLED"
  puts "#{table_name.ljust(40)} #{enabled}"
end
```

```bash
# 执行方式
hbase shell check_tables.rb
```

### 6.2 批量 Flush 指定前缀的表

```ruby
# flush_tables.rb — 刷新匹配前缀的所有表
prefix = ARGV[0] || 'dw_'
list.grep(/^#{prefix}/).each do |t|
  puts "Flushing #{t}..."
  flush t
  puts "Done: #{t}"
end
```

```bash
hbase shell flush_tables.rb dw_prod
```

### 6.3 表行数统计脚本

```ruby
# count_all.rb — 统计所有表的行数（生产慎用，数据量大时耗时长）
list.each do |table_name|
  next if table_name.start_with?('hbase:')  # 跳过系统表
  begin
    row_count = count table_name, {INTERVAL => 10000, CACHE => 500}
    puts "#{table_name.ljust(40)} #{row_count} rows"
  rescue => e
    puts "#{table_name.ljust(40)} ERROR: #{e.message}"
  end
end
```

---

## Shell 与 Java API 对应关系

| Shell 命令 | Java API 等价调用 |
|---|---|
| `create 'table', 'cf'` | `admin.createTable(TableDescriptor)` |
| `put 'table', 'row', 'cf:col', 'val'` | `table.put(new Put(row).addColumn(...))` |
| `get 'table', 'row'` | `table.get(new Get(row))` |
| `scan 'table', {LIMIT => 100}` | `table.getScanner(new Scan().setLimit(100))` |
| `delete 'table', 'row', 'cf:col'` | `table.delete(new Delete(row).addColumn(...))` |
| `flush 'table'` | `admin.flush(TableName.valueOf("table"))` |
| `major_compact 'table'` | `admin.majorCompact(TableName.valueOf("table"))` |

---

## 掌握检查

- [ ] 能用 `create` 命令创建带预分区和列族压缩配置的表
- [ ] 理解 `scan` 的 CACHE 参数含义，知道什么情况下需要调整
- [ ] 能用 `snapshot` 和 `restore_snapshot` 完成表的备份恢复
- [ ] 知道 `delete` 是标记删除，正常查询会过滤被删除版本，Major Compaction 可在满足条件时清理相关数据与标记
- [ ] 能编写简单的 Ruby 脚本通过 `hbase shell script.rb` 批量操作

## 实践练习

1. **基础题**：创建一张 `user_profile` 表，包含 `basic`（压缩 SNAPPY，保留 1 版本）和 `behavior`（保留 5 版本，TTL 30 天）两个列族，并创建 9 个预分区。写入 5 行数据后用 scan 验证。
2. **进阶题**：对一张大表执行 scan，分别测试 CACHE=1 和 CACHE=200 的耗时差异，记录结果并解释原因。
3. **挑战题**：编写一个 Ruby 脚本，遍历指定命名空间下的所有表，输出每张表的列族数量、压缩算法和版本数，格式化为表格输出。

## 下一步

- [[【技术与工具】/HBase/07-Java API编程|Java API 编程]] — 用代码实现 Shell 能做的所有操作，并学习 BufferedMutator 批量写入
- [[【技术与工具】/HBase/08-表设计与模式|表设计与模式]] — 深入 RowKey 设计、Schema 设计模式，构建生产级表结构

---

**创建时间**：2024-12-11
**更新时间**：2026-03-21
**预计学习时长**：60 分钟

#HBase #Shell #命令行 #数据库管理 #NoSQL #运维工具
