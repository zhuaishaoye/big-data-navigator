const FAMILY_RULES = [
  {
    key: "resume",
    pattern: /简历|CV模板|作品集包装|简历重写|简历生成/i,
    label: "简历与作品证据",
    kind: "resume",
    codeType: "career-evidence"
  },
  {
    key: "career",
    pattern: /求职|面试|职业|薪资谈判|薪酬谈判|转行|晋升|能力模型|能力地图|岗位|JD|招聘方|职场|个人品牌|创业之路|时间管理|团队领导力|技术领导力|沟通技巧|向上管理|影响力|跨部门|危机沟通/i,
    label: "职业判断与协作",
    kind: "career",
    codeType: "career-evidence"
  },
  {
    key: "learning",
    pattern: /学习|成长路线|升级路线|升级计划|行动计划|刻意练习|知识管理|写作促进|输出倒逼|新手踩坑|入门筑基|实战进阶|高级专家|领域领航|L[1-4]-/i,
    label: "学习路径与刻意练习",
    kind: "learning",
    codeType: "learning-loop"
  },
  {
    key: "ml",
    pattern: /机器学习|深度学习|监督学习|无监督学习|强化学习|神经网络|梯度下降|过拟合|欠拟合|特征工程|训练集|验证集|测试集|交叉验证|偏差方差|分类模型|回归模型|聚类模型/i,
    label: "机器学习建模与验证",
    kind: "ai",
    codeType: "model-evaluation"
  },
  {
    key: "agent",
    pattern: /Agent(?:ic)?|智能体|工具调用|控制平面|沙箱|提示词规范|自动化触达|Agent-to-Data|Agentic-/i,
    label: "Agent 任务闭环",
    kind: "ai",
    codeType: "agent-runtime"
  },
  {
    key: "rag",
    pattern: /RAG|检索增强|向量数据库|语义搜索|Embedding|向量索引|知识库治理|重排|混合检索/i,
    label: "RAG 检索与证据",
    kind: "ai",
    codeType: "rag-evidence"
  },
  {
    key: "llm",
    pattern: /LLM|大模型|大语言模型|Prompt|提示工程|微调|Fine-tune|模型评估|模型可解释|生成式AI|多模态|自然语言处理/i,
    label: "大模型任务与评估",
    kind: "ai",
    codeType: "model-evaluation"
  },
  {
    key: "ai-governance",
    pattern: /AI数据治理|AI治理|AI-ready|训练数据|数据标注|数据偏见|模型卡|数据卡|合成数据|数据飞轮|反馈数据|AI系统审计|AI合规|EU-AI-Act|NIST-AI-RMF|隐私计算|差分隐私|联邦学习|零知识证明/i,
    label: "AI 数据治理与证据链",
    kind: "governance",
    codeType: "ai-governance"
  },
  {
    key: "spark",
    pattern: /Spark|RDD|DataFrame|Shuffle|宽依赖|窄依赖|Executor|TaskScheduler|DAGScheduler|Partitioner|reduceByKey|groupByKey|广播变量|checkpoint|persist|YARN|Standalone/i,
    label: "Spark 执行与资源",
    kind: "engineering",
    codeType: "spark-plan"
  },
  {
    key: "kafka",
    pattern: /Kafka|消费积压|Broker|Rebalance|消息队列/i,
    label: "Kafka 消息链路",
    kind: "engineering",
    codeType: "kafka-lag"
  },
  {
    key: "streaming",
    pattern: /Flink|流处理|实时计算|Structured\s*Streaming|事件驱动|双流\s*Join|水位线|Checkpoint|Exactly-once/i,
    label: "流处理状态与一致性",
    kind: "engineering",
    codeType: "streaming-state"
  },
  {
    key: "cdc",
    pattern: /CDC|Debezium|Binlog|增量接入|数据库同步/i,
    label: "CDC 增量同步",
    kind: "engineering",
    codeType: "cdc-reconcile"
  },
  {
    key: "scheduling",
    pattern: /Airflow|DolphinScheduler|调度|依赖管理|补数|数据DevOps|数据CI-CD|自动化部署|自动化监控|发布管理|数据环境|工作流重构/i,
    label: "调度发布与依赖",
    kind: "engineering",
    codeType: "dag-release"
  },
  {
    key: "data-quality",
    pattern: /数据质量|质量监控|质量改进|质量评估|异常检测|数据漂移|质量维度|质量治理/i,
    label: "数据质量与发布门禁",
    kind: "governance",
    codeType: "quality-gate"
  },
  {
    key: "lineage",
    pattern: /血缘|Lineage|元数据|数据目录|影响分析|DataHub|Apache Atlas/i,
    label: "元数据与血缘影响分析",
    kind: "governance",
    codeType: "lineage-graph"
  },
  {
    key: "master-data",
    pattern: /主数据|MDM|OneID|统一身份|数据标准|数据字典|指标口径|语义层|数据合约|数据编码/i,
    label: "主数据与统一语义",
    kind: "governance",
    codeType: "master-data"
  },
  {
    key: "security",
    pattern: /数据安全|分类分级|访问控制|权限管理|隐私|数据脱敏|数据加密|合规|审计|跨境|Ranger|零信任|HIPAA|法规/i,
    label: "安全、隐私与权限证明",
    kind: "governance",
    codeType: "security-policy"
  },
  {
    key: "data-service",
    pattern: /数据服务|RESTful|GraphQL|数据API|服务网关|服务编排|服务监控|服务部署|语义层工程/i,
    label: "数据服务契约与运行",
    kind: "engineering",
    codeType: "data-api"
  },
  {
    key: "text-to-sql",
    pattern: /Text[\s-]*to[\s-]*SQL|自然语言查询|自然语言转SQL|NL2SQL|Schema Linking|SQL生成|查询意图/i,
    label: "Text-to-SQL 语义解析与查询治理",
    kind: "ai",
    codeType: "text-to-sql"
  },
  {
    key: "warehouse",
    pattern: /数据仓库|数据湖|湖仓|数仓|维度建模|概念数据建模|逻辑数据建模|物理数据建模|OneData|OneModel|数据分层|DataFabric|DataMesh|数据编织|数据建模/i,
    label: "数据模型与分层",
    kind: "engineering",
    codeType: "warehouse-model"
  },
  {
    key: "architecture",
    pattern: /数据架构|平台架构|架构模式|架构原则|架构评估|架构演进|数据中台|云原生|容器化|Kubernetes|微服务|Serverless|多云|数据网格|基础架构|技术栈|技术债务|容量规划/i,
    label: "架构取舍与演进",
    kind: "engineering",
    codeType: "architecture-score"
  },
  {
    key: "performance",
    pattern: /性能优化|查询引擎|OLAP|缓存|系统性能|资源利用率|存储优化|成本优化/i,
    label: "性能基线与容量",
    kind: "engineering",
    codeType: "performance-benchmark"
  },
  {
    key: "sql",
    pattern: /\bSQL\b|窗口函数|执行计划|Join|CTE|子查询|HAVING|GROUP\s*BY|TopN|连续活跃|行列转换/i,
    label: "SQL 查询与语义",
    kind: "engineering",
    codeType: "sql-diagnostic"
  },
  {
    key: "genomics",
    pattern: /基因组|基因检测|基因突变|基因融合|外显子|多组学|宏基因组|循环肿瘤|液体活检|微卫星|肿瘤突变负荷|拷贝数|单核苷酸|插入缺失|结构变异|Panel|胚胎植入|线粒体/i,
    label: "基因组检测与注释",
    kind: "industry",
    codeType: "genomics-qc"
  },
  {
    key: "medical-imaging",
    pattern: /医学影像|影像组学|PACS|RIS|胸部CT|病理诊断|达芬奇|医疗器械法规|FDA\s*510/i,
    label: "医学影像与器械证据",
    kind: "industry",
    codeType: "medical-evidence"
  },
  {
    key: "clinical",
    pattern: /门诊|住院|急诊|ICU|床位|治愈率|病死率|挂号|分诊|会诊|院感|药物不良反应|用药错误|慢病|糖尿病|高血压|血压|血糖|血脂|健康体检|疾病|治疗|临床|患者|医院|医疗|医师|诊断|随访/i,
    label: "临床流程与质量",
    kind: "industry",
    codeType: "clinical-event"
  },
  {
    key: "pharma",
    pattern: /新药|药物|制药|临床试验|一期临床|二期临床|原研药|仿制药|生物药|中成药|医药|药房|医保目录|带量采购|集中采购|药占比|GMP|GSP|药物警戒|ADMET|酪氨酸激酶/i,
    label: "药品研发、准入与安全",
    kind: "industry",
    codeType: "pharma-evidence"
  },
  {
    key: "medical-it",
    pattern: /HIS|EMR|EHR|LIS|电子病历|病历系统|医院信息|智慧医院|互联网医院|在线问诊|远程医疗|医疗信息化|临床决策支持/i,
    label: "医疗信息系统与互操作",
    kind: "industry",
    codeType: "medical-it"
  },
  {
    key: "finance-metric",
    pattern: /净资产收益率|ROE|ROA|市盈率|市净率|股息率|夏普比率|beta系数|EBITDA|资产周转率|毛利率|净利率|资本充足率|拨备覆盖率|不良贷款率|存贷利差|偿付能力|风险溢价|净值|利差/i,
    label: "金融指标口径",
    kind: "industry",
    codeType: "finance-metric"
  },
  {
    key: "finance-instrument",
    pattern: /期货|期权|互换|对冲|套利|资产证券化|指数基金|私募基金|基金管理|债券|衍生品|做市商|量化投资|资产配置|价值投资|技术分析|数字货币/i,
    label: "金融工具与组合",
    kind: "industry",
    codeType: "finance-instrument"
  },
  {
    key: "finance-cashflow",
    pattern: /现金流|经营现金流|投资现金流|筹资现金流|自由现金流|现金转换周期|收现比|付现比|间接法/i,
    label: "现金流、营运资金与偿债能力",
    kind: "industry",
    codeType: "finance-cashflow"
  },
  {
    key: "finance-risk",
    pattern: /市场风险|操作风险|流动性风险|信贷风险|信用评级|风险评级|风险管理|反洗钱|巴塞尔|合规风险|担保|融资租赁|信贷|银行|保险|证券|信托|IPO|并购|承销|支付清算|核心银行/i,
    label: "金融业务、风险与合规",
    kind: "industry",
    codeType: "finance-ledger"
  },
  {
    key: "retail-metric",
    pattern: /客单价|坪效|同店增长|库存周转|安全库存|缺货率|损耗率|价格弹性|会员转化|复购率|流失率|跳出率|停留时间|转化率|购物车放弃|二跳率|支付成功率|推荐准确率|ROAS|GMV|点击率|转化成本|退货率|好评率|展示量|CPC|CPM|CTR|CVR|UV|PV|ROI|LTV|CAC|ARPU|获客成本|用户生命周期价值|经济订货量/i,
    label: "零售经营指标",
    kind: "industry",
    codeType: "retail-metric"
  },
  {
    key: "retail-system",
    pattern: /ERP|WMS|OMS|CRM|商品系统|订单系统|仓储管理系统|客户关系管理/i,
    label: "零售交易与履约系统",
    kind: "industry",
    codeType: "order-state"
  },
  {
    key: "retail-operation",
    pattern: /零售|电商|直播|社交电商|私域|社群|会员|营销|选品|定价|推荐|客服|购物车|履约|退货|搜索转化|直通车|内容营销|种草|满减|O2O|微商|全渠道|供应链金融|订阅制|无人零售|新零售/i,
    label: "零售增长与履约经营",
    kind: "industry",
    codeType: "retail-funnel"
  },
  {
    key: "manufacturing-metric",
    pattern: /生产效率|产能利用率|生产周期|设备综合效率|OEE|时间开动率|性能开动率|良品率|准时交付率|在制品|生产节拍|良率|停线|瓶颈工序/i,
    label: "制造效率指标",
    kind: "industry",
    codeType: "manufacturing-metric"
  },
  {
    key: "manufacturing-system",
    pattern: /MES|PLM|QMS|SCM|工业互联网|制造执行|制造信息系统|ERP制造业版/i,
    label: "制造执行与质量系统",
    kind: "industry",
    codeType: "manufacturing-state"
  },
  {
    key: "manufacturing-tech",
    pattern: /数字孪生|预测性维护|物联网|自动化产线|柔性制造|智能制造|工业4\.0|精益生产|六西格玛|质量控制|供应商管理|采购管理|库存管理|物流管理|生产计划|生产调度|BMS|SOC|三电|动力电池|续航|BEV|FCEV|HEV|PHEV|V2X|充电|换电|自动驾驶|车联网|轻量化|整车制造/i,
    label: "制造技术与运营",
    kind: "industry",
    codeType: "manufacturing-state"
  },
  {
    key: "company-strategy",
    pattern: /战略|竞争|护城河|市场|车企|汽车|比亚迪|特斯拉|蔚来|理想|小鹏|吉利|长城|美团|京东|淘宝|天猫|拼多多|抖音|小红书|B站|贝壳|平台经济学|网络效应|双边市场|商业模式|增长瓶颈|烧钱|佣金|盈利|商业画布|投融资|OKR|KPI/i,
    label: "公司、市场与商业模式",
    kind: "industry",
    codeType: "strategy-evidence"
  },
  {
    key: "education",
    pattern: /教育|学校|高校|课程|学制|教学|师生比|升学率|LMS|SIS|教务|学习分析|学情|在线学习|智慧校园|双减/i,
    label: "教育流程与学习成效",
    kind: "industry",
    codeType: "education-outcome"
  },
  {
    key: "logistics",
    pattern: /物流|仓储|运输|配送|快递|车辆调度|路线优化|供应链|第三方物流|最后一公里|ABC分析|智能调度|网约车|共享出行|高铁|民航|低空经济/i,
    label: "物流网络与履约",
    kind: "industry",
    codeType: "logistics-network"
  },
  {
    key: "real-estate",
    pattern: /房地产|物业|房产|容积率|去化率|建筑密度|开发周期|IRR|土地成本|销售均价|楼宇|租约|租赁/i,
    label: "房地产项目与资产",
    kind: "industry",
    codeType: "real-estate"
  },
  {
    key: "energy",
    pattern: /能源|电力|发电|电网|负荷|可再生|绿电|碳市场|用电|智能电表|新能源|消纳|电价/i,
    label: "能源负荷与交易",
    kind: "industry",
    codeType: "energy-load"
  },
  {
    key: "agriculture",
    pattern: /农业|农产品|作物|土壤|精准农业|智慧农业|种植|产量预测|农业物联网/i,
    label: "农业生产与溯源",
    kind: "industry",
    codeType: "agriculture-yield"
  },
  {
    key: "internet-business",
    pattern: /互联网|平台|流量变现|用户增长|AARRR|留存分析|LTV_CAC|北极星指标|单元经济|增长飞轮|私域流量|创作者经济|算法推荐|超级App|即时零售|社区团购|前置仓|白牌/i,
    label: "互联网增长与平台经济",
    kind: "industry",
    codeType: "growth-model"
  },
  {
    key: "analytics-method",
    pattern: /归因|AB测试|A\/B|A_B|实验设计|序贯|样本量|统计功效|CUPED|因果推断|假设检验|方差分析|相关|回归|聚类|决策树|交叉验证|超参数|集成学习|在线学习|描述性统计|统计分析|模型评估|预测模型|特征工程|RFM|漏斗|同期群|用户画像|多维度分析|异常检测|风险控制分析/i,
    label: "分析方法与实验验证",
    kind: "analytics",
    codeType: "experiment-validation"
  },
  {
    key: "analytics-operation",
    pattern: /增长|运营|会员|用户|内容|活动|营销|渠道|获客|激活|留存|流失|推荐|商品经济|产品迭代|流量|社区|创作者|转化|复购|分层|触达|策略|指标|看板|效果评估/i,
    label: "数据运营与增长实验",
    kind: "analytics",
    codeType: "growth-model"
  },
  {
    key: "data-project",
    pattern: /项目|实施指南|建设路径|落地案例|成功案例|案例库|实践案例|实战案例|迁移/i,
    label: "数据项目交付",
    kind: "project",
    codeType: "project-delivery"
  }
];

