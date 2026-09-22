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
  CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    cardapio_id INTEGER NOT NULL REFERENCES cardapios(id) ON DELETE RESTRICT,
    quantidade INTEGER NOT NULL DEFAULT 1,
    preco_unitario REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    data TEXT NOT NULL DEFAULT (date('now')),
    observacao TEXT DEFAULT '',
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
  CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    cardapio_id INTEGER NOT NULL REFERENCES cardapios(id) ON DELETE RESTRICT,
    quantidade INTEGER NOT NULL DEFAULT 1,
    preco_unitario REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    observacao TEXT DEFAULT '',
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
