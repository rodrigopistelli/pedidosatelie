import { useEffect, useState } from "react";
import { api } from "../api";

export default function Compras() {
  const [semanas, setSemanas] = useState([]);
  const [semanaId, setSemanaId] = useState("");
  const [dados, setDados] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/semanas").then((s) => {
      setSemanas(s);
      const aberta = s.find((x) => x.status === "aberto");
      if (aberta) setSemanaId(String(aberta.id));
      else if (s.length) setSemanaId(String(s[0].id));
    }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!semanaId) return;
    api(`/api/compras?semana_id=${semanaId}`)
      .then(setDados)
      .catch((e) => setError(e.message));
  }, [semanaId]);

  return (
    <div className="container">
      <h1>Levantamento de Compras</h1>
      <p style={{ color: "#555", fontSize: 14 }}>
        Soma automática dos ingredientes (ficha técnica × quantidades encomendadas),
        considerando pedidos <b>não cancelados</b> da semana.
      </p>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <div className="toolbar">
          <select value={semanaId} onChange={(e) => setSemanaId(e.target.value)} style={{ maxWidth: 300 }}>
            {semanas.map((s) => <option key={s.id} value={s.id}>{s.titulo} ({s.status})</option>)}
          </select>
          <button className="btn small secondary" onClick={() => window.print()}>Imprimir</button>
        </div>
        {dados && (
          <>
            <h2>Lista de compras</h2>
            <table>
              <thead><tr><th>Ingrediente</th><th>Total a comprar</th><th>Detalhe por prato</th></tr></thead>
              <tbody>
                {dados.ingredientes.map((g, i) => (
                  <tr key={i}>
                    <td><b>{g.ingrediente}</b></td>
                    <td><b>{g.total} {g.unidade}</b></td>
                    <td><small>{g.pratos.map((d) => `${d.unidades}x ${d.prato} (${d.por_unidade} ${g.unidade}/un)`).join(" · ")}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dados.ingredientes.length === 0 && <p>Nenhum ingrediente levantado (sem pedidos ou sem ficha técnica).</p>}
            {dados.sem_ficha.length > 0 && (
              <>
                <h2 style={{ marginTop: 16 }}>Pratos sem ficha técnica — conferir manual</h2>
                <table>
                  <thead><tr><th>Prato</th><th>Unidades encomendadas</th></tr></thead>
                  <tbody>
                    {dados.sem_ficha.map((s, i) => (
                      <tr key={i}><td>{s.prato}</td><td>{s.unidades}</td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
