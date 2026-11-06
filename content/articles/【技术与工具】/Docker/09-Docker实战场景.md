---
title: Docker实战场景 - 数据工程的实际应用案例
tags:
  - Docker
  - ETL容器化
  - 数据服务部署
  - CI/CD
  - 数据工程实战
aliases:
  - Docker实战
  - ETL容器化
  - 数据服务Docker
difficulty: 高级
duration: 60分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据科学家
  - 数据分析师
  - 数据治理工程师
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


# Docker 实战场景

> [!abstract] 本章要点
> - ETL/ELT 脚本容器化的完整流程
> - 数据服务（API、定时任务）容器化部署
> - 用 Docker 标准化团队开发环境
> - CI/CD 流水线中使用 Docker 运行数据质量检查

---

## 场景一：ETL 脚本容器化

### 背景

你写了一个 Python ETL 脚本，从 MySQL 读数据，清洗后写入 PostgreSQL。现在要：
1. 打包成可复用的镜像
2. 支持通过环境变量配置数据源
3. 配置定时运行
4. 日志持久化

### 项目结构

```text
etl-project/
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── src/
│   ├── __init__.py
│   ├── etl_main.py
│   ├── extractors/
│   │   └── mysql_extractor.py
│   ├── transformers/
│   │   └── data_cleaner.py
│   └── loaders/
│       └── postgres_loader.py
├── config/
│   └── etl_config.yaml
├── data/
│   ├── input/
│   └── output/
└── logs/
```

### ETL 脚本示例

```python
# src/etl_main.py
import os
import logging
from datetime import datetime
import pandas as pd
import sqlalchemy

# 日志配置（输出到文件和标准输出）
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(f'/app/logs/etl_{datetime.now().strftime("%Y%m%d")}.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def get_db_config():
    """从环境变量读取数据库配置"""
    return {
        'source': {
            'host': os.environ['SOURCE_DB_HOST'],
            'port': int(os.environ.get('SOURCE_DB_PORT', 3306)),
            'user': os.environ['SOURCE_DB_USER'],
            'password': os.environ['SOURCE_DB_PASSWORD'],
            'database': os.environ['SOURCE_DB_NAME'],
        },
        'target': {
            'host': os.environ['TARGET_DB_HOST'],
            'port': int(os.environ.get('TARGET_DB_PORT', 5432)),
            'user': os.environ['TARGET_DB_USER'],
            'password': os.environ['TARGET_DB_PASSWORD'],
            'database': os.environ['TARGET_DB_NAME'],
        }
    }

def run_etl():
    config = get_db_config()
    logger.info("ETL 任务开始")

    # Extract
    source_engine = sqlalchemy.create_engine(
        f"mysql+pymysql://{config['source']['user']}:{config['source']['password']}"
        f"@{config['source']['host']}:{config['source']['port']}"
        f"/{config['source']['database']}"
    )
    df = pd.read_sql("SELECT * FROM orders WHERE date = CURDATE()", source_engine)
    logger.info(f"Extract 完成：{len(df)} 行数据")

    # Transform
    df['amount'] = df['amount'].fillna(0)
    df['created_at'] = pd.to_datetime(df['created_at'])
    logger.info("Transform 完成")

    # Load
    target_engine = sqlalchemy.create_engine(
        f"postgresql://{config['target']['user']}:{config['target']['password']}"
        f"@{config['target']['host']}:{config['target']['port']}"
        f"/{config['target']['database']}"
    )
    df.to_sql('orders_cleaned', target_engine, if_exists='append', index=False)
    logger.info(f"Load 完成：{len(df)} 行写入 DW")

if __name__ == '__main__':
    run_etl()
```

### Dockerfile

```dockerfile
# Dockerfile
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TZ=Asia/Shanghai

# 安装数据库客户端依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先装依赖（利用缓存）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 再复制代码
COPY src/ ./src/
COPY config/ ./config/

# 创建日志和数据目录
RUN mkdir -p /app/logs /app/data/input /app/data/output

# 声明挂载点
VOLUME ["/app/logs", "/app/data"]

CMD ["python", "src/etl_main.py"]
```

