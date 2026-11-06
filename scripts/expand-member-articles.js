const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const ARTICLES = path.join(ROOT, "content", "articles");
const CACHE_FILE = path.join(ROOT, "content", "cache.json");
const REPORT_FILE = path.join(ROOT, "content", "expanded-member-titles.json");
const PAYWALL_MARKER = '<div class="lab-paywall"';

const DOMAIN_CONTEXT = {
  医疗健康: {
    scene: "门诊、住院、检查、用药、随访和支付结算",
    entities: "患者、就诊记录、医嘱、检查检验、药品和医疗费用",
    factTable: "fact_medical_visit",
    dimTable: "dim_patient",
    timeField: "visit_date",
    dims: ["院区", "科室", "病种", "人群", "支付方式"],
    metrics: ["就诊人次", "复诊率", "人均费用", "异常检验占比", "按时随访率"],
    checks: ["患者标识脱敏", "就诊时间完整", "诊断编码有效", "费用与明细可核对"],
    risk: "医疗数据的隐私保护、临床口径确认和合规使用"
  },
  零售电商: {
    scene: "商品曝光、用户访问、下单支付、履约和售后",
    entities: "用户、商品、订单、支付、退款和渠道",
    factTable: "fact_order",
    dimTable: "dim_user",
    timeField: "order_date",
    dims: ["渠道", "品类", "地区", "用户层级", "活动"],
    metrics: ["支付转化率", "客单价", "复购率", "退款率", "毛利额"],
    checks: ["订单号唯一", "金额关系平衡", "退款不重复计数", "渠道归因唯一"],
    risk: "重复订单、跨渠道归因和退款口径不一致"
  },
  制造业: {
    scene: "生产计划、工单执行、设备运行、质量检验、库存和交付",
    entities: "工厂、产线、设备、工单、物料、批次和质检记录",
    factTable: "fact_production_order",
    dimTable: "dim_equipment",
    timeField: "production_date",
    dims: ["工厂", "产线", "产品", "班组", "设备类型"],
    metrics: ["良品率", "设备稼动率", "计划达成率", "单位成本", "库存周转率"],
    checks: ["设备编码映射一致", "工单状态完整", "质检结果可追溯", "时间区间不重叠"],
    risk: "设备编码变化、批次追溯断链和停机时长重复计算"
  },
  金融行业: {
    scene: "客户开户、交易、授信、风险监测、服务与合规审计",
    entities: "客户、账户、交易、产品、申请和风险事件",
    factTable: "fact_transaction",
    dimTable: "dim_customer",
    timeField: "transaction_date",
    dims: ["机构", "产品", "渠道", "客户等级", "风险等级"],
    metrics: ["活跃客户数", "资产规模", "交易金额", "逾期率", "风险拦截率"],
    checks: ["客户号脱敏", "金额借贷平衡", "交易时间有序", "风险标签可追溯"],
    risk: "数据敏感、时点快照与流水混用以及监管口径偏差"
  },
  教育培训: {
    scene: "招生线索、课程报名、学习进度、考试、续费和就业服务",
    entities: "学员、线索、课程、班级、学习行为和订单",
    factTable: "fact_learning_event",
    dimTable: "dim_student",
    timeField: "event_date",
    dims: ["渠道", "课程", "班级", "地区", "学员阶段"],
    metrics: ["线索转化率", "到课率", "完课率", "考试通过率", "续费率"],
    checks: ["一人多号已合并", "试听与正式课区分", "退费状态完整", "学习时长异常已处理"],
    risk: "试听数据混入正式转化、刷课时长和退费口径不一致"
  },
  交通物流: {
    scene: "下单、揽收、干线运输、分拨、末端配送和签收",
    entities: "运单、包裹、车辆、司机、线路、仓库和客户",
    factTable: "fact_shipment_event",
    dimTable: "dim_route",
    timeField: "event_time",
    dims: ["线路", "仓库", "承运商", "时效类型", "地区"],
    metrics: ["准时率", "破损率", "遗失率", "单票成本", "签收时长"],
    checks: ["运单轨迹有序", "重复扫描去重", "节点时间完整", "异常件状态闭环"],
    risk: "轨迹重复扫描、异常件状态回退和跨时区时间处理"
  },
  房地产: {
    scene: "线索获取、带看、认购、签约、回款和项目交付",
    entities: "项目、楼栋、房源、客户、经纪人、带看和合同",
    factTable: "fact_property_funnel",
    dimTable: "dim_project",
    timeField: "event_date",
    dims: ["城市", "项目", "户型", "渠道", "客户来源"],
    metrics: ["来访转化率", "认购率", "签约率", "回款率", "去化周期"],
    checks: ["房源状态唯一", "客户归属可追溯", "退订已冲减", "合同金额与回款匹配"],
    risk: "客户重复归属、退订未冲减和项目阶段口径混用"
  },
  能源电力: {
    scene: "发电、输配电、用电计量、负荷预测、检修和告警",
    entities: "场站、设备、表计、用户、区域、时段和事件",
    factTable: "fact_energy_meter",
    dimTable: "dim_meter",
    timeField: "reading_time",
    dims: ["区域", "场站", "设备类型", "用户类型", "时段"],
    metrics: ["负荷率", "用电量", "线损率", "可用率", "告警闭环时长"],
    checks: ["表计读数单调", "时区与采集频率一致", "缺失点已标记", "设备关系有效期正确"],
    risk: "采集频率不一致、表计换表和时区导致的重复计量"
  },
  农业: {
    scene: "地块管理、播种、施肥、采收、产量、成本和溯源",
    entities: "地块、作物、批次、农事任务、投入品和收购记录",
    factTable: "fact_farm_operation",
    dimTable: "dim_plot",
    timeField: "operation_date",
    dims: ["区域", "地块", "作物", "批次", "农事类型"],
    metrics: ["亩产量", "投入成本", "损耗率", "合格率", "批次追溯完整率"],
    checks: ["地块边界唯一", "批次关联完整", "气象日期对齐", "投入品单位统一"],
    risk: "批次追溯断链、单位换算错误和气象数据时空对齐偏差"
  },
  互联网商业分析: {
    scene: "流量获取、内容消费、用户增长、商业转化和留存",
    entities: "用户、会话、页面、内容、广告、订单和会员",
    factTable: "fact_user_event",
    dimTable: "dim_user",
    timeField: "event_time",
    dims: ["渠道", "页面", "内容类型", "用户阶段", "设备"],
    metrics: ["点击率", "转化率", "留存率", "ARPU", "获客成本"],
    checks: ["事件去重", "匿名与登录身份打通", "时区一致", "埋点版本可追溯"],
    risk: "埋点重复、匿名身份合并错误和自然流量归因偏差"
  },
  互联网科技: {
    scene: "产品使用、账号行为、订阅、服务稳定性和客户支持",
    entities: "账号、设备、功能、会话、订阅和工单",
    factTable: "fact_product_event",
    dimTable: "dim_account",
    timeField: "event_time",
    dims: ["产品", "功能", "版本", "地区", "客户层级"],
    metrics: ["活跃率", "功能渗透率", "续费率", "故障影响面", "工单解决时长"],
    checks: ["账号设备映射有效", "版本字段完整", "异常流量剔除", "工单状态闭环"],
    risk: "机器流量误计、版本并行和订阅时点口径混淆"
  }
};

