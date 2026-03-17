/**
 * ConnectRepo — Landing screen where the user enters their GitHub repo URL
 * and a Personal Access Token (PAT) to connect the editor to their site.
 */
import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, KeyRound, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { useEditorStore } from '../../store/changeBuffer';
import { fetchSchema } from '../../api/client';

export default function ConnectRepo() {
  const [repoUrl, setRepoUrl] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { setCredentials, setSchema, setSchemaError } = useEditorStore();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const schema = await fetchSchema(repoUrl.trim(), token.trim());
      setCredentials({ repoUrl: repoUrl.trim(), token: token.trim() });
      setSchema(schema);
      navigate('/edit');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setError(msg);
      setSchemaError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-500 rounded-2xl mb-4 shadow-lg">
            <Globe className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">11ty Editor</h1>
          <p className="text-gray-500 mt-1 text-sm">Connect your website to start editing</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          <div>
            <label htmlFor="repo" className="block text-sm font-medium text-gray-700 mb-1.5">
              GitHub Repository URL
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="repo"
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/you/your-site"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-1.5">
              GitHub Personal Access Token
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_••••••••••••••••"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                required
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              Needs <code className="bg-gray-100 px-1 rounded">repo</code> scope.{' '}
              <a
                href="https://github.com/settings/tokens/new?scopes=repo"
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 hover:underline"
              >
                Create one here
              </a>
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting…
              </>
            ) : (
              <>
                Connect Site
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
          Your token is stored only in this browser session and never sent to any third party.
        </p>
      </div>
    </div>
  );
}
