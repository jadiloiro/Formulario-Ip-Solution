import path from 'path';
import { test, expect, request as apiRequest, APIRequestContext } from '@playwright/test';
import { TEST_ADMIN, ADMIN_STORAGE_STATE } from './test-admin';

const ANEXO_FIXTURE = path.join(__dirname, 'fixtures', 'anexo-teste.txt');

/**
 * E2E de UI do onboarding (login.html -> index.html -> resumo.html) e da
 * criação de cliente pela Área ADM (clientes.html), contra o app real.
 * Precisa do servidor (`npm run start:dev`) e de um Postgres alcançável no
 * ar antes de rodar — ver playwright.config.ts / CLAUDE.md.
 *
 * Contas 'cliente' não se autocadastram (só um super_admin cria, ver
 * CLAUDE.md), então cada describe provisiona sua própria conta de teste via
 * API (como o super_admin de teste, reaproveitando o storageState salvo pelo
 * global-setup — POST /api/auth/login tem rate limit de 5/min por IP, então
 * evitamos logar de novo aqui) em beforeAll e a remove em afterAll.
 */

function adminApiContext(): Promise<APIRequestContext> {
  return apiRequest.newContext({
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    storageState: ADMIN_STORAGE_STATE,
  });
}

async function createClientAccount(admin: APIRequestContext, suffix: string) {
  const login = `cliente_e2e_${suffix}_${Date.now()}`;
  const senhaInicial = 'SenhaInicial123';
  const res = await admin.post('/api/users', {
    data: { login, senha: senhaInicial, clientName: `Cliente E2E ${suffix}`, moduleWhatsapp: true },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = await res.json();
  return { id: body.id as string, login, senhaInicial };
}

test.describe('Onboarding — caminho feliz até o resumo final', () => {
  let admin: APIRequestContext;
  let cliente: { id: string; login: string; senhaInicial: string };

  test.beforeAll(async () => {
    admin = await adminApiContext();
    cliente = await createClientAccount(admin, 'happy');
  });

  test.afterAll(async () => {
    await admin.delete(`/api/users/${cliente.id}`);
    await admin.dispose();
  });

  test('login, troca de senha obrigatória, preenche as 9 etapas e finaliza no resumo', async ({ page }) => {
    const novaSenha = 'SenhaNova456';

    await page.goto('/login.html');
    await page.fill('#loginInput', cliente.login);
    await page.fill('#senhaInput', cliente.senhaInicial);
    await page.click('#loginBtn');

    // Primeiro acesso: troca de senha é obrigatória (mustChangePassword=true).
    await expect(page.locator('#changePasswordForm')).toBeVisible();
    await page.fill('#senhaAtualInput', cliente.senhaInicial);
    await page.fill('#novaSenhaInput', novaSenha);
    await page.fill('#confirmarSenhaInput', novaSenha);
    await page.click('#changePasswordBtn');
    await page.waitForURL(/index\.html/);

    // Portal de entrada: escolhe o tipo de onboarding.
    await expect(page.locator('#onboardingGate')).toBeVisible();
    await page.click('#gateOptionWhatsapp');

    // Etapa 1 — Filas (obrigatório: nome da fila).
    await expect(page.locator('#step1')).toBeVisible();
    await page.fill('#step1 .fila-nome', 'Comercial');
    await page.click('#btnNext');

    // Etapa 2 — Agentes (obrigatório: nome + ao menos 1 fila vinculada).
    await page.waitForSelector('#step2:not(.hidden)');
    await page.fill('#step2 #agentesTableBody tr:first-child input[type="text"]', 'Ana Souza');
    await page.click('#step2 .multi-select-control');
    await page.click('#step2 .multi-select-dropdown button[data-action="all"]');
    await page.click('#step2 .step-title'); // fecha o dropdown clicando fora
    await page.click('#btnNext');

    // Etapas 3 e 4 — sem campos obrigatórios.
    await page.waitForSelector('#step3:not(.hidden)');
    await page.click('#btnNext');

    await page.waitForSelector('#step4:not(.hidden)');
    await page.click('#btnNext');

    await page.waitForSelector('#step5:not(.hidden)');
    await page.fill('#numeroPrincipal', '11 98888-7777');
    await page.click('#btnNext');

    // Etapa 6 — API Oficial: só um card "Em breve", sem campos.
    await page.waitForSelector('#step6:not(.hidden)');
    await expect(page.locator('#step6 .step-coming-soon-badge')).toHaveText('Em breve');
    await page.click('#btnNext');

    // Etapa 7 — Templates: cria um modelo usando o botão "+ Adicionar variável"
    // (insere {{1}} e abre o pop-up pedindo o conteúdo de exemplo).
    await page.waitForSelector('#step7:not(.hidden)');
    await page.click('#tplAddBtn');
    await page.fill('#tplNomeInput', 'cobranca_sat_v1');
    await page.selectOption('#tplCategoriaInput', 'Utilidade');
    await page.fill('#tplMensagemInput', 'Olá, . Identificamos parcelas em aberto no seu cadastro.');
    await page.click('#tplAddVarBtn');
    await expect(page.locator('#tplVarModalOverlay')).toBeVisible();
    await expect(page.locator('#tplVarModalToken')).toHaveText('{{1}}');
    await page.fill('#tplVarModalInput', '10%');
    await page.click('#tplVarModalSave');
    await expect(page.locator('#tplVarModalOverlay')).toBeHidden();
    await expect(page.locator('#tplFormPreviewText')).toContainText('10%');
    await page.fill('.tpl-botao-input >> nth=0', 'Ver parcelas em aberto');
    await page.click('#tplSaveBtn');
    await expect(page.locator('#tplGrid .tpl-card')).toHaveCount(1);
    await expect(page.locator('#tplGrid .tpl-card-name')).toHaveText('cobranca_sat_v1');
    await expect(page.locator('#tplGrid .tpl-wa-var')).toHaveText('10%');
    await page.click('#btnNext');

    await page.waitForSelector('#step8:not(.hidden)');
    await page.click('#btnNext');

    // Etapa 9 — BOT: sem bloco obrigatório, finaliza e vai para o resumo.
    await page.waitForSelector('#step9:not(.hidden)');
    await Promise.all([
      page.waitForURL(/resumo\.html\?id=/),
      page.click('#btnNext'),
    ]);

    await expect(page.locator('#resumoDoc')).toBeVisible();
    await expect(page.locator('#resumoError')).toBeHidden();
  });
});

test.describe('Onboarding — bloqueio de avanço com campo obrigatório vazio', () => {
  let admin: APIRequestContext;
  let cliente: { id: string; login: string; senhaInicial: string };

  test.beforeAll(async () => {
    admin = await adminApiContext();
    cliente = await createClientAccount(admin, 'validacao');
  });

  test.afterAll(async () => {
    await admin.delete(`/api/users/${cliente.id}`);
    await admin.dispose();
  });

  test('etapa 1 sem o nome da fila não avança e destaca o campo', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#loginInput', cliente.login);
    await page.fill('#senhaInput', cliente.senhaInicial);
    await page.click('#loginBtn');

    await expect(page.locator('#changePasswordForm')).toBeVisible();
    await page.fill('#senhaAtualInput', cliente.senhaInicial);
    await page.fill('#novaSenhaInput', 'SenhaNova456');
    await page.fill('#confirmarSenhaInput', 'SenhaNova456');
    await page.click('#changePasswordBtn');
    await page.waitForURL(/index\.html/);

    await expect(page.locator('#onboardingGate')).toBeVisible();
    await page.click('#gateOptionWhatsapp');

    // Etapa 1 chega com o campo "Nome da Fila" vazio por padrão — avança sem preenchê-lo.
    await expect(page.locator('#step1')).toBeVisible();
    await expect(page.locator('#step1 .fila-nome')).toHaveValue('');
    await page.click('#btnNext');

    // Bloqueado: continua na etapa 1, campo marcado com erro e toast exibido.
    await expect(page.locator('#step1')).toBeVisible();
    await expect(page.locator('#step2')).toBeHidden();
    await expect(page.locator('#step1 .fila-nome')).toHaveClass(/field-error/);
    await expect(page.locator('#step1 .fila-nome')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('.toast.error')).toHaveText('Preencha os campos obrigatórios destacados antes de continuar.');
  });
});

test.describe('Área ADM — tratamento de erro (login já cadastrado)', () => {
  test.use({ storageState: ADMIN_STORAGE_STATE }); // já autenticado como o super_admin de teste

  test('cadastrar cliente com um login já em uso mostra o erro do backend', async ({ page }) => {
    await page.goto('/clientes.html');
    await expect(page.locator('#viewClientes')).toBeVisible();

    await page.click('#cliTabs .cli-nav-link[data-view="form"]');
    await expect(page.locator('#viewForm')).toBeVisible();

    await page.fill('#clientNameInput', 'Cliente Duplicado');
    // Login já existente: a própria conta super_admin de teste usada para logar.
    await page.fill('#clientLoginInput', TEST_ADMIN.login);
    await page.fill('#clientSenhaInput', 'QualquerSenha123');
    await page.check('#moduleWhatsappInput');
    await page.click('#clientFormSubmitBtn');

    await expect(page.locator('#clientFormError')).toBeVisible();
    await expect(page.locator('#clientFormError')).toHaveText(`Login "${TEST_ADMIN.login}" já está em uso`);
    await expect(page.locator('#clientFormSuccess')).toBeHidden();
  });
});

test.describe('Área ADM — status e anexos sobrevivem a reabrir o formulário depois de enviar (regressão)', () => {
  let admin: APIRequestContext;
  let cliente: { id: string; login: string; senhaInicial: string };

  test.beforeAll(async () => {
    admin = await adminApiContext();
    cliente = await createClientAccount(admin, 'reopen');
  });

  test.afterAll(async () => {
    await admin.delete(`/api/users/${cliente.id}`);
    await admin.dispose();
  });

  test('reabrir index.html após enviar não faz o painel ADM regredir para "em andamento" nem esconder os anexos', async ({ page, browser }) => {
    await page.goto('/login.html');
    await page.fill('#loginInput', cliente.login);
    await page.fill('#senhaInput', cliente.senhaInicial);
    await page.click('#loginBtn');

    await expect(page.locator('#changePasswordForm')).toBeVisible();
    await page.fill('#senhaAtualInput', cliente.senhaInicial);
    await page.fill('#novaSenhaInput', 'SenhaNova456');
    await page.fill('#confirmarSenhaInput', 'SenhaNova456');
    await page.click('#changePasswordBtn');
    await page.waitForURL(/index\.html/);

    await expect(page.locator('#onboardingGate')).toBeVisible();
    await page.click('#gateOptionWhatsapp');

    // Etapa 1: preenche a fila e anexa um arquivo (o bug fazia o painel ADM
    // apontar pro rascunho vazio criado ao reabrir o formulário, escondendo
    // tanto o status "Enviado" quanto esse anexo).
    await page.fill('#step1 .fila-nome', 'Comercial');
    await page.setInputFiles('#attachInput', ANEXO_FIXTURE);
    await expect(page.locator('#attachBadge')).toHaveText('1');
    await page.click('#btnNext');

    await page.waitForSelector('#step2:not(.hidden)');
    await page.fill('#step2 #agentesTableBody tr:first-child input[type="text"]', 'Ana Souza');
    await page.click('#step2 .multi-select-control');
    await page.click('#step2 .multi-select-dropdown button[data-action="all"]');
    await page.click('#step2 .step-title');
    await page.click('#btnNext');

    await page.waitForSelector('#step3:not(.hidden)');
    await page.click('#btnNext');
    await page.waitForSelector('#step4:not(.hidden)');
    await page.click('#btnNext');
    await page.waitForSelector('#step5:not(.hidden)');
    await page.click('#btnNext');
    await page.waitForSelector('#step6:not(.hidden)');
    await page.click('#btnNext');
    await page.waitForSelector('#step7:not(.hidden)');
    await page.click('#btnNext');
    await page.waitForSelector('#step8:not(.hidden)');
    await page.click('#btnNext');

    await page.waitForSelector('#step9:not(.hidden)');
    await Promise.all([
      page.waitForURL(/resumo\.html\?id=/),
      page.click('#btnNext'),
    ]);
    await expect(page.locator('#resumoDoc')).toBeVisible();

    // Reproduz o gatilho do bug: o cliente clica em "Voltar ao formulário".
    // Isso faz initApiSync() chamar GET /submissions/current de novo, que cria
    // um rascunho novo e vazio já que o levantamento enviado não é mais 'rascunho'.
    await page.click('#resumoBackLink');
    await page.waitForURL(/index\.html/);

    // O painel ADM roda numa sessão separada (super_admin), então abre um
    // contexto de navegador à parte já autenticado via storageState.
    const adminContext = await browser.newContext({ storageState: ADMIN_STORAGE_STATE });
    const adminPage = await adminContext.newPage();
    try {
      await adminPage.goto('/clientes.html');
      const card = adminPage.locator('.cli-card').filter({ hasText: `@${cliente.login}` });
      await expect(card).toBeVisible();

      // Continua "Enviado" (não regride pro rascunho vazio recém-criado).
      await expect(card.locator('.cli-badge')).toHaveText('Enviado');

      // O anexo enviado na Etapa 1 continua visível.
      await expect(card.locator('.cli-files-count')).toHaveText('1');
      await card.locator('.cli-files-toggle').click();
      await expect(card.locator('.cli-files-list .file-name')).toContainText('anexo-teste.txt');

      // "Ver resumo" aponta pro levantamento enviado (com dados), não pro rascunho vazio.
      const resumoHref = await card.locator('.cli-card-link').getAttribute('href');
      const [resumoPage] = await Promise.all([
        adminContext.waitForEvent('page'),
        card.locator('.cli-card-link').click(),
      ]);
      await resumoPage.waitForLoadState();
      expect(resumoHref).toBeTruthy();
      await expect(resumoPage.locator('#resumoDoc')).toBeVisible();
      await expect(resumoPage.locator('#resumoDoc')).toContainText('Comercial');
    } finally {
      await adminContext.close();
    }
  });
});
