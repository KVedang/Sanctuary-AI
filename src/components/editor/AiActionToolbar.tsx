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
  ExternalLink,
  Target,
  Plus,
  Trash2,
  X,
  Compass,
  Eye,
  Brain,
  CheckCircle2
} from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { AiMode, StructuredReflection, GoalSuggestion, GoalTask } from '../../types';
import { sanitizePayload } from '../../lib/utils';

interface AiActionToolbarProps {
  title: string;
  content: string;
  journalId?: string;
  onApplySummary?: (summary: string) => void;
}

export const AiActionToolbar: React.FC<AiActionToolbarProps> = ({
  title,
  content,
  journalId,
  onApplySummary,
}) => {
  const { user } = useAuth();
  const { authenticatedFetch } = useApi();
  const [loadingMode, setLoadingMode] = useState<AiMode | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [structuredData, setStructuredData] = useState<StructuredReflection | null>(null);
  const [activeResultMode, setActiveResultMode] = useState<AiMode | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Goal Suggestion State
  const [activeSuggestion, setActiveSuggestion] = useState<GoalSuggestion | null>(null);
  const [goalAccepted, setGoalAccepted] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [isRegeneratingTasks, setIsRegeneratingTasks] = useState(false);
  const [goalFeedback, setGoalFeedback] = useState<string | null>(null);

  // Edit Goal Modal State
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [editHowToAchieve, setEditHowToAchieve] = useState<string[]>([]);
  const [newStepInput, setNewStepInput] = useState('');
  const [editTasks, setEditTasks] = useState<string[]>([]);
  const [newTaskInput, setNewTaskInput] = useState('');

  const actions: { id: AiMode; label: string; icon: any; isStructured?: boolean }[] = [
    { id: 'reflect', label: 'Reflect', icon: Sparkles, isStructured: true },
    { id: 'goal_generate', label: 'Generate Goal', icon: Target, isStructured: true },
    { id: 'goal_coach', label: 'Extract Goals', icon: ListChecks, isStructured: true },
    { id: 'summarize', label: 'Summarize', icon: FileText },
    { id: 'brainstorm', label: 'Brainstorm', icon: Lightbulb },
    { id: 'analytical', label: 'Analyze', icon: BarChart3 },
  ];

  const handleRunAi = async (mode: AiMode) => {
    if (!content || !content.trim()) {
      setError('Please write some reflection content first before invoking AI analysis.');
      return;
    }
    setError(null);
    setLoadingMode(mode);
    setAiResult(null);
    setStructuredData(null);
    setActiveSuggestion(null);
    setGoalAccepted(false);
    setGoalFeedback(null);
    setNotice(null);

    const isStructured = mode === 'reflect' || mode === 'goal_coach' || mode === 'goal_generate';

    try {
      const data = await authenticatedFetch('/api/ai/process', {
        method: 'POST',
        body: JSON.stringify({ 
          mode, 
          content, 
          title, 
          structured: isStructured 
        }),
      });

      setActiveResultMode(mode);
      setModelUsed(data.modelUsed || null);
      if (data.notice) {
        setNotice(data.notice);
      }

      if (mode === 'goal_generate') {
        if (data.data?.goal) {
          const g = data.data.goal;
          const tasks = (data.data.tasks || []).map((t: any) => 
            typeof t === 'string' 
              ? { title: t, description: 'Actionable micro-step to advance this milestone.', priority: g.priority || 'medium' }
              : { 
                  title: t.title || 'Micro-action', 
                  description: t.description || 'Actionable micro-step to advance this milestone.', 
                  priority: t.priority || g.priority || 'medium' 
                }
          );
          setActiveSuggestion({
            hasGoal: true,
            title: g.title,
            description: g.description,
            reason: g.reason,
            priority: g.priority || 'medium',
            howToAchieve: g.howToAchieve || [],
            tasks,
          });
        } else if (data.data && data.data.goal === null) {
          setActiveSuggestion({
            hasGoal: false,
            reason: data.data.reason || 'The reflection does not contain enough actionable information for a meaningful goal.',
          });
        } else if (data.goalSuggestion) {
          setActiveSuggestion(data.goalSuggestion);
        }
        return;
      }

      if (data.structuredData) {
        setStructuredData(data.structuredData);
        setAiResult(data.structuredData.summary || data.result);
        
        if (data.structuredData.goalSuggestion) {
          setActiveSuggestion(data.structuredData.goalSuggestion);
        } else if (data.structuredData.hasGoal !== undefined) {
          setActiveSuggestion(data.structuredData);
        } else if (data.goalSuggestion) {
          setActiveSuggestion(data.goalSuggestion);
        }
      } else if (data.goalSuggestion) {
        setActiveSuggestion(data.goalSuggestion);
      } else if (data.result) {
        setAiResult(data.result);
        if (mode === 'summarize' && onApplySummary) {
          onApplySummary(data.result);
        }
      }
    } catch (err: any) {
      const raw = String(err?.message || err || '');
      const clean = raw.includes('prepayment credits') || raw.includes('429')
        ? 'Google AI Studio prepayment credits are depleted. Reflection was safely provided via standby local engine.'
        : raw.replace(/All Gemini models in fallback ladder failed:\s*/i, '').trim();
      setError(clean || 'Failed to process AI request.');
    } finally {
      setLoadingMode(null);
    }
  };

  // 1. Accept Goal directly
  const handleAcceptGoal = async () => {
    if (!user || !activeSuggestion || goalAccepted || savingGoal) return;

    setSavingGoal(true);
    setGoalFeedback(null);

    try {
      const goalRef = doc(collection(db, 'users', user.uid, 'goals'));
      const tasksFormatted: GoalTask[] = (activeSuggestion.tasks || []).map((t, idx) => {
        const title = typeof t === 'string' ? t : t.title;
        const description = typeof t === 'string' ? '' : (t.description || '');
        const priority = typeof t === 'string' ? (activeSuggestion.priority || 'medium') : (t.priority || activeSuggestion.priority || 'medium');
        return {
          id: `task_${Date.now()}_${idx}`,
          title,
          description,
          priority,
          completed: false,
        };
      });

      const newGoal = {
        id: goalRef.id,
        userId: user.uid,
        title: activeSuggestion.title || 'Personal Milestone',
        description: activeSuggestion.description || activeSuggestion.reason || '',
        reason: activeSuggestion.reason || '',
        priority: activeSuggestion.priority || 'medium',
        status: 'in_progress',
        progress: 0,
        howToAchieve: activeSuggestion.howToAchieve || [],
        tasks: tasksFormatted,
        extractedFromJournalId: journalId || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(goalRef, sanitizePayload(newGoal));
      setGoalAccepted(true);
      setGoalFeedback('Goal, how-to-achieve plan, and tasks saved to your Goals tab! 🎉');
    } catch (err: any) {
      console.error('Error saving goal:', err);
      setGoalFeedback('Failed to save goal to Firestore. Please try again.');
    } finally {
      setSavingGoal(false);
    }
  };

  // 1b. Regenerate Tasks
  const handleRegenerateTasks = async () => {
    if (!activeSuggestion || isRegeneratingTasks) return;

    setIsRegeneratingTasks(true);
    try {
      const res = await authenticatedFetch('/api/ai/regenerate-tasks', {
        method: 'POST',
        body: JSON.stringify({
          goalTitle: activeSuggestion.title,
          goalDescription: activeSuggestion.description || activeSuggestion.reason,
          reflectionContext: content,
        }),
      });

      if (res.tasks && Array.isArray(res.tasks)) {
        setActiveSuggestion({
          ...activeSuggestion,
          tasks: res.tasks,
          howToAchieve: res.howToAchieve || activeSuggestion.howToAchieve,
        });
      }
    } catch (err: any) {
      console.error('Error regenerating tasks:', err);
    } finally {
      setIsRegeneratingTasks(false);
    }
  };

  // 2. Open Edit Goal Dialog
  const handleOpenEditGoal = () => {
    if (!activeSuggestion) return;
    setEditTitle(activeSuggestion.title || '');
    setEditDescription(activeSuggestion.description || activeSuggestion.reason || '');
    setEditPriority(activeSuggestion.priority || 'medium');
    setEditHowToAchieve(activeSuggestion.howToAchieve ? [...activeSuggestion.howToAchieve] : []);
    setEditTasks(activeSuggestion.tasks ? activeSuggestion.tasks.map(t => typeof t === 'string' ? t : t.title) : []);
    setIsEditingGoal(true);
  };

  // Save edited goal
  const handleSaveCustomGoal = async () => {
    if (!user || !editTitle.trim() || savingGoal) return;

    setSavingGoal(true);
    try {
      const goalRef = doc(collection(db, 'users', user.uid, 'goals'));
      const tasksFormatted: GoalTask[] = editTasks.map((t, idx) => ({
        id: `task_${Date.now()}_${idx}`,
        title: t,
        description: 'Actionable milestone micro-step.',
        priority: editPriority,
        completed: false,
      }));

      const customGoal = {
        id: goalRef.id,
        userId: user.uid,
        title: editTitle.trim(),
        description: editDescription.trim(),
        reason: activeSuggestion?.reason || '',
        priority: editPriority,
        status: 'in_progress',
        progress: 0,
        howToAchieve: editHowToAchieve,
        tasks: tasksFormatted,
        extractedFromJournalId: journalId || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(goalRef, sanitizePayload(customGoal));
      setIsEditingGoal(false);
      setGoalAccepted(true);
      setGoalFeedback('Customized goal saved to your Goals tab! 🎉');
    } catch (err: any) {
      console.error('Error saving custom goal:', err);
      setError('Could not save custom goal. Please try again.');
    } finally {
      setSavingGoal(false);
    }
  };

  // 3. Dismiss Goal
  const handleDismissGoal = () => {
    setActiveSuggestion(null);
  };

  const copyToClipboard = () => {
    if (!aiResult) return;
    navigator.clipboard.writeText(aiResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Action Buttons Bar */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-stone-100/90 rounded-xl border border-stone-200">
        <span className="text-xs font-semibold uppercase tracking-wider text-stone-600 px-2 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          AI Engine
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
                activeResultMode === act.id && (aiResult || structuredData)
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs font-semibold'
                  : 'bg-white text-stone-700 hover:bg-stone-50 border border-stone-200 shadow-2xs'
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

      {/* STRUCTURED REFLECTION VIEW (When structured data exists) */}
      {structuredData && (
        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-900">
                Multi-Dimensional Reflection Analysis
              </h4>
              {modelUsed && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">
                  {modelUsed}
                </span>
              )}
            </div>

            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 transition cursor-pointer px-2 py-1 rounded hover:bg-stone-100"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Core Summary */}
          {structuredData.summary && (
            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/60">
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wide block mb-1">
                Executive Synthesis
              </span>
              <p className="text-sm text-stone-800 leading-relaxed font-serif">
                {structuredData.summary}
              </p>
            </div>
          )}

          {/* 3-Way Epistemic Separation: Explicit vs Inferred vs Suggested */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Explicit Statements */}
            <div className="p-3.5 rounded-xl bg-sky-50/50 border border-sky-200/70 space-y-2">
              <div className="flex items-center gap-1.5 text-sky-900 font-semibold text-xs uppercase tracking-wider">
                <Eye className="w-3.5 h-3.5 text-sky-600" />
                <span>Explicit Statements</span>
              </div>
              <p className="text-[11px] text-sky-700/80 italic">What you directly recorded</p>
              <ul className="space-y-1.5 text-xs text-stone-800">
                {(structuredData.explicitStatements || []).map((st, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-sky-500 font-bold">•</span>
                    <span>"{st}"</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 2. Inferred Patterns */}
            <div className="p-3.5 rounded-xl bg-purple-50/50 border border-purple-200/70 space-y-2">
              <div className="flex items-center gap-1.5 text-purple-900 font-semibold text-xs uppercase tracking-wider">
                <Brain className="w-3.5 h-3.5 text-purple-600" />
                <span>Inferred Patterns</span>
              </div>
              <p className="text-[11px] text-purple-700/80 italic">Habits or underlying drivers</p>
              <ul className="space-y-1.5 text-xs text-stone-800">
                {(structuredData.inferredPatterns || []).map((pt, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-purple-500 font-bold">•</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 3. Suggested Perspectives */}
            <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/70 space-y-2">
              <div className="flex items-center gap-1.5 text-amber-900 font-semibold text-xs uppercase tracking-wider">
                <Compass className="w-3.5 h-3.5 text-amber-600" />
                <span>Suggested Reframes</span>
              </div>
              <p className="text-[11px] text-amber-700/80 italic">Constructive alternative angles</p>
              <ul className="space-y-1.5 text-xs text-stone-800">
                {(structuredData.suggestedPerspectives || []).map((sg, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>{sg}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Multi-dimensional themes and reflections */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
            {/* Themes & Emotions */}
            <div className="space-y-2 p-3 bg-stone-50/80 rounded-xl border border-stone-200/60">
              <span className="font-semibold text-stone-700 block">Themes & Emotions Identified:</span>
              <div className="flex flex-wrap gap-1.5">
                {(structuredData.themes || []).map((t, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded-full bg-white border border-stone-200 text-stone-700 text-[11px]">
                    #{t}
                  </span>
                ))}
                {(structuredData.emotions || []).map((e, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded-full bg-amber-100/70 text-amber-900 border border-amber-200 text-[11px]">
                    {e}
                  </span>
                ))}
              </div>
            </div>

            {/* Inquiries */}
            <div className="space-y-2 p-3 bg-stone-50/80 rounded-xl border border-stone-200/60">
              <span className="font-semibold text-stone-700 block">Socratic Reflection Inquiries:</span>
              <ul className="space-y-1 text-stone-700 italic">
                {(structuredData.inquiryQuestions || []).map((q, idx) => (
                  <li key={idx}>"{q}"</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* AI-SUGGESTED GOAL BOX (Visual Separation between AI Suggestion and User Decision) */}
      {activeSuggestion && (
        <div id="ai-suggested-goal-card" className="p-5 rounded-2xl bg-gradient-to-br from-amber-50/80 via-white to-orange-50/40 border-2 border-amber-300/80 shadow-sm relative space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-amber-200/60">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-amber-600" />
              <h4 className="text-sm font-bold text-amber-950 tracking-tight">
                AI Suggested Goal
              </h4>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900">
                {activeSuggestion.hasGoal ? `${activeSuggestion.priority || 'medium'} priority` : 'No Actionable Goal'}
              </span>
            </div>

            <button
              onClick={handleDismissGoal}
              className="text-stone-400 hover:text-stone-700 p-1 rounded-md transition cursor-pointer"
              title="Dismiss suggestion"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Goal Content */}
          {activeSuggestion.hasGoal ? (
            <div className="space-y-3">
              <div>
                <h5 className="text-base font-semibold text-stone-950 font-serif">
                  {activeSuggestion.title}
                </h5>
                {activeSuggestion.description && (
                  <p className="text-xs text-stone-600 mt-0.5">
                    {activeSuggestion.description}
                  </p>
                )}
              </div>

              {/* Why statement */}
              {activeSuggestion.reason && (
                <div className="p-3 rounded-xl bg-amber-100/60 border border-amber-200/70 text-xs text-amber-950 space-y-1">
                  <span className="font-bold block text-amber-900 uppercase tracking-wider text-[10px]">Why this goal</span>
                  <p className="leading-relaxed font-sans">{activeSuggestion.reason}</p>
                </div>
              )}

              {/* How to achieve it */}
              {activeSuggestion.howToAchieve && activeSuggestion.howToAchieve.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-xs font-semibold text-stone-800 block">
                    How to achieve it
                  </span>
                  <div className="space-y-1.5">
                    {activeSuggestion.howToAchieve.map((stepText, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-stone-700 bg-white/90 p-2.5 rounded-xl border border-amber-100">
                        <span className="text-amber-600 font-bold shrink-0">{idx + 1}.</span>
                        <span className="font-sans leading-snug">{stepText}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tasks preview */}
              {activeSuggestion.tasks && activeSuggestion.tasks.length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-semibold text-stone-800 block">
                    Suggested Tasks
                  </span>
                  <div className="space-y-2">
                    {activeSuggestion.tasks.map((taskItem, idx) => {
                      const taskTitle = typeof taskItem === 'string' ? taskItem : taskItem.title;
                      const taskDesc = typeof taskItem === 'string' ? '' : taskItem.description;
                      const taskPriority = typeof taskItem === 'string' 
                        ? (activeSuggestion.priority || 'medium') 
                        : (taskItem.priority || activeSuggestion.priority || 'medium');
                      return (
                        <div key={idx} className="p-3 rounded-xl bg-white/95 border border-amber-200/80 shadow-2xs space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2">
                              <span className="text-amber-500 font-mono text-sm leading-none mt-0.5">☐</span>
                              <span className="font-semibold text-stone-900 text-xs leading-snug">{taskTitle}</span>
                            </div>
                            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md shrink-0 border ${
                              taskPriority === 'high'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : taskPriority === 'low'
                                ? 'bg-stone-50 text-stone-600 border-stone-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                              {taskPriority}
                            </span>
                          </div>
                          {taskDesc && (
                            <p className="text-[11px] text-stone-600 pl-4 font-sans leading-relaxed">
                              {taskDesc}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* User Decision Feedback */}
              {goalFeedback && (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{goalFeedback}</span>
                </div>
              )}

              {/* User Decision Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-2.5">
                {!goalAccepted ? (
                  <>
                    <button
                      id="ai-accept-goal-btn"
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
                      id="ai-edit-goal-btn"
                      onClick={handleOpenEditGoal}
                      disabled={savingGoal}
                      className="px-4 py-2 rounded-xl bg-white hover:bg-stone-50 text-stone-800 text-xs font-semibold border border-stone-300 transition cursor-pointer shadow-2xs"
                    >
                      Edit Goal
                    </button>

                    <button
                      id="ai-regenerate-tasks-btn"
                      onClick={handleRegenerateTasks}
                      disabled={isRegeneratingTasks || savingGoal}
                      className="px-3 py-2 rounded-xl bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium border border-stone-200 transition cursor-pointer shadow-2xs flex items-center gap-1.5"
                    >
                      {isRegeneratingTasks ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-500" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      )}
                      <span>{isRegeneratingTasks ? 'Regenerating...' : 'Regenerate Tasks'}</span>
                    </button>

                    <button
                      id="ai-dismiss-goal-btn"
                      onClick={handleDismissGoal}
                      className="px-3 py-2 rounded-xl text-stone-500 hover:text-stone-800 text-xs font-medium transition cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Goal has been accepted and saved to your Goals tab!</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-stone-600 py-1 space-y-2">
              <p>
                No actionable goal was detected in this reflection. The entry appears to focus primarily on emotional expression or contemplation.
              </p>
              <p className="text-stone-400">
                You can always manually create a goal at any time in the <strong>Goals</strong> tab.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Standard Text Result (when not structured, e.g. Summarize, Brainstorm, Analyze) */}
      {!structuredData && aiResult && (
        <div className="p-5 rounded-2xl bg-amber-50/50 border border-amber-200/70 shadow-xs relative">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-amber-200/50">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-900">
                AI Reflection &bull; {activeResultMode}
              </span>
              {modelUsed && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-200 text-stone-700">
                  {modelUsed}
                </span>
              )}
            </div>

            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 transition cursor-pointer px-2 py-1 rounded hover:bg-amber-100/60"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="prose prose-stone prose-sm max-w-none text-stone-800 leading-relaxed whitespace-pre-wrap font-sans text-sm">
            {aiResult}
          </div>
        </div>
      )}

      {/* EDIT GOAL MODAL */}
      {isEditingGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-stone-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-500" />
                <h3 className="font-serif text-lg font-bold text-stone-900">
                  Customize Goal Before Accepting
                </h3>
              </div>
              <button
                onClick={() => setIsEditingGoal(false)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Title */}
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Goal Title:
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  placeholder="e.g. Build a consistent cloud-learning routine"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Description / Purpose:
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  placeholder="Why is this goal important?"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Priority:
                </label>
                <div className="flex items-center gap-2">
                  {(['low', 'medium', 'high'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEditPriority(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition cursor-pointer ${
                        editPriority === p
                          ? 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold'
                          : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* How to Achieve Steps List */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-semibold text-stone-700 block">
                  How to Achieve It (Plan Steps):
                </label>
                <div className="space-y-1.5">
                  {editHowToAchieve.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-stone-50 p-2 rounded-lg border border-stone-200">
                      <span className="text-amber-600 font-bold text-xs shrink-0">{idx + 1}.</span>
                      <input
                        type="text"
                        value={step}
                        onChange={(e) => {
                          const updated = [...editHowToAchieve];
                          updated[idx] = e.target.value;
                          setEditHowToAchieve(updated);
                        }}
                        className="flex-1 text-xs bg-transparent focus:outline-none text-stone-800"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setEditHowToAchieve(editHowToAchieve.filter((_, i) => i !== idx));
                        }}
                        className="text-stone-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add step input */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newStepInput}
                    onChange={(e) => setNewStepInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newStepInput.trim()) {
                          setEditHowToAchieve([...editHowToAchieve, newStepInput.trim()]);
                          setNewStepInput('');
                        }
                      }
                    }}
                    placeholder="Add step (e.g. Step 1: Dedicate 30 mins) (Enter)..."
                    className="flex-1 text-xs px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newStepInput.trim()) {
                        setEditHowToAchieve([...editHowToAchieve, newStepInput.trim()]);
                        setNewStepInput('');
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-medium cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tasks List */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-semibold text-stone-700 block">
                  Actionable Tasks:
                </label>
                <div className="space-y-1.5">
                  {editTasks.map((task, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-stone-50 p-2 rounded-lg border border-stone-200">
                      <input
                        type="text"
                        value={task}
                        onChange={(e) => {
                          const updated = [...editTasks];
                          updated[idx] = e.target.value;
                          setEditTasks(updated);
                        }}
                        className="flex-1 text-xs bg-transparent focus:outline-none text-stone-800"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setEditTasks(editTasks.filter((_, i) => i !== idx));
                        }}
                        className="text-stone-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add task input */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newTaskInput}
                    onChange={(e) => setNewTaskInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newTaskInput.trim()) {
                          setEditTasks([...editTasks, newTaskInput.trim()]);
                          setNewTaskInput('');
                        }
                      }
                    }}
                    placeholder="Add a new task (Enter)..."
                    className="flex-1 text-xs px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newTaskInput.trim()) {
                        setEditTasks([...editTasks, newTaskInput.trim()]);
                        setNewTaskInput('');
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-medium cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-stone-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingGoal(false)}
                className="px-4 py-2 rounded-xl text-stone-600 hover:text-stone-900 text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustomGoal}
                disabled={savingGoal || !editTitle.trim()}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingGoal ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Save Goal to Goals</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
