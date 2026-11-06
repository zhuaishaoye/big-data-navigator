---
title: GitHub与GitLab使用 - Issue管理、CI/CD与GitHub Actions
tags:
  - Git
  - GitHub
  - GitLab
  - CI/CD
  - GitHub Actions
  - Issue管理
  - 代码托管
aliases:
  - GitHub使用指南
  - GitLab使用指南
  - GitHub Actions入门
difficulty: 中级
duration: 45分钟
knowledge_type: technical-practice
target_audience:
  - 数据开发工程师
  - 数据治理工程师
  - 数据架构师
  - 数据分析师
  - 数据科学家
  - BI分析师
stability: fast-changing
status: maintenance
access_tier: free
created: 2026-03-18
updated: 2026-10-10
---


# GitHub 与 GitLab 使用 - Issue 管理、CI/CD 与 GitHub Actions

> [!abstract] 本章概要
> - GitHub 与 GitLab 的定位与差异
> - Issue 管理：需求追踪与 bug 追踪
> - Pull Request / Merge Request 深度使用
> - CI/CD 基础概念与配置
> - GitHub Actions 入门
> - Wiki 文档管理

---

## GitHub 与 GitLab：如何选择

| 对比维度 | GitHub | GitLab |
|---------|--------|--------|
| 定位 | 全球最大开源社区 | 企业 DevOps 平台 |
| 私有化部署 | 有限（Enterprise 版） | 完整支持，Community Edition 免费 |
| CI/CD | GitHub Actions（强大） | GitLab CI/CD（功能更全面） |
| Issue 追踪 | 简洁好用 | 功能更完整（里程碑、迭代等） |
| 国内访问 | 偶尔不稳定 | 公司私有化部署无障碍 |
| 开源生态 | 绝对主流 | 较少 |
| 企业使用 | 中小型团队多 | 大型企业内部多 |

**数据工程师的现实**：
- 个人项目、学习、开源 → GitHub
- 公司内部项目 → 大概率是公司自建 GitLab

---

## Issue 管理

Issue 是项目管理的核心工具，不只是用来报 bug，而是**所有需要追踪的事项**：新功能需求、技术债务、文档任务、问题讨论都可以用 Issue 管理。

### 创建有效的 Issue

**Bug 报告模板**：

```markdown
## 问题描述

orders_etl 在处理退款订单时，金额计算错误，负数订单没有被正确排除。

## 复现步骤

1. 在测试环境运行 `sql/dwd/dwd_trade_order_detail_di.sql`
2. 查询 order_amount < 0 的记录
3. 可以看到退款订单被计入了 GMV

## 预期结果

退款订单（order_amount < 0）不应该出现在 GMV 统计中。

## 实际结果

GMV 数字偏低，经查是退款被计入了负的 GMV。

## 环境信息

- 日期：2024-03-15
- 分支：main
- 相关文件：sql/dwd/dwd_trade_order_detail_di.sql

## 截图/日志

（附上查询结果截图）
```

**功能需求模板**：

```markdown
## 需求背景

业务方需要在月报中展示用户留存率数据，目前需要手工计算，效率低。

## 期望功能

新增用户月度留存率指标，支持：
- 按注册月份的留存率（第1/2/3/6/12个月）
- 区分新用户 vs 老用户

## 优先级

P1（月报在本月底需要用到）

## 关联文档

- 指标定义：见飞书文档 xxx
- 数据来源：dwd_user_behavior_di
```

### Issue 标签管理

合理使用标签让 Issue 一目了然：

| 标签 | 含义 | 颜色建议 |
|------|------|---------|
| `bug` | 功能异常 | 红色 |
| `enhancement` | 功能增强 | 蓝色 |
| `data-quality` | 数据质量问题 | 橙色 |
| `performance` | 性能优化 | 黄色 |
| `documentation` | 文档任务 | 绿色 |
| `P0/P1/P2` | 优先级 | 红/橙/灰 |
| `good first issue` | 适合新人的任务 | 浅绿 |

