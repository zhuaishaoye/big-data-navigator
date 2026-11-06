---
title: t检验
tags:
- 统计学
- t检验
- 假设检验
- Python
created: 2024-06-30
updated: '2026-10-09'
difficulty: 中级
duration: 10分钟
knowledge_type: technical-practice
target_audience:
- 数据分析师
- 数据科学家
- BI分析师
- 数据产品经理
stability: stable
status: active
access_tier: free
---


# 🧮 t检验（t-test）

> [!abstract] 📋 本节概览
> - 🎯 **前置知识**：理解什么是t检验，为什么要用t检验，以及如何用Python实现
> - 📚 **前置知识**：[[【技术与工具】/统计学/均值|均值]] | [[【技术与工具】/统计学/标准差|标准差]] | [[【技术与工具】/统计学/假设检验流程|假设检验流程]]
> - ⏱️ **预计用时**：10分钟

## 🎯 核心概念

> [!note] 📖 **什么是t检验？**
> t检验是一种参数检验方法，用于比较样本均值与总体均值或两个样本均值之间是否存在显著差异。

**核心思想**：
- 检验样本数据是否支持某个关于均值的假设
- 基于t分布进行统计推断
- 适用于小样本或总体标准差未知的情况

## 📊 三种t检验类型详解

### 1. 🎯 单样本t检验 (One-Sample t-test)

**用途**：检验样本均值是否等于某个特定值

**适用条件**：
- 数据服从正态分布（或样本量足够大）
- 观测值相互独立
- 总体标准差未知

```python
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy import stats
import seaborn as sns

def one_sample_t_test_demo():
    """单样本t检验演示"""
    
 # 场景：某品牌声称其电池平均寿命为100小时
 # 随机抽取20个电池测试，检验是否真的是100小时
    
    np.random.seed(42)
    battery_life = np.random.normal(95, 12, 20)  # 实际均值95小时
    claimed_mean = 100
    
    print("=== 单样本t检验 ===")
    print(f"样本数据: {battery_life.round(1)}")
    print(f"样本均值: {np.mean(battery_life):.2f}小时")
    print(f"声称均值: {claimed_mean}小时")
    
 # 执行单样本t检验
    t_statistic, p_value = stats.ttest_1samp(battery_life, claimed_mean)
    
    print(f"\n检验结果:")
    print(f"t统计量: {t_statistic:.4f}")
    print(f"p值: {p_value:.4f}")
    print(f"自由度: {len(battery_life) - 1}")
    
 # 判断结果
    alpha = 0.05
    if p_value < alpha:
        print(f"结论: p值 < {alpha}，拒绝原假设，电池寿命显著不等于{claimed_mean}小时")
    else:
        print(f"结论: p值 >= {alpha}，不拒绝原假设，没有足够证据表明电池寿命不等于{claimed_mean}小时")
    
 # 置信区间
    confidence_interval = stats.t.interval(0.95, len(battery_life)-1, 
                                         loc=np.mean(battery_life), 
                                         scale=stats.sem(battery_life))
    print(f"95%置信区间: [{confidence_interval[0]:.2f}, {confidence_interval[1]:.2f}]")
    
 # 可视化
    plt.figure(figsize=(12, 4))
    
    plt.subplot(1, 2, 1)
    plt.hist(battery_life, bins=8, alpha=0.7, density=True, color='skyblue')
    plt.axvline(np.mean(battery_life), color='red', linestyle='--', label=f'样本均值: {np.mean(battery_life):.1f}')
    plt.axvline(claimed_mean, color='green', linestyle='--', label=f'声称均值: {claimed_mean}')
    plt.xlabel('电池寿命(小时)')
    plt.ylabel('密度')
    plt.title('电池寿命分布')
    plt.legend()
    
 # t分布图
    plt.subplot(1, 2, 2)
    x = np.linspace(-4, 4, 100)
    df = len(battery_life) - 1
    y = stats.t.pdf(x, df)
    plt.plot(x, y, 'b-', label=f't分布(df={df})')
    plt.axvline(t_statistic, color='red', linestyle='--', label=f't统计量: {t_statistic:.2f}')
    
 # 临界值
    critical_value = stats.t.ppf(0.975, df)  # 双侧检验
    plt.axvline(critical_value, color='orange', linestyle=':', label=f'临界值: ±{critical_value:.2f}')
    plt.axvline(-critical_value, color='orange', linestyle=':')
    
    plt.xlabel('t值')
    plt.ylabel('概率密度')
    plt.title('t分布与检验统计量')
    plt.legend()
    
    plt.tight_layout()
    plt.show()
    
    return battery_life, t_statistic, p_value

# 执行单样本t检验
sample_data, t_stat, p_val = one_sample_t_test_demo()
```

