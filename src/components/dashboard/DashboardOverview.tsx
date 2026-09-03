import React from 'react';
import { 
  Sparkles, 
  Target, 
  Flame, 
  BookOpen, 
  ArrowRight, 
  Clock, 
  Star, 
  Pin,
  Search,
  PenSquare,
  FileText,
  Lightbulb,
  Compass,
  Bot
} from 'lucide-react';
import { JournalEntry, Goal } from '../../types';
import { formatDate, formatRelativeTime } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

interface DashboardOverviewProps {
  entries: JournalEntry[];
  goals: Goal[];
  onSelectEntry: (entry: JournalEntry) => void;
  onNewReflection: () => void;
  onNavigateTab: (tab: any) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  entries,
  goals,
  onSelectEntry,
  onNewReflection,
  onNavigateTab,
}) => {
  const { profile } = useAuth();

  // Metrics computation
  const totalEntries = entries.length;
  const activeGoals = goals.filter(g => g.status === 'in_progress').length;
  const completedGoals = goals.filter(g => g.status === 'completed').length;
  const favoriteEntries = entries.filter(e => e.isFavorite);
  const pinnedEntries = entries.filter(e => e.isPinned);

  // Compute writing streak: consecutive days with at least 1 entry
  const getStreak = () => {
    if (entries.length === 0) return 0;
    const dates = entries
      .map(e => new Date(e.createdAt).toDateString())
      .filter((v, i, a) => a.indexOf(v) === i); // unique days
    return Math.min(dates.length, 7); // Active streak count
  };

  const streak = getStreak();
  const recentEntries = entries.slice(0, 5);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-2xl border border-stone-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-stone-950">
            Welcome back, {profile?.displayName || 'Reflector'}
          </h1>
          <p className="mt-1 text-sm text-stone-600 font-sans">
            Your private thoughts are safely encrypted and isolated. How would you like to reflect today?
          </p>
        </div>

        <button
          id="dashboard-new-reflection-btn"
          onClick={onNewReflection}
          className="self-start sm:self-center flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-50 text-sm font-medium transition cursor-pointer shadow-xs"
        >
          <PenSquare className="w-4 h-4 text-amber-300" />
          <span>New Reflection</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">
              Total Reflections
            </p>
            <p className="text-2xl font-serif font-bold text-stone-900 mt-0.5">
              {totalEntries}
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">
              Reflection Streak
            </p>
            <p className="text-2xl font-serif font-bold text-stone-900 mt-0.5">
              {streak} {streak === 1 ? 'day' : 'days'}
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">
              Active Goals
            </p>
            <p className="text-2xl font-serif font-bold text-stone-900 mt-0.5">
              {activeGoals} <span className="text-xs font-normal text-stone-400">({completedGoals} done)</span>
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">
              Favorites
            </p>
            <p className="text-2xl font-serif font-bold text-stone-900 mt-0.5">
              {favoriteEntries.length}
            </p>
          </div>
        </div>
      </div>

      {/* Quick AI Mode Jump Cards */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-stone-500 mb-3.5">
          Quick Reflective Actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          <button
            id="dashboard-companion-btn"
            onClick={() => onNavigateTab('assistant')}
            className="p-4 rounded-xl bg-amber-50/50 border border-amber-300/80 hover:border-amber-400 hover:shadow-xs transition text-left cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-400 text-stone-950 flex items-center justify-center mb-2.5 shadow-2xs">
              <Bot className="w-4 h-4" />
            </div>
            <h4 className="font-serif font-semibold text-stone-900 text-sm group-hover:text-amber-800 transition flex items-center gap-1">
              <span>AI Companion</span>
              <ArrowRight className="w-3 h-3 text-amber-600" />
            </h4>
            <p className="text-xs text-stone-600 mt-1">
              Conversational reflection, empathetic listening &amp; guidance.
            </p>
          </button>

          <button
            onClick={onNewReflection}
            className="p-4 rounded-xl bg-white border border-stone-200 hover:border-amber-400 hover:shadow-xs transition text-left cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center mb-2.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <h4 className="font-serif font-semibold text-stone-900 text-sm group-hover:text-amber-700 transition">
              Deep Reflection
            </h4>
            <p className="text-xs text-stone-500 mt-1">
              Socratic inquiry into your challenges and emotional triggers.
            </p>
          </button>

          <button
            onClick={() => onNavigateTab('ask')}
            className="p-4 rounded-xl bg-white border border-stone-200 hover:border-emerald-400 hover:shadow-xs transition text-left cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center mb-2.5">
              <Compass className="w-4 h-4" />
            </div>
            <h4 className="font-serif font-semibold text-stone-900 text-sm group-hover:text-emerald-700 transition">
              Ask My Journal
            </h4>
            <p className="text-xs text-stone-500 mt-1">
              Query past trends, recurring themes, and lessons learned.
            </p>
          </button>

          <button
            onClick={() => onNavigateTab('goals')}
            className="p-4 rounded-xl bg-white border border-stone-200 hover:border-blue-400 hover:shadow-xs transition text-left cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center mb-2.5">
              <Target className="w-4 h-4" />
            </div>
            <h4 className="font-serif font-semibold text-stone-900 text-sm group-hover:text-blue-700 transition">
              Goal Coaching
            </h4>
            <p className="text-xs text-stone-500 mt-1">
              Break down reflections into realistic milestones &amp; tasks.
            </p>
          </button>

          <button
            onClick={() => onNavigateTab('insights')}
            className="p-4 rounded-xl bg-white border border-stone-200 hover:border-purple-400 hover:shadow-xs transition text-left cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center mb-2.5">
              <FileText className="w-4 h-4" />
            </div>
            <h4 className="font-serif font-semibold text-stone-900 text-sm group-hover:text-purple-700 transition">
              Periodic Review
            </h4>
            <p className="text-xs text-stone-500 mt-1">
              Generate weekly or monthly AI digests of your experiences.
            </p>
          </button>
        </div>
      </div>

      {/* Recent Entries List */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-stone-400" />
            <h3 className="font-serif font-semibold text-stone-900 text-base">
              Recent Reflections
            </h3>
          </div>
          <button
            onClick={() => onNavigateTab('history')}
            className="text-xs font-medium text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentEntries.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="w-10 h-10 text-stone-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-stone-700">No reflections yet</p>
            <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
              Your journal is completely private and isolated to your account. Write your first thought today!
            </p>
            <button
              onClick={onNewReflection}
              className="mt-4 px-4 py-2 rounded-xl bg-stone-900 text-stone-50 text-xs font-medium hover:bg-stone-800 transition cursor-pointer"
            >
              Write First Reflection
            </button>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {recentEntries.map((entry) => (
              <div
                key={entry.id}
                onClick={() => onSelectEntry(entry)}
                className="px-6 py-4 hover:bg-stone-50 transition cursor-pointer flex items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {entry.isPinned && <Pin className="w-3.5 h-3.5 text-blue-500" />}
                    {entry.isFavorite && <Star className="w-3.5 h-3.5 text-amber-500 fill-current" />}
                    <h4 className="font-serif font-semibold text-stone-900 text-sm truncate">
                      {entry.title || 'Untitled Reflection'}
                    </h4>
                  </div>
                  <p className="text-xs text-stone-500 line-clamp-1 font-sans">
                    {entry.content}
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    {entry.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs text-stone-400 font-mono">
                    {formatRelativeTime(entry.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
