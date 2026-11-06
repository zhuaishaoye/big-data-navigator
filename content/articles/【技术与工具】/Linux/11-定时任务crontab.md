---
title: 定时任务crontab - 自动化数据处理
tags:
- Linux
- crontab
- 定时任务
- 自动化
- Shell
aliases:
- crontab
- Linux定时任务
- 定时执行脚本
date: 2026-03-18
difficulty: 中级
duration: 30分钟
knowledge_type: technical-practice
target_audience:
- 数据开发工程师
- 数据运营
- BI分析师
- 需要配置定时数据处理任务的数据分析师
stability: stable
status: active
access_tier: free
created: '2026-03-18'
updated: '2026-10-09'
---


# 定时任务 crontab - 自动化数据处理

> [!abstract] 本文概要
> - crontab 基本语法和配置
> - 时间表达式详解（那五个星号怎么写）
> - 脚本的日志管理
> - 数据工作中的定时任务设计
> - 常见问题排查

---

## crontab 是什么

crontab 是 Linux 上的定时任务调度工具，让你指定的命令或脚本在特定时间自动执行。

数据工作中的典型应用：
- 每天凌晨 2 点跑 ETL 数据同步
- 每小时统计一次实时订单数据
- 每天 8 点生成昨天的业务报表
- 每周一清理一次过期日志

---

## 时间表达式

crontab 时间表达式由五个字段组成：

```text
分钟  小时  日期  月份  星期
 *    *    *    *    *

字段说明：
- 分钟：0-59
- 小时：0-23
- 日期：1-31
- 月份：1-12
- 星期：0-7（0 和 7 都表示周日，1=周一 ... 6=周六）
```

### 常用时间表达式

```markdown
# 格式：分 时 日 月 周   命令

# 每天凌晨 2:00 执行（最常用的 ETL 时间）
0 2 * * *  /home/alice/scripts/daily_etl.sh

# 每天 8:00（发早报）
0 8 * * *  /home/alice/scripts/morning_report.sh

# 每小时执行一次（整点）
0 * * * *  /home/alice/scripts/hourly_sync.sh

# 每 30 分钟执行一次
*/30 * * * *  /home/alice/scripts/sync.sh

# 每 5 分钟执行一次
*/5 * * * *  /home/alice/scripts/monitor.sh

# 每周一凌晨 1:00（周报 ETL）
0 1 * * 1  /home/alice/scripts/weekly_report.sh

# 每月 1 号凌晨 3:00（月报 ETL）
0 3 1 * *  /home/alice/scripts/monthly_report.sh

# 每天 9:00、12:00、18:00 执行
0 9,12,18 * * *  /home/alice/scripts/report.sh

# 工作日（周一到周五）每天 8:30
30 8 * * 1-5  /home/alice/scripts/workday_task.sh

# 每天 10:00 到 22:00，每 2 小时执行一次
0 10-22/2 * * *  /home/alice/scripts/task.sh
```

