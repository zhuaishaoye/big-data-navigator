const crypto = require("node:crypto");
const { buildTopicCode } = require("./topic-code-templates");

const REGIONS = ["华东", "华南", "华北", "华中", "西南", "西北", "东北"];
const CASE_STYLES = [
  {
    key: "definition",
    title: "口径冲突与对象边界",
    signal: "两个团队使用同名主题却得到不同结论，会议先争论数字而不是业务动作",
    verification: "同一批原始记录分别按两套定义重算，再让业务、数据和审计共同确认差异来源"
  },
  {
    key: "lineage",
    title: "链路断点与批次追踪",
    signal: "主题相关结果在某一时段突然缺失或放大，源系统仍显示业务正常运行",
    verification: "按事件时间、入仓时间、处理版本和分区覆盖重建批次时间线"
  },
  {
    key: "decision",
    title: "行动效果与护栏指标",
    signal: "团队已经执行策略，但无法区分自然变化、选择偏差和策略带来的真实增量",
    verification: "保留对照组或可比基线，同时检查主指标、护栏指标和长期副作用"
  },
  {
    key: "failure",
    title: "异常回放与失败恢复",
    signal: "一次版本、权限或上游变更使结果失真，修复后仍担心历史分区没有清干净",
    verification: "用正常、边界和失败样本各回放一次，并记录补数范围、回滚点和复核结果"
  },
  {
    key: "cost",
    title: "成本、容量与质量取舍",
    signal: "数据量增长后交付仍能运行，但延迟、资源或人工补救成本持续上升",
    verification: "同时记录输入规模、扫描字节、峰值资源、P95 时延和单位结果成本"
  },
  {
    key: "handoff",
    title: "跨团队交接与责任闭环",
    signal: "问题被发现后，业务、开发和运维都认为下一动作不属于自己",
    verification: "把发现、判定、处置、复核和复盘分别绑定责任人与完成证据"
  }
];

const FAMILY_PLAYS = {
  finance: {
    mechanism: "把交易、余额、估值和风险敞口拆成不同事实粒度，先保证现金流与会计等式，再解释收益或风险变化",
    evidence: ["业务日期与会计日期", "币种和金额单位", "交易与余额粒度", "估值参数版本", "审批与复核记录"],
    decisions: ["是否继续持有或授信", "是否触发风险限额", "是否需要估值调整", "是否需要追保或处置"],
    failure: ["本金与利息混算", "期末余额代替平均余额", "估值参数不可追溯", "交易与清算时间错位"],
    code: "finance"
  },
  retail: {
    mechanism: "沿曝光、访问、加购、支付、履约和售后还原用户与订单状态，并固定分子、分母和退款口径",
    evidence: ["用户与设备标识", "曝光和点击时间", "订单与支付状态", "商品和渠道归属", "退款与履约结果"],
    decisions: ["是否调整投放", "是否补货或清仓", "是否改变权益", "是否优化页面或履约"],
    failure: ["曝光重复", "拆单或合并支付", "归因窗口不一致", "退款未回冲"],
    code: "retail"
  },
  manufacturing: {
    mechanism: "把工单、设备、工序、质量、停机和物料状态串成时间轴，再用数量守恒和状态时长校验结果",
    evidence: ["工单与批次", "设备与工序", "标准节拍", "良品与报废", "停机原因与责任班组"],
    decisions: ["是否换线或排产", "是否检修设备", "是否放行质量", "是否调整库存"],
    failure: ["工单跨班次拆分错误", "停机与故障重叠", "报废未回冲", "标准工时版本失效"],
    code: "manufacturing"
  },
  healthcare: {
    mechanism: "围绕患者主索引、就诊、医嘱、检查、诊断、治疗、费用和随访建立临床时间线，并区分医疗事件与计费事件",
    evidence: ["患者主索引", "就诊与住院号", "医嘱执行时间", "诊断和术语版本", "检验单位与参考区间", "知情与权限记录"],
    decisions: ["是否预警或转诊", "是否调整诊疗路径", "是否纳入质量管理", "是否需要随访"],
    failure: ["多院区患者重复", "医嘱与执行时间混用", "诊断编码版本漂移", "失访未进入分母"],
    code: "healthcare"
  },
  education: {
    mechanism: "把招生、课程、学习行为、作业测评、升学或就业结果按学生 cohort 连接，并保留课程和规则版本",
    evidence: ["学生与班级标识", "课程和学制版本", "学习行为时间", "测评与作业", "升学或就业结果"],
    decisions: ["是否提供干预", "是否调整课程", "是否配置教师资源", "是否优化招生与支持"],
    failure: ["转班后 cohort 断裂", "补考成绩覆盖历史", "课程版本未绑定", "结果观察窗口不足"],
    code: "education"
  },
  logistics: {
    mechanism: "以订单、包裹、车辆、路线、节点和签收事件为主线，联合计算时效、成本、装载率和异常率",
    evidence: ["运单与包裹键", "仓和站点", "计划与实际到离时间", "车辆与路线", "签收和破损记录"],
    decisions: ["是否改派路线", "是否增开运力", "是否调整仓网", "是否触发赔付和补救"],
    failure: ["计划时间覆盖实际时间", "多包裹订单重复计费", "跨时区节点错序", "签收后拒收未回冲"],
    code: "logistics"
  },
  realestate: {
    mechanism: "围绕地块、项目、楼栋、房间、租约、销售和回款建立资产时间轴，并区分认购、签约、备案和现金流",
    evidence: ["项目和楼栋", "可售与可租面积", "认购签约状态", "租约有效期", "土地、建安和融资现金流"],
    decisions: ["是否调整推盘", "是否改变定价", "是否继续投资", "是否优化物业运营"],
    failure: ["可售面积口径变化", "认购冒充成交", "现金流时点错位", "跨期费用未分摊"],
    code: "realestate"
  },
  energy: {
    mechanism: "把设备、表计、负荷、交易、检修和气象数据按统一时间粒度对齐，并严格区分计量边界和结算边界",
    evidence: ["设备与表计", "采集时间与频率", "输入输出电量", "负荷和容量", "市场交易与结算"],
    decisions: ["是否调度机组", "是否购售电", "是否检修", "是否触发需求响应"],
    failure: ["表计时钟漂移", "统计线损和真实损耗混算", "容量边界不一致", "交易与交割日错位"],
    code: "energy"
  },
  agriculture: {
    mechanism: "把地块、作物、批次、环境传感、农事操作、采收和检测结果连成生产批次链，并保留天气与投入品记录",
    evidence: ["地块和批次", "品种与生育期", "传感器时间", "农事操作", "采收重量与含水量", "检测报告"],
    decisions: ["是否灌溉施肥", "是否预警病虫害", "是否采收", "是否召回或转仓"],
    failure: ["地块边界变化", "传感器漂移", "采收面积与种植面积混用", "批次追溯断链"],
    code: "agriculture"
  },
  technology: {
    mechanism: "从请求或事件入口追踪到计算、存储、服务和消费端，把正确性、时延、吞吐、成本与故障恢复放在同一张运行图中",
    evidence: ["输入规模和分区", "执行计划与资源", "版本和配置", "状态与 Checkpoint", "错误日志", "对账结果"],
    decisions: ["是否扩容", "是否改模型或索引", "是否回滚", "是否补数与重放"],
    failure: ["只改参数不做基线", "重复消费", "状态无限增长", "新逻辑已上线但旧分区未回刷"],
    code: "technology"
  },
  governance: {
    mechanism: "把资产、标准、责任、质量、血缘、权限和工单串成控制链，让每个风险都能追溯定义、数据和处置证据",
    evidence: ["资产唯一标识", "标准和版本", "责任矩阵", "质量结果", "访问日志", "变更与工单"],
    decisions: ["是否阻断发布", "是否收回权限", "是否批准豁免", "是否升级治理范围"],
    failure: ["文档与实现脱节", "规则没有责任人", "血缘只到表级", "权限长期不复核"],
    code: "governance"
  },
  ai: {
    mechanism: "把输入、检索或特征、模型调用、工具动作、输出、评审和反馈拆成可观测步骤，并分别评估正确性、安全、时延和成本",
    evidence: ["数据与知识版本", "Prompt 和模型版本", "检索命中和引用", "工具参数与权限", "人工复核", "线上反馈"],
    decisions: ["是否回答或拒答", "是否调用工具", "是否转人工", "是否回滚模型或索引"],
    failure: ["只看离线准确率", "检索权限泄漏", "工具参数越权", "重试导致重复动作"],
    code: "ai"
  },
  analytics: {
    mechanism: "把业务问题转成对象、时间窗、比较基准、指标和行动，再用分层、实验或因果方法验证解释",
    evidence: ["问题定义", "分析对象", "基线与对照", "指标口径", "分群结果", "反例与限制"],
    decisions: ["是否投入策略", "是否调整资源", "是否继续实验", "是否停止无效动作"],
    failure: ["分母漂移", "多重比较", "只挑显著结果", "把相关当因果"],
    code: "analytics"
  },
  career: {
    mechanism: "把目标岗位要求拆成业务、方法、工程和协作证据，再用真实项目、失败复盘和可验证结果组织表达",
    evidence: ["目标 JD", "个人职责", "关键动作", "数据范围", "验证结果", "失败与复盘"],
    decisions: ["是否匹配岗位", "如何排序证据", "如何回答追问", "是否接受机会与条件"],
    failure: ["把团队成果写成个人成果", "数字无法解释", "只讲工具不讲判断", "夸大掌握程度"],
    code: "career"
  },
  learning: {
    mechanism: "把学习目标拆成概念理解、最小练习、反馈、变式和真实交付，并用间隔复现与迁移任务验证掌握",
    evidence: ["目标能力", "练习记录", "错误清单", "反馈来源", "复跑结果", "迁移任务"],
    decisions: ["继续深入还是补基础", "保留哪些资料", "下一步练什么", "是否达到交付水平"],
    failure: ["用观看时长代替掌握", "只做原题", "没有外部反馈", "项目无法复跑"],
    code: "learning"
  },
  project: {
    mechanism: "把范围、现状、目标、方案、数据、质量、发布、采用和收益放进同一交付闭环，并保留变更和回滚",
    evidence: ["立项基线", "范围和里程碑", "架构与模型", "测试和对账", "发布记录", "采用与复盘"],
    decisions: ["是否变更范围", "是否通过评审", "是否灰度", "是否停止或扩展"],
    failure: ["目标不可测", "只交付系统不交付采用", "测试环境与生产漂移", "收益口径事后改变"],
    code: "project"
  }
};

