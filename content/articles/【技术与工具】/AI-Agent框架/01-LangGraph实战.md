---
title: LangGraph实战
tags:
  - LangGraph
  - LangChain
  - AI-Agent
  - 状态机
  - 工作流
difficulty: 高级
duration: 120分钟
aliases:
  - LangGraph教程
  - LangGraph有状态Agent
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据科学家
  - 数据分析师
  - 数据架构师
  - BI分析师
  - 数据治理工程师
stability: fast-changing
status: maintenance
access_tier: free
created: 2026-03-11
updated: 2026-10-10
---


# LangGraph 实战

LangGraph 面向**有状态的、可以循环的、支持人工介入的复杂 Agent 工作流**，提供显式的图编排与状态管理；这不意味着 LangChain 生态无法实现这些需求。

如果你的 Agent 只需要直线跑到底——接受输入、调用工具、返回结果——LangChain 的普通 Chain 就够了。一旦工作流里出现"根据结果决定下一步"、"某个步骤需要人工确认"、"失败了要重试"，可以考虑 LangGraph，但仍需根据状态持久化、恢复机制和维护成本进行选型。

> [!tip] 前置知识
> - 了解 LangChain 基本概念（Chain、Tool、LLM）
> - Python 基础（dataclass、类型注解）
> - 参考 [[【技术与工具】/AI-Agent框架/00-AI-Agent框架选型指南|AI Agent框架选型指南]] 确认 LangGraph 适合你的场景

---

## LangGraph 的核心思想

LangGraph 把 Agent 的执行过程建模为**有向图（Directed Graph）**：

- **State（状态）**：在整个工作流中流转的数据，每个节点读取状态、修改状态
- **Node（节点）**：一个处理步骤，可以是 LLM 调用、工具执行、条件判断
- **Edge（边）**：节点之间的连接，决定执行顺序
- **Conditional Edge（条件边）**：根据状态内容动态决定走哪条路
- **Checkpoint（检查点）**：把状态持久化到存储，支持断点恢复和人工介入

与普通 LangChain Chain 的根本区别：

```text
本文对比的简单线性 Chain：A → B → C → 结束（未配置循环；不是 LangChain 生态的能力上限）
LangGraph：A → B → C → 判断 → 回到 B 或结束（支持循环和分支）
```

---

## 安装

```bash
pip install langgraph langchain-openai langchain-core
# 如果需要持久化 checkpoint
pip install langgraph-checkpoint-sqlite  # SQLite 版本，开发用
# pip install langgraph-checkpoint-postgres  # PostgreSQL 版本，生产用
```

---

## 从零构建：ReAct Agent

ReAct（Reasoning + Acting）是最经典的 Agent 模式：LLM 思考要做什么，调用工具，观察结果，再思考，直到得出答案。

### 第一步：定义 State

State 是整个 Graph 的核心数据结构。节点读取当前状态并返回字段更新，框架按字段的 reducer 合并更新；不要依赖所有节点共享同一个可变 Python 对象或原地修改状态。

```python
from typing import Annotated, TypedDict, Sequence
from langchain_core.messages import BaseMessage
import operator

class AgentState(TypedDict):
    # messages 是消息历史，Annotated + operator.add 表示"追加"而非"覆盖"
    messages: Annotated[Sequence[BaseMessage], operator.add]
```

> [!note] Annotated 的作用
> LangGraph 用 `Annotated[type, reducer]` 来声明状态字段的更新方式。`operator.add` 表示每次节点更新这个字段时，新值会追加到旧值后面（适合消息历史）。如果直接写 `list`，每次更新会覆盖整个列表。

### 第二步：定义工具

