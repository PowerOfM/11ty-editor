/**
 * changeBuffer.ts — Zustand store for the editor's global state.
 *
 * All pending edits are accumulated in `changes` before the user publishes.
 * Drafts are also persisted to sessionStorage so a refresh doesn't lose work.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Change,
  ChangeType,
  SiteSchema,
  SiteCredentials,
  PublishResponse,
} from '../types';

let _idCounter = 0;
function nextId(): string {
  return `change-${++_idCounter}-${Date.now()}`;
}

export type PublishStatus = 'idle' | 'building' | 'pushing' | 'success' | 'error';

export interface EditorMode {
  mode: 'form' | 'visual' | 'code';
}

interface EditorState {
  // ── Connection ────────────────────────────────────────────────────────────
  credentials: SiteCredentials | null;
  schema: SiteSchema | null;
  schemaLoading: boolean;
  schemaError: string | null;

  // ── Navigation ────────────────────────────────────────────────────────────
  currentFile: string | null;
  editorMode: EditorMode['mode'];

  // ── Change buffer ─────────────────────────────────────────────────────────
  changes: Change[];

  // ── Preview ───────────────────────────────────────────────────────────────
  previewHtml: string | null;
  previewStale: boolean;

  // ── Publish ───────────────────────────────────────────────────────────────
  publishStatus: PublishStatus;
  publishResult: PublishResponse | null;

  // ── Actions ───────────────────────────────────────────────────────────────
  setCredentials: (creds: SiteCredentials) => void;
  setSchema: (schema: SiteSchema) => void;
  setSchemaLoading: (v: boolean) => void;
  setSchemaError: (e: string | null) => void;
  setCurrentFile: (path: string) => void;
  setEditorMode: (mode: EditorMode['mode']) => void;

  /** Upsert a change (replaces existing change for the same file+field). */
  upsertChange: (
    type: ChangeType,
    file: string,
    value: string,
    field?: string,
    originalValue?: string
  ) => void;
  removeChange: (id: string) => void;
  clearChanges: () => void;
  revertChange: (id: string) => void;

  setPreview: (html: string, stale?: boolean) => void;
  setPublishStatus: (status: PublishStatus) => void;
  setPublishResult: (result: PublishResponse) => void;
  disconnect: () => void;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      credentials: null,
      schema: null,
      schemaLoading: false,
      schemaError: null,
      currentFile: null,
      editorMode: 'form',
      changes: [],
      previewHtml: null,
      previewStale: false,
      publishStatus: 'idle',
      publishResult: null,

      setCredentials: (credentials) => set({ credentials }),

      setSchema: (schema) =>
        set({
          schema,
          schemaError: null,
          currentFile: schema.files[0]?.path ?? null,
        }),

      setSchemaLoading: (v) => set({ schemaLoading: v }),
      setSchemaError: (e) => set({ schemaError: e, schemaLoading: false }),

      setCurrentFile: (path) => set({ currentFile: path, previewHtml: null }),

      setEditorMode: (mode) => set({ editorMode: mode }),

      upsertChange: (type, file, value, field, originalValue) => {
        const existing = get().changes;
        const idx = existing.findIndex(
          (c) => c.file === file && c.type === type && c.field === field
        );
        if (idx >= 0) {
          const updated = [...existing];
          updated[idx] = { ...updated[idx], value };
          set({ changes: updated });
        } else {
          set({
            changes: [
              ...existing,
              { id: nextId(), type, file, value, field, originalValue },
            ],
          });
        }
      },

      removeChange: (id) =>
        set({ changes: get().changes.filter((c) => c.id !== id) }),

      clearChanges: () => set({ changes: [] }),

      revertChange: (id) => {
        const change = get().changes.find((c) => c.id === id);
        if (!change) return;
        if (change.originalValue !== undefined) {
          const updated = get().changes.map((c) =>
            c.id === id ? { ...c, value: change.originalValue! } : c
          );
          set({ changes: updated });
        } else {
          set({ changes: get().changes.filter((c) => c.id !== id) });
        }
      },

      setPreview: (html, stale = false) =>
        set({ previewHtml: html, previewStale: stale }),

      setPublishStatus: (status) => set({ publishStatus: status }),
      setPublishResult: (result) => set({ publishResult: result }),

      disconnect: () =>
        set({
          credentials: null,
          schema: null,
          currentFile: null,
          changes: [],
          previewHtml: null,
          publishStatus: 'idle',
          publishResult: null,
        }),
    }),
    {
      name: '11ty-editor-draft',
      storage: createJSONStorage(() => sessionStorage),
      // Only persist changes and credentials; schema is re-fetched on mount
      partialize: (state) => ({
        credentials: state.credentials,
        changes: state.changes,
        currentFile: state.currentFile,
      }),
    }
  )
);
