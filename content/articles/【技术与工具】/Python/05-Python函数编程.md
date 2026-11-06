---
title: Python函数编程：代码复用与高阶编程技术
tags:
  - Python
  - 函数
  - 装饰器
  - 生成器
  - 模块化
  - 函数式编程
created: 2024-06-29
updated: 2026-10-10
difficulty: 中级
duration: 90分钟
knowledge_type: technical-practice
target_audience:
  - 数据分析师
  - 数据开发工程师
  - 数据科学家
stability: stable
status: maintenance
access_tier: free
---


# Python函数编程：代码复用与高阶编程技术

> [!abstract] 学习概要
> - **核心概念**：函数定义、参数机制、作用域链、闭包、装饰器、生成器
> - **技术重点**：内存管理、性能优化、函数式编程模式
> - **应用场景**：数据处理管道、代码封装、性能监控、缓存策略
> - **前置知识**：[[【技术与工具】/Python/04-Python数据结构|Python数据结构]]

## 函数编程的技术基础

函数是Python中的第一类对象（First-class Object），支持动态创建、传递、修改和删除。在数据科学应用中，函数编程技术提供了代码复用、性能优化和模块化设计的核心机制。

### 函数对象模型与执行机制

```python
# Python函数对象模型
def example_function(x):
    """函数对象属性示例"""
    return x * 2

# 函数是对象，具有属性和方法
print(example_function.__name__)      # 'example_function'
print(example_function.__doc__)       # '函数对象属性示例'
print(example_function.__code__)      # code对象
print(type(example_function))         # <class 'function'>

# 函数可以作为变量传递
function_alias = example_function
print(function_alias(5))              # 10

# 函数执行机制：调用栈和作用域链
import dis
dis.dis(example_function)             # 查看字节码
```

**技术原理**：
- **函数对象**：每个函数都是一个包含代码对象、全局命名空间引用的复合对象
- **调用栈**：函数调用时创建新的栈帧，包含局部变量和执行状态
- **作用域解析**：遵循LEGB规则进行变量查找（Local→Enclosing→Global→Built-in）

---

## 函数定义与参数机制

### 函数对象创建与调用机制

```python
# 函数定义的完整语法结构
def function_name(parameters) -> return_type:
    """文档字符串：函数功能、参数、返回值说明"""
    # 函数体
    return expression

# 函数创建过程的技术细节
def data_processor(data, transform_func=None):
    """
    数据处理函数
    
    技术实现：
    1. 创建函数对象，包含代码对象和默认参数
    2. 绑定到当前命名空间
    3. 建立闭包环境（如果需要）
    
    Args:
        data: 待处理数据
        transform_func: 转换函数，默认为None
        
    Returns:
        processed_data: 处理后的数据
    """
    if transform_func is None:
        transform_func = lambda x: x  # 默认恒等变换
    
    # 应用变换函数到每个数据项
    return [transform_func(item) for item in data]

# 函数调用的内存和执行机制
original_data = [1, 2, 3, 4, 5]

# 调用时创建新的执行栈帧
result = data_processor(
    original_data,
    transform_func=lambda x: x ** 2
)
print(f"原始数据: {original_data}")
print(f"处理结果: {result}")

# 多返回值的技术实现：元组打包
def statistical_analysis(dataset):
    """统计分析函数 - 返回多个统计量"""
    if not dataset:
        return None, None, None, None
    
    n = len(dataset)
    mean = sum(dataset) / n
    variance = sum((x - mean) ** 2 for x in dataset) / (n - 1) if n > 1 else 0
    std_dev = variance ** 0.5
    
    # Python自动将多个值打包为元组
    return mean, variance, std_dev, n

# 元组解包赋值
test_data = [10, 20, 30, 40, 50]
mean, var, std, count = statistical_analysis(test_data)
print(f"统计结果: 均值={mean:.2f}, 方差={var:.2f}, 标准差={std:.2f}, 样本数={count}")
```

### 参数传递机制与内存管理

```python
# 参数传递机制的技术实现
def demonstrate_parameter_passing():
    """演示Python参数传递的技术细节"""
    
    # 1. 对象引用传递机制
    def modify_list(lst):
        """修改可变对象的内容"""
        print(f"函数内部 - 参数ID: {id(lst)}")
        lst.append('modified')
        return lst
    
    def modify_number(num):
        """尝试修改不可变对象"""
        print(f"函数内部 - 参数ID: {id(num)}")
        num = num + 10  # 创建新对象
        print(f"函数内部 - 新对象ID: {id(num)}")
        return num
    
    # 测试可变对象传递
    original_list = [1, 2, 3]
    print(f"原始列表ID: {id(original_list)}")
    result_list = modify_list(original_list)
    print(f"原始列表内容: {original_list}")  # [1, 2, 3, 'modified']
    
    # 测试不可变对象传递
    original_number = 5
    print(f"原始数字ID: {id(original_number)}")
    result_number = modify_number(original_number)
    print(f"原始数字值: {original_number}")  # 5 (未改变)
    print(f"返回值: {result_number}")        # 15

# 2. 高级参数模式与性能优化
def efficient_data_processor(
    data,                    # 位置参数
    transform=None,          # 默认参数
    *additional_data,        # 可变位置参数
    batch_size=1000,         # 仅关键字参数
    **processing_options     # 可变关键字参数
):
    """
    高性能数据处理器
    
    技术特点：
    - 批处理演示：分批应用变换，但仍将全部输入和输出保存在内存中
    - 参数验证：类型检查和边界检查
    - 配置灵活性：支持多种处理选项
    
    Args:
        data: 主要数据集
        transform: 变换函数
        additional_data: 额外数据集
        batch_size: 批处理大小（仅关键字）
        processing_options: 处理选项字典
    """
    
    # 参数验证和类型检查
    if not hasattr(data, '__iter__'):
        raise TypeError("data必须是可迭代对象")
    
    if transform and not callable(transform):
        raise TypeError("transform必须是可调用对象")
    
    # 批处理逻辑
    results = []
    data_combined = list(data) + list(additional_data)
    
    # 分批应用变换；此实现不保证降低整体峰值内存
    for i in range(0, len(data_combined), batch_size):
        batch = data_combined[i:i + batch_size]
        
        if transform:
            batch_results = [transform(item) for item in batch]
        else:
            batch_results = batch
            
        results.extend(batch_results)
    
    # 应用处理选项
    if processing_options.get('sort', False):
        results.sort()
    
    if processing_options.get('unique', False):
        results = list(set(results))
    
    return results

# 3. 参数解包与动态调用
def dynamic_function_calling():
    """展示动态函数调用技术"""
    
    def statistical_func(data, method='mean', **kwargs):
        """统计计算函数"""
        if method == 'mean':
            return sum(data) / len(data)
        elif method == 'median':
            sorted_data = sorted(data)
            n = len(sorted_data)
            mid = n // 2
            return sorted_data[mid] if n % 2 == 1 else (sorted_data[mid-1] + sorted_data[mid]) / 2
        elif method == 'mode':
            from collections import Counter
            counter = Counter(data)
            return counter.most_common(1)[0][0]
        else:
            raise ValueError(f"不支持的方法: {method}")
    
    # 参数字典，支持动态配置
    call_configs = [
        {'data': [1, 2, 3, 4, 5], 'method': 'mean'},
        {'data': [1, 2, 2, 3, 4], 'method': 'median'},
        {'data': [1, 2, 2, 3, 4], 'method': 'mode'}
    ]
    
    # 动态调用
    for config in call_configs:
        result = statistical_func(**config)
        print(f"方法 {config['method']}: {result}")

# 示例调用
demonstrate_parameter_passing()
print("\n" + "="*50 + "\n")
dynamic_function_calling()
```

### 参数陷阱与内存安全

