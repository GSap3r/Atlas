# ==============================================
# ARQUIVO: ibexgo_python/controller/store_controller.py
# ==============================================
from flask import jsonify

from model.store_model import StoreModel, STORES


class StoreController:

    @staticmethod
    def _check_store(store):
        if store not in STORES:
            return jsonify({"erro": f"store '{store}' não existe"}), 404
        return None

    @classmethod
    def listar(cls, store):
        erro = cls._check_store(store)
        if erro:
            return erro
        return jsonify(StoreModel.get_all(store))

    @classmethod
    def obter(cls, store, item_id):
        erro = cls._check_store(store)
        if erro:
            return erro
        item = StoreModel.get_by_id(store, item_id)
        if item is None:
            return jsonify(None), 404
        return jsonify(item)

    @classmethod
    def salvar(cls, store, item):
        erro = cls._check_store(store)
        if erro:
            return erro
        salvo = StoreModel.save(store, item or {})
        StoreModel.marcar_alteracao()
        return jsonify(salvo)

    @classmethod
    def remover(cls, store, item_id):
        erro = cls._check_store(store)
        if erro:
            return erro
        StoreModel.remove(store, item_id)
        StoreModel.marcar_alteracao()
        return jsonify({"ok": True})

    @classmethod
    def limpar(cls, store):
        erro = cls._check_store(store)
        if erro:
            return erro
        StoreModel.clear_store(store)
        StoreModel.marcar_alteracao()
        return jsonify({"ok": True})

    @classmethod
    def exportar(cls):
        return jsonify(StoreModel.export_all())

    @classmethod
    def importar(cls, raw_data):
        StoreModel.import_all(raw_data or {})
        return jsonify({"ok": True})
