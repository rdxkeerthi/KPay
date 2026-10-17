// ============================================================================
// KPay Security — mTLS (Mutual TLS / Client Certificate Authentication)
// ============================================================================

import type { TLSSocket } from 'node:tls';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { MtlsConfig } from '../types.js';

export interface PeerCertDetails {
  subjectCN?: string;
  issuerCN?: string;
  fingerprint256: string;
  validFrom: string;
  validTo: string;
}

/**
 * Validates a client certificate presented during an mTLS handshake.
 * Used to verify webhook deliveries originating directly from banking switches or enterprise PSPs.
 */
export function verifyMtlsClientCertificate(
  socket: TLSSocket,
  config?: MtlsConfig,
): { verified: boolean; certDetails?: PeerCertDetails; reason?: string } {
  // If not a TLS socket or client did not present a cert
  if (typeof socket.getPeerCertificate !== 'function') {
    return { verified: false, reason: 'Request was not delivered over an encrypted TLS connection.' };
  }

  const cert = socket.getPeerCertificate();
  if (!cert || Object.keys(cert).length === 0) {
    return { verified: false, reason: 'Client certificate was not presented during mTLS handshake.' };
  }

  const isAuthorized = socket.authorized;
  if (!isAuthorized && config?.rejectUnauthorized !== false) {
    return {
      verified: false,
      reason: `Client certificate failed CA validation: ${socket.authorizationError ?? 'Unknown authorization error'}`,
    };
  }

  const fingerprint256 = cert.fingerprint256;
  const rawSubjectCn = cert.subject?.CN;
  const subjectCN = Array.isArray(rawSubjectCn) ? rawSubjectCn[0] : rawSubjectCn;
  const rawIssuerCn = cert.issuer?.CN;
  const issuerCN = Array.isArray(rawIssuerCn) ? rawIssuerCn[0] : rawIssuerCn;

  // 1. Verify against allowed SHA-256 fingerprints whitelist if configured
  if (config?.allowedFingerprints && config.allowedFingerprints.length > 0) {
    const isWhitelisted = config.allowedFingerprints.some(
      f => f.replace(/:/g, '').toLowerCase() === fingerprint256.replace(/:/g, '').toLowerCase(),
    );
    if (!isWhitelisted) {
      return {
        verified: false,
        reason: `Client certificate fingerprint "${fingerprint256}" is not in the trusted whitelist.`,
      };
    }
  }

  // 2. Verify against allowed Common Names (CNs) if configured
  if (config?.allowedCommonNames && config.allowedCommonNames.length > 0) {
    const isCnAllowed = config.allowedCommonNames.includes(subjectCN || '');
    if (!isCnAllowed) {
      return {
        verified: false,
        reason: `Client certificate Common Name "${subjectCN}" is not authorized.`,
      };
    }
  }

  return {
    verified: true,
    certDetails: {
      subjectCN,
      issuerCN,
      fingerprint256,
      validFrom: cert.valid_from,
      validTo: cert.valid_to,
    },
  };
}

/**
 * HTTP Middleware for Express, Fastify, and Node.js to enforce mTLS verification on webhooks.
 */
export function mtlsGuardMiddleware(config?: MtlsConfig) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const socket = req.socket as unknown as TLSSocket;
    const result = verifyMtlsClientCertificate(socket, config);

    if (!result.verified) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'mTLS Handshake Verification Failed',
        details: result.reason,
      }));
      return;
    }

    // Attach verified certificate details to request
    (req as any).clientCert = result.certDetails;
    next();
  };
}
