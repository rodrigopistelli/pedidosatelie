import { formatBRL } from "./api";

// Normaliza telefone para o padrão wa.me (DDI+DDD+número)
export function waPhone(tel) {
  let d = String(tel || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length <= 11) d = "55" + d;
  return d;
}

export function waLink(phone, text) {
  return `https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(text)}`;
}

export function copyText(t) {
  return navigator.clipboard.writeText(t);
}

function fmtData(d) {
  if (!d) return "";
  const [y, m, day] = String(d).slice(0, 10).split("-");
  return y ? `${day}/${m}/${y}` : d;
}

// Mensagem de divulgação da semana (para lista de transmissão/grupos)
export function msgSemana(semana, itens) {
  const periodo =
    semana.data_inicio || semana.data_fim
      ? ` (${fmtData(semana.data_inicio)} a ${fmtData(semana.data_fim)})`
      : "";
  const linhas = itens.map((m) => `▪️ ${m.nome} — ${formatBRL(m.preco)}`).join("\n");
  return (
    `🍱 *${semana.titulo}*${periodo}\n` +
    `Opções desta semana:\n\n${linhas}\n\n` +
    `Responda com seu pedido e a data de entrega. Obrigado!`
  );
}

// Mensagem de confirmação/resumo do pedido para o cliente
export function msgPedido(p) {
  const itens = (p.itens || [])
    .map((it) => `▪️ ${it.quantidade}x ${it.cardapio_nome}`)
    .join("\n");
  const entrega = p.data_entrega ? `\n🚚 Entrega: ${fmtData(p.data_entrega)}` : "";
  return (
    `Olá ${p.cliente_nome}! Seu pedido *#${p.id}*:\n\n${itens}\n\n` +
    `*Total: ${formatBRL(p.total)}*${entrega}\nObrigado pela preferência!`
  );
}
