// ============================================================================
// KPay QR — NPCI Compliant UPI URI & App Intent Link Builder
// ============================================================================

import type { UPIQRRequest, UPIIntentLink } from '../types.js';
import { validateQRRequest } from '../security/validation.js';

/**
 * Builds an NPCI-compliant UPI URI.
 *
 * Automatically handles the difference between:
 * 1. Personal Bank Accounts (P2P):
 *    Oromits `mode=04` and merchant-only tags to eliminate "Paytm Protect" and
 *    NPCI UPI Risk Policy alerts ("This payment may fail as per UPI Risk Policy...").
 * 2. Verified Merchant Accounts (P2M):
 *    Applies `mode=04` (locked non-editable amount), MCC code, and transaction references.
 */
export function buildUPIUri(request: UPIQRRequest): string {
  validateQRRequest(request);

  const isPersonal = request.accountType === 'personal' || (!request.mc && request.accountType !== 'merchant');

  const params = new URLSearchParams();
  params.set('pa', request.vpa);
  params.set('pn', request.name);
  params.set('am', request.amount.toFixed(2));
  params.set('cu', 'INR');

  if (!isPersonal) {
    // ── Verified Merchant Flow (P2M) ──────────────────────────────────
    // mode=04 locks the amount in the user's UPI app (NPCI spec for verified merchants).
    // MUST NOT be sent for personal P2P accounts as it triggers Paytm Protect & risk policy blocks.
    const mode = request.mode ?? 'fixed';
    if (mode === 'fixed') {
      params.set('mode', '04');
    } else {
      params.set('mode', '00');
    }

    params.set('tr', request.orderId);

    if (request.mc) {
      params.set('mc', request.mc);
    }
  } else {
    // ── Personal Account Flow (P2P) ───────────────────────────────────
    // Clean, unflagged P2P transfer parameters.
    // Preserves orderId in the note (tn) without triggering merchant impersonation filters.
    if (request.mode === 'open') {
      params.set('mode', '00');
    }
    // Only add transaction note if present
    if (request.note) {
      params.set('tn', request.note);
    } else {
      params.set('tn', `Pay ${request.orderId}`);
    }
  }

  if (request.url) {
    params.set('url', request.url);
  }

  return `upi://pay?${params.toString()}`;
}

/**
 * Builds app-specific intent links for Indian mobile payment apps:
 * - PhonePe, Google Pay (Tez), Paytm, BHIM, CRED, Amazon Pay, and direct UPI mobile intent.
 */
export function buildIntentLinks(upiUri: string, mobileNumber?: string): UPIIntentLink {
  const queryString = upiUri.replace(/^upi:\/\/pay\?/, '');

  const links: UPIIntentLink = {
    generic: upiUri,
    phonepe: `phonepe://pay?${queryString}`,
    gpay: `tez://upi/pay?${queryString}`,
    paytm: `paytmmp://pay?${queryString}`,
    bhim: `upi://pay?${queryString}`,
    cred: `credpay://upi/pay?${queryString}`,
    amazonpay: `amazonpay://upi/pay?${queryString}`,
  };

  if (mobileNumber && /^[6-9]\d{9}$/.test(mobileNumber)) {
    // UPI Number Intent: allows direct transfer to mobile number via NPCI Mapper
    links.mobileIntent = `upi://pay?pa=${mobileNumber}@upi&cu=INR`;
  }

  return links;
}
