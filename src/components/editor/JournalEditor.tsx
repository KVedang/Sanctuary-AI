import React, { useState, useEffect } from 'react';
import { 
  Save, 
  Sparkles, 
  Mic, 
  Star, 
  Pin, 
  Archive, 
  Tag as TagIcon, 
  Smile, 
  Check, 
  ArrowLeft,
  Loader2,
  Trash2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { JournalEntry, MoodType } from '../../types';
import { sanitizePayload, countWords, parseFirestoreDate } from '../../lib/utils';
import { AiActionToolbar } from './AiActionToolbar';
import { VoiceRecorderModal } from './VoiceRecorder';

interface JournalEditorProps {
  initialEntry?: JournalEntry | null;
  onBack: () => void;
  onSaved: () => void;
}

const moods: { type: MoodType; label: string; icon: string }[] = [
  { type: 'great', label: 'Great', icon: '🌟' },
  { type: 'good', label: 'Good', icon: '😊' },
  { type: 'neutral', label: 'Neutral', icon: '😐' },
  { type: 'reflective', label: 'Reflective', icon: '🧘' },
  { type: 'difficult', label: 'Difficult', icon: '🌧️' },
];

export const JournalEditor: React.FC<JournalEditorProps> = ({
  initialEntry,
  onBack,
  onSaved,
}) => {
  const { user } = useAuth();
  const [title, setTitle] = useState(initialEntry?.title || '');
  const [content, setContent] = useState(initialEntry?.content || '');
  const [tags, setTags] = useState<string[]>(initialEntry?.tags || ['Reflection']);
  const [tagInput, setTagInput] = useState('');
  const [mood, setMood] = useState<MoodType | undefined>(initialEntry?.mood || 'reflective');
  const [isFavorite, setIsFavorite] = useState(initialEntry?.isFavorite || false);
  const [isPinned, setIsPinned] = useState(initialEntry?.isPinned || false);
  const [isArchived, setIsArchived] = useState(initialEntry?.isArchived || false);
  const [aiSummary, setAiSummary] = useState(initialEntry?.aiSummary || '');

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  const wordCount = countWords(content);

  const handleAddTag = () => {
    const trimmed = tagInput.trim().replace(/^#/, '');
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleVoiceConfirm = (transcribedText: string) => {
    setContent(prev => (prev ? `${prev}\n\n${transcribedText}` : transcribedText));
  };

  const handleSave = async () => {
    if (!user) return;
    if (!title.trim() && !content.trim()) {
      setSaveError('Please provide a title or content for your reflection.');
      return;
    }

    setSaving(true);
    setSaveError(null);

    const journalId = initialEntry?.id || `entry_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const entryData: JournalEntry = {
      id: journalId,
      userId: user.uid,
      title: title.trim() || 'Untitled Reflection',
      content: content.trim(),
      tags,
      mood,
      isFavorite,
      isPinned,
      isArchived,
      aiSummary: aiSummary || undefined,
      wordCount,
      createdAt: initialEntry?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    try {
      // Direct Firestore write strictly scoped to /users/{uid}/journals/{journalId}
      const entryRef = doc(db, 'users', user.uid, 'journals', journalId);
      await setDoc(entryRef, sanitizePayload({
        ...entryData,
        createdAt: parseFirestoreDate(initialEntry?.createdAt || nowIso),
        updatedAt: nowIso,
      }));

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      onSaved();
    } catch (err: any) {
      console.error('Failed to save journal entry to Firestore:', err);
      setSaveError(err?.message || 'Database write error. Your text is safely kept in the editor.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !initialEntry?.id) return;
    if (!window.confirm('Are you sure you want to delete this reflection permanently?')) return;

    try {
      const entryRef = doc(db, 'users', user.uid, 'journals', initialEntry.id);
      await deleteDoc(entryRef);
      onSaved();
      onBack();
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to delete journal entry.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      {/* Navigation & Controls Bar */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 transition cursor-pointer px-2.5 py-1.5 rounded-lg hover:bg-stone-100"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Archive</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Voice Input Trigger */}
          <button
            id="open-voice-modal-btn"
            onClick={() => setShowVoiceModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-100 text-xs font-medium transition cursor-pointer"
            title="Dictate with voice"
          >
            <Mic className="w-3.5 h-3.5 text-rose-500" />
            <span className="hidden sm:inline">Voice Input</span>
          </button>

          {/* Favorite Toggle */}
          <button
            onClick={() => setIsFavorite(!isFavorite)}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              isFavorite
                ? 'bg-amber-50 text-amber-600 border-amber-300'
                : 'border-stone-200 text-stone-400 hover:text-stone-600'
            }`}
            title={isFavorite ? 'Unmark Favorite' : 'Mark Favorite'}
          >
            <Star className="w-4 h-4 fill-current" />
          </button>

          {/* Pin Toggle */}
          <button
            onClick={() => setIsPinned(!isPinned)}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              isPinned
                ? 'bg-blue-50 text-blue-600 border-blue-300'
                : 'border-stone-200 text-stone-400 hover:text-stone-600'
            }`}
            title={isPinned ? 'Unpin' : 'Pin to top'}
          >
            <Pin className="w-4 h-4" />
          </button>

          {/* Archive Toggle */}
          <button
            onClick={() => setIsArchived(!isArchived)}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              isArchived
                ? 'bg-stone-200 text-stone-800 border-stone-400'
                : 'border-stone-200 text-stone-400 hover:text-stone-600'
            }`}
            title={isArchived ? 'Unarchive' : 'Archive Entry'}
          >
            <Archive className="w-4 h-4" />
          </button>

          {initialEntry && (
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 transition cursor-pointer"
              title="Delete Entry"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Save Button */}
          <button
            id="save-journal-btn"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 text-xs font-medium transition cursor-pointer shadow-xs disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
            ) : saveSuccess ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Save className="w-3.5 h-3.5 text-amber-300" />
            )}
            <span>{saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Entry'}</span>
          </button>
        </div>
      </div>

      {saveError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center justify-between">
          <span>{saveError}</span>
          <button onClick={handleSave} className="underline font-medium hover:text-rose-900">
            Retry
          </button>
        </div>
      )}

      {/* Editor Main Canvas */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-xs p-6 sm:p-8 space-y-6">
        {/* Title Field */}
        <input
          id="journal-title-input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title of this reflection..."
          className="w-full text-2xl sm:text-3xl font-serif font-semibold text-stone-950 placeholder:text-stone-300 focus:outline-none border-b border-stone-100 pb-3"
        />

        {/* Mood & Meta Selectors */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-stone-600 pt-1">
          {/* Mood picker */}
          <div className="flex items-center gap-1.5">
            <span className="text-stone-400 font-medium">Mood:</span>
            <div className="flex items-center gap-1">
              {moods.map((m) => (
                <button
                  key={m.type}
                  onClick={() => setMood(m.type)}
                  className={`px-2 py-1 rounded-md text-xs transition cursor-pointer flex items-center gap-1 ${
                    mood === m.type
                      ? 'bg-amber-100 text-amber-900 font-medium border border-amber-300'
                      : 'hover:bg-stone-100 text-stone-600'
                  }`}
                >
                  <span>{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="text-stone-400">
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </div>
        </div>

        {/* Content Textarea */}
        <textarea
          id="journal-content-input"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Begin writing your reflection, exploring your thoughts, or noting down what challenged you today..."
          rows={14}
          className="w-full text-stone-800 text-base leading-relaxed placeholder:text-stone-300 focus:outline-none resize-none font-sans"
        />

        {/* Tagging Section */}
        <div className="pt-4 border-t border-stone-100 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <TagIcon className="w-3.5 h-3.5 text-stone-400" />
            <span className="text-xs font-medium text-stone-500 mr-1">Tags:</span>
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-stone-100 text-stone-700 border border-stone-200"
              >
                #{t}
                <button
                  onClick={() => handleRemoveTag(t)}
                  className="text-stone-400 hover:text-stone-700 ml-0.5"
                >
                  &times;
                </button>
              </span>
            ))}

            <div className="inline-flex items-center gap-1">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Add tag (Enter)..."
                className="text-xs px-2 py-0.5 rounded border border-stone-200 focus:outline-none focus:ring-1 focus:ring-amber-400 w-28"
              />
              <button
                onClick={handleAddTag}
                className="text-xs px-2 py-0.5 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded transition cursor-pointer"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded AI Toolkit */}
      <AiActionToolbar
        title={title}
        content={content}
        onApplySummary={(sum) => setAiSummary(sum)}
      />

      {/* Voice Recorder Modal */}
      <VoiceRecorderModal
        isOpen={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onConfirmText={handleVoiceConfirm}
      />
    </div>
  );
};
