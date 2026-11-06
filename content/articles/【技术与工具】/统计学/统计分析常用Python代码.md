---
title: 统计分析常用Python代码
tags:
- 统计学
- Python
- 代码
- 基础
created: 2024-06-30
updated: '2026-10-09'
difficulty: 基础
duration: 12分钟
knowledge_type: reference
target_audience:
- 数据从业者
- 数据分析师
- BI分析师
- 数据科学家
stability: slow-changing
status: active
access_tier: free
---


# 🐍 统计分析常用Python代码

> [!abstract] 📋 本节概览
> - 🎯 **学习目标**：掌握常见统计分析任务的Python实现方法
> - 📚 **前置知识**：描述性统计|描述性统计 | 概率的基本概念|概率的基本概念
> - ⏱️ **预计用时**：12分钟

# 学习目标
> [!note] 📖 **为什么要学Python统计分析代码？**
> 用Python写统计分析代码，就像用计算器一样方便，能让数据分析又快又准。

**生活例子：**
- 用Python一行代码就能算出平均分、标准差、相关系数。
- 做问卷调查、实验分析、数据可视化都离不开Python。

## 🛠️ 常用统计分析任务与代码
| 任务 | Python代码 | 用到的类库 | 学习目标 |
|---|---|---|---|---|
| 计算均值 | `np.mean(x)` | numpy | 均值\|均值 |
| 计算方差 | `np.var(x, ddof=1)` | numpy | 方差\|方差 |
| 计算标准差 | `np.std(x, ddof=1)` | numpy | 标准差\|标准差 |
| 相关系数 | `np.corrcoef(x, y)[0,1]` | numpy | 皮尔逊相关系数\|皮尔逊相关系数 |
| 统计学 | `scipy.stats.ttest_ind(x1, x2)` | scipy | t检验\|t检验 |
| 统计学 | `scipy.stats.chisquare(obs, exp)` | scipy | 卡方检验\|卡方检验 |
| 画直方图 | `plt.hist(x)` | matplotlib | 直方图\|直方图 |
| 画箱线图 | `sns.boxplot(y=x)` | seaborn | 箱线图\|箱线图 |
| 画散点图 | `plt.scatter(x, y)` | matplotlib | 散点图\|散点图 |

> [!tip] 💡 推荐先学会numpy、pandas、matplotlib、scipy、seaborn等库的基本用法。

## 🔗 相关知识
- [[【技术与工具】/Python/07-NumPy数值计算|Python/NumPy数值计算]]
- [[【技术与工具】/Python/09-Pandas数据结构|Python/Pandas数据结构]]
- [[【技术与工具】/Python/13-Matplotlib基础|Python/Matplotlib]]
- [[【技术与工具】/Python/14-Seaborn统计图|Python/Seaborn统计图]]
- [[【技术与工具】/Python/18-机器学习基础|Python/机器学习]]
- [[【技术与工具】/统计学/描述性统计|描述性统计]]
- [[【技术与工具】/统计学/概率的基本概念|概率的基本概念]]

#统计学 #Python #代码 #数据分析 #基础
