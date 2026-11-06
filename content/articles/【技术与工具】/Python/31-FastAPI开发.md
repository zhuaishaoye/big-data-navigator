---
title: FastAPI开发 - 高性能异步Web框架
tags:
  - FastAPI
  - 异步编程
  - 高性能API
  - 类型提示
  - 依赖注入
  - WebSocket
created: 2024-06-29
updated: 2026-10-10
difficulty: 中级
duration: 120分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据科学家
  - Python Web开发者
stability: slow-changing
status: maintenance
access_tier: free
---


# FastAPI开发 - 高性能异步Web框架

> [!abstract] 学习目标
> - **掌握FastAPI核心特性**：类型提示、自动文档、数据验证
> - **理解异步编程模型**：async/await、事件循环、并发处理
> - **实现依赖注入系统**：认证、数据库连接、缓存管理
> - **构建WebSocket应用**：实时通信、消息广播
> - **性能优化实践**：并发控制、缓存策略、监控指标

## FastAPI核心优势

FastAPI是基于Python 3.7+类型提示的现代Web框架，具备以下技术特点：

**性能特性**：
- 基于Starlette和Pydantic构建；与Node.js或Go服务的性能比较取决于具体实现、负载、依赖和部署条件，本文未提供对比测试
- 原生异步支持，高并发处理能力
- ASGI兼容，支持异步服务器网关接口

**开发效率**：
- 自动生成OpenAPI/Swagger文档
- 基于Python类型提示的数据验证
- IDE智能提示和类型检查支持
## FastAPI基础架构

### 类型安全的路由系统

FastAPI通过Python类型提示实现自动数据验证和文档生成：

```python
from fastapi import FastAPI, Query, Path, HTTPException
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Union
import asyncio
from datetime import datetime, date
import uvicorn

# FastAPI应用实例
app = FastAPI(
    title="高性能数据API",
    description="基于FastAPI的异步数据服务",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Pydantic数据模型
class SalesRecord(BaseModel):
    """销售记录数据模型"""
    id: Optional[int] = None
    product_name: str = Field(..., min_length=1, max_length=100)
    quantity: int = Field(..., ge=1, le=10000)
    unit_price: float = Field(..., ge=0.01)
    sale_date: date
    
    @validator('unit_price')
    def validate_price(cls, v):
        return round(v, 2)
    
    class Config:
        json_encoders = {
            date: lambda v: v.isoformat()
        }

class ApiResponse(BaseModel):
    """标准API响应格式"""
    success: bool
    data: Optional[Union[List[SalesRecord], dict]] = None
    message: str
    timestamp: datetime = Field(default_factory=datetime.now)

# 内存数据存储（生产环境使用数据库）
sales_db: List[dict] = []

@app.get("/", response_model=dict)
async def root():
    """API根端点"""
    return {
        "service": "FastAPI高性能数据服务",
        "version": "2.0.0",
        "documentation": "/docs",
        "features": ["异步处理", "类型验证", "自动文档", "高并发"]
    }

@app.get("/api/sales", response_model=ApiResponse)
async def get_sales(
    limit: int = Query(10, ge=1, le=1000, description="返回记录数量"),
    offset: int = Query(0, ge=0, description="偏移量"),
    product: Optional[str] = Query(None, description="产品名称过滤")
):
    """获取销售记录（支持分页和过滤）"""
    
    # 模拟异步数据库查询延迟
    await asyncio.sleep(0.01)
    
    # 数据过滤
    filtered_data = sales_db
    if product:
        filtered_data = [record for record in sales_db 
                        if product.lower() in record['product_name'].lower()]
    
    # 分页处理
    total_count = len(filtered_data)
    paginated_data = filtered_data[offset:offset + limit]
    
    return ApiResponse(
        success=True,
        data=paginated_data,
        message=f"返回 {len(paginated_data)}/{total_count} 条记录"
    )

@app.post("/api/sales", response_model=ApiResponse, status_code=201)
async def create_sales_record(record: SalesRecord):
    """创建销售记录"""
    
    # 生成ID
    new_id = len(sales_db) + 1
    record_data = record.dict()
    record_data['id'] = new_id
    
    # 异步写入操作
    await asyncio.sleep(0.02)
    sales_db.append(record_data)
    
    return ApiResponse(
        success=True,
        data=record_data,
        message=f"销售记录 {new_id} 创建成功"
    )
```

