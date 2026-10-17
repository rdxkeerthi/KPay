/**
 * KPay In-Built Checkout Gateway UI — Types & Interfaces
 * Author: rdxkeerthi
 */

export interface CheckoutSuccessData {
  orderId: string;
  status: 'SUCCESS';
  utr?: string;
  amount: number;
  currency: string;
  timestamp: number;
  rawResponse?: Record<string, unknown>;
}

export interface CheckoutModalOptions {
  orderId: string;
  amount: number;
  currency?: string;
  payeeName?: string;
  description?: string;
  vpa?: string;
  qrDataUrl?: string;
  upiUri?: string;
  themeColor?: string;
  sseEndpoint?: string;
  statusCheckEndpoint?: string;
  utrSubmitEndpoint?: string;
  autoCloseDelay?: number;
  onSuccess?: (data: CheckoutSuccessData) => void;
  onDismiss?: () => void;
  onError?: (err: Error) => void;
}

export interface CheckoutHtmlOptions extends CheckoutModalOptions {
  pageTitle?: string;
  merchantLogo?: string;
  returnUrl?: string;
}
