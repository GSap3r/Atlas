// ==============================================
// ARQUIVO: atlas/assets/js/app-global.js
// Excursão CRUD, tipos de passageiro,
// fornecedores, cobranças, configurações, backup
// ==============================================
async function openModalExcursao(id=null) {
  const exc = id?await DB.getById('excursoes',id):null;
  const v   = exc||{};
  const corSels = CORES.map(c=>`<div class="color-opt ${(v.cor||CORES[0])===c?'selected':''}" style="background:${c}" data-cor="${c}" onclick="selecionarCor('${c}')"></div>`).join('');
  openModal(id?'Editar Excursão':'Nova Excursão', `
  <form id="formExc" onsubmit="salvarExcursao(event,'${id||''}')">
    <div class="form-row">
      <div class="form-group" style="grid-column:1/-1"><label class="form-label">Nome *</label>
        <input class="form-control" name="nome" value="${Utils.escHtml(v.nome||'')}" required placeholder="Ex: Gramado Julho 2025"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Destino</label>
        <input class="form-control" name="destino" value="${Utils.escHtml(v.destino||'')}"/></div>
      <div class="form-group"><label class="form-label">Local de embarque</label>
        <input class="form-control" name="localEmbarque" value="${Utils.escHtml(v.localEmbarque||'')}"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Data de saída</label>
        <input class="form-control" type="date" name="dataSaida" value="${v.dataSaida||''}"/></div>
      <div class="form-group"><label class="form-label">Data de retorno</label>
        <input class="form-control" type="date" name="dataRetorno" value="${v.dataRetorno||''}"/></div>
      <div class="form-group"><label class="form-label">Horário</label>
        <input class="form-control" type="time" name="horario" value="${v.horario||''}"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Total de vagas *</label>
        <input class="form-control" type="number" name="vagas" value="${v.vagas||40}" min="1" required/></div>
      <div class="form-group"><label class="form-label">Valor padrão/pax (R$)</label>
        <input class="form-control" type="number" name="valorPassageiro" value="${v.valorPassageiro||''}" min="0" step="0.01"/></div>
      <div class="form-group"><label class="form-label">Status da excursão</label>
        <select class="form-control" name="statusManual">
          <option value="">Automático (baseado em pagamentos)</option>
          <option value="em_andamento"  ${v.statusManual==='em_andamento' ?'selected':''}>Em andamento</option>
          <option value="concluida"     ${v.statusManual==='concluida'    ?'selected':''}>Concluída</option>
          <option value="cancelada"     ${v.statusManual==='cancelada'    ?'selected':''}>Cancelada</option>
        </select></div>
    </div>
    <div class="form-group" style="grid-column:1/-1"><label class="form-label">Pontos de embarque</label>
      <input class="form-control" name="pontosEmbarque" value="${Utils.escHtml(v.pontosEmbarque||'')}"
        placeholder="Ex: Terminal Urbano, Shopping da Cidade, Igreja Matriz (separe por vírgula)"/>
      <div class="form-hint">Esses pontos aparecerão como opções no cadastro de passageiros.</div>
    </div>
    <div class="form-group"><label class="form-label">Observações</label>
      <textarea class="form-control" name="observacoes" rows="2">${Utils.escHtml(v.observacoes||'')}</textarea></div>
    <div class="form-group"><label class="form-label">Cor</label>
      <div class="color-picker-row" id="colorPicker">${corSels}</div>
      <input type="hidden" name="cor" id="corSelecionada" value="${v.cor||CORES[0]}"/></div>
    <button type="submit" class="btn btn-primary w-full">${id?'Salvar':'Criar Excursão'}</button>
  </form>`, 'modal-lg');
}

function selecionarCor(cor) {
  document.querySelectorAll('#colorPicker .color-opt').forEach(el=>el.classList.toggle('selected',el.dataset.cor===cor));
  document.getElementById('corSelecionada').value = cor;
}

async function salvarExcursao(e, id) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  if (id) data.id = id;
  const saved = await DB.save('excursoes', data);
  DB.marcarAlteracao();
  // Criar pacote padrão se excursão nova
  if (!id) {
    const tipos = await DB.getAll('tiposPassageiro');
    const tipoAdultoId = tipos.find(t=>t.nome==='Adulto')?.id;
    await DB.save('pacotes', {
      excursaoId: saved.id, nome:'Pacote padrão', descricao:'Padrão',
      valorVenda: parseFloat(data.valorPassageiro)||0,
      tipoPassageiroPadraoId: tipoAdultoId, incluiAssento:true, ativo:true, custoEstimado:0, observacoes:'',
    });
  }
  closeModal();
  Utils.showToast(id?'Excursão atualizada!':'Excursão criada!');
  navigate(id?'excursao':'excursoes', id?{excursaoId:id}:{});
}

async function confirmarExcluirExcursao(id) {
  const exc = await DB.getById('excursoes', id);
  await Backup.modalBackupObrigatorio('Antes de excluir', async () => {
    openModal('Excluir excursão', `
      <p>Excluir <b>${Utils.escHtml(exc?.nome||'')}</b> e <b>todos os dados relacionados</b>.</p>
      <p class="text-red mt-8 fw-600">Esta ação não pode ser desfeita.</p>`, '', [
      { label:'Cancelar',    cls:'btn-outline', fn:'closeModal()' },
      { label:'Excluir tudo',cls:'btn-danger',  fn:`excluirExcursao('${id}')` }
    ]);
  });
}

async function excluirExcursao(id) {
  const [pass,pags,contas,pacotes,reservas] = await Promise.all([
    DB.getAll('passageiros'),DB.getAll('pagamentos'),DB.getAll('contas'),DB.getAll('pacotes'),DB.getAll('reservas')
  ]);
  for(const p of pass.filter(p=>p.excursaoId===id))    await DB.remove('passageiros',p.id);
  for(const p of pags.filter(p=>p.excursaoId===id))    await DB.remove('pagamentos',p.id);
  for(const c of contas.filter(c=>c.excursaoId===id))  await DB.remove('contas',c.id);
  for(const p of pacotes.filter(p=>p.excursaoId===id)) await DB.remove('pacotes',p.id);
  for(const r of reservas.filter(r=>r.excursaoId===id))await DB.remove('reservas',r.id);
  await DB.remove('excursoes', id);
  closeModal();
  Utils.showToast('Excursão excluída');
  navigate('excursoes');
}

// ── TIPOS DE PASSAGEIRO ───────────────────────────────────────────────
async function renderTiposPassageiro() {
  const tipos = await DB.getAll('tiposPassageiro');
  const ativos = tipos.filter(t=>t.ativo!==false).sort((a,b)=>(a.ordem||99)-(b.ordem||99));
  const inativos = tipos.filter(t=>t.ativo===false);

  const toggle = (v, label) => `<span class="${v?'badge badge-green':'badge badge-gray'}" style="font-size:11px">${v?'✓':''} ${label}</span>`;

  const rows = ativos.map(t=>`<tr>
    <td><b>${Utils.escHtml(t.nome)}</b><br><span class="text-gray" style="font-size:12px">${Utils.escHtml(t.descricao||'')}</span></td>
    <td>${toggle(t.pagante,'Pagante')}</td>
    <td>${toggle(t.ocupaVaga,'Ocupa vaga')}</td>
    <td>${toggle(t.entraNaListaEmbarque,'Embarque')}</td>
    <td>${toggle(t.entraNoFinanceiro,'Financeiro')}</td>
    <td class="td-actions">
      <button class="btn btn-outline btn-sm" onclick="openModalTipoPassageiro('${t.id}')">✎</button>
      <button class="btn btn-sm" style="background:#FEE2E2;color:#B91C1C" onclick="desativarTipo('${t.id}')">Desativar</button>
    </td>
  </tr>`).join('');

  const pag    = ativos.filter(t=>t.pagante).length;
  const naoPag = ativos.filter(t=>!t.pagante).length;
  const ocupa  = ativos.filter(t=>t.ocupaVaga).length;
  const nOcupa = ativos.filter(t=>!t.ocupaVaga).length;

  return `
  <div class="page-header">
    <div><h1>Tipos de Passageiro</h1><div class="page-header-sub">Regras globais para todos os passageiros.</div></div>
    <button class="btn btn-primary" onclick="openModalTipoPassageiro()">+ Novo tipo</button>
  </div>
  <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:24px">
    <div class="stat-card"><div class="stat-label">Pagantes</div><div class="stat-value green">${pag}</div></div>
    <div class="stat-card"><div class="stat-label">Não pagantes</div><div class="stat-value gray">${naoPag}</div></div>
    <div class="stat-card"><div class="stat-label">Ocupam vaga</div><div class="stat-value blue">${ocupa}</div></div>
    <div class="stat-card"><div class="stat-label">Não ocupam</div><div class="stat-value gray">${nOcupa}</div></div>
  </div>
  <div class="table-wrapper">
    <table>
      <thead><tr><th>Tipo</th><th>Pagante</th><th>Ocupa Vaga</th><th>Embarque</th><th>Financeiro</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  ${inativos.length?`<p class="text-gray mt-16" style="font-size:13px">${inativos.length} tipo(s) desativado(s) não exibido(s).</p>`:''}`;
}

async function openModalTipoPassageiro(id=null) {
  const t = id?await DB.getById('tiposPassageiro',id):null;
  const v = t||{pagante:true,ocupaVaga:true,entraNaListaEmbarque:true,entraNoFinanceiro:true};
  const chk = (name,val,label) =>
    `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:8px;font-size:14px">
      <input type="checkbox" name="${name}" value="1" ${val?'checked':''}/> ${label}
    </label>`;
  openModal(id?'Editar Tipo':'Novo Tipo de Passageiro', `
  <form id="formTipo" onsubmit="salvarTipoPassageiro(event,'${id||''}')">
    <div class="form-row">
      <div class="form-group"><label class="form-label">Nome *</label>
        <input class="form-control" name="nome" value="${Utils.escHtml(v.nome||'')}" required placeholder="Ex: Adulto, Criança..."/></div>
      <div class="form-group"><label class="form-label">Ordem</label>
        <input class="form-control" type="number" name="ordem" value="${v.ordem||1}" min="1"/></div>
    </div>
    <div class="form-group"><label class="form-label">Descrição</label>
      <input class="form-control" name="descricao" value="${Utils.escHtml(v.descricao||'')}"/></div>
    <div class="form-group" style="margin-top:12px"><label class="form-label">Regras</label>
      ${chk('pagante',v.pagante,'Pagante — gera receita')}
      ${chk('ocupaVaga',v.ocupaVaga,'Ocupa vaga — conta no mapa de assentos')}
      ${chk('entraNaListaEmbarque',v.entraNaListaEmbarque,'Entra na lista de embarque')}
      ${chk('entraNoFinanceiro',v.entraNoFinanceiro,'Entra no financeiro')}
    </div>
    <button type="submit" class="btn btn-primary w-full">${id?'Salvar':'Criar tipo'}</button>
  </form>`);
}

async function salvarTipoPassageiro(e, id) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = {
    nome: fd.get('nome'), descricao: fd.get('descricao')||'',
    ordem: parseInt(fd.get('ordem'))||1, ativo: true,
    pagante:               fd.get('pagante')==='1',
    ocupaVaga:             fd.get('ocupaVaga')==='1',
    entraNaListaEmbarque:  fd.get('entraNaListaEmbarque')==='1',
    entraNoFinanceiro:     fd.get('entraNoFinanceiro')==='1',
  };
  if (id) data.id = id;
  await DB.save('tiposPassageiro', data);
  closeModal();
  Utils.showToast(id?'Tipo atualizado!':'Tipo criado!');
  navigate('tiposPassageiro');
}

async function desativarTipo(id) {
  if (!confirm('Desativar este tipo?')) return;
  const t = await DB.getById('tiposPassageiro', id);
  if (t) { t.ativo=false; await DB.save('tiposPassageiro',t); }
  Utils.showToast('Tipo desativado');
  navigate('tiposPassageiro');
}

