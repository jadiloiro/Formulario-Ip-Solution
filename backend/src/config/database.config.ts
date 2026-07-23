import { DataSourceOptions } from 'typeorm';
import { Submission } from '../submissions/entities/submission.entity';
import { User } from '../users/entities/user.entity';
import { Session } from '../auth/entities/session.entity';

/**
 * Opções de conexão compartilhadas entre o AppModule (runtime) e o
 * data-source.ts (CLI do TypeORM, usado para gerar/rodar migrations).
 * Lê as credenciais de variáveis de ambiente — veja .env.example.
 */
export function buildDataSourceOptions(): DataSourceOptions {
  return {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'ipsolution',
    entities: [Submission, User, Session],
    migrations: [`${__dirname}/../migrations/*.{js,ts}`],
    synchronize: false,
    migrationsRun: true,
    logging: process.env.NODE_ENV !== 'production',
  };
}
