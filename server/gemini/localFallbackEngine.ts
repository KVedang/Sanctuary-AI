/**
 * Autonomous Local Reflection & Semantic Engine (Standby Mode)
 * Provides local semantic synthesis, keyword extraction, and persona-driven
 * reflection when cloud Gemini models are unavailable (e.g. rate limits, network faults,
 * or depleted prepayment credits in AI Studio).
 */

export interface JournalExcerpt {
  id?: string;
  title?: string;
  content?: string;
  tags?: string[];
  createdAt?: string;
}

export interface LocalAskJournalResult {
  answer: string;
  citedEntries: Array<{
    id?: string;
    title: string;
    date: string;
    excerptSnippet?: string;
  }>;
  hasSufficientEvidence: boolean;
}

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', "aren't",
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', "can't", 'cannot', 'could', "couldn't", 'did', "didn't", 'do', 'does', "doesn't", 'doing',
  "don't", 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', "hadn't", 'has', "hasn't",
  'have', "haven't", 'having', 'he', "he'd", "he'll", "he's", 'her', 'here', "here's", 'hers',
  'herself', 'him', 'himself', 'his', 'how', "how's", 'i', "i'd", "i'll", "i'm", "i've", 'if',
  'in', 'into', 'is', "isn't", 'it', "it's", 'its', 'itself', "let's", 'me', 'more', 'most', "mustn't",
  'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our',
  'ours', 'ourselves', 'out', 'over', 'own', 'same', "shan't", 'she', "she'd", "she'll", "she's",
  'should', "shouldn't", 'so', 'some', 'such', 'than', 'that', "that's", 'the', 'their', 'theirs',
  'them', 'themselves', 'then', 'there', "there's", 'these', 'they', "they'd", "they'll", "they're",
  "they've", 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', "wasn't",
  'we', "we'd", "we'll", "we're", "we've", 'were', "weren't", 'what', "what's", 'when', "when's",
  'where', "where's", 'which', 'while', 'who', "who's", 'whom', 'why', "why's", 'with', "won't",
  'would', "wouldn't", 'you', "you'd", "you'll", "you're", "you've", 'your', 'yours', 'yourself',
  'yourselves', 'journal', 'entry', 'mention', 'mentioned', 'write', 'written', 'tell', 'me'
]);

export function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

export function formatDateDisplay(dateStr?: string): string {
  if (!dateStr) return 'Recent Entry';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Recent Entry';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'Recent Entry';
  }
}

/**
 * Synthesizes grounded answers to questions regarding the user's private journal archive.
 * Follows strict grounding and handles insufficient evidence explicitly.
 */
