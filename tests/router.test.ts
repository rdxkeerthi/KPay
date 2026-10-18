import { describe, it, expect, vi } from 'vitest';
import { KPay } from '../src/client';
import { SmartRouter } from '../src/router/smart-router';

describe('KPay Smart Router & Circuit Breaker Failover', () => {
  it('creates payments and handles failover when primary provider fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('PhonePe network timeout simulated'));
    const kpay = new KPay({
      environment: 'sandbox',
      primaryProvider: 'phonepe', // invalid credentials to force failure
      fallbackProviders: ['mock'], // healthy backup
      credentials: {
        phonepe: {
          merchantId: 'INVALID_MERCHANT',
          saltKey: 'invalid-salt-key',
          saltIndex: '1',
        },
        mock: {
          mockSecret: 'mock_fallback_secret',
        },
      },
      routerOptions: {
        failureThreshold: 2,
        resetTimeoutMs: 1000,
      },
    });

    const payment = await kpay.createPayment({
      amount: 25000,
      orderId: 'ORD_FAILOVER_TEST',
      customerPhone: '9876543210',
      callbackUrl: 'http://localhost:3000/webhook',
      redirectUrl: 'http://localhost:3000/done',
    });

    expect(payment.success).toBe(true);
    expect(payment.provider).toBe('mock'); // Succeeded via fallback!
  });
});
