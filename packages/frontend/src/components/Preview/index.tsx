/**
 * Preview — Live iframe preview pane.
 * Fetches rendered HTML from /api/preview, debounced to avoid hammering the server.
 */
import { useEffect, useRef, useState } from 'react';
import { RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react';
import { useEditorStore } from '../../store/changeBuffer';
import { fetchPreview } from '../../api/client';

const DEBOUNCE_MS = 800;

export default function Preview() {
  const { credentials, currentFile, changes, previewHtml, previewStale, setPreview } =
    useEditorStore();
  const [loading, setLoading] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!credentials || !currentFile) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      setBuildError(null);
      try {
        const res = await fetchPreview(
          credentials.repoUrl,
          currentFile,
          changes,
          credentials.token
        );
        setPreview(res.html, res.stale ?? false);
        if (res.buildError) setBuildError(res.buildError);
      } catch (err: unknown) {
        setBuildError(err instanceof Error ? err.message : 'Preview failed');
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changes, currentFile, credentials]);

  // Write HTML into iframe when it changes
  useEffect(() => {
    if (!previewHtml || !iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(previewHtml);
    doc.close();
  }, [previewHtml]);

  return (
    <div className="flex flex-col h-full">
      {/* Preview header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 flex-shrink-0">
        <span className="text-xs font-medium text-gray-500">Preview</span>
        <div className="flex items-center gap-1.5">
          {loading && <RefreshCw className="w-3 h-3 text-gray-400 animate-spin" />}
          {previewStale && !loading && (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Stale
            </span>
          )}
          {credentials && (
            <a
              href={credentials.repoUrl.replace('github.com/', 'github.io/').replace('https://github.com/', 'https://')}
              target="_blank"
              rel="noreferrer"
              className="p-1 text-gray-400 hover:text-gray-600"
              title="Open live site"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Build error banner */}
      {buildError && (
        <div className="mx-2 mt-2 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700 flex-shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span className="font-mono break-all">{buildError}</span>
        </div>
      )}

      {/* Iframe */}
      {previewHtml ? (
        <iframe
          ref={iframeRef}
          title="Site preview"
          sandbox="allow-same-origin allow-scripts"
          className="preview-frame flex-1"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          {loading ? 'Building preview…' : 'Make a change to see a preview.'}
        </div>
      )}
    </div>
  );
}
