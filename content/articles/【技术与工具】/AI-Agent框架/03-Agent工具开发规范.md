---
title: Agent工具开发规范
tags:
  - AI-Agent
  - Tool
  - 工具开发
  - 最佳实践
difficulty: 高级
duration: 60分钟
aliases:
  - Agent工具规范
  - LLM工具开发
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据治理工程师
  - 数据科学家
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-11
updated: 2026-10-10
---


# Agent 工具开发规范

Agent 有多强，取决于它能用什么工具。

这话不是在吹工具的重要性——而是在说：LLM 本身的推理能力已经相当可观，真正限制 Agent 能力上限的，往往是工具的质量。一个工具描述含糊不清，LLM 就可能误判该什么时候用它；一个工具遇到错误后抛出未被框架或调用方处理的异常，Agent 工作流可能中断；一个工具返回的数据超过上下文限制，可能导致请求失败或内容被截断。

这篇文档讲的是：如何把工具做对。

> [!tip] 前置知识
> - Python 函数和类型注解基础
> - 了解 LangGraph 或 CrewAI 的工具集成方式（见 [[【技术与工具】/AI-Agent框架/01-LangGraph实战|LangGraph实战]]、[[【技术与工具】/AI-Agent框架/02-CrewAI实战|CrewAI实战]]）

---

## 工具设计的核心原则

在写第一行代码之前，先记住三条原则：

**原则一：单一职责**

一个工具只做一件事。不要写"查询并分析并生成报告"的大工具——拆成三个。LLM 需要理解每个工具的边界，工具越简单，LLM 的选择越精准。

**原则二：描述决定一切**

LLM 靠读 `description` 来决定"什么时候用这个工具"、"该传什么参数"。description 写得好不好，直接影响工具被正确使用的概率。这是最被低估的工程工作。

**原则三：错误是数据，不是异常**

工具遇到可预期、可恢复的业务错误时，优先返回结构化错误信息，让 Agent 能读懂错误并决定下一步——是重试、换参数、还是告知用户。异常也可以交由框架配置的错误处理机制处理；程序缺陷或不可恢复故障应记录并上报，是否中断工作流取决于调用方的处理策略，不应一律吞掉。

---

## 工具描述的正确写法

LLM 在选择工具时，读的是 `description`。好的 description 应该包含：

1. **用途**：这个工具能做什么
2. **触发条件**：什么时候应该用（什么时候不应该用）
3. **参数说明**：每个参数的含义和格式要求
4. **返回格式**：返回什么，格式如何
5. **典型使用场景**（可选，但很有效）

### 对比示例

```python
# ❌ 坏的 description：太简略，LLM 不知道该如何使用
@tool("数据库查询")
def query_db(sql: str) -> str:
    """查询数据库"""
    pass

# ✅ 好的 description：清晰、完整、有边界
@tool("业务数据库查询工具")
def query_business_db(sql: str, max_rows: int = 100) -> str:
    """
    查询公司业务数据库，获取运营指标和用户数据。

    适用场景：
    - 需要获取销售数据、用户数据、订单数据时
    - 需要按时间、地区、品类等维度汇总数据时
    - 验证某个数字或指标时

    不适合的场景：
    - 实时库存查询（请使用库存查询工具）
    - 外部竞品数据（数据库中没有）

    参数：
    - sql：SELECT 查询语句。只支持 SELECT，不支持 INSERT/UPDATE/DELETE
    - max_rows：返回的最大行数，默认 100，最大 1000

    数据库包含的主要表：
    - orders（订单表）：order_id, user_id, amount, status, created_at
    - users（用户表）：user_id, register_date, region, user_type
    - products（商品表）：product_id, name, category, price

    返回：JSON 格式的查询结果，包含 columns（列名列表）和 rows（数据行列表）
    """
    pass
```

description 字数多一些不一定是坏事——工具描述通常会占用输入 token 和上下文预算，应在必要信息与简洁性之间权衡；描述不清楚会增加工具被错误使用的概率和修复成本。

---

## 数据工程师的工具箱

