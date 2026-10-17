// ============================================================================
// KPay — Unified Types for Enterprise Zero-Commission UPI Engine
// ============================================================================

export type Provider = 'phonepe' | 'paytm' | 'bharatpe' | 'mock' | 'direct';
export type Environment = 'sandbox' | 'production';
export type PaymentStatus = 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
export type RefundStatus = 'PENDING' | 'SUCCESS' | 'FAILED';
export type PaymentMethod = 'upi' | 'wallet' | 'card' | 'unknown';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ─── Universal KPay Configuration ────────────────────────────────────────

export interface KPayOptions {
  /** Global HTTP request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Enable debug logging with automatic secret masking (default: false) */
  debug?: boolean;
  /** Custom logger function */
  logger?: (level: LogLevel, message: string, data?: Record<string, unknown>) => void;
  /** Enforce strict CIDR IP checking on webhook verification (default: true in production) */
  enforceIpAllowlist?: boolean;
  /** Reject localhost/private IPs on redirect & callback URLs in production (default: true) */
  enforceSsrfProtection?: boolean;
}

export interface KPaySingleConfig {
  provider: Provider;
  environment: Environment;
  credentials: Record<string, string>;
  options?: KPayOptions;
}

export interface KPayRouterConfig {
  environment: Environment;
  primaryProvider: Provider;
  fallbackProviders?: Provider[];
  credentials: Partial<Record<Provider, Record<string, string>>>;
  options?: KPayOptions;
  routerOptions?: {
    failureThreshold?: number; // Failures before opening circuit (default: 3)
    resetTimeoutMs?: number; // Time before trying half-open state (default: 60000)
  };
}

export type KPayConfig = KPaySingleConfig | KPayRouterConfig;

// ─── Provider Specific Credentials ───────────────────────────────────────

export interface PhonePeCredentials {
  merchantId: string;
  saltKey: string;
  saltIndex: string;
}

export interface PaytmCredentials {
  merchantId: string;
  merchantKey: string;
  website?: string;
}

export interface BharatPeCredentials {
  merchantId: string;
  apiKey: string;
  secretKey: string;
}

export interface MockCredentials {
  simulatedLatencyMs?: number;
  alwaysSuccess?: boolean;
  mockSecret?: string;
}

export interface DirectCredentials {
  /** Personal or Current Bank VPA (e.g. 'username@okhdfcbank', '9876543210@paytm') */
  vpa: string;
  /** Individual or Business display name */
  payeeName: string;
  /** Optional 4-digit NPCI MCC */
  mcc?: string;
  /** Optional secret key for authenticating incoming bank SMS forwarder webhooks */
  webhookSecret?: string;
}

// ─── Payment Transactions ────────────────────────────────────────────────

export interface CreatePaymentRequest {
  /** Amount in paise (e.g. 50000 for ₹500.00) */
  amount: number;
  /** Unique merchant order reference ID */
  orderId: string;
  /** 10-digit Indian customer mobile number */
  customerPhone: string;
  /** Optional customer display name */
  customerName?: string;
  /** Optional customer email address */
  customerEmail?: string;
  /** Webhook callback endpoint URL (server-to-server) */
  callbackUrl: string;
  /** Frontend browser return URL after payment */
  redirectUrl: string;
  /** Idempotency key to prevent double charging on network retries */
  idempotencyKey?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface CreatePaymentResponse {
  success: boolean;
  paymentUrl: string;
  orderId: string;
  provider: Provider;
  providerTransactionId?: string;
  rawResponse: unknown;
}

export interface CheckStatusOptions {
  /** Expected amount in paise. If provided, throws on mismatch (prevents underpayment). */
  expectedAmount?: number;
  /** Total attempts on transient failures (default: 3) */
  maxRetries?: number;
  /** Base delay between retries in milliseconds (default: 1000) */
  retryDelayMs?: number;
}

export interface PaymentStatusResponse {
  success: boolean;
  status: PaymentStatus;
  amount: number; // in paise
  orderId: string;
  provider: Provider;
  transactionId?: string;
  paymentMethod: PaymentMethod;
  rawResponse: unknown;
}

// ─── Webhook Events ──────────────────────────────────────────────────────

export interface WebhookVerifyOptions {
  /** Maximum allowable age of the webhook timestamp in seconds (default: 300) */
  timestampToleranceSeconds?: number;
  /** When true, validates timestamp against replay window */
  enableReplayProtection?: boolean;
  /** Explicit timestamp string or unix timestamp if not in body */
  timestamp?: number | string;
  /** Expected amount in paise for strict amount integrity verification */
  expectedAmount?: number;
  /** Origin client IP address to check against published CIDR allowlists */
  clientIp?: string;
}

export interface WebhookEvent {
  verified: boolean;
  status: PaymentStatus;
  orderId: string;
  provider: Provider;
  amount?: number; // in paise
  transactionId?: string;
  rawPayload: unknown;
  metadata?: Record<string, unknown>;
}

// ─── Refunds ─────────────────────────────────────────────────────────────

export interface CreateRefundRequest {
  originalOrderId: string;
  refundId: string;
  amount: number; // in paise
  providerTransactionId?: string;
  reason?: string;
}

export interface RefundResponse {
  success: boolean;
  status: RefundStatus;
  refundId: string;
  originalOrderId: string;
  amount: number; // in paise
  providerRefundId?: string;
  rawResponse: unknown;
}

// ─── UPI QR Code & Intent Links ──────────────────────────────────────────

export interface UPIQRRequest {
  /** Payee UPI VPA (e.g., 'business@icici') */
  vpa: string;
  /** Payee display name */
  name: string;
  /** Amount in rupees (e.g., 499.00) */
  amount: number;
  /** Transaction / Order reference */
  orderId: string;
  /** Transaction note shown in UPI app */
  note?: string;
  /**
   * Amount mode:
   * - 'fixed' (default): mode=04 (locked, user cannot alter amount)
   * - 'open': mode=00 (user can change amount)
   */
  mode?: 'fixed' | 'open';
  /** Merchant Category Code (4-digit NPCI MCC, e.g. '5411') */
  mc?: string;
  /** Visual customization options */
  visualOptions?: {
    darkColor?: string; // Hex color for QR dots (default: #000000)
    lightColor?: string; // Hex color for background (default: #FFFFFF)
    width?: number; // Pixel width (default: 400)
    margin?: number; // QR border margin (default: 2)
  };
}

export interface UPIQRResponse {
  upiUri: string;
  qrImage: string; // Base64 Data URL (PNG)
  orderId: string;
  amount: number;
}

export interface UPIIntentLink {
  generic: string;
  phonepe: string;
  gpay: string;
  paytm: string;
  bhim: string;
  cred: string;
  amazonpay: string;
}
