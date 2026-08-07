// ==============================================
// ARQUIVO: ibexgo/assets/js/planner.js
// Planejador de Excursões Lucrativas — ibexGo
// ==============================================

// ── ESTADO DO PLANEJADOR ─────────────────────────────────────────────
const PlannerState = {
  simId:    null,   // simulação ativa
  step:     1,      // 1=info, 2=custos, 3=receita, 4=resultado, 5=cenarios, 6=comparar, 7=plano
  sim:      null,   // objeto simulação atual
  custos:   [],     // custos da simulação ativa
};

const TIPOS_EXC = ['Bate e volta','Final de semana','Pacote com hospedagem','Excursão longa'];
const CAT_CUSTO = ['Transporte / Ônibus','Hospedagem','Alimentação','Ingressos / Passeios','Guia / Equipe','Taxas','Pedágios','Marketing / Divulgação','Brindes','Reserva de segurança','Outros'];

// ── PÁGINA INICIAL DO PLANEJADOR ─────────────────────────────────────
async function renderPlanejador() {
  const sims   = await DB.getAll('simulacoes');
  const custos = await DB.getAll('simCustos');

  const lucrativas = sims.filter(s => {
    const c = custos.filter(c => c.simId === s.id);
    const fin = calcSimFinanceiro(s, c);
    return fin.lucroPrevisto > 0;
  });

  const maiorLucro = sims.reduce((max, s) => {
    const c = custos.filter(c => c.simId === s.id);
    const fin = calcSimFinanceiro(s, c);
    return fin.lucroPrevisto > max ? fin.lucroPrevisto : max;
  }, 0);

  const criadas = sims.filter(s => s.excursaoId).length;

  const cards = sims.length === 0
    ? `<div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 17H5a2 2 0 00-2 2v0a2 2 0 002 2h14a2 2 0 002-2v0a2 2 0 00-2-2h-4M9 17V5a2 2 0 012-2h2a2 2 0 012 2v12M9 17h6"/></svg>
        <h3>Nenhuma simulação ainda</h3>
        <p>Crie sua primeira simulação para descobrir se sua excursão será lucrativa.</p>
        <button class="btn btn-primary mt-16" onclick="novaSimulacao()">+ Nova Simulação</button>
      </div>`
    : sims.sort((a,b) => (b.criadoEm||'').localeCompare(a.criadoEm||'')).map(s => {
        const c   = custos.filter(c => c.simId === s.id);
        const fin = calcSimFinanceiro(s, c);
        return renderSimCard(s, fin);
      }).join('');

  return `
  <div class="page-header">
    <div>
      <h1>Planejador de Excursões Lucrativas</h1>
      <div class="page-header-sub">Descubra antes de vender se sua excursão fecha no lucro.</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${sims.length >= 2 ? `<button class="btn btn-outline" onclick="navigate('planejador',{step:6})">Comparar simulações</button>` : ''}
      <button class="btn btn-primary" onclick="novaSimulacao()">
        <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        Nova Simulação
      </button>
    </div>
  </div>

  <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:28px">
    <div class="stat-card"><div class="stat-label">Simulações</div><div class="stat-value blue">${sims.length}</div></div>
    <div class="stat-card"><div class="stat-label">Lucrativas</div><div class="stat-value green">${lucrativas.length}</div></div>
    <div class="stat-card"><div class="stat-label">Maior Lucro Prev.</div><div class="stat-value green sv-currency">${Utils.formatCurrency(maiorLucro)}</div></div>
    <div class="stat-card"><div class="stat-label">Excursões Criadas</div><div class="stat-value">${criadas}</div></div>
  </div>

  <div class="sim-cards-grid">${cards}</div>`;
}

function renderSimCard(s, fin) {
  const statusInfo = simStatus(fin);
  const jaVirou = !!s.excursaoId;
  return `
  <div class="sim-card">
    <div class="sim-card-header">
      <div class="sim-card-color" style="background:${s.cor||'#14539B'}"></div>
      <div class="sim-card-info">
        <div class="sim-card-nome">${Utils.escHtml(s.nome)}</div>
        <div class="sim-card-dest text-gray" style="font-size:13px">${Utils.escHtml(s.destino||'')} ${s.dataSaida ? '· '+Utils.formatDate(s.dataSaida) : ''}</div>
      </div>
      <span class="badge ${statusInfo.cls}">${statusInfo.label}</span>
    </div>
    <div class="sim-card-body">
      <div class="sim-row"><span>Vagas</span><span>${s.vagas||'—'}</span></div>
      <div class="sim-row"><span>Preço sugerido</span><span class="fw-600">${Utils.formatCurrency(fin.valorSugerido)}</span></div>
      <div class="sim-row"><span>Ponto de equilíbrio</span><span>${fin.pontoEquilibrio} pax</span></div>
      <div class="sim-row"><span>Lucro previsto</span><span class="${fin.lucroPrevisto>=0?'text-green':'text-red'} fw-600">${Utils.formatCurrency(fin.lucroPrevisto)}</span></div>
    </div>
    <div class="sim-card-footer">
      ${jaVirou
        ? `<span class="badge badge-blue" style="font-size:12px">✓ Excursão criada</span>`
        : `<button class="btn btn-sm btn-primary" onclick="criarExcursaoDoPlano('${s.id}')">Criar Excursão</button>`
      }
      <div style="display:flex;gap:4px">
        <button class="btn btn-ghost btn-sm" onclick="navigate('planejador',{step:4,simId:'${s.id}'})" title="Abrir">👁</button>
        <button class="btn btn-ghost btn-sm" onclick="navigate('planejador',{step:1,simId:'${s.id}'})" title="Editar">✎</button>
        <button class="btn btn-ghost btn-sm" style="color:#F04438" onclick="excluirSim('${s.id}')" title="Excluir">✕</button>
      </div>
    </div>
  </div>`;
}

