---
title: t分布
tags:
  - 统计学
  - t分布
  - 概率分布
  - 假设检验
  - Python
created: 2024-06-30
updated: 2026-10-10
difficulty: 中级
duration: 20分钟
knowledge_type: concept
target_audience:
  - 数据分析师
  - 数据科学家
  - BI分析师
stability: stable
status: active
access_tier: free
---


# 🧮 t分布（t-distribution）

> [!abstract] 📋 本节概览
> - 🎯 **学习目标**：深入理解t分布的本质、特性、与正态分布的区别及实际应用
> - 📚 **前置知识**：[[【技术与工具】/统计学/正态分布|正态分布]] | [[【技术与工具】/统计学/假设检验流程|假设检验流程]]
> - ⏱️ **预计用时**：20分钟
> - 🔧 **实践技能**：掌握t检验、置信区间估计等实际应用

## 🌟 t分布的起源与本质

> [!note] 📖 **什么是t分布？**
> t分布（Student's t-distribution）是1908年由英国统计学家William Sealy Gosset以笔名"Student"发表的一种概率分布。它解决了小样本情况下，当总体方差未知时的统计推断问题。

### 🛠️ t分布的数学定义

**数学表达式**：
$$f(t) = \frac{\Gamma(\frac{\nu+1}{2})}{\sqrt{\nu\pi}\Gamma(\frac{\nu}{2})} \left(1+\frac{t^2}{\nu}\right)^{-\frac{\nu+1}{2}}$$

其中：
- $\nu$ 是自由度（degrees of freedom, df）
- $\Gamma$ 是伽玛函数
- $t \in (-\infty, +\infty)$

**经典情境**：
当$(X_1, X_2, ..., X_n)$为来自正态分布$N(\mu, \sigma^2)$的独立同分布样本，$n\geq2$且$\sigma^2$未知时（$S^2=\sum_{i=1}^n(X_i-\bar X)^2/(n-1)$；这一结果不只适用于小样本）：

$$T = \frac{\bar{X} - \mu}{S/\sqrt{n}} \sim t_{n-1}$$

其中：
- $\bar{X}$ 是样本均值
- $S$ 是样本标准差
- $n-1$ 是自由度

```python title="t分布的基本性质展示"
import numpy as np
import matplotlib.pyplot as plt
from scipy import stats
import pandas as pd

def t_distribution_basics():
    """展示t分布的基本性质"""
    print("=== t分布的基本性质 ===")
    
    # 不同自由度的t分布
    x = np.linspace(-4, 4, 1000)
    degrees_of_freedom = [1, 2, 5, 10, 30]
    
    plt.figure(figsize=(12, 8))
    
    # 标准正态分布作为对比
    normal_pdf = stats.norm.pdf(x, 0, 1)
    plt.plot(x, normal_pdf, 'k-', linewidth=3, label='Standard Normal N(0,1)', alpha=0.8)
    
    # 不同自由度的t分布
    colors = ['red', 'blue', 'green', 'orange', 'purple']
    
    for i, df in enumerate(degrees_of_freedom):
        t_pdf = stats.t.pdf(x, df)
        plt.plot(x, t_pdf, color=colors[i], linewidth=2, 
                label=f't-distribution (df={df})', linestyle='--')
    
    plt.title('t分布 vs 标准正态分布\n随着自由度增加，t分布逐渐接近正态分布')
    plt.xlabel('t')
    plt.ylabel('概率密度')
    plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.show()
    
    # 统计性质对比
    print("\nt分布 vs 正态分布的统计性质:")
    print("=" * 50)
    
    properties_df = pd.DataFrame({
        '自由度': [1, 2, 5, 10, 30, '∞(正态分布)'],
        '均值': ['未定义', 0, 0, 0, 0, 0],
        '方差': ['未定义', '∞', '5/3≈1.67', '10/8=1.25', '30/28≈1.07', 1],
        '峰度（非超额）': ['未定义', '未定义', 9, 4, '3+6/26≈3.23', 3]
    })
    
    print(properties_df.to_string(index=False))
    
    # 数值验证
    print("\n数值验证 (使用1万个样本):")
    np.random.seed(42)
    sample_size = 10000
    
    for df in [2, 5, 10, 30]:
        if df > 2:  # 方差仅在df>2时存在
            samples = stats.t.rvs(df, size=sample_size)
            theoretical_var = df / (df - 2)
            empirical_var = np.var(samples, ddof=1)
            print(f"df={df}: 理论方差={theoretical_var:.3f}, 经验方差={empirical_var:.3f}")

t_distribution_basics()
```

