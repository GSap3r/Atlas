// ==============================================
// ARQUIVO: atlas/assets/js/app-vendedor.js
// Página de Vendedores: cadastro + relação com as
// viagens (cada passageiro/venda pode ter um
// vendedor — um vendedor pode aparecer em várias
// excursões diferentes).
// ==============================================

async function renderVendedores() {
  const [vendedores, passageiros, excursoes, pagamentos] = await Promise.all([
    DB.getAll('vendedores'), DB.getAll('passageiros'), DB.getAll('excursoes'), DB.getAll('pagamentos')
  ]);
  const ativos   = vendedores.filter(v => v.ativo !== false);
  const inativos = vendedores.filter(v => v.ativo === false);

  // Agrupa vendas (passageiros) por vendedor + excursão para montar a
  // relação vendedor → viagem.
  const porVendedor = {};
  for (const p of passageiros) {
    if (!p.vendedorId) continue;
    if (p.status === 'cancelado') continue;
    const exc = excursoes.find(e => e.id === p.excursaoId);
    if (!porVendedor[p.vendedorId]) porVendedor[p.vendedorId] = { viagens: {}, totalVendas: 0, totalValor: 0, totalRecebido: 0 };
    const grp = porVendedor[p.vendedorId];
    const chaveExc = p.excursaoId || '—';
    const valorVenda = Number(p.valorFinal ?? p.valorCombinado ?? p.valorBase ?? 0) || 0;
    const recebidoPass = pagamentos
      .filter(pg => pg.passageiroId === p.id && pg.status === 'pago')
      .reduce((s, pg) => s + (parseFloat(pg.valor) || 0), 0);
    if (!grp.viagens[chaveExc]) grp.viagens[chaveExc] = { exc, qtd: 0, valor: 0 };
    grp.viagens[chaveExc].qtd += 1;
    grp.viagens[chaveExc].valor += valorVenda;
    grp.totalVendas += 1;
    grp.totalValor += valorVenda;
    grp.totalRecebido += recebidoPass;
  }

  const totalComissaoVendido  = ativos.reduce((s, v) => s + (porVendedor[v.id]?.totalValor    || 0) * ((parseFloat(v.comissaoPercentual) || 0) / 100), 0);
  const totalComissaoRecebido = ativos.reduce((s, v) => s + (porVendedor[v.id]?.totalRecebido || 0) * ((parseFloat(v.comissaoPercentual) || 0) / 100), 0);

  const linhas = ativos.map(v => {
    const stats = porVendedor[v.id] || { viagens: {}, totalVendas: 0, totalValor: 0, totalRecebido: 0 };
    const qtdViagens = Object.keys(stats.viagens).length;
    const comissaoPct = parseFloat(v.comissaoPercentual) || 0;
    const waLink = v.whatsapp ? Utils.waLink(v.whatsapp) : null;
    return `<tr>
      <td><b>${Utils.escHtml(v.nome || '')}</b></td>
      <td>
        ${Utils.escHtml(v.whatsapp || '')}
        ${waLink ? `<a href="${waLink}" target="_blank" class="wa-btn" title="WhatsApp">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.559 4.14 1.535 5.875L.057 23.899l6.224-1.635A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.002-1.373l-.36-.213-3.692.97.985-3.601-.233-.369A9.818 9.818 0 1112 21.818z"/></svg>
        </a>` : ''}
      </td>
      <td class="text-gray" style="font-size:13px">${Utils.escHtml(v.documento || '')}</td>
      <td><span class="badge badge-gray">${qtdViagens} viagem${qtdViagens === 1 ? '' : 'ns'}</span></td>
      <td>${stats.totalVendas}</td>
      <td>${Utils.formatCurrency(stats.totalValor)}</td>
      <td>${comissaoPct ? comissaoPct.toFixed(1).replace(/\.0$/,'') + '%' : '<span class="text-gray">—</span>'}</td>
      <td class="td-actions">
        <button class="btn btn-outline btn-sm" onclick="openModalVendedor('${v.id}')">✎</button>
        <button class="btn btn-sm" style="background:#FEE2E2;color:#B91C1C" onclick="desativarVendedor('${v.id}')">Desativar</button>
      </td>
    </tr>`;
  }).join('');

  // Tabela detalhada vendedor × viagem — é aqui que a relação fica visível.
  const relacaoLinhas = [];
  for (const v of ativos) {
    const stats = porVendedor[v.id];
    if (!stats) continue;
    const viagensOrdenadas = Object.values(stats.viagens).sort((a, b) =>
      (b.exc?.dataSaida || '').localeCompare(a.exc?.dataSaida || ''));
    for (const viagem of viagensOrdenadas) {
      relacaoLinhas.push(`<tr>
        <td>${Utils.escHtml(v.nome || '')}</td>
        <td>${viagem.exc ? Utils.escHtml(viagem.exc.nome || '') : '<span class="text-gray">Excursão removida</span>'}</td>
        <td class="text-gray" style="font-size:13px">${viagem.exc ? Utils.escHtml(viagem.exc.destino || '') : ''}</td>
        <td class="text-gray" style="font-size:13px">${viagem.exc?.dataSaida ? Utils.formatDate(viagem.exc.dataSaida) : ''}</td>
        <td>${viagem.qtd}</td>
        <td>${Utils.formatCurrency(viagem.valor)}</td>
      </tr>`);
    }
  }

  return `
  <div class="page-header">
    <div><h1>Vendedores</h1><div class="page-header-sub">Cadastro de vendedores e as viagens em que cada um vendeu passagens.</div></div>
    <button class="btn btn-primary" onclick="openModalVendedor()">+ Novo vendedor</button>
  </div>
  <div class="stats-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:24px">
    <div class="stat-card"><div class="stat-label">Vendedores</div><div class="stat-value">${ativos.length}</div></div>
    <div class="stat-card"><div class="stat-label">Vendas com vendedor atribuído</div><div class="stat-value">${passageiros.filter(p => p.vendedorId).length}</div></div>
    <div class="stat-card"><div class="stat-label">Comissão do total vendido</div><div class="stat-value blue sv-currency">${Utils.formatCurrency(totalComissaoVendido)}</div></div>
    <div class="stat-card"><div class="stat-label">Comissão do total recebido</div><div class="stat-value green sv-currency">${Utils.formatCurrency(totalComissaoRecebido)}</div></div>
    <div class="stat-card"><div class="stat-label">Desativados</div><div class="stat-value gray">${inativos.length}</div></div>
  </div>
  ${!ativos.length
    ? `<div class="empty-state"><h3>Nenhum vendedor cadastrado</h3><p>Cadastre vendedores para relacioná-los às vendas das excursões.</p>
        <button class="btn btn-primary mt-16" onclick="openModalVendedor()">+ Novo vendedor</button></div>`
    : `<div class="table-wrapper"><table>
        <thead><tr><th>Nome</th><th>WhatsApp</th><th>Documento</th><th>Viagens</th><th>Vendas</th><th>Total vendido</th><th>Comissão</th><th></th></tr></thead>
        <tbody>${linhas}</tbody>
      </table></div>

      <h3 class="mt-24" style="margin-bottom:12px">Vendedor × Viagem</h3>
      ${relacaoLinhas.length
        ? `<div class="table-wrapper"><table>
            <thead><tr><th>Vendedor</th><th>Viagem</th><th>Destino</th><th>Data de saída</th><th>Passageiros vendidos</th><th>Valor vendido</th></tr></thead>
            <tbody>${relacaoLinhas.join('')}</tbody>
          </table></div>`
        : `<p class="text-gray" style="font-size:14px">Nenhuma venda com vendedor atribuído ainda. Ao editar um passageiro, escolha o vendedor na aba de Passageiros de uma excursão.</p>`
      }`
  }`;
}

