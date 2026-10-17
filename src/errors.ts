// ============================================================================
// KPay — Enterprise Error Hierarchy & Cyber Security Exceptions
// ============================================================================

export interface ErrorOptions {
  provider?: string;
  code?: string;
  cause?: unknown;
  isRetriable?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Base error class for all KPay exceptions.
 */
export class KPayError extends Error {
  readonly provider?: string;
  readonly code?: string;
  readonly isRetriable: boolean;
  readonly metadata?: Record<string, unknown>;

  constructor(message: string, options?: ErrorOptions) {
    super(message);
    this.name = this.constructor.name;
    this.provider = options?.provider;
    this.code = options?.code;
    this.isRetriable = options?.isRetriable ?? false;
    this.metadata = options?.metadata;

    if (options?.cause) {
      this.cause = options.cause;
    }

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Thrown when client configuration or inputs are invalid or missing.
 */
export class InvalidConfigError extends KPayError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, { ...options, code: options?.code ?? 'INVALID_CONFIG', isRetriable: false });
  }
}

/**
 * Thrown when a payment creation or status operation fails at the PSP level.
 */
export class PaymentError extends KPayError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, { ...options, code: options?.code ?? 'PAYMENT_ERROR' });
  }
}

/**
 * Thrown on transient network errors, timeouts, or DNS failures.
 */
export class NetworkError extends KPayError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, { ...options, code: options?.code ?? 'NETWORK_ERROR', isRetriable: true });
  }
}

/**
 * Thrown when a refund operation fails or is rejected.
 */
export class RefundError extends KPayError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, { ...options, code: options?.code ?? 'REFUND_ERROR' });
  }
}

/**
 * Thrown when a security check fails:
 * - Tampered signature / invalid HMAC checksum
 * - Amount substitution / underpayment attack
 * - Order ID path traversal / SQLi attempt
 * - Request from unauthorized IP outside published CIDRs
 * - SSRF attempt targeting private or loopback IP ranges
 */
export class SecurityViolationError extends KPayError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, { ...options, code: options?.code ?? 'SECURITY_VIOLATION', isRetriable: false });
  }
}

/**
 * Thrown when all providers in a failover router fail or circuit breaker is tripped.
 */
export class CircuitBreakerError extends KPayError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, { ...options, code: options?.code ?? 'CIRCUIT_BREAKER_OPEN', isRetriable: false });
  }
}
