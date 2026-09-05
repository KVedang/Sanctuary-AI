import React, { useState } from 'react';
import { 
  Search, 
  Sparkles, 
  Loader2, 
  Compass, 
  ShieldCheck, 
  AlertCircle,
  ExternalLink,
  BookOpen,
  Calendar,
  HelpCircle,
  Tag
} from 'lucide-react';
import { JournalEntry, AskJournalResponse } from '../../types';
import { useApi } from '../../hooks/useApi';

interface AskMyJournalProps {
  entries: JournalEntry[];
}

export const AskMyJournal: React.FC<AskMyJournalProps> = ({ entries }) => {
  const { authenticatedFetch } = useApi();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [structuredData, setStructuredData] = useState<AskJournalResponse | null>(null);
  const [citedEntries, setCitedEntries] = useState<Array<{ id?: string; title?: string; entryTitle?: string; date?: string; entryDate?: string; excerptSnippet?: string }>>([]);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sampleQuestions = [
    'What recurring themes or lessons came up recently?',
    'What key goals or accomplishments did I celebrate?',
    'What patterns or habits have I mentioned wanting to break?',
    'Summarize my main insights across all entries.',
  ];

  const cleanErrorMessage = (err: any): string => {
    const raw = String(err?.message || err || '');
    if (raw.includes('prepayment credits') || raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
      return 'Google AI Studio prepayment credits are depleted. Sanctuary AI will answer via local semantic search.';
    }
    return raw.replace(/All Gemini models in fallback ladder failed:\s*/i, '').trim() || 'Failed to query your journal.';
  };

  const handleAsk = async (queryText?: string) => {
    const activeQuery = queryText || question;
    if (!activeQuery.trim()) return;

    setLoading(true);
    setError(null);
    setAnswer(null);
    setStructuredData(null);
    setCitedEntries([]);
    setNotice(null);

    // Filter relevant excerpts strictly from current user's local entries
    // This guarantees user data isolation before sending context to backend
    const excerpts = entries.slice(0, 15).map((e) => ({
      id: e.id,
      title: e.title,
      content: e.content,
      tags: e.tags,
      createdAt: e.createdAt,
    }));

    try {
      const data = await authenticatedFetch('/api/ai/ask-journal', {
        method: 'POST',
        body: JSON.stringify({
          question: activeQuery,
          journalExcerpts: excerpts,
        }),
      });

      setModelUsed(data.modelUsed);
      if (data.notice) {
        setNotice(data.notice);
      }

      if (Array.isArray(data.citedEntries) && data.citedEntries.length > 0) {
        setCitedEntries(data.citedEntries);
      } else if (data.structuredData?.citations) {
        setCitedEntries(data.structuredData.citations);
      }

      if (data.structuredData) {
        setStructuredData(data.structuredData);
        setAnswer(data.structuredData.directAnswer || data.answer);
      } else if (data.answer) {
        setAnswer(data.answer);
      }
    } catch (err: any) {
      setError(cleanErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      {/* Feature Intro Banner */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-stone-200/80 shadow-xs space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Strict User-Bound Isolation</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-stone-950">
          Ask My Journal
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 font-sans leading-relaxed">
          Ask natural-language questions about your historical writing. Synthesizes themes, lessons, and patterns strictly from your private archives.
        </p>
      </div>

      {/* Query Bar */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="ask-journal-input"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What challenges did I mention regarding career choices?"
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            />
          </div>

          <button
            id="ask-journal-submit-btn"
            type="submit"
            disabled={loading || !question.trim()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-stone-900 text-stone-50 hover:bg-stone-800 rounded-xl text-xs font-medium transition cursor-pointer shadow-xs disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-300" />
            )}
            <span>{loading ? 'Synthesizing...' : 'Ask Journal'}</span>
          </button>
        </form>

        {/* Suggested Queries */}
        <div>
          <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wider mb-2">
            Suggested Prompts:
          </p>
          <div className="flex flex-wrap gap-2">
            {sampleQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuestion(q);
                  handleAsk(q);
                }}
                className="text-xs px-3 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition cursor-pointer text-left"
              >
                &ldquo;{q}&rdquo;
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Fallback Notice Banner */}
      {notice && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <a
            href="https://ai.studio/projects"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-amber-950 underline hover:text-amber-800 shrink-0"
          >
            Manage Billing in AI Studio <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Answer Output */}
      {(structuredData || answer) && (
        <div className="p-6 sm:p-8 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-emerald-600" />
              <h3 className="font-serif font-semibold text-stone-900 text-base">
                Synthesized Journal Memory
              </h3>
            </div>
            {modelUsed && (
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                modelUsed.includes('Local')
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-stone-100 text-stone-500'
              }`}>
                {modelUsed}
              </span>
            )}
          </div>

          {/* Main Answer text */}
          <div className="prose prose-stone prose-sm max-w-none text-stone-800 leading-relaxed font-sans whitespace-pre-wrap">
            {structuredData?.directAnswer || answer}
          </div>

          {/* Citations & Historical References */}
          {((citedEntries && citedEntries.length > 0) || (structuredData?.citations && structuredData.citations.length > 0)) && (
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/70 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 uppercase tracking-wide">
                <Calendar className="w-3.5 h-3.5 text-stone-500" />
                <span>Referenced Reflections ({citedEntries.length || structuredData?.citations?.length || 0})</span>
              </div>
              <div className="space-y-2">
                {(citedEntries.length > 0 ? citedEntries : (structuredData?.citations || [])).map((c: any, idx: number) => (
                  <div key={idx} className="text-xs text-stone-700 bg-white p-3 rounded-lg border border-stone-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-stone-900">{c.title || c.entryTitle || 'Reflection Entry'}</span>
                      <span className="text-[11px] text-stone-400 font-mono">{c.date || c.entryDate || ''}</span>
                    </div>
                    {c.excerptSnippet && (
                      <p className="text-[11px] text-stone-500 italic line-clamp-2">
                        &ldquo;{c.excerptSnippet}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Relevant Themes */}
          {structuredData && structuredData.relevantThemes && structuredData.relevantThemes.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block">
                Related Themes:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {structuredData.relevantThemes.map((theme, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-amber-50 text-amber-900 border border-amber-200 font-medium">
                    <Tag className="w-3 h-3 text-amber-600" />
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Follow-Up Inquiries */}
          {structuredData && structuredData.followUpQuestions && structuredData.followUpQuestions.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/60 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 uppercase tracking-wide">
                <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Deepening Questions to Consider</span>
              </div>
              <div className="space-y-1.5">
                {structuredData.followUpQuestions.map((fq, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setQuestion(fq);
                      handleAsk(fq);
                    }}
                    className="w-full text-left text-xs text-stone-700 hover:text-amber-950 p-2 rounded-lg bg-white hover:bg-amber-100/50 border border-stone-200 transition cursor-pointer"
                  >
                    &ldquo;{fq}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!answer && !structuredData && !loading && entries.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-stone-200/80 p-8 space-y-3">
          <BookOpen className="w-8 h-8 text-stone-400 mx-auto" />
          <h4 className="font-serif text-stone-800 text-base font-medium">Your journal archive is empty</h4>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            Create your first journal reflection using the &ldquo;New Reflection&rdquo; button, and Sanctuary AI will begin building your searchable memory timeline.
          </p>
        </div>
      )}
    </div>
  );
};