```python
# 默认参数的内存共享陷阱
def analyze_default_parameter_behavior():
    """分析默认参数的内存行为"""
    
    # 问题代码：可变默认参数
    def problematic_function(item, container=[]):
        """错误示例：默认参数共享同一对象"""
        container.append(item)
        print(f"容器ID: {id(container)}, 内容: {container}")
        return container
    
    # 观察问题现象
    print("=== 默认参数问题演示 ===")
    result1 = problematic_function("first")
    result2 = problematic_function("second")  # 两次调用共享同一个列表!
    
    # 技术原理解释
    print(f"\n默认参数对象ID: {id(problematic_function.__defaults__[0])}")
    print(f"result1 ID: {id(result1)}")
    print(f"result2 ID: {id(result2)}")
    print(f"ID相同: {id(result1) == id(result2)}")
    
    # 正确实现：运行时创建默认值
    def correct_function(item, container=None):
        """正确示例：运行时创建新对象"""
        if container is None:
            container = []  # 每次调用时创建新列表
        container.append(item)
        print(f"容器ID: {id(container)}, 内容: {container}")
        return container
    
    print("\n=== 正确实现演示 ===")
    result3 = correct_function("first")
    result4 = correct_function("second")  # 每次都是新列表
    print(f"result3 ID: {id(result3)}")
    print(f"result4 ID: {id(result4)}")
    print(f"ID不同: {id(result3) != id(result4)}")

# 深度拷贝与浅拷贝在函数参数中的应用
def safe_data_processing_patterns():
    """安全数据处理模式"""
    import copy
    
    def unsafe_nested_modify(data):
        """不安全的嵌套数据修改"""
        data[0].append('modified')
        return data
    
    def safe_shallow_copy(data):
        """浅拷贝保护"""
        data_copy = data.copy()  # 或 data[:]
        data_copy[0].append('modified')  # 注意：嵌套对象仍然共享!
        return data_copy
    
    def safe_deep_copy(data):
        """深拷贝完全保护"""
        data_copy = copy.deepcopy(data)
        data_copy[0].append('modified')
        return data_copy
    
    # 测试数据
    original_nested = [[1, 2], [3, 4|1, 2], [3, 4]]
    
    print("=== 嵌套数据修改测试 ===")
    print(f"原始数据: {original_nested}")
    
    # 浅拷贝测试
    result_shallow = safe_shallow_copy(original_nested)
    print(f"浅拷贝后原始数据: {original_nested}")  # 仍被修改!
    print(f"浅拷贝结果: {result_shallow}")
    
    # 深拷贝测试
    original_nested_2 = [[1, 2], [3, 4|1, 2], [3, 4]]
    result_deep = safe_deep_copy(original_nested_2)
    print(f"深拷贝后原始数据: {original_nested_2}")  # 未被修改
    print(f"深拷贝结果: {result_deep}")

# 性能优化的参数传递策略
def performance_optimized_parameters():
    """性能优化的参数策略"""
    import time
    import sys
    
    def process_large_dataset_by_reference(data, transform_func):
        """通过引用传递大数据集（高效）"""
        # 直接操作原数据，节省内存
        for i in range(len(data)):
            data[i] = transform_func(data[i])
        return data
    
    def process_large_dataset_by_copy(data, transform_func):
        """通过拷贝处理大数据集（安全但低效）"""
        # 创建副本，占用更多内存
        data_copy = data.copy()
        for i in range(len(data_copy)):
            data_copy[i] = transform_func(data_copy[i])
        return data_copy
    
    # 性能测试
    large_data = list(range(100000))
    transform = lambda x: x * 2
    
    # 测试引用传递
    data1 = large_data.copy()
    start_time = time.time()
    result1 = process_large_dataset_by_reference(data1, transform)
    ref_time = time.time() - start_time
    ref_memory = sys.getsizeof(result1)
    
    # 测试拷贝传递
    data2 = large_data.copy()
    start_time = time.time()
    result2 = process_large_dataset_by_copy(data2, transform)
    copy_time = time.time() - start_time
    copy_memory = sys.getsizeof(result2)
    
    print("=== 性能对比 ===")
    print(f"引用传递时间: {ref_time:.4f}秒, 内存: {ref_memory} bytes")
    print(f"拷贝传递时间: {copy_time:.4f}秒, 内存: {copy_memory} bytes")
    print(f"时间差异: {((copy_time - ref_time) / ref_time * 100):.1f}%")

# 执行演示
analyze_default_parameter_behavior()
print("\n" + "="*50 + "\n")
safe_data_processing_patterns()
print("\n" + "="*50 + "\n")
performance_optimized_parameters()
```

---

## 作用域机制与内存模型

### LEGB作用域解析机制

```python
# LEGB作用域解析的技术实现
def demonstrate_scope_resolution():
    """演示Python作用域解析机制"""
    
    # 模拟变量查找过程
    def scope_analyzer():
        """作用域分析器"""
        import builtins
        
        # Built-in作用域（内置命名空间）
        print("Built-in作用域示例:")
        print(f"  len函数: {len}")
        print(f"  内置函数列表长度: {len(dir(builtins))}")
        
        # Global作用域（模块级别）
        global_counter = 100
        
        def enclosing_scope():
            # Enclosing作用域（外层函数）
            enclosing_var = "外层变量"
            enclosing_counter = 200
            
            def local_scope():
                # Local作用域（当前函数）
                local_var = "局部变量"
                local_counter = 300
                
                # 变量查找顺序演示
                print("\n变量查找顺序 (LEGB):")
                print(f"  Local: local_counter = {local_counter}")
                print(f"  Enclosing: enclosing_counter = {enclosing_counter}")
                print(f"  Global: global_counter = {global_counter}")
                print(f"  Built-in: abs(-5) = {abs(-5)}")
                
                # 同名变量的遮蔽效应
                counter = "局部counter"  # 遮蔽外层的counter变量
                print(f"  变量遮蔽: counter = {counter}")
                
                # 使用globals()和locals()查看命名空间
                print("\n命名空间内容:")
                print(f"  locals()键数量: {len(locals())}")
                print(f"  globals()键数量: {len(globals())}")
                
            return local_scope
        
        return enclosing_scope()
    
    # 执行作用域分析
    local_func = scope_analyzer()
    local_func()

# global和nonlocal的内存管理机制
def advanced_scope_control():
    """高级作用域控制技术"""
    global application_config
    
    # 全局状态管理
    application_config = {
        'debug': False,
        'max_connections': 100,
        'timeout': 30
    }
    
    def configure_application():
        """应用配置管理"""
        global application_config
        
        def set_debug(enabled):
            global application_config
            application_config['debug'] = enabled
            print(f"调试模式: {'开启' if enabled else '关闭'}")
        
        def get_config():
            return application_config.copy()  # 返回副本以防外部修改
        
        return set_debug, get_config
    
    # 闭包状态管理（推荐模式）
    def create_stateful_processor():
        """创建有状态的数据处理器"""
        
        # 封装的私有状态
        state = {
            'processed_count': 0,
            'error_count': 0,
            'last_result': None
        }
        
        def process_data(data):
            nonlocal state
            
            try:
                # 模拟数据处理
                result = [x * 2 for x in data if isinstance(x, (int, float))]
                state['processed_count'] += len(result)
                state['last_result'] = result
                return result
            
            except Exception as e:
                state['error_count'] += 1
                raise e
        
        def get_statistics():
            return state.copy()
        
        def reset_statistics():
            nonlocal state
            state = {
                'processed_count': 0,
                'error_count': 0,
                'last_result': None
            }
        
        # 返回接口函数
        return process_data, get_statistics, reset_statistics
    
    # 演示全局配置管理
    print("=== 全局配置管理 ===")
    set_debug, get_config = configure_application()
    set_debug(True)
    print(f"当前配置: {get_config()}")
    
    # 演示闭包状态管理
    print("\n=== 闭包状态管理 ===")
    processor, get_stats, reset_stats = create_stateful_processor()
    
    # 处理一些数据
    processor([1, 2, 3, "invalid", 4.5])
    processor([10, 20, 30])
    
    # 查看统计信息
    stats = get_stats()
    print(f"处理统计: {stats}")

# 作用域访问的性能分析
def scope_performance_analysis():
    """作用域访问的性能分析"""
    import time
    
    # 全局变量访问
    global_data = list(range(1000))
    
    def test_global_access():
        """测试全局变量访问性能"""
        total = 0
        for i in range(1000):
            total += len(global_data)  # 每次都要查找全局变量
        return total
    
    def test_local_access():
        """测试局部变量访问性能"""
        local_data = global_data  # 将全局变量缓存到局部
        total = 0
        for i in range(1000):
            total += len(local_data)  # 局部变量访问更快
        return total
    
    def test_builtin_access():
        """测试内置函数访问性能"""
        len_func = len  # 缓存内置函数
        total = 0
        for i in range(1000):
            total += len_func(global_data)
        return total
    
    # 性能测试
    tests = [
        ("全局变量访问", test_global_access),
        ("局部变量访问", test_local_access),
        ("内置函数缓存", test_builtin_access)
    ]
    
    print("=== 作用域访问性能对比 ===")
    for name, test_func in tests:
        start_time = time.time()
        result = test_func()
        elapsed = time.time() - start_time
        print(f"{name}: {elapsed:.6f}秒, 结果: {result}")

# 执行演示
demonstrate_scope_resolution()
print("\n" + "="*50 + "\n")
advanced_scope_control()
print("\n" + "="*50 + "\n")
scope_performance_analysis()
```