// ── FORNECEDORES ──────────────────────────────────────────────────────
async function renderFornecedores() {
  const fornecedores = await DB.getAll('fornecedores');
  const ativos   = fornecedores.filter(f=>f.ativo!==false);
  const inativos = fornecedores.filter(f=>f.ativo===false);
  const cats     = [...new Set(ativos.map(f=>f.categoria).filter(Boolean))];

  const rows = ativos.map(f => {
    const waLink = f.whatsapp||f.telefone ? Utils.waLink(f.whatsapp||f.telefone) : null;
    return `<tr>
      <td><b>${Utils.escHtml(f.nome)}</b></td>
      <td><span class="badge badge-gray">${Utils.escHtml(f.categoria||'')}</span></td>
      <td>
        ${Utils.escHtml(f.telefone||'')}
        ${waLink?`<a href="${waLink}" target="_blank" class="wa-btn" title="WhatsApp">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.559 4.14 1.535 5.875L.057 23.899l6.224-1.635A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.002-1.373l-.36-.213-3.692.97.985-3.601-.233-.369A9.818 9.818 0 1112 21.818z"/></svg>
        </a>`:''}
      </td>
      <td class="text-gray" style="font-size:13px">${Utils.escHtml(f.contato||'')}</td>
      <td class="text-gray" style="font-size:12px">${Utils.escHtml(f.observacoes||'')}</td>
      <td class="td-actions">
        <button class="btn btn-outline btn-sm" onclick="openModalFornecedor('${f.id}')">✎</button>
        <button class="btn btn-sm" style="background:#FEE2E2;color:#B91C1C" onclick="desativarFornecedor('${f.id}')">Desativar</button>
      </td>
    </tr>`;
  }).join('');

  return `
  <div class="page-header">
    <div><h1>Fornecedores</h1><div class="page-header-sub">Cadastro base para relacionar aos custos das excursões.</div></div>
    <button class="btn btn-primary" onclick="openModalFornecedor()">+ Novo fornecedor</button>
  </div>
  <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:24px">
    <div class="stat-card"><div class="stat-label">Fornecedores</div><div class="stat-value">${ativos.length}</div></div>
    <div class="stat-card"><div class="stat-label">Categorias</div><div class="stat-value">${cats.length}</div></div>
    <div class="stat-card"><div class="stat-label">Desativados</div><div class="stat-value gray">${inativos.length}</div></div>
  </div>
  ${!ativos.length
    ?`<div class="empty-state"><h3>Nenhum fornecedor cadastrado</h3><p>Cadastre fornecedores para relacionar aos custos das excursões.</p>
        <button class="btn btn-primary mt-16" onclick="openModalFornecedor()">+ Novo fornecedor</button></div>`
    :`<div class="table-wrapper"><table>
        <thead><tr><th>Nome</th><th>Categoria</th><th>Telefone</th><th>Contato</th><th>Obs</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`
  }`;
}

async function openModalFornecedor(id=null) {
  const f = id?await DB.getById('fornecedores',id):null;
  const v = f||{};
  openModal(id?'Editar Fornecedor':'Novo Fornecedor', `
  <form id="formForn" onsubmit="salvarFornecedor(event,'${id||''}')">
    <div class="form-row">
      <div class="form-group" style="grid-column:1/-1"><label class="form-label">Nome *</label>
        <input class="form-control" name="nome" value="${Utils.escHtml(v.nome||'')}" required placeholder="Ex: Empresa de Ônibus São Paulo"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Categoria</label>
        <select class="form-control" name="categoria">
          ${CAT_FORNECEDOR.map(c=>`<option value="${c}" ${v.categoria===c?'selected':''}>${c}</option>`).join('')}
        </select></div>
      <div class="form-group"><label class="form-label">Telefone</label>
        <input class="form-control" name="telefone" value="${Utils.escHtml(v.telefone||'')}"/></div>
      <div class="form-group"><label class="form-label">WhatsApp</label>
        <input class="form-control" name="whatsapp" value="${Utils.escHtml(v.whatsapp||'')}"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Documento / CNPJ</label>
        <input class="form-control" name="documento" value="${Utils.escHtml(v.documento||'')}"/></div>
      <div class="form-group"><label class="form-label">Contato / Nome responsável</label>
        <input class="form-control" name="contato" value="${Utils.escHtml(v.contato||'')}"/></div>
    </div>
    <div class="form-group"><label class="form-label">Observações</label>
      <textarea class="form-control" name="observacoes" rows="2">${Utils.escHtml(v.observacoes||'')}</textarea></div>
    <button type="submit" class="btn btn-primary w-full">${id?'Salvar':'Cadastrar fornecedor'}</button>
  </form>`);
}

async function salvarFornecedor(e, id) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  data.ativo = true;
  if (id) data.id = id;
  await DB.save('fornecedores', data);
  closeModal();
  Utils.showToast(id?'Fornecedor atualizado!':'Fornecedor cadastrado!');
  navigate('fornecedores');
}

async function desativarFornecedor(id) {
  if (!confirm('Desativar este fornecedor?')) return;
  const f = await DB.getById('fornecedores', id);
  if (f) { f.ativo=false; await DB.save('fornecedores',f); }
  Utils.showToast('Fornecedor desativado');
  navigate('fornecedores');
}

