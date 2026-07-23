/* ==============================================================
   Editor Visual do Fluxo do BOT — IP Solution
   Motor: Drawflow · Modelo: blocos de AÇÃO (estilo construtor de chatbot)
   Início = cliente envia a primeira mensagem → ações encadeadas
   ============================================================== */

'use strict';

const SHARED_DATA_KEY = 'ipsolution_shared_flow_data';
const GRAPH_KEY = 'ipsolution_flow_v2';

let editor = null;
let inicioNodeId = null;
let sharedData = { filas: [], agentesPorFila: {}, mensagemInicial: '', horarioTexto: '', destinoFora: '' };

const api = { available: false, submissionId: null };

/* ========================= Utilidades ========================= */
function fcToast(message, type = 'info') {
    const container = document.getElementById('fcToastContainer');
    const toast = document.createElement('div');
    toast.className = `fc-toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
}

/* ========================= Tema ========================= */
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    const icon = document.querySelector('.theme-toggle-icon');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
}

/* ========================= Dados do formulário ========================= */
function loadSharedData() {
    try {
        const raw = localStorage.getItem(SHARED_DATA_KEY);
        if (raw) sharedData = Object.assign(sharedData, JSON.parse(raw));
    } catch (e) { /* dados corrompidos: mantém padrão */ }
    updateSyncPill();
}

function updateSyncPill() {
    const pill = document.getElementById('syncStatus');
    if (api.available) {
        pill.textContent = 'Sincronizado com o servidor';
        pill.classList.add('is-api');
        pill.classList.remove('is-stale');
        return;
    }
    pill.classList.remove('is-api');
    if (sharedData.filas && sharedData.filas.length > 0) {
        pill.textContent = `Sincronizado · ${sharedData.filas.length} fila${sharedData.filas.length > 1 ? 's' : ''} do formulário`;
        pill.classList.remove('is-stale');
    } else {
        pill.textContent = 'Nenhuma fila no formulário ainda';
        pill.classList.add('is-stale');
    }
}

/* ========================= Definições dos blocos de ação ========================= */
const NODE_LABELS = {
    inicio: 'Início',
    mensagem: 'Mensagem',
    entrada: 'Entrada',
    menu: 'Menu',
    condicao: 'Condição de horário',
    aguardar: 'Aguardar',
    transferir: 'Transferir para fila',
    encerrar: 'Encerrar atendimento'
};

function headerHtml(icon, title) {
    return `<div class="node-header"><span class="node-hicon">${icon}</span><span class="node-htitle">${escapeHtml(title)}</span></div>`;
}

function htmlInicio() {
    return `${headerHtml('⏻', 'Início')}
    <div class="node-body"><p>Dispara quando o cliente envia a <strong>primeira mensagem</strong> no WhatsApp.</p></div>`;
}

function htmlMensagem() {
    return `${headerHtml('💬', 'Mensagem')}
    <div class="node-body"><textarea df-texto placeholder="Texto enviado ao cliente"></textarea></div>`;
}

function htmlEntrada() {
    return `${headerHtml('⇥', 'Entrada')}
    <div class="node-body">
        <p style="margin-bottom:6px;">Pergunta e <strong>aguarda a resposta</strong> do cliente:</p>
        <textarea df-pergunta placeholder="Ex: Qual o seu nome completo?"></textarea>
    </div>`;
}

function menuRowHtml(index, value) {
    return `<div class="menu-row"><span class="menu-num">${index + 1}</span><input type="text" class="menu-opt-input" data-idx="${index}" placeholder="Ex: Comercial" value="${escapeHtml(value || '')}"></div>`;
}

function htmlMenu(options) {
    const rows = (options || ['']).map((op, i) => menuRowHtml(i, op)).join('');
    return `${headerHtml('☷', 'Menu')}
    <div class="node-body">
        <label class="node-field-label">Mensagem enviada ao cliente</label>
        <textarea df-texto placeholder="Ex: Digite o número da opção desejada:"></textarea>
        <label class="node-field-label" style="margin-top:10px;">Opções — cada uma vira uma saída →</label>
        <div class="menu-rows">${rows}</div>
        <div class="menu-actions">
            <button type="button" class="menu-add">+ opção</button>
            <button type="button" class="menu-del">− última</button>
        </div>
    </div>`;
}

function htmlCondicao() {
    return `${headerHtml('⑂', 'Condição de horário')}
    <div class="node-body">
        <p class="cond-resumo">Expediente (Passo 3): <strong class="h-exp">${escapeHtml(sharedData.horarioTexto || 'não definido')}</strong></p>
        <div class="cond-row"><span class="cond-ok">✓</span> Dentro do horário</div>
        <div class="cond-row"><span class="cond-no">✕</span> Fora do horário</div>
    </div>`;
}

function htmlAguardar() {
    return `${headerHtml('🕐', 'Aguardar')}
    <div class="node-body"><div class="field-suffix"><input type="number" min="1" df-minutos> <span>minutos</span></div></div>`;
}

function filaAgentesHtml(filaNome) {
    const agentes = (sharedData.agentesPorFila && sharedData.agentesPorFila[filaNome]) || [];
    if (!filaNome) return '<span class="node-muted">Escolha a fila de destino</span>';
    return agentes.length
        ? `<div class="node-agents">${agentes.map(a => `<span class="node-agent-chip">${escapeHtml(a)}</span>`).join('')}</div>`
        : '<span class="node-muted">Sem agente vinculado no Passo 2</span>';
}

function filaOptionsHtml(selected) {
    const opts = (sharedData.filas || [])
        .map(f => `<option value="${escapeHtml(f)}" ${f === selected ? 'selected' : ''}>${escapeHtml(f)}</option>`)
        .join('');
    return `<option value="">Selecione a fila…</option>${opts}`;
}

function htmlTransferir(fila) {
    return `${headerHtml('📥', 'Transferir para fila')}
    <div class="node-body">
        <select class="transferir-fila">${filaOptionsHtml(fila)}</select>
        <div class="node-agents-wrap">${filaAgentesHtml(fila)}</div>
    </div>`;
}

function htmlEncerrar() {
    return `${headerHtml('⏻', 'Encerrar atendimento')}
    <div class="node-body"><p>Envia a <strong>mensagem de fim de sessão</strong> (Passo 4) e encerra a conversa.</p></div>`;
}

/* ========================= Criação de blocos ========================= */
function addTypedNode(type, x, y, preset = {}) {
    let id = null;
    switch (type) {
        case 'inicio':
            id = editor.addNode('inicio', 0, 1, x, y, 'node-inicio', {}, htmlInicio());
            inicioNodeId = id;
            break;
        case 'mensagem':
            id = editor.addNode('mensagem', 1, 1, x, y, 'node-mensagem',
                { texto: preset.texto || '' }, htmlMensagem());
            break;
        case 'entrada':
            id = editor.addNode('entrada', 1, 1, x, y, 'node-entrada', { pergunta: '' }, htmlEntrada());
            break;
        case 'menu': {
            const options = preset.options && preset.options.length ? preset.options : [''];
            id = editor.addNode('menu', 1, options.length, x, y, 'node-menu',
                { texto: preset.texto || '', options }, htmlMenu(options));
            break;
        }
        case 'condicao':
            id = editor.addNode('condicao', 1, 2, x, y, 'node-condicao', {}, htmlCondicao());
            break;
        case 'aguardar':
            id = editor.addNode('aguardar', 1, 1, x, y, 'node-aguardar', { minutos: 5 }, htmlAguardar());
            break;
        case 'transferir':
            id = editor.addNode('transferir', 1, 0, x, y, 'node-transferir',
                { fila: preset.fila || '' }, htmlTransferir(preset.fila || ''));
            break;
        case 'encerrar':
            id = editor.addNode('encerrar', 1, 0, x, y, 'node-encerrar', {}, htmlEncerrar());
            break;
    }
    scheduleSave();
    return id;
}

function exportData() {
    const raw = editor.export();
    return (raw && raw.drawflow && raw.drawflow.Home && raw.drawflow.Home.data) || {};
}

function nextFreePosition() {
    const count = Object.keys(exportData()).length;
    const col = count % 4;
    const row = Math.floor(count / 4);
    return { x: 90 + col * 330, y: 110 + row * 210 };
}

/* Posição do drop convertida para o espaço do canvas (fórmula da demo oficial do Drawflow) */
function dropPosition(clientX, clientY) {
    const pre = editor.precanvas;
    const zoom = editor.zoom;
    const rect = pre.getBoundingClientRect();
    return {
        x: clientX * (pre.clientWidth / (pre.clientWidth * zoom)) - rect.x * (pre.clientWidth / (pre.clientWidth * zoom)),
        y: clientY * (pre.clientHeight / (pre.clientHeight * zoom)) - rect.y * (pre.clientHeight / (pre.clientHeight * zoom))
    };
}

/* ========================= Interações dentro dos nós =========================
   Delegação única: campos manuais (menu, transferir) atualizam node.data */
function nodeIdFromEl(el) {
    const nodeEl = el.closest('.drawflow-node');
    return nodeEl ? nodeEl.id.replace('node-', '') : null;
}

function renumberMenuRows(nodeEl) {
    nodeEl.querySelectorAll('.menu-row').forEach((row, i) => {
        row.querySelector('.menu-num').textContent = i + 1;
        row.querySelector('.menu-opt-input').setAttribute('data-idx', i);
    });
}

function setupNodeInteractions() {
    const container = document.getElementById('drawflow');

    container.addEventListener('input', (e) => {
        const id = nodeIdFromEl(e.target);
        if (!id) return;

        // Opções do menu (binding manual: array não é coberto pelos df-*)
        if (e.target.classList.contains('menu-opt-input')) {
            const node = editor.getNodeFromId(id);
            const idx = parseInt(e.target.getAttribute('data-idx'), 10);
            const options = (node.data.options || []).slice();
            options[idx] = e.target.value;
            editor.updateNodeDataFromId(id, { ...node.data, options });
            scheduleSave();
        }
    });

    container.addEventListener('change', (e) => {
        const id = nodeIdFromEl(e.target);
        if (!id) return;

        // Fila de destino do Transferir
        if (e.target.classList.contains('transferir-fila')) {
            const fila = e.target.value;
            const node = editor.getNodeFromId(id);
            editor.updateNodeDataFromId(id, { ...node.data, fila });
            const wrap = e.target.closest('.node-body').querySelector('.node-agents-wrap');
            if (wrap) wrap.innerHTML = filaAgentesHtml(fila);
            scheduleSave();
        }
    });

    container.addEventListener('click', (e) => {
        const id = nodeIdFromEl(e.target);
        if (!id) return;
        const nodeEl = document.getElementById(`node-${id}`);

        // + opção: nova linha e nova PORTA de saída no menu
        if (e.target.classList.contains('menu-add')) {
            const node = editor.getNodeFromId(id);
            const options = (node.data.options || ['']).slice();
            options.push('');
            editor.updateNodeDataFromId(id, { ...node.data, options });
            editor.addNodeOutput(id);
            const rowsWrap = nodeEl.querySelector('.menu-rows');
            rowsWrap.insertAdjacentHTML('beforeend', menuRowHtml(options.length - 1, ''));
            renumberMenuRows(nodeEl);
            scheduleSave();
        }

        // − última: remove a última linha e a porta correspondente (conexões dela caem junto)
        if (e.target.classList.contains('menu-del')) {
            const node = editor.getNodeFromId(id);
            const options = (node.data.options || ['']).slice();
            if (options.length <= 1) {
                fcToast('O menu precisa de pelo menos uma opção.', 'error');
                return;
            }
            editor.removeNodeOutput(id, `output_${options.length}`);
            options.pop();
            editor.updateNodeDataFromId(id, { ...node.data, options });
            const rows = nodeEl.querySelectorAll('.menu-row');
            rows[rows.length - 1].remove();
            renumberMenuRows(nodeEl);
            scheduleSave();
        }
    });
}

/* Reconstrói as partes dinâmicas após um import (o Drawflow restaura o HTML
   original do addNode, não o DOM alterado — as linhas extras vêm do node.data) */
function rebuildDynamicNodes() {
    Object.values(exportData()).forEach(n => {
        const el = document.getElementById(`node-${n.id}`);
        if (!el) return;

        if (n.name === 'menu') {
            const rowsWrap = el.querySelector('.menu-rows');
            if (rowsWrap) {
                rowsWrap.innerHTML = (n.data.options || ['']).map((op, i) => menuRowHtml(i, op)).join('');
            }
        }
        if (n.name === 'transferir') {
            const select = el.querySelector('.transferir-fila');
            const wrap = el.querySelector('.node-agents-wrap');
            if (select) select.innerHTML = filaOptionsHtml(n.data.fila || '');
            if (wrap) wrap.innerHTML = filaAgentesHtml(n.data.fila || '');
        }
        if (n.name === 'condicao') {
            const exp = el.querySelector('.h-exp');
            if (exp) exp.textContent = sharedData.horarioTexto || 'não definido';
        }
    });
}

/* ========================= Paleta lateral de filas ========================= */
function renderPalette() {
    const list = document.getElementById('filasPaletteList');
    const emptyHint = document.getElementById('filasEmptyHint');
    const clickHint = document.getElementById('filasClickHint');
    const countBadge = document.getElementById('filasCount');
    list.innerHTML = '';

    const filas = sharedData.filas || [];
    countBadge.textContent = filas.length;

    const empty = filas.length === 0;
    emptyHint.classList.toggle('hidden', !empty);
    if (clickHint) clickHint.classList.toggle('hidden', empty);
    if (empty) return;

    filas.forEach(fila => {
        const agentes = (sharedData.agentesPorFila && sharedData.agentesPorFila[fila]) || [];
        const card = document.createElement('div');
        card.className = 'fc-palette-card';
        card.draggable = true;
        card.innerHTML = `
            <span class="fc-palette-chip fc-chip-fila">📥</span>
            <div class="fc-palette-card-text">
                <strong>${escapeHtml(fila)}</strong>
                <span>${agentes.length ? escapeHtml(agentes.join(', ')) : 'Sem agente vinculado'}</span>
            </div>
            <span class="fc-palette-add">+</span>
        `;
        card.addEventListener('click', () => {
            const pos = nextFreePosition();
            addTypedNode('transferir', pos.x, pos.y, { fila });
        });
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/fc-block', JSON.stringify({ type: 'transferir', fila }));
            e.dataTransfer.effectAllowed = 'copy';
        });
        list.appendChild(card);
    });
}

/* ========================= Persistência ========================= */
function saveNow() {
    const graph = editor.export();
    try { localStorage.setItem(GRAPH_KEY, JSON.stringify(graph)); } catch (e) { /* sem storage */ }

    if (api.available && api.submissionId) {
        fetch(`/api/submissions/${api.submissionId}/flow`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ flowData: graph })
        }).catch(() => { /* rede falhou: o localStorage segue como cópia local */ });
    }

    const now = new Date();
    document.getElementById('autosaveStatus').textContent =
        `Salvo automaticamente às ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    runValidations();
}
const scheduleSave = debounce(saveNow, 800);

