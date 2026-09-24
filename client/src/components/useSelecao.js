import { useState } from "react";
import { api } from "../api";

// Seleção de linhas para exclusão em massa.
// Uso: const sel = useSelecao();
// Cabeçalho: <input type="checkbox" checked={sel.todosMarcados(lista)} onChange={() => sel.alternarTodos(lista)} />
// Linha: <input type="checkbox" checked={sel.marcado(x.id)} onChange={() => sel.alternar(x.id)} />
// Botão: {sel.ids.length > 0 && <button ...>Excluir ({sel.ids.length})</button>}
export function useSelecao() {
  const [ids, setIds] = useState([]);

  const marcado = (id) => ids.includes(id);

  function alternar(id) {
    setIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function todosMarcados(lista) {
    return lista.length > 0 && lista.every((x) => ids.includes(x.id));
  }

  function alternarTodos(lista) {
    setIds((s) => (lista.length > 0 && lista.every((x) => s.includes(x.id)) ? [] : lista.map((x) => x.id)));
  }

  function limpar() {
    setIds([]);
  }

  // Exclui os ids selecionados um a um (reaproveita o DELETE individual,
  // mantendo as validações do backend). Retorna a lista de falhas.
  async function excluirEmMassa({ lista, rota, rotulo }) {
    const alvos = lista.filter((x) => ids.includes(x.id));
    const falhas = [];
    for (const a of alvos) {
      try {
        await api(`${rota}/${a.id}`, { method: "DELETE" });
      } catch (err) {
        falhas.push(`${rotulo(a)}: ${err.message}`);
      }
    }
    limpar();
    return falhas;
  }

  return { ids, marcado, alternar, todosMarcados, alternarTodos, limpar, excluirEmMassa };
}
