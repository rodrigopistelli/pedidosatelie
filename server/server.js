import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { initDb, all, get, run, insert } from "./db.js";
import { webauthnRoutes } from "./webauthn.js";

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "pedidosatelie-secret-dev";

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
const money = (v) => Math.round(Number(v) * 100) / 100;

// Normaliza data vinda do Postgres (Date) para "YYYY-MM-DD" como no SQLite
function fmtDate(d) {
  if (!d) return d;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  if (typeof d === "string" && d.includes("T")) return d.slice(0, 10);
  return d;
}

const PEDIDO_STATUS = ["pendente", "confirmado", "em_producao", "pronto", "entregue", "cancelado"];
const SEMANA_STATUS = ["rascunho", "aberto", "fechado"];

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

webauthnRoutes({ app, auth, ah, all, get, run, insert, jwt, JWT_SECRET });

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

// ---- Cardápios (pratos) ----
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
  const emUso = await get("SELECT COUNT(*) AS c FROM pedido_itens WHERE cardapio_id = ?", [Number(req.params.id)]);
  if (Number(emUso.c) > 0) return res.status(409).json({ error: "Prato possui pedidos e não pode ser excluído" });
  await run("DELETE FROM semana_itens WHERE cardapio_id = ?", [Number(req.params.id)]);
  await run("DELETE FROM prato_ingredientes WHERE cardapio_id = ?", [Number(req.params.id)]);
  await run("DELETE FROM cardapios WHERE id = ?", [Number(req.params.id)]);
  res.json({ ok: true });
}));

// ---- Ficha técnica do prato (ingredientes por unidade) ----
app.get("/api/cardapios/:id/ingredientes", auth, ah(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  const rows = await all(
    `SELECT pi.ingrediente_id, pi.quantidade, i.nome AS ingrediente_nome, i.unidade
     FROM prato_ingredientes pi JOIN ingredientes i ON i.id = pi.ingrediente_id
     WHERE pi.cardapio_id = ? ORDER BY i.nome`,
    [Number(req.params.id)]
  );
  res.json(rows);
}));

app.post("/api/cardapios/:id/ingredientes", auth, ah(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  const { ingrediente_id, quantidade } = req.body || {};
  const qtd = Number(quantidade);
  if (!validId(ingrediente_id)) return res.status(400).json({ error: "Selecione o ingrediente" });
  if (!Number.isFinite(qtd) || qtd <= 0) return res.status(400).json({ error: "Quantidade inválida" });
  const prato = await get("SELECT id FROM cardapios WHERE id = ?", [Number(req.params.id)]);
  if (!prato) return res.status(400).json({ error: "Prato não encontrado" });
  const ing = await get("SELECT id FROM ingredientes WHERE id = ?", [Number(ingrediente_id)]);
  if (!ing) return res.status(400).json({ error: "Ingrediente não encontrado" });
  await run(
    "INSERT INTO prato_ingredientes (cardapio_id, ingrediente_id, quantidade) VALUES (?, ?, ?)",
    [Number(req.params.id), Number(ingrediente_id), qtd]
  ).catch(async (e) => {
    if (String(e.message).includes("UNIQUE") || String(e.message).includes("duplicate")) {
      await run("UPDATE prato_ingredientes SET quantidade=? WHERE cardapio_id=? AND ingrediente_id=?",
        [qtd, Number(req.params.id), Number(ingrediente_id)]);
    } else throw e;
  });
  res.status(201).json({ ok: true });
}));

app.delete("/api/cardapios/:id/ingredientes/:ingId", auth, ah(async (req, res) => {
  await run("DELETE FROM prato_ingredientes WHERE cardapio_id=? AND ingrediente_id=?",
    [Number(req.params.id), Number(req.params.ingId)]);
  res.json({ ok: true });
}));

// ---- Ingredientes ----
app.get("/api/ingredientes", auth, ah(async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  const rows = q
    ? await all("SELECT * FROM ingredientes WHERE nome LIKE ? ORDER BY nome", [`%${q}%`])
    : await all("SELECT * FROM ingredientes ORDER BY nome");
  res.json(rows);
}));

app.post("/api/ingredientes", auth, ah(async (req, res) => {
  const { nome, unidade = "un" } = req.body || {};
  if (!nome?.trim()) return res.status(400).json({ error: "Nome é obrigatório" });
  const id = await insert("INSERT INTO ingredientes (nome, unidade) VALUES (?, ?)", [nome.trim(), String(unidade || "un").trim() || "un"]);
  res.status(201).json(await get("SELECT * FROM ingredientes WHERE id = ?", [id]));
}));