```python
from langchain_core.tools import tool

@tool
def search_data(query: str) -> str:
    """在数据仓库中搜索相关数据。输入搜索关键词，返回相关数据摘要。"""
    # 教学模拟：以下数字为固定示例，不来自真实查询；实际场景需接入数据库或搜索接口
    return f"教学模拟：与 '{query}' 相关的数据：销售额 120万，环比增长 15%"

@tool
def calculate(expression: str) -> str:
    """执行数学计算。输入数学表达式字符串，返回计算结果。"""
    try:
        import ast
        import operator
        if len(expression) > 200:
            raise ValueError("表达式过长")
        tree = ast.parse(expression, mode="eval")
        if sum(1 for _ in ast.walk(tree)) > 100:
            raise ValueError("表达式过于复杂")
        binary = {ast.Add: operator.add, ast.Sub: operator.sub,
                  ast.Mult: operator.mul, ast.Div: operator.truediv}
        unary = {ast.UAdd: operator.pos, ast.USub: operator.neg}
        def evaluate(node):
            if isinstance(node, ast.Constant) and type(node.value) in (int, float):
                return node.value
            if isinstance(node, ast.BinOp) and type(node.op) in binary:
                return binary[type(node.op)](evaluate(node.left), evaluate(node.right))
            if isinstance(node, ast.UnaryOp) and type(node.op) in unary:
                return unary[type(node.op)](evaluate(node.operand))
            raise ValueError("仅支持数字、括号和基础四则运算")
        result = evaluate(tree.body)
        return str(result)
    except Exception as e:
        return f"计算错误：{e}"

tools = [search_data, calculate]
```

### 第三步：构建 Graph

```python
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage

# 初始化 LLM，绑定工具
llm = ChatOpenAI(model="gpt-4o", temperature=0)
llm_with_tools = llm.bind_tools(tools)

# 定义 LLM 节点：调用 LLM，把响应加入消息历史
def call_llm(state: AgentState) -> dict:
    messages = state["messages"]
    response = llm_with_tools.invoke(messages)
    return {"messages": [response]}

# 定义路由函数：判断 LLM 是要调用工具还是直接回答
def should_continue(state: AgentState) -> str:
    last_message = state["messages"][-1]
    # 如果 LLM 返回了 tool_calls，说明它要调用工具
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "use_tools"
    # 否则直接结束
    return END

# 构建 Graph
graph_builder = StateGraph(AgentState)

# 添加节点
graph_builder.add_node("llm", call_llm)
graph_builder.add_node("tools", ToolNode(tools))  # ToolNode 自动处理工具调用

# 设置入口节点
graph_builder.set_entry_point("llm")

# 添加条件边：从 llm 节点出发，根据 should_continue 决定去 tools 还是结束
graph_builder.add_conditional_edges(
    "llm",           # 从哪个节点出发
    should_continue, # 路由函数
    {
        "use_tools": "tools",  # 路由函数返回 "use_tools" → 去 tools 节点
        END: END               # 路由函数返回 END → 结束
    }
)

# 工具执行完后，回到 llm 节点继续推理
graph_builder.add_edge("tools", "llm")

# 编译 Graph
agent = graph_builder.compile()
```

### 第四步：运行

```python
from langchain_core.messages import HumanMessage

result = agent.invoke({
    "messages": [HumanMessage(content="帮我查一下上个月的销售数据，并计算一下如果增长15%，下个月预期是多少")]
})

# 打印最终回答
print(result["messages"][-1].content)
```

