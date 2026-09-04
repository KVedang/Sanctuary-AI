import { Router, Request, Response } from 'express';
import { 
  generateWithFallback, 
  isCreditDepletionError, 
  extractCleanErrorMessage,
  safeJsonParse 
} from '../gemini/fallbackLadder';
import { 
  getPromptForMode, 
  SYSTEM_BASE_SECURITY,
  SYSTEM_GOAL_EXTRACTION,
  SYSTEM_ASK_JOURNAL,
  SYSTEM_SOCRATIC_GUIDE,
  SYSTEM_COMPASSIONATE_EMPATH,
  SYSTEM_EXECUTION_COACH,
  SYSTEM_GOAL_PROGRESS_COACHING,
  SYSTEM_PERIODIC_REVIEW,
  SYSTEM_REFLECTION_EXPLORER,
  SYSTEM_REFLECTION_DRAFTER,
  SYSTEM_TASK_REGENERATION
} from '../gemini/prompts';
import { 
  synthesizeAskJournal, 
  generateLocalProcess, 
  generateLocalStructuredReflection,
  generateLocalGoalSuggestion,
  generateLocalGoalCoaching,
  generateLocalChatResponse, 
  generateLocalDigest,
  generateLocalThoughtExplorer,
  generateLocalReflectionDraft,
  generateLocalTaskRegeneration,
  formatDateDisplay
} from '../gemini/localFallbackEngine';

export const aiRouter = Router();

/**
 * AI Service status & health check endpoint
 */
aiRouter.get('/status', async (_req: Request, res: Response): Promise<void> => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    primaryModel: 'gemini-3.6-flash',
    fallbackLadder: ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.7-flash', 'gemini-3.8-flash'],
    localFallbackReady: true,
  });
});

/**
 * Single-shot AI reflection, summary, brainstorming, or goal extraction
 * Supports both structured JSON responses and clean Markdown output.
 */
aiRouter.post('/process', async (req: Request, res: Response): Promise<void> => {
  const { mode, content, title, structured } = (req.body && typeof req.body === 'object') ? req.body : {} as any;

  if (!content || typeof content !== 'string' || !content.trim()) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Journal content is required.' });
    return;
  }

  if (content.length > 50000) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Content exceeds safe 50,000 character limit.' });
    return;
  }

  const isStructuredRequested = structured === true || mode === 'reflect_deep' || mode === 'goal_extract';

  try {
    const { prompt, systemInstruction, isJson } = getPromptForMode(mode || 'reflect', content, title);
    
    const options: any = { systemInstruction };
    if (isJson || isStructuredRequested) {
      options.responseMimeType = 'application/json';
    }

    const result = await generateWithFallback(prompt, options);

    if (isJson || isStructuredRequested) {
      const parsed = safeJsonParse(result.text);
      if (parsed && typeof parsed === 'object') {
        const goalSuggestion = parsed.goalSuggestion || (parsed.hasGoal !== undefined ? parsed : undefined);
        const structuredResponse: any = {
          ...parsed,
        };
        if (goalSuggestion) {
          structuredResponse.goalSuggestion = goalSuggestion;
        }

        res.json({
          success: true,
          result: parsed.summary || (goalSuggestion?.hasGoal ? `Goal Suggested: ${goalSuggestion.title}` : result.text),
          structuredData: structuredResponse,
          goalSuggestion: goalSuggestion,
          modelUsed: result.modelUsed,
          mode: mode || 'reflect',
          isLocalFallback: false,
        });
        return;
      }
    }

    res.json({
      success: true,
      result: result.text,
      modelUsed: result.modelUsed,
      mode: mode || 'reflect',
      isLocalFallback: false,
    });
  } catch (err: any) {
    console.warn('[AiProcess] Live Gemini model unavailable. Activating Local Reflection Engine:', extractCleanErrorMessage(err));
    const creditsDepleted = isCreditDepletionError(err);

    if (isStructuredRequested || mode === 'reflect' || mode === 'reflect_deep' || mode === 'goal_extract' || mode === 'goal_coach') {
      const structuredData = generateLocalStructuredReflection(content, title);
      res.json({
        success: true,
        result: structuredData.summary,
        structuredData,
        goalSuggestion: structuredData.goalSuggestion,
        modelUsed: 'Sanctuary Local Reflection Engine (Standby Mode)',
        mode: mode || 'reflect',
        isLocalFallback: true,
        creditDepleted: creditsDepleted,
        notice: creditsDepleted
          ? 'Google AI Studio prepayment credits are depleted. Reflection generated seamlessly via local reflection engine.'
          : 'Generated via local standby reflection engine.',
      });
      return;
    }

    const localResult = generateLocalProcess(mode || 'reflect', content, title);
    res.json({
      success: true,
      result: localResult,
      modelUsed: 'Sanctuary Local Reflection Engine (Standby Mode)',
      mode: mode || 'reflect',
      isLocalFallback: true,
      creditDepleted: creditsDepleted,
      notice: creditsDepleted
        ? 'Google AI Studio prepayment credits are depleted. Reflection generated seamlessly via local reflection engine.'
        : 'Generated via local standby reflection engine.',
    });
  }
});

