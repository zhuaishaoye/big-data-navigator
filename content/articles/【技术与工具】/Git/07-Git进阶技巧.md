---
title: Git进阶技巧 - stash、rebase、tag与.gitignore
tags:
  - Git
  - 进阶技巧
  - stash
  - rebase
  - cherry-pick
  - tag
  - gitignore
aliases:
  - Git高级操作
  - Git技巧
difficulty: 高级
duration: 50分钟
knowledge_type: technical-practice
target_audience:
  - 数据从业者
  - 数据开发工程师
  - 数据分析师
  - 数据科学家
  - 数据治理工程师
  - 数据架构师
  - BI分析师
  - 数据运营
stability: stable
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


# Git 进阶技巧 - stash、rebase、tag 与 .gitignore

> [!abstract] 本章概要
> - git stash：临时保存工作现场
> - cherry-pick：精准挑选提交
> - rebase vs merge：两种历史整理方式
> - tag：版本标记管理
> - .gitignore：正确排除不需要追踪的文件

---

## git stash：工作现场的暂存箱

### 场景：改到一半被打断

你正在开发 `feature/new-metric` 分支，改了一半的 SQL，突然来了个紧急需求，要你马上去修 main 分支的 bug。

但当前工作没完成，不想提交一个半成品的 commit，又不能就这样切走……这时候就用 stash。

```bash
# 暂存已跟踪文件的修改并还原这些文件；默认不保存未跟踪或忽略文件
# 若也要保存未跟踪文件，可用 git stash push -u；切分支前用 git status 检查
git stash

# 或者附上说明
git stash push -m "WIP: 正在开发周GMV指标，尚未完成"

# 切到 main 去修 bug
git switch main
git switch -c hotfix/fix-null-issue
# ... 修 bug，提交，PR 合并 ...

# 回到原来的功能分支
git switch feature/new-metric

# 把之前暂存的工作恢复出来
git stash pop
```

### 常用 stash 命令

```bash
# 查看所有 stash
git stash list
# 输出：
# stash@{0}: On feature/new-metric: WIP: 正在开发周GMV指标
# stash@{1}: On main: temp save

# 查看某个 stash 的内容
git stash show stash@{0}
git stash show -p stash@{0}  # 显示详细 diff

# 恢复最近一个 stash，成功后删除；若发生冲突则保留 stash
git stash pop

# 恢复指定 stash，成功后删除；若发生冲突则保留 stash
git stash pop stash@{1}

# 恢复但不删除（保留在 stash 列表中）
git stash apply stash@{0}

# 删除某个 stash
git stash drop stash@{0}

# 清空所有 stash
git stash clear
```

> [!warning] stash 是临时保存，不是长期存储
> stash 没有同步到远程仓库，换台电脑就没了。如果要长期保存某个进行中的工作，更好的方式是提交一个 `WIP: xxx` 的 commit 到个人分支，推到远程。

### 把 stash 应用到另一个分支

```bash
# 在 feature-A 分支做了一些修改，发现应该是在 feature-B 上改的
git stash
git switch feature-B
git stash pop  # 把修改应用到 feature-B
```

---

## cherry-pick：精准挑选提交

cherry-pick 让你从一个分支挑选某个（些）提交，应用到当前分支，而不需要合并整个分支。

### 场景：把 hotfix 也应用到 develop

```text
main:   ●──●──●──hotfix-commit──●
develop: ●──●──●──────────────────────●
```

hotfix 已经合并到 main 了，但 develop 分支还没有这个修复：

```bash
# 查看 hotfix commit 的 hash
git log main --oneline -5
# a3f8b2c (main) fix: 修复NULL值处理

# 把这个 commit 应用到 develop
git switch develop
git cherry-pick a3f8b2c

# 一次挑多个 commit
git cherry-pick a3f8b2c 9e1d234

# 挑选一个范围（不含起点）
git cherry-pick start_hash..end_hash
```

### cherry-pick 时的冲突处理

```bash
git cherry-pick a3f8b2c
# 如果有冲突...

# 1. 解决冲突
# 2. git add <resolved-files>
# 3. 继续
git cherry-pick --continue

# 如果不想要了
git cherry-pick --abort
```

> [!tip] cherry-pick 的使用场景
> - 把紧急修复从 main 同步到 develop
> - 从别人的分支借用某个改动，但不想合并整个分支
> - 在错误的分支上做了提交，想把它移到正确的分支

---

## rebase：整理提交历史

### rebase vs merge：核心区别

