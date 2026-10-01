# 添加与管理友链

页面：https://allenxia814.github.io/friends/

进入 https://allenxia814.github.io/admin/ ，用 Allenxia814 的 GitHub 账号登录，在左侧选择 **友链 → 管理友链**。

在“友链列表”中添加一项，填写网站名称和完整网址，可选填写简介和头像。头像可上传或使用 HTTPS 图片地址；不填写或加载失败时，页面显示名称首字。保存/发布后，会提交到 GitHub 并自动更新网站。

列表可以重新排序、修改或移除；关闭“显示这条友链”可以暂时从网页隐藏。全部移除后，页面显示空列表提示。网页隐藏不会使公开仓库中的源数据和 Git 历史变成私有。

“页面介绍”也可以在同一处修改。全部友链数据位于 `src/data/friends.json`，页面位于 `src/pages/friends.astro`；网站地址仅接受完整的 HTTP/HTTPS 地址。