/* Modelo inicial: Início → Menu (com a saudação do formulário já dentro dele) */
function buildStarterTemplate() {
    const i = addTypedNode('inicio', 70, 170);
    const menu = addTypedNode('menu', 420, 110, {
        texto: sharedData.mensagemInicial || 'Olá! Bem-vindo(a). Digite o número da opção desejada:',
        options: ['']
    });
    editor.addConnection(i, menu, 'output_1', 'input_1');
}

/* Tipos válidos do modelo atual: qualquer grafo com nós fora desta lista
   é de um formato antigo e não pode ser importado (quebraria o quadro) */
const VALID_NODE_TYPES = new Set(['inicio', 'mensagem', 'entrada', 'menu', 'condicao', 'aguardar', 'transferir', 'encerrar']);

function graphIsCompatible(graph) {
    const data = graph && graph.drawflow && graph.drawflow.Home && graph.drawflow.Home.data;
    if (!data || Object.keys(data).length === 0) return false;
    return Object.values(data).every(n => VALID_NODE_TYPES.has(n.name));
}

function loadSavedGraph(serverFlow) {
    let graph = null;
    let migrated = false;

    if (serverFlow) {
        if (graphIsCompatible(serverFlow)) graph = serverFlow;
        else migrated = true; // formato antigo no servidor: será substituído
    }
    if (!graph) {
        try {
            const raw = localStorage.getItem(GRAPH_KEY);
            if (raw) {
                const local = JSON.parse(raw);
                if (graphIsCompatible(local)) graph = local;
                else migrated = true;
            }
        } catch (e) { /* recomeça */ }
    }

    if (graph) {
        editor.import(graph);
        rebuildDynamicNodes();
        const inicio = Object.values(exportData()).find(n => n.name === 'inicio');
        inicioNodeId = inicio ? inicio.id : addTypedNode('inicio', 70, 160);
        return true;
    }

    buildStarterTemplate();
    if (migrated) {
        // Sobrescreve imediatamente o formato antigo (local e servidor)
        saveNow();
        fcToast('Encontramos um fluxo no formato antigo — começamos do modelo novo para você.', 'info');
    }
    return false;
}

