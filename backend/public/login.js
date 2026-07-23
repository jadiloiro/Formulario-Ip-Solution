'use strict';

function destinationFor(user) {
    return user.role === 'super_admin' ? 'admin.html' : 'index.html';
}

async function checkExistingSession() {
    try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) return;
        const { user } = await res.json();
        setAuthUser(user);
        if (!user.mustChangePassword) {
            window.location.href = destinationFor(user);
        } else {
            showChangePasswordForm();
        }
    } catch (e) { /* sem sessão: fica na tela de login normalmente */ }
}

function showError(elId, message) {
    const el = document.getElementById(elId);
    el.textContent = message;
    el.hidden = false;
}

function hideError(elId) {
    document.getElementById(elId).hidden = true;
}

function showChangePasswordForm() {
    document.getElementById('loginForm').hidden = true;
    document.getElementById('changePasswordForm').hidden = false;
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError('loginError');
    const login = document.getElementById('loginInput').value.trim();
    const senha = document.getElementById('senhaInput').value;
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, senha }),
        });
        if (!res.ok) {
            showError('loginError', 'Login ou senha inválidos.');
            return;
        }
        const { user } = await res.json();
        setAuthUser(user);
        if (user.mustChangePassword) {
            showChangePasswordForm();
        } else {
            window.location.href = destinationFor(user);
        }
    } catch (e) {
        showError('loginError', 'Não foi possível conectar ao servidor. Tente novamente.');
    } finally {
        btn.disabled = false;
    }
});

document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError('changePasswordError');
    const senhaAtual = document.getElementById('senhaAtualInput').value;
    const novaSenha = document.getElementById('novaSenhaInput').value;
    const confirmar = document.getElementById('confirmarSenhaInput').value;
    const btn = document.getElementById('changePasswordBtn');

    if (novaSenha !== confirmar) {
        showError('changePasswordError', 'As senhas novas não conferem.');
        return;
    }

    btn.disabled = true;
    try {
        const res = await fetch('/api/auth/change-password', {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senhaAtual, novaSenha }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            showError('changePasswordError', body.message || 'Não foi possível trocar a senha.');
            return;
        }
        const meRes = await fetch('/api/auth/me', { credentials: 'include' });
        const { user } = await meRes.json();
        setAuthUser(user);
        window.location.href = destinationFor(user);
    } catch (e) {
        showError('changePasswordError', 'Não foi possível conectar ao servidor. Tente novamente.');
    } finally {
        btn.disabled = false;
    }
});

checkExistingSession();