**merge**：合并两条分支的历史；非快进合并会追加一个 merge commit（如下图），快进合并则只移动分支指针

```text
before:  ●──●──●  (main)
              └──A──B  (feature)

after merge:
         ●──●──●──────M  (main)
              └──A──B──┘
         (M 是 merge commit，能看到分支历史)
```

**rebase**：把 feature 的提交"接"到 main 最新提交后面

```text
before:  ●──●──●  (main)
              └──A──B  (feature)

after rebase:
         ●──●──●──A'──B'  (feature, 线性历史)
         (A'和B'是原来A和B的"重放"版本，hash 变了)
```

### 为什么 rebase 能产生更干净的历史

```bash
# 没有 rebase，merge 后的历史
* a3f8b2c (main) Merge: 合并feature/new-metric
|\
| * 9e1d234 feat: 添加month维度
| * 7c2f891 feat: 初始化周GMV指标
|/
* 4b5a6d7 feat: 核心ETL框架

# rebase 后，merge 到 main 的历史
* a3f8b2c (main) feat: 添加month维度
* 9e1d234 feat: 初始化周GMV指标
* 4b5a6d7 feat: 核心ETL框架
（看起来像一条直线）
```

### 功能分支上的 rebase 工作流

```bash
# 开发功能时，定期把 main 的最新内容 rebase 进来（避免后期大量冲突）
git switch feature/new-metric
git fetch origin
git rebase origin/main

# 如果有冲突，逐个解决
# git add <file>
# git rebase --continue

# 功能完成后，在 GitHub 上提 PR
# 合并时选择 "Rebase and merge"
```

### 交互式 rebase：整理提交历史

`git rebase -i` 让你在把分支合并到主干之前，整理自己分支上的提交历史（合并零碎提交、修改 message、删除多余提交等）。

```bash
# 交互式 rebase 最近 5 个提交
git rebase -i HEAD~5
```

打开编辑器，看到类似内容：

```text
pick a3f8b2c 初始化周GMV指标
pick 9e1d234 调试中...
pick 7c2f891 调试中2...
pick 4b5a6d7 修复一个bug
pick 1e2c3b4 feat: 完成周GMV指标开发

# Commands:
# p, pick   = 保留这个提交
# r, reword = 保留提交，但修改 message
# s, squash = 把这个提交合并到前一个提交
# d, drop   = 删除这个提交
```

整理成干净的历史：

```text
pick a3f8b2c 初始化周GMV指标
squash 9e1d234 调试中...        ← 合并到上面
squash 7c2f891 调试中2...       ← 合并到上面
squash 4b5a6d7 修复一个bug      ← 合并到上面
reword 1e2c3b4 feat: 完成周GMV指标开发  ← 保留，但改 message
```

结果：5 个提交压缩成 2 个干净的提交。

> [!warning] rebase 会改写历史
> `git rebase` 会修改提交的 hash 值（即使内容相同）。已经 push 到远程共享分支的提交，绝对不要 rebase，否则会导致所有人的本地仓库和远程不同步。
>
> **安全原则**：只对还没有 push 的本地提交，或者只有你自己在用的私有分支使用 rebase。

---

## git tag：版本标记

tag 是 Git 历史上的一个静态指针，通常用来标记重要版本（如上线节点、里程碑版本）。

### 创建 tag

```bash
# 以下两种方式二选一，不要连续创建同名 tag
# 轻量 tag（只是一个指针，没有额外信息）
git tag v1.0.0

# 带注释的 tag（推荐，包含创建者、日期、说明）
git tag -a v1.0.0 -m "数据仓库2024年Q1版本，新增周GMV指标体系"

# 给历史提交打 tag
git tag -a v0.9.0 a3f8b2c -m "2024-01-15上线版本"
```

### 查看 tag

```bash
# 列出所有 tag
git tag

# 按模式过滤
git tag -l "v1.*"

# 查看某个 tag 的详细信息
git show v1.0.0

# 查看 tag 对应的 commit
git log v1.0.0 --oneline -1
```

### 推送 tag 到远程

```bash
# push 默认不推送 tag，需要显式指定
git push origin v1.0.0

# 推送所有本地 tag
git push origin --tags
```

### 从 tag 创建分支（回溯历史版本）

```bash
# 查看 v1.0.0 版本的代码
git checkout v1.0.0   # 进入 detached HEAD 状态

# 基于 v1.0.0 创建新分支
git checkout -b hotfix/v1.0.0-fix v1.0.0
```

### 数据项目中的 tag 使用实践

