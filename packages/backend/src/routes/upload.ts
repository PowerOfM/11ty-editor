import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as crypto from 'crypto';
import * as admin from 'firebase-admin';
import { extractToken } from './schema';
import type { ApiError } from '../types';

const router = Router();

// Only accept images, fonts, and documents
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'image/avif', 'image/svg+xml',
  'application/pdf',
  'font/woff', 'font/woff2',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type "${file.mimetype}" is not allowed.`));
    }
  },
});

/**
 * POST /api/upload
 * Content-Type: multipart/form-data
 * Field: file (binary)
 * Optional field: folder (string, default "uploads")
 *
 * Uploads to Firebase Storage and returns the public CDN URL.
 */
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization header' } as ApiError);
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' } as ApiError);
  }

  try {
    const folder = sanitiseFolder(req.body['folder'] ?? 'uploads');
    const ext = path.extname(req.file.originalname).toLowerCase();
    const hash = crypto.randomBytes(8).toString('hex');
    const safeName = `${path.basename(req.file.originalname, ext).replace(/[^a-z0-9-_]/gi, '-')}-${hash}${ext}`;
    const storagePath = `${folder}/${safeName}`;

    const bucket = admin.storage().bucket();
    const fileRef = bucket.file(storagePath);

    await fileRef.save(req.file.buffer, {
      metadata: { contentType: req.file.mimetype },
      public: true,
    });

    const [url] = await fileRef.getSignedUrl({
      action: 'read',
      expires: '2099-01-01',
    });

    return res.json({ url, path: storagePath, name: safeName });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('upload error:', msg);
    return res.status(500).json({ error: 'Upload failed', details: msg } as ApiError);
  }
});

function sanitiseFolder(folder: string): string {
  return folder
    .replace(/\.\./g, '')
    .replace(/[^a-z0-9-_/]/gi, '-')
    .replace(/^\/+|\/+$/g, '')
    .slice(0, 64) || 'uploads';
}

export default router;
