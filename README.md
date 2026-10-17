# 🇮🇳 KPay

### Enterprise-Grade, Zero-Commission, Cyber-Hardened UPI Payment Gateway for Node.js & TypeScript
**Direct-to-bank settlement. Zero MDR (₹0 fees). Multi-PSP failover. Real-time SSE push listeners. Branded QR generation.**

---

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![NPM Version](https://img.shields.io/npm/v/@rdxkeerthi/kpay?color=blue&logo=npm)](https://www.npmjs.com/package/@rdxkeerthi/kpay)
[![CI](https://github.com/rdxkeerthi/KPay/actions/workflows/ci.yml/badge.svg)](https://github.com/rdxkeerthi/KPay/actions/workflows/ci.yml)
[![Security & CodeQL](https://github.com/rdxkeerthi/KPay/actions/workflows/security.yml/badge.svg)](https://github.com/rdxkeerthi/KPay/actions/workflows/security.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Commission](https://img.shields.io/badge/Commission-₹0%20Zero%20MDR-success)](https://npci.org.in)

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

KPay is engineered from the ground up for zero-trust security and hardened against modern cyber threats:

1. **Mutual TLS (mTLS) Handshake Guard**: Verify incoming webhook deliveries at the transport layer with client certificate authentication (`mtlsGuardMiddleware`, `verifyMtlsClientCertificate`). Enforces SHA-256 fingerprint allowlists and Common Name (CN) verification against rogue switches.
2. **Asymmetric JWS (RS256 / ES256) Webhook Signatures**: Sign and verify webhook event payloads with asymmetric public/private cryptographic keypairs (`signJws`, `verifyJws`). Protects against secret key compromise, payload tampering, expired deliveries, and rogue issuers.
3. **Anti-Replay Nonce Vault**: One-time cryptographic nonces (`NonceVault`) with auto-expiring sliding-window TTLs prevent replay attacks on webhook notifications and transaction confirmations.
4. **Sliding-Window Rate Limiter**: High-throughput memory rate limiter (`SlidingWindowRateLimiter`) prevents brute-force payment generation and webhook endpoint spam.
5. **Anti-Clickjacking & Strict CSP Headers**: Built-in HTTP security headers (`getPaymentSecurityHeaders`) enforcing `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`, and `Cache-Control: no-store` to prevent iframe sniffing and credential harvesting.
6. **Timing-Attack Resistance**: All signatures, HMACs, and checksums are compared using constant-time algorithms (`constantTimeEqual` with equalized byte buffers).
7. **Amount Integrity Verification**: Enforces paise-exact verification (`expectedAmount`) on both webhooks and status API calls, blocking amount-substitution fraud (e.g. paying ₹1 for a ₹10,000 order).
8. **SSRF Protection Shield**: In production, blocks callbacks and redirect URLs resolving to internal, loopback, or cloud metadata IP ranges (127.0.0.1, 10.x, 192.168.x, 169.254.169.254).
9. **IP CIDR Origin Allowlisting**: Built-in CIDR verification for PhonePe, Paytm, and BharatPe webhook egress IP ranges with dual-stack IPv6-mapped IPv4 unwrapping.
10. **Path Traversal & Injection Shield**: Order IDs are strictly sanitized (`^[a-zA-Z0-9._-]{1,64}$`), rejecting directory traversal (`../`) and SQL injection attempts.
11. **Secret Masking Logger**: Automatically redacts merchant keys, salt keys, authorization tokens, and customer mobile numbers from application logs.
12. **Client-Side Leakage Guard**: The core `KPay` client throws an explicit error if accidentally imported into browser or React Native client bundles to prevent secret key leakage.
13. **Input Sanitization & Unicode Shield**: Strips HTML/XSS injection tags, Zero-Width characters (`\u200B-\u200D`, `\uFEFF`), and Bi-Directional Unicode overrides (`\u202E`) preventing payment parameter fraud.
14. **Tamper-Evident Session Seals**: Cryptographic HMAC-SHA256 session seals (`sealPaymentSession`, `verifyPaymentSession`) guarantee that payment parameters (orderId, amount, VPA) are verified on both ends.

---

## 🚀 Quick Start

### Installation

```bash
# Standard installation
npm install @rdxkeerthi/kpay

# Or install as 'kpay' directly using npm alias:
npm install kpay@npm:@rdxkeerthi/kpay
```

---

## 🎨 Cyber-Glassmorphic Checkout Gateway UI

KPay features an ultra-modern, zero-dependency **Cyber-Glassmorphic Checkout Gateway** available both as a **client-side drop-in modal** and a **server-rendered standalone checkout page**. It rivals commercial gateways like Razorpay in aesthetic polish and UX, but with **₹0 aggregator fees** and **direct bank settlement**.

### Key UI Features:
- **Cyber-Glassmorphic Aesthetic**: Translucent frosted glass card (`backdrop-filter: blur(28px) saturate(180%)`) with ambient floating aurora glows in Indigo, Fuchsia, and Emerald.
- **Authentic Brand Vector Logos**: Embedded high-resolution inline SVGs for **PhonePe**, **Google Pay**, **Paytm**, **CRED**, and **BHIM/NPCI** — razor-sharp on Retina and 4K screens with zero CDN/image latency.
- **Polyphonic Web Audio Celebration**: Built-in 4-tone cinematic harmonic chord progression (`C5 ➔ E5 ➔ G5 ➔ C6`) synthesized via dual triangle & sine oscillators with smooth exponential volume decay, accompanied by dynamic CSS confetti bursts.
- **Real-Time Push Updates via SSE**: Eliminates wasteful frontend polling. The checkout screen transitions automatically the millisecond your server records the payment.
- **Dynamic Branded QR Code**: High-contrast, scan-optimized QR with pulsating animated scan ring and 10-minute expiry countdown.
- **Universal 1-Tap UPI Intent Routing**: Direct mobile deep-links for all major UPI payment apps.
- **Manual UTR Fallback**: Seamless 12-digit bank reference number (UTR) verification input for instant reconciliation if SMS delays occur.
- **Anti-Clickjacking & Strict CSP**: Includes `getCheckoutSecurityHeaders()` enforcing strict Content Security Policy, `X-Frame-Options`, and anti-tamper safeguards.

---

### A. Client-Side Drop-in Modal (Browser)

Embed directly into any frontend app (Vanilla JS, React, Vue, Next.js, Angular, Svelte) with zero external CSS or icon dependencies:

```typescript
import { KPayCheckout } from '@rdxkeerthi/kpay/checkout';

const checkout = new KPayCheckout({
  orderId: 'ORD_1001',
  amount: 499.00,
  payeeName: 'My Awesome Store',
  description: 'Pro Annual Subscription',
  qrDataUrl: session.qrDataUrl,
  upiUri: session.upiUri,
  sseEndpoint: `/api/kpay/stream/${orderId}`,
  utrSubmitEndpoint: `/api/kpay/utr`,
  themeColor: '#4F46E5', // Customize to match your brand palette
  onSuccess: (data) => {
    console.log('Payment Verified! Bank UTR:', data.utr);
  },
  onDismiss: () => {
    console.log('Customer dismissed checkout modal');
  },
});

// Opens the cyber-glassmorphic checkout modal
checkout.open();
```

---

### B. Server-Side Standalone Checkout Page (Express / Next.js / Fastify)

Render and serve a complete, standalone responsive checkout page with embedded security headers:

```typescript
import express from 'express';
import { renderCheckoutHtml, getCheckoutSecurityHeaders } from '@rdxkeerthi/kpay/checkout';

const app = express();

app.get('/checkout/:orderId', async (req, res) => {
  const session = await kpay.createPayment({
    orderId: req.params.orderId,
    amount: 499.00,
    note: 'Premium Plan',
  });

  // Apply strict CSP and anti-framing headers
  const headers = getCheckoutSecurityHeaders();
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }

  const html = renderCheckoutHtml({
    orderId: session.orderId,
    amount: session.amount,
    payeeName: 'Acme SuperStore',
    description: 'Pro Subscription',
    qrDataUrl: session.qrDataUrl,
    upiUri: session.upiUri,
    sseEndpoint: `/api/kpay/stream/${session.orderId}`,
    utrSubmitEndpoint: `/api/kpay/verify-utr`,
    returnUrl: `https://mybusiness.com/order/success`,
  });

  res.send(html);
});
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

- **End-to-End Automated Checkout Closure**:
  Once verified via either bank SMS ingestion or customer UTR, KPay pushes an instant Server-Sent Event (`payment_status: 'SUCCESS'`). The checkout UI plays a payment confirmation chime, displays a verified transaction receipt (with Order ID, UTR, and timestamp), and automatically closes the payment screen after a 5-second countdown to complete the order flow.

---

## 📱 Resolving Paytm Protect & UPI Risk Policy Alerts

When accepting payments to personal savings bank accounts or individual VPAs (e.g., `yourname@okhdfcbank` for *Account Holder*), banking apps like **Paytm**, **Google Pay**, and **PhonePe** may display a **Paytm Protect / UPI Risk Policy Alert**:

> *"This payment may fail as per UPI Risk Policy to safeguard your account. You can pay via entering their mobile number or scanning their QR"*

### Why This Happens:
NPCI strictly mandates that `mode=04` (locked non-editable payment amount) and `tr` (transaction reference) are **merchant-only parameters**. When a personal savings account receives deep-link intents with merchant tags, banking algorithms flag the transaction as unverified merchant impersonation.

### How KPay Solves It:
KPay provides two distinct operating modes and multi-channel intents:

1. **Automatic Personal (P2P) Safe Mode**:
   ```typescript
   import { DirectUPIGateway } from 'kpay/direct';

   const gateway = new DirectUPIGateway({
     vpa: 'yourname@okhdfcbank', // Your exact bank UPI ID
     payeeName: 'Account Holder Name',
     accountType: 'personal', // Defaults to personal when no MCC is provided
     payeeMobile: '9876500000',
   });

   const payment = await gateway.createPayment({
     amount: 500, // ₹5.00
     orderId: 'ORD_1001',
   });
   ```
   - Strips `mode=04` and merchant-only tags, using standard P2P transfer parameters (`mode=00`).
   - Generates a **Pay via Mobile Number** intent link (`upi://pay?pa=mobile@upi`), which Paytm Protect explicitly directs the payer to use.
   - Generates a **Dynamic QR Code**: Scanning the QR with the device camera or in-app scanner is recognized as a user-verified physical scan and passes 100% of risk checks without alerts.

2. **Registered Merchant Mode (P2M)**:
   For registered business current accounts with an active Merchant Category Code (MCC):
   ```typescript
   const merchantGateway = new DirectUPIGateway({
     vpa: 'store@icici',
     payeeName: 'Acme Supermarket',
     accountType: 'merchant',
     mcc: '5411', // Grocery / Supermarkets
   });
   ```

---

## 🔒 Advanced Cyber Security Protocols

### 1. Mutual TLS (mTLS) Webhook Guard
Secure webhook listeners against spoofed switches by validating client TLS certificates:

```typescript
import https from 'node:https';
import fs from 'node:fs';
import { mtlsGuardMiddleware, verifyMtlsClientCertificate } from 'kpay/security';

// Express / Fastify middleware
app.use('/kpay/webhook', mtlsGuardMiddleware({
  allowedFingerprints: [
    'AA:BB:CC:DD:EE:FF:11:22:33:44:55:66:77:88:99:00:AA:BB:CC:DD:EE:FF:11:22:33:44:55:66:77:88:99:00'
  ],
  allowedCommonNames: ['switch.bank.in', 'webhook.phonepe.com'],
}));
```

### 2. Asymmetric JWS (RS256 / ES256) Signatures
Sign and verify payloads with public/private keys:

```typescript
import { signJws, verifyJws } from 'kpay/security';

// Generate JWS token
const token = signJws({ orderId: 'ORD_1001', amount: 49900 }, privateKeyPem, 'RS256');

// Verify token on incoming webhook
const verification = verifyJws(token, {
  publicKey: publicKeyPem,
  expectedIssuer: 'kpay.gateway',
  maxAgeSeconds: 300,
});
console.log('Verified payload:', verification.payload);
```

### 3. Anti-Replay Nonce Vault & Rate Limiter
```typescript
import { NonceVault, SlidingWindowRateLimiter } from 'kpay/security';

const vault = new NonceVault(300); // 5 min TTL
vault.consumeNonce(req.headers['x-nonce']); // Throws SecurityViolationError if reused

const limiter = new SlidingWindowRateLimiter({ windowMs: 60000, maxRequests: 30 });
if (!limiter.isAllowed(req.ip)) {
  res.status(429).send('Too Many Requests');
}
```

---

## 🧪 Interactive Local Test Playground

KPay includes a full interactive test application with real-time SSE payment updates, dynamic QR preview, simulated bank SMS reconciliation, and manual UTR verification:

```bash
cd test-app
npm install
npm start
```
Open **`http://localhost:3000`** in your browser to test:
- **Personal VPA Safe Mode** (Paytm Protect compliant with QR & Mobile Number Intent)
- **Simulated Bank SMS Ingestion** (HDFC, SBI, ICICI, Axis)
- **Manual 12-digit UTR Verification**
- **Live SSE Real-Time Confirmation Stream**

---

## 📊 KPay vs Commercial Gateways vs upipay

| Feature | **KPay** | upipay | Razorpay | Cashfree |
| :--- | :---: | :---: | :---: | :---: |
| **Transaction Fee (MDR)** | **₹0.00 (Free)** | ₹0.00 (Free) | 2% + GST | 1.9% + GST |
| **Direct Bank Settlement** | ✅ Instant | ✅ Instant | ❌ T+2 Days | ❌ T+1-2 Days |
| **Cyber-Glassmorphic UI** | ✅ Built-in Modal & Server Page | ❌ None | Standard | Standard |
| **Brand Vector SVG Icons** | ✅ Official Vectors (PhonePe/GPay/Paytm) | ❌ None | ✅ Included | ✅ Included |
| **Polyphonic Chime & Confetti** | ✅ Built-in Web Audio API | ❌ None | ❌ None | ❌ None |
| **Personal & Savings VPAs** | ✅ P2P Safe Mode | ❌ Restricted | ❌ Business KYC | ❌ Business KYC |
| **Paytm Protect / Risk Safe** | ✅ QR & Mobile Intents | ❌ Fails Risk Check | N/A | N/A |
| **Mutual TLS (mTLS)** | ✅ Built-in Guard | ❌ None | Enterprise Only | Enterprise Only |
| **Asymmetric JWS (RS256)** | ✅ Built-in | ❌ None | ❌ HMAC only | ❌ HMAC only |
| **Anti-Replay Nonce Vault** | ✅ Built-in | ❌ None | ❌ None | ❌ None |
| **Smart Routing & Failover** | ✅ Built-in | ❌ None | ✅ Paid | ✅ Paid |
| **Circuit Breaker** | ✅ Built-in | ❌ None | N/A | N/A |
| **Real-time SSE Broadcaster** | ✅ Built-in | ❌ None | ❌ Polling | ❌ Polling |
| **SSRF Protection Shield** | ✅ Built-in | ❌ None | N/A | N/A |
| **Offline Test Mock** | ✅ Full Mock Provider | ❌ None | ❌ Test keys only | ❌ Test keys only |

---

## 📜 License
MIT License. Free to use in commercial and personal projects.
Author: [rdxkeerthi](https://github.com/rdxkeerthi)
