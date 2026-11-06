---
title: Git基础操作 - 日常工作流完全指南
tags:
  - Git
  - 基础操作
  - commit
  - add
  - log
  - diff
  - 工作流
aliases:
  - Git日常命令
  - Git基本操作
difficulty: 中级
duration: 40分钟
knowledge_type: technical-practice
target_audience:
  - 数据从业者
  - 数据分析师
  - 数据开发工程师
  - 数据科学家
  - BI分析师
  - 数据治理工程师
  - 数据架构师
  - 数据运营
  - 数据产品经理
stability: stable
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


# Git 基础操作 - 日常工作流完全指南

> [!abstract] 本章概要
> - 理解 Git 的三个工作区域（工作区、暂存区、仓库）
> - 掌握 init、clone、add、commit、status、log、diff 等核心命令
> - 建立完整的日常 Git 工作流
> - 学会如何撤销操作和回退版本

---

## 三个工作区域的心智模型

在敲任何命令之前，先把这张图刻在脑子里：

```text
工作区                暂存区（Index）        本地仓库（HEAD）
(Working Directory)   (Staging Area)         (Repository)
       │                    │                      │
       │  修改/新增文件       │                      │
       │────────────────────►│  git commit          │
       │  git add            │─────────────────────►│
       │                     │                      │
       │◄────────────────────┼──────────────────────│
       │  git checkout / git restore                 │
```

- **工作区**：你实际编辑文件的地方，就是你看到的那些 `.py`、`.sql` 文件
- **暂存区**：一个"草稿区"，你决定要提交哪些变更，先放到这里
- **本地仓库**：正式的历史记录，每次 commit 后都会写到这里

> [!note] 为什么要有暂存区？
> 暂存区看起来多此一举，但它非常有用：你可以一次改了 5 个文件，只把其中 3 个相关的变更打包成一次有意义的 commit，另外 2 个文件等下次再提交。这样历史记录更干净，每个 commit 只做一件事。

---

## 创建仓库：init 和 clone

### 方式一：在已有项目上初始化

```bash
# 进入你的项目目录
cd ~/projects/data-pipeline

# 初始化 Git 仓库
git init
# 输出：Initialized empty Git repository in ~/projects/data-pipeline/.git/

# 查看当前状态
git status
```

`git init` 做了什么？它在当前目录创建了一个 `.git` 隐藏文件夹，从此这个目录就被 Git 管理了。

### 方式二：克隆已有仓库

```bash
# 克隆 GitHub 上的仓库（SSH 方式，推荐）
git clone git@github.com:your-org/data-warehouse.git

# 克隆到指定目录名
git clone git@github.com:your-org/data-warehouse.git my-local-name

# 克隆指定分支
git clone -b develop git@github.com:your-org/data-warehouse.git

# 克隆后自动进入目录
git clone git@github.com:your-org/data-warehouse.git && cd data-warehouse
```

> [!tip] 克隆 vs 初始化
> - 已有团队项目，要参与进去 → 用 `git clone`
> - 自己的新项目，要从零开始 → 用 `git init`，然后再连接远程仓库

---

## 查看状态：git status

`git status` 是你用得最频繁的命令之一，没事就看看。

```bash
git status
```

一个典型的输出：

```text
On branch main
Your branch is up to date with 'origin/main'.

Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
	modified:   sql/orders_etl.sql

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   scripts/data_clean.py

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	sql/new_metric.sql
```

理解这三种状态：

| 状态 | 含义 | 下一步 |
|------|------|-------|
| `Changes to be committed` | 已 add 到暂存区，等待 commit | `git commit` |
| `Changes not staged for commit` | 已修改但未 add | `git add` |
| `Untracked files` | 新文件，Git 还不知道它 | `git add` |

---

## 追踪变更：git add

`git add` 把变更从工作区移到暂存区。

```bash
# 添加单个文件
git add sql/orders_etl.sql

# 添加多个文件
git add sql/orders_etl.sql scripts/data_clean.py

# 添加某个目录下的所有变更
git add sql/

# 添加当前目录及其子目录下的所有变更（慎用！）
git add .
# 添加整个工作树中的所有变更；在仓库根目录执行时与上面范围相同
git add -A
```

