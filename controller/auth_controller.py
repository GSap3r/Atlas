# ==============================================
# ARQUIVO: atlas_python/controller/auth_controller.py
# ==============================================
from flask import jsonify, session

from model.auth_model import PAGINAS_VALIDAS, AuthModel


class AuthController:

    @staticmethod
    def usuario_logado():
        user_id = session.get("user_id")
        if not user_id:
            return None
        user = AuthModel.get_by_id(user_id)
        if not user or not user.get("ativo"):
            return None
        return user

    # ── SESSÃO ───────────────────────────────────────────────────────
    @classmethod
    def login(cls, dados):
        dados = dados or {}
        username = (dados.get("username") or "").strip()
        senha = dados.get("senha") or ""
        if not username or not senha:
            return jsonify({"erro": "Informe usuário e senha"}), 400

        user = AuthModel.autenticar(username, senha)
        if not user:
            return jsonify({"erro": "Usuário ou senha inválidos"}), 401

        session.clear()
        session["user_id"] = user["id"]
        session.permanent = True
        return jsonify(user)

    @classmethod
    def logout(cls):
        session.clear()
        return jsonify({"ok": True})

    @classmethod
    def me(cls):
        user = cls.usuario_logado()
        if not user:
            return jsonify(None), 401
        return jsonify(user)

    @classmethod
    def trocar_minha_senha(cls, dados):
        user = cls.usuario_logado()
        if not user:
            return jsonify({"erro": "não autenticado"}), 401
        dados = dados or {}
        senha_atual = dados.get("senhaAtual") or ""
        nova_senha = dados.get("novaSenha") or ""
        if len(nova_senha) < 6:
            return jsonify({"erro": "A nova senha precisa ter pelo menos 6 caracteres"}), 400
        if not AuthModel.conferir_senha_atual(user["id"], senha_atual):
            return jsonify({"erro": "Senha atual incorreta"}), 400
        AuthModel.trocar_senha(user["id"], nova_senha, deve_trocar_senha=False)
        return jsonify({"ok": True})

    # ── ADMIN: GESTÃO DE USUÁRIOS ───────────────────────────────────
    @classmethod
    def listar_usuarios(cls):
        return jsonify(AuthModel.listar())

    @classmethod
    def criar_ou_atualizar_usuario(cls, dados):
        dados = dados or {}
        user_id = dados.get("id")
        username = (dados.get("username") or "").strip()
        nome = dados.get("nome") or ""
        role = dados.get("role") if dados.get("role") in ("admin", "user") else "user"
        paginas = dados.get("paginas") or []
        senha = dados.get("senha") or ""

        if not user_id:
            if not username:
                return jsonify({"erro": "Informe um login (usuário)"}), 400
            if AuthModel.username_existe(username):
                return jsonify({"erro": "Já existe um usuário com esse login"}), 400
            if len(senha) < 6:
                return jsonify({"erro": "A senha precisa ter pelo menos 6 caracteres"}), 400
            novo = AuthModel.criar(username, senha, nome, role, paginas)
            return jsonify(novo)

        if username and AuthModel.username_existe(username, ignorar_id=user_id):
            return jsonify({"erro": "Já existe um usuário com esse login"}), 400
        atualizado = AuthModel.atualizar(user_id, nome=nome, role=role, paginas=paginas)
        if senha:
            if len(senha) < 6:
                return jsonify({"erro": "A senha precisa ter pelo menos 6 caracteres"}), 400
            AuthModel.trocar_senha(user_id, senha, deve_trocar_senha=True)
            atualizado = AuthModel.get_by_id(user_id)
        return jsonify(atualizado)

    @classmethod
    def alternar_ativo(cls, user_id, ativo):
        atualizado = AuthModel.atualizar(user_id, ativo=ativo)
        if not atualizado:
            return jsonify({"erro": "Usuário não encontrado"}), 404
        return jsonify(atualizado)

    @classmethod
    def paginas_validas(cls):
        return jsonify(PAGINAS_VALIDAS)