const METRIC_SPECS = [
  {
    pattern: /净资产收益率|ROE/i,
    formula: "归母净利润 / 平均归母净资产",
    unit: "百分比",
    interpretation: "衡量股东权益的回报效率；必须同时拆解净利率、资产周转率和权益乘数",
    trap: "用期末净资产做分母、把一次性收益当作持续利润，或忽略负净资产"
  },
  {
    pattern: /总资产收益率|ROA/i,
    formula: "净利润 / 平均总资产",
    unit: "百分比",
    interpretation: "衡量全部资产的盈利效率，适合与杠杆水平一起看",
    trap: "平均资产未剔除受限资金，或分子分母的合并范围不一致"
  },
  {
    pattern: /市盈率|PE/i,
    formula: "股权价值 / 归母净利润（或每股价格 / 每股收益）",
    unit: "倍",
    interpretation: "市场为当前或预期盈利支付的价格，依赖盈利口径和可比公司",
    trap: "负利润时仍机械比较、混用静态/滚动/预测 PE，或忽略股本变化"
  },
  {
    pattern: /市净率|PB/i,
    formula: "股权价值 / 归母净资产",
    unit: "倍",
    interpretation: "市场对净资产的定价，常用于资产密集或金融企业",
    trap: "商誉、递延税和资产减值口径不一致，或忽略净资产质量"
  },
  {
    pattern: /股息率/i,
    formula: "过去十二个月现金分红 / 当前股权价值",
    unit: "百分比",
    interpretation: "现金回报与价格的比值，需要区分特别股息和可持续分红",
    trap: "用宣告日与除权日混算，或把一次性处置收益分红视为稳定收益"
  },
  {
    pattern: /beta/i,
    formula: "Cov(资产收益, 市场收益) / Var(市场收益)",
    unit: "系数",
    interpretation: "资产收益对市场收益的历史敏感度，不是永久风险标签",
    trap: "窗口、频率和市场基准被随意更换；低估非流动资产的平滑估值偏差"
  },
  {
    pattern: /夏普比率/i,
    formula: "(组合年化收益 - 无风险利率) / 组合年化波动率",
    unit: "系数",
    interpretation: "单位波动风险对应的超额收益，需与基准、窗口和成本一起报告",
    trap: "收益分布不近似正态、回撤很大时仍只看夏普，或忽略交易成本"
  },
  {
    pattern: /EBITDA/i,
    formula: "净利润 + 利息 + 税项 + 折旧与摊销",
    unit: "金额",
    interpretation: "近似观察经营现金流创造能力，但不等同于自由现金流",
    trap: "把资本开支和营运资金完全忽略，或使用非标准调整项"
  },
  {
    pattern: /现金流|经营现金流|自由现金流|现金转换周期|收现比|付现比/i,
    formula: "经营现金流净额 = 净利润 ± 非现金项目 - 营运资金增加；自由现金流 = 经营现金流净额 - 资本性支出",
    unit: "金额",
    interpretation: "衡量内生现金创造、营运资金占用和可分配空间，必须与利润、债务到期和资本开支联动",
    trap: "用银行流水代替现金流量表、把融资流入当作经营改善，或忽略应收、存货、应付的期限差"
  },
  {
    pattern: /设备综合效率|OEE|时间开动率|性能开动率|良品率/i,
    formula: "OEE = 可用率 × 性能率 × 良品率",
    unit: "百分比",
    interpretation: "把计划损失、停机、速度损失和质量损失拆开，用于定位产线改善机会",
    trap: "计划停机未从日历时间中正确排除、标准节拍版本混用，或用产量达成率替代性能率"
  },
  {
    pattern: /毛利率/i,
    formula: "(营业收入 - 营业成本) / 营业收入",
    unit: "百分比",
    interpretation: "衡量产品与服务的直接盈利空间，应与产品结构、渠道和退货联动",
    trap: "成本归集范围变化、优惠券处理不同、未扣除退货重算收入"
  },
  {
    pattern: /资产周转率/i,
    formula: "营业收入 / 平均总资产",
    unit: "次",
    interpretation: "衡量资产产生收入的效率，需区分轻资产与重资产模式",
    trap: "平均资产口径不一致，或把并购导致的资产跃升当作效率下降"
  },
  {
    pattern: /资本充足率/i,
    formula: "合格资本 / 风险加权资产",
    unit: "百分比",
    interpretation: "银行吸收损失能力的监管指标，需匹配适用资本定义和资产口径",
    trap: "忽略新监管规则、并行期安排、风险缓释和表内外资产范围"
  },
  {
    pattern: /不良贷款率|NPL/i,
    formula: "不良贷款余额 / 贷款总额",
    unit: "百分比",
    interpretation: "贷款资产质量的存量指标，要结合逾期迁徙、核销和重组贷款",
    trap: "通过核销或展期压低比率、五级分类时点不一致、分母含不同口径"
  },
  {
    pattern: /拨备覆盖率/i,
    formula: "贷款损失准备 / 不良贷款余额",
    unit: "百分比",
    interpretation: "贷款损失准备对不良贷款的覆盖程度，与利润和资本共同评估",
    trap: "只看监管下限，忽略预期信用损失模型与宏观情景变化"
  },
  {
    pattern: /存贷利差/i,
    formula: "生息资产收益率 - 计息负债成本率",
    unit: "百分点",
    interpretation: "银行核心利差能力，应拆分资产收益、负债成本和期限结构",
    trap: "混用平均余额与期末余额，或没有统一年化天数"
  },
  {
    pattern: /客单价/i,
    formula: "有效成交金额 / 有效订单数或成交用户数",
    unit: "元",
    interpretation: "每一单或每位成交用户的平均金额，必须固定分子分母口径",
    trap: "退款、取消、测试订单和拆单处理不一致，造成订单数不可比"
  },
  {
    pattern: /坪效/i,
    formula: "门店可比营业收入 / 可比营业面积",
    unit: "元/平方米/周期",
    interpretation: "单位门店面积产出，应结合可比店、租期和业态调整",
    trap: "新店爬坡期与成熟店混算，或面积口径包含不营业区域"
  },
  {
    pattern: /库存周转率/i,
    formula: "销售成本 / 平均库存金额（或数量）",
    unit: "次",
    interpretation: "库存被消耗的速度，必须与缺货率、损耗率和现金占用同时看",
    trap: "用销售额代替销售成本、平均库存窗口过短，或忽略在途库存"
  },
  {
    pattern: /安全库存/i,
    formula: "服务水平对应的 z 值 × 需求标准差 × 提前期平方根",
    unit: "数量",
    interpretation: "对需求和提前期不确定性的缓冲，服务水平选择必须与缺货成本匹配",
    trap: "需求方差用错粒度、假定正态而忽略促销尖峰，或未考虑供应商可靠性"
  },
  {
    pattern: /经济订货量|EOQ/i,
    formula: "sqrt(2 × 年需求量 × 单次订货成本 / 单位持有成本)",
    unit: "数量",
    interpretation: "在订货成本与库存持有成本之间寻找批量平衡，是简化模型而非最终答案",
    trap: "忽略起订量、仓储上限、保质期和波动需求，直接照搬公式"
  },
  {
    pattern: /ROAS/i,
    formula: "渠道归因收入 / 渠道广告花费",
    unit: "倍",
    interpretation: "广告花费带来的归因收入效率，要同时考虑毛利、退款和增量性",
    trap: "把自然流量或重复回传算给广告，忽略品牌词和归因窗口"
  },
  {
    pattern: /LTV|用户生命周期价值/i,
    formula: "同 cohort 在观察窗口内累计贡献毛利 / 获取用户数",
    unit: "元/人",
    interpretation: "用户长期贡献的经济价值，必须说明 cohort、窗口、毛利和留存",
    trap: "用收入代替毛利、成熟 cohort 外推新 cohort，或窗口短于回本周期"
  },
  {
    pattern: /CAC|用户获取成本|获客成本/i,
    formula: "获客投入 / 同期新增且符合定义的用户数",
    unit: "元/人",
    interpretation: "获取有效用户的成本，应与渠道、自然量、留存和毛利联动",
    trap: "把品牌投入全部归给直接渠道、用户去重后仍重复计算，或忽略退款"
  },
  {
    pattern: /CTR|点击率/i,
    formula: "有效点击次数 / 有效曝光次数",
    unit: "百分比",
    interpretation: "曝光到点击的吸引力，需同时看位置、人群和后续低质点击",
    trap: "误点、机器人和重复曝光未清掉，或不同位置的曝光口径混算"
  },
  {
    pattern: /CVR|转化率/i,
    formula: "完成目标行为的有效用户数 / 进入可转化范围的用户数",
    unit: "百分比",
    interpretation: "目标阶段之间的转换效率，必须定义进入分母的时点",
    trap: "分母包含不具备条件的用户、归因窗口不一致，或只报比例不看样本量"
  },
  {
    pattern: /复购率/i,
    formula: "观察期内发生第二次有效购买的用户数 / 首购用户数",
    unit: "百分比",
    interpretation: "用户再次购买的比例，需固定商品、渠道、时间窗和退款规则",
    trap: "不同品类自然复购周期被同一窗口处理，或首购 cohort 尚未成熟"
  },
  {
    pattern: /流失率/i,
    formula: "观察期初活跃且期末前未达到流失定义的用户数 / 观察期初活跃用户数",
    unit: "百分比",
    interpretation: "用户从活跃状态转为不活跃的比例，流失阈值必须由业务周期决定",
    trap: "用登录代替真实价值行为、窗口太短，或把季节性回落当流失"
  },
  {
    pattern: /留存率/i,
    formula: "第 N 天或第 N 周仍有价值行为的首日 cohort 用户数 / cohort 用户数",
    unit: "百分比",
    interpretation: "同一批用户随时间继续使用产品的比例，必须使用完整 cohort",
    trap: "新老用户混 cohort、用打开代替价值行为，或近期 cohort 观察窗口不足"
  },
  {
    pattern: /平均住院日/i,
    formula: "出院患者占用总床日数 / 同期出院患者数",
    unit: "床日",
    interpretation: "住院资源占用效率，须与病例组合、再入院率和医疗质量同时评估",
    trap: "只压缩住院日导致再入院上升，或转科、转院和入院时间边界不一致"
  },
  {
    pattern: /床位周转率|床位周转次数/i,
    formula: "出院患者数 / 平均开放床位数",
    unit: "次/周期",
    interpretation: "床位利用与周转效率，必须同时观察床位使用率、收治结构和安全边界",
    trap: "盲目提高周转忽略病情复杂度，或空床、加床和统计时点不统一"
  },
  {
    pattern: /治愈率/i,
    formula: "达到既定治愈标准的患者数 / 同一病种接受治疗的合格患者数",
    unit: "百分比",
    interpretation: "特定病种和随访窗口内的治疗结局，需绑定诊断和疗效标准",
    trap: "终点定义不统一、失访未计入、严重程度分层不同"
  },
  {
    pattern: /病死率/i,
    formula: "观察期内因该病死亡的患者数 / 该病住院或诊疗患者数",
    unit: "百分比",
    interpretation: "疾病严重程度和救治结果的观察指标，不能脱离病例组合比较医院",
    trap: "分母混入筛查或轻症人群，或死亡时间窗口与转院处理不一致"
  },
  {
    pattern: /药占比/i,
    formula: "药品收入 / 同期医疗总收入",
    unit: "百分比",
    interpretation: "药品费用在医疗收入中的结构，需要与合理用药和患者负担联动",
    trap: "通过转移收费项目压低药占比，却不改善临床合理性与可及性"
  },
  {
    pattern: /师生比/i,
    formula: "折算后的全职教师数 / 在册或全日制学生数",
    unit: "比值",
    interpretation: "教学人力资源相对规模，需说明教师折算和学生的统计范围",
    trap: "把兼职、临聘与在编教师混算，或专业、学段之间直接平均"
  },
  {
    pattern: /升学率/i,
    formula: "达到指定升学结果且纳入统计的毕业生数 / 同一届纳入统计的毕业生数",
    unit: "百分比",
    interpretation: "特定届别与升学路径的结果比例，应同时披露复读、出国和未升学口径",
    trap: "剔除低分学生、混用录取与报到、跨届计算"
  },
  {
    pattern: /负荷率/i,
    formula: "统计期内平均实际负荷 / 同期最大可用容量",
    unit: "百分比",
    interpretation: "设备或电网容量的使用强度，需与峰谷时段和停电检修窗口结合",
    trap: "用瞬时峰值代替平均负荷、容量边界不一致，或忽略线损和备用容量"
  },
  {
    pattern: /电网损耗/i,
    formula: "(输入电量 - 输出电量) / 输入电量",
    unit: "百分比",
    interpretation: "输配电过程中的能量损失，需按电压等级、区域和计量边界拆分",
    trap: "关口表时间不同步、偷漏电和统计线损混在一起，未校验计量误差"
  },
  {
    pattern: /作物产量/i,
    formula: "籽粒或可售农产品重量 / 实际收获面积",
    unit: "公斤/亩",
    interpretation: "单位面积的实际产出，需说明含水量、地块边界和不可收获损失",
    trap: "用种植面积代替收获面积、忽略灾害损失和水分折算"
  },
  {
    pattern: /转化漏斗/i,
    formula: "各阶段有效用户数按相同对象、时间窗和业务状态逐级计算",
    unit: "人数与阶段转化率",
    interpretation: "描述用户从进入到目标行为的阶段损耗，不是把不同系统比例相乘",
    trap: "各阶段用户键不一致、时间窗口不统一，或把回流用户从分母移除"
  },
  {
    pattern: /产销率|去化率/i,
    formula: "已销售或去化面积 / 可售面积",
    unit: "百分比",
    interpretation: "项目可售资源的去化速度，需区分认购、签约、备案和回款",
    trap: "把认购当成交、可售口径随推盘变化，或阶段和时间窗不一致"
  },
  {
    pattern: /IRR|内部收益率/i,
    formula: "使项目净现值等于零的折现率",
    unit: "百分比",
    interpretation: "项目现金流的综合回报率，依赖现金流时点和再投资假设",
    trap: "漏计土地款、税费和融资成本，或现金流发生在错误时点"
  }
];

