---
title: Docker网络与存储 - 容器间通信和数据持久化
tags:
  - Docker
  - Docker网络
  - Docker存储
  - Volume
  - Bridge网络
  - 数据持久化
aliases:
  - Docker网络
  - Docker存储
  - 容器网络
  - Volume数据卷
difficulty: 中级
duration: 45分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据科学家
  - 数据治理工程师
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


# Docker 网络与存储

> [!abstract] 本章要点
> - 容器网络的三种模式：bridge、host、none
> - 容器间如何互相通信
> - Volume vs Bind Mount：数据持久化的两种方式
> - 数据工程中的存储最佳实践

---

## Docker 网络

### 为什么要理解网络

数据工程场景下经常需要多个容器协同工作：Python 应用连接 MySQL，Flink 读 Kafka，Spark 写 HDFS。要让它们能互相"找到"对方，就需要理解 Docker 网络。

### 查看网络

```bash
# 查看所有 Docker 网络
docker network ls

# 默认输出：
# NETWORK ID     NAME      DRIVER    SCOPE
# 3a5d8c4b1234   bridge    bridge    local
# f7e9c2a3456b   host      host      local
# 8b1c4d2e789f   none      null      local
```

---

## 三种网络模式

### 1. bridge 模式（默认，最常用）

Bridge 模式下，Docker 为网络创建虚拟网桥；默认 bridge 通常使用 `docker0`，自定义 bridge 使用各自的网桥。同一网络内的容器通常可以互相通信，容器具有独立的网络命名空间，但这不代表容器与宿主机之间完全不可通信。

```bash
# 不指定网络时，默认使用 bridge 模式
docker run -d --name mysql mysql:8.0

# 查看容器的 IP 地址（在默认 bridge 网络下）
docker inspect --format '{{.NetworkSettings.IPAddress}}' mysql
# 输出：172.17.0.2

# 从另一个容器访问（在同一默认 bridge 网络下，只能用 IP 不能用名字）
docker exec my-app ping 172.17.0.2
```

> [!warning] 默认 bridge 网络不支持 DNS 解析
> 在默认的 `bridge` 网络中，容器之间只能通过 IP 互访，不能用容器名。这个 IP 会变化，很不方便。
>
> **解决方案：创建自定义 bridge 网络**，自定义网络支持容器名 DNS 解析。

### 自定义 bridge 网络（推荐）

```bash
# 创建自定义网络
docker network create data-net

# 把容器加入自定义网络
docker run -d --name mysql --network data-net mysql:8.0
docker run -d --name app --network data-net my-app:latest

# 现在 app 可以用 "mysql" 这个名字访问数据库
docker exec app ping mysql    # 需 app 镜像包含 ping、mysql 容器正常运行且网络允许 ICMP；数据库连接仍需另行验证

# 查看网络详情
docker network inspect data-net

# 删除网络
docker network rm data-net
```

```bash
# 将已运行的容器加入网络
docker network connect data-net existing-container

# 将容器从网络中断开
docker network disconnect data-net existing-container
```

### 2. host 模式

在原生 Linux Docker Engine 中，容器共享宿主机的网络命名空间，不具备独立的网络命名空间隔离；可减少部分网络转发开销，但性能收益取决于实际负载。

```bash
# 使用 host 网络：原生 Linux 支持；Docker Desktop 是否支持及是否需启用，应按所用版本确认
docker run -d --network host nginx

# 这时 nginx 直接监听宿主机的 80 端口，不需要 -p 参数
```

| 模式 | 性能 | 隔离性 | 适用场景 |
|------|------|--------|---------|
| bridge（自定义） | 中等 | 好 | 多容器应用（推荐） |
| host | 需实测，可能减少转发开销 | 无独立网络命名空间隔离 | 网络性能敏感的场景（须确认平台支持） |
| none | - | 无外部网络接口，保留回环接口 | 不需要网络的批处理任务 |

### 3. none 模式

容器仅保留回环接口，不连接外部网络；这不等于文件系统、进程等所有方面都完全隔离。适合不需要外部网络的数据处理任务。

```bash
docker run --rm --network none python:3.11-slim python etl_local.py
```

---

## 容器间通信实战

### Compose 中的服务通信（最简单）

在 Docker Compose 里，同一个 Compose 文件中的服务默认在同一个自定义网络中，直接用服务名访问：

```yaml
services:
  mysql:
    image: mysql:8.0
    # 同一 Compose 网络中的其他服务可通过服务名 "mysql" 访问；这不等同于设置容器 hostname

  app:
    build: .
    environment:
      DB_HOST: mysql      # 直接写服务名，Docker 自动解析 IP
      DB_PORT: 3306
```

```python
# Python 代码中
import sqlalchemy
engine = sqlalchemy.create_engine("mysql+pymysql://root:root123@mysql:3306/db")
```

### 跨 Compose 文件通信

当多个 Compose 文件需要共享服务时：

