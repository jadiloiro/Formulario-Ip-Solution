let currentStep = 1;
const totalSteps = 7;
const completedSteps = new Set();

/* Chaves de armazenamento centralizadas (evita strings mágicas espalhadas) */
const STORAGE = {
    STEP: 'currentStep',
    THEME: 'theme',
    DRAFT: 'ipsolution_form_draft',
    SHARED: 'ipsolution_shared_flow_data'
};

/* Utilitário: adia a execução até o usuário parar de digitar */
function debounce(fn, wait) {
    let t;
    return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

/* ========================= API (backend NestJS, opcional) =========================
   Se o backend estiver servindo a página, o rascunho ganha backup no servidor
   e o "Finalizar" envia o levantamento de verdade. Sem backend, tudo segue
   funcionando offline com localStorage. */
const apiCtx = { available: false, submissionId: null };

async function initApiSync() {
    if (!location.protocol.startsWith('http')) return;
    try {
        const health = await fetch('/api/health');
        if (!health.ok) return;
        const current = await fetch('/api/submissions/current');
        if (!current.ok) return;
        const submission = await current.json();
        apiCtx.available = true;
        apiCtx.submissionId = submission.id;
    } catch (e) { /* sem backend: modo offline */ }
}

function pushDraftToApi(draft) {
    if (!apiCtx.available || !apiCtx.submissionId) return;
    fetch(`/api/submissions/${apiCtx.submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData: draft })
    }).catch(() => { /* rede falhou: o localStorage continua como cópia local */ });
}

async function finalizeSubmission(draft) {
    if (!apiCtx.available || !apiCtx.submissionId) return false;
    try {
        await fetch(`/api/submissions/${apiCtx.submissionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ formData: draft })
        });
        const res = await fetch(`/api/submissions/${apiCtx.submissionId}/submit`, { method: 'POST' });
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
        conceito: "Importação da lista de contatos (agenda) que a empresa já possui, para facilitar o início dos atendimentos.",
        dicas: [
            "O arquivo deve estar no formato CSV.",
            "Recomendamos começar com uma agenda geral, acessível a toda a equipe.",
            "Nossa equipe pode ajudar a preparar o arquivo se necessário."
        ]
    },
    7: {
        conceito: "O BOT organiza o fluxo de atendimento automático (URA Digital), direcionando o cliente para a fila certa.",
        dicas: [
            "Descreva o fluxo em etapas numeradas (Ex: 1 - Comercial, 2 - Suporte).",
            "Filas sem opção no BOT ainda podem ser usadas por transferência manual.",
            "Fluxos simples e diretos reduzem a frustração do cliente."
        ]
    }
};

// Anexos por etapa (armazenados em memória durante a sessão)
const stepAttachments = {};

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
    const label = document.querySelector('.theme-toggle-label');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    if (label) label.textContent = theme === 'dark' ? 'Tema claro' : 'Tema escuro';
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
}

