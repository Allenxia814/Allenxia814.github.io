import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";
import { getPublishedNotes, getNoteUrl } from "../../utils/notes-utils";
import { siteConfig } from "../../config";

const parser = new MarkdownIt();
export async function GET(context: APIContext) {
  const notes = await getPublishedNotes();
  return rss({
    title: `${siteConfig.title} · 短记`, description: "碎片想法、日常记录与偶然发现。",
    site: context.site!,
    items: notes.map(entry => {
      const body = (entry.body || "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFDD0-\uFDEF\uFFFE\uFFFF]/g, "");
      const images = entry.data.images.map(({ image, alt }) => {
        const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<p><img src="${escape(new URL(image, context.site).href)}" alt="${escape(alt)}"></p>`;
      }).join("");
      return {
        title: entry.data.title, pubDate: entry.data.published, link: getNoteUrl(entry.id),
        categories: entry.data.tags,
        content: sanitizeHtml(parser.render(body) + images, { allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]) }),
      };
    }),
    customData: "<language>zh-CN</language>",
  });
}
