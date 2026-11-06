---
title: Oracle银行数仓DM层设计
tags:
  - 技术工具
  - Oracle
date: 2026-03-22
difficulty: 高级
duration: 45分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据治理工程师
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-22
updated: 2026-10-10
---


# Oracle银行数仓DM层设计

## 📋 概述

DM（Data Mart）层是面向特定业务主题的数据集市层，基于DW层的数据，针对具体业务场景进行进一步加工和优化，提供给前端应用和报表使用。

## 🏗️ DM层设计原则

### 1. 面向主题
- 围绕特定业务主题组织数据
- 满足部门级的分析需求
- 提供预计算的指标和维度

### 2. 性能优先
- 宽表设计减少关联
- 预聚合提升查询速度
- 合理冗余换取性能

## 📊 主题域划分

### 1. 客户主题域
```sql
-- 客户360视图宽表
CREATE TABLE DM_CUSTOMER_360 (
    cust_id          VARCHAR2(20) PRIMARY KEY,
    -- 基础信息
    cust_name        VARCHAR2(100),
    cust_type        VARCHAR2(20),
    cust_level       VARCHAR2(10),
    age              NUMBER,
    gender           VARCHAR2(10),
    -- 资产信息
    total_deposit    NUMBER(18,2),    -- 存款总额
    total_loan       NUMBER(18,2),    -- 贷款总额
    total_invest     NUMBER(18,2),    -- 投资总额
    aum_balance      NUMBER(18,2),    -- AUM余额
    -- 行为信息
    first_trans_date DATE,            -- 首次交易日期
    last_trans_date  DATE,            -- 最近交易日期
    trans_count_1m   NUMBER,          -- 近1月交易次数
    trans_amount_1m  NUMBER(18,2),    -- 近1月交易金额
    active_days_1m   NUMBER,          -- 近1月活跃天数
    -- 风险信息
    risk_score       NUMBER,          -- 风险评分
    overdue_count    NUMBER,          -- 逾期次数
    overdue_amount   NUMBER(18,2),    -- 逾期金额
    -- 价值信息
    profit_contrib   NUMBER(18,2),    -- 利润贡献
    clv_score        NUMBER,          -- 客户生命周期价值
    churn_prob       NUMBER(3,2),     -- 流失概率
    -- 标签信息
    is_vip           VARCHAR2(1),
    is_active        VARCHAR2(1),
    is_risk          VARCHAR2(1),
    update_date      DATE
);

-- 创建索引
CREATE INDEX idx_dm_cust_level ON DM_CUSTOMER_360(cust_level);
CREATE INDEX idx_dm_cust_aum ON DM_CUSTOMER_360(aum_balance);
```

### 2. 产品主题域
```sql
-- 产品销售分析表
CREATE TABLE DM_PRODUCT_SALES (
    stat_date        DATE,
    product_code     VARCHAR2(20),
    product_name     VARCHAR2(100),
    product_type     VARCHAR2(20),
    -- 销售指标
    sales_count      NUMBER,          -- 销售笔数
    sales_amount     NUMBER(18,2),    -- 销售金额
    new_cust_count   NUMBER,          -- 新客户数
    renew_count      NUMBER,          -- 续购笔数
    -- 客户指标
    cust_count       NUMBER,          -- 客户数
    avg_holding      NUMBER(18,2),    -- 平均持有金额
    avg_duration     NUMBER,          -- 平均持有期限
    -- 收益指标
    interest_income  NUMBER(18,2),    -- 利息收入
    fee_income       NUMBER(18,2),    -- 手续费收入
    total_profit     NUMBER(18,2),    -- 总利润
    profit_rate      NUMBER(5,2),     -- 利润率
    -- 环比同比
    sales_mom        NUMBER(5,2),     -- 销售额环比
    sales_yoy        NUMBER(5,2),     -- 销售额同比
    PRIMARY KEY (stat_date, product_code)
) PARTITION BY RANGE (stat_date)
INTERVAL (NUMTODSINTERVAL(1, 'DAY'));
```

### 3. 风险主题域
```sql
-- 风险监控汇总表
CREATE TABLE DM_RISK_MONITOR (
    stat_date        DATE,
    risk_type        VARCHAR2(20),
    -- 贷款风险
    loan_balance     NUMBER(18,2),    -- 贷款余额
    npl_balance      NUMBER(18,2),    -- 不良贷款余额
    npl_ratio        NUMBER(5,2),     -- 不良率
    overdue_1_30     NUMBER(18,2),    -- 逾期1-30天
    overdue_31_60    NUMBER(18,2),    -- 逾期31-60天
    overdue_61_90    NUMBER(18,2),    -- 逾期61-90天
    overdue_90_plus  NUMBER(18,2),    -- 逾期90天以上
    -- 操作风险
    abnormal_trans   NUMBER,          -- 异常交易数
    fraud_amount     NUMBER(18,2),    -- 欺诈金额
    -- 流动性风险
    lcr_ratio        NUMBER(5,2),     -- 流动性覆盖率
    nsfr_ratio       NUMBER(5,2),     -- 净稳定资金比率
    PRIMARY KEY (stat_date, risk_type)
);
```

