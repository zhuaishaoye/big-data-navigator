const crypto = require("node:crypto");
const { buildTopicCode } = require("./topic-code-templates");
const { matchTitleSpecialty } = require("./member-title-profiles");
const { buildTitleSpecificArticle } = require("./specialty-article");
const { buildBlueprintArticle } = require("./title-blueprints");
const {
  buildTitlePracticeExtension,
  insertBeforeReferences
} = require("./title-practice-extension");

const DOMAIN_LIBRARY = {
  "医疗健康": {
    key: "healthcare",
    label: "医疗健康",
    scene: "门诊、住院、检查检验、用药、随访、支付结算和医疗质量管理",
    participants: ["患者", "临床科室", "护理团队", "医技科室", "医务管理", "医保与财务", "信息中心"],
    stages: ["预约与挂号", "接诊与分诊", "检查检验", "诊断与治疗", "出院与结算", "随访与质量复盘"],
    entities: [
      ["患者", "patient_id"],
      ["就诊", "visit_id"],
      ["医嘱", "order_id"],
      ["检查检验", "report_id"],
      ["费用", "settlement_id"]
    ],
    factTable: "fact_medical_event",
    dimTable: "dim_patient",
    dateField: "event_date",
    dims: ["院区", "科室", "病种", "人群", "支付方式"],
    metricDefs: [
      ["门急诊人次", "COUNT(DISTINCT visit_id)", "visit_cnt"],
      ["平均住院日", "SUM(discharge_days) / COUNT(DISTINCT inpatient_visit_id)", "avg_los"],
      ["复诊率", "COUNT(DISTINCT revisit_patient_id) / COUNT(DISTINCT index_patient_id)", "revisit_rate"],
      ["异常检验占比", "COUNT(DISTINCT abnormal_report_id) / COUNT(DISTINCT report_id)", "abnormal_rate"],
      ["费用偏差率", "ABS(actual_amount - expected_amount) / expected_amount", "fee_gap_rate"]
    ],
    systems: ["HIS", "EMR", "LIS", "RIS", "PACS", "医保结算系统", "随访平台"],
    controls: ["患者主索引跨院区唯一", "就诊时间与医嘱时间有序", "诊断编码在有效版本内", "检验结果带单位与参考区间", "费用明细与结算总额可对账"],
    risks: ["患者隐私泄露", "多院区患者主索引重复", "临床时间与计费时间混用", "检验单位不统一", "历史诊断编码版本失效"],
    cases: [
      {
        org: "华东某三甲医院",
        trigger: "门诊高峰期投诉增加，管理层希望判断问题来自号源、接诊、检查还是报告回传",
        data: "3 个院区 18 个月挂号、报到、叫号、医嘱、检查、报告和结算事件",
        problem: "各系统用就诊号、住院号和申请单号交叉关联，报告回传时间缺少统一时区",
        action: "建立患者主索引和就诊主键，把门诊流程拆成 8 个事件节点，按院区、科室和时段做分层基线",
        outcome: "示例项目把流程断点定位从人工拉取多个系统缩短到一张小时级监控，并形成报告超时催办规则"
      },
      {
        org: "华南某区域医疗集团",
        trigger: "集团合并报表中同一患者的跨院区就诊被重复计算，重点专科服务量口径长期不一致",
        data: "5 家成员医院患者、机构、科室、诊断、就诊和费用数据",
        problem: "患者证件号存在空值，院内卡号不能跨院使用，科室历史组织架构多次调整",
        action: "设计患者、机构、科室三套主数据映射，保留维度有效期，建立指标口径评审和责任签字机制",
        outcome: "示例项目把服务量差异拆成重复患者、跨期结算和科室归属三类，并形成月结对账流程"
      },
      {
        org: "华中某互联网医院",
        trigger: "在线问诊订单增长但完成率下降，运营团队无法判断是医生供给、消息触达还是支付环节问题",
        data: "问诊下单、支付、医生接诊、图文消息、处方审核、药品配送和退款事件",
        problem: "匿名咨询与登录账号未打通，超时未接诊被误判为取消，退款事件重复上报",
        action: "建立用户、问诊单和支付单三级粒度，对超时、取消、退款和重新下单分别建模，补充漏斗诊断",
        outcome: "示例项目定位到夜间接诊供给缺口，并建立了分时段排班与超时预警看板"
      },
      {
        org: "华北某医学影像中心",
        trigger: "影像检查量持续增长，但报告及时率波动明显，疑似与设备、检查部位和审核流程有关",
        data: "检查申请、排队、扫描、图像归档、初诊、复审和报告发布日志",
        problem: "PACS 与 RIS 状态含义不同，设备停机时间没有进入分析链路，节假日排班缺失",
        action: "统一检查状态机，补充设备日历和人员排班，按检查部位、设备型号与班次分析报告时延",
        outcome: "示例项目将问题拆分为设备等待、初诊积压和复审返工三类，并建立分位数时延监控"
      }
    ],
    regulations: ["《个人信息保护法》的最小必要原则", "《数据安全法》的数据分类分级要求", "医疗质量安全核心制度", "电子病历应用管理规范"]
  },
  "零售电商": {
    key: "retail",
    label: "零售电商",
    scene: "商品曝光、内容种草、访问浏览、加购下单、支付履约、退款售后和会员复购",
    participants: ["用户", "商品运营", "店铺运营", "投放团队", "供应链", "客服", "风控与财务"],
    stages: ["曝光", "点击", "详情浏览", "加购", "下单", "支付", "履约", "复购或流失"],
    entities: [
      ["用户", "user_id"],
      ["商品", "sku_id"],
      ["会话", "session_id"],
      ["订单", "order_id"],
      ["退款", "refund_id"]
    ],
    factTable: "fact_retail_event",
    dimTable: "dim_user",
    dateField: "event_time",
    dims: ["渠道", "品类", "地区", "用户层级", "活动"],
    metricDefs: [
      ["支付转化率", "COUNT(DISTINCT paid_order_id) / COUNT(DISTINCT visit_session_id)", "pay_cvr"],
      ["客单价", "SUM(paid_amount) / COUNT(DISTINCT paid_order_id)", "avg_order_value"],
      ["复购率", "COUNT(DISTINCT repeat_buyer_id) / COUNT(DISTINCT buyer_id)", "repurchase_rate"],
      ["退款率", "SUM(refund_amount) / SUM(paid_amount)", "refund_rate"],
      ["毛利额", "SUM(net_revenue - product_cost - fulfillment_cost)", "gross_profit"]
    ],
    systems: ["ERP", "WMS", "OMS", "CRM", "CDP", "广告投放平台", "客服工单系统"],
    controls: ["订单与支付金额平衡", "退款不重复冲减", "自然流量与付费流量归因唯一", "商品上下架时间可追溯", "渠道和活动维度使用当时快照"],
    risks: ["重复订单与重复退款", "跨渠道归因重叠", "会员与匿名身份合并错误", "活动价与成交价混用", "履约取消未冲减"],
    cases: [
      {
        org: "华东某服饰电商",
        trigger: "大促销售额增长但毛利下降，业务方希望拆清折扣、退货、履约成本和渠道结构的影响",
        data: "商品、活动、订单、支付、退款、仓储出库和优惠券核销数据",
        problem: "订单表和支付表退款状态不一致，优惠金额分摊到 SKU 时存在四舍五入差异",
        action: "以订单行作为金额分析粒度，建立支付、退款和成本桥接表，按渠道与品类做贡献度拆解",
        outcome: "示例项目发现高退货品类叠加固定履约成本是主要拖累，并推动活动门槛和运费规则调整"
      },
      {
        org: "华南某连锁零售企业",
        trigger: "线上订单增长，但门店库存可用率与线上显示不一致，缺货取消率持续升高",
        data: "门店 POS、中心仓、前置仓、WMS、OMS 和即时配送订单",
        problem: "可售库存扣减存在时间差，门店盘点期间库存被错误暴露，拆单后子订单无法回溯父订单",
        action: "建立可售库存快照和库存事件双模型，增加安全库存缓冲，按仓店与商品分析取消原因",
        outcome: "示例项目把缺货原因拆成数据延迟、真实缺货和超卖拦截，并形成库存质量日报"
      },
      {
        org: "华北某内容电商平台",
        trigger: "直播场次流量很高但成交波动大，运营无法判断主播、货盘、价格和流量结构各自贡献多少",
        data: "直播间曝光、停留、商品讲解、点击、下单、支付、退款和投流消耗",
        problem: "用户跨场次重复进入，商品讲解事件缺失版本字段，投流归因窗口与其他渠道重叠",
        action: "构建直播场次-商品-用户三级明细，统一观看时长和有效点击口径，使用同期未投放场次作为基线",
        outcome: "示例项目形成场次复盘模板，将流量、内容、货盘和价格变化分开记录，减少单指标归因"
      },
      {
        org: "西南某区域商超",
        trigger: "会员数量增长但高价值会员贡献下降，促销预算无法判断应投向拉新、唤醒还是深度复购",
        data: "会员、交易、优惠券、品类偏好、到店频次和线上到家订单",
        problem: "家庭成员共用账号，手机号变更导致一人多号，历史会员等级与当前等级混用",
        action: "打通会员主数据，构建 RFM 与品类偏好组合分层，使用过去同周期基线评估券包策略",
        outcome: "示例项目把会员分成待唤醒、稳定复购和高潜流失三组，并为每组设置不同触达与停止条件"
      }
    ],
    regulations: ["《个人信息保护法》", "《电子商务法》", "消费者权益保护相关规则", "广告标识与数据使用规范"]
  },
  "制造业": {
    key: "manufacturing",
    label: "制造业",
    scene: "销售预测、生产计划、物料采购、工单执行、设备运行、质量检验、库存和交付",
    participants: ["计划", "采购", "工艺", "生产", "设备", "质量", "仓储", "交付与财务"],
    stages: ["需求计划", "排产", "备料", "工单执行", "质量检验", "入库", "发运", "售后追溯"],
    entities: [
      ["工厂", "plant_id"],
      ["产线", "line_id"],
      ["设备", "equipment_id"],
      ["工单", "work_order_id"],
      ["批次", "batch_id"]
    ],
    factTable: "fact_manufacturing_event",
    dimTable: "dim_equipment",
    dateField: "event_time",
    dims: ["工厂", "产线", "产品", "班组", "设备类型"],
    metricDefs: [
      ["良品率", "SUM(good_qty) / SUM(produced_qty)", "yield_rate"],
      ["设备稼动率", "SUM(run_minutes) / SUM(planned_minutes)", "availability"],
      ["计划达成率", "SUM(completed_plan_qty) / SUM(planned_qty)", "plan_attainment"],
      ["单位制造成本", "SUM(conversion_cost) / SUM(good_qty)", "unit_cost"],
      ["准时交付率", "COUNT(DISTINCT on_time_order_id) / COUNT(DISTINCT order_id)", "otd_rate"]
    ],
    systems: ["ERP", "MES", "PLM", "QMS", "WMS", "SCADA", "设备物联网平台"],
    controls: ["工单与批次关系完整", "停机区间不重叠", "质检结果可追到工序", "物料编码单位统一", "设备组织关系保留有效期"],
    risks: ["设备与工单编码变化导致断链", "停机时长重复计算", "质检抽样不能代表整批", "计划版本与执行版本混用", "在制品状态回退"],
    cases: [
      {
        org: "华东某汽车零部件工厂",
        trigger: "订单准时交付率下降，但生产能力数据看起来仍有富余，管理层无法判断瓶颈位置",
        data: "销售订单、主生产计划、工单、设备状态、停机和质检记录",
        problem: "计划达成率按工单数量统计，无法反映不同产品工时；设备停机原因存在人工重复录入",
        action: "统一工单、工序、设备和批次粒度，用标准工时转换产能，建立停机区间合并与瓶颈工序分析",
        outcome: "示例项目识别出换型损失和某工序返工积压，并建立按周滚动产能与交付风险清单"
      },
      {
        org: "华南某电子制造企业",
        trigger: "良品率短期波动，质量团队怀疑供应商批次，但生产记录与来料检验无法快速关联",
        data: "供应商、来料批次、投料记录、设备参数、工序质检和售后返修",
        problem: "同一物料存在供应商编码、内部料号和制造商料号三套标识，批次追溯在手工补录处断开",
        action: "建立物料主数据映射和批次谱系，按供应商批次、设备、班组和参数窗口做交叉分析",
        outcome: "示例项目把异常批次追溯从数天缩短到小时级，并增加了参数越界与批次隔离规则"
      },
      {
        org: "华北某新能源装备工厂",
        trigger: "设备预测性维护项目告警很多，但真正停机次数没有明显下降，现场对模型失去信任",
        data: "振动、温度、电流、报警、维修工单、备件更换和停机记录",
        problem: "传感器时间未统一，报警只记录触发不记录恢复，维修工单与设备状态缺少关联",
        action: "先补事件状态机和标签质量，再建立提前预警窗口，按设备型号评估召回率和误报成本",
        outcome: "示例项目把模型目标从单一准确率改为提前时长、有效召回和维修资源可承受度"
      },
      {
        org: "西南某食品加工企业",
        trigger: "多工厂成本和损耗口径不同，集团无法比较不同产线的真实改善效果",
        data: "工单投入产出、物料领用、能源、人工、报废、返工和成品入库",
        problem: "月末盘点差异被平均分摊到所有批次，能源表计读数跨日切分不一致",
        action: "建立投入产出平衡、能源分摊和标准成本桥接，统一损耗定义与关账流程",
        outcome: "示例项目将成本差异拆成价格、用量、良率和产量结构，并形成每周可行动清单"
      }
    ],
    regulations: ["ISA-95 分层思想", "ISO 9001 质量管理原则", "设备安全与生产记录留痕要求", "数据分类分级与商业秘密保护要求"]
  },
  "金融行业": {
    key: "finance",
    label: "金融行业",
    scene: "客户开户、交易、授信、风险监测、资产配置、支付清算、服务与合规审计",
    participants: ["客户", "客户经理", "产品团队", "风险管理", "合规", "运营", "财务", "科技与数据团队"],
    stages: ["获客与准入", "开户", "交易或授信", "风险监测", "结算", "服务", "退出或续约"],
    entities: [
      ["客户", "customer_id"],
      ["账户", "account_id"],
      ["交易", "transaction_id"],
      ["申请", "application_id"],
      ["风险事件", "risk_event_id"]
    ],
    factTable: "fact_finance_event",
    dimTable: "dim_customer",
    dateField: "event_time",
    dims: ["机构", "产品", "渠道", "客户等级", "风险等级"],
    metricDefs: [
      ["活跃客户数", "COUNT(DISTINCT active_customer_id)", "active_customers"],
      ["资产规模", "SUM(end_of_day_balance)", "aum"],
      ["逾期率", "SUM(overdue_principal) / SUM(outstanding_principal)", "overdue_rate"],
      ["风险拦截率", "COUNT(DISTINCT blocked_event_id) / COUNT(DISTINCT risk_event_id)", "block_rate"],
      ["客户流失率", "COUNT(DISTINCT churn_customer_id) / COUNT(DISTINCT opening_customer_id)", "churn_rate"]
    ],
    systems: ["核心银行系统", "信贷系统", "支付清算系统", "反洗钱系统", "CRM", "数据仓库", "风险决策引擎"],
    controls: ["客户号脱敏且跨系统映射一致", "借贷与支付金额平衡", "交易时间与入账时间区分", "风险标签可追溯到规则版本", "时点快照与流水不混用"],
    risks: ["敏感数据越权访问", "授信金额与借据余额混用", "产品口径随组织调整无法比较", "风险规则版本不可追溯", "冲正交易未成对处理"],
    cases: [
      {
        org: "华东某城市商业银行",
        trigger: "经营看板同时出现客户增长和资产流失，业务方无法判断是新客质量下降还是高价值客户迁移",
        data: "客户、账户、产品持仓、交易、渠道访问和客户经理服务记录",
        problem: "客户等级使用当前值回溯历史，理财产品申赎存在非交易日确认，跨行转账冲正未成对",
        action: "建立客户与账户每日快照，区分交易流水和余额快照，按客户层级与产品分析资产净流入",
        outcome: "示例项目定位到短期理财到期集中流出，并增加到期前触达与产品承接分析"
      },
      {
        org: "华南某消费金融公司",
        trigger: "逾期率上升，风险团队希望区分客群变化、准入规则和贷后触达的影响",
        data: "申请、授信、借款、还款计划、实际还款、催收和风险规则版本",
        problem: "申请件与借款件一对多，规则版本覆盖时间不完整，展期后账龄计算口径不统一",
        action: "建立申请-借据-还款计划三级模型，固定风险规则生效区间，按账龄和放款批次做同口径分析",
        outcome: "示例项目将逾期变化拆成新客结构、额度使用和早期还款行为，并建立规则回滚观察指标"
      },
      {
        org: "华北某证券公司",
        trigger: "财富管理客户活跃度下降，运营希望知道是行情、产品收益还是服务触达不足",
        data: "开户、登录、交易、持仓、产品浏览、资讯点击、客服和投顾服务",
        problem: "同一客户存在多个资金账号，机构客户与个人客户标签混用，登录事件存在机器流量",
        action: "建立客户-账户-产品视图，剔除异常访问，使用同期行情分组和客户风险偏好做对照",
        outcome: "示例项目形成按风险等级和产品类型的活跃诊断，不把市场普跌直接解释为服务失效"
      },
      {
        org: "西南某保险机构",
        trigger: "代理渠道保费增长但续期率下降，渠道结算与客户服务质量难以同时评估",
        data: "代理人、保单、缴费、理赔、投诉、续期和渠道结算",
        problem: "保单状态与缴费状态跨系统不同步，代理人组织归属频繁变化，退保与失效口径混用",
        action: "保留代理人和机构维度有效期，按保单件与保费拆分指标，建立首年与续期分组",
        outcome: "示例项目识别出高保费低继续率渠道，并推动把继续率纳入渠道质量评价"
      }
    ],
    regulations: ["《数据安全法》与《个人信息保护法》", "巴塞尔协议风险计量思想", "反洗钱客户尽职调查要求", "金融数据分类分级与访问审计规范"]
  },
  "教育培训": {
    key: "education",
    label: "教育培训",
    scene: "招生线索、课程报名、学习行为、作业考试、续费退费、就业与教学质量管理",
    participants: ["学员", "家长", "销售顾问", "班主任", "讲师", "教研", "教务", "产品与数据分析"],
    stages: ["线索", "试听", "报名", "开课", "学习", "考试", "续费", "退费或毕业"],
    entities: [
      ["学员", "student_id"],
      ["线索", "lead_id"],
      ["课程", "course_id"],
      ["班级", "class_id"],
      ["学习事件", "learning_event_id"]
    ],
    factTable: "fact_education_event",
    dimTable: "dim_student",
    dateField: "event_time",
    dims: ["渠道", "课程", "班级", "地区", "学员阶段"],
    metricDefs: [
      ["线索转化率", "COUNT(DISTINCT paid_student_id) / COUNT(DISTINCT valid_lead_id)", "lead_cvr"],
      ["到课率", "COUNT(DISTINCT attended_session_id) / COUNT(DISTINCT scheduled_session_id)", "attendance_rate"],
      ["完课率", "COUNT(DISTINCT completed_student_id) / COUNT(DISTINCT enrolled_student_id)", "completion_rate"],
      ["续费率", "COUNT(DISTINCT renewed_student_id) / COUNT(DISTINCT renewable_student_id)", "renewal_rate"],
      ["学习时长", "SUM(valid_learning_seconds) / 3600", "learning_hours"]
    ],
    systems: ["CRM", "LMS", "SIS", "教务系统", "直播课堂", "订单与支付系统", "客服工单系统"],
    controls: ["试听与正式课分开统计", "一人多号已合并", "刷课时长已剔除", "退费与订单状态一致", "课程和班级历史关系可追溯"],
    risks: ["试听行为混入正式转化", "自动播放造成虚假学习时长", "同一学员多平台账号重复", "退费后仍计入续费", "课程版本变化导致成绩不可比"],
    cases: [
      {
        org: "华东某职业教育机构",
        trigger: "招生线索增长但报名转化下降，销售认为线索质量变差，市场团队认为跟进不及时",
        data: "广告渠道、线索分配、首次联系、试听预约、试听到课、报价和支付",
        problem: "重复线索未去重，销售首次联系时间存在手工修改，试听取消未回写 CRM",
        action: "统一有效线索定义，建立线索-试听-订单事件链，按渠道、响应时长和顾问分组做转化分析",
        outcome: "示例项目识别出响应超时和高意向课程错配两类问题，并形成线索质量与跟进质量双看板"
      },
      {
        org: "华南某在线教育平台",
        trigger: "课程完课率下降但用户投诉不多，产品团队怀疑课程难度和提醒策略有问题",
        data: "报名、直播观看、回放、作业提交、测验、教师反馈和续费",
        problem: "后台播放时长包含挂机，课程章节中途改版，退费学员仍进入续费分母",
        action: "用有效播放与交互行为共同定义学习时长，建立课程版本和学员进度表，按章节分析流失点",
        outcome: "示例项目定位到第 3 章作业难度和提醒频率不当，并建立章节级学习健康度预警"
      },
      {
        org: "华北某 K12 教育集团",
        trigger: "校区续费率差异明显，管理者希望区分教学质量、服务频次和学员基础的影响",
        data: "入学测评、到课、作业、阶段考试、家长沟通、投诉和续费",
        problem: "不同校区测评试卷不同，教师更换记录缺失，续费窗口按自然月而非课程结束日",
        action: "统一标准化成绩增量，建立学员-班级-教师关系有效期，按续费窗口比较同年级同班型",
        outcome: "示例项目把续费差异拆成学习进步、出勤、服务触达和价格敏感四类因素"
      },
      {
        org: "西南某高校继续教育平台",
        trigger: "线上培训项目报名人数多，但证书完成率和企业满意度偏低",
        data: "企业报名、学员账号、课程资源、考试、证书、学习支持和满意度问卷",
        problem: "企业管理员替员工报名导致身份错配，考试补考次数未记录，满意度样本严重偏斜",
        action: "建立企业项目-学员-课程三级模型，拆分首次通过和补考通过，补充分层抽样回访",
        outcome: "示例项目发现移动端兼容和考试提醒不足是主要完成障碍，并推动课程包重构"
      }
    ],
    regulations: ["《个人信息保护法》未成年人信息保护要求", "教育移动互联网应用备案与管理要求", "在线教育服务与收费规范", "学员数据最小化采集与授权留痕原则"]
  },
  "交通物流": {
    key: "logistics",
    label: "交通物流",
    scene: "下单、揽收、分拨、干线运输、末端配送、签收、退件和异常处理",
    participants: ["寄件人", "收件人", "网点", "分拨中心", "承运商", "司机", "客服", "调度"],
    stages: ["下单", "揽收", "分拨", "干线", "到站", "派送", "签收", "退件或理赔"],
    entities: [
      ["运单", "waybill_id"],
      ["包裹", "parcel_id"],
      ["车辆", "vehicle_id"],
      ["线路", "route_id"],
      ["扫描事件", "scan_id"]
    ],
    factTable: "fact_logistics_event",
    dimTable: "dim_route",
    dateField: "event_time",
    dims: ["线路", "仓库", "承运商", "时效类型", "地区"],
    metricDefs: [
      ["准时率", "COUNT(DISTINCT on_time_waybill_id) / COUNT(DISTINCT delivered_waybill_id)", "on_time_rate"],
      ["破损率", "COUNT(DISTINCT damaged_waybill_id) / COUNT(DISTINCT delivered_waybill_id)", "damage_rate"],
      ["遗失率", "COUNT(DISTINCT lost_waybill_id) / COUNT(DISTINCT accepted_waybill_id)", "loss_rate"],
      ["单票成本", "SUM(linehaul_cost + sorting_cost + delivery_cost) / COUNT(DISTINCT waybill_id)", "cost_per_bill"],
      ["签收时长", "AVG(delivered_at - accepted_at)", "delivery_duration"]
    ],
    systems: ["OMS", "TMS", "WMS", "网点系统", "轨迹平台", "客服工单系统", "结算系统"],
    controls: ["运单轨迹时间有序", "重复扫描按规则去重", "站点编码与组织关系有效", "异常件状态闭环", "跨时区时间统一"],
    risks: ["轨迹重复扫描", "异常件状态回退", "干线车辆与运单关联缺失", "签收时间被批量修改", "多承运商成本口径不一致"],
    cases: [
      {
        org: "华东某快递网络",
        trigger: "部分线路准时率下降，但分拨中心产能和车辆数量没有明显变化",
        data: "揽收、发车、到车、分拨、派送、签收和客服异常工单",
        problem: "同一节点重复扫描，车辆晚点记录只在调度系统，运单轨迹不能反映真实等待",
        action: "建立运单与车辆双事件模型，合并重复扫描，按线路、班次和中转节点拆解时效",
        outcome: "示例项目定位到到站卸车等待和小网点派送积压，并增加班次到达与积压预警"
      },
      {
        org: "华南某即时配送平台",
        trigger: "订单增加但骑手单均收入下降，用户体验也出现波动，需要判断调度策略是否失效",
        data: "订单、门店出餐、骑手位置、接单、到店、取餐、送达、超时与补偿",
        problem: "位置事件频率不一致，商家出餐完成时间依赖人工点击，取消重派订单被重复计入",
        action: "统一订单-配送单-骑手任务关系，拆分供需、出餐和路由等待，建立分区域分时段基线",
        outcome: "示例项目将超时原因拆成商家延迟、骑手缺口和路径异常，并建立补偿与调度联动规则"
      },
      {
        org: "华北某冷链物流企业",
        trigger: "客户投诉温控异常，但车辆温度报警与订单追溯无法快速对应",
        data: "车辆、车厢、传感器、运单、装车批次、温度记录和交付签收",
        problem: "传感器时区不统一，设备离线期间没有质量标记，同一车厢多批次混装",
        action: "建立车辆-车厢-运单-批次谱系，定义离线与温度越界事件，按线路和客户评估影响范围",
        outcome: "示例项目形成温控异常影响清单和证据包，把召回范围确认从人工排查变为可追溯查询"
      },
      {
        org: "西南某跨境物流服务商",
        trigger: "跨境线路时效承诺经常失准，客服需要人工查询多个承运商网站",
        data: "国内揽收、报关、干线、清关、海外派送和签收节点",
        problem: "承运商状态码不一致，跨境日期存在时区差异，清关停留缺少明确开始和结束事件",
        action: "构建统一物流状态机，保留原始状态映射版本，按国家、渠道和运输方式设置分段 SLA",
        outcome: "示例项目把全链路时效分解为国内、出境、清关和末端四段，并为客服提供异常节点提示"
      }
    ],
    regulations: ["《数据安全法》与《个人信息保护法》", "寄递服务用户个人信息安全管理规定", "道路运输与危险货物管理要求", "跨境数据与报关信息使用约束"]
  },
  "房地产": {
    key: "realestate",
    label: "房地产",
    scene: "土地获取、项目开发、房源管理、获客带看、认购签约、回款交付和物业服务",
    participants: ["客户", "经纪人", "案场", "营销", "工程", "成本", "财务", "物业"],
    stages: ["土地与立项", "设计报建", "施工", "取证", "获客", "认购", "签约", "回款", "交付"],
    entities: [
      ["项目", "project_id"],
      ["房源", "unit_id"],
      ["客户", "customer_id"],
      ["带看", "visit_id"],
      ["合同", "contract_id"]
    ],
    factTable: "fact_realestate_event",
    dimTable: "dim_project",
    dateField: "event_time",
    dims: ["城市", "项目", "户型", "渠道", "客户来源"],
    metricDefs: [
      ["来访转化率", "COUNT(DISTINCT subscribed_customer_id) / COUNT(DISTINCT visit_customer_id)", "visit_cvr"],
      ["认购率", "COUNT(DISTINCT subscribed_unit_id) / COUNT(DISTINCT visiting_customer_id)", "subscription_rate"],
      ["签约率", "COUNT(DISTINCT signed_contract_id) / COUNT(DISTINCT subscribed_order_id)", "sign_rate"],
      ["回款率", "SUM(received_amount) / SUM(contract_amount)", "collection_rate"],
      ["去化周期", "AVG(sold_at - launched_at)", "absorption_days"]
    ],
    systems: ["售楼系统", "CRM", "成本系统", "工程计划系统", "财务系统", "物业系统", "营销投放平台"],
    controls: ["房源状态唯一且可追溯", "客户归属有有效期和判客规则", "退订已冲减", "合同金额与回款可对账", "项目分期与楼栋关系完整"],
    risks: ["客户重复归属", "退订未冲减", "项目阶段口径混用", "合同金额与回款不一致", "房源冻结与销售状态不同步"],
    cases: [
      {
        org: "华东某区域房企",
        trigger: "营销费用增长但认购率没有改善，管理层希望识别渠道质量和案场转化问题",
        data: "广告线索、来电来访、判客、带看、认购、签约和佣金结算",
        problem: "同一客户被多个渠道重复报备，退订订单未回写营销系统，来访到认购的窗口口径不一致",
        action: "统一客户和线索主键，建立渠道-来访-认购-签约漏斗，按项目、渠道和案场做同周期对比",
        outcome: "示例项目识别出低质量渠道和案场跟进断点，并推动线索有效期与佣金结算规则统一"
      },
      {
        org: "华南某商业地产集团",
        trigger: "购物中心客流恢复但租金收入低于预期，需要区分析客流、租户销售和租约结构",
        data: "客流设备、会员、租户 POS、租约、租金账单、活动和物业工单",
        problem: "客流设备重复计数，租户销售上报周期不同，免租期与固定租金在月报中混用",
        action: "建立项目-楼层-店铺-租约模型，区分固定租金、提成租金与免租期，按业态计算销售坪效",
        outcome: "示例项目形成租户健康度分层，为续租、调铺和活动资源分配提供统一依据"
      },
      {
        org: "华北某物业服务企业",
        trigger: "物业费收缴率下降，客服认为业主满意度降低，财务认为账单触达不足",
        data: "房产、业主、账单、支付、工单、投诉、门禁和设备报修",
        problem: "房屋买卖后业主关系未及时变更，历史欠费与当前账单混在一起，工单关闭质量无复核",
        action: "建立房产-业主关系有效期，拆分账期与实收流水，将投诉和缴费行为按小区与人群关联",
        outcome: "示例项目把欠费原因拆成关系错误、支付渠道和真实意愿三类，并建立账单触达闭环"
      },
      {
        org: "西南某长租公寓平台",
        trigger: "出租率短期提升但退租率也增加，运营希望判断价格活动是否吸引到不匹配客群",
        data: "房源、客源、带看、签约、租约、租金、维修、投诉和退租",
        problem: "同一房源多次上架导致生命周期断裂，优惠分摊和租约变更处理不一致",
        action: "构建房源-租约-账单生命周期，按客群、房源和活动拆分续租与退租，使用同期群观察",
        outcome: "示例项目发现高优惠吸引了短租倾向人群，并调整活动门槛和租期结构"
      }
    ],
    regulations: ["《个人信息保护法》", "房地产交易与预售资金监管要求", "不动产登记与合同留痕规范", "物业收费与业主信息保护要求"]
  },
  "能源电力": {
    key: "energy",
    label: "能源电力",
    scene: "发电、输配电、用电计量、负荷预测、市场交易、设备检修、告警和客户服务",
    participants: ["发电场站", "调度", "电网运维", "交易团队", "用电客户", "设备厂商", "安全与监管部门"],
    stages: ["采集", "计量", "监测", "预测", "调度", "交易结算", "检修", "客户服务"],
    entities: [
      ["场站", "station_id"],
      ["设备", "equipment_id"],
      ["表计", "meter_id"],
      ["用户", "customer_id"],
      ["量测事件", "measurement_id"]
    ],
    factTable: "fact_energy_event",
    dimTable: "dim_meter",
    dateField: "reading_time",
    dims: ["区域", "场站", "设备类型", "用户类型", "时段"],
    metricDefs: [
      ["负荷率", "AVG(actual_load) / MAX(capacity)", "load_factor"],
      ["用电量", "SUM(meter_delta_kwh)", "energy_kwh"],
      ["线损率", "(SUM(input_kwh) - SUM(output_kwh)) / SUM(input_kwh)", "line_loss_rate"],
      ["设备可用率", "SUM(available_minutes) / SUM(planned_minutes)", "availability"],
      ["告警闭环时长", "AVG(closed_at - raised_at)", "alert_closure_time"]
    ],
    systems: ["SCADA", "EMS", "DMS", "计量自动化系统", "设备资产系统", "电力交易系统", "客服系统"],
    controls: ["表码读数单调", "采集频率与时区一致", "缺失点已标记", "设备关系有效期正确", "换表前后电量可衔接"],
    risks: ["采集频率不一致", "表计换表和时区导致重复计量", "设备资产关系失真", "告警风暴掩盖真实故障", "交易与计量边界不一致"],
    cases: [
      {
        org: "华东某省级电网公司",
        trigger: "区域线损率异常升高，但售电量与供电量各自都有合理增长，需要快速定位",
        data: "变电站关口表、台区表、用户表、换表工单、采集失败和设备档案",
        problem: "换表期间新旧表计重叠采集，部分台户关系未及时更新，采集缺失被直接当成零电量",
        action: "建立表计-台区-用户关系有效期，按采集完整率修正分母，对换表和缺失时段单独标记",
        outcome: "示例项目定位到档案错挂和采集缺失两类原因，并建立线损异常的时段级核查清单"
      },
      {
        org: "华北某新能源场站",
        trigger: "风电和光伏出力预测偏差导致偏差考核增加，场站希望改善预测与交易协同",
        data: "气象预报、实测功率、机组状态、检修计划、限电和现货价格",
        problem: "气象数据时间粒度与功率采样不一致，检修和限电未作为模型特征，考核口径未统一",
        action: "构建时间对齐和可用容量修正流程，分离天气误差、设备可用性和调度约束，按时段评估预测",
        outcome: "示例项目形成日前、日内和实时三层预测评估，并把偏差成本纳入模型选择"
      },
      {
        org: "南方某城市供电局",
        trigger: "设备告警数量持续增长，但真正故障处理资源有限，运维团队需要确定优先级",
        data: "SCADA 告警、巡检、在线监测、故障工单、停电记录和重要用户清单",
        problem: "重复告警未合并，告警等级与业务影响不匹配，重要用户关系分散在多个系统",
        action: "建立告警事件化和设备-线路-用户影响链，结合持续时长、重复次数和客户等级计算优先级",
        outcome: "示例项目减少重复告警干扰，并把高风险设备和重要用户纳入优先巡检清单"
      },
      {
        org: "西北某综合能源服务公司",
        trigger: "园区用能成本上涨，客户希望判断节能改造和负荷转移的真实收益",
        data: "分项计量、生产班次、天气、电价、储能充放电和设备运行",
        problem: "总表与分表口径不一致，电价尖峰平谷跨月，节能量没有基线调整",
        action: "建立总表-分表平衡和基线模型，区分价格变化、产量变化与改造节能效果",
        outcome: "示例项目形成改造前后同产量同温度对比，并给出储能与负荷转移的收益测算"
      }
    ],
    regulations: ["《数据安全法》与关键信息基础设施保护要求", "电力监控系统安全防护规定", "电能计量装置管理规范", "电力市场信息披露与交易合规要求"]
  },
  "农业": {
    key: "agriculture",
    label: "农业",
    scene: "地块管理、播种、施肥、灌溉、植保、采收、加工、仓储、流通和溯源",
    participants: ["农户", "合作社", "农技服务", "种植基地", "加工企业", "渠道采购", "监管与质检"],
    stages: ["选种", "播种", "田间管理", "采收", "分级", "加工", "仓储", "流通", "溯源"],
    entities: [
      ["地块", "plot_id"],
      ["作物", "crop_id"],
      ["批次", "batch_id"],
      ["农事任务", "task_id"],
      ["投入品", "input_id"]
    ],
    factTable: "fact_agriculture_event",
    dimTable: "dim_plot",
    dateField: "operation_date",
    dims: ["区域", "地块", "作物", "批次", "农事类型"],
    metricDefs: [
      ["亩产量", "SUM(harvest_kg) / SUM(planted_mu)", "yield_per_mu"],
      ["投入成本", "SUM(seed_cost + fertilizer_cost + labor_cost + service_cost)", "input_cost"],
      ["损耗率", "(SUM(harvest_kg) - SUM(sellable_kg)) / SUM(harvest_kg)", "loss_rate"],
      ["合格率", "COUNT(DISTINCT passed_batch_id) / COUNT(DISTINCT inspected_batch_id)", "pass_rate"],
      ["批次追溯完整率", "COUNT(DISTINCT complete_trace_batch_id) / COUNT(DISTINCT batch_id)", "trace_complete_rate"]
    ],
    systems: ["农场管理系统", "物联网平台", "加工 MES", "仓储系统", "质量追溯平台", "电商订单系统"],
    controls: ["地块边界唯一", "批次关联完整", "气象日期与农事日期对齐", "投入品单位统一", "采收与销售重量可核对"],
    risks: ["批次追溯断链", "单位换算错误", "气象数据时空错位", "重复上报农事任务", "采收损耗与销售退货混用"],
    cases: [
      {
        org: "华东某设施农业基地",
        trigger: "番茄产量波动明显，基地希望判断是品种、温湿度、灌溉还是施肥方案导致",
        data: "温室传感器、灌溉记录、施肥任务、批次、采收和质检",
        problem: "传感器分钟级数据与农事按天记录粒度不同，设备离线未标记，多个温室的品种记录缺失",
        action: "建立地块-温室-批次-农事模型，按作物阶段聚合环境指标，区分设备缺失和真实极端天气",
        outcome: "示例项目识别出夜间湿度和灌溉间隔组合的风险窗口，并形成批次级种植复盘"
      },
      {
        org: "华南某农产品加工企业",
        trigger: "某批次产品被渠道退回，企业需要在数小时内确认原料来源和受影响成品",
        data: "收购、原料批次、加工投料、成品批次、质检、仓储和发货",
        problem: "农户交售批次与内部原料批次不是一对一，手工补录导致加工时间与质检时间冲突",
        action: "建立原料-投料-成品谱系，设置追溯完整性阻断规则，保留称重、质检和发运凭证",
        outcome: "示例项目把影响范围查询从跨表格人工比对变成批次谱系查询，并补齐关键节点字段"
      },
      {
        org: "华北某农业合作社",
        trigger: "农资投入持续增加但亩产没有同步提高，需要评估不同服务方案的真实效果",
        data: "地块、农户、农资领取、作业服务、天气、采收和成本",
        problem: "不同地块面积单位不统一，农户自购农资未入系统，方案选择与地块条件相关导致比较偏差",
        action: "统一亩制单位，建立同作物同土壤条件分组，使用种植前基线和服务记录做匹配分析",
        outcome: "示例项目区分了方案效果与地块差异，避免把好地块的高产全部归因于农资"
      },
      {
        org: "西南某生鲜供应链平台",
        trigger: "产地采购成本下降但末端毛利没有改善，损耗和退货去向不清",
        data: "采购、分级、装箱、冷链运输、仓配、门店收货、销售和退货",
        problem: "采购重量与销售重量包含不同包装，运输温控异常未进入损耗归因，退货和报损重复",
        action: "建立批次-包装-订单-损耗事件链，统一净重口径，按品类和线路分析可售率",
        outcome: "示例项目定位到分级过度和冷链等待问题，并建立采购等级与销售等级映射"
      }
    ],
    regulations: ["《数据安全法》与《个人信息保护法》", "农产品质量安全追溯要求", "农药兽药安全使用规范", "食品生产经营记录与凭证留存要求"]
  },
  "互联网商业分析": {
    key: "internet",
    label: "互联网商业分析",
    scene: "流量获取、内容消费、用户增长、交易转化、平台生态、广告变现和用户留存",
    participants: ["用户", "内容创作者", "商家", "平台运营", "产品", "算法", "广告销售", "财务与法务"],
    stages: ["拉新", "激活", "访问与互动", "转化", "留存", "变现", "召回", "生态治理"],
    entities: [
      ["用户", "user_id"],
      ["内容", "content_id"],
      ["会话", "session_id"],
      ["订单", "order_id"],
      ["广告", "campaign_id"]
    ],
    factTable: "fact_internet_event",
    dimTable: "dim_user",
    dateField: "event_time",
    dims: ["渠道", "产品", "内容类型", "用户阶段", "设备"],
    metricDefs: [
      ["点击率", "COUNT(DISTINCT click_id) / COUNT(DISTINCT impression_id)", "ctr"],
      ["转化率", "COUNT(DISTINCT conversion_id) / COUNT(DISTINCT eligible_session_id)", "cvr"],
      ["留存率", "COUNT(DISTINCT retained_user_id) / COUNT(DISTINCT cohort_user_id)", "retention_rate"],
      ["ARPU", "SUM(net_revenue) / COUNT(DISTINCT paying_or_active_user_id)", "arpu"],
      ["获客成本", "SUM(marketing_cost) / COUNT(DISTINCT attributed_new_user_id)", "cac"]
    ],
    systems: ["埋点平台", "CDP", "推荐系统", "广告平台", "订单系统", "实验平台", "财务结算系统"],
    controls: ["事件主键唯一", "匿名与登录身份打通", "时区一致", "机器流量已剔除", "渠道归因窗口明确"],
    risks: ["埋点重复", "匿名身份合并错误", "自然流量与付费流量归因重叠", "分母口径漂移", "把相关性误写成因果"],
    cases: [
      {
        org: "华东某内容社区",
        trigger: "日活增长但广告收入下降，业务希望判断是用户结构变化、内容供给还是广告库存问题",
        data: "内容曝光、点击、停留、互动、广告请求、竞价、成交和会员订单",
        problem: "机器流量混入曝光，多端账号未合并，广告曝光与计费口径不同",
        action: "建立用户-内容-广告事件模型，区分自然流量与广告流量，按内容类型和用户价值分层",
        outcome: "示例项目发现低频用户占比上升和高质量内容供给不足，并调整推荐与广告频控"
      },
      {
        org: "华南某本地生活平台",
        trigger: "补贴增加但订单和商家留存没有同步改善，需要评估补贴投向和生态健康度",
        data: "用户曝光、领券、下单、核销、退款、商家经营、配送和补贴成本",
        problem: "领券用户跨设备识别失败，核销与退款跨日，商家营业状态未进入推荐链路",
        action: "建立用户-商家-订单三级视图，用增量实验和匹配对照估计补贴效果，同时观察退款与商家留存",
        outcome: "示例项目发现部分补贴只带来短期价格敏感订单，并建立了补贴退出后的留存观察指标"
      },
      {
        org: "华北某在线广告平台",
        trigger: "广告主反馈转化成本上升，平台需要区分流量质量、归因和竞价环境",
        data: "展示、点击、落地页、注册、支付、广告主回传、竞价和投放设置",
        problem: "回传延迟导致当日成本被高估，不同广告主使用不同归因窗口，重复点击未去重",
        action: "建立延迟回补机制和统一点击-转化窗口，按行业、版位和人群拆分，并开展投放对照实验",
        outcome: "示例项目把成本变化拆成回传延迟、流量结构和竞价压力，并优化了小时级预算调整"
      },
      {
        org: "西南某会员制电商",
        trigger: "会员续费率下降，业务希望区分权益使用不足、价格敏感和用户体验问题",
        data: "会员开通、权益领取、免邮使用、专属价、订单、客服、续费和退款",
        problem: "同一个会员权益存在多个活动版本，自动续费状态未记录历史，退款订单仍计入会员贡献",
        action: "建立会员-权益-订单事件链，按开通渠道、权益使用和客群分层续费，关注不同价格周期",
        outcome: "示例项目发现免邮权益使用不足是早期流失信号，并推动新会员引导和权益提醒"
      }
    ],
    regulations: ["《个人信息保护法》", "《电子商务法》", "互联网广告管理与广告标识要求", "算法推荐与平台治理相关规范"]
  },
  "互联网科技": {
    key: "technology",
    label: "互联网科技",
    scene: "产品使用、账号行为、服务调用、订阅付费、研发交付、系统稳定性和客户支持",
    participants: ["用户", "产品经理", "研发", "SRE", "数据分析", "销售与客户成功", "安全与合规"],
    stages: ["获客", "注册", "激活", "功能使用", "付费", "续费", "支持", "流失或升级"],
    entities: [
      ["账号", "account_id"],
      ["设备", "device_id"],
      ["功能", "feature_id"],
      ["会话", "session_id"],
      ["订阅", "subscription_id"]
    ],
    factTable: "fact_product_event",
    dimTable: "dim_account",
    dateField: "event_time",
    dims: ["产品", "功能", "版本", "地区", "客户层级"],
    metricDefs: [
      ["活跃率", "COUNT(DISTINCT active_account_id) / COUNT(DISTINCT eligible_account_id)", "active_rate"],
      ["功能渗透率", "COUNT(DISTINCT account_using_feature_id) / COUNT(DISTINCT active_account_id)", "feature_adoption"],
      ["续费率", "COUNT(DISTINCT renewed_subscription_id) / COUNT(DISTINCT renewable_subscription_id)", "renewal_rate"],
      ["故障影响面", "COUNT(DISTINCT affected_account_id) / COUNT(DISTINCT active_account_id)", "incident_impact"],
      ["工单解决时长", "AVG(resolved_at - created_at)", "ticket_resolution_time"]
    ],
    systems: ["埋点平台", "账号系统", "订阅计费", "工单系统", "APM", "日志平台", "CRM"],
    controls: ["账号设备映射有效", "版本字段完整", "机器流量剔除", "订阅状态与账单一致", "故障与工单可关联"],
    risks: ["机器流量误计", "多版本并行", "订阅时点口径混淆", "故障影响面低估", "产品事件缺少版本上下文"],
    cases: [
      {
        org: "华东某 SaaS 公司",
        trigger: "客户数量增长但净收入留存下降，管理层需要区分降级、流失和新客结构",
        data: "账号、席位、订阅、账单、功能使用、工单和客户健康度",
        problem: "一个客户存在多个租户，席位变更与账单生效时间不同，降级未正确冲减",
        action: "建立客户-租户-订阅-席位模型，按同批次客户计算 NRR，拆分降级、流失、扩展和价格变化",
        outcome: "示例项目定位到低活跃客户续约前降级，并把关键功能使用纳入客户成功预警"
      },
      {
        org: "华南某云服务商",
        trigger: "服务可用率看似达标，但客户投诉集中在短时高峰和部分区域",
        data: "API 调用、错误码、延迟、可用区、客户等级、工单和故障公告",
        problem: "平均可用率掩盖小客户长尾，重试请求放大调用量，故障和工单缺少统一事件号",
        action: "建立请求级 SLI 和客户影响面模型，按分位数、区域和客户层级监控，关联故障与工单",
        outcome: "示例项目识别出重试风暴和区域网络抖动，并调整告警阈值与降级策略"
      },
      {
        org: "华北某移动工具产品",
        trigger: "新版本上线后活跃下降，产品团队无法判断是用户结构、功能改动还是埋点变化",
        data: "版本、安装、升级、启动、功能点击、崩溃、设备与渠道",
        problem: "新旧版本并行且升级用户不是随机分组，埋点在新版本改名，崩溃事件采样率变化",
        action: "保留事件字典和版本映射，按升级前后用户做同体对照，把功能行为与崩溃分开分析",
        outcome: "示例项目发现启动链路崩溃与某渠道安装包有关，并建立版本级质量门禁"
      },
      {
        org: "西南某企业软件公司",
        trigger: "客服工单增加但研发认为是少数大客户问题，需要评估真实影响和优先级",
        data: "工单、会话、功能、租户、合同、日志、版本和解决记录",
        problem: "客户用不同语言描述同一故障，工单标签维护不一致，合同等级与活跃用户数未关联",
        action: "建立工单主题分类和客户影响评分，把故障、使用阻断、咨询与需求分开排序",
        outcome: "示例项目识别出高频但不严重的咨询类工单，并推动自助帮助中心和根因标签治理"
      }
    ],
    regulations: ["《数据安全法》与《个人信息保护法》", "网络安全等级保护要求", "软件产品日志与审计留痕原则", "SaaS 订阅与客户数据处理协议"]
  },
  "跨行业通用": {
    key: "general",
    label: "跨行业通用",
    scene: "需求澄清、业务事件采集、指标计算、经营分析、流程优化和结果复盘",
    participants: ["业务负责人", "产品与运营", "数据开发", "数据分析", "财务", "风控", "技术运维"],
    stages: ["需求", "采集", "加工", "分析", "决策", "行动", "复盘"],
    entities: [
      ["业务对象", "entity_id"],
      ["事件", "event_id"],
      ["流程", "process_id"],
      ["组织", "org_id"],
      ["指标结果", "metric_id"]
    ],
    factTable: "fact_business_event",
    dimTable: "dim_business_entity",
    dateField: "event_time",
    dims: ["时间", "业务类型", "地区", "对象层级", "来源渠道"],
    metricDefs: [
      ["业务量", "COUNT(DISTINCT event_id)", "event_cnt"],
      ["转化率", "COUNT(DISTINCT success_id) / COUNT(DISTINCT eligible_id)", "conversion_rate"],
      ["处理时长", "AVG(completed_at - started_at)", "processing_time"],
      ["质量率", "COUNT(DISTINCT valid_id) / COUNT(DISTINCT checked_id)", "quality_rate"],
      ["成本", "SUM(direct_cost + allocated_cost)", "total_cost"]
    ],
    systems: ["业务系统", "CRM", "ERP", "数据仓库", "调度平台", "BI", "工单系统"],
    controls: ["主键唯一", "时间完整", "枚举受控", "金额与数量关系合理", "指标口径版本可追溯"],
    risks: ["口径未冻结", "主数据不一致", "异常值未处理", "上下游延迟", "分析结论无法落地"],
    cases: [
      {
        org: "某全国连锁服务企业",
        trigger: "管理层发现营业额增长但利润下降，跨部门对原因判断不一致",
        data: "门店、订单、客户、活动、成本、人员和工单数据",
        problem: "收入与成本时间归属不同，活动优惠分摊不完整，组织调整导致门店历史归属变化",
        action: "统一经营分析粒度，建立收入成本桥接和门店维度有效期，按地区、业态和活动拆解",
        outcome: "示例项目把利润变化拆成价格、数量、成本和结构四部分，并形成月度复盘模板"
      },
      {
        org: "某大型企业数据平台团队",
        trigger: "报表数量增长但业务仍反馈找不到可信数据，数据团队交付压力持续上升",
        data: "表、任务、指标、血缘、质量规则、查询日志和问题工单",
        problem: "同一指标多个 SQL 版本，血缘只覆盖部分任务，资产没有明确负责人",
        action: "盘点核心指标和资产，建立责任人和版本机制，把质量规则和影响分析接入发布流程",
        outcome: "示例项目减少重复取数问题，并为高影响指标建立变更通知和回滚清单"
      },
      {
        org: "某快速扩张的运营团队",
        trigger: "新策略上线后短期指标提升，但两个月后用户投诉和退款增加",
        data: "策略曝光、用户分层、转化、留存、退款、投诉和客服记录",
        problem: "只观察短期转化，没有设置对照组，退款和投诉没有纳入长期目标",
        action: "补充同周期对照和护栏指标，把成功标准写成主指标、护栏指标和停止条件",
        outcome: "示例项目避免了仅凭短期增长扩大策略，并形成试验评审与退出机制"
      },
      {
        org: "某集团数据治理办公室",
        trigger: "多个业务域的数据质量问题反复出现，但整改责任和优先级难以落实",
        data: "数据资产、质量问题、责任团队、工单、修复记录和影响范围",
        problem: "问题只有告警没有分级，跨团队责任边界不清，同类问题没有根因标签",
        action: "建立问题分级、根因分类、负责人和时限，按影响范围和复发率排序",
        outcome: "示例项目把治理从工具告警变成闭环机制，并为季度评审提供可量化依据"
      }
    ],
    regulations: ["DAMA-DMBOK 数据管理框架", "Kimball 维度建模方法", "PDCA 与闭环改进思想", "组织数据安全与最小权限原则"]
  }
};