export function synthesizeAskJournal(question: string, excerpts: JournalExcerpt[]): LocalAskJournalResult {
  if (!excerpts || excerpts.length === 0) {
    return {
      answer: `I couldn't find enough evidence in your journal to answer that confidently.\n\nNo historical journal reflections have been recorded yet. As you write reflections, Sanctuary will index them here to answer your questions.`,
      citedEntries: [],
      hasSufficientEvidence: false,
    };
  }

  const queryKeywords = extractKeywords(question);
  
  // Score entries based on keyword matches in title, tags, and content
  const scored = excerpts.map((entry) => {
    let score = 0;
    const title = (entry.title || '').toLowerCase();
    const content = (entry.content || '').toLowerCase();
    const tags = (entry.tags || []).map(t => t.toLowerCase());

    const matchedWords: string[] = [];

    for (const kw of queryKeywords) {
      let kwScore = 0;
      if (title.includes(kw)) {
        kwScore += 6;
        matchedWords.push(kw);
      }
      if (tags.some(t => t.includes(kw))) {
        kwScore += 5;
        matchedWords.push(kw);
      }
      const occurrences = (content.match(new RegExp(`\\b${kw}\\b`, 'g')) || []).length;
      if (occurrences > 0) {
        kwScore += Math.min(occurrences * 3, 10);
        matchedWords.push(kw);
      } else if (content.includes(kw)) {
        kwScore += 1;
        matchedWords.push(kw);
      }
      score += kwScore;
    }

    return {
      entry,
      score,
      matchedWords: Array.from(new Set(matchedWords)),
    };
  });

  // Sort descending by score, fallback to recency
  scored.sort((a, b) => b.score - a.score);
  const relevant = scored.filter(s => s.score > 0);

  if (relevant.length === 0) {
    return {
      answer: `I couldn't find enough evidence in your journal to answer that confidently.\n\nI searched across your **${excerpts.length}** journal reflections for topics related to **"${question}"**, but could not locate relevant entries or statements addressing this question.`,
      citedEntries: [],
      hasSufficientEvidence: false,
    };
  }

  // Construct structured answer from top matches
  const topMatches = relevant.slice(0, 4);
  const citations = topMatches.map(({ entry, matchedWords }) => {
    const content = entry.content || '';
    const firstWord = matchedWords[0];
    let snippet = '';
    if (firstWord && content.toLowerCase().includes(firstWord)) {
      const idx = content.toLowerCase().indexOf(firstWord);
      const start = Math.max(0, idx - 60);
      const end = Math.min(content.length, idx + 140);
      snippet = (start > 0 ? '...' : '') + content.substring(start, end).trim() + (end < content.length ? '...' : '');
    } else {
      snippet = content.substring(0, 160) + (content.length > 160 ? '...' : '');
    }

    return {
      id: entry.id,
      title: entry.title || 'Untitled Reflection',
      date: formatDateDisplay(entry.createdAt),
      excerptSnippet: snippet,
    };
  });

  let response = `### 🔍 Synthesized Journal Insights\n\n`;
  response += `Based strictly on your recorded reflections, here is what your archive reveals regarding **"${question}"**:\n\n`;

  topMatches.forEach(({ entry, matchedWords }) => {
    const dateFormatted = formatDateDisplay(entry.createdAt);
    const content = entry.content || '';
    const firstWord = matchedWords[0];
    let snippet = '';
    if (firstWord && content.toLowerCase().includes(firstWord)) {
      const idx = content.toLowerCase().indexOf(firstWord);
      const start = Math.max(0, idx - 60);
      const end = Math.min(content.length, idx + 140);
      snippet = (start > 0 ? '...' : '') + content.substring(start, end).trim() + (end < content.length ? '...' : '');
    } else {
      snippet = content.substring(0, 160) + (content.length > 160 ? '...' : '');
    }

    response += `In your reflection **"${entry.title || 'Untitled'}"** on **${dateFormatted}**, you noted:\n`;
    response += `> "${snippet}"\n\n`;
  });

  response += `### 📅 Cited Reflections & Timeline\n`;
  citations.forEach(c => {
    response += `- **${c.title}** (${c.date})\n`;
  });

  response += `\n### 💡 Notable Patterns & Progress\n`;
  response += `- This topic connects across **${relevant.length}** reflection${relevant.length > 1 ? 's' : ''}.\n`;
  const allTags = Array.from(new Set(relevant.flatMap(r => r.entry.tags || [])));
  if (allTags.length > 0) {
    response += `- Related themes include: ${allTags.slice(0, 4).map(t => `\`#${t}\``).join(' ')}.\n`;
  }
  response += `- Your reflections demonstrate conscious ongoing navigation of this topic.`;

  return {
    answer: response,
    citedEntries: citations,
    hasSufficientEvidence: true,
  };
}

/**
 * Autonomous Local Goal & Task Suggestion Engine
 * Formulates ONE best actionable goal with 3-5 concrete tasks grounded in the user's reflection,
 * or returns hasGoal: false if the entry is purely reflective/non-actionable.
 */
export function generateLocalGoalSuggestion(content: string, title?: string): {
  hasGoal: boolean;
  title?: string;
  description?: string;
  reason?: string;
  priority?: 'low' | 'medium' | 'high';
  howToAchieve?: string[];
  tasks?: string[];
} {
  const clean = (content || '').trim();
  const lower = clean.toLowerCase();
  const sentences = clean.split(/[.!?\n]+/).map(s => s.trim()).filter(s => s.length > 8);

  // Intent patterns: action-oriented verbs and commitments
  const hasGoalIntent = /goal|plan|need to|want to|start|build|finish|create|implement|learn|schedule|routine|commit|finish|organize|launch|study|practice|improve|fix|write|read/i.test(lower);

  // If reflection is too brief or lacks any action intent, do not force an artificial goal
  if (!hasGoalIntent || sentences.length === 0) {
    return {
      hasGoal: false,
      reason: 'The reflection is reflective or contemplative in nature without an actionable commitment or intention.',
    };
  }

  // Detect focus domain
  let goalTitle = '';
  let domainReason = '';
  let priority: 'low' | 'medium' | 'high' = 'medium';

  if (/asap|deadline|urgent|critical|immediately|overdue/.test(lower)) {
    priority = 'high';
  } else if (/someday|eventually|maybe|explore|curious/.test(lower)) {
    priority = 'low';
  }

  if (/health|sleep|exercise|workout|walk|diet|energy|rest|burnout/.test(lower)) {
    goalTitle = 'Restore Energy & Sustainable Wellness Rhythm';
    domainReason = 'Your reflection highlights physical energy, rest, and well-being as a cornerstone for balance.';
  } else if (/learn|study|cloud|course|read|exam|skill|code/.test(lower)) {
    goalTitle = title && !title.toLowerCase().includes('untitled') 
      ? `Deepen Mastery: ${title}` 
      : 'Establish Consistent 30-Minute Skill Learning Sessions';
    domainReason = 'Your entry points toward personal growth, knowledge acquisition, and skill mastery.';
  } else if (/work|project|deadline|team|career|job|client/.test(lower)) {
    goalTitle = title && !title.toLowerCase().includes('untitled')
      ? `Advance Key Deliverable: ${title}`
      : 'Bring Clarity & Structured Focus to Professional Priorities';
    domainReason = 'Your reflection indicates an active desire to make tangible headway on work deliverables.';
  } else if (/relationship|boundary|friend|partner|family|talk/.test(lower)) {
    goalTitle = 'Communicate Healthy Boundaries & Intentional Presence';
    domainReason = 'Your writing reflects on interpersonal dynamics, clear boundaries, and relational clarity.';
  } else {
    goalTitle = title && !title.toLowerCase().includes('untitled')
      ? `Action Plan: ${title}`
      : 'Translate Reflective Insight into Concrete Weekly Progress';
    domainReason = 'Your reflection expresses a clear desire to move from contemplation into structured execution.';
  }

  // 3-4 Specific, achievable micro-tasks
  const tasks: string[] = [
    'Define clear "done" criteria for the single highest-priority milestone (15 min)',
    'Block 30 minutes of uninterrupted focus in your calendar this week',
    'Execute the initial low-friction micro-step to establish momentum',
    'Conduct a brief 5-minute retrospective on what worked and what felt blocked',
  ];

  const howToAchieve: string[] = [
    'Step 1: Clarify the core objective and what success looks like.',
    'Step 2: Schedule designated focus windows without competing distractions.',
    'Step 3: Complete the first concrete micro-step to establish momentum.',
    'Step 4: Review progress and adjust your pace as needed.',
  ];

  return {
    hasGoal: true,
    title: goalTitle,
    description: `A focused, low-friction action plan derived from your reflection to turn insight into measurable momentum.`,
    reason: domainReason,
    priority,
    howToAchieve,
    tasks,
  };
}

/**
 * Local Adaptive Thought Explorer
 * Generates tailored reflection questions based on short user input.
 */
export function generateLocalThoughtExplorer(thought: string): {
  suggestedTitle: string;
  thoughtSummary: string;
  questions: string[];
} {
  const clean = (thought || '').trim();
  const lower = clean.toLowerCase();

  let title = 'Mindful Reflection';
  const questions: string[] = [];

  if (/stress|overwhelm|tired|exhaust|burnout|too much/.test(lower)) {
    title = 'Navigating Overwhelm & Fatigue';
    questions.push('What specific events or demands contributed most to this feeling today?');
    questions.push('How did your body and mind signal that you were reaching capacity?');
    questions.push('What is one commitment or task that can safely be postponed or dropped?');
    questions.push('What would rest or decompression look like for you in the next hour?');
    questions.push('What boundary could protect your energy tomorrow?');
  } else if (/work|job|boss|meeting|deadline|project|client/.test(lower)) {
    title = 'Workplace Dynamics & Priorities';
    questions.push('What was the central moment or interaction that stood out during your workday?');
    questions.push('What expectations (your own or others\') felt heaviest today?');
    questions.push('What went better than expected, even in a small way?');
    questions.push('What do you want to handle differently when you step back into work tomorrow?');
    questions.push('What is one high-leverage priority you can focus on first?');
  } else if (/learn|study|cloud|skill|book|read|practic/.test(lower)) {
    title = 'Learning Momentum & Growth';
    questions.push('What specific topic or skill captured your curiosity or hesitation?');
    questions.push('What obstacle (e.g. time, clarity, passive watching) interrupted your flow?');
    questions.push('How could you apply one small concept hands-on rather than just reviewing theory?');
    questions.push('What is a realistic 20-minute practice session you could schedule this week?');
  } else if (/anxious|worry|fear|nervous|doubt/.test(lower)) {
    title = 'Unpacking Worry & Building Groundedness';
    questions.push('What is the underlying story or assumption your anxiety is telling you?');
    questions.push('What aspects of this situation are genuinely within your direct control?');
    questions.push('What evidence from your past reminds you of your resilience in similar moments?');
    questions.push('What would you say to a close friend facing this exact feeling?');
    questions.push('What is one grounding breath or small physical step you can take right now?');
  } else {
    title = clean.length > 5 && clean.length < 50 ? clean : 'Exploring Daily Insights';
    questions.push('What happened right before you felt moved to write this down?');
    questions.push('How did this experience impact your mood and focus?');
    questions.push('What pattern or lesson might be showing up here?');
    questions.push('What would a constructive next step look like for you?');
    questions.push('What is one kind thought you can offer yourself regarding this situation?');
  }

  return {
    suggestedTitle: title,
    thoughtSummary: clean || 'Initial reflection thought',
    questions,
  };
}

/**
 * Local Grounded Reflection Drafter
 * Preserves user voice without inventing facts, people, or events.
 */
export function generateLocalReflectionDraft(
  thought: string,
  notes?: string
): {
  suggestedTitle: string;
  draftContent: string;
  wordCount: number;
  detectedThemes: string[];
} {
  const cleanThought = (thought || '').trim();
  const cleanNotes = (notes || '').trim();

  let title = 'Reflections on the Day';
  if (cleanThought.length > 3 && cleanThought.length < 40) {
    title = cleanThought;
  } else if (/stress|overwhelm/.test(cleanThought.toLowerCase())) {
    title = 'Processing Stress and Finding Balance';
  } else if (/work|project/.test(cleanThought.toLowerCase())) {
    title = 'Workplace Priorities and Clarity';
  }

  let draft = '';
  if (cleanThought && cleanNotes) {
    draft = `Today I took time to reflect on what has been on my mind: "${cleanThought}".\n\nLooking closer at this experience, several details stand out:\n${cleanNotes}\n\nAcknowledging these thoughts helps me understand the situation with greater clarity and choose how I want to respond moving forward.`;
  } else if (cleanThought) {
    draft = `Today I felt moved to capture a thought that has been staying with me: "${cleanThought}".\n\nWriting this down gives me space to step back from the immediacy of the feeling. I want to pay attention to what this is teaching me and give myself permission to navigate it one step at a time.`;
  } else {
    draft = `I set aside a few minutes to pause and reflect today. Taking this moment helps me reground my focus and identify what matters most right now.`;
  }

  const words = draft.split(/\s+/).filter(Boolean).length;
  return {
    suggestedTitle: title,
    draftContent: draft,
    wordCount: words,
    detectedThemes: ['Personal Awareness', 'Mindful Reflection'],
  };
}

/**
 * Local Task Regeneration
 */
export function generateLocalTaskRegeneration(
  goalTitle: string,
  _goalDesc?: string
): {
  howToAchieve: string[];
  tasks: string[];
} {
  return {
    howToAchieve: [
      `Step 1: Break "${goalTitle}" into three specific milestones.`,
      'Step 2: Reserve a distraction-free 25-minute block on your calendar.',
      'Step 3: Execute the foundational task with focused attention.',
      'Step 4: Note down what was accomplished and plan the next phase.',
    ],
    tasks: [
      `Define clear success criteria for "${goalTitle}" (15 min)`,
      'Schedule a dedicated execution session in your planner or calendar',
      'Complete the first tangible action item to build forward momentum',
      'Perform a 5-minute retrospective to log progress and overcome blockers',
    ],
  };
}

/**
 * Generates structured multi-dimensional reflection output with separation of:
 * - Explicit statements
 * - Inferred patterns
 * - Suggested perspectives
 * - Intelligent goal extraction (or hasGoal: false if non-actionable)
 */
export function generateLocalStructuredReflection(content: string, title?: string): any {
  const clean = (content || '').trim();
  const lower = clean.toLowerCase();
  const sentences = clean.split(/[.!?\n]+/).map(s => s.trim()).filter(s => s.length > 10);
  const words = clean.split(/\s+/).filter(Boolean);

  // Identify emotional tone
  const emotions: string[] = [];
  if (/tired|exhausted|burnout|overwhelm|drained/.test(lower)) emotions.push('Fatigued / Overwhelmed');
  if (/anxious|worried|nervous|stress|panic/.test(lower)) emotions.push('Anxious / Uncertain');
  if (/hopeful|excited|inspired|proud|happy|grateful/.test(lower)) emotions.push('Hopeful / Grateful');
  if (/frustrated|stuck|annoyed|angry|friction/.test(lower)) emotions.push('Frustrated / Blocked');
  if (/calm|peaceful|grounded|clear|centered/.test(lower)) emotions.push('Calm / Centered');
  if (emotions.length === 0) emotions.push('Reflective / Contemplative');

  // Identify themes
  const themes: string[] = [];
  if (/work|job|career|boss|project|client|deadline/.test(lower)) themes.push('Career & Work Execution');
  if (/family|friend|partner|relationship|love|boundary/.test(lower)) themes.push('Relationships & Boundaries');
  if (/habit|routine|exercise|sleep|health|diet/.test(lower)) themes.push('Health & Daily Habits');
  if (/goal|plan|focus|priority|distraction|procrastinat/.test(lower)) themes.push('Focus & Priority Management');
  if (/learn|study|cloud|code|book|skill/.test(lower)) themes.push('Continuous Learning & Mastery');
  if (themes.length === 0) themes.push('Personal Awareness & Inner Direction');

  // Extract explicit statements (direct quotes/sentences from the user)
  const explicitStatements = sentences.slice(0, 3);

  // Inferred patterns
  const inferredPatterns: string[] = [];
  if (/tired|overwhelm|busy|too much/.test(lower)) {
    inferredPatterns.push('Cognitive overload from holding too many simultaneous open commitments.');
  }
  if (/want to|hope to|should|wish/.test(lower)) {
    inferredPatterns.push('A noticeable gap between aspirational intentions and daily routine friction.');
  }
  if (/afraid|worry|fail|imposter/.test(lower)) {
    inferredPatterns.push('Risk aversion leading to delay or perfectionist hesitations.');
  }
  if (inferredPatterns.length === 0) {
    inferredPatterns.push('Desire for clarity and alignment before taking decisive action.');
  }

  // Suggested perspectives
  const suggestedPerspectives: string[] = [
    'Focus on the single highest-leverage lever rather than attempting to fix everything simultaneously.',
    'Notice if perfectionism is creating artificial delays in your execution momentum.',
  ];

  // Check if actionable goal exists in reflection
  const goalSuggestion = generateLocalGoalSuggestion(content, title);

  return {
    summary: sentences[0] || 'A thoughtful personal reflection exploring thoughts, challenges, and aspirations.',
    explicitStatements: explicitStatements.length > 0 ? explicitStatements : ['User reflected on personal goals and current state.'],
    inferredPatterns,
    suggestedPerspectives,
    themes,
    keyConcerns: [
      emotions.includes('Fatigued / Overwhelmed') ? 'Managing energy and avoiding burnout' : 'Maintaining clarity under shifting priorities',
    ],
    emotions,
    thinkingPatterns: [
      'Focusing on high standards while navigating day-to-day friction',
    ],
    positiveObservations: [
      'Demonstrated candid self-honesty by naming current challenges openly',
      'Proactive commitment to documenting thoughts and tracking progress',
    ],
    growthAreas: [
      'Giving yourself permission to make incremental, non-perfectionist progress',
    ],
    actionableOpportunities: [
      'Turn this written insight into one small, concrete behavior today',
    ],
    inquiryQuestions: [
      'What is the single smallest action that would create meaningful relief or momentum right now?',
      'What assumption are you making that might be unnecessary or overly strict?',
    ],
    goalSuggestion,
  };
}

/**
 * Local Goal Progress Coaching
 */
export function generateLocalGoalCoaching(goal: any): any {
  const title = goal?.title || 'Active Goal';
  const tasks = Array.isArray(goal?.tasks) ? goal.tasks : [];
  const completed = tasks.filter((t: any) => t.completed);
  const remaining = tasks.filter((t: any) => !t.completed);
  const progress = goal?.progress ?? 0;

  return {
    goalTitle: title,
    completedSummary: completed.length > 0
      ? `You have completed ${completed.length} of ${tasks.length} tasks (${progress}% complete), building tangible momentum.`
      : `You have initiated this goal and formulated the roadmap. The first milestone is ahead.`,
    remainingSummary: remaining.length > 0
      ? `${remaining.length} task${remaining.length > 1 ? 's remain' : ' remains'}: "${remaining[0]?.title || 'Next milestone'}" is your next target.`
      : `All planned tasks have been completed! Celebrate this finish line.`,
    potentialObstacle: remaining.length > 2
      ? `Task friction or unclear scope can stall momentum. Avoid tackling all remaining steps in one sitting.`
      : `Maintaining consistency when unexpected daily demands arise.`,
    recommendedNextStep: remaining[0]?.title
      ? `Spend 15 focused minutes on: "${remaining[0].title}". Do not aim for perfection, just initiate action.`
      : `Conduct a retrospective on what made this goal successful and archive or set a new milestone.`,
    suggestedSubtasks: remaining[0]?.title ? [
      `Review requirements for "${remaining[0].title}" (5 mins)`,
      `Draft or complete the initial phase without interruptions (20 mins)`,
    ] : [],
    coachingAdvice: `Momentum is built through tiny, consistent wins rather than monumental sprints. Focus only on the single next task in front of you.`,
  };
}

/**
 * Local Periodic Digest
 */
export function generateLocalDigest(periodType: string, entries: any[] = []): string {
  const count = entries.length;

  if (count < 2) {
    return `### 📊 Periodic Reflection Digest\n\n*Notice: You currently have **${count}** journal reflection recorded for this period. At least 2-3 reflections over this timeframe are required to synthesize meaningful periodic trends and changes over time. Continue journaling to unlock deeper periodic insights!*`;
  }

  const periodTitle = periodType.charAt(0).toUpperCase() + periodType.slice(1);
  const titles = entries.map(e => `"${e.title || 'Untitled'}"`).slice(0, 5).join(', ');

  return `### 🌟 Major Highlights & Accomplishments
- **Consistent Reflection Habit**: Logged **${count}** reflections during this ${periodType} period, nurturing self-awareness.
- **Topics Explored**: Included ${titles || 'key personal priorities and milestones'}.
- **Proactive Agency**: You identified challenges candidly and explored actionable ways forward.

### 📈 Important Changes & Shifts
- Transitioned from abstract worries toward structured reflection and deliberate goal-setting.
- Heightened awareness of time management, energy boundaries, and focus blocks.

### 🧩 Recurring Themes & Focus Areas
- Balancing day-to-day demands with long-term skill acquisition and personal well-being.
- Creating sustainable habits and tracking follow-through.

### ⚡ Unresolved Obstacles & Friction Points
- Protecting uninterrupted time blocks from fragmented interruptions.
- Managing energy reserves when balancing multiple competing commitments.

### 🎯 Goal Alignment & Strategic Next Steps
1. **Focus on Quality over Quantity**: Choose ONE primary milestone for the upcoming period.
2. **Timebox Action**: Commit to 20-minute daily progress windows.
3. **Weekly Check-in**: Review your journal archive to stay grounded in your progress.`;
}

