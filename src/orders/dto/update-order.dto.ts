import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { orderStatuses, type OrderStatus } from '../order-status';
import { paymentStatuses, type PaymentStatus } from '../order.types';

export class UpdateOrderDto {
  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsString()
  @IsOptional()
  deliveryAddress?: string;

  @IsString()
  @IsOptional()
  product?: string;

  @IsIn(orderStatuses)
  @IsOptional()
  status?: OrderStatus;

  @IsIn(paymentStatuses)
  @IsOptional()
  paymentStatus?: PaymentStatus;

  @IsBoolean()
  @IsOptional()
  pendingSync?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}
