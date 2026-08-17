import { describe, expect, it } from 'vitest'
import {
  ConfigError,
  defineSite,
  f,
  normalizeRepoPath,
  validateDocument,
  validatePayload,
  writablePaths,
} from '../src/index.js'
import { demoSite, footerDoc, homeDoc } from './fixtures.js'

const validFooter = {
  tagline: 'Built with care',
  copyright: '© Acme Corp',
  links: [{ text: 'Privacy', href: '/privacy' }],
}

function issuePaths(data: unknown) {
  const result = validateDocument(data, footerDoc)
  return result.ok ? [] : result.issues.map((issue) => issue.path)
}

describe('document validation', () => {
  it('accepts a well-formed document', () => {
    const result = validateDocument(validFooter, footerDoc)
    expect(result.ok).toBe(true)
  })

  it('rejects a wrong type', () => {
    expect(issuePaths({ ...validFooter, tagline: 42 })).toEqual(['tagline'])
  })

  it('rejects a missing required field', () => {
    const { copyright: _omitted, ...withoutCopyright } = validFooter
    expect(issuePaths(withoutCopyright)).toEqual(['copyright'])
  })

  it('rejects a value over its max length', () => {
    expect(issuePaths({ ...validFooter, tagline: 'x'.repeat(121) })).toEqual(['tagline'])
  })

  it('rejects a list longer than its max', () => {
    const links = Array.from({ length: 7 }, (_, i) => ({ text: `L${i}`, href: '/x' }))
    expect(issuePaths({ ...validFooter, links })).toEqual(['links'])
  })

  it('reports the exact path of a nested failure', () => {
    const links = [
      { text: 'Privacy', href: '/privacy' },
      { text: 'Bad', href: 'not a url' },
    ]
    expect(issuePaths({ ...validFooter, links })).toEqual(['links.1.href'])
  })

  /**
   * Unknown keys are a rejection rather than something to strip. Silently
   * dropping them would let a malformed payload delete content the client
   * never saw on screen.
   */
  it('rejects unknown keys instead of stripping them', () => {
    expect(issuePaths({ ...validFooter, sneaky: 'value' })).toEqual(['sneaky'])
  })
})

describe('url fields reject script injection', () => {
  const hostile = [
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    ' javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    '//evil.example.com',
  ]

  for (const href of hostile) {
    it(`rejects ${JSON.stringify(href)}`, () => {
      const links = [{ text: 'Click', href }]
      expect(issuePaths({ ...validFooter, links })).toEqual(['links.0.href'])
    })
  }

  const benign = ['/about', '#section', 'https://example.com', 'mailto:hi@example.com', 'tel:+15551234']

  for (const href of benign) {
    it(`accepts ${JSON.stringify(href)}`, () => {
      const links = [{ text: 'Click', href }]
      expect(issuePaths({ ...validFooter, links })).toEqual([])
    })
  }
})

describe('image fields', () => {
  it('requires alt text by default', () => {
    const result = validateDocument(
      { title: 'T', hero: { src: 'a.jpg', alt: '' }, body: '' },
      homeDoc,
    )
    expect(result.ok).toBe(false)
  })

  it('accepts a described image', () => {
    const result = validateDocument(
      { title: 'T', hero: { src: 'a.jpg', alt: 'A bench' }, body: '' },
      homeDoc,
    )
    expect(result.ok).toBe(true)
  })
})

describe('payload validation', () => {
  it('rejects an unknown document id', () => {
    const result = validatePayload({ notARealDoc: {} }, demoSite)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues[0]?.path).toBe('notARealDoc')
  })

  it('prefixes nested issues with the document id', () => {
    const result = validatePayload({ footer: { ...validFooter, tagline: 5 } }, demoSite)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues[0]?.path).toBe('footer.tagline')
  })
})

/**
 * `normalizeRepoPath` is a footgun check in config, but the worker reuses it on
 * paths it derives, where it is the boundary that keeps a save from reaching
 * `.github/workflows` or anything else CI executes.
 */
describe('repo path normalization', () => {
  const rejected = [
    '',
    '/etc/passwd',
    'C:\\windows\\system32',
    '../outside.yaml',
    'src/../../outside.yaml',
    'src//double.yaml',
    'src/./same.yaml',
    'src\\windows\\sep.yaml',
    'src/data/\0null.yaml',
  ]

  for (const path of rejected) {
    it(`rejects ${JSON.stringify(path)}`, () => {
      expect(normalizeRepoPath(path)).toBeNull()
    })
  }

  it('accepts a plain repo-relative path', () => {
    expect(normalizeRepoPath('src/data/footer.yaml')).toBe('src/data/footer.yaml')
  })
})

describe('config coherence', () => {
  it('rejects two documents writing the same file', () => {
    expect(() =>
      defineSite({
        name: 'Dup',
        documents: {
          a: { label: 'A', file: 'src/data/x.yaml', format: 'yaml', fields: {} },
          b: { label: 'B', file: 'src/data/x.yaml', format: 'yaml', fields: {} },
        },
      }),
    ).toThrow(ConfigError)
  })

  it('rejects a path that escapes the repo', () => {
    expect(() =>
      defineSite({
        name: 'Escape',
        documents: {
          a: { label: 'A', file: '../outside.yaml', format: 'yaml', fields: {} },
        },
      }),
    ).toThrow(ConfigError)
  })

  it('rejects a bodyField on a non-markdown document', () => {
    expect(() =>
      defineSite({
        name: 'Bad body',
        documents: {
          a: {
            label: 'A',
            file: 'src/data/a.yaml',
            format: 'yaml',
            bodyField: 'body',
            fields: { body: f.richtext() },
          },
        },
      }),
    ).toThrow(ConfigError)
  })

  it('rejects a bodyField that is not richtext or longtext', () => {
    expect(() =>
      defineSite({
        name: 'Bad body kind',
        documents: {
          a: {
            label: 'A',
            file: 'src/content/a.md',
            format: 'markdown',
            bodyField: 'body',
            fields: { body: f.text() },
          },
        },
      }),
    ).toThrow(ConfigError)
  })

  it('collects every writable path from the config', () => {
    const { files, mediaDir } = writablePaths(demoSite)
    expect([...files].sort()).toEqual([
      'src/content/pages/home.md',
      'src/data/footer.yaml',
      'src/data/theme.json',
    ])
    expect(mediaDir).toBe('src/assets/uploads')
  })
})
