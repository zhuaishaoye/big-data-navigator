---
title: Shell脚本基础 - 从零写一个数据处理脚本
tags:
  - Shell
  - Bash
  - 脚本编程
  - 自动化
  - 数据处理
aliases:
  - Shell脚本
  - Bash脚本
  - Shell编程
date: 2026-03-18
difficulty: 基础
duration: 60分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据分析师
  - 数据运营
  - BI分析师
stability: stable
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


# Shell 脚本基础 - 从零写一个数据处理脚本

> [!abstract] 本文概要
> - Shell 脚本的基本结构
> - 变量：定义、使用、特殊变量
> - 条件判断：if/else
> - 循环：for/while
> - 函数：封装复用
> - 完整实战：一个数据处理脚本

---

## 第一个 Shell 脚本

```bash
#!/bin/bash
# 这是注释（# 开头）
# 第一行 #!/bin/bash 叫 shebang，告诉系统用哪个解释器执行这个脚本

echo "Hello, 数据工程师！"
echo "当前时间：$(date '+%Y-%m-%d %H:%M:%S')"
echo "当前目录：$(pwd)"
```

**创建和运行脚本**：

```bash
# 1. 创建脚本文件
vim hello.sh

# 2. 添加执行权限
chmod +x hello.sh

# 3. 运行脚本
./hello.sh

# 或者直接用 bash 运行（不需要执行权限）
bash hello.sh
```

> [!tip] 脚本头部的最佳实践
> ```bash
> #!/bin/bash
> # 脚本名称：daily_etl.sh
> # 功能说明：每日数据ETL处理
> # 作者：alice
> # 创建日期：2026-03-18
> # 修改记录：2026-03-18 初版
>
> # 在适用上下文中，命令返回非零状态时退出；条件判断等上下文存在例外，关键失败仍需显式检查
> set -e
>
> # 使用未声明的变量时报错
> set -u
>
> # 管道中任何命令失败都算失败
> set -o pipefail
> ```

---

## 变量

### 定义和使用变量

```bash
#!/bin/bash

# 定义变量（等号两边不能有空格！）
name="alice"
age=28
data_dir="/data/warehouse"

# 使用变量（加 $ 前缀）
echo $name
echo ${name}   # 推荐用 ${} 形式，更清晰，避免歧义

# 错误示例（等号两边有空格）
# name = "alice"   ← 这会报错！

# 变量中包含变量（双引号内变量会被展开）
message="用户 ${name} 的数据目录是 ${data_dir}/${name}"
echo "$message"

# 单引号内不展开变量
echo '用户 $name'   # 输出：用户 $name（原样输出）
```

### 命令替换（重要）

把命令的输出赋值给变量：

```bash
# 方法一：$() 语法（推荐）
today=$(date +%Y-%m-%d)
file_count=$(ls /data/raw/ | wc -l)
current_user=$(whoami)

# 方法二：反引号（老式写法）
today=`date +%Y-%m-%d`

# 使用
echo "今天是：${today}"
echo "数据目录有 ${file_count} 个文件"

# 在字符串中使用命令替换
log_file="/var/log/etl/etl_$(date +%Y%m%d_%H%M%S).log"
echo "日志文件：${log_file}"
```

### 特殊变量

```bash
# $0  ：脚本自身的文件名
# $1  ：第 1 个命令行参数
# $2  ：第 2 个命令行参数
# $@  ：所有参数（作为独立的字符串）
# $#  ：参数个数
# $?  ：上一个命令的退出状态码（0=成功，非0=失败）
# $$  ：当前脚本的进程 ID（PID）
# $!  ：上一个后台进程的 PID

# 示例脚本（process.sh）
#!/bin/bash
echo "脚本名：$0"
echo "第一个参数：$1"
echo "第二个参数：$2"
echo "参数总数：$#"

# 运行：bash process.sh hello world
# 输出：
# 脚本名：process.sh
# 第一个参数：hello
# 第二个参数：world
# 参数总数：2
```

