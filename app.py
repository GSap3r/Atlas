# ==============================================
# ARQUIVO: ibexgo_python/app.py
# ==============================================
import os

from flask import Flask, send_from_directory
from dotenv import load_dotenv

load_dotenv()

from singleton.conexao import Conexao
from routes.store_routes import api_bp

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="")
app.register_blueprint(api_bp)


def inicializar_banco():
    """Cria as tabelas no PostgreSQL caso ainda não existam."""
    schema_path = os.path.join(BASE_DIR, "sql", "schema.sql")
    with open(schema_path, "r", encoding="utf-8") as f:
        schema_sql = f.read()

    conn = Conexao.obter()
    try:
        with conn.cursor() as cur:
            cur.execute(schema_sql)
        conn.commit()
        print("Banco de dados PostgreSQL inicializado com sucesso.")
    finally:
        Conexao.liberar(conn)


@app.get("/")
def home():
    return send_from_directory(STATIC_DIR, "index.html")


@app.get("/<path:filename>")
def arquivos_estaticos(filename):
    return send_from_directory(STATIC_DIR, filename)


if __name__ == "__main__":
    inicializar_banco()
    app.run(debug=True, port=3000)