### Issue 与 PR 的关联

在 GitHub PR 描述中用关闭关键词关联 Issue；PR 合并到仓库默认分支时，符合条件的关联 Issue 会自动关闭。合并到非默认分支不应期待自动关闭；GitLab MR 的关闭规则需按其平台配置确认：

```markdown
## 关联 Issue

Closes #42     （关闭）
Fixes #42      （修复）
Resolves #42   （解决）
```

---

## Pull Request 高级技巧

### Draft PR（草稿 PR）

当功能还在开发中，想让别人提早看看方向是否对，可以创建 Draft PR：

```bash
# 在 GitHub 上创建 PR 时选择 "Create draft pull request"
# 或者命令行
gh pr create --draft
```

Draft PR 不能被合并，提醒审查者这还是进行中的工作。

### 代码审查中的高效沟通

**在 PR 中提建议（Suggestion）**

GitHub 支持在代码审查评论中直接提供代码修改建议，作者可以一键接受：

```suggestion
  AND user_type = 'VIP'
  AND order_status IN ('completed', 'shipped')
```

作者看到建议后点 "Accept suggestion" 直接应用，不需要本地修改后再 push。

**使用 Review 功能而不是逐条评论**

别用一次一个评论的方式，积累所有意见后统一提交 Review：

1. 在每处代码行旁边点 "+" 开始评论
2. 点 "Start a review" 而不是 "Add single comment"
3. 评论完所有地方后，点 "Finish your review"
4. 选择 "Approve"、"Comment" 或 "Request changes"

### 使用 GitHub CLI (gh)

安装 GitHub CLI 后，很多操作可以在命令行完成：

```bash
# 安装
brew install gh
# 登录
gh auth login

# 创建 PR
gh pr create --title "feat: 新增周GMV指标" --body "..." --base develop

# 查看 PR 列表
gh pr list

# 合并 PR
gh pr merge 42 --squash

# 查看 Issues
gh issue list
gh issue create --title "bug: 退款订单计入GMV" --body "..." --label "bug,P1"

# 快速克隆仓库
gh repo clone org/data-warehouse
```

---

## CI/CD 基础概念

CI/CD 是 **Continuous Integration（持续集成）** 和 **Continuous Delivery/Deployment（持续交付/部署）** 的缩写。

### 持续集成（CI）是什么

每次 push 代码时，自动运行一系列检查：
- 代码格式检查（linting）
- 单元测试
- SQL 语法检查
- 安全扫描

目的：**在最早的时机发现问题**，而不是等到代码上线后才发现。

```text
开发者 push → 触发 CI → 自动检查 → 通过则可合并 PR
                          ↓ 失败
                     通知开发者修复
```

### 持续交付（CD）是什么

代码通过所有检查后，自动或半自动地部署到目标环境：

```text
PR 合并到 develop → 自动部署到测试环境
                  → 自动运行集成测试
                  → 通过后可以手动触发生产部署
```

---

## GitHub Actions 入门

GitHub Actions 是 GitHub 内置的 CI/CD 系统，配置简单，免费使用（有限额）。

### 核心概念

| 概念 | 说明 |
|------|------|
| Workflow | 一套自动化流程，存储在 `.github/workflows/` 目录下 |
| Trigger | 触发条件（push、PR、定时等） |
| Job | 工作流中的一个任务单元 |
| Step | Job 中的单个步骤 |
| Action | 可复用的操作单元（可以用官方的，也可以自己写） |

### 第一个 GitHub Actions：Python 代码检查

在项目根目录创建 `.github/workflows/ci.yml`：

```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest

    steps:
      # 检出代码
      - name: Checkout code
        uses: actions/checkout@v4

      # 配置 Python 环境
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'

      # 安装依赖
      - name: Install dependencies
        run: |
          pip install --upgrade pip
          pip install -r requirements.txt
          pip install flake8 black pytest

      # 代码格式检查
      - name: Lint with flake8
        run: |
          flake8 src/ --max-line-length=100 --ignore=E501

      # 代码风格检查
      - name: Check formatting with black
        run: |
          black --check src/

      # 运行单元测试
      - name: Run tests
        run: |
          pytest tests/ -v --tb=short
```

