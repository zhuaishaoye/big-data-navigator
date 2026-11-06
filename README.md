# 大数据领航员

面向数据开发与大数据工程实践的中文知识库。项目提供完整目录、搜索、大纲、
图谱、双链和主题切换，支持本地 Node 服务与 GitHub Pages 静态部署。全站正文
免费完整阅读，无需登录或会员权限。

## 本地运行

```bash
npm start
```

本机打开：

```text
http://localhost:4180/knowledge/Welcome
```

服务默认监听所有网络接口。同一局域网内的设备可以通过启动日志中输出的
`局域网访问` 地址打开；公网长期访问请使用 GitHub Pages 地址。

如需只允许本机访问：

```bash
HOST=127.0.0.1 npm start
```

默认端口为 `4180`，也可以显式指定：

```bash
PORT=4180 npm start
```

## 同步公开内容

项目已经包含同步后的文章。需要从源站重新同步公开内容时运行：

```bash
npm run sync
npm run verify
```

如果本地已有完整同步结果，只校验并刷新清单：

```bash
npm run sync -- --resume
npm run verify
```

- `public/assets/knowledge-reader/` 保存阅读器的公开静态运行资源。
- 如需重新补齐阅读器资源，运行 `npm run sync:reader`。
- `content/articles/` 保存全部 2,363 篇文章。
- `content/resources/` 保存目录中公开的样式、脚本、图标和文章资源。
- `content/sync-manifest.json` 记录同步数量、字节数和失败项。
- 1,380 篇原会员占位文章已用原创实践指南补全；没有复制原站隐藏会员正文，也没有绕过登录或会员权限。
- 需要重新生成已补全文章时运行 `npm run expand:members -- --force`。

## 构建静态站点

```bash
npm run build:pages
```

构建结果位于 `dist/`。它是完整静态站点，不依赖 Node 服务，可直接部署到任意静态托管。

## GitHub Pages

仓库已包含 `.github/workflows/pages.yml`。推送到 `main` 分支后，在仓库
`Settings -> Pages -> Source` 中选择 `GitHub Actions`，站点会发布到：

```text
https://<GitHub用户名>.github.io/big-data-navigator/knowledge/Welcome/
```

## 当前范围

- 完整保留 2,363 个文章路由，全部正文可阅读。
- 1,380 篇原会员占位文章已替换为中文实践内容，平均每篇约 4,000 字。
- 保留目录中公开的图片、样式、脚本和图标资源。
- 本地服务和 GitHub Pages 共用同一套动态子路径逻辑。
