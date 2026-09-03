import { Request, Response, NextFunction } from 'express';

interface RateRecord {
  minuteCount: number;
  minuteResetAt: number;
  dayCount: number;
  dayResetAt: number;
}

const userRateStore = new Map<string, RateRecord>();

const MAX_PER_MINUTE = 20;
const MAX_PER_DAY = 500;

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const uid = req.user?.uid;
  if (!uid) {
    next();
    return;
  }

  const now = Date.now();
  let record = userRateStore.get(uid);

  if (!record) {
    record = {
      minuteCount: 1,
      minuteResetAt: now + 60 * 1000,
      dayCount: 1,
      dayResetAt: now + 24 * 60 * 60 * 1000,
    };
    userRateStore.set(uid, record);
    next();
    return;
  }

  // Check & reset minute window
  if (now > record.minuteResetAt) {
    record.minuteCount = 0;
    record.minuteResetAt = now + 60 * 1000;
  }

  // Check & reset day window
  if (now > record.dayResetAt) {
    record.dayCount = 0;
    record.dayResetAt = now + 24 * 60 * 60 * 1000;
  }

  if (record.minuteCount >= MAX_PER_MINUTE) {
    res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'You have reached your AI request limit for this minute (20 req/min). Please pause briefly.',
      retryAfterSeconds: Math.ceil((record.minuteResetAt - now) / 1000),
    });
    return;
  }

  if (record.dayCount >= MAX_PER_DAY) {
    res.status(429).json({
      error: 'DAILY_QUOTA_EXCEEDED',
      message: 'You have reached your daily quota of 500 AI operations. Quota will reset tomorrow.',
    });
    return;
  }

  record.minuteCount++;
  record.dayCount++;
  next();
}