### 2. 🤝 独立样本t检验 (Independent Samples t-test)

**用途**：比较两个独立群体的均值是否相等

**适用条件**：
- 两组数据相互独立
- 数据服从正态分布
- Student独立样本t检验要求方差齐性；Welch独立样本t检验（equal_var=False）不要求两组方差相等。Levene检验可辅助评估方差差异，但未拒绝不等于证明方差相等。

```python
def independent_samples_t_test_demo():
    """独立样本t检验演示"""
    
 # 场景：比较两种教学方法的效果
    np.random.seed(42)
    
 # 传统教学法成绩
    traditional = np.random.normal(75, 10, 30)
 # 新教学法成绩
    innovative = np.random.normal(80, 12, 28)
    
    print("=== 独立样本t检验 ===")
    print(f"传统教学法 - 样本量: {len(traditional)}, 均值: {np.mean(traditional):.2f}, 标准差: {np.std(traditional, ddof=1):.2f}")
    print(f"新教学法 - 样本量: {len(innovative)}, 均值: {np.mean(innovative):.2f}, 标准差: {np.std(innovative, ddof=1):.2f}")
    
 # 方差齐性检验
    levene_stat, levene_p = stats.levene(traditional, innovative)
    print(f"\nLevene方差齐性检验: 统计量={levene_stat:.4f}, p值={levene_p:.4f}")
    
    equal_var = levene_p > 0.05
    print(f"Levene检验结论: {'未拒绝方差相等原假设，不代表证明方差相等' if equal_var else '拒绝方差相等原假设'}")
    
 # 执行独立样本t检验
    t_stat, p_value = stats.ttest_ind(traditional, innovative, equal_var=equal_var)
    
    print(f"\n独立样本t检验结果:")
    print(f"t统计量: {t_stat:.4f}")
    print(f"p值: {p_value:.4f}")
    
 # 效应量 (Cohen's d)
    pooled_std = np.sqrt(((len(traditional) - 1) * np.var(traditional, ddof=1) + 
                         (len(innovative) - 1) * np.var(innovative, ddof=1)) / 
                        (len(traditional) + len(innovative) - 2))
    cohens_d = (np.mean(innovative) - np.mean(traditional)) / pooled_std
    print(f"Cohen's d (效应量): {cohens_d:.4f}")
    
 # 效应量解释
    if abs(cohens_d) < 0.2:
        effect_size = "低于常用小效应参考阈值"
    elif abs(cohens_d) < 0.5:
        effect_size = "小（常用参考）"
    elif abs(cohens_d) < 0.8:
        effect_size = "中等（常用参考）"
    else:
        effect_size = "大（常用参考）"
    print("提示：0.2、0.5、0.8仅为常用参考阈值，实际意义需结合领域判断")
    
    print(f"效应量大小: {effect_size}")
    
    alpha = 0.05
    if p_value < alpha:
        print(f"\n结论: p值 < {alpha}，拒绝原假设，两种教学方法效果有显著差异")
    else:
        print(f"\n结论: p值 >= {alpha}，不拒绝原假设，两种教学方法效果无显著差异")
    
 # 可视化
    plt.figure(figsize=(15, 5))
    
 # 分布对比
    plt.subplot(1, 3, 1)
    plt.hist(traditional, alpha=0.6, bins=12, label='传统教学法', color='lightblue', density=True)
    plt.hist(innovative, alpha=0.6, bins=12, label='新教学法', color='lightcoral', density=True)
    plt.axvline(np.mean(traditional), color='blue', linestyle='--', label=f'传统均值: {np.mean(traditional):.1f}')
    plt.axvline(np.mean(innovative), color='red', linestyle='--', label=f'新方法均值: {np.mean(innovative):.1f}')
    plt.xlabel('成绩')
    plt.ylabel('密度')
    plt.title('两组成绩分布对比')
    plt.legend()
    
 # 箱线图
    plt.subplot(1, 3, 2)
    data_to_plot = [traditional, innovative]
    plt.boxplot(data_to_plot, labels=['传统教学法', '新教学法'])
    plt.ylabel('成绩')
    plt.title('箱线图对比')
    
 # 均值和置信区间
    plt.subplot(1, 3, 3)
    means = [np.mean(traditional), np.mean(innovative)]
    errors = [stats.sem(traditional) * stats.t.ppf(0.975, len(traditional)-1),
              stats.sem(innovative) * stats.t.ppf(0.975, len(innovative)-1)]
    
    plt.bar(['传统教学法', '新教学法'], means, yerr=errors, 
            capsize=5, alpha=0.7, color=['lightblue', 'lightcoral'])
    plt.ylabel('平均成绩')
    plt.title('均值及95%置信区间')
    
    plt.tight_layout()
    plt.show()
    
    return traditional, innovative, t_stat, p_value

# 执行独立样本t检验
group1, group2, t_stat_ind, p_val_ind = independent_samples_t_test_demo()
```

