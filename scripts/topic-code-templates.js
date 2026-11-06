function buildKafkaCode(topic, token) {
  return `from kafka import KafkaConsumer, TopicPartition

TOPIC_NAME = "orders.events.v2"
GROUP_ID = "${token}"
consumer = KafkaConsumer(
    bootstrap_servers=["broker-a:9092", "broker-b:9092"],
    group_id=GROUP_ID,
    enable_auto_commit=False,
)

partitions = [TopicPartition(TOPIC_NAME, p) for p in consumer.partitions_for_topic(TOPIC_NAME)]
end_offsets = consumer.end_offsets(partitions)
committed = {p: consumer.committed(p) or 0 for p in partitions}
lag_rows = [
    {
        "partition": p.partition,
        "lag": end_offsets[p] - committed[p],
        "committed": committed[p],
        "end_offset": end_offsets[p],
    }
    for p in partitions
]
lag_rows.sort(key=lambda row: row["lag"], reverse=True)
print({"topic": ${topic}, "hottest": lag_rows[:5], "total_lag": sum(r["lag"] for r in lag_rows)})

# 诊断顺序：单分区 Lag -> 处理耗时 -> Rebalance -> Broker -> 下游 Sink。
# 只有实例吞吐已达上限且分区可分配时才扩容，否则扩容会放大重平衡。`;
}

function buildSparkCode(topic, token) {
  return `from pyspark.sql import SparkSession, functions as F

spark = SparkSession.builder.appName("${token}-skew").getOrCreate()
source = spark.read.table("dwd_order_detail").where("dt between '2026-10-01' and '2026-10-31'")

profile = (
    source.groupBy("merchant_id")
    .agg(F.count("*").alias("row_cnt"), F.sum("pay_amount").alias("gmv"))
)
profile.orderBy(F.desc("row_cnt")).show(20, truncate=False)

hot_threshold = profile.approxQuantile("row_cnt", [0.99], 0.01)[0]
hot_ids = [
    row.merchant_id
    for row in profile.where(F.col("row_cnt") > hot_threshold).limit(200).collect()
]
hot = source.where(F.col("merchant_id").isin(hot_ids))
normal = source.where(F.col("merchant_id").isNull() | ~F.col("merchant_id").isin(hot_ids))

hot_salted = hot.withColumn("salt", F.explode(F.sequence(F.lit(0), F.lit(7))))
partial = hot_salted.groupBy("merchant_id", "salt").agg(F.sum("pay_amount").alias("amount"))
result = partial.groupBy("merchant_id").agg(F.sum("amount").alias("amount"))

# 主题：${topic}
# 对账必须校验总金额、订单数、去重用户数；同时记录 Spark UI Task 分位数、spill 和 Shuffle 读写。`;
}

function buildStreamingCode(topic, token) {
  return `from pyflink.table import EnvironmentSettings, TableEnvironment

settings = EnvironmentSettings.in_streaming_mode()
t_env = TableEnvironment.create(settings)
t_env.get_config().set("execution.checkpointing.interval", "30 s")
t_env.get_config().set("table.exec.state.ttl", "24 h")

t_env.execute_sql("""
CREATE TABLE order_events (
  event_id STRING,
  order_id STRING,
  event_time TIMESTAMP(3),
  amount DECIMAL(18, 2),
  WATERMARK FOR event_time AS event_time - INTERVAL '8' SECOND
) WITH (
  'connector' = 'kafka',
  'topic' = 'order-events-v2',
  'properties.bootstrap.servers' = 'broker:9092',
  'properties.group.id' = '${token}',
  'format' = 'json'
)
""")

t_env.execute_sql("""
SELECT order_id, COUNT(DISTINCT event_id) AS event_cnt, SUM(amount) AS amount
FROM order_events
GROUP BY order_id, TUMBLE(event_time, INTERVAL '1' MINUTE)
""").print()

# 主题：${topic}
# 必须测试迟到、乱序、重复和 Checkpoint 恢复；Sink 按业务主键幂等 upsert。`;
}