/**
 * Dedicated AI Goal & Task Suggestion endpoint
 * Analyzes a journal reflection and extracts at most ONE actionable goal with 3-5 concrete tasks.
 * Pure recommendation: Does NOT persist or mutate user database without user confirmation.
 */
aiRouter.post('/suggest-goal', async (req: Request, res: Response): Promise<void> => {
  const { content, title } = (req.body && typeof req.body === 'object') ? req.body : {} as any;

  if (!content || typeof content !== 'string' || !content.trim()) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Reflection content is required for goal extraction.' });
    return;
  }

  if (content.length > 50000) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Content exceeds safe 50,000 character limit.' });
    return;
  }

  const header = title ? `Journal Title: "${title}"\n\n` : '';
  const prompt = `Analyze this journal reflection and determine if an actionable goal exists. If so, formulate ONE best goal with 3-5 concrete tasks according to your JSON schema:\n\n${header}Journal Content:\n"""\n${content.trim()}\n"""`;

  try {
    const result = await generateWithFallback(prompt, {
      systemInstruction: SYSTEM_GOAL_EXTRACTION,
      responseMimeType: 'application/json',
    });

    const parsed = safeJsonParse(result.text);
    if (parsed && typeof parsed === 'object') {
      const hasGoal = Boolean(parsed.hasGoal);
      const cleanedSuggestion = {
        hasGoal,
        title: hasGoal ? String(parsed.title || 'Actionable Milestone').trim() : undefined,
        description: hasGoal ? String(parsed.description || '').trim() : undefined,
        reason: String(parsed.reason || '').trim(),
        priority: (['low', 'medium', 'high'].includes(parsed.priority) ? parsed.priority : 'medium') as 'low' | 'medium' | 'high',
        howToAchieve: hasGoal && Array.isArray(parsed.howToAchieve)
          ? parsed.howToAchieve.map((s: any) => String(s || '').trim()).filter((s: string) => s.length > 0).slice(0, 5)
          : undefined,
        tasks: hasGoal && Array.isArray(parsed.tasks) 
          ? parsed.tasks.map((t: any) => String(t || '').trim()).filter((t: string) => t.length > 0).slice(0, 5)
          : [],
      };

      res.json({
        success: true,
        goalSuggestion: cleanedSuggestion,
        modelUsed: result.modelUsed,
        isLocalFallback: false,
      });
      return;
    }

    // JSON parsing fallback
    const localSuggestion = generateLocalGoalSuggestion(content, title);
    res.json({
      success: true,
      goalSuggestion: localSuggestion,
      modelUsed: result.modelUsed,
      isLocalFallback: false,
    });
  } catch (err: any) {
    console.warn('[SuggestGoal] Live Gemini model unavailable. Activating Local Goal Engine:', extractCleanErrorMessage(err));
    const creditsDepleted = isCreditDepletionError(err);
    const localSuggestion = generateLocalGoalSuggestion(content, title);

    res.json({
      success: true,
      goalSuggestion: localSuggestion,
      modelUsed: 'Sanctuary Local Goal Engine (Standby Mode)',
      isLocalFallback: true,
      creditDepleted: creditsDepleted,
      notice: creditsDepleted
        ? 'Goal recommendation synthesized via local engine (Google AI Studio prepayment credits depleted).'
        : undefined,
    });
  }
});