### 3. 👥 配对样本t检验 (Paired Samples t-test)

**用途**：比较同一群体在两个不同条件下的均值差异

**适用条件**：
- 观测对象相同（配对数据）
- 差值服从正态分布
- 配对观测相互独立

```python
def paired_samples_t_test_demo():
    """配对样本t检验演示"""
    
 # 场景：比较培训前后员工绩效得分
    np.random.seed(42)
    n_employees = 25
    
 # 培训前得分
    before_training = np.random.normal(70, 12, n_employees)
    
 # 培训后得分（假设有5分的提升加上随机变动）
    improvement = np.random.normal(5, 8, n_employees)
    after_training = before_training + improvement
    
    print("=== 配对样本t检验 ===")
    print(f"员工数量: {n_employees}")
    print(f"培训前平均得分: {np.mean(before_training):.2f}")
    print(f"培训后平均得分: {np.mean(after_training):.2f}")
    print(f"平均提升: {np.mean(after_training - before_training):.2f}")
    
 # 计算差值
    differences = after_training - before_training
    print(f"差值标准差: {np.std(differences, ddof=1):.2f}")
    
 # 执行配对样本t检验
    t_stat, p_value = stats.ttest_rel(before_training, after_training)
    
    print(f"\n配对样本t检验结果:")
    print(f"t统计量: {t_stat:.4f}")
    print(f"p值: {p_value:.4f}")
    print(f"自由度: {len(differences) - 1}")
    
 # 效应量 (配对样本的Cohen's d)
    cohens_d_paired = np.mean(differences) / np.std(differences, ddof=1)
    print(f"Cohen's d (配对): {cohens_d_paired:.4f}")
    
    alpha = 0.05
    if p_value < alpha:
        print(f"\n结论: p值 < {alpha}，拒绝平均差值为零的原假设；模拟数据中培训后减培训前的平均差值为{np.mean(differences):.2f}。差异方向需结合该差值判断，单组前后比较不能证明培训的因果效果。")
    else:
        print(f"\n结论: p值 >= {alpha}，不拒绝平均差值为零的原假设，尚无足够证据说明模拟数据的前后平均得分存在差异；这不证明培训无效。")
    
 # 差值的置信区间
    ci = stats.t.interval(0.95, len(differences)-1, 
                         loc=np.mean(differences), 
                         scale=stats.sem(differences))
    print(f"提升效果的95%置信区间: [{ci[0]:.2f}, {ci[1]:.2f}]")
    
 # 可视化
    plt.figure(figsize=(15, 5))
    
 # 配对数据散点图
    plt.subplot(1, 3, 1)
    plt.scatter(before_training, after_training, alpha=0.6)
    
 # 添加对角线
    min_val = min(min(before_training), min(after_training))
    max_val = max(max(before_training), max(after_training))
    plt.plot([min_val, max_val], [min_val, max_val], 'r--', alpha=0.8, label='y=x')
    
    plt.xlabel('培训前得分')
    plt.ylabel('培训后得分')
    plt.title('培训前后得分对比')
    plt.legend()
    
 # 差值分布
    plt.subplot(1, 3, 2)
    plt.hist(differences, bins=10, alpha=0.7, color='green', density=True)
    plt.axvline(np.mean(differences), color='red', linestyle='--', 
               label=f'平均差值: {np.mean(differences):.2f}')
    plt.axvline(0, color='black', linestyle='-', alpha=0.5, label='无差异线')
    plt.xlabel('得分差值（培训后-培训前）')
    plt.ylabel('密度')
    plt.title('得分差值分布')
    plt.legend()
    
 # 配对线图
    plt.subplot(1, 3, 3)
    employee_ids = range(1, n_employees + 1)
    plt.plot(employee_ids, before_training, 'bo-', alpha=0.6, label='培训前')
    plt.plot(employee_ids, after_training, 'ro-', alpha=0.6, label='培训后')
    
 # 连接配对点
    for i in range(n_employees):
        plt.plot([employee_ids[i], employee_ids[i]], 
                [before_training[i], after_training[i]], 
                'k-', alpha=0.3)
    
    plt.xlabel('员工编号')
    plt.ylabel('绩效得分')
    plt.title('个体变化轨迹')
    plt.legend()
    
    plt.tight_layout()
    plt.show()
    
    return before_training, after_training, differences, t_stat, p_value

# 执行配对样本t检验
before, after, diffs, t_stat_paired, p_val_paired = paired_samples_t_test_demo()
```