### 异步编程模型

FastAPI基于Python的async/await语法，提供真正的异步处理能力：

```python
import asyncio
import aiohttp
from concurrent.futures import ThreadPoolExecutor

@app.get("/api/sales/{record_id}", response_model=ApiResponse)
async def get_sales_record(
    record_id: int = Path(..., ge=1, description="记录ID"),
    include_stats: bool = Query(False, description="包含统计信息")
):
    """根据ID获取销售记录"""
    
    # 异步查找记录
    record = await find_record_async(record_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"记录 {record_id} 不存在")
    
    result_data = record.copy()
    
    if include_stats:
        # 并行执行多个异步操作
        stats_task = calculate_product_stats(record['product_name'])
        trend_task = get_sales_trend(record['product_name'])
        
        stats, trend = await asyncio.gather(stats_task, trend_task)
        result_data.update({'statistics': stats, 'trend': trend})
    
    return ApiResponse(
        success=True,
        data=result_data,
        message="记录获取成功"
    )

async def find_record_async(record_id: int) -> Optional[dict]:
    """异步查找记录（模拟数据库查询）"""
    await asyncio.sleep(0.01)  # 模拟IO延迟
    for record in sales_db:
        if record['id'] == record_id:
            return record
    return None

async def calculate_product_stats(product_name: str) -> dict:
    """异步计算产品统计"""
    await asyncio.sleep(0.05)  # 模拟复杂计算
    
    product_records = [r for r in sales_db if r['product_name'] == product_name]
    if not product_records:
        return {'total_quantity': 0, 'avg_price': 0}
    
    total_qty = sum(r['quantity'] for r in product_records)
    avg_price = sum(r['unit_price'] for r in product_records) / len(product_records)
    
    return {
        'total_quantity': total_qty,
        'avg_price': round(avg_price, 2),
        'record_count': len(product_records)
    }

async def get_sales_trend(product_name: str) -> dict:
    """异步获取销售趋势"""
    await asyncio.sleep(0.03)
    
    # 模拟趋势计算
    recent_sales = [r for r in sales_db[-30:] if r['product_name'] == product_name]
    trend_direction = "上升" if len(recent_sales) > 5 else "稳定"
    
    return {
        'recent_sales_count': len(recent_sales),
        'trend_direction': trend_direction
    }
```

## 高并发处理与性能优化

### 批量操作与并发控制

