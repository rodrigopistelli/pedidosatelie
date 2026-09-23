import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import SenhaInput from "../components/SenhaInput";

function erroAmigavel(e) {
  if (e?.name === "NotAllowedError") return "Operação cancelada ou biometria indisponível no aparelho.";
  if (e?.name === "NotSupportedError") return "Este navegador/aparelho não suporta login biométrico.";
  return e?.message || "Falha no login biométrico.";
}

export default function Login() {
  const { login, loginComToken } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [bioLoading, setBioLoading] = useState(false);
  const bioSuportada = browserSupportsWebAuthn();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await login(username, password);
      nav("/");
    } catch (err) {
      setError(err.message);
    }
  }

  async function loginBiometria() {
    setError("");
    if (!username.trim()) {
      setError("Digite o usuário para entrar com biometria.");
      return;
    }
    setBioLoading(true);
    try {
      const options = await api(`/api/webauthn/login/options?username=${encodeURIComponent(username.trim())}`);
      const assertion = await startAuthentication({ optionsJSON: options });
      const d = await api("/api/webauthn/login/verify", {
        method: "POST",
        body: JSON.stringify({ username: username.trim(), assertion })
      });
      loginComToken(d.token, d.username);
      nav("/");
    } catch (err) {
      setError(erroAmigavel(err));
    } finally {
      setBioLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="card login-box">
        <h1>Entrar</h1>
        <p style={{ color: "#666", fontSize: 14 }}>PedidosAtelie — encomendas de marmitas</p>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label>Usuário</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" required />
          <label>Senha</label>
          <SenhaInput value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="btn" style={{ width: "100%" }} type="submit">Login</button>
        </form>
        {bioSuportada && (
          <>
            <div style={{ textAlign: "center", color: "#888", fontSize: 13, margin: "12px 0" }}>— ou —</div>
            <button className="btn secondary" style={{ width: "100%" }} onClick={loginBiometria} disabled={bioLoading}>
              {bioLoading ? "Aguardando biometria..." : "Entrar com biometria / PIN"}
            </button>
          </>
        )}
        <p style={{ fontSize: 13 }}>
          <Link to="/register">Criar nova conta</Link>
        </p>
      </div>
    </div>
  );
}