**Graph 的执行流程：**

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"PingFang SC, -apple-system, Source Han Serif SC, serif","fontSize":"16px","background":"#FDFBF5","primaryColor":"#FDFBF5","primaryTextColor":"#2D2A26","primaryBorderColor":"#6E6A60","secondaryColor":"#E8EFE8","secondaryBorderColor":"#8FA890","secondaryTextColor":"#2D2A26","tertiaryColor":"#FDFBF5","tertiaryBorderColor":"#9A9488","tertiaryTextColor":"#6E6A60","lineColor":"#6E6A60","textColor":"#2D2A26","mainBkg":"#FDFBF5","nodeBorder":"#2D5A3D","clusterBkg":"#F3EEDF","clusterBorder":"#9A9488","edgeLabelBackground":"#FDFBF5"},"flowchart":{"htmlLabels":true,"curve":"basis","padding":20,"nodeSpacing":60,"rankSpacing":70,"useMaxWidth":false},"themeCSS":".node rect, .node polygon, .node circle { stroke-width: 1.5px; } .edgePath .path { stroke-width: 1.5px; } .cluster-label .nodeLabel, .cluster-label foreignObject { color: #2D2A26 !important; } .edgeLabel, .edgeLabel foreignObject { color: #2D2A26 !important; background-color: #FDFBF5; } .edgeLabel rect { fill: #FDFBF5; }"}}%%
flowchart LR
    START([开始]) --> llm[LLM 节点\n调用语言模型]
    llm --> cond{是否调用工具？}
    cond -- 是 --> tools[Tools 节点\n执行工具调用]
    tools --> llm
    cond -- 否 --> END([结束])

    style llm fill:#4a9eff,color:#fff
    style tools fill:#22c55e,color:#fff
    style cond fill:#f59e0b,color:#fff
```

---

## Human-in-the-Loop：人工审批节点

某些操作不能让 Agent 自动执行——删数据、发邮件、执行财务转账。这时候需要在关键节点暂停，等人类确认后再继续。

### Interrupt 机制

LangGraph 用 `interrupt_before` 或 `interrupt_after` 参数在特定节点暂停执行。

```python
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import StateGraph, END
from typing import Annotated, TypedDict, Sequence
from langchain_core.messages import BaseMessage
import operator
import sqlite3

class SQLAgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    sql_to_execute: str        # 待执行的 SQL
    human_approved: bool       # 是否已获得人工审批
    execution_result: str      # 执行结果

def generate_sql(state: SQLAgentState) -> dict:
    """LLM 根据用户需求生成 SQL"""
    messages = state["messages"]
    response = llm.invoke(messages + [
        ("system", "根据用户需求生成一条 SQL。只返回 SQL，不要解释。")
    ])
    return {
        "messages": [response],
        "sql_to_execute": response.content,
        "human_approved": False
    }

def execute_sql(state: SQLAgentState) -> dict:
    """检查审批标记后模拟执行 SQL；真实执行还需鉴权、SQL 校验与审计"""
    if not state.get("human_approved", False):
        raise PermissionError("尚未获得人工审批")
    sql = state["sql_to_execute"]
    # 教学模拟：未连接数据库，42 行仅为原稿示例数字
    result = "教学模拟：假设 SQL 执行成功，影响 42 行数据（未实际执行）"
    return {"execution_result": result}

def generate_report(state: SQLAgentState) -> dict:
    """根据执行结果生成报告"""
    result = state["execution_result"]
    response = llm.invoke([("human", f"SQL 执行结果：{result}，请生成简要报告")])
    return {"messages": [response]}

# 使用 SQLite 做 checkpoint 持久化
conn = sqlite3.connect("checkpoints.db", check_same_thread=False)
memory = SqliteSaver(conn)

# 构建 Graph，在 execute_sql 节点之前暂停等待人工审批
sql_graph_builder = StateGraph(SQLAgentState)
sql_graph_builder.add_node("generate_sql", generate_sql)
sql_graph_builder.add_node("execute_sql", execute_sql)
sql_graph_builder.add_node("generate_report", generate_report)

sql_graph_builder.set_entry_point("generate_sql")
sql_graph_builder.add_edge("generate_sql", "execute_sql")
sql_graph_builder.add_edge("execute_sql", "generate_report")
sql_graph_builder.add_edge("generate_report", END)

# 关键：interrupt_before=["execute_sql"] 表示在执行 execute_sql 前暂停
sql_agent = sql_graph_builder.compile(
    checkpointer=memory,
    interrupt_before=["execute_sql"]
)
```

### 执行流程：暂停与恢复

```python
from langchain_core.messages import HumanMessage

# thread_id 是会话标识，同一个 thread 的状态会被持久化
config = {"configurable": {"thread_id": "sql_session_001"}}