### SQL 检查 Workflow

```yaml
name: SQL Lint

on:
  pull_request:
    paths:
      - 'sql/**/*.sql'   # 只有 SQL 文件变更时才触发

jobs:
  sql-lint:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Install sqlfluff
        run: pip install sqlfluff

      - name: Lint SQL files
        run: |
          sqlfluff lint sql/ \
            --dialect hive \
            --rules L001,L002,L003,L010,L011
```

### 定时任务 Workflow

```yaml
name: Data Quality Check

on:
  schedule:
    - cron: '0 8 * * *'   # 每天早上 8 点触发（UTC时间）

  workflow_dispatch:         # 也支持手动触发

jobs:
  quality-check:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Run data quality checks
        env:
          DB_HOST: ${{ secrets.DB_HOST }}
          DB_PASSWORD: ${{ secrets.DB_PASSWORD }}   # 从 Secrets 读取
        run: |
          python scripts/run_quality_checks.py
```

> [!tip] Secrets 的配置
> 在 GitHub 仓库设置中，找到 Settings → Secrets and variables → Actions，添加 DB_PASSWORD 等敏感信息。这样 Workflow 可以用 `${{ secrets.SECRET_NAME }}` 读取；已保存的值通常不能在设置页面直接回显，但执行工作流的代码仍可使用它，并可能将其外传。日志遮罩不是绝对防泄露保证，应限制工作流权限、审查第三方 Action，避免向不可信代码提供凭据。

### 实用的数据项目 Workflow 集合

```yaml
name: Data Pipeline CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  # Job 1: Python 代码检查
  python-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install flake8 black mypy
      - run: flake8 src/
      - run: black --check src/
      - run: mypy src/ --ignore-missing-imports

  # Job 2: SQL 语法检查
  sql-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install sqlfluff
      - run: sqlfluff lint sql/ --dialect hive

  # Job 3: 安全检查（查找潜在的密码泄露）
  security-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check for secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}

  # Job 4: 单元测试（依赖前两个 Job 通过）
  test:
    needs: [python-check, sql-check]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -r requirements.txt pytest
      - run: pytest tests/ -v
```

---

## GitLab CI/CD

公司内部 GitLab 用的是 `.gitlab-ci.yml` 而不是 GitHub Actions 的格式，但概念类似。

```yaml
# .gitlab-ci.yml

stages:
  - lint
  - test
  - deploy

variables:
  PIP_CACHE_DIR: "$CI_PROJECT_DIR/.cache/pip"

cache:
  paths:
    - .cache/pip/

# 代码检查
python-lint:
  stage: lint
  image: python:3.11
  script:
    - pip install flake8 black
    - flake8 src/
    - black --check src/
  rules:
    - if: $CI_MERGE_REQUEST_ID    # 只在 MR 时运行

# SQL 检查
sql-lint:
  stage: lint
  image: python:3.11
  script:
    - pip install sqlfluff
    - sqlfluff lint sql/ --dialect hive
  rules:
    - changes:
        - sql/**/*.sql            # 只有 SQL 变更时运行

# 单元测试
unit-test:
  stage: test
  image: python:3.11
  script:
    - pip install -r requirements.txt pytest
    - pytest tests/ -v --junitxml=report.xml
  artifacts:
    reports:
      junit: report.xml          # 测试报告集成到 GitLab UI

# 部署到测试环境（develop 分支流水线满足下方规则时运行，不仅限于合并）
deploy-dev:
  stage: deploy
  script:
    - echo "部署到测试环境"
    - ./scripts/deploy.sh dev
  environment:
    name: development
  rules:
    - if: $CI_COMMIT_BRANCH == "develop"
```

---

## Wiki 文档管理

