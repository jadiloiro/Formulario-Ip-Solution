'use strict';

const STEPS = [
    { n: 1, icon: 'fa-layer-group', label: 'Filas' },
    { n: 2, icon: 'fa-users', label: 'Agentes' },
    { n: 3, icon: 'fa-clock', label: 'Horários' },
    { n: 4, icon: 'fa-sliders', label: 'Config.' },
    { n: 5, icon: 'fa-mobile-screen', label: 'Números' },
    { n: 6, icon: 'fa-address-book', label: 'Agenda' },
    { n: 7, icon: 'fa-robot', label: 'BOT' },
];

let allClients = [];
let currentFilter = 'todos';
let currentSearch = '';

function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
        if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else node.setAttribute(k, v);
    });
    (children || []).forEach(c => node.appendChild(c));
    return node;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function relativeTime(dateStr) {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return 'agora mesmo';
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h} h`;
    const d = Math.floor(h / 24);
    return `há ${d} dia${d === 1 ? '' : 's'}`;
}

function initials(name) {
    const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Status derivado: sem submissão nenhuma = não iniciado; senão olha o status da mais recente. */
function statusOf(client) {
    if (!client.submission) return 'nao_iniciado';
    return client.submission.status === 'enviado' ? 'enviado' : 'andamento';
}

function statusLabel(status) {
    return { enviado: 'Enviado', andamento: 'Em andamento', nao_iniciado: 'Não iniciado' }[status];
}

function buildTrack(completedSteps) {
    const done = new Set(completedSteps || []);
    const track = el('div', { class: 'cli-track' });
    const nextStep = STEPS.find(s => !done.has(s.n));
    STEPS.forEach(step => {
        const isDone = done.has(step.n);
        const isCurrent = !isDone && nextStep && nextStep.n === step.n;
        const stepEl = el('div', { class: `cli-track-step${isDone ? ' done' : ''}${isCurrent ? ' current' : ''}` });
        stepEl.appendChild(el('div', { class: 'cli-track-line' }));
        stepEl.appendChild(el('div', { class: 'cli-track-dot' }, [
            el('i', { class: `fa-solid ${step.icon}` }),
        ]));
        stepEl.appendChild(el('span', { class: 'cli-track-caption', text: step.label }));
        track.appendChild(stepEl);
    });
    const wrap = el('div', { style: 'display:flex;align-items:center;' }, [track]);
    wrap.appendChild(el('span', { class: 'cli-track-progress-label', text: `${done.size}/7` }));
    return wrap;
}

function buildFilesSection(client) {
    const wrap = el('div', { class: 'cli-files' });
    const count = (client.attachments || []).length;
    const toggle = el('button', { type: 'button', class: 'cli-files-toggle' }, [
        el('span', {}, [
            document.createTextNode('📎 Arquivos enviados'),
            el('span', { class: 'cli-files-count', text: String(count) }),
        ]),
        el('i', { class: 'fa-solid fa-chevron-down' }),
    ]);
    toggle.addEventListener('click', () => wrap.classList.toggle('open'));
    wrap.appendChild(toggle);

    const list = el('ul', { class: 'cli-files-list' });
    if (count === 0) {
        const empty = el('li', { class: 'cli-files-empty', text: 'Nenhum arquivo enviado ainda.' });
        empty.style.background = 'none';
        list.appendChild(empty);
    } else {
        client.attachments.forEach(file => {
            const downloadUrl = `/api/submissions/${client.submission.id}/attachments/${file.id}/download`;
            const li = el('li', {}, [
                el('a', {
                    class: 'file-name',
                    href: downloadUrl,
                    target: '_blank',
                    rel: 'noopener',
                    title: file.originalName,
                    html: `📄 ${escapeHtml(file.originalName)} <span class="file-size">${formatFileSize(file.size)}</span>`,
                }),
            ]);
            list.appendChild(li);
        });
    }
    wrap.appendChild(list);
    return wrap;
}

function buildCard(client) {
    const status = statusOf(client);
    const card = el('div', { class: 'cli-card' });

    const head = el('div', { class: 'cli-card-head' }, [
        el('div', { class: 'cli-avatar', text: initials(client.clientName) }),
        el('div', { class: 'cli-card-id' }, [
            el('div', { class: 'cli-card-name', text: client.clientName || '(sem nome)' }),
            el('div', { class: 'cli-card-login', text: `@${client.login}` }),
            el('div', { class: 'cli-card-modules' }, [
                ...(client.moduleWhatsapp ? [el('span', { class: 'cli-chip', text: 'WhatsApp' })] : []),
                ...(client.moduleTelefonia ? [el('span', { class: 'cli-chip', text: 'Telefonia' })] : []),
            ]),
        ]),
        el('div', { class: 'cli-card-actions' }, [
            (() => {
                const btn = el('button', { type: 'button', class: 'cli-icon-btn', title: 'Editar cliente', 'aria-label': 'Editar cliente' }, [
                    el('i', { class: 'fa-solid fa-pen' }),
                ]);
                btn.addEventListener('click', () => openEditForm(client));
                return btn;
            })(),
            (() => {
                const btn = el('button', { type: 'button', class: 'cli-icon-btn danger', title: 'Excluir cliente', 'aria-label': 'Excluir cliente' }, [
                    el('i', { class: 'fa-solid fa-trash' }),
                ]);
                btn.addEventListener('click', () => openDeleteModal(client));
                return btn;
            })(),
        ]),
        el('span', { class: `cli-badge status-${status}`, text: statusLabel(status) }),
    ]);
    card.appendChild(head);

    if (client.submission) {
        const draft = client.submission.formData || {};
        // Um levantamento "enviado" está por definição completo, mesmo que o rascunho
        // salvo (formData) seja de antes desse campo existir ou tenha sido pulado.
        const completed = status === 'enviado' ? STEPS.map(s => s.n) : (draft.completedSteps || []);
        card.appendChild(buildTrack(completed));
        card.appendChild(buildFilesSection(client));
        card.appendChild(el('div', { class: 'cli-card-footer' }, [
            el('span', { text: `Atualizado ${relativeTime(client.submission.updatedAt)}` }),
            el('a', {
                class: 'cli-card-link',
                href: `resumo.html?id=${client.submission.id}`,
                target: '_blank',
                text: 'Ver resumo →',
            }),
        ]));
    } else {
        card.appendChild(el('p', { class: 'cli-card-notstarted', text: 'Ainda não acessou o portal.' }));
    }

    return card;
}

function renderSummary() {
    const total = allClients.length;
    const enviados = allClients.filter(c => statusOf(c) === 'enviado').length;
    const andamento = allClients.filter(c => statusOf(c) === 'andamento').length;
    const naoIniciado = total - enviados - andamento;

    const summary = document.getElementById('cliSummary');
    summary.innerHTML = '';
    const stats = [
        { num: total, label: 'clientes cadastrados', cls: '' },
        { num: andamento, label: 'em andamento', cls: 'accent-orange' },
        { num: enviados, label: 'levantamentos enviados', cls: 'accent-green' },
        { num: naoIniciado, label: 'ainda não iniciaram', cls: '' },
    ];
    stats.forEach(s => {
        summary.appendChild(el('div', { class: `cli-stat ${s.cls}` }, [
            el('div', { class: 'cli-stat-num', text: String(s.num) }),
            el('div', { class: 'cli-stat-label', text: s.label }),
        ]));
    });
}

function passesFilter(client) {
    if (currentFilter !== 'todos' && statusOf(client) !== currentFilter) return false;
    if (currentSearch) {
        const haystack = `${client.clientName || ''} ${client.login}`.toLowerCase();
        if (!haystack.includes(currentSearch)) return false;
    }
    return true;
}

function renderGrid() {
    const grid = document.getElementById('cliGrid');
    grid.innerHTML = '';
    const visible = allClients.filter(passesFilter);

    document.getElementById('cliEmptyState').classList.toggle('hidden', allClients.length !== 0);
    document.getElementById('cliNoMatch').classList.toggle('hidden', !(allClients.length > 0 && visible.length === 0));

    visible.forEach(client => grid.appendChild(buildCard(client)));
}

/**
 * GET /submissions/current sempre devolve (ou cria) um rascunho pro usuário logado —
 * inclusive um vazio, se ele só reabrir o formulário depois de já ter enviado (ex:
 * "Voltar ao formulário" no resumo.html). Esse rascunho vazio fica com updatedAt mais
 * recente que o levantamento enviado antes dele, então "pegar o mais recente" sem mais
 * critério faz o painel esconder um envio real atrás de um rascunho em branco.
 */
function submissionRank(sub) {
    if (sub.status === 'enviado') return 2;
    const completedSteps = (sub.formData && sub.formData.completedSteps) || [];
    return completedSteps.length > 0 ? 1 : 0;
}

async function loadClients() {
    const [usersRes, submissionsRes] = await Promise.all([
        fetch('/api/users', { credentials: 'include' }),
        fetch('/api/submissions', { credentials: 'include' }),
    ]);
    if (!usersRes.ok || !submissionsRes.ok) throw new Error('Falha ao carregar clientes');

    const users = await usersRes.json();
    const submissions = await submissionsRes.json();

    // Por cliente: o envio/rascunho mais relevante (enviado > rascunho com progresso
    // > rascunho vazio); entre dois do mesmo nível, o mais recente.
    const latestByUser = {};
    submissions.forEach(sub => {
        const current = latestByUser[sub.userId];
        if (!current) { latestByUser[sub.userId] = sub; return; }
        const subRank = submissionRank(sub);
        const currentRank = submissionRank(current);
        if (subRank !== currentRank) {
            if (subRank > currentRank) latestByUser[sub.userId] = sub;
            return;
        }
        if (new Date(sub.updatedAt) > new Date(current.updatedAt)) latestByUser[sub.userId] = sub;
    });

    const clients = users.map(u => ({ ...u, submission: latestByUser[u.id] || null, attachments: [] }));

    await Promise.all(clients.map(async (client) => {
        if (!client.submission) return;
        try {
            const res = await fetch(`/api/submissions/${client.submission.id}/attachments`, { credentials: 'include' });
            if (res.ok) client.attachments = await res.json();
        } catch (e) { /* segue sem os arquivos desse cliente */ }
    }));

    return clients;
}

async function refreshClients() {
    try {
        allClients = await loadClients();
    } catch (e) {
        allClients = [];
    }
    renderSummary();
    renderGrid();
}

/* ========================= Abas (Clientes / Cadastrar cliente) ========================= */
function switchView(view) {
    document.getElementById('viewClientes').classList.toggle('hidden', view !== 'clientes');
    document.getElementById('viewForm').classList.toggle('hidden', view !== 'form');
    document.querySelectorAll('#cliTabs .cli-nav-link').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-view') === view);
    });
    if (view === 'form' && !document.getElementById('clientIdInput').value) {
        resetClientForm();
    }
}

/* ========================= Formulário: cadastrar/editar cliente ========================= */
function resetClientForm() {
    document.getElementById('clientForm').reset();
    document.getElementById('clientIdInput').value = '';
    document.getElementById('cliFormTitle').textContent = 'Cadastrar cliente';
    document.getElementById('cliFormSub').textContent = 'Cria o login e a senha inicial do cliente e define os módulos contratados. O cliente será obrigado a trocar a senha no primeiro acesso.';
    document.getElementById('clientSenhaLabel').textContent = 'Senha inicial';
    document.getElementById('clientSenhaInput').required = true;
    document.getElementById('clientSenhaHint').classList.add('hidden');
    document.getElementById('clientFormSubmitBtn').textContent = 'Criar acesso do cliente';
    document.getElementById('cancelEditBtn').hidden = true;
    document.getElementById('clientFormError').hidden = true;
    document.getElementById('clientFormSuccess').hidden = true;
}

function openEditForm(client) {
    resetClientForm();
    document.getElementById('clientIdInput').value = client.id;
    document.getElementById('cliFormTitle').textContent = `Editar ${client.clientName || client.login}`;
    document.getElementById('cliFormSub').textContent = 'Altere os dados do cliente. Deixe a senha em branco para não mexer nela.';
    document.getElementById('clientNameInput').value = client.clientName || '';
    document.getElementById('clientLoginInput').value = client.login;
    document.getElementById('moduleWhatsappInput').checked = !!client.moduleWhatsapp;
    document.getElementById('moduleTelefoniaInput').checked = !!client.moduleTelefonia;
    document.getElementById('clientSenhaLabel').textContent = 'Nova senha (opcional)';
    document.getElementById('clientSenhaInput').required = false;
    document.getElementById('clientSenhaHint').classList.remove('hidden');
    document.getElementById('clientFormSubmitBtn').textContent = 'Salvar alterações';
    document.getElementById('cancelEditBtn').hidden = false;
    switchView('form');
}

async function submitClientForm(e) {
    e.preventDefault();
    const errorEl = document.getElementById('clientFormError');
    const successEl = document.getElementById('clientFormSuccess');
    errorEl.hidden = true;
    successEl.hidden = true;

    const id = document.getElementById('clientIdInput').value;
    const clientName = document.getElementById('clientNameInput').value.trim();
    const login = document.getElementById('clientLoginInput').value.trim();
    const senha = document.getElementById('clientSenhaInput').value;
    const moduleWhatsapp = document.getElementById('moduleWhatsappInput').checked;
    const moduleTelefonia = document.getElementById('moduleTelefoniaInput').checked;

    if (!moduleWhatsapp && !moduleTelefonia) {
        errorEl.textContent = 'Selecione ao menos um módulo (WhatsApp e/ou Telefonia).';
        errorEl.hidden = false;
        return;
    }

    const btn = document.getElementById('clientFormSubmitBtn');
    btn.disabled = true;
    try {
        const isEdit = Boolean(id);
        const url = isEdit ? `/api/users/${id}` : '/api/users';
        const body = isEdit
            ? { clientName, login, moduleWhatsapp, moduleTelefonia, ...(senha ? { novaSenha: senha } : {}) }
            : { clientName, login, senha, moduleWhatsapp, moduleTelefonia };

        const res = await fetch(url, {
            method: isEdit ? 'PATCH' : 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const resBody = await res.json().catch(() => ({}));
        if (!res.ok) {
            errorEl.textContent = resBody.message || 'Não foi possível salvar o cliente.';
            errorEl.hidden = false;
            return;
        }
        successEl.textContent = isEdit
            ? 'Cliente atualizado com sucesso!'
            : `Acesso criado! Login: ${resBody.login} — a senha inicial informada deve ser trocada por ele no 1º acesso.`;
        successEl.hidden = false;
        await refreshClients();
        if (isEdit) {
            setTimeout(() => switchView('clientes'), 900);
        } else {
            e.target.reset();
        }
    } catch (err) {
        errorEl.textContent = 'Não foi possível conectar ao servidor. Tente novamente.';
        errorEl.hidden = false;
    } finally {
        btn.disabled = false;
    }
}

/* ========================= Exclusão ========================= */
let clientPendingDelete = null;

function openDeleteModal(client) {
    clientPendingDelete = client;
    document.getElementById('deleteModalBody').textContent =
        `Tem certeza que quer excluir "${client.clientName || client.login}" (@${client.login})? Essa ação não pode ser desfeita.`;
    document.getElementById('deleteModalOverlay').classList.remove('hidden');
}

function closeDeleteModal() {
    clientPendingDelete = null;
    document.getElementById('deleteModalOverlay').classList.add('hidden');
}

async function confirmDelete() {
    if (!clientPendingDelete) return;
    const btn = document.getElementById('deleteConfirmBtn');
    btn.disabled = true;
    try {
        await fetch(`/api/users/${clientPendingDelete.id}`, { method: 'DELETE', credentials: 'include' });
    } finally {
        btn.disabled = false;
        closeDeleteModal();
        await refreshClients();
    }
}

async function init() {
    const user = await requireAuth();
    if (!user) return;
    if (user.role !== 'super_admin') {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('themeToggle').addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
    });

    document.getElementById('cliSearchInput').addEventListener('input', (e) => {
        currentSearch = e.target.value.trim().toLowerCase();
        renderGrid();
    });
    document.querySelectorAll('.cli-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.cli-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            renderGrid();
        });
    });

    document.querySelectorAll('#cliTabs .cli-nav-link').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.getAttribute('data-view')));
    });
    document.querySelectorAll('[data-view-link]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(link.getAttribute('data-view-link'));
        });
    });

    document.getElementById('clientForm').addEventListener('submit', submitClientForm);
    document.getElementById('cancelEditBtn').addEventListener('click', () => switchView('clientes'));
    document.getElementById('deleteCancelBtn').addEventListener('click', closeDeleteModal);
    document.getElementById('deleteConfirmBtn').addEventListener('click', confirmDelete);
    document.getElementById('deleteModalOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'deleteModalOverlay') closeDeleteModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !document.getElementById('deleteModalOverlay').classList.contains('hidden')) {
            closeDeleteModal();
        }
    });

    await refreshClients();
    document.documentElement.style.visibility = 'visible';
}

init();