> [!tip] crontab 时间表达式速记
> 五颗星从左到右：**分时日月周**
> 记不住时，用 [crontab.guru](https://crontab.guru) 在线验证你的表达式

---

## 管理 crontab

```bash
# 编辑当前用户的 crontab（会打开 vi 编辑器）
crontab -e

# 查看当前用户的 crontab 任务列表
crontab -l

# 删除当前用户的所有 crontab 任务（谨慎！）
crontab -r

# 查看指定用户的 crontab（需要 root 权限）
sudo crontab -l -u alice

# 编辑指定用户的 crontab
sudo crontab -e -u hadoop
```

> [!note] 第一次使用 crontab -e
> 会提示选择编辑器。推荐选 vim（2）或 nano（1，更简单）。

---

## 完整的 crontab 配置示例

```bash
# 编辑 crontab
crontab -e
```

```markdown
# Alice 的 crontab 配置
# 格式：分 时 日 月 周  命令

# =====================
# ETL 数据处理
# =====================

# 每天凌晨 1:00 同步 ODS 原始数据
0 1 * * * /home/alice/scripts/sync_ods.sh >> /var/log/etl/ods_$(date +\%Y\%m\%d).log 2>&1

# 每天凌晨 2:00 跑 DWD 层 ETL
0 2 * * * /home/alice/scripts/run_dwd_etl.sh >> /var/log/etl/dwd_$(date +\%Y\%m\%d).log 2>&1

# 每天凌晨 3:30 跑 DWS 汇总层
30 3 * * * /home/alice/scripts/run_dws_etl.sh >> /var/log/etl/dws_$(date +\%Y\%m\%d).log 2>&1

# =====================
# 报表生成
# =====================

# 假设 ETL 在 8:00 前成功完成，每天 8:00 生成日报；cron 不检查 ETL 完成状态
0 8 * * * /home/alice/scripts/gen_daily_report.sh

# 每周一 9:00 生成周报
0 9 * * 1 /home/alice/scripts/gen_weekly_report.sh

# =====================
# 系统维护
# =====================

# 每天凌晨 4:00 清理 30 天前的日志
0 4 * * * find /var/log/etl -name "*.log" -mtime +30 -exec rm {} \;

# 每天 23:50 备份今日数据
50 23 * * * /home/alice/scripts/backup_data.sh

# =====================
# 监控检查
# =====================

# 每 5 分钟检查数据管道状态
*/5 * * * * /home/alice/scripts/check_pipeline.sh
```

> [!warning] crontab 中 % 要转义
> 在 crontab 命令中，`%` 有特殊含义（换行符）。如果命令中用到 `%`（比如 `date +%Y%m%d`），必须用 `\%` 转义。
> ```markdown
> # 错误（不会按预期工作）
> 0 2 * * * /scripts/etl.sh > /log/etl_$(date +%Y%m%d).log
>
> # 正确（% 转义）
> 0 2 * * * /scripts/etl.sh > /log/etl_$(date +\%Y\%m\%d).log
> ```

---

## 日志管理

定时任务必须有日志，否则出问题了无从排查。

### 基本日志记录

```bash
# 输出和错误都记录到日志
0 2 * * * /scripts/etl.sh >> /var/log/etl/etl.log 2>&1

# 按日期分文件（推荐）
0 2 * * * /scripts/etl.sh >> /var/log/etl/etl_$(date +\%Y\%m\%d).log 2>&1
```

### 日志轮转（logrotate）

长期运行的定时任务会产生大量日志，用 logrotate 自动管理：

```bash
# 创建 logrotate 配置
sudo vim /etc/logrotate.d/etl_logs
```

```markdown
# logrotate 配置示例
/var/log/etl/*.log {
    # 按日轮转；实际检查取决于 logrotate 的运行安排
    daily
    # 保留 30 个轮转版本，不保证覆盖恰好 30 天
    rotate 30
    # 压缩旧日志
    compress
    # 最近一次轮转的文件留到下一轮再压缩
    delaycompress
    # 日志文件不存在时不报错
    missingok
    # 日志为空时不轮转
    notifempty
    # 新日志文件的权限和所有者；alice 用户及 data 组须存在
    create 0644 alice data
}
```

```bash
# 测试 logrotate 配置（不实际执行）
sudo logrotate -d /etc/logrotate.d/etl_logs

# 手动触发 logrotate
sudo logrotate -f /etc/logrotate.d/etl_logs
```

### 脚本内部的日志规范

```bash
#!/bin/bash
# 定时任务脚本的标准结构

LOG_DIR="/var/log/etl"
DATE=$(date +%Y%m%d)
LOG_FILE="${LOG_DIR}/etl_${DATE}.log"

mkdir -p "$LOG_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log "===== 任务开始 ====="

# 执行逻辑...

log "任务完成"
log "===== 任务结束 ====="
```

---

## crontab 环境变量问题

这是最常见的坑：**脚本手动运行正常，但 crontab 里运行失败。**

原因：crontab 的运行环境和交互式登录不同，很多环境变量（PATH、JAVA_HOME 等）没有加载。

### 解决方案

```bash
# 方法一：在 crontab 中设置环境变量（推荐）
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/alice/bin
JAVA_HOME=/usr/java/jdk1.8.0_281
HADOOP_HOME=/opt/hadoop

0 2 * * * /home/alice/scripts/etl.sh

# 方法二：在脚本开头 source 环境配置文件
#!/bin/bash
source /home/alice/.bashrc    # 尝试加载其中的配置；非交互式执行时可能提前返回

# 此方法不保证加载任务所需变量，建议显式设置变量或加载专用环境配置文件
```

```bash
# 方法三：在脚本中使用绝对路径
#!/bin/bash

JAVA=/usr/java/jdk1.8.0_281/bin/java
SPARK_SUBMIT=/opt/spark/bin/spark-submit
HADOOP=/opt/hadoop/bin/hadoop

# 使用绝对路径调用命令
$SPARK_SUBMIT --master yarn ...
```

> [!warning] 推荐使用绝对路径
> 建议用绝对路径指定 crontab 执行的脚本；脚本调用的命令可使用绝对路径，也可通过显式设置 PATH 定位。
> 相对路径依赖运行时工作目录；未显式控制目录时，不要写 `./scripts/etl.sh`，应写 `/home/alice/scripts/etl.sh`。

---

## 查看 crontab 执行历史

```bash
# 查看系统日志中的 cron 执行记录
# Ubuntu/Debian
grep CRON /var/log/syslog | tail -50

# CentOS/RHEL
grep CRON /var/log/cron | tail -50

# 或者
journalctl -u cron | tail -50
journalctl -u crond | tail -50   # CentOS 上是 crond
```

---

## 常见问题排查

### 问题 1：任务没有执行

```bash
# 检查 cron 服务是否运行
systemctl status cron    # Ubuntu
systemctl status crond   # CentOS

# 启动 cron 服务
sudo systemctl start cron
sudo systemctl enable cron   # 设置开机自启
```

### 问题 2：脚本手动跑正常，crontab 跑失败

```bash
# 模拟 crontab 环境调试
env -i HOME=/home/alice LOGNAME=alice USER=alice \
    PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    /home/alice/scripts/etl.sh

# 如果这样跑也失败，就能复现问题了
# 然后检查脚本里用到的命令路径是否是绝对路径
```

### 问题 3：中文乱码

```bash
# 在 crontab 顶部设置字符集
LANG=en_US.UTF-8
LANGUAGE=en_US.UTF-8
LC_ALL=en_US.UTF-8
```

### 问题 4：邮件发送失败（cron 默认把输出发邮件）

```bash
# 如果不需要邮件，把所有输出重定向到日志
0 2 * * * /scripts/etl.sh >> /var/log/etl.log 2>&1

# 或者明确关闭邮件
# 在 crontab 顶部添加以下环境赋值，注释单独成行
MAILTO=""
```

---

## 实战：生产环境 ETL 定时任务设计

```bash
# ETL 定时配置示例：仅按时间错峰，不保证上游成功完成
MAILTO=""
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
JAVA_HOME=/usr/java/jdk1.8.0_281
HADOOP_HOME=/opt/hadoop

# ===============================
# 数据采集层（ODS）
# ===============================
# T+1 数据采集：每天 00:30 采集前一天数据
30 0 * * * /data/scripts/ods/sync_orders.sh yesterday >> /data/logs/ods/orders_$(date +\%Y\%m\%d).log 2>&1
35 0 * * * /data/scripts/ods/sync_users.sh yesterday >> /data/logs/ods/users_$(date +\%Y\%m\%d).log 2>&1

# ===============================
# 数仓明细层（DWD）
# ===============================
# 假设 ODS 在 2:00 前成功完成，凌晨 2:00 启动 DWD；距订单和用户采集启动分别为 90 和 85 分钟，cron 不检查完成状态
0 2 * * * /data/scripts/dwd/run_dwd.sh >> /data/logs/dwd/dwd_$(date +\%Y\%m\%d).log 2>&1

# ===============================
# 数仓汇总层（DWS/ADS）
# ===============================
# 假设 DWD 在 3:30 前成功完成，凌晨 3:30 启动汇总；距 DWD 启动 90 分钟，cron 不检查完成状态
30 3 * * * /data/scripts/dws/run_dws.sh >> /data/logs/dws/dws_$(date +\%Y\%m\%d).log 2>&1

# ===============================
# 应用层数据导出
# ===============================
# 假设 DWS 在 5:00 前成功完成，凌晨 5:00 导出到 MySQL 供 BI 查询；cron 不检查完成状态
0 5 * * * /data/scripts/export/export_to_mysql.sh >> /data/logs/export/export_$(date +\%Y\%m\%d).log 2>&1

# ===============================
# 系统运维
# ===============================
# 每天凌晨 6:00 检查昨天所有任务是否成功
0 6 * * * /data/scripts/monitor/check_yesterday.sh

# 每周日 2:00 清理过期数据（保留 90 天）
0 2 * * 0 /data/scripts/maintenance/cleanup_old_data.sh
```

---

## 快速参考

| 时间表达式 | 含义 |
|------------|------|
| `0 2 * * *` | 每天凌晨 2 点 |
| `*/30 * * * *` | 每 30 分钟 |
| `0 8-18 * * 1-5` | 工作日 8 点到 18 点，每小时 |
| `0 0 1 * *` | 每月 1 号 |
| `0 0 * * 0` | 每周日 |

| 命令 | 用途 |
|------|------|
| `crontab -e` | 编辑定时任务 |
| `crontab -l` | 查看定时任务 |
| `crontab -r` | 删除所有定时任务 |
| `grep CRON /var/log/cron` | 查看执行历史 |

---

## 下一步

- [[【技术与工具】/Linux/08-Shell脚本基础]] - 写更健壮的定时脚本
- [[【技术与工具】/Linux/09-进程与任务管理]] - 查看定时任务是否在运行
- [[【技术与工具】/Linux/14-实战场景]] - 完整的 ETL 自动化案例

---

> [!info] 前置知识
> - [[【技术与工具】/Linux/08-Shell脚本基础|Shell脚本基础]] - crontab 执行的是 Shell 脚本，需要先会写可独立运行的脚本
> - [[【技术与工具】/Linux/07-管道与重定向|管道与重定向]] - 定时任务的输出必须重定向到日志文件，否则会发到系统邮件

---

## 掌握检查

- [ ] 能读懂 crontab 时间表达式：说出 `30 2 * * 1-5` 是什么意思（工作日凌晨 2:30）
- [ ] 知道 crontab 中推荐用绝对路径指定脚本，以及为什么 cron 的 PATH 和交互式 Shell 可能不同
- [ ] 能在 crontab 头部设置 `MAILTO=""` 防止系统发送 cron 执行邮件
- [ ] 写了新的 crontab 任务后知道如何验证：用 `crontab -l` 确认已保存，检查日志确认执行
- [ ] 遇到"定时任务手动跑成功但 crontab 不执行"时，知道用 `env -i` 模拟 cron 环境排查

---

## 实践练习

**基础题**：为以下场景写 crontab 表达式：(1) 每天凌晨 1:30 执行；(2) 每隔 15 分钟执行一次；(3) 每月 1 号和 15 号的 8 点执行；(4) 工作日（周一到周五）每小时整点执行。

**进阶题**：写一个 crontab 任务，每天凌晨 3:00 执行一个数据备份脚本，要求：(1) 脚本用绝对路径；(2) stdout 和 stderr 都记录到按日期命名的日志文件；(3) 设置必要的环境变量（JAVA_HOME 等）；(4) 用 `crontab -l` 验证配置已保存。

---

## 下一步

- [[【技术与工具】/Linux/08-Shell脚本基础|Shell脚本基础]] - 写更健壮的定时脚本
- [[【技术与工具】/Linux/14-实战场景|Linux实战场景]] - 完整的 ETL 自动化案例

#Linux #crontab #定时任务 #自动化 #数据工程
