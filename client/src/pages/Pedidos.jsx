import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ArrowRight, Ban, MessageCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import { api, formatBRL } from "../api";
import { msgPedido, waLink } from "../whatsapp";
import IconBtn from "../components/IconBtn";
import { useSelecao } from "../components/useSelecao";

const HOJE = new Date().toISOString().slice(0, 10);
const empty = { cliente_id: "", semana_id: "", data: HOJE, data_entrega: "", observacao: "", itens: [{ cardapio_id: "", quantidade: 1 }] };
const STATUS = {
  pendente: "Pendente", confirmado: "Confirmado", em_producao: "Em produção",
  pronto: "Pronto", entregue: "Entregue", cancelado: "Cancelado"
};
const PROXIMO = { pendente: "confirmado", confirmado: "em_producao", em_producao: "pronto", pronto: "entregue" };

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cardapios, setCardapios] = useState([]);
  const [semanas, setSemanas] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [fSemana, setFSemana] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [error, setError] = useState("");
  const sel = useSelecao();
  const loc = useLocation();
  const [destaque, setDestaque] = useState(null);

  async function carregar() {
    const params = new URLSearchParams();
    if (fSemana) params.set("semana_id", fSemana);
    if (fStatus) params.set("status", fStatus);
    const [p, c, m, s] = await Promise.all([
      api(`/api/pedidos${params.toString() ? `?${params}` : ""}`),
      api("/api/clientes"), api("/api/cardapios"), api("/api/semanas")
    ]);
    setPedidos(p);
    setClientes(c);
    setCardapios(m);
    setSemanas(s);
  }

  useEffect(() => { carregar().catch((e) => setError(e.message)); }, [fSemana, fStatus]);

  // Vindo do Dashboard (#pedido-ID): rola até o pedido e destaca a linha
  useEffect(() => {
    const m = (loc.hash || "").match(/^#pedido-(\d+)$/);
    if (!m) return;
    const id = Number(m[1]);
    setDestaque(id);
    const t = setTimeout(() => {
      document.getElementById(`pedido-${id}`)?.scrollIntoView({ block: "center" });
    }, 300);
    const t2 = setTimeout(() => setDestaque(null), 4000);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [loc.hash, pedidos.length]);

  const totalPrev = form.itens.reduce((sum, it) => {
    const m = cardapios.find((x) => String(x.id) === String(it.cardapio_id));
    return sum + (m ? Number(m.preco) * Number(it.quantidade || 0) : 0);
  }, 0);

  function setItem(i, campo, valor) {
    setForm((f) => ({ ...f, itens: f.itens.map((it, j) => (j === i ? { ...it, [campo]: valor } : it)) }));
  }
  function addItem() {
    setForm((f) => ({ ...f, itens: [...f.itens, { cardapio_id: "", quantidade: 1 }] }));
  }
  function delItem(i) {
    setForm((f) => ({ ...f, itens: f.itens.length > 1 ? f.itens.filter((_, j) => j !== i) : f.itens }));
  }

  async function salvar(e) {
    e.preventDefault();
    setError("");
    try {
      const body = { ...form, semana_id: form.semana_id || null, data_entrega: form.data_entrega || null };
      if (editId) await api(`/api/pedidos/${editId}`, { method: "PUT", body: JSON.stringify(body) });
      else await api("/api/pedidos", { method: "POST", body: JSON.stringify(body) });
      setForm({ ...empty, data: HOJE });
      setEditId(null);
      carregar();
    } catch (err) { setError(err.message); }
  }

  function editar(p) {
    setEditId(p.id);
    setForm({
      cliente_id: p.cliente_id, semana_id: p.semana_id || "", data: p.data || HOJE,
      data_entrega: p.data_entrega || "", observacao: p.observacao || "",
      itens: p.itens.map((it) => ({ cardapio_id: it.cardapio_id, quantidade: it.quantidade }))
    });
    window.scrollTo(0, 0);
  }

  async function avancar(p) {
    const prox = PROXIMO[p.status];
    if (!prox) return;
    try {
      await api(`/api/pedidos/${p.id}/status`, { method: "PATCH", body: JSON.stringify({ status: prox }) });
      carregar();
    } catch (err) { setError(err.message); }
  }

  async function cancelar(p) {
    if (!confirm(`Cancelar o pedido #${p.id}?`)) return;
    try {
      await api(`/api/pedidos/${p.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "cancelado" }) });
      carregar();
    } catch (err) { setError(err.message); }
  }

  async function excluir(id) {
    if (!confirm("Excluir este pedido definitivamente?")) return;
    try { await api(`/api/pedidos/${id}`, { method: "DELETE" }); carregar(); }
    catch (err) { setError(err.message); }
  }

  async function excluirSelecionados() {
    if (!sel.ids.length) return;
    if (!confirm(`Excluir ${sel.ids.length} pedido(s) selecionado(s) definitivamente?`)) return;
    const falhas = await sel.excluirEmMassa({ lista: pedidos, rota: "/api/pedidos", rotulo: (p) => `#${p.id} ${p.cliente_nome}` });
    carregar();
    if (falhas.length) setError(`Não excluídos: ${falhas.join(" · ")}`);
  }

  function confirmarWhats(p) {
    window.open(waLink(p.cliente_telefone, msgPedido(p)), "_blank");
  }

  return (
    <div className="container">
      <h1>Pedidos (encomendas)</h1>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <h2>{editId ? `Editar pedido #${editId}` : "Novo pedido"}</h2>
        <form onSubmit={salvar}>
          <div className="grid2">
            <div><label>Cliente</label>
              <select value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })} required>
                <option value="">Selecione...</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome} — {c.telefone}</option>)}
              </select></div>
            <div><label>Semana</label>
              <select value={form.semana_id} onChange={(e) => setForm({ ...form, semana_id: e.target.value })}>
                <option value="">Avulso (sem semana)</option>
                {semanas.map((s) => <option key={s.id} value={s.id}>{s.titulo}</option>)}
              </select></div>
          </div>
          <h3>Itens</h3>
          {form.itens.map((it, i) => (
            <div className="grid2" key={i} style={{ alignItems: "end" }}>
              <div><label>Prato</label>
                <select value={it.cardapio_id} onChange={(e) => setItem(i, "cardapio_id", e.target.value)} required>
                  <option value="">Selecione...</option>
                  {cardapios.map((m) => <option key={m.id} value={m.id}>{m.nome} — {formatBRL(m.preco)}</option>)}
                </select></div>
              <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
                <div style={{ flex: 1 }}><label>Qtd</label>
                  <input type="number" min="1" step="1" value={it.quantidade}
                    onChange={(e) => setItem(i, "quantidade", e.target.value)} required /></div>
                <IconBtn titulo="Remover item" variante="perigo" onClick={() => delItem(i)}><X size={16} /></IconBtn>
              </div>
            </div>
          ))}
          <div className="toolbar">
            <button type="button" className="btn small secondary" onClick={addItem} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Plus size={15} /> Adicionar item</button>
            <span>Total previsto: <b>{formatBRL(totalPrev)}</b></span>
          </div>
          <div className="grid2">
            <div><label>Data do pedido</label>
              <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required /></div>
            <div><label>Entrega combinada</label>
              <input type="date" value={form.data_entrega} onChange={(e) => setForm({ ...form, data_entrega: e.target.value })} /></div>
          </div>
          <label>Observação</label>
          <input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} placeholder="Ex: entregar após as 18h" />
          <div className="toolbar">
            <button className="btn" type="submit">{editId ? "Salvar" : "Lançar pedido"}</button>
            {editId && <button type="button" className="btn secondary" onClick={() => { setEditId(null); setForm({ ...empty, data: HOJE }); }}>Cancelar</button>}
          </div>
        </form>
      </div>
      <div className="card">
        <div className="toolbar">
          <select value={fSemana} onChange={(e) => setFSemana(e.target.value)} style={{ maxWidth: 240 }}>
            <option value="">Todas as semanas</option>
            {semanas.map((s) => <option key={s.id} value={s.id}>{s.titulo}</option>)}
          </select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {sel.ids.length > 0 && (
            <button className="btn small danger" onClick={excluirSelecionados}>
              Excluir ({sel.ids.length})
            </button>
          )}
        </div>
        <table>
          <thead><tr><th><input type="checkbox" style={{ width: "auto", margin: 0 }} checked={sel.todosMarcados(pedidos)} onChange={() => sel.alternarTodos(pedidos)} /></th><th>#</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Entrega</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id} id={`pedido-${p.id}`} className={destaque === p.id ? "linha-destaque" : ""}>
                <td><input type="checkbox" style={{ width: "auto", margin: 0 }} checked={sel.marcado(p.id)} onChange={() => sel.alternar(p.id)} /></td>
                <td>{p.id}</td>
                <td>{p.cliente_nome}<br /><small>{p.semana_titulo || "Avulso"}</small></td>
                <td>{p.itens.map((it) => `${it.quantidade}x ${it.cardapio_nome}`).join(", ")}</td>
                <td>{formatBRL(p.total)}</td>
                <td>{p.data_entrega || "-"}</td>
                <td>{STATUS[p.status] || p.status}</td>
                <td><div className="row-actions">
                    {PROXIMO[p.status] && <IconBtn titulo={`Avançar para ${STATUS[PROXIMO[p.status]]}`} variante="sucesso" onClick={() => avancar(p)}><ArrowRight size={16} /></IconBtn>}
                    <IconBtn titulo="Confirmar pelo WhatsApp" variante="sucesso" onClick={() => confirmarWhats(p)}><MessageCircle size={16} /></IconBtn>
                    <IconBtn titulo="Editar pedido" variante="secundaria" onClick={() => editar(p)}><Pencil size={16} /></IconBtn>
                    {p.status !== "cancelado" && <IconBtn titulo="Cancelar pedido" variante="perigo" onClick={() => cancelar(p)}><Ban size={16} /></IconBtn>}
                    <IconBtn titulo="Excluir pedido" variante="perigo" onClick={() => excluir(p.id)}><Trash2 size={16} /></IconBtn>
                  </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {pedidos.length === 0 && <p>Nenhum pedido.</p>}
      </div>
    </div>
  );
}
