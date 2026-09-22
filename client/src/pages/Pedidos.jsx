import { useEffect, useState } from "react";
import { api, formatBRL } from "../api";

const empty = { cliente_id: "", cardapio_id: "", quantidade: 1, data: new Date().toISOString().slice(0, 10), observacao: "" };

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cardapios, setCardapios] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");

  async function carregar() {
    const [p, c, m] = await Promise.all([
      api("/api/pedidos"), api("/api/clientes"), api("/api/cardapios")
    ]);
    setPedidos(p);
    setClientes(c);
    setCardapios(m);
  }

  useEffect(() => { carregar().catch((e) => setError(e.message)); }, []);

  const itemSelecionado = cardapios.find((x) => String(x.id) === String(form.cardapio_id));
  const totalPrev = itemSelecionado ? Number(itemSelecionado.preco) * Number(form.quantidade || 0) : 0;

  async function salvar(e) {
    e.preventDefault();
    setError("");
    try {
      if (editId) {
        await api(`/api/pedidos/${editId}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await api("/api/pedidos", { method: "POST", body: JSON.stringify(form) });
      }
      setForm(empty);
      setEditId(null);
      carregar();
    } catch (err) { setError(err.message); }
  }

  function editar(p) {
    setEditId(p.id);
    setForm({ cliente_id: p.cliente_id, cardapio_id: p.cardapio_id, quantidade: p.quantidade, data: p.data, observacao: p.observacao || "" });
  }

  async function excluir(id) {
    if (!confirm("Excluir este pedido?")) return;
    try { await api(`/api/pedidos/${id}`, { method: "DELETE" }); carregar(); }
    catch (err) { setError(err.message); }
  }

  return (
    <div className="container">
      <h1>Pedidos</h1>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <h2>{editId ? "Editar pedido" : "Novo pedido"}</h2>
        <form onSubmit={salvar}>
          <div className="grid2">
            <div>
              <label>Cliente que fez o pedido</label>
              <select value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })} required>
                <option value="">Selecione...</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome} — {c.telefone}</option>)}
              </select>
            </div>
            <div>
              <label>Cardápio</label>
              <select value={form.cardapio_id} onChange={(e) => setForm({ ...form, cardapio_id: e.target.value })} required>
                <option value="">Selecione...</option>
                {cardapios.map((m) => <option key={m.id} value={m.id}>{m.nome} — {formatBRL(m.preco)}</option>)}
              </select>
            </div>
          </div>
          <div className="grid2">
            <div>
              <label>Quantidade</label>
              <input type="number" min="1" step="1" value={form.quantidade}
                onChange={(e) => setForm({ ...form, quantidade: e.target.value })} required />
            </div>
            <div>
              <label>Data</label>
              <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required />
            </div>
          </div>
          <label>Observação</label>
          <input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} placeholder="Ex: sem cebola" />
          {itemSelecionado && <p>Total previsto: <b>{formatBRL(totalPrev)}</b></p>}
          <div className="toolbar">
            <button className="btn" type="submit">{editId ? "Salvar" : "Lançar pedido"}</button>
            {editId && <button type="button" className="btn secondary" onClick={() => { setEditId(null); setForm(empty); }}>Cancelar</button>}
          </div>
        </form>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>ID</th><th>Data</th><th>Cliente</th><th>Cardápio</th><th>Qtd</th><th>Total</th><th>Ações</th></tr></thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td><td>{p.data}</td><td>{p.cliente_nome}</td>
                <td>{p.cardapio_nome}</td><td>{p.quantidade}</td>
                <td>{formatBRL(p.total)}</td>
                <td><div className="row-actions">
                  <button className="btn small secondary" onClick={() => editar(p)}>Editar</button>
                  <button className="btn small danger" onClick={() => excluir(p.id)}>Excluir</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {pedidos.length === 0 && <p>Nenhum pedido lançado.</p>}
      </div>
    </div>
  );
}
