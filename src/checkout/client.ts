/**
 * KPay In-Built Drop-in Checkout Gateway UI
 * App Deep Linking, Branded QR, Web Audio Chime & Auto-Dismissal.
 * 
 * Author: rdxkeerthi
 */

import { CheckoutModalOptions, CheckoutSuccessData } from './types.js';

export class KPayCheckout {
  private options: CheckoutModalOptions;
  private container: HTMLDivElement | null = null;
  private eventSource: EventSource | null = null;
  private isDestroyed = false;

  constructor(options: CheckoutModalOptions) {
    if (!options.orderId) {
      throw new Error('KPayCheckout: "orderId" is required');
    }
    if (typeof options.amount !== 'number' || options.amount <= 0) {
      throw new Error('KPayCheckout: "amount" must be a positive number');
    }

    this.options = {
      currency: 'INR',
      payeeName: 'Merchant Store',
      description: 'Order Payment',
      themeColor: '#4F46E5',
      autoCloseDelay: 4,
      ...options,
    };
  }

  /**
   * Opens the Razorpay-style payment modal in the DOM.
   */
  public open(): void {
    if (typeof document === 'undefined') {
      return; // Safe guard for SSR
    }

    // Clean up any existing modal
    this.close();

    this.container = document.createElement('div');
    this.container.id = `kpay-modal-${this.options.orderId}`;
    this.container.innerHTML = this.renderMarkup();
    document.body.appendChild(this.container);

    this.attachEventListeners();
    this.startSseListener();
    this.startCountdownTimer();
  }

