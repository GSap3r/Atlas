# ==============================================
# ARQUIVO: atlas_python/routes/store_routes.py
# ==============================================
from flask import Blueprint, request

from controller.store_controller import StoreController

api_bp = Blueprint("api", __name__, url_prefix="/api")


@api_bp.get("/export")
def exportar():
    return StoreController.exportar()


@api_bp.post("/import")
def importar():
    return StoreController.importar(request.get_json(force=True, silent=True))


@api_bp.get("/<store>")
def listar(store):
    return StoreController.listar(store)


@api_bp.post("/<store>")
def salvar(store):
    return StoreController.salvar(store, request.get_json(force=True, silent=True))


@api_bp.delete("/<store>")
def limpar(store):
    return StoreController.limpar(store)


@api_bp.get("/<store>/<item_id>")
def obter(store, item_id):
    return StoreController.obter(store, item_id)


@api_bp.delete("/<store>/<item_id>")
def remover(store, item_id):
    return StoreController.remover(store, item_id)
