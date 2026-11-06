const { BATCH_2_SPECS } = require("./title-blueprint-batch2");
const { BATCH_3_SPECS } = require("./title-blueprint-batch3");

const SPECS = [
  {
    title: "院内制剂",
    domain: "医疗机构制剂",
    thesis: "院内制剂不是普通的“医院自制药品”，而是由医疗机构依据临床需要、经过准入与配制管理、按批次检验放行，并只在规定使用范围内流转的制剂产品。数据工作的重点，是让处方、原辅料、配制过程、检验结果、放行结论和临床使用能够按批次互相追溯。",
    boundary: "纳入本篇的对象是取得相应资质后为本机构或规定范围配制和使用的制剂；不把院内协定处方、临方炮制、普通药品采购和未经批准的跨机构销售混在一起。",
    notFor: "不能把制剂批号当成普通商品 SKU，也不能用药品采购入库量代替实际配制、放行和临床使用量。",
    decision: "业务最终要决定的是：这一批能否放行、是否允许继续使用、是否需要召回或限制科室领用，以及哪个环节必须补充调查。",
    process: [
      ["临床需求与品种准入", "提出临床需求、处方依据、适用人群和风险说明", "品种准入表、处方依据、伦理或药事审议记录"],
      ["配制资质与备案/批准核对", "核对机构、制剂室、配制范围和批准状态", "批准或备案凭证、品种目录、有效期"],
      ["原辅料与包材准入", "确认供应商、批号、检验报告、贮存条件和有效期", "来料验收、供应商证照、物料放行记录"],
      ["配制与批记录", "按处方工艺执行称量、配制、灌装或分装并留痕", "批生产记录、设备参数、操作人复核人"],
      ["检验与质量放行", "按标准完成鉴别、含量、微生物或装量等检验", "取样记录、检验原始数据、OOS/OOT 调查"],
      ["标签包装与储存", "核对品名、规格、批号、有效期和使用范围", "标签样张、包装复核、库房温湿度"],
      ["临床使用与反馈", "限定科室、用途和观察要求，收集不良反应与质量问题", "领用记录、医嘱关联、反馈和召回记录"]
    ],
    objects: [
      ["制剂品种", "preparation_master_id", "一个获批或备案的处方、规格与用途组合"],
      ["配制批次", "preparation_batch_id", "一次完整配制过程及对应批记录"],
      ["原辅料批号", "material_lot_id", "供应商批次与内部验收批次的映射"],
      ["检验样本", "qc_sample_id", "一次取样、检验方法和结果版本"],
      ["放行记录", "release_id", "允许或拒绝用于指定范围的质量结论"],
      ["临床领用", "dispense_id", "科室或患者使用数量及批号关联"]
    ],
    metrics: [
      ["批次首次检验合格率", "首次检验合格批次数 / 已检验批次数", "首次检验与复验必须分开，OOS 不能直接删除"],
      ["批次放行及时率", "在承诺时限内完成质量放行的批次数 / 应放行批次数", "起止时间要统一到配制结束和放行批准"],
      ["批记录完整率", "关键字段和双人复核完整的批次 / 应检查批次", "电子签名、补录和纸质扫描要区分"],
      ["有效期内报废率", "非质量原因报废数量 / 期初加本期配制的可用数量", "不能把召回、检验消耗和正常留样混入报废"],
      ["不良反应关联及时率", "在规定时限内完成批次回查的反馈数 / 需关联批次的反馈数", "只有时间、患者和批次均能关联时才计为完成"]
    ],
    cases: [
      {
        title: "新增品种从临床申请到首批放行",
        trigger: "临床科室提出一个常用协定处方的配制需求，信息系统中只有药品通用名，没有独立品种编码。",
        investigation: "药事管理、制剂室和质量部门把处方依据、配制范围、规格、包装材料、检验项目和标签样张逐项对齐，并将批准状态设为使用前置条件。",
        action: "建立品种主数据与版本表；首批配制使用专批记录模板，原辅料、设备清洁、称量复核、取样和检验结果都以批次键关联。",
        lesson: "首批放行不是“检验合格”四个字，而是批准范围、物料、工艺、标签和检验证据全部满足；任何一项缺失都应阻断领用。"
      },
      {
        title: "同一原辅料供应商换批后含量波动",
        trigger: "连续两个配制批次的含量接近下限，但每批检验都被判为合格。",
        investigation: "将原辅料供应商批次、实际投料量、水分、配制设备、操作班组、检验方法版本和库存贮存时长放在同一批次视图，发现来料含水量偏高且库龄较长。",
        action: "把供应商批次和内部验收批号绑定；对含水量建立收窄的预警区间；在工艺参数未变时先复核物料与贮存条件，不直接调整成品标准。",
        lesson: "趋势贴限不等于合格即可忽略。统计预警和质量放行要并行，不能为了减少偏差把所有波动写进“正常范围”。"
      },
      {
        title: "检验结果为 OOS 时的批次链条回放",
        trigger: "某批微生物检验不合格，现场认为可能是取样问题，要求复验后直接放行。",
        investigation: "先冻结批次和关联原辅料，回查取样环境、样品运输、培养基批次、检验设备、对照结果和历史趋势，并区分实验室差错与产品质量问题。",
        action: "禁止用复验覆盖原结果；建立 OOS 调查对象、原因分类、影响范围和最终处置。只有调查结论、质量负责人批准和纠正措施均完成才允许改变批次状态。",
        lesson: "复验可以补充证据，但不能替原结果“改分”。数据表必须保留原值、复验值和调查版本。"
      },
      {
        title: "标签规格相近造成领用风险",
        trigger: "两个不同规格制剂的包装标签颜色和文字非常接近，门诊药房反馈容易拿错。",
        investigation: "把品种、规格、批号、包装版本、库位、标签样张和实际领用记录关联，检查人工选码、扫码和复核节点。",
        action: "从数据侧增加品种规格组合唯一约束和扫码校验；标签版本变更进入审批；对高风险相似品种设置物理隔离和双人复核。",
        lesson: "标签错误不是单纯界面问题，最终要看是否能把错误标签追溯到具体批次、库位和领用环节，并阻断在患者使用前。"
      },
      {
        title: "临期批次与科室领用不均",
        trigger: "库房出现多批临期制剂，同时部分科室反映领用不足。",
        investigation: "区分可放行库存、已预留库存、检验留样、冻结批次和实际消耗；按品种、批号、有效期和科室计算可领用天数。",
        action: "建立近效期预警和先进先出建议，但不自动把冻结或未放行库存算作可用库存；科室调拨需保留原因和批准。",
        lesson: "库存周转改善不能以使用临期或不合格批次为代价。数据必须同时展示可用量、缺货风险和报废风险。"
      },
      {
        title: "临床反馈与批次追溯断链",
        trigger: "临床报告疑似不适反应，但反馈表只记录制剂名称，无法确认患者实际使用了哪个批次。",
        investigation: "回到领用单、药房发药、护理执行、患者用药记录和批号标签，判断是业务未采集还是数据未关联。",
        action: "将反馈的必填项改为品种加批号，补充无法追溯的原因码；质量团队按批次统计反馈率，并设置集中爆发的调查触发规则。",
        lesson: "不良反应反馈的核心不是“有没有登记”，而是能否在可控时间内冻结相关批次、通知使用科室并判断是否需要扩大回查。"
      },
      {
        title: "跨院区需求与合规边界",
        trigger: "集团内另一院区希望共享某制剂，要求把库存和处方数据直接打通。",
        investigation: "先核对双方机构资质、制剂批准使用范围、处方与标签是否一致、运输储存条件和质量责任，再讨论数据接口。",
        action: "在品种主数据中记录允许使用的机构范围；接口只提供经批准的目录与可调剂库存，跨范围请求默认拒绝并留审计记录。",
        lesson: "系统能传输不等于业务允许。合规范围必须成为数据规则和接口契约的一部分，而不是靠操作人员记忆。"
      }
    ],
    code: {
      table: "hospital_preparation_batch",
      key: "preparation_batch_id",
      eventTime: "compounded_at",
      status: "release_status",
      dimensions: ["preparation_id", "preparation_room_id", "dosage_form", "batch_no"],
      numerator: "SUM(CASE WHEN first_pass_qc THEN 1 ELSE 0 END)",
      denominator: "COUNT(DISTINCT preparation_batch_id)",
      threshold: "0.98",
      controlTable: "preparation_material_lot",
      controlKey: "material_lot_id",
      controlField: "qualified_qty"
    },
    failures: [
      ["批准范围未进入系统", "只维护药品名称，不维护允许机构和用途", "审批文件与品种主数据版本", "范围外请求默认阻断"],
      ["原结果被复验覆盖", "数据库只保留最终合格值", "原始值、复验值、OOS 调查和签字", "保留全部版本并记录放行依据"],
      ["可用库存虚高", "冻结、留样和待检库存仍参与领用", "按状态拆分的库存快照", "未放行批次不得释放库存"],
      ["批次断链", "原辅料、配制、检验使用不同编号", "批次谱系与来源目标计数", "无法追溯时停止放行并回查"]
    ],
    references: [
      ["国家药品监督管理局", "https://www.nmpa.gov.cn/"],
      ["国家卫生健康委员会", "http://www.nhc.gov.cn/"],
      ["国家药品监督管理局药品审评中心", "https://www.cde.org.cn/"]
    ]
  },
  {
    title: "胸部CT",
    domain: "医学影像检查",
    thesis: "胸部 CT 的数据主线不是一张“检查结果表”，而是从检查申请、预约、扫描协议、图像序列、重建、报告审核到危急值反馈的一条临床证据链。患者、就诊、检查申请、Study、Series 和 Instance 是不同层级，任何分析都必须先确定粒度。",
    boundary: "本篇讨论常规胸部 CT 检查的运营、质量与信息链路；不把 CT 图像诊断等同于简单分类模型，也不将影像 AI 输出直接替代放射科医师报告。",
    notFor: "不能把一次检查申请、一次扫描、一个序列和一张图像当成同一条记录；也不能用报告发布时间代替检查完成时间。",
    decision: "临床和数据团队要判断：检查是否按时完成、图像是否满足协议、报告是否及时审核、危急发现是否闭环，以及设备和流程异常是否影响患者安全。",
    process: [
      ["申请与适应证核对", "记录临床问题、检查部位、对比剂和风险信息", "申请单、过敏史、肾功能与知情记录"],
      ["预约与患者准备", "确认身份、注意事项、妊娠和金属植入物等信息", "预约号、到检时间、患者核对记录"],
      ["扫描与协议执行", "按部位和临床目的选择协议并记录剂量参数", "Study/Series UID、设备、协议版本、剂量指标"],
      ["图像重建与归档", "完成重建、质控、PACS 归档和可用性检查", "Instance 数量、重建序列、归档状态"],
      ["阅片与报告", "初诊、复审、结构化报告和电子签名", "报告版本、审阅人、签发时间"],
      ["危急结果通知", "确认接收人、通知时间和临床处置", "危急值记录、回读、处置反馈"],
      ["随访与质量复盘", "复核重复检查、报告修正、投诉和诊断一致性", "随访、修订报告、质量指标"]
    ],
    objects: [
      ["检查申请", "accession_number", "一次检查医嘱与执行申请"],
      ["检查 Study", "study_instance_uid", "一次影像检查及包含的全部序列"],
      ["图像 Series", "series_instance_uid", "同一协议或重建类型的序列"],
      ["图像 Instance", "sop_instance_uid", "单张图像或对象"],
      ["报告", "diagnostic_report_id", "含版本、签名和审核状态的报告"],
      ["剂量记录", "dose_event_id", "扫描范围、参数和剂量指标"]
    ],
    metrics: [
      ["检查预约到完成时长", "扫描完成时间 - 预约时间", "按急诊、门诊、住院和检查类型拆分"],
      ["报告 P90 周转时长", "报告签发时间 - 检查完成时间", "使用分位数，均值会掩盖长尾"],
      ["二次扫描发生率", "发生非计划二次扫描的检查数 / 完成检查数", "需排除临床计划内的分期或增强补充"],
      ["图像归档完整率", "归档 Instance 数达到协议预期的 Study 数 / 应归档 Study 数", "用协议预期而非固定图像数"],
      ["危急结果闭环率", "完成接收与处置记录的危急结果数 / 危急结果数", "发送不等于接收，接收不等于处置"]
    ],
    cases: [
      {
        title: "报告及时率突然下降",
        trigger: "管理层看到胸部 CT 报告及时率下降，但扫描量没有明显增加。",
        investigation: "按院区、班次、设备、检查类型和报告医师拆解；核对 RIS 完成时间、PACS 归档时间与报告签发时间，发现夜间重建队列积压。",
        action: "将报告时延拆为扫描后待归档、待分配、初诊、复审和签发五段，建立 P90 与超时清单。",
        lesson: "平均值掩盖了夜班长尾；流程要按时段和分位数管理，而不是只报一个及时率。"
      },
      {
        title: "同一检查出现重复 Study",
        trigger: "PACS 中同一患者短时间出现多个 Study，统计检查量时被重复计算。",
        investigation: "检查患者 ID、申请号、Study UID、设备、开始时间和影像内容，判断是重新登记、补扫还是系统重发。",
        action: "以申请号和临床事件建立 Study 关系；统计口径区分检查申请、扫描 Study 和有效报告，不直接删除异常记录。",
        lesson: "重复记录是重要质量信号。先分类原因，再决定分析口径，不能为了报表好看直接去重。"
      },
      {
        title: "剂量偏高设备的协议核验",
        trigger: "某台设备胸部 CT 的剂量指标明显高于同型号设备。",
        investigation: "按患者体型、扫描范围、协议版本、重建方式和设备校准记录分层，排除病例结构差异后检查协议参数。",
        action: "建立协议版本和设备基线，对超出同组分布且无临床理由的检查触发复核；不直接按单次高值处罚操作人员。",
        lesson: "剂量是比较问题，不是孤立阈值问题；必须同时考虑体型、适应证、图像质量和设备差异。"
      },
      {
        title: "影像 AI 提示肺结节后的责任边界",
        trigger: "AI 标记一个高关注结节，但初版报告未提及。",
        investigation: "核对 AI 模型版本、输入序列、置信度、阈值和阅片记录，确认是否存在人工忽略、图像不完整或模型误报。",
        action: "将 AI 结果定位为辅助提示；高风险提示必须由医师复核，保留采纳或不采纳原因，并进入质量回顾。",
        lesson: "模型输出不能直接写进报告结论。必须保存模型版本、输入证据和医师最终判断。"
      },
      {
        title: "危急值通知回读失败",
        trigger: "危急结果已发送消息，但临床端没有回读记录。",
        investigation: "关联报告、通知渠道、发送时间、接收账号、回读时间和临床处置记录，检查值班表与账号映射。",
        action: "建立多级升级：主接收人超时转备用人员，仍未回读则电话通知并登记；未闭环事件进入质量管理。",
        lesson: "“已发送”不是闭环。闭环必须包含接收者确认、临床行动与复核证据。"
      },
      {
        title: "增强 CT 过敏史字段缺失",
        trigger: "部分增强检查在预约时没有结构化记录过敏史。",
        investigation: "区分未询问、阴性、患者无法回答和系统未写入四种情况，检查表单、接口和权限。",
        action: "增加未知状态，禁止把空值默认为无过敏；对增强检查设置预约完成前阻断，同时保留急救流程。",
        lesson: "空值不是阴性。医疗数据尤其要区分“没有发生”“没有采集”和“明确否认”。"
      },
      {
        title: "设备停机与报告超时同时发生",
        trigger: "某周报告及时率下降，团队最初归因于医师不足。",
        investigation: "接入设备状态、现场工单、扫描时长、重建队列和排班；发现停机后补扫集中于夜间，复审资源没有同步增加。",
        action: "把设备事件与检查链路统一时间轴；按停机影响范围预测后续积压，并提前调整审核排班。",
        lesson: "运营指标异常往往跨系统。只有把设备和人员事件接到同一时间轴，才能解释长尾。"
      }
    ],
    code: {
      table: "ris_imaging_study",
      key: "study_instance_uid",
      eventTime: "study_started_at",
      status: "study_status",
      dimensions: ["facility_id", "modality", "body_part", "protocol_version"],
      numerator: "SUM(CASE WHEN report_signed_at <= scan_completed_at + INTERVAL '2 hours' THEN 1 ELSE 0 END)",
      denominator: "COUNT(DISTINCT study_instance_uid)",
      threshold: "0.95",
      controlTable: "pacs_instance_manifest",
      controlKey: "series_instance_uid",
      controlField: "archived_instance_count"
    },
    failures: [
      ["Study 与申请混算", "一个申请关联多个 Study 时直接计数", "申请号、Study UID 与报告唯一关系", "报表必须标明粒度和去重键"],
      ["时间语义错误", "报告时间减预约时间代替周转时长", "扫描完成、归档、初诊、复审和签发节点", "每个指标绑定明确起止事件"],
      ["图像完整性作假", "按固定图像数判断归档完整", "协议预期序列与影像对象清单", "不完整 Study 不进入可用结论"],
      ["AI 责任不清", "模型结果未经复核直接进入报告", "模型版本、输入序列与人工判断记录", "高风险提示必须人工确认"]
    ],
    references: [
      ["DICOM Standards", "https://www.dicomstandard.org/"],
      ["HL7 FHIR ImagingStudy", "https://hl7.org/fhir/imagingstudy.html"],
      ["Radiological Society of North America", "https://www.rsna.org/"]
    ]
  },
  {
    title: "原研药",
    domain: "创新药与原创产品",
    thesis: "原研药的核心是首个完成完整研发和注册证据链、获得上市批准的原创药品。数据工作不能只记录商品名和价格，而要把化合物或生物制品、适应证、临床试验、批准范围、批次、安全性、专利与市场准入放在同一条生命周期中。",
    boundary: "本篇把原研药视为具有原创研发和监管批准证据的产品，不把任何先上市的品牌药、进口药或高价格药自动认定为原研药。",
    notFor: "不能用商品名唯一识别产品，也不能仅凭专利到期、价格高低或市场份额判断其原研属性。",
    decision: "研发、医学、准入和供应团队要判断：证据是否支持继续研发、注册和适应证扩展，产品能否在特定市场供应，以及安全性信号是否需要更新说明。",
    process: [
      ["靶点与候选物评估", "形成作用机制、成药性和差异化假设", "研究方案、实验记录、候选物版本"],
      ["非临床研究", "完成药理、毒理和药代等证据", "研究报告、动物批次、质量数据"],
      ["临床试验申请与实施", "按阶段验证安全性、剂量和有效性", "方案版本、入排、受试者、不良事件和偏离"],
      ["注册申报与审评", "提交质量、非临床和临床证据并回应问询", "申报包、审评问题、批准范围"],
      ["商业化生产与供应", "确认工艺验证、批放行和供应链连续性", "批记录、放行、稳定性、库存"],
      ["上市后安全与生命周期", "持续监测不良反应、新证据和适应证变化", "个例报告、信号、说明书版本"]
    ],
    objects: [
      ["药品主数据", "medicinal_product_id", "活性成分、剂型、规格和批准持有人"],
      ["临床试验", "clinical_trial_id", "方案版本、阶段、适应证和研究中心"],
      ["受试者暴露", "subject_exposure_id", "受试者在某阶段的实际用药暴露"],
      ["批准与说明书", "regulatory_approval_id", "国家、适应证、版本和有效期"],
      ["商业批次", "commercial_batch_id", "生产、放行和供应批次"],
      ["安全事件", "safety_case_id", "个例安全报告及因果关系评估"]
    ],
    metrics: [
      ["试验入组达成率", "实际入组合格受试者数 / 计划入组数", "必须按中心、阶段和时点，不用筛选人数代替"],
      ["方案偏离发生率", "发生至少一次重要方案偏离的受试者数 / 已入组受试者数", "偏离严重程度和是否影响主要终点要单列"],
      ["批放行一次通过率", "首次放行合格的商业批次 / 提交放行的批次", "稳定性、检验和文档缺陷要分类"],
      ["安全报告按时率", "在监管时限内提交的有效个例报告 / 应提交报告", "起算时间与报告完整性要同时检查"],
      ["适应证覆盖完整率", "已映射到标准适应证和批准版本的记录 / 应映射记录", "不能用自由文本直接做跨市场比较"]
    ],
    cases: [
      {
        title: "全球试验与本地注册口径不一致",
        trigger: "总部试验数据库和本地注册资料中的适应证名称、剂量组和主要终点定义不一致。",
        investigation: "建立试验、方案版本、国家、监管词典和批准适应证映射，逐项比较版本生效时间。",
        action: "保留原始值和标准映射值；任何注册结论都引用具体方案版本和监管词典版本。",
        lesson: "同名不一定是同定义。跨市场分析先确认版本和适用人群，再比较结果。"
      },
      {
        title: "入组速度看似正常但合格率下降",
        trigger: "某中心月度入组数达标，但随机化后退出和方案偏离上升。",
        investigation: "把筛选、合格、入组、暴露、随访和退出分层，发现筛查标准执行偏差集中在少数研究团队。",
        action: "将入组和质量指标并列，补充中心培训与源数据核查；不按总人数奖励导致质量下降。",
        lesson: "只考核数量会诱导错误行为。研发指标必须带质量护栏。"
      },
      {
        title: "批次供应链事件",
        trigger: "某商业批次出现包装缺陷，供应团队需要判断受影响市场与替代库存。",
        investigation: "按批次、包装线、放行市场、库存位置和发货记录建立正向与反向追溯。",
        action: "冻结相关批次，区分仍可安全使用、需要召回和仅标签整改的范围，并同步医学与监管沟通。",
        lesson: "供应链数据必须能回答“这一批去了哪里、哪些患者可能暴露、还有哪些替代库存”。"
      },
      {
        title: "说明书版本更新后的历史数据比较",
        trigger: "说明书新增安全性信息后，运营仍用旧适应证范围统计使用量。",
        investigation: "为说明书和批准适应证建立有效期，按事件发生时间关联当时版本。",
        action: "所有安全和使用分析使用时点正确版本，并标记跨版本不可直接比较的区间。",
        lesson: "监管文本也是维度。用当前说明书回溯历史，会产生看似精确但语义错误的结论。"
      },
      {
        title: "安全信号回顾中的分母问题",
        trigger: "某不良事件报告数增加，被误判为风险显著上升。",
        investigation: "同时核对暴露人数、报告来源、报告完整度、上市时间和媒体关注；区分报告率与真实发生率。",
        action: "建立报告来源和时间趋势分层，注明自发报告无法直接计算发生率，交由药物警戒专业评估。",
        lesson: "报告数不是发生率。数据团队必须阻止把被动报告直接包装成因果关系。"
      },
      {
        title: "专利到期后的产品识别",
        trigger: "采购数据用商品名变化判断原研药是否被仿制药替代。",
        investigation: "核对活性成分、批准持有人、批准文号、剂型规格和医保支付规则，而非只看名称。",
        action: "建立产品-批准-商品名-包装多级映射，并保留时间有效期。",
        lesson: "商业名称会变，产品与监管身份不能随之丢失。"
      },
      {
        title: "研究数据共享与隐私边界",
        trigger: "跨机构分析希望直接共享受试者级原始数据。",
        investigation: "确认知情同意范围、数据使用协议、去标识化程度、跨境要求和最小必要字段。",
        action: "优先使用汇总或受控环境分析；申请流程、访问日志和销毁规则进入数据契约。",
        lesson: "能分析不等于能复制。受试者数据共享必须由授权、用途和审计共同限定。"
      }
    ],
    code: {
      table: "clinical_subject_visit",
      key: "subject_visit_id",
      eventTime: "visit_date",
      status: "visit_status",
      dimensions: ["trial_id", "site_id", "country_code", "study_arm"],
      numerator: "COUNT(DISTINCT CASE WHEN visit_status = 'completed' THEN subject_id END)",
      denominator: "COUNT(DISTINCT subject_id)",
      threshold: "0.90",
      controlTable: "clinical_subject_exposure",
      controlKey: "subject_exposure_id",
      controlField: "exposure_dose"
    },
    failures: [
      ["商品名代替产品", "换包装后历史轨迹断裂", "批准文号、持有人的有效期与别名表", "产品身份以监管主数据为准"],
      ["报告数当发生率", "自发报告增加被解释为风险增加", "暴露分母、来源和报告完整度", "禁止无分母的因果结论"],
      ["方案版本混用", "跨版本终点和人群直接比较", "方案、词典和分析集版本", "版本变化进入可比性声明"],
      ["安全数据越权", "受试者级数据被复制到个人环境", "授权用途、最小字段和访问日志", "未授权数据不得离开受控环境"]
    ],
    references: [
      ["国家药品监督管理局药品审评中心", "https://www.cde.org.cn/"],
      ["U.S. Food and Drug Administration", "https://www.fda.gov/drugs"],
      ["ICH Official Website", "https://www.ich.org/"]
    ]
  },
  {
    title: "仿制药",
    domain: "仿制药注册与一致性评价",
    thesis: "仿制药不是“照着原研药复制配方”，而是以参比制剂为比较基础，通过药学、生物等效性和生产质量证据证明其安全有效且质量可控的独立产品。数据分析要围绕产品身份、参比关系、处方工艺、生物等效性、批次放行和上市后质量展开。",
    boundary: "本篇覆盖仿制药注册、一致性评价和商业化质量数据；不讨论未经批准的个人配制，也不把价格低、成分相同直接等同于临床可替代。",
    notFor: "不能用原研药商品名代替参比制剂，也不能只用平均血药浓度判断生物等效性。",
    decision: "团队需要判断：处方和工艺是否稳定、试验是否符合方案、批次能否放行、市场替代是否需要监管与临床条件。",
    process: [
      ["参比制剂与目标产品确认", "固定参比来源、规格、批次和批准信息", "参比制剂目录、采购与检验记录"],
      ["处方与工艺开发", "研究关键质量属性、辅料和放大风险", "处方版本、工艺参数、稳定性"],
      ["生物等效性研究", "验证关键药代参数及个体差异", "方案、受试者、采样、分析方法和统计报告"],
      ["注册申报", "提交药学、非临床和生物等效性证据", "申报资料、发补问题和批准范围"],
      ["商业化生产", "按验证工艺生产并检验放行", "批记录、偏差、OOS、设备清洁"],
      ["上市后质量与替代", "监测投诉、召回、疗效反馈和供应", "反馈、留样、稳定性、市场数据"]
    ],
    objects: [
      ["仿制产品", "generic_product_id", "活性成分、剂型、规格和批准持有人"],
      ["参比关系", "reference_product_id", "具体参比制剂、来源和有效版本"],
      ["处方工艺", "formulation_version_id", "批次、辅料来源和关键参数"],
      ["生物等效性研究", "be_study_id", "设计、人群、采样和统计方案"],
      ["商业批次", "generic_batch_id", "生产、检验和放行记录"],
      ["质量反馈", "product_quality_case_id", "投诉、留样复核和召回影响"]
    ],
    metrics: [
      ["生物等效性研究完成率", "完成全部计划采样和分析的受试者 / 计划受试者", "退出、呕吐、异常采样和方案偏离要分开"],
      ["关键药代参数可评估率", "达到方案要求的可评估受试者 / 随机化受试者", "不能只报最终纳入统计的人数"],
      ["商业批次一次放行率", "首次放行合格的批次 / 呈报放行批次", "OOS、偏差和文档缺陷要分类"],
      ["溶出曲线可比率", "在规定条件下满足比较标准的批次或时间点", "不能只看单一时间点"],
      ["投诉批次闭环率", "完成调查和处置的质量投诉 / 应调查投诉", "调查完成不等于问题已纠正"]
    ],
    cases: [
      {
        title: "生物等效性研究出现空腹与餐后差异",
        trigger: "空腹结果通过评价标准，餐后结果接近边界，团队希望合并两组证明总体通过。",
        investigation: "核对研究设计、给药条件、采样时间、受试者分配、分析方法和统计模型，确认两组是不同条件下的独立问题。",
        action: "按预先定义分别报告，不合并成一个“总体通过”；对接近边界的结果进行敏感性分析和方案偏差核查。",
        lesson: "预先定义的统计口径不能被结果反向修改。研究条件不同的数据不能为了显著性强行合并。"
      },
      {
        title: "辅料供应商变更后的溶出波动",
        trigger: "更换辅料供应商后，多个批次的溶出曲线出现尾部差异。",
        investigation: "关联辅料型号、粒径、供应商批次、处方版本、制粒参数和设备，比较关键质量属性。",
        action: "先判断变更是否达到需要注册或验证的等级；未完成评估前不把新批次与旧批次视为完全可比。",
        lesson: "“化学名相同”的辅料可能功能不同，变更管理必须连接物料属性和工艺结果。"
      },
      {
        title: "OOS 与稳定性时间点异常",
        trigger: "长期稳定性某个时间点含量下降，复测结果又回到合格。",
        investigation: "保留原值并检查样品、方法、设备、标准品、温湿度和检验员，区分实验室异常与产品趋势。",
        action: "按 OOS/OOT 流程调查，不删掉异常点；同时看多个批次和多时间点，而不是只挑合格复测值。",
        lesson: "趋势分析的价值在于发现缓慢变化。只保留最终合格值会掩盖产品风险。"
      },
      {
        title: "多规格产品在采购系统被合并",
        trigger: "医院采购把不同规格或不同批准文号的产品合并成一个编码，导致替代分析失真。",
        investigation: "核对批准文号、剂型、规格、包装、供应商和医保支付编码，建立产品多级身份。",
        action: "采购、药房和监管数据使用统一产品主数据；替代分析必须按具体规格和批准范围。",
        lesson: "成分相同不代表可直接替换，商业与监管身份必须保持到最小可开方单位。"
      },
      {
        title: "偏差批次是否可放行",
        trigger: "某批生产过程中制粒时间超出验证范围，但成品检验仍合格。",
        investigation: "判断这是否为关键参数、影响哪些质量属性、是否在验证空间内，并检查设备和操作记录。",
        action: "质量部门依据风险评估和法规要求决定放行、返工或拒绝；数据团队提供完整参数和样品链。",
        lesson: "成品合格不能自动消除过程偏差，放行结论要同时考虑参数、风险和批准范围。"
      },
      {
        title: "上市后疗效反馈与批次信号",
        trigger: "多个医疗机构反馈某一批次效果不佳，但没有明确的不良事件报告。",
        investigation: "先确认产品、批号、贮存和患者使用的可比性；核对投诉时间、留样检验和同产品其他批次趋势。",
        action: "建立批次级反馈率和快速冻结规则，质量、医学和监管共同评估是否需要进一步调查。",
        lesson: "疗效反馈不等于因果结论，但集中出现的批次信号不能只被归类为“主观感受”。"
      },
      {
        title: "集中采购后的供应连续性",
        trigger: "中标后短期内订单快速增长，部分规格出现缺货，同时库存周转异常。",
        investigation: "区分在产、在检、待放行、在途、配送中和真实可用库存，结合产能与放行周期。",
        action: "建立供应风险看板，优先保障临床必需规格，并对扩产或委托生产变更执行质量评估。",
        lesson: "供应改善不能绕过质量与注册边界。库存、放行和需求必须在同一口径下管理。"
      }
    ],
    code: {
      table: "generic_batch_release",
      key: "generic_batch_id",
      eventTime: "manufactured_at",
      status: "release_status",
      dimensions: ["generic_product_id", "site_id", "formulation_version", "batch_size_band"],
      numerator: "SUM(CASE WHEN first_release_pass THEN 1 ELSE 0 END)",
      denominator: "COUNT(DISTINCT generic_batch_id)",
      threshold: "0.97",
      controlTable: "be_subject_profile",
      controlKey: "be_subject_id",
      controlField: "evaluable_flag"
    },
    failures: [
      ["参比关系模糊", "只记录原研商品名，不记录具体规格和来源", "参比制剂目录、来源批次与批准版本", "无明确参比关系不得开展比较"],
      ["BE 口径被反复挑选", "排除标准随结果变化", "方案、分析集、排除原因和统计代码", "分析方案冻结后才看分组结果"],
      ["变更等级低估", "辅料或设备变更未经评估直接生产", "变更单、验证批次和质量属性", "达到阈值必须走注册或验证流程"],
      ["市场替代越界", "仅按价格把所有同成分产品视为可互换", "批准、支付与临床可替代规则", "替代清单必须有专业批准"]
    ],
    references: [
      ["国家药品监督管理局", "https://www.nmpa.gov.cn/"],
      ["国家医疗保障局", "https://www.nhsa.gov.cn/"],
      ["U.S. FDA Generic Drugs", "https://www.fda.gov/drugs/generic-drugs"]
    ]
  },
  {
    title: "GMP",
    domain: "药品生产质量管理",
    thesis: "GMP 不是一套只供审计查看的文档，而是把人员、厂房、设备、物料、工艺、检验、放行和变更控制连接成可证明的质量体系。数据工作的任务，是让批记录、偏差、CAPA、变更、验证和放行结论能够相互追溯，并证明关键数据没有被任意修改。",
    boundary: "本篇聚焦药品生产现场的质量管理体系与数据完整性；不把 GMP 简单等同于终产品检验，也不把电子系统上线自动视为合规。",
    notFor: "不能用扫描件替代原始电子记录，不能覆盖原值，也不能以“经验判断”跳过偏差和变更流程。",
    decision: "质量团队要判断：批次能否放行、偏差是否需要扩大调查、CAPA 是否有效、变更是否完成验证，以及数据是否可信。",
    process: [
      ["人员培训与授权", "确认岗位资质、培训和操作权限", "培训记录、授权矩阵与电子签名"],
      ["设备与设施状态", "确保清洁、校准、维护和验证状态有效", "设备日志、清洁记录、校准证书"],
      ["物料与供应商管理", "验收、隔离、取样、检验和放行", "供应商批准、物料批号与检验报告"],
      ["生产与批记录", "执行工艺并按实时顺序记录关键步骤", "主批记录、执行批记录、参数和复核"],
      ["偏差、变更与 CAPA", "评估影响、批准处置并验证效果", "偏差单、根因、影响批次、有效性复核"],
      ["检验与批次放行", "确认所有物料、过程、检验和文档符合要求", "检验数据、审核清单和放行决定"],
      ["持续质量回顾", "分析趋势、投诉、召回和重复问题", "年度回顾、趋势规则和改进行动"]
    ],
    objects: [
      ["主批记录", "master_batch_record_id", "经批准的工艺与记录模板"],
      ["执行批记录", "batch_record_id", "某一商业批次的实际执行证据"],
      ["偏差", "deviation_id", "偏离标准或预期的事件及调查"],
      ["变更", "change_control_id", "对工艺、设备、系统或文件的受控变更"],
      ["CAPA", "capa_id", "纠正、预防及有效性验证"],
      ["数据审计追踪", "audit_trail_id", "关键记录的创建、修改、审批和删除证据"]
    ],
    metrics: [
      ["首次放行通过率", "首次审核通过并放行的批次 / 提交放行批次", "不能把返工后合格批次计入首次通过"],
      ["偏差按时关闭率", "在目标日期前完成调查和批准的偏差 / 应关闭偏差", "关闭时间与有效性验证时间要分开"],
      ["重复偏差发生率", "重复根因或重复产品的偏差 / 同类偏差总数", "重复要有明确匹配规则"],
      ["CAPA 有效性通过率", "在规定窗口内未复发的 CAPA / 已到期 CAPA", "观察窗口和样本量必须事先定义"],
      ["审计追踪异常率", "存在未经批准修改或缺失原因的关键记录数 / 抽查记录数", "电子签名和人工修改要分别判定"]
    ],
    cases: [
      {
        title: "批记录时间顺序异常",
        trigger: "电子批记录显示设备清洁在物料称量之后完成，但纸质备注称实际顺序正常。",
        investigation: "核对系统时间、审计追踪、设备日志、人员登录和门禁记录，确认是业务操作错误还是时间同步问题。",
        action: "冻结批次并启动偏差；不得直接修改历史时间。修复需区分设备、系统、培训或流程原因。",
        lesson: "时间戳是证据，不是装饰。系统时间同步与业务操作顺序要同时验证。"
      },
      {
        title: "同一偏差连续发生但都按时关闭",
        trigger: "某设备偏差关闭率看起来很高，但同设备三个月内反复出现同类问题。",
        investigation: "按设备、产品、班组、根因、CAPA 类型和复发时间连接，检查关闭标准是否只看文档齐全。",
        action: "重新定义重复偏差，重新评估根因；CAPA 到期后按预先观察窗验证，不只看培训签到。",
        lesson: "按时关闭不等于问题解决。质量指标要包含复发和有效性。"
      },
      {
        title: "数据完整性审计中的共享账号",
        trigger: "审计发现多个操作员使用同一账号执行称量和复核。",
        investigation: "检查账号授权、人员排班、登录 IP、电子签名和培训记录，区分便利操作与规避权限。",
        action: "立即限制共享账号，评估受影响批次的签名有效性；补做权限、培训和系统控制。",
        lesson: "共享账号会破坏责任归属。身份、权限和签名必须做到可归责。"
      },
      {
        title: "设备变更未完成验证即排产",
        trigger: "生产计划已安排新设备生产商业批次，质量系统里的验证状态仍是待批准。",
        investigation: "核对变更范围、验证方案、PQ 结果、维护校准和主批记录版本。",
        action: "在验证与变更批准前阻断排产；如已生产，按偏差评估影响并决定放行边界。",
        lesson: "排产系统必须读取质量和验证状态，不能靠线下邮件确认。"
      },
      {
        title: "OOS 复验与原始数据覆盖",
        trigger: "实验室系统只看到一个合格复验值，原始不合格结果在纸面记录中存在。",
        investigation: "回查色谱原始文件、审计追踪、样品链和检验申请，确认谁在何时以何理由修改。",
        action: "启动数据完整性调查与批次影响评估；保留原始值，修复系统权限和复核规则。",
        lesson: "删除原值会同时破坏质量结论和审计证据。数据保留策略必须覆盖原始文件。"
      },
      {
        title: "供应商批次与商业批追溯",
        trigger: "某供应商通知物料存在潜在问题，质量团队无法快速定位受影响商业批次。",
        investigation: "按供应商、物料、来料批、投料单、生产批和发货记录做双向追溯，检查库位和替代料记录。",
        action: "冻结相关物料和批次，补齐物料谱系，并对无法追溯的库存采取隔离。",
        lesson: "追溯不是单一表查询，而是从供应商到患者的正反向证据图。"
      },
      {
        title: "年度质量回顾只看合格率",
        trigger: "年度回顾结论全部良好，但偏差、返工、投诉和环境监测在多个产品上呈缓慢上升趋势。",
        investigation: "建立时间趋势、批间差异和跨产品关联，结合产量、人员、设备与变更事件。",
        action: "把年度回顾拆成稳定性、批记录、偏差、CAPA、投诉、召回、环境和数据完整性多组指标，并要求带证据的结论。",
        lesson: "质量回顾不是报表汇总，而是识别系统性风险并触发资源决策。"
      }
    ],
    code: {
      table: "pharma_batch_release",
      key: "batch_record_id",
      eventTime: "manufacturing_completed_at",
      status: "quality_release_status",
      dimensions: ["site_id", "product_id", "production_line", "shift_code"],
      numerator: "SUM(CASE WHEN first_pass_release THEN 1 ELSE 0 END)",
      denominator: "COUNT(DISTINCT batch_record_id)",
      threshold: "0.96",
      controlTable: "gmp_audit_trail",
      controlKey: "audit_event_id",
      controlField: "approved_change_flag"
    },
    failures: [
      ["关闭率替代有效性", "所有偏差都按日期关闭", "重复根因、复发和 CAPA 到期证据", "到期未验证不得判定有效"],
      ["共享账号", "多人使用同一登录执行关键操作", "唯一身份、签名、排班与审计追踪", "关键步骤必须可归责"],
      ["验证状态不参与排产", "商业生产先排后补审批", "设备、产品、工艺和验证版本", "验证未生效不得生产或放行"],
      ["只保留最终值", "异常原始数据被复验结果覆盖", "原始文件、审计追踪和 OOS 调查", "任何关键原值不得删除"]
    ],
    references: [
      ["国家药品监督管理局", "https://www.nmpa.gov.cn/"],
      ["ICH Quality Guidelines", "https://www.ich.org/page/quality-guidelines"],
      ["U.S. FDA Drug Quality", "https://www.fda.gov/drugs/drug-quality-resources"]
    ]
  },
  {
    title: "好评率",
    domain: "评价与口碑质量",
    thesis: "好评率是评价结果分布中的一个派生指标，必须同时固定评价对象、有效评价分母、评分映射、撤销与追评规则。它适合描述已购用户的满意分布，但不能单独证明商品质量、服务能力或营销效果。",
    boundary: "本篇讨论电商或服务平台的商品/订单评价好评率；不把内容点赞、客服满意度、NPS 或广告评分混成同一指标。",
    notFor: "不能用总评价数当分母却只统计五星，不能把未验证购买评价与已购评价直接合并，也不能删除低分来提升结果。",
    decision: "运营和商家要判断：差评是否集中在特定批次、物流、客服或描述不符，是否需要下架、补发、改版或发起专项改善。",
    process: [
      ["评价产生与资格校验", "确认订单完成、购买验证、评价入口和身份", "订单、评价、用户与商品版本"],
      ["评分与文本提交", "记录星级、维度、标签和文本", "原始评分、提交时间、设备风控结果"],
      ["追评、修改与撤销", "保留每次版本，不覆盖历史", "评价版本号、原因和时间"],
      ["反作弊与有效性判定", "识别刷评、诱导、重复和异常账号", "风控标签、证据与人工复核"],
      ["聚合与展示", "按商品和窗口计算评分分布、好评率与样本量", "分子分母、置信区间和展示规则"],
      ["差评运营与复盘", "分类原因、响应、补偿和改善", "工单、责任团队、解决证据和复发监控"]
    ],
    objects: [
      ["评价", "review_id", "一条评价的稳定身份"],
      ["评价版本", "review_version_id", "修改、追评和状态变化的具体版本"],
      ["评价对象", "review_subject_id", "商品、规格、订单行或服务单"],
      ["有效购买", "verified_purchase_id", "评价资格对应的订单行"],
      ["风控判定", "review_risk_id", "异常判定、证据和复核结论"]
    ],
    metrics: [
      ["有效好评率", "有效评分大于等于好评阈值的评价数 / 有效评价数", "固定阈值、时间窗、购买验证和风控规则"],
      ["低分集中度", "单一商品或批次中 1-2 星评价数 / 该对象有效评价数", "要同时展示样本量和评价量变化"],
      ["评价修改率", "发生至少一次修改或追评的评价 / 已提交评价", "修改不等于作弊，需区分原因"],
      ["差评响应时长", "首次有效响应时间 - 差评提交时间", "自动回复不计为有效响应"],
      ["评价异常拦截率", "被判定无效的评价 / 触发风控评价", "需要漏放和误杀复核"]
    ],
    cases: [
      {
        title: "店铺评分上升但差评集中",
        trigger: "店铺整体好评率上升，某爆款低分评价却持续增加。",
        investigation: "按商品、规格、供应商批次、订单时段和差评标签拆分，发现新增流量带来大量未验证购买评价，稀释了已购用户差评。",
        action: "整体与已购评价分开展示；商品页增加近期有效差评率和低分原因分布。",
        lesson: "整体平均会掩盖局部风险。评价指标必须能下钻到商品和具体问题。"
      },
      {
        title: "促销期出现大量五星短评",
        trigger: "某活动后五星评价激增，文本高度相似且购买间隔异常。",
        investigation: "关联账号注册时间、设备、订单、评价模板、物流和售后行为，进行规则识别与人工抽样。",
        action: "先隔离可疑评价再复核，保留原评价和判定证据；不能为了指标直接批量删除。",
        lesson: "反作弊要保留证据链和申诉通道。异常不等于作弊，需区分误杀。"
      },
      {
        title: "同一商品不同规格评价混算",
        trigger: "服装商品 A 规格好评率高，B 规格尺码偏差严重，但页面只展示父商品总分。",
        investigation: "检查评价对象绑定的是父商品、SKU 还是订单行，确认规格、颜色和尺码是否可追溯。",
        action: "按最小可购买规格聚合，父商品只展示加总并允许查看子规格分布。",
        lesson: "评价对象越粗，运营动作越难落地。规格差异不应被父商品平均掉。"
      },
      {
        title: "退款用户评价是否应计入",
        trigger: "部分用户退款后仍给出低分，商家认为应全部剔除。",
        investigation: "区分未发货取消、质量问题退款、仅退款、退货退款和无理由退款，并核对评价是否基于真实体验。",
        action: "按业务规则分别展示，不默认排除所有退款评价；退款原因进入问题分类。",
        lesson: "分母规则要服务问题判断。不能只要低分就修改资格。"
      },
      {
        title: "差评响应率高但复购未改善",
        trigger: "客服对差评几乎全部回复，但同类问题继续出现。",
        investigation: "抽样文本和工单，发现大量模板回复，未关联根因、责任团队和修复进度。",
        action: "把“回复率”改为“有效解决率”，要求问题分类、方案、完成时间和用户确认。",
        lesson: "响应是过程指标，解决和复发才是结果指标。"
      },
      {
        title: "历史评价版本被覆盖",
        trigger: "用户追评后，系统只保留最新星级，导致早期物流差评消失。",
        investigation: "检查评价版本表和展示逻辑，确认是否用最新版本覆盖了全部历史。",
        action: "保留版本链；聚合使用当前有效评分，问题分析可使用首评和追评变化。",
        lesson: "当前结论和历史证据是两件事，不能用一个覆盖规则同时满足。"
      },
      {
        title: "小样本好评率的置信问题",
        trigger: "新品只有 8 条评价且全部五星，被展示为 100% 好评并用于首页推荐。",
        investigation: "评估样本量、评价来源、展示窗口和业务风险，确认 100% 对用户的误导程度。",
        action: "展示评价数并在低样本时使用置信下限或明确提示，推荐模型降低小样本权重。",
        lesson: "比例必须带样本量。小样本的完美结果不应获得过度确定性。"
      }
    ],
    code: {
      table: "commerce_review_version",
      key: "review_version_id",
      eventTime: "submitted_at",
      status: "validity_status",
      dimensions: ["subject_id", "sku_id", "channel_id", "rating_bucket"],
      numerator: "COUNT(DISTINCT CASE WHEN rating >= 4 THEN review_id END)",
      denominator: "COUNT(DISTINCT CASE WHEN validity_status = 'valid' THEN review_id END)",
      threshold: "0.92",
      controlTable: "review_purchase_link",
      controlKey: "verified_purchase_id",
      controlField: "order_line_amount"
    },
    failures: [
      ["分母偷换", "页面显示全部评价，指标只算已购评价", "分子、分母、购买验证和时间窗", "任何展示都带同口径样本量"],
      ["异常直接删除", "可疑低分无证据批量清理", "规则、人工复核、原值和申诉记录", "先隔离再判定，保留证据"],
      ["父商品平均掩盖规格", "不同 SKU 问题被合并", "评价对象到级和规格维度", "关键质量指标至少下钻到 SKU"],
      ["回复率冒充解决率", "模板回复计入完成", "根因、行动、用户确认和复发", "有效解决与响应分开展示"]
    ],
    references: [
      ["Federal Trade Commission Endorsement Guides", "https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides"],
      ["OECD E-commerce Recommendations", "https://www.oecd.org/sti/consumer/"],
      ["国家市场监督管理总局", "https://www.samr.gov.cn/"]
    ]
  },
  {
    title: "CPC",
    domain: "按点击计费广告",
    thesis: "CPC 是按有效点击计费的广告成本指标，常用公式是广告花费除以有效点击次数。真正困难的不是除法，而是定义什么点击可计费、什么流量无效、重复点击如何处理，以及点击之后是否产生有效访问或转化。",
    boundary: "本篇讨论搜索、信息流或展示广告的 CPC 成本分析；不把 CPM、CPA、ROAS 或自然流量成本混入 CPC 计算。",
    notFor: "不能把展示次数放在 CPC 分母，不能只看平均 CPC 不看点击质量和后续转化，也不能用平台回传点击与站内会话随意拼接。",
    decision: "投放团队要判断：成本变化来自竞价、版位、人群、无效点击还是流量结构，是否需要调价、换素材、排除流量或暂停计划。",
    process: [
      ["广告请求与竞价", "记录请求、候选广告、出价和竞价结果", "请求 ID、计划、版位、竞价版本"],
      ["曝光与可见性", "满足展示条件并产生可计费或可观察曝光", "曝光时间、位置、设备和可见标准"],
      ["点击与有效性判定", "区分原始点击、有效点击、重复点击和无效流量", "点击 ID、风控标签、平台调整记录"],
      ["落地页访问", "连接广告点击与会话、页面和转化", "点击 ID、会话、落地页版本"],
      ["费用结算", "按有效点击或平台规则计算费用", "账单、调整项、币种和结算日"],
      ["转化与质量复盘", "观察后续行为、线索质量或订单", "转化事件、归因窗口和退款"]
    ],
    objects: [
      ["广告请求", "ad_request_id", "一次广告请求及候选计划"],
      ["曝光", "impression_id", "一次满足展示条件的广告曝光"],
      ["点击", "click_id", "一次广告点击及有效性状态"],
      ["会话", "session_id", "点击后的站内访问会话"],
      ["费用", "ad_cost_id", "平台结算或内部核算成本"]
    ],
    metrics: [
      ["有效 CPC", "可计费广告花费 / 有效点击次数", "账单调整和无效点击退回必须计入"],
      ["点击率", "有效点击次数 / 有效曝光次数", "曝光位置和去重规则要固定"],
      ["无效点击率", "判定无效的点击 / 原始点击", "需同时看漏判和误判"],
      ["点击到会话率", "包含有效点击标识的站内会话 / 有效点击", "跨端、延迟和隐私限制会造成缺口"],
      ["点击后转化率", "有效转化数 / 有效点击", "转化窗口应与业务周期匹配"]
    ],
    cases: [
      {
        title: "平均 CPC 降低但线索质量变差",
        trigger: "投放团队把 CPC 降低作为优化成果，销售却反馈无效线索增加。",
        investigation: "按计划、版位、关键词、设备和素材分析 CPC 与有效会话、合格线索、成交的联合分布。",
        action: "把主目标改为合格线索成本，CPC 作为解释指标；对低质流量设置排除和观察期。",
        lesson: "成本降低不一定是优化。点击质量和后续结果必须形成护栏。"
      },
      {
        title: "平台点击与站内会话无法一对一",
        trigger: "站内分析发现点击 ID 缺失，广告点击数量和访问会话相差较大。",
        investigation: "检查重定向、跨端跳转、隐私设置、页面加载、埋点版本和自然访问混入。",
        action: "使用可解释的会话归因，不以缺口直接判定作弊；按端、渠道和落地页分别估算可连接率。",
        lesson: "点击与会话不是天然一一对应。归因缺口既是技术问题，也可能来自用户行为。"
      },
      {
        title: "无效点击退回后的账单重算",
        trigger: "平台月底退回部分无效点击费用，但内部日报没有回冲，导致 CPC 月度不一致。",
        investigation: "比较实时点击成本、结算账单、调整项和财务入账日期，确认费用版本。",
        action: "明确日报使用预估成本、月报使用结算成本，并保留版本和差异说明。",
        lesson: "成本和点击都有结算时点。实时优化与财务口径不能混成同一张表。"
      },
      {
        title: "同一用户重复点击被多次计费",
        trigger: "短时间同设备多计划点击，平台按规则部分计费。",
        investigation: "关联请求、曝光、点击时间、设备和平台去重规则，识别正常比较行为与异常高频。",
        action: "内部不做简单全局去重来改写平台费用；分析时区分原始点击、有效计费点击和去重用户。",
        lesson: "平台账单口径和用户行为口径不同，需要分别建模并建立桥接。"
      },
      {
        title: "新版位 CPC 看似更低",
        trigger: "新广告位点击价格明显低，但停留时间短、跳出率高。",
        investigation: "比较曝光可见性、点击位置、误触风险、页面加载和目标转化。",
        action: "灰度投放，设置会话质量和转化护栏；若低质点击无法被平台调整，则控制预算。",
        lesson: "低价流量可能只是低成本错误。版位评估不能只看 CPC。"
      },
      {
        title: "品牌词与竞品词合并分析",
        trigger: "投放报告把品牌词和竞品词合并，平均 CPC 掩盖了品牌词的稳定高转化。",
        investigation: "按关键词意图、匹配方式、计划、位置和归因窗口拆分。",
        action: "分别设置预算和成本阈值，不用一个平均 CPC 管理所有意图。",
        lesson: "平均值会抹平结构。CPC 分析要沿业务意图和流量结构下钻。"
      },
      {
        title: "点击欺诈调查中的误伤",
        trigger: "某渠道点击异常，团队准备直接关闭所有设备类型。",
        investigation: "先验证曝光、点击时间分布、账号和设备聚类、转化和投诉，区分机器人、误触和正常高活跃。",
        action: "分级拦截并设复核与申诉，监控误杀带来的正常流量损失。",
        lesson: "反作弊不是一刀切。规则必须同时衡量阻止风险和误伤成本。"
      }
    ],
    code: {
      table: "ads_click_event",
      key: "click_id",
      eventTime: "clicked_at",
      status: "click_validity",
      dimensions: ["campaign_id", "placement_id", "device_type", "keyword_intent"],
      numerator: "SUM(billable_cost)",
      denominator: "COUNT(DISTINCT CASE WHEN click_validity = 'valid' THEN click_id END)",
      threshold: "0.85",
      controlTable: "ads_cost_adjustment",
      controlKey: "adjustment_id",
      controlField: "approved_adjustment_amount"
    },
    failures: [
      ["CPC 分母错误", "用曝光或原始点击充当有效点击", "有效点击、计费点击和原始点击三套口径", "成本指标必须与账单规则一致"],
      ["实时账当结算账", "日成本未考虑月度和无效点击调整", "预估、结算、调整与财务入账版本", "管理层报表标明数据阶段"],
      ["只看低价", "低 CPC 流量无转化或高误触", "会话质量、转化和停留护栏", "CPC 优化必须绑定质量目标"],
      ["跨端硬拼接", "没有点击 ID 时按时间强行一一匹配", "端、渠道、会话和可连接率", "无法连接时使用聚合归因并披露限制"]
    ],
    references: [
      ["Google Ads Help: Cost per click", "https://support.google.com/google-ads/answer/116495"],
      ["Interactive Advertising Bureau", "https://www.iab.com/"],
      ["MRC Viewable Impression Guidelines", "https://mediaratingcouncil.org/"]
    ]
  },
  {
    title: "CPM",
    domain: "千次曝光计费广告",
    thesis: "CPM 表示每一千次有效广告曝光的成本，公式为广告花费除以有效曝光次数再乘以一千。CPM 描述的是触达和曝光效率，不等于用户一定看见、记住或购买，因此必须配套可见性、频次、点击和转化指标。",
    boundary: "本篇讨论以千次曝光为结算基础的品牌与展示广告；不把请求、填充、返回广告或未满足可见标准的曝光全部当作有效曝光。",
    notFor: "不能用点击计费账单计算 CPM，不能把同一用户的重复曝光当作独立受众，也不能把高曝光直接解释为品牌提升。",
    decision: "投放团队要判断：成本变化来自竞价环境、版位、地域、人群、频次还是无效曝光，是否需要调整预算、受众、频控或创意。",
    process: [
      ["受众与预算规划", "定义目标人群、地域、预算和频次上限", "计划、受众版本、预算和频控"],
      ["广告请求与填充", "记录请求、候选、竞价和广告返回", "请求 ID、填充状态、竞价和版位"],
      ["有效曝光", "广告实际展示并满足曝光标准", "曝光 ID、可见性、设备、时间和位置"],
      ["频次与去重受众", "统计重复曝光、独立设备和估算触达", "设备或用户标识、时间窗和隐私规则"],
      ["点击或品牌行为", "记录点击、搜索、访问或品牌提升研究", "点击、会话、调查或实验结果"],
      ["结算与复盘", "按结算曝光计算费用并处理无效或返还", "账单、调整项、结算日和币种"]
    ],
    objects: [
      ["广告请求", "ad_request_id", "一次可出售广告机会"],
      ["曝光", "impression_id", "一次达到展示标准的广告曝光"],
      ["可见曝光", "viewable_impression_id", "满足可见性标准的曝光"],
      ["受众接触", "reach_contact_id", "同一匿名用户或设备在窗口内的接触"],
      ["结算费用", "media_cost_id", "按曝光结算或内部核算的媒体成本"]
    ],
    metrics: [
      ["结算 CPM", "结算广告花费 / 结算曝光次数 × 1000", "必须使用结算曝光和最终调整后成本"],
      ["可见曝光率", "满足可见标准的曝光 / 有效曝光", "不同媒体和格式的可见标准需注明"],
      ["平均频次", "有效曝光次数 / 估算独立触达人数", "跨设备识别限制会导致估算偏差"],
      ["千次触达成本", "广告花费 / 估算独立触达人数 × 1000", "不同于 CPM，需带触达窗口和去重规则"],
      ["曝光后转化率", "曝光 cohort 的有效转化数 / 可归因曝光 cohort", "需有对照组或合理归因设计"]
    ],
    cases: [
      {
        title: "预算增长后 CPM 突然上升",
        trigger: "同一计划提高预算后，CPM 明显升高但曝光量增长有限。",
        investigation: "检查竞价环境、时段、地域、受众饱和、频控和预算平滑；区分需求竞争与低质库存填充。",
        action: "分时段和版位扩量，设置频次与 CPM 护栏，不把预算翻倍直接压在原受众。",
        lesson: "边际成本会随规模和竞争变化。CPM 优化要看扩量曲线，而不是单一平均值。"
      },
      {
        title: "曝光很多但可见率低",
        trigger: "媒体报告曝光量大、CPM 低，品牌团队却发现可见曝光率偏低。",
        investigation: "核对可见性标准、页面位置、设备、加载和不同媒体的测量口径。",
        action: "把可见曝光成本作为核心约束，低可见库存设置预算上限，并用第三方或统一标准交叉验证。",
        lesson: "低成本曝光可能只是低质量展示。CPM 必须与可见性一起看。"
      },
      {
        title: "频次过高导致点击率下降",
        trigger: "扩量后总点击增加，但点击率和品牌搜索下降。",
        investigation: "按受众接触频次分桶，比较曝光、点击、后续访问和负反馈。",
        action: "设置频控和创意轮换，使用独立触达成本观察新增人群效率。",
        lesson: "重复曝光不是免费触达。频次有边际收益，也可能产生疲劳。"
      },
      {
        title: "请求量与曝光量混用",
        trigger: "媒体交付报表把广告请求、填充和曝光放在同一列，导致 CPM 低于实际。",
        investigation: "验证每个对象的定义和计数层级，检查请求一对多曝光、无效流量剔除和结算调整。",
        action: "建立请求、填充、展示、可见和结算五级漏斗，KPI 明确使用哪一级。",
        lesson: "广告链路对象不同，不能因为字段都叫 impression 就合并。"
      },
      {
        title: "跨设备触达重复",
        trigger: "媒体估算独立用户增长，但 CRM 去重后新增用户不明显。",
        investigation: "比较设备、登录账号、家庭和地域信息，承认跨设备识别的限制。",
        action: "将媒体触达作为估算值，结合品牌搜索、自然访问和实验评估，不用精确用户数包装。",
        lesson: "隐私限制下的触达是估算，不是真实人口。指标必须带测量误差。"
      },
      {
        title: "曝光后转化归因过宽",
        trigger: "一次品牌曝光后 30 天内所有自然成交都被归因于广告。",
        investigation: "检查归因窗口、其他触点、自然基线、曝光人群选择偏差和退款。",
        action: "采用对照组、地理实验或更窄归因窗口，分别报告增量与总归因。",
        lesson: "曝光和成交同时发生不等于广告造成成交。CPM 投放尤其需要增量证据。"
      },
      {
        title: "无效曝光回冲后的数据版本",
        trigger: "月末平台移除异常曝光并返还费用，日报与财务月报对不上。",
        investigation: "建立结算批次和调整记录，区分预估、交付与财务确认。",
        action: "日报用于运营、月报用于结算，保留版本和差异解释，避免修改历史事实。",
        lesson: "数据治理不是让所有时点数字一样，而是让差异有明确原因。"
      }
    ],
    code: {
      table: "ads_settled_impression",
      key: "settled_impression_id",
      eventTime: "impression_at",
      status: "settlement_status",
      dimensions: ["campaign_id", "publisher_id", "audience_id", "viewability_band"],
      numerator: "SUM(settled_media_cost) * 1000.0",
      denominator: "COUNT(DISTINCT settled_impression_id)",
      threshold: "0.60",
      controlTable: "ads_viewability_measurement",
      controlKey: "viewability_event_id",
      controlField: "measurable_duration_ms"
    },
    failures: [
      ["请求冒充曝光", "把广告请求或返回素材算入交付", "请求、填充、曝光、可见和结算五级链路", "结算指标只用结算曝光"],
      ["CPM 与触达混用", "把重复曝光当独立用户", "频次、独立设备、窗口和估算方法", "CPM 与千次触达成本分开报告"],
      ["忽略可见性", "低价但低质量曝光被判定优化", "可见标准、媒体测量和交叉验证", "可见曝光率进入预算护栏"],
      ["曝光即因果", "曝光后成交全部算成广告效果", "对照组、自然基线和其他触点", "品牌效果优先使用实验或增量方法"]
    ],
    references: [
      ["Interactive Advertising Bureau", "https://www.iab.com/"],
      ["Media Rating Council", "https://mediaratingcouncil.org/"],
      ["Google Ads Help", "https://support.google.com/google-ads/"]
    ]
  }
];