### 工具一：SQL 执行工具（最核心）

这是数据工程师给 Agent 配备的最重要工具。难点在于：安全性、错误处理、结果格式化。

```python
from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from typing import Type, Optional
import json
import re

class SQLQueryInput(BaseModel):
    sql: str = Field(
        description="要执行的 SQL 查询语句。只支持 SELECT，不支持修改操作。"
    )
    max_rows: int = Field(
        default=100,
        description="返回结果的最大行数，默认 100，最大 500。超过限制会自动截断并提示。"
    )

class SQLQueryTool(BaseTool):
    name: str = "业务数据库查询工具"
    description: str = """查询公司业务数据库，获取订单、用户、商品等运营数据。
    支持复杂 SQL：聚合、分组、JOIN、子查询。
    只支持 SELECT，不支持数据修改。
    返回 JSON 格式结果，包含列名和数据行。
    如果结果超过 max_rows 限制，会自动截断并在结果中说明。"""
    args_schema: Type[BaseModel] = SQLQueryInput

    def _run(self, sql: str, max_rows: int = 100) -> str:
        # --- 安全检查 ---
        cleaned_sql = sql.strip().upper()

        # 拒绝非 SELECT 语句
        if not cleaned_sql.startswith("SELECT") and not cleaned_sql.startswith("WITH"):
            return json.dumps({
                "error": "安全限制：只允许 SELECT 查询，不支持 INSERT/UPDATE/DELETE/DROP 等操作",
                "sql_received": sql[:100]
            }, ensure_ascii=False)

        # 检查部分危险语法模式：不能覆盖注释、嵌套或不同SQL方言的全部绕过方式
        dangerous_patterns = [
            r";\s*(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)",
            r"--\s*",  # SQL 注释（防止注释掉 WHERE 条件）
        ]
        for pattern in dangerous_patterns:
            if re.search(pattern, cleaned_sql):
                return json.dumps({
                    "error": f"SQL 包含不允许的语法模式：{pattern}",
                    "suggestion": "请使用简单的 SELECT 语句"
                }, ensure_ascii=False)

        # --- 参数边界检查 ---
        max_rows = min(max(1, max_rows), 500)  # 限制在 1-500 之间

        # --- 执行查询 ---
        try:
            # 实际场景：替换为真实数据库连接
            # import sqlalchemy
            # engine = sqlalchemy.create_engine(DATABASE_URL)
            # with engine.connect() as conn:
            #     result = conn.execute(sqlalchemy.text(sql))
            #     rows = result.fetchmany(max_rows + 1)  # 多取一条判断是否截断
            #     columns = list(result.keys())

            # Mock 实现
            columns = ["date", "product_category", "revenue", "orders_count"]
            rows = [
                ["2024-12-01", "电子产品", 580000, 1240],
                ["2024-12-01", "服装", 320000, 2100],
                ["2024-12-02", "电子产品", 612000, 1310],
            ]

            # --- 结果处理 ---
            truncated = len(rows) > max_rows
            rows_to_return = rows[:max_rows]

            result = {
                "success": True,
                "columns": columns,
                "rows": rows_to_return,
                "row_count": len(rows_to_return),
                "truncated": truncated,
            }

            if truncated:
                result["truncation_note"] = (
                    f"结果已截断，只返回前 {max_rows} 行。"
                    f"如需完整数据，请在 SQL 中添加更精确的过滤条件。"
                )

            return json.dumps(result, ensure_ascii=False, default=str)

        except Exception as e:
            # 教学示例统一返回错误字符串；生产环境需区分可恢复错误与应记录、上报的程序或系统故障
            return json.dumps({
                "error": f"查询执行失败：{str(e)}",
                "sql": sql[:200],
                "suggestion": "请检查 SQL 语法和表名是否正确"
            }, ensure_ascii=False)
```

### 工具二：数据概览工具

让 LLM 了解数据库结构，才能生成正确的 SQL。

