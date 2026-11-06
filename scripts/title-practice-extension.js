const crypto = require("node:crypto");

const CASE_ANGLES = [
  {
    key: "definition",
    label: "对象与口径争议",
    title: (profile) => `${profile.topic}的口径冲突与双轨对账`,
    problem: "两个团队都声称在统计同一主题，但一行数据代表的业务对象不同，时间字段也不同",
    goal: "在开发报表或模型前，把对象、粒度、时间、状态和排除条件形成可执行的共同定义",
    evidence: "指标字典版本、源系统样例、两条计算链路、差异清单和业务确认记录",
    action: "先冻结本期对象范围，再分别按源系统口径和目标口径重算，对每一类差异写明原因和暂定处理",
    guardrail: "口径未确认时只发布差异分析，不把任一结果包装成正式经营指标",
    failure: "用平均值掩盖差异，或直接把对不上的明细删掉"
  },
  {
    key: "lineage",
    label: "链路断点与延迟",
    title: (profile) => `${profile.topic}从源事件到结果的长链路核查`,
    problem: "结果表出现缺失或延迟，单看调度状态却显示成功，无法判断问题发生在源端、接入、计算还是服务层",
    goal: "把业务发生时间、数据可见时间、任务完成时间和下游消费时间放到同一条证据链",
    evidence: "源端操作日志、CDC/批次水位、分区清单、任务参数、血缘关系、下游请求日志",
    action: "按时间轴核对每一跳的输入输出计数与水位，先阻断错误结果扩散，再确定重跑范围和补数窗口",
    guardrail: "无法证明数据完整的链路不进入正式发布，优先保留旧版本供下游读取",
    failure: "看到任务成功就立即补数，却没有确认重复、乱序和迟到事件"
  },
  {
    key: "decision",
    label: "决策增量与反事实",
    title: (profile) => `${profile.topic}上线后的增量验证`,
    problem: "方案上线后主指标出现变化，但同期还有活动、季节性和渠道结构调整，无法证明变化来自本次动作",
    goal: "把观察结果与可执行动作分开，判断方案是否带来可解释增量，并明确停止或扩大的条件",
    evidence: "基线、对照或趋势拟合、分组分配、主指标、护栏指标、动作时间和成本记录",
    action: "在行动前冻结观察窗口与分组规则，上线后同时报告总体结果、分层结果、置信区间和反例",
    guardrail: "收益只在少数子组出现且护栏恶化时，不扩大全量使用",
    failure: "用上线前后两张趋势图直接宣称方案有效，忽略选择偏差与自然增长"
  },
  {
    key: "recovery",
    label: "故障恢复与可回放",
    title: (profile) => `${profile.topic}失败后如何做到可恢复`,
    problem: "一次错误发布已经产生结果，团队只能凭负责人记忆寻找影响范围，补数后仍无法确认是否重复或遗漏",
    goal: "让错误输入、处理版本、影响分区和恢复结果都能被独立回放和审计",
    evidence: "运行参数、代码版本、输入快照、输出摘要、受影响分区、回滚记录和补数对账",
    action: "保存现场并停止下游扩散，按影响边界回滚或隔离结果，使用幂等任务从最小必要范围重新计算",
    guardrail: "恢复任务没有对账、没有版本记录或无法重复执行时，不宣布故障结束",
    failure: "直接覆盖目标表，或者把所有分区全部重跑以求省事"
  },
  {
    key: "cost",
    label: "成本、质量与时效取舍",
    title: (profile) => `${profile.topic}的三方取舍实验`,
    problem: "为追求更快结果不断增加资源，账单和重复计算同步上升，但业务真正使用的时效并没有显著改善",
    goal: "把新鲜度、正确性和成本分别量化，找到满足真实决策节奏的最低必要资源",
    evidence: "执行计划、扫描量、文件数、峰值资源、单位产出成本、业务截止时间和质量门禁",
    action: "先按使用场景和截止时间分级，再比较预聚合、增量计算、缓存、并发调整和生命周期策略",
    guardrail: "任何优化都必须同时通过结果对账、延迟目标与成本预算，不能只展示一次最快执行",
    failure: "为了压缩账单关闭质量检查，或为了刷新频率重复计算无人消费的全量结果"
  },
  {
    key: "handoff",
    label: "跨团队交接与责任",
    title: (profile) => `${profile.topic}跨团队交接的契约缺口`,
    problem: "上游认为字段已经交付，下游却持续遇到状态含义、历史归属和异常处理不一致，问题在群聊中反复流转",
    goal: "把数据定义、变更通知、失败动作、服务时限和责任人写成可测试的运行契约",
    evidence: "数据契约版本、字段语义、接口样例、变更记录、工单时效、消费者验收和升级路径",
    action: "组织上游生产、数据开发、消费方和安全人员做一次契约评审，把模糊责任改成可执行的检查项",
    guardrail: "业务定义、粒度或状态语义发生破坏性变化时，未通知消费者不得直接发布",
    failure: "只建立群聊和文档链接，却没有版本、负责人、失败动作和下线流程"
  },
  {
    key: "privacy",
    label: "权限、隐私与审计",
    title: (profile) => `${profile.topic}的最小权限与越权核查`,
    problem: "分析结果本身可以访问，但派生字段、导出文件和临时表扩大了敏感数据范围，现有流程没有及时识别",
    goal: "让数据用途、最小字段、访问角色、加工产物、保存期限和撤回机制都可追溯",
    evidence: "分类分级、授权记录、字段血缘、访问日志、导出清单、脱敏规则和过期清理记录",
    action: "按任务拆分数据集与角色，使用最小字段和临时授权，发布前检查派生表与导出是否出现敏感扩散",
    guardrail: "高风险字段缺少授权、脱敏或审计时不进入分析环境，紧急访问必须到期自动回收",
    failure: "把“内网可访问”当成“业务已授权”，或者用永久大权限账号支撑临时分析"
  },
  {
    key: "quality",
    label: "质量门禁与例外治理",
    title: (profile) => `${profile.topic}上线前的质量门禁`,
    problem: "常规日期下结果看起来正常，一旦遇到空值、重复、跨期、撤销或历史归属，报表口径便无法解释",
    goal: "把关键质量规则、阈值、例外审批、阻断动作和复核人写入发布流程",
    evidence: "五类边界样本、规则命中率、趋势对比、豁免记录、责任人、阻断结果和复盘工单",
    action: "从阻断、严重、观察三级建立规则，先修数据和逻辑，再决定是否允许有期限的业务例外",
    guardrail: "影响资金、安全、监管或核心经营判断的关键规则失败时停止发布",
    failure: "一直调低阈值让报表通过，却没有处理规则为何持续失败"
  }
];

