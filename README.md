# 🇮🇳 KPay

### Enterprise-Grade, Zero-Commission, Cyber-Hardened UPI Payment Gateway for Node.js & TypeScript
**Direct-to-bank settlement. Zero MDR (₹0 fees). Multi-PSP failover. Real-time SSE push listeners. Branded QR generation.**

---

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Commission](https://img.shields.io/badge/Commission-₹0%20Zero%20MDR-success)](https://npci.org.in)
[![Security](https://img.shields.io/badge/Security-Hardened%20Shield-blueviolet)](./SKILL.md)
[![Tests](https://img.shields.io/badge/Tests-100%25%20Passing-brightgreen)](./tests)

KPay is a modern, modular, production-grade UPI engine that allows Indian businesses, developers, and platforms to collect UPI payments directly into their registered bank accounts with **zero aggregator commissions**.

Commercial gateways like Razorpay, Cashfree, and Stripe charge **1.5% to 3% + GST** on every UPI payment. KPay eliminates that middleman layer entirely by directly communicating with the free merchant APIs of **PhonePe Business**, **Paytm Business**, and **BharatPe** under the Government of India's 0% MDR mandate.

```
Without KPay:   Customer  ──▶  Aggregator (Takes 2%)  ──▶  Your Bank (T+2 Days)
With KPay:      Customer  ──▶  NPCI UPI Network       ──▶  Your Bank (Instantly, ₹0 Fees)
```

---

## ⚡ Key Features

- **0% MDR / ₹0 Commission Forever**: Keep 100% of your earnings. Direct settlement into your bank account.
- **Multi-PSP Smart Routing & Failover**: Configure primary and backup providers (e.g. PhonePe ➔ Paytm ➔ BharatPe). Automatically routes transactions through a backup provider if the primary experiences downtime or high latency.
- **Circuit Breaker Engine**: Automatically trips when consecutive failures exceed a configurable threshold, preventing cascade timeouts.
- **Real-Time Payment Listener (SSE)**: Built-in Server-Sent Events broadcaster. Eliminates wasteful frontend polling loops — the exact millisecond a webhook is verified, your checkout UI is notified.
- **Branded QR Engine**: NPCI-compliant dynamic QR generator with locked amounts (`mode=04`), custom brand colors, and support for Base64 PNG, raw SVG, and Buffer formats.
- **Universal Mobile Deep Linking**: Instant one-tap intent links for PhonePe, Google Pay (Tez), Paytm, BHIM, CRED, and Amazon Pay.
- **Offline Mock Provider (`mock`)**: Built-in mock provider for local development, unit tests, and CI/CD pipelines without needing active merchant credentials.
- **State Ledger & Idempotency Store**: Pluggable storage abstraction (`IKPayStore`) with an included thread-safe `MemoryStore` to prevent double-charging and race conditions.

---

## 🛡️ Cyber Security & Hardened Protections

KPay is designed from the ground up to protect your payments against fraud and tampering:

1. **Timing-Attack Resistance**: All signatures, HMACs, and checksums are compared using constant-time algorithms (`constantTimeEqual` with equalized byte buffers).
2. **Amount Integrity Verification**: Enforces paise-exact verification (`expectedAmount`) on both webhooks and status API calls, blocking amount-substitution fraud (e.g. paying ₹1 for a ₹10,000 order).
3. **SSRF Protection Shield**: In production, blocks callbacks and redirect URLs resolving to internal, loopback, or cloud metadata IP ranges (127.0.0.1, 10.x, 192.168.x, 169.254.169.254).
4. **IP CIDR Origin Allowlisting**: Built-in CIDR verification for PhonePe, Paytm, and BharatPe webhook egress IP ranges with dual-stack IPv6-mapped IPv4 unwrapping.
5. **Path Traversal & Injection Shield**: Order IDs are strictly sanitized (`^[a-zA-Z0-9._-]{1,64}$`), rejecting directory traversal (`../`) and SQL injection attempts before any API calls are made.
6. **Secret Masking Logger**: Automatically redacts merchant keys, salt keys, authorization tokens, and customer mobile numbers from application logs.
7. **Client-Side Leakage Guard**: The core `KPay` client throws an explicit error if accidentally imported into browser or React Native client bundles to prevent secret key leakage.

---

## 🚀 Quick Start

### Installation

```bash
npm install kpay
```

### 1. Generating a Branded UPI QR Code (Safe for Server & Browser)

```typescript
import { generateUPIQR, buildIntentLinks } from 'kpay/qr';

const qr = await generateUPIQR({
  vpa: 'yourbusiness@icici',
  name: 'Acme Store',
  amount: 499.00,
  orderId: 'ORD_1001',
  mode: 'fixed', // Locks amount in user's UPI app (NPCI mode=04)
  visualOptions: {
    darkColor: '#0F172A',
    lightColor: '#FFFFFF',
    width: 400,
  },
});

console.log('Scan QR:', qr.qrImage); // Base64 PNG data URL
console.log('Direct UPI URI:', qr.upiUri);

// Generate 1-tap mobile links
const links = buildIntentLinks(qr.upiUri);
console.log('PhonePe link:', links.phonepe);
console.log('GPay link:', links.gpay);
```

---

### 2. Multi-PSP Payment with Automatic Failover

```typescript
import { KPay } from 'kpay';

const kpay = new KPay({
  environment: 'production',
  primaryProvider: 'phonepe',
  fallbackProviders: ['paytm', 'bharatpe'],
  credentials: {
    phonepe: {
      merchantId: process.env.PHONEPE_MERCHANT_ID!,
      saltKey: process.env.PHONEPE_SALT_KEY!,
      saltIndex: '1',
    },
    paytm: {
      merchantId: process.env.PAYTM_MERCHANT_ID!,
      merchantKey: process.env.PAYTM_MERCHANT_KEY!,
    },
    bharatpe: {
      merchantId: process.env.BHARATPE_MERCHANT_ID!,
      apiKey: process.env.BHARATPE_API_KEY!,
      secretKey: process.env.BHARATPE_SECRET_KEY!,
    },
  },
});

// Create payment
const payment = await kpay.createPayment({
  amount: 49900, // ₹499.00 in paise
  orderId: 'ORD_1001',
  customerPhone: '9876543210',
  callbackUrl: 'https://api.yourdomain.com/kpay/webhook',
  redirectUrl: 'https://yourdomain.com/checkout/complete',
  idempotencyKey: 'idem_ord_1001',
});

console.log('Redirect customer to:', payment.paymentUrl);
```

---

### 3. Webhook Authentication & SSE Real-Time Updates

```typescript
import express from 'express';
import { kpay } from './kpay-instance';

const app = express();

// Webhook endpoint (Requires raw buffer or string body)
app.post('/kpay/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  const signature = req.headers['x-verify'] || req.headers['checksumhash'] || req.headers['x-signature'];
  const clientIp = req.ip;

  const event = await kpay.verifyWebhook(req.body, signature as string, {
    clientIp,
    expectedAmount: 49900, // Strict underpayment defense
  });

  if (!event.verified) {
    return res.status(400).send('Tampered or Invalid Webhook Signature');
  }

  console.log(`Payment confirmed for Order: ${event.orderId}, Status: ${event.status}`);
  res.status(200).send('OK');
});

// SSE endpoint — Frontends connect here to receive live payment status without polling!
app.get('/kpay/stream', (req, res) => {
  const orderId = req.query.orderId as string;
  const broadcaster = kpay.getBroadcaster();
  broadcaster.subscribe(orderId, res, { timeoutMs: 300000 }); // 5 min timeout
});
```

---

### 4. Direct Bank Mode: Personal & Current VPA (Zero Merchant Accounts Required!)

If you do not have or do not want to register for PhonePe Business or Paytm Business merchant accounts, you can accept payments directly to **any personal or current UPI ID** (`username@okhdfcbank`, `9876543210@paytm`, `shop@sbi`) using the standard **NPCI UPI Deep Link / Intent protocol**.

```typescript
import { KPay } from 'kpay';

const directKPay = new KPay({
  provider: 'direct',
  environment: 'production',
  credentials: {
    vpa: 'yourname@okhdfcbank', // Any personal or current UPI VPA
    payeeName: 'Your Name or Store',
  },
});

// 1. Create Direct UPI Payment Session
const payment = await directKPay.createPayment({
  amount: 29900, // ₹299.00
  orderId: 'ORD_DIRECT_555',
  customerPhone: '9876543210',
  callbackUrl: 'https://mysite.com/callback',
  redirectUrl: 'https://mysite.com/complete',
});

// payment.paymentUrl contains the locked NPCI URI (mode=04)
// payment.intentLinks provides 1-tap mobile links (GPay, PhonePe, Paytm, CRED)
```

#### Verification Options for Direct Bank Mode:
Because NPCI does not send webhooks to your server for personal VPAs, KPay provides two built-in verification methods:

- **Method A — Customer 12-Digit UTR Submission**:
  ```typescript
  import { DirectUPIGateway } from 'kpay/direct';
  
  const gateway = new DirectUPIGateway({ vpa: 'yourname@okhdfcbank', payeeName: 'Your Name' });
  // Verify 12-digit UTR submitted by user on your site (blocks duplicate UTR reuse)
  const result = await gateway.submitUTR('ORD_DIRECT_555', '429182736451');
  ```

- **Method B — Automated Bank Credit SMS / Notification Ingestion**:
  ```typescript
  // Webhook for SMS Forwarder app on your Android device (forwards bank credit SMS)
  app.post('/api/kpay/bank-notification', express.text({ type: '*/*' }), async (req, res) => {
    // Automatically extracts bank, amount, 12-digit UTR, matches pending order,
    // and fires live SSE event to the customer's checkout screen!
    const verified = await directKPay.verifyWebhook(req.body, '');
    res.json({ success: verified.verified });
  });
  ```

---

## 📊 KPay vs Commercial Gateways vs upipay

| Feature | **KPay** | upipay | Razorpay | Cashfree |
| :--- | :---: | :---: | :---: | :---: |
| **Transaction Fee (MDR)** | **₹0.00 (Free)** | ₹0.00 (Free) | 2% + GST | 1.9% + GST |
| **Direct Bank Settlement** | ✅ Instant | ✅ Instant | ❌ T+2 Days | ❌ T+1-2 Days |
| **Supported Free PSPs** | **PhonePe, Paytm, BharatPe, Direct VPA, Mock** | PhonePe, Paytm | N/A | N/A |
| **Works with Any Personal / Current VPA** | ✅ Yes (`provider: 'direct'`) | ❌ Merchant Account Required | ❌ Business KYC Required | ❌ Business KYC Required |
| **Smart Routing & Failover** | ✅ Built-in | ❌ None | ✅ Paid | ✅ Paid |
| **Circuit Breaker** | ✅ Built-in | ❌ None | N/A | N/A |
| **Real-time SSE Broadcaster** | ✅ Built-in | ❌ None | ❌ Polling | ❌ Polling |
| **SSRF Protection Shield** | ✅ Built-in | ❌ None | N/A | N/A |
| **Amount Tampering Guard** | ✅ Strict paise-check | ✅ Partial | N/A | N/A |
| **Offline Test Mock** | ✅ Full Mock Provider | ❌ None | ❌ Test keys only | ❌ Test keys only |
| **State Ledger & Idempotency** | ✅ Pluggable Store | ❌ None | Internal | Internal |

---

## 📜 License
MIT License. Free to use in commercial and personal projects.
