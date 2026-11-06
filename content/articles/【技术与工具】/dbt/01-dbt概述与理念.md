---
title: dbt 概述与理念 - 什么是分析工程化
tags:
  - dbt
  - Analytics-Engineering
  - ELT
  - 数据转换
  - 现代数据栈
  - 分析工程
aliases:
  - dbt是什么
  - dbt概念
  - 分析工程师
date: 2026-03-18
difficulty: 基础
duration: 15分钟
knowledge_type: concept
target_audience:
  - 数据分析师
  - 数据开发工程师
  - BI分析师
  - 分析工程师
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


# dbt 概述与理念 - 什么是分析工程化

> [!abstract] 本文核心
> 本文不急着讲怎么用 dbt，而是花时间解释清楚：**为什么需要 dbt**，以及 **dbt 代表的工程化思维是什么**。
> 这些"为什么"比"怎么做"更重要，它们决定了你能不能真正用好这个工具。

---

## 一个真实的困境

设想你是一家电商公司的数据分析师。每天你的工作是：

1. 从 MySQL 业务库里拉数据
2. 在 Excel 或者 BI 工具里做各种 SQL 查询
3. 把结果整理成报表发给业务方

一开始你的文件夹长这样：

```text
分析/
└── 用户留存分析.sql
```

三个月后：

```text
分析/
├── 用户留存分析.sql
├── 用户留存分析_修改版.sql
├── 用户留存分析_新口径.sql
├── 用户留存分析_按老板要求改的.sql
├── 收入汇总.sql
├── 收入汇总（正确的）.sql
├── 订单分析_小王写的.sql
├── 订单分析_我写的.sql
└── GMV报表_最终版_真的最终版.sql
```

这就是数据分析工作的现实困境：**SQL 脚本很快就会陷入混乱**。没有版本控制、没有依赖关系、没有测试、没有文档，质量全靠人肉保证。

dbt 的出现，正是为了解决这个问题。

---

## dbt 是什么

**dbt（data build tool）** 是一个开源的命令行工具，它让数据分析师能用**软件工程的方式**来管理 SQL 转换逻辑。

一句话定义：

> **dbt 让你能够通过写 SELECT 语句来转换数据仓库中的数据，根据声明管理依赖关系，并通过配置和运行相关命令执行测试、生成文档；项目版本控制需配合 Git 等工具完成。**

注意这个定义里的关键词：**SELECT 语句**。dbt 的模型（Model）就是一个 SELECT 语句，你不需要写 CREATE TABLE、INSERT INTO、DROP TABLE——这些 dbt 帮你做。

> [!tip] 一个类比
> 如果你用过 React，dbt 的关系有点像 React 对 DOM 操作的封装：
> - 你描述"我想要什么"（SELECT 语句）
> - dbt 负责"怎么实现"（CREATE TABLE / CREATE VIEW / MERGE 等）
>
> 如果你没用过 React，可以这样理解：你主要描述转换逻辑，dbt 根据模型配置和适配器生成并执行相应的数据库操作；数据仓库、权限和运行环境等基础设施仍需另行配置与维护。

---

## ETL vs ELT：一个根本性的范式转变

理解 dbt，必须先理解 ETL 到 ELT 的演变。

### 传统 ETL（Extract → Transform → Load）

```text
数据源 ──→ [提取] ──→ [转换] ──→ [加载] ──→ 数据仓库
              ↑                    ↑
         Informatica          转换发生在
         SSIS/DataStage        仓库外面
```

转换逻辑运行在专门的 ETL 服务器上，数据先处理好再入仓。这种模式有几个明显问题：
- 转换逻辑用专有工具写，SQL 技能用不上
- 调试困难，中间结果难以查看
- 计算资源和存储资源分开，成本高
- 扩展能力受 ETL 服务器限制

### 现代 ELT（Extract → Load → Transform）

```text
数据源 ──→ [提取+加载] ──→ 数据仓库 ──→ [转换]
              ↑                          ↑
          Fivetran/Airbyte           dbt 在这里工作
          先把原始数据              用 SQL 在仓库内转换
          加载进来
```

ELT 范式下，原始数据先落仓，再用 SQL 在仓库内部完成所有转换。这成为可能的原因是：
- 云数仓（Snowflake、BigQuery、Redshift）计算能力极强，处理 SQL 极快
- 存储成本大幅下降，保留原始数据的代价可以接受
- SQL 工程师比 ETL 工具专家更容易找到

> [!note] 这不仅仅是工具换了
> ELT 范式意味着数据转换的主战场从 ETL 工具转移到了数据仓库。
> 既然都在仓库里用 SQL，那就应该像管理代码一样管理 SQL。
> dbt 就是这个思路的最佳实践体现。

