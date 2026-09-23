// Botão de ação por ícone com dica (title + aria-label).
// Uso em linhas de tabela: <IconBtn titulo="Editar" onClick={...} variante="secundaria"><Pencil size={16} /></IconBtn>
export default function IconBtn({ titulo, onClick, variante = "", children, type = "button", disabled = false }) {
  return (
    <button
      type={type}
      className={`icon-btn ${variante}`.trim()}
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
