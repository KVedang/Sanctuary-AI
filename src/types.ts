export type MoodType = 'great' | 'good' | 'neutral' | 'difficult' | 'reflective';

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  aiAnalysisAllowed: boolean;
  saveAiResponses: boolean;
  useHistoryForAsk: boolean;
  autoSummaries: boolean;
  dailyReminderEnabled?: boolean;
}

export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: string;
  lastLoginAt: string;
  settings: UserSettings;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  tags: string[];
  mood?: MoodType;
  isFavorite: boolean;
  isPinned: boolean;
  isArchived: boolean;
  aiSummary?: string;
  extractedActionItems?: string[];
  wordCount: number;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export type AiMode = 
  | 'reflect' 
  | 'summarize' 
  | 'brainstorm' 
  | 'goal_coach' 
  | 'writing_assistant' 
  | 'analytical' 
  | 'ask_journal';

export interface MessageMetadata {
  promptTokens?: number;
  candidateTokens?: number;
  totalTokens?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  model: string;
  createdAt: string;
  metadata?: MessageMetadata;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  linkedJournalId?: string;
  mode: AiMode;
  summary?: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GoalTask {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'not_started' | 'in_progress' | 'completed' | 'abandoned';
  progress: number; // 0 to 100
  targetDate?: string;
  howToAchieve?: string[];
  tasks: GoalTask[];
  extractedFromJournalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InsightDigest {
  id: string;
  userId: string;
  periodType: 'daily' | 'weekly' | 'monthly';
  periodStart: string;
  periodEnd: string;
  keyThemes: string[];
  observations: string[];
  accomplishments: string[];
  suggestedFocusAreas: string[];
  isAiGenerated: boolean;
  generatedAt: string;
}

export interface GoalSuggestion {
  hasGoal: boolean;
  title?: string;
  description?: string;
  reason?: string;
  priority?: 'low' | 'medium' | 'high';
  howToAchieve?: string[];
  tasks?: string[];
}

export interface StructuredReflection {
  summary: string;
  explicitStatements: string[];
  inferredPatterns: string[];
  suggestedPerspectives: string[];
  themes: string[];
  keyConcerns: string[];
  emotions: string[];
  thinkingPatterns: string[];
  positiveObservations: string[];
  growthAreas: string[];
  actionableOpportunities: string[];
  inquiryQuestions: string[];
  goalSuggestion?: GoalSuggestion;
}

export interface GoalProgressCoaching {
  goalId: string;
  goalTitle: string;
  completedSummary: string;
  remainingSummary: string;
  potentialObstacle: string;
  recommendedNextStep: string;
  suggestedSubtasks?: string[];
  adjustments?: string;
}

export interface AskJournalCitation {
  id?: string;
  title: string;
  date: string;
  excerptSnippet?: string;
}

export interface AskJournalResponse {
  answer: string;
  citedEntries: AskJournalCitation[];
  hasSufficientEvidence: boolean;
  modelUsed?: string;
  notice?: string;
}

export interface AIResponsePayload {
  result: string;
  mode: AiMode;
  modelUsed: string;
  keyPoints?: string[];
  actionItems?: string[];
  suggestedGoals?: { title: string; description: string; priority: 'low' | 'medium' | 'high' }[];
  structuredData?: StructuredReflection;
}
