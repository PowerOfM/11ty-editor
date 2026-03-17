// Re-export the shared types that the frontend uses directly.
// Keep in sync with packages/backend/src/types/index.ts

export type ChangeType = 'frontmatter' | 'body' | 'data' | 'css' | 'asset' | 'raw';

export interface Change {
  id: string;
  type: ChangeType;
  file: string;
  field?: string;
  value: string;
  /** Original value before editing (used for undo / diff display) */
  originalValue?: string;
}

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
  editableFiles: string[];
  assetDirectory: string;
  customCssFile: string;
  publishMode: 'output-push' | 'source-push';
  deployBranch: string;
  ignoredFields: string[];
  fieldHints: Record<string, string>;
}

export interface SiteSchema {
  files: FileSchema[];
  dataFiles: DataFileSchema[];
  editorConfig: EditorConfig;
}

export interface PublishResponse {
  success: boolean;
  deployUrl?: string;
  commitSha?: string;
  error?: string;
  stage?: 'build' | 'push' | 'deploy';
}

export interface PreviewResponse {
  html: string;
  stale?: boolean;
  buildError?: string;
}

/** Credentials entered by the user on the ConnectRepo screen */
export interface SiteCredentials {
  repoUrl: string;
  token: string;
}