```text
# requirements.txt
pandas==2.1.4
sqlalchemy==2.0.25
pymysql==1.1.0
psycopg2-binary==2.9.9
loguru==0.7.2
pyyaml==6.0.1
```

### Compose 配置（一次性运行，定时调度需另配）

```yaml
# docker-compose.yml
services:

  # 数据库服务（开发测试用）
  mysql-source:
    image: mysql:8.0
    container_name: mysql-source
    environment:
      MYSQL_ROOT_PASSWORD: root123
      MYSQL_DATABASE: source_db
    volumes:
      - ./init-sql/source:/docker-entrypoint-initdb.d
    networks:
      - etl-net

  postgres-target:
    image: postgres:16
    container_name: postgres-target
    environment:
      POSTGRES_USER: dw
      POSTGRES_PASSWORD: dw123
      POSTGRES_DB: data_warehouse
    volumes:
      - ./init-sql/target:/docker-entrypoint-initdb.d
    networks:
      - etl-net

  # ETL 服务（执行一次后退出；每天运行需另配 cron 或调度系统）
  etl:
    build: .
    container_name: etl-job
    environment:
      SOURCE_DB_HOST: mysql-source
      SOURCE_DB_USER: root
      SOURCE_DB_PASSWORD: root123
      SOURCE_DB_NAME: source_db
      TARGET_DB_HOST: postgres-target
      TARGET_DB_USER: dw
      TARGET_DB_PASSWORD: dw123
      TARGET_DB_NAME: data_warehouse
    volumes:
      - ./logs:/app/logs
      - ./data:/app/data
    networks:
      - etl-net
    depends_on:
      - mysql-source
      - postgres-target
    # 任务跑完就退出，不需要 restart
    restart: "no"

networks:
  etl-net:
    driver: bridge
```

```bash
# 手动触发 ETL
docker compose run --rm etl

# 开发时，修改代码后重新构建并运行
docker compose run --rm --build etl

# 查看 ETL 日志
cat ./logs/etl_$(date +%Y%m%d).log
```

---

## 场景二：数据 API 服务容器化

### 背景

用 FastAPI 写了一个数据查询 API，需要容器化部署，连接 PostgreSQL 数据仓库。

```dockerfile
# Dockerfile
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

EXPOSE 8000

# 用 uvicorn 运行 FastAPI
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

```yaml
# docker-compose.yml
services:

  api:
    build: .
    container_name: data-api
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      DB_URL: postgresql://reader:reader123@postgres:5432/data_warehouse
      REDIS_URL: redis://:redis123@redis:6379/0
    depends_on:
      - postgres
      - redis
    networks:
      - api-net
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=5).close()"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:16
    container_name: postgres
    environment:
      POSTGRES_USER: reader
      POSTGRES_PASSWORD: reader123
      POSTGRES_DB: data_warehouse
    volumes:
      - pg-data:/var/lib/postgresql/data
    networks:
      - api-net

  redis:
    image: redis:7-alpine
    container_name: redis
    command: redis-server --requirepass redis123
    networks:
      - api-net

  # Nginx 反向代理（可选；需提供 nginx.conf，HTTPS 和负载均衡需另配证书、端口及上游）
  nginx:
    image: nginx:alpine
    container_name: nginx
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - api
    networks:
      - api-net

networks:
  api-net:
    driver: bridge

volumes:
  pg-data:
```

---

## 场景三：团队开发环境标准化

### 问题背景

团队有 5 个数据工程师，每人用不同配置的 Mac，经常出现"在你机器上能跑"的问题。

### 解决方案：一个 Compose 文件搞定所有依赖

```yaml
# docker-compose.dev.yml
# 统一的开发环境，所有人用这个文件启动依赖服务