// ── ROTEADOR DO PLANEJADOR ────────────────────────────────────────────
async function renderPlanejadorStep() {
  const step  = PlannerState.step;
  const simId = PlannerState.simId;

  if (step === 0) return renderPlanejador();

  const sim    = simId ? await DB.getById('simulacoes', simId) : PlannerState.sim || {};
  const custos = simId ? (await DB.getAll('simCustos')).filter(c => c.simId === simId) : [];
  PlannerState.sim    = sim;
  PlannerState.custos = custos;

  if (step === 1) return renderStep1(sim);
  if (step === 2) return renderStep2(sim, custos);
  if (step === 3) return renderStep3(sim, custos);
  if (step === 4) return renderStep4(sim, custos);
  if (step === 5) return renderStep5(sim, custos);
  if (step === 6) return renderComparador();
  if (step === 7) return renderPlanoFinal(sim, custos);
  return renderPlanejador();
}

function plannerNav(simId, cur) {
  const steps = [{n:1,l:'Dados'},{n:2,l:'Custos'},{n:3,l:'Receita'},{n:4,l:'Resultado'},{n:5,l:'Cenários'},{n:7,l:'Plano Final'}];
  return `<div class="planner-steps">
    ${steps.map(s => `<button class="planner-step ${s.n===cur?'active':s.n<cur?'done':''}" onclick="navigate('planejador',{step:${s.n},simId:'${simId||''}'})">${s.n<cur?'✓ ':''} ${s.l}</button>`).join('')}
  </div>`;
}

function backToList() {
  return `<button class="back-link" onclick="navigate('planejador',{step:0})">
    <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
    Voltar para simulações
  </button>`;
}

