# ==============================================
# ARQUIVO: atlas_python/model/store_model.py
# Camada de acesso a dados. Cada "store" do app
# (excursoes, passageiros, vendedores, ...) agora
# mora em sua própria tabela relacional (ver
# sql/schema.sql), com chaves estrangeiras de
# verdade entre elas, em vez de um único blob JSONB.
#
# A interface pública (get_all, get_by_id, save,
# remove, clear_store, export_all, import_all,
# marcar_alteracao) continua idêntica à versão
# anterior, então controller/routes/frontend não
# precisam mudar.
# ==============================================
import re
import unicodedata
import uuid
from datetime import datetime, timezone

import psycopg2.extras

from singleton.conexao import Conexao

# Config declarativa: para cada store, o nome da tabela SQL e o
# mapeamento campoJson -> (colunaSql, tipo). "tipo" controla como o
# valor é convertido ao gravar (_to_sql) e ao ler (_from_sql).
# A ordem das chaves aqui também é a ordem segura de import/export
# (quem não depende de ninguém primeiro, dependentes depois), usada
# por import_all e por scripts/importar_backup.py.
TABLES = {
    "tiposPassageiro": {
        "table": "tipos_passageiro", "key_field": "id", "key_column": "id", "key_kind": "uuid",
        "columns": [
            ("nome", "nome", "text"),
            ("descricao", "descricao", "text"),
            ("ordem", "ordem", "int"),
            ("pagante", "pagante", "bool"),
            ("ocupaVaga", "ocupa_vaga", "bool"),
            ("entraNoFinanceiro", "entra_no_financeiro", "bool"),
            ("entraNaListaEmbarque", "entra_na_lista_embarque", "bool"),
            ("ativo", "ativo", "bool"),
        ],
    },
    "fornecedores": {
        "table": "fornecedores", "key_field": "id", "key_column": "id", "key_kind": "uuid",
        "columns": [
            ("nome", "nome", "text"),
            ("categoria", "categoria", "text"),
            ("contato", "contato", "text"),
            ("documento", "documento", "text"),
            ("telefone", "telefone", "text"),
            ("whatsapp", "whatsapp", "text"),
            ("observacoes", "observacoes", "text"),
            ("ativo", "ativo", "bool"),
        ],
    },
    "vendedores": {
        "table": "vendedores", "key_field": "id", "key_column": "id", "key_kind": "uuid",
        "columns": [
            ("nome", "nome", "text"),
            ("documento", "documento", "text"),
            ("whatsapp", "whatsapp", "text"),
            ("observacoes", "observacoes", "text"),
            ("ativo", "ativo", "bool"),
            ("comissaoPercentual", "comissao_percentual", "numeric"),
        ],
    },
    "excursoes": {
        "table": "excursoes", "key_field": "id", "key_column": "id", "key_kind": "uuid",
        "columns": [
            ("nome", "nome", "text"),
            ("destino", "destino", "text"),
            ("dataSaida", "data_saida", "date"),
            ("dataRetorno", "data_retorno", "date"),
            ("horario", "horario", "text"),
            ("localEmbarque", "local_embarque", "text"),
            ("pontosEmbarque", "pontos_embarque", "text"),
            ("vagas", "vagas", "int"),
            ("valorPassageiro", "valor_passageiro", "numeric"),
            ("observacoes", "observacoes", "text"),
            ("cor", "cor", "text"),
            ("statusManual", "status_manual", "text"),
        ],
    },
    "pacotes": {
        "table": "pacotes", "key_field": "id", "key_column": "id", "key_kind": "uuid",
        "columns": [
            ("excursaoId", "excursao_id", "uuid"),
            ("tipoPassageiroPadraoId", "tipo_passageiro_padrao_id", "uuid"),
            ("nome", "nome", "text"),
            ("descricao", "descricao", "text"),
            ("valorVenda", "valor_venda", "numeric"),
            ("custoEstimado", "custo_estimado", "numeric"),
            ("ativo", "ativo", "bool"),
            ("observacoes", "observacoes", "text"),
        ],
    },
    "reservas": {
        "table": "reservas", "key_field": "id", "key_column": "id", "key_kind": "uuid",
        "columns": [
            ("excursaoId", "excursao_id", "uuid"),
            ("codigo", "codigo", "text"),
            ("titular", "titular", "text"),
            ("telefoneTitular", "telefone_titular", "text"),
            ("observacoes", "observacoes", "text"),
        ],
    },
    # "passageiros" tem lógica própria (junta com clientes) — ver
    # PASSAGEIRO_FIELDS / CLIENTE_FIELDS e os métodos _*_passageiro*.
    "passageiros": {"table": "passageiros", "key_field": "id", "key_column": "id", "key_kind": "uuid"},
    "pagamentos": {
        "table": "pagamentos", "key_field": "id", "key_column": "id", "key_kind": "uuid",
        "columns": [
            ("excursaoId", "excursao_id", "uuid"),
            ("passageiroId", "passageiro_id", "uuid"),
            ("valor", "valor", "numeric"),
            ("status", "status", "text"),
            ("forma", "forma", "text"),
            ("origem", "origem", "text"),
            ("parcela", "parcela", "text"),
            ("data", "data", "date"),
            ("vencimento", "vencimento", "date"),
            ("diaVencimento", "dia_vencimento", "text"),
            ("observacao", "observacao", "text"),
        ],
    },
    "contas": {
        "table": "contas", "key_field": "id", "key_column": "id", "key_kind": "uuid",
        "columns": [
            ("excursaoId", "excursao_id", "uuid"),
            ("fornecedorId", "fornecedor_id", "uuid"),
            ("pacoteId", "pacote_id", "uuid"),
            ("tipoPassageiroId", "tipo_passageiro_id", "uuid"),
            ("nome", "nome", "text"),
            ("categoria", "categoria", "text"),
            ("tipoCusto", "tipo_custo", "text"),
            ("valor", "valor", "numeric"),
            ("valorUnitario", "valor_unitario", "numeric"),
            ("status", "status", "text"),
            ("vencimento", "vencimento", "date"),
            ("observacao", "observacao", "text"),
        ],
    },
    "simulacoes": {
        "table": "simulacoes", "key_field": "id", "key_column": "id", "key_kind": "uuid",
        "columns": [
            ("excursaoId", "excursao_id", "uuid"),
            ("nome", "nome", "text"),
            ("destino", "destino", "text"),
            ("tipo", "tipo", "text"),
            ("cor", "cor", "text"),
            ("dataSaida", "data_saida", "date"),
            ("dataRetorno", "data_retorno", "date"),
            ("vagas", "vagas", "int"),
            ("valorPax", "valor_pax", "numeric"),
            ("paxMinimo", "pax_minimo", "int"),
            ("paxEstimado", "pax_estimado", "int"),
            ("metaOcupacao", "meta_ocupacao", "numeric"),
            ("margemDesejada", "margem_desejada", "numeric"),
            ("obs", "obs", "text"),
        ],
    },
    "simCustos": {
        "table": "sim_custos", "key_field": "id", "key_column": "id", "key_kind": "uuid",
        "columns": [
            ("simId", "sim_id", "uuid"),
            ("nome", "nome", "text"),
            ("categoria", "categoria", "text"),
            ("tipo", "tipo", "text"),
            ("valor", "valor", "numeric"),
            ("obs", "obs", "text"),
        ],
    },
    "backupHistorico": {
        "table": "backup_historico", "key_field": "id", "key_column": "id", "key_kind": "uuid",
        "columns": [
            ("tipo", "tipo", "text"),
            ("status", "status", "text"),
            ("tamanho", "tamanho", "text"),
            ("nomeArquivo", "nome_arquivo", "text"),
            ("conteudo", "conteudo", "jsonb"),
        ],
    },
    "meta": {
        "table": "meta", "key_field": "key", "key_column": "key", "key_kind": "text",
        "columns": [
            ("id", "id", "text"),
            ("value", "value", "jsonb"),
        ],
    },
}

