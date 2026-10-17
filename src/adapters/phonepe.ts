// ============================================================================
// KPay Adapters — PhonePe Business Adapter (Zero-Commission UPI)
// ============================================================================

import { BaseAdapter } from './base.js';
import type {
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentStatusResponse,
  CheckStatusOptions,
  WebhookVerifyOptions,
  WebhookEvent,
  CreateRefundRequest,
  RefundResponse,
  PhonePeCredentials,
  Environment,
  KPayOptions,
  PaymentStatus,
  RefundStatus,
  PaymentMethod,
} from '../types.js';
import { PaymentError, NetworkError, RefundError, SecurityViolationError, InvalidConfigError } from '../errors.js';
import { constantTimeEqual, sha256, isTimestampFresh } from '../security/crypto.js';
import { verifyAmountIntegrity } from '../security/amount-guard.js';
import { normalizePhoneNumber, validateOrderId } from '../security/validation.js';

const BASE_URLS = {
  sandbox: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
  production: 'https://api.phonepe.com/apis/hermes',
} as const;

export class PhonePeAdapter extends BaseAdapter {
  readonly provider = 'phonepe' as const;
  private readonly credentials: PhonePeCredentials;
  private readonly baseUrl: string;

  constructor(credentials: PhonePeCredentials, environment: Environment, options?: KPayOptions) {
    super(environment, options);

    if (!credentials.merchantId || !credentials.saltKey || !credentials.saltIndex) {
      throw new InvalidConfigError(
        'PhonePe adapter requires merchantId, saltKey, and saltIndex credentials.',
        { provider: 'phonepe' },
      );
    }

    if (!/^\d+$/.test(credentials.saltIndex)) {
      throw new InvalidConfigError(
        `Invalid PhonePe saltIndex: "${credentials.saltIndex}". Must be a numeric string (e.g. "1").`,
        { provider: 'phonepe' },
      );
    }

    this.credentials = credentials;
    this.baseUrl = BASE_URLS[environment];
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    this.validatePreflight(request);
    this.logger.debug('Creating payment via PhonePe Business', { orderId: request.orderId });

    try {
      const phone = normalizePhoneNumber(request.customerPhone);

      const payload = {
        merchantId: this.credentials.merchantId,
        merchantTransactionId: request.orderId,
        merchantUserId: `MUID_${phone}`,
        amount: request.amount,
        redirectUrl: request.redirectUrl,
        redirectMode: 'REDIRECT',
        callbackUrl: request.callbackUrl,
        paymentInstrument: { type: 'PAY_PAGE' },
      };

      const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
      const checksum = this.generateChecksum(base64Payload, '/pg/v1/pay');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
      };

      if (request.idempotencyKey) {
        headers['X-IDEMPOTENCY-KEY'] = request.idempotencyKey;
      }

      const response = await fetch(`${this.baseUrl}/pg/v1/pay`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ request: base64Payload }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new PaymentError(
          `PhonePe API returned HTTP ${response.status}: ${errorText}`,
          { provider: 'phonepe', isRetriable: response.status >= 500 },
        );
      }

      const result = await response.json() as any;
      const paymentUrl = result?.data?.instrumentResponse?.redirectInfo?.url ?? '';

