import { fileURLToPath } from 'node:url'
import type { AstroIntegration } from 'astro'
import { assertContentFilesExist, loadSiteConfig } from './config-loader.js'
import { EDIT_MODE } from './runtime.js'

export interface EditorOptions {
  /** Path to the editor config, relative to the project root. Auto-detected by default. */
  readonly configFile?: string
}

/**
 * Validates the site against its editor config at build time.
 *
 * In P0 this integration deliberately emits nothing. Edit builds and production
 * builds produce identical output; the only difference is that an edit build
 * has `EDITOR_MODE=1` set, which makes `ed()` emit `data-ed` attributes from the
 * templates themselves.
 *
 * The bridge script and `/_ed/config.json` arrive in P3 and will be gated on the
 * same flag.
 */
export default function editor(options: EditorOptions = {}): AstroIntegration {
  return {
    name: '@astro-editor/astro',
    hooks: {
      'astro:config:setup': async ({ config, logger }) => {
        const root = fileURLToPath(config.root)
        const siteConfig = await loadSiteConfig(root, options.configFile)
        assertContentFilesExist(root, siteConfig)

        const documentCount = Object.keys(siteConfig.documents).length
        logger.info(
          `${siteConfig.name}: ${documentCount} editable document${documentCount === 1 ? '' : 's'}` +
            `${siteConfig.theme ? ' + theme' : ''} — ` +
            (EDIT_MODE ? 'edit mode (annotations on)' : 'production mode (no editor output)'),
        )
      },
    },
  }
}

export {
  loadSiteConfig,
  resolveConfigPath,
  assertContentFilesExist,
  EditorConfigNotFoundError,
  MissingContentFileError,
} from './config-loader.js'

export { ed, edIndex, isEditMode, EDIT_MODE, type EditAttrs } from './runtime.js'
