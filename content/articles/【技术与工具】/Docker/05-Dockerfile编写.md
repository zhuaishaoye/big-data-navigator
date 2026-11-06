---
title: Dockerfile编写 - 打包你的数据处理脚本
tags:
  - Docker
  - Dockerfile
  - 镜像构建
  - 多阶段构建
  - ETL容器化
aliases:
  - Dockerfile
  - 镜像构建
  - 自定义镜像
difficulty: 中级
duration: 60分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据分析师
  - 数据科学家
  - 数据架构师
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


# Dockerfile 编写

> [!abstract] 本章要点
> - 理解 Dockerfile 的核心指令（FROM/RUN/COPY/CMD/EXPOSE 等）
> - 写一个实际可用的数据处理脚本容器
> - 镜像体积优化的几个关键技巧
> - 多阶段构建简介

---

## 什么是 Dockerfile

Dockerfile 是一个文本文件，里面写着构建镜像的步骤。Docker 按照这些步骤一步一步执行，最终生成一个镜像。

可以把 Dockerfile 理解为：

> "给一台全新的 Linux 机器，按这个脚本配置好环境，然后打包成镜像。"

---

## 核心指令详解

### FROM：基础镜像

Dockerfile 的第一个构建阶段必须由 FROM 开始，用于指定基础镜像；FROM 前可以出现注释、解析器指令以及供 FROM 使用的 ARG 声明。

```dockerfile
# 从官方 Python 3.11 slim 版本开始
FROM python:3.11-slim

# 从特定的平台版本（在 Mac M 系列上构建要在 Linux 服务器上跑的镜像时用）
FROM --platform=linux/amd64 python:3.11-slim

# 多阶段构建时给阶段起名
FROM python:3.11-slim AS builder
```

**选择基础镜像的建议**：

| 镜像类型 | 示例 | 大小 | 适用场景 |
|---------|------|------|---------|
| 完整版 | `python:3.11` | ~1GB | 调试方便，功能全 |
| slim 版 | `python:3.11-slim` | ~130MB | 推荐用于生产，去掉了不必要的工具 |
| alpine 版 | `python:3.11-alpine` | ~20MB | 最小，但某些包可能装不上 |
| distroless | `gcr.io/distroless/python3` | ~50MB | 不含 shell，可减少部分攻击面；安全性仍取决于依赖、配置与更新 |

> [!tip] 数据工程推荐选 slim
> Alpine 镜像虽然小，但用的是 musl libc 而不是 glibc，很多数据处理相关的 Python 包（如 pandas、numpy、lxml）在 Alpine 上安装容易出问题。推荐优先使用 `python:3.11-slim`。

### RUN：执行命令

在构建过程中执行 Shell 命令，通常用于安装依赖。

```dockerfile
# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 包
RUN pip install pandas==2.1.0 sqlalchemy==2.0.0

# 创建目录
RUN mkdir -p /app/data /app/logs

# 设置时区
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends tzdata && \
    ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    rm -rf /var/lib/apt/lists/*
```

> [!warning] RUN 指令的重要优化原则
> 每条 `RUN` 指令都会创建一个新的镜像层。**用 `&&` 把相关命令合并成一条 RUN**，可以减少层数，并且在同一层内清理临时文件。
>
> ```dockerfile
> # 错误示范：三层，清理无效
> RUN apt-get update
> RUN apt-get install -y gcc
> RUN rm -rf /var/lib/apt/lists/*   # 这层删了，前面层的缓存还在镜像里
>
> # 正确示范：一层，清理有效
> RUN apt-get update && apt-get install -y gcc \
>     && rm -rf /var/lib/apt/lists/*
> ```

### COPY 和 ADD：复制文件

