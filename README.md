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
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id`
- `GET /api/access-profiles`
- `POST /api/access-profiles`
- `PATCH /api/access-profiles/:id`

## Autenticação e autorização

- Todas as rotas operacionais de pedidos, anexos, pagamentos, usuários e perfis usam `Authorization: Bearer <supabase-access-token>`.
- A API valida o token com Supabase Auth (`auth.getUser(token)`) e resolve `tenant_id`, usuário interno, role e permissões em `app_users` + `access_profiles`.
- Token ausente/inválido retorna 401.
- Usuário autenticado sem permissão retorna 403.
- `SUPABASE_SERVICE_ROLE_KEY` é usada somente no backend para operações administrativas e nunca deve ir para frontend/Git.

## CRUD administrativo

Rotas implementadas para o dashboard/admin:

- `GET /api/users` — requer `users:read`.
- `POST /api/users` — requer `users:write`; pode criar usuário no Supabase Auth via service role quando `authUserId` não for informado.
- `PATCH /api/users/:id` — requer `users:write`.
- `GET /api/access-profiles` — requer `profiles:read`.
- `POST /api/access-profiles` — requer `profiles:write`.
- `PATCH /api/access-profiles/:id` — requer `profiles:write`.

## Fluxo de pedidos

Status alinhados ao `REQ.md`:

- `draft`
- `awaiting_payment`
- `paid`
- `pickup_scheduled`
- `picked_up`
- `in_model_production`
- `model_ready`
- `in_prosthesis_production`
- `prosthesis_ready`
- `ready_for_delivery`
- `delivery_scheduled`
- `delivered`
- `cancelled`

Checkpoints padrão:

- `pickup_checkin`
- `pickup_checkout`
- `model_production_start`
- `model_production_done`
- `prosthesis_production_start`
- `prosthesis_production_done`
- `delivery_checkin`
- `delivery_checkout`

## Status da migração

Feito:

- remoção da dependência Mongo/Mongoose;
- contrato Supabase/Postgres versionado em SQL;
- healthcheck de conexão Supabase;
- storage real de anexos via Supabase Storage;
- payment intents persistidos em Postgres como pendentes de gateway real;
- validação de JWT Supabase por request;
- resolução de tenant por usuário autenticado;
- CRUD usuários/perfis via API.

Pendente:

- secrets reais Supabase/VPS;
- gateway real de pagamento.

## Validação

```bash
pnpm lint
pnpm test
pnpm build
```
