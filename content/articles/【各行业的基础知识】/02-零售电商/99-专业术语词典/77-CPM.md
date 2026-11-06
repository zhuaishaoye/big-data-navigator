---
title: "CPM"
tags:
  - "CPM"
  - "零售电商"
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

# CPM

> [!abstract] 千次曝光计费广告实战手册
> CPM 表示每一千次有效广告曝光的成本，公式为广告花费除以有效曝光次数再乘以一千。CPM 描述的是触达和曝光效率，不等于用户一定看见、记住或购买，因此必须配套可见性、频次、点击和转化指标。

## 1. CPM：定义、适用边界与决策出口

CPM 表示每一千次有效广告曝光的成本，公式为广告花费除以有效曝光次数再乘以一千。CPM 描述的是触达和曝光效率，不等于用户一定看见、记住或购买，因此必须配套可见性、频次、点击和转化指标。

**本篇的适用边界。** 本篇讨论以千次曝光为结算基础的品牌与展示广告；不把请求、填充、返回广告或未满足可见标准的曝光全部当作有效曝光。

**最常见的错误替代。** 不能用点击计费账单计算 CPM，不能把同一用户的重复曝光当作独立受众，也不能把高曝光直接解释为品牌提升。

**最终决策。** 投放团队要判断：成本变化来自竞价环境、版位、地域、人群、频次还是无效曝光，是否需要调整预算、受众、频控或创意。 因此，这篇内容不从“应该建哪张表”开始，而从业务动作、责任人和失败后果开始。只有先确定谁在什么时点做出什么决定，字段、SQL、看板和模型才有明确用途。

围绕“CPM”，工作中至少要区分四类问题：

1. **身份问题**：对象是谁，主键能否跨系统稳定关联，合并、拆分、撤销后历史是否还看得见。
2. **时间问题**：业务发生、状态生效、数据入仓、计算完成和人员行动分别发生在哪一刻。
3. **状态问题**：当前状态是一段事件、一张快照还是最终结果，空值代表未发生、未采集还是已删除。
4. **责任问题**：谁确认口径，谁处理异常，谁有权放行或停止，谁在观察期后复盘。

## 2. CPM的完整业务流程

| 环节 | 要做的事 | 最小证据 | 失败后先查什么 |
| --- | --- | --- | --- |
| 受众与预算规划 | 定义目标人群、地域、预算和频次上限 | 计划、受众版本、预算和频控 | 把广告请求或返回素材算入交付 |
| 广告请求与填充 | 记录请求、候选、竞价和广告返回 | 请求 ID、填充状态、竞价和版位 | 把重复曝光当独立用户 |
| 有效曝光 | 广告实际展示并满足曝光标准 | 曝光 ID、可见性、设备、时间和位置 | 低价但低质量曝光被判定优化 |
| 频次与去重受众 | 统计重复曝光、独立设备和估算触达 | 设备或用户标识、时间窗和隐私规则 | 曝光后成交全部算成广告效果 |
| 点击或品牌行为 | 记录点击、搜索、访问或品牌提升研究 | 点击、会话、调查或实验结果 | 把广告请求或返回素材算入交付 |
| 结算与复盘 | 按结算曝光计算费用并处理无效或返还 | 账单、调整项、结算日和币种 | 把重复曝光当独立用户 |

把 受众与预算规划、广告请求与填充、有效曝光、频次与去重受众、点击或品牌行为、结算与复盘 串起来后可以看出，CPM不是一个孤立字段，而是一条会跨系统、跨岗位、跨时间的证据链。流程图上每一段都应标出输入、输出、状态、时间戳、责任人和异常出口。只要其中一段只能靠口头解释，后续的统计、追责和自动化就会失去基础。

一个合格的需求说明应该写成：

> 在【授权数据范围】和【观察窗口】内，围绕“CPM”的【广告请求】，按【campaign_id、publisher_id、audience_id、viewability_band】比较【结算 CPM】及其【可见曝光率】，定位一个可干预节点；行动后同时观察主指标、样本量和护栏，任何高风险异常先阻断再调查。

## 3. CPM的数据对象与系统契约

| 数据对象 | 建议主键 | 一行代表什么 | 不允许混淆 |
| --- | --- | --- | --- |
| 广告请求 | `ad_request_id` | 一次可出售广告机会 | 对象身份与业务事件 |
| 曝光 | `impression_id` | 一次达到展示标准的广告曝光 | 事件、状态快照和结果粒度 |
| 可见曝光 | `viewable_impression_id` | 满足可见性标准的曝光 | 事件、状态快照和结果粒度 |
| 受众接触 | `reach_contact_id` | 同一匿名用户或设备在窗口内的接触 | 事件、状态快照和结果粒度 |
| 结算费用 | `media_cost_id` | 按曝光结算或内部核算的媒体成本 | 事件、状态快照和结果粒度 |

