import { existsSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { type SiteConfig, assertConfigIsCoherent } from '@astro-editor/schema'

/**
 * Config files are imported directly. Node strips TypeScript types natively
 * from 22.18 onward, so `editor.config.ts` needs no build step — at the cost of
 * requiring erasable syntax only (no `enum`, no `namespace`, no parameter
 * properties). That is a fine constraint for a declarative config file.
 */
const CANDIDATES = ['editor.config.ts', 'editor.config.mts', 'editor.config.mjs', 'editor.config.js']

export class EditorConfigNotFoundError extends Error {
  override readonly name = 'EditorConfigNotFoundError'
}

export function resolveConfigPath(root: string, explicit?: string): string {
  if (explicit) {
    const path = isAbsolute(explicit) ? explicit : join(root, explicit)
    if (!existsSync(path)) {
      throw new EditorConfigNotFoundError(`Editor config not found at ${path}.`)
    }
    return path
  }

  for (const candidate of CANDIDATES) {
    const path = join(root, candidate)
    if (existsSync(path)) return path
  }

  throw new EditorConfigNotFoundError(
    `No editor config found in ${root}. Expected one of: ${CANDIDATES.join(', ')}.`,
  )
}

export async function loadSiteConfig(root: string, explicit?: string): Promise<SiteConfig> {
  const path = resolveConfigPath(root, explicit)

  // Cache-bust so a dev server picks up config edits without a restart.
  const url = `${pathToFileURL(path).href}?t=${Date.now()}`
  const module = (await import(/* @vite-ignore */ url)) as { default?: unknown }

  const config = module.default
  if (!config || typeof config !== 'object') {
    throw new EditorConfigNotFoundError(
      `${path} must have a default export produced by defineSite().`,
    )
  }

  assertConfigIsCoherent(config as SiteConfig)
  return config as SiteConfig
}

export class MissingContentFileError extends Error {
  override readonly name = 'MissingContentFileError'
}

/**
 * Fails the build when the schema references a file that is not there.
 *
 * Config and templates drift — someone renames a data file, or copies a config
 * between client sites. Catching it here turns a confusing empty editor panel
 * (or a failed save much later) into a build error naming the exact document.
 */
export function assertContentFilesExist(root: string, config: SiteConfig): void {
  const missing: string[] = []

  for (const [id, doc] of Object.entries(config.documents)) {
    if (!existsSync(join(root, doc.file))) missing.push(`  ${id} → ${doc.file}`)
  }
  if (config.theme && !existsSync(join(root, config.theme.file))) {
    missing.push(`  theme → ${config.theme.file}`)
  }

  if (missing.length > 0) {
    throw new MissingContentFileError(
      `Editor config references files that do not exist:\n${missing.join('\n')}\n\n` +
        `Create them, or remove the documents from editor.config.ts.`,
    )
  }
}