### 4. 渠道主题域
```sql
-- 渠道分析表
CREATE TABLE DM_CHANNEL_ANALYSIS (
    stat_date        DATE,
    channel_code     VARCHAR2(10),
    channel_name     VARCHAR2(50),
    -- 交易指标
    trans_count      NUMBER,          -- 交易笔数
    trans_amount     NUMBER(18,2),    -- 交易金额
    success_count    NUMBER,          -- 成功笔数
    success_rate     NUMBER(5,2),     -- 成功率
    -- 客户指标
    active_users     NUMBER,          -- 活跃用户数
    new_users        NUMBER,          -- 新增用户数
    avg_trans_amt    NUMBER(18,2),    -- 平均交易金额
    -- 性能指标
    avg_resp_time    NUMBER(8,3),     -- 平均响应时间(秒)
    error_count      NUMBER,          -- 错误次数
    error_rate       NUMBER(5,2),     -- 错误率
    PRIMARY KEY (stat_date, channel_code)
);
```

## 🔄 数据加载流程

### 1. 客户360视图更新
```sql
CREATE OR REPLACE PROCEDURE SP_LOAD_DM_CUSTOMER_360
AS
BEGIN
    -- 清理客户360表全部数据，随后全量重载当前快照
    DELETE FROM DM_CUSTOMER_360;
    
    -- 重新加载
    INSERT INTO DM_CUSTOMER_360
    SELECT 
        c.cust_id,
        c.cust_name,
        c.cust_type,
        c.cust_level,
        TRUNC(MONTHS_BETWEEN(SYSDATE, c.birth_date)/12) as age,
        c.gender,
        -- 资产信息（从事实表汇总）
        NVL(dep.deposit_balance, 0) as total_deposit,
        NVL(loan.loan_balance, 0) as total_loan,
        NVL(inv.invest_balance, 0) as total_invest,
        NVL(dep.deposit_balance, 0) + NVL(inv.invest_balance, 0) as aum_balance,
        -- 行为信息
        trans.first_trans_date,
        trans.last_trans_date,
        trans.trans_count_1m,
        trans.trans_amount_1m,
        trans.active_days_1m,
        -- 风险信息
        risk.risk_score,
        risk.overdue_count,
        risk.overdue_amount,
        -- 价值信息
        profit.profit_contrib,
        profit.clv_score,
        model.churn_prob,
        -- 标签
        CASE WHEN c.cust_level IN ('VIP','VVIP') THEN 'Y' ELSE 'N' END as is_vip,
        CASE WHEN trans.last_trans_date >= SYSDATE - 30 THEN 'Y' ELSE 'N' END as is_active,
        CASE WHEN risk.risk_score > 60 THEN 'Y' ELSE 'N' END as is_risk,
        SYSDATE as update_date
    FROM DIM_CUSTOMER c
    LEFT JOIN V_CUSTOMER_DEPOSIT dep ON c.cust_id = dep.cust_id
    LEFT JOIN V_CUSTOMER_LOAN loan ON c.cust_id = loan.cust_id
    LEFT JOIN V_CUSTOMER_INVEST inv ON c.cust_id = inv.cust_id
    LEFT JOIN V_CUSTOMER_TRANS trans ON c.cust_id = trans.cust_id
    LEFT JOIN V_CUSTOMER_RISK risk ON c.cust_id = risk.cust_id
    LEFT JOIN V_CUSTOMER_PROFIT profit ON c.cust_id = profit.cust_id
    LEFT JOIN V_CUSTOMER_MODEL model ON c.cust_id = model.cust_id
    WHERE c.current_flag = 'Y';
    
    COMMIT;
    
    -- 更新统计信息
    DBMS_STATS.GATHER_TABLE_STATS('DW', 'DM_CUSTOMER_360');
END;
/
```