const TOP_CONTEXT = {
  "【数据分析与数据运营】": {
    key: "analytics",
    label: "数据分析与数据运营",
    scene: "经营监控、用户增长、活动复盘、用户分层、实验评估和策略迭代",
    participants: ["业务负责人", "产品", "运营", "数据分析", "数据开发", "财务", "客服"],
    stages: ["业务问题", "指标定义", "数据准备", "探索分析", "策略设计", "实验或灰度", "结果复盘"],
    entities: [
      ["用户", "user_id"],
      ["会话", "session_id"],
      ["行为事件", "event_id"],
      ["订单", "order_id"],
      ["策略", "strategy_id"]
    ],
    factTable: "fact_analysis_event",
    dimTable: "dim_user",
    dateField: "event_time",
    dims: ["渠道", "用户分层", "活动", "产品", "地区"],
    metricDefs: [
      ["转化率", "COUNT(DISTINCT conversion_id) / COUNT(DISTINCT eligible_id)", "cvr"],
      ["留存率", "COUNT(DISTINCT retained_user_id) / COUNT(DISTINCT cohort_user_id)", "retention_rate"],
      ["客单价", "SUM(paid_amount) / COUNT(DISTINCT paid_order_id)", "avg_order_value"],
      ["复购率", "COUNT(DISTINCT repeat_buyer_id) / COUNT(DISTINCT buyer_id)", "repurchase_rate"],
      ["增量收益", "treatment_gain - control_gain", "incremental_value"]
    ],
    systems: ["埋点平台", "CRM", "订单系统", "实验平台", "BI", "客服工单", "数据仓库"],
    controls: ["事件主键唯一", "分子分母同口径", "匿名与登录身份已打通", "时区一致", "退款与撤销已冲减"],
    risks: ["埋点重复", "分母漂移", "把相关性误写成因果", "活动归因重叠", "只观察短期指标"],
    cases: DOMAIN_LIBRARY["互联网商业分析"].cases,
    regulations: ["Kohavi 等在线对照实验方法", "指标体系与维度建模通用方法", "统计推断与因果推断基本原则", "个人信息最小化与授权原则"]
  },
  "【数据治理与数据管理】": {
    key: "governance",
    label: "数据治理与数据管理",
    scene: "数据标准、元数据、主数据、质量规则、权限审计、血缘和问题闭环",
    participants: ["数据治理办公室", "业务数据负责人", "数据开发", "数据分析", "安全合规", "平台团队", "审计"],
    stages: ["资产盘点", "标准定义", "责任认领", "规则设计", "执行监控", "问题闭环", "成熟度评估"],
    entities: [
      ["数据资产", "asset_id"],
      ["字段", "column_id"],
      ["指标", "metric_id"],
      ["质量规则", "rule_id"],
      ["问题工单", "issue_id"]
    ],
    factTable: "fact_data_quality_result",
    dimTable: "dim_data_asset",
    dateField: "check_time",
    dims: ["业务域", "资产层级", "规则类型", "责任团队", "严重等级"],
    metricDefs: [
      ["规则通过率", "COUNT(DISTINCT passed_rule_id) / COUNT(DISTINCT executed_rule_id)", "rule_pass_rate"],
      ["问题闭环率", "COUNT(DISTINCT closed_issue_id) / COUNT(DISTINCT raised_issue_id)", "issue_closure_rate"],
      ["资产完整率", "COUNT(DISTINCT complete_asset_id) / COUNT(DISTINCT asset_id)", "asset_completeness"],
      ["血缘覆盖率", "COUNT(DISTINCT lineage_asset_id) / COUNT(DISTINCT critical_asset_id)", "lineage_coverage"],
      ["平均修复时长", "AVG(fixed_at - raised_at)", "mean_time_to_repair"]
    ],
    systems: ["数据目录", "元数据平台", "质量平台", "权限系统", "调度平台", "工单系统", "审计平台"],
    controls: ["资产责任唯一", "规则可执行且可解释", "问题分级明确", "变更留痕完整", "敏感字段访问可审计"],
    risks: ["资产没有负责人", "规则只告警不闭环", "口径变更缺少影响分析", "权限长期累积", "数据目录与真实血缘脱节"],
    cases: DOMAIN_LIBRARY["跨行业通用"].cases,
    regulations: ["DAMA-DMBOK 数据管理知识体系", "DCMM 数据管理能力成熟度思想", "《数据安全法》与《个人信息保护法》", "COSO 与内部控制中的职责分离原则"]
  },
  "【数据开发与数据架构】": {
    key: "engineering",
    label: "数据开发与数据架构",
    scene: "数据接入、离线与实时处理、数仓建模、调度发布、数据服务、稳定性和成本治理",
    participants: ["数据开发", "数据架构师", "分析师", "业务产品", "SRE", "安全", "平台团队"],
    stages: ["需求评审", "源系统接入", "模型设计", "开发测试", "发布调度", "质量监控", "服务与复盘"],
    entities: [
      ["数据源", "source_id"],
      ["数据表", "table_id"],
      ["处理任务", "job_id"],
      ["数据服务", "service_id"],
      ["运行实例", "run_id"]
    ],
    factTable: "fact_pipeline_run",
    dimTable: "dim_data_job",
    dateField: "run_time",
    dims: ["业务域", "数据层", "任务类型", "调度周期", "资源队列"],
    metricDefs: [
      ["任务成功率", "COUNT(DISTINCT success_run_id) / COUNT(DISTINCT run_id)", "run_success_rate"],
      ["数据延迟", "MAX(data_ready_at - expected_ready_at)", "data_latency"],
      ["资源消耗", "SUM(cpu_seconds + memory_gb_seconds)", "resource_usage"],
      ["重跑率", "COUNT(DISTINCT rerun_id) / COUNT(DISTINCT run_id)", "rerun_rate"],
      ["服务可用率", "SUM(successful_minutes) / SUM(total_minutes)", "service_availability"]
    ],
    systems: ["调度平台", "元数据平台", "数据质量平台", "Kafka", "Flink", "Spark", "数据仓库", "API 网关"],
    controls: ["分区覆盖完整", "任务幂等", "依赖无环", "结果可回溯", "资源使用有上限"],
    risks: ["重复写入", "依赖环", "热点倾斜", "全量重算成本失控", "发布缺少回滚"],
    cases: [
      DOMAIN_LIBRARY["零售电商"].cases[0],
      DOMAIN_LIBRARY["制造业"].cases[1],
      DOMAIN_LIBRARY["互联网科技"].cases[1],
      DOMAIN_LIBRARY["金融行业"].cases[1]
    ],
    regulations: ["Kimball 维度建模方法", "数据工程中的幂等与可观测性原则", "SRE 错误预算与服务水平目标思想", "数据安全与最小权限原则"]
  },
  "【AI 与大数据】": {
    key: "ai",
    label: "AI 与大数据",
    scene: "训练数据准备、模型实验、RAG 检索、Agent 编排、离线评估和线上监控",
    participants: ["业务产品", "算法工程师", "数据工程师", "平台工程师", "安全合规", "运营与领域专家"],
    stages: ["问题定义", "数据准备", "方案设计", "实验评估", "上线灰度", "监控反馈", "迭代治理"],
    entities: [
      ["数据集", "dataset_id"],
      ["样本", "sample_id"],
      ["模型版本", "model_version"],
      ["应用请求", "request_id"],
      ["评测案例", "eval_case_id"]
    ],
    factTable: "fact_ai_request",
    dimTable: "dim_model_version",
    dateField: "request_time",
    dims: ["业务场景", "模型版本", "租户", "数据来源", "调用类型"],
    metricDefs: [
      ["任务成功率", "COUNT(DISTINCT success_request_id) / COUNT(DISTINCT request_id)", "task_success_rate"],
      ["答案采纳率", "COUNT(DISTINCT accepted_answer_id) / COUNT(DISTINCT reviewed_answer_id)", "answer_acceptance"],
      ["检索命中率", "COUNT(DISTINCT hit_query_id) / COUNT(DISTINCT evaluated_query_id)", "retrieval_hit_rate"],
      ["P95 延迟", "PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)", "p95_latency"],
      ["单次调用成本", "SUM(model_cost + retrieval_cost) / COUNT(DISTINCT request_id)", "cost_per_request"]
    ],
    systems: ["数据仓库", "特征平台", "向量数据库", "模型服务", "实验平台", "监控平台", "权限审计"],
    controls: ["训练与评测数据隔离", "版本可追溯", "敏感字段已脱敏", "失败请求已分类", "人工反馈可回流"],
    risks: ["训练与线上样本泄漏", "模型版本不可追溯", "评测与业务目标脱节", "RAG 召回污染", "Agent 越权调用"],
    cases: [
      {
        org: "华东某企业知识库团队",
        trigger: "RAG 助手回答看似流畅，但一线人员经常找不到准确制度条款",
        data: "制度文档、版本、章节、权限、查询、召回片段、回答和人工反馈",
        problem: "文档切片跨章节，旧版本仍被索引，权限过滤在召回后执行",
        action: "按标题层级和条款结构切片，记录文档版本与权限，建立召回、引用和答案三层评测",
        outcome: "示例项目把问题拆成召回缺失、版本错误和答案越界，并建立上线前回归集"
      },
      {
        org: "华南某智能客服团队",
        trigger: "模型升级后离线准确率提高，但线上转人工率没有下降",
        data: "用户问题、意图、知识、回答、解决状态、转人工、满意度和成本",
        problem: "离线样本与真实会话分布不同，人工标注只看答案是否正确，不看是否解决问题",
        action: "按意图和用户阶段分层评测，加入任务完成率、澄清轮次、转人工和成本护栏",
        outcome: "示例项目发现新模型在复杂退款问题上过度自信，并加入低置信度澄清策略"
      },
      {
        org: "华北某数据平台团队",
        trigger: "Text-to-SQL 助手演示效果好，真实使用时常因口径和权限问题失败",
        data: "表结构、字段描述、指标口径、查询历史、SQL、执行结果和用户反馈",
        problem: "语义层缺少同义词和指标版本，模型能生成 SQL 但不知道用户是否有权访问",
        action: "把语义层、权限和查询验证串成流程，对 SQL 可执行性、结果合理性和引用做多重检查",
        outcome: "示例项目将失败分为表选择、字段歧义、口径错误和权限拒绝，并持续回流评测集"
      },
      {
        org: "西南某制造业 AI 团队",
        trigger: "设备异常检测模型准确率高，但现场维修成本反而增加",
        data: "传感器、设备、故障、维修、备件、停机和人工标注",
        problem: "正负样本按时间随机切分造成泄漏，误报成本没有进入评估，模型与维修排班脱节",
        action: "按设备和时间做分组验证，定义提前预警窗口与成本矩阵，设置人工复核和降级策略",
        outcome: "示例项目把目标改为可承受误报下的有效召回，并建立模型与维修闭环"
      }
    ],
    regulations: ["NIST AI Risk Management Framework", "OWASP LLM Top 10 风险思想", "RAG 评估与检索质量通用方法", "《生成式人工智能服务管理暂行办法》与个人信息保护要求"]
  },
  "【项目实战库】": {
    key: "project",
    label: "项目实战库",
    scene: "项目立项、现状诊断、方案设计、开发联调、上线验收、运营复盘和收益评估",
    participants: ["项目负责人", "业务负责人", "产品", "数据开发", "分析师", "平台与安全", "运维", "验收方"],
    stages: ["立项", "调研", "方案", "开发", "联调", "灰度", "上线", "验收", "运营复盘"],
    entities: [
      ["需求", "requirement_id"],
      ["里程碑", "milestone_id"],
      ["数据表", "table_id"],
      ["接口", "interface_id"],
      ["验收项", "acceptance_id"]
    ],
    factTable: "fact_project_delivery",
    dimTable: "dim_project",
    dateField: "event_date",
    dims: ["项目阶段", "业务域", "负责人", "优先级", "风险等级"],
    metricDefs: [
      ["计划达成率", "COUNT(DISTINCT on_time_milestone_id) / COUNT(DISTINCT milestone_id)", "plan_attainment"],
      ["缺陷关闭率", "COUNT(DISTINCT closed_defect_id) / COUNT(DISTINCT raised_defect_id)", "defect_closure"],
      ["上线成功率", "COUNT(DISTINCT successful_release_id) / COUNT(DISTINCT release_id)", "release_success"],
      ["验收通过率", "COUNT(DISTINCT passed_acceptance_id) / COUNT(DISTINCT acceptance_id)", "acceptance_rate"],
      ["投资回收周期", "project_cost / monthly_benefit", "payback_months"]
    ],
    systems: ["项目管理", "需求管理", "代码仓库", "调度平台", "监控平台", "数据质量平台", "财务系统"],
    controls: ["范围与验收标准明确", "上下游依赖确认", "回滚方案可执行", "结果可核对", "上线后有运营指标"],
    risks: ["范围持续扩张", "验收标准模糊", "上线后无人跟踪业务效果", "关键依赖延期", "数据迁移不可回滚"],
    cases: DOMAIN_LIBRARY["跨行业通用"].cases,
    regulations: ["PMBOK 项目范围与风险管理思想", "数据工程发布与回滚原则", "SLO 与可观测性方法", "项目验收与变更留痕要求"]
  },
  "【求职就业专题】": {
    key: "career",
    label: "求职就业专题",
    scene: "岗位分析、技能准备、项目复盘、简历表达、技术面试、案例面试和薪资沟通",
    participants: ["候选人", "招聘经理", "业务面试官", "技术面试官", "HR", "交叉协作团队"],
    stages: ["岗位研究", "能力盘点", "项目证据", "简历定制", "技术准备", "模拟面试", "复盘改进"],
    entities: [
      ["岗位", "job_id"],
      ["能力项", "skill_id"],
      ["项目", "project_id"],
      ["简历要点", "resume_item_id"],
      ["面试问题", "question_id"]
    ],
    factTable: "fact_job_interview",
    dimTable: "dim_role",
    dateField: "event_date",
    dims: ["岗位方向", "行业", "能力类型", "项目阶段", "面试轮次"],
    metricDefs: [
      ["简历通过率", "COUNT(DISTINCT interview_invite_id) / COUNT(DISTINCT application_id)", "resume_pass_rate"],
      ["面试转化率", "COUNT(DISTINCT offer_id) / COUNT(DISTINCT first_interview_id)", "interview_conversion"],
      ["能力覆盖度", "COUNT(DISTINCT matched_skill_id) / COUNT(DISTINCT required_skill_id)", "skill_coverage"],
      ["项目证据数", "COUNT(DISTINCT evidence_id)", "evidence_count"],
      ["复盘闭环率", "COUNT(DISTINCT improved_question_id) / COUNT(DISTINCT failed_question_id)", "review_closure"]
    ],
    systems: ["招聘网站", "ATS", "代码评测", "项目仓库", "作品集", "笔记系统", "模拟面试记录"],
    controls: ["经历真实", "个人贡献边界清楚", "数字有口径", "技术选择能解释", "敏感信息已脱敏"],
    risks: ["工具堆砌", "把团队成果写成个人成果", "项目没有验证与复盘", "答案缺少事实证据", "简历与岗位不匹配"],
    cases: DOMAIN_LIBRARY["跨行业通用"].cases,
    regulations: ["STAR 行为面试方法", "结构化面试与能力项评分思想", "个人信息最小化与背景真实性原则", "作品集数据脱敏与知识产权要求"]
  },
  "【学习路线】": {
    key: "learning",
    label: "学习路线",
    scene: "能力诊断、知识地图、刻意练习、小项目验证、作品沉淀和阶段复盘",
    participants: ["学习者", "业务导师", "技术导师", "同伴", "项目验收人"],
    stages: ["诊断", "建立地图", "最小闭环", "真实项目", "工程化", "作品表达", "复盘迭代"],
    entities: [
      ["能力项", "skill_id"],
      ["学习任务", "task_id"],
      ["练习项目", "project_id"],
      ["验收项", "acceptance_id"],
      ["复盘记录", "review_id"]
    ],
    factTable: "fact_learning_progress",
    dimTable: "dim_skill",
    dateField: "event_date",
    dims: ["能力域", "学习阶段", "任务类型", "项目", "掌握等级"],
    metricDefs: [
      ["任务完成率", "COUNT(DISTINCT completed_task_id) / COUNT(DISTINCT planned_task_id)", "task_completion"],
      ["练习通过率", "COUNT(DISTINCT passed_exercise_id) / COUNT(DISTINCT exercise_id)", "exercise_pass_rate"],
      ["知识迁移度", "COUNT(DISTINCT used_in_project_id) / COUNT(DISTINCT learned_skill_id)", "transfer_score"],
      ["作品完整度", "COUNT(DISTINCT completed_rubric_id) / COUNT(DISTINCT rubric_id)", "portfolio_score"],
      ["复盘闭环率", "COUNT(DISTINCT improved_issue_id) / COUNT(DISTINCT found_issue_id)", "review_closure"]
    ],
    systems: ["知识库", "代码仓库", "数据集", "任务清单", "作品集", "复盘模板"],
    controls: ["目标可观察", "练习可复现", "项目有验收标准", "错误被记录并修复", "作品说明真实"],
    risks: ["只看课程不动手", "知识地图过大", "练习没有反馈", "作品缺少业务问题", "把收藏当作掌握"],
    cases: DOMAIN_LIBRARY["教育培训"].cases,
    regulations: ["刻意练习与间隔复习原则", "项目式学习方法", "能力本位教育与形成性评价思想", "公开资料引用与知识产权规范"]
  },
  "【学习方法分享】": {
    key: "method",
    label: "学习方法分享",
    scene: "知识输入、问题拆解、主动练习、反馈校正、作品输出和长期复盘",
    participants: ["学习者", "导师", "同伴", "项目使用者", "复盘者"],
    stages: ["提问", "检索", "理解", "练习", "反馈", "迁移", "输出"],
    entities: [
      ["问题", "question_id"],
      ["资料", "source_id"],
      ["练习", "exercise_id"],
      ["反馈", "feedback_id"],
      ["作品", "artifact_id"]
    ],
    factTable: "fact_learning_activity",
    dimTable: "dim_topic",
    dateField: "activity_date",
    dims: ["主题", "学习阶段", "资料类型", "练习形式", "掌握等级"],
    metricDefs: [
      ["主动练习占比", "SUM(active_practice_minutes) / SUM(total_learning_minutes)", "active_ratio"],
      ["间隔复习完成率", "COUNT(DISTINCT completed_review_id) / COUNT(DISTINCT planned_review_id)", "review_rate"],
      ["问题闭环率", "COUNT(DISTINCT resolved_question_id) / COUNT(DISTINCT raised_question_id)", "question_closure"],
      ["作品产出数", "COUNT(DISTINCT artifact_id)", "artifact_count"],
      ["迁移应用次数", "COUNT(DISTINCT applied_project_id)", "transfer_count"]
    ],
    systems: ["笔记", "代码仓库", "问题清单", "练习集", "作品集", "复盘日志"],
    controls: ["目标可验证", "资料有出处", "练习有反馈", "作品能复现", "复盘有下一步行动"],
    risks: ["信息过载", "只输入不输出", "缺少反馈", "资料过期", "知识碎片无法连接"],
    cases: DOMAIN_LIBRARY["教育培训"].cases,
    regulations: ["刻意练习原则", "费曼学习法与主动回忆", "检索式学习与间隔重复", "知识管理与引用规范"]
  }
};

