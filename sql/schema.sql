-- ==============================================
-- ibexGo - Schema PostgreSQL
-- Substitui o IndexedDB do navegador por um banco
-- relacional. Usamos uma tabela genérica (store_items)
-- porque o app original guarda "stores" (coleções)
-- com estruturas de item flexíveis (JSON), assim como
-- fazia o IndexedDB.
-- ==============================================

CREATE TABLE IF NOT EXISTS store_items (
    store       VARCHAR(50)  NOT NULL,
    item_id     VARCHAR(255) NOT NULL,
    data        JSONB        NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (store, item_id)
);

CREATE INDEX IF NOT EXISTS idx_store_items_store ON store_items (store);
CREATE INDEX IF NOT EXISTS idx_store_items_data  ON store_items USING GIN (data);
