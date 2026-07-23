import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Um arquivo anexado pelo cliente a um levantamento (ex.: comprovante, print,
 * CSV de contatos). O conteúdo fica em disco (uploads/<submissionId>/<storedName>);
 * esta linha só guarda os metadados — nunca o binário.
 */
@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  submissionId: string;

  /** Etapa do formulário (1-7) em que o arquivo foi anexado, quando aplicável. */
  @Column({ type: 'int', nullable: true })
  stepNumber: number | null;

  @Column({ type: 'varchar' })
  originalName: string;

  /** Nome do arquivo em disco — sempre gerado (uuid + extensão), nunca o nome original. */
  @Column({ type: 'varchar' })
  storedName: string;

  @Column({ type: 'varchar' })
  mimeType: string;

  @Column({ type: 'int' })
  size: number;

  @CreateDateColumn()
  createdAt: Date;
}
