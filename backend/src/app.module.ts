import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { SubmissionsModule } from './submissions/submissions.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { buildDataSourceOptions } from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Postgres: credenciais via variáveis de ambiente (veja .env.example).
    // As opções são compartilhadas com o CLI de migrations em src/data-source.ts.
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => buildDataSourceOptions(),
    }),
    // Serve o frontend (index.html, flowchart.html, css, js) da pasta /public
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
    }),
    SubmissionsModule,
    HealthModule,
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
