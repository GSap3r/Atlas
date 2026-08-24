# ==============================================
# ARQUIVO: atlas_python/scripts/resetar_senha_admin.py
# Reseta (ou cria, se não existir nenhum) a senha do
# usuário administrador — útil quando a senha gerada
# automaticamente na primeira execução foi perdida.
#
# USO:
#   python scripts/resetar_senha_admin.py
#   python scripts/resetar_senha_admin.py minhaSenhaNova
#   python scripts/resetar_senha_admin.py minhaSenhaNova outro_login
# ==============================================
import os
import sys
import uuid
import secrets

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv()

from werkzeug.security import generate_password_hash

from singleton.conexao import Conexao


def resetar(nova_senha: str, username: str = "admin"):
    conn = Conexao.obter()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM usuarios WHERE lower(username) = lower(%s)", (username,))
            row = cur.fetchone()
            senha_hash = generate_password_hash(nova_senha)
            if row:
                cur.execute(
                    """UPDATE usuarios SET senha_hash = %s, role = 'admin', ativo = true,
                       deve_trocar_senha = true, updated_at = now() WHERE id = %s""",
                    (senha_hash, row["id"]),
                )
                print(f"Senha do usuário '{username}' foi redefinida.")
            else:
                cur.execute(
                    """INSERT INTO usuarios (id, username, senha_hash, nome, role, paginas, ativo, deve_trocar_senha, created_at, updated_at)
                       VALUES (%s, %s, %s, 'Administrador', 'admin', '[]', true, true, now(), now())""",
                    (str(uuid.uuid4()), username, senha_hash),
                )
                print(f"Usuário admin '{username}' não existia — foi criado.")
        conn.commit()
    finally:
        Conexao.liberar(conn)


if __name__ == "__main__":
    nova_senha = sys.argv[1] if len(sys.argv) > 1 else secrets.token_urlsafe(9)
    username = sys.argv[2] if len(sys.argv) > 2 else "admin"
    resetar(nova_senha, username)
    print("=" * 50)
    print(f"  login: {username}")
    print(f"  senha: {nova_senha}")
    print("Troque essa senha assim que entrar (Configurações > Usuários).")
    print("=" * 50)
