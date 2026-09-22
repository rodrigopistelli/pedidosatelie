import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

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

  return (
    <div className="login-wrap">
      <div className="card login-box">
        <h1>Entrar</h1>
        <p style={{ color: "#666", fontSize: 14 }}>Sistema de Clientes, Cardápios e Pedidos</p>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label>Usuário</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" required />
          <label>Senha</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" required />
          <button className="btn" style={{ width: "100%" }} type="submit">Login</button>
        </form>
        <p style={{ fontSize: 13 }}>
          Padrão inicial: <b>admin / admin123</b><br />
          <Link to="/register">Criar nova conta</Link>
        </p>
      </div>
    </div>
  );
}