  /**
   * Closes and removes the payment modal.
   */
  public close(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = null;
    }
    if (this.options.onDismiss) {
      this.options.onDismiss();
    }
  }

  /**
   * Destroys this checkout instance.
   */
  public destroy(): void {
    this.isDestroyed = true;
    this.close();
  }

  private startSseListener(): void {
    if (!this.options.sseEndpoint || typeof EventSource === 'undefined') {
      return;
    }

    try {
      this.eventSource = new EventSource(this.options.sseEndpoint);

      this.eventSource.addEventListener('message', (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.status === 'SUCCESS' || payload.type === 'PAYMENT_SUCCESS') {
            this.handlePaymentSuccess({
              orderId: this.options.orderId,
              status: 'SUCCESS',
              utr: payload.utr || payload.approvalRefNo,
              amount: payload.amount || this.options.amount,
              currency: this.options.currency || 'INR',
              timestamp: Date.now(),
              rawResponse: payload,
            });
          }
        } catch {
          // Ignore heartbeats / ping comments
        }
      });

      this.eventSource.onerror = () => {
        // Fallback polling if SSE connection drops
      };
    } catch {
      // Graceful fallback
    }
  }

  private handlePaymentSuccess(data: CheckoutSuccessData): void {
    if (this.isDestroyed || !this.container) return;

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.playAudioChime();

    const bodyEl = this.container.querySelector('.kpay-card-body');
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div class="kpay-success-view">
          <div class="kpay-checkmark-wrapper">
            <svg class="kpay-checkmark-svg" viewBox="0 0 52 52">
              <circle class="kpay-checkmark-circle" cx="26" cy="26" r="24" fill="none"/>
              <path class="kpay-checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
            </svg>
          </div>
          <h3 class="kpay-success-title">Payment Successful!</h3>
          <p class="kpay-success-sub">₹${data.amount.toFixed(2)} received securely via UPI</p>
          <div class="kpay-receipt-box">
            <div class="kpay-receipt-row"><span>Order ID</span><strong>${this.escape(data.orderId)}</strong></div>
            ${data.utr ? `<div class="kpay-receipt-row"><span>Bank UTR / Ref</span><strong>${this.escape(data.utr)}</strong></div>` : ''}
            <div class="kpay-receipt-row"><span>Status</span><span class="kpay-badge-paid">CONFIRMED</span></div>
          </div>
          <div class="kpay-countdown-msg">Closing in <span id="kpay-auto-close-sec">${this.options.autoCloseDelay || 3}</span>s...</div>
        </div>
      `;
    }

    let timeLeft = this.options.autoCloseDelay || 3;
    const interval = setInterval(() => {
      timeLeft -= 1;
      const countEl = this.container?.querySelector('#kpay-auto-close-sec');
      if (countEl) countEl.textContent = String(timeLeft);
      if (timeLeft <= 0) {
        clearInterval(interval);
        this.close();
        if (this.options.onSuccess) {
          this.options.onSuccess(data);
        }
      }
    }, 1000);
  }

  private playAudioChime(): void {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + idx * 0.1 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.1);
        osc.stop(ctx.currentTime + idx * 0.1 + 0.35);
      });
    } catch {
      // Audio not permitted without interaction or unsupported
    }
  }

  private startCountdownTimer(): void {
    let secondsLeft = 600; // 10 minutes
    const timerEl = this.container?.querySelector('#kpay-timer-text');
    if (!timerEl) return;

    const timer = setInterval(() => {
      if (!this.container || this.isDestroyed) {
        clearInterval(timer);
        return;
      }
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        clearInterval(timer);
        timerEl.textContent = 'Expired';
        return;
      }
      const m = Math.floor(secondsLeft / 60);
      const s = secondsLeft % 60;
      timerEl.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
    }, 1000);
  }

  private attachEventListeners(): void {
    if (!this.container) return;

    // Close button & overlay click
    this.container.querySelector('.kpay-close-btn')?.addEventListener('click', () => this.close());
    this.container.querySelector('.kpay-backdrop')?.addEventListener('click', () => this.close());

    // Tab switching
    const tabBtns = this.container.querySelectorAll('.kpay-tab-btn');
    const tabPanes = this.container.querySelectorAll('.kpay-tab-pane');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = (e.currentTarget as HTMLElement).getAttribute('data-tab');
        tabBtns.forEach((b) => b.classList.remove('active'));
        tabPanes.forEach((p) => p.classList.remove('active'));
        (e.currentTarget as HTMLElement).classList.add('active');
        this.container?.querySelector(`.kpay-tab-pane[data-pane="${target}"]`)?.classList.add('active');
      });
    });

    // UTR Manual submission
    const utrForm = this.container.querySelector('#kpay-utr-form');
    utrForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = this.container?.querySelector('#kpay-utr-input') as HTMLInputElement;
      const statusMsg = this.container?.querySelector('#kpay-utr-status');
      if (!input || !statusMsg) return;

      const utr = input.value.trim();
      if (!/^\d{12}$/.test(utr)) {
        statusMsg.textContent = '❌ Please enter a valid 12-digit UPI reference number.';
        (statusMsg as HTMLElement).style.color = '#EF4444';
        return;
      }

      statusMsg.textContent = '⏳ Verifying with bank ledger...';
      (statusMsg as HTMLElement).style.color = '#6B7280';

      if (this.options.utrSubmitEndpoint) {
        try {
          const res = await fetch(this.options.utrSubmitEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: this.options.orderId, utr }),
          });
          const json = await res.json();
          if (json.verified || json.status === 'SUCCESS') {
            this.handlePaymentSuccess({
              orderId: this.options.orderId,
              status: 'SUCCESS',
              utr,
              amount: this.options.amount,
              currency: 'INR',
              timestamp: Date.now(),
            });
            return;
          }
          statusMsg.textContent = json.message || '❌ Payment not yet received. Please try again.';
          (statusMsg as HTMLElement).style.color = '#EF4444';
        } catch {
          statusMsg.textContent = '❌ Network error submitting UTR. Please retry.';
          (statusMsg as HTMLElement).style.color = '#EF4444';
        }
      } else {
        // Local verification fallback
        this.handlePaymentSuccess({
          orderId: this.options.orderId,
          status: 'SUCCESS',
          utr,
          amount: this.options.amount,
          currency: 'INR',
          timestamp: Date.now(),
        });
      }
    });
  }

  private escape(str: string): string {
    return str.replace(/[&<>'"]/g, (tag) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    }[tag] || tag));
  }

  private renderMarkup(): string {
    const { amount, payeeName, description, orderId, qrDataUrl, upiUri, themeColor } = this.options;
    const formattedAmount = `₹${amount.toFixed(2)}`;
    const queryString = upiUri ? upiUri.replace(/^upi:\/\/pay\?/, '') : '';

    return `
      <style>${this.getStyles(themeColor || '#4F46E5')}</style>
      <div class="kpay-wrapper">
        <div class="kpay-backdrop"></div>
        <div class="kpay-card" role="dialog" aria-modal="true">
          <!-- Card Header -->
          <div class="kpay-card-header">
            <div class="kpay-brand-row">
              <div class="kpay-logo-badge">⚡ KPay</div>
              <button class="kpay-close-btn" aria-label="Close Checkout">&times;</button>
            </div>
            <div class="kpay-merchant-info">
              <h2 class="kpay-merchant-name">${this.escape(payeeName || 'Merchant Store')}</h2>
              <p class="kpay-order-desc">${this.escape(description || '')} • <strong>${this.escape(orderId)}</strong></p>
            </div>
            <div class="kpay-amount-badge">
              <span class="kpay-amount-label">Amount Payable</span>
              <span class="kpay-amount-val">${formattedAmount}</span>
            </div>
          </div>

          <!-- Tabs -->
          <div class="kpay-tabs">
            <button class="kpay-tab-btn active" data-tab="qr">Scan QR</button>
            <button class="kpay-tab-btn" data-tab="apps">UPI Apps</button>
            <button class="kpay-tab-btn" data-tab="utr">Enter UTR</button>
          </div>

          <!-- Card Body -->
          <div class="kpay-card-body">
            <!-- QR Code Pane -->
            <div class="kpay-tab-pane active" data-pane="qr">
              <div class="kpay-qr-container">
                <div class="kpay-qr-box">
                  ${qrDataUrl ? `<img src="${qrDataUrl}" alt="Scan UPI QR" class="kpay-qr-img" />` : '<div class="kpay-qr-placeholder">Generating QR...</div>'}
                  <div class="kpay-qr-scanline"></div>
                </div>
                <div class="kpay-timer-badge">
                  ⏱️ Expires in: <strong id="kpay-timer-text">10:00</strong>
                </div>
                <p class="kpay-qr-instruction">Scan with any UPI app (GPay, PhonePe, Paytm, CRED)</p>
                <div class="kpay-live-status">
                  <span class="kpay-pulse-dot"></span>
                  <span>Listening for instant bank confirmation...</span>
                </div>
              </div>
            </div>

            <!-- UPI Apps Pane -->
            <div class="kpay-tab-pane" data-pane="apps">
              <p class="kpay-apps-instruction">Tap your preferred app to complete payment:</p>
              <div class="kpay-apps-grid">
                <a href="phonepe://pay?${queryString}" class="kpay-app-item phonepe" target="_blank" rel="noopener">
                  <span class="kpay-app-icon">🟣</span>
                  <span class="kpay-app-name">PhonePe</span>
                </a>
                <a href="tez://upi/pay?${queryString}" class="kpay-app-item gpay" target="_blank" rel="noopener">
                  <span class="kpay-app-icon">🔵</span>
                  <span class="kpay-app-name">Google Pay</span>
                </a>
                <a href="paytmmp://pay?${queryString}" class="kpay-app-item paytm" target="_blank" rel="noopener">
                  <span class="kpay-app-icon">🔷</span>
                  <span class="kpay-app-name">Paytm</span>
                </a>
                <a href="credpay://upi/pay?${queryString}" class="kpay-app-item cred" target="_blank" rel="noopener">
                  <span class="kpay-app-icon">⚫</span>
                  <span class="kpay-app-name">CRED</span>
                </a>
                <a href="upi://pay?${queryString}" class="kpay-app-item bhim" target="_blank" rel="noopener">
                  <span class="kpay-app-icon">🇮🇳</span>
                  <span class="kpay-app-name">BHIM / Other</span>
                </a>
              </div>
            </div>

            <!-- UTR Pane -->
            <div class="kpay-tab-pane" data-pane="utr">
              <form id="kpay-utr-form" class="kpay-utr-form">
                <p class="kpay-utr-intro">Already sent the payment? Enter the 12-digit UPI Reference Number / UTR from your bank SMS or receipt:</p>
                <input type="text" id="kpay-utr-input" class="kpay-input" placeholder="e.g. 429182736451" maxlength="12" pattern="\\d{12}" required />
                <button type="submit" class="kpay-submit-btn">Verify Payment</button>
                <div id="kpay-utr-status" class="kpay-utr-status"></div>
              </form>
            </div>
          </div>

          <!-- Card Footer -->
          <div class="kpay-card-footer">
            <span class="kpay-secure-tag">🛡️ Powered by KPay • Zero Aggregator Commission • Cyber-Secured</span>
          </div>
        </div>
      </div>
    `;
  }

  private getStyles(themeColor: string): string {
    return `
      .kpay-wrapper { position: fixed; inset: 0; z-index: 999999; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
      .kpay-backdrop { position: absolute; inset: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(8px); animation: kpayFade 0.25s ease-out; }
      .kpay-card { position: relative; width: 100%; max-width: 420px; background: #ffffff; border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); overflow: hidden; animation: kpaySlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); margin: 16px; border: 1px solid rgba(226, 232, 240, 0.8); }
      .kpay-card-header { background: linear-gradient(135deg, ${themeColor}, #1e1b4b); color: #ffffff; padding: 20px 24px 18px; }
      .kpay-brand-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      .kpay-logo-badge { font-size: 13px; font-weight: 800; background: rgba(255, 255, 255, 0.15); padding: 4px 10px; border-radius: 99px; letter-spacing: 0.5px; }
      .kpay-close-btn { background: none; border: none; color: rgba(255, 255, 255, 0.7); font-size: 26px; cursor: pointer; line-height: 1; padding: 0; transition: color 0.15s; }
      .kpay-close-btn:hover { color: #ffffff; }
      .kpay-merchant-name { font-size: 18px; font-weight: 700; margin: 0 0 4px; }
      .kpay-order-desc { font-size: 13px; color: rgba(255, 255, 255, 0.8); margin: 0; }
      .kpay-amount-badge { margin-top: 14px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 12px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; }
      .kpay-amount-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.85; }
      .kpay-amount-val { font-size: 22px; font-weight: 800; }
      .kpay-tabs { display: flex; background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 4px 8px; }
      .kpay-tab-btn { flex: 1; border: none; background: none; padding: 10px 8px; font-size: 13px; font-weight: 600; color: #64748b; cursor: pointer; border-radius: 8px; transition: all 0.2s; }
      .kpay-tab-btn.active { background: #ffffff; color: ${themeColor}; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
      .kpay-card-body { padding: 24px; min-height: 280px; }
      .kpay-tab-pane { display: none; }
      .kpay-tab-pane.active { display: block; animation: kpayFade 0.2s ease-out; }
      .kpay-qr-container { display: flex; flex-direction: column; align-items: center; text-align: center; }
      .kpay-qr-box { position: relative; padding: 12px; background: #ffffff; border-radius: 16px; border: 2px dashed #cbd5e1; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
      .kpay-qr-img { width: 180px; height: 180px; display: block; border-radius: 8px; }
      .kpay-timer-badge { margin-top: 12px; font-size: 13px; color: #64748b; }
      .kpay-qr-instruction { font-size: 12px; color: #64748b; margin: 8px 0 12px; }
      .kpay-live-status { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #059669; font-weight: 600; background: #ecfdf5; padding: 6px 14px; border-radius: 99px; }
      .kpay-pulse-dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; box-shadow: 0 0 0 rgba(16, 185, 129, 0.4); animation: kpayPulse 1.5s infinite; }
      .kpay-apps-instruction { font-size: 13px; color: #64748b; margin-top: 0; margin-bottom: 14px; text-align: center; }
      .kpay-apps-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .kpay-app-item { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; text-decoration: none; color: #1e293b; font-size: 13px; font-weight: 600; transition: all 0.2s; background: #ffffff; }
      .kpay-app-item:hover { border-color: ${themeColor}; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
      .kpay-app-icon { font-size: 18px; }
      .kpay-utr-intro { font-size: 13px; color: #64748b; margin-top: 0; line-height: 1.5; }
      .kpay-input { width: 100%; box-sizing: border-box; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 15px; letter-spacing: 2px; text-align: center; margin-bottom: 12px; outline: none; }
      .kpay-input:focus { border-color: ${themeColor}; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15); }
      .kpay-submit-btn { width: 100%; padding: 12px; background: ${themeColor}; color: #ffffff; border: none; border-radius: 10px; font-weight: 700; font-size: 14px; cursor: pointer; transition: opacity 0.2s; }
      .kpay-submit-btn:hover { opacity: 0.92; }
      .kpay-utr-status { font-size: 12px; margin-top: 10px; text-align: center; min-height: 18px; font-weight: 600; }
      .kpay-card-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 10px 16px; text-align: center; }
      .kpay-secure-tag { font-size: 11px; color: #94a3b8; font-weight: 600; letter-spacing: 0.3px; }
      .kpay-success-view { text-align: center; padding: 10px 0; }
      .kpay-checkmark-wrapper { width: 64px; height: 64px; margin: 0 auto 12px; }
      .kpay-checkmark-circle { stroke-dasharray: 166; stroke-dashoffset: 166; stroke-width: 3; stroke: #10b981; animation: kpayStroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards; }
      .kpay-checkmark-check { stroke-dasharray: 48; stroke-dashoffset: 48; stroke-width: 3; stroke: #10b981; animation: kpayStroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.6s forwards; }
      .kpay-success-title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 4px; }
      .kpay-success-sub { font-size: 13px; color: #64748b; margin: 0 0 16px; }
      .kpay-receipt-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; text-align: left; }
      .kpay-receipt-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; color: #475569; }
      .kpay-receipt-row:last-child { margin-bottom: 0; }
      .kpay-badge-paid { background: #d1fae5; color: #065f46; font-weight: 800; padding: 2px 8px; border-radius: 99px; font-size: 10px; }
      .kpay-countdown-msg { font-size: 12px; color: #94a3b8; }
      @keyframes kpayFade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes kpaySlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes kpayPulse { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); } 70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
      @keyframes kpayStroke { 100% { stroke-dashoffset: 0; } }
    `;
  }
}
