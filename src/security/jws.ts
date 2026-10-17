// ============================================================================
// KPay Security — JWS (JSON Web Signature / RS256 / ES256 Asymmetric Security)
// ============================================================================

import { createVerify, createSign } from 'node:crypto';
import type { JwsVerifyOptions } from '../types.js';
import { SecurityViolationError } from '../errors.js';
import { constantTimeEqual } from './crypto.js';

export interface VerifiedJwsResult<T = unknown> {
  verified: boolean;
  header: Record<string, unknown>;
  payload: T;
  rawPayload: string;
}

/**
 * Normalizes Base64URL string to standard Base64.
 */
function base64UrlToBase64(base64Url: string): string {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return base64;
}

/**
 * Converts standard Base64 to Base64URL.
 */
function base64ToBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Verifies an asymmetric JWS (RS256, ES256) compact token or detached signature.
 */
export function verifyJws<T = unknown>(
  jwsToken: string,
  options: JwsVerifyOptions,
): VerifiedJwsResult<T> {
  const parts = jwsToken.trim().split('.');
  if (parts.length !== 3) {
    throw new SecurityViolationError(
      'Malformed JWS Token: Compact serialization requires header.payload.signature parts.',
      { code: 'SECURITY_MALFORMED_JWS' },
    );
  }

  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  let header: Record<string, unknown>;
  let payload: T;
  let rawPayloadStr: string;

  try {
    const headerJson = Buffer.from(base64UrlToBase64(headerB64), 'base64').toString('utf8');
    header = JSON.parse(headerJson);

    rawPayloadStr = Buffer.from(base64UrlToBase64(payloadB64), 'base64').toString('utf8');
    payload = JSON.parse(rawPayloadStr);
  } catch (err) {
    throw new SecurityViolationError('Failed to parse JWS header or payload JSON.', {
      code: 'SECURITY_INVALID_JWS_JSON',
      cause: err,
    });
  }

  const algorithm = (options.algorithm ?? header.alg) as string;
  if (!algorithm || !['RS256', 'ES256', 'PS256'].includes(algorithm)) {
    throw new SecurityViolationError(
      `Unsupported or insecure JWS algorithm: "${algorithm}". Only RS256, ES256, and PS256 are permitted.`,
      { code: 'SECURITY_UNSUPPORTED_JWS_ALG' },
    );
  }

  // Node.js crypto mapping: RS256 -> RSA-SHA256, ES256 -> SHA256
  const cryptoAlg = algorithm === 'ES256' ? 'SHA256' : 'RSA-SHA256';

  const verifier = createVerify(cryptoAlg);
  verifier.update(`${headerB64}.${payloadB64}`);

  const signatureBuffer = Buffer.from(base64UrlToBase64(signatureB64), 'base64');
  const isSignatureValid = verifier.verify(options.publicKey, signatureBuffer);

  if (!isSignatureValid) {
    throw new SecurityViolationError(
      'Asymmetric JWS signature verification failed: Payload was tampered or key is invalid.',
      { code: 'SECURITY_JWS_SIGNATURE_INVALID' },
    );
  }

  // Verify Issuer if specified
  if (options.expectedIssuer && (payload as any)?.iss) {
    if (!constantTimeEqual((payload as any).iss, options.expectedIssuer)) {
      throw new SecurityViolationError(
        `JWS Issuer mismatch: expected "${options.expectedIssuer}" but found "${(payload as any).iss}".`,
        { code: 'SECURITY_JWS_ISSUER_MISMATCH' },
      );
    }
  }

  // Verify Expiry if specified
  if ((payload as any)?.exp) {
    const expTime = (payload as any).exp * 1000;
    const toleranceMs = (options.clockToleranceSeconds ?? 60) * 1000;
    if (Date.now() > expTime + toleranceMs) {
      throw new SecurityViolationError('JWS token has expired.', { code: 'SECURITY_JWS_EXPIRED' });
    }
  }

  return {
    verified: true,
    header,
    payload,
    rawPayload: rawPayloadStr,
  };
}

/**
 * Creates an asymmetric JWS token (for testing or outgoing signed webhooks).
 */
export function signJws(payload: Record<string, unknown>, privateKeyPem: string | Buffer, algorithm: 'RS256' | 'ES256' = 'RS256'): string {
  const header = { alg: algorithm, typ: 'JWT' };
  const headerB64 = base64ToBase64Url(Buffer.from(JSON.stringify(header)).toString('base64'));
  const payloadB64 = base64ToBase64Url(Buffer.from(JSON.stringify(payload)).toString('base64'));

  const dataToSign = `${headerB64}.${payloadB64}`;
  const cryptoAlg = algorithm === 'ES256' ? 'SHA256' : 'RSA-SHA256';

  const signer = createSign(cryptoAlg);
  signer.update(dataToSign);
  const signature = signer.sign(privateKeyPem);
  const signatureB64 = base64ToBase64Url(signature.toString('base64'));

  return `${dataToSign}.${signatureB64}`;
}
