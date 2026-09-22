import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  function sair() {
    logout();
    nav("/login");
  }

  return (
    <>
      <div className="nav">
        <b>Sistema de Pedidos</b>
        <NavLink to="/">Dashboard</NavLink>
        <NavLink to="/clientes">Clientes</NavLink>
        <NavLink to="/cardapios">Cardápios</NavLink>
        <NavLink to="/pedidos">Pedidos</NavLink>
        <span className="spacer" />
        <span style={{ fontSize: 13 }}>{user}</span>
        <button className="btn small secondary" onClick={sair}>Sair</button>
      </div>
      <Outlet />
    </>
  );
}
