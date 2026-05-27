import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { orderStatuses, type OrderStatus } from '../order-status';

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

  @IsIn(['pending', 'paid', 'failed', 'mock_pending'])
  @IsOptional()
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'mock_pending';

  @IsBoolean()
  @IsOptional()
  pendingSync?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}