### 环境变量

```bash
# 查看所有环境变量
env
printenv

# 查看特定环境变量
echo $HOME          # 家目录
echo $PATH          # 命令搜索路径
echo $USER          # 当前用户名
echo $SHELL         # 当前 Shell
echo $PWD           # 当前目录（等同于 pwd 命令）

# 在脚本中设置环境变量
export MY_VAR="my_value"   # export 让子进程也能用到这个变量
```

---

## 条件判断

### if/else 基本语法

```bash
if 条件; then
    # 条件为真时执行
elif 另一个条件; then
    # 第二个条件为真时执行
else
    # 以上条件都不满足时执行
fi
```

### 数值比较

```bash
a=10
b=20

if [ $a -eq $b ]; then    # -eq：等于
    echo "相等"
elif [ $a -lt $b ]; then  # -lt：小于（less than）
    echo "$a 小于 $b"
else
    echo "$a 大于 $b"
fi

# 常用比较运算符
# -eq  ：等于（equal）
# -ne  ：不等于（not equal）
# -lt  ：小于（less than）
# -le  ：小于等于（less or equal）
# -gt  ：大于（greater than）
# -ge  ：大于等于（greater or equal）
```

### 字符串比较

```bash
str="hello"

if [ "$str" = "hello" ]; then     # = 或 ==
    echo "字符串相等"
fi

if [ "$str" != "world" ]; then    # != 不等于
    echo "字符串不同"
fi

if [ -z "$str" ]; then            # -z：字符串为空
    echo "字符串为空"
fi

if [ -n "$str" ]; then            # -n：字符串非空
    echo "字符串非空"
fi
```

### 文件和目录判断

```bash
file="/data/orders.csv"
dir="/data/output"

if [ -f "$file" ]; then        # -f：是普通文件且存在
    echo "文件存在"
fi

if [ -d "$dir" ]; then         # -d：是目录且存在
    echo "目录存在"
fi

if [ -e "$file" ]; then        # -e：文件或目录存在（any type）
    echo "路径存在"
fi

if [ -r "$file" ]; then        # -r：文件可读
    echo "文件可读"
fi

if [ -w "$file" ]; then        # -w：文件可写
    echo "文件可写"
fi

if [ -x "run.sh" ]; then       # -x：文件可执行
    echo "脚本有执行权限"
fi

if [ -s "$file" ]; then        # -s：文件存在且非空
    echo "文件非空"
fi

# 实际应用
if [ ! -d "$dir" ]; then       # ! 取反：目录不存在
    mkdir -p "$dir"
    echo "创建目录：$dir"
fi
```

### 逻辑运算

```bash
# && 与（两个条件都要满足）
if [ -f "$file" ] && [ -r "$file" ]; then
    echo "文件存在且可读"
fi

# || 或（满足其中一个即可）
if [ "$status" = "ERROR" ] || [ "$status" = "FAILED" ]; then
    echo "任务失败"
fi

# 现代写法（[[ ]] 支持更多特性）
if [[ -f "$file" && -r "$file" ]]; then
    echo "文件存在且可读"
fi
```

---

## 循环

### for 循环

```bash
# 遍历列表
for item in apple banana cherry; do
    echo "水果：$item"
done

# 遍历数字范围
for i in {1..10}; do
    echo "第 $i 次"
done

# 带步长
for i in {0..100..10}; do
    echo $i
done

# C 语言风格
for ((i=0; i<10; i++)); do
    echo $i
done

# 遍历文件
for file in /data/raw/*.csv; do
    echo "处理文件：$file"
    # 在这里处理文件
done

# 遍历命令输出
for user in $(cat /etc/passwd | cut -d: -f1); do
    echo "用户：$user"
done
```

### while 循环

