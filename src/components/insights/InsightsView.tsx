import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Loader2, 
  TrendingUp, 
  Smile, 
  Calendar, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { JournalEntry } from '../../types';
import { useApi } from '../../hooks/useApi';

interface InsightsViewProps {
  entries: JournalEntry[];
}

export const InsightsView: React.FC<InsightsViewProps> = ({ entries }) => {
  const { authenticatedFetch } = useApi();
  const [periodType, setPeriodType] = useState<'weekly' | 'monthly'>('weekly');
  const [loading, setLoading] = useState(false);
  const [digest, setDigest] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Derive stats locally to protect user data isolation
  const topTags = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    entries.forEach((e) => {
      (e.tags || []).forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [entries]);

  const moodBreakdown = useMemo(() => {
    const counts: Record<string, number> = {
      grounded: 0,
      grateful: 0,
      reflective: 0,
      energized: 0,
      anxious: 0,
      unspecified: 0,
    };
    entries.forEach((e) => {
      const m = e.mood || 'unspecified';
      counts[m] = (counts[m] || 0) + 1;
    });
    return counts;
  }, [entries]);

  const handleGenerateDigest = async () => {
    if (entries.length === 0) return;

    setLoading(true);
    setError(null);
    setDigest(null);
    setNotice(null);

    const safeEntries = entries.slice(0, 20).map((e) => ({
      title: e.title,
      content: e.content,
      mood: e.mood,
      tags: e.tags,
      createdAt: e.createdAt,
    }));

    try {
      const data = await authenticatedFetch('/api/ai/periodic-digest', {
        method: 'POST',
        body: JSON.stringify({
          periodType,
          entries: safeEntries,
        }),
      });

      if (data.digest) {
        setDigest(data.digest);
        setModelUsed(data.modelUsed || null);
        if (data.notice) {
          setNotice(data.notice);
        }
      }
    } catch (err: any) {
      const raw = String(err?.message || err || '');
      const clean = raw.includes('prepayment credits') || raw.includes('429')
        ? 'Google AI Studio prepayment credits are depleted. Please visit https://ai.studio/projects to manage billing.'
        : raw.replace(/All Gemini models in fallback ladder failed:\s*/i, '').trim();
      setError(clean || 'Failed to generate periodic review.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-semibold text-stone-950">
          Personal Reflection Insights
        </h1>
        <p className="text-xs text-stone-500 mt-1">
          Review emotional trends, recurring topics, and generate structured periodic digests.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Top Topics */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-500" />
            <h3 className="font-serif font-semibold text-stone-900 text-sm">
              Most Discussed Themes
            </h3>
          </div>
          {topTags.length === 0 ? (
            <p className="text-xs text-stone-400">No tags recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {topTags.map(([tag, count]) => (
                <div key={tag} className="flex items-center justify-between text-xs">
                  <span className="text-stone-700 font-medium">#{tag}</span>
                  <span className="text-stone-400 font-mono">{count} entries</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mood Breakdown */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Smile className="w-4 h-4 text-emerald-500" />
            <h3 className="font-serif font-semibold text-stone-900 text-sm">
              Emotional States
            </h3>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(moodBreakdown)
              .filter(([_, count]) => (count as number) > 0)
              .map(([mood, count]) => (
                <span
                  key={mood}
                  className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 font-medium capitalize"
                >
                  {mood}: <strong className="font-semibold text-stone-900">{count}</strong>
                </span>
              ))}
          </div>
        </div>

        {/* Total Depth */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-600" />
            <h3 className="font-serif font-semibold text-stone-900 text-sm">
              Reflection Archive
            </h3>
          </div>
          <div className="text-2xl font-serif font-bold text-stone-950">
            {entries.length} <span className="text-xs font-sans font-normal text-stone-500">entries saved</span>
          </div>
          <p className="text-[11px] text-stone-400">
            Encrypted in your private Firestore collection under strict user-bound authorization.
          </p>
        </div>
      </div>

      {/* Periodic Review Generator */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
          <div>
            <h3 className="font-serif font-semibold text-stone-900 text-lg">
              Periodic Reflection Digest
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Analyze your experiences across a chosen timeframe to highlight wins, lessons, and upcoming priorities.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as any)}
              className="px-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-stone-50 font-medium text-stone-700 focus:outline-none"
            >
              <option value="weekly">Weekly Review</option>
              <option value="monthly">Monthly Review</option>
            </select>

            <button
              id="generate-digest-btn"
              onClick={handleGenerateDigest}
              disabled={loading || entries.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 text-xs font-medium transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              )}
              <span>{loading ? 'Synthesizing...' : 'Generate Digest'}</span>
            </button>
          </div>
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
          <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {digest && (
          <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-600">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{periodType} Reflection Digest</span>
              </div>
              {modelUsed && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  modelUsed.includes('Local') || modelUsed.includes('Standby')
                    ? 'bg-amber-100 text-amber-800 border border-amber-200 font-medium'
                    : 'bg-stone-200 text-stone-600'
                }`}>
                  {modelUsed}
                </span>
              )}
            </div>

            <div className="prose prose-stone prose-sm max-w-none text-stone-800 leading-relaxed whitespace-pre-wrap font-sans">
              {digest}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
