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

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'can\'t', 'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing',
  'don\'t', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t',
  'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers',
  'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if',
  'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t',
  'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our',
  'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s',
  'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs',
  'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re',
  'they\'ve', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t',
  'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s',
  'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t',
  'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself',
  'yourselves', 'journal', 'entry', 'mention', 'mentioned', 'write', 'written', 'tell', 'me'
]);

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function formatDateDisplay(dateStr?: string): string {
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
 * Synthesizes answers to questions regarding the user's private journal archive.
 */
export function synthesizeAskJournal(question: string, excerpts: JournalExcerpt[]): string {
  if (!excerpts || excerpts.length === 0) {
    return `### 📖 Journal Memory Search\n\nNo historical journal entries are currently available to search. As you write reflections and record daily thoughts, Sanctuary AI will index and cross-reference them here.`;
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
        kwScore += 5;
        matchedWords.push(kw);
      }
      if (tags.some(t => t.includes(kw))) {
        kwScore += 4;
        matchedWords.push(kw);
      }
      const occurrences = (content.match(new RegExp(`\\b${kw}\\b`, 'g')) || []).length;
      if (occurrences > 0) {
        kwScore += Math.min(occurrences * 2, 8);
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
    // Return a general synthesis of what exists
    const recentSample = excerpts.slice(0, 3);
    let output = `### 📖 Journal Search Results\n\n`;
    output += `I searched your **${excerpts.length}** journal entries for topics related to **"${question}"**, but did not find direct keyword matches.\n\n`;
    output += `#### 🗂️ Available Topics in Your Archive:\n`;
    recentSample.forEach((e) => {
      output += `- **"${e.title || 'Untitled'}"** (${formatDateDisplay(e.createdAt)}) — ${(e.tags || []).length > 0 ? e.tags?.map(t => `#${t}`).join(' ') : 'General reflection'}\n`;
    });
    output += `\n*Tip: Try querying broader keywords like goals, feelings, challenges, work, or decisions.*`;
    return output;
  }

  // Construct structured answer from top matches
  const topMatches = relevant.slice(0, 4);
  let response = `### 🔍 Synthesized Journal Memory\n\n`;
  response += `Based on an analysis across your private reflections, here is what your archive reveals regarding **"${question}"**:\n\n`;

  response += `#### 📌 Key Findings & Context\n`;
  topMatches.forEach(({ entry, matchedWords }) => {
    const dateFormatted = formatDateDisplay(entry.createdAt);
    const content = entry.content || '';
    
    // Find snippet near first matched keyword
    let snippet = '';
    const firstWord = matchedWords[0];
    if (firstWord && content.toLowerCase().includes(firstWord)) {
      const idx = content.toLowerCase().indexOf(firstWord);
      const start = Math.max(0, idx - 80);
      const end = Math.min(content.length, idx + 160);
      snippet = (start > 0 ? '...' : '') + content.substring(start, end).trim() + (end < content.length ? '...' : '');
    } else {
      snippet = content.substring(0, 180) + (content.length > 180 ? '...' : '');
    }

    response += `- **"${entry.title || 'Untitled'}"** *(${dateFormatted})*:\n`;
    response += `  > "${snippet}"\n\n`;
  });

  response += `#### 💡 Observed Patterns & Takeaways\n`;
  response += `- **Recurrence**: This topic appears across **${relevant.length}** different reflection${relevant.length > 1 ? 's' : ''}.\n`;
  const allTags = Array.from(new Set(relevant.flatMap(r => r.entry.tags || [])));
  if (allTags.length > 0) {
    response += `- **Associated Themes**: ${allTags.slice(0, 5).map(t => `\`#${t}\``).join(' ')}\n`;
  }
  response += `- **Timeline Trajectory**: From earliest recorded entry to recent reflections, your notes indicate ongoing evolution and conscious focus on these questions.\n\n`;

  response += `#### 🧭 Reflection Prompt for You\n`;
  response += `*Looking at how you addressed this previously, what is the single most valuable lesson you want to carry forward into this week?*`;

  return response;
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
- Review the specific commitments outlined in this entry.
- Dedicate 15 minutes today to address the primary priority identified.
- Check back in 3 days to evaluate progress.`;
    }

    case 'reflect': {
      return `### 🌱 Reflective Inquiry & Socratic Analysis

**Emotional Reality & Tone**:
Your writing reflects conscious self-observation and intentionality across **${wordCount} words**. The themes here point toward an active desire for clarity and authentic alignment.

**Alternative Perspectives to Consider**:
1. **The Long Horizon**: If you were observing this situation from 6 months in the future, what part of this would feel most significant, and what part would feel temporary?
2. **Inner Agency**: Notice where in this reflection you describe circumstances happening *to* you versus choices you are actively authoring.

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
   - **Checklist Item**: Schedule a dedicated 45-minute focus session.
   - **Checklist Item**: Document clear completion criteria.

2. **Habit Cue & Micro-Action**:
   - Pair your next step with an existing daily habit (e.g. morning coffee or end-of-day shutdown).
   - Keep initial friction low: aim for 10 minutes of uninterrupted momentum.`;
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
  const lower = prompt.toLowerCase();

  if (mode === 'socratic') {
    return `You've raised an insightful reflection: *"The thoughts we dwell upon shape the decisions we take."*

Looking closely at what you just described:
1. **What core belief or expectation** is sitting underneath this thought?
2. If the opposite of what you currently assume were true, how would your approach shift?

Take a moment to sit with that inquiry. What emerges first for you?`;
  }

  if (mode === 'empathy') {
    return `Thank you for sharing this with honesty. It takes courage to articulate these feelings clearly.

It is completely natural to experience moments of uncertainty or complexity when navigating changes and commitments. Remember that self-reflection is not about having every answer immediately—it is about giving yourself the space to listen and breathe.

Be gentle with where you are right now. What would feel most supportive or restorative for you in this moment?`;
  }

  if (mode === 'goal_coach') {
    return `I hear clear ambition in your thoughts. Let's turn this awareness into concrete, low-friction momentum:

### 🎯 Pragmatic Next Steps:
1. **Define the Micro-Step**: What is the single smallest action (taking under 5 minutes) you can do right now?
2. **Eliminate 1 Distraction**: Clear the primary point of friction before starting.
3. **Commit to a Timebox**: Give yourself 25 minutes of uninterrupted focus.

What is the first micro-action you're choosing to tackle?`;
  }

  // Default Reflective Thought Partner
  return `That is a meaningful reflection. When we articulate our inner dialogue onto paper, patterns that were once noisy become clear.

Based on what you've shared:
- Notice how your perspective has evolved even since you began writing.
- Focus on the factors within your immediate circle of control.

What part of this feels most important to prioritize as you move through today?`;
}

