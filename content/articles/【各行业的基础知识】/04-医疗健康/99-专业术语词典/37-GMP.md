---
title: "GMP"
tags:
  - "GMP"
  - "医疗健康"
  - "99-专业术语词典"
  - "工作实战"
created: 2026-01-01
updated: 2026-11-06
difficulty: 实战
duration: 35分钟
knowledge_type: topic-specific-guide
target_audience:
  - 数据分析师
  - 数据开发工程师
  - 业务与产品人员
stability: stable
status: complete
access_tier: free
---

# GMP

> [!abstract] 药品生产质量管理实战手册
> GMP 不是一套只供审计查看的文档，而是把人员、厂房、设备、物料、工艺、检验、放行和变更控制连接成可证明的质量体系。数据工作的任务，是让批记录、偏差、CAPA、变更、验证和放行结论能够相互追溯，并证明关键数据没有被任意修改。

## 1. GMP：定义、适用边界与决策出口

GMP 不是一套只供审计查看的文档，而是把人员、厂房、设备、物料、工艺、检验、放行和变更控制连接成可证明的质量体系。数据工作的任务，是让批记录、偏差、CAPA、变更、验证和放行结论能够相互追溯，并证明关键数据没有被任意修改。

**本篇的适用边界。** 本篇聚焦药品生产现场的质量管理体系与数据完整性；不把 GMP 简单等同于终产品检验，也不把电子系统上线自动视为合规。

**最常见的错误替代。** 不能用扫描件替代原始电子记录，不能覆盖原值，也不能以“经验判断”跳过偏差和变更流程。

**最终决策。** 质量团队要判断：批次能否放行、偏差是否需要扩大调查、CAPA 是否有效、变更是否完成验证，以及数据是否可信。 因此，这篇内容不从“应该建哪张表”开始，而从业务动作、责任人和失败后果开始。只有先确定谁在什么时点做出什么决定，字段、SQL、看板和模型才有明确用途。

围绕“GMP”，工作中至少要区分四类问题：

1. **身份问题**：对象是谁，主键能否跨系统稳定关联，合并、拆分、撤销后历史是否还看得见。
2. **时间问题**：业务发生、状态生效、数据入仓、计算完成和人员行动分别发生在哪一刻。
3. **状态问题**：当前状态是一段事件、一张快照还是最终结果，空值代表未发生、未采集还是已删除。
4. **责任问题**：谁确认口径，谁处理异常，谁有权放行或停止，谁在观察期后复盘。

## 2. GMP的完整业务流程

| 环节 | 要做的事 | 最小证据 | 失败后先查什么 |
| --- | --- | --- | --- |
| 人员培训与授权 | 确认岗位资质、培训和操作权限 | 培训记录、授权矩阵与电子签名 | 所有偏差都按日期关闭 |
| 设备与设施状态 | 确保清洁、校准、维护和验证状态有效 | 设备日志、清洁记录、校准证书 | 多人使用同一登录执行关键操作 |
| 物料与供应商管理 | 验收、隔离、取样、检验和放行 | 供应商批准、物料批号与检验报告 | 商业生产先排后补审批 |
| 生产与批记录 | 执行工艺并按实时顺序记录关键步骤 | 主批记录、执行批记录、参数和复核 | 异常原始数据被复验结果覆盖 |
| 偏差、变更与 CAPA | 评估影响、批准处置并验证效果 | 偏差单、根因、影响批次、有效性复核 | 所有偏差都按日期关闭 |
| 检验与批次放行 | 确认所有物料、过程、检验和文档符合要求 | 检验数据、审核清单和放行决定 | 多人使用同一登录执行关键操作 |
| 持续质量回顾 | 分析趋势、投诉、召回和重复问题 | 年度回顾、趋势规则和改进行动 | 商业生产先排后补审批 |

把 人员培训与授权、设备与设施状态、物料与供应商管理、生产与批记录、偏差、变更与 CAPA、检验与批次放行、持续质量回顾 串起来后可以看出，GMP不是一个孤立字段，而是一条会跨系统、跨岗位、跨时间的证据链。流程图上每一段都应标出输入、输出、状态、时间戳、责任人和异常出口。只要其中一段只能靠口头解释，后续的统计、追责和自动化就会失去基础。