```python
from asyncio import Semaphore
from typing import Dict, Any
import time

# 并发控制信号量
CONCURRENCY_LIMIT = 100
semaphore = Semaphore(CONCURRENCY_LIMIT)

class PerformanceMetrics:
    """性能指标收集器"""
    def __init__(self):
        self.request_count = 0
        self.total_response_time = 0.0
        self.error_count = 0
        self.concurrent_requests = 0
    
    def record_request(self, response_time: float, success: bool = True):
        self.request_count += 1
        self.total_response_time += response_time
        if not success:
            self.error_count += 1
    
    def get_stats(self) -> dict:
        avg_response_time = (self.total_response_time / self.request_count 
                           if self.request_count > 0 else 0)
        error_rate = (self.error_count / self.request_count * 100 
                     if self.request_count > 0 else 0)
        
        return {
            "total_requests": self.request_count,
            "avg_response_time": round(avg_response_time, 4),
            "error_rate": round(error_rate, 2),
            "concurrent_requests": self.concurrent_requests
        }

metrics = PerformanceMetrics()

@app.post("/api/batch-sales", response_model=ApiResponse)
async def batch_create_sales(records: List[SalesRecord]):
    """批量创建销售记录（高并发处理）"""
    
    start_time = time.time()
    
    # 限制批量大小
    if len(records) > 500:
        raise HTTPException(
            status_code=400,
            detail="批量限制：单次最多处理500条记录"
        )
    
    async with semaphore:  # 并发控制
        metrics.concurrent_requests += 1
        try:
            # 并行处理记录
            tasks = []
            for i, record in enumerate(records):
                task = process_single_record(record, len(sales_db) + i + 1)
                tasks.append(task)
            
            # 等待所有任务完成
            processed_records = await asyncio.gather(*tasks, return_exceptions=True)
            
            # 处理结果
            successful_records = []
            errors = []
            
            for i, result in enumerate(processed_records):
                if isinstance(result, Exception):
                    errors.append(f"记录 {i+1}: {str(result)}")
                else:
                    successful_records.append(result)
                    sales_db.append(result)
            
            response_time = time.time() - start_time
            metrics.record_request(response_time, len(errors) == 0)
            
            return ApiResponse(
                success=len(errors) == 0,
                data={
                    "processed_count": len(successful_records),
                    "error_count": len(errors),
                    "errors": errors[:5],  # 只返回前5个错误
                    "processing_time": round(response_time, 4)
                },
                message=f"批量处理完成：{len(successful_records)}/{len(records)} 成功"
            )
        
        finally:
            metrics.concurrent_requests -= 1

async def process_single_record(record: SalesRecord, record_id: int) -> dict:
    """异步处理单条记录"""
    # 模拟数据验证和处理时间
    await asyncio.sleep(0.001)
    
    # 数据验证
    if record.quantity <= 0:
        raise ValueError("销售数量必须大于0")
    
    return {
        "id": record_id,
        "product_name": record.product_name,
        "quantity": record.quantity,
        "unit_price": record.unit_price,
        "sale_date": record.sale_date.isoformat(),
        "total_amount": record.quantity * record.unit_price,
        "created_at": datetime.now().isoformat()
    }

@app.get("/api/performance", response_model=dict)
async def get_performance_metrics():
    """获取API性能指标"""
    return {
        "performance_metrics": metrics.get_stats(),
        "memory_usage": len(sales_db),
        "timestamp": datetime.now().isoformat()
    }
```

## 依赖注入系统

### 认证与授权机制

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
import jwt
from datetime import timedelta
import redis.asyncio as redis

security = HTTPBearer()

class AuthService:
    """JWT认证服务"""
    
    def __init__(self, secret_key: str = "your-secret-key"):
        self.secret_key = secret_key
        self.algorithm = "HS256"
        self.users_db = {
            "admin@example.com": {"id": 1, "email": "admin@example.com", "role": "admin"},
            "user@example.com": {"id": 2, "email": "user@example.com", "role": "user"}
        }
    
    async def verify_token(self, credentials: HTTPAuthorizationCredentials = Depends(security)):
        """验证JWT令牌"""
        try:
            payload = jwt.decode(
                credentials.credentials, 
                self.secret_key, 
                algorithms=[self.algorithm]
            )
            email = payload.get("sub")
            if email is None or email not in self.users_db:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="令牌无效"
                )
            return self.users_db[email]
        except jwt.PyJWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="令牌解析失败"
            )

class ConnectionPool:
    """异步连接池管理"""
    
    def __init__(self, max_connections: int = 10):
        self.max_connections = max_connections
        self.active_connections = 0
        self.semaphore = asyncio.Semaphore(max_connections)
    
    @asynccontextmanager
    async def get_connection(self):
        """获取连接（上下文管理器）"""
        async with self.semaphore:
            self.active_connections += 1
            conn_id = f"conn_{self.active_connections}"
            try:
                # 模拟连接建立
                await asyncio.sleep(0.01)
                yield conn_id
            finally:
                self.active_connections -= 1

