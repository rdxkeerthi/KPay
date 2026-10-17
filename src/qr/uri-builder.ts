// ============================================================================
// KPay QR — NPCI Compliant UPI URI & App Intent Link Builder
// ============================================================================

import type { UPIQRRequest, UPIIntentLink } from '../types.js';
import { validateQRRequest } from '../security/validation.js';

/**
 * Builds a strict NPCI-compliant UPI URI.
 *
 * Specification:
 * - pa: Payee VPA
 * - pn: Payee Name
 * - am: Amount in rupees (two decimal places)
 * - tr: Merchant Transaction Reference ID
 * - cu: Currency code (INR)
 * - mode: '04' for non-editable, locked amount; '00' for open
 * - mc: Optional Merchant Category Code (4 digits)
 * - tn: Optional Transaction note
 */
export function buildUPIUri(request: UPIQRRequest): string {
  validateQRRequest(request);

  const params = new URLSearchParams();
  params.set('pa', request.vpa);
  params.set('pn', request.name);
  params.set('am', request.amount.toFixed(2));
  params.set('tr', request.orderId);
  params.set('cu', 'INR');

  // NPCI Mode: '04' locks amount (user cannot change amount)
  const mode = request.mode ?? 'fixed';
  if (mode === 'fixed') {
    params.set('mode', '04');
  } else {
    params.set('mode', '00');
  }

  if (request.mc) {
    params.set('mc', request.mc);
  }

  if (request.note) {
    params.set('tn', request.note);
  }

  return `upi://pay?${params.toString()}`;
}

/**
 * Builds app-specific intent links for Indian mobile payment apps:
 * - PhonePe, Google Pay (Tez), Paytm, BHIM, CRED, Amazon Pay.
 */
export function buildIntentLinks(upiUri: string): UPIIntentLink {
  const queryString = upiUri.replace(/^upi:\/\/pay\?/, '');

  return {
    generic: upiUri,
    phonepe: `phonepe://pay?${queryString}`,
    gpay: `tez://upi/pay?${queryString}`,
    paytm: `paytmmp://pay?${queryString}`,
    bhim: `upi://pay?${queryString}`,
    cred: `credpay://upi/pay?${queryString}`,
    amazonpay: `amazonpay://upi/pay?${queryString}`,
  };
}
