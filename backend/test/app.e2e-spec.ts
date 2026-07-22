import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request = require('supertest');
import { SubmissionsModule } from '../src/submissions/submissions.module';
import { HealthModule } from '../src/health/health.module';
import { buildDataSourceOptions } from '../src/config/database.config';

/**
 * Precisa de um Postgres alcançável (DB_HOST/DB_PORT/... ou os defaults de
 * buildDataSourceOptions). Rode `docker compose up -d postgres` na raiz do
 * repo antes de `npm run test:e2e`.
 */
describe('Submissions (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(buildDataSourceOptions()),
        SubmissionsModule,
        HealthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api', { exclude: [''] });
    await app.init();

    // Garante uma tabela vazia a cada rodada, já que agora é um Postgres real e persistente.
    const dataSource = app.get<DataSource>(getDataSourceToken());
    await dataSource.query('TRUNCATE TABLE submissions');
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health responde ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/submissions/current cria um rascunho quando não existe nenhum', async () => {
    const res = await request(app.getHttpServer()).get('/api/submissions/current');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rascunho');
  });

  it('duas sessões diferentes recebem rascunhos diferentes (isolamento)', async () => {
    const resA1 = await request(app.getHttpServer()).get('/api/submissions/current?sessionId=aaa');
    const resB1 = await request(app.getHttpServer()).get('/api/submissions/current?sessionId=bbb');

    expect(resA1.body.id).not.toBe(resB1.body.id);

    // Repetir a mesma sessão deve devolver o mesmo rascunho, não criar outro
    const resA2 = await request(app.getHttpServer()).get('/api/submissions/current?sessionId=aaa');
    expect(resA2.body.id).toBe(resA1.body.id);
  });

  it('PATCH /api/submissions/:id atualiza formData e PUT .../flow atualiza flowData', async () => {
    const current = await request(app.getHttpServer()).get('/api/submissions/current?sessionId=ccc');
    const id = current.body.id;

    const patched = await request(app.getHttpServer())
      .patch(`/api/submissions/${id}`)
      .send({ formData: { filas: ['Suporte'] } });
    expect(patched.status).toBe(200);
    expect(patched.body.formData).toEqual({ filas: ['Suporte'] });

    const flowed = await request(app.getHttpServer())
      .put(`/api/submissions/${id}/flow`)
      .send({ flowData: { drawflow: {} } });
    expect(flowed.status).toBe(200);
    expect(flowed.body.flowData).toEqual({ drawflow: {} });
  });

  it('POST /api/submissions/:id/submit marca como enviado', async () => {
    const current = await request(app.getHttpServer()).get('/api/submissions/current?sessionId=ddd');
    const id = current.body.id;

    const submitted = await request(app.getHttpServer()).post(`/api/submissions/${id}/submit`);
    expect(submitted.status).toBe(201);
    expect(submitted.body.status).toBe('enviado');
  });
});
