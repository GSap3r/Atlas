// ==============================================
// ARQUIVO: atlas/assets/js/app-utils.js
// Imprimir, CSV, motor de modal, gráficos
// ==============================================
async function _loadExcursaoData() {
  const [exc, todosPass, todosPags, todasContas, tipos] = await Promise.all([
    DB.getById('excursoes', state.excursaoId),
    DB.getAll('passageiros'), DB.getAll('pagamentos'), DB.getAll('contas'), DB.getAll('tiposPassageiro')
  ]);
  const pass   = todosPass.filter(p=>p.excursaoId===state.excursaoId);
  const pags   = todosPags.filter(p=>p.excursaoId===state.excursaoId);
  const contas = todasContas.filter(c=>c.excursaoId===state.excursaoId);
  const fin    = Utils.calcExcursaoFinanceiro(exc, todosPass, todosPags, todasContas, tipos);
  return { exc, pass, pags, contas, fin, tipos };
}

async function imprimirEmbarque() {
  const {exc,pass,pags,tipos} = await _loadExcursaoData();
  PDF.printEmbarque(exc, pass, pags, tipos);
}
async function imprimirFinanceiro() {
  const {exc,fin,contas,pass,pags} = await _loadExcursaoData();
  PDF.printFinanceiro(exc, fin, contas, pass, pags);
}
async function imprimirPassageiros() {
  const {exc,pass,pags,tipos} = await _loadExcursaoData();
  PDF.printPassageiros(exc, pass, pags, tipos);
}
async function imprimirPagamentos() {
  const {exc,pass,pags} = await _loadExcursaoData();
  PDF.printPagamentos(exc, pass, pags);
}
async function imprimirCompleto() {
  const {exc,fin,contas,pass,pags,tipos} = await _loadExcursaoData();
  PDF.printCompleto(exc, fin, contas, pass, pags, tipos);
}

async function exportPassageirosCSV() {
  const {pass,pags} = await _loadExcursaoData();
  const tipos = await DB.getAll('tiposPassageiro');
  const pacotes = await DB.getAll('pacotes');
  Utils.exportCSV(pass.map(p=>{
    const fin  = Utils.calcPassageiroFinanceiro(p,pags);
    const tipo = tipos.find(t=>t.id===p.tipoPassageiroId);
    const pac  = pacotes.find(pk=>pk.id===p.pacoteId);
    return {
      Nome:p.nome, Telefone:p.telefone||'', Documento:p.documento||'', RG:p.rg||'',
      Cidade:p.cidade||'', Assento:p.assento||'', Status:p.status,
      Reserva:p.codigoReserva||'', Titular:p.titularReserva||'',
      Pacote:pac?.nome||'', Tipo:tipo?.nome||'Adulto',
      ValorBase:p.valorBase||'', Desconto:p.desconto||0, Taxa:p.taxaCartao||0,
      ValorFinal:p.valorFinal != null ? p.valorFinal : (p.valorCombinado || ''),
      Pago:fin.totalPago, Saldo:fin.saldo,
      Pagante:tipo?.pagante?'Sim':'Não', OcupaVaga:tipo?.ocupaVaga?'Sim':'Não',
      Embarque:p.pontoEmbarque||'',
    };
  }),'passageiros.csv');
}

async function exportPagamentosCSVTab() {
  const {pass,pags} = await _loadExcursaoData();
  Utils.exportCSV(pags.map(p=>{
    const ps = pass.find(ps=>ps.id===p.passageiroId);
    return { Passageiro:ps?.nome||'', Data:p.data, Valor:p.valor, Forma:p.forma||'', Status:p.status, Obs:p.observacao||'' };
  }),'pagamentos.csv');
}

