// ============================================================================
// KPay Security — In-Memory Sliding Window Rate Limiter & Flood Shield
// ============================================================================

import { SecurityViolationError } from '../errors.js';

interface RateLimitRecord {
  timestamps: number[];
}

export interface RateLimiterOptions {
  windowMs?: number; // Time window in milliseconds (default: 60,000 = 1 minute)
  maxRequests?: number; // Max requests per window (default: 60)
}

export class SlidingWindowRateLimiter {
  private readonly records = new Map<string, RateLimitRecord>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(options?: RateLimiterOptions) {
    this.windowMs = options?.windowMs ?? 60000;
    this.maxRequests = options?.maxRequests ?? 60;
  }

  /**
   * Checks whether a client identifier (e.g. IP or API key) is within rate limits.
   * Throws SecurityViolationError if the rate limit is exceeded.
   */
  check(identifier: string): { allowed: boolean; remaining: number; resetMs: number } {
    const now = Date.now();
    let record = this.records.get(identifier);

    if (!record) {
      record = { timestamps: [] };
      this.records.set(identifier, record);
    }

    // Filter out timestamps outside current sliding window
    record.timestamps = record.timestamps.filter(ts => now - ts < this.windowMs);

    if (record.timestamps.length >= this.maxRequests) {
      const oldest = record.timestamps[0] ?? now;
      const resetMs = Math.max(0, this.windowMs - (now - oldest));
      throw new SecurityViolationError(
        `Rate limit exceeded for "${identifier}". Allowed: ${this.maxRequests} req/${this.windowMs / 1000}s. Retry in ${Math.ceil(resetMs / 1000)}s.`,
        { code: 'SECURITY_RATE_LIMIT_EXCEEDED', metadata: { identifier, resetMs } },
      );
    }

    record.timestamps.push(now);
    const remaining = this.maxRequests - record.timestamps.length;
    const resetMs = this.windowMs;

    return { allowed: true, remaining, resetMs };
  }

  reset(identifier: string): void {
    this.records.delete(identifier);
  }

  clear(): void {
    this.records.clear();
  }
}
