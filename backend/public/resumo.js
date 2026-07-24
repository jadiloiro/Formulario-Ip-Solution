'use strict';

/* Tela de resumo final — lê a submissão (formData no mesmo formato de collectDraft(),
   em script.js) via API e renderiza um documento HTML "pronto para impressão", que
   substitui a antiga geração via jsPDF. Deliberadamente não depende de script.js:
   é uma página independente, só com os dados já finalizados. */

const DIAS_SEMANA = [
    { key: 'seg', curto: 'Segunda' },
    { key: 'ter', curto: 'Terça' },
    { key: 'qua', curto: 'Quarta' },
    { key: 'qui', curto: 'Quinta' },
    { key: 'sex', curto: 'Sexta' },
    { key: 'sab', curto: 'Sábado' },
    { key: 'dom', curto: 'Domingo' }
];

/* Mesmos ids/rótulos/textos-padrão de MENSAGENS_PADRAO (script.js) — só os
   metadados de exibição, sem a lógica de edição (que não existe nesta tela). */
const MENSAGENS_PADRAO = [
    { id: 'saudacaoAgente', titulo: 'Saudação do agente' },
    { id: 'msgFilaVazia', titulo: 'Nenhum agente disponível' },
    { id: 'msgOpcaoInvalida', titulo: 'Opção inválida' },
    { id: 'msgFimSessao', titulo: 'Fim de atendimento' },
    { id: 'msgTransferencia', titulo: 'Transferência de atendimento' },
    { id: 'msgSemInteracao', titulo: 'Encerramento por falta de resposta' },
    { id: 'msgTentativas', titulo: 'Tentativas excedidas' }
];

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

function fieldBlock(label, value) {
    const wrap = el('div', { class: 'resumo-field' });
    wrap.appendChild(el('span', { class: 'resumo-field-label', text: label }));
    wrap.appendChild(el('span', { class: 'resumo-field-value', text: value || '—' }));
    return wrap;
}

function msgBlock(titulo, texto) {
    const wrap = document.createDocumentFragment();
    wrap.appendChild(el('div', { class: 'resumo-subtitle', text: titulo }));
    wrap.appendChild(el('div', { class: 'resumo-msg-block', text: texto || '—' }));
    return wrap;
}

