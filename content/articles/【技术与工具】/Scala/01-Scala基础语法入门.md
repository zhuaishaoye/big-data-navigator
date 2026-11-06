---
title: Scala基础语法入门 - 数据开发者的第一步
type: 技术教程
tags:
- Scala
- 基础语法
- 函数式编程
- 数据类型
- JVM
difficulty: 基础
duration: 90分钟
created: 2024-12
updated: '2026-10-09'
knowledge_type: technical-practice
target_audience:
- 数据开发工程师
- Scala初学者
stability: slow-changing
status: active
access_tier: free
---


# Scala基础语法入门 - 数据开发者的第一步

> [!abstract] 📋 Scala基础语法概览
> 
> 🔍 **为什么要学习Scala基础语法？**
> 
> 学习Scala就像学习一门融合了东西方文化的混血语言。它继承了Java的严谨和稳重（面向对象），又融入了函数式编程的优雅和简洁。想象一下，如果Java是一位经验丰富的工程师，那么Scala就是一位既懂工程又有艺术气质的设计师。
> 
> 对于数据开发者来说，掌握Scala语法是高效使用Spark、Akka等大数据框架的基础，就像掌握基本刀工是成为大厨的前提。
> 
> 🎯 **本教程将帮助你掌握**：
> - ☕ **开发环境搭建**：从零开始配置Scala开发环境
> - 📊 **基础语法掌握**：变量、数据类型、表达式的使用
> - 🔧 **函数式编程入门**：理解函数作为一等公民的概念
> - 🏗️ **面向对象基础**：类、对象、继承的Scala风格
> - 🎛️ **控制流程**：条件、循环、模式匹配初探
> 
> ⏱️ **学习时长**：90分钟掌握Scala基础语法核心概念

## ☕ 开发环境搭建

### 🛠️ Scala开发环境配置

> [!note]- 环境搭建就像装修房子
> 想象你要开一家餐厅，首先需要装修厨房、准备厨具。同样，学Scala前要先搭建好"代码厨房"——开发环境。

让我们从搭建Scala开发环境开始：

```bash
# 方法1: 使用SDKMAN管理多版本（推荐）
curl -s "https://get.sdkman.io" | bash
source "$HOME/.sdkman/bin/sdkman-init.sh"

# 安装Scala
sdk install scala 2.13.12
sdk install sbt 1.9.7

# 方法2: 使用包管理器
# macOS
brew install scala sbt

# Ubuntu/Debian
sudo apt update
sudo apt install scala sbt

# 验证安装
scala -version
sbt --version
```

> [!tip] 版本选择建议
> 就像选择汽车时新手建议选择成熟稳定的车型一样，初学者建议使用Scala 2.13.x版本，它在企业中应用最广泛，学习资料也最丰富。

**创建第一个Scala项目**：

```bash
# 创建项目目录
mkdir my-first-scala-project
cd my-first-scala-project

# 创建SBT项目结构
mkdir -p src/main/scala
mkdir -p src/test/scala

# 创建build.sbt文件
cat > build.sbt << 'EOF'
ThisBuild / version := "0.1.0-SNAPSHOT"
ThisBuild / scalaVersion := "2.13.12"

lazy val root = (project in file("."))
  .settings(
    name := "my-first-scala-project",
    libraryDependencies ++= Seq(
      "org.scalatest" %% "scalatest" % "3.2.17" % Test
    )
  )
EOF
```

### 🎯 Scala REPL入门

> [!info]- REPL是你的实验室
> REPL就像化学实验室，你可以在这里安全地试验各种"化学反应"（代码），立即看到结果，而不用担心"爆炸"（程序崩溃）。

Scala REPL（Read-Eval-Print Loop）是学习和测试代码的好工具：

```scala
// 启动REPL
$ scala

// 基本计算 - 就像使用计算器
scala> 1 + 1
res0: Int = 2

scala> "Hello" + " " + "Scala"
res1: String = Hello Scala

// 定义变量 - 就像给东西贴标签
scala> val name = "数据开发者"
name: String = 数据开发者

scala> var count = 0
count: Int = 0

// 定义函数 - 就像创建一个小工具
scala> def greet(name: String) = s"你好, $name!"
greet: (name: String)String

scala> greet(name)
res2: String = 你好, 数据开发者!

// 退出REPL
scala> :quit
```

> [!tip] REPL使用技巧
> - 使用Tab键自动补全
> - 使用`:help`查看帮助命令
> - 使用`:type 表达式`查看类型
> - 使用上下箭头键回顾历史命令

## 📊 Scala基础语法

### 🏷️ 变量与常量

> [!info]- 变量就像容器
> 想象变量是对象或值的标签：`val`定义后不能重新赋值，但所引用对象的内部状态仍可能改变；`var`则允许重新赋值。

Scala区分可变和不可变变量，这是函数式编程的核心概念：

```scala
/**
 * Scala变量定义示例
 * 展示val和var的区别及最佳实践
 */
object VariableExample extends App {
  
  // val定义不可变变量（推荐）- 就像给东西起个永久的名字
  val immutableValue = 42
  val userName = "张三"
  val pi = 3.14159
  
  // var定义可变变量（谨慎使用）- 就像可以改变内容的便签
  var mutableValue = 10
  var counter = 0
  
  // 类型推断 vs 显式类型声明
  val autoType = "Scala会自动推断类型"  // Scala很聪明，知道这是String
  val explicitType: String = "显式声明为String类型"  // 明确告诉Scala这是String
  val number: Int = 100
  val decimal: Double = 99.99
  
  println(s"不可变值: $immutableValue")
  println(s"用户名: $userName")
  
  // 可以修改var变量 - 就像更换盒子里的东西
  mutableValue = 20
  counter += 1
  
  println(s"修改后的可变值: $mutableValue")
  println(s"计数器: $counter")
  
  // 错误示例：不能修改val变量
  // immutableValue = 50  // 编译错误！就像试图打开保险箱
  
  // 延迟计算（lazy val）- 就像"按需制作"的外卖
  lazy val expensiveCalculation = {
    println("执行复杂计算...")
    Thread.sleep(1000)
    "计算结果"
  }
  
  println("定义了lazy val，但还没有计算")
  println(s"现在访问: $expensiveCalculation")  // 此时才执行计算
}
```

