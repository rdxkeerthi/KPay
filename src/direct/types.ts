// ============================================================================
// KPay Direct UPI — Types for Personal & Current Account Direct Payments
// ============================================================================

export interface ParsedBankNotification {
  isCredit: boolean;
  bank: string;
  amountPaise: number;
  utr?: string; // 12-digit UPI RRN / UTR number
  accountTail?: string; // Last 3-4 digits of bank account
  payerVpa?: string;
  orderIdCandidate?: string;
  timestamp: number;
  rawText: string;
}

export interface UTRVerificationResult {
  verified: boolean;
  orderId: string;
  utr: string;
  amountPaise: number;
  matchedVia: 'manual_submission' | 'sms_ingestion' | 'bank_reconciliation';
  message: string;
}
