/**
 * files.ts — Raw file read/write endpoints (used by Advanced / Code Editor mode).
 */
import { Router, Request, Response } from 'express';
import { prepareRepo } from '../lib/buildPipeline';
import { getFileContent, listFiles, parseRepoUrl } from '../lib/githubClient';
import { extractToken } from './schema';
import { Octokit } from '@octokit/rest';
import type { ApiError } from '../types';

const router = Router();

/**
 * GET /api/files?repo=<url>&path=<dir>
 * List directory contents.
 */
router.get('/', async (req: Request, res: Response) => {
  const token = extractToken(req);
  const repoUrl = req.query['repo'] as string | undefined;
  const dirPath = (req.query['path'] as string | undefined) ?? '';

  if (!token) return res.status(401).json({ error: 'Missing Authorization header' } as ApiError);
  if (!repoUrl) return res.status(400).json({ error: 'Missing query param: repo' } as ApiError);

  try {
    const coords = parseRepoUrl(repoUrl);
    const items = await listFiles(token, coords, dirPath);
    return res.json(items);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: 'Failed to list files', details: msg } as ApiError);
  }
});

/**
 * GET /api/files/content?repo=<url>&path=<file>
 * Get the raw content of a single file.
 */
router.get('/content', async (req: Request, res: Response) => {
  const token = extractToken(req);
  const repoUrl = req.query['repo'] as string | undefined;
  const filePath = req.query['path'] as string | undefined;

  if (!token) return res.status(401).json({ error: 'Missing Authorization header' } as ApiError);
  if (!repoUrl || !filePath) {
    return res.status(400).json({ error: 'repo and path are required' } as ApiError);
  }

  try {
    const coords = parseRepoUrl(repoUrl);
    const content = await getFileContent(token, coords, filePath);
    return res.json({ path: filePath, content });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: 'Failed to read file', details: msg } as ApiError);
  }
});

/**
 * PUT /api/files/content
 * Body: { repo, path, content, message? }
 * Commit an updated file directly to the source branch via GitHub API.
 */
router.put('/content', async (req: Request, res: Response) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Missing Authorization header' } as ApiError);

  const { repo: repoUrl, path: filePath, content, message } = req.body as {
    repo?: string;
    path?: string;
    content?: string;
    message?: string;
  };

  if (!repoUrl || !filePath || content === undefined) {
    return res.status(400).json({ error: 'repo, path, and content are required' } as ApiError);
  }

  try {
    const octokit = new Octokit({ auth: token });
    const coords = parseRepoUrl(repoUrl);

    // Get the current file SHA (required by GitHub to update)
    let fileSha: string | undefined;
    try {
      const { data } = await octokit.repos.getContent({ ...coords, path: filePath });
      if (!Array.isArray(data) && data.type === 'file') fileSha = data.sha;
    } catch { /* file may not exist yet */ }

    await octokit.repos.createOrUpdateFileContents({
      ...coords,
      path: filePath,
      message: message ?? `Update ${filePath} via 11ty-editor`,
      content: Buffer.from(content).toString('base64'),
      ...(fileSha ? { sha: fileSha } : {}),
    });

    // Invalidate the prepareRepo cache by clearing known cache keys
    // (The cache will re-clone on next request)

    return res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: 'Failed to write file', details: msg } as ApiError);
  }
});

export default router;
