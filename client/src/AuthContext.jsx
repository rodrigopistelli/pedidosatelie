import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => localStorage.getItem("username") || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    api("/api/me")
      .then((d) => setUser(d.user.username))
      .catch(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(username, password) {
    const d = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    localStorage.setItem("token", d.token);
    localStorage.setItem("username", d.username);
    setUser(d.username);
  }

  async function register(username, password) {
    const d = await api("/api/register", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    localStorage.setItem("token", d.token);
    localStorage.setItem("username", d.username);
    setUser(d.username);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setUser(null);
  }

  // Login sem senha (biometria/PIN do dispositivo já verificados no backend)
  function loginComToken(token, username) {
    localStorage.setItem("token", token);
    localStorage.setItem("username", username);
    setUser(username);
  }

  return (
    <AuthCtx.Provider value={{ user, login, register, logout, loading, loginComToken }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
