# lia-backend

API NestJS real da plataforma Lia.

Este repositório é o backend real: NestJS em VPS HTTPS, Supabase/Postgres como banco, Supabase Auth/JWT e RLS como isolamento de tenant.

## Stack

- NestJS + TypeScript
- Supabase/Postgres
- Supabase Auth + RLS
- Supabase Storage para anexos (`order-attachments`)
- pnpm

## Setup local

```bash
pnpm install
cp .env.example .env
```

Configurar no `.env`:

| Variável | Uso | Segurança |
| --- | --- | --- |
| `PORT` | Porta da API NestJS | público |
| `CORS_ORIGIN` | Origem permitida | público |
| `SUPABASE_URL` | URL do projeto Supabase | público |
| `SUPABASE_ANON_KEY` | chave pública para referência/frontends | pode ir para frontend |
| `SUPABASE_SERVICE_ROLE_KEY` | chave privilegiada usada pela API | backend/secrets apenas; nunca Git/frontend |
| `LIA_DEFAULT_TENANT_ID` | tenant inicial até ativar resolução por JWT | backend |
| `PAYMENT_GATEWAY_PROVIDER` | provider real/futuro de pagamento | backend |

## Supabase/Postgres

Migração inicial versionada:

```bash
supabase db push
```

Arquivo principal:

- `supabase/migrations/0001_initial_schema.sql`

Inclui tabelas mínimas de `REQ.md`: `tenants`, `access_profiles`, `app_users`, `orders`, `order_checkpoints`, `attachments`, `payment_intents`, `sync_events`.

## Rodar API

```bash
pnpm dev
```

URLs padrão:

- API: <http://localhost:3000/api>
- Healthcheck: <http://localhost:3000/api/health>
- DB healthcheck: <http://localhost:3000/api/db/health>

## Endpoints

Prefixo global: `/api`.

- `GET /api/health`
- `GET /api/db/health`
- `GET /api/orders`
- `POST /api/orders`
- `PATCH /api/orders/:id`
- `PATCH /api/orders/:id/status`
- `PATCH /api/orders/:id/checkpoints/:checkpointKey`
- `POST /api/orders/:id/attachments`
- `GET /api/orders/:id/attachments`
- `GET /api/orders/:id/attachments/:attachmentId/file`
- `POST /api/orders/:id/payment-intents`

## Status da migração

Feito:

- remoção da dependência Mongo/Mongoose;
- contrato Supabase/Postgres versionado em SQL;
- healthcheck de conexão Supabase;
- storage real de anexos via Supabase Storage;
- payment intents persistidos em Postgres como pendentes de gateway real.

Pendente:

- secrets reais Supabase/VPS;
- validação JWT Supabase por request;
- resolução multi-tenant por usuário autenticado;
- CRUD usuários/perfis via API;
- gateway real de pagamento.

## Validação

```bash
pnpm lint
pnpm test
pnpm build
```