function hashNumber(value) {
  return crypto.createHash("sha1").update(String(value)).digest().readUInt32BE(0);
}

function pick(items, seed) {
  return items[seed % items.length];
}

function esc(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function sqlToken(value) {
  const ascii = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
  return ascii || `topic_${hashNumber(value).toString(36)}`;
}

function familyPlay(specialty) {
  const family = specialty.family;
  if (/finance/.test(family)) return FAMILY_PLAYS.finance;
  if (/retail|order|growth/.test(family)) return FAMILY_PLAYS.retail;
  if (/manufactur/.test(family)) return FAMILY_PLAYS.manufacturing;
  if (/clinical|genomics|medical|pharma/.test(family)) return FAMILY_PLAYS.healthcare;
  if (/education/.test(family)) return FAMILY_PLAYS.education;
  if (/logistics/.test(family)) return FAMILY_PLAYS.logistics;
  if (/real-estate/.test(family)) return FAMILY_PLAYS.realestate;
  if (/energy/.test(family)) return FAMILY_PLAYS.energy;
  if (/agriculture/.test(family)) return FAMILY_PLAYS.agriculture;
  if (/agent|rag|llm|model|ai-/.test(family)) return FAMILY_PLAYS.ai;
  if (/spark|kafka|streaming|cdc|scheduling|warehouse|architecture|performance|sql|data-service|technology/.test(family)) {
    return FAMILY_PLAYS.technology;
  }
  if (/career|resume/.test(family)) return FAMILY_PLAYS.career;
  if (/learning/.test(family)) return FAMILY_PLAYS.learning;
  if (/project/.test(family)) return FAMILY_PLAYS.project;
  if (/quality|lineage|master|security|governance/.test(family)) return FAMILY_PLAYS.governance;
  return FAMILY_PLAYS.analytics;
}

function titleSegments(title) {
  return String(title)
    .replace(/[（(][^）)]*[）)]/g, " ")
    .split(/[\s/、，,：:·_-]+/)
    .map((item) => item.replace(/^(?:深度|全|核心|基础|系统|实战|进阶|解析|概述|指南|方法|体系)+/g, ""))
    .filter((item) => item.length >= 2 && !/^(实战|指南|解析|概述|方法|体系|基础|进阶|应用|分析|数据|框架|全景|核心|深度)$/.test(item))
    .slice(0, 5);
}

function familyTitle(specialty) {
  return specialty.label.replace(/[|\s]+/g, " ");
}

function definitionParagraph(profile) {
  const { specialty, context, topic } = profile;
  const play = familyPlay(specialty);
  if (specialty.metric) {
    return `“${topic}”在本手册中被当作一个可审计的经营指标，而不是一个随口引用的数字。核心口径为 **${specialty.metric.formula}**，常用单位为${specialty.metric.unit}。它主要回答：${specialty.metric.interpretation}。最容易出现的错误是${specialty.metric.trap}。`;
  }
  return `“${topic}”属于“${specialty.label}”问题。落实到数据工作，它不是单一字段或一张结果表，而是一套围绕${context.label}业务对象形成的观察方法：${play.mechanism}。本手册会把标题拆成业务对象、事件时间、状态、证据、行动和边界六个部分，避免文章只解释名词。`;
}

function semanticQuestions(profile) {
  const { specialty, context, topic } = profile;
  const play = familyPlay(specialty);
  return [
    ["业务对象", `${topic}到底作用于${context.entities.slice(0, 3).map(([name]) => name).join("、")}中的哪一个对象？`, "对象定义、样例单据、粒度说明"],
    ["事件与时间", `围绕“${topic}”的业务发生时间、数据可见时间和行动时间是否分开？`, `${context.dateField}、更新时间、版本号、状态时间`],
    ["计算或机制", specialty.metric ? specialty.metric.formula : `业务动作如何经过${context.stages.slice(0, 4).join(" → ")}形成结果？`, specialty.metric ? "公式、分子、分母和排除项" : "流程图、状态机和输入输出契约"],
    ["证据链", `出现异常时，如何从“${topic}”结果回到${play.evidence.slice(0, 3).join("、")}？`, "血缘、原始日志、抽样明细与审批记录"],
    ["行动出口", `谁将依据“${topic}”采取${play.decisions[0]}等动作，失败时如何处理？`, "决策记录、责任矩阵、回滚和复盘"]
  ];
}