对象表不是把所有字段塞进一张宽表。事件、状态快照和结果表应该分别保留粒度，再通过稳定主键与版本建立关联。尤其要避免三个常见混算：把一次业务事件算成多个对象、把每日快照相加当事件总量、把最新状态覆盖历史状态。

本主题的数据契约至少应包含：

- `settled_impression_id` 的唯一性规则、生成方式和跨系统映射。
- `impression_at` 的业务含义、时区、迟到和补录规则。
- `settlement_status` 的完整状态集合，以及删除、撤销、冻结和失效的表示方法。
- 控制对象 `ads_viewability_measurement.viewability_event_id` 与主对象的关系。
- 每次口径、规则、模型或源版本变化的影响范围和下游通知对象。
- 敏感字段、允许用途、访问角色、导出限制和审计保留时间。

## 4. CPM的指标、样本与验收口径

| 指标 | 公式或定义 | 口径提醒 |
| --- | --- | --- |
| 结算 CPM | 结算广告花费 / 结算曝光次数 × 1000 | 必须使用结算曝光和最终调整后成本 |
| 可见曝光率 | 满足可见标准的曝光 / 有效曝光 | 不同媒体和格式的可见标准需注明 |
| 平均频次 | 有效曝光次数 / 估算独立触达人数 | 跨设备识别限制会导致估算偏差 |
| 千次触达成本 | 广告花费 / 估算独立触达人数 × 1000 | 不同于 CPM，需带触达窗口和去重规则 |
| 曝光后转化率 | 曝光 cohort 的有效转化数 / 可归因曝光 cohort | 需有对照组或合理归因设计 |

指标字典至少写到“任何人都能按同一份数据复跑”的程度：中文名、业务定义、公式、分子、分母、事实粒度、时间字段、对象范围、排除项、版本、负责人和验收样例，一个都不能少。比例指标必须同时展示分子、分母和样本量；金额或数量必须做守恒；状态指标必须能回到事件时间线。

对于“CPM”，建议把观察分成三层：

| 层次 | 看什么 | 不能替代什么 |
| --- | --- | --- |
| 业务结果 | 结算 CPM、可见曝光率 | 不能替代过程证据和个案回查 |
| 过程护栏 | 平均频次、千次触达成本、曝光后转化率 | 不能因为护栏暂时正常就跳过异常调查 |
| 数据证据 | 主键、时间、状态、版本、来源目标对账 | 不能只看任务成功或报表能打开 |

## 5. CPM：七个真实工作场景

以下七组场景均为公开方法结合常见工作流程构造的“脱敏复合示例”，不对应任何单一企业、患者、客户或雇员事实。场景的目的，是展示如何从现象走到证据、行动和验收，而不是虚构经营成果。

### 1. 预算增长后 CPM 突然上升

**现场。** 同一计划提高预算后，CPM 明显升高但曝光量增长有限。

**怎么查。** 检查竞价环境、时段、地域、受众饱和、频控和预算平滑；区分需求竞争与低质库存填充。

**怎么处理。** 分时段和版位扩量，设置频次与 CPM 护栏，不把预算翻倍直接压在原受众。

**验收结论。** 边际成本会随规模和竞争变化。CPM 优化要看扩量曲线，而不是单一平均值。

### 2. 曝光很多但可见率低

**现场。** 媒体报告曝光量大、CPM 低，品牌团队却发现可见曝光率偏低。

**怎么查。** 核对可见性标准、页面位置、设备、加载和不同媒体的测量口径。

**怎么处理。** 把可见曝光成本作为核心约束，低可见库存设置预算上限，并用第三方或统一标准交叉验证。

**验收结论。** 低成本曝光可能只是低质量展示。CPM 必须与可见性一起看。

### 3. 频次过高导致点击率下降

**现场。** 扩量后总点击增加，但点击率和品牌搜索下降。

**怎么查。** 按受众接触频次分桶，比较曝光、点击、后续访问和负反馈。

**怎么处理。** 设置频控和创意轮换，使用独立触达成本观察新增人群效率。

**验收结论。** 重复曝光不是免费触达。频次有边际收益，也可能产生疲劳。

### 4. 请求量与曝光量混用

