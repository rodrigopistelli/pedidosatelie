import { useEffect, useState } from "react";
import { api, formatBRL } from "../api";

export default function Dashboard() {
  const [stats, setStats] = useState({ clientes: 0, cardapios: 0, pedidos: 0, faturamento: 0 });

  useEffect(() => {
    Promise.all([api("/api/clientes"), api("/api/cardapios"), api("/api/pedidos")])
      .then(([c, m, p]) => {
        setStats({
          clientes: c.length,
          cardapios: m.length,
          pedidos: p.length,
          faturamento: p.reduce((s, x) => s + Number(x.total || 0), 0)
        });
      })
      .catch(() => {});
  }, []);

  return (
    <div className="container">
      <h1>Dashboard</h1>
      <div className="kpis">
        <div className="card"><strong>{stats.clientes}</strong><span>Clientes</span></div>
        <div className="card"><strong>{stats.cardapios}</strong><span>Cardápios</span></div>
        <div className="card"><strong>{stats.pedidos}</strong><span>Pedidos</span></div>
      </div>
      <div className="card">
        <h2>Faturamento total</h2>
        <strong style={{ fontSize: 28 }}>{formatBRL(stats.faturamento)}</strong>
      </div>
    </div>
  );
}