```yaml
# compose-a.yml：定义共享网络
networks:
  shared-net:
    name: shared-network    # 固定网络名

services:
  mysql:
    image: mysql:8.0
    networks:
      - shared-net
```

```yaml
# compose-b.yml：加入已有网络
networks:
  shared-net:
    external: true          # 使用外部已创建的网络
    name: shared-network

services:
  app:
    build: .
    networks:
      - shared-net
    environment:
      DB_HOST: mysql        # 可以访问 compose-a 中的 mysql
```

---

## Docker 存储

容器的可写层随容器删除而丢失；独立挂载的 Volume 或 Bind Mount 数据不随普通容器删除操作一起删除。数据工程中需要保留的数据应使用持久化存储。

Docker 提供两种持久化方式：

```text
持久化方式
├── Volume（命名卷）        Docker 管理的存储
│   ├── 存放在 Docker 内部区域
│   ├── 通过 docker volume 命令管理
│   └── 适合数据库数据、应用状态等
│
└── Bind Mount（绑定挂载）  宿主机目录直接挂载
    ├── 宿主机任意目录
    ├── 可以直接用文件管理器访问
    └── 适合配置文件、代码、日志等
```

### Volume（命名卷）

```bash
# 创建 Volume
docker volume create mysql-data

# 使用 Volume；挂载格式为 Volume名:容器路径
# 首次初始化 MySQL 还需配置密码，见后文持久化场景
docker run -d \
  --name mysql \
  -v mysql-data:/var/lib/mysql \
  mysql:8.0

# 查看所有 Volume
docker volume ls

# 查看 Volume 详情（包括物理存放路径）
docker volume inspect mysql-data

# 删除 Volume（先确保没有容器在用）
docker volume rm mysql-data

# 清理未使用的 Volume（危险！会丢数据）；默认清理范围依 Docker 版本与选项而异，不能据此认为会删除全部未使用命名卷，先查看 docker volume prune --help
docker volume prune
```

Volume 的物理位置：
- Linux：默认 rootful、本地卷驱动且未修改 Docker 数据目录时，通常为 `/var/lib/docker/volumes/mysql-data/_data`；以 `docker volume inspect` 的结果为准
- Mac（在 VM 里）：通过 Docker Desktop 的 Volumes 标签查看

### Bind Mount（绑定挂载）

```bash
# 挂载宿主机目录到容器；挂载格式为宿主机绝对路径:容器路径
# 首次初始化 MySQL 还需配置密码，见后文持久化场景
docker run -d \
  --name mysql \
  -v /home/user/mysql-data:/var/lib/mysql \
  mysql:8.0

# 挂载配置文件（只读）
docker run -d \
  --name nginx \
  -v /home/user/nginx.conf:/etc/nginx/nginx.conf:ro \
  nginx

# 挂载当前目录下的 scripts 文件夹
docker run --rm \
  -v $(pwd)/scripts:/app/scripts \
  python:3.11-slim \
  python /app/scripts/process.py
```

### Volume vs Bind Mount 怎么选

| 场景 | 推荐方式 | 原因 |
|------|---------|------|
| 数据库数据（MySQL、PostgreSQL） | Volume | Docker 管理，通常便于持久化与跨平台使用；性能取决于平台和底层存储 |
| 配置文件 | Bind Mount | 方便在宿主机直接编辑 |
| 开发代码 | Bind Mount | 代码改了容器立即生效 |
| 日志文件 | Bind Mount | 方便宿主机直接查看 |
| 数据处理的输入/输出文件 | Bind Mount | 方便在宿主机查看处理结果 |

---

## 存储实战：数据工程场景

### 场景一：MySQL 数据持久化

```bash
# 方案一：Volume（推荐）
docker run -d \
  --name mysql \
  -e MYSQL_ROOT_PASSWORD=root123 \
  -p 3306:3306 \
  -v mysql-data:/var/lib/mysql \
  mysql:8.0

# 方案二：Bind Mount（方便备份）
mkdir -p ~/db-data/mysql
docker run -d \
  --name mysql \
  -e MYSQL_ROOT_PASSWORD=root123 \
  -p 3306:3306 \
  -v ~/db-data/mysql:/var/lib/mysql \
  mysql:8.0

# 冷备数据：必须先干净停止使用该目录的 MySQL，确认没有其他写入者，再执行 tar；运行中的数据库目录不能直接这样备份
tar -czf mysql-backup-$(date +%Y%m%d).tar.gz ~/db-data/mysql/
```

### 场景二：ETL 脚本与数据文件共享

```bash
# 项目目录结构
etl-project/
├── scripts/
│   └── etl_job.py
├── data/
│   ├── input/
│   │   └── source.csv
│   └── output/        # ETL 输出到这里
└── logs/

# 运行 ETL 容器，挂载所需目录
docker run --rm \
  -v $(pwd)/scripts:/app/scripts \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  -e INPUT_PATH=/app/data/input/source.csv \
  -e OUTPUT_PATH=/app/data/output/ \
  my-etl:latest \
  python /app/scripts/etl_job.py
```

