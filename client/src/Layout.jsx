import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

const GRUPOS = [
  {
    titulo: "Início",
    itens: [{ to: "/", label: "Dashboard", end: true }]
  },
  {
    titulo: "Encomendas",
    itens: [
      { to: "/semanas", label: "Semanas" },
      { to: "/mensagens", label: "Mensagens" },
      { to: "/pedidos", label: "Pedidos" },
      { to: "/compras-semana", label: "Compras da Semana" }
    ]
  },
  {
    titulo: "Cozinha",
    itens: [
      { to: "/cardapios", label: "Pratos" },
      { to: "/ingredientes", label: "Ingredientes" }
    ]
  },
  {
    titulo: "Geral",
    itens: [
      { to: "/lista-corriqueira", label: "Lista Corriqueira" },
      { to: "/clientes", label: "Clientes" }
    ]
  }
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [aberto, setAberto] = useState(false);

  // Fecha o drawer ao navegar (mobile)
  useEffect(() => {
    setAberto(false);
  }, [loc.pathname]);

  function sair() {
    logout();
    nav("/login");
  }

  return (
    <div className="shell">
      <div className={`overlay${aberto ? " visivel" : ""}`} onClick={() => setAberto(false)} />
      <aside className={`sidebar${aberto ? " aberta" : ""}`}>
        <div className="brand">PedidosAtelie</div>
        <nav className="menu">
          {GRUPOS.map((g) => (
            <div key={g.titulo} className="grupo">
              <div className="grupo-titulo">{g.titulo}</div>
              {g.itens.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.end} className="menu-link">
                  {it.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-rodape">
          <span className="usuario">{user}</span>
          <button className="btn small secondary" onClick={sair}>Sair</button>
        </div>
      </aside>
      <div className="conteudo">
        <div className="topbar">
          <button className="hamburger" onClick={() => setAberto(true)} aria-label="Abrir menu">☰</button>
          <b>PedidosAtelie</b>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