function semanticTable(profile) {
  const questions = semanticQuestions(profile);
  return [
    "| 语义层 | 必须回答的问题 | 最小证据 | 不能接受的写法 |",
    "| --- | --- | --- | --- |",
    ...questions.map(([layer, question, evidence], index) => (
      `| ${esc(layer)} | ${esc(question)} | ${esc(evidence)} | ${index === 1 ? "只写日期字段，不说明业务时间与批次时间" : index === 2 ? "只贴结论，不写公式、状态和排除项" : "没有负责人、样例或版本"} |`
    ))
  ].join("\n");
}

function objectModelTable(profile) {
  const { context, specialty, topic, seed } = profile;
  const play = familyPlay(specialty);
  const stages = specialty.workflow.length ? specialty.workflow : context.stages;
  const entities = context.entities.slice(0, 5);
  return [
    "| 数据对象 | 业务含义 | 建议主键 | 关键时间 | 所属环节 | 主要证据 |",
    "| --- | --- | --- | --- | --- | --- |",
    ...entities.map(([name, key], index) => (
      `| ${esc(name)} | ${index === 0 ? `承载“${topic}”的核心对象` : `${familyTitle(specialty)}过程或结果对象`} | \`${key}\` | ${esc(pick([context.dateField, "event_time", "effective_from", "updated_at"], seed + index))} | ${esc(stages[index % stages.length])} | ${esc(play.evidence[index % play.evidence.length])} |`
    )),
    `| 标题主题映射 | ${esc(topic)} | \`subject_type + subject_id\` | \`valid_from / valid_to\` | 用于收窄到本专题 | 口径版本、代码版本和责任人 |`
  ].join("\n");
}

function metricEvidenceTable(profile) {
  const { context, specialty, seed } = profile;
  const play = familyPlay(specialty);
  const metrics = context.metricDefs.slice(0, 5);
  const rows = metrics.map(([name, formula, alias], index) => (
    `| ${esc(name)} | \`${esc(formula)}\` | \`${esc(alias)}\` | ${esc(context.dims[index % context.dims.length])} | ${esc(play.failure[index % play.failure.length])} |`
  ));
  if (specialty.metric) {
    rows.unshift(`| ${esc(profile.topic)}（主指标） | \`${esc(specialty.metric.formula)}\` | \`topic_metric\` | ${esc(context.dims[seed % context.dims.length])}、时间、状态 | ${esc(specialty.metric.trap)} |`);
  }
  return [
    "| 指标或检查量 | 计算思路 | 示例字段 | 常用维度 | 典型失真 |",
    "| --- | --- | --- | --- | --- |",
    ...rows.slice(0, 6)
  ].join("\n");
}

function caseNarrative(profile, style, index) {
  const { context, specialty, topic, seed } = profile;
  const play = familyPlay(specialty);
  const region = REGIONS[(seed + index * 2) % REGIONS.length];
  const entity = context.entities[(seed + index) % context.entities.length]?.[0] || "业务对象";
  const systemChain = specialty.systems.slice(index % Math.max(specialty.systems.length - 2, 1), index % Math.max(specialty.systems.length - 2, 1) + 3);
  const stageStart = specialty.workflow[index % specialty.workflow.length];
  const stageEnd = specialty.workflow[(index + 2) % specialty.workflow.length];
  const role = context.participants[(seed + index) % context.participants.length];
  const metric = specialty.metric?.formula || context.metricDefs[(seed + index) % context.metricDefs.length][0];
  const risk = play.failure[(seed + index) % play.failure.length];
  const evidence = play.evidence[(seed + index) % play.evidence.length];
  const action = play.decisions[(seed + index) % play.decisions.length];
  const org = `${region}某${context.label.replace(/行业|健康|教育|电力|科技/g, "").replace(/^各/, "")}业务团队`;
  return `### 案例 ${index + 1}：${org}的“${topic}”${style.title}

这是一个结合公开方法论、常见生产问题和脱敏字段构造的复合案例，不对应任何单一企业事实。

- **为什么做**：${style.signal}。负责人希望围绕“${topic}”得到一个能解释、能执行、能复核的结论，而不是再增加一张结果表。
- **范围与对象**：观察对象是${entity}，时间覆盖完整业务周期；数据来自${systemChain.join("、")}。业务侧由${role}确认定义，数据侧保留批次、版本、代码提交和任务实例。
- **起点与异常**：团队先检查${stageStart}到${stageEnd}的状态变化，发现${risk}。如果直接把这条异常解释为业务变化，就会把“${topic}”误写成一句无法追责的结论。
- **数据处理**：先以${context.entities[0][1]}固定对象，再按事件时间排序、按版本去重、按有效状态筛选；金额或数量类结果同时做守恒校验，比例类结果同时输出分子、分母和样本量。关键证据包括${evidence}和${context.controls.slice(0, 3).join("、")}。
- **方法选择**：本例不直接套模型。若问题只是核对口径，先做明细对账；若要比较变化，做同期基线和结构贡献；若要判断行动效果，则保留对照或构造可比方案。主检查量为${metric}。
- **验证过程**：${style.verification}。验证结果必须同时解释总量差异、分组差异和单条样本差异，三者不能只保留最好看的一层。
- **处置动作**：${role}根据结果决定${action}。开发负责人保存补数或回滚方案，业务负责人确认受影响对象，安全或审计角色确认数据使用边界。
- **可接受结果**：验收不是“图看起来正常”，而是口径版本已登记、关键对象可追溯、失败样本被覆盖、上下游能够复跑，并明确下一观察窗口。
- **失败路径**：如果只修复报表而不修复源状态，或只补一天数据而不检查跨期影响，同类问题会再次出现。若验证不通过，应停止发布并回到${specialty.controls[0]}。
- **复盘问题**：这次问题最早可以在哪个校验点被发现？哪个指标应该成为护栏？谁能在一个工作日内对“${topic}”的口径变更作出决定？`;
}

function codeFence(language, code) {
  return `\`\`\`${language}\n${code.trim()}\n\`\`\``;
}

function financeMetricCode(profile) {
  const { specialty, topic } = profile;
  const token = sqlToken(topic);
  const formula = specialty.metric?.formula || "目标利润 / 目标权益";
  return `# ${topic}
from dataclasses import dataclass
from decimal import Decimal

@dataclass(frozen=True)
class ${token.charAt(0).toUpperCase() + token.slice(1)}Snapshot:
    entity_id: str
    period: str
    numerator: Decimal
    denominator: Decimal
    scope_version: str

def calculate_${token}(rows: list[${token.charAt(0).toUpperCase() + token.slice(1)}Snapshot]) -> list[dict]:
    result = []
    for row in rows:
        if row.denominator == 0:
            result.append({"entity_id": row.entity_id, "period": row.period, "value": None, "reason": "zero_or_negative_base"})
            continue
        value = row.numerator / row.denominator
        result.append({
            "entity_id": row.entity_id,
            "period": row.period,
            "value": float(value),
            "formula": "${formula}",
            "scope_version": row.scope_version,
        })
    return result

# 发布门禁：合并范围、币种、平均余额算法和一次性项目必须随结果一起保存。`;
}

