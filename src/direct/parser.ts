// ============================================================================
// KPay Direct UPI — Multi-Bank Credit SMS & Notification Parser
// ============================================================================

import type { ParsedBankNotification } from './types.js';

// Regex to identify that this is an incoming CREDIT transaction (not debit/ATM)
const CREDIT_INDICATOR_REGEX = /\b(credited|credit|received|deposited|added to|has been credited)\b/i;
const DEBIT_EXCLUSION_REGEX = /\b(debited|debit|withdrawn|spent|paid to|sent to)\b/i;

// Amount patterns: Rs 499.00 | INR 499.00 | ₹ 499.00 | Rs.499
const AMOUNT_REGEX = /(?:INR|Rs\.?|₹)\s*([\d,]+\.?\d*)/i;

// 12-digit UPI UTR / RRN patterns
// e.g. "UPI/429182736451", "UPI:429182736451", "Ref no 429182736451", "RRN 429182736451"
const UTR_PATTERNS = [
  /(?:UPI|Ref|RRN|UTR)[/:\s-]*(\d{12})\b/i,
  /\b(\d{12})\b/, // Standalone 12 digits
];

// Account tail: XX1234 | **1234 | a/c 1234 | account ending 1234
const ACCOUNT_TAIL_REGEX = /(?:a\/c|acct|account|ending|no\.?)\s*(?:[xX*]*(\d{3,4}))/i;

// Order ID pattern if embedded in payment note: ORD_XXXX | ORDER_XXXX | KP_XXXX | INV_XXXX
const ORDER_ID_REGEX = /\b(ORD_[a-zA-Z0-9_-]+|ORDER_[a-zA-Z0-9_-]+|KP_[a-zA-Z0-9_-]+|INV_[a-zA-Z0-9_-]+)\b/i;

/**
 * Identifies the sending bank from SMS header or text body.
 */
function detectBank(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('hdfc')) return 'HDFC';
  if (lower.includes('sbi') || lower.includes('state bank')) return 'SBI';
  if (lower.includes('icici')) return 'ICICI';
  if (lower.includes('axis')) return 'AXIS';
  if (lower.includes('kotak')) return 'KOTAK';
  if (lower.includes('punjab national') || lower.includes('pnb')) return 'PNB';
  if (lower.includes('bank of baroda') || lower.includes('bob')) return 'BOB';
  if (lower.includes('paytm')) return 'PAYTM_BANK';
  return 'GENERIC_UPI_BANK';
}

/**
 * Parses raw bank SMS or notification text to extract verified credit details.
 * Returns null if the notification is a debit or does not contain valid UPI credit markers.
 */
export function parseBankCreditNotification(rawText: string): ParsedBankNotification | null {
  if (!rawText || typeof rawText !== 'string') return null;

  // Ensure message is a credit and NOT a debit
  const isCredit = CREDIT_INDICATOR_REGEX.test(rawText);
  const isDebit = DEBIT_EXCLUSION_REGEX.test(rawText);

  if (!isCredit || isDebit) {
    return null;
  }

  // 1. Extract amount
  const amountMatch = rawText.match(AMOUNT_REGEX);
  if (!amountMatch || !amountMatch[1]) {
    return null;
  }

  const cleanAmountStr = amountMatch[1].replace(/,/g, '');
  const amountRupees = parseFloat(cleanAmountStr);
  if (Number.isNaN(amountRupees) || amountRupees <= 0) {
    return null;
  }

  const amountPaise = Math.round(amountRupees * 100);

  // 2. Extract 12-digit UTR
  let utr: string | undefined;
  for (const pattern of UTR_PATTERNS) {
    const match = rawText.match(pattern);
    if (match && match[1]) {
      utr = match[1];
      break;
    }
  }

  // 3. Extract Account Tail
  let accountTail: string | undefined;
  const accountMatch = rawText.match(ACCOUNT_TAIL_REGEX);
  if (accountMatch && accountMatch[1]) {
    accountTail = accountMatch[1];
  }

  // 4. Extract Order ID candidate if present in transaction note
  let orderIdCandidate: string | undefined;
  const orderMatch = rawText.match(ORDER_ID_REGEX);
  if (orderMatch && orderMatch[1]) {
    orderIdCandidate = orderMatch[1];
  }

  // 5. Extract Payer VPA if present (e.g. "from customer@okhdfc")
  let payerVpa: string | undefined;
  const vpaMatch = rawText.match(/([a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,32})/);
  if (vpaMatch && vpaMatch[1]) {
    payerVpa = vpaMatch[1];
  }

  const bank = detectBank(rawText);

  return {
    isCredit: true,
    bank,
    amountPaise,
    utr,
    accountTail,
    payerVpa,
    orderIdCandidate,
    timestamp: Date.now(),
    rawText,
  };
}
