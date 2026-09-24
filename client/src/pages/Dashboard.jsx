import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatBRL } from "../api";

const STATUS = {
  pendente: "Pendentes", confirmado: "Confirmados", em_producao: "Em produção",
  pronto: "Prontos", entregue: "Entregues", cancelado: "Cancelados"
};

export default function Dashboard() {
  const [stats, setStats] = useState({ clientes: 0, pratos: 0, pedidos: 0, faturamento: 0, porStatus: {}, proximas: [] });

  useEffect(() => {
    Promise.all([api("/api/clientes"), api("/api/cardapios"), api("/api/pedidos")])
      .then(([c, m, p]) => {
        const validos = p.filter((x) => x.status !== "cancelado");
        const porStatus = {};
        for (const x of p) porStatus[x.status] = (porStatus[x.status] || 0) + 1;
        const proximas = p
          .filter((x) => x.data_entrega && !["entregue", "cancelado"].includes(x.status))
          .sort((a, b) => String(a.data_entrega).localeCompare(String(b.data_entrega)))
          .slice(0, 8);
        setStats({
          clientes: c.length,
          pratos: m.length,
          pedidos: p.length,
          faturamento: validos.reduce((s, x) => s + Number(x.total || 0), 0),
          porStatus,
          proximas
        });
      })
      .catch(() => {});
  }, []);

  return (
    <div className="container">
      <h1>Dashboard</h1>
      <div className="kpis">
        <div className="card"><strong>{stats.clientes}</strong><Link to="/clientes">Clientes</Link></div>
        <div className="card"><strong>{stats.pratos}</strong><Link to="/cardapios">Pratos</Link></div>
        <div className="card"><strong>{stats.pedidos}</strong><Link to="/pedidos">Pedidos</Link></div>
      </div>
      <div className="card">
        <h2>Faturamento (não cancelados)</h2>
        <strong style={{ fontSize: 28 }}>{formatBRL(stats.faturamento)}</strong>
      </div>
      <div className="grid2">
        <div className="card">
          <h2>Pedidos por status</h2>
          <table>
            <tbody>
              {Object.entries(STATUS).map(([k, v]) => (
                <tr key={k}><td>{v}</td><td><b>{stats.porStatus[k] || 0}</b></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Próximas entregas</h2>
          {stats.proximas.length === 0 && <p>Nenhuma entrega pendente.</p>}
          <table>
            <tbody>
              {stats.proximas.map((p) => (
                <tr key={p.id}>
                  <td>{p.data_entrega}</td>
                  <td><Link to={`/pedidos#pedido-${p.id}`}>{p.cliente_nome}</Link></td>
                  <td>{formatBRL(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
