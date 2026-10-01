# Airglow

基于 [Astro](https://astro.build/) 与 [Fuwari](https://github.com/saicaca/fuwari) 的个人博客。中文界面，夜空与青绿色主题，默认深色，保留浅色与跟随系统模式。

## 本地使用

需要 Node.js 22.12 或更高版本与 pnpm（项目锁定 pnpm 9.14.4）。

```bash
pnpm install
pnpm dev
```

开发地址为 http://localhost:4321。完整搜索索引需要先构建，再预览：

```bash
pnpm check
pnpm build
pnpm preview --port 4321
```

## 内容与样式

- `src/config.ts`：站点名称、简介、导航、头像和主题颜色。
- `src/content/posts/`：文章；当前三篇均为示例内容，可替换或删除。
- `src/content/spec/about.md`：关于页。
- `src/styles/airglow.css`：Airglow 视觉样式。
- `public/images/airglow-night.webp`：原创夜空横幅（内置 imagegen 生成）。
- `public/favicon/airglow.svg`：Airglow 字母标识。

新增文章：

```bash
pnpm new-post my-first-post
```

## 部署与网页写作

仓库为 `Allenxia814/Allenxia814.github.io`，生产地址为 https://allenxia814.github.io/。`.github/workflows/deploy.yml` 会在推送到 `main` 后构建并部署到 GitHub Pages。完整设置见 [部署说明](docs/DEPLOYMENT.md)。

文章管理入口 `/admin/` 使用 Decap CMS，认证服务代码位于 `services/github-oauth/`，需部署到 Cloudflare 并设置 GitHub OAuth App。仅允许 GitHub 数字用户 ID `189645776` 登录。文章评论使用 giscus，需启用 Discussions 并安装 giscus。

GitHub Actions Variables：`PUBLIC_CMS_AUTH_URL`、`PUBLIC_GISCUS_CATEGORY_ID`。这些是公开配置；未配置时后台显示设置提示，评论暂不显示。OAuth 密钥只存放在 Cloudflare Worker Secrets。

已迁移至 Astro 7 与新内容集合 API，并升级 Svelte 和构建依赖。认证逻辑可用 `node --test services/github-oauth/worker.test.mjs` 检查。

生产构建与文章隐藏检查已通过；依赖审计当前未发现已知漏洞。上线状态以 GitHub Actions 的部署结果为准，仍需完成账户授权和仓库 Pages 设置。

不要把 `.env`、访问令牌或其他凭据提交到仓库。正式发布前替换示例文章并确认文章版权设置。

## 素材记录

横幅使用内置 imagegen 生成，提示词：全景夜空、深蓝底色、青绿微光、底部远山、稀疏星点，保持左侧适合叠加白色文字；安静的摄影质感，不含文字、标志、水印或界面。

Fuwari 原始项目遵循 MIT 协议，保留根目录 LICENSE。
