// ==============================================
// ARQUIVO: ibexgo/assets/js/license.js
// Sistema de Licença ibexGo
// ==============================================
const License = (() => {

  // ── Chaves localStorage ─────────────────────
  const K_KEY        = 'ibexgo_license_key';
  const K_DATA       = 'ibexgo_license_data';   // dados do cliente (nome, cpf, email...)
  const K_LAST_CHECK = 'ibexgo_license_checked'; // timestamp da última verificação bem-sucedida
  const K_BLOCKED    = 'ibexgo_license_blocked'; // 'true' se bloqueado por falha online

  // Verificação a cada 48h (em ms)
  const CHECK_INTERVAL_MS = 48 * 60 * 60 * 1000;

  // ── API endpoint — altere para o domínio real ─
const API_BASE = 'https://controle.ibexgo.app/wp-json/ibexgo/v1';
const PLUGIN_SLUG = '';

  // ── Domínio local para antifraude ─────────────
  function getDomain() {
    if (window.location.protocol === 'file:') return 'local';
    return window.location.hostname || 'local';
  }

  // ── Leitura / escrita ─────────────────────────
  function getKey()  { return localStorage.getItem(K_KEY) || ''; }
  function getData() {
    try { return JSON.parse(localStorage.getItem(K_DATA) || '{}'); } catch { return {}; }
  }
  function setData(d)    { localStorage.setItem(K_DATA, JSON.stringify(d)); }
  function getLastCheck() { return parseInt(localStorage.getItem(K_LAST_CHECK) || '0', 10); }
  function setLastCheck() { localStorage.setItem(K_LAST_CHECK, Date.now().toString()); }
  function isBlocked()   { return localStorage.getItem(K_BLOCKED) === 'true'; }
  function setBlocked(v) { localStorage.setItem(K_BLOCKED, v ? 'true' : 'false'); }

  // ── Verifica se precisa checar (48h) ──────────
  function needsCheck() {
    if (!getKey()) return false; // sem chave, não precisa
    return (Date.now() - getLastCheck()) > CHECK_INTERVAL_MS;
  }

  // ── Chamada à API ─────────────────────────────
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

  // ── Ativar licença (primeira vez ou reativação) ─
  async function activate(licenseKey) {
    const key = licenseKey.trim();
    if (!key) return { ok: false, reason: 'empty_key' };

    // /activate amarra o domínio
    const res = await callAPI('/activate', {
      license_key: key,
      domain:      getDomain(),
      plugin_slug: PLUGIN_SLUG,
    });

    if (res?.active === true) {
      localStorage.setItem(K_KEY, key);
      const clientData = {
        name:  res.customer_name  || '',
        cpf:   res.customer_cpf   || '',
        email: res.customer_email || '',
        phone: res.customer_phone || '',
        expires_at: res.expires_at || 0,
      };
      setData(clientData);
      setLastCheck();
      setBlocked(false);
      return { ok: true, data: clientData };
    }

    return { ok: false, reason: res?.reason || 'unknown', buy_url: res?.buy_url || '' };
  }

  // ── Check periódico (48h) ─────────────────────
  async function check() {
    const key = getKey();
    if (!key) return; // sem chave = nunca ativou

    const res = await callAPI('/check', {
      license_key: key,
      domain:      getDomain(),
      plugin_slug: PLUGIN_SLUG,
    });

    // Sem internet — se já tinha verificado antes, mantém funcionando
    if (res?.offline || res?.reason === 'network_error') {
      // Já tinha verificado alguma vez? Mantém.
      if (getLastCheck() > 0) {
        setBlocked(false); // não bloqueia offline
      }
      return;
    }

    if (res?.active === true) {
      // Atualiza dados do cliente com os dados mais recentes
      const clientData = {
        name:  res.customer_name  || getData().name  || '',
        cpf:   res.customer_cpf   || getData().cpf   || '',
        email: res.customer_email || getData().email || '',
        phone: res.customer_phone || getData().phone || '',
        expires_at: res.expires_at || 0,
      };
      setData(clientData);
      setLastCheck();
      setBlocked(false);
    } else {
      // Online mas licença inválida/expirada → bloqueia
      setBlocked(true);
      showBlockedModal(res?.reason || 'expired', res?.buy_url || '');
    }
  }

  // ── Modal de bloqueio ─────────────────────────
  function showBlockedModal(reason, buyUrl) {
    // Remove modal existente
    const old = document.getElementById('ibex-license-modal');
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
    overlay.id = 'ibex-license-modal';
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
          <button id="ibex-lic-revalidate" style="background:#14539B;color:#fff;border:none;border-radius:8px;padding:12px 24px;font-size:15px;cursor:pointer;font-weight:600">
            Inserir chave de licença
          </button>
          ${buyUrl ? `<a href="${buyUrl}" target="_blank" style="color:#14539B;font-size:14px;text-decoration:none">Renovar / Comprar →</a>` : ''}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('ibex-lic-revalidate').addEventListener('click', () => {
      overlay.remove();
      showActivationModal();
    });
  }

  // ── Modal de ativação ─────────────────────────
  function showActivationModal(onSuccess) {
    const old = document.getElementById('ibex-activate-modal');
    if (old) old.remove();

    // Se já tem chave (só está alterando), permite fechar. Sem chave = inescapável.
    const hasKey = !!getKey();

    const overlay = document.createElement('div');
    overlay.id = 'ibex-activate-modal';
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:99999;
      display:flex;align-items:center;justify-content:center;
      font-family:'DM Sans',sans-serif;
    `;
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:40px;max-width:480px;width:90%;box-shadow:0 24px 80px rgba(0,0,0,.3)">
        <div style="font-size:42px;text-align:center;margin-bottom:12px">🔑</div>
        <h2 style="color:#172033;font-size:20px;margin:0 0 8px;text-align:center">Ativar ibexGo</h2>
        <p style="color:#666;font-size:14px;text-align:center;margin:0 0 24px">
          Insira a chave de licença recebida no e-mail após a compra.
        </p>
        <input id="ibex-lic-input" type="text" placeholder="tdy4f989srhjiwfcvano3rxtyvjf"
          style="width:100%;box-sizing:border-box;border:2px solid #E4E7EC;border-radius:8px;padding:12px 14px;font-size:15px;font-family:monospace;margin-bottom:12px">
        <div id="ibex-lic-error" style="color:#B91C1C;font-size:13px;margin-bottom:12px;display:none"></div>
        <button id="ibex-lic-activate-btn" style="width:100%;background:#14539B;color:#fff;border:none;border-radius:8px;padding:13px;font-size:15px;cursor:pointer;font-weight:600">
          Ativar licença
        </button>
        ${hasKey ? '<button id="ibex-lic-cancel" style="width:100%;margin-top:10px;background:none;border:1px solid #ddd;border-radius:8px;padding:10px;font-size:14px;cursor:pointer;color:#666">Cancelar</button>' : ''}
      </div>
    `;
    document.body.appendChild(overlay);

    const input = document.getElementById('ibex-lic-input');
    const btn   = document.getElementById('ibex-lic-activate-btn');
    const errEl = document.getElementById('ibex-lic-error');

    // Preenche com chave atual se houver
    const cur = getKey();
    if (cur) input.value = cur;

    // Cancelar só existe se já tem chave
    document.getElementById('ibex-lic-cancel')?.addEventListener('click', () => overlay.remove());

    // Bloqueia clique fora quando não tem chave
    if (!hasKey) {
      overlay.addEventListener('click', e => { if (e.target === overlay) e.stopPropagation(); });
    }

    async function doActivate() {
      const key = input.value.trim();
      if (!key) { errEl.textContent = 'Digite a chave de licença.'; errEl.style.display='block'; return; }
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
          if (typeof Utils !== 'undefined') Utils.showToast('Licença ativada com sucesso! ✓', 'success');
        }
      } else {
        const errMap = {
          'expired':           'Esta chave está expirada.',
          'inactive':          'Esta chave está inativa.',
          'domain_limit':      'Limite de dispositivos atingido para esta chave.',
          'license_not_found': 'Chave não encontrada.',
          'missing_license_key': 'Chave inválida.',
          'network_error':     'Sem conexão com o servidor. Tente novamente.',
        };
        errEl.textContent = errMap[result.reason] || `Erro: ${result.reason}`;
        errEl.style.display = 'block';
        btn.textContent = 'Ativar licença';
        btn.disabled = false;
      }
    }

    btn.addEventListener('click', doActivate);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') doActivate(); });
  }

  // ── Rodapé de licença para PDFs e telas ──────
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

  // ── HTML do rodapé (para injetar em páginas) ─
  function getLicenseFooterHTML() {
    const txt = getLicenseFooterText();
    if (!txt) return '';
    return `<div class="license-footer-bar">${Utils.escHtml ? Utils.escHtml(txt) : txt}</div>`;
  }

  // ── HTML do rodapé para PDFs (sem escaping HTML) ─
  function getLicenseFooterPDFHTML() {
    const txt = getLicenseFooterText();
    if (!txt) return '';
    return `<div class="license-footer">${txt}</div>`;
  }

  // ── Init: executa verificação se necessário ──
  async function init() {
    const key = getKey();

    // Sem chave — bloqueia sempre, sem exceção
    if (!key) {
      setTimeout(() => showActivationModal(), 600);
      return;
    }

    // Bloqueado por verificação anterior
    if (isBlocked()) {
      setTimeout(() => showBlockedModal('inactive', ''), 600);
      return;
    }

    // Verifica periodicamente (48h) — só quando online
    if (needsCheck() && navigator.onLine) {
      await check();
    }

    // Ouve reconexão para verificar imediatamente se estava bloqueado
    window.addEventListener('online', async () => {
      if (isBlocked() || needsCheck()) {
        await check();
      }
    });
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