function buildCdcCode(topic) {
  return `from dataclasses import dataclass

@dataclass
class CdcEvent:
    primary_key: str
    operation: str
    commit_lsn: int
    after: dict | None

def apply_cdc(events: list[CdcEvent], stored: dict[str, dict]) -> dict[str, dict]:
    target = {key: value.copy() for key, value in stored.items()}
    for event in sorted(events, key=lambda item: item.commit_lsn):
        current = target.get(event.primary_key)
        if current and current["_lsn"] >= event.commit_lsn:
            continue
        if event.operation in {"d", "delete"}:
            target.pop(event.primary_key, None)
            continue
        row = dict(event.after or {})
        row["_lsn"] = event.commit_lsn
        target[event.primary_key] = row
    return target

# 主题：${topic}
# 集成测试要覆盖“全量快照期间持续写入”、重复投递、DDL 变更、断点重放和逻辑删除。
# 发布门禁按分段行数、金额、更新时间、删除状态和抽样明细做源目标对账。`;
}

function buildWarehouseCode(topic) {
  return `-- ${topic}
-- 先声明粒度：一行 = 一个订单商品行在支付成功时形成的可加事实。
WITH paid_order AS (
  SELECT
    order_id,
    order_line_id,
    merchant_id,
    paid_at,
    quantity,
    pay_amount,
    refund_amount,
    ROW_NUMBER() OVER (PARTITION BY order_line_id ORDER BY updated_at DESC) AS rn
  FROM dwd_order_line
  WHERE dt >= DATE '2026-10-01'
    AND dt <  DATE '2026-11-01'
    AND pay_status = 'PAID'
),
dim_merchant AS (
  SELECT merchant_id, category_name, valid_from, valid_to
  FROM dim_merchant
  WHERE valid_from < DATE '2026-11-01'
    AND valid_to >= DATE '2026-10-01'
)
SELECT
  DATE(p.paid_at) AS stat_date,
  m.category_name,
  COUNT(DISTINCT p.order_id) AS order_cnt,
  SUM(p.quantity) AS item_cnt,
  SUM(p.pay_amount - p.refund_amount) AS net_gmv
FROM paid_order p
JOIN dim_merchant m
  ON p.merchant_id = m.merchant_id
 AND p.paid_at >= m.valid_from
 AND p.paid_at <  m.valid_to
WHERE p.rn = 1
GROUP BY DATE(p.paid_at), m.category_name;

-- 对账：事实主键、金额平衡、维度有效期、跨期退款和源系统抽样分别留证据。`;
}

function buildSchedulingCode(topic, token) {
  return `from datetime import datetime, timedelta
from airflow import DAG
from airflow.decorators import task
from airflow.sensors.external_task import ExternalTaskSensor

with DAG(
    dag_id="${token}",
    start_date=datetime(2026, 1, 1),
    schedule="15 2 * * *",
    catchup=False,
    max_active_runs=1,
    default_args={"retries": 2, "retry_delay": timedelta(minutes=10)},
) as dag:
    wait_partition = ExternalTaskSensor(
        task_id="wait_partition_ready",
        external_dag_id="upstream_order_daily",
        external_task_id="partition_ready",
        mode="reschedule",
        timeout=60 * 60 * 3,
    )

    @task
    def build_partition(ds: str):
        # 主题：${topic}
        # 按 ds 分区覆盖或 merge；禁止因为重跑产生重复数据。
        return {"partition": ds, "write_mode": "idempotent-merge"}

    @task
    def reconcile(payload: dict):
        assert payload["partition"], "empty partition"
        return {**payload, "quality_gate": "passed"}

    wait_partition >> reconcile(build_partition())`;
}

function buildSqlCode(topic) {
  return `-- ${topic}
-- 识别连续活跃区间，并避免同一用户同一天多次事件造成重复计数。
WITH daily_user AS (
  SELECT DISTINCT user_id, CAST(event_time AS DATE) AS active_date
  FROM fact_user_event
  WHERE event_time >= TIMESTAMP '2026-01-01 00:00:00'
    AND event_time <  TIMESTAMP '2026-12-01 00:00:00'
    AND is_deleted = 0
),
marked AS (
  SELECT
    user_id,
    active_date,
    DATEADD(DAY, -ROW_NUMBER() OVER (
      PARTITION BY user_id ORDER BY active_date
    ), active_date) AS island_key
  FROM daily_user
),
streak AS (
  SELECT
    user_id,
    island_key,
    MIN(active_date) AS start_date,
    MAX(active_date) AS end_date,
    COUNT(*) AS active_days,
    ROW_NUMBER() OVER (
      PARTITION BY user_id ORDER BY COUNT(*) DESC, MAX(active_date) DESC
    ) AS rn
  FROM marked
  GROUP BY user_id, island_key
)
SELECT * FROM streak WHERE rn = 1;

-- 验证：同日重复、跨月连续、断一天、空用户、时区和未来时间。`;
}

