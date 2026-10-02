import type { APIRoute } from "astro";

export const GET: APIRoute = () => {
  const value = import.meta.env.PUBLIC_CMS_AUTH_URL?.trim() || "";
  let authOrigin = "";
  if (value) {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      throw new Error("PUBLIC_CMS_AUTH_URL must be an HTTPS origin, e.g. https://airglow-auth.example.workers.dev");
    }
    authOrigin = parsed.origin;
  }
  return new Response(JSON.stringify({
    configured: !!authOrigin,
    config: {
      load_config_file: false,
      backend: {
        name: "github",
        repo: "Allenxia814/Allenxia814.github.io",
        branch: "main",
        base_url: authOrigin,
        auth_endpoint: "auth",
      },
      locale: "zh_Hans",
      site_url: "https://allenxia814.github.io",
      display_url: "https://allenxia814.github.io",
      logo_url: "/favicon/airglow.svg",
      media_folder: "public/images/uploads",
      public_folder: "/images/uploads",
      collections: [
        {
          name: "posts", label: "文章", label_singular: "文章",
          folder: "src/content/posts", create: true, delete: true,
          extension: "md", format: "yaml-frontmatter", slug: "{{slug}}",
          preview_path: "posts/{{slug}}/",
          summary: "{{title}} · {{published}} · 隐藏：{{draft}}",
          fields: [
            { name: "title", label: "标题", widget: "string" },
            { name: "published", label: "发布日期", widget: "datetime", date_format: "YYYY-MM-DD", time_format: false, format: "YYYY-MM-DD" },
            { name: "updated", label: "更新日期", widget: "datetime", date_format: "YYYY-MM-DD", time_format: false, format: "YYYY-MM-DD", required: false },
            { name: "draft", label: "隐藏文章", widget: "boolean", default: false, hint: "开启后，部署完成时文章会从网站、搜索、归档和 RSS 移除。公开仓库中的源文件仍可查看。" },
            { name: "description", label: "摘要", widget: "text", required: false },
            { name: "image", label: "封面", widget: "image", required: false },
            { name: "category", label: "分类", widget: "string", required: false },
            { name: "tags", label: "标签", widget: "list", required: false },
            { name: "body", label: "正文", widget: "markdown" },
          ],
        },
        {
          name: "notes", label: "短记", label_singular: "短记",
          folder: "src/content/notes", create: true, delete: true,
          extension: "md", format: "yaml-frontmatter",
          slug: "{{year}}-{{month}}-{{day}}-{{hour}}-{{minute}}-{{second}}-{{slug}}",
          preview_path: "notes/entry/{{slug}}/",
          summary: "{{title}} · {{published}} · 隐藏：{{draft}}",
          sortable_fields: ["published", "title"],
          fields: [
            { name: "title", label: "简短标题", widget: "string", hint: "给这段记录起一个短标题，方便管理与搜索。" },
            { name: "published", label: "记录时间", widget: "datetime", default: "{{now}}", date_format: "YYYY-MM-DD", time_format: "HH:mm", format: "YYYY-MM-DDTHH:mm:ssZ", picker_utc: false, hint: "默认当前时间，页面统一显示北京时间；此字段记录时间，不用于定时发布。" },
            { name: "draft", label: "隐藏短记", widget: "boolean", default: false, hint: "部署完成后，从短记列表、独立链接、搜索和短记 RSS 移除。公开仓库中的源文件仍可查看。" },
            { name: "tags", label: "标签", widget: "list", required: false, default: [] },
            { name: "body", label: "短记内容", widget: "markdown" },
            { name: "images", label: "配图", label_singular: "图片", widget: "list", required: false, default: [], collapsed: true,
              fields: [
                { name: "image", label: "图片", widget: "image", hint: "上传图片，或填写 HTTPS 图片地址。" },
                { name: "alt", label: "图片说明", widget: "string", required: false },
              ],
            },
          ],
        },
        {
          name: "friends", label: "友链", format: "json",
          files: [{
            name: "friends", label: "管理友链", file: "src/data/friends.json",
            fields: [
              { name: "introduction", label: "页面介绍", widget: "text" },
              {
                name: "links", label: "友链列表", label_singular: "友链", widget: "list", required: false, default: [],
                summary: "{{fields.name}} · {{fields.url}}", collapsed: true,
                fields: [
                  { name: "name", label: "网站名称", widget: "string" },
                  { name: "url", label: "网站地址", widget: "string", pattern: ["^https?://[^\\s]+$", "请输入完整网址，例如 https://example.com"] },
                  { name: "description", label: "网站简介", widget: "text", required: false },
                  { name: "avatar", label: "头像 / 图标", widget: "image", required: false, hint: "可上传图片或填写 HTTPS 图片地址；不填时显示名称首字。" },
                  { name: "visible", label: "显示这条友链", widget: "boolean", default: true },
                ],
              },
            ],
          }],
        },
        {
          name: "pages", label: "页面",
          files: [{
            name: "about", label: "关于 Airglow", file: "src/content/spec/about.md",
            fields: [{ name: "body", label: "正文", widget: "markdown" }],
          }],
        },
      ],
    },
  }), { headers: { "Content-Type": "application/json" } });
};
