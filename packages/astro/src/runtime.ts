/**
 * Site-side runtime.
 *
 * This module is imported by client templates, so it stays tiny and has no
 * dependencies. Its whole job is to decide whether a page carries editor
 * annotations.
 */

/**
 * Edit mode is a build-time decision, read once at module load.
 *
 * Production and edit builds come from the same commit; only this environment
 * variable differs. Keeping it to one flag is what makes the parity test — the
 * one asserting production output has zero editor footprint — meaningful.
 */
export const EDIT_MODE: boolean = globalThis.process?.env?.['EDITOR_MODE'] === '1'

export type EditAttrs = Record<string, string>

/**
 * Marks an element as editable and binds it to a path in the content schema.
 *
 * ```astro
 * <p {...ed('footer.tagline')}>{footer.tagline}</p>
 * ```
 *
 * Spread onto an element that already exists, so annotating a template never
 * introduces a wrapper and never changes layout. In production it returns an
 * empty object and the attribute is not emitted at all.
 *
 * The path is `<documentId>.<fieldPath>`, with list items indexed:
 * `footer.links.0.text`.
 *
 * Always returns a fresh object: Astro's `spreadAttributes` merges the
 * element's own attributes into whatever it is handed, so a shared or frozen
 * instance would be mutated across call sites — or throw outright.
 */
export function ed(path: string): EditAttrs {
  return EDIT_MODE ? { 'data-ed': path } : {}
}

/**
 * Builds an indexed path for a list item field, so templates do not have to do
 * string arithmetic inline.
 *
 * ```astro
 * {footer.links.map((link, i) => <a {...ed(edIndex('footer.links', i, 'text'))}>…</a>)}
 * ```
 */
export function edIndex(listPath: string, index: number, field?: string): string {
  return field === undefined ? `${listPath}.${index}` : `${listPath}.${index}.${field}`
}

export function isEditMode(): boolean {
  return EDIT_MODE
}
