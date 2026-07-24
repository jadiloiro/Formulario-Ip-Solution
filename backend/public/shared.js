/* ==============================================================
   Utilitários compartilhados entre index.html (script.js) e
   Flowchart.html (Flowchart.js) — carregado antes dos dois.
   ============================================================== */

'use strict';

function escapeHtml(str) {
    return (str == null ? '' : String(str))
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function debounce(fn, wait) {
    let t;
    return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

/* ========================= Autenticação =========================
   A sessão em si é um cookie httpOnly (o JS nunca a lê nem a escreve — isso é
   proposital, protege contra roubo de sessão via XSS). O que fica em localStorage
   é só um "espelho" do usuário logado (id/login/role/módulos), pra UI decidir o
   que mostrar sem precisar bater na API a cada clique. Todo fetch autenticado
   ainda precisa de credentials:'include' pra levar o cookie. */
const AUTH_USER_KEY = 'ipsolution_auth_user';

function getAuthUser() {
    try {
        const raw = localStorage.getItem(AUTH_USER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function setAuthUser(user) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function clearAuthUser() {
    localStorage.removeItem(AUTH_USER_KEY);
}

/** Confirma a sessão com o backend (fonte da verdade) e mantém o espelho local
 *  atualizado. Redireciona para login.html se não houver sessão válida. */
async function requireAuth() {
    try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) {
            clearAuthUser();
            window.location.href = 'login.html';
            return null;
        }
        const { user } = await res.json();
        setAuthUser(user);
        if (user.mustChangePassword) {
            window.location.href = 'login.html';
            return null;
        }
        document.documentElement.style.visibility = 'visible';
        return user;
    } catch (e) {
        clearAuthUser();
        window.location.href = 'login.html';
        return null;
    }
}

async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) { /* mesmo se a rede falhar, limpa o lado do cliente */ }
    clearAuthUser();
    clearLocalOnboardingDraft();
    window.location.href = 'login.html';
}

/* O rascunho do onboarding (script.js: STORAGE.DRAFT e afins) fica em localStorage,
   que não é isolado por sessão — se outro cliente logar neste mesmo navegador antes
   de o dono voltar, ele herdaria esse progresso. Limpa tudo no logout para que a
   próxima conta a logar aqui sempre comece do zero (restoreDraft também confere um
   carimbo de dono como segunda camada, para o caso de a sessão expirar sem "Sair"). */
function clearLocalOnboardingDraft() {
    ['currentStep', 'ipsolution_form_draft', 'ipsolution_draft_owner', 'ipsolution_flow_v2', 'ipsolution_shared_flow_data']
        .forEach(key => localStorage.removeItem(key));
}
