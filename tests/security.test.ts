import { describe, it, expect } from 'vitest';
import {
  constantTimeEqual,
  hmacSha256,
  sha256,
  stableStringify,
  isTimestampFresh,
  generatePaytmChecksum,
  verifyPaytmChecksum,
} from '../src/security/crypto';
import {
  validateOrderId,
  normalizePhoneNumber,
  validateVpa,
  validatePaiseAmount,
} from '../src/security/validation';
import { validateUrlSsrf, isPrivateOrReservedHost } from '../src/security/ssrf-shield';
import { isIpInCidr, isIpAllowedForProvider, assertIpAllowed } from '../src/security/ip-guard';
import { verifyAmountIntegrity } from '../src/security/amount-guard';
import { maskSecrets } from '../src/security/mask';
import { SecurityViolationError, InvalidConfigError } from '../src/errors';

describe('Cyber Security — Constant Time Equality', () => {
  it('returns true for matching strings', () => {
    expect(constantTimeEqual('kpay_secret_token_12345', 'kpay_secret_token_12345')).toBe(true);
  });

  it('returns false for mismatched strings of same length', () => {
    expect(constantTimeEqual('kpay_secret_token_12345', 'kpay_secret_token_12346')).toBe(false);
  });

  it('returns false for mismatched strings of different lengths without leaking timing', () => {
    expect(constantTimeEqual('kpay_secret_token_12345', 'kpay_secret_token_12345_extra')).toBe(false);
    expect(constantTimeEqual('short', 'much_longer_string_here')).toBe(false);
  });

  it('handles empty strings and unicode safely', () => {
    expect(constantTimeEqual('', '')).toBe(true);
    expect(constantTimeEqual('🇮🇳 UPI', '🇮🇳 UPI')).toBe(true);
    expect(constantTimeEqual('🇮🇳 UPI', '🇺🇸 USD')).toBe(false);
  });
});

describe('Cyber Security — SSRF Shield', () => {
  it('identifies private, loopback, and cloud metadata hosts', () => {
    expect(isPrivateOrReservedHost('localhost')).toBe(true);
    expect(isPrivateOrReservedHost('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedHost('10.0.1.5')).toBe(true);
    expect(isPrivateOrReservedHost('192.168.1.1')).toBe(true);
    expect(isPrivateOrReservedHost('172.20.0.1')).toBe(true);
    expect(isPrivateOrReservedHost('169.254.169.254')).toBe(true); // AWS/GCP IMDS
    expect(isPrivateOrReservedHost('::1')).toBe(true);
    expect(isPrivateOrReservedHost('api.merchant.com')).toBe(false);
  });

  it('enforces SSRF protection in production', () => {
    expect(() => validateUrlSsrf('http://localhost:3000/callback', 'production', true)).toThrow(SecurityViolationError);
    expect(() => validateUrlSsrf('https://169.254.169.254/latest/meta-data', 'production', true)).toThrow(SecurityViolationError);
    expect(() => validateUrlSsrf('http://api.merchant.com/callback', 'production', true)).toThrow(/HTTPS/);
    expect(() => validateUrlSsrf('https://api.merchant.com/callback', 'production', true)).not.toThrow();
  });

  it('allows local callbacks in sandbox mode', () => {
    expect(() => validateUrlSsrf('http://localhost:3000/callback', 'sandbox', true)).not.toThrow();
  });
});

describe('Cyber Security — Order ID Injection & Path Traversal Prevention', () => {
  it('accepts valid alphanumeric order IDs', () => {
    expect(() => validateOrderId('ORD_12345')).not.toThrow();
    expect(() => validateOrderId('order-2026.10.17-001')).not.toThrow();
  });

  it('rejects path traversal attempts', () => {
    expect(() => validateOrderId('../../etc/passwd')).toThrow(InvalidConfigError);
    expect(() => validateOrderId('..\\windows\\system32')).toThrow(InvalidConfigError);
  });

  it('rejects SQL injection and command injection payloads', () => {
    expect(() => validateOrderId('ORD"; DROP TABLE orders;--')).toThrow(InvalidConfigError);
    expect(() => validateOrderId('ORD`id`')).toThrow(InvalidConfigError);
    expect(() => validateOrderId('')).toThrow(InvalidConfigError);
  });
});

describe('Cyber Security — Amount Integrity & Underpayment Shield', () => {
  it('passes when expected and received amount match', () => {
    expect(() => verifyAmountIntegrity(50000, 50000, 'phonepe', 'ORD_1')).not.toThrow();
  });

  it('throws SecurityViolationError when received amount is less than expected', () => {
    expect(() => verifyAmountIntegrity(100, 50000, 'phonepe', 'ORD_1')).toThrow(SecurityViolationError);
  });

  it('throws SecurityViolationError when received amount is missing', () => {
    expect(() => verifyAmountIntegrity(undefined, 50000, 'phonepe', 'ORD_1')).toThrow(SecurityViolationError);
  });
});

describe('Cyber Security — IP CIDR Origin Allowlisting', () => {
  it('correctly matches IPv4 addresses in CIDRs', () => {
    expect(isIpInCidr('163.53.76.10', '163.53.76.0/24')).toBe(true);
    expect(isIpInCidr('163.53.77.254', '163.53.77.0/24')).toBe(true);
    expect(isIpInCidr('1.1.1.1', '163.53.76.0/24')).toBe(false);
  });

  it('unwraps dual-stack IPv6-mapped IPv4 addresses', () => {
    expect(isIpInCidr('::ffff:163.53.76.10', '163.53.76.0/24')).toBe(true);
  });

  it('validates provider published IP ranges', () => {
    expect(isIpAllowedForProvider('163.53.76.10', 'phonepe')).toBe(true);
    expect(isIpAllowedForProvider('103.58.196.25', 'paytm')).toBe(true);
    expect(isIpAllowedForProvider('103.15.60.1', 'bharatpe')).toBe(true);
    expect(isIpAllowedForProvider('198.51.100.1', 'phonepe')).toBe(false);
  });

  it('throws SecurityViolationError when unauthorized IP sends webhook', () => {
    expect(() => assertIpAllowed('198.51.100.1', 'phonepe', true)).toThrow(SecurityViolationError);
  });
});

describe('Cyber Security — Masking Logger', () => {
  it('redacts sensitive credentials and customer PII', () => {
    const raw = {
      saltKey: 'super_secret_salt_12345',
      merchantKey: 'paytm_secret_key_67890',
      customerPhone: '9876543210',
      orderId: 'ORD_100',
    };

    const masked = maskSecrets(raw) as any;
    expect(masked.saltKey).toBe('[REDACTED_SECRET]');
    expect(masked.merchantKey).toBe('[REDACTED_SECRET]');
    expect(masked.customerPhone).toBe('98******10');
    expect(masked.orderId).toBe('ORD_100');
  });
});
