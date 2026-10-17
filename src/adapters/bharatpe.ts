// ============================================================================
// KPay Adapters — BharatPe Merchant Adapter (Zero-Commission UPI)
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
  BharatPeCredentials,
  Environment,
  KPayOptions,
  PaymentStatus,
  RefundStatus,
} from '../types.js';
import { PaymentError, NetworkError, RefundError, SecurityViolationError, InvalidConfigError } from '../errors.js';
import { hmacSha256, constantTimeEqual, isTimestampFresh } from '../security/crypto.js';
import { verifyAmountIntegrity } from '../security/amount-guard.js';
import { validateOrderId } from '../security/validation.js';

const BASE_URLS = {
  sandbox: 'https://staging.bharatpe.in/api/v1/merchant',
  production: 'https://api.bharatpe.in/api/v1/merchant',
} as const;

export class BharatPeAdapter extends BaseAdapter {
  readonly provider = 'bharatpe' as const;
  private readonly credentials: BharatPeCredentials;
  private readonly baseUrl: string;

  constructor(credentials: BharatPeCredentials, environment: Environment, options?: KPayOptions) {
    super(environment, options);

    if (!credentials.merchantId || !credentials.apiKey || !credentials.secretKey) {
      throw new InvalidConfigError(
        'BharatPe adapter requires merchantId, apiKey, and secretKey credentials.',
        { provider: 'bharatpe' },
      );
    }

    this.credentials = credentials;
    this.baseUrl = BASE_URLS[environment];
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    this.validatePreflight(request);
    this.logger.debug('Creating payment via BharatPe', { orderId: request.orderId });

    try {
      const amountInRupees = request.amount / 100;
      const payload = {
        merchantId: this.credentials.merchantId,
        orderId: request.orderId,
        amount: amountInRupees,
        customerPhone: request.customerPhone,
        callbackUrl: request.callbackUrl,
        redirectUrl: request.redirectUrl,
      };

      const payloadString = JSON.stringify(payload);
      const signature = hmacSha256(payloadString, this.credentials.secretKey);

      const response = await fetch(`${this.baseUrl}/order/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': this.credentials.apiKey,
          'X-SIGNATURE': signature,
        },
        body: payloadString,
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new PaymentError(`BharatPe API error (${response.status}): ${errText}`, {
          provider: 'bharatpe',
          isRetriable: response.status >= 500,
        });
      }

      const result = await response.json() as any;
      const paymentUrl = result?.data?.paymentUrl ?? result?.paymentUrl ?? '';

      return {
        success: Boolean(result?.success ?? true),
        paymentUrl,
        orderId: request.orderId,
        provider: 'bharatpe',
        providerTransactionId: result?.data?.transactionId,
        rawResponse: result,
      };
    } catch (err) {
      if (err instanceof PaymentError || err instanceof SecurityViolationError) throw err;
      throw new NetworkError(`BharatPe payment creation failed: ${(err as Error).message}`, { provider: 'bharatpe', cause: err });
    }
  }

  async checkStatus(orderId: string, options?: CheckStatusOptions): Promise<PaymentStatusResponse> {
    validateOrderId(orderId);
    this.logger.debug('Checking payment status via BharatPe', { orderId });

    return this.withRetry(
      () => this.fetchStatus(orderId, options),
      options?.maxRetries ?? 3,
      options?.retryDelayMs ?? 1000,
    );
  }

  private async fetchStatus(orderId: string, options?: CheckStatusOptions): Promise<PaymentStatusResponse> {
    const signature = hmacSha256(`orderId=${orderId}&merchantId=${this.credentials.merchantId}`, this.credentials.secretKey);

    const response = await fetch(`${this.baseUrl}/order/status?orderId=${orderId}&merchantId=${this.credentials.merchantId}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': this.credentials.apiKey,
        'X-SIGNATURE': signature,
      },
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new PaymentError(`BharatPe Status API error (${response.status}): ${errText}`, {
        provider: 'bharatpe',
        isRetriable: response.status >= 500,
      });
    }

    const result = await response.json() as any;
    const status = this.mapStatus(result?.data?.status ?? result?.status);
    const amountInPaise = Math.round(parseFloat(result?.data?.amount ?? result?.amount ?? '0') * 100);

    if (status === 'SUCCESS' && options?.expectedAmount !== undefined) {
      verifyAmountIntegrity(amountInPaise, options.expectedAmount, 'bharatpe', orderId);
    }

    return {
      success: status === 'SUCCESS',
      status,
      amount: amountInPaise,
      orderId: result?.data?.orderId ?? orderId,
      provider: 'bharatpe',
      transactionId: result?.data?.transactionId,
      paymentMethod: 'upi',
      rawResponse: result,
    };
  }