function financeLedgerCode(profile) {
  const token = sqlToken(profile.topic);
  return `-- ${profile.topic}：交易流水与余额快照的双向对账
WITH ledger_${token} AS (
  SELECT
    account_id,
    currency,
    business_date,
    SUM(CASE WHEN debit_credit = 'D' THEN amount ELSE -amount END) AS ledger_delta,
    COUNT(DISTINCT journal_id) AS journal_cnt,
    MAX(updated_at) AS last_event_at
  FROM fin_journal_line
  WHERE business_date >= DATE '{start_date}'
    AND business_date <  DATE '{end_date}'
    AND subject_code = '{${token}_subject}'
  GROUP BY account_id, currency, business_date
),
snapshot_${token} AS (
  SELECT
    account_id,
    currency,
    business_date,
    balance_amount,
    balance_version,
    ROW_NUMBER() OVER (
      PARTITION BY account_id, currency, business_date
      ORDER BY updated_at DESC
    ) AS rn
  FROM fin_account_balance_snapshot
  WHERE business_date >= DATE '{start_date}'
    AND business_date <  DATE '{end_date}'
)
SELECT
  COALESCE(l.account_id, s.account_id) AS account_id,
  COALESCE(l.currency, s.currency) AS currency,
  COALESCE(l.business_date, s.business_date) AS business_date,
  l.ledger_delta,
  s.balance_amount,
  l.ledger_delta - LAG(s.balance_amount) OVER (PARTITION BY s.account_id, s.currency ORDER BY s.business_date) AS explained_delta
FROM ledger_${token} l
FULL OUTER JOIN snapshot_${token} s
  ON l.account_id = s.account_id
 AND l.currency = s.currency
 AND l.business_date = s.business_date
 AND s.rn = 1
WHERE ABS(COALESCE(l.ledger_delta, 0) - COALESCE(s.balance_amount, 0)) > 0.01;`;
}

function retailMetricCode(profile) {
  const token = sqlToken(profile.topic);
  return `-- ${profile.topic}：先固定有效订单和有效用户，再计算指标
WITH valid_order_${token} AS (
  SELECT
    order_id,
    user_id,
    channel,
    store_id,
    CAST(paid_at AS DATE) AS stat_date,
    SUM(paid_amount) - SUM(COALESCE(refund_amount, 0)) AS net_amount,
    COUNT(DISTINCT order_line_id) AS line_cnt,
    ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY updated_at DESC) AS rn
  FROM dwd_order_detail
  WHERE paid_at >= TIMESTAMP '{start_time}'
    AND paid_at <  TIMESTAMP '{end_time}'
    AND pay_status = 'PAID'
    AND is_test = 0
  GROUP BY order_id, user_id, channel, store_id, CAST(paid_at AS DATE), updated_at
),
aggregated_${token} AS (
  SELECT
    stat_date,
    channel,
    COUNT(DISTINCT order_id) AS order_cnt,
    COUNT(DISTINCT user_id) AS buyer_cnt,
    SUM(net_amount) AS net_revenue,
    SUM(net_amount) / NULLIF(COUNT(DISTINCT order_id), 0) AS aov
  FROM valid_order_${token}
  WHERE rn = 1 AND net_amount > 0
  GROUP BY stat_date, channel
)
SELECT
  *,
  aov / NULLIF(LAG(aov) OVER (PARTITION BY channel ORDER BY stat_date), 0) - 1 AS aov_change,
  order_cnt * 1.0 / NULLIF(SUM(order_cnt) OVER (PARTITION BY stat_date), 0) AS order_mix
FROM aggregated_${token}
ORDER BY stat_date, channel;`;
}

function clinicalCode(profile) {
  const token = sqlToken(profile.topic);
  return `-- ${profile.topic}：临床事件时间线与异常状态回查
WITH patient_timeline_${token} AS (
  SELECT
    p.patient_uid,
    v.visit_id,
    v.visit_type,
    v.admit_at,
    v.discharge_at,
    e.event_time,
    e.event_type,
    e.encounter_id,
    e.result_value,
    e.unit,
    e.status,
    ROW_NUMBER() OVER (PARTITION BY e.event_id ORDER BY e.updated_at DESC) AS version_no
  FROM dim_patient_master p
  JOIN fact_visit v ON p.patient_uid = v.patient_uid
  LEFT JOIN fact_clinical_event e ON v.visit_id = e.visit_id
  WHERE v.admit_at >= TIMESTAMP '{start_time}'
    AND v.admit_at <  TIMESTAMP '{end_time}'
),
ordered_${token} AS (
  SELECT
    *,
    LAG(event_time) OVER (PARTITION BY visit_id ORDER BY event_time) AS previous_event_at,
    LEAD(event_time) OVER (PARTITION BY visit_id ORDER BY event_time) AS next_event_at
  FROM patient_timeline_${token}
  WHERE version_no = 1
    AND status NOT IN ('cancelled', 'entered-in-error')
)
SELECT
  visit_type,
  event_type,
  COUNT(DISTINCT visit_id) AS visit_cnt,
  COUNT(DISTINCT patient_uid) AS patient_cnt,
  ROUND(AVG(TIMESTAMPDIFF(MINUTE, previous_event_at, event_time)), 2) AS avg_gap_min,
  SUM(CASE WHEN event_time < previous_event_at THEN 1 ELSE 0 END) AS out_of_order_cnt
FROM ordered_${token}
GROUP BY visit_type, event_type
ORDER BY out_of_order_cnt DESC, avg_gap_min DESC;`;
}

function genomicsCode(profile) {
  const token = sqlToken(profile.topic);
  return `# ${profile.topic}：样本、测序和质量控制的最小闭环
from dataclasses import dataclass
from statistics import median

@dataclass(frozen=True)
class ${token.charAt(0).toUpperCase() + token.slice(1)}SampleQC:
    sample_id: str
    assay_version: str
    mean_depth: float
    q30_rate: float
    duplication_rate: float
    variant_count: int
    contamination_rate: float

def evaluate_${token}(samples: list[${token.charAt(0).toUpperCase() + token.slice(1)}SampleQC]) -> dict:
    valid = [
        row for row in samples
        if row.mean_depth >= 30
        and row.q30_rate >= 0.85
        and row.duplication_rate <= 0.25
        and row.contamination_rate <= 0.02
    ]
    return {
        "assay_version": sorted({row.assay_version for row in samples}),
        "input_samples": len(samples),
        "passed_samples": len(valid),
        "median_depth": median(row.mean_depth for row in valid) if valid else None,
        "median_variants": median(row.variant_count for row in valid) if valid else None,
        "failed_sample_ids": sorted(row.sample_id for row in samples if row not in valid),
    }

# 除阈值外还必须保存参考基因组、panel/BED、注释库、转录本和过滤规则版本。`;
}

