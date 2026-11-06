---
title: GMV - 商品交易总额核心指标
tags:
- 业务指标
- GMV
- 电商指标
- 交易总额
difficulty: 基础
duration: 15分钟
knowledge_type: concept
stability: slow-changing
status: maintenance
access_tier: free
target_audience:
- 数据分析师
- 数据运营
- 数据产品经理
- BI分析师
updated: '2026-10-09'
---


# 💰 GMV (商品交易总额) - 电商核心指标

> [!info] 💡 **术语速览**
> **GMV (Gross Merchandise Volume)** = 商品交易总额，指定时间内平台所有订单商品金额总和，是衡量电商平台规模的核心指标。

## 🗣️ 沟通障碍

开会时同事提到GMV，自己一脸懵逼，插不上话，很尴尬。

在数字化工作环境中，这样的场景每天都在发生。掌握相关知识不是为了应付考试，而是为了更好地解决实际问题。
## 💡 核心概念解释

> [!abstract] 🎯 什么是GMV？
> GMV (Gross Merchandise Volume) = 商品交易总额
> 
> 指定时间内平台上所有订单的商品金额总和

**计算公式**：
```ini
GMV = 订单数量 × 平均客单价
GMV = 用户数 × 购买转化率 × 购买用户人均订单数 × 平均客单价
```

**GMV构成要素**：
- **已支付订单**：完成支付的订单金额
- **未支付订单**：提交但未支付的订单（部分统计）
- **退款处理**：各平台处理方式不同

## 🔍 实际演示

### 📱 电商平台GMV分析

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from datetime import datetime, timedelta

# 创建电商GMV数据
np.random.seed(42)
dates = pd.date_range('2024-01-01', periods=365, freq='D')

# 模拟电商数据
ecommerce_data = pd.DataFrame({
    'date': dates,
    'orders': np.random.poisson(1200, 365) + np.random.randint(-200, 300, 365),
    'avg_order_value': np.random.normal(150, 30, 365),
    'category': np.random.choice(['服装', '数码', '家居', '美妆'], 365, 
                                p=[0.4, 0.25, 0.2, 0.15])
})

# 确保数值为正
ecommerce_data['orders'] = ecommerce_data['orders'].clip(lower=100)
ecommerce_data['avg_order_value'] = ecommerce_data['avg_order_value'].clip(lower=50)

# 计算GMV
ecommerce_data['gmv'] = ecommerce_data['orders'] * ecommerce_data['avg_order_value']

# 添加时间维度
ecommerce_data['month'] = ecommerce_data['date'].dt.month
ecommerce_data['quarter'] = ecommerce_data['date'].dt.quarter
ecommerce_data['weekday'] = ecommerce_data['date'].dt.day_name()

print("📊 电商GMV数据预览")
print(ecommerce_data.head())

# GMV基础统计
print(f"\n💰 GMV基础统计")
print(f"样本期总GMV: ¥{ecommerce_data['gmv'].sum():,.0f}")
print(f"日均GMV: ¥{ecommerce_data['gmv'].mean():,.0f}")
print(f"GMV最高日: ¥{ecommerce_data['gmv'].max():,.0f}")
print(f"GMV最低日: ¥{ecommerce_data['gmv'].min():,.0f}")

# 月度GMV趋势
monthly_gmv = ecommerce_data.groupby('month').agg({
    'gmv': 'sum',
    'orders': 'sum',
    'avg_order_value': 'mean'
}).round(2)

print(f"\n📈 月度GMV表现")
print(monthly_gmv)

# GMV增长率计算
monthly_gmv['gmv_growth'] = monthly_gmv['gmv'].pct_change() * 100
print(f"\n📊 月度GMV增长率")
for month, growth in monthly_gmv['gmv_growth'].items():
    if not np.isnan(growth):
        print(f"{month}月: {growth:+.1f}%")
```

### 🎯 GMV拆解分析

```python
# GMV拆解：流量 × 转化率 × 客单价；此处转化率按订单数/流量计算
def gmv_decomposition(traffic, conversion_rate, avg_order_value):
    """GMV拆解分析"""
    gmv = traffic * conversion_rate * avg_order_value
    
    return {
        'gmv': gmv,
        'orders': traffic * conversion_rate,
        'traffic': traffic,
        'conversion_rate': conversion_rate,
        'avg_order_value': avg_order_value
    }

# 模拟不同渠道的GMV贡献
channels = {
    '搜索引擎': {'traffic': 100000, 'conversion_rate': 0.025, 'aov': 180},
    '社交媒体': {'traffic': 80000, 'conversion_rate': 0.018, 'aov': 120},
    '直接访问': {'traffic': 60000, 'conversion_rate': 0.035, 'aov': 200},
    '邮件营销': {'traffic': 40000, 'conversion_rate': 0.045, 'aov': 160},
    '付费广告': {'traffic': 50000, 'conversion_rate': 0.028, 'aov': 140}
}

channel_analysis = {}
total_gmv = 0

print("📊 渠道GMV拆解分析")
print("渠道       流量    转化率  客单价   订单数    GMV")
print("-" * 55)

for channel, metrics in channels.items():
    analysis = gmv_decomposition(
        metrics['traffic'], 
        metrics['conversion_rate'], 
        metrics['aov']
    )
    
    channel_analysis[channel] = analysis
    total_gmv += analysis['gmv']
    
    print(f"{channel:<8} {metrics['traffic']:>7,} {metrics['conversion_rate']:>6.1%} "
          f"¥{metrics['aov']:>6} {analysis['orders']:>7.0f} ¥{analysis['gmv']:>10,.0f}")

print(f"\n💰 总GMV: ¥{total_gmv:,.0f}")

# 渠道贡献度分析
print(f"\n📈 渠道GMV贡献度")
for channel, analysis in channel_analysis.items():
    contribution = analysis['gmv'] / total_gmv * 100
    print(f"{channel}: {contribution:.1f}%")
```

### 💡 GMV优化实战案例

```python
# 案例：通过优化转化率和客单价提升GMV
baseline_metrics = {
    'monthly_traffic': 500000,
    'conversion_rate': 0.025,
    'avg_order_value': 150
}

# 计算基准GMV
baseline_gmv = (baseline_metrics['monthly_traffic'] * 
                baseline_metrics['conversion_rate'] * 
                baseline_metrics['avg_order_value'])

print("🎯 GMV优化方案分析")
print(f"基准GMV: ¥{baseline_gmv:,.0f}")

# 优化方案
optimization_scenarios = {
    '提升转化率': {
        'traffic': 500000,
        'conversion_rate': 0.030,  # +20%
        'aov': 150,
        'strategy': '优化商品页面、简化购买流程'
    },
    '提升客单价': {
        'traffic': 500000,
        'conversion_rate': 0.025,
        'aov': 180,  # +20%
        'strategy': '推荐关联商品、满减活动'
    },
    '增加流量': {
        'traffic': 600000,  # +20%
        'conversion_rate': 0.025,
        'aov': 150,
        'strategy': '加大营销投入、SEO优化'
    },
    '综合优化': {
        'traffic': 550000,  # +10%
        'conversion_rate': 0.028,  # +12%
        'aov': 165,  # +10%
        'strategy': '全方位优化策略'
    }
}
``` 