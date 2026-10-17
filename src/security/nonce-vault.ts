// ============================================================================
// KPay Security — Anti-Replay Nonce & Timestamp Vault
// ============================================================================

import { randomBytes } from 'node:crypto';
import { SecurityViolationError } from '../errors.js';

export class NonceVault {
  private readonly nonces = new Map<string, number>(); // nonce -> expiry timestamp
  private readonly ttlMs: number;

  constructor(ttlSeconds = 300) {
    this.ttlMs = ttlSeconds * 1000;
  }

  /**
   * Generates a cryptographically strong unique nonce.
   */
  generateNonce(bytes = 16): string {
    return randomBytes(bytes).toString('hex');
  }

  /**
   * Consumes a nonce. If the nonce was already used within the TTL window,
   * throws a SecurityViolationError to block the replay attack.
   */
  consumeNonce(nonce: string, source = 'webhook'): void {
    if (!nonce || typeof nonce !== 'string' || nonce.length < 8) {
      throw new SecurityViolationError(
        'Invalid or missing anti-replay nonce token.',
        { code: 'SECURITY_INVALID_NONCE' },
      );
    }

    const now = Date.now();
    this.cleanExpired(now);

    const expiry = this.nonces.get(nonce);
    if (expiry && expiry > now) {
      throw new SecurityViolationError(
        `CRITICAL REPLAY ATTACK BLOCKED: Nonce "${nonce}" from "${source}" was already consumed.`,
        { code: 'SECURITY_REPLAY_ATTACK_DETECTED', metadata: { nonce, source } },
      );
    }

    this.nonces.set(nonce, now + this.ttlMs);
  }

  private cleanExpired(now: number): void {
    for (const [nonce, expiry] of this.nonces.entries()) {
      if (expiry <= now) {
        this.nonces.delete(nonce);
      }
    }
  }

  clear(): void {
    this.nonces.clear();
  }
}

export const globalNonceVault = new NonceVault(300);
