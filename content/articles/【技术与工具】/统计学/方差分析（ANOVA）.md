---
title: 方差分析（ANOVA）
tags:
  - 统计学
  - 方差分析
  - ANOVA
  - 假设检验
  - 基础
  - 多组比较
created: 2024-06-30
updated: 2026-10-10
difficulty: 中级
duration: 45分钟
knowledge_type: method
target_audience:
  - 数据分析师
  - 数据科学家
  - BI分析师
  - 数据运营
  - 数据产品经理
stability: stable
status: maintenance
access_tier: free
---


# 🧬 方差分析（ANOVA）

> [!abstract] 📋 本节概览
> - 🎯 **学习目标**：深入理解方差分析的原理、类型、计算方法及其在数据分析中的实际应用
> - 📚 **前置知识**：假设检验流程|假设检验流程 | 方差|方差 | 均值|均值 | t检验|t检验
> - ⏱️ **预计用时**：45分钟
> - 🛠️ **工具准备**：Python、NumPy、SciPy、Pandas、Matplotlib、Statsmodels

> [!note] 📖 **核心定义**
> **方差分析（Analysis of Variance, ANOVA）**：用于检验两个或两个以上总体均值是否存在差异的统计方法，常用于三个或三个以上组的比较。通过比较组间方差与组内方差的比值（F统计量）来判断不同组别间是否存在显著差异。
> 
> **核心思想**：如果各组均值相等，那么组间方差应该与组内方差相近；如果组间差异显著，组间方差会明显大于组内方差。

## 📐 数学原理与公式

### ANOVA的基本原理

> [!note] 📊 **方差分解原理**
> 总平方和 = 组间平方和 + 组内平方和
> 
> $$SS_{total} = SS_{between} + SS_{within}$$
> 
> 其中：
> - $SS_{total}$：总平方和
> - $SS_{between}$：组间平方和  
> - $SS_{within}$：组内平方和

### 单因素方差分析（One-way ANOVA）

**数学公式：**

1. **总平方和**：
   $$SS_{total} = \sum_{i=1}^k \sum_{j=1}^{n_i} (x_{ij} - \bar{x})^2$$

2. **组间平方和**：
   $$SS_{between} = \sum_{i=1}^k n_i(\bar{x_i} - \bar{x})^2$$

3. **组内平方和**：
   $$SS_{within} = \sum_{i=1}^k \sum_{j=1}^{n_i} (x_{ij} - \bar{x_i})^2$$

4. **F统计量**：
   $$F = \frac{MS_{between}}{MS_{within}} = \frac{SS_{between}/(k-1)}{SS_{within}/(N-k)}$$

其中：
- $k$：组数
- $n_i$：第i组的样本量
- $N$：总样本量
- $\bar{x}$：总均值
- $\bar{x_i}$：第i组均值
- $x_{ij}$：第i组第j个观测值

### ANOVA假设条件

> [!warning] ⚠️ **重要假设**
> 1. **独立性**：各观测值相互独立
> 2. **正态性**：各组数据服从正态分布
> 3. **方差齐性**：各组方差相等（同方差性）
> 4. **随机性**：样本为随机抽取

## 💻 Python实现与计算

### 基础单因素ANOVA实现