async function openModalVendedor(id = null) {
  const v = id ? await DB.getById('vendedores', id) : null;
  const val = v || {};
  openModal(id ? 'Editar Vendedor' : 'Novo Vendedor', `
  <form id="formVendedor" onsubmit="salvarVendedor(event,'${id || ''}')">
    <div class="form-row">
      <div class="form-group" style="grid-column:1/-1"><label class="form-label">Nome *</label>
        <input class="form-control" name="nome" value="${Utils.escHtml(val.nome || '')}" required placeholder="Nome do vendedor"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">WhatsApp</label>
        <input class="form-control" name="whatsapp" value="${Utils.escHtml(val.whatsapp || '')}"/></div>
      <div class="form-group"><label class="form-label">Documento</label>
        <input class="form-control" name="documento" value="${Utils.escHtml(val.documento || '')}"/></div>
      <div class="form-group"><label class="form-label">Comissão (%)</label>
        <input class="form-control" type="number" name="comissaoPercentual" value="${val.comissaoPercentual ?? ''}" min="0" max="100" step="0.1" placeholder="Ex: 5"/></div>
    </div>
    <div class="form-group"><label class="form-label">Observações</label>
      <textarea class="form-control" name="observacoes" rows="2">${Utils.escHtml(val.observacoes || '')}</textarea></div>
    <button type="submit" class="btn btn-primary w-full">${id ? 'Salvar' : 'Cadastrar vendedor'}</button>
  </form>`);
}

async function salvarVendedor(e, id) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  data.ativo = true;
  if (id) data.id = id;
  await DB.save('vendedores', data);
  DB.marcarAlteracao();
  closeModal();
  Utils.showToast(id ? 'Vendedor atualizado!' : 'Vendedor cadastrado!');
  navigate('vendedores');
}

async function desativarVendedor(id) {
  if (!confirm('Desativar este vendedor?')) return;
  const v = await DB.getById('vendedores', id);
  if (v) { v.ativo = false; await DB.save('vendedores', v); }
  DB.marcarAlteracao();
  Utils.showToast('Vendedor desativado');
  navigate('vendedores');
}
