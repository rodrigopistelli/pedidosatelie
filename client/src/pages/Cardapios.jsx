import { useEffect, useState } from "react";
import { api, formatBRL } from "../api";

const empty = { nome: "", descricao: "", preco: "" };

export default function Cardapios() {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [busca, setBusca] = useState("");
  const [error, setError] = useState("");

  async function carregar(q = "") {
    const data = await api(`/api/cardapios${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    setLista(data);
  }

  useEffect(() => { carregar().catch((e) => setError(e.message)); }, []);

  async function salvar(e) {
    e.preventDefault();
    setError("");
    try {
      if (editId) {
        await api(`/api/cardapios/${editId}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await api("/api/cardapios", { method: "POST", body: JSON.stringify(form) });
      }
      setForm(empty);
      setEditId(null);
      carregar(busca);
    } catch (err) { setError(err.message); }
  }

  function editar(m) {
    setEditId(m.id);
    setForm({ nome: m.nome, descricao: m.descricao || "", preco: m.preco });
  }

  async function excluir(id) {
    if (!confirm("Excluir este item?")) return;
    try { await api(`/api/cardapios/${id}`, { method: "DELETE" }); carregar(busca); }
    catch (err) { setError(err.message); }
  }

  return (
    <div className="container">
      <h1>Cardápios</h1>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <h2>{editId ? "Editar item" : "Novo item do cardápio"}</h2>
        <form onSubmit={salvar}>
          <label>Nome do prato/item</label>
          <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Pizza Margherita" required />
          <label>Descrição</label>
          <textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ingredientes, tamanho..." />
          <label>Preço (R$)</label>
          <input type="number" step="0.01" min="0" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} required />
          <div className="toolbar">
            <button className="btn" type="submit">{editId ? "Salvar" : "Cadastrar"}</button>
            {editId && <button type="button" className="btn secondary" onClick={() => { setEditId(null); setForm(empty); }}>Cancelar</button>}
          </div>
        </form>
      </div>
      <div className="card">
        <div className="toolbar">
          <input placeholder="Buscar item..." value={busca}
            onChange={(e) => { setBusca(e.target.value); carregar(e.target.value); }} />
        </div>
        <table>
          <thead><tr><th>ID</th><th>Nome</th><th>Descrição</th><th>Preço</th><th>Ações</th></tr></thead>
          <tbody>
            {lista.map((m) => (
              <tr key={m.id}>
                <td>{m.id}</td><td>{m.nome}</td><td>{m.descricao}</td>
                <td>{formatBRL(m.preco)}</td>
                <td><div className="row-actions">
                  <button className="btn small secondary" onClick={() => editar(m)}>Editar</button>
                  <button className="btn small danger" onClick={() => excluir(m.id)}>Excluir</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length === 0 && <p>Nenhum item cadastrado.</p>}
      </div>
    </div>
  );
}