> [!success] 最佳实践
> 优先使用`val`（不可变），只有在必须修改值的时候才使用`var`。这就像优先选择定期存款，只有需要灵活取用时才选择活期存款。

### 📋 数据类型系统

> [!info]- 类型系统就像物品分类标签
> Scala的类型系统就像超市的商品分类系统，每种数据都有明确的"标签"，这样计算机就知道如何正确处理它们。

Scala拥有统一的类型体系；类型描述值的类别，不能将类型本身等同于对象：

```scala
/**
 * Scala数据类型详解
 * 展示基本类型、字符串操作、类型转换
 */
object DataTypesExample extends App {
  
  // === 基本数据类型 - 就像基础的积木块 ===
  val byteValue: Byte = 127           // 8位，像单字节的小盒子
  val shortValue: Short = 32767       // 16位，稍大的盒子
  val intValue: Int = 2147483647      // 32位，标准大小的盒子
  val longValue: Long = 9223372036854775807L  // 64位，大号盒子
  
  val floatValue: Float = 3.14f       // 32位浮点，普通精度
  val doubleValue: Double = 3.14159   // 64位浮点，高精度
  
  val charValue: Char = 'A'           // 16位Unicode字符
  val booleanValue: Boolean = true    // 布尔值：是或否
  
  println("=== 基本数据类型展示 ===")
  println(s"整数: $intValue")
  println(s"浮点数: $doubleValue")
  println(s"字符: $charValue")
  println(s"布尔值: $booleanValue")
  
  // === 字符串操作 - 文本处理的瑞士军刀 ===
  val str1 = "Hello"
  val str2 = "Scala"
  
  // 字符串连接 - 就像拼接积木
  val concatenated = str1 + " " + str2
  val interpolated = s"$str1 $str2"  // 字符串插值，就像填空题
  
  // 多行字符串 - 就像写文章
  val multilineString =
    """这是
      |多行字符串
      |的示例""".stripMargin
  
  // 格式化字符串 - 就像制作精美的标签
  val name = "李四"
  val age = 25
  val formatted = f"姓名: $name%s, 年龄: $age%02d岁"
  
  println("\n=== 字符串操作 ===")
  println(s"连接: $concatenated")
  println(s"插值: $interpolated")
  println(s"多行:\n$multilineString")
  println(s"格式化: $formatted")
  
  // === 类型转换 - 就像换装不同的衣服 ===
  val intNum = 42
  val doubleNum = intNum.toDouble     // 安全转换：小盒子装进大盒子
  val stringNum = intNum.toString     // 转换为文本形式
  
  // 字符串转数字（可能失败的转换）
  val stringToInt = "123".toInt
  val stringToDouble = "3.14".toDouble
  
  println("\n=== 类型转换 ===")
  println(s"Int转Double: $intNum -> $doubleNum")
  println(s"Int转String: $intNum -> $stringNum")
  println(s"String转Int: '123' -> $stringToInt")
  
  // === 数据验证示例 - 就像质检员 ===
  def validateAge(age: String): Option[Int] = {
    try {
      val ageInt = age.toInt
      if (ageInt >= 0 && ageInt <= 150) Some(ageInt)
      else None
    } catch {
      case _: NumberFormatException => None
    }
  }
  
  val validAge = validateAge("25")
  val invalidAge = validateAge("abc")
  
  println("\n=== 数据验证 ===")
  println(s"有效年龄: $validAge")
  println(s"无效年龄: $invalidAge")
}
```

> [!warning] 类型转换注意事项
> 引用类型的向上转换不会改变对象本身；数值拓宽转换需另行考虑精度，不能统称无损。此处Int转Double可精确表示，但Long转Double等可能丢失整数精度，转回更窄类型还可能截断或溢出。

## 🔧 函数式编程基础

### 📝 函数定义与调用

> [!info]- 函数就像专业的工具
> 在Scala中，函数就像瑞士军刀中的各种工具，每个都有特定的用途，而且可以组合使用完成复杂任务。

Scala中函数是一等公民，可以像变量一样传递和操作：

