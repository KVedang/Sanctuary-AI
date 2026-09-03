/**
 * Safely parses any Firestore timestamp representation into a valid ISO string.
 * Handles:
 * - Firestore Timestamp instances with toDate()
 * - Serialized Firestore timestamps with seconds/nanoseconds
 * - Date objects
 * - Valid ISO strings or date strings
 * - FieldValue objects or sentinels with {_methodName: ...}
 * - null or undefined
 * Guarantees NEVER returning an object or invalid string.
 */
export function parseFirestoreDate(val: unknown): string {
  if (!val) {
    return new Date().toISOString();
  }

  // If it's a Firestore Timestamp instance with toDate()
  if (typeof (val as any).toDate === 'function') {
    try {
      const d = (val as any).toDate();
      if (d instanceof Date && !isNaN(d.getTime())) {
        return d.toISOString();
      }
    } catch {
      // ignore
    }
  }

  // If it's a serialized Timestamp object with seconds
  if (typeof (val as any).seconds === 'number') {
    const d = new Date((val as any).seconds * 1000);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }

  // If it's already a Date instance
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      return val.toISOString();
    }
  }

  // If it's a string
  if (typeof val === 'string') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }

  // If it's a number (epoch milliseconds or seconds)
  if (typeof val === 'number') {
    const d = new Date(val > 1e11 ? val : val * 1000);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }

  // Any other object (like {_methodName: 'serverTimestamp'}) or unrecognized format
  return new Date().toISOString();
}

/**
 * Zero-Crash Payload Hygiene Utility
 * Strips all `undefined` values deeply from objects before writing to Firestore.
 * Also safely converts FieldValue sentinels to ISO strings to prevent raw object leaks.
 */
export function sanitizePayload<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizePayload(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    // If it has _methodName (e.g. serverTimestamp sentinel), convert it to ISO string
    if ((obj as any)._methodName === 'serverTimestamp') {
      return new Date().toISOString() as unknown as T;
    }
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== undefined) {
        cleaned[key] = sanitizePayload(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

export function formatDate(val: unknown): string {
  if (!val) return 'Just now';

  const isoString = parseFirestoreDate(val);
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return 'Recently';
    }
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch {
    return 'Recently';
  }
}

export function formatRelativeTime(val: unknown): string {
  if (!val) return 'Just now';

  const isoString = parseFirestoreDate(val);
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return 'Recently';
    }
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (isNaN(diffMs)) return 'Recently';

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(isoString);
  } catch {
    return 'Recently';
  }
}

export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}
