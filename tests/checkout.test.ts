/**
 * KPay In-Built Checkout Gateway UI Tests
 * Author: rdxkeerthi
 */

import { describe, it, expect } from 'vitest';
import { renderCheckoutHtml, KPayCheckout } from '../src/checkout/index';

describe('KPay In-Built Checkout Gateway UI — Server Renderer', () => {
  it('generates a full standalone checkout HTML page with all components', () => {
    const html = renderCheckoutHtml({
      orderId: 'ORD_TEST_HTML_001',
      amount: 499.0,
      currency: 'INR',
      payeeName: 'Acme Digital Store',
      description: 'Pro Subscription',
      qrDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      upiUri: 'upi://pay?pa=merchant@okaxis&pn=Acme&am=499.00&cu=INR',
      sseEndpoint: '/api/kpay/stream/ORD_TEST_HTML_001',
      utrSubmitEndpoint: '/api/kpay/utr',
      returnUrl: 'https://myshop.com/success',
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('ORD_TEST_HTML_001');
    expect(html).toContain('₹499.00');
    expect(html).toContain('Acme Digital Store');
    expect(html).toContain('Pro Subscription');
    expect(html).toContain('data:image/png;base64,');
    expect(html).toContain('phonepe://pay?');
    expect(html).toContain('tez://upi/pay?');
    expect(html).toContain('paytmmp://pay?');
    expect(html).toContain('/api/kpay/stream/ORD_TEST_HTML_001');
    expect(html).toContain('https://myshop.com/success');
  });

  it('sanitizes malicious script and HTML tags in checkout page attributes', () => {
    const html = renderCheckoutHtml({
      orderId: 'ORD_XSS_002',
      amount: 100.0,
      payeeName: '<script>alert("hacked")</script>SafeStore',
      description: '<img src=x onerror=alert(1)>Order Description',
    });

    expect(html).not.toContain('<script>alert("hacked")</script>');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('SafeStore');
    expect(html).toContain('Order Description');
  });
});

describe('KPay In-Built Checkout Gateway UI — Client Class', () => {
  it('throws an error if orderId is missing', () => {
    expect(() => new KPayCheckout({ orderId: '', amount: 100 })).toThrow(
      'KPayCheckout: "orderId" is required'
    );
  });

  it('throws an error if amount is non-positive or zero', () => {
    expect(() => new KPayCheckout({ orderId: 'ORD_1', amount: 0 })).toThrow(
      'KPayCheckout: "amount" must be a positive number'
    );
    expect(() => new KPayCheckout({ orderId: 'ORD_1', amount: -50 })).toThrow(
      'KPayCheckout: "amount" must be a positive number'
    );
  });

  it('initializes successfully with valid parameters and handles SSR gracefully', () => {
    const checkout = new KPayCheckout({
      orderId: 'ORD_VALID_003',
      amount: 250.0,
      payeeName: 'Test Merchant',
      themeColor: '#10B981',
      autoCloseDelay: 5,
    });

    expect(checkout).toBeInstanceOf(KPayCheckout);
    // In node/vitest environment (where window may not have full DOM), open() handles gracefully without crashing
    expect(() => checkout.open()).not.toThrow();
    expect(() => checkout.close()).not.toThrow();
    expect(() => checkout.destroy()).not.toThrow();
  });
});