function buildQualityCode(topic, token) {
  return `checks = [
    {
        "rule_id": "${token}_row_count",
        "severity": "blocker",
        "sql": "SELECT COUNT(*) FROM {table} WHERE dt = '{ds}'",
        "expect": lambda value: value > 0,
    },
    {
        "rule_id": "${token}_amount_balance",
        "severity": "blocker",
        "sql": "SELECT ABS(SUM(pay_amount) - SUM(refund_amount + net_amount)) FROM {table} WHERE dt = '{ds}'",
        "expect": lambda value: value <= 0.01,
    },
]

def publish_gate(results: list[dict]) -> None:
    blockers = [
        item for item in results
        if item["severity"] == "blocker" and not item["passed"]
    ]
    if blockers:
        raise RuntimeError(f"${topic} blocked by: {blockers}")

# 每条规则绑定资产、负责人、严重等级、失败动作和复核时限。
# 异常时保留样本和上下文，区分上游延迟、业务变化和规则误报。`;
}

function buildLineageCode(topic) {
  return `from collections import defaultdict, deque

edges = [
    ("ods.orders", "dwd.order_detail"),
    ("ods.payments", "dwd.order_detail"),
    ("dwd.order_detail", "dws.merchant_sales"),
    ("dws.merchant_sales", "ads.merchant_dashboard"),
]

def downstream_impact(changed_asset: str) -> list[str]:
    graph = defaultdict(list)
    for upstream, downstream in edges:
        graph[upstream].append(downstream)
    visited = set()
    queue = deque([changed_asset])
    while queue:
        for child in graph.get(queue.popleft(), []):
            if child not in visited:
                visited.add(child)
                queue.append(child)
    return sorted(visited)

impact = downstream_impact("ods.orders")
assert "ads.merchant_dashboard" in impact

# 主题：${topic}
# 生产版合并字段级 SQL 解析、运行日志、指标血缘和人工登记；
# 动态 SQL、UDF、临时表等低置信度边单独标记，不能静默忽略。`;
}

function buildSecurityCode(topic) {
  return `from dataclasses import dataclass

@dataclass(frozen=True)
class AccessRequest:
    role: str
    purpose: str
    columns: set[str]

POLICY = {
    "research": {
        "allowed_columns": {"patient_id_hash", "age_band", "diagnosis_code"},
        "forbidden_purposes": {"marketing"},
    }
}

def authorize(request: AccessRequest) -> tuple[bool, str]:
    policy = POLICY.get(request.role)
    if not policy:
        return False, "role_not_approved"
    if request.purpose in policy["forbidden_purposes"]:
        return False, "purpose_not_allowed"
    if not request.columns <= policy["allowed_columns"]:
        return False, "sensitive_column_requested"
    return True, "approved_with_mask_and_audit"

print(authorize(AccessRequest("research", "treatment_effect_study", {"age_band"})))

# 主题：${topic}
# 服务端记录身份、用途、对象、字段、动作和结果；超期、离职与转岗权限自动回收。`;
}

function buildMasterCode(topic) {
  return `-- ${topic}
-- 主数据候选匹配：确定性规则优先，模糊结果进入人工复核。
WITH normalized AS (
  SELECT
    source_system,
    source_id,
    REGEXP_REPLACE(LOWER(TRIM(entity_name)), '\\\\s+', '') AS normalized_name,
    COALESCE(unified_social_credit_code, business_license_no) AS strong_key
  FROM ods_master_entity
  WHERE dt = DATE '2026-11-05'
)
SELECT
  a.source_system AS left_source,
  a.source_id AS left_id,
  b.source_system AS right_source,
  b.source_id AS right_id,
  CASE WHEN a.strong_key IS NOT NULL THEN 'strong_key' ELSE 'name_review' END AS match_type,
  CASE WHEN a.strong_key IS NOT NULL THEN 1.0 ELSE 0.8 END AS confidence
FROM normalized a
JOIN normalized b
  ON (
    a.strong_key = b.strong_key
    OR (a.strong_key IS NULL AND b.strong_key IS NULL AND a.normalized_name = b.normalized_name)
  )
 AND (a.source_system <> b.source_system OR a.source_id < b.source_id);

-- 合并前评估重复率、误合并率、覆盖率、有效期和历史关系；保留来源、规则版本与人工复核。`;
}

