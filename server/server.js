import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { initDb, all, get, run, insert } from "./db.js";

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "projeto01-secret-dev";

// Em produção, defina FRONTEND_URL com a URL do Vercel (pode ser lista separada por vírgula).
// Sem ela (dev local), libera qualquer origem.
const allowed = (process.env.FRONTEND_URL || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: allowed.length ? allowed : true }));
app.use(express.json());

await initDb();

// Seed: usuário admin / admin123
const adminRow = await get("SELECT id FROM users WHERE username = ?", ["admin"]);
if (!adminRow) {
  const hash = bcrypt.hashSync("admin123", 10);
  await run("INSERT INTO users (username, password_hash) VALUES (?, ?)", ["admin", hash]);
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

// Wrapper para rotas async (erros caem no middleware de erro)
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const validId = (v) => Number.isInteger(Number(v)) && Number(v) > 0;

// Normaliza data vinda do Postgres (Date) para "YYYY-MM-DD" como no SQLite
function fmtDate(d) {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  if (typeof d === "string" && d.includes("T")) return d.slice(0, 10);
  return d;
}
const mapPedido = (p) => (p ? { ...p, data: fmtDate(p.data) } : p);

app.post("/api/register", ah(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: "Informe usuário e senha" });
  if (String(password).length < 4)
    return res.status(400).json({ error: "Senha deve ter ao menos 4 caracteres" });
  try {
    const hash = bcrypt.hashSync(String(password), 10);
    const id = await insert("INSERT INTO users (username, password_hash) VALUES (?, ?)", [String(username).trim(), hash]);
    const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: "12h" });
    res.status(201).json({ token, username });
  } catch (e) {
    if (String(e.message).includes("UNIQUE") || String(e.message).includes("duplicate"))
      return res.status(409).json({ error: "Usuário já existe" });
    throw e;
  }
}));

app.post("/api/login", ah(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: "Informe usuário e senha" });
  const user = await get("SELECT * FROM users WHERE username = ?", [String(username).trim()]);
  if (!user) return res.status(401).json({ error: "Usuário ou senha inválidos" });
  const ok = bcrypt.compareSync(String(password), user.password_hash);
  if (!ok) return res.status(401).json({ error: "Usuário ou senha inválidos" });
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "12h" });
  res.json({ token, username: user.username });
}));

app.get("/api/me", auth, (req, res) => {
  res.json({ user: req.user });
});

// ---- Clientes ----
app.get("/api/clientes", auth, ah(async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  const rows = q
    ? await all(
        "SELECT * FROM clientes WHERE nome LIKE ? OR telefone LIKE ? OR endereco LIKE ? ORDER BY id DESC",
        [`%${q}%`, `%${q}%`, `%${q}%`]
      )
    : await all("SELECT * FROM clientes ORDER BY id DESC");
  res.json(rows);
}));

app.post("/api/clientes", auth, ah(async (req, res) => {
  const { nome, telefone, endereco } = req.body || {};
  if (!nome?.trim() || !telefone?.trim() || !endereco?.trim())
    return res.status(400).json({ error: "Nome, telefone e endereço são obrigatórios" });
  const id = await insert("INSERT INTO clientes (nome, telefone, endereco) VALUES (?, ?, ?)", [nome.trim(), telefone.trim(), endereco.trim()]);
  res.status(201).json(await get("SELECT * FROM clientes WHERE id = ?", [id]));
}));

app.put("/api/clientes/:id", auth, ah(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  const { nome, telefone, endereco } = req.body || {};
  if (!nome?.trim() || !telefone?.trim() || !endereco?.trim())
    return res.status(400).json({ error: "Nome, telefone e endereço são obrigatórios" });
  await run("UPDATE clientes SET nome=?, telefone=?, endereco=? WHERE id=?", [nome.trim(), telefone.trim(), endereco.trim(), Number(req.params.id)]);
  res.json(await get("SELECT * FROM clientes WHERE id = ?", [Number(req.params.id)]));
}));

app.delete("/api/clientes/:id", auth, ah(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  const emUso = await get("SELECT COUNT(*) AS c FROM pedidos WHERE cliente_id = ?", [Number(req.params.id)]);
  if (Number(emUso.c) > 0) return res.status(409).json({ error: "Cliente possui pedidos e não pode ser excluído" });
  await run("DELETE FROM clientes WHERE id = ?", [Number(req.params.id)]);
  res.json({ ok: true });
}));

// ---- Cardápios ----
app.get("/api/cardapios", auth, ah(async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  const rows = q
    ? await all("SELECT * FROM cardapios WHERE nome LIKE ? OR descricao LIKE ? ORDER BY id DESC", [`%${q}%`, `%${q}%`])
    : await all("SELECT * FROM cardapios ORDER BY id DESC");
  res.json(rows);
}));