# 第一次调用：运行到 execute_sql 前暂停
result = sql_agent.invoke(
    {"messages": [HumanMessage(content="把用户表中的测试账号全部删除")]},
    config=config
)

# 此时 Agent 已暂停，可以查看它生成的 SQL
current_state = sql_agent.get_state(config)
sql = current_state.values["sql_to_execute"]
print(f"Agent 要执行的 SQL：\n{sql}")
# 输出：DELETE FROM users WHERE account_type = 'test'

# 人工审核后，决定是否继续
user_decision = input("确认执行？(y/n): ")

if user_decision == "y":
    # 本地教学审批标记；生产环境须绑定审批人及其审核的 SQL，并记录审计日志
    sql_agent.update_state(config, {"human_approved": True})
    # 继续执行（传入 None 表示从断点恢复）
    final_result = sql_agent.invoke(None, config=config)
    print(final_result["messages"][-1].content)
else:
    print("已取消执行")
```

> [!warning] 生产环境用 PostgreSQL Checkpoint
> 本文使用 SQLite 演示开发测试；多进程、多实例部署可评估 `PostgresSaver`，并配置连接生命周期、初始化、权限和恢复策略，不应仅凭存储选型认定已具备生产可靠性：
> ```python
> from langgraph.checkpoint.postgres import PostgresSaver
> with PostgresSaver.from_conn_string("postgresql://user:pass@host/db") as memory:
>     memory.setup()  # 首次使用需初始化；生产环境应安排受控初始化
>     # 在此上下文内编译并运行使用 memory 的图，退出后连接关闭
> ```

---

## 数据分析 Agent 实战

这是这篇文档的核心案例：构建数据分析助手的图编排原型。查询结果为教学模拟，尚未接入真实数据库，生成的 SQL 也未被实际执行；不能将此原型视为完整的生产分析助手。

**功能设计：**

1. 理解用户的自然语言分析需求
2. 生成 SQL 查询（NL2SQL）
3. 执行 SQL，获取数据
4. 分析数据，生成洞察
5. 判断数据是否充分（不够就追加查询）
6. 生成最终分析报告

### State 设计

```python
from typing import Annotated, TypedDict, Sequence, Optional
from langchain_core.messages import BaseMessage
import operator

class DataAnalysisState(TypedDict):
    # 对话历史
    messages: Annotated[Sequence[BaseMessage], operator.add]
    # 用户的分析需求（结构化）
    analysis_goal: str
    # 已执行的查询列表
    executed_queries: list[dict]
    # 所有查询结果汇总
    query_results: list[dict]
    # 是否需要追加查询
    needs_more_data: bool
    # 追加查询的原因
    missing_data_reason: str
    # 最终报告
    final_report: str
    # 当前迭代次数（防止无限循环）
    iteration_count: int
```

### 节点定义

```python
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
import json

llm = ChatOpenAI(model="gpt-4o", temperature=0)

# --- 节点 1：理解需求 ---
def understand_requirement(state: DataAnalysisState) -> dict:
    """把用户的自然语言需求转换为结构化分析目标"""
    user_input = state["messages"][-1].content

    response = llm.invoke([
        SystemMessage(content="""你是一个数据分析专家。
把用户的分析需求转化为结构化目标。
返回 JSON 格式：{"goal": "核心分析目标", "metrics": ["指标1", "指标2"], "dimensions": ["维度1"]}"""),
        HumanMessage(content=user_input)
    ])

    try:
        goal_data = json.loads(response.content)
        analysis_goal = goal_data.get("goal", user_input)
    except Exception:
        analysis_goal = user_input

    return {
        "analysis_goal": analysis_goal,
        "iteration_count": 0,
        "executed_queries": [],
        "query_results": []
    }

