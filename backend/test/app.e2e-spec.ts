import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import cookieParser from 'cookie-parser';
import request = require('supertest');
import { SubmissionsModule } from '../src/submissions/submissions.module';
import { HealthModule } from '../src/health/health.module';
import { AuthModule } from '../src/auth/auth.module';
import { UsersService } from '../src/users/users.service';
import { buildDataSourceOptions } from '../src/config/database.config';

/**
 * Precisa de um Postgres alcançável (DB_HOST/DB_PORT/... ou os defaults de
 * buildDataSourceOptions). Rode `docker compose up -d postgres` na raiz do
 * repo antes de `npm run test:e2e`.
 *
 * Todo login passa pelo rate limit de força bruta (5/min, ver AuthController).
 * Por isso cada identidade loga só UMA vez em beforeAll e a mesma sessão
 * (cookie) é reaproveitada por todos os testes — trocar senha ou criar
 * usuários não invalida a sessão já aberta, só o logout revoga de fato.
 */
describe('Submissions (e2e)', () => {
  let app: INestApplication;
  let usersService: UsersService;

  const ADMIN = { login: 'e2e-admin', senha: 'senhaAdmin123' };
  let adminCookie: string;
  let cookieA: string;
  let cookieB: string;
  let idA: string;
  let idB: string;

  async function login(login: string, senha: string) {
    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ login, senha });
    const setCookie = res.headers['set-cookie'];
    return { status: res.status, cookie: Array.isArray(setCookie) ? setCookie[0] : setCookie };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(buildDataSourceOptions()),
        SubmissionsModule,
        HealthModule,
        AuthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api', { exclude: [''] });
    await app.init();

    // Garante tabelas vazias a cada rodada, já que é um Postgres real e persistente.
    const dataSource = app.get<DataSource>(getDataSourceToken());
    await dataSource.query('TRUNCATE TABLE sessions, submissions, users CASCADE');

    usersService = app.get(UsersService);
    await usersService.create({
      login: ADMIN.login,
      senha: ADMIN.senha,
      role: 'super_admin',
      moduleWhatsapp: true,
      moduleTelefonia: true,
    });

    adminCookie = (await login(ADMIN.login, ADMIN.senha)).cookie;
    await request(app.getHttpServer())
      .patch('/api/auth/change-password')
      .set('Cookie', adminCookie)
      .send({ senhaAtual: ADMIN.senha, novaSenha: 'novaSenhaAdmin123' });

    await request(app.getHttpServer())
      .post('/api/users')
      .set('Cookie', adminCookie)
      .send({ login: 'cliente-a', senha: 'senhaClienteA', clientName: 'Cliente A', moduleWhatsapp: true });
    await request(app.getHttpServer())
      .post('/api/users')
      .set('Cookie', adminCookie)
      .send({ login: 'cliente-b', senha: 'senhaClienteB', clientName: 'Cliente B', moduleTelefonia: true });

    cookieA = (await login('cliente-a', 'senhaClienteA')).cookie;
    await request(app.getHttpServer())
      .patch('/api/auth/change-password')
      .set('Cookie', cookieA)
      .send({ senhaAtual: 'senhaClienteA', novaSenha: 'novaSenhaClienteA' });

    cookieB = (await login('cliente-b', 'senhaClienteB')).cookie;
    await request(app.getHttpServer())
      .patch('/api/auth/change-password')
      .set('Cookie', cookieB)
      .send({ senhaAtual: 'senhaClienteB', novaSenha: 'novaSenhaClienteB' });

    const currentA = await request(app.getHttpServer()).get('/api/submissions/current').set('Cookie', cookieA);
    const currentB = await request(app.getHttpServer()).get('/api/submissions/current').set('Cookie', cookieB);
    idA = currentA.body.id;
    idB = currentB.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health responde ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('sem sessão, as rotas de submissions exigem login', async () => {
    const res = await request(app.getHttpServer()).get('/api/submissions/current');
    expect(res.status).toBe(401);
  });

  it('login com credenciais erradas é rejeitado', async () => {
    const res = await login(ADMIN.login, 'senha-errada');
    expect(res.status).toBe(401);
  });

  it('duas contas diferentes recebem rascunhos diferentes (isolamento)', () => {
    expect(idA).not.toBe(idB);
  });

  it('cliente A não enxerga a submissão do cliente B (404, não 403)', async () => {
    const res = await request(app.getHttpServer()).get(`/api/submissions/${idB}`).set('Cookie', cookieA);
    expect(res.status).toBe(404);
  });

  it('cliente comum não acessa o painel geral, mas super_admin acessa', async () => {
    const forbidden = await request(app.getHttpServer()).get('/api/submissions').set('Cookie', cookieA);
    expect(forbidden.status).toBe(403);

    const allowed = await request(app.getHttpServer()).get('/api/submissions').set('Cookie', adminCookie);
    expect(allowed.status).toBe(200);
    expect(Array.isArray(allowed.body)).toBe(true);
  });

  it('PATCH /api/submissions/:id atualiza formData e PUT .../flow atualiza flowData', async () => {
    const patched = await request(app.getHttpServer())
      .patch(`/api/submissions/${idA}`)
      .set('Cookie', cookieA)
      .send({ formData: { filas: ['Suporte'] }, onboardingType: 'whatsapp' });
    expect(patched.status).toBe(200);
    expect(patched.body.formData).toEqual({ filas: ['Suporte'] });

    const flowed = await request(app.getHttpServer())
      .put(`/api/submissions/${idA}/flow`)
      .set('Cookie', cookieA)
      .send({ flowData: { drawflow: {} } });
    expect(flowed.status).toBe(200);
    expect(flowed.body.flowData).toEqual({ drawflow: {} });
  });

  it('recusa formData de um módulo que o cliente não contratou', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/submissions/${idA}`)
      .set('Cookie', cookieA)
      .send({ onboardingType: 'telefonia' });
    expect(res.status).toBe(403);

    const resB = await request(app.getHttpServer())
      .patch(`/api/submissions/${idB}`)
      .set('Cookie', cookieB)
      .send({ onboardingType: 'whatsapp' });
    expect(resB.status).toBe(403);
  });

  it('POST /api/submissions/:id/submit marca como enviado', async () => {
    const submitted = await request(app.getHttpServer())
      .post(`/api/submissions/${idA}/submit`)
      .set('Cookie', cookieA);
    expect(submitted.status).toBe(201);
    expect(submitted.body.status).toBe('enviado');
  });

  it('logout revoga a sessão imediatamente', async () => {
    const logoutRes = await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', cookieB);
    expect(logoutRes.status).toBe(204);

    const afterLogout = await request(app.getHttpServer())
      .get('/api/submissions/current')
      .set('Cookie', cookieB);
    expect(afterLogout.status).toBe(401);
  });
});
