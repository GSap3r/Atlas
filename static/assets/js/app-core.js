// ==============================================
// ARQUIVO: atlas/assets/js/app-core.js
// Init, navegação, dashboard, lista de excursões
// ==============================================
// ==============================================
// ARQUIVO: atlas/assets/js/app.js
// ==============================================

// ── ESTADO ──────────────────────────────────────────────────────────
let state = { page: 'dashboard', excursaoId: null, tab: 'passageiros' };

const TIPOS_EXC_NAV    = ['Bate e volta','Final de semana','Pacote com hospedagem','Excursão longa'];
const FORMAS_PAGAMENTO = ['Pix','Dinheiro','Cartão','Boleto','Transferência','Outro'];
const STATUS_PASSAGEIRO= ['reservado','confirmado','pendente','cancelado'];
const STATUS_CONTA     = ['a pagar','pago','vencido'];
const CAT_FORNECEDOR   = ['Transporte','Hotel','Camisas','Seguro','Guia','Ingresso','Alimentação','Marketing','Brindes','Outros'];
const CATEGORIAS_CONTA = ['Transporte / Ônibus','Hospedagem','Alimentação','Ingressos / Passeios','Guia / Equipe','Taxas','Pedágios','Marketing / Divulgação','Brindes','Reserva de segurança','Outros'];
const TIPOS_CUSTO      = [
  { value: 'manual',      label: 'Manual (valor fixo digitado)' },
  { value: 'fixo',        label: 'Fixo (independente de passageiros)' },
  { value: 'por_pagante', label: 'Por passageiro pagante' },
  { value: 'por_ocupante',label: 'Por passageiro que ocupa vaga' },
  { value: 'por_tipo',    label: 'Por tipo específico de passageiro' },
  { value: 'por_pacote',  label: 'Por pacote específico' },
];
const CORES = ['#2E93B0','#F2B807','#12B76A','#F04438','#F79009','#8B5CF6','#EC4899','#06B6D4','#64748B','#10B981'];

// ── INIT ─────────────────────────────────────────────────────────────
async function init() {
  await DB.open();
  await migrarDadosAntigos();
  setupNav();
  setupModal();
  setupSidebarOverlay();
  document.getElementById('menuToggle').addEventListener('click', () => {
    const open = document.getElementById('sidebar').classList.toggle('open');
    document.querySelector('.sidebar-overlay')?.classList.toggle('visible', open);
  });
  await Backup.carregarIndicador();
  Backup.verificarBackupAutomatico();
  Backup.verificarBackupAtrasadoEAvisar();
  Backup.iniciarAgendadorBackup();
  navigate('dashboard');

}

function _injectLicenseFooter() {
  const existing = document.getElementById('atlas-license-footer');
  if (existing) existing.remove();
  const txt = License.getLicenseFooterText();
  if (!txt) return;
  const bar = document.createElement('div');
  bar.id = 'atlas-license-footer';
  bar.className = 'license-footer-bar';
  bar.textContent = txt;
  document.body.appendChild(bar);
}

function setupSidebarOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    overlay.classList.remove('visible');
  });
}

