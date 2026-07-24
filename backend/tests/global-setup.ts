import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import * as argon2 from 'argon2';
import { request } from '@playwright/test';
import { TEST_ADMIN, ADMIN_STORAGE_STATE } from './test-admin';

/**
 * Contas não se autocadastram (ver CLAUDE.md) — não existe endpoint para criar
 * o primeiro super_admin. Por isso o bootstrap grava a conta de teste direto
 * no Postgres (idempotente: reexecutar só atualiza a senha/hash), do mesmo
 * jeito que a conta real "implantacao" precisou ser criada uma vez. A partir
 * daqui, tudo o mais (cliente de teste, submissão) é criado via HTTP/UI real,
 * nunca por SQL direto.
 */
export default async function globalSetup() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'ipsolution',
  });

  await client.connect();
  try {
    const passwordHash = await argon2.hash(TEST_ADMIN.senha);
    await client.query(
      `INSERT INTO users (login, "passwordHash", role, "mustChangePassword", "moduleWhatsapp", "moduleTelefonia")
       VALUES ($1, $2, 'super_admin', false, true, true)
       ON CONFLICT (login) DO UPDATE
         SET "passwordHash" = EXCLUDED."passwordHash", "mustChangePassword" = false`,
      [TEST_ADMIN.login, passwordHash],
    );
  } finally {
    await client.end();
  }

  // Loga como a conta de teste UMA vez e guarda a sessão (cookie) em disco —
  // as specs reaproveitam esse storageState em vez de logar de novo, porque
  // POST /api/auth/login tem rate limit de 5/min por IP.
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  const ctx = await request.newContext({ baseURL });
  try {
    const loginRes = await ctx.post('/api/auth/login', {
      data: { login: TEST_ADMIN.login, senha: TEST_ADMIN.senha },
    });
    if (!loginRes.ok()) {
      throw new Error(`Bootstrap: login do super_admin de teste falhou (${loginRes.status()}) — servidor no ar em ${baseURL}?`);
    }
    fs.mkdirSync(path.dirname(ADMIN_STORAGE_STATE), { recursive: true });
    await ctx.storageState({ path: ADMIN_STORAGE_STATE });
  } finally {
    await ctx.dispose();
  }
}
