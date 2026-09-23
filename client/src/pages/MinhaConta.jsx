import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import SenhaInput from "../components/SenhaInput";

export default function MinhaConta() {
  const { user, role, renomear } = useAuth();
  const [username, setUsername] = useState(user || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  async function salvarNome(e) {
    e.preventDefault();
    setError("");
    setAviso("");
    try {
      const d = await api("/api/account", { method: "PATCH", body: JSON.stringify({ username }) });
      renomear(d.username);
      setAviso("Nome de usuário atualizado.");
    } catch (err) { setError(err.message); }
  }

  async function salvarSenha(e) {
    e.preventDefault();
    setError("");
    setAviso("");
    try {
      await api("/api/account", { method: "PATCH", body: JSON.stringify({ currentPassword, newPassword }) });
      setCurrentPassword("");
      setNewPassword("");
      setAviso("Senha alterada com sucesso.");
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="container">
      <h1>Minha Conta</h1>
      {error && <div className="error">{error}</div>}
      {aviso && <div className="card" style={{ background: "#dcfce7" }}>{aviso}</div>}
      <div className="card">
        <p>Logado como <b>{user}</b> · Perfil: <b>{role === "admin" ? "Administrador" : "Usuário"}</b></p>
      </div>
      <div className="card">
        <h2>Alterar nome de usuário</h2>
        <form onSubmit={salvarNome}>
          <label>Novo nome</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          <button className="btn" type="submit">Salvar nome</button>
        </form>
      </div>
      <div className="card">
        <h2>Alterar senha</h2>
        <form onSubmit={salvarSenha}>
          <label>Senha atual</label>
          <SenhaInput value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          <label>Nova senha</label>
          <SenhaInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <button className="btn" type="submit">Salvar senha</button>
        </form>
      </div>
    </div>
  );
}
