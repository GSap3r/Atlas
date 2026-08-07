# ==============================================
# ARQUIVO: ibexgo_python/scripts/importar_backup.py
# Importa um backup JSON exportado pelo ibexGo
# (o mesmo formato do botão "Exportar" do app, ou
# do arquivo colado pelo usuário) diretamente para
# o PostgreSQL.
#
# USO:
#   python scripts/importar_backup.py caminho/para/backup.json
# ==============================================
import json
import os
import sys

# Permite rodar este script a partir da pasta scripts/ OU da raiz do projeto
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv()

from singleton.conexao import Conexao
from model.store_model import StoreModel, STORES


def inicializar_banco():
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


def importar(caminho_json: str):
    with open(caminho_json, "r", encoding="utf-8") as f:
        raw = json.load(f)

    data = raw.get("data", raw)

    total = 0
    for store in STORES:
        itens = data.get(store) or []
        if not itens:
            print(f"  - {store}: 0 itens (ignorado)")
            continue
        for item in itens:
            StoreModel.save(store, item)
        print(f"  - {store}: {len(itens)} itens importados")
        total += len(itens)

    print(f"\nImportação concluída: {total} registros gravados no PostgreSQL.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: python scripts/importar_backup.py caminho/para/backup.json")
        sys.exit(1)

    print("Inicializando/checando schema do banco...")
    inicializar_banco()
    print(f"Importando backup: {sys.argv[1]}")
    importar(sys.argv[1])