const TOPIC_GUIDES = [
  {
    key: "kafka",
    label: "Kafka 消费积压与实时链路",
    match: /Kafka|消费积压|消息队列|消息中间件/i,
    objective: "把生产速率、分区分布、消费能力、Broker 状态和下游 Sink 时延放到同一条时间线上判断，避免看到 Lag 就直接扩容。",
    lenses: [
      ["生产侧", "消息是否突增、分区键是否导致热点、重试是否放大流量", "Topic/Partition 写入速率、消息大小、错误码", "先限流或修复生产重试"],
      ["消费侧", "消费线程是否空闲、单条处理是否变慢、是否频繁 Rebalance", "Lag、consume rate、commit rate、rebalance 记录", "稳定消费者成员后再调并发"],
      ["Broker", "磁盘、网络、ISR 和请求队列是否成为瓶颈", "请求时延、ISR 收缩、磁盘使用率、网络吞吐", "隔离异常 Broker 并保护副本"],
      ["下游", "数据库、缓存或外部 API 是否反压到消费者", "Sink P95、超时率、连接池、重试队列", "降级、批量写或暂存后再消费"]
    ],
    cases: [
      {
        org: "华东某电商实时订单团队",
        trigger: "大促开始后订单事件 Lag 从秒级升到二十分钟，消费者实例数已经翻倍但积压仍扩大",
        data: "订单 Topic 分区写入量、消费者组 Lag、消费线程 CPU、数据库写入 P95、Rebalance 和错误日志",
        problem: "新增实例触发分区重平衡，热点商户订单集中在少数分区，同时订单库写入 P95 升高",
        action: "先冻结无意义扩容，按分区定位热点，临时拆分批量写并限制重试，再按实际吞吐调整消费者上限",
        outcome: "示例链路在验证环境中恢复稳定的消费速率，并通过分区级 Lag 与端到端延迟双指标验收"
      },
      {
        org: "华南某支付日志平台",
        trigger: "夜间 Lag 周期性升高，但白天业务量更高时反而正常",
        data: "Broker 磁盘队列、分区副本状态、消费者提交位移、定时批任务和网络指标",
        problem: "夜间快照任务争抢磁盘 IO，导致一个 Broker 请求时延升高，消费者从副本拉取数据变慢",
        action: "把 Broker 指标与消费指标按分钟对齐，迁移快照窗口并对慢盘做副本隔离和容量告警",
        outcome: "复合案例将问题从业务流量误判纠正为基础设施争抢，并建立跨层时间线排查模板"
      },
      {
        org: "华北某制造物联网平台",
        trigger: "设备事件持续积压，但消费者 CPU 和 Kafka Broker 看起来都正常",
        data: "设备上报速率、Topic 分区、消费耗时分布、时序库写入、批量任务和下游限流日志",
        problem: "单条消息处理被外部时序库限流拖慢，消费者 commit 间隔变长，Lag 被误认为 Kafka 容量不足",
        action: "把消费循环拆成解析、缓冲、批量写入和提交四段，分别记录耗时，并加入背压与死信队列",
        outcome: "示例方案按处理阶段定位瓶颈，并验证重放不会造成重复入库"
      }
    ],
    checks: [
      "按 Topic-Partition 同时看生产速率、消费速率、Lag 和 commit rate",
      "检查消费者组成员、分配分区、Rebalance 原因与每次处理耗时",
      "把 Broker 磁盘、网络、ISR 与下游写入 P95 放在同一时间轴",
      "压测必须验证回放、幂等、死信和积压恢复后的追平时间"
    ],
    sources: [
      ["Apache Kafka Documentation", "https://kafka.apache.org/documentation/"],
      ["Kafka Consumer Design", "https://kafka.apache.org/documentation/#consumerconfigs"]
    ]
  },
  {
    key: "spark-shuffle",
    label: "Spark 数据倾斜、Shuffle 与执行计划",
    match: /Spark.*(倾斜|Shuffle|分区|Stage|RDD|宽依赖|窄依赖|Executor|Driver|Task|Job|并行度|小文件|内存|缓存|cache|persist|checkpoint|广播|reduceByKey|groupByKey|Partitioner|执行|调度|容错|lazy|水塘抽样|二次排序|输出文件|UDF|3\.0|Standalone|YARN|源码|算子|map|flatMap|迭代|灵活性|数据不丢失|exactly-once)/i,
    objective: "从 Spark UI、DAG、分区数据量、Shuffle 读写和 Task 时长入手，先证明瓶颈发生在哪里，再选择 AQE、预聚合、广播、盐化、并行度或存储策略。",
    lenses: [
      ["现象", "是长尾 Task、频繁 GC、Shuffle spill 还是失败重试", "Stage 输入输出、Task 时长分位数、spill、GC、失败日志", "保留 Spark UI 与事件日志快照"],
      ["键分布", "是否存在空值、默认值、超级大客户或少数热点键", "Top Key 占比、分区行数、压缩后大小", "热点键拆分后仍要对账总量"],
      ["资源", "CPU、内存、并行度、文件数与 Shuffle 分区是否匹配", "Executor 利用率、峰值内存、文件数和并发 Task", "先小流量验证再调整生产参数"],
      ["语义", "优化后是否改变排序、去重、重复消费或输出文件语义", "新旧结果对账、重复率、行数和校验和", "正确性不过关时禁止发布"]
    ],
    cases: [
      {
        org: "华东某零售数据仓库",
        trigger: "订单宽表任务从 40 分钟延长到 3 小时，部分 Task 长时间停在 reduce 阶段",
        data: "Spark 事件日志、各 Stage Shuffle 读写、Top 商户键分布、执行内存和 spill 指标",
        problem: "少数大商户贡献了绝大多数订单行，空商户键又被分到同一分区，形成双重热点",
        action: "空值先加随机后缀，大商户采用盐化两阶段聚合，并启用 AQE 合并小分区后再做结果校验",
        outcome: "示例优化用执行时间、Shuffle spill、峰值内存和订单金额对账四组证据评估，而不是只看一次运行速度"
      },
      {
        org: "华南某用户画像平台",
        trigger: "用户标签 join 频繁 OOM，增加 Executor 内存后只把失败延后到更晚阶段",
        data: "维表大小、广播阈值、窄表关联键、Executor GC 和 Shuffle 文件数",
        problem: "维表广播判断使用压缩文件大小，解压后远超内存；关联键中又存在大量空值",
        action: "按解压后大小和并发槽位评估广播，空键预先过滤，超大维度拆成热点与普通两部分处理",
        outcome: "示例方案把失败点、资源浪费和关联语义分开验证，并形成可复跑的性能基线"
      },
      {
        org: "华北某广告归因团队",
        trigger: "点击日志按天重跑结果正常，但月末全量重跑持续倾斜并产生大量小文件",
        data: "广告计划键分布、历史分区大小、Task 输入量、文件元数据和下游扫描成本",
        problem: "头部广告主数据集中，且按小时输出后没有合并，文件数放大元数据与扫描开销",
        action: "重分区前先按计划预聚合，输出后按目标文件大小合并，并对归因窗口和去重结果做跨版本对账",
        outcome: "示例项目同时改善长尾 Task、小文件数量和下游查询成本，并保留回滚版本"
      }
    ],
    checks: [
      "记录慢 Stage、Task 输入大小分位数、Shuffle read/write 与 spill，而不是只记录总耗时",
      "查看 Top Key、空值和默认值分布，确认热点是否来自业务集中或数据质量",
      "优化前后对账行数、金额、去重结果和输出文件，防止性能改善带来语义偏差",
      "参数调整必须关联数据量、资源规格和 Spark 版本，不能把偶然成功当作固定答案"
    ],
    sources: [
      ["Spark Tuning Guide", "https://spark.apache.org/docs/latest/tuning.html"],
      ["Spark SQL Performance Tuning", "https://spark.apache.org/docs/latest/sql-performance-tuning.html"],
      ["Spark Web UI", "https://spark.apache.org/docs/latest/web-ui.html"]
    ]
  },
  {
    key: "streaming",
    label: "流处理、状态与实时一致性",
    match: /Flink|流处理|实时处理|实时计算|实时数据|实时指标|实时采集|实时存储|实时查询|实时服务|事件驱动|Structured Streaming|Streaming|双流join|exactly-once/i,
    objective: "把事件时间、处理时间、水位线、状态、Checkpoint、反压和结果一致性放到一起设计，明确延迟、重复和正确性的取舍。",
    lenses: [
      ["时间语义", "窗口按事件时间还是处理时间，迟到数据如何处理", "水位线、迟到比例、窗口输出记录", "定义允许迟到和补数边界"],
      ["状态", "状态是否持续增长，TTL、Checkpoint 和恢复是否符合业务", "状态大小、Checkpoint 时长、恢复耗时", "容量不足时先改状态设计"],
      ["反压", "瓶颈来自算子、网络、序列化还是外部 Sink", "Busy/Backpressure、消费 Lag、Sink P95", "隔离慢 Sink 并限制重试"],
      ["一致性", "At-least-once 下是否幂等，Exactly-once 边界到哪里", "事务提交、重复键、回放与对账结果", "关键结果必须双跑核对"]
    ],
    cases: [
      {
        org: "华东某实时指标平台",
        trigger: "大屏指标偶尔短时偏高，任务恢复后又出现一部分数据缺口",
        data: "Kafka 事件、水位线、窗口状态、Checkpoint、Sink 事务和指标快照",
        problem: "迟到数据触发窗口重算，但 Sink 只做追加写，恢复时又从事务边界之外重放",
        action: "明确允许迟到范围，按指标键做幂等覆盖，Checkpoint 与 Sink 提交边界统一，并增加重放对账",
        outcome: "示例方案将问题拆成重复、迟到和丢失三类，分别建立验证用例"
      },
      {
        org: "华南某物流轨迹系统",
        trigger: "轨迹事件在高峰期延迟增加，扩容后 Checkpoint 反而频繁超时",
        data: "反压指标、状态大小、磁盘吞吐、Checkpoint 持续时间、事件分布和外部地理服务时延",
        problem: "状态按设备无限增长，地理编码同步调用阻塞算子，扩容同时放大了 Checkpoint 压力",
        action: "增加状态 TTL 与分层缓存，异步化外部调用，限制单批输入并拆分 Checkpoint 存储",
        outcome: "复合案例用端到端延迟、恢复时间和轨迹完整率评估稳定性"
      },
      {
        org: "华北某金融风控团队",
        trigger: "交易规则要求低延迟，但补数据时结果与实时链路无法完全一致",
        data: "交易事件、规则版本、特征窗口、状态快照、实时结果和离线重算结果",
        problem: "实时任务使用处理时间，离线补数使用事件时间，规则版本也没有进入结果主键",
        action: "统一事件时间和规则版本，建立可回放输入与幂等结果表，并定义实时、准实时和离线口径",
        outcome: "示例项目用版本化回放证明结果可解释，而不是强制所有链路追求同一延迟"
      }
    ],
    checks: [
      "画清事件从产生到可见的最大延迟、允许迟到和回补窗口",
      "记录状态大小、Checkpoint 时长、恢复耗时与反压位置",
      "明确端到端一致性边界，验证重复、乱序、迟到和故障恢复",
      "实时、准实时和离线口径必须分别命名并可对账"
    ],
    sources: [
      ["Apache Flink Documentation", "https://nightlies.apache.org/flink/flink-docs-stable/"],
      ["Flink Checkpointing", "https://nightlies.apache.org/flink/flink-docs-stable/docs/ops/state/checkpoints/"]
    ]
  },
  {
    key: "cdc",
    label: "CDC、增量接入与数据一致性",
    match: /CDC|Debezium|增量接入|数据库同步|Binlog|变更数据/i,
    objective: "同时处理全量快照、增量日志、Schema 变更、断点续传、重复与删除语义，确保源端和湖仓端可对账。",
    lenses: [
      ["快照", "全量与增量何时切换，切换期间是否产生重复或漏数", "快照位点、事务边界、行数和校验和", "快照未对账前不切换下游"],
      ["Schema", "字段新增、类型变化和主键调整如何传播", "DDL 事件、Schema Registry、兼容级别", "不兼容变更先隔离"],
      ["幂等", "重放、重复事件和乱序如何合并到目标表", "事件主键、版本号、更新时间和删除标记", "所有写入必须可重复执行"],
      ["对账", "源表与目标表的行数、金额、更新时间和删除状态是否一致", "分段校验、抽样明细、延迟分布", "差异未解释前停止扩大范围"]
    ],
    cases: [
      {
        org: "华东某零售订单平台",
        trigger: "订单库迁移到 CDC 入湖后，日报订单数比源库少了一部分，早高峰差异最明显",
        data: "Binlog 位点、快照阶段、事务提交顺序、订单主键、更新时间和目标表分区",
        problem: "全量快照期间又持续消费增量，切换时没有按事务位点去重，部分跨表事务只入了一半",
        action: "记录快照一致性位点，按业务主键和事件版本去重，跨表事务增加批次标识与完整性检查",
        outcome: "示例链路通过源目标分段对账、重复率和删除状态检查后再切换生产"
      },
      {
        org: "华南某 SaaS 厂商",
        trigger: "客户表增加新字段后，多个租户的同步任务开始失败",
        data: "DDL 历史、Schema Registry 兼容策略、消费者版本、失败事件和租户分布",
        problem: "源端先发布代码后注册 Schema，旧消费者无法解析新增字段，失败重试又阻塞分区",
        action: "改为 Schema 先行的兼容发布，字段新增使用默认值，异常事件进入死信并支持按位点重放",
        outcome: "示例项目把 Schema 变更、消费兼容和业务回滚放进同一发布门禁"
      },
      {
        org: "华北某制造主数据团队",
        trigger: "物料增量同步看起来实时，但下游维表仍保留已停用物料",
        data: "CDC 更新/删除事件、维表有效标志、源系统逻辑删除、关联订单和生效时间",
        problem: "源系统使用逻辑删除，接入只处理物理删除；维表又只保留最新状态",
        action: "统一删除语义并保留历史有效区间，按业务时间构造 SCD，增加停用物料被新交易所引用检查",
        outcome: "示例方案能同时回答物料何时有效、何时失效以及历史事实应关联哪个版本"
      }
    ],
    checks: [
      "记录全量快照位点、增量起始位点和切换期间的事务边界",
      "对新增字段、类型变化、主键变化和删除语义设置兼容策略",
      "验证重复投递、乱序、断点重放和死信恢复",
      "按行数、金额、更新时间、删除状态和分段抽样做源目标对账"
    ],
    sources: [
      ["Debezium Documentation", "https://debezium.io/documentation/"],
      ["Apache Flink CDC", "https://nightlies.apache.org/flink/flink-cdc-docs-stable/"]
    ]
  },
  {
    key: "warehouse",
    label: "数仓、数据湖与建模",
    match: /数据仓库|数据湖|湖仓|数仓|维度建模|数据建模|概念数据|逻辑数据|物理数据|OneData|OneModel|数据分层|数据集市|宽表|星型|雪花|DataMesh|DataFabric|数据编织/i,
    objective: "先定义业务过程、事实粒度和维度有效期，再决定分层、宽表、湖仓格式与查询引擎；模型要能被复算、追溯和稳定消费。",
    lenses: [
      ["业务过程", "一行事实代表什么动作或结果，时间与金额如何记录", "业务单据、事件日志、粒度说明和主键", "粒度不清时停止开发"],
      ["维度", "维度是否缓慢变化，历史归属按业务时间还是当前状态", "维度有效期、代理键和源系统映射", "跨期报表统一使用业务时间"],
      ["分层", "ODS、DWD、DWS、ADS 或湖仓分层各自解决什么问题", "血缘、复用率、查询模式和成本", "禁止用跨层直读绕过口径"],
      ["一致性", "事实、维度和指标能否与源系统及既有报表对账", "金额、行数、主键、状态和抽样明细", "差异分类后再发布"]
    ],
    cases: [
      {
        org: "华东某零售集团",
        trigger: "经营看板、财务日报和业务明细的销售额长期不一致，月末对账耗时数天",
        data: "订单、支付、退款、优惠、商品、门店和财务结算数据",
        problem: "订单行、支付单和退款单粒度混用，优惠分摊与跨期退款没有统一规则",
        action: "以订单行作为事实粒度，拆分支付、退款和优惠桥接表，维度保留历史归属并统一时间字段",
        outcome: "示例项目用金额桥接和分层对账把差异拆成取消、退款、跨期和维度归属四类"
      },
      {
        org: "华南某制造集团",
        trigger: "集团数据湖接入多个工厂后，同一设备指标出现多个版本",
        data: "设备、工单、工序、批次、停机、质检和能源数据",
        problem: "工厂编码不统一，设备组织关系只保留当前状态，湖表小文件过多影响查询",
        action: "建立设备与组织主数据映射，使用有效期维度，按业务过程拆分事实并优化分区和文件大小",
        outcome: "复合案例同时解决口径、历史归属和查询成本，而不是只迁移存储格式"
      },
      {
        org: "华北某互联网平台",
        trigger: "宽表数量快速膨胀，同一指标在不同数据集市重复开发",
        data: "指标定义、查询日志、血缘、下游应用、任务成本和口径争议记录",
        problem: "团队按报表而不是业务过程建模，宽表承担多种粒度，指标逻辑被复制",
        action: "建立一致性维度和原子指标，派生指标进入语义层，保留指标版本与负责人",
        outcome: "示例方案用复用率、口径变更影响面和查询成本验证建模价值"
      }
    ],
    checks: [
      "为每个事实表写清业务过程、粒度、主键、时间字段和可加性",
      "维度保留历史有效期，跨期比较使用当时归属",
      "金额、数量、去重对象和状态转换都要有独立对账样例",
      "湖仓格式与分区、文件大小、元数据和生命周期必须一起评估"
    ],
    sources: [
      ["Kimball Dimensional Modeling Techniques", "https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/"],
      ["Apache Iceberg Documentation", "https://iceberg.apache.org/docs/latest/"],
      ["Delta Lake Documentation", "https://docs.delta.io/latest/index.html"]
    ]
  },
  {
    key: "scheduling",
    label: "数据调度、依赖与数据 DevOps",
    match: /调度|依赖|编排|Airflow|DolphinScheduler|工作流|DevOps|CI-CD|自动化部署|自动化测试|自动化监控|发布管理|环境管理|任务稳定|数据管道|ETL|ELT/i,
    objective: "把任务、数据、时间和外部系统依赖显式建模，保证重跑幂等、失败可恢复、变更可回滚、SLA 可观察。",
    lenses: [
      ["依赖图", "依赖的是任务完成、分区就绪还是外部事件", "DAG、分区探测、开始时间和 SLA", "循环与隐式依赖必须消除"],
      ["幂等", "重跑同一分区是否会重复写入或重复产生副作用", "写入模式、去重键、事务和回滚", "不能幂等时先禁止自动重跑"],
      ["补数", "历史回放范围、并发、资源与下游影响", "补数计划、限流、顺序和完成校验", "补数必须分批并可视化进度"],
      ["发布", "代码、配置、表结构和数据变更是否一起评审", "版本、迁移脚本、灰度、回滚和审计", "变更失败可按步骤回退"]
    ],
    cases: [
      {
        org: "华东某电商数据平台",
        trigger: "早报每天偶发延迟，重跑后又出现重复数据",
        data: "DAG 依赖、分区就绪时间、任务重试、写入模式和下游查询时间",
        problem: "上游任务完成不代表分区可读，下游又使用追加写，调度重试放大重复",
        action: "改为分区就绪传感器，写入使用按分区覆盖与幂等合并，增加 SLA 预警和重跑审计",
        outcome: "示例平台把失败分成上游延迟、任务失败、数据未就绪和写入重复四类"
      },
      {
        org: "华南某金融数据团队",
        trigger: "一次表结构变更导致数十个下游任务同时失败",
        data: "任务血缘、表版本、字段依赖、发布顺序、失败日志和影响资产",
        problem: "变更只在代码仓库评审，没有自动分析字段消费者和调度影响",
        action: "把血缘、Schema 兼容检查和发布窗口接入 CI/CD，关键下游先跑影子任务",
        outcome: "复合案例将发布从人工通知升级为可阻断的影响分析流程"
      },
      {
        org: "华北某物流平台",
        trigger: "历史补数持续数天，期间正常任务资源被挤占",
        data: "补数分区、任务并发、队列资源、执行时长、下游锁和业务优先级",
        problem: "所有补数任务同时启动，没有资源配额和分层优先级",
        action: "按影响范围分批，设置并发上限与夜间窗口，任务内部记录每个分区的输入输出和处理状态",
        outcome: "示例项目用补数速度、正常 SLA、失败重试和人工介入次数评估"
      }
    ],
    checks: [
      "依赖必须区分任务完成、分区可读、文件到达和外部事件",
      "自动重跑前先验证幂等和事务边界",
      "补数要限流、分批、可暂停、可恢复并记录影响范围",
      "Schema、代码、配置、权限和数据变更进入同一发布审计"
    ],
    sources: [
      ["Apache Airflow Documentation", "https://airflow.apache.org/docs/"],
      ["Apache DolphinScheduler Documentation", "https://dolphinscheduler.apache.org/en-us/docs/latest"]
    ]
  },
  {
    key: "sql",
    label: "SQL、窗口函数与查询优化",
    match: /SQL|窗口函数|查询优化|执行计划|索引|Join|聚合|分组|开窗|连续|同比|环比|排名|去重|TopN|行列转换/i,
    objective: "先把业务问题翻译成正确的行粒度、连接关系和窗口范围，再通过执行计划、分区裁剪和数据分布优化性能。",
    lenses: [
      ["粒度", "连接前后一行代表什么，是否出现放大或丢失", "主键计数、连接前后行数、重复键样例", "粒度不清先不要聚合"],
      ["窗口", "分区、排序、边界和空值如何定义", "开窗后的样例、并列排名和边界日期", "窗口口径经业务样例确认"],
      ["NULL", "空值、默认值和未知成员参与连接或聚合是否符合语义", "NULL 比例、关联命中率和例外清单", "禁止用默认值悄悄补齐"],
      ["性能", "扫描量、Join 策略、数据倾斜和结果写出是否合理", "执行计划、扫描字节、Shuffle、文件数", "先减少数据再换更大资源"]
    ],
    cases: [
      {
        org: "华东某零售分析团队",
        trigger: "复购率在同一时间窗内出现多个版本，运营无法判断活动是否有效",
        data: "用户、订单、支付状态、退款、活动曝光和首次购买日期",
        problem: "复购窗口按自然日截断，退款订单未冲减，匿名与登录身份也未合并",
        action: "固定用户主键、观察窗和完成购买定义，使用窗口函数生成首购与后续购买间隔，并输出边界样本",
        outcome: "示例分析用可复算 SQL 与明细抽样统一复购口径"
      },
      {
        org: "华南某 SaaS 运营团队",
        trigger: "TopN 客户榜单每次刷新都变化很大，业务怀疑数据不稳定",
        data: "客户收入、退款、合同起止、币种、汇率和查询时间",
        problem: "并列排名未定义，退款和跨期合同处理不一致，查询时间窗随刷新漂移",
        action: "明确排名指标、并列规则、时间截止点和退款处理，用可重复参数与结果快照验证",
        outcome: "复合案例将波动拆成口径、时间和数据质量三类"
      },
      {
        org: "华北某物流分析平台",
        trigger: "大表 Join 查询超时，开发第一反应是增加计算资源",
        data: "执行计划、分区字段、连接键分布、扫描文件数、统计信息和结果集",
        problem: "条件未命中分区，小表没有广播，连接键存在严重倾斜",
        action: "先做分区和列裁剪，再评估广播与预聚合，最后才调整资源并回归结果",
        outcome: "示例查询用扫描量、Shuffle、P95 和结果对账衡量优化"
      }
    ],
    checks: [
      "每个子查询和 Join 都说明行粒度、主键和预期基数",
      "窗口函数写明分区、排序、边界、并列和空值规则",
      "使用固定参数与结果快照，避免刷新时口径漂移",
      "性能优化以执行计划、扫描量、Shuffle和结果正确性为依据"
    ],
    sources: [
      ["PostgreSQL Window Functions", "https://www.postgresql.org/docs/current/tutorial-window.html"],
      ["PostgreSQL EXPLAIN", "https://www.postgresql.org/docs/current/using-explain.html"],
      ["Apache Spark SQL Reference", "https://spark.apache.org/docs/latest/sql-ref.html"]
    ]
  },
  {
    key: "data-quality",
    label: "数据质量规则、监控与闭环",
    match: /数据质量|质量监控|质量评估|质量改进|Great Expectations|Griffin|质量规则|异常检测|数据测试|数据校验/i,
    objective: "把质量规则绑定到关键资产、严重等级、责任人和失败动作，通过样本回查和趋势监控区分数据问题与业务变化。",
    lenses: [
      ["完整性", "分区、记录和关键字段是否缺失", "覆盖日期、行数基线、空值率和源目标计数", "关键资产缺失时阻断发布"],
      ["准确性", "值与业务事实、源系统或计算规则是否一致", "抽样单据、金额平衡、枚举与公式复核", "差异分类后登记工单"],
      ["及时性", "数据何时可用，是否满足消费者 SLA", "分区完成时间、端到端延迟和告警时间", "超 SLA 自动通知并标记影响"],
      ["闭环", "谁在何时处理，是否复发，修复是否验证", "工单、根因、修复时长、复发率和复核记录", "只告警不闭环的规则应下线重做"]
    ],
    cases: [
      {
        org: "华东某银行数据治理团队",
        trigger: "核心指标在月末出现异常波动，业务先怀疑营销活动，后发现源系统批量延迟",
        data: "源表分区、入仓时间、金额平衡、状态枚举、指标趋势和业务活动日历",
        problem: "质量规则只看空值，没有检查分区完整性和跨系统金额平衡",
        action: "为核心资产增加行数与金额对账、分区 SLA 和状态机检查，并按严重等级绑定阻断与工单",
        outcome: "示例治理把发现时间前移到发布前，并用误报率、闭环时长和复发率评估规则"
      },
      {
        org: "华南某零售会员团队",
        trigger: "会员分层结果一周内多次变化，运营无法确定触达名单",
        data: "会员主数据、订单、退款、标签版本、更新时间和分层规则",
        problem: "测试会员未排除，退款未冲减，标签规则更新没有版本记录",
        action: "增加业务对象范围检查、历史回放和版本对比，先隔离异常会员再发布名单",
        outcome: "复合案例将问题拆成输入质量、规则变更和正常行为变化"
      },
      {
        org: "华北某制造质量平台",
        trigger: "良品率日报偶尔超过 100%，现场对数据看板失去信任",
        data: "工单投入、产出、报废、返工、质检、设备状态和批次记录",
        problem: "投入与产出时间窗错位，返工数量被重复计入良品，部分离线补录没有来源",
        action: "建立投入产出平衡、批次去重和补录来源检查，异常时展示影响明细而不是只显示红灯",
        outcome: "示例项目将质量规则、业务解释和现场处置合并到同一页面"
      }
    ],
    checks: [
      "关键规则必须绑定资产、负责人、严重等级、失败动作和复核时限",
      "同时覆盖完整性、唯一性、准确性、及时性和一致性，不只查空值",
      "异常结果保留样本与上下文，便于业务回查原始单据",
      "用发现前移、误报率、闭环时长和复发率衡量治理效果"
    ],
    sources: [
      ["Great Expectations Documentation", "https://docs.greatexpectations.io/docs/"],
      ["Apache Griffin", "https://griffin.apache.org/"],
      ["DAMA Data Quality Principles", "https://www.dama.org/cpages/body-of-knowledge"]
    ]
  },
  {
    key: "lineage",
    label: "数据血缘、元数据与影响分析",
    match: /血缘|Lineage|元数据|数据目录|DataHub|Atlas|字段级|影响分析|数据资产|模型.*溯源|特征.*溯源/i,
    objective: "把表、字段、任务、指标和运行时关系连成可更新、可验证的血缘网络，用于影响分析、故障定位、口径追踪和变更评审。",
    lenses: [
      ["静态关系", "SQL 解析是否覆盖字段映射、临时表、视图和 UDF", "解析结果、未识别语句和人工补充", "低置信度边不得直接阻断生产"],
      ["运行关系", "实际读写了哪些分区、文件和外部接口", "运行日志、输入输出路径、任务实例", "静态与运行血缘要定期比对"],
      ["业务关系", "指标由哪些字段和规则组成，谁负责", "指标定义、版本、负责人和消费方", "业务语义不能只靠表名推断"],
      ["影响分析", "上游变更会影响哪些资产、任务、接口和报表", "下游清单、关键等级、通知与确认记录", "关键影响必须有回滚和告知"]
    ],
    cases: [
      {
        org: "华东某银行数据平台",
        trigger: "核心客户表修改字段类型后，任务批量失败，团队只能人工搜索 SQL 定位下游",
        data: "表字段血缘、调度依赖、查询历史、任务日志、接口和报表消费清单",
        problem: "血缘只到表级且长期不更新，动态 SQL 与临时表没有解析",
        action: "组合 SQL 解析、运行日志和人工登记，建立字段级关系与关键资产等级，接入发布影响分析",
        outcome: "示例项目把下游识别从人工搜索变成自动清单，并对无法识别语句设置例外评审"
      },
      {
        org: "华南某保险集团",
        trigger: "同一指标存在多个口径，审计要求解释每个数字来自哪些字段和规则",
        data: "指标版本、计算 SQL、源字段、业务术语、责任人和变更记录",
        problem: "指标平台与表级血缘分离，SQL 中的过滤和映射无法回到业务定义",
        action: "打通指标、字段和任务三层血缘，关键公式保存版本，变更时生成影响与差异报告",
        outcome: "复合案例支持从看板数字一路回到源字段和规则版本"
      },
      {
        org: "华北某 AI 平台",
        trigger: "模型效果突然下降，团队无法确认受影响的训练数据和特征版本",
        data: "数据集、特征、样本、模型、评测、部署和线上请求关系",
        problem: "模型版本存在，但特征回填和样本筛选脚本没有纳入血缘",
        action: "把数据卡、特征版本、模型卡与运行请求串联，记录训练、评测和生产数据边界",
        outcome: "示例治理能回答某次模型更新使用了哪些数据和特征，并限制问题影响范围"
      }
    ],
    checks: [
      "血缘至少覆盖表、字段、任务、指标、模型和运行实例中的关键层级",
      "静态 SQL 解析与真实运行读写要互相对账",
      "关键资产记录负责人、等级、消费者和变更影响规则",
      "无法解析的动态 SQL、UDF 与人工操作必须有例外登记"
    ],
    sources: [
      ["OpenLineage Documentation", "https://openlineage.io/docs/"],
      ["DataHub Documentation", "https://docs.datahub.com/docs/"],
      ["Apache Atlas", "https://atlas.apache.org/"]
    ]
  },
  {
    key: "security-governance",
    label: "数据安全、合规与权限治理",
    match: /数据安全|分类分级|权限|审计|合规|隐私|脱敏|加密|法规|个人信息|跨境|Ranger|访问控制|AI伦理|AI合规|模型.*泄露|差分隐私|隐私计算|零知识|联邦学习|可信数据/i,
    objective: "按数据类型、用途、角色和风险设置最小权限、脱敏、审计和生命周期控制，让每次访问与共享都有依据、可追踪、可回收。",
    lenses: [
      ["分类", "数据包含什么主体、敏感程度和监管属性", "字段清单、分级标签、业务用途和授权依据", "未分级字段不得默认开放"],
      ["授权", "谁因什么任务需要何种操作，何时到期", "角色、用途、审批、临时权限和回收记录", "禁止共享账号与永久超级权限"],
      ["使用", "查询、导出、训练和共享是否遵循最小必要", "脱敏策略、水印、审计日志和异常访问", "高风险操作实时告警"],
      ["审计", "能否还原谁在何时访问了什么、做了什么", "身份、时间、对象、动作、结果和审批链", "审计日志独立保存并防止篡改"]
    ],
    cases: [
      {
        org: "华东某医疗数据平台",
        trigger: "研究团队需要分析病历数据，但直接导出会包含患者身份和敏感诊断信息",
        data: "患者主索引、就诊、诊断、检验、授权目的、字段分级和导出范围",
        problem: "权限按部门授予，无法区分研究用途和临床用途，脱敏规则又只在部分视图生效",
        action: "按用途建立受控数据空间，身份字段不可逆脱敏，敏感诊断按最小集授权，导出需审批和水印",
        outcome: "示例方案以授权可追踪、最小字段和访问审计为上线条件"
      },
      {
        org: "华南某金融机构",
        trigger: "离职与转岗人员仍保留多个历史项目的数据访问权限",
        data: "身份系统、项目角色、数据权限、访问日志、权限到期时间和离职事件",
        problem: "权限由多个平台分别审批，没有统一下线触发和定期复核",
        action: "建立角色与项目绑定、临时权限到期自动回收、季度访问复核和异常导出监控",
        outcome: "复合案例用权限存量、超期比例、回收时长和高风险访问发现率衡量治理"
      },
      {
        org: "华北某 AI 公司",
        trigger: "客服大模型测试时出现内部制度和个人信息片段",
        data: "训练语料、检索知识、用户问题、输出日志、脱敏规则和模型版本",
        problem: "训练与生产数据边界不清，提示注入和越权检索没有专门测试",
        action: "建立数据卡与模型卡，训练前去标识化，检索前做权限过滤，输出侧增加敏感检查和红队集",
        outcome: "示例项目把安全测试、人工复核和可回滚发布纳入模型上线门禁"
      }
    ],
    checks: [
      "先分类分级和确认用途，再谈开放哪些字段与操作",
      "权限必须绑定角色、项目、用途和有效期，并能自动回收",
      "查询、下载、训练、共享和模型输出都需要审计证据",
      "高风险场景准备脱敏、拒绝、转人工、回滚和事故响应路径"
    ],
    sources: [
      ["NIST Privacy Framework", "https://www.nist.gov/privacy-framework"],
      ["Apache Ranger", "https://ranger.apache.org/"],
      ["OWASP Top 10 for LLM Applications", "https://owasp.org/www-project-top-10-for-large-language-model-applications/"]
    ]
  },
  {
    key: "master-standard",
    label: "数据标准、指标口径与主数据",
    match: /数据标准|主数据|MDM|OneID|统一身份|用户统一ID|指标口径|指标字典|语义层|数据合约|业务术语|数据分类|资产责任|OneService|数据编码|数据规范/i,
    objective: "把业务定义、编码、主键、指标公式、权威源和责任人变成可执行标准，并通过版本、评审和对账控制变更。",
    lenses: [
      ["定义", "业务到底如何理解对象、事件和指标", "术语、适用范围、反例和负责人", "只有名称没有业务定义不算标准"],
      ["编码", "类型、长度、枚举、单位和空值语义", "源系统字段、映射表、历史版本和样例", "编码变更必须评估历史兼容"],
      ["主键", "唯一标识、合并、拆分和历史关系如何处理", "重复率、误合并率、有效期和跨系统映射", "合并前保留原始标识与审计"],
      ["变更", "谁提出、谁评审、谁批准、何时生效", "版本记录、影响分析、回滚和下游确认", "口径变更不得覆盖历史结果"]
    ],
    cases: [
      {
        org: "华东某零售集团",
        trigger: "会员数量与财务、门店、线上渠道各自口径不同，董事会无法判断真实用户规模",
        data: "手机号、会员卡、设备、登录账号、匿名行为、合并关系和历史等级",
        problem: "手机号空值与变更造成误合并，匿名与登录身份未建立可信关联",
        action: "定义会员唯一标识、候选匹配和人工复核规则，保留合并前后关系，指标区分注册、活跃和可触达会员",
        outcome: "示例项目用重复率、误合并率、覆盖率和跨期一致性评估 OneID"
      },
      {
        org: "华南某制造集团",
        trigger: "同一物料在采购、生产、仓储和财务使用不同编码，集团分析经常断链",
        data: "供应商料号、内部料号、制造商料号、单位、批次和有效期",
        problem: "各单位独立维护编码，单位换算和停用状态没有统一标准",
        action: "建立物料主数据权威源、映射与清洗规则，保留历史编码和有效期，关键变更需跨域评审",
        outcome: "复合案例让采购、生产和财务能够围绕同一主数据对账"
      },
      {
        org: "华北某互联网平台",
        trigger: "不同团队对活跃用户和留存率有十几个版本，实验结论相互冲突",
        data: "指标名称、公式、粒度、时间窗、排除条件、版本和下游使用清单",
        action: "建立原子指标与派生指标分层，公式版本化，关键口径进入语义层并通过单测",
        problem: "指标只存在于 SQL 和文档，变更没有负责人和下游通知",
        outcome: "示例治理用口径争议数、重复开发量、变更影响时间和使用覆盖率衡量"
      }
    ],
    checks: [
      "标准必须包含业务定义、技术定义、权威源、负责人、版本和生效时间",
      "主数据合并保留来源、规则、置信度和人工复核记录",
      "指标公式与粒度进入语义层，不允许散落在个人 SQL 中",
      "标准变更执行影响分析、评审、通知、验证和回滚"
    ],
    sources: [
      ["DAMA-DMBOK Body of Knowledge", "https://www.dama.org/cpages/body-of-knowledge"],
      ["Open Data Contract Standard", "https://bitol-io.github.io/open-data-contract-standard/latest/"]
    ]
  },
  {
    key: "data-service",
    label: "数据服务、API 与语义层",
    match: /数据服务|API|RESTful|GraphQL|接口|网关|服务编排|服务监控|服务部署|语义层|指标服务|Text-to-SQL|Agent-to-Data/i,
    objective: "把数据能力封装成有契约、有版本、有权限、有 SLA、有监控的服务，并明确查询、缓存、限流和失败降级。",
    lenses: [
      ["契约", "请求、响应、字段、错误码和版本是否稳定", "OpenAPI、Schema、兼容测试和样例", "不兼容变更必须新版本"],
      ["权限", "调用方、用户身份、数据范围和行级权限如何传递", "令牌、租户、用途、字段和行过滤记录", "禁止只在前端做权限"],
      ["性能", "P50/P95、并发、缓存、扫描量和数据库压力", "指标、压测、慢查询和容量基线", "先限流再扩容"],
      ["一致性", "服务结果来自哪张表、哪个快照和哪次更新", "数据版本、延迟、对账和回放记录", "业务必须知道数据新鲜度"]
    ],
    cases: [
      {
        org: "华东某零售数据平台",
        trigger: "多个活动页面直接调用明细接口，月初并发升高后数据库变慢",
        data: "API 调用量、查询参数、热点租户、缓存命中、P95 和数据库执行计划",
        problem: "接口允许任意维度和时间范围查询，无分页、限流与缓存，权限校验还会触发额外全表扫描",
        action: "收窄查询契约，增加聚合结果缓存、租户限流、分页和慢查询拒绝，并把数据版本返回给调用方",
        outcome: "示例服务用 P95、错误率、缓存命中、数据库负载和结果一致性验收"
      },
      {
        org: "华南某 SaaS 公司",
        trigger: "客户要求按租户配置指标，但每次变更都要修改接口代码",
        data: "租户、指标定义、语义层、SQL 模板、权限和版本",
        problem: "指标公式硬编码在 API，不同租户共用无版本 SQL",
        action: "将指标、维度和权限下沉到语义层，API 只传语义请求，生成受控查询并记录版本",
        outcome: "复合案例支持配置化扩展，同时保留可审计查询和回归测试"
      },
      {
        org: "华北某 AI 数据平台",
        trigger: "Text-to-SQL 助手生成的查询能运行，但经常扫描敏感字段或返回错误口径",
        data: "表语义、字段权限、指标、查询历史、SQL 校验和执行结果",
        problem: "模型直接访问物理表，缺少语义层、权限前置和结果合理性验证",
        action: "只暴露受控语义对象，生成后做语法、权限、成本和业务规则检查，高风险查询转人工",
        outcome: "示例项目以可执行率、口径正确率、越权拦截率和平均成本评估助手"
      }
    ],
    checks: [
      "接口契约覆盖字段、错误码、版本、权限和数据新鲜度",
      "服务端执行身份、租户、行级和字段级权限校验",
      "P95、错误率、限流、缓存、慢查询和成本都有监控",
      "数据版本、查询逻辑和结果快照可追溯"
    ],
    sources: [
      ["OpenAPI Specification", "https://spec.openapis.org/oas/latest.html"],
      ["Google API Design Guide", "https://cloud.google.com/apis/design"]
    ]
  },
  {
    key: "performance",
    label: "性能、容量与成本优化",
    match: /性能优化|查询慢|成本|容量|资源|缓存|存储优化|执行计划|大数据系统性能|应用层性能|技术债务|选型|OLAP|查询引擎/i,
    objective: "先建立延迟、吞吐、资源、正确性和成本的基线，再定位扫描、Shuffle、状态、缓存、序列化或外部依赖瓶颈，避免只靠扩容。",
    lenses: [
      ["基线", "优化前到底慢在哪、贵在哪、是否稳定", "P50/P95、输入规模、资源、失败率和账单", "没有基线不做优化结论"],
      ["瓶颈", "CPU、内存、IO、网络、锁、序列化和外部服务谁先饱和", "火焰图、执行计划、等待时间、GC 和队列", "一次只改变主要变量"],
      ["取舍", "速度提升是否牺牲新鲜度、准确性、并发或可维护性", "SLA、成本、结果差异和回滚代价", "建立护栏指标"],
      ["回归", "长期高峰、数据增长和故障时是否仍成立", "压测、趋势、容量余量和预算告警", "优化结果进入持续基准"]
    ],
    cases: [
      {
        org: "华东某互联网数据平台",
        trigger: "报表查询在数据量增长后变慢，团队连续扩容但单位查询成本同步上升",
        data: "执行计划、扫描字节、分区命中、文件数量、缓存、并发和查询模板",
        problem: "大量查询重复扫描明细，分区过碎，BI 还生成高基数无意义维度组合",
        action: "按查询模板做预聚合，增加物化视图和缓存，限制高成本组合并优化分区与文件大小",
        outcome: "示例优化同时用 P95、扫描量、资源成本和结果一致性评估"
      },
      {
        org: "华南某制造集团",
        trigger: "历史任务迁移到新引擎后单次任务更快，但月度账单显著上升",
        data: "任务运行时长、并发、资源规格、存储副本、生命周期和任务价值",
        problem: "只比较单任务时长，没有看空闲资源、重复计算和长期存储",
        action: "按任务价值分层，设置并发与规格上限，冷热分层并回收无用中间表",
        outcome: "复合案例把性能指标扩展为总成本、SLA 和资源利用率"
      },
      {
        org: "华北某金融机构",
        trigger: "一次索引和缓存调整让查询变快，但月末对账出现结果差异",
        data: "查询版本、缓存键、索引、更新时点、结果校验和业务口径",
        problem: "缓存未包含数据版本，索引下推改变空值与排序语义",
        action: "缓存键加入数据版本和权限，先做新旧 SQL 对账，再小流量切换并保留旁路查询",
        outcome: "示例项目证明性能优化必须与正确性、回滚和长期监控一起验收"
      }
    ],
    checks: [
      "固定数据量、并发、资源、版本和业务时间窗建立基线",
      "用执行计划、指标和采样定位瓶颈，不从经验参数开始",
      "同时记录性能、正确性、新鲜度、稳定性和成本护栏",
      "优化上线后保留新旧对照、容量趋势和回滚路径"
    ],
    sources: [
      ["Spark Tuning Guide", "https://spark.apache.org/docs/latest/tuning.html"],
      ["PostgreSQL Performance Tips", "https://www.postgresql.org/docs/current/performance-tips.html"]
    ]
  },
  {
    key: "rag",
    label: "RAG、检索与知识库工程",
    match: /RAG|检索增强|知识库|向量数据库|语义搜索|Embedding|向量索引|召回|重排|混合检索|文档切片|知识治理/i,
    objective: "把文档解析、切片、索引、召回、重排、权限、引用和评估连成可回归链路，分别衡量检索是否命中、答案是否有据、任务是否完成。",
    lenses: [
      ["切分", "切片是否保留标题、条款、表格和上下文", "切片边界、重复率、版本和人工样例", "结构缺失时先修解析而非换模型"],
      ["召回", "关键词、向量和混合检索是否覆盖长尾与同义词", "Hit@K、MRR、召回文档版本和权限过滤", "按问题类型分层评估"],
      ["生成", "回答是否引用正确片段并覆盖关键条件", "引用支持率、事实一致性、完整性和拒答", "低置信度必须澄清或转人工"],
      ["运营", "文档更新、权限变化和反馈是否进入回归集", "索引版本、延迟、成本、失败分类和人工反馈", "每次索引或模型更新都回归"]
    ],
    cases: [
      {
        org: "华东某企业制度知识库",
        trigger: "员工问报销和休假规则时，助手引用了已废止版本，回答语气还很确定",
        data: "制度文档、版本、生效日期、章节、权限、切片、召回片段和人工反馈",
        problem: "文档只按固定长度切分，旧版本仍在索引，引用只显示文档名不显示版本和条款",
        action: "按标题与条款结构切片，过滤失效版本和用户权限，答案强制给出版本、条款和更新日期",
        outcome: "示例项目把问题拆成解析、召回、生成和引用四层并建立回归集"
      },
      {
        org: "华南某制造业客服团队",
        trigger: "设备故障问答在离线演示准确，真实工单中经常找不到型号专用步骤",
        data: "产品型号、手册章节、故障现象、历史工单、工程师反馈和召回结果",
        problem: "查询没有使用设备型号过滤，向量相似度偏好通用描述，长表格被错误切碎",
        action: "先按型号和安全等级过滤，再做混合召回与重排，表格保留行列结构并加入引用校验",
        outcome: "复合案例用 Top3 命中、引用正确率、一次解决率和转人工率评估"
      },
      {
        org: "华北某金融知识平台",
        trigger: "RAG 上线后响应延迟和成本持续上升，团队不断缩小 TopK 导致漏召回",
        data: "查询类型、召回数量、重排耗时、模型调用、缓存、答案采纳和成本",
        problem: "所有请求走同一长上下文和大模型，简单问题与复杂分析没有分层",
        action: "按问题路由到 FAQ、检索或人工流程，增加缓存、批量重排和上下文预算，保留失败样本回流",
        outcome: "示例工程在质量、P95 和单位成本之间建立可解释取舍"
      }
    ],
    checks: [
      "至少分别评估解析质量、检索命中、引用支持、任务完成和安全",
      "索引记录文档、切片、Embedding、权限和更新时间版本",
      "按问题类型、租户、风险等级和语言分层评测",
      "低置信度、无证据、权限拒绝和工具失败都有明确降级路径"
    ],
    sources: [
      ["Retrieval-Augmented Generation Paper", "https://arxiv.org/abs/2005.11401"],
      ["NIST AI Risk Management Framework", "https://www.nist.gov/itl/ai-risk-management-framework"],
      ["OWASP LLM Applications", "https://owasp.org/www-project-top-10-for-large-language-model-applications/"]
    ]
  },
  {
    key: "agent",
    label: "AI Agent、工具调用与安全边界",
    match: /Agent|智能体|多Agent|工具调用|控制平面|沙箱|权限审计|Agentic/i,
    objective: "把任务目标、规划、工具、状态、权限、预算、评估和人工接管设计成受控系统，不允许模型绕过服务端授权直接执行高风险动作。",
    lenses: [
      ["任务", "成功是什么、何时停止、什么情况必须转人工", "目标说明、完成条件、最大步数和失败分类", "无完成判据不开放自动执行"],
      ["工具", "工具白名单、参数校验、幂等和副作用边界", "工具清单、Schema、权限、审计和回滚", "写操作必须二次校验或人工确认"],
      ["状态", "上下文、记忆和中间结果是否准确、过期或污染", "状态版本、来源、TTL 和会话隔离", "不可信内容不得直接进入控制指令"],
      ["评估", "是否完成任务，调用是否安全、经济、可解释", "任务成功率、工具错误、越权拦截、步数和成本", "保留完整 trace 和回归案例"]
    ],
    cases: [
      {
        org: "华东某企业运维 Agent",
        trigger: "智能体可以自动查日志并重启服务，一次错误判断导致非目标实例被操作",
        data: "用户指令、工具参数、服务清单、权限、审批、执行日志和回滚记录",
        problem: "模型能直接调用高权限工具，目标实例仅由自然语言解析，没有环境标签和服务端校验",
        action: "只暴露只读工具给模型，写操作生成变更单并由服务端校验目标、环境和审批，执行后自动验证健康状态",
        outcome: "示例系统把越权、误操作和不可回滚动作设为阻断级风险"
      },
      {
        org: "华南某电商客服 Agent",
        trigger: "多轮对话中智能体反复调用订单和优惠工具，成本上升但问题解决率没有改善",
        data: "会话状态、工具轨迹、调用参数、解决状态、转人工、时延和 token 成本",
        problem: "缺少停止条件，工具失败后继续重试，重复信息被反复放入上下文",
        action: "增加任务状态机、最大步数、工具级超时与缓存，连续失败转人工，并按意图分层评估",
        outcome: "复合案例以一次解决率、平均步数、P95 和单位任务成本验收"
      },
      {
        org: "华北某金融分析 Agent",
        trigger: "Agent 生成 SQL 后自动执行并制作图表，但部分查询超出用户数据权限",
        data: "用户身份、语义层权限、SQL、执行计划、数据范围、审计和答案",
        problem: "权限只在最终展示层处理，SQL 已读取敏感明细，工具还会使用共享服务账号",
        action: "执行前由语义层注入行级和字段权限，服务端限制扫描与导出，高风险查询要求复核",
        outcome: "示例工程证明 Agent 安全必须落在工具和执行层，而不是只靠提示词"
      }
    ],
    checks: [
      "任务必须有完成条件、最大步数、超时、预算和转人工规则",
      "工具在服务端做身份、参数、对象、环境和权限校验",
      "完整记录计划、工具参数、结果、错误、版本和人工操作",
      "对越权、提示注入、循环调用、错误重试和数据泄露做专门测试"
    ],
    sources: [
      ["ReAct Paper", "https://arxiv.org/abs/2210.03629"],
      ["OWASP Top 10 for LLM Applications", "https://owasp.org/www-project-top-10-for-large-language-model-applications/"],
      ["NIST AI Risk Management Framework", "https://www.nist.gov/itl/ai-risk-management-framework"]
    ]
  },
  {
    key: "llm",
    label: "大模型、Prompt 与评估工程",
    match: /大模型|LLM|Prompt|提示工程|微调|Fine-tune|模型评估|LLMOps|可观测性|成本控制|多模态|自然语言处理|生成式AI|合成数据|数据飞轮|标注|数据集文档|数据漂移/i,
    objective: "先证明任务需要大模型，再用版本化 Prompt、评测集、人工反馈、成本与安全门禁管理迭代，避免只凭少数演示判断效果。",
    lenses: [
      ["任务", "模型输出是分类、生成、抽取、改写还是决策建议", "输入结构、输出结构、成功标准和失败路径", "能用规则解决的问题不先上模型"],
      ["数据", "训练、评测和线上反馈是否分离且覆盖边界", "数据卡、标注规则、去重、授权和漂移", "污染或不代表线上时暂停评估"],
      ["评测", "离线、线上、人工和业务指标是否一致", "准确、引用、完整、拒答、采纳和任务完成", "高风险错误单独设门槛"],
      ["运营", "模型、Prompt、参数、成本和故障是否可追踪", "版本、trace、P95、单任务成本和回滚", "每次发布保留对照结果"]
    ],
    cases: [
      {
        org: "华东某 SaaS 客服团队",
        trigger: "模型升级后离线准确率提升，但线上转人工率没有下降",
        data: "真实会话、意图、回答、解决状态、人工标注、模型版本和成本",
        problem: "评测集来自早期样本，标注只看流畅度，没有衡量问题是否真正解决",
        action: "按意图和用户阶段重建评测集，加入任务完成、澄清轮次、转人工、引用和安全门槛",
        outcome: "示例评测发现复杂退款问题存在过度自信，并加入低置信度澄清与转人工"
      },
      {
        org: "华南某制造文档团队",
        trigger: "团队尝试微调模型解释设备手册，但更新型号后效果迅速下降",
        data: "手册版本、问答样本、型号、检索结果、微调数据和生产失败案例",
        problem: "知识更新频率高，微调把旧事实写入参数，缺少检索与版本控制",
        action: "先优化检索和结构化输出，只把稳定语言能力留给微调，新知识由版本化知识库提供",
        outcome: "复合案例用更新时效、引用正确率和回归成本比较微调与 RAG"
      },
      {
        org: "华北某金融科技公司",
        trigger: "生成式摘要成本快速增加，但业务只使用其中少量结果",
        data: "请求类型、输入长度、模型路由、缓存、人工采纳和单任务成本",
        problem: "所有请求都走同一大模型和长上下文，没有模板、缓存或小模型路由",
        action: "按任务复杂度和风险分层路由，常见问题模板化，长文档先检索压缩，再记录采纳反馈",
        outcome: "示例运营在质量护栏内降低单位成本，并对模型降级做 A/B 验证"
      }
    ],
    checks: [
      "评测集覆盖高频、长尾、边界、对抗、拒答和真实失败样本",
      "Prompt、模型、参数、知识、工具和代码全部版本化",
      "离线指标必须与线上任务完成、人工采纳、成本和风险关联",
      "模型更新保留灰度、对照、回滚和人工接管"
    ],
    sources: [
      ["NIST AI Risk Management Framework", "https://www.nist.gov/itl/ai-risk-management-framework"],
      ["Hugging Face Evaluation Guidebook", "https://huggingface.co/spaces/evaluate-metric/README"],
      ["OWASP LLM Applications", "https://owasp.org/www-project-top-10-for-large-language-model-applications/"]
    ]
  },
  {
    key: "ml",
    label: "机器学习、特征与 MLOps",
    match: /机器学习|MLOps|MLlib|特征工程|特征平台|模型训练|模型部署|模型监控|推荐|排序|预测|分类|回归|算法|深度学习|神经网络|计算机视觉|实时机器学习|模型性能/i,
    objective: "把问题定义、标签、特征、时间切分、基线、离线评估、线上服务、漂移和回滚连接起来，避免用随机切分和单一准确率掩盖真实风险。",
    lenses: [
      ["标签", "标签代表什么、何时可用、是否有延迟或反馈偏差", "标签定义、成熟窗口、正负样本和标注质量", "标签泄漏时停止训练"],
      ["特征", "特征在预测时是否可得，训练与线上计算是否一致", "特征时间、版本、缺失率、训练服务一致性和血缘", "禁止使用未来信息"],
      ["评估", "时间、用户、设备分组是否防止泄漏，误报成本如何", "时间切分、分组验证、基线和成本矩阵", "离线提升不等于线上有效"],
      ["运营", "数据漂移、模型漂移、延迟、成本和回滚是否可观察", "输入分布、预测分布、业务指标、版本和告警", "设置自动降级与人工复核"]
    ],
    cases: [
      {
        org: "华东某零售推荐团队",
        trigger: "离线 AUC 提升但线上点击率下降，推荐结果集中在少数热门商品",
        data: "曝光、点击、购买、用户特征、商品特征、召回、排序和实验分组",
        problem: "训练样本使用曝光后信息，评价只看总体 AUC，没有看多样性和长期留存",
        action: "按时间重建样本，加入召回覆盖、多样性、冷启动和长期留存护栏，并做线上对照实验",
        outcome: "示例项目把离线和线上指标统一到同一用户与时间窗口"
      },
      {
        org: "华南某银行风控团队",
        trigger: "模型在历史数据表现很好，但新客群逾期率明显高于预期",
        data: "申请、授信、交易、还款、客群、规则版本、模型分数和人工审批",
        problem: "拒绝样本被排除，模型只学习已通过客户；规则变化又没有进入特征版本",
        action: "分析选择偏差，建立时间外验证和分群监控，记录规则版本并保留人工复核样本",
        outcome: "复合案例用召回、误拒、逾期、稳定性和可解释性多维评估"
      },
      {
        org: "华北某制造设备团队",
        trigger: "故障预测模型准确率高，但现场维修成本反而增加",
        data: "传感器、设备、故障、维修、备件、停机和人工标注",
        problem: "随机切分造成同设备信息泄漏，误报成本没有进入目标，预测与维修排班脱节",
        action: "按设备和时间分组验证，以提前预警窗口和成本矩阵评估，建立人工确认与持续学习闭环",
        outcome: "示例项目把模型指标转换为可执行的维修收益与风险"
      }
    ],
    checks: [
      "先建立简单基线和业务成本，再训练复杂模型",
      "训练、验证和测试按时间或实体隔离，检查标签与特征泄漏",
      "特征在训练与线上使用同一逻辑、时间点和版本",
      "上线监控覆盖数据漂移、模型漂移、业务指标、成本和回滚"
    ],
    sources: [
      ["Google Rules of Machine Learning", "https://developers.google.com/machine-learning/guides/rules-of-ml"],
      ["MLOps Principles", "https://ml-ops.org/"],
      ["scikit-learn Model Evaluation", "https://scikit-learn.org/stable/modules/model_evaluation.html"]
    ]
  },
  {
    key: "analytics",
    label: "分析方法、指标与实验",
    match: /指标|分析|转化|留存|复购|客单|漏斗|归因|A\/B|AB测试|实验|假设检验|回归|相关|异常|看板|日报|周报|月报|诊断|经营|北极星|用户画像|RFM|同期群|辛普森|基准|竞品|市场环境|商业模式|汇报|故事|报告/i,
    objective: "把模糊问题翻译成对象、时间、比较基准和行动，检查数据口径与偏差，再选择描述、诊断、预测或因果方法。",
    lenses: [
      ["问题", "要改变谁的行为，比较基线和成功标准是什么", "决策记录、对象范围、时间窗口和行动负责人", "不能转成行动的问题先澄清"],
      ["口径", "分子分母、状态、去重和时间是否一致", "指标字典、明细抽样、源系统对账", "口径未冻结不比较趋势"],
      ["方法", "描述、诊断、预测、实验还是准实验", "数据生成过程、对照组、假设和限制", "相关结果不得写成因果"],
      ["行动", "建议是否可执行，是否有护栏和观察周期", "决策、负责人、主指标、护栏和复盘", "没有行动与验证就不算闭环"]
    ],
    cases: [
      {
        org: "华东某电商增长团队",
        trigger: "新人券上线后首日转化提升，但一周后复购和毛利下降",
        data: "曝光、领券、下单、支付、退款、复购、渠道和用户分层",
        problem: "只比较活动前后，没有对照组；自然流量和付费流量归因重叠",
        action: "按用户分层做对照实验，主指标看新增贡献，加入退款、毛利和长期留存护栏",
        outcome: "示例分析把短期提升与长期收益分开，并给出扩大或停止条件"
      },
      {
        org: "华南某 SaaS 运营团队",
        trigger: "总体续费率稳定，但多个客户分层续费率都在下降",
        data: "客户规模、行业、合同期、产品使用、工单、续费和流失原因",
        problem: "高价值大客户占比上升掩盖小客户流失，形成辛普森悖论",
        action: "按客户分层和合同期拆解结构贡献，回到增购、降级和工单记录验证原因",
        outcome: "复合案例用结构变化、分组率和样本量解释总体指标"
      },
      {
        org: "华北某内容平台",
        trigger: "推荐策略让人均时长增加，但次日留存和创作者多样性下降",
        data: "实验组、曝光、点击、时长、留存、内容类型、创作者分布和投诉",
        problem: "实验只看点击与时长，没有检查新奇效应、用户结构和内容供给副作用",
        action: "增加分层分析、长期观察和多样性护栏，按用户活跃度评估策略差异",
        outcome: "示例项目证明主指标显著后仍需继续观察成本、体验和长期价值"
      }
    ],
    checks: [
      "分析问题写明对象、时间、比较基准、决策和行动负责人",
      "所有指标检查分母、状态、时间、去重和排除条件",
      "描述、预测和因果结论分别命名并说明证据边界",
      "报告同时保留反例、样本量、护栏指标和停止条件"
    ],
    sources: [
      ["Trustworthy Online Controlled Experiments", "https://experimentguide.com/"],
      ["OECD Composite Indicators Handbook", "https://www.oecd.org/en/publications/handbook-on-constructing-composite-indicators-methodology-and-user-guide_9789264043466-en.html"],
      ["Khan Academy Statistics", "https://www.khanacademy.org/math/statistics-probability"]
    ]
  },
  {
    key: "ai-governance",
    label: "AI 数据治理、合规与可解释性",
    match: /AI治理|AI数据|训练数据|数据标注|数据偏见|数据漂移|隐私保护|模型数据|AI-ready|数据卡|模型卡|可解释性|可追溯|反馈数据|数据飞轮|合成数据|Prompt资产|Agent权限|AI系统审计/i,
    objective: "为 AI 数据建立来源、授权、质量、版本、偏差、隐私、血缘和使用反馈的控制链，让模型效果与风险都能解释和追溯。",
    lenses: [
      ["来源", "数据从哪里来、是否授权、能否用于训练或评测", "数据卡、授权依据、采集时间和用途", "来源不清的数据不得进入训练"],
      ["质量", "样本是否代表目标人群，标注是否一致，偏差在哪里", "抽样审核、标注一致性、分群覆盖和反例", "只报总体准确率不充分"],
      ["版本", "数据、Prompt、特征、模型和评测能否互相对应", "版本标识、变更记录、回放和血缘", "版本断链时停止发布"],
      ["风险", "隐私、偏见、越权、错误信息和滥用如何控制", "红队、审计、人工复核和事故记录", "高风险输出必须有降级路径"]
    ],
    cases: [
      {
        org: "华东某医疗 AI 团队",
        trigger: "模型在总体测试集表现良好，但老年与罕见病人群错误率明显更高",
        data: "影像、病历、年龄、疾病亚型、标注来源、训练版本和分群评估结果",
        problem: "评测集人群结构失衡，数据卡没有记录排除标准",
        action: "补充分群样本和专家复核，建立数据卡与模型卡，发布前检查弱势群体指标和错误类型",
        outcome: "示例治理将总体准确率改为分群效果、风险差异和人工复核共同验收"
      },
      {
        org: "华南某客服 AI 团队",
        trigger: "模型升级后回答质量波动，无法确认是数据、Prompt 还是检索变化",
        data: "训练与评测数据、Prompt、检索索引、模型、请求日志和反馈",
        problem: "各组件独立发布，没有统一版本和回放能力",
        action: "为每次请求记录数据、索引、Prompt、模型和代码版本，建立可重放评测与一键回滚",
        outcome: "复合案例缩短问题定位时间，并支持影响范围分析"
      },
      {
        org: "华北某政务问答团队",
        trigger: "生成式问答引用了过期政策，并可能包含个人信息",
        data: "政策版本、权限、问题、检索片段、输出、敏感检测和人工反馈",
        problem: "知识更新没有失效机制，日志中保存了原始敏感文本",
        action: "建立政策有效期与来源校验，日志脱敏，输出前做敏感和引用检查，高风险问题转人工",
        outcome: "示例项目以引用正确率、过期命中率、敏感输出率和转人工率评估"
      }
    ],
    checks: [
      "训练、评测和生产数据记录来源、授权、用途、版本和负责人",
      "按人群、场景和风险等级评估质量与偏差，不只报告总体平均",
      "数据、Prompt、特征、索引、模型和评测版本可以互相对应和回放",
      "建立隐私、越权、错误信息、滥用和人工复核控制"
    ],
    sources: [
      ["NIST AI Risk Management Framework", "https://www.nist.gov/itl/ai-risk-management-framework"],
      ["Datasheets for Datasets", "https://arxiv.org/abs/1803.09010"],
      ["Model Cards for Model Reporting", "https://arxiv.org/abs/1810.03993"]
    ]
  },
  {
    key: "career",
    label: "数据岗位求职与面试表达",
    match: /求职|面试|岗位|简历|薪资|招聘|职业发展|职业路径|能力模型|技能清单|JD|offer|作品集|STAR|转行|成长路径|领导力/i,
    objective: "把岗位要求拆成可验证能力，用真实项目证据回答业务、技术、协作和反思问题，并清楚说明个人贡献与结果边界。",
    lenses: [
      ["岗位", "JD 真正要求解决什么问题、面对什么数据和约束", "职责、技术栈、业务域、交付对象和面试流程", "不要只按关键词堆技能"],
      ["证据", "项目是否有问题、动作、结果、验证和个人贡献", "需求记录、代码、指标、上线、复盘和他人反馈", "团队成果不得写成个人成果"],
      ["技术", "是否理解原理、取舍、故障和边界", "架构图、执行计划、事故复盘和替代方案", "不能只背工具定义"],
      ["表达", "回答是否结构化、诚实、有反思且可追问", "STAR、白板、追问记录和模拟面试反馈", "不知道的部分明确说明"]
    ],
    cases: [
      {
        org: "华东某互联网公司面试小组",
        trigger: "候选人简历写了多个大数据项目，但追问吞吐、延迟和故障恢复时回答空泛",
        data: "简历要点、项目背景、架构、指标、个人职责、故障记录和追问表现",
        problem: "项目均以工具清单描述，没有基线、取舍、验证和个人边界",
        action: "按 STAR 重写两个核心项目，补充容量、SLA、失败案例和替代方案，并进行三轮模拟追问",
        outcome: "示例准备把表达从“做了什么”转为“为什么这样做、如何证明有效”"
      },
      {
        org: "华南某金融科技公司招聘团队",
        trigger: "候选人技术题答得不错，但业务沟通和风险意识未达到高级岗位要求",
        data: "案例面试记录、指标定义、权限、合规、协作冲突和复盘表现",
        problem: "候选人只关注计算实现，没有说明消费者、口径、权限和上线风险",
        action: "补充业务访谈式练习，要求每次方案先写对象、决策、SLA、风险和验收",
        outcome: "复合案例用结构化评分而非单一算法题判断岗位匹配"
      },
      {
        org: "华北某转行学习者",
        trigger: "作品集包含多个教程项目，投递后很少获得面试",
        data: "目标 JD、作品问题、数据来源、代码、结果、文档和招聘方反馈",
        problem: "项目彼此重复，没有真实问题、验证和质量控制",
        action: "只保留两个有业务闭环的项目，补充数据卡、质量规则、失败样本、复盘和可复跑说明",
        outcome: "示例求职材料用问题深度和证据质量替代项目数量"
      }
    ],
    checks: [
      "每个岗位准备两到三个与 JD 最相关且有证据的项目",
      "回答包含背景、个人任务、关键动作、验证结果、限制和反思",
      "技术追问能解释原理、替代方案、故障和取舍",
      "所有数字、职责和成果都能回到真实材料"
    ],
    sources: [
      ["STAR Interview Method", "https://www.themuse.com/advice/star-interview-method"],
      ["Google Hiring Guides", "https://www.google.com/about/careers/applications/how-we-hire/"]
    ]
  },
  {
    key: "learning",
    label: "学习路线、能力地图与项目练习",
    match: /学习|路线|入门|进阶|能力地图|成长|行动计划|TOP10|能力模型|阶段|L1|L2|L3|L4|知识库|技能评估/i,
    objective: "从目标岗位和真实任务反推知识地图，用可复现练习、反馈、项目和复盘逐步提升，而不是按课程数量衡量进度。",
    lenses: [
      ["目标", "学习后要完成什么真实任务、达到什么标准", "岗位 JD、项目验收、当前能力差距", "目标不清时先做小任务诊断"],
      ["练习", "是否有输入、输出、反馈、错误纠正和重复应用", "练习记录、测试、代码评审和作品", "只看不练不算完成"],
      ["项目", "是否覆盖业务问题、数据、工程、质量和表达", "需求、代码、数据卡、质量结果和复盘", "教程复刻必须增加真实问题"],
      ["迁移", "能否在新数据、新约束和新工具中复用", "变式练习、口头讲解和跨场景作品", "不能迁移说明尚未掌握"]
    ],
    cases: [
      {
        org: "华东某转行学习者",
        trigger: "学完 SQL、Python 和多门大数据课程后，仍无法独立完成数据开发任务",
        data: "课程清单、练习记录、项目代码、错误日志和目标岗位 JD",
        problem: "学习以观看和收藏为主，练习只做标准题，没有数据质量和交付概念",
        action: "围绕一个订单主题完成采集、建模、SQL、质量、调度和复盘六步项目，每周做代码评审",
        outcome: "示例路线用可复跑作品、口头讲解和故障修复替代课程完成率"
      },
      {
        org: "华南某应届生学习小组",
        trigger: "每个人都做相似电商看板，作品无法体现岗位差异",
        data: "目标岗位、行业、数据范围、技术栈、作品集和面试反馈",
        problem: "项目没有选择约束，分析问题和工程深度都不足",
        action: "按分析师、数据开发、数据治理方向拆分作品，共享脱敏数据但选择不同问题与交付物",
        outcome: "复合路线让作品既能比较能力，也能体现目标岗位差异"
      },
      {
        org: "华北某在职工程师",
        trigger: "零散学习很多工具，但工作中仍无法主导性能优化项目",
        data: "工作问题、Spark/Kafka 故障、排查记录、代码版本和复盘",
        problem: "缺少基线、实验、对账和长期观察，只学习参数结论",
        action: "选择一个真实慢任务，记录执行计划、瓶颈、优化、结果和回归，再整理成技术分享",
        outcome: "示例成长路径用问题闭环、复用次数和他人反馈衡量能力"
      }
    ],
    checks: [
      "学习目标必须对应一个可观察任务或作品验收标准",
      "每周安排主动回忆、动手练习、反馈和错误复盘",
      "项目必须包含业务问题、数据质量、工程实现和结果解释",
      "用新场景变式、讲解和实际复用检验迁移能力"
    ],
    sources: [
      ["Learning How to Learn", "https://www.coursera.org/learn/learning-how-to-learn"],
      ["Deliberate Practice Overview", "https://www.goodtherapy.org/blog/deliberate-practice-definition-examples-techniques/"]
    ]
  }
];

