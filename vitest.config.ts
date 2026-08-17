import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  // Tests run straight off TypeScript source so there is no build step between
  // editing a package and running its tests. The published `exports` still point
  // at dist/ for consumers such as the demo site.
  resolve: {
    alias: {
      '@astro-editor/schema': r('./packages/schema/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts'],
    environment: 'node',
  },
})
