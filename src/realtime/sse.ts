// ============================================================================
// KPay Real-Time — Server-Sent Events (SSE) Payment Status Broadcaster
// ============================================================================

import { EventEmitter } from 'node:events';
import type { ServerResponse } from 'node:http';
import type { PaymentStatus } from '../types.js';

export interface PaymentStatusEvent {
  orderId: string;
  status: PaymentStatus;
  amount?: number;
  transactionId?: string;
  timestamp: number;
}

export class PaymentSSEBroadcaster {
  private readonly emitter = new EventEmitter();
  private readonly subscribers = new Map<string, Set<ServerResponse>>();

  constructor() {
    this.emitter.setMaxListeners(1000);
  }

  /**
   * Attaches an HTTP response object as an SSE subscriber for a specific orderId.
   */
  subscribe(orderId: string, res: ServerResponse, options?: { timeoutMs?: number }): () => void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    res.write(`retry: 3000\n\n`);
    res.write(`data: ${JSON.stringify({ event: 'CONNECTED', orderId })}\n\n`);

    if (!this.subscribers.has(orderId)) {
      this.subscribers.set(orderId, new Set());
    }

    const set = this.subscribers.get(orderId)!;
    set.add(res);

    // Keep-alive heartbeat every 15s to keep proxy connections alive
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': keep-alive\n\n');
      }
    }, 15000);

    const cleanup = () => {
      clearInterval(heartbeat);
      set.delete(res);
      if (set.size === 0) {
        this.subscribers.delete(orderId);
      }
      if (!res.writableEnded) {
        res.end();
      }
    };

    res.on('close', cleanup);
    res.on('finish', cleanup);

    // Optional overall connection timeout
    if (options?.timeoutMs) {
      setTimeout(() => {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ event: 'TIMEOUT', orderId })}\n\n`);
          cleanup();
        }
      }, options.timeoutMs);
    }

    return cleanup;
  }

  /**
   * Publishes payment status event to all clients listening on this orderId.
   */
  publish(event: PaymentStatusEvent): void {
    const set = this.subscribers.get(event.orderId);
    if (!set || set.size === 0) return;

    const data = JSON.stringify(event);
    for (const res of set) {
      if (!res.writableEnded) {
        res.write(`event: payment_status\n`);
        res.write(`data: ${data}\n\n`);

        // If terminal state, close connection gracefully after delivering event
        if (event.status === 'SUCCESS' || event.status === 'FAILED' || event.status === 'EXPIRED') {
          setTimeout(() => {
            if (!res.writableEnded) {
              res.end();
            }
          }, 500);
        }
      }
    }
  }

  getActiveSubscriberCount(orderId: string): number {
    return this.subscribers.get(orderId)?.size ?? 0;
  }
}

export const globalSSEBroadcaster = new PaymentSSEBroadcaster();