# Mantido por compatibilidade: controller/store_controller.py usa isso
# só para validar se a store existe (`store not in STORES`). A ordem
# das chaves é a ordem segura de import (respeita FKs).
STORES = {name: cfg["key_field"] for name, cfg in TABLES.items()}

# Stores que dependem de excursao_id/etc. e por isso devem ser
# importadas DEPOIS das tabelas que elas referenciam.
IMPORT_ORDER = [s for s in STORES if s != "backupHistorico"]

# Campos de "cliente" que hoje vêm embutidos no passageiro e passam a
# morar na tabela clientes (com deduplicação).
CLIENTE_FIELDS = [
    ("nome", "nome", "text"),
    ("documento", "documento", "text"),
    ("rg", "rg", "text"),
    ("telefone", "telefone", "text"),
    ("cidade", "cidade", "text"),
    ("nascimento", "nascimento", "date"),
    ("emergencia", "emergencia", "text"),
]

# Campos do passageiro em si (a venda/reserva), sem os dados pessoais
# do cliente (que ficam em CLIENTE_FIELDS).
PASSAGEIRO_FIELDS = [
    ("excursaoId", "excursao_id", "uuid"),
    ("vendedorId", "vendedor_id", "uuid"),
    ("tipoPassageiroId", "tipo_passageiro_id", "uuid"),
    ("pacoteId", "pacote_id", "uuid"),
    ("reservaId", "reserva_id", "uuid"),
    ("status", "status", "text"),
    ("assento", "assento", "text"),
    ("codigoReserva", "codigo_reserva", "text"),
    ("titularReserva", "titular_reserva", "text"),
    ("pontoEmbarque", "ponto_embarque", "text"),
    ("formaPreferida", "forma_preferida", "text"),
    ("valorBase", "valor_base", "numeric"),
    ("valorCombinado", "valor_combinado", "numeric"),
    ("valorFinal", "valor_final", "numeric"),
    ("entrada", "entrada", "numeric"),
    ("desconto", "desconto", "numeric"),
    ("taxaCartao", "taxa_cartao", "numeric"),
    ("taxaCartaoRaw", "taxa_cartao_raw", "numeric"),
    ("tipoTaxa", "tipo_taxa", "text"),
    ("numParcelas", "num_parcelas", "text"),
    ("diaVencimento", "dia_vencimento", "text"),
    ("_criarParcelas", "criar_parcelas", "bool"),
    ("observacoes", "observacoes", "text"),
]

