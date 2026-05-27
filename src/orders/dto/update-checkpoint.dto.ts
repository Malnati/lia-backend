import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsOptional, IsString } from 'class-validator';

export class UpdateCheckpointDto {
  @IsBoolean()
  @IsOptional()
  completed?: boolean;

  @IsString()
  @IsOptional()
  actor?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  timestamp?: Date;

  @IsString()
  @IsOptional()
  notes?: string;
}