### 2. 产品销售日汇总
```sql
CREATE OR REPLACE PROCEDURE SP_LOAD_DM_PRODUCT_SALES(p_date DATE)
AS
BEGIN
    -- 删除当日数据
    DELETE FROM DM_PRODUCT_SALES WHERE stat_date = p_date;
    
    -- 插入新数据
    INSERT INTO DM_PRODUCT_SALES
    SELECT 
        p_date as stat_date,
        p.product_code,
        p.product_name,
        p.product_type,
        -- 销售指标
        COUNT(DISTINCT f.trans_id) as sales_count,
        SUM(f.trans_amount) as sales_amount,
        COUNT(DISTINCT CASE WHEN c.first_trans_date = p_date 
                            THEN c.cust_id END) as new_cust_count,
        COUNT(DISTINCT CASE WHEN f.is_renew = 'Y' 
                            THEN f.trans_id END) as renew_count,
        -- 客户指标
        COUNT(DISTINCT f.cust_key) as cust_count,
        AVG(f.balance) as avg_holding,
        AVG(f.duration_days) as avg_duration,
        -- 收益指标
        SUM(f.interest_income) as interest_income,
        SUM(f.fee_income) as fee_income,
        SUM(f.total_profit) as total_profit,
        CASE WHEN SUM(f.trans_amount) > 0 
             THEN SUM(f.total_profit) / SUM(f.trans_amount) * 100 
             ELSE 0 END as profit_rate,
        -- 环比同比（需要子查询）
        0 as sales_mom,  -- 后续更新
        0 as sales_yoy   -- 后续更新
    FROM FACT_PRODUCT_SALES f
    JOIN DIM_PRODUCT p ON f.product_key = p.product_key
    JOIN DIM_CUSTOMER c ON f.cust_key = c.cust_key
    JOIN DIM_DATE d ON f.date_key = d.date_key
    WHERE d.full_date = p_date
    GROUP BY p.product_code, p.product_name, p.product_type;
    
    -- 更新环比同比
    MERGE INTO DM_PRODUCT_SALES t
    USING (
        SELECT 
            product_code,
            stat_date,
            LAG(sales_amount, 1) OVER (PARTITION BY product_code 
                                       ORDER BY stat_date) as prev_month,
            LAG(sales_amount, 12) OVER (PARTITION BY product_code 
                                        ORDER BY stat_date) as prev_year
        FROM DM_PRODUCT_SALES
    ) s
    ON (t.product_code = s.product_code AND t.stat_date = s.stat_date)
    WHEN MATCHED THEN UPDATE SET
        t.sales_mom = CASE WHEN s.prev_month > 0 
                          THEN (t.sales_amount - s.prev_month) / s.prev_month * 100
                          ELSE 0 END,
        t.sales_yoy = CASE WHEN s.prev_year > 0 
                          THEN (t.sales_amount - s.prev_year) / s.prev_year * 100
                          ELSE 0 END;
    
    COMMIT;
END;
/
```

## 📈 性能优化策略

### 1. 物化视图
```sql
-- 创建物化视图加速查询
CREATE MATERIALIZED VIEW MV_CUST_DAILY_STATS
BUILD IMMEDIATE
REFRESH FAST ON DEMAND
AS
SELECT 
    stat_date,
    cust_type,
    cust_level,
    COUNT(*) as cust_count,
    SUM(aum_balance) as total_aum,
    AVG(aum_balance) as avg_aum,
    SUM(profit_contrib) as total_profit
FROM DM_CUSTOMER_360
GROUP BY stat_date, cust_type, cust_level;
```

### 2. 分区交换
```sql
-- 使用分区交换加速数据加载
-- 1. 创建临时表
CREATE TABLE DM_PRODUCT_SALES_TMP 
AS SELECT * FROM DM_PRODUCT_SALES WHERE 1=0;

-- 2. 加载数据到临时表
INSERT /*+ APPEND */ INTO DM_PRODUCT_SALES_TMP ...;

-- 3. 交换分区
ALTER TABLE DM_PRODUCT_SALES 
EXCHANGE PARTITION p_20240301 
WITH TABLE DM_PRODUCT_SALES_TMP;
```

## 🔗 相关文档

- [[【技术与工具】/Oracle/12-01-Oracle银行数仓整体架构|Oracle银行数仓整体]]
- [[【技术与工具】/Oracle/12-02-Oracle银行数仓ODS层设计|Oracle银行数仓ODS层]]
- [[【技术与工具】/Oracle/12-03-Oracle银行数仓DW层建模|Oracle银行数仓DW层建模]]
- [[【技术与工具】/Oracle/12-05-Oracle银行数仓性能优化|Oracle银行数仓性能优化]]

## 💡 最佳实践

1. **宽表设计**：适度冗余减少关联查询
2. **增量更新**：大表采用增量更新策略
3. **分区管理**：合理分区提升维护效率
4. **定期重组**：定期重组表和索引保持性能

---

*DM层直接服务于业务应用，其设计质量直接影响用户体验*