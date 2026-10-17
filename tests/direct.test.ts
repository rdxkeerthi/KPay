import { describe, it, expect } from 'vitest';
import { DirectUPIGateway } from '../src/direct/gateway';
import { parseBankCreditNotification } from '../src/direct/parser';
import { parseUpiReturnCallback } from '../src/direct/callback';
import { KPay } from '../src/client';
import { InvalidConfigError, SecurityViolationError } from '../src/errors';

describe('KPay Direct UPI — Personal & Current Bank Account Protocol', () => {
  const credentials = {
    vpa: 'merchant.test@okhdfcbank',
    payeeName: 'Test Merchant Payee',
    mcc: '5411',
  };

  it('generates direct payment session with locked NPCI intent and QR', async () => {
    const directGateway = new DirectUPIGateway(credentials, 'production');

    const payment = await directGateway.createPayment({
      amount: 49900, // ₹499.00
      orderId: 'ORD_DIRECT_001',
      customerPhone: '9876543210',
      callbackUrl: 'https://example.com/callback',
      redirectUrl: 'https://example.com/done',
    });

    expect(payment.success).toBe(true);
    expect(payment.provider).toBe('direct');
    expect(payment.upiUri).toContain('pa=merchant.test%40okhdfcbank');
    expect(payment.upiUri).toContain('pn=Test+Merchant+Payee');
    expect(payment.upiUri).toContain('am=499.00');
    expect(payment.upiUri).toContain('mode=04'); // Locked amount!
    expect(payment.qrImage).toMatch(/^data:image\/png;base64,/);
    expect(payment.intentLinks.phonepe).toContain('phonepe://pay?');
    expect(payment.intentLinks.gpay).toContain('tez://upi/pay?');
  });

  it('handles customer 12-digit UTR submission and protects against duplicate claims', async () => {
    const directGateway = new DirectUPIGateway(credentials, 'production');

    await directGateway.createPayment({
      amount: 19900,
      orderId: 'ORD_UTR_TEST',
      customerPhone: '9876543210',
      callbackUrl: 'https://example.com/callback',
      redirectUrl: 'https://example.com/done',
    });

    // Valid 12-digit UTR submission
    const res = await directGateway.submitUTR('ORD_UTR_TEST', '429182736451');
    expect(res.verified).toBe(true);
    expect(res.utr).toBe('429182736451');

    // Reject invalid UTR format
    await expect(directGateway.submitUTR('ORD_UTR_TEST', '12345')).rejects.toThrow(InvalidConfigError);

    // Reject duplicate UTR replay fraud
    await expect(directGateway.submitUTR('ORD_UTR_TEST', '429182736451')).rejects.toThrow(SecurityViolationError);
  });
});

describe('KPay Direct UPI — Bank Credit SMS Ingestion Parser', () => {
  it('parses HDFC Bank UPI credit SMS', () => {
    const sms = 'Dear Customer, INR 499.00 credited to a/c **1234 on 17-10-26 by UPI-user@okhdfc-429182736451-ORD_1001. Bal: INR 15,200.00.';
    const parsed = parseBankCreditNotification(sms);

    expect(parsed).not.toBeNull();
    expect(parsed?.isCredit).toBe(true);
    expect(parsed?.bank).toBe('HDFC');
    expect(parsed?.amountPaise).toBe(49900);
    expect(parsed?.utr).toBe('429182736451');
    expect(parsed?.accountTail).toBe('1234');
    expect(parsed?.orderIdCandidate).toBe('ORD_1001');
  });

  it('parses SBI UPI credit SMS', () => {
    const sms = 'Your a/c no. XXXXXXXX5678 is credited by INR 1,500.00 on 17-Oct-26 by UPI/P2A/429199887766/ORD_SBI. Ref: 429199887766.';
    const parsed = parseBankCreditNotification(sms);

    expect(parsed).not.toBeNull();
    expect(parsed?.bank).toBe('SBI');
    expect(parsed?.amountPaise).toBe(150000);
    expect(parsed?.utr).toBe('429199887766');
  });

  it('parses ICICI Bank UPI credit SMS', () => {
    const sms = 'Acct XX9012 credited with INR 750.00 on 17-Oct-26. UPI:429112233445-ORD_ICICI. Avl Bal: INR 25,000.';
    const parsed = parseBankCreditNotification(sms);

    expect(parsed).not.toBeNull();
    expect(parsed?.bank).toBe('ICICI');
    expect(parsed?.amountPaise).toBe(75000);
    expect(parsed?.utr).toBe('429112233445');
  });

  it('parses Axis Bank UPI credit SMS', () => {
    const sms = 'INR 2,499.00 credited to Axis Bank A/c no. XX3456 on 17-10-26 by UPI Ref 429155667788.';
    const parsed = parseBankCreditNotification(sms);

    expect(parsed).not.toBeNull();
    expect(parsed?.bank).toBe('AXIS');
    expect(parsed?.amountPaise).toBe(249900);
    expect(parsed?.utr).toBe('429155667788');
  });

  it('parses Kotak Bank UPI credit SMS', () => {
    const sms = 'Kotak Bank: Rs 350.00 credited to 7890 via UPI (Ref no 429177889900). Bal Rs 8,400.';
    const parsed = parseBankCreditNotification(sms);

    expect(parsed).not.toBeNull();
    expect(parsed?.bank).toBe('KOTAK');
    expect(parsed?.amountPaise).toBe(35000);
    expect(parsed?.utr).toBe('429177889900');
  });

  it('ignores debit messages', () => {
    const debitSms = 'Dear Customer, INR 500.00 debited from a/c **1234 on 17-10-26 via UPI to merchant@ybl. Ref: 429188889999.';
    const parsed = parseBankCreditNotification(debitSms);
    expect(parsed).toBeNull();
  });
});