```scala
/**
 * Scala函数定义示例
 * 展示函数定义的各种形式和函数式编程概念
 */
object FunctionExample extends App {
  
  // === 基本函数定义 - 就像制作工具 ===
  
  // 方法定义（推荐形式）- 就像给工具起名字并说明用途
  def add(x: Int, y: Int): Int = x + y
  
  // 简化形式（类型推断）- Scala很聪明，能猜出返回类型
  def multiply(x: Int, y: Int) = x * y
  
  // 单行函数 - 简洁明了
  def square(x: Int) = x * x
  
  // 多行函数体 - 处理复杂逻辑
  def processData(data: String): String = {
    val cleaned = data.trim.toLowerCase  // 清理数据
    val processed = cleaned.replace(" ", "_")  // 处理空格
    s"processed_$processed"  // 添加前缀
  }
  
  println("=== 基本函数调用 ===")
  println(s"加法: ${add(5, 3)}")
  println(s"乘法: ${multiply(4, 7)}")
  println(s"平方: ${square(6)}")
  println(s"数据处理: ${processData("  Hello World  ")}")
  
  // === 函数值和匿名函数 - 就像可以传递的工具箱 ===
  
  // 将函数赋值给变量 - 就像把工具放进工具箱
  val addFunc: (Int, Int) => Int = add
  val multiplyFunc = multiply _  // 下划线转换为函数值
  
  // 匿名函数（Lambda表达式）- 就像临时制作的工具
  val subtract = (x: Int, y: Int) => x - y
  val divide = (x: Double, y: Double) => x / y
  
  // 简化的匿名函数 - 更加简洁
  val isEven = (x: Int) => x % 2 == 0  // 检查是否为偶数
  val makePositive = (x: Int) => if (x < 0) -x else x  // 取绝对值
  
  println("\n=== 函数值和匿名函数 ===")
  println(s"函数值调用: ${addFunc(3, 4)}")
  println(s"匿名函数: ${subtract(10, 6)}")
  println(s"判断偶数: ${isEven(8)}")
  println(s"取绝对值: ${makePositive(-5)}")
  
  // === 高阶函数 - 就像会使用工具的智能机器人 ===
  
  // 接受函数作为参数 - 就像可以装入不同工具的机器
  def applyOperation(x: Int, y: Int, operation: (Int, Int) => Int): Int = {
    operation(x, y)
  }
  
  // 返回函数的函数 - 就像工具制造机
  def createMultiplier(factor: Int): Int => Int = {
    (x: Int) => x * factor
  }
  
  println("\n=== 高阶函数 ===")
  println(s"应用加法: ${applyOperation(5, 3, add)}")
  println(s"应用减法: ${applyOperation(5, 3, subtract)}")
  
  val triple = createMultiplier(3)  // 创建一个"三倍器"
  println(s"三倍函数: ${triple(4)}")
  
  // === 数据处理中的函数应用 - 实际工作场景 ===
  
  // 数据清洗函数 - 就像洗衣机
  def cleanString(str: String): String = {
    str.trim.replaceAll("\\s+", " ").toLowerCase
  }
  
  // 数据验证函数 - 就像质检员
  def validateEmail(email: String): Boolean = {
    email.contains("@") && email.contains(".")
  }
  
  // 数据转换函数 - 就像格式转换器
  def parseNumber(str: String): Option[Double] = {
    try {
      Some(str.toDouble)
    } catch {
      case _: NumberFormatException => None
    }
  }
  
  // 组合函数处理数据 - 就像流水线作业
  val rawData = "  John.Doe@EXAMPLE.COM  "
  val cleanedData = cleanString(rawData)
  val isValidEmail = validateEmail(cleanedData)
  
  println("\n=== 数据处理函数 ===")
  println(s"原始数据: '$rawData'")
  println(s"清洗后: '$cleanedData'")
  println(s"邮箱有效: $isValidEmail")
  
  val numberStrings = List("123", "45.6", "invalid", "78.9")
  val parsedNumbers = numberStrings.map(parseNumber).flatten
  
  println(s"数字字符串: $numberStrings")
  println(s"解析结果: $parsedNumbers")
  
  // === 递归函数 - 就像俄罗斯套娃 ===
  
  // 计算阶乘 - 传统递归
  def factorial(n: Int): Int = {
    if (n <= 1) 1
    else n * factorial(n - 1)
  }
  
  // 尾递归版本（更高效）- 就像优化的流水线
  def factorialTailRec(n: Int): Int = {
    @annotation.tailrec  // 告诉编译器这是尾递归
    def loop(n: Int, acc: Int): Int = {
      if (n <= 1) acc
      else loop(n - 1, n * acc)
    }
    loop(n, 1)
  }
  
  println("\n=== 递归函数 ===")
  println(s"5的阶乘: ${factorial(5)}")
  println(s"尾递归版本: ${factorialTailRec(5)}")
}
```

> [!tip] 函数式编程思维转换
> 从命令式编程转向函数式编程，就像从"告诉计算机怎么做"转向"告诉计算机要什么结果"。这种思维转换需要时间和练习。

### 🎨 不可变性与函数式风格

> [!info]- 不可变性就像历史记录
> 想象数据是历史事件，一旦发生就不能改变，只能在此基础上创建新的事件。这样就避免了"时空悖论"（并发问题）。