  verifyWebhook(payload: string | Buffer, signature: string, options?: WebhookVerifyOptions): WebhookEvent {
    this.assertWebhookIp(options?.clientIp);

    if (!signature || typeof signature !== 'string') {
      return { verified: false, status: 'FAILED', orderId: '', provider: 'bharatpe', rawPayload: payload };
    }

    try {
      const payloadBuffer = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload;
      const expectedSignature = hmacSha256(payloadBuffer, this.credentials.secretKey);
      const isSignatureValid = constantTimeEqual(expectedSignature, signature);

      if (!isSignatureValid) {
        this.logger.warn('BharatPe webhook HMAC signature mismatch');
        return { verified: false, status: 'FAILED', orderId: '', provider: 'bharatpe', rawPayload: payload };
      }

      const payloadStr = payloadBuffer.toString('utf8');
      const parsed = JSON.parse(payloadStr);

      if (options?.enableReplayProtection) {
        const ts = options.timestamp ?? parsed?.timestamp ?? parsed?.data?.timestamp;
        if (!ts || !isTimestampFresh(ts, options.timestampToleranceSeconds ?? 300)) {
          this.logger.warn('BharatPe webhook replay protection triggered');
          return { verified: false, status: 'FAILED', orderId: '', provider: 'bharatpe', rawPayload: payload };
        }
      }

      const status = this.mapStatus(parsed?.data?.status ?? parsed?.status);
      const amountPaise = parsed?.data?.amount ? Math.round(parseFloat(parsed.data.amount) * 100) : undefined;
      const orderId = parsed?.data?.orderId ?? parsed?.orderId ?? '';

      if (status === 'SUCCESS' && options?.expectedAmount !== undefined) {
        verifyAmountIntegrity(amountPaise, options.expectedAmount, 'bharatpe', orderId);
      }

      return {
        verified: true,
        status,
        orderId,
        provider: 'bharatpe',
        transactionId: parsed?.data?.transactionId,
        amount: amountPaise,
        rawPayload: parsed,
      };
    } catch (err) {
      if (err instanceof SecurityViolationError) throw err;
      return { verified: false, status: 'FAILED', orderId: '', provider: 'bharatpe', rawPayload: payload };
    }
  }

  async createRefund(request: CreateRefundRequest): Promise<RefundResponse> {
    this.logger.debug('Initiating refund via BharatPe', { refundId: request.refundId, orderId: request.originalOrderId });

    try {
      const payload = {
        merchantId: this.credentials.merchantId,
        orderId: request.originalOrderId,
        refundId: request.refundId,
        amount: request.amount / 100,
        reason: request.reason ?? 'Customer refund',
      };

      const payloadString = JSON.stringify(payload);
      const signature = hmacSha256(payloadString, this.credentials.secretKey);

      const response = await fetch(`${this.baseUrl}/order/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': this.credentials.apiKey,
          'X-SIGNATURE': signature,
        },
        body: payloadString,
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new RefundError(`BharatPe refund failed (${response.status}): ${errText}`, { provider: 'bharatpe' });
      }

      const result = await response.json() as any;
      const refundStatus: RefundStatus = result?.data?.status === 'SUCCESS' ? 'SUCCESS' : 'PENDING';

      return {
        success: Boolean(result?.success),
        status: refundStatus,
        refundId: request.refundId,
        originalOrderId: request.originalOrderId,
        amount: request.amount,
        providerRefundId: result?.data?.refundTransactionId,
        rawResponse: result,
      };
    } catch (err) {
      if (err instanceof RefundError) throw err;
      throw new RefundError(`Failed to process BharatPe refund: ${(err as Error).message}`, { provider: 'bharatpe', cause: err });
    }
  }

  private mapStatus(status?: string): PaymentStatus {
    switch (status?.toUpperCase()) {
      case 'SUCCESS':
      case 'COMPLETED':
        return 'SUCCESS';
      case 'PENDING':
      case 'PROCESSING':
        return 'PENDING';
      case 'FAILED':
      case 'CANCELLED':
        return 'FAILED';
      default:
        return 'PENDING';
    }
  }
}