app.put("/api/ingredientes/:id", auth, ah(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  const { nome, unidade = "un" } = req.body || {};
  if (!nome?.trim()) return res.status(400).json({ error: "Nome é obrigatório" });
  await run("UPDATE ingredientes SET nome=?, unidade=? WHERE id=?", [nome.trim(), String(unidade || "un").trim() || "un", Number(req.params.id)]);
  res.json(await get("SELECT * FROM ingredientes WHERE id = ?", [Number(req.params.id)]));
}));

app.delete("/api/ingredientes/:id", auth, ah(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  const emUso = await get("SELECT COUNT(*) AS c FROM prato_ingredientes WHERE ingrediente_id = ?", [Number(req.params.id)]);
  if (Number(emUso.c) > 0) return res.status(409).json({ error: "Ingrediente usado em ficha técnica e não pode ser excluído" });
  await run("DELETE FROM ingredientes WHERE id = ?", [Number(req.params.id)]);
  res.json({ ok: true });
}));

// ---- Semanas (cardápio semanal) ----
app.get("/api/semanas", auth, ah(async (req, res) => {
  const rows = await all("SELECT * FROM semanas ORDER BY id DESC");
  res.json(rows.map((s) => ({ ...s, data_inicio: fmtDate(s.data_inicio), data_fim: fmtDate(s.data_fim) })));
}));

app.get("/api/semanas/:id", auth, ah(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  const s = await get("SELECT * FROM semanas WHERE id = ?", [Number(req.params.id)]);
  if (!s) return res.status(404).json({ error: "Semana não encontrada" });
  const itens = await all(
    `SELECT m.*, si.semana_id FROM semana_itens si JOIN cardapios m ON m.id = si.cardapio_id
     WHERE si.semana_id = ? ORDER BY m.nome`,
    [Number(req.params.id)]
  );
  const stats = await get(
    `SELECT COUNT(*) AS pedidos, COALESCE(SUM(CASE WHEN status != 'cancelado' THEN total ELSE 0 END), 0) AS faturamento
     FROM pedidos WHERE semana_id = ?`,
    [Number(req.params.id)]
  );
  res.json({
    ...s,
    data_inicio: fmtDate(s.data_inicio),
    data_fim: fmtDate(s.data_fim),
    itens,
    total_pedidos: Number(stats.pedidos),
    faturamento: Number(stats.faturamento),
  });
}));

app.post("/api/semanas", auth, ah(async (req, res) => {
  const { titulo, data_inicio, data_fim, observacao = "" } = req.body || {};
  if (!titulo?.trim()) return res.status(400).json({ error: "Título é obrigatório" });
  const id = await insert("INSERT INTO semanas (titulo, data_inicio, data_fim, observacao) VALUES (?, ?, ?, ?)",
    [titulo.trim(), data_inicio || null, data_fim || null, String(observacao).trim()]);
  res.status(201).json(await get("SELECT * FROM semanas WHERE id = ?", [id]));
}));

app.put("/api/semanas/:id", auth, ah(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  const { titulo, data_inicio, data_fim, observacao = "" } = req.body || {};
  if (!titulo?.trim()) return res.status(400).json({ error: "Título é obrigatório" });
  await run("UPDATE semanas SET titulo=?, data_inicio=?, data_fim=?, observacao=? WHERE id=?",
    [titulo.trim(), data_inicio || null, data_fim || null, String(observacao).trim(), Number(req.params.id)]);
  res.json(await get("SELECT * FROM semanas WHERE id = ?", [Number(req.params.id)]));
}));

app.patch("/api/semanas/:id/status", auth, ah(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  const { status } = req.body || {};
  if (!SEMANA_STATUS.includes(status)) return res.status(400).json({ error: "Status inválido" });
  await run("UPDATE semanas SET status=? WHERE id=?", [status, Number(req.params.id)]);
  res.json(await get("SELECT * FROM semanas WHERE id = ?", [Number(req.params.id)]));
}));

app.delete("/api/semanas/:id", auth, ah(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  await run("UPDATE pedidos SET semana_id = NULL WHERE semana_id = ?", [Number(req.params.id)]);
  await run("DELETE FROM semana_itens WHERE semana_id = ?", [Number(req.params.id)]);
  await run("DELETE FROM semanas WHERE id = ?", [Number(req.params.id)]);
  res.json({ ok: true });
}));

