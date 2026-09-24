import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { api } from "../api";
import IconBtn from "../components/IconBtn";
import { useSelecao } from "../components/useSelecao";

const UNIDADES = ["un", "kg", "g", "L", "mL", "pacote", "caixa", "lata", "dúzia"];

export default function Ingredientes() {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState({ nome: "", unidade: "kg" });
  const [editId, setEditId] = useState(null);
  const [busca, setBusca] = useState("");
  const [error, setError] = useState("");
  const sel = useSelecao();

  async function carregar(q = "") {
    setLista(await api(`/api/ingredientes${q ? `?q=${encodeURIComponent(q)}` : ""}`));
  }

  useEffect(() => { carregar().catch((e) => setError(e.message)); }, []);

  async function salvar(e) {
    e.preventDefault();
    setError("");
    try {
      if (editId) await api(`/api/ingredientes/${editId}`, { method: "PUT", body: JSON.stringify(form) });
      else await api("/api/ingredientes", { method: "POST", body: JSON.stringify(form) });
      setForm({ nome: "", unidade: "kg" });
      setEditId(null);
      carregar(busca);
    } catch (err) { setError(err.message); }
  }

  async function excluir(id) {
    if (!confirm("Excluir este ingrediente?")) return;
    try { await api(`/api/ingredientes/${id}`, { method: "DELETE" }); carregar(busca); }
    catch (err) { setError(err.message); }
  }

  async function excluirSelecionados() {
    if (!sel.ids.length) return;
    if (!confirm(`Excluir ${sel.ids.length} ingrediente(s) selecionado(s)?`)) return;
    const falhas = await sel.excluirEmMassa({ lista, rota: "/api/ingredientes", rotulo: (i) => i.nome });
    carregar(busca);
    if (falhas.length) setError(`Não excluídos: ${falhas.join(" · ")}`);
  }

  return (
    <div className="container">
      <h1>Ingredientes</h1>
      <p style={{ color: "#555", fontSize: 14 }}>Cadastro dos itens de compra. Depois, vincule cada um aos pratos na tela Cardápios (ficha técnica) para gerar o levantamento automático em Compras.</p>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <h2>{editId ? "Editar ingrediente" : "Novo ingrediente"}</h2>
        <form onSubmit={salvar}>
          <div className="grid2">
            <div><label>Nome</label>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Peito de frango" required /></div>
            <div><label>Unidade de compra</label>
              <select value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })}>
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select></div>
          </div>
          <div className="toolbar">
            <button className="btn" type="submit">{editId ? "Salvar" : "Cadastrar"}</button>
            {editId && <button type="button" className="btn secondary" onClick={() => { setEditId(null); setForm({ nome: "", unidade: "kg" }); }}>Cancelar</button>}
          </div>
        </form>
      </div>
      <div className="card">
        <div className="toolbar">
          <input placeholder="Buscar ingrediente..." value={busca}
            onChange={(e) => { setBusca(e.target.value); carregar(e.target.value); }} />
          {sel.ids.length > 0 && (
            <button className="btn small danger" onClick={excluirSelecionados}>
              Excluir ({sel.ids.length})
            </button>
          )}
        </div>
        <table>
          <thead><tr><th><input type="checkbox" style={{ width: "auto", margin: 0 }} checked={sel.todosMarcados(lista)} onChange={() => sel.alternarTodos(lista)} /></th><th>ID</th><th>Nome</th><th>Unidade</th><th>Ações</th></tr></thead>
          <tbody>
            {lista.map((i) => (
              <tr key={i.id}>
                <td><input type="checkbox" style={{ width: "auto", margin: 0 }} checked={sel.marcado(i.id)} onChange={() => sel.alternar(i.id)} /></td>
                <td>{i.id}</td><td>{i.nome}</td><td>{i.unidade}</td>
                <td><div className="row-actions">
                  <IconBtn titulo="Editar ingrediente" variante="secundaria" onClick={() => { setEditId(i.id); setForm({ nome: i.nome, unidade: i.unidade }); }}><Pencil size={16} /></IconBtn>
                  <IconBtn titulo="Excluir ingrediente" variante="perigo" onClick={() => excluir(i.id)}><Trash2 size={16} /></IconBtn>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length === 0 && <p>Nenhum ingrediente cadastrado.</p>}
      </div>
    </div>
  );
}
