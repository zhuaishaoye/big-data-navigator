---
title: DataX 安装与配置 - 从零到第一个同步任务
tags:
  - DataX
  - 安装
  - 配置
  - JDK
  - Python
  - 环境搭建
aliases:
  - DataX安装
  - DataX环境配置
difficulty: 中级
duration: 30分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据分析师
  - BI分析师
  - 数据架构师
  - 数据治理工程师
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


# DataX 安装与配置 - 从零到第一个同步任务

> [!abstract] 本文核心内容
> - JDK 和 Python 依赖安装
> - DataX 下载（含国内镜像加速）
> - 目录结构详解，搞清楚各个目录的作用
> - 配置文件详解，理解每个参数
> - 第一个同步任务：stream 到 stream 验证安装成功

---

## 环境依赖

DataX 运行依赖两个基础环境：

| 依赖 | 版本要求 | 说明 |
|------|---------|------|
| JDK | 本文按 JDK 8 演示 | DataX 框架使用 Java；实际支持范围须按选定发行版本与插件确认 |
| Python | 2.7 / 3.x | DataX 的启动脚本是 Python 写的 |
| OS | Linux / macOS | Windows 不推荐生产使用 |

> [!warning] JDK 版本要求
> 本文按 JDK 8 环境演示，不据此保证其他 JDK 版本可用。生产环境须核对所选 DataX 发行版本与插件的支持范围，并验证 JDK 发行版的安全维护状态；原稿未提供 JDK 11 兼容性测试。

### JDK 8 安装

```bash
# CentOS / RHEL
yum install -y java-1.8.0-openjdk-devel

# Ubuntu / Debian
apt-get install -y openjdk-8-jdk

# macOS (Homebrew)
brew install openjdk@8

# 验证安装
java -version
# 期望输出：openjdk version "1.8.0_xxx"
```

配置 JAVA_HOME（编辑 `~/.bashrc` 或 `~/.bash_profile`）：

```bash
export JAVA_HOME=/usr/lib/jvm/java-1.8.0-openjdk
export PATH=$JAVA_HOME/bin:$PATH
source ~/.bashrc
```

### Python 环境

```bash
# 检查 Python 版本（DataX 对 Python 版本要求宽松）
python --version
python3 --version

# 如果没有 Python，安装 Python 3
yum install -y python3   # CentOS
apt-get install -y python3  # Ubuntu
```

---

## 下载 DataX

### 官方下载

DataX 源码和二进制包都在 GitHub 发布：

```bash
# GitHub Release 页面
# https://github.com/alibaba/DataX/releases

# 下载原稿指定版本（不代表最新版本，使用前核对发布信息）
wget https://github.com/alibaba/DataX/releases/download/datax_v202309/datax.tar.gz
```

> [!tip] 国内下载加速
> GitHub 在国内经常访问缓慢，有两个替代方案：
>
> **方案 1：使用阿里云 OSS 镜像**
> ```bash
> wget https://datax-opensource.oss-cn-hangzhou.aliyuncs.com/202309/datax.tar.gz
> ```
>
> **方案 2：从 Gitee 下载**
> DataX 在 Gitee 有镜像仓库，可以直接下载。

### 从源码编译（可选）

如果需要自定义插件或修改源码：

```bash
# 克隆源码
git clone https://github.com/alibaba/DataX.git

# 编译打包（需要 Maven 3.x）
cd DataX
mvn -U clean package assembly:assembly -Dmaven.test.skip=true

# 编译结果在
ls target/datax/datax/
```

---

## 安装步骤

```bash
# 1. 创建安装目录
mkdir -p /opt/datax

# 2. 解压
tar -zxvf datax.tar.gz -C /opt/datax

# 3. 查看目录结构
ls /opt/datax/datax/
```

---

## 目录结构详解

