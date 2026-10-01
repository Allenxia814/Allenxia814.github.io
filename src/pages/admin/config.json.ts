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