const GUIDE_MATCH_RULES = {
  agent: {
    priority: 150,
    pattern: /Agent(?:ic)?|智能体|工具调用|控制平面|多\s*Agent|沙箱执行|权限审计|可观测性三件套/i
  },
  rag: {
    priority: 146,
    pattern: /RAG|检索增强|向量数据库|语义搜索|混合检索|重排|文档切片|Embedding|Agentic-RAG/i
  },
  kafka: {
    priority: 144,
    pattern: /Kafka|消费积压|消息队列|消息中间件|Topic\s*分区|Broker\s*副本|Rebalance/i
  },
  "spark-shuffle": {
    priority: 142,
    pattern: /Spark|RDD|DataFrame|Shuffle|数据倾斜|宽依赖|窄依赖|Executor|Task\s*长尾|Stage|小文件|水塘抽样|二次排序|Partitioner|reduceByKey|groupByKey|广播变量|累加器|Standalone/i
  },
  streaming: {
    priority: 138,
    pattern: /Flink|流处理|实时计算|Structured\s*Streaming|Spark\s*Streaming|事件驱动|Exactly-once|双流\s*Join|水位线|Checkpoint/i
  },
  cdc: {
    priority: 136,
    pattern: /CDC|Debezium|增量接入|数据库同步|Binlog|变更数据|断点续传/i
  },
  lineage: {
    priority: 126,
    pattern: /血缘|Lineage|元数据|数据目录|DataHub|Apache\s*Atlas|字段级|影响分析|数据资产地图/i
  },
  "data-quality": {
    priority: 124,
    pattern: /数据质量|质量监控|质量评估|质量改进|Great\s*Expectations|Griffin|质量规则|数据测试|数据校验|异常检测与处理/i
  },
  "ai-governance": {
    priority: 123,
    pattern: /AI数据治理|AI治理|训练数据|数据标注|数据偏见|模型数据|数据卡|模型卡|可解释性|AI系统审计|AI伦理|合成数据|数据飞轮|Prompt资产|反馈数据/i
  },
  "master-standard": {
    priority: 121,
    pattern: /数据标准|主数据|MDM|OneID|统一身份|指标口径|指标字典|语义层|数据合约|业务术语|数据编码/i
  },
  "security-governance": {
    priority: 119,
    pattern: /数据安全|分类分级|访问控制|权限管理|权限治理|隐私计算|个人信息|数据脱敏|数据加密|数据合规|数据审计|Ranger|零信任|跨境数据/i
  },
  "data-service": {
    priority: 117,
    pattern: /数据服务|RESTful|GraphQL|数据API|API设计|服务网关|服务编排|服务监控|服务部署|指标服务|语义层工程|Text-to-SQL|Agent-to-Data/i
  },
  llm: {
    priority: 114,
    pattern: /大模型|大语言模型|LLM|Prompt|提示工程|微调|Fine-tune|模型评估|LLMOps|多模态|生成式AI|自然语言处理/i
  },
  ml: {
    priority: 112,
    pattern: /机器学习|MLOps|MLlib|特征工程|特征平台|模型训练|模型部署|模型监控|推荐系统|排序模型|预测模型|分类模型|回归模型|深度学习|神经网络|计算机视觉|实时机器学习/i
  },
  performance: {
    priority: 108,
    pattern: /性能优化|查询慢|容量规划|存储优化|执行计划|OLAP选型|查询引擎|缓存优化|技术债务|成本优化|资源利用率|系统性能/i
  },
  scheduling: {
    priority: 106,
    pattern: /Airflow|DolphinScheduler|数据调度|任务调度|调度编排|依赖管理|工作流|补数|数据\s*DevOps|数据CI-CD|自动化部署|自动化监控|发布管理|环境管理/i
  },
  warehouse: {
    priority: 104,
    pattern: /数据仓库|数据湖|湖仓|数仓|维度建模|数据建模|概念数据建模|逻辑数据建模|物理数据建模|OneData|OneModel|数据分层|数据集市|星型|雪花|DataMesh|DataFabric|数据编织/i
  },
  sql: {
    priority: 102,
    pattern: /SQL|窗口函数|查询优化|执行计划|Join|聚合|分组|开窗|连续活跃|同比|环比|排名|去重|TopN|行列转换/i
  },
  analytics: {
    priority: 78,
    pattern: /指标体系|归因分析|AB测试|A\/B|实验设计|序贯实验|漏斗分析|留存分析|用户画像|RFM模型|商业模式|竞品分析|市场环境分析|统计分析|假设检验|相关性分析|回归分析|分析报告|数据故事|结构化思维|系统思维|批判性思维|业务问题转化|异常诊断|经营分析|ROI分析|转化率下滑诊断|流失分析|活动效果复盘|会员分层|渠道投放/i
  },
  career: {
    priority: 74,
    pattern: /求职|面试|简历模板|薪资谈判|薪酬谈判|职业发展|职业成长|能力模型|技能清单|作品集|岗位深度解析|岗位全解析|系统设计面试|算法面试|高频面试|转行|晋升路线/i
  },
  learning: {
    priority: 72,
    pattern: /学习路线|学习路径|成长路线|升级路线|升级计划|行动计划|能力地图|学习法|知识管理|刻意练习|新手踩坑|入门筑基|实战进阶|高级专家|领域领航|L[1-4]-/i
  }
};