// ── MIGRAÇÃO DE DADOS ANTIGOS ────────────────────────────────────────
async function migrarDadosAntigos() {
  // 1. Garantir tipos padrão
  const tiposExist = await DB.getAll('tiposPassageiro');
  if (!tiposExist.length) {
    const tiposPadrao = [
      { nome:'Adulto',      descricao:'Passageiro adulto padrão',    pagante:true,  ocupaVaga:true,  entraNaListaEmbarque:true,  entraNoFinanceiro:true,  ordem:1, ativo:true },
      { nome:'Criança',     descricao:'Criança com assento',          pagante:true,  ocupaVaga:true,  entraNaListaEmbarque:true,  entraNoFinanceiro:true,  ordem:2, ativo:true },
      { nome:'Bebê de colo',descricao:'Bebê sem assento, sem custo',  pagante:false, ocupaVaga:false, entraNaListaEmbarque:true,  entraNoFinanceiro:false, ordem:3, ativo:true },
      { nome:'Cortesia',    descricao:'Passageiro cortesia',          pagante:false, ocupaVaga:true,  entraNaListaEmbarque:true,  entraNoFinanceiro:false, ordem:4, ativo:true },
      { nome:'Guia',        descricao:'Guia turístico',               pagante:false, ocupaVaga:true,  entraNaListaEmbarque:true,  entraNoFinanceiro:false, ordem:5, ativo:true },
      { nome:'Motorista',   descricao:'Motorista do transporte',      pagante:false, ocupaVaga:false, entraNaListaEmbarque:true,  entraNoFinanceiro:false, ordem:6, ativo:true },
    ];
    for (const t of tiposPadrao) await DB.save('tiposPassageiro', t);
  }

  const tipos = await DB.getAll('tiposPassageiro');
  const tipoAdultoId = tipos.find(t => t.nome === 'Adulto')?.id;
  const excursoes    = await DB.getAll('excursoes');
  const passageiros  = await DB.getAll('passageiros');
  const pacotes      = await DB.getAll('pacotes');

  for (const exc of excursoes) {
    // 2. Criar pacote padrão para excursão sem pacote
    const temPacote = pacotes.some(p => p.excursaoId === exc.id);
    let pacotePadraoId;
    if (!temPacote) {
      const pPadrao = await DB.save('pacotes', {
        excursaoId: exc.id,
        nome: 'Pacote padrão',
        descricao: 'Pacote padrão criado automaticamente',
        valorVenda: parseFloat(exc.valorPassageiro) || 0,
        tipoPassageiroPadraoId: tipoAdultoId,
        incluiAssento: true,
        ativo: true,
        custoEstimado: 0,
        observacoes: '',
      });
      pacotePadraoId = pPadrao.id;
    } else {
      pacotePadraoId = pacotes.find(p => p.excursaoId === exc.id)?.id;
    }

    // 3-7. Atualizar passageiros desta excursão
    const passExc = passageiros.filter(p => p.excursaoId === exc.id);
    for (const p of passExc) {
      let changed = false;
      if (!p.tipoPassageiroId) { p.tipoPassageiroId = tipoAdultoId; changed = true; }
      if (!p.pacoteId)         { p.pacoteId = pacotePadraoId;       changed = true; }
      if (!p.valorBase)        { p.valorBase = p.valorCombinado || 0; changed = true; }
      if (!p.desconto)         { p.desconto  = 0; changed = true; }
      if (!p.taxaCartao)       { p.taxaCartao = 0; changed = true; }
      if (p.valorFinal === undefined) { p.valorFinal = p.valorCombinado || 0; changed = true; }
      // Criar reserva automática se não tiver
      if (!p.codigoReserva) {
        const res = await DB.save('reservas', {
          excursaoId: exc.id,
          codigo: `RES-${String(Date.now()).slice(-4)}-${Math.floor(Math.random()*100)}`,
          titular: p.nome,
          telefoneTitular: p.telefone || '',
          observacoes: '',
        });
        p.codigoReserva  = res.codigo;
        p.reservaId      = res.id;
        p.titularReserva = p.nome;
        changed = true;
      }
      if (changed) await DB.save('passageiros', p);
    }
  }
}

// ── NAVEGAÇÃO ────────────────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(el.dataset.page);
      document.getElementById('sidebar').classList.remove('open');
      document.querySelector('.sidebar-overlay')?.classList.remove('visible');
    });
  });
}

function navigate(page, params = {}) {
  state.page = page;
  Object.assign(state, params);
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active',
      el.dataset.page === page ||
      (page === 'excursao' && el.dataset.page === 'excursoes') ||
      (page === 'planejador' && el.dataset.page === 'planejador')
    );
  });
  render();
}

async function render() {
  const content       = document.getElementById('mainContent');
  const topbarTitle   = document.getElementById('topbarTitle');
  const topbarActions = document.getElementById('topbarActions');
  topbarActions.innerHTML = '';
  content.innerHTML = '<div style="padding:48px;text-align:center;color:#667085">Carregando...</div>';

  const pageMap = {
    dashboard:       ['Dashboard',          renderDashboard],
    excursoes:       ['Excursões',          renderExcursoes],
    excursao:        [null,                 renderExcursao],
    cobrancas:       ['Cobranças',          renderCobrancas], // tirar
    auditoria:       ['Auditoria Financeira', renderAuditoria], // tirar
    clientes:        ['Clientes',           renderClientes],
    tiposPassageiro: ['Tipos de Passageiro',renderTiposPassageiro],
    fornecedores:    ['Fornecedores',       renderFornecedores],
    vendedores:      ['Vendedores',         renderVendedores],
    configuracoes:   ['Configurações',      renderConfiguracoes],
    backup:          ['Backup',             renderBackup],
  };

  if (state.page === 'excursoes') {
    topbarActions.innerHTML = `<button class="btn btn-primary" onclick="openModalExcursao()">
      <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>Nova Excursão</button>`;
  }
  if (state.page === 'excursao') {
    const exc = await DB.getById('excursoes', state.excursaoId);
    topbarTitle.textContent = exc?.nome || 'Excursão';
    topbarActions.innerHTML = `
      <button class="btn btn-outline btn-sm" onclick="Backup.exportarExcursao('${state.excursaoId}')">↓ Exportar</button>
      <button class="btn btn-outline btn-sm" onclick="openModalExcursao('${state.excursaoId}')">Editar</button>
      <button class="btn btn-danger btn-sm"  onclick="confirmarExcluirExcursao('${state.excursaoId}')">Excluir</button>`;
    content.innerHTML = await renderExcursao();
    attachPageEvents();
    return;
  }
  if (state.page === 'planejador') {
    topbarTitle.textContent = 'Planejador';
    PlannerState.step  = state.step  ?? 0;
    PlannerState.simId = state.simId ?? null;
    content.innerHTML  = await (PlannerState.step === 0 ? Planner.renderPlanejador() : Planner.renderPlanejadorStep());
    attachPageEvents();
    return;
  }

  const [title, fn] = pageMap[state.page] || ['Dashboard', renderDashboard];
  if (title) topbarTitle.textContent = title;
  content.innerHTML = await fn();
  attachPageEvents();
}

// ── DASHBOARD ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
