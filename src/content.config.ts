import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { CATEGORIES } from "./site.config";

const concepts = defineCollection({
  loader: glob({ pattern: "*.mdx", base: "./src/content/concepts" }),
  schema: z.object({
    title: z.string(),
    category: z.enum(CATEGORIES),
    /** One line under the title. */
    hook: z.string(),
    /** Meta description / card blurb. */
    description: z.string(),
    /** YouTube video id of the companion video. */
    videoId: z.string().optional(),
    videoTitle: z.string().optional(),
    order: z.number(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { concepts };