# --- 节点 2：生成 SQL ---
def generate_sql_query(state: DataAnalysisState) -> dict:
    """根据分析目标生成 SQL 查询"""
    goal = state["analysis_goal"]
    existing_results = state["query_results"]
    missing_reason = state.get("missing_data_reason", "")

    # 如果是追加查询，把已有数据和缺失原因告诉 LLM
    context = f"分析目标：{goal}"
    if missing_reason:
        context += f"\n已有数据不足，需要补充：{missing_reason}"
    if existing_results:
        context += f"\n已查询的数据：{json.dumps(existing_results, ensure_ascii=False)}"

    response = llm.invoke([
        SystemMessage(content="""你是一个 SQL 专家。
根据分析目标生成 SQL 查询。只返回 SQL 语句，不要解释。
数据库包含：orders（订单表）、users（用户表）、products（商品表）。"""),
        HumanMessage(content=context)
    ])

    sql = response.content.strip()
    return {"messages": [response], "needs_more_data": False}

# 模拟 SQL 执行（实际场景替换为真实数据库连接）
_sql_counter = 0

def execute_query(state: DataAnalysisState) -> dict:
    """执行 SQL 查询"""
    global _sql_counter
    _sql_counter += 1

    # 实际场景：用 sqlalchemy 或 pymysql 执行
    mock_results = {
        1: {"period": "2024-Q4", "revenue": 1250000, "orders": 8420, "avg_order": 148.5},
        2: {"yoy_growth": 0.23, "top_category": "电子产品", "category_share": 0.38}
    }
    result = mock_results.get(_sql_counter, {"note": "暂无更多数据"})

    executed_queries = state["executed_queries"] + [{"sql": f"查询{_sql_counter}", "result": result}]
    query_results = state["query_results"] + [result]

    return {
        "executed_queries": executed_queries,
        "query_results": query_results,
        "iteration_count": state["iteration_count"] + 1
    }

# --- 节点 3：分析数据 ---
def analyze_results(state: DataAnalysisState) -> dict:
    """分析查询结果，判断是否足够生成报告"""
    goal = state["analysis_goal"]
    results = state["query_results"]
    iteration = state["iteration_count"]

    response = llm.invoke([
        SystemMessage(content="""你是数据分析专家。
分析已有数据是否足以回答分析目标。
如果数据充分，返回 JSON：{"sufficient": true, "insights": "主要洞察"}
如果数据不足，返回 JSON：{"sufficient": false, "missing": "缺少什么数据"}
只返回 JSON，不要解释。"""),
        HumanMessage(content=f"分析目标：{goal}\n已有数据：{json.dumps(results, ensure_ascii=False)}")
    ])

    try:
        analysis = json.loads(response.content)
        if analysis.get("sufficient") or iteration >= 3:  # 最多查 3 次
            return {"needs_more_data": False, "missing_data_reason": ""}
        else:
            return {
                "needs_more_data": True,
                "missing_data_reason": analysis.get("missing", "需要更多数据")
            }
    except Exception:
        return {"needs_more_data": False, "missing_data_reason": ""}

# --- 节点 4：生成报告 ---
def generate_report(state: DataAnalysisState) -> dict:
    """生成最终分析报告"""
    goal = state["analysis_goal"]
    results = state["query_results"]

    response = llm.invoke([
        SystemMessage(content="你是数据分析专家。根据数据生成结构化分析报告，包含关键指标、趋势分析、结论建议。"),
        HumanMessage(content=f"分析目标：{goal}\n数据：{json.dumps(results, ensure_ascii=False)}")
    ])

    return {
        "final_report": response.content,
        "messages": [response]
    }
```

### 路由函数与 Graph 组装

```python
from langgraph.graph import StateGraph, END

def route_after_analysis(state: DataAnalysisState) -> str:
    """分析完数据后，决定是追加查询还是生成报告"""
    if state["needs_more_data"] and state["iteration_count"] < 3:
        return "generate_sql_query"  # 回去追加查询
    return "generate_report"

# 构建 Graph
builder = StateGraph(DataAnalysisState)

builder.add_node("understand_requirement", understand_requirement)
builder.add_node("generate_sql_query", generate_sql_query)
builder.add_node("execute_query", execute_query)
builder.add_node("analyze_results", analyze_results)
builder.add_node("generate_report", generate_report)

