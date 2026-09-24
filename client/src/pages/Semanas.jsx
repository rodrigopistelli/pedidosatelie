import { useEffect, useState } from "react";
import { FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { api, formatBRL } from "../api";
import IconBtn from "../components/IconBtn";
import { useSelecao } from "../components/useSelecao";

const empty = { titulo: "", data_inicio: "", data_fim: "", observacao: "" };
const STATUS = { rascunho: "Rascunho", aberto: "Aberta", fechado: "Fechada" };

export default function Semanas() {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [cardapios, setCardapios] = useState([]);
  const [addPrato, setAddPrato] = useState("");
  const [error, setError] = useState("");
  const [relatorio, setRelatorio] = useState(null);
  const sel = useSelecao();

  async function carregar() {
    const [s, m] = await Promise.all([
      api("/api/semanas"), api("/api/cardapios")
    ]);
    setLista(s);
    setCardapios(m);
  }

  useEffect(() => { carregar().catch((e) => setError(e.message)); }, []);

  async function abrir(id) {
    setError("");
    try {
      setDetalhe(await api(`/api/semanas/${id}`));
      setRelatorio(null);
    } catch (err) { setError(err.message); }
  }

  async function salvar(e) {
    e.preventDefault();
    setError("");
    try {
      const s = editId
        ? await api(`/api/semanas/${editId}`, { method: "PUT", body: JSON.stringify(form) })
        : await api("/api/semanas", { method: "POST", body: JSON.stringify(form) });
      setForm(empty);
      setEditId(null);
      await carregar();
      abrir(s.id);
    } catch (err) { setError(err.message); }
  }

  async function mudarStatus(id, status) {
    try {
      const s = await api(`/api/semanas/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      await carregar();
      setDetalhe((d) => (d && d.id === id ? { ...d, status: s.status } : d));
    } catch (err) { setError(err.message); }
  }

  async function excluir(id) {
    if (!confirm("Excluir esta semana? Os pedidos vinculados serão mantidos, sem semana.")) return;
    try {
      await api(`/api/semanas/${id}`, { method: "DELETE" });
      setDetalhe(null);
      carregar();
    } catch (err) { setError(err.message); }
  }

  async function excluirSelecionados() {
    if (!sel.ids.length) return;
    if (!confirm(`Excluir ${sel.ids.length} semana(s) selecionada(s)? Os pedidos serão mantidos, sem semana.`)) return;
    const falhas = await sel.excluirEmMassa({ lista, rota: "/api/semanas", rotulo: (s) => s.titulo });
    setDetalhe(null);
    setRelatorio(null);
    carregar();
    if (falhas.length) setError(`Não excluídas: ${falhas.join(" · ")}`);
  }

  async function adicionarPrato() {
    if (!addPrato || !detalhe) return;
    try {
      await api(`/api/semanas/${detalhe.id}/itens`, { method: "POST", body: JSON.stringify({ cardapio_id: addPrato }) });
      setAddPrato("");
      abrir(detalhe.id);
    } catch (err) { setError(err.message); }
  }

  async function carregarRelatorio() {
    if (relatorio) { setRelatorio(null); return; }
    try {
      const pedidos = await api(`/api/pedidos?semana_id=${detalhe.id}`);
      const validos = pedidos.filter((p) => p.status !== "cancelado");
      const porPrato = new Map();
      for (const p of validos) {
        for (const it of p.itens || []) {
          porPrato.set(it.cardapio_nome, (porPrato.get(it.cardapio_nome) || 0) + Number(it.quantidade));
        }
      }
      setRelatorio({
        pedidos,
        totalPedidos: pedidos.length,
        faturamento: validos.reduce((s, p) => s + Number(p.total || 0), 0),
        porPrato: [...porPrato.entries()].map(([prato, unidades]) => ({ prato, unidades }))
      });
    } catch (err) { setError(err.message); }
  }

  async function removerPrato(cardapioId) {
    try {
      await api(`/api/semanas/${detalhe.id}/itens/${cardapioId}`, { method: "DELETE" });
      abrir(detalhe.id);
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="container">
      <h1>Cardápio da Semana</h1>
      {error && <div className="error">{error}</div>}

      <div className="card nao-imprimir">
        <h2>{editId ? "Editar semana" : "Nova semana"}</h2>
        <form onSubmit={salvar}>
          <label>Título</label>
          <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            placeholder="Ex: Semana 23/09 a 27/09" required />
          <div className="grid2">
            <div><label>Início</label>
              <input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
            <div><label>Fim</label>
              <input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></div>
          </div>
          <label>Observação</label>
          <input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            placeholder="Ex: encomendas até quinta 18h" />
          <div className="toolbar">
            <button className="btn" type="submit">{editId ? "Salvar" : "Criar semana"}</button>
            {editId && <button type="button" className="btn secondary" onClick={() => { setEditId(null); setForm(empty); }}>Cancelar</button>}
          </div>
        </form>
      </div>

      <div className="card nao-imprimir">
        <h2>Semanas</h2>
        {sel.ids.length > 0 && (
          <div className="toolbar">
            <button className="btn small danger" onClick={excluirSelecionados}>
              Excluir ({sel.ids.length})
            </button>
          </div>
        )}
        <table>
          <thead><tr><th><input type="checkbox" style={{ width: "auto", margin: 0 }} checked={sel.todosMarcados(lista)} onChange={() => sel.alternarTodos(lista)} /></th><th></th><th>Título</th><th>Período</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            {lista.map((s) => (
              <tr key={s.id}>
                <td><input type="checkbox" style={{ width: "auto", margin: 0 }} checked={sel.marcado(s.id)} onChange={() => sel.alternar(s.id)} /></td>
                <td><IconBtn titulo="Abrir semana" onClick={() => abrir(s.id)}><FolderOpen size={16} /></IconBtn></td>
                <td>{s.titulo}</td>
                <td>{s.data_inicio || "-"} a {s.data_fim || "-"}</td>
                <td>{STATUS[s.status] || s.status}</td>
                <td><div className="row-actions">
                  <IconBtn titulo="Editar semana" variante="secundaria" onClick={() => {
                    setEditId(s.id);
                    setForm({ titulo: s.titulo, data_inicio: s.data_inicio || "", data_fim: s.data_fim || "", observacao: s.observacao || "" });
                  }}><Pencil size={16} /></IconBtn>
                  <IconBtn titulo="Excluir semana" variante="perigo" onClick={() => excluir(s.id)}><Trash2 size={16} /></IconBtn>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length === 0 && <p>Nenhuma semana criada.</p>}
      </div>

      {detalhe && (
        <div className="card">
          <h2>{detalhe.titulo} — {STATUS[detalhe.status]}</h2>
          <p>Pedidos: <b>{detalhe.total_pedidos}</b> · Faturamento (não cancelados): <b>{formatBRL(detalhe.faturamento)}</b></p>
          <div className="toolbar nao-imprimir">
            {detalhe.status === "rascunho" && <button className="btn small" onClick={() => mudarStatus(detalhe.id, "aberto")}>Abrir para encomendas</button>}
            {detalhe.status === "aberto" && <button className="btn small secondary" onClick={() => mudarStatus(detalhe.id, "fechado")}>Fechar semana</button>}
            {detalhe.status === "fechado" && <button className="btn small secondary" onClick={() => mudarStatus(detalhe.id, "aberto")}>Reabrir</button>}
          </div>
          <div className="nao-imprimir">
          <h3>Pratos da semana</h3>
          <div className="toolbar">
            <select value={addPrato} onChange={(e) => setAddPrato(e.target.value)} style={{ maxWidth: 300 }}>
              <option value="">Adicionar prato...</option>
              {cardapios.map((m) => <option key={m.id} value={m.id}>{m.nome} — {formatBRL(m.preco)}</option>)}
            </select>
            <IconBtn titulo="Adicionar prato" onClick={adicionarPrato}><Plus size={16} /></IconBtn>
          </div>
          <table>
            <thead><tr><th>Prato</th><th>Preço</th><th></th></tr></thead>
            <tbody>
              {(detalhe.itens || []).map((m) => (
                <tr key={m.id}>
                  <td>{m.nome}</td><td>{formatBRL(m.preco)}</td>
                  <td><IconBtn titulo="Remover prato" variante="perigo" onClick={() => removerPrato(m.id)}><Trash2 size={16} /></IconBtn></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <h3>Relatório de pedidos</h3>
          <div className="toolbar nao-imprimir">
            <button className="btn small" onClick={carregarRelatorio}>
              {relatorio ? "Ocultar relatório" : "Listar pedidos da semana"}
            </button>
            {relatorio && <button className="btn small secondary" onClick={() => window.print()}>Imprimir</button>}
          </div>
          {relatorio && (
            <>
              <p>Pedidos: <b>{relatorio.totalPedidos}</b> · Faturamento (não cancelados): <b>{formatBRL(relatorio.faturamento)}</b></p>
              <h3>Resumo por prato</h3>
              <table>
                <thead><tr><th>Prato</th><th>Unidades</th></tr></thead>
                <tbody>
                  {relatorio.porPrato.map((r, i) => (
                    <tr key={i}><td>{r.prato}</td><td>{r.unidades}</td></tr>
                  ))}
                </tbody>
              </table>
              <h3 style={{ marginTop: 12 }}>Pedidos</h3>
              <table>
                <thead><tr><th>#</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Entrega</th><th>Status</th></tr></thead>
                <tbody>
                  {relatorio.pedidos.map((p) => (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td>{p.cliente_nome}</td>
                      <td>{(p.itens || []).map((it) => `${it.quantidade}x ${it.cardapio_nome}`).join(", ")}</td>
                      <td>{formatBRL(p.total)}</td>
                      <td>{p.data_entrega || "-"}</td>
                      <td>{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {relatorio.pedidos.length === 0 && <p>Nenhum pedido nesta semana.</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
