/**
 * JSON reading and writing.
 *
 * JSON carries no comments, so there is far less to preserve than in YAML — but
 * indentation and the trailing newline still show up in a diff, so both are
 * detected from the original file and reproduced.
 */

export class JsonParseError extends Error {
  override readonly name = 'JsonParseError'
}

export function readJson(source: string): unknown {
  if (source.trim() === '') return {}
  try {
    return JSON.parse(source)
  } catch (error) {
    throw new JsonParseError((error as Error).message)
  }
}

/** Reads the indentation of the first indented line, defaulting to two spaces. */
function detectIndent(source: string): string | number {
  const match = /\n([ \t]+)\S/.exec(source)
  if (!match) return 2
  const indent = match[1]!
  return indent.startsWith('\t') ? '\t' : indent.length
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false

  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]))
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as object)
    const bKeys = Object.keys(b as object)
    if (aKeys.length !== bKeys.length) return false
    return aKeys.every(
      (key) =>
        Object.hasOwn(b as object, key) &&
        deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
  }

  return false
}

/** Returns the original string when nothing changed. */
export function applyJson(source: string, next: Record<string, unknown>): string {
  if (source.trim() !== '' && deepEqual(readJson(source), next)) return source

  const serialized = JSON.stringify(next, null, detectIndent(source))
  const endsWithNewline = source === '' || /\n$/.test(source)
  return endsWithNewline ? `${serialized}\n` : serialized
}
