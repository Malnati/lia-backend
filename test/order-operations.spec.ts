import {
  applyCheckpointUpdate,
  applyOrderUpdate,
  isAllowedAttachmentMime,
  maxAttachmentSizeBytes
} from '../src/orders/order-operations';
import type { Order } from '../src/orders/schemas/order.schema';
import { MockPaymentProvider } from '../src/orders/payment/mock-payment.provider';

function makeOrder(): Order {
  return {
    customerName: 'Cliente',
    customerPhone: '+595 981 000000',
    deliveryAddress: 'Asunción',
    product: 'Molde prótese',
    status: 'draft',
    paymentStatus: 'pending',
    pendingSync: false,
    checkpoints: [
      { key: 'pickup_checkin', label: 'Retirada check-in', completed: false },
      { key: 'pickup_checkout', label: 'Retirada check-out', completed: false }
    ],
    notes: '',
    version: 1
  } as Order;
}

describe('order operations', () => {
  it('increments version when an order is updated', () => {
    const order = makeOrder();

    applyOrderUpdate(order, { customerName: 'Cliente atualizado', notes: 'Nova observação' });

    expect(order.customerName).toBe('Cliente atualizado');
    expect(order.notes).toBe('Nova observação');
    expect(order.version).toBe(2);
  });

  it('updates a valid checkpoint and increments version', () => {
    const order = makeOrder();

    applyCheckpointUpdate(order, 'pickup_checkin', {
      completed: true,
      actor: 'Técnico',
      notes: 'Chegou ao local'
    });

    expect(order.checkpoints[0]).toMatchObject({
      key: 'pickup_checkin',
      completed: true,
      actor: 'Técnico',
      notes: 'Chegou ao local'
    });
    expect(order.version).toBe(2);
  });

  it('rejects unsupported attachment types and exposes max upload size', () => {
    expect(isAllowedAttachmentMime('image/webp')).toBe(true);
    expect(isAllowedAttachmentMime('image/png')).toBe(true);
    expect(isAllowedAttachmentMime('application/pdf')).toBe(false);
    expect(maxAttachmentSizeBytes).toBe(5 * 1024 * 1024);
  });

  it('creates a mock payment intent without requiring a real provider', async () => {
    const provider = new MockPaymentProvider();

    const intent = await provider.createIntent({ orderId: 'order-1', amount: 0, currency: 'PYG' });

    expect(intent).toMatchObject({
      provider: 'mock',
      status: 'mock_pending',
      orderId: 'order-1'
    });
  });
});
