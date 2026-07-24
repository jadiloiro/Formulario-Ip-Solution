import path from 'path';

/** Credenciais da conta super_admin de teste, compartilhadas pelo global-setup e pelas specs. */
export const TEST_ADMIN = {
  login: process.env.E2E_ADMIN_LOGIN || 'pw_e2e_admin',
  senha: process.env.E2E_ADMIN_SENHA || 'SenhaAdminE2E123!',
};

/**
 * Sessão do super_admin de teste já autenticada, salva pelo global-setup.
 * Reaproveitada pelas specs (via request.newContext / test.use) em vez de
 * logar de novo em cada teste — POST /api/auth/login tem rate limit de
 * 5/min por IP (ver AuthController), fácil de estourar num beforeAll/afterAll
 * repetido em vários describes.
 */
export const ADMIN_STORAGE_STATE = path.resolve(__dirname, '.auth', 'admin-storage-state.json');
