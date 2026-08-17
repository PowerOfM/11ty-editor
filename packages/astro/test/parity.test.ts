import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * The test that protects real client sites.
 *
 * Production and edit builds come from the same commit and the same templates;
 * only `EDITOR_MODE` differs. This asserts that a production build carries no
 * trace of the editor — no `data-ed` attributes, no bridge script, no `/_ed/`
 * asset — while the edit build carries exactly the annotations the templates
 * declare.
 *
 * It also proves the propagation claim directly: the `footer.*` paths must be
 * identical on both pages, because both import the same Footer component.
 */

const siteRoot = fileURLToPath(new URL('../../../examples/demo-site', import.meta.url))
const PROD_DIR = 'dist-test-prod'
const EDIT_DIR = 'dist-test-edit'

function build(outDir: string, editMode: boolean): void {
  execFileSync('pnpm', ['exec', 'astro', 'build', '--outDir', outDir], {
    cwd: siteRoot,
    env: {
      ...process.env,
      ...(editMode ? { EDITOR_MODE: '1' } : { EDITOR_MODE: '' }),
      ASTRO_TELEMETRY_DISABLED: '1',
    },
    stdio: 'pipe',
  })
}

const page = (dir: string, path: string) => readFileSync(join(siteRoot, dir, path), 'utf8')
const editPaths = (html: string) =>
  [...html.matchAll(/data-ed="([^"]*)"/g)].map((match) => match[1]!).sort()

let prodHome: string
let prodAbout: string
let editHome: string
let editAbout: string

beforeAll(() => {
  build(PROD_DIR, false)
  build(EDIT_DIR, true)
  prodHome = page(PROD_DIR, 'index.html')
  prodAbout = page(PROD_DIR, 'about/index.html')
  editHome = page(EDIT_DIR, 'index.html')
  editAbout = page(EDIT_DIR, 'about/index.html')
}, 180_000)

afterAll(() => {
  for (const dir of [PROD_DIR, EDIT_DIR]) {
    rmSync(join(siteRoot, dir), { recursive: true, force: true })
  }
})

describe('production builds carry no editor footprint', () => {
  it('emits no data-ed attributes', () => {
    expect(editPaths(prodHome)).toEqual([])
    expect(editPaths(prodAbout)).toEqual([])
  })

  it('emits no bridge script or /_ed/ asset', () => {
    for (const html of [prodHome, prodAbout]) {
      expect(html).not.toContain('/_ed/')
      expect(html).not.toContain('bridge')
    }
  })

  /**
   * Developer commentary belongs in the frontmatter fence, not in HTML
   * comments — the latter are emitted verbatim and would ship to visitors.
   */
  it('leaks no authoring commentary into the markup', () => {
    for (const html of [prodHome, prodAbout]) {
      expect(html).not.toContain('data-ed')
      expect(html).not.toContain('propagation mechanism')
    }
  })

  it('still renders the content itself', () => {
    expect(prodHome).toContain('Bench-made joinery for people who keep things')
    expect(prodHome).toContain('© 2026 Northwind Joinery')
  })
})

describe('edit builds annotate exactly what the schema declares', () => {
  it('annotates the home page fields', () => {
    expect(editPaths(editHome)).toEqual([
      'footer.copyright',
      'footer.links.0.text',
      'footer.links.1.text',
      'footer.tagline',
      'home.body',
      'home.intro',
      'home.title',
    ])
  })

  it('annotates the about page fields', () => {
    expect(editPaths(editAbout)).toEqual([
      'about.body',
      'about.intro',
      'about.title',
      'footer.copyright',
      'footer.links.0.text',
      'footer.links.1.text',
      'footer.tagline',
    ])
  })

  /**
   * The footer requirement, asserted directly: one shared component means one
   * shared set of paths, so a single edit reaches every page.
   */
  it('gives both pages identical footer paths', () => {
    const footerPaths = (html: string) => editPaths(html).filter((p) => p.startsWith('footer.'))
    expect(footerPaths(editHome)).toEqual(footerPaths(editAbout))
    expect(footerPaths(editHome).length).toBeGreaterThan(0)
  })

  it('renders the same footer copy on both pages', () => {
    for (const html of [editHome, editAbout]) {
      expect(html).toContain('Bench-made joinery for people who keep things')
    }
  })

  it('does not disturb the markup around annotated elements', () => {
    // The annotation lands on the existing element rather than a wrapper.
    expect(editHome).toMatch(/<p class="tagline"[^>]*data-ed="footer\.tagline"/)
  })
})
