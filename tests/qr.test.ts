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
});