/* ========================= Validações ========================= */
function nodeDisplayName(n) {
    if (n.name === 'menu') return 'Menu';
    if (n.name === 'transferir') return n.data.fila ? `Transferir → ${n.data.fila}` : 'Transferir';
    if (n.name === 'mensagem') return n.data.texto ? `Mensagem "${n.data.texto.slice(0, 24)}${n.data.texto.length > 24 ? '…' : ''}"` : 'Mensagem';
    return NODE_LABELS[n.name] || 'Bloco';
}

function outConns(node, outputClass) {
    return (node.outputs && node.outputs[outputClass] && node.outputs[outputClass].connections) || [];
}
function hasIncoming(node) {
    return ((node.inputs && node.inputs.input_1 && node.inputs.input_1.connections) || []).length > 0;
}

function runValidations() {
    const list = document.getElementById('validationList');
    const badge = document.getElementById('validationCount');
    if (!list) return;

    const nodes = Object.values(exportData());
    const issues = [];
    const inicio = nodes.find(n => n.name === 'inicio');

    if (inicio && nodes.length > 1 && outConns(inicio, 'output_1').length === 0) {
        issues.push('O bloco Início não está conectado a nenhuma ação.');
    }

    nodes.forEach(n => {
        if (n.name !== 'inicio' && !hasIncoming(n)) {
            issues.push(`O bloco "${nodeDisplayName(n)}" está desconectado do fluxo.`);
        }
        if (n.name === 'menu') {
            if (!n.data.texto || !n.data.texto.trim()) {
                issues.push('O Menu está sem a mensagem que apresenta as opções ao cliente.');
            }
            (n.data.options || []).forEach((op, i) => {
                if (!op || !op.trim()) issues.push(`A opção ${i + 1} do Menu está sem texto.`);
                if (outConns(n, `output_${i + 1}`).length === 0) issues.push(`A opção ${i + 1} do Menu não tem destino.`);
            });
        }
        if (n.name === 'transferir') {
            if (!n.data.fila) issues.push('Há um bloco Transferir sem fila selecionada.');
            else if (sharedData.filas && !sharedData.filas.includes(n.data.fila)) {
                issues.push(`A fila "${n.data.fila}" não existe mais no formulário.`);
            }
        }
        if (n.name === 'condicao' && outConns(n, 'output_2').length === 0) {
            issues.push('A saída "Fora do horário" da Condição está sem destino.');
        }
        if (n.name === 'entrada' && (!n.data.pergunta || !n.data.pergunta.trim())) {
            issues.push('Há um bloco Entrada sem a pergunta preenchida.');
        }
    });

    list.innerHTML = '';
    if (issues.length === 0) {
        const li = document.createElement('li');
        li.className = 'ok';
        li.textContent = nodes.length > 1 ? 'Tudo certo! O fluxo está consistente.' : 'Adicione ações pela paleta à direita.';
        list.appendChild(li);
        badge.classList.add('hidden');
    } else {
        issues.slice(0, 6).forEach(text => {
            const li = document.createElement('li');
            li.className = 'warn';
            li.textContent = text;
            list.appendChild(li);
        });
        if (issues.length > 6) {
            const li = document.createElement('li');
            li.className = 'warn';
            li.textContent = `E mais ${issues.length - 6} ponto(s) para revisar…`;
            list.appendChild(li);
        }
        badge.textContent = issues.length;
        badge.classList.remove('hidden');
    }
}

