import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { orderStatuses, type OrderStatus } from '../order-status';

export type OrderDocument = HydratedDocument<Order>;

@Schema({ _id: false })
export class OrderCheckpoint {
  @Prop({ required: true })
  key: string;

  @Prop({ required: true })
  label: string;

  @Prop({ default: false })
  completed: boolean;

  @Prop()
  actor?: string;

  @Prop()
  timestamp?: Date;

  @Prop()
  notes?: string;
}

@Schema({ timestamps: true })
export class Order {
  @Prop({ trim: true, index: true })
  clientId?: string;

  @Prop({ required: true, trim: true })
  customerName: string;

  @Prop({ required: true, trim: true })
  customerPhone: string;

  @Prop({ required: true, trim: true })
  deliveryAddress: string;

  @Prop({ required: true, default: 'Molde prótese' })
  product: string;

  @Prop({ enum: orderStatuses, default: 'draft' })
  status: OrderStatus;

  @Prop({ enum: ['pending', 'paid', 'failed', 'mock_pending'], default: 'pending' })
  paymentStatus: 'pending' | 'paid' | 'failed' | 'mock_pending';

  @Prop({ default: false })
  pendingSync: boolean;

  @Prop({ type: [OrderCheckpoint], default: [] })
  checkpoints: OrderCheckpoint[];

  @Prop({ default: '' })
  notes: string;

  @Prop({ default: 1 })
  version: number;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
