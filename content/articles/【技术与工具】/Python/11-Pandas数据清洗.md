---
title: Pandas数据清洗与质量管理
tags:
  - Pandas
  - 数据清洗
  - 缺失值处理
  - 异常值检测
  - 数据质量
  - ETL
created: 2024-06-29
updated: 2026-10-10
difficulty: 中级
duration: 120分钟
knowledge_type: technical-practice
target_audience:
  - 数据分析师
  - 数据开发工程师
  - 数据治理工程师
  - 数据科学家
  - BI分析师
stability: slow-changing
status: maintenance
access_tier: free
---


# Pandas数据清洗与质量管理

> [!abstract] 学习目标
> **核心知识**：
> - 数据质量评估的系统方法论
> - 缺失值处理的高级策略（插值、ML预测）
> - 异常值检测算法（IQR、Z-score、Isolation Forest）
> - 数据标准化和归一化技术
> - 企业级数据清洗流水线设计
> 
> **技术要求**：
> - 熟练掌握[[【技术与工具】/Python/09-Pandas数据结构|Pandas数据结构]]
> - 基础统计学概念
> - 数据处理最佳实践

## 数据质量管理概述

数据清洗（Data Cleaning）是数据预处理的核心环节，旨在识别、纠正或移除数据集中的错误、不一致和无效记录。在企业数据处理流程中，数据清洗可能占据较多时间；实际投入比例取决于数据质量、项目范围和业务要求，本文不提供可用于项目估算的统一比例。

### 数据质量的六个维度

1. **完整性（Completeness）**：数据记录的完整程度，无关键字段缺失
2. **准确性（Accuracy）**：数据值与真实值的一致程度
3. **一致性（Consistency）**：同一实体在不同系统中的表示一致性
4. **唯一性（Uniqueness）**：避免重复记录
5. **及时性（Timeliness）**：数据的时效性和更新频率
6. **有效性（Validity）**：数据符合业务规则和约束条件

### 数据问题的常见类型

- **结构性问题**：数据类型不匹配、格式不统一
- **内容性问题**：缺失值、异常值、重复记录
- **语义性问题**：编码不一致、分类标准不统一
- **业务逻辑问题**：违反业务规则的数据

## 数据质量评估框架

### 系统性数据诊断

数据评估需要遵循系统性的方法论，综合考虑数据的结构、内容和业务逻辑三个层面。

```python
import pandas as pd
import numpy as np
from scipy import stats
import warnings
warnings.filterwarnings('ignore')

class DataQualityAssessment:
    """
    数据质量评估类
    提供系统性的数据质量评估方法
    """
    
    def __init__(self, df):
        self.df = df.copy()
        self.shape = df.shape
        self.columns = df.columns
        self.dtypes = df.dtypes
        
    def comprehensive_profile(self):
        """综合数据质量评估报告"""
        report = {
            'basic_info': self._basic_info(),
            'completeness': self._assess_completeness(),
            'uniqueness': self._assess_uniqueness(),
            'validity': self._assess_validity(),
            'consistency': self._assess_consistency(),
            'distribution': self._assess_distribution()
        }
        return report
    
    def _basic_info(self):
        """基本信息统计"""
        return {
            'rows': self.shape[0],
            'columns': self.shape[1],
            'memory_usage_mb': self.df.memory_usage(deep=True).sum() / 1024**2,
            'dtypes_distribution': self.dtypes.value_counts().to_dict()
        }
    
    def _assess_completeness(self):
        """评估数据完整性"""
        missing_stats = self.df.isnull().sum()
        missing_pct = (missing_stats / len(self.df)) * 100
        
        return {
            'total_missing': missing_stats.sum(),
            'missing_by_column': missing_stats.to_dict(),
            'missing_percentage': missing_pct.to_dict(),
            'completeness_score': ((len(self.df) * len(self.df.columns) - missing_stats.sum()) / 
                                   (len(self.df) * len(self.df.columns))) * 100
        }
    
    def _assess_uniqueness(self):
        """评估数据唯一性"""
        duplicate_rows = self.df.duplicated().sum()
        unique_stats = {}
        
        for col in self.df.columns:
            unique_count = self.df[col].nunique()
            total_count = self.df[col].count()  # 非空值数量
            unique_stats[col] = {
                'unique_count': unique_count,
                'unique_ratio': unique_count / total_count if total_count > 0 else 0,
                'is_primary_key_candidate': len(self.df) > 0 and total_count == len(self.df) and unique_count == total_count
            }
        
        return {
            'duplicate_rows': duplicate_rows,
            'duplicate_percentage': (duplicate_rows / len(self.df)) * 100,
            'unique_stats_by_column': unique_stats
        }
    
    def _assess_validity(self):
        """评估数据有效性"""
        validity_issues = {}
        
        for col in self.df.columns:
            col_issues = []
            series = self.df[col]
            
            # 检查空字符串
            if series.dtype == 'object':
                empty_strings = (series == '').sum()
                whitespace_only = series.astype(str).str.strip().eq('').sum() - empty_strings
                if empty_strings > 0:
                    col_issues.append(f'empty_strings: {empty_strings}')
                if whitespace_only > 0:
                    col_issues.append(f'whitespace_only: {whitespace_only}')
            
            # 检查数值型异常
            if pd.api.types.is_numeric_dtype(series):
                infinite_count = np.isinf(series).sum()
                if infinite_count > 0:
                    col_issues.append(f'infinite_values: {infinite_count}')
            
            if col_issues:
                validity_issues[col] = col_issues
        
        return validity_issues
    
    def _assess_consistency(self):
        """评估数据一致性"""
        consistency_issues = {}
        
        for col in self.df.columns:
            if self.df[col].dtype == 'object':
                # 检查大小写不一致
                values = self.df[col].dropna().astype(str)
                if len(values) > 0:
                    case_inconsistent = values.nunique() != values.str.lower().nunique()
                    if case_inconsistent:
                        consistency_issues[col] = 'case_inconsistency'
        
        return consistency_issues
    
    def _assess_distribution(self):
        """评估数据分布"""
        distribution_stats = {}
        
        for col in self.df.columns:
            if pd.api.types.is_numeric_dtype(self.df[col]):
                series = self.df[col].dropna()
                if len(series) > 0:
                    distribution_stats[col] = {
                        'mean': series.mean(),
                        'std': series.std(),
                        'min': series.min(),
                        'max': series.max(),
                        'skewness': series.skew(),
                        'kurtosis': series.kurtosis(),
                        'outlier_count_iqr': self._detect_outliers_iqr(series),
                        'outlier_count_zscore': self._detect_outliers_zscore(series)
                    }
        
        return distribution_stats
    
    def _detect_outliers_iqr(self, series):
        """使用IQR方法检测异常值"""
        Q1 = series.quantile(0.25)
        Q3 = series.quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR
        return ((series < lower_bound) | (series > upper_bound)).sum()
    
    def _detect_outliers_zscore(self, series, threshold=3):
        """使用Z-score方法检测异常值"""
        z_scores = np.abs(stats.zscore(series))
        return (z_scores > threshold).sum()

# 使用示例
def demonstrate_quality_assessment():
    # 创建测试数据
    test_data = pd.DataFrame({
        'id': [1, 2, 3, 4, 5, 1],  # 重复值
        'name': ['Alice', 'Bob', '', '  ', 'Charlie', 'Alice'],  # 空值和空格
        'age': [25, -5, 150, 30, np.nan, 25],  # 异常值和缺失值
        'salary': [50000, 60000, 1000000, 55000, 52000, 50000],  # 异常值
        'email': ['alice@company.com', 'invalid-email', 'bob@company.com', None, 'charlie@company.com', 'alice@company.com']
    })
    
    assessor = DataQualityAssessment(test_data)
    quality_report = assessor.comprehensive_profile()
    
    print("数据质量评估报告:")
    print("="*50)
    
    print(f"基本信息:")
    basic = quality_report['basic_info']
    print(f"  行数: {basic['rows']}, 列数: {basic['columns']}")
    print(f"  内存使用: {basic['memory_usage_mb']:.2f} MB")
    
    print(f"\n完整性评估:")
    completeness = quality_report['completeness']
    print(f"  完整性得分: {completeness['completeness_score']:.2f}%")
    
    print(f"\n唯一性评估:")
    uniqueness = quality_report['uniqueness']
    print(f"  重复行数: {uniqueness['duplicate_rows']}")
    
    return quality_report

# demonstrate_quality_assessment()
```