```scala
/**
 * 不可变性和函数式编程风格示例
 * 展示函数式编程的核心理念
 */
object ImmutabilityExample extends App {
  
  // === 不可变数据结构 - 就像照片，永远不变 ===
  
  // 不可变列表
  val numbers = List(1, 2, 3, 4, 5)
  val moreNumbers = 0 :: numbers  // 在头部添加元素，返回新列表
  val combinedNumbers = numbers ++ List(6, 7, 8)  // 连接列表，返回新列表
  
  println("=== 不可变列表操作 ===")
  println(s"原始列表: $numbers")
  println(s"添加头部元素: $moreNumbers")
  println(s"连接列表: $combinedNumbers")
  println(s"原始列表依然不变: $numbers")  // 原始数据没有改变
  
  // === 函数式数据转换 - 就像加工流水线 ===
  
  val userScores = List(85, 92, 78, 95, 88, 73)
  
  // 函数式风格的数据处理 - 每一步都产生新的结果
  val passedScores = userScores.filter(_ >= 80)  // 筛选及格分数
  val doubledScores = userScores.map(_ * 2)      // 每个分数乘以2
  val totalScore = userScores.reduce(_ + _)      // 计算总分
  val averageScore = totalScore.toDouble / userScores.length
  
  println("\n=== 函数式数据转换 ===")
  println(s"所有分数: $userScores")
  println(s"及格分数: $passedScores")
  println(s"双倍分数: $doubledScores")
  println(s"总分: $totalScore")
  println(f"平均分: $averageScore%.2f")
  
  // === 数据处理管道 - 就像工厂流水线 ===
  
  case class Student(name: String, age: Int, score: Int)
  
  val students = List(
    Student("张三", 20, 85),
    Student("李四", 19, 92),
    Student("王五", 21, 78),
    Student("赵六", 20, 95),
    Student("钱七", 19, 88)
  )
  
  // 函数式数据分析管道 - 链式操作，清晰明了
  val topStudents = students
    .filter(_.score >= 85)           // 筛选优秀学生
    .sortBy(-_.score)                // 按分数降序排序  
    .take(3)                         // 取前3名
    .map(s => s"${s.name}(${s.score}分)")  // 格式化输出
  
  println("\n=== 数据处理管道 ===")
  println("前3名优秀学生:")
  topStudents.foreach(println)
  
  // === 纯函数示例 - 就像数学公式，输入确定输出就确定 ===
  
  // 纯函数：相同输入总是产生相同输出，无副作用
  def calculateGrade(score: Int): String = score match {
    case s if s >= 90 => "优秀"
    case s if s >= 80 => "良好"
    case s if s >= 70 => "中等"
    case s if s >= 60 => "及格"
    case _ => "不及格"
  }
  
  // 不纯函数示例（有副作用）- 就像在纸上记录次数
  var logCount = 0
  def logWithSideEffect(message: String): String = {
    logCount += 1  // 副作用：修改外部状态
    println(s"[$logCount] $message")
    message
  }
  
  // 显式传递计数状态的版本 - 仍包含println输出副作用，不是纯函数
  def createLogger(): (String, Int) => (String, Int) = {
    (message: String, count: Int) => {
      val newCount = count + 1
      println(s"[$newCount] $message")
      (message, newCount)
    }
  }
  
  println("\n=== 纯函数与副作用 ===")
  println(s"85分等级: ${calculateGrade(85)}")
  println(s"95分等级: ${calculateGrade(95)}")
  
  // 使用显式传递计数状态的日志；日志输出仍有副作用
  val logger = createLogger()
  val (msg1, count1) = logger("第一条消息", 0)
  val (msg2, count2) = logger("第二条消息", count1)
  
  // === 函数组合 - 就像组装机器 ===
  
  // 定义基础函数 - 就像基础零件
  val trim = (s: String) => s.trim
  val toLowerCase = (s: String) => s.toLowerCase
  val removeSpaces = (s: String) => s.replaceAll("\\s+", "")
  
  // 函数组合 - 把零件组装成机器
  val cleanData = trim andThen toLowerCase andThen removeSpaces
  
  // 或者使用compose（从右到左执行）
  val cleanDataCompose = removeSpaces compose toLowerCase compose trim
  
  val messyData = "  Hello World  "
  println(s"\n=== 函数组合 ===")
  println(s"原始数据: '$messyData'")
  println(s"清洗结果: '${cleanData(messyData)}'")
  
  // === 数据验证函数式风格 - 就像质检流水线 ===
  
  type ValidationResult[T] = Either[String, T]
  
  def validateAge(age: Int): ValidationResult[Int] = {
    if (age >= 0 && age <= 150) Right(age)
    else Left("年龄必须在0-150之间")
  }
  
  def validateName(name: String): ValidationResult[String] = {
    if (name.trim.nonEmpty) Right(name.trim)
    else Left("姓名不能为空")
  }
  
  def validateEmail(email: String): ValidationResult[String] = {
    if (email.contains("@")) Right(email)
    else Left("邮箱格式不正确")
  }
  
  // 组合验证 - 就像多道质检工序
  def validateUser(name: String, age: Int, email: String): ValidationResult[Student] = {
    for {
      validName <- validateName(name)
      validAge <- validateAge(age)
      validEmail <- validateEmail(email)
    } yield Student(validName, validAge, 0)  // 假设分数默认为0
  }
  
  println("\n=== 函数式验证 ===")
  val user1 = validateUser("张三", 25, "zhangsan@example.com")
  val user2 = validateUser("", 200, "invalid-email")
  
  println(s"有效用户: $user1")
  println(s"无效用户: $user2")
}
```

> [!success] 函数式编程的优势
> 函数式编程就像用乐高积木搭建复杂的模型，每个函数都是一个积木块，可以自由组合。这种方式让代码更容易测试、理解和维护。

## 🏗️ 面向对象基础

### 📦 类与对象

> [!info]- 类就像建筑图纸，对象就像实际的建筑
> 在Scala中，类定义了对象的"蓝图"，而对象就是根据这个蓝图建造出来的"实体"。就像建筑师画图纸，工人按图纸盖房子。

Scala的面向对象特性与Java类似，但更加简洁和强大：