```python
import numpy as np
import pandas as pd
from scipy import stats
import matplotlib.pyplot as plt
import seaborn as sns
from statsmodels.stats.anova import anova_lm
from statsmodels.formula.api import ols
import warnings
warnings.filterwarnings('ignore')

# 设置中文字体和绘图样式
plt.rcParams['font.sans-serif'] = ['SimHei', 'Arial Unicode MS']
plt.rcParams['axes.unicode_minus'] = False
sns.set_style("whitegrid")

def perform_one_way_anova_manual(groups):
    """
    手动计算单因素方差分析
    """
    print("=== 单因素方差分析手动计算 ===")
    
 # 基本信息
    k = len(groups)  # 组数
    n_i = [len(group) for group in groups]  # 各组样本量
    N = sum(n_i)  # 总样本量
    
 # 计算各组均值和总均值
    group_means = [np.mean(group) for group in groups]
    grand_mean = np.mean([x for group in groups for x in group])
    
    print(f"组数: {k}")
    print(f"总样本量: {N}")
    print(f"各组样本量: {n_i}")
    print(f"各组均值: {[f'{mean:.2f}' for mean in group_means]}")
    print(f"总均值: {grand_mean:.2f}")
    print()
    
 # 计算平方和
 # 1. 总平方和 (SST)
    ss_total = sum(sum((x - grand_mean)**2 for x in group) for group in groups)
    
 # 2. 组间平方和 (SSB)
    ss_between = sum(n_i[i] * (group_means[i] - grand_mean)**2 for i in range(k))
    
 # 3. 组内平方和 (SSW)
    ss_within = sum(sum((x - group_means[i])**2 for x in groups[i]) for i in range(k))
    
 # 验证方差分解
    print("--- 方差分解验证 ---")
    print(f"总平方和 (SST): {ss_total:.4f}")
    print(f"组间平方和 (SSB): {ss_between:.4f}")
    print(f"组内平方和 (SSW): {ss_within:.4f}")
    print(f"SSB + SSW = {ss_between + ss_within:.4f}")
    print(f"验证: SST = SSB + SSW? {abs(ss_total - (ss_between + ss_within)) < 1e-10}")
    print()
    
 # 计算均方和自由度
    df_between = k - 1
    df_within = N - k
    df_total = N - 1
    
    ms_between = ss_between / df_between
    ms_within = ss_within / df_within
    
 # 计算F统计量
    f_statistic = ms_between / ms_within
    p_value = 1 - stats.f.cdf(f_statistic, df_between, df_within)
    
    print("--- ANOVA结果表 ---")
    print(f"{'来源':<10} {'平方和':<12} {'自由度':<8} {'均方':<12} {'F值':<12} {'P值':<12}")
    print("-" * 70)
    print(f"{'组间':<10} {ss_between:<12.4f} {df_between:<8} {ms_between:<12.4f} {f_statistic:<12.4f} {p_value:<12.4f}")
    print(f"{'组内':<10} {ss_within:<12.4f} {df_within:<8} {ms_within:<12.4f} {'':<12} {'':<12}")
    print(f"{'总计':<10} {ss_total:<12.4f} {df_total:<8} {'':<12} {'':<12} {'':<12}")
    
 # 结果解释
    alpha = 0.05
    print(f"\n--- 结果解释 (α = {alpha}) ---")
    if p_value < alpha:
        print(f"F = {f_statistic:.4f}, p = {p_value:.4f} < {alpha}")
        print("拒绝原假设：各组均值存在显著差异")
        print("结论：有证据表明总体均值不全相等；具体哪些组不同需进一步比较")
    else:
        print(f"F = {f_statistic:.4f}, p = {p_value:.4f} >= {alpha}")
        print("未拒绝原假设：没有足够证据表明各组总体均值不同")
        print("结论：没有足够证据表明各组均值不同")
    
    return {
        'f_statistic': f_statistic,
        'p_value': p_value,
        'ss_between': ss_between,
        'ss_within': ss_within,
        'ss_total': ss_total,
        'df_between': df_between,
        'df_within': df_within,
        'group_means': group_means,
        'grand_mean': grand_mean
    }

def demonstrate_anova_example():
    """
    ANOVA计算演示
    """
    print("=== 方差分析实例：不同营销策略的销售效果比较 ===\n")
    
 # 示例数据：三种营销策略的销售额（万元）
    np.random.seed(42)
    
 # 策略A：传统广告
    strategy_a = np.array([45, 52, 48, 51, 47, 50, 46, 49, 53, 48])
    
 # 策略B：社交媒体营销
    strategy_b = np.array([58, 61, 55, 59, 62, 57, 60, 56, 63, 59])
    
 # 策略C：线上线下结合
    strategy_c = np.array([52, 48, 55, 51, 49, 54, 50, 53, 47, 52])
    
    groups = [strategy_a, strategy_b, strategy_c]
    group_names = ['传统广告', '社交媒体', '线上线下结合']
    
    print("数据概览：")
    for i, (name, group) in enumerate(zip(group_names, groups)):
        print(f"{name}: 均值={np.mean(group):.2f}, 标准差={np.std(group, ddof=1):.2f}, 样本量={len(group)}")
    print()
    
 # 手动计算
    manual_result = perform_one_way_anova_manual(groups)
    
    return groups, group_names, manual_result

# 执行演示
groups_data, names, manual_results = demonstrate_anova_example()
```

### 使用SciPy进行ANOVA