async function exportEmbarqueCSV() {
  const {pass,pags,tipos} = await _loadExcursaoData();
  const ativos = pass.filter(p=>p.status!=='cancelado'&&Utils.getTipo(p.tipoPassageiroId,tipos).entraNaListaEmbarque);
  Utils.exportCSV(ativos.map(p=>{
    const fin  = Utils.calcPassageiroFinanceiro(p,pags);
    const tipo = tipos.find(t=>t.id===p.tipoPassageiroId);
    return { Nome:p.nome, Telefone:p.telefone||'', Documento:p.documento||'',
      Embarque:p.pontoEmbarque||'', Assento:p.assento||'', Tipo:tipo?.nome||'Adulto',
      Status:p.status, Pago:fin.totalPago, Saldo:fin.saldo };
  }),'embarque.csv');
}

// ── MOTOR DE MODAL ────────────────────────────────────────────────────
function openModal(title, body, cls='', btns=[]) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML    = body;
  document.getElementById('modal').className        = `modal ${cls}`;
  const footer = document.getElementById('modalFooter');
  footer.innerHTML = btns.map(b=>`<button class="btn ${b.cls}" onclick="${b.fn}">${b.label}</button>`).join('');
  footer.style.display = btns.length ? 'flex' : 'none';
  document.getElementById('modalOverlay').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
}

// Quando muda o código de reserva, tenta puxar o titular existente
async function onChangeCodReserva(input, excId) {
  const cod = input.value.trim();
  if (!cod) return;
  const reservas = await DB.getAll('reservas');
  const res = reservas.find(r => r.excursaoId === excId && r.codigo === cod);
  if (res) {
    const titInput = document.getElementById('inputTitularReserva');
    if (titInput && !titInput.value) titInput.value = res.titular || '';
    Utils.showToast('Reserva encontrada: ' + res.titular, 'success');
  }
}

function setupModal() {
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', (e)=>{
    if (e.target===document.getElementById('modalOverlay')) closeModal();
  });
}