**现场。** 媒体交付报表把广告请求、填充和曝光放在同一列，导致 CPM 低于实际。

**怎么查。** 验证每个对象的定义和计数层级，检查请求一对多曝光、无效流量剔除和结算调整。

**怎么处理。** 建立请求、填充、展示、可见和结算五级漏斗，KPI 明确使用哪一级。

**验收结论。** 广告链路对象不同，不能因为字段都叫 impression 就合并。

### 5. 跨设备触达重复

**现场。** 媒体估算独立用户增长，但 CRM 去重后新增用户不明显。

**怎么查。** 比较设备、登录账号、家庭和地域信息，承认跨设备识别的限制。

**怎么处理。** 将媒体触达作为估算值，结合品牌搜索、自然访问和实验评估，不用精确用户数包装。

**验收结论。** 隐私限制下的触达是估算，不是真实人口。指标必须带测量误差。

### 6. 曝光后转化归因过宽

**现场。** 一次品牌曝光后 30 天内所有自然成交都被归因于广告。

**怎么查。** 检查归因窗口、其他触点、自然基线、曝光人群选择偏差和退款。

**怎么处理。** 采用对照组、地理实验或更窄归因窗口，分别报告增量与总归因。

**验收结论。** 曝光和成交同时发生不等于广告造成成交。CPM 投放尤其需要增量证据。

### 7. 无效曝光回冲后的数据版本

**现场。** 月末平台移除异常曝光并返还费用，日报与财务月报对不上。

**怎么查。** 建立结算批次和调整记录，区分预估、交付与财务确认。

**怎么处理。** 日报用于运营、月报用于结算，保留版本和差异解释，避免修改历史事实。

**验收结论。** 数据治理不是让所有时点数字一样，而是让差异有明确原因。

七个场景可以归成一条共同判断顺序：先确认对象和时间，再确认状态和版本；然后做总量、结构和明细三层对账；最后才讨论策略、模型或工具。若一条结论不能指出对应的原始记录、责任人和行动出口，就只能算观察，不能作为生产结论。

## 6. CPM的第一段 SQL：重建业务链路

下面的 SQL 用于说明对象、时间、状态、版本和分层口径如何进入同一条可复查路径。表名和部分字段是通用示例，落地时应映射到企业数据字典；SQL 方言也需按实际引擎调整。

```sql
-- CPM：按业务对象重建链路，避免事件、快照和结果混算
WITH ranked_settled_impression_id AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY settled_impression_id
      ORDER BY updated_at DESC
    ) AS version_no
  FROM ads_settled_impression
  WHERE impression_at >= TIMESTAMP '{start_time}'
    AND impression_at <  TIMESTAMP '{end_time}'
    AND settlement_status NOT IN ('deleted', 'test')
),
valid_rows AS (
  SELECT
    settled_impression_id,
    campaign_id,
    publisher_id,
    audience_id,
    viewability_band,
    impression_at,
    settlement_status,
    ingested_at
  FROM ranked_settled_impression_id
  WHERE version_no = 1
)
SELECT
  campaign_id, publisher_id, audience_id, viewability_band,
  COUNT(DISTINCT settled_impression_id) AS object_cnt,
  SUM(settled_media_cost) * 1000.0 AS numerator_value,
  COUNT(DISTINCT settled_impression_id) AS denominator_value,
  CAST(SUM(settled_media_cost) * 1000.0 AS DOUBLE PRECISION)
    / NULLIF(COUNT(DISTINCT settled_impression_id), 0) AS metric_value,
  MIN(impression_at) AS first_event_at,
  MAX(impression_at) AS last_event_at
FROM valid_rows
GROUP BY campaign_id, publisher_id, audience_id, viewability_band
ORDER BY metric_value DESC, object_cnt DESC;
```

执行后至少回答六个问题：

- 同一对象是否因为多源回传产生多版本，版本保留是否符合业务要求？
- 业务时间与入仓时间是否分开，补录和迟到数据是否进入正确分区？
- 分子分母是否来自同一对象范围和同一统计窗口？
- 维度使用的是事件当时值还是当前值，跨期比较是否一致？
- 删除、撤销、冻结和测试数据是否按规则处理？
- 分组结果能否在明细中抽样复现？

## 7. CPM的第二段 SQL：源、控制和结果三方对账

