// ============================================================================
// KPay Security — Input Validation & Sanitization Engine
// ============================================================================

import { InvalidConfigError, SecurityViolationError } from '../errors.js';
import type { CreatePaymentRequest, UPIQRRequest, Environment } from '../types.js';

// Order ID regex: Only alphanumeric characters, hyphens, underscores, and dots (1-64 chars)
const ORDER_ID_REGEX = /^[a-zA-Z0-9._-]{1,64}$/;

// Indian mobile number: 10 digits starting with 6, 7, 8, or 9
const INDIAN_PHONE_REGEX = /^[6-9]\d{9}$/;

// NPCI VPA regex: username@psp (e.g. merchant@icici, 9876543210@paytm)
const UPI_VPA_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

// NPCI MCC: 4-digit code (ISO 18245)
const MCC_REGEX = /^\d{4}$/;

/**
 * Validates that an orderId is safe against path traversal, command injection, and SQL injection.
 */
export function validateOrderId(orderId: unknown): asserts orderId is string {
  if (typeof orderId !== 'string' || !ORDER_ID_REGEX.test(orderId)) {
    throw new InvalidConfigError(
      `Invalid orderId: "${String(orderId)}". Order IDs must contain only alphanumeric characters, dots, hyphens, and underscores (1-64 characters).`,
      { code: 'INVALID_ORDER_ID' },
    );
  }

  // Explicitly check for path traversal patterns
  if (orderId.includes('..') || orderId.includes('/') || orderId.includes('\\')) {
    throw new SecurityViolationError(
      `Potential path traversal detected in orderId: "${orderId}"`,
      { code: 'SECURITY_PATH_TRAVERSAL' },
    );
  }
}

/**
 * Normalizes an Indian phone number to standard 10-digit format.
 * Strips '+91', '91', spaces, hyphens, and leading zeros.
 */
export function normalizePhoneNumber(phone: unknown): string {
  if (typeof phone !== 'string') {
    throw new InvalidConfigError('Customer phone number must be a string.', { code: 'INVALID_PHONE' });
  }

  // Strip non-digits
  let digits = phone.replace(/\D/g, '');

  if (digits.startsWith('91') && digits.length === 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }

  if (!INDIAN_PHONE_REGEX.test(digits)) {
    throw new InvalidConfigError(
      `Invalid Indian mobile number: "${phone}". Must be a valid 10-digit number starting with 6, 7, 8, or 9.`,
      { code: 'INVALID_PHONE' },
    );
  }

  return digits;
}

/**
 * Validates an NPCI UPI Virtual Payment Address (VPA).
 */
export function validateVpa(vpa: unknown): asserts vpa is string {
  if (typeof vpa !== 'string' || !UPI_VPA_REGEX.test(vpa)) {
    throw new InvalidConfigError(
      `Invalid UPI VPA: "${String(vpa)}". Must follow standard format (e.g., yourname@bank).`,
      { code: 'INVALID_VPA' },
    );
  }
}

/**
 * Validates that an amount in paise is a positive integer.
 */
export function validatePaiseAmount(amount: unknown): asserts amount is number {
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
    throw new InvalidConfigError(
      `Invalid amount: ${String(amount)}. Payment amount must be a positive integer in paise (e.g. 50000 = ₹500.00).`,
      { code: 'INVALID_AMOUNT' },
    );
  }

  // Maximum standard UPI single transaction limit set by NPCI (₹1,00,000 = 10,000,000 paise; ₹5,00,000 for hospital/education)
  if (amount > 50_000_000) {
    throw new InvalidConfigError(
      `Amount exceeds maximum allowed NPCI UPI transaction limit (₹5,00,000): received ${amount} paise.`,
      { code: 'AMOUNT_EXCEEDS_LIMIT' },
    );
  }
}

/**
 * Validates Merchant Category Code (MCC) if provided.
 */
export function validateMcc(mc?: string): void {
  if (mc && !MCC_REGEX.test(mc)) {
    throw new InvalidConfigError(`Invalid MCC: "${mc}". MCC must be a 4-digit numeric code.`, { code: 'INVALID_MCC' });
  }
}

/**
 * Validates full payment creation request before calling PSP.
 */
export function validatePaymentRequest(req: CreatePaymentRequest, _env: Environment): void {
  validateOrderId(req.orderId);
  validatePaiseAmount(req.amount);
  normalizePhoneNumber(req.customerPhone);

  if (!req.callbackUrl || typeof req.callbackUrl !== 'string') {
    throw new InvalidConfigError('callbackUrl is required and must be a valid URL string.');
  }

  if (!req.redirectUrl || typeof req.redirectUrl !== 'string') {
    throw new InvalidConfigError('redirectUrl is required and must be a valid URL string.');
  }
}

/**
 * Validates UPI QR generation request.
 */
export function validateQRRequest(req: UPIQRRequest): void {
  validateOrderId(req.orderId);
  validateVpa(req.vpa);

  if (typeof req.name !== 'string' || req.name.trim().length === 0) {
    throw new InvalidConfigError('Merchant name is required for UPI QR code.');
  }

  if (typeof req.amount !== 'number' || req.amount <= 0 || Number.isNaN(req.amount)) {
    throw new InvalidConfigError('QR amount must be a positive number in rupees.');
  }

  if (req.mc) {
    validateMcc(req.mc);
  }
}
