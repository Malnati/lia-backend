import type { OrderStatus } from './order-status';

export const paymentStatuses = ['pending', 'authorized', 'paid', 'failed', 'cancelled'] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export type OrderCheckpoint = {
  id?: string;
  orderId?: string;
  key: string;
  label: string;
  completed: boolean;
  actor?: string;
  timestamp?: Date | string;
  notes?: string;
};

export type Order = {
  id?: string;
  tenantId?: string;
  clientId?: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  product: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  pendingSync: boolean;
  checkpoints: OrderCheckpoint[];
  notes: string;
  version: number;
  createdAt?: string;
  updatedAt?: string;
};
