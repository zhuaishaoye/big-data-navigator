---
title: Git安装与配置 - 从零开始搭建版本控制环境
tags:
  - Git
  - 安装配置
  - SSH密钥
  - GitHub
  - GitLab
  - 环境搭建
aliases:
  - Git环境配置
  - Git安装
difficulty: 基础
duration: 30分钟
knowledge_type: technical-practice
target_audience:
  - 数据从业者
  - 数据开发工程师
  - 数据分析师
  - BI分析师
  - 数据科学家
  - 数据治理工程师
  - 数据架构师
  - 数据运营
  - 数据产品经理
stability: slow-changing
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


> [!warning] 关联材料边界
> 以下原引用目标缺失或无法唯一确认，已取消跳转并保留提及：Linux基础概念。相关素材/延伸说明暂不可用，不能据此声称已经提供配套材料。

# Git 安装与配置 - 从零开始搭建版本控制环境

> [!abstract] 本章概要
> - 在 Mac/Windows/Linux 上安装 Git
> - 配置 git config（用户名、邮箱、编辑器等）
> - 生成 SSH 密钥并连接到 GitHub/GitLab
> - 验证环境搭建成功

---

## 第一步：安装 Git

### macOS 安装

macOS 通常预装了 Git（Apple 的 Xcode Command Line Tools 包含 Git），但版本可能较旧。推荐用 Homebrew 安装最新版：

```bash
# 先检查是否已安装
git --version

# 用 Homebrew 安装（推荐）
brew install git

# 安装完后确认版本
git --version
# 应该输出类似 git version 2.43.0
```

> [!tip] 没有 Homebrew？
> 如果你还没有安装 Homebrew，在终端运行这行命令：
> ```bash
> /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
> ```
> Homebrew 是 macOS 上管理命令行工具的标准方式，数据工程师日常必用，顺手一起装了。

### Windows 安装

Windows 上推荐安装 **Git for Windows**，它包含了 Git Bash（一个模拟 Linux 终端的工具）。

1. 下载安装包：访问 https://git-scm.com/download/win
2. 运行安装程序，大部分选项保持默认即可
3. 有几个选项需要注意：

```text
- "Adjusting your PATH environment" → 选 "Git from the command line and also from 3rd-party software"
- "Choosing the default behavior of git pull" → 按团队策略选择；仅在理解提交重放的影响时选 "Rebase"，不确定时暂保留安装程序默认选项
- "Configuring the line ending conversions" → 选 "Checkout Windows-style, commit Unix-style"
```

安装后打开 "Git Bash" 或 PowerShell，验证：

```bash
git --version
```

> [!note] Windows 用户的额外建议
> 强烈建议同时安装 **Windows Terminal** + **WSL2**（Windows Subsystem for Linux）。数据工程环境大量工具原生支持 Linux，WSL2 能让你在 Windows 上获得接近 Linux 的开发体验。详见 Linux基础概念（原引用“Linux基础概念”未能确定有效目标，暂不可跳转）。

### Linux 安装

```bash
# Ubuntu / Debian
sudo apt update
sudo apt install git

# CentOS / RHEL / Fedora
sudo yum install git
# 或
sudo dnf install git

# 验证
git --version
```

---

## 第二步：配置 git config

安装好 Git 后，第一件事是配置你的身份信息。**这非常重要**：每次提交代码，Git 都会记录是谁提交的，用的就是这里配置的信息。

### 必须配置的两项

```bash
# 配置用户名（填你的真实姓名或团队通用名）
git config --global user.name "Zhang San"

# 配置提交邮箱（按个人或团队要求填写；账号归属识别需另行确认平台规则）
git config --global user.email "zhangsan@company.com"
```

> [!warning] 提交邮箱不等于登录身份
> Git 会把配置的邮箱写入提交记录，并不要求它与代码托管账号邮箱一致。平台如何把提交关联到账号，应按其当前规则确认；不要把未关联的提交一概理解为匿名提交。SSH 认证使用密钥，不使用这里的提交邮箱。

### 推荐配置的其他项

```bash
# 设置默认编辑器（写 commit message 时会用到）
# 推荐用 VS Code
git config --global core.editor "code --wait"
# 或者 vim（如果你熟悉 vim）
git config --global core.editor "vim"
# 或者 nano（更简单）
git config --global core.editor "nano"

# 设置默认分支名为 main（与 GitHub 保持一致）
git config --global init.defaultBranch main

# 开启彩色输出，让命令行更易读
git config --global color.ui auto

# 配置换行符处理（Mac/Linux 用这个）
git config --global core.autocrlf input
# Windows 用这个
git config --global core.autocrlf true

# 可选：设置 pull 策略为 rebase，会重放本地提交
# 仅在理解其影响且符合团队策略时启用；不确定时先跳过
git config --global pull.rebase true
```

