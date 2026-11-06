---
title: Docker常用命令速查 - 按场景分类的命令手册
tags:
  - Docker
  - 命令速查
  - Docker命令
  - 速查表
aliases:
  - Docker命令
  - Docker速查
  - Docker cheatsheet
difficulty: 中级
duration: 随用随查
knowledge_type: reference
target_audience:
  - 数据开发工程师
  - 数据架构师
  - 数据科学家
  - 数据分析师
  - BI分析师
  - 数据运营
  - 数据治理工程师
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


# Docker 常用命令速查

> [!abstract] 使用说明
> 本文按使用场景分类整理 Docker 常用命令，用于日常工作中快速查找。不需要从头读，遇到需要的场景直接跳过来找命令。

---

## 镜像操作

```bash
# ===== 拉取镜像 =====
docker pull mysql:8.0                          # 拉取指定版本
docker pull python:3.11-slim                   # 拉取 slim 版本

# ===== 查看镜像 =====
docker images                                  # 列出所有本地镜像
docker images mysql                            # 过滤显示 mysql 镜像
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"  # 自定义格式

# ===== 删除镜像 =====
docker rmi mysql:8.0                           # 删除指定镜像
docker rmi $(docker images -q)                 # 尝试删除所有本地镜像；被容器引用等情况可能失败（危险！）
docker image prune                             # 删除悬空镜像
docker image prune -a                          # 删除所有未使用镜像

# ===== 镜像信息 =====
docker inspect mysql:8.0                       # 查看镜像详细信息
docker history mysql:8.0                       # 查看镜像构建历史

# ===== 镜像导入导出 =====
docker save mysql:8.0 -o mysql_8.0.tar         # 导出为文件
docker save mysql:8.0 | gzip > mysql.tar.gz    # 导出并压缩
docker load -i mysql_8.0.tar                   # 导入镜像
docker load -i mysql.tar.gz                    # 导入压缩镜像

# ===== 镜像标签 =====
docker tag mysql:8.0 my-registry/mysql:8.0     # 给镜像打标签
docker push my-registry/mysql:8.0              # 推送到仓库

# ===== 镜像构建 =====
docker build -t myapp:v1.0 .                   # 构建镜像
docker build -f Dockerfile.prod -t myapp .     # 指定 Dockerfile
docker build --no-cache -t myapp .             # 不使用缓存构建
docker build --progress=plain -t myapp .       # 显示详细构建日志
```

---

## 容器操作

### 启动容器

```bash
# 最常用的启动方式（仅作隔离测试示例）
# -d 后台运行，--name 命名；-e 设置环境变量；-p 设置端口映射
# 两个 -v 分别设置 Volume 挂载和 Bind Mount；--restart 设置重启策略
# root123 是示例密码；3306:3306 默认可能绑定所有宿主机接口
 docker run -d --name mysql \
  -e MYSQL_ROOT_PASSWORD=root123 \
  -p 3306:3306 \
  -v mysql-data:/var/lib/mysql \
  -v "$(pwd)/conf:/etc/mysql/conf.d" \
  --restart unless-stopped \
  mysql:8.0

# 交互式运行（进入容器终端）
docker run -it --rm ubuntu:22.04 bash          # --rm 退出后自动删除

# 运行一次性任务
docker run --rm python:3.11-slim python -c "print('hello')"

# 带资源限制
docker run -d --memory="2g" --cpus="1.5" nginx

# 指定网络
docker run -d --network my-net nginx

# 指定用户
docker run -d --user 1000:1000 nginx           # 仅在镜像目录权限与启动配置适配该 UID/GID 时使用，否则可能启动失败
```

### 容器生命周期

```bash
# 查看容器
docker ps                                      # 运行中的容器
docker ps -a                                   # 所有容器（包括已停止）
docker ps -q                                   # 只显示 ID
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 停止/启动/重启
docker stop mysql                              # 发送停止信号（默认 SIGTERM，可配置），超时后发送 SIGKILL
docker kill mysql                              # 强制停止（SIGKILL）
docker start mysql                             # 启动已停止的容器
docker restart mysql                           # 重启容器
docker pause mysql                             # 暂停容器
docker unpause mysql                           # 恢复暂停的容器

# 删除容器
docker rm mysql                                # 删除已停止的容器
docker rm -f mysql                             # 强制删除（包括运行中的）
docker container prune                         # 删除所有已停止的容器
docker rm $(docker ps -aq)                     # 尝试删除所有容器；运行中的容器会报错，列表为空时也会报错
```