app.post("/api/semanas/:id/itens", auth, ah(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  const { cardapio_id } = req.body || {};
  if (!validId(cardapio_id)) return res.status(400).json({ error: "Selecione o prato" });
  try {
    await run("INSERT INTO semana_itens (semana_id, cardapio_id) VALUES (?, ?)", [Number(req.params.id), Number(cardapio_id)]);
  } catch (e) {
    if (!String(e.message).includes("UNIQUE") && !String(e.message).includes("duplicate")) throw e;
  }
  res.status(201).json({ ok: true });
}));

app.delete("/api/semanas/:id/itens/:cardapioId", auth, ah(async (req, res) => {
  await run("DELETE FROM semana_itens WHERE semana_id=? AND cardapio_id=?", [Number(req.params.id), Number(req.params.cardapioId)]);
  res.json({ ok: true });
}));

// ---- Pedidos (multi-itens, com semana, entrega e status) ----
const PEDIDO_JOIN = `
  SELECT p.*, c.nome AS cliente_nome, c.telefone AS cliente_telefone, s.titulo AS semana_titulo
  FROM pedidos p
  JOIN clientes c ON c.id = p.cliente_id
  LEFT JOIN semanas s ON s.id = p.semana_id
`;

async function pedidoComItens(id) {
  const p = await get(`${PEDIDO_JOIN} WHERE p.id = ?`, [id]);
  if (!p) return null;
  const itens = await all(
    `SELECT pi.*, m.nome AS cardapio_nome FROM pedido_itens pi
     JOIN cardapios m ON m.id = pi.cardapio_id WHERE pi.pedido_id = ? ORDER BY pi.id`,
    [id]
  );
  return { ...p, data: fmtDate(p.data), data_entrega: fmtDate(p.data_entrega), itens };
}

function validarItens(itens) {
  if (!Array.isArray(itens) || itens.length === 0) return "Adicione ao menos 1 item ao pedido";
  for (const it of itens) {
    if (!validId(it.cardapio_id)) return "Há item sem prato selecionado";
    const q = Number(it.quantidade);
    if (!Number.isInteger(q) || q <= 0) return "Quantidade de cada item deve ser maior que zero";
  }
  return null;
}

app.get("/api/pedidos", auth, ah(async (req, res) => {
  const { semana_id, status } = req.query;
  let sql = `${PEDIDO_JOIN}`;
  const conds = [];
  const params = [];
  if (semana_id && validId(semana_id)) { conds.push("p.semana_id = ?"); params.push(Number(semana_id)); }
  if (status && PEDIDO_STATUS.includes(String(status))) { conds.push("p.status = ?"); params.push(String(status)); }
  if (conds.length) sql += " WHERE " + conds.join(" AND ");
  sql += " ORDER BY p.id DESC";
  const rows = await all(sql, params);
  const ids = rows.map((r) => r.id);
  let itensPorPedido = {};
  if (ids.length) {
    const ph = ids.map(() => "?").join(",");
    const itens = await all(
      `SELECT pi.*, m.nome AS cardapio_nome FROM pedido_itens pi
       JOIN cardapios m ON m.id = pi.cardapio_id WHERE pi.pedido_id IN (${ph}) ORDER BY pi.id`,
      ids
    );
    for (const it of itens) (itensPorPedido[it.pedido_id] ||= []).push(it);
  }
  res.json(rows.map((p) => ({ ...p, data: fmtDate(p.data), data_entrega: fmtDate(p.data_entrega), itens: itensPorPedido[p.id] || [] })));
}));