### 高级数据分析技术

```python
class AdvancedDataProfiler:
    """
    高级数据分析器
    提供深入的数据特征分析和异常检测
    """
    
    def __init__(self, df):
        self.df = df
        
    def detect_data_types_issues(self):
        """检测数据类型问题"""
        type_issues = {}
        
        for col in self.df.columns:
            issues = []
            series = self.df[col]
            
            # 检查数值型列中的非数字值
            if series.dtype == 'object':
                # 尝试转换为数值型
                numeric_converted = pd.to_numeric(series, errors='coerce')
                non_numeric_count = numeric_converted.isna().sum() - series.isna().sum()
                
                if non_numeric_count > 0 and non_numeric_count < len(series) * 0.5:
                    issues.append(f'mixed_numeric_text: {non_numeric_count} non-numeric values')
                
                # 检查日期格式
                try:
                    date_converted = pd.to_datetime(series, errors='coerce')
                    valid_dates = date_converted.notna().sum()
                    if valid_dates > len(series) * 0.3:
                        issues.append(f'potential_datetime_column: {valid_dates} valid dates')
                except:
                    pass
            
            if issues:
                type_issues[col] = issues
                
        return type_issues
    
    def analyze_categorical_data(self):
        """分析分类数据特征"""
        categorical_analysis = {}
        
        for col in self.df.columns:
            if self.df[col].dtype == 'object' or self.df[col].dtype.name == 'category':
                series = self.df[col].dropna()
                value_counts = series.value_counts()
                
                analysis = {
                    'unique_values': len(value_counts),
                    'most_frequent': value_counts.index[0] if len(value_counts) > 0 else None,
                    'most_frequent_count': value_counts.iloc[0] if len(value_counts) > 0 else 0,
                    'cardinality_ratio': len(value_counts) / len(series) if len(series) > 0 else 0,
                    'is_high_cardinality': len(value_counts) > len(series) * 0.8,
                    'distribution_entropy': self._calculate_entropy(value_counts)
                }
                
                # 检测类似值（用于数据清洗）
                similar_values = self._find_similar_values(value_counts.index.tolist())
                if similar_values:
                    analysis['similar_values'] = similar_values
                
                categorical_analysis[col] = analysis
        
        return categorical_analysis
    
    def _calculate_entropy(self, value_counts):
        """计算信息熵"""
        probabilities = value_counts / value_counts.sum()
        entropy = -np.sum(probabilities * np.log2(probabilities + 1e-10))
        return entropy
    
    def _find_similar_values(self, values, threshold=0.8):
        """查找相似的分类值"""
        from difflib import SequenceMatcher
        
        similar_groups = []
        used_indices = set()
        
        for i, val1 in enumerate(values):
            if i in used_indices:
                continue
                
            similar_group = [val1]
            for j, val2 in enumerate(values[i+1:], i+1):
                if j in used_indices:
                    continue
                    
                similarity = SequenceMatcher(None, str(val1).lower(), str(val2).lower()).ratio()
                if similarity > threshold:
                    similar_group.append(val2)
                    used_indices.add(j)
            
            if len(similar_group) > 1:
                similar_groups.append(similar_group)
                used_indices.add(i)
        
        return similar_groups if similar_groups else None
    
    def detect_outliers_advanced(self, methods=['iqr', 'zscore', 'isolation_forest']):
        """高级异常值检测"""
        outlier_results = {}
        
        for col in self.df.columns:
            if pd.api.types.is_numeric_dtype(self.df[col]):
                series = self.df[col].dropna()
                if len(series) < 10:  # 数据太少，跳过
                    continue
                    
                col_outliers = {}
                
                if 'iqr' in methods:
                    col_outliers['iqr'] = self._outliers_iqr(series)
                
                if 'zscore' in methods:
                    col_outliers['zscore'] = self._outliers_zscore(series)
                
                if 'isolation_forest' in methods:
                    col_outliers['isolation_forest'] = self._outliers_isolation_forest(series)
                
                outlier_results[col] = col_outliers
        
        return outlier_results
    
    def _outliers_iqr(self, series):
        """使用IQR方法检测异常值"""
        Q1 = series.quantile(0.25)
        Q3 = series.quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR
        outlier_mask = (series < lower_bound) | (series > upper_bound)
        return series[outlier_mask].index.tolist()
    
    def _outliers_zscore(self, series, threshold=3):
        """使用Z-score方法检测异常值"""
        z_scores = np.abs(stats.zscore(series))
        outlier_mask = z_scores > threshold
        return series[outlier_mask].index.tolist()
    
    def _outliers_isolation_forest(self, series):
        """使用Isolation Forest检测异常值"""
        try:
            from sklearn.ensemble import IsolationForest
            
            # 重塑数据
            X = series.values.reshape(-1, 1)
            
            # 训练Isolation Forest
            iso_forest = IsolationForest(contamination=0.1, random_state=42)
            outlier_labels = iso_forest.fit_predict(X)
            
            # 返回异常值的索引
            outlier_indices = series[outlier_labels == -1].index.tolist()
            return outlier_indices
            
        except ImportError:
            print("sklearn未安装，跳过Isolation Forest检测")
            return []
        
# 使用示例
def demonstrate_advanced_profiling():
    # 创建复杂测试数据
    complex_data = pd.DataFrame({
        'mixed_numeric': ['100', '200', 'invalid', '300', '400'],
        'categories': ['Type A', 'Type B', 'type a', 'TYPE_A', 'Type C'],
        'values': [10, 20, 1000, 15, 25],  # 1000是异常值
        'dates_mixed': ['2023-01-01', '2023/01/02', 'invalid', '2023-01-03', None]
    })
    
    profiler = AdvancedDataProfiler(complex_data)
    
    print("高级数据分析报告:")
    print("="*50)
    
    # 数据类型问题检测
    type_issues = profiler.detect_data_types_issues()
    print(f"数据类型问题: {type_issues}")
    
    # 分类数据分析
    categorical_analysis = profiler.analyze_categorical_data()
    print(f"\n分类数据分析: {categorical_analysis}")
    
    # 异常值检测
    outliers = profiler.detect_outliers_advanced()
    print(f"\n异常值检测: {outliers}")

# demonstrate_advanced_profiling()
```

## 缺失值处理的高级策略

缺失值处理是数据清洗中最关键的环节。不同于简单的删除或填充，现代数据科学需要精细化的缺失值处理策略。

