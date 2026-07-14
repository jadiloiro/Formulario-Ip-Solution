import { IsObject } from 'class-validator';

export class UpdateFlowDto {
  /** Grafo completo no formato de exportação do Drawflow */
  @IsObject()
  flowData: Record<string, unknown>;
}
