/**
 * PublishButton — Triggers the full build + deploy pipeline.
 * Shows stage-by-stage status and surfaces errors with plain-English explanations.
 */
import { useState } from 'react';
import { Rocket, Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { useEditorStore } from '../../store/changeBuffer';
import { publishSite } from '../../api/client';

type Stage = 'idle' | 'building' | 'pushing' | 'success' | 'error';

const STAGE_LABELS: Record<Stage, string> = {
  idle: 'Publish',
  building: 'Building…',
  pushing: 'Deploying…',
  success: 'Published!',
  error: 'Failed',
};

export default function PublishButton() {
  const { credentials, changes, clearChanges, schema } = useEditorStore();
  const [stage, setStage] = useState<Stage>('idle');
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const hasChanges = changes.length > 0;

  async function handlePublish() {
    if (!credentials || !hasChanges) return;
    setStage('building');
    setError(null);
    setDeployUrl(null);

    try {
      setStage('pushing');
      const result = await publishSite(
        credentials.repoUrl,
        changes,
        credentials.token,
        schema?.editorConfig.deployBranch
      );

      if (result.success) {
        setStage('success');
        setDeployUrl(result.deployUrl ?? null);
        clearChanges();
        // Reset to idle after a few seconds
        setTimeout(() => setStage('idle'), 6000);
      } else {
        setStage('error');
        setError(result.error ?? 'Publish failed');
      }
    } catch (err: unknown) {
      setStage('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  const isWorking = stage === 'building' || stage === 'pushing';

  return (
    <div className="relative">
      <button
        onClick={handlePublish}
        disabled={isWorking || !hasChanges || stage === 'success'}
        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed ${
          stage === 'success'
            ? 'bg-green-500 text-white'
            : stage === 'error'
            ? 'bg-red-500 text-white hover:bg-red-600'
            : !hasChanges
            ? 'bg-gray-100 text-gray-400'
            : 'bg-brand-500 text-white hover:bg-brand-600'
        }`}
      >
        {isWorking ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : stage === 'success' ? (
          <CheckCircle2 className="w-3.5 h-3.5" />
        ) : stage === 'error' ? (
          <XCircle className="w-3.5 h-3.5" />
        ) : (
          <Rocket className="w-3.5 h-3.5" />
        )}
        {STAGE_LABELS[stage]}
      </button>

      {/* Success popover */}
      {stage === 'success' && deployUrl && (
        <div className="absolute right-0 top-10 z-50 w-64 bg-white border border-green-200 rounded-xl shadow-lg p-4">
          <p className="text-sm font-medium text-green-700 mb-2">Site published!</p>
          <a
            href={deployUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-brand-600 hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            {deployUrl}
          </a>
        </div>
      )}

      {/* Error popover */}
      {stage === 'error' && error && (
        <div className="absolute right-0 top-10 z-50 w-72 bg-white border border-red-200 rounded-xl shadow-lg p-4">
          <p className="text-sm font-medium text-red-700 mb-1">Publish failed</p>
          <p className="text-xs text-gray-600 mb-3">{error}</p>
          <div className="flex gap-2">
            <button
              onClick={handlePublish}
              className="flex-1 text-xs bg-red-500 text-white rounded-lg py-1.5 hover:bg-red-600"
            >
              Retry
            </button>
            <button
              onClick={() => { setStage('idle'); setError(null); }}
              className="flex-1 text-xs border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50 text-gray-600"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