function buildServiceCode(topic) {
  return `from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI()

class MetricQuery(BaseModel):
    metric: str = Field(pattern="^(gmv|paid_orders|refund_rate)$")
    date_from: str
    date_to: str
    merchant_id: str
    page_size: int = Field(default=100, le=500)

def current_user() -> dict:
    return {"tenant_id": "demo", "scopes": {"metric:read"}, "merchant_scope": {"M1001"}}

@app.post("/v1/metrics/query")
def query_metric(body: MetricQuery, user: dict = Depends(current_user)):
    if "metric:read" not in user["scopes"]:
        raise HTTPException(status_code=403, detail="scope_missing")
    if body.merchant_id not in user["merchant_scope"]:
        raise HTTPException(status_code=403, detail="row_scope_denied")
    return {
        "topic": ${JSON.stringify(topic)},
        "data_version": "2026-11-05T02:15:00+08:00",
        "p95_budget_ms": 800,
    }

# 版本、字段、错误码、权限、数据新鲜度、超时、扫描上限和分页都属于接口契约；
# Text-to-SQL 与 Agent-to-Data 必须经过同一权限、成本和审计链路。`;
}

function buildPerformanceCode(topic) {
  return `-- ${topic}
EXPLAIN ANALYZE
SELECT
  o.merchant_id,
  DATE(o.paid_at) AS stat_date,
  COUNT(DISTINCT o.order_id) AS order_cnt,
  SUM(o.pay_amount) AS gmv
FROM fact_order o
LEFT JOIN dim_merchant m ON o.merchant_id = m.merchant_id
WHERE o.dt >= DATE '2026-10-01'
  AND o.dt <  DATE '2026-11-01'
  AND o.pay_status = 'PAID'
GROUP BY o.merchant_id, DATE(o.paid_at);

-- 基线记录：扫描字节、分区命中、Join 行数、Shuffle、峰值内存、P95、结果校验和。
-- 只有扫描量下降且结果一致后，才继续调整文件大小、并发或资源规格。`;
}

function buildRagCode(topic) {
  return `from dataclasses import dataclass

@dataclass
class SearchHit:
    chunk_id: str
    document_id: str
    version: str
    lexical_score: float
    vector_score: float
    acl_group: str

def hybrid_search(hits: list[SearchHit], user_groups: set[str], k: int = 5):
    allowed = [hit for hit in hits if hit.acl_group in user_groups | {"public"}]
    reranked = sorted(
        allowed,
        key=lambda hit: 0.45 * hit.lexical_score + 0.55 * hit.vector_score,
        reverse=True,
    )
    deduped, seen = [], set()
    for hit in reranked:
        if hit.document_id not in seen:
            seen.add(hit.document_id)
            deduped.append(hit)
    return deduped[:k]

# 主题：${topic}
# 分别评估解析、Hit@K、引用支持、回答完整、权限过滤、P95 和单次成本。
# 失败样本必须能回到切片、文档版本、召回片段和最终引用。`;
}

function buildAgentCode(topic) {
  return `from dataclasses import dataclass

@dataclass(frozen=True)
class Tool:
    name: str
    read_only: bool
    allowed_roles: set[str]

TOOLS = {
    "search_logs": Tool("search_logs", True, {"operator", "analyst"}),
    "restart_service": Tool("restart_service", False, {"operator"}),
}

def execute_tool(name: str, arguments: dict, actor: dict, approved: bool = False) -> dict:
    tool = TOOLS.get(name)
    if not tool:
        raise PermissionError("tool_not_in_allowlist")
    if actor["role"] not in tool.allowed_roles:
        raise PermissionError("role_not_allowed")
    if not tool.read_only and not approved:
        raise PermissionError("human_approval_required")
    return {"tool": name, "arguments": arguments, "audit": "recorded"}

# 主题：${topic}
# 记录计划、工具参数、结果、错误、模型版本、步数和人工操作；
# 设置最大步数、超时、预算、失败退出与转人工，模型不能自行扩大权限。`;
}

function buildLlmCode(topic) {
  return `from dataclasses import dataclass
from statistics import mean

@dataclass
class EvalCase:
    case_id: str
    expected: str
    risk: str

def score_case(case: EvalCase, output: str, cited: bool, refused: bool) -> dict:
    checks = {
        "contains_expected": case.expected in output,
        "citation_supported": cited,
        "safe_refusal": refused if case.risk == "high" else True,
    }
    return {"case_id": case.case_id, "score": mean(checks.values()), "checks": checks}

eval_cases = [
    EvalCase("e1", "标准答案", "low"),
    EvalCase("e2", "需要澄清", "medium"),
    EvalCase("e3", "应转人工", "high"),
]

# 主题：${topic}
# 覆盖常规、长尾、边界、对抗和拒答；模型、Prompt、知识库、工具和参数全部版本化。
# 线下平均分提升不足以发布，还要看任务完成、人工采纳、P95、单位成本和风险事件。`;
}