// ── STEP 1: DADOS DA SIMULAÇÃO ────────────────────────────────────────
function renderStep1(sim) {
  const v = sim || {};
  const corSels = ['#14539B','#F2B807','#12B76A','#F04438','#F79009','#8B5CF6','#EC4899','#06B6D4']
    .map(c => `<div class="color-opt ${(v.cor||'#14539B')===c?'selected':''}" style="background:${c}" data-cor="${c}" onclick="selecionarCorSim('${c}')"></div>`).join('');

  return `
  ${backToList()}
  <h2 class="planner-title">Nova Simulação</h2>
  ${plannerNav(v.id, 1)}

  <div class="planner-card">
    <form id="formStep1" onsubmit="salvarStep1(event)">
      <div class="form-row">
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Nome da excursão *</label>
          <input class="form-control" name="nome" value="${Utils.escHtml(v.nome||'')}" required placeholder="Ex: Litoral Nordestino Julho"/>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Destino *</label>
          <input class="form-control" name="destino" value="${Utils.escHtml(v.destino||'')}" required placeholder="Ex: Porto Seguro – BA"/>
        </div>
        <div class="form-group">
          <label class="form-label">Tipo de excursão</label>
          <select class="form-control" name="tipo">
            ${TIPOS_EXC.map(t => `<option value="${t}" ${v.tipo===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Data de saída</label>
          <input class="form-control" type="date" name="dataSaida" value="${v.dataSaida||''}"/>
        </div>
        <div class="form-group">
          <label class="form-label">Data de retorno</label>
          <input class="form-control" type="date" name="dataRetorno" value="${v.dataRetorno||''}"/>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Total de vagas *</label>
          <input class="form-control" type="number" name="vagas" value="${v.vagas||40}" min="1" required/>
        </div>
        <div class="form-group">
          <label class="form-label">Mínimo de passageiros</label>
          <input class="form-control" type="number" name="paxMinimo" value="${v.paxMinimo||''}" min="1" placeholder="Ex: 15"/>
          <div class="form-hint">Quantidade mínima para a excursão sair. Usada nos cenários.</div>
        </div>
        <div class="form-group">
          <label class="form-label">Meta de ocupação (%)</label>
          <input class="form-control" type="number" name="metaOcupacao" value="${v.metaOcupacao||80}" min="1" max="100"/>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Cor da simulação</label>
        <div class="color-picker-row" id="colorPickerSim">${corSels}</div>
        <input type="hidden" name="cor" id="corSimSelecionada" value="${v.cor||'#14539B'}"/>
      </div>
      <div class="form-group">
        <label class="form-label">Observações gerais</label>
        <textarea class="form-control" name="obs" rows="3" placeholder="Detalhes, anotações, ideias...">${Utils.escHtml(v.obs||'')}</textarea>
      </div>
      <input type="hidden" name="id" value="${v.id||''}"/>
      <div style="display:flex;justify-content:flex-end;gap:10px">
        <button type="submit" class="btn btn-primary">Próximo: Custos →</button>
      </div>
    </form>
  </div>`;
}

function selecionarCorSim(cor) {
  document.querySelectorAll('#colorPickerSim .color-opt').forEach(el => el.classList.toggle('selected', el.dataset.cor === cor));
  document.getElementById('corSimSelecionada').value = cor;
}

async function salvarStep1(e) {
  e.preventDefault();
  const fd   = new FormData(e.target);
  const data = Object.fromEntries(fd.entries());
  if (data.id) {
    const old = await DB.getById('simulacoes', data.id);
    Object.assign(old, data);
    await DB.save('simulacoes', old);
    PlannerState.simId = data.id;
  } else {
    const saved = await DB.save('simulacoes', data);
    PlannerState.simId = saved.id;
  }
  navigate('planejador', { step: 2, simId: PlannerState.simId });
}

// ── STEP 2: CUSTOS ────────────────────────────────────────────────────
function renderStep2(sim, custos) {
  const fixos = custos.filter(c => c.tipo === 'fixo');
  const vars  = custos.filter(c => c.tipo === 'variavel');
  const totalFixo = fixos.reduce((s,c) => s+(parseFloat(c.valor)||0), 0);
  const totalVar  = vars.reduce((s,c)  => s+(parseFloat(c.valor)||0), 0);
  const vagas = parseInt(sim.vagas)||1;
  const totalVarTotal = totalVar * vagas;

  const rowCusto = (c) => `
    <tr>
      <td><b>${Utils.escHtml(c.nome)}</b></td>
      <td><span class="badge badge-gray" style="font-size:11px">${Utils.escHtml(c.categoria||'')}</span></td>
      <td class="fw-600">${Utils.formatCurrency(c.valor)}</td>
      <td><span class="badge ${c.tipo==='fixo'?'badge-blue':'badge-orange'}">${c.tipo==='fixo'?'Fixo':'Por pax'}</span></td>
      <td class="td-actions">
        <button class="btn btn-ghost btn-sm" onclick="editarCustoSim('${c.id}','${sim.id}')">✎</button>
        <button class="btn btn-ghost btn-sm" style="color:#F04438" onclick="excluirCustoSim('${c.id}','${sim.id}')">✕</button>
      </td>
    </tr>`;

  return `
  ${backToList()}
  <h2 class="planner-title">${Utils.escHtml(sim.nome)}</h2>
  ${plannerNav(sim.id, 2)}

  <div class="planner-card">
    <div class="flex-between mb-16">
      <div class="section-title">Custos Previstos</div>
      <button class="btn btn-primary btn-sm" onclick="openModalCustoSim('${sim.id}')">+ Adicionar custo</button>
    </div>

    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
      <div class="stat-card"><div class="stat-label">Custos Fixos</div><div class="stat-value sv-currency red">${Utils.formatCurrency(totalFixo)}</div></div>
      <div class="stat-card"><div class="stat-label">Custos por pax (unit.)</div><div class="stat-value sv-currency orange">${Utils.formatCurrency(totalVar)}</div></div>
      <div class="stat-card"><div class="stat-label">Custo Total (${vagas} pax)</div><div class="stat-value sv-currency">${Utils.formatCurrency(totalFixo + totalVarTotal)}</div></div>
    </div>

    ${custos.length === 0
      ? `<div class="empty-state" style="padding:32px">
          <h3>Nenhum custo cadastrado</h3>
          <p>Adicione os custos previstos para a excursão.</p>
          <button class="btn btn-primary mt-16" onclick="openModalCustoSim('${sim.id}')">+ Adicionar custo</button>
        </div>`
      : `<div class="table-wrapper">
          <table>
            <thead><tr><th>Nome</th><th>Categoria</th><th>Valor</th><th>Tipo</th><th></th></tr></thead>
            <tbody>${custos.map(rowCusto).join('')}</tbody>
          </table>
        </div>`
    }

    <div style="display:flex;justify-content:space-between;gap:10px;margin-top:20px">
      <button class="btn btn-outline" onclick="navigate('planejador',{step:1,simId:'${sim.id}'})">← Voltar</button>
      <button class="btn btn-primary" onclick="navigate('planejador',{step:3,simId:'${sim.id}'})">Próximo: Receita →</button>
    </div>
  </div>`;
}

async function openModalCustoSim(simId, custoId = null) {
  const c = custoId ? await DB.getById('simCustos', custoId) : null;
  const v = c || {};
  openModal(custoId ? 'Editar Custo' : 'Novo Custo', `
  <form id="formCustoSim" onsubmit="salvarCustoSim(event,'${simId}','${custoId||''}')">
    <div class="form-group">
      <label class="form-label">Nome do custo *</label>
      <input class="form-control" name="nome" value="${Utils.escHtml(v.nome||'')}" required placeholder="Ex: Ônibus fretado"/>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Categoria</label>
        <select class="form-control" name="categoria">
          ${CAT_CUSTO.map(cat => `<option value="${cat}" ${v.categoria===cat?'selected':''}>${cat}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Valor (R$) *</label>
        <input class="form-control" type="number" name="valor" value="${v.valor||''}" min="0" step="0.01" required/>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Tipo de custo</label>
      <div style="display:flex;gap:16px;margin-top:6px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">
          <input type="radio" name="tipo" value="fixo" ${(!v.tipo||v.tipo==='fixo')?'checked':''}/>
          <span><b>Fixo</b> — valor total independente de quantos forem</span>
        </label>
      </div>
      <div style="display:flex;gap:16px;margin-top:8px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">
          <input type="radio" name="tipo" value="variavel" ${v.tipo==='variavel'?'checked':''}/>
          <span><b>Por passageiro</b> — multiplicado pela quantidade de pax</span>
        </label>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Observação</label>
      <input class="form-control" name="obs" value="${Utils.escHtml(v.obs||'')}" placeholder="Opcional"/>
    </div>
    <button type="submit" class="btn btn-primary w-full">${custoId ? 'Salvar' : 'Adicionar custo'}</button>
  </form>`);
}

async function salvarCustoSim(e, simId, custoId) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  data.simId = simId;
  if (custoId) data.id = custoId;
  await DB.save('simCustos', data);
  closeModal();
  Utils.showToast('Custo salvo!');
  navigate('planejador', { step: 2, simId });
}

async function editarCustoSim(custoId, simId) { openModalCustoSim(simId, custoId); }

async function excluirCustoSim(custoId, simId) {
  if (!confirm('Excluir este custo?')) return;
  await DB.remove('simCustos', custoId);
  Utils.showToast('Custo removido');
  navigate('planejador', { step: 2, simId });
}

// ── STEP 3: RECEITA E PREÇO ───────────────────────────────────────────
function renderStep3(sim, custos) {
  const fin = calcSimFinanceiro(sim, custos);
  const v   = sim;

  return `
  ${backToList()}
  <h2 class="planner-title">${Utils.escHtml(sim.nome)}</h2>
  ${plannerNav(sim.id, 3)}

  <div class="planner-card">
    <form id="formStep3" onsubmit="salvarStep3(event,'${sim.id}')">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Valor por passageiro (R$) *</label>
          <input class="form-control" type="number" name="valorPax" id="inputValorPax"
            value="${v.valorPax||''}" min="0" step="0.01" required
            placeholder="${fin.valorMinimo > 0 ? fin.valorMinimo.toFixed(2) : ''}"
            oninput="atualizarPreviewReceita(this.value)"/>
          <div class="form-hint">Mínimo sem prejuízo: <b>${Utils.formatCurrency(fin.valorMinimo)}</b> · Sugerido com margem: <b>${Utils.formatCurrency(fin.valorSugerido)}</b></div>
        </div>
        <div class="form-group">
          <label class="form-label">Pax estimados para simulação</label>
          <input class="form-control" type="number" name="paxEstimado" id="inputPaxEst"
            value="${v.paxEstimado || Math.round((parseInt(v.vagas)||40) * ((parseInt(v.metaOcupacao)||80)/100))}"
            min="1" max="${v.vagas||99}" oninput="atualizarPreviewReceita()"/>
        </div>
        <div class="form-group">
          <label class="form-label">Margem de segurança (%)</label>
          <input class="form-control" type="number" name="margemDesejada" id="inputMargem"
            value="${v.margemDesejada||20}" min="0" max="100" oninput="atualizarPreviewReceita()"/>
          <div class="form-hint">Usado para calcular o <b>valor sugerido por passageiro</b>: valor mínimo × (1 + margem%). Ex: margem 20% → valor mínimo R$ 100 → sugerido R$ 120.</div>
        </div>
      </div>
      <div id="previewReceita" style="margin:20px 0">${renderPreviewReceita(sim, custos, v.valorPax, v.paxEstimado)}</div>
      <div style="display:flex;justify-content:space-between;gap:10px">
        <button type="button" class="btn btn-outline" onclick="navigate('planejador',{step:2,simId:'${sim.id}'})">← Voltar</button>
        <button type="submit" class="btn btn-primary">Ver Resultado →</button>
      </div>
    </form>
  </div>`;
}

function renderPreviewReceita(sim, custos, valorPax, paxEst) {
  const fin = calcSimFinanceiro(sim, custos, parseFloat(valorPax)||0, parseInt(paxEst)||0);
  const st  = simStatus(fin);
  return `
  <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
    <div class="stat-card"><div class="stat-label">Receita Máxima</div><div class="stat-value blue sv-currency">${Utils.formatCurrency(fin.receitaMaxima)}</div></div>
    <div class="stat-card"><div class="stat-label">Receita Prevista</div><div class="stat-value sv-currency">${Utils.formatCurrency(fin.receitaPrevista)}</div></div>
    <div class="stat-card"><div class="stat-label">Custo Total</div><div class="stat-value red sv-currency">${Utils.formatCurrency(fin.custoTotal)}</div></div>
    <div class="stat-card"><div class="stat-label">Lucro Previsto</div><div class="stat-value ${fin.lucroPrevisto>=0?'green':'red'} sv-currency">${Utils.formatCurrency(fin.lucroPrevisto)}</div></div>
    <div class="stat-card"><div class="stat-label">Ponto Equilíbrio</div><div class="stat-value">${fin.pontoEquilibrio} pax</div></div>
    <div class="stat-card"><div class="stat-label">Margem</div><div class="stat-value ${fin.margem>=0?'green':'red'}">${fin.margem.toFixed(1)}%</div></div>
  </div>
  <div class="fin-msg ${st.msgCls}" style="margin-top:12px">${st.msg(fin)}</div>`;
}

function atualizarPreviewReceita(val) {
  const valorPax = parseFloat(document.getElementById('inputValorPax')?.value) || 0;
  const paxEst   = parseInt(document.getElementById('inputPaxEst')?.value) || 0;
  const preview  = document.getElementById('previewReceita');
  if (preview && PlannerState.sim) {
    preview.innerHTML = renderPreviewReceita(PlannerState.sim, PlannerState.custos, valorPax, paxEst);
  }
}

async function salvarStep3(e, simId) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  const sim  = await DB.getById('simulacoes', simId);
  Object.assign(sim, data);
  await DB.save('simulacoes', sim);
  navigate('planejador', { step: 4, simId });
}