/* ========================= Resumo / Exportação ========================= */
function describeTarget(nodes, conns) {
    if (!conns.length) return '(sem destino)';
    return conns.map(c => {
        const t = nodes.find(n => String(n.id) === String(c.node));
        return t ? nodeDisplayName(t) : '(?)';
    }).join(' + ');
}

function buildSummaryText() {
    const nodes = Object.values(exportData());
    const inicio = nodes.find(n => n.name === 'inicio');
    const lines = [];
    lines.push('FLUXO DO BOT — Levantamento IP Solution');
    lines.push('');
    lines.push('Gatilho: cliente envia a primeira mensagem no WhatsApp.');

    if (inicio) {
        lines.push(`Primeira ação: ${describeTarget(nodes, outConns(inicio, 'output_1'))}`);
    }

    const menus = nodes.filter(n => n.name === 'menu').sort((a, b) => a.pos_x - b.pos_x || a.pos_y - b.pos_y);
    menus.forEach((menu, mi) => {
        lines.push('');
        lines.push(menus.length > 1 ? `Menu ${mi + 1}:` : 'Menu:');
        if (menu.data.texto && menu.data.texto.trim()) {
            lines.push(`  Mensagem: "${menu.data.texto.trim()}"`);
        }
        (menu.data.options || []).forEach((op, i) => {
            lines.push(`  ${i + 1}. ${op || '(sem texto)'} → ${describeTarget(nodes, outConns(menu, `output_${i + 1}`))}`);
        });
    });

    const conds = nodes.filter(n => n.name === 'condicao');
    conds.forEach(c => {
        lines.push('');
        lines.push(`Condição de horário (${sharedData.horarioTexto || 'não definido'}):`);
        lines.push(`  ✓ Dentro do horário → ${describeTarget(nodes, outConns(c, 'output_1'))}`);
        lines.push(`  ✕ Fora do horário → ${describeTarget(nodes, outConns(c, 'output_2'))}`);
    });

    const transfers = nodes.filter(n => n.name === 'transferir' && n.data.fila);
    if (transfers.length) {
        lines.push('');
        lines.push('Transferências para atendimento humano:');
        transfers.forEach(t => {
            const ag = (sharedData.agentesPorFila && sharedData.agentesPorFila[t.data.fila]) || [];
            lines.push(`  • Fila ${t.data.fila}${ag.length ? ` (Agentes: ${ag.join(', ')})` : ''}`);
        });
    }

    const usadas = new Set(transfers.map(t => t.data.fila));
    const semBot = (sharedData.filas || []).filter(f => !usadas.has(f));
    if (semBot.length) {
        lines.push('');
        lines.push(`Filas sem transferência no fluxo (uso manual): ${semBot.join(', ')}`);
    }
    return lines.join('\n');
}

