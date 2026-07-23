import { MigrationInterface, QueryRunner, Table } from 'typeorm';
import * as argon2 from 'argon2';

export class CreateUsers1784814225270 implements MigrationInterface {
  name = 'CreateUsers1784814225270';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
          { name: 'login', type: 'varchar', isUnique: true },
          { name: 'passwordHash', type: 'varchar' },
          { name: 'mustChangePassword', type: 'boolean', default: true },
          { name: 'role', type: 'varchar', default: `'cliente'` },
          { name: 'moduleWhatsapp', type: 'boolean', default: false },
          { name: 'moduleTelefonia', type: 'boolean', default: false },
          { name: 'clientName', type: 'varchar', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    // Conta padrão da Implantação. A senha é trocada no primeiro login (mustChangePassword).
    const passwordHash = await argon2.hash('implantacao');
    await queryRunner.query(
      `INSERT INTO "users" ("login", "passwordHash", "role", "mustChangePassword", "moduleWhatsapp", "moduleTelefonia", "clientName")
       VALUES ('implantacao', $1, 'super_admin', true, true, true, 'IP Solution - Implantação')`,
      [passwordHash],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users');
  }
}