/* ========================= Navegação por Etapas ========================= */
function showStep(step) {
    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.wizard-step').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.sidebar-menu li').forEach(el => el.classList.remove('active'));

    document.getElementById(`step${step}`).classList.remove('hidden');
    document.querySelector(`.wizard-step[data-step="${step}"]`).classList.add('active');
    document.querySelector(`.sidebar-menu li[data-step="${step}"]`).classList.add('active');

    // Leitores de tela anunciam qual passo está ativo
    document.querySelectorAll('.wizard-step, .sidebar-menu li').forEach(el => {
        el.setAttribute('aria-current', parseInt(el.getAttribute('data-step')) === step ? 'step' : 'false');
    });

    document.querySelectorAll('.wizard-step').forEach(el => {
        const s = parseInt(el.getAttribute('data-step'));
        el.classList.toggle('completed', completedSteps.has(s));
    });
    document.querySelectorAll('.sidebar-menu li').forEach(el => {
        const s = parseInt(el.getAttribute('data-step'));
        el.classList.toggle('step-done', completedSteps.has(s) && s !== step);
    });

    document.getElementById('btnPrev').style.visibility = step === 1 ? 'hidden' : 'visible';
    document.getElementById('btnNext').innerText = step === totalSteps ? 'Finalizar e Enviar ✔️' : 'Salvar e continuar →';

    document.getElementById('botMessage').innerHTML =
        `<strong>Dica do Jadibô:</strong><br>${botTips[step]}<br><span class="bot-more">👆 Clique em mim para mais dicas desta etapa</span>`;

    // Move o foco para o título do passo: orienta leitores de tela e o olhar do usuário
    const title = document.querySelector(`#step${step} .step-title`);
    if (title) {
        title.setAttribute('tabindex', '-1');
        title.focus({ preventScroll: false });
    }

    // Encaixa a barra de ajuda (Conceito/Modelos/Anexos) ao lado do título desta etapa.
    // Mover o nó preserva os listeners — uma única instância serve as 7 etapas.
    const toolbar = document.getElementById('stepToolbar');
    const headerTarget = document.querySelector(`#step${step} .step-header`);
    if (toolbar && headerTarget) headerTarget.appendChild(toolbar);

    renderStepToolbar(step);
    if (step === totalSteps) renderFlowPreview();
    updateProgress(step);
    localStorage.setItem(STORAGE.STEP, step);
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

