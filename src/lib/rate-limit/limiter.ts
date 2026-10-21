import { NextRequest, NextResponse } from 'next/server';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory sliding window store
const rateLimitMap = new Map<string, RateLimitRecord>();

// Clean up expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      if (record.resetAt <= now) {
        rateLimitMap.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitOptions {
  limit?: number; // max requests within window
  windowSeconds?: number; // time window in seconds
  identifierPrefix?: string;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Checks and increments rate limit for a given request.
 */
export function checkRateLimit(
  req: NextRequest,
  options: RateLimitOptions = {}
): RateLimitResult {
  const { limit = 30, windowSeconds = 60, identifierPrefix = 'api' } = options;

  // Extract client IP or identifier
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const clientIp = forwarded?.split(',')[0].trim() || realIp || 'anonymous_client';

  const key = `${identifierPrefix}:${clientIp}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const current = rateLimitMap.get(key);

  if (!current || current.resetAt <= now) {
    const newRecord: RateLimitRecord = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitMap.set(key, newRecord);
    return {
      success: true,
      limit,
      remaining: Math.max(0, limit - 1),
      reset: Math.ceil((newRecord.resetAt - now) / 1000),
    };
  }

  current.count += 1;
  const remaining = Math.max(0, limit - current.count);
  const reset = Math.ceil((current.resetAt - now) / 1000);

  if (current.count > limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      reset,
    };
  }

  return {
    success: true,
    limit,
    remaining,
    reset,
  };
}

/**
 * Convenience helper to enforce rate limit on a Next.js route handler.
 * Returns null if allowed, or a 429 NextResponse if rate limit exceeded.
 */
export function enforceRateLimit(
  req: NextRequest,
  options: RateLimitOptions = {}
): NextResponse | null {
  const result = checkRateLimit(req, options);

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too many requests. Rate limit exceeded. Please try again shortly.',
        retryAfterSeconds: result.reset,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(result.reset),
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': String(result.remaining),
          'X-RateLimit-Reset': String(result.reset),
        },
      }
    );
  }

  return null;
}