const FALLBACK_MATCH_RULES = {
  "data-development": {
    priority: 92,
    pattern: /数据开发|ETL|ELT|数据管道|数据集成|数据接入|数据同步|数据采集|埋点采集|增量处理|全量同步|补数|任务开发|开发规范|开发流程|开发测试|数据测试|环境搭建|工具链|入仓|批处理/i
  },
  "data-architecture": {
    priority: 88,
    pattern: /数据架构|平台架构|架构模式|架构原则|架构评估|架构演进|数据中台|云原生|容器化|Kubernetes|微服务数据|Serverless|多云数据|基础设施|存储架构|处理架构|架构融合|本体论驱动/i
  },
  "data-team": {
    priority: 98,
    pattern: /数据(?:开发)?团队|团队组织|团队角色|团队流程|团队协作|技术管理|组织能力|职责边界|研发效能|数据文化|岗位协作|RACI/i
  },
  "technology-strategy": {
    priority: 84,
    pattern: /技术选型|选型评估|技术战略|技术趋势|技术栈|路线图|路线规划|供应商评估|开源方案|产品评测|POC|概念验证|总拥有成本|TCO|退出策略/i
  },
  "project-delivery": {
    priority: 82,
    pattern: /项目.*交付|项目交付|项目管理|项目实战|落地指南|实施指南|建设路径|里程碑|项目验收|项目复盘|需求评审|范围管理|进度管理|风险管理|实践案例|成功案例/i
  },
  "data-governance": {
    priority: 80,
    pattern: /数据治理|治理框架|治理成熟度|治理制度|数据管理|资产责任|数据要素|数据制度|治理推广|治理运营|管理机制|规范体系/i
  },
  "ai-foundation": {
    priority: 76,
    pattern: /人工智能|AI基础|AI工程|AI系统|AI项目|机器学习基础|深度学习基础|大模型基础|算法基础|模型训练|特征工程|智能应用|行业应用|金融风控|对抗攻击/i
  }
};

const FALLBACK_TOPIC_GUIDES = [
  {
    key: "data-development",
    label: "数据开发、ETL 与交付流程",
    objective: "把需求、源接口、分层模型、代码、配置、测试、发布和回滚连成一条可重复执行的数据交付链路。",
    lenses: [
      ["需求与粒度", "指标和明细分别服务谁，一行数据代表什么", "需求说明、粒度声明、样例单据", "粒度未确认不进入编码"],
      ["接口与变更", "字段、分区、更新频率和 Schema 如何演进", "接口契约、DDL、版本和变更记录", "不兼容变更先新版本并存"],
      ["测试与幂等", "重复运行、空分区、乱序和边界值是否安全", "测试数据、重跑结果、唯一键和事务", "不幂等任务禁止自动补数"],
      ["发布与回滚", "谁审批、如何灰度、失败后怎样恢复", "发布单、监控、回滚脚本和验收记录", "关键链路必须有回滚演练"]
    ],
    cases: [
      {
        org: "华东某零售数据开发组",
        trigger: "订单日报连续两天出现重复金额，重跑后差异进一步扩大",
        data: "源订单、支付、退款、任务实例、写入模式、分区和质量结果",
        problem: "任务使用追加写，支付回调重复进入 ODS，开发只按订单号关联而没有确认退款粒度",
        action: "为源事件补充唯一键和版本，按订单行统一事实粒度，改为分区幂等合并并建立金额桥接对账",
        outcome: "示例交付以重跑一致、金额平衡、分区覆盖和下游验收作为恢复条件"
      },
      {
        org: "华南某 SaaS 数据平台",
        trigger: "一次上游字段扩容导致多个 ETL 任务失败，发布窗口内无法快速定位影响",
        data: "接口契约、DDL 历史、字段血缘、任务依赖、失败日志和下游资产",
        problem: "代码、表结构和调度配置分别发布，测试环境长期使用旧 Schema",
        action: "建立契约兼容检查、字段级影响分析、影子表和灰度发布，生产前自动跑新旧结果对照",
        outcome: "示例流程把发布前检查、失败阻断、回滚和下游通知串成同一门禁"
      },
      {
        org: "华北某制造数据团队",
        trigger: "历史补数运行三天仍未完成，正常日批任务同时出现资源争抢",
        data: "补数分区、任务耗时、资源队列、依赖层级、下游锁和人工处理记录",
        problem: "所有日期一次性并发启动，任务内部没有分区级状态，失败后只能整批重跑",
        action: "按依赖层级和业务优先级分批，记录每个分区的输入输出计数，并对重跑设置幂等与限流",
        outcome: "示例项目用补数进度、正常任务 SLA、重复率和人工介入次数衡量稳定性"
      }
    ],
    checks: [
      "代码、配置、DDL、权限和调度依赖进入同一版本与发布记录",
      "每个任务声明输入输出粒度、分区、幂等键和重跑边界",
      "测试覆盖空分区、重复数据、迟到数据、Schema 变化和失败恢复",
      "上线前完成数量、金额、主键、时延和下游可读性验收"
    ],
    sources: [
      ["Apache Airflow Best Practices", "https://airflow.apache.org/docs/apache-airflow/stable/best-practices.html"],
      ["dbt Project Best Practices", "https://docs.getdbt.com/best-practices"],
      ["Great Expectations Documentation", "https://docs.greatexpectations.io/docs/"]
    ]
  },
  {
    key: "data-architecture",
    label: "数据架构、平台与云原生基础设施",
    objective: "从业务能力、数据流、访问模式、一致性、SLA、安全和成本出发拆分组件，并用可验证的非功能指标约束演进。",
    lenses: [
      ["业务能力", "架构到底支撑哪些决策、流程和数据产品", "能力地图、用例、消费方和现状痛点", "没有业务约束不做平台堆叠"],
      ["数据流", "批、流、CDC、共享与服务之间如何衔接", "源系统、粒度、频率、容量和延迟", "每条链路要有唯一责任边界"],
      ["非功能", "可用性、扩展性、一致性、安全和成本如何取舍", "SLO、压测、故障演练、账单和权限矩阵", "关键指标必须有基线"],
      ["演进", "旧系统如何迁移，数据和接口怎样兼容回滚", "版本、双写/双读、灰度和回滚方案", "迁移期间保留可对账双链路"]
    ],
    cases: [
      {
        org: "华东某互联网平台",
        trigger: "数据湖和实时数仓重复建设，同一指标在多个引擎与团队中反复开发",
        data: "业务能力、数据流、查询模式、作业成本、血缘、SLA 和组织边界",
        problem: "架构按工具而不是数据产品划分，公共维度与指标没有唯一责任团队",
        action: "按业务域定义数据产品和契约，湖仓共享存储、分层计算，公共指标进入语义层并记录版本",
        outcome: "示例架构用复用率、查询 P95、重复开发量、成本和故障恢复验证价值"
      },
      {
        org: "华南某金融机构",
        trigger: "核心系统迁移到云上后，跨域链路时延和权限边界比预期更复杂",
        data: "系统调用、网络、数据分区、密钥、身份、审计、SLO 和迁移批次",
        problem: "只迁移计算和存储，没有同步治理身份、网络域、数据分级与故障隔离",
        action: "拆分受控数据域，建立统一身份与最小权限，按业务链路做双跑对照和故障演练",
        outcome: "示例迁移以功能、数据、权限、性能和回滚五类证据分批放行"
      },
      {
        org: "华北某制造集团",
        trigger: "集团建设统一数据中台后，工厂实时数据仍无法稳定支持排产",
        data: "MES、设备事件、工单、主数据、边缘缓存、网络和下游 API",
        problem: "所有数据被集中到中心后才处理，实时链路受网络和跨域权限影响，主数据版本也不一致",
        action: "采用边缘预处理与中心治理结合，明确设备、工单和批次主键，按场景拆分实时与离线职责",
        outcome: "示例项目用端到端延迟、设备覆盖率、数据完整率和恢复时间验收"
      }
    ],
    checks: [
      "每个组件都对应明确业务能力、数据流和消费方，而非只为技术栈完整",
      "架构决策同时评估 SLA、一致性、安全、容量、成本和可运维性",
      "跨域数据流有契约、主键、版本、权限和故障隔离",
      "迁移方案包含双跑对账、灰度、数据校验和可执行回滚"
    ],
    sources: [
      ["AWS Well-Architected Framework", "https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html"],
      ["Azure Data Architecture Guide", "https://learn.microsoft.com/en-us/azure/architecture/data-guide/"],
      ["CNCF Cloud Native Definition", "https://github.com/cncf/toc/blob/main/DEFINITION.md"]
    ]
  },
  {
    key: "data-team",
    label: "数据团队组织、职责与交付机制",
    objective: "把业务目标、岗位边界、决策权、交付流程、能力培养和绩效证据连接起来，让团队围绕数据产品而不是临时需求运转。",
    lenses: [
      ["目标", "团队服务哪些业务结果，当前最关键的交付瓶颈是什么", "目标树、需求队列、SLA、故障和业务反馈", "没有共同目标不先调整组织"],
      ["职责", "谁定义口径、谁开发、谁验收、谁值班", "RACI、资产负责人、值班表和升级路径", "关键资产不能只有口头负责人"],
      ["流程", "需求、评审、开发、发布和复盘如何流转", "看板、版本、门禁、会议和交付度量", "流程必须减少等待而非增加仪式"],
      ["能力", "岗位需要什么能力，如何用作品与故障检验", "能力矩阵、代码评审、复盘和培养计划", "培训完成率不能代替交付证据"]
    ],
    cases: [
      {
        org: "华东某零售集团数据团队",
        trigger: "业务同时提出数十个看板需求，团队长期救火但关键经营指标仍频繁延期",
        data: "需求来源、价值、交付周期、返工、资产复用、故障和业务采用",
        problem: "所有人按需求接单，没有数据产品和领域负责人，公共口径无人维护",
        action: "按业务域建立产品负责人、数据负责人和平台负责人，统一需求准入与季度路线",
        outcome: "示例机制用交付周期、返工率、关键资产稳定性、复用率和业务采用评估"
      },
      {
        org: "华南某金融科技公司",
        trigger: "数据工程师、分析师和平台团队互相等待，生产故障经常找不到责任人",
        data: "任务边界、值班记录、故障时间线、资产清单和跨团队依赖",
        problem: "岗位按工具划分，数据链路却跨多个团队，缺少端到端负责人",
        action: "为关键数据产品设置端到端负责人，定义开发与运维交接、值班升级和联合复盘",
        outcome: "示例组织调整以故障恢复、交接遗漏、等待时间和员工负荷验证"
      },
      {
        org: "华北某制造企业数据部",
        trigger: "团队扩编后个人能力不均衡，新人长期无法独立承担生产任务",
        data: "岗位任务、代码评审、项目交付、故障处理、学习记录和导师反馈",
        problem: "培养依赖零散课程，没有按任务难度和真实证据评估能力",
        action: "建立能力矩阵与分级任务，使用结对开发、代码评审、故障演练和作品答辩完成认证",
        outcome: "示例培养以独立交付、缺陷率、复用、复盘质量和他人反馈衡量成长"
      }
    ],
    checks: [
      "关键数据产品和资产有唯一负责人、备份人和明确升级路径",
      "团队目标与业务结果、数据质量、SLA 和成本共同关联",
      "需求准入、开发、发布、值班和复盘形成可观察流程",
      "能力评估以真实任务、代码、故障和反馈为依据"
    ],
    sources: [
      ["Team Topologies", "https://teamtopologies.com/"],
      ["Google re:Work Teams", "https://rework.withgoogle.com/guides/understanding-team-effectiveness/"],
      ["DAMA-DMBOK Body of Knowledge", "https://www.dama.org/cpages/body-of-knowledge"]
    ]
  },
  {
    key: "technology-strategy",
    label: "技术选型、路线图与架构演进",
    objective: "把业务约束、总拥有成本、团队能力、迁移风险和退出策略放进同一决策框架，避免用功能清单和短期演示做技术选型。",
    lenses: [
      ["问题适配", "候选技术解决的具体瓶颈是否真实存在", "基准任务、现状基线、失败案例", "没有基线不做替换"],
      ["总成本", "许可、开发、运维、迁移、培训、退出成本各是多少", "三年 TCO、人员投入和沉淀资产", "只比较单价会误导决策"],
      ["风险", "供应商锁定、版本生命周期、社区活跃度和合规如何", "版本路线、支持条款、漏洞和替代方案", "关键系统保留退出路径"],
      ["落地", "试点、迁移、并行、验收和回滚如何安排", "PoC、灰度、双跑和决策门禁", "演示成功不等于生产可用"]
    ],
    cases: [
      {
        org: "华东某互联网公司",
        trigger: "团队准备替换现有查询引擎，候选方案在小型演示中性能差异明显",
        data: "真实查询模板、数据规模、并发、P95、资源成本、兼容性和运维复杂度",
        problem: "演示只跑单条扫描查询，没有覆盖 Join、更新、权限和故障恢复",
        action: "建立生产查询回放集与加权评分，按功能、性能、成本、风险和迁移工作量做 PoC",
        outcome: "示例评审保留不选方案的理由和退出条件，而不是只记录最终赢家"
      },
      {
        org: "华南某制造集团",
        trigger: "多个工厂希望采用不同湖仓产品，集团担心重复平台和长期维护成本",
        data: "工厂规模、网络、实时需求、数据主权、现有技能和三年预算",
        problem: "选型只比较存储格式和查询速度，没有计算跨厂治理与运维总成本",
        action: "区分集团标准能力与工厂本地能力，建立兼容接口和集中元数据，保留例外审批",
        outcome: "示例架构在标准化与业务灵活性之间设置可量化边界"
      },
      {
        org: "华北某金融机构",
        trigger: "新技术 PoC 效果良好，但上线后版本升级和安全补丁无人负责",
        data: "产品生命周期、供应商支持、内部技能、漏洞、升级和替代方案",
        problem: "评审只看短期性能，没有定义运维所有者、升级节奏和退出计划",
        action: "补充总拥有成本和生命周期评估，设置版本基线、责任人和季度退出演练",
        outcome: "示例决策把长期可维护性纳入上线门槛"
      }
    ],
    checks: [
      "选型从真实问题和现状基线出发，不使用厂商演示作为唯一证据",
      "评估功能、性能、总成本、风险、团队能力和迁移工作量",
      "PoC 覆盖真实查询、并发、权限、故障恢复和升级",
      "记录被否决方案、决策假设、退出策略和复审日期"
    ],
    sources: [
      ["AWS Well-Architected Framework", "https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html"],
      ["ThoughtWorks Technology Radar", "https://www.thoughtworks.com/radar"],
      ["CNCF Technology Radar", "https://radar.cncf.io/"]
    ]
  },
  {
    key: "project-delivery",
    label: "数据项目交付、验收与运营",
    objective: "从问题、范围、基线、方案、数据、上线、采用和复盘管理项目，确保交付的是可验证的业务能力而不是一次性材料。",
    lenses: [
      ["问题与范围", "项目改变什么行为，边界和不做什么是什么", "决策记录、需求说明和现状基线", "范围不清时先做诊断"],
      ["方案与证据", "为什么选择当前方案，关键假设如何验证", "替代方案、原型、数据和评审记录", "重大假设必须有试验"],
      ["上线", "权限、质量、监控、培训和回滚是否就绪", "上线清单、演练、验收和责任人", "关键风险未关闭不发布"],
      ["采用与收益", "谁在使用，是否改变决策，副作用如何", "使用日志、主指标、护栏和复盘", "上线数量不等于项目成功"]
    ],
    cases: [
      {
        org: "华东某零售数据项目组",
        trigger: "项目按期上线看板，但业务仍用 Excel 决策，数据团队无法证明价值",
        data: "需求访谈、用户任务、使用日志、指标口径、决策记录和反馈",
        problem: "项目只定义功能范围，没有定义采用动作和决策改变",
        action: "把关键决策、使用场景和验收样例写入范围，按业务角色灰度并跟踪真实查询与行动",
        outcome: "示例验收以采用率、决策闭环、口径争议和人工步骤变化评估"
      },
      {
        org: "华南某银行数据中台项目",
        trigger: "平台组件全部交付，但跨部门数据接入进度严重滞后",
        data: "资产范围、责任矩阵、接口、权限、迁移批次和依赖",
        problem: "技术任务完成被当作项目进度，业务口径、数据授权和源系统改造没有纳入计划",
        action: "建立跨域里程碑和升级路径，把数据契约、权限与源系统验收作为接入完成标准",
        outcome: "示例项目管理按可用资产、业务验收和依赖关闭而不是代码提交衡量"
      },
      {
        org: "华北某制造数据治理项目",
        trigger: "试点质量问题改善明显，但推广到更多工厂后效果迅速衰减",
        data: "试点机制、责任人、规则、工单、培训和复制成本",
        problem: "项目依赖少数专家手工推动，没有形成角色、模板和自动化",
        action: "把试点拆成可复制资产，建立本地负责人、规则模板、培训认证和月度复核",
        outcome: "示例推广以复制周期、规则复用、问题复发和本地自治能力评估"
      }
    ],
    checks: [
      "项目目标包含业务行为、主指标、护栏指标和观察周期",
      "范围明确数据、系统、团队、权限和不在本期处理的事项",
      "上线前完成质量、权限、监控、培训和回滚验收",
      "项目复盘同时衡量采用、收益、副作用和可复制性"
    ],
    sources: [
      ["PMI Disciplined Agile", "https://www.pmi.org/disciplined-agile"],
      ["Atlassian Project Management Guide", "https://www.atlassian.com/agile/project-management"],
      ["DAMA-DMBOK Body of Knowledge", "https://www.dama.org/cpages/body-of-knowledge"]
    ]
  },
  {
    key: "data-governance",
    label: "数据治理制度、责任与运营",
    objective: "围绕关键数据资产建立标准、责任、质量、安全、血缘、变更和问题闭环，让治理机制进入日常交付。",
    lenses: [
      ["资产", "哪些数据影响关键决策、监管和资金", "资产清单、等级、消费者和故障历史", "先从高价值资产开始"],
      ["责任", "谁定义、谁生产、谁使用、谁批准变更", "RACI、数据 steward 和升级路径", "责任必须带决策权与时限"],
      ["规则", "哪些标准和质量规则需要自动执行", "规则、阈值、样本、工单和豁免", "规则失败要对应动作"],
      ["运营", "治理是否进入发布、事件和绩效流程", "评审、复盘、成熟度和采用记录", "没有业务使用的治理活动应重做"]
    ],
    cases: [
      {
        org: "华东某集团数据治理办公室",
        trigger: "治理制度发布一年，但新项目仍绕过标准并持续产生重复指标",
        data: "项目流程、指标清单、评审记录、责任人、问题工单和系统门禁",
        problem: "治理只靠培训和文档，没有进入立项、开发和发布流程",
        action: "把资产登记、口径评审、质量门禁和安全检查嵌入项目里程碑，关键资产设置联合负责人",
        outcome: "示例治理用绕过率、重复指标、返工和问题闭环衡量制度是否生效"
      },
      {
        org: "华南某保险公司",
        trigger: "监管口径变更后多个报表难以在期限内完成影响分析",
        data: "指标、SQL、字段血缘、报表、责任人、版本和变更历史",
        problem: "制度有流程，但血缘和指标定义不可追踪，依赖专家回忆",
        action: "建立指标到字段的可追溯链路，变更模板自动生成下游清单和验证任务",
        outcome: "示例项目把影响分析从人工搜索转为可审计流程"
      },
      {
        org: "华北某工业集团",
        trigger: "各工厂治理成熟度差异大，总部统一规则难以落地",
        data: "工厂资产、系统、人员、问题、规则执行和本地流程",
        problem: "总部按同一优先级推广全部规则，缺少本地负责人和差异化路径",
        action: "按风险和场景分级，建立总部标准、本地执行、例外审批和成熟度评审",
        outcome: "示例机制兼顾统一控制与现场可执行性"
      }
    ],
    checks: [
      "关键资产具有唯一负责人、业务定义、消费者和风险等级",
      "标准、质量和安全规则进入项目与发布流程",
      "血缘、版本和问题工单支持影响分析与审计",
      "治理成效由风险、返工、故障和采用衡量"
    ],
    sources: [
      ["DAMA-DMBOK Body of Knowledge", "https://www.dama.org/cpages/body-of-knowledge"],
      ["NIST Data Governance Guide", "https://www.nist.gov/publications/nist-privacy-framework-version-10"],
      ["Open Data Contract Standard", "https://bitol-io.github.io/open-data-contract-standard/latest/"]
    ]
  },
  {
    key: "ai-foundation",
    label: "人工智能基础、方法与业务应用",
    objective: "从任务、数据、基线、模型、评估、部署和风险理解 AI 能力，避免把模型热度等同于业务价值。",
    lenses: [
      ["任务", "问题是分类、预测、生成、检索还是动作决策", "输入输出、成功标准、失败成本", "无需 AI 时优先规则或简单模型"],
      ["数据", "样本是否代表业务、是否泄漏、是否获授权", "数据卡、标签、分群、版本和来源", "数据不合格不先调模型"],
      ["评估", "离线、上线和人工评估是否一致", "基线、时间切分、分群、任务完成和风险", "高风险错误单独设门槛"],
      ["部署", "模型版本、漂移、延迟、成本、回滚和人工接管", "监控、灰度、日志和事故演练", "无回滚不进入关键流程"]
    ],
    cases: [
      {
        org: "华东某内容平台",
        trigger: "模型离线准确率提升，但线上推荐点击与用户留存没有改善",
        data: "样本、特征、时间切分、曝光、点击、留存、成本和实验分组",
        problem: "训练数据使用未来信息，评估只看总体准确率，没有覆盖冷启动与内容多样性",
        action: "重建时间外评测，加入业务护栏和线上对照，按用户分层分析收益与副作用",
        outcome: "示例评估把模型指标、业务动作和长期价值分开验证"
      },
      {
        org: "华南某金融机构",
        trigger: "智能客服上线后解决率一般，高风险问题却偶尔给出过度确定回答",
        data: "真实会话、意图、知识来源、人工转接、错误成本和模型日志",
        problem: "评测集以常见问题为主，没有拒答、越权和复杂问题样本",
        action: "按意图与风险分层建立评测，低置信度澄清或转人工，关键答案强制引用",
        outcome: "示例门禁以任务完成、引用支持、风险拦截和人工采纳评估"
      },
      {
        org: "华北某制造企业",
        trigger: "设备预测模型准确率高，但维修工单和停机成本没有下降",
        data: "传感器、设备、故障、维修、备件、停机和排班",
        problem: "随机切分造成数据泄漏，目标没有包含提前窗口和误报成本",
        action: "按设备与时间分组验证，使用成本矩阵选择阈值，并把预警接入人工确认流程",
        outcome: "示例项目以有效召回、提前时长、误报成本和维修收益验收"
      }
    ],
    checks: [
      "用简单基线和业务价值证明需要 AI",
      "训练、验证和测试按时间或实体隔离并检查泄漏",
      "离线、线上、人工和风险指标共同构成评估",
      "部署具备版本、监控、漂移、回滚和人工接管"
    ],
    sources: [
      ["Google Machine Learning Crash Course", "https://developers.google.com/machine-learning/crash-course"],
      ["NIST AI Risk Management Framework", "https://www.nist.gov/itl/ai-risk-management-framework"],
      ["Rules of Machine Learning", "https://developers.google.com/machine-learning/guides/rules-of-ml"]
    ]
  }
];

