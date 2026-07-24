let currentStep = 1;
const totalSteps = 9;
const completedSteps = new Set();

/* Chaves de armazenamento centralizadas (evita strings mágicas espalhadas) */
const STORAGE = {
    STEP: 'currentStep',
    THEME: 'theme',
    DRAFT: 'ipsolution_form_draft',
    DRAFT_OWNER: 'ipsolution_draft_owner',
    SHARED: 'ipsolution_shared_flow_data',
    ONBOARDING_TYPE: 'ipsolution_onboarding_type'
};

/* Id do usuário logado nesta página — usado para "carimbar" o rascunho local
   (ver saveDraftNow/restoreDraft) e impedir que o progresso de um cliente
   vaze pro próximo login, quando dois clientes usam o mesmo navegador/PC. */
let currentUserId = null;

/* Limpa todo o estado de rascunho guardado neste navegador (formulário, etapa
   atual, fluxo do BOT). Usado tanto por "Excluir dados e reiniciar" quanto
   quando detectamos que o rascunho salvo pertence a outra conta. */
function clearLocalDraftKeys() {
    localStorage.removeItem(STORAGE.STEP);
    localStorage.removeItem(STORAGE.DRAFT);
    localStorage.removeItem(STORAGE.DRAFT_OWNER);
    localStorage.removeItem('ipsolution_flow_v2');
    localStorage.removeItem(STORAGE.SHARED);
}

/* ========================= Portal de entrada: tipo de onboarding =========================
   Telefonia ainda não existe — só "WhatsApp" desbloqueia o formulário. A escolha fica salva
   no localStorage (lida também no <head> de index.html, antes do 1º paint, pra não piscar
   o formulário atrás do portal quando o cliente já escolheu antes). */
function initOnboardingGate(user) {
    const whatsappBtn = document.getElementById('gateOptionWhatsapp');
    const telefoniaBtn = document.getElementById('gateOptionTelefonia');
    const message = document.getElementById('gateMessage');
    if (!whatsappBtn || !telefoniaBtn) return;

    // RBAC por módulo: só quem tem WhatsApp contratado (definido pela Implantação
    // ao criar a conta) pode desbloquear este formulário — a validação real (que
    // não pode ser burlada pelo DevTools) é repetida no backend em todo PATCH/POST.
    if (user && !user.moduleWhatsapp) {
        whatsappBtn.disabled = true;
        whatsappBtn.classList.add('gate-option-disabled');
        whatsappBtn.addEventListener('click', () => {
            if (message) {
                message.textContent = 'Seu contrato não inclui o módulo WhatsApp. Fale com a Implantação para contratar.';
                message.hidden = false;
            }
        });
    } else {
        whatsappBtn.addEventListener('click', () => {
            localStorage.setItem(STORAGE.ONBOARDING_TYPE, 'whatsapp');
            document.documentElement.setAttribute('data-onboarding', 'unlocked');
        });
    }
    telefoniaBtn.addEventListener('click', () => {
        if (message) message.hidden = false;
    });
}

/* ========================= API (backend NestJS) =========================
   Login agora é obrigatório (ver shared.js: requireAuth), então a API sempre está
   disponível quando o formulário chega a renderizar. apiCtx.available cobre só
   falhas transitórias de rede durante o uso — o localStorage segue como cópia local. */
const apiCtx = { available: false, submissionId: null };

async function initApiSync() {
    try {
        const current = await fetch('/api/submissions/current', { credentials: 'include' });
        if (!current.ok) return;
        const submission = await current.json();
        apiCtx.available = true;
        apiCtx.submissionId = submission.id;
    } catch (e) { /* falha transitória: autosave tenta de novo na próxima alteração */ }
}

function pushDraftToApi(draft) {
    if (!apiCtx.available || !apiCtx.submissionId) return;
    fetch(`/api/submissions/${apiCtx.submissionId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData: draft, onboardingType: 'whatsapp' })
    }).catch(() => { /* rede falhou: o localStorage continua como cópia local */ });
}

async function finalizeSubmission(draft) {
    if (!apiCtx.available || !apiCtx.submissionId) return false;
    try {
        await fetch(`/api/submissions/${apiCtx.submissionId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ formData: draft, onboardingType: 'whatsapp' })
        });
        const res = await fetch(`/api/submissions/${apiCtx.submissionId}/submit`, {
            method: 'POST',
            credentials: 'include'
        });
        return res.ok;
    } catch (e) {
        return false;
    }
}

// Dicas Padrão por Etapa
const botTips = {
    1: "Filas bem organizadas ajudam a direcionar melhor os atendimentos e aumentam a eficiência!",
    2: "Clique no campo de filas e marque quantas quiser: o agente pode atender mais de uma ao mesmo tempo.",
    3: "Configure uma mensagem amigável para quando seus clientes entrarem em contato fora do horário.",
    4: "Definir um tempo limite evita que atendimentos fiquem 'presos' no sistema.",
    5: "Lembre-se: números novos precisam ser aquecidos para evitar bloqueios do WhatsApp.",
    6: "Importar uma agenda geral facilita o início da operação para toda a equipe.",
    7: "Um menu simples e direto reduz a frustração do cliente na hora de escolher uma opção."
};

// Dicas Extras para a interação de clique no robô
const extraTips = [
    "Dica de Ouro: Textos curtos no BOT retêm mais a atenção do cliente!",
    "Lembre-se de salvar rascunhos se precisar pausar a configuração.",
    "Se precisar de ajuda técnica, nossa equipe está sempre à disposição.",
    "Revisar os horários evita que clientes fiquem sem resposta nos feriados."
];

// Conteúdo do painel de ajuda (Conceito + Dicas) por etapa
const stepHelp = {
    1: {
        conceito: "Filas são os grupos de atendimento da sua empresa (Ex: Comercial, Suporte). Cada fila reúne os agentes responsáveis por aquele tipo de assunto.",
        dicas: [
            "Use nomes curtos e claros para as filas (Ex: Comercial, Suporte).",
            "Uma boa descrição ajuda a equipe a entender a finalidade da fila.",
            "Você pode adicionar quantas filas precisar clicando em \"+ Adicionar nova fila\"."
        ]
    },
    2: {
        conceito: "Agentes são os usuários que vão atender pela plataforma. Cada agente pode estar vinculado a uma ou mais filas.",
        dicas: [
            "Clique no campo de filas do agente e marque quantas quiser.",
            "Use o perfil \"Administrador\" apenas para quem vai gerenciar o sistema.",
            "Cadastre primeiro as filas no Passo 1 para poder vinculá-las aqui."
        ]
    },
    3: {
        conceito: "Aqui você define o horário de atendimento da empresa e as mensagens enviadas fora desse horário.",
        dicas: [
            "Se o horário padrão (Seg-Sex 08h-18h, Sáb 08h-12h) atender sua empresa, não precisa alterar nada.",
            "Uma mensagem fora do expediente amigável melhora a experiência do cliente.",
            "Você pode direcionar contatos fora de horário para uma fila específica."
        ]
    },
    4: {
        conceito: "Aqui ficam os 'automáticos' do sistema: quanto tempo esperar por um cliente parado, o que fazer quando ele erra o menu, e todas as mensagens prontas que ele recebe. Tudo já vem configurado com um padrão testado — você só personaliza o que quiser.",
        dicas: [
            "Não precisa mexer em tudo: o padrão já funciona bem. Personalize só o que tiver a cara da sua empresa.",
            "Na prévia do WhatsApp, texto entre *asteriscos* aparece em negrito — igual no app de verdade.",
            "As respostas rápidas economizam muito tempo dos agentes: comece pelo Endereço e pelo Agradecimento.",
            "O código @@PROTOCOLO@@ é trocado automaticamente pelo número real do atendimento."
        ]
    },
    5: {
        conceito: "Configuração do número de WhatsApp que será utilizado para enviar e receber mensagens.",
        dicas: [
            "Informe o número completo com DDD (Ex: 11 99999-9999).",
            "Números novos precisam ser aquecidos gradualmente para evitar bloqueios.",
            "Se o número pertence a uma URA, avise para planejarmos a ativação."
        ]
    },
    6: {
        conceito: "Antes de conectar a API oficial da Meta, fazemos uma triagem rápida do ambiente da sua empresa lá (redes sociais, Business Suite e verificação).",
        dicas: [
            "Se seu Instagram/Facebook ainda não estão vinculados, isso costuma ser o primeiro passo a resolver.",
            "O Meta Business Suite é o \"gerenciador de negócios\" da Meta — não confundir com o app comum do Instagram/Facebook.",
            "A Verificação da Empresa (Business Verification) pode levar alguns dias — vale iniciar esse processo o quanto antes."
        ]
    },
    7: {
        conceito: "Modelos de mensagem pré-aprovados pela Meta, usados para envio ativo (notificações, lembretes, confirmações).",
        dicas: [
            "Essa etapa ainda está em desenvolvimento — em breve você vai poder criar e gerenciar seus templates por aqui."
        ]
    },
    8: {
        conceito: "Importação da lista de contatos (agenda) que a empresa já possui, para facilitar o início dos atendimentos.",
        dicas: [
            "O arquivo deve estar no formato CSV.",
            "Recomendamos começar com uma agenda geral, acessível a toda a equipe.",
            "Nossa equipe pode ajudar a preparar o arquivo se necessário."
        ]
    },
    9: {
        conceito: "O BOT organiza o fluxo de atendimento automático (URA Digital), direcionando o cliente para a fila certa.",
        dicas: [
            "Descreva o fluxo em etapas numeradas (Ex: 1 - Comercial, 2 - Suporte).",
            "Filas sem opção no BOT ainda podem ser usadas por transferência manual.",
            "Fluxos simples e diretos reduzem a frustração do cliente."
        ]
    }
};

/* ========================= Etapa 6 · API Oficial (triagem do ambiente Meta) =========================
   Só descreve/decide o próximo passo em tela — não integra de fato com a Meta.
   "Apto" (as 3 perguntas em "sim") mostra o convite pro Business Suite; qualquer
   "não" (ou "não sei" na verificação) mostra o encaminhamento pra Implantação. */
let metaConviteEnviado = false;
let metaContatoSolicitado = false;

function metaTriagemEvaluate() {
    const redes = document.querySelector('input[name="metaRedes"]:checked');
    const business = document.querySelector('input[name="metaBusinessSuite"]:checked');
    const verificacao = document.querySelector('input[name="metaVerificacao"]:checked');

    if (!redes || !business || !verificacao) {
        toggleField('metaResultadoHint', true);
        toggleField('metaResultadoApto', false);
        toggleField('metaResultadoInapto', false);
        return;
    }

    const apto = redes.value === 'sim' && business.value === 'sim' && verificacao.value === 'sim';
    toggleField('metaResultadoHint', false);
    toggleField('metaResultadoApto', apto);
    toggleField('metaResultadoInapto', !apto);
}

function setupMetaTriagemStep() {
    document.querySelectorAll('input[name="metaRedes"], input[name="metaBusinessSuite"], input[name="metaVerificacao"]')
        .forEach(radio => radio.addEventListener('change', () => { metaTriagemEvaluate(); scheduleDraftSave(); }));

    const conviteBtn = document.getElementById('metaConviteBtn');
    if (conviteBtn) conviteBtn.addEventListener('click', () => {
        metaConviteEnviado = true;
        conviteBtn.disabled = true;
        conviteBtn.textContent = 'Convite marcado como enviado ✔';
        toggleField('metaConviteConfirm', true);
        scheduleDraftSave();
        showToast('Marcado! Nossa equipe vai confirmar o acesso assim que possível.', 'success');
    });

    const falarBtn = document.getElementById('metaFalarBtn');
    if (falarBtn) falarBtn.addEventListener('click', () => {
        metaContatoSolicitado = true;
        falarBtn.disabled = true;
        toggleField('metaFalarConfirm', true);
        scheduleDraftSave();
        showToast('Recebido! Nossa equipe vai entrar em contato em breve.', 'success');
    });
}

/* ========================= Etapa 7 · Templates =========================
   Cada card já é o "registro salvo" (nome + categoria + mensagem + botões) —
   sem sincronização real com a Meta (essa etapa só descreve o que o cliente
   quer; a aprovação de fato é feita depois pela nossa equipe). */
let templatesState = [];
let tplSearchTerm = '';