describe('KPay Direct UPI — End-to-End Automatic Ingestion via KPay Client', () => {
  it('initializes KPay with direct personal VPA and verifies incoming bank notification', async () => {
    const kpay = new KPay({
      provider: 'direct',
      environment: 'production',
      credentials: {
        vpa: 'freelancer@okhdfcbank',
        payeeName: 'Freelancer Dev',
      },
    });

    const payment = await kpay.createPayment({
      amount: 99900, // ₹999.00
      orderId: 'ORD_AUTO_INGEST_1',
      customerPhone: '9876543210',
      callbackUrl: 'https://mysite.com/callback',
      redirectUrl: 'https://mysite.com/done',
    });

    expect(payment.success).toBe(true);

    // Bank sends an SMS confirmation to the merchant's phone
    const bankSms = 'Dear Customer, INR 999.00 credited to a/c **4321 on 17-10-26 by UPI-cust@axis-429144332211-ORD_AUTO_INGEST_1.';

    // SMS forwarder posts it to KPay webhook
    const event = await kpay.verifyWebhook(bankSms, '');
    expect(event.verified).toBe(true);
    expect(event.status).toBe('SUCCESS');
    expect(event.orderId).toBe('ORD_AUTO_INGEST_1');
    expect(event.amount).toBe(99900);
    expect(event.transactionId).toBe('429144332211');

    // Status check confirms state
    const status = await kpay.checkStatus('ORD_AUTO_INGEST_1');
    expect(status.status).toBe('SUCCESS');
    expect(status.amount).toBe(99900);
  });
});

describe('KPay Direct UPI — App Return Intent Callback Parser', () => {
  it('parses successful GPay / PhonePe return intent URL parameters', () => {
    const returnUrl = 'https://mysite.com/checkout/done?Status=SUCCESS&txnId=UPI123456789&responseCode=00&ApprovalRefNo=987654321098&txnRef=ORD_RET_101';
    const result = parseUpiReturnCallback(returnUrl);

    expect(result.verified).toBe(true);
    expect(result.status).toBe('SUCCESS');
    expect(result.orderId).toBe('ORD_RET_101');
    expect(result.utr).toBe('987654321098');
    expect(result.responseCode).toBe('00');
  });

  it('detects user cancellation or failed transactions from UPI app', () => {
    const returnParams = {
      Status: 'FAILURE',
      responseCode: 'ZM',
      txnRef: 'ORD_FAILED_99',
    };
    const result = parseUpiReturnCallback(returnParams);

    expect(result.verified).toBe(false);
    expect(result.status).toBe('FAILED');
    expect(result.orderId).toBe('ORD_FAILED_99');
  });

  it('verifies return callback and updates order status in DirectUPIGateway', async () => {
    const gateway = new DirectUPIGateway({
      vpa: 'merchant@okhdfcbank',
      payeeName: 'Test Merchant',
    });

    await gateway.createPayment({
      amount: 500,
      orderId: 'ORD_RET_GATEWAY',
      customerPhone: '9876543210',
    });

    const callbackParams = {
      Status: 'SUCCESS',
      responseCode: '00',
      ApprovalRefNo: '555666777888',
      txnRef: 'ORD_RET_GATEWAY',
    };

    const result = await gateway.verifyReturnCallback(callbackParams);
    expect(result.verified).toBe(true);
    expect(result.status).toBe('SUCCESS');
    expect(result.utr).toBe('555666777888');

    const status = await gateway.checkStatus('ORD_RET_GATEWAY');
    expect(status.status).toBe('SUCCESS');
    expect(status.transactionId).toBe('555666777888');
  });
});

