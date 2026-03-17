import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { glob } from 'glob';
import type {
  SiteSchema,
  FileSchema,
  FieldSchema,
  FieldType,
  DataFileSchema,
  EditorConfig,
} from '../types';

const DEFAULT_CONFIG: EditorConfig = {
  editableFiles: ['**/*.md'],
  assetDirectory: 'src/images',
  customCssFile: 'src/css/_custom.css',
  publishMode: 'output-push',
  deployBranch: 'gh-pages',
  ignoredFields: [
    'layout',
    'eleventyNavigation',
    'pagination',
    'eleventyExcludeFromCollections',
    'permalink',
    'tags',
  ],
  fieldHints: {},
};

// Image field name keywords (case-insensitive)
const IMAGE_NAMES = ['image', 'cover', 'thumbnail', 'hero', 'banner', 'photo', 'avatar', 'logo', 'icon'];
const DATE_NAMES = ['date', 'publishedat', 'updatedat', 'createdat', 'published'];
const LONG_NAMES = ['description', 'summary', 'excerpt', 'bio', 'about', 'body', 'content'];
const IMAGE_EXT = /\.(jpe?g|png|gif|svg|webp|avif)(\?.*)?$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/;

function inferFieldType(name: string, value: unknown): FieldType {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';

  if (typeof value === 'string') {
    const lower = name.toLowerCase();
    if (IMAGE_NAMES.some((n) => lower.includes(n)) || IMAGE_EXT.test(value)) return 'image';
    if (DATE_NAMES.includes(lower) || DATE_PATTERN.test(value)) return 'date';
    if (LONG_NAMES.some((n) => lower.includes(n)) || value.length > 120) return 'textarea';
    return 'text';
  }

  if (typeof value === 'object' && value !== null) return 'object';
  return 'text';
}

function toLabel(key: string): string {
  return key
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function loadEditorConfig(siteDir: string): EditorConfig {
  const configPath = path.join(siteDir, '.editor.json');
  if (!fs.existsSync(configPath)) return DEFAULT_CONFIG;
  try {
    const loaded = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return { ...DEFAULT_CONFIG, ...loaded };
  } catch {
    console.warn('.editor.json parse failed, using defaults');
    return DEFAULT_CONFIG;
  }
}

function parseMarkdownFile(absPath: string, relPath: string, config: EditorConfig): FileSchema {
  const raw = fs.readFileSync(absPath, 'utf-8');
  const { data: frontmatter, content: body } = matter(raw);

  const fields: FieldSchema[] = Object.entries(frontmatter)
    .filter(([key]) => !config.ignoredFields.includes(key))
    .map(([key, value]) => ({
      name: key,
      type: inferFieldType(key, value),
      value: value ?? '',
      label: toLabel(key),
      hint: config.fieldHints[key],
    }));

  const title =
    (frontmatter['title'] as string | undefined) ||
    toLabel(path.basename(relPath, path.extname(relPath)));

  return { path: relPath, title, frontmatter: fields, hasBody: body.trim().length > 0, body: body.trim() };
}

function parseDataFile(absPath: string, relPath: string): DataFileSchema | null {
  try {
    const raw = fs.readFileSync(absPath, 'utf-8');
    const data = /\.json$/i.test(absPath)
      ? JSON.parse(raw)
      : require('js-yaml').load(raw); // yaml files – optional dep

    if (typeof data !== 'object' || data === null) return null;
    return { path: relPath, label: toLabel(path.basename(relPath, path.extname(relPath))), data };
  } catch {
    return null;
  }
}

/**
 * Walk a local copy of the site repository and return the full schema
 * that drives the form editor UI.
 */
export function parseSiteSchema(siteDir: string): SiteSchema {
  const config = loadEditorConfig(siteDir);

  // ── Markdown / content files ────────────────────────────────────────────
  const mdPaths = glob.sync('**/*.md', {
    cwd: siteDir,
    ignore: ['node_modules/**', '_site/**', '.git/**', 'README.md'],
    absolute: false,
  });

  const files: FileSchema[] = mdPaths.map((rel) =>
    parseMarkdownFile(path.join(siteDir, rel), rel, config)
  );

  // ── _data files (JSON / YAML) ────────────────────────────────────────────
  const dataPaths = glob.sync('**/_data/**/*.{json,yml,yaml}', {
    cwd: siteDir,
    ignore: ['node_modules/**', '_site/**', '.git/**'],
    absolute: false,
  });

  const dataFiles: DataFileSchema[] = dataPaths
    .map((rel) => parseDataFile(path.join(siteDir, rel), rel))
    .filter((d): d is DataFileSchema => d !== null);

  return { files, dataFiles, editorConfig: config };
}
