---
title: 数据工具 MCP 集成实战
tags:
  - MCP
  - 数据工程
  - PostgreSQL
  - Airflow
  - 数据目录
  - 实战
difficulty: 中级
duration: 90分钟
date: 2026-03-11
aliases:
  - MCP数据集成
  - 数据库MCP接入
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据治理工程师
  - 数据架构师
stability: fast-changing
status: maintenance
access_tier: free
created: 2026-03-11
updated: 2026-10-10
---


# 数据工具 MCP 集成实战

> [!quote] 核心定位
> 这是数据工程师的核心文档。不讲理论，讲怎么把你手边的数据系统接进 MCP，让 AI 能直接操作它们。四个场景均提供集成示例代码；运行需匹配服务接口、认证配置与实际权限，本文不据此保证代码可直接运行或用于生产。

## 目录

- [[#准备工作]]
- [[#场景一：数据库 MCP Server]]
- [[#场景二：自定义数据查询 MCP Server]]
- [[#场景三：数据目录 MCP Server]]
- [[#场景四：Airflow MCP Server]]
- [[#Claude Desktop 统一配置]]
- [[#安全注意事项]]

---

## 准备工作

### 安装 Python MCP SDK

```bash
pip install mcp
# 如果要连 PostgreSQL
pip install psycopg2-binary
# 如果要连 MySQL
pip install pymysql
```

### Claude Desktop 配置文件位置

```text
macOS:  ~/Library/Application Support/Claude/claude_desktop_config.json
Windows: %APPDATA%\Claude\claude_desktop_config.json
```

配置文件格式：

```json
{
  "mcpServers": {
    "server-name": {
      "command": "python",
      "args": ["/absolute/path/to/server.py"],
      "env": {
        "DB_HOST": "localhost",
        "DB_PASSWORD": "your_password"
      }
    }
  }
}
```

> [!warning] 路径必须是绝对路径
> `args` 里的脚本路径必须写绝对路径，相对路径不起作用。配置修改后需要重启 Claude Desktop。

---

## 场景一：数据库 MCP Server

### 现成数据库 Server 接入示例

以下保留 PostgreSQL、SQLite 的候选包名与配置示例；正文未提供其当前维护状态、启动入口或工具清单的依据，因此只能作为待确认的接入方案，不能据此认定为当前官方维护且可直接运行的实现。

**PostgreSQL（候选实现，维护状态与入口待确认）**

```bash
# 使用 npx 运行（需要 Node.js）
npx -y @modelcontextprotocol/server-postgres "postgresql://user:pass@localhost/dbname"
```

Claude Desktop 配置：

```json
{
  "mcpServers": {
    "postgres-prod": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://readonly_user:password@localhost:5432/data_warehouse"
      ]
    }
  }
}
```

**SQLite（候选实现，维护状态与入口待确认）**

```json
{
  "mcpServers": {
    "sqlite-local": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-sqlite",
        "--db-path",
        "/Users/yourname/data/analytics.db"
      ]
    }
  }
}
```

### 接入后的效果

以下为预期交互的示意对话，工具名、表结构和订单数量均为示例，不代表上述包的实际工具清单或真实查询结果；完成配置后能否实现此流程取决于具体 Server 的接口和权限：

```text
你：帮我看看 orders 表的结构，然后查一下本月每天的订单量。

Claude：好的，我先查看一下 orders 表的结构……
[调用 get_schema]
orders 表有以下字段：id, user_id, amount, status, created_at……

然后查询本月每天的订单量：
[调用 execute_sql]
SELECT DATE(created_at) as date, COUNT(*) as cnt
FROM orders
WHERE created_at >= DATE_TRUNC('month', NOW())
GROUP BY DATE(created_at)
ORDER BY date;

结果如下：
2026-03-01: 1234 单
2026-03-02: 1456 单
……
```

在 Server 提供相应的结构读取与查询工具、且权限允许的条件下，AI 可以读取表结构、生成并调用 SQL 查询，再根据返回结果进行分析。

---

## 场景二：自定义数据查询 MCP Server

官方实现功能有限，如果你需要控制权限、做数据脱敏、支持多数据源，就需要自己写。

下面是一个数据仓库 MCP Server 原型示例，支持以下功能，但不提供生产安全保证：
- 执行 SQL 查询（包含初步关键词过滤，不构成只读保证）
- 获取数据库 Schema 信息
- 分析 SQL 执行计划

```python
# dw_server.py
import asyncio
import os
import json
import psycopg2
import psycopg2.extras
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp import types
from mcp.types import Resource, Tool, TextContent, EmbeddedResource

# 数据库连接配置（从环境变量读取，不要硬编码密码）
DB_CONFIG = {
    "host": os.environ.get("DW_HOST", "localhost"),
    "port": int(os.environ.get("DW_PORT", "5432")),
    "database": os.environ.get("DW_DATABASE", "data_warehouse"),
    "user": os.environ.get("DW_USER", "readonly"),
    "password": os.environ.get("DW_PASSWORD", ""),
}

# 初始化 Server
server = Server("data-warehouse-server")


def get_connection():
    """获取数据库连接"""
    return psycopg2.connect(**DB_CONFIG)


# ============================================================
# Tools 定义
# ============================================================

@server.list_tools()
async def handle_list_tools() -> list[Tool]:
    return [
        Tool(
            name="query_data_warehouse",
            description=(
                "在数据仓库中执行 SQL 查询。"
                "对查询执行初步关键词过滤；该过滤不构成只读保证，实际可执行操作取决于数据库权限及执行约束。"
                "未检测到 LIMIT 字样时尝试追加行数限制，默认 100、参数上限 500；当前实现不能保证所有查询最多返回 500 行。"
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "要执行的 SQL SELECT 语句"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "最大返回行数，默认 100，最大 500",
                        "default": 100
                    }
                },
                "required": ["query"]
            }
        ),
        Tool(
            name="explain_query",
            description="使用 EXPLAIN ANALYZE 获取执行计划；它会实际执行传入语句，当前工具未实施查询过滤，仅应在隔离环境和受限数据库权限下使用。",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "要分析的 SQL 查询语句"
                    }
                },
                "required": ["query"]
            }
        )
    ]


@server.call_tool()
async def handle_call_tool(
    name: str,
    arguments: dict
) -> list[TextContent]:

    if name == "query_data_warehouse":
        return await execute_query(arguments)
    elif name == "explain_query":
        return await explain_query(arguments)
    else:
        raise ValueError(f"未知 Tool：{name}")


async def execute_query(arguments: dict) -> list[TextContent]:
    """执行 SQL 查询"""
    query = arguments["query"].strip()
    limit = min(arguments.get("limit", 100), 500)

    # 安全检查
    query_upper = query.upper()
    forbidden_keywords = ["INSERT", "UPDATE", "DELETE", "DROP", "CREATE",
                         "ALTER", "TRUNCATE", "GRANT", "REVOKE"]
    for keyword in forbidden_keywords:
        if keyword in query_upper:
            return [TextContent(
                type="text",
                text=f"安全拦截：检测到禁止的关键词 '{keyword}'，只允许执行 SELECT 查询。"
            )]

    if not query_upper.startswith("SELECT") and not query_upper.startswith("WITH"):
        return [TextContent(
            type="text",
            text="安全拦截：查询必须以 SELECT 或 WITH 开头。"
        )]

    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # 添加 LIMIT 防止查询过多数据
        if "LIMIT" not in query_upper:
            query = f"{query} LIMIT {limit}"

        cursor.execute(query)
        rows = cursor.fetchall()
        conn.close()

        if not rows:
            return [TextContent(type="text", text="查询执行成功，结果为空（0 行）。")]

        # 格式化为表格
        columns = list(rows[0].keys())
        lines = []
        lines.append("| " + " | ".join(columns) + " |")
        lines.append("|" + "|".join(["---"] * len(columns)) + "|")

        for row in rows:
            values = [str(row[col]) if row[col] is not None else "NULL"
                     for col in columns]
            lines.append("| " + " | ".join(values) + " |")

        result = f"查询返回 {len(rows)} 行结果：\n\n" + "\n".join(lines)
        return [TextContent(type="text", text=result)]

    except Exception as e:
        return [TextContent(
            type="text",
            text=f"查询执行失败：{type(e).__name__}: {str(e)}"
        )]


async def explain_query(arguments: dict) -> list[TextContent]:
    """分析 SQL 执行计划"""
    query = arguments["query"].strip()

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(f"EXPLAIN ANALYZE {query}")
        plan_rows = cursor.fetchall()
        conn.close()

        plan_text = "\n".join(row[0] for row in plan_rows)
        return [TextContent(
            type="text",
            text=f"执行计划：\n\n```\n{plan_text}\n```"
        )]

    except Exception as e:
        return [TextContent(
            type="text",
            text=f"执行计划分析失败：{str(e)}"
        )]


# ============================================================
# Resources 定义
# ============================================================

@server.list_resources()
async def handle_list_resources() -> list[Resource]:
    return [
        Resource(
            uri="schema://all",
            name="数据仓库 Schema",
            description="所有数据库表的结构信息，包括字段名、类型、注释",
            mimeType="application/json"
        )
    ]


@server.read_resource()
async def handle_read_resource(uri: str) -> str:
    if uri == "schema://all":
        return await get_full_schema()
    raise ValueError(f"未知资源 URI：{uri}")


async def get_full_schema() -> str:
    """获取完整的数据库 Schema"""
    query = """
    SELECT
        t.table_schema,
        t.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        obj_description(
            (t.table_schema || '.' || t.table_name)::regclass,
            'pg_class'
        ) as table_comment,
        pg_catalog.col_description(
            (t.table_schema || '.' || t.table_name)::regclass,
            c.ordinal_position
        ) as column_comment
    FROM information_schema.tables t
    JOIN information_schema.columns c
        ON t.table_name = c.table_name
        AND t.table_schema = c.table_schema
    WHERE t.table_schema NOT IN ('information_schema', 'pg_catalog')
    ORDER BY t.table_schema, t.table_name, c.ordinal_position;
    """

    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute(query)
        rows = cursor.fetchall()
        conn.close()

        # 整理成表结构字典
        schema = {}
        for row in rows:
            table_key = f"{row['table_schema']}.{row['table_name']}"
            if table_key not in schema:
                schema[table_key] = {
                    "table_comment": row["table_comment"],
                    "columns": []
                }
            schema[table_key]["columns"].append({
                "name": row["column_name"],
                "type": row["data_type"],
                "nullable": row["is_nullable"] == "YES",
                "default": row["column_default"],
                "comment": row["column_comment"]
            })

        return json.dumps(schema, ensure_ascii=False, indent=2)

    except Exception as e:
        return json.dumps({"error": str(e)})


# ============================================================
# 启动入口
# ============================================================

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="data-warehouse-server",
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

Claude Desktop 配置：

```json
{
  "mcpServers": {
    "data-warehouse": {
      "command": "python",
      "args": ["/Users/yourname/mcp-servers/dw_server.py"],
      "env": {
        "DW_HOST": "your-db-host.com",
        "DW_DATABASE": "data_warehouse",
        "DW_USER": "readonly_user",
        "DW_PASSWORD": "your_readonly_password"
      }
    }
  }
}
```

---

## 场景三：数据目录 MCP Server

让 AI 能搜索和查询数据资产信息（以 Apache Atlas REST API 为例）。

```python
# catalog_server.py
import asyncio
import os
import json
import httpx
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp import types
from mcp.types import Tool, TextContent

ATLAS_BASE_URL = os.environ.get("ATLAS_URL", "http://localhost:21000")
ATLAS_USER = os.environ.get("ATLAS_USER", "admin")
ATLAS_PASSWORD = os.environ.get("ATLAS_PASSWORD", "admin")

server = Server("data-catalog-server")


def get_atlas_client():
    return httpx.AsyncClient(
        base_url=ATLAS_BASE_URL,
        auth=(ATLAS_USER, ATLAS_PASSWORD),
        timeout=30.0
    )


@server.list_tools()
async def handle_list_tools() -> list[Tool]:
    return [
        Tool(
            name="search_metadata",
            description=(
                "在数据目录中搜索数据资产。"
                "可以按表名、字段名、业务标签、负责人等关键词搜索。"
                "返回匹配的数据资产列表及其基本信息。"
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "keyword": {
                        "type": "string",
                        "description": "搜索关键词，支持表名、字段名、业务标签"
                    },
                    "asset_type": {
                        "type": "string",
                        "description": "资产类型筛选，如 hive_table、rdbms_table",
                        "default": "hive_table"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "返回结果数量，默认 20",
                        "default": 20
                    }
                },
                "required": ["keyword"]
            }
        ),
        Tool(
            name="get_lineage",
            description=(
                "获取指定数据表的数据血缘关系。"
                "返回该表的上游数据来源和下游数据去向。"
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "table_qualified_name": {
                        "type": "string",
                        "description": "表的完整限定名，格式如 database.table@cluster"
                    },
                    "depth": {
                        "type": "integer",
                        "description": "血缘追溯深度，默认 3 层",
                        "default": 3
                    }
                },
                "required": ["table_qualified_name"]
            }
        )
    ]


@server.call_tool()
async def handle_call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "search_metadata":
        return await search_metadata(arguments)
    elif name == "get_lineage":
        return await get_lineage(arguments)
    raise ValueError(f"未知 Tool：{name}")


async def search_metadata(arguments: dict) -> list[TextContent]:
    """搜索数据目录"""
    keyword = arguments["keyword"]
    asset_type = arguments.get("asset_type", "hive_table")
    limit = arguments.get("limit", 20)

    try:
        async with get_atlas_client() as client:
            response = await client.get(
                "/api/atlas/v2/search/quick",
                params={
                    "query": keyword,
                    "typeName": asset_type,
                    "limit": limit,
                    "offset": 0,
                    "excludeDeletedEntities": True
                }
            )
            response.raise_for_status()
            data = response.json()

        entities = data.get("searchResults", {}).get("entities", [])
        if not entities:
            return [TextContent(
                type="text",
                text=f"未找到包含关键词 '{keyword}' 的数据资产。"
            )]

        lines = [f"找到 {len(entities)} 个数据资产：\n"]
        for entity in entities:
            attrs = entity.get("attributes", {})
            lines.append(f"**{attrs.get('name', '未知')}**")
            lines.append(f"  - 类型：{entity.get('typeName', '未知')}")
            lines.append(f"  - 完整名：{attrs.get('qualifiedName', '未知')}")
            lines.append(f"  - 描述：{attrs.get('description', '暂无描述')}")
            lines.append(f"  - 负责人：{attrs.get('owner', '未知')}")
            lines.append("")

        return [TextContent(type="text", text="\n".join(lines))]

    except httpx.HTTPError as e:
        return [TextContent(type="text", text=f"Atlas API 请求失败：{str(e)}")]


async def get_lineage(arguments: dict) -> list[TextContent]:
    """获取数据血缘"""
    table_qualified_name = arguments["table_qualified_name"]
    depth = arguments.get("depth", 3)

    try:
        async with get_atlas_client() as client:
            # 先通过 qualifiedName 获取 GUID
            search_response = await client.get(
                "/api/atlas/v2/search/attribute",
                params={
                    "typeName": "hive_table",
                    "attrName": "qualifiedName",
                    "attrValuePrefix": table_qualified_name
                }
            )
            search_data = search_response.json()
            entities = search_data.get("entities", [])

            if not entities:
                return [TextContent(
                    type="text",
                    text=f"未找到表：{table_qualified_name}"
                )]

            guid = entities[0]["guid"]

            # 获取血缘
            lineage_response = await client.get(
                f"/api/atlas/v2/lineage/{guid}",
                params={"depth": depth, "direction": "BOTH"}
            )
            lineage_data = lineage_response.json()

        # 解析血缘关系
        relations = lineage_data.get("relations", [])
        entity_map = {
            e["guid"]: e.get("displayText", e["guid"])
            for e in lineage_data.get("guidEntityMap", {}).values()
        }

        upstream = []
        downstream = []
        for rel in relations:
            from_name = entity_map.get(rel["fromEntityId"], rel["fromEntityId"])
            to_name = entity_map.get(rel["toEntityId"], rel["toEntityId"])

            if rel["toEntityId"] == guid:
                upstream.append(from_name)
            elif rel["fromEntityId"] == guid:
                downstream.append(to_name)

        result_lines = [f"表 `{table_qualified_name}` 的数据血缘：\n"]
        result_lines.append("**上游数据来源（输入）：**")
        if upstream:
            for name in upstream:
                result_lines.append(f"  - {name}")
        else:
            result_lines.append("  - 当前结果未展示直接上游，不能据此判定为源头表")

        result_lines.append("\n**下游数据去向（输出）：**")
        if downstream:
            for name in downstream:
                result_lines.append(f"  - {name}")
        else:
            result_lines.append("  - 当前结果未展示直接下游，不能据此判定为终端表")

        return [TextContent(type="text", text="\n".join(result_lines))]

    except Exception as e:
        return [TextContent(type="text", text=f"获取血缘失败：{str(e)}")]


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="data-catalog-server",
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

## 场景四：Airflow MCP Server

让 AI 能查询和操作 Airflow DAG。

```python
# airflow_server.py
import asyncio
import os
import json
import httpx
from datetime import datetime
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp import types
from mcp.types import Tool, Resource, TextContent

AIRFLOW_BASE_URL = os.environ.get("AIRFLOW_URL", "http://localhost:8080")
AIRFLOW_USER = os.environ.get("AIRFLOW_USER", "admin")
AIRFLOW_PASSWORD = os.environ.get("AIRFLOW_PASSWORD", "admin")

server = Server("airflow-server")


def get_airflow_client():
    return httpx.AsyncClient(
        base_url=f"{AIRFLOW_BASE_URL}/api/v1",
        auth=(AIRFLOW_USER, AIRFLOW_PASSWORD),
        timeout=30.0
    )


@server.list_tools()
async def handle_list_tools() -> list[Tool]:
    return [
        Tool(
            name="trigger_dag",
            description="触发指定 DAG 的一次运行。触发前请先确认 DAG 状态正常。",
            inputSchema={
                "type": "object",
                "properties": {
                    "dag_id": {
                        "type": "string",
                        "description": "DAG 的 ID"
                    },
                    "logical_date": {
                        "type": "string",
                        "description": "业务日期，格式 YYYY-MM-DD，默认为今天"
                    },
                    "conf": {
                        "type": "object",
                        "description": "传给 DAG 的额外配置参数（可选）"
                    }
                },
                "required": ["dag_id"]
            }
        ),
        Tool(
            name="get_dag_status",
            description="获取指定 DAG 最近几次运行的状态。",
            inputSchema={
                "type": "object",
                "properties": {
                    "dag_id": {
                        "type": "string",
                        "description": "DAG 的 ID"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "返回最近几次运行，默认 5",
                        "default": 5
                    }
                },
                "required": ["dag_id"]
            }
        )
    ]


@server.list_resources()
async def handle_list_resources() -> list[Resource]:
    return [
        Resource(
            uri="airflow://dags",
            name="Airflow DAG 列表",
            description="一次请求返回的最多 200 个 DAG，包括暂停状态、活跃状态及最近解析时间，不包含最近运行时间",
            mimeType="application/json"
        )
    ]


@server.read_resource()
async def handle_read_resource(uri: str) -> str:
    if uri == "airflow://dags":
        return await list_all_dags()
    raise ValueError(f"未知资源：{uri}")


async def list_all_dags() -> str:
    """获取一次请求返回的最多 200 个 DAG，不进行分页"""
    try:
        async with get_airflow_client() as client:
            response = await client.get("/dags", params={"limit": 200})
            response.raise_for_status()
            data = response.json()

        dags = data.get("dags", [])
        summary = []
        for dag in dags:
            summary.append({
                "dag_id": dag["dag_id"],
                "is_paused": dag["is_paused"],
                "is_active": dag["is_active"],
                "last_parsed_time": dag.get("last_parsed_time"),
                "tags": [t["name"] for t in dag.get("tags", [])]
            })

        return json.dumps(summary, ensure_ascii=False, indent=2)

    except Exception as e:
        return json.dumps({"error": str(e)})


@server.call_tool()
async def handle_call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "trigger_dag":
        return await trigger_dag(arguments)
    elif name == "get_dag_status":
        return await get_dag_status(arguments)
    raise ValueError(f"未知 Tool：{name}")


async def trigger_dag(arguments: dict) -> list[TextContent]:
    """触发 DAG 运行"""
    dag_id = arguments["dag_id"]
    logical_date = arguments.get("logical_date", datetime.now().strftime("%Y-%m-%d"))
    conf = arguments.get("conf", {})

    # 转换日期格式为 ISO 8601
    logical_date_iso = f"{logical_date}T00:00:00+00:00"

    try:
        async with get_airflow_client() as client:
            response = await client.post(
                f"/dags/{dag_id}/dagRuns",
                json={
                    "logical_date": logical_date_iso,
                    "conf": conf
                }
            )
            response.raise_for_status()
            data = response.json()

        run_id = data.get("dag_run_id", "未知")
        state = data.get("state", "未知")

        return [TextContent(
            type="text",
            text=(
                f"DAG `{dag_id}` 触发成功！\n\n"
                f"- Run ID：{run_id}\n"
                f"- 业务日期：{logical_date}\n"
                f"- 初始状态：{state}\n\n"
                f"可以用 get_dag_status 工具查询运行结果。"
            )
        )]

    except httpx.HTTPStatusError as e:
        error_detail = e.response.text
        return [TextContent(
            type="text",
            text=f"触发 DAG 失败（HTTP {e.response.status_code}）：{error_detail}"
        )]


async def get_dag_status(arguments: dict) -> list[TextContent]:
    """获取 DAG 运行状态"""
    dag_id = arguments["dag_id"]
    limit = arguments.get("limit", 5)

    try:
        async with get_airflow_client() as client:
            response = await client.get(
                f"/dags/{dag_id}/dagRuns",
                params={
                    "limit": limit,
                    "order_by": "-logical_date"
                }
            )
            response.raise_for_status()
            data = response.json()

        runs = data.get("dag_runs", [])
        if not runs:
            return [TextContent(
                type="text",
                text=f"DAG `{dag_id}` 没有历史运行记录。"
            )]

        lines = [f"DAG `{dag_id}` 最近 {len(runs)} 次运行：\n"]
        status_emoji = {
            "success": "✓",
            "failed": "✗",
            "running": "→",
            "queued": "○"
        }

        for run in runs:
            state = run.get("state", "unknown")
            emoji = status_emoji.get(state, "?")
            lines.append(
                f"{emoji} {run.get('logical_date', '?')[:10]}  "
                f"状态：{state}  "
                f"Run ID：{run.get('dag_run_id', '?')}"
            )
            if state == "failed":
                lines.append(f"   失败时间：{run.get('end_date', '?')}")

        return [TextContent(type="text", text="\n".join(lines))]

    except Exception as e:
        return [TextContent(type="text", text=f"获取 DAG 状态失败：{str(e)}")]


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="airflow-server",
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

## Claude Desktop 统一配置

把上面所有 Server 一次性配置进去：

```json
{
  "mcpServers": {
    "data-warehouse": {
      "command": "python",
      "args": ["/Users/yourname/mcp-servers/dw_server.py"],
      "env": {
        "DW_HOST": "your-dw-host.internal",
        "DW_DATABASE": "data_warehouse",
        "DW_USER": "claude_readonly",
        "DW_PASSWORD": "your_password"
      }
    },
    "data-catalog": {
      "command": "python",
      "args": ["/Users/yourname/mcp-servers/catalog_server.py"],
      "env": {
        "ATLAS_URL": "http://atlas.your-company.com:21000",
        "ATLAS_USER": "atlas_readonly",
        "ATLAS_PASSWORD": "your_password"
      }
    },
    "airflow": {
      "command": "python",
      "args": ["/Users/yourname/mcp-servers/airflow_server.py"],
      "env": {
        "AIRFLOW_URL": "http://airflow.your-company.com:8080",
        "AIRFLOW_USER": "claude_user",
        "AIRFLOW_PASSWORD": "your_password"
      }
    }
  }
}
```

---

## 安全注意事项

> [!warning] 生产环境安全清单
> 在把 MCP Server 接入生产数据库之前，务必确认以下几点。

### 数据库权限

**只给只读权限**，这是最重要的一条。

```sql
-- PostgreSQL：创建只读用户
CREATE USER claude_readonly WITH PASSWORD 'strong_password';
GRANT CONNECT ON DATABASE data_warehouse TO claude_readonly;
GRANT USAGE ON SCHEMA public TO claude_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO claude_readonly;
-- 此默认权限设置只覆盖当前对象创建角色在 public 中后续新建的表，不自动覆盖其他角色创建的表
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO claude_readonly;
```

### SQL 注入防护

代码里已经有关键词过滤，但还需要注意：
- 永远不要直接把用户输入拼接进 SQL
- 使用参数化查询（如果允许动态参数）
- 限制查询执行时间（`SET statement_timeout = '30s'`）
- 限制返回行数（在 SQL 里强制加 LIMIT）

### 敏感数据脱敏

下面仅定义敏感字段名识别函数，尚未接入 Schema 输出；即使隐藏 Schema 字段，也不能阻止查询读取敏感值，查询访问范围仍需由数据库权限或受控视图限制：

```python
SENSITIVE_COLUMNS = ["password", "phone", "id_card", "bank_account", "credit_card"]

def is_sensitive(column_name: str) -> bool:
    return any(s in column_name.lower() for s in SENSITIVE_COLUMNS)
```

### 环境变量管理

- 密码通过环境变量传入，不要硬编码在代码里
- 使用 `.env` 文件本地管理，不要提交到 git
- 生产环境考虑用 Vault 或云厂商的 Secret Manager

---

## 常见问题

**Q：Server 启动后 Claude Desktop 没有识别到怎么办？**

检查这几个地方：
1. 配置文件路径是否正确（macOS 是 `~/Library/Application Support/Claude/claude_desktop_config.json`）
2. Python 脚本的路径是否是绝对路径
3. 是否已重启 Claude Desktop
4. 查看 Claude Desktop 的日志（帮助菜单 → 开启开发者工具）

**Q：AI 调用 Tool 时提示"执行失败"怎么办？**

在脚本里加上日志输出到文件（注意不能输出到 stdout，否则会干扰 JSON-RPC 通信）：

```python
import logging
logging.basicConfig(
    filename="/tmp/mcp_server.log",
    level=logging.DEBUG,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
```

---

## 系列导航

- 上一篇：[[【技术与工具】/MCP/01-MCP协议核心概念|MCP协议核心概念]]
- 下一篇：[[【技术与工具】/MCP/03-MCP-Server开发实践|MCP Server开发实践]]
- 回到导航：[[【技术与工具】/MCP/00-MCP学习路线图|MCP学习路线图]]

#MCP #数据工程 #PostgreSQL #Airflow #数据目录 #实战
