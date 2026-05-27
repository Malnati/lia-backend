import { IsArray, IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { orderStatuses, type OrderStatus } from '../order-status';

export class CreateOrderDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  clientId?: string;

  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @IsString()
  @IsNotEmpty()
  customerPhone!: string;

  @IsString()
  @IsNotEmpty()
  deliveryAddress!: string;

  @IsString()
  @IsOptional()
  product?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsIn(orderStatuses)
  @IsOptional()
  status?: OrderStatus;

  @IsIn(['pending', 'paid', 'failed', 'mock_pending'])
  @IsOptional()
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'mock_pending';

  @IsBoolean()
  @IsOptional()
  pendingSync?: boolean;

  @IsArray()
  @IsOptional()
  checkpoints?: unknown[];

  @IsNumber()
  @IsOptional()
  version?: number;
}
