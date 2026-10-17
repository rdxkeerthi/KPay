// ============================================================================
// KPay Security — SSRF (Server-Side Request Forgery) Shield
// ============================================================================

import { SecurityViolationError } from '../errors.js';
import type { Environment } from '../types.js';

/**
 * Checks if a given hostname or IP string represents a private, loopback, or cloud-metadata address.
 */
export function isPrivateOrReservedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();

  // Localhost aliases
  if (host === 'localhost' || host === 'ip6-localhost' || host === 'ip6-loopback') {
    return true;
  }

  // IPv4 checks
  const ipv4Parts = host.split('.').map(Number);
  if (ipv4Parts.length === 4 && !ipv4Parts.some(Number.isNaN)) {
    const [p0, p1] = ipv4Parts as [number, number, number, number];

    // 127.0.0.0/8 (Loopback)
    if (p0 === 127) return true;

    // 10.0.0.0/8 (Private)
    if (p0 === 10) return true;

    // 172.16.0.0/12 (Private)
    if (p0 === 172 && p1 >= 16 && p1 <= 31) return true;

    // 192.168.0.0/16 (Private)
    if (p0 === 192 && p1 === 168) return true;

    // 169.254.0.0/16 (Link-local / Cloud Instance Metadata, e.g. AWS IMDS)
    if (p0 === 169 && p1 === 254) return true;

    // 0.0.0.0/8
    if (p0 === 0) return true;
  }

  // IPv6 checks
  if (host === '::1' || host === '::' || host.startsWith('fe80:') || host.startsWith('fc00:') || host.startsWith('fd00:')) {
    return true;
  }

  return false;
}

/**
 * Validates a URL against SSRF attacks.
 * In production mode, rejects any URLs targeting private or internal networks.
 */
export function validateUrlSsrf(urlStr: string, env: Environment, enforce = true): void {
  if (!enforce || env === 'sandbox') {
    return; // Allow local URLs during sandbox / dev mode
  }

  try {
    const parsed = new URL(urlStr);

    if (parsed.protocol !== 'https:') {
      throw new SecurityViolationError(
        `Insecure URL protocol: "${parsed.protocol}". Production callback and redirect URLs must use HTTPS.`,
        { code: 'SECURITY_INSECURE_PROTOCOL' },
      );
    }

    if (isPrivateOrReservedHost(parsed.hostname)) {
      throw new SecurityViolationError(
        `SSRF Protection Violation: Callback/redirect URL "${urlStr}" resolves to a private or reserved network address.`,
        { code: 'SECURITY_SSRF_DETECTED' },
      );
    }
  } catch (err) {
    if (err instanceof SecurityViolationError) throw err;
    throw new SecurityViolationError(`Malformed URL provided: "${urlStr}"`, { code: 'SECURITY_MALFORMED_URL', cause: err });
  }
}