### 查看当前配置

```bash
# 查看所有配置
git config --list

# 查看某一项
git config user.name
git config user.email

# 查看配置文件在哪
git config --list --show-origin
```

配置文件存储在 `~/.gitconfig`，你也可以直接用文本编辑器打开它：

```bash
cat ~/.gitconfig
```

典型的配置文件长这样：

```ini
[user]
	name = Zhang San
	email = zhangsan@company.com
[core]
	editor = code --wait
	autocrlf = input
[init]
	defaultBranch = main
[color]
	ui = auto
[pull]
	rebase = true
```

### 全局配置 vs 项目配置

`--global` 是全局配置，对你电脑上所有 Git 仓库生效。如果某个项目需要用不同的邮箱（比如公司项目用工作邮箱，个人项目用私人邮箱），可以在项目目录里单独配置：

```bash
# 进入项目目录后，不加 --global
cd /path/to/your/work-project
git config user.email "zhangsan@bigcompany.com"
```

这个配置只对当前项目生效，存储在项目的 `.git/config` 文件里。

---

## 第三步：生成 SSH 密钥

SSH（Secure Shell）密钥让你无需每次都输入密码就能与 GitHub/GitLab 交互。

### 什么是 SSH 密钥对

SSH 密钥分两部分：
- **私钥**（`~/.ssh/id_ed25519`）：存在你电脑上，绝对不能泄露
- **公钥**（`~/.ssh/id_ed25519.pub`）：上传到 GitHub/GitLab，公开的

当你连接 GitHub 时，GitHub 用你的公钥验证你的身份，整个过程无需密码。

```text
你的电脑                     GitHub
   │                            │
   │  1. 发起连接请求             │
   ├───────────────────────────►│
   │                            │
   │  2. 发送挑战（随机字符串）    │
   │◄───────────────────────────┤
   │                            │
   │  3. 用私钥签名挑战           │
   ├───────────────────────────►│
   │                            │
   │  4. 用公钥验证签名，验证成功   │
   │◄───────────────────────────┤
```

### 生成新密钥

```bash
# 生成 Ed25519 算法的 SSH 密钥（推荐，密钥较短；需确认系统和目标服务支持）
ssh-keygen -t ed25519 -C "zhangsan@company.com"

# 如果你的系统不支持 Ed25519，用 RSA
ssh-keygen -t rsa -b 4096 -C "zhangsan@company.com"
```

执行后会有交互提示：

```text
Generating public/private ed25519 key pair.
Enter file in which to save the key (/Users/username/.ssh/id_ed25519):
# 先确认默认路径没有需要保留的已有密钥，再按回车
# 若已有密钥，改用新的文件名，不要覆盖；后续命令也要使用该文件名

Enter passphrase (empty for no passphrase):
# 可以设置密码短语（更安全），也可以直接回车（更方便）
# 建议设置，防止私钥被盗后被滥用
```

### 查看并复制公钥

```bash
# macOS
cat ~/.ssh/id_ed25519.pub | pbcopy
# 或直接打印出来手动复制
cat ~/.ssh/id_ed25519.pub

# Linux
cat ~/.ssh/id_ed25519.pub | xclip -selection clipboard

# Windows (Git Bash)
cat ~/.ssh/id_ed25519.pub | clip
```

公钥长这样（一长串字符）：
```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIxxxxxx... zhangsan@company.com
```

---

## 第四步：连接 GitHub

### 添加公钥到 GitHub

1. 登录 GitHub → 点右上角头像 → Settings
2. 左侧菜单 → SSH and GPG keys
3. 点 "New SSH key"
4. Title 填一个好认的名字（如 "MacBook Pro 工作机"）
5. Key type 选 "Authentication Key"
6. Key 框里粘贴你的公钥内容
7. 点 "Add SSH key"

### 测试连接

```bash
ssh -T git@github.com
```

第一次连接可能会询问是否信任远端主机指纹。先通过 GitHub 官方文档等可信渠道核对显示的主机密钥指纹，确认一致后再输入 `yes` 回车；若不一致或无法核对，应停止连接并排查。

成功的话会看到：
```text
Hi ZhangSan! You've successfully authenticated, but GitHub does not provide shell access.
```

> [!tip] 连接超时怎么办？
> 部分网络环境下 22 端口被封锁，可以改用 443 端口连接 GitHub：
> 在 `~/.ssh/config` 文件（没有就新建）中添加：
> ```text
> Host github.com
>     Hostname ssh.github.com
>     Port 443
>     User git
> ```
> 然后再测试 `ssh -T git@github.com`。

