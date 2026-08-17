import { glob } from 'astro/loaders'
import { defineCollection, z } from 'astro:content'

/**
 * Standard Astro content collections. The editor sits on top of this rather
 * than replacing it: `editor.config.ts` describes the same files in terms of
 * what a client may change, while Astro keeps owning how they are loaded and
 * rendered.
 */
const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    intro: z.string(),
  }),
})

export const collections = { pages }
