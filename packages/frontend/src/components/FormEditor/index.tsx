/**
 * FormEditor — The primary content editing panel.
 *
 * Shows form fields derived from the current file's frontmatter schema,
 * plus a rich-text body editor if the file has body content.
 *
 * Switching between files commits nothing — changes are buffered in Zustand
 * until the user hits Publish.
 */
import { useEditorStore } from '../../store/changeBuffer';
import FieldRenderer from './FieldRenderer';
import CodeEditor from '../CodeEditor';
import { AlertTriangle } from 'lucide-react';

export default function FormEditor() {
  const { schema, currentFile, editorMode, changes, upsertChange } = useEditorStore();

  if (!schema || !currentFile) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Select a page from the sidebar.
      </div>
    );
  }

  const fileSchema = schema.files.find((f) => f.path === currentFile);
  if (!fileSchema) return null;

  // Get the current (possibly changed) value for a field
  function getCurrentValue(type: 'frontmatter' | 'body', fieldName?: string): string {
    const existing = changes.find(
      (c) => c.file === currentFile && c.type === type && c.field === fieldName
    );
    if (existing) return existing.value;
    if (type === 'body') return fileSchema?.body ?? '';
    const field = fileSchema?.frontmatter.find((f) => f.name === fieldName);
    return field ? String(field.value ?? '') : '';
  }

  if (editorMode === 'code') {
    return <CodeEditor />;
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Page title */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">{fileSchema.title}</h2>
        <p className="text-xs text-gray-400 mt-0.5 font-mono">{fileSchema.path}</p>
      </div>

      {/* Frontmatter fields */}
      <div className="space-y-5">
        {fileSchema.frontmatter.map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {field.label}
            </label>
            <FieldRenderer
              field={field}
              value={getCurrentValue('frontmatter', field.name)}
              onChange={(value) =>
                upsertChange(
                  'frontmatter',
                  currentFile,
                  value,
                  field.name,
                  String(field.value ?? '')
                )
              }
            />
          </div>
        ))}
      </div>

      {/* Body editor */}
      {fileSchema.hasBody && (
        <div className="mt-8 pt-6 border-t border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Page Content
          </label>
          <div className="tiptap-editor border border-gray-200 rounded-lg p-4 min-h-[200px] text-sm">
            <RichBodyEditor
              value={getCurrentValue('body')}
              onChange={(value) =>
                upsertChange('body', currentFile, value, undefined, fileSchema.body)
              }
            />
          </div>
        </div>
      )}

      {/* Unsaved changes notice */}
      {changes.some((c) => c.file === currentFile) && (
        <div className="mt-6 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          You have unsaved changes. Hit Publish in the toolbar to go live.
        </div>
      )}
    </div>
  );
}

// ── Rich body editor (TipTap) ────────────────────────────────────────────────

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Bold, Italic, Heading2, List, ListOrdered, Link as LinkIcon } from 'lucide-react';

function RichBodyEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Link.configure({ openOnClick: false }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getText() ? editor.getHTML() : ''),
  });

  if (!editor) return null;

  return (
    <div>
      {/* Mini toolbar */}
      <div className="flex items-center gap-0.5 mb-3 pb-3 border-b border-gray-100">
        {[
          { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), title: 'Bold' },
          { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), title: 'Italic' },
          { icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }), title: 'Heading' },
          { icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList'), title: 'Bullet list' },
          { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList'), title: 'Numbered list' },
        ].map(({ icon: Icon, action, active, title }) => (
          <button
            key={title}
            type="button"
            title={title}
            onMouseDown={(e) => { e.preventDefault(); action(); }}
            className={`p-1.5 rounded text-sm transition-colors ${
              active ? 'bg-brand-100 text-brand-700' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}
        <button
          type="button"
          title="Link"
          onMouseDown={(e) => {
            e.preventDefault();
            const url = window.prompt('URL:');
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          className={`p-1.5 rounded text-sm transition-colors ${
            editor.isActive('link') ? 'bg-brand-100 text-brand-700' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <LinkIcon className="w-3.5 h-3.5" />
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