```bash
# 每次数仓发版时打 tag
git tag -a dw-v2024q1 -m "2024 Q1数据仓库发版：新增用户分层体系、周GMV指标"
git push origin dw-v2024q1

# 紧急回退时，可以快速找到上个稳定版本
git log --tags --simplify-by-decoration --pretty="format:%D %s"
```

---

## .gitignore：告诉 Git 哪些文件不要管

### 为什么需要 .gitignore

数据项目里经常有不应该进版本库的文件：
- 数据库连接密码、API Key 等敏感信息
- 本地环境配置（每个人不一样）
- 自动生成的临时文件
- 大型数据文件（应该用其他方式存储）
- IDE 配置文件

### .gitignore 语法

```text
# 这是注释

# 忽略所有 .log 文件
*.log

# 忽略 data 目录内的内容，但保留目录可遍历，以便设置后续例外
data/*

# 忽略根目录下的 config.ini，但不忽略子目录的
/config.ini

# 忽略特定文件
database_config.py
.env
credentials.json

# 用 ! 取消忽略；父目录必须未被排除，否则需先重新包含父目录
!data/sample.csv

# 忽略所有 .csv 文件，但保留 data/sample 目录及其中的 CSV 文件
*.csv
# 后匹配规则优先，需在 *.csv 后重申 sample.csv 的例外
!data/sample.csv
!data/sample/
!data/sample/**/*.csv
```

### 数据项目的 .gitignore 模板

```gitignore
# =====================
# 数据文件（不进版本库）
# =====================
*.csv
*.parquet
*.orc
*.avro
*.json.gz
data/raw/
data/processed/
output/

# =====================
# 敏感配置（绝对不能进版本库！）
# =====================
.env
.env.local
.env.*.local
config/local.py
config/database_*.ini
credentials/
secrets/
*.pem
*.key

# =====================
# Python
# =====================
__pycache__/
*.py[cod]
*$py.class
*.pyc
*.pyo
.Python
env/
venv/
.venv/
ENV/
.pytest_cache/
.coverage
htmlcov/
dist/
build/
*.egg-info/

# =====================
# Jupyter Notebook
# =====================
.ipynb_checkpoints/
*.ipynb_checkpoints
# 如果不想忽略 notebook 本身，注释掉下面这行
# *.ipynb

# =====================
# IDE 配置
# =====================
.idea/
.vscode/
*.swp
*.swo
# macOS
.DS_Store
# Windows
Thumbs.db

# =====================
# 日志和临时文件
# =====================
*.log
logs/
tmp/
temp/
.cache/

# =====================
# 依赖目录
# =====================
node_modules/
.node_modules/
```

### 把 .gitignore 放在哪里

```bash
# 项目根目录（最常见）
/project-root/.gitignore

# 子目录（对该目录及其下级目录生效）
/project-root/data/.gitignore

# 全局 gitignore（对你所有项目生效，适合放 IDE 配置）
git config --global core.excludesfile ~/.gitignore_global
```

### 常见问题：文件已经被追踪了，加到 .gitignore 不生效

```bash
# 先从 Git 追踪中移除（不删除本地文件）
git rm --cached credentials.json
git rm --cached -r data/raw/

# 然后提交这个变更
git commit -m "chore: 将敏感文件从版本库中移除"

# 现在 .gitignore 的规则对这个文件生效了
```

> [!warning] 一旦密码进了 Git 历史，光删除文件是不够的
> 如果你不小心提交了密码，仅仅在 .gitignore 中添加并删除文件是不够的，因为历史记录里还存着。需要：
> 1. 立即更换泄露的密码/密钥（第一优先级）
> 2. 在备份并确认清理范围后，优先考虑使用 `git filter-repo` 或 `BFG Repo Cleaner` 清理历史；不要把 `git filter-branch` 当作常规首选
> 3. 与协作者及仓库管理员协调后，按托管平台要求更新受影响的远程引用；强制推送本身不能清除他人克隆、分叉或托管缓存中的副本
> 这个过程很麻烦，**最好的防范是建仓库第一件事就加好 .gitignore**。

### 查看某个文件为什么被忽略

```bash
git check-ignore -v data/raw/orders.csv
# 输出：
# .gitignore:5:data/raw/    data/raw/orders.csv
# 说明是 .gitignore 第 5 行的规则在起作用
```

---

## 实用技巧集锦

### 查看某行代码是谁写的（git blame）

数据质量问题，想知道某行 SQL 是谁改的：

