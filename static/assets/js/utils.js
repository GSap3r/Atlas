// ==============================================
// ARQUIVO: atlas/assets/js/utils.js
// ==============================================
const Utils = (() => {

  function formatCurrency(val) {
    val = parseFloat(val) || 0;
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatDate(str) {
    if (!str) return '—';
    const [y, m, d] = str.split('-');
    if (!d) return str;
    return `${d}/${m}/${y}`;
  }

  function formatDatetime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function today() {
    return new Date().toISOString().split('T')[0];
  }

  function capitalizar(s) {
    s = String(s || '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function escHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])
    );
  }

  // ── BADGES ────────────────────────────────────────────────────────
  function statusBadge(status) {
    const map = {
      confirmado: ['badge-green',  'Confirmado'],
      reservado:  ['badge-yellow', 'Reservado'],
      pendente:   ['badge-orange', 'Pendente'],
      cancelado:  ['badge-red',    'Cancelado'],
      pago:       ['badge-green',  'Pago'],
      'a pagar':  ['badge-orange', 'A pagar'],
      vencido:    ['badge-red',    'Vencido'],
      estornado:  ['badge-gray',   'Estornado'],
    };
    const [cls, label] = map[status?.toLowerCase()] || ['badge-gray', status || '—'];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function statusSelect(atual, passId, excId) {
    const opts = ['reservado','confirmado','pendente','cancelado']
      .map(s => `<option value="${s}" ${atual===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`)
      .join('');
    return `<select class="status-select ${atual}" onchange="atualizarStatusPassageiro('${passId}','${excId}',this)">${opts}</select>`;
  }

  // ── MAPA DE ASSENTOS ──────────────────────────────────────────────
  function genSeatRows(total) {
    const rows = [];
    let n = 1;
    while (n <= total) {
      const row = [];
      row.push(n <= total ? n++ : null);
      row.push(n <= total ? n++ : null);
      row.push('aisle');
      row.push(n <= total ? n++ : null);
      row.push(n <= total ? n++ : null);
      rows.push(row);
    }
    return rows;
  }

  // ── HELPER: tipo padrão (Adulto) ──────────────────────────────────
  function tipoAdultoPadrao() {
    return { pagante: true, ocupaVaga: true, entraNaListaEmbarque: true, entraNoFinanceiro: true };
  }

  function getTipo(tipoId, todosTipos) {
    if (!tipoId || !todosTipos) return tipoAdultoPadrao();
    return todosTipos.find(t => t.id === tipoId) || tipoAdultoPadrao();
  }

  // ── FINANCEIRO DO PASSAGEIRO ──────────────────────────────────────
  function calcPassageiroFinanceiro(passageiro, pagamentos) {
    const pags       = pagamentos.filter(p => p.passageiroId === passageiro.id && p.status !== 'estornado');
    const totalPago  = pags
      .filter(p => p.status === 'pago')
      .reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);
    // Compatibilidade: usar valorFinal se existir, senão valorCombinado
    const valorTotal = parseFloat(passageiro.valorFinal ?? passageiro.valorCombinado) || 0;
    const saldo      = valorTotal - totalPago;
    return { totalPago, valorTotal, saldo };
  }

  // ── CUSTO CALCULADO DE UMA CONTA ─────────────────────────────────
  function calcularValorConta(conta, passageiros, todosTipos) {
    const pass   = passageiros.filter(p => p.status !== 'cancelado');
    const tipo   = conta.tipoCusto || 'manual';
    const unit   = parseFloat(conta.valorUnitario) || 0;

    if (tipo === 'fixo' || tipo === 'manual' || !unit) {
      return parseFloat(conta.valor) || 0;
    }
    let qtd = 0;
    if (tipo === 'por_pagante') {
      qtd = pass.filter(p => getTipo(p.tipoPassageiroId, todosTipos).pagante).length;
    } else if (tipo === 'por_ocupante') {
      qtd = pass.filter(p => getTipo(p.tipoPassageiroId, todosTipos).ocupaVaga).length;
    } else if (tipo === 'por_tipo' && conta.tipoPassageiroId) {
      qtd = pass.filter(p => p.tipoPassageiroId === conta.tipoPassageiroId).length;
    } else if (tipo === 'por_pacote' && conta.pacoteId) {
      qtd = pass.filter(p => p.pacoteId === conta.pacoteId).length;
    } else {
      return parseFloat(conta.valor) || 0;
    }
    return qtd * unit;
  }

  // ── FINANCEIRO DA EXCURSÃO ────────────────────────────────────────
  function calcExcursaoFinanceiro(excursao, passageiros, pagamentos, contas, todosTipos) {
    const pass = passageiros.filter(p => p.excursaoId === excursao.id && p.status !== 'cancelado');

    // Vagas: apenas quem ocupa vaga conta
    const vagas        = parseInt(excursao.vagas) || 0;
    const ocupantes    = pass.filter(p => getTipo(p.tipoPassageiroId, todosTipos).ocupaVaga);
    const vagasLivres  = vagas - ocupantes.length;

    // Financeiro: apenas quem entra no financeiro
    const pagantes     = pass.filter(p => getTipo(p.tipoPassageiroId, todosTipos).pagante);
    const naoPagantes  = pass.filter(p => !getTipo(p.tipoPassageiroId, todosTipos).pagante);

    const receitaPrevista = pagantes.reduce((s, p) =>
      s + (parseFloat(p.valorFinal ?? p.valorCombinado) || 0), 0);

    const pags            = pagamentos.filter(p => p.excursaoId === excursao.id && p.status === 'pago');
    const receitaRecebida = pags.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);
    const receitaPendente = receitaPrevista - receitaRecebida;

    const contasExc       = contas.filter(c => c.excursaoId === excursao.id);
    const custoTotal      = contasExc.reduce((s, c) =>
      s + calcularValorConta(c, pass, todosTipos), 0);
    const custosPagos     = contasExc.filter(c => c.status === 'pago').reduce((s, c) =>
      s + calcularValorConta(c, pass, todosTipos), 0);
    const custosPendentes = custoTotal - custosPagos;

    const lucroPrevisto   = receitaPrevista - custoTotal;
    const lucroReal       = receitaRecebida - custosPagos;
    const faltaParaPagar  = Math.max(0, custoTotal - receitaRecebida);

    const passConfirmados = pass.filter(p => p.status === 'confirmado').length;
    const passPendentes   = pass.filter(p => p.status !== 'confirmado').length;

    const ticketMedio     = pagantes.length > 0
      ? receitaPrevista / pagantes.length : 0;
    const passNecessarios = ticketMedio > 0
      ? Math.ceil(custoTotal / ticketMedio) : 0;

    const descontoTotal   = pass.reduce((s, p) => s + (parseFloat(p.desconto) || 0), 0);
    const taxaCartaoTotal = pass.reduce((s, p) => s + (parseFloat(p.taxaCartao) || 0), 0);

    return {
      receitaPrevista, receitaRecebida, receitaPendente,
      custoTotal, custosPagos, custosPendentes,
      lucroPrevisto, lucroReal, faltaParaPagar,
      vagas, vagasLivres,
      passTotal: pass.length, passConfirmados, passPendentes,
      passNecessarios, ticketMedio,
      qtdPagantes:   pagantes.length,
      qtdNaoPagantes: naoPagantes.length,
      qtdOcupantes:  ocupantes.length,
      descontoTotal, taxaCartaoTotal,
    };
  }

  // ── EXPORTAR CSV ──────────────────────────────────────────────────
  function exportCSV(data, filename) {
    if (!data.length) return showToast('Nenhum dado para exportar', 'warn');
    const keys = Object.keys(data[0]);
    const rows = [
      keys.join(','),
      ...data.map(r => keys.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','))
    ];
    downloadBlob(new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' }), filename);
  }

  function downloadBlob(blob, filename) {
    const a   = document.createElement('a');
    a.href    = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  // ── LOADING OVERLAY ───────────────────────────────────────────────
  function showLoading(msg = 'Aguarde...') {
    let el = document.getElementById('loadingOverlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'loadingOverlay';
      el.innerHTML = `<div class="loading-box"><div class="loading-spinner"></div><span id="loadingMsg"></span></div>`;
      document.body.appendChild(el);
    }
    document.getElementById('loadingMsg').textContent = msg;
    el.classList.add('visible');
  }

  function hideLoading() {
    const el = document.getElementById('loadingOverlay');
    if (el) el.classList.remove('visible');
  }

  // ── TOAST ─────────────────────────────────────────────────────────
  function showToast(msg, type = 'success') {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast ${type !== 'success' ? type : ''}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => {
      t.style.cssText += 'opacity:0;transform:translateX(30px);transition:all .3s;';
      setTimeout(() => t.remove(), 320);
    }, 3200);
  }

  // ── WHATSAPP ──────────────────────────────────────────────────────
  function fmtTelWA(tel) {
    let n = String(tel || '').replace(/\D/g, '');
    if (!n) return '';
    if (!n.startsWith('55')) n = '55' + n;
    return n;
  }

  function waLink(tel) {
    const n = fmtTelWA(tel);
    return n ? `https://wa.me/${n}` : null;
  }

  function waMsgCobranca(tel, nome, saldo, nomeExc) {
    const n = fmtTelWA(tel);
    if (!n) return null;
    const msg = `Olá ${nome}! Lembramos que você tem um saldo em aberto de ${formatCurrency(saldo)} referente à excursão "${nomeExc}". Por favor, entre em contato para regularizar. Obrigado!`;
    return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`;
  }

  function waMsgCobrancaCustom(tel, nome, saldo, nomeExc, template) {
    const n = fmtTelWA(tel);
    if (!n) return null;
    const msg = (template || '')
      .replace('{nome}', nome)
      .replace('{valor}', formatCurrency(saldo))
      .replace('{excursao}', nomeExc);
    return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`;
  }

  return {
    formatCurrency, formatDate, formatDatetime, today, escHtml, capitalizar,
    statusBadge, statusSelect, genSeatRows,
    tipoAdultoPadrao, getTipo,
    calcPassageiroFinanceiro, calcExcursaoFinanceiro, calcularValorConta,
    exportCSV, downloadBlob, showToast, showLoading, hideLoading,
    waLink, waMsgCobranca, waMsgCobrancaCustom,
  };
})();