```bash
# 基本 while 循环
count=1
while [ $count -le 5 ]; do
    echo "第 $count 次"
    count=$((count + 1))   # 算术运算
done

# 逐行读取文件（处理数据文件的常用方式）
while IFS=',' read -r col1 col2 col3; do
    echo "列1: $col1, 列2: $col2, 列3: $col3"
done < data.csv

# 死循环 + break（监控类脚本常用）
while true; do
    if [ 条件 ]; then
        break
    fi
    sleep 5
done
```

> [!tip] 逐行处理 CSV 数据
> ```bash
> #!/bin/bash
> # 跳过表头，逐行处理 CSV
> # 文件格式：order_id,user_id,amount,status
>
> skip_header=true
> while IFS=',' read -r order_id user_id amount status; do
>     if $skip_header; then
>         skip_header=false
>         continue
>     fi
>
>     if [ "$status" = "failed" ]; then
>         echo "失败订单：$order_id, 金额：$amount"
>     fi
> done < orders.csv
> ```

---

## 函数

```bash
# 定义函数
函数名() {
    # 函数体
    echo "这是函数"
}

# 带参数的函数
greet() {
    local name="$1"    # local 声明局部变量
    local greeting="$2"
    echo "${greeting}, ${name}!"
}

# 调用函数
greet "Alice" "你好"
greet "Bob" "Hello"

# 返回值（Shell 函数只能返回 0-255 的整数作为状态码）
check_file() {
    local file="$1"
    if [ -f "$file" ]; then
        return 0   # 0 表示成功
    else
        return 1   # 非 0 表示失败
    fi
}

# 调用并检查返回值
if check_file "/data/orders.csv"; then
    echo "文件存在，开始处理"
else
    echo "文件不存在，退出"
    exit 1
fi

# 函数输出字符串（用 echo）
get_date_str() {
    echo $(date +%Y-%m-%d)
}

today=$(get_date_str)
echo "今天：$today"
```

---

## 实用脚本技巧

### 错误处理

```bash
#!/bin/bash
set -e   # 在适用上下文中遇到非零退出状态时退出，并非所有失败都会触发

# 自定义错误处理函数
error_exit() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') ERROR: $1" >&2
    exit 1
}

# 检查命令是否存在
if ! command -v python3 &>/dev/null; then
    error_exit "python3 未安装"
fi

# 检查参数数量
if [ $# -ne 2 ]; then
    error_exit "用法: $0 <输入文件> <输出目录>"
fi
```

### 日志函数

```bash
# 带时间戳的日志函数
LOG_FILE="/var/log/etl/etl_$(date +%Y%m%d).log"

log_info() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') INFO: $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') ERROR: $1" | tee -a "$LOG_FILE" >&2
}

log_info "开始处理数据"
log_error "文件不存在"
```

### 参数解析

```bash
#!/bin/bash
# 处理命令行参数

usage() {
    echo "用法: $0 [-d 数据目录] [-o 输出目录] [-v]"
    echo "  -d  数据输入目录"
    echo "  -o  结果输出目录"
    echo "  -v  详细模式"
    exit 1
}

DATA_DIR=""
OUTPUT_DIR=""
VERBOSE=false

while getopts "d:o:v" opt; do
    case $opt in
        d) DATA_DIR="$OPTARG" ;;
        o) OUTPUT_DIR="$OPTARG" ;;
        v) VERBOSE=true ;;
        ?) usage ;;
    esac
done

# 调用：bash script.sh -d /data/raw -o /data/output -v
```

---

## 完整实战：每日数据处理脚本