一个合格的需求说明应该写成：

> 在【授权数据范围】和【观察窗口】内，围绕“GMP”的【主批记录】，按【site_id、product_id、production_line、shift_code】比较【首次放行通过率】及其【偏差按时关闭率】，定位一个可干预节点；行动后同时观察主指标、样本量和护栏，任何高风险异常先阻断再调查。

## 3. GMP的数据对象与系统契约

| 数据对象 | 建议主键 | 一行代表什么 | 不允许混淆 |
| --- | --- | --- | --- |
| 主批记录 | `master_batch_record_id` | 经批准的工艺与记录模板 | 对象身份与业务事件 |
| 执行批记录 | `batch_record_id` | 某一商业批次的实际执行证据 | 事件、状态快照和结果粒度 |
| 偏差 | `deviation_id` | 偏离标准或预期的事件及调查 | 事件、状态快照和结果粒度 |
| 变更 | `change_control_id` | 对工艺、设备、系统或文件的受控变更 | 事件、状态快照和结果粒度 |
| CAPA | `capa_id` | 纠正、预防及有效性验证 | 事件、状态快照和结果粒度 |
| 数据审计追踪 | `audit_trail_id` | 关键记录的创建、修改、审批和删除证据 | 事件、状态快照和结果粒度 |

对象表不是把所有字段塞进一张宽表。事件、状态快照和结果表应该分别保留粒度，再通过稳定主键与版本建立关联。尤其要避免三个常见混算：把一次业务事件算成多个对象、把每日快照相加当事件总量、把最新状态覆盖历史状态。

本主题的数据契约至少应包含：

- `batch_record_id` 的唯一性规则、生成方式和跨系统映射。
- `manufacturing_completed_at` 的业务含义、时区、迟到和补录规则。
- `quality_release_status` 的完整状态集合，以及删除、撤销、冻结和失效的表示方法。
- 控制对象 `gmp_audit_trail.audit_event_id` 与主对象的关系。
- 每次口径、规则、模型或源版本变化的影响范围和下游通知对象。
- 敏感字段、允许用途、访问角色、导出限制和审计保留时间。

## 4. GMP的指标、样本与验收口径

| 指标 | 公式或定义 | 口径提醒 |
| --- | --- | --- |
| 首次放行通过率 | 首次审核通过并放行的批次 / 提交放行批次 | 不能把返工后合格批次计入首次通过 |
| 偏差按时关闭率 | 在目标日期前完成调查和批准的偏差 / 应关闭偏差 | 关闭时间与有效性验证时间要分开 |
| 重复偏差发生率 | 重复根因或重复产品的偏差 / 同类偏差总数 | 重复要有明确匹配规则 |
| CAPA 有效性通过率 | 在规定窗口内未复发的 CAPA / 已到期 CAPA | 观察窗口和样本量必须事先定义 |
| 审计追踪异常率 | 存在未经批准修改或缺失原因的关键记录数 / 抽查记录数 | 电子签名和人工修改要分别判定 |

指标字典至少写到“任何人都能按同一份数据复跑”的程度：中文名、业务定义、公式、分子、分母、事实粒度、时间字段、对象范围、排除项、版本、负责人和验收样例，一个都不能少。比例指标必须同时展示分子、分母和样本量；金额或数量必须做守恒；状态指标必须能回到事件时间线。

对于“GMP”，建议把观察分成三层：

| 层次 | 看什么 | 不能替代什么 |
| --- | --- | --- |
| 业务结果 | 首次放行通过率、偏差按时关闭率 | 不能替代过程证据和个案回查 |
| 过程护栏 | 重复偏差发生率、CAPA 有效性通过率、审计追踪异常率 | 不能因为护栏暂时正常就跳过异常调查 |
| 数据证据 | 主键、时间、状态、版本、来源目标对账 | 不能只看任务成功或报表能打开 |

## 5. GMP：七个真实工作场景

以下七组场景均为公开方法结合常见工作流程构造的“脱敏复合示例”，不对应任何单一企业、患者、客户或雇员事实。场景的目的，是展示如何从现象走到证据、行动和验收，而不是虚构经营成果。