// ── STEP 4: RESULTADO ─────────────────────────────────────────────────
function renderStep4(sim, custos) {
  const fin = calcSimFinanceiro(sim, custos);
  const st  = simStatus(fin);
  const jaVirou = !!sim.excursaoId;

  return `
  ${backToList()}
  <h2 class="planner-title">${Utils.escHtml(sim.nome)}</h2>
  ${plannerNav(sim.id, 4)}

  <div class="result-status-bar ${st.barCls}">
    <div class="result-status-icon">${st.icon}</div>
    <div>
      <div class="result-status-title">${st.title}</div>
      <div class="result-status-msg">${st.msg(fin)}</div>
    </div>
  </div>

  <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
    <div class="stat-card"><div class="stat-label">Custo Total</div><div class="stat-value red sv-currency">${Utils.formatCurrency(fin.custoTotal)}</div></div>
    <div class="stat-card"><div class="stat-label">Receita Prevista</div><div class="stat-value blue sv-currency">${Utils.formatCurrency(fin.receitaPrevista)}</div></div>
    <div class="stat-card"><div class="stat-label">Lucro Previsto</div><div class="stat-value ${fin.lucroPrevisto>=0?'green':'red'} sv-currency">${Utils.formatCurrency(fin.lucroPrevisto)}</div></div>
    <div class="stat-card"><div class="stat-label">Margem</div><div class="stat-value ${fin.margem>=0?'green':'red'}">${fin.margem.toFixed(1)}%</div></div>
    <div class="stat-card"><div class="stat-label">Ponto de Equilíbrio</div><div class="stat-value">${fin.pontoEquilibrio} pax</div></div>
    <div class="stat-card"><div class="stat-label">Valor Sugerido/pax</div><div class="stat-value sv-currency">${Utils.formatCurrency(fin.valorSugerido)}</div></div>
  </div>

  <div class="planner-card" style="margin-bottom:20px">
    <div class="section-title" style="margin-bottom:12px">Análise Detalhada</div>
    <div class="result-detail-row">
      <span>Vagas totais</span><span>${sim.vagas}</span>
    </div>
    <div class="result-detail-row">
      <span>Pax simulados (${sim.metaOcupacao||80}% ocup.)</span><span>${fin.paxEstimado}</span>
    </div>
    <div class="result-detail-row">
      <span>Receita máxima (100% cheio)</span><span class="text-blue">${Utils.formatCurrency(fin.receitaMaxima)}</span>
    </div>
    <div class="result-detail-row">
      <span>Receita no ponto de equilíbrio</span><span>${Utils.formatCurrency(fin.receitaEquilibrio)}</span>
    </div>
    <div class="result-detail-row">
      <span>Valor mínimo/pax para não ter prejuízo</span><span class="text-orange fw-600">${Utils.formatCurrency(fin.valorMinimo)}</span>
    </div>
    <div class="result-detail-row">
      <span>Valor sugerido/pax (com margem ${sim.margemDesejada||20}%)</span><span class="text-green fw-600">${Utils.formatCurrency(fin.valorSugerido)}</span>
    </div>
    <div class="result-detail-row">
      <span>Quanto sobra se atingir a meta</span><span class="${fin.lucroPrevisto>=0?'text-green fw-600':'text-red fw-600'}">${Utils.formatCurrency(fin.lucroPrevisto)}</span>
    </div>
  </div>

  <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between">
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-outline" onclick="navigate('planejador',{step:3,simId:'${sim.id}'})">← Editar Receita</button>
      <button class="btn btn-outline" onclick="navigate('planejador',{step:5,simId:'${sim.id}'})">Cenários</button>
      <button class="btn btn-outline" onclick="navigate('planejador',{step:7,simId:'${sim.id}'})">Plano Final</button>
    </div>
    ${jaVirou
      ? `<span class="badge badge-blue" style="font-size:13px;padding:8px 14px">✓ Excursão já criada nesta simulação</span>`
      : `<button class="btn btn-primary" onclick="criarExcursaoDoPlano('${sim.id}')">
          <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Criar Excursão
        </button>`
    }
  </div>`;
}