## 📈 t分布的实际应用

### 🧪 单样本t检验

```python title="单样本t检验实战应用"
def one_sample_t_test():
    """单样本t检验的实际应用"""
    print("=== 单样本t检验: 新药疗效评估 ===")
    
    # 场景：新药物在小样本上的效果评估
    # 假设：旧药平均效果为85分，新药声称有显著改善
    
    np.random.seed(42)
    # 模拟15个病人使用新药后的治疗效果评分
    new_drug_scores = np.array([88, 92, 86, 90, 85, 94, 89, 91, 87, 93, 88, 90, 86, 92, 89])
    
    old_drug_mean = 85  # 旧药平均效果
    sample_size = len(new_drug_scores)
    
    print(f"研究背景:")
    print(f"  旧药平均效果: {old_drug_mean}分")
    print(f"  新药样本量: {sample_size}人")
    print(f"  新药效果数据: {new_drug_scores}")
    
    # 计算样本统计量
    sample_mean = np.mean(new_drug_scores)
    sample_std = np.std(new_drug_scores, ddof=1)
    sample_se = sample_std / np.sqrt(sample_size)
    
    print(f"\n样本统计量:")
    print(f"  样本平均: {sample_mean:.2f}分")
    print(f"  样本标准差: {sample_std:.2f}")
    print(f"  标准误: {sample_se:.2f}")
    
    # 设立假设
    print(f"\n假设设立:")
    print(f"  H₀: μ = {old_drug_mean} (新药效果与旧药相同)")
    print(f"  H₁: μ > {old_drug_mean} (新药效果更好，右尾检验)")
    
    # t统计量计算
    t_statistic = (sample_mean - old_drug_mean) / sample_se
    degrees_freedom = sample_size - 1
    
    # 计算p值（右尾检验）
    p_value = 1 - stats.t.cdf(t_statistic, degrees_freedom)
    
    print(f"\n检验统计量:")
    print(f"  t统计量: {t_statistic:.3f}")
    print(f"  自由度: {degrees_freedom}")
    print(f"  p值: {p_value:.4f}")
    
    # 临界值
    alpha = 0.05
    t_critical = stats.t.ppf(1 - alpha, degrees_freedom)
    print(f"  临界值 (α=0.05): {t_critical:.3f}")
    
    # 结论
    print(f"\n检验结论:")
    if p_value < alpha:
        print(f"  ✅ 拒绝 H₀，数据支持 H₁，但不构成对 H₁ 的证明")
        print(f"  教学示例结论：在抽样与分布假设成立时，模拟数据在α=0.05水平下支持总体平均评分高于假设基准85分；这不证明真实新药相对旧药的临床优效")
    else:
        print(f"  ❌ 无法拒绝 H₀")
        print(f"  统计结论：没有充分证据表明新药效果显著优于旧药")
    
    # 效应量计算 (Cohen's d)
    cohens_d = (sample_mean - old_drug_mean) / sample_std
    print(f"\n效应量分析:")
    print(f"  Cohen's d: {cohens_d:.3f}")
    
    if abs(cohens_d) < 0.2:
        effect_size = "低于常用小效应参考阈值"
    elif abs(cohens_d) < 0.5:
        effect_size = "小效应（经验参考）"
    elif abs(cohens_d) < 0.8:
        effect_size = "中等效应（经验参考）"
    else:
        effect_size = "大效应（经验参考，需结合领域解释）"
    
    print(f"  效应大小: {effect_size}")
    
    return t_statistic, p_value, cohens_d

# 执行测试
t_stat, p_val, effect_size = one_sample_t_test()
```

### 🔄 独立两样本t检验