### 闭包机制与装饰器原理

```python
# 闭包的技术实现机制
def closure_technical_analysis():
    """闭包技术原理分析"""
    
    def create_accumulator(initial_value):
        """创建累加器闭包"""
        total = initial_value  # 自由变量（free variable）
        
        def accumulate(value):
            nonlocal total
            total += value
            return total
        
        # 闭包包含对外层作用域变量的引用
        return accumulate
    
    # 分析闭包的内部结构
    acc1 = create_accumulator(0)
    acc2 = create_accumulator(100)
    
    print("=== 闭包内部结构分析 ===")
    print(f"acc1闭包变量: {acc1.__closure__}")
    print(f"acc1自由变量值: {acc1.__closure__[0].cell_contents}")
    print(f"acc2自由变量值: {acc2.__closure__[0].cell_contents}")
    
    # 闭包变量的独立性
    print(f"acc1(10): {acc1(10)}")  # 10
    print(f"acc2(20): {acc2(20)}")  # 120
    print(f"acc1(5): {acc1(5)}")   # 15
    print(f"acc2自由变量: {acc2.__closure__[0].cell_contents}")  # 120

# 高级闭包模式：配置工厂
def advanced_closure_patterns():
    """高级闭包应用模式"""
    
    # 1. 配置生成器闭包
    def create_data_processor_factory(default_config):
        """数据处理器工厂"""
        
        def create_processor(**custom_config):
            # 合并默认配置和自定义配置
            config = {**default_config, **custom_config}
            
            def process(data):
                """具体的数据处理函数"""
                result = data
                
                # 应用配置中的处理步骤
                if config.get('normalize', False):
                    max_val = max(result) if result else 1
                    result = [x / max_val for x in result]
                
                if config.get('filter_negative', False):
                    result = [x for x in result if x >= 0]
                
                if config.get('sort', False):
                    result = sorted(result)
                
                return result
            
            # 将配置信息附加到函数上
            process.config = config
            return process
        
        return create_processor
    
    # 2. 缓存闭包
    def create_memoized_function(func):
        """创建具有记忆功能的函数"""
        cache = {}  # 缓存字典，存储在闭包中
        
        def memoized_func(*args, **kwargs):
            # 创建缓存键
            key = str(args) + str(sorted(kwargs.items()))
            
            if key in cache:
                print(f"缓存命中: {func.__name__}{args}")
                return cache[key]
            
            # 计算结果并缓存
            result = func(*args, **kwargs)
            cache[key] = result
            print(f"计算并缓存: {func.__name__}{args} = {result}")
            return result
        
        # 提供缓存管理接口
        memoized_func.cache_info = lambda: {'size': len(cache), 'keys': list(cache.keys())}
        memoized_func.clear_cache = lambda: cache.clear()
        
        return memoized_func
    
    # 使用配置工厂
    print("=== 配置工厂模式 ===")
    default_config = {'normalize': True, 'sort': False}
    processor_factory = create_data_processor_factory(default_config)
    
    # 创建不同配置的处理器
    basic_processor = processor_factory()
    advanced_processor = processor_factory(filter_negative=True, sort=True)
    
    test_data = [10, -5, 3, 8, -2]
    print(f"原始数据: {test_data}")
    print(f"基础处理: {basic_processor(test_data)}")
    print(f"高级处理: {advanced_processor(test_data)}")
    
    # 使用记忆化装饰器
    print("\n=== 记忆化功能 ===")
    
    @create_memoized_function
    def fibonacci(n):
        if n < 2:
            return n
        return fibonacci(n-1) + fibonacci(n-2)
    
    # 计算斐波那契数列
    print(f"fibonacci(10) = {fibonacci(10)}")
    print(f"缓存信息: {fibonacci.cache_info()}")
    
    # 再次计算，观察缓存效果
    print(f"fibonacci(8) = {fibonacci(8)}")

# 装饰器的技术实现原理
def decorator_technical_implementation():
    """装饰器技术实现原理"""
    import functools
    
    # 1. 函数装饰器的完整实现
    def comprehensive_decorator(prefix="LOG", include_args=True, include_result=True):
        """完整功能的装饰器"""
        
        def decorator(func):
            import functools
            import time
            import inspect
            
            @functools.wraps(func)  # 保留原函数的元信息
            def wrapper(*args, **kwargs):
                # 获取函数签名
                sig = inspect.signature(func)
                
                # 记录开始时间
                start_time = time.time()
                
                # 构造日志消息
                log_parts = [f"[{prefix}]", f"调用 {func.__name__}"]
                
                if include_args:
                    # 绑定参数到签名
                    bound_args = sig.bind(*args, **kwargs)
                    bound_args.apply_defaults()
                    args_str = ', '.join(f"{k}={v}" for k, v in bound_args.arguments.items())
                    log_parts.append(f"参数: ({args_str})")
                
                print(' '.join(log_parts[:2]))
                if include_args:
                    print(f"    {log_parts[2]}")
                
                try:
                    # 执行原函数
                    result = func(*args, **kwargs)
                    
                    # 记录执行时间
                    execution_time = time.time() - start_time
                    
                    if include_result:
                        print(f"    返回: {result}")
                    print(f"    执行时间: {execution_time:.4f}秒")
                    
                    return result
                
                except Exception as e:
                    execution_time = time.time() - start_time
                    print(f"    异常: {type(e).__name__}: {e}")
                    print(f"    执行时间: {execution_time:.4f}秒")
                    raise
            
            return wrapper
        return decorator
    
    # 2. 类装饰器实现
    class CallCounter:
        """函数调用计数器装饰器（类实现）"""
        
        def __init__(self, func):
            self.func = func
            self.count = 0
            # 保留原函数属性
            functools.update_wrapper(self, func)
        
        def __call__(self, *args, **kwargs):
            self.count += 1
            print(f"第{self.count}次调用 {self.func.__name__}")
            return self.func(*args, **kwargs)
        
        def reset_count(self):
            """重置计数器"""
            self.count = 0
    
    # 3. 装饰器链的执行顺序
    def order_demo_1(func):
        print(f"装饰器1: 装饰 {func.__name__}")
        def wrapper(*args, **kwargs):
            print("装饰器1: 执行前")
            result = func(*args, **kwargs)
            print("装饰器1: 执行后")
            return result
        return wrapper
    
    def order_demo_2(func):
        print(f"装饰器2: 装饰 {func.__name__}")
        def wrapper(*args, **kwargs):
            print("装饰器2: 执行前")
            result = func(*args, **kwargs)
            print("装饰器2: 执行后")
            return result
        return wrapper
    
    # 演示装饰器使用
    print("=== 高级装饰器演示 ===")
    
    @comprehensive_decorator(prefix="DATA", include_args=True, include_result=True)
    def process_numbers(numbers, operation='sum'):
        """处理数字列表"""
        if operation == 'sum':
            return sum(numbers)
        elif operation == 'mean':
            return sum(numbers) / len(numbers) if numbers else 0
        else:
            raise ValueError(f"不支持的操作: {operation}")
    
    # 测试装饰器
    result1 = process_numbers([1, 2, 3, 4, 5])
    result2 = process_numbers([10, 20, 30], operation='mean')
    
    print("\n=== 类装饰器演示 ===")
    
    @CallCounter
    def greet(name):
        return f"Hello, {name}!"
    
    # 测试类装饰器
    print(greet("Alice"))
    print(greet("Bob"))
    print(f"总调用次数: {greet.count}")
    
    print("\n=== 装饰器执行顺序 ===")
    
    @order_demo_1
    @order_demo_2
    def test_function():
        print("原函数执行")
        return "完成"
    
    print("\n执行被装饰的函数:")
    result = test_function()

# 执行技术分析
closure_technical_analysis()
print("\n" + "="*50 + "\n")
advanced_closure_patterns()
print("\n" + "="*50 + "\n")
decorator_technical_implementation()
```