const DOMAIN_TITLE_RULES = [
  [/机器学习|深度学习|大模型|生成式AI|人工智能|Agent|RAG|LLM|Prompt|Text[\s-]*to[\s-]*SQL|自然语言处理|向量数据库/i, "AI 与大数据"],
  [/医疗|医院|临床|患者|医保|药品|检验|护理|健康|疾病|诊断|手术|影像|基因/i, "医疗健康"],
  [/零售|电商|店铺|商品|购物|会员|促销|订单|履约|供应链|快消/i, "零售电商"],
  [/制造|工厂|产线|设备|工单|物料|质检|汽车|新能源|钢铁|化工|食品加工/i, "制造业"],
  [/金融|银行|保险|证券|基金|信贷|风控|支付|清算|理财|资产|贷款|逾期/i, "金融行业"],
  [/教育|学习|学校|课程|学生|教师|考试|培训/i, "教育培训"],
  [/物流|快递|运输|仓储|配送|运单|车队|港口/i, "交通物流"],
  [/房地产|地产|楼盘|物业|租约|经纪|家居|建筑/i, "房地产"],
  [/能源|电力|电网|石油|燃气|光伏|风电|储能|煤炭/i, "能源电力"],
  [/农业|种植|养殖|农产品|农机|乡村/i, "农业"],
  [/互联网科技|搜索|浏览器|社交|内容平台|云服务|SaaS/i, "互联网科技"],
  [/互联网商业|直播|短视频|广告|内容电商|平台商业/i, "互联网商业分析"]
];

const VARIANT_OPENERS = [
  (p) => `把“${p.topic}”放进${p.context.scene}，真正困难的通常不是解释名词，而是把它变成一条能被核对、能被复现、也能推动行动的工程链路。本文不追求堆满概念，而是围绕这个主题拆出业务对象、数据粒度、典型故障、代码验证和验收方式。`,
  (p) => `“${p.topic}”在会议里常常只有一句话，落到数据团队却会展开成口径、主键、时间、状态、权限和交付责任。下面用一个从问题到上线的顺序展开，并穿插三个脱敏的复合案例，帮助你把标题里的知识迁移到真实项目。`,
  (p) => `讨论“${p.topic}”时，最容易犯的错误是直接从工具或报表开始。更有用的顺序是：先看业务链条，再找可观察指标，随后确认数据粒度，最后才选择 SQL、模型或平台组件。本文按这个顺序给出可执行方案和常见的失败样本。`,
  (p) => `一个关于“${p.topic}”的结论能不能被信任，取决于它是否能回到原始事件、明确时间和对象，并说明排除了哪些记录。下面不会用单一模板概括所有场景，而是结合${p.context.label}中的多类任务，展示数据建模、代码分析和项目验收之间如何衔接。`,
  (p) => `如果只记住“${p.topic}”的定义，遇到真实数据时仍然很难行动。本文把它拆成五个可检查问题：谁在使用、流程在哪里变化、数据一行代表什么、异常如何发现、上线后用哪个指标验收。每个部分都配一个工作案例或代码片段。`,
  (p) => `“${p.topic}”既可能是业务概念，也可能是技术方案，还可能是岗位能力。判断学习是否有效，要看能否在${p.context.scene}中做出一个可复现的小闭环。本文用多个案例展示从需求到数据结果，再回到业务行动和复盘的完整路径。`
];

const REVIEW_LENSES = [
  "结论是否能回到明细",
  "指标是否在同一对象和同一时间窗内计算",
  "数据质量异常是否与业务变化分开",
  "方案是否说明了成本、边界和停止条件",
  "上线后是否有人负责观察和复盘",
  "关键口径是否经过业务与技术共同确认",
  "异常值处理是否可能改变最终排名",
  "权限和敏感信息是否遵循最小必要原则"
];

function hashNumber(value) {
  const digest = crypto.createHash("sha1").update(value).digest();
  return digest.readUInt32BE(0);
}

function pick(items, seed) {
  return items[seed % items.length];
}

function cleanTitle(title) {
  return String(title)
    .replace(/\.md$/i, "")
    .replace(/^\d+(?:\.\d+)?[-_.、\s]+/, "")
    .replace(/-enriched$/i, "")
    .trim();
}

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function titleFromFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;
  const line = match[1].split(/\r?\n/).find((item) => item.startsWith("title:"));
  if (!line) return null;
  const raw = line.replace(/^title:\s*/, "").trim();
  try {
    return raw.startsWith('"') ? JSON.parse(raw) : raw.replace(/^'(.*)'$/, "$1");
  } catch {
    return null;
  }
}

function displayTitleFromMarkdown(markdown, fallbackTitle, relativePath) {
  const paywallTitle = markdown.match(/<p class="lab-paywall-document">([\s\S]*?)<\/p>/);
  return cleanTitle(
    (paywallTitle ? decodeHtml(paywallTitle[1]) : null) ||
    titleFromFrontmatter(markdown) ||
    fallbackTitle ||
    relativePath.split("/").at(-1).replace(/\.md$/i, "")
  );
}

function inferDomain(relativePath) {
  if (!relativePath.startsWith("【各行业的基础知识】/")) return null;
  const parts = relativePath.split("/");
  const segment = parts[1] || "";
  return Object.keys(DOMAIN_LIBRARY).find((name) => segment.includes(name)) || null;
}

function inferContext(relativePath, title = "") {
  const titleDomain = DOMAIN_TITLE_RULES.find(([pattern]) => pattern.test(title))?.[1];
  if (titleDomain && DOMAIN_LIBRARY[titleDomain]) {
    return { ...DOMAIN_LIBRARY[titleDomain], domainName: titleDomain };
  }
  const domainName = inferDomain(relativePath);
  if (domainName) {
    return { ...DOMAIN_LIBRARY[domainName], domainName };
  }
  const top = relativePath.split("/")[0];
  return {
    ...(TOP_CONTEXT[top] || DOMAIN_LIBRARY["跨行业通用"]),
    domainName: top.replace(/[【】]/g, "")
  };
}

function countPatternHits(pattern, text) {
  if (!text) return 0;
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  try {
    return [...text.matchAll(new RegExp(pattern.source, flags))].length;
  } catch {
    return pattern.test(text) ? 1 : 0;
  }
}

function scoreTopicGuide(guide, title, pathContext) {
  const rule = GUIDE_MATCH_RULES[guide.key];
  if (!rule) return { guide, score: -1, titleHits: 0, pathHits: 0 };
  const titleHits = countPatternHits(rule.pattern, title);
  const pathHits = countPatternHits(rule.pattern, pathContext);
  const specificity = Math.min(24, Math.round(rule.pattern.source.length / 18));
  const score = titleHits
    ? 1000 + rule.priority + specificity + Math.min(80, titleHits * 12)
    : pathHits
      ? 300 + rule.priority + specificity + Math.min(30, pathHits * 6)
      : -1;
  return { guide, score, titleHits, pathHits };
}

function scoreFallbackGuide(guide, title, pathContext) {
  const rule = FALLBACK_MATCH_RULES[guide.key];
  if (!rule) return { guide, score: -1, titleHits: 0, pathHits: 0 };
  const titleHits = countPatternHits(rule.pattern, title);
  const pathHits = countPatternHits(rule.pattern, pathContext);
  const specificity = Math.min(16, Math.round(rule.pattern.source.length / 28));
  const score = titleHits
    ? 900 + rule.priority + specificity + Math.min(45, titleHits * 8)
    : pathHits
      ? 260 + rule.priority + specificity + Math.min(24, pathHits * 5)
      : -1;
  return { guide, score, titleHits, pathHits };
}

function defaultGuideForPath(relativePath) {
  const top = relativePath.split("/")[0];
  if (top === "【求职就业专题】") return TOPIC_GUIDES.find((guide) => guide.key === "career") || null;
  if (top === "【学习路线】" || top === "【学习方法分享】") {
    return TOPIC_GUIDES.find((guide) => guide.key === "learning") || null;
  }
  if (top === "【数据分析与数据运营】") {
    return TOPIC_GUIDES.find((guide) => guide.key === "analytics") || null;
  }
  if (top === "【项目实战库】") {
    return FALLBACK_TOPIC_GUIDES.find((guide) => guide.key === "project-delivery") || null;
  }
  if (top === "【数据治理与数据管理】") {
    return FALLBACK_TOPIC_GUIDES.find((guide) => guide.key === "data-governance") || null;
  }
  if (top === "【数据开发与数据架构】") {
    return FALLBACK_TOPIC_GUIDES.find((guide) => guide.key === "data-development") || null;
  }
  if (top === "【AI 与大数据】") {
    return FALLBACK_TOPIC_GUIDES.find((guide) => guide.key === "ai-foundation") || null;
  }
  return null;
}

function matchTopicGuide(relativePath, title) {
  const clean = cleanTitle(title);
  const pathContext = relativePath
    .split("/")
    .slice(1, -1)
    .slice(-3)
    .join(" ");
  const candidates = [
    ...TOPIC_GUIDES.map((guide) => scoreTopicGuide(guide, clean, pathContext)),
    ...FALLBACK_TOPIC_GUIDES.map((guide) => scoreFallbackGuide(guide, clean, pathContext))
  ].filter((candidate) => candidate.score >= 0);
  candidates.sort((left, right) => (
    right.score - left.score ||
    right.titleHits - left.titleHits ||
    right.guide.key.localeCompare(left.guide.key)
  ));
  return candidates[0]?.guide || defaultGuideForPath(relativePath);
}

function inferKind(relativePath, title, context) {
  if (/简历模板|CV模板/i.test(relativePath) || /简历/.test(title)) return "resume";
  if (
    relativePath.startsWith("【求职就业专题】") ||
    /面试题|面试全攻略|薪资谈判|求职|招聘方视角|岗位解析|职业发展|作品集/.test(title)
  ) {
    return "career";
  }
  if (
    relativePath.startsWith("【学习路线】") ||
    relativePath.startsWith("【学习方法分享】") ||
    /学习路线|成长路线|升级路线|学习路径|行动计划|能力地图|快速入门|新手入门|成长指南|L[1-4]-/.test(title)
  ) {
    return "learning";
  }
  if (relativePath.startsWith("【项目实战库】") || /项目|实战案例|落地案例|建设案例|迁移项目/.test(title)) {
    return "project";
  }
  if (relativePath.startsWith("【数据治理与数据管理】") || /治理|数据标准|分类分级|质量|元数据|血缘|主数据|合规|安全|权限|审计|成熟度/.test(title)) {
    return "governance";
  }
  if (relativePath.startsWith("【AI 与大数据】") || /\bAI\b|人工智能|大模型|Agent|RAG|LLM|机器学习|深度学习|向量|Prompt|微调|MLOps|模型/.test(title)) {
    return "ai";
  }
  if (relativePath.startsWith("【数据开发与数据架构】") || /架构|数据开发|ETL|ELT|数据管道|实时|数据湖|数据仓库|调度|CDC|数据服务|性能优化|云原生/.test(title)) {
    return "engineering";
  }
  if (relativePath.startsWith("【各行业的基础知识】")) return "industry";
  if (relativePath.startsWith("【数据分析与数据运营】") || relativePath.startsWith("【各行业的基础知识】/11-互联网商业分析")) {
    return "analytics";
  }
  if (relativePath.startsWith("assets/")) return "learning";
  return context.key === "general" ? "analytics" : "industry";
}

function topicProfile(relativePath, title) {
  const context = inferContext(relativePath, title);
  const seed = hashNumber(`${relativePath}::${title}`);
  const specialty = matchTitleSpecialty(relativePath, title, context);
  const kind = specialty.kind;
  const section = relativePath.split("/").slice(1, -1).join(" / ");
  const guide = matchTopicGuide(relativePath, title);
  const focusLenses = guide
    ? guide.lenses
      .map((lens) => ({ lens, score: hashNumber(`${relativePath}:${lens[0]}`) }))
      .sort((left, right) => left.score - right.score)
      .map((entry) => entry.lens)
    : [];
  return {
    relativePath,
    title,
    topic: cleanTitle(title),
    context,
    specialty,
    kind,
    guide,
    focusLenses,
    section,
    seed,
    variant: seed % 6,
    idSuffix: seed.toString(36).slice(0, 8),
    isMetric: context.metricDefs?.some(([name]) => title.includes(name)) ||
      /率|数|额|成本|收入|利润|时长|周期|指数|价值|人数|数量|占比/.test(title),
    isSystem: /系统|平台|中台|数据仓库|数据湖|架构/.test(title),
    isRegulation: /法规|合规|安全|隐私|条例|政策|标准|规范|审计/.test(title),
    isCompany: /公司|集团|银行|保险|车企|美团|京东|淘宝|抖音|拼多多|比亚迪|特斯拉|蔚来|理想|小鹏|贝壳/.test(title)
  };
}

function sqlIdentifier(value, fallback = "topic") {
  const ascii = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return ascii || fallback;
}

function esc(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function formatNumber(value) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function chooseCases(profile, count = 3) {
  const contextBank = profile.context.cases || DOMAIN_LIBRARY["跨行业通用"].cases;
  const orderedContext = contextBank
    .map((item, index) => ({ item, score: hashNumber(`${profile.relativePath}:${index}`) }))
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.item);
  if (!profile.guide) {
    return orderedContext.slice(0, Math.min(count, orderedContext.length));
  }

  const guideCases = profile.guide.cases.map((_, index) => (
    profile.guide.cases[(profile.seed + index) % profile.guide.cases.length]
  ));
  const isIndustry = profile.relativePath.startsWith("【各行业的基础知识】/") &&
    Boolean(profile.context.domainName);
  const industryMix = profile.seed % 3 === 0
    ? [guideCases[0], orderedContext[0], guideCases[1]]
    : profile.seed % 3 === 1
      ? [orderedContext[0], guideCases[0], orderedContext[1]]
      : [guideCases[0], guideCases[1], orderedContext[0]];
  const combined = isIndustry ? industryMix : [...guideCases, ...orderedContext];
  const seen = new Set();
  return combined
    .filter(Boolean)
    .filter((item) => {
      const key = `${item.org}::${item.trigger}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, Math.min(count, combined.length));
}

function caseSection(profile, item, index) {
  if (profile.guide) {
    const lens = profile.focusLenses[index % profile.focusLenses.length] || profile.guide.lenses[0];
    const check = profile.guide.checks[(profile.seed + index) % profile.guide.checks.length];
    const titleLead = [
      "先把标题中的名词还原成一个可以观测的运行问题",
      "先确认业务对象和系统边界，再讨论工具或参数",
      "先把正常链路跑通，再人为制造一次失败和恢复"
    ][(profile.seed + index) % 3];
    return `### 案例 ${index + 1}：${item.org}的“${profile.topic}”现场

这是一个结合公开方法、常见工程故障和脱敏数据构造的复合案例，不对应任何单一企业事实。

- **标题落点**：${titleLead}。本例把“${profile.topic}”映射到“${profile.guide.label}”中的${lens[0]}，而不是泛泛讨论概念。
- **触发事件**：${item.trigger}。
- **业务与数据范围**：${item.data}。数据侧重点采集${lens[2]}，并与${profile.context.systems.slice(0, 3).join("、")}中的时间、状态和责任人信息对齐。
- **需要回答的问题**：${lens[1]}。
- **关键障碍**：${item.problem}。同时要防止${profile.context.risks[index % profile.context.risks.length]}把表面指标带偏。
- **处理过程**：${item.action}。实施时把“${check}”写成上线检查项，并为每一项保留日志、样本和负责人。
- **验证方式**：${item.outcome}。验收至少同时看主指标、${lens[2]}和一次故障回放，不能只截取优化后最快的一次结果。
- **可迁移结论**：遇到类似标题时，先按“${profile.guide.objective}”建立判断顺序，再决定是否调整代码、资源、口径或组织流程。`;
  }
  const emphasis = [
    "先冻结对象与时间窗",
    "先证明数据链路可信",
    "把数据和业务动作一起复盘"
  ][index % 3];
  return `### 案例 ${index + 1}：${item.org}的“${profile.topic}”问题

这是一个脱敏后的复合场景，不代表任何单一客户的事实数据。

- **触发事件**：${item.trigger}。本次讨论的重点是“${profile.topic}”，所以团队先要求把${emphasis}写进项目目标，而不是直接开始做报表。
- **数据范围**：${item.data}。同时收集${profile.context.systems.slice(0, 4).join("、")}中的状态、时间和负责人信息，避免分析只停留在结果表。
- **关键障碍**：${item.problem}。进一步检查后发现，如果不先处理${profile.context.risks[index % profile.context.risks.length]}，“${profile.topic}”很容易被一个表面相关指标替代。
- **处理过程**：${item.action}。团队把需求拆成对象、粒度、指标、质量、发布五个检查点，并为每个检查点指定原始证据。
- **结果与边界**：${item.outcome}。这组示例说明方法与行动之间的关系，真实项目仍应以本企业口径、样本和验收记录为准。
- **和本主题的联系**：在“${profile.topic}”上，最有价值的产出不是一张漂亮的总览图，而是能从异常分组下钻到事件明细，并明确下一步由谁在什么时间前处理。`;
}

function metricTable(profile) {
  const metrics = profile.context.metricDefs.slice(0, 4);
  const contextTable = [
    "| 指标 | 计算思路 | 主要维度 | 使用边界 |",
    "| --- | --- | --- | --- |",
    ...metrics.map(([name, formula, alias], index) => (
      `| ${esc(name)} | \`${esc(formula)}\`（视图字段 \`${alias}\`） | ${profile.context.dims.slice(index, index + 3).join("、")} | 不混用测试、撤销和跨期状态；与“${esc(profile.topic)}”相关时还要补充主题筛选 |`
    ))
  ];
  if (!profile.guide) return contextTable.join("\n");

  const guideTable = [
    "| 专题观测面 | 需要回答的问题 | 关键证据 | 判定与动作 |",
    "| --- | --- | --- | --- |",
    ...profile.focusLenses.slice(0, 4).map(([surface, question, signals, action], index) => (
      `| ${esc(surface)}${index === 0 ? "（本标题优先）" : ""} | ${esc(question)} | ${esc(signals)} | ${esc(action)} |`
    ))
  ];
  return `${guideTable.join("\n")}\n\n${contextTable.join("\n")}`;
}

function domainModel(profile) {
  const ctx = profile.context;
  const topicToken = sqlIdentifier(profile.topic, "subject");
  const rows = ctx.entities.map(([name, key], index) => (
    `| ${index === 0 ? "核心对象" : index < 3 ? "过程对象" : "结果对象"} | ${name} | \`${key}\` | ${ctx.stages[index % ctx.stages.length]} |`
  ));
  return [
    "| 角色 | 业务对象 | 主键示例 | 在流程中的位置 |",
    "| --- | --- | --- | --- |",
    ...rows,
    `| 专题分析 | ${esc(profile.topic)} | \`topic_key = '${esc(topicToken)}'\` | 用于把通用事件收窄到本主题 |`
  ].join("\n");
}

function standardSql(profile) {
  const ctx = profile.context;
  const metric = ctx.metricDefs[profile.seed % ctx.metricDefs.length];
  const dimension = ctx.dims[profile.seed % ctx.dims.length];
  const topic = esc(profile.topic);
  const startMonth = String(1 + (profile.seed % 6)).padStart(2, "0");
  const endMonth = String(Math.min(12, Number(startMonth) + 3)).padStart(2, "0");
  return `-- 主题：${topic}
-- 示例表名和字段名用于说明建模方法，落地时请映射到企业现有数仓。
WITH scoped AS (
  SELECT
    e.event_id,
    e.entity_id,
    e.${ctx.dateField} AS event_time,
    e.stage_code,
    e.${dimension === "渠道" || dimension === "来源渠道" ? "source_channel" : "dimension_value"} AS analysis_dim,
    e.status,
    COALESCE(e.metric_value, 0) AS metric_value,
    ROW_NUMBER() OVER (
      PARTITION BY e.event_id
      ORDER BY e.updated_at DESC
    ) AS version_no
  FROM ${ctx.factTable} e
  WHERE e.${ctx.dateField} >= DATE '2026-${startMonth}-01'
    AND e.${ctx.dateField} <  DATE '2026-${endMonth}-01'
    AND e.subject_name = '${topic}'
    AND e.is_deleted = 0
),
dedup AS (
  SELECT *
  FROM scoped
  WHERE version_no = 1
),
baseline AS (
  SELECT
    analysis_dim,
    COUNT(DISTINCT entity_id) AS entity_cnt,
    COUNT(DISTINCT event_id) AS event_cnt,
    AVG(metric_value) AS avg_metric,
    MIN(event_time) AS first_seen_at,
    MAX(event_time) AS last_seen_at
  FROM dedup
  WHERE status IN ('valid', 'completed')
  GROUP BY analysis_dim
)
SELECT
  analysis_dim AS ${dimension === "渠道" ? "channel" : "analysis_dimension"},
  entity_cnt,
  event_cnt,
  ROUND(avg_metric, 4) AS ${metric[2]},
  first_seen_at,
  last_seen_at,
  ROUND(event_cnt * 1.0 / NULLIF(SUM(event_cnt) OVER (), 0), 4) AS contribution_ratio
FROM baseline
ORDER BY event_cnt DESC;`;
}

function pythonQualityCode(profile) {
  const id = `rule_${profile.context.key}_${profile.idSuffix}`;
  const guideChecks = profile.guide?.checks.slice(0, 4) || [
    `检查${profile.context.controls[0]}`,
    `检查${profile.context.controls[1]}`,
    `检查${profile.context.controls[2]}`
  ];
  const entityKey = profile.context.entities[0][1];
  const timeField = profile.context.dateField;
  const duplicateLimit = Number((0.0004 + (profile.seed % 7) * 0.0001).toFixed(4));
  const nullLimit = Number((0.002 + (profile.seed % 5) * 0.001).toFixed(3));
  return `# ${profile.topic}：发布前的数据质量与分层检查
import pandas as pd
import numpy as np
import hashlib

TOPIC = "${profile.topic}"
TOPIC_KEY = "${sqlIdentifier(profile.topic, "subject")}"
RULE_ID = "${id}"
GUIDE_CHECKS = ${JSON.stringify(guideChecks, null, 4)}
RULES = {
    "required_columns": ["event_id", "${entityKey}", "${timeField}", "status"],
    "duplicate_key": "event_id",
    "entity_key": "${entityKey}",
    "time_field": "${timeField}",
    "max_duplicate_rate": ${duplicateLimit},
    "max_null_rate": ${nullLimit},
    "allowed_status": {"valid", "completed", "cancelled", "refunded"},
}

def validate(frame: pd.DataFrame) -> pd.DataFrame:
    missing = [c for c in RULES["required_columns"] if c not in frame.columns]
    if missing:
        raise ValueError(f"{TOPIC}/{TOPIC_KEY} missing required columns: {missing}")

    checks = []
    checks.append(("duplicate_rate", frame[RULES["duplicate_key"]].duplicated().mean(), RULES["max_duplicate_rate"]))
    checks.append(("entity_null_rate", frame[RULES["entity_key"]].isna().mean(), RULES["max_null_rate"]))
    event_time = pd.to_datetime(frame[RULES["time_field"]], errors="coerce")
    checks.append(("invalid_time_rate", event_time.isna().mean(), 0.0))
    bad_status = (~frame["status"].isin(RULES["allowed_status"])).mean()
    checks.append(("invalid_status_rate", bad_status, 0.0))

    result = pd.DataFrame(checks, columns=["check_name", "value", "threshold"])
    result["rule_id"] = RULE_ID + "." + result["check_name"]
    result["topic"] = TOPIC
    result["topic_key"] = TOPIC_KEY
    result["passed"] = result["value"].le(result["threshold"])
    result["sample_fingerprint"] = hashlib.sha1(
        f"{TOPIC}|{RULE_ID}|{len(frame)}".encode("utf-8")
    ).hexdigest()[:12]
    return result

def diagnose(frame: pd.DataFrame) -> pd.DataFrame:
    return (
        frame.assign(stat_date=pd.to_datetime(frame[RULES["time_field"]]).dt.date)
        .groupby(["stat_date", "status"], dropna=False)
        .agg(
            event_cnt=(RULES["duplicate_key"], "nunique"),
            entity_cnt=(RULES["entity_key"], "nunique"),
        )
        .reset_index()
        .assign(topic=TOPIC, topic_key=TOPIC_KEY, rule_id=RULE_ID)
        .sort_values("stat_date")
    )

def release_gate(result: pd.DataFrame) -> None:
    failed = result.loc[~result["passed"], ["topic_key", "check_name", "value", "threshold"]]
    if not failed.empty:
        raise RuntimeError({"topic": TOPIC, "failed_checks": failed.to_dict("records")})

# 主题专属门禁：${guideChecks.join("；")}
# 生产化时把结果写入质量平台，并携带批次、分区、代码版本、规则版本和处理工单。`;
}

function toolCode(profile) {
  const topicCode = buildTopicCode(profile);
  if (topicCode) return topicCode;
  const topic = profile.topic;
  if (/Kafka|消费积压|消息队列/i.test(topic)) {
    return `from kafka import KafkaConsumer
import json

consumer = KafkaConsumer(
    "topic_${profile.idSuffix}",
    bootstrap_servers=["broker-1:9092", "broker-2:9092"],
    group_id="quality-gate-v1",
    enable_auto_commit=False,
    value_deserializer=lambda value: json.loads(value.decode("utf-8")),
)

for message in consumer:
    record = message.value
    # ${topic}：先做结构校验，再进入实时计算，避免脏消息重复扩散。
    if not record.get("event_id") or record.get("schema_version") != "v2":
        raise ValueError(f"invalid event: {record}")
    consumer.commit()`;
  }
  if (/Spark|RDD|DataFrame|Shuffle|数据倾斜/i.test(topic)) {
    return `from pyspark.sql import SparkSession, functions as F

spark = SparkSession.builder.appName("${profile.idSuffix}-quality").getOrCreate()
source = spark.read.table("dwd_${profile.context.key}_event")

result = (
    source.where(F.col("subject_name") == "${topic}")
    .withColumn("event_date", F.to_date("event_time"))
    .groupBy("event_date", "stage_code")
    .agg(
        F.countDistinct("event_id").alias("event_cnt"),
        F.countDistinct("entity_id").alias("entity_cnt"),
        F.avg("metric_value").alias("avg_metric"),
    )
    .orderBy("event_date", "stage_code")
)

result.explain("formatted")
result.write.mode("overwrite").parquet("/tmp/${profile.idSuffix}/result")`;
  }
  if (/Flink|实时|流处理/i.test(topic)) {
    return `from pyflink.table import EnvironmentSettings, TableEnvironment

settings = EnvironmentSettings.in_streaming_mode()
t_env = TableEnvironment.create(settings)
t_env.execute_sql("""
CREATE TABLE source_events (
  event_id STRING,
  entity_id STRING,
  subject_name STRING,
  event_time TIMESTAMP(3),
  metric_value DOUBLE,
  WATERMARK FOR event_time AS event_time - INTERVAL '10' SECOND
) WITH (
  'connector' = 'kafka',
  'topic' = '${profile.idSuffix}-events',
  'properties.bootstrap.servers' = 'broker:9092',
  'format' = 'json'
)
""")
t_env.execute_sql("""
SELECT subject_name, COUNT(DISTINCT event_id) AS event_cnt, AVG(metric_value) AS avg_metric
FROM source_events
WHERE subject_name = '${topic}'
GROUP BY subject_name, TUMBLE(event_time, INTERVAL '1' MINUTE)
""").print()`;
  }
  if (/RAG|知识库|检索增强/i.test(topic)) {
    return `from dataclasses import dataclass
from typing import Iterable

@dataclass
class Chunk:
    chunk_id: str
    document_id: str
    version: str
    text: str
    score: float

def evaluate_retrieval(query: str, expected_doc: str, chunks: Iterable[Chunk]) -> dict:
    ranked = sorted(chunks, key=lambda item: item.score, reverse=True)
    hit_at_3 = any(item.document_id == expected_doc for item in ranked[:3])
    hit_at_5 = any(item.document_id == expected_doc for item in ranked[:5])
    duplicate_ratio = 1 - len({item.document_id for item in ranked[:5]}) / max(len(ranked[:5]), 1)
    return {
        "topic": "${topic}",
        "query": query,
        "hit_at_3": hit_at_3,
        "hit_at_5": hit_at_5,
        "duplicate_ratio": round(duplicate_ratio, 4),
    }`;
  }
  if (/Agent|智能体|多Agent/i.test(topic)) {
    return `from dataclasses import dataclass
from typing import Callable

@dataclass
class ToolCall:
    name: str
    arguments: dict

def run_agent(question: str, planner: Callable, tools: dict, max_steps: int = 6) -> dict:
    trace = []
    state = {"question": question, "observations": []}
    for step in range(max_steps):
        action = planner(state)
        if action["type"] == "finish":
            return {"answer": action["answer"], "trace": trace, "steps": step}
        tool_name = action["tool"]
        if tool_name not in tools:
            raise PermissionError(f"tool not allowed: {tool_name}")
        output = tools[tool_name](**action["arguments"])
        trace.append({"tool": tool_name, "arguments": action["arguments"], "output": output})
        state["observations"].append(output)
    raise RuntimeError("${topic}: exceeded max_steps without a safe finish")`;
  }
  if (/Airflow|DolphinScheduler|调度|依赖/i.test(topic)) {
    return `from datetime import datetime
from airflow import DAG
from airflow.decorators import task

with DAG(
    dag_id="${profile.context.key}_${profile.idSuffix}_quality",
    start_date=datetime(2026, 1, 1),
    schedule="0 2 * * *",
    catchup=False,
    max_active_runs=1,
) as dag:
    @task
    def extract():
        return {"subject": "${topic}", "partition": "{{ ds }}"}

    @task
    def validate(payload: dict):
        assert payload["subject"]
        assert payload["partition"]
        return payload

    @task
    def publish(payload: dict):
        print(f"publish ${profile.idSuffix}: {payload}")

    publish(validate(extract()))`;
  }
  if (/SQL|窗口函数|查询|指标|口径/i.test(topic)) {
    return standardSql(profile);
  }
  if (/Python|机器|模型|预测|推荐|实验|统计/i.test(topic)) {
    return `import pandas as pd
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_error

def time_aware_validation(frame: pd.DataFrame, feature_cols: list[str], target: str):
    frame = frame.sort_values("event_date").reset_index(drop=True)
    scores = []
    splitter = TimeSeriesSplit(n_splits=5)
    for train_idx, test_idx in splitter.split(frame):
        train, test = frame.iloc[train_idx], frame.iloc[test_idx]
        baseline = train[target].tail(28).mean()
        prediction = [baseline] * len(test)
        scores.append(mean_absolute_error(test[target], prediction))
    return {
        "topic": "${topic}",
        "folds": len(scores),
        "mean_mae": round(sum(scores) / len(scores), 4),
        "validation": "time_series_split",
    }`;
  }
  return standardSql(profile);
}

function operatingSteps(profile) {
  const ctx = profile.context;
  const guideSteps = profile.guide
    ? [
      `先写清“${profile.topic}”的目标：${profile.guide.objective}`,
      ...profile.guide.checks.map((check) => `专题检查：${check}`)
    ]
    : [];
  return [
    ...guideSteps,
    `明确“${profile.topic}”服务的使用者、决策动作和不做范围，并把成功标准写成可观察指标。`,
    `为${ctx.entities.slice(0, 3).map(([name]) => name).join("、")}分别确认主键、时间和状态，画出从源系统到结果的链路。`,
    `先做字段血缘和质量画像，检查${ctx.controls.slice(0, 3).join("、")}。`,
    `用同周期基线和至少两个维度拆解问题，避免只比较一个异常周。`,
    `抽取正常、异常和边界样本回查原始业务单据，记录抽样方法与结论。`,
    `选择一种代码实现并保留参数、版本、执行日志和结果快照，确保别人可以复跑。`,
    `上线前定义告警阈值、回滚条件和责任人；上线后按周观察主指标与护栏指标。`,
    `复盘时区分数据问题、业务变化、方案偏差和外部因素，并把改进项转成有时限的任务。`
  ];
}

function fencedToolCode(profile) {
  const code = toolCode(profile).trim();
  const language = /^(--|WITH\b|SELECT\b|EXPLAIN\b)/i.test(code) ? "sql" : "python";
  return `\`\`\`${language}\n${code}\n\`\`\``;
}

function codeLanguage(code) {
  return /^(--|\/\*|WITH\b|SELECT\b|EXPLAIN\b|CREATE\b|INSERT\b|MERGE\b)/i.test(code.trim())
    ? "sql"
    : "python";
}

function articleCodeSection(profile, heading, overrideCode = null) {
  const code = String(overrideCode || toolCode(profile)).trim();
  const language = codeLanguage(code);
  return `### ${heading}

\`\`\`${language}
${code}
\`\`\``;
}

