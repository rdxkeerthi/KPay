// ============================================================================
// KPay Security — Webhook CIDR Origin Allowlisting & DDoS Defense
// ============================================================================

import { SecurityViolationError } from '../errors.js';
import type { Provider } from '../types.js';

// Published official egress IP blocks for Indian payment switches
export const ALLOWED_CIDRS: Record<Provider, readonly string[]> = {
  phonepe: [
    '163.53.76.0/24',
    '163.53.77.0/24',
    '163.53.78.0/24',
    '163.53.79.0/24',
    '103.125.24.0/24',
    '103.125.25.0/24',
    '103.116.34.16/29',
    '103.116.32.16/29',
    '103.116.33.8/30',
    '103.116.33.136/30',
    '103.116.34.0/24',
    '103.116.32.0/24',
    '103.116.33.0/24',
    '103.243.35.242/32',
  ],
  paytm: [
    '103.58.196.0/24',
    '103.58.197.0/24',
    '103.58.198.0/24',
    '182.72.68.0/24',
  ],
  bharatpe: [
    '103.15.60.0/23',
    '103.139.156.0/22',
  ],
  mock: [
    '127.0.0.1/32',
    '0.0.0.0/0', // Allow any in mock dev mode
  ],
  direct: [
    '0.0.0.0/0', // Direct mode relies on cryptographic forwarder token or customer UTR
  ],
};

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.');
  if (parts.length !== 4) return NaN;
  let result = 0;
  for (const part of parts) {
    const octet = parseInt(part, 10);
    if (Number.isNaN(octet) || octet < 0 || octet > 255) return NaN;
    result = (result << 8) | octet;
  }
  return result >>> 0;
}

export function isIpInCidr(ip: string, cidr: string): boolean {
  if (cidr === '0.0.0.0/0') return true;

  // Unwrap IPv6-mapped IPv4 addresses ("::ffff:1.2.3.4")
  const cleanIp = ip.startsWith('::ffff:') ? ip.slice(7) : ip;

  const [networkStr, prefixStr] = cidr.split('/');
  if (!networkStr || !prefixStr) return false;

  const prefix = parseInt(prefixStr, 10);
  if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) return false;

  const ipInt = ipv4ToInt(cleanIp);
  const networkInt = ipv4ToInt(networkStr);
  if (Number.isNaN(ipInt) || Number.isNaN(networkInt)) return false;

  if (prefix === 0) return true;

  const mask = ((0xFFFFFFFF << (32 - prefix)) >>> 0);
  return (ipInt & mask) === (networkInt & mask);
}

export function isIpAllowedForProvider(clientIp: string, provider: Provider): boolean {
  const cidrs = ALLOWED_CIDRS[provider];
  if (!cidrs || cidrs.length === 0) return true;
  return cidrs.some(cidr => isIpInCidr(clientIp, cidr));
}

/**
 * Validates that an incoming webhook origin IP belongs to the specified PSP.
 * Throws SecurityViolationError if the check fails.
 */
export function assertIpAllowed(clientIp: string | undefined, provider: Provider, enforce = true): void {
  if (!enforce || !clientIp) return;

  if (!isIpAllowedForProvider(clientIp, provider)) {
    throw new SecurityViolationError(
      `Access Denied: Webhook origin IP "${clientIp}" is not in published CIDR allowlist for provider "${provider}".`,
      { provider, code: 'SECURITY_IP_NOT_ALLOWED' },
    );
  }
}
