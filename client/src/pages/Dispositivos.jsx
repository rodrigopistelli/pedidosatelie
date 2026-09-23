import { useEffect, useState } from "react";
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { api } from "../api";

export default function Dispositivos() {
  const [lista, setLista] = useState([]);
  const [nome, setNome] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [loading, setLoading] = useState(false);
  const suportado = browserSupportsWebAuthn();

  async function carregar() {
    setLista(await api("/api/webauthn/devices"));
  }

  useEffect(() => { carregar().catch((e) => setError(e.message)); }, []);

  async function cadastrar() {
    setError("");
    setAviso("");
    setLoading(true);
    try {
      const options = await api("/api/webauthn/register/options");
      const attestation = await startRegistration({ optionsJSON: options });
      await api("/api/webauthn/register/verify", {
        method: "POST",
        body: JSON.stringify({ attestation, nome: nome.trim() || "Este aparelho" })
      });
      setNome("");
      setAviso("Aparelho cadastrado! Da próxima vez entre com biometria / PIN.");
      carregar();
    } catch (err) {
      if (err?.name === "NotAllowedError") setError("Cadastro cancelado ou biometria indisponível.");
      else if (err?.name === "NotSupportedError" || err?.name === "InvalidStateError")
        setError("Aparelho não suporta biometria ou já está cadastrado.");
      else setError(err.message || "Falha ao cadastrar.");
    } finally {
      setLoading(false);
    }
  }

  async function remover(id) {
    if (!confirm("Remover este aparelho? Ele perderá o acesso por biometria.")) return;
    try {
      await api(`/api/webauthn/devices/${encodeURIComponent(id)}`, { method: "DELETE" });
      carregar();
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="container">
      <h1>Dispositivos (biometria / PIN)</h1>
      <p style={{ color: "#555", fontSize: 14 }}>
        Cadastre este aparelho para entrar sem senha, usando digital, facial ou PIN do dispositivo.
        A senha continua funcionando normalmente.
      </p>
      {error && <div className="error">{error}</div>}
      {aviso && <div className="card" style={{ background: "#dcfce7" }}>{aviso}</div>}
      {!suportado && <div className="error">Este navegador/aparelho não suporta login biométrico.</div>}
      <div className="card">
        <h2>Cadastrar este aparelho</h2>
        <label>Nome do aparelho</label>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Notebook, Celular" />
        <button className="btn" onClick={cadastrar} disabled={loading || !suportado}>
          {loading ? "Aguardando biometria..." : "Cadastrar com biometria"}
        </button>
      </div>
      <div className="card">
        <h2>Aparelhos cadastrados</h2>
        <table>
          <thead><tr><th>Nome</th><th>Cadastrado em</th><th></th></tr></thead>
          <tbody>
            {lista.map((d) => (
              <tr key={d.id}>
                <td>{d.nome || "(sem nome)"}</td>
                <td>{d.created_at}</td>
                <td><button className="btn small danger" onClick={() => remover(d.id)}>Remover</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length === 0 && <p>Nenhum aparelho cadastrado.</p>}
      </div>
    </div>
  );
}