/**
 * Autonomous local processing for Single-shot AI actions
 */
export function generateLocalProcess(mode: string, content: string, title?: string): string {
  const cleanContent = (content || '').trim();
  const paragraphs = cleanContent.split(/\n+/).filter(p => p.trim().length > 0);
  const firstPara = paragraphs[0] || '';
  const wordCount = cleanContent.split(/\s+/).filter(Boolean).length;

  switch (mode) {
    case 'summarize': {
      const execSummary = firstPara.length > 250 ? firstPara.slice(0, 250) + '...' : firstPara;
      const bulletPoints = paragraphs.slice(0, 4).map(p => {
        const sentence = p.split(/[.!?]/)[0] || p;
        return `- ${sentence.trim()}`;
      }).join('\n');

      return `### 📋 Executive Summary
${execSummary || 'A thoughtful personal reflection exploring experiences, thoughts, and next steps.'}

### 💡 Core Takeaways
${bulletPoints || '- Explored meaningful thoughts and personal milestones.\n- Articulated core perspective on current priorities.'}

### 🎯 Key Action Items
- Review the commitments outlined in this entry.
- Dedicate 15 minutes today to address the primary priority identified.
- Check back in 3 days to evaluate progress.`;
    }

    case 'reflect':
    case 'reflect_deep': {
      return `### 🌱 Reflective Inquiry & Socratic Analysis

**Emotional Reality & Tone**:
Your writing reflects conscious self-observation and intentionality across **${wordCount} words**. The themes point toward a clear desire for clarity and authentic alignment.

**Explicit Observations**:
- You clearly articulated your current situation and stated where you are feeling friction or momentum.

**Inferred Perspectives**:
1. **The Long Horizon**: If you observed this situation from 6 months in the future, what part would feel most significant, and what part would feel temporary?
2. **Inner Agency**: Notice where you describe circumstances happening to you versus choices you are actively authoring.

**Inquiry Questions for Your Next Reflection**:
- *What unstated assumption in this reflection is worth challenging?*
- *If you allowed yourself to take the simplest possible next step, what would it look like?*`;
    }

    case 'brainstorm': {
      return `### 💡 Strategic Ideation & Brainstorming

#### ⚡ Immediate Quick-Wins (< 30 minutes)
1. **Clarify Priority #1**: Write down the single non-negotiable step that gives you the highest leverage.
2. **Remove Friction**: Identify one recurring obstacle mentioned in your writing and eliminate it from your environment today.

#### 🧪 Creative Experiments (Low Risk, High Learning)
1. **The 3-Day Test**: Implement a slight adjustment for just 72 hours before deciding on a permanent change.
2. **Reverse Brainstorming**: Ask yourself: *"What would guarantee the opposite of my goal?"* and systematically avoid those traps.

#### 🎯 Strategic Long-Term Focus
- Build an intentional review loop so these insights turn into consistent behavioral habits rather than one-time realizations.`;
    }

    case 'goal_coach': {
      return `### 🎯 Actionable Goals & Execution Roadmap

Based on your writing, here is an execution roadmap:

1. **Primary Milestone**:
   - **Target**: Translate the core realization into a measurable outcome within 7 days.
   - **Task 1**: Define specific completion criteria for this milestone.
   - **Task 2**: Schedule a 30-minute uninterrupted focus block.
   - **Task 3**: Complete the initial action item and evaluate friction.

2. **Habit Cue & Micro-Action**:
   - Pair your next step with an existing daily anchor (e.g. morning tea or evening shutdown).
   - Keep initial friction low: aim for 15 minutes of uninterrupted momentum.`;
    }

    case 'analytical':
    default: {
      return `### 📊 Reflection Analytics & Pattern Analysis

- **Volume & Depth**: ${wordCount} words across ${paragraphs.length} paragraphs.
- **Cognitive Clarity**: High degree of self-reflection and candid self-appraisal.
- **Actionability**: Good balance between emotional expression and forward-looking momentum.
- **Recommended Follow-up**: Follow through on the highest-priority insight before adding new commitments.`;
    }
  }
}

