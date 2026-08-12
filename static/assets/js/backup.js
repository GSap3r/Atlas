// ==============================================
// ARQUIVO: atlas/assets/js/backup.js
// Sistema completo de backup Atlas
// ==============================================
const Backup = (() => {

  const MAX_HISTORICO = 10;

  // ── Helpers ────────────────────────────────────────────────────────
  function _ts(date) {
    const d = date || new Date();
    return [
      d.getFullYear(),
      String(d.getMonth()+1).padStart(2,'0'),
      String(d.getDate()).padStart(2,'0'),
      String(d.getHours()).padStart(2,'0'),
      String(d.getMinutes()).padStart(2,'0'),
    ].join('-');
  }

  function _nomeArquivo(tipo, extra) {
    const slug = {
      'Manual':                  'manual',
      'Automático':              'auto',
      'Antes de importar':       'antes-importar',
      'Antes de excluir':        'antes-excluir-excursao',
      'Antes de restaurar':      'antes-restaurar',
      'Backup por excursão':     'excursao-' + (extra||'').replace(/[^a-zA-Z0-9]/g,'-').slice(0,20),
    }[tipo] || 'backup';
    return `atlas-${slug}-${_ts()}.json`;
  }

  function _tamanhoStr(json) {
    const bytes = new Blob([json]).size;
    return bytes > 1024*1024
      ? (bytes/1024/1024).toFixed(1)+' MB'
      : (bytes/1024).toFixed(0)+' KB';
  }

  // ── Salvar no histórico (máx 10) ───────────────────────────────────
  async function _salvarHistorico(nome, tipo, json) {
    try {
      const cfg = await _getSettings();
      const LIMITE_CONTEUDO = 5 * 1024 * 1024; // 5MB — acima disso não guarda conteúdo
      const guardarConteudo = cfg.salvarConteudoNoHistorico && json.length <= LIMITE_CONTEUDO;
      const item = {
        id:           crypto.randomUUID(),
        nomeArquivo:  nome,
        tipo,
        createdAt:    new Date().toISOString(),
        tamanho:      _tamanhoStr(json),
        status:       'gerado',
        conteudo:     guardarConteudo ? json : null,
      };
      await DB.save('backupHistorico', item);

      // Limitar ao máximo configurado
      const todos = await DB.getAll('backupHistorico');
      if (todos.length > (cfg.maxBackups || MAX_HISTORICO)) {
        todos.sort((a,b) => a.createdAt.localeCompare(b.createdAt));
        const excesso = todos.length - (cfg.maxBackups || MAX_HISTORICO);
        for (let i = 0; i < excesso; i++) {
          await DB.remove('backupHistorico', todos[i].id);
        }
      }
    } catch(e) { console.warn('Não foi possível salvar histórico:', e); }
  }

  // ── Settings ───────────────────────────────────────────────────────
  async function _getSettings() {
    const m = await DB.getById('meta', 'backupSettings');
    return m?.value || {
      automaticoAtivo:             true,
      frequencia:                  'diario',
      ultimoBackupAutomaticoEm:    null,
      salvarConteudoNoHistorico:   false,
      maxBackups:                  MAX_HISTORICO,
    };
  }

  async function _saveSettings(cfg) {
    await DB.save('meta', { key: 'backupSettings', value: cfg });
  }

  // ── Gerar blob do backup ───────────────────────────────────────────
  async function _gerarBlob(tipo, extraNome) {
    const raw  = await DB.exportAll();
    raw.tipo   = tipo;
    const json = JSON.stringify({ ...raw, tipo }, null, 2);
    const nome = _nomeArquivo(tipo, extraNome);
    const blob = new Blob([json], { type: 'application/json' });
    return { json, blob, nome };
  }

  // ── Download ───────────────────────────────────────────────────────
  function _download(blob, nome) {
    const a   = document.createElement('a');
    a.href    = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  // ── Tentar File System Access API ─────────────────────────────────
  async function _tentarSalvarNaPasta(blob, nome) {
    if (!window.showDirectoryPicker) return false;
    try {
      const m = await DB.getById('meta', 'backupDirHandle');
      if (!m?.value) return false;
      const dir = m.value;
      if (typeof dir.queryPermission !== 'function' || typeof dir.getFileHandle !== 'function') {
        console.warn('Handle de pasta inválido/corrompido — removendo e usando download.');
        await DB.save('meta', { key: 'backupDirHandle', value: null });
        return false;
      }
      const perm   = await dir.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        const req = await dir.requestPermission({ mode: 'readwrite' });
        if (req !== 'granted') return false;
      }
      const file = await dir.getFileHandle(nome, { create: true });
      const ws   = await file.createWritable();
      await ws.write(blob);
      await ws.close();
      return true;
    } catch(e) {
      console.warn('File System API falhou, usando download:', e);
      return false;
    }
  }

  // ── Exportar (com histórico + pasta se possível) ───────────────────
  async function _exportar(tipo, extraNome, silencioso) {
    try {
      Utils.showLoading('Gerando backup...');
      const { json, blob, nome } = await _gerarBlob(tipo, extraNome);
      const salvouNaPasta = await _tentarSalvarNaPasta(blob, nome);
      if (!salvouNaPasta) {
        _download(blob, nome);
      }
      await _salvarHistorico(nome, tipo, json);
      const agora = new Date().toISOString();
      await DB.save('meta', { key: 'lastBackup', value: agora });
      if (tipo === 'Automático') {
        const cfg = await _getSettings();
        cfg.ultimoBackupAutomaticoEm = agora;
        await _saveSettings(cfg);
      }
      _atualizarIndicador(agora);
      Utils.hideLoading();
      if (!silencioso) Utils.showToast(salvouNaPasta ? `Backup salvo na pasta: ${nome}` : `Backup baixado: ${nome}`);
      return { nome, json };
    } catch(e) {
      Utils.hideLoading();
      console.error('Erro ao exportar:', e);
      if (e instanceof RangeError || /Invalid string length/i.test(e.message || '')) {
        Utils.showToast('Backup ficou grande demais devido a histórico acumulado. Limpe o histórico de backups (Configurações > Backup) e tente novamente.', 'error');
      } else if (e.name === 'QuotaExceededError') {
        Utils.showToast('Sem espaço de armazenamento disponível. Limpe o histórico de backups antigos e tente novamente.', 'error');
      } else {
        Utils.showToast('Não foi possível gerar o backup. Tente novamente.', 'error');
      }
      return null;
    }
  }

  // ── Públicos ───────────────────────────────────────────────────────
  async function exportar() {
    return _exportar('Manual');
  }

  async function exportarTipo(tipo, extraNome, silencioso) {
    return _exportar(tipo, extraNome, silencioso);
  }

  async function exportarExcursao(excursaoId) {
    try {
      Utils.showLoading('Gerando backup da excursão...');
      const [exc, todosPass, todosPags, todasContas, pacotes, reservas, tipos, fornecedores] = await Promise.all([
        DB.getById('excursoes', excursaoId),
        DB.getAll('passageiros'), DB.getAll('pagamentos'), DB.getAll('contas'),
        DB.getAll('pacotes'), DB.getAll('reservas'),
        DB.getAll('tiposPassageiro'), DB.getAll('fornecedores'),
      ]);
      const pass    = todosPass.filter(p => p.excursaoId === excursaoId);
      const passIds = new Set(pass.map(p => p.id));
      const pags    = todosPags.filter(p => p.excursaoId === excursaoId);
      const contas  = todasContas.filter(c => c.excursaoId === excursaoId);
      const pacs    = pacotes.filter(p => p.excursaoId === excursaoId);
      const revs    = reservas.filter(r => r.excursaoId === excursaoId);
      const fornIds = new Set(contas.map(c => c.fornecedorId).filter(Boolean));
      const forns   = fornecedores.filter(f => fornIds.has(f.id));
      const tipoIds = new Set(pass.map(p => p.tipoPassageiroId).filter(Boolean));
      const tiposUs = tipos.filter(t => tipoIds.has(t.id));

      const payload = {
        app: 'Atlas Organizador de Excursões',
        version: 3,
        exportedAt: new Date().toISOString(),
        tipo: 'Backup por excursão',
        excursaoNome: exc?.nome || '',
        data: {
          excursoes: [exc],
          passageiros: pass, pagamentos: pags, contas,
          pacotes: pacs, reservas: revs,
          fornecedores: forns, tiposPassageiro: tiposUs,
        }
      };
      const json = JSON.stringify(payload, null, 2);
      const nome = _nomeArquivo('Backup por excursão', exc?.nome || excursaoId);
      const blob = new Blob([json], { type: 'application/json' });
      _download(blob, nome);
      await _salvarHistorico(nome, 'Backup por excursão', json);
      Utils.hideLoading();
      Utils.showToast(`Backup da excursão baixado: ${nome}`);
      return nome;
    } catch(e) {
      Utils.hideLoading();
      Utils.showToast('Erro ao exportar excursão.', 'error');
    }
  }

  // ── Importar ───────────────────────────────────────────────────────
  async function importar(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          Utils.showLoading('Importando backup...');
          const raw  = JSON.parse(e.target.result);
          const erros = validar(raw);
          if (erros) throw new Error(erros);
          await DB.importAll(raw);
          await migrarDadosAntigos();
          const agora = new Date().toISOString();
          await DB.save('meta', { key: 'lastBackup', value: agora });
          _atualizarIndicador(agora);
          Utils.hideLoading();
          Utils.showToast('Backup importado com sucesso!');
          resolve();
        } catch(err) {
          Utils.hideLoading();
          Utils.showToast('Erro ao importar: ' + err.message, 'error');
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
      reader.readAsText(file);
    });
  }

  function importar_ui() {
    const inp = document.createElement('input');
    inp.type  = 'file'; inp.accept = '.json';
    inp.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      // Backup obrigatório antes de importar
      await modalBackupObrigatorio('Antes de importar', async () => {
        await importar(file);
        navigate('dashboard');
      });
    };
    inp.click();
  }

  // ── Validar backup ─────────────────────────────────────────────────
  function validar(raw) {
    if (!raw || typeof raw !== 'object') return 'Arquivo inválido ou corrompido.';
    const data = raw.data || raw;
    const temAlgo = ['excursoes','passageiros','meta'].some(k => Array.isArray(data[k]));
    if (!temAlgo) return 'Esse arquivo não parece ser um backup válido do Atlas.';
    return null; // OK
  }

  // ── Restaurar do histórico ─────────────────────────────────────────
  async function restaurarDoHistorico(id) {
    const item = await DB.getById('backupHistorico', id);
    if (!item?.conteudo) {
      Utils.showToast('Conteúdo do backup não disponível para restauração.', 'warn');
      return;
    }
    const raw = JSON.parse(item.conteudo);
    const data = raw.data || raw;
    const exc = (data.excursoes||[]).length;
    const pas = (data.passageiros||[]).length;
    const pag = (data.pagamentos||[]).length;

    openModal('Restaurar backup', `
      <p class="fw-600" style="margin-bottom:12px">Este backup contém:</p>
      <div style="display:flex;flex-direction:column;gap:6px;font-size:14px;margin-bottom:20px">
        <div>🗓 <b>${exc}</b> excursões</div>
        <div>👥 <b>${pas}</b> passageiros</div>
        <div>💰 <b>${pag}</b> pagamentos</div>
        <div>📅 Gerado em: <b>${Utils.formatDatetime(item.createdAt)}</b></div>
        <div>📋 Tipo: <b>${item.tipo}</b></div>
      </div>
      <div class="backup-info-card">⚠️ Isso substituirá todos os dados atuais. Um backup dos dados atuais será feito antes.</div>`,
      '', [
        { label: 'Cancelar',               cls: 'btn-outline', fn: 'closeModal()' },
        { label: 'Fazer backup e restaurar',cls: 'btn-primary', fn: `_restaurarConfirmado('${id}')` },
      ]
    );
  }

  async function _restaurarConfirmado(id) {
    closeModal();
    Utils.showLoading('Restaurando backup...');
    await _exportar('Antes de restaurar', '', false);
    const item = await DB.getById('backupHistorico', id);
    const raw  = JSON.parse(item.conteudo);
    await DB.importAll(raw);
    await migrarDadosAntigos();
    Utils.hideLoading();
    Utils.showToast('Backup restaurado com sucesso!');
    navigate('dashboard');
  }
  window._restaurarConfirmado = _restaurarConfirmado;

  // ── Modal backup obrigatório ───────────────────────────────────────
  async function modalBackupObrigatorio(tipo, callbackProsseguir) {
    return new Promise((resolve) => {
      openModal('Faça um backup antes de continuar',
        `<p style="font-size:14px;color:var(--gray);margin-bottom:16px">
          Essa ação pode alterar ou remover dados importantes.
          Recomendamos baixar um backup antes de continuar.
        </p>
        <div class="backup-info-card">Tipo de backup que será gerado: <b>${tipo}</b></div>`,
        '', [
          { label: 'Cancelar',           cls: 'btn-outline', fn: `_resolveBackupModal(false)` },
          { label: 'Continuar sem backup',cls: 'btn-ghost',  fn: `_resolveBackupModal(true)`  },
          { label: 'Baixar backup e continuar', cls: 'btn-primary', fn: `_downloadEContinuar('${tipo}')` },
        ]
      );
      window._resolveBackupModal = async (prosseguir) => {
        closeModal();
        if (prosseguir) await callbackProsseguir();
        resolve(prosseguir);
      };
      window._downloadEContinuar = async (t) => {
        closeModal();
        await _exportar(t, '', false);
        await callbackProsseguir();
        resolve(true);
      };
    });
  }

  // ── Backup automático ──────────────────────────────────────────────
  async function verificarBackupAutomatico() {
    try {
      const cfg = await _getSettings();
      if (!cfg.automaticoAtivo) return;

      const lastAuto   = cfg.ultimoBackupAutomaticoEm ? new Date(cfg.ultimoBackupAutomaticoEm) : null;
      const lastChange = await DB.getById('meta', 'lastDataChangeAt');
      const mudou      = !lastChange?.value || !lastAuto || new Date(lastChange.value) > lastAuto;
      if (!mudou) return;

      const freqHoras = { diario: 24, '3dias': 72, semanal: 168 }[cfg.frequencia] || 24;
      const horasDesde = lastAuto ? (Date.now() - lastAuto.getTime()) / 3600000 : Infinity;
      if (horasDesde < freqHoras) return;

      const r = await _exportar('Automático', '', true);
      if (r) {
        Utils.showToast(`Backup automático salvo: ${r.nome}`, 'success');
        console.log('Backup automático gerado.');
      }
    } catch(e) { console.warn('Backup automático falhou:', e); }
  }

  // ── Alerta de backup atrasado (lembrete proativo) ──────────────────
  async function verificarBackupAtrasadoEAvisar() {
    try {
      const m = await DB.getById('meta', 'lastBackup');
      const last = m?.value ? new Date(m.value) : null;
      const diasSemBackup = last ? (Date.now() - last.getTime()) / 86400000 : Infinity;

      // Mais de 2 dias sem nenhum backup gerado → modal bloqueante
      if (diasSemBackup >= 2) {
        const ja = document.getElementById('modalBackupAtrasado');
        if (ja) return; // já está mostrando
        openModal('⚠️ Backup atrasado',
          `<p style="font-size:14px;color:var(--gray);margin-bottom:16px">
            Já fazem <b>${last ? Math.floor(diasSemBackup) + ' dia(s)' : 'muitos dias'}</b> sem um backup salvo.
            Para não correr risco de perder dados de excursões e pagamentos, baixe um backup agora.
          </p>`,
          '', [
            { label: 'Lembrar mais tarde', cls: 'btn-outline', fn: `closeModal()` },
            { label: 'Fazer backup agora', cls: 'btn-primary', fn: `Backup.exportar().then(()=>closeModal())` },
          ]
        );
      }
    } catch(e) { console.warn('Verificação de backup atrasado falhou:', e); }
  }

  // ── Agendador periódico (roda enquanto o app estiver aberto) ───────
  function iniciarAgendadorBackup() {
    // Verifica a cada 1 hora, além da verificação no carregamento da página
    setInterval(() => {
      verificarBackupAutomatico();
      verificarBackupAtrasadoEAvisar();
    }, 60 * 60 * 1000);
  }

  // ── Escolher pasta (File System Access API) ────────────────────────
  async function escolherPasta() {
    if (!window.showDirectoryPicker) {
      Utils.showToast('Seu navegador não suporta seleção de pasta. Os backups serão baixados normalmente.', 'warn');
      return;
    }
    try {
      const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
      await DB.save('meta', { key: 'backupDirHandle', value: dir });
      Utils.showToast('Pasta de backup configurada com sucesso!');
      navigate('backup');
    } catch(e) {
      if (e.name !== 'AbortError') Utils.showToast('Não foi possível configurar a pasta.', 'error');
    }
  }

  // ── Indicador do cabeçalho ─────────────────────────────────────────
  function _atualizarIndicador(isoDate) {
    const el = document.getElementById('backupIndicator');
    if (!el) return;
    if (!isoDate) {
      el.innerHTML = `<span class="bkp-indicator bkp-critico" onclick="navigate('backup')">⚠ Sem backup</span>`;
      return;
    }
    const diff  = (Date.now() - new Date(isoDate).getTime()) / 86400000; // dias
    let cls, txt;
    if      (diff < 1)  { cls = 'bkp-ok';      txt = 'Backup hoje'; }
    else if (diff < 3)  { cls = 'bkp-atencao';  txt = `Backup há ${Math.floor(diff)}d`; }
    else if (diff < 7)  { cls = 'bkp-risco';    txt = `Backup há ${Math.floor(diff)}d`; }
    else                { cls = 'bkp-critico';   txt = 'Backup atrasado'; }
    el.innerHTML = `<span class="bkp-indicator ${cls}" onclick="abrirModalBackupStatus()">${txt}</span>`;
  }

  async function carregarIndicador() {
    const m = await DB.getById('meta', 'lastBackup');
    _atualizarIndicador(m?.value || null);
  }

  async function abrirModalBackupStatus() {
    const [lastM, lastA, lastC] = await Promise.all([
      DB.getById('meta','lastBackup'),
      _getSettings(),
      DB.getById('meta','lastDataChangeAt'),
    ]);
    openModal('Status do Backup', `
      <div style="display:flex;flex-direction:column;gap:12px;font-size:14px">
        <div class="exc-card-row"><span class="text-gray">Último backup</span>
          <b>${lastM?.value ? Utils.formatDatetime(lastM.value) : 'Nunca'}</b></div>
        <div class="exc-card-row"><span class="text-gray">Último backup automático</span>
          <b>${lastA.ultimoBackupAutomaticoEm ? Utils.formatDatetime(lastA.ultimoBackupAutomaticoEm) : 'Nunca'}</b></div>
        <div class="exc-card-row"><span class="text-gray">Última alteração nos dados</span>
          <b>${lastC?.value ? Utils.formatDatetime(lastC.value) : '—'}</b></div>
      </div>`, '', [
      { label: 'Ver área de backup',   cls: 'btn-outline', fn: "closeModal();navigate('backup')" },
      { label: 'Fazer backup agora',   cls: 'btn-primary', fn: "closeModal();Backup.exportar()" },
    ]);
  }
  window.abrirModalBackupStatus = abrirModalBackupStatus;

  async function lastBackupDate() {
    const m = await DB.getById('meta', 'lastBackup');
    return m ? m.value : null;
  }

  function _atualizarUltimoBackup(ts) {
    const el = document.getElementById('backupLastExport');
    if (el && ts) el.textContent = 'Último backup: ' + Utils.formatDatetime(ts);
  }
  async function carregarUltimoBackup() {
    const ts = await lastBackupDate();
    if (ts) _atualizarUltimoBackup(ts);
    carregarIndicador();
  }

  return {
    exportar, exportarTipo, exportarExcursao,
    importar, importar_ui,
    validar, restaurarDoHistorico,
    modalBackupObrigatorio,
    verificarBackupAutomatico, verificarBackupAtrasadoEAvisar, iniciarAgendadorBackup, escolherPasta,
    carregarIndicador, carregarUltimoBackup,
    lastBackupDate, _atualizarUltimoBackup, _atualizarIndicador,
    _getSettings, _saveSettings,
  };
})();