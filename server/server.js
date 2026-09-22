import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "projeto01-secret-dev";

app.use(cors());
app.use(express.json());

// ---- SQLite (nativo do Node 22+, sem compilação) ----
const db = new DatabaseSync(path.join(__dirname, "database.db"));

db.exec(`
  PRAGMA journal_mode = WAL;
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
`);

// Seed: usuário admin / admin123
const adminRow = db.prepare("SELECT id FROM users WHERE username = ?").get("admin");
if (!adminRow) {
  const hash = bcrypt.hashSync("admin123", 10);
  db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run("admin", hash);
  console.log("Usuário seed criado -> login: admin | senha: admin123");
}

// ---- Auth ----
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Token ausente" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

app.post("/api/register", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: "Informe usuário e senha" });
  if (String(password).length < 4)
    return res.status(400).json({ error: "Senha deve ter ao menos 4 caracteres" });
  try {
    const hash = bcrypt.hashSync(String(password), 10);
    const r = db
      .prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)")
      .run(String(username).trim(), hash);
    const token = jwt.sign({ id: Number(r.lastInsertRowid), username }, JWT_SECRET, { expiresIn: "12h" });
    res.status(201).json({ token, username });
  } catch (e) {
    if (String(e.message).includes("UNIQUE"))
      return res.status(409).json({ error: "Usuário já existe" });
    res.status(500).json({ error: "Erro ao registrar" });
  }
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: "Informe usuário e senha" });
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(String(username).trim());
  if (!user) return res.status(401).json({ error: "Usuário ou senha inválidos" });
  const ok = bcrypt.compareSync(String(password), user.password_hash);
  if (!ok) return res.status(401).json({ error: "Usuário ou senha inválidos" });
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "12h" });
  res.json({ token, username: user.username });
});

app.get("/api/me", auth, (req, res) => {
  res.json({ user: req.user });
});

// ---- Helpers CRUD ----
const validId = (v) => Number.isInteger(Number(v)) && Number(v) > 0;

// ---- Clientes ----
app.get("/api/clientes", auth, (req, res) => {
  const q = (req.query.q || "").toString().trim();
  let rows;
  if (q) {
    rows = db.prepare(
      "SELECT * FROM clientes WHERE nome LIKE ? OR telefone LIKE ? OR endereco LIKE ? ORDER BY id DESC"
    ).all(`%${q}%`, `%${q}%`, `%${q}%`);
  } else {
    rows = db.prepare("SELECT * FROM clientes ORDER BY id DESC").all();
  }
  res.json(rows);
});

app.post("/api/clientes", auth, (req, res) => {
  const { nome, telefone, endereco } = req.body || {};
  if (!nome?.trim() || !telefone?.trim() || !endereco?.trim())
    return res.status(400).json({ error: "Nome, telefone e endereço são obrigatórios" });
  const r = db.prepare("INSERT INTO clientes (nome, telefone, endereco) VALUES (?, ?, ?)")
    .run(nome.trim(), telefone.trim(), endereco.trim());
  res.status(201).json(db.prepare("SELECT * FROM clientes WHERE id = ?").get(Number(r.lastInsertRowid)));
});

app.put("/api/clientes/:id", auth, (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  const { nome, telefone, endereco } = req.body || {};
  if (!nome?.trim() || !telefone?.trim() || !endereco?.trim())
    return res.status(400).json({ error: "Nome, telefone e endereço são obrigatórios" });
  db.prepare("UPDATE clientes SET nome=?, telefone=?, endereco=? WHERE id=?")
    .run(nome.trim(), telefone.trim(), endereco.trim(), Number(req.params.id));
  res.json(db.prepare("SELECT * FROM clientes WHERE id = ?").get(Number(req.params.id)));
});