function tplGenerateId() {
    return `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/* Substitui {{1}}, {{2}}... pelo conteúdo de exemplo cadastrado (ou mostra o
   token cru, em laranja, se a variável ainda não tem exemplo definido). */
function tplRenderBubbleText(mensagem, variaveis) {
    const safe = escapeHtml(mensagem || '');
    return safe.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, idx) => {
        const exemplo = variaveis && variaveis[idx];
        return `<span class="tpl-wa-var">${escapeHtml(exemplo || match)}</span>`;
    });
}

/* Índices de {{N}} usados no texto da mensagem, na ordem em que aparecem, sem repetir */
function tplExtractVarIndexes(mensagem) {
    const found = [...(mensagem || '').matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map(m => m[1]);
    return [...new Set(found)];
}

function tplBuildButtonsHtml(botoes) {
    return (botoes || [])
        .filter(Boolean)
        .map(label => `<button type="button" class="tpl-wa-button" disabled><i class="fa-solid fa-reply"></i> ${escapeHtml(label)}</button>`)
        .join('');
}

function tplBuildCard(tpl) {
    const card = document.createElement('div');
    card.className = 'tpl-card';
    card.dataset.id = tpl.id;
    card.innerHTML = `
        <div class="tpl-card-head">
            <div class="tpl-card-icon"><i class="fa-solid fa-table-cells-large"></i></div>
            <div class="tpl-card-id">
                <strong class="tpl-card-name">${escapeHtml(tpl.nome || '(sem nome)')}</strong>
                <div class="tpl-card-tags">
                    <span class="tpl-tag tpl-tag-green">Template</span>
                    <span class="tpl-tag tpl-tag-orange">${escapeHtml(tpl.categoria || 'Utilidade')}</span>
                </div>
            </div>
            <span class="tpl-card-draft-badge" title="Ainda não enviado para aprovação da Meta — isso é feito depois pela nossa equipe">Rascunho</span>
        </div>
        <div class="tpl-card-actions">
            <button type="button" class="tpl-icon-btn" data-action="edit" title="Editar"><i class="fa-solid fa-pen"></i></button>
            <button type="button" class="tpl-icon-btn" data-action="duplicate" title="Duplicar"><i class="fa-regular fa-copy"></i></button>
            <button type="button" class="tpl-icon-btn tpl-icon-btn-danger" data-action="delete" title="Excluir"><i class="fa-solid fa-trash"></i></button>
        </div>
        <div class="tpl-card-preview">
            <div class="tpl-wa-bubble">
                <div class="tpl-wa-text">${tplRenderBubbleText(tpl.mensagem, tpl.variaveis)}</div>
                <div class="tpl-wa-meta"><span>14:32</span><span class="tpl-wa-check"><i class="fa-solid fa-check-double"></i></span></div>
            </div>
            <div class="tpl-wa-buttons">${tplBuildButtonsHtml(tpl.botoes)}</div>
        </div>`;
    return card;
}

function renderTemplates() {
    const grid = document.getElementById('tplGrid');
    const empty = document.getElementById('tplEmpty');
    const count = document.getElementById('tplCount');
    if (!grid || !empty || !count) return;

    const term = tplSearchTerm.trim().toLowerCase();
    const visible = templatesState.filter(t => !term
        || t.nome.toLowerCase().includes(term)
        || t.mensagem.toLowerCase().includes(term));

    grid.innerHTML = '';
    visible.forEach(t => grid.appendChild(tplBuildCard(t)));

    count.textContent = templatesState.length;
    empty.classList.toggle('hidden', templatesState.length > 0);
}

let tplFormVariaveis = {};
let tplVarModalIndex = null;

function tplOpenForm(tpl = null) {
    const form = document.getElementById('tplForm');
    if (!form) return;
    document.getElementById('tplFormTitle').textContent = tpl ? 'Editar template' : 'Novo template';
    document.getElementById('tplFormEditingId').value = tpl ? tpl.id : '';
    document.getElementById('tplNomeInput').value = tpl ? tpl.nome : '';
    document.getElementById('tplCategoriaInput').value = tpl ? tpl.categoria : 'Utilidade';
    document.getElementById('tplMensagemInput').value = tpl ? tpl.mensagem : '';
    document.querySelectorAll('.tpl-botao-input').forEach((input, i) => {
        input.value = (tpl && tpl.botoes && tpl.botoes[i]) || '';
    });
    tplFormVariaveis = (tpl && tpl.variaveis) ? { ...tpl.variaveis } : {};
    form.classList.remove('hidden');
    tplUpdateFormPreview();
    tplRenderVarChips();
    document.getElementById('tplNomeInput').focus();
}

function tplCloseForm() {
    const form = document.getElementById('tplForm');
    if (form) form.classList.add('hidden');
}

function tplUpdateFormPreview() {
    const mensagem = (document.getElementById('tplMensagemInput') || {}).value || '';
    const previewText = document.getElementById('tplFormPreviewText');
    const previewButtons = document.getElementById('tplFormPreviewButtons');
    if (previewText) previewText.innerHTML = mensagem ? tplRenderBubbleText(mensagem, tplFormVariaveis) : 'Sua mensagem aparece aqui…';
    const botoes = Array.from(document.querySelectorAll('.tpl-botao-input')).map(i => i.value.trim());
    if (previewButtons) previewButtons.innerHTML = tplBuildButtonsHtml(botoes);
}

/* Chips com as variáveis já usadas no texto — clicar reabre o pop-up pra editar o exemplo */
function tplRenderVarChips() {
    const wrap = document.getElementById('tplVarChips');
    if (!wrap) return;
    const mensagem = (document.getElementById('tplMensagemInput') || {}).value || '';
    const indexes = tplExtractVarIndexes(mensagem);
    wrap.innerHTML = '';
    indexes.forEach(idx => {
        const exemplo = tplFormVariaveis[idx];
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'tpl-var-chip';
        chip.innerHTML = exemplo
            ? `<strong>{{${idx}}}</strong> → ${escapeHtml(exemplo)}`
            : `<strong>{{${idx}}}</strong> <em>sem exemplo</em>`;
        chip.addEventListener('click', () => tplOpenVarModal(idx));
        wrap.appendChild(chip);
    });
}

function tplOpenVarModal(index) {
    tplVarModalIndex = index;
    document.getElementById('tplVarModalToken').textContent = `{{${index}}}`;
    document.getElementById('tplVarModalInput').value = tplFormVariaveis[index] || '';
    document.getElementById('tplVarModalOverlay').classList.remove('hidden');
    document.getElementById('tplVarModalInput').focus();
}

function tplCloseVarModal() {
    document.getElementById('tplVarModalOverlay').classList.add('hidden');
    tplVarModalIndex = null;
}

function tplSaveVarModal() {
    const value = document.getElementById('tplVarModalInput').value.trim();
    if (tplVarModalIndex != null) {
        if (value) tplFormVariaveis[tplVarModalIndex] = value;
        else delete tplFormVariaveis[tplVarModalIndex];
    }
    tplCloseVarModal();
    tplRenderVarChips();
    tplUpdateFormPreview();
}

function tplSaveForm() {
    const editingId = document.getElementById('tplFormEditingId').value;
    const nome = document.getElementById('tplNomeInput').value.trim();
    const mensagem = document.getElementById('tplMensagemInput').value.trim();
    if (!nome || !mensagem) {
        showToast('Preencha ao menos o nome e a mensagem do template.', 'error');
        return;
    }
    const categoria = document.getElementById('tplCategoriaInput').value;
    const botoes = Array.from(document.querySelectorAll('.tpl-botao-input')).map(i => i.value.trim()).filter(Boolean);
    // Só guarda exemplos de variáveis que ainda aparecem de fato no texto final.
    const indexesAtuais = tplExtractVarIndexes(mensagem);
    const variaveis = indexesAtuais.reduce((acc, idx) => {
        if (tplFormVariaveis[idx]) acc[idx] = tplFormVariaveis[idx];
        return acc;
    }, {});

    if (editingId) {
        const tpl = templatesState.find(t => t.id === editingId);
        if (tpl) Object.assign(tpl, { nome, categoria, mensagem, botoes, variaveis });
    } else {
        templatesState.push({ id: tplGenerateId(), nome, categoria, mensagem, botoes, variaveis });
    }
    renderTemplates();
    tplCloseForm();
    scheduleDraftSave();
    showToast('Template salvo.', 'success');
}

function setupTemplatesStep() {
    const addBtn = document.getElementById('tplAddBtn');
    const cancelBtn = document.getElementById('tplCancelBtn');
    const saveBtn = document.getElementById('tplSaveBtn');
    const grid = document.getElementById('tplGrid');
    const searchInput = document.getElementById('tplSearchInput');
    const mensagemInput = document.getElementById('tplMensagemInput');
    const addVarBtn = document.getElementById('tplAddVarBtn');
    const varModalOverlay = document.getElementById('tplVarModalOverlay');
    const varModalCancel = document.getElementById('tplVarModalCancel');
    const varModalSave = document.getElementById('tplVarModalSave');
    if (!addBtn) return; // etapa não presente nesta página

    addBtn.addEventListener('click', () => tplOpenForm());
    cancelBtn.addEventListener('click', tplCloseForm);
    saveBtn.addEventListener('click', tplSaveForm);
    mensagemInput.addEventListener('input', () => {
        tplUpdateFormPreview();
        tplRenderVarChips();
    });
    document.querySelectorAll('.tpl-botao-input').forEach(input => input.addEventListener('input', tplUpdateFormPreview));
    searchInput.addEventListener('input', () => {
        tplSearchTerm = searchInput.value;
        renderTemplates();
    });
    grid.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const card = btn.closest('.tpl-card');
        const tpl = templatesState.find(t => t.id === card.dataset.id);
        if (!tpl) return;
        if (btn.dataset.action === 'edit') {
            tplOpenForm(tpl);
        } else if (btn.dataset.action === 'duplicate') {
            templatesState.push({ ...tpl, id: tplGenerateId(), nome: `${tpl.nome}_copia`, botoes: [...tpl.botoes], variaveis: { ...tpl.variaveis } });
            renderTemplates();
            scheduleDraftSave();
        } else if (btn.dataset.action === 'delete') {
            templatesState = templatesState.filter(t => t.id !== tpl.id);
            renderTemplates();
            scheduleDraftSave();
        }
    });

    // Botão "+ Adicionar variável": insere {{N}} na posição do cursor e já
    // abre o pop-up pedindo o conteúdo de exemplo daquele número.
    addVarBtn.addEventListener('click', () => {
        const indexes = tplExtractVarIndexes(mensagemInput.value).map(Number);
        const nextIndex = (indexes.length ? Math.max(...indexes) : 0) + 1;
        const token = `{{${nextIndex}}}`;
        const start = mensagemInput.selectionStart ?? mensagemInput.value.length;
        const end = mensagemInput.selectionEnd ?? mensagemInput.value.length;
        mensagemInput.value = mensagemInput.value.slice(0, start) + token + mensagemInput.value.slice(end);
        const newPos = start + token.length;
        mensagemInput.focus();
        mensagemInput.setSelectionRange(newPos, newPos);
        tplUpdateFormPreview();
        tplRenderVarChips();
        tplOpenVarModal(String(nextIndex));
    });
    varModalCancel.addEventListener('click', tplCloseVarModal);
    varModalSave.addEventListener('click', tplSaveVarModal);
    varModalOverlay.addEventListener('click', (e) => {
        if (e.target === varModalOverlay) tplCloseVarModal();
    });
    document.getElementById('tplVarModalInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') tplSaveVarModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !varModalOverlay.classList.contains('hidden')) tplCloseVarModal();
    });

    renderTemplates();
}

/* ========================= Toasts ========================= */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2900);
}

/* ========================= Tema Claro/Escuro ========================= */
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE.THEME, theme);

    const icon = document.querySelector('.theme-toggle-icon');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
}

/* ========================= Navegação por Etapas ========================= */
function showStep(step) {
    const oldCard = document.querySelector('.step-content:not(.hidden)');

    // Fade-out old card first, then switch
    const doSwitch = () => {
        document.querySelectorAll('.step-content').forEach(el => {
            el.classList.add('hidden');
            el.classList.remove('fade-enter', 'fade-exit');
        });
        document.querySelectorAll('.sidebar-menu li').forEach(el => el.classList.remove('active'));

        const newCard = document.getElementById(`step${step}`);
        if (newCard) {
            newCard.classList.remove('hidden');
            // Trigger reflow so animation restarts
            void newCard.offsetWidth;
            newCard.classList.add('fade-enter');
        }
        const li = document.querySelector(`.sidebar-menu li[data-step="${step}"]`);
        if (li) li.classList.add('active');

        document.querySelectorAll('.sidebar-menu li').forEach(el => {
            const s = parseInt(el.getAttribute('data-step'));
            el.classList.toggle('step-done', completedSteps.has(s) && s !== step);
        });

        document.getElementById('btnPrev').style.visibility = step === 1 ? 'hidden' : 'visible';
        document.getElementById('btnNext').innerText = step === totalSteps ? 'Finalizar e Enviar ✔️' : 'Salvar e continuar →';

        const title = document.querySelector(`#step${step} .step-title`);
        if (title) { title.setAttribute('tabindex', '-1'); title.focus({ preventScroll: false }); }

        const toolbar = document.getElementById('stepToolbar');
        const jadibo  = document.getElementById('jadiboWrap');
        const headerTarget = document.querySelector(`#step${step} .step-header`);
        if (toolbar && headerTarget) headerTarget.appendChild(toolbar);
        if (jadibo  && headerTarget) headerTarget.appendChild(jadibo);
        jadiboTogglePanel(true);

        renderStepToolbar(step);
        if (step === totalSteps) {
            renderFlowPreview();
            requestAnimationFrame(() => { if (typeof ifeInit === 'function') ifeInit(); });
        }
        updateProgress(step);
        localStorage.setItem(STORAGE.STEP, step);
    };

    if (oldCard && !oldCard.classList.contains('hidden')) {
        oldCard.classList.add('fade-exit');
        oldCard.addEventListener('animationend', doSwitch, { once: true });
        // Safety fallback if event never fires
        setTimeout(doSwitch, 260);
    } else {
        doSwitch();
    }
    currentStep = step;
}

/* ========================= Toolbar: Conceito / Modelos / Dicas / Anexos ========================= */
function renderStepToolbar(step) {
    const help = stepHelp[step] || { conceito: '', dicas: [] };

    const conceitoText = document.getElementById('conceitoText');
    if (conceitoText) conceitoText.textContent = help.conceito;

    // "Modelos" ainda não tem um link definido para cada etapa (placeholder por enquanto)
    const modeloLink = document.getElementById('modeloLink');
    if (modeloLink) modeloLink.textContent = '📄 Em breve disponível';

    renderAttachments(step);
}

function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Anexos vivem no backend (tabela attachments) desde o início — o array em
// memória só existe como cache pra não rebuscar a cada troca de etapa.
async function fetchAttachments() {
    if (!apiCtx.available || !apiCtx.submissionId) return [];
    try {
        const res = await fetch(`/api/submissions/${apiCtx.submissionId}/attachments`, { credentials: 'include' });
        if (!res.ok) return [];
        return await res.json();
    } catch (e) {
        return [];
    }
}

// Mesmo limite do backend (attachments.service.ts) — repetido aqui só para dar
// feedback imediato na tela; quem garante de verdade é o servidor.
const MAX_ANEXOS_POR_ETAPA = 5;

async function renderAttachments(step) {
    const list = document.getElementById('attachList');
    const badge = document.getElementById('attachBadge');
    if (!list || !badge) return;

    const all = await fetchAttachments();
    const files = all.filter(f => f.stepNumber === step);
    list.innerHTML = '';

    const count = document.getElementById('attachCount');
    const dropzone = document.getElementById('attachDropzone');
    const dropzoneText = document.getElementById('attachDropzoneText');
    const input = document.getElementById('attachInput');
    const noLimite = files.length >= MAX_ANEXOS_POR_ETAPA;
    if (count) count.textContent = `${files.length}/${MAX_ANEXOS_POR_ETAPA}`;
    if (count) count.classList.toggle('attach-count-full', noLimite);
    if (dropzone) dropzone.classList.toggle('attach-dropzone-disabled', noLimite);
    if (input) input.disabled = noLimite;
    if (dropzoneText) dropzoneText.textContent = noLimite
        ? `Limite de ${MAX_ANEXOS_POR_ETAPA} arquivos atingido — remova algum para anexar outro`
        : 'Clique ou arraste arquivos aqui';

    if (files.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'attach-list-empty';
        empty.textContent = 'Nenhum arquivo anexado nesta etapa.';
        list.appendChild(empty);
    } else {
        files.forEach((file) => {
            const li = document.createElement('li');
            const downloadUrl = `/api/submissions/${apiCtx.submissionId}/attachments/${file.id}/download`;
            li.innerHTML = `<a class="file-name" href="${downloadUrl}" title="${escapeHtml(file.originalName)}" target="_blank" rel="noopener">📄 ${escapeHtml(file.originalName)} <span class="file-size">${formatFileSize(file.size)}</span></a>`;
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.setAttribute('aria-label', `Remover ${file.originalName}`);
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', async () => {
                removeBtn.disabled = true;
                try {
                    await fetch(`/api/submissions/${apiCtx.submissionId}/attachments/${file.id}`, {
                        method: 'DELETE',
                        credentials: 'include',
                    });
                } finally {
                    renderAttachments(step);
                }
            });
            li.appendChild(removeBtn);
            list.appendChild(li);
        });
    }

    badge.textContent = files.length;
    badge.classList.toggle('hidden', files.length === 0);
}

async function addAttachments(step, fileList) {
    // Captura os arquivos JÁ aqui, de forma síncrona: fileList costuma ser o FileList
    // "ao vivo" do próprio <input>, e o handler de 'change' zera esse input logo em
    // seguida (attachInput.value = '') — se isso rodasse antes de qualquer await desta
    // função, a lista ficava vazia quando a gente finalmente fosse lê-la.
    const todosArquivos = Array.from(fileList);

    if (!apiCtx.available || !apiCtx.submissionId) {
        showToast('Sem conexão com o servidor — não foi possível anexar o arquivo.', 'error');
        return;
    }

    const jaAnexados = (await fetchAttachments()).filter(f => f.stepNumber === step).length;
    const vagas = MAX_ANEXOS_POR_ETAPA - jaAnexados;
    if (vagas <= 0) {
        showToast(`Limite de ${MAX_ANEXOS_POR_ETAPA} arquivos por etapa atingido. Remova algum anexo antes de enviar outro.`, 'error');
        return;
    }

    const files = todosArquivos.slice(0, vagas);
    if (todosArquivos.length > vagas) {
        showToast(`Só cabem mais ${vagas} arquivo(s) nesta etapa (limite de ${MAX_ANEXOS_POR_ETAPA}) — os demais não foram enviados.`, 'error');
    }

    let ok = 0;
    for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('stepNumber', String(step));
        try {
            const res = await fetch(`/api/submissions/${apiCtx.submissionId}/attachments`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });
            if (res.ok) ok++;
        } catch (e) { /* segue tentando os próximos arquivos */ }
    }
    renderAttachments(step);
    if (ok > 0) showToast(`${ok} arquivo(s) anexado(s) a esta etapa.`, 'success');
    if (ok < files.length) showToast(`${files.length - ok} arquivo(s) falharam ao enviar.`, 'error');
}

function updateProgress(step) {
    const done = completedSteps.size;
    const pct = Math.round((done / totalSteps) * 100);
    const pie = document.getElementById('progressPie');
    if (pie) pie.style.setProperty('--pct', pct);
    document.getElementById('progressPiePct').textContent = `${pct}%`;
    document.getElementById('progressLabel').textContent = `Etapa ${step} de ${totalSteps}`;
    document.getElementById('progressPercent').textContent = `${pct}% concluído`;
}

/* Tooltip com o resumo da etapa ao passar o mouse — só faz sentido com a
   sidebar recolhida (só ícone); expandida, o resumo já aparece como texto
   fixo abaixo do nome de cada etapa (.menu-sub). */
