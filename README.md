# ibexGo — versão Python + PostgreSQL

Este projeto é uma adaptação do **ibexGo** (que originalmente rodava 100% no
navegador, salvando tudo no **IndexedDB**) para uma arquitetura
**cliente/servidor**:

- **Backend:** Python (Flask), seguindo o padrão `singleton / model /
  controller / routes` (o mesmo estilo do outro projeto de vocês em Flask).
- **Banco de dados:** PostgreSQL, no lugar do IndexedDB do navegador.
- **Frontend:** o mesmo HTML/CSS/JS original (pasta `static/`), sem nenhuma
  mudança de interface ou de regra de negócio. A única alteração foi no
  arquivo `assets/js/db.js`, que antes falava direto com o IndexedDB e agora
  faz chamadas `fetch` para a API Python. Como a assinatura das funções
  (`open`, `getAll`, `getById`, `save`, `remove`, `clearStore`, `exportAll`,
  `importAll`, `marcarAlteracao`) foi mantida idêntica, todos os outros
  arquivos (`app-core.js`, `app-excursao.js`, `app-global.js`,
  `app-excel.js`, `planner.js`, `backup.js`, etc.) continuam funcionando sem
  alteração.

## Estrutura

```
ibexgo_python/
├── app.py                     # cria as tabelas e sobe o servidor Flask
├── requirements.txt
├── .env.example
├── singleton/
│   └── conexao.py             # pool de conexões PostgreSQL (Singleton)
├── model/
│   └── store_model.py         # acesso a dados (equivalente ao antigo db.js)
├── controller/
│   └── store_controller.py    # regras de request/response
├── routes/
│   └── store_routes.py        # rotas /api/...
├── sql/
│   └── schema.sql             # schema PostgreSQL
└── static/                    # frontend original (HTML/CSS/JS)
    ├── index.html             # era "Abrir Organizador.html"
    └── assets/
        └── js/db.js           # reescrito para falar com a API
```

## Por que uma tabela genérica (`store_items`)?

O IndexedDB original guardava várias "stores" (`excursoes`, `passageiros`,
`pagamentos`, `contas`, `meta`, `tiposPassageiro`, `fornecedores`,
`pacotes`, `reservas`, `simulacoes`, `simCustos`, `backupHistorico`), cada
uma com objetos JSON de formato flexível. Para preservar 100% da
compatibilidade com as ~8.000 linhas de JavaScript que já manipulam esses
objetos, o PostgreSQL guarda cada item como uma linha em `store_items`, com
o JSON completo numa coluna `JSONB`:

```sql
store_items (store, item_id, data JSONB, created_at, updated_at)
```

Isso reproduz o comportamento do IndexedDB (um "objectStore" por chave,
identificado por `id` — ou por `key`, no caso de `meta`) usando um banco
relacional de verdade, com índice GIN em `data` para permitir consultas
dentro do JSON se precisar no futuro.

## API REST exposta pelo backend

| Método | Rota                | Ação                                   |
|--------|----------------------|-----------------------------------------|
| GET    | `/api/<store>`       | lista todos os itens da coleção        |
| GET    | `/api/<store>/<id>`  | busca um item pelo id                  |
| POST   | `/api/<store>`       | cria/atualiza um item (upsert)         |
| DELETE | `/api/<store>/<id>`  | remove um item                         |
| DELETE | `/api/<store>`       | limpa a coleção inteira                |
| GET    | `/api/export`        | exporta todos os dados (backup)        |
| POST   | `/api/import`        | importa um backup completo             |

`<store>` é um dos nomes originais: `excursoes`, `passageiros`,
`pagamentos`, `contas`, `meta`, `tiposPassageiro`, `fornecedores`,
`pacotes`, `reservas`, `simulacoes`, `simCustos`, `backupHistorico`.

## Importar um backup existente (dados reais)

Se você já tem um arquivo de backup exportado pelo ibexGo (menu **Backup → Exportar**,
ou o `.json` que a IndexedDB antiga já continha), pode carregá-lo direto no
PostgreSQL sem precisar recriar nada manualmente:

```bash
python scripts/importar_backup.py caminho/para/seu-backup.json
```

O script:
1. Garante que as tabelas existem (`sql/schema.sql`);
2. Lê o JSON (aceita tanto `{ "data": {...} }` quanto o formato antigo `{ "excursoes": [...], ... }`);
3. Grava cada excursão, passageiro, pagamento, conta, tipo de passageiro,
   fornecedor, pacote, reserva, simulação, custo de simulação, vendedor e
   registro do histórico de backup como uma linha em `store_items`.

Depois de rodar, é só abrir **http://localhost:3000** — o app volta a mostrar
seus dados normalmente, agora vindos do PostgreSQL.

## Como rodar

1. Tenha um PostgreSQL rodando e crie o banco:
   ```sql
   CREATE DATABASE ibexgo;
   ```
2. Copie `.env.example` para `.env` e ajuste usuário/senha/host.
3. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```
4. Rode o servidor (na primeira execução ele já cria as tabelas):
   ```bash
   python app.py
   ```
5. Acesse **http://localhost:3000**.

## Observações

- Backups (importar/exportar) continuam funcionando: o menu **Backup** do
  app agora lê e grava no PostgreSQL através da API, em vez do IndexedDB.
- Nenhuma tela, fluxo ou regra de negócio foi alterada — apenas a camada de
  persistência.