builder.set_entry_point("understand_requirement")
builder.add_edge("understand_requirement", "generate_sql_query")
builder.add_edge("generate_sql_query", "execute_query")
builder.add_edge("execute_query", "analyze_results")

# 条件边：分析后根据数据充分性决定下一步
builder.add_conditional_edges(
    "analyze_results",
    route_after_analysis,
    {
        "generate_sql_query": "generate_sql_query",  # 追加查询（循环）
        "generate_report": "generate_report"          # 数据够了，生成报告
    }
)

builder.add_edge("generate_report", END)

data_analysis_agent = builder.compile()
```

### 执行流程图

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"PingFang SC, -apple-system, Source Han Serif SC, serif","fontSize":"16px","background":"#FDFBF5","primaryColor":"#FDFBF5","primaryTextColor":"#2D2A26","primaryBorderColor":"#6E6A60","secondaryColor":"#E8EFE8","secondaryBorderColor":"#8FA890","secondaryTextColor":"#2D2A26","tertiaryColor":"#FDFBF5","tertiaryBorderColor":"#9A9488","tertiaryTextColor":"#6E6A60","lineColor":"#6E6A60","textColor":"#2D2A26","mainBkg":"#FDFBF5","nodeBorder":"#2D5A3D","clusterBkg":"#F3EEDF","clusterBorder":"#9A9488","edgeLabelBackground":"#FDFBF5"},"flowchart":{"htmlLabels":true,"curve":"basis","padding":20,"nodeSpacing":60,"rankSpacing":70,"useMaxWidth":false},"themeCSS":".node rect, .node polygon, .node circle { stroke-width: 1.5px; } .edgePath .path { stroke-width: 1.5px; } .cluster-label .nodeLabel, .cluster-label foreignObject { color: #2D2A26 !important; } .edgeLabel, .edgeLabel foreignObject { color: #2D2A26 !important; background-color: #FDFBF5; } .edgeLabel rect { fill: #FDFBF5; }"}}%%
flowchart TD
    START([用户提问]) --> A[理解需求\nunderstand_requirement]
    A --> B[生成SQL\ngenerate_sql_query]
    B --> C[执行查询\nexecute_query]
    C --> D[分析结果\nanalyze_results]
    D --> E{需要追加查询？\n且迭代 < 3次}
    E -- 是 --> B
    E -- 否 --> F[生成报告\ngenerate_report]
    F --> END([输出分析报告])

    style A fill:#4a9eff,color:#fff
    style D fill:#f59e0b,color:#fff
    style E fill:#f59e0b,color:#fff
    style F fill:#22c55e,color:#fff
```

### 运行示例

```python
from langchain_core.messages import HumanMessage

result = data_analysis_agent.invoke({
    "messages": [HumanMessage(content="分析一下我们 2024 年第四季度的销售表现，重点看同比增长和品类结构")]
})

print(result["final_report"])
print(f"\n共执行了 {result['iteration_count']} 次查询")
```

---

## 并行节点：同时执行多个查询

当多个查询彼此独立时，没必要串行等待——LangGraph 支持并行节点。