function renderAttachments(step) {
    const list = document.getElementById('attachList');
    const badge = document.getElementById('attachBadge');
    if (!list || !badge) return;

    const files = stepAttachments[step] || [];
    list.innerHTML = '';

    if (files.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'attach-list-empty';
        empty.textContent = 'Nenhum arquivo anexado nesta etapa.';
        list.appendChild(empty);
    } else {
        files.forEach((file, index) => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="file-name" title="${escapeHtml(file.name)}">📄 ${escapeHtml(file.name)}</span>`;
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.setAttribute('aria-label', `Remover ${file.name}`);
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', () => {
                stepAttachments[step].splice(index, 1);
                renderAttachments(step);
            });
            li.appendChild(removeBtn);
            list.appendChild(li);
        });
    }

    badge.textContent = files.length;
    badge.classList.toggle('hidden', files.length === 0);
}

function addAttachments(step, fileList) {
    if (!stepAttachments[step]) stepAttachments[step] = [];
    Array.from(fileList).forEach(file => stepAttachments[step].push(file));
    renderAttachments(step);
    showToast(`${fileList.length} arquivo(s) anexado(s) a esta etapa.`, 'success');
}

function updateProgress(step) {
    const done = completedSteps.size;
    const pct = Math.round((done / totalSteps) * 100);
    document.getElementById('progressFill').style.width = pct + '%';
    document.getElementById('progressLabel').textContent = `Etapa ${step} de ${totalSteps}`;
    document.getElementById('progressPercent').textContent = `${pct}% concluído`;
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

    // Passo 4 — avalia o estado da cascata ao avançar
    if (currentStep === 4) {
        checkConfigCascade();
    }

    if (currentStep < totalSteps) {
        currentStep++;
        showStep(currentStep);
        updateFilasDropdowns();
    } else {
        // Última etapa: salva, envia para a API e gera o documento Word
        updateProgress(currentStep);
        const draft = collectDraft();
        saveDraftNow();
        gerarDocumentoLevantamento(draft);
        if (apiCtx.available) {
            finalizeSubmission(draft).then(ok => {
                showToast(ok
                    ? 'Levantamento enviado e documento Word gerado! 🎉'
                    : 'Documento gerado! Mas o envio ao servidor falhou — tente novamente.', ok ? 'success' : 'error');
            });
        } else {
            showToast('Formulário concluído! Documento Word gerado e baixado. 🎉', 'success');
        }
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

/* ========================= Reset / Interação Jadibô ========================= */
function resetForm() {
    if (confirm("Deseja voltar para a primeira etapa e limpar o progresso?")) {
        currentStep = 1;
        completedSteps.clear();
        document.getElementById('onboardingForm').reset();
        localStorage.removeItem(STORAGE.STEP);
        localStorage.removeItem(STORAGE.DRAFT); // limpa também o rascunho salvo
        const statusEl = document.getElementById('draftStatus');
        if (statusEl) statusEl.textContent = '';
        showStep(currentStep);
        updateFilasDropdowns();
    }
}

/* Jadibô: cada clique mostra a próxima dica DA ETAPA ATUAL (com contador) */
const jadiboTipIndex = {};

function interactWithBot() {
    const botImage = document.getElementById('jadiboAvatar');
    const botMessage = document.getElementById('botMessage');

    botImage.classList.add('bot-jump');

    const dicas = (stepHelp[currentStep] && stepHelp[currentStep].dicas && stepHelp[currentStep].dicas.length)
        ? stepHelp[currentStep].dicas
        : extraTips;
    const idx = (jadiboTipIndex[currentStep] || 0) % dicas.length;
    botMessage.innerHTML = `<strong>Dica ${idx + 1} de ${dicas.length}:</strong><br>${dicas[idx]}`;
    jadiboTipIndex[currentStep] = idx + 1;

    setTimeout(() => botImage.classList.remove('bot-jump'), 400);
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

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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

    // Atualiza os <select> de fila de destino das opções do menu do BOT (Passo 7)
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
        chip.addEventListener('click', () => {
            addRespostaRow(s.titulo, s.texto, true);
            chip.disabled = true; // evita duplicar a mesma sugestão sem querer
        });
        wrap.appendChild(chip);
    });
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

function getHorarioResumo() {
    const padraoRadio = document.querySelector('input[name="horario_padrao"]:checked');
    const isPadrao = !padraoRadio || padraoRadio.value === 'sim';
    let horarioTexto = 'Seg-Sex das 08h às 18h | Sáb das 08h às 12h (padrão)';
    if (!isPadrao) {
        const custom = document.querySelector('#customHorario textarea');
        horarioTexto = (custom && custom.value.trim()) || 'Horário personalizado (a definir)';
    }

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
            padrao: getRadio('horario_padrao'),
            custom: (document.getElementById('customHorarioText') || {}).value || '',
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
                texto: tr.querySelector('.resposta-texto').value
            }))
        },
        numeros: {
            principal: (document.getElementById('numeroPrincipal') || {}).value || '',
            ura: getRadio('ura')
        },
        bot: {
            mensagemInicial: (document.getElementById('botMensagemInicial') || {}).value || '',
            opcoes: Array.from(document.querySelectorAll('#botOpcoesTableBody tr')).map(tr => ({
                texto: tr.querySelector('.opcao-texto').value,
                fila: tr.querySelector('.opcao-fila').value
            }))
        },
        completedSteps: Array.from(completedSteps),
        savedAt: Date.now()
    };
}

/* ========================= Gerador do Documento Word (client-side via CDN) =========================
   Usa a biblioteca docx.js carregada no <head>. Gera o levantamento preenchido
   e o oferece para download direto no navegador — sem precisar do servidor. */

function gerarDocumentoLevantamento(draft) {
    if (typeof docx === 'undefined') {
        showToast('A biblioteca de geração do Word não carregou. Verifique sua conexão e tente novamente.', 'error');
        return;
    }

    const {
        Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType, PageBreak
    } = docx;

    const AZUL    = '002B5E';
    const LARANJA = 'E85D04';
    const CINZA   = 'F4F7F9';
    const BRANCO  = 'FFFFFF';
    const BORDA   = 'D0D7E0';
    const TEXTO   = '333333';

    const MSG_PADRAO = {
        saudacaoAgente:   'Olá, você está falando com o(a) *Nome do Agente*, em que posso ajudar?',
        msgFilaVazia:     'Nenhum especialista está disponível no momento! Deixe seu recado que em breve retornamos',
        msgOpcaoInvalida: 'Opção digitada é inválida, digite uma das opções enviadas anteriormente.',
        msgFimSessao:     'A *Nome da Empresa* agradece o seu contato. Não é necessário responder a essa mensagem. Protocolo: @@PROTOCOLO@@',
        msgTransferencia: 'Seu atendimento foi transferido para o especialista responsável, obrigado(a).',
        msgSemInteracao:  'Sua mensagem foi finalizada por falta de interação.',
        msgTentativas:    'Você excedeu a quantidade de tentativas. Por favor, aguarde um atendente.'
    };

    const MSG_TITULO = {
        saudacaoAgente:   'Saudação do agente',
        msgFilaVazia:     'Nenhum agente disponível',
        msgOpcaoInvalida: 'Opção inválida',
        msgFimSessao:     'Fim de atendimento',
        msgTransferencia: 'Transferência de atendimento',
        msgSemInteracao:  'Encerramento por inatividade',
        msgTentativas:    'Tentativas excedidas'
    };

    const noBorder = () => ({ style: BorderStyle.NONE, size: 0, color: BRANCO });
    const sideBorder = (show) => show
        ? { style: BorderStyle.SINGLE, size: 4, color: BORDA }
        : noBorder();

    function cellBorder(t, r, b, l) {
        return { top: sideBorder(t), right: sideBorder(r), bottom: sideBorder(b), left: sideBorder(l) };
    }

    function run(text, opts = {}) {
        return new TextRun({ text: String(text || ''), font: 'Segoe UI', size: 20, color: TEXTO, ...opts });
    }

    function h1(text) {
        return new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [run(text, { bold: true, size: 28, color: AZUL })],
            spacing: { before: 400, after: 200 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: LARANJA } },
            shading: { type: ShadingType.CLEAR, fill: CINZA }
        });
    }

    function h2(text) {
        return new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [run(text, { bold: true, size: 22, color: AZUL })],
            spacing: { before: 280, after: 120 }
        });
    }

    function lv(label, valor) {
        return new Paragraph({
            children: [run(label + ': ', { bold: true, color: AZUL }), run(valor || '(não informado)', { color: valor ? TEXTO : '999999' })],
            spacing: { after: 100 }
        });
    }

    function opt(label, valor) {
        return new Paragraph({
            children: [run('✓  ', { bold: true, color: LARANJA }), run(label + ': ', { bold: true, color: AZUL }), run(valor)],
            spacing: { after: 100 }
        });
    }

    function makeTable(headers, rows, colWidths) {
        const total = colWidths.reduce((a, b) => a + b, 0);
        return new Table({
            width: { size: total, type: WidthType.DXA },
            columnWidths: colWidths,
            rows: [
                new TableRow({
                    tableHeader: true,
                    children: headers.map((h, i) => new TableCell({
                        children: [new Paragraph({ children: [run(h, { bold: true, color: BRANCO, size: 18 })] })],
                        width: { size: colWidths[i], type: WidthType.DXA },
                        shading: { type: ShadingType.CLEAR, fill: AZUL },
                        borders: cellBorder(false, false, false, false),
                        margins: { top: 80, bottom: 80, left: 120, right: 120 }
                    }))
                }),
                ...rows.map((row, ri) => new TableRow({
                    children: row.map((cell, ci) => new TableCell({
                        children: [new Paragraph({ children: [run(cell, { size: 18 })] })],
                        width: { size: colWidths[ci], type: WidthType.DXA },
                        shading: { type: ShadingType.CLEAR, fill: ri % 2 === 0 ? BRANCO : CINZA },
                        borders: cellBorder(false, false, true, false),
                        margins: { top: 80, bottom: 80, left: 120, right: 120 }
                    }))
                }))
            ]
        });
    }

    const clientName = draft.bot && draft.bot.mensagemInicial ? '' : '';
    const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    // ── 00 Capa ──────────────────────────────────────────────────────────
    const capa = [
        new Paragraph({
            children: [run('IP Solution', { bold: true, size: 72, color: AZUL })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 1440, after: 240 }
        }),
        new Paragraph({
            children: [run('Levantamento de Informações — WhatsApp', { size: 36, color: LARANJA })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 }
        }),
        new Paragraph({
            children: [run(`Gerado em ${dataHoje}`, { size: 20, color: '888888' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 1440 }
        }),
        new Paragraph({ children: [new PageBreak()] })
    ];

    // ── 01 Agentes e Filas ───────────────────────────────────────────────
    const filas = (draft.filas || []).filter(f => f.nome && f.nome.trim());
    const agentes = (draft.agentes || []).filter(a => a.nome && a.nome.trim());
    const secao01 = [
        h1('01 — Agentes e Filas'),
        h2('1.1 Filas cadastradas'),
        makeTable(
            ['Nome da Fila', 'Descrição / Finalidade'],
            filas.length ? filas.map(f => [f.nome, f.descricao || '—']) : [['(nenhuma fila cadastrada)', '—']],
            [3000, 6360]
        ),
        new Paragraph({ spacing: { after: 240 } }),
        h2('1.2 Agentes e vínculos'),
        makeTable(
            ['Nome do Agente', 'Filas vinculadas', 'Perfil'],
            agentes.length
                ? agentes.map(a => [a.nome, (a.filas || []).join(', ') || '—', a.perfil || 'Agente'])
                : [['(nenhum agente cadastrado)', '—', '—']],
            [3120, 4440, 1800]
        ),
        new Paragraph({ children: [new PageBreak()] })
    ];

    // ── 02 BOT ───────────────────────────────────────────────────────────
    const bot = draft.bot || {};
    const opcoes = (bot.opcoes || []).filter(o => o.texto || o.fila);
    const secao02 = [
        h1('02 — BOT (URA Digital)'),
        lv('Mensagem inicial', bot.mensagemInicial),
        new Paragraph({ spacing: { after: 120 } }),
        h2('Menu de opções'),
        makeTable(
            ['Nº', 'Opção', 'Encaminhar para a fila'],
            opcoes.length
                ? opcoes.map((o, i) => [String(i + 1), o.texto || '—', o.fila || '—'])
                : [['—', '(nenhuma opção cadastrada)', '—']],
            [600, 4380, 4380]
        ),
        new Paragraph({ children: [new PageBreak()] })
    ];

    // ── 03 Horários ──────────────────────────────────────────────────────
    const h = draft.horario || {};
    const horTexto = h.padrao === 'sim' || !h.padrao
        ? 'Segunda a Sexta das 08:00h às 18:00h e Sábado das 08:00h às 12:00h (padrão)'
        : (h.custom || '(não informado)');
    const foraTexto = h.msgFora === 'direcionar'
        ? `Direcionar para a fila: ${h.filaFora || '(não selecionada)'}`
        : 'Encerrar o atendimento (padrão)';
    const secao03 = [
        h1('03 — Horários de Atendimento'),
        opt('Horário de atendimento', horTexto),
        opt('Mensagens fora do expediente', foraTexto),
        new Paragraph({ children: [new PageBreak()] })
    ];

    // ── 04 Configurações Gerais ──────────────────────────────────────────
    const c = draft.config || {};
    const msgs = c.mensagens || {};

    const msgRows = Object.entries(MSG_TITULO).map(([key, titulo]) => {
        const m = msgs[key] || {};
        const texto = m.mode === 'custom' && m.texto ? m.texto : (MSG_PADRAO[key] || '—') + (m.mode === 'custom' ? '' : ' (padrão)');
        return [titulo, texto];
    });

    const respostas = (c.respostasRapidas || []).filter(r => r.titulo || r.texto);

    const secao04 = [
        h1('04 — Configurações Gerais'),
        h2('4.1 Tempos e limites'),
        opt('Tempo no BOT sem interação',
            c.tempoBotMode === 'alterar' ? `${c.tempoBot || '—'} minutos` : '20 minutos (padrão)'),
        opt('Ação após tempo no BOT',
            c.tempoBotAcao === 'direcionar'
                ? `Direcionar para a fila: ${c.tempoBotFila || '(não selecionada)'}`
                : 'Encerrar o atendimento (padrão)'),
        opt('Tempo sem interação do cliente',
            c.semInteracaoMode === 'alterar' ? `${c.semInteracaoMin || '—'} minutos`
            : c.semInteracaoMode === 'nao_encerrar' ? 'Nunca encerrar'
            : '1440 minutos / 24 horas (padrão)'),
        opt('Limite de tentativas inválidas',
            c.tentativasMode === 'alterar' ? `${c.tentativas || '—'} tentativas` : '5 tentativas (padrão)'),
        opt('Fila após tentativas excedidas', c.tentativasFila || '(não definida)'),
        new Paragraph({ spacing: { after: 160 } }),
        h2('4.2 Mensagens automáticas'),
        makeTable(['Mensagem', 'Texto configurado'], msgRows, [2600, 6760]),
        ...(respostas.length ? [
            new Paragraph({ spacing: { after: 160 } }),
            h2('4.3 Respostas rápidas'),
            makeTable(['Título do atalho', 'Mensagem enviada'],
                respostas.map(r => [r.titulo || '—', r.texto || '—']),
                [2600, 6760])
        ] : []),
        new Paragraph({ children: [new PageBreak()] })
    ];

    // ── 05 Números ───────────────────────────────────────────────────────
    const num = draft.numeros || {};
    const secao05 = [
        h1('05 — Números'),
        lv('Número principal', num.principal),
        opt('Pertence a uma URA (PABX)', num.ura === 'sim' ? 'Sim' : 'Não'),
        new Paragraph({ children: [new PageBreak()] })
    ];

    // ── 06 Agenda ────────────────────────────────────────────────────────
    const secao06 = [
        h1('06 — Agenda de Contatos'),
        new Paragraph({
            children: [run('A importação da agenda de contatos (CSV) será realizada pela equipe técnica da IP Solution após o recebimento deste documento.')],
            spacing: { after: 120 }
        })
    ];

    const doc = new Document({
        styles: { default: { document: { run: { font: 'Segoe UI', size: 20 } } } },
        sections: [{
            properties: {},
            children: [
                ...capa, ...secao01, ...secao02,
                ...secao03, ...secao04, ...secao05, ...secao06
            ]
        }]
    });

    Packer.toBlob(doc).then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'Levantamento_IP_Solution.docx';
        a.click();
        URL.revokeObjectURL(a.href);
    });
}

/* ========================= Passo 4 — Efeito Cascata =========================
   Cada grupo só é revelado quando o anterior estiver válido.
   Grupos: A = tempos (sempre visível), B = mensagens, C = respostas rápidas  */

const CONFIG_GROUPS = ['config-group-A', 'config-group-B', 'config-group-C'];

function isGroupAComplete() {
    const step4 = document.getElementById('step4');
    if (!step4) return false;

    // Tempo no BOT: se "alterar", o campo precisa ter um número válido
    const tempoBotMode = document.querySelector('input[name="tempo_bot"]:checked');
    if (tempoBotMode && tempoBotMode.value === 'alterar') {
        const val = (document.getElementById('tempoBotInput') || {}).value;
        if (!val || parseInt(val, 10) < 1) return false;
    }
    // Ação após tempo: se "direcionar", a fila precisa estar selecionada
    const acoMode = document.querySelector('input[name="tempo_bot_acao"]:checked');
    if (acoMode && acoMode.value === 'direcionar') {
        const fila = (document.getElementById('tempoBotFila') || {}).value;
        if (!fila) return false;
    }
    // "padrao" e "encerrar" são sempre válidos
    return true;
}

function checkConfigCascade() {
    const step4 = document.getElementById('step4');
    if (!step4) return;

    const gB = document.getElementById('config-group-B');
    const gC = document.getElementById('config-group-C');
    if (!gB || !gC) return;

    const aOk = isGroupAComplete();
    const bOk = true; // mensagens têm sempre um padrão válido

    // Grupo B: desbloqueia se A ok, re-bloqueia se A falhou
    if (aOk && gB.classList.contains('config-group-locked')) {
        gB.classList.remove('config-group-locked');
        const msg = gB.querySelector('.config-group-lock-msg');
        if (msg) { msg.classList.add('config-group-unlock'); setTimeout(() => msg.remove(), 500); }
        // Toast só quando o usuário acabou de desbloquear (não no carregamento silencioso)
        if (document._cascadeLoaded) showToast('✓ Tempos configurados! Mensagens automáticas liberadas.', 'success');
    } else if (!aOk && !gB.classList.contains('config-group-locked')) {
        gB.classList.add('config-group-locked');
        if (!gB.querySelector('.config-group-lock-msg')) {
            const msg = document.createElement('div');
            msg.className = 'config-group-lock-msg';
            msg.innerHTML = '🔒 Preencha a seção de Tempos e limites acima para liberar as mensagens automáticas.';
            gB.insertBefore(msg, gB.children[1]);
        }
        // Também re-bloqueia C
        if (!gC.classList.contains('config-group-locked')) {
            gC.classList.add('config-group-locked');
            if (!gC.querySelector('.config-group-lock-msg')) {
                const msg2 = document.createElement('div');
                msg2.className = 'config-group-lock-msg';
                msg2.innerHTML = '🔒 Configure as mensagens automáticas acima para liberar as respostas rápidas.';
                gC.insertBefore(msg2, gC.children[1]);
            }
        }
    }

    // Grupo C: desbloqueia se A+B ok, re-bloqueia se não
    if (aOk && bOk && gC.classList.contains('config-group-locked')) {
        gC.classList.remove('config-group-locked');
        const msg = gC.querySelector('.config-group-lock-msg');
        if (msg) { msg.classList.add('config-group-unlock'); setTimeout(() => msg.remove(), 500); }
        if (document._cascadeLoaded) showToast('✓ Mensagens configuradas! Respostas rápidas liberadas.', 'success');
    }

    document._cascadeLoaded = true;
}

function initConfigCascade() {
    const step4 = document.getElementById('step4');
    if (!step4) return;

    // Adiciona IDs aos grupos de configuração para o cascade
    const groups = step4.querySelectorAll('.config-group');
    const lockMessages = [
        null, // Grupo A sempre visível
        'Preencha a seção de Tempos e limites acima para liberar as mensagens automáticas.',
        'Configure as mensagens automáticas acima para liberar as respostas rápidas.'
    ];

    groups.forEach((g, i) => {
        g.id = CONFIG_GROUPS[i];
        if (i > 0) {
            g.classList.add('config-group-locked');
            const msg = document.createElement('div');
            msg.className = 'config-group-lock-msg';
            msg.innerHTML = `🔒 ${lockMessages[i]}`;
            g.insertBefore(msg, g.children[1]); // após o título
        }
    });

    // Escuta mudanças no Grupo A para destravar em tempo real
    step4.addEventListener('change', checkConfigCascade);
    step4.addEventListener('input', debounce(checkConfigCascade, 300));

    // Avalia imediatamente (cobre o estado padrão) e após o micro-tick
    // (cobre rascunhos restaurados que chegam assincronamente)
    checkConfigCascade();
    setTimeout(checkConfigCascade, 80);
}

function saveDraftNow() {
    try {
        const draft = collectDraft();
        localStorage.setItem(STORAGE.DRAFT, JSON.stringify(draft));
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

    // Passo 3 — Horários (radios + campos condicionais)
    if (draft.horario) {
        setRadio('horario_padrao', draft.horario.padrao);
        setRadio('msg_fora', draft.horario.msgFora);
        toggleField('customHorario', draft.horario.padrao === 'nao');
        toggleField('filaForaHorario', draft.horario.msgFora === 'direcionar');
        const custom = document.getElementById('customHorarioText');
        if (custom) custom.value = draft.horario.custom || '';
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

        // Respostas rápidas
        if (Array.isArray(c.respostasRapidas)) {
            c.respostasRapidas.forEach(r => addRespostaRow(r.titulo, r.texto, false));
        }
    }

    // Passo 5 — Números
    if (draft.numeros) {
        const numero = document.getElementById('numeroPrincipal');
        if (numero) numero.value = draft.numeros.principal || '';
        setRadio('ura', draft.numeros.ura);
    }

    // Passo 7 — BOT
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
document.addEventListener('DOMContentLoaded', () => {
    // Detecta o backend NestJS em segundo plano (não bloqueia o carregamento)
    initApiSync();

    // Sincroniza o botão de tema com o tema já aplicado (definido no <head> antes do carregamento)
    const activeTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(activeTheme);
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

    // Componentes do Passo 4 precisam existir ANTES de restaurar o rascunho
    renderMensagensPadrao();
    renderSugestaoChips();
    setupStep4Interactions();
    document.getElementById('addRespostaBtn').addEventListener('click', () => addRespostaRow());
    document.getElementById('respostasTableBody').addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-delete');
        if (btn) {
            btn.closest('tr').remove();
            refreshRespostasTableVisibility();
            scheduleDraftSave();
        }
    });

    // Restaura rascunho ANTES de exibir a etapa (para o progresso e os campos já virem certos)
    const restored = restoreDraft();

    // Cascata do Passo 4: precisa ser chamada APÓS restoreDraft para ler os radios restaurados
    initConfigCascade();

    const savedStep = localStorage.getItem(STORAGE.STEP);
    if (savedStep) currentStep = Math.min(totalSteps, Math.max(1, parseInt(savedStep, 10) || 1));

    showStep(currentStep);
    if (restored) showToast('Rascunho anterior restaurado. Continue de onde parou!', 'success');

    // Campos condicionais do Passo 3 (antes eram onchange inline no HTML)
    document.querySelectorAll('input[name="horario_padrao"]').forEach(radio => {
        radio.addEventListener('change', () => toggleField('customHorario', radio.value === 'nao' && radio.checked));
    });
    document.querySelectorAll('input[name="msg_fora"]').forEach(radio => {
        radio.addEventListener('change', () => toggleField('filaForaHorario', radio.value === 'direcionar' && radio.checked));
    });

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

    // Opções do menu do BOT (Passo 7)
    const botOpcoesTableBody = document.getElementById('botOpcoesTableBody');
    if (botOpcoesTableBody) {
        botOpcoesTableBody.addEventListener('input', () => renderFlowPreview());
        botOpcoesTableBody.addEventListener('change', () => renderFlowPreview());
    }
    const botMensagemInicial = document.getElementById('botMensagemInicial');
    if (botMensagemInicial) botMensagemInicial.addEventListener('input', () => renderFlowPreview());

    // Campos de Horários (Passo 3) também alimentam o resumo "Fora do horário" do fluxo
    document.querySelectorAll('input[name="horario_padrao"], input[name="msg_fora"]').forEach(radio => {
        radio.addEventListener('change', () => renderFlowPreview());
    });
    const customHorarioTextarea = document.querySelector('#customHorario textarea');
    if (customHorarioTextarea) customHorarioTextarea.addEventListener('input', () => renderFlowPreview());
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
    document.querySelectorAll('.wizard-step').forEach(makeStepNavigable);

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