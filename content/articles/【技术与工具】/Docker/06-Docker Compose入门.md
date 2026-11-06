---
title: Docker Compose入门 - 用一个文件管理完整数据开发环境
tags:
  - Docker
  - Docker Compose
  - 多容器编排
  - docker-compose.yml
  - 数据开发环境
aliases:
  - Docker Compose
  - Compose
  - docker-compose
difficulty: 中级
duration: 60分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据分析师
  - 数据科学家
  - BI分析师
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


# Docker Compose 入门

> [!abstract] 本章要点
> - 理解 Docker Compose 解决什么问题
> - docker-compose.yml 的核心配置项
> - 常用数据服务的编排示例（MySQL + Redis + Python 应用）
> - Compose 常用命令

---

## Docker Compose 解决什么问题

假设你的数据服务需要以下组件：
- MySQL：存储数据
- Redis：缓存和消息队列
- Python 应用：数据处理服务
- Nginx：反向代理

如果用 `docker run` 分别启动，需要：
1. 先建网络：`docker network create data-net`
2. 启动 MySQL：一条很长的 `docker run` 命令
3. 启动 Redis：另一条命令
4. 启动 Python 应用：还要确保它等 MySQL 就绪
5. 启动 Nginx：又一条命令

**停止的时候还要一个一个关**，换机器还要重新敲一遍。

Docker Compose 让你把所有这些定义在一个 `docker-compose.yml` 文件里：

```bash
# 一键启动所有服务
docker compose up -d

# 一键停止所有服务
docker compose down
```

---

## docker-compose.yml 结构

### 基础结构

```yaml
# docker-compose.yml
services:           # 服务定义（每个服务可运行一个或多个容器实例）
  service1:
    image: nginx
    ports:
      - "80:80"

  service2:
    build: .        # 从 Dockerfile 构建
    depends_on:
      - service1

networks:           # 自定义网络（可选）
  my-network:
    driver: bridge

volumes:            # 命名卷（可选）
  mysql-data:
```

### 核心配置项详解

```yaml
services:
  my-service:
    # --- 镜像配置 ---
    image: mysql:8.0                      # 使用已有镜像；此处仅展示配置项
    build:                                # 构建自定义镜像时配置；入门示例应按需选用 image 或 build
      context: ./backend                  # Dockerfile 所在目录
      dockerfile: Dockerfile.prod         # 指定 Dockerfile 文件名

    # --- 基本配置 ---
    container_name: mysql-dev             # 容器名（不指定则自动生成）
    restart: unless-stopped               # 重启策略

    # --- 端口 ---
    ports:
      - "127.0.0.1:3306:3306"            # 宿主机:容器，只绑定本机
      # 若确需对外开放，可改为 "3306:3306"；不要同时配置这两种绑定

    # --- 环境变量 ---
    environment:
      MYSQL_ROOT_PASSWORD: root123
      MYSQL_DATABASE: mydb
    env_file:
      - .env                              # 注入容器环境变量；文件不加密，需限制权限且勿提交到版本库

    # --- 数据挂载 ---
    volumes:
      - mysql-data:/var/lib/mysql         # 命名卷
      - ./conf/my.cnf:/etc/mysql/conf.d/my.cnf:ro  # 绑定挂载

    # --- 网络 ---
    networks:
      - backend-net

    # --- 依赖关系 ---
    depends_on:
      - zookeeper                         # 在 zookeeper 启动后再启动

    # --- 资源限制 ---
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: "1.0"

    # --- 健康检查 ---
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

    # --- 命令覆盖 ---
    command: ["--character-set-server=utf8mb4"]
```

---

## 实战示例一：MySQL + Redis + Python 应用

这是用于演示数据存储、缓存与Python应用协作的一种组合。

```yaml
# docker-compose.yml
services:

  # MySQL 数据库
  mysql:
    image: mysql:8.0
    container_name: mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: root123
      MYSQL_DATABASE: data_dev
      MYSQL_USER: dev_user
      MYSQL_PASSWORD: dev123
    ports:
      - "3306:3306"
    volumes:
      - mysql-data:/var/lib/mysql
      - ./init-sql:/docker-entrypoint-initdb.d    # 初始化 SQL 文件
    networks:
      - data-net
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-uroot", "-proot123"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  # Redis 缓存
  redis:
    image: redis:7-alpine
    container_name: redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - data-net
    command: redis-server --requirepass redis123 --appendonly yes

  # Python 数据服务
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: data-app
    restart: unless-stopped
    environment:
      DB_HOST: mysql              # 用服务名作为主机名，Docker 会自动解析
      DB_PORT: 3306
      DB_USER: dev_user
      DB_PASSWORD: dev123
      DB_NAME: data_dev
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: redis123
    ports:
      - "8080:8080"
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    networks:
      - data-net
    depends_on:
      mysql:
        condition: service_healthy  # 等待 MySQL 健康检查通过
      redis:
        condition: service_started  # 等待 Redis 启动即可

# 自定义网络（所有服务在同一个网络中，可以用服务名互相访问）
networks:
  data-net:
    driver: bridge

# 命名卷（数据持久化）
volumes:
  mysql-data:
  redis-data:
```

