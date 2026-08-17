import editor from '@astro-editor/astro'
import { defineConfig } from 'astro/config'

export default defineConfig({
  integrations: [editor()],
})