```scala
/**
 * Scala类和对象示例
 * 展示面向对象编程的基本概念
 */

// === 基本类定义 - 就像设计一个工具的图纸 ===
class DataProcessor(val name: String, var processingCount: Int = 0) {
  
  // 私有字段 - 就像内部的秘密
  private var _status = "Ready"
  
  // 公共字段（通过方法访问）- 就像对外的窗口
  def status: String = _status
  def status_=(newStatus: String): Unit = {
    _status = newStatus
    println(s"$name 状态已更新为: $newStatus")
  }
  
  // 方法定义 - 就像工具的功能
  def processData(data: String): String = {
    processingCount += 1
    _status = "Processing"
    
    val result = s"处理结果: ${data.toUpperCase}"
    _status = "Completed"
    
    println(s"$name 完成第 $processingCount 次数据处理")
    result
  }
  
  // 辅助构造器 - 就像不同的组装方式
  def this(name: String) = this(name, 0)
  
  // 重写toString方法 - 就像物品的标签
  override def toString: String = s"DataProcessor($name, 处理次数: $processingCount, 状态: $status)"
}

// === 案例类（Case Class）- 就像标准化的数据容器 ===
case class UserData(id: String, name: String, age: Int, email: String) {
  
  // 数据验证方法
  def isValid: Boolean = {
    name.trim.nonEmpty && age > 0 && age < 150 && email.contains("@")
  }
  
  // 数据转换方法
  def toMap: Map[String, Any] = Map(
    "id" -> id,
    "name" -> name,
    "age" -> age,
    "email" -> email
  )
  
  // 创建副本的便捷方法 - 就像复印并修改部分内容
  def withAge(newAge: Int): UserData = copy(age = newAge)
  def withEmail(newEmail: String): UserData = copy(email = newEmail)
}

// === 伴生对象（Companion Object）- 就像类的工厂和工具箱 ===
object UserData {
  
  // 工厂方法 - 就像专门的生产线
  def fromString(csvLine: String): Option[UserData] = {
    val parts = csvLine.split(",").map(_.trim)
    if (parts.length == 4) {
      try {
        Some(UserData(parts(0), parts(1), parts(2).toInt, parts(3)))
      } catch {
        case _: NumberFormatException => None
      }
    } else {
      None
    }
  }
  
  // 创建测试数据 - 就像样品库
  def sampleUsers: List[UserData] = List(
    UserData("001", "张三", 25, "zhangsan@example.com"),
    UserData("002", "李四", 30, "lisi@example.com"),
    UserData("003", "王五", 28, "wangwu@example.com")
  )
  
  // 批量验证 - 就像质检流水线
  def validateBatch(users: List[UserData]): (List[UserData], List[UserData]) = {
    users.partition(_.isValid)
  }
}

// === 抽象类和继承 - 就像制定标准和实现标准 ===
abstract class DataSource {
  def name: String
  def connect(): Boolean
  def disconnect(): Unit
  def readData(): List[String]
  
  // 具体方法 - 已经实现的通用功能
  def getDataCount: Int = readData().length
  
  // 模板方法模式 - 就像标准作业流程
  final def processAll(): List[String] = {
    if (connect()) {
      try {
        val data = readData()
        println(s"从 $name 读取了 ${data.length} 条数据")
        data
      } finally {
        disconnect()
      }
    } else {
      println(s"无法连接到 $name")
      List.empty
    }
  }
}

// 具体实现类 - 就像按照标准制造的具体产品
class FileDataSource(val fileName: String) extends DataSource {
  def name: String = s"文件数据源: $fileName"
  
  def connect(): Boolean = {
    println(s"连接到文件: $fileName")
    true  // 简化实现
  }
  
  def disconnect(): Unit = {
    println(s"关闭文件: $fileName")
  }
  
  def readData(): List[String] = {
    // 模拟读取文件数据
    List(
      "001,张三,25,zhangsan@example.com",
      "002,李四,30,lisi@example.com",
      "003,王五,28,wangwu@example.com"
    )
  }
}

class DatabaseDataSource(val connectionString: String) extends DataSource {
  def name: String = s"数据库数据源: $connectionString"
  
  def connect(): Boolean = {
    println(s"连接到数据库: $connectionString")
    true  // 简化实现
  }
  
  def disconnect(): Unit = {
    println("断开数据库连接")
  }
  
  def readData(): List[String] = {
    // 模拟从数据库读取数据
    List(
      "004,赵六,35,zhaoliu@example.com",
      "005,孙七,22,sunqi@example.com"
    )
  }
}

// === 特质（Trait）- 就像可插拔的功能模块 ===
trait Loggable {
  def log(message: String): Unit = {
    println(s"[${java.time.LocalDateTime.now}] $message")
  }
}

trait Cacheable {
  private var cache: Map[String, Any] = Map.empty
  
  def putCache(key: String, value: Any): Unit = {
    cache = cache + (key -> value)
  }
  
  def getCache(key: String): Option[Any] = cache.get(key)
  
  def clearCache(): Unit = {
    cache = Map.empty
  }
}

// 混入多个特质 - 就像给工具装上不同的附件
class EnhancedDataProcessor(name: String) 
  extends DataProcessor(name) 
  with Loggable 
  with Cacheable {
  
  override def processData(data: String): String = {
    log(s"开始处理数据: $data")
    
    // 检查缓存 - 就像先看看是否已经做过这个工作
    getCache(data) match {
      case Some(cached) => 
        log("从缓存获取结果")
        cached.toString
      case None =>
        val result = super.processData(data)
        putCache(data, result)
        log("结果已缓存")
        result
    }
  }
}

// === 主程序 ===
object OOPExample extends App {
  
  println("=== 基本类使用 ===")
  val processor = new DataProcessor("主处理器")
  println(processor)
  
  val result1 = processor.processData("hello world")
  println(result1)
  
  processor.status = "Idle"
  println(processor)
  
  println("\n=== 案例类使用 ===")
  val user = UserData("001", "张三", 25, "zhangsan@example.com")
  println(s"用户信息: $user")
  println(s"是否有效: ${user.isValid}")
  println(s"转换为Map: ${user.toMap}")
  
  // 案例类的copy方法 - 就像复制并修改
  val olderUser = user.withAge(30)
  println(s"更新年龄后: $olderUser")
  
  // 模式匹配（案例类的重要特性）
  user match {
    case UserData(id, name, age, _) if age < 30 => 
      println(s"年轻用户: $name ($age岁)")
    case UserData(_, name, age, _) => 
      println(s"成熟用户: $name ($age岁)")
  }
  
  println("\n=== 伴生对象使用 ===")
  val sampleUsers = UserData.sampleUsers
  println("样本用户:")
  sampleUsers.foreach(println)
  
  val csvLine = "004,赵六,35,zhaoliu@example.com"
  val userFromCsv = UserData.fromString(csvLine)
  println(s"从CSV解析: $userFromCsv")
  
  val (valid, invalid) = UserData.validateBatch(sampleUsers)
  println(s"有效用户数: ${valid.length}, 无效用户数: ${invalid.length}")
  
  println("\n=== 继承和多态 ===")
  val dataSources: List[DataSource] = List(
    new FileDataSource("users.csv"),
    new DatabaseDataSource("jdbc:mysql://localhost/testdb")
  )
  
  dataSources.foreach { source =>
    val data = source.processAll()
    println(s"数据条数: ${data.length}")
    println()
  }
  
  println("=== 特质混入 ===")
  val enhancedProcessor = new EnhancedDataProcessor("增强处理器")
  
  val result2 = enhancedProcessor.processData("test data")
  val result3 = enhancedProcessor.processData("test data")  // 应该从缓存获取
  
  println(s"第一次处理: $result2")
  println(s"第二次处理: $result3")
}
```

> [!tip] 面向对象设计原则
> - **单一职责**：每个类只做一件事
> - **开闭原则**：对扩展开放，对修改关闭
> - **组合优于继承**：优先考虑持有协作对象并委托行为；特质混入也是类型继承机制，不等同于对象组合

## 🎛️ 控制流程结构

### 🔀 条件表达式和模式匹配

> [!info]- 控制流程就像人生的选择
> 程序执行就像人生路径，遇到分叉路需要做选择，遇到重复性工作需要循环处理。Scala的控制结构让这个过程更加优雅。

Scala的控制结构都是表达式，可以返回值：