app.post("/api/cardapios", auth, ah(async (req, res) => {
  const { nome, descricao = "", preco } = req.body || {};
  const precoNum = Number(preco);
  if (!nome?.trim()) return res.status(400).json({ error: "Nome é obrigatório" });
  if (!Number.isFinite(precoNum) || precoNum < 0)
    return res.status(400).json({ error: "Preço inválido" });
  const id = await insert("INSERT INTO cardapios (nome, descricao, preco) VALUES (?, ?, ?)", [nome.trim(), String(descricao).trim(), precoNum]);
  res.status(201).json(await get("SELECT * FROM cardapios WHERE id = ?", [id]));
}));

app.put("/api/cardapios/:id", auth, ah(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  const { nome, descricao = "", preco } = req.body || {};
  const precoNum = Number(preco);
  if (!nome?.trim()) return res.status(400).json({ error: "Nome é obrigatório" });
  if (!Number.isFinite(precoNum) || precoNum < 0)
    return res.status(400).json({ error: "Preço inválido" });
  await run("UPDATE cardapios SET nome=?, descricao=?, preco=? WHERE id=?", [nome.trim(), String(descricao).trim(), precoNum, Number(req.params.id)]);
  res.json(await get("SELECT * FROM cardapios WHERE id = ?", [Number(req.params.id)]));
}));

app.delete("/api/cardapios/:id", auth, ah(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  const emUso = await get("SELECT COUNT(*) AS c FROM pedidos WHERE cardapio_id = ?", [Number(req.params.id)]);
  if (Number(emUso.c) > 0) return res.status(409).json({ error: "Cardápio possui pedidos e não pode ser excluído" });
  await run("DELETE FROM cardapios WHERE id = ?", [Number(req.params.id)]);
  res.json({ ok: true });
}));

// ---- Pedidos ----
const PEDIDO_JOIN = `
  SELECT p.*, c.nome AS cliente_nome, m.nome AS cardapio_nome
  FROM pedidos p
  JOIN clientes c ON c.id = p.cliente_id
  JOIN cardapios m ON m.id = p.cardapio_id
`;

app.get("/api/pedidos", auth, ah(async (req, res) => {
  const rows = await all(`${PEDIDO_JOIN} ORDER BY p.id DESC`);
  res.json(rows.map(mapPedido));
}));

app.post("/api/pedidos", auth, ah(async (req, res) => {
  const { cliente_id, cardapio_id, quantidade, data, observacao = "" } = req.body || {};
  const qtd = Number(quantidade);
  if (!validId(cliente_id)) return res.status(400).json({ error: "Selecione o cliente" });
  if (!validId(cardapio_id)) return res.status(400).json({ error: "Selecione o cardápio" });
  if (!Number.isInteger(qtd) || qtd <= 0)
    return res.status(400).json({ error: "Quantidade deve ser maior que zero" });
  const cliente = await get("SELECT id FROM clientes WHERE id = ?", [Number(cliente_id)]);
  if (!cliente) return res.status(400).json({ error: "Cliente não encontrado" });
  const item = await get("SELECT * FROM cardapios WHERE id = ?", [Number(cardapio_id)]);
  if (!item) return res.status(400).json({ error: "Cardápio não encontrado" });
  const precoUnit = Number(item.preco);
  const total = Math.round(precoUnit * qtd * 100) / 100;
  const dataFinal = data ? String(data) : new Date().toISOString().slice(0, 10);
  const id = await insert(
    "INSERT INTO pedidos (cliente_id, cardapio_id, quantidade, preco_unitario, total, data, observacao) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [Number(cliente_id), Number(cardapio_id), qtd, precoUnit, total, dataFinal, String(observacao).trim()]
  );
  res.status(201).json(mapPedido(await get(`${PEDIDO_JOIN} WHERE p.id = ?`, [id])));
}));

app.put("/api/pedidos/:id", auth, ah(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  const { cliente_id, cardapio_id, quantidade, data, observacao = "" } = req.body || {};
  const qtd = Number(quantidade);
  if (!validId(cliente_id) || !validId(cardapio_id))
    return res.status(400).json({ error: "Cliente e cardápio são obrigatórios" });
  if (!Number.isInteger(qtd) || qtd <= 0)
    return res.status(400).json({ error: "Quantidade deve ser maior que zero" });
  const item = await get("SELECT * FROM cardapios WHERE id = ?", [Number(cardapio_id)]);
  if (!item) return res.status(400).json({ error: "Cardápio não encontrado" });
  const precoUnit = Number(item.preco);
  const total = Math.round(precoUnit * qtd * 100) / 100;
  await run("UPDATE pedidos SET cliente_id=?, cardapio_id=?, quantidade=?, preco_unitario=?, total=?, data=?, observacao=? WHERE id=?",
    [Number(cliente_id), Number(cardapio_id), qtd, precoUnit, total, String(data || ""), String(observacao).trim(), Number(req.params.id)]);
  res.json(mapPedido(await get(`${PEDIDO_JOIN} WHERE p.id = ?`, [Number(req.params.id)])));
}));

app.delete("/api/pedidos/:id", auth, ah(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  await run("DELETE FROM pedidos WHERE id = ?", [Number(req.params.id)]);
  res.json({ ok: true });
}));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Erro interno" });
});

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