```python
class TableSchemaInput(BaseModel):
    table_name: Optional[str] = Field(
        default=None,
        description="要查询的表名。不填则返回所有可用表的列表。"
    )

class TableSchemaTool(BaseTool):
    name: str = "数据库结构查询工具"
    description: str = """查询数据库表结构，帮助理解数据的组织方式。
    - 不填 table_name：返回所有可用表的列表和简介
    - 填写 table_name：返回该表的字段定义、数据类型、行数估算和样本数据
    在生成 SQL 查询前，建议先用此工具了解数据结构。"""
    args_schema: Type[BaseModel] = TableSchemaInput

    def _run(self, table_name: Optional[str] = None) -> str:
        # Mock 表结构信息
        schema_info = {
            "orders": {
                "description": "订单主表，记录所有用户下单记录",
                "columns": {
                    "order_id": {"type": "VARCHAR(32)", "nullable": False, "description": "订单唯一标识"},
                    "user_id": {"type": "BIGINT", "nullable": False, "description": "下单用户ID"},
                    "amount": {"type": "DECIMAL(10,2)", "nullable": False, "description": "订单金额（元）"},
                    "status": {"type": "VARCHAR(20)", "nullable": False, "description": "订单状态：pending/paid/shipped/completed/cancelled"},
                    "created_at": {"type": "DATETIME", "nullable": False, "description": "下单时间"},
                    "product_category": {"type": "VARCHAR(50)", "nullable": True, "description": "商品类目"}
                },
                "estimated_rows": 12000000,
                "sample_data": [
                    {"order_id": "ORD20241201001", "user_id": 10001, "amount": 299.00, "status": "completed", "created_at": "2024-12-01 10:23:45", "product_category": "电子产品"},
                    {"order_id": "ORD20241201002", "user_id": 10002, "amount": 89.50, "status": "shipped", "created_at": "2024-12-01 11:05:12", "product_category": "服装"}
                ]
            },
            "users": {
                "description": "用户基础信息表",
                "columns": {
                    "user_id": {"type": "BIGINT", "nullable": False, "description": "用户唯一标识"},
                    "register_date": {"type": "DATE", "nullable": False, "description": "注册日期"},
                    "region": {"type": "VARCHAR(20)", "nullable": True, "description": "所在地区（省份）"},
                    "user_type": {"type": "VARCHAR(10)", "nullable": False, "description": "用户类型：normal/vip/svip"}
                },
                "estimated_rows": 3500000,
                "sample_data": [
                    {"user_id": 10001, "register_date": "2023-06-15", "region": "广东", "user_type": "vip"}
                ]
            }
        }

        if table_name is None:
            # 返回所有表的概览
            tables_overview = {
                name: {
                    "description": info["description"],
                    "estimated_rows": info["estimated_rows"],
                    "column_count": len(info["columns"])
                }
                for name, info in schema_info.items()
            }
            return json.dumps({
                "available_tables": tables_overview,
                "tip": "使用 table_name 参数查询特定表的详细结构"
            }, ensure_ascii=False)

        if table_name not in schema_info:
            return json.dumps({
                "error": f"表 '{table_name}' 不存在",
                "available_tables": list(schema_info.keys())
            }, ensure_ascii=False)

        return json.dumps(schema_info[table_name], ensure_ascii=False, default=str)
```

### 工具三：计算工具

让 Python 做数学计算，不要让 LLM 算——LLM 的数学是出了名的不可靠。