function setupSidebarTooltips() {
    const sidebar = document.getElementById('sidebar');
    const tooltip = document.createElement('div');
    tooltip.className = 'sidebar-tooltip';
    document.body.appendChild(tooltip);

    document.querySelectorAll('.sidebar-menu li').forEach(li => {
        li.addEventListener('mouseenter', () => {
            if (!sidebar || !sidebar.classList.contains('collapsed')) return;
            const label = li.querySelector('.menu-label');
            const sub = li.querySelector('.menu-sub');
            tooltip.innerHTML = '';
            if (label) {
                const strong = document.createElement('strong');
                strong.textContent = label.textContent;
                tooltip.appendChild(strong);
            }
            if (sub) {
                const span = document.createElement('span');
                span.textContent = sub.textContent;
                tooltip.appendChild(span);
            }
            const rect = li.getBoundingClientRect();
            tooltip.style.top = `${rect.top + rect.height / 2}px`;
            tooltip.style.left = `${rect.right + 12}px`;
            tooltip.classList.add('visible');
        });
        li.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
    });

    // Mesmo tooltip pro gráfico de pizza — recolhida, ele perde o rótulo de texto ao lado
    const progressEl = document.querySelector('.sidebar-progress');
    if (progressEl) {
        progressEl.addEventListener('mouseenter', () => {
            if (!sidebar || !sidebar.classList.contains('collapsed')) return;
            const label = document.getElementById('progressLabel');
            const percent = document.getElementById('progressPercent');
            tooltip.innerHTML = '';
            if (label) {
                const strong = document.createElement('strong');
                strong.textContent = label.textContent;
                tooltip.appendChild(strong);
            }
            if (percent) {
                const span = document.createElement('span');
                span.textContent = percent.textContent;
                tooltip.appendChild(span);
            }
            const rect = progressEl.getBoundingClientRect();
            tooltip.style.top = `${rect.top + rect.height / 2}px`;
            tooltip.style.left = `${rect.right + 12}px`;
            tooltip.classList.add('visible');
        });
        progressEl.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
    }
}

/* ========================= Validação ========================= */
function validateStep(step) {
    const stepEl = document.getElementById(`step${step}`);
    let firstInvalid = null;
    let valid = true;

    // Campos de texto/número/textarea obrigatórios
    stepEl.querySelectorAll('.form-control[required]').forEach(field => {
        // Campo escondido (condicional recolhido) não pode bloquear o avanço
        if (field.offsetParent === null) {
            field.classList.remove('field-error');
            field.removeAttribute('aria-invalid');
            return;
        }
        const filled = field.value.trim() !== '';
        field.classList.toggle('field-error', !filled);
        field.setAttribute('aria-invalid', String(!filled)); // leitores de tela anunciam o erro
        if (!filled) {
            valid = false;
            if (!firstInvalid) firstInvalid = field;
        }
    });

    // Multi-selects obrigatórios (ex: filas do agente)
    stepEl.querySelectorAll('.multi-select').forEach(ms => {
        const selected = JSON.parse(ms.getAttribute('data-selected') || '[]');
        const isRequired = ms.closest('td') && stepEl.id === 'step2';
        if (isRequired) {
            const empty = selected.length === 0;
            ms.classList.toggle('field-error', empty);
            if (empty) {
                valid = false;
                if (!firstInvalid) firstInvalid = ms;
            }
        }
    });

    if (!valid && firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast('Preencha os campos obrigatórios destacados antes de continuar.', 'error');
    }

    return valid;
}

function nextStep() {
    if (!validateStep(currentStep)) return;

    completedSteps.add(currentStep);

    if (currentStep < totalSteps) {
        currentStep++;
        showStep(currentStep);
        updateFilasDropdowns();
    } else {
        // Última etapa: salva, envia para a API e abre o resumo final (fonte do PDF)
        updateProgress(currentStep);
        if (typeof window.ifeFlushSave === 'function') window.ifeFlushSave();
        const draft = collectDraft();
        saveDraftNow();
        if (!apiCtx.available || !apiCtx.submissionId) {
            showToast('Sem conexão com o servidor — não foi possível concluir o levantamento.', 'error');
            return;
        }
        finalizeSubmission(draft).then(ok => {
            if (ok) {
                window.location.href = `resumo.html?id=${apiCtx.submissionId}`;
            } else {
                showToast('Falha ao enviar o levantamento ao servidor. Tente novamente.', 'error');
            }
        });
    }
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        showStep(currentStep);
    }
}

function toggleField(elementId, show) {
    const el = document.getElementById(elementId);
    if (show) el.classList.remove('hidden');
    else el.classList.add('hidden');
}

/* Passo 5 · Número principal: aceitava qualquer caractere e qualquer tamanho.
   Agora só deixa passar dígitos e a pontuação comum de telefone (espaço, (), -, +),
   e avisa (sem bloquear o avanço) quando a quantidade de dígitos foge do padrão
   brasileiro — DDD + número, 10 (fixo) ou 11 (celular) dígitos. */
function setupNumeroPrincipalValidation() {
    const input = document.getElementById('numeroPrincipal');
    const hint = document.getElementById('numeroPrincipalHint');
    if (!input || !hint) return;

    input.addEventListener('input', () => {
        const sanitized = input.value.replace(/[^\d\s()+-]/g, '');
        if (sanitized !== input.value) input.value = sanitized;

        const digitos = sanitized.replace(/\D/g, '').length;
        if (digitos === 0 || (digitos >= 10 && digitos <= 11)) {
            hint.textContent = '';
        } else {
            hint.textContent = 'Confira o número: DDD + telefone costuma ter 10 ou 11 dígitos.';
        }
    });
}

/* ========================= Reiniciar preenchimento ========================= */
function resetAllData() {
    const ok = confirm('Isso apaga TUDO que foi preenchido (filas, agentes, configurações, fluxo do BOT) e recomeça do zero. Deseja continuar?');
    if (!ok) return;

    // Armazenamento
    clearLocalDraftKeys();

    // Campos e estado
    currentStep = 1;
    completedSteps.clear();
    document.getElementById('onboardingForm').reset();

    // Tabelas dinâmicas voltam a 1 linha vazia (respostas rápidas: zero)
    const resetTbody = (id, keep = 1) => {
        const tbody = document.getElementById(id);
        if (!tbody) return;
        while (tbody.children.length > keep) tbody.lastElementChild.remove();
        tbody.querySelectorAll('input, select').forEach(el => { el.value = ''; });
    };
    resetTbody('filasTableBody');
    resetTbody('agentesTableBody');
    resetTbody('botOpcoesTableBody');
    resetTbody('respostasTableBody', 0);
    if (typeof refreshRespostasTableVisibility === 'function') refreshRespostasTableVisibility();
    document.querySelectorAll('.sugestao-chip').forEach(chip => { chip.disabled = false; });

    // Multi-selects e prévias das mensagens voltam ao padrão
    document.querySelectorAll('.multi-select').forEach(ms => ms.setAttribute('data-selected', '[]'));
    if (typeof MENSAGENS_PADRAO !== 'undefined') {
        MENSAGENS_PADRAO.forEach(cfg => {
            const ta = document.getElementById(cfg.id);
            if (ta) ta.value = cfg.texto;
            updateMsgPreview(cfg.id);
        });
    }

    // Triagem Meta (Passo 6) volta ao estado inicial — radios já foram limpos pelo form.reset()
    metaConviteEnviado = false;
    metaContatoSolicitado = false;
    const conviteBtn = document.getElementById('metaConviteBtn');
    if (conviteBtn) { conviteBtn.disabled = false; conviteBtn.textContent = 'Convite Enviado'; }
    const falarBtn = document.getElementById('metaFalarBtn');
    if (falarBtn) falarBtn.disabled = false;
    toggleField('metaConviteConfirm', false);
    toggleField('metaFalarConfirm', false);
    if (typeof metaTriagemEvaluate === 'function') metaTriagemEvaluate();

    // Horários (Passo 3) voltam ao horário comercial padrão
    if (typeof renderScheduleDays === 'function') renderScheduleDays(defaultScheduleState());

    // Editor de fluxo embutido volta ao modelo inicial
    if (typeof ifeReset === 'function') ifeReset();

    const statusEl = document.getElementById('draftStatus');
    if (statusEl) statusEl.textContent = '';

    updateFilasDropdowns();
    showStep(1);
    showToast('Tudo limpo! Começando do zero. 🧹', 'success');
}

/* ========================= Jadibô compacto (painel de dicas interativo por etapa) ========================= */
const jadiboTipIndex = {};

const STEP_NOMES = {
    1: 'Filas', 2: 'Agentes', 3: 'Horários', 4: 'Configurações', 5: 'Números',
    6: 'API Oficial', 7: 'Templates', 8: 'Agenda', 9: 'BOT'
};

function jadiboSetIntro() {
    const dicas = (stepHelp[currentStep] && stepHelp[currentStep].dicas) || extraTips;
    jadiboTipIndex[currentStep] = 0;
    _jadiboRender(0, dicas);
}

function jadiboNextTip() {
    const img = document.getElementById('jadiboAvatar');
    if (img) { img.classList.add('bot-jump'); setTimeout(() => img.classList.remove('bot-jump'), 400); }

    const dicas = (stepHelp[currentStep] && stepHelp[currentStep].dicas) || extraTips;
    // jadiboSetIntro already rendered index 0 and left index at 0;
    // each "next" advances to the next slot (wraps around)
    const current = jadiboTipIndex[currentStep] || 0;
    const nextIdx = (current + 1) % dicas.length;
    jadiboTipIndex[currentStep] = nextIdx;
    _jadiboRender(nextIdx, dicas);
}

function _jadiboRender(idx, dicas) {
    const msg     = document.getElementById('botMessage');
    const counter = document.getElementById('jadiboCounter');
    const badge   = document.getElementById('jadiboBadge');
    const stepEl  = document.getElementById('jadiboPanelStep');

    if (msg)     msg.innerHTML  = dicas[idx] || '';
    if (counter) counter.textContent = `Dica ${idx + 1} de ${dicas.length}`;
    if (badge)   badge.textContent   = dicas.length;
    if (stepEl)  stepEl.textContent  = `Passo ${currentStep}: ${STEP_NOMES[currentStep] || ''}`;
}

function jadiboTogglePanel(forceClose = false) {
    const panel   = document.getElementById('jadiboPanel');
    const trigger = document.getElementById('jadiboTrigger');
    if (!panel || !trigger) return;
    const willOpen = forceClose ? false : panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !willOpen);
    trigger.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) jadiboSetIntro();
}

/* ========================= Tabela - FILAS ========================= */
function addFilaRow(focus = true) {
    const tbody = document.getElementById('filasTableBody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="form-control fila-nome" placeholder="Nome da fila" required></td>
        <td><input type="text" class="form-control" placeholder="Descrição"></td>
        <td><button type="button" class="btn-delete" aria-label="Remover fila">🗑️</button></td>
    `;
    tbody.appendChild(tr);
    if (focus) tr.querySelector('.fila-nome').focus();
    updateFilasDropdowns();
    scheduleDraftSave();
    return tr;
}

/* ========================= Tabela - AGENTES ========================= */
function addAgenteRow(focus = true) {
    const tbody = document.getElementById('agentesTableBody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="form-control" placeholder="Nome do agente" required></td>
        <td><div class="multi-select" data-selected="[]"></div></td>
        <td><select class="form-control"><option value="Agente">Agente</option><option value="Administrador">Administrador</option></select></td>
        <td><button type="button" class="btn-delete" aria-label="Remover agente">🗑️</button></td>
    `;
    tbody.appendChild(tr);
    if (focus) tr.querySelector('input[type="text"]').focus();
    updateFilasDropdowns();
    scheduleDraftSave();
    return tr;
}

function removeRow(btn) {
    const row = btn.closest('tr');
    if (row.parentNode.children.length > 1) {
        row.remove();
        updateFilasDropdowns();
        scheduleDraftSave();
    } else {
        showToast('É necessário manter pelo menos um registro.', 'error');
    }
}

/* ========================= Multi-select de Filas (componente) ========================= */
function closeAllMultiSelects(except) {
    document.querySelectorAll('.multi-select.open').forEach(ms => {
        if (ms !== except) closeMultiSelect(ms);
    });
}

function closeMultiSelect(ms) {
    ms.classList.remove('open');
    const dropdown = ms.querySelector('.multi-select-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
    const control = ms.querySelector('.multi-select-control');
    if (control) control.setAttribute('aria-expanded', 'false');
}

function openMultiSelect(ms) {
    closeAllMultiSelects(ms);
    ms.classList.add('open');
    const dropdown = ms.querySelector('.multi-select-dropdown');
    dropdown.classList.remove('hidden');
    const control = ms.querySelector('.multi-select-control');
    if (control) control.setAttribute('aria-expanded', 'true');
    const search = dropdown.querySelector('.multi-select-search input');
    if (search) { search.value = ''; filterMultiSelectOptions(ms, ''); search.focus(); }
}

function getSelected(ms) {
    try { return JSON.parse(ms.getAttribute('data-selected') || '[]'); }
    catch (e) { return []; }
}

function setSelected(ms, values) {
    ms.setAttribute('data-selected', JSON.stringify(values));
    if (values.length > 0) ms.classList.remove('field-error');
    renderChips(ms, values);
}

function renderChips(ms, values) {
    const control = ms.querySelector('.multi-select-control');
    const chipsWrap = control.querySelector('.chips-wrap');
    chipsWrap.innerHTML = '';

    if (values.length === 0) {
        chipsWrap.innerHTML = '<span class="multi-select-placeholder">Selecione as filas...</span>';
        return;
    }

    values.forEach(fila => {
        const chip = document.createElement('span');
        chip.className = 'multi-select-chip';
        chip.innerHTML = `<span class="chip-label">${escapeHtml(fila)}</span>`;
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.setAttribute('aria-label', `Remover ${fila}`);
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const current = getSelected(ms).filter(v => v !== fila);
            setSelected(ms, current);
            syncOptionCheckboxes(ms);
        });
        chip.appendChild(removeBtn);
        chipsWrap.appendChild(chip);
    });
}

function syncOptionCheckboxes(ms) {
    const selected = getSelected(ms);
    ms.querySelectorAll('.multi-select-option input[type="checkbox"]').forEach(cb => {
        cb.checked = selected.includes(cb.value);
    });
}

function filterMultiSelectOptions(ms, term) {
    const options = ms.querySelectorAll('.multi-select-option');
    const normalized = term.trim().toLowerCase();
    let anyVisible = false;
    options.forEach(opt => {
        const label = opt.getAttribute('data-label').toLowerCase();
        const match = label.includes(normalized);
        opt.classList.toggle('hidden', !match);
        if (match) anyVisible = true;
    });
    const emptyMsg = ms.querySelector('.multi-select-empty');
    if (emptyMsg) emptyMsg.classList.toggle('hidden', anyVisible);
}