> [!warning] 慎用 `git add .`
> `git add .` 会把当前目录的所有变更都加进去，包括你不想提交的临时文件、日志文件、本地配置等。养成明确指定文件或目录的习惯，或者配合 `.gitignore` 使用。见 [[【技术与工具】/Git/07-Git进阶技巧|07-Git进阶技巧]] 中的 .gitignore 配置。

### 交互式暂存（精细控制）

如果你修改了一个大文件，但只想提交其中部分修改：

```bash
# 交互式添加（按块添加）
git add -p sql/orders_etl.sql
# 或
git add --patch sql/orders_etl.sql
```

它会逐块展示变更，让你决定每块是否要加入暂存区（`y` 加入，`n` 跳过，`s` 拆分更细）。

---

## 提交变更：git commit

```bash
# 最常用：打开编辑器写提交信息
git commit

# 直接在命令行写提交信息（短小的时候用）
git commit -m "fix: 修复订单ETL中VIP折扣计算错误"

# 把所有已追踪文件的变更直接提交（跳过 git add，不推荐养成习惯）
git commit -am "fix: 修复计算逻辑"
```

### 怎么写好 commit message

commit message 是给未来的你（和你的同事）看的，写清楚很重要。

推荐格式（Conventional Commits）：

```text
<type>: <description>

[可选正文：更详细的说明]

[可选footer：相关 Issue 编号等]
```

常用的 type：
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档变更
- `refactor`: 代码重构（不新增功能，不修复 bug）
- `perf`: 性能优化
- `chore`: 杂务（如更新依赖，修改配置）

实际例子：

```bash
# 好的 commit message
git commit -m "feat: 新增用户分层指标 L1/L2/L3 逻辑"
git commit -m "fix: 修复 orders_etl 中时区处理导致的日期偏移"
git commit -m "refactor: 将 VIP 折扣计算抽取为独立函数"
git commit -m "perf: 为 user_id 添加索引，查询速度提升 60%"

# 糟糕的 commit message（没有任何信息量）
git commit -m "修改"
git commit -m "update"
git commit -m "fix bug"
git commit -m "改了一些东西"
```

> [!tip] commit message 原则
> 用一句话回答："这个 commit 做了什么？" 六个月后你看到这条记录，应该能立刻明白发生了什么，而不需要去读代码。

---

## 查看历史：git log

```bash
# 完整日志
git log

# 每条记录一行（最常用）
git log --oneline

# 带分支图的一行日志（查看分支合并历史）
git log --oneline --graph --all

# 最近 5 条
git log -5

# 查看某个文件的变更历史
git log --oneline -- sql/orders_etl.sql

# 搜索包含特定关键词的 commit
git log --grep="VIP"

# 查看某人的提交
git log --author="Zhang San"

# 查看某时间段的提交
git log --after="2024-01-01" --before="2024-03-01"
```

`git log --oneline --graph --all` 是查看分支历史的神器，输出类似：

```text
* a3f8b2c (HEAD -> main) fix: 修复时区问题
* 9e1d234 feat: 新增L3用户分层
| * 7c2f891 (feature/new-metric) feat: 新增GMV_7d指标
|/
* 4b5a6d7 refactor: 重构用户维度表
* 1e2c3b4 Initial commit
```

---

## 查看差异：git diff

`git diff` 是数据工作中非常实用的命令，比较文件变化。

```bash
# 查看工作区与暂存区的差异（已修改但未 add 的变更）
git diff

# 查看暂存区与最近提交的差异（已 add 但未 commit 的变更）
git diff --staged
# 或
git diff --cached

# 比较两个 commit 之间的差异
git diff a3f8b2c 9e1d234

# 比较某个 commit 与当前状态的差异
git diff HEAD~3

# 只查看某个文件的差异
git diff sql/orders_etl.sql

# 只显示改变了的文件名，不显示具体内容
git diff --name-only
```

diff 输出解读：

```diff
diff --git a/sql/orders_etl.sql b/sql/orders_etl.sql
index 1234567..abcdef0 100644
--- a/sql/orders_etl.sql        ← 改动前的文件
+++ b/sql/orders_etl.sql        ← 改动后的文件
@@ -15,7 +15,8 @@              ← 改动位置（前文件第15行，后文件第15行）
 SELECT
   user_id,
-  order_amount,                ← 删除的行（红色）
+  order_amount * 0.9 AS order_amount,  ← 新增的行（绿色）
+  'VIP' AS user_type,
 FROM orders
```