```text
/opt/datax/datax/
├── bin/                  # 启动脚本目录
│   ├── datax.py          # 主启动脚本（最重要）
│   └── ...
├── conf/                 # 框架配置目录
│   ├── core.json         # 核心配置文件（Channel、线程池等）
│   └── logback.xml       # 日志配置
├── job/                  # 推荐存放 Job 配置文件的目录
│   └── job.json          # 示例 Job 配置
├── lib/                  # DataX 框架的依赖 jar 包
│   └── datax-core-*.jar
├── log/                  # 默认日志输出目录
│   └── datax.log
├── plugin/               # 插件目录（最重要的目录）
│   ├── reader/           # 所有 Reader 插件
│   │   ├── mysqlreader/  # MySQL Reader 插件
│   │   │   ├── libs/     # 插件依赖的 jar
│   │   │   └── plugin.json  # 插件元信息
│   │   ├── hdfsreader/
│   │   ├── oraclereader/
│   │   └── ...（20+个Reader）
│   └── writer/           # 所有 Writer 插件
│       ├── hdfswriter/
│       ├── mysqlwriter/
│       └── ...（20+个Writer）
└── script/               # 辅助脚本
```

> [!note] plugin 目录是核心
> 所有的数据源支持都在 `plugin/` 目录下。如果某个插件目录不存在，说明这次安装的 DataX 版本不包含该插件，需要单独编译添加。
>
> 可以通过以下命令查看已安装的插件：
> ```bash
> ls /opt/datax/datax/plugin/reader/
> ls /opt/datax/datax/plugin/writer/
> ```

---

## 核心配置文件

### conf/core.json

这是 DataX 框架级别的配置，一般不需要修改，但了解它有助于排查问题：

```json
{
    "entry": {
        "jvm": "-Xms1g -Xmx1g",
        "environment": {}
    },
    "common": {
        "column": {
            "datetimeFormat": "yyyy-MM-dd HH:mm:ss",
            "timeFormat": "HH:mm:ss",
            "dateFormat": "yyyy-MM-dd",
            "extraFormats": ["yyyyMMdd"],
            "timeZone": "GMT+8",
            "encoding": "UTF-8"
        }
    },
    "core": {
        "transport": {
            "channel": {
                "speed": {
                    "byte": -1,
                    "record": -1
                },
                "flowControlInterval": 20,
                "capacity": 512,
                "byteCapacity": 67108864
            },
            "exchanger": {
                "bufferSize": 32
            }
        },
        "container": {
            "job": {
                "reportInterval": 10000
            },
            "taskGroup": {
                "channel": 5
            }
        }
    }
}
```

关键参数说明：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `entry.jvm` | DataX 进程的 JVM 参数 | `-Xms1g -Xmx1g` |
| `core.transport.channel.capacity` | Channel 缓冲队列大小（条数） | 512 |
| `core.transport.channel.byteCapacity` | Channel 缓冲区大小（字节） | 64MB |
| `core.container.taskGroup.channel` | 每个 TaskGroup 的默认 Channel 数 | 5 |
| `common.column.timeZone` | 时间字段的时区处理 | GMT+8 |

> [!warning] 时区配置是踩坑重灾区
> 如果源数据库和目标端时区不一致，时间字段会有偏差。确认源数据库时区：
> ```sql
> SHOW VARIABLES LIKE 'time_zone';  -- MySQL
> ```
> 如果数据库使用 UTC，不要仅凭这一点修改全局 `timeZone`。应先核对源字段类型、数据库与 JDBC 会话时区、插件转换方式和目标端解析规则，再用已知时间样本验证；确认需要按 UTC 转换时，才评估将相关配置改为 `GMT+0`。

---

## Job 配置文件详解

Job 配置文件是你每次同步任务需要编写的文件，JSON 格式。

完整结构：

```json
{
    "job": {
        "setting": {
            "speed": {
                "channel": 4,
                "bps": 10485760
            },
            "errorLimit": {
                "record": 0,
                "percentage": 0.02
            }
        },
        "content": [
            {
                "reader": {
                    "name": "Reader插件名",
                    "parameter": {
                        // 插件相关参数
                    }
                },
                "writer": {
                    "name": "Writer插件名",
                    "parameter": {
                        // 插件相关参数
                    }
                }
            }
        ]
    }
}
```

### setting 区块说明

```json
"setting": {
    "speed": {
        "channel": 4,        // 并发 Channel 数量，核心调优参数
        "bps": 10485760,     // Job 级总字节速率上限（bytes/s），10MiB/s；区别于 core.transport.channel.speed.byte
        "record": 10000      // Job 级总记录速率上限（records/s）；区别于 core.transport.channel.speed.record
    },
    "errorLimit": {
        "record": 10,        // 最多允许 10 条脏数据，超过则任务失败
        "percentage": 0.02   // 最多允许 2% 的脏数据比例
    }
}
```

---

## 第一个同步任务：stream -> stream

