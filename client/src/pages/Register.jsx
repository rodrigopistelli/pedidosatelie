import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await register(username, password);
      nav("/");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="login-wrap">
      <div className="card login-box">
        <h1>Criar conta</h1>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label>Usuário</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          <label>Senha</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button className="btn" style={{ width: "100%" }} type="submit">Cadastrar</button>
        </form>
        <p style={{ fontSize: 13 }}><Link to="/login">Voltar ao login</Link></p>
      </div>
    </div>
  );
}
