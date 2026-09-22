import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import Layout from "./Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Clientes from "./pages/Clientes";
import Cardapios from "./pages/Cardapios";
import Pedidos from "./pages/Pedidos";

function Private({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p style={{ padding: 24 }}>Carregando...</p>;
  if (!user) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<Private><Layout /></Private>}>
            <Route index element={<Dashboard />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="cardapios" element={<Cardapios />} />
            <Route path="pedidos" element={<Pedidos />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