services:

  mysql:
    image: mysql:8.0
    container_name: dev-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: dev123
      MYSQL_DATABASE: dev_db
    ports:
      - "3306:3306"
    volumes:
      - dev-mysql-data:/var/lib/mysql
      - ./dev-fixtures/mysql:/docker-entrypoint-initdb.d   # 开发测试数据
    networks:
      - dev-net

  redis:
    image: redis:7-alpine
    container_name: dev-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    networks:
      - dev-net

  kafka:
    image: bitnami/kafka:3.7
    container_name: dev-kafka
    restart: unless-stopped
    ports:
      - "9092:9092"
    environment:
      KAFKA_CFG_NODE_ID: 0
      KAFKA_CFG_PROCESS_ROLES: controller,broker
      KAFKA_CFG_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
      KAFKA_CFG_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
      KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: 0@kafka:9093
      KAFKA_CFG_CONTROLLER_LISTENER_NAMES: CONTROLLER
      ALLOW_PLAINTEXT_LISTENER: "yes"
    networks:
      - dev-net

networks:
  dev-net:
    driver: bridge

volumes:
  dev-mysql-data:
```

配合 `Makefile` 让操作更简单：

```makefile
# Makefile
.PHONY: dev-up dev-down dev-reset

# 启动开发环境
dev-up:
	docker compose -f docker-compose.dev.yml up -d
	@echo "开发环境已启动！"
	@echo "MySQL: localhost:3306 (root/dev123)"
	@echo "Redis: localhost:6379"
	@echo "Kafka: localhost:9092"

# 停止开发环境
dev-down:
	docker compose -f docker-compose.dev.yml down

# 重置开发环境（清除所有数据）
dev-reset:
	docker compose -f docker-compose.dev.yml down -v
	docker compose -f docker-compose.dev.yml up -d
	@echo "开发环境已重置"

# 查看日志
dev-logs:
	docker compose -f docker-compose.dev.yml logs -f

# 进入 MySQL
mysql-shell:
	docker exec -it dev-mysql mysql -uroot -pdev123 dev_db
```

新成员入职，一条命令搞定环境：

```bash
# 克隆项目
git clone https://github.com/company/data-platform.git
cd data-platform

# 启动开发环境
make dev-up

# 开始写代码
```

---

## 场景四：CI/CD 中使用 Docker

### GitHub Actions 中运行数据质量检查

```yaml
# .github/workflows/data-quality.yml
name: Data Quality Check

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  data-quality:
    runs-on: ubuntu-latest

    services:
      # CI 环境中启动 MySQL
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: test123
          MYSQL_DATABASE: test_db
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=5

    steps:
      - uses: actions/checkout@v4

      # 在 Docker 容器中运行测试
      - name: Run data quality checks
        run: |
          docker run --rm \
            --network host \
            -e DB_HOST=127.0.0.1 \
            -e DB_PASSWORD=test123 \
            -v ${{ github.workspace }}:/app \
            python:3.11-slim \
            sh -c "pip install -r /app/requirements.txt && python /app/tests/data_quality_test.py"

      # 构建镜像并推送
      - name: Build and push Docker image
        if: github.ref == 'refs/heads/main'
        run: |
          docker build -t $IMAGE_NAME:${{ github.sha }} .
          docker tag $IMAGE_NAME:${{ github.sha }} $IMAGE_NAME:latest
          docker push $IMAGE_NAME:latest
```

### 本地 CI 模拟（act 工具）

```bash
# 安装 act（本地运行 GitHub Actions）
brew install act

# 本地运行 CI 流水线
act push
```

---

## 场景五：大数据任务的容器化

### Spark 任务提交到 Docker 集群

```bash
# 构建包含业务代码的 Spark 镜像
cat > Dockerfile.spark <<EOF
FROM bitnami/spark:3.5
USER root
COPY spark-jobs/ /opt/spark/jobs/
RUN pip install delta-spark==3.0.0 boto3==1.34.0
USER 1001
EOF

docker build -f Dockerfile.spark -t my-spark:latest .

# 启动 Spark 集群
docker compose up -d spark-master spark-worker

