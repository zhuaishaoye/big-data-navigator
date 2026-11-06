---
title: Python面向对象编程 - OOP原理与实现机制详解
tags:
  - Python
  - OOP
  - 面向对象
  - 类
  - 对象
  - 封装
  - 继承
  - 多态
  - 元类
  - 描述符
created: 2024-06-29
updated: 2026-10-10
difficulty: 高级
duration: 90分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据科学家
  - 数据架构师
  - 数据分析师
  - Python框架与工具开发者
stability: stable
status: maintenance
access_tier: free
---


# Python面向对象编程 - OOP原理与实现机制详解

> [!abstract] 内容概览
> - **核心概念**：类与对象的内存模型、方法解析顺序（MRO）、特殊方法协议
> - **技术深度**：封装机制、继承链、多态实现、描述符协议、元类机制
> - **前置知识**：[[【技术与工具】/Python/05-Python函数编程|Python函数编程]]、变量作用域、装饰器
> - **应用场景**：数据模型设计、框架开发、设计模式实现、API封装
> - **学习重点**：理解Python对象模型和动态特性，掌握OOP设计原则

## Python对象模型基础

### 核心概念定义

**面向对象编程（OOP）**是一种编程范式，通过对象来组织代码。对象封装数据（属性）和行为（方法），支持抽象、封装、继承和多态四个基本特性。

**Python中的一切皆对象**：
```python
# 验证Python中一切皆对象的特性
import sys

# 数字是对象
num = 42
print(f"数字对象：{type(num)}, ID: {id(num)}")
print(f"数字对象的方法：{[m for m in dir(num) if not m.startswith('_')][:5]}")

# 函数是对象
def example_func():
    return "Hello"
    
print(f"\n函数对象：{type(example_func)}")
print(f"函数对象属性：{example_func.__name__}, {example_func.__doc__}")

# 类也是对象（由元类创建）
class ExampleClass:
    pass
    
print(f"\n类对象：{type(ExampleClass)}")
print(f"类的元类：{type(type(ExampleClass))}")
```

### 类与对象的内存模型

```python
class DataPoint:
    """数据点类 - 演示Python对象的内存结构"""
    
    class_var = "共享数据"  # 类变量，存储在类对象中
    
    def __init__(self, x, y):
        self.x = x  # 实例变量，存储在实例的__dict__中
        self.y = y
    
    def distance_from_origin(self):
        return (self.x ** 2 + self.y ** 2) ** 0.5

# 创建实例并分析内存结构
point1 = DataPoint(3, 4)
point2 = DataPoint(5, 12)

print("=== 对象内存结构分析 ===")
print(f"类对象 ID: {id(DataPoint)}")
print(f"实例1 ID: {id(point1)}, 实例2 ID: {id(point2)}")
print(f"实例1.__dict__: {point1.__dict__}")
print(f"实例2.__dict__: {point2.__dict__}")
print(f"类变量地址: {id(DataPoint.class_var)}")
print(f"通过实例访问类变量: {id(point1.class_var)}")

# 方法解析顺序（Method Resolution Order）
print(f"\n=== MRO分析 ===")
print(f"DataPoint MRO: {DataPoint.__mro__}")
print(f"方法查找路径: {[cls.__name__ for cls in DataPoint.__mro__]}")
```

---

## 类定义与实例化机制

### 类的创建过程

Python类的创建过程可概括为：
1. 确定类名、基类和元类，并准备类命名空间
2. 执行类体，填充类的命名空间
3. 调用元类（通常为type），使用类名、基类和已填充的命名空间创建类对象
4. 应用类装饰器（如有），并将结果绑定到类名

```python
import dis
from types import FunctionType

class DataModel:
    """数据模型类 - 演示类的创建和实例化过程"""
    
    # 类属性（存储在类对象中）
    model_version = "1.0"
    _instances = []  # 类级别的实例追踪
    
    def __init__(self, name, data_type):
        """实例化方法 - 初始化对象状态"""
        self.name = name
        self.data_type = data_type
        self._created_at = __import__('time').time()
        
        # 将实例添加到类级别的追踪列表
        DataModel._instances.append(self)
        
    def __new__(cls, *args, **kwargs):
        """对象创建方法 - 在__init__之前调用"""
        print(f"创建{cls.__name__}对象实例")
        instance = super().__new__(cls)
        return instance
    
    def __repr__(self):
        """对象的官方字符串表示"""
        return f"DataModel(name='{self.name}', type='{self.data_type}')"
    
    def __str__(self):
        """对象的非正式字符串表示"""
        return f"{self.name}数据模型 (类型: {self.data_type})"
    
    @classmethod
    def get_instance_count(cls):
        """类方法 - 获取实例数量"""
        return len(cls._instances)
    
    @staticmethod
    def validate_data_type(data_type):
        """静态方法 - 验证数据类型"""
        valid_types = ['numerical', 'categorical', 'text', 'datetime']
        return data_type in valid_types

# 演示对象创建过程
print("=== 对象创建和初始化过程 ===")
model1 = DataModel("用户行为", "categorical")
model2 = DataModel("销售额", "numerical")

print(f"\n创建的实例: {DataModel._instances}")
print(f"实例数量: {DataModel.get_instance_count()}")
print(f"数据类型验证: {DataModel.validate_data_type('text')}")

# 分析对象的内部结构
print(f"\n=== 对象内部结构分析 ===")
print(f"实例属性: {model1.__dict__}")
print(f"类属性: {[attr for attr in dir(DataModel) if not attr.startswith('__') and not callable(getattr(DataModel, attr))]}")
print(f"实例方法: {[method for method in dir(model1) if callable(getattr(model1, method)) and not method.startswith('_')]}")
```

### 特殊方法（魔术方法）详解

```python
class Vector:
    """向量类 - 演示特殊方法的实现"""
    
    def __init__(self, x, y):
        self.x = x
        self.y = y
    
    def __repr__(self):
        return f"Vector({self.x}, {self.y})"
    
    def __str__(self):
        return f"({self.x}, {self.y})"
    
    def __add__(self, other):
        """向量加法"""
        if isinstance(other, Vector):
            return Vector(self.x + other.x, self.y + other.y)
        return NotImplemented
    
    def __mul__(self, scalar):
        """向量标量乘法"""
        if isinstance(scalar, (int, float)):
            return Vector(self.x * scalar, self.y * scalar)
        return NotImplemented
    
    def __rmul__(self, scalar):
        """右乘运算"""
        return self.__mul__(scalar)
    
    def __abs__(self):
        """向量的模长"""
        return (self.x ** 2 + self.y ** 2) ** 0.5
    
    def __bool__(self):
        """布尔值转换"""
        return bool(abs(self))
    
    def __eq__(self, other):
        """相等比较"""
        if isinstance(other, Vector):
            return self.x == other.x and self.y == other.y
        return False
    
    def __hash__(self):
        """坐标哈希演示：x、y可变，作为字典键或集合元素期间不得修改坐标"""
        return hash((self.x, self.y))
    
    def __getitem__(self, index):
        """索引访问"""
        if index == 0:
            return self.x
        elif index == 1:
            return self.y
        else:
            raise IndexError("Vector索引只能是0或1")
    
    def __len__(self):
        """长度（维度）"""
        return 2
    
    def __iter__(self):
        """迭代器协议"""
        yield self.x
        yield self.y

# 演示特殊方法的使用
print("=== 特殊方法演示 ===")
v1 = Vector(3, 4)
v2 = Vector(1, 2)

print(f"向量表示: {repr(v1)}, {str(v1)}")
print(f"向量加法: {v1 + v2}")
print(f"标量乘法: {v1 * 2}, {3 * v1}")
print(f"向量模长: {abs(v1)}")
print(f"布尔转换: {bool(v1)}, {bool(Vector(0, 0))}")
print(f"相等比较: {v1 == v2}, {v1 == Vector(3, 4)}")
print(f"索引访问: v1[0]={v1[0]}, v1[1]={v1[1]}")
print(f"迭代: {list(v1)}")
print(f"哈希值: {hash(v1)}")
```