// ── STEP 5: SIMULADOR DE CENÁRIOS ────────────────────────────────────
function renderStep5(sim, custos) {
  const vagas     = parseInt(sim.vagas) || 40;
  const paxMinimo = parseInt(sim.paxMinimo) || null;
  const valorPax  = parseFloat(sim.valorPax) || 0;

  // Monta a lista de quantidades de passageiros a comparar:
  // mínimo cadastrado, alguns intermediários e a capacidade máxima.
  const qtds = new Set();
  if (paxMinimo) qtds.add(paxMinimo);
  qtds.add(vagas);
  // Pontos intermediários por % de ocupação (apenas dentro da faixa min–max)
  [25, 50, 60, 70, 75, 80, 90].forEach(pct => {
    const pax = Math.round(vagas * pct / 100);
    if (pax >= 1 && pax <= vagas && (!paxMinimo || pax >= paxMinimo)) qtds.add(pax);
  });
  if (sim.paxEstimado) qtds.add(parseInt(sim.paxEstimado));

  const cenarios = [...qtds].filter(q=>q>0).sort((a,b)=>a-b)
    .map(pax => ({ pax, fin: calcSimFinanceiro(sim, custos, valorPax, pax) }));

  const rows = cenarios.map(({ pax, fin }) => {
    const st = simStatus(fin);
    const destaque = pax === paxMinimo ? ' style="background:#FFF7ED"' : (pax === vagas ? ' style="background:#F0F9FF"' : '');
    return `<tr${destaque}>
      <td><b>${pax}</b>${pax===paxMinimo?' <span class="badge badge-orange" style="font-size:10px">mínimo</span>':''}${pax===vagas?' <span class="badge badge-blue" style="font-size:10px">máximo</span>':''}</td>
      <td class="sv-currency">${Utils.formatCurrency(fin.receitaPrevista)}</td>
      <td class="sv-currency">${Utils.formatCurrency(fin.totalFixo)}</td>
      <td class="sv-currency">${Utils.formatCurrency(fin.custoVarTotal)}</td>
      <td class="fw-600 sv-currency">${Utils.formatCurrency(fin.custoTotal)}</td>
      <td class="${fin.lucroPrevisto>=0?'text-green':'text-red'} fw-600 sv-currency">${Utils.formatCurrency(fin.lucroPrevisto)}</td>
      <td>${fin.margem.toFixed(1)}%</td>
      <td class="sv-currency">${Utils.formatCurrency(fin.valorMinimo)}</td>
      <td class="sv-currency">${Utils.formatCurrency(fin.valorSugerido)}</td>
      <td><span class="badge ${st.cls}">${st.label}</span></td>
    </tr>`;
  }).join('');

  return `
  ${backToList()}
  <h2 class="planner-title">${Utils.escHtml(sim.nome)}</h2>
  ${plannerNav(sim.id, 5)}

  <div class="planner-card">
    <div class="section-title" style="margin-bottom:4px">Comparação de Cenários — Preço informado: ${Utils.formatCurrency(valorPax)}/pax</div>
    <p class="text-gray mb-16" style="font-size:13px">
      Cada linha mostra o resultado real para aquela quantidade de passageiros: o custo fixo entra uma única vez e o custo por passageiro é multiplicado pela quantidade da linha.
      ${paxMinimo ? `Linha em destaque laranja = mínimo cadastrado (${paxMinimo} pax). ` : ''}
      Linha em destaque azul = capacidade máxima (${vagas} pax).
    </p>
    <div class="table-wrapper" style="margin-bottom:8px">
      <table>
        <thead><tr>
          <th>Passageiros</th><th>Receita</th><th>Custo fixo</th><th>Custo variável</th><th>Custo total</th>
          <th>Lucro/Prejuízo</th><th>Margem</th><th>Mín. p/ empatar</th><th>Sugerido</th><th>Status</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="text-gray" style="font-size:12px;margin-bottom:24px">
      "Mín. p/ empatar" = valor por passageiro que zera o lucro <b>naquela quantidade</b> (custo fixo dividido pelos passageiros daquela linha, mais o custo variável por pessoa).
      "Sugerido" aplica a margem de segurança configurada (${parseInt(sim.margemDesejada)||20}%) sobre esse valor mínimo.
    </p>

    <hr class="divider"/>
    <div class="section-title" style="margin-bottom:12px">Simular manualmente</div>
    <p class="text-gray mb-8" style="font-size:13px">Teste qualquer combinação de quantidade de passageiros e preço de venda.</p>
    <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
      <div class="form-group" style="margin:0;flex:1;min-width:150px">
        <label class="form-label">Quantidade de passageiros</label>
        <input class="form-control" type="number" id="simManualPax" value="${sim.paxEstimado||paxMinimo||Math.round(vagas*.8)}" min="1" max="${vagas}" oninput="simManualCalc('${sim.id}')"/>
      </div>
      <div class="form-group" style="margin:0;flex:1;min-width:150px">
        <label class="form-label">Valor por passageiro (R$)</label>
        <input class="form-control" type="number" id="simManualValor" value="${valorPax||0}" step="0.01" oninput="simManualCalc('${sim.id}')"/>
      </div>
    </div>
    <div id="simManualResult" style="margin-top:16px">${renderManualResult(sim, custos, sim.paxEstimado||paxMinimo||Math.round(vagas*.8), valorPax)}</div>

    <div style="display:flex;justify-content:space-between;gap:10px;margin-top:20px">
      <button class="btn btn-outline" onclick="navigate('planejador',{step:4,simId:'${sim.id}'})">← Resultado</button>
      <button class="btn btn-primary" onclick="navigate('planejador',{step:7,simId:'${sim.id}'})">Plano Final →</button>
    </div>
  </div>`;
}

