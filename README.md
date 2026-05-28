# lia-backend

API real da plataforma Lia em **Cloudflare Workers Free + Hono**, conectada ao Supabase/Postgres real.

- URL alvo: <https://api.aneety.com/>
- Runtime: Cloudflare Workers Free
- Framework HTTP: Hono
- Banco/Auth/Storage: Supabase/Postgres Free, Supabase Auth e Supabase Storage
- Custo: zero; não usar Containers, Workers Paid, Logpush, Vectorize ou add-ons pagos.

## Setup local

```bash
pnpm install
cp .dev.vars.example .dev.vars
```

A fonte local temporária de credenciais é `/Users/mal/GitHub/malnati/lia/.env`. Nunca commite `.env`, `.dev.vars` ou secrets reais.

Variáveis do Worker:

| Variável | Uso | Segurança |
| --- | --- | --- |
| `CORS_ORIGINS` | Origens `aneety.com` autorizadas | público |
| `SUPABASE_URL` | URL do projeto Supabase | público, mas não precisa ir ao Git |
| `SUPABASE_ANON_KEY` | chave pública para clients com RLS | pode ir para frontend |
| `SUPABASE_SERVICE_ROLE_KEY` | chave privilegiada para API/admin | secret backend only |
| `LIA_DEFAULT_TENANT_ID` | tenant inicial | backend |
| `PAYMENT_GATEWAY_PROVIDER` | provider real/futuro de pagamento | backend |

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

- Rotas operacionais exigem `Authorization: Bearer <supabase-access-token>`.
- Token ausente/inválido retorna 401.
- Usuário sem permissão retorna 403.
- O Worker resolve `tenant_id`, usuário interno, role e permissões em `app_users` + `access_profiles`.
- `SUPABASE_SERVICE_ROLE_KEY` fica somente em Cloudflare secrets/runtime e nunca vai para frontend/Git.
- Funções auxiliares de RLS ficam no schema `private`, fora dos schemas expostos pela Data API.

## Supabase/Postgres

Migração inicial versionada:

```bash
supabase db push
```

Arquivo principal:

- `supabase/migrations/0001_initial_schema.sql`

Inclui tabelas mínimas de `REQ.md`: `tenants`, `access_profiles`, `app_users`, `orders`, `order_checkpoints`, `attachments`, `payment_intents`, `sync_events`.

## Deploy Cloudflare Free

`wrangler.jsonc` define o custom domain `api.aneety.com`.

```bash
CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... pnpm wrangler deploy --dry-run
CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... pnpm wrangler deploy
```

Secrets reais devem ser cadastrados com `wrangler secret put` ou via dashboard/API Cloudflare:

```bash
printf '%s' "$SUPABASE_URL" | pnpm wrangler secret put SUPABASE_URL
printf '%s' "$SUPABASE_ANON_KEY" | pnpm wrangler secret put SUPABASE_ANON_KEY
printf '%s' "$SUPABASE_SERVICE_ROLE_KEY" | pnpm wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Se `GET https://api.aneety.com/api/db/health` retornar `not_configured`, o Worker ainda não tem todos os secrets necessários. O PAT local `SUPABASE_KEY` usado pelo MCP não substitui `SUPABASE_SERVICE_ROLE_KEY`; use uma chave Supabase `sb_secret_...`/`service_role` criada no Dashboard em **Settings → API Keys** ou via Management API com permissão `api_gateway_keys_write`, e grave-a apenas como Cloudflare secret.

No Wrangler 4.x, `wrangler check` é um grupo de subcomandos e não valida deploy por si só; use `pnpm wrangler deploy --dry-run` como validação de configuração/bundle.

## Validação

```bash
pnpm lint
pnpm test
pnpm build
pnpm wrangler deploy --dry-run
```

### E2E publicado em `aneety.com`

O E2E publicado da API roda contra `https://api.aneety.com` e Supabase Auth real. Ele cobre:

- 401 para token ausente em `GET /api/orders`;
- 403 para usuário autenticado sem `orders:read`;
- criação/upsert de pedido real via `POST /api/orders`;
- atualização de checkpoint via `PATCH /api/orders/:id/checkpoints/:checkpointKey`;
- criação de intenção de pagamento via `POST /api/orders/:id/payment-intents`;
- upload, listagem e download de anexo real no Supabase Storage.

Comando:

```bash
LIA_E2E_ENABLED=1 \
LIA_E2E_API_URL=https://api.aneety.com \
VITE_SUPABASE_URL=... \
VITE_SUPABASE_PUBLISHABLE_KEY=... \
LIA_E2E_ADMIN_EMAIL=... \
LIA_E2E_ADMIN_PASSWORD=... \
LIA_E2E_LIMITED_EMAIL=... \
LIA_E2E_LIMITED_PASSWORD=... \
pnpm test:e2e
```

No GitHub Actions `Deploy API to Cloudflare Workers`, o teste roda após o deploy quando os secrets equivalentes existem. O usuário E2E Admin precisa das permissões `orders:*`, `checkpoints:write`, `attachments:*` e `payments:*`.