function copySummary() {
    const text = buildSummaryText();
    const done = () => fcToast('Resumo do fluxo copiado. Cole onde precisar!', 'success');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
        fallbackCopy(text, done);
    }
}
function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); }
    catch (e) { fcToast('Não foi possível copiar automaticamente.', 'error'); }
    ta.remove();
}

function exportJson() {
    const payload = {
        gerado_em: new Date().toISOString(),
        dados_formulario: sharedData,
        fluxo_drawflow: editor.export(),
        resumo: buildSummaryText()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'fluxo-bot-ipsolution.json';
    a.click();
    URL.revokeObjectURL(a.href);
    fcToast('Arquivo do fluxo baixado.', 'success');
}

/* ========================= Ações da barra ========================= */
function refreshData() {
    loadSharedData();

    // Atualiza conteúdo dinâmico dos nós existentes (filas, agentes, horário)
    Object.values(exportData()).forEach(n => {
        const el = document.getElementById(`node-${n.id}`);
        if (!el) return;
        if (n.name === 'transferir') {
            const select = el.querySelector('.transferir-fila');
            const wrap = el.querySelector('.node-agents-wrap');
            if (select) select.innerHTML = filaOptionsHtml(n.data.fila || '');
            if (wrap) wrap.innerHTML = filaAgentesHtml(n.data.fila || '');
        }
        if (n.name === 'condicao') {
            const exp = el.querySelector('.h-exp');
            if (exp) exp.textContent = sharedData.horarioTexto || 'não definido';
        }
    });

    renderPalette();
    runValidations();
    fcToast('Dados do formulário atualizados.', 'success');
}

function clearCanvas() {
    if (!confirm('Isso remove todos os blocos e conexões do quadro. Deseja continuar?')) return;
    editor.clearModuleSelected();
    buildStarterTemplate();
    saveNow();
    fcToast('Quadro limpo — modelo inicial recriado.', 'success');
}

/* ========================= Zoom ========================= */
function setupZoom() {
    document.getElementById('zoomInBtn').addEventListener('click', () => editor.zoom_in());
    document.getElementById('zoomOutBtn').addEventListener('click', () => editor.zoom_out());
    document.getElementById('zoomResetBtn').addEventListener('click', () => editor.zoom_reset());

    document.getElementById('drawflow').addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.deltaY < 0) editor.zoom_in(); else editor.zoom_out();
        }
    }, { passive: false });
}