```scala
/**
 * Scala控制流程示例
 * 展示条件表达式、循环和模式匹配
 */
object ControlFlowExample extends App {
  
  // === if表达式（不是语句！）- 就像做选择题 ===
  
  val score = 85
  val grade = if (score >= 90) "优秀"
             else if (score >= 80) "良好"
             else if (score >= 70) "中等"
             else if (score >= 60) "及格"
             else "不及格"
  
  println(s"=== if表达式 ===")
  println(s"分数 $score 对应等级: $grade")
  
  // if表达式的复杂用法 - 就像复杂的决策过程
  val status = "processing"
  val message = if (status == "processing") {
    val progress = 75
    s"正在处理中... ($progress%)"
  } else {
    "处理完成"
  }
  
  println(s"状态消息: $message")
  
  // === match表达式（模式匹配）- 就像智能的分拣机 ===
  
  def classifyNumber(num: Int): String = num match {
    case 0 => "零"
    case 1 => "一"
    case 2 => "二"
    case n if n > 0 && n < 10 => s"个位数: $n"  // 带条件的匹配
    case n if n >= 10 && n < 100 => s"两位数: $n"
    case _ => "其他数字"  // 默认情况，就像兜底方案
  }
  
  println(s"\n=== match表达式 ===")
  println(s"数字分类: ${classifyNumber(0)}")
  println(s"数字分类: ${classifyNumber(5)}")
  println(s"数字分类: ${classifyNumber(42)}")
  println(s"数字分类: ${classifyNumber(123)}")
  
  // === 复杂模式匹配 - 就像高级的分拣系统 ===
  
  // 匹配数据类型 - 就像按材质分类
  def describeType(obj: Any): String = obj match {
    case s: String => s"字符串: $s (长度: ${s.length})"
    case i: Int if i > 0 => s"正整数: $i"
    case i: Int if i < 0 => s"负整数: $i"
    case 0 => "零"
    case d: Double => f"浮点数: $d%.2f"
    case list: List[_] => s"列表，长度: ${list.length}"
    case _ => "未知类型"
  }
  
  println(s"\n=== 类型模式匹配 ===")
  println(describeType("Hello"))
  println(describeType(42))
  println(describeType(-10))
  println(describeType(3.14159))
  println(describeType(List(1, 2, 3)))
  
  // === 数据结构模式匹配 - 就像拆包裹 ===
  
  case class Person(name: String, age: Int, city: String)
  
  def describePerson(person: Person): String = person match {
    case Person("张三", age, city) => s"这是张三，$age岁，住在$city"
    case Person(name, age, "北京") if age < 30 => s"$name是北京的年轻人"
    case Person(name, age, city) if age >= 60 => s"$name是$city的老年人"
    case Person(name, _, city) => s"$name住在$city"
  }
  
  val people = List(
    Person("张三", 25, "上海"),
    Person("李四", 28, "北京"),
    Person("王五", 65, "广州"),
    Person("赵六", 22, "北京")
  )
  
  println(s"\n=== 结构模式匹配 ===")
  people.foreach(person => println(describePerson(person)))
  
  // === 列表模式匹配 - 就像处理队列 ===
  
  def processList(list: List[Int]): String = list match {
    case Nil => "空列表"  // 空队列
    case head :: Nil => s"只有一个元素: $head"  // 单元素队列
    case head :: tail => s"头部: $head, 尾部: $tail"  // 有头有尾的队列
  }
  
  def sumList(list: List[Int]): Int = list match {
    case Nil => 0
    case head :: tail => head + sumList(tail)  // 递归求和
  }
  
  println(s"\n=== 列表模式匹配 ===")
  println(processList(List()))
  println(processList(List(1)))
  println(processList(List(1, 2, 3)))
  println(s"列表求和: ${sumList(List(1, 2, 3, 4, 5))}")
  
  // === for表达式（for comprehension）- 就像智能循环 ===
  
  // 基本for循环 - 就像重复做同样的事
  println(s"\n=== for表达式 ===")
  print("基本for循环: ")
  for (i <- 1 to 5) print(s"$i ")
  println()
  
  // for表达式生成新集合 - 就像批量生产
  val squares = for (i <- 1 to 5) yield i * i
  println(s"平方数: $squares")
  
  // 带条件的for表达式 - 就像有筛选功能的生产线
  val evenSquares = for (i <- 1 to 10 if i % 2 == 0) yield i * i
  println(s"偶数平方: $evenSquares")
  
  // 多重for表达式 - 就像嵌套循环
  val combinations = for {
    x <- 1 to 3
    y <- 1 to 3
    if x != y  // 条件：x和y不相等
  } yield (x, y)
  println(s"组合: $combinations")
  
  // === 数据处理中的for表达式 - 实际工作场景 ===
  
  case class Order(id: String, customerId: String, amount: Double, status: String)
  
  val orders = List(
    Order("001", "C001", 150.0, "completed"),
    Order("002", "C002", 200.0, "pending"),
    Order("003", "C001", 300.0, "completed"),
    Order("004", "C003", 100.0, "cancelled"),
    Order("005", "C002", 250.0, "completed")
  )
  
  // 使用for表达式处理数据 - 就像设置筛选条件
  val completedOrdersReport = for {
    order <- orders
    if order.status == "completed"  // 只要已完成的订单
    if order.amount > 200.0  // 只要大额订单
  } yield s"订单${order.id}: 客户${order.customerId}, 金额${order.amount}"
  
  println(s"\n=== 数据处理for表达式 ===")
  println("大额已完成订单:")
  completedOrdersReport.foreach(println)
  
  // === while循环（较少使用）- 传统的循环方式 ===
  
  var i = 0
  var sum = 0
  println(s"\n=== while循环 ===")
  while (i < 5) {
    sum += i
    i += 1
  }
  println(s"0到4的和: $sum")
  
  // === 异常处理 - 就像错误预案 ===
  
  def safeDivide(a: Double, b: Double): Either[String, Double] = {
    try {
      if (b == 0) Left("除数不能为零")
      else Right(a / b)
    } catch {
      case e: ArithmeticException => Left(s"算术异常: ${e.getMessage}")
      case e: Exception => Left(s"未知异常: ${e.getMessage}")
    }
  }
  
  println(s"\n=== 异常处理 ===")
  println(s"10 / 2 = ${safeDivide(10, 2)}")
  println(s"10 / 0 = ${safeDivide(10, 0)}")
  
  // === Option类型处理空值 - 就像薛定谔的猫，可能有也可能没有 ===
  
  def findUser(id: String): Option[Person] = {
    val users = Map(
      "001" -> Person("张三", 25, "北京"),
      "002" -> Person("李四", 30, "上海")
    )
    users.get(id)
  }
  
  def processUser(userId: String): String = {
    findUser(userId) match {
      case Some(user) => s"找到用户: ${user.name}"
      case None => s"用户不存在: $userId"
    }
  }
  
  println(s"\n=== Option类型 ===")
  println(processUser("001"))
  println(processUser("999"))
  
  // 使用map和flatMap处理Option - 就像链式操作
  val userInfo = for {
    user <- findUser("001")
    cityInfo = s"${user.name}住在${user.city}"
  } yield cityInfo
  
  println(s"用户信息: ${userInfo.getOrElse("无信息")}")
}
```

