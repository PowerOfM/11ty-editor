/**
 * YAML reading and targeted writing.
 *
 * Everything here exists to keep the git diff of a save small enough that a
 * developer can review it at a glance. Two rules do most of that work:
 *
 *   1. Mutate the parsed `Document` in place with `setIn`, so comments, key
 *      order, quoting style and blank lines all survive.
 *   2. Never write a value that already matches. A document nobody changed is
 *      returned as the original string, untouched — we do not even re-emit it.
 */

import { type Document, isMap, isSeq, parseDocument } from 'yaml'
import type { Field, FieldMap } from '../fields.js'

type Path = readonly (string | number)[]

export function readYaml(source: string): unknown {
  const doc = parseDocument(source)
  if (doc.errors.length > 0) {
    throw new YamlParseError(doc.errors[0]!.message)
  }
  return doc.toJS() ?? {}
}

export class YamlParseError extends Error {
  override readonly name = 'YamlParseError'
}

/** True when every newline in the source is a CRLF pair. */
function usesCrlf(source: string): boolean {
  const crlf = source.match(/\r\n/g)?.length ?? 0
  const lf = source.match(/\n/g)?.length ?? 0
  return crlf > 0 && crlf === lf
}

function applyLeaf(doc: Document, path: Path, value: unknown): boolean {
  if (doc.getIn(path, false) === value) return false
  doc.setIn(path, value)
  return true
}

/** Applies a plain object as leaves, used for `image` values. */
function applyLeaves(doc: Document, path: Path, value: Record<string, unknown>): boolean {
  let changed = false
  for (const [key, leaf] of Object.entries(value)) {
    const leafPath = [...path, key]
    if (leaf === undefined) {
      if (doc.hasIn(leafPath)) {
        doc.deleteIn(leafPath)
        changed = true
      }
      continue
    }
    if (applyLeaf(doc, leafPath, leaf)) changed = true
  }
  return changed
}

function applyField(doc: Document, path: Path, field: Field, value: unknown): boolean {
  switch (field.kind) {
    case 'group':
      if (!isMap(doc.getIn(path))) {
        doc.setIn(path, value)
        return true
      }
      return applyFields(doc, path, field.fields, value as Record<string, unknown>)

    case 'image':
      if (!isMap(doc.getIn(path))) {
        doc.setIn(path, value)
        return true
      }
      return applyLeaves(doc, path, value as Record<string, unknown>)

    case 'list': {
      const existing = doc.getIn(path)
      const items = value as Record<string, unknown>[]

      // Adding, removing or reordering rows rewrites the whole sequence. Only a
      // same-length list can be patched item by item, which is the common case
      // (a client fixing the wording of one nav link) and the one worth keeping
      // tight.
      if (!isSeq(existing) || existing.items.length !== items.length) {
        doc.setIn(path, items)
        return true
      }

      let changed = false
      for (let index = 0; index < items.length; index += 1) {
        if (applyFields(doc, [...path, index], field.of, items[index]!)) changed = true
      }
      return changed
    }

    default:
      return applyLeaf(doc, path, value)
  }
}

function applyFields(
  doc: Document,
  base: Path,
  fields: FieldMap,
  next: Record<string, unknown>,
): boolean {
  let changed = false
  for (const [key, field] of Object.entries(fields)) {
    const path = [...base, key]
    const value = next[key]

    if (value === undefined) {
      if (doc.hasIn(path)) {
        doc.deleteIn(path)
        changed = true
      }
      continue
    }

    if (applyField(doc, path, field, value)) changed = true
  }
  return changed
}

/**
 * Writes `next` into `source`, touching only the fields that actually differ.
 * Returns the original string unchanged when nothing differs.
 */
export function applyYaml(
  source: string,
  fields: FieldMap,
  next: Record<string, unknown>,
): string {
  const doc = parseDocument(source)
  if (doc.errors.length > 0) {
    throw new YamlParseError(doc.errors[0]!.message)
  }

  if (!applyFields(doc, [], fields, next)) return source

  // lineWidth: 0 disables the default 80-column wrapping. Re-flowing a long
  // tagline the client never touched would be pure diff noise.
  let output = doc.toString({ lineWidth: 0 })
  if (usesCrlf(source)) output = output.replace(/\r?\n/g, '\r\n')
  return output
}
