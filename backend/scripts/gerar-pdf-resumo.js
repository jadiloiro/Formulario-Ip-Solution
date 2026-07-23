'use strict';

/**
 * Gera o PDF do "Resumo do Levantamento" com fidelidade de tela usando Playwright:
 * loga no portal, preenche o mínimo necessário do formulário (só os campos
 * obrigatórios — Etapas 3 a 7 não têm campo obrigatório e são só avançadas),
 * finaliza o onboarding (redireciona para resumo.html) e imprime essa página
 * exatamente como renderizada no navegador (emulateMedia('screen') ignora
 * qualquer regra @media print que pudesse alterar o layout).
 *
 * Uso: node scripts/gerar-pdf-resumo.js
 * Variáveis de ambiente opcionais:
 *   BASE_URL   (default http://localhost:3000)
 *   LOGIN      (default ricardo)
 *   SENHA      (default Dr4sgt#autag1)
 *   OUT_FILE   (default resumo_implantacao.pdf, na raiz de backend/)
 */

const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const LOGIN = process.env.LOGIN || 'ricardo';
const SENHA = process.env.SENHA || 'Dr4sgt#autag1';
const OUT_FILE = process.env.OUT_FILE || path.resolve(__dirname, '..', 'resumo_implantacao.pdf');

async function main() {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    try {
        // ── 1. Login ──────────────────────────────────────────────────────────
        await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle' });
        await page.fill('#loginInput', LOGIN);
        await page.fill('#senhaInput', SENHA);
        await Promise.all([
            page.waitForURL(/index\.html|clientes\.html/, { timeout: 15000 }),
            page.click('#loginBtn'),
        ]);

        const loginError = await page.locator('#loginError').isVisible().catch(() => false);
        if (loginError) {
            throw new Error('Login falhou: ' + (await page.locator('#loginError').textContent()));
        }
        if (/clientes\.html/.test(page.url())) {
            throw new Error(`A conta "${LOGIN}" é super_admin e cai em clientes.html (Área ADM), não no formulário de onboarding. Use uma conta "cliente".`);
        }

        // ── 2. Portal de escolha do tipo de onboarding (se aparecer) ─────────────
        await page.waitForLoadState('networkidle');
        const gateVisible = await page.locator('#onboardingGate').isVisible().catch(() => false);
        if (gateVisible) {
            const whatsappBtn = page.locator('#gateOptionWhatsapp');
            if (await whatsappBtn.isDisabled()) {
                throw new Error('A conta não tem o módulo WhatsApp habilitado (moduleWhatsapp=false) — não é possível prosseguir com o onboarding.');
            }
            await whatsappBtn.click();
        }

        // ── 3. Etapa 1 — Filas (obrigatório: nome da 1ª fila) ────────────────────
        await page.fill('#step1 .fila-nome', 'Comercial');
        await page.fill('#step1 tbody tr:first-child td:nth-child(2) input', 'Vendas e novos contratos');
        await page.click('#btnNext');

        // ── 4. Etapa 2 — Agentes (obrigatório: nome + ao menos 1 fila vinculada) ─
        await page.waitForSelector('#step2:not(.hidden)');
        await page.fill('#step2 #agentesTableBody tr:first-child input[type="text"]', 'Ana Souza');
        await page.click('#step2 .multi-select-control');
        await page.click('#step2 .multi-select-dropdown button[data-action="all"]');
        await page.click('#step2 .step-title'); // clique fora do multi-select: fecha o dropdown
        await page.click('#btnNext');

        // ── 5. Etapas 3 a 6 — sem campos obrigatórios; preenche um mínimo real ──
        await page.waitForSelector('#step3:not(.hidden)');
        await page.click('#btnNext'); // Horários: mantém o padrão comercial já vindo pronto

        await page.waitForSelector('#step4:not(.hidden)');
        await page.click('#btnNext'); // Configurações: mantém os padrões do sistema

        await page.waitForSelector('#step5:not(.hidden)');
        await page.fill('#numeroPrincipal', '11 98888-7777');
        await page.click('#btnNext');

        await page.waitForSelector('#step6:not(.hidden)');
        await page.click('#btnNext'); // Agenda: sem CSV, upload é opcional

        // ── 6. Etapa 7 — BOT: sem bloco obrigatório; finaliza direto ────────────
        await page.waitForSelector('#step7:not(.hidden)');
        await Promise.all([
            page.waitForURL(/resumo\.html\?id=/, { timeout: 15000 }),
            page.click('#btnNext'),
        ]);

        // ── 7. Preparação da página do resumo para o "print" perfeito ───────────
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('#resumoDoc:not([hidden])', { timeout: 15000 });

        await page.addStyleTag({
            content: `
                .resumo-card, table.resumo-table, .resumo-field, .resumo-msg-block,
                .resumo-flow-summary, img {
                    break-inside: avoid;
                    page-break-inside: avoid;
                }
            `,
        });
        await page.emulateMedia({ media: 'screen' });

        // ── 8. Geração do PDF ────────────────────────────────────────────────────
        await page.pdf({
            path: OUT_FILE,
            printBackground: true,
            format: 'A4',
            margin: { top: '10px', bottom: '10px', left: '10px', right: '10px' },
        });

        if (pageErrors.length) {
            console.warn('⚠️  Erros de página capturados durante a navegação:');
            pageErrors.forEach((e) => console.warn('  ' + e));
        }
        if (consoleErrors.length) {
            console.warn('⚠️  Erros de console capturados:');
            consoleErrors.forEach((e) => console.warn('  ' + e));
        }
        if (!pageErrors.length && !consoleErrors.length) {
            console.log('✅ Nenhum erro de console/página durante a navegação.');
        }
        console.log(`✅ PDF gerado com sucesso em: ${OUT_FILE}`);
    } catch (err) {
        console.error('❌ Falha ao gerar o PDF:', err.message);
        const shotPath = path.resolve(__dirname, '..', 'erro-gerar-pdf.png');
        await page.screenshot({ path: shotPath, fullPage: true }).catch(() => {});
        console.error(`   Screenshot do estado no momento da falha: ${shotPath}`);
        console.error(`   URL no momento da falha: ${page.url()}`);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
}

main();