function technicalCode(profile) {
  const { specialty, topic } = profile;
  const token = sqlToken(topic);
  if (/spark/.test(specialty.family)) {
    return `from pyspark.sql import SparkSession, functions as F

spark = SparkSession.builder.appName("${token}_plan").getOrCreate()
run_date = "2026-11-06"
source_${token} = spark.read.table("${token}_events").where(F.col("dt") == run_date)

key_profile_${token} = (
    source_${token}
    .withColumn("logical_key", F.concat_ws(":", "entity_id", "event_type"))
    .groupBy("logical_key")
    .agg(F.count("*").alias("rows"), F.sum("payload_bytes").alias("bytes"))
)
key_profile_${token}.orderBy(F.desc("bytes")).show(30, truncate=False)

# 调优前先保存 Spark UI 的 Stage、Task 分位数、Shuffle Read/Write 和 spill 基线。
# 只有热点键可拆分且结果满足交换律时，盐化才成立。`;
  }
  if (/kafka|streaming|cdc/.test(specialty.family)) {
    return `from dataclasses import dataclass
from collections import defaultdict

@dataclass(frozen=True)
class PartitionMetric:
    partition: int
    log_end_offset: int
    committed_offset: int
    processed_per_sec: float
    error_rate: float

def diagnose_${token}(rows: list[PartitionMetric]) -> dict:
    enriched = [
        {
            **row.__dict__,
            "lag": row.log_end_offset - row.committed_offset,
            "drain_minutes": round((row.log_end_offset - row.committed_offset) / row.processed_per_sec / 60, 2)
            if row.processed_per_sec > 0 else None,
        }
        for row in rows
    ]
    hot = sorted(enriched, key=lambda item: item["lag"], reverse=True)[:5]
    return {"topic": "${topic}", "total_lag": sum(item["lag"] for item in enriched), "hot_partitions": hot}

# 需要区分生产慢、消费暂停、Rebalance、Broker 异常和下游反压；扩容不是默认答案。`;
  }
  if (/agent|rag|llm|model|ai-/.test(specialty.family)) {
    return `from dataclasses import dataclass, field
from hashlib import sha256

@dataclass
class ${token.charAt(0).toUpperCase() + token.slice(1)}Trace:
    request_id: str
    tenant_id: str
    input_version: str
    evidence_ids: list[str] = field(default_factory=list)
    tool_calls: list[dict] = field(default_factory=list)
    answer: str | None = None
    refusal_reason: str | None = None

def guard_${token}(trace: ${token.charAt(0).toUpperCase() + token.slice(1)}Trace, allowed_docs: set[str], allowed_tools: set[str]) -> dict:
    leaked = sorted(set(trace.evidence_ids) - allowed_docs)
    forbidden = [call["name"] for call in trace.tool_calls if call["name"] not in allowed_tools]
    fingerprint = sha256(f"{trace.tenant_id}|{trace.input_version}|{trace.request_id}".encode()).hexdigest()[:16]
    return {
        "request_id": trace.request_id,
        "fingerprint": fingerprint,
        "allow_answer": not leaked and not forbidden and trace.answer is not None,
        "leaked_evidence": leaked,
        "forbidden_tools": forbidden,
    }`;
  }
  if (/architecture|warehouse|performance/.test(specialty.family)) {
    return `options_${token} = [
    {"name": "batch_core", "fit": 4, "latency": 2, "cost": 4, "operability": 5, "reversibility": 4},
    {"name": "streaming_core", "fit": 5, "latency": 5, "cost": 2, "operability": 2, "reversibility": 2},
    {"name": "hybrid_lakehouse", "fit": 4, "latency": 4, "cost": 3, "operability": 3, "reversibility": 3},
]

weights_${token} = {"fit": 0.35, "latency": 0.20, "cost": 0.20, "operability": 0.15, "reversibility": 0.10}

def score_${token}(option: dict) -> float:
    return round(sum(option[key] * weight for key, weight in weights_${token}.items()), 3)

for candidate in sorted(options_${token}, key=score_${token}, reverse=True):
    print(candidate["name"], score_${token}(candidate))

# 权重来自可解释的约束和访谈，不是为了让预定方案获胜。`;
  }
  return `from datetime import datetime

CONTRACT_${token.toUpperCase()} = {
    "subject": "${topic}",
    "owner": "data-product-owner",
    "grain": "one row per business object per effective state",
    "event_time": "business_event_time",
    "arrival_time": "ingested_at",
    "required_versions": ["schema_version", "rule_version", "source_version"],
    "release_gate": ["object_unique", "state_valid", "reconcile_passed"],
}

def validate_contract_${token}(row: dict) -> list[str]:
    errors = []
    for field in ["object_id", "business_event_time", "ingested_at", "state"]:
        if not row.get(field):
            errors.append(f"missing:{field}")
    if row.get("ingested_at") and row.get("business_event_at"):
        if datetime.fromisoformat(row["ingested_at"]) < datetime.fromisoformat(row["business_event_at"]):
            errors.append("arrival_before_event")
    return errors`;
}

function primaryCode(profile) {
  const family = profile.specialty.family;
  const topicCode = buildTopicCode(profile);
  if (topicCode) {
    const looksSql = /^(--|\/\*|WITH\b|SELECT\b|EXPLAIN\b|CREATE\b|INSERT\b|MERGE\b)/i.test(topicCode.trim());
    return codeFence(looksSql ? "sql" : "python", topicCode);
  }
  if (/finance-metric/.test(family)) return codeFence("python", financeMetricCode(profile));
  if (/finance/.test(family)) return codeFence("sql", financeLedgerCode(profile));
  if (/retail|growth|order/.test(family)) return codeFence("sql", retailMetricCode(profile));
  if (/clinical|medical-it|pharma|medical-imaging/.test(family)) return codeFence("sql", clinicalCode(profile));
  if (/genomics/.test(family)) return codeFence("python", genomicsCode(profile));
  if (/manufactur/.test(family)) {
    return codeFence("sql", manufacturingCode(profile));
  }
  if (/education/.test(family)) return codeFence("sql", educationCode(profile));
  if (/logistics/.test(family)) return codeFence("python", logisticsCode(profile));
  if (/real-estate/.test(family)) return codeFence("python", realEstateCode(profile));
  if (/energy/.test(family)) return codeFence("sql", energyCode(profile));
  if (/agriculture/.test(family)) return codeFence("python", agricultureCode(profile));
  if (/agent|rag|llm|model|ai-|spark|kafka|streaming|cdc|architecture|warehouse|performance|sql|data-service/.test(family)) {
    return codeFence("python", technicalCode(profile));
  }
  return codeFence("sql", genericMetricCode(profile));
}

function manufacturingCode(profile) {
  const token = sqlToken(profile.topic);
  return `-- ${profile.topic}：工单、设备和停机的守恒校验
WITH workorder_${token} AS (
  SELECT
    work_order_id,
    equipment_id,
    process_code,
    shift_id,
    planned_qty,
    good_qty,
    scrap_qty,
    MIN(started_at) AS started_at,
    MAX(finished_at) AS finished_at
  FROM fact_work_order_event
  WHERE business_date = DATE '{business_date}'
    AND process_code = '{${token}_process}'
  GROUP BY work_order_id, equipment_id, process_code, shift_id, planned_qty, good_qty, scrap_qty
),
downtime_${token} AS (
  SELECT
    equipment_id,
    SUM(TIMESTAMPDIFF(MINUTE, started_at, ended_at)) AS downtime_min,
    SUM(CASE WHEN reason_code = 'unplanned' THEN TIMESTAMPDIFF(MINUTE, started_at, ended_at) ELSE 0 END) AS unplanned_min
  FROM fact_equipment_downtime
  WHERE business_date = DATE '{business_date}'
  GROUP BY equipment_id
)
SELECT
  w.equipment_id,
  COUNT(DISTINCT work_order_id) AS order_cnt,
  SUM(planned_qty) AS planned_qty,
  SUM(good_qty) AS good_qty,
  SUM(scrap_qty) AS scrap_qty,
  SUM(good_qty + scrap_qty) - SUM(planned_qty) AS quantity_gap,
  d.downtime_min,
  d.unplanned_min
FROM workorder_${token} w
LEFT JOIN downtime_${token} d USING (equipment_id)
GROUP BY w.equipment_id, d.downtime_min, d.unplanned_min
HAVING ABS(SUM(good_qty + scrap_qty) - SUM(planned_qty)) > 0;`;
}

