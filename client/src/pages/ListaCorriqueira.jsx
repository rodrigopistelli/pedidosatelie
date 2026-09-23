import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { api } from "../api";
import IconBtn from "../components/IconBtn";

const UNIDADES = ["un", "kg", "g", "L", "mL", "pacote", "caixa", "lata", "dúzia"];

export default function ListaCorriqueira() {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState({ nome: "", quantidade: 1, unidade: "un", observacao: "" });
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");

  async function carregar() {
    setLista(await api("/api/lista-corriqueira"));
  }

  useEffect(() => { carregar().catch((e) => setError(e.message)); }, []);

  async function salvar(e) {
    e.preventDefault();
    setError("");
    try {
      if (editId) await api(`/api/lista-corriqueira/${editId}`, { method: "PUT", body: JSON.stringify(form) });
      else await api("/api/lista-corriqueira", { method: "POST", body: JSON.stringify(form) });
      setForm({ nome: "", quantidade: 1, unidade: "un", observacao: "" });
      setEditId(null);
      carregar();
    } catch (err) { setError(err.message); }
  }

  async function alternar(item) {
    try {
      await api(`/api/lista-corriqueira/${item.id}`, {
        method: "PATCH", body: JSON.stringify({ comprado: !item.comprado })
      });
      carregar();
    } catch (err) { setError(err.message); }
  }

  async function excluir(id) {
    if (!confirm("Remover este item?")) return;
    try { await api(`/api/lista-corriqueira/${id}`, { method: "DELETE" }); carregar(); }
    catch (err) { setError(err.message); }
  }

  async function limparComprados() {
    if (!lista.some((i) => i.comprado)) return;
    if (!confirm("Apagar todos os itens já comprados?")) return;
    try { await api("/api/lista-corriqueira/comprados", { method: "DELETE" }); carregar(); }
    catch (err) { setError(err.message); }
  }

  const faltam = lista.filter((i) => !i.comprado).length;

  return (
    <div className="container">
      <h1>Lista Corriqueira (dia a dia)</h1>
      <p style={{ color: "#555", fontSize: 14 }}>
        Compras do dia a dia da casa — lançamento manual. O levantamento das <b>encomendas</b> fica em <b>Compras da Semana</b>.
      </p>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <h2>{editId ? "Editar item" : "Adicionar item"}</h2>
        <form onSubmit={salvar}>
          <div className="grid2">
            <div><label>Item</label>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Arroz 5kg" required /></div>
            <div><label>Observação</label>
              <input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                placeholder="Ex: marca X" /></div>
          </div>
          <div className="grid2">
            <div><label>Qtd</label>
              <input type="number" step="0.01" min="0" value={form.quantidade}
                onChange={(e) => setForm({ ...form, quantidade: e.target.value })} required /></div>
            <div><label>Unidade</label>
              <select value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })}>
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select></div>
          </div>
          <div className="toolbar">
            <button className="btn" type="submit">{editId ? "Salvar" : "Adicionar"}</button>
            {editId && <button type="button" className="btn secondary"
              onClick={() => { setEditId(null); setForm({ nome: "", quantidade: 1, unidade: "un", observacao: "" }); }}>Cancelar</button>}
          </div>
        </form>
      </div>
      <div className="card">
        <div className="toolbar">
          <span>Faltam <b>{faltam}</b> de <b>{lista.length}</b> itens</span>
          <span className="spacer" style={{ flex: 1 }} />
          <button className="btn small secondary" onClick={limparComprados}>Limpar já comprados</button>
        </div>
        <table>
          <thead><tr><th></th><th>Item</th><th>Qtd</th><th>Obs.</th><th>Ações</th></tr></thead>
          <tbody>
            {lista.map((i) => (
              <tr key={i.id} style={i.comprado ? { textDecoration: "line-through", color: "#888" } : {}}>
                <td><input type="checkbox" style={{ width: "auto" }} checked={!!i.comprado} onChange={() => alternar(i)} /></td>
                <td>{i.nome}</td>
                <td>{i.quantidade} {i.unidade}</td>
                <td>{i.observacao}</td>
                <td><div className="row-actions">
                  <IconBtn titulo="Editar item" variante="secundaria" onClick={() => {
                    setEditId(i.id);
                    setForm({ nome: i.nome, quantidade: i.quantidade, unidade: i.unidade, observacao: i.observacao || "" });
                  }}><Pencil size={16} /></IconBtn>
                  <IconBtn titulo="Excluir item" variante="perigo" onClick={() => excluir(i.id)}><Trash2 size={16} /></IconBtn>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length === 0 && <p>Lista vazia.</p>}
      </div>
    </div>
  );
}
