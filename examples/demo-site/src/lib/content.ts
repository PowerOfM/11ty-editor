import { readYaml } from '@astro-editor/schema'
import siteConfig from '../../editor.config'
import themeTokens from '../data/theme.json'
// `?raw` hands us the exact file bytes, which we parse with the same reader the
// editor and the commit worker use. One parser, one set of edge cases.
import footerRaw from '../data/footer.yaml?raw'

export interface FooterLink {
  text: string
  href: string
}

export interface FooterData {
  tagline: string
  copyright: string
  links: FooterLink[]
}

export const footer = readYaml(footerRaw) as FooterData

/**
 * Renders theme.json as a `:root` block.
 *
 * The numeric value and its unit are stored separately — the value in
 * theme.json, the unit in the schema — so the client edits a number on a slider
 * and cannot produce `4pxpx` or `4em` by accident.
 */
export function themeCss(): string {
  const tokens = siteConfig.theme?.tokens ?? {}

  const declarations = Object.entries(themeTokens).map(([name, value]) => {
    const field = tokens[name as keyof typeof tokens]
    const unit = field?.kind === 'length' ? field.unit : ''
    return `  ${name}: ${value}${unit};`
  })

  return `:root {\n${declarations.join('\n')}\n}`
}