```dockerfile
# COPY：从构建上下文复制文件到镜像
COPY requirements.txt /app/requirements.txt
COPY src/ /app/src/
# 复制所有文件（配合 .dockerignore 使用）
COPY . /app/

# ADD：功能比 COPY 多，但一般用 COPY
# ADD 可以自动解压 tar 文件，可以从 URL 下载
# 自动解压本地 tar 归档
ADD archive.tar.gz /app/
# 从 URL 下载（不推荐）
ADD https://example.com/file /app/file
```

> [!note] 推荐使用 COPY 而不是 ADD
> 除非需要自动解压功能，否则始终使用 COPY。COPY 的行为更明确，不会有意外。

### WORKDIR：设置工作目录

```dockerfile
# 设置容器内的当前工作目录
WORKDIR /app

# 后续 RUN 的工作目录、COPY 的相对目标路径及 CMD 的运行目录以此为准
# 等同于 COPY . /app/
COPY . .
RUN ls -la      # 列出 /app 的内容
```

### ENV：设置环境变量

```dockerfile
# 设置环境变量（构建时和运行时都生效）
ENV PYTHONPATH=/app
# Python 输出不缓冲，日志实时显示
ENV PYTHONUNBUFFERED=1
# 时区；是否生效还取决于镜像中的时区数据和应用行为
ENV TZ=Asia/Shanghai
ENV APP_ENV=production

# 多个变量
ENV JAVA_HOME=/usr/lib/jvm/java-11 \
    SPARK_HOME=/opt/spark \
    PATH=$PATH:/opt/spark/bin
```

### EXPOSE：声明端口

```dockerfile
# 声明容器监听的端口（只是文档性质，不会自动开放）
EXPOSE 8080
EXPOSE 5432
# 多个端口
EXPOSE 9092 9093
```

> [!note] EXPOSE 只是声明，不是发布
> EXPOSE 只是告诉使用者"这个容器会用这些端口"，并不会自动把端口映射到宿主机。实际开放端口还需要 `docker run -p` 指定。

### CMD 和 ENTRYPOINT：容器启动命令

```dockerfile
# CMD：容器默认执行的命令（可以被 docker run 后面的命令覆盖）
CMD ["python", "main.py"]

# ENTRYPOINT：容器入口点（一般不会被覆盖）
ENTRYPOINT ["python", "main.py"]

# 组合使用：ENTRYPOINT 固定程序，CMD 提供默认参数
ENTRYPOINT ["python", "etl_job.py"]
# 可以在 docker run 时覆盖参数
CMD ["--date", "today"]
```

| | CMD | ENTRYPOINT |
|-|-----|------------|
| 能否被 `docker run` 后的命令覆盖 | 是 | 否（除非用 `--entrypoint` 参数） |
| 适合场景 | 提供默认命令或参数 | 固定容器的主程序 |
| 推荐格式 | JSON 数组 `["python", "app.py"]` | JSON 数组 `["python", "app.py"]` |

### ARG：构建参数

```dockerfile
# 只在构建时可用，运行时不存在
ARG PYTHON_VERSION=3.11
FROM python:${PYTHON_VERSION}-slim

ARG APP_VERSION=1.0.0
LABEL version="${APP_VERSION}"

# 构建时传入参数
# docker build --build-arg PYTHON_VERSION=3.12 .
```

---

## 实战：数据工程常用 Dockerfile

### 示例一：Python ETL 脚本镜像

```dockerfile
# Dockerfile
FROM python:3.11-slim

# 可通过 --build-arg 传入版本并记录到镜像标签元数据
ARG APP_VERSION=1.0.0
LABEL version="${APP_VERSION}"

# 设置环境变量
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TZ=Asia/Shanghai \
    PYTHONPATH=/app

# 安装系统依赖（按需保留）
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 先复制依赖文件（利用 Docker 缓存层加速构建）
COPY requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir gunicorn

# 复制项目文件
COPY src/ ./src/
COPY config/ ./config/

# 声明数据目录为挂载点
VOLUME ["/app/data", "/app/logs"]

# 容器启动命令
CMD ["python", "src/etl_main.py"]
```