> [!success] 控制流程最佳实践
> - 优先使用表达式而不是语句
> - 使用模式匹配替代复杂的if-else
> - 利用Option类型避免空指针异常
> - 善用for表达式简化复杂的嵌套操作

## 🎯 数据开发实战示例

> [!info]- 综合实战就像做菜
> 学了这么多"基本功"，现在要综合运用，就像学会了切菜、调味、火候控制后，要做一道完整的菜。

让我们用一个完整的例子来综合运用这些基础语法：

```scala
/**
 * 数据质量检查器
 * 综合运用Scala基础语法进行数据质量分析
 * 
 * 这个例子就像建立一个"数据健康检查中心"
 */

// === 数据模型定义 - 就像设计体检表格 ===
case class DataRecord(
  id: String,
  name: String,
  age: Option[Int],  // 可能为空的年龄
  email: Option[String],  // 可能为空的邮箱
  score: Option[Double],  // 可能为空的分数
  timestamp: String
) {
  // 数据有效性检查 - 就像体检标准
  def isValid: Boolean = {
    id.nonEmpty && 
    name.trim.nonEmpty && 
    age.exists(a => a > 0 && a < 150) &&  // 年龄合理
    email.exists(e => e.contains("@") && e.contains("."))  // 邮箱格式正确
  }
}

// === 数据质量报告 - 就像体检报告 ===
case class QualityReport(
  totalRecords: Int,
  validRecords: Int,
  invalidRecords: Int,
  missingFields: Map[String, Int],  // 各字段缺失统计
  duplicateCount: Int,
  qualityScore: Double  // 质量评分
) {
  def validRate: Double = if (totalRecords > 0) validRecords.toDouble / totalRecords * 100 else 0.0
  def duplicateRate: Double = if (totalRecords > 0) duplicateCount.toDouble / totalRecords * 100 else 0.0
  
  override def toString: String = {
    f"""
       |=== 数据质量报告 ===
       |总记录数: $totalRecords
       |有效记录: $validRecords
       |无效记录: $invalidRecords
       |有效率: $validRate%.2f%%
       |重复记录: $duplicateCount
       |重复率: $duplicateRate%.2f%%
       |质量评分: $qualityScore%.2f
       |缺失字段统计: $missingFields
       |""".stripMargin
  }
}

// === 数据质量检查器主类 - 就像自动化体检设备 ===
class DataQualityChecker {
  
  // 解析CSV行为数据记录 - 就像读取体检数据
  def parseRecord(csvLine: String): Option[DataRecord] = {
    try {
      val parts = csvLine.split(",").map(_.trim)
      if (parts.length >= 6) {
        Some(DataRecord(
          id = parts(0),
          name = parts(1),
          age = if (parts(2).nonEmpty) Some(parts(2).toInt) else None,
          email = if (parts(3).nonEmpty) Some(parts(3)) else None,
          score = if (parts(4).nonEmpty) Some(parts(4).toDouble) else None,
          timestamp = parts(5)
        ))
      } else None
    } catch {
      case _: Exception => None  // 解析失败返回None
    }
  }
  
  // 检查重复记录 - 就像查找重复的体检记录
  def findDuplicates(records: List[DataRecord]): List[DataRecord] = {
    records.groupBy(_.id)  // 按ID分组
      .filter(_._2.length > 1)  // 找出重复的组
      .values  // 取出重复的记录
      .flatten
      .toList
  }
  
  // 统计缺失字段 - 就像统计哪些检查项目没做
  def countMissingFields(records: List[DataRecord]): Map[String, Int] = {
    Map(
      "age" -> records.count(_.age.isEmpty),
      "email" -> records.count(_.email.isEmpty),
      "score" -> records.count(_.score.isEmpty)
    )
  }
  
  // 计算质量评分 - 就像给整体健康状况打分
  def calculateQualityScore(
    validRate: Double,
    duplicateRate: Double,
    missingFieldsRate: Double
  ): Double = {
    val validScore = validRate * 0.5          // 有效率权重50%
    val duplicateScore = (100 - duplicateRate) * 0.3   // 去重率权重30%
    val missingScore = (100 - missingFieldsRate) * 0.2  // 完整率权重20%
    
    validScore + duplicateScore + missingScore
  }
  
  // 主要检查方法 - 就像执行全套体检
  def checkQuality(csvData: List[String]): QualityReport = {
    // 解析数据 - 就像读取所有体检数据
    val records = csvData.flatMap(parseRecord)
    val validRecords = records.filter(_.isValid)
    val invalidRecords = records.filterNot(_.isValid)
    
    // 查找重复 - 就像查重
    val duplicates = findDuplicates(records)
    
    // 统计缺失字段
    val missingFields = countMissingFields(records)
    val totalMissingFields = missingFields.values.sum
    val missingFieldsRate = if (records.nonEmpty) 
      totalMissingFields.toDouble / (records.length * 3) * 100 
    else 0.0
    
    // 计算质量评分
    val validRate = if (records.nonEmpty) validRecords.length.toDouble / records.length * 100 else 0.0
    val duplicateRate = if (records.nonEmpty) duplicates.length.toDouble / records.length * 100 else 0.0
    val qualityScore = calculateQualityScore(validRate, duplicateRate, missingFieldsRate)
    
    QualityReport(
      totalRecords = records.length,
      validRecords = validRecords.length,
      invalidRecords = invalidRecords.length,
      missingFields = missingFields,
      duplicateCount = duplicates.length,
      qualityScore = qualityScore
    )
  }
  
  // 数据清洗建议 - 就像医生给出治疗建议
  def generateCleaningAdvice(report: QualityReport): List[String] = {
    val advice = scala.collection.mutable.ListBuffer[String]()
    
    if (report.validRate < 80) {
      advice += "⚠️ 数据有效率较低，建议检查数据源质量"
    }
    
    if (report.duplicateRate > 5) {
      advice += "⚠️ 重复数据较多，建议实施去重策略"
    }
    
    report.missingFields.foreach { case (field, count) =>
      if (count > report.totalRecords * 0.1) {
        advice += s"⚠️ 字段 $field 缺失率较高 ($count 条记录)，建议数据补全"
      }
    }
    
    if (report.qualityScore >= 90) {
      advice += "✅ 按本示例规则，成功解析记录的质量评分较高；是否可用于业务仍需检查解析失败记录及业务验收条件"
    } else if (report.qualityScore >= 70) {
      advice += "⚠️ 数据质量一般，建议适度清洗后使用"
    } else {
      advice += "❌ 数据质量较差，需要大幅度清洗处理"
    }
    
    advice.toList
  }
}

// === 主程序 - 就像体检中心的运营流程 ===
object DataQualityExample extends App {
  
  // 模拟CSV数据 - 就像一批体检数据
  val csvData = List(
    "001,张三,25,zhangsan@example.com,85.5,2024-01-01",
    "002,李四,30,lisi@example.com,92.0,2024-01-02",
    "003,王五,,wangwu@example.com,78.5,2024-01-03",  // 缺少年龄
    "004,赵六,35,,88.0,2024-01-04",  // 缺少邮箱
    "005,,28,invalid-email,95.0,2024-01-05",  // 缺少姓名，邮箱无效
    "006,孙七,25,sunqi@example.com,,2024-01-06",  // 缺少分数
    "001,张三,25,zhangsan@example.com,85.5,2024-01-07",  // 重复ID
    "007,周八,200,zhouba@example.com,75.0,2024-01-08",  // 年龄无效
    "008,吴九,22,wujiu@example.com,68.5,2024-01-09",
    "009,郑十,26,zhengshi@example.com,91.0,2024-01-10"
  )
  
  println("=== 原始数据 ===")
  csvData.zipWithIndex.foreach { case (line, index) =>
    println(f"${index + 1}%2d: $line")
  }
  
  // 执行数据质量检查 - 就像开始体检
  val checker = new DataQualityChecker()
  val report = checker.checkQuality(csvData)
  
  println(report)
  
  // 生成清洗建议 - 就像医生诊断
  val advice = checker.generateCleaningAdvice(report)
  println("=== 数据清洗建议 ===")
  advice.foreach(println)
  
  // 演示函数式数据处理 - 就像数据分析
  println("\n=== 数据统计分析 ===")
  val records = csvData.flatMap(checker.parseRecord)
  
  // 年龄分布统计 - 就像按年龄段统计
  val ageStats = records
    .flatMap(_.age)  // 提取所有非空年龄
    .groupBy(age => age / 10 * 10)  // 按年龄段分组（20s, 30s等）
    .map { case (ageGroup, ages) => 
      s"${ageGroup}s年龄段" -> ages.length 
    }
  
  println("年龄分布:")
  ageStats.foreach { case (group, count) => 
    println(s"  $group: $count 人")
  }
  
  // 分数统计 - 就像成绩分析
  val scores = records.flatMap(_.score)
  if (scores.nonEmpty) {
    val avgScore = scores.sum / scores.length
    val maxScore = scores.max
    val minScore = scores.min
    
    println(f"\n分数统计:")
    println(f"  平均分: $avgScore%.2f")
    println(f"  最高分: $maxScore%.2f")
    println(f"  最低分: $minScore%.2f")
  }
  
  // 邮箱域名统计 - 就像统计邮箱服务商
  val emailDomains = records
    .flatMap(_.email)  // 提取所有非空邮箱
    .map(email => email.substring(email.indexOf("@") + 1))  // 提取域名
    .groupBy(identity)  // 按域名分组
    .map { case (domain, emails) => domain -> emails.length }
  
  println(s"\n邮箱域名分布:")
  emailDomains.foreach { case (domain, count) => 
    println(s"  $domain: $count 个用户")
  }
}
```