function educationCode(profile) {
  const token = sqlToken(profile.topic);
  return `-- ${profile.topic}：按学生 cohort 保留课程与结果窗口
WITH cohort_${token} AS (
  SELECT
    s.student_id,
    s.cohort_id,
    s.program_id,
    s.enrolled_at,
    c.course_version,
    a.assessment_id,
    a.score,
    a.passed_flag,
    a.assessed_at,
    ROW_NUMBER() OVER (PARTITION BY a.assessment_id ORDER BY a.updated_at DESC) AS rn
  FROM dim_student s
  JOIN dim_course_enrollment e ON s.student_id = e.student_id
  JOIN fact_assessment a ON e.enrollment_id = a.enrollment_id
  JOIN dim_course c ON e.course_id = c.course_id
  WHERE s.cohort_id = '{cohort_id}'
    AND c.course_version = '{course_version}'
)
SELECT
  program_id,
  course_version,
  COUNT(DISTINCT student_id) AS student_cnt,
  COUNT(DISTINCT assessment_id) AS assessment_cnt,
  AVG(score) AS avg_score,
  AVG(CASE WHEN passed_flag THEN 1.0 ELSE 0.0 END) AS pass_rate,
  SUM(CASE WHEN assessed_at < enrolled_at THEN 1 ELSE 0 END) AS time_order_errors
FROM cohort_${token}
WHERE rn = 1
GROUP BY program_id, course_version;`;
}

function logisticsCode(profile) {
  const token = sqlToken(profile.topic);
  return `# ${profile.topic}：节点时效、异常和成本同时计算
from dataclasses import dataclass
from statistics import mean

@dataclass(frozen=True)
class ${token.charAt(0).toUpperCase() + token.slice(1)}Stop:
    shipment_id: str
    node_id: str
    planned_at: float
    actual_at: float
    cost: float
    exception_code: str | None

def summarize_${token}(rows: list[${token.charAt(0).toUpperCase() + token.slice(1)}Stop]) -> dict:
    delivered = [row for row in rows if row.node_id.endswith("_signed")]
    delays = [row.actual_at - row.planned_at for row in rows if row.actual_at >= row.planned_at]
    exceptions = [row for row in rows if row.exception_code]
    return {
        "stop_count": len(rows),
        "shipment_count": len({row.shipment_id for row in rows}),
        "signed_count": len({row.shipment_id for row in delivered}),
        "avg_delay_minutes": round(mean(delays), 2) if delays else None,
        "exception_rate": round(len(exceptions) / max(len(rows), 1), 4),
        "cost_per_shipment": round(sum(row.cost for row in rows) / max(len({row.shipment_id for row in rows}), 1), 2),
    }`;
}

function realEstateCode(profile) {
  const token = sqlToken(profile.topic);
  return `# ${profile.topic}：项目现金流 IRR 与敏感度
from dataclasses import dataclass

@dataclass(frozen=True)
class ${token.charAt(0).toUpperCase() + token.slice(1)}CashFlow:
    period: int
    amount: float
    category: str

def npv_${token}(cashflows: list[${token.charAt(0).toUpperCase() + token.slice(1)}CashFlow], rate: float) -> float:
    return sum(cf.amount / ((1 + rate) ** cf.period) for cf in cashflows)

def irr_${token}(cashflows, low=-0.99, high=1.0, tolerance=1e-7):
    for _ in range(200):
        mid = (low + high) / 2
        value = npv_${token}(cashflows, mid)
        if abs(value) < tolerance:
            return round(mid, 6)
        if value > 0:
            low = mid
        else:
            high = mid
    raise ValueError("IRR did not converge; inspect cash-flow signs and timing")

# 必须附带土地、建安、税费、融资、销售回款时点和敏感度区间。`;
}

function energyCode(profile) {
  const token = sqlToken(profile.topic);
  return `-- ${profile.topic}：表计边界、负荷与损耗
WITH meter_${token} AS (
  SELECT
    grid_zone,
    meter_id,
    DATE_TRUNC('hour', reading_at) AS reading_hour,
    MAX(CASE WHEN direction = 'in' THEN energy_kwh END) AS energy_in,
    MAX(CASE WHEN direction = 'out' THEN energy_kwh END) AS energy_out,
    ROW_NUMBER() OVER (PARTITION BY meter_id, DATE_TRUNC('hour', reading_at), direction ORDER BY updated_at DESC) AS rn
  FROM fact_meter_reading
  WHERE reading_at >= TIMESTAMP '{start_time}'
    AND reading_at <  TIMESTAMP '{end_time}'
)
SELECT
  grid_zone,
  reading_hour,
  SUM(energy_in) AS input_kwh,
  SUM(energy_out) AS output_kwh,
  SUM(energy_in) - SUM(energy_out) AS loss_kwh,
  (SUM(energy_in) - SUM(energy_out)) / NULLIF(SUM(energy_in), 0) AS loss_rate,
  SUM(energy_in) / NULLIF(SUM(capacity_kw) * 1.0, 0) AS load_factor
FROM meter_${token}
WHERE rn = 1
GROUP BY grid_zone, reading_hour
ORDER BY loss_rate DESC;`;
}

function agricultureCode(profile) {
  const token = sqlToken(profile.topic);
  return `# ${profile.topic}：按地块和批次校验产量
from dataclasses import dataclass
from statistics import mean

@dataclass(frozen=True)
class ${token.charAt(0).toUpperCase() + token.slice(1)}Harvest:
    plot_id: str
    batch_id: str
    planted_area_mu: float
    harvested_area_mu: float
    wet_weight_kg: float
    moisture_rate: float
    standard_moisture: float

def adjusted_yield_${token}(rows: list[${token.charAt(0).toUpperCase() + token.slice(1)}Harvest]) -> list[dict]:
    output = []
    for row in rows:
        dry_weight = row.wet_weight_kg * (1 - row.moisture_rate) / (1 - row.standard_moisture)
        yield_per_mu = dry_weight / row.harvested_area_mu if row.harvested_area_mu else None
        output.append({
            "plot_id": row.plot_id,
            "batch_id": row.batch_id,
            "area_gap": round(row.planted_area_mu - row.harvested_area_mu, 2),
            "standardized_weight_kg": round(dry_weight, 2),
            "yield_kg_per_mu": round(yield_per_mu, 2) if yield_per_mu is not None else None,
        })
    valid = [row["yield_kg_per_mu"] for row in output if row["yield_kg_per_mu"] is not None]
    return {"plots": output, "mean_yield": round(mean(valid), 2) if valid else None}`;
}

function genericMetricCode(profile) {
  const token = sqlToken(profile.topic);
  return `-- ${profile.topic}：业务对象、基线、结构和明细四层诊断
WITH scoped_${token} AS (
  SELECT
    object_id,
    event_id,
    business_time,
    status,
    dimension_1,
    dimension_2,
    numerator_value,
    denominator_value,
    updated_at,
    ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY updated_at DESC) AS version_no
  FROM fact_topic_event
  WHERE business_time >= TIMESTAMP '{start_time}'
    AND business_time <  TIMESTAMP '{end_time}'
    AND subject_code = '${token}'
),
valid_${token} AS (
  SELECT *
  FROM scoped_${token}
  WHERE version_no = 1
    AND status IN ('valid', 'completed')
),
grouped_${token} AS (
  SELECT
    dimension_1,
    dimension_2,
    COUNT(DISTINCT object_id) AS object_cnt,
    SUM(numerator_value) AS numerator_sum,
    SUM(denominator_value) AS denominator_sum,
    SUM(numerator_value) / NULLIF(SUM(denominator_value), 0) AS metric_value
  FROM valid_${token}
  GROUP BY dimension_1, dimension_2
)
SELECT
  *,
  numerator_sum / NULLIF(SUM(numerator_sum) OVER (PARTITION BY dimension_2), 0) AS numerator_mix,
  metric_value - AVG(metric_value) OVER (PARTITION BY dimension_2) AS peer_gap
FROM grouped_${token}
ORDER BY ABS(peer_gap) DESC, object_cnt DESC;`;
}

