---
title: Linux基础概念 - 数据从业者入门必读
tags:
- Linux
- 基础概念
- 操作系统
- CentOS
- Ubuntu
aliases:
- Linux入门
- Linux是什么
date: 2026-03-18
difficulty: 基础
duration: 20分钟
knowledge_type: concept
target_audience:
- 数据从业者
stability: slow-changing
status: active
access_tier: free
created: '2026-03-18'
updated: '2026-10-09'
---


# Linux基础概念 - 数据从业者入门必读

> [!abstract] 本文概要
> - 理解 Linux 是什么，和 Windows 有什么不同
> - 为什么数据工作离不开 Linux
> - 主流发行版 CentOS 和 Ubuntu 的区别
> - 命令行思维入门

---

## Linux 是什么

Linux 是一个开源的操作系统内核，由芬兰程序员 Linus Torvalds 在 1991 年创建。

和 Windows 的最大区别在于：**Linux 内核是开源软件，可在遵守其开源许可证要求的前提下使用、修改和再发布；发行版及商业支持服务不一定免费**。

这带来了一个结果：市面上有几十种基于 Linux 内核的操作系统，统称为 **Linux 发行版（Distribution）**，比如 CentOS、Ubuntu、Debian、Red Hat 等。

> [!note] 和 macOS 的关系
> macOS 具有 Unix 血缘，Linux 是独立开发的类 Unix 内核，两者并非都由 Unix 源码演变而来。Mac 的终端可用于练习许多相似的命令，但不是 Linux 环境，工具实现和命令选项可能不同；例如 macOS 自带的 ls 通常不支持 --help。

---

## 为什么数据从业者必须懂 Linux

### Linux 是大数据生产部署中的常见环境

| 技术 | 运行环境 |
|------|----------|
| Hadoop / [[【技术与工具】/Spark/00-Spark学习路线图|Spark]] / [[【技术与工具】/Flink/00-Flink学习路线图|Flink]] | 生产集群常部署于 Linux；并非三者都只能在 Linux 集群运行，本地运行与其他平台支持需分别查看项目说明 |
| Kafka / ZooKeeper | Linux 服务 |
| MySQL / PostgreSQL / ClickHouse | Linux 部署 |
| Python / Jupyter | Linux 服务器部署 |

**常见场景**：本地 Mac/Windows 可用于开发，也能运行数据任务；生产任务可能部署在公司服务器或云环境。本文不提供平台占比统计，不能将“服务器 99% 是 Linux”作为已证实的普遍结论。

### 数据工作中的具体场景

1. **开发数据管道**：SSH 登录服务器，提交 Spark/Flink 作业，查看运行日志
2. **处理大文件**：用 awk/grep 筛选或统计日志。若以“100GB 日志在 30 秒内完成统计”为示例目标，是否可实现取决于统计逻辑、硬件、存储吞吐、缓存与并行条件，不能作为通用性能保证。
3. **自动化任务**：写 Shell 脚本 + crontab，让数据同步自动每天跑
4. **排查故障**：凌晨报警，登服务器看日志、查进程、定位错误
5. **部署工具**：在服务器上安装 Python、配置 Conda 环境

---

## 主流发行版选择

下面介绍数据工作中可能接触到的 CentOS 系列和 Ubuntu；这不是当前发行版使用率排名。

### CentOS 系列（区分 CentOS Linux 与 CentOS Stream）

```text
特点：
- CentOS Linux 曾是 RHEL 的下游重构发行版；CentOS Stream 与 RHEL 的关系不同，不能将两者的发布与支持模式混为一谈
- 包管理器：yum（新版用 dnf）
- 默认 Shell：bash

使用场景：
- 企业生产服务器的可能使用场景；本文未提供淘宝、京东等公司的实际部署材料，不将具体企业名称作为采用证据
- 大数据集群（Hadoop/Spark 集群）
- 数据库服务器

注意：
- CentOS Linux 8 已于 2021 年停止维护；CentOS Linux 与 CentOS Stream 需分别识别，不能把 CentOS Linux 作为仍持续维护的统一推荐
- CentOS Stream 或 Rocky Linux 可作为进一步了解的选项；本文未提供企业迁移比例或具体迁移案例
```

### Ubuntu（开发者友好）

```text
特点：
- 包管理器：apt
- 界面友好，社区活跃，文档丰富
- LTS（长期支持版）每 2 年发布

使用场景：
- 个人学习环境
- 开发测试服务器
- 云服务器（AWS/GCP 上的默认推荐之一）
```

> [!tip] 选哪个？
> - **公司服务器**：先确认公司实际使用的发行版、版本与支持状态，按组织规范操作，不预设一定是 CentOS
> - **自己学习**：推荐 Ubuntu，生态更友好，遇到问题更容易搜到答案
> - **好消息**：许多常用基础命令相通，但本文没有支持“95% 完全相同”的统计；差异还可能涉及软件版本、仓库、配置位置、安全策略和发行版生命周期，不仅是包管理器

---

## 命令行思维

从 Windows 的图形界面（点击鼠标）切换到 Linux 的命令行（敲命令），需要一个思维转变。