function renderManualResult(sim, custos, pax, valorPax) {
  const fin = calcSimFinanceiro(sim, custos, parseFloat(valorPax)||0, parseInt(pax)||0);
  const st  = simStatus(fin);
  return `<div class="fin-msg ${st.msgCls}">${st.msg(fin)}</div>
  <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-top:10px">
    <div class="stat-card"><div class="stat-label">Receita</div><div class="stat-value sv-currency">${Utils.formatCurrency(fin.receitaPrevista)}</div></div>
    <div class="stat-card"><div class="stat-label">Custo fixo</div><div class="stat-value sv-currency">${Utils.formatCurrency(fin.totalFixo)}</div></div>
    <div class="stat-card"><div class="stat-label">Custo variável</div><div class="stat-value sv-currency">${Utils.formatCurrency(fin.custoVarTotal)}</div></div>
    <div class="stat-card"><div class="stat-label">Custo total</div><div class="stat-value sv-currency">${Utils.formatCurrency(fin.custoTotal)}</div></div>
    <div class="stat-card"><div class="stat-label">Lucro/Prejuízo</div><div class="stat-value ${fin.lucroPrevisto>=0?'green':'red'} sv-currency">${Utils.formatCurrency(fin.lucroPrevisto)}</div></div>
    <div class="stat-card"><div class="stat-label">Margem</div><div class="stat-value ${fin.margem>=0?'green':'red'}">${fin.margem.toFixed(1)}%</div></div>
    <div class="stat-card"><div class="stat-label">Mín. p/ empatar</div><div class="stat-value sv-currency">${Utils.formatCurrency(fin.valorMinimo)}</div></div>
    <div class="stat-card"><div class="stat-label">Sugerido (c/ margem)</div><div class="stat-value sv-currency">${Utils.formatCurrency(fin.valorSugerido)}</div></div>
  </div>`;
}

async function simManualCalc(simId) {
  const pax      = document.getElementById('simManualPax')?.value;
  const valorPax = document.getElementById('simManualValor')?.value;
  const result   = document.getElementById('simManualResult');
  const sim      = await DB.getById('simulacoes', simId);
  const custos   = (await DB.getAll('simCustos')).filter(c => c.simId === simId);
  if (result) result.innerHTML = renderManualResult(sim, custos, pax, valorPax);
}

// ── COMPARADOR ────────────────────────────────────────────────────────
async function renderComparador() {
  const sims   = await DB.getAll('simulacoes');
  const custos = await DB.getAll('simCustos');

  if (sims.length < 2) return `${backToList()}
    <div class="empty-state"><h3>Você precisa de pelo menos 2 simulações para comparar.</h3></div>`;

  const comparadas = sims.slice(0, 4); // máximo 4
  const heads = comparadas.map(s => `<th>${Utils.escHtml(s.nome)}</th>`).join('');

  const metrics = [
    { label: 'Destino',             fn: (s,f) => Utils.escHtml(s.destino||'—') },
    { label: 'Vagas',               fn: (s,f) => s.vagas||'—' },
    { label: 'Preço sugerido',      fn: (s,f) => Utils.formatCurrency(f.valorSugerido) },
    { label: 'Custo total',         fn: (s,f) => Utils.formatCurrency(f.custoTotal) },
    { label: 'Ponto de equilíbrio', fn: (s,f) => f.pontoEquilibrio + ' pax' },
    { label: 'Lucro previsto',      fn: (s,f) => `<span class="${f.lucroPrevisto>=0?'text-green':'text-red'} fw-600">${Utils.formatCurrency(f.lucroPrevisto)}</span>` },
    { label: 'Margem',              fn: (s,f) => `<span class="${f.margem>=0?'text-green':'text-red'}">${f.margem.toFixed(1)}%</span>` },
    { label: 'Status',              fn: (s,f) => `<span class="badge ${simStatus(f).cls}">${simStatus(f).label}</span>` },
  ];

  const rows = metrics.map(m => {
    const cells = comparadas.map(s => {
      const fin = calcSimFinanceiro(s, custos.filter(c => c.simId === s.id));
      return `<td>${m.fn(s, fin)}</td>`;
    }).join('');
    return `<tr><th style="text-align:left;font-weight:600;background:var(--bg)">${m.label}</th>${cells}</tr>`;
  }).join('');

  return `
  ${backToList()}
  <h2 class="planner-title">Comparador de Simulações</h2>
  <div class="planner-card">
    <div class="table-wrapper">
      <table>
        <thead><tr><th>Métrica</th>${heads}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="text-gray mt-16" style="font-size:13px">Mostrando as ${comparadas.length} simulações mais recentes.</p>
  </div>`;
}

