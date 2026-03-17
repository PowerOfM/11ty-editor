/**
 * Layout — Top-level shell for the editor.
 * Hosts the three-panel layout: file tree | editor | preview.
 */
import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import {
  Globe, LogOut, Code2, LayoutDashboard, FileText,
  PanelRight, PanelRightClose,
} from 'lucide-react';
import { useEditorStore } from '../../store/changeBuffer';
import FileTree from '../FileTree';
import FormEditor from '../FormEditor';
import Preview from '../Preview';
import PublishButton from '../PublishButton';

export default function EditorLayout() {
  const { schema, schemaLoading, schemaError, editorMode, setEditorMode, disconnect, changes } =
    useEditorStore();
  const [showPreview, setShowPreview] = useState(true);

  if (schemaLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">
        Loading site…
      </div>
    );
  }

  if (schemaError || !schema) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-gray-600">
        <p className="text-red-600 text-sm">{schemaError ?? 'Could not load schema.'}</p>
        <button onClick={disconnect} className="text-sm text-brand-600 hover:underline">
          Disconnect and try again
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="h-12 flex items-center justify-between px-4 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-brand-500" />
          <span className="font-semibold text-gray-800 text-sm">11ty Editor</span>
          {changes.length > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-medium">
              {changes.length} unsaved {changes.length === 1 ? 'change' : 'changes'}
            </span>
          )}
        </div>

        {/* Mode switcher */}
        <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
          {(
            [
              { id: 'form', icon: FileText, label: 'Content' },
              { id: 'visual', icon: LayoutDashboard, label: 'Visual' },
              { id: 'code', icon: Code2, label: 'Code' },
            ] as const
          ).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setEditorMode(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                editorMode === id
                  ? 'bg-brand-500 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <PublishButton />
          <button
            onClick={() => setShowPreview((v) => !v)}
            title="Toggle preview"
            className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100"
          >
            {showPreview ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRight className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={disconnect}
            title="Disconnect"
            className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Main three-panel area ────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* File tree sidebar */}
        <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto file-tree-scroll">
          <FileTree />
        </aside>

        {/* Editor pane */}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<FormEditor />} />
            <Route path="*" element={<Navigate to="/edit" replace />} />
          </Routes>
        </main>

        {/* Live preview */}
        {showPreview && (
          <aside className="w-[480px] flex-shrink-0 border-l border-gray-200 bg-white">
            <Preview />
          </aside>
        )}
      </div>
    </div>
  );
}
