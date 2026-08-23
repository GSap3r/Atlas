# ==============================================
# ARQUIVO: atlas_python/routes/auth_routes.py
# ==============================================
from functools import wraps

from flask import Blueprint, jsonify, request, session

from controller.auth_controller import AuthController

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not AuthController.usuario_logado():
            return jsonify({"erro": "não autenticado"}), 401
        return fn(*args, **kwargs)
    return wrapper


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = AuthController.usuario_logado()
        if not user:
            return jsonify({"erro": "não autenticado"}), 401
        if user.get("role") != "admin":
            return jsonify({"erro": "acesso restrito ao administrador"}), 403
        return fn(*args, **kwargs)
    return wrapper


@auth_bp.post("/login")
def login():
    return AuthController.login(request.get_json(force=True, silent=True))


@auth_bp.post("/logout")
def logout():
    return AuthController.logout()


@auth_bp.get("/me")
def me():
    return AuthController.me()


@auth_bp.post("/me/senha")
@login_required
def trocar_minha_senha():
    return AuthController.trocar_minha_senha(request.get_json(force=True, silent=True))


@auth_bp.get("/paginas")
@login_required
def paginas_validas():
    return AuthController.paginas_validas()


@auth_bp.get("/usuarios")
@admin_required
def listar_usuarios():
    return AuthController.listar_usuarios()


@auth_bp.post("/usuarios")
@admin_required
def salvar_usuario():
    return AuthController.criar_ou_atualizar_usuario(request.get_json(force=True, silent=True))


@auth_bp.post("/usuarios/<user_id>/desativar")
@admin_required
def desativar_usuario(user_id):
    if user_id == session.get("user_id"):
        return jsonify({"erro": "Você não pode desativar seu próprio usuário"}), 400
    return AuthController.alternar_ativo(user_id, False)


@auth_bp.post("/usuarios/<user_id>/reativar")
@admin_required
def reativar_usuario(user_id):
    return AuthController.alternar_ativo(user_id, True)