/**
 * Autonomous local conversational engine for Multi-Turn AI Assistant
 */
export function generateLocalChatResponse(
  currentPrompt: string,
  mode: string,
  messages: any[] = [],
  journalContext?: string
): string {
  const prompt = currentPrompt.trim();

  if (mode === 'socratic') {
    return `You've raised an insightful reflection: *"The thoughts we dwell upon shape the decisions we take."*

Looking closely at what you just described:
1. **What core belief or expectation** is sitting underneath this thought?
2. If the opposite of what you currently assume were true, how would your approach shift?

Take a moment to sit with that inquiry. What emerges first for you?`;
  }

  if (mode === 'empathy') {
    return `Thank you for sharing this with honesty. It takes courage to articulate these feelings clearly.

It is completely natural to experience moments of uncertainty or complexity when navigating changes and commitments. Self-reflection is not about having every answer immediately—it is about giving yourself the space to listen and breathe.

Be gentle with where you are right now. What would feel most supportive or restorative for you in this moment?`;
  }

  if (mode === 'goal_coach' || mode === 'execution') {
    return `I hear clear ambition in your thoughts. Let's turn this awareness into concrete, low-friction momentum:

### 🎯 Pragmatic Next Steps:
1. **Define the Micro-Step**: What is the single smallest action (taking under 10 minutes) you can do right now?
2. **Eliminate 1 Distraction**: Clear the primary point of friction before starting.
3. **Commit to a Timebox**: Give yourself 25 minutes of uninterrupted focus.

What is the first micro-action you're choosing to tackle today?`;
  }

  // Default Reflective Thought Partner
  return `That is a meaningful reflection. When we articulate our inner dialogue onto paper, patterns that were once noisy become clear.

Based on what you've shared:
- Notice how your perspective has evolved even since you began writing.
- Focus on the factors within your immediate circle of control.

What part of this feels most important to prioritize as you move through today?`;
}

