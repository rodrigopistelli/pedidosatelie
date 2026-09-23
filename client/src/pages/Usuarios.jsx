import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { api } from "../api";
import SenhaInput from "../components/SenhaInput";
import IconBtn from "../components/IconBtn";

const empty = { username: "", password: "", role: "user" };

export default function Usuarios() {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  async function carregar() {
    setLista(await api("/api/users"));
  }

  useEffect(() => { carregar().catch((e) => setError(e.message)); }, []);

  async function salvar(e) {
    e.preventDefault();
    setError("");
    setAviso("");
    try {
      const body = { username: form.username, role: form.role };
      if (!editId) body.password = form.password;
      else if (novaSenha) body.password = novaSenha;
      if (editId) await api(`/api/users/${editId}`, { method: "PUT", body: JSON.stringify(body) });
      else await api("/api/users", { method: "POST", body: JSON.stringify(body) });
      setForm(empty);
      setNovaSenha("");
      setEditId(null);
      setAviso("Usuário salvo.");
      carregar();
    } catch (err) { setError(err.message); }
  }

  function editar(u) {
    setEditId(u.id);
    setForm({ username: u.username, password: "", role: u.role });
    setNovaSenha("");
    setAviso("");
  }

  async function excluir(id) {
    if (!confirm("Excluir este usuário?")) return;
    try {
      await api(`/api/users/${id}`, { method: "DELETE" });
      carregar();
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="container">
      <h1>Usuários</h1>
      <p style={{ color: "#555", fontSize: 14 }}>Acesso restrito ao administrador. O perfil <b>admin</b> gerencia usuários; <b>user</b> opera o dia a dia.</p>
      {error && <div className="error">{error}</div>}
      {aviso && <div className="card" style={{ background: "#dcfce7" }}>{aviso}</div>}
      <div className="card">
        <h2>{editId ? "Editar usuário" : "Novo usuário"}</h2>
        <form onSubmit={salvar}>
          <div className="grid2">
            <div><label>Nome de usuário</label>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></div>
            <div><label>Perfil</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="user">Usuário</option>
                <option value="admin">Administrador</option>
              </select></div>
          </div>
          {!editId && (<><label>Senha</label>
            <SenhaInput value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></>)}
          {editId && (<><label>Redefinir senha (deixe em branco para manter)</label>
            <SenhaInput value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} required={false} /></>)}
          <div className="toolbar">
            <button className="btn" type="submit">{editId ? "Salvar" : "Criar usuário"}</button>
            {editId && <button type="button" className="btn secondary" onClick={() => { setEditId(null); setForm(empty); setNovaSenha(""); }}>Cancelar</button>}
          </div>
        </form>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>ID</th><th>Usuário</th><th>Perfil</th><th>Criado em</th><th>Ações</th></tr></thead>
          <tbody>
            {lista.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.username}</td>
                <td>{u.role === "admin" ? "Administrador" : "Usuário"}</td>
                <td>{u.created_at}</td>
                <td><div className="row-actions">
                  <IconBtn titulo="Editar usuário" variante="secundaria" onClick={() => editar(u)}><Pencil size={16} /></IconBtn>
                  <IconBtn titulo="Excluir usuário" variante="perigo" onClick={() => excluir(u.id)}><Trash2 size={16} /></IconBtn>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