### 缺失值类型与成因分析

**缺失机制分类：**
1. **MCAR (Missing Completely At Random)**：完全随机缺失
2. **MAR (Missing At Random)**：随机缺失，但依赖于其他变量
3. **MNAR (Missing Not At Random)**：非随机缺失，与未观测值相关

```python
import pandas as pd
import numpy as np
from sklearn.impute import SimpleImputer, KNNImputer
from sklearn.experimental import enable_iterative_imputer
from sklearn.impute import IterativeImputer
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler

class MissingValueAnalyzer:
    """
    缺失值分析器
    综合分析缺失值的模式和成因
    """
    
    def __init__(self, df):
        self.df = df.copy()
        self.missing_patterns = None
        
    def analyze_missing_patterns(self):
        """分析缺失值模式"""
        # 缺失值统计
        missing_stats = {
            'column': [],
            'missing_count': [],
            'missing_percentage': [],
            'data_type': []
        }
        
        for col in self.df.columns:
            missing_count = self.df[col].isnull().sum()
            missing_pct = (missing_count / len(self.df)) * 100
            
            missing_stats['column'].append(col)
            missing_stats['missing_count'].append(missing_count)
            missing_stats['missing_percentage'].append(missing_pct)
            missing_stats['data_type'].append(str(self.df[col].dtype))
        
        self.missing_stats_df = pd.DataFrame(missing_stats)
        return self.missing_stats_df
    
    def detect_missing_patterns(self):
        """检测缺失值的组合模式"""
        # 创建缺失值指示矩阵
        missing_matrix = self.df.isnull().astype(int)
        
        # 分析缺失值组合模式
        pattern_counts = missing_matrix.value_counts()
        
        # 转换为可读格式
        patterns = []
        for pattern, count in pattern_counts.items():
            pattern_dict = {
                'pattern': pattern,
                'count': count,
                'percentage': (count / len(self.df)) * 100
            }
            # 添加列名
            for i, col in enumerate(self.df.columns):
                pattern_dict[col] = 'Missing' if pattern[i] == 1 else 'Present'
            patterns.append(pattern_dict)
        
        self.missing_patterns = pd.DataFrame(patterns)
        return self.missing_patterns
    
    def test_missing_mechanism(self, target_col, test_cols=None):
        """探索缺失指示与其他变量的关联（非Little's MCAR检验，不能据此确认缺失机制）"""
        if test_cols is None:
            test_cols = [col for col in self.df.columns if col != target_col]
        
        target_missing = self.df[target_col].isnull()
        
        # 对每个测试列，比较缺失和非缺失组的分布
        test_results = {}
        
        for col in test_cols:
            if pd.api.types.is_numeric_dtype(self.df[col]):
                # 数值型：使用t检验
                missing_group = self.df.loc[target_missing, col].dropna()
                present_group = self.df.loc[~target_missing, col].dropna()
                
                if len(missing_group) > 0 and len(present_group) > 0:
                    from scipy.stats import ttest_ind
                    statistic, p_value = ttest_ind(missing_group, present_group)
                    test_results[col] = {
                        'test': 't-test',
                        'statistic': statistic,
                        'p_value': p_value,
                        'is_random': p_value > 0.05
                    }
            else:
                # 分类型：使用卡方检验
                contingency_table = pd.crosstab(self.df[col], target_missing)
                if contingency_table.size > 0:
                    from scipy.stats import chi2_contingency
                    chi2, p_value, dof, expected = chi2_contingency(contingency_table)
                    test_results[col] = {
                        'test': 'chi-square',
                        'statistic': chi2,
                        'p_value': p_value,
                        'is_random': p_value > 0.05
                    }
        
        return test_results
```

### 高级缺失值填充技术

现代数据科学中，缺失值处理已经超越了简单的删除和平均值填充。我们需要根据数据特性和业务情景选择最优策略。

```python
class AdvancedImputationStrategies:
    """
    高级缺失值填充策略
    集成多种先进的填充方法
    """
    
    def __init__(self, df):
        self.df = df.copy()
        self.imputed_dfs = {}
        self.imputation_metrics = {}
        
    def statistical_imputation(self, strategy='mean'):
        """统计型填充：基于描述性统计量"""
        df_imputed = self.df.copy()
        
        for col in df_imputed.columns:
            if df_imputed[col].isnull().sum() == 0:
                continue
                
            if pd.api.types.is_numeric_dtype(df_imputed[col]):
                if strategy == 'mean':
                    fill_value = df_imputed[col].mean()
                elif strategy == 'median':
                    fill_value = df_imputed[col].median()
                elif strategy == 'mode':
                    fill_value = df_imputed[col].mode().iloc[0] if not df_imputed[col].mode().empty else df_imputed[col].mean()
                    
                df_imputed[col].fillna(fill_value, inplace=True)
                
            else:  # 分类型数据
                mode_value = df_imputed[col].mode()
                if not mode_value.empty:
                    df_imputed[col].fillna(mode_value.iloc[0], inplace=True)
        
        return df_imputed
    
    def interpolation_imputation(self, method='linear'):
        """插值填充：适用于时间序列数据"""
        df_imputed = self.df.copy()
        
        # 只对数值型列进行插值
        numeric_cols = df_imputed.select_dtypes(include=[np.number]).columns
        
        for col in numeric_cols:
            if df_imputed[col].isnull().sum() > 0:
                df_imputed[col] = df_imputed[col].interpolate(method=method)
        
        return df_imputed
    
    def knn_imputation(self, n_neighbors=5):
        """KNN填充：基于最近邻算法"""
        # 分离数值型和分类型列
        numeric_cols = self.df.select_dtypes(include=[np.number]).columns
        categorical_cols = self.df.select_dtypes(include=['object']).columns
        
        df_imputed = self.df.copy()
        
        # 对数值型列使用KNN填充
        if len(numeric_cols) > 0:
            numeric_data = df_imputed[numeric_cols]
            
            # 数据标准化
            scaler = StandardScaler()
            numeric_scaled = scaler.fit_transform(numeric_data)  # 保留缺失标记供KNNImputer估计；全空列需单独处理
            
            # KNN填充
            imputer = KNNImputer(n_neighbors=n_neighbors)
            numeric_imputed = imputer.fit_transform(numeric_scaled)
            
            # 反标准化
            numeric_imputed = scaler.inverse_transform(numeric_imputed)
            
            # 更新数值型列
            for i, col in enumerate(numeric_cols):
                df_imputed[col] = numeric_imputed[:, i]
        
        # 对分类型列使用众数填充
        for col in categorical_cols:
            if df_imputed[col].isnull().sum() > 0:
                mode_value = df_imputed[col].mode()
                if not mode_value.empty:
                    df_imputed[col].fillna(mode_value.iloc[0], inplace=True)
        
        return df_imputed
    
    def iterative_imputation(self):
        """迭代填充：本例生成单份填充结果，不构成多重插补及其汇总推断"""
        # 只对数值型列进行迭代填充
        numeric_cols = self.df.select_dtypes(include=[np.number]).columns
        categorical_cols = self.df.select_dtypes(include=['object']).columns
        
        df_imputed = self.df.copy()
        
        if len(numeric_cols) > 0:
            numeric_data = df_imputed[numeric_cols]
            
            # 使用随机森林作为基本估计器
            imputer = IterativeImputer(
                estimator=RandomForestRegressor(n_estimators=10, random_state=42),
                random_state=42,
                max_iter=10
            )
            
            numeric_imputed = imputer.fit_transform(numeric_data)
            
            # 更新数值型列
            for i, col in enumerate(numeric_cols):
                df_imputed[col] = numeric_imputed[:, i]
        
        # 对分类型列使用众数填充
        for col in categorical_cols:
            if df_imputed[col].isnull().sum() > 0:
                mode_value = df_imputed[col].mode()
                if not mode_value.empty:
                    df_imputed[col].fillna(mode_value.iloc[0], inplace=True)
        
        return df_imputed
    
    def business_rule_imputation(self, rules):
        """基于业务规则的填充"""
        df_imputed = self.df.copy()
        
        for column, rule in rules.items():
            if callable(rule):
                # 函数规则
                missing_mask = df_imputed[column].isnull()
                if missing_mask.any():
                    fill_values = df_imputed[missing_mask].apply(rule, axis=1)
                    df_imputed.loc[missing_mask, column] = fill_values
            else:
                # 固定值规则
                df_imputed[column].fillna(rule, inplace=True)
        
        return df_imputed
    
    def evaluate_imputation_quality(self, original_col, imputed_col):
        """评估填充质量"""
        # 只评估数值型列
        if not pd.api.types.is_numeric_dtype(original_col):
            return {'error': 'Only numeric columns can be evaluated'}
        
        original_stats = original_col.describe()
        imputed_stats = imputed_col.describe()
        
        metrics = {
            'mean_difference': abs(original_stats['mean'] - imputed_stats['mean']),
            'std_difference': abs(original_stats['std'] - imputed_stats['std']),
            'distribution_shift': self._calculate_ks_statistic(original_col.dropna(), imputed_col)
        }
        
        return metrics
    
    def _calculate_ks_statistic(self, original, imputed):
        """计算Kolmogorov-Smirnov统计量"""
        try:
            from scipy.stats import ks_2samp
            statistic, p_value = ks_2samp(original, imputed)
            return {'ks_statistic': statistic, 'p_value': p_value}
        except:
            return {'error': 'KS test failed'}
    
    def compare_strategies(self, strategies=['mean', 'knn', 'iterative']):
        """比较不同填充策略的效果"""
        comparison_results = {}
        
        for strategy in strategies:
            if strategy == 'mean':
                imputed_df = self.statistical_imputation('mean')
            elif strategy == 'median':
                imputed_df = self.statistical_imputation('median')
            elif strategy == 'knn':
                imputed_df = self.knn_imputation()
            elif strategy == 'iterative':
                imputed_df = self.iterative_imputation()
            
            # 评估填充质量
            strategy_metrics = {}
            for col in self.df.columns:
                if pd.api.types.is_numeric_dtype(self.df[col]) and self.df[col].isnull().sum() > 0:
                    metrics = self.evaluate_imputation_quality(self.df[col], imputed_df[col])
                    strategy_metrics[col] = metrics
            
            comparison_results[strategy] = {
                'imputed_df': imputed_df,
                'metrics': strategy_metrics
            }
        
        return comparison_results
```

