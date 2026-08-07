# ==============================================
# ARQUIVO: ibexgo_python/singleton/conexao.py
# Conexão com PostgreSQL (Singleton + pool)
# ==============================================
import os
from psycopg2 import pool
from psycopg2.extras import RealDictCursor


def _config():
    return {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(os.getenv("DB_PORT", "5432")),
        "dbname": os.getenv("DB_NAME", "ibexgo"),
        "user": os.getenv("DB_USER", "postgres"),
        "password": os.getenv("DB_PASSWORD", "postgres"),
    }


class ConexaoSingleton:
    """Mantém um único pool de conexões PostgreSQL para toda a aplicação."""
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cfg = _config()
            cls._instance._pool = pool.SimpleConnectionPool(
                minconn=1,
                maxconn=int(os.getenv("DB_POOL_MAX", "10")),
                cursor_factory=RealDictCursor,
                **cfg,
            )
        return cls._instance

    def getconn(self):
        return self._pool.getconn()

    def putconn(self, conn):
        self._pool.putconn(conn)

    def closeall(self):
        self._pool.closeall()


class Conexao:
    """Fachada simples para pegar/devolver conexões do pool singleton."""

    @staticmethod
    def obter():
        return ConexaoSingleton().getconn()

    @staticmethod
    def liberar(conn):
        ConexaoSingleton().putconn(conn)
