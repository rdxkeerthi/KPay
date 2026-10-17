// ============================================================================
// KPay Security — Cryptographic Primitives & Timing Attack Protections
// ============================================================================

import { createHmac, createHash, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';

/**
 * Constant-time string comparison to prevent timing attacks.
 * Uses Node.js crypto.timingSafeEqual with safe padding to ensure
 * execution time is independent of byte differences and string lengths.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;

  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');

  // If lengths differ, pad the shorter buffer to match the longer one,
  // execute timingSafeEqual, but record the length difference in mismatch.
  const maxLen = Math.max(bufA.length, bufB.length);
  const padA = Buffer.alloc(maxLen, 0);
  const padB = Buffer.alloc(maxLen, 0);

  bufA.copy(padA);
  bufB.copy(padB);

  const areBuffersEqual = timingSafeEqual(padA, padB);
  return areBuffersEqual && bufA.length === bufB.length;
}

/**
 * Compute an HMAC-SHA256 hex digest.
 */
export function hmacSha256(payload: string | Buffer, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Compute a SHA-256 hex digest.
 */
export function sha256(payload: string | Buffer): string {
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Deterministically stringifies an object by recursively sorting its keys.
 * Crucial for signature generation where JSON key ordering matters.
 */
export function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return `[${obj.map(item => stableStringify(item)).join(',')}]`;
  }

  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = sortedKeys
    .filter(k => (obj as Record<string, unknown>)[k] !== undefined)
    .map(k => `${JSON.stringify(k)}:${stableStringify((obj as Record<string, unknown>)[k])}`);

  return `{${pairs.join(',')}}`;
}

/**
 * Validates if a webhook or transaction timestamp is within an acceptable fresh window.
 */
export function isTimestampFresh(timestamp: number | string, toleranceSeconds = 300): boolean {
  let tsMillis: number;

  if (typeof timestamp === 'number') {
    // If given in seconds, convert to milliseconds
    tsMillis = timestamp < 1e11 ? timestamp * 1000 : timestamp;
  } else {
    tsMillis = new Date(timestamp).getTime();
  }

  if (Number.isNaN(tsMillis)) return false;

  const now = Date.now();
  const maxAgeMillis = toleranceSeconds * 1000;
  // Disallow timestamps too far in the past or far in the future (clock drift allow 30s)
  return Math.abs(now - tsMillis) <= maxAgeMillis;
}

// ─── Paytm AES-128-CBC Checksum Support ──────────────────────────────────

const PAYTM_IV = '@@@@&&&&####$$$$';

export function getPaytmParamsString(params: Record<string, unknown>): string {
  return Object.keys(params)
    .sort()
    .filter(key => key !== 'CHECKSUMHASH' && params[key] !== null && params[key] !== undefined && params[key] !== '')
    .map(key => String(params[key]))
    .join('|');
}

export function generatePaytmChecksum(paramsString: string, merchantKey: string): string {
  const cipher = createCipheriv('aes-128-cbc', Buffer.from(merchantKey, 'utf8'), Buffer.from(PAYTM_IV, 'utf8'));
  let encrypted = cipher.update(paramsString, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

export function verifyPaytmChecksum(paramsString: string, merchantKey: string, checksum: string): boolean {
  try {
    const decipher = createDecipheriv('aes-128-cbc', Buffer.from(merchantKey, 'utf8'), Buffer.from(PAYTM_IV, 'utf8'));
    let decrypted = decipher.update(checksum, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return constantTimeEqual(paramsString, decrypted);
  } catch {
    return false;
  }
}