## 异常值检测与处理

异常值（Outliers）是指明显偏离数据集中其他观测值的数据点。正确识别和处理异常值对数据质量至关重要。

### 异常值检测算法

```python
class OutlierDetector:
    """
    异常值检测器
    集成多种异常值检测算法
    """
    
    def __init__(self, df):
        self.df = df.copy()
        self.outlier_results = {}
    
    def iqr_method(self, column, multiplier=1.5):
        """IQR方法：基于四分位距检测异常值"""
        series = self.df[column].dropna()
        
        Q1 = series.quantile(0.25)
        Q3 = series.quantile(0.75)
        IQR = Q3 - Q1
        
        lower_bound = Q1 - multiplier * IQR
        upper_bound = Q3 + multiplier * IQR
        
        outlier_mask = (series < lower_bound) | (series > upper_bound)
        outlier_indices = series[outlier_mask].index
        
        return {
            'outlier_indices': outlier_indices.tolist(),
            'outlier_count': len(outlier_indices),
            'bounds': {'lower': lower_bound, 'upper': upper_bound},
            'outlier_values': series[outlier_mask].values
        }
    
    def zscore_method(self, column, threshold=3):
        """Z-Score方法：基于标准分数检测异常值"""
        series = self.df[column].dropna()
        
        mean = series.mean()
        std = series.std()
        z_scores = np.abs((series - mean) / std)
        
        outlier_mask = z_scores > threshold
        outlier_indices = series[outlier_mask].index
        
        return {
            'outlier_indices': outlier_indices.tolist(),
            'outlier_count': len(outlier_indices),
            'threshold': threshold,
            'z_scores': z_scores[outlier_mask].values,
            'outlier_values': series[outlier_mask].values
        }
    
    def modified_zscore_method(self, column, threshold=3.5):
        """改进Z-Score方法：使用中位数绝对偏差（MAD）"""
        series = self.df[column].dropna()
        
        median = series.median()
        mad = np.median(np.abs(series - median))
        
        # 避免除零
        if mad == 0:
            mad = np.mean(np.abs(series - median))
        
        modified_z_scores = 0.6745 * (series - median) / mad
        outlier_mask = np.abs(modified_z_scores) > threshold
        outlier_indices = series[outlier_mask].index
        
        return {
            'outlier_indices': outlier_indices.tolist(),
            'outlier_count': len(outlier_indices),
            'threshold': threshold,
            'modified_z_scores': modified_z_scores[outlier_mask].values,
            'outlier_values': series[outlier_mask].values
        }
    
    def isolation_forest_method(self, columns=None, contamination=0.1):
        """Isolation Forest方法：基于随机划分形成的隔离树进行异常检测"""
        try:
            from sklearn.ensemble import IsolationForest
            
            if columns is None:
                columns = self.df.select_dtypes(include=[np.number]).columns
            
            data = self.df[columns].dropna()
            if len(data) < 10:
                return {'error': 'Not enough data for Isolation Forest'}
            
            # 数据标准化
            scaler = StandardScaler()
            data_scaled = scaler.fit_transform(data)
            
            # 训练Isolation Forest
            iso_forest = IsolationForest(
                contamination=contamination,
                random_state=42,
                n_estimators=100
            )
            
            outlier_labels = iso_forest.fit_predict(data_scaled)
            outlier_mask = outlier_labels == -1
            outlier_indices = data[outlier_mask].index
            
            # 计算异常分数
            anomaly_scores = iso_forest.decision_function(data_scaled)
            
            return {
                'outlier_indices': outlier_indices.tolist(),
                'outlier_count': len(outlier_indices),
                'contamination': contamination,
                'anomaly_scores': anomaly_scores[outlier_mask],
                'outlier_data': data[outlier_mask]
            }
            
        except ImportError:
            return {'error': 'sklearn is required for Isolation Forest'}
    
    def local_outlier_factor_method(self, columns=None, n_neighbors=20):
        """Local Outlier Factor方法：基于局部密度的异常检测"""
        try:
            from sklearn.neighbors import LocalOutlierFactor
            
            if columns is None:
                columns = self.df.select_dtypes(include=[np.number]).columns
            
            data = self.df[columns].dropna()
            if len(data) < n_neighbors + 1:
                return {'error': f'Not enough data for LOF (need at least {n_neighbors + 1} samples)'}
            
            # 数据标准化
            scaler = StandardScaler()
            data_scaled = scaler.fit_transform(data)
            
            # 训练LOF
            lof = LocalOutlierFactor(n_neighbors=n_neighbors, contamination=0.1)
            outlier_labels = lof.fit_predict(data_scaled)
            
            outlier_mask = outlier_labels == -1
            outlier_indices = data[outlier_mask].index
            
            # LOF分数
            lof_scores = -lof.negative_outlier_factor_
            
            return {
                'outlier_indices': outlier_indices.tolist(),
                'outlier_count': len(outlier_indices),
                'n_neighbors': n_neighbors,
                'lof_scores': lof_scores[outlier_mask],
                'outlier_data': data[outlier_mask]
            }
            
        except ImportError:
            return {'error': 'sklearn is required for LOF'}
    
    def detect_all_outliers(self, columns=None):
        """综合异常值检测：使用多种方法"""
        if columns is None:
            columns = self.df.select_dtypes(include=[np.number]).columns
        
        all_results = {}
        
        for col in columns:
            if self.df[col].isnull().sum() == len(self.df):
                continue
                
            col_results = {
                'iqr': self.iqr_method(col),
                'zscore': self.zscore_method(col),
                'modified_zscore': self.modified_zscore_method(col)
            }
            
            all_results[col] = col_results
        
        # 多变量方法
        if len(columns) > 1:
            all_results['multivariate'] = {
                'isolation_forest': self.isolation_forest_method(columns),
                'lof': self.local_outlier_factor_method(columns)
            }
        
        return all_results
    
    def consensus_outliers(self, columns=None, min_methods=2):
        """共识异常值：多种方法共同识别的异常值"""
        if columns is None:
            columns = self.df.select_dtypes(include=[np.number]).columns
        
        consensus_results = {}
        
        for col in columns:
            if self.df[col].isnull().sum() == len(self.df):
                continue
            
            # 获取各种方法的结果
            iqr_outliers = set(self.iqr_method(col)['outlier_indices'])
            zscore_outliers = set(self.zscore_method(col)['outlier_indices'])
            modified_zscore_outliers = set(self.modified_zscore_method(col)['outlier_indices'])
            
            # 计算交集
            all_outliers = [iqr_outliers, zscore_outliers, modified_zscore_outliers]
            consensus_outliers = set()
            
            # 找出至少被min_methods种方法识别的异常值
            for idx in iqr_outliers.union(zscore_outliers, modified_zscore_outliers):
                count = sum(1 for outlier_set in all_outliers if idx in outlier_set)
                if count >= min_methods:
                    consensus_outliers.add(idx)
            
            consensus_results[col] = {
                'consensus_outliers': list(consensus_outliers),
                'consensus_count': len(consensus_outliers),
                'method_agreement': {
                    'iqr': len(iqr_outliers),
                    'zscore': len(zscore_outliers),
                    'modified_zscore': len(modified_zscore_outliers)
                }
            }
        
        return consensus_results
```