// ── CLIENTES ──────────────────────────────────────────────────────────
function normalizarBuscaCliente(txt) {
  return String(txt || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function clienteBuscaTexto(p, exc) {
  return normalizarBuscaCliente([
    p.nome, p.telefone, p.whatsapp, p.documento, p.rg, p.cpf, p.email,
    p.codigoReserva, p.titularReserva, p.cidade, exc?.nome, exc?.destino
  ].filter(Boolean).join(' '));
}

function clienteKey(p) {
  const doc = String(p.documento || p.cpf || p.rg || '').replace(/\D/g, '');
  if (doc) return 'doc:' + doc;
  const tel = String(p.telefone || p.whatsapp || '').replace(/\D/g, '');
  if (tel) return 'tel:' + tel;
  const nome = String(p.nome || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return 'nome:' + nome;
}

async function montarClientes() {
  const [excursoes, passageiros, pagamentos, tipos] = await Promise.all([
    DB.getAll('excursoes'), DB.getAll('passageiros'),
    DB.getAll('pagamentos'), DB.getAll('tiposPassageiro')
  ]);
  const grupos = {};
  for (const p of passageiros) {
    const key = clienteKey(p);
    if (!key || key === 'nome:') continue;
    const exc = excursoes.find(e => e.id === p.excursaoId);
    const fin = Utils.calcPassageiroFinanceiro(p, pagamentos);
    const tipo = Utils.getTipo(p.tipoPassageiroId, tipos);
    const pags = pagamentos.filter(pg=>pg.passageiroId===p.id);
    const pendentes = pags
      .filter(pg=>pg.status==='pendente')
      .sort((a,b)=>(a.vencimento||a.data||'9999').localeCompare(b.vencimento||b.data||'9999'));
    if (!grupos[key]) grupos[key] = { key, passageiros: [], busca: '', total: 0, pago: 0, saldo: 0 };
    grupos[key].passageiros.push({ p, exc, fin, tipo, pagamentos: pags, pendentes });
    grupos[key].busca += ' ' + clienteBuscaTexto(p, exc);
    grupos[key].total += fin.valorTotal;
    grupos[key].pago += fin.totalPago;
    grupos[key].saldo += fin.saldo;
  }
  return Object.values(grupos).map(g => {
    g.passageiros.sort((a,b)=>(b.exc?.dataSaida||'').localeCompare(a.exc?.dataSaida||''));
    const ref = g.passageiros[0]?.p || {};
    const firstValue = (...fields) => {
      for (const {p} of g.passageiros) {
        for (const f of fields) if (p[f]) return p[f];
      }
      return '';
    };
    g.nome = firstValue('nome') || ref.nome || 'Sem nome';
    g.telefone = firstValue('telefone','whatsapp');
    g.documento = firstValue('documento','cpf','rg');
    g.cidade = firstValue('cidade');
    g.excursoes = new Set(g.passageiros.map(x=>x.p.excursaoId).filter(Boolean)).size;
    g.ativos = g.passageiros.filter(x=>x.p.status !== 'cancelado').length;
    g.proxima = g.passageiros
      .filter(x=>x.exc?.dataSaida && x.exc.dataSaida >= Utils.today())
      .sort((a,b)=>a.exc.dataSaida.localeCompare(b.exc.dataSaida))[0];
    g.ultima = g.passageiros[0];
    return g;
  }).sort((a,b)=>a.nome.localeCompare(b.nome));
}

async function renderClientes() {
  const clientes = await montarClientes();
  const comSaldo = clientes.filter(c=>c.saldo>0).length;
  const recorrentes = clientes.filter(c=>c.excursoes>1).length;
  const totalSaldo = clientes.reduce((s,c)=>s+c.saldo,0);

  const rows = clientes.map(c => {
    const key = Utils.escHtml(c.key);
    const prox = c.proxima
      ? `${Utils.escHtml(c.proxima.exc.nome)} · ${Utils.formatDate(c.proxima.exc.dataSaida)}`
      : (c.ultima?.exc ? `${Utils.escHtml(c.ultima.exc.nome)} · ${Utils.formatDate(c.ultima.exc.dataSaida)}` : '—');
    return `<tr data-busca="${Utils.escHtml(c.busca)}" data-saldo="${c.saldo}" data-recorrente="${c.excursoes>1?'1':'0'}">
      <td>
        <b style="color:var(--blue);cursor:pointer" onclick="openModalCliente('${key}')">${Utils.escHtml(c.nome)}</b>
        ${c.cidade?`<br><span class="text-gray" style="font-size:12px">${Utils.escHtml(c.cidade)}</span>`:''}
      </td>
      <td>
        ${c.telefone?`<div>${Utils.escHtml(c.telefone)}</div>`:''}
        ${c.documento?`<div class="text-gray" style="font-size:12px">${Utils.escHtml(c.documento)}</div>`:''}
      </td>
      <td><span class="badge badge-blue">${c.excursoes}</span></td>
      <td>${prox}</td>
      <td class="text-green fw-600">${Utils.formatCurrency(c.pago)}</td>
      <td class="${c.saldo>0?'text-orange':'text-green'} fw-600">${Utils.formatCurrency(c.saldo)}</td>
      <td class="td-actions">
        <button class="btn btn-outline btn-sm" onclick="openModalCliente('${key}')">Ver</button>
        ${c.telefone?`<a class="btn btn-sm btn-wa" target="_blank" href="${Utils.waLink(c.telefone)}" title="WhatsApp"><svg viewBox="0 0 24 24" fill="currentColor" style="width:13px;height:13px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.559 4.14 1.535 5.875L.057 23.899l6.224-1.635A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.002-1.373l-.36-.213-3.692.97.985-3.601-.233-.369A9.818 9.818 0 1112 21.818z"/></svg></a>`:''}
      </td>
    </tr>`;
  }).join('');

  return `
  <div class="page-header">
    <div><h1>Clientes</h1><div class="page-header-sub">Busque por nome, telefone, documento, reserva, cidade ou excursão.</div></div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-outline btn-sm" onclick="AtlasExcel.exportarClientes()" title="Exportar todos os clientes para Excel">
        <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
        Exportar Excel
      </button>
      <button class="btn btn-primary" onclick="openModalNovoCliente()">+ Novo Cliente</button>
    </div>
  </div>
  <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
    <div class="stat-card"><div class="stat-label">Clientes</div><div class="stat-value">${clientes.length}</div></div>
    <div class="stat-card"><div class="stat-label">Com saldo</div><div class="stat-value ${comSaldo>0?'orange':''}">${comSaldo}</div></div>
    <div class="stat-card"><div class="stat-label">Recorrentes</div><div class="stat-value blue">${recorrentes}</div></div>
    <div class="stat-card"><div class="stat-label">Saldo em aberto</div><div class="stat-value orange sv-currency">${Utils.formatCurrency(totalSaldo)}</div></div>
  </div>
  <div class="filter-bar mb-16">
    <input class="form-control search-input" id="searchClientes" placeholder="Buscar cliente, documento, telefone, reserva ou excursão..." oninput="filtrarClientes()" />
    <select class="form-control" id="filterClientes" onchange="filtrarClientes()" style="max-width:190px">
      <option value="">Todos</option>
      <option value="saldo">Com saldo aberto</option>
      <option value="recorrente">Recorrentes</option>
    </select>
  </div>
  ${!clientes.length
    ? `<div class="empty-state"><h3>Nenhum cliente encontrado</h3><p>Clientes aparecem automaticamente a partir dos passageiros cadastrados.</p></div>`
    : `<div class="table-wrapper"><table id="tabelaClientes">
        <thead><tr><th>Cliente</th><th>Contato / Documento</th><th>Excursões</th><th>Última / Próxima</th><th>Pago</th><th>Saldo</th><th>Ações</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`}`;
}

function filtrarClientes() {
  const q = normalizarBuscaCliente(document.getElementById('searchClientes')?.value || '').trim();
  const filtro = document.getElementById('filterClientes')?.value || '';
  document.querySelectorAll('#tabelaClientes tbody tr').forEach(tr => {
    const busca = tr.dataset.busca || '';
    const saldo = parseFloat(tr.dataset.saldo || 0);
    const recorrente = tr.dataset.recorrente === '1';
    let show = !q || busca.includes(q);
    if (filtro === 'saldo' && saldo <= 0) show = false;
    if (filtro === 'recorrente' && !recorrente) show = false;
    tr.style.display = show ? '' : 'none';
  });
}

async function openModalCliente(key) {
  const clientes = await montarClientes();
  const c = clientes.find(x=>x.key===key);
  if (!c) return Utils.showToast('Cliente não encontrado', 'warn');
  const hoje = Utils.today();
  const rows = c.passageiros.map(({p,exc,fin,tipo,pendentes}) => {
    const vencidas = pendentes.filter(pg => pg.vencimento && pg.vencimento < hoje).length;
    const pendentesNorm = pendentes.length - vencidas;

    let situacao;
    if (fin.saldo <= 0) {
      situacao = '<span class="badge badge-green">Em dia</span>';
    } else {
      const saldoFmt = Utils.formatCurrency(fin.saldo);
      situacao = `<span class="badge badge-orange" style="display:block;margin-bottom:4px">Saldo ${saldoFmt}</span>`;
      if (vencidas > 0) situacao += `<span style="font-size:11px;color:#F04438;font-weight:600">⚠ ${vencidas} parcela${vencidas>1?'s':''} vencida${vencidas>1?'s':''}</span>`;
      if (pendentesNorm > 0) situacao += `${vencidas?'<br>':''}<span style="font-size:11px;color:#F79009">${pendentesNorm} pendente${pendentesNorm>1?'s':''}</span>`;
    }
    return `<tr>
      <td><b>${Utils.escHtml(exc?.nome||'—')}</b><br><span class="text-gray" style="font-size:12px">${Utils.formatDate(exc?.dataSaida)}${exc?.destino?' · '+Utils.escHtml(exc.destino):''}</span></td>
      <td>${Utils.statusBadge(p.status)}<br><span class="badge badge-gray" style="font-size:10px;margin-top:4px">${Utils.escHtml(tipo?.nome||'Adulto')}</span></td>
      <td>${Utils.formatCurrency(fin.valorTotal)}</td>
      <td class="text-green">${Utils.formatCurrency(fin.totalPago)}</td>
      <td>${situacao}</td>
      <td class="td-actions">
        <button class="btn btn-outline btn-sm" onclick="closeModal();navigate('excursao',{excursaoId:'${p.excursaoId}',tab:'passageiros'})">Excursão</button>
        <button class="btn btn-outline btn-sm" onclick="closeModal();openModalPassageiro('${p.excursaoId}','${p.id}')">Editar</button>
        <button class="btn btn-outline btn-sm" onclick="openModalPagamentos('${p.id}','${p.excursaoId}')">Pagtos</button>
      </td>
    </tr>`;
  }).join('');
    const ref = c.passageiros[0]?.p || {};
  openModal(`Cliente — ${Utils.escHtml(c.nome)}`, `

  <!-- Stats -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">
    <div class="stat-card" style="padding:10px 14px;text-align:center">
      <div class="stat-label">Excursões</div>
      <div class="stat-value" style="font-size:22px">${c.excursoes}</div>
    </div>
    <div class="stat-card" style="padding:10px 14px;text-align:center">
      <div class="stat-label">Total</div>
      <div class="stat-value sv-currency" style="font-size:15px">${Utils.formatCurrency(c.total)}</div>
    </div>
    <div class="stat-card" style="padding:10px 14px;text-align:center">
      <div class="stat-label">Pago</div>
      <div class="stat-value green sv-currency" style="font-size:15px">${Utils.formatCurrency(c.pago)}</div>
    </div>
    <div class="stat-card" style="padding:10px 14px;text-align:center">
      <div class="stat-label">Saldo</div>
      <div class="stat-value ${c.saldo>0?'orange':'green'} sv-currency" style="font-size:15px">${Utils.formatCurrency(c.saldo)}</div>
    </div>
  </div>

  <!-- Dados do cliente -->
  <div class="form-section" style="margin-bottom:20px">
    <div class="form-section-header">
      <div class="form-section-icon">👤</div>
      <div>
        <div class="form-section-label">Dados do cliente</div>
        <div class="form-section-sub">Contato e identificação</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 20px;font-size:14px">
      <div><span style="color:var(--gray);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.3px">Nome</span><div style="margin-top:3px;font-weight:600">${Utils.escHtml(c.nome)}</div></div>
      <div><span style="color:var(--gray);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.3px">Telefone</span><div style="margin-top:3px">${c.telefone ? `<a href="${Utils.waLink(c.telefone)}" target="_blank" style="color:var(--blue)">${Utils.escHtml(c.telefone)}</a>` : '—'}</div></div>
      <div><span style="color:var(--gray);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.3px">Documento</span><div style="margin-top:3px">${Utils.escHtml(c.documento||'—')}</div></div>
      <div><span style="color:var(--gray);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.3px">Cidade</span><div style="margin-top:3px">${Utils.escHtml(ref.cidade||'—')}</div></div>
    </div>
  </div>

  <!-- Histórico -->
  <div class="modal-cliente-header">
    <h4>📋 Histórico em excursões</h4>
    <button class="btn btn-primary btn-sm" onclick="openModalAdicionarAExcursao(JSON.parse(this.dataset.d))" data-d='${JSON.stringify({nome:c.nome,telefone:c.telefone,documento:c.documento,cidade:ref.cidade,rg:ref.rg,nascimento:ref.nascimento,emergencia:ref.emergencia,formaPreferida:ref.formaPreferida,observacoes:ref.observacoes})}'>+ Adicionar a Excursão</button>
  </div>
  <div class="table-wrapper"><table>
    <thead><tr><th>Excursão</th><th>Status / Tipo</th><th>Valor</th><th>Pago</th><th>Situação</th><th>Ações</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  `, 'modal-xl');
}

// ── COBRANÇAS ─────────────────────────────────────────────────────────
async function renderCobrancas() {
  const [excursoes, passageiros, pagamentos, tipos] = await Promise.all([
    DB.getAll('excursoes'), DB.getAll('passageiros'),
    DB.getAll('pagamentos'), DB.getAll('tiposPassageiro')
  ]);
  const cfgMsg = await DB.getById('meta','msgCobranca');
  const msgTpl = cfgMsg?.value||'Olá {nome}! Você tem um saldo em aberto de {valor} referente à excursão "{excursao}". Por favor, entre em contato para regularizar. Obrigado!';

  const devedores = [];
  for (const p of passageiros) {
    if (p.status==='cancelado') continue;
    const fin = Utils.calcPassageiroFinanceiro(p, pagamentos);
    if (fin.saldo<=0) continue;
    const exc = excursoes.find(e=>e.id===p.excursaoId);
    devedores.push({p, fin, exc});
  }
  devedores.sort((a,b)=>b.fin.saldo-a.fin.saldo);
  const totalDevido = devedores.reduce((s,d)=>s+d.fin.saldo, 0);
  const excOpts = [{ id:'', nome:'Todas as excursões' }, ...excursoes]
    .map(e=>`<option value="${e.id||''}">${Utils.escHtml(e.nome||'Todas')}</option>`).join('');

  // Parcelas pendentes por passageiro
  const todasParcelas = pagamentos.filter(pg => pg.status==='pendente');

  const rows = devedores.map(({p,fin,exc})=>{
    const waLink     = p.telefone ? Utils.waMsgCobrancaCustom(p.telefone,p.nome,fin.saldo,exc?.nome||'',msgTpl) : null;
    const parcPend   = todasParcelas.filter(pg=>pg.passageiroId===p.id)
      .sort((a,b)=>(a.vencimento||a.data||'9999').localeCompare(b.vencimento||b.data||'9999'));
    const hoje       = Utils.today();
    const parcelasInfo = parcPend.length
      ? `<div style="font-size:11px;margin-top:5px;display:flex;flex-direction:column;gap:2px">
          ${parcPend.map(pg=>{
            const vencida = pg.vencimento && pg.vencimento < hoje;
            return `<span style="color:${vencida?'#F04438':'#F79009'}">
              ${vencida?'Vencida':'Pendente'}: ${Utils.escHtml(pg.parcela||pg.observacao||'Parcela')} · ${Utils.formatDate(pg.vencimento||pg.data)} · ${Utils.formatCurrency(pg.valor)}
            </span>`;
          }).join('')}
        </div>`
      : '';

    const WA_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" style="width:13px;height:13px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.559 4.14 1.535 5.875L.057 23.899l6.224-1.635A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.002-1.373l-.36-.213-3.692.97.985-3.601-.233-.369A9.818 9.818 0 1112 21.818z"/></svg>`;

    // Verifica se ALGUMA parcela pendente está vencida (não só a próxima)
    const temVencida = parcPend.some(pg => pg.vencimento && pg.vencimento < hoje);

    return `<tr data-exc="${p.excursaoId}" data-nome="${Utils.escHtml(p.nome).toLowerCase()}" data-saldo="${fin.saldo}" data-vencida="${temVencida?'1':'0'}">
      <td>
        <b style="cursor:pointer;color:var(--blue)" onclick="openModalPassageiro('${p.excursaoId}','${p.id}')">${Utils.escHtml(p.nome)}</b>
        ${p.telefone?`<br><span class="text-gray" style="font-size:12px">${Utils.escHtml(p.telefone)}</span>`:''}
        ${parcelasInfo}
      </td>
      <td>
        <span class="badge badge-gray" style="cursor:pointer" onclick="navigate('excursao',{excursaoId:'${exc?.id}',tab:'passageiros'})">${Utils.escHtml(exc?.nome||'—')}</span>
      </td>
      <td>${Utils.formatDate(exc?.dataSaida)}</td>
      <td>${Utils.formatCurrency(fin.valorTotal)}</td>
      <td class="text-green">${Utils.formatCurrency(fin.totalPago)}</td>
      <td class="${temVencida?'text-red':'text-orange'} fw-600">${Utils.formatCurrency(fin.saldo)}</td>
      <td class="td-actions" style="gap:4px">
        <button class="btn btn-sm btn-success" onclick="openModalPagamentos('${p.id}','${p.excursaoId}')" title="Registrar pagamento">💰 Pagar</button>
        ${waLink?`<a href="${waLink}" target="_blank" class="btn btn-sm btn-wa" title="Cobrar via WhatsApp">${WA_SVG} WA</a>`:''}
      </td>
    </tr>`;
  }).join('');

  const vencidas  = todasParcelas.filter(pg=>pg.vencimento&&pg.vencimento<Utils.today()).length;
  const proximas7 = todasParcelas.filter(pg=>{
    if(!pg.vencimento) return false;
    const diff = (new Date(pg.vencimento)-new Date())/86400000;
    return diff>=0 && diff<=7;
  }).length;

  return `
  <div class="page-header">
    <div><h1>Cobranças</h1><div class="page-header-sub">Passageiros com saldo em aberto.</div></div>
    <button class="btn btn-outline btn-sm" onclick="navigate('configuracoes')">⚙ Mensagem de cobrança</button>
  </div>
  <div class="stats-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:20px">
    <div class="stat-card"><div class="stat-label">Devedores</div><div class="stat-value red">${devedores.length}</div></div>
    <div class="stat-card"><div class="stat-label">Total em aberto</div><div class="stat-value orange sv-currency">${Utils.formatCurrency(totalDevido)}</div></div>
    <div class="stat-card"><div class="stat-label">Excursões c/ pend.</div><div class="stat-value">${new Set(devedores.map(d=>d.p.excursaoId)).size}</div></div>
    <div class="stat-card"><div class="stat-label">Parcelas vencidas</div><div class="stat-value ${vencidas>0?'red':''}">${vencidas}</div></div>
    <div class="stat-card"><div class="stat-label">Vencem em 7 dias</div><div class="stat-value ${proximas7>0?'orange':''}">${proximas7}</div></div>
  </div>
  <div class="filter-bar mb-16">
    <input class="form-control search-input" id="searchCob" placeholder="Buscar passageiro..." oninput="filtrarCobrancas()" />
    <select class="form-control" id="filterCobExc" onchange="filtrarCobrancas()" style="max-width:200px">${excOpts}</select>
    <select class="form-control" id="filterCobStatus" onchange="filtrarCobrancas()" style="max-width:180px">
      <option value="">Todos os saldos</option>
      <option value="vencido">Com parcela vencida</option>
      <option value="alto">Saldo alto (>R$1.000)</option>
    </select>
  </div>
  ${!devedores.length
    ?`<div class="empty-state"><h3>Nenhum devedor! ✓</h3></div>`
    :`<div class="table-wrapper"><table id="tabelaCobrancas">
        <thead><tr><th>Passageiro</th><th>Excursão</th><th>Data Saída</th><th>Valor</th><th>Pago</th><th>Deve</th><th>Ações</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`
  }`;
}

function filtrarCobrancas() {
  const q      = (document.getElementById('searchCob')?.value||'').toLowerCase();
  const exc    = document.getElementById('filterCobExc')?.value||'';
  const status = document.getElementById('filterCobStatus')?.value||'';
  const hoje   = Utils.today();
  document.querySelectorAll('#tabelaCobrancas tbody tr').forEach(tr=>{
    const nome     = tr.dataset.nome  || '';
    const trExc    = tr.dataset.exc   || '';
    const saldo    = parseFloat(tr.dataset.saldo   || 0);
    const vencida  = tr.dataset.vencida === '1';
    let show = (!q || nome.includes(q)) && (!exc || trExc === exc);
    if (status === 'vencido' && !vencida)    show = false;
    if (status === 'alto'    && saldo <= 1000) show = false;
    tr.style.display = show ? '' : 'none';
  });
}

// ── CONFIGURAÇÕES ─────────────────────────────────────────────────────
// ── CONFIGURAÇÕES ───────────────────────────────────────────────────────────────────
// Estado da aba ativa de configuracoes
window._cfgTab = window._cfgTab || 'licenca';

function cfgNavTab(tab) {
  window._cfgTab = tab;
  navigate('configuracoes');
}

async function renderConfiguracoes() {
  const tab = window._cfgTab || 'licenca';

  const licKey    = License.getKey();
  const licData   = License.getData();
  const licExp    = licData.expires_at ? new Date(licData.expires_at * 1000).toLocaleDateString('pt-BR') : '—';
  const blocked   = License.isBlocked();

  let licStatusHtml;
  if (!licKey)       licStatusHtml = '<span style="color:#888">Não ativada</span>';
  else if (blocked)  licStatusHtml = '<span style="color:#B91C1C;font-weight:600">Bloqueada</span>';
  else               licStatusHtml = '<span style="color:#16A34A;font-weight:600">Ativa</span>';

  let licKeyBox = licKey
    ? '<div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:8px;padding:10px 14px;font-family:monospace;font-size:13px;color:#0369A1;margin-bottom:16px;word-break:break-all">' + Utils.escHtml(licKey) + '</div>'
    : '';
  let licNameRow  = licData.name  ? '<div><label style="font-size:12px;color:#888;display:block;margin-bottom:4px">Licenciado para</label><div style="font-weight:600">' + Utils.escHtml(licData.name)  + '</div></div>' : '';
  let licEmailRow = licData.email ? '<div><label style="font-size:12px;color:#888;display:block;margin-bottom:4px">Email</label><div>' + Utils.escHtml(licData.email) + '</div></div>' : '';
  let licCpfRow   = licData.cpf   ? '<div><label style="font-size:12px;color:#888;display:block;margin-bottom:4px">CPF</label><div>' + Utils.escHtml(licData.cpf) + '</div></div>' : '';
  let revalidBtn  = licKey ? '<button class="btn btn-outline" onclick="licRevalidar()">Revalidar agora</button>' : '';
  let ativarLabel = licKey ? 'Alterar chave' : 'Ativar licenca';

  const cfgMsg   = await DB.getById('meta','msgCobranca');
  const msgAtual = cfgMsg?.value || 'Olá {nome}! Você tem um saldo em aberto de {valor} referente à excursão "{excursao}". Por favor, entre em contato para regularizar. Obrigado!';

  const sAtivo  = 'padding:10px 20px;border:none;background:none;font-size:14px;cursor:pointer;border-bottom:3px solid #2E93B0;font-weight:600;color:#2E93B0;';
  const sInativo = 'padding:10px 20px;border:none;background:none;font-size:14px;cursor:pointer;border-bottom:3px solid transparent;font-weight:500;color:#666;';

  const tabBar =
    '<div style="border-bottom:1px solid #E4E7EC;display:flex;gap:4px;margin-bottom:20px">' +
      '<button style="' + (tab === 'licenca'   ? sAtivo : sInativo) + '" data-cfg-tab="licenca">Licenca</button>' +
      '<button style="' + (tab === 'mensagens' ? sAtivo : sInativo) + '" data-cfg-tab="mensagens">Mensagens</button>' +
    '</div>';

  const tabLicenca = tab === 'licenca'
    ? '<div class="card"><div class="card-body">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">' +
          '<div><label style="font-size:12px;color:#888;display:block;margin-bottom:4px">Status</label><div>' + licStatusHtml + '</div></div>' +
          '<div><label style="font-size:12px;color:#888;display:block;margin-bottom:4px">Expira em</label><div style="font-weight:600">' + licExp + '</div></div>' +
          licNameRow + licEmailRow + licCpfRow +
        '</div>' +
        licKeyBox +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<button class="btn btn-primary" onclick="License.showActivationModal()">' + ativarLabel + '</button>' +
          revalidBtn +
        '</div>' +
      '</div></div>'
    : '';

  const tabMensagens = tab === 'mensagens'
    ? '<div class="card"><div class="card-body">' +
        '<p style="font-size:14px;color:#555;margin:0 0 12px">Variáveis disponíveis:</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">' +
          '<span class="badge badge-blue" style="font-family:monospace">{nome}</span>' +
          '<span class="badge badge-blue" style="font-family:monospace">{valor}</span>' +
          '<span class="badge badge-blue" style="font-family:monospace">{excursao}</span>' +
        '</div>' +
        '<textarea class="form-control" id="inputMsgCobranca" rows="6">' + Utils.escHtml(msgAtual) + '</textarea>' +
        '<div class="text-gray mt-8" style="font-size:12px;margin-bottom:16px">Preview: <i>' +
          msgAtual.replace('{nome}','João').replace('{valor}','R$ 450,00').replace('{excursao}','Gramado Julho') +
        '</i></div>' +
        '<button class="btn btn-primary" onclick="salvarMsgCobranca()">Salvar mensagem</button>' +
      '</div></div>'
    : '';

  const html = '<div class="page-header"><h1>Configurações</h1></div>' +
    '<div style="max-width:720px">' + tabBar + tabLicenca + tabMensagens + '</div>';
  setTimeout(() => {
    document.querySelectorAll('[data-cfg-tab]').forEach(btn => {
      btn.addEventListener('click', () => cfgNavTab(btn.dataset.cfgTab));
    });
  }, 0);
  return html;
}

async function licRevalidar() {
  Utils.showToast('Verificando licença...', 'info');
  await License.check();
  if (!License.isBlocked()) {
    Utils.showToast('Licença válida!', 'success');
    navigateTo('configuracoes');
  }
}


async function salvarMsgCobranca() {
  const msg = document.getElementById('inputMsgCobranca')?.value?.trim();
  if (!msg) return Utils.showToast('Digite uma mensagem','warn');
  await DB.save('meta',{key:'msgCobranca',value:msg});
  Utils.showToast('Mensagem salva!');
}

// ── BACKUP PAGE ───────────────────────────────────────────────────────
async function renderBackup() {
  const [lastBackup, cfg, lastChange, historico, dirMeta] = await Promise.all([
    Backup.lastBackupDate(),
    Backup._getSettings(),
    DB.getById('meta', 'lastDataChangeAt'),
    DB.getAll('backupHistorico'),
    DB.getById('meta', 'backupDirHandle'),
  ]);

  const temPasta   = !!dirMeta?.value;
  const suportaFSA = !!window.showDirectoryPicker;

  // Ordena histórico do mais recente para o mais antigo
  const hist = [...historico].sort((a,b) => b.createdAt.localeCompare(a.createdAt));

  // Status indicador
  const diffDias = lastBackup ? (Date.now()-new Date(lastBackup).getTime())/86400000 : Infinity;
  let statusCls, statusTxt;
  if      (diffDias < 1)    { statusCls='badge-green';  statusTxt='Hoje'; }
  else if (diffDias < 3)    { statusCls='badge-yellow'; statusTxt=`Há ${Math.floor(diffDias)}d`; }
  else if (diffDias < 7)    { statusCls='badge-orange'; statusTxt=`Há ${Math.floor(diffDias)}d`; }
  else                      { statusCls='badge-red';    statusTxt='Atrasado'; }

  // Tipo badges
  const tipoCls = {
    'Manual':              'badge-blue',
    'Automático':          'badge-green',
    'Antes de importar':   'badge-yellow',
    'Antes de excluir':    'badge-orange',
    'Antes de restaurar':  'badge-orange',
    'Backup por excursão': 'badge-gray',
  };

  const histRows = hist.map(h => `
    <div class="backup-hist-item">
      <div class="backup-hist-main">
        <div class="backup-hist-nome">${Utils.escHtml(h.nomeArquivo)}</div>
        <div class="backup-hist-meta">
          <span class="badge ${tipoCls[h.tipo]||'badge-gray'}" style="font-size:11px">${h.tipo}</span>
          <span class="text-gray" style="font-size:12px">${Utils.formatDatetime(h.createdAt)}</span>
          <span class="text-gray" style="font-size:12px">${h.tamanho||''}</span>
          <span class="badge ${h.status==='gerado'?'badge-green':'badge-gray'}" style="font-size:11px">${h.status}</span>
        </div>
      </div>
      <div class="backup-hist-actions">
        ${h.conteudo
          ? `<button class="btn btn-outline btn-sm" onclick="baixarDoHistorico('${h.id}')">↓ Baixar</button>
             <button class="btn btn-outline btn-sm" onclick="Backup.restaurarDoHistorico('${h.id}')">↺ Restaurar</button>`
          : ''}
        <button class="btn btn-sm" style="background:#FEE2E2;color:#B91C1C" onclick="excluirDoHistorico('${h.id}')">✕</button>
      </div>
    </div>`).join('');

  return `
  <div class="page-header">
    <div>
      <h1>Backup de Dados</h1>
      <p class="page-header-sub">Proteção total contra perda de dados</p>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <span class="badge ${statusCls}">Último backup: ${statusTxt}</span>
      <button class="btn btn-primary" onclick="Backup.exportar()">
        <svg viewBox="0 0 24 24"><path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2z"/></svg>
        Fazer backup agora
      </button>
    </div>
  </div>

  <!-- CARDS RÁPIDOS -->
  <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:24px">
    <div class="stat-card">
      <div class="stat-label">Último backup</div>
      <div class="stat-value ${diffDias<1?'green':diffDias<7?'orange':'red'}" style="font-size:16px">${lastBackup?Utils.formatDatetime(lastBackup):'Nunca'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Backup automático</div>
      <div class="stat-value" style="font-size:16px">${cfg.ultimoBackupAutomaticoEm?Utils.formatDatetime(cfg.ultimoBackupAutomaticoEm):'Nunca'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Última alteração</div>
      <div class="stat-value" style="font-size:16px">${lastChange?.value?Utils.formatDatetime(lastChange.value):'—'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Backups salvos</div>
      <div class="stat-value blue">${hist.length} / ${cfg.maxBackups||10}</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start">

    <!-- HISTÓRICO -->
    <div>
      <div class="section-title" style="margin-bottom:14px">Últimos backups</div>
      ${hist.length === 0
        ? `<div class="empty-state" style="padding:32px"><h3>Nenhum backup ainda</h3><p>Faça o primeiro backup agora.</p></div>`
        : `<div class="backup-hist-list">${histRows}</div>`
      }
    </div>

    <!-- SIDEBAR DE CONFIGURAÇÕES + AÇÕES -->
    <div style="display:flex;flex-direction:column;gap:16px">

      <!-- Exportar -->
      <div class="card"><div class="card-body">
        <div class="section-title">Exportar</div>
        <p class="text-gray mt-8" style="font-size:13px">Baixa um arquivo <code>.json</code> com todos os dados.</p>
        <button class="btn btn-primary w-full mt-16" onclick="Backup.exportar()">
          <svg viewBox="0 0 24 24"><path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2z"/></svg>
          Fazer backup agora
        </button>
      </div></div>

      <!-- Importar -->
      <div class="card"><div class="card-body">
        <div class="section-title">Importar</div>
        <p class="text-gray mt-8" style="font-size:13px">Restaura dados de um arquivo <code>.json</code>.</p>
        <p class="text-red mt-4" style="font-size:12px">⚠️ Um backup atual será feito antes de substituir os dados.</p>
        <label class="btn btn-outline w-full mt-16" style="cursor:pointer">
          <svg viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
          Selecionar arquivo .json
          <input type="file" accept=".json" style="display:none" onchange="importarBackupPage(this)"/>
        </label>
      </div></div>

      <!-- Pasta de backup -->
      <div class="card"><div class="card-body">
        <div class="section-title">Pasta de backup</div>
        ${!suportaFSA
          ? `<p class="text-gray mt-8" style="font-size:13px">Seu navegador não suporta seleção de pasta automática. Os backups serão baixados como arquivo.</p>`
          : temPasta
          ? `<p class="text-green mt-8" style="font-size:13px">✓ Pasta configurada. Backups automáticos serão salvos nela.</p>
             <button class="btn btn-outline w-full mt-12" onclick="Backup.escolherPasta()">Trocar pasta</button>`
          : `<p class="text-gray mt-8" style="font-size:13px">Escolha uma pasta para salvar os backups automáticos diretamente.</p>
             <button class="btn btn-outline w-full mt-12" onclick="Backup.escolherPasta()">Escolher pasta de backup</button>`
        }
      </div></div>

      <!-- Configurações -->
      <div class="card"><div class="card-body">
        <div class="section-title">Configurações</div>
        <div class="form-group mt-12">
          <label class="form-label" style="display:flex;justify-content:space-between;align-items:center">
            Backup automático
            <label class="toggle-switch">
              <input type="checkbox" id="cfgAutoAtivo" ${cfg.automaticoAtivo?'checked':''} onchange="salvarCfgBackup()"/>
              <span class="toggle-thumb"></span>
            </label>
          </label>
        </div>
        <div class="form-group">
          <label class="form-label">Frequência</label>
          <select class="form-control" id="cfgFreq" onchange="salvarCfgBackup()">
            <option value="diario"  ${cfg.frequencia==='diario' ?'selected':''}>Diário</option>
            <option value="3dias"   ${cfg.frequencia==='3dias'  ?'selected':''}>A cada 3 dias</option>
            <option value="semanal" ${cfg.frequencia==='semanal'?'selected':''}>Semanal</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Máx. backups guardados</label>
          <input class="form-control" type="number" id="cfgMax" min="3" max="30" value="${cfg.maxBackups||10}" onchange="salvarCfgBackup()"/>
        </div>
        <div class="form-group">
          <label class="form-label" style="display:flex;justify-content:space-between;align-items:center">
            Salvar conteúdo no histórico
            <label class="toggle-switch">
              <input type="checkbox" id="cfgConteudo" ${cfg.salvarConteudoNoHistorico?'checked':''} onchange="salvarCfgBackup()"/>
              <span class="toggle-thumb"></span>
            </label>
          </label>
          <div class="form-hint">Permite baixar/restaurar direto da lista acima.</div>
        </div>
      </div></div>

    </div>
  </div>

  <div class="backup-info-card mt-24">
    <div class="fw-600 mb-8">ℹ️ Sobre o armazenamento</div>
    <p style="font-size:14px;color:#667085">Todos os dados ficam no <b>navegador</b> deste computador (IndexedDB). Se limpar o cache ou trocar de computador, os dados serão perdidos. Exporte o backup regularmente e guarde em local seguro.</p>
  </div>`;
}

async function salvarCfgBackup() {
  const cfg = await Backup._getSettings();
  cfg.automaticoAtivo           = document.getElementById('cfgAutoAtivo')?.checked ?? true;
  cfg.frequencia                = document.getElementById('cfgFreq')?.value || 'diario';
  cfg.maxBackups                = parseInt(document.getElementById('cfgMax')?.value) || 10;
  cfg.salvarConteudoNoHistorico = document.getElementById('cfgConteudo')?.checked ?? true;
  await Backup._saveSettings(cfg);
  Utils.showToast('Configurações salvas!');
}

async function baixarDoHistorico(id) {
  const item = await DB.getById('backupHistorico', id);
  if (!item?.conteudo) { Utils.showToast('Conteúdo não disponível.', 'warn'); return; }
  const blob = new Blob([item.conteudo], { type: 'application/json' });
  Utils.downloadBlob(blob, item.nomeArquivo);
  Utils.showToast('Arquivo baixado!');
}

async function excluirDoHistorico(id) {
  if (!confirm('Remover este item do histórico?')) return;
  await DB.remove('backupHistorico', id);
  Utils.showToast('Removido do histórico');
  navigate('backup');
}


async function importarBackupPage(input) {
  if (!input.files[0]) return;
  const file = input.files[0];
  input.value = '';
  await Backup.modalBackupObrigatorio('Antes de importar', async () => {
    await Backup.importar(file);
    navigate('dashboard');
  });
}

// ── IMPRIMIR / CSV ────────────────────────────────────────────────────
// ── AUDITORIA FINANCEIRA ──────────────────────────────────────────────
// Detecta inconsistências financeiras e operacionais:
// 1) Pagamentos "pago" que somam mais que o valor total do passageiro
// 2) Parcelas "pendentes" cujo valor coincide com um pagamento "pago"
//    já lançado (possível duplicidade)
// 3) Passageiro confirmado com valor zerado/não definido
// 4) Soma de pagamentos pendentes + pagos não bate com o valor final
//    (parcelamento desencontrado após edição do passageiro)
// 5) Parcela pendente vencida há muito tempo (inadimplência)
// 6) Passageiro confirmado sem nenhum pagamento, com a excursão próxima
// 7) Custo da excursão com vencimento passado e ainda não pago
async function calcularAuditoria() {
  const [excursoes, passageiros, pagamentos, contas, tipos] = await Promise.all([
    DB.getAll('excursoes'), DB.getAll('passageiros'), DB.getAll('pagamentos'),
    DB.getAll('contas'), DB.getAll('tiposPassageiro')
  ]);

  const achados = [];
  const hoje = Utils.today();
  const DIAS_VENCIDA_LONGA = 30; // limiar para "inadimplência grave"
  const DIAS_PROXIMO_SAIDA = 15; // limiar para "excursão próxima"

  for (const p of passageiros) {
    if (p.status === 'cancelado') continue;
    const fin = Utils.calcPassageiroFinanceiro(p, pagamentos);
    const exc = excursoes.find(e => e.id === p.excursaoId);
    const pagsPass = pagamentos.filter(pg => pg.passageiroId === p.id && pg.status !== 'estornado');
    const tipo = Utils.getTipo(p.tipoPassageiroId, tipos);

    // 1) Pago acima do valor total (saldo negativo)
    if (fin.saldo < -0.009) {
      achados.push({
        tipo: 'pago_acima',
        severidade: 'alta',
        p, exc, fin,
        descricao: `Total pago (${Utils.formatCurrency(fin.totalPago)}) é maior que o valor total (${Utils.formatCurrency(fin.valorTotal)}). Diferença: ${Utils.formatCurrency(Math.abs(fin.saldo))}.`,
      });
    }

    // 2) Parcela pendente com valor igual a um pagamento "pago" já lançado
    //    (possível duplicidade: usuário pagou pelo form em vez de "✓ Pagar")
    // Pareamento 1:1 — cada pagamento "pago" só pode ser usado uma vez como
    // correspondente de uma parcela pendente, mesmo que vários valores coincidam.
    const pendentes = pagsPass.filter(pg => pg.status === 'pendente')
      .sort((a,b)=>(a.vencimento||a.data||'9999').localeCompare(b.vencimento||b.data||'9999'));
    const pagosDisponiveis = pagsPass.filter(pg => pg.status === 'pago').slice();
    const usadosComoDuplicado = new Set();

    for (const pend of pendentes) {
      const valorPend = (parseFloat(pend.valor) || 0).toFixed(2);
      const idx = pagosDisponiveis.findIndex(pg => (parseFloat(pg.valor) || 0).toFixed(2) === valorPend);
      if (idx === -1) continue;
      const possivelDuplicado = pagosDisponiveis.splice(idx, 1)[0];
      usadosComoDuplicado.add(pend.id);

      achados.push({
        tipo: 'duplicidade',
        severidade: 'media',
        p, exc, fin,
        descricao: `Parcela "${Utils.escHtml(pend.parcela || pend.observacao || 'pendente')}" (${Utils.formatCurrency(pend.valor)}, vence ${Utils.formatDate(pend.vencimento)}) está pendente, mas existe um pagamento "pago" de mesmo valor (${Utils.escHtml(possivelDuplicado.observacao || possivelDuplicado.parcela || '')}, em ${Utils.formatDate(possivelDuplicado.data)}). Pode ser pagamento duplicado.`,
        pagamentoPendenteId: pend.id,
        pagamentoPagoId: possivelDuplicado.id,
      });
    }

    // Só faz sentido analisar os próximos itens para quem entra no financeiro
    if (!tipo.pagante && !tipo.entraNoFinanceiro) continue;

    // 3) Passageiro confirmado com valor total zerado/não definido
    if (p.status === 'confirmado' && fin.valorTotal <= 0) {
      achados.push({
        tipo: 'valor_zerado',
        severidade: 'media',
        p, exc, fin,
        descricao: `Passageiro está "confirmado" mas o valor total cadastrado é ${Utils.formatCurrency(fin.valorTotal)}. Provavelmente o valor do pacote não foi preenchido.`,
      });
    }

    // 4) Soma de parcelas (pendentes + pagas, origem parcelamento/entrada)
    //    não bate com o valor final do passageiro
    const pagsParcelamento = pagsPass.filter(pg => pg.origem === 'parcelamento' || pg.origem === 'entrada');
    if (pagsParcelamento.length) {
      const somaParcelas = pagsParcelamento.reduce((s,pg)=>s+(parseFloat(pg.valor)||0), 0);
      const diff = fin.valorTotal - somaParcelas;
      if (Math.abs(diff) > 0.5) {
        achados.push({
          tipo: 'parcelamento_desencontrado',
          severidade: 'media',
          p, exc, fin,
          descricao: `A soma das parcelas/entrada (${Utils.formatCurrency(somaParcelas)}) não coincide com o valor final do passageiro (${Utils.formatCurrency(fin.valorTotal)}). Diferença: ${Utils.formatCurrency(diff)}. Pode ter ocorrido edição do valor após o parcelamento já ter sido gerado.`,
        });
      }
    }

    // 5) Parcela pendente vencida há muito tempo (inadimplência grave)
    const vencidasLongas = pendentes.filter(pg => {
      if (usadosComoDuplicado.has(pg.id)) return false; // já tratado no achado de duplicidade
      if (!pg.vencimento || pg.vencimento >= hoje) return false;
      const dias = Math.floor((new Date(hoje) - new Date(pg.vencimento)) / 86400000);
      return dias >= DIAS_VENCIDA_LONGA;
    });
    if (vencidasLongas.length) {
      const maisAntiga = vencidasLongas.sort((a,b)=>a.vencimento.localeCompare(b.vencimento))[0];
      const dias = Math.floor((new Date(hoje) - new Date(maisAntiga.vencimento)) / 86400000);
      const valorVencido = vencidasLongas.reduce((s,pg)=>s+(parseFloat(pg.valor)||0),0);
      achados.push({
        tipo: 'inadimplencia',
        severidade: 'media',
        p, exc, fin,
        descricao: `${vencidasLongas.length} parcela(s) vencida(s) há mais de ${DIAS_VENCIDA_LONGA} dias (a mais antiga venceu há ${dias} dias, em ${Utils.formatDate(maisAntiga.vencimento)}). Total vencido: ${Utils.formatCurrency(valorVencido)}.`,
      });
    }

    // 6) Passageiro confirmado sem nenhum pagamento, com excursão próxima
    if (p.status === 'confirmado' && fin.valorTotal > 0 && fin.totalPago <= 0 && exc?.dataSaida) {
      const diasParaSaida = Math.floor((new Date(exc.dataSaida) - new Date(hoje)) / 86400000);
      if (diasParaSaida >= 0 && diasParaSaida <= DIAS_PROXIMO_SAIDA) {
        achados.push({
          tipo: 'sem_pagamento_proximo',
          severidade: 'media',
          p, exc, fin,
          descricao: `Passageiro confirmado, sem nenhum pagamento registrado, e a excursão "${Utils.escHtml(exc?.nome||'')}" sai em ${diasParaSaida} dia(s) (${Utils.formatDate(exc.dataSaida)}). Valor total: ${Utils.formatCurrency(fin.valorTotal)}.`,
        });
      }
    }
  }

  // 7) Custos da excursão vencidos e não pagos
  for (const c of contas) {
    if (c.status === 'pago' || !c.vencimento || c.vencimento >= hoje) continue;
    const exc = excursoes.find(e => e.id === c.excursaoId);
    const dias = Math.floor((new Date(hoje) - new Date(c.vencimento)) / 86400000);
    const valorCalc = Utils.calcularValorConta(
      c,
      passageiros.filter(pp => pp.excursaoId === c.excursaoId && pp.status !== 'cancelado'),
      tipos
    );
    achados.push({
      tipo: 'custo_vencido',
      severidade: 'media',
      exc, conta: c,
      descricao: `Custo "${Utils.escHtml(c.nome)}"${c.categoria?` (${Utils.escHtml(c.categoria)})`:''} da excursão "${Utils.escHtml(exc?.nome||'')}" está vencido há ${dias} dia(s) (venceu em ${Utils.formatDate(c.vencimento)}) e ainda não foi marcado como pago. Valor: ${Utils.formatCurrency(valorCalc)}.`,
    });
  }

  // 8) Clientes duplicados — mesmo CPF ou mesmo telefone em passageiros diferentes
  // Agrupa por doc (normalizado) e por tel (normalizado), depois cruza
  const normDoc = s => String(s||'').replace(/\D/g,'');
  const normTel = s => String(s||'').replace(/\D/g,'');

  const porDoc = {}; // doc → [passageiro]
  const porTel = {}; // tel → [passageiro]

  for (const p of passageiros) {
    if (p.status === 'cancelado') continue;
    if (p.excursaoId === '__sem_excursao__') continue;
    const doc = normDoc(p.documento || p.cpf);
    const tel = normTel(p.telefone || p.whatsapp);
    if (doc) { if (!porDoc[doc]) porDoc[doc] = []; porDoc[doc].push(p); }
    if (tel) { if (!porTel[tel]) porTel[tel] = []; porTel[tel].push(p); }
  }

  const gruposDuplicados = {}; // chave → Set de passageiros
  const _addGrupo = (chave, lista) => {
    if (lista.length < 2) return;
    // verifica se são passageiros DIFERENTES (ids distintos)
    const ids = [...new Set(lista.map(p => p.id))];
    if (ids.length < 2) return;
    if (!gruposDuplicados[chave]) gruposDuplicados[chave] = new Set();
    for (const p of lista) gruposDuplicados[chave].add(p);
  };

  for (const [doc, lista] of Object.entries(porDoc)) if (doc) _addGrupo('doc:'+doc, lista);
  for (const [tel, lista] of Object.entries(porTel)) if (tel) _addGrupo('tel:'+tel, lista);

  // Para cada grupo, gera um achado por par único de passageiros
  // Carrega pares que o usuário pediu para ignorar
  const metaIgnorados = await DB.getById('meta', 'duplicadosIgnorados');
  const paresIgnorados = new Set(metaIgnorados?.value || []);

  const paresVistos = new Set();
  for (const [chave, passSet] of Object.entries(gruposDuplicados)) {
    const lista = [...passSet];
    for (let i = 0; i < lista.length; i++) {
      for (let j = i+1; j < lista.length; j++) {
        const a = lista[i], b = lista[j];
        const parKey = [a.id, b.id].sort().join('|');
        if (paresVistos.has(parKey)) continue;
        if (paresIgnorados.has(parKey)) continue;
        paresVistos.add(parKey);
        const excA = excursoes.find(e => e.id === a.excursaoId);
        const excB = excursoes.find(e => e.id === b.excursaoId);
        const motivo = chave.startsWith('doc:') ? 'mesmo CPF/documento' : 'mesmo telefone';
        achados.push({
          tipo: 'cliente_duplicado',
          severidade: 'media',
          pA: a, excA,
          pB: b, excB,
          // compatibilidade com linhaPassageiro genérica — usa pA como referência
          p: a, exc: excA,
          fin: Utils.calcPassageiroFinanceiro(a, pagamentos),
          descricao: `"${Utils.escHtml(a.nome)}" e "${Utils.escHtml(b.nome)}" parecem ser a mesma pessoa (${motivo}). Estão cadastrados em excursões diferentes. Unifique para manter um único cadastro.`,
        });
      }
    }
  }

  // Identificador único e estável para cada achado (usado nos checkboxes)
  achados.forEach((a, i) => { a.uid = `aud_${i}`; });

  return achados;
}


async function renderAuditoria() {
  if (!window._auditoriaAbaAtiva) window._auditoriaAbaAtiva = 'todas';
  const achados = await calcularAuditoria();
  // Guarda os achados na memória da sessão para uso nas ações em lote
  window._auditoriaAchados = achados;

  const porTipo = (tipo) => achados.filter(a => a.tipo === tipo);

  const pagoAcima      = porTipo('pago_acima');
  const duplicidades   = porTipo('duplicidade');
  const valorZerado    = porTipo('valor_zerado');
  const parcelDesenc   = porTipo('parcelamento_desencontrado');
  const inadimplencia  = porTipo('inadimplencia');
  const semPagamento   = porTipo('sem_pagamento_proximo');
  const custoVencido      = porTipo('custo_vencido');
  const clienteDuplicado  = porTipo('cliente_duplicado');

  const acoesPorTipo = {
    duplicidade: (a) => `
      <input type="checkbox" class="auditoria-check" data-uid="${a.uid}" style="margin-top:4px;width:16px;height:16px;flex-shrink:0"/>`,
  };

  const botoesPorTipo = {
    duplicidade: (a) => `
      <button class="btn btn-sm" style="background:#FEE2E2;color:#B91C1C;white-space:nowrap" onclick="resolverDuplicidadeAuditoria('${a.uid}')">Unificar duplicação</button>`,
    pago_acima: (a) => `
      <button class="btn btn-sm" style="background:#FEE2E2;color:#B91C1C;white-space:nowrap" onclick="abrirCorrigirSaldoAuditoria('${a.uid}')">Corrigir saldo</button>`,
    cliente_duplicado: (a) => `
      <button class="btn btn-sm" style="background:#FEF3C7;color:#92400E;white-space:nowrap" onclick="abrirUnificadorClientes('${a.uid}')">Unificar clientes</button>`,
  };

  // Renderiza um achado ligado a um passageiro
  const linhaPassageiro = (a) => `
    <div class="card mb-16" data-uid="${a.uid}"><div class="card-body">
      <div class="flex-between" style="align-items:flex-start;flex-wrap:wrap;gap:12px">
        <div style="display:flex;gap:10px;align-items:flex-start">
          ${acoesPorTipo[a.tipo] ? acoesPorTipo[a.tipo](a) : '<span style="width:16px;display:inline-block"></span>'}
          <div>
            <b style="cursor:pointer;color:var(--blue)" onclick="openModalPassageiro('${a.p.excursaoId}','${a.p.id}')">${Utils.escHtml(a.p.nome)}</b>
            <span class="badge badge-gray" style="margin-left:6px;font-size:11px">${Utils.escHtml(a.exc?.nome || '—')}</span>
            <div style="font-size:13px;margin-top:6px;color:#475467">${a.descricao}</div>
            <div style="font-size:12px;margin-top:6px;color:#667085">
              Valor total: ${Utils.formatCurrency(a.fin.valorTotal)} ·
              Pago: ${Utils.formatCurrency(a.fin.totalPago)} ·
              Saldo: <span class="${a.fin.saldo>=0?'':'text-red'} fw-600">${Utils.formatCurrency(a.fin.saldo)}</span>
            </div>
          </div>
        </div>
        <div style="display:flex;flex-direction:row;gap:8px;flex-shrink:0;flex-wrap:wrap;align-items:flex-start">
          <button class="btn btn-outline btn-sm" style="white-space:nowrap" onclick="openModalPagamentos('${a.p.id}','${a.p.excursaoId}')">Ver pagamentos</button>
          ${botoesPorTipo[a.tipo] ? botoesPorTipo[a.tipo](a) : ''}
        </div>
      </div>
    </div></div>`;

  // Renderiza um achado de clientes duplicados (dois passageiros lado a lado)
  const linhaDuplicadoCliente = (a) => `
    <div class="card mb-16" data-uid="${a.uid}"><div class="card-body">
      <div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="font-size:12px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.3px;margin-bottom:6px">Passageiro A</div>
          <b style="color:var(--blue)">${Utils.escHtml(a.pA.nome)}</b>
          <div style="font-size:12px;color:var(--gray);margin-top:3px">
            ${a.pA.telefone ? '📞 '+Utils.escHtml(a.pA.telefone)+'<br>' : ''}
            ${a.pA.documento ? '🪪 '+Utils.escHtml(a.pA.documento)+'<br>' : ''}
            Excursão: <b>${Utils.escHtml(a.excA?.nome||'—')}</b>
          </div>
        </div>
        <div style="display:flex;align-items:center;padding:0 8px;color:var(--gray);font-size:20px">⟷</div>
        <div style="flex:1;min-width:200px">
          <div style="font-size:12px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.3px;margin-bottom:6px">Passageiro B</div>
          <b style="color:var(--blue)">${Utils.escHtml(a.pB.nome)}</b>
          <div style="font-size:12px;color:var(--gray);margin-top:3px">
            ${a.pB.telefone ? '📞 '+Utils.escHtml(a.pB.telefone)+'<br>' : ''}
            ${a.pB.documento ? '🪪 '+Utils.escHtml(a.pB.documento)+'<br>' : ''}
            Excursão: <b>${Utils.escHtml(a.excB?.nome||'—')}</b>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;flex-shrink:0">
          <button class="btn btn-sm" style="background:#FEF3C7;color:#92400E;white-space:nowrap" onclick="abrirUnificadorClientes('${a.uid}')">Unificar clientes</button>
          <button class="btn btn-sm btn-outline" style="white-space:nowrap" onclick="ignorarDuplicadoCliente('${a.pA.id}','${a.pB.id}')">Manter ambos</button>
        </div>
      </div>
      <div style="font-size:12px;margin-top:10px;color:#667085;border-top:1px solid var(--border);padding-top:8px">${a.descricao}</div>
    </div></div>`;

  // Renderiza um achado ligado a uma conta/custo da excursão (sem passageiro)
  const linhaConta = (a) => `
    <div class="card mb-16" data-uid="${a.uid}"><div class="card-body">
      <div class="flex-between" style="align-items:flex-start;flex-wrap:wrap;gap:12px">
        <div>
          <b style="cursor:pointer;color:var(--blue)" onclick="navigate('excursao',{excursaoId:'${a.exc?.id}',tab:'contas'})">${Utils.escHtml(a.exc?.nome || '—')}</b>
          <span class="badge badge-gray" style="margin-left:6px;font-size:11px">${Utils.escHtml(a.conta?.categoria || '')}</span>
          <div style="font-size:13px;margin-top:6px;color:#475467">${a.descricao}</div>
        </div>
        <div style="display:flex;flex-direction:row;gap:8px;flex-shrink:0;flex-wrap:wrap;align-items:flex-start">
          <button class="btn btn-outline btn-sm" style="white-space:nowrap" onclick="navigate('excursao',{excursaoId:'${a.exc?.id}',tab:'contas'})">Ver custos</button>
        </div>
      </div>
    </div></div>`;

  // Definição das seções na ordem de exibição
  const secoesFinal = [
    { lista: pagoAcima,        titulo: 'Pago acima do valor total',                              render: linhaPassageiro,       batch: false, _tipo: 'pago_acima' },
    { lista: duplicidades,     titulo: 'Possíveis pagamentos duplicados',                        render: linhaPassageiro,       batch: true,  _tipo: 'duplicidade' },
    { lista: valorZerado,      titulo: 'Confirmados sem valor cadastrado',                       render: linhaPassageiro,       batch: false, _tipo: 'valor_zerado' },
    { lista: parcelDesenc,     titulo: 'Parcelamento desencontrado do valor',                    render: linhaPassageiro,       batch: false, _tipo: 'parcelamento_desencontrado' },
    { lista: semPagamento,     titulo: 'Confirmados sem pagamento, excursão próxima',            render: linhaPassageiro,       batch: false, _tipo: 'sem_pagamento_proximo' },
    { lista: inadimplencia,    titulo: 'Inadimplência grave (parcelas vencidas há +30 dias)',    render: linhaPassageiro,       batch: false, _tipo: 'inadimplencia' },
    { lista: custoVencido,     titulo: 'Custos da excursão vencidos e não pagos',                render: linhaConta,            batch: false, _tipo: 'custo_vencido' },
    { lista: clienteDuplicado, titulo: 'Possíveis clientes duplicados',                          render: linhaDuplicadoCliente, batch: false, _tipo: 'cliente_duplicado' },
  ];

  const secoesComItens = secoesFinal.filter(s => s.lista.length);

  const secaoHtml = (s) => `
    <div class="flex-between mt-24 mb-8" style="flex-wrap:wrap;gap:8px">
      <div class="section-title" style="margin:0">${s.titulo} (${s.lista.length})</div>
      ${s.batch ? `
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
          <input type="checkbox" class="chkSelecionarTodosAuditoria" onchange="toggleSelecionarTodosAuditoria(this)"/> Selecionar todos
        </label>
        <button class="btn btn-sm" style="background:#FEE2E2;color:#B91C1C" onclick="resolverSelecionadosAuditoria()">
          Resolver selecionados
        </button>
      </div>` : ''}
    </div>
    ${s.lista.map(s.render).join('')}`;

  // Agrupa seções por aba
  const todasAbas = [
    { id: 'todas',      label: 'Todas',              secoes: secoesFinal },
    { id: 'financeiro', label: 'Financeiro',          secoes: secoesFinal.filter(s => ['pago_acima','duplicidade','valor_zerado','parcelamento_desencontrado'].includes(s._tipo)) },
    { id: 'cobranca',   label: 'Inadimplência',       secoes: secoesFinal.filter(s => ['inadimplencia','sem_pagamento_proximo'].includes(s._tipo)) },
    { id: 'custos',     label: 'Custos',              secoes: secoesFinal.filter(s => s._tipo === 'custo_vencido') },
    { id: 'clientes',   label: 'Clientes duplicados', secoes: secoesFinal.filter(s => s._tipo === 'cliente_duplicado') },
  ];


  const abaAtiva = window._auditoriaAbaAtiva || 'todas';

  const abaTabsHtml = todasAbas.map(aba => {
    const count = aba.id === 'todas'
      ? achados.length
      : aba.secoes.reduce((s, sec) => s + sec.lista.length, 0);
    const isAtiva = aba.id === abaAtiva;
    return `<button class="tab-btn ${isAtiva ? 'active' : ''}" onclick="navegarAbaAuditoria('${aba.id}')">${aba.label}${count > 0 ? ` <span style="background:${isAtiva?'var(--blue)':'#e5e7eb'};color:${isAtiva?'#fff':'var(--gray)'};border-radius:99px;padding:1px 7px;font-size:11px;font-weight:700;margin-left:4px">${count}</span>` : ''}</button>`;
  }).join('');

  const secoesAtivas = abaAtiva === 'todas'
    ? secoesComItens
    : (todasAbas.find(a => a.id === abaAtiva)?.secoes || []).filter(s => s.lista.length);

  return `
  <div class="page-header">
    <div><h1>Auditoria Financeira</h1><div class="page-header-sub">Painel de verificações financeiras e operacionais. As ações em lote pedem confirmação antes de alterar qualquer dado.</div></div>
    <button class="btn btn-outline btn-sm" onclick="window._auditoriaAbaAtiva='todas';navigate('auditoria')">↻ Atualizar</button>
  </div>
  <div class="stats-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:20px">
    <div class="stat-card"><div class="stat-label">Total de achados</div><div class="stat-value ${achados.length?'orange':'green'}">${achados.length}</div></div>
    <div class="stat-card"><div class="stat-label">Saldo negativo</div><div class="stat-value ${pagoAcima.length?'red':'green'}">${pagoAcima.length}</div></div>
    <div class="stat-card"><div class="stat-label">Possíveis duplicidades</div><div class="stat-value ${duplicidades.length?'orange':'green'}">${duplicidades.length}</div></div>
    <div class="stat-card"><div class="stat-label">Inadimplência grave</div><div class="stat-value ${inadimplencia.length?'red':'green'}">${inadimplencia.length}</div></div>
    <div class="stat-card"><div class="stat-label">Clientes duplicados</div><div class="stat-value ${clienteDuplicado.length?'orange':'green'}">${clienteDuplicado.length}</div></div>
  </div>
  <div class="tabs" style="margin-bottom:0">${abaTabsHtml}</div>
  <div style="margin-top:20px">
  ${!achados.length
    ? `<div class="empty-state"><h3>Nenhuma inconsistência encontrada ✓</h3></div>`
    : !secoesAtivas.length
      ? `<div class="empty-state"><h3>Nenhum item nesta categoria ✓</h3></div>`
      : secoesAtivas.map(secaoHtml).join('')
  }
  </div>`
}

function navegarAbaAuditoria(abaId) {
  window._auditoriaAbaAtiva = abaId;
  // Re-renderiza sem recalcular — usa os achados já calculados
  const el = document.getElementById('mainContent');
  if (!el) return;
  renderAuditoria().then(html => { el.innerHTML = html; });
}
window.navegarAbaAuditoria = navegarAbaAuditoria;

function toggleSelecionarTodosAuditoria(chkTodos) {
  // Marca/desmarca todos os checkboxes de auditoria visíveis na página
  document.querySelectorAll('.auditoria-check').forEach(chk => { chk.checked = chkTodos.checked; });
  // Mantém os outros "Selecionar todos" sincronizados visualmente
  document.querySelectorAll('.chkSelecionarTodosAuditoria').forEach(c => { if (c!==chkTodos) c.checked = chkTodos.checked; });
}

// Marca a parcela pendente como paga (com os dados do pagamento já lançado)
// e remove o registro duplicado. Pede confirmação antes.
async function resolverDuplicidadeAuditoria(uid) {
  const achado = (window._auditoriaAchados || []).find(a => a.uid === uid);
  if (!achado) { Utils.showToast('Item não encontrado. Atualize a página.', 'warn'); return; }

  const ok = confirm(
    `Confirma a correção?\n\n` +
    `Passageiro: ${achado.p.nome}\n\n` +
    `${achado.descricao}\n\n` +
    `A parcela pendente será marcada como PAGA (com data/forma do pagamento já lançado) e o registro duplicado será EXCLUÍDO.\n\n` +
    `Esta ação não pode ser desfeita automaticamente.`
  );
  if (!ok) return;

  await aplicarCorrecaoAuditoria(achado);
  DB.marcarAlteracao();
  Utils.showToast('Inconsistência corrigida!');
  navigate('auditoria');
}

async function resolverSelecionadosAuditoria() {
  const checks = [...document.querySelectorAll('.auditoria-check:checked')];
  if (!checks.length) { Utils.showToast('Selecione ao menos um item.', 'warn'); return; }

  const achados = window._auditoriaAchados || [];
  const selecionados = checks
    .map(chk => achados.find(a => a.uid === chk.dataset.uid))
    .filter(Boolean);

  if (!selecionados.length) { Utils.showToast('Itens não encontrados. Atualize a página.', 'warn'); return; }

  const ok = confirm(
    `Confirma a correção de ${selecionados.length} item(ns)?\n\n` +
    `Para cada um: a parcela pendente será marcada como PAGA (com data/forma do pagamento já lançado) e o registro duplicado será EXCLUÍDO.\n\n` +
    `Esta ação não pode ser desfeita automaticamente.`
  );
  if (!ok) return;

  let ok_ = 0, falhas = 0;
  for (const achado of selecionados) {
    try {
      await aplicarCorrecaoAuditoria(achado);
      ok_++;
    } catch (e) {
      falhas++;
    }
  }
  DB.marcarAlteracao();
  Utils.showToast(falhas
    ? `${ok_} corrigido(s), ${falhas} com erro.`
    : `${ok_} inconsistência(s) corrigida(s)!`);
  navigate('auditoria');
}

// Aplica a correção de um achado de duplicidade no banco.
// Lança erro se os registros não existirem mais (já corrigidos/excluídos antes).
async function aplicarCorrecaoAuditoria(achado) {
  const [pendente, duplicado] = await Promise.all([
    DB.getById('pagamentos', achado.pagamentoPendenteId),
    DB.getById('pagamentos', achado.pagamentoPagoId),
  ]);
  if (!pendente || !duplicado) throw new Error('Registro não encontrado');

  pendente.status = 'pago';
  pendente.data   = duplicado.data || Utils.today();
  pendente.forma  = duplicado.forma || pendente.forma;
  await DB.save('pagamentos', pendente);
  await DB.remove('pagamentos', duplicado.id);
}



// ── CORREÇÃO DE SALDO NEGATIVO (PAGO A MAIS) ──────────────────────────
// Abre um modal listando os pagamentos "pago" do passageiro, permitindo
// converter algum deles para "pendente" (estorno/saldo a receber) até o
// saldo deixar de ser negativo.
async function abrirCorrigirSaldoAuditoria(uid) {
  const achado = (window._auditoriaAchados || []).find(a => a.uid === uid);
  if (!achado) { Utils.showToast('Item não encontrado. Atualize a página.', 'warn'); return; }

  const todosPags = await DB.getAll('pagamentos');
  const pagos = todosPags
    .filter(pg => pg.passageiroId === achado.p.id && pg.status === 'pago')
    .sort((a,b)=>(a.data||'').localeCompare(b.data||''));

  const rows = pagos.map(pg => `
    <tr>
      <td>${Utils.formatDate(pg.data)}</td>
      <td class="text-green fw-600">${Utils.formatCurrency(pg.valor)}</td>
      <td>${Utils.escHtml(pg.forma||'')}</td>
      <td>${Utils.escHtml(pg.observacao||'')}${pg.parcela?`<br><span style="font-size:11px;color:#667085">${Utils.escHtml(pg.parcela)}</span>`:''}</td>
      <td class="td-actions">
        <button class="btn btn-sm" style="background:#FEF3C7;color:#92400E" onclick="corrigirSaldoMarcarPendente('${pg.id}','${uid}')">Voltar p/ pendente</button>
        <button class="btn btn-sm" style="background:#FEE2E2;color:#B91C1C" onclick="corrigirSaldoExcluirPagamento('${pg.id}','${uid}')">Excluir</button>
      </td>
    </tr>`).join('');

  openModal(`Corrigir saldo — ${Utils.escHtml(achado.p.nome)}`, `
    <div class="fin-msg danger" style="margin-bottom:12px">${achado.descricao}</div>
    <p style="font-size:13px;color:#475467;margin-bottom:12px">
      Escolha um dos pagamentos abaixo para corrigir o saldo:<br>
      <b>"Voltar p/ pendente"</b> marca o pagamento como pendente (vira saldo a receber novamente — use se o pagamento foi lançado por engano e o cliente ainda deve esse valor).<br>
      <b>"Excluir"</b> remove o registro do pagamento (use se ele nunca deveria ter existido, por exemplo um lançamento duplicado).
    </p>
    ${pagos.length
      ? `<div class="table-wrapper"><table>
          <thead><tr><th>Data</th><th>Valor</th><th>Forma</th><th>Obs / Parcela</th><th></th></tr></thead>
          <tbody>${rows}</tbody></table></div>`
      : '<p class="text-gray">Nenhum pagamento "pago" encontrado.</p>'
    }
  `, 'modal-lg');
}

async function corrigirSaldoMarcarPendente(pagId, uid) {
  const pag = await DB.getById('pagamentos', pagId);
  if (!pag) { Utils.showToast('Pagamento não encontrado.', 'warn'); return; }
  const ok = confirm(
    `Confirma?\n\nO pagamento de ${Utils.formatCurrency(pag.valor)} (${Utils.formatDate(pag.data)}) ` +
    `voltará para status PENDENTE — o valor passa a contar como saldo a receber novamente.`
  );
  if (!ok) return;
  pag.status = 'pendente';
  await DB.save('pagamentos', pag);
  DB.marcarAlteracao();
  Utils.showToast('Pagamento marcado como pendente!');
  closeModal();
  navigate('auditoria');
}

async function corrigirSaldoExcluirPagamento(pagId, uid) {
  const pag = await DB.getById('pagamentos', pagId);
  if (!pag) { Utils.showToast('Pagamento não encontrado.', 'warn'); return; }
  const ok = confirm(
    `Confirma?\n\nO pagamento de ${Utils.formatCurrency(pag.valor)} (${Utils.formatDate(pag.data)}) será EXCLUÍDO permanentemente.\n\nEsta ação não pode ser desfeita automaticamente.`
  );
  if (!ok) return;
  await DB.remove('pagamentos', pagId);
  DB.marcarAlteracao();
  Utils.showToast('Pagamento excluído!');
  closeModal();
  navigate('auditoria');
}
// ── NOVO CLIENTE (sem excursão) ────────────────────────────────────────
async function openModalNovoCliente() {
  openModal('Novo Cliente', `
  <form id="formNovoCliente" onsubmit="salvarNovoCliente(event)">
    <div class="form-section">
      <div class="form-section-header">
        <div class="form-section-icon">👤</div>
        <div>
          <div class="form-section-label">Dados do cliente</div>
          <div class="form-section-sub">Preencha os dados que você tem disponíveis</div>
        </div>
      </div>
      <div class="form-row" style="grid-template-columns:1fr">
        <div class="form-group"><label class="form-label">Nome completo *</label>
          <input class="form-control" name="nome" required placeholder="Nome completo"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Telefone / WhatsApp</label>
          <input class="form-control" name="telefone" placeholder="(00) 00000-0000"/></div>
        <div class="form-group"><label class="form-label">CPF / Documento</label>
          <input class="form-control" name="documento"/></div>
        <div class="form-group"><label class="form-label">RG</label>
          <input class="form-control" name="rg"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Data de nascimento</label>
          <input class="form-control" type="date" name="nascimento"/></div>
        <div class="form-group"><label class="form-label">Cidade</label>
          <input class="form-control" name="cidade"/></div>
      </div>
      <div class="form-group"><label class="form-label">Observações</label>
        <textarea class="form-control" name="observacoes" rows="2" placeholder="Observações gerais sobre o cliente"></textarea></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px">
      <button type="submit" class="btn btn-outline" style="padding:12px">Salvar cliente</button>
      <button type="button" class="btn btn-primary" style="padding:12px" onclick="salvarEAdicionarAExcursao()">Salvar e adicionar a excursão →</button>
    </div>
  </form>`, 'modal-lg');
  window._salvarEAdicionarFlag = false;
}

async function salvarNovoCliente(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  if (!data.nome?.trim()) return;
  // Salvar como passageiro "orphan" — excursaoId vazio
  const saved = await DB.save('passageiros', {
    ...data,
    excursaoId: '__sem_excursao__',
    status: 'confirmado',
    createdAt: new Date().toISOString(),
  });
  DB.marcarAlteracao();
  closeModal();
  Utils.showToast('Cliente salvo!');
  if (window._salvarEAdicionarFlag) {
    window._salvarEAdicionarFlag = false;
    openModalAdicionarAExcursao(data);
  } else {
    navigate('clientes');
  }
}

window.salvarEAdicionarAExcursao = function() {
  window._salvarEAdicionarFlag = true;
  document.getElementById('formNovoCliente')?.requestSubmit();
};

// ── ADICIONAR CLIENTE EXISTENTE A UMA EXCURSÃO ─────────────────────────
async function openModalAdicionarAExcursao(dadosCliente) {
  const excursoes = await DB.getAll('excursoes');
  const hoje = Utils.today();
  const abertas = excursoes
    .filter(e => e.statusManual !== 'cancelada')
    .sort((a,b) => (b.dataSaida||'').localeCompare(a.dataSaida||''));

  const excOpts = abertas.map(e =>
    `<option value="${e.id}">${Utils.escHtml(e.nome)}${e.dataSaida ? ' · ' + Utils.formatDate(e.dataSaida) : ''}</option>`
  ).join('');

  if (!excOpts) {
    return Utils.showToast('Nenhuma excursão disponível.', 'warn');
  }

  const dataJson = Utils.escHtml(JSON.stringify(dadosCliente));

  openModal(`Adicionar ${Utils.escHtml(dadosCliente.nome||'cliente')} a uma excursão`, `
  <form id="formAdicionarExc" onsubmit="confirmarAdicionarAExcursao(event)">
    <input type="hidden" id="dadosClienteJson" value="${dataJson}"/>
    <div class="form-group">
      <label class="form-label">Selecione a excursão *</label>
      <select class="form-control" name="excursaoId" required>
        <option value="">— Escolha uma excursão —</option>
        ${excOpts}
      </select>
    </div>
    <div class="form-hint" style="margin-bottom:16px">
      O passageiro será criado com os dados já preenchidos. Você poderá ajustar valores e pacote em seguida.
    </div>
    <button type="submit" class="btn btn-primary w-full">Continuar</button>
  </form>`, 'modal-md');
}
window.openModalAdicionarAExcursao = openModalAdicionarAExcursao;

async function confirmarAdicionarAExcursao(e) {
  e.preventDefault();
  const excId = e.target.excursaoId.value;
  if (!excId) return;
  const dadosRaw = document.getElementById('dadosClienteJson')?.value || '{}';
  let dados = {};
  try { dados = JSON.parse(dadosRaw); } catch(_) {}
  closeModal();
  // Abre modal de passageiro com dados pré-preenchidos
  openModalPassageiro(excId, null, dados);
}
window.confirmarAdicionarAExcursao = confirmarAdicionarAExcursao;

// ── UNIFICADOR DE CLIENTES DUPLICADOS ─────────────────────────────────
async function abrirUnificadorClientes(uid) {
  const achado = (window._auditoriaAchados || []).find(a => a.uid === uid);
  if (!achado) return Utils.showToast('Item não encontrado. Atualize a auditoria.', 'warn');

  const { pA, pB, excA, excB } = achado;
  const pagamentos = await DB.getAll('pagamentos');

  const finA = Utils.calcPassageiroFinanceiro(pA, pagamentos);
  const finB = Utils.calcPassageiroFinanceiro(pB, pagamentos);
  const pagsA = pagamentos.filter(pg => pg.passageiroId === pA.id).length;
  const pagsB = pagamentos.filter(pg => pg.passageiroId === pB.id).length;

  // Card de cada passageiro — sem escolha de "quem fica", só mostra os dados
  const cardPassageiro = (p, exc, fin, pags, titulo) => `
    <div class="form-section" style="flex:1;min-width:220px">
      <div style="font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">${titulo}</div>
      <div style="font-weight:700;font-size:15px;color:var(--dark);margin-bottom:10px">${Utils.escHtml(p.nome)}</div>
      <div style="font-size:13px;display:flex;flex-direction:column;gap:4px;color:#475467">
        ${p.telefone ? `<div>📞 ${Utils.escHtml(p.telefone)}</div>` : ''}
        ${p.documento ? `<div>🪪 ${Utils.escHtml(p.documento)}</div>` : ''}
        ${p.cidade ? `<div>📍 ${Utils.escHtml(p.cidade)}</div>` : ''}
        ${p.nascimento ? `<div>🎂 ${Utils.formatDate(p.nascimento)}</div>` : ''}
      </div>
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:13px">
        <div style="margin-bottom:4px"><span class="badge badge-gray">${Utils.escHtml(exc?.nome || '—')}</span></div>
        <div>Valor: <b>${Utils.formatCurrency(fin.valorTotal)}</b> · Pago: <b class="text-green">${Utils.formatCurrency(fin.totalPago)}</b></div>
        <div style="color:var(--gray)">${pags} pagamento(s)</div>
      </div>
    </div>`;

  openModal('Unificar cadastros duplicados', `
    <div style="background:rgba(20,83,155,.06);border:1.5px solid rgba(20,83,155,.2);border-radius:10px;padding:14px 16px;margin-bottom:18px;font-size:13px;color:var(--dark)">
      <b>O que acontece ao unificar:</b>
      <ul style="margin:8px 0 0 16px;display:flex;flex-direction:column;gap:4px">
        <li>Ambas as excursões e <b>todos os pagamentos</b> são mantidos</li>
        <li>Os dados pessoais de ambos são mesclados (campos vazios preenchidos)</li>
        <li>Os dois registros passam a ter os mesmos dados cadastrais</li>
        <li>Nenhuma excursão ou pagamento é perdido</li>
      </ul>
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px">
      ${cardPassageiro(pA, excA, finA, pagsA, 'Registro na excursão A')}
      <div style="display:flex;align-items:center;padding:0 4px;color:var(--gray);font-size:22px;font-weight:300">+</div>
      ${cardPassageiro(pB, excB, finB, pagsB, 'Registro na excursão B')}
    </div>
    <div style="font-size:13px;color:var(--gray);background:var(--bg);border-radius:8px;padding:12px;margin-bottom:16px">
      Após a unificação, ambos os registros terão os mesmos dados cadastrais (nome, telefone, CPF, cidade). 
      Cada um continuará ligado à sua própria excursão, com seus próprios pagamentos.
    </div>
    <div style="display:flex;gap:10px">
      <button class="btn btn-outline" style="flex:1" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" style="flex:1" onclick="confirmarUnificacao('${pA.id}','${pB.id}')">Unificar cadastros</button>
    </div>
  `, 'modal-lg');
}
window.abrirUnificadorClientes = abrirUnificadorClientes;

async function confirmarUnificacao(idA, idB) {
  const [pA, pB] = await Promise.all([
    DB.getById('passageiros', idA),
    DB.getById('passageiros', idB),
  ]);
  if (!pA || !pB) {
    Utils.showToast('Passageiro não encontrado. Atualize a auditoria.', 'error');
    return;
  }

  Utils.showLoading('Unificando cadastros...');
  try {
    // Mescla campos: preenche vazios de cada um com dados do outro
    // O "melhor" dado vence — maior quantidade de campos preenchidos determina a base
    const camposImportantes = ['nome','telefone','documento','rg','cidade','nascimento','emergencia','formaPreferida','observacoes'];
    
    const preenchidosA = camposImportantes.filter(c => pA[c]).length;
    const preenchidosB = camposImportantes.filter(c => pB[c]).length;
    
    // Base = quem tem mais dados; complementa com o outro
    const base = preenchidosA >= preenchidosB ? pA : pB;
    const complemento = preenchidosA >= preenchidosB ? pB : pA;
    
    const dadosMesclados = { ...base };
    for (const campo of camposImportantes) {
      if (!dadosMesclados[campo] && complemento[campo]) {
        dadosMesclados[campo] = complemento[campo];
      }
    }

    // Atualiza AMBOS os passageiros com os dados mesclados
    // Cada um mantém seu próprio id, excursaoId, pagamentos, assento, status, etc.
    const camposParaSincronizar = ['nome','telefone','documento','rg','cidade','nascimento','emergencia','formaPreferida'];
    
    await DB.save('passageiros', { 
      ...pA, 
      ...Object.fromEntries(camposParaSincronizar.map(c => [c, dadosMesclados[c] || pA[c] || '']))
    });
    await DB.save('passageiros', { 
      ...pB, 
      ...Object.fromEntries(camposParaSincronizar.map(c => [c, dadosMesclados[c] || pB[c] || '']))
    });

    // Salva o par como ignorado para não reaparecer na auditoria
    const chaveIgnorar = [idA, idB].sort().join('|');
    const metaIgn = await DB.getById('meta', 'duplicadosIgnorados');
    const listaIgn = metaIgn?.value || [];
    if (!listaIgn.includes(chaveIgnorar)) {
      listaIgn.push(chaveIgnorar);
      await DB.save('meta', { key: 'duplicadosIgnorados', value: listaIgn });
    }

    DB.marcarAlteracao();
    Utils.hideLoading();
    closeModal();
    Utils.showToast('Cadastros unificados! Ambas as excursões mantidas.');
    navigate('auditoria');
  } catch(e) {
    Utils.hideLoading();
    Utils.showToast('Erro ao unificar: ' + e.message, 'error');
    console.error(e);
  }
}
window.confirmarUnificacao = confirmarUnificacao;

// ── IGNORAR PAR DE DUPLICADOS ──────────────────────────────────────────
async function ignorarDuplicadoCliente(idA, idB) {
  // Persiste o par ignorado na meta do banco para não aparecer mais
  const chave = [idA, idB].sort().join('|');
  const m = await DB.getById('meta', 'duplicadosIgnorados');
  const lista = m?.value || [];
  if (!lista.includes(chave)) {
    lista.push(chave);
    await DB.save('meta', { key: 'duplicadosIgnorados', value: lista });
  }
  Utils.showToast('Par ignorado. Não aparecerá mais na auditoria.');
  navegarAbaAuditoria(window._auditoriaAbaAtiva || 'clientes');
}
window.ignorarDuplicadoCliente = ignorarDuplicadoCliente;