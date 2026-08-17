/**
 * Document parse / serialize, dispatching on the document's declared format.
 *
 * `serializeDocument` takes the *original* source alongside the new data. That
 * is deliberate and is what makes targeted, comment-preserving edits possible:
 * we are patching a file, not regenerating one.
 */

import type { DocumentConfig } from '../config.js'
import { bodyLead, joinFrontmatter, splitFrontmatter } from './frontmatter.js'
import { applyJson, readJson } from './json.js'
import { applyYaml, readYaml } from './yaml.js'

export class SerializationError extends Error {
  override readonly name = 'SerializationError'
}

export interface ParsedDocument {
  /** Frontmatter (or whole-file) values, plus the body under `bodyField`. */
  readonly data: Record<string, unknown>
}

function asRecord(value: unknown, file: string): Record<string, unknown> {
  if (value === null || value === undefined) return {}
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new SerializationError(`${file} must contain a mapping at its root.`)
  }
  return value as Record<string, unknown>
}

export function parseDocument(source: string, doc: DocumentConfig): ParsedDocument {
  switch (doc.format) {
    case 'yaml':
      return { data: asRecord(readYaml(source), doc.file) }

    case 'json':
      return { data: asRecord(readJson(source), doc.file) }

    case 'markdown': {
      const parts = splitFrontmatter(source)
      if (!parts) {
        throw new SerializationError(
          `${doc.file} has no frontmatter block, but its schema declares fields. ` +
            `Add a "---" fence at the top of the file.`,
        )
      }
      const data = asRecord(readYaml(parts.yaml), doc.file)
      if (doc.bodyField) {
        data[doc.bodyField] = parts.body.slice(bodyLead(parts.body).length)
      }
      return { data }
    }
  }
}

export function serializeDocument(
  source: string,
  data: Record<string, unknown>,
  doc: DocumentConfig,
): string {
  switch (doc.format) {
    case 'yaml':
      return applyYaml(source, doc.fields, data)

    case 'json':
      return applyJson(source, data)

    case 'markdown': {
      const parts = splitFrontmatter(source)
      if (!parts) {
        throw new SerializationError(
          `${doc.file} has no frontmatter block to write into. Add a "---" fence at the top of the file.`,
        )
      }

      // The body is not frontmatter, so it must not reach the YAML writer.
      const { [doc.bodyField ?? '']: bodyValue, ...frontmatterData } = data
      const frontmatterFields = Object.fromEntries(
        Object.entries(doc.fields).filter(([key]) => key !== doc.bodyField),
      )

      const yaml = applyYaml(parts.yaml, frontmatterFields, frontmatterData)

      let body = parts.body
      if (doc.bodyField) {
        if (typeof bodyValue !== 'string') {
          throw new SerializationError(
            `${doc.file}: body field "${doc.bodyField}" must be a string.`,
          )
        }
        body = bodyLead(parts.body) + bodyValue
      }

      // Nothing moved — hand back the exact original bytes.
      if (yaml === parts.yaml && body === parts.body) return source

      return joinFrontmatter({ ...parts, yaml, body })
    }
  }
}

export { splitFrontmatter, joinFrontmatter, bodyLead } from './frontmatter.js'
export { readYaml, applyYaml, YamlParseError } from './yaml.js'
export { readJson, applyJson, JsonParseError } from './json.js'
