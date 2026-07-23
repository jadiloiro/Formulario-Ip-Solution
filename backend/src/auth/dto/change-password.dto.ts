import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  senhaAtual: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  novaSenha: string;
}
