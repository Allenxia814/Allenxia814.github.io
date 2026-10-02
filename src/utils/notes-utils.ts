import { getCollection } from "astro:content";
import { url } from "./url-utils";

// Use the same public set for the timeline, individual pages and feed, including in previews.
export async function getPublishedNotes() {
  return (await getCollection("notes", ({ data }) => !data.draft))
    .sort((a, b) => b.data.published.getTime() - a.data.published.getTime() || a.id.localeCompare(b.id));
}

export function getNoteUrl(id: string) {
  return url(`/notes/entry/${id}/`);
}

export function formatNoteTime(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(date);
}