## 数据标准化与归一化

数据标准化和归一化是确保不同特征具有相同量级的重要步骤，对机器学习模型的性能有显著影响。

```python
class DataNormalizer:
    """
    数据标准化和归一化处理器
    提供多种标准化策略
    """
    
    def __init__(self, df):
        self.df = df.copy()
        self.scalers = {}
        self.numeric_columns = df.select_dtypes(include=[np.number]).columns
    
    def z_score_normalization(self, columns=None):
        """Z-Score标准化：(x - μ) / σ"""
        if columns is None:
            columns = self.numeric_columns
        
        df_normalized = self.df.copy()
        scaler_info = {}
        
        for col in columns:
            if col in df_normalized.columns:
                series = df_normalized[col].dropna()
                if len(series) > 0:
                    mean_val = series.mean()
                    std_val = series.std()
                    
                    if std_val != 0:
                        df_normalized[col] = (df_normalized[col] - mean_val) / std_val
                        scaler_info[col] = {'mean': mean_val, 'std': std_val}
                    else:
                        # 标准差为0的情况
                        df_normalized[col] = 0
                        scaler_info[col] = {'mean': mean_val, 'std': 0}
        
        self.scalers['zscore'] = scaler_info
        return df_normalized
    
    def min_max_normalization(self, columns=None, feature_range=(0, 1)):
        """Min-Max归一化：(x - min) / (max - min)"""
        if columns is None:
            columns = self.numeric_columns
        
        df_normalized = self.df.copy()
        scaler_info = {}
        min_val, max_val = feature_range
        
        for col in columns:
            if col in df_normalized.columns:
                series = df_normalized[col].dropna()
                if len(series) > 0:
                    data_min = series.min()
                    data_max = series.max()
                    
                    if data_max != data_min:
                        # 标准Min-Max缩放
                        df_normalized[col] = (df_normalized[col] - data_min) / (data_max - data_min)
                        # 缩放到指定范围
                        df_normalized[col] = df_normalized[col] * (max_val - min_val) + min_val
                        
                        scaler_info[col] = {
                            'data_min': data_min, 
                            'data_max': data_max,
                            'feature_range': feature_range
                        }
                    else:
                        # 所有值相同的情况
                        df_normalized[col] = min_val
                        scaler_info[col] = {
                            'data_min': data_min, 
                            'data_max': data_max, 
                            'constant_value': True
                        }
        
        self.scalers['minmax'] = scaler_info
        return df_normalized
    
    def robust_normalization(self, columns=None):
        """鲁棒标准化：使用中位数和IQR"""
        if columns is None:
            columns = self.numeric_columns
        
        df_normalized = self.df.copy()
        scaler_info = {}
        
        for col in columns:
            if col in df_normalized.columns:
                series = df_normalized[col].dropna()
                if len(series) > 0:
                    median_val = series.median()
                    q1 = series.quantile(0.25)
                    q3 = series.quantile(0.75)
                    iqr = q3 - q1
                    
                    if iqr != 0:
                        df_normalized[col] = (df_normalized[col] - median_val) / iqr
                        scaler_info[col] = {
                            'median': median_val,
                            'q1': q1,
                            'q3': q3,
                            'iqr': iqr
                        }
                    else:
                        # IQR为0的情况
                        df_normalized[col] = 0
                        scaler_info[col] = {
                            'median': median_val,
                            'iqr': 0,
                            'constant_value': True
                        }
        
        self.scalers['robust'] = scaler_info
        return df_normalized
    
    def unit_vector_scaling(self, columns=None):
        """单位向量缩放：每个样本缩放为单位范数"""
        if columns is None:
            columns = self.numeric_columns
        
        df_normalized = self.df.copy()
        
        # 按行进行单位向量缩放
        for idx in df_normalized.index:
            row_values = df_normalized.loc[idx, columns]
            # 只处理非空值
            non_null_mask = row_values.notna()
            if non_null_mask.sum() > 0:
                non_null_values = row_values[non_null_mask]
                norm = np.linalg.norm(non_null_values)
                if norm != 0:
                    df_normalized.loc[idx, columns[non_null_mask]] = non_null_values / norm
        
        return df_normalized
    
    def quantile_normalization(self, columns=None):
        """分位数归一化：基于分位数的归一化"""
        if columns is None:
            columns = self.numeric_columns
        
        df_normalized = self.df.copy()
        scaler_info = {}
        
        for col in columns:
            if col in df_normalized.columns:
                series = df_normalized[col].dropna()
                if len(series) > 0:
                    # 计算分位数
                    quantiles = np.linspace(0, 1, 101)  # 0%, 1%, 2%, ..., 100%
                    quantile_values = series.quantile(quantiles)
                    
                    # 将每个值替换为其分位数排名
                    def to_quantile_rank(x):
                        if pd.isna(x):
                            return np.nan
                        # 找到x对应的分位数
                        rank = (series <= x).mean()
                        return rank
                    
                    df_normalized[col] = df_normalized[col].apply(to_quantile_rank)
                    scaler_info[col] = {'quantiles': quantile_values}
        
        self.scalers['quantile'] = scaler_info
        return df_normalized
    
    def power_transformation(self, columns=None, method='box-cox'):
        """幂变换：处理偏态分布"""
        try:
            from scipy.stats import boxcox, yeojohnson
            
            if columns is None:
                columns = self.numeric_columns
            
            df_transformed = self.df.copy()
            transform_info = {}
            
            for col in columns:
                if col in df_transformed.columns:
                    series = df_transformed[col].dropna()
                    if len(series) > 0:
                        if method == 'box-cox':
                            # Box-Cox需要正值
                            if (series > 0).all():
                                transformed_data, lambda_val = boxcox(series)
                                df_transformed.loc[series.index, col] = transformed_data
                                transform_info[col] = {'method': 'box-cox', 'lambda': lambda_val}
                            else:
                                # 如果有非正值，使用Yeo-Johnson
                                transformed_data, lambda_val = yeojohnson(series)
                                df_transformed.loc[series.index, col] = transformed_data
                                transform_info[col] = {'method': 'yeo-johnson', 'lambda': lambda_val}
                        
                        elif method == 'yeo-johnson':
                            transformed_data, lambda_val = yeojohnson(series)
                            df_transformed.loc[series.index, col] = transformed_data
                            transform_info[col] = {'method': 'yeo-johnson', 'lambda': lambda_val}
                        
                        elif method == 'log':
                            # 对数变换
                            if (series > 0).all():
                                df_transformed[col] = np.log(df_transformed[col])
                                transform_info[col] = {'method': 'log'}
                            else:
                                # log1p变换（处理0值）
                                df_transformed[col] = np.log1p(df_transformed[col] - series.min())
                                transform_info[col] = {'method': 'log1p', 'min_val': series.min()}
            
            self.scalers['power_transform'] = transform_info
            return df_transformed
            
        except ImportError:
            print("scipy is required for power transformations")
            return self.df.copy()
    
    def compare_normalization_methods(self, sample_column):
        """比较不同归一化方法的效果"""
        if sample_column not in self.numeric_columns:
            return {'error': f'{sample_column} is not a numeric column'}
        
        original_data = self.df[sample_column].dropna()
        
        methods = {
            'original': original_data,
            'zscore': self.z_score_normalization([sample_column])[sample_column].dropna(),
            'minmax': self.min_max_normalization([sample_column])[sample_column].dropna(),
            'robust': self.robust_normalization([sample_column])[sample_column].dropna(),
            'quantile': self.quantile_normalization([sample_column])[sample_column].dropna()
        }
        
        comparison = {}
        for method_name, data in methods.items():
            comparison[method_name] = {
                'mean': data.mean(),
                'std': data.std(),
                'min': data.min(),
                'max': data.max(),
                'skewness': data.skew(),
                'kurtosis': data.kurtosis()
            }
        
        return comparison
```

