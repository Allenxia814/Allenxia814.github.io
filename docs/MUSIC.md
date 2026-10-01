# Airglow 私人音乐空间

入口：https://allenxia814.github.io/music/

首次直接打开此地址，使用 Allenxia814 的 GitHub 账号登录。服务端核验数字用户 ID `189645776`，验证成功后才显示导航中的“音乐”。访客看不到此导航，也无法读取专辑数据或推荐历史。GitHub Pages 提供公开的登录外壳；路径与页面代码本身不是秘密。音乐页面不进入站点地图、RSS 或 Pagefind 搜索。

## 使用

- **按曲风**：选择当天想听的曲风，点击“推荐一张专辑”。目前有嘻哈、流行、摇滚、独立、电子、R&B / 灵魂、爵士、民谣、古典、金属、氛围、放克、雷鬼、蓝调、朋克、原声。
- **随意发现**：从已收录的音乐库中随机挑选，不限制曲风。
- 推荐仅展示专辑名称、歌手和封面，不提供网页播放。
- **本周新发行**：北京时间周一至周日，按专辑的首次发行日期筛选，只展示截至当天已发行且明确到日的数据，避免将旧专辑再版当作新专辑。
- **推荐足迹**：云端保存历史，跨设备、跨曲风共用；退出登录不会清除历史。

## 存储与身份

Cloudflare Worker 和 D1 保存专辑目录、曲风关联、推荐历史及会话。API `/music/*` 全部核验所有者会话。推荐以 MusicBrainz release-group ID 去重，数据库唯一约束阻止并发重复，同一次请求重试返回原结果。不同地区和常见再版由数据源归入同一 release-group；源数据库错误拆分的条目仍可能需要人工合并。

音乐登录使用现有 GitHub OAuth App 和 `/callback`，不额外请求仓库写入权限，不把 GitHub access token 发送到音乐页面。浏览器保存随机的音乐会话令牌，数据库只保存令牌的 SHA-256 摘要，7 天有效；退出时撤销该会话。其他账号被拒绝。

## 数据更新

来源：MusicBrainz 与 Cover Art Archive，不需要新增音乐平台账号或付费 AI API。音乐元数据不等于全球完整曲库，曲风标签、封面和发行日期可能缺失或延迟；推荐优先返回有封面的专辑，数据源故障时提示重试，不编造内容。

每小时 UTC 第 17 分钟执行同步，轮换补充曲风和随机目录；每 6 小时同步本周发行，分页逐步补齐。页面打开时在缓存超过 6 小时后尝试更新本周数据，点击“刷新”重新读取最新缓存。尚未导入的曲风或暂时用尽的候选会按需补充。MusicBrainz 请求通过数据库共享节流，不超过约每秒一次。

`services/github-oauth/wrangler.toml` 绑定数据库 `airglow-music`；结构在 `music-schema.sql`。服务部署：

```sh
cd services/github-oauth
WRANGLER_SEND_METRICS=false corepack pnpm dlx wrangler@4.146.0 deploy
```

初次创建数据库后执行结构文件，已有数据时不要删除数据库或历史表。OAuth 密钥继续保存在 Cloudflare Secrets，不提交到仓库。

## 验证

```sh
node --test services/github-oauth/*.test.mjs
corepack pnpm check
corepack pnpm build
```

测试覆盖北京时间周边界、匿名/其他账号/过期会话拒绝、并发去重、请求重试、退出撤销、周发行过滤、音乐 OAuth 不暴露 GitHub token，以及原有文章后台认证。
