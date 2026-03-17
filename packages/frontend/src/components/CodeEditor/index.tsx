/**
 * CodeEditor — Advanced mode raw file editor.
 * Uses a plain <textarea> for Phase 1 (Monaco can replace it in Phase 4).
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, Save, RotateCcw } from 'lucide-react';
import { useEditorStore } from '../../store/changeBuffer';
import { getFileContent, putFileContent } from '../../api/client';

export default function CodeEditor() {
  const { credentials, currentFile, upsertChange, changes } = useEditorStore();
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the file from GitHub when the file selection changes
  useEffect(() => {
    if (!credentials || !currentFile) return;
    setLoading(true);
    setError(null);
    getFileContent(credentials.repoUrl, currentFile, credentials.token)
      .then((res) => {
        setContent(res.content);
        setOriginalContent(res.content);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [credentials, currentFile]);

  const isDirty = content !== originalContent;

  async function handleSave() {
    if (!credentials || !currentFile || !isDirty) return;
    setSaving(true);
    try {
      await putFileContent(credentials.repoUrl, currentFile, content, credentials.token);
      setOriginalContent(content);
      // Also buffer as a raw change for the publish pipeline
      upsertChange('raw', currentFile, content, undefined, originalContent);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setContent(originalContent);
  }

  if (!currentFile) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Select a file to edit.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Warning banner */}
      <div className="flex items-center gap-2 bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-700 flex-shrink-0">
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
        <span>
          <strong>Advanced mode.</strong> Direct edits to template or config files can break the
          site. Be careful.
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-white flex-shrink-0">
        <span className="text-xs font-mono text-gray-500">{currentFile}</span>
        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-brand-500 text-white rounded-md hover:bg-brand-600 disabled:bg-gray-200 disabled:text-gray-400"
          >
            <Save className="w-3 h-3" />
            {saving ? 'Saving…' : 'Save to repo'}
          </button>
        </div>
      </div>

      {/* Editor area */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Loading…
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center text-red-500 text-sm p-4">
          {error}
        </div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck={false}
          className="flex-1 w-full p-4 font-mono text-xs text-gray-800 bg-gray-50 resize-none focus:outline-none border-0"
        />
      )}
    </div>
  );
}