_PASSAGEIRO_SELECT = """
    SELECT p.id, p.excursao_id, p.vendedor_id, p.tipo_passageiro_id, p.pacote_id, p.reserva_id,
           p.status, p.assento, p.codigo_reserva, p.titular_reserva, p.ponto_embarque, p.forma_preferida,
           p.valor_base, p.valor_combinado, p.valor_final, p.entrada, p.desconto, p.taxa_cartao,
           p.taxa_cartao_raw, p.tipo_taxa, p.num_parcelas, p.dia_vencimento, p.criar_parcelas,
           p.observacoes, p.created_at, p.updated_at,
           c.nome, c.documento, c.rg, c.telefone, c.cidade, c.nascimento, c.emergencia
    FROM passageiros p
    LEFT JOIN clientes c ON c.id = p.cliente_id
"""


# ── Helpers de conexão/transação ────────────────────────────────────
def _execute(sql, params=None, fetch=None):
    conn = Conexao.obter()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            if fetch == "all":
                result = cur.fetchall()
            elif fetch == "one":
                result = cur.fetchone()
            else:
                result = None
        conn.commit()
        return result
    except Exception:
        conn.rollback()
        raise
    finally:
        Conexao.liberar(conn)


def _transaction(fn):
    conn = Conexao.obter()
    try:
        with conn.cursor() as cur:
            result = fn(cur)
        conn.commit()
        return result
    except Exception:
        conn.rollback()
        raise
    finally:
        Conexao.liberar(conn)


# ── Conversão de tipos entre JSON (frontend) e SQL ──────────────────
def _valid_uuid(value):
    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, AttributeError, TypeError):
        return False


def _to_sql(value, kind):
    if kind == "jsonb":
        return psycopg2.extras.Json(value) if value is not None else None
    if value == "" and kind in ("int", "numeric", "date", "uuid"):
        return None
    return value


