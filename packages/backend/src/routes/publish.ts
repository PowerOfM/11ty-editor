import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import { prepareRepo, cloneDir, buildSite } from '../lib/buildPipeline';
import { deployOutputBranch, parseRepoUrl } from '../lib/githubClient';
import { extractToken } from './schema';
import type { PublishPayload, PublishResponse, ApiError } from '../types';

const router = Router();

/**
 * POST /api/publish
 * Body: PublishPayload
 *
 * Full publish pipeline:
 *  1. Clone / use cached site repo
 *  2. Apply all changes to a working copy
 *  3. Run the 11ty build
 *  4. Push _site/ to the deploy branch via GitHub API
 *
 * Returns PublishResponse.
 */
router.post('/', async (req: Request, res: Response) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization header' } as ApiError);
  }

  const body = req.body as Partial<PublishPayload>;
  if (!body.repoUrl) {
    return res.status(400).json({ error: 'repoUrl is required' } as ApiError);
  }

  let stage: PublishResponse['stage'] = 'build';
  let workDir: string | null = null;

  try {
    // ── Stage 1: prepare a mutable working copy ───────────────────────────
    const baseDir = await prepareRepo(body.repoUrl, token);
    workDir = cloneDir(baseDir);

    // ── Stage 2: build ────────────────────────────────────────────────────
    const { outputDir } = await buildSite(workDir, body.changes ?? []);

    // ── Stage 3: push to deploy branch ────────────────────────────────────
    stage = 'push';
    const coords = parseRepoUrl(body.repoUrl);
    const deployBranch = body.deployBranch ?? 'gh-pages';

    const { commitSha, deployUrl } = await deployOutputBranch(
      token,
      coords,
      outputDir,
      deployBranch
    );

    const response: PublishResponse = { success: true, commitSha, deployUrl };
    return res.json(response);
  } catch (err: unknown) {
    const msg =
      err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? String(err);

    console.error(`publish error (stage=${stage}):`, msg);

    const response: PublishResponse = {
      success: false,
      stage,
      error: friendlyError(stage, msg),
    };
    return res.status(500).json(response);
  } finally {
    // Clean up the working copy (not the cached base)
    if (workDir) {
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch { /* ignore */ }
    }
  }
});

function friendlyError(stage: PublishResponse['stage'], detail: string): string {
  switch (stage) {
    case 'build':
      return `The site failed to build. Check your template syntax. Details: ${detail}`;
    case 'push':
      return `The site built successfully but could not be pushed to GitHub. Check your token permissions. Details: ${detail}`;
    default:
      return detail;
  }
}

export default router;