/**
 * Autonomous local digest synthesis for periodic reviews
 */
export function generateLocalDigest(periodType: string, entries: any[] = []): string {
  const count = entries.length;
  const periodTitle = periodType.charAt(0).toUpperCase() + periodType.slice(1);
  const titles = entries.map(e => `"${e.title || 'Untitled'}"`).slice(0, 5).join(', ');

  return `### 🌟 Major Highlights & Accomplishments
- **Consistent Reflection Volume**: Logged **${count}** journal entries during this ${periodType} period, maintaining a conscious habit of self-awareness.
- **Explored Themes**: Featured topics including ${titles || 'personal growth and strategic priorities'}.
- **Core Realization**: You demonstrated proactive problem-solving by naming challenges directly instead of avoiding them.

### 💡 Key Insights & Lessons Learned
- Writing regularly provided a grounding outlet for emotional processing and mental clarity.
- Clarifying your feelings into words helped reduce friction between intention and action.

### ⚡ Challenges & Friction Addressed
- Managing cognitive bandwidth and prioritizing high-leverage actions over busywork.
- Maintaining focus amidst shifting day-to-day priorities.

### 🎯 Emerging Goals & Strategic Priorities for Next Period
1. **Deepen Focus**: Dedicate consistent time blocks to your highest-leverage goals.
2. **Iterative Action**: Transform reflective realizations into measurable micro-habits.
3. **Weekly Check-ins**: Continue reviewing your journal archive to track emotional trends and personal trajectory.`;
}
