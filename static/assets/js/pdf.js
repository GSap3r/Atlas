// ==============================================
// ARQUIVO: atlas/assets/js/pdf.js
// ==============================================
const PDF = (() => {

  const CSS_BASE = `
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; margin: 30px; }
    h1   { font-size: 20px; margin-bottom: 4px; color: #2E93B0; }
    h2   { font-size: 15px; margin: 20px 0 8px; color: #172033; border-bottom: 1px solid #E4E7EC; padding-bottom: 4px; }
    .meta { font-size: 13px; color: #555; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th    { background: #2E93B0; color: #fff; padding: 8px 10px; text-align: left; font-size: 12px; }
    td    { padding: 8px 10px; border-bottom: 1px solid #e5e5e5; }
    tr:nth-child(even) td { background: #f9f9f9; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
    .box  { border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
    .box label { font-size: 11px; color: #888; display: block; margin-bottom: 4px; }
    .box span  { font-size: 18px; font-weight: 700; }
    .badge-pago    { color: #16A34A; font-weight: 600; }
    .badge-pendente{ color: #C2410C; font-weight: 600; }
    .badge-vencido { color: #B91C1C; font-weight: 600; }
    .footer { margin-top: 30px; font-size: 11px; color: #888; text-align: right; border-top: 1px solid #eee; padding-top: 8px; }
    .msg-success { background: #DCFCE7; color: #166534; padding: 10px 14px; border-radius: 8px; font-weight: 600; margin: 16px 0; }
    .msg-warn    { background: #FFEDD5; color: #C2410C; padding: 10px 14px; border-radius: 8px; font-weight: 600; margin: 16px 0; }
    @media print { body { margin: 10px; } button { display: none; } }
  `;

  function abrirJanela(titulo, corpo) {
    const licFooter = (typeof License !== 'undefined') ? License.getLicenseFooterPDFHTML() : '';
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { Utils.showToast('Popup bloqueado. Permita popups para este site.', 'warn'); return; }
    w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
      <meta charset="UTF-8"><title>${titulo}</title>
      <style>${CSS_BASE}
        .license-footer { margin-top:24px; padding-top:8px; border-top:1px solid #e5e5e5;
          font-size:11px; color:#888; text-align:center; font-style:italic; }
      </style>
    </head><body>${corpo}
      <div class="footer">Atlas › — Gerado em ${Utils.formatDatetime(new Date().toISOString())}</div>
      ${licFooter}
      <script>window.onload = () => window.print();<\/script>
    </body></html>`);
    w.document.close();
  }

  // ── Lista de embarque ──────────────────────────────────────────────
  function printEmbarque(excursao, passageiros, pagamentos) {
    const rows = passageiros
      .filter(p => p.status !== 'cancelado')
      .sort((a, b) => (parseInt(a.assento) || 999) - (parseInt(b.assento) || 999))
      .map(p => {
        const fin = Utils.calcPassageiroFinanceiro(p, pagamentos);
        const pgStatus = fin.saldo <= 0
          ? '<span class="badge-pago">Pago</span>'
          : '<span class="badge-pendente">Pendente</span>';
        return `<tr>
          <td>${Utils.escHtml(p.nome)}</td>
          <td>${Utils.escHtml(p.telefone || '')}</td>
          <td>${Utils.escHtml(p.documento || '')}</td>
          <td>${Utils.escHtml(p.pontoEmbarque || '')}</td>
          <td style="text-align:center">${p.assento || '—'}</td>
          <td>${pgStatus}</td>
          <td style="width:70px">&nbsp;</td>
        </tr>`;
      }).join('');

    abrirJanela(`Lista de Embarque — ${excursao.nome}`, `
      <h1>Lista de Embarque</h1>
      <div class="meta">
        <b>${Utils.escHtml(excursao.nome)}</b> &nbsp;·&nbsp;
        Destino: <b>${Utils.escHtml(excursao.destino || '')}</b> &nbsp;·&nbsp;
        Saída: <b>${Utils.formatDate(excursao.dataSaida)}</b>
        ${excursao.horario ? `às <b>${excursao.horario}</b>` : ''}
        ${excursao.localEmbarque ? `&nbsp;·&nbsp; Local: <b>${Utils.escHtml(excursao.localEmbarque)}</b>` : ''}
      </div>
      <table>
        <thead><tr>
          <th>Nome</th><th>Telefone</th><th>Documento</th>
          <th>Embarque</th><th>Assento</th><th>Pagamento</th><th>Presença ✓</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#aaa">Nenhum passageiro ativo</td></tr>'}</tbody>
      </table>
      <p style="font-size:12px;color:#888">Total de passageiros: <b>${passageiros.filter(p => p.status !== 'cancelado').length}</b></p>
    `);
  }

  // ── Relatório financeiro ───────────────────────────────────────────
  function printFinanceiro(excursao, fin, contas, passageiros, pagamentos) {
    const contasRows = contas.map(c => `<tr>
      <td>${Utils.escHtml(c.nome)}</td>
      <td>${Utils.escHtml(c.categoria || '')}</td>
      <td>${Utils.formatCurrency(c.valor)}</td>
      <td>${Utils.formatDate(c.vencimento)}</td>
      <td class="${c.status === 'pago' ? 'badge-pago' : c.status === 'vencido' ? 'badge-vencido' : 'badge-pendente'}">${c.status}</td>
    </tr>`).join('');

    const passRows = passageiros.map(p => {
      const pf = Utils.calcPassageiroFinanceiro(p, pagamentos);
      return `<tr>
        <td>${Utils.escHtml(p.nome)}</td>
        <td>${Utils.formatCurrency(pf.valorTotal)}</td>
        <td class="badge-pago">${Utils.formatCurrency(pf.totalPago)}</td>
        <td class="${pf.saldo > 0 ? 'badge-pendente' : 'badge-pago'}">${Utils.formatCurrency(pf.saldo)}</td>
        <td>${p.status}</td>
      </tr>`;
    }).join('');

    const msgHtml = fin.receitaRecebida >= fin.custoTotal && fin.custoTotal > 0
      ? `<div class="msg-success">✓ Excursão paga! Lucro real atual: ${Utils.formatCurrency(fin.lucroReal)}</div>`
      : fin.custoTotal > 0
      ? `<div class="msg-warn">Faltam ${Utils.formatCurrency(fin.faltaParaPagar)} para cobrir todos os custos.</div>`
      : '';

    abrirJanela(`Relatório Financeiro — ${excursao.nome}`, `
      <h1>Relatório Financeiro</h1>
      <div class="meta">
        <b>${Utils.escHtml(excursao.nome)}</b> &nbsp;·&nbsp;
        ${Utils.escHtml(excursao.destino || '')} &nbsp;·&nbsp;
        Saída: ${Utils.formatDate(excursao.dataSaida)}
      </div>
      ${msgHtml}
      <h2>Resumo</h2>
      <div class="grid">
        <div class="box"><label>Receita Prevista</label><span>${Utils.formatCurrency(fin.receitaPrevista)}</span></div>
        <div class="box"><label>Receita Recebida</label><span style="color:#12B76A">${Utils.formatCurrency(fin.receitaRecebida)}</span></div>
        <div class="box"><label>A Receber</label><span style="color:#F79009">${Utils.formatCurrency(fin.receitaPendente)}</span></div>
        <div class="box"><label>Custos Totais</label><span>${Utils.formatCurrency(fin.custoTotal)}</span></div>
        <div class="box"><label>Custos Pagos</label><span>${Utils.formatCurrency(fin.custosPagos)}</span></div>
        <div class="box"><label>Lucro Previsto</label>
          <span style="color:${fin.lucroPrevisto >= 0 ? '#12B76A' : '#F04438'}">${Utils.formatCurrency(fin.lucroPrevisto)}</span>
        </div>
      </div>
      <h2>Contas a Pagar</h2>
      <table>
        <thead><tr><th>Nome</th><th>Categoria</th><th>Valor</th><th>Vencimento</th><th>Status</th></tr></thead>
        <tbody>${contasRows || '<tr><td colspan="5" style="color:#aaa;text-align:center">Nenhuma conta</td></tr>'}</tbody>
      </table>
      <h2>Passageiros</h2>
      <table>
        <thead><tr><th>Nome</th><th>Valor</th><th>Pago</th><th>Saldo</th><th>Status</th></tr></thead>
        <tbody>${passRows || '<tr><td colspan="5" style="color:#aaa;text-align:center">Nenhum passageiro</td></tr>'}</tbody>
      </table>
    `);
  }

  // ── Relatório completo ─────────────────────────────────────────────
  function printCompleto(excursao, fin, contas, passageiros, pagamentos) {
    // Inclui tudo: financeiro + lista de embarque numa só página
    const passRows = passageiros
      .filter(p => p.status !== 'cancelado')
      .sort((a, b) => (parseInt(a.assento) || 999) - (parseInt(b.assento) || 999))
      .map(p => {
        const pf = Utils.calcPassageiroFinanceiro(p, pagamentos);
        return `<tr>
          <td>${Utils.escHtml(p.nome)}</td>
          <td>${Utils.escHtml(p.telefone || '')}</td>
          <td>${Utils.escHtml(p.documento || '')}</td>
          <td>${Utils.escHtml(p.pontoEmbarque || '')}</td>
          <td style="text-align:center">${p.assento || '—'}</td>
          <td>${p.status}</td>
          <td class="${pf.saldo <= 0 ? 'badge-pago' : 'badge-pendente'}">${pf.saldo <= 0 ? 'Pago' : Utils.formatCurrency(pf.saldo)}</td>
        </tr>`;
      }).join('');

    const contasRows = contas.map(c => `<tr>
      <td>${Utils.escHtml(c.nome)}</td>
      <td>${Utils.escHtml(c.categoria || '')}</td>
      <td>${Utils.formatCurrency(c.valor)}</td>
      <td>${Utils.formatDate(c.vencimento)}</td>
      <td class="${c.status === 'pago' ? 'badge-pago' : 'badge-pendente'}">${c.status}</td>
    </tr>`).join('');

    abrirJanela(`Relatório Completo — ${excursao.nome}`, `
      <h1>Relatório Completo — ${Utils.escHtml(excursao.nome)}</h1>
      <div class="meta">
        Destino: <b>${Utils.escHtml(excursao.destino || '')}</b> &nbsp;·&nbsp;
        Saída: <b>${Utils.formatDate(excursao.dataSaida)}</b>
        ${excursao.horario ? `às ${excursao.horario}` : ''}
        ${excursao.localEmbarque ? `&nbsp;·&nbsp; ${Utils.escHtml(excursao.localEmbarque)}` : ''}
      </div>
      <h2>Resumo Financeiro</h2>
      <div class="grid">
        <div class="box"><label>Receita Prevista</label><span>${Utils.formatCurrency(fin.receitaPrevista)}</span></div>
        <div class="box"><label>Recebida</label><span style="color:#12B76A">${Utils.formatCurrency(fin.receitaRecebida)}</span></div>
        <div class="box"><label>A Receber</label><span style="color:#F79009">${Utils.formatCurrency(fin.receitaPendente)}</span></div>
        <div class="box"><label>Custos Totais</label><span>${Utils.formatCurrency(fin.custoTotal)}</span></div>
        <div class="box"><label>Custos Pagos</label><span>${Utils.formatCurrency(fin.custosPagos)}</span></div>
        <div class="box"><label>Lucro Previsto</label>
          <span style="color:${fin.lucroPrevisto >= 0 ? '#12B76A' : '#F04438'}">${Utils.formatCurrency(fin.lucroPrevisto)}</span>
        </div>
      </div>
      <h2>Contas a Pagar</h2>
      <table>
        <thead><tr><th>Nome</th><th>Categoria</th><th>Valor</th><th>Vencimento</th><th>Status</th></tr></thead>
        <tbody>${contasRows || '<tr><td colspan="5" style="color:#aaa;text-align:center">Nenhuma conta</td></tr>'}</tbody>
      </table>
      <h2>Lista de Passageiros</h2>
      <table>
        <thead><tr><th>Nome</th><th>Telefone</th><th>Documento</th><th>Embarque</th><th>Assento</th><th>Status</th><th>Saldo</th></tr></thead>
        <tbody>${passRows || '<tr><td colspan="7" style="color:#aaa;text-align:center">Nenhum passageiro</td></tr>'}</tbody>
      </table>
    `);
  }

  // ── Relatório só de passageiros ────────────────────────────────────
  function printPassageiros(excursao, passageiros, pagamentos) {
    const rows = passageiros.map(p => {
      const pf = Utils.calcPassageiroFinanceiro(p, pagamentos);
      return `<tr>
        <td>${Utils.escHtml(p.nome)}</td>
        <td>${Utils.escHtml(p.telefone || '')}</td>
        <td>${Utils.escHtml(p.documento || '')}</td>
        <td>${Utils.escHtml(p.cidade || '')}</td>
        <td style="text-align:center">${p.assento || '—'}</td>
        <td>${p.status}</td>
        <td>${Utils.formatCurrency(pf.valorTotal)}</td>
        <td class="badge-pago">${Utils.formatCurrency(pf.totalPago)}</td>
        <td class="${pf.saldo > 0 ? 'badge-pendente' : 'badge-pago'}">${Utils.formatCurrency(pf.saldo)}</td>
      </tr>`;
    }).join('');

    abrirJanela(`Passageiros — ${excursao.nome}`, `
      <h1>Relatório de Passageiros</h1>
      <div class="meta"><b>${Utils.escHtml(excursao.nome)}</b> &nbsp;·&nbsp; ${Utils.escHtml(excursao.destino || '')} &nbsp;·&nbsp; ${Utils.formatDate(excursao.dataSaida)}</div>
      <table>
        <thead><tr><th>Nome</th><th>Telefone</th><th>Documento</th><th>Cidade</th><th>Assento</th><th>Status</th><th>Valor</th><th>Pago</th><th>Saldo</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="9" style="text-align:center;color:#aaa">Nenhum passageiro</td></tr>'}</tbody>
      </table>
      <p style="font-size:12px;color:#888">Total: <b>${passageiros.length}</b> passageiro(s)</p>
    `);
  }

  // ── Relatório de pagamentos ────────────────────────────────────────
  function printPagamentos(excursao, passageiros, pagamentos) {
    const rows = pagamentos
      .sort((a, b) => (a.data || '').localeCompare(b.data || ''))
      .map(pag => {
        const pass = passageiros.find(p => p.id === pag.passageiroId);
        return `<tr>
          <td>${Utils.formatDate(pag.data)}</td>
          <td>${Utils.escHtml(pass?.nome || '—')}</td>
          <td style="color:#12B76A;font-weight:700">${Utils.formatCurrency(pag.valor)}</td>
          <td>${Utils.escHtml(pag.forma || '')}</td>
          <td class="${pag.status === 'pago' ? 'badge-pago' : pag.status === 'estornado' ? 'badge-vencido' : 'badge-pendente'}">${pag.status}</td>
          <td>${Utils.escHtml(pag.observacao || '')}</td>
        </tr>`;
      }).join('');

    const total = pagamentos.filter(p => p.status !== 'estornado').reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);

    abrirJanela(`Pagamentos — ${excursao.nome}`, `
      <h1>Relatório de Pagamentos</h1>
      <div class="meta"><b>${Utils.escHtml(excursao.nome)}</b> &nbsp;·&nbsp; ${Utils.escHtml(excursao.destino || '')}</div>
      <div class="grid" style="grid-template-columns:repeat(2,1fr);max-width:400px">
        <div class="box"><label>Total Recebido</label><span style="color:#12B76A">${Utils.formatCurrency(total)}</span></div>
        <div class="box"><label>Nº de Pagamentos</label><span>${pagamentos.filter(p => p.status !== 'estornado').length}</span></div>
      </div>
      <table>
        <thead><tr><th>Data</th><th>Passageiro</th><th>Valor</th><th>Forma</th><th>Status</th><th>Obs</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#aaa">Nenhum pagamento</td></tr>'}</tbody>
      </table>
    `);
  }

  return { printEmbarque, printFinanceiro, printCompleto, printPassageiros, printPagamentos };
})();