---

## Analytics Engineering：一个新角色的诞生

dbt 催生（或者说定义）了一个新的职业角色：**分析工程师（Analytics Engineer）**。

### 三种角色的对比

| 维度 | 数据工程师 | 数据分析师 | 分析工程师 |
|------|----------|----------|----------|
| 核心技能 | Python/Java、分布式系统 | SQL、Excel、统计学 | SQL、数据建模、软件工程实践 |
| 主要工作 | 构建数据管道、维护基础设施 | 分析数据、制作报表 | 构建可靠的数据模型层 |
| 典型工具 | Spark、Kafka、Airflow | Excel、Tableau、SQL | **dbt**、SQL、Git、BI 工具 |
| 思维方式 | 系统思维、工程思维 | 业务思维、统计思维 | 工程思维 + 业务思维 |

分析工程师的价值在于：**连接数据工程侧的管道与基础设施工作，以及数据分析侧的业务分析需求；具体技能边界因团队而异**。

> [!tip] 职业发展建议
> 如果你是数据分析师，学习 dbt 和 Git 可以作为向分析工程师方向发展的准备；薪资和市场价值是否提升，取决于地区、岗位需求、经验及实际能力，并非学习这些工具即可保证。
> 如果你是数据工程师，理解 dbt 的理念能帮你更好地和分析团队协作，设计更好的数据架构。

---

## dbt 解决的核心问题：SQL 项目工程化

dbt 把软件工程的几个核心实践引入了 SQL 工作流：

### 1. 依赖管理（Dependency Management）

传统方式：你需要手动记住表和表之间的依赖关系。

dbt 方式：用 `ref()` 函数声明依赖，dbt 自动构建 DAG（有向无环图）并按正确顺序执行。

```sql
-- 传统方式：手动记住 orders 依赖 raw_orders
SELECT * FROM raw_orders WHERE status = 'completed'

-- dbt 方式：ref() 声明依赖关系
SELECT * FROM {{ ref('stg_orders') }} WHERE status = 'completed'
```

### 2. 版本控制（Version Control）

dbt 项目就是一个普通的代码目录，天然适合用 Git 管理。配合 Git 可以实现：
- 代码历史追溯
- 分支开发
- Code Review
- 回滚

### 3. 测试（Testing）

数据质量不应该靠人肉检查，应该像单元测试一样自动化运行。

```yaml
# schema.yml - 声明测试，就像写单元测试
models:
  - name: orders
    columns:
      - name: order_id
        tests:
          - unique        # 订单ID必须唯一
          - not_null      # 不能为空
      - name: status
        tests:
          - accepted_values:  # 只能是这几个值
              values: ['placed', 'shipped', 'completed']
```

### 4. 文档（Documentation）

文档不是事后补的，而是和代码写在一起的。

```yaml
models:
  - name: orders
    description: "订单事实表，一行代表一个订单，包含订单全生命周期的状态"
    columns:
      - name: order_id
        description: "订单唯一标识，来源于业务系统的 orders.id"
```

### 5. 代码复用（DRY - Don't Repeat Yourself）

通过 Jinja 宏（Macro）封装重复的 SQL 逻辑，避免到处复制粘贴。

---

## dbt Core vs dbt Cloud

学习时会遇到这两个版本，先搞清楚区别：

| 对比维度 | dbt Core | dbt Cloud |
|---------|---------|---------|
| 费用 | 完全免费、开源 | 有免费额度，高级功能收费 |
| 运行方式 | 本地命令行运行 | Web 界面 + 托管运行环境 |
| 调度 | 需要自己集成（Airflow 等） | 内置调度器 |
| IDE | 用你自己的编辑器（VS Code 等） | 内置 Cloud IDE |
| 适合场景 | 学习、个人项目、自建技术栈 | 团队协作、不想维护调度基础设施 |
| 学习建议 | **先学这个** | 入门后再考虑 |

> [!note] 本系列的定位
> 本系列文档以 **dbt Core** 为主，因为它免费、开源，学习它意味着你真正理解了底层原理。
> 理解 dbt Core 有助于迁移到 dbt Cloud，但切换还涉及托管运行环境、连接与权限、调度和团队协作配置，并不只是界面的变化。

---

## dbt 支持哪些数据仓库

dbt 通过**适配器（Adapter）**机制支持多种数据仓库。适配器把 dbt 的通用逻辑翻译成各个仓库的方言：

