import { describe, it, expect } from 'vitest';
import { KPay } from '../src/client';
import { InvalidConfigError } from '../src/errors';
import { MockAdapter } from '../src/adapters/mock';

describe('KPay Core Client', () => {
  it('initializes with PhonePe credentials', () => {
    const kpay = new KPay({
      provider: 'phonepe',
      environment: 'sandbox',
      credentials: {
        merchantId: 'PGTESTPAYUAT',
        saltKey: '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399',
        saltIndex: '1',
      },
    });

    expect(kpay.provider).toBe('phonepe');
    expect(kpay.environment).toBe('sandbox');
  });

  it('initializes with Paytm credentials', () => {
    const kpay = new KPay({
      provider: 'paytm',
      environment: 'sandbox',
      credentials: {
        merchantId: 'PAYTM_MID_123',
        merchantKey: '1234567890123456',
      },
    });

    expect(kpay.provider).toBe('paytm');
  });

  it('initializes with BharatPe credentials', () => {
    const kpay = new KPay({
      provider: 'bharatpe',
      environment: 'sandbox',
      credentials: {
        merchantId: 'BP_MID_999',
        apiKey: 'bp_api_key_xyz',
        secretKey: 'bp_secret_key_abc',
      },
    });

    expect(kpay.provider).toBe('bharatpe');
  });

  it('initializes with Mock provider for offline testing', async () => {
    const kpay = new KPay({
      provider: 'mock',
      environment: 'sandbox',
      credentials: {
        mockSecret: 'custom_mock_secret',
      },
    });

    expect(kpay.provider).toBe('mock');

    // Test creating a payment
    const payment = await kpay.createPayment({
      amount: 50000,
      orderId: 'ORD_TEST_MOCK_1',
      customerPhone: '9876543210',
      callbackUrl: 'http://localhost:3000/webhook',
      redirectUrl: 'http://localhost:3000/done',
    });

    expect(payment.success).toBe(true);
    expect(payment.paymentUrl).toContain('orderId=ORD_TEST_MOCK_1');

    // Test state ledger saved the order
    const stored = await kpay.getStore().getOrder('ORD_TEST_MOCK_1');
    expect(stored).not.toBeNull();
    expect(stored?.amount).toBe(50000);
    expect(stored?.status).toBe('CREATED');

    // Test checking payment status
    const status = await kpay.checkStatus('ORD_TEST_MOCK_1', { expectedAmount: 50000 });
    expect(status.success).toBe(true);
    expect(status.status).toBe('SUCCESS');

    // Test mock webhook verification
    const mockAdapter = kpay.getAdapter() as MockAdapter;
    const { payload, signature } = mockAdapter.generateSignedWebhook('ORD_TEST_MOCK_1', 50000, 'SUCCESS');

    const webhookEvent = await kpay.verifyWebhook(payload, signature, { expectedAmount: 50000 });
    expect(webhookEvent.verified).toBe(true);
    expect(webhookEvent.status).toBe('SUCCESS');
    expect(webhookEvent.orderId).toBe('ORD_TEST_MOCK_1');
  });

  it('rejects invalid or incomplete provider configurations', () => {
    expect(() => new KPay({
      provider: 'phonepe',
      environment: 'sandbox',
      credentials: {
        merchantId: 'MID', // Missing saltKey & saltIndex
      },
    })).toThrow(InvalidConfigError);
  });
});
