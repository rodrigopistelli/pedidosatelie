import { useEffect, useState } from "react";
import { api, formatBRL } from "../api";
import { msgSemana, waLink, copyText } from "../whatsapp";

const empty = { titulo: "", data_inicio: "", data_fim: "", observacao: "" };
const STATUS = { rascunho: "Rascunho", aberto: "Aberta", fechado: "Fechada" };

export default function Semanas() {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [cardapios, setCardapios] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [addPrato, setAddPrato] = useState("");
  const [cliEnvio, setCliEnvio] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  async function carregar() {
    const [s, m, c] = await Promise.all([
      api("/api/semanas"), api("/api/cardapios"), api("/api/clientes")
    ]);
    setLista(s);
    setCardapios(m);
    setClientes(c);
  }

  useEffect(() => { carregar().catch((e) => setError(e.message)); }, []);

  async function abrir(id) {
    setError("");
    try { setDetalhe(await api(`/api/semanas/${id}`)); }
    catch (err) { setError(err.message); }
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

  async function adicionarPrato() {
    if (!addPrato || !detalhe) return;
    try {
      await api(`/api/semanas/${detalhe.id}/itens`, { method: "POST", body: JSON.stringify({ cardapio_id: addPrato }) });
      setAddPrato("");
      abrir(detalhe.id);
    } catch (err) { setError(err.message); }
  }

  async function removerPrato(cardapioId) {
    try {
      await api(`/api/semanas/${detalhe.id}/itens/${cardapioId}`, { method: "DELETE" });
      abrir(detalhe.id);
    } catch (err) { setError(err.message); }
  }

  function copiarMensagem() {
    if (!detalhe) return;
    copyText(msgSemana(detalhe, detalhe.itens || []))
      .then(() => setAviso("Mensagem copiada! Cole na lista de transmissão do WhatsApp."))
      .catch(() => setError("Não foi possível copiar."));
  }

  function enviarCliente() {
    if (!detalhe || !cliEnvio) return;
    const c = clientes.find((x) => String(x.id) === String(cliEnvio));
    if (!c) return;
    window.open(waLink(c.telefone, msgSemana(detalhe, detalhe.itens || [])), "_blank");
  }

  return (
    <div className="container">
      <h1>Cardápio da Semana</h1>
      {error && <div className="error">{error}</div>}
      {aviso && <div className="card" style={{ background: "#dcfce7" }}>{aviso}</div>}

      <div className="card">
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

      <div className="card">
        <h2>Semanas</h2>
        <table>
          <thead><tr><th>Título</th><th>Período</th><th>Status</th><th>Pedidos</th><th>Ações</th></tr></thead>
          <tbody>
            {lista.map((s) => (
              <tr key={s.id}>
                <td>{s.titulo}</td>
                <td>{s.data_inicio || "-"} a {s.data_fim || "-"}</td>
                <td>{STATUS[s.status] || s.status}</td>
                <td><button className="btn small" onClick={() => abrir(s.id)}>Abrir</button></td>
                <td><div className="row-actions">
                  <button className="btn small secondary" onClick={() => {
                    setEditId(s.id);
                    setForm({ titulo: s.titulo, data_inicio: s.data_inicio || "", data_fim: s.data_fim || "", observacao: s.observacao || "" });
                  }}>Editar</button>
                  <button className="btn small danger" onClick={() => excluir(s.id)}>Excluir</button>
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
          <div className="toolbar">
            {detalhe.status === "rascunho" && <button className="btn small" onClick={() => mudarStatus(detalhe.id, "aberto")}>Abrir para encomendas</button>}
            {detalhe.status === "aberto" && <button className="btn small secondary" onClick={() => mudarStatus(detalhe.id, "fechado")}>Fechar semana</button>}
            {detalhe.status === "fechado" && <button className="btn small secondary" onClick={() => mudarStatus(detalhe.id, "aberto")}>Reabrir</button>}
          </div>
          <h3>Pratos da semana</h3>
          <div className="toolbar">
            <select value={addPrato} onChange={(e) => setAddPrato(e.target.value)} style={{ maxWidth: 300 }}>
              <option value="">Adicionar prato...</option>
              {cardapios.map((m) => <option key={m.id} value={m.id}>{m.nome} — {formatBRL(m.preco)}</option>)}
            </select>
            <button className="btn small" onClick={adicionarPrato}>Adicionar</button>
          </div>
          <table>
            <thead><tr><th>Prato</th><th>Preço</th><th></th></tr></thead>
            <tbody>
              {(detalhe.itens || []).map((m) => (
                <tr key={m.id}>
                  <td>{m.nome}</td><td>{formatBRL(m.preco)}</td>
                  <td><button className="btn small danger" onClick={() => removerPrato(m.id)}>Remover</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Divulgar no WhatsApp</h3>
          <div className="toolbar">
            <button className="btn small" onClick={copiarMensagem}>Copiar mensagem da semana</button>
            <select value={cliEnvio} onChange={(e) => setCliEnvio(e.target.value)} style={{ maxWidth: 260 }}>
              <option value="">Enviar direto para...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <button className="btn small secondary" onClick={enviarCliente}>Abrir WhatsApp</button>
          </div>
          <pre style={{ whiteSpace: "pre-wrap", background: "#f8fafc", padding: 12, borderRadius: 8, fontSize: 13 }}>
            {msgSemana(detalhe, detalhe.itens || [])}
          </pre>
        </div>
      )}
    </div>
  );
}
