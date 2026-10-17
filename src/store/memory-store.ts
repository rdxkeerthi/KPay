// ============================================================================
// KPay Store — Memory Store with TTL Idempotency Locks
// ============================================================================

import type { IKPayStore, OrderRecord } from './types.js';
import type { PaymentStatus } from '../types.js';

export class MemoryStore implements IKPayStore {
  private readonly orders = new Map<string, OrderRecord>();
  private readonly locks = new Map<string, number>(); // orderId -> expiry timestamp

  async saveOrder(order: OrderRecord): Promise<void> {
    this.orders.set(order.orderId, { ...order });
  }

  async getOrder(orderId: string): Promise<OrderRecord | null> {
    const record = this.orders.get(orderId);
    return record ? { ...record } : null;
  }

  async updateStatus(orderId: string, status: PaymentStatus, metadata?: Record<string, unknown>): Promise<void> {
    const existing = this.orders.get(orderId);
    if (existing) {
      existing.status = status;
      existing.updatedAt = Date.now();
      if (metadata) {
        existing.metadata = { ...existing.metadata, ...metadata };
      }
    }
  }

  async acquireLock(orderId: string, ttlMs = 10000): Promise<boolean> {
    const now = Date.now();
    const existingLock = this.locks.get(orderId);

    if (existingLock && existingLock > now) {
      return false; // Lock already held
    }

    this.locks.set(orderId, now + ttlMs);
    return true;
  }

  async releaseLock(orderId: string): Promise<void> {
    this.locks.delete(orderId);
  }

  clear(): void {
    this.orders.clear();
    this.locks.clear();
  }
}