/**
 * AI-Assisted Reflection Explorer Endpoint (Part 2)
 * Takes a short thought, sentence, topic, or voice input and generates 4-6 adaptive reflection questions.
 */
aiRouter.post('/explore-thought', async (req: Request, res: Response): Promise<void> => {
  const { thought } = (req.body && typeof req.body === 'object') ? req.body : {} as any;

  if (!thought || typeof thought !== 'string' || !thought.trim()) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Initial thought or topic is required.' });
    return;
  }

  if (thought.length > 5000) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Initial thought exceeds safe limit.' });
    return;
  }

  const prompt = `The user shared this initial thought/situation for reflection:\n"""\n${thought.trim()}\n"""\n\nPlease generate adaptive, insightful reflection questions to help them explore and unpack this thought according to your JSON schema.`;

  try {
    const result = await generateWithFallback(prompt, {
      systemInstruction: SYSTEM_REFLECTION_EXPLORER,
      responseMimeType: 'application/json',
    });

    const parsed = safeJsonParse(result.text);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.questions)) {
      res.json({
        success: true,
        suggestedTitle: String(parsed.suggestedTitle || 'Reflections on Today').trim(),
        thoughtSummary: String(parsed.thoughtSummary || thought).trim(),
        questions: parsed.questions.map((q: any) => String(q || '').trim()).filter(Boolean),
        modelUsed: result.modelUsed,
        isLocalFallback: false,
      });
      return;
    }

    const localData = generateLocalThoughtExplorer(thought);
    res.json({
      success: true,
      ...localData,
      modelUsed: result.modelUsed,
      isLocalFallback: false,
    });
  } catch (err: any) {
    console.warn('[ExploreThought] Live Gemini model unavailable. Activating Local Explorer:', extractCleanErrorMessage(err));
    const creditsDepleted = isCreditDepletionError(err);
    const localData = generateLocalThoughtExplorer(thought);

    res.json({
      success: true,
      ...localData,
      modelUsed: 'Sanctuary Local Reflection Engine (Standby Mode)',
      isLocalFallback: true,
      creditDepleted: creditsDepleted,
      notice: creditsDepleted
        ? 'Reflection exploration synthesized via local standby engine.'
        : undefined,
    });
  }
});

/**
 * AI Reflection Drafter Endpoint (Part 3 & 4)
 * "Help me turn this into a reflection."
 * Drafts a first-person reflection based ONLY on user-provided information.
 * Strictly preserves user voice; never invents events, people, feelings, or facts.
 */
