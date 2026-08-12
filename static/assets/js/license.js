// ==============================================
// ARQUIVO: atlas/assets/js/license.js
// Sistema de Licença Atlas — MODO OFFLINE
// ==============================================
const License = (() => {

  // ── Chaves localStorage ─────────────────────
  const K_KEY        = 'atlas_license_key';
  const K_DATA       = 'atlas_license_data';
  const K_LAST_CHECK = 'atlas_license_checked';
  const K_BLOCKED    = 'atlas_license_blocked';

  const CHECK_INTERVAL_MS = 48 * 60 * 60 * 1000;

  // ── API (desativada no modo offline) ────────
  const API_BASE = 'https://controle.atlas.app/wp-json/atlas/v1';
  const PLUGIN_SLUG = '';

  function getDomain() {
    if (window.location.protocol === 'file:') return 'local';
    return window.location.hostname || 'local';
  }

  function getKey()  { return localStorage.getItem(K_KEY) || ''; }
  function getData() {
    try { return JSON.parse(localStorage.getItem(K_DATA) || '{}'); } catch { return {}; }
  }
  function setData(d)    { localStorage.setItem(K_DATA, JSON.stringify(d)); }
  function getLastCheck() { return parseInt(localStorage.getItem(K_LAST_CHECK) || '0', 10); }
  function setLastCheck() { localStorage.setItem(K_LAST_CHECK, Date.now().toString()); }
  function isBlocked()   { return localStorage.getItem(K_BLOCKED) === 'true'; }
  function setBlocked(v) { localStorage.setItem(K_BLOCKED, v ? 'true' : 'false'); }

  function needsCheck() {
    if (!getKey()) return false;
    return (Date.now() - getLastCheck()) > CHECK_INTERVAL_MS;
  }

  // ── API call (mantido mas não usado) ────────
  async function callAPI(endpoint, body) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) return { ok: false, reason: 'http_' + res.status };
      return await res.json();
    } catch (e) {
      return { ok: false, reason: 'network_error', offline: true };
    }
  }

  // ── Ativar licença (SEM validação online) ───
  async function activate(licenseKey) {
    const key = licenseKey.trim();
    if (!key) return { ok: false, reason: 'empty_key' };

    // MODO OFFLINE: salva localmente sem perguntar ao servidor
    localStorage.setItem(K_KEY, key);
    const clientData = {
      name:  'Usuário Local',
      cpf:   '',
      email: '',
      phone: '',
      expires_at: 0,
    };
    setData(clientData);
    setLastCheck();
    setBlocked(false);
    return { ok: true, data: clientData };
  }

  // ── Check periódico (SEM validação online) ──
  async function check() {
    const key = getKey();
    if (!key) return;

    // MODO OFFLINE: apenas renova o timestamp local, nunca bloqueia
    const clientData = getData();
    setData(clientData);
    setLastCheck();
    setBlocked(false);
  }

  // ── Modal de bloqueio (nunca usado no offline) ─
  function showBlockedModal(reason, buyUrl) {
    const old = document.getElementById('atlas-license-modal');
    if (old) old.remove();

    const reasonMap = {
      'expired':      'Sua licença expirou.',
      'inactive':     'Sua licença está inativa.',
      'no_credits':   'Sua licença não tem créditos.',
      'domain_limit': 'Limite de dispositivos atingido.',
      'not_allowed':  'Este produto não está na sua licença.',
      'license_not_found': 'Chave de licença não encontrada.',
    };
    const msg = reasonMap[reason] || 'Licença inválida ou expirada.';

    const overlay = document.createElement('div');
    overlay.id = 'atlas-license-modal';
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:99999;
      display:flex;align-items:center;justify-content:center;
      font-family:'DM Sans',sans-serif;
    `;
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:40px;max-width:460px;width:90%;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,.3)">
        <div style="font-size:48px;margin-bottom:16px">🔒</div>
        <h2 style="color:#172033;font-size:22px;margin:0 0 8px">Acesso bloqueado</h2>
        <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 24px">${msg}<br>Valide sua licença para continuar.</p>
        <div style="display:flex;flex-direction:column;gap:10px">
          <button id="atlas-lic-revalidate" style="background:#2E93B0;color:#fff;border:none;border-radius:8px;padding:12px 24px;font-size:15px;cursor:pointer;font-weight:600">
            Inserir chave de licença
          </button>
          ${buyUrl ? `<a href="${buyUrl}" target="_blank" style="color:#2E93B0;font-size:14px;text-decoration:none">Renovar / Comprar →</a>` : ''}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('atlas-lic-revalidate').addEventListener('click', () => {
      overlay.remove();
      showActivationModal();
    });
  }

  // ── Modal de ativação ─────────────────────────
  function showActivationModal(onSuccess) {
    const old = document.getElementById('atlas-activate-modal');
    if (old) old.remove();

    const hasKey = !!getKey();

    const overlay = document.createElement('div');
    overlay.id = 'atlas-activate-modal';
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:99999;
      display:flex;align-items:center;justify-content:center;
      font-family:'DM Sans',sans-serif;
    `;
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:40px;max-width:480px;width:90%;box-shadow:0 24px 80px rgba(0,0,0,.3)">
        <div style="font-size:42px;text-align:center;margin-bottom:12px">🔑</div>
        <h2 style="color:#172033;font-size:20px;margin:0 0 8px;text-align:center">Ativar Atlas</h2>
        <p style="color:#666;font-size:14px;text-align:center;margin:0 0 24px">
          Modo offline: digite qualquer chave para continuar.
        </p>
        <input id="atlas-lic-input" type="text" placeholder="Qualquer chave funciona..."
          style="width:100%;box-sizing:border-box;border:2px solid #E4E7EC;border-radius:8px;padding:12px 14px;font-size:15px;font-family:monospace;margin-bottom:12px">
        <div id="atlas-lic-error" style="color:#B91C1C;font-size:13px;margin-bottom:12px;display:none"></div>
        <button id="atlas-lic-activate-btn" style="width:100%;background:#2E93B0;color:#fff;border:none;border-radius:8px;padding:13px;font-size:15px;cursor:pointer;font-weight:600">
          Ativar licença
        </button>
        ${hasKey ? '<button id="atlas-lic-cancel" style="width:100%;margin-top:10px;background:none;border:1px solid #ddd;border-radius:8px;padding:10px;font-size:14px;cursor:pointer;color:#666">Cancelar</button>' : ''}
      </div>
    `;
    document.body.appendChild(overlay);

    const input = document.getElementById('atlas-lic-input');
    const btn   = document.getElementById('atlas-lic-activate-btn');
    const errEl = document.getElementById('atlas-lic-error');

    const cur = getKey();
    if (cur) input.value = cur;

    document.getElementById('atlas-lic-cancel')?.addEventListener('click', () => overlay.remove());

    if (!hasKey) {
      overlay.addEventListener('click', e => { if (e.target === overlay) e.stopPropagation(); });
    }

    async function doActivate() {
      const key = input.value.trim();
      if (!key) { errEl.textContent = 'Digite uma chave (qualquer uma).'; errEl.style.display='block'; return; }
      btn.textContent = 'Verificando...';
      btn.disabled = true;
      errEl.style.display = 'none';

      const result = await activate(key);
      if (result.ok) {
        overlay.remove();
        if (typeof _injectLicenseFooter === 'function') _injectLicenseFooter();
        if (typeof onSuccess === 'function') onSuccess(result.data);
        else {
          if (typeof navigateTo === 'function') navigateTo('configuracoes');
          if (typeof Utils !== 'undefined') Utils.showToast('Licença ativada offline! ✓', 'success');
        }
      } else {
        errEl.textContent = 'Erro inesperado.';
        errEl.style.display = 'block';
        btn.textContent = 'Ativar licença';
        btn.disabled = false;
      }
    }

    btn.addEventListener('click', doActivate);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') doActivate(); });
  }

  // ── Rodapé de licença ─────────────────────────
  function getLicenseFooterText() {
    if (!getKey()) return '';
    const d = getData();
    if (!d.name && !d.cpf && !d.email) return '';

    const parts = ['Licenciado para'];
    if (d.name)  parts.push(d.name);
    if (d.cpf)   parts.push('CPF: ' + d.cpf);
    if (d.email) parts.push(d.email);
    if (d.phone) parts.push(d.phone);
    return parts.join(' · ');
  }

  function getLicenseFooterHTML() {
    const txt = getLicenseFooterText();
    if (!txt) return '';
    return `<div class="license-footer-bar">${Utils.escHtml ? Utils.escHtml(txt) : txt}</div>`;
  }

  function getLicenseFooterPDFHTML() {
    const txt = getLicenseFooterText();
    if (!txt) return '';
    return `<div class="license-footer">${txt}</div>`;
  }

  // ── Init: sem verificação online ──────────────
  async function init() {
    const key = getKey();

    // Sem chave — mostra modal, mas aceita qualquer uma
    if (!key) {
      setTimeout(() => showActivationModal(), 600);
      return;
    }

    // Se tinha chave, apenas limpa o bloqueio e segue
    setBlocked(false);
    setLastCheck();

    // Não verifica online nunca
  }

  // API pública
  return {
    init,
    activate,
    check,
    getKey,
    getData,
    isBlocked,
    showActivationModal,
    showBlockedModal,
    getLicenseFooterText,
    getLicenseFooterHTML,
    getLicenseFooterPDFHTML,
    needsCheck,
  };

})();