### 1. 批记录时间顺序异常

**现场。** 电子批记录显示设备清洁在物料称量之后完成，但纸质备注称实际顺序正常。

**怎么查。** 核对系统时间、审计追踪、设备日志、人员登录和门禁记录，确认是业务操作错误还是时间同步问题。

**怎么处理。** 冻结批次并启动偏差；不得直接修改历史时间。修复需区分设备、系统、培训或流程原因。

**验收结论。** 时间戳是证据，不是装饰。系统时间同步与业务操作顺序要同时验证。

### 2. 同一偏差连续发生但都按时关闭

**现场。** 某设备偏差关闭率看起来很高，但同设备三个月内反复出现同类问题。

**怎么查。** 按设备、产品、班组、根因、CAPA 类型和复发时间连接，检查关闭标准是否只看文档齐全。

**怎么处理。** 重新定义重复偏差，重新评估根因；CAPA 到期后按预先观察窗验证，不只看培训签到。

**验收结论。** 按时关闭不等于问题解决。质量指标要包含复发和有效性。

### 3. 数据完整性审计中的共享账号

**现场。** 审计发现多个操作员使用同一账号执行称量和复核。

**怎么查。** 检查账号授权、人员排班、登录 IP、电子签名和培训记录，区分便利操作与规避权限。

**怎么处理。** 立即限制共享账号，评估受影响批次的签名有效性；补做权限、培训和系统控制。

**验收结论。** 共享账号会破坏责任归属。身份、权限和签名必须做到可归责。

### 4. 设备变更未完成验证即排产

**现场。** 生产计划已安排新设备生产商业批次，质量系统里的验证状态仍是待批准。

**怎么查。** 核对变更范围、验证方案、PQ 结果、维护校准和主批记录版本。

**怎么处理。** 在验证与变更批准前阻断排产；如已生产，按偏差评估影响并决定放行边界。

**验收结论。** 排产系统必须读取质量和验证状态，不能靠线下邮件确认。

### 5. OOS 复验与原始数据覆盖

**现场。** 实验室系统只看到一个合格复验值，原始不合格结果在纸面记录中存在。

**怎么查。** 回查色谱原始文件、审计追踪、样品链和检验申请，确认谁在何时以何理由修改。

**怎么处理。** 启动数据完整性调查与批次影响评估；保留原始值，修复系统权限和复核规则。

**验收结论。** 删除原值会同时破坏质量结论和审计证据。数据保留策略必须覆盖原始文件。

### 6. 供应商批次与商业批追溯

**现场。** 某供应商通知物料存在潜在问题，质量团队无法快速定位受影响商业批次。

**怎么查。** 按供应商、物料、来料批、投料单、生产批和发货记录做双向追溯，检查库位和替代料记录。

**怎么处理。** 冻结相关物料和批次，补齐物料谱系，并对无法追溯的库存采取隔离。

**验收结论。** 追溯不是单一表查询，而是从供应商到患者的正反向证据图。

### 7. 年度质量回顾只看合格率

**现场。** 年度回顾结论全部良好，但偏差、返工、投诉和环境监测在多个产品上呈缓慢上升趋势。

**怎么查。** 建立时间趋势、批间差异和跨产品关联，结合产量、人员、设备与变更事件。

**怎么处理。** 把年度回顾拆成稳定性、批记录、偏差、CAPA、投诉、召回、环境和数据完整性多组指标，并要求带证据的结论。

**验收结论。** 质量回顾不是报表汇总，而是识别系统性风险并触发资源决策。

七个场景可以归成一条共同判断顺序：先确认对象和时间，再确认状态和版本；然后做总量、结构和明细三层对账；最后才讨论策略、模型或工具。若一条结论不能指出对应的原始记录、责任人和行动出口，就只能算观察，不能作为生产结论。

## 6. GMP的第一段 SQL：重建业务链路

下面的 SQL 用于说明对象、时间、状态、版本和分层口径如何进入同一条可复查路径。表名和部分字段是通用示例，落地时应映射到企业数据字典；SQL 方言也需按实际引擎调整。

