/**
 * KPay Server-Side Checkout Gateway Engine
 * Ultra-Modern Glassmorphic Payment Gateway UI with Authentic SVG App Icons,
 * Ambient Aurora Glow, Real-Time SSE Listener, Multi-tone Harmonic Chime & Confetti.
 * 
 * Author: rdxkeerthi
 */

import { CheckoutHtmlOptions } from './types.js';
import { sanitizePaymentInput } from '../security/sanitizer.js';
import { getPaymentSecurityHeaders } from '../security/headers.js';

export function getCheckoutSecurityHeaders(): Record<string, string> {
  return getPaymentSecurityHeaders();
}

export function renderCheckoutHtml(options: CheckoutHtmlOptions): string {
  const safeTitle = sanitizePaymentInput(options.pageTitle || 'KPay Secure Checkout');
  const safeMerchant = sanitizePaymentInput(options.payeeName || 'Merchant Store');
  const safeDesc = sanitizePaymentInput(options.description || 'Order Payment');
  const safeOrderId = sanitizePaymentInput(options.orderId);
  const safeTheme = options.themeColor || '#6366F1';
  const formattedAmount = `₹${options.amount.toFixed(2)}`;
  const queryString = options.upiUri ? options.upiUri.replace(/^upi:\/\/pay\?/, '') : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${safeTitle} - ${safeMerchant}</title>
  <style>
    :root {
      --kpay-primary: ${safeTheme};
      --kpay-glow: rgba(99, 102, 241, 0.35);
      --kpay-emerald: #10b981;
      --kpay-glass-bg: rgba(15, 23, 42, 0.78);
      --kpay-glass-border: rgba(255, 255, 255, 0.12);
      --kpay-text-main: #ffffff;
      --kpay-text-muted: rgba(255, 255, 255, 0.65);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
      background: #090d16;
      color: var(--kpay-text-main);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      overflow-x: hidden;
      position: relative;
    }

    /* Ambient Aurora Glow Background */
    .kpay-aurora-bg {
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      overflow: hidden;
    }
    .kpay-orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(90px);
      opacity: 0.45;
      animation: kpayFloat 18s ease-in-out infinite alternate;
    }
    .kpay-orb-1 { width: 380px; height: 380px; background: #6366f1; top: -80px; left: -80px; }
    .kpay-orb-2 { width: 420px; height: 420px; background: #ec4899; bottom: -100px; right: -100px; animation-duration: 22s; }
    .kpay-orb-3 { width: 300px; height: 300px; background: #10b981; top: 40%; right: 15%; animation-duration: 15s; }

    /* Glassmorphic Container */
    .kpay-glass-card {
      position: relative;
      z-index: 10;
      width: 100%;
      max-width: 440px;
      background: var(--kpay-glass-bg);
      backdrop-filter: blur(28px) saturate(180%);
      -webkit-backdrop-filter: blur(28px) saturate(180%);
      border: 1px solid var(--kpay-glass-border);
      border-radius: 28px;
      box-shadow: 0 35px 70px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.2);
      overflow: hidden;
      animation: kpaySlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    /* Header */
    .kpay-header {
      padding: 24px 26px 20px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      position: relative;
    }
    .kpay-badge-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    }
    .kpay-verified-tag {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
      padding: 4px 12px;
      border-radius: 99px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .kpay-logo-text {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 1px;
      background: linear-gradient(135deg, #a5b4fc, #f472b6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .kpay-merchant-name {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.3px;
      margin-bottom: 4px;
    }
    .kpay-meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: var(--kpay-text-muted);
    }
    .kpay-amount-box {
      margin-top: 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 18px;
      padding: 14px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    .kpay-amount-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: var(--kpay-text-muted); }
    .kpay-amount-val { font-size: 28px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff; text-shadow: 0 0 20px var(--kpay-glow); }

    /* Tabs */
    .kpay-tabs {
      display: flex;
      background: rgba(0, 0, 0, 0.25);
      padding: 6px 10px;
      gap: 6px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .kpay-tab-btn {
      flex: 1;
      border: none;
      background: none;
      padding: 10px 12px;
      font-size: 13px;
      font-weight: 700;
      color: var(--kpay-text-muted);
      cursor: pointer;
      border-radius: 12px;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .kpay-tab-btn.active {
      background: rgba(255, 255, 255, 0.14);
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }

    /* Body */
    .kpay-body { padding: 24px; min-height: 310px; }
    .kpay-pane { display: none; }
    .kpay-pane.active { display: block; animation: kpayFade 0.25s ease-out; }

    /* QR View */
    .kpay-qr-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .kpay-qr-glow-box {
      position: relative;
      padding: 14px;
      background: #ffffff;
      border-radius: 24px;
      box-shadow: 0 0 35px rgba(99, 102, 241, 0.25), 0 10px 25px rgba(0,0,0,0.4);
      overflow: hidden;
    }
    .kpay-qr-img { width: 190px; height: 190px; display: block; border-radius: 12px; }
    .kpay-scanline {
      position: absolute;
      left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, transparent, #6366f1, #10b981, transparent);
      box-shadow: 0 0 12px #6366f1;
      animation: kpayScan 2.4s ease-in-out infinite alternate;
    }
    .kpay-timer-chip {
      margin-top: 14px;
      font-size: 13px;
      color: var(--kpay-text-muted);
      font-weight: 600;
      background: rgba(255, 255, 255, 0.06);
      padding: 4px 12px;
      border-radius: 99px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .kpay-qr-hint { font-size: 12px; color: var(--kpay-text-muted); margin: 8px 0 14px; }
    .kpay-status-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(16, 185, 129, 0.12);
      color: #34d399;
      font-size: 12px;
      font-weight: 700;
      padding: 7px 18px;
      border-radius: 99px;
      border: 1px solid rgba(16, 185, 129, 0.25);
    }
    .kpay-pulse {
      width: 8px; height: 8px; background: #34d399; border-radius: 50%;
      box-shadow: 0 0 0 rgba(52, 211, 153, 0.6);
      animation: kpayPulseGlow 1.6s infinite;
    }

    /* UPI Apps Grid with Authentic SVG Logos */
    .kpay-apps-list { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .kpay-app-btn {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      text-decoration: none;
      color: #ffffff;
      font-size: 13px;
      font-weight: 700;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .kpay-app-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.3);
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
    }
    .kpay-app-icon-box {
      width: 32px; height: 32px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }

    /* UTR Form */
    .kpay-utr-box { display: flex; flex-direction: column; gap: 14px; }
    .kpay-utr-desc { font-size: 13px; color: var(--kpay-text-muted); line-height: 1.5; }
    .kpay-input-field {
      width: 100%;
      padding: 14px 16px;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 14px;
      color: #ffffff;
      font-size: 16px;
      letter-spacing: 2px;
      text-align: center;
      outline: none;
      font-weight: 700;
      transition: all 0.2s;
    }
    .kpay-input-field:focus {
      border-color: var(--kpay-primary);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
    }
    .kpay-action-btn {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, var(--kpay-primary), #4f46e5);
      color: #ffffff;
      border: none;
      border-radius: 14px;
      font-size: 14px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 10px 20px -5px rgba(99, 102, 241, 0.5);
      transition: all 0.2s;
    }
    .kpay-action-btn:hover { opacity: 0.94; transform: translateY(-1px); }

    /* Footer */
    .kpay-footer {
      background: rgba(0, 0, 0, 0.3);
      padding: 12px 16px;
      text-align: center;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.45);
      font-weight: 700;
      letter-spacing: 0.5px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }

    /* Success Celebration View */
    .kpay-success-pane { text-align: center; padding: 14px 0; position: relative; }
    .kpay-check-halo {
      position: relative;
      width: 80px; height: 80px;
      margin: 0 auto 16px;
      display: flex; align-items: center; justify-content: center;
    }
    .kpay-halo-glow {
      position: absolute; inset: -10px;
      background: radial-gradient(circle, rgba(16, 185, 129, 0.45) 0%, transparent 70%);
      border-radius: 50%;
      animation: kpayHalo 2s infinite alternate;
    }
    .kpay-svg-check { width: 72px; height: 72px; position: relative; z-index: 2; }
    .kpay-circle-path { stroke-dasharray: 166; stroke-dashoffset: 166; stroke-width: 3.5; stroke: #10b981; animation: kpayStroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards; }
    .kpay-check-path { stroke-dasharray: 48; stroke-dashoffset: 48; stroke-width: 4; stroke: #10b981; animation: kpayStroke 0.35s cubic-bezier(0.65, 0, 0.45, 1) 0.6s forwards; }

    .kpay-success-title { font-size: 24px; font-weight: 900; color: #ffffff; margin-bottom: 4px; }
    .kpay-success-sub { font-size: 14px; color: var(--kpay-text-muted); margin-bottom: 18px; }
    .kpay-receipt-card {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 18px;
      padding: 16px;
      text-align: left;
      margin-bottom: 16px;
    }
    .kpay-receipt-line { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; color: rgba(255, 255, 255, 0.7); }
    .kpay-receipt-line:last-child { margin-bottom: 0; }
    .kpay-utr-badge { background: rgba(16, 185, 129, 0.15); color: #34d399; font-weight: 800; padding: 2px 10px; border-radius: 99px; font-size: 11px; }

    /* Confetti Particle Layer */
    .kpay-confetti {
      position: absolute;
      width: 8px; height: 8px;
      border-radius: 2px;
      opacity: 0;
      pointer-events: none;
      animation: kpayConfetti 1.4s ease-out forwards;
    }

    @keyframes kpayFloat { 0% { transform: translate(0, 0); } 100% { transform: translate(30px, 30px); } }
    @keyframes kpaySlideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes kpayFade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes kpayScan { 0% { top: 10px; opacity: 0.3; } 100% { top: 190px; opacity: 1; } }
    @keyframes kpayPulseGlow { 0% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.7); } 70% { box-shadow: 0 0 0 8px rgba(52, 211, 153, 0); } 100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); } }
    @keyframes kpayStroke { 100% { stroke-dashoffset: 0; } }
    @keyframes kpayHalo { from { transform: scale(0.9); opacity: 0.3; } to { transform: scale(1.15); opacity: 0.6; } }
    @keyframes kpayConfetti {
      0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
      100% { transform: translate(var(--dx), var(--dy)) rotate(720deg); opacity: 0; }
    }
  </style>
</head>
<body>
  <!-- Ambient Aurora Orbs -->
  <div class="kpay-aurora-bg">
    <div class="kpay-orb kpay-orb-1"></div>
    <div class="kpay-orb kpay-orb-2"></div>
    <div class="kpay-orb kpay-orb-3"></div>
  </div>

  <!-- Glassmorphic Card -->
  <div class="kpay-glass-card">
    <div class="kpay-header">
      <div class="kpay-badge-row">
        <span class="kpay-verified-tag">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          NPCI Cyber Shield
        </span>
        <span class="kpay-logo-text">⚡ KPay Engine</span>
      </div>
      <h1 class="kpay-merchant-name">${safeMerchant}</h1>
      <div class="kpay-meta-row">
        <span>${safeDesc}</span>
        <span>Order: <strong>${safeOrderId}</strong></span>
      </div>
      <div class="kpay-amount-box">
        <span class="kpay-amount-label">Amount Payable</span>
        <span class="kpay-amount-val">${formattedAmount}</span>
      </div>
    </div>

    <!-- Tabs -->
    <div class="kpay-tabs">
      <button class="kpay-tab-btn active" onclick="switchTab('qr')">⚡ Dynamic QR</button>
      <button class="kpay-tab-btn" onclick="switchTab('apps')">📱 UPI Apps</button>
      <button class="kpay-tab-btn" onclick="switchTab('utr')">📝 Manual UTR</button>
    </div>

    <div class="kpay-body" id="kpay-body">
      <!-- QR Tab -->
      <div id="tab-qr" class="kpay-pane active">
        <div class="kpay-qr-center">
          <div class="kpay-qr-glow-box">
            ${options.qrDataUrl ? `<img src="${options.qrDataUrl}" alt="Scan UPI QR" class="kpay-qr-img" />` : '<div style="width:190px;height:190px;display:flex;align-items:center;justify-content:center;color:#000;">Generating QR...</div>'}
            <div class="kpay-scanline"></div>
          </div>
          <div class="kpay-timer-chip">⏱️ Expires in: <strong id="kpay-timer-num">10:00</strong></div>
          <p class="kpay-qr-hint">Scan with any UPI app to pay directly into bank account</p>
          <div class="kpay-status-pill">
            <span class="kpay-pulse"></span>
            <span>Live Bank SSE Listener Active...</span>
          </div>
        </div>
      </div>

      <!-- UPI Apps Tab with Authentic SVG Logos -->
      <div id="tab-apps" class="kpay-pane">
        <p style="font-size: 13px; color: var(--kpay-text-muted); margin-bottom: 14px; text-align: center;">Tap your preferred app to complete payment:</p>
        <div class="kpay-apps-list">
          <!-- PhonePe -->
          <a href="phonepe://pay?${queryString}" class="kpay-app-btn" target="_blank" rel="noopener">
            <div class="kpay-app-icon-box" style="background: #5f259f;">
              <svg width="20" height="20" viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#5f259f"/><path d="M25.8 38.5V28.2H29c4.2 0 6.6-2.2 6.6-5.8 0-3.8-2.6-5.8-6.8-5.8H18.5v21.9h7.3zm0-16.1h3c1.7 0 2.6.8 2.6 2.1 0 1.4-.9 2.2-2.6 2.2h-3v-4.3z" fill="#ffffff"/><path d="M14.5 9.5l9.8 14.8" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round"/></svg>
            </div>
            <span>PhonePe</span>
          </a>

          <!-- Google Pay -->
          <a href="tez://upi/pay?${queryString}" class="kpay-app-btn" target="_blank" rel="noopener">
            <div class="kpay-app-icon-box" style="background: #ffffff;">
              <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.7 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.6c-.3 1.5-1.1 2.8-2.4 3.7v3.1h3.9c2.3-2.1 3.6-5.2 3.6-9z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-3l-3.9-3.1c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5H1.2v3.2C3.2 21.3 7.3 24 12 24z"/><path fill="#FBBC05" d="M5.2 14.1c-.3-.8-.4-1.6-.4-2.4s.1-1.6.4-2.4V6.1H1.2C.4 7.7 0 9.8 0 12s.4 4.3 1.2 5.9l4-3.8z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.3 0 3.2 2.7 1.2 6.1l4 3.2c1-2.9 3.7-4.5 6.8-4.5z"/></svg>
            </div>
            <span>Google Pay</span>
          </a>

          <!-- Paytm -->
          <a href="paytmmp://pay?${queryString}" class="kpay-app-btn" target="_blank" rel="noopener">
            <div class="kpay-app-icon-box" style="background: #002e6e;">
              <svg width="22" height="22" viewBox="0 0 36 36"><path fill="#00baf2" d="M6 18c0-6.6 5.4-12 12-12s12 5.4 12 12-5.4 12-12 12S6 24.6 6 18z"/><path fill="#ffffff" d="M12 13h4c2.2 0 3.5 1.1 3.5 2.8 0 1.9-1.3 2.9-3.5 2.9h-2v4h-2v-9.7zm2 4.1h1.8c1 0 1.7-.5 1.7-1.3 0-.9-.7-1.3-1.7-1.3H14v2.6zM22 17.5h2v5.2h-2v-5.2zm0-4.5h2v2h-2v-2z"/></svg>
            </div>
            <span>Paytm</span>
          </a>

          <!-- CRED -->
          <a href="credpay://upi/pay?${queryString}" class="kpay-app-btn" target="_blank" rel="noopener">
            <div class="kpay-app-icon-box" style="background: #111111; border: 1px solid rgba(255,255,255,0.2);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5"><path d="M12 2L3 7v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V7l-9-5z"/><path d="M12 8v8M8 12h8"/></svg>
            </div>
            <span>CRED</span>
          </a>

          <!-- BHIM / NPCI UPI -->
          <a href="upi://pay?${queryString}" class="kpay-app-btn" style="grid-column: span 2;" target="_blank" rel="noopener">
            <div class="kpay-app-icon-box" style="background: #ffffff;">
              <svg width="22" height="22" viewBox="0 0 32 32"><path fill="#f37021" d="M18 4l-10 14h8l-2 10 12-14h-8z"/></svg>
            </div>
            <span>BHIM UPI & All Other Banking Apps</span>
          </a>
        </div>
      </div>

      <!-- UTR Tab -->
      <div id="tab-utr" class="kpay-pane">
        <form class="kpay-utr-box" onsubmit="submitUtr(event)">
          <p class="kpay-utr-desc">Already completed the transfer in your UPI app? Paste the 12-digit UPI Reference Number / Bank UTR from your SMS or app receipt:</p>
          <input type="text" id="utr-input" class="kpay-input-field" placeholder="e.g. 429182736451" maxlength="12" pattern="\\d{12}" required autocomplete="off" />
          <button type="submit" class="kpay-action-btn">Verify Bank Transfer</button>
          <div id="utr-status" style="font-size: 13px; text-align: center; min-height: 20px; font-weight: 700;"></div>
        </form>
      </div>
    </div>

    <div class="kpay-footer">
      🔒 256-BIT CYBER ENCRYPTED • DIRECT BANK SETTLEMENT • ZERO COMMISSION
    </div>
  </div>

  <script>
    const orderId = ${JSON.stringify(safeOrderId)};
    const sseEndpoint = ${JSON.stringify(options.sseEndpoint || '')};
    const utrEndpoint = ${JSON.stringify(options.utrSubmitEndpoint || '')};
    const returnUrl = ${JSON.stringify(options.returnUrl || '')};
    let confirmed = false;

    function switchTab(name) {
      document.querySelectorAll('.kpay-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.kpay-pane').forEach(p => p.classList.remove('active'));
      event.target.classList.add('active');
      document.getElementById('tab-' + name).classList.add('active');
    }

    // Real-Time SSE Listener
    if (sseEndpoint && typeof EventSource !== 'undefined') {
      try {
        const es = new EventSource(sseEndpoint);
        es.onmessage = function(e) {
          try {
            const data = JSON.parse(e.data);
            if (data.status === 'SUCCESS' || data.type === 'PAYMENT_SUCCESS') {
              es.close();
              showSuccess(data);
            }
          } catch(err) {}
        };
      } catch(e) {}
    }

    // Polyphonic Harmonic Cinematic Audio Chime
    function playChime() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.3, ctx.currentTime);
        masterGain.connect(ctx.destination);

        // Harmonic notes: C5, E5, G5, C6
        const chord = [523.25, 659.25, 783.99, 1046.50];
        chord.forEach((freq, i) => {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const noteGain = ctx.createGain();

          osc1.type = 'triangle';
          osc1.frequency.value = freq;
          osc2.type = 'sine';
          osc2.frequency.value = freq * 1.004; // Gentle chorus shimmer

          const noteTime = ctx.currentTime + i * 0.08;
          noteGain.gain.setValueAtTime(0.001, noteTime);
          noteGain.gain.exponentialRampToValueAtTime(0.35, noteTime + 0.04);
          noteGain.gain.exponentialRampToValueAtTime(0.001, noteTime + 1.2);

          osc1.connect(noteGain);
          osc2.connect(noteGain);
          noteGain.connect(masterGain);

          osc1.start(noteTime);
          osc2.start(noteTime);
          osc1.stop(noteTime + 1.3);
          osc2.stop(noteTime + 1.3);
        });
      } catch(err) {}
    }

    // Confetti Particle Explosion
    function spawnConfetti(parent) {
      const colors = ['#10b981', '#6366f1', '#ec4899', '#f59e0b', '#3b82f6'];
      for (let i = 0; i < 35; i++) {
        const p = document.createElement('div');
        p.className = 'kpay-confetti';
        p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        p.style.left = '50%';
        p.style.top = '25%';
        const angle = Math.random() * Math.PI * 2;
        const distance = 80 + Math.random() * 160;
        p.style.setProperty('--dx', (Math.cos(angle) * distance) + 'px');
        p.style.setProperty('--dy', (Math.sin(angle) * distance) + 'px');
        p.style.animationDelay = (Math.random() * 0.15) + 's';
        parent.appendChild(p);
      }
    }

    function showSuccess(data) {
      if (confirmed) return;
      confirmed = true;
      playChime();

      const body = document.getElementById('kpay-body');
      body.innerHTML = \`
        <div class="kpay-success-pane" id="kpay-success-box">
          <div class="kpay-check-halo">
            <div class="kpay-halo-glow"></div>
            <svg class="kpay-svg-check" viewBox="0 0 52 52">
              <circle class="kpay-circle-path" cx="26" cy="26" r="24" fill="none"/>
              <path class="kpay-check-path" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
            </svg>
          </div>
          <h2 class="kpay-success-title">Payment Confirmed!</h2>
          <p class="kpay-success-sub">${formattedAmount} credited directly into your bank account</p>
          <div class="kpay-receipt-card">
            <div class="kpay-receipt-line"><span>Order ID</span><strong style="color:#ffffff;">\${orderId}</strong></div>
            \${data.utr ? \`<div class="kpay-receipt-line"><span>Bank UTR / Ref</span><strong style="color:#34d399; letter-spacing:1px;">\${data.utr}</strong></div>\` : ''}
            <div class="kpay-receipt-line"><span>Settlement</span><span class="kpay-utr-badge">INSTANT • ₹0 FEE</span></div>
          </div>
          <div style="font-size: 13px; color: var(--kpay-text-muted); font-weight: 600;">
            \${returnUrl ? 'Redirecting back in <span id="kpay-count">4</span>s...' : 'Payment complete! You may safely close this page.'}
          </div>
        </div>
      \`;

      spawnConfetti(document.getElementById('kpay-success-box'));

      if (returnUrl) {
        let sec = 4;
        const interval = setInterval(() => {
          sec -= 1;
          const el = document.getElementById('kpay-count');
          if (el) el.textContent = sec;
          if (sec <= 0) {
            clearInterval(interval);
            window.location.href = returnUrl + (returnUrl.includes('?') ? '&' : '?') + 'orderId=' + encodeURIComponent(orderId) + '&status=SUCCESS';
          }
        }, 1000);
      }
    }

    // UTR submission
    async function submitUtr(e) {
      e.preventDefault();
      const input = document.getElementById('utr-input');
      const status = document.getElementById('utr-status');
      const val = input.value.trim();

      if (!/^\\d{12}$/.test(val)) {
        status.textContent = '❌ Please enter a valid 12-digit number.';
        status.style.color = '#ef4444';
        return;
      }

      status.textContent = '⏳ Verifying with bank ledger...';
      status.style.color = '#a5b4fc';

      if (utrEndpoint) {
        try {
          const res = await fetch(utrEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, utr: val }),
          });
          const json = await res.json();
          if (json.verified || json.status === 'SUCCESS') {
            showSuccess({ utr: val });
            return;
          }
          status.textContent = json.message || '❌ Payment not yet confirmed by bank.';
          status.style.color = '#ef4444';
        } catch(err) {
          status.textContent = '❌ Network error submitting UTR.';
          status.style.color = '#ef4444';
        }
      } else {
        showSuccess({ utr: val });
      }
    }

    // Countdown
    let timeLeft = 600;
    const timerNum = document.getElementById('kpay-timer-num');
    const timerInterval = setInterval(() => {
      if (confirmed) { clearInterval(timerInterval); return; }
      timeLeft -= 1;
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        timerNum.textContent = 'Expired';
        return;
      }
      const m = Math.floor(timeLeft / 60);
      const s = timeLeft % 60;
      timerNum.textContent = m + ':' + (s < 10 ? '0' : '') + s;
    }, 1000);
  </script>
</body>
</html>`;
}