const OPENING_STYLES = [
  (profile, angle) => `某${profile.context.label}团队在季度复盘时重新讨论“${profile.topic}”。讨论并没有从工具选型开始，而是先追问一个更基础的问题：${angle.problem}。`,
  (profile, angle) => `一次例行发布后，负责“${profile.topic}”的小组收到下游反馈：数字和源系统对不上，但任务本身全部成功。团队决定围绕“${angle.label}”做一次完整回放。`,
  (profile, angle) => `团队准备把“${profile.topic}”从个人分析脚本升级为多人共用的数据能力。第一次评审就暴露出：${angle.problem}。`,
  (profile, angle) => `某组织希望用“${profile.topic}”支持一次真实决策，但在取数与评审阶段发现，${angle.problem}。这个案例因此从问题定义重新开始。`,
  (profile, angle) => `一个看似普通的“${profile.topic}”需求，在跨系统核验后变成了围绕“${angle.label}”的专项排查。触发排查的不是一次严重事故，而是连续几次解释不清的数据差异。`
];

const SQL_VARIANTS = [
  (profile) => {
    const ctx = profile.context;
    const entity = ctx.entities[0][1];
    const metric = ctx.metricDefs[profile.seed % ctx.metricDefs.length];
    return `-- ${profile.topic}：源表与结果表按对象对账
WITH source_side AS (
  SELECT
    ${entity} AS entity_key,
    COUNT(DISTINCT event_id) AS event_cnt,
    SUM(metric_value) AS metric_sum
  FROM ${ctx.factTable}
  WHERE ${ctx.dateField} >= :start_date
    AND ${ctx.dateField} <  :end_date
    AND subject_key = '${sqlToken(profile.topic)}'
    AND is_deleted = 0
  GROUP BY ${entity}
),
result_side AS (
  SELECT
    ${entity} AS entity_key,
    event_cnt,
    metric_sum
  FROM ${ctx.factTable}_result
  WHERE stat_date BETWEEN :start_date AND :end_date
    AND subject_key = '${sqlToken(profile.topic)}'
)
SELECT
  COALESCE(s.entity_key, r.entity_key) AS entity_key,
  s.event_cnt AS source_event_cnt,
  r.event_cnt AS result_event_cnt,
  s.metric_sum AS source_metric_sum,
  r.metric_sum AS result_metric_sum,
  COALESCE(r.metric_sum, 0) - COALESCE(s.metric_sum, 0) AS metric_diff
FROM source_side s
FULL OUTER JOIN result_side r USING (entity_key)
WHERE ABS(COALESCE(r.metric_sum, 0) - COALESCE(s.metric_sum, 0)) > 0
   OR COALESCE(s.event_cnt, 0) <> COALESCE(r.event_cnt, 0)
ORDER BY ABS(metric_diff) DESC;`;
  },
  (profile) => {
    const ctx = profile.context;
    return `-- ${profile.topic}：状态链与时间间隔核查
WITH ordered_events AS (
  SELECT
    ${ctx.entities[0][1]} AS entity_key,
    event_id,
    stage_code,
    ${ctx.dateField} AS event_time,
    LAG(stage_code) OVER (
      PARTITION BY ${ctx.entities[0][1]}
      ORDER BY ${ctx.dateField}, event_id
    ) AS previous_stage,
    LAG(${ctx.dateField}) OVER (
      PARTITION BY ${ctx.entities[0][1]}
      ORDER BY ${ctx.dateField}, event_id
    ) AS previous_time
  FROM ${ctx.factTable}
  WHERE ${ctx.dateField} >= :start_date
    AND ${ctx.dateField} <  :end_date
    AND subject_key = '${sqlToken(profile.topic)}'
)
SELECT
  entity_key,
  previous_stage,
  stage_code,
  event_time,
  event_time - previous_time AS elapsed,
  CASE
    WHEN event_time < previous_time THEN 'time_reversed'
    WHEN previous_stage = stage_code THEN 'duplicate_stage'
    WHEN previous_stage IS NULL THEN 'missing_prefix'
    ELSE 'candidate_delay'
  END AS exception_type
FROM ordered_events
WHERE event_time < previous_time
   OR previous_stage = stage_code
   OR event_time - previous_time > INTERVAL '1 hour'
ORDER BY exception_type, elapsed DESC;`;
  },
  (profile) => {
    const ctx = profile.context;
    const controls = ctx.controls.slice(0, 3);
    return `-- ${profile.topic}：发布前质量画像
SELECT
  '${sqlToken(profile.topic)}' AS subject_key,
  stat_date,
  COUNT(*) AS row_cnt,
  COUNT(DISTINCT event_id) AS distinct_event_cnt,
  SUM(CASE WHEN event_id IS NULL THEN 1 ELSE 0 END) AS null_event_cnt,
  SUM(CASE WHEN ${ctx.dateField} < business_time THEN 1 ELSE 0 END) AS time_reverse_cnt,
  SUM(CASE WHEN status NOT IN ('valid', 'completed', 'cancelled') THEN 1 ELSE 0 END) AS invalid_status_cnt,
  ROUND(COUNT(*) * 1.0 / NULLIF(COUNT(DISTINCT event_id), 0), 4) AS duplication_ratio
FROM ${ctx.factTable}
WHERE stat_date BETWEEN :start_date AND :end_date
GROUP BY stat_date
HAVING SUM(CASE WHEN event_id IS NULL THEN 1 ELSE 0 END) > 0
    OR SUM(CASE WHEN ${ctx.dateField} < business_time THEN 1 ELSE 0 END) > 0
    OR COUNT(*) <> COUNT(DISTINCT event_id)
ORDER BY stat_date;

-- 至少人工核对一次：${controls.join("；")}。`;
  },
  (profile) => {
    const ctx = profile.context;
    const metric = ctx.metricDefs[(profile.seed + 1) % ctx.metricDefs.length];
    const dimension = ctx.dims[profile.seed % ctx.dims.length];
    return `-- ${profile.topic}：行动前后与分组增量
WITH scoped AS (
  SELECT
    ${ctx.entities[0][1]} AS entity_key,
    ${dimension} AS decision_group,
    ${ctx.dateField} AS event_date,
    metric_value,
    CASE
      WHEN ${ctx.dateField} <  :action_date THEN 'before'
      ELSE 'after'
    END AS period_label
  FROM ${ctx.factTable}
  WHERE ${ctx.dateField} >= :analysis_start
    AND ${ctx.dateField} <  :analysis_end
    AND subject_key = '${sqlToken(profile.topic)}'
),
grouped AS (
  SELECT
    decision_group,
    period_label,
    COUNT(DISTINCT entity_key) AS entity_cnt,
    AVG(metric_value) AS metric_avg,
    SUM(metric_value) AS metric_sum
  FROM scoped
  GROUP BY decision_group, period_label
),
compared AS (
  SELECT
    decision_group,
    MAX(CASE WHEN period_label = 'before' THEN metric_avg END) AS before_avg,
    MAX(CASE WHEN period_label = 'after' THEN metric_avg END) AS after_avg,
    MAX(CASE WHEN period_label = 'before' THEN entity_cnt END) AS before_cnt,
    MAX(CASE WHEN period_label = 'after' THEN entity_cnt END) AS after_cnt
  FROM grouped
  GROUP BY decision_group
)
SELECT
  decision_group,
  before_avg,
  after_avg,
  after_avg - before_avg AS naive_delta,
  '${metric[0]}' AS metric_name,
  '${profile.guide?.checks?.[0] || ctx.controls[0]}' AS required_evidence
FROM compared
WHERE before_cnt >= 30 AND after_cnt >= 30
ORDER BY ABS(after_avg - before_avg) DESC;`;
  },
  (profile) => {
    const ctx = profile.context;
    return `-- ${profile.topic}：字段血缘与影响范围
WITH changed_columns AS (
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = :source_schema
    AND table_name = :source_table
    AND last_altered_at >= :change_time
),
downstream_assets AS (
  SELECT
    asset_id,
    asset_name,
    asset_type,
    owner_name,
    criticality,
    last_used_at
  FROM metadata_asset_relation
  WHERE upstream_asset_id = :source_asset_id
    AND relation_status = 'active'
)
SELECT
  d.asset_id,
  d.asset_name,
  d.asset_type,
  d.owner_name,
  d.criticality,
  d.last_used_at,
  COUNT(c.column_name) AS changed_column_cnt,
  CASE
    WHEN d.criticality IN ('core', 'regulated') THEN 'block_release'
    WHEN d.last_used_at >= CURRENT_DATE - INTERVAL '7 days' THEN 'notify_owner'
    ELSE 'register_review'
  END AS required_action
FROM downstream_assets d
CROSS JOIN changed_columns c
GROUP BY d.asset_id, d.asset_name, d.asset_type, d.owner_name, d.criticality, d.last_used_at
ORDER BY
  CASE WHEN d.criticality IN ('core', 'regulated') THEN 0 ELSE 1 END,
  d.last_used_at DESC;

-- 目标：变更前识别 ${ctx.systems.slice(0, 3).join("、")} 之后的所有结果与消费者。`;
  },
  (profile) => {
    const ctx = profile.context;
    const entity = ctx.entities[0][1];
    return `-- ${profile.topic}：恢复后缺失、重复与跨期检查
WITH expected_keys AS (
  SELECT DISTINCT ${entity} AS entity_key, event_id
  FROM ${ctx.factTable}
  WHERE ${ctx.dateField} >= :restore_start
    AND ${ctx.dateField} <  :restore_end
    AND subject_key = '${sqlToken(profile.topic)}'
),
restored_keys AS (
  SELECT ${entity} AS entity_key, event_id, load_version, loaded_at
  FROM ${ctx.factTable}
  WHERE ${ctx.dateField} >= :restore_start
    AND ${ctx.dateField} <  :restore_end
    AND subject_key = '${sqlToken(profile.topic)}'
    AND load_version = :restore_version
),
coverage AS (
  SELECT
    (SELECT COUNT(*) FROM expected_keys) AS expected_cnt,
    (SELECT COUNT(*) FROM restored_keys) AS restored_cnt,
    (SELECT COUNT(*) FROM (
      SELECT entity_key, event_id
      FROM restored_keys
      GROUP BY entity_key, event_id
      HAVING COUNT(*) > 1
    ) duplicate_keys) AS duplicated_cnt,
    (SELECT COUNT(*) FROM (
      SELECT e.entity_key, e.event_id
      FROM expected_keys e
      LEFT JOIN restored_keys r USING (entity_key, event_id)
      WHERE r.entity_key IS NULL
    ) missing_keys) AS missing_cnt
)
SELECT *,
  CASE
    WHEN expected_cnt <> restored_cnt OR duplicated_cnt > 0 OR missing_cnt > 0
      THEN 'reject_release'
    ELSE 'accept_restore'
  END AS gate_result
FROM coverage;`;
  }
];