/**
 * Autonomous Local Goal Generation conforming to { goal, tasks } schema
 */
export function generateLocalGoalGenerate(content: string, title?: string): {
  goal: {
    title: string;
    description: string;
    reason: string;
    priority: 'low' | 'medium' | 'high';
    howToAchieve: string[];
  } | null;
  tasks: Array<{
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
  }>;
  reason?: string;
} {
  const local = generateLocalGoalSuggestion(content, title);
  if (!local.hasGoal || !local.title) {
    return {
      goal: null,
      tasks: [],
      reason: local.reason || 'The reflection does not contain enough actionable information or commitment for a meaningful goal.',
    };
  }

  const tasks = (local.tasks || []).map((t, idx) => ({
    title: t,
    description: `Actionable micro-step ${idx + 1} to make immediate headway in 15-30 minutes.`,
    priority: local.priority || 'medium',
  }));

  return {
    goal: {
      title: local.title,
      description: local.description || 'Focus on deliberate, consistent action to advance this milestone.',
      reason: local.reason || 'Grounded directly in the commitments observed in your journal reflection.',
      priority: local.priority || 'medium',
      howToAchieve: local.howToAchieve && local.howToAchieve.length > 0 ? local.howToAchieve : [
        'Step 1: Set aside a dedicated 25-minute focus window today.',
        'Step 2: Prepare the essential resources and clear distractions.',
        'Step 3: Execute the first micro-task with undivided attention.',
        'Step 4: Review progress and record observations in your reflection tracker.'
      ],
    },
    tasks: tasks.length >= 3 ? tasks.slice(0, 5) : [
      ...tasks,
      {
        title: 'Schedule a 20-minute uninterrupted work block',
        description: 'Block out an exact calendar slot to focus without interruption.',
        priority: local.priority || 'medium',
      },
      {
        title: 'Document your completed milestone in your journal',
        description: 'Capture wins and note any friction points for next time.',
        priority: local.priority || 'medium',
      },
    ].slice(0, 5),
  };
}

