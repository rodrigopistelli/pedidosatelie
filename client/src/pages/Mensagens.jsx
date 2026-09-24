import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { msgSemana, waLink, waPhone, copyText } from "../whatsapp";

const EMOJI_GRUPOS = [
  { titulo: "Saudação", emojis: ["👋", "😊", "🙏", "❤️", "🎉", "✨"] },
  { titulo: "Comidas", emojis: ["🍱", "🍝", "🍕", "🥗", "🍗", "🥩", "🐟", "🍚", "🫘", "🥕", "🥔", "🧀", "🥚", "🍰", "🍫", "🧁", "☕", "🧃"] },
  { titulo: "Avisos", emojis: ["✅", "📋", "💰", "💵", "🚚", "📦", "🕐", "📅", "⚠️", "👇", "👉", "❗"] }
];

export default function Mensagens() {
  const [semanas, setSemanas] = useState([]);
  const [semanaId, setSemanaId] = useState("");
  const [detalhe, setDetalhe] = useState(null);
  const [texto, setTexto] = useState("");
  const [clientes, setClientes] = useState([]);
  const [cliEnvio, setCliEnvio] = useState("");
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [mostrarEmojis, setMostrarEmojis] = useState(false);
  const [selecionados, setSelecionados] = useState({});
  const [disparo, setDisparo] = useState(null); // { fila: [ids], indice: number }
  const areaRef = useRef(null);

  useEffect(() => {
    Promise.all([api("/api/semanas"), api("/api/clientes")])
      .then(([s, c]) => {
        setSemanas(s);
        setClientes(c);
        const aberta = s.find((x) => x.status === "aberto");
        if (aberta) setSemanaId(String(aberta.id));
        else if (s.length) setSemanaId(String(s[0].id));
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!semanaId) return;
    api(`/api/semanas/${semanaId}`)
      .then((d) => {
        setDetalhe(d);
        // Restaura rascunho salvo ou preenche com o cardápio gerado
        const rascunho = localStorage.getItem(`msg-semana-${d.id}`);
        setTexto(rascunho ?? msgSemana(d, d.itens || []));
        setAviso("");
      })
      .catch((e) => setError(e.message));
  }, [semanaId]);

  // Salva rascunho automaticamente
  useEffect(() => {
    if (detalhe) localStorage.setItem(`msg-semana-${detalhe.id}`, texto);
  }, [texto, detalhe]);

  function textoCardapio() {
    if (!detalhe) return "";
    return msgSemana(detalhe, detalhe.itens || []);
  }

  function inserirNoCursor(insercao) {
    const el = areaRef.current;
    if (!el) {
      setTexto((t) => (t ? t + "\n\n" + insercao : insercao));
      return;
    }
    const ini = el.selectionStart ?? texto.length;
    const fim = el.selectionEnd ?? texto.length;
    const novo = texto.slice(0, ini) + insercao + texto.slice(fim);
    setTexto(novo);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = ini + insercao.length;
    });
  }

  function copiar() {
    setError("");
    copyText(texto)
      .then(() => setAviso("Texto copiado! Cole no WhatsApp."))
      .catch(() => setError("Não foi possível copiar."));
  }

  function enviarCliente() {
    if (!cliEnvio) {
      setError("Selecione o cliente para envio direto.");
      return;
    }
    const c = clientes.find((x) => String(x.id) === String(cliEnvio));
    if (!c) return;
    window.open(waLink(c.telefone, texto), "_blank");
  }

  // ---- Disparo assistido para todos (gratuito, sem risco de bloqueio) ----
  const clientesValidos = clientes.filter((c) => waPhone(c.telefone));
  const clientesSemFone = clientes.filter((c) => !waPhone(c.telefone));

  function todosSelecionados() {
    const sel = clientesValidos.filter((c) => selecionados[c.id] !== false);
    return sel;
  }

  function marcarTodos(v) {
    const novo = {};
    for (const c of clientesValidos) novo[c.id] = v;
    setSelecionados(novo);
    setDisparo(null);
  }

  function iniciarDisparo() {
    const fila = todosSelecionados().map((c) => c.id);
    if (!fila.length) {
      setError("Selecione ao menos 1 cliente com telefone válido.");
      return;
    }
    if (!texto.trim()) {
      setError("Escreva a mensagem antes de disparar.");
      return;
    }
    setError("");
    setDisparo({ fila, indice: 0 });
    const primeiro = clientes.find((c) => c.id === fila[0]);
    window.open(waLink(primeiro.telefone, texto), "_blank");
  }

  function proximoDisparo(pular = false) {
    if (!disparo) return;
    const prox = disparo.indice + 1;
    if (prox >= disparo.fila.length) {
      setDisparo({ ...disparo, indice: prox });
      return;
    }
    setDisparo({ ...disparo, indice: prox });
    if (!pular) {
      const c = clientes.find((x) => x.id === disparo.fila[prox]);
      window.open(waLink(c.telefone, texto), "_blank");
    }
  }

  const disparoAtual = disparo && disparo.indice < disparo.fila.length
    ? clientes.find((c) => c.id === disparo.fila[disparo.indice])
    : null;

  return (
    <div className="container">
      <h1>Mensagens WhatsApp</h1>
      <p style={{ color: "#555", fontSize: 14 }}>
        Edite o texto livremente, insira o cardápio da semana onde quiser, depois copie ou envie direto.
        O rascunho é salvo automaticamente por semana.
      </p>
      {error && <div className="error">{error}</div>}
      {aviso && <div className="card" style={{ background: "#dcfce7" }}>{aviso}</div>}
      <div className="card">
        <div className="toolbar">
          <select value={semanaId} onChange={(e) => setSemanaId(e.target.value)} style={{ maxWidth: 300 }}>
            {semanas.map((s) => <option key={s.id} value={s.id}>{s.titulo} ({s.status})</option>)}
          </select>
          <button className="btn small secondary" onClick={() => inserirNoCursor(textoCardapio())}>
            Inserir cardápio da semana
          </button>
          <button className="btn small secondary" onClick={() => { setTexto(textoCardapio()); setAviso(""); }}>
            Recarregar do cardápio
          </button>
        </div>
        <label>Texto da mensagem</label>
        <div className="toolbar">
          <button type="button" className="btn small secondary" onClick={() => setMostrarEmojis((v) => !v)}>
            {mostrarEmojis ? "Fechar emojis" : "Inserir emoji"}
          </button>
        </div>
        {mostrarEmojis && (
          <div style={{ background: "#f8fafc", padding: 10, borderRadius: 8, marginBottom: 8 }}>
            {EMOJI_GRUPOS.map((g) => (
              <div key={g.titulo} style={{ marginBottom: 6 }}>
                <small style={{ color: "#666" }}>{g.titulo}: </small>
                {g.emojis.map((e) => (
                  <button key={e} type="button" onClick={() => inserirNoCursor(e)}
                    style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", padding: 2 }}>
                    {e}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
        <textarea ref={areaRef} rows={14} value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="Digite sua mensagem aqui..." />
        <div className="toolbar">
          <button className="btn" onClick={copiar}>Copiar conteúdo</button>
          <select value={cliEnvio} onChange={(e) => setCliEnvio(e.target.value)} style={{ maxWidth: 260 }}>
            <option value="">Enviar direto para...</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <button className="btn secondary" onClick={enviarCliente}>Abrir WhatsApp</button>
        </div>
        <h3>Prévia</h3>
        <pre style={{ whiteSpace: "pre-wrap", background: "#f8fafc", padding: 12, borderRadius: 8, fontSize: 13 }}>
          {texto || "(vazio)"}
        </pre>
      </div>

      <div className="card">
        <h2>Disparo para todos os clientes</h2>
        <p style={{ color: "#555", fontSize: 13 }}>
          O app abre cada conversa com a mensagem pronta — você só aperta <b>enviar</b> no WhatsApp.
          Gratuito e sem risco de bloqueio do número.
        </p>
        <div className="toolbar">
          <button className="btn small secondary" onClick={() => marcarTodos(true)}>Selecionar todos</button>
          <button className="btn small secondary" onClick={() => marcarTodos(false)}>Limpar seleção</button>
          <span>{todosSelecionados().length} de {clientesValidos.length} selecionados</span>
        </div>
        {clientesSemFone.length > 0 && (
          <p style={{ fontSize: 13, color: "#92400e" }}>
            Sem telefone válido (ficam fora do disparo): {clientesSemFone.map((c) => c.nome).join(", ")}
          </p>
        )}
        <table>
          <thead><tr><th></th><th>Cliente</th><th>Telefone</th></tr></thead>
          <tbody>
            {clientesValidos.map((c) => (
              <tr key={c.id}>
                <td><input type="checkbox" style={{ width: "auto" }}
                  checked={selecionados[c.id] !== false}
                  onChange={(e) => { setSelecionados({ ...selecionados, [c.id]: e.target.checked }); setDisparo(null); }} /></td>
                <td>{c.nome}</td>
                <td>{c.telefone}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!disparo && (
          <div className="toolbar" style={{ marginTop: 8 }}>
            <button className="btn" onClick={iniciarDisparo}>Iniciar disparo</button>
          </div>
        )}
        {disparo && disparoAtual && (
          <div style={{ marginTop: 8, background: "#f0fdf4", padding: 12, borderRadius: 8 }}>
            <p>Enviando <b>{disparo.indice + 1} de {disparo.fila.length}</b> — atual: <b>{disparoAtual.nome}</b></p>
            <div className="toolbar">
              <button className="btn" onClick={() => proximoDisparo(false)}>Enviar e abrir próximo</button>
              <button className="btn secondary" onClick={() => proximoDisparo(true)}>Pular este</button>
              <button className="btn small secondary" onClick={() => setDisparo(null)}>Encerrar</button>
            </div>
          </div>
        )}
        {disparo && !disparoAtual && (
          <div style={{ marginTop: 8, background: "#dcfce7", padding: 12, borderRadius: 8 }}>
            <p><b>Disparo concluído!</b> {disparo.fila.length} conversas abertas.</p>
            <button className="btn small secondary" onClick={() => setDisparo(null)}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}