const PYTHON_VARIANTS = [
  (profile) => `from datetime import date
from hashlib import sha256

import pandas as pd

SUBJECT = "${profile.topic}"
BLOCKING_RULES = ${JSON.stringify(profile.context.controls.slice(0, 3))}


def validate_release(frame: pd.DataFrame, start: date, end: date) -> dict:
    scoped = frame.loc[
        frame["event_date"].between(pd.Timestamp(start), pd.Timestamp(end))
        & (frame["subject_key"] == "${sqlToken(profile.topic)}")
    ].copy()
    checks = {
        "has_rows": len(scoped) > 0,
        "event_id_unique": not scoped["event_id"].duplicated().any(),
        "entity_key_complete": scoped["entity_key"].notna().all(),
        "event_time_present": scoped["event_time"].notna().all(),
        "scope_matches": scoped["subject_key"].nunique() == 1,
    }
    payload = f"{SUBJECT}|{start}|{end}|{len(scoped)}|{sorted(checks.items())}"
    return {
        "subject": SUBJECT,
        "rows": len(scoped),
        "checks": checks,
        "blocking_rules": BLOCKING_RULES,
        "release_allowed": all(checks.values()),
        "evidence_hash": sha256(payload.encode("utf-8")).hexdigest(),
    }`,
  (profile) => `import pandas as pd

KEY = ["entity_key", "event_id"]
AMOUNT_COLUMNS = ["metric_value", "adjustment_value"]


def reconcile(source: pd.DataFrame, result: pd.DataFrame) -> pd.DataFrame:
    def aggregate(frame: pd.DataFrame, side: str) -> pd.DataFrame:
        grouped = (
            frame.groupby("entity_key", dropna=False)
            .agg(
                event_cnt=("event_id", "nunique"),
                metric_sum=("metric_value", "sum"),
                adjustment_sum=("adjustment_value", "sum"),
            )
            .reset_index()
        )
        return grouped.rename(columns={
            "event_cnt": f"{side}_event_cnt",
            "metric_sum": f"{side}_metric_sum",
            "adjustment_sum": f"{side}_adjustment_sum",
        })

    compared = aggregate(source, "source").merge(
        aggregate(result, "result"),
        on="entity_key",
        how="outer",
    )
    compared["metric_diff"] = (
        compared["result_metric_sum"].fillna(0)
        - compared["source_metric_sum"].fillna(0)
    )
    compared["event_diff"] = (
        compared["result_event_cnt"].fillna(0)
        - compared["source_event_cnt"].fillna(0)
    )
    compared["exception"] = compared.apply(
        lambda row: "missing_result" if pd.isna(row["result_metric_sum"])
        else "unexpected_result" if pd.isna(row["source_metric_sum"])
        else "count_diff" if row["event_diff"] != 0
        else "amount_diff",
        axis=1,
    )
    return compared.loc[
        (compared["metric_diff"].abs() > 0) | (compared["event_diff"] != 0)
    ].sort_values("metric_diff", key=lambda values: values.abs(), ascending=False)`,
  (profile) => `from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class ReleaseEvidence:
    subject: str
    source_watermark: datetime
    output_watermark: datetime
    source_rows: int
    output_rows: int
    duplicate_rows: int
    blocked_rows: int
    code_version: str
    parameter_version: str


def release_gate(evidence: ReleaseEvidence) -> tuple[bool, list[str]]:
    reasons = []
    if evidence.source_watermark != evidence.output_watermark:
        reasons.append("watermark_mismatch")
    if evidence.source_rows != evidence.output_rows:
        reasons.append("row_count_mismatch")
    if evidence.duplicate_rows:
        reasons.append("duplicate_keys")
    if evidence.blocked_rows:
        reasons.append("blocking_quality_rule_failed")
    if not evidence.code_version or not evidence.parameter_version:
        reasons.append("release_provenance_missing")
    return not reasons, reasons


evidence = ReleaseEvidence(
    subject="${profile.topic}",
    source_watermark=datetime.fromisoformat("2026-11-06T02:00:00"),
    output_watermark=datetime.fromisoformat("2026-11-06T02:00:00"),
    source_rows=0,
    output_rows=0,
    duplicate_rows=0,
    blocked_rows=0,
    code_version="demo-v1",
    parameter_version="scope-v1",
)
print(release_gate(evidence))`,
  (profile) => `import json
from pathlib import Path


def build_evidence_manifest(
    subject: str,
    scope: dict,
    checks: dict,
    samples: list[dict],
    owner: str,
) -> dict:
    failed = [name for name, passed in checks.items() if not passed]
    return {
        "subject": subject,
        "scope": scope,
        "checks": checks,
        "failed_checks": failed,
        "sample_evidence": samples[:5],
        "owner": owner,
        "decision": "block" if failed else "review",
        "manual_questions": [
            "每一项失败是否已回到原始记录",
            "对象、时间和状态是否与指标字典一致",
            "回滚或修复后是否重新完成对账",
        ],
    }


manifest = build_evidence_manifest(
    subject="${profile.topic}",
    scope={"systems": ${JSON.stringify(profile.context.systems.slice(0, 4))}},
    checks={"definition_frozen": False, "reconciled": False},
    samples=[],
    owner="${profile.context.participants[0]}",
)
Path("release-evidence.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2),
    encoding="utf-8",
)
print(manifest["decision"])`
];