## 🎯 t检验选择指南

### 📋 决策流程图

```python
def choose_t_test_type():
    """帮助选择合适的t检验类型"""
    
    decision_tree = {
        "问题1": "你要比较的是什么？",
        "选项1a": "一个样本均值与已知值",
        "结果1a": "→ 使用单样本t检验",
        "选项1b": "两个群体的均值",
        "问题2": "这两个群体是独立的还是相关的？",
        "选项2a": "独立的（不同的人/对象）",
        "结果2a": "→ 使用独立样本t检验",
        "选项2b": "相关的（同一批人的前后对比）",
        "结果2b": "→ 使用配对样本t检验"
    }
    
    print("=== t检验类型选择指南 ===")
    print(f"{decision_tree['问题1']}")
    print(f"  A. {decision_tree['选项1a']} {decision_tree['结果1a']}")
    print(f"  B. {decision_tree['选项1b']}")
    print(f"     {decision_tree['问题2']}")
    print(f"     - {decision_tree['选项2a']} {decision_tree['结果2a']}")
    print(f"     - {decision_tree['选项2b']} {decision_tree['结果2b']}")

choose_t_test_type()
```

### 🏢 实际应用场景对照

| 检验类型 | 典型场景 | 例子 | Python函数 |
|----------|----------|------|------------|
| 单样本t检验 | 样本均值与标准值比较 | 产品质量是否达标 | `stats.ttest_1samp()` |
| 独立样本t检验 | 两个独立群体比较 | 男女收入差异 | `stats.ttest_ind()` |
| 配对样本t检验 | 同一群体前后比较 | 药物治疗效果 | `stats.ttest_rel()` |

## 📐 t检验的假设与条件检验

### 🔍 正态性检验