/* ========================= API (backend NestJS) ========================= */
async function initApi() {
    try {
        const current = await fetch('/api/submissions/current', { credentials: 'include' });
        if (!current.ok) return null;
        const submission = await current.json();
        api.available = true;
        api.submissionId = submission.id;
        updateSyncPill();
        return submission.flowData || null;
    } catch (e) {
        return null; // falha transitória: segue local até a próxima tentativa de save
    }
}

/* ========================= Inicialização ========================= */
document.addEventListener('DOMContentLoaded', async () => {
    // Login é obrigatório: sem sessão válida, requireAuth já redireciona para login.html
    // e a página (oculta desde o <head>) nunca chega a ser revelada.
    const authUser = await requireAuth();
    if (!authUser) return;
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) btnLogout.addEventListener('click', logout);

    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    if (typeof Drawflow === 'undefined') {
        document.getElementById('offlineOverlay').classList.remove('hidden');
        return;
    }

    loadSharedData();
    const serverFlow = await initApi();

    const container = document.getElementById('drawflow');
    editor = new Drawflow(container);
    editor.reroute = true;
    editor.zoom_min = 0.35;
    editor.zoom_max = 2.2;
    editor.start();
    window.__fcEditor = editor; // gancho de depuração/QA

    loadSavedGraph(serverFlow);
    renderPalette();
    runValidations();
    setupNodeInteractions();
    setupZoom();

    ['nodeCreated', 'nodeMoved', 'nodeDataChanged', 'connectionCreated', 'connectionRemoved'].forEach(evt => {
        editor.on(evt, () => scheduleSave());
    });

    /* O bloco Início é o gatilho do fluxo: se removido, volta */
    editor.on('nodeRemoved', (id) => {
        if (String(id) === String(inicioNodeId)) {
            fcToast('O bloco Início é o gatilho do fluxo — recriado no quadro.', 'error');
            addTypedNode('inicio', 70, 160);
        }
        scheduleSave();
    });

    document.getElementById('refreshDataBtn').addEventListener('click', refreshData);
    document.getElementById('copySummaryBtn').addEventListener('click', copySummary);
    document.getElementById('exportJsonBtn').addEventListener('click', exportJson);
    document.getElementById('clearCanvasBtn').addEventListener('click', clearCanvas);

    /* Paleta flutuante de ações: clique adiciona; arraste posiciona */
    document.querySelectorAll('.fc-action[data-node-type]').forEach(btn => {
        const type = btn.dataset.nodeType;
        btn.addEventListener('click', () => {
            const pos = nextFreePosition();
            addTypedNode(type, pos.x, pos.y);
        });
        btn.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/fc-block', JSON.stringify({ type }));
            e.dataTransfer.effectAllowed = 'copy';
        });
    });

    container.addEventListener('dragover', (e) => {
        if (e.dataTransfer.types.includes('text/fc-block')) e.preventDefault();
    });
    container.addEventListener('drop', (e) => {
        const raw = e.dataTransfer.getData('text/fc-block');
        if (!raw) return;
        e.preventDefault();
        try {
            const info = JSON.parse(raw);
            const pos = dropPosition(e.clientX, e.clientY);
            addTypedNode(info.type, pos.x, pos.y, info);
        } catch (err) { /* payload inválido */ }
    });

    window.addEventListener('storage', (e) => {
        if (e.key === SHARED_DATA_KEY) refreshData();
    });
});