---

## 实战示例二：Kafka 消息队列环境

```yaml
# docker-compose-kafka.yml
services:

  # ZooKeeper（Kafka 依赖）
  zookeeper:
    image: bitnami/zookeeper:3.9
    container_name: zookeeper
    restart: unless-stopped
    ports:
      - "2181:2181"
    environment:
      ALLOW_ANONYMOUS_LOGIN: "yes"
    volumes:
      - zk-data:/bitnami/zookeeper
    networks:
      - kafka-net

  # Kafka Broker
  kafka:
    image: bitnami/kafka:3.7
    container_name: kafka
    restart: unless-stopped
    ports:
      - "9092:9092"
    environment:
      KAFKA_CFG_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_CFG_LISTENERS: INTERNAL://:29092,EXTERNAL://:9092
      KAFKA_CFG_ADVERTISED_LISTENERS: INTERNAL://kafka:29092,EXTERNAL://localhost:9092
      KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP: INTERNAL:PLAINTEXT,EXTERNAL:PLAINTEXT
      KAFKA_CFG_INTER_BROKER_LISTENER_NAME: INTERNAL
      ALLOW_PLAINTEXT_LISTENER: "yes"
    volumes:
      - kafka-data:/bitnami/kafka
    networks:
      - kafka-net
    depends_on:
      - zookeeper

  # Kafka UI（可视化管理界面）
  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    container_name: kafka-ui
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      KAFKA_CLUSTERS_0_NAME: local
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:29092
      KAFKA_CLUSTERS_0_ZOOKEEPER: zookeeper:2181
    networks:
      - kafka-net
    depends_on:
      - kafka

networks:
  kafka-net:
    driver: bridge

volumes:
  zk-data:
  kafka-data:
```

---

## 实战示例三：数据分析开发环境（Jupyter + PySpark）

```yaml
# docker-compose-jupyter.yml
services:

  jupyter:
    image: jupyter/pyspark-notebook:latest
    container_name: jupyter
    ports:
      - "8888:8888"   # Jupyter Web
      - "4040:4040"   # Spark UI
    environment:
      JUPYTER_ENABLE_LAB: "yes"
      JUPYTER_TOKEN: "mytoken123"   # 设置访问令牌，仅作本地练习示例
    volumes:
      - ./notebooks:/home/jovyan/work
      - ./data:/home/jovyan/data
    deploy:
      resources:
        limits:
          memory: 6G

  # 可选：PostgreSQL 供分析使用
  postgres:
    image: postgres:16
    container_name: postgres
    environment:
      POSTGRES_USER: analyst
      POSTGRES_PASSWORD: analyst123
      POSTGRES_DB: analytics
    ports:
      - "5432:5432"
    volumes:
      - pg-data:/var/lib/postgresql/data
      - ./init-sql:/docker-entrypoint-initdb.d

volumes:
  pg-data:
```

---

## 使用环境变量文件（.env）

把敏感信息（密码、密钥）放在 `.env` 文件中，不要硬编码在 `docker-compose.yml` 里。

```bash
# .env 文件
MYSQL_ROOT_PASSWORD=your_secure_password
MYSQL_DATABASE=production_db
REDIS_PASSWORD=your_redis_password
DB_HOST=mysql
```

```yaml
# docker-compose.yml 中引用
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE}
```

```bash
# .gitignore 中添加（不要把密码提交到 git）
.env
.env.local
.env.production
```

---

## Compose 核心命令

```bash
# --- 启动 ---

# 启动所有服务（后台运行）
docker compose up -d

# 只启动指定服务
docker compose up -d mysql redis

# 重新构建镜像后启动（代码有更新时用）
docker compose up -d --build

# 强制重新创建容器（配置有变化时用）
docker compose up -d --force-recreate

# 指定 compose 文件
docker compose -f docker-compose-kafka.yml up -d


# --- 停止 ---

# 停止并删除容器和网络（保留数据卷）
docker compose down

# 停止并删除容器、网络及声明的非外部命名卷和附属匿名卷；不删除绑定目录或外部卷
docker compose down -v

# 只停止，不删除容器
docker compose stop

# 重启所有服务
docker compose restart

# 只重启指定服务
docker compose restart mysql


# --- 查看状态 ---

# 查看服务状态
docker compose ps

# 实时查看所有服务日志
docker compose logs -f

# 查看指定服务的日志
docker compose logs -f mysql

# 查看最近 100 行日志
docker compose logs --tail 100 kafka


# --- 操作运行中的容器 ---

# 进入 MySQL 容器
docker compose exec mysql bash
docker compose exec mysql mysql -uroot -proot123

# 在容器内执行命令
docker compose exec app python manage.py migrate

# 查看容器内运行的进程
docker compose top

# 查看容器资源使用
docker compose stats


# --- 构建 ---

# 只构建镜像，不启动
docker compose build

# 构建指定服务的镜像
docker compose build app

# 不使用缓存构建
docker compose build --no-cache app
```

