import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { api } from "../api";
import IconBtn from "../components/IconBtn";
import { useSelecao } from "../components/useSelecao";

const empty = { nome: "", telefone: "", endereco: "" };

export default function Clientes() {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [busca, setBusca] = useState("");
  const [error, setError] = useState("");
  const sel = useSelecao();

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

  async function excluirSelecionados() {
    if (!sel.ids.length) return;
    if (!confirm(`Excluir ${sel.ids.length} cliente(s) selecionado(s)?`)) return;
    const falhas = await sel.excluirEmMassa({ lista, rota: "/api/clientes", rotulo: (c) => c.nome });
    carregar(busca);
    if (falhas.length) setError(`Não excluídos: ${falhas.join(" · ")}`);
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
          {sel.ids.length > 0 && (
            <button className="btn small danger" onClick={excluirSelecionados}>
              Excluir ({sel.ids.length})
            </button>
          )}
        </div>
        <table>
          <thead><tr><th><input type="checkbox" style={{ width: "auto", margin: 0 }} checked={sel.todosMarcados(lista)} onChange={() => sel.alternarTodos(lista)} /></th><th>ID</th><th>Nome</th><th>Telefone</th><th>Endereço</th><th>Ações</th></tr></thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id}>
                <td><input type="checkbox" style={{ width: "auto", margin: 0 }} checked={sel.marcado(c.id)} onChange={() => sel.alternar(c.id)} /></td>
                <td>{c.id}</td><td>{c.nome}</td><td>{c.telefone}</td><td>{c.endereco}</td>
                <td><div className="row-actions">
                  <IconBtn titulo="Editar cliente" variante="secundaria" onClick={() => editar(c)}><Pencil size={16} /></IconBtn>
                  <IconBtn titulo="Excluir cliente" variante="perigo" onClick={() => excluir(c.id)}><Trash2 size={16} /></IconBtn>
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