function validationCode(profile) {
  const { specialty, topic, seed, context } = profile;
  const token = sqlToken(topic);
  const variant = seed % 4;
  const checks = [
    `check_${token}_objects`,
    `reconcile_${token}_population`,
    `trace_${token}_samples`,
    `guard_${token}_release`
  ];
  if (/career|resume/.test(specialty.family)) {
    return `from dataclasses import dataclass

@dataclass
class ${token.charAt(0).toUpperCase() + token.slice(1)}Evidence:
    claim: str
    scope: str
    personal_action: str
    metric: str
    source: str
    limitation: str

def score_${token}(items: list[${token.charAt(0).toUpperCase() + token.slice(1)}Evidence]) -> list[dict]:
    result = []
    for item in items:
        completeness = sum(bool(value.strip()) for value in item.__dict__.values()) / len(item.__dict__)
        result.append({
            "claim": item.claim,
            "evidence_completeness": round(completeness, 3),
            "needs_scope_fix": not item.scope or not item.personal_action,
            "needs_metric_fix": item.metric in {"", "提升很多", "效果显著"},
        })
    return sorted(result, key=lambda row: row["evidence_completeness"])

# 面试前逐条核对：数字来源、时间窗、个人边界、失败处理和可复跑材料。`;
  }
  if (/learning/.test(specialty.family)) {
    return `from collections import defaultdict
from datetime import date, timedelta

practice_${token} = defaultdict(list)

def schedule_review_${token}(learned_on: date, first_score: float) -> list[dict]:
    intervals = [1, 3, 7, 14, 30] if first_score >= 0.8 else [1, 2, 4, 7, 14]
    return [
        {"review_on": learned_on + timedelta(days=days), "task": "retrieve_without_notes", "target_score": 0.85}
        for days in intervals
    ]

def learning_gate_${token}(records: list[dict]) -> dict:
    attempted = len(records)
    transferred = sum(record.get("variant_passed", False) for record in records)
    explained = sum(record.get("explained_without_notes", False) for record in records)
    return {"attempted": attempted, "transfer_rate": transferred / max(attempted, 1), "explanation_rate": explained / max(attempted, 1)}

# 只有变式练习、口头解释和可复跑作品同时通过，才进入下一阶段。`;
  }
  return `from dataclasses import dataclass

@dataclass(frozen=True)
class ${token.charAt(0).toUpperCase() + token.slice(1)}Batch:
    batch_id: str
    source_rows: int
    valid_rows: int
    duplicate_keys: int
    missing_time_rows: int
    reconciliation_gap: float

def ${checks[variant]}(batch: ${token.charAt(0).toUpperCase() + token.slice(1)}Batch) -> dict:
    checks = {
        "source_rows_positive": batch.source_rows > 0,
        "valid_rows_not_above_source": 0 <= batch.valid_rows <= batch.source_rows,
        "duplicate_rate_ok": batch.duplicate_keys / max(batch.source_rows, 1) <= ${(0.0005 + (seed % 5) * 0.0002).toFixed(4)},
        "time_completeness_ok": batch.missing_time_rows / max(batch.source_rows, 1) <= ${(0.002 + (seed % 4) * 0.001).toFixed(3)},
        "reconciliation_ok": abs(batch.reconciliation_gap) <= ${Number(0.01 + (seed % 4) * 0.01).toFixed(2)},
    }
    return {
        "topic": "${topic}",
        "batch_id": batch.batch_id,
        "checks": checks,
        "release_allowed": all(checks.values()),
        "failed_checks": [name for name, passed in checks.items() if not passed],
        "topic_controls": ${JSON.stringify(context.controls.slice(0, 3))},
    }`;
}

function contractCode(profile) {
  const token = sqlToken(profile.topic);
  return codeFence("yaml", `contract: ${token}
title: "${profile.topic}"
owner:
  business: "${profile.context.participants[0]}"
  data: "data-product-owner"
  technical: "pipeline-owner"
grain: "one row per business object and effective state"
time_fields:
  business_event: "${profile.context.dateField}"
  ingested: "ingested_at"
  effective_from: "valid_from"
quality_gates:
  - object_key_unique
  - required_state_allowed
  - numerator_denominator_reconciled
  - source_to_target_count_balanced
versions:
  schema: required
  rule: required
  source: required
failure_policy:
  block_downstream: true
  rollback_partition: true
  notify_owner_minutes: 30`);
}

function implementationSteps(profile) {
  const { specialty, context, topic, seed } = profile;
  const play = familyPlay(specialty);
  const steps = [
    `写出“${topic}”的一句话定义、反向排除项和不适用场景，并让${context.participants[0]}与数据负责人签字确认。`,
    `画出${specialty.workflow.slice(0, 5).join(" → ")}流程图，为每一步标出输入、输出、状态、系统、责任人和时间戳。`,
    `为${context.entities.slice(0, 4).map(([name]) => name).join("、")}建立对象表，声明主键、历史有效期、删除语义和敏感等级。`,
    `在${specialty.systems.slice(0, 5).join("、")}之间建立字段级血缘，至少能回答一个字段变更会影响哪些结果。`,
    `实现${play.evidence.slice(0, 4).join("、")}的自动校验；阻断项、告警项和观察项分别管理。`,
    `设计正常、边界、重复、延迟、权限拒绝五类测试，保留输入快照、执行版本、输出摘要和责任记录。`,
    `按${context.dims.slice(0, 3).join("、")}做一次结构与基线分析，确认总量变化不是对象结构或口径切换造成。`,
    `发布前完成源目标对账、抽样回查、回滚演练和下游通知；发布后按周观察主指标及${context.metricDefs[1]?.[0] || "护栏指标"}。`,
    `复盘时区分定义错误、源数据错误、计算错误、展示错误和业务变化，把改进项转成带负责人和期限的任务。`
  ];
  return steps.slice(seed % 3 === 0 ? 0 : 0);
}

function familyMechanismSection(profile) {
  const play = familyPlay(profile.specialty);
  const ctx = profile.context;
  return `### 机制拆解

${profile.topic}的第一层机制是：${play.mechanism}。这个定义意味着，讨论工具前必须先回答数据对象和状态，否则同一张表里会混入事件、快照和结果三种粒度。

第二层机制是把${profile.specialty.workflow.slice(0, 5).join("、")}连成状态链。正常记录必须满足时间顺序、状态可达和对象关联；金额或数量要有守恒关系；比例要保留分子和分母。任何一项无法解释，都不能用“业务波动”代替排查。

第三层机制是证据。围绕本主题优先收集${play.evidence.join("、")}，并绑定版本、责任人与观察窗口。工具只是执行这些证据的载体，不能替代业务确认。`;
}