def _from_sql(value, kind):
    if value is None:
        return None
    if kind == "numeric":
        return float(value)
    if kind in ("date", "timestamp"):
        return value.isoformat()
    if kind == "uuid":
        return str(value)
    return value


def _select_cols(cfg):
    return [cfg["key_column"]] + [sc for _, sc, _ in cfg["columns"]] + ["created_at", "updated_at"]


def _row_to_item(cfg, row):
    item = {cfg["key_field"]: _from_sql(row[cfg["key_column"]], cfg["key_kind"])}
    for json_key, sql_col, kind in cfg["columns"]:
        item[json_key] = _from_sql(row[sql_col], kind)
    item["createdAt"] = _from_sql(row["created_at"], "timestamp")
    item["updatedAt"] = _from_sql(row["updated_at"], "timestamp")
    return item


def _passageiro_row_to_item(row):
    return {
        "id": str(row["id"]),
        "excursaoId": _from_sql(row["excursao_id"], "uuid"),
        "vendedorId": _from_sql(row["vendedor_id"], "uuid"),
        "tipoPassageiroId": _from_sql(row["tipo_passageiro_id"], "uuid"),
        "pacoteId": _from_sql(row["pacote_id"], "uuid"),
        "reservaId": _from_sql(row["reserva_id"], "uuid"),
        "status": row["status"],
        "assento": row["assento"],
        "codigoReserva": row["codigo_reserva"],
        "titularReserva": row["titular_reserva"],
        "pontoEmbarque": row["ponto_embarque"],
        "formaPreferida": row["forma_preferida"],
        "valorBase": _from_sql(row["valor_base"], "numeric"),
        "valorCombinado": _from_sql(row["valor_combinado"], "numeric"),
        "valorFinal": _from_sql(row["valor_final"], "numeric"),
        "entrada": _from_sql(row["entrada"], "numeric"),
        "desconto": _from_sql(row["desconto"], "numeric"),
        "taxaCartao": _from_sql(row["taxa_cartao"], "numeric"),
        "taxaCartaoRaw": _from_sql(row["taxa_cartao_raw"], "numeric"),
        "tipoTaxa": row["tipo_taxa"],
        "numParcelas": row["num_parcelas"],
        "diaVencimento": row["dia_vencimento"],
        "_criarParcelas": bool(row["criar_parcelas"]),
        "observacoes": row["observacoes"],
        "createdAt": _from_sql(row["created_at"], "timestamp"),
        "updatedAt": _from_sql(row["updated_at"], "timestamp"),
        "nome": row["nome"],
        "documento": row["documento"],
        "rg": row["rg"],
        "telefone": row["telefone"],
        "cidade": row["cidade"],
        "nascimento": _from_sql(row["nascimento"], "date"),
        "emergencia": row["emergencia"],
    }


# ── Deduplicação de clientes (mesma lógica de clienteKey() no
# frontend: app-global.js) ──────────────────────────────────────────
def _cliente_key(item):
    doc = re.sub(r"\D", "", str(item.get("documento") or item.get("rg") or ""))
    if doc:
        return "doc:" + doc
    tel = re.sub(r"\D", "", str(item.get("telefone") or item.get("whatsapp") or ""))
    if tel:
        return "tel:" + tel
    nome = unicodedata.normalize("NFD", str(item.get("nome") or ""))
    nome = "".join(ch for ch in nome if unicodedata.category(ch) != "Mn")
    nome = re.sub(r"[^a-z0-9]+", " ", nome.lower()).strip()
    return "nome:" + nome


def _cliente_values(item):
    return [_to_sql(item.get(jk), kind) for jk, _, kind in CLIENTE_FIELDS]


def _find_or_create_cliente(cur, item):
    key = _cliente_key(item)
    cur.execute("SELECT id FROM clientes WHERE chave_dedupe = %s", (key,))
    row = cur.fetchone()
    if row:
        return row["id"]

    cliente_id = str(uuid.uuid4())
    col_names = [sc for _, sc, _ in CLIENTE_FIELDS]
    cols_sql = ", ".join(["id"] + col_names + ["chave_dedupe"])
    placeholders = ", ".join(["%s"] * (len(col_names) + 2))
    cur.execute(
        f"INSERT INTO clientes ({cols_sql}, created_at, updated_at) "
        f"VALUES ({placeholders}, now(), now())",
        (cliente_id, *_cliente_values(item), key),
    )
    return cliente_id


