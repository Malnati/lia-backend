import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAccessProfileDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  role!: string;

  @IsArray()
  permissions!: string[];

  @IsBoolean()
  @IsOptional()
  isSystem?: boolean;
}