---

## 高阶函数与函数式编程

### map、filter、reduce的实现原理

```python
# 函数式编程的核心概念与实现
def functional_programming_fundamentals():
    """函数式编程基础概念"""
    
    # 1. 高阶函数的实现原理
    def custom_map(func, iterable):
        """自定义map函数实现"""
        result = []
        for item in iterable:
            result.append(func(item))
        return result
    
    def custom_filter(predicate, iterable):
        """自定义filter函数实现"""
        result = []
        for item in iterable:
            if predicate(item):
                result.append(item)
        return result
    
    def custom_reduce(func, iterable, initializer=None):
        """自定义reduce函数实现"""
        it = iter(iterable)
        if initializer is None:
            try:
                accumulator = next(it)
            except StopIteration:
                raise TypeError('reduce() of empty sequence with no initial value')
        else:
            accumulator = initializer
        
        for element in it:
            accumulator = func(accumulator, element)
        return accumulator
    
    # 2. Lambda表达式的性能分析
    import time
    
    def performance_comparison():
        """Lambda vs 普通函数性能对比"""
        data = list(range(100000))
        
        # Lambda函数
        lambda_square = lambda x: x ** 2
        
        # 普通函数
        def normal_square(x):
            return x ** 2
        
        # 内置函数
        def builtin_pow_square(x):
            return pow(x, 2)
        
        # 性能测试
        functions = [
            ('Lambda', lambda_square),
            ('普通函数', normal_square),
            ('内置pow', builtin_pow_square)
        ]
        
        print("=== 函数调用性能对比 ===")
        for name, func in functions:
            start_time = time.time()
            result = [func(x) for x in data[:1000]]  # 测试1000个元素
            elapsed = time.time() - start_time
            print(f"{name}: {elapsed:.6f}秒")
    
    # 3. 高级函数式编程模式
    def advanced_functional_patterns():
        """高级函数式编程模式"""
        
        # 函数组合
        def compose(*functions):
            """函数组合器"""
            def inner(arg):
                for func in reversed(functions):
                    arg = func(arg)
                return arg
            return inner
        
        # 偏函数应用
        def partial(func, *partial_args, **partial_kwargs):
            """偏函数应用"""
            def inner(*args, **kwargs):
                # 合并参数
                combined_args = partial_args + args
                combined_kwargs = {**partial_kwargs, **kwargs}
                return func(*combined_args, **combined_kwargs)
            return inner
        
        # 柯里化
        def curry(func, arity=None):
            """函数柯里化"""
            if arity is None:
                import inspect
                arity = len(inspect.signature(func).parameters)
            
            def curried(*args, **kwargs):
                if len(args) + len(kwargs) >= arity:
                    return func(*args, **kwargs)
                return partial(curried, *args, **kwargs)
            
            return curried
        
        # 演示函数组合
        print("\n=== 函数组合演示 ===")
        
        # 定义基础函数
        add_10 = lambda x: x + 10
        multiply_2 = lambda x: x * 2
        square = lambda x: x ** 2
        
        # 组合函数
        complex_transform = compose(square, multiply_2, add_10)
        
        test_value = 5
        step1 = add_10(test_value)      # 5 + 10 = 15
        step2 = multiply_2(step1)       # 15 * 2 = 30
        step3 = square(step2)           # 30 ** 2 = 900
        
        print(f"逐步计算: {test_value} -> {step1} -> {step2} -> {step3}")
        print(f"函数组合: {test_value} -> {complex_transform(test_value)}")
        
        # 演示柯里化
        print("\n=== 柯里化演示 ===")
        
        def multiply_three(a, b, c):
            return a * b * c
        
        curried_multiply = curry(multiply_three)
        
        # 部分应用
        multiply_by_2 = curried_multiply(2)
        multiply_by_2_and_3 = multiply_by_2(3)
        
        result = multiply_by_2_and_3(4)  # 2 * 3 * 4 = 24
        print(f"柯里化结果: {result}")
    
    # 执行演示
    print("=== 自定义高阶函数测试 ===")
    numbers = [1, 2, 3, 4, 5]
    
    # 测试自定义函数
    squared = custom_map(lambda x: x ** 2, numbers)
    evens = custom_filter(lambda x: x % 2 == 0, numbers)
    total = custom_reduce(lambda x, y: x + y, numbers)
    
    print(f"原始数据: {numbers}")
    print(f"平方结果: {squared}")
    print(f"偶数筛选: {evens}")
    print(f"求和结果: {total}")
    
    # 执行性能比较
    performance_comparison()
    
    # 执行高级模式
    advanced_functional_patterns()

# 数据处理中的函数式编程应用
def data_processing_functional_examples():
    """数据处理中的函数式编程实例"""
    
    # 数据管道处理
    class DataPipeline:
        """函数式数据管道"""
        
        def __init__(self, data):
            self.data = data
        
        def map(self, func):
            """映射操作"""
            return DataPipeline(list(map(func, self.data)))
        
        def filter(self, predicate):
            """过滤操作"""
            return DataPipeline(list(filter(predicate, self.data)))
        
        def reduce(self, func, initial=None):
            """归约操作"""
            from functools import reduce
            if initial is not None:
                return reduce(func, self.data, initial)
            return reduce(func, self.data)
        
        def group_by(self, key_func):
            """分组操作"""
            from collections import defaultdict
            groups = defaultdict(list)
            for item in self.data:
                key = key_func(item)
                groups[key].append(item)
            return dict(groups)
        
        def to_list(self):
            """转换为列表"""
            return self.data
    
    # 复杂数据处理示例
    print("=== 函数式数据管道演示 ===")
    
    # 模拟销售数据
    sales_data = [
        {'product': 'A', 'region': 'North', 'sales': 1000, 'quarter': 'Q1'},
        {'product': 'B', 'region': 'South', 'sales': 1500, 'quarter': 'Q1'},
        {'product': 'A', 'region': 'North', 'sales': 1200, 'quarter': 'Q2'},
        {'product': 'C', 'region': 'East', 'sales': 800, 'quarter': 'Q1'},
        {'product': 'B', 'region': 'South', 'sales': 1800, 'quarter': 'Q2'},
        {'product': 'A', 'region': 'West', 'sales': 900, 'quarter': 'Q2'},
    ]
    
    # 函数式数据处理管道
    pipeline_result = (DataPipeline(sales_data)
                      .filter(lambda x: x['quarter'] == 'Q2')  # 筛选Q2数据
                      .filter(lambda x: x['sales'] > 1000)     # 筛选高销售额
                      .map(lambda x: {**x, 'sales_category': 'High' if x['sales'] > 1500 else 'Medium'})  # 添加分类
                      .to_list())
    
    print("Q2高销售额数据:")
    for item in pipeline_result:
        print(f"  {item['product']} - {item['region']}: {item['sales']} ({item['sales_category']})")
    
    # 使用reduce进行聚合分析
    print("\n=== 聚合分析 ===")
    
    # 按产品聚合销售额
    product_sales = (DataPipeline(sales_data)
                    .group_by(lambda x: x['product']))
    
    for product, records in product_sales.items():
        total_sales = sum(record['sales'] for record in records)
        print(f"产品 {product} 总销售额: {total_sales}")
    
    # 复杂的函数式变换
    print("\n=== 复杂变换示例 ===")
    
    # 链式变换：标准化 -> 分类 -> 排序
    numbers = [1, 5, 3, 9, 2, 8, 4, 7, 6]
    
    def normalize(data):
        """标准化到0-1范围"""
        max_val = max(data)
        min_val = min(data)
        return [(x - min_val) / (max_val - min_val) for x in data]
    
    def categorize(value):
        """分类函数"""
        if value < 0.33:
            return 'Low'
        elif value < 0.67:
            return 'Medium'
        else:
            return 'High'
    
    normalized = normalize(numbers)
    categorized = list(map(categorize, normalized))
    
    print(f"原始数据: {numbers}")
    print(f"标准化后: {[round(x, 2) for x in normalized]}")
    print(f"分类结果: {categorized}")
    
    # 统计各类别数量
    from collections import Counter
    category_counts = Counter(categorized)
    print(f"类别统计: {dict(category_counts)}")

# 执行函数式编程演示
functional_programming_fundamentals()
print("\n" + "="*50 + "\n")
data_processing_functional_examples()
```