function buildMultiSelect(ms, filas) {
    const previouslySelected = getSelected(ms).filter(v => filas.includes(v));

    ms.innerHTML = '';

    const control = document.createElement('div');
    control.className = 'multi-select-control';
    control.tabIndex = 0;
    control.setAttribute('role', 'button');
    control.setAttribute('aria-haspopup', 'listbox');

    const chipsWrap = document.createElement('div');
    chipsWrap.className = 'chips-wrap';
    chipsWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;flex:1;';

    const arrow = document.createElement('span');
    arrow.className = 'multi-select-arrow';
    arrow.textContent = '▾';

    control.appendChild(chipsWrap);
    control.appendChild(arrow);

    const dropdown = document.createElement('div');
    dropdown.className = 'multi-select-dropdown hidden';

    if (filas.length === 0) {
        dropdown.innerHTML = '<div class="multi-select-empty">Adicione filas no Passo 1 para vinculá-las aqui.</div>';
    } else {
        const searchWrap = document.createElement('div');
        searchWrap.className = 'multi-select-search';
        searchWrap.innerHTML = `<input type="text" placeholder="Buscar fila..." aria-label="Buscar fila">`;
        dropdown.appendChild(searchWrap);

        const actions = document.createElement('div');
        actions.className = 'multi-select-actions';
        actions.innerHTML = `<button type="button" data-action="all">Selecionar todas</button><button type="button" data-action="none">Limpar</button>`;
        dropdown.appendChild(actions);

        const optionsWrap = document.createElement('div');
        optionsWrap.className = 'multi-select-options';
        optionsWrap.setAttribute('role', 'listbox');

        filas.forEach(fila => {
            const uniqueId = 'fila_' + Math.random().toString(36).substr(2, 9);
            const opt = document.createElement('label');
            opt.className = 'multi-select-option';
            opt.setAttribute('data-label', fila);
            opt.setAttribute('for', uniqueId);
            const checked = previouslySelected.includes(fila) ? 'checked' : '';
            opt.innerHTML = `<input type="checkbox" id="${uniqueId}" value="${escapeHtml(fila)}" ${checked}><span>${escapeHtml(fila)}</span>`;
            optionsWrap.appendChild(opt);
        });

        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'multi-select-empty hidden';
        emptyMsg.textContent = 'Nenhuma fila encontrada.';
        optionsWrap.appendChild(emptyMsg);

        dropdown.appendChild(optionsWrap);

        // Listeners
        searchWrap.querySelector('input').addEventListener('input', (e) => filterMultiSelectOptions(ms, e.target.value));
        actions.querySelector('[data-action="all"]').addEventListener('click', () => {
            setSelected(ms, [...filas]);
            syncOptionCheckboxes(ms);
        });
        actions.querySelector('[data-action="none"]').addEventListener('click', () => {
            setSelected(ms, []);
            syncOptionCheckboxes(ms);
        });
        optionsWrap.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                const current = new Set(getSelected(ms));
                if (cb.checked) current.add(cb.value); else current.delete(cb.value);
                setSelected(ms, Array.from(current));
            });
        });
    }

    ms.appendChild(control);
    ms.appendChild(dropdown);

    control.addEventListener('click', () => {
        if (ms.classList.contains('open')) closeMultiSelect(ms);
        else openMultiSelect(ms);
    });
    control.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            control.click();
        } else if (e.key === 'Escape') {
            closeMultiSelect(ms);
        }
    });

    setSelected(ms, previouslySelected);
}

/* ========================= Sincronização Filas <-> Agentes/Horários ========================= */
function updateFilasDropdowns() {
    const filaInputs = document.querySelectorAll('.fila-nome');
    const filas = Array.from(filaInputs).map(input => input.value.trim()).filter(val => val !== '');

    // Reconstrói cada multi-select preservando seleções ainda válidas
    document.querySelectorAll('.multi-select').forEach(ms => buildMultiSelect(ms, filas));

    // Atualiza o <select> da aba de Horários (Passo 3), que usa apenas 1 fila para transbordo
    document.querySelectorAll('.select-fila-unica').forEach(select => {
        const currentVal = select.value;
        select.innerHTML = '<option value="">Selecione a fila</option>';
        filas.forEach(fila => {
            select.innerHTML += `<option value="${escapeHtml(fila)}">${escapeHtml(fila)}</option>`;
        });
        if (filas.includes(currentVal)) select.value = currentVal;
    });

    // Atualiza os <select> de fila de destino das opções do menu do BOT (Passo 9)
    document.querySelectorAll('.opcao-fila').forEach(select => {
        const currentVal = select.value;
        select.innerHTML = '<option value="">Selecione a fila</option>';
        filas.forEach(fila => {
            select.innerHTML += `<option value="${escapeHtml(fila)}">${escapeHtml(fila)}</option>`;
        });
        if (filas.includes(currentVal)) select.value = currentVal;
    });

    renderFlowPreview();
}

/* ========================= Tabela - Opções do Menu do BOT ========================= */
function renumberBotOpcoes() {
    document.querySelectorAll('#botOpcoesTableBody tr').forEach((tr, index) => {
        tr.querySelector('.opcao-numero').textContent = index + 1;
    });
}

