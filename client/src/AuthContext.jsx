import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => localStorage.getItem("username") || null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  async function carregarPerfil() {
    try {
      const d = await api("/api/me");
      setUser(d.user.username);
      setRole(d.user.role);
      localStorage.setItem("username", d.user.username);
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("username");
      setUser(null);
      setRole(null);
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    carregarPerfil().finally(() => setLoading(false));
  }, []);

  async function login(username, password) {
    const d = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    localStorage.setItem("token", d.token);
    localStorage.setItem("username", d.username);
    setUser(d.username);
    await carregarPerfil();
  }

  async function register(username, password) {
    const d = await api("/api/register", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    localStorage.setItem("token", d.token);
    localStorage.setItem("username", d.username);
    setUser(d.username);
    await carregarPerfil();
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setUser(null);
    setRole(null);
  }

  // Login sem senha (biometria/PIN do dispositivo já verificados no backend)
  function loginComToken(token, username) {
    localStorage.setItem("token", token);
    localStorage.setItem("username", username);
    setUser(username);
    carregarPerfil();
  }

  // Após trocar o próprio nome em Minha Conta
  function renomear(novoNome) {
    localStorage.setItem("username", novoNome);
    setUser(novoNome);
  }

  return (
    <AuthCtx.Provider value={{ user, role, login, register, logout, loading, loginComToken, renomear }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