```python
def check_normality():
    """检验数据的正态性"""
    
 # 生成不同分布的数据
    np.random.seed(42)
    normal_data = np.random.normal(50, 10, 100)
    skewed_data = np.random.exponential(2, 100)
    
    datasets = {
        '正态分布数据': normal_data,
        '偏态分布数据': skewed_data
    }
    
    print("=== 正态性检验 ===")
    
    for name, data in datasets.items():
 # Shapiro-Wilk检验
        shapiro_stat, shapiro_p = stats.shapiro(data)
        
 # Kolmogorov-Smirnov检验
        ks_stat, ks_p = stats.kstest(data, 'norm', args=(np.mean(data), np.std(data, ddof=1)))
        
        print(f"\n{name}:")
        print(f"  Shapiro-Wilk检验: 统计量={shapiro_stat:.4f}, p值={shapiro_p:.4f}")
        print(f"  K-S统计量={ks_stat:.4f}；因正态分布参数由同一样本估计，此处普通K-S p值不用于正态性判断")
        print(f"  Shapiro-Wilk检验结论: {'未拒绝正态性原假设，不代表证明正态性' if shapiro_p > 0.05 else '拒绝正态性原假设'}")
    
 # 可视化
    plt.figure(figsize=(12, 8))
    
    for i, (name, data) in enumerate(datasets.items(), 1):
 # 直方图 + 正态曲线
        plt.subplot(2, 2, i)
        plt.hist(data, bins=20, density=True, alpha=0.7, color='skyblue')
        
 # 拟合正态曲线
        mu, sigma = np.mean(data), np.std(data, ddof=1)
        x = np.linspace(data.min(), data.max(), 100)
        plt.plot(x, stats.norm.pdf(x, mu, sigma), 'r-', linewidth=2, label='理论正态分布')
        plt.title(f'{name}')
        plt.legend()
        
 # Q-Q图
        plt.subplot(2, 2, i+2)
        stats.probplot(data, dist="norm", plot=plt)
        plt.title(f'{name} Q-Q图')
    
    plt.tight_layout()
    plt.show()

check_normality()
```

## ⚠️ 使用注意事项与常见误区

### 🚫 常见错误

```python
def common_mistakes_demo():
    """演示t检验的常见错误"""
    
    print("=== t检验常见错误 ===")
    
 # 错误1：样本量过小
    small_sample = np.random.normal(50, 10, 5)
    print("错误1: 样本量过小")
    print(f"样本量为 {len(small_sample)} 的数据，t检验结果可能不可靠")
    print("建议: 20-30个不是通用最低门槛；小样本在独立性和正态性条件满足时仍可使用t检验，样本量应结合预期效应、变异程度、显著性水平与统计功效确定")
    
 # 错误2：违反独立性假设
    print("\n错误2: 违反独立性假设")
    print("例：用独立样本t检验比较同一批学生的期中期末成绩")
    print("应该用：配对样本t检验")
    
 # 错误3：忽略方差齐性
    print("\n错误3: 忽略方差齐性假设")
    group1 = np.random.normal(50, 5, 30)   # 方差小
    group2 = np.random.normal(50, 20, 30)  # 方差大
    
    levene_stat, levene_p = stats.levene(group1, group2)
    print(f"Levene检验p值={levene_p:.4f}；{'拒绝方差相等原假设' if levene_p < 0.05 else '未拒绝方差相等原假设，不代表证明方差相等'}")
    print("应该使用: equal_var=False 参数")
    
 # 错误4：多重比较
    print("\n错误4: 多重比较问题")
    print("同时进行多个t检验会增加犯第一类错误的概率")
    print("解决方案: Bonferroni校正或其他多重比较方法")

common_mistakes_demo()
```

### 💡 最佳实践建议

1. **事前检查**：
   - 验证数据分布（正态性）
   - 检查独立性假设
   - 确认样本量足够

2. **选择合适的检验**：
   - 根据研究设计选择t检验类型
   - 考虑方差齐性问题
   - 报告效应量

3. **结果解释**：
   - 不仅关注p值，还要看实际意义
   - 报告置信区间
   - 考虑统计功效

4. **替代方案**：
   - 非正态数据：考虑非参数检验
   - 多组比较：使用方差分析(ANOVA)
   - 小样本：谨慎解释结果

## 🔗 相关知识
- [[【技术与工具】/Python/07-NumPy数值计算|NumPy数值计算]]
- [[【技术与工具】/Python/08-NumPy高级操作|NumPy高级操作]]
- [[【技术与工具】/统计学/假设检验流程|假设检验流程]]
- [[【技术与工具】/统计学/t分布|t分布]]
- [[【技术与工具】/统计学/正态分布|正态分布]]
- [[【技术与工具】/统计学/方差分析（ANOVA）|方差分析（ANOVA）]]
- [[【技术与工具】/统计学/置信区间|置信区间]]
- 效应量

#统计学 #t检验 #假设检验 #Python