```python
def scipy_anova_comparison(groups, group_names):
    """
    使用SciPy进行方差分析并与手动计算对比
    """
    print("\n=== SciPy方差分析结果对比 ===")
    
 # 使用scipy.stats.f_oneway
    f_stat, p_val = stats.f_oneway(*groups)
    
    print(f"SciPy结果:")
    print(f"F统计量: {f_stat:.4f}")
    print(f"P值: {p_val:.4f}")
    
 # 与手动计算对比
    print(f"\n对比验证:")
    print(f"手动计算 F值: {manual_results['f_statistic']:.4f}")
    print(f"SciPy F值: {f_stat:.4f}")
    print(f"差异: {abs(manual_results['f_statistic'] - f_stat):.6f}")
    
 # 效应量计算 (Eta squared)
    ss_between = manual_results['ss_between']
    ss_total = manual_results['ss_total']
    eta_squared = ss_between / ss_total
    
    print(f"\n效应量分析:")
    print(f"Eta平方 (η²): {eta_squared:.4f}")
    
 # 效应量解释
    if eta_squared < 0.01:
        effect_size = "极小"
    elif eta_squared < 0.06:
        effect_size = "小"
    elif eta_squared < 0.14:
        effect_size = "中等"
    else:
        effect_size = "大"
    
    print(f"效应量大小: {effect_size}")
    print(f"说明: 组间差异解释了总方差的 {eta_squared*100:.1f}%")
    
    return f_stat, p_val, eta_squared

# 执行SciPy对比
scipy_f, scipy_p, effect_size = scipy_anova_comparison(groups_data, names)
```

### 使用Statsmodels进行详细分析

```python
def statsmodels_anova_analysis(groups, group_names):
    """
    使用Statsmodels进行详细的ANOVA分析
    """
    print("\n=== Statsmodels详细ANOVA分析 ===")
    
 # 准备数据
    all_data = []
    for i, group in enumerate(groups):
        for value in group:
            all_data.append({'value': value, 'group': group_names[i]})
    
    df = pd.DataFrame(all_data)
    print("数据结构:")
    print(df.head())
    print(f"数据形状: {df.shape}")
    print()
    
 # 进行方差分析
    model = ols('value ~ C(group)', data=df).fit()
    anova_table = anova_lm(model, typ=2)
    
    print("ANOVA表:")
    print(anova_table)
    print()
    
 # 模型摘要
    print("模型摘要:")
    print(model.summary())
    
 # 假设检验
    print("\n=== ANOVA假设检验 ===")
    
 # 1. 正态性检验（Shapiro-Wilk test）
    print("1. 正态性检验（各组残差）:")
    residuals = model.resid
    shapiro_stat, shapiro_p = stats.shapiro(residuals)
    print(f"   Shapiro-Wilk统计量: {shapiro_stat:.4f}")
    print(f"   P值: {shapiro_p:.4f}")
    
    if shapiro_p > 0.05:
        print("   结论: 未拒绝残差正态性的原假设 (p > 0.05)，不代表已证明正态性")
    else:
        print("   结论: 残差不服从正态分布 (p <= 0.05)")
    
 # 2. 方差齐性检验（Levene test）
    print("\n2. 方差齐性检验:")
    levene_stat, levene_p = stats.levene(*groups)
    print(f"   Levene统计量: {levene_stat:.4f}")
    print(f"   P值: {levene_p:.4f}")
    
    if levene_p > 0.05:
        print("   结论: 未拒绝方差齐性的原假设 (p > 0.05)，不代表已证明各组方差相等")
    else:
        print("   结论: 各组方差不相等 (p <= 0.05)")
    
    return df, model, anova_table

# 执行Statsmodels分析
df_analysis, model_results, anova_results = statsmodels_anova_analysis(groups_data, names)
```

### ANOVA可视化