function diagnosticSql(profile) {
  const ctx = profile.context;
  const metric = ctx.metricDefs[(profile.seed + 2) % ctx.metricDefs.length];
  const primaryDimension = ctx.dims[profile.seed % ctx.dims.length];
  const secondaryDimension = ctx.dims[(profile.seed + 2) % ctx.dims.length];
  const topicToken = sqlIdentifier(profile.topic, "subject");
  const startMonth = 1 + profile.seed % 8;
  const endMonth = Math.min(12, startMonth + 3);
  const method = [
    "结构贡献",
    "同期基线",
    "分位对比",
    "留存同期群"
  ][profile.seed % 4];
  return `-- ${profile.topic}：${method}诊断（${primaryDimension} × ${secondaryDimension}）
WITH scoped AS (
  SELECT
    ${ctx.entities[0][1]} AS entity_key,
    event_id,
    ${ctx.dateField} AS event_date,
    dimension_value AS primary_dim,
    stage_code AS secondary_dim,
    metric_value,
    status
  FROM ${ctx.factTable}
  WHERE ${ctx.dateField} >= DATE '2026-${String(startMonth).padStart(2, "0")}-01'
    AND ${ctx.dateField} <  DATE '2026-${String(endMonth).padStart(2, "0")}-01'
    AND subject_key = '${topicToken}'
    AND is_deleted = 0
),
dedup AS (
  SELECT *
  FROM (
    SELECT
      scoped.*,
      ROW_NUMBER() OVER (
        PARTITION BY event_id
        ORDER BY event_date DESC
      ) AS version_no
    FROM scoped
  ) ranked
  WHERE version_no = 1
),
grouped AS (
  SELECT
    primary_dim,
    secondary_dim,
    COUNT(DISTINCT entity_key) AS entity_cnt,
    COUNT(DISTINCT event_id) AS event_cnt,
    SUM(metric_value) AS metric_sum,
    AVG(metric_value) AS metric_avg
  FROM dedup
  WHERE status IN ('valid', 'completed')
  GROUP BY primary_dim, secondary_dim
),
contribution AS (
  SELECT
    *,
    metric_sum * 1.0 / NULLIF(SUM(metric_sum) OVER (PARTITION BY secondary_dim), 0) AS contribution_ratio,
    metric_avg - AVG(metric_avg) OVER (PARTITION BY secondary_dim) AS delta_to_peer
  FROM grouped
)
SELECT
  '${metric[0]}' AS checked_metric,
  primary_dim,
  secondary_dim,
  entity_cnt,
  event_cnt,
  ROUND(metric_sum, 4) AS metric_sum,
  ROUND(contribution_ratio, 4) AS contribution_ratio,
  ROUND(delta_to_peer, 4) AS delta_to_peer
FROM contribution
ORDER BY ABS(delta_to_peer) DESC, entity_cnt DESC;`;
}

function metricDiagnosisTree(profile) {
  const ctx = profile.context;
  const primary = ctx.metricDefs[profile.seed % ctx.metricDefs.length];
  const secondary = ctx.metricDefs[(profile.seed + 1) % ctx.metricDefs.length];
  const dimensions = ctx.dims.slice(0, 4);
  const guideSurface = profile.focusLenses[0]?.[0] || profile.guide?.label || "核心链路";
  const trees = [
    `${profile.topic}｜${primary[0]}结果偏离
├── 先验真伪：${ctx.controls[0]}是否有批次级证据
├── 再看规模：${ctx.entities[0][0]}数量与${secondary[0]}是否同向变化
├── 结构定位：${dimensions[0] || "业务维度"} → ${dimensions[1] || "时间"} → ${dimensions[2] || "状态"}
├── 链路时点：${ctx.systems.slice(0, 3).join(" → ")}
└── 行动出口：${profile.guide?.checks[0] || `由${ctx.participants[0]}确认口径并安排回查`}`,
    `${profile.topic}｜${guideSurface}排查顺序
├── L1 口径：${primary[0]}的分子、分母、时间和排除项
├── L2 对象：${ctx.entities.slice(0, 3).map(([name]) => name).join("、")}是否一一对应
├── L3 过程：${ctx.stages.slice(0, 4).join(" → ")}
├── L4 数据：${ctx.controls.slice(0, 3).join("；")}
└── L5 决策：谁在多长时间内对哪个分组采取什么动作`,
    `${profile.topic}｜从总量到单条证据
├── ① 同期基线：先排除节假日、活动和口径切换
├── ② 结构贡献：按${dimensions.slice(0, 3).join("、") || "业务维度"}比较增量和抵消
├── ③ 状态漏斗：${ctx.stages.slice(1, 5).join(" → ")}
├── ④ 记录回查：正常、边界、异常各抽 N 条
└── ⑤ 闭环验证：${secondary[0]}与护栏指标同时恢复才算解决`,
    `${profile.topic}｜专题诊断画布
├── 业务问题：${profile.guide?.objective || `围绕${ctx.scene}定位一个可干预节点`}
├── 观测对象：${ctx.entities[0][0]} / ${ctx.entities[1]?.[0] || ctx.entities[0][0]}
├── 主指标：${primary[0]}；辅助指标：${secondary[0]}
├── 风险边界：${ctx.risks.slice(0, 3).join("；")}
└── 验收证据：SQL 结果 + 明细样本 + 责任人 + 观察窗口`
  ];
  return trees[profile.seed % trees.length];
}

function qualityTable(profile) {
  const ctx = profile.context;
  if (profile.guide) {
    return [
      "| 专题检查项 | 失败时会看到什么 | 首选证据 | 处理动作 |",
      "| --- | --- | --- | --- |",
      ...profile.guide.checks.map((check, index) => {
        const lens = profile.focusLenses[index % profile.focusLenses.length];
        return `| ${esc(check)} | ${esc(lens[1])} | ${esc(lens[2])} | ${esc(lens[3])} |`;
      })
    ].join("\n");
  }
  const rows = ctx.controls.slice(0, 5).map((control, index) => {
    const methods = [
      "唯一性 SQL + 抽样明细",
      "时间区间与状态机校验",
      "主数据有效期关联",
      "金额或数量平衡校验",
      "发布前阻断 + 责任人复核"
    ];
    return `| ${esc(control)} | ${methods[index % methods.length]} | ${index < 2 ? "阻断发布" : "告警并登记工单"} | ${ctx.participants[index % ctx.participants.length]} |`;
  });
  return [
    "| 检查项 | 推荐方法 | 失败动作 | 负责人 |",
    "| --- | --- | --- | --- |",
    ...rows
  ].join("\n");
}

function referenceSection(profile) {
  const guideSources = profile.guide?.sources || [];
  return [
    `## 附录：公开资料与方法依据`,
    "",
    `本文围绕“${profile.topic}”采用公开的业务分析、数据建模和工程实践方法进行原创整理，不复制任何付费文章的隐藏正文。正文中的组织、数字与结果均为脱敏或复合示例，方法仍需结合企业版本、数据边界和验收标准复核。`,
    "",
    ...(guideSources.length
      ? [
        "**本专题优先查阅的公开资料：**",
        "",
        ...guideSources.map(([name, url]) => `- [${name}](${url})`)
      ]
      : []),
    "",
    "**通用方法资料：**",
    "",
    ...profile.context.regulations.map((item) => `- ${item}。阅读时重点记录适用条件、定义边界和更新日期，不要只摘抄结论。`),
    `- 与本主题相关的产品官方文档、行业标准和公开技术博客。涉及具体工具时，应优先核对版本说明、配置默认值、兼容范围和已知限制。`,
    "",
    `> [!warning] 使用边界`,
    `> 文中的组织、规模和结果均为脱敏或复合示例，用于说明方法。正式项目必须使用获授权的数据，并由业务、数据、安全、合规和运维负责人确认口径、权限、上线与回滚方案。`
  ].join("\n");
}

function industryArticle(profile) {
  const ctx = profile.context;
  const cases = chooseCases(profile, 3);
  const remaining = (ctx.cases || []).filter((item) => !cases.includes(item)).slice(0, 2);
  const metric = ctx.metricDefs[profile.seed % ctx.metricDefs.length];
  return `# ${profile.title}

> [!abstract] 场景速览
> ${pick(VARIANT_OPENERS, profile.seed)(profile)}

## 1. “${profile.topic}”在${ctx.label}业务链中的位置

${ctx.label}的核心流程可以概括为：${ctx.stages.join(" → ")}。参与角色包括${ctx.participants.join("、")}。“${profile.topic}”通常不是一个孤立字段，而是连接业务动作、数据记录和管理决策的一层能力。

从数据团队视角，至少要回答四个问题：

1. **谁使用**：${ctx.participants.slice(0, 4).join("、")}分别要用它做判断、执行还是审计。
2. **对象是什么**：一行数据代表${ctx.entities[0][0]}、一次事件、一个批次还是一天快照。
3. **流程在哪里变化**：通过${ctx.stages.slice(1, 5).join("、")}之间的状态和时间差定位问题。
4. **结果如何被采用**：谁在什么时间前采取行动，使用哪个指标观察改善或副作用。

一个合格的专题目标可以写成：

> 在【时间窗】和【授权数据范围】内，围绕“${profile.topic}”，按【${ctx.dims.slice(0, 3).join("、")}】比较【${metric[0]}】与【${ctx.metricDefs[(profile.seed + 1) % ctx.metricDefs.length][0]}】，定位一个可干预流程节点，并记录行动后的变化与边界。

## 2. 一张图看清角色、流程和数据

${domainModel(profile)}

建模时不要先把所有系统字段堆进一张大表。更稳妥的做法是分别保留三类事实：

- **事件事实**：谁在什么时间做了动作，例如挂号、下单、开工、报警或学习。
- **状态快照**：对象在某一天的状态，例如会员等级、租约、账户余额或设备资产关系。
- **结果事实**：流程完成后的产出，例如结算金额、良品数量、签收结果或考试分数。

三者的粒度不同。把事件、快照和结果强行放在同一行，会让金额、数量和转化率在汇总时重复。若“${profile.topic}”涉及状态变化，优先建立状态机；若涉及金额，先做借贷或收付平衡；若涉及对象归属，保留维度有效期。

## 3. 指标与口径：不要把相关数字直接当答案

${metricTable(profile)}

指标字典至少应包含：中文名、英文编码、业务定义、计算公式、事实粒度、时间字段、对象范围、排除条件、负责人和验收样例。对于“${profile.topic}”，还应注明它使用的是业务发生时间还是入仓时间，是否包含撤销、退费、测试、跨期和补录记录。

一个常见误区是看到${metric[0]}变化就立即解释业务原因。更可靠的顺序是：

1. 检查数据覆盖和延迟是否变化。
2. 检查对象范围、状态映射和维度归属是否变化。
3. 按时间、结构和分组拆解贡献。
4. 回到明细寻找能解释变化的事件。
5. 如果已经采取行动，再评估行动带来的增量，而不是事后挑一个相关指标。

## 4. 工作案例：从现象到数据处理

${caseSection(profile, cases[0], 0)}

这个案例最关键的动作不是“跑一条 SQL”，而是把“${profile.topic}”对应的业务对象和上下游系统放在同一张链路图上。链路图至少要标出源系统、事件时间、关联主键、状态变化、数据负责人和消费方。

## 5. SQL 示例：在统一口径下做分层诊断

下面的查询用于展示分析结构，表名和字段需映射到实际环境。重点是去重、范围筛选、基线比较和贡献率，而不是代码本身。

${articleCodeSection(profile, "标题专属诊断 SQL", diagnosticSql(profile))}

执行后要回答四类验证题：

- 结果总量能否与源系统或既有报表在相同口径下解释差异？
- 排名前几位的分组是否由少数超长、重复或补录记录造成？
- 缺失日期表现为“未发生”还是“未采集”，是否改变分母？
- 维度使用的是当时归属还是当前归属，跨期比较是否一致？

## 6. 第二个案例：跨系统、跨部门时怎样不失控

${caseSection(profile, cases[1], 1)}

跨部门项目最容易在三个地方返工：业务术语没有冻结、主数据映射没有版本、验收时才发现权限不足。建议在开发前让业务负责人签字确认指标定义，让数据负责人确认粒度与主键，让安全负责人确认字段范围，让运维负责人确认发布与回滚窗口。

## 7. Python 示例：把数据质量变成发布门禁

${articleCodeSection(profile, "可执行质量门禁", pythonQualityCode(profile))}

这段代码适合放在离线任务完成之后、指标发布之前。真实环境还应从调度平台读取分区参数、把结果写入质量平台，并在关键规则失败时阻断下游。告警不是终点，工单中要记录影响资产、发现时间、临时处理、根因、修复时间和防复发动作。

## 8. 异常排查：从指标异常回到业务事件

${qualityTable(profile)}

围绕“${profile.topic}”排查时，可以按以下顺序进行：

1. **影响面**：哪些指标、报表、接口或业务团队受影响，是否需要暂停对外发布。
2. **时间线**：源系统变更、任务发布、数据回刷、组织调整和业务活动分别发生在什么时候。
3. **数据链路**：上游是否延迟，分区是否缺失，主键是否重复，状态是否映射错误。
4. **业务证据**：抽取异常记录，与原始单据、操作日志、客服记录或现场系统核对。
5. **修复与复核**：明确补数范围、重跑粒度、回滚版本和验收样例。
6. **防复发**：把一次性排查升级为规则、监控、责任人和变更评审。

特别要注意：${ctx.risks.slice(0, 4).join("；")}。这些问题如果不被单独标记，很容易被误写成业务趋势。

## 9. 第三个案例与延伸场景

${caseSection(profile, cases[2], 2)}

${remaining.length ? `另外两个适合继续拆分的工作场景是：

${remaining.map((item) => `- **${item.org}**：${item.trigger}。可以先从${item.data}建立最小数据闭环，再围绕“${profile.topic}”检查${item.problem}。`).join("\n")}` : ""}

如果要把本专题扩展成一个完整作品或项目，建议至少保留以下材料：

- 一页业务流程图，标注角色、系统、事件和异常分支。
- 一份指标字典，记录定义、粒度、边界和负责人。
- 一张事实与维度关系图，说明主键、时间和历史归属。
- 一套 SQL 或 Python 代码，包含参数、质量检查和执行说明。
- 三组验证样例：正常对象、边界对象和异常对象。
- 一份上线后复盘，记录行动、结果、副作用和下一步。

## 10. 落地计划、验收与自测

| 阶段 | 主要任务 | 交付物 | 验收标准 |
| --- | --- | --- | --- |
| 第 1 周 | 访谈、流程梳理、指标冻结 | 需求说明、流程图、指标草案 | 业务和数据负责人确认对象与边界 |
| 第 2 周 | 数据探查、模型设计 | 表关系、质量画像、接口清单 | 关键主键和时间字段可解释 |
| 第 3 周 | 开发与验证 | SQL/Python、质量规则、样例 | 正常和异常样本均能追溯 |
| 第 4 周 | 灰度与监控 | 看板或服务、告警、回滚方案 | 指标与源系统可核对，异常可阻断 |
| 第 5-6 周 | 业务试用与复盘 | 使用记录、问题清单、改进计划 | 有明确行动、负责人和观察周期 |

${operatingSteps(profile).map((item, index) => `${index + 1}. ${item}`).join("\n")}

> [!check] 自测
> 请用三句话说明：①“${profile.topic}”的一行数据代表什么；②${ctx.controls.slice(0, 3).join("、")}分别在防什么问题；③如果 ${metric[0]} 下降 20%，你会先核查哪三类证据，如何避免把数据问题解释成业务问题？

${referenceSection(profile)}
`;
}

function analyticsArticle(profile) {
  const ctx = profile.context;
  const cases = chooseCases(profile, 3);
  const primary = ctx.metricDefs[profile.seed % ctx.metricDefs.length];
  const secondary = ctx.metricDefs[(profile.seed + 1) % ctx.metricDefs.length];
  return `# ${profile.title}

> [!tip] 分析目标
> ${pick(VARIANT_OPENERS, profile.seed)(profile)}

## 1. 把主题翻译成可验证的问题

“${profile.topic}”不能直接等同于“做一张趋势图”。一个可执行的分析问题至少包含对象、时间、比较基准和行动：

> 在【观察周期】内，对【有效对象】按【${ctx.dims.slice(0, 3).join("、")}】比较【${primary[0]}】与【${secondary[0]}】，判断变化来自结构、行为还是数据口径，并验证【策略动作】是否带来可解释的增量。

在${ctx.label}场景中，用户行为、交易结果和策略曝光经常来自不同系统。先画数据流：

${ctx.systems.slice(0, 6).join(" → ")}

图中至少要有三个标记：业务事件发生时间、数据可见时间、策略或行动时间。只有三者分开，后续才能判断问题发生在业务、链路还是观察窗口。

## 2. 指标定义与分母检查

${metricTable(profile)}

针对“${profile.topic}”，建议分别定义诊断指标、结果指标和护栏指标：

- **诊断指标**用于定位流程，例如曝光、有效访问、符合条件对象数和异常节点。
- **结果指标**用于判断是否改善，例如转化、留存、客单、毛利或处理时长。
- **护栏指标**用于防止局部优化伤害整体，例如退款、投诉、成本、公平性和长期留存。

每次计算都问四个问题：分母是谁、对象何时进入分母、例外状态怎么处理、窗口是否足够覆盖行为完成。尤其是${ctx.risks.slice(0, 3).join("；")}，任何一项没有解释清楚，指标都可能“看起来合理但无法决策”。

## 3. 方法选择：描述、诊断、预测还是因果

| 目标 | 适合的方法 | 需要的证据 | 不要混淆 |
| --- | --- | --- | --- |
| 描述现状 | 趋势、结构、同期群 | 完整口径、稳定时间窗 | 描述不等于原因 |
| 定位异常 | 分层、贡献度、漏斗、异常检测 | 原始事件、基线和质量检查 | 排名靠前不等于因果 |
| 预测未来 | 时间序列、回归、机器学习 | 时间切分验证、误差成本 | 离线准确率不等于业务收益 |
| 评估策略 | A/B、灰度、准实验 | 对照组、样本量、护栏指标 | 上线前后对比容易混入季节和选择偏差 |

如果问题只是“发生了什么”，先别急着建模；如果问题涉及“采取某策略会怎样”，就必须讨论反事实和识别条件。围绕“${profile.topic}”，应把观察分析、预测和因果评估的产出分开标注。

## 4. 案例一：${cases[0].org}

${caseSection(profile, cases[0], 0)}

落地时建议先把一个总指标拆成可行动的树：

\`\`\`text
${metricDiagnosisTree(profile)}
\`\`\`

如果某一分支变化最大，再进入下一层，而不是一开始就按十几个维度切碎。每个分层结果都应同时报告样本量，避免小样本的极端比例抢走注意力。

## 5. SQL：计算趋势、结构和贡献度

${articleCodeSection(profile, "趋势、结构与贡献度诊断", diagnosticSql(profile))}

示例 SQL 只表达计算逻辑。实际实施应加入分区条件、业务状态过滤、时区和主题范围，并在结果中保留口径版本。

## 6. 案例二：${cases[1].org}

${caseSection(profile, cases[1], 1)}

当业务方要求“解释为什么下降”时，可以按下面顺序回答：

1. 先确认下降是否真实存在，排查采集、任务、维表和状态映射。
2. 把变化拆成对象数量、行为强度和结构占比。
3. 找到贡献最大的分组，但保留其他分组的抵消效应。
4. 抽取正负样本回查业务事件和操作日志。
5. 把尚不能证明的解释标为假设，并设计下一轮验证。

## 7. 代码验证：专题指标、实验或模型

${articleCodeSection(profile, "专题验证代码")}

${articleCodeSection(profile, "标题专属结构诊断 SQL", diagnosticSql(profile))}

若涉及 A/B 实验，建议同时输出：样本比例偏差、主指标、护栏指标、置信区间、最小可检测效应和停止规则。实验显著不代表可以无限扩大，还要看长期留存、退款、投诉和成本。若采用准实验，必须说明分组机制和可能的混淆变量。

## 8. 异常、偏差与常见误区

- **辛普森悖论**：总体改善但每个分组都变差，可能由对象结构变化造成。
- **幸存者偏差**：只分析完成流程的对象，忽略中途流失和中止。
- **分母漂移**：渠道口径、登录状态、版本或活动范围变化，改变可比性。
- **回传延迟**：当天数据未回补，导致近期效果被系统性低估。
- **多重比较**：反复寻找显著分组，实际只是随机波动。
- **行动偏差**：只报告支持既定方案的结果，忽略反例和护栏指标。

围绕“${profile.topic}”，应预先写出至少三条反例检查。比如${REVIEW_LENSES[profile.seed % REVIEW_LENSES.length]}、${REVIEW_LENSES[(profile.seed + 1) % REVIEW_LENSES.length]}，以及 ${REVIEW_LENSES[(profile.seed + 2) % REVIEW_LENSES.length]}。

## 9. 第三个案例：${cases[2].org}

${caseSection(profile, cases[2], 2)}

## 10. 交付物与工作节奏

| 交付物 | 应包含 | 质量要求 |
| --- | --- | --- |
| 问题说明 | 背景、对象、时间、成功标准 | 一句话能说明要改变什么 |
| 指标字典 | 公式、粒度、排除项、负责人 | 换人计算能得到同一结果 |
| 分析代码 | SQL/Python、参数、日志 | 可复跑，不依赖手工改数 |
| 验证记录 | 抽样、对账、边界样本 | 结论能回到原始事件 |
| 决策材料 | 结论、证据、限制、行动 | 区分事实、解释和建议 |
| 复盘记录 | 结果、副作用、下一步 | 有观察周期和停止条件 |

${operatingSteps(profile).map((item, index) => `${index + 1}. ${item}`).join("\n")}

> [!check] 自测
> 选择一个你能访问的脱敏数据集，围绕“${profile.topic}”完成：①定义一行数据；②计算两个核心指标；③做两个维度的结构拆分；④写出三条可能推翻结论的反例；⑤给出一个有负责人和观察周期的行动建议。

${referenceSection(profile)}
`;
}

function governanceArticle(profile) {
  const ctx = profile.context;
  const cases = chooseCases(profile, 3);
  return `# ${profile.title}

> [!warning] 核心判断
> ${pick(VARIANT_OPENERS, profile.seed)(profile)}

## 1. 先判断应治理什么风险

“${profile.topic}”通常不是买一个平台就能解决的问题。它至少涉及制度、标准、责任、流程、技术和审计六层。开始前先把风险写成可观察事实：

| 风险问题 | 观察信号 | 可能影响 | 首先核查 |
| --- | --- | --- | --- |
| 定义不一致 | 同名指标多个 SQL、多个业务解释 | 决策冲突、返工 | 指标字典与负责人 |
| 数据不完整 | 分区缺失、关键字段空值 | 报表失真、流程中断 | 采集与任务日志 |
| 责任不清 | 问题工单长期无人认领 | 修复延迟、同类复发 | 资产责任矩阵 |
| 访问过宽 | 长期权限、共享账号、无审计 | 泄漏与合规风险 | 权限清单与访问日志 |
| 变更不可见 | 表结构或逻辑变更无通知 | 下游批量故障 | 血缘与发布记录 |

${ctx.risks.map((risk, index) => `${index + 1}. **${risk}**：需要在标准、系统或组织流程中设置对应控制。`).join("\n")}

## 2. 用 DAMA 思路拆成可执行组件

${metricsGovernanceTable(profile)}

治理不是把所有数据都按同一优先级管理。建议依据使用范围、监管要求、决策影响和故障历史划分关键资产，再决定投入。关键资产应有唯一负责人、明确消费者、质量目标、访问策略和变更通知。

## 3. 资产、标准与责任矩阵

${domainModel(profile)}

一个可执行的数据标准至少包括：

- **业务定义**：业务人员如何理解和适用。
- **技术定义**：字段类型、长度、格式、枚举和空值语义。
- **计算口径**：时间、粒度、分子分母和排除项。
- **权威来源**：哪个系统是事实源，冲突时以谁为准。
- **生命周期**：创建、变更、废弃和归档规则。
- **责任人**：业务负责人、数据负责人、技术负责人和审批人。

资产责任可以使用 RACI：业务负责人对定义负责，数据负责人对实现与质量负责，平台团队对工具和权限负责，安全合规对访问与审计负责，消费者对使用边界负责。只有“责任人”一个字段，没有决策权和时限，问题仍会回到治理团队自己处理。

## 4. 案例一：${cases[0].org}

${caseSection(profile, cases[0], 0)}

治理项目应先做小范围闭环，不要一开始铺满全公司。选择一个高影响业务域，完成从资产盘点、标准确认、质量规则、问题整改到复盘的完整链路，再复制机制。

## 5. 规则与代码：让控制可执行

${articleCodeSection(profile, "发布前规则门禁", pythonQualityCode(profile))}

${profile.guide ? `${articleCodeSection(profile, "专题专属验证代码")}\n` : ""}

${articleCodeSection(profile, "治理对象与风险分层 SQL", diagnosticSql(profile))}

规则设计要同时考虑三件事：能否自动执行、误报成本是否可接受、失败后谁来处理。只写“不能为空”不够，必须明确哪类对象允许为空、谁能在何种情况下豁免、豁免多久、是否需要审批和复核。

建议把规则分成四级：

1. **阻断**：涉及监管、资金、身份或核心发布，失败即停止。
2. **严重告警**：影响大但可先隔离，要求在约定时间内响应。
3. **观察告警**：可能是正常业务变化，先记录趋势。
4. **探索检查**：尚未形成稳定阈值，仅用于发现异常模式。

## 6. 案例二：${cases[1].org}

${caseSection(profile, cases[1], 1)}

治理指标不要只统计“生成了多少文档、接入了多少资产”。更值得观察的是规则覆盖的关键资产、问题发现前移比例、问题复发率、变更影响分析耗时和业务是否愿意使用。

## 7. 权限、安全与审计

围绕“${profile.topic}”，权限治理至少应回答：

- 谁能申请、谁审批、审批依据是什么？
- 权限是否按角色、数据级别和用途最小化？
- 临时权限何时收回，离职和转岗是否自动处理？
- 查询、下载和导出是否留痕，异常访问如何发现？
- 脱敏、加密、水印和审计日志是否与数据类型匹配？

敏感字段不应通过“复制一份测试数据”绕过问题。更合适的做法是分级脱敏、合成数据或受控计算环境。所有示例和代码都不应包含真实身份、账号、密钥、客户名单或未公开经营数据。

## 8. 第三个案例：${cases[2].org}

${caseSection(profile, cases[2], 2)}

## 9. 90 天落地路线

| 时间 | 重点 | 输出 | 验收 |
| --- | --- | --- | --- |
| 第 1-2 周 | 访谈、资产盘点、风险分级 | 关键资产清单、问题基线 | 每个资产有负责人 |
| 第 3-4 周 | 标准与指标口径 | 标准草案、指标字典 | 业务和技术共同确认 |
| 第 5-7 周 | 规则、权限和血缘接入 | 自动规则、访问矩阵、影响分析 | 关键故障能被提前发现 |
| 第 8-10 周 | 问题闭环与试点 | 工单流程、复盘记录 | 问题有分级、时限与复核 |
| 第 11-12 周 | 复制与成熟度评估 | 推广清单、下一阶段路线 | 用数据证明有效而非只报接入量 |

${operatingSteps(profile).map((item, index) => `${index + 1}. ${item}`).join("\n")}

## 10. 检查清单与自测

- 关键资产是否有唯一责任人和消费者清单？
- 核心指标是否有版本、公式、排除项和变更历史？
- 质量规则是否与严重等级、工单、时限和复核绑定？
- 关键表变更是否能自动分析下游影响？
- 权限是否按用途审批并可回收？
- 审计日志是否足以还原谁在何时访问了什么？
- 治理收益是否用减少的返工、故障、风险和耗时分母来衡量？

> [!check] 自测
> 为“${profile.topic}”选择一个真实业务域，画出一张从资产、标准、规则、问题到复盘的控制图，并回答：谁定义、谁开发、谁审批、谁消费、谁在异常时做决定。

${referenceSection(profile)}
`;
}

function metricsGovernanceTable(profile) {
  const ctx = profile.context;
  const components = [
    ["数据标准", "字段、代码、指标和业务术语", "标准登记、评审、版本与废弃"],
    ["元数据", "表、字段、任务、接口、负责人", "自动采集、业务补充、变更通知"],
    ["数据质量", "完整性、唯一性、及时性、准确性", "规则、阈值、工单与复盘"],
    ["主数据", "客户、商品、设备、机构等共享对象", "源权威、去重、合并、历史关系"],
    ["数据安全", "分类分级、权限、脱敏和审计", "审批、最小权限、访问复核"],
    ["数据血缘", "表、字段、任务和指标关系", "影响分析、问题追踪、变更评审"]
  ];
  return [
    "| 组件 | 本文关注对象 | 最小可执行机制 |",
    "| --- | --- | --- |",
    ...components.map(([name, object, control], index) => (
      `| ${name} | ${object}；结合“${profile.topic}”重点检查${ctx.controls[index % ctx.controls.length]} | ${control} |`
    ))
  ].join("\n");
}

function careerArticle(profile) {
  const ctx = profile.context;
  const role = /数据科学家/.test(profile.title) ? "数据科学家" :
    /数据工程师/.test(profile.title) ? "数据工程师" :
    /治理/.test(profile.title) ? "数据治理工程师" :
    /产品经理/.test(profile.title) ? "数据产品经理" :
    /BI/i.test(profile.title) ? "BI 分析师" : "数据分析相关岗位";
  const cases = chooseCases(profile, 3);
  return `# ${profile.title}

> [!tip] 使用方式
> ${pick(VARIANT_OPENERS, profile.seed)(profile)}

## 1. 岗位到底在解决什么问题

围绕“${profile.topic}”，${role}的价值不是掌握多少工具名称，而是能在${ctx.scene}中把模糊问题转成可验证交付。看岗位 JD 时，把要求分成四层：

| 层级 | JD 常见表述 | 面试官真正想确认 | 可提供的证据 |
| --- | --- | --- | --- |
| 业务 | 理解业务、推动增长、支持决策 | 能否找到问题和行动 | 场景、口径、决策与复盘 |
| 方法 | 指标体系、实验、建模、治理 | 是否会选择合适方法 | 方案对比、假设、反例 |
| 工程 | SQL、Python、平台、调度、质量 | 能否稳定交付和排障 | 代码、监控、回滚记录 |
| 协作 | 跨团队、沟通、项目管理 | 是否能把事情推进完 | 争议、决策、责任和时间线 |

“${profile.topic}”在面试中不能只回答定义。准备一个真实案例，说明为什么做、你个人做了什么、如何验证、结果怎样、如果重做会改什么。团队成果和个人贡献要明确分开。

## 2. 能力地图：从知道到能交付

${capabilityTable(profile)}

建议每个能力项准备三份材料：一页知识笔记、一段可运行代码或分析、一条项目证据。没有项目证据的内容可以保留在学习清单，但不要写成“精通”。

## 3. 案例一：用业务问题讲清技术选择

${caseSection(profile, cases[0], 0)}

面试表达可以压缩成 90 秒：

> 背景是【${cases[0].trigger}】。我负责【对象、范围、数据与方案】。先处理【主键、时间、状态或权限】，再用【方法】验证。最终交付【表/指标/服务/规则】，业务采取【行动】。结果是【有口径的改善】，但仍有【限制】，下一版会【改进】。

数字要能回答来源、时间窗、计算方法和你的贡献，不要使用无法解释的百分比。

## 4. 案例二：故障与复盘如何讲

${caseSection(profile, cases[1], 1)}

故障题按“影响、止血、定位、修复、复核、防复发”回答。比如数据异常时，先判断是否阻断发布和通知消费者，再检查源系统、任务、分区、口径、代码和维度映射。修复后要保留问题时间线、影响资产、根因和自动化措施。

## 5. 技术题与代码样例

${articleCodeSection(profile, "面试可讲解的专题代码")}

${articleCodeSection(profile, "质量验证与发布门禁", pythonQualityCode(profile))}

现场回答代码题时，建议边写边讲：

1. 先确认表粒度、状态定义和时间字段。
2. 说明去重策略及为什么选择该窗口。
3. 指出可能全表扫描、数据倾斜或空值影响。
4. 给出验证 SQL 或抽样方式。
5. 说明数据量扩大十倍时先测什么，而不是直接说加机器。

## 6. 高频追问与回答骨架

**问：你如何定义“${profile.topic}”的成功？**

答：同时给出业务结果、过程诊断和护栏指标。业务结果说明是否改善，过程指标解释改善来自哪里，护栏指标防止成本、投诉、风险或长期价值恶化。

**问：指标下降了怎么办？**

答：先确认数据是否真实完整，再按对象、结构、行为和外部因素拆分，抽取正负样本回查，最后给出行动和验证方式。${ctx.controls.slice(0, 3).join("、")}。

**问：为什么选择这个方案？**

答：说明约束和目标，再比较至少两个替代方案。回答应包括开发成本、维护成本、时延、准确性、扩展性和失败后的影响。

**问：最大的困难是什么？**

答：选择一个可复现的技术或协作问题，例如“${ctx.risks[0]}”，讲清你如何定位、谁参与、采取了什么折中和最终防复发措施。

**问：如果重做会改什么？**

答：优先说可验证的改进，例如更早冻结口径、增加质量门禁、用小范围灰度、补充长期护栏指标或减少手工依赖。

## 7. 简历和作品集怎么写

弱表达：

> 使用 SQL 和 Python 完成“${profile.topic}”相关数据分析，制作报表并优化流程。

更可信的表达：

> 负责【业务域】的“${profile.topic}”专题，统一【对象/时间/状态】口径，完成【模型、代码、规则或服务】；通过【验证方法】定位【具体问题】，推动【业务动作】；沉淀【指标字典、监控或复用方案】，并使用【可解释的效率、质量、时效或范围指标】验收。

作品集至少包含背景、数据范围、架构或分析流程、关键代码、质量验证、结果限制和复盘。不能披露公司数据时，使用合成数据和脱敏边界，不要为了好看虚构业务增长。

## 8. 案例三：把岗位要求转成可验证练习

${caseSection(profile, cases[2], 2)}

把案例改写成练习时，不要直接复述团队成果。先列出你个人能复跑的部分，例如定义一行数据、写出三个指标、实现一个质量检查、解释一次失败回滚，再为每个部分找评审人或可验证结果。面试中的“熟悉”必须能落到这些证据上。

## 9. 30 天准备计划

| 周期 | 任务 | 产出 |
| --- | --- | --- |
| 第 1-3 天 | 收集 5 份目标 JD，提取重复要求 | 能力矩阵和差距清单 |
| 第 4-7 天 | 复盘 2 个真实项目，补齐指标与证据 | 90 秒和 3 分钟项目稿 |
| 第 8-14 天 | 练习 SQL、Python 和案例题 | 可运行代码与错题记录 |
| 第 15-20 天 | 模拟连续追问，补齐失败和故障案例 | 追问清单、风险边界 |
| 第 21-24 天 | 针对岗位定制简历和作品集 | 一页简历、项目说明 |
| 第 25-27 天 | 做 3 次限时模拟面试 | 录音、评分和改写 |
| 第 28-30 天 | 复盘表达、薪资与反问问题 | 投递计划和决策标准 |

${operatingSteps(profile).map((item, index) => `${index + 1}. ${item}`).join("\n")}

> [!check] 模拟面试
> 用“${profile.topic}”讲一个 3 分钟案例，再让另一个人连续追问：你个人做了什么、为什么这样建模、如何验证、失败时怎么办、数据扩大十倍怎么办、如果重做会改什么。任何无法用事实回答的句子，都改小到真实范围。

${referenceSection(profile)}
`;
}

