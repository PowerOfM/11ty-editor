import { describe, expect, it } from 'vitest'
import { parseDocument, serializeDocument } from '../src/index.js'
import { FOOTER_CRLF, FOOTER_YAML, HOME_MD, THEME_JSON, footerDoc, homeDoc, themeDoc } from './fixtures.js'

/** Line numbers whose content differs between two versions of a file. */
function changedLines(before: string, after: string): string[] {
  const a = before.split('\n')
  const b = after.split('\n')
  const changed: string[] = []
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i] !== b[i]) changed.push(`${i + 1}: ${a[i] ?? '<none>'} → ${b[i] ?? '<none>'}`)
  }
  return changed
}

/**
 * The round-trip test proves an untouched save writes nothing. This one proves
 * the far more important property: a save that *does* change something changes
 * only that thing. A serializer that regenerates the file would pass the
 * round-trip test and fail every assertion here.
 */
describe('editing one field touches only that field', () => {
  it('rewrites a single yaml line and keeps comments', () => {
    const { data } = parseDocument(FOOTER_YAML, footerDoc)
    const next = { ...data, tagline: 'Built with care since 2011' }
    const output = serializeDocument(FOOTER_YAML, next, footerDoc)

    expect(changedLines(FOOTER_YAML, output)).toEqual([
      '3: tagline: Built with care since 2019 → tagline: Built with care since 2011',
    ])
    expect(output).toContain('# Site-wide footer. Edited through the client editor —')
    expect(output).toContain('# Support link is seasonal; leave it in place when disabled.')
  })

  it('keeps the original key order rather than sorting', () => {
    const { data } = parseDocument(FOOTER_YAML, footerDoc)
    const output = serializeDocument(FOOTER_YAML, { ...data, copyright: '© Acme Ltd' }, footerDoc)

    const keys = [...output.matchAll(/^(\w+):/gm)].map((match) => match[1])
    expect(keys).toEqual(['tagline', 'copyright', 'links'])
  })

  it('edits one item of a list without disturbing its siblings', () => {
    const { data } = parseDocument(FOOTER_YAML, footerDoc)
    const links = (data['links'] as { text: string; href: string }[]).map((link, index) =>
      index === 0 ? { ...link, text: 'Privacy policy' } : link,
    )
    const output = serializeDocument(FOOTER_YAML, { ...data, links }, footerDoc)

    expect(changedLines(FOOTER_YAML, output)).toEqual([
      '7:   - text: Privacy →   - text: Privacy policy',
    ])
    expect(output).toContain('# Support link is seasonal; leave it in place when disabled.')
  })

  it('preserves CRLF endings when it rewrites', () => {
    const { data } = parseDocument(FOOTER_CRLF, footerDoc)
    const output = serializeDocument(FOOTER_CRLF, { ...data, tagline: 'Changed' }, footerDoc)

    expect(output).toContain('\r\n')
    expect(output.match(/\r\n/g)?.length).toBe(output.match(/\n/g)?.length)
    expect(output).toContain('tagline: Changed\r\n')
  })

  it('rewrites a markdown body without touching frontmatter bytes', () => {
    const { data } = parseDocument(HOME_MD, homeDoc)
    const output = serializeDocument(HOME_MD, { ...data, body: '## Rewritten\n' }, homeDoc)

    expect(output).toBe('---\ntitle: A calmer way to ship\nhero:\n  src: src/assets/hero.jpg\n  alt: A quiet workshop bench\n---\n\n## Rewritten\n')
  })

  it('rewrites frontmatter without touching the body', () => {
    const { data } = parseDocument(HOME_MD, homeDoc)
    const output = serializeDocument(HOME_MD, { ...data, title: 'A quieter way to ship' }, homeDoc)

    expect(changedLines(HOME_MD, output)).toEqual([
      '2: title: A calmer way to ship → title: A quieter way to ship',
    ])
  })

  it('updates one key of an image value', () => {
    const { data } = parseDocument(HOME_MD, homeDoc)
    const hero = { ...(data['hero'] as Record<string, unknown>), alt: 'A tidy workshop bench' }
    const output = serializeDocument(HOME_MD, { ...data, hero }, homeDoc)

    expect(changedLines(HOME_MD, output)).toEqual([
      '5:   alt: A quiet workshop bench →   alt: A tidy workshop bench',
    ])
  })

  it('rewrites one json value and keeps the formatting', () => {
    const { data } = parseDocument(THEME_JSON, themeDoc)
    const output = serializeDocument(THEME_JSON, { ...data, '--radius': 12 }, themeDoc)

    expect(output).toBe('{\n  "--color-brand": "#1f6f4a",\n  "--radius": 12\n}\n')
  })
})

describe('structural list edits', () => {
  it('appends an item', () => {
    const { data } = parseDocument(FOOTER_YAML, footerDoc)
    const links = [...(data['links'] as unknown[]), { text: 'Careers', href: '/careers' }]
    const output = serializeDocument(FOOTER_YAML, { ...data, links }, footerDoc)

    const reparsed = parseDocument(output, footerDoc)
    expect(reparsed.data['links']).toHaveLength(3)
    expect(output).toContain('text: Careers')
    // Scalars outside the list are still untouched.
    expect(output).toContain('tagline: Built with care since 2019')
  })

  it('removes an item', () => {
    const { data } = parseDocument(FOOTER_YAML, footerDoc)
    const links = (data['links'] as unknown[]).slice(0, 1)
    const output = serializeDocument(FOOTER_YAML, { ...data, links }, footerDoc)

    const reparsed = parseDocument(output, footerDoc)
    expect(reparsed.data['links']).toEqual([{ text: 'Privacy', href: '/privacy' }])
    expect(output).not.toContain('support.example.com')
  })
})
