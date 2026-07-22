import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class InitSubmissions1753200000000 implements MigrationInterface {
  name = 'InitSubmissions1753200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.createTable(
      new Table({
        name: 'submissions',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
          { name: 'clientName', type: 'varchar', default: `'Cliente sem nome'` },
          { name: 'formData', type: 'text', isNullable: true },
          { name: 'flowData', type: 'text', isNullable: true },
          { name: 'sessionId', type: 'varchar', isNullable: true },
          { name: 'status', type: 'varchar', default: `'rascunho'` },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('submissions');
  }
}
