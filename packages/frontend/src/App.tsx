import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEditorStore } from './store/changeBuffer';
import { fetchSchema } from './api/client';
import ConnectRepo from './components/ConnectRepo';
import EditorLayout from './components/Layout';

export default function App() {
  const { credentials, setSchema, setSchemaLoading, setSchemaError } = useEditorStore();

  // Re-fetch schema whenever credentials change (e.g. after page refresh)
  useEffect(() => {
    if (!credentials) return;
    setSchemaLoading(true);
    fetchSchema(credentials.repoUrl, credentials.token)
      .then(setSchema)
      .catch((e: Error) => setSchemaError(e.message))
      .finally(() => setSchemaLoading(false));
  }, [credentials, setSchema, setSchemaLoading, setSchemaError]);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={credentials ? <Navigate to="/edit" replace /> : <ConnectRepo />}
        />
        <Route
          path="/edit/*"
          element={credentials ? <EditorLayout /> : <Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