```python title="独立两样本t检验比较分析"
def independent_two_sample_t_test():
    """独立两样本t检验: 比较两种教学方法的效果"""
    print("=== 独立两样本t检验: 教学方法效果比较 ===")
    
    np.random.seed(123)
    
    # 模拟数据: 传统教学 vs 翻转课堂
    traditional_scores = np.array([78, 82, 75, 80, 77, 79, 81, 76, 83, 78, 80, 79, 77, 82, 76])
    flipped_scores = np.array([85, 88, 84, 87, 83, 86, 89, 85, 90, 84, 87, 86, 88, 85, 89, 87, 84, 86])
    
    n1, n2 = len(traditional_scores), len(flipped_scores)
    
    print(f"实验设计:")
    print(f"  传统教学组: {n1}人")
    print(f"  翻转课堂组: {n2}人")
    print(f"  传统教学成绩: {traditional_scores}")
    print(f"  翻转课堂成绩: {flipped_scores}")
    
    # 描述性统计
    mean1, mean2 = np.mean(traditional_scores), np.mean(flipped_scores)
    std1, std2 = np.std(traditional_scores, ddof=1), np.std(flipped_scores, ddof=1)
    
    print(f"\n描述性统计:")
    print(f"  传统教学: 平均={mean1:.2f}, 标准差={std1:.2f}")
    print(f"  翻转课堂: 平均={mean2:.2f}, 标准差={std2:.2f}")
    print(f"  平均分数差异: {mean2 - mean1:.2f}")
    
    # 等方差性检验 (Levene's test)
    # 以下按p值切换方法仅为教学分支演示，不作为真实研究的机械选型规则。
    # 未拒绝等方差不足以支持合并方差检验；实际分析可考虑预先采用Welch检验，并结合研究设计评估适用性。
    levene_stat, levene_p = stats.levene(traditional_scores, flipped_scores)
    equal_variances = levene_p > 0.05
    
    print(f"\n等方差性检验 (Levene):")
    print(f"  统计量: {levene_stat:.3f}, p值: {levene_p:.4f}")
    print(f"  结论: {'未拒绝方差相等的原假设，不代表已证明等方差' if equal_variances else '拒绝方差相等的原假设'}")
    
    # 执行 t 检验
    if equal_variances:
        # 等方差 t 检验
        t_stat, p_value = stats.ttest_ind(flipped_scores, traditional_scores, equal_var=True)
        
        # 合并标准差
        pooled_std = np.sqrt(((n1-1)*std1**2 + (n2-1)*std2**2) / (n1+n2-2))
        se_diff = pooled_std * np.sqrt(1/n1 + 1/n2)
        df = n1 + n2 - 2
        
        print(f"\n等方差 t 检验:")
        print(f"  合并标准差: {pooled_std:.3f}")
    else:
        # Welch's t 检验（不等方差）
        t_stat, p_value = stats.ttest_ind(flipped_scores, traditional_scores, equal_var=False)
        
        # Welch-Satterthwaite 自由度
        se_diff = np.sqrt(std1**2/n1 + std2**2/n2)
        df = (std1**2/n1 + std2**2/n2)**2 / ((std1**2/n1)**2/(n1-1) + (std2**2/n2)**2/(n2-1))
        
        print(f"\nWelch's t 检验 (不等方差):")
    
    print(f"  差值标准误: {se_diff:.3f}")
    print(f"  自由度: {df:.1f}")
    
    # 假设检验结果
    print(f"\n假设检验:")
    print(f"  H₀: μ₂ - μ₁ = 0 (两种方法效果相同)")
    print(f"  H₁: μ₂ - μ₁ ≠ 0 (两种方法效果不同)")
    
    print(f"\n检验结果:")
    print(f"  t 统计量: {t_stat:.3f}")
    print(f"  p 值: {p_value:.6f}")
    
    alpha = 0.05
    if p_value < alpha:
        print(f"  ✅ 拒绝 H₀ (α={alpha})")
        print(f"  结论: 翻转课堂与传统教学效果存在显著差异")
    else:
        print(f"  ❌ 无法拒绝 H₀")
        print(f"  结论: 没有充分证据表明两种方法效果存在差异")
    
    # 95%置信区间
    t_critical = stats.t.ppf(0.975, df)  # 双尾检验
    margin_error = t_critical * se_diff
    ci_lower = (mean2 - mean1) - margin_error
    ci_upper = (mean2 - mean1) + margin_error
    
    print(f"\n平均分数差异的95%置信区间:")
    print(f"  [{ci_lower:.2f}, {ci_upper:.2f}]")
    
    # 效应量 (Cohen's d for independent samples)
    if equal_variances:
        cohens_d = (mean2 - mean1) / pooled_std
    else:
        cohens_d = (mean2 - mean1) / np.sqrt((std1**2 + std2**2) / 2)
    
    print(f"\n效应量:")
    print(f"  Cohen's d: {cohens_d:.3f}")
    
    if abs(cohens_d) < 0.2:
        effect_interpretation = "低于常用小效应参考阈值"
    elif abs(cohens_d) < 0.5:
        effect_interpretation = "小效应（经验参考）"
    elif abs(cohens_d) < 0.8:
        effect_interpretation = "中等效应（经验参考）"
    else:
        effect_interpretation = "大效应（经验参考，需结合领域解释）"
    
    print(f"  效应大小: {effect_interpretation}")
    
    return t_stat, p_value, cohens_d

# 执行比较分析
t_stat, p_val, effect = independent_two_sample_t_test()
```

