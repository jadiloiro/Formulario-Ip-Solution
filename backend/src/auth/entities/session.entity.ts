import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Sessão de login: o cookie do cliente guarda só o token (opaco, aleatório).
 * Cada request valida esse token aqui — permite revogar acesso na hora
 * (logout, ou a Implantação suspendendo um cliente) sem esperar expirar,
 * ao contrário de um JWT stateless.
 */
@Entity('sessions')
export class Session {
  @PrimaryColumn({ type: 'varchar' })
  token: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', nullable: true })
  ip: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
