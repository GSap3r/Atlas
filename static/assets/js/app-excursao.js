// ==============================================
// ARQUIVO: atlas/assets/js/app-excursao.js
// Detalhe da excursão: abas, passageiros,
// assentos, pagamentos, contas, financeiro,
// embarque, relatórios e todos os seus modais
// ==============================================
async function renderDashboard() {
  try {
  const [excursoes, passageiros, pagamentos, contas, tipos] = await Promise.all([
    DB.getAll('excursoes'), DB.getAll('passageiros'),
    DB.getAll('pagamentos'), DB.getAll('contas'), DB.getAll('tiposPassageiro')
  ]);

  const today        = Utils.today();
  const excAtivas    = excursoes.filter(e => !e.dataSaida || e.dataSaida >= today);
  const excPassadas  = excursoes.filter(e => e.dataSaida && e.dataSaida < today);
  const passAtivos   = passageiros.filter(p => p.status !== 'cancelado');
  const pagantes     = passAtivos.filter(p => Utils.getTipo(p.tipoPassageiroId, tipos).pagante);
  const confirmados  = passAtivos.filter(p => p.status === 'confirmado').length;
  const pendentes    = passAtivos.filter(p => p.status === 'pendente' || p.status === 'reservado').length;

  const receitaPrev  = pagantes.reduce((s,p) => s+(parseFloat(p.valorFinal != null ? p.valorFinal : p.valorCombinado)||0), 0);
  const recebido     = pagamentos.filter(p => p.status==='pago').reduce((s,p) => s+(parseFloat(p.valor)||0), 0);
  const aReceber     = Math.max(0, receitaPrev - recebido);
  const custoTotal   = contas.reduce((s,c) => s+(Utils.calcularValorConta(c, passAtivos.filter(p=>p.excursaoId===c.excursaoId), tipos)||0), 0);
  const contasPagas  = contas.filter(c=>c.status==='pago').reduce((s,c)=>s+(parseFloat(c.valor)||0),0);
  const contasPend   = contas.filter(c=>c.status!=='pago').reduce((s,c)=>s+(parseFloat(c.valor)||0),0);
  const lucroPrev    = receitaPrev - custoTotal;
  const pctRecebido  = receitaPrev > 0 ? Math.min(100, (recebido/receitaPrev)*100) : 0;
  const pctCustos    = custoTotal  > 0 ? Math.min(100, (contasPagas/custoTotal)*100) : 0;

  // Por excursão para gráfico de barras (máx 8)
  const excDados = excursoes
    .sort((a,b) => (a.dataSaida||'9999').localeCompare(b.dataSaida||'9999'))
    .slice(0, 8)
    .map(e => {
      const passE = passAtivos.filter(p=>p.excursaoId===e.id);
      const pagsE = pagamentos.filter(p=>p.excursaoId===e.id && p.status==='pago');
      const pag   = passE.filter(p=>Utils.getTipo(p.tipoPassageiroId, tipos).pagante);
      const rec   = pagsE.reduce((s,p)=>s+(parseFloat(p.valor)||0),0);
      const prev  = pag.reduce((s,p)=>s+(parseFloat(p.valorFinal != null ? p.valorFinal : p.valorCombinado)||0),0);
      return {
        id: e.id,
        nome: e.nome.length > 14 ? e.nome.slice(0,13)+'…' : e.nome,
        rec, prev, cor: e.cor||'#0F766E'
      };
    });

  window._dashMonth = window._dashMonth || Utils.today().slice(0,7);
  const finMes = await calcularFinanceiroMes(window._dashMonth);
  const [anoMes, numMes] = window._dashMonth.split('-');
  const nomeMesAtual = Utils.capitalizar(new Date(Number(anoMes), Number(numMes)-1, 1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}));

  const statusCount = {
    confirmado: passAtivos.filter(p=>p.status==='confirmado').length,
    reservado:  passAtivos.filter(p=>p.status==='reservado').length,
    pendente:   passAtivos.filter(p=>p.status==='pendente').length,
  };

  const proximas = excursoes
    .filter(e => (e.dataSaida||'') >= today)
    .sort((a,b)=>a.dataSaida.localeCompare(b.dataSaida))
    .slice(0,5);

  const devedores = pagantes
    .map(p => { const pf = Utils.calcPassageiroFinanceiro(p, pagamentos); return { nome: p.nome, saldo: pf.saldo }; })
    .filter(d => d.saldo > 0)
    .sort((a,b) => b.saldo-a.saldo)
    .slice(0, 5);

  if (excursoes.length === 0) return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:24px;text-align:center">
      <img src="assets/img/logo.png" alt="Atlas" style="width:72px;height:72px;border-radius:18px;box-shadow:var(--shadow-md)"/>
      <div>
        <h1 style="font-size:28px;font-weight:700;color:var(--dark);margin-bottom:8px">Bem-vindo ao Atlas</h1>
        <p style="color:var(--gray);font-size:15px;max-width:400px;margin:0 auto">Organize viagens, passageiros e pagamentos. Comece criando sua primeira excursão.</p>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
        
      </div>
    </div>`; // <button class="btn btn-primary" style="padding:12px 28px;font-size:15px" onclick="openModalExcursao()">+ Nova excursão</button> linha 73

  // Armazena dados para os gráficos (script inline não executa via innerHTML)
  window._dashED  = excDados;
  window._dashSC  = statusCount;
  window._dashPCT = pctRecebido;
    
// A partir daqui é a declaração dos dashs no cod, já fica na aba de dashboards

//<button class="btn btn-primary btn-sm" onclick="openModalExcursao()">+ Nova excursão</button> linhas 92
  return `
  <div class="dash-header">
    <div>
      <h1 class="dash-title">Dashboard</h1>
      <p class="dash-sub">${new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      
    </div>
  </div>

  <div class="dash-kpi-row" style="grid-template-columns:repeat(2,1fr);max-width:520px">
    ${[
      { icon:'M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z', bg:'#EAF6F5', cor:'#0F766E', val: excAtivas.length + '<span style="font-size:13px;font-weight:400;color:var(--gray);margin-left:4px">/ '+excursoes.length+'</span>', lbl:'Viagens ativas', trend: excPassadas.length+'d concluídas', tcls:'trend-gray' },
      { icon:'M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z', bg:'#F0FDF4', cor:'#12B76A', val: passAtivos.length, lbl:'Passageiros', trend: confirmados+' confirmados', tcls:'trend-green' },
    ].map(k=>`
      <div class="dash-kpi">
        <div class="dash-kpi-icon" style="background:${k.bg};color:${k.cor}">
          <svg viewBox="0 0 24 24"><path d="${k.icon}"/></svg>
        </div>
        <div class="dash-kpi-body">
          <div class="dash-kpi-val${k.currency?' dash-kpi-currency':''}">${k.val}</div>
          <div class="dash-kpi-lbl">${k.lbl}</div>
        </div>
        <div class="dash-kpi-trend ${k.tcls}">${k.trend}</div>
      </div>`).join('')}
  </div>

  <div class="flex-between" style="margin:4px 0 12px">
    <div class="section-title" style="margin-bottom:0">Financeiro do mês</div>
    <div style="display:flex;align-items:center;gap:10px">
      <button class="btn btn-ghost btn-sm" onclick="mudarMesDash(-1)" title="Mês anterior">←</button>
      <b style="min-width:150px;text-align:center;font-size:14px;color:var(--dark)">${nomeMesAtual}</b>
      <button class="btn btn-ghost btn-sm" onclick="mudarMesDash(1)" title="Próximo mês">→</button>
    </div>
  </div>

  <div class="dash-kpi-row">
    ${[
      { cat:'emitidos',  icon:'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z', bg:'#EAF6F5', cor:'#0F766E', val: finMes.emitidos.valor,  count: finMes.emitidos.itens.length,  lbl:'Emitidas' },
      { cat:'recebidos', icon:'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z', bg:'#F0FDF4', cor:'#12B76A', val: finMes.recebidos.valor, count: finMes.recebidos.itens.length, lbl:'Recebidas' },
      { cat:'pendentes', icon:'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z', bg:'#FFFAEB', cor:'#F79009', val: finMes.pendentes.valor, count: finMes.pendentes.itens.length, lbl:'Pendentes' },
      { cat:'atrasados', icon:'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z', bg:'#FEF3F2', cor:'#F04438', val: finMes.atrasados.valor, count: finMes.atrasados.itens.length, lbl:'Atrasadas' },
    ].map(k=>`
      <div class="dash-kpi" style="cursor:pointer" onclick="abrirDetalheFinanceiro('${k.cat}')">
        <div class="dash-kpi-icon" style="background:${k.bg};color:${k.cor}">
          <svg viewBox="0 0 24 24"><path d="${k.icon}"/></svg>
        </div>
        <div class="dash-kpi-body">
          <div class="dash-kpi-val dash-kpi-currency">${Utils.formatCurrency(k.val)}</div>
          <div class="dash-kpi-lbl">${k.count} ${k.lbl}</div>
        </div>
      </div>`).join('')}
    <div class="dash-kpi" style="cursor:pointer" onclick="abrirDetalheFinanceiro('lucro')">
      <div class="dash-kpi-icon" style="background:${finMes.lucroReal>=0?'#F0FDF4':'#FEF3F2'};color:${finMes.lucroReal>=0?'#12B76A':'#F04438'}">
        <svg viewBox="0 0 24 24"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>
      </div>
      <div class="dash-kpi-body">
        <div class="dash-kpi-val dash-kpi-currency ${finMes.lucroReal>=0?'':'text-red'}">${Utils.formatCurrency(finMes.lucroReal)}</div>
        <div class="dash-kpi-lbl">Lucro real</div>
      </div>
    </div>
    <div class="dash-kpi dash-kpi-lucro" style="cursor:pointer" onclick="abrirDetalheFinanceiro('lucro')">
      <div class="dash-kpi-icon" style="background:rgba(255,255,255,.2);color:#fff">
        <svg viewBox="0 0 24 24"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>
      </div>
      <div class="dash-kpi-body">
        <div class="dash-kpi-val dash-kpi-currency" style="color:#fff">${Utils.formatCurrency(finMes.lucroPrevisto)}</div>
        <div class="dash-kpi-lbl" style="color:rgba(255,255,255,.75)">Lucro previsto</div>
      </div>
      <div class="dash-kpi-trend" style="color:rgba(255,255,255,.65)">${finMes.lucroPrevisto>=0?'▲ positivo':'▼ atenção'}</div>
    </div>
  </div>

  <div class="dash-charts-row">
    <div class="dash-chart-card dash-chart-wide">
      <div class="dash-chart-header">
        <div><div class="dash-chart-title">Receita por Excursão</div><div class="dash-chart-sub">Previsto vs Recebido</div></div>
      </div>
      <div style="position:relative;height:190px"><canvas id="chartBarras" style="width:100%;height:190px"></canvas></div>
      <div style="display:flex;gap:16px;margin-top:8px;font-size:12px;color:var(--gray)">
        <span><span style="display:inline-block;width:10px;height:10px;background:#0F766E55;border-radius:2px;margin-right:4px"></span>Previsto</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:#0F766E;border-radius:2px;margin-right:4px"></span>Recebido</span>
      </div>
    </div>
    <div class="dash-chart-card">
      <div class="dash-chart-header"><div class="dash-chart-title">Status</div><div class="dash-chart-sub">Passageiros</div></div>
      <div style="display:flex;align-items:center;justify-content:center;padding:8px 0">
        <canvas id="chartDonut" width="140" height="140"></canvas>
      </div>
      <div style="display:flex;flex-direction:column;gap:7px">
        ${[['#12B76A','Confirmados',statusCount.confirmado],['#C1502E','Reservados',statusCount.reservado],['#F79009','Pendentes',statusCount.pendente]]
          .map(([c,l,n])=>`<div style="display:flex;align-items:center;gap:8px;font-size:13px">
            <span style="width:9px;height:9px;border-radius:50%;background:${c};flex-shrink:0"></span>
            <span style="flex:1;color:var(--gray)">${l}</span><span style="font-weight:700">${n}</span>
          </div>`).join('')}
      </div>
    </div>
    <div class="dash-chart-card">
      <div class="dash-chart-header"><div class="dash-chart-title">Arrecadação</div><div class="dash-chart-sub">vs meta</div></div>
      <div style="display:flex;align-items:center;justify-content:center;padding:8px 0">
        <canvas id="chartGauge" width="140" height="120"></canvas>
      </div>
      <div style="text-align:center">
        <div style="font-size:26px;font-weight:700;color:var(--dark)">${pctRecebido.toFixed(0)}%</div>
        <div style="font-size:12px;color:var(--gray);margin-top:2px">${Utils.formatCurrency(recebido)}</div>
        <div style="font-size:11px;color:var(--gray)">de ${Utils.formatCurrency(receitaPrev)}</div>
      </div>
    </div>
  </div>

  <div class="dash-bottom-row">
    <div class="dash-section-card">
      <div class="dash-chart-header">
        <div class="dash-chart-title">Próximas Viagens</div>
        <button class="btn btn-ghost btn-sm" onclick="navigate('excursoes')">Ver todas →</button>
      </div>
      ${proximas.length === 0 ? '<p class="text-gray" style="font-size:14px;padding:16px 0">Nenhuma excursão futura.</p>' : proximas.map(e => {
        const pE = passAtivos.filter(p=>p.excursaoId===e.id);
        const pct = parseInt(e.vagas) > 0 ? Math.min(100,Math.round(pE.length/parseInt(e.vagas)*100)) : 0;
        const dias = Math.ceil((new Date(e.dataSaida)-new Date())/86400000);
        return `<div class="dash-exc-row" onclick="navigate('excursao',{excursaoId:'${e.id}',tab:'passageiros'})">
          <div class="dash-exc-dot" style="background:${e.cor||'#0F766E'}"></div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${Utils.escHtml(e.nome)}</div>
            <div style="font-size:12px;color:var(--gray);margin-top:1px">${Utils.formatDate(e.dataSaida)} · ${Utils.escHtml(e.destino||'')}</div>
            <div style="background:#E4E7EC;border-radius:99px;height:4px;overflow:hidden;margin-top:6px;width:100%">
              <div style="background:${e.cor||'#0F766E'};height:100%;width:${pct}%;border-radius:99px"></div>
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0;margin-left:12px">
            <div style="font-size:13px;font-weight:700;color:${dias<=7?'#F04438':dias<=30?'#F79009':'#12B76A'}">${dias}d</div>
            <div style="font-size:11px;color:var(--gray)">${pE.length}/${e.vagas}</div>
          </div>
        </div>`;
      }).join('')}
    </div>

    <div class="dash-section-card">
      <div class="dash-chart-header">
        <div class="dash-chart-title">Maiores Saldos em Aberto</div>
        <button class="btn btn-ghost btn-sm" onclick="navigate('cobrancas')">Cobrar →</button>
      </div>
      ${devedores.length === 0
        ? '<div style="text-align:center;padding:24px 0;color:var(--gray)"><div style="font-size:28px">✓</div><div style="font-size:14px;margin-top:6px">Todos em dia!</div></div>'
        : devedores.map((d,i)=>{
          const maxS = devedores[0].saldo;
          const pct  = maxS > 0 ? (d.saldo/maxS)*100 : 0;
          const cs   = ['#F04438','#F79009','#C1502E','#0F766E','#667085'];
          return `<div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
              <span style="font-weight:500">${Utils.escHtml(d.nome.split(' ').slice(0,2).join(' '))}</span>
              <span style="font-weight:700;color:#F04438">${Utils.formatCurrency(d.saldo)}</span>
            </div>
            <div style="background:#F3F4F6;border-radius:99px;height:5px;overflow:hidden">
              <div style="background:${cs[i]};height:100%;width:${pct}%;border-radius:99px"></div>
            </div>
          </div>`;
        }).join('')}
    </div>

    <div class="dash-section-card">
      <div class="dash-chart-header">
        <div class="dash-chart-title">Resumo Financeiro</div>
        <div class="dash-chart-sub">Todas as Viagens</div>
      </div>
      ${[
        ['Receita prevista', receitaPrev, '#0F766E', false],
        ['Recebido',         recebido,   '#12B76A', false],
        ['A receber',        aReceber,   '#F79009', false],
        ['Custos totais',    custoTotal, '#F04438', false],
        ['Custos pagos',     contasPagas,'#667085', false],
        ['Lucro previsto',   lucroPrev,  lucroPrev>=0?'#12B76A':'#F04438', true],
      ].map(([l,v,c,b])=>`
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:9px 0;border-bottom:1px solid var(--border)">
          <span style="color:var(--gray)">${l}</span>
          <span style="font-weight:${b?'700':'600'};color:${c}">${Utils.formatCurrency(v)}</span>
        </div>`).join('')}
    </div>
  </div>


  `;

  } catch(e) {
    console.error('Dashboard error:', e);
    return '<div style="padding:32px;color:#F04438">Erro ao carregar dashboard: '+e.message+'</div>';
  }
}

// ── FINANCEIRO DO MÊS (dashboard) ──────────────────────────────────────
function somarMes(mes, delta) {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

async function calcularFinanceiroMes(mes) {
  const [pagamentos, passageiros, excursoes, contas] = await Promise.all([
    DB.getAll('pagamentos'), DB.getAll('passageiros'), DB.getAll('excursoes'), DB.getAll('contas'),
  ]);
  const passById = Object.fromEntries(passageiros.map(p => [p.id, p]));
  const excById  = Object.fromEntries(excursoes.map(e => [e.id, e]));
  const hoje = Utils.today();

  const emitidos  = { itens: [], valor: 0 };
  const recebidos = { itens: [], valor: 0 };
  const pendentes = { itens: [], valor: 0 };
  const atrasados = { itens: [], valor: 0 };

  for (const pg of pagamentos) {
    const pago    = pg.status === 'pago';
    const dataRef = pago ? (pg.data || pg.vencimento) : (pg.vencimento || pg.data);
    if (!dataRef || dataRef.slice(0, 7) !== mes) continue;
    const pass = passById[pg.passageiroId];
    const exc  = excById[pg.excursaoId] || excById[pass?.excursaoId];
    const item = {
      clienteNome: pass?.nome || '—',
      viagemNome:  exc?.nome || '—',
      data: dataRef,
      valor: parseFloat(pg.valor) || 0,
      forma: pg.forma,
    };
    emitidos.itens.push(item); emitidos.valor += item.valor;
    if (pago) {
      recebidos.itens.push(item); recebidos.valor += item.valor;
    } else if (pg.vencimento && pg.vencimento < hoje) {
      atrasados.itens.push(item); atrasados.valor += item.valor;
    } else {
      pendentes.itens.push(item); pendentes.valor += item.valor;
    }
  }
  [emitidos, recebidos, pendentes, atrasados].forEach(b => b.itens.sort((a, b2) => a.data.localeCompare(b2.data)));

  let custosPagosMes = 0, custosTotalMes = 0;
  for (const c of contas) {
    if (!c.vencimento || c.vencimento.slice(0, 7) !== mes) continue;
    const v = parseFloat(c.valor) || 0;
    custosTotalMes += v;
    if (c.status === 'pago') custosPagosMes += v;
  }

  return {
    emitidos, recebidos, pendentes, atrasados,
    custosPagosMes, custosTotalMes,
    lucroReal:     recebidos.valor - custosPagosMes,
    lucroPrevisto: emitidos.valor  - custosTotalMes,
  };
}

function mudarMesDash(delta) {
  window._dashMonth = somarMes(window._dashMonth || Utils.today().slice(0, 7), delta);
  navigate('dashboard');
}

const FIN_CATEGORIA_INFO = {
  emitidos:  { titulo: 'Emitidas',  colData: 'Data',      mostrarForma: true  },
  recebidos: { titulo: 'Recebidas', colData: 'Pago em',   mostrarForma: true  },
  pendentes: { titulo: 'Pendentes', colData: 'Vence em',  mostrarForma: false },
  atrasados: { titulo: 'Atrasadas', colData: 'Venceu em', mostrarForma: false },
};

async function abrirDetalheFinanceiro(categoria) {
  const titulo = categoria === 'lucro' ? 'Lucro do mês' : FIN_CATEGORIA_INFO[categoria].titulo;
  openModal(titulo, '<div id="finDetalheBody" style="min-height:120px;text-align:center;padding:32px;color:var(--gray)">Carregando...</div>', 'modal-lg', []);
  await renderFinDetalheBody(categoria, window._dashMonth);
}

async function mudarMesFinDetalhe(categoria, mesAtual, delta) {
  await renderFinDetalheBody(categoria, somarMes(mesAtual, delta));
}

async function renderFinDetalheBody(categoria, mes) {
  const dados = await calcularFinanceiroMes(mes);
  const box = document.getElementById('finDetalheBody');
  if (!box) return; // modal foi fechado enquanto carregava

  const [ano, numMes] = mes.split('-');
  const nomeMes = Utils.capitalizar(new Date(Number(ano), Number(numMes) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
  const seletor = `
    <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:18px">
      <button class="btn btn-outline btn-sm" onclick="mudarMesFinDetalhe('${categoria}','${mes}',-1)">← Mês anterior</button>
      <b style="min-width:150px;text-align:center">${nomeMes}</b>
      <button class="btn btn-outline btn-sm" onclick="mudarMesFinDetalhe('${categoria}','${mes}',1)">Próximo mês →</button>
    </div>`;

  if (categoria === 'lucro') {
    box.innerHTML = seletor + `
      <div class="stats-grid" style="grid-template-columns:repeat(2,1fr)">
        <div class="stat-card"><div class="stat-label">Lucro real</div><div class="stat-value ${dados.lucroReal>=0?'green':'red'} sv-currency">${Utils.formatCurrency(dados.lucroReal)}</div></div>
        <div class="stat-card"><div class="stat-label">Lucro previsto</div><div class="stat-value ${dados.lucroPrevisto>=0?'green':'red'} sv-currency">${Utils.formatCurrency(dados.lucroPrevisto)}</div></div>
      </div>
      <div class="table-wrapper" style="margin-top:4px"><table><tbody>
        <tr><td>Recebido no mês</td><td class="text-green fw-600" style="text-align:right">${Utils.formatCurrency(dados.recebidos.valor)}</td></tr>
        <tr><td>Custos pagos no mês</td><td class="fw-600" style="text-align:right">${Utils.formatCurrency(dados.custosPagosMes)}</td></tr>
        <tr><td>Emitido no mês (previsto)</td><td class="text-blue fw-600" style="text-align:right">${Utils.formatCurrency(dados.emitidos.valor)}</td></tr>
        <tr><td>Custo total do mês</td><td class="fw-600" style="text-align:right">${Utils.formatCurrency(dados.custosTotalMes)}</td></tr>
      </tbody></table></div>`;
    return;
  }

  const info   = FIN_CATEGORIA_INFO[categoria];
  const bucket = dados[categoria];
  const rows = bucket.itens.map(it => `<tr>
    <td>${Utils.escHtml(it.clienteNome)}</td>
    <td>${Utils.escHtml(it.viagemNome)}</td>
    <td>${Utils.formatDate(it.data)}</td>
    <td class="fw-600">${Utils.formatCurrency(it.valor)}</td>
    ${info.mostrarForma ? `<td>${Utils.escHtml(it.forma || '—')}</td>` : ''}
  </tr>`).join('');

  box.innerHTML = seletor + `
    <div class="stats-grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:16px">
      <div class="stat-card"><div class="stat-label">${info.titulo}</div><div class="stat-value">${bucket.itens.length}</div></div>
      <div class="stat-card"><div class="stat-label">Valor total</div><div class="stat-value sv-currency">${Utils.formatCurrency(bucket.valor)}</div></div>
    </div>
    ${bucket.itens.length
      ? `<div class="table-wrapper"><table>
          <thead><tr><th>Cliente</th><th>Viagem</th><th>${info.colData}</th><th>Valor</th>${info.mostrarForma ? '<th>Forma</th>' : ''}</tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`
      : '<p class="text-gray" style="text-align:center;padding:24px">Nenhum registro nesse mês.</p>'}`;
}


function renderExcCard(exc, passageiros, pagamentos, contas, tipos) {
  const pass      = passageiros.filter(p => p.excursaoId===exc.id && p.status!=='cancelado');
  const pagantes  = pass.filter(p => Utils.getTipo(p.tipoPassageiroId, tipos).pagante);
  const ocupantes = pass.filter(p => Utils.getTipo(p.tipoPassageiroId, tipos).ocupaVaga);
  const pags      = pagamentos.filter(p => p.excursaoId===exc.id && p.status==='pago');
  const recebido  = pags.reduce((s,p) => s+(parseFloat(p.valor)||0), 0);
  const previsto  = pagantes.reduce((s,p) => s+(parseFloat(p.valorFinal??p.valorCombinado)||0), 0);
  const custos    = contas.filter(c => c.excursaoId===exc.id).reduce((s,c) => s+(Utils.calcularValorConta(c,pass,tipos)||0), 0);
  const lucro     = previsto - custos;
  const vagas     = parseInt(exc.vagas)||0;
  const vagasLivres = vagas - ocupantes.length;
  const confirmados = pass.filter(p => p.status==='confirmado').length;

  let statusBadge = 'Em aberto', statusClass = 'badge-gray';
  if      (exc.statusManual === 'concluida')    { statusBadge = 'Concluída';    statusClass = 'badge-green'; }
  else if (exc.statusManual === 'cancelada')    { statusBadge = 'Cancelada';    statusClass = 'badge-red'; }
  else if (exc.statusManual === 'em_andamento') { statusBadge = 'Em andamento'; statusClass = 'badge-yellow'; }
  else if (recebido >= custos && custos > 0)    { statusBadge = 'Pago';         statusClass = 'badge-green'; }
  else if (custos > 0 && recebido/custos >= 0.7){ statusBadge = 'Quase pago';  statusClass = 'badge-yellow'; }
  else if (recebido > 0)                        { statusBadge = 'Em andamento'; statusClass = 'badge-orange'; }

  return `
  <div class="exc-card" onclick="navigate('excursao',{excursaoId:'${exc.id}',tab:'passageiros'})">
    <div class="exc-card-header">
      <span class="exc-card-label" style="background:${Utils.escHtml(exc.cor||'#0F766E')}"></span>
      <div class="exc-card-info">
        <div class="exc-card-name">${Utils.escHtml(exc.nome)}</div>
        <div class="exc-card-dest">${Utils.escHtml(exc.destino||'')}</div>
      </div>
      <span class="exc-card-date">${Utils.formatDate(exc.dataSaida)}</span>
    </div>
    <div class="exc-card-body">
      <div class="exc-card-row"><span>Vagas</span><span>${ocupantes.length} / ${vagas} <span class="text-gray">(${vagasLivres} livres)</span></span></div>
      <div class="exc-card-row"><span>Confirmados</span><span>${confirmados}</span></div>
      <div class="exc-card-row"><span>Pagantes</span><span>${pagantes.length}</span></div>
      <div class="exc-card-row"><span>Recebido</span><span class="text-green">${Utils.formatCurrency(recebido)}</span></div>
      <div class="exc-card-row"><span>A receber</span><span class="text-orange">${Utils.formatCurrency(Math.max(0,previsto-recebido))}</span></div>
      <div class="exc-card-row"><span>Lucro previsto</span><span class="${lucro>=0?'text-green':'text-red'}">${Utils.formatCurrency(lucro)}</span></div>
    </div>
    <div class="exc-card-footer">
      <span class="badge ${statusClass}">${statusBadge}</span>
      <span class="text-gray" style="font-size:13px">${Utils.escHtml(exc.horario||'')} ${Utils.escHtml(exc.localEmbarque||'')}</span>
    </div>
  </div>`;
}

// ── LISTA DE EXCURSÕES ──────────────────────────────────────────────── aqui já é a aba de excursões. Objetivo dessa aba é apenas para visualização, então as excursões não serão criadas aqui (comentar com o sales para rancar grande parte do cod)
async function renderExcursoes() {
  const [excursoes, passageiros, pagamentos, contas, tipos] = await Promise.all([
    DB.getAll('excursoes'), DB.getAll('passageiros'),
    DB.getAll('pagamentos'), DB.getAll('contas'), DB.getAll('tiposPassageiro')
  ]);
  if (!excursoes.length) return `
    <div class="empty-state">
      <svg viewBox="0 0 24 24"><path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z"/></svg>
      <h3>Nenhuma viagem</h3><p>Crie sua primeira viagem.</p>
      
    </div>`;
    // <button class="btn btn-primary mt-16" onclick="openModalExcursao()">+ Nova viagem</button> 
  const today   = Utils.today();
  const sorted  = [...excursoes].sort((a,b)=>(a.dataSaida||'9999').localeCompare(b.dataSaida||'9999'));
  const ativas  = sorted.filter(e => !e.dataSaida || e.dataSaida >= today);
  const passadas= sorted.filter(e => e.dataSaida && e.dataSaida < today);
  const buildGrid = (list) => list.length
    ? `<div class="excursoes-grid">${list.map(e => renderExcCard(e, passageiros, pagamentos, contas, tipos)).join('')}</div>`
    : `<p class="text-gray" style="font-size:14px;margin-bottom:16px">Nenhuma viagem neste grupo.</p>`;

  return `
  <div class="filter-bar" style="margin-bottom:20px">
    <input class="form-control search-input" id="searchExc" placeholder="Buscar viagem..." oninput="filtrarExcursoes()" />
    <select class="form-control" id="filterExcStatus" onchange="filtrarExcursoes()" style="max-width:180px">
      <option value="todas">Todas</option>
      <option value="ativas">Em andamento / futuras</option>
      <option value="finalizadas">Finalizadas</option>
    </select>
  </div>
  <div id="excGrupoAtivas">
    <div class="section-title" style="margin-bottom:12px">Em andamento / futuras <span class="badge badge-green" style="font-size:12px;vertical-align:middle">${ativas.length}</span></div>
    ${buildGrid(ativas)}
  </div>
  <div id="excGrupoPassadas" style="margin-top:28px">
    <div class="section-title" style="margin-bottom:12px">Finalizadas <span class="badge badge-gray" style="font-size:12px;vertical-align:middle">${passadas.length}</span></div>
    ${buildGrid(passadas)}
  </div>`;
}

function filtrarExcursoes() {
  const q      = (document.getElementById('searchExc')?.value||'').toLowerCase();
  const status = document.getElementById('filterExcStatus')?.value||'todas';
  document.getElementById('excGrupoAtivas').style.display   = status==='finalizadas' ? 'none' : '';
  document.getElementById('excGrupoPassadas').style.display = status==='ativas'      ? 'none' : '';
  document.querySelectorAll('.exc-card').forEach(card => {
    const nome = (card.querySelector('.exc-card-name')?.textContent||'').toLowerCase();
    const dest = (card.querySelector('.exc-card-dest')?.textContent||'').toLowerCase();
    card.style.display = (!q || nome.includes(q) || dest.includes(q)) ? '' : 'none';
  });
}

// ── DETALHE DA EXCURSÃO ───────────────────────────────────────────────
async function renderExcursao() {
  const [exc, todosPass, todosPags, todasContas, tipos, pacotes, reservas] = await Promise.all([
    DB.getById('excursoes', state.excursaoId),
    DB.getAll('passageiros'), DB.getAll('pagamentos'), DB.getAll('contas'),
    DB.getAll('tiposPassageiro'), DB.getAll('pacotes'), DB.getAll('reservas')
  ]);
  if (!exc) return `<div class="empty-state"><h3>Viagem não encontrada</h3></div>`;

  const passageiros = todosPass.filter(p => p.excursaoId===exc.id);
  const pagamentos  = todosPags.filter(p => p.excursaoId===exc.id);
  const contas      = todasContas.filter(c => c.excursaoId===exc.id);
  const excPacotes  = pacotes.filter(p => p.excursaoId===exc.id);
  const excReservas = reservas.filter(r => r.excursaoId===exc.id);
  const fin         = Utils.calcExcursaoFinanceiro(exc, todosPass, todosPags, todasContas, tipos);

  const heroStatus = (() => {
    if (exc.statusManual === 'concluida')    return `<span class="badge badge-green">Concluída ✓</span>`;
    if (exc.statusManual === 'cancelada')    return `<span class="badge badge-red">Cancelada</span>`;
    if (exc.statusManual === 'em_andamento') return `<span class="badge badge-yellow">Em andamento</span>`;
    // Automático
    if (fin.receitaRecebida >= fin.custoTotal && fin.custoTotal > 0)
      return `<span class="badge badge-green">Paga ✓</span>`;
    if (fin.receitaRecebida > 0)
      return `<span class="badge badge-yellow">Em andamento</span>`;
    return `<span class="badge badge-gray">Em aberto</span>`;
  })();

  const tabs = ['pacotes','passageiros','assentos','pagamentos','contas','financeiro','embarque','relatorios'];
  const tabLabels = ['Pacotes','Passageiros','Assentos','Pagamentos','Contas','Financeiro','Embarque','Relatórios'];
  const cur = state.tab || 'passageiros';

  let tabContent = '';
  if      (cur==='pacotes')     tabContent = renderTabPacotes(exc, excPacotes, passageiros, tipos);
  else if (cur==='passageiros') tabContent = renderTabPassageiros(exc, passageiros, pagamentos, tipos, excPacotes, excReservas);
  else if (cur==='assentos')    tabContent = renderTabAssentos(exc, passageiros, tipos);
  else if (cur==='pagamentos')  tabContent = renderTabPagamentos(exc, passageiros, pagamentos);
  else if (cur==='contas')      tabContent = renderTabContas(exc, contas, tipos, passageiros, excPacotes, await DB.getAll('fornecedores'));
  else if (cur==='financeiro')  tabContent = renderTabFinanceiro(exc, fin, contas, passageiros, pagamentos, tipos);
  else if (cur==='embarque')    tabContent = renderTabEmbarque(exc, passageiros, pagamentos, tipos);
  else if (cur==='relatorios')  tabContent = renderTabRelatorios(exc, passageiros, pagamentos, contas, fin, tipos);

  return `
  <button class="back-link" onclick="navigate('excursoes')">
    <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
    Voltar para Viagens
  </button>
  <div class="exc-detail-hero" style="background:${Utils.escHtml(exc.cor||'#0F766E')}">
    <div class="flex-between flex-wrap gap-8" style="margin-bottom:16px">
      <div>
        <h1>${Utils.escHtml(exc.nome)}</h1>
        <div class="sub">${Utils.escHtml(exc.destino||'')} · Saída ${Utils.formatDate(exc.dataSaida)}${exc.horario?' às '+exc.horario:''} · ${Utils.escHtml(exc.localEmbarque||'')}</div>
      </div>
      ${heroStatus}
    </div>
    <div class="exc-detail-stats">
      <div class="exc-hero-stat"><div class="label">Vagas</div><div class="value">${fin.qtdOcupantes}/${fin.vagas}</div></div>
      <div class="exc-hero-stat"><div class="label">Pagantes</div><div class="value">${fin.qtdPagantes}</div></div>
      <div class="exc-hero-stat"><div class="label">Livres</div><div class="value">${fin.vagasLivres}</div></div>
      <div class="exc-hero-stat"><div class="label">Recebido</div><div class="value hero-currency">${Utils.formatCurrency(fin.receitaRecebida)}</div></div>
      <div class="exc-hero-stat"><div class="label">A Receber</div><div class="value hero-currency">${Utils.formatCurrency(fin.receitaPendente)}</div></div>
      <div class="exc-hero-stat"><div class="label">Lucro Previsto</div><div class="value hero-currency">${Utils.formatCurrency(fin.lucroPrevisto)}</div></div>
    </div>
  </div>
  <div class="tabs">
    
  </div>
  <div id="tabContent">${tabContent}</div>`; // ${tabs.map((t,i) => `<button class="tab-btn ${t===cur?'active':''}" onclick="navigate('excursao',{excursaoId:'${exc.id}',tab:'${t}'})">${tabLabels[i]}</button>`).join('')} linha 406
}

// ── TAB: PACOTES ────────────────────────────────────────────────────── Dentro da aba de excursões, opção de pacotes
function renderTabPacotes(exc, pacotes, passageiros, tipos) {
  const ativos = pacotes.filter(p => p.ativo !== false);
  const rows   = ativos.map(pac => {
    const usandoPac = passageiros.filter(p => p.pacoteId===pac.id && p.status!=='cancelado');
    const receita   = usandoPac.reduce((s,p) => s+(parseFloat(p.valorFinal??p.valorCombinado)||0), 0);
    const tipoPad   = tipos.find(t => t.id===pac.tipoPassageiroPadraoId);
    return `<tr>
      <td><b>${Utils.escHtml(pac.nome)}</b><br><span class="text-gray" style="font-size:12px">${Utils.escHtml(pac.descricao||'')}</span></td>
      <td class="fw-600">${Utils.formatCurrency(pac.valorVenda)}</td>
      <td>${Utils.escHtml(tipoPad?.nome||'Adulto')}</td>
      <td style="text-align:center">${usandoPac.length}</td>
      <td class="text-green">${Utils.formatCurrency(receita)}</td>
      <td class="td-actions">
        <button class="btn btn-outline btn-sm" onclick="openModalPacote('${exc.id}','${pac.id}')">✎ Editar</button>
        <button class="btn btn-sm" style="background:#FEE2E2;color:#B91C1C" onclick="desativarPacote('${pac.id}','${exc.id}')">Desativar</button>
      </td>
    </tr>`;
  });

  const totalReceita = ativos.reduce((s, pac) => {
    const usandoPac = passageiros.filter(p => p.pacoteId===pac.id && p.status!=='cancelado');
    return s + usandoPac.reduce((ss,p) => ss+(parseFloat(p.valorFinal??p.valorCombinado)||0), 0);
  }, 0);
  const semPacote = passageiros.filter(p => p.status!=='cancelado' && !p.pacoteId).length;

  return `
  <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
    <div class="stat-card"><div class="stat-label">Pacotes</div><div class="stat-value">${ativos.length}</div></div>
    <div class="stat-card"><div class="stat-label">Receita Prevista</div><div class="stat-value green sv-currency">${Utils.formatCurrency(totalReceita)}</div></div>
    <div class="stat-card"><div class="stat-label">Mais vendido</div><div class="stat-value" style="font-size:14px">${ativos.sort((a,b)=>passageiros.filter(p=>p.pacoteId===b.id).length-passageiros.filter(p=>p.pacoteId===a.id).length)[0]?.nome||'—'}</div></div>
    <div class="stat-card"><div class="stat-label">Sem pacote</div><div class="stat-value ${semPacote>0?'orange':''}">${semPacote}</div></div>
  </div>
  <div class="flex-between mb-16">
    <span class="section-title">Pacotes da viagem</span>
    <button class="btn btn-primary" onclick="openModalPacote('${exc.id}')">+ Novo Pacote</button>
  </div>
  ${!ativos.length
    ? `<div class="empty-state"><h3>Nenhum pacote</h3><button class="btn btn-primary mt-16" onclick="openModalPacote('${exc.id}')">+ Criar pacote</button></div>`
    : `<div class="table-wrapper"><table>
        <thead><tr><th>Pacote</th><th>Valor Venda</th><th>Tipo Padrão</th><th>Passageiros</th><th>Receita</th><th></th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table></div>`
  }`;
}

async function openModalPacote(excId, id=null) { //criação de pacote
  const [tipos, pac] = await Promise.all([DB.getAll('tiposPassageiro'), id?DB.getById('pacotes',id):null]);
  const v   = pac || {};
  const exc = await DB.getById('excursoes', excId);
  openModal(id?'Editar Pacote':'Novo Pacote', `
  <form id="formPacote" onsubmit="salvarPacote(event,'${excId}','${id||''}')">
    <div class="form-group"><label class="form-label">Nome *</label>
      <input class="form-control" name="nome" value="${Utils.escHtml(v.nome||'')}" required placeholder="Ex: Pacote Single, Duplo, Infantil..."/></div>
    <div class="form-group"><label class="form-label">Descrição</label>
      <input class="form-control" name="descricao" value="${Utils.escHtml(v.descricao||'')}"/></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Valor de venda (R$) *</label>
        <input class="form-control" type="number" name="valorVenda" value="${v.valorVenda||exc?.valorPassageiro||''}" min="0" step="0.01" required/></div>
      <div class="form-group"><label class="form-label">Tipo de passageiro padrão</label>
        <select class="form-control" name="tipoPassageiroPadraoId">
          ${tipos.filter(t=>t.ativo!==false).map(t=>`<option value="${t.id}" ${v.tipoPassageiroPadraoId===t.id?'selected':''}>${Utils.escHtml(t.nome)}</option>`).join('')}
        </select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Custo estimado (R$)</label>
        <input class="form-control" type="number" name="custoEstimado" value="${v.custoEstimado||0}" min="0" step="0.01"/></div>
    </div>
    <div class="form-group"><label class="form-label">Observações</label>
      <textarea class="form-control" name="observacoes" rows="2">${Utils.escHtml(v.observacoes||'')}</textarea></div>
    <button type="submit" class="btn btn-primary w-full">${id?'Salvar':'Criar Pacote'}</button>
  </form>`);
}

async function salvarPacote(e, excId, id) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  data.excursaoId = excId;
  data.ativo = true;
  if (id) data.id = id;
  await DB.save('pacotes', data);
  closeModal();
  Utils.showToast(id?'Pacote atualizado!':'Pacote criado!');
  navigate('excursao', { excursaoId: excId, tab: 'pacotes' });
}

async function desativarPacote(id, excId) {
  if (!confirm('Desativar este pacote?')) return;
  const p = await DB.getById('pacotes', id);
  if (p) { p.ativo = false; await DB.save('pacotes', p); }
  Utils.showToast('Pacote desativado');
  navigate('excursao', { excursaoId: excId, tab: 'pacotes' });
}

// ── TAB: PASSAGEIROS ───────────────────────────────────────────────── Opção de passageiros dentro da excursão na aba de excursões 
function renderTabPassageiros(exc, passageiros, pagamentos, tipos, pacotes, reservas) {
  const modoView = state._modoPass || 'lista';

  const filterBar = `
  <div class="flex-between mb-16 flex-wrap gap-8">
    <div class="filter-bar" style="margin:0;flex:1">
      <input class="form-control search-input" id="searchPass" placeholder="Buscar passageiro..." oninput="filtrarPassageiros()" />
      <select class="form-control" id="filterStatus" onchange="filtrarPassageiros()" style="max-width:160px">
        <option value="">Todos</option>
        ${STATUS_PASSAGEIRO.map(s=>`<option value="${s}">${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
      </select>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn ${modoView==='lista'?'btn-primary':'btn-outline'} btn-sm" onclick="state._modoPass='lista';navigate('excursao',{excursaoId:'${exc.id}',tab:'passageiros'})">Por passageiro</button>
      <button class="btn ${modoView==='reserva'?'btn-primary':'btn-outline'} btn-sm" onclick="state._modoPass='reserva';navigate('excursao',{excursaoId:'${exc.id}',tab:'passageiros'})">Por reserva</button>
      <button class="btn btn-outline btn-sm" onclick="AtlasExcel.importarPassageiros('${exc.id}')" title="Importar passageiros de planilha Excel">
        <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor"><path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2z"/></svg>
        Importar Excel
      </button>
      <button class="btn btn-outline btn-sm" onclick="AtlasExcel.exportarPassageiros('${exc.id}')" title="Exportar passageiros para Excel">
        <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
        Exportar Excel
      </button>
      <button class="btn btn-primary" onclick="openModalPassageiro('${exc.id}')">+ Passageiro</button>
    </div>
  </div>`;

  if (!passageiros.length) return filterBar + `<div class="empty-state"><h3>Nenhum passageiro</h3><button class="btn btn-primary mt-16" onclick="openModalPassageiro('${exc.id}')">+ Adicionar</button></div>`;

  if (modoView === 'reserva') {
    return filterBar + renderPassageirosPorReserva(exc, passageiros, pagamentos, tipos, reservas);
  }

  const rows = passageiros.map(p => {
    const fin    = Utils.calcPassageiroFinanceiro(p, pagamentos);
    const tipo   = tipos.find(t => t.id===p.tipoPassageiroId);
    const pac    = pacotes.find(pk => pk.id===p.pacoteId);
    const waLink = p.telefone ? Utils.waLink(p.telefone) : null;
    return `<tr data-nome="${Utils.escHtml(p.nome).toLowerCase()}" data-status="${p.status}">
      <td>
        <b>${Utils.escHtml(p.nome)}</b><br>
        <span class="text-gray" style="font-size:12px">${Utils.escHtml(p.telefone||'')}</span>
        ${waLink?`<a href="${waLink}" target="_blank" class="wa-btn" title="WhatsApp">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.559 4.14 1.535 5.875L.057 23.899l6.224-1.635A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.002-1.373l-.36-.213-3.692.97.985-3.601-.233-.369A9.818 9.818 0 1112 21.818z"/></svg>
        </a>`:''}
        ${p.codigoReserva?`<br><span class="badge badge-gray" style="font-size:10px">${Utils.escHtml(p.codigoReserva)}</span>`:''}
      </td>
      <td style="text-align:center">${p.assento||'—'}</td>
      <td>
        ${Utils.statusSelect(p.status, p.id, exc.id)}
        ${tipo?`<br><span class="badge badge-gray" style="font-size:10px;margin-top:3px">${Utils.escHtml(tipo.nome)}</span>`:''}
      </td>
      <td class="sv-currency">${Utils.formatCurrency(fin.valorTotal)}</td>
      <td class="text-green fw-600 sv-currency">${Utils.formatCurrency(fin.totalPago)}</td>
      <td class="${fin.saldo>0?'text-orange':'text-green'} fw-600 sv-currency">${Utils.formatCurrency(fin.saldo)}</td>
      <td class="td-actions">
        <button class="btn btn-outline btn-sm" onclick="openModalPassageiro('${exc.id}','${p.id}')">Editar</button>
        <button class="btn btn-outline btn-sm" onclick="openModalPagamentos('${p.id}','${exc.id}')">Pagtos</button>
        <button class="btn btn-sm" style="background:#FEE2E2;color:#B91C1C" onclick="excluirPassageiro('${p.id}')">✕</button>
      </td>
    </tr>`;
  }).join('');

  return filterBar + `<div class="table-wrapper"><table id="tabelaPassageiros">
    <thead><tr><th>Nome</th><th>Assento</th><th>Status / Tipo</th><th>Valor</th><th>Pago</th><th>Saldo</th><th>Ações</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function renderPassageirosPorReserva(exc, passageiros, pagamentos, tipos, reservas) {
  const grupos = {};
  passageiros.forEach(p => {
    const key = p.codigoReserva || 'sem-reserva';
    if (!grupos[key]) grupos[key] = { codigo: key, titular: p.titularReserva||p.nome, passageiros: [] };
    grupos[key].passageiros.push(p);
  });

  return Object.values(grupos).map(g => {
    const pTotal = g.passageiros.reduce((s,p) => s+(parseFloat(p.valorFinal??p.valorCombinado)||0), 0);
    const pPago  = g.passageiros.reduce((s,p) => {
      const fin = Utils.calcPassageiroFinanceiro(p, pagamentos);
      return s + fin.totalPago;
    }, 0);
    const pSaldo = pTotal - pPago;
    const detRows = g.passageiros.map(p => {
      const fin  = Utils.calcPassageiroFinanceiro(p, pagamentos);
      const tipo = tipos.find(t => t.id===p.tipoPassageiroId);
      return `<tr>
        <td>${Utils.escHtml(p.nome)}</td>
        <td>${p.assento||'—'}</td>
        <td><span class="badge badge-gray" style="font-size:11px">${Utils.escHtml(tipo?.nome||'Adulto')}</span></td>
        <td>${Utils.statusSelect(p.status, p.id, exc.id)}</td>
        <td>${Utils.formatCurrency(fin.valorTotal)}</td>
        <td class="text-green">${Utils.formatCurrency(fin.totalPago)}</td>
        <td class="${fin.saldo>0?'text-orange':'text-green'} fw-600">${Utils.formatCurrency(fin.saldo)}</td>
        <td class="td-actions">
          <button class="btn btn-outline btn-sm" onclick="openModalPassageiro('${exc.id}','${p.id}')">✎</button>
          <button class="btn btn-outline btn-sm" onclick="openModalPagamentos('${p.id}','${exc.id}')">$</button>
        </td>
      </tr>`;
    }).join('');

    return `<div class="reserva-grupo">
      <div class="reserva-grupo-header" onclick="toggleReserva('${g.codigo}')">
        <div>
          <span class="badge badge-blue" style="font-size:12px">${Utils.escHtml(g.codigo)}</span>
          <b style="margin-left:8px">${Utils.escHtml(g.titular)}</b>
          <span class="text-gray" style="font-size:13px;margin-left:8px">${g.passageiros.length} pax</span>
        </div>
        <div style="display:flex;gap:16px;align-items:center">
          <span class="text-green fw-600">${Utils.formatCurrency(pPago)}</span>
          <span class="${pSaldo>0?'text-orange':'text-green'} fw-600">${Utils.formatCurrency(pSaldo)} saldo</span>
          <span class="text-gray">▾</span>
        </div>
      </div>
      <div class="reserva-grupo-body" id="reserva-${g.codigo.replace(/[^a-zA-Z0-9]/g,'')}">
        <div class="table-wrapper"><table>
          <thead><tr><th>Nome</th><th>Assento</th><th>Tipo</th><th>Status</th><th>Valor</th><th>Pago</th><th>Saldo</th><th></th></tr></thead>
          <tbody>${detRows}</tbody>
        </table></div>
      </div>
    </div>`;
  }).join('');
}

function toggleReserva(codigo) {
  const key = codigo.replace(/[^a-zA-Z0-9]/g,'');
  const el  = document.getElementById('reserva-'+key);
  if (el) el.style.display = el.style.display==='none' ? '' : 'none';
}

function filtrarPassageiros() {
  const q = (document.getElementById('searchPass')?.value||'').toLowerCase();
  const s = (document.getElementById('filterStatus')?.value||'').toLowerCase();
  document.querySelectorAll('#tabelaPassageiros tbody tr').forEach(tr => {
    const nome   = tr.dataset.nome||'';
    const status = tr.dataset.status||'';
    tr.style.display = (!q||nome.includes(q)) && (!s||status===s) ? '' : 'none';
  });
}

async function atualizarStatusPassageiro(passId, excId, selectEl) {
  const p = await DB.getById('passageiros', passId);
  if (!p) return;
  p.status = selectEl.value;
  await DB.save('passageiros', p);
  selectEl.className = `status-select ${selectEl.value}`;
  selectEl.closest('tr').dataset.status = selectEl.value;
  Utils.showToast(`Status: ${selectEl.value}`);
}

// ── MODAL: PASSAGEIRO (4 blocos) ──────────────────────────────────────
async function openModalPassageiro(excId, id=null, dadosIniciais={}) {
  const [p, exc, tipos, pacotes, todasReservas, vendedores] = await Promise.all([
    id?DB.getById('passageiros',id):null,
    DB.getById('excursoes', excId),
    DB.getAll('tiposPassageiro'),
    DB.getAll('pacotes'),
    DB.getAll('reservas'),
    DB.getAll('vendedores')
  ]);
  const excReservas = todasReservas.filter(r => r.excursaoId === excId);
  const v = p ? { ...p } : { ...dadosIniciais };
  const diaVencimentoAtual = v.diaVencimento || (v.dataPrimeiraParcela ? parseInt(String(v.dataPrimeiraParcela).split('-')[2]) : '');
  const vagas   = parseInt(exc?.vagas)||40;
  const pacExc  = pacotes.filter(pk => pk.excursaoId===excId && pk.ativo!==false);
  const tiposAti= tipos.filter(t => t.ativo!==false);

  // Mapa de assentos ocupados
  const todosPass = await DB.getAll('passageiros');
  const ocupados  = {};
  todosPass.filter(ps => ps.excursaoId===excId && ps.status!=='cancelado' && ps.assento && ps.id!==(p?.id))
    .forEach(ps => { ocupados[String(ps.assento)] = ps.nome; });

  const assentoOpts = [
    `<option value="">— Sem assento —</option>`,
    ...Array.from({length:vagas},(_,i)=>{
      const num   = String(i+1);
      const sel   = v.assento==num ? 'selected' : '';
      const nome  = ocupados[num];
      return nome
        ? `<option value="${num}" disabled>🔴 ${num} — ${Utils.escHtml(nome.split(' ')[0])}</option>`
        : `<option value="${num}" ${sel}>🟢 ${num} — Livre</option>`;
    })
  ].join('');

  const pacOpts = [`<option value="">— Sem pacote —</option>`,
    ...pacExc.map(pk=>`<option value="${pk.id}" data-valor="${pk.valorVenda}" data-tipo="${pk.tipoPassageiroPadraoId||''}" ${v.pacoteId===pk.id?'selected':''}>${Utils.escHtml(pk.nome)} — ${Utils.formatCurrency(pk.valorVenda)}</option>`)
  ].join('');

  const tipoOpts = tiposAti.map(t=>`<option value="${t.id}" ${v.tipoPassageiroId===t.id?'selected':''}>${Utils.escHtml(t.nome)} ${!t.pagante?'(não pagante)':''}</option>`).join('');

  openModal(id?'Editar Passageiro':'Novo Passageiro', `
  <form id="formPass" onsubmit="salvarPassageiro(event,'${excId}','${id||''}')">

  ${!id ? ` 
  <div class="cliente-search-box">
    <label><svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg> Buscar cliente já cadastrado</label>
    <input class="form-control" id="buscaClienteExistente"
      placeholder="Nome ou telefone — preenche tudo automaticamente"
      oninput="buscarClienteExistente(this.value)" autocomplete="off"/>
    <div id="resultadosBuscaCliente" style="position:relative"></div>
  </div>` : ''}

  <!-- SEÇÃO 1: DADOS PESSOAIS -->
  <div class="form-section">
    <div class="form-section-header">
      <div class="form-section-icon"><svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div>
      <div>
        <div class="form-section-label">Dados pessoais</div>
        <div class="form-section-sub">Identificação do passageiro</div>
      </div>
    </div>
    <div class="form-row" style="grid-template-columns:1fr 1fr 1fr">
      <div class="form-group" style="grid-column:1/-1"><label class="form-label">Nome completo *</label>
        <input class="form-control" name="nome" value="${Utils.escHtml(v.nome||'')}" required placeholder="Nome completo"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Telefone / WhatsApp</label>
        <input class="form-control" name="telefone" value="${Utils.escHtml(v.telefone||'')}" placeholder="(00) 00000-0000"/></div>
      <div class="form-group"><label class="form-label">CPF / Documento</label>
        <input class="form-control" name="documento" value="${Utils.escHtml(v.documento||'')}"/></div>
      <div class="form-group"><label class="form-label">RG</label>
        <input class="form-control" name="rg" value="${Utils.escHtml(v.rg||'')}"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Data de nascimento</label>
        <input class="form-control" type="date" name="nascimento" value="${v.nascimento||''}"/></div>
      <div class="form-group"><label class="form-label">Cidade</label>
        <input class="form-control" name="cidade" value="${Utils.escHtml(v.cidade||'')}"/></div>
      <div class="form-group"><label class="form-label">Contato de emergência</label>
        <input class="form-control" name="emergencia" value="${Utils.escHtml(v.emergencia||'')}" placeholder="Nome e telefone"/></div>
    </div>
  </div>

  <!-- SEÇÃO 2: RESERVA E EMBARQUE -->
  <div class="form-section section-highlight">
    <div class="form-section-header">
      <div class="form-section-icon"><svg viewBox="0 0 24 24"><path d="M20 12c0-1.1.9-2 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v4c1.1 0 2 .9 2 2s-.9 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2z"/></svg></div>
      <div>
        <div class="form-section-label">Reserva e embarque</div>
        <div class="form-section-sub">Pacote, assento e ponto de saída</div>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Pacote</label>
        <select class="form-control" name="pacoteId" id="selPacote" onchange="onChangePacote(this)">
          ${pacOpts}
        </select></div>
      <div class="form-group"><label class="form-label">Tipo de passageiro</label>
        <select class="form-control" name="tipoPassageiroId" id="selTipo">
          ${tipoOpts}
        </select></div>
      <div class="form-group"><label class="form-label">Assento</label>
        <select class="form-control" name="assento">${assentoOpts}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Ponto de embarque</label>
        <input class="form-control" name="pontoEmbarque" value="${Utils.escHtml(v.pontoEmbarque||'')}"
          list="listaPontosEmbarque" autocomplete="off" placeholder="Ponto de saída"/>
        <datalist id="listaPontosEmbarque">
          ${(exc.pontosEmbarque||'').split(',').map(p=>p.trim()).filter(Boolean).map(p=>`<option value="${Utils.escHtml(p)}">`).join('')}
        </datalist>
      </div>
      <div class="form-group"><label class="form-label">Código da reserva</label>
        <input class="form-control" name="codigoReserva" id="inputCodReserva"
          value="${Utils.escHtml(v.codigoReserva||'')}"
          placeholder="Vazio = gerar automaticamente"
          list="listaReservas"
          onchange="onChangeCodReserva(this,'${exc.id}')"/>
        <datalist id="listaReservas">
          ${excReservas.map(r=>`<option value="${Utils.escHtml(r.codigo)}">${Utils.escHtml(r.codigo)} — ${Utils.escHtml(r.titular)}</option>`).join('')}
        </datalist>
      </div>
      <div class="form-group"><label class="form-label">Titular da reserva</label>
        <input class="form-control" name="titularReserva" id="inputTitularReserva"
          value="${Utils.escHtml(v.titularReserva||v.nome||'')}" placeholder="Nome do titular"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Vendedor</label>
        <select class="form-control" name="vendedorId">${vendedorOpts}</select></div>
    </div>
  </div>

  <!-- SEÇÃO 3: VALORES -->
  <div class="form-section section-money">
    <div class="form-section-header">
      <div class="form-section-icon"><svg viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg></div>
      <div>
        <div class="form-section-label">Valores</div>
        <div class="form-section-sub">Preço, desconto e taxa</div>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Valor do pacote (R$)</label>
        <input class="form-control" type="number" name="valorBase" id="inputValorBase"
          value="${v.valorBase||v.valorCombinado||exc?.valorPassageiro||''}" min="0" step="0.01"
          oninput="recalcValorFinal()"/></div>
      <div class="form-group"><label class="form-label">Desconto (R$)</label>
        <input class="form-control" type="number" name="desconto" id="inputDesconto"
          value="${v.desconto||0}" min="0" step="0.01" oninput="recalcValorFinal()"/></div>
      <div class="form-group">
        <label class="form-label" style="display:flex;justify-content:space-between;align-items:center">
          Taxa de cartão
          <span style="display:flex;gap:4px;font-weight:400">
            <button type="button" id="btnTaxaRS" onclick="setTipoTaxa('R$')"
              class="btn btn-sm ${(!v.tipoTaxa||v.tipoTaxa==='R$')?'btn-primary':'btn-outline'}"
              style="padding:2px 8px;font-size:11px">R$</button>
            <button type="button" id="btnTaxaPCT" onclick="setTipoTaxa('%')"
              class="btn btn-sm ${v.tipoTaxa==='%'?'btn-primary':'btn-outline'}"
              style="padding:2px 8px;font-size:11px">%</button>
          </span>
        </label>
        <input type="hidden" name="tipoTaxa" id="inputTipoTaxa" value="${v.tipoTaxa||'R$'}"/>
        <input class="form-control" type="number" name="taxaCartaoRaw" id="inputTaxaCartaoRaw"
          value="${v.taxaCartaoRaw||v.taxaCartao||0}" min="0" step="0.01"
          placeholder="${v.tipoTaxa==='%'?'ex: 5.5':'ex: 55.00'}"
          oninput="recalcValorFinal()"/>
        <div class="form-hint" id="taxaHint">${v.tipoTaxa==='%'&&v.valorBase?'= R$ '+((parseFloat(v.valorBase||v.valorCombinado||0)*(parseFloat(v.taxaCartaoRaw||0)/100)).toFixed(2)):''}</div>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Valor final *</label>
      <input class="form-control valor-final-destaque" type="number" name="valorFinal" id="inputValorFinal"
        value="${v.valorFinal != null ? v.valorFinal : (v.valorCombinado || '')}" min="0" step="0.01" required
        style="font-size:18px;font-weight:700;color:var(--blue);text-align:center"/>
    </div>
  </div>

  <!-- SEÇÃO 4: PARCELAMENTO -->
  <div class="form-section section-parcela">
    <div class="form-section-header">
      <div class="form-section-icon"><svg viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg></div>
      <div>
        <div class="form-section-label">Parcelamento</div>
        <div class="form-section-sub">Entrada e parcelas mensais</div>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Entrada (R$)</label>
        <input class="form-control" type="number" name="entrada" id="inputEntrada"
          value="${v.entrada||''}" min="0" step="0.01" placeholder="0,00"
          oninput="recalcParcelas()"/></div>
      <div class="form-group"><label class="form-label">Nº de parcelas</label>
        <input class="form-control" type="number" name="numParcelas" id="inputNumParcelas"
          value="${v.numParcelas||1}" min="1" max="24"
          oninput="recalcParcelas()"/></div>
      <div class="form-group"><label class="form-label">Dia de vencimento</label>
        <input class="form-control" type="number" name="diaVencimento" id="inputDiaVencimento"
          value="${diaVencimentoAtual||''}" min="1" max="31" placeholder="Ex: 10"
          oninput="recalcParcelas()"/>
        <div class="form-hint">Dia do mês: 1 a 31</div></div>
    </div>
    <div id="previewParcelas" style="margin-top:2px"></div>
  </div>

  <!-- SEÇÃO 5: STATUS E OBSERVAÇÕES -->
  <div class="form-section">
    <div class="form-section-header">
      <div class="form-section-icon"><svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg></div>
      <div>
        <div class="form-section-label">Status e observações</div>
        <div class="form-section-sub">Situação e forma de pagamento</div>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Status</label>
        <select class="form-control" name="status">
          ${STATUS_PASSAGEIRO.map(s=>`<option value="${s}" ${v.status===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
        </select></div>
      <div class="form-group"><label class="form-label">Forma preferida</label>
        <select class="form-control" name="formaPreferida">
          ${FORMAS_PAGAMENTO.map(f=>`<option value="${f}" ${v.formaPreferida===f?'selected':''}>${f}</option>`).join('')}
        </select></div>
    </div>
    <div class="form-group"><label class="form-label">Observações</label>
      <textarea class="form-control" name="observacoes" rows="2">${Utils.escHtml(v.observacoes||'')}</textarea></div>
  </div>

  <button type="submit" class="btn btn-primary w-full" style="padding:14px;font-size:15px">${id?'Salvar alterações':'Adicionar Passageiro'}</button>
  </form>`, 'modal-lg');
  setTimeout(recalcParcelas, 0);
}
    
function onChangePacote(sel) {
  const opt = sel.options[sel.selectedIndex];
  const val = opt.dataset.valor;
  const tipoId = opt.dataset.tipo;
  if (val) {
    document.getElementById('inputValorBase').value = parseFloat(val).toFixed(2);
    recalcValorFinal();
  }
  if (tipoId) {
    const selTipo = document.getElementById('selTipo');
    if (selTipo) {
      for (const o of selTipo.options) { if (o.value===tipoId) { o.selected=true; break; } }
    }
  }
}

function setTipoTaxa(tipo) {
  const inp = document.getElementById('inputTipoTaxa');
  if (inp) inp.value = tipo;
  document.getElementById('btnTaxaRS') ?.classList.toggle('btn-primary', tipo==='R$');
  document.getElementById('btnTaxaRS') ?.classList.toggle('btn-outline',  tipo!=='R$');
  document.getElementById('btnTaxaPCT')?.classList.toggle('btn-primary', tipo==='%');
  document.getElementById('btnTaxaPCT')?.classList.toggle('btn-outline',  tipo!=='%');
  const ph = document.getElementById('inputTaxaCartaoRaw');
  if (ph) ph.placeholder = tipo==='%' ? 'ex: 5.5' : 'ex: 55.00';
  recalcValorFinal();
}

function _calcTaxaValor() {
  const tipo = document.getElementById('inputTipoTaxa')?.value || 'R$';
  const raw  = parseFloat(document.getElementById('inputTaxaCartaoRaw')?.value) || 0;
  const base = parseFloat(document.getElementById('inputValorBase')?.value) || 0;
  if (tipo === '%') {
    const val = base * (raw / 100);
    const hint = document.getElementById('taxaHint');
    if (hint) hint.textContent = raw > 0 ? '= R$ ' + val.toFixed(2) : '';
    return val;
  }
  const hint = document.getElementById('taxaHint');
  if (hint) hint.textContent = '';
  return raw;
}

function recalcValorFinal() {
  const base  = parseFloat(document.getElementById('inputValorBase')?.value)||0;
  const desc  = parseFloat(document.getElementById('inputDesconto')?.value)||0;
  const taxa  = _calcTaxaValor();
  const final = base - desc + taxa;
  const inpF  = document.getElementById('inputValorFinal');
  if (inpF) inpF.value = Math.max(0, final).toFixed(2);
  recalcParcelas();
}

function recalcParcelas() {
  const final    = parseFloat(document.getElementById('inputValorFinal')?.value)||0;
  const entrada  = parseFloat(document.getElementById('inputEntrada')?.value)||0;
  const nParcelas= parseInt(document.getElementById('inputNumParcelas')?.value)||1;
  const diaVenc  = parseInt(document.getElementById('inputDiaVencimento')?.value)||null;
  const preview  = document.getElementById('previewParcelas');
  if (!preview) return;
  if (nParcelas <= 0 && entrada === 0) { preview.innerHTML = ''; return; }
  const restante   = Math.max(0, final - entrada);
  const valorParc  = nParcelas > 0 ? restante / nParcelas : 0;
  let rows = '';
  if (entrada > 0) {
    rows += `<div class="parcela-row"><span>Entrada</span><span class="fw-600 text-green">${Utils.formatCurrency(entrada)}</span><span>hoje</span></div>`;
  }
  for (let i = 0; i < nParcelas; i++) {
    const ds = calcularVencimentoParcela(diaVenc, i);
    rows += `<div class="parcela-row"><span>${i+1}ª parcela</span><span class="fw-600">${Utils.formatCurrency(valorParc)}</span><span>${diaVenc ? Utils.formatDate(ds) : 'defina o dia'}</span></div>`;
  }
  preview.innerHTML = `<div class="parcelas-preview"><div class="parcelas-title">Simulação de parcelas — Total: ${Utils.formatCurrency(final)}</div>${rows}</div>`;
}

function calcularVencimentoParcela(diaVencimento, offsetMes = 0) {
  const dia = Math.min(31, Math.max(1, parseInt(diaVencimento) || 1));
  const base = new Date(Utils.today() + 'T12:00:00');
  let ano = base.getFullYear();
  let mes = base.getMonth();

  if (base.getDate() > dia) mes += 1;
  mes += offsetMes;

  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const d = new Date(ano, mes, Math.min(dia, ultimoDia), 12, 0, 0);
  return d.toISOString().slice(0, 10);
}

async function salvarPassageiro(e, excId, id) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  data.excursaoId     = excId;
  data.valorCombinado = data.valorFinal; // compatibilidade
  // Salvar taxa como valor R$ efetivo (para cálculos financeiros)
  const taxaRaw = parseFloat(data.taxaCartaoRaw) || 0;
  data.taxaCartao = data.tipoTaxa === '%'
    ? (parseFloat(data.valorBase)||0) * (taxaRaw/100)
    : taxaRaw;
  // Gerar parcelas automáticas se configurado
  const entrada   = parseFloat(data.entrada)||0;
  const nParcelas = parseInt(data.numParcelas)||0;
  const diaVenc   = parseInt(data.diaVencimento)||0;
  data._criarParcelas = Boolean((nParcelas >= 1 && diaVenc) || entrada > 0);
  if (diaVenc) data.diaVencimento = String(Math.min(31, Math.max(1, diaVenc)));
  if (id) data.id = id;
  // Gerar código de reserva automático se não informado
  if (!data.codigoReserva) {
    const res = await DB.save('reservas', {
      excursaoId: excId, codigo: `RES-${Date.now().toString().slice(-5)}`,
      titular: data.titularReserva||data.nome, telefoneTitular: data.telefone||'', observacoes: '',
    });
    data.codigoReserva  = res.codigo;
    data.reservaId      = res.id;
  }
  const saved = await DB.save('passageiros', data);
  if (data._criarParcelas) {
    await gerarParcelasPassageiro(saved, entrada, nParcelas, diaVenc);
  }
  DB.marcarAlteracao();
  closeModal();
  Utils.showToast(id?'Passageiro atualizado!':'Passageiro adicionado!');
  navigate('excursao', { excursaoId: excId, tab: 'passageiros' });
}

async function gerarParcelasPassageiro(pass, entrada, nParcelas, diaVencimento) {
  const todosPags = await DB.getAll('pagamentos');
  const antigas = todosPags.filter(pg =>
    pg.passageiroId === pass.id &&
    pg.origem === 'parcelamento' &&
    pg.status !== 'pago'
  );
  for (const pg of antigas) await DB.remove('pagamentos', pg.id);

  const total = parseFloat(pass.valorFinal ?? pass.valorCombinado) || 0;

  // Descontar tudo que já foi pago (entrada antiga + parcelas já quitadas)
  // para não duplicar valores ao editar o passageiro depois de receber pagamentos.
  const jaPago = todosPags
    .filter(pg => pg.passageiroId === pass.id && pg.status === 'pago')
    .reduce((s, pg) => s + (parseFloat(pg.valor) || 0), 0);

  // Entrada nova: só lança se ainda não houver entrada paga registrada
  const entradaJaPaga = todosPags.some(pg =>
    pg.passageiroId === pass.id && pg.origem === 'entrada' && pg.status === 'pago');

  const restante = Math.max(0, total - jaPago - (entradaJaPaga ? 0 : entrada));
  const qtd = Math.max(0, parseInt(nParcelas) || 0);
  const valorParcela = qtd > 0 ? restante / qtd : 0;

  if (entrada > 0 && !entradaJaPaga) {
    await DB.save('pagamentos', {
      passageiroId: pass.id,
      excursaoId: pass.excursaoId,
      data: Utils.today(),
      valor: entrada.toFixed(2),
      forma: pass.formaPreferida || 'Pix',
      status: 'pago',
      observacao: 'Entrada',
      parcela: 'Entrada',
      origem: 'entrada',
    });
  }

  if (!diaVencimento || qtd <= 0 || valorParcela <= 0) return;
  for (let i = 0; i < qtd; i++) {
    await DB.save('pagamentos', {
      passageiroId: pass.id,
      excursaoId: pass.excursaoId,
      data: Utils.today(),
      vencimento: calcularVencimentoParcela(diaVencimento, i),
      valor: valorParcela.toFixed(2),
      forma: pass.formaPreferida || 'Pix',
      status: 'pendente',
      observacao: `${i + 1}ª parcela`,
      parcela: `${i + 1}/${qtd}`,
      origem: 'parcelamento',
      diaVencimento: String(diaVencimento),
    });
  }
}

async function excluirPassageiro(id) {
  const p = await DB.getById('passageiros', id);
  if (!confirm(`Excluir ${p?.nome}?`)) return;
  await DB.remove('passageiros', id);
  const pags = await DB.getAll('pagamentos');
  for (const pg of pags.filter(pg=>pg.passageiroId===id)) await DB.remove('pagamentos', pg.id);
  Utils.showToast('Passageiro excluído');
  navigate('excursao', { excursaoId: p.excursaoId, tab: 'passageiros' });
}

// ── TAB: ASSENTOS (respeitando ocupaVaga) ────────────────────────────
function renderTabAssentos(exc, passageiros, tipos) {
  const total   = parseInt(exc.vagas)||40;
  const rows    = Utils.genSeatRows(total);
  const passMap = {};
  passageiros.forEach(p => { if(p.assento) passMap[String(p.assento)] = p; });

  const renderSeat = (num) => {
    if (!num) return `<div></div>`;
    const p    = passMap[String(num)];
    const tipo = p ? Utils.getTipo(p.tipoPassageiroId, tipos) : null;
    let cls = 'free', sub = 'Livre';
    if (p) {
      if      (p.status==='cancelado')  { cls='cancelled'; sub='Cancelado'; }
      else if (p.status==='confirmado') { cls='confirmed';  sub=p.nome.split(' ')[0]; }
      else                              { cls='reserved';   sub=p.nome.split(' ')[0]; }
    }
    const subLabel = sub.length>7 ? sub.slice(0,6)+'…' : sub;
    return `<div class="seat ${cls}" onclick="clicarAssento(${num},'${exc.id}')" title="${p?Utils.escHtml(p.nome)+' ('+Utils.escHtml(tipo?.nome||'')+')'  :'Livre'}">
      <span style="font-size:10px;opacity:.7">${num}</span>
      <span style="font-size:10px;font-weight:600">${subLabel}</span>
    </div>`;
  };

  const seatHtml = rows.map(row=>`
    <div class="seat-row">
      ${renderSeat(row[0])}${renderSeat(row[1])}
      <div style="display:flex;align-items:center;justify-content:center;color:#ccc;font-size:11px">│</div>
      ${renderSeat(row[3])}${renderSeat(row[4])}
    </div>`).join('');

  // Contagem respeitando tipos
  const ativos   = passageiros.filter(p=>p.status!=='cancelado');
  const ocupantes= ativos.filter(p => Utils.getTipo(p.tipoPassageiroId, tipos).ocupaVaga);
  const conf     = ocupantes.filter(p=>p.status==='confirmado').length;
  const reserv   = ocupantes.filter(p=>p.status!=='confirmado').length;
  const naOcupam = ativos.length - ocupantes.length;
  const livres   = total - ocupantes.length;

  return `
  <div style="display:grid;grid-template-columns:1fr 280px;gap:24px;align-items:start">
    <div>
      <div class="section-title">Mapa de Assentos</div>
      <div class="seat-map-wrap">
        <div style="background:#e5e7eb;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:#555;margin-bottom:14px">🚌 Frente do ônibus</div>
        <div class="seat-bus">${seatHtml}</div>
        <div class="seat-legend">
          <div class="legend-item"><div class="legend-dot" style="background:#fff;border-color:#E4E7EC"></div>Livre</div>
          <div class="legend-item"><div class="legend-dot" style="background:#FEF9C3;border-color:#FDE047"></div>Reservado</div>
          <div class="legend-item"><div class="legend-dot" style="background:#DCFCE7;border-color:#86EFAC"></div>Confirmado</div>
          <div class="legend-item"><div class="legend-dot" style="background:#FEE2E2;border-color:#FCA5A5"></div>Cancelado</div>
        </div>
      </div>
    </div>
    <div>
      <div class="section-title">Resumo</div>
      <div class="card"><div class="card-body">
        <div class="exc-card-row"><span>Total de vagas</span><span>${total}</span></div>
        <div class="exc-card-row"><span>Ocupantes (c/ vaga)</span><span class="text-blue fw-600">${ocupantes.length}</span></div>
        <div class="exc-card-row"><span>Confirmados</span><span class="text-green">${conf}</span></div>
        <div class="exc-card-row"><span>Reservados</span><span class="text-orange">${reserv}</span></div>
        <div class="exc-card-row"><span>Vagas livres</span><span>${livres}</span></div>
        ${naOcupam>0?`<div class="exc-card-row"><span>Não ocupam vaga</span><span class="text-gray">${naOcupam}</span></div>`:''}
      </div></div>
      ${naOcupam>0?`<div class="backup-info-card" style="margin-top:12px;font-size:13px">
        <b>ℹ️ ${naOcupam}</b> passageiro(s) não ocupam vaga (bebê de colo, motorista etc.) e não aparecem no mapa.
      </div>`:''}
    </div>
  </div>`;
}

async function clicarAssento(num, excId) {
  const passageiros = (await DB.getAll('passageiros')).filter(p=>p.excursaoId===excId);
  const tipos       = await DB.getAll('tiposPassageiro');
  const atual       = passageiros.find(p=>p.assento===String(num));
  // Só mostra quem pode ter assento (ocupaVaga=true) e não tem assento
  const semAssento  = passageiros.filter(p=>!p.assento && p.status!=='cancelado' && Utils.getTipo(p.tipoPassageiroId, tipos).ocupaVaga);

  if (atual) {
    openModal(`Assento ${num}`, `
      <p><b>${Utils.escHtml(atual.nome)}</b> — ${atual.status}</p>
      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
        <button class="btn btn-outline btn-sm" onclick="liberarAssento('${atual.id}','${excId}',${num});closeModal()">Liberar assento</button>
        <button class="btn btn-primary btn-sm" onclick="closeModal();openModalPassageiro('${excId}','${atual.id}')">Editar</button>
      </div>`);
  } else {
    const opts = semAssento.map(p=>`<option value="${p.id}">${Utils.escHtml(p.nome)}</option>`).join('');
    openModal(`Assento ${num} — Livre`, `
      <p class="text-gray mb-16">Vincule um passageiro a este assento.</p>
      ${opts
        ?`<div class="form-group"><label class="form-label">Passageiro</label>
            <select class="form-control" id="selPassAssento"><option value="">— Selecionar —</option>${opts}</select>
          </div>
          <button class="btn btn-primary w-full" onclick="vincularAssento('${excId}',${num})">Vincular</button>`
        :`<p class="text-gray">Nenhum passageiro sem assento disponível.</p>`}`);
  }
}

async function liberarAssento(passId, excId, num) {
  const p = await DB.getById('passageiros', passId);
  if (p) { p.assento=''; await DB.save('passageiros', p); }
  navigate('excursao', { excursaoId: excId, tab: 'assentos' });
  Utils.showToast(`Assento ${num} liberado`);
}

async function vincularAssento(excId, num) {
  const passId = document.getElementById('selPassAssento')?.value;
  if (!passId) { Utils.showToast('Selecione um passageiro','warn'); return; }
  const p = await DB.getById('passageiros', passId);
  if (p) { p.assento=String(num); await DB.save('passageiros', p); }
  closeModal();
  navigate('excursao', { excursaoId: excId, tab: 'assentos' });
  Utils.showToast(`Assento ${num} vinculado`);
}

// ── TAB: PAGAMENTOS ───────────────────────────────────────────────────
function renderTabPagamentos(exc, passageiros, pagamentos) {
  const sorted = [...pagamentos].sort((a,b)=>(b.data||'').localeCompare(a.data||''));
  const rows = sorted.map(pag => {
    const pass = passageiros.find(p=>p.id===pag.passageiroId);
    return `<tr>
      <td>${Utils.formatDate(pag.data)}</td>
      <td><b>${Utils.escHtml(pass?.nome||'—')}</b></td>
      <td class="text-green fw-600 sv-currency">${Utils.formatCurrency(pag.valor)}</td>
      <td>${Utils.escHtml(pag.forma||'—')}</td>
      <td>${Utils.statusBadge(pag.status)}</td>
      <td>${Utils.escHtml(pag.observacao||'')}</td>
      <td><button class="btn btn-sm" style="background:#FEE2E2;color:#B91C1C" onclick="excluirPagamento('${pag.id}','${exc.id}')">✕</button></td>
    </tr>`;
  }).join('');
  const total = pagamentos.filter(p=>p.status==='pago').reduce((s,p)=>s+(parseFloat(p.valor)||0),0);
  return `
  <div class="flex-between mb-16 flex-wrap gap-8">
    <div class="stat-card" style="padding:12px 18px">
      <div class="stat-label">Total Recebido</div>
      <div class="stat-value green sv-currency">${Utils.formatCurrency(total)}</div>
    </div>
    <button class="btn btn-primary" onclick="openModalNovoPagamento('${exc.id}')">+ Novo Pagamento</button>
  </div>
  ${!pagamentos.length
    ?`<div class="empty-state"><h3>Nenhum pagamento</h3></div>`
    :`<div class="table-wrapper"><table>
        <thead><tr><th>Data</th><th>Passageiro</th><th>Valor</th><th>Forma</th><th>Status</th><th>Obs</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`
  }`;
}

// ── TAB: CONTAS (com fornecedor e tipo de custo) ──────────────────────
function renderTabContas(exc, contas, tipos, passageiros, pacotes, fornecedores) {
  const sorted = [...contas].sort((a,b)=>(a.vencimento||'').localeCompare(b.vencimento||''));
  const rows = sorted.map(c => {
    const valorCalc = Utils.calcularValorConta(c, passageiros.filter(p=>p.status!=='cancelado'), tipos);
    const forn      = fornecedores.find(f=>f.id===c.fornecedorId);
    const waForn    = forn?.whatsapp ? Utils.waLink(forn.whatsapp) : null;
    return `<tr>
      <td>
        <b>${Utils.escHtml(c.nome)}</b>
        ${forn?`<br><span class="text-gray" style="font-size:11px">${Utils.escHtml(forn.nome)}</span>${waForn?`<a href="${waForn}" target="_blank" class="wa-btn" style="font-size:11px"> WA</a>`:''}`:''}
      </td>
      <td><span class="badge badge-gray">${Utils.escHtml(c.categoria||'')}</span></td>
      <td class="fw-600 sv-currency">${Utils.formatCurrency(valorCalc)}</td>
      <td>${Utils.formatDate(c.vencimento)}</td>
      <td>${Utils.statusBadge(c.status)}</td>
      <td class="td-actions">
        <button class="btn btn-outline btn-sm" onclick="openModalConta('${exc.id}','${c.id}')">✎</button>
        <button class="btn btn-sm" style="background:#FEE2E2;color:#B91C1C" onclick="excluirConta('${c.id}','${exc.id}')">✕</button>
      </td>
    </tr>`;
  });

  const total   = contas.reduce((s,c)=>s+Utils.calcularValorConta(c,passageiros.filter(p=>p.status!=='cancelado'),tipos), 0);
  const pago    = contas.filter(c=>c.status==='pago').reduce((s,c)=>s+Utils.calcularValorConta(c,passageiros,tipos), 0);
  const pendente= total - pago;
  const vencido = contas.filter(c=>c.status==='vencido').reduce((s,c)=>s+Utils.calcularValorConta(c,passageiros,tipos), 0);

  return `
  <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
    <div class="stat-card"><div class="stat-label">Total</div><div class="stat-value sv-currency" style="font-size:18px">${Utils.formatCurrency(total)}</div></div>
    <div class="stat-card"><div class="stat-label">Pago</div><div class="stat-value green sv-currency" style="font-size:18px">${Utils.formatCurrency(pago)}</div></div>
    <div class="stat-card"><div class="stat-label">Pendente</div><div class="stat-value orange sv-currency" style="font-size:18px">${Utils.formatCurrency(pendente)}</div></div>
    <div class="stat-card"><div class="stat-label">Vencido</div><div class="stat-value red sv-currency" style="font-size:18px">${Utils.formatCurrency(vencido)}</div></div>
  </div>
  <div class="flex-between mb-16">
    <span class="section-title">Contas a Pagar</span>
    <button class="btn btn-primary" onclick="openModalConta('${exc.id}')">+ Nova Conta</button>
  </div>
  ${!contas.length
    ?`<div class="empty-state"><h3>Nenhuma conta</h3></div>`
    :`<div class="table-wrapper"><table>
        <thead><tr><th>Nome / Fornecedor</th><th>Categoria</th><th>Valor</th><th>Vencimento</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table></div>`
  }`;
}

async function openModalConta(excId, id=null) {
  const [c, tipos, pacotes, fornecedores] = await Promise.all([
    id?DB.getById('contas',id):null,
    DB.getAll('tiposPassageiro'), DB.getAll('pacotes'), DB.getAll('fornecedores')
  ]);
  const v = c || {};
  const pacExc = pacotes.filter(p=>p.excursaoId===excId&&p.ativo!==false);
  const fornAtivos = fornecedores.filter(f=>f.ativo!==false);
  const tipoCustoSel = v.tipoCusto||'manual';

  openModal(id?'Editar Conta':'Nova Conta a Pagar', `
  <form id="formConta" onsubmit="salvarConta(event,'${excId}','${id||''}')">
    <div class="form-row">
      <div class="form-group" style="grid-column:1/-1"><label class="form-label">Nome da conta *</label>
        <input class="form-control" name="nome" value="${Utils.escHtml(v.nome||'')}" required/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Categoria</label>
        <select class="form-control" name="categoria">
          ${CATEGORIAS_CONTA.map(cat=>`<option value="${cat}" ${v.categoria===cat?'selected':''}>${cat}</option>`).join('')}
        </select></div>
      <div class="form-group"><label class="form-label">Fornecedor</label>
        <select class="form-control" name="fornecedorId">
          <option value="">— Sem fornecedor —</option>
          ${fornAtivos.map(f=>`<option value="${f.id}" ${v.fornecedorId===f.id?'selected':''}>${Utils.escHtml(f.nome)}</option>`).join('')}
        </select></div>
    </div>
    <div class="form-row">
      <div class="form-group" style="grid-column:1/-1"><label class="form-label">Tipo de custo</label>
        <select class="form-control" name="tipoCusto" id="selTipoCusto" onchange="onChangeTipoCusto(this)">
          ${TIPOS_CUSTO.map(t=>`<option value="${t.value}" ${tipoCustoSel===t.value?'selected':''}>${t.label}</option>`).join('')}
        </select></div>
    </div>
    <div class="form-row">
      <div class="form-group" id="grpValorUnit" style="${['por_pagante','por_ocupante','por_tipo','por_pacote'].includes(tipoCustoSel)?'':'display:none'}">
        <label class="form-label">Valor unitário (R$)</label>
        <input class="form-control" type="number" name="valorUnitario" value="${v.valorUnitario||''}" min="0" step="0.01"/>
      </div>
      <div class="form-group"><label class="form-label">Valor total (R$) *</label>
        <input class="form-control" type="number" name="valor" value="${v.valor||''}" min="0" step="0.01" required/></div>
      <div class="form-group"><label class="form-label">Vencimento</label>
        <input class="form-control" type="date" name="vencimento" value="${v.vencimento||''}"/></div>
    </div>
    <div id="grpTipoPass" style="${tipoCustoSel==='por_tipo'?'':'display:none'}">
      <div class="form-group"><label class="form-label">Tipo de passageiro específico</label>
        <select class="form-control" name="tipoPassageiroId">
          <option value="">— Selecionar tipo —</option>
          ${tipos.filter(t=>t.ativo!==false).map(t=>`<option value="${t.id}" ${v.tipoPassageiroId===t.id?'selected':''}>${Utils.escHtml(t.nome)}</option>`).join('')}
        </select></div>
    </div>
    <div id="grpPacote" style="${tipoCustoSel==='por_pacote'?'':'display:none'}">
      <div class="form-group"><label class="form-label">Pacote específico</label>
        <select class="form-control" name="pacoteId">
          <option value="">— Selecionar pacote —</option>
          ${pacExc.map(p=>`<option value="${p.id}" ${v.pacoteId===p.id?'selected':''}>${Utils.escHtml(p.nome)}</option>`).join('')}
        </select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Status</label>
        <select class="form-control" name="status">
          ${STATUS_CONTA.map(s=>`<option value="${s}" ${v.status===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
        </select></div>
    </div>
    <div class="form-group"><label class="form-label">Observação</label>
      <textarea class="form-control" name="observacao" rows="2">${Utils.escHtml(v.observacao||'')}</textarea></div>
    <button type="submit" class="btn btn-primary w-full">${id?'Salvar':'Adicionar Conta'}</button>
  </form>`);
}

function onChangeTipoCusto(sel) {
  const v = sel.value;
  const autoTypes = ['por_pagante','por_ocupante','por_tipo','por_pacote'];
  document.getElementById('grpValorUnit').style.display  = autoTypes.includes(v) ? '' : 'none';
  document.getElementById('grpTipoPass').style.display   = v==='por_tipo'   ? '' : 'none';
  document.getElementById('grpPacote').style.display     = v==='por_pacote' ? '' : 'none';
}

async function salvarConta(e, excId, id) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  data.excursaoId = excId;
  if (id) data.id = id;
  await DB.save('contas', data);
  closeModal();
  Utils.showToast(id?'Conta atualizada!':'Conta adicionada!');
  navigate('excursao', { excursaoId: excId, tab: 'contas' });
}

async function excluirConta(id, excId) {
  if (!confirm('Excluir conta?')) return;
  await DB.remove('contas', id);
  Utils.showToast('Conta excluída');
  navigate('excursao', { excursaoId: excId, tab: 'contas' });
}

// ── TAB: FINANCEIRO ───────────────────────────────────────────────────
function renderTabFinanceiro(exc, fin, contas, passageiros, pagamentos, tipos) {
  const pct      = fin.custoTotal>0 ? Math.min(100,(fin.receitaRecebida/fin.custoTotal)*100) : 100;
  const barClass = pct<50?'red':pct<100?'orange':'';
  let msg='', msgClass='';
  if (fin.receitaRecebida>=fin.custoTotal && fin.custoTotal>0) {
    msg=`✓ Excursão paga! Lucro real atual: <b>${Utils.formatCurrency(fin.lucroReal)}</b>`; msgClass='success';
  } else if (fin.custoTotal>0) {
    msg=`Ainda faltam <b>${Utils.formatCurrency(fin.faltaParaPagar)}</b> para cobrir todos os custos.`;
    msgClass=fin.faltaParaPagar>fin.receitaPrevista*0.5?'danger':'warn';
  } else { msg='Nenhum custo cadastrado ainda.'; msgClass='warn'; }

  const devedores = passageiros.filter(p => {
    const pf = Utils.calcPassageiroFinanceiro(p, pagamentos);
    return pf.saldo>0 && p.status!=='cancelado';
  });

  const devedoresRows = devedores.map(p => {
    const pf     = Utils.calcPassageiroFinanceiro(p, pagamentos);
    const waLink = p.telefone ? Utils.waMsgCobranca(p.telefone, p.nome, pf.saldo, exc.nome) : null;
    return `<tr>
      <td>${Utils.escHtml(p.nome)} ${waLink?`<a href="${waLink}" target="_blank" class="wa-btn" title="Cobrar">
        <svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.559 4.14 1.535 5.875L.057 23.899l6.224-1.635A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.002-1.373l-.36-.213-3.692.97.985-3.601-.233-.369A9.818 9.818 0 1112 21.818z"/></svg>
      </a>`:''}
      </td>
      <td>${Utils.formatCurrency(pf.valorTotal)}</td>
      <td class="text-green">${Utils.formatCurrency(pf.totalPago)}</td>
      <td class="text-orange fw-600">${Utils.formatCurrency(pf.saldo)}</td>
    </tr>`;
  }).join('');

  return `
  <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
    <div class="stat-card"><div class="stat-label">Receita Prevista</div><div class="stat-value blue sv-currency">${Utils.formatCurrency(fin.receitaPrevista)}</div></div>
    <div class="stat-card"><div class="stat-label">Receita Recebida</div><div class="stat-value green sv-currency">${Utils.formatCurrency(fin.receitaRecebida)}</div></div>
    <div class="stat-card"><div class="stat-label">A Receber</div><div class="stat-value orange sv-currency">${Utils.formatCurrency(fin.receitaPendente)}</div></div>
    <div class="stat-card"><div class="stat-label">Custos Totais</div><div class="stat-value red sv-currency">${Utils.formatCurrency(fin.custoTotal)}</div></div>
    <div class="stat-card"><div class="stat-label">Custos Pagos</div><div class="stat-value sv-currency">${Utils.formatCurrency(fin.custosPagos)}</div></div>
    <div class="stat-card"><div class="stat-label">Lucro Previsto</div><div class="stat-value ${fin.lucroPrevisto>=0?'green':'red'} sv-currency">${Utils.formatCurrency(fin.lucroPrevisto)}</div></div>
  </div>

  <div class="fin-summary mt-24">
    <div class="flex-between"><span class="fw-600">Progresso — receita vs custos</span><span class="${pct>=100?'text-green':'text-orange'} fw-600">${pct.toFixed(0)}%</span></div>
    <div class="fin-bar-wrap"><div class="fin-bar-track"><div class="fin-bar-fill ${barClass}" style="width:${pct}%"></div></div></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#667085">
      <span>Recebido: ${Utils.formatCurrency(fin.receitaRecebida)}</span>
      <span>Custos: ${Utils.formatCurrency(fin.custoTotal)}</span>
    </div>
    <div class="fin-msg ${msgClass}">${msg}</div>
  </div>

  <div class="stats-grid mt-24" style="grid-template-columns:repeat(4,1fr)">
    <div class="stat-card"><div class="stat-label">Pagantes</div><div class="stat-value">${fin.qtdPagantes}</div></div>
    <div class="stat-card"><div class="stat-label">Não pagantes</div><div class="stat-value gray">${fin.qtdNaoPagantes}</div></div>
    <div class="stat-card"><div class="stat-label">Ticket médio</div><div class="stat-value sv-currency">${Utils.formatCurrency(fin.ticketMedio)}</div></div>
    <div class="stat-card"><div class="stat-label">Equilíbrio</div><div class="stat-value">${fin.passNecessarios} pax</div></div>
  </div>

  ${fin.descontoTotal>0||fin.taxaCartaoTotal>0?`
  <div class="card mt-24"><div class="card-body">
    <div class="section-title mb-8">Ajustes de valores</div>
    <div class="exc-card-row"><span>Total de descontos concedidos</span><span class="text-orange">${Utils.formatCurrency(fin.descontoTotal)}</span></div>
    <div class="exc-card-row"><span>Total de taxas de cartão</span><span>${Utils.formatCurrency(fin.taxaCartaoTotal)}</span></div>
  </div></div>`:''}

  ${devedores.length>0?`
  <div class="mt-24">
    <div class="section-title">Passageiros com saldo em aberto (${devedores.length})</div>
    <div class="table-wrapper mt-8"><table>
      <thead><tr><th>Nome</th><th>Valor</th><th>Pago</th><th>Deve</th></tr></thead>
      <tbody>${devedoresRows}</tbody>
    </table></div>
  </div>`:''}`;
}

// ── TAB: EMBARQUE ─────────────────────────────────────────────────────
function renderTabEmbarque(exc, passageiros, pagamentos, tipos) {
  // Apenas quem deve entrar na lista de embarque
  const ativos = passageiros
    .filter(p => p.status!=='cancelado' && Utils.getTipo(p.tipoPassageiroId, tipos).entraNaListaEmbarque)
    .sort((a,b) => (parseInt(a.assento)||999)-(parseInt(b.assento)||999));

  const rows = ativos.map(p => {
    const fin  = Utils.calcPassageiroFinanceiro(p, pagamentos);
    const tipo = tipos.find(t=>t.id===p.tipoPassageiroId);
    return `<tr>
      <td>${Utils.escHtml(p.nome)}</td>
      <td>${Utils.escHtml(p.telefone||'')}</td>
      <td>${Utils.escHtml(p.documento||'')}</td>
      <td>${Utils.escHtml(p.pontoEmbarque||'')}</td>
      <td style="text-align:center">${p.assento||'—'}</td>
      <td><span class="badge badge-gray" style="font-size:11px">${Utils.escHtml(tipo?.nome||'Adulto')}</span></td>
      <td>${fin.saldo<=0?'<span class="badge badge-green">Pago</span>':'<span class="badge badge-orange">Pendente</span>'}</td>
      <td style="width:60px"><div style="border-bottom:1.5px solid #ccc;height:22px"></div></td>
    </tr>`;
  }).join('');

  return `
  <div class="flex-between mb-16 flex-wrap gap-8">
    <div>
      <h3 style="font-size:16px;font-weight:700">${Utils.escHtml(exc.nome)}</h3>
      <div class="text-gray" style="font-size:13px">${Utils.formatDate(exc.dataSaida)}${exc.horario?' · '+exc.horario:''} · ${Utils.escHtml(exc.localEmbarque||'')}</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-outline" onclick="exportEmbarqueCSV()">CSV</button>
      <button class="btn btn-primary" onclick="imprimirEmbarque()">Imprimir / PDF</button>
    </div>
  </div>
  ${!ativos.length
    ?`<div class="empty-state"><h3>Nenhum passageiro na lista de embarque</h3></div>`
    :`<div class="table-wrapper"><table id="tabelaEmbarque">
        <thead><tr><th>Nome</th><th>Telefone</th><th>Documento</th><th>Embarque</th><th>Assento</th><th>Tipo</th><th>Pgto</th><th>Presença</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`
  }`;
}

// ── TAB: RELATÓRIOS ───────────────────────────────────────────────────
function renderTabRelatorios(exc, passageiros, pagamentos, contas, fin, tipos) {
  const btns = [
    { label:'Lista de Embarque',        desc:'Lista para imprimir com campo de presença.',  fn:`imprimirEmbarque()`,     cls:'icon-blue' },
    { label:'Relatório Financeiro',     desc:'Receitas, custos, lucro e devedores.',        fn:`imprimirFinanceiro()`,   cls:'icon-green' },
    { label:'Relatório de Passageiros', desc:'Lista completa com valores, tipo e pacote.',  fn:`imprimirPassageiros()`,  cls:'icon-orange' },
    { label:'Relatório de Pagamentos',  desc:'Histórico de todos os pagamentos.',           fn:`imprimirPagamentos()`,   cls:'icon-red' },
    { label:'Relatório Completo',       desc:'Tudo em uma página.',                         fn:`imprimirCompleto()`,     cls:'icon-gray' },
    { label:'CSV — Passageiros',        desc:'Exporta passageiros para Excel.',              fn:`exportPassageirosCSV()`,cls:'icon-gold', outline:true },
    { label:'CSV — Pagamentos',         desc:'Exporta pagamentos.',                         fn:`exportPagamentosCSVTab()`,cls:'icon-gold', outline:true },
    { label:'CSV — Embarque',           desc:'Exporta lista de embarque.',                  fn:`exportEmbarqueCSV()`,   cls:'icon-gold', outline:true },
  ];
  return `<div class="relatorios-grid">${btns.map(b=>`
    <div class="relatorio-card">
      <div class="relatorio-card-icon ${b.cls}">
        <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15h8v2H8zm0-4h8v2H8zm0-4h5v2H8z"/></svg>
      </div>
      <div class="relatorio-card-title">${b.label}</div>
      <div class="relatorio-card-desc">${b.desc}</div>
      <button class="btn ${b.outline?'btn-outline':'btn-primary'} w-full" onclick="${b.fn}">${b.outline?'Baixar CSV':'Gerar e Imprimir'}</button>
    </div>`).join('')}</div>`;
}

// ── MODAIS DE PAGAMENTO ───────────────────────────────────────────────
async function openModalPagamentos(passId, excId) {
  const [pass, todosPags] = await Promise.all([DB.getById('passageiros',passId), DB.getAll('pagamentos')]);
  const pags = todosPags.filter(p=>p.passageiroId===passId);
  const fin  = Utils.calcPassageiroFinanceiro(pass, todosPags);
  const hoje = Utils.today();
  const proxParc = [...pags]
    .filter(pg=>pg.status==='pendente')
    .sort((a,b)=>(a.vencimento||a.data||'9999').localeCompare(b.vencimento||b.data||'9999'))[0];

  const rows = [...pags].sort((a,b)=>(a.data||'').localeCompare(b.data||'')).map(pg=>{
    const vencido   = pg.status==='pendente' && pg.vencimento && pg.vencimento < hoje;
    const vencClass = vencido ? 'text-red' : '';
    const vencBadge = pg.status==='pendente'
      ? (vencido ? '<span class="badge badge-red" style="font-size:10px">Vencido</span>'
                 : (pg.vencimento ? `<span class="badge badge-yellow" style="font-size:10px">Vence ${Utils.formatDate(pg.vencimento)}</span>` : ''))
      : '';
    return `<tr>
      <td>${Utils.formatDate(pg.data)}${pg.vencimento&&pg.status==='pendente'?`<br><span style="font-size:11px;color:#667085">vence ${Utils.formatDate(pg.vencimento)}</span>`:''}</td>
      <td class="${pg.status==='pago'?'text-green':'text-orange'} fw-600">${Utils.formatCurrency(pg.valor)}</td>
      <td>${Utils.escHtml(pg.forma||'')}</td>
      <td>${Utils.statusBadge(pg.status)} ${vencBadge}</td>
      <td>${Utils.escHtml(pg.observacao||'')}${pg.parcela?`<br><span style="font-size:11px;color:#667085">${pg.parcela}</span>`:''}</td>
      <td class="td-actions">
        ${pg.status==='pendente'?`<button class="btn btn-sm btn-success" onclick="quitarPagamento('${pg.id}','${passId}','${excId}')">✓ Pagar</button>`:''}
        <button class="btn btn-sm" style="background:#FEE2E2;color:#B91C1C" onclick="excluirPagamentoModal('${pg.id}','${passId}','${excId}')">✕</button>
      </td>
    </tr>`;
  }).join('');

  const pagsStatus = {
    pagos:     pags.filter(p=>p.status==='pago').length,
    pendentes: pags.filter(p=>p.status==='pendente').length,
    vencidos:  pags.filter(p=>p.status==='pendente'&&p.vencimento&&p.vencimento<hoje).length,
  };

  openModal(`Pagamentos — ${Utils.escHtml(pass.nome)}`, `
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
    <div class="stat-card" style="padding:10px 14px"><div class="stat-label">Valor total</div><div class="stat-value sv-currency" style="font-size:16px">${Utils.formatCurrency(fin.valorTotal)}</div></div>
    <div class="stat-card" style="padding:10px 14px"><div class="stat-label">Pago</div><div class="stat-value green sv-currency" style="font-size:16px">${Utils.formatCurrency(fin.totalPago)}</div></div>
    <div class="stat-card" style="padding:10px 14px"><div class="stat-label">Saldo</div><div class="stat-value ${fin.saldo>0?'orange':'green'} sv-currency" style="font-size:16px">${Utils.formatCurrency(fin.saldo)}</div></div>
  </div>
  ${pagsStatus.vencidos>0?`<div class="fin-msg danger" style="margin-bottom:12px">⚠️ ${pagsStatus.vencidos} parcela(s) vencida(s)!</div>`:''}
  ${pags.length?`<div class="table-wrapper mb-16"><table>
    <thead><tr><th>Data / Venc.</th><th>Valor</th><th>Forma</th><th>Status</th><th>Obs / Parcela</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table></div>`:'<p class="text-gray mb-16">Nenhum pagamento registrado.</p>'}
  <hr class="divider"/>
  <div class="section-title" style="margin-bottom:12px">Registrar pagamento</div>
  ${proxParc?`
  <div class="form-group" style="margin-bottom:10px">
    <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
      <input type="checkbox" id="chkQuitarParcela" checked
        onchange="document.getElementById('inputPagamentoIdVinculado').value=this.checked?'${proxParc.id}':''"/>
      Quitar a parcela pendente (${Utils.escHtml(proxParc.parcela||'')}${proxParc.vencimento?', vence '+Utils.formatDate(proxParc.vencimento):''}) em vez de criar um pagamento novo
    </label>
  </div>`:''}
  <form id="formPagModal" onsubmit="salvarPagamentoModal(event,'${passId}','${excId}')">
    <input type="hidden" name="pagamentoIdVinculado" id="inputPagamentoIdVinculado" value="${proxParc?proxParc.id:''}"/>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Data *</label>
        <input class="form-control" type="date" name="data" value="${Utils.today()}" required/></div>
      <div class="form-group"><label class="form-label">Valor (R$) *</label>
        <input class="form-control" type="number" name="valor" min="0.01" step="0.01"
          value="${proxParc ? (parseFloat(proxParc.valor)||0).toFixed(2) : (fin.saldo>0?fin.saldo.toFixed(2):'')}"
          placeholder="${fin.saldo>0?fin.saldo.toFixed(2):''}" required/></div>
      <div class="form-group"><label class="form-label">Vencimento</label>
        <input class="form-control" type="date" name="vencimento"
          value="${proxParc?.vencimento||''}"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Forma</label>
        <select class="form-control" name="forma">${FORMAS_PAGAMENTO.map(f=>`<option>${f}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Status</label>
        <select class="form-control" name="status"><option value="pago">Pago</option><option value="pendente">Pendente</option></select></div>
    </div>
    <div class="form-group"><label class="form-label">Observação / Nº parcela</label>
      <input class="form-control" name="observacao"
        value="${proxParc?.parcela||''}"
        placeholder="ex: 1ª parcela, entrada, saldo final..."/></div>
    <button type="submit" class="btn btn-primary w-full">Registrar</button>
  </form>`, 'modal-lg');
}

// Quitar pagamento pendente direto
async function quitarPagamento(pagId, passId, excId) {
  const pag = await DB.getById('pagamentos', pagId);
  if (!pag) return;
  pag.status = 'pago';
  pag.data   = Utils.today();
  await DB.save('pagamentos', pag);
  DB.marcarAlteracao();
  Utils.showToast('Pagamento quitado!');
  openModalPagamentos(passId, excId);
}

async function salvarPagamentoModal(e, passId, excId) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  const vinculadoId = data.pagamentoIdVinculado;
  delete data.pagamentoIdVinculado;
  data.passageiroId=passId; data.excursaoId=excId;

  if (vinculadoId) {
    // Atualiza a parcela existente em vez de criar um pagamento duplicado
    const existente = await DB.getById('pagamentos', vinculadoId);
    if (existente) {
      data.id = existente.id;
      data.origem = existente.origem;
      data.parcela = existente.parcela || data.observacao || '';
      data.createdAt = existente.createdAt;
    }
  }

  await DB.save('pagamentos', data);
  DB.marcarAlteracao();
  Utils.showToast('Pagamento registrado!');
  // Reabre o modal atualizado — não redireciona para excursão
  openModalPagamentos(passId, excId);
}

async function excluirPagamentoModal(id, passId, excId) {
  if (!confirm('Excluir este pagamento?')) return;
  await DB.remove('pagamentos', id);
  DB.marcarAlteracao();
  Utils.showToast('Pagamento excluído');
  // Reabre o modal atualizado — não redireciona
  openModalPagamentos(passId, excId);
}

async function openModalNovoPagamento(excId) {
  const passageiros = (await DB.getAll('passageiros')).filter(p=>p.excursaoId===excId&&p.status!=='cancelado');
  const opts = passageiros.map(p=>`<option value="${p.id}">${Utils.escHtml(p.nome)}</option>`).join('');
  openModal('Novo Pagamento', `
  <form id="formPagNovo" onsubmit="salvarNovoPagamento(event,'${excId}')">
    <div class="form-group"><label class="form-label">Passageiro *</label>
      <select class="form-control" name="passageiroId" required><option value="">— Selecionar —</option>${opts}</select></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Data *</label>
        <input class="form-control" type="date" name="data" value="${Utils.today()}" required/></div>
      <div class="form-group"><label class="form-label">Valor (R$) *</label>
        <input class="form-control" type="number" name="valor" min="0.01" step="0.01" required/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Forma</label>
        <select class="form-control" name="forma">${FORMAS_PAGAMENTO.map(f=>`<option>${f}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Status</label>
        <select class="form-control" name="status"><option value="pago">Pago</option><option value="pendente">Pendente</option></select></div>
    </div>
    <div class="form-group"><label class="form-label">Observação</label>
      <input class="form-control" name="observacao"/></div>
    <button type="submit" class="btn btn-primary w-full">Registrar</button>
  </form>`);
}

async function salvarNovoPagamento(e, excId) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  data.excursaoId = excId;
  await DB.save('pagamentos', data);
  DB.marcarAlteracao();
  closeModal();
  Utils.showToast('Pagamento registrado!');
  navigate('excursao', { excursaoId: excId, tab: 'pagamentos' });
}

async function excluirPagamento(id, excId) {
  if (!confirm('Excluir pagamento?')) return;
  await DB.remove('pagamentos', id);
  Utils.showToast('Pagamento excluído');
  navigate('excursao', { excursaoId: excId, tab: 'pagamentos' });
}

// ── MODAL: EXCURSÃO ───────────────────────────────────────────────────// ── BUSCA DE CLIENTE EXISTENTE NO MODAL DE PASSAGEIRO ─────────────────
let _buscarClienteTimer = null;
async function buscarClienteExistente(q) {
  const container = document.getElementById('resultadosBuscaCliente');
  if (!container) return;
  if (!q || q.length < 2) { container.innerHTML = ''; return; }
  clearTimeout(_buscarClienteTimer);
  _buscarClienteTimer = setTimeout(async () => {
    const todos = await DB.getAll('passageiros');
    const qNorm = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    // Agrupa por nome+telefone, pega o mais recente de cada grupo
    const vistos = {};
    for (const p of todos) {
      if (!p.nome) continue;
      const key = (p.nome.toLowerCase() + '|' + (p.telefone||'')).trim();
      if (!vistos[key] || (p.createdAt||'') > (vistos[key].createdAt||'')) {
        vistos[key] = p;
      }
    }
    const resultados = Object.values(vistos).filter(p => {
      const txt = (p.nome + ' ' + (p.telefone||'') + ' ' + (p.documento||''))
        .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      return txt.includes(qNorm);
    }).slice(0, 8);

    if (!resultados.length) {
      container.innerHTML = '<div style="padding:8px 12px;font-size:13px;color:var(--gray)">Nenhum cliente encontrado</div>';
      return;
    }
    window._clientesBusca = resultados;
    container.innerHTML = `<div style="position:absolute;left:0;right:0;background:#fff;border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.12);z-index:999;max-height:220px;overflow-y:auto">
      ${resultados.map((p, i) => `
        <div style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px"
          onmousedown="preencherComCliente(${i})"
          onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''">
          <b>${Utils.escHtml(p.nome)}</b>
          ${p.telefone ? `<span style="color:var(--gray);margin-left:8px">${Utils.escHtml(p.telefone)}</span>` : ''}
          ${p.documento ? `<span style="color:var(--gray);margin-left:8px;font-size:11px">${Utils.escHtml(p.documento)}</span>` : ''}
        </div>`).join('')}
    </div>`;
  }, 250);
}
window.buscarClienteExistente = buscarClienteExistente;

function preencherComCliente(idx) {
  const p = window._clientesBusca?.[idx];
  if (!p) return;
  const campos = ['nome','telefone','documento','rg','nascimento','cidade','pontoEmbarque','emergencia','observacoes','formaPreferida'];
  const form = document.getElementById('formPass');
  if (!form) return;
  for (const campo of campos) {
    const el = form.elements[campo];
    if (el && p[campo]) el.value = p[campo];
  }
  // Limpar busca
  const inp = document.getElementById('buscaClienteExistente');
  if (inp) inp.value = '';
  const res = document.getElementById('resultadosBuscaCliente');
  if (res) res.innerHTML = '';
  Utils.showToast('Dados preenchidos com o cliente selecionado!');
}
window.preencherComCliente = preencherComCliente;