## 企业级数据清洗流水线

构建自动化、可扩展的数据清洗流水线是企业数据管理的关键。

```python
class DataCleaningPipeline:
    """
    企业级数据清洗流水线
    演示自动化数据清洗流程的组织方式；质量评分为简化示例，不代表完整业务验收
    """
    
    def __init__(self, config=None):
        self.config = config or self._default_config()
        self.cleaning_history = []
        self.quality_metrics = {}
        
    def _default_config(self):
        """默认清洗配置"""
        return {
            'missing_value_strategy': 'auto',  # auto, drop, fill, advanced
            'outlier_detection': True,
            'outlier_treatment': 'cap',  # drop, cap, transform
            'duplicate_handling': 'drop_duplicates',
            'data_type_inference': True,
            'normalization': None,  # zscore, minmax, robust, None
            'validation_rules': {},
            'quality_threshold': 0.8
        }
    
    def execute_pipeline(self, df, custom_rules=None):
        """执行完整的清洗流水线"""
        print("开始执行数据清洗流水线...")
        print("="*50)
        
        # 记录原始数据状态
        original_shape = df.shape
        original_quality = self._calculate_quality_score(df)
        
        # 创建工作副本
        working_df = df.copy()
        
        # 步骤1：数据质量评估
        print("步骤1: 数据质量评估")
        quality_assessment = DataQualityAssessment(working_df)
        initial_report = quality_assessment.comprehensive_profile()
        self._log_step("initial_assessment", initial_report)
        
        # 步骤2：数据类型推断和转换
        if self.config['data_type_inference']:
            print("步骤2: 数据类型推断")
            working_df = self._infer_and_convert_dtypes(working_df)
            self._log_step("dtype_conversion", {"converted_columns": []})
        
        # 步骤3：处理重复值
        print("步骤3: 处理重复值")
        if self.config['duplicate_handling'] == 'drop_duplicates':
            duplicate_count = working_df.duplicated().sum()
            working_df = working_df.drop_duplicates()
            self._log_step("duplicate_removal", {"removed_count": duplicate_count})
        
        # 步骤4：处理缺失值
        print("步骤4: 处理缺失值")
        working_df = self._handle_missing_values(working_df)
        
        # 步骤5：异常值检测和处理
        if self.config['outlier_detection']:
            print("步骤5: 异常值处理")
            working_df = self._handle_outliers(working_df)
        
        # 步骤6：数据标准化
        if self.config['normalization']:
            print("步骤6: 数据标准化")
            working_df = self._normalize_data(working_df)
        
        # 步骤7：业务规则验证
        if custom_rules:
            print("步骤7: 业务规则验证")
            working_df = self._apply_business_rules(working_df, custom_rules)
        
        # 步骤8：最终质量评估
        print("步骤8: 最终质量评估")
        final_quality = self._calculate_quality_score(working_df)
        final_shape = working_df.shape
        
        # 生成清洗报告
        cleaning_report = self._generate_cleaning_report(
            original_shape, final_shape, 
            original_quality, final_quality
        )
        
        print(f"\n清洗完成！")
        print(f"数据行数: {original_shape[0]} → {final_shape[0]}")
        print(f"质量得分: {original_quality:.2f} → {final_quality:.2f}")
        
        return working_df, cleaning_report
    
    def _handle_missing_values(self, df):
        """处理缺失值"""
        strategy = self.config['missing_value_strategy']
        
        if strategy == 'drop':
            # 简单删除
            return df.dropna()
        
        elif strategy == 'fill':
            # 简单填充
            numeric_cols = df.select_dtypes(include=[np.number]).columns
            categorical_cols = df.select_dtypes(include=['object']).columns
            
            for col in numeric_cols:
                df[col].fillna(df[col].median(), inplace=True)
            
            for col in categorical_cols:
                mode_val = df[col].mode()
                if not mode_val.empty:
                    df[col].fillna(mode_val.iloc[0], inplace=True)
            
            return df
        
        elif strategy == 'advanced':
            # 使用高级填充策略
            imputer = AdvancedImputationStrategies(df)
            return imputer.knn_imputation()
        
        elif strategy == 'auto':
            # 自动选择策略
            missing_pct = (df.isnull().sum() / len(df)).max()
            
            if missing_pct < 0.05:
                # 缺失值很少，直接删除
                return df.dropna()
            elif missing_pct < 0.30:
                # 中等缺失率，使用KNN填充
                imputer = AdvancedImputationStrategies(df)
                return imputer.knn_imputation()
            else:
                # 高缺失率，使用简单填充
                return AdvancedImputationStrategies(df).statistical_imputation(strategy='median')
    
    def _handle_outliers(self, df):
        """处理异常值"""
        detector = OutlierDetector(df)
        treatment = self.config['outlier_treatment']
        
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        
        for col in numeric_cols:
            outliers = detector.iqr_method(col)
            outlier_indices = outliers['outlier_indices']
            
            if len(outlier_indices) > 0:
                if treatment == 'drop':
                    # 删除异常值
                    df = df.drop(outlier_indices)
                
                elif treatment == 'cap':
                    # 截断异常值
                    lower_bound = outliers['bounds']['lower']
                    upper_bound = outliers['bounds']['upper']
                    
                    df.loc[df[col] < lower_bound, col] = lower_bound
                    df.loc[df[col] > upper_bound, col] = upper_bound
                
                elif treatment == 'transform':
                    # 对数变换（如果适用）
                    if (df[col] > 0).all():
                        df[col] = np.log1p(df[col])
        
        return df
    
    def _normalize_data(self, df):
        """数据标准化"""
        normalizer = DataNormalizer(df)
        method = self.config['normalization']
        
        if method == 'zscore':
            return normalizer.z_score_normalization()
        elif method == 'minmax':
            return normalizer.min_max_normalization()
        elif method == 'robust':
            return normalizer.robust_normalization()
        
        return df
    
    def _infer_and_convert_dtypes(self, df):
        """推断和转换数据类型"""
        # 尝试转换数值型列
        for col in df.columns:
            if df[col].dtype == 'object':
                # 尝试转换为数值型
                numeric_converted = pd.to_numeric(df[col], errors='coerce')
                # 如果转换成功率高于80%，则采用转换
                success_rate = numeric_converted.notna().sum() / df[col].notna().sum()
                if success_rate > 0.8:
                    df[col] = numeric_converted
                    continue
                
                # 尝试转换为日期型
                try:
                    date_converted = pd.to_datetime(df[col], errors='coerce')
                    success_rate = date_converted.notna().sum() / df[col].notna().sum()
                    if success_rate > 0.8:
                        df[col] = date_converted
                except:
                    pass
        
        return df
    
    def _apply_business_rules(self, df, rules):
        """应用业务规则"""
        for rule_name, rule_func in rules.items():
            try:
                df = rule_func(df)
                self._log_step(f"business_rule_{rule_name}", {"status": "applied"})
            except Exception as e:
                print(f"业务规则 {rule_name} 执行失败: {e}")
                self._log_step(f"business_rule_{rule_name}", {"status": "failed", "error": str(e)})
        
        return df
    
    def _calculate_quality_score(self, df):
        """计算数据质量得分"""
        # 完整性得分（缺失值比例）
        completeness_score = 1 - (df.isnull().sum().sum() / (len(df) * len(df.columns)))
        
        # 唯一性得分（重复值比例）
        uniqueness_score = 1 - (df.duplicated().sum() / len(df))
        
        # 有效性得分（基于数据类型匹配）
        validity_score = 0.9  # 简化版本
        
        # 综合得分
        quality_score = (completeness_score * 0.4 + 
                        uniqueness_score * 0.3 + 
                        validity_score * 0.3)
        
        return quality_score
    
    def _log_step(self, step_name, details):
        """记录清洗步骤"""
        self.cleaning_history.append({
            'step': step_name,
            'timestamp': pd.Timestamp.now(),
            'details': details
        })
    
    def _generate_cleaning_report(self, orig_shape, final_shape, orig_quality, final_quality):
        """生成清洗报告"""
        report = {
            'original_shape': orig_shape,
            'final_shape': final_shape,
            'rows_removed': orig_shape[0] - final_shape[0],
            'columns_modified': len([step for step in self.cleaning_history if 'conversion' in step['step']]),
            'quality_improvement': final_quality - orig_quality,
            'original_quality': orig_quality,
            'final_quality': final_quality,
            'cleaning_steps': len(self.cleaning_history),
            'detailed_history': self.cleaning_history
        }
        
        return report

# 使用示例
def demonstrate_enterprise_pipeline():
    """演示企业级清洗流水线"""
    
    # 创建复杂的测试数据
    np.random.seed(42)
    n = 1000
    
    test_data = pd.DataFrame({
        'customer_id': range(1, n+1),
        'age': np.random.normal(35, 10, n),
        'income': np.random.normal(50000, 15000, n),
        'purchase_amount': np.random.exponential(100, n),
        'category': np.random.choice(['A', 'B', 'C', 'D'], n),
        'registration_date': pd.date_range('2020-01-01', periods=n, freq='D')
    })
    
    # 人为引入数据质量问题
    # 缺失值
    missing_indices = np.random.choice(n, size=int(n*0.1), replace=False)
    test_data.loc[missing_indices[:50], 'age'] = np.nan
    test_data.loc[missing_indices[50:], 'income'] = np.nan
    
    # 异常值
    test_data.loc[np.random.choice(n, 10), 'purchase_amount'] = np.random.uniform(10000, 50000, 10)
    
    # 重复值
    test_data = pd.concat([test_data, test_data.sample(50)], ignore_index=True)
    
    # 数据类型问题
    test_data['mixed_column'] = (['100', '200.5', 'invalid', '300', None] * (len(test_data)//5 + 1))[:len(test_data)]
    test_data = test_data.iloc[:len(test_data)]
    
    print("原始数据质量问题:")
    print(f"数据形状: {test_data.shape}")
    print(f"缺失值: {test_data.isnull().sum().sum()}")
    print(f"重复值: {test_data.duplicated().sum()}")
    
    # 创建清洗流水线
    config = {
        'missing_value_strategy': 'auto',
        'outlier_detection': True,
        'outlier_treatment': 'cap',
        'duplicate_handling': 'drop_duplicates',
        'data_type_inference': True,
        'normalization': 'robust'
    }
    
    pipeline = DataCleaningPipeline(config)
    
    # 定义业务规则
    business_rules = {
        'age_validation': lambda df: df[df['age'].between(18, 100, na=False)],
        'income_validation': lambda df: df[df['income'] > 0]
    }
    
    # 执行清洗
    cleaned_data, report = pipeline.execute_pipeline(test_data, business_rules)
    
    print(f"\n清洗报告:")
    print(f"质量提升: {report['quality_improvement']:.3f}")
    print(f"删除行数: {report['rows_removed']}")
    print(f"清洗步骤: {report['cleaning_steps']}")

# demonstrate_enterprise_pipeline()
```

