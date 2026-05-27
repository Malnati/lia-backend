# lia-backend

Backend NestJS da Lia.

Este repositório contém apenas a API real para desenvolvimento local/VPS. O frontend público em GitHub Pages usa mock browser-side até segunda ordem.

## Stack

- NestJS + TypeScript
- MongoDB + Mongoose
- GridFS para anexos de pedidos
- Payment provider mock/abstração inicial
- Podman Compose para Mongo local
- pnpm

## Setup

```bash
pnpm install
cp .env.example .env
```

Antes de subir containers:

```bash
podman info
podman compose up -d mongo
```

Rodar API:

```bash
pnpm dev
```

URLs padrão:

- API: <http://localhost:3000/api>
- Healthcheck: <http://localhost:3000/api/health>

## Variáveis

| Variável | Uso | Exemplo |
| --- | --- | --- |
| `PORT` | Porta da API NestJS | `3000` |
| `MONGODB_URI` | Conexão MongoDB | `mongodb://localhost:27017/lia` |
| `CORS_ORIGIN` | Origem permitida para frontend local | `http://localhost:5173` |
| `PAYMENT_GATEWAY_PROVIDER` | Provider atual de pagamento | `mock` |

## Endpoints

Prefixo global: `/api`.

- `GET /api/health`
- `GET /api/orders`
- `POST /api/orders`
- `PATCH /api/orders/:id`
- `PATCH /api/orders/:id/status`
- `PATCH /api/orders/:id/checkpoints/:checkpointKey`
- `POST /api/orders/:id/attachments`
- `GET /api/orders/:id/attachments`
- `GET /api/orders/:id/attachments/:attachmentId/file`
- `POST /api/orders/:id/payment-intents`

Anexos aceitos: `image/webp`, `image/jpeg`, `image/png`, até 5MB. Arquivos ficam no Mongo GridFS (`orderAttachments`).

## Validação

```bash
pnpm lint
pnpm test
pnpm build
```