function buildMlCode(topic) {
  return `import pandas as pd
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import roc_auc_score
from sklearn.ensemble import HistGradientBoostingClassifier

def evaluate_time_aware(frame: pd.DataFrame, features: list[str], target: str) -> list[dict]:
    frame = frame.sort_values("event_date").reset_index(drop=True)
    scores = []
    for train_idx, test_idx in TimeSeriesSplit(n_splits=5, gap=7).split(frame):
        train, test = frame.iloc[train_idx], frame.iloc[test_idx]
        if train[target].nunique() < 2 or test[target].nunique() < 2:
            continue
        model = HistGradientBoostingClassifier(max_depth=4)
        model.fit(train[features], train[target])
        proba = model.predict_proba(test[features])[:, 1]
        scores.append({"model_auc": roc_auc_score(test[target], proba)})
    return scores

# 主题：${topic}
# 检查标签成熟时间、未来信息、同实体泄漏、训练服务一致性、误报成本和漂移。`;
}

function buildAnalyticsCode(topic) {
  return `-- ${topic}
WITH assigned AS (
  SELECT
    user_id,
    group_name,
    DATEDIFF(DAY, exposure_time, COALESCE(first_paid_at, CURRENT_TIMESTAMP)) AS pay_delay_days,
    paid_amount,
    refund_amount,
    support_ticket_cnt
  FROM experiment_user_day
  WHERE experiment_id = 'exp_202611'
),
summary AS (
  SELECT
    group_name,
    COUNT(DISTINCT user_id) AS user_cnt,
    AVG(CASE WHEN pay_delay_days <= 7 AND paid_amount > 0 THEN 1 ELSE 0 END) AS conversion_rate,
    SUM(paid_amount - refund_amount) / COUNT(DISTINCT user_id) AS net_revenue_per_user,
    SUM(support_ticket_cnt) * 1.0 / COUNT(DISTINCT user_id) AS ticket_per_user
  FROM assigned
  GROUP BY group_name
)
SELECT *, conversion_rate - MAX(CASE WHEN group_name = 'control' THEN conversion_rate END) OVER () AS uplift
FROM summary;

-- 同步检查分流一致性、样本比例、长期留存、退款、投诉、成本和停止条件。`;
}

function buildAiGovernanceCode(topic) {
  return `from dataclasses import dataclass
from datetime import date

@dataclass
class DatasetCard:
    dataset_id: str
    version: str
    source: str
    purpose: str
    license_basis: str
    contains_personal_data: bool
    deidentification: str
    population_gaps: list[str]
    owner: str

card = DatasetCard(
    dataset_id="support-conversations",
    version="2026.10",
    source="authorized_customer_service_export",
    purpose="intent_classification",
    license_basis="customer_consent_v3",
    contains_personal_data=True,
    deidentification="name_phone_address_masked; free_text_redaction_v2",
    population_gaps=["low_resource_dialect", "elderly_users"],
    owner="ai-data-owner",
)
assert all([card.source, card.purpose, card.license_basis, card.owner])

# 主题：${topic}
# 发布前检查分群偏差、标注一致性、去重、训练评测污染、用途限制、删除请求传播和人工复核。`;
}

function buildCareerCode(topic) {
  return `from dataclasses import dataclass, field

@dataclass
class Evidence:
    capability: str
    artifact: str
    verified_by: str
    result: str
    limitation: str

@dataclass
class CapabilityPlan:
    target_role: str
    topic: str = ${JSON.stringify(topic)}
    evidence: list[Evidence] = field(default_factory=list)

    def gaps(self) -> list[str]:
        required = {"SQL", "数据质量", "工程交付", "业务表达"}
        return sorted(required - {item.capability for item in self.evidence})

plan = CapabilityPlan(
    target_role="数据开发工程师",
    evidence=[
        Evidence("SQL", "可复跑窗口函数项目", "逐行口头解释", "结果与样例对账", "仅一个业务域"),
        Evidence("数据质量", "质量规则与失败样本", "同伴代码评审", "发现重复与缺失", "样本规模有限"),
    ],
)
print({"gaps": plan.gaps(), "claim_policy": "只有证据才写成熟练"})

# 能力必须对应可复现作品或真实项目记录；用反馈、故障修复、迁移练习和他人复跑检验掌握程度。`;
}

