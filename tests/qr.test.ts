import { describe, it, expect } from 'vitest';
import { buildUPIUri, buildIntentLinks } from '../src/qr/uri-builder';
import { generateUPIQR, generateUPIQRSvg, generateUPIQRBuffer } from '../src/qr/generator';

describe('KPay QR & NPCI Specification Engine', () => {
  const sampleRequest = {
    vpa: 'kpaymerchant@icici',
    name: 'KPay Enterprises',
    amount: 1499.00,
    orderId: 'ORD_QR_999',
    note: 'Invoice 999 Payment',
    mc: '5411',
  };

  it('builds strict NPCI compliant URI with locked amount (mode=04)', () => {
    const uri = buildUPIUri(sampleRequest);
    expect(uri).toContain('pa=kpaymerchant%40icici');
    expect(uri).toContain('pn=KPay+Enterprises');
    expect(uri).toContain('am=1499.00');
    expect(uri).toContain('tr=ORD_QR_999');
    expect(uri).toContain('cu=INR');
    expect(uri).toContain('mode=04'); // Amount locked!
    expect(uri).toContain('mc=5411');
  });

  it('builds open amount URI when mode is set to open', () => {
    const uri = buildUPIUri({ ...sampleRequest, mode: 'open' });
    expect(uri).toContain('mode=00');
  });

  it('generates app-specific intent links for Indian payment apps', () => {
    const uri = buildUPIUri(sampleRequest);
    const intent = buildIntentLinks(uri);

    expect(intent.phonepe).toContain('phonepe://pay?');
    expect(intent.gpay).toContain('tez://upi/pay?');
    expect(intent.paytm).toContain('paytmmp://pay?');
    expect(intent.bhim).toContain('upi://pay?');
    expect(intent.cred).toContain('credpay://upi/pay?');
    expect(intent.amazonpay).toContain('amazonpay://upi/pay?');
  });

  it('generates Base64 PNG QR image', async () => {
    const res = await generateUPIQR(sampleRequest);
    expect(res.qrImage).toMatch(/^data:image\/png;base64,/);
    expect(res.orderId).toBe('ORD_QR_999');
    expect(res.amount).toBe(1499.00);
  });

  it('generates SVG string and raw PNG Buffer', async () => {
    const svg = await generateUPIQRSvg(sampleRequest);
    expect(svg).toContain('<svg');

    const buffer = await generateUPIQRBuffer(sampleRequest);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(100);
  });

  it('builds clean P2P URI without mode=04 for personal accounts to bypass Paytm Protect alert', () => {
    const personalRequest = {
      vpa: 'demo.user@okhdfcbank',
      name: 'Demo Account Holder',
      amount: 5.00,
      orderId: 'ORD_PERSONAL_1',
      accountType: 'personal' as const,
      mobileNumber: '9999999999',
    };

    const uri = buildUPIUri(personalRequest);
    expect(uri).toContain('pa=demo.user%40okhdfcbank');
    expect(uri).toContain('am=5.00');
    expect(uri).not.toContain('mode=04'); // mode=04 is omitted to prevent Paytm Protect risk alert!

    const intent = buildIntentLinks(uri, personalRequest.mobileNumber);
    expect(intent.mobileIntent).toBe('upi://pay?pa=9999999999@upi&cu=INR');
  });
});