aiRouter.post('/draft-reflection', async (req: Request, res: Response): Promise<void> => {
  const { thought, notes, questionsAndAnswers } = (req.body && typeof req.body === 'object') ? req.body : {} as any;

  if (!thought && !notes && (!Array.isArray(questionsAndAnswers) || questionsAndAnswers.length === 0)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Thought, notes, or answers are required to draft a reflection.' });
    return;
  }

  let userContext = `Initial thought: "${thought || ''}"\n`;
  if (notes) {
    userContext += `Additional notes/context: "${notes}"\n`;
  }
  if (Array.isArray(questionsAndAnswers) && questionsAndAnswers.length > 0) {
    userContext += `Answers to reflection questions:\n`;
    questionsAndAnswers.forEach((qa: any) => {
      if (qa && qa.answer && qa.answer.trim()) {
        userContext += `- Q: ${qa.question || 'Reflection point'}\n  A: ${qa.answer.trim()}\n`;
      }
    });
  }

  const prompt = `The user requests: "Help me turn this into a reflection."\n\nUser Input Data:\n"""\n${userContext.trim()}\n"""\n\nGenerate an authentic first-person reflection draft based ONLY on the above information provided by the user. Do not invent facts, people, or events. Return valid JSON matching your schema.`;

  try {
    const result = await generateWithFallback(prompt, {
      systemInstruction: SYSTEM_REFLECTION_DRAFTER,
      responseMimeType: 'application/json',
    });

    const parsed = safeJsonParse(result.text);
    if (parsed && typeof parsed === 'object' && parsed.draftContent) {
      res.json({
        success: true,
        suggestedTitle: String(parsed.suggestedTitle || 'Reflections on Today').trim(),
        draftContent: String(parsed.draftContent).trim(),
        wordCount: typeof parsed.wordCount === 'number' ? parsed.wordCount : parsed.draftContent.split(/\s+/).length,
        detectedThemes: Array.isArray(parsed.detectedThemes) ? parsed.detectedThemes : [],
        modelUsed: result.modelUsed,
        isLocalFallback: false,
      });
      return;
    }

    const localDraft = generateLocalReflectionDraft(thought, notes);
    res.json({
      success: true,
      ...localDraft,
      modelUsed: result.modelUsed,
      isLocalFallback: false,
    });
  } catch (err: any) {
    console.warn('[DraftReflection] Live Gemini model unavailable. Activating Local Drafter:', extractCleanErrorMessage(err));
    const creditsDepleted = isCreditDepletionError(err);
    const localDraft = generateLocalReflectionDraft(thought, notes);

    res.json({
      success: true,
      ...localDraft,
      modelUsed: 'Sanctuary Local Reflection Engine (Standby Mode)',
      isLocalFallback: true,
      creditDepleted: creditsDepleted,
      notice: creditsDepleted
        ? 'Reflection draft created via local standby engine.'
        : undefined,
    });
  }
});

/**
 * AI Task Regeneration Endpoint (Part 11)
 * Generates an alternative set of practical tasks and how-to-achieve steps for an existing or suggested goal.
 */
aiRouter.post('/regenerate-tasks', async (req: Request, res: Response): Promise<void> => {
  const { goalTitle, goalDescription, reflectionContext } = (req.body && typeof req.body === 'object') ? req.body : {} as any;

  if (!goalTitle || typeof goalTitle !== 'string' || !goalTitle.trim()) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Goal title is required for task regeneration.' });
    return;
  }

  const prompt = `Goal Title: "${goalTitle.trim()}"
Description: "${goalDescription || ''}"
${reflectionContext ? `Reflection Context:\n"""\n${reflectionContext.trim()}\n"""\n` : ''}

Generate a fresh, practical set of 3-5 achievable micro-tasks and how-to-achieve steps for this goal. Return valid JSON.`;

  try {
    const result = await generateWithFallback(prompt, {
      systemInstruction: SYSTEM_TASK_REGENERATION,
      responseMimeType: 'application/json',
    });

    const parsed = safeJsonParse(result.text);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.tasks)) {
      res.json({
        success: true,
        howToAchieve: Array.isArray(parsed.howToAchieve) ? parsed.howToAchieve.map((s: any) => String(s).trim()).filter(Boolean) : [],
        tasks: parsed.tasks.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 5),
        modelUsed: result.modelUsed,
        isLocalFallback: false,
      });
      return;
    }

    const localTasks = generateLocalTaskRegeneration(goalTitle, goalDescription);
    res.json({
      success: true,
      ...localTasks,
      modelUsed: result.modelUsed,
      isLocalFallback: false,
    });
  } catch (err: any) {
    console.warn('[RegenerateTasks] Live Gemini model unavailable. Activating Local Task Engine:', extractCleanErrorMessage(err));
    const creditsDepleted = isCreditDepletionError(err);
    const localTasks = generateLocalTaskRegeneration(goalTitle, goalDescription);

    res.json({
      success: true,
      ...localTasks,
      modelUsed: 'Sanctuary Local Task Engine (Standby Mode)',
      isLocalFallback: true,
      creditDepleted: creditsDepleted,
      notice: creditsDepleted
        ? 'Alternative tasks generated via local engine.'
        : undefined,
    });
  }
});