function buildTitleSpecificArticle(profile) {
  const { context, specialty, topic, seed } = profile;
  const play = familyPlay(specialty);
  const orderedStyles = CASE_STYLES
    .map((style, index) => ({ style, score: hashNumber(`${profile.relativePath}:${style.key}`) + index }))
    .sort((left, right) => left.score - right.score)
    .map((entry) => entry.style);
  const styles = orderedStyles.slice(0, 4);
  const sourceItems = specialty.sources || [];
  const label = familyTitle(specialty);
  return `# ${profile.title}

> [!abstract] ${label}速览
> ${definitionParagraph(profile)}

## 1. ${topic}｜先把名词还原成业务问题

${definitionParagraph(profile)}

理解“${topic}”时，建议先排除三个假问题：第一，不要先问“用什么工具”，先问业务对象的粒度是什么；第二，不要只问“有没有数据”，先确认数据是否覆盖业务发生、状态变化和最终结果；第三，不要把“能够计算”当作“可以决策”，必须说明谁会使用结果以及失败后如何处置。

${semanticTable(profile)}

## 2. ${topic}｜对象、流程与系统边界

${familyMechanismSection(profile)}

### 对象模型

${objectModelTable(profile)}

系统链路可以概括为：${specialty.systems.slice(0, 6).join(" → ")}。每一跳都要区分业务事件发生时间、数据可见时间和下游行动时间。将三者混为一个“更新时间”，是“${topic}”专题最常见、也最容易被报表掩盖的问题之一。

### 指标与证据

${metricEvidenceTable(profile)}

口径字典至少包含中文名、英文编码、业务定义、公式、事实粒度、时间字段、范围、排除条件、版本、负责人和验收样例。若本主题不是指标，也应把状态、数量、质量和时效写成同等严格的可观测项。

## 3. ${topic}｜${styles[0].title}

${caseNarrative(profile, styles[0], 0)}

## 4. ${topic}｜可执行的数据实现

下面代码重点不是“跑出一条数”，而是把对象、时间、状态、去重和对账写进同一条可复查路径。表名、字段名和日期参数均为示例，落地时应映射到企业的数据字典与权限体系。

${primaryCode(profile)}

代码评审时至少追问六个问题：主键是否唯一？业务时间和入仓时间是否分开？删除和撤销如何处理？重跑是否幂等？金额或数量是否守恒？结果能否回到原始记录？

## 5. ${topic}｜${styles[1].title}

${caseNarrative(profile, styles[1], 1)}

这个案例的判断顺序可以复用为：

1. 先确认异常是否真实，排除分区、状态、版本和权限造成的假异常。
2. 再确认对象范围、时间窗和维度归属是否可比。
3. 按${context.dims.slice(0, 4).join("、")}做结构贡献和基线比较。
4. 抽取正常、边界和异常样本回查${play.evidence.slice(0, 3).join("、")}。
5. 最后才讨论模型、策略或工具参数，并保留反例和护栏指标。

## 6. ${topic}｜发布门禁与失败样本

${codeFence("python", validationCode(profile))}

自动检查只能发现已定义的问题。为了避免“规则全过、业务仍不可用”，还需要抽样评审和异常回放。建议把问题分为阻断、严重、观察和探索四级：涉及资金、患者安全、身份、监管或核心经营发布的问题应阻断；趋势波动先记录，不立即制造噪声告警。

## 7. ${topic}｜${styles[2].title}

${caseNarrative(profile, styles[2], 2)}

如果团队准备行动，应先写出一张决策卡：

| 决策项 | 本主题需要写清的内容 | 证据 |
| --- | --- | --- |
| 触发条件 | “${topic}”达到什么阈值、连续多久或影响哪些对象时进入决策 | 基线、阈值版本、样本量 |
| 可选动作 | ${play.decisions.join("、")} | 业务规则、成本和权限 |
| 预期结果 | 主指标改善，且${context.controls.slice(0, 3).join("、")}不恶化 | 指标字典与观察窗口 |
| 停止条件 | 错误扩大、样本不足、成本超限或出现高危副作用时停止 | 回滚条件与审批记录 |
| 复盘责任 | 谁在什么时间解释动作、结果和副作用 | 责任矩阵与复盘模板 |

## 8. ${topic}｜${styles[3].title}

${caseNarrative(profile, styles[3], 3)}

失败路径尤其值得记录。围绕“${topic}”，至少保留一次失败回放：输入缺失、主键重复、状态非法、算法或参数切换、权限拒绝、下游读取失败。只有团队能在不依赖原作者的情况下复现并修复，才算真正具备运行能力。

## 9. ${topic}｜数据合约与交付边界

${contractCode(profile)}

合约不是一张静态文档，而是源系统、数据开发、下游消费者和责任人之间的运行约定。表结构可以兼容演进，但业务定义、粒度和状态语义一旦变化，必须有版本、影响分析、迁移方案和消费者确认。

发布检查至少包括：

- 字段、主键、时间、状态、删除语义和敏感等级已登记。
- 关键任务有输入输出计数、分区覆盖、幂等重跑和回滚方案。
- 规则阈值有业务依据，失败时知道由谁在多久内处理。
- 血缘能回溯到源字段，并能在变更前识别受影响结果。
- 权限按用途最小化，访问、导出和规则豁免有审计记录。
- 主指标、护栏指标、观察窗口和停止条件在发布前已经确定。

## 10. ${topic}｜落地计划、自测与复盘

| 阶段 | 交付物 | 验收问题 |
| --- | --- | --- |
| 定义 | 业务说明、对象与粒度、口径字典 | 换一个人能否得到同一结论 |
| 建模 | 事实、维度、快照、状态和版本设计 | 事件、状态和结果是否混用 |
| 开发 | SQL/Python、参数、日志和血缘 | 重跑是否幂等，失败可否恢复 |
| 验证 | 对账、抽样、边界和权限测试 | 总量、分组和明细能否互相解释 |
| 发布 | 灰度、监控、回滚和通知 | 异常由谁在多长时间内处置 |
| 运营 | 采用记录、主指标、护栏和复盘 | 结果是否支持真实行动且无严重副作用 |

${implementationSteps(profile).map((step, index) => `${index + 1}. ${step}`).join("\n")}

> [!check] 自测
> 不看全文，用 90 秒说明“${topic}”的：①一行数据代表什么；②${play.evidence.slice(0, 3).join("、")}如何证明结果；③如果结果出现 20% 变化，你先查哪三类问题；④哪类错误必须阻断发布；⑤上线后由谁在多长时间内完成复盘。

> [!warning] 内容与使用边界
> 本文为原创方法型内容，不复制任何付费文章的隐藏正文。案例组织、规模和结果均为脱敏或复合示例，不对应单一企业事实。真实项目必须以获授权数据、企业口径、现行法规和有权审批人的结论为准。

## 公开资料与进一步阅读

${sourceItems.map(([name, url]) => `- [${name}](${url})`).join("\n")}
- 与“${topic}”相关的企业数据字典、行业标准、产品版本说明和内部评审记录；使用前核对更新日期、适用范围和限制。

本文采用的判断框架还参考了指标定义、数据质量、血缘、权限、实验评估和可观测性的通用公开实践。搜索资料时建议优先选择标准组织、监管机构、产品官方文档和可复核的案例，不把营销软文或单一博客结论当作生产依据。
`;
}

module.exports = {
  buildTitleSpecificArticle,
  familyPlay,
  sqlToken,
  titleSegments
};