### 📊 置信区间估计

```python title="基于t分布的置信区间估计"
def confidence_interval_analysis():
    """基于t分布的置信区间估计应用"""
    print("=== 置信区间估计: 市场调研应用 ===")
    
    # 场景: 新产品满意度调查
    np.random.seed(42)
    satisfaction_scores = np.array([7.2, 8.1, 6.8, 7.5, 8.3, 7.9, 6.9, 7.7, 8.0, 7.4, 7.8, 8.2, 7.1, 7.6, 8.4])
    
    n = len(satisfaction_scores)
    sample_mean = np.mean(satisfaction_scores)
    sample_std = np.std(satisfaction_scores, ddof=1)
    se = sample_std / np.sqrt(n)
    
    print(f"市场调研数据:")
    print(f"  样本量: {n}人")
    print(f"  满意度评分 (1-10分): {satisfaction_scores}")
    print(f"  样本平均: {sample_mean:.2f}")
    print(f"  样本标准差: {sample_std:.2f}")
    print(f"  标准误: {se:.3f}")
    
    # 不同置信水平的置信区间
    confidence_levels = [0.90, 0.95, 0.99]
    df = n - 1
    
    print(f"\n不同置信水平的置信区间 (自由度={df}):")
    print(f"=" * 60)
    
    for cl in confidence_levels:
        alpha = 1 - cl
        t_critical = stats.t.ppf(1 - alpha/2, df)
        margin_error = t_critical * se
        ci_lower = sample_mean - margin_error
        ci_upper = sample_mean + margin_error
        
        print(f"{cl*100:2.0f}% 置信区间: [{ci_lower:.3f}, {ci_upper:.3f}] ±{margin_error:.3f}")
        print(f"     t临界值: ±{t_critical:.3f}")
    
    # 与正态分布的对比（假设知道总体标准差）
    print(f"\n与正态分布的比较 (假设知道总体标准差):")
    print(f"=" * 60)
    
    # 假设总体标准差等于样本标准差
    assumed_population_std = sample_std
    z_se = assumed_population_std / np.sqrt(n)
    
    for cl in confidence_levels:
        alpha = 1 - cl
        # t分布
        t_critical = stats.t.ppf(1 - alpha/2, df)
        t_margin = t_critical * se
        # 正态分布
        z_critical = stats.norm.ppf(1 - alpha/2)
        z_margin = z_critical * z_se
        
        print(f"{cl*100:2.0f}%置信区间 - t分布: ±{t_margin:.3f}")
        print(f"     置信区间 - 正态分布: ±{z_margin:.3f}")
        print(f"     差异: {t_margin - z_margin:.3f} (相对差异: {((t_margin - z_margin)/z_margin)*100:+.1f}%)")
        print()
    
    # 实际意义解释
    ci_95_lower = sample_mean - stats.t.ppf(0.975, df) * se
    ci_95_upper = sample_mean + stats.t.ppf(0.975, df) * se
    
    print(f"业务解读:")
    print(f"根据{n}人的示例数据，总体平均满意度的95%置信区间为 [{ci_95_lower:.2f}, {ci_95_upper:.2f}]")
    print("在抽样与分布假设成立时，重复抽样并按相同方法构造区间，长期约95%的区间会覆盖真实总体均值；这不是当前区间包含固定均值的概率。")
    
    if ci_95_lower > 7.0:
        print(f"由于置信区间下界({ci_95_lower:.2f}) > 7.0，可以认为产品满意度较好")
    else:
        print(f"需要进一步改进产品以提高满意度")
    
    return ci_95_lower, ci_95_upper

# 执行置信区间分析
ci_lower, ci_upper = confidence_interval_analysis()
```