SPECS.push(...BATCH_2_SPECS);
SPECS.push(...BATCH_3_SPECS);

const ALIASES = new Map();
for (const spec of SPECS) {
  ALIASES.set(spec.title, spec);
}
for (const [alias, canonical] of [
  ["HIS 医院信息系统", "HIS医院信息系统"],
  ["EMR 电子病历系统", "EMR电子病历系统"]
]) {
  const spec = ALIASES.get(canonical);
  if (spec) ALIASES.set(alias, spec);
}

function esc(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function codeFence(language, code) {
  return `\`\`\`${language}\n${code.trim()}\n\`\`\``;
}

function normalizeTitle(title) {
  return String(title)
    .replace(/^\s*\d+[\s._-]*/, "")
    .replace(/[（(][^）)]*[）)]/g, "")
    .trim();
}

function findSpec(profile) {
  const title = normalizeTitle(profile.title).replace(/\s+/g, " ");
  if (ALIASES.has(title)) return ALIASES.get(title);
  return null;
}

function pipelineTable(spec) {
  return [
    "| 环节 | 要做的事 | 最小证据 | 失败后先查什么 |",
    "| --- | --- | --- | --- |",
    ...spec.process.map(([stage, action, evidence], index) => (
      `| ${esc(stage)} | ${esc(action)} | ${esc(evidence)} | ${esc(spec.failures[index % spec.failures.length][1])} |`
    ))
  ].join("\n");
}