const GENERAL_CONTEXT = {
  scene: "需求澄清、数据采集、指标计算、结果解释和持续运营",
  entities: "业务对象、行为记录、状态变化、组织维度和时间",
  factTable: "fact_business_event",
  dimTable: "dim_business_entity",
  timeField: "event_date",
  dims: ["时间", "业务类型", "地区", "对象层级", "来源渠道"],
  metrics: ["规模", "转化率", "增长率", "质量率", "处理时长"],
  checks: ["主键唯一", "时间完整", "枚举值受控", "金额与数量关系合理"],
  risk: "口径未冻结、主数据不一致和异常值未处理"
};

const TOP_LEVEL_CONTEXT = {
  "【AI 与大数据】": {
    scene: "训练数据准备、模型实验、RAG 检索、Agent 编排、离线评估和线上监控",
    entities: "数据集、样本、特征、模型、提示词、检索片段、工具调用和应用请求",
    factTable: "fact_ai_request",
    dimTable: "dim_model_version",
    timeField: "request_time",
    dims: ["业务场景", "模型版本", "租户", "数据来源", "调用类型"],
    metrics: ["任务成功率", "答案采纳率", "检索命中率", "P95 延迟", "单次调用成本"],
    checks: ["训练与评估数据隔离", "版本号可追溯", "敏感字段已脱敏", "失败请求已分类"],
    risk: "训练与线上样本泄漏、模型版本不可追溯和评测指标与业务目标脱节"
  },
  "【数据分析与数据运营】": {
    scene: "用户行为分析、经营监控、活动复盘、用户分层、实验评估和策略迭代",
    entities: "用户、会话、商品或内容、活动、订单、触点和策略",
    factTable: "fact_user_event",
    dimTable: "dim_user",
    timeField: "event_time",
    dims: ["渠道", "用户分层", "活动", "产品", "地区"],
    metrics: ["转化率", "留存率", "客单价", "复购率", "活动增量"],
    checks: ["事件主键唯一", "匿名与登录身份已打通", "时区一致", "退款与撤销已冲减"],
    risk: "埋点重复、分母口径漂移和把相关性误写成因果"
  },
  "【数据开发与数据架构】": {
    scene: "数据接入、离线与实时处理、数仓建模、调度发布、数据服务和成本治理",
    entities: "数据源、表、分区、任务、依赖、指标、服务和资源队列",
    factTable: "fact_pipeline_run",
    dimTable: "dim_data_job",
    timeField: "run_time",
    dims: ["业务域", "数据层", "任务类型", "调度周期", "资源队列"],
    metrics: ["任务成功率", "数据延迟", "资源消耗", "重跑率", "数据服务可用率"],
    checks: ["分区覆盖完整", "任务幂等", "依赖无环", "结果可回溯"],
    risk: "重复写入、依赖环、热点倾斜和全量重算导致成本失控"
  },
  "【数据治理与数据管理】": {
    scene: "数据标准、元数据、主数据、质量规则、权限审计、血缘和问题闭环",
    entities: "数据资产、字段、指标、业务域、负责人、质量规则和访问申请",
    factTable: "fact_data_quality_result",
    dimTable: "dim_data_asset",
    timeField: "check_time",
    dims: ["业务域", "资产层级", "规则类型", "责任团队", "严重等级"],
    metrics: ["规则通过率", "问题闭环率", "资产完整率", "血缘覆盖率", "平均修复时长"],
    checks: ["资产责任唯一", "规则可执行", "问题分级明确", "变更留痕完整"],
    risk: "资产没有负责人、规则只告警不闭环和口径变更缺少影响分析"
  },
  "【项目实战库】": {
    scene: "项目立项、现状诊断、方案设计、开发联调、上线验收和运营复盘",
    entities: "需求、里程碑、数据表、接口、任务、风险、验收项和业务结果",
    factTable: "fact_project_delivery",
    dimTable: "dim_project",
    timeField: "event_date",
    dims: ["项目阶段", "业务域", "负责人", "优先级", "风险等级"],
    metrics: ["计划达成率", "缺陷关闭率", "上线成功率", "验收通过率", "投资回收周期"],
    checks: ["范围与验收标准明确", "上下游依赖确认", "回滚方案可执行", "数据结果可核对"],
    risk: "范围持续扩张、验收标准模糊和上线后无人跟踪业务效果"
  }
};

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function relativeArticlePath(filePath) {
  return path.relative(ARTICLES, filePath).split(path.sep).join("/");
}

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function hashNumber(value) {
  const digest = crypto.createHash("sha1").update(value).digest();
  return digest.readUInt32BE(0);
}

function pick(items, seed) {
  return items[seed % items.length];
}

function getContext(relativePath) {
  const parts = relativePath.split("/");
  const industry =
    parts[0] === "【各行业的基础知识】" && parts[1]
      ? parts[1].replace(/^\d+[-_、\s]+/, "")
      : null;
  const context = industry && DOMAIN_CONTEXT[industry]
    ? DOMAIN_CONTEXT[industry]
    : TOP_LEVEL_CONTEXT[parts[0]] || GENERAL_CONTEXT;
  return {
    ...context,
    industry: industry || null,
    topCategory: parts[0],
    section: parts[1] || ""
  };
}

function classify(relativePath, title) {
  if (relativePath.includes("简历模板")) return "resume";
  if (/题库|面试题|面试实战|面试官|求职/.test(relativePath) || /面试|题库/.test(title)) return "interview";
  if (/项目|实战|案例/.test(`${relativePath}${title}`)) return "project";
  if (/路线|学习|入门|指南|成长/.test(`${relativePath}${title}`)) return "learning";
  if (/术语|词典|概念|原理|基础/.test(`${relativePath}${title}`)) return "concept";
  if (/治理|标准|质量|安全|合规|权限|元数据|血缘/.test(`${relativePath}${title}`)) return "governance";
  if (/架构|平台|系统|引擎|性能|优化|湖仓|实时|数据仓库/.test(`${relativePath}${title}`)) return "architecture";
  return "practice";
}

function cleanTopic(title) {
  return title.replace(/^\d+(?:\.\d+)?[-_.、\s]+/, "").trim();
}