---

## 封装机制与数据保护

### 属性访问控制

```python
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
import threading
import logging

class SecureBankAccount:
    """银行账户教学示例 - 演示封装及部分加锁操作，不代表完整金融或线程安全实现"""
    
    # 类变量：银行基础配置
    _bank_name = "安全银行"
    _interest_rate = Decimal('0.03')  # 年利率3%
    _min_balance = Decimal('0')
    _max_daily_withdrawal = Decimal('50000')
    
    def __init__(self, account_number, owner_name, initial_balance=0):
        # 公共属性
        self.account_number = account_number
        self.owner_name = owner_name
        
        # 受保护属性（约定：子类可以访问）
        self._created_at = datetime.now()
        self._last_transaction_time = None
        
        # 私有属性（名称修饰：外部难以直接访问）
        self.__balance = Decimal(str(initial_balance))
        self.__daily_withdrawal = Decimal('0')
        self.__daily_withdrawal_date = datetime.now().date()
        self.__transaction_history = []
        self.__is_frozen = False
        
        # 线程锁保护并发操作
        self.__lock = threading.Lock()
        
        # 记录账户创建
        self.__add_transaction("账户创建", Decimal('0'), self.__balance)
    
    @property
    def balance(self):
        """余额属性：只读访问"""
        with self.__lock:
            return float(self.__balance)
    
    @property
    def is_frozen(self):
        """冻结状态：只读访问"""
        return self.__is_frozen
    
    @property 
    def daily_withdrawal_remaining(self):
        """当日可提取余额"""
        self.__reset_daily_limit_if_needed()
        return float(self._max_daily_withdrawal - self.__daily_withdrawal)
    
    def __add_transaction(self, transaction_type, amount, balance_after):
        """私有方法：添加交易记录"""
        transaction = {
            'timestamp': datetime.now(),
            'type': transaction_type,
            'amount': float(amount),
            'balance_after': float(balance_after)
        }
        self.__transaction_history.append(transaction)
        self._last_transaction_time = transaction['timestamp']
    
    def __reset_daily_limit_if_needed(self):
        """私有方法：重置每日限额（如果需要）"""
        today = datetime.now().date()
        if self.__daily_withdrawal_date != today:
            self.__daily_withdrawal = Decimal('0')
            self.__daily_withdrawal_date = today
    
    def deposit(self, amount):
        """存款操作：余额更新在锁内，冻结检查尚未与更新原子化"""
        if self.__is_frozen:
            raise ValueError("账户已冻结，无法进行操作")
        
        amount = Decimal(str(amount))
        if amount <= 0:
            raise ValueError("存款金额必须大于0")
        
        with self.__lock:
            self.__balance += amount
            self.__add_transaction("存款", amount, self.__balance)
            return float(self.__balance)
    
    def withdraw(self, amount):
        """取款操作：包含各种限制检查"""
        if self.__is_frozen:
            raise ValueError("账户已冻结，无法进行操作")
        
        amount = Decimal(str(amount))
        if amount <= 0:
            raise ValueError("取款金额必须大于0")
        
        with self.__lock:
            # 检查余额
            if amount > self.__balance:
                raise ValueError(f"余额不足：当前余额{self.__balance}，尝试提取{amount}")
            
            # 检查每日限额
            self.__reset_daily_limit_if_needed()
            if self.__daily_withdrawal + amount > self._max_daily_withdrawal:
                remaining = self._max_daily_withdrawal - self.__daily_withdrawal
                raise ValueError(f"超出每日取款限额：今日还可提取{remaining}")
            
            # 执行取款
            self.__balance -= amount
            self.__daily_withdrawal += amount
            self.__add_transaction("取款", -amount, self.__balance)
            return float(self.__balance)
    
    def freeze_account(self):
        """冻结账户"""
        with self.__lock:
            self.__is_frozen = True
            self.__add_transaction("账户冻结", Decimal('0'), self.__balance)
    
    def unfreeze_account(self):
        """解冻账户"""
        with self.__lock:
            self.__is_frozen = False
            self.__add_transaction("账户解冻", Decimal('0'), self.__balance)
    
    def get_statement(self, days=30):
        """获取账户对账单"""
        cutoff_date = datetime.now() - timedelta(days=days)
        
        recent_transactions = [
            t for t in self.__transaction_history 
            if t['timestamp'] >= cutoff_date
        ]
        
        return {
            'account_number': self.account_number,
            'owner': self.owner_name,
            'current_balance': float(self.__balance),
            'statement_period': f"最近{days}天",
            'transactions': recent_transactions
        }
    
    def __str__(self):
        return f"账户({self.account_number}) - {self.owner_name}: ¥{self.balance:.2f}"
    
    def __repr__(self):
        return f"SecureBankAccount('{self.account_number}', '{self.owner_name}', {self.balance})"

# 演示封装机制
print("=== 银行账户封装机制演示 ===")
account = SecureBankAccount("ACC001", "张三", 10000)

# 正常操作
print(f"初始状态: {account}")
print(f"存款1000: 余额 = {account.deposit(1000)}")
print(f"取款500: 余额 = {account.withdraw(500)}")

# 属性访问
print(f"\n当前余额（只读）: {account.balance}")
print(f"今日剩余可提取额度: {account.daily_withdrawal_remaining}")
print(f"账户创建时间: {account._created_at}")

# 尝试直接访问私有属性（会失败或显示修饰后的名称）
print(f"\n=== 私有属性访问测试 ===")
try:
    print(account.__balance)  # 这会引发AttributeError
except AttributeError:
    print("无法直接访问 __balance（这是正确的行为）")

# 但可以通过名称修饰访问（不推荐这样做）
print(f"通过名称修饰访问: {account._SecureBankAccount__balance}")

# 获取对账单
statement = account.get_statement()
print(f"\n=== 账户对账单 ===")
for transaction in statement['transactions']:
    print(f"{transaction['timestamp'].strftime('%Y-%m-%d %H:%M')} - {transaction['type']}: {transaction['amount']}")
```

---

### 描述符协议高级应用

