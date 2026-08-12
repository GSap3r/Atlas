# ==============================================
# ARQUIVO: atlas_python/model/store_model.py
# Camada de acesso a dados (equivalente ao antigo
# assets/js/db.js, porém falando com PostgreSQL)
# ==============================================
import json
import uuid
from datetime import datetime, timezone

from singleton.conexao import Conexao

# Mesma lista de "stores" que existia no IndexedDB (db.js),
# incluindo qual campo do item funciona como chave primária.
STORES = {
    "excursoes":       "id",
    "passageiros":      "id",
    "pagamentos":       "id",
    "contas":           "id",
    "meta":             "key",
    "tiposPassageiro":  "id",
    "fornecedores":     "id",
    "pacotes":          "id",
    "reservas":         "id",
    "simulacoes":       "id",
    "simCustos":        "id",
    "backupHistorico":  "id",
    "vendedores":       "id",
}


class StoreModel:

    @staticmethod
    def _key_field(store: str) -> str:
        return STORES.get(store, "id")

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    @classmethod
    def get_all(cls, store: str):
        conn = Conexao.obter()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT data FROM store_items WHERE store = %s ORDER BY updated_at",
                    (store,),
                )
                rows = cur.fetchall()
                return [row["data"] for row in rows]
        finally:
            Conexao.liberar(conn)

    @classmethod
    def get_by_id(cls, store: str, item_id: str):
        conn = Conexao.obter()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT data FROM store_items WHERE store = %s AND item_id = %s",
                    (store, str(item_id)),
                )
                row = cur.fetchone()
                return row["data"] if row else None
        finally:
            Conexao.liberar(conn)

    @classmethod
    def save(cls, store: str, item: dict):
        key_field = cls._key_field(store)
        if not item.get(key_field):
            item[key_field] = str(uuid.uuid4())

        item["updatedAt"] = cls._now_iso()
        if not item.get("createdAt"):
            item["createdAt"] = item["updatedAt"]

        item_id = str(item[key_field])
        conn = Conexao.obter()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO store_items (store, item_id, data, updated_at)
                    VALUES (%s, %s, %s, now())
                    ON CONFLICT (store, item_id)
                    DO UPDATE SET data = EXCLUDED.data, updated_at = now()
                    """,
                    (store, item_id, json.dumps(item)),
                )
            conn.commit()
            return item
        finally:
            Conexao.liberar(conn)

    @classmethod
    def remove(cls, store: str, item_id: str):
        conn = Conexao.obter()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM store_items WHERE store = %s AND item_id = %s",
                    (store, str(item_id)),
                )
            conn.commit()
        finally:
            Conexao.liberar(conn)

    @classmethod
    def clear_store(cls, store: str):
        conn = Conexao.obter()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM store_items WHERE store = %s", (store,))
            conn.commit()
        finally:
            Conexao.liberar(conn)

    @classmethod
    def export_all(cls):
        data = {}
        for store in STORES:
            try:
                data[store] = cls.get_all(store)
            except Exception:
                data[store] = []

        # Igual ao db.js original: não incluir o conteúdo bruto de backups
        # anteriores dentro de um novo backup (evita crescimento exponencial).
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
        stores_to_import = [s for s in STORES if s != "backupHistorico"]

        for store in stores_to_import:
            try:
                cls.clear_store(store)
            except Exception:
                pass

        for store in stores_to_import:
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
