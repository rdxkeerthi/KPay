// ============================================================================
// KPay Adapters — Mock Adapter for Offline Testing & CI/CD
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
  MockCredentials,
  Environment,
  KPayOptions,
  PaymentStatus,
} from '../types.js';
import { hmacSha256, constantTimeEqual } from '../security/crypto.js';
import { verifyAmountIntegrity } from '../security/amount-guard.js';
import { validateOrderId } from '../security/validation.js';

export class MockAdapter extends BaseAdapter {
  readonly provider = 'mock' as const;
  private readonly secret: string;
  private readonly latencyMs: number;
  private readonly alwaysSuccess: boolean;
  private readonly orders = new Map<string, { amount: number; status: PaymentStatus; txnId: string }>();

  constructor(credentials: MockCredentials = {}, environment: Environment = 'sandbox', options?: KPayOptions) {
    super(environment, options);
    this.secret = credentials.mockSecret ?? 'kpay_mock_secret_default';
    this.latencyMs = credentials.simulatedLatencyMs ?? 50;
    this.alwaysSuccess = credentials.alwaysSuccess ?? true;
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    this.validatePreflight(request);
    this.logger.debug('Mock payment creation', { orderId: request.orderId, amount: request.amount });

    if (this.latencyMs > 0) {
      await new Promise(r => setTimeout(r, this.latencyMs));
    }

    const txnId = `mock_txn_${Date.now()}`;
    const initialStatus: PaymentStatus = this.alwaysSuccess ? 'SUCCESS' : 'PENDING';
    this.orders.set(request.orderId, { amount: request.amount, status: initialStatus, txnId });

    return {
      success: true,
      paymentUrl: `https://kpay.local/checkout/mock?orderId=${request.orderId}&amount=${request.amount}`,
      orderId: request.orderId,
      provider: 'mock',
      providerTransactionId: txnId,
      rawResponse: { simulated: true, status: initialStatus },
    };
  }

  async checkStatus(orderId: string, options?: CheckStatusOptions): Promise<PaymentStatusResponse> {
    validateOrderId(orderId);
    if (this.latencyMs > 0) {
      await new Promise(r => setTimeout(r, this.latencyMs));
    }

    const order = this.orders.get(orderId) ?? {
      amount: options?.expectedAmount ?? 10000,
      status: 'SUCCESS' as PaymentStatus,
      txnId: `mock_auto_${orderId}`,
    };

    if (order.status === 'SUCCESS' && options?.expectedAmount !== undefined) {
      verifyAmountIntegrity(order.amount, options.expectedAmount, 'mock', orderId);
    }

    return {
      success: order.status === 'SUCCESS',
      status: order.status,
      amount: order.amount,
      orderId,
      provider: 'mock',
      transactionId: order.txnId,
      paymentMethod: 'upi',
      rawResponse: { simulated: true, order },
    };
  }

  verifyWebhook(payload: string | Buffer, signature: string, options?: WebhookVerifyOptions): WebhookEvent {
    this.assertWebhookIp(options?.clientIp);

    const payloadBuffer = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload;
    const expectedSignature = hmacSha256(payloadBuffer, this.secret);
    const isValid = constantTimeEqual(expectedSignature, signature);

    if (!isValid) {
      return { verified: false, status: 'FAILED', orderId: '', provider: 'mock', rawPayload: payload };
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(payloadBuffer.toString('utf8'));
    } catch {
      // payload parsed
    }

    const orderId = parsed.orderId ?? '';
    const amount = parsed.amount;
    const status: PaymentStatus = parsed.status === 'SUCCESS' ? 'SUCCESS' : parsed.status === 'FAILED' ? 'FAILED' : 'PENDING';

    if (status === 'SUCCESS' && options?.expectedAmount !== undefined) {
      verifyAmountIntegrity(amount, options.expectedAmount, 'mock', orderId);
    }

    return {
      verified: true,
      status,
      orderId,
      provider: 'mock',
      transactionId: parsed.transactionId ?? `mock_txn_${Date.now()}`,
      amount,
      rawPayload: parsed,
    };
  }

  async createRefund(request: CreateRefundRequest): Promise<RefundResponse> {
    if (this.latencyMs > 0) {
      await new Promise(r => setTimeout(r, this.latencyMs));
    }

    return {
      success: true,
      status: 'SUCCESS',
      refundId: request.refundId,
      originalOrderId: request.originalOrderId,
      amount: request.amount,
      providerRefundId: `mock_refund_${Date.now()}`,
      rawResponse: { simulated: true },
    };
  }

  /**
   * Helper to manually set an order state for testing scenarios.
   */
  setOrderState(orderId: string, status: PaymentStatus, amountPaise = 10000): void {
    this.orders.set(orderId, { amount: amountPaise, status, txnId: `mock_${Date.now()}` });
  }

  /**
   * Helper to generate a valid signed mock webhook payload.
   */
  generateSignedWebhook(orderId: string, amountPaise: number, status: PaymentStatus = 'SUCCESS'): { payload: string; signature: string } {
    const data = JSON.stringify({
      orderId,
      amount: amountPaise,
      status,
      transactionId: `mock_wh_${Date.now()}`,
      timestamp: Date.now(),
    });
    const signature = hmacSha256(data, this.secret);
    return { payload: data, signature };
  }
}