function addBotOpcao(focus = true) {
    const tbody = document.getElementById('botOpcoesTableBody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="opcao-numero"></td>
        <td><input type="text" class="form-control opcao-texto" placeholder="Ex: Suporte" required></td>
        <td><select class="form-control opcao-fila"><option value="">Selecione a fila</option></select></td>
        <td><button type="button" class="btn-delete" aria-label="Remover opção">🗑️</button></td>
    `;
    tbody.appendChild(tr);
    renumberBotOpcoes();
    updateFilasDropdowns();
    if (focus) tr.querySelector('.opcao-texto').focus();
    scheduleDraftSave();
    return tr;
}

function removeBotOpcao(btn) {
    btn.closest('tr').remove();
    renumberBotOpcoes();
    renderFlowPreview();
    scheduleDraftSave();
}

/* ========================= Passo 4: Mensagens automáticas (com prévia WhatsApp) =========================
   Textos padrão extraídos do documento oficial de levantamento da IP Solution. */

const MENSAGENS_PADRAO = [
    {
        id: 'saudacaoAgente',
        titulo: 'Saudação do agente',
        quando: 'Enviada quando um agente assume a conversa',
        texto: 'Olá, você está falando com o(a) *Nome do Agente*, em que posso ajudar?'
    },
    {
        id: 'msgFilaVazia',
        titulo: 'Nenhum agente disponível',
        quando: 'Enviada quando o cliente cai numa fila sem agentes online',
        texto: 'Nenhum especialista está disponível no momento! Deixe seu recado que em breve retornamos'
    },
    {
        id: 'msgOpcaoInvalida',
        titulo: 'Opção inválida',
        quando: 'Enviada quando o cliente digita algo que não está no menu',
        texto: 'Opção digitada é inválida, digite uma das opções enviadas anteriormente.'
    },
    {
        id: 'msgFimSessao',
        titulo: 'Fim de atendimento',
        quando: 'Enviada quando o atendimento é finalizado',
        texto: 'A *Nome da Empresa* agradece o seu contato.\n📍 Não é necessário responder a essa mensagem\n📍 Seu protocolo é: @@PROTOCOLO@@\nAtenciosamente, *Nome do Agente* 😃'
    },
    {
        id: 'msgTransferencia',
        titulo: 'Transferência de atendimento',
        quando: 'Enviada quando o agente transfere a conversa para outro setor',
        texto: 'Seu atendimento foi transferido para o especialista responsável, obrigado(a).'
    },
    {
        id: 'msgSemInteracao',
        slot: 'msgSemInteracao',
        titulo: 'Mensagem de encerramento por falta de resposta',
        quando: 'Enviada ao encerrar a conversa abandonada',
        texto: 'Sua mensagem foi finalizada por falta de interação.\n\nA *Nome da Empresa* agradece o seu contato. Não é necessário responder a essa mensagem, caso responda será aberto um novo atendimento.\n\n🌐 https://www.sitedaempresa.com.br\n📞 Central de Atendimento - (00) 0000-0000\nSeu protocolo é: @@PROTOCOLO@@'
    },
    {
        id: 'msgTentativas',
        slot: 'msgTentativas',
        titulo: 'Mensagem de tentativas excedidas',
        quando: 'Enviada quando o cliente atinge o limite de tentativas',
        texto: 'Você excedeu a quantidade de tentativas. A opção digitada é inválida. Por favor, aguarde enquanto encaminhamos sua solicitação para um atendente, que entrará em contato para auxiliá-lo(a).'
    }
];

/* Converte o texto para a aparência real do WhatsApp:
   *negrito* vira negrito e @@PROTOCOLO@@ vira um número de exemplo */
function formatWhatsPreview(texto) {
    let safe = escapeHtml(texto);
    safe = safe.replace(/@@PROTOCOLO@@/g, '20260713-0042');
    safe = safe.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>');
    return safe;
}

function msgComponentHTML(cfg) {
    return `
    <div class="msg-item" data-msg-id="${cfg.id}">
        <div class="msg-item-head">
            <strong>${escapeHtml(cfg.titulo)}</strong>
            <span class="msg-quando">${escapeHtml(cfg.quando)}</span>
        </div>
        <div class="msg-flex">
            <div class="msg-controls">
                <div class="radio-group">
                    <label><input type="radio" name="mode_${cfg.id}" value="padrao" checked> Manter padrão</label>
                    <label><input type="radio" name="mode_${cfg.id}" value="custom"> Personalizar</label>
                </div>
                <textarea id="${cfg.id}" class="form-control msg-custom hidden" aria-label="Texto personalizado: ${escapeHtml(cfg.titulo)}">${escapeHtml(cfg.texto)}</textarea>
            </div>
            <div class="wa-preview">
                <span class="wa-preview-label">Prévia no WhatsApp</span>
                <div class="wa-bubble">
                    <span class="wa-bubble-text">${formatWhatsPreview(cfg.texto)}</span>
                    <span class="wa-meta">09:41 <span class="wa-check">✓✓</span></span>
                </div>
            </div>
        </div>
    </div>`;
}

function renderMensagensPadrao() {
    const container = document.getElementById('mensagensPadraoContainer');
    if (!container) return;

    MENSAGENS_PADRAO.forEach(cfg => {
        if (cfg.slot) {
            const slot = document.querySelector(`.msg-slot[data-slot="${cfg.slot}"]`);
            if (slot) slot.innerHTML = msgComponentHTML(cfg);
        } else {
            const wrap = document.createElement('div');
            wrap.className = 'config-item';
            wrap.innerHTML = msgComponentHTML(cfg);
            container.appendChild(wrap);
        }
    });
}

function updateMsgPreview(id) {
    const item = document.querySelector(`.msg-item[data-msg-id="${id}"]`);
    if (!item) return;
    const cfg = MENSAGENS_PADRAO.find(m => m.id === id);
    const mode = item.querySelector(`input[name="mode_${id}"]:checked`);
    const textarea = item.querySelector('.msg-custom');
    const isCustom = mode && mode.value === 'custom';

    textarea.classList.toggle('hidden', !isCustom);
    const texto = isCustom ? textarea.value : cfg.texto;
    item.querySelector('.wa-bubble-text').innerHTML = formatWhatsPreview(texto);
}

/* Delegação única para todo o Passo 4: radios condicionais e prévias */
function setupStep4Interactions() {
    const step4 = document.getElementById('step4');
    if (!step4) return;

    step4.addEventListener('change', (e) => {
        const t = e.target;
        if (t.name === 'tempo_bot') toggleField('tempoBotCustom', t.value === 'alterar');
        if (t.name === 'tempo_bot_acao') toggleField('tempoBotFilaWrap', t.value === 'direcionar');
        if (t.name === 'sem_interacao') {
            toggleField('semInteracaoCustom', t.value === 'alterar');
            // Se nunca encerra, a mensagem de encerramento não se aplica
            toggleField('semInteracaoMsgWrap', t.value !== 'nao_encerrar');
        }
        if (t.name === 'tentativas_mode') toggleField('tentativasCustom', t.value === 'alterar');
        if (t.name && t.name.startsWith('mode_')) updateMsgPreview(t.name.replace('mode_', ''));
    });

    step4.addEventListener('input', (e) => {
        if (e.target.classList.contains('msg-custom')) {
            const item = e.target.closest('.msg-item');
            if (item) updateMsgPreview(item.getAttribute('data-msg-id'));
        }
    });
}

/* ========================= Passo 4: Respostas rápidas ========================= */
const SUGESTOES_RESPOSTAS = [
    { titulo: '📍 Endereço', texto: 'Estamos na Rua Exemplo, 123 - Centro. Segunda a sexta, das 8h às 18h.' },
    { titulo: '🙏 Agradecimento', texto: 'Agradecemos o seu contato! Qualquer coisa, estamos à disposição. 😊' },
    { titulo: '📅 Confirmação de agenda', texto: 'Seu horário está confirmado! Qualquer imprevisto, é só nos avisar por aqui.' },
    { titulo: '⭐ Avaliação no Google', texto: 'Sua opinião é muito importante! Pode nos avaliar no Google? Leva menos de 1 minuto: [link da avaliação]' },
    { titulo: '💰 Cotação', texto: 'Recebemos seu pedido de cotação! Em breve retornaremos com os valores e prazos.' }
];

function renderSugestaoChips() {
    const wrap = document.getElementById('sugestaoChips');
    if (!wrap) return;
    SUGESTOES_RESPOSTAS.forEach((s, i) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'sugestao-chip';
        chip.textContent = s.titulo;
        chip.dataset.sugestaoIdx = String(i);
        chip.addEventListener('click', () => {
            const tr = addRespostaRow(s.titulo, s.texto, true);
            tr.dataset.sugestaoIdx = String(i); // evita duplicar a mesma sugestão sem querer...
            chip.disabled = true; // ...mas reabilitada em removeRespostaRow() se a linha for excluída
        });
        wrap.appendChild(chip);
    });
}

/* Reabilita o chip de sugestão correspondente (se houver) antes de remover a linha —
   senão, uma vez usada, a sugestão nunca mais podia ser adicionada de novo na mesma sessão. */
function removeRespostaRow(tr) {
    const idx = tr.dataset.sugestaoIdx;
    if (idx !== undefined) {
        const chip = document.querySelector(`.sugestao-chip[data-sugestao-idx="${idx}"]`);
        if (chip) chip.disabled = false;
    }
    tr.remove();
    refreshRespostasTableVisibility();
    scheduleDraftSave();
}

function refreshRespostasTableVisibility() {
    const table = document.getElementById('respostasTable');
    const tbody = document.getElementById('respostasTableBody');
    if (table && tbody) table.classList.toggle('hidden', tbody.children.length === 0);
}

function addRespostaRow(titulo = '', texto = '', focus = true) {
    const tbody = document.getElementById('respostasTableBody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td style="width: 30%"><input type="text" class="form-control resposta-titulo" placeholder="Ex: Endereço" value="${escapeHtml(titulo)}"></td>
        <td><input type="text" class="form-control resposta-texto" placeholder="Mensagem que será enviada" value="${escapeHtml(texto)}"></td>
        <td><button type="button" class="btn-delete" aria-label="Remover resposta rápida">🗑️</button></td>
    `;
    tbody.appendChild(tr);
    refreshRespostasTableVisibility();
    if (focus) tr.querySelector('.resposta-texto').focus();
    scheduleDraftSave();
    return tr;
}

/* ========================= Pré-visualização do Fluxo do BOT ========================= */
function getFilaAgentesMap() {
    const map = {};
    document.querySelectorAll('#agentesTableBody tr').forEach(tr => {
        const nome = tr.querySelector('input[type="text"]').value.trim();
        const ms = tr.querySelector('.multi-select');
        if (!nome || !ms) return;
        const filasDoAgente = getSelected(ms);
        filasDoAgente.forEach(fila => {
            if (!map[fila]) map[fila] = [];
            map[fila].push(nome);
        });
    });
    return map;
}

/* ========================= Passo 3 · Horários (seletor visual estilo WhatsApp) =========================
   Em vez de pedir para o cliente escrever o horário em texto livre, cada dia da semana tem uma
   chave (aberto/fechado) e um ou mais intervalos de horário — igual ao "Horário de Atendimento"
   do WhatsApp Business. Tudo é montado dinamicamente para caber em uma única linha por dia. */
const DIAS_SEMANA = [
    { key: 'seg', label: 'Segunda-feira', curto: 'Segunda' },
    { key: 'ter', label: 'Terça-feira', curto: 'Terça' },
    { key: 'qua', label: 'Quarta-feira', curto: 'Quarta' },
    { key: 'qui', label: 'Quinta-feira', curto: 'Quinta' },
    { key: 'sex', label: 'Sexta-feira', curto: 'Sexta' },
    { key: 'sab', label: 'Sábado', curto: 'Sábado' },
    { key: 'dom', label: 'Domingo', curto: 'Domingo' }
];

function defaultScheduleState() {
    const uteis = () => ({ aberto: true, intervalos: [{ de: '08:00', ate: '18:00' }] });
    return {
        seg: uteis(), ter: uteis(), qua: uteis(), qui: uteis(), sex: uteis(),
        sab: { aberto: true, intervalos: [{ de: '08:00', ate: '12:00' }] },
        dom: { aberto: false, intervalos: [] }
    };
}

function scheduleIntervalRowHtml(idx, intervalo) {
    return `
        <div class="schedule-interval" data-idx="${idx}">
            <input type="time" class="schedule-time schedule-de" value="${intervalo.de || '08:00'}" aria-label="Abre às">
            <span class="schedule-sep">até</span>
            <input type="time" class="schedule-time schedule-ate" value="${intervalo.ate || '18:00'}" aria-label="Fecha às">
            <button type="button" class="schedule-interval-remove" title="Remover este intervalo" aria-label="Remover intervalo">✕</button>
        </div>`;
}

function scheduleDayRowHtml(dia, estado) {
    const aberto = !!estado.aberto;
    const intervalos = (estado.intervalos && estado.intervalos.length) ? estado.intervalos : [{ de: '08:00', ate: '18:00' }];
    const intervalosHtml = aberto
        ? intervalos.map((it, i) => scheduleIntervalRowHtml(i, it)).join('')
            + `<button type="button" class="schedule-add-interval">+ Adicionar intervalo</button>`
        : '';
    return `
        <div class="schedule-day ${aberto ? 'is-open' : ''}" data-day="${dia.key}">
            <div class="schedule-day-head">
                <label class="wa-switch">
                    <input type="checkbox" class="schedule-day-toggle" ${aberto ? 'checked' : ''} aria-label="Atende ${dia.label}">
                    <span class="wa-switch-track"></span>
                </label>
                <span class="schedule-day-label">${dia.label}</span>
                <span class="schedule-day-status">${aberto ? 'Aberto' : 'Fechado'}</span>
            </div>
            <div class="schedule-day-intervals">${intervalosHtml}</div>
        </div>`;
}

function renderScheduleDays(estadoSemana) {
    const container = document.getElementById('scheduleDays');
    if (!container) return;
    const semana = estadoSemana || defaultScheduleState();
    container.innerHTML = DIAS_SEMANA
        .map(dia => scheduleDayRowHtml(dia, semana[dia.key] || { aberto: false, intervalos: [] }))
        .join('');
}

// Lê o estado atual direto do DOM (fonte da verdade fica na tela, não em variável separada)
function getScheduleState() {
    const container = document.getElementById('scheduleDays');
    const estado = {};
    DIAS_SEMANA.forEach(dia => {
        const row = container && container.querySelector(`.schedule-day[data-day="${dia.key}"]`);
        if (!row) { estado[dia.key] = { aberto: false, intervalos: [] }; return; }
        const aberto = row.querySelector('.schedule-day-toggle').checked;
        const intervalos = Array.from(row.querySelectorAll('.schedule-interval')).map(int => ({
            de: int.querySelector('.schedule-de').value || '08:00',
            ate: int.querySelector('.schedule-ate').value || '18:00'
        }));
        estado[dia.key] = { aberto, intervalos: aberto ? intervalos : [] };
    });
    return estado;
}

function setScheduleState(estadoSemana) {
    renderScheduleDays(estadoSemana);
}

/* Agrupa dias consecutivos com o mesmo horário num texto curto, ex.:
   "Segunda a Sexta: 08:00–18:00 · Sábado: 08:00–12:00 · Domingo: fechado" */
function scheduleResumoTexto(estadoSemanaOpcional) {
    const semana = estadoSemanaOpcional || getScheduleState();
    const assinaturaDia = (dia) => {
        const e = semana[dia.key] || { aberto: false, intervalos: [] };
        if (!e.aberto) return 'fechado';
        const lista = e.intervalos && e.intervalos.length ? e.intervalos : [{ de: '—', ate: '—' }];
        return lista.map(it => `${it.de}–${it.ate}`).join(' e ');
    };
    const grupos = [];
    DIAS_SEMANA.forEach(dia => {
        const assinatura = assinaturaDia(dia);
        const anterior = grupos[grupos.length - 1];
        if (anterior && anterior.assinatura === assinatura) anterior.fim = dia;
        else grupos.push({ inicio: dia, fim: dia, assinatura });
    });
    const partes = grupos.map(g => {
        const rotulo = g.inicio.key === g.fim.key ? g.inicio.curto : `${g.inicio.curto} a ${g.fim.curto}`;
        return g.assinatura === 'fechado' ? `${rotulo}: fechado` : `${rotulo}: ${g.assinatura}`;
    });
    return partes.join(' · ') || 'Horário não definido';
}

function setupScheduleInteractions() {
    const container = document.getElementById('scheduleDays');
    const btnComercial = document.getElementById('btnScheduleComercial');
    const btnCopySeg = document.getElementById('btnScheduleCopySeg');
    const btnAllClosed = document.getElementById('btnScheduleAllClosed');
    if (!container) return;

    const afterChange = () => { scheduleDraftSave(); renderFlowPreview(); };

    container.addEventListener('change', (e) => {
        if (!e.target.classList.contains('schedule-day-toggle')) return;
        const dayKey = e.target.closest('.schedule-day').getAttribute('data-day');
        const estado = getScheduleState();
        // Ao ligar um dia que estava fechado, começa com um intervalo comercial de sugestão
        estado[dayKey] = e.target.checked
            ? { aberto: true, intervalos: (estado[dayKey].intervalos && estado[dayKey].intervalos.length) ? estado[dayKey].intervalos : [{ de: '08:00', ate: '18:00' }] }
            : { aberto: false, intervalos: [] };
        renderScheduleDays(estado);
        afterChange();
    });

    container.addEventListener('click', (e) => {
        const dayRow = e.target.closest('.schedule-day');
        if (!dayRow) return;
        const dayKey = dayRow.getAttribute('data-day');
        if (e.target.classList.contains('schedule-add-interval')) {
            const estado = getScheduleState();
            estado[dayKey].intervalos.push({ de: '13:00', ate: '18:00' });
            renderScheduleDays(estado);
            afterChange();
        } else if (e.target.classList.contains('schedule-interval-remove')) {
            const estado = getScheduleState();
            if (estado[dayKey].intervalos.length <= 1) {
                showToast('Cada dia aberto precisa de pelo menos um intervalo. Use a chave para fechar o dia inteiro.', 'error');
                return;
            }
            const idx = parseInt(e.target.closest('.schedule-interval').getAttribute('data-idx'), 10);
            estado[dayKey].intervalos.splice(idx, 1);
            renderScheduleDays(estado);
            afterChange();
        }
    });

    // Digitar um horário não precisa remontar a lista inteira — só salva e atualiza a prévia
    container.addEventListener('input', afterChange);

    if (btnComercial) btnComercial.addEventListener('click', () => {
        renderScheduleDays(defaultScheduleState());
        afterChange();
        showToast('Horário comercial padrão aplicado.', 'success');
    });
    if (btnCopySeg) btnCopySeg.addEventListener('click', () => {
        const estado = getScheduleState();
        const segunda = estado.seg;
        ['ter', 'qua', 'qui', 'sex'].forEach(dia => {
            estado[dia] = { aberto: segunda.aberto, intervalos: segunda.intervalos.map(it => ({ ...it })) };
        });
        renderScheduleDays(estado);
        afterChange();
        showToast('Horário de Segunda-feira copiado para os dias úteis.', 'success');
    });
    if (btnAllClosed) btnAllClosed.addEventListener('click', () => {
        const estado = {};
        DIAS_SEMANA.forEach(dia => { estado[dia.key] = { aberto: false, intervalos: [] }; });
        renderScheduleDays(estado);
        afterChange();
        showToast('Todos os dias marcados como fechados.', 'success');
    });
}

function getHorarioResumo() {
    const horarioTexto = scheduleResumoTexto();

    const foraRadio = document.querySelector('input[name="msg_fora"]:checked');
    const direciona = foraRadio && foraRadio.value === 'direcionar';
    let destinoFora = 'Encerra o atendimento com mensagem automática';
    if (direciona) {
        const select = document.getElementById('filaForaSelect');
        const filaEscolhida = select ? select.value : '';
        destinoFora = filaEscolhida
            ? `Direciona para a fila "${filaEscolhida}"`
            : 'Direciona para uma fila (ainda não selecionada no Passo 3)';
    }

    return { horarioTexto, destinoFora };
}

const SHARED_DATA_KEY = 'ipsolution_shared_flow_data';

function syncSharedDataToStorage() {
    const mensagemInicial = (document.getElementById('botMensagemInicial') || {}).value
        || 'Olá! Digite o número da opção desejada:';
    const todasFilas = Array.from(document.querySelectorAll('.fila-nome'))
        .map(i => i.value.trim()).filter(v => v !== '');
    const filaAgentesMap = getFilaAgentesMap();
    const { horarioTexto, destinoFora } = getHorarioResumo();

    const payload = {
        filas: todasFilas,
        agentesPorFila: filaAgentesMap,
        mensagemInicial,
        horarioTexto,
        destinoFora,
        updatedAt: Date.now()
    };

    try {
        localStorage.setItem(SHARED_DATA_KEY, JSON.stringify(payload));
    } catch (e) {
        // Armazenamento indisponível (modo privado, etc.) — falha silenciosamente
    }
}

function renderFlowPreview() {
    const container = document.getElementById('flowPreview');
    syncSharedDataToStorage();
    if (!container) return;

    const mensagemInicial = (document.getElementById('botMensagemInicial') || {}).value
        || 'Olá! Digite o número da opção desejada:';

    const opcoes = Array.from(document.querySelectorAll('#botOpcoesTableBody tr')).map(tr => ({
        texto: tr.querySelector('.opcao-texto').value.trim(),
        fila: tr.querySelector('.opcao-fila').value
    })).filter(o => o.texto || o.fila);

    const todasFilas = Array.from(document.querySelectorAll('.fila-nome'))
        .map(i => i.value.trim()).filter(v => v !== '');
    const filaAgentesMap = getFilaAgentesMap();
    const { horarioTexto, destinoFora } = getHorarioResumo();

    if (todasFilas.length === 0) {
        container.innerHTML = `<p class="flow-empty-state">Cadastre suas filas no Passo 1 para começar a montar o fluxo do BOT.</p>`;
        return;
    }

    let html = '';
    html += `<div class="flow-node"><span class="flow-node-label">Mensagem inicial</span>${escapeHtml(mensagemInicial)}</div>`;
    html += `<div class="flow-connector"></div>`;

    if (opcoes.length === 0) {
        html += `<p class="flow-empty-state">Adicione opções de menu acima para ver o fluxo tomar forma.</p>`;
    } else {
        html += `<div class="flow-branches">`;
        opcoes.forEach((op, idx) => {
            const agentes = op.fila && filaAgentesMap[op.fila] ? filaAgentesMap[op.fila] : [];
            html += `
                <div class="flow-branch">
                    <div class="flow-branch-badge"><span class="num">${idx + 1}</span> ${escapeHtml(op.texto || '(sem texto)')}</div>
                    <div class="flow-connector"></div>
                    ${op.fila
                        ? `<div class="flow-branch-target">
                               <span class="flow-branch-target-title">📥 ${escapeHtml(op.fila)}</span>
                               ${agentes.length ? `<span class="flow-branch-agents">Agentes: ${escapeHtml(agentes.join(', '))}</span>` : `<span class="flow-branch-agents">Sem agente vinculado ainda</span>`}
                           </div>`
                        : `<div class="flow-branch-target is-empty">Selecione a fila de destino</div>`
                    }
                </div>`;
        });
        html += `</div>`;
    }

    // Ramo de fora de horário (Passo 3)
    html += `
        <div class="flow-offhours">
            <div class="flow-offhours-title">🕒 Fora do horário de atendimento</div>
            <p><strong>Horário configurado:</strong> ${escapeHtml(horarioTexto)}</p>
            <p><strong>O que acontece:</strong> ${escapeHtml(destinoFora)}</p>
        </div>`;

    // Filas cadastradas mas não usadas em nenhuma opção do menu
    const filasUsadas = new Set(opcoes.map(o => o.fila).filter(Boolean));
    const filasSemBot = todasFilas.filter(f => !filasUsadas.has(f));
    if (filasSemBot.length > 0) {
        html += `<p class="flow-unassigned">ℹ️ As filas <strong>${escapeHtml(filasSemBot.join(', '))}</strong> não têm opção direta no BOT, mas podem ser usadas por transferência manual do agente.</p>`;
    }

    container.innerHTML = html;
}

/* ========================= Rascunho Real (coleta, salva e restaura) =========================
   Antes, "Salvar rascunho" apenas exibia um toast sem persistir nada — o usuário
   perdia tudo ao recarregar. Agora todo o formulário é serializado de verdade. */

function collectDraft() {
    const getRadio = (name) => {
        const el = document.querySelector(`input[name="${name}"]:checked`);
        return el ? el.value : null;
    };

    return {
        filas: Array.from(document.querySelectorAll('#filasTableBody tr')).map(tr => {
            const inputs = tr.querySelectorAll('input');
            return { nome: inputs[0].value, descricao: inputs[1].value };
        }),
        agentes: Array.from(document.querySelectorAll('#agentesTableBody tr')).map(tr => {
            const ms = tr.querySelector('.multi-select');
            return {
                nome: tr.querySelector('input[type="text"]').value,
                filas: ms ? JSON.parse(ms.getAttribute('data-selected') || '[]') : [],
                perfil: tr.querySelector('select').value
            };
        }),
        horario: {
            dias: getScheduleState(),
            msgFora: getRadio('msg_fora'),
            filaFora: (document.getElementById('filaForaSelect') || {}).value || ''
        },
        config: {
            tempoBotMode: getRadio('tempo_bot'),
            tempoBot: (document.getElementById('tempoBotInput') || {}).value || '',
            tempoBotAcao: getRadio('tempo_bot_acao'),
            tempoBotFila: (document.getElementById('tempoBotFila') || {}).value || '',
            semInteracaoMode: getRadio('sem_interacao'),
            semInteracaoMin: (document.getElementById('semInteracaoInput') || {}).value || '',
            tentativasMode: getRadio('tentativas_mode'),
            tentativas: (document.getElementById('tentativasInput') || {}).value || '',
            tentativasFila: (document.getElementById('tentativasFila') || {}).value || '',
            mensagens: MENSAGENS_PADRAO.reduce((acc, cfg) => {
                acc[cfg.id] = {
                    mode: getRadio(`mode_${cfg.id}`) || 'padrao',
                    texto: (document.getElementById(cfg.id) || {}).value || cfg.texto
                };
                return acc;
            }, {}),
            respostasRapidas: Array.from(document.querySelectorAll('#respostasTableBody tr')).map(tr => ({
                titulo: tr.querySelector('.resposta-titulo').value,
                texto: tr.querySelector('.resposta-texto').value,
                // Qual chip de sugestão originou esta linha (ver renderSugestaoChips/removeRespostaRow) —
                // sem isso, restaurar o rascunho não sabia reabilitar/desabilitar os chips corretamente.
                sugestaoIdx: tr.dataset.sugestaoIdx !== undefined ? Number(tr.dataset.sugestaoIdx) : null
            }))
        },
        numeros: {
            principal: (document.getElementById('numeroPrincipal') || {}).value || '',
            ativo: getRadio('numeroAtivo'),
            ura: getRadio('ura'),
            uraResponsavel: (document.getElementById('uraResponsavel') || {}).value || ''
        },
        // Triagem do ambiente Meta — decide em tela qual dos dois encaminhamentos mostrar
        // (ver metaTriagemEvaluate), mas quem realmente conta pro CRM/Implantação é este objeto.
        metaTriagem: {
            redesSociais: getRadio('metaRedes'),
            redesGestor: (document.getElementById('metaGestor') || {}).value || '',
            businessSuite: getRadio('metaBusinessSuite'),
            verificacao: getRadio('metaVerificacao'),
            conviteEnviado: metaConviteEnviado,
            contatoSolicitado: metaContatoSolicitado
        },
        // Templates: mantidos em memória (templatesState), não em inputs soltos no DOM
        // — cada card já É o registro salvo, ver renderTemplates()/saveTemplateFromForm().
        templates: { itens: templatesState },
        // O fluxo do BOT é editado visualmente no Passo 9 (motor Drawflow) e persistido
        // em localStorage pelo próprio editor — lemos daqui para o PDF refletir o que
        // o usuário realmente montou no quadro (e não um formulário legado escondido).
        bot: {
            fluxoJson: localStorage.getItem('ipsolution_flow_v2') || null,
            resumoFluxo: (typeof window.ifeGetFlowSummary === 'function') ? window.ifeGetFlowSummary() : '',
            totalBlocos: (typeof window.ifeGetFlowNodeCount === 'function') ? window.ifeGetFlowNodeCount() : 0
        },
        completedSteps: Array.from(completedSteps),
        savedAt: Date.now()
    };
}


/* Cascata removida — grupos do Passo 4 agora usam accordion */

function saveDraftNow() {
    try {
        const draft = collectDraft();
        localStorage.setItem(STORAGE.DRAFT, JSON.stringify(draft));
        if (currentUserId) localStorage.setItem(STORAGE.DRAFT_OWNER, currentUserId);
        pushDraftToApi(draft); // backup no servidor quando a API está no ar
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const statusEl = document.getElementById('draftStatus');
        if (statusEl) statusEl.textContent = `Rascunho salvo às ${hh}:${mm}`;
        return true;
    } catch (e) {
        return false; // armazenamento indisponível (modo privado etc.)
    }
}

/* Salvamento automático: dispara ~1s após o usuário parar de digitar */
const scheduleDraftSave = debounce(saveDraftNow, 1000);

function saveDraft() {
    if (saveDraftNow()) showToast('Rascunho salvo neste navegador. Pode fechar e voltar depois!', 'success');
    else showToast('Não foi possível salvar o rascunho neste navegador.', 'error');
}

function ensureRowCount(tbody, count, addFn) {
    while (tbody.children.length < count) addFn(false);
    while (tbody.children.length > Math.max(1, count)) tbody.lastElementChild.remove();
}

function restoreDraft() {
    // Rascunho carimbado com outro usuário (ou sem carimbo, de antes desta checagem
    // existir) — não é seguro assumir que é deste cliente. Descarta em vez de aplicar
    // um progresso que pode ser de outra conta que usou este navegador antes.
    const savedOwner = localStorage.getItem(STORAGE.DRAFT_OWNER);
    if (localStorage.getItem(STORAGE.DRAFT) && savedOwner !== currentUserId) {
        clearLocalDraftKeys();
        return false;
    }

    let draft;
    try {
        const raw = localStorage.getItem(STORAGE.DRAFT);
        if (!raw) return false;
        draft = JSON.parse(raw);
    } catch (e) { return false; }
    if (!draft) return false;

    const setRadio = (name, value) => {
        if (!value) return;
        const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
        if (el) el.checked = true;
    };

    // Passo 1 — Filas
    if (Array.isArray(draft.filas) && draft.filas.length) {
        ensureRowCount(document.getElementById('filasTableBody'), draft.filas.length, addFilaRow);
        document.querySelectorAll('#filasTableBody tr').forEach((tr, i) => {
            const inputs = tr.querySelectorAll('input');
            inputs[0].value = draft.filas[i] ? draft.filas[i].nome : '';
            inputs[1].value = draft.filas[i] ? draft.filas[i].descricao : '';
        });
    }
    updateFilasDropdowns();

    // Passo 2 — Agentes (seleções de fila entram via data-selected antes da reconstrução)
    if (Array.isArray(draft.agentes) && draft.agentes.length) {
        ensureRowCount(document.getElementById('agentesTableBody'), draft.agentes.length, addAgenteRow);
        document.querySelectorAll('#agentesTableBody tr').forEach((tr, i) => {
            const data = draft.agentes[i];
            if (!data) return;
            tr.querySelector('input[type="text"]').value = data.nome || '';
            tr.querySelector('select').value = data.perfil || 'Agente';
            const ms = tr.querySelector('.multi-select');
            if (ms) ms.setAttribute('data-selected', JSON.stringify(data.filas || []));
        });
        updateFilasDropdowns();
    }

    // Passo 3 — Horários (chaves por dia + destino fora do expediente)
    if (draft.horario) {
        setScheduleState(draft.horario.dias || defaultScheduleState());
        setRadio('msg_fora', draft.horario.msgFora);
        toggleField('filaForaHorario', draft.horario.msgFora === 'direcionar');
        const filaFora = document.getElementById('filaForaSelect');
        if (filaFora) filaFora.value = draft.horario.filaFora || '';
    }

    // Passo 4 — Configurações
    if (draft.config) {
        const c = draft.config;
        const setVal = (id, v) => { const el = document.getElementById(id); if (el && v !== '' && v != null) el.value = v; };

        setRadio('tempo_bot', c.tempoBotMode);
        toggleField('tempoBotCustom', c.tempoBotMode === 'alterar');
        setVal('tempoBotInput', c.tempoBot);
        setRadio('tempo_bot_acao', c.tempoBotAcao);
        toggleField('tempoBotFilaWrap', c.tempoBotAcao === 'direcionar');
        setVal('tempoBotFila', c.tempoBotFila);

        setRadio('sem_interacao', c.semInteracaoMode);
        toggleField('semInteracaoCustom', c.semInteracaoMode === 'alterar');
        toggleField('semInteracaoMsgWrap', c.semInteracaoMode !== 'nao_encerrar');
        setVal('semInteracaoInput', c.semInteracaoMin);

        setRadio('tentativas_mode', c.tentativasMode);
        toggleField('tentativasCustom', c.tentativasMode === 'alterar');
        setVal('tentativasInput', c.tentativas);
        setVal('tentativasFila', c.tentativasFila);

        // Mensagens automáticas: modo + texto + prévia atualizada
        if (c.mensagens) {
            MENSAGENS_PADRAO.forEach(cfg => {
                const saved = c.mensagens[cfg.id];
                if (!saved) return;
                setRadio(`mode_${cfg.id}`, saved.mode);
                setVal(cfg.id, saved.texto);
                updateMsgPreview(cfg.id);
            });
        }

        // Respostas rápidas — reaplica o vínculo com o chip de sugestão (se veio de uma)
        // para o chip continuar desabilitado e não permitir duplicar a mesma sugestão.
        if (Array.isArray(c.respostasRapidas)) {
            c.respostasRapidas.forEach(r => {
                const tr = addRespostaRow(r.titulo, r.texto, false);
                if (r.sugestaoIdx != null) {
                    tr.dataset.sugestaoIdx = String(r.sugestaoIdx);
                    const chip = document.querySelector(`.sugestao-chip[data-sugestao-idx="${r.sugestaoIdx}"]`);
                    if (chip) chip.disabled = true;
                }
            });
        }
    }

    // Passo 5 — Números
    if (draft.numeros) {
        const numero = document.getElementById('numeroPrincipal');
        if (numero) numero.value = draft.numeros.principal || '';
        setRadio('numeroAtivo', draft.numeros.ativo);
        setRadio('ura', draft.numeros.ura);
        const uraResp = document.getElementById('uraResponsavel');
        if (uraResp) uraResp.value = draft.numeros.uraResponsavel || '';
        toggleField('uraResponsavelWrap', draft.numeros.ura === 'sim');
    }

    // Passo 6 — API Oficial (triagem do ambiente Meta)
    if (draft.metaTriagem) {
        const mt = draft.metaTriagem;
        setRadio('metaRedes', mt.redesSociais);
        const gestor = document.getElementById('metaGestor');
        if (gestor) gestor.value = mt.redesGestor || '';
        setRadio('metaBusinessSuite', mt.businessSuite);
        setRadio('metaVerificacao', mt.verificacao);

        metaConviteEnviado = !!mt.conviteEnviado;
        metaContatoSolicitado = !!mt.contatoSolicitado;
        if (metaConviteEnviado) {
            const btn = document.getElementById('metaConviteBtn');
            if (btn) { btn.disabled = true; btn.textContent = 'Convite marcado como enviado ✔'; }
            toggleField('metaConviteConfirm', true);
        }
        if (metaContatoSolicitado) {
            const btn = document.getElementById('metaFalarBtn');
            if (btn) btn.disabled = true;
            toggleField('metaFalarConfirm', true);
        }
        metaTriagemEvaluate();
    }

    // Passo 7 — Templates
    if (draft.templates && Array.isArray(draft.templates.itens)) {
        templatesState = draft.templates.itens;
        renderTemplates();
    }

    // Passo 9 — BOT
    if (draft.bot) {
        const msg = document.getElementById('botMensagemInicial');
        if (msg && draft.bot.mensagemInicial) msg.value = draft.bot.mensagemInicial;
        if (Array.isArray(draft.bot.opcoes) && draft.bot.opcoes.length) {
            ensureRowCount(document.getElementById('botOpcoesTableBody'), draft.bot.opcoes.length, addBotOpcao);
            updateFilasDropdowns();
            document.querySelectorAll('#botOpcoesTableBody tr').forEach((tr, i) => {
                const data = draft.bot.opcoes[i];
                if (!data) return;
                tr.querySelector('.opcao-texto').value = data.texto || '';
                tr.querySelector('.opcao-fila').value = data.fila || '';
            });
            renumberBotOpcoes();
        }
    }

    // Etapas já concluídas voltam a contar no progresso
    if (Array.isArray(draft.completedSteps)) {
        draft.completedSteps.forEach(s => completedSteps.add(s));
    }

    return true;
}

/* ========================= Inicialização ========================= */
/* ========================= Passo 4 — Sub-passos e Prévia em Tempo Real ========================= */

let cfg4CurrentSub = 1;
let cfg4PreviewId = null;

const CFG4_TIPS = {
    1: 'Sub 1 — tempos do menu: nenhuma mensagem para prévia.',
    2: 'Sub 2 — a mensagem de encerramento por abandono é exibida ao cliente.',
    3: 'Sub 3 — a mensagem de tentativas excedidas é exibida ao cliente.',
    4: 'Sub 4 — clique em qualquer mensagem abaixo para ver e editar em tempo real.',
    5: 'Sub 5 — atalhos dos agentes (não são exibidos ao cliente).',
};

const CFG4_CONTEXT = {
    1: '⏱ Configuração de tempo — sem mensagem ao cliente',
    2: '💬 Mensagem enviada quando o cliente para de responder',
    3: '⚠️ Mensagem enviada ao exceder o limite de tentativas',
    4: '💬 Clique em uma mensagem abaixo para ver a prévia',
    5: '⚡ Atalhos internos dos agentes — não exibidos ao cliente',
};

function cfg4UpdateClock() {
    const el = document.getElementById('cfg4WaTime');
    if (!el) return;
    const now = new Date();
    el.textContent = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
}

function cfg4GoSub(sub) {
    if (sub < 1 || sub > 5) return;
    cfg4CurrentSub = sub;

    document.querySelectorAll('.cfg4-nav-item').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.getAttribute('data-sub')) === sub);
    });
    document.querySelectorAll('.cfg4-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById(`cfg4-sub${sub}`);
    if (panel) panel.classList.add('active');

    const ctx = document.getElementById('cfg4PreviewContext');
    if (ctx) ctx.textContent = CFG4_CONTEXT[sub] || '';
    const tip = document.getElementById('cfg4PreviewTip');
    if (tip) tip.textContent = CFG4_TIPS[sub] || '';

    if (sub === 2) cfg4ShowPreview('msgSemInteracao');
    else if (sub === 3) cfg4ShowPreview('msgTentativas');
    else if (sub !== 4) cfg4ClearPreview();
    else if (!cfg4PreviewId) cfg4ClearPreview();
}

