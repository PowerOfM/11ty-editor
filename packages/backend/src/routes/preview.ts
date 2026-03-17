import { Router, Request, Response } from 'express';
import { prepareRepo, cloneDir, buildPagePreview } from '../lib/buildPipeline';
import { extractToken } from './schema';
import type { PreviewPayload, ApiError } from '../types';

const router = Router();

// Cache the last successful preview per repo+file so we can serve a stale
// response when the build errors out.
const previewCache = new Map<string, string>();

/**
 * POST /api/preview
 * Body: PreviewPayload
 *
 * Applies changes to an in-memory copy of the site, runs a partial 11ty build,
 * and returns the rendered HTML for the requested page.
 */
router.post('/', async (req: Request, res: Response) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization header' } as ApiError);
  }

  const body = req.body as Partial<PreviewPayload>;
  if (!body.repoUrl || !body.targetFile) {
    return res.status(400).json({ error: 'repoUrl and targetFile are required' } as ApiError);
  }

  const cacheKey = `${body.repoUrl}::${body.targetFile}`;

  try {
    const baseDir = await prepareRepo(body.repoUrl, token);
    const workDir = cloneDir(baseDir);

    const html = await buildPagePreview(workDir, body.changes ?? [], body.targetFile);

    // Inject a small script to disable navigation inside the preview iframe
    const safeHtml = html.replace(
      '</head>',
      '<base target="_blank"></head>'
    );

    previewCache.set(cacheKey, safeHtml);
    return res.json({ html: safeHtml });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? String(err);
    console.error('preview build error:', msg);

    const stale = previewCache.get(cacheKey);
    if (stale) {
      return res.json({
        html: stale,
        stale: true,
        buildError: msg,
      });
    }

    return res.status(500).json({
      error: 'Preview build failed',
      details: msg,
    } as ApiError);
  }
});

export default router;
