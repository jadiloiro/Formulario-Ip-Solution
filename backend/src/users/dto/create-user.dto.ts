import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  login: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  senha: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientName?: string;

  @IsOptional()
  @IsIn(['super_admin', 'cliente'])
  role?: 'super_admin' | 'cliente';

  @IsOptional()
  @IsBoolean()
  moduleWhatsapp?: boolean;

  @IsOptional()
  @IsBoolean()
  moduleTelefonia?: boolean;
}
