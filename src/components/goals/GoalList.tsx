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
  Sparkles
} from 'lucide-react';
import { Goal, GoalTask } from '../../types';
import { db } from '../../lib/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { sanitizePayload, formatDate } from '../../lib/utils';

interface GoalListProps {
  goals: Goal[];
  onRefresh: () => void;
}

export const GoalList: React.FC<GoalListProps> = ({ goals, onRefresh }) => {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [taskInput, setTaskInput] = useState('');
  const [tasks, setTasks] = useState<GoalTask[]>([]);
  const [saving, setSaving] = useState(false);

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
    if (!window.confirm('Delete this goal and its tasks?')) return;

    try {
      const goalRef = doc(db, 'users', user.uid, 'goals', goalId);
      await deleteDoc(goalRef);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete goal:', err);
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
            Convert reflective thoughts and journaling into structured action items with progress tracking.
          </p>
        </div>

        <button
          id="create-goal-modal-btn"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-stone-50 hover:bg-stone-800 rounded-xl text-xs font-medium transition cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-amber-300" />
          <span>New Goal</span>
        </button>
      </div>

      {/* Goal Cards Grid */}
      {goals.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-stone-200 text-center">
          <Target className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-stone-700">No active goals yet</p>
          <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
            You can add goals manually or ask Gemini in the Journal Editor to "Extract Goals" from your reflections.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 px-4 py-2 rounded-xl bg-stone-900 text-stone-50 text-xs font-medium hover:bg-stone-800 transition cursor-pointer"
          >
            Create Your First Goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {goals.map((goal) => (
            <div
              key={goal.id}
              className="p-6 rounded-2xl bg-white border border-stone-200/90 shadow-xs flex flex-col justify-between gap-5"
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

                  <button
                    onClick={() => handleDeleteGoal(goal.id)}
                    className="text-stone-400 hover:text-rose-600 p-1 transition cursor-pointer"
                    title="Delete Goal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
              </div>

              <div className="text-[11px] text-stone-400 font-mono pt-3 border-t border-stone-100">
                Created: {formatDate(goal.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Goal Modal */}
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
    </div>
  );
};
