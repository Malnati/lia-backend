import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateAccessProfileDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsArray()
  @IsOptional()
  permissions?: string[];

  @IsBoolean()
  @IsOptional()
  isSystem?: boolean;
}
