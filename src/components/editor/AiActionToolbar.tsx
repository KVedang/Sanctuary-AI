import React, { useState } from 'react';
import { 
  Sparkles, 
  Loader2, 
  FileText, 
  ListChecks, 
  Lightbulb, 
  BarChart3,
  Copy,
  Check,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { AiMode } from '../../types';

interface AiActionToolbarProps {
  title: string;
  content: string;
  onApplySummary?: (summary: string) => void;
  onExtractGoals?: (goals: any[]) => void;
}

export const AiActionToolbar: React.FC<AiActionToolbarProps> = ({
  title,
  content,
  onApplySummary,
}) => {
  const { authenticatedFetch } = useApi();
  const [loadingMode, setLoadingMode] = useState<AiMode | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [activeResultMode, setActiveResultMode] = useState<AiMode | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actions: { id: AiMode; label: string; icon: any }[] = [
    { id: 'reflect', label: 'Reflect', icon: Sparkles },
    { id: 'summarize', label: 'Summarize', icon: FileText },
    { id: 'brainstorm', label: 'Brainstorm', icon: Lightbulb },
    { id: 'goal_coach', label: 'Extract Goals', icon: ListChecks },
    { id: 'analytical', label: 'Analyze', icon: BarChart3 },
  ];

  const handleRunAi = async (mode: AiMode) => {
    if (!content || !content.trim()) {
      setError('Please write some content first before asking the AI to reflect.');
      return;
    }
    setError(null);
    setLoadingMode(mode);
    setAiResult(null);
    setNotice(null);

    try {
      const data = await authenticatedFetch('/api/ai/process', {
        method: 'POST',
        body: JSON.stringify({ mode, content, title }),
      });

      if (data.result) {
        setAiResult(data.result);
        setActiveResultMode(mode);
        setModelUsed(data.modelUsed || null);
        if (data.notice) {
          setNotice(data.notice);
        }
        if (mode === 'summarize' && onApplySummary) {
          onApplySummary(data.result);
        }
      }
    } catch (err: any) {
      const raw = String(err?.message || err || '');
      const clean = raw.includes('prepayment credits') || raw.includes('429')
        ? 'Google AI Studio prepayment credits are depleted. Please visit https://ai.studio/projects to manage billing.'
        : raw.replace(/All Gemini models in fallback ladder failed:\s*/i, '').trim();
      setError(clean || 'Failed to process AI request.');
    } finally {
      setLoadingMode(null);
    }
  };

  const copyToClipboard = () => {
    if (!aiResult) return;
    navigator.clipboard.writeText(aiResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-stone-100/80 rounded-xl border border-stone-200/80">
        <span className="text-xs font-semibold uppercase tracking-wider text-stone-600 px-2 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          AI Actions
        </span>

        {actions.map((act) => {
          const Icon = act.icon;
          const isLoading = loadingMode === act.id;
          return (
            <button
              key={act.id}
              id={`ai-btn-${act.id}`}
              onClick={() => handleRunAi(act.id)}
              disabled={loadingMode !== null}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer disabled:opacity-50 ${
                activeResultMode === act.id && aiResult
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-white text-stone-700 hover:bg-stone-50 border border-stone-200/80 shadow-2xs'
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
              ) : (
                <Icon className="w-3.5 h-3.5 text-stone-500" />
              )}
              <span>{act.label}</span>
            </button>
          );
        })}
      </div>

      {/* Notice Banner */}
      {notice && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <a
            href="https://ai.studio/projects"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-amber-950 underline shrink-0"
          >
            AI Studio <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {error && (
        <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* AI Result Card */}
      {aiResult && (
        <div className="p-5 rounded-2xl bg-amber-50/50 border border-amber-200/70 shadow-xs relative">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-amber-200/50">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-900">
                AI Reflection &bull; {activeResultMode}
              </span>
              {modelUsed && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  modelUsed.includes('Local') || modelUsed.includes('Standby')
                    ? 'bg-amber-200/80 text-amber-900 font-semibold'
                    : 'bg-stone-200 text-stone-700'
                }`}>
                  {modelUsed}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 transition cursor-pointer px-2 py-1 rounded hover:bg-amber-100/60"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="prose prose-stone prose-sm max-w-none text-stone-800 leading-relaxed whitespace-pre-wrap font-sans text-sm">
            {aiResult}
          </div>
        </div>
      )}
    </div>
  );
};