function objectTable(spec) {
  return [
    "| 数据对象 | 建议主键 | 一行代表什么 | 不允许混淆 |",
    "| --- | --- | --- | --- |",
    ...spec.objects.map(([name, key, grain], index) => (
      `| ${esc(name)} | \`${key}\` | ${esc(grain)} | ${esc(index === 0 ? "对象身份与业务事件" : "事件、状态快照和结果粒度")} |`
    ))
  ].join("\n");
}

function metricTable(spec) {
  return [
    "| 指标 | 公式或定义 | 口径提醒 |",
    "| --- | --- | --- |",
    ...spec.metrics.map(([name, formula, caution]) => (
      `| ${esc(name)} | ${esc(formula)} | ${esc(caution)} |`
    ))
  ].join("\n");
}

function caseSection(spec, item, index) {
  return `### ${index + 1}. ${item.title}

**现场。** ${item.trigger}

**怎么查。** ${item.investigation}

**怎么处理。** ${item.action}

**验收结论。** ${item.lesson}`;
}

function reconstructionSql(spec) {
  const dims = spec.code.dimensions.join(", ");
  return `-- ${spec.title}：按业务对象重建链路，避免事件、快照和结果混算
WITH ranked_${spec.code.key} AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY ${spec.code.key}
      ORDER BY updated_at DESC
    ) AS version_no
  FROM ${spec.code.table}
  WHERE ${spec.code.eventTime} >= TIMESTAMP '{start_time}'
    AND ${spec.code.eventTime} <  TIMESTAMP '{end_time}'
    AND ${spec.code.status} NOT IN ('deleted', 'test')
),
valid_rows AS (
  SELECT
    ${spec.code.key},
    ${spec.code.dimensions.map((item) => `${item}`).join(",\n    ")},
    ${spec.code.eventTime},
    ${spec.code.status},
    ingested_at
  FROM ranked_${spec.code.key}
  WHERE version_no = 1
)
SELECT
  ${dims},
  COUNT(DISTINCT ${spec.code.key}) AS object_cnt,
  ${spec.code.numerator} AS numerator_value,
  ${spec.code.denominator} AS denominator_value,
  CAST(${spec.code.numerator} AS DOUBLE PRECISION)
    / NULLIF(${spec.code.denominator}, 0) AS metric_value,
  MIN(${spec.code.eventTime}) AS first_event_at,
  MAX(${spec.code.eventTime}) AS last_event_at
FROM valid_rows
GROUP BY ${dims}
ORDER BY metric_value DESC, object_cnt DESC;`;
}

