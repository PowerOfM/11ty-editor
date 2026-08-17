import { describe, expect, it } from 'vitest'
import { parseDocument, serializeDocument } from '../src/index.js'
import {
  ALL_YAML_FIXTURES,
  FOOTER_CRLF,
  FOOTER_QUOTING,
  FOOTER_YAML,
  HOME_MD,
  THEME_JSON,
  footerDoc,
  homeDoc,
  themeDoc,
} from './fixtures.js'

/**
 * The invariant the whole package is built around: reading a file and writing
 * it back without changing anything must produce the identical bytes.
 *
 * If this test is green, a client's save can never produce a diff for content
 * they did not touch — which is what makes a git-backed editor reviewable.
 */
describe('round-trip is byte-identical', () => {
  for (const [name, source] of ALL_YAML_FIXTURES) {
    it(`yaml: ${name}`, () => {
      const { data } = parseDocument(source, footerDoc)
      expect(serializeDocument(source, data, footerDoc)).toBe(source)
    })
  }

  it('markdown: frontmatter and body', () => {
    const { data } = parseDocument(HOME_MD, homeDoc)
    expect(serializeDocument(HOME_MD, data, homeDoc)).toBe(HOME_MD)
  })

  it('markdown: CRLF', () => {
    const source = HOME_MD.replace(/\n/g, '\r\n')
    const { data } = parseDocument(source, homeDoc)
    expect(serializeDocument(source, data, homeDoc)).toBe(source)
  })

  it('markdown: no blank line between fence and body', () => {
    const source = '---\ntitle: Tight\nhero:\n  src: a.jpg\n  alt: A\n---\nBody starts here.\n'
    const { data } = parseDocument(source, homeDoc)
    expect(data['body']).toBe('Body starts here.\n')
    expect(serializeDocument(source, data, homeDoc)).toBe(source)
  })

  it('json: preserves indent and trailing newline', () => {
    const { data } = parseDocument(THEME_JSON, themeDoc)
    expect(serializeDocument(THEME_JSON, data, themeDoc)).toBe(THEME_JSON)
  })

  it('json: preserves tab indentation', () => {
    const source = '{\n\t"--color-brand": "#1f6f4a",\n\t"--radius": 4\n}\n'
    const { data } = parseDocument(source, themeDoc)
    expect(serializeDocument(source, data, themeDoc)).toBe(source)
  })
})

describe('parsing exposes the values the editor needs', () => {
  it('reads yaml scalars and lists', () => {
    const { data } = parseDocument(FOOTER_YAML, footerDoc)
    expect(data['tagline']).toBe('Built with care since 2019')
    expect(data['copyright']).toBe('© Acme Corp')
    expect(data['links']).toEqual([
      { text: 'Privacy', href: '/privacy' },
      { text: 'Support', href: 'https://support.example.com' },
    ])
  })

  it('reads a folded scalar as a plain string', () => {
    const { data } = parseDocument(FOOTER_QUOTING, footerDoc)
    expect(data['copyright']).toBe('Folded scalar across two lines')
  })

  it('strips the CR from CRLF sources', () => {
    const { data } = parseDocument(FOOTER_CRLF, footerDoc)
    expect(data['tagline']).toBe('Built with care since 2019')
  })

  it('separates markdown body from frontmatter', () => {
    const { data } = parseDocument(HOME_MD, homeDoc)
    expect(data['title']).toBe('A calmer way to ship')
    expect(data['hero']).toEqual({ src: 'src/assets/hero.jpg', alt: 'A quiet workshop bench' })
    expect(data['body']).toBe('## Why we built this\n\nEditing copy should not require a deploy.\n')
  })
})