```python
class PandasComputeInput(BaseModel):
    data_json: str = Field(description="要计算的数据，JSON 格式的列表，元素为字典")
    operation: str = Field(
        description="""要执行的操作，当前示例支持：
        - sum_by_group：按指定字段分组求和
        - percentage：计算各项占总量的百分比
        - yoy_growth：计划扩展的同比增长率计算（需要 current 和 previous 字段），当前未实现
        - rank：计划扩展的按指定字段排名，当前未实现
        - describe：基础统计描述（均值、中位数、最大最小值）"""
    )
    params: str = Field(
        default="{}",
        description="操作参数，JSON 格式。例如：{\"group_by\": \"category\", \"value_col\": \"revenue\"}"
    )

class PandasComputeTool(BaseTool):
    name: str = "数据计算工具"
    description: str = """对数据执行数学计算和统计分析。
    使用 Python Pandas 进行准确计算，结果可信度高于 LLM 直接推算。
    当前示例适合：汇总求和、百分比计算和基础统计描述；同比环比、排名需另行实现。
    数据来源通常是数据库查询工具的输出结果。"""
    args_schema: Type[BaseModel] = PandasComputeInput

    def _run(self, data_json: str, operation: str, params: str = "{}") -> str:
        try:
            import pandas as pd
            data = json.loads(data_json)
            params_dict = json.loads(params)
            df = pd.DataFrame(data)

            if operation == "sum_by_group":
                group_col = params_dict.get("group_by")
                value_col = params_dict.get("value_col")
                if not group_col or not value_col:
                    return json.dumps({"error": "sum_by_group 需要 group_by 和 value_col 参数"}, ensure_ascii=False)
                result = df.groupby(group_col)[value_col].sum().reset_index()
                result = result.sort_values(value_col, ascending=False)
                return json.dumps({"result": result.to_dict(orient="records")}, ensure_ascii=False)

            elif operation == "percentage":
                value_col = params_dict.get("value_col")
                label_col = params_dict.get("label_col")
                total = df[value_col].sum()
                df["percentage"] = (df[value_col] / total * 100).round(2)
                return json.dumps({
                    "result": df[[label_col, value_col, "percentage"]].to_dict(orient="records"),
                    "total": float(total)
                }, ensure_ascii=False)

            elif operation == "describe":
                value_col = params_dict.get("value_col")
                desc = df[value_col].describe()
                return json.dumps({
                    "count": int(desc["count"]),
                    "mean": round(float(desc["mean"]), 2),
                    "median": round(float(df[value_col].median()), 2),
                    "std": round(float(desc["std"]), 2),
                    "min": float(desc["min"]),
                    "max": float(desc["max"])
                }, ensure_ascii=False)

            else:
                return json.dumps({"error": f"不支持的操作：{operation}"}, ensure_ascii=False)

        except json.JSONDecodeError as e:
            return json.dumps({"error": f"JSON 解析失败：{str(e)}"}, ensure_ascii=False)
        except Exception as e:
            return json.dumps({"error": f"计算失败：{str(e)}"}, ensure_ascii=False)
```

### 工具四：文件操作工具

```python
from pathlib import Path

class FileWriteInput(BaseModel):
    filename: str = Field(description="文件名（不含路径），例如：report_2024_12.md")
    content: str = Field(description="要写入的文件内容")
    file_format: str = Field(default="md", description="文件格式：md（Markdown）或 txt")

class FileWriteTool(BaseTool):
    name: str = "报告文件保存工具"
    description: str = """将生成的报告内容保存为文件。
    适合在分析报告生成完成后，将结果持久化保存。
    支持 Markdown 和纯文本格式。
    文件保存到预设的报告目录，返回文件路径。"""
    args_schema: Type[BaseModel] = FileWriteInput

    OUTPUT_DIR: str = "/tmp/agent_reports"  # 实际场景配置为正确目录

    def _run(self, filename: str, content: str, file_format: str = "md") -> str:
        try:
            # 参数校验：扩展名必须来自白名单，不能由调用方任意拼接路径
            if file_format not in {"md", "txt"}:
                return json.dumps({"error": "file_format 只支持 md 或 txt"}, ensure_ascii=False)
            if not filename.strip() or filename in {".", ".."}:
                return json.dumps({"error": "文件名不能为空或为点路径"}, ensure_ascii=False)
            # 基础路径检查；生产环境仍需防覆盖、符号链接及目录权限隔离
            if "/" in filename or "\\" in filename or ".." in filename:
                return json.dumps({"error": "文件名不合法，不能包含路径分隔符"}, ensure_ascii=False)

            output_dir = Path(self.OUTPUT_DIR)
            output_dir.mkdir(parents=True, exist_ok=True)

            # 确保扩展名正确
            safe_name = Path(filename).stem + f".{file_format}"
            file_path = output_dir / safe_name

            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)

            return json.dumps({
                "success": True,
                "file_path": str(file_path),
                "file_size": f"{len(content.encode('utf-8'))} bytes",
                "message": f"报告已保存到 {file_path}"
            }, ensure_ascii=False)

        except Exception as e:
            return json.dumps({"error": f"文件保存失败：{str(e)}"}, ensure_ascii=False)
```