```python
def visualize_anova_results(groups, group_names, title="方差分析可视化"):
    """
    ANOVA结果可视化
    """
    fig, axes = plt.subplots(2, 3, figsize=(18, 12))
    fig.suptitle(f'{title}', fontsize=16, fontweight='bold')
    
 # 准备数据
    all_values = []
    all_groups = []
    for i, group in enumerate(groups):
        all_values.extend(group)
        all_groups.extend([group_names[i]] * len(group))
    
    df_viz = pd.DataFrame({'value': all_values, 'group': all_groups})
    
 # 1. 箱线图
    sns.boxplot(data=df_viz, x='group', y='value', ax=axes[0, 0])
    axes[0, 0].set_title('各组数据分布对比（箱线图）')
    axes[0, 0].set_xlabel('营销策略')
    axes[0, 0].set_ylabel('销售额（万元）')
    axes[0, 0].tick_params(axis='x', rotation=45)
    
 # 2. 小提琴图
    sns.violinplot(data=df_viz, x='group', y='value', ax=axes[0, 1])
    axes[0, 1].set_title('各组数据分布对比（小提琴图）')
    axes[0, 1].set_xlabel('营销策略')
    axes[0, 1].set_ylabel('销售额（万元）')
    axes[0, 1].tick_params(axis='x', rotation=45)
    
 # 3. 均值对比图
    means = [np.mean(group) for group in groups]
    stds = [np.std(group, ddof=1) for group in groups]
    
    bars = axes[0, 2].bar(group_names, means, yerr=stds, capsize=5, 
                         color=['skyblue', 'lightgreen', 'lightcoral'], alpha=0.7)
    axes[0, 2].set_title('各组均值对比（带误差棒）')
    axes[0, 2].set_xlabel('营销策略')
    axes[0, 2].set_ylabel('平均销售额（万元）')
    axes[0, 2].tick_params(axis='x', rotation=45)
    
 # 添加数值标签
    for i, (bar, mean) in enumerate(zip(bars, means)):
        axes[0, 2].text(bar.get_x() + bar.get_width()/2, bar.get_height() + stds[i] + 0.5,
                       f'{mean:.1f}', ha='center', va='bottom', fontweight='bold')
    
 # 4. 散点图
    colors = ['blue', 'green', 'red']
    for i, (group, name, color) in enumerate(zip(groups, group_names, colors)):
        x_positions = np.random.normal(i, 0.04, size=len(group))
        axes[1, 0].scatter(x_positions, group, alpha=0.6, color=color, label=name)
    
    axes[1, 0].set_xlabel('营销策略')
    axes[1, 0].set_ylabel('销售额（万元）')
    axes[1, 0].set_title('各组数据点分布')
    axes[1, 0].set_xticks(range(len(group_names)))
    axes[1, 0].set_xticklabels(group_names, rotation=45)
    axes[1, 0].legend()
    axes[1, 0].grid(True, alpha=0.3)
    
 # 5. 残差图
    grand_mean = np.mean(all_values)
    group_means = [np.mean(group) for group in groups]
    
    residuals = []
    fitted_values = []
    for i, group in enumerate(groups):
        for value in group:
            residuals.append(value - group_means[i])
            fitted_values.append(group_means[i])
    
    axes[1, 1].scatter(fitted_values, residuals, alpha=0.6)
    axes[1, 1].axhline(y=0, color='red', linestyle='--', alpha=0.8)
    axes[1, 1].set_xlabel('拟合值')
    axes[1, 1].set_ylabel('残差')
    axes[1, 1].set_title('残差图')
    axes[1, 1].grid(True, alpha=0.3)
    
 # 6. 正态性检验图（Q-Q图）
    stats.probplot(residuals, dist="norm", plot=axes[1, 2])
    axes[1, 2].set_title('残差正态性检验（Q-Q图）')
    axes[1, 2].grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.show()
    
 # 统计摘要
    print("\n=== 描述性统计摘要 ===")
    summary_stats = df_viz.groupby('group')['value'].agg(['count', 'mean', 'std', 'min', 'max']).round(2)
    print(summary_stats)

# 执行可视化
visualize_anova_results(groups_data, names, "不同营销策略销售效果ANOVA分析")
```

## 🏢 实际应用场景

### 1. A/B/C测试分析

```python
def ab_test_anova_analysis():
    """
    A/B/C测试的ANOVA分析实例
    """
    print("=== 实际案例1：A/B/C测试分析 ===")
    print("场景：电商平台测试三种不同的产品页面设计对转化率的影响\n")
    
 # 模拟A/B/C测试数据（转化率，%）
    np.random.seed(123)
    
 # 控制组（原始设计）
    control_group = np.random.normal(2.5, 0.8, 50)  # 转化率约2.5%
    control_group = np.clip(control_group, 0, None)  # 确保非负
    
 # 测试组A（新设计A）
    test_group_a = np.random.normal(3.2, 0.9, 48)   # 转化率约3.2%
    test_group_a = np.clip(test_group_a, 0, None)
    
 # 测试组B（新设计B）
    test_group_b = np.random.normal(2.8, 0.7, 52)   # 转化率约2.8%
    test_group_b = np.clip(test_group_b, 0, None)
    
    ab_groups = [control_group, test_group_a, test_group_b]
    ab_names = ['控制组', '设计A', '设计B']
    
    print("各组转化率统计：")
    for name, group in zip(ab_names, ab_groups):
        print(f"{name}: 均值={np.mean(group):.3f}%, 标准差={np.std(group, ddof=1):.3f}%, n={len(group)}")
    
 # 进行ANOVA分析
    f_stat, p_val = stats.f_oneway(*ab_groups)
    
    print(f"\nANOVA结果：")
    print(f"F统计量: {f_stat:.4f}")
    print(f"P值: {p_val:.4f}")
    
    alpha = 0.05
    if p_val < alpha:
        print(f"\n✅ 结论（α={alpha}）：")
        print("拒绝原假设，不同页面设计的转化率存在显著差异")
        print("建议进行事后比较分析，确定最佳设计方案")
        
 # 计算实际业务影响
        baseline_rate = np.mean(control_group)
        best_rate = max(np.mean(test_group_a), np.mean(test_group_b))
        improvement = (best_rate - baseline_rate) / baseline_rate * 100
        
        print(f"\n💰 业务影响评估：")
        print(f"基线转化率: {baseline_rate:.3f}%")
        print(f"最佳转化率: {best_rate:.3f}%")
        print(f"相对提升: {improvement:.1f}%")
        
 # 假设每日访问量10000，客单价500元
        daily_visitors = 10000
        avg_order_value = 500
        additional_conversions = daily_visitors * (best_rate - baseline_rate) / 100
        daily_revenue_increase = additional_conversions * avg_order_value
        
        print(f"预估日增收入: {daily_revenue_increase:.0f} 元")
        print(f"预估年增收入: {daily_revenue_increase * 365 / 10000:.0f} 万元")
    else:
        print(f"\n❌ 结论（α={alpha}）：")
        print("未拒绝原假设：当前数据未提供页面设计间平均转化率不同的充分证据")
        print("当前检验未提供设计变更带来改善的充分证据；是否存在有业务意义的改善还需结合置信区间、检验功效和研究设计判断")
    
    return ab_groups, ab_names

# 执行A/B/C测试分析
ab_test_groups, ab_test_names = ab_test_anova_analysis()
```

