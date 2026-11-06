---
title: DolphinScheduler核心概念与任务编排
tags:
  - DolphinScheduler
  - 工作流
  - DAG
  - 任务依赖
  - 调度
aliases:
  - DolphinScheduler DAG
  - DolphinScheduler任务编排
created: 2026-08-16
updated: 2026-10-10
difficulty: 中级
duration: 30分钟
status: maintenance
knowledge_type: concept
stability: slow-changing
last_verified: 2026-08-16
next_review: 2026-11-16
applies_to:
  - Apache DolphinScheduler 3.4.2
  - PyDolphinScheduler 4.1.0-dev 内容仅用于文中明确标注的位置
source_level: primary
sources:
  - https://github.com/apache/dolphinscheduler/blob/3.4.2/docs/docs/en/guide/project/workflow-definition.md
  - https://dolphinscheduler.apache.org/python/concept.html
  - https://dolphinscheduler.apache.org/python/tasks/index.html
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据运营
  - 数据治理工程师
  - 数据科学家
  - 数据分析师
  - BI分析师
access_tier: free
---


# DolphinScheduler核心概念与任务编排

> [!abstract] 本文目标
> - 区分定义对象与运行实例
> - 理解项目、租户、Worker Group、任务组和资源中心的边界
> - 正确设计 DAG 依赖、执行类型、失败策略和补数
> - 识别“工作流已上线”与“实例成功”的证据差异

前置阅读：[[【技术与工具】/DolphinScheduler/01-DolphinScheduler部署与首次工作流|DolphinScheduler部署与首次工作流]]。

## 定义与实例

DolphinScheduler 的对象可以分为设计态和运行态：

| 设计态 | 运行态 | 含义 |
|---|---|---|
| 工作流定义 | 工作流实例 | 一张 DAG 与它的一次具体运行 |
| 任务定义 | 任务实例 | 一个节点模板与它的一次具体执行 |
| 定时配置 | 调度触发记录 | 何时触发与某次实际触发 |

工作流定义“上线”只表示它具备运行或调度资格。要判断业务是否完成，必须继续检查工作流实例、任务实例、日志和外部数据结果。

## 项目、租户和Worker Group

### 项目

项目是工作流的组织与授权边界。按业务域、团队或数据产品划分项目，通常比按技术组件划分更容易管理负责人、权限和发布节奏。

### 租户

租户关联任务实际运行时使用的操作系统用户。它影响文件权限、命令执行身份和资源访问，不能只当作 UI 标签。

### Worker Group

Worker Group 把任务路由到特定 Worker 集合，可用于区分普通 ETL、重计算、高内存或受限网络环境。它不是资源队列的完整替代品；YARN、Kubernetes 或数据库仍有自己的资源与并发控制。

## 任务、依赖与DAG

任务是 DAG 的节点，依赖是有向边。最常见的结构包括：

- 串行：`extract → transform → load`；
- 并行：`extract → [clean_orders, clean_users]`；
- 汇聚：`[clean_orders, clean_users] → build_report`；
- 条件：根据上游结果进入不同分支；
- 跨工作流依赖：等待另一个工作流或任务完成。

依赖设计应表达数据和业务前置条件，而不是简单复制组织分工。两个任务由不同团队负责，并不必然意味着存在运行依赖。

> [!tip] 依赖最小化
> 不必要的串行边会降低并行度，也会放大上游延迟。先确认“没有上游结果就一定不能安全执行”，再添加依赖。

## 任务类型的选择

Shell、SQL、Spark、Flink、DataX、HTTP 等任务类型只是执行适配器。选型要看实际运行边界：

| 场景 | 推荐思路 | 验收重点 |
|---|---|---|
| 轻量脚本 | Shell/Python | 退出码、标准输出、幂等性 |
| 数据库变换 | SQL | 影响行数、事务、超时和权限 |
| 批量计算 | Spark | Application ID、资源队列、最终状态 |
| 流式任务 | Flink | 提交成功不等于作业持续健康 |
| 数据同步 | DataX | 读写量、脏数据、限速和断点策略 |
| 外部服务 | HTTP | 状态码、响应体、重试幂等键 |

官方任务列表会随版本和插件变化，写教程或升级前应以当前版本的任务插件文档为准。

## 参数作用域

工作流编排常见参数包括：

- 全局参数：工作流内多个任务共享；
- 本地参数：任务内部使用；
- 上游输出参数：运行时传给下游；
- 内置时间参数：依据调度时间生成日期窗口；
- 启动参数：手工运行或补数时覆盖默认值。

参数必须有默认值、类型和时间语义。尤其要区分“实际执行时间”和“业务数据日期”，否则补数容易写入错误分区。

