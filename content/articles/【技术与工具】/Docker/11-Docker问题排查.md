---
title: Docker问题排查 - 常见报错和解决方案
tags:
  - Docker
  - 问题排查
  - 故障排查
  - Docker报错
  - 容器调试
aliases:
  - Docker排查
  - Docker报错
  - Docker故障
difficulty: 中级
duration: 随用随查
knowledge_type: reference
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


# Docker 问题排查手册

> [!abstract] 使用方式
> 遇到报错，直接按 Ctrl+F 搜索关键词找解决方案。文档按"问题现象"组织，每个问题都提供了诊断思路和具体解决命令。

---

## 排查问题的通用思路

遇到任何 Docker 问题，先做这几步：

```bash
# 第一步：看容器状态
docker ps -a
# 如果容器是 Exited，说明主进程已退出；结合退出码和日志区分正常完成、启动失败或异常终止

# 第二步：看日志
docker logs --tail 100 容器名
# 日志通常是定位应用错误的重要线索，也需结合状态、资源和配置检查

# 第三步：看系统资源
docker stats
# 排查内存不足、CPU 异常等资源问题

# 第四步：检查配置
docker inspect 容器名
# 确认端口映射、挂载、网络配置是否正确
```

---

## 安装和启动问题

### Docker 服务无法启动

**现象**：运行任何 `docker` 命令都报错 `Cannot connect to the Docker daemon`

```bash
# 检查 Docker 服务状态
sudo systemctl status docker

# 如果未运行，启动服务
sudo systemctl start docker

# 设置开机自启
sudo systemctl enable docker

# Mac/Windows：检查 Docker Desktop 是否已启动
# 看任务栏/菜单栏是否有鲸鱼图标，如果没有手动打开 Docker Desktop
```

### permission denied

**现象**：`Got permission denied while trying to connect to the Docker daemon socket`

```bash
# 可能原因：当前用户无权访问 Docker daemon socket，先检查 socket 路径、属组和权限
# 适用于通过 docker 组授权的 Linux 安装；加入 docker 组通常等同授予宿主机 root 级权限，仅对可信用户操作
# 确认采用该授权方式后，将用户加入 docker 组
sudo usermod -aG docker $USER

# 必须重新登录才能生效（或者临时生效）
newgrp docker

# 验证
docker ps
```

---

## 镜像拉取问题

### 拉取镜像超时或失败

**现象**：`Error response from daemon: Get "https://registry-1.docker.io/v2/": dial tcp...`

```bash
# 可能原因：网络连通性、DNS、代理、防火墙或镜像仓库服务异常，需根据具体错误检查
# 解决一：配置镜像加速器（参见 [[【技术与工具】/Docker/02-Docker安装与配置|02-Docker安装与配置]]）

# 解决二：通过代理拉取（如果有代理的话）
# Mac/Windows 在 Docker Desktop Settings → Resources → Proxies 设置

# 解决三：找国内可用的镜像
# 访问阿里云、中科大、163 等镜像源手动搜索

# 验证加速器配置是否生效
docker info | grep "Registry Mirrors" -A 5
```

### 镜像不存在

**现象**：`Unable to find image 'xxx:yyy' locally`，然后拉取失败

```bash
# 原因：镜像名或标签写错了
# 解决：在 Docker Hub 网站确认正确的镜像名和标签
# https://hub.docker.com/_/mysql/tags （以 mysql 为例）

# 常见错误写法和正确写法
docker pull MySQL:8.0       # 错误：大写
docker pull mysql:8.0       # 正确

docker pull mysql:latest8   # 错误：不存在的标签
docker pull mysql:8.0       # 正确
```

---

## 容器启动失败

### 容器立即退出（Exited）

**现象**：`docker run` 后容器状态是 `Exited`，`docker ps` 看不到

```bash
# 第一步：查看退出码和日志
docker ps -a     # 看到 Exited (退出码)
docker logs 容器名

# 常见退出码含义：
# Exited (0)  - 正常退出（容器任务完成）
# Exited (1)  - 程序报错退出（看日志找原因）
# Exited (137) - 通常表示被 SIGKILL 终止，可能由 OOM、手动强杀或停止超时引起；结合 OOMKilled 和系统日志确认
# Exited (139) - 段错误（Segmentation Fault）

# 若已确认 OOM，检查宿主机可用内存、应用内存需求及原限制，再决定是否调整；以下仅展示新建容器的内存参数
docker run -m 2g mysql:8.0

# 如果是程序错误（1），看日志定位原因
docker logs --tail 50 容器名
```

### 端口被占用

**现象**：`bind: address already in use`

```bash
# 查找占用端口的进程
lsof -i:3306        # Mac/Linux
netstat -ano | findstr 3306  # Windows

# 方案一：停止占用端口的进程
kill -9 <PID>

# 方案二：换一个宿主机端口
docker run -p 13306:3306 mysql:8.0  # 用 13306 代替 3306
```

### 磁盘空间不足

**现象**：`no space left on device`

