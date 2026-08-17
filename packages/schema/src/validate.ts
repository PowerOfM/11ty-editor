/**
 * Descriptor tree → Zod schema.
 *
 * The worker runs this over every payload before it writes anything, and then
 * re-serializes from the *validated* data rather than from anything the client
 * sent. That ordering is the whole point: the client's serialized output is
 * never trusted, so a compromised or buggy editor cannot smuggle content past
 * the schema.
 */

import { z } from 'zod'
import type { DocumentConfig, SiteConfig, ThemeConfig } from './config.js'
import type { Field, FieldMap } from './fields.js'

/** Protocols a `url` field may carry. Everything else — `javascript:` above all — is rejected. */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

const HEX_6 = /^#[0-9a-fA-F]{6}$/
const HEX_8 = /^#[0-9a-fA-F]{8}$/
const HEX_3 = /^#[0-9a-fA-F]{3}$/

function isSafeUrl(value: string, allowRelative: boolean): boolean {
  const trimmed = value.trim()
  if (trimmed === '') return false
  if (/\s/.test(trimmed)) return false

  // Site-relative, anchor and query-only links never carry a protocol. Bare
  // relative paths (`about/`) are deliberately not accepted: they are ambiguous
  // about their base, and accepting them would also let arbitrary prose through
  // as a "URL".
  if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('?')) {
    // `//evil.example.com` is protocol-relative, not site-relative.
    if (trimmed.startsWith('//')) return false
    return allowRelative
  }

  try {
    return ALLOWED_PROTOCOLS.has(new URL(trimmed).protocol)
  } catch {
    return false
  }
}

function textSchema(min: number | undefined, max: number | undefined, label: string) {
  let schema = z.string()
  if (min !== undefined) schema = schema.min(min, `${label} must be at least ${min} characters.`)
  if (max !== undefined) schema = schema.max(max, `${label} must be at most ${max} characters.`)
  return schema
}

function zodForField(field: Field, label: string): z.ZodType {
  let schema: z.ZodType

  switch (field.kind) {
    case 'text':
    case 'longtext':
      schema = textSchema(field.min, field.max, label)
      break

    case 'richtext':
      schema = textSchema(undefined, field.max, label)
      break

    case 'url': {
      const allowRelative = field.allowRelative ?? true
      schema = z
        .string()
        .refine(
          (value) => isSafeUrl(value, allowRelative),
          allowRelative
            ? `${label} must be a site-relative path or an http(s), mailto or tel link.`
            : `${label} must be a full http(s), mailto or tel link.`,
        )
      break
    }

    case 'color': {
      const allowAlpha = field.allowAlpha ?? false
      schema = z
        .string()
        .refine(
          (value) => HEX_6.test(value) || HEX_3.test(value) || (allowAlpha && HEX_8.test(value)),
          `${label} must be a hex colour such as #1f6f4a${allowAlpha ? ' or #1f6f4aff' : ''}.`,
        )
      break
    }

    case 'select': {
      const values = field.options.map((option) => option.value)
      schema = z
        .string()
        .refine((value) => values.includes(value), `${label} must be one of: ${values.join(', ')}.`)
      break
    }

    case 'boolean':
      schema = z.boolean()
      break

    case 'number':
    case 'length': {
      let numeric = z.number().finite()
      if (field.min !== undefined) numeric = numeric.min(field.min)
      if (field.max !== undefined) numeric = numeric.max(field.max)
      if (field.kind === 'number' && field.integer) numeric = numeric.int()
      schema = numeric
      break
    }

    case 'image': {
      const requireAlt = field.requireAlt ?? true
      const alt = requireAlt
        ? z.string().min(1, `${label} needs alt text describing the image.`)
        : z.string().optional()
      schema = z.strictObject({
        src: z.string().min(1, `${label} needs a source path.`),
        alt,
      })
      break
    }

    case 'group':
      schema = zodForFields(field.fields, label)
      break

    case 'list': {
      let list = z.array(zodForFields(field.of, label))
      if (field.min !== undefined)
        list = list.min(field.min, `${label} needs at least ${field.min} item(s).`)
      if (field.max !== undefined)
        list = list.max(field.max, `${label} allows at most ${field.max} item(s).`)
      schema = list
      break
    }
  }

  return field.optional ? schema.optional() : schema
}

/**
 * Strict on purpose: an unknown key is a rejection, not something to strip.
 * Silently dropping keys would let a bad payload quietly delete content the
 * client never saw.
 */
export function zodForFields(fields: FieldMap, parentLabel = ''): z.ZodType {
  const shape: Record<string, z.ZodType> = {}
  for (const [key, field] of Object.entries(fields)) {
    const label = field.label ?? (parentLabel ? `${parentLabel} → ${key}` : key)
    shape[key] = zodForField(field, label)
  }
  return z.strictObject(shape)
}

export function zodForDocument(doc: DocumentConfig): z.ZodType {
  return zodForFields(doc.fields, doc.label)
}

export function zodForTheme(theme: ThemeConfig): z.ZodType {
  const shape: Record<string, z.ZodType> = {}
  for (const [token, field] of Object.entries(theme.tokens)) {
    shape[token] = zodForField(field, field.label ?? token)
  }
  return z.strictObject(shape)
}

export interface ValidationIssue {
  /** Dotted path into the document, e.g. `links.2.href`. */
  readonly path: string
  readonly message: string
}

export type ValidationResult<T = Record<string, unknown>> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

function toResult(parsed: z.ZodSafeParseResult<unknown>): ValidationResult {
  if (parsed.success) return { ok: true, data: parsed.data as Record<string, unknown> }

  const issues: ValidationIssue[] = []
  for (const issue of parsed.error.issues) {
    // Zod reports every unknown key of an object as one issue anchored at the
    // object itself. Split it so each offending key gets its own addressable
    // path, which is what the editor needs to point at the problem.
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) {
        issues.push({
          path: [...issue.path, key].join('.'),
          message: `Unknown field "${key}".`,
        })
      }
      continue
    }
    issues.push({ path: issue.path.join('.'), message: issue.message })
  }

  return { ok: false, issues }
}

export function validateDocument(data: unknown, doc: DocumentConfig): ValidationResult {
  return toResult(zodForDocument(doc).safeParse(data))
}

export function validateTheme(data: unknown, theme: ThemeConfig): ValidationResult {
  return toResult(zodForTheme(theme).safeParse(data))
}

/** Validates a whole `{ documentId: data }` payload against a site config. */
export function validatePayload(
  payload: Record<string, unknown>,
  config: SiteConfig,
): ValidationResult<Record<string, Record<string, unknown>>> {
  const issues: ValidationIssue[] = []
  const data: Record<string, Record<string, unknown>> = {}

  for (const [documentId, documentData] of Object.entries(payload)) {
    const doc = config.documents[documentId]
    if (!doc) {
      issues.push({ path: documentId, message: `Unknown document "${documentId}".` })
      continue
    }
    const result = validateDocument(documentData, doc)
    if (result.ok) {
      data[documentId] = result.data
    } else {
      for (const issue of result.issues) {
        issues.push({ path: `${documentId}.${issue.path}`, message: issue.message })
      }
    }
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, data }
}