### 进入容器和执行命令

```bash
# 进入容器
docker exec -it mysql bash                     # 进入 bash（推荐）
docker exec -it mysql /bin/sh                  # 进入 sh（bash 不存在时用）
docker exec -u root -it mysql bash             # 以 root 进入

# 在容器内执行命令
docker exec mysql mysql -uroot -proot123 -e "SHOW DATABASES;"
docker exec mysql ps aux
docker exec mysql ls /var/lib/mysql

# 附加到容器主进程（用 Ctrl+P Ctrl+Q 退出，不要用 Ctrl+C）
docker attach mysql
```

### 容器信息

```bash
# 查看容器详情
docker inspect mysql                           # 全部信息（JSON）
docker inspect --format '{{range $name, $net := .NetworkSettings.Networks}}{{$name}}: {{$net.IPAddress}} {{end}}' mysql  # 各网络的 IPv4 地址
docker inspect --format '{{.State.Status}}' mysql               # 状态

# 查看日志
docker logs mysql                              # 全部日志
docker logs -f mysql                           # 实时跟踪
docker logs --tail 100 mysql                   # 最后 100 行
docker logs --tail 100 -f mysql                # 最后 100 行并跟踪
docker logs --since 1h mysql                   # 最近 1 小时的日志
docker logs -t mysql                           # 带时间戳

# 资源监控
docker stats                                   # 所有容器实时资源
docker stats mysql redis                       # 指定容器
docker top mysql                               # 容器内的进程

# 端口映射
docker port mysql                              # 查看端口映射情况
```

### 文件操作

```bash
# 复制文件
docker cp mysql:/etc/mysql/my.cnf ./my.cnf     # 容器 → 宿主机
docker cp ./my.cnf mysql:/etc/mysql/conf.d/    # 宿主机 → 容器

# 查看文件系统变化
docker diff mysql
```

---

## Docker Compose 操作

```bash
# ===== 启动 =====
docker compose up -d                           # 后台启动所有服务
docker compose up -d mysql redis               # 只启动指定服务
docker compose up -d --build                   # 重新构建后启动
docker compose up -d --force-recreate          # 强制重新创建容器
docker compose -f docker-compose.prod.yml up -d  # 指定文件

# ===== 停止 =====
docker compose down                            # 停止并删除容器和网络
docker compose down -v                         # 同时删除 Volume
docker compose stop                            # 只停止容器（不删除）
docker compose restart                         # 重启所有服务
docker compose restart mysql                   # 重启指定服务

# ===== 查看 =====
docker compose ps                              # 服务状态
docker compose logs -f                         # 所有服务日志
docker compose logs -f mysql                   # 指定服务日志
docker compose logs --tail 50 kafka            # 最后 50 行
docker compose top                             # 所有容器进程

# ===== 操作 =====
docker compose exec mysql bash                 # 进入容器
docker compose exec mysql mysql -uroot -p      # 执行命令
docker compose run --rm app python script.py   # 临时运行

# ===== 构建 =====
docker compose build                           # 构建所有镜像
docker compose build app                       # 构建指定服务镜像
docker compose build --no-cache app            # 不使用缓存构建

# ===== 配置验证 =====
docker compose config                          # 验证并显示配置
```

---

## 镜像仓库

```bash
# 登录/登出
docker login                                   # 登录 Docker Hub
docker login registry.aliyuncs.com            # 登录阿里云
docker logout                                  # 登出

# 搜索镜像
docker search mysql                            # 搜索
docker search --filter is-official=true mysql  # 只看官方镜像
docker search --limit 5 kafka                  # 限制条数
```

---

## 网络操作

```bash
# 查看网络
docker network ls                              # 列出所有网络
docker network inspect my-network             # 查看网络详情

# 创建/删除网络
docker network create data-net                 # 创建 bridge 网络
docker network inspect host                  # 查看已有 host 网络；使用时指定 --network host，不另建第二个 host 网络
docker network rm data-net                     # 删除网络
docker network prune                           # 删除所有未使用网络

# 容器和网络
docker network connect data-net mysql          # 将容器加入网络
docker network disconnect data-net mysql       # 从网络中移除容器
```