### 2. 质量控制分析

```python
def quality_control_anova():
    """
    制造业质量控制的ANOVA应用
    """
    print("\n=== 实际案例2：生产线质量控制分析 ===")
    print("场景：比较四条生产线的产品质量（缺陷率）是否存在显著差异\n")
    
 # 模拟四条生产线的缺陷率数据（每千件产品的缺陷数）
    np.random.seed(456)
    
    line_1 = np.random.poisson(8, 20)    # 生产线1：平均8个缺陷/千件
    line_2 = np.random.poisson(12, 18)   # 生产线2：平均12个缺陷/千件  
    line_3 = np.random.poisson(6, 22)    # 生产线3：平均6个缺陷/千件
    line_4 = np.random.poisson(10, 19)   # 生产线4：平均10个缺陷/千件
    
    qc_groups = [line_1, line_2, line_3, line_4]
    qc_names = ['生产线1', '生产线2', '生产线3', '生产线4']
    
    print("各生产线质量统计：")
    for name, group in zip(qc_names, qc_groups):
        print(f"{name}: 平均缺陷数={np.mean(group):.2f}, 标准差={np.std(group, ddof=1):.2f}, 检测批次={len(group)}")
    
 # ANOVA分析
    f_stat, p_val = stats.f_oneway(*qc_groups)
    
    print(f"\nANOVA结果：")
    print(f"F统计量: {f_stat:.4f}")
    print(f"P值: {p_val:.4f}")
    
 # 结果解释
    alpha = 0.05
    if p_val < alpha:
        print(f"\n🔍 质量分析结论（α={alpha}）：")
        print("各生产线的质量水平存在显著差异")
        print("需要进一步调查造成差异的原因：")
        print("• 设备状态和维护情况")
        print("• 操作员技能水平")
        print("• 原材料质量差异")
        print("• 生产环境条件")
        
 # 识别最佳和最差生产线
        line_means = [np.mean(group) for group in qc_groups]
        best_line_idx = np.argmin(line_means)
        worst_line_idx = np.argmax(line_means)
        
        print(f"\n📊 生产线表现：")
        print(f"模拟样本中缺陷均值最低的生产线: {qc_names[best_line_idx]} (平均缺陷数: {line_means[best_line_idx]:.2f})")
        print(f"模拟样本中缺陷均值最高的生产线: {qc_names[worst_line_idx]} (平均缺陷数: {line_means[worst_line_idx]:.2f})")
        print("此排序仅为描述性结果，不能单独证明生产线总体质量排名或改进措施的因果效果")
        
 # 改进潜力分析
        potential_improvement = line_means[worst_line_idx] - line_means[best_line_idx]
        print(f"示例改进情景: 假设最高缺陷均值生产线可达到最低均值，缺陷数差额为 {potential_improvement:.2f} 个/千件；该假设尚未证明可实现")
        
 # 成本影响评估（假设每个缺陷造成损失50元）
        daily_production = 1000  # 日产量：千件
        cost_per_defect = 50
        daily_savings = potential_improvement * daily_production * cost_per_defect
        print(f"预估日节约成本: {daily_savings:.0f} 元")
        
    else:
        print(f"\n✅ 质量分析结论（α={alpha}）：")
        print("各生产线的质量水平无显著差异")
        print("当前检验未提供组间均值不同的充分证据；是否调整仍需结合检验功效、质量标准和过程风险判断")
    
    return qc_groups, qc_names

# 执行质量控制分析
qc_test_groups, qc_test_names = quality_control_anova()
```

### 3. 教育效果评估