      return {
        success: Boolean(result.success),
        paymentUrl,
        orderId: request.orderId,
        provider: 'phonepe',
        providerTransactionId: result?.data?.merchantTransactionId,
        rawResponse: result,
      };
    } catch (err) {
      if (err instanceof PaymentError || err instanceof SecurityViolationError) throw err;
      throw new NetworkError(`PhonePe payment creation failed: ${(err as Error).message}`, { provider: 'phonepe', cause: err });
    }
  }

  async checkStatus(orderId: string, options?: CheckStatusOptions): Promise<PaymentStatusResponse> {
    validateOrderId(orderId);
    this.logger.debug('Checking payment status via PhonePe', { orderId });

    return this.withRetry(
      () => this.fetchStatus(orderId, options),
      options?.maxRetries ?? 3,
      options?.retryDelayMs ?? 1000,
    );
  }

  private async fetchStatus(orderId: string, options?: CheckStatusOptions): Promise<PaymentStatusResponse> {
    const path = `/pg/v1/status/${this.credentials.merchantId}/${orderId}`;
    const checksum = this.generateChecksum('', path);

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
        'X-MERCHANT-ID': this.credentials.merchantId,
      },
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new PaymentError(`PhonePe Status API error (${response.status}): ${errText}`, {
        provider: 'phonepe',
        isRetriable: response.status >= 500,
      });
    }

    const result = await response.json() as any;
    const status = this.mapStatus(result?.code);
    const amount = result?.data?.amount ?? 0;

    // Strict amount integrity check
    if (status === 'SUCCESS' && options?.expectedAmount !== undefined) {
      verifyAmountIntegrity(amount, options.expectedAmount, 'phonepe', orderId);
    }

    return {
      success: Boolean(result?.success),
      status,
      amount,
      orderId: result?.data?.merchantTransactionId ?? orderId,
      provider: 'phonepe',
      transactionId: result?.data?.transactionId,
      paymentMethod: this.mapMethod(result?.data?.paymentInstrument?.type),
      rawResponse: result,
    };
  }

  verifyWebhook(payload: string | Buffer, signature: string, options?: WebhookVerifyOptions): WebhookEvent {
    this.assertWebhookIp(options?.clientIp);

    if (!signature || typeof signature !== 'string') {
      return { verified: false, status: 'FAILED', orderId: '', provider: 'phonepe', rawPayload: payload };
    }

    try {
      const payloadStr = typeof payload === 'string' ? payload : payload.toString('utf8');

      let base64Response = payloadStr;
      try {
        const parsed = JSON.parse(payloadStr);
        if (parsed?.response && typeof parsed.response === 'string') {
          base64Response = parsed.response;
        }
      } catch {
        // Raw string
      }

      // Checksum formula: SHA256(response + saltKey) + ### + saltIndex
      const expectedChecksum = `${sha256(base64Response + this.credentials.saltKey)}###${this.credentials.saltIndex}`;
      const isSignatureValid = constantTimeEqual(expectedChecksum, signature);

      if (!isSignatureValid) {
        this.logger.warn('PhonePe webhook signature verification failed (possible tampering)');
        return { verified: false, status: 'FAILED', orderId: '', provider: 'phonepe', rawPayload: payload };
      }

      let parsedPayload: any = null;
      try {
        const decoded = Buffer.from(base64Response, 'base64').toString('utf8');
        parsedPayload = JSON.parse(decoded);
      } catch {
        try {
          parsedPayload = JSON.parse(base64Response);
        } catch {
          // Unparseable body
        }
      }

      // Replay protection if enabled
      if (options?.enableReplayProtection) {
        const ts = options.timestamp ?? parsedPayload?.timestamp ?? parsedPayload?.data?.timestamp;
        if (!ts || !isTimestampFresh(ts, options.timestampToleranceSeconds ?? 300)) {
          this.logger.warn('PhonePe webhook replay protection triggered — timestamp stale or missing');
          return { verified: false, status: 'FAILED', orderId: '', provider: 'phonepe', rawPayload: payload };
        }
      }

      const status = this.mapStatus(parsedPayload?.code);
      const amount = parsedPayload?.data?.amount;
      const orderId = parsedPayload?.data?.merchantTransactionId ?? '';

      // Verify amount integrity
      if (status === 'SUCCESS' && options?.expectedAmount !== undefined) {
        verifyAmountIntegrity(amount, options.expectedAmount, 'phonepe', orderId);
      }

      return {
        verified: true,
        status,
        orderId,
        provider: 'phonepe',
        transactionId: parsedPayload?.data?.transactionId,
        amount,
        rawPayload: parsedPayload ?? payload,
      };
    } catch (err) {
      if (err instanceof SecurityViolationError) throw err;
      this.logger.error('Error during PhonePe webhook verification', { error: (err as Error).message });
      return { verified: false, status: 'FAILED', orderId: '', provider: 'phonepe', rawPayload: payload };
    }
  }

  async createRefund(request: CreateRefundRequest): Promise<RefundResponse> {
    this.logger.debug('Initiating refund via PhonePe Business', { refundId: request.refundId, orderId: request.originalOrderId });

    try {
      const payload = {
        merchantId: this.credentials.merchantId,
        merchantUserId: 'MUID_REFUND',
        originalTransactionId: request.originalOrderId,
        merchantTransactionId: request.refundId,
        amount: request.amount,
        callbackUrl: '',
      };

      const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
      const checksum = this.generateChecksum(base64Payload, '/pg/v1/refund');

      const response = await fetch(`${this.baseUrl}/pg/v1/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': checksum,
        },
        body: JSON.stringify({ request: base64Payload }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new RefundError(`PhonePe refund failed (${response.status}): ${errText}`, { provider: 'phonepe' });
      }

      const result = await response.json() as any;
      const refundStatus: RefundStatus = result?.code === 'PAYMENT_SUCCESS' ? 'SUCCESS' : result?.code === 'PAYMENT_PENDING' ? 'PENDING' : 'FAILED';

      return {
        success: Boolean(result?.success),
        status: refundStatus,
        refundId: request.refundId,
        originalOrderId: request.originalOrderId,
        amount: request.amount,
        providerRefundId: result?.data?.transactionId,
        rawResponse: result,
      };
    } catch (err) {
      if (err instanceof RefundError) throw err;
      throw new RefundError(`Failed to process PhonePe refund: ${(err as Error).message}`, { provider: 'phonepe', cause: err });
    }
  }

  private generateChecksum(base64Payload: string, path: string): string {
    const data = base64Payload + path + this.credentials.saltKey;
    return `${sha256(data)}###${this.credentials.saltIndex}`;
  }

  private mapStatus(code?: string): PaymentStatus {
    switch (code) {
      case 'PAYMENT_SUCCESS': return 'SUCCESS';
      case 'PAYMENT_PENDING': return 'PENDING';
      case 'PAYMENT_ERROR':
      case 'PAYMENT_DECLINED':
      case 'PAYMENT_CANCELLED':
      case 'TIMED_OUT':
      case 'BAD_REQUEST':
        return 'FAILED';
      default:
        return 'PENDING';
    }
  }

  private mapMethod(type?: string): PaymentMethod {
    if (!type) return 'unknown';
    const up = type.toUpperCase();
    if (up === 'UPI') return 'upi';
    if (up === 'WALLET') return 'wallet';
    if (up === 'CARD') return 'card';
    return 'unknown';
  }
}
