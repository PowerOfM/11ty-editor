/**
 * FileTree — Left sidebar listing all editable markdown files.
 */
import { FileText, ChevronRight } from 'lucide-react';
import { useEditorStore } from '../../store/changeBuffer';

export default function FileTree() {
  const { schema, currentFile, setCurrentFile, changes } = useEditorStore();

  if (!schema) return null;

  // Group files by their directory
  const groups = new Map<string, typeof schema.files>();
  for (const file of schema.files) {
    const dir = file.path.includes('/') ? file.path.split('/').slice(0, -1).join('/') : '.';
    const list = groups.get(dir) ?? [];
    list.push(file);
    groups.set(dir, list);
  }

  function hasChanges(filePath: string) {
    return changes.some((c) => c.file === filePath);
  }

  return (
    <nav className="p-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 py-1.5">
        Pages
      </p>
      {[...groups.entries()].map(([dir, files]) => (
        <div key={dir} className="mb-2">
          {dir !== '.' && (
            <div className="flex items-center gap-1 px-2 py-1">
              <ChevronRight className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-400 font-medium">{dir}</span>
            </div>
          )}
          {files.map((file) => (
            <button
              key={file.path}
              onClick={() => setCurrentFile(file.path)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors ${
                currentFile === file.path
                  ? 'bg-brand-50 text-brand-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FileText className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
              <span className="truncate flex-1">{file.title}</span>
              {hasChanges(file.path) && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