/**
 * AI Goal Progress Coaching endpoint
 * Reviews active progress, identifies obstacles, and suggests next micro-actions.
 */
aiRouter.post('/goal-coach', async (req: Request, res: Response): Promise<void> => {
  const { goal } = (req.body && typeof req.body === 'object') ? req.body : {} as any;

  if (!goal || typeof goal !== 'object' || !goal.title) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Valid goal object is required.' });
    return;
  }

  try {
    const tasks = Array.isArray(goal.tasks) ? goal.tasks : [];
    const completedTasks = tasks.filter((t: any) => t.completed).map((t: any) => `- [x] ${t.title}`).join('\n');
    const remainingTasks = tasks.filter((t: any) => !t.completed).map((t: any) => `- [ ] ${t.title}`).join('\n');

    const prompt = `Please review and provide progress coaching for this active goal:
Goal Title: "${goal.title}"
Description: "${goal.description || 'No description provided'}"
Priority: ${goal.priority || 'medium'}
Progress: ${goal.progress ?? 0}%

Tasks Completed:
${completedTasks || '(None completed yet)'}

Tasks Remaining:
${remainingTasks || '(All tasks completed)'}

Provide progress coaching according to your JSON schema.`;

    const result = await generateWithFallback(prompt, {
      systemInstruction: SYSTEM_GOAL_PROGRESS_COACHING,
      responseMimeType: 'application/json',
    });

    const parsed = safeJsonParse(result.text);
    if (parsed && typeof parsed === 'object') {
      res.json({
        success: true,
        coaching: parsed,
        modelUsed: result.modelUsed,
        isLocalFallback: false,
      });
      return;
    }

    // Fallback if parsing failed
    const localCoaching = generateLocalGoalCoaching(goal);
    res.json({
      success: true,
      coaching: localCoaching,
      modelUsed: result.modelUsed,
      isLocalFallback: false,
    });
  } catch (err: any) {
    console.warn('[GoalCoach] Live Gemini model unavailable. Activating Local Coaching Engine:', extractCleanErrorMessage(err));
    const creditsDepleted = isCreditDepletionError(err);
    const localCoaching = generateLocalGoalCoaching(goal);

    res.json({
      success: true,
      coaching: localCoaching,
      modelUsed: 'Sanctuary Local Coaching Engine (Standby Mode)',
      isLocalFallback: true,
      creditDepleted: creditsDepleted,
      notice: creditsDepleted
        ? 'Coaching generated via local engine (Google AI Studio prepayment credits depleted).'
        : undefined,
    });
  }
});

/**
 * Multi-turn Chat Conversation turn with the AI Assistant
 * Implements Socratic Guide, Compassionate Empath, and Execution Coach personas.
 */