function esc(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function metricExamples(context, title) {
  const [primary, secondary, third] = context.metrics;
  return [
    `| 指标 | 建议定义 | 常用维度 | 用途 |`,
    `| --- | --- | --- | --- |`,
    `| ${esc(primary)} | 在明确统计周期和对象范围后，用不重复业务主键计数或汇总 | ${context.dims.slice(0, 3).join("、")} | 判断整体规模与趋势 |`,
    `| ${esc(secondary)} | 用同一粒度的分子除以可解释的分母，并排除测试与撤销记录 | ${context.dims.slice(1, 4).join("、")} | 判断流程效率或质量 |`,
    `| ${esc(third)} | 将“${cleanTopic(title)}”相关的状态变化落到事件或快照口径 | ${context.dims.slice(2, 5).join("、")} | 支撑专题分析和行动追踪 |`
  ].join("\n");
}

function buildBaseSections(relativePath, displayTitle, context, type, seed) {
  const topic = cleanTopic(displayTitle);
  const primaryMetric = context.metrics[seed % context.metrics.length];
  const secondaryMetric = context.metrics[(seed + 2) % context.metrics.length];
  const focus = pick(
    [
      "先确认问题，再确认口径，最后才写查询",
      "把过程指标与结果指标分开，避免用一个汇总数字解释全部现象",
      "任何结论都要能回到明细、时间窗和责任人",
      "先保证数据可用，再追求模型复杂和报表丰富"
    ],
    seed
  );
  return {
    topic,
    primaryMetric,
    secondaryMetric,
    focus,
    metricTable: metricExamples(context, displayTitle)
  };
}

function buildPracticeArticle(relativePath, displayTitle, context, type, seed) {
  const base = buildBaseSections(relativePath, displayTitle, context, type, seed);
  const { topic, primaryMetric, secondaryMetric, focus, metricTable } = base;
  const sourceColumns = [
    `${context.factTable}.id`,
    `${context.factTable}.${context.timeField}`,
    `${context.factTable}.entity_id`,
    `${context.factTable}.status`,
    `${context.factTable}.amount`,
    `${context.dimTable}.name`
  ];
  const sql = `WITH base AS (
  SELECT
    f.id,
    f.${context.timeField} AS event_date,
    f.entity_id,
    f.status,
    COALESCE(f.amount, 0) AS amount,
    d.name AS entity_name
  FROM ${context.factTable} f
  LEFT JOIN ${context.dimTable} d
    ON f.entity_id = d.id
  WHERE f.${context.timeField} >= DATE '2026-01-01'
    AND f.${context.timeField} <  DATE '2026-04-01'
    AND COALESCE(f.is_deleted, 0) = 0
)
SELECT
  DATE_TRUNC('month', event_date) AS month,
  COUNT(DISTINCT id) AS event_count,
  COUNT(DISTINCT entity_id) AS entity_count,
  ROUND(SUM(amount), 2) AS total_amount,
  ROUND(AVG(amount), 2) AS avg_amount
FROM base
GROUP BY 1
ORDER BY 1;`;

  return `# ${displayTitle}

> [!abstract] 快速理解
> “${topic}”不是一个孤立概念。放到${context.scene}的真实工作里，它最终要回答三个问题：谁受影响、变化发生在哪一步、团队下一步应该做什么。本文按可直接落地的数据项目展开，而不是停留在名词解释。

## 一、业务场景与问题定义

在${context.scene}中，${context.entities}会持续产生记录。围绕“${topic}”，建议先把一个模糊需求拆成可验证的问题：

- **对象**：分析哪类${context.entities.split("、")[0]}，是否排除测试、撤销和重复记录。
- **时间**：采用自然日、自然月还是滚动窗口，时区是否统一。
- **粒度**：一行代表一次事件、一天快照，还是一个业务对象。
- **动作**：结果提供给运营、产品、风控、供应链还是管理层，谁负责跟进。

一个可用的目标句式是：

> 在【时间范围】内，按【业务维度】比较【对象范围】的【${primaryMetric}】与【${secondaryMetric}】，定位变化最大的环节，并验证【行动方案】是否带来改善。

${focus}。这一步应在编码前完成，否则后续很容易出现“数字都能算出来，但没人知道该怎么用”的情况。

## 二、核心概念、指标与口径

“${topic}”在实际项目中通常同时涉及业务定义和数据定义。业务定义回答“这个现象是什么”，数据定义回答“如何从表中稳定得到它”。两者都写进指标字典，才能避免同名不同义。

| 口径项 | 本文建议 |
| --- | --- |
| 统计对象 | 去重后的有效${context.entities.split("、")[0]} |
| 默认时间 | 以 \`${context.timeField}\` 为准，并明确时区 |
| 成功状态 | 只统计已确认完成的状态，测试和撤销记录不计入 |
| 分子分母 | 分子与分母必须来自同一时间窗和同一对象范围 |
| 缺失值 | 区分“业务未发生”“系统未采集”和“采集失败” |

${metricTable}

建议为每个指标至少保留：名称、英文编码、一句话定义、计算公式、统计粒度、时间字段、排除条件、负责人、更新频率和验收样例。仅写一个公式截图，后续很难维护。

## 三、数据模型与关键字段

一个便于验证的最小模型可以包含事实表、维度表和时间字段。下面的表名是示例，落地时应映射到现有数仓分层。

| 层 | 示例对象 | 关键字段 | 作用 |
| --- | --- | --- | --- |
| ODS | \`ods_*_log\` | 业务主键、原始状态、事件时间、更新时间 | 保留原始记录，便于回溯 |
| DWD | \`${context.factTable}\` | ${sourceColumns.join("、")} | 统一粒度、清洗无效记录 |
| DIM | \`${context.dimTable}\` | 实体主键、名称、分类、生效时间 | 提供一致的分析维度 |
| ADS | \`ads_${relativePath.includes("项目") ? "project" : "topic"}_summary\` | 日期、维度、指标 | 面向报表和专题分析 |

建模时重点检查两件事。第一，事实表是否只有一个清晰粒度；如果订单、订单明细和退款记录混在同一张表，金额和数量会被重复累计。第二，维度表是否支持缓慢变化；组织、区域、设备和产品分类都会变化，历史报表应明确使用“当时归属”还是“当前归属”。

## 四、可执行的 SQL 分析模板

以下 SQL 使用通用语法，可直接改造成 Hive、Spark SQL、PostgreSQL、ClickHouse 或 Doris 版本。运行前先确认时间字段类型和分区字段，避免全表扫描。

\`\`\`sql
${sql}
\`\`\`

如果要定位变化发生在哪一步，不要只看总量，可以按同一粒度做环比和分层：

\`\`\`sql
WITH monthly AS (
  SELECT
    DATE_TRUNC('month', ${context.timeField}) AS month,
    entity_id,
    COUNT(DISTINCT id) AS event_count
  FROM ${context.factTable}
  WHERE ${context.timeField} >= DATE '2026-01-01'
    AND COALESCE(is_deleted, 0) = 0
  GROUP BY 1, 2
),
compared AS (
  SELECT
    month,
    event_count,
    LAG(event_count, 1) OVER (
      PARTITION BY entity_id ORDER BY month
    ) AS previous_count
  FROM monthly
)
SELECT
  month,
  entity_id,
  event_count,
  previous_count,
  ROUND(
    (event_count - previous_count) * 1.0
    / NULLIF(previous_count, 0),
    4
  ) AS month_over_month_rate
FROM compared
ORDER BY month, entity_id;
\`\`\`

## 五、真实落地步骤

1. **冻结问题与口径**：把需求写成一句可验证的话，确认对象、时间、维度和成功标准。
2. **检查数据可用性**：统计主键重复率、时间空值率、状态枚举、分区覆盖和上下游延迟。
3. **建立基线**：选择过去 8 至 12 周或同季节周期，避免只用异常周作比较。
4. **做分层诊断**：先看整体，再按${context.dims.join("、")}拆分，定位贡献最大的分组。
5. **回到明细验证**：抽取正向和反向样本，确认数字与业务事件一致。
6. **给出行动方案**：把结论写成“对象、动作、负责人、观察周期和停止条件”。
7. **建立监控**：为数据量、空值率、重复率、指标波动和更新延迟设置阈值。

## 六、数据质量与异常排查

| 检查项 | 推荐规则 | 异常时的处理 |
| --- | --- | --- |
| 唯一性 | 业务主键重复率为 0，事件流水允许重复时必须先去重 | 找到上游幂等或重复写入原因 |
| 完整性 | ${context.checks.join("；")} | 阻断下游发布并通知数据负责人 |
| 一致性 | 状态、金额、数量与业务系统对账 | 以原始业务单据为准修正 |
| 及时性 | 核心分区在约定 SLA 前就绪 | 标注延迟，不使用半成品数据出结论 |
| 合理性 | 指标波动超过历史区间时触发告警 | 先排查数据问题，再解释业务变化 |

常见误区包括：只看总量不看结构、分母基数变化却不说明、用累计快照计算新增、把缺失值直接当 0、在多个系统使用不同实体编码。围绕“${topic}”出问题时，应优先回到粒度、主键、状态和时间这四个维度排查。

## 七、结果解释与工作产出

一份可复用的交付不应只有一张图。建议同时提交：

- 一页问题说明：背景、范围和不在本次范围内的事项。
- 一份指标口径：公式、排除规则和负责人。
- 一张主看板：趋势、结构、异常和行动状态。
- 一组验证样例：正常对象、异常对象和边界对象。
- 一份复盘记录：${context.risk}的控制措施。

向业务方汇报时，先给结论和影响范围，再给证据。例如：“${primaryMetric}下降主要来自${context.dims[0]}中的${context.dims[1]}分组，排除数据缺失后仍成立；建议先处理 A 环节，观察两周，以${secondaryMetric}是否回升作为验收指标。”

## 八、练习与自测

用你自己的业务数据完成下面四项练习：

1. 写出“${topic}”的数据粒度，并说明一行代表什么。
2. 为“${primaryMetric}”写一份包含排除条件的指标定义。
3. 找一个指标下降案例，分别从数据质量和业务变化两方面给出证据。
4. 将上面的 SQL 改写为适配当前数仓方言的版本，并记录扫描分区和执行耗时。

> [!check] 完成标准
> 能向不熟悉数据的同事解释口径；能从报表追溯到明细；能在没有新增数据的情况下说明结论边界；能把分析结果转成有负责人和验收时间的行动项。

## 九、公开资料与方法依据

本文采用公开数据治理、指标管理和分析实践中的通用方法：先定义业务对象与粒度，再明确指标口径，最后通过明细抽样、分层对比和持续监控验证结论。行业场景还受内部制度、监管要求和系统现状影响，正式上线前应由业务、数据、安全与合规负责人共同确认。

`;
}

function buildLearningArticle(relativePath, displayTitle, context, seed) {
  const topic = cleanTopic(displayTitle);
  return `# ${displayTitle}

> [!tip] 学习目标
> 用一条可验收的路线掌握“${topic}”：既能解释核心概念，也能在${context.scene}中完成一个可复现的小项目，并通过数据质量检查和业务复盘说明自己的判断依据。

## 一、把“学过”变成“会做”

“${topic}”至少包含三层能力：知道概念是什么，知道工具怎么用，知道在什么业务条件下应该选择哪种方法。只收藏课程、照抄代码或背会术语，通常无法迁移到真实工作。建议把学习目标写成下面四项可观察成果：

- 能用自己的话解释核心概念，并给出一个反例。
- 能在${context.entities}构成的数据上完成采集、清洗、计算和结果检查。
- 能说明方案的限制、成本和适用条件。
- 能提交一份可复现的分析报告、数据管道或小工具，并让另一个人按文档复跑。

学习时不要同时追十几个工具。先画清数据从哪里来、经过哪些处理、最终服务谁，再补具体语法和组件。每学一个知识点，都问三个问题：它解决什么问题，输入和输出是什么，失败时会出现什么现象。

## 二、六周学习路线

| 阶段 | 时间 | 重点 | 验收方式 |
| --- | --- | --- | --- |
| 第 1 周：建立地图 | 每天 45 分钟 | 理解核心概念、上下游关系、常见失败模式 | 用 10 个以内的节点画出数据流 |
| 第 2 周：最小闭环 | 3 至 5 小时 | 跟着一个示例跑通读取、处理、输出 | 留下可执行脚本和运行记录 |
| 第 3 周：真实口径 | 4 至 6 小时 | 为两个指标写定义、边界和排除条件 | 产出指标字典和一页样例 |
| 第 4 周：独立分析 | 4 至 6 小时 | 自己找异常、做分层、核对明细 | 完成从结论到证据的链路 |
| 第 5 周：工程质量 | 3 至 5 小时 | 增加空值、重复、时效和幂等检查 | 注入一次错误并验证能被发现 |
| 第 6 周：作品化 | 3 至 5 小时 | 整理背景、方案、结果、限制和复盘 | 形成可展示的完整案例 |

如果每天可投入时间较少，可以拉长到 8 至 10 周，但不要跳过验收。阶段成果必须能被别人检查，否则很容易把“看过”误认为“掌握”。

## 三、建议练习项目

项目题目可以定为：**围绕${context.scene}，分析“${topic}”相关流程的效率与质量，定位一个可行动的改进点。**

数据至少保留${context.entities}等字段。第一版只选择两个指标，例如“${context.metrics[0]}”和“${context.metrics[1]}”，按${context.dims.slice(0, 3).join("、")}拆分。建议按下面顺序推进：

1. 写下业务问题、对象范围、时间窗和预期动作。
2. 确认事实表粒度，明确一行数据代表什么。
3. 检查主键、状态、时间、金额和维度映射。
4. 建立过去 8 至 12 周的基线，再观察目标周期。
5. 按渠道、区域、类型等维度做贡献度拆分。
6. 抽取正向和反向明细，验证数字对应的真实业务事件。
7. 给出行动建议、负责人、观察周期和停止条件。

## 四、最小数据模型与 SQL

| 对象 | 示例 | 关键字段 | 用途 |
| --- | --- | --- | --- |
| 事实表 | \`${context.factTable}\` | 主键、${context.timeField}、实体、状态、金额 | 记录业务事件 |
| 维度表 | \`${context.dimTable}\` | 实体主键、名称、分类、生效时间 | 提供统一分析口径 |
| 汇总表 | \`ads_learning_summary\` | 日期、维度、指标、质量标记 | 支撑趋势与复盘 |

下面是一个可以修改表名后运行的基线查询：

\`\`\`sql
SELECT
  DATE_TRUNC('week', ${context.timeField}) AS week,
  COUNT(DISTINCT id) AS valid_events,
  COUNT(DISTINCT entity_id) AS active_entities,
  ROUND(AVG(amount), 2) AS avg_amount
FROM ${context.factTable}
WHERE ${context.timeField} >= DATE '2026-01-01'
  AND COALESCE(is_deleted, 0) = 0
GROUP BY 1
ORDER BY 1;
\`\`\`

跑通后继续追问：分母是否被测试记录污染，状态是否包含撤销，时间字段是业务发生时间还是入仓时间，维度是否使用当时归属。只有这些问题都有答案，查询才从“能跑”变成“可用”。

## 五、交付物与质量标准

最终至少提交五项材料：问题说明、指标定义、数据处理代码、验证样例和一页结论。数据处理应保证可重复运行；指标应说明时间范围、粒度、分子分母和排除条件；结论应区分数据事实、可能解释和待验证假设。

| 检查项 | 最低要求 |
| --- | --- |
| 可复现 | 从原始数据到结果有明确步骤，不依赖手工改表 |
| 可解释 | 每个指标都有业务含义和口径说明 |
| 可核对 | 至少抽取 10 条明细与源系统核对 |
| 可监控 | 对重复、空值、延迟和异常波动设置规则 |
| 可行动 | 结论对应负责人、动作和观察指标 |

## 六、常见误区与自测

- 只展示总量，不解释结构变化和分母变化。
- 把空值直接填 0，掩盖采集失败。
- 用累计快照计算新增，造成重复。
- 跑出相关性后直接写成因果。
- 作品集只放截图，没有代码、口径和失败复盘。

完成后用自己的话回答：一行数据的粒度是什么？${context.checks.join("、")}分别在防什么问题？如果数据量扩大十倍，哪一步最先成为瓶颈？如果结论被业务质疑，能拿出哪三类证据？

> [!check] 今日行动
> 选一个 30 分钟能完成的小问题，写出对象、时间、粒度、指标和验收条件；然后只查完成这项任务所需的资料。今天结束前留下一个可运行查询或一条经过核对的数据结论。
`;
}

function buildInterviewArticle(relativePath, displayTitle, context, seed) {
  const topic = cleanTopic(displayTitle);
  return `# ${displayTitle}

> [!abstract] 核心策略
> 面试不是知识默写，而是用“${topic}”证明你能理解业务、做技术取舍、处理异常并对结果负责。回答时先讲事实和证据，再补概念；不会的问题明确边界，现场推导，不编造做过。

## 一、从岗位要求反推准备重点

先把目标 JD 拆成业务、技术、工程和协作四类要求，再为每类准备一个真实案例。不要在简历里写无法承接追问的工具名，也不要把团队成果全部写成个人成果。

| 维度 | 面试官观察什么 | 可提供的证据 |
| --- | --- | --- |
| 业务理解 | 是否知道指标服务谁、影响什么决策 | 需求背景、目标、约束、行动闭环 |
| 技术能力 | 是否能选择合适的数据模型和工具 | 表设计、SQL、代码、方案取舍 |
| 数据质量 | 是否主动检查异常与边界 | 校验规则、抽样、对账、告警 |
| 工程意识 | 是否考虑成本、稳定性、可维护性 | 压测、监控、回滚、容量评估 |
| 沟通协作 | 是否能推动业务确认口径 | 争议点、会议结论、责任边界 |
| 复盘能力 | 是否知道方案哪里不够好 | 指标结果、遗留问题、后续改进 |

## 二、项目介绍的标准结构

准备一个 90 秒版本和一个 3 分钟版本。两个版本都按“背景、任务、行动、结果、复盘”展开，先说影响，再说技术。

1. **背景**：${context.scene}中出现了什么具体问题，影响了哪些人或流程。
2. **任务**：你负责的范围、时间、目标和不能突破的约束。
3. **行动**：如何定义${context.metrics[0]}，如何设计粒度、链路、SQL 和质量校验。
4. **结果**：交付了什么，哪个指标发生变化，业务采取了什么动作。
5. **复盘**：方案哪里不够好，如果重做会优先改什么。

不要只说“用了哪些技术”。每个技术选择都要能回答替代方案是什么。例如为什么按小时增量而不是每天全量，为什么事实表采用当前粒度，为什么异常记录在 DWD 层排除而不是在报表层隐藏。

## 三、围绕“${topic}”的高频追问

**问：你会怎样定义指标？**

答：先确认业务对象、统计粒度、时间窗和成功状态，再写分子分母。涉及${context.entities}时，要检查主键唯一、状态完整、跨系统编码映射，并说明测试、撤销和退款如何处理。

**问：数据出现异常怎么办？**

答：先判断影响范围和是否需要阻断发布；然后依次检查上游延迟、重复写入、空值、口径变更和代码发布记录。${context.checks.join("，")}。恢复后补一份问题时间线和防复发措施。

**问：如何证明结论不是巧合？**

答：使用同周期基线和多维度分层，抽取正向与反向样本，并用实际行动后的指标变化做验证。

**问：项目中最大的困难是什么？**

答：优先讲可复现的问题，例如“${context.risk}导致数据不可比”。说明你如何定位、谁参与确认、采取了什么临时措施、最终怎样修复，以及后来加了什么监控。

**问：如果数据量扩大十倍怎么办？**

答：先定位瓶颈在读取、shuffle、存储还是查询，再从减少扫描、调整分区、预聚合、增量计算、资源隔离和冷热分层中选方案。不要直接回答“加机器”。

## 四、可展示的 SQL 片段

\`\`\`sql
WITH base AS (
  SELECT
    id,
    entity_id,
    ${context.timeField} AS event_time,
    status,
    COALESCE(amount, 0) AS amount
  FROM ${context.factTable}
  WHERE ${context.timeField} >= DATE '2026-01-01'
    AND COALESCE(is_deleted, 0) = 0
),
ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY id ORDER BY event_time DESC
    ) AS row_no
  FROM base
)
SELECT
  DATE_TRUNC('week', event_time) AS week,
  COUNT(DISTINCT entity_id) AS active_entities,
  COUNT(DISTINCT id) AS valid_events,
  ROUND(AVG(amount), 2) AS avg_amount
FROM ranked
WHERE row_no = 1
GROUP BY 1
ORDER BY 1;
\`\`\`

现场解释时应补充：时间字段为什么选业务发生时间，是否命中分区，状态如何过滤，重复数据在哪一步去重，以及 \`ROW_NUMBER\` 为什么能保证同一主键只保留一条。若面试官要求口径变化，再说明维度快照和当时归属的处理方式。

## 五、简历与作品集表达

简历项目描述建议采用“动作 + 方法 + 结果 + 证据”的格式：

> 负责${context.scene}中的专题分析，统一 2 个核心指标口径，建立明细到汇总的校验规则；定位主要影响因素并提出分层策略，将分析从一次性报表沉淀为周期监控。

数字必须真实可解释。不能披露业务数据时，可以写处理规模、交付时效、规则数量、覆盖团队数或人工步骤减少，但不要虚构金额和增长比例。作品集至少包含问题背景、架构或分析流程、关键代码、验证样例和复盘。

## 六、现场表达与追问边界

- 先给结论，再给两到三条证据，最后说明限制。
- 面试官追问细节时，画数据流或表关系比堆术语更有效。
- 被问到不会的技术，说明自己的理解边界和验证计划，不要强行编经历。
- 遇到开放式故障题，按“影响、止血、定位、修复、防复发”回答。
- 遇到指标争议，先找业务定义和原始单据，不要只争论 SQL。

## 七、面试前检查清单

- 能在 2 分钟内讲清一个完整项目，不堆砌工具名。
- 能画出数据流、表关系和质量检查点。
- 能解释一个失败或返工案例，并说明后来如何避免。
- 能现场写基础 SQL，并讲清执行顺序和去重逻辑。
- 能回答“如果数据量扩大十倍怎么办”。
- 能说明方案不适用的情况。
- 能区分个人贡献、团队成果和业务结果。
- 能拿出一个数据异常从发现到闭环的完整案例。

> [!check] 模拟练习
> 录一段 3 分钟项目回答，检查是否包含背景、任务、个人行动、结果和复盘。再让另一个人连续追问“为什么这样做、怎么验证、失败怎么办”。任何一个问题只能用概念回答、拿不出事实时，回到项目材料补证据。
`;
}

function buildResumeArticle(relativePath, displayTitle, context, seed) {
  const topic = cleanTopic(displayTitle);
  return `# ${displayTitle}

> [!tip] 使用原则
> 模板只负责结构，不替你制造经历。所有项目、指标和责任都必须来自真实工作；不能披露的数据应脱敏，并明确你实际负责的边界。

## 一、先确定这份简历投给谁

简历不是个人经历的总目录，而是针对岗位筛选证据。动笔前先找 3 至 5 份目标岗位 JD，把重复出现的要求分成四类：

- **业务**：行业、用户、交易、供应链、风险、医疗或企业内部经营。
- **数据**：SQL、Python、指标体系、实验分析、数仓分层、实时链路、治理规则。
- **工程**：调度、监控、性能、数据质量、权限、成本、发布和回滚。
- **协作**：需求澄清、跨团队推动、评审、文档、复盘和业务落地。

随后为每项能力找一条真实证据。证据至少包含场景、你的动作、产出和可验证结果。没有证据的技能不要放在靠前位置，更不能为了匹配 JD 编造项目。

| 岗位方向 | 优先展示 | 可以接受的替代证据 |
| --- | --- | --- |
| 数据分析 / BI | 业务问题、指标口径、SQL、可视化、行动闭环 | 分析报告、专题复盘、指标字典 |
| 数据开发 | 数据模型、批流链路、调度、性能、稳定性和质量 | 表设计、任务依赖、压测和故障复盘 |
| 数据治理 | 标准、元数据、血缘、质量、权限和跨团队机制 | 规则清单、问题闭环记录、制度草案 |
| 数据产品 | 需求分析、方案取舍、协作和采用情况 | PRD、原型、验收记录、使用数据 |
| 数据科学 / AI | 问题定义、特征与评估、实验、上线和监控 | 离线评测、误差分析、推理成本报告 |

## 二、专业简历的结构

| 模块 | 内容 | 建议篇幅 |
| --- | --- | --- |
| 基本信息 | 姓名、联系方式、城市、求职方向 | 2 至 3 行 |
| 个人概述 | 年限、领域、核心能力、代表成果 | 2 至 3 行 |
| 工作经历 | 公司、岗位、时间、职责与成果 | 主体部分 |
| 项目经历 | 背景、任务、方案、结果 | 2 至 4 个项目 |
| 技术栈 | 数据库、编程、调度、平台、分析方法 | 分类简洁列出 |
| 教育与其他 | 学历、证书、作品链接 | 有则写，无则不凑 |

个人信息只保留招聘方真正需要的内容。照片、身份证号、家庭住址、完整生日和与岗位无关的证书通常没有必要。工作经历按倒序排列，同一项目不要在工作经历和项目经历中各写一遍：工作经历讲职责范围和长期影响，项目经历讲具体问题、方案与结果。

个人概述可以用这个句式：

> X 年${context.topCategory.replace(/[【】]/g, "")}相关经验，长期服务${context.scene}，熟悉从需求澄清、${context.metrics[0]}定义、SQL 处理到质量校验和复盘汇报的完整流程；曾交付【真实项目或机制】，覆盖【真实范围】，推动【真实行动】。

不要写“精通所有数据技术”“学习能力强”“抗压能力强”这类无法验证的形容词。用项目中的行为证明学习、协作和解决问题能力。

## 三、工作经历怎么写

一条高质量经历通常包含四个部分：

1. **范围**：负责哪个业务域、哪些数据对象或哪段链路。
2. **动作**：独立完成了什么，使用什么方法，解决了什么约束。
3. **产出**：交付了哪些表、指标、任务、规则、报告或机制。
4. **结果**：业务如何采用，哪个指标、时效、成本或风险发生变化。

推荐句式：

> 负责${context.entities.split("、")[0]}相关数据需求，统一【指标或模型】口径，完成【表设计 / SQL / 链路 / 规则】；沉淀【报告 / 看板 / 服务 / 机制】，支持【团队或场景】，使【效率、质量、时效或成本指标】从【真实 X】改善到【真实 Y】。

如果没有精确的前后对比，可以写覆盖范围、交付数量、发布频率、问题关闭率或人工步骤变化。例如“覆盖 4 个业务域”“沉淀 18 条质量规则”“把周报从手工汇总改为定时更新”。这些替代指标同样必须真实。

## 四、项目描述模板

### 通用模板

**项目名称：** ${topic}

**业务背景：** 在${context.scene}中，业务需要持续观察${context.metrics.slice(0, 3).join("、")}，但原有口径和数据链路存在${context.risk}。

**本人职责：**

- 负责需求拆分、指标定义和${context.entities.split("、")[0]}粒度设计。
- 使用 SQL / Python / 调度工具完成数据处理、自动化和质量校验。
- 与业务、上下游团队确认状态口径，建立异常反馈和复盘机制。

**实现方案：**

- 从${context.entities}中构建事实与维度模型。
- 对重复、缺失、状态和时间边界建立规则。
- 将一次性分析沉淀为周期更新的看板或数据服务。

**结果表达：**

- 交付 X 个核心指标、X 张分析主题或 X 个自动化任务。
- 将人工处理时长从 X 降低到 Y，或将问题定位时间缩短 X%。
- 推动一项真实业务动作，并以${context.metrics[0]}作为观察指标。

没有准确数字时，可以写“覆盖 3 个业务团队”“形成 12 条质量规则”“项目按期上线”，不要虚构金额或增长比例。

### 数据分析 / BI 项目写法

> **背景**：${context.metrics[0]}连续波动，业务方无法判断是数据异常、结构变化还是策略失效。  
> **任务**：独立负责专题分析，限定一个季度，输出可行动的渠道和人群策略。  
> **处理**：核对事件主键、时间窗和退款状态；按${context.dims.slice(0, 4).join("、")}拆分；对异常分组抽样回查源系统。  
> **结论**：定位到 2 个主要影响分组，区分数据缺失与真实业务变化，并与业务确认行动边界。  
> **交付**：形成指标字典、专题看板和异常监控，支持业务按周复盘。  
> **结果**：用真实的决策、覆盖范围或效率改善表达，不把团队业务增长写成个人模型效果。

### 数据开发 / 数仓项目写法

> **背景**：${context.scene}的数据分散在多个源系统，存在粒度不一致、重复写入和上下游等待。  
> **任务**：负责 ODS 到 ADS 的模型与调度，保证每日在约定 SLA 前提供稳定数据。  
> **设计**：统一业务主键和事实粒度，拆分增量与全量链路，建立维度有效期和分区覆盖策略。  
> **质量**：增加主键唯一、金额平衡、状态完整、分区及时性和任务幂等检查；异常时阻断发布并通知负责人。  
> **稳定性**：为核心任务设置运行超时、失败重试和数据延迟告警，保留回滚与补数方案。  
> **结果**：用真实的任务数量、SLA、资源变化或问题恢复时间表达；没有数据时只写已交付范围。

### 数据治理 / 质量项目写法

> **背景**：${context.risk}导致同名指标口径不一致，问题通常在下游报表才被发现。  
> **任务**：负责一个业务域的数据标准、资产责任和质量闭环。  
> **动作**：盘点关键字段与指标，明确责任人、定义、枚举和有效期；把规则落到采集或加工环节。  
> **机制**：问题按严重等级进入工单，记录发现、影响、止血、修复、复核和防复发措施。  
> **结果**：使用规则覆盖、问题关闭率、核对耗时或重复争议下降等真实证据，不夸大“治理后数据零问题”。

## 五、把弱表达改成可追问表达

| 弱表达 | 问题 | 更可信的写法 |
| --- | --- | --- |
| 使用 SQL 完成数据分析，制作报表 | 没有对象、方法和结果 | 统一某业务的对象与状态口径，建立明细到汇总的校验，并将周报改为自动更新 |
| 负责数据仓库建设 | 范围过大，无法判断个人贡献 | 负责 3 个主题域的事实与维度设计，完成上线、校验和 SLA 监控 |
| 优化了 SQL 性能 | 没有瓶颈与验证 | 通过分区裁剪、预聚合和倾斜处理降低扫描量，执行时间从真实值 A 降到 B |
| 熟悉 Hadoop、Spark、Flink、Kafka、Doris | 工具堆砌，无法承接追问 | 使用 Spark 完成批处理、Flink 处理实时去重、Kafka 管理事件分流，并说明各自取舍 |
| 提升了数据质量 | 指标不可验证 | 为订单、支付和退款建立 12 条校验规则，问题从下游发现前移到发布前拦截 |
| 参与 AI 项目 | 责任边界模糊 | 负责训练与评测样本隔离、RAG 检索评测和失败分类，明确本人未负责模型训练 |
| 沟通能力强 | 无法验证 | 组织 3 个团队冻结指标口径，记录争议、结论、负责人和上线时间 |

一条经历不是动词越多越好。每个技术名词后面都要准备好四个答案：为什么用它、数据怎么流、失败时怎样发现、你个人做了什么。答不上来的内容删掉或者移到“了解”区域。

## 六、数字与证据的表达方式

优先使用能核对的指标：

| 类型 | 可写内容 | 需要保留的证据 |
| --- | --- | --- |
| 规模 | 表数量、日处理量、指标数、覆盖业务域 | 资产清单、任务清单、指标字典 |
| 时效 | SLA、延迟、交付周期、恢复时间 | 监控记录、工单时间线 |
| 质量 | 重复率、空值率、通过率、问题关闭率 | 规则结果、复核记录 |
| 成本 | 扫描量、资源消耗、存储占用、调用成本 | 账单、执行记录、容量报告 |
| 采用 | 使用团队、活跃用户、决策动作、发布频率 | 访问记录、评审纪要、业务反馈 |

“提升 30%”“节省 200 万”必须有计算口径和统计周期。无法披露公司数据时，可以保留方法和结果类型，例如“降低重复扫描”“缩短异常定位链路”，同时说明数字已脱敏。不要写无法解释来源的百分比。

## 七、作品集与项目说明

简历只能放摘要，作品集负责提供证据。一个完整项目作品建议包含：

1. 问题背景、使用者和业务目标。
2. 数据范围、粒度、时间窗与隐私处理。
3. 架构图或分析流程图。
4. 表设计、关键 SQL、代码或规则。
5. 指标口径、质量检查和验证样例。
6. 结果、限制、失败尝试和后续改进。

作品集中不要放真实客户名单、手机号、身份证号、内部地址、密钥、未公开经营数据和可直接识别的个人信息。使用合成数据或脱敏样例时，要在页面显著位置说明。引用公开数据时应保留来源、版本和使用条件。

## 八、针对岗位定制

- 投数据分析岗：突出业务问题、指标、SQL、可视化和行动闭环。
- 投数据开发岗：突出数据模型、批流链路、调度、性能和质量监控。
- 投数据治理岗：突出标准、元数据、血缘、质量规则和跨团队推动。
- 投数据产品岗：突出需求分析、方案取舍、协作和采用情况。
- 投 AI / 数据科学岗：突出问题定义、样本与评估、误差分析和上线边界。

每投一个方向，把最相关的 3 条经历放在最前面，删去无法帮助该岗位判断的信息。不要把同一份简历投所有岗位，也不要在技能栏列出 30 个只能说出名称的工具。

## 九、排版与格式规范

- 一页优先，经历较多时可扩展为两页；页面留白和字号保持一致。
- 时间统一使用“YYYY.MM - YYYY.MM”，公司和岗位名称使用正式写法。
- 中英文之间保留空格，技术名词大小写统一，例如 SQL、Spark、Flink、ClickHouse。
- 每条项目要点控制在 1 至 3 行，优先使用动作开头，不写大段自评。
- 导出 PDF 后检查中文字体、链接、分页和页边距，避免 Word 中正常、PDF 中乱码。
- 文件名建议为“姓名-岗位-年限.pdf”，不要出现“最终版”“最新版”等内部命名。

## 十、投递前检查清单

- 每个项目都能回答“为什么做、你做了什么、怎么验证、结果如何、哪里不够”。
- 简历中的公司、时间、岗位、技术栈与背调和项目材料一致。
- 所有数字都有口径，不能披露的数据已经脱敏。
- 没有把团队成果全部写成个人成果，也没有把“参与”写成“负责”。
- 技能栏中的每项技术都能说出至少一个使用场景。
- 文件命名清晰，PDF 打开无乱码，手机和电脑均可阅读。
- 敏感数据、内部域名、账号、密钥和客户信息已移除。
- 已针对目标 JD 调整摘要和项目顺序，而不是一份简历通用投递。

完成以上检查后，再让一位熟悉该岗位的人连续追问 10 分钟。任何需要临时编故事才能回答的表述，都应该改成真实范围或删除。

> [!check] 最终自测
> 选一条简历要点，让另一个人连续追问三次“具体怎么做、怎么证明、如果重做会改什么”。如果答案只能依赖口号或无法核对的数字，就把它改成更小但更真实的交付。
`;
}

function titleFromFrontmatter(markdown) {
  const frontmatterMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatterMatch) return null;
  const titleLine = frontmatterMatch[1]
    .split(/\r?\n/)
    .find((line) => line.startsWith("title:"));
  if (!titleLine) return null;
  const rawTitle = titleLine.replace(/^title:\s*/, "").trim();
  if (rawTitle.startsWith('"')) {
    try {
      return JSON.parse(rawTitle);
    } catch {
      return null;
    }
  }
  if (rawTitle.startsWith("'") && rawTitle.endsWith("'")) {
    return rawTitle.slice(1, -1).replaceAll("''", "'");
  }
  return rawTitle || null;
}

