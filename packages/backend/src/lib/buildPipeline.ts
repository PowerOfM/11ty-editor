/**
 * buildPipeline.ts
 *
 * Clones a site repo to a temp directory, applies changes, runs the 11ty
 * build, and returns the output directory path.
 *
 * A simple LRU-style cache keyed on (repoUrl + commitSha) avoids re-cloning
 * for back-to-back preview requests.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { simpleGit } from 'simple-git';
import type { Change } from '../types';
import { applyChanges } from './changeApplicator';

// ── Repo cache ─────────────────────────────────────────────────────────────

interface CacheEntry {
  dir: string;
  repoUrl: string;
  commitSha: string;
  ts: number;
}

const MAX_CACHE = 5;
const cache: CacheEntry[] = [];

function getCached(repoUrl: string, commitSha: string): string | null {
  const hit = cache.find((e) => e.repoUrl === repoUrl && e.commitSha === commitSha);
  return hit?.dir ?? null;
}

function setCached(repoUrl: string, commitSha: string, dir: string): void {
  if (cache.length >= MAX_CACHE) {
    // Evict oldest
    const oldest = cache.sort((a, b) => a.ts - b.ts).shift();
    if (oldest) {
      try {
        fs.rmSync(oldest.dir, { recursive: true, force: true });
      } catch { /* ignore */ }
    }
  }
  cache.push({ dir, repoUrl, commitSha, ts: Date.now() });
}

// ── Clone helper ────────────────────────────────────────────────────────────

/**
 * Returns the path to a fresh or cached clone of the repo.
 * The `token` is a GitHub PAT used for authenticated access.
 */
export async function prepareRepo(repoUrl: string, token: string): Promise<string> {
  const git = simpleGit();

  // Get the latest commit SHA without cloning the whole repo
  const remoteInfo = await git.listRemote(['--heads', injectToken(repoUrl, token)]).catch(() => '');
  const mainSha = parseHeadSha(remoteInfo) ?? `no-sha-${Date.now()}`;

  const cached = getCached(repoUrl, mainSha);
  if (cached && fs.existsSync(cached)) {
    return cached;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), '11ty-editor-'));
  await simpleGit().clone(injectToken(repoUrl, token), tmpDir, ['--depth', '1']);
  setCached(repoUrl, mainSha, tmpDir);
  return tmpDir;
}

/**
 * Copy a cloned repo to a *fresh* working directory so we can mutate it
 * without poisoning the cache.
 */
export function cloneDir(srcDir: string): string {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), '11ty-work-'));
  copyDirSync(srcDir, dest);
  return dest;
}

// ── 11ty build ─────────────────────────────────────────────────────────────

export interface BuildResult {
  outputDir: string;
  /** List of output file paths relative to outputDir */
  files: string[];
}

export interface BuildError {
  message: string;
  file?: string;
}

/**
 * Apply changes, run the 11ty build, and return the output directory.
 * Throws `BuildError` on build failure (caught by routes for structured errors).
 */
export async function buildSite(workDir: string, changes: Change[]): Promise<BuildResult> {
  applyChanges(workDir, changes);

  const outputDir = path.join(workDir, '_site');

  // Dynamically import Eleventy to avoid issues with CJS/ESM
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Eleventy = require('@11ty/eleventy');

  const elev = new Eleventy(workDir, outputDir, {
    quietMode: true,
    // Suppress watch mode
  });

  try {
    await elev.write();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const buildErr: BuildError = { message: msg };
    // Try to extract the problem file from the error message
    const fileMatch = msg.match(/\(([^)]+\.(?:md|njk|liquid|html))\)/);
    if (fileMatch) buildErr.file = fileMatch[1];
    throw buildErr;
  }

  const files = walkDir(outputDir).map((f) => path.relative(outputDir, f));
  return { outputDir, files };
}

/**
 * Build only a single page and return its HTML without writing to disk.
 * Falls back to full build if the single-page API is unavailable.
 */
export async function buildPagePreview(workDir: string, changes: Change[], targetFile: string): Promise<string> {
  applyChanges(workDir, changes);

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Eleventy = require('@11ty/eleventy');

  const elev = new Eleventy(workDir, path.join(workDir, '_site'), {
    quietMode: true,
  });

  try {
    const pages: Array<{ inputPath: string; content: string; url: string }> = await elev.toJSON();
    const page = pages.find((p) => p.inputPath.endsWith(targetFile));
    if (page) return page.content;
    // Return the index page as fallback
    const index = pages.find((p) => p.url === '/') ?? pages[0];
    return index?.content ?? '<p>Preview unavailable.</p>';
  } catch (err: unknown) {
    throw { message: err instanceof Error ? err.message : String(err) };
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────

function injectToken(repoUrl: string, token: string): string {
  return repoUrl.replace('https://', `https://oauth2:${token}@`);
}

function parseHeadSha(remoteOutput: string): string | null {
  const match = remoteOutput.match(/^([a-f0-9]{40})\s/m);
  return match?.[1] ?? null;
}

function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full));
    else results.push(full);
  }
  return results;
}

function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '_site') continue;
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
