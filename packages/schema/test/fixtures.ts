import { type DocumentConfig, defineSite, f } from '../src/index.js'

/**
 * Fixtures are written as explicit string literals rather than loaded from
 * disk, because the property under test is byte-level: a stray editor
 * auto-format or a git `core.autocrlf` setting on a checked-in .yaml file would
 * quietly rewrite the very bytes the round-trip test exists to pin down.
 */

export const footerDoc: DocumentConfig = {
  label: 'Footer',
  file: 'src/data/footer.yaml',
  format: 'yaml',
  global: true,
  fields: {
    tagline: f.text({ label: 'Tagline', max: 120 }),
    copyright: f.text({ label: 'Copyright line' }),
    links: f.list({
      label: 'Links',
      max: 6,
      itemLabel: 'text',
      of: { text: f.text(), href: f.url() },
    }),
  },
}

export const homeDoc: DocumentConfig = {
  label: 'Home page',
  file: 'src/content/pages/home.md',
  format: 'markdown',
  previewPath: '/',
  bodyField: 'body',
  fields: {
    title: f.text({ label: 'Headline', max: 80 }),
    hero: f.image({ label: 'Hero image', maxWidth: 2400 }),
    body: f.richtext({ allow: ['bold', 'italic', 'link', 'h2', 'ul'] }),
  },
}

export const themeDoc: DocumentConfig = {
  label: 'Theme',
  file: 'src/data/theme.json',
  format: 'json',
  fields: {
    '--color-brand': f.color({ label: 'Brand colour' }),
    '--radius': f.length({ label: 'Corner radius', unit: 'px', min: 0, max: 24 }),
  },
}

/** Comments, a blank line, and a deliberately unalphabetical key order. */
export const FOOTER_YAML = `# Site-wide footer. Edited through the client editor —
# keep keys in this order, the design references them positionally.
tagline: Built with care since 2019
copyright: "© Acme Corp"

links:
  - text: Privacy
    href: /privacy
  # Support link is seasonal; leave it in place when disabled.
  - text: Support
    href: https://support.example.com
`

export const HOME_MD = `---
title: A calmer way to ship
hero:
  src: src/assets/hero.jpg
  alt: A quiet workshop bench
---

## Why we built this

Editing copy should not require a deploy.
`

export const THEME_JSON = `{
  "--color-brand": "#1f6f4a",
  "--radius": 4
}
`

/** No trailing newline — a classic source of one-line phantom diffs. */
export const FOOTER_NO_TRAILING_NEWLINE = `tagline: Built with care
copyright: "© Acme Corp"
links: []`

/** CRLF throughout, as produced by a Windows editor. */
export const FOOTER_CRLF = FOOTER_YAML.replace(/\n/g, '\r\n')

/** Quoting styles the YAML writer must not "helpfully" normalize. */
export const FOOTER_QUOTING = `tagline: 'Single quoted on purpose'
copyright: >-
  Folded scalar
  across two lines
links:
  - { text: Inline, href: /inline }
`

export const ALL_YAML_FIXTURES: ReadonlyArray<readonly [name: string, source: string]> = [
  ['comments and blank lines', FOOTER_YAML],
  ['no trailing newline', FOOTER_NO_TRAILING_NEWLINE],
  ['CRLF line endings', FOOTER_CRLF],
  ['mixed quoting styles', FOOTER_QUOTING],
  ['empty mapping', 'tagline: ""\ncopyright: ""\nlinks: []\n'],
]

export const demoSite = defineSite({
  name: 'Fixture Co',
  documents: { footer: footerDoc, homepage: homeDoc, theme: themeDoc },
})
