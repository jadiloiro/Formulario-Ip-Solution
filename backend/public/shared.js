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

/* Identificador deste navegador: isola qual rascunho é "meu" no backend,
   evitando que duas pessoas preenchendo ao mesmo tempo se sobrescrevam. */
const CLIENT_ID_KEY = 'ipsolution_client_id';
function getClientId() {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
        id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
        localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
}
