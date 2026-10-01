# 部署 Airglow

仓库：https://github.com/Allenxia814/Allenxia814.github.io

博客：https://allenxia814.github.io/

后台：https://allenxia814.github.io/admin/

## 1. GitHub Pages

把代码推送到 `main`，在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。在 **Actions** 中等待 `Deploy Airglow to GitHub Pages` 完成；需要时手动运行该工作流。

每次向 `main` 提交文章或修改配置，工作流会检查项目、构建网站、生成 Pagefind 搜索索引并部署。首次部署不要求后台和评论已配置。

## 2. 评论

1. 仓库 **Settings → General → Features** 勾选 **Discussions**。
2. 在 https://github.com/apps/giscus 安装 giscus，选择 **Only select repositories**，仅勾选 `Allenxia814.github.io`。
3. 打开 https://giscus.app/zh-CN ，填写 `Allenxia814/Allenxia814.github.io`，分类选 **Announcements**。
4. 在生成的代码中找到 `data-category-id`。仓库 **Settings → Secrets and variables → Actions → Variables → New repository variable** 新增 `PUBLIC_GISCUS_CATEGORY_ID`，值为该分类 ID。它是公开配置，可以发给我协助填写。
5. 重新运行部署工作流。登录 GitHub 后可评论；评论存放于 Discussions，仓库所有者可管理。

文章使用完整路径关联评论，更改文章文件名会改变评论关联；编辑正文和隐藏后恢复不会改变路径。切换文章和博客明暗主题时，评论也会更新。

## 3. 仅自己可登录的文章后台

当前验证服务已部署在 https://airglow-github-auth.github-oauth.workers.dev ，`STATE_SECRET`、`GITHUB_CLIENT_ID` 和 `GITHUB_CLIENT_SECRET` 均已配置，认证入口已验证可跳转到 GitHub。

GitHub Pages 运行静态页面；认证端独立运行在 Cloudflare Worker。认证端核对 GitHub 数字用户 ID **189645776** 和仓库写入权限，只向此账号的后台会话返回访问令牌。其他登录用户会被拒绝。

### 创建 Worker

Cloudflare 控制台 **Workers & Pages → Create → Worker**，命名 `airglow-github-auth`，创建后得到 `https://airglow-github-auth.github-oauth.workers.dev`。

在 **Edit code** 中使用 `services/github-oauth/worker.mjs` 的代码，保存部署。该文件没有依赖，可直接粘贴到 Worker 编辑器。

在 Worker **Settings → Variables and Secrets** 配置以下项：

| 名称 | 类型 | 值 |
| --- | --- | --- |
| ALLOWED_SITE_ORIGIN | Text | `https://allenxia814.github.io`，无结尾 `/` |
| ALLOWED_USER_ID | Text | `189645776` |
| GITHUB_REPO | Text | `Allenxia814/Allenxia814.github.io` |
| GITHUB_CLIENT_ID | Secret | 下一步生成的 Client ID |
| GITHUB_CLIENT_SECRET | Secret | 下一步生成的 Client secret |
| STATE_SECRET | Secret | 至少 32 字符的独立随机字符串 |

随机密钥可在本机运行 `openssl rand -hex 32` 生成，直接保存到 Worker Secret 中。**不要将 Client secret 或 STATE_SECRET 发到聊天、加入 GitHub Actions Variables 或提交到仓库。**

### 创建 GitHub OAuth App

打开 https://github.com/settings/applications/new ，填写：

- Application name：`Airglow Blog Admin`
- Homepage URL：`https://allenxia814.github.io`
- Authorization callback URL：`https://airglow-github-auth.github-oauth.workers.dev/callback`

注册后，把 Client ID 和新生成的 Client secret 保存到上述 Worker Secrets，并重新部署 Worker。这个 OAuth App 用 `public_repo` 权限让 Decap 提交公开仓库内容。GitHub 授权时会显示这一权限；后台编辑器会在浏览器保存登录会话，退出时使用编辑器的退出登录。

### 连接博客后台

在 GitHub 仓库 **Settings → Secrets and variables → Actions → Variables** 新增：

`PUBLIC_CMS_AUTH_URL` = `https://airglow-github-auth.github-oauth.workers.dev`

重新运行部署，再打开 `/admin/`。完成 OAuth 授权后可以新增、编辑和删除文章；打开“隐藏文章”并保存，待部署完成后文章不再出现在网页、搜索、归档、站点地图或 RSS 中。

公开 GitHub 仓库仍保留 Markdown 文件和 Git 历史。“隐藏文章”控制网站发布状态，不提供内容保密。

### 使用命令行部署 Worker（可选）

安装并登录 Cloudflare Wrangler 后，可在 `services/github-oauth/` 中运行 `wrangler deploy`，再分别使用 `wrangler secret put GITHUB_CLIENT_ID`、`wrangler secret put GITHUB_CLIENT_SECRET`、`wrangler secret put STATE_SECRET` 输入密钥。`wrangler.toml` 已提供非敏感配置；不要把密钥写入该文件。