```bash
# 查看磁盘使用情况
df -h
docker system df

# 清理 Docker 占用的空间
docker system prune -a      # 删除停止的容器、未被容器使用的镜像、未使用的网络及构建缓存；先确认需保留的资源
docker volume prune         # 删除未使用的 Volume（谨慎！会丢数据）

# 如果是 Mac，Docker Desktop 的磁盘镜像文件可能需要在 Settings 中清理
```

### 挂载目录不存在或权限问题

**现象**：`Mounts denied` 或 `permission denied`

```bash
# 情况一：宿主机目录不存在（创建一下）
mkdir -p ~/docker-data/mysql
docker run -v ~/docker-data/mysql:/var/lib/mysql mysql:8.0

# 情况二：Mac 上 Bind Mount 路径未被允许
# 在 Docker Desktop Settings → Resources → File Sharing 中添加路径

# 情况三：Linux 上 SELinux 阻止访问
docker run -v /data:/data:z mysql:8.0  # 加 :z 标签
```

---

## 容器网络问题

### 容器间无法通信

**现象**：容器 A 无法访问容器 B（连接超时、拒绝连接）

```bash
# 诊断步骤

# 1. 确认两个容器在同一个网络
docker inspect 容器A | grep -A 10 "Networks"
docker inspect 容器B | grep -A 10 "Networks"

# 2. 测试网络连通性（在容器A中）
docker exec 容器A ping 容器B
docker exec 容器A nc -zv 容器B 3306    # 测试 3306 端口

# 3. 如果在不同网络，将它们连接到同一个网络
docker network create shared-net
docker network connect shared-net 容器A
docker network connect shared-net 容器B

# 4. 默认 bridge 网络不提供容器名自动 DNS 解析；无其他名称解析配置时，可查询当前 IP 测试
docker inspect 容器B | grep "IPAddress"
docker exec 容器A ping 172.17.0.3      # 用 IP 访问
```

> [!tip] 最佳实践
> 始终使用自定义网络，不要用默认的 bridge 网络。自定义网络支持用容器名/服务名互相访问，更方便。

### 宿主机无法访问容器服务

**现象**：容器已启动，但 `localhost:3306` 连不上

```bash
# 检查端口映射是否正确
docker ps           # 看 PORTS 列，应该显示 0.0.0.0:3306->3306/tcp
docker port 容器名   # 查看端口映射详情

# 如果没有端口映射，通常需重建容器并添加 -p 参数，单纯重启不能追加映射
# 先备份数据并记录原环境变量、挂载和网络；以下删除命令会删除容器可写层，后续示例须补回原配置
docker stop mysql && docker rm mysql
docker run -d -p 3306:3306 --name mysql mysql:8.0

# 检查容器是否在正常运行（可能已经退出了）
docker ps -a

# 检查防火墙（Linux）
sudo iptables -L | grep 3306
```

---

## MySQL 相关问题

### MySQL 容器启动后无法连接

**现象**：MySQL 容器状态是 Running，但连接报错

```bash
# 等待 MySQL 初始化（耗时依环境和数据量而异；初始化期间临时服务也可能输出就绪日志）
docker logs -f mysql 2>&1 | grep -m 1 "ready for connections"

# 确认 MySQL 就绪后再连接
docker exec mysql mysqladmin ping -h localhost -uroot -p

# 如果密码错误
docker logs mysql | grep "Generated temporary password"  # 有时候会生成临时密码

# 如果服务可达但报 Access denied，检查账号与连接来源是否匹配；连接被拒绝应先检查监听、端口映射和服务状态
docker exec -it mysql mysql -uroot -proot123 -e "SELECT host, user FROM mysql.user;"
# 根据实际连接来源检查 Host 匹配，不应为排障直接给 root 添加 % 授权
```

### MySQL 数据库字符集问题

**现象**：中文乱码

```bash
# 启动时指定字符集
docker run -d \
  --name mysql \
  -e MYSQL_ROOT_PASSWORD=root123 \
  mysql:8.0 \
  --character-set-server=utf8mb4 \
  --collation-server=utf8mb4_unicode_ci

# 验证字符集
docker exec mysql mysql -uroot -proot123 -e "SHOW VARIABLES LIKE 'character%';"
```

---

## Kafka 相关问题

### Kafka 容器启动后无法连接

```bash
# 查看 Kafka 启动日志
docker logs --tail 100 kafka | grep -E "ERROR|WARN|started"

# 常见原因：ADVERTISED_LISTENERS 配置不对
# 从其他机器连接 Kafka 时，advertised.listeners 必须是可访问的地址

# 本地开发（只从宿主机连接）：
-e KAFKA_CFG_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092

# 需要从其他机器连接时（替换为服务器 IP）：
-e KAFKA_CFG_ADVERTISED_LISTENERS=PLAINTEXT://192.168.1.100:9092

# 验证 Kafka 是否正常
docker exec kafka kafka-topics.sh --list --bootstrap-server localhost:9092
```

---

## 内存和性能问题