class CacheService:
    """Redis缓存服务"""
    
    def __init__(self):
        # 生产环境连接真实Redis
        self.cache = {}  # 内存模拟
        self.stats = {"hits": 0, "misses": 0}
    
    async def get(self, key: str) -> Optional[str]:
        """异步获取缓存"""
        if key in self.cache:
            if time.time() < self.cache[key]['expires']:
                self.stats['hits'] += 1
                return self.cache[key]['value']
            else:
                del self.cache[key]  # 过期删除
        
        self.stats['misses'] += 1
        return None
    
    async def set(self, key: str, value: str, ttl: int = 300):
        """异步设置缓存"""
        self.cache[key] = {
            'value': value,
            'expires': time.time() + ttl
        }
    
    def get_stats(self) -> dict:
        total = self.stats['hits'] + self.stats['misses']
        hit_rate = (self.stats['hits'] / total * 100) if total > 0 else 0
        return {
            'hit_rate': round(hit_rate, 2),
            'total_requests': total,
            'cache_size': len(self.cache)
        }

# 全局服务实例
auth_service = AuthService()
connection_pool = ConnectionPool()
cache_service = CacheService()

# 依赖注入函数
async def get_current_user(user = Depends(auth_service.verify_token)):
    return user

async def get_db_connection():
    async with connection_pool.get_connection() as conn:
        yield conn

async def get_cache() -> CacheService:
    return cache_service

# 受保护的API端点
@app.get("/api/secure/analytics", response_model=ApiResponse)
async def get_analytics(
    user = Depends(get_current_user),
    db = Depends(get_db_connection),
    cache = Depends(get_cache)
):
    """获取分析数据（需要认证）"""
    
    cache_key = f"analytics_{user['id']}"
    
    # 尝试从缓存获取
    cached_result = await cache.get(cache_key)
    if cached_result:
        return ApiResponse(
            success=True,
            data=cached_result,
            message="从缓存获取数据"
        )
    
    # 从数据库计算分析结果
    await asyncio.sleep(0.1)  # 模拟复杂计算
    
    analytics_data = {
        "total_sales": len(sales_db),
        "revenue_summary": sum(r['quantity'] * r['unit_price'] for r in sales_db),
        "top_products": get_top_products(),
        "user_access_level": user['role']
    }
    
    # 设置缓存
    await cache.set(cache_key, str(analytics_data), ttl=300)
    
    return ApiResponse(
        success=True,
        data=analytics_data,
        message="分析完成"
    )

def get_top_products() -> List[dict]:
    """获取热销产品"""
    product_sales = {}
    for record in sales_db:
        product = record['product_name']
        if product not in product_sales:
            product_sales[product] = 0
        product_sales[product] += record['quantity']
    
    return sorted(
        [{"product": k, "total_sales": v} for k, v in product_sales.items()],
        key=lambda x: x['total_sales'],
        reverse=True
    )[:5]
```

## WebSocket实时通信

### 实时数据推送

```python
from fastapi import WebSocket, WebSocketDisconnect
import json

class ConnectionManager:
    """WebSocket连接管理器"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.connection_count = 0
    
    async def connect(self, websocket: WebSocket):
        """建立WebSocket连接"""
        await websocket.accept()
        self.active_connections.append(websocket)
        self.connection_count += 1
        print(f"WebSocket连接建立，当前连接数：{len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        """断开WebSocket连接"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        print(f"WebSocket连接断开，当前连接数：{len(self.active_connections)}")
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        """发送个人消息"""
        await websocket.send_text(message)
    
    async def broadcast(self, message: dict):
        """广播消息给所有连接"""
        if self.active_connections:
            message_text = json.dumps(message)
            tasks = []
            for connection in self.active_connections:
                tasks.append(connection.send_text(message_text))
            await asyncio.gather(*tasks, return_exceptions=True)

manager = ConnectionManager()

