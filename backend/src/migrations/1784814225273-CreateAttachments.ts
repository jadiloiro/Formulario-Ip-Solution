import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateAttachments1784814225273 implements MigrationInterface {
  name = 'CreateAttachments1784814225273';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'attachments',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
          { name: 'submissionId', type: 'uuid' },
          { name: 'stepNumber', type: 'int', isNullable: true },
          { name: 'originalName', type: 'varchar' },
          { name: 'storedName', type: 'varchar' },
          { name: 'mimeType', type: 'varchar' },
          { name: 'size', type: 'int' },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'attachments',
      new TableForeignKey({
        columnNames: ['submissionId'],
        referencedTableName: 'submissions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('attachments');
  }
}
