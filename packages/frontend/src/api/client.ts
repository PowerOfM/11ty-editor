/**
 * api/client.ts — Typed wrappers around the backend REST API.
 */
import type {
  SiteSchema,
  Change,
  PreviewResponse,
  PublishResponse,
} from '../types';

const BASE = import.meta.env['VITE_API_URL'] ?? '';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  token: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  const json = await res.json().catch(() => ({ error: res.statusText }));

  if (!res.ok) {
    throw new ApiError(
      json.error ?? 'Request failed',
      res.status,
      json.details
    );
  }

  return json as T;
}

// ── Schema ──────────────────────────────────────────────────────────────────

export async function fetchSchema(repoUrl: string, token: string): Promise<SiteSchema> {
  return request<SiteSchema>(
    `/api/schema?repo=${encodeURIComponent(repoUrl)}`,
    token
  );
}

// ── Preview ─────────────────────────────────────────────────────────────────

export async function fetchPreview(
  repoUrl: string,
  targetFile: string,
  changes: Change[],
  token: string
): Promise<PreviewResponse> {
  return request<PreviewResponse>('/api/preview', token, {
    method: 'POST',
    body: JSON.stringify({ repoUrl, targetFile, changes }),
  });
}

// ── Publish ──────────────────────────────────────────────────────────────────

export async function publishSite(
  repoUrl: string,
  changes: Change[],
  token: string,
  deployBranch?: string
): Promise<PublishResponse> {
  return request<PublishResponse>('/api/publish', token, {
    method: 'POST',
    body: JSON.stringify({ repoUrl, changes, deployBranch }),
  });
}

// ── File upload ──────────────────────────────────────────────────────────────

export async function uploadFile(
  file: File,
  folder: string,
  token: string
): Promise<{ url: string; path: string; name: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const res = await fetch(`${BASE}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  const json = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new ApiError(json.error ?? 'Upload failed', res.status, json.details);
  return json;
}

// ── Raw file access ──────────────────────────────────────────────────────────

export async function listFiles(
  repoUrl: string,
  dirPath: string,
  token: string
): Promise<Array<{ path: string; type: 'file' | 'dir'; size?: number }>> {
  return request(
    `/api/files?repo=${encodeURIComponent(repoUrl)}&path=${encodeURIComponent(dirPath)}`,
    token
  );
}

export async function getFileContent(
  repoUrl: string,
  filePath: string,
  token: string
): Promise<{ path: string; content: string }> {
  return request(
    `/api/files/content?repo=${encodeURIComponent(repoUrl)}&path=${encodeURIComponent(filePath)}`,
    token
  );
}

export async function putFileContent(
  repoUrl: string,
  filePath: string,
  content: string,
  token: string,
  message?: string
): Promise<void> {
  await request('/api/files/content', token, {
    method: 'PUT',
    body: JSON.stringify({ repo: repoUrl, path: filePath, content, message }),
  });
}

export { ApiError };