app.post("/api/pedidos", auth, ah(async (req, res) => {
  const { cliente_id, semana_id, data, data_entrega, observacao = "", itens } = req.body || {};
  if (!validId(cliente_id)) return res.status(400).json({ error: "Selecione o cliente" });
  const erroItens = validarItens(itens);
  if (erroItens) return res.status(400).json({ error: erroItens });
  const cliente = await get("SELECT id FROM clientes WHERE id = ?", [Number(cliente_id)]);
  if (!cliente) return res.status(400).json({ error: "Cliente não encontrado" });
  if (semana_id && !validId(semana_id)) return res.status(400).json({ error: "Semana inválida" });
  // Preço sempre do cadastro atual (congela no item)
  let total = 0;
  const prontos = [];
  for (const it of itens) {
    const prato = await get("SELECT * FROM cardapios WHERE id = ?", [Number(it.cardapio_id)]);
    if (!prato) return res.status(400).json({ error: "Prato não encontrado" });
    const q = Number(it.quantidade);
    total += Number(prato.preco) * q;
    prontos.push({ cardapio_id: prato.id, quantidade: q, preco_unitario: Number(prato.preco) });
  }
  const id = await insert(
    "INSERT INTO pedidos (cliente_id, semana_id, total, data, data_entrega, observacao) VALUES (?, ?, ?, ?, ?, ?)",
    [Number(cliente_id), semana_id ? Number(semana_id) : null, money(total),
     data ? String(data) : new Date().toISOString().slice(0, 10),
     data_entrega ? String(data_entrega) : null, String(observacao).trim()]
  );
  for (const it of prontos) {
    await run("INSERT INTO pedido_itens (pedido_id, cardapio_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)",
      [id, it.cardapio_id, it.quantidade, it.preco_unitario]);
  }
  res.status(201).json(await pedidoComItens(id));
}));

app.put("/api/pedidos/:id", auth, ah(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  const { cliente_id, semana_id, data, data_entrega, observacao = "", itens } = req.body || {};
  if (!validId(cliente_id)) return res.status(400).json({ error: "Selecione o cliente" });
  const erroItens = validarItens(itens);
  if (erroItens) return res.status(400).json({ error: erroItens });
  let total = 0;
  const prontos = [];
  for (const it of itens) {
    const prato = await get("SELECT * FROM cardapios WHERE id = ?", [Number(it.cardapio_id)]);
    if (!prato) return res.status(400).json({ error: "Prato não encontrado" });
    const q = Number(it.quantidade);
    total += Number(prato.preco) * q;
    prontos.push({ cardapio_id: prato.id, quantidade: q, preco_unitario: Number(prato.preco) });
  }
  await run("UPDATE pedidos SET cliente_id=?, semana_id=?, total=?, data=?, data_entrega=?, observacao=? WHERE id=?",
    [Number(cliente_id), semana_id ? Number(semana_id) : null, money(total),
     String(data || ""), data_entrega ? String(data_entrega) : null,
     String(observacao).trim(), Number(req.params.id)]);
  await run("DELETE FROM pedido_itens WHERE pedido_id = ?", [Number(req.params.id)]);
  for (const it of prontos) {
    await run("INSERT INTO pedido_itens (pedido_id, cardapio_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)",
      [Number(req.params.id), it.cardapio_id, it.quantidade, it.preco_unitario]);
  }
  res.json(await pedidoComItens(Number(req.params.id)));
}));

app.patch("/api/pedidos/:id/status", auth, ah(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  const { status } = req.body || {};
  if (!PEDIDO_STATUS.includes(status)) return res.status(400).json({ error: "Status inválido" });
  await run("UPDATE pedidos SET status=? WHERE id=?", [status, Number(req.params.id)]);
  res.json(await pedidoComItens(Number(req.params.id)));
}));

app.delete("/api/pedidos/:id", auth, ah(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  await run("DELETE FROM pedido_itens WHERE pedido_id = ?", [Number(req.params.id)]);
  await run("DELETE FROM pedidos WHERE id = ?", [Number(req.params.id)]);
  res.json({ ok: true });
}));