```python
class ValidatedAttribute:
    """描述符：实现属性验证"""
    
    def __init__(self, validation_func=None, doc=None):
        self.validation_func = validation_func
        self.doc = doc
    
    def __set_name__(self, owner, name):
        self.name = name
        self.private_name = '_' + name
    
    def __get__(self, obj, objtype=None):
        if obj is None:
            return self
        return getattr(obj, self.private_name)
    
    def __set__(self, obj, value):
        if self.validation_func:
            self.validation_func(value)
        setattr(obj, self.private_name, value)
    
    def __delete__(self, obj):
        raise AttributeError(f"无法删除属性 {self.name}")

class LoggedAttribute:
    """描述符：演示访问日志；当前值和日志由所有实例共享，并非实例独立存储"""
    
    def __init__(self, initial_value=None):
        self.value = initial_value
        self.access_log = []
    
    def __set_name__(self, owner, name):
        self.name = name
    
    def __get__(self, obj, objtype=None):
        if obj is None:
            return self
        
        import time
        self.access_log.append({
            'operation': 'get',
            'timestamp': time.time(),
            'object_id': id(obj)
        })
        return self.value
    
    def __set__(self, obj, value):
        import time
        old_value = self.value
        self.value = value
        self.access_log.append({
            'operation': 'set',
            'timestamp': time.time(),
            'object_id': id(obj),
            'old_value': old_value,
            'new_value': value
        })

# 验证函数
def validate_positive(value):
    if not isinstance(value, (int, float)) or value <= 0:
        raise ValueError(f"值必须是正数，得到: {value}")

def validate_string_length(value, min_len=1, max_len=100):
    if not isinstance(value, str) or not (min_len <= len(value) <= max_len):
        raise ValueError(f"字符串长度必须在{min_len}-{max_len}之间")

class DataRecord:
    """使用描述符的数据记录类"""
    
    # 使用描述符定义属性
    price = ValidatedAttribute(validate_positive, "产品价格（必须为正数）")
    quantity = ValidatedAttribute(validate_positive, "数量（必须为正数）")
    description = ValidatedAttribute(
        lambda x: validate_string_length(x, 1, 200), 
        "产品描述"
    )
    
    # 带日志的属性
    status = LoggedAttribute("active")
    
    def __init__(self, price, quantity, description):
        self.price = price
        self.quantity = quantity  
        self.description = description
        self._created_at = datetime.now()
    
    @property
    def total_value(self):
        """计算属性：总价值"""
        return self.price * self.quantity
    
    def get_access_log(self):
        """获取status字段的访问日志"""
        return DataRecord.status.access_log

# 演示描述符应用
print("=== 描述符协议演示 ===")

try:
    record = DataRecord(29.99, 10, "高质量数据分析工具")
    print(f"记录创建成功: {record.description}")
    print(f"总价值: {record.total_value}")
    
    # 触发验证
    record.price = 39.99
    print(f"价格更新成功: {record.price}")
    
    # 访问带日志的属性
    print(f"当前状态: {record.status}")
    record.status = "updated"
    print(f"新状态: {record.status}")
    
    # 查看访问日志
    log = record.get_access_log()
    print(f"\n访问日志: {len(log)}条记录")
    for entry in log[-2:]:
        print(f"  {entry['operation']}: {entry.get('new_value', '读取操作')}")
    
except ValueError as e:
    print(f"验证失败: {e}")

# 尝试无效输入
try:
    record.price = -10  # 这会触发验证错误
except ValueError as e:
    print(f"\n预期的验证错误: {e}")
```

---

## 继承机制与方法解析顺序（MRO）

### 单继承与方法重写

```python
class DataProcessor:
    """数据处理基类"""
    
    def __init__(self, name):
        super().__init__()
        self.name = name
        self.processed_count = 0
    
    def process(self, data):
        """基础处理方法"""
        self.processed_count += 1
        return f"基础处理: {data}"
    
    def get_stats(self):
        """获取处理统计"""
        return {'name': self.name, 'processed': self.processed_count}
    
    def __str__(self):
        return f"{self.__class__.__name__}({self.name})"

class CSVProcessor(DataProcessor):
    """CSV处理器 - 单继承示例"""
    
    def __init__(self, name, delimiter=','):
        super().__init__(name)  # 调用父类构造函数
        self.delimiter = delimiter
        self.headers = []
    
    def process(self, data):
        """重写父类方法"""
        # 调用父类方法
        base_result = super().process(data)
        
        # 添加CSV特定处理
        if isinstance(data, str):
            fields = data.split(self.delimiter)
            if not self.headers:
                self.headers = fields
                return f"CSV头部设置: {fields}"
            else:
                return f"CSV数据行: {dict(zip(self.headers, fields))}"
        
        return base_result
    
    def get_stats(self):
        """扩展父类方法"""
        stats = super().get_stats()
        stats.update({
            'delimiter': self.delimiter,
            'columns': len(self.headers),
            'headers': self.headers
        })
        return stats

# 演示单继承
print("=== 单继承演示 ===")
csv_proc = CSVProcessor("订单数据处理器")
print(csv_proc.process("order_id,customer,amount"))
print(csv_proc.process("001,张三,1200"))
print(csv_proc.process("002,李四,850"))
print(f"处理统计: {csv_proc.get_stats()}")
```

### 多重继承与MRO

```python
class Loggable:
    """日志混入类"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.log_entries = []
    
    def log(self, message):
        """记录日志"""
        from datetime import datetime
        entry = f"[{datetime.now()}] {message}"
        self.log_entries.append(entry)
        print(f"日志: {message}")
    
    def get_logs(self):
        """获取所有日志"""
        return self.log_entries.copy()

class Cacheable:
    """缓存混入类"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._cache = {}
        self._cache_hits = 0
        self._cache_misses = 0
    
    def get_from_cache(self, key):
        """从缓存获取"""
        if key in self._cache:
            self._cache_hits += 1
            return self._cache[key]
        else:
            self._cache_misses += 1
            return None
    
    def set_cache(self, key, value):
        """设置缓存"""
        self._cache[key] = value
    
    def get_cache_stats(self):
        """缓存统计"""
        total = self._cache_hits + self._cache_misses
        hit_rate = self._cache_hits / total if total > 0 else 0
        return {
            'size': len(self._cache),
            'hits': self._cache_hits,
            'misses': self._cache_misses,
            'hit_rate': f"{hit_rate:.2%}"
        }

class EnhancedProcessor(DataProcessor, Loggable, Cacheable):
    """增强处理器 - 多重继承示例"""
    
    def __init__(self, name, cache_size=100):
        # 多重继承时的初始化调用链
        super().__init__(name)
        self.cache_size = cache_size
    
    def process(self, data):
        """带缓存和日志的处理"""
        # 生成缓存键
        cache_key = hash(str(data))
        
        # 尝试从缓存获取
        cached_result = self.get_from_cache(cache_key)
        if cached_result is not None:
            self.log(f"缓存命中: {data}")
            return cached_result
        
        # 缓存未命中，进行处理
        self.log(f"开始处理: {data}")
        result = super().process(data)
        
        # 将结果存入缓存
        if len(self._cache) < self.cache_size:
            self.set_cache(cache_key, result)
            self.log(f"结果已缓存: {cache_key}")
        
        return result
    
    def get_full_stats(self):
        """获取完整统计信息"""
        stats = self.get_stats()
        stats.update({
            'logs_count': len(self.log_entries),
            'cache_stats': self.get_cache_stats()
        })
        return stats

# MRO分析
print("=== 方法解析顺序 (MRO) 分析 ===")
print(f"EnhancedProcessor MRO:")
for i, cls in enumerate(EnhancedProcessor.__mro__):
    print(f"  {i+1}. {cls.__name__}")

# 多重继承演示
print("\n=== 多重继承演示 ===")
enhanced_proc = EnhancedProcessor("高级数据处理器")

# 处理一些数据（会产生日志和缓存）
data_samples = ["样本1", "样本2", "样本1", "样本3", "样本1"]

for data in data_samples:
    result = enhanced_proc.process(data)
    print(f"处理结果: {result}")

print(f"\n完整统计: {enhanced_proc.get_full_stats()}")
```

