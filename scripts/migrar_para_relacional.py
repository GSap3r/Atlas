# ==============================================
# ARQUIVO: atlas_python/scripts/migrar_para_relacional.py
# Migra os dados da antiga tabela genérica
# "store_items" (um blob JSONB por item) para as
# novas tabelas relacionadas (sql/schema.sql).
#
# Seguro de rodar mais de uma vez:
#   - Se "store_items" não existir mais (já migrado
#     numa execução anterior), o script não faz nada.
#   - Se uma execução anterior falhou no meio, rodar
#     de novo apenas re-grava os itens (upsert) e
#     tenta novamente os que faltaram.
#   - A tabela antiga NUNCA é apagada, só renomeada
#     para "store_items_backup" ao final, como cópia
#     de segurança.
#
# USO:
#   python scripts/migrar_para_relacional.py
# ==============================================
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv()

from singleton.conexao import Conexao
from model.store_model import StoreModel, TABLES, _execute

# Diferente de IMPORT_ORDER (usado por import_all para restaurar um
# backup JSON, que propositalmente ignora backupHistorico para não
# aninhar backup-dentro-de-backup), esta migração precisa mover TODAS
# as stores que já existiam na tabela antiga, incluindo backupHistorico.
MIGRATION_ORDER = list(TABLES.keys())


def inicializar_schema():
    base_dir = os.path.join(os.path.dirname(__file__), "..")
    schema_path = os.path.join(base_dir, "sql", "schema.sql")
    with open(schema_path, "r", encoding="utf-8") as f:
        schema_sql = f.read()
    conn = Conexao.obter()
    try:
        with conn.cursor() as cur:
            cur.execute(schema_sql)
        conn.commit()
    finally:
        Conexao.liberar(conn)


def tabela_antiga_existe():
    row = _execute("SELECT to_regclass('public.store_items') AS t", fetch="one")
    return row["t"] is not None


def carregar_dados_antigos():
    rows = _execute(
        "SELECT store, item_id, data, created_at, updated_at FROM store_items ORDER BY store, created_at",
        fetch="all",
    )
    por_store = {}
    for r in rows:
        por_store.setdefault(r["store"], []).append(r)
    return por_store


def restaurar_timestamps(store, item_id, created_at, updated_at):
    cfg = TABLES[store]
    _execute(
        f"UPDATE {cfg['table']} SET created_at = %s, updated_at = %s WHERE {cfg['key_column']} = %s",
        (created_at, updated_at, item_id),
    )


def migrar():
    if not tabela_antiga_existe():
        print("Nenhuma tabela 'store_items' encontrada — nada para migrar "
              "(banco já está no formato novo, ou é uma instalação nova).")
        return

    print("1) Criando/garantindo as tabelas relacionadas (sql/schema.sql)...")
    inicializar_schema()

    print("2) Lendo dados da tabela antiga (store_items)...")
    dados_antigos = carregar_dados_antigos()
    total_antigo = sum(len(v) for v in dados_antigos.values())
    print(f"   {total_antigo} registros encontrados em {len(dados_antigos)} stores.")

    desconhecidos = set(dados_antigos) - set(TABLES)
    if desconhecidos:
        print(f"   AVISO: stores desconhecidas em store_items, NÃO migradas: {sorted(desconhecidos)}")

    print("\n3) Migrando para as tabelas relacionadas (na ordem que respeita as FKs)...")
    falhas = {}
    for store in MIGRATION_ORDER:
        linhas = dados_antigos.get(store, [])
        if not linhas:
            continue
        ok = 0
        erros = []
        key_field = TABLES[store]["key_field"]
        for linha in linhas:
            item = dict(linha["data"])
            item_id_original = item.get(key_field)
            try:
                salvo = StoreModel.save(store, item)
                restaurar_timestamps(store, salvo[key_field], linha["created_at"], linha["updated_at"])
                ok += 1
            except Exception as e:
                erros.append((item_id_original, str(e)))
        status = f"   - {store}: {ok}/{len(linhas)} migrados"
        if erros:
            status += f"  ({len(erros)} com erro)"
            falhas[store] = erros
        print(status)

    print("\n4) Conferindo contagens (antigo vs. novo)...")
    divergencias = False
    for store, linhas in dados_antigos.items():
        if store not in TABLES:
            continue
        novo = len(StoreModel.get_all(store))
        marcador = "OK" if novo == len(linhas) else "DIVERGENTE"
        if novo != len(linhas):
            divergencias = True
        print(f"   - {store}: antigo={len(linhas)} novo={novo}  [{marcador}]")

    if falhas:
        print("\n   Registros que falharam (referência quebrada ou dado inválido):")
        for store, erros in falhas.items():
            for item_id, msg in erros[:10]:
                print(f"   - {store} / {item_id}: {msg}")

    print("\n5) Renomeando store_items -> store_items_backup (nada foi apagado)...")
    _execute("ALTER TABLE store_items RENAME TO store_items_backup")

    print("\nMigração concluída." + (" Revise as divergências/erros acima." if (divergencias or falhas) else " Todas as contagens batem."))


if __name__ == "__main__":
    migrar()
