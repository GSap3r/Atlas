-- ==============================================
-- Atlas - Schema PostgreSQL (relacional)
-- Substitui a antiga tabela genérica "store_items"
-- (um blob JSONB por item) por tabelas de verdade,
-- com chaves estrangeiras entre excursão, cliente,
-- passageiro, pagamento, conta, vendedor etc.
--
-- Este arquivo é reexecutado a cada start do app
-- (CREATE TABLE IF NOT EXISTS), então é seguro rodar
-- várias vezes. A migração dos dados que já existiam
-- na tabela antiga "store_items" é feita à parte por
-- scripts/migrar_para_relacional.py.
-- ==============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── TIPOS DE PASSAGEIRO ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tipos_passageiro (
    id                      UUID PRIMARY KEY,
    nome                    TEXT,
    descricao               TEXT,
    ordem                   INTEGER,
    pagante                 BOOLEAN NOT NULL DEFAULT true,
    ocupa_vaga              BOOLEAN NOT NULL DEFAULT true,
    entra_no_financeiro     BOOLEAN NOT NULL DEFAULT true,
    entra_na_lista_embarque BOOLEAN NOT NULL DEFAULT true,
    ativo                   BOOLEAN NOT NULL DEFAULT true,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── FORNECEDORES ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fornecedores (
    id          UUID PRIMARY KEY,
    nome        TEXT,
    categoria   TEXT,
    contato     TEXT,
    documento   TEXT,
    telefone    TEXT,
    whatsapp    TEXT,
    observacoes TEXT,
    ativo       BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── VENDEDORES ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendedores (
    id          UUID PRIMARY KEY,
    nome        TEXT,
    documento   TEXT,
    whatsapp    TEXT,
    observacoes TEXT,
    ativo       BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── CLIENTES ─────────────────────────────────────────────────────────
-- Extraído dos passageiros. "chave_dedupe" é a mesma lógica de
-- deduplicação já usada no frontend (clienteKey() em app-global.js):
-- documento (só dígitos) > telefone (só dígitos) > nome normalizado.
CREATE TABLE IF NOT EXISTS clientes (
    id            UUID PRIMARY KEY,
    nome          TEXT,
    documento     TEXT,
    rg            TEXT,
    telefone      TEXT,
    cidade        TEXT,
    nascimento    DATE,
    emergencia    TEXT,
    chave_dedupe  TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_chave_dedupe ON clientes (chave_dedupe);

-- ── EXCURSÕES (viagens) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS excursoes (
    id                UUID PRIMARY KEY,
    nome              TEXT,
    destino           TEXT,
    data_saida        DATE,
    data_retorno      DATE,
    horario           TEXT,
    local_embarque    TEXT,
    pontos_embarque   TEXT,
    vagas             INTEGER,
    valor_passageiro  NUMERIC(12,2),
    observacoes       TEXT,
    cor               TEXT,
    status_manual     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── PACOTES ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pacotes (
    id                          UUID PRIMARY KEY,
    excursao_id                 UUID REFERENCES excursoes(id) ON DELETE CASCADE,
    tipo_passageiro_padrao_id   UUID REFERENCES tipos_passageiro(id) ON DELETE SET NULL,
    nome                        TEXT,
    descricao                   TEXT,
    valor_venda                 NUMERIC(12,2),
    custo_estimado              NUMERIC(12,2),
    ativo                       BOOLEAN NOT NULL DEFAULT true,
    observacoes                 TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pacotes_excursao ON pacotes (excursao_id);

-- ── RESERVAS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservas (
    id                UUID PRIMARY KEY,
    excursao_id       UUID REFERENCES excursoes(id) ON DELETE CASCADE,
    codigo            TEXT,
    titular           TEXT,
    telefone_titular  TEXT,
    observacoes       TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reservas_excursao ON reservas (excursao_id);

-- ── PASSAGEIROS (reserva/venda de um cliente numa excursão) ────────
CREATE TABLE IF NOT EXISTS passageiros (
    id                  UUID PRIMARY KEY,
    excursao_id         UUID REFERENCES excursoes(id) ON DELETE CASCADE,
    cliente_id          UUID REFERENCES clientes(id) ON DELETE SET NULL,
    vendedor_id         UUID REFERENCES vendedores(id) ON DELETE SET NULL,
    tipo_passageiro_id  UUID REFERENCES tipos_passageiro(id) ON DELETE SET NULL,
    pacote_id           UUID REFERENCES pacotes(id) ON DELETE SET NULL,
    reserva_id          UUID REFERENCES reservas(id) ON DELETE SET NULL,
    status              TEXT,
    assento             TEXT,
    codigo_reserva      TEXT,
    titular_reserva     TEXT,
    ponto_embarque      TEXT,
    forma_preferida     TEXT,
    valor_base          NUMERIC(12,2),
    valor_combinado     NUMERIC(12,2),
    valor_final         NUMERIC(12,2),
    entrada             NUMERIC(12,2),
    desconto             NUMERIC(12,2),
    taxa_cartao         NUMERIC(12,2),
    taxa_cartao_raw     NUMERIC(12,2),
    tipo_taxa           TEXT,
    num_parcelas        TEXT,
    dia_vencimento      TEXT,
    criar_parcelas      BOOLEAN NOT NULL DEFAULT false,
    observacoes         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_passageiros_excursao ON passageiros (excursao_id);
CREATE INDEX IF NOT EXISTS idx_passageiros_cliente  ON passageiros (cliente_id);
CREATE INDEX IF NOT EXISTS idx_passageiros_vendedor  ON passageiros (vendedor_id);

-- ── PAGAMENTOS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pagamentos (
    id              UUID PRIMARY KEY,
    excursao_id     UUID REFERENCES excursoes(id) ON DELETE CASCADE,
    passageiro_id   UUID REFERENCES passageiros(id) ON DELETE CASCADE,
    valor           NUMERIC(12,2),
    status          TEXT,
    forma           TEXT,
    origem          TEXT,
    parcela         TEXT,
    data            DATE,
    vencimento      DATE,
    dia_vencimento  TEXT,
    observacao      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pagamentos_excursao   ON pagamentos (excursao_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_passageiro ON pagamentos (passageiro_id);

-- ── CONTAS (custos da excursão) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS contas (
    id                  UUID PRIMARY KEY,
    excursao_id         UUID REFERENCES excursoes(id) ON DELETE CASCADE,
    fornecedor_id       UUID REFERENCES fornecedores(id) ON DELETE SET NULL,
    pacote_id           UUID REFERENCES pacotes(id) ON DELETE SET NULL,
    tipo_passageiro_id  UUID REFERENCES tipos_passageiro(id) ON DELETE SET NULL,
    nome                TEXT,
    categoria           TEXT,
    tipo_custo          TEXT,
    valor               NUMERIC(12,2),
    valor_unitario      NUMERIC(12,2),
    status              TEXT,
    vencimento          DATE,
    observacao          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contas_excursao ON contas (excursao_id);

-- ── SIMULAÇÕES (planejador) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS simulacoes (
    id                UUID PRIMARY KEY,
    excursao_id       UUID REFERENCES excursoes(id) ON DELETE SET NULL,
    nome              TEXT,
    destino           TEXT,
    tipo              TEXT,
    cor               TEXT,
    data_saida        DATE,
    data_retorno      DATE,
    vagas             INTEGER,
    valor_pax         NUMERIC(12,2),
    pax_minimo        INTEGER,
    pax_estimado      INTEGER,
    meta_ocupacao     NUMERIC(6,2),
    margem_desejada   NUMERIC(6,2),
    obs               TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_simulacoes_excursao ON simulacoes (excursao_id);

-- ── CUSTOS DE SIMULAÇÃO ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sim_custos (
    id          UUID PRIMARY KEY,
    sim_id      UUID REFERENCES simulacoes(id) ON DELETE CASCADE,
    nome        TEXT,
    categoria   TEXT,
    tipo        TEXT,
    valor       NUMERIC(12,2),
    obs         TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sim_custos_sim ON sim_custos (sim_id);

-- ── HISTÓRICO DE BACKUP ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS backup_historico (
    id            UUID PRIMARY KEY,
    tipo          TEXT,
    status        TEXT,
    tamanho       TEXT,
    nome_arquivo  TEXT,
    conteudo      JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── META (configurações/flags internas do app) ──────────────────────
CREATE TABLE IF NOT EXISTS meta (
    key         TEXT PRIMARY KEY,
    id          TEXT,
    value       JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
