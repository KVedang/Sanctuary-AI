import React, { useState } from 'react';
import { 
  Target, 
  Plus, 
  CheckCircle2, 
  Circle, 
  Clock, 
  Trash2, 
  AlertCircle,
  Flag,
  Sparkles,
  Loader2,
  X,
  ArrowRight,
  ShieldCheck,
  Check
} from 'lucide-react';
import { Goal, GoalTask, JournalEntry, GoalSuggestion } from '../../types';
import { db } from '../../lib/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { sanitizePayload, formatDate } from '../../lib/utils';
import { AISuggestedGoal } from './AISuggestedGoal';

interface GoalListProps {
  goals: Goal[];
  entries?: JournalEntry[];
  onRefresh: () => void;
  onNavigateToEditor?: () => void;
}

export const GoalList: React.FC<GoalListProps> = ({ 
  goals, 
  entries = [], 
  onRefresh,
  onNavigateToEditor 
}) => {
  const { user } = useAuth();
  const { authenticatedFetch } = useApi();
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [taskInput, setTaskInput] = useState('');
  const [tasks, setTasks] = useState<GoalTask[]>([]);
  const [saving, setSaving] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<string | null>(null);

  // AI Coaching State
  const [coachingGoal, setCoachingGoal] = useState<Goal | null>(null);
  const [coachingData, setCoachingData] = useState<any | null>(null);
  const [loadingCoaching, setLoadingCoaching] = useState(false);
  const [coachingError, setCoachingError] = useState<string | null>(null);
  const [addedSubtasks, setAddedSubtasks] = useState<Set<string>>(new Set());

  // AI Suggested Goal State (From Reflection)
  const [showAiSuggestModal, setShowAiSuggestModal] = useState(false);
  const [selectedJournalId, setSelectedJournalId] = useState<string>('');
  const [isAnalyzingJournal, setIsAnalyzingJournal] = useState(false);
  const [suggestedGoalResult, setSuggestedGoalResult] = useState<GoalSuggestion | null>(null);
  const [aiSuggestError, setAiSuggestError] = useState<string | null>(null);
  const [isEditingSuggestedGoal, setIsEditingSuggestedGoal] = useState(false);
  const [editSugTitle, setEditSugTitle] = useState('');
  const [editSugDescription, setEditSugDescription] = useState('');
  const [editSugPriority, setEditSugPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [editSugHowToAchieve, setEditSugHowToAchieve] = useState<string[]>([]);
  const [newSugStepInput, setNewSugStepInput] = useState('');
  const [editSugTasks, setEditSugTasks] = useState<string[]>([]);
  const [newSugTaskInput, setNewSugTaskInput] = useState('');
  const [savingSuggestedGoal, setSavingSuggestedGoal] = useState(false);
  const [isRegeneratingSugTasks, setIsRegeneratingSugTasks] = useState(false);
  const [suggestSuccessFeedback, setSuggestSuccessFeedback] = useState<string | null>(null);

  const handleAddTask = () => {
    if (!taskInput.trim()) return;
    const newTask: GoalTask = {
      id: `task_${Date.now()}`,
      title: taskInput.trim(),
      completed: false,
    };
    setTasks([...tasks, newTask]);
    setTaskInput('');
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;

    setSaving(true);
    const goalId = `goal_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const newGoal: Goal = {
      id: goalId,
      userId: user.uid,
      title: title.trim(),
      description: description.trim(),
      priority,
      status: 'in_progress',
      progress: 0,
      tasks,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    try {
      const goalRef = doc(db, 'users', user.uid, 'goals', goalId);
      await setDoc(goalRef, sanitizePayload({
        ...newGoal,
        createdAt: nowIso,
        updatedAt: nowIso,
      }));

      setShowModal(false);
      setTitle('');
      setDescription('');
      setTasks([]);
      onRefresh();
    } catch (err) {
      console.error('Failed to create goal:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTask = async (goal: Goal, taskId: string) => {
    if (!user) return;
    const updatedTasks = goal.tasks.map((t) =>
      t.id === taskId ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : undefined } : t
    );

    const completedCount = updatedTasks.filter((t) => t.completed).length;
    const newProgress = updatedTasks.length > 0 ? Math.round((completedCount / updatedTasks.length) * 100) : 0;
    const newStatus = newProgress === 100 ? 'completed' : 'in_progress';

    try {
      const goalRef = doc(db, 'users', user.uid, 'goals', goal.id);
      await setDoc(
        goalRef,
        sanitizePayload({
          tasks: updatedTasks,
          progress: newProgress,
          status: newStatus,
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      );
      onRefresh();
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!user) return;

    try {
      const goalRef = doc(db, 'users', user.uid, 'goals', goalId);
      await deleteDoc(goalRef);
      setGoalToDelete(null);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete goal:', err);
      setGoalToDelete(null);
    }
  };

  // AI Progress Coaching Flow
  const handleOpenCoaching = async (goal: Goal) => {
    setCoachingGoal(goal);
    setCoachingData(null);
    setCoachingError(null);
    setLoadingCoaching(true);
    setAddedSubtasks(new Set());

    try {
      const data = await authenticatedFetch('/api/ai/goal-coach', {
        method: 'POST',
        body: JSON.stringify({ goal }),
      });

      if (data.coaching) {
        setCoachingData(data.coaching);
      }
    } catch (err: any) {
      console.error('Failed to fetch goal coaching:', err);
      setCoachingError('Could not load progress coaching at this time.');
    } finally {
      setLoadingCoaching(false);
    }
  };

  // User accepts and adds a suggested subtask to the goal
  const handleAddSuggestedSubtask = async (subtaskTitle: string) => {
    if (!user || !coachingGoal || addedSubtasks.has(subtaskTitle)) return;

    const newTask: GoalTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: subtaskTitle,
      completed: false,
    };

    const updatedTasks = [...(coachingGoal.tasks || []), newTask];
    const completedCount = updatedTasks.filter((t) => t.completed).length;
    const newProgress = Math.round((completedCount / updatedTasks.length) * 100);

    try {
      const goalRef = doc(db, 'users', user.uid, 'goals', coachingGoal.id);
      await setDoc(
        goalRef,
        sanitizePayload({
          tasks: updatedTasks,
          progress: newProgress,
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      );

      // Update local state
      setCoachingGoal({
        ...coachingGoal,
        tasks: updatedTasks,
        progress: newProgress,
      });

      setAddedSubtasks(new Set(addedSubtasks).add(subtaskTitle));
      onRefresh();
    } catch (err) {
      console.error('Error adding suggested subtask:', err);
    }
  };

  // 1. Open AI Goal Suggestion Modal
  const handleOpenAiSuggestModal = () => {
    setSuggestedGoalResult(null);
    setAiSuggestError(null);
    setSuggestSuccessFeedback(null);
    setIsEditingSuggestedGoal(false);
    if (!selectedJournalId && entries.length > 0) {
      setSelectedJournalId(entries[0].id);
    }
    setShowAiSuggestModal(true);
  };

  // 2. Run AI Goal Extraction on selected reflection
  const handleRunAiGoalExtraction = async () => {
    const entry = entries.find((e) => e.id === selectedJournalId) || entries[0];
    if (!entry || !entry.content?.trim()) {
      setAiSuggestError('Please select a reflection with written content.');
      return;
    }

    setIsAnalyzingJournal(true);
    setAiSuggestError(null);
    setSuggestSuccessFeedback(null);
    setSuggestedGoalResult(null);

    try {
      const data = await authenticatedFetch('/api/ai/process', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'goal_generate',
          content: entry.content,
          title: entry.title,
        }),
      });

      if (data.data?.goal) {
        const g = data.data.goal;
        const taskTitles = (data.data.tasks || []).map((t: any) => typeof t === 'string' ? t : t.title);
        const suggestion: GoalSuggestion = {
          hasGoal: true,
          title: g.title,
          description: g.description,
          reason: g.reason,
          priority: g.priority || 'medium',
          howToAchieve: g.howToAchieve || [],
          tasks: taskTitles,
        };
        setSuggestedGoalResult(suggestion);
        setEditSugTitle(g.title || '');
        setEditSugDescription(g.description || g.reason || '');
        setEditSugPriority(g.priority || 'medium');
        setEditSugHowToAchieve(g.howToAchieve ? [...g.howToAchieve] : []);
        setEditSugTasks(taskTitles);
      } else if (data.data && data.data.goal === null) {
        setSuggestedGoalResult({
          hasGoal: false,
          reason: data.data.reason || 'The reflection does not contain enough actionable information for a meaningful goal.',
        });
      } else if (data.goalSuggestion) {
        setSuggestedGoalResult(data.goalSuggestion);
        setEditSugTitle(data.goalSuggestion.title || '');
        setEditSugDescription(data.goalSuggestion.description || data.goalSuggestion.reason || '');
        setEditSugPriority(data.goalSuggestion.priority || 'medium');
        setEditSugHowToAchieve(data.goalSuggestion.howToAchieve ? [...data.goalSuggestion.howToAchieve] : []);
        setEditSugTasks(data.goalSuggestion.tasks ? [...data.goalSuggestion.tasks] : []);
      } else {
        setAiSuggestError('Could not formulate a goal suggestion from this reflection.');
      }
    } catch (err: any) {
      console.warn('AI goal extraction error:', err);
      setAiSuggestError('Could not generate goal suggestion at this time. You can still create goals manually.');
    } finally {
      setIsAnalyzingJournal(false);
    }
  };

  // 2b. Regenerate Tasks for Suggested Goal
  const handleRegenerateSugTasks = async () => {
    if (!suggestedGoalResult || isRegeneratingSugTasks) return;

    setIsRegeneratingSugTasks(true);
    try {
      const entry = entries.find((e) => e.id === selectedJournalId);
      const res = await authenticatedFetch('/api/ai/regenerate-tasks', {
        method: 'POST',
        body: JSON.stringify({
          goalTitle: suggestedGoalResult.title,
          goalDescription: suggestedGoalResult.description || suggestedGoalResult.reason,
          reflectionContext: entry?.content,
        }),
      });

      if (res.tasks && Array.isArray(res.tasks)) {
        setSuggestedGoalResult({
          ...suggestedGoalResult,
          tasks: res.tasks,
          howToAchieve: res.howToAchieve || suggestedGoalResult.howToAchieve,
        });
        setEditSugTasks(res.tasks);
        if (res.howToAchieve) {
          setEditSugHowToAchieve(res.howToAchieve);
        }
      }
    } catch (err: any) {
      console.error('Error regenerating suggested tasks:', err);
    } finally {
      setIsRegeneratingSugTasks(false);
    }
  };

  // 3. Accept AI Suggested Goal directly
  const handleAcceptSuggestedGoal = async () => {
    if (!user || !suggestedGoalResult || !suggestedGoalResult.hasGoal || savingSuggestedGoal) return;

    setSavingSuggestedGoal(true);
    setAiSuggestError(null);

    try {
      const goalId = `goal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const nowIso = new Date().toISOString();
      const tasksFormatted: GoalTask[] = (suggestedGoalResult.tasks || []).map((t, idx) => ({
        id: `task_${Date.now()}_${idx}`,
        title: t,
        completed: false,
      }));

      const newGoal: Goal = {
        id: goalId,
        userId: user.uid,
        title: suggestedGoalResult.title || 'Personal Milestone',
        description: suggestedGoalResult.description || suggestedGoalResult.reason || '',
        priority: suggestedGoalResult.priority || 'medium',
        status: 'in_progress',
        progress: 0,
        howToAchieve: suggestedGoalResult.howToAchieve || [],
        tasks: tasksFormatted,
        extractedFromJournalId: selectedJournalId || '',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const goalRef = doc(db, 'users', user.uid, 'goals', goalId);
      await setDoc(goalRef, sanitizePayload(newGoal));

      setSuggestSuccessFeedback('Goal and tasks saved to your Goals! 🎉');
      onRefresh();

      setTimeout(() => {
        setShowAiSuggestModal(false);
        setSuggestSuccessFeedback(null);
        setSuggestedGoalResult(null);
      }, 1400);
    } catch (err: any) {
      console.error('Error saving suggested goal:', err);
      setAiSuggestError('Failed to save goal to Firestore. Please try again.');
    } finally {
      setSavingSuggestedGoal(false);
    }
  };

  // 4. Save Custom / Edited Suggested Goal
  const handleSaveCustomSuggestedGoal = async () => {
    if (!user || !editSugTitle.trim() || savingSuggestedGoal) return;

    setSavingSuggestedGoal(true);
    setAiSuggestError(null);

    try {
      const goalId = `goal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const nowIso = new Date().toISOString();
      const tasksFormatted: GoalTask[] = editSugTasks.map((t, idx) => ({
        id: `task_${Date.now()}_${idx}`,
        title: t,
        completed: false,
      }));

      const customGoal: Goal = {
        id: goalId,
        userId: user.uid,
        title: editSugTitle.trim(),
        description: editSugDescription.trim(),
        priority: editSugPriority,
        status: 'in_progress',
        progress: 0,
        howToAchieve: editSugHowToAchieve || [],
        tasks: tasksFormatted,
        extractedFromJournalId: selectedJournalId || '',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const goalRef = doc(db, 'users', user.uid, 'goals', goalId);
      await setDoc(goalRef, sanitizePayload(customGoal));

      setSuggestSuccessFeedback('Customized goal and tasks saved! 🎉');
      onRefresh();

      setTimeout(() => {
        setShowAiSuggestModal(false);
        setIsEditingSuggestedGoal(false);
        setSuggestSuccessFeedback(null);
        setSuggestedGoalResult(null);
      }, 1400);
    } catch (err: any) {
      console.error('Error saving custom goal:', err);
      setAiSuggestError('Failed to save custom goal. Please try again.');
    } finally {
      setSavingSuggestedGoal(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-stone-950">
            Actionable Goals &amp; Habits
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Convert reflective thoughts and journaling into structured action items with progress tracking and AI coaching.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            id="ai-suggest-goal-from-journal-btn"
            onClick={handleOpenAiSuggestModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 rounded-xl text-xs font-medium transition cursor-pointer shadow-2xs"
            title="Analyze reflections to suggest an actionable goal with micro-tasks"
          >
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>AI Suggest from Journal</span>
          </button>

          <button
            id="create-goal-modal-btn"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-stone-50 hover:bg-stone-800 rounded-xl text-xs font-medium transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4 text-amber-300" />
            <span>New Goal</span>
          </button>
        </div>
      </div>

      {/* AI Goal Suggestions Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>AI Goal Suggestions</span>
          </h2>
          {suggestedGoalResult && (
            <span className="text-[11px] font-medium text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
              Suggestion Ready
            </span>
          )}
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-stone-900">
              Turn your journal reflections into structured, actionable milestones.
            </p>
            <p className="text-[11px] text-stone-500">
              Gemini reviews recent reflections to suggest high-impact goals with step-by-step tasks.
            </p>
          </div>
          <button
            id="ai-suggest-section-btn"
            onClick={handleOpenAiSuggestModal}
            disabled={isAnalyzingJournal}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shrink-0 shadow-2xs self-start sm:self-auto"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isAnalyzingJournal ? 'Analyzing...' : 'Generate Goal'}</span>
          </button>
        </div>

        {/* Inline AI Suggested Goal card if available */}
        {suggestedGoalResult && suggestedGoalResult.hasGoal && (
          <div className="pt-2">
            <AISuggestedGoal
              id="goals-page-suggested-goal-card"
              suggestion={{
                title: suggestedGoalResult.title || 'Personal Milestone',
                description: suggestedGoalResult.description,
                reason: suggestedGoalResult.reason,
                priority: suggestedGoalResult.priority,
                howToAchieve: suggestedGoalResult.howToAchieve,
                tasks: (suggestedGoalResult.tasks || []).map((t) => ({
                  title: t,
                  description: 'Actionable micro-step to advance this milestone.',
                  priority: suggestedGoalResult.priority || 'medium',
                })),
                sourceReflectionId: selectedJournalId,
              }}
              onAccept={handleAcceptSuggestedGoal}
              onDismiss={() => setSuggestedGoalResult(null)}
              onRegenerateTasks={handleRegenerateSugTasks}
              isSaving={savingSuggestedGoal}
              isRegenerating={isRegeneratingSugTasks}
            />
          </div>
        )}
      </div>

      {/* My Goals Section */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between border-b border-stone-200/70 pb-2.5">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-stone-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-700">
              My Goals
            </h2>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
              {goals.length}
            </span>
          </div>
        </div>

        {/* Goal Cards Grid */}
        {goals.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-stone-200 text-center space-y-3">
            <Target className="w-10 h-10 text-stone-300 mx-auto" />
            <p className="text-sm font-medium text-stone-700">No active goals yet</p>
            <p className="text-xs text-stone-400 max-w-sm mx-auto">
              You can add goals manually or have Sanctuary AI analyze your journal reflections to suggest actionable goals and concrete micro-tasks.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                id="empty-state-ai-suggest-btn"
                onClick={handleOpenAiSuggestModal}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Goal</span>
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 rounded-xl bg-stone-900 text-stone-50 text-xs font-medium hover:bg-stone-800 transition cursor-pointer"
              >
                Create Manually
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {goals.map((goal) => (
            <div
              key={goal.id}
              className="p-6 rounded-2xl bg-white border border-stone-200/90 shadow-xs flex flex-col justify-between gap-5 hover:border-stone-300 transition"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span
                      className={`text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full ${
                        goal.priority === 'high'
                          ? 'bg-rose-100 text-rose-800'
                          : goal.priority === 'medium'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {goal.priority} priority
                    </span>
                    <h3 className="font-serif font-semibold text-stone-900 text-base mt-1.5">
                      {goal.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* AI Coach Button */}
                    <button
                      id={`ai-coach-btn-${goal.id}`}
                      onClick={() => handleOpenCoaching(goal)}
                      className="flex items-center gap-1 text-[11px] text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg transition font-medium cursor-pointer shadow-2xs"
                      title="Get AI progress coaching"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>AI Coach</span>
                    </button>

                    <button
                      onClick={() => setGoalToDelete(goal.id)}
                      className="text-stone-400 hover:text-rose-600 p-1.5 transition cursor-pointer rounded-md hover:bg-stone-50"
                      title="Delete Goal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {goal.description && (
                  <p className="text-xs text-stone-600 font-sans leading-relaxed">
                    {goal.description}
                  </p>
                )}

                {/* Progress Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs font-medium text-stone-600">
                    <span>Progress</span>
                    <span>{goal.progress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        goal.progress === 100 ? 'bg-emerald-500' : 'bg-amber-400'
                      }`}
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                </div>

                {/* Tasks Checklist */}
                {goal.tasks && goal.tasks.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-stone-100">
                    <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                      Tasks ({goal.tasks.filter((t) => t.completed).length}/{goal.tasks.length})
                    </p>
                    <div className="space-y-1">
                      {goal.tasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => handleToggleTask(goal, task.id)}
                          className="flex items-center gap-2 text-xs py-1 px-1.5 rounded hover:bg-stone-50 transition cursor-pointer"
                        >
                          {task.completed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-stone-300 shrink-0" />
                          )}
                          <span
                            className={`${
                              task.completed
                                ? 'line-through text-stone-400'
                                : 'text-stone-800'
                            }`}
                          >
                            {task.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Plan Roadmap (How to achieve) */}
                {goal.howToAchieve && goal.howToAchieve.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-stone-100">
                    <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                      Plan Roadmap:
                    </p>
                    <div className="space-y-1">
                      {goal.howToAchieve.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-xs text-stone-600 bg-stone-50/70 p-1.5 rounded-lg">
                          <span className="text-amber-600 font-bold shrink-0">{idx + 1}.</span>
                          <span className="leading-tight">{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Next Step Highlight */}
                {(() => {
                  const nextTask = goal.tasks?.find((t) => !t.completed);
                  return nextTask ? (
                    <div className="text-xs bg-amber-50/80 border border-amber-200/70 rounded-xl p-2.5 flex items-center justify-between gap-2 mt-2">
                      <div className="truncate">
                        <span className="font-semibold text-amber-900 block text-[10px] uppercase tracking-wider">Next Step:</span>
                        <span className="text-stone-800 text-xs truncate block">{nextTask.title}</span>
                      </div>
                      <button
                        onClick={() => handleToggleTask(goal, nextTask.id)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold shrink-0 cursor-pointer shadow-2xs"
                      >
                        Complete
                      </button>
                    </div>
                  ) : null;
                })()}
              </div>

              <div className="flex items-center justify-between text-[11px] text-stone-400 font-mono pt-3 border-t border-stone-100">
                <span>Created: {formatDate(goal.createdAt)}</span>
                <span className="capitalize">{goal.status.replace('_', ' ')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>

      {/* AI PROGRESS COACHING MODAL */}
      {coachingGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-stone-200 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="font-serif font-bold text-stone-900 text-base">
                    AI Progress Coaching
                  </h3>
                  <p className="text-xs text-stone-500 truncate max-w-xs">
                    {coachingGoal.title}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setCoachingGoal(null)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-md transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Loading state */}
            {loadingCoaching && (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                <p className="text-xs text-stone-600">Analyzing goal trajectory and obstacles...</p>
              </div>
            )}

            {coachingError && (
              <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{coachingError}</span>
              </div>
            )}

            {/* Coaching content */}
            {coachingData && !loadingCoaching && (
              <div className="space-y-4 text-xs">
                {/* Completed summary */}
                <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/70 space-y-1">
                  <span className="font-bold text-emerald-900 uppercase tracking-wide block text-[11px]">
                    ✓ Accomplishments &amp; Completed Work
                  </span>
                  <p className="text-stone-800 leading-relaxed">
                    {coachingData.completedSummary}
                  </p>
                </div>

                {/* Remaining summary */}
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/70 space-y-1">
                  <span className="font-bold text-stone-700 uppercase tracking-wide block text-[11px]">
                    📋 Remaining Tasks Overview
                  </span>
                  <p className="text-stone-800 leading-relaxed">
                    {coachingData.remainingSummary}
                  </p>
                </div>

                {/* Obstacles & Friction */}
                {coachingData.potentialObstacle && (
                  <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/70 space-y-1">
                    <span className="font-bold text-amber-900 uppercase tracking-wide block text-[11px]">
                      ⚠️ Potential Obstacle / Friction Point
                    </span>
                    <p className="text-stone-800 leading-relaxed">
                      {coachingData.potentialObstacle}
                    </p>
                  </div>
                )}

                {/* Recommended Next Action */}
                {coachingData.recommendedNextStep && (
                  <div className="p-3.5 rounded-xl bg-sky-50/60 border border-sky-200/70 space-y-1">
                    <span className="font-bold text-sky-900 uppercase tracking-wide block text-[11px]">
                      🎯 Recommended Immediate Next Action
                    </span>
                    <p className="text-stone-800 leading-relaxed font-medium">
                      {coachingData.recommendedNextStep}
                    </p>
                  </div>
                )}

                {/* Suggested Subtask Breakdowns */}
                {Array.isArray(coachingData.suggestedSubtasks) && coachingData.suggestedSubtasks.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-stone-100">
                    <span className="font-bold text-stone-800 block text-[11px] uppercase tracking-wide">
                      Suggested Micro-Tasks (User Approval Required):
                    </span>
                    <div className="space-y-1.5">
                      {coachingData.suggestedSubtasks.map((subtask: string, idx: number) => {
                        const isAdded = addedSubtasks.has(subtask);
                        return (
                          <div key={idx} className="flex items-center justify-between gap-2 p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                            <span className="text-stone-800 font-medium">{subtask}</span>
                            <button
                              onClick={() => handleAddSuggestedSubtask(subtask)}
                              disabled={isAdded}
                              className={`px-3 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer shrink-0 ${
                                isAdded 
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 shadow-2xs'
                              }`}
                            >
                              {isAdded ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>Added</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3" />
                                  <span>Add to Goal</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Coaching advice */}
                {coachingData.coachingAdvice && (
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-stone-700 italic">
                    "{coachingData.coachingAdvice}"
                  </div>
                )}
              </div>
            )}

            {/* Modal Footer */}
            <div className="pt-3 border-t border-stone-100 flex justify-end">
              <button
                onClick={() => setCoachingGoal(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-700 hover:text-stone-950 bg-stone-100 hover:bg-stone-200 rounded-xl transition cursor-pointer"
              >
                Done Reviewing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Goal Modal (Manual) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-stone-200 space-y-4">
            <h3 className="font-serif font-semibold text-stone-900 text-lg">
              Create New Goal
            </h3>

            <form onSubmit={handleCreateGoal} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                  Goal Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Establish Daily Morning Reflection"
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                  Description / Motivation
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Why is this important to you right now?"
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>

              {/* Tasks builder */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold text-stone-600 uppercase">
                  Subtasks ({tasks.length})
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTask())}
                    placeholder="Add step (e.g. Set 7:00 AM alarm)..."
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                  />
                  <button
                    type="button"
                    onClick={handleAddTask}
                    className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-medium cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                {tasks.length > 0 && (
                  <div className="max-h-28 overflow-y-auto space-y-1 pt-1">
                    {tasks.map((t, idx) => (
                      <div key={t.id} className="flex items-center justify-between text-xs bg-stone-50 px-2 py-1 rounded">
                        <span>{t.title}</span>
                        <button
                          type="button"
                          onClick={() => setTasks(tasks.filter((_, i) => i !== idx))}
                          className="text-stone-400 hover:text-rose-600"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !title.trim()}
                  className="px-4 py-2 text-xs font-medium bg-stone-900 text-stone-50 hover:bg-stone-800 rounded-lg transition disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Delete Goal Confirmation Modal (iFrame safe) */}
      {goalToDelete && (
        <div className="fixed inset-0 z-50 bg-stone-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-semibold text-stone-950 text-base">
                  Delete Goal?
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  This will permanently delete this goal and its tasks.
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Are you sure you want to remove this goal? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setGoalToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteGoal(goalToDelete)}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer shadow-xs"
              >
                Delete Goal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Suggested Goal Modal (From Journal Reflection) */}
      {showAiSuggestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white rounded-2xl p-6 shadow-xl border border-stone-200 max-h-[90vh] overflow-y-auto space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif font-semibold text-stone-900 text-base">
                    AI Goal Suggestion from Journal
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Extracts actionable intentions and formulates one milestone with concrete micro-tasks.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAiSuggestModal(false)}
                className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Check if user has reflections */}
            {entries.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <p className="text-sm font-medium text-stone-700">
                  No journal reflections found yet
                </p>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  Write a reflection in the Journal tab first so Gemini can analyze your thoughts, identify intentions, and formulate an actionable goal.
                </p>
                {onNavigateToEditor && (
                  <button
                    onClick={() => {
                      setShowAiSuggestModal(false);
                      onNavigateToEditor();
                    }}
                    className="mt-2 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-medium transition cursor-pointer"
                  >
                    Write a Reflection
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Reflection Selector */}
                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase mb-1.5">
                    Select Reflection to Analyze
                  </label>
                  <select
                    value={selectedJournalId}
                    onChange={(e) => {
                      setSelectedJournalId(e.target.value);
                      setSuggestedGoalResult(null);
                      setAiSuggestError(null);
                      setSuggestSuccessFeedback(null);
                    }}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                  >
                    {entries.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.title || 'Untitled Reflection'} ({formatDate(entry.createdAt)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Reflection Preview Snippet */}
                {(() => {
                  const entry = entries.find((e) => e.id === selectedJournalId) || entries[0];
                  if (!entry) return null;
                  return (
                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 text-xs text-stone-600 max-h-24 overflow-y-auto leading-relaxed italic">
                      "{entry.content.length > 220 ? entry.content.substring(0, 220) + '...' : entry.content}"
                    </div>
                  );
                })()}

                {/* Action trigger button (if no suggestion yet or to re-run) */}
                {!suggestedGoalResult && !isAnalyzingJournal && (
                  <button
                    id="run-ai-goal-extraction-btn"
                    onClick={handleRunAiGoalExtraction}
                    disabled={isAnalyzingJournal}
                    className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Goal</span>
                  </button>
                )}

                {/* Loading state */}
                {isAnalyzingJournal && (
                  <div className="py-8 flex flex-col items-center justify-center gap-2.5 text-stone-500">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                    <p className="text-xs font-medium">
                      Gemini is formulating your goal from reflection...
                    </p>
                  </div>
                )}

                {/* Error Banner */}
                {aiSuggestError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{aiSuggestError}</span>
                  </div>
                )}

                {/* Success Banner */}
                {suggestSuccessFeedback && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{suggestSuccessFeedback}</span>
                  </div>
                )}

                {/* Suggested Goal Card (when hasGoal === true and not editing) */}
                {suggestedGoalResult && suggestedGoalResult.hasGoal && !isEditingSuggestedGoal && (
                  <AISuggestedGoal
                    id="modal-suggested-goal-card"
                    suggestion={{
                      title: suggestedGoalResult.title || 'Personal Milestone',
                      description: suggestedGoalResult.description,
                      reason: suggestedGoalResult.reason,
                      priority: suggestedGoalResult.priority,
                      howToAchieve: suggestedGoalResult.howToAchieve,
                      tasks: (suggestedGoalResult.tasks || []).map((t) => ({
                        title: t,
                        description: 'Actionable micro-step to advance this milestone.',
                        priority: suggestedGoalResult.priority || 'medium',
                      })),
                      sourceReflectionId: selectedJournalId,
                    }}
                    onAccept={handleAcceptSuggestedGoal}
                    onDismiss={() => setSuggestedGoalResult(null)}
                    onRegenerateTasks={handleRegenerateSugTasks}
                    isSaving={savingSuggestedGoal}
                    isRegenerating={isRegeneratingSugTasks}
                  />
                )}

                {/* Edit Suggested Goal Form */}
                {suggestedGoalResult && isEditingSuggestedGoal && (
                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
                    <h4 className="font-serif font-semibold text-stone-900 text-sm">
                      Customize Goal Before Saving
                    </h4>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-600 uppercase mb-1">
                          Goal Title
                        </label>
                        <input
                          type="text"
                          value={editSugTitle}
                          onChange={(e) => setEditSugTitle(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-stone-600 uppercase mb-1">
                          Description
                        </label>
                        <textarea
                          rows={2}
                          value={editSugDescription}
                          onChange={(e) => setEditSugDescription(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-stone-600 uppercase mb-1">
                          Priority
                        </label>
                        <select
                          value={editSugPriority}
                          onChange={(e) => setEditSugPriority(e.target.value as any)}
                          className="w-full px-3 py-1.5 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50 bg-white"
                        >
                          <option value="low">Low Priority</option>
                          <option value="medium">Medium Priority</option>
                          <option value="high">High Priority</option>
                        </select>
                      </div>

                      {/* How to achieve steps builder */}
                      <div className="space-y-1.5 pt-1">
                        <label className="block text-[11px] font-semibold text-stone-600 uppercase">
                          How to Achieve Steps ({editSugHowToAchieve.length})
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newSugStepInput}
                            onChange={(e) => setNewSugStepInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (newSugStepInput.trim()) {
                                  setEditSugHowToAchieve([...editSugHowToAchieve, newSugStepInput.trim()]);
                                  setNewSugStepInput('');
                                }
                              }
                            }}
                            placeholder="Add milestone/step (Enter)..."
                            className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (newSugStepInput.trim()) {
                                setEditSugHowToAchieve([...editSugHowToAchieve, newSugStepInput.trim()]);
                                setNewSugStepInput('');
                              }
                            }}
                            className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-medium cursor-pointer"
                          >
                            Add
                          </button>
                        </div>

                        <div className="space-y-1 max-h-28 overflow-y-auto pt-1">
                          {editSugHowToAchieve.map((s, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs bg-white px-2.5 py-1.5 rounded-lg border border-stone-200"
                            >
                              <span className="truncate flex-1">
                                <strong className="text-amber-700">{idx + 1}.</strong> {s}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditSugHowToAchieve(editSugHowToAchieve.filter((_, i) => i !== idx))
                                }
                                className="text-stone-400 hover:text-rose-600 font-bold ml-2 cursor-pointer"
                              >
                                &times;
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Micro-tasks builder */}
                      <div className="space-y-1.5 pt-1">
                        <label className="block text-[11px] font-semibold text-stone-600 uppercase">
                          Micro-tasks ({editSugTasks.length})
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newSugTaskInput}
                            onChange={(e) => setNewSugTaskInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (newSugTaskInput.trim()) {
                                  setEditSugTasks([...editSugTasks, newSugTaskInput.trim()]);
                                  setNewSugTaskInput('');
                                }
                              }
                            }}
                            placeholder="Add micro-task..."
                            className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (newSugTaskInput.trim()) {
                                setEditSugTasks([...editSugTasks, newSugTaskInput.trim()]);
                                setNewSugTaskInput('');
                              }
                            }}
                            className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-medium"
                          >
                            Add
                          </button>
                        </div>

                        <div className="space-y-1 max-h-32 overflow-y-auto pt-1">
                          {editSugTasks.map((t, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs bg-white px-2.5 py-1.5 rounded-lg border border-stone-200"
                            >
                              <span>{t}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditSugTasks(editSugTasks.filter((_, i) => i !== idx))
                                }
                                className="text-stone-400 hover:text-rose-600 font-bold ml-2"
                              >
                                &times;
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
                      <button
                        type="button"
                        onClick={() => setIsEditingSuggestedGoal(false)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-stone-600 hover:text-stone-800 bg-white border border-stone-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveCustomSuggestedGoal}
                        disabled={savingSuggestedGoal || !editSugTitle.trim()}
                        className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white transition disabled:opacity-50"
                      >
                        {savingSuggestedGoal ? 'Saving...' : 'Save Goal to Tracker'}
                      </button>
                    </div>
                  </div>
                )}

                {/* No Goal detected */}
                {suggestedGoalResult && !suggestedGoalResult.hasGoal && (
                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-600 space-y-2">
                    <p className="font-medium text-stone-800">
                      No actionable goal detected in this reflection.
                    </p>
                    <p className="text-stone-500">
                      {suggestedGoalResult.reason || 'This journal entry appears to be primarily emotional expression or contemplative processing rather than concrete future commitments.'}
                    </p>
                    <p className="text-stone-400 pt-1">
                      You can select a different reflection or create a goal manually using the "+ New Goal" button.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