app.delete("/api/clientes/:id", auth, (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  const emUso = db.prepare("SELECT COUNT(*) AS c FROM pedidos WHERE cliente_id = ?").get(Number(req.params.id));
  if (emUso.c > 0) return res.status(409).json({ error: "Cliente possui pedidos e não pode ser excluído" });
  db.prepare("DELETE FROM clientes WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

// ---- Cardápios ----
app.get("/api/cardapios", auth, (req, res) => {
  const q = (req.query.q || "").toString().trim();
  let rows;
  if (q) {
    rows = db.prepare("SELECT * FROM cardapios WHERE nome LIKE ? OR descricao LIKE ? ORDER BY id DESC")
      .all(`%${q}%`, `%${q}%`);
  } else {
    rows = db.prepare("SELECT * FROM cardapios ORDER BY id DESC").all();
  }
  res.json(rows);
});

app.post("/api/cardapios", auth, (req, res) => {
  const { nome, descricao = "", preco } = req.body || {};
  const precoNum = Number(preco);
  if (!nome?.trim()) return res.status(400).json({ error: "Nome é obrigatório" });
  if (!Number.isFinite(precoNum) || precoNum < 0)
    return res.status(400).json({ error: "Preço inválido" });
  const r = db.prepare("INSERT INTO cardapios (nome, descricao, preco) VALUES (?, ?, ?)")
    .run(nome.trim(), String(descricao).trim(), precoNum);
  res.status(201).json(db.prepare("SELECT * FROM cardapios WHERE id = ?").get(Number(r.lastInsertRowid)));
});

app.put("/api/cardapios/:id", auth, (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  const { nome, descricao = "", preco } = req.body || {};
  const precoNum = Number(preco);
  if (!nome?.trim()) return res.status(400).json({ error: "Nome é obrigatório" });
  if (!Number.isFinite(precoNum) || precoNum < 0)
    return res.status(400).json({ error: "Preço inválido" });
  db.prepare("UPDATE cardapios SET nome=?, descricao=?, preco=? WHERE id=?")
    .run(nome.trim(), String(descricao).trim(), precoNum, Number(req.params.id));
  res.json(db.prepare("SELECT * FROM cardapios WHERE id = ?").get(Number(req.params.id)));
});

app.delete("/api/cardapios/:id", auth, (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  const emUso = db.prepare("SELECT COUNT(*) AS c FROM pedidos WHERE cardapio_id = ?").get(Number(req.params.id));
  if (emUso.c > 0) return res.status(409).json({ error: "Cardápio possui pedidos e não pode ser excluído" });
  db.prepare("DELETE FROM cardapios WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

// ---- Pedidos ----
app.get("/api/pedidos", auth, (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, c.nome AS cliente_nome, m.nome AS cardapio_nome
    FROM pedidos p
    JOIN clientes c ON c.id = p.cliente_id
    JOIN cardapios m ON m.id = p.cardapio_id
    ORDER BY p.id DESC
  `).all();
  res.json(rows);
});

app.post("/api/pedidos", auth, (req, res) => {
  const { cliente_id, cardapio_id, quantidade, data, observacao = "" } = req.body || {};
  const qtd = Number(quantidade);
  if (!validId(cliente_id)) return res.status(400).json({ error: "Selecione o cliente" });
  if (!validId(cardapio_id)) return res.status(400).json({ error: "Selecione o cardápio" });
  if (!Number.isInteger(qtd) || qtd <= 0)
    return res.status(400).json({ error: "Quantidade deve ser maior que zero" });
  const cliente = db.prepare("SELECT id FROM clientes WHERE id = ?").get(Number(cliente_id));
  if (!cliente) return res.status(400).json({ error: "Cliente não encontrado" });
  const item = db.prepare("SELECT * FROM cardapios WHERE id = ?").get(Number(cardapio_id));
  if (!item) return res.status(400).json({ error: "Cardápio não encontrado" });
  const precoUnit = Number(item.preco);
  const total = precoUnit * qtd;
  const dataFinal = data ? String(data) : new Date().toISOString().slice(0, 10);
  const r = db.prepare(
    "INSERT INTO pedidos (cliente_id, cardapio_id, quantidade, preco_unitario, total, data, observacao) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(Number(cliente_id), Number(cardapio_id), qtd, precoUnit, total, dataFinal, String(observacao).trim());
  const created = db.prepare(`
    SELECT p.*, c.nome AS cliente_nome, m.nome AS cardapio_nome
    FROM pedidos p JOIN clientes c ON c.id=p.cliente_id JOIN cardapios m ON m.id=p.cardapio_id
    WHERE p.id = ?
  `).get(Number(r.lastInsertRowid));
  res.status(201).json(created);
});

app.put("/api/pedidos/:id", auth, (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  const { cliente_id, cardapio_id, quantidade, data, observacao = "" } = req.body || {};
  const qtd = Number(quantidade);
  if (!validId(cliente_id) || !validId(cardapio_id))
    return res.status(400).json({ error: "Cliente e cardápio são obrigatórios" });
  if (!Number.isInteger(qtd) || qtd <= 0)
    return res.status(400).json({ error: "Quantidade deve ser maior que zero" });
  const item = db.prepare("SELECT * FROM cardapios WHERE id = ?").get(Number(cardapio_id));
  if (!item) return res.status(400).json({ error: "Cardápio não encontrado" });
  const precoUnit = Number(item.preco);
  const total = precoUnit * qtd;
  db.prepare("UPDATE pedidos SET cliente_id=?, cardapio_id=?, quantidade=?, preco_unitario=?, total=?, data=?, observacao=? WHERE id=?")
    .run(Number(cliente_id), Number(cardapio_id), qtd, precoUnit, total, String(data || ""), String(observacao).trim(), Number(req.params.id));
  const updated = db.prepare(`
    SELECT p.*, c.nome AS cliente_nome, m.nome AS cardapio_nome
    FROM pedidos p JOIN clientes c ON c.id=p.cliente_id JOIN cardapios m ON m.id=p.cardapio_id
    WHERE p.id = ?
  `).get(Number(req.params.id));
  res.json(updated);
});

app.delete("/api/pedidos/:id", auth, (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  db.prepare("DELETE FROM pedidos WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