function buildDataDevelopmentCode(topic, token, profile) {
  const checks = profile?.guide?.checks?.slice(0, 3) || [
    "输入输出分区完整",
    "业务主键无重复",
    "金额或数量平衡"
  ];
  return `from dataclasses import dataclass
from datetime import datetime

TOPIC = ${topic}
TASK_ID = "${token}"
PARTITION_KEY = "business_date"
GATE_RULES = ${JSON.stringify(checks, null, 4)}

@dataclass(frozen=True)
class PartitionResult:
    partition: str
    input_rows: int
    output_rows: int
    duplicate_keys: int
    rejected_rows: int
    checksum: str

def publish_idempotent(spark, source_table: str, target_table: str, ds: str) -> PartitionResult:
    source = spark.read.table(source_table).where(f"{PARTITION_KEY} = '{ds}'")
    source.createOrReplaceTempView("staged_source")
    deduped = spark.sql("""
        SELECT *
        FROM (
          SELECT *,
                 ROW_NUMBER() OVER (
                   PARTITION BY business_key
                   ORDER BY updated_at DESC
                 ) AS version_no
          FROM staged_source
        )
        WHERE version_no = 1
    """)
    duplicate_keys = spark.sql("""
        SELECT COUNT(*) AS duplicate_keys
        FROM (
          SELECT business_key
          FROM staged_source
          GROUP BY business_key
          HAVING COUNT(*) > 1
        )
    """).first()["duplicate_keys"]
    assert duplicate_keys == 0, f"{TASK_ID}/{ds}: duplicate business keys must be quarantined"

    # 重跑同一分区先覆盖该分区，再原子切换；若平台不支持事务，使用影子分区和版本指针。
    deduped.write.mode("overwrite").insertInto(target_table)
    checksum = str(deduped.selectExpr("count(*) AS row_cnt").first()["row_cnt"])
    return PartitionResult(ds, source.count(), deduped.count(), duplicate_keys, 0, checksum)

# 主题：${topic}
# 上线证据：分区覆盖、主键唯一、数量/金额对账、执行版本、输入输出计数和回滚记录必须同批保存。
# 发布门禁：${checks.join("；")}。`;
}

function buildDataArchitectureCode(topic, token, profile) {
  const checks = profile?.guide?.checks?.slice(0, 3) || [
    "业务能力与数据流可追溯",
    "非功能指标有基线",
    "迁移支持双跑与回滚"
  ];
  return `from dataclasses import dataclass, field
from statistics import mean

TOPIC = ${topic}
DECISION_ID = "${token}"

@dataclass
class ArchitectureOption:
    name: str
    latency_ms: float
    availability: float
    monthly_cost: float
    migration_weeks: float
    operational_risk: float
    evidence: list[str] = field(default_factory=list)

def normalized_score(option: ArchitectureOption) -> dict:
    # 示例权重来自业务约束，生产评审应由业务、平台、安全与运维共同确认。
    values = {
        "latency": max(0.0, 1 - option.latency_ms / 5000),
        "availability": option.availability,
        "cost": max(0.0, 1 - option.monthly_cost / 300000),
        "delivery": max(0.0, 1 - option.migration_weeks / 52),
        "risk": max(0.0, 1 - option.operational_risk),
    }
    weights = {"latency": 0.24, "availability": 0.22, "cost": 0.18, "delivery": 0.16, "risk": 0.20}
    return {
        "option": option.name,
        "score": round(sum(values[key] * weights[key] for key in weights), 4),
        "evidence_complete": len(option.evidence) >= 3,
        **values,
    }

decision_checks = ${JSON.stringify(checks, null, 4)}
assert all(decision_checks), "architecture decision cannot pass without explicit constraints"

# 主题：${topic}
# 评审留档：业务能力、数据流、SLO、容量、权限、成本、故障演练、被否决方案、假设和复审日期。
# 迁移阶段必须提供双跑对账、差异解释、灰度比例和回滚证据。`;
}

