---
title: Paimon快照管理 - 版本控制与过期清理
tags:
  - Paimon
  - 快照
  - Tag
  - 数据回滚
  - 生命周期管理
created: 2024-12-05
updated: 2026-10-10
difficulty: 中级
duration: 25分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据治理工程师
stability: slow-changing
status: maintenance
access_tier: free
---


# 📸 Paimon快照管理 - 版本控制与过期清理

> [!abstract] 📋 本节概览
> - 🎯 **学习目标**:掌握Paimon的快照生命周期管理，配置自动清理和长期归档策略
> - 📚 **前置知识**:[[【技术与工具】/Paimon/08-Paimon Schema演进|Paimon Schema演进]]
> - ⏱️ **预计用时**:25分钟
> - 🔧 **核心内容**:Snapshot过期配置、Tag自动创建、数据回滚(Rollback)、孤儿文件清理
> - 💡 **关键收获**:能够平衡存储成本与数据回溯需求，保证系统稳定运行

## 🎯 快照 (Snapshot) vs 标签 (Tag)

Paimon提供了两级版本管理机制：**Snapshot** 和 **Tag**。

| 特性 | 快照 (Snapshot) | 标签 (Tag) |
|---|---|---|
| **定义** | 每次Commit生成的即时状态记录 | 基于某个快照生成的永久/长期标记 |
| **生成频率** | 极高 (几秒~几分钟一次) | 较低 (通常每天/每周一次) |
| **生命周期** | 短暂 (默认保留1小时) | 长期 (可保留数天、数月甚至永久) |
| **用途** | 增量读取、故障恢复、短时回溯 | 历史备份、离线分析、审计 |
| **存储成本** | 较高 (如果不清理) | 较低 (复用数据文件，只保留引用) |

---

## ⏳ 快照过期清理 (Snapshot Expiration)

Paimon会自动清理过期的快照，以释放不再使用的数据文件空间。

### 核心配置参数

| 参数 | 默认值 | 说明 |
|---|---|---|
| `snapshot.time-retained` | `1 h` (1小时) | 快照保留时间。超过此时间的快照会被清理。 |
| `snapshot.num-retained.min` | `10` | 最少保留的快照数量(即使时间超过1小时)。 |
| `snapshot.num-retained.max` | `2147483647` | 最多保留的快照数量。 |

**配置示例**：
```sql
CREATE TABLE logs (
    ...
) WITH (
    'snapshot.time-retained' = '24 h', -- 保留最近24小时的快照
    'snapshot.num-retained.min' = '20' -- 至少保留20个版本
);
```

> [!warning] 注意
> 如果设置的保留时间太短（如几分钟），可能会导致正在运行的批处理作业读取失败（File Not Found），因为作业开始时引用的文件可能在运行过程中被删除了。

---

## 🏷️ 标签管理 (Tag Management)

为了保留历史数据（如"每天凌晨0点的数据状态"），我们不能依赖短期的Snapshot，而应该使用Tag。

### 1. 自动创建 Tag

Paimon支持根据时间自动创建Tag，非常适合做**日级/小时级备份**。

```sql
CREATE TABLE user_profile (
    ...
) WITH (
    'tag.automatic-creation' = 'process-time', -- 基于处理时间自动打Tag
    'tag.creation-period' = 'daily',           -- 每天打一个Tag
    'tag.creation-delay' = '10 m',             -- 延迟10分钟(等待数据迟到)
    'tag.num-retained-max' = '90'              -- Tag最多保留90个；持续按日生成时近似覆盖90天
);
```

**效果**：每天会自动生成一个类似 `2024-01-01` 的Tag。你可以随时通过Time Travel查询这个Tag的数据。

### 2. 手动管理 Tag

通过系统存储过程（System Procedures）手动操作。

```sql
-- 基于快照ID 10 创建名为 'release-v1.0' 的 Tag
CALL sys.create_tag('default.user_profile', 'release-v1.0', 10);

-- 删除 Tag
CALL sys.delete_tag('default.user_profile', 'release-v1.0');
```

---

## 🔙 数据回滚 (Rollback)

当发生误操作（如写入了错误数据）时，可以将表状态**回滚**到之前的某个Snapshot或Tag。

> [!danger] 警告
> 回滚会改变表的当前状态，可能影响后续快照及相关数据的可访问性。目标快照之后的快照和文件是否删除、何时删除，以及标签引用对保留范围的影响，需要结合所用 Paimon 版本和实际操作确认；不能据此假定数据全部物理删除或保证能够恢复。执行前应明确恢复方案，并确认与并发读写任务的协调方式。

```sql
-- 回滚到快照ID 10
CALL sys.rollback_to('default.user_profile', 10);

-- 回滚到 Tag 'daily-2024-01-01'
CALL sys.rollback_to('default.user_profile', 'daily-2024-01-01');
```

**适用场景**：
- 上游数据源出错，写入了一批脏数据。
- 代码逻辑Bug导致数据计算错误。

---

## 🧹 孤儿文件清理 (Orphan Files Cleanup)

在异常情况下（如Flink任务崩溃、HDFS不稳定），可能会残留一些"孤儿文件"（不再被任何快照引用的文件）。这些文件会占用存储空间。

Paimon提供了清理机制：

```sql
-- 触发孤儿文件清理
CALL sys.remove_orphan_files('default.user_profile');

-- 建议：配置定期清理参数
-- 'clean-orphan-files.enabled' = 'true' (在提交时偶尔触发，慎用，影响性能)
```

通常建议通过定期的离线作业调用 `sys.remove_orphan_files` 来清理，而不是在写入路径上同步清理。

---

## 📋 本节要点回顾

### ✅ 核心技能掌握检查
- [ ] 理解 Snapshot 和 Tag 的区别及适用场景
- [ ] 能够配置合理的快照保留时间 (`snapshot.time-retained`)
- [ ] 掌握配置自动创建 Tag (`tag.automatic-creation`)
- [ ] 知道如何使用 `rollback_to` 进行数据恢复

### 🔗 学习路径连接
**已完成**：✅ 08-Schema演进 → ✅ 09-快照管理
**下一步**：[[【技术与工具】/Paimon/10-Paimon查询优化|Paimon查询优化]] - 学习如何让Paimon查询飞起来

> [!tip] 最佳实践
> 生产环境建议：
> 1. `snapshot.time-retained` 可将 24h~48h 作为示例保留窗口；实际应结合停机时长、恢复耗时及恢复所需快照和文件的保留情况确定，不能仅凭该配置保证流任务重启安全。
> 2. 设置 `tag.automatic-creation` = 'process-time' 和 `tag.creation-period` = 'daily'，按需配置保留30~90个Tag；在持续按日生成的条件下，可近似覆盖最近30~90天的历史状态。Tag 复用表的数据文件，不等同于独立的数据冷备。

---

**创建时间**:2024-12-05
**最后更新**:2024-12-05
**学习时长**:25分钟
**难度等级**:⭐⭐ (中级)

#Paimon #快照 #Tag #数据回滚 #生命周期