```sql
-- GMP：按业务对象重建链路，避免事件、快照和结果混算
WITH ranked_batch_record_id AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY batch_record_id
      ORDER BY updated_at DESC
    ) AS version_no
  FROM pharma_batch_release
  WHERE manufacturing_completed_at >= TIMESTAMP '{start_time}'
    AND manufacturing_completed_at <  TIMESTAMP '{end_time}'
    AND quality_release_status NOT IN ('deleted', 'test')
),
valid_rows AS (
  SELECT
    batch_record_id,
    site_id,
    product_id,
    production_line,
    shift_code,
    manufacturing_completed_at,
    quality_release_status,
    ingested_at
  FROM ranked_batch_record_id
  WHERE version_no = 1
)
SELECT
  site_id, product_id, production_line, shift_code,
  COUNT(DISTINCT batch_record_id) AS object_cnt,
  SUM(CASE WHEN first_pass_release THEN 1 ELSE 0 END) AS numerator_value,
  COUNT(DISTINCT batch_record_id) AS denominator_value,
  CAST(SUM(CASE WHEN first_pass_release THEN 1 ELSE 0 END) AS DOUBLE PRECISION)
    / NULLIF(COUNT(DISTINCT batch_record_id), 0) AS metric_value,
  MIN(manufacturing_completed_at) AS first_event_at,
  MAX(manufacturing_completed_at) AS last_event_at
FROM valid_rows
GROUP BY site_id, product_id, production_line, shift_code
ORDER BY metric_value DESC, object_cnt DESC;
```

执行后至少回答六个问题：

- 同一对象是否因为多源回传产生多版本，版本保留是否符合业务要求？
- 业务时间与入仓时间是否分开，补录和迟到数据是否进入正确分区？
- 分子分母是否来自同一对象范围和同一统计窗口？
- 维度使用的是事件当时值还是当前值，跨期比较是否一致？
- 删除、撤销、冻结和测试数据是否按规则处理？
- 分组结果能否在明细中抽样复现？

## 7. GMP的第二段 SQL：源、控制和结果三方对账

```sql
-- GMP：源对象、控制对象和结果对象三方对账
WITH population AS (
  SELECT
    batch_record_id,
    manufacturing_completed_at,
    quality_release_status
  FROM pharma_batch_release
  WHERE manufacturing_completed_at >= TIMESTAMP '{start_time}'
    AND manufacturing_completed_at <  TIMESTAMP '{end_time}'
),
control AS (
  SELECT
    batch_record_id,
    SUM(approved_change_flag) AS control_value,
    COUNT(DISTINCT audit_event_id) AS control_cnt,
    MAX(updated_at) AS control_updated_at
  FROM gmp_audit_trail
  WHERE updated_at >= TIMESTAMP '{start_time}'
  GROUP BY batch_record_id
),
result AS (
  SELECT
    batch_record_id,
    COUNT(*) AS result_cnt,
    MAX(calculated_at) AS calculated_at
  FROM mart_batch_record_id
  WHERE business_date BETWEEN DATE '{start_date}' AND DATE '{end_date}'
  GROUP BY batch_record_id
)
SELECT
  COALESCE(p.batch_record_id, c.batch_record_id, r.batch_record_id) AS object_key,
  CASE
    WHEN p.batch_record_id IS NULL THEN 'source_missing'
    WHEN c.batch_record_id IS NULL THEN 'control_missing'
    WHEN r.batch_record_id IS NULL THEN 'result_missing'
    WHEN ABS(COALESCE(c.control_value, 0) - COALESCE(r.result_cnt, 0)) > 0 THEN 'count_or_value_gap'
    ELSE 'matched'
  END AS reconciliation_status,
  p.quality_release_status,
  c.control_value,
  c.control_cnt,
  r.result_cnt,
  c.control_updated_at,
  r.calculated_at
FROM population p
FULL OUTER JOIN control c ON p.batch_record_id = c.batch_record_id
FULL OUTER JOIN result r ON COALESCE(p.batch_record_id, c.batch_record_id) = r.batch_record_id
WHERE p.batch_record_id IS NULL
   OR c.batch_record_id IS NULL
   OR r.batch_record_id IS NULL
   OR ABS(COALESCE(c.control_value, 0) - COALESCE(r.result_cnt, 0)) > 0;
```