## 性能优化与大规模数据处理

处理大规模数据时，性能优化变得至关重要。

```python
class PerformanceOptimizer:
    """
    大规模数据清洗性能优化器
    """
    
    def __init__(self, chunk_size=10000):
        self.chunk_size = chunk_size
        
    def chunked_processing(self, file_path, processing_func, output_path=None):
        """分块处理大文件"""
        print(f"开始分块处理，块大小: {self.chunk_size}")
        
        processed_chunks = []
        total_rows = 0
        
        for chunk_id, chunk in enumerate(pd.read_csv(file_path, chunksize=self.chunk_size)):
            print(f"处理第 {chunk_id + 1} 块，行数: {len(chunk)}")
            
            # 应用处理函数
            processed_chunk = processing_func(chunk)
            processed_chunks.append(processed_chunk)
            total_rows += len(processed_chunk)
            
            # 可选：将处理后的块保存到临时文件
            if output_path:
                mode = 'w' if chunk_id == 0 else 'a'
                header = chunk_id == 0
                processed_chunk.to_csv(output_path, mode=mode, header=header, index=False)
        
        if not output_path:
            # 合并所有块
            final_result = pd.concat(processed_chunks, ignore_index=True)
            return final_result
        
        print(f"处理完成，总计 {total_rows} 行")
        return output_path
    
    def memory_efficient_cleaning(self, df):
        """内存高效的清洗方法"""
        # 优化数据类型以减少内存使用
        df = self._optimize_dtypes(df)
        
        # 分列处理以减少内存峰值
        for col in df.columns:
            if df[col].dtype == 'object':
                # 字符串列的内存优化
                df[col] = df[col].astype('category') if df[col].nunique() < len(df) * 0.5 else df[col]
        
        return df
    
    def _optimize_dtypes(self, df):
        """优化数据类型以节省内存"""
        optimized_df = df.copy()
        
        for col in optimized_df.columns:
            col_type = optimized_df[col].dtype
            
            if col_type != 'object':
                c_min = optimized_df[col].min()
                c_max = optimized_df[col].max()
                
                if str(col_type)[:3] == 'int':
                    if c_min > np.iinfo(np.int8).min and c_max < np.iinfo(np.int8).max:
                        optimized_df[col] = optimized_df[col].astype(np.int8)
                    elif c_min > np.iinfo(np.int16).min and c_max < np.iinfo(np.int16).max:
                        optimized_df[col] = optimized_df[col].astype(np.int16)
                    elif c_min > np.iinfo(np.int32).min and c_max < np.iinfo(np.int32).max:
                        optimized_df[col] = optimized_df[col].astype(np.int32)
                
                elif str(col_type)[:5] == 'float':
                    if c_min > np.finfo(np.float16).min and c_max < np.finfo(np.float16).max:
                        optimized_df[col] = optimized_df[col].astype(np.float32)
        
        return optimized_df

    def parallel_processing(self, df, processing_func, n_jobs=-1):
        """并行处理数据"""
        try:
            from joblib import Parallel, delayed
            import multiprocessing as mp
            
            if n_jobs == -1:
                n_jobs = mp.cpu_count()
            
            # 将数据分割为多个部分
            chunk_size = len(df) // n_jobs
            chunks = [df[i:i + chunk_size] for i in range(0, len(df), chunk_size)]
            
            # 并行处理
            results = Parallel(n_jobs=n_jobs)(
                delayed(processing_func)(chunk) for chunk in chunks
            )
            
            # 合并结果
            return pd.concat(results, ignore_index=True)
            
        except ImportError:
            print("joblib未安装，使用单进程处理")
            return processing_func(df)
```

