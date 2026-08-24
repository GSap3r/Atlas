# ==============================================
# ARQUIVO: atlas_python/app.py
# ==============================================
import os
import secrets

from flask import Flask, jsonify, send_from_directory
from dotenv import load_dotenv

load_dotenv()

from singleton.conexao import Conexao
from routes.store_routes import api_bp
from routes.auth_routes import auth_bp
from controller.auth_controller import AuthController
from model.auth_model import AuthModel

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="")
_secret_key = os.getenv("SECRET_KEY")
if not _secret_key:
    _secret_key = secrets.token_hex(32)
    print("AVISO: SECRET_KEY não definida no .env — gerando uma temporária.")
    print("       Todos os logins serão perdidos a cada reinício do servidor.")
    print("       Defina SECRET_KEY no .env para sessões persistentes.")
app.secret_key = _secret_key


@api_bp.before_request
def exigir_login():
    """Toda a API de dados (/api/<store>...) exige uma sessão válida.
    As rotas de /api/auth/* ficam de fora (blueprint separado)."""
    if not AuthController.usuario_logado():
        return jsonify({"erro": "não autenticado"}), 401


app.register_blueprint(api_bp)
app.register_blueprint(auth_bp)


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

    AuthModel.bootstrap_admin_se_vazio()


@app.get("/")
def home():
    return send_from_directory(STATIC_DIR, "index.html")


@app.get("/<path:filename>")
def arquivos_estaticos(filename):
    return send_from_directory(STATIC_DIR, filename)


if __name__ == "__main__":
    inicializar_banco()
    app.run(debug=True, port=3000)