这段查询故意不使用“总数相差小于某个随意百分比就算通过”。它先找出缺失对象和状态差异，再检查控制值与结果值。对于GMP，数量、金额、时长或状态任意一项无法解释，都不能用“业务波动”代替排查。

对账结果建议分成四类处理：

1. **阻断**：对象缺失、关键时间为空、状态非法、金额或数量不守恒、权限越界。
2. **严重**：比例或总量显著偏离基线，且无法由已确认的对象结构变化解释。
3. **观察**：小范围波动但来源、样本和趋势可控，进入责任人和观察窗口。
4. **探索**：只有弱信号或假设，不进入正式结论，更不直接触发业务处罚。

## 8. GMP的 Python 发布门禁与指标护栏

第一段代码把发布条件写成可执行对象，避免“检查过了”只存在聊天记录里：

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class BatchRecordIdBatch:
    batch_id: str
    source_rows: int
    valid_rows: int
    duplicate_keys: int
    missing_required_fields: int
    reconciliation_gap: float

def release_batch_record_id(batch: BatchRecordIdBatch) -> dict:
    checks = {
        "source_not_empty": batch.source_rows > 0,
        "valid_rows_in_range": 0 <= batch.valid_rows <= batch.source_rows,
        "duplicate_rate_ok": batch.duplicate_keys / max(batch.source_rows, 1) <= 0.001,
        "required_fields_ok": batch.missing_required_fields == 0,
        "reconciliation_ok": abs(batch.reconciliation_gap) <= 0.01,
    }
    return {
        "topic": "GMP",
        "batch_id": batch.batch_id,
        "checks": checks,
        "release_allowed": all(checks.values()),
        "blocking_checks": [name for name, passed in checks.items() if not passed],
    }
```

第二段代码演示如何为比例类结果附带样本证据和小样本下界。它不是替代统计学家的模型，而是防止把少量偶然样本直接包装成稳定结论：

```python
from dataclasses import dataclass
from math import sqrt

@dataclass(frozen=True)
class BatchRecordIdObservation:
    object_id: str
    numerator: float
    denominator: float
    sample_size: int
    scope_version: str

def calculate_batch_record_id(rows: list[BatchRecordIdObservation]) -> list[dict]:
    output = []
    for row in rows:
        value = row.numerator / row.denominator if row.denominator > 0 else None
        # 小样本用 Wilson 下界做护栏，不把偶然的高比例直接当稳定结果。
        z = 1.96
        p = value or 0
        n = max(row.sample_size, 1)
        center = p + z * z / (2 * n)
        margin = z * sqrt((p * (1 - p) + z * z / (4 * n)) / n)
        lower = max(0, (center - margin) / (1 + z * z / n))
        output.append({
            "object_id": row.object_id,
            "metric": "首次放行通过率",
            "value": value,
            "lower_bound": lower if value is not None else None,
            "sample_size": row.sample_size,
            "scope_version": row.scope_version,
            "caution": "不能把返工后合格批次计入首次通过",
        })
    return output