### 抽象基类与接口设计

```python
from abc import ABC, abstractmethod
from typing import Protocol, runtime_checkable

class DataReader(ABC):
    """抽象数据读取器基类"""
    
    @abstractmethod
    def read(self, source):
        """读取数据 - 必须由子类实现"""
        pass
    
    @abstractmethod
    def validate(self, data):
        """验证数据 - 必须由子类实现"""
        pass
    
    # 具体方法可以被继承
    def preprocess(self, data):
        """预处理 - 可选重写"""
        return data
    
    # 模板方法模式
    def load_data(self, source):
        """数据加载流程模板"""
        print(f"开始从 {source} 加载数据")
        raw_data = self.read(source)
        
        print("验证数据格式")
        if not self.validate(raw_data):
            raise ValueError("数据验证失败")
        
        print("预处理数据")
        processed_data = self.preprocess(raw_data)
        
        print("数据加载完成")
        return processed_data

@runtime_checkable
class Serializable(Protocol):
    """序列化协议 - 使用Protocol定义接口"""
    
    def serialize(self) -> str:
        """序列化为字符串"""
        ...
    
    def deserialize(self, data: str) -> 'Serializable':
        """从字符串反序列化"""
        ...

class JSONDataReader(DataReader):
    """JSON数据读取器 - 实现抽象基类"""
    
    def read(self, source):
        """读取JSON数据"""
        import json
        
        if isinstance(source, str) and source.startswith('{'):
            return json.loads(source)
        else:
            # 模拟文件读取
            return {"data": [1, 2, 3], "metadata": {"version": "1.0"}}
    
    def validate(self, data):
        """验证JSON数据"""
        return isinstance(data, dict) and "data" in data
    
    def preprocess(self, data):
        """JSON特定的预处理"""
        # 添加处理时间戳
        data["processed_at"] = __import__('time').time()
        return data

class CSVDataReader(DataReader):
    """CSV数据读取器"""
    
    def read(self, source):
        """读取CSV数据"""
        if isinstance(source, str):
            lines = source.strip().split('\n')
            return [line.split(',') for line in lines]
        return []
    
    def validate(self, data):
        """验证CSV数据"""
        return isinstance(data, list) and len(data) > 0
    
    def preprocess(self, data):
        """CSV预处理：转换为字典格式"""
        if len(data) < 2:
            return data
        
        headers = data[0]
        rows = data[1:]
        return [dict(zip(headers, row)) for row in rows]

# 演示抽象基类
print("=== 抽象基类演示 ===")

# JSON读取器
json_reader = JSONDataReader()
json_data = json_reader.load_data('{"data": [1,2,3], "metadata": {"type": "test"}}')
print(f"JSON数据: {json_data}")

# CSV读取器
csv_reader = CSVDataReader()
csv_data = csv_reader.load_data("name,age,city\nAlice,25,NY\nBob,30,LA")
print(f"CSV数据: {csv_data}")

# 尝试创建抽象类实例（会失败）
try:
    abstract_reader = DataReader()  # TypeError
except TypeError as e:
    print(f"\n无法实例化抽象类: {e}")
```

---

## 多态机制与动态调度

### 方法多态与动态绑定

```python
from typing import List, Union
import time
from abc import ABC, abstractmethod

class DataTransformer(ABC):
    """数据变换器抽象基类"""
    
    def __init__(self, name: str):
        self.name = name
        self.transform_count = 0
        self.total_time = 0
    
    @abstractmethod
    def transform(self, data):
        """抽象变换方法"""
        pass
    
    def benchmark_transform(self, data):
        """带性能测试的变换"""
        start_time = time.perf_counter()
        result = self.transform(data)
        end_time = time.perf_counter()
        
        self.transform_count += 1
        self.total_time += (end_time - start_time)
        
        return result
    
    def get_stats(self):
        """获取性能统计"""
        avg_time = self.total_time / self.transform_count if self.transform_count > 0 else 0
        return {
            'name': self.name,
            'transforms': self.transform_count,
            'total_time': f"{self.total_time:.6f}s",
            'avg_time': f"{avg_time:.6f}s"
        }

class NumericNormalizer(DataTransformer):
    """数值标准化器"""
    
    def __init__(self, method='z_score'):
        super().__init__(f"数值标准化器({method})")
        self.method = method
        self._stats = None
    
    def transform(self, data: List[float]) -> List[float]:
        """数值标准化变换"""
        if not data:
            return data
        
        if self.method == 'z_score':
            mean_val = sum(data) / len(data)
            variance = sum((x - mean_val) ** 2 for x in data) / len(data)
            std_dev = variance ** 0.5
            
            if std_dev == 0:
                return [0] * len(data)
            
            return [(x - mean_val) / std_dev for x in data]
        
        elif self.method == 'min_max':
            min_val, max_val = min(data), max(data)
            if min_val == max_val:
                return [0] * len(data)
            return [(x - min_val) / (max_val - min_val) for x in data]
        
        return data

class TextTokenizer(DataTransformer):
    """文本标记器"""
    
    def __init__(self, to_lower=True, remove_punctuation=True):
        super().__init__("文本标记器")
        self.to_lower = to_lower
        self.remove_punctuation = remove_punctuation
    
    def transform(self, data: Union[str, List[str]]) -> List[str]:
        """文本标记化变换"""
        import re
        
        if isinstance(data, str):
            data = [data]
        
        results = []
        for text in data:
            if self.to_lower:
                text = text.lower()
            
            if self.remove_punctuation:
                text = re.sub(r'[^\w\s]', '', text)
            
            tokens = text.split()
            results.extend(tokens)
        
        return results

class DataFrameProcessor(DataTransformer):
    """数据框处理器"""
    
    def __init__(self, operations: List[str]):
        super().__init__("数据框处理器")
        self.operations = operations
    
    def transform(self, data: List[dict]) -> List[dict]:
        """数据框变换"""
        if not data:
            return data
        
        result = data.copy()
        
        for op in self.operations:
            if op == 'remove_nulls':
                result = [row for row in result if all(v is not None for v in row.values())]
            elif op == 'add_index':
                for i, row in enumerate(result):
                    row['_index'] = i
            elif op == 'sort_by_first_key':
                if result:
                    first_key = list(result[0].keys())[0]
                    result.sort(key=lambda x: x.get(first_key, 0))
        
        return result

# 多态演示：统一处理不同类型的变换器
def process_data_pipeline(transformers: List[DataTransformer], datasets: List):
    """数据处理管道 - 多态的实际应用"""
    print("=== 数据处理管道启动 ===")
    
    results = []
    
    for i, (transformer, dataset) in enumerate(zip(transformers, datasets)):
        print(f"\n步骤 {i+1}: 使用 {transformer.name} 处理数据")
        print(f"输入数据类型: {type(dataset).__name__}")
        print(f"输入数据长度: {len(dataset) if hasattr(dataset, '__len__') else '未知'}")
        
        # 多态调用：不同变换器的transform方法
        result = transformer.benchmark_transform(dataset)
        
        print(f"输出数据类型: {type(result).__name__}")
        print(f"输出数据长度: {len(result) if hasattr(result, '__len__') else '未知'}")
        print(f"处理统计: {transformer.get_stats()}")
        
        results.append(result)
    
    return results

# 创建不同类型的变换器
transformers = [
    NumericNormalizer('z_score'),
    TextTokenizer(to_lower=True, remove_punctuation=True),
    DataFrameProcessor(['remove_nulls', 'add_index', 'sort_by_first_key']),
    NumericNormalizer('min_max')
]

# 准备对应的测试数据
datasets = [
    [1, 5, 3, 8, 2, 9, 4, 7, 6],  # 数值数据
    ["Hello World!", "Python Programming.", "Data Science?"],  # 文本数据
    [  # 数据框数据
        {'name': 'Alice', 'age': 25, 'score': 85},
        {'name': 'Bob', 'age': None, 'score': 92},
        {'name': 'Charlie', 'age': 30, 'score': 78}
    ],
    [10, 20, 15, 25, 30, 5, 35]  # 另一组数值数据
]

# 运行多态处理管道
results = process_data_pipeline(transformers, datasets)

# 显示最终结果
print("\n=== 处理结果摘要 ===")
for i, result in enumerate(results):
    print(f"步骤 {i+1} 结果: {result[:3]}{'...' if len(result) > 3 else ''}")
```

