# Deploy gratuito — Vercel (frontend) + Render (backend) + Neon (Postgres)

Arquitetura: o frontend estático vai para a Vercel, a API Node para o Render
(plano free) e os dados para o Neon (Postgres serverless, plano free).
O SQLite continua valendo para rodar local sem configurar nada.

## 1. Banco — Neon (5 min)

1. Crie conta em https://neon.tech (login com GitHub).
2. New Project → nome `pedidosatelie`, região próxima (ex: US East).
3. Copie a **connection string** (vem com `?sslmode=require`).
4. Guarde — será a `DATABASE_URL`. As tabelas são criadas sozinhas no boot da API.

## 2. Backend — Render (10 min)

1. Conta em https://render.com (login com GitHub).
2. New → **Blueprint** → selecione o repo `pedidosatelie` (usa o `render.yaml` da raiz).
   - Ou manual: New → Web Service → repo → Root Directory `server`,
     Build `npm ci`, Start `npm start`, Health Check `/api/health`.
3. Em Environment, preencha:
   - `DATABASE_URL` = connection string do Neon
   - `JWT_SECRET` = gerado automaticamente (Blueprint) ou defina um segredo longo
   - `FRONTEND_URL` = deixe em branco por enquanto
4. Deploy. Anote a URL, ex: `https://pedidosatelie-api.onrender.com`.
   Teste: `https://pedidosatelie-api.onrender.com/api/health` → `{"ok":true}`.

## 3. Frontend — Vercel (5 min)

1. Conta em https://vercel.com (login com GitHub).
2. Add New → Project → importe `pedidosatelie`.
3. Em **Root Directory** selecione `client`. O resto é automático
   (Framework: Vite, Build: `npm run build`, Output: `dist`).
4. Em Environment Variables adicione:
   - `VITE_API_URL` = URL da API no Render, **sem barra no final**
5. Deploy. Anote a URL, ex: `https://pedidosatelie.vercel.app`.

## 4. Amarrar CORS (2 min)

1. No Render → serviço da API → Environment → `FRONTEND_URL` =
   `https://pedidosatelie.vercel.app` → Save (faz redeploy sozinho).
2. Acesse o frontend, logue com `admin / admin123` e cadastre um cliente
   de teste. Recarregue — os dados devem persistir (prova de que o Neon funciona).

## Limitações do plano free (aceitáveis p/ estudo)

- **Render free "dorme"** após ~15 min sem uso: a primeira requisição demora
  ~50s (cold start). Depois volta ao normal.
- **Neon free**: 3 GB + pausa automática quando ocioso (acorda sozinho).
- **Vercel free**: 100 GB de banda/mês — folga para este app.

## Voltar ao SQLite local

Basta rodar sem `DATABASE_URL` definida — o servidor usa `database.db`
automaticamente e loga `Banco: SQLite local`.