---

## 工具的错误处理规范

核心原则：**把错误转化为信息，让 Agent 能够理解和处理**。

```python
# ❌ 缺少错误处理：异常会向上传播；调用方未处理时可能打断工作流
def bad_tool(query: str) -> str:
    result = database.execute(query)  # 如果失败，异常会向上传播
    return result

# ✅ 正确做法：捕获异常，返回结构化错误信息
def good_tool(query: str) -> str:
    try:
        result = database.execute(query)
        return json.dumps({"success": True, "data": result})
    except DatabaseConnectionError:
        return json.dumps({
            "error": "数据库连接失败",
            "suggestion": "请稍后重试，或检查数据库连接配置",
            "recoverable": True
        }, ensure_ascii=False)
    except SQLSyntaxError as e:
        return json.dumps({
            "error": f"SQL 语法错误：{str(e)}",
            "suggestion": "请检查 SQL 语法，特别是表名和字段名是否正确",
            "recoverable": True  # Agent 可以修改 SQL 后重试
        }, ensure_ascii=False)
    except TimeoutError:
        return json.dumps({
            "error": "查询超时（超过 30 秒）",
            "suggestion": "请添加更多过滤条件缩小数据范围，或增加聚合减少返回行数",
            "recoverable": True
        }, ensure_ascii=False)
```

**超时控制：**

```python
import signal
from contextlib import contextmanager

@contextmanager
def timeout_guard(seconds: int):
    def handler(signum, frame):
        raise TimeoutError(f"执行超时（{seconds}秒）")
    signal.signal(signal.SIGALRM, handler)
    signal.alarm(seconds)
    try:
        yield
    finally:
        signal.alarm(0)

# 在工具中使用
def safe_execute(sql: str) -> str:
    try:
        with timeout_guard(30):  # 30 秒超时
            result = database.execute(sql)
            return json.dumps(result)
    except TimeoutError as e:
        return json.dumps({"error": str(e), "suggestion": "请优化查询或缩小数据范围"})
```

**结果截断（防止超出 context 限制）：**

```python
def truncate_result(result: str, max_chars: int = 3000) -> str:
    """防止工具返回超大内容撑爆 LLM 的 context window"""
    if len(result) <= max_chars:
        return result

    # 截断并添加说明
    truncated = result[:max_chars]
    note = f"\n\n[结果已截断，原始长度 {len(result)} 字符，只显示前 {max_chars} 字符。如需完整数据，请使用更精确的查询条件]"
    return truncated + note
```

---

## 工具测试规范

工具必须可以**独立于 LLM 测试**，不依赖 Agent 环境。

```python
import pytest

class TestSQLQueryTool:

    def setup_method(self):
        self.tool = SQLQueryTool()

    def test_basic_select(self):
        """正常 SELECT 查询应该成功"""
        result = self.tool._run("SELECT * FROM orders LIMIT 10")
        data = json.loads(result)
        assert data["success"] is True
        assert "columns" in data
        assert "rows" in data

    def test_reject_insert(self):
        """INSERT 语句应该被拒绝"""
        result = self.tool._run("INSERT INTO orders VALUES (1, 2, 3)")
        data = json.loads(result)
        assert "error" in data
        assert "安全限制" in data["error"]

    def test_reject_delete(self):
        """DELETE 语句应该被拒绝"""
        result = self.tool._run("DELETE FROM orders WHERE order_id = 1")
        data = json.loads(result)
        assert "error" in data

    def test_max_rows_limit(self):
        """超过最大行数应该截断"""
        result = self.tool._run("SELECT * FROM orders", max_rows=2)
        data = json.loads(result)
        assert data["row_count"] <= 2

    def test_invalid_max_rows(self):
        """无效的 max_rows 参数应该被修正，不能崩溃"""
        result = self.tool._run("SELECT * FROM orders", max_rows=99999)
        data = json.loads(result)
        # 应该被限制在最大允许值，而不是报错
        assert data["row_count"] <= 500

    def test_empty_result(self):
        """空结果集应该正常处理，不报错"""
        result = self.tool._run("SELECT * FROM orders WHERE order_id = 'NONEXISTENT'")
        data = json.loads(result)
        assert data["success"] is True
        assert data["rows"] == [] or data["row_count"] == 0

    def test_returns_valid_json(self):
        """工具返回值必须是合法 JSON"""
        result = self.tool._run("SELECT 1")
        # 验证 JSON 可以正常解析（不抛出异常即为通过）
        json.loads(result)
```