```python
def education_effectiveness_anova():
    """
    教育培训效果的ANOVA分析
    """
    print("\n=== 实际案例3：员工培训效果评估 ===")
    print("场景：比较三种不同培训方法对员工技能提升的效果\n")
    
 # 模拟培训效果数据（技能评分：0-100）
    np.random.seed(789)
    
 # 传统课堂培训
    classroom = np.random.normal(75, 8, 25)
    classroom = np.clip(classroom, 0, 100)
    
 # 在线学习培训
    online = np.random.normal(82, 10, 28)
    online = np.clip(online, 0, 100)
    
 # 混合式培训
    blended = np.random.normal(88, 7, 26)
    blended = np.clip(blended, 0, 100)
    
    edu_groups = [classroom, online, blended]
    edu_names = ['课堂培训', '在线学习', '混合培训']
    
    print("各培训方法效果统计：")
    for name, group in zip(edu_names, edu_groups):
        print(f"{name}: 平均得分={np.mean(group):.2f}, 标准差={np.std(group, ddof=1):.2f}, 参与人数={len(group)}")
    
 # ANOVA分析
    f_stat, p_val = stats.f_oneway(*edu_groups)
    
 # 计算效应量
    ss_between = sum(len(group) * (np.mean(group) - np.mean([x for group in edu_groups for x in group]))**2 
                    for group in edu_groups)
    ss_total = sum((x - np.mean([x for group in edu_groups for x in group]))**2 
                  for group in edu_groups for x in group)
    eta_squared = ss_between / ss_total
    
    print(f"\nANOVA结果：")
    print(f"F统计量: {f_stat:.4f}")
    print(f"P值: {p_val:.4f}")
    print(f"效应量(η²): {eta_squared:.4f}")
    
 # 结果解释和建议
    alpha = 0.05
    if p_val < alpha:
        print(f"\n📚 培训效果分析（α={alpha}）：")
        print("不同培训方法的效果存在显著差异")
        
 # 排序和推荐
        method_scores = [(name, np.mean(group)) for name, group in zip(edu_names, edu_groups)]
        method_scores.sort(key=lambda x: x[1], reverse=True)
        
        print(f"\n🏆 培训方法效果排序：")
        for i, (method, score) in enumerate(method_scores, 1):
            print(f"{i}. {method}: {score:.2f}分")
        
        best_method = method_scores[0][0]
        best_score = method_scores[0][1]
        worst_score = method_scores[-1][1]
        
        print(f"\n💡 建议：")
        print(f"• 模拟样本中'{best_method}'的平均评分最高；实际选型还需事后比较、研究设计和成本等依据")
        print(f"• 模拟样本中最高与最低平均评分相差 {best_score - worst_score:.1f} 分；该差额不是已证明的培训因果提升")
        
 # 成本效益分析（假设培训成本）
        costs = {'课堂培训': 1000, '在线学习': 300, '混合培训': 800}  # 每人培训成本（元）
        
        print(f"\n💰 成本效益分析：")
        for method, score in method_scores:
            cost = costs[method]
            roi = score / cost * 100  # 效果/成本比
            print(f"{method}: 假设成本{cost}元/人, 模拟评分{score:.1f}分, 每100元对应评分={roi:.2f}分（非投资回报率）")
        
    else:
        print(f"\n📚 培训效果分析（α={alpha}）：")
        print("不同培训方法的效果无显著差异")
        print("可根据成本和便利性选择培训方法")
    
    return edu_groups, edu_names

# 执行教育效果分析
edu_test_groups, edu_test_names = education_effectiveness_anova()
```

## 🔧 高级ANOVA技术

### 事后检验（Post-hoc Tests）

```python
def post_hoc_analysis(groups, group_names):
    """
    ANOVA事后检验分析
    """
    print("\n=== 事后检验分析 ===")
    print("若需定位具体组间差异，可根据研究问题采用适当的事后多重比较或预先规划的对比；ANOVA显著并不意味着一律必须进行事后检验\n")
    
    
 # 准备数据
    all_data = []
    all_labels = []
    for i, group in enumerate(groups):
        all_data.extend(group)
        all_labels.extend([group_names[i]] * len(group))
    
 # Tukey's HSD检验
    print("=== Tukey's HSD多重比较 ===")
    try:
 # 对于较新版本的SciPy
        from scipy.stats import tukey_hsd
        tukey_result = tukey_hsd(*groups)
        print("Tukey HSD结果:")
        print(tukey_result)
    except:
 # 对于较旧版本，使用替代方法
        print("使用pairwise t-test with Bonferroni correction:")
        from itertools import combinations
        
        n_comparisons = len(list(combinations(range(len(groups)), 2)))
        alpha_corrected = 0.05 / n_comparisons  # Bonferroni校正
        
        print(f"总比较次数: {n_comparisons}")
        print(f"校正后α水平: {alpha_corrected:.4f}")
        print()
        
        for i, j in combinations(range(len(groups)), 2):
            t_stat, p_val = stats.ttest_ind(groups[i], groups[j])
            is_significant = p_val < alpha_corrected
            
            mean_diff = np.mean(groups[i]) - np.mean(groups[j])
            
            print(f"{group_names[i]} vs {group_names[j]}:")
            print(f"  均值差异: {mean_diff:.3f}")
            print(f"  t统计量: {t_stat:.4f}")
            print(f"  p值: {p_val:.4f}")
            print(f"  显著性: {'是' if is_significant else '否'}")
            print()

# 对营销策略数据进行事后检验
post_hoc_analysis(groups_data, names)
```

