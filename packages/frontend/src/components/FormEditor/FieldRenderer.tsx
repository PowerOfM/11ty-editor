/**
 * FieldRenderer — Renders a single form field based on its FieldSchema type.
 */
import { useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Image as ImageIcon, Upload } from 'lucide-react';
import type { FieldSchema } from '../../types';
import MediaManager from '../MediaManager';

interface Props {
  field: FieldSchema;
  value: string;
  onChange: (value: string) => void;
}

const INPUT_CLASS =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent';

export default function FieldRenderer({ field, value, onChange }: Props) {
  switch (field.type) {
    case 'text':
      return <TextInput value={value} onChange={onChange} hint={field.hint} />;
    case 'textarea':
      return <TextareaInput value={value} onChange={onChange} hint={field.hint} />;
    case 'richtext':
      return <RichTextInput value={value} onChange={onChange} hint={field.hint} />;
    case 'image':
      return <ImageInput value={value} onChange={onChange} hint={field.hint} />;
    case 'date':
      return <DateInput value={value} onChange={onChange} hint={field.hint} />;
    case 'boolean':
      return <BooleanInput value={value} onChange={onChange} hint={field.hint} />;
    case 'number':
      return <NumberInput value={value} onChange={onChange} hint={field.hint} />;
    case 'array':
      return <ArrayInput value={value} onChange={onChange} hint={field.hint} />;
    default:
      return <TextInput value={value} onChange={onChange} hint={field.hint} />;
  }
}

// ── Field components ────────────────────────────────────────────────────────

function Hint({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="mt-1 text-xs text-gray-400">{text}</p>;
}

function TextInput({ value, onChange, hint }: { value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={INPUT_CLASS} />
      <Hint text={hint} />
    </>
  );
}

function TextareaInput({ value, onChange, hint }: { value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className={`${INPUT_CLASS} resize-y`}
      />
      <Hint text={hint} />
    </>
  );
}

function RichTextInput({ value, onChange, hint }: { value: string; onChange: (v: string) => void; hint?: string }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Link.configure({ openOnClick: false }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getText() ? editor.getHTML() : '');
    },
  });

  return (
    <>
      <div className="tiptap-editor border border-gray-200 rounded-lg p-3 min-h-[140px] text-sm">
        <EditorContent editor={editor} />
      </div>
      <Hint text={hint} />
    </>
  );
}

function ImageInput({ value, onChange, hint }: { value: string; onChange: (v: string) => void; hint?: string }) {
  const [showMedia, setShowMedia] = useState(false);

  return (
    <>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="/images/photo.jpg or https://…"
          className={`${INPUT_CLASS} flex-1`}
        />
        <button
          type="button"
          onClick={() => setShowMedia(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
        >
          <Upload className="w-3.5 h-3.5" />
          Browse
        </button>
      </div>
      {value && (
        <div className="mt-2 relative group w-32 h-20 rounded-lg overflow-hidden border border-gray-200">
          <img src={value} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-white" />
          </div>
        </div>
      )}
      <Hint text={hint} />
      {showMedia && (
        <MediaManager
          onSelect={(url) => { onChange(url); setShowMedia(false); }}
          onClose={() => setShowMedia(false)}
        />
      )}
    </>
  );
}

function DateInput({ value, onChange, hint }: { value: string; onChange: (v: string) => void; hint?: string }) {
  // Normalise to YYYY-MM-DD for the date input
  const normalised = value ? new Date(value).toISOString().split('T')[0] : '';
  return (
    <>
      <input
        type="date"
        value={normalised}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_CLASS}
      />
      <Hint text={hint} />
    </>
  );
}

function BooleanInput({ value, onChange, hint }: { value: string; onChange: (v: string) => void; hint?: string }) {
  const checked = value === 'true';
  return (
    <>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(String(e.target.checked))}
          className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500"
        />
        <span className="text-sm text-gray-700">{checked ? 'Yes' : 'No'}</span>
      </label>
      <Hint text={hint} />
    </>
  );
}

function NumberInput({ value, onChange, hint }: { value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_CLASS}
      />
      <Hint text={hint} />
    </>
  );
}

function ArrayInput({ value, onChange, hint }: { value: string; onChange: (v: string) => void; hint?: string }) {
  let items: string[] = [];
  try {
    items = JSON.parse(value);
    if (!Array.isArray(items)) items = [];
  } catch {
    items = typeof value === 'string' && value ? value.split(',').map((s) => s.trim()) : [];
  }

  const updateItems = useCallback(
    (newItems: string[]) => onChange(JSON.stringify(newItems)),
    [onChange]
  );

  return (
    <>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={item}
              onChange={(e) => {
                const updated = [...items];
                updated[i] = e.target.value;
                updateItems(updated);
              }}
              className={`${INPUT_CLASS} flex-1`}
            />
            <button
              type="button"
              onClick={() => updateItems(items.filter((_, idx) => idx !== i))}
              className="px-2 text-gray-400 hover:text-red-500 text-lg leading-none"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => updateItems([...items, ''])}
          className="text-xs text-brand-600 hover:underline"
        >
          + Add item
        </button>
      </div>
      <Hint text={hint} />
    </>
  );
}