---

## 工具安全规范

**只读权限原则：**

```python
# 数据库连接配置：给 Agent 用的账号只有 SELECT 权限
# MySQL
READ_ONLY_DB_URL = "mysql+pymysql://agent_readonly:password@host/database"

# PostgreSQL
READ_ONLY_DB_URL = "postgresql://agent_readonly:password@host/database"

# 在数据库侧也配置权限
# GRANT SELECT ON ALL TABLES IN SCHEMA public TO agent_readonly;
# 应用侧 + 数据库侧双重防护，不能只靠应用侧检查
```

**调用日志记录：**

```python
import logging
from datetime import datetime

logger = logging.getLogger("agent_tool")

class LoggedSQLQueryTool(SQLQueryTool):
    """带调用日志的 SQL 查询工具"""

    def _run(self, sql: str, max_rows: int = 100) -> str:
        start_time = datetime.now()

        # 记录调用
        logger.info(f"[TOOL_CALL] sql_query | sql={sql[:200]} | max_rows={max_rows}")

        result = super()._run(sql, max_rows)
        result_data = json.loads(result)

        elapsed_ms = (datetime.now() - start_time).total_seconds() * 1000

        # 记录结果
        if "error" in result_data:
            logger.warning(f"[TOOL_ERROR] sql_query | error={result_data['error']} | elapsed={elapsed_ms:.0f}ms")
        else:
            row_count = result_data.get("row_count", 0)
            logger.info(f"[TOOL_SUCCESS] sql_query | rows={row_count} | elapsed={elapsed_ms:.0f}ms")

        return result
```

---

## 快速检查清单

在工具上线前，过一遍这个清单：

- [ ] **描述完整**：description 包含用途、触发条件、参数说明、返回格式
- [ ] **错误处理**：可恢复错误返回结构化信息或由框架处理；程序缺陷和不可恢复故障有明确的记录、上报及终止策略
- [ ] **参数验证**：对输入参数做边界检查（类型、范围、格式）
- [ ] **结果截断**：有防止超长结果的截断机制
- [ ] **超时控制**：网络调用或重查询有超时限制
- [ ] **安全检查**：SQL 工具拒绝非 SELECT；文件工具检查路径遍历
- [ ] **独立测试**：有不依赖 LLM 的单元测试，覆盖正常和异常路径
- [ ] **调用日志**：生产环境有工具调用和错误日志

---

## 相关文档

- [[【技术与工具】/AI-Agent框架/00-AI-Agent框架选型指南|AI Agent框架选型指南]] — 选择框架之前先确认需求
- [[【技术与工具】/AI-Agent框架/01-LangGraph实战|LangGraph实战]] — LangGraph 中的工具集成
- [[【技术与工具】/AI-Agent框架/02-CrewAI实战|CrewAI实战]] — CrewAI 中的工具集成
- [[【AI 与大数据】/03-AI-Agent/01-AI-Agent智能体概述|AI Agent智能体概述]] — Agent 基础概念
- [[【AI 与大数据】/03-AI-Agent/02-AI-Agent开发框架实战|AI Agent开发框架实战]] — 更多工具开发示例

#AI-Agent #工具开发 #最佳实践 #Tool #数据工程