DataX 内置了 `streamreader` 和 `streamwriter` 用于测试，不需要任何数据库连接，可以用来验证 DataX 是否安装成功。

### 创建测试配置文件

```bash
cat > /opt/datax/datax/job/stream2stream.json << 'EOF'
{
    "job": {
        "setting": {
            "speed": {
                "channel": 1
            }
        },
        "content": [
            {
                "reader": {
                    "name": "streamreader",
                    "parameter": {
                        "sliceRecordCount": 10,
                        "column": [
                            {
                                "type": "long",
                                "value": "10"
                            },
                            {
                                "type": "string",
                                "value": "hello，DataX"
                            },
                            {
                                "type": "date",
                                "value": "2026-03-18"
                            }
                        ]
                    }
                },
                "writer": {
                    "name": "streamwriter",
                    "parameter": {
                        "print": true,
                        "encoding": "UTF-8"
                    }
                }
            }
        ]
    }
}
EOF
```

### 运行测试任务

```bash
# 进入 DataX 安装目录
cd /opt/datax/datax

# 运行任务（使用 Python 3）
python3 bin/datax.py job/stream2stream.json

# 如果 Python 2
python bin/datax.py job/stream2stream.json
```

### 期望输出

以下为原稿示意日志，不是本轮实测记录；时间、耗时和速率数字仅用于说明输出格式，实际内容随版本和运行环境变化。

```text
DataX (DATAX-OPENSOURCE-3.0), From Alibaba !
Copyright (C) 2010-2017, Alibaba Group. All Rights Reserved.

2026-03-18 10:00:00.001 [main] INFO  Engine - {
    "entry" : {
        "jvm" : " -Xms1G -Xmx1G"
    }
}

... (初始化日志)

10      hello，DataX    2026-03-18 00:00:00
10      hello，DataX    2026-03-18 00:00:00
... (共10条输出)

任务启动时刻                    : 2026-03-18 10:00:00
任务结束时刻                    : 2026-03-18 10:00:01
任务总计耗时                    :                  1s
任务平均流量                    :               10B/s
记录写入速度                    :              10rec/s
读出记录总数                    :                  10
读写失败总数                    :                   0
```

测试任务正常退出、读出记录总数为 10 且读写失败总数为 0，可说明当前环境下 streamreader 到 streamwriter 的基本链路可用，不代表其他插件或生产同步链路已验证。

---

## 常见安装问题

### 问题 1：Python 版本不兼容

```text
SyntaxError: Missing parentheses in call to 'print'
```

**原因**：该错误通常表示 Python 3 正在解析含 Python 2 风格 `print` 语句的脚本。应核对当前解释器与所下载 `datax.py` 的兼容性，不能仅凭此错误认定需要切换到 Python 3。

**解决**：
```bash
# 核对脚本与发行版本支持的解释器，不修改全局 python 软链接
python --version
python3 --version

# 仅当当前 datax.py 已确认支持 Python 3 时使用
python3 bin/datax.py job/stream2stream.json

# 若脚本仅支持 Python 2，应按版本说明准备隔离环境或更换受支持的发行版本
```

### 问题 2：找不到 Java

```text
command not found: java
```

**解决**：
```bash
# 检查 java 是否安装
which java
java -version

# 如果安装了但找不到，检查 PATH
echo $JAVA_HOME
echo $PATH
```

### 问题 3：插件 jar 缺失

```text
plugin [mysqlreader] not exist.
```

**原因**：这个插件没有被包含在当前安装包中，或者 plugin 目录结构损坏。

**解决**：
```bash
# 检查插件目录
ls plugin/reader/mysqlreader/

# 如果目录不存在，说明这次下载的安装包不包含该插件
# 需要重新下载完整版安装包
```

### 问题 4：MySQL JDBC 驱动版本问题

```text
No suitable driver found for jdbc:mysql://...
```

**原因**：该错误首先应检查 JDBC URL 是否正确、驱动是否进入插件类加载路径，以及驱动类名是否与插件配置匹配；也需进一步核对驱动与服务器的兼容性，不能直接认定为版本不匹配。

**解决**：
```bash
# 按插件驱动类名、JDK 和服务器兼容要求选择 MySQL Connector/J
# 以下保留原稿版本示例，未验证其适用于当前环境
# 先备份并检查 libs 中已有驱动；cp 不会移除不同文件名的旧版本，避免多版本冲突
cp mysql-connector-java-8.0.28.jar \
   /opt/datax/datax/plugin/reader/mysqlreader/libs/
```

