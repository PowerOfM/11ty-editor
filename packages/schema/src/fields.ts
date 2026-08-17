/**
 * Field descriptors.
 *
 * A descriptor is inert data — it carries no behaviour and no Zod schema. The
 * same object is consumed by three very different places: the editor renders a
 * control from it, the worker derives a validator from it, and the Astro
 * integration checks the site against it. Keeping descriptors as plain data is
 * what lets the worker validate a payload without importing anything from the
 * site it is validating.
 *
 * The set is deliberately small. This is a website *editor*, not a builder:
 * `list` is the only field that lets a client change structure, and even then
 * only within a shape the developer declared.
 */

export type FieldKind =
  | 'text'
  | 'longtext'
  | 'richtext'
  | 'image'
  | 'url'
  | 'select'
  | 'boolean'
  | 'number'
  | 'color'
  | 'length'
  | 'list'
  | 'group'

interface FieldBase {
  readonly kind: FieldKind
  /** Shown above the control in the editor. Falls back to the field key. */
  readonly label?: string
  /** Shown under the control as guidance for the client. */
  readonly help?: string
  /** Fields are required by default; opt out explicitly. */
  readonly optional?: boolean
}

/** Single-line copy: headlines, taglines, link text. */
export interface TextField extends FieldBase {
  readonly kind: 'text'
  readonly min?: number
  readonly max?: number
}

/** Multi-line plain text with no formatting. */
export interface LongTextField extends FieldBase {
  readonly kind: 'longtext'
  readonly min?: number
  readonly max?: number
}

/** The marks and blocks a richtext field may contain. */
export type RichTextFeature =
  | 'bold'
  | 'italic'
  | 'link'
  | 'h2'
  | 'h3'
  | 'ul'
  | 'ol'
  | 'blockquote'
  | 'code'

/** Markdown on disk, constrained WYSIWYG in the editor. */
export interface RichTextField extends FieldBase {
  readonly kind: 'richtext'
  /** Anything omitted here is stripped by the editor and rejected on save. */
  readonly allow?: readonly RichTextFeature[]
  readonly max?: number
}

export interface ImageField extends FieldBase {
  readonly kind: 'image'
  /** Uploads wider than this are downscaled before they are committed. */
  readonly maxWidth?: number
  /** Require alt text. Defaults to true — this is a client-facing tool. */
  readonly requireAlt?: boolean
}

export interface UrlField extends FieldBase {
  readonly kind: 'url'
  /** Permit site-relative values such as `/about`. Defaults to true. */
  readonly allowRelative?: boolean
}

export interface SelectOption {
  readonly value: string
  readonly label?: string
}

export interface SelectField extends FieldBase {
  readonly kind: 'select'
  readonly options: readonly SelectOption[]
}

export interface BooleanField extends FieldBase {
  readonly kind: 'boolean'
}

export interface NumberField extends FieldBase {
  readonly kind: 'number'
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly integer?: boolean
}

/** A CSS colour, stored as a hex string. */
export interface ColorField extends FieldBase {
  readonly kind: 'color'
  /** Permit 8-digit hex (alpha). Defaults to false. */
  readonly allowAlpha?: boolean
}

/** A numeric CSS length. The unit lives in the schema, not in the value. */
export interface LengthField extends FieldBase {
  readonly kind: 'length'
  readonly unit: 'px' | 'rem' | 'em' | '%'
  readonly min?: number
  readonly max?: number
  readonly step?: number
}

/** The one structural affordance: add, remove and reorder within a fixed shape. */
export interface ListField extends FieldBase {
  readonly kind: 'list'
  readonly of: FieldMap
  readonly min?: number
  readonly max?: number
  /** Which subfield to show as the row title in the editor. */
  readonly itemLabel?: string
}

/** Nesting only. Adds no affordance of its own. */
export interface GroupField extends FieldBase {
  readonly kind: 'group'
  readonly fields: FieldMap
}

export type Field =
  | TextField
  | LongTextField
  | RichTextField
  | ImageField
  | UrlField
  | SelectField
  | BooleanField
  | NumberField
  | ColorField
  | LengthField
  | ListField
  | GroupField

export type FieldMap = { readonly [key: string]: Field }

/** The shape an `image` field carries on disk. */
export interface ImageValue {
  readonly src: string
  readonly alt?: string
}

type Opts<F extends Field> = Omit<F, 'kind'>

/**
 * Field builders. Each is a thin constructor over the descriptor so that call
 * sites read as a schema rather than as object literals.
 */
export const f = {
  text: (o: Opts<TextField> = {}): TextField => ({ kind: 'text', ...o }),
  longtext: (o: Opts<LongTextField> = {}): LongTextField => ({ kind: 'longtext', ...o }),
  richtext: (o: Opts<RichTextField> = {}): RichTextField => ({ kind: 'richtext', ...o }),
  image: (o: Opts<ImageField> = {}): ImageField => ({ kind: 'image', ...o }),
  url: (o: Opts<UrlField> = {}): UrlField => ({ kind: 'url', ...o }),
  select: (o: Opts<SelectField>): SelectField => ({ kind: 'select', ...o }),
  boolean: (o: Opts<BooleanField> = {}): BooleanField => ({ kind: 'boolean', ...o }),
  number: (o: Opts<NumberField> = {}): NumberField => ({ kind: 'number', ...o }),
  color: (o: Opts<ColorField> = {}): ColorField => ({ kind: 'color', ...o }),
  length: (o: Opts<LengthField>): LengthField => ({ kind: 'length', ...o }),
  list: (o: Opts<ListField>): ListField => ({ kind: 'list', ...o }),
  group: (o: Opts<GroupField>): GroupField => ({ kind: 'group', ...o }),
} as const

/** The runtime value type a descriptor describes. */
export type InferField<F extends Field> = F extends ListField
  ? InferFields<F['of']>[]
  : F extends GroupField
    ? InferFields<F['fields']>
    : F extends ImageField
      ? ImageValue
      : F extends BooleanField
        ? boolean
        : F extends NumberField | LengthField
          ? number
          : string

export type InferFields<M extends FieldMap> = {
  [K in keyof M]: M[K]['optional'] extends true ? InferField<M[K]> | undefined : InferField<M[K]>
}