### 场景三：Volume 备份与恢复

```bash
# 冷备 Volume 到 tar 文件：先干净停止使用 mysql-data 的数据库，并确认没有其他写入者；此命令不提供在线数据库一致性备份
docker run --rm \
  -v mysql-data:/source \
  -v $(pwd):/backup \
  busybox \
  tar czf /backup/mysql-data-backup.tar.gz -C /source .

# 恢复 Volume 数据：仅在数据库停止且目标卷数据目录为空时执行；不要覆盖正在使用或已有数据库文件的卷，恢复后须检查权限、版本兼容性并验证数据
docker run --rm \
  -v mysql-data:/target \
  -v $(pwd):/backup \
  busybox \
  tar xzf /backup/mysql-data-backup.tar.gz -C /target
```

---

## 网络和存储配置总结

### Compose 文件中的完整配置

```yaml
services:
  mysql:
    image: mysql:8.0
    networks:
      - backend         # 加入后端网络
    volumes:
      - mysql-data:/var/lib/mysql      # 数据 Volume
      - ./conf/my.cnf:/etc/mysql/conf.d/my.cnf:ro  # 配置 Bind Mount

  app:
    build: .
    networks:
      - backend         # 与 MySQL 同网络，可以用 "mysql" 访问
      - frontend        # 同时也在前端网络
    volumes:
      - ./src:/app/src  # 代码 Bind Mount（开发模式）
      - app-logs:/app/logs  # 日志 Volume

networks:
  backend:
    driver: bridge
  frontend:
    driver: bridge

volumes:
  mysql-data:           # 命名 Volume，Docker 自动管理
  app-logs:
```

---

## 常见问题

### 问题一：容器删除后数据丢失

原因：使用了容器内部存储，没有挂载 Volume 或 Bind Mount。

解决：始终为有状态的服务（数据库、消息队列）配置 Volume。

### 问题二：Bind Mount 权限问题（Linux）

```bash
# 容器内以 root 创建的文件，宿主机上可能无权修改
# 可选方案：镜像支持任意 UID/GID 且挂载目录权限匹配时，以当前用户身份运行
# --user 指定运行用户，但不会自动修复目录所有权或 SELinux 等限制
docker run -d \
  --user $(id -u):$(id -g) \
  -v $(pwd)/output:/app/output \
  my-app:latest
```

### 问题三：Mac 上 Bind Mount 性能慢

Mac 上 Docker 运行在虚拟机中，Bind Mount 涉及虚拟机和宿主机之间的文件同步，性能较差。

解决方案：
- 对于数据库等 I/O 密集型服务，改用 Volume
- 在 Docker Desktop Settings → Resources → File Sharing 中调整挂载选项

---

---

> [!info] 前置知识
> - [[【技术与工具】/Docker/06-Docker Compose入门|Docker Compose入门]] - Compose 的 `networks:` 和 `volumes:` 配置是本文的实践载体
> - [[【技术与工具】/Docker/04-容器基本操作|容器基本操作]] - 理解容器生命周期，才能理解为什么需要 Volume 持久化

---

## 掌握检查

- [ ] 能说出 bridge、host、none 三种网络模式的适用场景，知道 Compose 默认创建 bridge 网络
- [ ] 理解 Volume 和 Bind Mount 的核心区别：Volume 由 Docker 管理（生产推荐），Bind Mount 直接挂载宿主机目录（开发调试时方便）
- [ ] 能说出为什么数据库容器需要持久化存储（可选择 Volume 或正确配置的 Bind Mount），而不应该仅把需保留的数据放在容器可写层
- [ ] 遇到 Linux 上 Bind Mount 权限问题（容器写不了宿主机目录），能检查目录权限、UID/GID 与安全策略，并在镜像支持时尝试 `--user $(id -u):$(id -g)`
- [ ] 能用 `docker network inspect <网络名>` 查看网络中的容器和 IP 分配情况

---

## 实践练习

**基础题**：创建一个 Docker Volume（`docker volume create mydata`），启动一个 MySQL 容器挂载该 Volume，写入几条数据，然后停止并删除容器，再启动一个新的 MySQL 容器挂载同一个 Volume，验证数据依然存在。

**进阶题**：创建两个 Docker 网络（`frontend` 和 `backend`），启动三个容器：app（同时连接两个网络）、db（只连 backend）、nginx（只连 frontend）。验证 app 能访问 db，但 nginx 不能访问 db（隔离效果）。

---

## 下一步

- 继续阅读：[[【技术与工具】/Docker/09-Docker实战场景|Docker实战场景]] - 把网络和存储知识用到实际场景
- 速查工具：[[【技术与工具】/Docker/10-Docker常用命令速查|常用命令速查]] - 快速查找需要的命令
