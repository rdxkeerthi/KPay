// ============================================================================
// KPay Router — Smart Multi-PSP Router & Circuit Breaker Failover Engine
// ============================================================================

import type {
  Provider,
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentStatusResponse,
  CheckStatusOptions,
  WebhookVerifyOptions,
  WebhookEvent,
  CreateRefundRequest,
  RefundResponse,
  KPayRouterConfig,
} from '../types.js';
import type { IKPayAdapter } from '../adapters/base.js';
import { PhonePeAdapter } from '../adapters/phonepe.js';
import { PaytmAdapter } from '../adapters/paytm.js';
import { BharatPeAdapter } from '../adapters/bharatpe.js';
import { MockAdapter } from '../adapters/mock.js';
import { CircuitBreakerError, InvalidConfigError } from '../errors.js';
import { Logger } from '../security/mask.js';

interface CircuitState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  lastFailureTime: number;
}

export class SmartRouter implements IKPayAdapter {
  readonly provider: Provider;
  readonly environment: KPayRouterConfig['environment'];

  private readonly primaryProvider: Provider;
  private readonly fallbackProviders: Provider[];
  private readonly adapters = new Map<Provider, IKPayAdapter>();
  private readonly circuitStates = new Map<Provider, CircuitState>();
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly logger: Logger;

  constructor(config: KPayRouterConfig) {
    this.environment = config.environment;
    this.primaryProvider = config.primaryProvider;
    this.fallbackProviders = config.fallbackProviders ?? [];
    this.provider = this.primaryProvider;
    this.failureThreshold = config.routerOptions?.failureThreshold ?? 3;
    this.resetTimeoutMs = config.routerOptions?.resetTimeoutMs ?? 60000;
    this.logger = new Logger(config.options);

    // Initialize configured adapters
    const allProviders = [this.primaryProvider, ...this.fallbackProviders];
    for (const p of allProviders) {
      const creds = config.credentials[p] ?? {};
      this.adapters.set(p, this.createAdapter(p, creds, config));
      this.circuitStates.set(p, { state: 'CLOSED', failures: 0, lastFailureTime: 0 });
    }
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const candidateProviders = [this.primaryProvider, ...this.fallbackProviders];
    let lastError: unknown;

    for (const provider of candidateProviders) {
      if (!this.canAttempt(provider)) {
        this.logger.warn(`Circuit breaker OPEN for provider "${provider}". Skipping to next candidate.`);
        continue;
      }

      const adapter = this.adapters.get(provider);
      if (!adapter) continue;

      try {
        this.logger.debug(`Attempting payment creation on provider "${provider}"`, { orderId: request.orderId });
        const res = await adapter.createPayment(request);
        this.recordSuccess(provider);
        return { ...res, provider };
      } catch (err) {
        lastError = err;
        this.recordFailure(provider);
        this.logger.warn(`Provider "${provider}" failed to create payment: ${(err as Error).message}. Attempting failover.`);
      }
    }

    throw new CircuitBreakerError(
      `All configured payment providers failed for order "${request.orderId}". Last error: ${(lastError as Error)?.message}`,
      { cause: lastError },
    );
  }

  async checkStatus(orderId: string, options?: CheckStatusOptions): Promise<PaymentStatusResponse> {
    // For checking status, attempt primary first, then fallback
    const candidateProviders = [this.primaryProvider, ...this.fallbackProviders];
    let lastError: unknown;

    for (const provider of candidateProviders) {
      const adapter = this.adapters.get(provider);
      if (!adapter) continue;

      try {
        return await adapter.checkStatus(orderId, options);
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError ?? new Error(`Could not retrieve status for order "${orderId}"`);
  }

  async verifyWebhook(payload: string | Buffer, signature: string, options?: WebhookVerifyOptions): Promise<WebhookEvent> {
    // Route webhook verification to the provider that matches or try candidates
    for (const [, adapter] of this.adapters) {
      const event = await adapter.verifyWebhook(payload, signature, options);
      if (event.verified) {
        return event;
      }
    }

    return {
      verified: false,
      status: 'FAILED',
      orderId: '',
      provider: this.primaryProvider,
      rawPayload: payload,
    };
  }

  async createRefund(request: CreateRefundRequest): Promise<RefundResponse> {
    const adapter = this.adapters.get(this.primaryProvider);
    if (!adapter?.createRefund) {
      throw new InvalidConfigError(`Primary provider "${this.primaryProvider}" does not support refunds.`);
    }
    return adapter.createRefund(request);
  }

  getAdapter(provider: Provider): IKPayAdapter | undefined {
    return this.adapters.get(provider);
  }

  private canAttempt(provider: Provider): boolean {
    const cs = this.circuitStates.get(provider);
    if (!cs) return true;

    if (cs.state === 'CLOSED') return true;

    if (cs.state === 'OPEN') {
      const elapsed = Date.now() - cs.lastFailureTime;
      if (elapsed >= this.resetTimeoutMs) {
        cs.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }

    // HALF_OPEN allows 1 trial attempt
    return true;
  }

  private recordSuccess(provider: Provider): void {
    const cs = this.circuitStates.get(provider);
    if (!cs) return;
    cs.state = 'CLOSED';
    cs.failures = 0;
  }

  private recordFailure(provider: Provider): void {
    const cs = this.circuitStates.get(provider);
    if (!cs) return;

    cs.failures += 1;
    cs.lastFailureTime = Date.now();

    if (cs.failures >= this.failureThreshold) {
      cs.state = 'OPEN';
      this.logger.error(`Circuit tripped to OPEN for provider "${provider}" after ${cs.failures} consecutive failures.`);
    }
  }

  private createAdapter(provider: Provider, creds: Record<string, string>, config: KPayRouterConfig): IKPayAdapter {
    switch (provider) {
      case 'phonepe':
        return new PhonePeAdapter(
          {
            merchantId: creds['merchantId']!,
            saltKey: creds['saltKey']!,
            saltIndex: creds['saltIndex'] ?? '1',
          },
          config.environment,
          config.options,
        );
      case 'paytm':
        return new PaytmAdapter(
          {
            merchantId: creds['merchantId']!,
            merchantKey: creds['merchantKey']!,
            website: creds['website'],
          },
          config.environment,
          config.options,
        );
      case 'bharatpe':
        return new BharatPeAdapter(
          {
            merchantId: creds['merchantId']!,
            apiKey: creds['apiKey']!,
            secretKey: creds['secretKey']!,
          },
          config.environment,
          config.options,
        );
      case 'mock':
        return new MockAdapter(
          {
            mockSecret: creds['mockSecret'],
            alwaysSuccess: creds['alwaysSuccess'] !== 'false',
          },
          config.environment,
          config.options,
        );
      default:
        throw new InvalidConfigError(`Unsupported provider: "${String(provider)}"`);
    }
  }
}
