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

  // Edit suggested goal modal/inline state
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editPriority, setEditPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [editTasks, setEditTasks] = useState<string[]>([]);
  const [newTaskInput, setNewTaskInput] = useState('');

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
        setEditTitle(newSug.title);
        setEditReason(newSug.reason || newSug.description || '');
        setEditPriority(newSug.priority || 'medium');
        setEditTasks(newSug.tasks.map(t => t.title));
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
        setEditTitle(newSug.title);
        setEditReason(newSug.reason || newSug.description || '');
        setEditPriority(newSug.priority || 'medium');
        setEditTasks(newSug.tasks.map(t => t.title));
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

  const handleAcceptGoal = async () => {
    if (!user || !suggestedGoal || savingGoal) return;
    setSavingGoal(true);
    setGoalError(null);

    try {
      const goalRef = doc(collection(db, 'users', user.uid, 'goals'));
      const tasksFormatted: GoalTask[] = suggestedGoal.tasks.map((task, idx) => ({
        id: `task_${Date.now()}_${idx}`,
        title: task.title,
        description: task.description || '',
        priority: task.priority || suggestedGoal.priority || 'medium',
        completed: false,
      }));

      const newGoalData = {
        id: goalRef.id,
        userId: user.uid,
        title: suggestedGoal.title,
        description: suggestedGoal.description || suggestedGoal.reason || '',
        reason: suggestedGoal.reason || '',
        priority: suggestedGoal.priority || 'medium',
        status: 'in_progress',
        progress: 0,
        howToAchieve: suggestedGoal.howToAchieve || [],
        tasks: tasksFormatted,
        extractedFromJournalId: suggestedGoal.sourceReflectionId || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(goalRef, sanitizePayload(newGoalData));
      setGoalFeedback('Goal and tasks saved to your Tracker! 🎉');
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

  const handleSaveEditedGoal = async () => {
    if (!user || !editTitle.trim() || savingGoal) return;
    setSavingGoal(true);
    setGoalError(null);

    try {
      const goalRef = doc(collection(db, 'users', user.uid, 'goals'));
      const tasksFormatted: GoalTask[] = editTasks.map((taskTitle, idx) => ({
        id: `task_${Date.now()}_${idx}`,
        title: taskTitle,
        description: 'Actionable micro-step.',
        priority: editPriority,
        completed: false,
      }));

      const newGoalData = {
        id: goalRef.id,
        userId: user.uid,
        title: editTitle.trim(),
        description: editReason.trim() || suggestedGoal?.description || '',
        reason: editReason.trim() || suggestedGoal?.reason || '',
        priority: editPriority,
        status: 'in_progress',
        progress: 0,
        howToAchieve: suggestedGoal?.howToAchieve || [],
        tasks: tasksFormatted,
        extractedFromJournalId: suggestedGoal?.sourceReflectionId || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(goalRef, sanitizePayload(newGoalData));
      setGoalFeedback('Customized goal saved to your Tracker! 🎉');
      setIsEditingGoal(false);
      setTimeout(() => {
        setSuggestedGoal(null);
        setGoalFeedback(null);
      }, 2500);
    } catch (err: any) {
      console.error('Error saving edited goal:', err);
      setGoalError('Could not save goal to Firestore.');
    } finally {
      setSavingGoal(false);
    }
  };

  const handleDismissGoal = () => {
    setSuggestedGoal(null);
    setIsEditingGoal(false);
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
        <div className="p-6 rounded-2xl bg-white border-2 border-amber-300 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-amber-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-2xs">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-serif font-bold text-stone-900 text-base">
                    AI Suggested Goal
                  </h4>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                    suggestedGoal.priority === 'high'
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : suggestedGoal.priority === 'low'
                      ? 'bg-stone-100 text-stone-700 border border-stone-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}>
                    {suggestedGoal.priority || 'medium'} priority
                  </span>
                </div>
                <p className="text-xs text-stone-500">
                  Extracted from your latest reflection. Requires your explicit confirmation.
                </p>
              </div>
            </div>

            <button
              id="dashboard-dismiss-suggested-goal-btn"
              onClick={handleDismissGoal}
              className="p-1 rounded-md text-stone-400 hover:text-stone-700 transition cursor-pointer"
              title="Dismiss suggestion"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Goal Details */}
          {!isEditingGoal ? (
            <div className="space-y-3">
              <div>
                <h5 className="font-serif text-base font-semibold text-stone-950">
                  {suggestedGoal.title}
                </h5>
                {suggestedGoal.description && (
                  <p className="text-xs text-stone-600 mt-0.5">
                    {suggestedGoal.description}
                  </p>
                )}
              </div>

              {/* Why this goal */}
              {suggestedGoal.reason && (
                <div className="p-3 rounded-xl bg-amber-100/60 border border-amber-200/70 text-xs text-amber-950 space-y-0.5">
                  <span className="font-bold block text-amber-900 uppercase tracking-wider text-[10px]">Why this goal</span>
                  <p className="leading-relaxed font-sans">{suggestedGoal.reason}</p>
                </div>
              )}

              {/* How to achieve it */}
              {suggestedGoal.howToAchieve && suggestedGoal.howToAchieve.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-xs font-semibold text-stone-800 block">
                    How to achieve it
                  </span>
                  <div className="space-y-1.5">
                    {suggestedGoal.howToAchieve.map((stepText, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-stone-700 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                        <span className="text-amber-600 font-bold shrink-0">{idx + 1}.</span>
                        <span className="font-sans leading-snug">{stepText}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Tasks */}
              {suggestedGoal.tasks && suggestedGoal.tasks.length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-semibold text-stone-800 block">
                    Suggested Tasks
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {suggestedGoal.tasks.map((task, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-stone-50 border border-stone-200/90 text-xs text-stone-800 space-y-1"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-1.5">
                            <span className="text-amber-500 font-bold">•</span>
                            <span className="font-semibold text-stone-900 leading-snug">{task.title}</span>
                          </div>
                          <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded shrink-0 border ${
                            task.priority === 'high'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : task.priority === 'low'
                              ? 'bg-stone-100 text-stone-600 border-stone-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            {task.priority}
                          </span>
                        </div>
                        {task.description && (
                          <p className="text-[11px] text-stone-600 pl-3 font-sans leading-relaxed">
                            {task.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {goalFeedback && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{goalFeedback}</span>
                </div>
              )}

              {goalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span>{goalError}</span>
                </div>
              )}

              {/* Action Buttons: Accept Goal, Edit Goal, Dismiss, Regenerate Tasks */}
              <div className="pt-2 flex flex-wrap items-center gap-2.5 border-t border-stone-100">
                <button
                  id="dashboard-accept-suggested-goal-btn"
                  onClick={handleAcceptGoal}
                  disabled={savingGoal}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                >
                  {savingGoal ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Accept Goal</span>
                </button>

                <button
                  id="dashboard-edit-suggested-goal-btn"
                  onClick={() => setIsEditingGoal(true)}
                  disabled={savingGoal}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-stone-50 text-stone-800 text-xs font-semibold border border-stone-300 transition cursor-pointer shadow-2xs"
                >
                  Edit Goal
                </button>

                <button
                  id="dashboard-regenerate-suggested-goal-btn"
                  onClick={handleGenerateSuggestedGoal}
                  disabled={isGeneratingGoal || savingGoal}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium border border-stone-200 transition cursor-pointer shadow-2xs flex items-center gap-1.5"
                >
                  {isGeneratingGoal ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-500" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  )}
                  <span>{isGeneratingGoal ? 'Regenerating...' : 'Regenerate Tasks'}</span>
                </button>

                <button
                  onClick={handleDismissGoal}
                  className="px-3 py-2 rounded-xl text-stone-500 hover:text-stone-800 text-xs font-medium transition cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : (
            /* Inline Edit Form */
            <div className="space-y-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
              <h5 className="font-serif font-semibold text-stone-900 text-xs uppercase tracking-wider">
                Customize Suggested Goal
              </h5>
              <div>
                <label className="text-[11px] font-medium text-stone-600 block mb-1">Goal Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-stone-600 block mb-1">Why this goal / Reason</label>
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="text-[11px] font-medium text-stone-600">Priority:</label>
                {(['low', 'medium', 'high'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setEditPriority(p)}
                    className={`px-2.5 py-1 rounded-md text-xs uppercase font-semibold border transition cursor-pointer ${
                      editPriority === p 
                        ? 'bg-amber-500 text-white border-amber-500' 
                        : 'bg-white text-stone-600 border-stone-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-[11px] font-medium text-stone-600 block mb-1">
                  Tasks ({editTasks.length})
                </label>
                <div className="space-y-1.5 mb-2">
                  {editTasks.map((t, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-stone-200">
                      <span className="text-xs text-stone-700 flex-1">{t}</span>
                      <button
                        type="button"
                        onClick={() => setEditTasks(prev => prev.filter((_, i) => i !== idx))}
                        className="text-stone-400 hover:text-rose-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newTaskInput}
                    onChange={(e) => setNewTaskInput(e.target.value)}
                    placeholder="Add an actionable micro-task..."
                    className="flex-1 text-xs p-2 rounded-lg border border-stone-300 bg-white focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTaskInput.trim()) {
                        e.preventDefault();
                        setEditTasks([...editTasks, newTaskInput.trim()]);
                        setNewTaskInput('');
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newTaskInput.trim()) {
                        setEditTasks([...editTasks, newTaskInput.trim()]);
                        setNewTaskInput('');
                      }
                    }}
                    className="px-3 py-2 rounded-lg bg-stone-900 text-white text-xs font-medium"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={handleSaveEditedGoal}
                  disabled={savingGoal || !editTitle.trim()}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                >
                  {savingGoal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Goal to Tracker</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingGoal(false)}
                  className="px-3 py-2 rounded-xl text-stone-600 text-xs font-medium hover:text-stone-900 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
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

