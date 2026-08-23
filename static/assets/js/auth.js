// ==============================================
// ARQUIVO: atlas/assets/js/auth.js
// Login, sessão e permissão por página.
// ==============================================
const Auth = (() => {
  const API_BASE = '/api/auth';
  let currentUser = null;

  async function _req(path, options = {}) {
    const res = await fetch(API_BASE + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    let body = null;
    try { body = await res.json(); } catch (e) { /* sem corpo */ }
    return { ok: res.ok, status: res.status, body };
  }

  async function checkSession() {
    const { ok, body } = await _req('/me');
    currentUser = ok ? body : null;
    return currentUser;
  }

  async function login(username, senha) {
    const { ok, body } = await _req('/login', {
      method: 'POST',
      body: JSON.stringify({ username, senha }),
    });
    if (ok) currentUser = body;
    return { ok, erro: ok ? null : (body?.erro || 'Não foi possível entrar') };
  }

  async function logout() {
    await _req('/logout', { method: 'POST' });
    currentUser = null;
  }

  async function trocarMinhaSenha(senhaAtual, novaSenha) {
    const { ok, body } = await _req('/me/senha', {
      method: 'POST',
      body: JSON.stringify({ senhaAtual, novaSenha }),
    });
    return { ok, erro: ok ? null : (body?.erro || 'Não foi possível trocar a senha') };
  }

  function isAdmin() {
    return currentUser?.role === 'admin';
  }

  function hasAccess(page) {
    if (!currentUser) return false;
    if (isAdmin()) return true;
    if (page === 'excursao') page = 'excursoes';
    return (currentUser.paginas || []).includes(page);
  }

  function getUser() {
    return currentUser;
  }

  // ── ADMIN: GESTÃO DE USUÁRIOS ─────────────────────────────────────
  async function listarUsuarios() {
    const { ok, body } = await _req('/usuarios');
    return ok ? body : [];
  }

  async function salvarUsuario(dados) {
    const { ok, body } = await _req('/usuarios', {
      method: 'POST',
      body: JSON.stringify(dados),
    });
    return { ok, body, erro: ok ? null : (body?.erro || 'Não foi possível salvar') };
  }

  async function desativarUsuario(id) {
    const { ok, body } = await _req(`/usuarios/${encodeURIComponent(id)}/desativar`, { method: 'POST' });
    return { ok, erro: ok ? null : (body?.erro || 'Não foi possível desativar') };
  }

  async function reativarUsuario(id) {
    const { ok, body } = await _req(`/usuarios/${encodeURIComponent(id)}/reativar`, { method: 'POST' });
    return { ok, erro: ok ? null : (body?.erro || 'Não foi possível reativar') };
  }

  return {
    checkSession, login, logout, trocarMinhaSenha,
    isAdmin, hasAccess, getUser,
    listarUsuarios, salvarUsuario, desativarUsuario, reativarUsuario,
  };
})();