```bash
#!/bin/bash
# =======================================================
# 脚本名：daily_data_process.sh
# 功能：每日订单数据处理
#   1. 验证输入文件存在且非空
#   2. 数据清洗（去除空行、异常值）
#   3. 统计汇总
#   4. 输出结果并记录日志
# 用法：bash daily_data_process.sh <日期，格式YYYYMMDD>
# =======================================================

set -e
set -o pipefail

# ---- 配置 ----
BASE_DIR="/data"
RAW_DIR="${BASE_DIR}/raw"
OUTPUT_DIR="${BASE_DIR}/output"
LOG_DIR="/var/log/etl"
DATE="${1:-$(date +%Y%m%d)}"   # 默认用今天的日期

INPUT_FILE="${RAW_DIR}/orders_${DATE}.csv"
OUTPUT_FILE="${OUTPUT_DIR}/orders_summary_${DATE}.txt"
LOG_FILE="${LOG_DIR}/etl_${DATE}.log"

# ---- 日志函数 ----
log() {
    local level="$1"
    local message="$2"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [${level}] ${message}" | tee -a "$LOG_FILE"
}

info()  { log "INFO " "$1"; }
warn()  { log "WARN " "$1"; }
error() { log "ERROR" "$1" >&2; }

# ---- 初始化 ----
mkdir -p "$OUTPUT_DIR" "$LOG_DIR"
info "====== 开始处理 ${DATE} 的数据 ======"

# ---- 1. 检查输入文件 ----
info "检查输入文件：${INPUT_FILE}"

if [ ! -f "$INPUT_FILE" ]; then
    error "输入文件不存在：${INPUT_FILE}"
    exit 1
fi

if [ ! -s "$INPUT_FILE" ]; then
    error "输入文件为空：${INPUT_FILE}"
    exit 1
fi

file_size=$(du -sh "$INPUT_FILE" | cut -f1)
line_count=$(wc -l < "$INPUT_FILE")
info "文件大小：${file_size}，行数：${line_count}"

# ---- 2. 数据清洗 ----
info "开始数据清洗..."

CLEAN_FILE="/tmp/orders_${DATE}_clean.csv"

# 保留表头，去除空行，去除金额为0或负数的异常记录
head -1 "$INPUT_FILE" > "$CLEAN_FILE"
tail -n +2 "$INPUT_FILE" \
    | grep -v "^$" \
    | awk -F',' '$5 > 0 { print }' \
    >> "$CLEAN_FILE"

clean_count=$(wc -l < "$CLEAN_FILE")
dropped=$((line_count - clean_count))
info "清洗完成：保留 $((clean_count-1)) 条有效记录，丢弃 ${dropped} 条异常记录"

# ---- 3. 统计汇总 ----
info "开始统计汇总..."

{
    echo "=============================="
    echo "日期: ${DATE}"
    echo "生成时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "=============================="
    echo ""

    echo "【总体概况】"
    awk -F',' 'NR > 1 {
        count++
        sum += $5
        if ($5 > max_amount || max_amount == "") max_amount = $5
    }
    END {
        printf "总订单数: %d\n", count
        printf "总金额: %.2f\n", sum
        printf "平均金额: %.2f\n", (count > 0 ? sum/count : 0)
        printf "最大订单金额: %.2f\n", max_amount
    }' "$CLEAN_FILE"

    echo ""
    echo "【各城市订单量 TOP 10】"
    awk -F',' 'NR > 1 { city[$3]++; city_sum[$3]+=$5 }
    END { for (c in city) printf "%s\t%d\t%.2f\n", c, city[c], city_sum[c] }' "$CLEAN_FILE" \
    | sort -t$'\t' -k2 -rn \
    | head -10 \
    | awk -F'\t' '{ printf "  %-15s 订单数: %d  金额: %.2f\n", $1, $2, $3 }'

    echo ""
    echo "【各状态订单分布】"
    awk -F',' 'NR > 1 { status[$6]++ }
    END { for (s in status) printf "  %-15s %d\n", s, status[s] }' "$CLEAN_FILE" \
    | sort -k2 -rn

} > "$OUTPUT_FILE"

info "统计结果已保存到：${OUTPUT_FILE}"

# ---- 4. 清理临时文件 ----
rm -f "$CLEAN_FILE"

# ---- 完成 ----
info "====== 处理完成 ======"
info "输出文件：${OUTPUT_FILE}"

# 打印汇总到日志
cat "$OUTPUT_FILE" >> "$LOG_FILE"

exit 0
```