### 容器 OOM（内存不足被杀死）

**现象**：容器状态 `Exited (137)`，或日志中看到 `java.lang.OutOfMemoryError`；两者均需进一步诊断，Java 内存异常不等于容器被内核 OOM 杀死。

```bash
# 查看容器的内存使用
docker stats --no-stream 容器名

# 查看系统日志确认是否 OOM Kill
dmesg | grep -i "out of memory"      # Linux
docker inspect 容器名 | grep "OOMKilled"  # Docker 层面

# 解决：增加内存限制
docker run -m 4g --memory-swap 4g mysql:8.0

# 或者在 docker-compose.yml 中
deploy:
  resources:
    limits:
      memory: 4G
```

### 容器 CPU 占用过高

```bash
# 实时查看所有容器资源使用
docker stats

# 查看容器内的高 CPU 进程
docker exec mysql top -b -n 1

# 限制 CPU 使用
docker run --cpus="1.5" mysql:8.0      # 最多使用 1.5 个 CPU 核心
```

---

## 日志和调试

### 查看详细日志

```bash
# 查看启动日志（关键！很多问题在这里）
docker logs mysql

# 实时跟踪（观察服务启动过程）
docker logs -f mysql

# 过滤错误日志
docker logs mysql 2>&1 | grep -i "error\|exception\|fatal"

# 查看 Compose 中所有服务的日志
docker compose logs -f

# 查看某个时间段的日志
docker logs --since 2024-01-15T10:00:00 --until 2024-01-15T11:00:00 mysql
```

### 进入容器调试

```bash
# 进入运行中的容器
docker exec -it mysql bash

# 在容器内排查网络
# 仅在使用 apt 的 Debian/Ubuntu 测试容器中，以 root 权限安装；其他镜像需使用对应包管理器或独立调试容器
apt-get update && apt-get install -y curl netcat-openbsd nmap
nc -zv redis 6379           # 测试端口连通性
curl -I http://app:8080     # 测试 HTTP 服务

# 在容器内排查文件
ls -la /var/lib/mysql
cat /etc/mysql/conf.d/my.cnf

# 查看容器环境变量
env | grep -i mysql

# 在容器内查看进程
ps aux
```

---

## Docker Desktop 问题（Mac/Windows）

### Docker Desktop 启动慢或卡死

```bash
# 方法一：重启 Docker Desktop
# 点击任务栏鲸鱼图标 → Restart

# 方法二：完全重置（会丢失所有数据！）
# Docker Desktop Settings → Troubleshoot → Reset to factory defaults

# 方法三：清理占用的磁盘镜像
# Docker Desktop Settings → Troubleshoot → Clean / Purge data
```

### Docker Desktop 占用内存过多

```bash
# 在 Settings → Resources 中减少分配给 Docker 的内存
# 建议根据机器实际内存调整：
# 8GB 机器 → 给 Docker 分配 3-4GB
# 16GB 机器 → 给 Docker 分配 6-8GB
```

---

## 常用排查命令清单

```bash
# 容器状态一览
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 查看容器的 Exit Code
docker inspect 容器名 --format '{{.State.ExitCode}}'

# 查看最近发生的错误事件
docker events --filter 'type=container' --filter 'event=die' --since 1h

# 检查容器健康状态
docker inspect 容器名 --format '{{.State.Health.Status}}'

# 导出容器的文件系统（用于深入调试；不包含 Volume 或 Bind Mount 中的数据，不能作为完整数据库备份）
docker export mysql > mysql-filesystem.tar

# 查看镜像和容器的磁盘占用
docker system df -v
```

---

---

> [!info] 前置知识
> - [[【技术与工具】/Docker/04-容器基本操作|容器基本操作]] - 理解基本操作原理，排查时才知道应该看哪里
> - [[【技术与工具】/Docker/06-Docker Compose入门|Docker Compose入门]] - Compose 项目的排查有特定的命令和方式

---

## 掌握检查

- [ ] 遇到容器启动失败，第一反应是用 `docker logs 容器名` 看错误信息，而不是盲目重启
- [ ] 能读懂 `docker inspect 容器名` 的输出，找到容器的挂载配置、网络 IP、环境变量等关键信息
- [ ] 知道容器 Exit Code 的常见含义：0（正常退出）、1（一般错误，需看日志）、137（通常表示 SIGKILL 终止，需区分 OOM、手动强杀和停止超时）
- [ ] 容器间网络不通时，知道进入容器用 `nc -zv 目标服务名 端口` 测试连通性
- [ ] 能用 `docker system df` 检查磁盘占用，在磁盘快满时知道用 `docker system prune` 清理

---

## 相关文档

- [[【技术与工具】/Docker/02-Docker安装与配置|安装与配置]] - 解决安装相关问题
- [[【技术与工具】/Docker/04-容器基本操作|容器基本操作]] - 了解基本操作的原理
- [[【技术与工具】/Docker/10-Docker常用命令速查|命令速查]] - 快速查找需要的命令