function cfg4Next(sub) {
    const navItem = document.querySelector(`.cfg4-nav-item[data-sub="${sub}"]`);
    if (navItem) {
        navItem.classList.add('done');
        const icon = navItem.querySelector('.cfg4-done');
        if (icon) icon.classList.remove('hidden');
    }
    if (sub < 5) cfg4GoSub(sub + 1);
}

function cfg4ShowPreview(id, textoOverride) {
    cfg4PreviewId = id;
    const bubble = document.getElementById('cfg4WaBubble');
    const empty  = document.getElementById('cfg4WaEmpty');
    const textEl = document.getElementById('cfg4WaText');
    if (!bubble || !empty || !textEl) return;

    let texto = textoOverride;
    if (texto === undefined) {
        const cfg = MENSAGENS_PADRAO.find(m => m.id === id);
        if (!cfg) { cfg4ClearPreview(); return; }
        const modeEl = document.querySelector(`input[name="mode_${id}"]:checked`);
        const isCustom = modeEl && modeEl.value === 'custom';
        const ta = document.getElementById(id);
        texto = isCustom && ta ? ta.value : cfg.texto;
    }

    textEl.innerHTML = formatWhatsPreview(texto);
    cfg4UpdateClock();
    bubble.classList.remove('hidden');
    empty.classList.add('hidden');

    const screen = document.getElementById('cfg4WaScreen');
    if (screen) setTimeout(() => { screen.scrollTop = screen.scrollHeight; }, 50);
}

function cfg4ClearPreview() {
    cfg4PreviewId = null;
    const bubble = document.getElementById('cfg4WaBubble');
    const empty  = document.getElementById('cfg4WaEmpty');
    if (bubble) bubble.classList.add('hidden');
    if (empty)  empty.classList.remove('hidden');
}

