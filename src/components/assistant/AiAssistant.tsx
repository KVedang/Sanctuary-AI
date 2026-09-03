import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  RotateCcw, 
  Copy, 
  Check, 
  BookOpen, 
  Target, 
  Loader2, 
  ShieldCheck, 
  HelpCircle,
  Compass,
  HeartHandshake,
  Lightbulb,
  ArrowUpRight
} from 'lucide-react';
import { JournalEntry, ChatMessage, Goal } from '../../types';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { sanitizePayload, formatDate, parseFirestoreDate } from '../../lib/utils';

interface AiAssistantProps {
  entries: JournalEntry[];
  onConvertToJournal: (title: string, content: string) => void;
  onGoalCreated?: (goal: Goal) => void;
}

type AssistantPersona = 'socratic' | 'empathy' | 'goal_coach' | 'brainstorm';

export const AiAssistant: React.FC<AiAssistantProps> = ({
  entries,
  onConvertToJournal,
  onGoalCreated,
}) => {
  const { user } = useAuth();
  const { authenticatedFetch } = useApi();

  const [persona, setPersona] = useState<AssistantPersona>('socratic');
  const [includeJournalContext, setIncludeJournalContext] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [lastAttemptedPrompt, setLastAttemptedPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedActionMsg, setSavedActionMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Load existing conversation on initial mount
  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    async function loadRecentMessages() {
      try {
        const msgsRef = collection(db, 'users', user!.uid, 'conversations', 'main_reflection_session', 'messages');
        const q = query(msgsRef, orderBy('createdAt', 'asc'), limit(30));
        const snapshot = await getDocs(q);

        if (!isMounted) return;
        if (!snapshot.empty) {
          const loaded: ChatMessage[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            loaded.push({
              id: docSnap.id,
              role: data.role,
              content: data.content,
              model: data.model || 'gemini-3.6-flash',
              createdAt: parseFirestoreDate(data.createdAt),
            });
          });
          setMessages(loaded);
        }
      } catch (err) {
        console.warn('Could not load prior messages:', err);
      }
    }

    loadRecentMessages();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const promptSuggestions = [
    {
      title: 'Daily Reflection & Unpacking',
      prompt: 'Help me reflect on today. Ask me 3 thoughtful questions to help me process how I felt and what I learned.',
      icon: Compass,
    },
    {
      title: 'Emotional Sounding Board',
      prompt: 'I feel a bit overwhelmed and conflicted right now. Can we talk through what is causing this stress in a calm space?',
      icon: HeartHandshake,
    },
    {
      title: 'Tough Decision & Trade-offs',
      prompt: 'I have an important decision to make. Act as a Socratic coach and help me examine my assumptions and trade-offs.',
      icon: Lightbulb,
    },
    {
      title: 'Transform Thoughts into Action',
      prompt: 'Review my recent ambitions and help me break them down into 3 concrete, low-friction steps for this week.',
      icon: Target,
    },
  ];

  const handleSend = async (overridePrompt?: string) => {
    const textToSend = overridePrompt || input;
    if (!textToSend.trim() || loading) return;

    const trimmedText = textToSend.trim();
    setError(null);
    setLastAttemptedPrompt(trimmedText);
    setInput('');

    const userMessageId = `msg_${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: trimmedText,
      model: 'user',
      createdAt: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setLoading(true);

    // Build recent journal context snippets if toggled on
    let journalContextStr = '';
    if (includeJournalContext && entries.length > 0) {
      const recent = entries.slice(0, 5);
      journalContextStr = recent
        .map(
          (e, idx) =>
            `[Entry #${idx + 1}] Date: ${e.createdAt.slice(0, 10)} | Title: "${e.title}"\nExcerpt: ${(e.content || '').slice(0, 400)}`
        )
        .join('\n\n');
    }

    try {
      // Save user message to Firestore subcollection
      if (user) {
        const userMsgDocRef = doc(db, 'users', user.uid, 'conversations', 'main_reflection_session', 'messages', userMessageId);
        await setDoc(userMsgDocRef, sanitizePayload({
          id: userMessage.id,
          role: userMessage.role,
          content: userMessage.content,
          model: userMessage.model,
          createdAt: userMessage.createdAt,
        }));
      }

      // Call backend AI chat endpoint
      const response = await authenticatedFetch('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          currentPrompt: trimmedText,
          mode: persona,
          journalContext: journalContextStr,
        }),
      });

      const assistantMessageId = `msg_${Date.now() + 1}`;
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'model',
        content: response.result || 'No response generated.',
        model: response.modelUsed || 'gemini-3.6-flash',
        createdAt: new Date().toISOString(),
      };

      setMessages([...newMessages, assistantMessage]);

      // Save assistant message to Firestore subcollection
      if (user) {
        const asstMsgDocRef = doc(db, 'users', user.uid, 'conversations', 'main_reflection_session', 'messages', assistantMessageId);
        await setDoc(asstMsgDocRef, sanitizePayload({
          id: assistantMessage.id,
          role: assistantMessage.role,
          content: assistantMessage.content,
          model: assistantMessage.model,
          createdAt: assistantMessage.createdAt,
        }));
      }
    } catch (err: any) {
      console.error('Failed to chat with AI Assistant:', err);
      setError(err?.message || 'Failed to reach AI assistant. Please check your network and retry.');
      // Restore input buffer so user never loses their drafted reflection
      setInput(trimmedText);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveAsJournal = (content: string) => {
    const title = `AI Reflection — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    onConvertToJournal(title, content);
    setSavedActionMsg('Opening reflection in Journal Editor...');
    setTimeout(() => setSavedActionMsg(null), 3000);
  };

  const handleSaveAsGoal = async (content: string) => {
    if (!user) return;
    try {
      const goalId = `goal_${Date.now()}`;
      const nowIso = new Date().toISOString();
      const firstLine = content.split('\n')[0].replace(/^#+\s*/, '').slice(0, 80) || 'Action from Reflection';

      const newGoal: Goal = {
        id: goalId,
        userId: user.uid,
        title: firstLine,
        description: content.slice(0, 300),
        priority: 'medium',
        status: 'in_progress',
        progress: 0,
        tasks: [
          {
            id: `task_${Date.now()}`,
            title: 'Complete key action steps from reflection',
            completed: false,
          },
        ],
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await setDoc(doc(db, 'users', user.uid, 'goals', goalId), sanitizePayload(newGoal));
      if (onGoalCreated) {
        onGoalCreated(newGoal);
      }
      setSavedActionMsg('Goal successfully added to your Actionable Goals!');
      setTimeout(() => setSavedActionMsg(null), 3000);
    } catch (err) {
      console.error('Failed to create goal:', err);
      setError('Could not save goal. Please check connection.');
    }
  };

  const handleClearSession = () => {
    if (confirm('Start a fresh conversation session? (Previous turns will remain safely in Firestore history)')) {
      setMessages([]);
      setError(null);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-5xl mx-auto px-4 sm:px-6 py-6 font-sans">
      {/* Top Header Card */}
      <div className="bg-white border border-stone-200/90 rounded-2xl p-4 sm:p-5 shadow-xs shrink-0 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-900 border border-amber-300/40 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif font-semibold text-lg text-stone-900">
                  Sanctuary AI Reflection Assistant
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3" />
                  Isolated Context
                </span>
              </div>
              <p className="text-xs text-stone-500">
                A confidential, intelligent partner for guided journaling, emotional processing, and goal clarity.
              </p>
            </div>
          </div>

          {/* Right Action: New Session */}
          <div className="flex items-center gap-2">
            <button
              id="assistant-clear-session-btn"
              onClick={handleClearSession}
              title="Start a fresh conversation"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>New Session</span>
            </button>
          </div>
        </div>

        {/* Persona Selector & Context Grounding Controls */}
        <div className="mt-4 pt-4 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-stone-400 font-medium mr-1">Persona:</span>
            {[
              { id: 'socratic', label: 'Socratic Coach', icon: Compass },
              { id: 'empathy', label: 'Empathetic Companion', icon: HeartHandshake },
              { id: 'goal_coach', label: 'Execution Coach', icon: Target },
              { id: 'brainstorm', label: 'Creative Brainstormer', icon: Lightbulb },
            ].map((p) => {
              const Icon = p.icon;
              const isActive = persona === p.id;
              return (
                <button
                  key={p.id}
                  id={`persona-btn-${p.id}`}
                  onClick={() => setPersona(p.id as AssistantPersona)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                    isActive
                      ? 'bg-amber-400 text-stone-950 shadow-xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-stone-600 select-none">
            <input
              type="checkbox"
              id="assistant-grounding-toggle"
              checked={includeJournalContext}
              onChange={(e) => setIncludeJournalContext(e.target.checked)}
              className="rounded border-stone-300 text-amber-500 focus:ring-amber-400"
            />
            <span className="text-xs">
              Ground with recent journal entries ({Math.min(entries.length, 5)} active)
            </span>
          </label>
        </div>
      </div>

      {/* Action Notification Toast */}
      {savedActionMsg && (
        <div className="mb-3 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-center gap-2 animate-fade-in">
          <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{savedActionMsg}</span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto bg-stone-50/50 border border-stone-200/80 rounded-2xl p-4 sm:p-6 space-y-4 shadow-inner">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-amber-100/60 text-amber-800 border border-amber-200/50 flex items-center justify-center mb-4">
              <Bot className="w-6 h-6 text-amber-700" />
            </div>
            <h2 className="font-serif font-semibold text-stone-900 text-base mb-1">
              How can I support your reflection today?
            </h2>
            <p className="text-xs text-stone-500 mb-6 leading-relaxed">
              Choose a reflective prompt below, or describe whatever is on your mind. Everything stays encrypted and isolated to your account.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
              {promptSuggestions.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    id={`assistant-suggestion-${idx}`}
                    onClick={() => handleSend(item.prompt)}
                    className="p-3 bg-white hover:bg-stone-50 border border-stone-200/90 rounded-xl transition text-xs group cursor-pointer hover:border-amber-300"
                  >
                    <div className="flex items-center gap-2 font-medium text-stone-800 mb-1">
                      <Icon className="w-3.5 h-3.5 text-amber-600" />
                      <span>{item.title}</span>
                    </div>
                    <p className="text-[11px] text-stone-500 line-clamp-2">
                      {item.prompt}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-900 border border-amber-300/30 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-amber-800" />
                  </div>
                )}

                <div
                  className={`max-w-2xl rounded-2xl p-4 sm:p-5 text-sm shadow-xs ${
                    isUser
                      ? 'bg-stone-900 text-stone-100 rounded-tr-xs'
                      : 'bg-white border border-stone-200 text-stone-800 rounded-tl-xs'
                  }`}
                >
                  {/* Header info */}
                  <div className="flex items-center justify-between gap-4 mb-2 pb-1 border-b border-stone-100/20 text-[11px]">
                    <span className="font-medium text-xs opacity-75">
                      {isUser ? 'You' : 'Sanctuary Assistant'}
                    </span>
                    <div className="flex items-center gap-2 opacity-60 font-mono text-[10px]">
                      {!isUser && (
                        <span className="px-1.5 py-0.2 bg-stone-100 text-stone-600 rounded">
                          {msg.model}
                        </span>
                      )}
                      <span>{formatDate(msg.createdAt)}</span>
                    </div>
                  </div>

                  {/* Message Body */}
                  <div className="whitespace-pre-wrap leading-relaxed space-y-2">
                    {msg.content}
                  </div>

                  {/* Assistant Message Actions */}
                  {!isUser && (
                    <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap items-center gap-2 text-xs">
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 transition cursor-pointer"
                        title="Copy message"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-stone-500" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleSaveAsJournal(msg.content)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition cursor-pointer"
                        title="Draft a journal entry from this response"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                        <span>Open in Editor</span>
                      </button>

                      <button
                        onClick={() => handleSaveAsGoal(msg.content)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 transition cursor-pointer"
                        title="Extract this as an actionable goal"
                      >
                        <Target className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Save as Goal</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Streaming / Loading state */}
        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-900 border border-amber-300/30 flex items-center justify-center shrink-0 mt-1">
              <Bot className="w-4 h-4 text-amber-800" />
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl rounded-tl-xs p-4 shadow-xs text-xs text-stone-600 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              <span>Sanctuary AI is synthesizing your reflection with Gemini...</span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div id="assistant-error-banner" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              id="assistant-error-retry-button"
              onClick={() => handleSend(lastAttemptedPrompt || input)}
              className="px-2.5 py-1 bg-rose-600 text-white rounded-md hover:bg-rose-700 transition cursor-pointer shrink-0 font-medium"
            >
              Retry
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer */}
      <div className="mt-4 shrink-0">
        <div className="bg-white border border-stone-200 rounded-2xl p-2.5 shadow-xs focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-100 transition">
          <textarea
            ref={inputRef}
            id="assistant-input-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Talk with your reflection assistant... (Press Enter to send, Shift+Enter for newline)"
            rows={2}
            className="w-full text-sm text-stone-900 placeholder:text-stone-400 resize-none outline-none px-2 py-1"
          />

          <div className="flex items-center justify-between pt-2 px-1 border-t border-stone-100 text-xs">
            <div className="flex items-center gap-2 text-stone-400">
              <span className="text-[11px]">
                {input.length > 0 ? `${input.length} chars` : 'Markdown supported'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="assistant-send-btn"
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                  !input.trim() || loading
                    ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                    : 'bg-amber-400 hover:bg-amber-300 text-stone-950 shadow-xs'
                }`}
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Send</span>
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] text-stone-400 mt-2">
          Sanctuary AI is a confidential reflection guide. Not a substitute for professional mental health counseling.
        </p>
      </div>
    </div>
  );
};
