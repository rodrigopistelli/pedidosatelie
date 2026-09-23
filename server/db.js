// Camada de banco com 2 drivers:
// - Produção (Render + Neon): Postgres via DATABASE_URL
// - Local: SQLite nativo do Node (sem configuração)
// A mesma API (all/get/run/insert) funciona nos dois.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";

export const usePg = !!process.env.DATABASE_URL;

let pool = null;
let lite = null;

const SCHEMA_SQLITE = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    endereco TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS cardapios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT DEFAULT '',
    preco REAL NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS semanas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    data_inicio TEXT,
    data_fim TEXT,
    status TEXT NOT NULL DEFAULT 'rascunho',
    observacao TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS semana_itens (
    semana_id INTEGER NOT NULL REFERENCES semanas(id) ON DELETE CASCADE,
    cardapio_id INTEGER NOT NULL REFERENCES cardapios(id) ON DELETE RESTRICT,
    PRIMARY KEY (semana_id, cardapio_id)
  );
  CREATE TABLE IF NOT EXISTS ingredientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    unidade TEXT NOT NULL DEFAULT 'un',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS prato_ingredientes (
    cardapio_id INTEGER NOT NULL REFERENCES cardapios(id) ON DELETE CASCADE,
    ingrediente_id INTEGER NOT NULL REFERENCES ingredientes(id) ON DELETE RESTRICT,
    quantidade REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (cardapio_id, ingrediente_id)
  );
  CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    semana_id INTEGER REFERENCES semanas(id) ON DELETE SET NULL,
    total REAL NOT NULL DEFAULT 0,
    data TEXT NOT NULL DEFAULT (date('now')),
    data_entrega TEXT,
    status TEXT NOT NULL DEFAULT 'pendente',
    observacao TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS pedido_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    cardapio_id INTEGER NOT NULL REFERENCES cardapios(id) ON DELETE RESTRICT,
    quantidade INTEGER NOT NULL DEFAULT 1,
    preco_unitario REAL NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS lista_corriqueira (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    quantidade REAL NOT NULL DEFAULT 1,
    unidade TEXT NOT NULL DEFAULT 'un',
    observacao TEXT DEFAULT '',
    comprado INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`;

const SCHEMA_PG = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    endereco TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS cardapios (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT DEFAULT '',
    preco REAL NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS semanas (
    id SERIAL PRIMARY KEY,
    titulo TEXT NOT NULL,
    data_inicio DATE,
    data_fim DATE,
    status TEXT NOT NULL DEFAULT 'rascunho',
    observacao TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS semana_itens (
    semana_id INTEGER NOT NULL REFERENCES semanas(id) ON DELETE CASCADE,
    cardapio_id INTEGER NOT NULL REFERENCES cardapios(id) ON DELETE RESTRICT,
    PRIMARY KEY (semana_id, cardapio_id)
  );
  CREATE TABLE IF NOT EXISTS ingredientes (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    unidade TEXT NOT NULL DEFAULT 'un',
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS prato_ingredientes (
    cardapio_id INTEGER NOT NULL REFERENCES cardapios(id) ON DELETE CASCADE,
    ingrediente_id INTEGER NOT NULL REFERENCES ingredientes(id) ON DELETE RESTRICT,
    quantidade REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (cardapio_id, ingrediente_id)
  );
  CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    semana_id INTEGER REFERENCES semanas(id) ON DELETE SET NULL,
    total REAL NOT NULL DEFAULT 0,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    data_entrega DATE,
    status TEXT NOT NULL DEFAULT 'pendente',
    observacao TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS pedido_itens (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    cardapio_id INTEGER NOT NULL REFERENCES cardapios(id) ON DELETE RESTRICT,
    quantidade INTEGER NOT NULL DEFAULT 1,
    preco_unitario REAL NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS lista_corriqueira (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    quantidade REAL NOT NULL DEFAULT 1,
    unidade TEXT NOT NULL DEFAULT 'un',
    observacao TEXT DEFAULT '',
    comprado INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
  );
`;

export async function initDb() {
  if (usePg) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    await pool.query(SCHEMA_PG);
    console.log("Banco: Postgres (DATABASE_URL)");
  } else {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    lite = new DatabaseSync(path.join(__dirname, "database.db"));
    lite.exec("PRAGMA journal_mode = WAL;");
    lite.exec(SCHEMA_SQLITE);
    console.log("Banco: SQLite local (database.db)");
  }
  await migrate();
}