function cfg4InitInteractions() {
    document.querySelectorAll('.cfg4-nav-item').forEach(btn => {
        btn.addEventListener('click', () => cfg4GoSub(parseInt(btn.getAttribute('data-sub'))));
    });

    document.querySelectorAll('input[name="tempo_bot"]').forEach(r => {
        r.addEventListener('change', () => {
            const w = document.getElementById('tempoBotCustom');
            if (w) w.classList.toggle('hidden', r.value !== 'alterar');
        });
    });
    document.querySelectorAll('input[name="tempo_bot_acao"]').forEach(r => {
        r.addEventListener('change', () => {
            const w = document.getElementById('tempoBotFilaWrap');
            if (w) w.classList.toggle('hidden', r.value !== 'direcionar');
            if (typeof checkConfigCascade === 'function') checkConfigCascade();
        });
    });
    document.querySelectorAll('input[name="sem_interacao"]').forEach(r => {
        r.addEventListener('change', () => {
            const w = document.getElementById('semInteracaoCustom');
            if (w) w.classList.toggle('hidden', r.value !== 'alterar');
        });
    });
    document.querySelectorAll('input[name="tentativas_mode"]').forEach(r => {
        r.addEventListener('change', () => {
            const w = document.getElementById('tentativasCustom');
            if (w) w.classList.toggle('hidden', r.value !== 'alterar');
        });
    });

    const form = document.getElementById('cfg4Form');
    if (form) {
        form.addEventListener('click', (e) => {
            const item = e.target.closest('#cfg4-sub4 .msg-item');
            if (!item) return;
            const id = item.getAttribute('data-msg-id');
            if (!id) return;
            document.querySelectorAll('#cfg4-sub4 .msg-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            cfg4ShowPreview(id);
        });
        form.addEventListener('input', (e) => {
            if (!e.target.classList.contains('msg-custom')) return;
            const item = e.target.closest('.msg-item');
            if (!item) return;
            const id = item.getAttribute('data-msg-id');
            if (id) cfg4ShowPreview(id, e.target.value);
        });
        form.addEventListener('change', (e) => {
            const t = e.target;
            if (t.name && t.name.startsWith('mode_')) {
                const id = t.name.replace('mode_', '');
                const item = document.querySelector(`.msg-item[data-msg-id="${id}"]`);
                if (!item) return;
                const ta = item.querySelector('.msg-custom');
                if (ta) ta.classList.toggle('hidden', t.value !== 'custom');
                cfg4ShowPreview(id);
            }
        });
    }

    document.querySelectorAll('input[name="sem_interacao"], input[name="tentativas_mode"]').forEach(r => {
        r.addEventListener('change', () => {
            if (cfg4CurrentSub === 2) cfg4ShowPreview('msgSemInteracao');
            if (cfg4CurrentSub === 3) cfg4ShowPreview('msgTentativas');
        });
    });

    cfg4UpdateClock();
    cfg4GoSub(1);
}

/* ========================= Passo 4: Accordion ========================= */
function setupConfigAccordion() {
    document.querySelectorAll('.config-group-title').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.closest('.config-group');
            const isOpen = section.classList.toggle('is-open');
            btn.setAttribute('aria-expanded', String(isOpen));
        });
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    // Login é obrigatório: sem sessão válida, requireAuth já redireciona para login.html
    // e a página (oculta desde o <head>) nunca chega a ser revelada.
    const authUser = await requireAuth();
    if (!authUser) return;
    currentUserId = authUser.id;

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) btnLogout.addEventListener('click', logout);

    // Menu "⋮" do cabeçalho: agrupa as ações menos usadas (ADM, trocar tipo,
    // sair, excluir dados) pra não disputar espaço com o título da página.
    const headerMenu = document.getElementById('headerMenu');
    const headerMenuTrigger = document.getElementById('headerMenuTrigger');
    const headerMenuPanel = document.getElementById('headerMenuPanel');
    if (headerMenu && headerMenuTrigger && headerMenuPanel) {
        const closeHeaderMenu = () => {
            headerMenuPanel.classList.add('hidden');
            headerMenuTrigger.setAttribute('aria-expanded', 'false');
        };
        headerMenuTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const opening = headerMenuPanel.classList.contains('hidden');
            headerMenuPanel.classList.toggle('hidden', !opening);
            headerMenuTrigger.setAttribute('aria-expanded', String(opening));
        });
        headerMenuPanel.addEventListener('click', (e) => {
            if (e.target.closest('.header-menu-item')) closeHeaderMenu();
        });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#headerMenu')) closeHeaderMenu();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeHeaderMenu();
        });
    }

    initOnboardingGate(authUser);

    // Busca o rascunho atual no backend (a sessão já garante que é só o do usuário logado)
    await initApiSync();

    // Sincroniza o botão de tema com o tema já aplicado (definido no <head> antes do carregamento)
    const activeTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(activeTheme);
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

    // Componentes do Passo 4 precisam existir ANTES de restaurar o rascunho
    renderMensagensPadrao();
    renderSugestaoChips();
    setupStep4Interactions();
    setupConfigAccordion();
    cfg4InitInteractions(); // sub-passos + prévia em tempo real
    setupMetaTriagemStep(); // Passo 6 — listeners dos radios/botões da triagem Meta
    setupTemplatesStep(); // Passo 7 — precisa existir antes de restoreDraft popular templatesState
    document.getElementById('addRespostaBtn').addEventListener('click', () => addRespostaRow());
    document.getElementById('respostasTableBody').addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-delete');
        if (btn) removeRespostaRow(btn.closest('tr'));
    });

    // Seletor visual de horários do Passo 3 também precisa existir antes de restaurar o rascunho
    renderScheduleDays(defaultScheduleState());
    setupScheduleInteractions();

    // Restaura rascunho ANTES de exibir a etapa (para o progresso e os campos já virem certos)
    const restored = restoreDraft();

    // Cascata do Passo 4: precisa ser chamada APÓS restoreDraft para ler os radios restaurados

    const savedStep = localStorage.getItem(STORAGE.STEP);
    if (savedStep) currentStep = Math.min(totalSteps, Math.max(1, parseInt(savedStep, 10) || 1));

    showStep(currentStep);
    if (restored) showToast('Rascunho anterior restaurado. Continue de onde parou!', 'success');

    // Campo condicional do Passo 3: qual fila recebe contatos fora do horário
    document.querySelectorAll('input[name="msg_fora"]').forEach(radio => {
        radio.addEventListener('change', () => toggleField('filaForaHorario', radio.value === 'direcionar' && radio.checked));
    });

    // Campo condicional do Passo 5: contato do responsável só aparece quando há URA
    document.querySelectorAll('input[name="ura"]').forEach(radio => {
        radio.addEventListener('change', () => toggleField('uraResponsavelWrap', radio.value === 'sim' && radio.checked));
    });
    setupNumeroPrincipalValidation();

    // Delegação de eventos: um listener por tabela cobre todas as linhas, atuais e futuras
    document.getElementById('filasTableBody').addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-delete');
        if (btn) removeRow(btn);
    });
    document.getElementById('agentesTableBody').addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-delete');
        if (btn) removeRow(btn);
    });
    document.getElementById('botOpcoesTableBody').addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-delete');
        if (btn) removeBotOpcao(btn);
    });

    // Salvamento automático: qualquer digitação/alteração agenda um save silencioso
    const form = document.getElementById('onboardingForm');
    form.addEventListener('input', scheduleDraftSave);
    form.addEventListener('change', scheduleDraftSave);
    document.getElementById('btnSaveDraft').addEventListener('click', saveDraft);
    document.getElementById('btnReset').addEventListener('click', resetAllData);

    // Accordion do Passo 4: título abre/fecha o grupo (sem travas, sem rolagem forçada)
    document.querySelectorAll('#step4 .config-group-title').forEach(btn => {
        btn.addEventListener('click', () => {
            const group = btn.closest('.config-group');
            const open = group.classList.toggle('is-open');
            btn.setAttribute('aria-expanded', String(open));
        });
    });

    // Jadibô compacto: clique no ícone abre o painel; "Próxima dica" cicla as dicas da etapa
    const jadiboTrigger = document.getElementById('jadiboTrigger');
    if (jadiboTrigger) jadiboTrigger.addEventListener('click', (e) => { e.stopPropagation(); jadiboTogglePanel(); });
    const jadiboNextBtn = document.getElementById('jadiboNext');
    if (jadiboNextBtn) jadiboNextBtn.addEventListener('click', jadiboNextTip);
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#jadiboWrap')) jadiboTogglePanel(true);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') jadiboTogglePanel(true);
    });

    // ── Sidebar: recolher/expandir manualmente (botão), sem auto-colapso por hover ──
    const sidebar   = document.getElementById('sidebar') || document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const bottomNav   = document.querySelector('.bottom-nav');
    const SIDEBAR_COLLAPSED_KEY = 'ipsolution_sidebar_collapsed';

    function syncBottomNav() {
        const w = sidebar && sidebar.classList.contains('collapsed') ? 64 : 260;
        if (bottomNav) bottomNav.style.left = w + 'px';
        if (mainContent) mainContent.style.marginLeft = w + 'px';
    }

    function setSidebarCollapsed(collapsed) {
        if (!sidebar) return;
        sidebar.classList.toggle('collapsed', collapsed);
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
        syncBottomNav();
    }

    if (sidebar && localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1') {
        sidebar.classList.add('collapsed');
    }
    syncBottomNav();

    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', () => {
            setSidebarCollapsed(!sidebar.classList.contains('collapsed'));
        });
    }

    document.getElementById('filasTableBody').addEventListener('input', function (e) {
        if (e.target.classList.contains('fila-nome')) {
            updateFilasDropdowns();
        }
    });

    // Nomes de agentes também influenciam o fluxo do BOT (lista de agentes por fila)
    const agentesTableBody = document.getElementById('agentesTableBody');
    if (agentesTableBody) {
        agentesTableBody.addEventListener('input', () => renderFlowPreview());
        agentesTableBody.addEventListener('change', () => renderFlowPreview());
    }

    // Opções do menu do BOT (Passo 9)
    const botOpcoesTableBody = document.getElementById('botOpcoesTableBody');
    if (botOpcoesTableBody) {
        botOpcoesTableBody.addEventListener('input', () => renderFlowPreview());
        botOpcoesTableBody.addEventListener('change', () => renderFlowPreview());
    }
    const botMensagemInicial = document.getElementById('botMensagemInicial');
    if (botMensagemInicial) botMensagemInicial.addEventListener('input', () => renderFlowPreview());

    // "Fora do horário" (Passo 3) também alimenta o resumo do fluxo do BOT
    // (o próprio seletor de horários já atualiza a prévia a cada alteração — ver setupScheduleInteractions)
    document.querySelectorAll('input[name="msg_fora"]').forEach(radio => {
        radio.addEventListener('change', () => renderFlowPreview());
    });
    const filaUnicaSelect = document.getElementById('filaForaSelect');
    if (filaUnicaSelect) filaUnicaSelect.addEventListener('change', () => renderFlowPreview());

    updateFilasDropdowns();

    // Navegação por passos: acessível também via teclado (Enter/Espaço)
    function makeStepNavigable(el) {
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'button');
        const go = () => {
            currentStep = parseInt(el.getAttribute('data-step'));
            showStep(currentStep);
        };
        el.addEventListener('click', go);
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
        });
    }
    document.querySelectorAll('.sidebar-menu li').forEach(makeStepNavigable);
    setupSidebarTooltips();

    // Anexos: seleção via clique
    const attachInput = document.getElementById('attachInput');
    if (attachInput) {
        attachInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                addAttachments(currentStep, e.target.files);
                attachInput.value = '';
            }
        });
    }

    // Anexos: arrastar e soltar
    const dropzone = document.querySelector('.attach-dropzone');
    if (dropzone) {
        ['dragenter', 'dragover'].forEach(evt => {
            dropzone.addEventListener(evt, (e) => {
                e.preventDefault();
                dropzone.classList.add('dragover');
            });
        });
        ['dragleave', 'drop'].forEach(evt => {
            dropzone.addEventListener(evt, (e) => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
            });
        });
        dropzone.addEventListener('drop', (e) => {
            if (e.dataTransfer.files.length > 0) {
                addAttachments(currentStep, e.dataTransfer.files);
            }
        });
    }

    // Fecha os dropdowns de multi-select ao clicar fora
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.multi-select')) closeAllMultiSelects();
    });
});

/* ==============================================================
   Editor de Fluxo EMBUTIDO no Passo 9 (motor: Drawflow via CDN)
   Lê filas/agentes/horários/mensagem direto do formulário (mesma página).
   ============================================================== */