def _update_cliente(cur, cliente_id, item):
    key = _cliente_key(item)
    # Se outro cliente já é dono dessa chave (ex.: documento preenchido
    # agora bate com um cliente já cadastrado), funde nele em vez de
    # violar a constraint única de chave_dedupe.
    cur.execute("SELECT id FROM clientes WHERE chave_dedupe = %s AND id <> %s", (key, cliente_id))
    other = cur.fetchone()
    target_id = other["id"] if other else cliente_id

    col_names = [sc for _, sc, _ in CLIENTE_FIELDS]
    set_clause = ", ".join(f"{c} = %s" for c in col_names)
    values = _cliente_values(item)
    if other:
        cur.execute(f"UPDATE clientes SET {set_clause}, updated_at = now() WHERE id = %s", (*values, target_id))
    else:
        cur.execute(
            f"UPDATE clientes SET {set_clause}, chave_dedupe = %s, updated_at = now() WHERE id = %s",
            (*values, key, target_id),
        )
    return target_id


class StoreModel:

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    # ── Passageiros (caso especial: junta com clientes) ─────────────
    @classmethod
    def _get_all_passageiros(cls):
        rows = _execute(_PASSAGEIRO_SELECT + " ORDER BY p.updated_at", fetch="all")
        return [_passageiro_row_to_item(r) for r in rows]

    @classmethod
    def _get_passageiro_by_id(cls, item_id):
        if not _valid_uuid(item_id):
            return None
        row = _execute(_PASSAGEIRO_SELECT + " WHERE p.id = %s", (item_id,), fetch="one")
        return _passageiro_row_to_item(row) if row else None

    @classmethod
    def _save_passageiro(cls, item: dict):
        if not item.get("id"):
            item["id"] = str(uuid.uuid4())
        passageiro_id = item["id"]

        col_names = [sc for _, sc, _ in PASSAGEIRO_FIELDS]
        values = [_to_sql(item.get(jk), kind) for jk, _, kind in PASSAGEIRO_FIELDS]

        def _do(cur):
            cur.execute("SELECT cliente_id FROM passageiros WHERE id = %s", (passageiro_id,))
            existing = cur.fetchone()

            if existing and existing["cliente_id"]:
                cliente_id = _update_cliente(cur, existing["cliente_id"], item)
            else:
                cliente_id = _find_or_create_cliente(cur, item)

            if existing:
                set_clause = ", ".join(f"{c} = %s" for c in col_names)
                cur.execute(
                    f"UPDATE passageiros SET {set_clause}, cliente_id = %s, updated_at = now() WHERE id = %s",
                    (*values, cliente_id, passageiro_id),
                )
            else:
                presentes = [(jk, sc, kind) for jk, sc, kind in PASSAGEIRO_FIELDS if jk in item]
                cols_ins = [sc for _, sc, _ in presentes]
                vals_ins = [_to_sql(item.get(jk), kind) for jk, _, kind in presentes]
                cols_sql = ", ".join(["id"] + cols_ins + ["cliente_id"])
                placeholders = ", ".join(["%s"] * (len(cols_ins) + 2))
                cur.execute(
                    f"INSERT INTO passageiros ({cols_sql}, created_at, updated_at) "
                    f"VALUES ({placeholders}, now(), now())",
                    (passageiro_id, *vals_ins, cliente_id),
                )

        _transaction(_do)
        return cls.get_by_id("passageiros", passageiro_id)

    # ── API genérica (demais stores) ─────────────────────────────────
    @classmethod
    def get_all(cls, store: str):
        if store == "passageiros":
            return cls._get_all_passageiros()
        cfg = TABLES[store]
        sql = f"SELECT {', '.join(_select_cols(cfg))} FROM {cfg['table']} ORDER BY updated_at"
        rows = _execute(sql, fetch="all")
        return [_row_to_item(cfg, r) for r in rows]

    @classmethod
    def get_by_id(cls, store: str, item_id: str):
        if store == "passageiros":
            return cls._get_passageiro_by_id(item_id)
        cfg = TABLES[store]
        if cfg["key_kind"] == "uuid" and not _valid_uuid(item_id):
            return None
        sql = f"SELECT {', '.join(_select_cols(cfg))} FROM {cfg['table']} WHERE {cfg['key_column']} = %s"
        row = _execute(sql, (item_id,), fetch="one")
        return _row_to_item(cfg, row) if row else None

    @classmethod
    def save(cls, store: str, item: dict):
        if store == "passageiros":
            return cls._save_passageiro(item)

        cfg = TABLES[store]
        key_field = cfg["key_field"]
        if not item.get(key_field):
            item[key_field] = str(uuid.uuid4())
        key_value = item[key_field]

        col_names = [sc for _, sc, _ in cfg["columns"]]
        values = [_to_sql(item.get(jk), kind) for jk, _, kind in cfg["columns"]]

        def _do(cur):
            cur.execute(f"SELECT 1 FROM {cfg['table']} WHERE {cfg['key_column']} = %s", (key_value,))
            exists = cur.fetchone() is not None
            if exists:
                set_clause = ", ".join(f"{c} = %s" for c in col_names)
                cur.execute(
                    f"UPDATE {cfg['table']} SET {set_clause}, updated_at = now() WHERE {cfg['key_column']} = %s",
                    (*values, key_value),
                )
            else:
                # Numa linha nova, só grava as colunas que vieram no
                # payload — as ausentes ficam de fora do INSERT para
                # que o DEFAULT da coluna (ex.: ativo = true) valha,
                # em vez de forçar NULL e violar NOT NULL.
                presentes = [(jk, sc, kind) for jk, sc, kind in cfg["columns"] if jk in item]
                cols_ins = [sc for _, sc, _ in presentes]
                vals_ins = [_to_sql(item.get(jk), kind) for jk, _, kind in presentes]
                cols_sql = ", ".join([cfg["key_column"]] + cols_ins)
                placeholders = ", ".join(["%s"] * (len(cols_ins) + 1))
                cur.execute(
                    f"INSERT INTO {cfg['table']} ({cols_sql}, created_at, updated_at) "
                    f"VALUES ({placeholders}, now(), now())",
                    (key_value, *vals_ins),
                )

        _transaction(_do)
        return cls.get_by_id(store, key_value)

    @classmethod
    def remove(cls, store: str, item_id: str):
        cfg = TABLES[store]
        if cfg["key_kind"] == "uuid" and not _valid_uuid(item_id):
            return
        _execute(f"DELETE FROM {cfg['table']} WHERE {cfg['key_column']} = %s", (item_id,))

    @classmethod
    def clear_store(cls, store: str):
        cfg = TABLES[store]
        _execute(f"DELETE FROM {cfg['table']}")

    @classmethod
    def export_all(cls):
        data = {}
        for store in STORES:
            try:
                data[store] = cls.get_all(store)
            except Exception:
                data[store] = []

        # Igual ao comportamento original: não incluir o conteúdo bruto
        # de backups anteriores dentro de um novo backup.
        if isinstance(data.get("backupHistorico"), list):
            data["backupHistorico"] = [
                {k: v for k, v in item.items() if k != "conteudo"}
                for item in data["backupHistorico"]
            ]

        return {
            "app": "Atlas Organizador de Excursões",
            "version": 3,
            "exportedAt": cls._now_iso(),
            "data": data,
        }

    @classmethod
    def import_all(cls, raw_data: dict):
        data = raw_data.get("data", raw_data)

        try:
            _execute("DELETE FROM clientes")
        except Exception:
            pass
        for store in IMPORT_ORDER:
            try:
                cls.clear_store(store)
            except Exception:
                pass

        for store in IMPORT_ORDER:
            items = data.get(store)
            if not items:
                continue
            for item in items:
                try:
                    cls.save(store, item)
                except Exception:
                    pass

    @classmethod
    def marcar_alteracao(cls):
        try:
            cls.save("meta", {"key": "lastDataChangeAt", "value": cls._now_iso()})
        except Exception:
            pass
