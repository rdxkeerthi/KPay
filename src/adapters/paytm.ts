// ============================================================================
// KPay Adapters — Paytm Business Adapter (Zero-Commission UPI)
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
  PaytmCredentials,
  Environment,
  KPayOptions,
  PaymentStatus,
  RefundStatus,
  PaymentMethod,
} from '../types.js';
import { PaymentError, NetworkError, RefundError, SecurityViolationError, InvalidConfigError } from '../errors.js';
import { generatePaytmChecksum, verifyPaytmChecksum, getPaytmParamsString, stableStringify, isTimestampFresh } from '../security/crypto.js';
import { verifyAmountIntegrity } from '../security/amount-guard.js';
import { normalizePhoneNumber, validateOrderId } from '../security/validation.js';

const BASE_URLS = {
  sandbox: 'https://securestage.paytmpayments.com',
  production: 'https://secure.paytmpayments.com',
} as const;

export class PaytmAdapter extends BaseAdapter {
  readonly provider = 'paytm' as const;
  private readonly credentials: PaytmCredentials;
  private readonly baseUrl: string;

  constructor(credentials: PaytmCredentials, environment: Environment, options?: KPayOptions) {
    super(environment, options);

    if (!credentials.merchantId || !credentials.merchantKey) {
      throw new InvalidConfigError('Paytm adapter requires merchantId and merchantKey credentials.', { provider: 'paytm' });
    }

    this.credentials = credentials;
    this.baseUrl = BASE_URLS[environment];
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    this.validatePreflight(request);
    this.logger.debug('Creating payment via Paytm Business', { orderId: request.orderId });

    try {
      const amountInRupees = (request.amount / 100).toFixed(2);
      const website = this.credentials.website ?? (this.environment === 'sandbox' ? 'WEBSTAGING' : 'DEFAULT');
      const phone = normalizePhoneNumber(request.customerPhone);

      const body = {
        requestType: 'Payment',
        mid: this.credentials.merchantId,
        websiteName: website,
        orderId: request.orderId,
        txnAmount: {
          value: amountInRupees,
          currency: 'INR',
        },
        userInfo: {
          custId: `CUST_${phone}`,
          mobile: phone,
          ...(request.customerName ? { firstName: request.customerName } : {}),
          ...(request.customerEmail ? { email: request.customerEmail } : {}),
        },
        callbackUrl: request.callbackUrl,
      };

      const bodyString = stableStringify(body);
      const signature = generatePaytmChecksum(bodyString, this.credentials.merchantKey);

      const head: Record<string, string> = { signature };
      if (request.idempotencyKey) {
        head['txnSToken'] = request.idempotencyKey;
      }

      const url = `${this.baseUrl}/theia/api/v1/initiateTransaction?mid=${this.credentials.merchantId}&orderId=${request.orderId}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, head }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new PaymentError(`Paytm initiateTransaction HTTP error (${response.status}): ${errorText}`, {
          provider: 'paytm',
          isRetriable: response.status >= 500,
        });
      }

      const result = await response.json() as any;
      const txnToken = result?.body?.txnToken;

      const paymentUrl = txnToken
        ? `${this.baseUrl}/theia/api/v1/showPaymentPage?mid=${this.credentials.merchantId}&orderId=${request.orderId}&txnToken=${txnToken}`
        : '';

      return {
        success: Boolean(txnToken),
        paymentUrl,
        orderId: request.orderId,
        provider: 'paytm',
        rawResponse: result,
      };
    } catch (err) {
      if (err instanceof PaymentError || err instanceof SecurityViolationError) throw err;
      throw new NetworkError(`Paytm payment initiation failed: ${(err as Error).message}`, { provider: 'paytm', cause: err });
    }
  }

  async checkStatus(orderId: string, options?: CheckStatusOptions): Promise<PaymentStatusResponse> {
    validateOrderId(orderId);
    this.logger.debug('Checking payment status via Paytm', { orderId });

    return this.withRetry(
      () => this.fetchStatus(orderId, options),
      options?.maxRetries ?? 3,
      options?.retryDelayMs ?? 1000,
    );
  }

  private async fetchStatus(orderId: string, options?: CheckStatusOptions): Promise<PaymentStatusResponse> {
    const body = {
      mid: this.credentials.merchantId,
      orderId,
    };

    const bodyString = stableStringify(body);
    const signature = generatePaytmChecksum(bodyString, this.credentials.merchantKey);

    const url = `${this.baseUrl}/v3/order/status`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ head: { signature }, body }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new PaymentError(`Paytm status API HTTP error (${response.status}): ${errText}`, {
        provider: 'paytm',
        isRetriable: response.status >= 500,
      });
    }

    const result = await response.json() as any;
    const bodyResult = result?.body;

    const status = this.mapStatus(bodyResult?.resultInfo?.resultStatus);
    const amountInPaise = Math.round(parseFloat(bodyResult?.txnAmount ?? '0') * 100);

    if (status === 'SUCCESS' && options?.expectedAmount !== undefined) {
      verifyAmountIntegrity(amountInPaise, options.expectedAmount, 'paytm', orderId);
    }

    return {
      success: Boolean(bodyResult?.resultInfo?.resultStatus === 'TXN_SUCCESS'),
      status,
      amount: amountInPaise,
      orderId: bodyResult?.orderId ?? orderId,
      provider: 'paytm',
      transactionId: bodyResult?.txnId,
      paymentMethod: this.mapMethod(bodyResult?.paymentMode),
      rawResponse: result,
    };
  }

  verifyWebhook(payload: string | Buffer, signature: string, options?: WebhookVerifyOptions): WebhookEvent {
    this.assertWebhookIp(options?.clientIp);

    if (!signature || typeof signature !== 'string') {
      return { verified: false, status: 'FAILED', orderId: '', provider: 'paytm', rawPayload: payload };
    }

    try {
      const payloadStr = typeof payload === 'string' ? payload : payload.toString('utf8');
      let parsed: any = null;

      try {
        parsed = JSON.parse(payloadStr);
      } catch {
        // May be form-urlencoded
        const params = new URLSearchParams(payloadStr);
        parsed = Object.fromEntries(params.entries());
      }

      // Check whether signature was in body or header
      const checksumToVerify = signature || parsed?.CHECKSUMHASH || parsed?.head?.signature;
      if (!checksumToVerify) {
        return { verified: false, status: 'FAILED', orderId: '', provider: 'paytm', rawPayload: payload };
      }

      let isSignatureValid = false;

      // Case A: V3 JSON payload (verify over body)
      if (parsed?.body) {
        const bodyStr = stableStringify(parsed.body);
        isSignatureValid = verifyPaytmChecksum(bodyStr, this.credentials.merchantKey, checksumToVerify);
      } else {
        // Case B: Pipe-delimited parameter map (V1 form POST)
        const paramsString = getPaytmParamsString(parsed);
        isSignatureValid = verifyPaytmChecksum(paramsString, this.credentials.merchantKey, checksumToVerify);
      }

      if (!isSignatureValid) {
        this.logger.warn('Paytm webhook checksum verification failed (possible tampering)');
        return { verified: false, status: 'FAILED', orderId: '', provider: 'paytm', rawPayload: payload };
      }

      const bodyData = parsed?.body ?? parsed;

      // Replay protection if enabled
      if (options?.enableReplayProtection) {
        const ts = options.timestamp ?? bodyData?.TXNDATE ?? bodyData?.txnDate;
        if (!ts || !isTimestampFresh(ts, options.timestampToleranceSeconds ?? 300)) {
          this.logger.warn('Paytm webhook replay protection triggered — timestamp stale or missing');
          return { verified: false, status: 'FAILED', orderId: '', provider: 'paytm', rawPayload: payload };
        }
      }

      const status = this.mapStatus(bodyData?.STATUS ?? bodyData?.resultInfo?.resultStatus);
      const rawAmt = bodyData?.TXNAMOUNT ?? bodyData?.txnAmount;
      const amountPaise = rawAmt ? Math.round(parseFloat(rawAmt) * 100) : undefined;
      const orderId = bodyData?.ORDERID ?? bodyData?.orderId ?? '';

      if (status === 'SUCCESS' && options?.expectedAmount !== undefined) {
        verifyAmountIntegrity(amountPaise, options.expectedAmount, 'paytm', orderId);
      }

      return {
        verified: true,
        status,
        orderId,
        provider: 'paytm',
        transactionId: bodyData?.TXNID ?? bodyData?.txnId,
        amount: amountPaise,
        rawPayload: parsed,
      };
    } catch (err) {
      if (err instanceof SecurityViolationError) throw err;
      this.logger.error('Error during Paytm webhook verification', { error: (err as Error).message });
      return { verified: false, status: 'FAILED', orderId: '', provider: 'paytm', rawPayload: payload };
    }
  }

  async createRefund(request: CreateRefundRequest): Promise<RefundResponse> {
    this.logger.debug('Initiating refund via Paytm Business', { refundId: request.refundId, orderId: request.originalOrderId });

    try {
      const amountInRupees = (request.amount / 100).toFixed(2);
      const body = {
        mid: this.credentials.merchantId,
        txnType: 'REFUND',
        orderId: request.originalOrderId,
        refId: request.refundId,
        txnId: request.providerTransactionId ?? '',
        refundAmount: amountInRupees,
        comments: request.reason ?? 'Refund request',
      };

      const bodyString = stableStringify(body);
      const signature = generatePaytmChecksum(bodyString, this.credentials.merchantKey);

      const url = `${this.baseUrl}/v3/order/refund`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ head: { signature }, body }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new RefundError(`Paytm refund HTTP error (${response.status}): ${errText}`, { provider: 'paytm' });
      }

      const result = await response.json() as any;
      const bodyResult = result?.body;
      const refundStatus: RefundStatus = bodyResult?.resultInfo?.resultStatus === 'TXN_SUCCESS' ? 'SUCCESS' : bodyResult?.resultInfo?.resultStatus === 'PENDING' ? 'PENDING' : 'FAILED';

      return {
        success: Boolean(bodyResult?.resultInfo?.resultStatus === 'TXN_SUCCESS' || bodyResult?.resultInfo?.resultStatus === 'PENDING'),
        status: refundStatus,
        refundId: request.refundId,
        originalOrderId: request.originalOrderId,
        amount: request.amount,
        providerRefundId: bodyResult?.refundId,
        rawResponse: result,
      };
    } catch (err) {
      if (err instanceof RefundError) throw err;
      throw new RefundError(`Failed to process Paytm refund: ${(err as Error).message}`, { provider: 'paytm', cause: err });
    }
  }

  private mapStatus(resultStatus?: string): PaymentStatus {
    switch (resultStatus) {
      case 'TXN_SUCCESS': return 'SUCCESS';
      case 'PENDING': return 'PENDING';
      case 'TXN_FAILURE': return 'FAILED';
      default: return 'PENDING';
    }
  }

  private mapMethod(paymentMode?: string): PaymentMethod {
    if (!paymentMode) return 'unknown';
    const up = paymentMode.toUpperCase();
    if (up.includes('UPI')) return 'upi';
    if (up.includes('PPI') || up.includes('WALLET')) return 'wallet';
    if (up.includes('CC') || up.includes('DC')) return 'card';
    return 'unknown';
  }
}
