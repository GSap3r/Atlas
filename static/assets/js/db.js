// ==============================================
// ARQUIVO: atlas/assets/js/db.js
// Versão 4 — antes falava com IndexedDB (navegador),
// agora fala com a API Python (Flask + PostgreSQL).
// Mantém exatamente a mesma interface pública usada
// pelo resto do app (open, getAll, getById, save,
// remove, clearStore, exportAll, importAll,
// marcarAlteracao), então nenhum outro arquivo js
// precisa ser alterado.
// ==============================================
const DB = (() => {
  const API_BASE = '/api';

  async function _req(path, options = {}) {
    const res = await fetch(API_BASE + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok && res.status !== 404) {
      const texto = await res.text().catch(() => '');
      throw new Error(`Erro na API (${res.status}): ${texto}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  // Mantido apenas por compatibilidade — a conexão real
  // agora é feita pelo backend Python a cada requisição.
  function open() {
    return Promise.resolve(true);
  }

  function getAll(store) {
    return _req(`/${store}`);
  }

  function getById(store, id) {
    return _req(`/${store}/${encodeURIComponent(id)}`);
  }

  function save(store, item) {
    return _req(`/${store}`, {
      method: 'POST',
      body: JSON.stringify(item),
    });
  }

  function remove(store, id) {
    return _req(`/${store}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  function clearStore(store) {
    return _req(`/${store}`, { method: 'DELETE' });
  }

  // Marca que houve alteração nos dados (para controle de backup automático).
  // No backend Python isso já acontece automaticamente a cada save/remove/clear,
  // mas mantemos a função para compatibilidade com o restante do app.
  async function marcarAlteracao() {
    try {
      await save('meta', { key: 'lastDataChangeAt', value: new Date().toISOString() });
    } catch (e) { /* silencioso */ }
  }

  async function exportAll() {
    return _req('/export');
  }

  async function importAll(rawData) {
    return _req('/import', {
      method: 'POST',
      body: JSON.stringify(rawData),
    });
  }

  return { open, getAll, getById, save, remove, clearStore, exportAll, importAll, marcarAlteracao };
})();