### 生成器与惰性求值机制

```python
# 生成器的技术原理与实现机制
def generator_technical_analysis():
    """生成器技术原理分析"""
    
    # 1. 生成器状态机机制
    def stateful_generator():
        """演示生成器的状态保持机制"""
        print("生成器开始执行")
        state = "初始状态"
        
        for i in range(3):
            state = f"第{i+1}次迭代"
            print(f"生成器状态: {state}")
            value = yield i  # yield可以接收外部发送的值
            
            if value is not None:
                print(f"接收到外部值: {value}")
                state += f" (接收值: {value})"
        
        print("生成器执行完毕")
        return "生成器返回值"  # StopIteration异常的value
    
    # 演示生成器状态机制
    print("=== 生成器状态机制 ===")
    gen = stateful_generator()
    
    try:
        # 启动生成器
        value1 = next(gen)  # 或 gen.send(None)
        print(f"获取值: {value1}")
        
        # 发送值给生成器
        value2 = gen.send("外部数据")
        print(f"获取值: {value2}")
        
        value3 = next(gen)
        print(f"获取值: {value3}")
        
        # 尝试继续迭代，会引发StopIteration
        value4 = next(gen)
        
    except StopIteration as e:
        print(f"生成器结束，返回值: {e.value}")
    
    # 2. 生成器表达式的内存效率分析
    def memory_efficiency_analysis():
        """内存效率分析"""
        import sys
        import time
        
        data_size = 1000000
        
        # 列表推导式（立即计算所有值）
        print("\n=== 内存效率对比 ===")
        
        start_time = time.time()
        list_comp = [x**2 for x in range(data_size)]
        list_time = time.time() - start_time
        list_memory = sys.getsizeof(list_comp)
        
        # 生成器表达式（惰性计算）
        start_time = time.time()
        gen_exp = (x**2 for x in range(data_size))
        gen_time = time.time() - start_time
        gen_memory = sys.getsizeof(gen_exp)
        
        print(f"列表推导式: 创建时间={list_time:.4f}s, 内存={list_memory:,} bytes")
        print(f"生成器表达式: 创建时间={gen_time:.6f}s, 内存={gen_memory} bytes")
        print(f"内存节省: {((list_memory - gen_memory) / list_memory * 100):.1f}%")
        
        # 测试迭代性能
        start_time = time.time()
        sum_list = sum(list_comp)
        list_iter_time = time.time() - start_time
        
        # 重新创建生成器（生成器只能迭代一次）
        gen_exp = (x**2 for x in range(data_size))
        start_time = time.time()
        sum_gen = sum(gen_exp)
        gen_iter_time = time.time() - start_time
        
        print(f"列表求和时间: {list_iter_time:.4f}s, 结果: {sum_list}")
        print(f"生成器求和时间: {gen_iter_time:.4f}s, 结果: {sum_gen}")
    
    # 3. 高级生成器模式
    def advanced_generator_patterns():
        """高级生成器应用模式"""
        
        # 生成器管道
        def read_numbers(data):
            """读取数字生成器"""
            for item in data:
                if isinstance(item, (int, float)):
                    yield item
        
        def filter_positive(numbers):
            """过滤正数生成器"""
            for num in numbers:
                if num > 0:
                    yield num
        
        def square_numbers(numbers):
            """平方生成器"""
            for num in numbers:
                yield num ** 2
        
        def batch_generator(iterable, batch_size):
            """批处理生成器"""
            batch = []
            for item in iterable:
                batch.append(item)
                if len(batch) == batch_size:
                    yield batch
                    batch = []
            if batch:  # 处理剩余元素
                yield batch
        
        # 构建处理管道
        print("\n=== 生成器管道演示 ===")
        raw_data = [1, -2, 3.5, "abc", -4, 5, 0, 6.7, "def", -8]
        
        # 构建管道
        numbers = read_numbers(raw_data)
        positive_numbers = filter_positive(numbers)
        squared_numbers = square_numbers(positive_numbers)
        batched_results = batch_generator(squared_numbers, 3)
        
        print(f"原始数据: {raw_data}")
        for i, batch in enumerate(batched_results):
            print(f"批次 {i+1}: {batch}")
    
    # 执行分析
    memory_efficiency_analysis()
    advanced_generator_patterns()

# 大数据处理中的生成器应用
def big_data_generator_applications():
    """大数据处理中的生成器应用"""
    
    # 1. 流式数据处理
    def streaming_data_processor(data_stream, window_size=100):
        """流式数据处理器"""
        window = []
        
        for data_point in data_stream:
            window.append(data_point)
            
            if len(window) >= window_size:
                # 计算窗口统计信息
                stats = {
                    'count': len(window),
                    'mean': sum(window) / len(window),
                    'min': min(window),
                    'max': max(window)
                }
                yield stats
                
                # 滑动窗口：保留一半数据
                window = window[window_size//2:]
    
    # 2. 文件系统遍历生成器
    def file_system_walker(root_path, file_extension=None):
        """文件系统遍历生成器"""
        import os
        
        try:
            for root, dirs, files in os.walk(root_path):
                for file in files:
                    if file_extension is None or file.endswith(file_extension):
                        file_path = os.path.join(root, file)
                        file_size = os.path.getsize(file_path)
                        yield {
                            'path': file_path,
                            'name': file,
                            'size': file_size,
                            'directory': root
                        }
        except OSError as e:
            print(f"文件系统访问错误: {e}")
    
    # 3. 数据清洗生成器
    def data_cleaning_generator(raw_data):
        """数据清洗生成器"""
        for record in raw_data:
            # 数据验证
            if not isinstance(record, dict):
                continue
            
            cleaned_record = {}
            
            for key, value in record.items():
                # 清理字符串数据
                if isinstance(value, str):
                    value = value.strip()
                    if value.lower() in ['', 'null', 'none', 'n/a']:
                        value = None
                
                # 数值转换
                if isinstance(value, str) and value.replace('.', '').replace('-', '').isdigit():
                    try:
                        value = float(value) if '.' in value else int(value)
                    except ValueError:
                        pass
                
                cleaned_record[key] = value
            
            # 只返回有效记录
            if any(v is not None for v in cleaned_record.values()):
                yield cleaned_record
    
    # 4. 分页数据获取生成器
    def paginated_data_fetcher(fetch_function, page_size=100, max_pages=None):
        """分页数据获取生成器"""
        page = 1
        
        while max_pages is None or page <= max_pages:
            try:
                data_page = fetch_function(page, page_size)
                
                if not data_page:  # 没有更多数据
                    break
                
                for item in data_page:
                    yield item
                
                page += 1
                
                # 如果返回的数据少于page_size，说明到了最后一页
                if len(data_page) < page_size:
                    break
                    
            except Exception as e:
                print(f"获取第{page}页数据时出错: {e}")
                break
    
    # 演示应用
    print("=== 大数据生成器应用演示 ===")
    
    # 流式数据处理演示
    def simulate_data_stream(size):
        """模拟数据流"""
        import random
        for i in range(size):
            yield random.uniform(0, 100)
    
    print("流式数据处理:")
    data_stream = simulate_data_stream(350)
    processor = streaming_data_processor(data_stream, window_size=100)
    
    for i, stats in enumerate(processor):
        if i < 3:  # 只显示前3个窗口
            print(f"  窗口 {i+1}: 平均值={stats['mean']:.2f}, 范围=[{stats['min']:.2f}, {stats['max']:.2f}]")
    
    # 数据清洗演示
    print("\n数据清洗处理:")
    dirty_data = [
        {'name': '  Alice  ', 'age': '25', 'score': '85.5'},
        {'name': 'Bob', 'age': 'N/A', 'score': '92'},
        {'name': '', 'age': '30', 'score': 'null'},
        {'name': 'Charlie', 'age': '28', 'score': '78.0'},
    ]
    
    cleaned_data = list(data_cleaning_generator(dirty_data))
    for record in cleaned_data:
        print(f"  {record}")
    
    # 模拟分页获取
    print("\n分页数据获取:")
    
    def mock_api_fetch(page, page_size):
        """模拟API分页获取"""
        # 模拟总共250条数据
        total_items = 250
        start = (page - 1) * page_size
        end = min(start + page_size, total_items)
        
        if start >= total_items:
            return []
        
        return [f"item_{i}" for i in range(start, end)]
    
    paginated_data = paginated_data_fetcher(mock_api_fetch, page_size=50, max_pages=3)
    fetched_items = list(paginated_data)
    print(f"  获取到 {len(fetched_items)} 个项目")
    print(f"  前5个: {fetched_items[:5]}")
    print(f"  后5个: {fetched_items[-5:]}")

# 执行生成器技术演示
generator_technical_analysis()
print("\n" + "="*50 + "\n")
big_data_generator_applications()
```