const FAMILY_SOURCES = {
  finance: [
    ["CFA Institute：金融与投资公开学习资料", "https://www.cfainstitute.org/"],
    ["BIS：银行监管与 Basel Framework", "https://www.bis.org/basel_framework/"]
  ],
  retail: [
    ["Google Analytics：指标与转化分析帮助", "https://support.google.com/analytics/"],
    ["Shopify：零售经营指标公开指南", "https://www.shopify.com/blog/retail-metrics"]
  ],
  manufacturing: [
    ["ISA-95：企业与制造系统集成框架", "https://www.isa.org/standards-and-publications/isa-95"],
    ["NIST：智能制造系统公开资料", "https://www.nist.gov/programs-projects/smart-manufacturing"]
  ],
  healthcare: [
    ["WHO：健康主题与指标公开资料", "https://www.who.int/health-topics"],
    ["NCBI Bookshelf：临床与基因组公开资源", "https://www.ncbi.nlm.nih.gov/books/"]
  ],
  education: [
    ["OECD Education：教育指标与研究", "https://www.oecd.org/education/"],
    ["UNESCO UIS：教育统计口径", "https://uis.unesco.org/"]
  ],
  logistics: [
    ["MIT Center for Transportation and Logistics", "https://ctl.mit.edu/"],
    ["世界银行 Logistics Performance Index", "https://lpi.worldbank.org/"]
  ],
  realestate: [
    ["RICS：房地产与估值专业资料", "https://www.rics.org/"],
    ["OECD：住房与城市数据", "https://www.oecd.org/housing/"]
  ],
  energy: [
    ["IEA：能源统计与市场公开资料", "https://www.iea.org/data-and-statistics"],
    ["IRENA：可再生能源统计", "https://www.irena.org/Data"]
  ],
  agriculture: [
    ["FAO：农业统计与可持续生产资料", "https://www.fao.org/statistics/"],
    ["FAO：农业数据标准", "https://www.fao.org/statistics/areas-of-work/standards/"]
  ],
  technology: [
    ["Apache Spark Documentation", "https://spark.apache.org/docs/latest/"],
    ["Apache Flink Documentation", "https://nightlies.apache.org/flink/flink-docs-stable/"],
    ["Apache Kafka Documentation", "https://kafka.apache.org/documentation/"]
  ],
  data: [
    ["DAMA Data Management Body of Knowledge", "https://www.dama.org/cpages/body-of-knowledge"],
    ["NIST Data Privacy Framework", "https://www.nist.gov/privacy-framework"],
    ["Google SRE Workbook", "https://sre.google/workbook/table-of-contents/"]
  ],
  ai: [
    ["NIST AI Risk Management Framework", "https://www.nist.gov/itl/ai-risk-management-framework"],
    ["scikit-learn User Guide", "https://scikit-learn.org/stable/user_guide.html"],
    ["Microsoft RAG Solution Design", "https://learn.microsoft.com/azure/architecture/ai-ml/guide/rag/"]
  ],
  career: [
    ["O*NET OnLine：职业任务与技能公开数据", "https://www.onetonline.org/"],
    ["U.S. Bureau of Labor Statistics：职业资料", "https://www.bls.gov/ooh/"]
  ],
  learning: [
    ["The Learning Scientists：学习策略综述", "https://www.learningscientists.org/"],
    ["Carnegie Mellon Eberly：学习科学资源", "https://www.cmu.edu/teaching/resources/"]
  ]
};