### 运算符重载与协议实现

```python
class Matrix:
    """矩阵类 - 演示运算符重载和协议实现"""
    
    def __init__(self, data):
        """初始化矩阵"""
        if isinstance(data, int):
            # 创建零矩阵
            self.data = [[0] * data for _ in range(data)]
            self.rows = data
            self.cols = data
        else:
            # 从二维列表创建
            self.data = [row[:] for row in data]  # 复制外层列表和各行列表；不递归复制单元格对象
            self.rows = len(data)
            self.cols = len(data[0]) if data else 0
    
    def __str__(self):
        """字符串表示"""
        return '\n'.join([' '.join(f'{cell:6.2f}' for cell in row) for row in self.data])
    
    def __repr__(self):
        """开发者表示"""
        return f"Matrix({self.rows}x{self.cols})"
    
    def __add__(self, other):
        """矩阵加法"""
        if isinstance(other, Matrix):
            if self.rows != other.rows or self.cols != other.cols:
                raise ValueError(f"矩阵维度不匹配: {self.rows}x{self.cols} vs {other.rows}x{other.cols}")
            
            result = Matrix([[0] * self.cols for _ in range(self.rows)])
            for i in range(self.rows):
                for j in range(self.cols):
                    result.data[i][j] = self.data[i][j] + other.data[i][j]
            return result
        
        elif isinstance(other, (int, float)):
            # 标量加法
            result = Matrix(self.data)
            for i in range(self.rows):
                for j in range(self.cols):
                    result.data[i][j] += other
            return result
        
        return NotImplemented
    
    def __radd__(self, other):
        """右加法"""
        return self.__add__(other)
    
    def __mul__(self, other):
        """矩阵乘法或标量乘法"""
        if isinstance(other, Matrix):
            # 矩阵乘法
            if self.cols != other.rows:
                raise ValueError(f"矩阵乘法维度不匹配: {self.rows}x{self.cols} * {other.rows}x{other.cols}")
            
            result = Matrix([[0] * other.cols for _ in range(self.rows)])
            for i in range(self.rows):
                for j in range(other.cols):
                    for k in range(self.cols):
                        result.data[i][j] += self.data[i][k] * other.data[k][j]
            return result
        
        elif isinstance(other, (int, float)):
            # 标量乘法
            result = Matrix(self.data)
            for i in range(self.rows):
                for j in range(self.cols):
                    result.data[i][j] *= other
            return result
        
        return NotImplemented
    
    def __rmul__(self, other):
        """右乘法"""
        return self.__mul__(other)
    
    def __getitem__(self, key):
        """索引访问"""
        if isinstance(key, tuple) and len(key) == 2:
            i, j = key
            return self.data[i][j]
        else:
            return self.data[key]
    
    def __setitem__(self, key, value):
        """索引设置"""
        if isinstance(key, tuple) and len(key) == 2:
            i, j = key
            self.data[i][j] = value
        else:
            self.data[key] = value
    
    def __eq__(self, other):
        """相等比较"""
        if not isinstance(other, Matrix):
            return False
        
        if self.rows != other.rows or self.cols != other.cols:
            return False
        
        for i in range(self.rows):
            for j in range(self.cols):
                if abs(self.data[i][j] - other.data[i][j]) > 1e-9:
                    return False
        
        return True
    
    def transpose(self):
        """转置"""
        result = Matrix([[0] * self.rows for _ in range(self.cols)])
        for i in range(self.rows):
            for j in range(self.cols):
                result.data[j][i] = self.data[i][j]
        return result
    
    def __iter__(self):
        """迭代器协议"""
        for row in self.data:
            yield row

# 演示运算符重载
print("=== 运算符重载演示 ===")

# 创建矩阵
m1 = Matrix([
    [1, 2],
    [3, 4]
])

m2 = Matrix([
    [5, 6], 
    [7, 8]
])

print(f"矩阵 m1:\n{m1}\n")
print(f"矩阵 m2:\n{m2}\n")

# 矩阵运算
print(f"m1 + m2:\n{m1 + m2}\n")
print(f"m1 * m2 (矩阵乘法):\n{m1 * m2}\n")
print(f"m1 * 2 (标量乘法):\n{m1 * 2}\n")
print(f"m1 转置:\n{m1.transpose()}\n")

# 索引访问
print(f"m1[0, 1] = {m1[0, 1]}")
m1[0, 1] = 10
print(f"修改后 m1[0, 1] = {m1[0, 1]}")

# 迭代
print(f"\n矩阵迭代:")
for i, row in enumerate(m1):
    print(f"第{i}行: {row}")
```

---

## 元类与高级特性

### 元类机制深入理解

