// ============================================================================
// KPay Direct UPI — NPCI App-to-Web Return Callback Parser & Verifier
// ============================================================================

import type { PaymentStatus } from '../types.js';

export interface UpiCallbackVerificationResult {
  verified: boolean;
  status: PaymentStatus;
  orderId?: string;
  utr?: string;
  txnId?: string;
  responseCode?: string;
  rawParams: Record<string, string>;
  message: string;
}

/**
 * Standard NPCI response codes returned by UPI apps (GPay, PhonePe, Paytm, BHIM).
 */
const NPCI_SUCCESS_CODES = new Set(['00', '0', 'SUCCESS', 'COMPLETED']);

/**
 * Parses and verifies the URL query parameters passed back when a customer
 * completes a payment in Google Pay, PhonePe, or Paytm and returns to your website.
 *
 * Supported params returned by UPI apps:
 * - Status: 'SUCCESS' | 'FAILURE' | 'SUBMITTED'
 * - txnId: Unique transaction identifier from the UPI switch
 * - responseCode: '00' (Success), 'ZM' (Invalid MPIN), etc.
 * - ApprovalRefNo: 12-digit Bank Reference Number / UTR
 * - txnRef: Your Order Reference ID
 */
export function parseUpiReturnCallback(
  input: URLSearchParams | Record<string, unknown> | string,
): UpiCallbackVerificationResult {
  const params: Record<string, string> = {};

  if (typeof input === 'string') {
    const searchString = input.includes('?') ? input.split('?')[1] : input;
    const urlParams = new URLSearchParams(searchString);
    for (const [k, v] of urlParams.entries()) {
      params[k.toLowerCase()] = v;
      params[k] = v;
    }
  } else if (input instanceof URLSearchParams) {
    for (const [k, v] of input.entries()) {
      params[k.toLowerCase()] = v;
      params[k] = v;
    }
  } else if (typeof input === 'object' && input !== null) {
    for (const [k, v] of Object.entries(input)) {
      if (typeof v === 'string') {
        params[k.toLowerCase()] = v;
        params[k] = v;
      }
    }
  }

  const rawStatus = (params.status || params['Status'] || '').toUpperCase();
  const responseCode = params.responsecode || params['responseCode'] || '';
  const txnId = params.txnid || params['txnId'] || params['transactionId'] || '';
  const orderId = params.txnref || params['txnRef'] || params.orderid || params['orderId'] || undefined;

  // Extract 12-digit UTR from ApprovalRefNo, rrn, refId, or utr
  let utr =
    params.approvalrefno ||
    params['ApprovalRefNo'] ||
    params.rrn ||
    params.refid ||
    params.utr ||
    undefined;

  // Validate UTR format if present
  if (utr && !/^\d{12}$/.test(utr)) {
    // If not strictly 12 digits, check if it contains a 12-digit substring
    const match = utr.match(/\b\d{12}\b/);
    utr = match ? match[0] : utr;
  }

  const isSuccess =
    rawStatus === 'SUCCESS' ||
    NPCI_SUCCESS_CODES.has(responseCode) ||
    (rawStatus === '' && responseCode === '00');

  if (isSuccess) {
    return {
      verified: true,
      status: 'SUCCESS',
      orderId,
      utr,
      txnId,
      responseCode: responseCode || '00',
      rawParams: params,
      message: 'Payment confirmed successfully via UPI App Return Intent.',
    };
  }

  if (rawStatus === 'SUBMITTED' || rawStatus === 'PENDING') {
    return {
      verified: false,
      status: 'PENDING',
      orderId,
      utr,
      txnId,
      responseCode,
      rawParams: params,
      message: 'Payment was submitted to banking switch and is currently pending settlement.',
    };
  }

  return {
    verified: false,
    status: 'FAILED',
    orderId,
    utr,
    txnId,
    responseCode,
    rawParams: params,
    message: `Payment failed or was cancelled by user (Status: ${rawStatus || 'UNKNOWN'}, Code: ${responseCode || 'N/A'}).`,
  };
}
