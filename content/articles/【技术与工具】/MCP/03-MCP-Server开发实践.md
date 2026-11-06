---
title: MCP Server 开发实践
tags:
  - MCP
  - Python
  - Server开发
  - 数据分析
  - 生产部署
  - Streamable-HTTP
  - MCP-Inspector
difficulty: 高级
duration: 120分钟
date: 2026-03-11
updated: 2026-10-10
status: maintenance
knowledge_type: technical-practice
last_verified: 2026-08-12
next_review: 2026-09-12
stability: fast-changing
applies_to:
  - MCP 2026-07-28
  - MCP Python SDK 2.0.0
  - MCP Inspector 2.1.0
source_level: primary
sources:
  - https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
  - https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
  - https://modelcontextprotocol.io/docs/2026-07-28/sdk
  - https://py.sdk.modelcontextprotocol.io/get-started/
  - https://py.sdk.modelcontextprotocol.io/run/
  - https://github.com/modelcontextprotocol/python-sdk/releases/tag/v2.0.0
  - https://github.com/modelcontextprotocol/go-sdk/releases/tag/v1.7.0
  - https://github.com/modelcontextprotocol/inspector/releases/tag/2.1.0
aliases:
  - MCP Server开发
  - 开发MCP Server
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据科学家
  - 具备 Python 服务开发基础的数据分析师
access_tier: free
created: 2026-03-11
---


# MCP Server 开发实践

> [!quote] 本篇定位
> 前两篇讲的是"理解"和"使用"。这篇讲"开发"。从项目结构到生产部署，从零写一个完整的数据分析助手 MCP Server。

> [!danger] 先看版本边界
> 本文的当前可运行主线锁定 MCP 2026-07-28、Python SDK 2.0.0 和 Inspector 2.1.0，同时给出 stdio、Streamable HTTP、内存测试与验收命令。后半部保留的 2025 时代 SDK 1.x 和 HTTP+SSE 代码是不可运行的 Legacy 审计样本，只用于识别迁移风险，不得作为新项目起点。

## 目录