---

## 实战：完整的日常工作流

场景：你需要修改 SQL 脚本，增加 VIP 用户的折扣逻辑。

```bash
# 1. 先看看当前状态
git status
# On branch main，nothing to commit

# 2. 修改文件（用你的编辑器打开 sql/orders_etl.sql 并保存）

# 3. 查看你改了什么
git diff sql/orders_etl.sql
# 确认改动是你想要的

# 4. 把变更放入暂存区
git add sql/orders_etl.sql

# 5. 再次检查暂存区内容
git diff --staged

# 6. 提交
git commit -m "feat: 为VIP用户添加9折折扣计算"

# 7. 查看历史，确认提交成功
git log --oneline -3
```

---

## 撤销操作

这是最重要的部分之一：**出错了怎么办**。

### 场景一：修改了文件，还没 add，想撤销

```bash
# 丢弃指定已追踪文件的未暂存修改，恢复到暂存区的状态（该文件没有暂存变更时，暂存区内容通常与 HEAD 一致）
git restore sql/orders_etl.sql
# 旧版 Git 命令（效果相同）
git checkout -- sql/orders_etl.sql
```

> [!warning] 这个操作不可逆！
> `git restore <file>` 默认会用暂存区内容覆盖指定已追踪文件的未暂存修改，不会删除未追踪文件。未保存到提交、stash或备份的内容通常无法由Git恢复；执行前确认你真的不需要这些改动。

### 场景二：已经 add 到暂存区，想取消暂存

```bash
# 将该文件的暂存区内容恢复为 HEAD 版本，取消暂存（保留工作区文件修改）
git restore --staged sql/orders_etl.sql
# 旧版命令
git reset HEAD sql/orders_etl.sql
```

注意：文件的修改内容还在，只是不再处于"待提交"状态了。

### 场景三：已经 commit 了，想修改最后一次提交

```bash
# 修改最近一次 commit 的 message
git commit --amend -m "新的提交信息"

# 添加漏掉的文件到最近一次 commit
git add 漏掉的文件.sql
git commit --amend --no-edit
```

> [!warning] amend 只能用于还没有 push 的 commit
> 如果已经 push 到远程，`amend` 会重写提交，普通 push 通常会被拒绝；强制推送可能影响所有拉取了这个分支的人。本文不演示重写共享分支历史，应按团队流程新增修正提交或使用 `revert`。规则：**不要修改已经公开的历史**。

### 场景四：想回退到某个历史版本

```bash
# 查看历史，找到目标版本的哈希值
git log --oneline
# a3f8b2c feat: 新增VIP折扣
# 9e1d234 refactor: 重构用户维度
# 4b5a6d7 Initial commit

# 方式一：soft reset（回退提交，但保留文件修改在暂存区）
git reset --soft 9e1d234

# 方式二：mixed reset（回退提交，保留文件修改在工作区）
git reset 9e1d234
# 等价于 git reset --mixed 9e1d234

# 方式三：hard reset（移动当前分支并重置暂存区和工作区，丢弃已追踪文件的未提交变更）
git reset --hard 9e1d234
```

> [!warning] `git reset --hard` 极度危险
> 这个命令会移动当前分支到目标提交，并重置暂存区和工作区，丢弃已追踪文件的未提交变更；阻碍写入目标版本的未追踪文件或目录也可能被删除。它不会立即删除后续提交对象，原提交有时可通过 `reflog` 找回，但未提交内容不能据此保证恢复。执行前务必备份、确认目标，不要用它回退共享分支历史。

### 场景五：想回退某个文件到历史版本（不影响其他文件）

这是数据工作中最常用的回退场景：某个 SQL 脚本改出问题了，只想回退这一个文件。

```bash
# 查看这个文件的历史
git log --oneline -- sql/orders_etl.sql

# 把这个文件恢复到某个历史版本
git checkout 9e1d234 -- sql/orders_etl.sql

# 文件已恢复，此时在暂存区，确认后提交
git status
git diff --staged
git commit -m "revert: 回退orders_etl到修复前的版本"
```

### 场景六：用 revert 安全地撤销某次提交

当你想撤销一个已经 push 到远程的提交（不改历史，而是新增一个"撤销"提交）：