const SYSTEM_LABELS = [
  "源业务系统",
  "主数据与维度系统",
  "数据接入层",
  "明细数据层",
  "指标或模型层",
  "服务与看板层",
  "监控和审计层"
];

function familySourceKey(family) {
  if (/finance/.test(family)) return "finance";
  if (/retail|growth|order/.test(family)) return "retail";
  if (/manufactur/.test(family)) return "manufacturing";
  if (/clinical|genomics|medical|pharma|health/.test(family)) return "healthcare";
  if (/education/.test(family)) return "education";
  if (/logistics/.test(family)) return "logistics";
  if (/real-estate/.test(family)) return "realestate";
  if (/energy/.test(family)) return "energy";
  if (/agriculture/.test(family)) return "agriculture";
  if (/agent|rag|llm|model|ai-/.test(family)) return "ai";
  if (/spark|kafka|streaming|cdc|scheduling|warehouse|architecture|performance|sql|data-service/.test(family)) return "technology";
  if (/career|resume/.test(family)) return "career";
  if (/learning/.test(family)) return "learning";
  return "data";
}

function inferDomainFamily(relativePath) {
  if (relativePath.includes("/01-金融行业/")) return "finance-process";
  if (relativePath.includes("/02-零售电商/")) return "retail-operation";
  if (relativePath.includes("/03-制造业/")) return "manufacturing-tech";
  if (relativePath.includes("/04-医疗健康/")) return "clinical";
  if (relativePath.includes("/05-教育培训/")) return "education";
  if (relativePath.includes("/06-交通物流/")) return "logistics";
  if (relativePath.includes("/07-房地产/")) return "real-estate";
  if (relativePath.includes("/08-能源电力/")) return "energy";
  if (relativePath.includes("/09-农业/")) return "agriculture";
  if (relativePath.includes("/10-互联网科技/")) return "internet-business";
  if (relativePath.includes("/11-互联网商业分析/")) return "company-strategy";
  return "industry-overview";
}