```bash
git blame sql/orders_etl.sql

# 输出：
# a3f8b2c (Zhang San  2024-01-15 10:30:00 +0800 15) WHERE order_status = 'completed'
# 9e1d234 (Li Si      2024-01-20 14:22:33 +0800 16) AND user_type = 'VIP'
```

VS Code 安装 GitLens 插件后，鼠标悬停在代码行上就能看到谁改的、什么时候改的。

### 找回误删的提交（git reflog）

`git reflog` 可查看本地保留的 HEAD 引用更新记录，常用于寻找误操作前的提交；它不是所有操作的永久记录，也不会随普通推送同步到远程。

```bash
# 查看本地尚未过期的 HEAD 更新记录（可能包含 reset 前的提交）
git reflog

# 输出：
# a3f8b2c (HEAD -> main) HEAD@{0}: commit: fix: 修复NULL处理
# 9e1d234 HEAD@{1}: reset: moving to 9e1d234
# 7c2f891 HEAD@{2}: commit: feat: 添加周GMV指标（已被 reset 删除）

# 先创建救援分支，保留找到的提交及其历史
git branch rescue/recovered-commit 7c2f891
# 或者：在确认工作区干净、提交适合移植且无重复应用后，应用到当前分支
git cherry-pick 7c2f891
```

reflog 条目的默认过期设置通常为 90 天，不可达提交对应条目通常为 30 天，具体取决于配置和维护操作。能否恢复还取决于条目及提交对象是否仍存在；未提交且未暂存的工作区改动通常不能靠 reflog 恢复，不能把保留期限当作恢复保证。

### 查看某个提交的内容

```bash
# 查看某次提交改了什么
git show a3f8b2c

# 查看某次提交的某个文件
git show a3f8b2c:sql/orders_etl.sql

# 把某个历史版本的文件提取出来
git show a3f8b2c:sql/orders_etl.sql > /tmp/orders_etl_old.sql
```

### 统计代码贡献

```bash
# 查看每个人的提交数量
git shortlog -sn

# 查看某人的提交历史
git log --author="Zhang San" --oneline
```

---

## 小结

| 技巧 | 使用场景 | 核心命令 |
|------|---------|---------|
| stash | 临时保存未完成工作 | `git stash` / `git stash pop` |
| cherry-pick | 精准挑选某个提交 | `git cherry-pick <hash>` |
| rebase | 整理线性历史 | `git rebase main` |
| 交互式 rebase | 清理提交记录 | `git rebase -i HEAD~N` |
| tag | 标记重要版本 | `git tag -a v1.0 -m "..."` |
| .gitignore | 排除不需要追踪的文件 | 创建 `.gitignore` 文件 |
| blame | 查看谁改了哪行 | `git blame <file>` |
| reflog | 恢复误删提交 | `git reflog` |

---

---

> [!info] 前置知识
> - [[【技术与工具】/Git/06-冲突解决|冲突解决]] - 进阶技巧（如 rebase、cherry-pick）是在理解基本分支操作后才能安全使用的
> - [[【技术与工具】/Git/03-Git基础操作|Git基础操作]] - 熟练的 commit/add/log 操作是前提

---

## 掌握检查

- [ ] 能用 `git stash push -m "描述"` 保存当前未完成的工作，切到另一个任务后用 `git stash pop` 恢复
- [ ] 理解 `git rebase main` 的含义：把当前分支的提交"嫁接"到 main 最新节点上，让历史更线性
- [ ] 知道 `git cherry-pick <hash>` 的场景：把某个分支上的单个提交精准应用到当前分支
- [ ] 项目第一件事知道先创建好 `.gitignore`，并用 `git check-ignore -v` 验证规则是否生效
- [ ] 能用 `git reflog` 查找仍有记录的提交，并用 `git branch rescue/recovered-commit <hash>` 建立救援分支；知道 `git checkout <hash>` 只会进入该提交的 detached HEAD 状态

---

## 实践练习

**基础题**：在开发分支上用 `git stash` 保存 3 个未完成改动，切到 main 做一个紧急修复提交，再切回开发分支恢复 stash，验证改动保留完整。

**进阶题**：用 `git log -S "某段代码"` 找到某个特性是在哪次提交引入的，然后用 `git cherry-pick` 把这个提交应用到另一个分支（模拟"热修复移植"场景）。

---

下一步：[[【技术与工具】/Git/08-数据项目Git实践|数据项目Git实践]] - 把所有技能融合到数据工程实际工作中。

上一步：[[【技术与工具】/Git/06-冲突解决|冲突解决]] | 返回：[[【技术与工具】/Git/00-Git学习路线图|Git学习路线图]]