```bash
# 找到要撤销的 commit 哈希
git log --oneline

# 新增一个逆向提交来撤销效果
git revert a3f8b2c
# Git 会打开编辑器让你写提交信息，保存关闭即可

# revert 完后，push 到远程
git push
```

`revert` 比 `reset` 安全得多，因为它不修改历史，只是追加一个新的撤销提交。**团队协作项目出了问题，用 `revert`，不要用 `reset`**。

---

## 实战场景：SQL 脚本上线出 bug，紧急回退

```bash
# 1. 发现 bug，确认问题所在
git log --oneline -- sql/orders_etl.sql

# 2. 找到最近一次稳定版本的 hash
# 假设是 9e1d234

# 3. 先不动远程，在本地验证回退效果
git show 9e1d234:sql/orders_etl.sql
# 查看这个版本的内容，确认是你想回退到的状态

# 4. 创建紧急修复分支（好习惯）
git checkout -b hotfix/revert-orders-etl

# 5. 回退文件
git checkout 9e1d234 -- sql/orders_etl.sql

# 6. 验证内容
git diff HEAD sql/orders_etl.sql

# 7. 提交
git commit -m "revert: 紧急回退orders_etl到v9e1d234版本（VIP折扣计算有误）"

# 8. 推送并合并到 main
git push origin hotfix/revert-orders-etl
# 然后在 GitHub/GitLab 上创建 PR 合并
```

---

## git stash：临时保存工作

当你正在改代码，突然有个紧急任务要处理当前分支的其他事情：

```bash
# 保存已追踪文件的工作区和暂存区变更到 stash（默认不包含未追踪及忽略文件）
git stash

# 查看 stash 列表
git stash list

# 恢复 stash（弹出最近一个）
git stash pop

# 详见进阶技巧章节
```

Stash 的详细用法在 [[【技术与工具】/Git/07-Git进阶技巧|07-Git进阶技巧]] 中有专门讲解。

---

## 小结：日常工作流备忘

```text
开始工作时
  git pull                 ← 先拉取最新代码

工作中
  git status               ← 随时看状态
  git diff                 ← 看具体改了什么

准备提交
  git add <files>          ← 选择要提交的变更
  git diff --staged        ← 再确认一遍
  git commit -m "..."      ← 提交，写好 message

提交后
  git log --oneline        ← 确认提交成功
  git push                 ← 推送到远程
```

---

---

> [!info] 前置知识
> - [[【技术与工具】/Git/02-Git安装与配置|Git安装与配置]] - Git 已安装，user.name/user.email 已配置，SSH 连接已通
> - [[【技术与工具】/Git/01-版本控制概念|版本控制概念]] - 理解工作区、暂存区、仓库的三区模型

---

## 掌握检查

- [ ] 能不查文档地写出"修改文件 → 暂存 → 提交"的完整命令序列（`status → diff → add → diff --staged → commit`）
- [ ] 能用 `git log --oneline --graph` 查看分支结构，能用 `git show <hash>` 查看某次提交的具体改动
- [ ] 理解 `git add -p` 的作用：可以把同一个文件的不同改动分批次提交，而不是整个文件一起提交
- [ ] 遇到"不小心改错了文件"知道用 `git restore`，遇到"提交了但发现写错"知道用 `git commit --amend`（仅在未 push 时）
- [ ] 能写出符合团队规范的 commit message（如 `feat:`、`fix:`、`chore:` 前缀约定）

---

## 实践练习

**基础题**：克隆任意 GitHub 开源仓库，修改 README.md 中的一行内容，完成 `add → commit` 流程，用 `git log --oneline` 验证提交出现在历史中，再用 `git diff HEAD~1` 查看这次提交的差异。

**进阶题**：模拟"SQL 脚本上线出 bug 回退"场景：创建一个 SQL 文件并提交两次（两次都有实质改动），然后用 `git revert <hash>` 安全撤销第二次提交（不删历史），确认文件内容已回退，历史记录中出现了 `revert` 提交。

---

下一步：[[【技术与工具】/Git/04-分支管理|分支管理]] - 学会用分支并行处理多个任务，这是 Git 最强大的特性。

上一步：[[【技术与工具】/Git/02-Git安装与配置|Git安装与配置]] | 返回：[[【技术与工具】/Git/00-Git学习路线图|Git学习路线图]]
