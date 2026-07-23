import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateSessions1784814225271 implements MigrationInterface {
  name = 'CreateSessions1784814225271';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'sessions',
        columns: [
          { name: 'token', type: 'varchar', isPrimary: true },
          { name: 'userId', type: 'uuid' },
          { name: 'expiresAt', type: 'timestamp' },
          { name: 'revokedAt', type: 'timestamp', isNullable: true },
          { name: 'userAgent', type: 'varchar', isNullable: true },
          { name: 'ip', type: 'varchar', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'sessions',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('sessions');
  }
}