```bash
business_date="${BUSINESS_DATE:?BUSINESS_DATE is required}"
echo "business_date=${business_date}"
```

预期结果：参数缺失时任务立即失败，而不是悄悄使用系统当天日期。

## 工作流执行类型

官方 3.4.2 工作流定义文档列出四种同定义实例处理方式：

- **Parallel**：允许实例并行运行；
- **Serial Wait**：等待前一个实例完成后按调度顺序执行；
- **Serial Discard**：已有实例运行时丢弃后来实例；
- **Serial Priority**：优先执行最新实例，并停止此前运行中的实例，而不是等待前一个实例完成后按优先级排队。

选择依据是业务幂等性和并发安全，而不是只看运行速度。会覆盖同一分区的任务通常不应默认并行；实时检测类任务也不能因为“怕重叠”就随意丢弃实例。

## 失败策略与重试

重试只能处理暂时性失败，例如短时网络抖动、服务限流或资源暂不可用。SQL 语法错误、权限错误和数据契约变化不会因重试变好。

设计重试时明确：

1. 任务是否幂等；
2. 已产生部分结果时如何清理或续跑；
3. 最大重试次数和间隔；
4. 超时后是否终止外部作业；
5. 最终失败由谁接手。

下游写入应尽量使用分区覆盖、事务、临时表交换或业务幂等键，避免一次重试制造重复数据。

## 补数与时间窗口

补数会按选定日期区间生成实例，可以串行或并行。补数前至少评估：

- 上游源数据是否已就绪；
- 多日期并行是否争用同一资源；
- 目标表是追加、覆盖还是 MERGE；
- 告警是否需要计划内降噪；
- 补数完成后如何做跨日期校验。

补数按钮触发成功只表示实例创建成功，不能替代数据回读与质量检查。

## PyDolphinScheduler的代码化编排

PyDolphinScheduler 是官方 Python API，可用 Python 或 YAML 定义工作流。官方概念文档支持用 `>>`、`<<` 或 `set_downstream`、`set_upstream` 建立依赖：

```python
from pydolphinscheduler.core.workflow import Workflow
from pydolphinscheduler.tasks.shell import Shell

with Workflow(name="daily_orders") as workflow:
    extract = Shell(name="extract", command="echo extract")
    transform = Shell(name="transform", command="echo transform")
    validate = Shell(name="validate", command="echo validation=passed")
    extract >> transform >> validate

    workflow.submit()
```

预期结果：定义被提交到 DolphinScheduler 服务端，UI 中出现包含三个节点和两条依赖边的工作流。PyDolphinScheduler 文档当前页面标记为开发版时，生产采用前要核对与服务端版本兼容性。

## 掌握检查

- [ ] 能区分工作流定义和工作流实例
- [ ] 能解释租户与 Worker Group 的不同职责
- [ ] 能为并行、串行等待和丢弃实例给出业务条件
- [ ] 能说明为什么重试前必须验证幂等性
- [ ] 能设计补数后的数据回读验收

## 学习连接

- [[【技术与工具】/DolphinScheduler/00-DolphinScheduler概述与对比|DolphinScheduler概述与对比]]
- [[【技术与工具】/DolphinScheduler/03-DolphinScheduler生产运维与故障排查|DolphinScheduler生产运维与故障排查]]
- [[【技术与工具】/Airflow/02-Airflow核心概念|Airflow核心概念]]
- [[【技术与工具】/Airflow/06-任务依赖与编排|Airflow任务依赖与编排]]
- [[【技术与工具】/Airflow/07-调度策略与时间管理|调度策略与时间管理]]
- [[【技术与工具】/Airflow/08-变量连接与配置管理|变量连接与配置管理]]
- [[【技术与工具】/DataX/00-DataX学习路线图|DataX学习路线图]]
- [[【技术与工具】/Spark/00-Spark学习路线图|Spark学习路线图]]
- [[【技术与工具】/Flink/00-Flink学习路线图|Flink学习路线图]]
- [[【技术与工具】/Kafka/00-Kafka学习路线图|Kafka学习路线图]]

## 官方资料

- [Apache DolphinScheduler 3.4.2 Workflow Definition](https://github.com/apache/dolphinscheduler/blob/3.4.2/docs/docs/en/guide/project/workflow-definition.md)
- [PyDolphinScheduler Concepts](https://dolphinscheduler.apache.org/python/concept.html)
- [PyDolphinScheduler Tutorial](https://dolphinscheduler.apache.org/python/tutorial.html)
- [PyDolphinScheduler Tasks](https://dolphinscheduler.apache.org/python/tasks/index.html)