- [[#开发框架选择|开发框架选择]]
- [[#当前实现基线与迁移门禁|当前实现基线与迁移门禁]]
- [[#当前可运行最小工程：Python SDK 2.0.0|当前可运行最小工程：Python SDK 2.0.0]]
- [[#Legacy 实战代码审计|旧版实战代码审计]]
- [[#Legacy：旧调试命令与占位测试|旧调试命令与占位测试]]
- [[#部署为远程 MCP Server|部署为远程 MCP Server]]
- [[#生产化清单|生产化清单]]

---

## 当前实现基线与迁移门禁

| 决策项 | 新项目基线 | Python SDK 2.0.0 实施边界 |
|---|---|---|
| 协议 | MCP 2026-07-28 | Server 默认同时接受 2025-era 请求，SDK 没有关闭 Legacy era 的开关 |
| Python SDK | 当前最小工程锁定 2.0.0 并提交锁文件 | 1.x 代码单独维护，不与 2.x 依赖混装 |
| 本地传输 | stdio | 凭据从环境获取，不走 HTTP 授权流程 |
| 远程传输 | Streamable HTTP 单端点 | 旧 HTTP+SSE 使用独立路由并设置下线日期 |
| 状态 | 2026-07-28 请求无协议会话，业务状态通过显式句柄传递 | 2025-era 请求仍可能创建旧协议会话，不能据此推断整个 SDK 进程无会话 |
| 上线门禁 | 协议兼容、安全、授权、超时、审计、限流测试全部通过 | 必须在“网关拒绝旧版本”和“显式运营双时代兼容”之间选择并验证 |

Python SDK 2.0.0 会按每个请求的协议版本在现代处理器和 Legacy 处理器之间路由；缺少版本头的旧初始化请求也会进入 Legacy 路径。这个行为没有 Server 级别的版本允许列表，也没有关闭 Legacy era 的配置项。因此，本文的远程 HTTP 服务若要“只支持 2026-07-28”，不能只靠创建一个新的 Server 对象来实现，必须由到达 SDK 之前的网关或 ASGI 中间件拒绝缺失版本头及非 2026-07-28 请求；stdio 同样不能靠 SDK 配置关闭旧时代，若有 current-only 要求，需要在 Host 启动边界隔离旧客户端，或增加可验证的前置协议过滤。若保留双时代兼容，则必须把旧会话、多 worker 路由和旧客户端回调能力纳入验收。

迁移时先冻结客户端清单，再用官方 SDK 的当前示例重建最小 Server，最后逐个迁移 Tools、Resources 和 Prompts。不要先改业务代码，再猜协议层为什么不兼容。

---

## 开发框架选择

MCP 官方提供了多语言 SDK，选哪个主要看你的技术栈。

| 维度 | Python SDK | TypeScript SDK | Go SDK |
|------|------------|----------------|----------------|
| 官方支持 | Tier 1 | Tier 1 | Tier 1 |
| 当前基线 | 2.0.0 | 实施日锁定具体版本 | 1.7.0 |
| 适合场景 | 数据工程、ML、脚本工具 | 前端应用、Node 生态 | 高性能服务 |
| 安装 | `uv add "mcp[cli]==2.0.0"` | `npm install @modelcontextprotocol/sdk` | `go get github.com/modelcontextprotocol/go-sdk/mcp@v1.7.0` |
| 异步支持 | asyncio 原生 | Promise/async-await | goroutine |
| 数据库生态 | 丰富（psycopg2、pymysql 等） | 一般 | 一般 |

<!-- Legacy 安装命令原句，仅用于保留 HEAD 审计信息，不对外展示：
| 安装 | `pip install mcp` | `npm install @modelcontextprotocol/sdk` | `go get github.com/...` |
-->

**决策条件**：当团队的数据库、数据处理和 ML 依赖主要在 Python 生态，且启动时间与单二进制分发不是硬约束时，选 Python；当现有服务是 Node 技术栈时选 TypeScript；当团队要求单二进制、强类型并发服务并已具备 Go 运维能力时选 Go。本篇用 Python 是因为它要与数据工具链衔接，不是对所有团队的通用结论。

---

## 当前可运行最小工程：Python SDK 2.0.0

这个工程有一个共享的 Server 定义、一个 Streamable HTTP 运行器和一个内存验收测试。stdio 由主文件的默认运行入口提供，HTTP 不复制 Tool 实现。

```text
mcp-minimal/
├── pyproject.toml
├── server.py
├── server_http.py
└── test_server.py
```

### 1. 锁定依赖

`pyproject.toml`：

```toml
[project]
name = "mcp-minimal"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = ["mcp[cli]==2.0.0"]

[dependency-groups]
dev = ["pytest==8.4.2"]
```

执行 `uv sync`，并将生成的 `uv.lock` 纳入版本库。锁定文件是可复现边界；只在文档中写“2.x”不足以重建同一环境。

### 2. 共享 Server 与 stdio 入口

`server.py`：

```python
from mcp.server import MCPServer

mcp = MCPServer("data-analyst-demo")


@mcp.tool()
def add(a: int, b: int) -> int:
    """Return the sum of two integers."""
    return a + b


@mcp.resource("greeting://{name}")
def greeting(name: str) -> str:
    """Return a greeting for the supplied name."""
    return f"Hello, {name}!"


@mcp.prompt()
def summarize(text: str) -> str:
    """Build a one-sentence summarization prompt."""
    return f"Summarize the following text in one sentence:\n\n{text}"


if __name__ == "__main__":
    mcp.run()
```

直接启动 stdio Server：

```bash
uv run python server.py
```

该进程会等待 Host 通过标准输入输出交互，没有 HTTP 端口。stdio 的 stdout 是协议线，业务日志应写 stderr，不要在启动前或运行期间向 stdout 输出普通文本。

### 3. Streamable HTTP 入口

`server_http.py`：

```python
from server import mcp


if __name__ == "__main__":
    mcp.run(
        transport="streamable-http",
        host="127.0.0.1",
        port=3001,
        streamable_http_path="/mcp",
    )
```

启动后，客户端连接 `http://127.0.0.1:3001/mcp`：

```bash
uv run python server_http.py
```

> [!warning] 这是本地协议验证入口
> 不要把监听地址直接改成公网网卡后就上线。远程部署还必须完成 Origin/Host 校验、MCP HTTP 授权、TLS、限流、超时和审计；多进程部署应把 `mcp.streamable_http_app()` 交给已有 ASGI 运行器，不应在协议 Server 里自行造 worker 管理器。

> [!important] 多 worker 之前先处理 Legacy 路径
> 把应用交给 ASGI 运行器只解决进程托管，不会把 SDK 的 Legacy 会话变成分布式会话。默认配置下，2025-era 客户端初始化后获得的会话记录只存在于创建它的 worker 内存中；后续请求落到其他 worker 会返回“Session not found”。保留这种兼容方式时，负载均衡必须按旧会话做 sticky routing。

多 worker 发布有三种可验证策略：

| 策略 | 实施方式 | 必须接受的边界 |
|---|---|---|
| 仅支持 2026-07-28 | 在进入 SDK 前拒绝缺失版本头和所有非 2026-07-28 请求 | 不能把 SDK 默认行为误当作版本拒绝策略；需用旧初始化请求做反向测试 |
| 双时代、保留 Legacy 回调 | 保持默认的会话型 Legacy 路径，并按旧会话 sticky routing | worker 扩缩容、滚动发布和故障切换都要保持会话亲和性 |
| 双时代、Legacy 无状态 | 构建 HTTP 应用时设置 `stateless_http=True` | 该选项只影响 Legacy 路径；旧客户端的服务端回调会失败，旧路径通知会被丢弃，必须先确认业务不依赖这些能力 |

2026-07-28 路径在上述三种策略下都保持无协议会话；这里的 sticky routing 与回调限制只来自 SDK 同时提供的 2025-era 兼容路径。

### 4. 内存验收测试

`test_server.py`：

```python
import pytest
from mcp import Client

from server import mcp


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.anyio
async def test_add_on_current_protocol() -> None:
    async with Client(mcp, raise_exceptions=True) as client:
        assert client.protocol_version == "2026-07-28"
        result = await client.call_tool("add", {"a": 1, "b": 2})

    assert result.is_error is False
    assert result.structured_content == {"result": 3}
```

执行：

```bash
uv run pytest -q
```

预期至少有一个测试通过，并且断言同时覆盖协议版本、Tool 调用和结构化结果。这比“进程能启动”更接近可发布门禁，但它只证明现代路径能够工作。仅支持 2026-07-28 的部署还必须从网关外侧发送缺失版本头和旧初始化请求，确认它们在进入 SDK 前被拒绝；保留双时代兼容的部署则要分别测试现代请求、Legacy 初始化、后续会话路由，以及所选无状态策略对旧回调和通知的影响。

### 5. 用 Inspector 2.1.0 手工验收

官方 Python SDK 的快捷命令是 `uv run mcp dev server.py`，但该命令会调用当时 npm 上的 Inspector。需要重现本文验收环境时，直接锁定 Inspector 2.1.0：

```bash
npx -y @modelcontextprotocol/inspector@2.1.0 uv run mcp run server.py
```

Inspector 2.1.0 的 Web 界面默认端口是 6274。它会在启动输出中打印包含本次访问令牌的 URL，应打开该完整 URL，不要仅凭端口手工拼接地址。

验收 Streamable HTTP 时，先在一个终端启动 `server_http.py`，再在另一个终端运行：

```bash
npx -y @modelcontextprotocol/inspector@2.1.0 \
  --server-url http://127.0.0.1:3001/mcp \
  --transport http
```

在 Server Settings 将 Protocol Era 设为 Modern 后重连，然后按下表验收：

| 验收项 | 操作 | 通过标准 |
|---|---|---|
| 协议版本 | 查看连接信息和 Network | 使用 2026-07-28；无旧 initialize 依赖 |
| 能力发现 | 查看 Tools、Resources、Prompts | `add`、`greeting://{name}`、`summarize` 可被发现 |
| Tool 成功路径 | 调用 `add` | 输入 `1` 和 `2` 后结构化结果为 `3` |
| Tool 校验路径 | 给 `a` 传入字符串 | 返回参数校验错误，Tool 函数不执行 |
| HTTP 头 | 查看 Network 请求 | 版本、方法与名称头和正文一致 |

不需要图形界面时，可以用 Inspector CLI 完成同一条 stdio 链路的可机读验收：

```bash
npx -y @modelcontextprotocol/inspector@2.1.0 \
  --cli uv run mcp run server.py -- \
  --method tools/list --format json

npx -y @modelcontextprotocol/inspector@2.1.0 \
  --cli uv run mcp run server.py -- \
  --method tools/call --tool-name add \
  --tool-arg a=1 --tool-arg b=2 --format json
```

第一条命令的输出应只包含 `add`；第二条命令应返回 `structuredContent.result = 3` 且 `isError = false`。CLI 中裸的 `--` 是分隔服务端启动命令和 Inspector 选项的必要边界，不要随意删除或调换两侧参数。

> [!important] 当前验收结论的边界
> 上述测试证明“最小协议链路可工作”，不证明数据库 Tool、授权服务器或生产部署已通过安全验收。业务 Tool 必须在同样的协议测试之上，再增加权限、资源上限、幂等、审计与故障注入测试。

---

## Legacy 实战代码审计

> [!danger] 下方所有旧代码均不可运行
> 从旧 `pyproject.toml` 到 HTTP+SSE 和 Docker 片段，都只是迁移审计样本。它们已知包含 SDK 入口错配、将 psycopg2 占位符写成 `$1`、用字符串关键词过滤代替数据库权限、SSE 片段缺少 `os` 导入，以及容器构建与包目录布局不一致等问题。不要修补其中某一行后就将整段视为可用实现；应将业务需求迁移到上方 2.0.0 主线。

> [!warning] 下方依赖声明是 Legacy 快照
> 原项目结构中的宽松依赖会在今天解析到不同主版本，而后续代码仍使用 1.x API。不要原样安装；应先选择 1.x 维护分支或 2.x 迁移目标，再锁定具体版本和完整依赖。

---

## Legacy：旧项目结构

一个规范的 MCP Server 项目长这样：

| 路径 | 说明 |
|------|------|
| `data-analyst-mcp/` | 项目根目录 |
| `src/data_analyst_mcp/__init__.py` | 包初始化 |
| `src/data_analyst_mcp/server.py` | 主入口，Server 初始化 |
| `src/data_analyst_mcp/tools/__init__.py` | Tools 包初始化 |
| `src/data_analyst_mcp/tools/sql_tools.py` | SQL 相关 Tools |
| `src/data_analyst_mcp/tools/stats_tools.py` | 统计分析 Tools |
| `src/data_analyst_mcp/tools/chart_tools.py` | 图表数据 Tools |
| `src/data_analyst_mcp/resources/__init__.py` | Resources 包初始化 |
| `src/data_analyst_mcp/resources/schema_resources.py` | Resources 实现 |
| `src/data_analyst_mcp/prompts/__init__.py` | Prompts 包初始化 |
| `src/data_analyst_mcp/prompts/analysis_prompts.py` | Prompts 定义 |
| `src/data_analyst_mcp/db/__init__.py` | 数据库模块初始化 |
| `src/data_analyst_mcp/db/connection.py` | 数据库连接管理 |
| `tests/test_tools.py` | Tools 测试 |
| `tests/test_resources.py` | Resources 测试 |
| `pyproject.toml` | 项目配置 |
| `README.md` | 说明文档 |

`pyproject.toml`：

```toml
[project]
name = "data-analyst-mcp"
version = "1.0.0"
description = "数据分析助手 MCP Server"
requires-python = ">=3.10"
dependencies = [
    "mcp>=1.0.0",
    "psycopg2-binary>=2.9.0",
    "pandas>=2.0.0",
    "httpx>=0.24.0",
    "python-dotenv>=1.0.0",
]

[project.scripts]
data-analyst-mcp = "data_analyst_mcp.server:main"
```

---

## Legacy：五步低层 API 审计

> [!warning] 本节代码使用旧 SDK API
> 五步方法仍可复用，但装饰器签名、初始化流程和运行入口必须以官方 Python SDK 2.x 文档为准。尤其不要在当前协议实现中照搬 InitializationOptions 与 initialize 握手。

### 步骤一：初始化 Server

```python
from mcp.server import Server
from mcp.server.models import InitializationOptions

# Server 名称会显示在 MCP Host 的连接信息里，取个有意义的名字
server = Server("data-analyst-mcp")
```

### 步骤二：注册 Tools

Tools 用两个装饰器实现：`list_tools` 声明工具元数据，`call_tool` 处理实际调用。

```python
from mcp import types
from mcp.types import Tool, TextContent

# 声明工具列表（AI 用这个来决定调用哪个工具）
@server.list_tools()
async def handle_list_tools() -> list[Tool]:
    return [
        Tool(
            name="run_sql",
            description="执行 SQL 查询并返回结果。",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "SQL 查询语句"},
                    "db": {"type": "string", "description": "数据库名称", "default": "default"}
                },
                "required": ["query"]
            }
        )
    ]

# 处理工具调用
@server.call_tool()
async def handle_call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "run_sql":
        # 实现逻辑
        ...
    raise ValueError(f"未知 Tool：{name}")
```

> [!important] Tool 描述是关键
> `description` 字段直接影响 AI 是否会选择调用这个工具，以及如何正确使用它。写得越清晰，AI 调用越准确。要说明：这个工具做什么、输入什么、返回什么、有什么限制。

### 步骤三：注册 Resources

Resources 也用两个装饰器：`list_resources` 声明资源列表，`read_resource` 返回资源内容。

```python
from mcp.types import Resource

@server.list_resources()
async def handle_list_resources() -> list[Resource]:
    return [
        Resource(
            uri="schema://all",
            name="完整数据库 Schema",
            description="所有表的结构信息",
            mimeType="application/json"
        )
    ]

@server.read_resource()
async def handle_read_resource(uri: str) -> str:
    if uri == "schema://all":
        return await get_full_schema()
    raise ValueError(f"未知资源 URI：{uri}")
```

### 步骤四：注册 Prompts

```python
from mcp.types import Prompt, PromptArgument, PromptMessage, GetPromptResult

@server.list_prompts()
async def handle_list_prompts() -> list[Prompt]:
    return [
        Prompt(
            name="analyze_table",
            description="对指定数据表进行全面分析，包括统计特征、数据质量、业务洞察",
            arguments=[
                PromptArgument(
                    name="table_name",
                    description="要分析的表名",
                    required=True
                ),
                PromptArgument(
                    name="focus",
                    description="分析重点：quality（数据质量）/ stats（统计分析）/ business（业务洞察）",
                    required=False
                )
            ]
        )
    ]

@server.get_prompt()
async def handle_get_prompt(name: str, arguments: dict) -> GetPromptResult:
    if name == "analyze_table":
        table_name = arguments.get("table_name", "")
        focus = arguments.get("focus", "全面分析")

        return GetPromptResult(
            description=f"分析表 {table_name}",
            messages=[
                PromptMessage(
                    role="user",
                    content=types.TextContent(
                        type="text",
                        text=(
                            f"请对数据表 `{table_name}` 进行{focus}。\n\n"
                            f"分析步骤：\n"
                            f"1. 用 get_table_stats 工具获取表的基本统计信息\n"
                            f"2. 用 run_sql 抽样查看前 10 行数据\n"
                            f"3. 用 run_sql 检查关键字段的空值率\n"
                            f"4. 基于以上信息，给出：\n"
                            f"   - 数据质量评估（0-10 分）\n"
                            f"   - 关键数据特征\n"
                            f"   - 潜在的数据问题\n"
                            f"   - 使用建议"
                        )
                    )
                )
            ]
        )
    raise ValueError(f"未知 Prompt：{name}")
```

### 步骤五：选择传输层并启动

**stdio 传输（本地使用）**：

```python
import asyncio
from mcp.server.stdio import stdio_server

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="data-analyst-mcp",
                server_version="1.0.0",
                capabilities=server.get_capabilities(
                    notification_options=None,
                    experimental_capabilities={}
                )
            )
        )

if __name__ == "__main__":
    asyncio.run(main())
```

---

## Legacy：完整数据分析助手审计样本

把所有部分组合起来，一个完整的数据分析助手 MCP Server。

> [!danger] Legacy 完整示例
> 下方完整项目用于阅读 1.x 的业务组织方式，它既没有完成 2.x API 迁移，也存在 SQL 占位符、标识符拼接、关键词过滤、异常暴露和连接释放等已知缺陷。复用时只提取业务需求与测试思想，不复制任何运行入口或数据库执行逻辑。

```python
# server.py - 完整实现
import asyncio
import os
import json
import psycopg2
import psycopg2.extras
from datetime import datetime
from typing import Any
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp import types
from mcp.types import (
    Tool, Resource, Prompt, PromptArgument, PromptMessage,
    TextContent, GetPromptResult
)

# ============================================================
# 配置与连接
# ============================================================

DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "localhost"),
    "port": int(os.environ.get("DB_PORT", "5432")),
    "database": os.environ.get("DB_NAME", "analytics"),
    "user": os.environ.get("DB_USER", "readonly"),
    "password": os.environ.get("DB_PASSWORD", ""),
}

server = Server("data-analyst-mcp")


def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)


# ============================================================
# Tools
# ============================================================

@server.list_tools()
async def handle_list_tools() -> list[Tool]:
    return [
        Tool(
            name="run_sql",
            description=(
                "在数据库中执行 SQL SELECT 查询，返回结构化结果。\n"
                "支持多数据库（通过 db 参数指定）。\n"
                "结果以 Markdown 表格格式返回，最多 200 行。\n"
                "不允许任何 DDL 或 DML 操作。"
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "SQL SELECT 查询语句"
                    },
                    "db": {
                        "type": "string",
                        "description": "数据库名称（默认使用配置的主数据库）"
                    }
                },
                "required": ["query"]
            }
        ),
        Tool(
            name="get_table_stats",
            description=(
                "获取指定数据表的统计信息：\n"
                "- 总行数\n"
                "- 表大小（磁盘占用）\n"
                "- 最近更新时间\n"
                "- 各列的空值率"
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "table": {
                        "type": "string",
                        "description": "表名，格式 schema.table 或直接 table"
                    }
                },
                "required": ["table"]
            }
        ),
        Tool(
            name="generate_chart_data",
            description=(
                "执行 SQL 查询并将结果格式化为图表数据（JSON 格式）。\n"
                "适合需要可视化的场景（柱状图、折线图、饼图等）。\n"
                "返回标准的图表数据结构，前端可直接传给 ECharts 或 Chart.js。"
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "SQL 查询，第一列为 X 轴标签，其余列为数据系列"
                    },
                    "chart_type": {
                        "type": "string",
                        "enum": ["bar", "line", "pie", "scatter"],
                        "description": "图表类型",
                        "default": "bar"
                    },
                    "title": {
                        "type": "string",
                        "description": "图表标题"
                    }
                },
                "required": ["query"]
            }
        )
    ]


@server.call_tool()
async def handle_call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "run_sql":
        return await run_sql(arguments)
    elif name == "get_table_stats":
        return await get_table_stats(arguments)
    elif name == "generate_chart_data":
        return await generate_chart_data(arguments)
    raise ValueError(f"未知 Tool：{name}")


async def run_sql(arguments: dict) -> list[TextContent]:
    query = arguments["query"].strip()

    # 安全检查
    forbidden = ["INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER",
                 "TRUNCATE", "GRANT", "REVOKE", "EXECUTE", "EXEC"]
    query_upper = query.upper()
    for kw in forbidden:
        if kw in query_upper:
            return [TextContent(type="text",
                text=f"安全拦截：不允许 {kw} 操作。")]

    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # 强制设置超时和行限制
        cursor.execute("SET statement_timeout = '30s'")
        if "LIMIT" not in query_upper:
            query = f"SELECT * FROM ({query}) _q LIMIT 200"

        cursor.execute(query)
        rows = cursor.fetchall()
        conn.close()

        if not rows:
            return [TextContent(type="text", text="查询成功，结果为空（0 行）。")]

        # 输出 Markdown 表格
        columns = list(rows[0].keys())
        lines = []
        lines.append("| " + " | ".join(columns) + " |")
        lines.append("|" + " :--- |" * len(columns))
        for row in rows:
            vals = []
            for col in columns:
                v = row[col]
                if v is None:
                    vals.append("NULL")
                elif isinstance(v, (dict, list)):
                    vals.append(json.dumps(v, ensure_ascii=False)[:100])
                else:
                    vals.append(str(v)[:200])  # 单格最多 200 字符
            lines.append("| " + " | ".join(vals) + " |")

        result_text = f"查询返回 **{len(rows)}** 行结果：\n\n" + "\n".join(lines)
        return [TextContent(type="text", text=result_text)]

    except Exception as e:
        return [TextContent(type="text", text=f"查询失败：{type(e).__name__}: {str(e)}")]


async def get_table_stats(arguments: dict) -> list[TextContent]:
    table = arguments["table"]

    # 处理 schema.table 格式
    if "." in table:
        schema, table_name = table.split(".", 1)
    else:
        schema, table_name = "public", table

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 行数
        cursor.execute(f'SELECT COUNT(*) FROM "{schema}"."{table_name}"')
        row_count = cursor.fetchone()[0]

        # 表大小
        cursor.execute(
            "SELECT pg_size_pretty(pg_total_relation_size($1))",
            [f"{schema}.{table_name}"]
        )
        table_size = cursor.fetchone()[0]

        # 最近更新时间（通过 VACUUM 统计）
        cursor.execute("""
            SELECT last_vacuum, last_autovacuum, last_analyze, last_autoanalyze
            FROM pg_stat_user_tables
            WHERE schemaname = %s AND relname = %s
        """, [schema, table_name])
        stats_row = cursor.fetchone()

        # 列信息和空值率（抽样计算，避免全表扫描）
        cursor.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
        """, [schema, table_name])
        columns = cursor.fetchall()

        # 计算前 10 列的空值率
        null_rates = []
        sample_size = min(10000, row_count) if row_count > 0 else 0

        if sample_size > 0:
            for col_name, col_type in columns[:10]:
                cursor.execute(f"""
                    SELECT
                        COUNT(*) FILTER (WHERE "{col_name}" IS NULL) * 100.0 / COUNT(*)
                    FROM (
                        SELECT "{col_name}"
                        FROM "{schema}"."{table_name}"
                        LIMIT {sample_size}
                    ) sample
                """)
                null_rate = cursor.fetchone()[0]
                null_rates.append((col_name, col_type, float(null_rate)))

        conn.close()

        # 格式化输出
        lines = [f"## 表统计信息：`{schema}.{table_name}`\n"]
        lines.append(f"- **总行数**：{row_count:,}")
        lines.append(f"- **磁盘大小**：{table_size}")

        if stats_row:
            last_update = stats_row[1] or stats_row[0] or "未知"
            lines.append(f"- **最近维护时间**：{last_update}")

        if null_rates:
            lines.append(f"\n**字段空值率**（基于 {sample_size:,} 行样本）：\n")
            lines.append("| 字段名 | 类型 | 空值率 | 质量 |")
            lines.append("|--------|------|--------|------|")
            for col_name, col_type, null_rate in null_rates:
                quality = "优" if null_rate < 1 else ("良" if null_rate < 5 else ("差" if null_rate > 20 else "中"))
                lines.append(f"| {col_name} | {col_type} | {null_rate:.1f}% | {quality} |")

            if len(columns) > 10:
                lines.append(f"\n（共 {len(columns)} 列，仅展示前 10 列空值率）")

        return [TextContent(type="text", text="\n".join(lines))]

    except Exception as e:
        return [TextContent(type="text", text=f"获取统计信息失败：{str(e)}")]


async def generate_chart_data(arguments: dict) -> list[TextContent]:
    query = arguments["query"].strip()
    chart_type = arguments.get("chart_type", "bar")
    title = arguments.get("title", "数据图表")

    query_upper = query.upper()
    if not (query_upper.startswith("SELECT") or query_upper.startswith("WITH")):
        return [TextContent(type="text", text="错误：只支持 SELECT 查询。")]

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(query)
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        conn.close()

        if not rows:
            return [TextContent(type="text", text="查询结果为空，无法生成图表数据。")]

        # 构建标准图表数据格式（兼容 ECharts）
        labels = [str(row[0]) for row in rows]

        if len(columns) == 1:
            # 单列：做频率统计
            chart_data = {
                "title": title,
                "type": chart_type,
                "labels": labels,
                "datasets": [{
                    "name": columns[0],
                    "data": labels
                }]
            }
        else:
            # 多列：第一列为标签，其余列为数据系列
            datasets = []
            for i, col in enumerate(columns[1:], 1):
                data = []
                for row in rows:
                    v = row[i]
                    data.append(float(v) if v is not None else 0)
                datasets.append({"name": col, "data": data})

            chart_data = {
                "title": title,
                "type": chart_type,
                "labels": labels,
                "datasets": datasets
            }

        chart_json = json.dumps(chart_data, ensure_ascii=False, indent=2)
        return [TextContent(
            type="text",
            text=f"图表数据生成成功（{len(rows)} 个数据点）：\n\n```json\n{chart_json}\n```"
        )]

    except Exception as e:
        return [TextContent(type="text", text=f"生成图表数据失败：{str(e)}")]


# ============================================================
# Resources
# ============================================================

@server.list_resources()
async def handle_list_resources() -> list[Resource]:
    return [
        Resource(
            uri="schema://all",
            name="完整数据库 Schema",
            description="所有数据表的结构定义，包括字段名、类型、注释",
            mimeType="application/json"
        )
    ]


@server.read_resource()
async def handle_read_resource(uri: str) -> str:
    if uri == "schema://all":
        return await get_full_schema()
    raise ValueError(f"未知资源：{uri}")


async def get_full_schema() -> str:
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("""
            SELECT
                c.table_schema,
                c.table_name,
                c.column_name,
                c.data_type,
                c.is_nullable,
                pg_catalog.col_description(
                    (c.table_schema || '.' || c.table_name)::regclass,
                    c.ordinal_position
                ) as column_comment
            FROM information_schema.columns c
            JOIN information_schema.tables t
                ON c.table_name = t.table_name
                AND c.table_schema = t.table_schema
            WHERE c.table_schema NOT IN ('information_schema', 'pg_catalog')
                AND t.table_type = 'BASE TABLE'
            ORDER BY c.table_schema, c.table_name, c.ordinal_position
        """)
        rows = cursor.fetchall()
        conn.close()

        schema = {}
        for row in rows:
            key = f"{row['table_schema']}.{row['table_name']}"
            if key not in schema:
                schema[key] = []
            schema[key].append({
                "column": row["column_name"],
                "type": row["data_type"],
                "nullable": row["is_nullable"] == "YES",
                "comment": row["column_comment"]
            })

        return json.dumps(schema, ensure_ascii=False, indent=2)

    except Exception as e:
        return json.dumps({"error": str(e)})


# ============================================================
# Prompts
# ============================================================

@server.list_prompts()
async def handle_list_prompts() -> list[Prompt]:
    return [
        Prompt(
            name="analyze_table",
            description="对指定数据表进行全面分析，输出数据质量报告和业务洞察",
            arguments=[
                PromptArgument(
                    name="table_name",
                    description="要分析的表名（格式：schema.table 或 table）",
                    required=True
                ),
                PromptArgument(
                    name="business_context",
                    description="业务背景说明，帮助 AI 提供更有针对性的洞察（可选）",
                    required=False
                )
            ]
        )
    ]


@server.get_prompt()
async def handle_get_prompt(name: str, arguments: dict) -> GetPromptResult:
    if name != "analyze_table":
        raise ValueError(f"未知 Prompt：{name}")

    table_name = arguments.get("table_name", "")
    business_context = arguments.get("business_context", "")

    context_text = f"\n\n业务背景：{business_context}" if business_context else ""

    return GetPromptResult(
        description=f"分析数据表 {table_name}",
        messages=[
            PromptMessage(
                role="user",
                content=types.TextContent(
                    type="text",
                    text=(
                        f"请对数据表 `{table_name}` 进行全面分析。{context_text}\n\n"
                        f"**分析步骤**（请按顺序执行）：\n\n"
                        f"1. **基础统计**：调用 `get_table_stats` 工具获取行数、大小、空值率\n"
                        f"2. **数据采样**：执行 `SELECT * FROM {table_name} LIMIT 20` 查看样本\n"
                        f"3. **字段分布**：对关键字段做 GROUP BY 统计，了解数据分布\n"
                        f"4. **时间趋势**：如果有时间字段，分析最近 30 天的数据趋势\n\n"
                        f"**输出报告结构**：\n"
                        f"- 数据概览（行数、时间范围、数据完整性）\n"
                        f"- 质量评分（0-10 分，附评分理由）\n"
                        f"- 关键发现（数据特征、异常值、业务规律）\n"
                        f"- 使用建议（适合什么分析场景，有什么注意事项）"
                    )
                )
            )
        ]
    )


# ============================================================
# 启动入口
# ============================================================

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="data-analyst-mcp",
                server_version="1.0.0",
                capabilities=server.get_capabilities(
                    notification_options=None,
                    experimental_capabilities={}
                )
            )
        )


def cli_main():
    asyncio.run(main())


if __name__ == "__main__":
    cli_main()
```

---

## Legacy：旧调试命令与占位测试

### Legacy Inspector 命令快照

> [!danger] 下方命令与端口不属于当前验收基线
> 当前命令、Inspector 版本、默认端口和验收步骤已在本文前面给出。下方只保留旧教程快照，不要执行。

MCP Inspector 是官方提供的交互式调试工具，但其命令行和 Web 架构已经变更。

```bash
# 安装
npm install -g @modelcontextprotocol/inspector

# 启动调试（连接到你的 Python Server）
mcp-inspector python /path/to/server.py
```

旧版曾要求打开 `http://localhost:5173`；Inspector 2.1.0 的默认 Web 端口是 6274，并且应使用启动输出中带访问令牌的完整 URL。当前图形界面可以：
- 查看 Server 暴露的所有 Tools、Resources、Prompts
- 直接调用 Tools，查看原始 JSON-RPC 请求和响应
- 测试 Resources 读取

这是开发阶段最高效的调试方式。

### Legacy 单元测试占位符

> [!warning] 下方代码不是有效测试集
> 其中两个测试以 `pass` 结束，另一个只验证已知不充分的关键词过滤。当前最小验收以前文的 SDK 2.0.0 内存 Client 测试为准。

```python
# tests/test_tools.py
import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

# 测试 run_sql 的安全检查
@pytest.mark.asyncio
async def test_sql_injection_prevention():
    """确保危险操作被拦截"""
    from server import run_sql

    dangerous_queries = [
        {"query": "DROP TABLE users"},
        {"query": "DELETE FROM orders"},
        {"query": "INSERT INTO logs VALUES (1, 'hack')"},
    ]

    for args in dangerous_queries:
        result = await run_sql(args)
        assert "安全拦截" in result[0].text, f"未拦截危险查询：{args['query']}"


@pytest.mark.asyncio
async def test_run_sql_normal():
    """正常 SELECT 查询测试"""
    from server import run_sql

    # Mock 数据库连接
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = [
        {"id": 1, "name": "test", "count": 100}
    ]
    mock_cursor.description = [("id",), ("name",), ("count",)]

    with patch("server.get_db_connection") as mock_conn:
        mock_conn.return_value.__enter__ = MagicMock()
        # 简化测试，实际需要完整 mock psycopg2 连接
        pass


@pytest.mark.asyncio
async def test_get_table_stats_format():
    """测试统计信息的输出格式"""
    # 使用测试数据库验证输出格式
    pass
```

### Legacy Host 手工验收快照

配置完 `claude_desktop_config.json` 后，重启 Claude Desktop，然后：

1. 开始一个新对话
2. 点击工具栏的"工具"图标，确认 MCP Server 已连接
3. 发送测试消息：`帮我查看一下 orders 表有多少行数据`
4. 观察 Claude 是否调用了对应的 Tool

如果 Server 启动失败，Claude Desktop 的开发者工具（`Cmd + Option + I`）里能看到错误信息。

---

## 部署为远程 MCP Server

stdio 适合由 Host 启动的本地进程。团队共享或云端部署应使用 Streamable HTTP：单一 MCP 端点接收 HTTP POST，响应可以是 JSON 或与当前请求绑定的 SSE 流。不要为新项目采用旧 HTTP+SSE 双端点结构。

### Legacy：FastAPI + HTTP+SSE 实现

> [!danger] 仅用于维护旧客户端
> 下方实现使用独立 SSE 连接端点与消息 POST 端点，属于已弃用的 HTTP+SSE 传输。它还缺少所用模块的导入，使用不适用于生产的静态 Bearer Token 模型，且不能替代 MCP 的 HTTP 授权规范。它是不可运行的审计样本；新服务应从本文前面锁定的 Python SDK 2.0.0 Streamable HTTP 实现起步。

```python
# sse_server.py
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from mcp.server.sse import SseServerTransport
from starlette.routing import Mount

# 复用之前定义的 server 对象（包含所有 Tools/Resources/Prompts）
from server import server

# Bearer Token 认证
VALID_TOKENS = set(os.environ.get("MCP_TOKENS", "dev-token-123").split(","))
security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials.credentials not in VALID_TOKENS:
        raise HTTPException(status_code=403, detail="Invalid token")
    return credentials.credentials


# SSE 传输层
sse_transport = SseServerTransport("/messages/")


# FastAPI 应用
app = FastAPI(title="Data Analyst MCP Server")


@app.get("/sse", dependencies=[Depends(verify_token)])
async def sse_endpoint(request: Request):
    """SSE 连接端点"""
    async with sse_transport.connect_sse(
        request.scope,
        request.receive,
        request._send
    ) as streams:
        await server.run(
            streams[0],
            streams[1],
            server.create_initialization_options()
        )


@app.post("/messages/")
async def handle_messages(request: Request):
    """处理 MCP 消息"""
    await sse_transport.handle_post_message(
        request.scope,
        request.receive,
        request._send
    )


@app.get("/health")
async def health():
    return {"status": "ok", "server": "data-analyst-mcp"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
```

### Legacy 示例的 Docker 化

> [!warning] 容器化不会自动完成协议迁移
> 下方镜像仍启动旧 SSE 应用，并且在复制包源码前尝试安装当前项目，与前文的 `src` 布局无法构成可重建镜像。它是不可构建的审计样本；不要通过调换一条 COPY 就声称整个 Legacy 部署已经可用。

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY pyproject.toml .
RUN pip install --no-cache-dir .

# 复制代码
COPY src/ src/

# 暴露端口
EXPOSE 8080

# 启动 SSE 模式
CMD ["python", "-m", "uvicorn", "src.data_analyst_mcp.sse_server:app",
     "--host", "0.0.0.0", "--port", "8080"]
```

```yaml
# docker-compose.yml
version: "3.8"
services:
  mcp-server:
    build: .
    ports:
      - "8080:8080"
    environment:
      - DB_HOST=postgres
      - DB_NAME=data_warehouse
      - DB_USER=readonly
      - DB_PASSWORD=${DB_PASSWORD}
      - MCP_TOKENS=${MCP_TOKENS}
    depends_on:
      - postgres

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=data_warehouse
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - pg_data:/var/lib/postgresql/data

volumes:
  pg_data:
```

### Legacy：远程 SSE 客户端配置

> [!warning] 客户端配置也受版本约束
> 下方路径只适用于仍支持旧 HTTP+SSE 的客户端。当前客户端的远程配置键名和认证方式必须在接入当天查阅其官方文档，不能仅凭本例推断。

```json
{
  "mcpServers": {
    "remote-data-analyst": {
      "url": "https://mcp.your-company.com/sse",
      "headers": {
        "Authorization": "Bearer your-token-here"
      }
    }
  }
}
```

---

## 生产化清单

> [!tip] 上线前检查
> 把这个清单过一遍，避免线上出问题。

**安全性**
- [ ] 数据库用户只有 SELECT 权限
- [ ] SQL 只读由数据库权限、只读事务和允许列表共同保证，关键词过滤只作为补充
- [ ] 查询超时设置（`statement_timeout`）
- [ ] 结果行数限制（防止返回几百万行）
- [ ] Streamable HTTP 按 MCP 授权规范实现认证授权；没有用示例静态 Token 代替身份系统
- [ ] 密码通过环境变量注入，不在代码中硬编码

**协议兼容性**
- [ ] 明确声明并测试支持的 MCP 协议版本与 SDK 版本
- [ ] 仅支持 2026-07-28 时，网关已拒绝缺失版本头与旧版本请求，并有旧初始化反向测试证据
- [ ] 接受 2025-era 客户端时，多 worker 已选择并验证 sticky routing，或明确启用 Legacy 无状态模式并接受回调与通知能力损失
- [ ] 新远程服务只暴露 Streamable HTTP MCP 端点
- [ ] 如需旧 HTTP+SSE，已隔离路由、记录调用方并设置下线日期
- [ ] 网络中断、请求重试和重复调用不会造成非幂等副作用

**可靠性**
- [ ] 可预期的业务错误转换为可识别的 Tool 错误；非预期异常不泄露内部细节，也不吞掉取消信号
- [ ] 数据库连接有连接池（不是每次调用都新建连接）
- [ ] 有健康检查端点（`/health`）

**可观测性**
- [ ] stdio 模式不向 stdout 写日志；远程模式使用结构化日志与链路标识
- [ ] 记录每次 Tool 调用的耗时
- [ ] 数据库查询有慢查询日志

**性能**
- [ ] Schema 信息做缓存（不是每次都查 `information_schema`）
- [ ] 大结果集做分页而不是一次全返回
- [ ] 数据库连接复用（连接池）

---

## 官方资料与复核范围

- [MCP 2026-07-28 Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP 2026-07-28 HTTP 授权规范](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [MCP 版本与兼容性](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
- [MCP 官方 SDK 分级](https://modelcontextprotocol.io/docs/2026-07-28/sdk)
- [Python SDK 2.0 入门与完整示例](https://py.sdk.modelcontextprotocol.io/get-started/)
- [Python SDK 2.0 运行与传输](https://py.sdk.modelcontextprotocol.io/run/)
- [官方 Python SDK 与示例](https://github.com/modelcontextprotocol/python-sdk)
- [官方 Python SDK 2.0.0 发布记录](https://github.com/modelcontextprotocol/python-sdk/releases/tag/v2.0.0)
- [官方 Go SDK 1.7.0](https://github.com/modelcontextprotocol/go-sdk/releases/tag/v1.7.0)
- [官方 Inspector 2.1.0](https://github.com/modelcontextprotocol/inspector/releases/tag/2.1.0)

本次可复现范围是：Python SDK 2.0.0 的 stdio 与本地 Streamable HTTP 运行入口、SDK 内存 Client 测试，以及 Inspector 2.1.0 的调试命令与验收点。原有 1.x 代码仍是不可运行的 Legacy 审计样本；其存在意义是帮助用户识别不应复制的迁移路径，不是为旧实现提供发布许可。

---

## 系列导航

- 上一篇：[[【技术与工具】/MCP/02-数据工具MCP集成实战|数据工具MCP集成实战]]
- 返回导航：[[【技术与工具】/MCP/00-MCP学习路线图|MCP学习路线图]]
- 协议基础：[[【技术与工具】/MCP/01-MCP协议核心概念|MCP协议核心概念]]
- 生产网关：[[【技术与工具】/MCP/04-MCP-Gateway与生产部署|MCP Gateway 与生产部署]]
- 服务网关：[[【数据开发与数据架构】/07-数据服务架构/05-数据服务网关|数据服务网关]]
- 权限审计：[[【数据治理与数据管理】/02-深度研究/05-AI数据治理/11-Agent权限审计与责任边界|Agent 权限审计与责任边界]]
- 可观测性：[[【AI 与大数据】/03-AI-Agent/06-Agent可观测性三件套|Agent 可观测性三件套]]

#MCP #Python #Server开发 #数据分析 #生产部署 #Streamable-HTTP #MCP-Inspector