### 装饰器高级应用与元编程

```python
# 企业级装饰器设计模式
def enterprise_decorator_patterns():
    """企业级装饰器应用模式"""
    
    import functools
    import time
    import logging
    from threading import Lock
    import weakref
    
    # 1. 线程安全的单例装饰器
    def singleton(cls):
        """线程安全的单例装饰器"""
        instances = {}
        lock = Lock()
        
        @functools.wraps(cls)
        def get_instance(*args, **kwargs):
            if cls not in instances:
                with lock:
                    # 双重检查锁定模式
                    if cls not in instances:
                        instances[cls] = cls(*args, **kwargs)
            return instances[cls]
        
        get_instance.clear_instance = lambda: instances.pop(cls, None)
        return get_instance
    
    # 2. 智能重试装饰器
    def smart_retry(
        max_attempts=3,
        delay=1.0,
        backoff=2.0,
        exceptions=(Exception,),
        on_retry=None
    ):
        """智能重试装饰器，支持指数退避"""
        
        def decorator(func):
            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                attempt = 0
                current_delay = delay
                
                while attempt < max_attempts:
                    try:
                        return func(*args, **kwargs)
                    
                    except exceptions as e:
                        attempt += 1
                        
                        if attempt >= max_attempts:
                            raise e
                        
                        if on_retry:
                            on_retry(func.__name__, attempt, e, current_delay)
                        
                        time.sleep(current_delay)
                        current_delay *= backoff  # 指数退避
            
            return wrapper
        return decorator
    
    # 3. 性能监控装饰器
    class PerformanceMonitor:
        """性能监控装饰器类"""
        
        def __init__(self, threshold=1.0, log_level=logging.WARNING):
            self.threshold = threshold
            self.log_level = log_level
            self.stats = {}
            
            # 配置日志
            logging.basicConfig(level=logging.DEBUG)
            self.logger = logging.getLogger(__name__)
        
        def __call__(self, func):
            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                func_name = func.__name__
                
                start_time = time.time()
                try:
                    result = func(*args, **kwargs)
                    success = True
                except Exception as e:
                    result = e
                    success = False
                finally:
                    end_time = time.time()
                    execution_time = end_time - start_time
                    
                    # 更新统计信息
                    if func_name not in self.stats:
                        self.stats[func_name] = {
                            'calls': 0, 'total_time': 0, 'errors': 0,
                            'min_time': float('inf'), 'max_time': 0
                        }
                    
                    stats = self.stats[func_name]
                    stats['calls'] += 1
                    stats['total_time'] += execution_time
                    stats['min_time'] = min(stats['min_time'], execution_time)
                    stats['max_time'] = max(stats['max_time'], execution_time)
                    
                    if not success:
                        stats['errors'] += 1
                    
                    # 性能警告
                    if execution_time > self.threshold:
                        self.logger.log(
                            self.log_level,
                            f"性能警告: {func_name} 执行时间 {execution_time:.4f}s 超过阈值 {self.threshold}s"
                        )
                    
                    if not success:
                        raise result
                    
                return result
            
            return wrapper
        
        def get_stats(self, func_name=None):
            """获取性能统计信息"""
            if func_name:
                stats = self.stats.get(func_name, {})
                if stats and stats['calls'] > 0:
                    stats['avg_time'] = stats['total_time'] / stats['calls']
                return stats
            return self.stats.copy()
    
    # 4. 缓存装饰器with TTL
    class TTLCache:
        """带过期时间的缓存装饰器"""
        
        def __init__(self, ttl=300, max_size=128):
            self.ttl = ttl
            self.max_size = max_size
            self.cache = {}
            self.timestamps = {}
            self.access_order = []
        
        def __call__(self, func):
            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                # 创建缓存键
                key = self._make_key(args, kwargs)
                current_time = time.time()
                
                # 检查缓存是否有效
                if (key in self.cache and 
                    current_time - self.timestamps[key] < self.ttl):
                    
                    # 更新访问顺序（LRU）
                    self.access_order.remove(key)
                    self.access_order.append(key)
                    
                    return self.cache[key]
                
                # 计算新值
                result = func(*args, **kwargs)
                
                # 缓存管理
                self._evict_if_needed()
                
                self.cache[key] = result
                self.timestamps[key] = current_time
                self.access_order.append(key)
                
                return result
            
            wrapper.cache_info = lambda: {
                'size': len(self.cache),
                'max_size': self.max_size,
                'ttl': self.ttl
            }
            wrapper.clear_cache = self._clear_cache
            
            return wrapper
        
        def _make_key(self, args, kwargs):
            """创建缓存键"""
            return str(args) + str(sorted(kwargs.items()))
        
        def _evict_if_needed(self):
            """清理过期和超量缓存"""
            current_time = time.time()
            
            # 清理过期项
            expired_keys = [
                key for key, timestamp in self.timestamps.items()
                if current_time - timestamp >= self.ttl
            ]
            
            for key in expired_keys:
                self._remove_key(key)
            
            # LRU清理
            while len(self.cache) >= self.max_size:
                oldest_key = self.access_order.pop(0)
                self._remove_key(oldest_key)
        
        def _remove_key(self, key):
            """移除缓存项"""
            self.cache.pop(key, None)
            self.timestamps.pop(key, None)
            if key in self.access_order:
                self.access_order.remove(key)
        
        def _clear_cache(self):
            """清空缓存"""
            self.cache.clear()
            self.timestamps.clear()
            self.access_order.clear()
    
    # 演示企业级装饰器
    print("=== 企业级装饰器演示 ===")
    
    # 单例模式演示
    @singleton
    class ConfigurationManager:
        def __init__(self):
            self.config = {'debug': True, 'version': '1.0'}
            print("ConfigurationManager 实例创建")
        
        def get_config(self, key):
            return self.config.get(key)
    
    # 测试单例
    config1 = ConfigurationManager()
    config2 = ConfigurationManager()
    print(f"单例测试: {config1 is config2}")  # True
    
    # 性能监控演示
    monitor = PerformanceMonitor(threshold=0.1)
    
    @monitor
    def data_processing_task(size):
        """模拟数据处理任务"""
        if size > 1000:
            time.sleep(0.2)  # 模拟慢操作
        return [i**2 for i in range(size)]
    
    # 执行测试
    data_processing_task(100)
    data_processing_task(2000)  # 会触发性能警告
    data_processing_task(50)
    
    print("\n性能统计:")
    stats = monitor.get_stats('data_processing_task')
    if stats:
        print(f"  调用次数: {stats['calls']}")
        print(f"  平均耗时: {stats['avg_time']:.4f}s")
        print(f"  耗时范围: {stats['min_time']:.4f}s - {stats['max_time']:.4f}s")
    
    # TTL缓存演示
    print("\n=== TTL缓存演示 ===")
    
    cache = TTLCache(ttl=2, max_size=3)
    
    @cache
    def expensive_computation(n):
        """模拟昂贵计算"""
        print(f"计算 factorial({n})")
        result = 1
        for i in range(1, n + 1):
            result *= i
        return result
    
    # 测试缓存
    print(f"第一次计算: {expensive_computation(5)}")
    print(f"第二次计算: {expensive_computation(5)}")  # 缓存命中
    
    time.sleep(2.5)  # 等待缓存过期
    print(f"缓存过期后: {expensive_computation(5)}")  # 重新计算
    
    print(f"缓存信息: {expensive_computation.cache_info()}")

# 装饰器组合与元编程
def decorator_composition_and_metaprogramming():
    """装饰器组合与元编程技术"""
    import functools
    import time
    
    # 1. 装饰器工厂的工厂
    def create_decorator_factory(decorator_name, **default_options):
        """创建装饰器工厂的工厂函数"""
        
        def decorator_factory(**options):
            # 合并默认选项和用户选项
            merged_options = {**default_options, **options}
            
            def decorator(func):
                @functools.wraps(func)
                def wrapper(*args, **kwargs):
                    print(f"[{decorator_name}] 装饰器执行，选项: {merged_options}")
                    
                    # 根据装饰器名称执行不同逻辑
                    if decorator_name == 'timing':
                        start = time.time()
                        result = func(*args, **kwargs)
                        end = time.time()
                        if merged_options.get('verbose', False):
                            print(f"执行时间: {end - start:.4f}s")
                        return result
                    
                    elif decorator_name == 'logging':
                        level = merged_options.get('level', 'INFO')
                        print(f"[{level}] 调用函数: {func.__name__}")
                        return func(*args, **kwargs)
                    
                    else:
                        return func(*args, **kwargs)
                
                return wrapper
            return decorator
        return decorator_factory
    
    # 2. 条件装饰器
    def conditional_decorator(condition):
        """条件装饰器：只在满足条件时应用装饰"""
        def decorator(decorator_func):
            def actual_decorator(func):
                if condition():
                    return decorator_func(func)
                else:
                    return func
            return actual_decorator
        return decorator
    
    # 3. 装饰器类注册表
    class DecoratorRegistry:
        """装饰器注册表"""
        
        def __init__(self):
            self.decorators = {}
            self.function_metadata = {}
        
        def register(self, name, **metadata):
            """注册装饰器"""
            def decorator(func):
                self.decorators[name] = func
                self.function_metadata[name] = {
                    'function': func,
                    'metadata': metadata,
                    'registered_at': time.time()
                }
                
                @functools.wraps(func)
                def wrapper(*args, **kwargs):
                    # 可以在这里添加通用逻辑
                    return func(*args, **kwargs)
                
                return wrapper
            return decorator
        
        def get_function(self, name):
            """获取已注册的函数"""
            return self.decorators.get(name)
        
        def list_functions(self):
            """列出所有已注册的函数"""
            return list(self.decorators.keys())
        
        def get_metadata(self, name):
            """获取函数元数据"""
            return self.function_metadata.get(name, {})
    
    # 演示装饰器组合
    print("=== 装饰器组合与元编程演示 ===")
    
    # 创建装饰器工厂
    timing_decorator = create_decorator_factory('timing', verbose=True)
    logging_decorator = create_decorator_factory('logging', level='DEBUG')
    
    # 条件装饰器
    debug_mode = True
    
    @conditional_decorator(lambda: debug_mode)
    @timing_decorator(verbose=True)
    @conditional_decorator(lambda: debug_mode)
    @logging_decorator(level='DEBUG')
    def complex_calculation(n):
        """复杂计算函数"""
        result = sum(i**2 for i in range(n))
        time.sleep(0.1)  # 模拟计算时间
        return result
    
    print("调试模式开启时:")
    result1 = complex_calculation(100)
    
    # 关闭调试模式
    debug_mode = False
    
    # 重新定义函数以应用新的条件
    @conditional_decorator(lambda: debug_mode)
    @timing_decorator(verbose=True)
    def simple_calculation(n):
        return sum(i for i in range(n))
    
    print("\n调试模式关闭时:")
    result2 = simple_calculation(100)
    
    # 装饰器注册表演示
    print("\n=== 装饰器注册表演示 ===")
    
    registry = DecoratorRegistry()
    
    @registry.register('data_processor', category='data', version='1.0')
    def process_data(data):
        """数据处理函数"""
        return [x * 2 for x in data]
    
    @registry.register('data_validator', category='validation', version='1.1')
    def validate_data(data):
        """数据验证函数"""
        return all(isinstance(x, (int, float)) for x in data)
    
    # 使用注册表
    print(f"已注册函数: {registry.list_functions()}")
    
    # 通过名称调用函数
    processor = registry.get_function('data_processor')
    validator = registry.get_function('data_validator')
    
    test_data = [1, 2, 3, 4, 5]
    if validator(test_data):
        processed = processor(test_data)
        print(f"处理结果: {processed}")
    
    # 查看元数据
    metadata = registry.get_metadata('data_processor')
    print(f"处理器元数据: {metadata['metadata']}")

# 执行装饰器高级应用演示
enterprise_decorator_patterns()
print("\n" + "="*50 + "\n")
decorator_composition_and_metaprogramming()
```

