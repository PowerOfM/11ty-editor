// ─── Shared change model ────────────────────────────────────────────────────

export type ChangeType = 'frontmatter' | 'body' | 'data' | 'css' | 'asset' | 'raw';

export interface Change {
  id: string;
  type: ChangeType;
  /** Repo-relative path, e.g. "src/about.md" */
  file: string;
  /** For frontmatter/data changes: the field name */
  field?: string;
  /** New value (string-serialised; arrays/objects are JSON strings) */
  value: string;
}

export interface PublishPayload {
  repoUrl: string;
  branch?: string;
  deployBranch?: string;
  changes: Change[];
}

export interface PreviewPayload {
  repoUrl: string;
  /** Repo-relative path to the page to preview */
  targetFile: string;
  changes: Change[];
}

// ─── Schema model ───────────────────────────────────────────────────────────

export type FieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'image'
  | 'date'
  | 'boolean'
  | 'number'
  | 'array'
  | 'object';

export interface FieldSchema {
  name: string;
  type: FieldType;
  value: unknown;
  label: string;
  hint?: string;
}

export interface FileSchema {
  path: string;
  title: string;
  frontmatter: FieldSchema[];
  hasBody: boolean;
  body?: string;
}

export interface DataFileSchema {
  path: string;
  label: string;
  data: Record<string, unknown>;
}

export interface EditorConfig {
  /** Glob patterns for editable content files, relative to site root */
  editableFiles: string[];
  /** Where uploaded assets are stored (relative to site root) */
  assetDirectory: string;
  /** CSS file that receives GrapesJS / CSS variable overrides */
  customCssFile: string;
  /** "output-push" = push _site/ to deployBranch; "source-push" = push source, let CI build */
  publishMode: 'output-push' | 'source-push';
  /** Branch to push the built output to */
  deployBranch: string;
  /** Frontmatter keys hidden from the form editor */
  ignoredFields: string[];
  /** Human-readable hints shown in the form editor per field name */
  fieldHints: Record<string, string>;
}

export interface SiteSchema {
  files: FileSchema[];
  dataFiles: DataFileSchema[];
  editorConfig: EditorConfig;
}

// ─── API response shapes ─────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  details?: string;
}

export interface PreviewResponse {
  html: string;
  stale?: boolean;
}

export interface PublishResponse {
  success: boolean;
  deployUrl?: string;
  commitSha?: string;
  error?: string;
  stage?: 'build' | 'push' | 'deploy';
}
