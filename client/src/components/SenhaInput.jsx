import { useState } from "react";

// Campo de senha com botão Mostrar/Ocultar
export default function SenhaInput({ value, onChange, placeholder = "••••••", required = true }) {
  const [visivel, setVisivel] = useState(false);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        type={visivel ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        style={{ marginBottom: 12 }}
      />
      <button
        type="button"
        className="btn small secondary"
        style={{ marginBottom: 12, whiteSpace: "nowrap" }}
        onClick={() => setVisivel((v) => !v)}
      >
        {visivel ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
}