### 双因素ANOVA

```python
def two_way_anova_example():
    """
    双因素方差分析示例
    """
    print("\n=== 双因素方差分析 ===")
    print("场景：研究培训方法和员工经验水平对培训效果的影响\n")
    
 # 创建双因素实验数据
    np.random.seed(999)
    
 # 因素A：培训方法（3水平）
 # 因素B：经验水平（2水平）
    
    methods = ['在线培训', '课堂培训', '实践培训']
    experience_levels = ['新员工', '有经验员工']
    
 # 生成数据
    data = []
    for method_idx, method in enumerate(methods):
        for exp_idx, experience in enumerate(experience_levels):
 # 基础效果 + 方法效果 + 经验效果 + 交互效应 + 随机误差
            base_effect = 70
            method_effects = [0, 5, 10]  # 培训方法效应
            experience_effects = [0, 8]   # 经验效应
            interaction_effects = [[0, 3], [2, 1], [4, -2]]  # 交互效应：3种培训方法 × 2种经验水平
            
            n_samples = 15
            for _ in range(n_samples):
                score = (base_effect + 
                        method_effects[method_idx] + 
                        experience_effects[exp_idx] + 
                        interaction_effects[method_idx][exp_idx] + 
                        np.random.normal(0, 5))
                
                data.append({
                    'score': score,
                    'method': method,
                    'experience': experience
                })
    
    df_2way = pd.DataFrame(data)
    
    print("数据预览:")
    print(df_2way.groupby(['method', 'experience'])['score'].agg(['count', 'mean', 'std']).round(2))
    print()
    
 # 进行双因素ANOVA
    from statsmodels.stats.anova import anova_lm
    from statsmodels.formula.api import ols
    
 # 拟合模型
    model = ols('score ~ C(method) + C(experience) + C(method):C(experience)', data=df_2way).fit()
    anova_table = anova_lm(model, typ=2)
    
    print("双因素ANOVA结果:")
    print(anova_table)
    print()
    
 # 结果解释
    print("=== 结果解释 ===")
    alpha = 0.05
    
 # 主效应A：培训方法
    p_method = anova_table.loc['C(method)', 'PR(>F)']
    print(f"培训方法主效应: F = {anova_table.loc['C(method)', 'F']:.4f}, p = {p_method:.4f}")
    if p_method < alpha:
        print("  结论: 培训方法对效果有显著影响")
    else:
        print("  结论: 培训方法对效果无显著影响")
    
 # 主效应B：经验水平
    p_experience = anova_table.loc['C(experience)', 'PR(>F)']
    print(f"经验水平主效应: F = {anova_table.loc['C(experience)', 'F']:.4f}, p = {p_experience:.4f}")
    if p_experience < alpha:
        print("  结论: 经验水平对效果有显著影响")
    else:
        print("  结论: 经验水平对效果无显著影响")
    
 # 交互效应
    p_interaction = anova_table.loc['C(method):C(experience)', 'PR(>F)']
    print(f"交互效应: F = {anova_table.loc['C(method):C(experience)', 'F']:.4f}, p = {p_interaction:.4f}")
    if p_interaction < alpha:
        print("  结论: 培训方法和经验水平存在显著交互作用")
        print("  说明: 不同经验水平的员工对培训方法的响应不同")
    else:
        print("  结论: 培训方法和经验水平无显著交互作用")
    
    return df_2way, model, anova_table

# 执行双因素ANOVA
df_two_way, model_two_way, anova_two_way = two_way_anova_example()
```

### 非参数替代方法

