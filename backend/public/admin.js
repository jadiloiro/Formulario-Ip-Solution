'use strict';

async function guardSuperAdmin() {
    const user = await requireAuth();
    if (!user) return; // requireAuth já redirecionou pro login
    if (user.role !== 'super_admin') {
        window.location.href = 'index.html';
    }
}

document.getElementById('logoutBtn').addEventListener('click', logout);

document.getElementById('createClientForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('createClientError');
    const successEl = document.getElementById('createClientSuccess');
    errorEl.hidden = true;
    successEl.hidden = true;

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

    const btn = document.getElementById('createClientBtn');
    btn.disabled = true;
    try {
        const res = await fetch('/api/users', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientName, login, senha, moduleWhatsapp, moduleTelefonia }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            errorEl.textContent = body.message || 'Não foi possível criar o acesso.';
            errorEl.hidden = false;
            return;
        }
        successEl.textContent = `Acesso criado! Login: ${body.login} — a senha inicial informada deve ser trocada por ele no 1º acesso.`;
        successEl.hidden = false;
        e.target.reset();
    } catch (err) {
        errorEl.textContent = 'Não foi possível conectar ao servidor. Tente novamente.';
        errorEl.hidden = false;
    } finally {
        btn.disabled = false;
    }
});

guardSuperAdmin();
