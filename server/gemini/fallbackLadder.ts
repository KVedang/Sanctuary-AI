import { GoogleGenAI } from '@google/genai';

/**
 * Resilient Model Fallback Ladder (Ordered by availability & latency):
 * 1. Primary: "gemini-3.6-flash"
 * 2. High-Availability Fallback: "gemini-3.1-flash-lite"
 * 3. Dynamic Alias: "gemini-flash-latest"
 * 4. Deep Reasoning Fallback: "gemini-3.7-flash"
 */
export const MODEL_FALLBACK_LADDER = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
];

// In-memory circuit breaker cooldown to temporarily bypass models experiencing demand spikes
const modelCooldowns = new Map<string, number>();
const COOLDOWN_DURATION_MS = 60_000; // 60 seconds

let genAiInstance: GoogleGenAI | null = null;

export function getGenAI(): GoogleGenAI {
  if (!genAiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing.');
    }
    genAiInstance = new GoogleGenAI({ apiKey });
  }
  return genAiInstance;
}

export interface GenerateOptions {
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  responseSchema?: any;
}

export interface FallbackResult {
  text: string;
  modelUsed: string;
  isLocalFallback?: boolean;
}

/**
 * Robust JSON parser that handles markdown code blocks and raw JSON text.
 */
export function safeJsonParse<T = any>(text: string, fallback: T | null = null): T | null {
  if (!text || typeof text !== 'string') return fallback;
  const trimmed = text.trim();

  // Try direct parse first
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Continue to pattern extraction
  }

  // Look for ```json ... ``` blocks
  const jsonBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim()) as T;
    } catch {
      // Continue
    }
  }

  // Look for first '{' and last '}'
  const startIdx = trimmed.indexOf('{');
  const endIdx = trimmed.lastIndexOf('}');
  if (startIdx !== -1 && endIdx > startIdx) {
    try {
      const candidate = trimmed.substring(startIdx, endIdx + 1);
      return JSON.parse(candidate) as T;
    } catch {
      // Continue
    }
  }

  return fallback;
}

/**
 * Detects if the error is specifically related to depleted prepayment credits or billing exhaustion.
 */
export function isCreditDepletionError(err: any): boolean {
  if (!err) return false;
  const msg = String(err?.message || err?.error?.message || err || '').toLowerCase();
  return (
    msg.includes('prepayment credits') ||
    msg.includes('credits are depleted') ||
    msg.includes('resource_exhausted') ||
    msg.includes('billing#prepay') ||
    msg.includes('billing')
  );
}

/**
 * Extracts a clean, human-readable error description, stripping raw JSON strings.
 */
export function extractCleanErrorMessage(err: any): string {
  if (!err) return 'Upstream service unavailable';
  const raw = String(err?.message || err?.error?.message || err || '');
  
  if (isCreditDepletionError(err)) {
    return 'Your Google AI Studio prepayment credits are depleted. Please manage your project billing at https://ai.studio/projects.';
  }

  try {
    // Check if the raw message contains embedded JSON
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed?.error?.message) {
        return parsed.error.message.trim();
      }
    }
  } catch {
    // Ignore JSON parse errors
  }

  return raw.replace(/All Gemini models in fallback ladder failed:\s*/i, '').trim();
}

/**
 * Determines if an error from the Gemini API is a recoverable status code or network fault
 * (503 UNAVAILABLE, 429 RESOURCE_EXHAUSTED, 404 NOT_FOUND, 500 INTERNAL, high demand spikes, fetch/timeout issues).
 */
function isRecoverableError(err: any): boolean {
  if (!err) return false;
  const status = err?.status || err?.code || err?.error?.code || (typeof err?.status === 'string' ? parseInt(err.status, 10) : 0);
  const msg = String(err?.message || err?.error?.message || err || '').toLowerCase();

  return (
    status === 503 ||
    status === 429 ||
    status === 404 ||
    status === 500 ||
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('spikes in demand') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('internal error') ||
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('socket hang up') ||
    msg.includes('abort')
  );
}

/**
 * Sorts and filters the fallback ladder dynamically based on active cooldowns.
 * If all models are in cooldown, falls back to the original order.
 */
function getOrderedCandidates(): string[] {
  const now = Date.now();
  const available: string[] = [];
  const coolingDown: string[] = [];

  for (const model of MODEL_FALLBACK_LADDER) {
    const until = modelCooldowns.get(model) || 0;
    if (until > now) {
      coolingDown.push(model);
    } else {
      available.push(model);
    }
  }

  // If at least one candidate is healthy, prioritize healthy ones first
  if (available.length > 0) {
    return [...available, ...coolingDown];
  }
  return [...MODEL_FALLBACK_LADDER];
}

const MODEL_TIMEOUT_MS = 15_000; // 15s per model attempt to prevent hanging requests

/**
 * Executes content generation across the resilient fallback ladder.
 * Seamlessly transitions across fallback tiers on recoverable errors.
 */
export async function generateWithFallback(
  prompt: string,
  options: GenerateOptions = {}
): Promise<FallbackResult> {
  const ai = getGenAI();
  const candidates = getOrderedCandidates();
  let lastError: any = null;

  for (const model of candidates) {
    try {
      const config: Record<string, any> = {
        systemInstruction: options.systemInstruction,
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxOutputTokens ?? 2500,
      };

      if (options.responseMimeType) {
        config.responseMimeType = options.responseMimeType;
      }
      if (options.responseSchema) {
        config.responseSchema = options.responseSchema;
      }

      // For gemini-3.7-flash, cap thinking budget to keep fallback response immediate
      if (model.includes('3.7')) {
        config.thinkingConfig = { thinkingBudget: 0 };
      }

      // Race with timeout to ensure a slow or stalled model tier cascades immediately
      let timer: NodeJS.Timeout | null = null;
      const generatePromise = ai.models.generateContent({
        model,
        contents: prompt,
        config,
      });

      // Crucial: attach handler to prevent unhandled rejection crash if background request rejects after timeout
      generatePromise.catch((bgErr) => {
        // Suppress background rejection if already timed out or cascaded
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Model '${model}' timed out after ${MODEL_TIMEOUT_MS / 1000}s`));
        }, MODEL_TIMEOUT_MS);
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      if (timer) clearTimeout(timer);

      const text = response.text || '';
      // If previously in cooldown, clear it on successful execution
      modelCooldowns.delete(model);

      return {
        text,
        modelUsed: model,
      };
    } catch (err: any) {
      lastError = err;
      const recoverable = isRecoverableError(err);

      if (recoverable) {
        // Apply temporary cooldown so subsequent turns don't stall on this model
        modelCooldowns.set(model, Date.now() + COOLDOWN_DURATION_MS);
        console.info(
          `[Gemini Resilience] Model '${model}' unavailable or timed out. Cascading to next fallback tier.`
        );
      } else {
        console.warn(
          `[Gemini Resilience] Model '${model}' encountered unexpected error: ${err?.message || 'Unknown error'}. Trying next tier.`
        );
      }
      // Continue to next model in fallback ladder
    }
  }

  const cleanMsg = extractCleanErrorMessage(lastError);
  const errorObj = new Error(cleanMsg);
  (errorObj as any).isCreditsDepleted = isCreditDepletionError(lastError);
  (errorObj as any).originalError = lastError;
  throw errorObj;
}