// ── GRÁFICOS DO DASHBOARD ──────────────────────────────────────────
function drawDashboardCharts(ED, SC, PCT) {
  function drawAll() { _barras(); _donut(); _gauge(); }

  // Tenta imediatamente, depois com delays crescentes
  drawAll();
  setTimeout(drawAll, 100);
  setTimeout(drawAll, 400);

  window.addEventListener('resize', function() {
    clearTimeout(window._atlasResizeTimer);
    window._atlasResizeTimer = setTimeout(drawAll, 200);
  });

  function _roundRect(ctx, x, y, w, h, r) {
    if(h<=0)return; r=Math.min(r,h/2,w/2);
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
    ctx.arcTo(x+w,y,x+w,y+r,r);
    ctx.lineTo(x+w,y+h); ctx.lineTo(x,y+h); ctx.lineTo(x,y+r);
    ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
  }

  function _barras() {
    const cv = document.getElementById('chartBarras'); if(!cv)return;
    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio||1;
    const W   = Math.max(cv.parentElement.offsetWidth, cv.parentElement.getBoundingClientRect().width, 200);
    const H   = 190;
    cv.width  = W*dpr; cv.height = H*dpr;
    cv.style.width=W+'px'; cv.style.height=H+'px';
    ctx.scale(dpr,dpr);
    if(!ED||!ED.length) return;
    const pad = {t:12,r:12,b:42,l:52};
    const gW  = W-pad.l-pad.r;
    const gH  = H-pad.t-pad.b;
    const maxV= Math.max(...ED.map(d=>Math.max(d.prev||0,d.rec||0)),1);
    const n   = ED.length;
    const grp = gW/n;
    const bW  = Math.min(grp*0.28, 18);
    const sp  = bW*0.5;
    ctx.fillStyle='#9CA3AF'; ctx.font='10px DM Sans,sans-serif'; ctx.textAlign='right';
    for(let i=0;i<=4;i++){
      const y=pad.t+gH-(i/4)*gH;
      ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(W-pad.r,y);
      ctx.strokeStyle='#F3F4F6'; ctx.lineWidth=1; ctx.stroke();
      const v=(maxV*i/4);
      ctx.fillText(v>=1000?(v/1000).toFixed(0)+'k':v.toFixed(0), pad.l-4, y+3);
    }
    ED.forEach((d,i)=>{
      const cx  = pad.l + i*grp + grp/2;
      const x0  = cx - bW - sp/2;
      const hP  = Math.max((d.prev/maxV)*gH, d.prev>0?2:0);
      ctx.fillStyle = d.cor+'66';
      _roundRect(ctx, x0, pad.t+gH-hP, bW, hP, 3); ctx.fill();
      const hR  = Math.max((d.rec/maxV)*gH, d.rec>0?2:0);
      ctx.fillStyle = d.cor;
      _roundRect(ctx, x0+bW+sp, pad.t+gH-hR, bW, hR, 3); ctx.fill();
      ctx.fillStyle='#6B7280'; ctx.font='9px DM Sans,sans-serif'; ctx.textAlign='center';
      const words = d.nome.split(' ');
      if(words.length>1 && d.nome.length>10){
        ctx.fillText(words[0], cx, H-pad.b+11);
        ctx.fillText(words.slice(1).join(' '), cx, H-pad.b+21);
      } else { ctx.fillText(d.nome, cx, H-pad.b+13); }
    });
  }

  function _donut() {
    const cv = document.getElementById('chartDonut'); if(!cv)return;
    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio||1;
    cv.width=140*dpr; cv.height=140*dpr; ctx.scale(dpr,dpr);
    const cx=70,cy=70,ro=60,ri=40;
    const data=[{v:SC.confirmado,c:'#12B76A'},{v:SC.reservado,c:'#F2B807'},{v:SC.pendente,c:'#F79009'}];
    const total=data.reduce((s,d)=>s+d.v,0)||1;
    let a=-Math.PI/2;
    data.forEach(d=>{
      const sw=(d.v/total)*2*Math.PI;
      if(sw<0.01){a+=sw;return;}
      ctx.beginPath(); ctx.arc(cx,cy,ro,a,a+sw); ctx.arc(cx,cy,ri,a+sw,a,true);
      ctx.closePath(); ctx.fillStyle=d.c; ctx.fill();
      a+=sw;
    });
    ctx.beginPath(); ctx.arc(cx,cy,ri-1,0,2*Math.PI);
    ctx.fillStyle='#fff'; ctx.fill();
    ctx.fillStyle='#172033'; ctx.font='bold 20px DM Sans,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(total,cx,cy-5);
    ctx.fillStyle='#9CA3AF'; ctx.font='10px DM Sans,sans-serif';
    ctx.fillText('pax',cx,cy+11);
  }

  function _gauge() {
    const cv = document.getElementById('chartGauge'); if(!cv)return;
    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio||1;
    cv.width=140*dpr; cv.height=120*dpr; ctx.scale(dpr,dpr);
    const cx=70,cy=80,r=52,lw=14;
    const sa=Math.PI, ea=2*Math.PI;
    const pct=Math.min(PCT/100,1);
    const fa=sa+pct*Math.PI;
    const cor=pct>=.9?'#12B76A':pct>=.6?'#F79009':'#F04438';
    ctx.beginPath(); ctx.arc(cx,cy,r,sa,ea);
    ctx.strokeStyle='#E4E7EC'; ctx.lineWidth=lw; ctx.lineCap='round'; ctx.stroke();
    if(pct>0.01){
      ctx.beginPath(); ctx.arc(cx,cy,r,sa,fa);
      ctx.strokeStyle=cor; ctx.lineWidth=lw; ctx.lineCap='round'; ctx.stroke();
    }
    const na=sa+pct*Math.PI;
    const nx=cx+(r-lw)*Math.cos(na), ny=cy+(r-lw)*Math.sin(na);
    ctx.beginPath(); ctx.arc(nx,ny,4,0,2*Math.PI);
    ctx.fillStyle=cor; ctx.fill();
  }
}

function attachPageEvents() {
  // Redesenha gráficos do dashboard se estiver na página certa
  if (state.page === 'dashboard' && window._dashED) {
    drawDashboardCharts(window._dashED, window._dashSC, window._dashPCT);
  }
}