import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'node:events';
import { PaymentSSEBroadcaster } from '../src/realtime/sse';

class MockServerResponse extends EventEmitter {
  written: string[] = [];
  writableEnded = false;
  headers: Record<string, string> = {};
  statusCode = 200;

  writeHead(statusCode: number, headers: Record<string, string>) {
    this.statusCode = statusCode;
    this.headers = headers;
    return this;
  }

  write(chunk: string) {
    this.written.push(chunk);
    return true;
  }

  end() {
    this.writableEnded = true;
    this.emit('finish');
    return this;
  }
}

describe('KPay Real-Time SSE Payment Broadcaster', () => {
  it('subscribes client and delivers SSE events without manual polling', () => {
    const broadcaster = new PaymentSSEBroadcaster();
    const mockRes = new MockServerResponse() as any;

    const unsubscribe = broadcaster.subscribe('ORD_SSE_1', mockRes);
    expect(broadcaster.getActiveSubscriberCount('ORD_SSE_1')).toBe(1);
    expect(mockRes.written[0]).toContain('retry: 3000');
    expect(mockRes.written[1]).toContain('"event":"CONNECTED"');

    // Broadcast status update
    broadcaster.publish({
      orderId: 'ORD_SSE_1',
      status: 'SUCCESS',
      amount: 150000,
      timestamp: Date.now(),
    });

    const eventChunk = mockRes.written.find((c: string) => c.includes('payment_status'));
    expect(eventChunk).toBeDefined();

    unsubscribe();
    expect(broadcaster.getActiveSubscriberCount('ORD_SSE_1')).toBe(0);
  });
});
