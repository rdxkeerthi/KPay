// ============================================================================
// KPay Security — HTTP Payment Security Headers (Anti-Clickjacking / CSP)
// ============================================================================

export function getPaymentSecurityHeaders(): Record<string, string> {
  return {
    // Prevent payment page from being embedded in malicious iframes (Anti-Clickjacking)
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "frame-ancestors 'none'; default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;",
    // Prevent MIME-sniffing
    'X-Content-Type-Options': 'nosniff',
    // Strict Transport Security (HTTPS enforcement)
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    // Referrer Policy to prevent token/order leaking in Referer header
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Cache control: never cache financial/payment session states
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  };
}
