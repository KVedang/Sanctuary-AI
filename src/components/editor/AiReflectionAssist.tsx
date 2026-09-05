import React, { useState } from 'react';
import { 
  Sparkles, 
  Lightbulb, 
  ArrowRight, 
  Loader2, 
  Check, 
  RotateCcw, 
  X, 
  Edit3, 
  ChevronDown, 
  ChevronUp,
  HelpCircle,
  Shield,
  Send,
  PenSquare
} from 'lucide-react';
import { useApi } from '../../hooks/useApi';

interface QuestionAnswer {
  question: string;
  answer: string;
}

interface AiReflectionAssistProps {
  onApplyDraft: (title: string, content: string) => void;
  onOpenVoiceModal?: () => void;
}

export const AiReflectionAssist: React.FC<AiReflectionAssistProps> = ({
  onApplyDraft,
  onOpenVoiceModal,
}) => {
  const { authenticatedFetch } = useApi();
  const [isOpen, setIsOpen] = useState(true);
  const [thoughtInput, setThoughtInput] = useState('');
  const [isExploring, setIsExploring] = useState(false);
  const [exploreError, setExploreError] = useState<string | null>(null);

  // Exploration Questions State
  const [suggestedTitle, setSuggestedTitle] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<{ [index: number]: string }>({});

  // Drafting State
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [generatedDraft, setGeneratedDraft] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [editedDraftContent, setEditedDraftContent] = useState('');
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  // Step 1: Explore Thought
  const handleExploreThought = async (overrideThought?: string) => {
    const textToExplore = (overrideThought || thoughtInput).trim();
    if (!textToExplore) {
      setExploreError('Please type a short thought, sentence, or situation to explore.');
      return;
    }

    setExploreError(null);
    setIsExploring(true);
    setQuestions([]);
    setAnswers({});
    setGeneratedDraft(null);

    try {
      const res = await authenticatedFetch('/api/ai/explore-thought', {
        method: 'POST',
        body: JSON.stringify({ thought: textToExplore }),
      });

      if (res.questions && Array.isArray(res.questions)) {
        setQuestions(res.questions);
        if (res.suggestedTitle) {
          setSuggestedTitle(res.suggestedTitle);
        }
      } else {
        setExploreError('Could not generate reflection questions. You can continue writing manually.');
      }
    } catch (err: any) {
      console.error('Error exploring thought:', err);
      setExploreError(err?.message || 'Failed to explore thought. You can write freely in the editor.');
    } finally {
      setIsExploring(false);
    }
  };

  // Step 2: Draft Reflection based ONLY on user info
  const handleDraftReflection = async () => {
    if (!thoughtInput.trim() && Object.values(answers).every((a) => !String(a || '').trim())) {
      setDraftError('Please provide a thought or answer at least one question to draft your reflection.');
      return;
    }

    setDraftError(null);
    setIsDrafting(true);
    setAppliedSuccess(false);

    const qaList: QuestionAnswer[] = questions.map((q, idx) => ({
      question: q,
      answer: answers[idx] || '',
    })).filter(qa => qa.answer.trim().length > 0);

    try {
      const res = await authenticatedFetch('/api/ai/draft-reflection', {
        method: 'POST',
        body: JSON.stringify({
          thought: thoughtInput.trim(),
          questionsAndAnswers: qaList,
        }),
      });

      if (res.draftContent) {
        setGeneratedDraft(res.draftContent);
        setEditedDraftContent(res.draftContent);
        setDraftTitle(res.suggestedTitle || suggestedTitle || 'Reflections on Today');
      } else {
        setDraftError('Could not generate draft. You can continue writing manually.');
      }
    } catch (err: any) {
      console.error('Error drafting reflection:', err);
      setDraftError(err?.message || 'Drafting temporarily unavailable. Your notes are kept intact.');
    } finally {
      setIsDrafting(false);
    }
  };

  // Step 3: Use Draft
  const handleUseDraft = () => {
    const finalContent = isEditingDraft ? editedDraftContent : (generatedDraft || '');
    if (!finalContent.trim()) return;

    onApplyDraft(draftTitle || suggestedTitle || 'Reflections on Today', finalContent);
    setAppliedSuccess(true);
    setTimeout(() => {
      setAppliedSuccess(false);
      setGeneratedDraft(null);
      setIsEditingDraft(false);
    }, 1500);
  };

  // Discard draft
  const handleDiscardDraft = () => {
    setGeneratedDraft(null);
    setIsEditingDraft(false);
    setEditedDraftContent('');
  };

  const handleReset = () => {
    setThoughtInput('');
    setQuestions([]);
    setAnswers({});
    setGeneratedDraft(null);
    setIsEditingDraft(false);
    setExploreError(null);
    setDraftError(null);
  };

  return (
    <div className="rounded-2xl border border-amber-200/90 bg-linear-to-b from-amber-50/70 to-stone-50/50 p-5 sm:p-6 shadow-xs space-y-4">
      {/* Header Banner */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center shrink-0 shadow-2xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-serif font-semibold text-stone-900 text-sm flex items-center gap-2">
              <span>AI-Assisted Reflection Starter</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900 font-sans font-medium">
                Reflect → Understand
              </span>
            </h4>
            <p className="text-xs text-stone-600 font-sans mt-0.5">
              Start with a short thought, situation, or voice note. Gemini helps you explore and formulate your reflection.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-amber-100/60 transition cursor-pointer"
          title={isOpen ? 'Collapse helper' : 'Expand helper'}
        >
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isOpen && (
        <div className="space-y-4 pt-1">
          {/* Input Box for Short Thought */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-stone-700 block">
              What is on your mind right now?
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                id="reflection-thought-input"
                type="text"
                value={thoughtInput}
                onChange={(e) => setThoughtInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleExploreThought()}
                placeholder="e.g., 'I had a stressful day at work' or 'I keep putting off learning cloud tech'..."
                className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
              />

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  id="explore-thought-btn"
                  onClick={() => handleExploreThought()}
                  disabled={isExploring || !thoughtInput.trim()}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-medium transition cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  {isExploring ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  )}
                  <span>{isExploring ? 'Exploring...' : 'Explore Thought'}</span>
                </button>

                {onOpenVoiceModal && (
                  <button
                    type="button"
                    onClick={onOpenVoiceModal}
                    className="px-3 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium transition cursor-pointer"
                    title="Speak your thought"
                  >
                    🎤 Voice
                  </button>
                )}
              </div>
            </div>

            {/* Adaptive Prompt Starters */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-stone-500 font-medium mr-1">Suggested inquiries:</span>
              {[
                "What has been occupying your mind?",
                "What was the most challenging interaction today?",
                "What is a decision I've been wrestling with?",
                "Where did I find gratitude or unexpected calm?",
              ].map((starter, sIdx) => (
                <button
                  key={sIdx}
                  type="button"
                  onClick={() => {
                    setThoughtInput(starter);
                    handleExploreThought(starter);
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-white hover:bg-amber-100/70 text-stone-700 hover:text-stone-900 border border-stone-200 transition cursor-pointer shadow-2xs"
                >
                  {starter}
                </button>
              ))}
            </div>

            {exploreError && (
              <p className="text-xs text-rose-600 font-medium pt-1">
                {exploreError}
              </p>
            )}
          </div>

          {/* Adaptive Questions Generated by Gemini */}
          {questions.length > 0 && (
            <div className="rounded-xl border border-amber-200/80 bg-white p-4 space-y-3.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-semibold text-stone-900">
                    Adaptive Reflection Questions
                  </span>
                </div>
                <span className="text-[11px] text-stone-500 font-mono">
                  {questions.length} adaptive prompts
                </span>
              </div>

              <p className="text-xs text-stone-600 font-sans">
                Answer one or more questions below. Your answers will help formulate your reflection:
              </p>

              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <p className="text-xs font-medium text-stone-800 flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold shrink-0">{idx + 1}.</span>
                      <span>{q}</span>
                    </p>
                    <input
                      type="text"
                      value={answers[idx] || ''}
                      onChange={(e) => setAnswers({ ...answers, [idx]: e.target.value })}
                      placeholder="Your brief answer or thought..."
                      className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200 bg-stone-50/60 placeholder:text-stone-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                ))}
              </div>

              {/* Action Button: Help me turn this into a reflection */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100">
                <button
                  type="button"
                  id="draft-reflection-btn"
                  onClick={handleDraftReflection}
                  disabled={isDrafting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  {isDrafting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <PenSquare className="w-3.5 h-3.5 text-stone-950" />
                  )}
                  <span>{isDrafting ? 'Drafting from your words...' : 'Help me turn this into a reflection'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-stone-400 hover:text-stone-700 transition cursor-pointer"
                >
                  Start over
                </button>
              </div>

              {draftError && (
                <p className="text-xs text-rose-600 font-medium">
                  {draftError}
                </p>
              )}
            </div>
          )}

          {/* Generated AI Reflection Draft Card (Part 3 & 4) */}
          {generatedDraft && (
            <div className="rounded-xl border-2 border-amber-300 bg-amber-50/50 p-5 space-y-3.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between gap-2 border-b border-amber-200/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-amber-400 text-stone-950 flex items-center justify-center font-bold text-xs">
                    ✨
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                      AI Reflection Draft
                    </h5>
                    <p className="text-[11px] text-stone-600">
                      Grounded strictly in your words. Not saved until you click Save Entry.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsEditingDraft(!isEditingDraft)}
                    className="p-1 rounded-md text-stone-500 hover:text-stone-900 hover:bg-amber-100 transition cursor-pointer text-xs flex items-center gap-1"
                    title={isEditingDraft ? 'View formatted' : 'Edit text'}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isEditingDraft ? 'Done Editing' : 'Edit'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscardDraft}
                    className="p-1 rounded-md text-stone-400 hover:text-rose-600 transition cursor-pointer"
                    title="Discard draft"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Title Suggestion */}
              <div>
                <span className="text-[11px] text-stone-400 font-medium block">Suggested Title:</span>
                <span className="text-sm font-serif font-semibold text-stone-900">
                  {draftTitle}
                </span>
              </div>

              {/* Draft Content Preview or Editor */}
              {isEditingDraft ? (
                <textarea
                  value={editedDraftContent}
                  onChange={(e) => setEditedDraftContent(e.target.value)}
                  rows={6}
                  className="w-full text-xs sm:text-sm p-3 rounded-xl border border-amber-300 bg-white font-sans text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              ) : (
                <div className="p-3.5 rounded-xl bg-white/90 border border-amber-200/80 text-xs sm:text-sm text-stone-800 leading-relaxed font-sans whitespace-pre-wrap">
                  {generatedDraft}
                </div>
              )}

              {/* Draft Decision Buttons: [Use Draft] [Edit] [Regenerate] [Discard] */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="use-reflection-draft-btn"
                    onClick={handleUseDraft}
                    className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    {appliedSuccess ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 text-amber-300" />
                    )}
                    <span>{appliedSuccess ? 'Draft Transferred!' : 'Use Draft'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsEditingDraft(!isEditingDraft)}
                    className="px-3 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium transition cursor-pointer"
                  >
                    {isEditingDraft ? 'View' : 'Edit'}
                  </button>

                  <button
                    type="button"
                    onClick={handleDraftReflection}
                    disabled={isDrafting}
                    className="px-3 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium transition cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
                    <span>Regenerate</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  className="text-xs text-stone-400 hover:text-rose-600 transition cursor-pointer"
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          {/* Privacy & Authentic Voice Notice */}
          <div className="flex items-center gap-1.5 text-[11px] text-stone-500 pt-1">
            <Shield className="w-3 h-3 text-stone-400 shrink-0" />
            <span>
              Preserves your authentic voice. AI drafts are based strictly on what you write and are never automatically saved.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
