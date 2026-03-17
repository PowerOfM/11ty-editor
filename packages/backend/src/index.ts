import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import express from 'express';
import cors from 'cors';

import schemaRouter from './routes/schema';
import previewRouter from './routes/preview';
import publishRouter from './routes/publish';
import uploadRouter from './routes/upload';
import filesRouter from './routes/files';

// ── Firebase Admin init ────────────────────────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp();
}

// ── Express app ────────────────────────────────────────────────────────────
const app = express();

app.use(
  cors({
    origin: process.env['ALLOWED_ORIGIN'] ?? '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '4mb' }));

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/schema', schemaRouter);
app.use('/api/preview', previewRouter);
app.use('/api/publish', publishRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/files', filesRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Catch-all error handler ────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// ── Export as Firebase Function ────────────────────────────────────────────
export const api = onRequest(
  {
    memory: '1GiB',
    timeoutSeconds: 300, // 5-minute timeout for builds
    minInstances: 0,
    region: 'us-central1',
  },
  app
);