function articleMarkdown(relativePath, fallbackTitle = null) {
  const existing = fs.readFileSync(path.join(ARTICLES, ...relativePath.split("/")), "utf8");
  const match = existing.match(/<p class="lab-paywall-document">([\s\S]*?)<\/p>/);
  const basename = path.posix.basename(relativePath, ".md");
  const displayTitle =
    (match ? decodeHtml(match[1]) : null) ||
    titleFromFrontmatter(existing) ||
    fallbackTitle ||
    basename;
  const context = getContext(relativePath);
  const type = classify(relativePath, displayTitle);
  const seed = hashNumber(relativePath);
  let body;

  if (type === "learning") {
    body = buildLearningArticle(relativePath, displayTitle, context, seed);
  } else if (type === "interview") {
    body = buildInterviewArticle(relativePath, displayTitle, context, seed);
  } else if (type === "resume") {
    body = buildResumeArticle(relativePath, displayTitle, context, seed);
  } else {
    body = buildPracticeArticle(relativePath, displayTitle, context, type, seed);
  }

  const difficulty =
    type === "learning" || type === "concept" ? "基础" : type === "architecture" ? "进阶" : "实战";
  const tags = [
    displayTitle,
    context.industry || context.topCategory,
    context.section,
    type === "interview" ? "求职面试" : type === "project" ? "项目实战" : "数据实践"
  ].filter(Boolean);
  const frontmatter = [
    "---",
    `title: ${JSON.stringify(displayTitle)}`,
    "tags:",
    ...tags.map((tag) => `  - ${JSON.stringify(tag)}`),
    "created: 2026-01-01",
    "updated: 2026-11-06",
    `difficulty: ${difficulty}`,
    "duration: 35分钟",
    "knowledge_type: practical-guide",
    "target_audience:",
    "  - 数据分析师",
    "  - 数据开发工程师",
    "  - 数据产品经理",
    "stability: stable",
    "status: complete",
    "access_tier: free",
    "---",
    "",
    ""
  ].join("\n");

  return {
    title: displayTitle,
    category: context.industry || context.topCategory,
    type,
    markdown: `${frontmatter}${body}`
  };
}