### 命令的基本结构

```bash
命令名  [选项]  [参数]
ls     -la    /home/user
```

- **命令名**：要执行的程序，比如 `ls`（列出文件）
- **选项（Option）**：用 `-` 或 `--` 开头，调整命令行为
  - 短选项：`-l`、`-a`（单字母，可合并写 `-la`）
  - 长选项：`--help`、`--version`（完整单词）
- **参数（Argument）**：命令操作的对象，比如文件路径

### 几个核心命令示例

```bash
# ls：列出当前目录的文件
ls

# ls -l：以详细格式列出（显示权限、大小、时间）
ls -l

# ls -la：详细格式 + 显示隐藏文件（以.开头的文件）
ls -la

# ls -lh：详细格式 + 文件大小用人类可读格式（KB/MB/GB）
ls -lh /data/logs
```

### 获取帮助的方式

```bash
# man：查看命令的完整手册（Manual）
# 按 q 退出
man ls

# --help：快速查看帮助（比 man 简洁）
ls --help

# type：查看命令是什么类型
type ls
# ls is /bin/ls
```

> [!tip] 命令行的超级武器：Tab 补全
> 输入命令或路径的前几个字母，按 **Tab 键** 自动补全。
> 不知道有哪些文件？输入路径前缀，双击 Tab 列出所有匹配项。
> 这是命令行效率的核心，务必养成习惯。

---

## Linux 目录结构简介

Linux 只有一棵目录树，根目录是 `/`（正斜杠）。和 Windows 的 `C:\`、`D:\` 完全不同。

```text
/                       # 根目录
├── home/               # 普通用户的家目录
│   ├── alice/          # 用户 alice 的家目录
│   └── bob/            # 用户 bob 的家目录
├── root/               # root 用户的家目录
├── etc/                # 配置文件目录（nginx.conf、hosts 等都在这里）
├── var/                # 可变数据（日志文件在 /var/log/）
│   └── log/            # 系统和应用日志
├── tmp/                # 临时文件（清理策略取决于系统配置，不能保证每次重启都清空）
├── usr/                # 用户程序
│   └── local/          # 本地安装的软件
├── opt/                # 第三方软件（Hadoop、Spark 常装在这里）
├── data/               # 数据目录（非标准，公司常自定义）
└── bin/                # 基础命令（ls、cp、rm 等）
```

> [!note] 数据工作关注的目录
> - `/home/你的用户名/` - 你的工作目录，在这里写代码、存数据
> - `/var/log/` - 系统日志，排查问题时常来翻
> - `/opt/` 或 `/data/` - 公司的大数据组件通常装在这里
> - `/etc/` - 配置文件，改配置时用到

详细目录操作见 [[【技术与工具】/Linux/03-文件系统与目录操作]]。

---

## Shell 是什么

Shell 是命令解释器。它解析输入，执行内建命令或启动外部程序；这些程序通过系统调用使用内核提供的服务，并非所有命令都直接交给内核执行。

常见的 Shell 类型：

| Shell | 说明 | 使用场景 |
|-------|------|----------|
| **bash** | Bourne Again Shell，最常用 | Linux 默认 |
| **zsh** | 功能更强，配合 oh-my-zsh 很好用 | macOS 默认，高阶用户 |
| **sh** | 最基础的 POSIX Shell | 写兼容性脚本时用 |

> [!tip] 查看登录 Shell 配置提示（不等同于当前正在运行的 Shell）
> ```bash
> echo $SHELL
> # /bin/bash 或 /bin/zsh
> ```

---

## 小结

| 概念 | 关键点 |
|------|--------|
| Linux | 开源操作系统内核，常用于大数据基础设施 |
| 发行版 | CentOS 系列与 Ubuntu 是本文介绍的发行版示例，选择时需区分版本、支持状态和实际需求 |
| 命令结构 | `命令名 [选项] [参数]` |
| 目录结构 | 以 `/` 为根的单棵树 |
| Shell | 命令解析器，bash 最常用 |

---



---

## 掌握检查

读完本文后，用以下问题检验自己是否真的理解了：

- [ ] 能说出 Linux 和 Windows 在文件系统组织方式上的根本区别（单棵树 vs 多盘符）
- [ ] 能说明本文介绍的 CentOS 系列与 Ubuntu 的特点，并知道实际选型需确认发行版版本、支持状态和组织环境
- [ ] 知道 `/etc`、`/var`、`/home`、`/tmp` 这四个目录各自存放什么
- [ ] 能写出一条完整命令的基本结构：命令名、选项、参数各是什么
- [ ] 能说出 bash 和 zsh 的基本区别，并知道 echo $SHELL 通常显示登录 Shell 配置，不保证代表当前正在运行的 Shell

---

## 下一步

- [[【技术与工具】/Linux/02-远程连接与环境配置|SSH远程连接]] - 学会 SSH 登录服务器，这是一切的起点
- [[【技术与工具】/Linux/03-文件系统与目录操作|文件系统与目录操作]] - 在 Linux 上自如地操作文件

#Linux #操作系统 #数据工程 #入门基础