| 数据仓库 | 适配器包 | 成熟度 |
|---------|---------|-------|
| BigQuery | dbt-bigquery | ⭐⭐⭐⭐⭐ 官方支持 |
| Snowflake | dbt-snowflake | ⭐⭐⭐⭐⭐ 官方支持 |
| Redshift | dbt-redshift | ⭐⭐⭐⭐⭐ 官方支持 |
| PostgreSQL | dbt-postgres | ⭐⭐⭐⭐⭐ 官方支持 |
| DuckDB | dbt-duckdb | ⭐⭐⭐⭐ 社区活跃 |
| ClickHouse | dbt-clickhouse | ⭐⭐⭐⭐ 社区活跃 |
| Spark | dbt-spark | ⭐⭐⭐⭐ 官方支持 |
| Trino/Presto | dbt-trino | ⭐⭐⭐ 社区维护 |
| Hive | dbt-hive | ⭐⭐⭐ 社区维护 |
| Doris | dbt-doris | ⭐⭐⭐ 社区维护 |

> [!tip] 学习环境推荐
> - **本地开发**：DuckDB（零配置，内存数据库，适合学习）
> - **云端学习**：BigQuery 或 Snowflake（都有免费额度）
> - **企业环境**：根据公司已有技术栈选择

---

## dbt 的边界：它做什么，不做什么

很多人对 dbt 有误解，明确边界能帮你避免错误的期望：

**dbt 做的事**：
- 在数据仓库内部转换数据（Transform 层）
- 管理模型间的依赖关系
- 运行数据质量测试
- 生成数据文档和血缘图
- 管理 SQL 项目的工程化实践

**dbt 不做的事**：
- 不负责数据摄取（Extract & Load）—— 那是 Fivetran、Airbyte 的职责
- 不是调度工具 —— 需要 Airflow、dbt Cloud 或 cron 来调度 dbt 运行
- 不是 BI 工具 —— 数据可视化用 Tableau、Metabase、Looker 等
- 不处理流数据 —— 流处理用 Flink核心概念 或 Spark Streaming

> [!warning] 常见误区
> dbt 不能替代 Airflow 等调度工具。dbt 本身只是"把模型跑一遍"，它不知道什么时候该跑、失败了怎么重试、依赖其他任务完成才能运行等逻辑。
> 这些编排逻辑需要 Airflow（或 dbt Cloud 的调度功能）来实现。
> 见 [[【技术与工具】/dbt/10-dbt与调度集成]]。

---

## 总结：为什么值得学 dbt

1. **从混乱到工程化**：把 SQL 脚本混乱的现状转变为有结构、可测试、有文档的工程项目
2. **职业价值**：分析工程师方向值得结合目标市场的招聘需求评估；“Analytics Engineer 是 2023-2025 年数据领域增速最快的岗位之一”在本文中仅作为待验证的市场假设，不作为已证实结论。
3. **低学习门槛**：核心是 SQL，不需要学新的编程语言
4. **广泛采用**：Airbnb、GitLab、JetBlue、Shopify 等公司都在生产环境使用 dbt
5. **活跃生态**：dbt-utils、dbt-expectations 等包极大扩展了 dbt 的能力

---

## 下一步

现在你已经理解了 dbt 的"为什么"，下一篇开始动手：

[[【技术与工具】/dbt/02-dbt安装与项目初始化]] - 安装 dbt、创建第一个项目、连接数据库

---

*最后更新：2026-03-18*

#dbt #Analytics-Engineering #ELT #数据转换 #现代数据栈

---

> [!info] 前置知识
> - 了解 ETL/ELT 的基本概念（数据从哪里来、到哪里去）
> - 有 SQL 基础（能写 SELECT、JOIN、聚合查询）
> - 知道什么是数据仓库（数仓是做什么的）

---

## 掌握检查

- [ ] 能用一句话说清楚 dbt 是什么（核心是"把 SELECT 变成数据库对象"，而不是"又一个 ETL 工具"）
- [ ] 能解释 ELT 和 ETL 的区别：dbt 处理的是 Transform 阶段，Extract 和 Load 是其他工具的事
- [ ] 能说出 dbt 引入版本控制（Git）对数据团队带来的核心价值（可追溯、可回滚、可协作）
- [ ] 理解 Analytics Engineer 角色的定位：介于数据工程师和数据分析师之间，既懂 SQL 又理解工程化

---

## 实践练习

**基础题**：在你目前的工作或学习项目中，找出一个"手写 SQL 脚本反复执行"的数据转换场景，思考如果用 dbt 管理它，会解决哪些具体的痛点（版本管理、依赖管理、可测试性中至少说出 2 个）。

**进阶题**：ELT 架构把数据先 Load 进数仓再 Transform，而传统 ETL 是先 Transform 再 Load。结合你了解的场景，说出这两种方式各自适合什么情况，以及云数仓（Snowflake、BigQuery）的出现为什么让 ELT 成为主流。
