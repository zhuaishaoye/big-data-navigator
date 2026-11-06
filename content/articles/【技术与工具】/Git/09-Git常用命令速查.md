---
title: Git常用命令速查 - 按场景分类速查表
tags:
  - Git
  - 命令速查
  - 速查表
  - cheatsheet
aliases:
  - Git命令大全
  - Git速查表
  - Git cheatsheet
difficulty: 中级
duration: 随用随查
knowledge_type: reference
target_audience:
  - 数据从业者
  - 数据开发工程师
  - 数据分析师
  - 数据科学家
  - BI分析师
  - 数据治理工程师
  - 数据架构师
stability: stable
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


# Git 常用命令速查 - 按场景分类速查表

> [!abstract] 使用说明
> 本文按工作场景分类整理了最常用的 Git 命令。书签收藏备用，用到时来查。
> 命令里的 `<angle-brackets>` 表示你要替换的内容，`[square-brackets]` 表示可选参数。

---

## 初始化与克隆

```bash
# 初始化新仓库
git init

# 克隆远程仓库
git clone <repo-url>
git clone <repo-url> <local-dir-name>

# 克隆指定分支
git clone -b <branch> <repo-url>

# 浅克隆（只获取最近N次提交，适合大仓库快速克隆）
git clone --depth 10 <repo-url>
```

---

## 配置管理

```bash
# 查看所有配置
git config --list
git config --list --show-origin    # 显示配置来自哪个文件

# 设置全局用户信息
git config --global user.name "Your Name"
git config --global user.email "you@example.com"

# 设置默认编辑器
git config --global core.editor "code --wait"   # VS Code
git config --global core.editor "vim"

# 设置默认分支名
git config --global init.defaultBranch main

# 设置 pull 策略
git config --global pull.rebase true

# 查看某项配置
git config user.name
```

---

## 日常状态查看

```bash
# 查看工作区状态
git status
git status -s          # 简洁输出

# 查看变更内容
git diff                        # 工作区 vs 暂存区
git diff --staged               # 暂存区 vs 最新提交
git diff HEAD                   # 工作区 vs 最新提交
git diff <commit1> <commit2>    # 两个提交之间的差异
git diff <branch1>..<branch2>   # 两个分支之间的差异
git diff --name-only            # 只显示有变更的文件名
```

---

## 暂存与提交

```bash
# 添加到暂存区
git add <file>
git add <dir>/
git add .                     # 当前目录所有变更（慎用）
git add -p <file>             # 交互式按块添加

# 提交
git commit -m "提交信息"
git commit                    # 打开编辑器写提交信息
git commit -am "提交信息"     # 自动暂存已追踪文件的修改/删除并提交，也提交已暂存内容；不自动添加未追踪文件（慎用）

# 修改最后一次提交（仅限未 push 的情况）
git commit --amend -m "新的提交信息"
git commit --amend --no-edit   # 将已暂存的新增、修改或删除纳入最后一次提交，保留原 message
```

---

## 查看历史

```bash
# 基本日志
git log
git log --oneline              # 每行一条
git log --oneline --graph --all  # 带分支图（最有用！）
git log -5                     # 最近5条

# 过滤
git log --author="Zhang San"
git log --grep="关键词"
git log --after="2024-01-01" --before="2024-03-01"
git log -- sql/orders_etl.sql  # 某个文件的历史

# 查看某次提交内容
git show <commit-hash>
git show <commit-hash>:<file-path>   # 查看某次提交中某个文件的内容

# 查看操作历史（救命命令）
git reflog
```

---

## 分支管理

```bash
# 查看分支
git branch               # 本地分支
git branch -a            # 所有分支（含远程）
git branch -v            # 查看每个分支的最新提交
git branch --merged      # 已合并的分支
git branch --no-merged   # 未合并的分支

# 创建分支
git branch <branch-name>
git switch -c <branch-name>          # 创建并切换（推荐）
git checkout -b <branch-name>         # 旧版写法

# 切换分支
git switch <branch-name>
git switch -                          # 切换到上一个分支

# 重命名
git branch -m <old-name> <new-name>

# 删除分支
git branch -d <branch>               # 安全删除（已合并）
git branch -D <branch>               # 强制删除
git push origin --delete <branch>    # 删除远程分支
```

