/**
 * Site configuration.
 *
 * `editor.config.ts` lives at the root of each client repo and is versioned
 * alongside the template it describes. It is the single place that decides what
 * a client may change, and — critically — the only source of writable paths the
 * commit worker will honour.
 */

import type { Field, FieldMap, InferFields } from './fields.js'

export type DocumentFormat = 'yaml' | 'markdown' | 'json'

export interface DocumentConfig {
  /** Shown in the editor's document nav. */
  readonly label: string
  /**
   * Repo-relative path of the file this document maps to. This is the ONLY
   * thing that makes a path writable; the worker derives its allow-list from
   * these values and never accepts a path from the client.
   */
  readonly file: string
  readonly format: DocumentFormat
  readonly fields: FieldMap
  /**
   * Marks a document whose content appears on more than one page. The editor
   * warns before an edit so the client understands the blast radius — this is
   * how the "changing the footer changes every page" behaviour stays legible
   * rather than surprising.
   */
  readonly global?: boolean
  /** Which page the preview should navigate to when editing this document. */
  readonly previewPath?: string
  /**
   * For `markdown`: which field maps to the body below the frontmatter, rather
   * than to a frontmatter key. Everything else in `fields` is frontmatter.
   */
  readonly bodyField?: string
}

export interface ThemeConfig {
  readonly file: string
  /**
   * CSS custom property name → descriptor. The integration emits these as a
   * `:root` block, so the editor can patch them live in the preview: custom
   * properties genuinely cascade, which makes theme edits pixel-accurate.
   */
  readonly tokens: { readonly [cssVariable: string]: Field }
}

export interface SiteConfig {
  readonly name: string
  readonly documents: { readonly [documentId: string]: DocumentConfig }
  readonly theme?: ThemeConfig
  /** Where committed uploads live. Writable alongside the document paths. */
  readonly mediaDir?: string
}

export const DEFAULT_MEDIA_DIR = 'src/assets/uploads'

/** Identity function that exists for type inference and early validation. */
export function defineSite<const T extends SiteConfig>(config: T): T {
  assertConfigIsCoherent(config)
  return config
}

export class ConfigError extends Error {
  override readonly name = 'ConfigError'
}

/**
 * Catches the config mistakes that would otherwise surface as confusing
 * behaviour much later — a body field that isn't richtext, two documents
 * writing the same file, a path that escapes the repo.
 */
export function assertConfigIsCoherent(config: SiteConfig): void {
  const seenFiles = new Map<string, string>()

  const check = (id: string, file: string) => {
    if (file !== normalizeRepoPath(file)) {
      throw new ConfigError(
        `Document "${id}" has file "${file}", which is not a normalized repo-relative path.`,
      )
    }
    const previous = seenFiles.get(file)
    if (previous) {
      throw new ConfigError(
        `Documents "${previous}" and "${id}" both write to "${file}". Each document needs its own file.`,
      )
    }
    seenFiles.set(file, id)
  }

  for (const [id, doc] of Object.entries(config.documents)) {
    check(id, doc.file)

    if (doc.bodyField !== undefined) {
      if (doc.format !== 'markdown') {
        throw new ConfigError(
          `Document "${id}" sets bodyField but its format is "${doc.format}". Only markdown documents have a body.`,
        )
      }
      const field = doc.fields[doc.bodyField]
      if (!field) {
        throw new ConfigError(
          `Document "${id}" sets bodyField "${doc.bodyField}", which is not present in its fields.`,
        )
      }
      if (field.kind !== 'richtext' && field.kind !== 'longtext') {
        throw new ConfigError(
          `Document "${id}" maps bodyField "${doc.bodyField}" to a "${field.kind}" field. A markdown body must be richtext or longtext.`,
        )
      }
    }
  }

  if (config.theme) check('theme', config.theme.file)
}

/**
 * Rejects anything that is not a plain, repo-relative, forward-slashed path.
 *
 * Config is developer-authored so this is a footgun check rather than a
 * security boundary — but the worker reuses it on the paths it derives, where
 * it very much is one.
 */
export function normalizeRepoPath(path: string): string | null {
  if (path.length === 0) return null
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) return null
  if (path.includes('\\')) return null
  if (path.includes('\0')) return null

  const segments: string[] = []
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') return null
    if (segment === '..') return null
    segments.push(segment)
  }
  return segments.join('/')
}

/** Every path this config makes writable, media directory included. */
export function writablePaths(config: SiteConfig): {
  files: ReadonlySet<string>
  mediaDir: string
} {
  const files = new Set<string>()
  for (const doc of Object.values(config.documents)) files.add(doc.file)
  if (config.theme) files.add(config.theme.file)
  return { files, mediaDir: config.mediaDir ?? DEFAULT_MEDIA_DIR }
}

/** The data shape a document config describes. */
export type InferDocument<D extends DocumentConfig> = InferFields<D['fields']>