function scheduleResumoTexto(dias) {
    if (!dias) return 'Horário não definido';
    const assinaturaDia = (dia) => {
        const e = dias[dia.key] || { aberto: false, intervalos: [] };
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

function renderFilas(draft) {
    const filas = draft.filas || [];
    const container = document.getElementById('secFilas');
    if (filas.length === 0) {
        container.appendChild(el('p', { class: 'resumo-empty', text: 'Nenhuma fila cadastrada.' }));
        return;
    }
    const table = el('table', { class: 'resumo-table' });
    table.appendChild(el('tr', {}, [
        el('th', { text: '#' }), el('th', { text: 'Nome da Fila' }), el('th', { text: 'Descrição' })
    ]));
    filas.forEach((f, i) => {
        table.appendChild(el('tr', {}, [
            el('td', { text: String(i + 1) }),
            el('td', { text: f.nome || '—' }),
            el('td', { text: f.descricao || '—' })
        ]));
    });
    container.appendChild(table);
}

function renderAgentes(draft) {
    const agentes = draft.agentes || [];
    const container = document.getElementById('secAgentes');
    if (agentes.length === 0) {
        container.appendChild(el('p', { class: 'resumo-empty', text: 'Nenhum agente cadastrado.' }));
        return;
    }
    const table = el('table', { class: 'resumo-table' });
    table.appendChild(el('tr', {}, [
        el('th', { text: '#' }), el('th', { text: 'Nome' }), el('th', { text: 'Perfil' }), el('th', { text: 'Filas vinculadas' })
    ]));
    agentes.forEach((a, i) => {
        table.appendChild(el('tr', {}, [
            el('td', { text: String(i + 1) }),
            el('td', { text: a.nome || '—' }),
            el('td', { text: a.perfil || '—' }),
            el('td', { text: (a.filas || []).join(', ') || '—' })
        ]));
    });
    container.appendChild(table);
}

function renderHorarios(draft) {
    const hor = draft.horario || {};
    const container = document.getElementById('secHorarios');
    container.appendChild(fieldBlock('Horário de atendimento', scheduleResumoTexto(hor.dias)));
    container.appendChild(fieldBlock('Fora do horário', hor.msgFora === 'direcionar'
        ? `Direciona para a fila "${hor.filaFora || '(não selecionada)'}"`
        : 'Encerra o atendimento com mensagem automática'));
}

function renderConfig(draft) {
    const cfg = draft.config || {};
    const container = document.getElementById('secConfig');

    container.appendChild(el('div', { class: 'resumo-subtitle', text: 'Cliente parado no menu do BOT' }));
    container.appendChild(fieldBlock('Tempo de espera',
        cfg.tempoBotMode === 'alterar' ? `${cfg.tempoBot || '?'} minutos` : '20 minutos (padrão)'));
    container.appendChild(fieldBlock('Ação após o tempo',
        cfg.tempoBotAcao === 'direcionar' ? `Direcionar para fila: ${cfg.tempoBotFila || '?'}` : 'Encerrar o atendimento'));

    container.appendChild(el('div', { class: 'resumo-subtitle', text: 'Abandono de conversa' }));
    container.appendChild(fieldBlock('Tempo para encerramento',
        cfg.semInteracaoMode === 'alterar' ? `${cfg.semInteracaoMin || '?'} minutos` :
        cfg.semInteracaoMode === 'nao_encerrar' ? 'Nunca encerrar' : '24 horas (padrão)'));

    container.appendChild(el('div', { class: 'resumo-subtitle', text: 'Erros de menu' }));
    container.appendChild(fieldBlock('Limite de tentativas',
        cfg.tentativasMode === 'alterar' ? `${cfg.tentativas || '?'} tentativas` : '5 tentativas (padrão)'));
    container.appendChild(fieldBlock('Fila para redirecionamento', cfg.tentativasFila || '—'));

    container.appendChild(el('div', { class: 'resumo-subtitle', text: 'Mensagens automáticas' }));
    const mensagens = cfg.mensagens || {};
    MENSAGENS_PADRAO.forEach(m => {
        const entry = mensagens[m.id];
        const isCustom = entry && entry.mode === 'custom';
        container.appendChild(msgBlock(
            m.titulo + (isCustom ? ' (personalizada)' : ' (padrão do sistema)'),
            entry ? entry.texto : ''
        ));
    });

    const respostas = cfg.respostasRapidas || [];
    if (respostas.length > 0) {
        container.appendChild(el('div', { class: 'resumo-subtitle', text: 'Respostas rápidas' }));
        const table = el('table', { class: 'resumo-table' });
        table.appendChild(el('tr', {}, [el('th', { text: 'Título' }), el('th', { text: 'Mensagem' })]));
        respostas.forEach(r => {
            table.appendChild(el('tr', {}, [
                el('td', { text: r.titulo || '—' }),
                el('td', { text: r.texto || '—' })
            ]));
        });
        container.appendChild(table);
    }
}

function renderNumeros(draft) {
    const nums = draft.numeros || {};
    const container = document.getElementById('secNumeros');
    container.appendChild(fieldBlock('Número principal', nums.principal));
    container.appendChild(fieldBlock('Número já está ativo', nums.ativo === 'nao' ? 'Não' : 'Sim'));
    container.appendChild(fieldBlock('URA (Unidade de Resposta Audível)', nums.ura === 'sim' ? 'Sim' : 'Não'));
    if (nums.ura === 'sim') {
        container.appendChild(fieldBlock('Contato do responsável pela URA', nums.uraResponsavel || 'Não informado'));
    }
}

function renderAgenda() {
    const container = document.getElementById('secAgenda');
    container.appendChild(el('p', { class: 'resumo-empty', text: 'Sem campos próprios — o arquivo de contatos anexado (se houver) aparece na seção Anexos, abaixo.' }));
}

function renderApiOficial() {
    const container = document.getElementById('secApiOficial');
    container.appendChild(el('p', { class: 'resumo-empty', text: 'Etapa ainda em desenvolvimento nesta versão do formulário — sem configuração para exibir.' }));
}

/* Substitui {{1}}, {{2}}... pelo exemplo cadastrado — mesmo padrão da prévia da Etapa 7 (script.js) */
function tplMensagemHtml(mensagem, variaveis) {
    return escapeHtml(mensagem || '').replace(/\{\{\s*(\d+)\s*\}\}/g, (m, idx) => {
        const exemplo = variaveis && variaveis[idx];
        return `<strong>${escapeHtml(exemplo || m)}</strong>`;
    });
}

function renderTemplates(draft) {
    const container = document.getElementById('secTemplates');
    const itens = (draft.templates && draft.templates.itens) || [];
    if (!itens.length) {
        container.appendChild(el('p', { class: 'resumo-empty', text: 'Nenhum template criado.' }));
        return;
    }
    itens.forEach(t => {
        container.appendChild(el('div', { class: 'resumo-subtitle', text: `${t.nome} · ${t.categoria}` }));
        container.appendChild(el('div', { class: 'resumo-msg-block', html: tplMensagemHtml(t.mensagem, t.variaveis) }));
        if (Array.isArray(t.botoes) && t.botoes.length) {
            container.appendChild(fieldBlock('Botões de resposta rápida', t.botoes.join('  ·  ')));
        }
    });
}

const STEP_LABELS = {
    1: 'Filas', 2: 'Agentes', 3: 'Horários', 4: 'Configurações', 5: 'Números',
    6: 'API Oficial', 7: 'Templates', 8: 'Agenda', 9: 'BOT',
};

function renderAnexos(attachments, submissionId) {
    const container = document.getElementById('secAnexos');
    if (!attachments.length) {
        container.appendChild(el('p', { class: 'resumo-empty', text: 'Nenhum arquivo anexado neste levantamento.' }));
        return;
    }
    const list = el('ul', { class: 'resumo-anexos-list' });
    attachments.forEach(file => {
        const li = el('li', { class: 'resumo-anexos-item' }, [
            el('span', { class: 'resumo-anexos-step', text: STEP_LABELS[file.stepNumber] || `Etapa ${file.stepNumber}` }),
            el('a', {
                class: 'resumo-anexos-link',
                href: `/api/submissions/${submissionId}/attachments/${file.id}/download`,
                target: '_blank',
                rel: 'noopener',
                text: `📄 ${file.originalName}`,
            }),
        ]);
        list.appendChild(li);
    });
    container.appendChild(list);
}

function renderBot(draft) {
    const bot = draft.bot || {};
    const container = document.getElementById('secBot');
    if (!bot.resumoFluxo || !bot.totalBlocos) {
        container.appendChild(el('p', { class: 'resumo-empty', text: 'Fluxo do BOT ainda não configurado no editor visual.' }));
        return;
    }
    container.appendChild(fieldBlock('Total de blocos no fluxo', String(bot.totalBlocos)));
    container.appendChild(el('pre', { class: 'resumo-flow-summary', text: bot.resumoFluxo }));
}

function renderCover(submission, draft) {
    document.getElementById('coverClientName').textContent = submission.clientName || '';
    const gerado = new Date(submission.updatedAt || Date.now());
    document.getElementById('coverDate').textContent =
        'Gerado em: ' + gerado.toLocaleDateString('pt-BR') + '  ' +
        gerado.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const filas = draft.filas || [];
    const agentes = draft.agentes || [];
    const blocos = (draft.bot && draft.bot.totalBlocos) || 0;
    const stats = [
        { n: filas.length, label: filas.length === 1 ? 'fila' : 'filas' },
        { n: agentes.length, label: agentes.length === 1 ? 'agente' : 'agentes' },
        { n: blocos, label: 'blocos no fluxo' }
    ];
    const statsEl = document.getElementById('coverStats');
    stats.forEach(s => {
        statsEl.appendChild(el('div', { class: 'resumo-stat' }, [
            el('span', { class: 'resumo-stat-num', text: String(s.n) }),
            el('span', { class: 'resumo-stat-label', text: s.label })
        ]));
    });
}

function showError(message) {
    document.getElementById('resumoError').hidden = false;
    document.getElementById('resumoErrorMsg').textContent = message;
    document.documentElement.style.visibility = 'visible';
}

async function loadResumo() {
    const user = await requireAuth();
    if (!user) return;

    // Quem chega aqui pela Área ADM (clientes.html) precisa voltar pra lá — não
    // pro formulário do cliente, que nem faz sentido pro papel de super_admin.
    const backLink = document.getElementById('resumoBackLink');
    if (user.role === 'super_admin') {
        backLink.href = 'clientes.html';
        backLink.lastChild.textContent = ' Voltar para Clientes';
    }

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) {
        showError('Nenhum levantamento informado (parâmetro "id" ausente na URL).');
        return;
    }

    let submission;
    try {
        const res = await fetch(`/api/submissions/${id}`, { credentials: 'include' });
        if (!res.ok) {
            showError(res.status === 404
                ? 'Levantamento não encontrado, ou você não tem acesso a ele.'
                : 'Não foi possível carregar este levantamento.');
            return;
        }
        submission = await res.json();
    } catch (e) {
        showError('Não foi possível conectar ao servidor.');
        return;
    }

    const draft = submission.formData || {};
    renderCover(submission, draft);
    renderFilas(draft);
    renderAgentes(draft);
    renderHorarios(draft);
    renderConfig(draft);
    renderNumeros(draft);
    renderApiOficial();
    renderTemplates(draft);
    renderAgenda();
    renderBot(draft);

    let attachments = [];
    try {
        const attRes = await fetch(`/api/submissions/${id}/attachments`, { credentials: 'include' });
        if (attRes.ok) attachments = await attRes.json();
    } catch (e) { /* segue sem anexos — a seção mostra "nenhum arquivo" */ }
    renderAnexos(attachments, id);

    document.getElementById('resumoStatus').textContent =
        submission.status === 'enviado' ? 'Levantamento enviado' : 'Rascunho';
    document.getElementById('resumoDoc').hidden = false;
    document.documentElement.style.visibility = 'visible';
}

document.getElementById('btnBaixarPdf').addEventListener('click', () => window.print());

loadResumo();
