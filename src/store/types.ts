// ============================================================================
// KPay Store — Pluggable State Ledger & Idempotency Lock Contract
// ============================================================================

import type { PaymentStatus, Provider } from '../types.js';

export interface OrderRecord {
  orderId: string;
  amount: number; // in paise
  status: PaymentStatus;
  provider: Provider;
  customerPhone?: string;
  transactionId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface IKPayStore {
  saveOrder(order: OrderRecord): Promise<void>;
  getOrder(orderId: string): Promise<OrderRecord | null>;
  updateStatus(orderId: string, status: PaymentStatus, metadata?: Record<string, unknown>): Promise<void>;
  acquireLock(orderId: string, ttlMs?: number): Promise<boolean>;
  releaseLock(orderId: string): Promise<void>;
  findPendingByAmount?(amountPaise: number, maxAgeMs?: number): Promise<OrderRecord | null>;
}