```python
from langgraph.constants import Send

class ParallelQueryState(TypedDict):
    user_question: str
    query_tasks: list[str]       # 需要并行执行的查询列表
    query_results: Annotated[list, operator.add]  # 并行结果汇总（追加语义）
    final_answer: str

def plan_queries(state: ParallelQueryState) -> dict:
    """把用户问题拆分为多个独立查询"""
    return {
        "query_tasks": [
            "SELECT SUM(revenue) FROM orders WHERE date = CURRENT_DATE",
            "SELECT SUM(revenue) FROM orders WHERE date = CURRENT_DATE - 1"
        ]
    }

def execute_single_query(query_task: dict) -> dict:
    """执行单个查询（被并行调度的节点）"""
    sql = query_task["sql"]
    # 实际执行 SQL...
    result = {"sql": sql, "result": 100000}
    return {"query_results": [result]}

def fan_out(state: ParallelQueryState):
    """使用 Send API 把查询任务分发到并行节点"""
    return [
        Send("execute_single_query", {"sql": task})
        for task in state["query_tasks"]
    ]

builder = StateGraph(ParallelQueryState)
builder.add_node("plan_queries", plan_queries)
builder.add_node("execute_single_query", execute_single_query)
builder.add_node("aggregate_results", lambda s: {"final_answer": str(s["query_results"])})

builder.set_entry_point("plan_queries")
# fan_out 函数返回 Send 列表，LangGraph 会并行调度
builder.add_conditional_edges("plan_queries", fan_out, ["execute_single_query"])
builder.add_edge("execute_single_query", "aggregate_results")
builder.add_edge("aggregate_results", END)
```

---

## 流式输出

让 Agent 在节点运行过程中输出状态或更新，而不是等全部跑完才显示结果。下列 values/updates 示例不是模型内部思考过程，也不是逐 token 输出；完整状态可能包含敏感信息，展示前需筛选。

```python
# 同步流式
for chunk in data_analysis_agent.stream(
    {"messages": [HumanMessage(content="分析销售数据")]},
    stream_mode="values"  # 每次节点更新后输出完整 state
):
    # 打印最新消息
    if chunk.get("messages"):
        print(chunk["messages"][-1].content)

# 异步流式（适合 FastAPI / async 环境）
import asyncio

async def stream_analysis():
    async for chunk in data_analysis_agent.astream(
        {"messages": [HumanMessage(content="分析销售数据")]},
        stream_mode="updates"  # 只输出每次节点的增量变化
    ):
        node_name, update = list(chunk.items())[0]
        print(f"[{node_name}] 完成")

asyncio.run(stream_analysis())
```

在 FastAPI 中实现流式 API：

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()

@app.post("/analyze")
async def analyze_stream(question: str):
    async def generate():
        async for chunk in data_analysis_agent.astream(
            {"messages": [HumanMessage(content=question)]},
            stream_mode="values"
        ):
            if chunk.get("messages"):
                content = chunk["messages"][-1].content
                import json
                yield "data: " + json.dumps({"content": content}, ensure_ascii=False) + "\n\n"  # JSON 编码避免多行内容破坏 SSE 事件格式

    return StreamingResponse(generate(), media_type="text/event-stream")
```

---

## 常见问题

**Q：Graph 节点的执行顺序如何调试？**

```python
# 使用 stream_mode="debug" 可以看到每个节点的输入输出
for step in agent.stream(input_data, stream_mode="debug"):
    print(step)
```

**Q：State 字段很多，怎么管理？**

把不同关注点的字段分组，用多个 TypedDict 组合：

```python
class BaseState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]

class DataState(BaseState):
    query_results: list
    analysis_goal: str

class ReportState(DataState):
    final_report: str
```

**Q：如何限制 Agent 的最大执行步数？**

```python
agent = builder.compile()
result = agent.invoke(
    input_data,
    {"recursion_limit": 20}  # 最多 20 步，防止无限循环
)
```

---

## 相关文档

- [[【技术与工具】/AI-Agent框架/00-AI-Agent框架选型指南|AI Agent框架选型指南]] — 判断是否需要 LangGraph
- [[【技术与工具】/AI-Agent框架/02-CrewAI实战|CrewAI实战]] — 多角色协作的另一种思路
- [[【技术与工具】/AI-Agent框架/03-Agent工具开发规范|Agent工具开发规范]] — 如何写好节点中调用的工具
- [[【AI 与大数据】/03-AI-Agent/01-AI-Agent智能体概述|AI Agent智能体概述]] — Agent 概念基础
- [[【AI 与大数据】/03-AI-Agent/03-AI多Agent协作系统|AI多Agent协作系统]] — 多 Agent 协作理论

#LangGraph #AI-Agent #状态机 #工作流 #LangChain
