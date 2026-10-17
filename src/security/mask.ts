// ============================================================================
// KPay Security — Secret Masking & PII Redaction Logger
// ============================================================================

import type { KPayOptions, LogLevel } from '../types.js';

const SENSITIVE_KEYS = new Set([
  'saltkey',
  'merchantkey',
  'secretkey',
  'apikey',
  'authorization',
  'x-verify',
  'checksumhash',
  'password',
  'token',
  'txnstoken',
]);

/**
 * Masks a UPI VPA (e.g. 'john.doe@okhdfcbank' -> 'jo****oe@okhdfcbank') to prevent PII leakage.
 */
export function maskVpa(vpa: string): string {
  if (!vpa || typeof vpa !== 'string' || !vpa.includes('@')) {
    return vpa;
  }
  const parts = vpa.split('@');
  const handle = parts[0];
  const bank = parts[1];
  if (!handle || !bank) {
    return vpa;
  }
  if (handle.length <= 2) {
    return `*@${bank}`;
  }
  if (handle.length <= 4) {
    return `${handle[0]}**@${bank}`;
  }
  return `${handle.slice(0, 2)}****${handle.slice(-2)}@${bank}`;
}

export function maskSecrets(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Mask potential JWT tokens or long base64 strings
    if (obj.length > 50 && !obj.includes(' ') && !obj.includes('http')) {
      return `${obj.slice(0, 4)}...***...${obj.slice(-4)}`;
    }
    // Mask standalone VPA string if passed
    if (obj.includes('@') && !obj.includes(' ') && obj.split('@').length === 2 && !obj.includes('http')) {
      return maskVpa(obj);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(maskSecrets);
  }

  if (typeof obj === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lower) || lower.includes('secret') || lower.includes('key')) {
        masked[key] = '[REDACTED_SECRET]';
      } else if (lower.includes('phone') && typeof value === 'string' && value.length >= 10) {
        // Redact PII mobile numbers: 98****3210
        masked[key] = `${value.slice(0, 2)}******${value.slice(-2)}`;
      } else if ((lower.includes('vpa') || lower.includes('upi')) && typeof value === 'string') {
        masked[key] = maskVpa(value);
      } else {
        masked[key] = maskSecrets(value);
      }
    }
    return masked;
  }

  return obj;
}

export class Logger {
  private readonly isDebug: boolean;
  private readonly customLogger?: (level: LogLevel, message: string, data?: Record<string, unknown>) => void;

  constructor(options?: KPayOptions) {
    this.isDebug = options?.debug ?? false;
    this.customLogger = options?.logger;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    if (!this.isDebug) return;
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const sanitizedData = data ? (maskSecrets(data) as Record<string, unknown>) : undefined;

    if (this.customLogger) {
      this.customLogger(level, message, sanitizedData);
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [KPay] [${level.toUpperCase()}]`;

    if (sanitizedData) {
      // eslint-disable-next-line no-console
      console[level === 'debug' ? 'log' : level](`${prefix} ${message}`, JSON.stringify(sanitizedData));
    } else {
      // eslint-disable-next-line no-console
      console[level === 'debug' ? 'log' : level](`${prefix} ${message}`);
    }
  }
}
