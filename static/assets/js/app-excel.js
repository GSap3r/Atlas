// ==============================================
// ARQUIVO: atlas/assets/js/app-excel.js
// Importação e exportação via Excel (SheetJS)
// ==============================================

const AtlasExcel = (() => {

  // ── Campos dos passageiros ─────────────────────────────────────────
  // Ordem e labels das colunas no Excel exportado
  const CAMPOS_PASSAGEIRO = [
    { key: 'nome',            label: 'Nome',                  aliases: ['nome','name','nome completo','nomecompleto'] },
    { key: 'telefone',        label: 'Telefone',              aliases: ['telefone','fone','celular','whatsapp','tel','phone'] },
    { key: 'documento',       label: 'CPF / Documento',       aliases: ['cpf','documento','doc','cpf/documento','cpfdocumento'] },
    { key: 'rg',              label: 'RG',                    aliases: ['rg'] },
    { key: 'nascimento',      label: 'Data de nascimento',    aliases: ['nascimento','data nascimento','datanascimento','datanascimento','aniversario','birthday'] },
    { key: 'cidade',          label: 'Cidade',                aliases: ['cidade','city','municipio'] },
    { key: 'pontoEmbarque',   label: 'Ponto de embarque',     aliases: ['ponto','embarque','pontoembarque','ponto de embarque','local embarque'] },
    { key: 'assento',         label: 'Assento',               aliases: ['assento','seat','poltrona'] },
    { key: 'status',          label: 'Status',                aliases: ['status','situacao','situação'] },
    { key: 'codigoReserva',   label: 'Código da reserva',     aliases: ['reserva','codigo reserva','codigoreserva','código','codigo'] },
    { key: 'titularReserva',  label: 'Titular da reserva',    aliases: ['titular','titular reserva','titularreserva'] },
    { key: 'valorFinal',      label: 'Valor total (R$)',      aliases: ['valor','valortotal','valor total','valorpacote','valor pacote','preco','preço','price'] },
    { key: 'desconto',        label: 'Desconto (R$)',         aliases: ['desconto','discount'] },
    { key: 'entrada',         label: 'Entrada (R$)',          aliases: ['entrada','down payment','sinal'] },
    { key: 'numParcelas',     label: 'Nº de parcelas',        aliases: ['parcelas','numparcelas','num parcelas','numero parcelas','numeroparcelas'] },
    { key: 'diaVencimento',   label: 'Dia de vencimento',     aliases: ['vencimento','diavencimento','dia vencimento','dia'] },
    { key: 'formaPreferida',  label: 'Forma de pagamento',    aliases: ['forma','pagamento','formapagamento','forma pagamento','payment'] },
    { key: 'emergencia',      label: 'Contato de emergência', aliases: ['emergencia','emergência','emergency'] },
    { key: 'observacoes',     label: 'Observações',           aliases: ['obs','observacoes','observações','notes','notas'] },
  ];

  // Campos dos clientes para exportação global
  const CAMPOS_CLIENTE = [
    { key: 'nome',       label: 'Nome' },
    { key: 'telefone',   label: 'Telefone' },
    { key: 'documento',  label: 'CPF / Documento' },
    { key: 'cidade',     label: 'Cidade' },
    { key: 'excursoes',  label: 'Qtd. excursões' },
    { key: 'excNomes',   label: 'Excursões' },
    { key: 'totalPago',  label: 'Total pago (R$)' },
    { key: 'saldo',      label: 'Saldo em aberto (R$)' },
  ];

  // ── Carregar SheetJS sob demanda ──────────────────────────────────
  function _sheetJS() {
    return new Promise((resolve, reject) => {
      if (window.XLSX) { resolve(window.XLSX); return; }
      reject(new Error(
        'Biblioteca Excel não encontrada.\n' +
        'Certifique-se que o arquivo xlsx.full.min.js está em assets/js/ e recarregue o app.'
      ));
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────
  function _normCol(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  function _mapearColunas(headers) {
    // Retorna { colIndex: campoKey } para cada coluna reconhecida
    const mapa = {};
    headers.forEach((h, i) => {
      const norm = _normCol(h);
      for (const campo of CAMPOS_PASSAGEIRO) {
        if (campo.aliases.some(a => _normCol(a) === norm)) {
          mapa[i] = campo.key;
          break;
        }
      }
    });
    return mapa;
  }

  function _sheetJS() {
    if (!window.XLSX) throw new Error('Biblioteca Excel não carregada. Verifique sua conexão e recarregue o app.');
    return window.XLSX;
  }

  function _lerArquivo(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsArrayBuffer(file);
    });
  }

  // ── EXPORTAR: passageiros de uma excursão ─────────────────────────
  async function exportarPassageiros(excursaoId) {
    let XLSX; try { XLSX = await _sheetJS(); } catch(e) { Utils.showToast(e.message, 'error'); return; }
    Utils.showLoading('Gerando planilha...');
    try {
      const [exc, todosPass, todosPags, tipos, pacotes] = await Promise.all([
        DB.getById('excursoes', excursaoId),
        DB.getAll('passageiros'),
        DB.getAll('pagamentos'),
        DB.getAll('tiposPassageiro'),
        DB.getAll('pacotes'),
      ]);
      const passageiros = todosPass.filter(p => p.excursaoId === excursaoId);

      const header = CAMPOS_PASSAGEIRO.map(c => c.label);
      const rows = passageiros.map(p => {
        const fin = Utils.calcPassageiroFinanceiro(p, todosPags);
        return CAMPOS_PASSAGEIRO.map(c => {
          const v = p[c.key];
          if (c.key === 'valorFinal') return fin.valorTotal || parseFloat(p.valorFinal ?? p.valorCombinado) || '';
          if (c.key === 'nascimento' && v) return Utils.formatDate(v);
          return v ?? '';
        });
      });

      const wsData = [header, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Larguras das colunas
      ws['!cols'] = CAMPOS_PASSAGEIRO.map((c, i) => ({
        wch: Math.max(c.label.length, ...rows.map(r => String(r[i] || '').length), 10)
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Passageiros');

      // Aba de instruções
      const wsInst = XLSX.utils.aoa_to_sheet([
        ['Atlas — Modelo de importação de passageiros'],
        [''],
        ['Para importar: mantenha os cabeçalhos da aba "Passageiros" exatamente como estão.'],
        ['Campos obrigatórios: Nome'],
        ['Status válidos: reservado, confirmado, pendente, cancelado'],
        ['Datas no formato: DD/MM/AAAA'],
        ['Valores numéricos: use ponto como separador decimal (ex: 1500.00)'],
      ]);
      XLSX.utils.book_append_sheet(wb, wsInst, 'Instruções');

      const nomeExc = (exc?.nome || 'excursao').replace(/[^a-zA-Z0-9À-ú ]/g, '').trim().slice(0, 30);
      const nome = `atlas-passageiros-${nomeExc}-${new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(wb, nome);
      Utils.hideLoading();
      Utils.showToast(`Exportado: ${passageiros.length} passageiro(s)`);
    } catch(e) {
      Utils.hideLoading();
      Utils.showToast('Erro ao exportar: ' + e.message, 'error');
      console.error(e);
    }
  }

  // ── EXPORTAR: todos os clientes ───────────────────────────────────
  async function exportarClientes() {
    let XLSX; try { XLSX = await _sheetJS(); } catch(e) { Utils.showToast(e.message, 'error'); return; }
    Utils.showLoading('Gerando planilha de clientes...');
    try {
      const [excursoes, passageiros, pagamentos] = await Promise.all([
        DB.getAll('excursoes'), DB.getAll('passageiros'), DB.getAll('pagamentos'),
      ]);

      // Agrupa igual à tela de Clientes
      const grupos = {};
      for (const p of passageiros) {
        if (!p.nome) continue;
        const doc = String(p.documento || p.cpf || '').replace(/\D/g,'');
        const tel = String(p.telefone || '').replace(/\D/g,'');
        const key = doc ? 'doc:'+doc : tel ? 'tel:'+tel : 'nome:'+p.nome.toLowerCase().trim();
        if (!grupos[key]) grupos[key] = { passageiros: [] };
        grupos[key].passageiros.push(p);
      }

      const header = CAMPOS_CLIENTE.map(c => c.label);
      const rows = Object.values(grupos).map(g => {
        const ref = g.passageiros[0];
        const excs = [...new Set(g.passageiros.map(p => p.excursaoId).filter(Boolean))];
        const totalPago = g.passageiros.reduce((s, p) => {
          const fin = Utils.calcPassageiroFinanceiro(p, pagamentos);
          return s + fin.totalPago;
        }, 0);
        const saldo = g.passageiros.reduce((s, p) => {
          const fin = Utils.calcPassageiroFinanceiro(p, pagamentos);
          return s + fin.saldo;
        }, 0);
        const excNomes = excs.map(id => excursoes.find(e => e.id === id)?.nome || id).join(', ');
        return [
          ref.nome || '',
          ref.telefone || '',
          ref.documento || '',
          ref.cidade || '',
          excs.length,
          excNomes,
          totalPago.toFixed(2),
          saldo.toFixed(2),
        ];
      }).sort((a, b) => String(a[0]).localeCompare(String(b[0])));

      const wsData = [header, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = CAMPOS_CLIENTE.map((c, i) => ({
        wch: Math.max(c.label.length, ...rows.map(r => String(r[i] || '').length), 10)
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
      const nome = `atlas-clientes-${new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(wb, nome);
      Utils.hideLoading();
      Utils.showToast(`Exportado: ${rows.length} cliente(s)`);
    } catch(e) {
      Utils.hideLoading();
      Utils.showToast('Erro ao exportar clientes: ' + e.message, 'error');
      console.error(e);
    }
  }

  // ── IMPORTAR: lê o arquivo e abre modal de confirmação ───────────
  async function importarPassageiros(excursaoId) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.xlsx,.xls,.csv';
    inp.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      await _processarArquivo(file, excursaoId);
    };
    inp.click();
  }

  async function _processarArquivo(file, excursaoId) {
    let XLSX; try { XLSX = await _sheetJS(); } catch(e) { Utils.showToast(e.message, 'error'); return; }
    Utils.showLoading('Lendo planilha...');
    try {
      const buffer  = await _lerArquivo(file);
      const wb      = XLSX.read(buffer, { type: 'array', cellDates: true });
      const wsName  = wb.SheetNames[0];
      const ws      = wb.Sheets[wsName];
      const raw     = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (!raw.length) throw new Error('Planilha vazia.');

      // Primeira linha = cabeçalhos
      const headers = raw[0].map(h => String(h).trim());
      const mapa    = _mapearColunas(headers);
      const colsRec = Object.values(mapa).length;

      if (colsRec === 0) {
        Utils.hideLoading();
        Utils.showToast('Nenhuma coluna reconhecida. Use o modelo exportado pelo Atlas ou renomeie as colunas.', 'error');
        return;
      }

      // Linhas de dados (pula cabeçalho, pula linhas totalmente vazias)
      const linhas = raw.slice(1).filter(row => row.some(c => c !== ''));

      if (!linhas.length) {
        Utils.hideLoading();
        Utils.showToast('Nenhuma linha de dados encontrada.', 'warn');
        return;
      }

      // Converte cada linha num objeto de passageiro
      const passageiros = linhas.map(row => {
        const p = {};
        Object.entries(mapa).forEach(([colIdx, campo]) => {
          let val = row[colIdx];
          if (val === null || val === undefined) { p[campo] = ''; return; }
          // Datas vindas do Excel como objeto Date
          if (val instanceof Date) {
            val = val.toISOString().slice(0, 10);
          } else {
            val = String(val).trim();
            // Tenta converter datas no formato DD/MM/AAAA
            if (campo === 'nascimento' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val)) {
              const [d, m, y] = val.split('/');
              val = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
            }
          }
          p[campo] = val;
        });
        return p;
      });

      Utils.hideLoading();
      _abrirModalConfirmacao(passageiros, headers, mapa, excursaoId, colsRec);
    } catch(e) {
      Utils.hideLoading();
      Utils.showToast('Erro ao ler planilha: ' + e.message, 'error');
      console.error(e);
    }
  }

  // ── Modal de confirmação antes de importar ─────────────────────────
  function _abrirModalConfirmacao(passageiros, headers, mapa, excursaoId, colsRec) {
    const totalCols = headers.length;
    const naoRec    = totalCols - colsRec;
    const semNome   = passageiros.filter(p => !p.nome).length;
    const validos   = passageiros.filter(p => p.nome).length;

    // Preview: primeiros 5
    const preview = passageiros.slice(0, 5).map(p =>
      `<tr>
        <td>${Utils.escHtml(p.nome || '—')}</td>
        <td>${Utils.escHtml(p.telefone || '—')}</td>
        <td>${Utils.escHtml(p.documento || '—')}</td>
        <td>${Utils.escHtml(p.cidade || '—')}</td>
        <td>${Utils.escHtml(p.valorFinal || '—')}</td>
      </tr>`
    ).join('');

    // Colunas reconhecidas vs ignoradas
    const colsInfo = headers.map((h, i) => {
      const campo = mapa[i];
      const def   = campo ? CAMPOS_PASSAGEIRO.find(c => c.key === campo) : null;
      return campo
        ? `<span style="background:#DCFCE7;color:#166534;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600">${Utils.escHtml(h)} → ${def?.label || campo}</span>`
        : `<span style="background:#F3F4F6;color:#9CA3AF;padding:2px 8px;border-radius:99px;font-size:11px">${Utils.escHtml(h)} (ignorada)</span>`;
    }).join(' ');

    window._atlasImportData = passageiros.filter(p => p.nome);
    openModal('Confirmar importação', `
      <div class="form-section section-highlight" style="margin-bottom:16px">
        <div class="form-section-header">
          <div class="form-section-icon">
            <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          </div>
          <div>
            <div class="form-section-label">Resumo da leitura</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;font-size:13px">
          <div><div style="color:var(--gray);font-size:11px;font-weight:700;text-transform:uppercase">Total de linhas</div><div style="font-size:20px;font-weight:700">${passageiros.length}</div></div>
          <div><div style="color:var(--gray);font-size:11px;font-weight:700;text-transform:uppercase">Válidos (com nome)</div><div style="font-size:20px;font-weight:700;color:#16A34A">${validos}</div></div>
          <div><div style="color:var(--gray);font-size:11px;font-weight:700;text-transform:uppercase">Sem nome (ignorados)</div><div style="font-size:20px;font-weight:700;color:${semNome?'#F04438':'var(--gray)'}">${semNome}</div></div>
        </div>
      </div>

      <div style="margin-bottom:14px">
        <div style="font-size:12px;font-weight:700;color:var(--gray);text-transform:uppercase;margin-bottom:6px">Colunas detectadas</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px">${colsInfo}</div>
      </div>

      <div style="margin-bottom:16px">
        <div style="font-size:12px;font-weight:700;color:var(--gray);text-transform:uppercase;margin-bottom:6px">Prévia (primeiros ${Math.min(5,passageiros.length)} registros)</div>
        <div class="table-wrapper"><table>
          <thead><tr><th>Nome</th><th>Telefone</th><th>CPF/Doc</th><th>Cidade</th><th>Valor</th></tr></thead>
          <tbody>${preview}</tbody>
        </table></div>
      </div>

      ${semNome > 0 ? `<div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:10px 14px;font-size:13px;color:#92400E;margin-bottom:14px">⚠ ${semNome} linha(s) sem nome serão ignoradas.</div>` : ''}

      <div style="display:flex;gap:10px">
        <button class="btn btn-outline" style="flex:1" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" style="flex:1" onclick="AtlasExcel._confirmarImportacao('${excursaoId}')">Importar ${validos} passageiro(s)</button>
      </div>
    `, 'modal-xl');
  }

  // ── Salva os passageiros no banco ──────────────────────────────────
  async function _confirmarImportacao(excursaoId) {
    const passageiros = window._atlasImportData || [];
    if (!passageiros.length) {
      Utils.showToast('Nenhum dado para importar.', 'warn'); return;
    }

    Utils.showLoading(`Importando ${passageiros.length} passageiro(s)...`);
    closeModal();

    try {
      const [exc, tipos, pacotes] = await Promise.all([
        DB.getById('excursoes', excursaoId),
        DB.getAll('tiposPassageiro'),
        DB.getAll('pacotes'),
      ]);

      const tipoAdultoId = tipos.find(t => t.nome === 'Adulto')?.id;
      const pacotePadrao = pacotes.find(pk => pk.excursaoId === excursaoId && pk.ativo !== false);

      let ok = 0;
      for (const p of passageiros) {
        if (!p.nome) continue;

        // Normaliza status
        const statusValidos = ['reservado','confirmado','pendente','cancelado'];
        const status = statusValidos.includes(String(p.status||'').toLowerCase())
          ? String(p.status).toLowerCase() : 'reservado';

        // Normaliza valor
        const valorFinal = parseFloat(String(p.valorFinal||'').replace(',','.')) || 0;
        const desconto   = parseFloat(String(p.desconto||'').replace(',','.')) || 0;
        const entrada    = parseFloat(String(p.entrada||'').replace(',','.')) || 0;
        const numParcelas = parseInt(p.numParcelas) || 0;
        const diaVenc    = parseInt(p.diaVencimento) || 0;

        // Gera código de reserva automático
        const reserva = await DB.save('reservas', {
          excursaoId,
          codigo: p.codigoReserva || `RES-${Date.now().toString().slice(-5)}`,
          titular: p.titularReserva || p.nome,
          telefoneTitular: p.telefone || '',
          observacoes: '',
        });

        const salvo = await DB.save('passageiros', {
          nome:              p.nome,
          telefone:          p.telefone || '',
          documento:         p.documento || '',
          rg:                p.rg || '',
          nascimento:        p.nascimento || '',
          cidade:            p.cidade || '',
          pontoEmbarque:     p.pontoEmbarque || '',
          assento:           p.assento || '',
          emergencia:        p.emergencia || '',
          observacoes:       p.observacoes || '',
          formaPreferida:    p.formaPreferida || 'Pix',
          status,
          excursaoId,
          codigoReserva:     reserva.codigo,
          reservaId:         reserva.id,
          titularReserva:    p.titularReserva || p.nome,
          tipoPassageiroId:  tipoAdultoId || '',
          pacoteId:          pacotePadrao?.id || '',
          valorBase:         valorFinal,
          valorFinal:        valorFinal,
          valorCombinado:    valorFinal,
          desconto,
          taxaCartao:        0,
          taxaCartaoRaw:     0,
          tipoTaxa:          'R$',
          entrada,
          numParcelas,
          diaVencimento:     diaVenc ? String(diaVenc) : '',
          createdAt:         new Date().toISOString(),
          _importado:        true,
        });

        // Gera parcelas se informado
        if (valorFinal > 0 && (numParcelas >= 1 || entrada > 0) && diaVenc) {
          try { await gerarParcelasPassageiro(salvo, entrada, numParcelas, diaVenc); } catch(_) {}
        }

        ok++;
      }

      DB.marcarAlteracao();
      Utils.hideLoading();
      Utils.showToast(`${ok} passageiro(s) importado(s) com sucesso!`);
      navigate('excursao', { excursaoId, tab: 'passageiros' });
    } catch(e) {
      Utils.hideLoading();
      Utils.showToast('Erro ao salvar passageiros: ' + e.message, 'error');
      console.error(e);
    }
  }

  return {
    exportarPassageiros,
    exportarClientes,
    importarPassageiros,
    _confirmarImportacao,
    CAMPOS_PASSAGEIRO,
  };
})();

window.AtlasExcel = AtlasExcel;
// Alias para compatibilidade
if (typeof Excel === "undefined") { window.Excel = AtlasExcel; }