// Migra bancos criados na versão 1 (pedido = 1 prato + qtd direto na tabela)
// para a versão 2 (pedido com múltiplos itens + semana + entrega + status).
async function migrate() {
  if (usePg) {
    const cols = (
      await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'pedidos'`)
    ).rows.map((r) => r.column_name);
    if (!cols.includes("semana_id"))
      await pool.query(`ALTER TABLE pedidos ADD COLUMN semana_id INTEGER REFERENCES semanas(id) ON DELETE SET NULL`);
    if (!cols.includes("data_entrega"))
      await pool.query(`ALTER TABLE pedidos ADD COLUMN data_entrega DATE`);
    if (!cols.includes("status"))
      await pool.query(`ALTER TABLE pedidos ADD COLUMN status TEXT NOT NULL DEFAULT 'pendente'`);
    if (cols.includes("cardapio_id")) {
      await pool.query(
        `INSERT INTO pedido_itens (pedido_id, cardapio_id, quantidade, preco_unitario)
         SELECT id, cardapio_id, quantidade, preco_unitario FROM pedidos`
      );
      await pool.query(`ALTER TABLE pedidos DROP COLUMN cardapio_id`);
      await pool.query(`ALTER TABLE pedidos DROP COLUMN quantidade`);
      await pool.query(`ALTER TABLE pedidos DROP COLUMN preco_unitario`);
      console.log("Migração: pedidos v1 -> v2 (Postgres) concluída");
    }
  } else {
    const cols = lite.prepare(`PRAGMA table_info(pedidos)`).all().map((c) => c.name);
    if (!cols.includes("semana_id"))
      lite.exec(`ALTER TABLE pedidos ADD COLUMN semana_id INTEGER REFERENCES semanas(id) ON DELETE SET NULL`);
    if (!cols.includes("data_entrega")) lite.exec(`ALTER TABLE pedidos ADD COLUMN data_entrega TEXT`);
    if (!cols.includes("status"))
      lite.exec(`ALTER TABLE pedidos ADD COLUMN status TEXT NOT NULL DEFAULT 'pendente'`);
    if (cols.includes("cardapio_id")) {
      lite.exec(
        `INSERT INTO pedido_itens (pedido_id, cardapio_id, quantidade, preco_unitario)
         SELECT id, cardapio_id, quantidade, preco_unitario FROM pedidos`
      );
      lite.exec(`ALTER TABLE pedidos DROP COLUMN cardapio_id`);
      lite.exec(`ALTER TABLE pedidos DROP COLUMN quantidade`);
      lite.exec(`ALTER TABLE pedidos DROP COLUMN preco_unitario`);
      console.log("Migração: pedidos v1 -> v2 (SQLite) concluída");
    }
  }
}

// Converte placeholders ? do SQLite para $1, $2... do Postgres
export function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export async function all(sql, params = []) {
  if (usePg) return (await pool.query(toPg(sql), params)).rows;
  return lite.prepare(sql).all(...params);
}

export async function get(sql, params = []) {
  return (await all(sql, params))[0];
}

export async function run(sql, params = []) {
  if (usePg) {
    const r = await pool.query(toPg(sql), params);
    return { changes: r.rowCount };
  }
  return lite.prepare(sql).run(...params);
}

export async function insert(sql, params = []) {
  if (usePg) {
    const r = await pool.query(`${toPg(sql)} RETURNING id`, params);
    return Number(r.rows[0].id);
  }
  return Number(lite.prepare(sql).run(...params).lastInsertRowid);
}
