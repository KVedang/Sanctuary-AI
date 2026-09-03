import { Router, Request, Response } from 'express';
import { generateWithFallback } from '../gemini/fallbackLadder';
import { getPromptForMode, SYSTEM_BASE_SECURITY } from '../gemini/prompts';

export const aiRouter = Router();

/**
 * Single-shot AI reflection, summary, brainstorming, or goal extraction
 */
aiRouter.post('/process', async (req: Request, res: Response): Promise<void> => {
  try {
    const { mode, content, title } = (req.body && typeof req.body === 'object') ? req.body : {} as any;

    if (!content || typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Journal content is required.' });
      return;
    }

    if (content.length > 50000) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Content exceeds safe 50,000 character limit.' });
      return;
    }

    const { prompt, systemInstruction } = getPromptForMode(mode || 'reflect', content, title);
    const result = await generateWithFallback(prompt, { systemInstruction });

    res.json({
      success: true,
      result: result.text,
      modelUsed: result.modelUsed,
      mode: mode || 'reflect',
    });
  } catch (err: any) {
    console.error('AI process error:', err?.message || err);
    res.status(500).json({
      error: 'AI_SERVICE_ERROR',
      message: 'The AI service encountered an error. Your entry has not been lost.',
    });
  }
});

/**
 * Multi-turn Chat Conversation turn with the AI Assistant
 */
aiRouter.post('/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const { messages, currentPrompt, mode, rollingSummary, journalContext } = (req.body && typeof req.body === 'object') ? req.body : {} as any;

    if (!currentPrompt || typeof currentPrompt !== 'string' || !currentPrompt.trim()) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Prompt cannot be empty.' });
      return;
    }

    if (currentPrompt.length > 20000) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Message exceeds safe 20,000 character limit.' });
      return;
    }

    // Context Compaction Protocol:
    // Retain rolling summary + latest 8 turns + current prompt
    const recentMessages = Array.isArray(messages) ? messages.slice(-8) : [];

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

    const prompt = `${contextSnippet}User's Current Input:\n"""\n${currentPrompt}\n"""\n\nPlease respond in a conversational, structured, empathetic, and constructive reflective manner. Follow the instructions for your active persona.`;

    let personaDirective = 'You act as an empathetic, reflective life companion and thought partner.';
    if (mode === 'socratic') {
      personaDirective = 'You act as a thoughtful Socratic coach. Inquire into underlying beliefs, challenge assumptions constructively, and pose 1-2 sharp, perspective-shifting questions.';
    } else if (mode === 'empathy') {
      personaDirective = 'You act as a deeply compassionate, calming, and non-judgmental confidant. Validate feelings, normalize vulnerability, and offer a peaceful grounding presence.';
    } else if (mode === 'goal_coach') {
      personaDirective = 'You act as an energizing execution coach. Break down mental blocks into micro-habits, clarify priorities, and suggest realistic, high-impact next steps.';
    } else if (mode === 'brainstorm') {
      personaDirective = 'You act as a creative lateral thinking partner. Propose fresh angles, thought experiments, reframing techniques, and novel solutions.';
    }

    const result = await generateWithFallback(prompt, {
      systemInstruction: `${SYSTEM_BASE_SECURITY}\n${personaDirective}\nFormatting: Use clear, readable Markdown with paragraphs, bullet points when listing actions or inquiries, and bold highlights for key takeaways. Keep the tone human, grounded, and concise.`,
    });

    res.json({
      success: true,
      result: result.text,
      modelUsed: result.modelUsed,
    });
  } catch (err: any) {
    console.error('AI chat error:', err?.message || err);
    res.status(500).json({
      error: 'AI_CHAT_ERROR',
      message: 'Failed to generate AI response. Please retry.',
    });
  }
});

/**
 * "Ask My Journal" feature:
 * Queries user historical journal excerpts and synthesizes answers.
 * Context is passed authoritatively by the user's authenticated scope.
 */
aiRouter.post('/ask-journal', async (req: Request, res: Response): Promise<void> => {
  try {
    const { question, journalExcerpts } = (req.body && typeof req.body === 'object') ? req.body : {} as any;

    if (!question || typeof question !== 'string') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Question is required.' });
      return;
    }

    const safeExcerpts = Array.isArray(journalExcerpts) ? journalExcerpts.slice(0, 15) : [];
    let journalContext = '';

    if (safeExcerpts.length === 0) {
      journalContext = 'No relevant historical journal entries were found for this query.';
    } else {
      safeExcerpts.forEach((entry: any, idx: number) => {
        journalContext += `[Entry #${idx + 1}] Date: ${entry.createdAt || 'N/A'}, Title: "${entry.title || 'Untitled'}", Tags: ${(entry.tags || []).join(', ')}\n`;
        journalContext += `Content Excerpt:\n"""\n${(entry.content || '').substring(0, 1500)}\n"""\n\n`;
      });
    }

    const prompt = `The user is asking a question about their own private journal history:
Question: "${question}"

Below are excerpts retrieved STRICTLY from this user's private journal archive:
---------------------------------------------
${journalContext}
---------------------------------------------

Please answer the user's question clearly and thoughtfully:
1. Synthesize insights across the entries.
2. Cite specific dates, titles, or themes when referencing facts.
3. Identify recurring patterns, changes over time, or unresolved questions.
4. If the journal entries don't contain enough information to answer completely, state that transparently.`;

    const result = await generateWithFallback(prompt, {
      systemInstruction: `${SYSTEM_BASE_SECURITY}\nYou are an intelligent memory search companion for the user's own journal. Never invent memories.`,
    });

    res.json({
      success: true,
      answer: result.text,
      modelUsed: result.modelUsed,
    });
  } catch (err: any) {
    console.error('Ask journal error:', err?.message || err);
    res.status(500).json({
      error: 'ASK_JOURNAL_ERROR',
      message: 'Failed to analyze journal history. Please try again.',
    });
  }
});

/**
 * Periodic reflection generator (Daily, Weekly, Monthly)
 */
aiRouter.post('/periodic-digest', async (req: Request, res: Response): Promise<void> => {
  try {
    const { periodType, entries } = (req.body && typeof req.body === 'object') ? req.body : {} as any;

    if (!Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'No entries provided for this period.' });
      return;
    }

    let summaryText = `Journal entries for ${periodType || 'weekly'} review:\n\n`;
    entries.slice(0, 20).forEach((entry, i) => {
      summaryText += `Entry ${i + 1} (${entry.createdAt || ''}): "${entry.title}"\n${(entry.content || '').substring(0, 800)}\n\n`;
    });

    const prompt = `Generate a comprehensive ${periodType || 'weekly'} reflection digest based on these entries:
Format the output with these Markdown sections:
### 🌟 Major Highlights & Accomplishments
### 💡 Key Insights & Lessons Learned
### ⚡ Challenges & Friction Addressed
### 🎯 Emerging Goals & Strategic Priorities for Next Period

${summaryText}`;

    const result = await generateWithFallback(prompt, {
      systemInstruction: `${SYSTEM_BASE_SECURITY}\nYou are an executive life and reflection coach conducting periodic reviews.`,
    });

    res.json({
      success: true,
      digest: result.text,
      modelUsed: result.modelUsed,
    });
  } catch (err: any) {
    console.error('Periodic digest error:', err?.message || err);
    res.status(500).json({
      error: 'DIGEST_ERROR',
      message: 'Failed to generate periodic digest.',
    });
  }
});
