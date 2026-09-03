import React, { useState } from 'react';
import { 
  Sparkles, 
  Calendar, 
  TrendingUp, 
  Loader2, 
  FileText, 
  Award,
  AlertTriangle,
  Lightbulb,
  ShieldCheck
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
  const [error, setError] = useState<string | null>(null);

  // Frequency analysis
  const moodCounts: Record<string, number> = {};
  entries.forEach((e) => {
    if (e.mood) {
      moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
    }
  });

  const tagCounts: Record<string, number> = {};
  entries.forEach((e) => {
    e.tags.forEach((t) => {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    });
  });

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 6);

  const handleGenerateDigest = async () => {
    if (entries.length === 0) {
      setError('You need at least 1 journal entry to generate an AI reflection digest.');
      return;
    }

    setLoading(true);
    setError(null);
    setDigest(null);

    const safeEntries = entries.slice(0, 15).map((e) => ({
      title: e.title,
      content: e.content,
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
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to generate periodic review.');
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
            <Calendar className="w-4 h-4 text-emerald-500" />
            <h3 className="font-serif font-semibold text-stone-900 text-sm">
              Mood Landscape
            </h3>
          </div>
          {Object.keys(moodCounts).length === 0 ? (
            <p className="text-xs text-stone-400">No mood data recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(moodCounts).map(([m, count]) => (
                <div key={m} className="flex items-center justify-between text-xs capitalize">
                  <span className="text-stone-700 font-medium">{m}</span>
                  <span className="text-stone-400 font-mono">{count} times</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Data Isolation Notice */}
        <div className="p-5 rounded-2xl bg-amber-50/60 border border-amber-200/70 shadow-xs space-y-2.5">
          <div className="flex items-center gap-2 text-amber-900">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <h3 className="font-serif font-semibold text-sm">
              AI Insight Transparency
            </h3>
          </div>
          <p className="text-xs text-amber-800/90 leading-relaxed">
            All observations are derived strictly from your authenticated account’s data. AI insights are supportive coaching perspectives, never medical diagnoses.
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
              Let Gemini analyze your experiences across a chosen timeframe to highlight wins, lessons, and upcoming priorities.
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

        {error && (
          <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
            {error}
          </div>
        )}

        {digest && (
          <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200/90 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>AI {periodType} Reflection Digest</span>
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