---

## 实战项目：高性能数据分析框架

### 企业级数据处理框架设计

```python
import math
from functools import wraps
from typing import List, Dict, Union, Optional

class DataAnalysisToolkit:
    """数据分析工具包"""
    
    @staticmethod
    def validate_numeric_data(func):
        """数值数据验证装饰器"""
        @wraps(func)
        def wrapper(data, *args, **kwargs):
            if not data:
                raise ValueError("数据不能为空")
            
            # 尝试转换为数值类型
            numeric_data = []
            for item in data:
                try:
                    numeric_data.append(float(item))
                except (ValueError, TypeError):
                    raise ValueError(f"无法将 '{item}' 转换为数值")
            
            return func(numeric_data, *args, **kwargs)
        return wrapper
    
    @staticmethod
    @validate_numeric_data
    def descriptive_stats(data):
        """计算描述性统计"""
        n = len(data)
        mean = sum(data) / n
        variance = sum((x - mean) ** 2 for x in data) / (n - 1) if n > 1 else 0
        std_dev = math.sqrt(variance)
        
        sorted_data = sorted(data)
        
        # 计算分位数
        def percentile(data, p):
            index = (len(data) - 1) * p / 100
            lower = int(index)
            upper = lower + 1
            weight = index - lower
            
            if upper >= len(data):
                return data[lower]
            return data[lower] * (1 - weight) + data[upper] * weight
        
        return {
            "count": n,
            "mean": round(mean, 4),
            "std": round(std_dev, 4),
            "min": min(data),
            "25%": round(percentile(sorted_data, 25), 4),
            "50%": round(percentile(sorted_data, 50), 4),
            "75%": round(percentile(sorted_data, 75), 4),
            "max": max(data)
        }
    
    @staticmethod
    def detect_outliers(data, method="iqr", threshold=1.5):
        """异常值检测"""
        if method == "iqr":
            stats = DataAnalysisToolkit.descriptive_stats(data)
            q1, q3 = stats["25%"], stats["75%"]
            iqr = q3 - q1
            lower_bound = q1 - threshold * iqr
            upper_bound = q3 + threshold * iqr
            
            outliers = [x for x in data if x < lower_bound or x > upper_bound]
            return {
                "outliers": outliers,
                "outlier_indices": [i for i, x in enumerate(data) 
                                  if x < lower_bound or x > upper_bound],
                "bounds": (lower_bound, upper_bound)
            }
        
        elif method == "zscore":
            stats = DataAnalysisToolkit.descriptive_stats(data)
            mean, std = stats["mean"], stats["std"]
            if std == 0:
                return {"outliers": [], "outlier_indices": [], "threshold": threshold}
            
            z_scores = [(x - mean) / std for x in data]
            outliers = [data[i] for i, z in enumerate(z_scores) if abs(z) > threshold]
            outlier_indices = [i for i, z in enumerate(z_scores) if abs(z) > threshold]
            
            return {
                "outliers": outliers,
                "outlier_indices": outlier_indices,
                "z_scores": z_scores,
                "threshold": threshold
            }
    
    @staticmethod
    def correlation_coefficient(x_data, y_data):
        """计算皮尔逊相关系数"""
        if len(x_data) != len(y_data):
            raise ValueError("两个数据序列长度必须相同")
        
        n = len(x_data)
        if n < 2:
            raise ValueError("数据点数量必须至少为2")
        
        x_mean = sum(x_data) / n
        y_mean = sum(y_data) / n
        
        numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_data, y_data))
        x_variance = sum((x - x_mean) ** 2 for x in x_data)
        y_variance = sum((y - y_mean) ** 2 for y in y_data)
        
        denominator = math.sqrt(x_variance * y_variance)
        
        if denominator == 0:
            raise ValueError("任一序列方差为0时，皮尔逊相关系数未定义")
        
        return numerator / denominator
    
    @staticmethod
    def group_by_function(data, key_func, agg_func=None):
        """通用分组聚合函数"""
        groups = {}
        
        for item in data:
            key = key_func(item)
            if key not in groups:
                groups[key] = []
            groups[key].append(item)
        
        if agg_func:
            return {key: agg_func(values) for key, values in groups.items()}
        
        return groups

# 使用示例
def demo_data_analysis():
    """演示数据分析工具包使用"""
    
    # 测试数据
    sales_data = [
        {"product": "A", "sales": 1000, "region": "北方"},
        {"product": "B", "sales": 1500, "region": "南方"},
        {"product": "C", "sales": 800, "region": "北方"},
        {"product": "D", "sales": 2000, "region": "南方"},
        {"product": "E", "sales": 500, "region": "北方"},
        {"product": "F", "sales": 10000, "region": "南方"}  # 异常值
    ]
    
    # 提取销售额数据
    sales_amounts = [item["sales"] for item in sales_data]
    
    # 描述性统计
    print("=== 销售额描述性统计 ===")
    stats = DataAnalysisToolkit.descriptive_stats(sales_amounts)
    for key, value in stats.items():
        print(f"{key}: {value}")
    
    # 异常值检测
    print("\n=== 异常值检测 (IQR方法) ===")
    outliers_iqr = DataAnalysisToolkit.detect_outliers(sales_amounts, method="iqr")
    print(f"异常值: {outliers_iqr['outliers']}")
    print(f"正常范围: {outliers_iqr['bounds']}")
    
    print("\n=== 异常值检测 (Z-Score方法) ===")
    outliers_z = DataAnalysisToolkit.detect_outliers(sales_amounts, method="zscore", threshold=2)
    print(f"异常值: {outliers_z['outliers']}")
    
    # 分组分析
    print("\n=== 按地区分组分析 ===")
    regional_groups = DataAnalysisToolkit.group_by_function(
        sales_data,
        key_func=lambda x: x["region"],
        agg_func=lambda items: {
            "总销售额": sum(item["sales"] for item in items),
            "平均销售额": sum(item["sales"] for item in items) / len(items),
            "产品数量": len(items)
        }
    )
    
    for region, metrics in regional_groups.items():
        print(f"{region}: {metrics}")

if __name__ == "__main__":
    demo_data_analysis()
```

