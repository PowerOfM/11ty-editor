/**
 * Frontmatter splitting, done by hand.
 *
 * `gray-matter` and friends re-serialize the frontmatter block through js-yaml,
 * which drops comments and normalizes key order — exactly the diff noise this
 * package exists to prevent. So we never hand the fence to a library: we slice
 * the source into four literal pieces, replace only the inner YAML text, and
 * concatenate the originals back around it.
 */

export interface FrontmatterParts {
  /** Byte-order mark, if the file had one. */
  readonly bom: string
  /** The opening fence *including* its newline, e.g. `"---\n"`. */
  readonly open: string
  /** The YAML between the fences, including its trailing newline. */
  readonly yaml: string
  /** The closing fence including its newline, e.g. `"---\n"`. */
  readonly close: string
  /** Everything after the closing fence, verbatim. */
  readonly body: string
}

const FENCE = '---'

function isFence(line: string): boolean {
  return line.replace(/[\r\t ]+$/, '') === FENCE
}

/** Returns null when the source has no frontmatter block at all. */
export function splitFrontmatter(source: string): FrontmatterParts | null {
  let bom = ''
  let rest = source
  if (rest.charCodeAt(0) === 0xfeff) {
    bom = '﻿'
    rest = rest.slice(1)
  }

  if (!rest.startsWith(FENCE)) return null

  const firstBreak = rest.indexOf('\n')
  if (firstBreak === -1) return null

  const open = rest.slice(0, firstBreak + 1)
  if (!isFence(open.slice(0, -1))) return null

  const afterOpen = rest.slice(firstBreak + 1)

  // Walk line by line looking for the closing fence.
  let cursor = 0
  while (cursor <= afterOpen.length) {
    const lineBreak = afterOpen.indexOf('\n', cursor)
    const lineEnd = lineBreak === -1 ? afterOpen.length : lineBreak
    const line = afterOpen.slice(cursor, lineEnd)

    if (isFence(line)) {
      return {
        bom,
        open,
        yaml: afterOpen.slice(0, cursor),
        close: afterOpen.slice(cursor, lineBreak === -1 ? afterOpen.length : lineBreak + 1),
        body: lineBreak === -1 ? '' : afterOpen.slice(lineBreak + 1),
      }
    }

    if (lineBreak === -1) break
    cursor = lineBreak + 1
  }

  // An opening fence with no closing fence is not frontmatter.
  return null
}

export function joinFrontmatter(parts: FrontmatterParts): string {
  return parts.bom + parts.open + parts.yaml + parts.close + parts.body
}

/**
 * The newline that conventionally separates the closing fence from the body.
 * Captured so the editor can present the body without a phantom leading blank
 * line, and we can put it back byte-for-byte on write.
 */
export function bodyLead(body: string): string {
  return /^\r?\n/.exec(body)?.[0] ?? ''
}
