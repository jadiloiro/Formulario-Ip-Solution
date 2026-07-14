import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { SubmissionsModule } from './submissions/submissions.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // Banco local em arquivo: zero configuração externa.
    // Em produção, troque por Postgres/MySQL alterando apenas este bloco.
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: join(process.cwd(), 'data', 'ipsolution.db'),
      autoLoadEntities: true,
      synchronize: true, // conveniente em dev; use migrations em produção
    }),
    // Serve o frontend (index.html, flowchart.html, css, js) da pasta /public
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
    }),
    SubmissionsModule,
    HealthModule,
  ],
})
export class AppModule {}