function capabilityTable(profile) {
  const ctx = profile.context;
  return [
    "| 能力项 | 合格表现 | 进阶表现 | 证据 |",
    "| --- | --- | --- | --- |",
    `| 业务理解 | 能说明“${profile.topic}”服务谁、影响什么决策 | 能识别错误问题和隐藏约束 | 访谈记录、问题说明 |`,
    `| 指标口径 | 能定义对象、粒度、时间和排除项 | 能处理历史变更、实验和护栏指标 | 指标字典、对账样例 |`,
    `| 数据处理 | 能写可运行的 SQL/Python 并验证质量 | 能设计增量、幂等、监控和回滚 | 代码、执行日志 |`,
    `| 分析判断 | 能分层定位并回到明细 | 能区分描述、预测和因果 | 专题分析、反例清单 |`,
    `| 工程意识 | 知道时延、成本、权限和稳定性边界 | 能做方案取舍与容量评估 | 架构图、压测或故障复盘 |`,
    `| 协作推动 | 能记录争议、结论和负责人 | 能把一次性项目沉淀为机制 | 评审纪要、上线复盘 |`,
    `| 岗位迁移 | 能针对不同 JD 调整证据顺序 | 能解释长期能力与行业选择 | 定制简历、作品集 |`
  ].join("\n");
}

function learningArticle(profile) {
  const ctx = profile.context;
  const cases = chooseCases(profile, 3);
  return `# ${profile.title}

> [!tip] 学习目标
> ${pick(VARIANT_OPENERS, profile.seed)(profile)}

## 1. 先诊断，不要从收藏课程开始

围绕“${profile.topic}”，把当前水平分成四层：

| 层级 | 你应该能做到 | 自测方式 | 常见缺口 |
| --- | --- | --- | --- |
| 知道 | 用自己的话解释概念和边界 | 不看资料讲 2 分钟 | 只会背定义 |
| 会用 | 跟随示例跑通最小闭环 | 从原始数据得到结果 | 依赖复制代码 |
| 会判断 | 发现异常、解释取舍和限制 | 处理缺失、重复和边界样本 | 不知道何时不适用 |
| 会交付 | 独立完成项目并被别人复跑 | 写文档、代码和验收 | 没有质量与复盘 |

给自己打 0-3 分，并选择最低的一项作为第一周重点。不要同时学十个工具，先把${ctx.entities.slice(0, 3).map(([name]) => name).join("、")}与${ctx.stages.slice(0, 4).join("、")}之间的关系画出来。

## 2. 六周学习地图

| 周期 | 学习重点 | 最小交付 | 验收标准 |
| --- | --- | --- | --- |
| 第 1 周 | 概念、业务链路、术语 | 一张流程图和术语表 | 能解释“${profile.topic}”解决什么问题 |
| 第 2 周 | 数据模型与最小 SQL/Python | 可从原始数据算出两个指标 | 主键、时间、粒度能说明 |
| 第 3 周 | 质量与异常 | 三条规则和三类样例 | 能发现并解释一次错误 |
| 第 4 周 | 分析或工程实践 | 一个完整专题或小管道 | 结果能回到明细 |
| 第 5 周 | 性能、权限与发布 | 监控、成本或安全检查 | 知道失败后怎么处理 |
| 第 6 周 | 作品与复盘 | 一页说明、代码、结果和限制 | 另一个人能按文档复跑 |

如果每天只有 45 分钟，可以拉长为 8-10 周，但每周都必须留下可检查的产物。阅读时间是输入，代码、验证和复盘才是掌握证据。

## 3. 最小知识框架

${capabilityTable(profile)}

推荐按“问题 → 对象 → 数据 → 方法 → 验证 → 交付”学习，而不是按菜单式工具列表学习。每次遇到新名词，都把它映射到 ${ctx.entities.slice(0, 4).map(([name]) => name).join("、")}、${ctx.stages.slice(1, 5).join("、")}或 ${ctx.systems.slice(0, 4).join("、")} 中的一个位置。

## 4. 练习项目：做一个可复现的闭环

项目题目可以定为：**在${ctx.label}的脱敏数据中，围绕“${profile.topic}”分析一个流程问题，提出并验证一个改进假设。**

第一版只选择两个指标，例如${ctx.metricDefs[0][0]}和${ctx.metricDefs[1][0]}。按${ctx.dims.slice(0, 3).join("、")}拆分，要求：

1. 说明一行业务数据代表什么。
2. 写出指标和排除项。
3. 至少处理重复、缺失和时间边界。
4. 输出趋势、结构和一个异常案例。
5. 给出行动、负责人、观察周期和停止条件。

## 5. SQL 与 Python 练习

${articleCodeSection(profile, "练习题：标题专属分析代码", diagnosticSql(profile))}

${articleCodeSection(profile, "练习题：质量检查", pythonQualityCode(profile))}

不要只运行代码。请故意破坏三件事：重复一个主键、删除一段日期、把状态改成未知值，确认质量检查能发现。再思考：数据量扩大十倍时，分组是否倾斜、查询是否全表扫描、日志是否足够、重跑是否幂等。

## 6. 工作案例一：${cases[0].org}

${caseSection(profile, cases[0], 0)}

从案例中提取一个练习：用表中的检查项和 SQL 结构，写出你所在场景的对象、时间和指标。即使没有企业数据，也可以用公开数据集或合成数据完成，但必须说明数据来源和使用边界。

## 7. 工作案例二：${cases[1].org}

${caseSection(profile, cases[1], 1)}

## 8. 反馈与复盘机制

学习不能只靠自我感觉。每周至少安排一次外部反馈：

- 让另一个人不看解释运行你的代码或打开作品。
- 请熟悉业务的人检查指标定义是否符合实际。
- 请工程同学检查数据量、成本、权限和失败处理。
- 用“结论能否回到明细”挑战你的分析。

| 复盘问题 | 记录方式 | 下一步 |
| --- | --- | --- |
| 哪一步卡住最久 | 时间日志 | 补概念还是补环境 |
| 哪个错误重复出现 | 错误清单 | 写成检查项或脚本 |
| 哪个结论无法验证 | 证据清单 | 补样本或改结论 |
| 哪个部分依赖复制 | 代码审查 | 从空白重写一次 |
| 哪个交付别人看不懂 | 同伴反馈 | 改文档和示例 |

## 9. 案例三：从一次失败中建立学习反馈

${caseSection(profile, cases[2], 2)}

复盘时把“不会”拆成可学习项：概念不清、数据不可得、代码结构错误、验证方法缺失或表达没有证据。每一项分别对应阅读、练习、代码评审和口头复述，避免用再看一门课掩盖真正缺口。

## 10. 作品集与能力证明

作品首页不要从工具列表开始，而要先写清问题和对象。推荐结构：背景与范围、数据与权限、流程图、关键代码、质量检查、结果与限制、复盘与下一步。每张图都应有标题和口径，每段结论都要能指出证据。

可以在简历中这样表达：

> 围绕【真实问题】完成“${profile.topic}”学习项目，使用【脱敏数据】建立【对象/粒度/指标】，实现【SQL/Python/质量规则】，通过【验证方法】发现【具体问题】，并沉淀【可复跑文档和看板】。

${operatingSteps(profile).map((item, index) => `${index + 1}. ${item}`).join("\n")}

> [!check] 阶段验收
> 如果你能向一个不了解背景的人讲清“${profile.topic}”的业务对象、数据粒度、两个指标、一个异常和一次行动，并让对方按文档复跑代码，这一阶段才算真正完成。

${referenceSection(profile)}
`;
}

function projectArticle(profile) {
  const ctx = profile.context;
  const cases = chooseCases(profile, 3);
  return `# ${profile.title}

> [!abstract] 项目视角
> ${pick(VARIANT_OPENERS, profile.seed)(profile)}

## 1. 项目背景与边界

“${profile.topic}”作为项目，必须同时定义业务目标、数据范围、技术边界和验收方式。建议在立项材料里写清：

- **业务目标**：改善哪个流程、服务哪个角色、影响什么决策。
- **现状基线**：当前耗时、错误率、覆盖率、成本或用户反馈，不能只写“比较落后”。
- **范围**：覆盖业务域、系统、表、指标和团队；明确不做什么。
- **约束**：数据权限、上线窗口、依赖系统、预算、合规和人员。
- **成功标准**：主指标、护栏指标、验收样例和观察周期。

一个合格目标示例：

> 在【时间】前，为【用户】交付“${profile.topic}”能力，使【${ctx.metricDefs[0][0]}】达到【可解释目标】，同时保证${ctx.controls.slice(0, 3).join("、")}，上线后由【负责人】按周复盘。

## 2. 现状诊断与数据资产盘点

先梳理${ctx.systems.slice(0, 6).join("、")}之间的数据流，记录源系统、接口、表、任务、负责人和延迟。不要用一张“系统架构图”掩盖数据质量问题，必须把主键、时间、状态和数量关系标出来。

${domainModel(profile)}

盘点阶段至少输出：资产清单、接口清单、指标基线、质量问题清单、权限清单和依赖矩阵。对每个问题标记影响范围、发生频率、现有临时方案和根本原因。

## 3. 目标架构与方案取舍

${architectureTable(profile)}

方案评审至少比较两种选择。例如批处理与实时处理、现成工具与自研、集中式平台与数据网格。比较维度包括交付速度、时延、成本、可维护性、权限边界、扩展性和失败恢复，而不是只比较功能清单。

## 4. 数据模型与指标口径

${metricTable(profile)}

模型设计优先保证粒度清晰和可重算。事实表负责事件或结果，维度表负责对象属性与历史归属，汇总表负责稳定消费。对于“${profile.topic}”，如果既有事件又有状态，应分别建模，避免用最新状态覆盖历史。

## 5. 案例一：${cases[0].org}

${caseSection(profile, cases[0], 0)}

项目里最重要的一次评审通常发生在写代码之前。把对象、粒度、时间和成功标准画在白板上，让业务、数据、安全和运维共同指出歧义，往往比上线后修复便宜得多。

## 6. 核心代码与自动化

${articleCodeSection(profile, "项目核心实现")}

${articleCodeSection(profile, "上线前质量门禁", pythonQualityCode(profile))}

代码交付要求：

- 参数化日期、环境和业务范围，不在代码里硬编码生产密钥。
- 任务可重复运行，重复执行不会产生重复数据。
- 关键步骤记录输入行数、输出行数、过滤行数和质量结果。
- 失败时保留日志和中间状态，支持按分区重跑。
- 代码、配置和表结构纳入版本管理，并有变更记录。

## 7. 案例二：${cases[1].org}

${caseSection(profile, cases[1], 1)}

## 8. 测试、灰度与上线

| 测试类型 | 检查内容 | 通过标准 |
| --- | --- | --- |
| 单元测试 | 字段映射、计算逻辑、边界条件 | 用例覆盖正常、异常和极端值 |
| 集成测试 | 上下游接口、主键关联、权限 | 端到端能跑通 |
| 数据测试 | 唯一、完整、及时、平衡 | 关键规则通过并留存结果 |
| 性能测试 | 扫描量、执行时长、并发和资源 | 在容量预算内且可扩展 |
| 灰度 | 小范围业务与新旧结果对照 | 差异可解释，问题可回滚 |
| 验收 | 业务样例、指标和操作流程 | 验收人签字或有系统记录 |

灰度阶段应保留新旧链路对照。差异不能简单要求“完全一致”，因为修复本身可能改变结果；正确做法是对每类差异给出原因、影响和审批。

## 9. 第三个案例：${cases[2].org}

${caseSection(profile, cases[2], 2)}

## 10. 运营、验收与复盘

上线不是项目结束，而是运营开始。建议建立：

- 日监控：任务成功、延迟、数据量、关键规则和接口错误。
- 周复盘：主指标、护栏指标、业务使用、问题和行动。
- 月评估：成本、容量、复用、缺陷和需求变化。
- 变更评审：表结构、口径、依赖、权限和下游通知。

| 验收项 | 证据 | 负责人 |
| --- | --- | --- |
| 业务范围与口径确认 | 评审记录、指标字典 | 业务负责人 |
| 数据结果可核对 | 对账报告、抽样明细 | 数据负责人 |
| 权限与合规 | 权限矩阵、审计记录 | 安全合规 |
| 稳定性与回滚 | 监控、演练记录 | 运维与开发 |
| 业务采用 | 查询、看板或接口使用记录 | 产品或运营 |
| 收益与副作用 | 主指标、护栏指标、复盘 | 项目负责人 |

${operatingSteps(profile).map((item, index) => `${index + 1}. ${item}`).join("\n")}

> [!check] 项目答辩
> 用 5 分钟回答：为什么要做“${profile.topic}”、现状证据是什么、方案比较过哪些选择、数据粒度怎样定义、最大风险如何控制、上线后用什么证明有效、你个人具体负责什么。

${referenceSection(profile)}
`;
}

function architectureTable(profile) {
  const ctx = profile.context;
  return [
    "| 层次 | 本文建议 | 关键问题 | 验收证据 |",
    "| --- | --- | --- | --- |",
    `| 数据源 | ${ctx.systems.slice(0, 3).join("、")} | 权威源、更新频率、主键和权限 | 接口或表清单 |`,
    `| 接入 | 批、流或 CDC 按业务时延选择 | 重复、顺序、断点续传和回放 | 延迟与幂等测试 |`,
    `| 存储 | 按访问模式选择数据湖、数仓或 OLAP | 分区、格式、生命周期和成本 | 容量与查询评测 |`,
    `| 计算 | SQL、Spark、Flink 或 Python 服务 | 粒度、状态、资源和失败恢复 | 压测与执行计划 |`,
    `| 治理 | 元数据、质量、血缘、权限 | 责任、规则、影响分析和审计 | 规则结果与变更记录 |`,
    `| 服务 | 指标、API、看板或应用 | SLA、缓存、限流和版本 | 监控与验收样例 |`
  ].join("\n");
}

function aiArticle(profile) {
  const ctx = profile.context;
  const cases = chooseCases(profile, 3);
  return `# ${profile.title}

> [!tip] 核心原则
> ${pick(VARIANT_OPENERS, profile.seed)(profile)}

## 1. 从业务任务定义 AI 能力

围绕“${profile.topic}”，先把任务写成输入、输出、成功标准和失败边界。不要从“上一套模型”或“接一个聊天框”开始。

| 设计项 | 必须回答的问题 | 错误示例 | 更好做法 |
| --- | --- | --- | --- |
| 用户 | 谁使用，谁复核，谁承担后果 | 所有人都能用 | 按角色和权限明确使用边界 |
| 输入 | 文本、表格、图片还是工具调用 | 把所有数据都塞进上下文 | 只提供任务所需且获授权的数据 |
| 输出 | 分类、生成、检索、SQL 还是动作 | 只要求“回答准确” | 定义可检查的输出结构 |
| 成功 | 任务完成、采纳、质量、时延和成本 | 只看离线准确率 | 离线 + 线上 + 人工复核 |
| 失败 | 无答案、拒答、转人工还是回滚 | 失败也生成看似合理内容 | 明确置信阈值和降级路径 |

## 2. 数据、知识库与版本

${domainModel(profile)}

AI 项目的数据治理比传统报表更强调版本和来源。至少记录：

- 数据集和知识文档的来源、授权、时间、负责人和版本。
- 样本标注规则、标注人、抽检结果和争议处理。
- 训练、验证、测试与线上反馈是否隔离。
- 提示词、模型、温度、检索参数和工具权限的版本。
- 输入中的个人信息、商业秘密和敏感字段是否脱敏。

如果“${profile.topic}”使用 RAG，文档切片应尊重标题、章节、表格和条款结构；如果使用微调，先证明提示词、检索或流程优化不足；如果使用 Agent，先限制工具白名单和最大执行步数。

## 3. 评估：不要只看一个准确率

| 评估层 | 指标 | 说明 |
| --- | --- | --- |
| 检索 | Hit@K、MRR、版本正确率、权限过滤 | 正确内容是否被召回且可用 |
| 生成 | 引用支持率、事实一致性、完整性 | 回答是否有证据、是否遗漏关键条件 |
| 任务 | 完成率、转人工率、采纳率、重复澄清 | 用户问题是否真的解决 |
| 安全 | 越权、注入、敏感输出、违规动作 | 是否突破权限与安全边界 |
| 工程 | P50/P95 延迟、错误率、并发、成本 | 能否稳定且经济地服务 |
| 业务 | 节省时间、转化、质量、投诉 | 是否带来可解释价值 |

离线集要包含高频问题、长尾问题、边界问题、对抗问题和“应该拒答”的问题。线上评估要按用户、任务和风险等级分层，避免总体平均掩盖高危错误。

## 4. 案例一：${cases[0].org}

${caseSection(profile, cases[0], 0)}

## 5. Python：检索与任务评估

${articleCodeSection(profile, "检索、Agent 或模型任务实现")}

${articleCodeSection(profile, "标题专属数据与失败分层 SQL", diagnosticSql(profile))}

示例代码只展示可测试结构。真实系统还需要模型服务、向量库、权限、日志、缓存、限流、敏感检查和人工反馈，不应把安全完全交给提示词。

## 6. 案例二：${cases[1].org}

${caseSection(profile, cases[1], 1)}

## 7. 架构与工程链路

${architectureTable(profile)}

推荐把链路拆成六层：数据与知识准备、检索或特征、模型调用、工具执行、评估与审核、监控与反馈。每层都要有版本、日志和失败处理。Agent 工具调用应在服务端校验参数与权限，不能只依赖模型“自觉”。

## 8. 监控、成本与安全

- 监控请求量、延迟、错误码、超时、重试和缓存命中。
- 记录检索文档版本、模型版本、提示词版本和关键参数。
- 对失败分类：检索缺失、上下文过长、工具失败、权限拒绝、模型拒答、结果不合规。
- 设置单位任务成本、每租户预算和异常调用告警。
- 对提示注入、越权、敏感信息和危险动作做专门测试。
- 保留人工复核、转人工、回滚到旧模型和关闭工具的开关。

## 9. 第三个案例与上线验收

${caseSection(profile, cases[2], 2)}

| 验收项 | 最低要求 | 证据 |
| --- | --- | --- |
| 任务定义 | 输入输出和失败路径明确 | 产品说明、评测集 |
| 数据授权 | 来源、用途和权限可追溯 | 数据卡、授权记录 |
| 离线评估 | 覆盖常规、边界和拒答 | 评测报告 |
| 线上灰度 | 有对照组和护栏指标 | 实验或灰度记录 |
| 安全 | 越权、注入和敏感输出已测试 | 红队与审计报告 |
| 成本 | 单位请求预算和上限明确 | 账单与调用日志 |
| 运营 | 有反馈、复盘和回滚 | 周报、事故演练 |

${operatingSteps(profile).map((item, index) => `${index + 1}. ${item}`).join("\n")}

> [!check] 自测
> 为“${profile.topic}”写出一个 20 条评测集的设计说明，其中至少包含 5 条常规问题、5 条长尾问题、5 条边界或对抗问题和 5 条应拒答问题。再说明每条失败由谁处理、如何回流。

${referenceSection(profile)}
`;
}

function engineeringArticle(profile) {
  const ctx = profile.context;
  const cases = chooseCases(profile, 3);
  return `# ${profile.title}

> [!abstract] 工程视角
> ${pick(VARIANT_OPENERS, profile.seed)(profile)}

## 1. 需求、SLA 与边界

“${profile.topic}”首先是工程问题，其次才是工具选择。立项时明确：

- 谁消费数据或服务，用来做什么决策或操作。
- 数据从产生到可用允许延迟多久，失败时能否接受部分结果。
- 更新频率、保留周期、回放范围、并发和数据量级。
- 上下游依赖、权限、敏感字段、审计和成本上限。
- 正确性、完整性和一致性中，哪些必须强保证，哪些可最终一致。

${ctx.label}中常见的交付指标包括${ctx.metricDefs.slice(0, 3).map(([name]) => name).join("、")}。不要只写“稳定”“高效”，应定义可监测的 SLI、SLO 和错误预算。

## 2. 数据链路与模型

${architectureTable(profile)}

${domainModel(profile)}

链路设计先明确事实粒度。例如一行代表一次事件、一条订单明细、一个每日快照还是一个任务运行实例。粒度一旦混用，后面即使加了汇总表，也会把数量和金额累计两次。

## 3. 案例一：${cases[0].org}

${caseSection(profile, cases[0], 0)}

## 4. 代码实现：从可运行到可维护

${articleCodeSection(profile, "专题实现代码")}

${articleCodeSection(profile, "统一口径诊断 SQL", diagnosticSql(profile))}

工程代码至少要满足以下要求：

1. 输入输出明确，参数来自配置或调度上下文。
2. 重跑同一分区不会产生重复结果。
3. 关键步骤记录度量，便于定位数据量和状态变化。
4. 失败可重试，但不会无限重试或放大副作用。
5. 版本、表结构和依赖变更可追踪。
6. 敏感信息不写进代码、日志和异常信息。

## 5. 测试方法与质量门禁

${qualityTable(profile)}

${articleCodeSection(profile, "质量门禁与失败样本", pythonQualityCode(profile))}

测试分为开发环境和生产前门禁。开发环境可以使用抽样数据快速验证逻辑，生产前门禁必须检查分区覆盖、主键、比例异常、上下游对账和资源消耗。数据发布后还要验证消费者能够读取、权限正确且时延在 SLA 内。

## 6. 案例二：${cases[1].org}

${caseSection(profile, cases[1], 1)}

## 7. 性能、容量与成本

| 瓶颈 | 先测量 | 可选手段 | 风险 |
| --- | --- | --- | --- |
| 扫描过多 | 分区命中、文件数、字节数 | 分区裁剪、列裁剪、压缩格式 | 分区过碎 |
| Shuffle 重 | 数据量、键分布、并发 | 预聚合、盐化、调整并发 | 资源争抢 |
| 热点倾斜 | Task 时长、输入大小 | 拆分热点键、两阶段聚合 | 结果顺序变化 |
| 状态过大 | Checkpoint、状态后端 | TTL、增量 Checkpoint、拆分 | 业务语义风险 |
| 查询慢 | 执行计划、缓存命中 | 预聚合、物化视图、OLAP | 数据新鲜度 |
| 成本高 | CPU、内存、存储、调用 | 生命周期、冷热分层、弹性 | SLA 退化 |

调优必须建立基线和回归对比：执行时间、扫描量、Shuffle 量、峰值内存、失败率和成本。只展示一次“从 30 分钟到 3 分钟”不够，还要说明数据量、资源和结果是否正确。

## 8. 案例三：${cases[2].org}

${caseSection(profile, cases[2], 2)}

## 9. 发布、监控与故障处理

发布流程建议包括：代码评审、配置评审、数据迁移评审、灰度、对账、可观测性检查和回滚演练。监控至少覆盖任务、数据、服务、资源和业务五层。

故障处理顺序：

1. 确认影响面和是否需要暂停下游。
2. 保存现场：任务日志、参数、版本、输入输出计数。
3. 阻断错误扩散，必要时回滚到上一个稳定版本。
4. 按源系统、接入、计算、存储、服务和消费逐层定位。
5. 修复后按受影响分区补数，并验证重复、缺失和时序。
6. 完成问题时间线、根因、影响、改进和复核。

## 10. 验收清单

- 表结构、主键、分区、生命周期和负责人已登记。
- 关键任务具备幂等、重试、超时、告警和回滚。
- 质量规则接入发布门禁，阈值有业务依据。
- 核心链路有端到端 SLA 监控。
- 配置和密钥与代码分离，访问遵循最小权限。
- 容量和成本有基线，扩容与优化都有测量依据。
- 文档包含数据流、依赖、口径、故障处理和联系人。

${operatingSteps(profile).map((item, index) => `${index + 1}. ${item}`).join("\n")}

> [!check] 工程复盘
> 选择一个你维护或模拟的“${profile.topic}”链路，画出源系统到消费者的完整路径，写出三个 SLI、两条质量门禁、一个回滚方案和一个成本优化实验。没有测量数据时，先补测量再谈优化。

${referenceSection(profile)}
`;
}

function resumeArticle(profile) {
  const role = /治理/.test(profile.title) ? "数据治理" :
    /工程师/.test(profile.title) ? "数据工程" :
    /运营/.test(profile.title) ? "数据运营" :
    /产品/.test(profile.title) ? "数据产品" :
    /BI/i.test(profile.title) ? "BI 分析" : "数据分析";
  const cases = chooseCases(profile, 3);
  return `# ${profile.title}

> [!tip] 模板边界
> 本文提供“${role}”方向的结构和表达方法，不替你制造经历。所有项目、数字、职责和工具都必须来自真实工作；敏感信息应脱敏，并明确个人贡献。

## 1. 这份简历要证明什么

围绕“${profile.topic}”，简历要在 10 秒内让招聘者看到三件事：你解决过什么业务问题、用了什么方法、结果如何被验证。先收集 5 份目标 JD，把要求归为业务、方法、工程和协作四类，再从真实经历中找证据。

${capabilityTable(profile)}

## 2. 推荐结构

| 模块 | 内容 | 建议 |
| --- | --- | --- |
| 基本信息 | 姓名、联系方式、城市、方向 | 只保留招聘所需信息 |
| 个人概述 | 年限、行业、能力、代表成果 | 3 行以内 |
| 工作经历 | 范围、动作、交付、结果 | 主体，按时间倒序 |
| 项目经历 | 2-4 个与目标岗位最相关项目 | 不重复工作经历 |
| 技能 | 数据库、语言、平台和方法 | 按熟练程度和场景分类 |
| 教育证书 | 学历、必要证书、作品链接 | 不堆无关证书 |

## 3. 工作经历写法

推荐句式：

> 负责【真实业务范围】的“${profile.topic}”相关工作，统一【对象、时间、状态或指标】口径，完成【SQL/Python/模型/规则/服务/流程】；通过【验证方法】解决【具体问题】，支持【团队或场景】，并用【可解释指标】验收。

一个项目应写清：

- **背景**：${cases[0].trigger}。
- **任务**：你负责的部分、时间、目标和约束。
- **行动**：${cases[0].action}。
- **结果**：${cases[0].outcome}。
- **复盘**：${profile.context.risks[0]}如何被控制，下一版改什么。

## 4. 项目一：${profile.topic}

### 案例 1：把“${profile.topic}”写成可核验项目

下面是一个脱敏复合场景，只用来说明如何整理证据，不能替代你的真实经历。

**项目背景：** 在${profile.context.scene}中，团队需要围绕“${profile.topic}”解决对象、口径、链路或交付问题。

**本人职责：**

- 负责需求拆分、指标定义和${profile.context.entities[0][0]}粒度设计。
- 完成数据处理、代码实现、验证和文档。
- 与业务、上下游与安全团队确认边界、权限和发布。

**实现方案：**

- 从${profile.context.entities.slice(0, 3).map(([name]) => name).join("、")}建立事实与维度模型。
- 对${profile.context.controls.slice(0, 4).join("、")}建立检查。
- 使用${profile.context.systems.slice(0, 3).join("、")}的数据形成可追溯结果。

**结果表达：** 使用真实的覆盖范围、任务数量、指标数、交付时效、缺陷率、人工步骤变化或业务采用情况。没有准确数字时，不虚构金额和增长率。

## 5. 项目二：故障、质量或治理闭环

${caseSection(profile, cases[1], 1)}

这个案例适合用来证明你不只是“跑数”，还理解质量、工程和协作。简历中可以压缩成 2-3 行，面试时再展开时间线、个人动作和证据。

### 案例 3：把跨团队协作写成个人贡献

${caseSection(profile, cases[2], 2)}

改写简历时，把“参与、协助、负责、主导”换成具体动作：你确认了哪个口径、修改了哪段逻辑、发现了哪类异常、推动了谁做决定、留下了什么验收证据。团队共同成果可以写，但必须明确你的边界，不能用“我们”掩盖个人贡献。

## 6. 技能与代码怎么写

技能栏建议写“工具 + 使用场景 + 结果”，不要把 30 个名词堆在一起：

- SQL：能完成多表关联、窗口函数、分组聚合、口径对账和性能检查。
- Python：能完成数据清洗、质量检查、实验分析或任务自动化。
- 数据工程：理解批流处理、调度、幂等、监控、回滚和成本。
- 数据治理：理解标准、元数据、血缘、质量、权限和问题闭环。
- AI：理解 Prompt、RAG、评估、可观测性和数据安全边界。

可展示的 SQL 骨架：

${articleCodeSection(profile, "可展示的专题代码骨架")}

${articleCodeSection(profile, "可展示的验收 SQL", diagnosticSql(profile))}

面试时不要声称这段代码直接来自生产。先说明它是为作品集重新构造的脱敏示例，再指出如果用于真实数据，需要补充哪些分区、权限、状态和业务字段。

## 7. 弱表达与改写

| 弱表达 | 问题 | 改写方向 |
| --- | --- | --- |
| 负责“${profile.topic}”数据分析 | 无对象、动作、结果 | 说明对象、口径、方法和决策 |
| 精通各种数据工具 | 无法验证 | 改成工具与具体场景 |
| 优化了流程 | 无基线和证据 | 写人工步骤、时效、错误率变化 |
| 参与大模型项目 | 责任边界不清 | 明确数据、评估、应用或平台职责 |
| 提升业务效果 | 可能是团队和自然增长 | 写采用动作、观察指标和限制 |

## 8. 格式与投递检查

- 一页优先，最多两页；每项写 1-3 行。
- 时间统一 \`YYYY.MM - YYYY.MM\`，技术大小写统一。
- 导出 PDF 检查中文字体、链接、分页和页边距。
- 删除身份证号、家庭住址、内部域名、客户名单和密钥。
- 针对岗位调整摘要和项目顺序，一份简历不要投所有方向。
- 每个数字准备口径、周期、计算方法和个人贡献说明。

> [!check] 三问检查
> 任选一条简历要点，让另一个人连续追问：具体做了什么、怎么证明、如果重做会改什么。如果无法用事实回答，就把表达改小到真实范围或删除。

${referenceSection(profile)}
`;
}

function renderArticle(profile) {
  const blueprint = buildBlueprintArticle(profile);
  if (blueprint) return blueprint;

  const builders = {
    industry: industryArticle,
    analytics: analyticsArticle,
    governance: governanceArticle,
    career: careerArticle,
    learning: learningArticle,
    project: projectArticle,
    ai: aiArticle,
    engineering: engineeringArticle,
    resume: resumeArticle
  };
  const builder = builders[profile.kind] || buildTitleSpecificArticle;
  const article = builder(profile);
  return insertBeforeReferences(article, buildTitlePracticeExtension(profile));
}

function frontmatter(profile, body) {
  const difficulty = profile.kind === "learning" ? "基础" :
    profile.kind === "engineering" || profile.kind === "ai" ? "进阶" : "实战";
  const tags = [
    profile.topic,
    profile.context.label,
    profile.section.split(" / ").filter(Boolean).at(-1),
    profile.kind === "career" || profile.kind === "resume" ? "求职面试" :
      profile.kind === "governance" ? "数据治理" :
      profile.kind === "learning" ? "学习路线" : "工作实战"
  ].filter(Boolean);
  return [
    "---",
    `title: ${JSON.stringify(profile.title)}`,
    "tags:",
    ...tags.map((tag) => `  - ${JSON.stringify(tag)}`),
    "created: 2026-01-01",
    "updated: 2026-11-06",
    `difficulty: ${difficulty}`,
    `duration: ${Math.max(35, Math.round(body.length / 450))}分钟`,
    "knowledge_type: topic-specific-guide",
    "target_audience:",
    "  - 数据分析师",
    "  - 数据开发工程师",
    "  - 业务与产品人员",
    "stability: stable",
    "status: complete",
    "access_tier: free",
    "---",
    "",
    ""
  ].join("\n");
}

function buildArticle(relativePath, fallbackTitle, existingMarkdown = "") {
  const title = displayTitleFromMarkdown(existingMarkdown, fallbackTitle, relativePath);
  const profile = topicProfile(relativePath, title);
  const body = renderArticle(profile);
  const markdown = `${frontmatter(profile, body)}${body}`;
  return {
    title,
    category: profile.context.label,
    kind: profile.kind,
    characters: markdown.length,
    markdown
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
        pos: [lineIndex, 0, offset, lineIndex, line.length, offset + line.length]
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
      duration: lines.find((line) => line.startsWith("duration:"))?.split(":").slice(1).join(":").trim() || "35分钟",
      knowledge_type: "topic-specific-guide",
      stability: "stable",
      status: "complete",
      tags,
      target_audience: ["数据分析师", "数据开发工程师", "业务与产品人员"],
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

module.exports = {
  buildArticle,
  analyzeMarkdown,
  topicProfile,
  cleanTitle
};
