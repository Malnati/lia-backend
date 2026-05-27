import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Order, OrderCheckpoint } from './schemas/order.schema';

export const checkpointKeys = [
  'pickup_checkin',
  'pickup_checkout',
  'delivery_checkin',
  'delivery_checkout'
] as const;

export type CheckpointKey = (typeof checkpointKeys)[number];

export const maxAttachmentSizeBytes = 5 * 1024 * 1024;

const allowedAttachmentMimeTypes = new Set(['image/webp', 'image/jpeg', 'image/png']);

export function isAllowedAttachmentMime(contentType: string): boolean {
  return allowedAttachmentMimeTypes.has(contentType);
}

export function bumpVersion(order: Pick<Order, 'version'>): void {
  order.version = (order.version ?? 0) + 1;
}

export type OrderPatch = Partial<
  Pick<
    Order,
    | 'customerName'
    | 'customerPhone'
    | 'deliveryAddress'
    | 'product'
    | 'status'
    | 'paymentStatus'
    | 'pendingSync'
    | 'notes'
  >
>;

export function applyOrderUpdate(order: Order, patch: OrderPatch): Order {
  const fields: Array<keyof OrderPatch> = [
    'customerName',
    'customerPhone',
    'deliveryAddress',
    'product',
    'status',
    'paymentStatus',
    'pendingSync',
    'notes'
  ];

  for (const field of fields) {
    const value = patch[field];
    if (value !== undefined) {
      (order[field] as never) = value as never;
    }
  }

  bumpVersion(order);
  return order;
}

export type CheckpointPatch = Partial<Pick<OrderCheckpoint, 'completed' | 'actor' | 'timestamp' | 'notes'>>;

export function applyCheckpointUpdate(order: Order, checkpointKey: string, patch: CheckpointPatch): Order {
  if (!checkpointKeys.includes(checkpointKey as CheckpointKey)) {
    throw new BadRequestException(`Unsupported checkpoint ${checkpointKey}`);
  }

  const checkpoint = order.checkpoints.find((item) => item.key === checkpointKey);
  if (!checkpoint) {
    throw new NotFoundException(`Checkpoint ${checkpointKey} not found`);
  }

  if (patch.completed !== undefined) checkpoint.completed = patch.completed;
  if (patch.actor !== undefined) checkpoint.actor = patch.actor;
  if (patch.timestamp !== undefined) checkpoint.timestamp = patch.timestamp;
  if (patch.notes !== undefined) checkpoint.notes = patch.notes;

  bumpVersion(order);
  return order;
}

export function createDefaultCheckpoints(): OrderCheckpoint[] {
  return [
    { key: 'pickup_checkin', label: 'Retirada check-in', completed: false },
    { key: 'pickup_checkout', label: 'Retirada check-out', completed: false },
    { key: 'delivery_checkin', label: 'Entrega check-in', completed: false },
    { key: 'delivery_checkout', label: 'Entrega check-out', completed: false }
  ];
}