@app.websocket("/ws/sales-monitor")
async def websocket_endpoint(websocket: WebSocket):
    """销售数据实时监控WebSocket端点"""
    await manager.connect(websocket)
    try:
        while True:
            # 接收客户端消息
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            if message_data.get("type") == "subscribe":
                # 订阅实时数据
                await websocket.send_text(json.dumps({
                    "type": "subscription_confirmed",
                    "message": "已订阅实时销售数据"
                }))
            
            elif message_data.get("type") == "request_summary":
                # 请求数据摘要
                summary = {
                    "type": "summary",
                    "data": {
                        "total_records": len(sales_db),
                        "recent_sales": len([r for r in sales_db[-10:]]),
                        "timestamp": datetime.now().isoformat()
                    }
                }
                await websocket.send_text(json.dumps(summary))
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# 实时数据推送任务
async def broadcast_sales_updates():
    """定期广播销售数据更新"""
    while True:
        if len(manager.active_connections) > 0:
            # 模拟实时数据变化
            update_message = {
                "type": "sales_update",
                "data": {
                    "total_sales": len(sales_db),
                    "last_update": datetime.now().isoformat(),
                    "new_records_count": 0  # 实际应用中检测新增记录
                },
                "timestamp": datetime.now().isoformat()
            }
            await manager.broadcast(update_message)
        
        await asyncio.sleep(30)  # 每30秒推送一次

# 启动时创建后台任务
@app.on_event("startup")
async def startup_event():
    """应用启动事件"""
    asyncio.create_task(broadcast_sales_updates())

@app.post("/api/trigger-broadcast", response_model=dict)
async def trigger_broadcast(message: dict):
    """手动触发广播消息"""
    broadcast_message = {
        "type": "manual_broadcast",
        "data": message,
        "timestamp": datetime.now().isoformat()
    }
    await manager.broadcast(broadcast_message)
    
    return {
        "success": True,
        "message": f"消息已广播给 {len(manager.active_connections)} 个连接",
        "connections": len(manager.active_connections)
    }
```

## 高性能API实战案例

### 数据分析API应用组装片段（非独立完整应用）

```python
# main.py - 依赖前文定义的应用组装片段，非独立完整应用
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化
    logger.info("FastAPI应用启动中...")
    # 初始化数据库连接池、缓存等
    await initialize_services()
    
    yield
    
    # 关闭时清理
    logger.info("FastAPI应用关闭中...")
    await cleanup_services()

# 创建应用实例
app = FastAPI(
    title="高性能数据分析API",
    description="FastAPI数据服务组装示例（非生产实现）",
    version="2.0.0",
    lifespan=lifespan
)

# 添加中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],  # 生产环境限制域名
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=["yourdomain.com", "*.yourdomain.com"]
)

async def initialize_services():
    """初始化服务"""
    # 初始化数据库连接
    # 初始化Redis连接
    # 预热缓存
    pass

async def cleanup_services():
    """清理服务"""
    # 关闭数据库连接
    # 关闭Redis连接
    pass

