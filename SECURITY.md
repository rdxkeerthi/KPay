# 🛡️ KPay Security Policy & Threat Model

At KPay, security is foundational. Because KPay handles financial transaction initiation, webhook authentication, and UPI QR code generation, we maintain an uncompromising stance toward defensive cyber-engineering.

---

## 1. Supported Versions

We release security patches for the following versions:

| Version | Supported | Security Maintenance |
| :--- | :---: | :--- |
| `1.x.x` | ✅ Yes | Actively maintained & patched |
| `< 1.0.0` | ❌ No | Deprecated |

---

## 2. Defensive Cyber Architecture in KPay

KPay implements multi-layered defensive controls:

### 1. Timing-Attack Resistance (`crypto.timingSafeEqual`)
All HMAC digests, SHA256 signatures, and Paytm AES checksums are compared using `constantTimeEqual()`. Even if signatures differ in length or content, execution time remains uniform across all evaluations, neutralizing side-channel timing attacks.

### 2. Strict Amount Integrity Verification
Attackers frequently attempt underpayment attacks (e.g. modifying an order client-side to pay ₹1 for a ₹10,000 item). KPay verifies the `expectedAmount` in paise down to the exact unit during both status checks and webhook callbacks. Any mismatch throws a `SecurityViolationError` and halts fulfillment.

### 3. Server-Side Request Forgery (SSRF) Shield
In production environments, KPay's SSRF shield validates all callback and redirect URLs, blocking requests that resolve to private, loopback, or cloud-metadata IP ranges (`127.0.0.1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`).

### 4. Transport-Layer IP CIDR Origin Filtering
Webhook listeners verify incoming requests against published network egress IP CIDRs for PhonePe, Paytm, and BharatPe. Dual-stack IPv6-mapped IPv4 addresses (`::ffff:x.x.x.x`) are automatically normalized.

### 5. Directory Traversal & Injection Shield
Order IDs are strictly sanitized against the pattern `^[a-zA-Z0-9._-]{1,64}$`. Any strings containing `../`, quotes, or control characters are rejected prior to any HTTP or database dispatch.

### 6. Client-Side Secret Leakage Prevention
The primary `KPay` client inspects global environments and prevents instantiation inside web browsers or React Native bundles, ensuring merchant salt keys and API secrets cannot be extracted from frontend JavaScript builds.

### 7. PII & Secret Redaction
KPay's internal logger automatically redacts sensitive authorization headers, salt keys, API keys, and customer mobile numbers (`98******10`) before writing to stdout.

---

## 3. Reporting a Vulnerability

If you discover a security vulnerability or weakness in KPay:

1. **DO NOT** disclose the issue publicly (e.g., via GitHub issues, Twitter, or public forums).
2. Email your report to: **security@kpay.dev** (or open a confidential GitHub Security Advisory).
3. Include the following details:
   - Type of vulnerability (e.g., signature bypass, SSRF, injection).
   - Step-by-step reproduction steps or proof-of-concept code.
   - Affected version(s) and environment (Node version, OS).
4. Our security team will acknowledge receipt within **24 hours** and provide regular status updates until a patch is released.

---

## 4. Merchant Integration Security Best Practices

When integrating KPay into your production applications:

- **Always verify webhooks with raw body buffers**: Do not parse the request body to JSON before calling `verifyWebhook()`. Passing parsed JSON alters key serialization order and can break or bypass cryptographic checks.
- **Store secrets in environment variables**: Never hardcode `saltKey` or `merchantKey` in source control.
- **Enforce idempotency**: Always pass an `idempotencyKey` when calling `createPayment()` to prevent accidental duplicate sessions on transient network retries.
- **Always verify `expectedAmount`**: Pass `{ expectedAmount: order.amountInPaise }` when checking payment status.