---

## 生产环境部署建议

```bash
# 推荐的目录结构
/opt/datax/
├── datax/           # DataX 安装目录
├── jobs/            # 统一存放所有 Job 配置
│   ├── ods_order_daily.json
│   ├── ods_user_daily.json
│   └── ...
├── logs/            # 统一日志目录（挂载到 datax/log）
└── scripts/         # 封装脚本
    ├── run_datax.sh  # 通用运行脚本
    └── gen_job.py   # 动态生成 Job 配置的脚本
```

```bash
# run_datax.sh 参考模板
#!/bin/bash
JOB_FILE=${1:-}
if [ -z "$JOB_FILE" ] || [ ! -r "$JOB_FILE" ]; then
    echo "用法: $0 <可读的 Job JSON 文件>" >&2
    exit 2
fi
LOG_DIR="/opt/datax/logs"
mkdir -p "$LOG_DIR" || exit 1
DATE=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/$(basename "${JOB_FILE%.json}")_${DATE}_$$.log"

echo "开始执行: ${JOB_FILE}"
# 使用前确认当前 datax.py 支持 Python 3
python3 /opt/datax/datax/bin/datax.py "$JOB_FILE" > "$LOG_FILE" 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "执行成功: ${JOB_FILE}"
else
    echo "执行失败: ${JOB_FILE}, 退出码: ${EXIT_CODE}"
    echo "日志位置: ${LOG_FILE}"
    exit $EXIT_CODE
fi
```

---

## 相关文档

- [[【技术与工具】/DataX/02-DataX核心架构|02-DataX核心架构]] - 理解配置背后的运行机制
- [[【技术与工具】/DataX/04-常用Reader插件|04-常用Reader插件]] - 各种数据源的读取配置
- [[【技术与工具】/DataX/05-常用Writer插件|05-常用Writer插件]] - 各种目标端的写入配置
- [[【技术与工具】/DataX/08-DataX与调度集成|08-DataX与调度集成]] - 生产环境的完整部署方案

---

#DataX #安装配置 #环境搭建 #JDK #Python #快速入门

---

> [!info] 前置知识
> - 了解 DataX 的整体架构，参考 [[【技术与工具】/DataX/02-DataX核心架构|02-DataX核心架构]]
> - 熟悉 Linux 命令行：解压（tar）、目录操作（cd/ls）、环境变量配置（export）
> - 准备好 JDK 8 和 Python 2/3 的可用环境（DataX 运行依赖）

---

## 掌握检查

- [ ] 能完成 DataX 的解压安装，运行本文创建的 `job/stream2stream.json` 测试任务，检查正常退出、记录总数和失败数，验证基本运行链路
- [ ] 能编写一个最简单的 MySQL→MySQL 同步 Job JSON，包含正确的 `jdbcUrl`、`username`、`password`、`table`、`column` 配置
- [ ] 能使用 `python datax.py job/your_job.json` 命令运行 DataX 任务，并在输出日志中找到 "任务平均流量"、"记录写入速度"、"读写失败总数" 等关键统计信息
- [ ] 能解释 DataX Job JSON 中 `setting.speed.channel` 和 `setting.errorLimit` 的作用，知道如何调整并发度和容错阈值
- [ ] 能说明 DataX 为什么使用 Python 作为启动器（Python 脚本处理启动参数并启动 Java 进程，Job JSON 由 Java 框架加载和解析），以及为什么核心逻辑用 Java 实现（性能和插件生态）

---

## 实践练习

**基础题**：在本地安装 DataX，编写一个 `stream2stream` 测试任务（使用 DataX 内置的 streamreader 和 streamwriter），运行并解读输出日志中的统计信息，确认任务成功完成（读写失败总数为 0）。

**进阶题**：编写一个 MySQL→MySQL 的 DataX Job，把本地 MySQL 中的一张表（至少 10 行数据）同步到同实例下的另一张表。要求：配置 `splitPk`、`channel: 2`、`errorLimit.record: 10`，运行成功后验证目标表数据行数与源表一致。

---

## 下一步

[[【技术与工具】/DataX/04-常用Reader插件|04-常用Reader插件]] - 安装完成后学习各种数据源的读取配置