```sql
-- CPM：源对象、控制对象和结果对象三方对账
WITH population AS (
  SELECT
    settled_impression_id,
    impression_at,
    settlement_status
  FROM ads_settled_impression
  WHERE impression_at >= TIMESTAMP '{start_time}'
    AND impression_at <  TIMESTAMP '{end_time}'
),
control AS (
  SELECT
    settled_impression_id,
    SUM(measurable_duration_ms) AS control_value,
    COUNT(DISTINCT viewability_event_id) AS control_cnt,
    MAX(updated_at) AS control_updated_at
  FROM ads_viewability_measurement
  WHERE updated_at >= TIMESTAMP '{start_time}'
  GROUP BY settled_impression_id
),
result AS (
  SELECT
    settled_impression_id,
    COUNT(*) AS result_cnt,
    MAX(calculated_at) AS calculated_at
  FROM mart_settled_impression_id
  WHERE business_date BETWEEN DATE '{start_date}' AND DATE '{end_date}'
  GROUP BY settled_impression_id
)
SELECT
  COALESCE(p.settled_impression_id, c.settled_impression_id, r.settled_impression_id) AS object_key,
  CASE
    WHEN p.settled_impression_id IS NULL THEN 'source_missing'
    WHEN c.settled_impression_id IS NULL THEN 'control_missing'
    WHEN r.settled_impression_id IS NULL THEN 'result_missing'
    WHEN ABS(COALESCE(c.control_value, 0) - COALESCE(r.result_cnt, 0)) > 0 THEN 'count_or_value_gap'
    ELSE 'matched'
  END AS reconciliation_status,
  p.settlement_status,
  c.control_value,
  c.control_cnt,
  r.result_cnt,
  c.control_updated_at,
  r.calculated_at
FROM population p
FULL OUTER JOIN control c ON p.settled_impression_id = c.settled_impression_id
FULL OUTER JOIN result r ON COALESCE(p.settled_impression_id, c.settled_impression_id) = r.settled_impression_id
WHERE p.settled_impression_id IS NULL
   OR c.settled_impression_id IS NULL
   OR r.settled_impression_id IS NULL
   OR ABS(COALESCE(c.control_value, 0) - COALESCE(r.result_cnt, 0)) > 0;
```

这段查询故意不使用“总数相差小于某个随意百分比就算通过”。它先找出缺失对象和状态差异，再检查控制值与结果值。对于CPM，数量、金额、时长或状态任意一项无法解释，都不能用“业务波动”代替排查。

对账结果建议分成四类处理：

1. **阻断**：对象缺失、关键时间为空、状态非法、金额或数量不守恒、权限越界。
2. **严重**：比例或总量显著偏离基线，且无法由已确认的对象结构变化解释。
3. **观察**：小范围波动但来源、样本和趋势可控，进入责任人和观察窗口。
4. **探索**：只有弱信号或假设，不进入正式结论，更不直接触发业务处罚。

## 8. CPM的 Python 发布门禁与指标护栏

第一段代码把发布条件写成可执行对象，避免“检查过了”只存在聊天记录里：

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class SettledImpressionIdBatch:
    batch_id: str
    source_rows: int
    valid_rows: int
    duplicate_keys: int
    missing_required_fields: int
    reconciliation_gap: float

def release_settled_impression_id(batch: SettledImpressionIdBatch) -> dict:
    checks = {
        "source_not_empty": batch.source_rows > 0,
        "valid_rows_in_range": 0 <= batch.valid_rows <= batch.source_rows,
        "duplicate_rate_ok": batch.duplicate_keys / max(batch.source_rows, 1) <= 0.001,
        "required_fields_ok": batch.missing_required_fields == 0,
        "reconciliation_ok": abs(batch.reconciliation_gap) <= 0.01,
    }
    return {
        "topic": "CPM",
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
class SettledImpressionIdObservation:
    object_id: str
    numerator: float
    denominator: float
    sample_size: int
    scope_version: str

def calculate_settled_impression_id(rows: list[SettledImpressionIdObservation]) -> list[dict]:
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
            "metric": "结算 CPM",
            "value": value,
            "lower_bound": lower if value is not None else None,
            "sample_size": row.sample_size,
            "scope_version": row.scope_version,
            "caution": "必须使用结算曝光和最终调整后成本",
        })
    return output