function reconciliationSql(spec) {
  return `-- ${spec.title}：源对象、控制对象和结果对象三方对账
WITH population AS (
  SELECT
    ${spec.code.key},
    ${spec.code.eventTime},
    ${spec.code.status}
  FROM ${spec.code.table}
  WHERE ${spec.code.eventTime} >= TIMESTAMP '{start_time}'
    AND ${spec.code.eventTime} <  TIMESTAMP '{end_time}'
),
control AS (
  SELECT
    ${spec.code.key},
    SUM(${spec.code.controlField}) AS control_value,
    COUNT(DISTINCT ${spec.code.controlKey}) AS control_cnt,
    MAX(updated_at) AS control_updated_at
  FROM ${spec.code.controlTable}
  WHERE updated_at >= TIMESTAMP '{start_time}'
  GROUP BY ${spec.code.key}
),
result AS (
  SELECT
    ${spec.code.key},
    COUNT(*) AS result_cnt,
    MAX(calculated_at) AS calculated_at
  FROM mart_${spec.code.key}
  WHERE business_date BETWEEN DATE '{start_date}' AND DATE '{end_date}'
  GROUP BY ${spec.code.key}
)
SELECT
  COALESCE(p.${spec.code.key}, c.${spec.code.key}, r.${spec.code.key}) AS object_key,
  CASE
    WHEN p.${spec.code.key} IS NULL THEN 'source_missing'
    WHEN c.${spec.code.key} IS NULL THEN 'control_missing'
    WHEN r.${spec.code.key} IS NULL THEN 'result_missing'
    WHEN ABS(COALESCE(c.control_value, 0) - COALESCE(r.result_cnt, 0)) > 0 THEN 'count_or_value_gap'
    ELSE 'matched'
  END AS reconciliation_status,
  p.${spec.code.status},
  c.control_value,
  c.control_cnt,
  r.result_cnt,
  c.control_updated_at,
  r.calculated_at
FROM population p
FULL OUTER JOIN control c ON p.${spec.code.key} = c.${spec.code.key}
FULL OUTER JOIN result r ON COALESCE(p.${spec.code.key}, c.${spec.code.key}) = r.${spec.code.key}
WHERE p.${spec.code.key} IS NULL
   OR c.${spec.code.key} IS NULL
   OR r.${spec.code.key} IS NULL
   OR ABS(COALESCE(c.control_value, 0) - COALESCE(r.result_cnt, 0)) > 0;`;
}