---

## 容器间通信

未显式指定网络的 Compose 服务默认加入同一个默认网络，可以用服务名解析地址；显式指定网络时，服务需共享网络才能按服务名互相访问。

```python
# Python 代码中，用服务名连接 MySQL
import sqlalchemy

# 服务名 "mysql" 就是主机名，不需要 IP 地址
engine = sqlalchemy.create_engine(
    "mysql+pymysql://dev_user:dev123@mysql:3306/data_dev"
)
```

```python
# 用服务名连接 Redis
import redis

r = redis.Redis(host='redis', port=6379, password='redis123')
```

```python
# 用服务名连接 Kafka
from kafka import KafkaProducer

producer = KafkaProducer(bootstrap_servers=['kafka:29092'])
```

> [!tip] 关于容器间通信的 hostname
> 服务名是共享 Compose 网络内可解析的网络别名，不等同于容器自身的 hostname。`mysql` 服务可由同网络内的客户端通过 `mysql:3306` 访问，无需写死 IP。

---

## 常见问题和技巧

### 等待依赖服务就绪

短式 `depends_on` 或 `condition: service_started` 只保证依赖容器先启动，不保证应用已经就绪。`condition: service_healthy` 会等待依赖的健康检查通过，但检查内容仍需覆盖应用实际所需的就绪条件。

```yaml
# 方案一：配合 healthcheck（推荐）
services:
  mysql:
    image: mysql:8.0
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      retries: 10

  app:
    depends_on:
      mysql:
        condition: service_healthy   # 等 MySQL 健康检查通过才启动
```

```python
# 方案二：在应用代码中加重试逻辑
# Python 示例：连接失败时重试
import time
import sqlalchemy

for i in range(10):
    try:
        engine = sqlalchemy.create_engine(DB_URL)
        engine.connect()
        break
    except Exception:
        print(f"等待数据库... 第 {i+1} 次重试")
        time.sleep(5)
```

### 查看 Compose 配置是否正确

```bash
# 验证 docker-compose.yml 语法
docker compose config

# 查看配置但不进行环境变量插值
docker compose config --no-interpolate
```

---

---

> [!info] 前置知识
> - [[【技术与工具】/Docker/04-容器基本操作|容器基本操作]] - 理解单容器操作（`docker run`/`stop`/`logs`），Compose 是它的多容器扩展
> - [[【技术与工具】/Docker/05-Dockerfile编写|Dockerfile编写]] - 如果需要自定义镜像（如 app 服务），需要先会写 Dockerfile

---

## 掌握检查

- [ ] 能写一个包含 MySQL + Redis 两个服务的 `docker-compose.yml`，并用 `docker compose up -d` 启动
- [ ] 理解短式 `depends_on` 不保证服务就绪，知道如何结合 `healthcheck` 和 `condition: service_healthy` 等待依赖健康
- [ ] 知道 `docker compose down` 和 `docker compose down -v` 的区别：后者还会删除声明的非外部命名卷及附属匿名卷，其中数据会丢失，但不会删除绑定目录或外部卷
- [ ] 能在 Compose 文件中用服务名（如 `mysql:3306`）而不是 IP 地址配置容器间通信
- [ ] 能用 `docker compose logs -f 服务名` 实时查看指定服务的日志，定位启动失败原因

---

## 实践练习

**基础题**：写一个 `docker-compose.yml`，包含 MySQL 8.0 和 Adminer（MySQL Web 管理界面），MySQL 数据挂载到宿主机目录，Adminer 端口映射到 8080。启动后用浏览器访问 Adminer，连接 MySQL 验证成功。

**进阶题**：为上面的 Compose 给 MySQL 添加 `healthcheck`，让 Adminer 服务用 `condition: service_healthy` 等待 MySQL 健康后再启动。用 `docker compose ps` 和 `docker compose logs` 观察启动顺序。

---

## 下一步

掌握了 Compose 之后，可以直接上手搭建数据开发环境：

- 继续阅读：[[【技术与工具】/Docker/07-数据开发环境搭建|数据开发环境搭建]] - 大数据组件的完整 Compose 配置
- 相关内容：[[【技术与工具】/Docker/08-Docker网络与存储|Docker网络与存储]] - 深入理解网络和数据持久化

> [!tip] 建议建立自己的 Compose 模板库
> 把常用的 `docker-compose.yml` 保存起来，做成模板。比如 `compose-mysql-redis.yml`、`compose-kafka.yml`、`compose-jupyter.yml`。下次搭环境直接复制修改，不用从零写。