对应的 `requirements.txt`：

```text
pandas==2.1.4
sqlalchemy==2.0.25
psycopg2-binary==2.9.9
requests==2.31.0
loguru==0.7.2
```

构建和运行：

```bash
# 构建镜像
docker build -t my-etl:v1.0 .

# 带参数构建
docker build --build-arg APP_VERSION=1.0.0 -t my-etl:v1.0 .

# 运行 ETL（挂载数据目录）
docker run --rm \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  -e DB_HOST=192.168.1.100 \
  -e DB_PASSWORD=secret \
  my-etl:v1.0
```

### 示例二：Spark 任务镜像（基于 Bitnami 提供的 Spark 镜像）

```dockerfile
FROM bitnami/spark:3.5

# 切换到 root 安装额外依赖
USER root

# 安装额外的 Python 包
RUN pip install --no-cache-dir \
    pyspark==3.5.0 \
    delta-spark==3.0.0 \
    boto3==1.34.0

# 复制 PySpark 脚本
COPY spark_jobs/ /opt/spark/jobs/
COPY config/ /opt/spark/conf/

# 切换回非 root 用户
USER 1001

# Spark 任务入口
CMD ["spark-submit", \
     "--master", "local[*]", \
     "/opt/spark/jobs/data_processing.py"]
```

### 示例三：Jupyter 数据分析环境（带自定义包）

```dockerfile
FROM jupyter/pyspark-notebook:latest

# 以 root 安装系统依赖
USER root
RUN apt-get update && apt-get install -y \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 切换回 jovyan 用户安装 Python 包
USER jovyan

RUN pip install --no-cache-dir \
    pyarrow==14.0.0 \
    connectorx==0.3.2 \
    great-expectations==0.18.0 \
    plotly==5.18.0

# 预置常用配置
COPY jupyter_config/ /home/jovyan/.jupyter/

# Jupyter 默认监听 8888
EXPOSE 8888
```

---

## .dockerignore 文件

和 `.gitignore` 类似，`.dockerignore` 告诉 Docker 在构建时忽略哪些文件，避免把不必要的文件复制进镜像。

```text
# .dockerignore
.git
.gitignore
.env
.env.local
__pycache__
*.pyc
*.pyo
*.log
*.tmp
.DS_Store
node_modules/
data/
tests/
docs/
*.md
.pytest_cache/
.mypy_cache/
dist/
build/
```

> [!tip] .dockerignore 的重要性
> 如果没有 `.dockerignore`，`COPY . /app` 会把 `.git` 目录、测试数据、日志文件都复制进镜像，导致镜像体积虚高。数据工程项目中，`data/` 目录可能非常大，一定要加到 `.dockerignore` 中。

---

## 镜像构建缓存机制

Docker 构建镜像时，每条指令的结果都会被缓存。如果这条指令和上下文没有变化，下次构建会直接复用缓存，大幅加快速度。

**关键原则：把变化频繁的指令放后面**

```dockerfile
# 好的写法：依赖不常变，代码经常变
FROM python:3.11-slim
WORKDIR /app

# 第一步：复制依赖文件（requirements.txt、前置构建状态及相关指令未变且缓存可用时，后面的 pip install 可复用缓存）
COPY requirements.txt .
RUN pip install -r requirements.txt    # 缓存层，通常几分钟

# 第二步：复制代码（代码经常变，但不会影响前面的缓存）
COPY src/ ./src/
COPY config/ ./config/

CMD ["python", "src/main.py"]


# 坏的写法：每次代码变动都要重新 pip install
FROM python:3.11-slim
WORKDIR /app
# 代码变了，这层缓存失效
COPY . .
RUN pip install -r requirements.txt  # 每次都重新安装，很慢！
```

---

## 多阶段构建（了解）

多阶段构建可以显著减小最终镜像的体积，将构建环境和运行环境分离。