function releasePython(spec) {
  const cls = spec.code.key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return `from dataclasses import dataclass

@dataclass(frozen=True)
class ${cls}Batch:
    batch_id: str
    source_rows: int
    valid_rows: int
    duplicate_keys: int
    missing_required_fields: int
    reconciliation_gap: float

def release_${spec.code.key}(batch: ${cls}Batch) -> dict:
    checks = {
        "source_not_empty": batch.source_rows > 0,
        "valid_rows_in_range": 0 <= batch.valid_rows <= batch.source_rows,
        "duplicate_rate_ok": batch.duplicate_keys / max(batch.source_rows, 1) <= 0.001,
        "required_fields_ok": batch.missing_required_fields == 0,
        "reconciliation_ok": abs(batch.reconciliation_gap) <= 0.01,
    }
    return {
        "topic": "${spec.title}",
        "batch_id": batch.batch_id,
        "checks": checks,
        "release_allowed": all(checks.values()),
        "blocking_checks": [name for name, passed in checks.items() if not passed],
    }`;
}

function metricPython(spec) {
  const [name, formula, caution] = spec.metrics[0];
  return `from dataclasses import dataclass
from math import sqrt

@dataclass(frozen=True)
class ${spec.code.key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")}Observation:
    object_id: str
    numerator: float
    denominator: float
    sample_size: int
    scope_version: str

def calculate_${spec.code.key}(rows: list[${spec.code.key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")}Observation]) -> list[dict]:
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
            "metric": "${name}",
            "value": value,
            "lower_bound": lower if value is not None else None,
            "sample_size": row.sample_size,
            "scope_version": row.scope_version,
            "caution": "${caution}",
        })
    return output`;
}