function analyzeMarkdown(markdown) {
  const lines = markdown.split("\n");
  const headings = [];
  const byteOffsets = [];
  let offset = 0;
  let inFence = false;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    byteOffsets[lineIndex] = offset;
    if (/^```/.test(line.trim())) inFence = !inFence;
    const match = !inFence && line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (match) {
      headings.push({
        heading: match[2],
        level: match[1].length,
        pos: [
          lineIndex,
          0,
          offset,
          lineIndex,
          line.length,
          offset + line.length
        ]
      });
    }
    offset += line.length + 1;
  }

  const closingLineIndex = lines.findIndex((line, index) => index > 0 && line === "---");
  const closingOffset = byteOffsets[closingLineIndex] || 0;
  const frontmatterEnd = closingOffset + (lines[closingLineIndex] || "---").length;
  const tagsStart = lines.findIndex((line) => line === "tags:");
  const tags = [];
  if (tagsStart >= 0) {
    for (let index = tagsStart + 1; index < lines.length && /^\s+-\s+/.test(lines[index]); index += 1) {
      tags.push(JSON.parse(lines[index].replace(/^\s+-\s+/, "")));
    }
  }

  return {
    frontmatter: {
      access_tier: "free",
      created: "2026-01-01",
      difficulty: lines.find((line) => line.startsWith("difficulty:"))?.split(":").slice(1).join(":").trim() || "实战",
      duration: "35分钟",
      knowledge_type: "practical-guide",
      stability: "stable",
      status: "complete",
      tags,
      target_audience: ["数据分析师", "数据开发工程师", "数据产品经理"],
      title: JSON.parse(lines.find((line) => line.startsWith("title:"))?.replace(/^title:\s*/, "") || '""'),
      updated: "2026-11-06"
    },
    frontmatterLinks: null,
    frontmatterPos: [0, 0, 0, closingLineIndex, 3, frontmatterEnd],
    headings,
    links: [],
    listItems: [],
    tags: null
  };
}

function main() {
  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  const force = process.argv.includes("--force");
  let candidates;
  if (force) {
    if (!fs.existsSync(REPORT_FILE)) {
      throw new Error("Missing expanded-member-titles.json; run without --force first.");
    }
    const report = JSON.parse(fs.readFileSync(REPORT_FILE, "utf8"));
    candidates = [...new Set((report.articles || []).map((article) => article.path).filter(Boolean))]
      .map((relativePath) => ({
        relativePath,
        fallbackTitle: report.articles.find((article) => article.path === relativePath)?.title || null
      }));
  } else {
    candidates = walk(ARTICLES)
      .filter(
        (filePath) =>
          filePath.endsWith(".md") && fs.readFileSync(filePath, "utf8").includes(PAYWALL_MARKER)
      )
      .map((filePath) => ({
        relativePath: relativeArticlePath(filePath),
        fallbackTitle: null
      }));
  }
  const replaced = [];

  for (const { relativePath, fallbackTitle } of candidates) {
    const filePath = path.join(ARTICLES, ...relativePath.split("/"));
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing member article: ${relativePath}`);
    }
    const article = articleMarkdown(relativePath, fallbackTitle);
    fs.writeFileSync(filePath, article.markdown);
    cache[relativePath] = analyzeMarkdown(article.markdown);
    replaced.push({
      path: relativePath,
      title: article.title,
      category: article.category,
      type: article.type,
      characters: article.markdown.length
    });
  }

  fs.writeFileSync(CACHE_FILE, `${JSON.stringify(cache, null, 2)}\n`);
  fs.writeFileSync(REPORT_FILE, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    count: replaced.length,
    articles: replaced
  }, null, 2)}\n`);

  const totalCharacters = replaced.reduce((sum, article) => sum + article.characters, 0);
  console.log(JSON.stringify({
    replaced: replaced.length,
    totalCharacters,
    averageCharacters: Math.round(totalCharacters / Math.max(replaced.length, 1))
  }, null, 2));
}

main();