aiRouter.post('/chat', async (req: Request, res: Response): Promise<void> => {
  const { messages, currentPrompt, mode, rollingSummary, journalContext } = (req.body && typeof req.body === 'object') ? req.body : {} as any;

  if (!currentPrompt || typeof currentPrompt !== 'string' || !currentPrompt.trim()) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Prompt cannot be empty.' });
    return;
  }

  if (currentPrompt.length > 20000) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Message exceeds safe 20,000 character limit.' });
    return;
  }

  const recentMessages = Array.isArray(messages) ? messages.slice(-8) : [];

  try {
    let contextSnippet = '';
    if (journalContext && typeof journalContext === 'string' && journalContext.trim()) {
      contextSnippet += `### Context from User's Recent Journal Entries:\n${journalContext.trim()}\n\n`;
    }

    if (rollingSummary && typeof rollingSummary === 'string' && rollingSummary.trim()) {
      contextSnippet += `### Previous Conversation Summary:\n${rollingSummary.trim()}\n\n`;
    }

    contextSnippet += `### Conversation Transcript:\n`;
    for (const msg of recentMessages) {
      contextSnippet += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n\n`;
    }

    const prompt = `${contextSnippet}User's Current Input:\n"""\n${currentPrompt}\n"""\n\nPlease respond in accordance with your persona. Ground your response in the user's situation.`;

    let systemInstruction = SYSTEM_SOCRATIC_GUIDE;
    if (mode === 'empathy') {
      systemInstruction = SYSTEM_COMPASSIONATE_EMPATH;
    } else if (mode === 'goal_coach' || mode === 'execution') {
      systemInstruction = SYSTEM_EXECUTION_COACH;
    }

    const result = await generateWithFallback(prompt, {
      systemInstruction,
    });

    res.json({
      success: true,
      result: result.text,
      modelUsed: result.modelUsed,
      isLocalFallback: false,
    });
  } catch (err: any) {
    console.warn('[AiChat] Live Gemini model unavailable. Activating Local Companion Engine:', extractCleanErrorMessage(err));
    const localReply = generateLocalChatResponse(currentPrompt, mode || 'socratic', recentMessages, journalContext);
    const creditsDepleted = isCreditDepletionError(err);

    res.json({
      success: true,
      result: localReply,
      modelUsed: 'Sanctuary Local Companion (Standby Mode)',
      isLocalFallback: true,
      creditDepleted: creditsDepleted,
      notice: creditsDepleted
        ? 'Operating in local reflective companion mode (Google AI Studio prepayment credits depleted).'
        : undefined,
    });
  }
});

/**
 * "Ask My Journal" feature:
 * Grounded strictly in the user's private journal archive.
 * Must cite specific reflection dates and entry titles.
 * Explicitly states if there is insufficient evidence.
 */
aiRouter.post('/ask-journal', async (req: Request, res: Response): Promise<void> => {
  const { question, journalExcerpts } = (req.body && typeof req.body === 'object') ? req.body : {} as any;

  if (!question || typeof question !== 'string') {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Question is required.' });
    return;
  }

  const safeExcerpts = Array.isArray(journalExcerpts) ? journalExcerpts.slice(0, 15) : [];

  try {
    // If user has no entries at all
    if (safeExcerpts.length === 0) {
      res.json({
        success: true,
        answer: `I couldn't find enough evidence in your journal to answer that confidently.\n\nNo historical reflections were found in your private archive. Once you write entries in your journal, you can ask questions about past decisions, feelings, and milestones.`,
        citedEntries: [],
        hasSufficientEvidence: false,
        modelUsed: 'Sanctuary Core Memory',
        isLocalFallback: false,
      });
      return;
    }

    let journalContext = '';
    const citations: Array<{ id?: string; title: string; date: string; excerptSnippet?: string }> = [];

    safeExcerpts.forEach((entry: any, idx: number) => {
      const dateFormatted = formatDateDisplay(entry.createdAt);
      const title = entry.title || 'Untitled Reflection';
      citations.push({
        id: entry.id,
        title,
        date: dateFormatted,
        excerptSnippet: (entry.content || '').substring(0, 160) + ((entry.content || '').length > 160 ? '...' : ''),
      });

      journalContext += `[Reflection #${idx + 1}] Date: ${dateFormatted} (${entry.createdAt || 'N/A'}), Title: "${title}", Tags: ${(entry.tags || []).join(', ')}\n`;
      journalContext += `Content:\n"""\n${(entry.content || '').substring(0, 1200)}\n"""\n\n`;
    });

    const prompt = `The user is asking a question about their private journal history:
Question: "${question}"

Below are excerpts retrieved STRICTLY from this user's private journal archive:
---------------------------------------------
${journalContext}
---------------------------------------------

Grounding Directives:
1. Base your answer ONLY on the provided excerpts above.
2. ALWAYS cite the exact reflection date(s) (e.g. "On March 12, 2026...") and entry title(s) for any facts or lessons referenced.
3. If there is not enough evidence in the excerpts to answer the question, explicitly state:
   "I couldn't find enough evidence in your journal to answer that confidently."
4. Do NOT fabricate memories or pretend to know things not written in the excerpts.`;

    const result = await generateWithFallback(prompt, {
      systemInstruction: SYSTEM_ASK_JOURNAL,
    });

    const hasSufficientEvidence = !result.text.toLowerCase().includes("couldn't find enough evidence") && 
                                  !result.text.toLowerCase().includes("could not find enough evidence");

    res.json({
      success: true,
      answer: result.text,
      citedEntries: hasSufficientEvidence ? citations.slice(0, 4) : [],
      hasSufficientEvidence,
      modelUsed: result.modelUsed,
      isLocalFallback: false,
    });
  } catch (err: any) {
    console.warn('[AskJournal] Live Gemini model unavailable. Activating Local Semantic Engine:', extractCleanErrorMessage(err));
    const localResult = synthesizeAskJournal(question, safeExcerpts);
    const creditsDepleted = isCreditDepletionError(err);

    res.json({
      success: true,
      answer: localResult.answer,
      citedEntries: localResult.citedEntries,
      hasSufficientEvidence: localResult.hasSufficientEvidence,
      modelUsed: 'Local Semantic Search Engine (Standby Mode)',
      isLocalFallback: true,
      creditDepleted: creditsDepleted,
      notice: creditsDepleted
        ? 'Google AI Studio prepayment credits are depleted. Sanctuary analyzed your private journal using the local semantic engine.'
        : 'Answer synthesized via local semantic search.',
    });
  }
});

