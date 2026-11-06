---
title: Docker安装与配置 - Mac/Windows/Linux三平台指南
tags:
  - Docker
  - 安装配置
  - Docker Desktop
  - 镜像加速
  - 国内镜像源
aliases:
  - Docker安装
  - Docker配置
  - Docker镜像加速
difficulty: 中级
duration: 45分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据分析师
  - 数据科学家
  - 数据架构师
  - BI分析师
  - 数据运营
stability: fast-changing
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


# Docker 安装与配置

> [!abstract] 本章要点
> - Mac / Windows / Linux 三平台的安装方法
> - Docker Desktop 的基本设置
> - 镜像加速配置（按网络需要选择，可用性需自行验证）
> - 验证安装是否成功

---

## Mac 安装

### 推荐方式：Docker Desktop

1. 访问 [Docker 官网](https://www.docker.com/products/docker-desktop/)，点击"Download for Mac"
2. 根据芯片类型选择版本：
   - Apple Silicon（M1/M2/M3/M4）：选 Apple Silicon 版本
   - Intel 芯片：选 Intel 版本
3. 下载 `.dmg` 文件，双击安装，拖入 Applications 文件夹
4. 打开 Docker Desktop，等待鲸鱼图标在菜单栏出现并稳定

> [!tip] 如何判断芯片类型
> 点击左上角苹果菜单 → "关于本机"，查看"芯片"一栏。写着 Apple M1/M2/M3 就是 Apple Silicon，写着 Intel Core i5/i7 就是 Intel。

### 用 Homebrew 安装（Mac 开发者更推荐）

如果你已经安装了 Homebrew：

```bash
# 安装 Docker Desktop
brew install --cask docker

# 安装完成后从启动台打开 Docker Desktop
```

### 验证安装

```bash
# 查看 Docker 版本
docker --version
# 输出示例：Docker version 26.1.3, build b72abbb

# 查看 Docker Compose 版本（Desktop 内置）
docker compose version
# 输出示例：Docker Compose version v2.27.1

# 运行测试容器
docker run hello-world
# 成功输出 "Hello from Docker!" 说明安装正常
```

---

## Windows 安装

### 前置条件：启用 WSL2

本文采用 Docker Desktop 的 WSL2（Windows Subsystem for Linux 2）后端；部分受支持的 Windows 环境也可使用 Hyper-V 后端。安装前需核对当前版本的系统、虚拟化及后端要求。

```powershell
# 以管理员身份打开 PowerShell，执行：

# 启用 WSL 功能
wsl --install

# 安装完成后重启电脑

# 重启后设置 WSL 默认版本为 2
wsl --set-default-version 2

# 安装 Ubuntu 发行版（推荐）
wsl --install -d Ubuntu
```

### 安装 Docker Desktop

1. 访问 Docker 官网下载 Windows 版本的 `.exe` 安装包
2. 运行安装程序，确保勾选"Use WSL 2 instead of Hyper-V"
3. 安装完成后重启电脑
4. 打开 Docker Desktop，完成初始设置

### 验证安装

在 PowerShell 或 Windows Terminal 中：

```powershell
docker --version
docker compose version
docker run hello-world
```

> [!warning] Windows 常见问题
> - 如果报错"WSL 2 installation is incomplete"，运行 `wsl --update` 更新 WSL 内核
> - 如果虚拟化功能未开启，需要进入 BIOS 开启 Intel VT-x 或 AMD-V

---

## Linux 安装

### Ubuntu（需为 Docker 官方仓库支持的版本）

以下命令使用 Ubuntu 仓库，不可直接用于 Debian；Debian 须使用对应发行版的仓库、密钥和版本代号。

```bash
# 1. 更新包列表
sudo apt-get update

# 2. 安装必要的依赖
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# 3. 添加 Docker 官方 GPG 密钥
sudo mkdir -m 0755 -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 4. 添加 Docker 仓库
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 5. 安装 Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 6. 启动并设置开机自启
sudo systemctl start docker
sudo systemctl enable docker

# 7. 将当前用户加入 docker 组（避免每次都要 sudo）
sudo usermod -aG docker $USER
# 注意：需要重新登录才能生效
newgrp docker
```

### CentOS（需核对发行版支持情况）

以下命令使用 CentOS 仓库，并非 RHEL 通用安装流程；RHEL 用户须按其发行版和版本核对安装方式。

```bash
# 1. 安装必要工具
sudo yum install -y yum-utils

# 2. 添加 Docker 仓库
sudo yum-config-manager \
    --add-repo \
    https://download.docker.com/linux/centos/docker-ce.repo

# 3. 安装 Docker
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 4. 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 5. 将当前用户加入 docker 组
sudo usermod -aG docker $USER
newgrp docker
```

### 验证 Linux 安装

```bash
# 查看版本
docker --version

# 查看 Docker 服务状态
sudo systemctl status docker

# 运行测试
docker run hello-world

# 查看 Docker 系统信息
docker info
```

---

## 国内镜像加速配置（按需选择）

部分网络环境访问 Docker Hub 可能缓慢或超时，但并非所有环境都需要镜像加速器。先测试默认拉取，再按网络条件选择经核实可用且可信的服务。

> [!warning] 镜像源现状说明
> 国内镜像源的可用性时常变化。原稿关于部分加速器在 2024 年停服及以下方案在2026年相对稳定的说法未附核验材料；下列地址仅保留为原稿未核实的配置示例，不代表当前可用或受到推荐。使用前需核对服务方公告、访问资格、使用限制及可信性。

### Mac / Windows 配置方式（Docker Desktop）

1. 打开 Docker Desktop
2. 点击右上角设置图标（齿轮）
3. 左侧菜单选择 "Docker Engine"
4. 在 JSON 配置中添加 `registry-mirrors` 字段：

```json
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com",
    "https://mirror.baidubce.com"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

5. 点击 "Apply & Restart" 重启 Docker

### Linux 配置方式

```bash
# 以下 tee 命令会覆盖现有配置，不是追加字段
# 执行前备份 /etc/docker/daemon.json；已有配置时应手工合并字段并检查 JSON
# 重启 Docker 可能中断现有容器，仅在允许中断的测试环境执行
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<-'EOF'
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com",
    "https://mirror.baidubce.com"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

# 重载配置并重启 Docker
sudo systemctl daemon-reload
sudo systemctl restart docker

# 验证配置生效
docker info | grep -A 5 "Registry Mirrors"
```

### 阿里云个人镜像加速（需核实账号资格与可用性）

原稿所述专属镜像加速地址的账号覆盖范围、当前可用性和速度未核实。以下保留为操作入口示例，以账号实际显示的功能及服务方当前说明为准，不保证每个账号均可使用或获得稳定加速：

1. 访问 [阿里云容器镜像服务](https://cr.console.aliyun.com/)
2. 登录后进入"镜像工具" → "镜像加速器"
3. 复制你的专属加速器地址（格式：`https://xxxxxxxx.mirror.aliyuncs.com`）
4. 按上面的方法配置到 `daemon.json` 中

### 验证镜像加速效果

```bash
# 拉取一个镜像测试速度
time docker pull nginx:alpine

# 查看镜像加速配置
docker info | grep -A 10 "Registry Mirrors"
```

---

## Docker Desktop 基本设置

### 资源分配

默认情况下 Docker Desktop 会占用较多系统资源，建议根据自己机器配置调整：

打开 Docker Desktop → Settings → Resources：

| 资源 | 推荐配置（16GB 内存机器） | 说明 |
|------|--------------------------|------|
| CPUs | 4 核 | 不要超过物理核数的一半 |
| Memory | 6-8 GB | 跑大数据组件时可能需要更多 |
| Swap | 1 GB | 虚拟内存，不建议太大 |
| Disk image size | 64 GB | 镜像和容器数据的存储空间 |

> [!tip] 跑大数据组件时的内存建议
> 以下内存数字仅为小规模教学测试的起始估算，并非容量保证；实际需求取决于版本、数据量、并发及配置。
> - MySQL：可从512MB起评估，可能不足
> - Redis：可从256MB起评估，须考虑数据集及额外内存开销
> - Kafka（含 ZooKeeper）：2-3 GB
> - Spark 单机模式：4-6 GB
> - Flink 单机模式：2-4 GB
>
> 如果要同时跑多个服务，建议给 Docker 分配 8GB 以上。

### 开机自启设置

在 Settings → General 中：
- 勾选"Start Docker Desktop when you sign in"：开机自动启动
- 勾选"Open Docker Dashboard when Docker Desktop starts"：可选，不用每次都手动开仪表盘

---

## 常见安装问题

### 问题一：`Cannot connect to the Docker daemon`

```bash
# 检查 Docker 服务是否运行
sudo systemctl status docker

# 如果未运行，启动它
sudo systemctl start docker
```

如果是 Mac/Windows，检查 Docker Desktop 是否已经启动（看任务栏是否有鲸鱼图标）。

### 问题二：`Permission denied` (Linux)

加入 `docker` 组通常意味着获得接近 root 的主机控制能力，只应授予可信用户；不能将其视为普通低权限授权。

```bash
# 确认用户在 docker 组中
groups $USER

# 如果没有 docker 组，添加并重新登录
sudo usermod -aG docker $USER
# 必须重新登录或执行：
newgrp docker
```

### 问题三：拉取镜像超时

```bash
# 方式一：配置镜像加速器（见上文）

# 方式二：临时指定镜像地址拉取
docker pull docker.mirrors.ustc.edu.cn/library/mysql:8.0
# 然后打标签
docker tag docker.mirrors.ustc.edu.cn/library/mysql:8.0 mysql:8.0
```

### 问题四：磁盘空间不足

执行清理前先用 `docker system df` 查看占用，并核对命令的确认提示。`docker system prune` 会删除已停止容器、未使用网络、悬空镜像和未使用构建缓存；`-a` 还会删除所有未被容器使用的镜像。已停止容器中的未持久化数据可能随容器删除而丢失，这些命令默认不清理卷。

```bash
# 清理未使用的镜像、容器、网络
docker system prune

# 清理所有未使用的镜像（包括有标签的）
docker system prune -a

# 查看 Docker 占用的磁盘空间
docker system df
```

---

## 安装后的第一个测试

以下仅用于本机临时练习；`test123` 是示例口令，不可用于生产或共享环境。端口仅绑定本机回环地址；若3306已被占用，可省略端口映射，后续 `docker exec` 验证不依赖该映射。

```bash
# 拉取 MySQL 8.0 镜像，测试完整流程
docker pull mysql:8.0

# 启动一个 MySQL 容器
docker run -d \
  --name test-mysql \
  -e MYSQL_ROOT_PASSWORD=test123 \
  -p 127.0.0.1:3306:3306 \
  mysql:8.0

# 查看容器状态（应该显示 Up）
docker ps

# 连接 MySQL（原稿的约 10-30 秒仅为未核实的等待示例；以 docker logs test-mysql 中的就绪信息为准，未就绪时稍后重试）
docker exec -it test-mysql mysql -uroot -ptest123 -e "SELECT VERSION();"

# 测试完毕，清理
docker stop test-mysql
docker rm test-mysql
```

如果上面的命令都成功运行，恭喜你，Docker 已经安装好了！

---

---

> [!info] 前置知识
> - [[【技术与工具】/Docker/01-容器化概念入门|容器化概念入门]] - 理解镜像、容器的概念，安装后才知道验证什么

---

## 掌握检查

- [ ] `docker --version` 能输出版本号，`docker ps` 不报错，说明 Docker 已安装且 daemon 在运行
- [ ] 已测试默认镜像拉取；如需加速器，已核实服务可用性与使用限制，并检查实际拉取结果，不将配置显示视为提速证明
- [ ] 完整跑通了"拉取 MySQL 镜像 → 启动容器 → 连接验证 → 清理"的完整流程
- [ ] 知道如何用 `docker system prune` 清理无用镜像和容器，避免磁盘被占满
- [ ] Linux 环境下理解 `docker` 用户组的高权限风险，并根据权限策略选择使用 `sudo` 或为可信用户授权

---

## 实践练习

**基础题**：完成 Docker 安装和环境验证：安装 Docker → 测试默认拉取，必要时配置经核实可用的镜像加速器 → 运行 `docker run hello-world` 验证 → 拉取 MySQL 8.0 镜像 → 启动 MySQL 容器并用 `docker exec` 连接验证服务正常运行。

---

## 下一步

- 继续阅读：[[【技术与工具】/Docker/03-镜像管理|镜像管理]] - 学会找镜像、管理镜像
- 快速上手：[[【技术与工具】/Docker/04-容器基本操作|容器基本操作]] - 学会运行和管理容器
