// ============================================================================
// KPay Adapters — Base Adapter Contract & Common Protections
// ============================================================================

import type {
  Provider,
  Environment,
  KPayOptions,
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentStatusResponse,
  CheckStatusOptions,
  WebhookVerifyOptions,
  WebhookEvent,
  CreateRefundRequest,
  RefundResponse,
} from '../types.js';
import { Logger } from '../security/mask.js';
import { validatePaymentRequest } from '../security/validation.js';
import { validateUrlSsrf } from '../security/ssrf-shield.js';
import { assertIpAllowed } from '../security/ip-guard.js';

export interface IKPayAdapter {
  readonly provider: Provider;
  readonly environment: Environment;

  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse>;
  checkStatus(orderId: string, options?: CheckStatusOptions): Promise<PaymentStatusResponse>;
  verifyWebhook(payload: string | Buffer, signature: string, options?: WebhookVerifyOptions): Promise<WebhookEvent> | WebhookEvent;
  createRefund?(request: CreateRefundRequest): Promise<RefundResponse>;
}

export abstract class BaseAdapter implements IKPayAdapter {
  abstract readonly provider: Provider;
  readonly environment: Environment;
  protected readonly logger: Logger;
  protected readonly timeout: number;
  protected readonly enforceIpAllowlist: boolean;
  protected readonly enforceSsrfProtection: boolean;

  constructor(environment: Environment, options?: KPayOptions) {
    this.environment = environment;
    this.logger = new Logger(options);
    this.timeout = options?.timeout ?? 30000;
    this.enforceIpAllowlist = options?.enforceIpAllowlist ?? (environment === 'production');
    this.enforceSsrfProtection = options?.enforceSsrfProtection ?? (environment === 'production');
  }

  abstract createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse>;
  abstract checkStatus(orderId: string, options?: CheckStatusOptions): Promise<PaymentStatusResponse>;
  abstract verifyWebhook(payload: string | Buffer, signature: string, options?: WebhookVerifyOptions): Promise<WebhookEvent> | WebhookEvent;
  abstract createRefund?(request: CreateRefundRequest): Promise<RefundResponse>;

  /**
   * Performs standard pre-flight cyber checks before dispatching a payment request.
   */
  protected validatePreflight(request: CreatePaymentRequest): void {
    validatePaymentRequest(request, this.environment);

    // SSRF Check on merchant callback & redirect URLs
    validateUrlSsrf(request.callbackUrl, this.environment, this.enforceSsrfProtection);
    validateUrlSsrf(request.redirectUrl, this.environment, this.enforceSsrfProtection);
  }

  /**
   * Enforces IP CIDR allowlisting if enabled.
   */
  protected assertWebhookIp(clientIp?: string): void {
    assertIpAllowed(clientIp, this.provider, this.enforceIpAllowlist);
  }

  /**
   * Exponential backoff retry helper.
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxAttempts = 3,
    baseDelayMs = 1000,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err;
        if (attempt === maxAttempts) break;
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }
}
