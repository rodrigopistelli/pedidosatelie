// Em dev (Vite proxy) fica vazio e usa caminho relativo.
// Em produção (Vercel), defina VITE_API_URL=https://sua-api.onrender.com (sem barra no final).
const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function getToken() {
  return localStorage.getItem("token");
}

export function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function api(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro na requisição");
  return data;
}

export function formatBRL(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