```

真正上线时还要补充参数配置、日志、血缘、告警级别、重跑幂等、异常样本保存和审批记录。代码通过不代表业务通过；自动检查只能证明已经定义的规则没有被违反，无法证明规则本身一定正确。

## 9. CPM的失败反例与上线验收

| 风险信号 | 错误做法 | 必须补齐的证据 | 发布或行动规则 |
| --- | --- | --- | --- |
| 请求冒充曝光 | 把广告请求或返回素材算入交付 | 请求、填充、曝光、可见和结算五级链路 | 结算指标只用结算曝光 |
| CPM 与触达混用 | 把重复曝光当独立用户 | 频次、独立设备、窗口和估算方法 | CPM 与千次触达成本分开报告 |
| 忽略可见性 | 低价但低质量曝光被判定优化 | 可见标准、媒体测量和交叉验证 | 可见曝光率进入预算护栏 |
| 曝光即因果 | 曝光后成交全部算成广告效果 | 对照组、自然基线和其他触点 | 品牌效果优先使用实验或增量方法 |

上线验收不应只有一句“报表正常”。建议按下面四层验收：

| 验收对象 | 结构要求 | 测试样本 | 结果证据 |
| --- | --- | --- | --- |
| 广告请求 | `ad_request_id` 能唯一定位一次可出售广告机会 | 正常、重复、缺失、撤销与跨期样本 | 结算 CPM可回到原始对象 |
| 曝光 | `impression_id` 能唯一定位一次达到展示标准的广告曝光 | 正常、重复、缺失、撤销与跨期样本 | 可见曝光率可回到原始对象 |
| 可见曝光 | `viewable_impression_id` 能唯一定位满足可见性标准的曝光 | 正常、重复、缺失、撤销与跨期样本 | 平均频次可回到原始对象 |
| 受众接触 | `reach_contact_id` 能唯一定位同一匿名用户或设备在窗口内的接触 | 正常、重复、缺失、撤销与跨期样本 | 千次触达成本可回到原始对象 |
| 结算费用 | `media_cost_id` 能唯一定位按曝光结算或内部核算的媒体成本 | 正常、重复、缺失、撤销与跨期样本 | 曝光后转化率可回到原始对象 |

还应为每一次发布保留一组固定回归样本：正常对象、边界状态、重复记录、缺失字段、撤销或退款、跨期、权限拒绝和失败恢复。回归样本不是演示数据，而是以后每次改规则都能重复执行的质量资产。

## 10. CPM的 30 天落地与复盘

| 阶段 | 主要交付 | 通过条件 |
| --- | --- | --- |
| 第 1 周：定义 | 对象、流程、状态、指标、排除项和责任矩阵 | 业务、数据、安全或质量负责人对同一口径签字 |
| 第 2 周：打通 | 源字段、主键、时间、版本、控制对象和失败样本 | 正常与异常样本都能回到原始记录 |
| 第 3 周：验证 | 总量对账、分层对账、抽样回查、权限测试、回滚演练 | 阻断问题清零，严重问题有责任人与期限 |
| 第 4 周：发布 | 灰度、SLO、监控、行动清单、停止条件和复盘模板 | 使用者在真实场景中完成一次闭环行动 |

如果必须用 90 秒说明“CPM”是否做对，可以按这个顺序自测：

1. 一行数据代表什么，主键是什么，哪些对象绝不能混在同一粒度？
2. 业务发生、数据可见、计算完成和行动确认分别在哪个时间点？
3. 本主题最重要的两个主指标、三个护栏和最小样本量是什么？
4. 一个异常出现时，先从原始记录、链路版本还是业务动作开始查？
5. 哪类错误必须阻断发布或停止使用，谁有权批准例外？
6. 上线后由谁在多长时间内观察，什么条件下回滚或结束？

> [!check] 完成标准
> 当另一位数据同事不看聊天记录，只根据口径卡、回归样本和代码就能复跑同一结果；当业务负责人能指出一个异常对应的原始对象、处置动作和复核证据；当系统能够阻止未授权或状态非法的数据进入下游，这篇“CPM”才算真正落到工作里。

## 公开资料与进一步阅读

- [Interactive Advertising Bureau](https://www.iab.com/)
- [Media Rating Council](https://mediaratingcouncil.org/)
- [Google Ads Help](https://support.google.com/google-ads/)

- 企业内部的CPM数据字典、流程文件、指标口径、权限制度和事故复盘。使用前应核对版本、适用机构、生效日期和责任人。
- 搜索补充资料时，优先核对监管机构、标准组织、产品官方文档和可验证案例，不把营销软文、匿名截图或单一博客结论直接当作生产依据。

> [!warning] 使用边界
> 本文为原创方法型内容，不复制任何付费文章的隐藏正文。文中的组织、人员、批次、金额、患者和结果均为脱敏或复合示例。正式项目必须使用获授权数据，并由业务、数据、安全、合规和质量负责人根据现行制度确认口径、权限、上线与回滚方案。
