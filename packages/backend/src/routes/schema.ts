import { Router, Request, Response } from 'express';
import { parseSiteSchema } from '../lib/siteParser';
import { prepareRepo } from '../lib/buildPipeline';
import type { ApiError } from '../types';

const router = Router();

/**
 * GET /api/schema?repo=https://github.com/owner/repo
 *
 * Clones (or uses cached) the target site repo, parses all markdown files
 * and _data files, and returns the schema that drives the form editor UI.
 *
 * Requires: Authorization: Bearer <github-pat>
 */
router.get('/', async (req: Request, res: Response) => {
  const repoUrl = req.query['repo'] as string | undefined;
  const token = extractToken(req);

  if (!repoUrl) {
    const err: ApiError = { error: 'Missing query param: repo' };
    return res.status(400).json(err);
  }
  if (!token) {
    const err: ApiError = { error: 'Missing Authorization header' };
    return res.status(401).json(err);
  }

  try {
    const siteDir = await prepareRepo(repoUrl, token);
    const schema = parseSiteSchema(siteDir);
    return res.json(schema);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('schema error:', msg);
    const apiErr: ApiError = { error: 'Failed to load site schema', details: msg };
    return res.status(500).json(apiErr);
  }
});

export default router;

export function extractToken(req: Request): string | null {
  const header = req.headers['authorization'] ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}
