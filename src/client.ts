// ============================================================================
// KPay — Main Enterprise Gateway Client
// ============================================================================

import type {
  KPayConfig,
  KPaySingleConfig,
  KPayRouterConfig,
  Provider,
  Environment,
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentStatusResponse,
  CheckStatusOptions,
  WebhookVerifyOptions,
  WebhookEvent,
  CreateRefundRequest,
  RefundResponse,
  UPIQRRequest,
  UPIQRResponse,
  UPIIntentLink,
} from './types.js';
import type { IKPayAdapter } from './adapters/base.js';
import { PhonePeAdapter } from './adapters/phonepe.js';
import { PaytmAdapter } from './adapters/paytm.js';
import { BharatPeAdapter } from './adapters/bharatpe.js';
import { MockAdapter } from './adapters/mock.js';
import { DirectAdapter } from './adapters/direct.js';
import { SmartRouter } from './router/smart-router.js';
import { generateUPIQR, generateUPIQRSvg, generateUPIQRBuffer } from './qr/generator.js';
import { buildUPIUri, buildIntentLinks } from './qr/uri-builder.js';
import { MemoryStore } from './store/memory-store.js';
import type { IKPayStore } from './store/types.js';
import { globalSSEBroadcaster, PaymentSSEBroadcaster } from './realtime/sse.js';
import { InvalidConfigError } from './errors.js';
import { Logger } from './security/mask.js';

export class KPay {
  readonly environment: Environment;
  readonly provider: Provider;

  private readonly adapter: IKPayAdapter;
  private readonly store: IKPayStore;
  private readonly broadcaster: PaymentSSEBroadcaster;
  private readonly logger: Logger;

  constructor(config: KPayConfig, customStore?: IKPayStore) {
    // Cyber defense: prevent accidental merchant credential leakage in browser or React Native bundles
    const isBrowser = typeof globalThis !== 'undefined'
      && typeof (globalThis as any).window !== 'undefined'
      && typeof (globalThis as any).window.document !== 'undefined';
    const isReactNative = typeof globalThis !== 'undefined'
      && typeof (globalThis as any).navigator !== 'undefined'
      && (globalThis as any).navigator.product === 'ReactNative';

    if (isBrowser || isReactNative) {
      throw new InvalidConfigError(
        'KPay core client cannot run in browser or React Native environments because merchant credentials ' +
        'must remain strictly on the backend. For client-side QR generation, use the standalone QR module: ' +
        'import { generateUPIQR } from "kpay/qr"',
      );
    }

    this.environment = config.environment;
    this.logger = new Logger(config.options);
    this.store = customStore ?? new MemoryStore();
    this.broadcaster = globalSSEBroadcaster;

    if ('primaryProvider' in config) {
      // Multi-PSP router mode
      this.provider = config.primaryProvider;
      this.adapter = new SmartRouter(config as KPayRouterConfig);
      this.logger.info(`KPay initialized in Smart Router mode: primary=${this.provider} (${this.environment})`);
    } else {
      // Single provider mode
      const singleConfig = config as KPaySingleConfig;
      this.provider = singleConfig.provider;
      this.adapter = this.createSingleAdapter(singleConfig);
      this.logger.info(`KPay initialized: provider=${this.provider} (${this.environment})`);
    }
  }

  // ─── Payment Operations ─────────────────────────────────────────────

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const res = await this.adapter.createPayment(request);

    // Save order in state ledger
    await this.store.saveOrder({
      orderId: request.orderId,
      amount: request.amount,
      status: 'CREATED',
      provider: res.provider,
      customerPhone: request.customerPhone,
      idempotencyKey: request.idempotencyKey,
      metadata: request.metadata,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return res;
  }

  async checkStatus(orderId: string, options?: CheckStatusOptions): Promise<PaymentStatusResponse> {
    const res = await this.adapter.checkStatus(orderId, options);

    // Update state ledger
    await this.store.updateStatus(orderId, res.status, {
      transactionId: res.transactionId,
      paymentMethod: res.paymentMethod,
    });

    // If status updated to terminal state, broadcast to any listening SSE clients
    this.broadcaster.publish({
      orderId,
      status: res.status,
      amount: res.amount,
      transactionId: res.transactionId,
      timestamp: Date.now(),
    });

    return res;
  }

  async verifyWebhook(payload: string | Buffer, signature: string, options?: WebhookVerifyOptions): Promise<WebhookEvent> {
    const event = await this.adapter.verifyWebhook(payload, signature, options);

    if (event.verified && event.orderId) {
      // Update state ledger
      await this.store.updateStatus(event.orderId, event.status, {
        transactionId: event.transactionId,
        amount: event.amount,
      });

      // Broadcast payment update in real-time over SSE
      this.broadcaster.publish({
        orderId: event.orderId,
        status: event.status,
        amount: event.amount,
        transactionId: event.transactionId,
        timestamp: Date.now(),
      });
    }

    return event;
  }

  async createRefund(request: CreateRefundRequest): Promise<RefundResponse> {
    if (!this.adapter.createRefund) {
      throw new InvalidConfigError(`The active adapter (${this.provider}) does not support refund operations.`);
    }
    return this.adapter.createRefund(request);
  }

  // ─── Branded QR Generation ──────────────────────────────────────────

  async generateQR(request: UPIQRRequest): Promise<UPIQRResponse> {
    return generateUPIQR(request);
  }

  async generateQRSvg(request: UPIQRRequest): Promise<string> {
    return generateUPIQRSvg(request);
  }

  async generateQRBuffer(request: UPIQRRequest): Promise<Buffer> {
    return generateUPIQRBuffer(request);
  }

  buildUPILink(request: UPIQRRequest): string {
    return buildUPIUri(request);
  }

  buildIntentLinks(request: UPIQRRequest): UPIIntentLink {
    const uri = buildUPIUri(request);
    return buildIntentLinks(uri);
  }

  // ─── Subsystem Accessors ────────────────────────────────────────────

  getAdapter(): IKPayAdapter {
    return this.adapter;
  }

  getStore(): IKPayStore {
    return this.store;
  }

  getBroadcaster(): PaymentSSEBroadcaster {
    return this.broadcaster;
  }

  private createSingleAdapter(config: KPaySingleConfig): IKPayAdapter {
    const { provider, environment, credentials, options } = config;

    switch (provider) {
      case 'phonepe':
        return new PhonePeAdapter(
          {
            merchantId: credentials['merchantId']!,
            saltKey: credentials['saltKey']!,
            saltIndex: credentials['saltIndex'] ?? '1',
          },
          environment,
          options,
        );

      case 'paytm':
        return new PaytmAdapter(
          {
            merchantId: credentials['merchantId']!,
            merchantKey: credentials['merchantKey']!,
            website: credentials['website'],
          },
          environment,
          options,
        );

      case 'bharatpe':
        return new BharatPeAdapter(
          {
            merchantId: credentials['merchantId']!,
            apiKey: credentials['apiKey']!,
            secretKey: credentials['secretKey']!,
          },
          environment,
          options,
        );

      case 'mock':
        return new MockAdapter(
          {
            mockSecret: credentials['mockSecret'],
            alwaysSuccess: credentials['alwaysSuccess'] !== 'false',
          },
          environment,
          options,
        );

      case 'direct':
        return new DirectAdapter(
          {
            vpa: credentials['vpa']!,
            payeeName: credentials['payeeName']!,
            mcc: credentials['mcc'],
            webhookSecret: credentials['webhookSecret'],
          },
          environment,
          options,
          this.store,
        );

      default:
        throw new InvalidConfigError(`Unsupported KPay provider: "${String(provider)}"`);
    }
  }
}
