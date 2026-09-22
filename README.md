# Sistema de Pedidos — React + SQLite

App com tela de login, cadastro de clientes (nome, telefone, endereço),
cadastro de cardápios e tela de pedidos (cliente + cardápio + quantidade).

## Stack
- Frontend: React 18 + Vite + React Router (`client/`)
- Backend: Node + Express + SQLite nativo (`node:sqlite`, sem compilação) (`server/`)
- Auth: JWT + bcryptjs

## Rodar

1. Backend:
```powershell
cd server
npm.cmd install
npm.cmd start
# API em http://localhost:3001
# Login padrão: admin / admin123
```

2. Frontend (outro terminal):
```powershell
cd client
npm.cmd install
npm.cmd run dev
# App em http://localhost:5173
```

## API
- `POST /api/login` e `POST /api/register` → `{ token, username }`
- `GET /api/clientes` / `POST` / `PUT /:id` / `DELETE /:id`
- `GET /api/cardapios` / `POST` / `PUT /:id` / `DELETE /:id`
- `GET /api/pedidos` / `POST` / `PUT /:id` / `DELETE /:id`
  - POST body: `{ cliente_id, cardapio_id, quantidade, data, observacao }`
  - Total calculado no backend a partir do preço do cardápio.

Banco SQLite em `server/database.db` (criado automaticamente).
