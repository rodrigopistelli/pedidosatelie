import { useEffect, useState } from "react";
import { api } from "../api";

const empty = { nome: "", telefone: "", endereco: "" };

export default function Clientes() {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [busca, setBusca] = useState("");
  const [error, setError] = useState("");

  async function carregar(q = "") {
    const data = await api(`/api/clientes${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    setLista(data);
  }

  useEffect(() => { carregar().catch((e) => setError(e.message)); }, []);

  async function salvar(e) {
    e.preventDefault();
    setError("");
    try {
      if (editId) {
        await api(`/api/clientes/${editId}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await api("/api/clientes", { method: "POST", body: JSON.stringify(form) });
      }
      setForm(empty);
      setEditId(null);
      carregar(busca);
    } catch (err) { setError(err.message); }
  }

  function editar(c) {
    setEditId(c.id);
    setForm({ nome: c.nome, telefone: c.telefone, endereco: c.endereco });
  }

  async function excluir(id) {
    if (!confirm("Excluir este cliente?")) return;
    try { await api(`/api/clientes/${id}`, { method: "DELETE" }); carregar(busca); }
    catch (err) { setError(err.message); }
  }

  return (
    <div className="container">
      <h1>Clientes</h1>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <h2>{editId ? "Editar cliente" : "Novo cliente"}</h2>
        <form onSubmit={salvar}>
          <label>Nome</label>
          <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          <div className="grid2">
            <div>
              <label>Telefone</label>
              <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(11) 99999-9999" required />
            </div>
            <div>
              <label>Endereço</label>
              <input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Rua, número, bairro" required />
            </div>
          </div>
          <div className="toolbar">
            <button className="btn" type="submit">{editId ? "Salvar" : "Cadastrar"}</button>
            {editId && <button type="button" className="btn secondary" onClick={() => { setEditId(null); setForm(empty); }}>Cancelar</button>}
          </div>
        </form>
      </div>
      <div className="card">
        <div className="toolbar">
          <input placeholder="Buscar por nome, telefone..." value={busca}
            onChange={(e) => { setBusca(e.target.value); carregar(e.target.value); }} />
        </div>
        <table>
          <thead><tr><th>ID</th><th>Nome</th><th>Telefone</th><th>Endereço</th><th>Ações</th></tr></thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td><td>{c.nome}</td><td>{c.telefone}</td><td>{c.endereco}</td>
                <td><div className="row-actions">
                  <button className="btn small secondary" onClick={() => editar(c)}>Editar</button>
                  <button className="btn small danger" onClick={() => excluir(c.id)}>Excluir</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length === 0 && <p>Nenhum cliente cadastrado.</p>}
      </div>
    </div>
  );
}
