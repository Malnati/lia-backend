import { canTransitionOrder, isOrderStatus } from '../src/orders/order-status';

describe('order status workflow', () => {
  it('accepts known status values', () => {
    expect(isOrderStatus('paid')).toBe(true);
    expect(isOrderStatus('unknown')).toBe(false);
  });

  it('allows forward transitions and cancellation before terminal states', () => {
    expect(canTransitionOrder('draft', 'paid')).toBe(true);
    expect(canTransitionOrder('paid', 'cancelled')).toBe(true);
  });

  it('blocks transitions after delivery', () => {
    expect(canTransitionOrder('delivered', 'cancelled')).toBe(false);
    expect(canTransitionOrder('delivered', 'ready_for_delivery')).toBe(false);
  });
});