### 连接 GitLab

流程与 GitHub 相同：

1. GitLab → User Settings → SSH Keys
2. 粘贴公钥，设置过期时间（可选）
3. 测试连接：`ssh -T git@gitlab.com`（公网 GitLab）
4. 如果是公司私有 GitLab：`ssh -T git@your-company.gitlab.com`

---

## 第五步：配置多个 SSH 密钥（可选但实用）

数据工程师常见情况：公司 GitLab + 个人 GitHub，需要两套密钥。

```bash
# 生成第二个密钥，专门给公司用
ssh-keygen -t ed25519 -C "zhangsan@company.com" -f ~/.ssh/id_ed25519_company
```

然后编辑 `~/.ssh/config`：

```text
# 个人 GitHub
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519

# 公司 GitLab
Host gitlab.company.com
    HostName gitlab.company.com
    User git
    IdentityFile ~/.ssh/id_ed25519_company
```

测试：
```bash
ssh -T git@github.com
ssh -T git@gitlab.company.com
```

---

## 验证环境搭建完成

验证 Git 安装、提交身份、SSH 认证及本地基本操作；以下步骤不验证远程仓库读写权限：

```bash
# 1. 检查 Git 版本
git --version

# 2. 检查用户配置
git config user.name
git config user.email

# 3. 测试 GitHub SSH 连接
ssh -T git@github.com

# 4. 创建一个测试仓库，验证基本操作
mkdir ~/git-test && cd ~/git-test
git init
echo "# 测试仓库" > README.md
git add README.md
git commit -m "Initial commit"
git log --oneline
```

看到类似这样的输出，说明本地初始化和提交已成功；SSH 认证需单独检查上述连接测试结果，本练习尚未验证远程仓库的读写权限：
```text
a3f8b2c (HEAD -> main) Initial commit
```

---

## 常见问题排查

### 问题一：`git push` 提示输入用户名密码

说明你使用的是 HTTPS 方式而不是 SSH 方式。

```bash
# 查看当前远程地址
git remote -v

# 如果显示 https://... 格式，改成 SSH 格式
git remote set-url origin git@github.com:username/repo.git
```

### 问题二：SSH 连接超时

```bash
# 诊断 SSH 连接
ssh -vT git@github.com

# 检查防火墙，或按上面的方法改用 443 端口
```

### 问题三：每次 push 都要输入密码（设置了 passphrase）

把密钥添加到 SSH agent：

```bash
# 启动 ssh-agent
eval "$(ssh-agent -s)"

# 添加密钥
ssh-add ~/.ssh/id_ed25519

# macOS 还可以把密码存到钥匙串，避免重启后再输入
ssh-add --apple-use-keychain ~/.ssh/id_ed25519
```

---

## 小结

完成本章后，你的环境应该已经：

- [x] 安装了 Git，并能通过 `git --version` 查看版本
- [x] 配置了 user.name 和 user.email
- [x] 生成了 SSH 密钥
- [x] 公钥已添加到 GitHub/GitLab
- [x] SSH 连接测试通过

---

---

> [!info] 前置知识
> - [[【技术与工具】/Git/01-版本控制概念|版本控制概念]] - 理解 Git 是什么，再来配置环境
> - 有一个 GitHub 或公司 GitLab 账号（本章会教你添加 SSH 密钥）

---

## 掌握检查

- [ ] 用 `git --version` 能看到 2.x 以上的版本号，说明安装成功
- [ ] 用 `git config user.name` 和 `git config user.email` 能看到自己设置的信息
- [ ] `ssh -T git@github.com` 返回 `Hi username! You've successfully authenticated...`，SSH 配置成功
- [ ] 在测试仓库中完成 `init → add → commit → log` 完整流程，能看到第一条提交记录
- [ ] 知道如何切换远程地址从 HTTPS 改为 SSH（避免每次 push 输密码）

---

## 实践练习

**基础题**：完成从零搭建：(1) 在本机安装 Git 并配置 user.name 和 user.email；(2) 生成 SSH 密钥，添加到 GitHub；(3) 创建本地测试仓库，提交一个文件，用 `git log --oneline` 验证成功。

---

下一步：[[【技术与工具】/Git/03-Git基础操作|Git基础操作]] - 开始真正使用 Git，掌握每天都会用到的核心命令。

上一步：[[【技术与工具】/Git/01-版本控制概念|版本控制概念]] | 返回：[[【技术与工具】/Git/00-Git学习路线图|Git学习路线图]]