// ── STEP 7: PLANO FINAL ───────────────────────────────────────────────
function renderPlanoFinal(sim, custos) {
  const fin    = calcSimFinanceiro(sim, custos);
  const st     = simStatus(fin);
  const jaVirou = !!sim.excursaoId;

  const checklistItems = [
    'Confirmar disponibilidade do transporte',
    'Confirmar disponibilidade da hospedagem',
    'Definir e reservar local de embarque',
    'Verificar documentação necessária para o destino',
    'Preparar material de divulgação',
    'Definir data limite para inscrições',
    'Contratar seguro de viagem (se aplicável)',
    'Comunicar política de cancelamento',
  ];

  const custosRows = custos.map(c => `
    <tr>
      <td>${Utils.escHtml(c.nome)}</td>
      <td>${Utils.escHtml(c.categoria||'')}</td>
      <td>${Utils.formatCurrency(c.valor)}</td>
      <td>${c.tipo === 'fixo' ? 'Fixo' : 'Por pax'}</td>
    </tr>`).join('');

  return `
  ${backToList()}
  <h2 class="planner-title">${Utils.escHtml(sim.nome)}</h2>
  ${plannerNav(sim.id, 7)}

  <div class="planner-card no-print" style="margin-bottom:12px">
    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
      <button class="btn btn-outline" onclick="window.print()">Exportar / Imprimir</button>
      ${jaVirou
        ? `<span class="badge badge-blue" style="font-size:13px;padding:8px 14px">✓ Excursão já criada</span>`
        : `<button class="btn btn-primary" onclick="criarExcursaoDoPlano('${sim.id}')">
            <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            Criar Excursão
          </button>`
      }
    </div>
  </div>

  <div class="plano-final-wrap">
    <div class="plano-header">
      <div><b>ibex</b>Go <span style="color:#F2B807;font-weight:700">›</span> Plano de Excursão</div>
      <span class="badge ${st.cls}">${st.label}</span>
    </div>

    <h1 class="plano-nome">${Utils.escHtml(sim.nome)}</h1>
    <div class="plano-meta">${Utils.escHtml(sim.destino||'')} · ${Utils.formatDate(sim.dataSaida)} ${sim.dataRetorno?'→ '+Utils.formatDate(sim.dataRetorno):''} · ${Utils.escHtml(sim.tipo||'')}</div>

    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin:20px 0">
      <div class="stat-card"><div class="stat-label">Vagas</div><div class="stat-value">${sim.vagas}</div></div>
      <div class="stat-card"><div class="stat-label">Preço sugerido</div><div class="stat-value sv-currency green">${Utils.formatCurrency(fin.valorSugerido)}</div></div>
      <div class="stat-card"><div class="stat-label">Meta mínima</div><div class="stat-value">${fin.pontoEquilibrio} pax</div></div>
      <div class="stat-card"><div class="stat-label">Custo total</div><div class="stat-value sv-currency red">${Utils.formatCurrency(fin.custoTotal)}</div></div>
      <div class="stat-card"><div class="stat-label">Receita prevista</div><div class="stat-value sv-currency blue">${Utils.formatCurrency(fin.receitaPrevista)}</div></div>
      <div class="stat-card"><div class="stat-label">Lucro previsto</div><div class="stat-value sv-currency ${fin.lucroPrevisto>=0?'green':'red'}">${Utils.formatCurrency(fin.lucroPrevisto)}</div></div>
    </div>

    ${custos.length > 0 ? `
    <div class="section-title" style="margin-bottom:10px">Custos Previstos</div>
    <div class="table-wrapper" style="margin-bottom:20px">
      <table><thead><tr><th>Nome</th><th>Categoria</th><th>Valor</th><th>Tipo</th></tr></thead>
      <tbody>${custosRows}</tbody></table>
    </div>` : ''}

    ${sim.obs ? `<div class="plano-obs"><b>Observações:</b> ${Utils.escHtml(sim.obs)}</div>` : ''}

    <div class="section-title" style="margin:20px 0 12px">Checklist antes de lançar</div>
    <div class="checklist">
      ${checklistItems.map(item => `
        <label class="checklist-item">
          <input type="checkbox"/>
          <span>${item}</span>
        </label>`).join('')}
    </div>
  </div>`;
}

// ── CRIAR EXCURSÃO A PARTIR DO PLANO ─────────────────────────────────
async function criarExcursaoDoPlano(simId) {
  const sim     = await DB.getById('simulacoes', simId);
  const custos  = (await DB.getAll('simCustos')).filter(c => c.simId === simId);
  const fin     = calcSimFinanceiro(sim, custos);

  if (sim.excursaoId) {
    Utils.showToast('Esta simulação já foi transformada em excursão!', 'warn');
    navigate('excursao', { excursaoId: sim.excursaoId, tab: 'passageiros' });
    return;
  }

  // Cria excursão
  const excursao = {
    nome:           sim.nome,
    destino:        sim.destino || '',
    dataSaida:      sim.dataSaida || '',
    dataRetorno:    sim.dataRetorno || '',
    vagas:          sim.vagas || 40,
    valorPassageiro: fin.valorSugerido || sim.valorPax || 0,
    localEmbarque:  '',
    observacoes:    `[ibexGo Planejador] ${sim.obs||''}\nMeta: ${fin.pontoEquilibrio} pax · Lucro prev.: ${Utils.formatCurrency(fin.lucroPrevisto)}`,
    cor:            sim.cor || '#14539B',
  };
  const excSalva = await DB.save('excursoes', excursao);

  // Leva os custos planejados para contas da excursão
  for (const c of custos) {
    await DB.save('contas', {
      excursaoId:  excSalva.id,
      nome:        c.nome,
      categoria:   c.categoria || 'Outros',
      valor:       c.tipo === 'variavel'
                     ? (parseFloat(c.valor)||0) * (parseInt(sim.vagas)||1)
                     : parseFloat(c.valor)||0,
      vencimento:  sim.dataSaida || '',
      status:      'a pagar',
      observacao:  c.obs || '',
    });
  }

  // Vincula simulação → excursão
  sim.excursaoId = excSalva.id;
  await DB.save('simulacoes', sim);

  Utils.showToast('Excursão criada com sucesso!');
  navigate('excursao', { excursaoId: excSalva.id, tab: 'passageiros' });
}

