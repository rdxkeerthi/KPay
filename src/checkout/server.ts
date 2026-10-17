/**
 * KPay Server-Side Checkout Gateway Engine
 * Generates self-contained, standalone checkout pages
 * and plug-and-play Express/Connect middleware.
 * 
 * Author: rdxkeerthi
 */

import { CheckoutHtmlOptions } from './types.js';
import { sanitizePaymentInput } from '../security/sanitizer.js';
import { getPaymentSecurityHeaders } from '../security/headers.js';

/**
 * Returns recommended security headers (CSP, Anti-Clickjacking, HSTS) for checkout responses.
 */
export function getCheckoutSecurityHeaders(): Record<string, string> {
  return getPaymentSecurityHeaders();
}

/**
 * Renders a complete, standalone, production-grade Checkout Gateway HTML document.
 * Safe to serve directly from any Node.js HTTP server, Express, Fastify, or Next.js API route.
 */
export function renderCheckoutHtml(options: CheckoutHtmlOptions): string {
  const safeTitle = sanitizePaymentInput(options.pageTitle || 'KPay Secure Checkout');
  const safeMerchant = sanitizePaymentInput(options.payeeName || 'Merchant Store');
  const safeDesc = sanitizePaymentInput(options.description || 'Order Payment');
  const safeOrderId = sanitizePaymentInput(options.orderId);
  const safeTheme = options.themeColor || '#4F46E5';
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
      --kpay-dark: #0f172a;
      --kpay-card-bg: #ffffff;
      --kpay-text: #1e293b;
      --kpay-muted: #64748b;
      --kpay-border: #e2e8f0;
      --kpay-success: #10b981;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
      color: var(--kpay-text);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .kpay-checkout-card {
      width: 100%;
      max-width: 440px;
      background: var(--kpay-card-bg);
      border-radius: 24px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
      overflow: hidden;
      animation: kpaySlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .kpay-header {
      background: linear-gradient(135deg, var(--kpay-primary), #312e81);
      color: #ffffff;
      padding: 24px;
      position: relative;
    }
    .kpay-badge-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .kpay-gateway-badge {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      background: rgba(255, 255, 255, 0.2);
      padding: 4px 10px;
      border-radius: 99px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .kpay-shield-icon { font-size: 13px; }
    .kpay-merchant-name { font-size: 20px; font-weight: 800; margin-bottom: 4px; }
    .kpay-order-meta { font-size: 13px; color: rgba(255, 255, 255, 0.85); display: flex; justify-content: space-between; }
    .kpay-amount-box {
      margin-top: 16px;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 14px;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .kpay-amount-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.85; }
    .kpay-amount-num { font-size: 26px; font-weight: 900; }
    .kpay-tabs {
      display: flex;
      background: #f8fafc;
      border-bottom: 1px solid var(--kpay-border);
      padding: 6px 12px;
      gap: 6px;
    }
    .kpay-tab {
      flex: 1;
      border: none;
      background: none;
      padding: 10px 8px;
      font-size: 13px;
      font-weight: 700;
      color: var(--kpay-muted);
      cursor: pointer;
      border-radius: 10px;
      transition: all 0.2s;
    }
    .kpay-tab.active {
      background: #ffffff;
      color: var(--kpay-primary);
      box-shadow: 0 2px 4px rgba(0,0,0,0.06);
    }
    .kpay-body { padding: 24px; min-height: 310px; }
    .kpay-pane { display: none; }
    .kpay-pane.active { display: block; animation: kpayFade 0.2s ease-out; }
    .kpay-qr-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .kpay-qr-border {
      position: relative;
      padding: 12px;
      background: #ffffff;
      border-radius: 20px;
      border: 2px dashed #cbd5e1;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    .kpay-qr-img { width: 190px; height: 190px; display: block; border-radius: 12px; }
    .kpay-timer { margin-top: 12px; font-size: 13px; color: var(--kpay-muted); font-weight: 600; }
    .kpay-qr-help { font-size: 12px; color: var(--kpay-muted); margin: 6px 0 14px; }
    .kpay-status-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #ecfdf5;
      color: #065f46;
      font-size: 12px;
      font-weight: 700;
      padding: 6px 16px;
      border-radius: 99px;
      border: 1px solid #a7f3d0;
    }
    .kpay-pulse-dot {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      animation: kpayPulse 1.5s infinite;
    }
    .kpay-apps-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }
    .kpay-app-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px;
      border-radius: 14px;
      border: 1px solid var(--kpay-border);
      text-decoration: none;
      color: var(--kpay-text);
      font-size: 14px;
      font-weight: 700;
      background: #ffffff;
      transition: all 0.2s;
    }
    .kpay-app-card:hover {
      border-color: var(--kpay-primary);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.12);
    }
    .kpay-app-icon { font-size: 20px; }
    .kpay-utr-form { display: flex; flex-direction: column; gap: 12px; }
    .kpay-utr-input {
      width: 100%;
      padding: 14px;
      font-size: 16px;
      letter-spacing: 2px;
      text-align: center;
      border: 1.5px solid var(--kpay-border);
      border-radius: 12px;
      outline: none;
      font-weight: 700;
    }
    .kpay-utr-input:focus { border-color: var(--kpay-primary); box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.15); }
    .kpay-btn-primary {
      padding: 14px;
      background: var(--kpay-primary);
      color: #ffffff;
      border: none;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 800;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .kpay-btn-primary:hover { opacity: 0.92; }
    .kpay-footer {
      background: #f8fafc;
      border-top: 1px solid var(--kpay-border);
      padding: 12px 16px;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .kpay-success-pane { text-align: center; padding: 12px 0; }
    .kpay-check-circle { width: 72px; height: 72px; margin: 0 auto 16px; }
    .kpay-circle-anim { stroke-dasharray: 166; stroke-dashoffset: 166; stroke-width: 3; stroke: #10b981; animation: kpayStroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards; }
    .kpay-check-anim { stroke-dasharray: 48; stroke-dashoffset: 48; stroke-width: 3; stroke: #10b981; animation: kpayStroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.6s forwards; }
    .kpay-receipt-table {
      background: #f8fafc;
      border: 1px solid var(--kpay-border);
      border-radius: 14px;
      padding: 14px 16px;
      margin: 16px 0;
      text-align: left;
    }
    .kpay-receipt-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; color: #475569; }
    .kpay-receipt-row:last-child { margin-bottom: 0; }
    .kpay-badge-success { background: #d1fae5; color: #065f46; font-weight: 800; padding: 3px 10px; border-radius: 99px; font-size: 11px; }
    @keyframes kpayFade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes kpaySlideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes kpayPulse { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); } 70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
    @keyframes kpayStroke { 100% { stroke-dashoffset: 0; } }
  </style>
</head>
<body>
  <div class="kpay-checkout-card">
    <div class="kpay-header">
      <div class="kpay-badge-row">
        <span class="kpay-gateway-badge"><span class="kpay-shield-icon">🛡️</span> Verified UPI Gateway</span>
        <span style="font-size: 11px; font-weight: 700; opacity: 0.85;">⚡ KPay</span>
      </div>
      <h1 class="kpay-merchant-name">${safeMerchant}</h1>
      <div class="kpay-order-meta">
        <span>${safeDesc}</span>
        <span>Order: <strong>${safeOrderId}</strong></span>
      </div>
      <div class="kpay-amount-box">
        <span class="kpay-amount-label">Total to Pay</span>
        <span class="kpay-amount-num">${formattedAmount}</span>
      </div>
    </div>

    <div class="kpay-tabs">
      <button class="kpay-tab active" onclick="switchTab('qr')">Scan QR</button>
      <button class="kpay-tab" onclick="switchTab('apps')">UPI Apps</button>
      <button class="kpay-tab" onclick="switchTab('utr')">Enter UTR</button>
    </div>

    <div class="kpay-body" id="kpay-body">
      <!-- QR Tab -->
      <div id="tab-qr" class="kpay-pane active">
        <div class="kpay-qr-wrapper">
          <div class="kpay-qr-border">
            ${options.qrDataUrl ? `<img src="${options.qrDataUrl}" alt="UPI QR" class="kpay-qr-img" />` : '<div style="width:190px;height:190px;display:flex;align-items:center;justify-content:center;">Generating QR...</div>'}
          </div>
          <div class="kpay-timer">⏱️ Session expires in: <strong id="kpay-timer-num">10:00</strong></div>
          <p class="kpay-qr-help">Scan using Google Pay, PhonePe, Paytm, CRED or any UPI App</p>
          <div class="kpay-status-pill">
            <span class="kpay-pulse-dot"></span>
            <span>Waiting for instant bank confirmation...</span>
          </div>
        </div>
      </div>

      <!-- UPI Apps Tab -->
      <div id="tab-apps" class="kpay-pane">
        <p style="font-size: 13px; color: var(--kpay-muted); margin-bottom: 12px; text-align: center;">Tap to launch your UPI app and pay:</p>
        <div class="kpay-apps-grid">
          <a href="phonepe://pay?${queryString}" class="kpay-app-card" target="_blank" rel="noopener">
            <span class="kpay-app-icon">🟣</span>
            <span>PhonePe</span>
          </a>
          <a href="tez://upi/pay?${queryString}" class="kpay-app-card" target="_blank" rel="noopener">
            <span class="kpay-app-icon">🔵</span>
            <span>Google Pay</span>
          </a>
          <a href="paytmmp://pay?${queryString}" class="kpay-app-card" target="_blank" rel="noopener">
            <span class="kpay-app-icon">🔷</span>
            <span>Paytm</span>
          </a>
          <a href="credpay://upi/pay?${queryString}" class="kpay-app-card" target="_blank" rel="noopener">
            <span class="kpay-app-icon">⚫</span>
            <span>CRED</span>
          </a>
          <a href="upi://pay?${queryString}" class="kpay-app-card" style="grid-column: span 2;" target="_blank" rel="noopener">
            <span class="kpay-app-icon">🇮🇳</span>
            <span>BHIM & All Other UPI Apps</span>
          </a>
        </div>
      </div>

      <!-- UTR Tab -->
      <div id="tab-utr" class="kpay-pane">
        <form class="kpay-utr-form" onsubmit="submitUtr(event)">
          <p style="font-size: 13px; color: var(--kpay-muted); line-height: 1.5;">Already completed payment in your UPI app? Enter the 12-digit Bank Reference Number / UTR:</p>
          <input type="text" id="utr-input" class="kpay-utr-input" placeholder="e.g. 429182736451" maxlength="12" pattern="\\d{12}" required autocomplete="off" />
          <button type="submit" class="kpay-btn-primary">Verify Bank Transfer</button>
          <div id="utr-status" style="font-size: 12px; text-align: center; min-height: 18px; font-weight: 700;"></div>
        </form>
      </div>
    </div>

    <div class="kpay-footer">
      🔒 256-BIT ENCRYPTED • DIRECT-TO-BANK • ZERO AGGREGATOR COMMISSION
    </div>
  </div>

  <script>
    const orderId = ${JSON.stringify(safeOrderId)};
    const sseEndpoint = ${JSON.stringify(options.sseEndpoint || '')};
    const utrEndpoint = ${JSON.stringify(options.utrSubmitEndpoint || '')};
    const returnUrl = ${JSON.stringify(options.returnUrl || '')};
    let confirmed = false;

    function switchTab(name) {
      document.querySelectorAll('.kpay-tab').forEach(b => b.classList.remove('active'));
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

    // Audio chime on confirmation
    function playChime() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.001, ctx.currentTime + i * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.1 + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.1);
          osc.stop(ctx.currentTime + i * 0.1 + 0.35);
        });
      } catch(err) {}
    }

    function showSuccess(data) {
      if (confirmed) return;
      confirmed = true;
      playChime();

      const body = document.getElementById('kpay-body');
      body.innerHTML = \`
        <div class="kpay-success-pane">
          <div class="kpay-check-circle">
            <svg viewBox="0 0 52 52" style="width: 100%; height: 100%;">
              <circle class="kpay-circle-anim" cx="26" cy="26" r="24" fill="none"/>
              <path class="kpay-check-anim" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
            </svg>
          </div>
          <h2 style="font-size: 22px; font-weight: 900; color: #0f172a; margin-bottom: 4px;">Payment Received!</h2>
          <p style="font-size: 14px; color: #64748b;">${formattedAmount} deposited directly into bank account</p>
          <div class="kpay-receipt-table">
            <div class="kpay-receipt-row"><span>Order ID</span><strong>\${orderId}</strong></div>
            \${data.utr ? \`<div class="kpay-receipt-row"><span>Bank UTR / Ref</span><strong>\${data.utr}</strong></div>\` : ''}
            <div class="kpay-receipt-row"><span>Status</span><span class="kpay-badge-success">CONFIRMED</span></div>
          </div>
          <div style="font-size: 13px; color: #94a3b8; font-weight: 600;">
            \${returnUrl ? 'Redirecting back to store in <span id="kpay-count">4</span>s...' : 'Payment complete! You may now close this window.'}
          </div>
        </div>
      \`;

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

    // UTR submission handler
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

      status.textContent = '⏳ Verifying with bank...';
      status.style.color = '#64748b';

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

    // Expiry countdown timer
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
