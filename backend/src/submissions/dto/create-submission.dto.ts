import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSubmissionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientName?: string;

  /** Estrutura livre do formulário (validada em profundidade pelo frontend) */
  @IsOptional()
  @IsObject()
  formData?: Record<string, unknown>;

  /** Export do Drawflow */
  @IsOptional()
  @IsObject()
  flowData?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['rascunho', 'enviado'])
  status?: 'rascunho' | 'enviado';
}