---

## 存储（Volume）操作

```bash
# 查看 Volume
docker volume ls                               # 列出所有 Volume
docker volume inspect mysql-data               # 查看 Volume 详情

# 创建/删除 Volume
docker volume create mysql-data                # 创建 Volume
docker volume rm mysql-data                    # 删除 Volume
docker volume prune                            # 现代 Docker 默认清理未使用的匿名 Volume；旧版行为须查本机帮助（危险！）

# Volume 备份（文件级示例；MySQL 须安全停库后执行，在线备份需采用数据库一致性方案）
docker run --rm \
  -v mysql-data:/source \
  -v "$(pwd):/backup" \
  busybox \
  tar czf /backup/mysql-backup.tar.gz -C /source .

# Volume 恢复（停止使用目标卷的服务；确认版本兼容，避免直接覆盖现有数据，并验证恢复结果）
docker run --rm \
  -v mysql-data:/target \
  -v "$(pwd):/backup" \
  busybox \
  tar xzf /backup/mysql-backup.tar.gz -C /target
```

---

## 系统维护

```bash
# 查看 Docker 系统信息
docker info                                    # 系统信息
docker version                                 # 版本信息

# 磁盘使用
docker system df                               # 磁盘使用概览

# 清理
docker system prune                            # 清理未使用的资源
docker system prune -a                         # 清理所有未使用（包括有标签的镜像）
docker system prune -a --volumes               # 清理停止的容器、未使用网络/镜像、构建缓存及未使用匿名卷；非全部资源，确认后执行
```

---

## 数据工程常用组合命令

```bash
# 等待 MySQL 响应后尝试连接；ping 成功不证明凭据有效或业务初始化完成，循环无超时
until docker exec mysql mysqladmin ping -h localhost -uroot -proot123 --silent; do
    echo "等待 MySQL 启动..."
    sleep 2
done
echo "MySQL 已响应，接下来尝试认证连接"
docker exec -it mysql mysql -uroot -proot123

# 批量停止并删除所有容器
docker stop $(docker ps -q) && docker rm $(docker ps -aq)

# 查找占用某端口的容器
docker ps --format "table {{.Names}}\t{{.Ports}}" | grep 3306

# 快速重启某个服务并查看日志
docker compose restart kafka && docker compose logs -f kafka

# 重新构建单个服务（不重启其他服务）
docker compose up -d --build --no-deps app

# 清理构建缓存
docker builder prune

# 查看所有容器的网络配置
docker inspect $(docker ps -q) --format '{{.Name}}: {{.NetworkSettings.Networks}}'
```

---

## 参数速查

### docker run 常用参数

| 参数 | 作用 |
|------|------|
| `-d` | 后台运行 |
| `-it` | 交互式终端 |
| `--rm` | 退出后自动删除 |
| `--name xxx` | 指定容器名 |
| `-p 8080:80` | 端口映射（宿主机:容器） |
| `-v /host:/cont` | Bind Mount |
| `-v vol-name:/cont` | Volume 挂载 |
| `-e KEY=VALUE` | 设置环境变量 |
| `--env-file .env` | 从文件读取环境变量 |
| `--network net` | 指定网络 |
| `--restart always` | 总是重启 |
| `--restart unless-stopped` | 手动停止外一直重启 |
| `--memory="2g"` | 限制内存 |
| `--cpus="1.5"` | 限制 CPU |
| `--user 1000:1000` | 指定运行用户 |

### 重启策略

| 策略 | 说明 |
|------|------|
| `no` | 不重启（默认） |
| `always` | 总是重启，包括 Docker 启动时 |
| `on-failure` | 仅在退出码非 0 时重启 |
| `unless-stopped` | 除非手动 stop，否则一直重启 |

---

## 相关文档

- [[【技术与工具】/Docker/04-容器基本操作|容器基本操作]] - 命令的详细说明和示例
- [[【技术与工具】/Docker/06-Docker Compose入门|Docker Compose]] - Compose 完整指南
- [[【技术与工具】/Docker/11-Docker问题排查|问题排查手册]] - 常见报错解决