function failureTable(spec) {
  return [
    "| 风险信号 | 错误做法 | 必须补齐的证据 | 发布或行动规则 |",
    "| --- | --- | --- | --- |",
    ...spec.failures.map(([symptom, wrong, evidence, rule], index) => (
      `| ${esc(symptom)} | ${esc(wrong)} | ${esc(evidence)} | ${esc(rule)} |`
    ))
  ].join("\n");
}

function acceptanceTable(spec) {
  const rows = spec.objects.map(([name, key, grain], index) => (
    `| ${esc(name)} | \`${key}\` 能唯一定位${esc(grain)} | 正常、重复、缺失、撤销与跨期样本 | ${esc(spec.metrics[index % spec.metrics.length][0])}可回到原始对象 |`
  ));
  return [
    "| 验收对象 | 结构要求 | 测试样本 | 结果证据 |",
    "| --- | --- | --- | --- |",
    ...rows
  ].join("\n");
}

function buildBlueprintArticle(profile) {
  const spec = findSpec(profile);
  if (!spec) return null;
  const stages = spec.process.map(([stage]) => stage);
  return `# ${spec.title}

> [!abstract] ${spec.domain}实战手册
> ${spec.thesis}

## 1. ${spec.title}：定义、适用边界与决策出口

${spec.thesis}

**本篇的适用边界。** ${spec.boundary}

**最常见的错误替代。** ${spec.notFor}

**最终决策。** ${spec.decision} 因此，这篇内容不从“应该建哪张表”开始，而从业务动作、责任人和失败后果开始。只有先确定谁在什么时点做出什么决定，字段、SQL、看板和模型才有明确用途。

围绕“${spec.title}”，工作中至少要区分四类问题：

1. **身份问题**：对象是谁，主键能否跨系统稳定关联，合并、拆分、撤销后历史是否还看得见。
2. **时间问题**：业务发生、状态生效、数据入仓、计算完成和人员行动分别发生在哪一刻。
3. **状态问题**：当前状态是一段事件、一张快照还是最终结果，空值代表未发生、未采集还是已删除。
4. **责任问题**：谁确认口径，谁处理异常，谁有权放行或停止，谁在观察期后复盘。

## 2. ${spec.title}的完整业务流程

${pipelineTable(spec)}

把 ${stages.join("、")} 串起来后可以看出，${spec.title}不是一个孤立字段，而是一条会跨系统、跨岗位、跨时间的证据链。流程图上每一段都应标出输入、输出、状态、时间戳、责任人和异常出口。只要其中一段只能靠口头解释，后续的统计、追责和自动化就会失去基础。

一个合格的需求说明应该写成：

> 在【授权数据范围】和【观察窗口】内，围绕“${spec.title}”的【${spec.objects[0][0]}】，按【${spec.code.dimensions.join("、")}】比较【${spec.metrics[0][0]}】及其【${spec.metrics[1][0]}】，定位一个可干预节点；行动后同时观察主指标、样本量和护栏，任何高风险异常先阻断再调查。

## 3. ${spec.title}的数据对象与系统契约

${objectTable(spec)}

对象表不是把所有字段塞进一张宽表。事件、状态快照和结果表应该分别保留粒度，再通过稳定主键与版本建立关联。尤其要避免三个常见混算：把一次业务事件算成多个对象、把每日快照相加当事件总量、把最新状态覆盖历史状态。

本主题的数据契约至少应包含：

- \`${spec.code.key}\` 的唯一性规则、生成方式和跨系统映射。
- \`${spec.code.eventTime}\` 的业务含义、时区、迟到和补录规则。
- \`${spec.code.status}\` 的完整状态集合，以及删除、撤销、冻结和失效的表示方法。
- 控制对象 \`${spec.code.controlTable}.${spec.code.controlKey}\` 与主对象的关系。
- 每次口径、规则、模型或源版本变化的影响范围和下游通知对象。
- 敏感字段、允许用途、访问角色、导出限制和审计保留时间。

## 4. ${spec.title}的指标、样本与验收口径

${metricTable(spec)}

指标字典至少写到“任何人都能按同一份数据复跑”的程度：中文名、业务定义、公式、分子、分母、事实粒度、时间字段、对象范围、排除项、版本、负责人和验收样例，一个都不能少。比例指标必须同时展示分子、分母和样本量；金额或数量必须做守恒；状态指标必须能回到事件时间线。

对于“${spec.title}”，建议把观察分成三层：

| 层次 | 看什么 | 不能替代什么 |
| --- | --- | --- |
| 业务结果 | ${spec.metrics.slice(0, 2).map(([name]) => name).join("、")} | 不能替代过程证据和个案回查 |
| 过程护栏 | ${spec.metrics.slice(2).map(([name]) => name).join("、")} | 不能因为护栏暂时正常就跳过异常调查 |
| 数据证据 | 主键、时间、状态、版本、来源目标对账 | 不能只看任务成功或报表能打开 |

## 5. ${spec.title}：七个真实工作场景

以下七组场景均为公开方法结合常见工作流程构造的“脱敏复合示例”，不对应任何单一企业、患者、客户或雇员事实。场景的目的，是展示如何从现象走到证据、行动和验收，而不是虚构经营成果。

${spec.cases.map((item, index) => caseSection(spec, item, index)).join("\n\n")}

七个场景可以归成一条共同判断顺序：先确认对象和时间，再确认状态和版本；然后做总量、结构和明细三层对账；最后才讨论策略、模型或工具。若一条结论不能指出对应的原始记录、责任人和行动出口，就只能算观察，不能作为生产结论。

## 6. ${spec.title}的第一段 SQL：重建业务链路

下面的 SQL 用于说明对象、时间、状态、版本和分层口径如何进入同一条可复查路径。表名和部分字段是通用示例，落地时应映射到企业数据字典；SQL 方言也需按实际引擎调整。

${codeFence("sql", reconstructionSql(spec))}

执行后至少回答六个问题：

- 同一对象是否因为多源回传产生多版本，版本保留是否符合业务要求？
- 业务时间与入仓时间是否分开，补录和迟到数据是否进入正确分区？
- 分子分母是否来自同一对象范围和同一统计窗口？
- 维度使用的是事件当时值还是当前值，跨期比较是否一致？
- 删除、撤销、冻结和测试数据是否按规则处理？
- 分组结果能否在明细中抽样复现？

## 7. ${spec.title}的第二段 SQL：源、控制和结果三方对账

${codeFence("sql", reconciliationSql(spec))}

这段查询故意不使用“总数相差小于某个随意百分比就算通过”。它先找出缺失对象和状态差异，再检查控制值与结果值。对于${spec.title}，数量、金额、时长或状态任意一项无法解释，都不能用“业务波动”代替排查。

对账结果建议分成四类处理：

1. **阻断**：对象缺失、关键时间为空、状态非法、金额或数量不守恒、权限越界。
2. **严重**：比例或总量显著偏离基线，且无法由已确认的对象结构变化解释。
3. **观察**：小范围波动但来源、样本和趋势可控，进入责任人和观察窗口。
4. **探索**：只有弱信号或假设，不进入正式结论，更不直接触发业务处罚。

## 8. ${spec.title}的 Python 发布门禁与指标护栏

第一段代码把发布条件写成可执行对象，避免“检查过了”只存在聊天记录里：

${codeFence("python", releasePython(spec))}

第二段代码演示如何为比例类结果附带样本证据和小样本下界。它不是替代统计学家的模型，而是防止把少量偶然样本直接包装成稳定结论：

${codeFence("python", metricPython(spec))}

真正上线时还要补充参数配置、日志、血缘、告警级别、重跑幂等、异常样本保存和审批记录。代码通过不代表业务通过；自动检查只能证明已经定义的规则没有被违反，无法证明规则本身一定正确。

## 9. ${spec.title}的失败反例与上线验收

${failureTable(spec)}

上线验收不应只有一句“报表正常”。建议按下面四层验收：

${acceptanceTable(spec)}

还应为每一次发布保留一组固定回归样本：正常对象、边界状态、重复记录、缺失字段、撤销或退款、跨期、权限拒绝和失败恢复。回归样本不是演示数据，而是以后每次改规则都能重复执行的质量资产。

## 10. ${spec.title}的 30 天落地与复盘

| 阶段 | 主要交付 | 通过条件 |
| --- | --- | --- |
| 第 1 周：定义 | 对象、流程、状态、指标、排除项和责任矩阵 | 业务、数据、安全或质量负责人对同一口径签字 |
| 第 2 周：打通 | 源字段、主键、时间、版本、控制对象和失败样本 | 正常与异常样本都能回到原始记录 |
| 第 3 周：验证 | 总量对账、分层对账、抽样回查、权限测试、回滚演练 | 阻断问题清零，严重问题有责任人与期限 |
| 第 4 周：发布 | 灰度、SLO、监控、行动清单、停止条件和复盘模板 | 使用者在真实场景中完成一次闭环行动 |

如果必须用 90 秒说明“${spec.title}”是否做对，可以按这个顺序自测：

1. 一行数据代表什么，主键是什么，哪些对象绝不能混在同一粒度？
2. 业务发生、数据可见、计算完成和行动确认分别在哪个时间点？
3. 本主题最重要的两个主指标、三个护栏和最小样本量是什么？
4. 一个异常出现时，先从原始记录、链路版本还是业务动作开始查？
5. 哪类错误必须阻断发布或停止使用，谁有权批准例外？
6. 上线后由谁在多长时间内观察，什么条件下回滚或结束？

> [!check] 完成标准
> 当另一位数据同事不看聊天记录，只根据口径卡、回归样本和代码就能复跑同一结果；当业务负责人能指出一个异常对应的原始对象、处置动作和复核证据；当系统能够阻止未授权或状态非法的数据进入下游，这篇“${spec.title}”才算真正落到工作里。

## 公开资料与进一步阅读

${spec.references.map(([name, url]) => `- [${name}](${url})`).join("\n")}

- 企业内部的${spec.title}数据字典、流程文件、指标口径、权限制度和事故复盘。使用前应核对版本、适用机构、生效日期和责任人。
- 搜索补充资料时，优先核对监管机构、标准组织、产品官方文档和可验证案例，不把营销软文、匿名截图或单一博客结论直接当作生产依据。

> [!warning] 使用边界
> 本文为原创方法型内容，不复制任何付费文章的隐藏正文。文中的组织、人员、批次、金额、患者和结果均为脱敏或复合示例。正式项目必须使用获授权数据，并由业务、数据、安全、合规和质量负责人根据现行制度确认口径、权限、上线与回滚方案。
`;
}

module.exports = {
  buildBlueprintArticle,
  findSpec
};