```python
class SingletonMeta(type):
    """单例模式元类"""
    
    _instances = {}
    _lock = __import__('threading').Lock()
    
    def __call__(cls, *args, **kwargs):
        """控制实例创建"""
        if cls not in cls._instances:
            with cls._lock:
                if cls not in cls._instances:
                    instance = super().__call__(*args, **kwargs)
                    cls._instances[cls] = instance
        return cls._instances[cls]
    
    def __new__(mcs, name, bases, attrs):
        """创建类时的定制"""
        # 为所有方法添加日志装饰器
        for key, value in attrs.items():
            if callable(value) and not key.startswith('_'):
                attrs[key] = mcs._add_logging(value, name, key)
        
        return super().__new__(mcs, name, bases, attrs)
    
    @staticmethod
    def _add_logging(func, class_name, method_name):
        """为方法添加日志"""
        def wrapper(*args, **kwargs):
            print(f"调用 {class_name}.{method_name}")
            return func(*args, **kwargs)
        return wrapper

class DatabaseConnection(metaclass=SingletonMeta):
    """数据库连接类 - 使用单例模式"""
    
    def __init__(self, host='localhost', port=5432):
        if hasattr(self, '_initialized'):
            return
        
        self.host = host
        self.port = port
        self.connected = False
        self._initialized = True
        print(f"初始化数据库连接: {host}:{port}")
    
    def connect(self):
        """连接数据库"""
        if not self.connected:
            self.connected = True
            print("数据库连接已建立")
    
    def disconnect(self):
        """断开连接"""
        if self.connected:
            self.connected = False
            print("数据库连接已断开")
    
    def execute_query(self, query):
        """执行查询"""
        if not self.connected:
            raise RuntimeError("数据库未连接")
        print(f"执行查询: {query}")
        return f"查询结果: {query}"

# 演示单例模式
print("=== 单例模式演示 ===")
db1 = DatabaseConnection()
db2 = DatabaseConnection('remote-host', 3306)

print(f"db1 is db2: {db1 is db2}")  # True
print(f"db1.host: {db1.host}, db2.host: {db2.host}")  # 都是localhost

db1.connect()
db1.execute_query("SELECT * FROM users")
```

### 设计模式在Python中的应用

```python
from typing import List, Dict, Any
from enum import Enum
import copy

class DataProcessingStrategy(ABC):
    """策略模式：数据处理策略接口"""
    
    @abstractmethod
    def process(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        pass

class FilterNullStrategy(DataProcessingStrategy):
    """过滤空值策略"""
    
    def process(self, data):
        return [row for row in data if all(v is not None for v in row.values())]

class SortByKeyStrategy(DataProcessingStrategy):
    """按键排序策略"""
    
    def __init__(self, key: str, reverse=False):
        self.key = key
        self.reverse = reverse
    
    def process(self, data):
        return sorted(data, key=lambda x: x.get(self.key, 0), reverse=self.reverse)

class AggregateStrategy(DataProcessingStrategy):
    """聚合策略"""
    
    def __init__(self, group_by: str, aggregate_key: str, operation='sum'):
        self.group_by = group_by
        self.aggregate_key = aggregate_key
        self.operation = operation
    
    def process(self, data):
        groups = {}
        for row in data:
            key = row.get(self.group_by)
            if key not in groups:
                groups[key] = []
            groups[key].append(row)
        
        result = []
        for group_key, group_data in groups.items():
            if self.operation == 'sum':
                total = sum(row.get(self.aggregate_key, 0) for row in group_data)
            elif self.operation == 'count':
                total = len(group_data)
            elif self.operation == 'avg':
                values = [row.get(self.aggregate_key, 0) for row in group_data]
                total = sum(values) / len(values) if values else 0
            
            result.append({
                self.group_by: group_key,
                f'{self.operation}_{self.aggregate_key}': total
            })
        
        return result

class DataProcessor:
    """数据处理器 - 使用策略模式"""
    
    def __init__(self):
        self._strategies: List[DataProcessingStrategy] = []
    
    def add_strategy(self, strategy: DataProcessingStrategy):
        """添加处理策略"""
        self._strategies.append(strategy)
        return self  # 支持链式调用
    
    def process(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """执行所有策略"""
        result = copy.deepcopy(data)
        
        for i, strategy in enumerate(self._strategies):
            print(f"执行策略 {i+1}: {strategy.__class__.__name__}")
            result = strategy.process(result)
            print(f"处理后数据量: {len(result)}")
        
        return result
    
    def clear_strategies(self):
        """清空策略"""
        self._strategies.clear()

# 工厂模式
class DataProcessorFactory:
    """数据处理器工厂"""
    
    @staticmethod
    def create_etl_processor() -> DataProcessor:
        """创建ETL处理器"""
        return (DataProcessor()
                .add_strategy(FilterNullStrategy())
                .add_strategy(SortByKeyStrategy('timestamp')))
    
    @staticmethod
    def create_analytics_processor(group_key: str) -> DataProcessor:
        """创建分析处理器"""
        return (DataProcessor()
                .add_strategy(FilterNullStrategy())
                .add_strategy(AggregateStrategy(group_key, 'value', 'sum'))
                .add_strategy(SortByKeyStrategy(f'sum_value', reverse=True)))
    
    @staticmethod
    def create_custom_processor(strategies: List[DataProcessingStrategy]) -> DataProcessor:
        """创建自定义处理器"""
        processor = DataProcessor()
        for strategy in strategies:
            processor.add_strategy(strategy)
        return processor

# 演示设计模式
print("\n=== 设计模式演示 ===")

# 测试数据
test_data = [
    {'id': 1, 'category': 'A', 'value': 100, 'timestamp': 1},
    {'id': 2, 'category': 'B', 'value': 200, 'timestamp': 3},
    {'id': 3, 'category': 'A', 'value': None, 'timestamp': 2},
    {'id': 4, 'category': 'B', 'value': 150, 'timestamp': 4},
    {'id': 5, 'category': 'A', 'value': 80, 'timestamp': 5}
]

print("原始数据:")
for row in test_data:
    print(f"  {row}")

# 使用工厂创建处理器
print("\n使用ETL处理器:")
etl_processor = DataProcessorFactory.create_etl_processor()
etl_result = etl_processor.process(test_data)
print(f"ETL结果: {etl_result}")

print("\n使用分析处理器:")
analytics_processor = DataProcessorFactory.create_analytics_processor('category')
analytics_result = analytics_processor.process(test_data)
print(f"分析结果: {analytics_result}")
```

---

## 数据科学中的OOP最佳实践

### 数据模型设计实例

