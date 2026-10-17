/**
 * KPay Cyber Security Engine: Input Sanitizer & Tamper-Evident Session Sealer
 * Author: rdxkeerthi
 */

import { createHmac } from 'crypto';
import { constantTimeEqual } from './crypto.js';

/**
 * Sanitizes user/merchant inputs to prevent XSS, Unicode spoofing,
 * Zero-Width character evasion, and Bi-Directional text reversal attacks.
 */
export function sanitizePaymentInput(raw: string, maxLength = 256): string {
  if (typeof raw !== 'string') {
    return '';
  }

  return raw
    // Strip Zero-Width characters (\u200B, \u200C, \u200D, \uFEFF)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Strip Bi-Directional Unicode overrides (RTL/LTR spoofing)
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, '')
    // Strip HTML tags / script tags to prevent stored XSS
    .replace(/<[^>]*>?/gm, '')
    // Replace dangerous shell/control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Validates and sanitizes a UPI Transaction Note according to NPCI specifications.
 * Length must be <= 128 characters without special reserved symbols.
 */
export function sanitizeUpiNote(note?: string): string {
  if (!note) return 'Payment';
  const clean = sanitizePaymentInput(note, 128);
  // Remove URI-breaking characters like '&', '=', '?'
  return clean.replace(/[&=?#]/g, ' ').replace(/\s+/g, ' ').trim() || 'Payment';
}

/**
 * Structure of a Tamper-Evident Payment Session.
 */
export interface PaymentSessionPayload {
  orderId: string;
  amount: number;
  vpa: string;
  currency: string;
  createdAt: number;
  nonce: string;
}

/**
 * Generates an HMAC-SHA256 tamper-evident cryptographic seal for a payment session.
 * Protects against Man-In-The-Middle parameter tampering (e.g. altering amount or payee VPA).
 */
export function sealPaymentSession(payload: PaymentSessionPayload, secretKey: string): string {
  if (!secretKey || secretKey.length < 16) {
    throw new Error('KPay Security: Secret key for session sealing must be at least 16 characters.');
  }

  const serialized = [
    payload.orderId,
    payload.amount.toFixed(2),
    payload.vpa.toLowerCase().trim(),
    payload.currency.toUpperCase(),
    payload.createdAt,
    payload.nonce,
  ].join('|');

  return createHmac('sha256', secretKey).update(serialized, 'utf8').digest('hex');
}

/**
 * Verifies the integrity of a payment session seal.
 * Returns true if and only if the session parameters match exactly and haven't been altered.
 */
export function verifyPaymentSession(
  payload: PaymentSessionPayload,
  receivedSeal: string,
  secretKey: string
): boolean {
  if (!receivedSeal || !secretKey) {
    return false;
  }

  try {
    const expectedSeal = sealPaymentSession(payload, secretKey);
    return constantTimeEqual(expectedSeal, receivedSeal);
  } catch {
    return false;
  }
}