function buildDataTeamCode(topic, token) {
  return `from dataclasses import dataclass

TOPIC = ${topic}
TEAM_MODEL_ID = "${token}"

@dataclass(frozen=True)
class Responsibility:
    asset: str
    accountable: str
    developer: str
    reviewer: str
    operator: str
    escalation_minutes: int

team = [
    Responsibility("订单事实表", "业务域负责人", "数据开发", "数仓架构师", "值班工程师", 15),
    Responsibility("经营指标", "业务负责人", "指标开发", "数据分析负责人", "平台值班", 10),
    Responsibility("主数据映射", "数据治理负责人", "数据工程师", "业务数据专员", "治理运营", 30),
]

def validate_raci(items: list[Responsibility]) -> list[str]:
    errors = []
    for item in items:
        if not all([item.accountable, item.developer, item.reviewer, item.operator]):
            errors.append(f"{item.asset}: incomplete owner chain")
        if item.escalation_minutes <= 0:
            errors.append(f"{item.asset}: escalation SLA is required")
    return errors

assert not validate_raci(team), "every critical asset needs an end-to-end owner"

# 主题：${topic}
# 组织指标同时观察交付周期、返工、复用、故障恢复、值班负荷和业务采用，不能只统计工时或培训次数。
# 每季度复核边界：谁定义、谁开发、谁审批、谁值班、谁有权停止发布。`;
}

function buildTechnologyStrategyCode(topic, token) {
  return `from dataclasses import dataclass, field

TOPIC = ${topic}
EVALUATION_ID = "${token}"

@dataclass
class Candidate:
    name: str
    problem_fit: float
    production_perf: float
    tco_score: float
    migration_score: float
    exit_score: float
    evidence: list[str] = field(default_factory=list)

def weighted_decision(candidate: Candidate) -> dict:
    weights = {
        "problem_fit": 0.24,
        "production_perf": 0.22,
        "tco": 0.20,
        "migration": 0.16,
        "exit": 0.18,
    }
    scores = {
        "problem_fit": candidate.problem_fit,
        "production_perf": candidate.production_perf,
        "tco": candidate.tco_score,
        "migration": candidate.migration_score,
        "exit": candidate.exit_score,
    }
    total = sum(scores[key] * weights[key] for key in weights)
    return {
        "candidate": candidate.name,
        "score": round(total, 4),
        "evidence_count": len(candidate.evidence),
        "decision": "poc" if len(candidate.evidence) < 3 else "review",
    }

POLICY = {
    "topic": TOPIC,
    "evaluation_id": EVALUATION_ID,
    "required_evidence": ["真实任务回放", "并发与故障测试", "三年TCO", "迁移评估", "退出方案"],
    "forbidden_shortcut": ["只看厂商演示", "只比较单条查询", "忽略版本生命周期"],
}
print(POLICY)

# 决策记录必须包含被否决方案、权重来源、假设、风险负责人、复审日期与退出触发条件。`;
}

function buildProjectDeliveryCode(topic, token, profile) {
  const checks = profile?.guide?.checks?.slice(0, 3) || [
    "范围与成功标准已确认",
    "上线门禁全部关闭",
    "采用与收益有观察周期"
  ];
  return `from dataclasses import dataclass
from datetime import date

TOPIC = ${topic}
PROJECT_ID = "${token}"

@dataclass
class Milestone:
    name: str
    owner: str
    due: date
    evidence: str
    gate_passed: bool = False

milestones = [
    Milestone("问题与范围", "业务负责人", date(2026, 11, 8), "决策记录与基线"),
    Milestone("数据与权限", "数据负责人", date(2026, 11, 15), "接口、契约和授权矩阵"),
    Milestone("质量与灰度", "开发负责人", date(2026, 11, 22), "对账、回滚与演练"),
    Milestone("采用与复盘", "产品负责人", date(2026, 12, 6), "使用日志、主指标与护栏"),
]

required_checks = ${JSON.stringify(checks, null, 4)}

def release_gate(items: list[Milestone], checks: list[str]) -> dict:
    blockers = [item.name for item in items if not item.gate_passed]
    return {
        "project_id": PROJECT_ID,
        "topic": TOPIC,
        "blocked_by": blockers,
        "checks": checks,
        "release_allowed": not blockers and len(checks) >= 3,
    }

print(release_gate(milestones, required_checks))

# 项目管理以可验收能力为单位，不以代码提交、文档页数或看板数量代替结果。
# 变更必须同步评估范围、口径、权限、依赖、上线窗口和回滚成本。`;
}

