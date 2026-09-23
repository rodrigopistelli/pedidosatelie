import { useEffect, useState } from "react";
import { api, formatBRL } from "../api";

const empty = { nome: "", descricao: "", preco: "" };

export default function Cardapios() {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [busca, setBusca] = useState("");
  const [error, setError] = useState("");
  const [fichaId, setFichaId] = useState(null);
  const [ficha, setFicha] = useState([]);
  const [ingredientes, setIngredientes] = useState([]);
  const [novoIng, setNovoIng] = useState({ ingrediente_id: "", quantidade: "" });

  async function carregar(q = "") {
    const data = await api(`/api/cardapios${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    setLista(data);
  }

  useEffect(() => {
    carregar().catch((e) => setError(e.message));
    api("/api/ingredientes").then(setIngredientes).catch(() => {});
  }, []);

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
    if (!confirm("Excluir este prato?")) return;
    try { await api(`/api/cardapios/${id}`, { method: "DELETE" }); carregar(busca); }
    catch (err) { setError(err.message); }
  }

  async function abrirFicha(id) {
    if (fichaId === id) { setFichaId(null); return; }
    try {
      setFicha(await api(`/api/cardapios/${id}/ingredientes`));
      setFichaId(id);
      setNovoIng({ ingrediente_id: "", quantidade: "" });
    } catch (err) { setError(err.message); }
  }

  async function addIngrediente() {
    if (!novoIng.ingrediente_id || !novoIng.quantidade) return;
    try {
      await api(`/api/cardapios/${fichaId}/ingredientes`, { method: "POST", body: JSON.stringify(novoIng) });
      setFicha(await api(`/api/cardapios/${fichaId}/ingredientes`));
      setNovoIng({ ingrediente_id: "", quantidade: "" });
    } catch (err) { setError(err.message); }
  }

  async function removerIngrediente(ingId) {
    try {
      await api(`/api/cardapios/${fichaId}/ingredientes/${ingId}`, { method: "DELETE" });
      setFicha(await api(`/api/cardapios/${fichaId}/ingredientes`));
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="container">
      <h1>Cardápios (pratos)</h1>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <h2>{editId ? "Editar prato" : "Novo prato"}</h2>
        <form onSubmit={salvar}>
          <label>Nome do prato</label>
          <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Strogonoff de frango (congelado 500g)" required />
          <label>Descrição</label>
          <textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ingredientes, tamanho da porção..." />
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
          <input placeholder="Buscar prato..." value={busca}
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
                  <button className="btn small" onClick={() => abrirFicha(m.id)}>Ficha técnica</button>
                  <button className="btn small secondary" onClick={() => editar(m)}>Editar</button>
                  <button className="btn small danger" onClick={() => excluir(m.id)}>Excluir</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length === 0 && <p>Nenhum prato cadastrado.</p>}
        {fichaId && (
          <div style={{ marginTop: 16, borderTop: "1px solid #eee", paddingTop: 12 }}>
            <h3>Ficha técnica — quantidade de cada ingrediente por 1 unidade do prato</h3>
            <table>
              <thead><tr><th>Ingrediente</th><th>Qtd / unidade</th><th></th></tr></thead>
              <tbody>
                {ficha.map((f) => (
                  <tr key={f.ingrediente_id}>
                    <td>{f.ingrediente_nome}</td>
                    <td>{f.quantidade} {f.unidade}</td>
                    <td><button className="btn small danger" onClick={() => removerIngrediente(f.ingrediente_id)}>Remover</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ficha.length === 0 && <p style={{ fontSize: 13 }}>Sem ingredientes — este prato ficará fora do levantamento automático.</p>}
            <div className="toolbar" style={{ marginTop: 8 }}>
              <select value={novoIng.ingrediente_id} onChange={(e) => setNovoIng({ ...novoIng, ingrediente_id: e.target.value })} style={{ maxWidth: 260 }}>
                <option value="">Ingrediente...</option>
                {ingredientes.map((i) => <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>)}
              </select>
              <input type="number" step="0.001" min="0" placeholder="Qtd por unidade" style={{ maxWidth: 160, margin: 0 }}
                value={novoIng.quantidade} onChange={(e) => setNovoIng({ ...novoIng, quantidade: e.target.value })} />
              <button className="btn small" onClick={addIngrediente}>Adicionar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