> [!success] 综合实战总结
> 这个例子综合运用了：
> - **案例类**：定义数据模型
> - **Option类型**：处理可能为空的数据
> - **模式匹配**：进行条件判断
> - **集合操作**：数据处理和统计
> - **函数式编程**：链式操作和数据转换
> - **异常处理**：安全的数据解析

---

> [!quote] 💭 Scala基础语法学习心得
> 
> 🎯 **函数式思维**：理解不可变性和纯函数的重要性，这是Scala的灵魂
> 💻 **表达式导向**：习惯一切皆表达式的编程风格，让代码更简洁
> 🔍 **类型推断**：合理利用Scala的类型推断能力，平衡简洁性和可读性
> 🚀 **模式匹配**：掌握模式匹配这一强大特性，让复杂逻辑变得清晰
> 🏗️ **组合思维**：学会用小的函数组合成大的功能，就像用积木搭建复杂模型

## 🔗 相关学习资源

### 继续学习
- Scala面向对象与函数式编程
- [[【技术与工具】/Scala/02-Scala集合框架与模式匹配|Scala集合框架与模式匹配]]
- [[【技术与工具】/Scala/03-Scala在数据开发中的应用|Scala在数据开发中的]]

### 练习项目
- 语法练习题
- 简单数据分析工具

> [!tip] 🌟 学习建议
> 
> Scala语法学习要重点理解函数式编程思想，不要把它当作"更复杂的Java"。多使用REPL进行交互式学习，重视不可变性和表达式的概念。模式匹配是Scala的强大特性，要重点掌握。记住，Scala的目标是让复杂的事情变简单，而不是让简单的事情变复杂。
> 
> 就像学习乐器一样，基础语法需要反复练习才能形成肌肉记忆。建议每天至少花30分钟在REPL中实验各种语法特性。