---

## 合并操作

```bash
# 合并分支（先切到目标分支）
git switch main
git merge <source-branch>
git merge --no-ff <source-branch>    # 保留合并记录（推荐）
git merge --squash <source-branch>   # 将合并结果放入工作区和暂存区，不自动提交；解决冲突后需另行 git commit

# 终止合并
git merge --abort

# cherry-pick：挑选某个提交
git cherry-pick <commit-hash>
git cherry-pick <commit1> <commit2>  # 多个
git cherry-pick --abort

# Rebase
git rebase <base-branch>
git rebase -i HEAD~N     # 交互式整理最近N次提交
git rebase --continue    # 解决冲突后继续
git rebase --abort       # 放弃 rebase
```

---

## 远程仓库

```bash
# 查看远程仓库
git remote -v

# 添加/修改/删除远程仓库
git remote add origin <url>
git remote set-url origin <new-url>
git remote remove <name>

# 推送
git push -u origin <branch>    # 首次推送，建立追踪关系
git push                        # 后续推送（已建立追踪）
git push origin <branch>
git push --tags                 # 推送所有 tag
git push origin --delete <branch>  # 删除远程分支

# 拉取
git fetch origin                # 只下载，不合并
git fetch --all                 # 下载所有远程的内容
git pull                        # 下载后按参数和配置整合，可能 merge 或 rebase；分叉且未指定策略时可能拒绝执行
git pull --rebase               # 下载 + rebase（推荐）

# 查看远程分支
git branch -r

# 基于远程分支创建本地分支
git switch --track origin/<branch>
git checkout -b <local> origin/<remote>
```

---

## 撤销操作

```bash
# 丢弃工作区修改（未 add，不可逆！）
git restore <file>
git checkout -- <file>          # 旧版写法

# 取消暂存（移出暂存区，保留修改）
git restore --staged <file>
git reset HEAD <file>           # 旧版写法

# 撤销某次提交（新增一个反向提交，安全）
git revert <commit-hash>
git revert HEAD                 # 撤销最近一次提交

# 回退（改变 HEAD 指针）
git reset --soft HEAD~1         # 回退1个提交，保留变更在暂存区
git reset HEAD~1                # 回退1个提交，保留变更在工作区
git reset --hard HEAD~1         # 回退1个提交，丢弃所有变更（危险！）
git reset --hard <commit>       # 回退到指定提交（危险！）

# 恢复某个文件到历史版本
git checkout <commit> -- <file>
git restore --source=<commit> <file>  # 仅恢复工作区；上面的 checkout 写法同时更新暂存区和工作区
```

> [!warning] reset --hard 会重置暂存区和工作区，未提交内容可能无法恢复；已提交历史在 reflog 尚保留且对象未被清理时可能找回，但不保证成功。请先检查状态、备份未提交内容并确认协作边界。

---

## Stash（临时保存）

```bash
# 保存当前工作
git stash
git stash push -m "描述信息"
git stash push -u               # 同时 stash 未追踪的文件

# 查看 stash 列表
git stash list

# 查看 stash 内容
git stash show
git stash show -p               # 显示详细 diff

# 恢复 stash
git stash pop                   # 应用最近一个 stash；成功后删除，发生冲突时保留 stash，需手动处理
git stash apply stash@{N}       # 应用指定 stash（不删除）

# 删除 stash
git stash drop stash@{N}
git stash clear                 # 清空所有
```

---

## Tag 标签