```python
def nonparametric_alternatives():
    """
    当ANOVA假设不满足时的非参数替代方法
    """
    print("\n=== 非参数替代方法 ===")
    print("当正态性等条件不适合普通ANOVA时，可评估以下非参数方法；这些方法仍有独立性等要求，不能解决所有假设违反问题：\n")
    
 # 使用原始营销策略数据
    groups = groups_data
    group_names = names
    
 # 1. Kruskal-Wallis检验
    print("1. Kruskal-Wallis检验（非参数ANOVA）")
    h_stat, p_kw = stats.kruskal(*groups)
    print(f"   H统计量: {h_stat:.4f}")
    print(f"   P值: {p_kw:.4f}")
    
    if p_kw < 0.05:
        print("   结论: 拒绝各组分布相同的原假设；只有在分布形状等条件合适时，才能进一步解释为位置或中位数差异")
    else:
        print("   结论: 未拒绝各组分布相同的原假设；不能据此证明各组分布或中位数相同")
    
 # 2. 中位数检验
    print("\n2. 中位数检验")
 # 将所有数据合并
    all_data = np.concatenate(groups)
    overall_median = np.median(all_data)
    
 # 计算各组高于总中位数的观测数
    above_median = []
    total_counts = []
    
    for group in groups:
        above = np.sum(group > overall_median)
        total = len(group)
        above_median.append(above)
        total_counts.append(total)
    
 # 进行卡方检验
    contingency_table = []
    for i in range(len(groups)):
        above = above_median[i]
        below = total_counts[i] - above
        contingency_table.append([above, below])
    
    chi2, p_median = stats.chi2_contingency(contingency_table)[:2]
    
    print(f"   总中位数: {overall_median:.2f}")
    print("   各组高于中位数的观测数:")
    for i, name in enumerate(group_names):
        print(f"     {name}: {above_median[i]}/{total_counts[i]}")
    print(f"   卡方统计量: {chi2:.4f}")
    print(f"   P值: {p_median:.4f}")
    
    if p_median < 0.05:
        print("   结论: 各组中位数存在显著差异")
    else:
        print("   结论: 各组中位数无显著差异")
    
 # 3. 方法选择建议
    print("\n=== 方法选择建议 ===")
    print("选择统计方法的决策树：")
    print("1. 检查ANOVA假设：")
    print("   • 正态性：Shapiro-Wilk检验")
    print("   • 方差齐性：Levene检验")
    print("   • 独立性：研究设计保证")
    print()
    print("2. 根据假设检验结果选择方法：")
    print("   • 假设满足 → 使用ANOVA")
    print("   • 正态性违反 → 使用Kruskal-Wallis检验")
    print("   • 方差不齐 → 使用Welch's ANOVA")
    print("   • 样本量小 → 考虑非参数方法")
    
    return h_stat, p_kw, chi2, p_median

# 执行非参数方法分析
kw_stat, kw_p, median_chi2, median_p = nonparametric_alternatives()
```

## ⚠️ 常见误区与注意事项

> [!warning] 🚨 **ANOVA使用注意事项**
> 
> **常见误区：**
> 1. **忽略假设检验**：未检查正态性、方差齐性等假设
> 2. **多重比较问题**：进行多次t检验而不进行α水平校正
> 3. **误解F检验结果**：F检验只能说明存在差异，不能确定具体哪组不同
> 4. **样本量与功效不足**：可靠性取决于研究设计、分布、效应量和检验功效，不能用每组少于10作为通用判据
> 5. **忽略效应量**：只关注p值而忽略实际差异的大小
> 
> **最佳实践：**
> - 根据预期效应量、显著性水平、目标功效和研究设计事前确定样本量
> - 结合研究设计、残差图和诊断检验评估假设，不将不显著的诊断检验视为假设已被证明
> - 若需定位具体组间差异，应采用适当的事后多重比较或预先规划的对比
> - 报告效应量（η²或Cohen's f）
> - 结合业务意义解释统计结果

## 📚 扩展学习资源

### 理论深化
- 📖 **《统计学：从数据到结论》** - ANOVA理论基础
- 📖 **《实验设计与分析》** - 实验设计原理
- 🎓 **在线课程**：Coursera《统计推断》

### 实践工具
- 🐍 **Python库**：SciPy、Statsmodels、Pingouin
- 📊 **专业软件**：SPSS、R、SAS
- 🔧 **在线工具**：GraphPad Prism

### 进阶主题
- 多重比较 - 事后检验详解
- 实验设计 - 如何设计ANOVA实验
- 效应量 - 统计显著性之外的考量

---

> [!tip] 💡 **学习建议**
> 1. 从单因素ANOVA开始，逐步掌握复杂设计
> 2. 重视假设检验，选择合适的分析方法
> 3. 结合实际业务场景理解统计结果
> 4. 练习Python实现和结果解释
> 5. 学会在统计显著性和实际意义间平衡

#统计学 #方差分析 #ANOVA #假设检验 #多组比较 #实验设计 #Python统计分析