function buildDataGovernanceCode(topic, token, profile) {
  const checks = profile?.guide?.checks?.slice(0, 4) || [
    "关键资产有唯一负责人",
    "规则失败有处理动作",
    "变更支持影响分析",
    "治理结果进入绩效考核"
  ];
  return `from dataclasses import dataclass

TOPIC = ${topic}
POLICY_ID = "${token}"

@dataclass(frozen=True)
class DataAsset:
    name: str
    criticality: str
    owner: str
    steward: str
    consumers: tuple[str, ...]
    controls: tuple[str, ...]
    last_reviewed: str

asset = DataAsset(
    name="enterprise_metric_snapshot",
    criticality="high",
    owner="business-domain-owner",
    steward="data-governance-steward",
    consumers=("management-reporting", "risk-monitor"),
    controls=("definition-version", "quality-gate", "lineage", "access-review"),
    last_reviewed="2026-11-06",
)

governance_checks = ${JSON.stringify(checks, null, 4)}

def validate_asset(item: DataAsset, checks: list[str]) -> list[str]:
    failures = []
    if not item.owner or not item.steward:
        failures.append("owner_chain_incomplete")
    if item.criticality not in {"critical", "high", "medium", "low"}:
        failures.append("risk_level_invalid")
    if not item.consumers:
        failures.append("consumer_list_missing")
    if len(item.controls) < len(checks):
        failures.append("controls_do_not_cover_checks")
    return failures

print({"policy": POLICY_ID, "failures": validate_asset(asset, governance_checks)})

# 规则必须绑定严重等级、阈值依据、责任人和豁免期限；问题关闭前保留样本、影响范围和复核证据。`;
}

function buildAiFoundationCode(topic, token) {
  return `import pandas as pd
from sklearn.metrics import roc_auc_score, f1_score
from sklearn.model_selection import TimeSeriesSplit

TOPIC = ${topic}
EXPERIMENT_ID = "${token}"

def evaluate_time_ordered(
    frame: pd.DataFrame,
    features: list[str],
    target: str,
    train_model,
    prediction_to_label,
) -> list[dict]:
    ordered = frame.sort_values(["event_date", "entity_id"]).reset_index(drop=True)
    results = []
    for fold, (train_idx, test_idx) in enumerate(TimeSeriesSplit(n_splits=4, gap=7).split(ordered), 1):
        train = ordered.iloc[train_idx]
        test = ordered.iloc[test_idx]
        if train[target].nunique() < 2 or test[target].nunique() < 2:
            continue
        model = train_model()
        model.fit(train[features], train[target])
        score = model.predict_proba(test[features])[:, 1]
        label = prediction_to_label(score)
        results.append({
            "experiment_id": EXPERIMENT_ID,
            "topic": TOPIC,
            "fold": fold,
            "train_end": str(train["event_date"].max().date()),
            "test_start": str(test["event_date"].min().date()),
            "auc": round(roc_auc_score(test[target], score), 4),
            "f1_at_threshold": round(f1_score(test[target], label), 4),
        })
    return results

# 数据卡记录来源、用途、授权、时间范围、人群缺口和脱敏；评估区分时间外测试、实体隔离和线上灰度。
# 发布前同时检查误报成本、延迟、漂移、人工接管、模型版本和回滚路径。`;
}

const BUILDERS = {
  kafka: buildKafkaCode,
  "spark-shuffle": buildSparkCode,
  streaming: buildStreamingCode,
  cdc: buildCdcCode,
  warehouse: buildWarehouseCode,
  scheduling: buildSchedulingCode,
  sql: buildSqlCode,
  "data-quality": buildQualityCode,
  lineage: buildLineageCode,
  "security-governance": buildSecurityCode,
  "master-standard": buildMasterCode,
  "data-service": buildServiceCode,
  performance: buildPerformanceCode,
  rag: buildRagCode,
  agent: buildAgentCode,
  llm: buildLlmCode,
  ml: buildMlCode,
  analytics: buildAnalyticsCode,
  "ai-governance": buildAiGovernanceCode,
  career: buildCareerCode,
  learning: buildCareerCode,
  "data-development": buildDataDevelopmentCode,
  "data-architecture": buildDataArchitectureCode,
  "data-team": buildDataTeamCode,
  "technology-strategy": buildTechnologyStrategyCode,
  "project-delivery": buildProjectDeliveryCode,
  "data-governance": buildDataGovernanceCode,
  "ai-foundation": buildAiFoundationCode
};

function buildTopicCode(profile) {
  const guide = profile.guide;
  if (!guide) return null;
  const topic = JSON.stringify(profile.topic);
  const token = `g_${guide.key.replaceAll("-", "_")}_${profile.idSuffix}`;
  const builder = BUILDERS[guide.key];
  return builder ? builder(topic, token, profile) : null;
}

module.exports = { buildTopicCode };
