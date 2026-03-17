/**
 * changeApplicator.ts
 *
 * Applies a set of editor Changes to a local copy of the site source files.
 * Each change type mutates files in-place in `siteDir`.
 */
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import type { Change } from '../types';

/**
 * Apply all changes to the site directory in the correct dependency order.
 * Frontmatter changes to the same file are batched into a single write.
 */
export function applyChanges(siteDir: string, changes: Change[]): void {
  // Group frontmatter/body changes by file for batch writes
  const fileChanges = new Map<string, Change[]>();

  for (const change of changes) {
    if (change.type === 'frontmatter' || change.type === 'body') {
      const list = fileChanges.get(change.file) ?? [];
      list.push(change);
      fileChanges.set(change.file, list);
    } else {
      applyNonMarkdownChange(siteDir, change);
    }
  }

  for (const [relPath, changesForFile] of fileChanges.entries()) {
    applyMarkdownChanges(siteDir, relPath, changesForFile);
  }
}

// ── Markdown (frontmatter + body) ──────────────────────────────────────────

function applyMarkdownChanges(siteDir: string, relPath: string, changes: Change[]): void {
  const absPath = path.join(siteDir, relPath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`File not found: ${relPath}`);
  }

  const raw = fs.readFileSync(absPath, 'utf-8');
  const parsed = matter(raw);

  for (const change of changes) {
    if (change.type === 'frontmatter' && change.field) {
      parsed.data[change.field] = deserialiseValue(change.value);
    } else if (change.type === 'body') {
      parsed.content = '\n' + change.value + '\n';
    }
  }

  const updated = matter.stringify(parsed.content, parsed.data);
  writeFileSafe(absPath, updated);
}

// ── Non-markdown changes ───────────────────────────────────────────────────

function applyNonMarkdownChange(siteDir: string, change: Change): void {
  const absPath = path.join(siteDir, change.file);

  switch (change.type) {
    case 'css':
    case 'raw':
      writeFileSafe(absPath, change.value);
      break;

    case 'data': {
      const ext = path.extname(change.file).toLowerCase();
      if (ext === '.json') {
        const current = fs.existsSync(absPath)
          ? JSON.parse(fs.readFileSync(absPath, 'utf-8'))
          : {};
        const patch = JSON.parse(change.value);
        writeFileSafe(absPath, JSON.stringify({ ...current, ...patch }, null, 2));
      } else {
        writeFileSafe(absPath, change.value);
      }
      break;
    }

    case 'asset':
      // Assets are uploaded separately; the change just records the new path/URL
      // so nothing to write to disk here — the CDN URL is already in frontmatter.
      break;

    default:
      throw new Error(`Unknown change type: ${(change as Change).type}`);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function writeFileSafe(absPath: string, content: string): void {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content, 'utf-8');
}

/**
 * JSON-parse the value if it looks like structured data, otherwise return
 * it as a plain string.  This lets frontmatter arrays / objects round-trip.
 */
function deserialiseValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'object' || Array.isArray(parsed)) return parsed;
    return value; // was a quoted string — keep as string
  } catch {
    return value;
  }
}