async function excluirSim(simId) {
  if (!confirm('Excluir esta simulação e todos os seus custos?')) return;
  const custos = (await DB.getAll('simCustos')).filter(c => c.simId === simId);
  for (const c of custos) await DB.remove('simCustos', c.id);
  await DB.remove('simulacoes', simId);
  Utils.showToast('Simulação excluída');
  navigate('planejador', { step: 0 });
}

function novaSimulacao() {
  PlannerState.simId = null;
  PlannerState.sim   = {};
  PlannerState.custos = [];
  navigate('planejador', { step: 1, simId: null });
}

// ── CÁLCULO FINANCEIRO DA SIMULAÇÃO ──────────────────────────────────
function calcSimFinanceiro(sim, custos, valorPaxOverride, paxOverride) {
  const vagas    = parseInt(sim.vagas) || 40;
  const metaOc   = parseInt(sim.metaOcupacao) || 80;
  const margem   = parseInt(sim.margemDesejada) || 20;
  const valorPax = parseFloat(valorPaxOverride ?? sim.valorPax) || 0;
  const paxEst   = parseInt(paxOverride ?? sim.paxEstimado) || Math.round(vagas * metaOc / 100);

  const fixos   = (custos||[]).filter(c => c.tipo === 'fixo');
  const vars    = (custos||[]).filter(c => c.tipo === 'variavel');
  const totalFixo    = fixos.reduce((s,c) => s+(parseFloat(c.valor)||0), 0);
  const custoVarUnit = vars.reduce((s,c)  => s+(parseFloat(c.valor)||0), 0);

  // Custo total do cenário simulado: o fixo entra uma vez só, o variável é
  // multiplicado pela quantidade de passageiros SIMULADA (não pela capacidade máxima).
  const custoVarTotal = custoVarUnit * paxEst;
  const custoTotal    = totalFixo + custoVarTotal;

  // Mantido para referência: total de custo variável caso o ônibus saia cheio
  const custoVarTotalMax = custoVarUnit * vagas;
  const custoTotalMax    = totalFixo + custoVarTotalMax;

  const receitaMaxima    = valorPax * vagas;
  const receitaPrevista  = valorPax * paxEst;
  const receitaEquilibrio = custoTotal;

  // Ponto de equilíbrio: quantos pax cobrem o custo total
  const pontoEquilibrio = valorPax > 0
    ? Math.ceil((totalFixo) / Math.max(1, valorPax - custoVarUnit))
    : vagas;

  const lucroPrevisto = receitaPrevista - custoTotal;
  const margemPct     = receitaPrevista > 0 ? (lucroPrevisto / receitaPrevista) * 100 : -100;

  // Valor mínimo por passageiro para empatar NESTE cenário (sem margem):
  // (custo fixo / pax simulados) + custo variável por pax
  const valorMinimo = paxEst > 0 ? (totalFixo / paxEst) + custoVarUnit : 0;
  // Valor sugerido: com margem de segurança
  const valorSugerido = Math.ceil(valorMinimo * (1 + margem / 100));

  return {
    custoTotal, totalFixo, totalVar: custoVarUnit,
    custoVarUnit, custoVarTotal, custoTotalMax, custoVarTotalMax,
    receitaMaxima, receitaPrevista, receitaEquilibrio,
    pontoEquilibrio, lucroPrevisto, margem: margemPct,
    valorMinimo, valorSugerido, paxEstimado: paxEst,
    vagas, paxMinimo: parseInt(sim.paxMinimo) || null,
  };
}

function simStatus(fin) {
  if (fin.lucroPrevisto > 0 && fin.margem >= 15) return {
    cls: 'badge-green', label: 'Lucrativa', barCls: 'result-bar-green', icon: '✅',
    title: 'Excursão Lucrativa',
    msgCls: 'success',
    msg: (f) => `Essa excursão se paga com <b>${f.pontoEquilibrio}</b> passageiros. Com ${f.paxEstimado} pax o lucro previsto é <b>${Utils.formatCurrency(f.lucroPrevisto)}</b>.`
  };
  if (fin.lucroPrevisto >= 0) return {
    cls: 'badge-yellow', label: 'Atenção', barCls: 'result-bar-yellow', icon: '⚠️',
    title: 'Margem Baixa — Atenção',
    msgCls: 'warn',
    msg: (f) => `Margem muito baixa (${f.margem.toFixed(1)}%). Considere aumentar o preço para <b>${Utils.formatCurrency(f.valorSugerido)}/pax</b>.`
  };
  return {
    cls: 'badge-red', label: 'Prejuízo', barCls: 'result-bar-red', icon: '🔴',
    title: 'Risco de Prejuízo',
    msgCls: 'danger',
    msg: (f) => `Com esse preço e ocupação você terá prejuízo de <b>${Utils.formatCurrency(Math.abs(f.lucroPrevisto))}</b>. Preço sugerido: <b>${Utils.formatCurrency(f.valorSugerido)}/pax</b>.`
  };
}

window.Planner = {
  renderPlanejador, renderPlanejadorStep,
  calcSimFinanceiro, simStatus,
  novaSimulacao, criarExcursaoDoPlano, excluirSim,
  salvarStep1, salvarStep3, salvarCustoSim, editarCustoSim, excluirCustoSim,
  openModalCustoSim, selecionarCorSim,
  atualizarPreviewReceita, simManualCalc,
};