## 最佳实践与质量保证

### 数据清洗最佳实践

1. **制定清洗标准**：建立统一的数据质量标准和清洗流程
2. **版本控制**：对清洗脚本和数据版本进行管理
3. **可追溯性**：记录所有清洗操作的详细日志
4. **验证机制**：建立数据质量验证检查点
5. **自动化流程**：构建可重复、可扩展的清洗流水线

### 质量评估指标

```python
def calculate_comprehensive_quality_metrics(original_df, cleaned_df):
    """计算综合数据质量指标"""
    
    metrics = {}
    
    # 基础指标
    metrics['data_volume'] = {
        'original_rows': len(original_df),
        'cleaned_rows': len(cleaned_df),
        'retention_rate': len(cleaned_df) / len(original_df)
    }
    
    # 完整性指标
    orig_missing = original_df.isnull().sum().sum()
    cleaned_missing = cleaned_df.isnull().sum().sum()
    
    metrics['completeness'] = {
        'original_completeness': 1 - (orig_missing / (len(original_df) * len(original_df.columns))),
        'cleaned_completeness': 1 - (cleaned_missing / (len(cleaned_df) * len(cleaned_df.columns))),
        'improvement': (orig_missing / (len(original_df) * len(original_df.columns))) - (cleaned_missing / (len(cleaned_df) * len(cleaned_df.columns)))
    }
    
    # 一致性指标
    numeric_cols = original_df.select_dtypes(include=[np.number]).columns
    consistency_scores = {}
    
    for col in numeric_cols:
        if col in cleaned_df.columns:
            orig_std = original_df[col].std()
            cleaned_std = cleaned_df[col].std()
            consistency_scores[col] = 1 - abs(orig_std - cleaned_std) / orig_std if orig_std != 0 else 1
    
    metrics['consistency'] = {
        'average_consistency': np.mean(list(consistency_scores.values())) if consistency_scores else 0,
        'column_scores': consistency_scores
    }
    
    return metrics
```

## 小结与进阶方向

### 核心要点

> [!success] 数据清洗核心技能
> - **系统评估**：全面诊断数据质量问题的六个维度
> - **智能填充**：基于统计学和机器学习的缺失值处理
> - **异常检测**：多算法融合的异常值识别与处理
> - **标准化技术**：针对不同分布特征的数据标准化方法
> - **流水线设计**：企业级自动化清洗流程构建
> - **性能优化**：大规模数据处理的内存和计算优化

### 企业级应用场景

| 应用领域 | 核心挑战 | 推荐策略 |
|---------|----------|----------|
| **金融风控** | 高准确性要求 | 多重验证 + 异常检测 |
| **电商推荐** | 实时性要求 | 增量清洗 + 缓存策略 |
| **医疗数据** | 合规性要求 | 规则验证 + 审计日志 |
| **IoT传感器** | 大数据量 | 流式处理 + 分布式计算 |

### 进阶学习路径

**技术深化**：
- 深度学习在数据清洗中的应用
- 实时流式数据清洗架构
- 分布式数据清洗系统设计
- 数据血缘与影响分析

**工具生态**：
- Apache Spark MLlib数据预处理
- Dask并行计算框架
- Great Expectations数据验证
- Apache Airflow工作流调度

---

## 知识连接

**前置知识**：
- [[【技术与工具】/Python/09-Pandas数据结构|Pandas数据结构]] - 数据操作基础
- [[【技术与工具】/Python/10-Pandas数据操作|Pandas数据操作]] - 数据处理技巧

**后续学习**：
- [[【数据分析与数据运营】/01-共同能力基础/04-沟通表达/05-数据可视化设计原则|共同能力基础/数据可视化设计原则]] - 清洗效果展示
- [[【技术与工具】/Python/18-机器学习基础|机器学习]] - 高级特征工程

**相关技术**：
- [[【数据分析与数据运营】/98-专业术语词典/04-数据工程类/ETL|ETL]] - 企业数据处理架构

**实战应用**：
- [[【数据分析与数据运营】/02-数据分析专业能力/00-目录导览|数据分析专业能力/目录导览]] - 清洗后的分析应用
- 大数据处理框架对比 - 分布式清洗技术

---

**文档版本**：v2.0  
**最后更新**：2024-12-29  
**预计学习时间**：120-150分钟

#Pandas #数据清洗 #缺失值处理 #异常值检测 #数据质量 #企业级流水线 #性能优化 #数据标准化