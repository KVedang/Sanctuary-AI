import React, { useState } from 'react';
import { 
  Target, 
  Sparkles, 
  Check, 
  Edit3, 
  X, 
  Loader2, 
  RotateCw, 
  AlertCircle, 
  CheckCircle2, 
  Plus, 
  Trash2 
} from 'lucide-react';

export interface SuggestedGoalTaskItem {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface SuggestedGoalData {
  title: string;
  description?: string;
  reason?: string;
  priority?: 'low' | 'medium' | 'high';
  howToAchieve?: string[];
  tasks: Array<SuggestedGoalTaskItem | string>;
  sourceReflectionId?: string;
  sourceReflectionTitle?: string;
}

interface AISuggestedGoalProps {
  suggestion: SuggestedGoalData;
  onAccept: (customizedGoal?: SuggestedGoalData) => void | Promise<void>;
  onDismiss: () => void;
  onRegenerateTasks?: () => void | Promise<void>;
  isSaving?: boolean;
  isRegenerating?: boolean;
  feedbackMessage?: string | null;
  errorMessage?: string | null;
  className?: string;
  id?: string;
}

export const AISuggestedGoal: React.FC<AISuggestedGoalProps> = ({
  suggestion,
  onAccept,
  onDismiss,
  onRegenerateTasks,
  isSaving = false,
  isRegenerating = false,
  feedbackMessage,
  errorMessage,
  className = '',
  id = 'ai-suggested-goal-card',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(suggestion.title);
  const [editDescription, setEditDescription] = useState(suggestion.description || '');
  const [editReason, setEditReason] = useState(suggestion.reason || '');
  const [editPriority, setEditPriority] = useState<'low' | 'medium' | 'high'>(
    suggestion.priority || 'medium'
  );
  const [editTasks, setEditTasks] = useState<string[]>(
    (suggestion.tasks || []).map(t => (typeof t === 'string' ? t : t.title))
  );
  const [newTaskInput, setNewTaskInput] = useState('');

  // Normalize tasks for presentation
  const normalizedTasks: SuggestedGoalTaskItem[] = (suggestion.tasks || []).map((t, idx) => {
    if (typeof t === 'string') {
      return {
        title: t,
        description: `Micro-step ${idx + 1} to make immediate headway.`,
        priority: suggestion.priority || 'medium',
      };
    }
    return {
      title: t.title,
      description: t.description,
      priority: t.priority || suggestion.priority || 'medium',
    };
  });

  const handleSaveEdit = () => {
    if (!editTitle.trim()) return;
    const customized: SuggestedGoalData = {
      ...suggestion,
      title: editTitle.trim(),
      description: editDescription.trim(),
      reason: editReason.trim(),
      priority: editPriority,
      tasks: editTasks.map(title => ({
        title,
        description: `Actionable micro-step for ${editTitle.trim()}.`,
        priority: editPriority,
      })),
    };
    onAccept(customized);
  };

  const handleAddTask = () => {
    if (!newTaskInput.trim()) return;
    setEditTasks(prev => [...prev, newTaskInput.trim()]);
    setNewTaskInput('');
  };

  return (
    <div
      id={id}
      className={`p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-amber-50/80 via-white to-orange-50/40 border-2 border-amber-300/90 shadow-sm relative space-y-4 ${className}`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-amber-200/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-2xs">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-amber-950 font-serif tracking-tight">
                AI Suggested Goal
              </h4>
              <span
                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                  (suggestion.priority || 'medium') === 'high'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : (suggestion.priority || 'medium') === 'low'
                    ? 'bg-stone-50 text-stone-600 border-stone-200'
                    : 'bg-amber-100 text-amber-900 border-amber-200'
                }`}
              >
                PRIORITY: {suggestion.priority || 'medium'}
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              Formulated from your reflection. Confirm or adjust before adding to your tracker.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-amber-100/50 transition cursor-pointer"
          title="Dismiss suggestion"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content / Edit Mode Toggle */}
      {!isEditing ? (
        <div className="space-y-4">
          {/* GOAL & DESCRIPTION */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
              GOAL
            </span>
            <h5 className="text-base font-semibold text-stone-950 font-serif">
              {suggestion.title}
            </h5>
            {suggestion.description && (
              <div className="mt-1">
                <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block">
                  DESCRIPTION
                </span>
                <p className="text-xs text-stone-600 font-sans leading-relaxed">
                  {suggestion.description}
                </p>
              </div>
            )}
          </div>

          {/* WHY THIS GOAL */}
          <div className="p-3.5 rounded-xl bg-amber-100/60 border border-amber-200/70 text-xs text-amber-950 space-y-1">
            <span className="font-bold block text-amber-900 uppercase tracking-wider text-[10px]">
              Why this goal
            </span>
            <p className="leading-relaxed font-sans">
              {suggestion.reason || 'Synthesized directly from your latest reflection to overcome emotional friction and build forward momentum.'}
            </p>
          </div>

          {/* HOW TO ACHIEVE IT */}
          <div className="space-y-2 pt-1">
            <span className="text-xs font-semibold text-stone-800 block uppercase tracking-wider text-[11px]">
              How to achieve it
            </span>
            <div className="space-y-1.5">
              {(suggestion.howToAchieve && suggestion.howToAchieve.length > 0
                ? suggestion.howToAchieve
                : [
                    'Establish a dedicated 20-minute daily focus routine.',
                    'Log micro-progress after every session to stay accountable.',
                    'Review and iterate with your AI Goal Coach weekly.'
                  ]
              ).map((stepText, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 text-xs text-stone-700 bg-white/90 p-2.5 rounded-xl border border-amber-100 shadow-2xs"
                >
                  <span className="text-amber-600 font-bold shrink-0 font-mono text-[11px]">
                    Step {idx + 1}:
                  </span>
                  <span className="font-sans leading-relaxed">{stepText}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SUGGESTED TASKS */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-stone-800 block uppercase tracking-wider text-[11px]">
                Suggested Tasks
              </span>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full">
                {normalizedTasks.length > 0 ? normalizedTasks.length : 3}
              </span>
            </div>
            <div className="space-y-2">
              {(normalizedTasks.length > 0
                ? normalizedTasks
                : [
                    { title: 'Define specific milestones for this week', description: 'Break down larger outcomes into verifiable outputs.', priority: 'high' as const },
                    { title: 'Block dedicated reflection time', description: 'Reserve 15 minutes each morning or evening.', priority: 'medium' as const },
                    { title: 'Track and check off first completed step', description: 'Verify progress on your active goal dashboard.', priority: 'medium' as const }
                  ]
              ).map((taskItem, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-white/95 border border-amber-200/80 shadow-2xs space-y-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <span className="text-amber-500 font-mono text-xs font-bold leading-none mt-0.5">
                        Task {idx + 1}:
                      </span>
                      <span className="font-semibold text-stone-900 text-xs leading-snug">
                        {taskItem.title}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md shrink-0 border ${
                        taskItem.priority === 'high'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : taskItem.priority === 'low'
                          ? 'bg-stone-50 text-stone-600 border-stone-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {taskItem.priority}
                    </span>
                  </div>
                  {taskItem.description && (
                    <p className="text-[11px] text-stone-600 pl-4 font-sans leading-relaxed">
                      {taskItem.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Feedback & Error states */}
          {feedbackMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{feedbackMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* User Decision Action Buttons */}
          <div className="pt-2 flex flex-wrap items-center gap-2.5 border-t border-amber-100">
            <button
              type="button"
              id="accept-goal-btn"
              onClick={() => onAccept()}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Accept Goal</span>
            </button>

            <button
              type="button"
              id="edit-goal-btn"
              onClick={() => setIsEditing(true)}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-white hover:bg-stone-50 text-stone-800 text-xs font-semibold border border-stone-300 transition cursor-pointer shadow-2xs flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5 text-stone-500" />
              <span>Edit Goal</span>
            </button>

            {onRegenerateTasks && (
              <button
                type="button"
                id="regenerate-tasks-btn"
                onClick={() => onRegenerateTasks()}
                disabled={isRegenerating || isSaving}
                className="px-3 py-2 rounded-xl bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium border border-stone-200 transition cursor-pointer shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {isRegenerating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-500" />
                ) : (
                  <RotateCw className="w-3.5 h-3.5 text-amber-600" />
                )}
                <span>Regenerate Tasks</span>
              </button>
            )}

            <button
              type="button"
              id="dismiss-goal-btn"
              onClick={onDismiss}
              disabled={isSaving}
              className="px-3 py-2 rounded-xl text-stone-500 hover:text-stone-800 text-xs font-medium transition cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : (
        /* Edit Mode Form */
        <div className="space-y-4 bg-white/95 p-4 rounded-xl border border-amber-200">
          <div className="flex items-center justify-between border-b border-stone-200 pb-2">
            <h5 className="font-serif font-semibold text-stone-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5 text-amber-600" />
              <span>Customize Suggested Goal</span>
            </h5>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-stone-400 hover:text-stone-700 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <label className="text-[11px] font-medium text-stone-600 block mb-1 uppercase tracking-wider">
              Goal Title
            </label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-serif"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-stone-600 block mb-1 uppercase tracking-wider">
              Why this goal / Motivation
            </label>
            <input
              type="text"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-stone-600 block mb-1 uppercase tracking-wider">
              Goal Description
            </label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={2}
              className="w-full text-xs p-2.5 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-[11px] font-medium text-stone-600 uppercase tracking-wider">
              Priority:
            </label>
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
            <label className="text-[11px] font-medium text-stone-600 block mb-1 uppercase tracking-wider">
              Tasks ({editTasks.length})
            </label>
            <div className="space-y-1.5 mb-2">
              {editTasks.map((taskText, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-stone-50 p-2 rounded-lg border border-stone-200">
                  <span className="text-amber-600 font-mono text-[11px] font-bold shrink-0">{idx + 1}.</span>
                  <span className="text-xs text-stone-800 flex-1">{taskText}</span>
                  <button
                    type="button"
                    onClick={() => setEditTasks(prev => prev.filter((_, i) => i !== idx))}
                    className="text-stone-400 hover:text-rose-600 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
                    handleAddTask();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddTask}
                className="px-3 py-2 rounded-lg bg-stone-900 text-white text-xs font-medium cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-3 border-t border-stone-200">
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={isSaving || !editTitle.trim()}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Accept Goal</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3 py-2 rounded-xl text-stone-600 text-xs font-medium hover:text-stone-900 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