// ---- Compras (levantamento por semana) ----
// Soma os ingredientes das fichas técnicas, ponderados pelas quantidades
// dos pedidos não cancelados da semana. Pratos sem ficha técnica são
// listados à parte para conferência manual.
app.get("/api/compras", auth, ah(async (req, res) => {
  const { semana_id } = req.query;
  if (!semana_id || !validId(semana_id)) return res.status(400).json({ error: "Selecione a semana" });
  const linhas = await all(
    `SELECT i.id AS ingrediente_id, i.nome AS ingrediente, i.unidade,
            m.nome AS prato, fi.quantidade AS qtd_por_unidade,
            SUM(pit.quantidade) AS unidades
     FROM pedido_itens pit
     JOIN pedidos p ON p.id = pit.pedido_id
     JOIN cardapios m ON m.id = pit.cardapio_id
     JOIN prato_ingredientes fi ON fi.cardapio_id = pit.cardapio_id
     JOIN ingredientes i ON i.id = fi.ingrediente_id
     WHERE p.semana_id = ? AND p.status != 'cancelado'
     GROUP BY i.id, i.nome, i.unidade, m.nome, fi.quantidade
     ORDER BY i.nome, m.nome`,
    [Number(semana_id)]
  );
  const semFicha = await all(
    `SELECT m.id AS cardapio_id, m.nome AS prato, SUM(pit.quantidade) AS unidades
     FROM pedido_itens pit
     JOIN pedidos p ON p.id = pit.pedido_id
     JOIN cardapios m ON m.id = pit.cardapio_id
     WHERE p.semana_id = ? AND p.status != 'cancelado'
       AND NOT EXISTS (SELECT 1 FROM prato_ingredientes fi WHERE fi.cardapio_id = pit.cardapio_id)
     GROUP BY m.id, m.nome ORDER BY m.nome`,
    [Number(semana_id)]
  );
  const mapa = new Map();
  for (const l of linhas) {
    const total = money(Number(l.qtd_por_unidade) * Number(l.unidades));
    if (!mapa.has(l.ingrediente_id)) {
      mapa.set(l.ingrediente_id, { ingrediente: l.ingrediente, unidade: l.unidade, total: 0, pratos: [] });
    }
    const e = mapa.get(l.ingrediente_id);
    e.total = money(e.total + total);
    e.pratos.push({ prato: l.prato, por_unidade: Number(l.qtd_por_unidade), unidades: Number(l.unidades), subtotal: total });
  }
  res.json({
    ingredientes: [...mapa.values()],
    sem_ficha: semFicha.map((s) => ({ prato: s.prato, unidades: Number(s.unidades) })),
  });
}));

// ---- Lista Corriqueira (dia a dia, manual) ----
app.get("/api/lista-corriqueira", auth, ah(async (req, res) => {
  const rows = await all("SELECT * FROM lista_corriqueira ORDER BY comprado, id DESC");
  res.json(rows);
}));

app.post("/api/lista-corriqueira", auth, ah(async (req, res) => {
  const { nome, quantidade = 1, unidade = "un", observacao = "" } = req.body || {};
  const qtd = Number(quantidade);
  if (!nome?.trim()) return res.status(400).json({ error: "Nome do item é obrigatório" });
  if (!Number.isFinite(qtd) || qtd <= 0) return res.status(400).json({ error: "Quantidade inválida" });
  const id = await insert("INSERT INTO lista_corriqueira (nome, quantidade, unidade, observacao) VALUES (?, ?, ?, ?)",
    [nome.trim(), qtd, String(unidade || "un").trim() || "un", String(observacao).trim()]);
  res.status(201).json(await get("SELECT * FROM lista_corriqueira WHERE id = ?", [id]));
}));

app.put("/api/lista-corriqueira/:id", auth, ah(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  const { nome, quantidade = 1, unidade = "un", observacao = "" } = req.body || {};
  const qtd = Number(quantidade);
  if (!nome?.trim()) return res.status(400).json({ error: "Nome do item é obrigatório" });
  if (!Number.isFinite(qtd) || qtd <= 0) return res.status(400).json({ error: "Quantidade inválida" });
  await run("UPDATE lista_corriqueira SET nome=?, quantidade=?, unidade=?, observacao=? WHERE id=?",
    [nome.trim(), qtd, String(unidade || "un").trim() || "un", String(observacao).trim(), Number(req.params.id)]);
  res.json(await get("SELECT * FROM lista_corriqueira WHERE id = ?", [Number(req.params.id)]));
}));

app.patch("/api/lista-corriqueira/:id", auth, ah(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  const { comprado } = req.body || {};
  await run("UPDATE lista_corriqueira SET comprado=? WHERE id=?", [comprado ? 1 : 0, Number(req.params.id)]);
  res.json(await get("SELECT * FROM lista_corriqueira WHERE id = ?", [Number(req.params.id)]));
}));

// Limpa os já comprados (rota específica antes da genérica :id)
app.delete("/api/lista-corriqueira/comprados", auth, ah(async (req, res) => {
  await run("DELETE FROM lista_corriqueira WHERE comprado = 1");
  res.json({ ok: true });
}));

app.delete("/api/lista-corriqueira/:id", auth, ah(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "ID inválido" });
  await run("DELETE FROM lista_corriqueira WHERE id = ?", [Number(req.params.id)]);
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