# 提交任务
docker run --rm \
  --network spark_default \
  my-spark:latest \
  spark-submit \
    --master spark://spark-master:7077 \
    --conf spark.executor.memory=2g \
    /opt/spark/jobs/daily_aggregation.py \
    --date 2024-01-15
```

### Flink 任务提交

```bash
# 构建 Flink 任务镜像
cat > Dockerfile.flink <<EOF
FROM flink:1.19-scala_2.12
COPY target/my-flink-job.jar /opt/flink/jobs/
EOF

# 构建包含任务 JAR 的镜像
docker build -f Dockerfile.flink -t my-flink:latest .

# 提交任务到已启动的 Flink 集群
docker run --rm \
  --network flink_default \
  my-flink:latest \
  flink run \
    --jobmanager jobmanager:8081 \
    --class com.company.MyFlinkJob \
    /opt/flink/jobs/my-flink-job.jar
```

---

## 实战技巧汇总

### 技巧一：使用环境变量文件管理多环境

```bash
# .env.dev
DB_HOST=localhost
DB_PASSWORD=dev123
API_URL=http://localhost:8080

# .env.prod
DB_HOST=prod-db.internal
DB_PASSWORD=xxx_secure_xxx
API_URL=https://api.company.com

# 指定用于 Compose 插值的环境变量文件启动
# 容器接收变量还需在 Compose 中用 environment 引用，或配置服务级 env_file
docker compose --env-file .env.dev up -d
docker compose --env-file .env.prod up -d
```

### 技巧二：开发模式下实时热重载

```yaml
# docker-compose.dev.yml 的 app 服务
app:
  build: .
  volumes:
    - ./src:/app/src    # 挂载源码，改代码自动生效
  command: uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
  # --reload 参数：代码变化自动重启服务
```

### 技巧三：容器内调试

```bash
# 在运行中的容器里临时安装调试工具
docker exec -it my-container bash
apt-get install -y vim curl netcat-openbsd

# 测试网络连通性
docker exec my-app nc -zv mysql 3306
# 输出：Connection to mysql 3306 port [tcp/mysql] succeeded!

# 查看容器的 DNS 解析
docker exec my-app nslookup mysql
```

---

---

> [!info] 前置知识
> - [[【技术与工具】/Docker/05-Dockerfile编写|Dockerfile编写]] - 实战场景中需要自定义镜像
> - [[【技术与工具】/Docker/06-Docker Compose入门|Docker Compose入门]] - 多容器编排是实战场景的基础
> - [[【技术与工具】/Docker/08-Docker网络与存储|Docker网络与存储]] - 数据持久化和服务间通信的配置

---

## 掌握检查

- [ ] 能把一个 Python ETL 脚本打包成 Docker 镜像，并通过 cron 或调度系统定时运行
- [ ] 理解多环境配置的最佳实践：用 `.env.dev` 和 `.env.prod` 分离配置，`docker compose --env-file` 切换环境
- [ ] 能用 `docker compose exec` 在运行中的容器内执行调试命令（如进入 MySQL 执行 SQL）
- [ ] 知道如何用 Docker 快速搭建一个新同事的开发环境：克隆仓库 → `docker compose up -d` → 开始开发
- [ ] 了解 GitHub Actions 中如何用 Docker 运行数据质量检查（CI 中的容器化应用）

---

## 实践练习

**进阶题**：把你现有的一个 Python 数据处理脚本容器化：(1) 写 Dockerfile；(2) 写 `docker-compose.yml` 包含脚本容器 + MySQL 依赖；(3) 用 Compose 一键启动，验证脚本能正常访问 MySQL；(4) 用 `.env` 文件管理数据库连接配置，不在代码中硬编码。

---

## 下一步

- 速查工具：[[【技术与工具】/Docker/10-Docker常用命令速查|常用命令速查]] - 随用随查的命令手册
- 问题排查：[[【技术与工具】/Docker/11-Docker问题排查|Docker问题排查]] - 遇到报错先看这里
