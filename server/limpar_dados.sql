-- Limpeza dos dados de teste/cadastro (vale para SQLite e Postgres).
-- NÃO zera as sequências de IDs: próximos inserts continuam de onde pararam.
-- Ordem: filhos antes dos pais (chaves estrangeiras).
-- O usuário `admin` é recriado sozinho no próximo boot da API (admin / admin123).

DELETE FROM pedido_itens;
DELETE FROM pedidos;
DELETE FROM clientes;
DELETE FROM semana_itens;
DELETE FROM semanas;
DELETE FROM prato_ingredientes;
DELETE FROM cardapios;
DELETE FROM ingredientes;
DELETE FROM lista_corriqueira;
DELETE FROM webauthn_credentials;
DELETE FROM users;
