import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

const postsCollection = defineCollection({
	loader: glob({ pattern: "**/[^_]*.md", base: "./src/content/posts" }),
	schema: z.object({
		title: z.string(),
		published: z.coerce.date(),
		updated: z.preprocess(value => value === null || value === "" ? undefined : value, z.coerce.date().optional()),
		draft: z.boolean().optional().default(false),
		description: z.string().optional().default(""),
		image: z.string().optional().default(""),
		tags: z.array(z.string()).optional().default([]),
		category: z.string().optional().nullable().default(""),
		lang: z.string().optional().default(""),

		/* For internal use */
		prevTitle: z.string().default(""),
		prevSlug: z.string().default(""),
		nextTitle: z.string().default(""),
		nextSlug: z.string().default(""),
	}),
});
const specCollection = defineCollection({
	loader: glob({ pattern: "**/[^_]*.md", base: "./src/content/spec" }),
	schema: z.object({}),
});
const notesCollection = defineCollection({
	loader: glob({ pattern: "**/[^_]*.md", base: "./src/content/notes" }),
	schema: z.object({
		title: z.string().trim().min(1),
		published: z.coerce.date(),
		draft: z.boolean().default(false),
		tags: z.array(z.string()).nullish().transform(value => value || []),
		images: z.array(z.object({
			image: z.string().refine(value => {
				if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return true;
				try { const parsed = new URL(value); return parsed.protocol === "https:" && !parsed.username && !parsed.password; }
				catch { return false; }
			}, "短记图片须使用站内路径或 HTTPS 网址"),
			alt: z.string().nullish().transform(value => value || ""),
		})).nullish().transform(value => value || []),
	}),
});
export const collections = {
	posts: postsCollection,
	spec: specCollection,
	notes: notesCollection,
};