(function () {
    'use strict';

    const IFE_GRAPH_KEY = 'ipsolution_flow_v2';
    const VALID_NODE_TYPES = new Set(['inicio', 'mensagem', 'entrada', 'menu', 'condicao', 'aguardar', 'transferir', 'encerrar']);
    const NODE_LABELS = {
        inicio: 'Início', mensagem: 'Mensagem', entrada: 'Entrada', menu: 'Menu',
        condicao: 'Condição de horário', aguardar: 'Aguardar',
        transferir: 'Transferir para fila', encerrar: 'Encerrar atendimento'
    };
    const PALETTE = [
        { type: 'menu',       icon: 'fa-solid fa-list',            label: 'Menu',       color: '#d97706' },
        { type: 'mensagem',   icon: 'fa-solid fa-comment-dots',    label: 'Mensagem',   color: '#0891b2' },
        { type: 'entrada',    icon: 'fa-solid fa-keyboard',        label: 'Entrada',    color: '#059669' },
        { type: 'condicao',   icon: 'fa-solid fa-code-branch',     label: 'Condição',   color: '#7c3aed' },
        { type: 'aguardar',   icon: 'fa-solid fa-hourglass-half',  label: 'Aguardar',   color: '#6d28d9' },
        { type: 'transferir', icon: 'fa-solid fa-people-arrows',   label: 'Transferir', color: '#047857' },
        { type: 'encerrar',   icon: 'fa-solid fa-circle-xmark',   label: 'Encerrar',   color: '#dc2626' },
    ];

    let editor = null;
    let inicioId = null;
    let inited = false;

    /* ---------- Dados vivos do formulário (mesma página!) ---------- */
    function filasDoForm() {
        return Array.from(document.querySelectorAll('.fila-nome'))
            .map(i => i.value.trim()).filter(Boolean);
    }
    function dadosVivos() {
        const { horarioTexto, destinoFora } = getHorarioResumo();
        return {
            filas: filasDoForm(),
            agentesPorFila: getFilaAgentesMap(),
            mensagemInicial: (document.getElementById('botMensagemInicial') || {}).value || '',
            horarioTexto, destinoFora
        };
    }

    /* ---------- HTML dos nós — design moderno com cabeçalho colorido ---------- */
    const NODE_META = {
        inicio:     { icon: 'fa-solid fa-play',           label: 'Início',             color: '#2563eb', bg: '#eff6ff' },
        mensagem:   { icon: 'fa-solid fa-comment-dots',   label: 'Mensagem',           color: '#0891b2', bg: '#ecfeff' },
        entrada:    { icon: 'fa-solid fa-keyboard',       label: 'Entrada do cliente', color: '#059669', bg: '#ecfdf5' },
        menu:       { icon: 'fa-solid fa-list',           label: 'Menu de opções',     color: '#d97706', bg: '#fffbeb' },
        condicao:   { icon: 'fa-solid fa-code-branch',    label: 'Condição',           color: '#7c3aed', bg: '#f5f3ff' },
        aguardar:   { icon: 'fa-solid fa-hourglass-half', label: 'Aguardar',           color: '#6d28d9', bg: '#f5f3ff' },
        transferir: { icon: 'fa-solid fa-people-arrows',  label: 'Transferir para fila', color: '#047857', bg: '#ecfdf5' },
        encerrar:   { icon: 'fa-solid fa-circle-xmark',  label: 'Encerrar',           color: '#dc2626', bg: '#fef2f2' },
    };

    function headerHtml(type, extraBadge) {
        const m = NODE_META[type] || { icon: 'fa-solid fa-circle', label: type, color: '#64748b', bg: '#f8fafc' };
        return `<div class="node-header" style="background:${m.bg};border-bottom:2px solid ${m.color}20;">
            <span class="node-hbadge" style="background:${m.color};"><i class="${m.icon}"></i></span>
            <span class="node-htitle" style="color:${m.color};">${m.label}</span>
            ${extraBadge || ''}
        </div>`;
    }

    function menuRowHtml(i, v) {
        return `<div class="menu-row">
            <span class="menu-num" style="background:${NODE_META.menu.color};">${i + 1}</span>
            <input type="text" class="menu-opt-input" data-idx="${i}" placeholder="Ex: Comercial" value="${escapeHtml(v || '')}">
            <i class="fa-solid fa-arrow-right menu-row-arrow"></i>
        </div>`;
    }

    function htmlMenu(options) {
        const rows = (options || ['']).map((op, i) => menuRowHtml(i, op)).join('');
        return `${headerHtml('menu')}
        <div class="node-body">
            <label class="node-field-label"><i class="fa-regular fa-comment"></i> Mensagem ao cliente</label>
            <textarea df-texto placeholder="Olá! Digite o número da opção desejada:" class="node-textarea"></textarea>
            <label class="node-field-label" style="margin-top:10px;"><i class="fa-solid fa-list-ol"></i> Opções → cada uma tem uma saída</label>
            <div class="menu-rows">${rows}</div>
            <div class="menu-actions">
                <button type="button" class="menu-add"><i class="fa-solid fa-plus"></i> opção</button>
                <button type="button" class="menu-del"><i class="fa-solid fa-minus"></i> última</button>
            </div>
        </div>`;
    }

    function agentesHtml(fila) {
        const d = dadosVivos();
        const ag = (d.agentesPorFila && d.agentesPorFila[fila]) || [];
        if (!fila) return `<div class="node-hint"><i class="fa-solid fa-triangle-exclamation"></i> Escolha uma fila acima</div>`;
        return ag.length
            ? `<div class="node-agents">${ag.map(a => `<span class="node-agent-chip"><i class="fa-solid fa-user"></i>${escapeHtml(a)}</span>`).join('')}</div>`
            : `<div class="node-hint node-hint-warn"><i class="fa-solid fa-user-slash"></i> Nenhum agente vinculado</div>`;
    }

    function filaOptionsHtml(sel) {
        return '<option value="">Selecione a fila…</option>' + filasDoForm()
            .map(f => `<option value="${escapeHtml(f)}" ${f === sel ? 'selected' : ''}>${escapeHtml(f)}</option>`).join('');
    }

    function htmlPorTipo(type, preset) {
        const d = dadosVivos();
        switch (type) {
            case 'inicio':
                return `${headerHtml('inicio', '<span class="node-badge-pill">Gatilho</span>')}
                <div class="node-body node-body-center">
                    <i class="fa-brands fa-whatsapp node-big-icon"></i>
                    <p class="node-desc">Cliente envia a <strong>primeira mensagem</strong> no WhatsApp</p>
                </div>`;
            case 'mensagem':
                return `${headerHtml('mensagem')}
                <div class="node-body">
                    <label class="node-field-label"><i class="fa-regular fa-pen-to-square"></i> Texto da mensagem</label>
                    <textarea df-texto placeholder="Olá! Como posso ajudar?" class="node-textarea"></textarea>
                </div>`;
            case 'entrada':
                return `${headerHtml('entrada')}
                <div class="node-body">
                    <label class="node-field-label"><i class="fa-solid fa-question"></i> Pergunta ao cliente</label>
                    <textarea df-pergunta placeholder="Ex: Qual o seu nome completo?" class="node-textarea"></textarea>
                    <div class="node-hint"><i class="fa-solid fa-reply"></i> Aguarda a resposta antes de continuar</div>
                </div>`;
            case 'menu': return htmlMenu(preset && preset.options);
            case 'condicao':
                return `${headerHtml('condicao')}
                <div class="node-body">
                    <div class="node-hint node-hint-info"><i class="fa-solid fa-clock"></i> ${escapeHtml(d.horarioTexto || 'Horário não definido (Passo 3)')}</div>
                    <div class="cond-row cond-ok"><i class="fa-solid fa-check-circle"></i> Dentro do horário</div>
                    <div class="cond-row cond-no"><i class="fa-solid fa-times-circle"></i> Fora do horário</div>
                </div>`;
            case 'aguardar':
                return `${headerHtml('aguardar')}
                <div class="node-body">
                    <label class="node-field-label"><i class="fa-regular fa-clock"></i> Tempo de espera</label>
                    <div class="field-suffix">
                        <input type="number" min="1" df-minutos class="node-input-num" placeholder="5">
                        <span class="suffix-label">minutos</span>
                    </div>
                </div>`;
            case 'transferir':
                return `${headerHtml('transferir')}
                <div class="node-body">
                    <label class="node-field-label"><i class="fa-solid fa-layer-group"></i> Fila de destino</label>
                    <select class="transferir-fila node-select">${filaOptionsHtml(preset && preset.fila)}</select>
                    <div class="node-agents-wrap">${agentesHtml(preset && preset.fila)}</div>
                </div>`;
            case 'encerrar':
                return `${headerHtml('encerrar')}
                <div class="node-body node-body-center">
                    <i class="fa-solid fa-flag-checkered node-big-icon" style="color:#dc2626;"></i>
                    <p class="node-desc">Envia mensagem de <strong>encerramento</strong> e finaliza o atendimento</p>
                </div>`;
        }
        return '';
    }

    function addNode(type, x, y, preset = {}) {
        let id = null;
        const d = dadosVivos();
        switch (type) {
            case 'inicio':
                id = editor.addNode('inicio', 0, 1, x, y, 'node-inicio', {}, htmlPorTipo('inicio'));
                inicioId = id; break;
            case 'mensagem':
                id = editor.addNode('mensagem', 1, 1, x, y, 'node-mensagem', { texto: preset.texto || '' }, htmlPorTipo('mensagem')); break;
            case 'entrada':
                id = editor.addNode('entrada', 1, 1, x, y, 'node-entrada', { pergunta: '' }, htmlPorTipo('entrada')); break;
            case 'menu': {
                const options = preset.options && preset.options.length ? preset.options : [''];
                id = editor.addNode('menu', 1, options.length, x, y, 'node-menu', { texto: preset.texto || '', options }, htmlPorTipo('menu', { options })); break;
            }
            case 'condicao':
                id = editor.addNode('condicao', 1, 2, x, y, 'node-condicao', {}, htmlPorTipo('condicao')); break;
            case 'aguardar':
                id = editor.addNode('aguardar', 1, 1, x, y, 'node-aguardar', { minutos: 5 }, htmlPorTipo('aguardar')); break;
            case 'transferir':
                id = editor.addNode('transferir', 1, 0, x, y, 'node-transferir', { fila: preset.fila || '' }, htmlPorTipo('transferir', preset)); break;
            case 'encerrar':
                id = editor.addNode('encerrar', 1, 0, x, y, 'node-encerrar', {}, htmlPorTipo('encerrar')); break;
        }
        scheduleIfeSave();
        return id;
    }

    function exportData() {
        const raw = editor.export();
        return (raw && raw.drawflow && raw.drawflow.Home && raw.drawflow.Home.data) || {};
    }
    function nextPos() {
        const n = Object.keys(exportData()).length;
        return { x: 60 + (n % 3) * 320, y: 60 + Math.floor(n / 3) * 200 };
    }

    /* ---------- Persistência (localStorage + API) ---------- */
    function ifeSaveNow() {
        const graph = editor.export();
        try { localStorage.setItem(IFE_GRAPH_KEY, JSON.stringify(graph)); } catch (e) { /* sem storage */ }
        if (apiCtx.available && apiCtx.submissionId) {
            fetch(`/api/submissions/${apiCtx.submissionId}/flow`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ flowData: graph })
            }).catch(() => { /* falha transitória: localStorage cobre */ });
        }
        ifeValidate();
        renderFilasList();
    }
    const scheduleIfeSave = debounce(ifeSaveNow, 800);

    function graphOk(graph) {
        const data = graph && graph.drawflow && graph.drawflow.Home && graph.drawflow.Home.data;
        if (!data || Object.keys(data).length === 0) return false;
        return Object.values(data).every(n => VALID_NODE_TYPES.has(n.name));
    }

    function starterTemplate() {
        const d = dadosVivos();
        const i = addNode('inicio', 40, 120);
        const m = addNode('menu', 340, 40, { texto: d.mensagemInicial || 'Olá! Digite o número da opção desejada:', options: [''] });
        editor.addConnection(i, m, 'output_1', 'input_1');
    }

    function rebuildDynamic() {
        Object.values(exportData()).forEach(n => {
            const el = document.getElementById(`node-${n.id}`);
            if (!el) return;
            if (n.name === 'menu') {
                const wrap = el.querySelector('.menu-rows');
                if (wrap) wrap.innerHTML = (n.data.options || ['']).map((op, i) => menuRowHtml(i, op)).join('');
            }
            if (n.name === 'transferir') {
                const sel = el.querySelector('.transferir-fila');
                const wrap = el.querySelector('.node-agents-wrap');
                if (sel) sel.innerHTML = filaOptionsHtml(n.data.fila || '');
                if (wrap) wrap.innerHTML = agentesHtml(n.data.fila || '');
            }
            if (n.name === 'condicao') {
                const exp = el.querySelector('.h-exp');
                if (exp) exp.textContent = dadosVivos().horarioTexto || 'não definido';
            }
        });
    }

    function loadGraph() {
        let graph = null, migrated = false;
        try {
            const raw = localStorage.getItem(IFE_GRAPH_KEY);
            if (raw) {
                const g = JSON.parse(raw);
                if (graphOk(g)) graph = g; else migrated = true;
            }
        } catch (e) { /* recomeça */ }
        if (graph) {
            editor.import(graph);
            rebuildDynamic();
            const ini = Object.values(exportData()).find(n => n.name === 'inicio');
            inicioId = ini ? ini.id : addNode('inicio', 40, 120);
        } else {
            starterTemplate();
            if (migrated) showToast('Fluxo antigo arquivado — começamos do modelo novo.', 'info');
        }
    }

    /* ---------- Paleta e lista de filas ---------- */
    function renderPalette() {
        const nav = document.getElementById('ifePalette');
        if (!nav || nav.children.length) return;
        PALETTE.forEach(p => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ife-action';
        btn.innerHTML = `
            <span class="ife-action-dot" style="background:${p.color};"></span>
            <i class="${p.icon} ife-action-icon" style="color:${p.color};"></i>
            <span class="ife-action-label">${p.label}</span>`;
            btn.title = NODE_LABELS[p.type];
            btn.addEventListener('click', () => {
                const pos = nextPos();
                addNode(p.type, pos.x, pos.y);
            });
            nav.appendChild(btn);
        });
    }

    function renderFilasList() {
        const list = document.getElementById('ifeFilasList');
        const hint = document.getElementById('ifeFilasHint');
        const count = document.getElementById('ifeFilasCount');
        if (!list) return;
        const filas = filasDoForm();
        count.textContent = filas.length;
        hint.classList.toggle('hidden', filas.length > 0);
        list.innerHTML = '';
        const d = dadosVivos();
        filas.forEach(f => {
            const ag = (d.agentesPorFila[f] || []);
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'ife-fila-item';
            item.innerHTML = `<strong>📥 ${escapeHtml(f)}</strong><span>${ag.length ? escapeHtml(ag.join(', ')) : 'sem agente'}</span>`;
            item.title = `Criar bloco "Transferir → ${f}"`;
            item.addEventListener('click', () => {
                const pos = nextPos();
                addNode('transferir', pos.x, pos.y, { fila: f });
            });
            list.appendChild(item);
        });
    }

    /* ---------- Validações compactas ---------- */
    function outConns(n, oc) { return (n.outputs && n.outputs[oc] && n.outputs[oc].connections) || []; }
    function hasIn(n) { return ((n.inputs && n.inputs.input_1 && n.inputs.input_1.connections) || []).length > 0; }

    function ifeValidate() {
        const box = document.getElementById('ifeValidation');
        if (!box) return;
        const nodes = Object.values(exportData());
        const issues = [];
        const ini = nodes.find(n => n.name === 'inicio');
        if (ini && nodes.length > 1 && outConns(ini, 'output_1').length === 0) issues.push('Início sem conexão.');
        nodes.forEach(n => {
            if (n.name !== 'inicio' && !hasIn(n)) issues.push(`"${NODE_LABELS[n.name] || 'Bloco'}" desconectado.`);
            if (n.name === 'menu') {
                (n.data.options || []).forEach((op, i) => {
                    if (!op || !op.trim()) issues.push(`Opção ${i + 1} do Menu sem texto.`);
                    if (outConns(n, `output_${i + 1}`).length === 0) issues.push(`Opção ${i + 1} do Menu sem destino.`);
                });
            }
            if (n.name === 'transferir' && !n.data.fila) issues.push('Transferir sem fila.');
        });
        if (issues.length === 0) {
            box.className = 'ife-validation ok';
            box.textContent = nodes.length > 1 ? '✓ Fluxo consistente' : 'Adicione ações pela paleta';
        } else {
            box.className = 'ife-validation warn';
            box.textContent = `⚠ ${issues.length} ponto(s): ${issues.slice(0, 2).join(' ')}${issues.length > 2 ? '…' : ''}`;
            box.title = issues.join('\n');
        }
    }

    /* ---------- Resumo ---------- */
    function resumoTexto() {
        const nodes = Object.values(exportData());
        const d = dadosVivos();
        const lines = ['FLUXO DO BOT — IP Solution', ''];
        const menus = nodes.filter(n => n.name === 'menu');
        menus.forEach(menu => {
            if (menu.data.texto) lines.push(`Mensagem: "${menu.data.texto}"`);
            (menu.data.options || []).forEach((op, i) => {
                const alvo = outConns(menu, `output_${i + 1}`).map(c => {
                    const t = nodes.find(n => String(n.id) === String(c.node));
                    if (!t) return '?';
                    if (t.name === 'transferir') return `Fila ${t.data.fila || '?'}`;
                    return NODE_LABELS[t.name] || t.name;
                }).join(' + ') || '(sem destino)';
                lines.push(`  ${i + 1}. ${op || '(sem texto)'} → ${alvo}`);
            });
            lines.push('');
        });
        lines.push(`Horário: ${d.horarioTexto}`);
        lines.push(`Fora do horário: ${d.destinoFora}`);
        return lines.join('\n');
    }

    /* ---------- Interações internas dos nós ---------- */
    function nodeIdOf(el) {
        const b = el.closest('.drawflow-node');
        return b ? b.id.replace('node-', '') : null;
    }
    function renumber(el) {
        el.querySelectorAll('.menu-row').forEach((row, i) => {
            row.querySelector('.menu-num').textContent = i + 1;
            row.querySelector('.menu-opt-input').setAttribute('data-idx', i);
        });
    }
    function wireCanvas(container) {
        container.addEventListener('input', (e) => {
            const id = nodeIdOf(e.target);
            if (!id) return;
            if (e.target.classList.contains('menu-opt-input')) {
                const node = editor.getNodeFromId(id);
                const options = (node.data.options || []).slice();
                options[parseInt(e.target.getAttribute('data-idx'), 10)] = e.target.value;
                editor.updateNodeDataFromId(id, { ...node.data, options });
                scheduleIfeSave();
            }
        });
        container.addEventListener('change', (e) => {
            const id = nodeIdOf(e.target);
            if (!id) return;
            if (e.target.classList.contains('transferir-fila')) {
                const node = editor.getNodeFromId(id);
                editor.updateNodeDataFromId(id, { ...node.data, fila: e.target.value });
                const wrap = e.target.closest('.node-body').querySelector('.node-agents-wrap');
                if (wrap) wrap.innerHTML = agentesHtml(e.target.value);
                scheduleIfeSave();
            }
        });
        container.addEventListener('click', (e) => {
            const id = nodeIdOf(e.target);
            if (!id) return;
            const nodeEl = document.getElementById(`node-${id}`);
            if (e.target.classList.contains('menu-add')) {
                const node = editor.getNodeFromId(id);
                const options = (node.data.options || ['']).slice();
                options.push('');
                editor.updateNodeDataFromId(id, { ...node.data, options });
                editor.addNodeOutput(id);
                nodeEl.querySelector('.menu-rows').insertAdjacentHTML('beforeend', menuRowHtml(options.length - 1, ''));
                renumber(nodeEl);
                scheduleIfeSave();
            }
            if (e.target.classList.contains('menu-del')) {
                const node = editor.getNodeFromId(id);
                const options = (node.data.options || ['']).slice();
                if (options.length <= 1) { showToast('O menu precisa de pelo menos uma opção.', 'error'); return; }
                editor.removeNodeOutput(id, `output_${options.length}`);
                options.pop();
                editor.updateNodeDataFromId(id, { ...node.data, options });
                const rows = nodeEl.querySelectorAll('.menu-row');
                rows[rows.length - 1].remove();
                renumber(nodeEl);
                scheduleIfeSave();
            }
        });
    }

    /* ---------- API pública do módulo ---------- */
    window.ifeInit = function () {
        // Atualização leve nas visitas seguintes
        if (inited) { renderFilasList(); rebuildDynamic(); ifeValidate(); return; }

        const canvas = document.getElementById('ifeCanvas');
        if (!canvas) return;

        if (typeof Drawflow === 'undefined') {
            canvas.innerHTML = '<div class="ife-offline">📡 O editor visual precisa de internet para carregar (biblioteca Drawflow). Verifique a conexão e recarregue a página.</div>';
            return;
        }

        editor = new Drawflow(canvas);
        editor.reroute = true;
        editor.zoom_min = 0.3;
        editor.zoom_max = 2;
        editor.start();
        window.__ifeEditor = editor; // gancho de QA

        loadGraph();
        renderPalette();
        renderFilasList();
        ifeValidate();
        wireCanvas(canvas);

        ['nodeCreated', 'nodeMoved', 'nodeDataChanged', 'connectionCreated', 'connectionRemoved'].forEach(evt => {
            editor.on(evt, () => scheduleIfeSave());
        });
        editor.on('nodeRemoved', (id) => {
            if (String(id) === String(inicioId)) {
                showToast('O bloco Início é o gatilho do fluxo — recriado.', 'error');
                addNode('inicio', 40, 120);
            }
            scheduleIfeSave();
        });

        document.getElementById('ifeZoomIn').addEventListener('click', () => editor.zoom_in());
        document.getElementById('ifeZoomOut').addEventListener('click', () => editor.zoom_out());
        document.getElementById('ifeZoomReset').addEventListener('click', () => editor.zoom_reset());
        canvas.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                if (e.deltaY < 0) editor.zoom_in(); else editor.zoom_out();
            }
        }, { passive: false });

        document.getElementById('ifeRefreshBtn').addEventListener('click', () => {
            renderFilasList(); rebuildDynamic(); ifeValidate();
            showToast('Dados do formulário atualizados no editor.', 'success');
        });
        document.getElementById('ifeClearBtn').addEventListener('click', () => {
            if (!confirm('Limpar todos os blocos do fluxo?')) return;
            editor.clearModuleSelected();
            starterTemplate();
            ifeSaveNow();
        });
        document.getElementById('ifeCopyBtn').addEventListener('click', () => {
            const t = resumoTexto();
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(t).then(() => showToast('Resumo do fluxo copiado!', 'success'));
            }
        });

        inited = true;
    };

    /* Reinício total (chamado pelo botão Reiniciar) */
    window.ifeReset = function () {
        if (!inited || !editor) { localStorage.removeItem(IFE_GRAPH_KEY); return; }
        editor.clearModuleSelected();
        starterTemplate();
        ifeSaveNow();
    };

    /* Leitura pelo restante do app (ex.: collectDraft/PDF) — sempre a versão mais atual */
    window.ifeGetFlowSummary = function () { return inited ? resumoTexto() : ''; };
    window.ifeGetFlowNodeCount = function () { return inited ? Object.keys(exportData()).length : 0; };
    window.ifeFlushSave = function () { if (inited) ifeSaveNow(); };
})();