function inferPathFamily(relativePath) {
  if (relativePath.startsWith("【求职就业专题】/")) return "career";
  if (relativePath.startsWith("【学习路线】/") || relativePath.startsWith("【学习方法分享】/")) return "learning";
  if (relativePath.startsWith("【项目实战库】/")) return "data-project";
  if (relativePath.startsWith("【数据治理与数据管理】/")) return "data-quality";
  if (relativePath.startsWith("【数据开发与数据架构】/")) return "architecture";
  if (relativePath.startsWith("【AI 与大数据】/")) return "ai-foundation";
  return "analytics-method";
}

function matchMetric(title) {
  return METRIC_SPECS.find((item) => item.pattern.test(title)) || null;
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

function matchRule(relativePath, title) {
  const candidates = FAMILY_RULES.map((rule, index) => {
    const titleHits = countPatternHits(rule.pattern, title);
    const pathHits = countPatternHits(rule.pattern, relativePath);
    const specificity = Math.min(30, Math.round(rule.pattern.source.length / 12));
    const orderBonus = Math.max(0, 8 - Math.floor(index / 8));
    const score = titleHits
      ? 1000 + titleHits * 30 + specificity * 2 + orderBonus
      : pathHits
        ? 300 + pathHits * 10 + specificity + orderBonus
        : -1;
    return { rule, score, titleHits };
  }).filter((candidate) => candidate.score >= 0);
  candidates.sort((left, right) => (
    right.score - left.score ||
    right.titleHits - left.titleHits ||
    right.rule.pattern.source.length - left.rule.pattern.source.length
  ));
  if (candidates[0]) return candidates[0].rule;
  const fallback = inferDomainFamily(relativePath);
  return FAMILY_RULES.find((rule) => rule.key === fallback) || {
    key: inferPathFamily(relativePath),
    label: "业务与数据方法",
    kind: relativePath.startsWith("【各行业的基础知识】/") ? "industry" : "analytics",
    codeType: "metric-check"
  };
}

function matchTitleSpecialty(relativePath, title, context) {
  const rule = matchRule(relativePath, title);
  const metric = matchMetric(title);
  const stages = context.stages || ["业务发生", "数据采集", "口径处理", "结果发布", "行动复盘"];
  const systems = context.systems || ["源业务系统", "数据仓库", "指标服务", "监控平台"];
  const controls = context.controls || ["对象唯一", "时间完整", "状态有效", "金额平衡"];
  const risks = context.risks || ["口径不一致", "数据延迟", "主键重复", "权限越界"];
  return {
    key: rule.key,
    label: rule.label,
    family: rule.key,
    kind: rule.kind,
    codeType: metric ? `${rule.key}-metric` : rule.codeType,
    metric,
    objectName: metric ? "指标" : rule.label,
    workflow: stages,
    systems,
    controls,
    risks,
    sourceKey: familySourceKey(rule.key),
    sources: FAMILY_SOURCES[familySourceKey(rule.key)] || FAMILY_SOURCES.data,
    systemLayers: SYSTEM_LABELS
  };
}

module.exports = {
  FAMILY_RULES,
  METRIC_SPECS,
  FAMILY_SOURCES,
  matchTitleSpecialty,
  matchMetric
};