**运行脚本**：

```bash
# 处理今天的数据
bash daily_data_process.sh

# 处理指定日期的数据
bash daily_data_process.sh 20260318

# 实时查看日志
tail -f /var/log/etl/etl_20260318.log
```

---

## 调试脚本

```bash
# 方法 1：bash -x 执行（跟踪并打印执行前展开后的命令；命令自身的输出仍按原有重定向处理）
bash -x myscript.sh

# 方法 2：在脚本中加 set -x 开启调试
set -x    # 开启
# ... 要调试的代码 ...
set +x    # 关闭

# 方法 3：输出调试信息
DEBUG=true
if $DEBUG; then
    echo "DEBUG: 变量值 = $variable"
fi

# 方法 4：检查退出状态码
command
echo "退出状态：$?"   # 0 表示成功
```

---

## 快速参考

| 语法 | 示例 |
|------|------|
| 定义变量 | `name="alice"` |
| 使用变量 | `echo ${name}` |
| 命令替换 | `today=$(date +%Y-%m-%d)` |
| 条件判断 | `if [ -f "$file" ]; then ... fi` |
| for 循环 | `for f in *.csv; do ... done` |
| while 循环 | `while [ $i -lt 10 ]; do ... done` |
| 定义函数 | `my_func() { echo "$1"; }` |
| 退出码 | `exit 0`（成功），`exit 1`（失败） |
| 算术运算 | `result=$((a + b))` |

---

## 下一步

- [[【技术与工具】/Linux/11-定时任务crontab]] - 让脚本定时自动执行
- [[【技术与工具】/Linux/09-进程与任务管理]] - 在后台运行脚本，不因 SSH 断线中断
- [[【技术与工具】/Linux/14-实战场景]] - 更多完整的脚本案例

---

> [!info] 前置知识
> - [[【技术与工具】/Linux/07-管道与重定向|管道与重定向]] - 理解标准输入/输出和管道，脚本里大量用到
> - [[【技术与工具】/Linux/06-文本处理三剑客|文本处理三剑客]] - grep/sed/awk 是脚本里最常调用的命令
> - [[【技术与工具】/Linux/05-文件权限与用户管理|文件权限管理]] - 脚本文件需要 `chmod +x` 才能直接执行

---

## 掌握检查

- [ ] 能写一个有 `#!/bin/bash` 声明行、变量赋值、`if` 判断和 `for` 循环的基础脚本
- [ ] 知道 `$1`、`$#`、`$?` 分别代表什么（第一个参数、参数个数、上条命令的退出状态）
- [ ] 理解 `set -e` 的退出条件及其上下文例外，以及 `set -o pipefail` 如何让管道反映失败状态；知道关键步骤仍需显式检查
- [ ] 能在脚本中实现带时间戳的日志函数，区分 INFO 和 ERROR 级别输出
- [ ] 能用 `bash -x script.sh` 调试脚本，知道如何读懂调试输出

---

## 实践练习

**基础题**：写一个脚本 `cleanup.sh`，接受一个目录路径作为参数，统计该目录下有多少个 `.log` 文件、总大小是多少，并将超过 30 天未修改的日志文件列出来（不删除，只列出路径）。

**进阶题**：在基础题脚本的基础上，增加以下功能：(1) 添加参数校验，目录不存在时打印错误并退出；(2) 用带时间戳的日志函数记录每一步操作；(3) 增加 `-d 天数` 参数，允许调用者指定"多少天以上"的文件（默认 30 天）。

---

## 下一步

- [[【技术与工具】/Linux/11-定时任务crontab|定时任务crontab]] - 让脚本定时自动执行
- [[【技术与工具】/Linux/09-进程与任务管理|进程与tmux]] - 在后台运行脚本，不因 SSH 断线中断

#Shell #Bash #脚本编程 #自动化 #数据工程