## 🔍 样本量计算与统计功效

```python title="基于t检验的样本量计算"
def sample_size_and_power_analysis():
    """基于t检验的样本量计算和统计功效分析"""
    print("=== 样本量计算与统计功效分析 ===")
    
    # 场景：设计一个实验来检验新的学习方法是否能将成绩从75分提高到80分
    
    # 实验参数
    mu_0 = 75  # 原假设下的均值
    mu_1 = 80  # 备择假设下的均值
    effect_size = mu_1 - mu_0  # 效应量(原始单位)
    sigma = 12  # 假设总体标准差
    alpha = 0.05  # 第一类错误率
    power = 0.8   # 期望的统计功效
    
    print(f"实验设计参数:")
    print(f"  原假设 H₀: μ = {mu_0}")
    print(f"  备择假设 H₁: μ = {mu_1}")
    print(f"  效应量: {effect_size}分")
    print(f"  假设总体标准差: {sigma}")
    print(f"  显著性水平 α: {alpha}")
    print(f"  期望统计功效: {power}")
    
    # 1. 样本量计算
    from statsmodels.stats.power import ttest_power
    from statsmodels.stats.weightstats import _tconfint_generic, _zconfint_generic
    
    # 使用Cohen's d计算样本量
    cohens_d = effect_size / sigma
    
    # 计算所需样本量
    def calculate_sample_size(effect_size_d, alpha, power):
        """Calculate required sample size for one-sample t-test"""
        from scipy.optimize import fsolve
        
        def power_function(n):
            return ttest_power(effect_size_d, n, alpha) - power
        
        n_required = fsolve(power_function, 20)[0]
        return max(int(np.ceil(n_required)), 2)
    
    n_required = calculate_sample_size(cohens_d, alpha, power)
    
    print(f"\n样本量计算:")
    print(f"  Cohen's d: {cohens_d:.3f}")
    print(f"  所需最小样本量: {n_required}")
    
    # 2. 不同样本量下的统计功效
    sample_sizes = [10, 15, 20, 25, 30, 40, 50]
    
    print(f"\n不同样本量下的统计功效:")
    print(f"=" * 40)
    
    power_results = []
    for n in sample_sizes:
        power_actual = ttest_power(cohens_d, n, alpha)
        power_results.append(power_actual)
        print(f"  n={n:2d}: 功效={power_actual:.3f} {'✅' if power_actual >= 0.8 else '❌'}")
    
    # 3. 功效曲线绘制
    plt.figure(figsize=(12, 8))
    
    # 功效曲线
    n_range = np.arange(5, 60, 1)
    power_curve = [ttest_power(cohens_d, n, alpha) for n in n_range]
    
    plt.subplot(2, 1, 1)
    plt.plot(n_range, power_curve, 'b-', linewidth=2, label=f'Cohen\'s d = {cohens_d:.2f}')
    plt.axhline(y=0.8, color='red', linestyle='--', label='Power = 0.8')
    plt.axvline(x=n_required, color='green', linestyle='--', label=f'Required n = {n_required}')
    plt.scatter(sample_sizes, power_results, color='orange', s=50, zorder=5)
    plt.xlabel('样本量')
    plt.ylabel('统计功效')
    plt.title(f'统计功效曲线 (α={alpha}, 效应量={effect_size}分)')
    plt.legend()
    plt.grid(True, alpha=0.3)
    
    # 不同效应量下的功效曲线
    effect_sizes = [3, 5, 7, 10]
    
    plt.subplot(2, 1, 2)
    for es in effect_sizes:
        cohens_d_temp = es / sigma
        power_curve_temp = [ttest_power(cohens_d_temp, n, alpha) for n in n_range]
        plt.plot(n_range, power_curve_temp, linewidth=2, label=f'效应量 = {es}分 (d={cohens_d_temp:.2f})')
    
    plt.axhline(y=0.8, color='red', linestyle='--', label='Power = 0.8')
    plt.xlabel('样本量')
    plt.ylabel('统计功效')
    plt.title('不同效应量下的统计功效曲线')
    plt.legend()
    plt.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.show()
    
    # 4. 实验成本效益分析
    print(f"\n实验成本效益分析:")
    print(f"=" * 40)
    
    cost_per_subject = 100  # 假设每个被试者成本100元
    
    for n in [20, 30, 40, 50]:
        power_n = ttest_power(cohens_d, n, alpha)
        total_cost = n * cost_per_subject
        cost_per_power = total_cost / power_n if power_n > 0 else float('inf')
        
        print(f"  n={n}: 功效={power_n:.3f}, 成本=¥{total_cost:,}, 成本/功效=¥{cost_per_power:.0f}")
    
    print(f"\n建议:")
    if n_required <= 30:
        print(f"  推荐样本量: {n_required}-{n_required+5} (兼顾功效和成本)")
    else:
        print(f"  所需样本量较大，建议考虑提高效应量或降低功效要求")
    
    return n_required, power_results

# 执行样本量和功效分析
n_req, powers = sample_size_and_power_analysis()
```