```

真正上线时还要补充参数配置、日志、血缘、告警级别、重跑幂等、异常样本保存和审批记录。代码通过不代表业务通过；自动检查只能证明已经定义的规则没有被违反，无法证明规则本身一定正确。

## 9. GMP的失败反例与上线验收

| 风险信号 | 错误做法 | 必须补齐的证据 | 发布或行动规则 |
| --- | --- | --- | --- |
| 关闭率替代有效性 | 所有偏差都按日期关闭 | 重复根因、复发和 CAPA 到期证据 | 到期未验证不得判定有效 |
| 共享账号 | 多人使用同一登录执行关键操作 | 唯一身份、签名、排班与审计追踪 | 关键步骤必须可归责 |
| 验证状态不参与排产 | 商业生产先排后补审批 | 设备、产品、工艺和验证版本 | 验证未生效不得生产或放行 |
| 只保留最终值 | 异常原始数据被复验结果覆盖 | 原始文件、审计追踪和 OOS 调查 | 任何关键原值不得删除 |

上线验收不应只有一句“报表正常”。建议按下面四层验收：

| 验收对象 | 结构要求 | 测试样本 | 结果证据 |
| --- | --- | --- | --- |
| 主批记录 | `master_batch_record_id` 能唯一定位经批准的工艺与记录模板 | 正常、重复、缺失、撤销与跨期样本 | 首次放行通过率可回到原始对象 |
| 执行批记录 | `batch_record_id` 能唯一定位某一商业批次的实际执行证据 | 正常、重复、缺失、撤销与跨期样本 | 偏差按时关闭率可回到原始对象 |
| 偏差 | `deviation_id` 能唯一定位偏离标准或预期的事件及调查 | 正常、重复、缺失、撤销与跨期样本 | 重复偏差发生率可回到原始对象 |
| 变更 | `change_control_id` 能唯一定位对工艺、设备、系统或文件的受控变更 | 正常、重复、缺失、撤销与跨期样本 | CAPA 有效性通过率可回到原始对象 |
| CAPA | `capa_id` 能唯一定位纠正、预防及有效性验证 | 正常、重复、缺失、撤销与跨期样本 | 审计追踪异常率可回到原始对象 |
| 数据审计追踪 | `audit_trail_id` 能唯一定位关键记录的创建、修改、审批和删除证据 | 正常、重复、缺失、撤销与跨期样本 | 首次放行通过率可回到原始对象 |

还应为每一次发布保留一组固定回归样本：正常对象、边界状态、重复记录、缺失字段、撤销或退款、跨期、权限拒绝和失败恢复。回归样本不是演示数据，而是以后每次改规则都能重复执行的质量资产。

## 10. GMP的 30 天落地与复盘

| 阶段 | 主要交付 | 通过条件 |
| --- | --- | --- |
| 第 1 周：定义 | 对象、流程、状态、指标、排除项和责任矩阵 | 业务、数据、安全或质量负责人对同一口径签字 |
| 第 2 周：打通 | 源字段、主键、时间、版本、控制对象和失败样本 | 正常与异常样本都能回到原始记录 |
| 第 3 周：验证 | 总量对账、分层对账、抽样回查、权限测试、回滚演练 | 阻断问题清零，严重问题有责任人与期限 |
| 第 4 周：发布 | 灰度、SLO、监控、行动清单、停止条件和复盘模板 | 使用者在真实场景中完成一次闭环行动 |

如果必须用 90 秒说明“GMP”是否做对，可以按这个顺序自测：

1. 一行数据代表什么，主键是什么，哪些对象绝不能混在同一粒度？
2. 业务发生、数据可见、计算完成和行动确认分别在哪个时间点？
3. 本主题最重要的两个主指标、三个护栏和最小样本量是什么？
4. 一个异常出现时，先从原始记录、链路版本还是业务动作开始查？
5. 哪类错误必须阻断发布或停止使用，谁有权批准例外？
6. 上线后由谁在多长时间内观察，什么条件下回滚或结束？

> [!check] 完成标准
> 当另一位数据同事不看聊天记录，只根据口径卡、回归样本和代码就能复跑同一结果；当业务负责人能指出一个异常对应的原始对象、处置动作和复核证据；当系统能够阻止未授权或状态非法的数据进入下游，这篇“GMP”才算真正落到工作里。

## 公开资料与进一步阅读

- [国家药品监督管理局](https://www.nmpa.gov.cn/)
- [ICH Quality Guidelines](https://www.ich.org/page/quality-guidelines)
- [U.S. FDA Drug Quality](https://www.fda.gov/drugs/drug-quality-resources)

- 企业内部的GMP数据字典、流程文件、指标口径、权限制度和事故复盘。使用前应核对版本、适用机构、生效日期和责任人。
- 搜索补充资料时，优先核对监管机构、标准组织、产品官方文档和可验证案例，不把营销软文、匿名截图或单一博客结论直接当作生产依据。

> [!warning] 使用边界
> 本文为原创方法型内容，不复制任何付费文章的隐藏正文。文中的组织、人员、批次、金额、患者和结果均为脱敏或复合示例。正式项目必须使用获授权数据，并由业务、数据、安全、合规和质量负责人根据现行制度确认口径、权限、上线与回滚方案。
