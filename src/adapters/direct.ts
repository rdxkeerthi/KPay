// ============================================================================
// KPay Adapters — Direct Bank Account UPI Adapter (No Merchant Account Required)
// ============================================================================

import { BaseAdapter } from './base.js';
import type {
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentStatusResponse,
  CheckStatusOptions,
  WebhookVerifyOptions,
  WebhookEvent,
  DirectCredentials,
  Environment,
  KPayOptions,
} from '../types.js';
import { DirectUPIGateway } from '../direct/gateway.js';
import type { IKPayStore } from '../store/types.js';

export class DirectAdapter extends BaseAdapter {
  readonly provider = 'direct' as const;
  readonly gateway: DirectUPIGateway;

  constructor(
    credentials: DirectCredentials,
    environment: Environment = 'production',
    options?: KPayOptions,
    customStore?: IKPayStore,
  ) {
    super(environment, options);
    this.gateway = new DirectUPIGateway(credentials, environment, options, customStore);
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    return this.gateway.createPayment(request);
  }

  async checkStatus(orderId: string, options?: CheckStatusOptions): Promise<PaymentStatusResponse> {
    return this.gateway.checkStatus(orderId, options);
  }

  async verifyWebhook(payload: string | Buffer, _signature: string, _options?: WebhookVerifyOptions): Promise<WebhookEvent> {
    const rawText = typeof payload === 'string' ? payload : payload.toString('utf8');

    // In Direct UPI, webhook can be an incoming SMS forwarded by SMS forwarder
    const res = await this.gateway.ingestBankNotification(rawText);

    if (res && res.verified) {
      return {
        verified: true,
        status: 'SUCCESS',
        orderId: res.orderId,
        provider: 'direct',
        amount: res.amountPaise,
        transactionId: res.utr,
        rawPayload: rawText,
        metadata: { matchedVia: res.matchedVia },
      };
    }

    return {
      verified: false,
      status: 'FAILED',
      orderId: '',
      provider: 'direct',
      rawPayload: payload,
    };
  }

  createRefund(): never {
    throw new Error('Direct UPI to personal/current accounts does not have a programmatic reverse API. Refunds must be transferred via UPI.');
  }
}