```python
from typing import Optional, Union, List, Dict
from datetime import datetime
import json

class DataPoint:
    """数据点基类 - 数据科学中的核心概念"""
    
    def __init__(self, value: Union[int, float, str], 
                 timestamp: Optional[datetime] = None,
                 metadata: Optional[Dict] = None):
        self.value = value
        self.timestamp = timestamp or datetime.now()
        self.metadata = metadata or {}
        self._validation_errors = []
    
    def validate(self) -> bool:
        """数据验证"""
        self._validation_errors.clear()
        
        if self.value is None:
            self._validation_errors.append("值不能为空")
        
        if not isinstance(self.timestamp, datetime):
            self._validation_errors.append("时间戳格式错误")
        
        return len(self._validation_errors) == 0
    
    def get_validation_errors(self) -> List[str]:
        return self._validation_errors.copy()
    
    def to_dict(self) -> Dict:
        return {
            'value': self.value,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'metadata': self.metadata
        }
    
    def __repr__(self):
        return f"DataPoint(value={self.value}, timestamp={self.timestamp})"

class NumericDataPoint(DataPoint):
    """数值型数据点"""
    
    def __init__(self, value: Union[int, float], 
                 unit: Optional[str] = None, **kwargs):
        super().__init__(value, **kwargs)
        self.unit = unit
    
    def validate(self) -> bool:
        """扩展验证"""
        base_valid = super().validate()
        
        if not isinstance(self.value, (int, float)):
            self._validation_errors.append("数值型数据点的值必须是数字")
        
        return base_valid and len(self._validation_errors) == 0
    
    def normalize(self, min_val: float, max_val: float) -> float:
        """数值归一化"""
        if min_val == max_val:
            return 0.0
        return (float(self.value) - min_val) / (max_val - min_val)
    
    def to_dict(self) -> Dict:
        data = super().to_dict()
        data['unit'] = self.unit
        return data

class CategoricalDataPoint(DataPoint):
    """分类型数据点"""
    
    def __init__(self, value: str, categories: Optional[List[str]] = None, **kwargs):
        super().__init__(value, **kwargs)
        self.categories = categories or []
    
    def validate(self) -> bool:
        """分类验证"""
        base_valid = super().validate()
        
        if not isinstance(self.value, str):
            self._validation_errors.append("分类数据点的值必须是字符串")
        
        if self.categories and self.value not in self.categories:
            self._validation_errors.append(f"值 '{self.value}' 不在允许的分类中: {self.categories}")
        
        return base_valid and len(self._validation_errors) == 0
    
    def encode(self, encoding_map: Optional[Dict[str, int]] = None) -> int:
        """分类编码"""
        if encoding_map:
            return encoding_map.get(self.value, -1)
        elif self.categories:
            return self.categories.index(self.value) if self.value in self.categories else -1
        else:
            return hash(self.value) % 1000  # 教学用哈希编码：可能碰撞，且跨进程不保证一致

class DataSet:
    """数据集类 - 管理数据点集合"""
    
    def __init__(self, name: str, description: str = ""):
        self.name = name
        self.description = description
        self.data_points: List[DataPoint] = []
        self.created_at = datetime.now()
        self._dirty = True
        self._cached_stats = None
    
    def add_data_point(self, data_point: DataPoint):
        """添加数据点"""
        if data_point.validate():
            self.data_points.append(data_point)
            self._dirty = True
        else:
            raise ValueError(f"数据点验证失败: {data_point.get_validation_errors()}")
    
    def add_batch(self, data_points: List[DataPoint]):
        """批量添加数据点"""
        valid_points = []
        errors = []
        
        for i, dp in enumerate(data_points):
            if dp.validate():
                valid_points.append(dp)
            else:
                errors.append(f"索引 {i}: {dp.get_validation_errors()}")
        
        if errors:
            print(f"警告: {len(errors)} 个数据点验证失败")
            for error in errors[:5]:  # 只显示前5个错误
                print(f"  {error}")
        
        self.data_points.extend(valid_points)
        self._dirty = True
        
        return len(valid_points), len(errors)
    
    def get_numeric_points(self) -> List[NumericDataPoint]:
        """获取数值型数据点"""
        return [dp for dp in self.data_points if isinstance(dp, NumericDataPoint)]
    
    def get_categorical_points(self) -> List[CategoricalDataPoint]:
        """获取分类型数据点"""
        return [dp for dp in self.data_points if isinstance(dp, CategoricalDataPoint)]
    
    def get_stats(self) -> Dict:
        """获取数据集统计信息（带缓存）"""
        if not self._dirty and self._cached_stats:
            return self._cached_stats
        
        numeric_points = self.get_numeric_points()
        categorical_points = self.get_categorical_points()
        
        stats = {
            'total_points': len(self.data_points),
            'numeric_points': len(numeric_points),
            'categorical_points': len(categorical_points),
            'created_at': self.created_at.isoformat()
        }
        
        if numeric_points:
            values = [dp.value for dp in numeric_points]
            stats['numeric_stats'] = {
                'min': min(values),
                'max': max(values),
                'mean': sum(values) / len(values),
                'count': len(values)
            }
        
        if categorical_points:
            from collections import Counter
            categories = [dp.value for dp in categorical_points]
            stats['categorical_stats'] = {
                'unique_categories': len(set(categories)),
                'most_common': Counter(categories).most_common(5)
            }
        
        self._cached_stats = stats
        self._dirty = False
        return stats
    
    def export_to_json(self, filename: str):
        """导出为JSON文件"""
        data = {
            'name': self.name,
            'description': self.description,
            'stats': self.get_stats(),
            'data_points': [dp.to_dict() for dp in self.data_points]
        }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"数据集已导出到: {filename}")
    
    def __len__(self):
        return len(self.data_points)
    
    def __iter__(self):
        return iter(self.data_points)
    
    def __str__(self):
        return f"DataSet('{self.name}', {len(self.data_points)} points)"

# 演示数据科学OOP应用
print("=== 数据科学中的OOP应用演示 ===")

# 创建数据集
dataset = DataSet("用户行为分析", "电商平台用户行为数据")

# 添加不同类型的数据点
numeric_data = [
    NumericDataPoint(150.0, unit="元", metadata={"type": "订单金额"}),
    NumericDataPoint(25, unit="岁", metadata={"type": "用户年龄"}),
    NumericDataPoint(3.5, unit="评分", metadata={"type": "商品评分"})
]

categorical_data = [
    CategoricalDataPoint("移动端", ["移动端", "PC端", "平板"], metadata={"type": "访问方式"}),
    CategoricalDataPoint("北京", metadata={"type": "城市"}),
    CategoricalDataPoint("VIP", ["普通", "VIP", "SVIP"], metadata={"type": "用户等级"})
]

# 批量添加数据
valid_count, error_count = dataset.add_batch(numeric_data + categorical_data)
print(f"添加了 {valid_count} 个有效数据点，{error_count} 个错误")

# 获取统计信息
stats = dataset.get_stats()
print(f"\n数据集统计:")
print(f"  总数据点: {stats['total_points']}")
print(f"  数值型: {stats['numeric_points']}")
print(f"  分类型: {stats['categorical_points']}")

if 'numeric_stats' in stats:
    ns = stats['numeric_stats']
    print(f"  数值统计: 最小值={ns['min']}, 最大值={ns['max']}, 平均值={ns['mean']:.2f}")

if 'categorical_stats' in stats:
    cs = stats['categorical_stats']
    print(f"  分类统计: {cs['unique_categories']} 个唯一分类")

# 数据处理示例
print(f"\n数据处理示例:")
numeric_points = dataset.get_numeric_points()
if len(numeric_points) >= 2:
    values = [dp.value for dp in numeric_points]
    min_val, max_val = min(values), max(values)
    
    print(f"归一化结果:")
    for dp in numeric_points[:3]:
        normalized = dp.normalize(min_val, max_val)
        print(f"  {dp.value} -> {normalized:.3f}")

categorical_points = dataset.get_categorical_points()
if categorical_points:
    print(f"\n分类编码示例:")
    for dp in categorical_points[:3]:
        encoded = dp.encode()
        print(f"  '{dp.value}' -> {encoded}")

# 导出数据（注释掉实际文件操作）
# dataset.export_to_json('user_behavior_data.json')
print(f"\n数据集可以导出为JSON格式进行持久化存储")
```

