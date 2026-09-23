import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { msgSemana, waLink, copyText } from "../whatsapp";

export default function Mensagens() {
  const [semanas, setSemanas] = useState([]);
  const [semanaId, setSemanaId] = useState("");
  const [detalhe, setDetalhe] = useState(null);
  const [texto, setTexto] = useState("");
  const [clientes, setClientes] = useState([]);
  const [cliEnvio, setCliEnvio] = useState("");
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
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
    </div>
  );
}
