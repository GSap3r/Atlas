# ==============================================
# ARQUIVO: atlas_python/model/auth_model.py
# Login, usuários e permissão por página.
# Segue o mesmo padrão de acesso a dados de
# store_model.py (pool de conexão via singleton).
# ==============================================
import secrets
import uuid

import psycopg2.extras
from werkzeug.security import check_password_hash, generate_password_hash

from singleton.conexao import Conexao

PAGINAS_VALIDAS = [
    "dashboard", "excursoes", "cobrancas", "auditoria", "clientes",
    "tiposPassageiro", "fornecedores", "vendedores", "planejador",
    "configuracoes",
]

_COLUMNS = "id, username, nome, role, paginas, ativo, deve_trocar_senha, created_at, updated_at"


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


def _row_to_item(row):
    if row is None:
        return None
    item = dict(row)
    item.pop("senha_hash", None)  # nunca devolver o hash da senha pro frontend
    item["id"] = str(item["id"])
    item["createdAt"] = item.pop("created_at").isoformat() if item.get("created_at") else None
    item["updatedAt"] = item.pop("updated_at").isoformat() if item.get("updated_at") else None
    item["deveTrocarSenha"] = item.pop("deve_trocar_senha")
    item["paginas"] = item.get("paginas") or []
    return item


class AuthModel:

    # ── AUTENTICAÇÃO ──────────────────────────────────────────────────
    @classmethod
    def autenticar(cls, username, senha):
        row = _execute(
            "SELECT * FROM usuarios WHERE lower(username) = lower(%s)",
            (username or "",), fetch="one",
        )
        if not row or not row["ativo"]:
            return None
        if not check_password_hash(row["senha_hash"], senha or ""):
            return None
        return _row_to_item(row)

    @classmethod
    def get_by_id(cls, user_id):
        try:
            uuid.UUID(str(user_id))
        except (ValueError, AttributeError, TypeError):
            return None
        row = _execute(f"SELECT {_COLUMNS} FROM usuarios WHERE id = %s", (user_id,), fetch="one")
        return _row_to_item(row)

    # ── CRUD (admin) ─────────────────────────────────────────────────
    @classmethod
    def listar(cls):
        rows = _execute(f"SELECT {_COLUMNS} FROM usuarios ORDER BY username", fetch="all")
        return [_row_to_item(r) for r in rows]

    @classmethod
    def criar(cls, username, senha, nome, role, paginas):
        user_id = str(uuid.uuid4())
        senha_hash = generate_password_hash(senha)
        paginas = [p for p in (paginas or []) if p in PAGINAS_VALIDAS]
        _execute(
            """INSERT INTO usuarios (id, username, senha_hash, nome, role, paginas, ativo, created_at, updated_at)
               VALUES (%s, %s, %s, %s, %s, %s, true, now(), now())""",
            (user_id, username.strip(), senha_hash, nome or "", role or "user",
             psycopg2.extras.Json(paginas)),
        )
        return cls.get_by_id(user_id)

    @classmethod
    def atualizar(cls, user_id, nome=None, role=None, paginas=None, ativo=None):
        sets, params = [], []
        if nome is not None:
            sets.append("nome = %s"); params.append(nome)
        if role is not None:
            sets.append("role = %s"); params.append(role)
        if paginas is not None:
            paginas = [p for p in paginas if p in PAGINAS_VALIDAS]
            sets.append("paginas = %s"); params.append(psycopg2.extras.Json(paginas))
        if ativo is not None:
            sets.append("ativo = %s"); params.append(ativo)
        if not sets:
            return cls.get_by_id(user_id)
        sets.append("updated_at = now()")
        params.append(user_id)
        _execute(f"UPDATE usuarios SET {', '.join(sets)} WHERE id = %s", params)
        return cls.get_by_id(user_id)

    @classmethod
    def trocar_senha(cls, user_id, nova_senha, deve_trocar_senha=False):
        _execute(
            "UPDATE usuarios SET senha_hash = %s, deve_trocar_senha = %s, updated_at = now() WHERE id = %s",
            (generate_password_hash(nova_senha), deve_trocar_senha, user_id),
        )

    @classmethod
    def conferir_senha_atual(cls, user_id, senha):
        row = _execute("SELECT senha_hash FROM usuarios WHERE id = %s", (user_id,), fetch="one")
        return bool(row) and check_password_hash(row["senha_hash"], senha or "")

    @classmethod
    def username_existe(cls, username, ignorar_id=None):
        row = _execute(
            "SELECT id FROM usuarios WHERE lower(username) = lower(%s)",
            (username or "",), fetch="one",
        )
        return bool(row) and str(row["id"]) != str(ignorar_id)

    # ── BOOTSTRAP ────────────────────────────────────────────────────
    @classmethod
    def bootstrap_admin_se_vazio(cls):
        row = _execute("SELECT COUNT(*) AS n FROM usuarios", fetch="one")
        if row and row["n"] > 0:
            return
        senha = secrets.token_urlsafe(9)
        user_id = str(uuid.uuid4())
        _execute(
            """INSERT INTO usuarios (id, username, senha_hash, nome, role, paginas, ativo, deve_trocar_senha, created_at, updated_at)
               VALUES (%s, 'admin', %s, 'Administrador', 'admin', '[]', true, true, now(), now())""",
            (user_id, generate_password_hash(senha)),
        )
        print("=" * 60)
        print("Usuário admin criado automaticamente (primeira execução):")
        print("  login: admin")
        print(f"  senha: {senha}")
        print("Troque essa senha assim que entrar (Configurações > Usuários).")
        print("=" * 60)
