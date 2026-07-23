import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Edição de um cliente já existente — tudo opcional (PATCH parcial).
 *  `novaSenha`, quando informada, força troca de senha no próximo login
 *  (mesma regra do provisionamento inicial). */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  login?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientName?: string;

  @IsOptional()
  @IsBoolean()
  moduleWhatsapp?: boolean;

  @IsOptional()
  @IsBoolean()
  moduleTelefonia?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  novaSenha?: string;
}
