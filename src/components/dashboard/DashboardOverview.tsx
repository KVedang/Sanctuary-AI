import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Target, 
  Flame, 
  BookOpen, 
  ArrowRight, 
  Clock, 
  Star, 
  Pin,
  PenSquare,
  FileText,
  Lightbulb,
  Compass,
  Bot,
  Check,
  Edit3,
  X,
  Loader2,
  ListChecks,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus
} from 'lucide-react';
import { JournalEntry, Goal, GoalTask } from '../../types';
import { formatRelativeTime, sanitizePayload } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { db } from '../../lib/firebase';
import { doc, setDoc, collection } from 'firebase/firestore';
import { AISuggestedGoal, SuggestedGoalData } from '../goals/AISuggestedGoal';

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
  const { profile, user } = useAuth();
  const { authenticatedFetch } = useApi();

  // Metrics computation
  const totalEntries = entries.length;
  const activeGoalsList = goals.filter(g => g.status === 'in_progress');
  const activeGoals = activeGoalsList.length;
  const completedGoals = goals.filter(g => g.status === 'completed').length;
  const favoriteEntries = entries.filter(e => e.isFavorite);

  // Compute writing streak: consecutive unique days
  const getStreak = () => {
    if (entries.length === 0) return 0;
    const dates = entries
      .map(e => new Date(e.createdAt).toDateString())
      .filter((v, i, a) => a.indexOf(v) === i); // unique days
    return Math.min(dates.length, 7); // Active streak count
  };

  const streak = getStreak();
  const recentEntries = entries.slice(0, 5);

  // ==========================================
  // AI INSIGHT STATE
  // ==========================================
  const [insightText, setInsightText] = useState<string | null>(null);
  const [insightTheme, setInsightTheme] = useState<string | null>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);

  // Auto-generate or derive insight if reflections exist
  const handleGenerateInsight = async () => {
    if (entries.length === 0) return;
    setIsLoadingInsight(true);
    setInsightError(null);

    try {
      const recentSample = entries
        .slice(0, 3)
        .map(e => `Title: ${e.title}\nDate: ${e.createdAt.substring(0, 10)}\n${e.content}`)
        .join('\n\n---\n\n');

      const data = await authenticatedFetch('/api/ai/process', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'analytical',
          content: recentSample,
          title: 'Recent Reflections Analysis',
        }),
      });

      if (data.result) {
        setInsightText(data.result);
        const topTag = entries[0]?.tags?.[0];
        setInsightTheme(topTag ? `Focus on #${topTag}` : 'Recent Reflections');
      } else {
        setInsightError('Insight could not be formulated at this moment.');
      }
    } catch (err: any) {
      console.warn('Error generating dashboard insight:', err);
      setInsightError('Standby mode active. Click to refresh insight.');
    } finally {
      setIsLoadingInsight(false);
    }
  };

  // Trigger insight generation once when reflections exist and no insight is set
  useEffect(() => {
    if (entries.length > 0 && !insightText && !isLoadingInsight && !insightError) {
      handleGenerateInsight();
    }
  }, [entries.length]);

  // ==========================================
  // AI SUGGESTED GOAL STATE
  // ==========================================
  interface SuggestedGoalCardState {
    title: string;
    description?: string;
    reason?: string;
    priority?: 'low' | 'medium' | 'high';
    howToAchieve?: string[];
    tasks: { title: string; description: string; priority: 'low' | 'medium' | 'high' }[];
    sourceReflectionId?: string;
  }

  const [suggestedGoal, setSuggestedGoal] = useState<SuggestedGoalCardState | null>(null);
  const [isGeneratingGoal, setIsGeneratingGoal] = useState(false);
  const [goalFeedback, setGoalFeedback] = useState<string | null>(null);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);

  const handleGenerateSuggestedGoal = async () => {
    const latestEntry = entries[0];
    if (!latestEntry || !latestEntry.content?.trim()) {
      setGoalError('Write a reflection first to generate a suggested goal.');
      return;
    }

    setIsGeneratingGoal(true);
    setGoalError(null);
    setGoalFeedback(null);

    try {
      const data = await authenticatedFetch('/api/ai/process', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'goal_generate',
          content: latestEntry.content,
          title: latestEntry.title,
        }),
      });

      if (data.data?.goal) {
        const g = data.data.goal;
        const tasks = (data.data.tasks || []).map((t: any) => 
          typeof t === 'string'
            ? { title: t, description: 'Actionable micro-step to advance this milestone.', priority: g.priority || 'medium' }
            : { 
                title: t.title || 'Micro-step', 
                description: t.description || 'Actionable micro-step to advance this milestone.', 
                priority: t.priority || g.priority || 'medium' 
              }
        );
        const newSug: SuggestedGoalCardState = {
          title: g.title,
          description: g.description,
          reason: g.reason,
          priority: g.priority || 'medium',
          howToAchieve: g.howToAchieve || [],
          tasks,
          sourceReflectionId: latestEntry.id,
        };
        setSuggestedGoal(newSug);
      } else if (data.data && data.data.goal === null) {
        setGoalError(data.data.reason || 'The reflection does not contain enough actionable information for a meaningful goal.');
      } else if (data.goalSuggestion?.hasGoal) {
        const gs = data.goalSuggestion;
        const tasks = (gs.tasks || []).map((t: any) => 
          typeof t === 'string'
            ? { title: t, description: 'Actionable micro-step.', priority: gs.priority || 'medium' }
            : { title: t.title || 'Micro-step', description: t.description || 'Actionable micro-step.', priority: t.priority || gs.priority || 'medium' }
        );
        const newSug: SuggestedGoalCardState = {
          title: gs.title || 'Personal Milestone',
          description: gs.description,
          reason: gs.reason,
          priority: gs.priority || 'medium',
          howToAchieve: gs.howToAchieve || [],
          tasks,
          sourceReflectionId: latestEntry.id,
        };
        setSuggestedGoal(newSug);
      } else {
        setGoalError('No clear goal pattern detected in the latest reflection.');
      }
    } catch (err: any) {
      console.warn('Failed to generate suggested goal on dashboard:', err);
      setGoalError('Goal generation temporarily unavailable. You can create goals manually.');
    } finally {
      setIsGeneratingGoal(false);
    }
  };

  const [isRegeneratingTasks, setIsRegeneratingTasks] = useState(false);

  const handleRegenerateTasks = async () => {
    if (!suggestedGoal || isRegeneratingTasks) return;
    setIsRegeneratingTasks(true);
    try {
      const sourceEntry = entries.find(e => e.id === suggestedGoal.sourceReflectionId) || entries[0];
      const res = await authenticatedFetch('/api/ai/regenerate-tasks', {
        method: 'POST',
        body: JSON.stringify({
          goalTitle: suggestedGoal.title,
          goalDescription: suggestedGoal.description || suggestedGoal.reason,
          reflectionContext: sourceEntry?.content || '',
        }),
      });

      if (res.tasks && Array.isArray(res.tasks)) {
        setSuggestedGoal({
          ...suggestedGoal,
          tasks: res.tasks,
          howToAchieve: res.howToAchieve || suggestedGoal.howToAchieve,
        });
      }
    } catch (err: any) {
      console.error('Error regenerating tasks on dashboard:', err);
    } finally {
      setIsRegeneratingTasks(false);
    }
  };

  const handleAcceptGoal = async (customized?: SuggestedGoalData) => {
    if (!user || (!suggestedGoal && !customized) || savingGoal) return;
    setSavingGoal(true);
    setGoalError(null);

    const goalToSave = customized || suggestedGoal;
    if (!goalToSave || !goalToSave.title) return;

    try {
      const goalRef = doc(collection(db, 'users', user.uid, 'goals'));
      const tasksFormatted: GoalTask[] = (goalToSave.tasks || []).map((t, idx) => {
        const title = typeof t === 'string' ? t : t.title;
        const description = typeof t === 'string' ? '' : (t.description || '');
        const priority = typeof t === 'string' ? (goalToSave.priority || 'medium') : (t.priority || goalToSave.priority || 'medium');
        return {
          id: `task_${Date.now()}_${idx}`,
          title,
          description,
          priority,
          completed: false,
        };
      });

      const newGoalData = {
        id: goalRef.id,
        userId: user.uid,
        title: goalToSave.title,
        description: goalToSave.description || goalToSave.reason || '',
        reason: goalToSave.reason || '',
        priority: goalToSave.priority || 'medium',
        status: 'in_progress',
        progress: 0,
        howToAchieve: goalToSave.howToAchieve || [],
        tasks: tasksFormatted,
        extractedFromJournalId: goalToSave.sourceReflectionId || suggestedGoal?.sourceReflectionId || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(goalRef, sanitizePayload(newGoalData));
      setGoalFeedback('Goal, plan, and actionable tasks saved to your Goals tab! 🎉');
      setTimeout(() => {
        setSuggestedGoal(null);
        setGoalFeedback(null);
      }, 2500);
    } catch (err: any) {
      console.error('Error saving goal from dashboard:', err);
      setGoalError('Could not save goal to Firestore. Please try again.');
    } finally {
      setSavingGoal(false);
    }
  };

  const handleDismissGoal = () => {
    setSuggestedGoal(null);
    setGoalError(null);
    setGoalFeedback(null);
  };

  // Toggle a task on an active goal directly from the dashboard
  const handleToggleTask = async (goal: Goal, taskId: string) => {
    if (!user) return;
    const updatedTasks = goal.tasks.map(t => 
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    const completedCount = updatedTasks.filter(t => t.completed).length;
    const newProgress = updatedTasks.length > 0 
      ? Math.round((completedCount / updatedTasks.length) * 100) 
      : 0;
    const isCompleted = updatedTasks.length > 0 && completedCount === updatedTasks.length;

    try {
      const goalRef = doc(db, 'users', user.uid, 'goals', goal.id);
      await setDoc(goalRef, sanitizePayload({
        ...goal,
        tasks: updatedTasks,
        progress: newProgress,
        status: isCompleted ? 'completed' : 'in_progress',
        updatedAt: new Date().toISOString(),
      }));
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-2xl border border-stone-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-stone-950">
            Welcome back, {profile?.displayName || 'Reflector'}
          </h1>
          <p className="mt-1 text-sm text-stone-600 font-sans">
            Your reflections are securely stored and isolated to your account. How would you like to reflect today?
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

      {/* ========================================== */}
      {/* 2. AI INSIGHT SECTION */}
      {/* ========================================== */}
      <div className="p-6 rounded-2xl bg-linear-to-br from-amber-50/70 via-stone-50/80 to-white border border-amber-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-400 text-stone-950 flex items-center justify-center shadow-2xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-stone-900 text-base">
                AI Insight
              </h3>
              <p className="text-xs text-stone-500">
                Grounded in your recent reflections and personal themes
              </p>
            </div>
          </div>

          {entries.length > 0 && (
            <button
              onClick={handleGenerateInsight}
              disabled={isLoadingInsight}
              className="p-1.5 rounded-lg border border-amber-200 bg-white/90 hover:bg-white text-stone-600 hover:text-stone-900 transition cursor-pointer text-xs flex items-center gap-1 shadow-2xs"
              title="Refresh insight"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingInsight ? 'animate-spin text-amber-600' : ''}`} />
              <span className="hidden sm:inline">Refresh Insight</span>
            </button>
          )}
        </div>

        {entries.length === 0 ? (
          <div className="p-4 rounded-xl bg-white/80 border border-stone-200/70 text-xs text-stone-600">
            Write your first reflection to receive AI-powered insights into your emotional patterns and recurring themes.
          </div>
        ) : isLoadingInsight ? (
          <div className="p-6 rounded-xl bg-white/80 border border-amber-200/50 flex items-center justify-center gap-2 text-stone-600 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            <span>Analyzing your recent reflections...</span>
          </div>
        ) : insightText ? (
          <div className="p-4 rounded-xl bg-white/90 border border-amber-200/80 text-xs sm:text-sm text-stone-800 leading-relaxed font-sans space-y-2">
            {insightTheme && (
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-medium border border-amber-200">
                {insightTheme}
              </span>
            )}
            <p className="whitespace-pre-line text-stone-700">
              {insightText}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-white/80 border border-stone-200 text-xs text-stone-600">
            <span>Discover patterns and shifts across your recent entries.</span>
            <button
              onClick={handleGenerateInsight}
              className="px-3 py-1.5 rounded-lg bg-stone-900 text-stone-50 text-xs font-medium hover:bg-stone-800 transition cursor-pointer"
            >
              Analyze Recent Entries
            </button>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* 3. AI SUGGESTED GOAL SECTION (WITH EMPTY STATE) */}
      {/* ========================================== */}
      {suggestedGoal ? (
        <AISuggestedGoal
          id="dashboard-suggested-goal-card"
          suggestion={{
            title: suggestedGoal.title,
            description: suggestedGoal.description,
            reason: suggestedGoal.reason,
            priority: suggestedGoal.priority,
            howToAchieve: suggestedGoal.howToAchieve,
            tasks: suggestedGoal.tasks,
            sourceReflectionId: suggestedGoal.sourceReflectionId,
          }}
          onAccept={handleAcceptGoal}
          onDismiss={handleDismissGoal}
          onRegenerateTasks={handleRegenerateTasks}
          isSaving={savingGoal}
          isRegenerating={isRegeneratingTasks}
          feedbackMessage={goalFeedback}
        />
      ) : entries.length > 0 ? (
        /* Action to generate goal from reflection if no suggestion is loaded */
        <div className="p-5 rounded-2xl bg-white border border-amber-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
              <Target className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-serif font-bold text-stone-900 text-sm">
                  AI Suggested Goal
                </h4>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  Ready to formulate
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                Turn your latest reflection into a structured goal: Gemini will formulate a milestone, motivation, and practical micro-tasks for your review.
              </p>
            </div>
          </div>

          <button
            id="dashboard-generate-goal-btn"
            onClick={handleGenerateSuggestedGoal}
            disabled={isGeneratingGoal}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 shadow-2xs disabled:opacity-50"
          >
            {isGeneratingGoal ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-200" />
            )}
            <span>{isGeneratingGoal ? 'Formulating...' : 'Generate Goal from Reflection'}</span>
          </button>
        </div>
      ) : (
        /* Empty state when user has no reflections yet */
        <div className="p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-stone-900">
            <Target className="w-5 h-5 text-amber-500" />
            <h4 className="font-serif font-bold text-sm">AI Suggested Goal</h4>
          </div>
          <p className="text-xs text-stone-500 font-sans leading-relaxed max-w-lg">
            No goal suggestions yet. Write your reflections in the editor, and Sanctuary AI will formulate structured milestones, motivations, and actionable tasks for your review.
          </p>
          <button
            onClick={onNewReflection}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-900 text-stone-50 text-xs font-medium hover:bg-stone-800 transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Write First Reflection</span>
          </button>
        </div>
      )}

      {/* ========================================== */}
      {/* 4. STATISTICS (METRICS ROW) */}
      {/* ========================================== */}
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

      {/* ========================================== */}
      {/* ACTIVE GOAL PROGRESS SECTION */}
      {/* ========================================== */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-600" />
            <h3 className="font-serif font-bold text-stone-900 text-base">
              Active Goal Progress
            </h3>
          </div>

          <button
            onClick={() => onNavigateTab('goals')}
            className="text-xs font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
          >
            <span>View All Goals</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {activeGoalsList.length === 0 ? (
          <div className="p-8 text-center bg-stone-50 rounded-xl border border-stone-100">
            <Target className="w-8 h-8 text-stone-300 mx-auto mb-2" />
            <p className="text-xs font-medium text-stone-700">No active goals currently in progress</p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Create a milestone manually or turn one of your reflections into an actionable plan.
            </p>
            <button
              onClick={() => onNavigateTab('goals')}
              className="mt-3 px-3.5 py-1.5 rounded-lg bg-stone-900 text-stone-50 text-xs font-medium hover:bg-stone-800 transition cursor-pointer"
            >
              Open Goals Tracker
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeGoalsList.slice(0, 4).map((goal) => {
              const totalTasks = goal.tasks?.length || 0;
              const completedTasks = goal.tasks?.filter(t => t.completed).length || 0;
              const progressPct = totalTasks > 0 
                ? Math.round((completedTasks / totalTasks) * 100) 
                : (goal.progress || 0);
              
              // First uncompleted task
              const nextTask = goal.tasks?.find(t => !t.completed);

              return (
                <div
                  key={goal.id}
                  className="p-4 rounded-xl border border-stone-200/90 hover:border-emerald-300 bg-white hover:shadow-xs transition space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-serif font-semibold text-stone-950 text-sm leading-snug">
                        {goal.title}
                      </h4>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        {completedTasks} / {totalTasks} tasks completed
                      </p>
                    </div>
                    <span className="text-xs font-bold font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                      Progress: {progressPct}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden border border-stone-200">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(progressPct, 4)}%` }}
                    />
                  </div>

                  {/* Next Recommended Task */}
                  {nextTask ? (
                    <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200/70 text-xs flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block">
                          Next Recommended Task:
                        </span>
                        <p className="text-stone-800 font-medium truncate mt-0.5">
                          {nextTask.title}
                        </p>
                      </div>

                      <button
                        onClick={() => handleToggleTask(goal, nextTask.id)}
                        className="px-2 py-1 rounded bg-white hover:bg-emerald-50 text-stone-600 hover:text-emerald-700 border border-stone-200 hover:border-emerald-300 text-[11px] font-medium transition cursor-pointer shrink-0 flex items-center gap-1 shadow-2xs"
                        title="Mark task completed"
                      >
                        <Check className="w-3 h-3" />
                        <span>Complete</span>
                      </button>
                    </div>
                  ) : totalTasks > 0 ? (
                    <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>All tasks finished! Ready to complete milestone.</span>
                    </div>
                  ) : (
                    <p className="text-xs text-stone-400 italic">No tasks added to this goal yet.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
              Your reflections are securely stored and isolated to your account. Write your first thought today!
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