## 性能优化与最佳实践

### 对象创建优化

```python
import sys
from typing import NamedTuple
from dataclasses import dataclass, field
from collections import namedtuple

# 1. 使用 __slots__ 减少内存占用
class Point:
    """普通点类"""
    def __init__(self, x, y):
        self.x = x
        self.y = y

class OptimizedPoint:
    """优化的点类 - 使用 __slots__"""
    __slots__ = ['x', 'y']
    
    def __init__(self, x, y):
        self.x = x
        self.y = y

# 2. 使用 dataclass 简化代码
@dataclass
class DataPoint:
    """数据点类 - 使用 dataclass"""
    x: float
    y: float
    label: str = "default"
    metadata: dict = field(default_factory=dict)
    
    def distance_from_origin(self) -> float:
        return (self.x ** 2 + self.y ** 2) ** 0.5

# 3. 使用 namedtuple 的不可变数据
ImmutablePoint = namedtuple('Point', ['x', 'y'])

class TypedPoint(NamedTuple):
    """类型化的点类"""
    x: float
    y: float
    
    def distance_from_origin(self) -> float:
        return (self.x ** 2 + self.y ** 2) ** 0.5

# 内存使用比较
print("=== 内存使用比较 ===")

# 创建对象并比较内存使用
regular_point = Point(1.0, 2.0)
optimized_point = OptimizedPoint(1.0, 2.0)
data_point = DataPoint(1.0, 2.0)
immutable_point = ImmutablePoint(1.0, 2.0)
typed_point = TypedPoint(1.0, 2.0)

print(f"普通类大小: {sys.getsizeof(regular_point)} + {sys.getsizeof(regular_point.__dict__)} bytes")
print(f"__slots__类大小: {sys.getsizeof(optimized_point)} bytes")
print(f"dataclass大小: {sys.getsizeof(data_point)} + {sys.getsizeof(data_point.__dict__)} bytes")
print(f"namedtuple大小: {sys.getsizeof(immutable_point)} bytes")
print(f"NamedTuple大小: {sys.getsizeof(typed_point)} bytes")
```

### OOP设计原则总结

```python
# SOLID原则在Python中的应用示例

# 1. 单一职责原则 (Single Responsibility Principle)
class DataValidator:
    """只负责数据验证"""
    def validate_email(self, email: str) -> bool:
        return '@' in email and '.' in email
    
    def validate_phone(self, phone: str) -> bool:
        return phone.isdigit() and len(phone) >= 10

class DataFormatter:
    """只负责数据格式化"""
    def format_email(self, email: str) -> str:
        return email.lower().strip()
    
    def format_phone(self, phone: str) -> str:
        return ''.join(filter(str.isdigit, phone))

# 2. 开闭原则 (Open/Closed Principle)
class ReportGenerator(ABC):
    """报告生成器基类 - 对扩展开放，对修改关闭"""
    
    @abstractmethod
    def generate(self, data) -> str:
        pass

class PDFReportGenerator(ReportGenerator):
    """PDF报告生成器 - 扩展而不修改基类"""
    def generate(self, data) -> str:
        return f"PDF报告: {data}"

class ExcelReportGenerator(ReportGenerator):
    """Excel报告生成器 - 新功能通过扩展实现"""
    def generate(self, data) -> str:
        return f"Excel报告: {data}"

# 3. 里氏替换原则 (Liskov Substitution Principle)
class Bird(ABC):
    @abstractmethod
    def move(self) -> str:
        pass

class FlyingBird(Bird):
    def move(self) -> str:
        return "飞行"
    
    def fly(self) -> str:
        return "在天空中飞行"

class WalkingBird(Bird):
    def move(self) -> str:
        return "行走"
    
    def walk(self) -> str:
        return "在地面上行走"

# 4. 接口隔离原则 (Interface Segregation Principle)
class Readable(Protocol):
    def read(self) -> str: ...

class Writable(Protocol):
    def write(self, data: str) -> None: ...

class Executable(Protocol):
    def execute(self) -> None: ...

# 5. 依赖倒置原则 (Dependency Inversion Principle)
class DataStorage(ABC):
    """抽象存储接口"""
    @abstractmethod
    def save(self, data: str) -> bool:
        pass

class FileStorage(DataStorage):
    def save(self, data: str) -> bool:
        print(f"保存到文件: {data}")
        return True

class DatabaseStorage(DataStorage):
    def save(self, data: str) -> bool:
        print(f"保存到数据库: {data}")
        return True

class DataService:
    """依赖抽象而不是具体实现"""
    def __init__(self, storage: DataStorage):
        self.storage = storage
    
    def process_data(self, data: str):
        processed = f"处理后的{data}"
        return self.storage.save(processed)

print("\n=== SOLID原则应用演示 ===")

# 依赖注入示例
file_service = DataService(FileStorage())
db_service = DataService(DatabaseStorage())

file_service.process_data("用户数据")
db_service.process_data("订单数据")

print("\n=== 最佳实践总结 ===")
print("1. 使用 __slots__ 优化内存使用")
print("2. 合理使用 dataclass 和 NamedTuple")
print("3. 遵循 SOLID 设计原则")
print("4. 优先组合而非继承")
print("5. 使用类型提示提高代码可读性")
print("6. 实现适当的特殊方法（__str__, __repr__ 等）")
print("7. 使用属性（property）控制属性访问")
print("8. 合理使用抽象基类定义接口")
```

## 知识连接与学习路径

> [!info] 学习路径规划
> **前置知识**：[[【技术与工具】/Python/05-Python函数编程|Python函数编程]]  
> **后续学习**：[[【技术与工具】/Python/07-NumPy数值计算|NumPy数值计算]]  
> **相关主题**：[[【技术与工具】/Python/09-Pandas数据结构|Pandas数据结构]] - 大量使用OOP设计

> [!tip] 数据科学中的应用
> - **机器学习框架**：sklearn、tensorflow等都是OOP设计
> - **数据处理工具**：pandas、numpy的核心都是类和对象
> - **可视化库**：matplotlib、plotly使用对象管理图表
> - **数据管道**：ETL流程的模块化设计

> [!example] 实际应用场景
> - **数据模型设计**：用类表示业务实体和数据结构
> - **算法封装**：将复杂算法包装成可重用的类
> - **系统架构**：微服务和API的面向对象设计
> - **工具开发**：创建专业的数据分析工具包

---

**文档信息**  
- **创建日期**：2024-06-29
- **最后更新**：2024-12-21  
- **技术深度**：中级到高级
- **预估学习时间**：90-120分钟

**关键标签**  
#Python #OOP #面向对象 #类与对象 #封装 #继承 #多态 #元类 #设计模式 #数据科学 #性能优化
