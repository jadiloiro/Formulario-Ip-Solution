import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type UserRole = 'super_admin' | 'cliente';

/**
 * Conta de acesso ao portal. Clientes não se autocadastram — só a Implantação
 * (role 'super_admin') cria contas, definindo login/senha inicial e quais
 * módulos de onboarding (WhatsApp/Telefonia) o cliente contratou.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  login: string;

  @Column({ type: 'varchar' })
  passwordHash: string;

  /** true até o primeiro login: força a troca da senha gerada pela Implantação. */
  @Column({ type: 'boolean', default: true })
  mustChangePassword: boolean;

  @Column({ type: 'varchar', default: 'cliente' })
  role: UserRole;

  @Column({ type: 'boolean', default: false })
  moduleWhatsapp: boolean;

  @Column({ type: 'boolean', default: false })
  moduleTelefonia: boolean;

  @Column({ type: 'varchar', nullable: true })
  clientName: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