## ⚠️ t分布使用的注意事项

```python title="t分布使用中的常见问题和解决方法"
def t_distribution_assumptions_and_pitfalls():
    """分析t分布使用中的假设条件和常见错误"""
    print("=== t分布使用的注意事项和检验 ===")
    
    # 1. 正态性假设检验
    np.random.seed(42)
    
    # 生成不同分布的数据
    normal_data = np.random.normal(50, 10, 30)
    skewed_data = np.random.exponential(2, 30)  # 明显偏态
    uniform_data = np.random.uniform(40, 60, 30)  # 均匀分布
    
    datasets = [
        ('正态分布数据', normal_data),
        ('右偏分布数据', skewed_data),
        ('均匀分布数据', uniform_data)
    ]
    
    print("1. 正态性假设检验:")
    print("=" * 50)
    
    for name, data in datasets:
        # Shapiro-Wilk检验
        shapiro_stat, shapiro_p = stats.shapiro(data)
        is_normal = shapiro_p > 0.05
        
        print(f"{name}:")
        print(f"  样本量: {len(data)}")
        print(f"  Shapiro-Wilk p值: {shapiro_p:.4f}")
        print(f"  正态性检验: {'未拒绝正态性原假设，不代表已证明正态' if is_normal else '拒绝正态性原假设'}")
        
        if not is_normal:
            print(f"  ⚖️  建议: 考虑非参数检验或数据变换")
        print()
    
    # 2. 异常值对t检验的影响
    print("2. 异常值对t检验的影响:")
    print("=" * 50)
    
    # 正常数据
    normal_sample = np.array([85, 87, 89, 91, 88, 86, 90, 84, 92, 88])
    # 含异常值的数据
    outlier_sample = np.append(normal_sample, [120])  # 添加一个明显异常值
    
    mu_0 = 85  # 原假设均值
    
    for name, data in [('正常数据', normal_sample), ('含异常值数据', outlier_sample)]:
        t_stat, p_value = stats.ttest_1samp(data, mu_0)
        print(f"{name}:")
        print(f"  数据: {data}")
        print(f"  平均值: {np.mean(data):.2f}")
        print(f"  t统计量: {t_stat:.3f}")
        print(f"  p值: {p_value:.4f}")
        print(f"  结论: {'拒绝 H₀' if p_value < 0.05 else '不能拒绝 H₀'}")
        print()
    
    # 3. 小样本下的稳健性
    print("3. 小样本下的稳健性比较:")
    print("=" * 50)
    
    # 模拟小样本情况下的不同检验方法
    small_normal = np.random.normal(100, 15, 8)
    small_skewed = np.random.exponential(5, 8) + 95
    
    print(f"小样本 (n=8) 检验比较:")
    
    for name, data in [('正态分布', small_normal), ('偏态分布', small_skewed)]:
        # t检验
        t_stat, t_p = stats.ttest_1samp(data, 100)
        
        # Wilcoxon符号秩检验（非参数）
        wilcox_stat, wilcox_p = stats.wilcoxon(data - 100)
        
        print(f"\n{name}:")
        print(f"  数据: {data.round(1)}")
        print(f"  t检验 p值: {t_p:.4f}")
        print(f"  Wilcoxon p值: {wilcox_p:.4f}")
        print(f"  检验结果: {'一致' if (t_p < 0.05) == (wilcox_p < 0.05) else '不一致'}")
    
    # 4. 常见错误及建议
    print(f"\n4. t分布使用的常见错误及建议:")
    print(f"=" * 60)
    
    common_errors = [
        "❌ 不评估样本量、偏态和异常值就套用t检验",
        "✅ 结合研究目标、抽样条件和分布诊断评估适用性；变换会改变解释尺度，非参数方法也有自身假设",
        "",
        "❌ 忽略异常值的影响",
        "✅ 核查异常值成因；仅在有明确数据质量依据时排除，保留处理记录，并考虑稳健方法与敏感性分析",
        "",
        "❌ 在极小样本下忽略分布假设和低功效",
        "✅ 独立正态样本在n≥2时可使用精确t检验，但极小样本难以诊断分布且功效有限；非参数或精确方法也需满足各自条件",
        "",
        "❌ 混淆单尾和双尾检验",
        "✅ 根据研究问题明确选择检验方向",
        "",
        "❌ 忽略多重比较问题",
        "✅ 多重比较时明确检验族并进行适当校正；ANOVA可检验总体均值差异，但后续多组比较仍需控制多重检验风险"
    ]
    
    for error in common_errors:
        print(f"  {error}")
    
    return normal_data, skewed_data

# 执行分析
normal_test, skewed_test = t_distribution_assumptions_and_pitfalls()
```

