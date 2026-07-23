import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class AddUserIdToSubmissions1784814225272 implements MigrationInterface {
  name = 'AddUserIdToSubmissions1784814225272';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('submissions', [
      new TableColumn({ name: 'userId', type: 'uuid', isNullable: true }),
      new TableColumn({ name: 'onboardingType', type: 'varchar', isNullable: true }),
    ]);

    await queryRunner.createForeignKey(
      'submissions',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('submissions');
    const fk = table?.foreignKeys.find((f) => f.columnNames.includes('userId'));
    if (fk) await queryRunner.dropForeignKey('submissions', fk);
    await queryRunner.dropColumns('submissions', ['userId', 'onboardingType']);
  }
}