@app.get("/api/v2/analytics/dashboard")
async def get_dashboard_data(
    user = Depends(get_current_user),
    cache = Depends(get_cache),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """获取仪表盘数据（内存模拟练习）"""
    
    cache_key = f"dashboard_{user['id']}"
    
    # 尝试从缓存获取
    cached_data = await cache.get(cache_key)
    if cached_data:
        # 后台任务更新用户活跃度
        background_tasks.add_task(update_user_activity, user['id'])
        return json.loads(cached_data)
    
    # 并行计算多个指标
    sales_task = calculate_sales_metrics()
    product_task = analyze_product_performance()
    trend_task = calculate_trend_analysis()
    
    sales_metrics, product_analysis, trend_data = await asyncio.gather(
        sales_task, product_task, trend_task
    )
    
    dashboard_data = {
        "sales_metrics": sales_metrics,
        "product_analysis": product_analysis,
        "trend_analysis": trend_data,
        "generated_at": datetime.now().isoformat(),
        "user_role": user['role']
    }
    
    # 设置缓存（非阻塞）
    background_tasks.add_task(
        cache.set, cache_key, json.dumps(dashboard_data), 600
    )
    background_tasks.add_task(update_user_activity, user['id'])
    
    return dashboard_data

async def calculate_sales_metrics() -> dict:
    """计算销售指标"""
    await asyncio.sleep(0.1)  # 模拟复杂计算
    return {
        "total_revenue": sum(r['quantity'] * r['unit_price'] for r in sales_db),
        "total_orders": len(sales_db),
        "avg_order_value": 0 if not sales_db else sum(r['quantity'] * r['unit_price'] for r in sales_db) / len(sales_db)
    }

async def analyze_product_performance() -> List[dict]:
    """分析产品表现"""
    await asyncio.sleep(0.15)  # 模拟数据分析
    return get_top_products()

async def calculate_trend_analysis() -> dict:
    """计算趋势分析"""
    await asyncio.sleep(0.08)
    return {
        "daily_trends": "上升",
        "weekly_growth": "5.2%",
        "monthly_comparison": "同比增长12%"
    }

async def update_user_activity(user_id: int):
    """更新用户活跃度（后台任务）"""
    logger.info(f"更新用户 {user_id} 活跃度")
    # 实际实现：更新数据库中的用户活跃时间
    await asyncio.sleep(0.01)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # 开发环境
        workers=1,    # 开发热重载模式；生产多进程需关闭reload后单独配置
        access_log=True
    )
```

## 性能优化与最佳实践

### 关键性能指标

**异步处理优势**：
- **并发处理能力**：可将单进程数千并发连接作为压测场景，实际承载能力取决于硬件、负载和资源限制，本文未提供压测结果
- **内存效率**：事件循环避免线程切换开销
- **响应时间**：可将平均响应时间 < 50ms作为示例测试目标，并非本文已测得的结果或框架保证

**类型安全收益**：
- **开发效率**：类型提示与数据验证可辅助调试；减少40%的调试时间仅可作为待验证的收益假设，本文未提供统计依据
- **运行时错误**：请求数据自动验证可拦截不符合模型约束的输入；减少85%的数据错误仅可作为待验证的收益假设，不代表业务正确性保证
- **API文档**：自动生成完整的OpenAPI文档

### 生产环境部署

**容器化配置**：
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

**关键配置参数**：
- **Workers数量**：依据负载、CPU与内存资源、下游连接限制进行压测调整；CPU核心数 × 2仅可作为候选配置，不是通用规则
- **连接池大小**：根据数据库连接限制调整
- **缓存TTL**：根据数据更新频率设置
- **请求超时**：防止长时间占用连接

## 技术栈集成

**数据库集成**：
- [[【技术与工具】/Java/07-Java数据库操作与数据仓库开发|Java/Java数据库操作与数据仓库开发]] - 数据持久化
- [[【技术与工具】/Spark/12-缓存与持久化|Spark/缓存与持久化]] - 高速数据访问

**监控与运维**：
- [[【技术与工具】/Python/33-系统监控|系统监控]] - 性能指标收集
- [[【数据分析与数据运营】/98-专业术语词典/07-基础概念类/18-Flink生产部署|Flink生产部署]] - 容器化部署

**扩展应用**：
- [[【数据分析与数据运营】/02-数据分析专业能力/03-建模与预测/04-机器学习应用|机器学习]] - AI模型服务化
- [[【数据开发与数据架构】/09-实时数据架构/03-实时数据处理|实时数据架构/实时数据处理]] - 实时数据API

---

**更新时间**：2025-01-02  
**文档版本**：2.0  
**适用场景**：FastAPI异步API、依赖注入与WebSocket综合练习；不构成可直接部署的企业级服务

#FastAPI #异步编程 #高并发API #类型提示 #依赖注入 #WebSocket #性能优化