## 🔗 学习路径与相关知识

### 📚 核心概念链接
- [[【技术与工具】/统计学/正态分布|正态分布]] - t分布的理论基础
- [[【技术与工具】/统计学/假设检验流程|假设检验流程]] - t检验的标准流程
- [[【技术与工具】/统计学/t检验|t检验]] - t分布的具体应用
- [[【技术与工具】/统计学/置信区间|置信区间]] - 基于t分布的区间估计

### 🔬 进阶应用
- [[【技术与工具】/统计学/卡方分布|卡方分布]] - 方差的抽样分布
- F分布 - 两个独立卡方变量各自除以自由度后的比值服从F分布；独立正态样本的样本方差比经总体方差比标准化后服从F分布
- [[【技术与工具】/统计学/方差分析（ANOVA）|方差分析（ANOVA）]] - 多组均值比较
- 非参数统计 - t检验的替代方法

### 🎨 实战技能
- [[【技术与工具】/Python/07-NumPy数值计算|Python/NumPy数值计算]] - Python数值计算基础
- [[【技术与工具】/Python/08-NumPy高级操作|Python/NumPy高级操作]] - 高级数组操作
- [[【技术与工具】/统计学/常见连续分布|常见连续分布]] - t分布在分布族中的位置

> [!tip] 💡 **学习建议**
> t分布是小样本统计推断的核心工具，建议：
> 1. **理解本质**：明白为什么需要t分布（样本小、方差未知）
> 2. **掌握条件**：数据正态性、无明显异常值、独立性
> 3. **实践应用**：在实际问题中灵活运用t检验和置信区间
> 4. **结合其他方法**：了解非参数替代方法的适用情况

#统计学 #t分布 #概率分布 #假设检验 #小样本 #Python