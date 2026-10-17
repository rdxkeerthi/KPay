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

export function maskSecrets(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Mask potential JWT tokens or long base64 strings
    if (obj.length > 50 && !obj.includes(' ') && !obj.includes('http')) {
      return `${obj.slice(0, 4)}...***...${obj.slice(-4)}`;
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
      } else if (lower.includes('phone') && typeof value === 'string' && value.length === 10) {
        // Redact PII mobile numbers: 98****3210
        masked[key] = `${value.slice(0, 2)}******${value.slice(-2)}`;
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
