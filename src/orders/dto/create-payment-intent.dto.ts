import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  amount?: number;

  @IsIn(['PYG', 'USD'])
  @IsOptional()
  currency?: 'PYG' | 'USD';
}