GitHub 和 GitLab 都提供 Wiki 功能，适合放：
- 项目背景和架构文档
- 开发环境搭建指南
- 数据字典
- 常见问题解答

> [!note] Wiki vs 代码仓库文档
> Wiki 适合经常变化、格式多样的文档。但**技术规范和关键配置文档**更适合放在代码仓库里（如 `docs/` 目录），这样文档和代码同步变更，方便 Code Review 时一起审查。

### 推荐的代码仓库文档结构

```text
docs/
├── architecture/
│   ├── data-model.md            # 数据模型说明
│   └── etl-pipeline.md          # ETL 流程说明
├── guides/
│   ├── development-setup.md     # 开发环境搭建
│   ├── deployment.md            # 部署指南
│   └── contributing.md          # 贡献指南
├── metrics/
│   ├── gmv.md                   # GMV 指标定义
│   └── user-retention.md        # 留存率指标定义
└── runbooks/
    ├── incident-response.md     # 故障响应流程
    └── data-quality-issue.md    # 数据质量问题处理
```

---

## GitHub 常用插件与辅助工具

提升 GitHub 使用体验的工具：

| 工具 | 功能 | 安装方式 |
|------|------|---------|
| **Octotree** | 在 GitHub 左侧显示文件树，快速导航 | Chrome/Firefox 插件 |
| **GitLens** | VS Code 插件，代码行 blame 信息 | VS Code 扩展市场 |
| **GitHub CLI (gh)** | 命令行操作 GitHub，高效 | brew install gh |
| **Refined GitHub** | 增强 GitHub 界面，很多小优化 | Chrome/Firefox 插件 |

---

## 小结

| 功能 | GitHub | GitLab |
|------|--------|--------|
| CI/CD 配置文件 | `.github/workflows/*.yml` | `.gitlab-ci.yml` |
| PR/MR | Pull Request | Merge Request |
| 自动化引擎 | GitHub Actions | GitLab CI/CD |
| 命令行工具 | `gh` | `glab` |

---

---

> [!info] 前置知识
> - [[【技术与工具】/Git/05-远程仓库协作|远程仓库协作]] - 理解 push/pull/PR 的基本概念，本文是这些概念在平台层面的深化
> - [[【技术与工具】/Git/08-数据项目Git实践|数据项目Git实践]] - 了解数据项目的 Git 工作流，才能在 GitHub/GitLab 上有效配置

---

## 掌握检查

- [ ] 能在 GitHub 上完成完整的 Pull Request 流程：创建 PR → 填写描述（背景+改动+测试方式）→ Review 别人的 PR → 合并
- [ ] 知道如何为仓库的 main 分支设置保护规则（Branch Protection Rule），要求 PR Review 才能合并
- [ ] 能读懂简单的 GitHub Actions workflow 文件，知道 `on:`、`jobs:`、`steps:` 各节的含义
- [ ] 用过 Issue 跟踪任务，知道如何在 commit message 中用 `#123` 关联 Issue
- [ ] 能区分 GitHub Actions（`.github/workflows/`）和 GitLab CI/CD（`.gitlab-ci.yml`）的配置方式

---

## 实践练习

**基础题**：在 GitHub 上为你的一个项目仓库创建一个 GitHub Actions workflow，触发条件为 push 到 main，执行步骤为：checkout 代码 → 安装 Python → 运行 `python -m py_compile` 检查所有 `.py` 文件语法（模拟最简单的 CI）。

**进阶题**：为你的数据项目仓库配置 main 分支保护规则（如果没有 GitHub 付费账号，在 GitLab 免费版或本地 Gitea 上实验也可），要求：(1) 禁止直接 push；(2) 合并前需要至少 1 个 approval；(3) 验证保护规则生效（尝试直接 push 会被拒绝）。

---

上一步：[[【技术与工具】/Git/08-数据项目Git实践|数据项目Git实践]] | 返回：[[【技术与工具】/Git/00-Git学习路线图|Git学习路线图]] | 命令速查：[[【技术与工具】/Git/09-Git常用命令速查|Git命令速查]]