```dockerfile
# 阶段一：构建环境（包含编译工具）
FROM python:3.11 AS builder

WORKDIR /build
COPY requirements.txt .

# 安装依赖到独立目录
RUN pip install --no-cache-dir --target=/build/deps -r requirements.txt


# 阶段二：运行环境（只包含运行所需）
FROM python:3.11-slim AS runtime

WORKDIR /app

# 只从构建阶段复制安装好的依赖
COPY --from=builder /build/deps /usr/local/lib/python3.11/site-packages/

# 复制应用代码
COPY src/ ./src/

CMD ["python", "src/main.py"]

# 最终镜像只有 slim 基础镜像 + 依赖 + 代码，没有编译工具
```

---

## 构建命令速查

```bash
# 基础构建（在 Dockerfile 所在目录执行）
docker build -t myapp:v1.0 .

# 指定 Dockerfile 位置
docker build -f ./docker/Dockerfile.prod -t myapp:v1.0 .

# 构建时不使用缓存（排查问题时用）
docker build --no-cache -t myapp:v1.0 .

# 查看构建过程详情
docker build --progress=plain -t myapp:v1.0 .

# 给镜像打多个标签
docker build -t myapp:v1.0 -t myapp:latest .

# 构建后立即运行验证
docker build -t myapp:v1.0 . && docker run --rm myapp:v1.0

# 查看镜像各层大小
docker history myapp:v1.0
```

---

## 最佳实践总结

| 实践 | 说明 |
|------|------|
| 使用 slim 基础镜像 | 减小体积，减少安全漏洞面 |
| 合并 RUN 指令 | 减少层数，在同层清理临时文件 |
| 先 COPY 依赖文件 | 利用构建缓存，加快重复构建 |
| 添加 .dockerignore | 避免不必要文件进入镜像 |
| 固定依赖版本 | 提高构建可重现性；还需锁定传递依赖、基础镜像摘要并控制构建环境 |
| 使用非 root 用户 | 安全性最佳实践 |
| 一个容器只做一件事 | 便于维护和扩展 |

---

---

> [!info] 前置知识
> - [[【技术与工具】/Docker/04-容器基本操作|容器基本操作]] - 会用 `docker run`，理解容器和镜像的关系
> - [[【技术与工具】/Docker/03-镜像管理|镜像管理]] - 了解镜像分层机制，帮助理解 Dockerfile 的每条指令如何生成新层

---

## 掌握检查

- [ ] 能写出一个包含 `FROM`、`WORKDIR`、`COPY`、`RUN`、`CMD` 的基础 Python 应用 Dockerfile
- [ ] 理解为什么要先 `COPY requirements.txt` 再 `RUN pip install`，再 `COPY . .`（充分利用构建缓存）
- [ ] 知道 `.dockerignore` 的作用，能列出哪些文件应该被排除（`*.pyc`、`data/`、`.git/`、`__pycache__/`）
- [ ] 理解多阶段构建的价值：用 builder 阶段安装编译依赖，final 阶段只保留运行时，大幅缩小镜像体积
- [ ] 知道为什么生产镜像应该用非 root 用户运行（安全最佳实践）

---

## 实践练习

**基础题**：为一个 Python ETL 脚本编写 Dockerfile：基础镜像用 `python:3.11-slim`，安装 `pandas` 和 `sqlalchemy`，把脚本复制进去，设置 CMD 运行脚本。构建后用 `docker images` 查看镜像大小，用 `docker history` 查看层数。

**进阶题**：将上面的 Dockerfile 改为多阶段构建（builder 阶段用完整 Python 安装依赖，runtime 阶段用 slim 只复制依赖），对比两个版本的镜像体积差异，理解多阶段构建的意义。

---

## 下一步

- 继续阅读：[[【技术与工具】/Docker/06-Docker Compose入门|Docker Compose入门]] - 学会用一个文件管理多个容器
- 相关内容：[[【技术与工具】/Docker/09-Docker实战场景|Docker实战场景]] - 数据工程的完整容器化案例
