/**
 * MediaManager — Modal for uploading and selecting image assets.
 */
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useEditorStore } from '../../store/changeBuffer';
import { uploadFile } from '../../api/client';

interface Props {
  onSelect: (url: string) => void;
  onClose: () => void;
}

interface UploadedFile {
  name: string;
  url: string;
}

export default function MediaManager({ onSelect, onClose }: Props) {
  const { credentials, schema } = useEditorStore();
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const assetFolder = schema?.editorConfig.assetDirectory ?? 'uploads';

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!credentials) return;
      setUploading(true);
      setUploadError(null);

      for (const file of acceptedFiles) {
        try {
          const result = await uploadFile(file, assetFolder, credentials.token);
          setUploads((prev) => [...prev, { name: result.name, url: result.url }]);
        } catch (err: unknown) {
          setUploadError(err instanceof Error ? err.message : 'Upload failed');
        }
      }

      setUploading(false);
    },
    [credentials, assetFolder]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: true,
  });

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Media</h3>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Upload zone */}
        <div className="p-5">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <Loader2 className="w-8 h-8 text-brand-400 mx-auto animate-spin mb-2" />
            ) : (
              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            )}
            <p className="text-sm text-gray-500">
              {isDragActive ? 'Drop images here…' : 'Drag images here or click to upload'}
            </p>
            <p className="text-xs text-gray-400 mt-1">PNG, JPG, WebP, SVG up to 10 MB</p>
          </div>

          {uploadError && (
            <div className="mt-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {uploadError}
            </div>
          )}

          {/* Uploaded files list */}
          {uploads.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-gray-500">Uploaded this session</p>
              {uploads.map((file) => (
                <button
                  key={file.url}
                  onClick={() => onSelect(file.url)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg border border-gray-100 hover:border-brand-300 hover:bg-brand-50 transition-colors text-left group"
                >
                  <img
                    src={file.url}
                    alt={file.name}
                    className="w-10 h-10 rounded object-cover flex-shrink-0 bg-gray-100"
                  />
                  <span className="flex-1 text-xs text-gray-700 truncate">{file.name}</span>
                  <CheckCircle2 className="w-4 h-4 text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