function hashNumber(value) {
  const digest = crypto.createHash("sha1").update(value).digest();
  return digest.readUInt32BE(0);
}

function sqlToken(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "subject";
}

function pick(items, seed) {
  return items[Math.abs(seed) % items.length];
}

function orderedAngles(profile) {
  return CASE_ANGLES
    .map((angle, index) => ({
      angle,
      score: hashNumber(`${profile.relativePath}:${profile.topic}:${angle.key}:${index}`)
    }))
    .sort((left, right) => left.score - right.score)
    .map((entry) => entry.angle)
    .slice(0, 4);
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function caseContext(profile, angle, index) {
  const ctx = profile.context;
  const entity = ctx.entities[index % ctx.entities.length];
  const nextEntity = ctx.entities[(index + 1) % ctx.entities.length];
  const system = ctx.systems[(profile.seed + index) % ctx.systems.length];
  const nextSystem = ctx.systems[(profile.seed + index + 1) % ctx.systems.length];
  const metric = ctx.metricDefs[(profile.seed + index) % ctx.metricDefs.length];
  const guardMetric = ctx.metricDefs[(profile.seed + index + 2) % ctx.metricDefs.length];
  const dimension = ctx.dims[(profile.seed + index) % ctx.dims.length];
  const nextDimension = ctx.dims[(profile.seed + index + 2) % ctx.dims.length];
  const risk = ctx.risks[(profile.seed + index) % ctx.risks.length];
  const control = ctx.controls[(profile.seed + index) % ctx.controls.length];
  const stage = ctx.stages[(profile.seed + index) % ctx.stages.length];
  const lens = profile.focusLenses[index % Math.max(profile.focusLenses.length, 1)] ||
    profile.guide?.lenses?.[index % profile.guide.lenses.length] ||
    ["证据链", "结果能否回到原始记录", control, "缺少证据时阻断发布"];
  const check = profile.guide?.checks?.[index % profile.guide.checks.length] || control;
  const owner = ctx.participants[(profile.seed + index) % ctx.participants.length];
  return {
    angle,
    entity,
    nextEntity,
    system,
    nextSystem,
    metric,
    guardMetric,
    dimension,
    nextDimension,
    risk,
    control,
    stage,
    lens,
    check,
    owner
  };
}

function caseBody(profile, angle, index) {
  const c = caseContext(profile, angle, index);
  const opening = pick(OPENING_STYLES, hashNumber(`${profile.relativePath}:${angle.key}:opening`))(
    profile,
    angle
  );
  const scopeText = `本次只使用为了回答该问题所必需的脱敏范围：${c.entity[0]}、${c.nextEntity[0]}及其在${c.stage}前后的状态记录；时间窗覆盖一个完整业务周期，并保留行动前后的观察窗口。`;
  const evidenceText = `${angle.evidence}。核验时至少抽取正常、边界、重复或迟到、权限拒绝四类样本，并让“${c.owner}”确认什么结果可以进入下一步。`;
  const decisionText = `最终动作不是“把报表做出来”，而是由${c.owner}在明确时限内，根据${c.metric[0]}、${c.guardMetric[0]}和${c.control}决定继续、回退、补查还是转人工。`;
  const failureText = `${angle.failure}。这类做法即使暂时让数字看起来一致，也会让后续无法区分“业务变化、数据缺失、规则例外和计算错误”。`;

  const details = [
    `- **为什么要做：** ${angle.goal}。在本场景里，核心风险还包括${c.risk}，所以项目从一开始就把“结果能解释”与“结果能产出”放在同等位置。`,
    `- **对象与数据范围：** ${scopeText} 主键重点关注${c.entity[1]}与${c.nextEntity[1]}，时间上区分业务发生、数据可见和下游采用三个节点。`,
    `- **关键异常或争议：** ${angle.problem}。初看时，${c.system}与${c.nextSystem}的状态字段似乎可以互换，但抽取边界记录后发现二者更新节奏和责任人不同。`,
    `- **核验证据：** ${evidenceText}`,
    `- **处理步骤：** 第一步先冻结“${profile.topic}”的当前定义并记录版本；第二步用${c.entity[0]}明细核对${c.system}到${c.nextSystem}的关联；第三步按${c.dimension}与${c.nextDimension}做基线和结构比较；第四步记录异常样本、规则豁免与人工判断；第五步发布小范围结果，观察${c.metric[0]}和护栏指标${c.guardMetric[0]}。`,
    `- **行动与护栏：** ${angle.action}。专题检查项“${c.check}”被写成发布门禁，${angle.guardrail}。`,
    `- **失败路径：** ${failureText}`,
    `- **可迁移结论：** 处理“${profile.topic}”时，先验证${c.lens[2] || c.control}，再讨论工具参数或资源调整。若证据只能支持一个假设，就把它标成假设，并为下一轮验证保留对照与样本。`
  ];
  return `### 案例 ${index + 4}：${angle.title(profile)}

${opening} 下面的组织、规模和结果均为公开方法结合常见工作场景形成的脱敏复合示例，不对应任何单一企业事实。

${details.join("\n")}

> [!note] 本例验收
> ${decisionText} 若${c.risk}或关键检查项没有证据，结论应停在“待核验”，不能用业务解释替代数据回放。`;
}

function designTable(profile, angles) {
  return [
    "| 案例 | 观察角度 | 首要对象 | 关键证据 | 失败时先停什么 |",
    "| --- | --- | --- | --- | --- |",
    ...angles.map((angle, index) => {
      const c = caseContext(profile, angle, index);
      return `| 案例 ${index + 4} | ${angle.label} | ${c.entity[0]} / ${c.nextEntity[0]} | ${angle.evidence.split("、").slice(0, 3).join("、")} | ${angle.guardrail} |`;
    })
  ].join("\n");
}

function validationTable(profile, angles) {
  const ctx = profile.context;
  return [
    "| 验证面 | 发布前问题 | 证据 | 不通过时 |",
    "| --- | --- | --- | --- |",
    `| 对象与粒度 | 一行数据代表${ctx.entities[0][0]}、事件、快照还是结果 | 主键、版本、有效时间和边界样本 | 阻断 |`,
    `| 时间语义 | 业务发生、数据可见、决策采用是否混用 | ${ctx.dateField}、入仓时间、行动时间轴 | 阻断 |`,
    `| 指标口径 | ${ctx.metricDefs[0][0]}的分子、分母和排除项是否冻结 | 指标字典、SQL、对账结果 | 阻断正式指标 |`,
    `| 状态与关联 | ${ctx.stages.slice(0, 4).join(" → ")}是否可达且可追溯 | 状态机、明细、操作日志 | 阻断关键链路 |`,
    `| 权限与最小字段 | 派生表、导出和临时授权是否扩大访问范围 | 分类分级、字段血缘、访问日志 | 阻断导出 |`,
    `| 恢复与审计 | 失败后能否定位影响范围并幂等重跑 | 参数、版本、分区清单、补数对账 | 阻断发布 |`
  ].join("\n");
}

function variantIntro(profile, angles) {
  return [
    `## 扩展实战：${profile.topic}的四个可执行案例`,
    "",
    `> [!info] 内容说明`,
    `> 以下内容围绕“${profile.topic}”补充四个相互独立的工作场景，分别落在${angles.map((angle) => angle.label).join("、")}。它们使用公开方法、常见系统边界和脱敏数据构造，重点展示怎样从现象回到对象、流程、代码、行动与验收，而不是给出一个可以套用所有企业的标准答案。`,
    "",
    designTable(profile, angles),
    "",
    `这四个案例共享一条底线：先证明数据对象和链路能够解释，再讨论优化或决策。任何涉及资金、医疗安全、用户隐私、监管报送或核心权限的结果，都需要保留人工复核、阻断条件和回滚路径。`,
    ""
  ].join("\n");
}

function codeSection(profile) {
  const sql = pick(SQL_VARIANTS, profile.seed)(profile).trim();
  const python = pick(PYTHON_VARIANTS, profile.seed + profile.topic.length)(profile).trim();
  return [
    `### 扩展代码一：从${profile.topic}回到可核对明细`,
    "",
    "```sql",
    sql,
    "```",
    "",
    "执行这段 SQL 后，不要只看总量。应同时保存查询参数、口径版本、异常对象清单和对应原始记录抽样。若结果依赖人工过滤，要把过滤条件登记为规则，而不是留在个人脚本里。",
    "",
    `### 扩展代码二：把${profile.topic}的验收证据写成门禁`,
    "",
    "```python",
    python,
    "```",
    "",
    "示例中的行数、时间戳和版本号均为占位值。生产实现应从调度参数、数据契约和质量平台读取真实信息，并将失败结果回写到工单、发布系统和责任人，而不是只打印在日志中。",
    ""
  ].join("\n");
}

function closingSection(profile) {
  return [
    `### 四个案例共用的验收清单`,
    "",
    validationTable(profile, orderedAngles(profile)),
    "",
    "### 如果要把案例继续做深",
    "",
    `1. **补一张真实但脱敏的链路图：** 标出${profile.context.systems.slice(0, 5).join("、")}之间的主键、时间、状态、版本、责任人和失败动作。`,
    `2. **补一份指标或规则字典：** 说明${profile.context.metricDefs.slice(0, 3).map(([name]) => name).join("、")}的定义、粒度、排除项、负责人和验收样例。`,
    `3. **补一组代码证据：** 保留 SQL/Python、执行参数、输入输出计数、质量结果和一次失败回放，证明代码不只展示成功路径。`,
    `4. **补一次业务评审：** 让${profile.context.participants.slice(0, 4).join("、")}分别说明结果会改变什么动作，以及哪些结论仍缺少证据。`,
    `5. **补一次复盘：** 记录${profile.context.risks.slice(0, 3).join("、")}是否发生、护栏是否生效、哪些处理应进入下一版标准。`,
    "",
    `> [!check] 标题专属自测`,
    `> 不使用“${profile.topic}很重要”这类空话，连续回答：一行数据代表什么；${profile.context.entities.slice(0, 3).map(([name]) => name).join("、")}如何关联；哪个时间字段决定业务事实；哪个状态会导致分母变化；如果结果差 20%，先回查哪三条证据；哪类异常必须阻断。`,
    ""
  ].join("\n");
}

function buildTitlePracticeExtension(profile) {
  const angles = orderedAngles(profile);
  return [
    variantIntro(profile, angles),
    angles.map((angle, index) => caseBody(profile, angle, index)).join("\n"),
    "",
    codeSection(profile),
    closingSection(profile)
  ].join("\n");
}

function insertBeforeReferences(body, extension) {
  const markers = [
    "\n## 附录：公开资料与方法依据",
    "\n## 公开资料与进一步阅读"
  ];
  const marker = markers.find((item) => body.includes(item));
  if (!marker) return `${body.trimEnd()}\n\n${extension}`;
  const index = body.indexOf(marker);
  return `${body.slice(0, index).trimEnd()}\n\n${extension}\n${body.slice(index).trimStart()}`;
}

module.exports = {
  buildTitlePracticeExtension,
  insertBeforeReferences
};
