export const orderStatuses = [
  'draft',
  'awaiting_payment',
  'paid',
  'pickup_scheduled',
  'picked_up',
  'in_model_production',
  'model_ready',
  'in_prosthesis_production',
  'prosthesis_ready',
  'ready_for_delivery',
  'delivery_scheduled',
  'delivered',
  'cancelled'
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

const terminalStatuses: OrderStatus[] = ['delivered', 'cancelled'];

export function isOrderStatus(value: string): value is OrderStatus {
  return orderStatuses.includes(value as OrderStatus);
}

export function canTransitionOrder(current: OrderStatus, next: OrderStatus): boolean {
  if (current === next) return true;
  if (terminalStatuses.includes(current)) return false;
  if (next === 'cancelled') return true;
  return orderStatuses.indexOf(next) > orderStatuses.indexOf(current);
}
