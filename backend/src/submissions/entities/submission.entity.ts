import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SubmissionStatus = 'rascunho' | 'enviado';

/**
 * Uma submissão = um levantamento de onboarding completo:
 * - formData: todos os campos do formulário (filas, agentes, horários, configurações, números, BOT)
 * - flowData: o grafo do editor visual (formato de exportação do Drawflow)
 */
@Entity('submissions')
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'Cliente sem nome' })
  clientName: string;

  /** Identificador gerado pelo navegador (localStorage) — isola o "current" de cada
   *  atendente para que sessões simultâneas não sobrescrevam o rascunho umas das outras. */
  @Column({ type: 'varchar', nullable: true })
  sessionId: string | null;

  /** JSON serializado do formulário (mesma estrutura do rascunho do frontend) */
  @Column({ type: 'simple-json', nullable: true })
  formData: Record<string, unknown> | null;

  /** JSON serializado do fluxo visual (export do Drawflow) */
  @Column({ type: 'simple-json', nullable: true })
  flowData: Record<string, unknown> | null;

  @Column({ type: 'varchar', default: 'rascunho' })
  status: SubmissionStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
