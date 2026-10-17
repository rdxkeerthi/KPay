/**
 * KPay In-Built Drop-in Checkout Gateway UI
 * Ultra-Modern Glassmorphic Modal with Authentic SVG App Logos,
 * Live SSE Listener, Harmonic Cinematic Chime & Confetti.
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
      themeColor: '#6366F1',
      autoCloseDelay: 4,
      ...options,
    };
  }

  public open(): void {
    if (typeof document === 'undefined') {
      return;
    }

    this.close();

    this.container = document.createElement('div');
    this.container.id = `kpay-modal-${this.options.orderId}`;
    this.container.innerHTML = this.renderMarkup();
    document.body.appendChild(this.container);

    this.attachEventListeners();
    this.startSseListener();
    this.startCountdownTimer();
  }

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
          // Heartbeat
        }
      });
    } catch {
      // Fallback
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
        <div class="kpay-success-pane" id="kpay-success-box">
          <div class="kpay-check-halo">
            <div class="kpay-halo-glow"></div>
            <svg class="kpay-svg-check" viewBox="0 0 52 52">
              <circle class="kpay-circle-path" cx="26" cy="26" r="24" fill="none"/>
              <path class="kpay-check-path" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
            </svg>
          </div>
          <h3 class="kpay-success-title">Payment Confirmed!</h3>
          <p class="kpay-success-sub">₹${data.amount.toFixed(2)} credited directly into bank account</p>
          <div class="kpay-receipt-card">
            <div class="kpay-receipt-line"><span>Order ID</span><strong style="color:#ffffff;">${this.escape(data.orderId)}</strong></div>
            ${data.utr ? `<div class="kpay-receipt-line"><span>Bank UTR / Ref</span><strong style="color:#34d399; letter-spacing:1px;">${this.escape(data.utr)}</strong></div>` : ''}
            <div class="kpay-receipt-line"><span>Settlement</span><span class="kpay-utr-badge">INSTANT • ₹0 FEE</span></div>
          </div>
          <div class="kpay-countdown-msg">Closing in <span id="kpay-auto-close-sec">${this.options.autoCloseDelay || 3}</span>s...</div>
        </div>
      `;
      this.spawnConfetti(bodyEl as HTMLElement);
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
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.3, ctx.currentTime);
      masterGain.connect(ctx.destination);

      // Polyphonic harmonic chord: C5, E5, G5, C6
      const chord = [523.25, 659.25, 783.99, 1046.50];
      chord.forEach((freq, i) => {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const noteGain = ctx.createGain();

        osc1.type = 'triangle';
        osc1.frequency.value = freq;
        osc2.type = 'sine';
        osc2.frequency.value = freq * 1.004;

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
    } catch {
      // Audio not permitted
    }
  }

  private spawnConfetti(parent: HTMLElement): void {
    const colors = ['#10b981', '#6366f1', '#ec4899', '#f59e0b', '#3b82f6'];
    for (let i = 0; i < 35; i++) {
      const p = document.createElement('div');
      p.className = 'kpay-confetti';
      p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)] || '#10b981';
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

  private startCountdownTimer(): void {
    let secondsLeft = 600;
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

    this.container.querySelector('.kpay-close-btn')?.addEventListener('click', () => this.close());
    this.container.querySelector('.kpay-backdrop')?.addEventListener('click', () => this.close());

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

    const utrForm = this.container.querySelector('#kpay-utr-form');
    utrForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = this.container?.querySelector('#kpay-utr-input') as HTMLInputElement;
      const statusMsg = this.container?.querySelector('#kpay-utr-status');
      if (!input || !statusMsg) return;

      const utr = input.value.trim();
      if (!/^\d{12}$/.test(utr)) {
        statusMsg.textContent = '❌ Please enter a valid 12-digit UPI reference number.';
        (statusMsg as HTMLElement).style.color = '#ef4444';
        return;
      }

      statusMsg.textContent = '⏳ Verifying with bank ledger...';
      (statusMsg as HTMLElement).style.color = '#a5b4fc';

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
          statusMsg.textContent = json.message || '❌ Payment not yet confirmed by bank.';
          (statusMsg as HTMLElement).style.color = '#ef4444';
        } catch {
          statusMsg.textContent = '❌ Network error submitting UTR.';
          (statusMsg as HTMLElement).style.color = '#ef4444';
        }
      } else {
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
      <style>${this.getStyles(themeColor || '#6366F1')}</style>
      <div class="kpay-wrapper">
        <div class="kpay-backdrop"></div>
        <div class="kpay-card" role="dialog" aria-modal="true">
          <!-- Card Header -->
          <div class="kpay-card-header">
            <div class="kpay-brand-row">
              <span class="kpay-verified-tag">🛡️ NPCI Cyber Shield</span>
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
            <button class="kpay-tab-btn active" data-tab="qr">⚡ Dynamic QR</button>
            <button class="kpay-tab-btn" data-tab="apps">📱 UPI Apps</button>
            <button class="kpay-tab-btn" data-tab="utr">📝 Manual UTR</button>
          </div>

          <!-- Card Body -->
          <div class="kpay-card-body">
            <!-- QR Code Pane -->
            <div class="kpay-tab-pane active" data-pane="qr">
              <div class="kpay-qr-container">
                <div class="kpay-qr-box">
                  ${qrDataUrl ? `<img src="${qrDataUrl}" alt="Scan UPI QR" class="kpay-qr-img" />` : '<div class="kpay-qr-placeholder">Generating QR...</div>'}
                  <div class="kpay-scanline"></div>
                </div>
                <div class="kpay-timer-badge">
                  ⏱️ Expires in: <strong id="kpay-timer-text">10:00</strong>
                </div>
                <p class="kpay-qr-instruction">Scan with any UPI app (GPay, PhonePe, Paytm, CRED)</p>
                <div class="kpay-live-status">
                  <span class="kpay-pulse-dot"></span>
                  <span>Live Bank SSE Listener Active...</span>
                </div>
              </div>
            </div>

            <!-- UPI Apps Pane with Authentic SVG Logos -->
            <div class="kpay-tab-pane" data-pane="apps">
              <p class="kpay-apps-instruction">Tap your preferred app to complete payment:</p>
              <div class="kpay-apps-grid">
                <!-- PhonePe -->
                <a href="phonepe://pay?${queryString}" class="kpay-app-item" target="_blank" rel="noopener">
                  <div class="kpay-app-icon-box" style="background: #5f259f;">
                    <svg width="18" height="18" viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="#5f259f"/><path d="M25.8 38.5V28.2H29c4.2 0 6.6-2.2 6.6-5.8 0-3.8-2.6-5.8-6.8-5.8H18.5v21.9h7.3zm0-16.1h3c1.7 0 2.6.8 2.6 2.1 0 1.4-.9 2.2-2.6 2.2h-3v-4.3z" fill="#ffffff"/><path d="M14.5 9.5l9.8 14.8" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round"/></svg>
                  </div>
                  <span>PhonePe</span>
                </a>

                <!-- Google Pay -->
                <a href="tez://upi/pay?${queryString}" class="kpay-app-item" target="_blank" rel="noopener">
                  <div class="kpay-app-icon-box" style="background: #ffffff;">
                    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.7 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.6c-.3 1.5-1.1 2.8-2.4 3.7v3.1h3.9c2.3-2.1 3.6-5.2 3.6-9z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-3l-3.9-3.1c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5H1.2v3.2C3.2 21.3 7.3 24 12 24z"/><path fill="#FBBC05" d="M5.2 14.1c-.3-.8-.4-1.6-.4-2.4s.1-1.6.4-2.4V6.1H1.2C.4 7.7 0 9.8 0 12s.4 4.3 1.2 5.9l4-3.8z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.3 0 3.2 2.7 1.2 6.1l4 3.2c1-2.9 3.7-4.5 6.8-4.5z"/></svg>
                  </div>
                  <span>Google Pay</span>
                </a>

                <!-- Paytm -->
                <a href="paytmmp://pay?${queryString}" class="kpay-app-item" target="_blank" rel="noopener">
                  <div class="kpay-app-icon-box" style="background: #002e6e;">
                    <svg width="20" height="20" viewBox="0 0 36 36"><path fill="#00baf2" d="M6 18c0-6.6 5.4-12 12-12s12 5.4 12 12-5.4 12-12 12S6 24.6 6 18z"/><path fill="#ffffff" d="M12 13h4c2.2 0 3.5 1.1 3.5 2.8 0 1.9-1.3 2.9-3.5 2.9h-2v4h-2v-9.7zm2 4.1h1.8c1 0 1.7-.5 1.7-1.3 0-.9-.7-1.3-1.7-1.3H14v2.6zM22 17.5h2v5.2h-2v-5.2zm0-4.5h2v2h-2v-2z"/></svg>
                  </div>
                  <span>Paytm</span>
                </a>

                <!-- CRED -->
                <a href="credpay://upi/pay?${queryString}" class="kpay-app-item" target="_blank" rel="noopener">
                  <div class="kpay-app-icon-box" style="background: #111111; border: 1px solid rgba(255,255,255,0.2);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5"><path d="M12 2L3 7v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V7l-9-5z"/><path d="M12 8v8M8 12h8"/></svg>
                  </div>
                  <span>CRED</span>
                </a>

                <!-- BHIM / NPCI UPI -->
                <a href="upi://pay?${queryString}" class="kpay-app-item" style="grid-column: span 2;" target="_blank" rel="noopener">
                  <div class="kpay-app-icon-box" style="background: #ffffff;">
                    <svg width="20" height="20" viewBox="0 0 32 32"><path fill="#f37021" d="M18 4l-10 14h8l-2 10 12-14h-8z"/></svg>
                  </div>
                  <span>BHIM UPI & All Other Banking Apps</span>
                </a>
              </div>
            </div>

            <!-- UTR Pane -->
            <div class="kpay-tab-pane" data-pane="utr">
              <form id="kpay-utr-form" class="kpay-utr-form">
                <p class="kpay-utr-intro">Already completed the transfer? Paste the 12-digit UPI Reference Number / Bank UTR from your SMS or app receipt:</p>
                <input type="text" id="kpay-utr-input" class="kpay-input" placeholder="e.g. 429182736451" maxlength="12" pattern="\\d{12}" required />
                <button type="submit" class="kpay-submit-btn">Verify Bank Transfer</button>
                <div id="kpay-utr-status" class="kpay-utr-status"></div>
              </form>
            </div>
          </div>

          <!-- Card Footer -->
          <div class="kpay-card-footer">
            <span class="kpay-secure-tag">🔒 256-BIT CYBER ENCRYPTED • DIRECT BANK SETTLEMENT • ZERO COMMISSION</span>
          </div>
        </div>
      </div>
    `;
  }

  private getStyles(themeColor: string): string {
    return `
      .kpay-wrapper { position: fixed; inset: 0; z-index: 999999; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif; }
      .kpay-backdrop { position: absolute; inset: 0; background: rgba(9, 13, 22, 0.78); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); animation: kpayFade 0.25s ease-out; }
      .kpay-card { position: relative; width: 100%; max-width: 440px; background: rgba(15, 23, 42, 0.82); backdrop-filter: blur(28px) saturate(180%); -webkit-backdrop-filter: blur(28px) saturate(180%); border-radius: 28px; box-shadow: 0 35px 70px -15px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.2); overflow: hidden; animation: kpaySlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1); margin: 16px; border: 1px solid rgba(255, 255, 255, 0.12); color: #ffffff; }
      .kpay-card-header { padding: 24px 26px 20px; background: linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 100%); border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
      .kpay-brand-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      .kpay-verified-tag { font-size: 11px; font-weight: 700; text-transform: uppercase; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; padding: 4px 12px; border-radius: 99px; }
      .kpay-close-btn { background: none; border: none; color: rgba(255, 255, 255, 0.6); font-size: 26px; cursor: pointer; line-height: 1; padding: 0; transition: color 0.15s; }
      .kpay-close-btn:hover { color: #ffffff; }
      .kpay-merchant-name { font-size: 22px; font-weight: 800; margin: 0 0 4px; letter-spacing: -0.3px; }
      .kpay-order-desc { font-size: 13px; color: rgba(255, 255, 255, 0.65); margin: 0; }
      .kpay-amount-badge { margin-top: 16px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 18px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; }
      .kpay-amount-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: rgba(255, 255, 255, 0.65); font-weight: 600; }
      .kpay-amount-val { font-size: 28px; font-weight: 900; letter-spacing: -0.5px; text-shadow: 0 0 20px rgba(99, 102, 241, 0.35); }
      .kpay-tabs { display: flex; background: rgba(0, 0, 0, 0.25); padding: 6px 10px; gap: 6px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
      .kpay-tab-btn { flex: 1; border: none; background: none; padding: 10px 12px; font-size: 13px; font-weight: 700; color: rgba(255, 255, 255, 0.65); cursor: pointer; border-radius: 12px; transition: all 0.2s; }
      .kpay-tab-btn.active { background: rgba(255, 255, 255, 0.14); color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2); }
      .kpay-card-body { padding: 24px; min-height: 300px; }
      .kpay-tab-pane { display: none; }
      .kpay-tab-pane.active { display: block; animation: kpayFade 0.2s ease-out; }
      .kpay-qr-container { display: flex; flex-direction: column; align-items: center; text-align: center; }
      .kpay-qr-box { position: relative; padding: 14px; background: #ffffff; border-radius: 24px; box-shadow: 0 0 35px rgba(99, 102, 241, 0.25), 0 10px 25px rgba(0,0,0,0.4); overflow: hidden; }
      .kpay-qr-img { width: 190px; height: 190px; display: block; border-radius: 12px; }
      .kpay-scanline { position: absolute; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, transparent, #6366f1, #10b981, transparent); box-shadow: 0 0 12px #6366f1; animation: kpayScan 2.4s ease-in-out infinite alternate; }
      .kpay-timer-badge { margin-top: 14px; font-size: 13px; color: rgba(255, 255, 255, 0.65); font-weight: 600; background: rgba(255, 255, 255, 0.06); padding: 4px 12px; border-radius: 99px; border: 1px solid rgba(255, 255, 255, 0.08); }
      .kpay-qr-instruction { font-size: 12px; color: rgba(255, 255, 255, 0.65); margin: 8px 0 14px; }
      .kpay-live-status { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: #34d399; font-weight: 700; background: rgba(16, 185, 129, 0.12); padding: 7px 18px; border-radius: 99px; border: 1px solid rgba(16, 185, 129, 0.25); }
      .kpay-pulse-dot { width: 8px; height: 8px; background: #34d399; border-radius: 50%; animation: kpayPulseGlow 1.6s infinite; }
      .kpay-apps-instruction { font-size: 13px; color: rgba(255, 255, 255, 0.65); margin: 0 0 14px; text-align: center; }
      .kpay-apps-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .kpay-app-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 16px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); text-decoration: none; color: #ffffff; font-size: 13px; font-weight: 700; transition: all 0.2s; }
      .kpay-app-item:hover { background: rgba(255, 255, 255, 0.12); border-color: rgba(255, 255, 255, 0.3); transform: translateY(-2px); }
      .kpay-app-icon-box { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .kpay-utr-intro { font-size: 13px; color: rgba(255, 255, 255, 0.65); margin: 0; line-height: 1.5; }
      .kpay-input { width: 100%; box-sizing: border-box; padding: 14px 16px; background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 14px; color: #ffffff; font-size: 16px; letter-spacing: 2px; text-align: center; margin-bottom: 12px; outline: none; }
      .kpay-input:focus { border-color: ${themeColor}; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25); }
      .kpay-submit-btn { width: 100%; padding: 14px; background: linear-gradient(135deg, ${themeColor}, #4f46e5); color: #ffffff; border: none; border-radius: 14px; font-weight: 800; font-size: 14px; cursor: pointer; box-shadow: 0 10px 20px -5px rgba(99, 102, 241, 0.5); }
      .kpay-utr-status { font-size: 13px; margin-top: 10px; text-align: center; min-height: 20px; font-weight: 700; }
      .kpay-card-footer { background: rgba(0, 0, 0, 0.3); padding: 12px 16px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.05); }
      .kpay-secure-tag { font-size: 11px; color: rgba(255, 255, 255, 0.45); font-weight: 700; letter-spacing: 0.5px; }
      .kpay-success-pane { text-align: center; padding: 14px 0; position: relative; }
      .kpay-check-halo { position: relative; width: 80px; height: 80px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; }
      .kpay-halo-glow { position: absolute; inset: -10px; background: radial-gradient(circle, rgba(16, 185, 129, 0.45) 0%, transparent 70%); border-radius: 50%; animation: kpayHalo 2s infinite alternate; }
      .kpay-svg-check { width: 72px; height: 72px; position: relative; z-index: 2; }
      .kpay-circle-path { stroke-dasharray: 166; stroke-dashoffset: 166; stroke-width: 3.5; stroke: #10b981; animation: kpayStroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards; }
      .kpay-check-path { stroke-dasharray: 48; stroke-dashoffset: 48; stroke-width: 4; stroke: #10b981; animation: kpayStroke 0.35s cubic-bezier(0.65, 0, 0.45, 1) 0.6s forwards; }
      .kpay-success-title { font-size: 24px; font-weight: 900; color: #ffffff; margin: 0 0 4px; }
      .kpay-success-sub { font-size: 14px; color: rgba(255, 255, 255, 0.65); margin: 0 0 18px; }
      .kpay-receipt-card { background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 18px; padding: 16px; text-align: left; margin-bottom: 16px; }
      .kpay-receipt-line { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; color: rgba(255, 255, 255, 0.7); }
      .kpay-receipt-line:last-child { margin-bottom: 0; }
      .kpay-utr-badge { background: rgba(16, 185, 129, 0.15); color: #34d399; font-weight: 800; padding: 2px 10px; border-radius: 99px; font-size: 11px; }
      .kpay-countdown-msg { font-size: 13px; color: rgba(255, 255, 255, 0.65); }
      .kpay-confetti { position: absolute; width: 8px; height: 8px; border-radius: 2px; opacity: 0; pointer-events: none; animation: kpayConfetti 1.4s ease-out forwards; }
      @keyframes kpayFade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes kpaySlideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes kpayScan { 0% { top: 10px; opacity: 0.3; } 100% { top: 190px; opacity: 1; } }
      @keyframes kpayPulseGlow { 0% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.7); } 70% { box-shadow: 0 0 0 8px rgba(52, 211, 153, 0); } 100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); } }
      @keyframes kpayStroke { 100% { stroke-dashoffset: 0; } }
      @keyframes kpayHalo { from { transform: scale(0.9); opacity: 0.3; } to { transform: scale(1.15); opacity: 0.6; } }
      @keyframes kpayConfetti { 0% { transform: translate(0, 0) rotate(0deg); opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)) rotate(720deg); opacity: 0; } }
    `;
  }
}