/**
 * Periodic reflection digest generator (Weekly, Monthly)
 * Enforces minimum data sufficiency (>= 2 entries) and grounds all insights.
 */
aiRouter.post('/periodic-digest', async (req: Request, res: Response): Promise<void> => {
  const { periodType, entries } = (req.body && typeof req.body === 'object') ? req.body : {} as any;

  if (!Array.isArray(entries) || entries.length === 0) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'No entries provided for this period.' });
    return;
  }

  // Data sufficiency check: Require at least 2 entries for meaningful synthesis
  if (entries.length < 2) {
    res.json({
      success: true,
      digest: `### 📊 Periodic Reflection Review\n\n*Notice: You currently have **${entries.length}** journal reflection recorded for this timeframe. At least 2-3 reflections over this period are required to synthesize meaningful recurring themes and changes over time. Continue journaling to unlock deeper periodic insights!*`,
      modelUsed: 'Sanctuary Digest Engine',
      isLocalFallback: false,
      insufficientEntries: true,
    });
    return;
  }

  try {
    let summaryText = `Journal entries for ${periodType || 'weekly'} review:\n\n`;
    entries.slice(0, 20).forEach((entry, i) => {
      summaryText += `Entry ${i + 1} (${formatDateDisplay(entry.createdAt)}): "${entry.title}"\n${(entry.content || '').substring(0, 800)}\n\n`;
    });

    const prompt = `Review these ${entries.length} journal entries for a ${periodType || 'weekly'} review:
${summaryText}

Please generate the periodic review report according to your system directives. Base all observations strictly on the entries provided.`;

    const result = await generateWithFallback(prompt, {
      systemInstruction: SYSTEM_PERIODIC_REVIEW,
    });

    res.json({
      success: true,
      digest: result.text,
      modelUsed: result.modelUsed,
      isLocalFallback: false,
    });
  } catch (err: any) {
    console.warn('[PeriodicDigest] Live Gemini model unavailable. Activating Local Digest Engine:', extractCleanErrorMessage(err));
    const localDigest = generateLocalDigest(periodType || 'weekly', entries);
    const creditsDepleted = isCreditDepletionError(err);

    res.json({
      success: true,
      digest: localDigest,
      modelUsed: 'Sanctuary Local Digest Engine (Standby Mode)',
      isLocalFallback: true,
      creditDepleted: creditsDepleted,
      notice: creditsDepleted
        ? 'Synthesized via local digest engine (Google AI Studio prepayment credits depleted).'
        : undefined,
    });
  }
});
