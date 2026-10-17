// ============================================================================
// KPay Security — Amount Integrity & Underpayment Guard
// ============================================================================

import { SecurityViolationError } from '../errors.js';
import type { Provider } from '../types.js';

/**
 * Validates that the amount reported by a PSP or webhook callback matches
 * the expected order amount down to the exact paise.
 *
 * This prevents amount-substitution attacks where an attacker pays ₹1 to fulfill a ₹10,000 order.
 */
export function verifyAmountIntegrity(
  receivedAmountPaise: number | undefined,
  expectedAmountPaise: number | undefined,
  provider: Provider,
  orderId: string,
): void {
  if (expectedAmountPaise === undefined) {
    return; // Caller opted out or didn't supply expected amount
  }

  if (receivedAmountPaise === undefined || receivedAmountPaise === null) {
    throw new SecurityViolationError(
      `Amount verification failed for order "${orderId}": PSP did not return an amount. Expected ${expectedAmountPaise} paise.`,
      { provider, code: 'SECURITY_MISSING_AMOUNT' },
    );
  }

  if (receivedAmountPaise !== expectedAmountPaise) {
    throw new SecurityViolationError(
      `CRITICAL AMOUNT TAMPERING DETECTED for order "${orderId}" (${provider}): Expected ${expectedAmountPaise} paise (₹${(expectedAmountPaise / 100).toFixed(2)}), but received ${receivedAmountPaise} paise (₹${(receivedAmountPaise / 100).toFixed(2)}).`,
      {
        provider,
        code: 'SECURITY_AMOUNT_MISMATCH',
        metadata: { expectedAmountPaise, receivedAmountPaise, orderId },
      },
    );
  }
}