---

## 技术连接与应用扩展

**技术进阶路径**：
- **前置基础**：[[【技术与工具】/Python/04-Python数据结构|Python数据结构]]掌握
- **后续方向**：[[【技术与工具】/Python/06-Python面向对象|Python面向对象]]类设计
- **应用扩展**：[[【技术与工具】/Python/07-NumPy数值计算|NumPy数值计算]]、[[【技术与工具】/Python/09-Pandas数据结构|Pandas数据结构]]

**实际应用场景**：
- **数据工程**：构建ETL管道和数据处理流水线
- **性能优化**：使用生成器处理大数据集，装饰器监控性能
- **代码架构**：通过高阶函数和装饰器实现横切关注点
- **算法实现**：函数式编程风格的数学计算和统计分析

**性能优化要点**：
- **内存管理**：合理使用生成器避免大数据集内存溢出
- **缓存策略**：通过装饰器实现函数结果缓存
- **惰性求值**：利用生成器实现按需计算
- **并发编程**：为异步编程和多线程处理打好基础

> [!important] 企业级开发最佳实践
> 1. **类型提示**：使用typing模块提供类型信息
> 2. **错误处理**：实现完整的异常处理和日志记录
> 3. **性能监控**：使用装饰器监控函数执行性能
> 4. **测试覆盖**：为核心函数编写单元测试和集成测试
> 5. **文档规范**：遵循Google或Numpy文档字符串规范

---

**创建时间**：2024-06-29  
**最后更新**：2024-12-31  
**字数统计**：约15000字  
**阅读时长**：120-150分钟

#Python #函数编程 #装饰器 #生成器 #闭包 #函数式编程 #代码复用 #模块化