```bash
# 创建 tag
git tag v1.0.0                              # 轻量 tag
git tag -a v1.0.0 -m "版本说明"             # 带注释的 tag（推荐）
git tag -a v0.9.0 <commit-hash> -m "说明"  # 给历史提交打 tag

# 查看 tag
git tag
git tag -l "v1.*"               # 过滤
git show v1.0.0

# 推送 tag
git push origin v1.0.0
git push origin --tags          # 推送所有 tag

# 删除 tag
git tag -d v1.0.0               # 删除本地
git push origin --delete v1.0.0 # 删除远程

# 基于 tag 创建分支
git checkout -b <branch> v1.0.0
```

---

## 调试与追踪

```bash
# 查看某行代码是谁写的
git blame <file>
git blame -L 10,20 <file>      # 只看第10-20行

# 找到引入 bug 的提交（二分查找）
git bisect start
git bisect bad                  # 当前版本有 bug
git bisect good <commit>        # 这个版本没 bug
# Git 会自动切换到中间版本让你测试
# 测试后告诉 Git 结果
git bisect good   # 或
git bisect bad
# 重复直到找到引入 bug 的提交
git bisect reset  # 结束查找

# 搜索提交内容
git log -S "关键词"             # 找新增或删除了这个关键词的提交
git log -G "正则表达式"         # 用正则搜索
```

---

## 统计与信息

```bash
# 统计贡献
git shortlog -sn                # 按提交数排序
git shortlog -sn --no-merges    # 不含 merge commit

# 查看仓库大小
git count-objects -vH

# 查看某文件的历史
git log --follow -- <file>      # 追踪文件重命名
git log -p -- <file>            # 带 diff 的历史

# 查看两个分支的差异
git log main..feature --oneline  # feature 有但 main 没有的提交
git diff main...feature          # 比较 main 与 feature 的合并基点和 feature 当前提交的文件差异
```

---

## 清理操作

```bash
# 清理未追踪文件（查看会被删除什么）
git clean -n

# 执行清理（删除未追踪文件）
git clean -f

# 删除未追踪的目录
git clean -fd

# 查看所有忽略的文件
git ls-files --others --ignored --exclude-standard

# 查看某文件为什么被忽略
git check-ignore -v <file>

# 移除文件的 Git 追踪（不删除本地文件）
git rm --cached <file>
git rm --cached -r <dir>
```

---

## 常用场景速查

### 我改错分支了，变更移到正确分支

```bash
# 把变更 stash 到正确分支
git stash
git switch correct-branch
git stash pop
```

### 我的 commit 提交到了 main，应该在 feature 分支上

```bash
# 创建 feature 分支（保留这些提交）
git switch -c feature/my-feature

# 回退本地 main 到之前的状态（危险：先备份未提交内容，确认这些提交尚未共享；已共享时应协商并优先考虑 revert）
git switch main
git reset --hard HEAD~N  # N 是要撤销的提交数
```

### 我想看某次提交改了什么

```bash
git show <commit-hash>
git diff <commit-hash>~1 <commit-hash>   # 某次提交前后的差异
```

### 忘记在哪个分支改了某行代码

```bash
git log -S "关键代码片段" --oneline
git log --all --format=%H | while read -r commit; do git grep -n "关键词" "$commit"; done
```

### 清理所有已合并到 main 的本地分支

```bash
git branch --merged main | grep -v "^\*\|main\|develop" | xargs git branch -d
```

---

## 命令别名（提升效率）

在 `~/.gitconfig` 中添加常用别名：

```ini
[alias]
    st = status
    co = checkout
    sw = switch
    br = branch
    ci = commit
    lg = log --oneline --graph --all --decorate
    lga = log --graph --all --decorate --format='%h %d %s (%ar)'
    diff-staged = diff --staged
    undo = restore
    unstage = restore --staged
    last = log -1 HEAD
    aliases = config --get-regexp alias
```

使用示例：

```bash
git st                  # git status
git sw main            # git switch main
git lg                 # 带图的日志（最常用！）
git last               # 查看最近一次提交
```

---

返回：[[【技术与工具】/Git/00-Git学习路线图|00-Git学习路线图]]
