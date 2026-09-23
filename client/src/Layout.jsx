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
        <b>PedidosAtelie</b>
        <NavLink to="/">Dashboard</NavLink>
        <NavLink to="/semanas">Semanas</NavLink>
        <NavLink to="/pedidos">Pedidos</NavLink>
        <NavLink to="/compras-semana">Compras da Semana</NavLink>
        <NavLink to="/lista-corriqueira">Lista Corriqueira</NavLink>
        <NavLink to="/cardapios">Pratos</NavLink>
        <NavLink to="/ingredientes">Ingredientes</NavLink>
        <NavLink to="/clientes">Clientes</NavLink>
        <span className="spacer" />
        <span style={{ fontSize: 13 }}>{user}</span>
        <button className="btn small secondary" onClick={sair}>Sair</button>
      </div>
      <Outlet />
    </>
  );
}
