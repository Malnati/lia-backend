import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AuthService } from './auth/auth.service';
import { assertPermission, extractBearerToken } from './auth/auth-operations';
import type { AppPermission, AuthContext } from './auth/auth.types';
import { AccessProfilesService } from './admin/access-profiles.service';
import { UsersService } from './admin/users.service';
import { HttpError, badRequest, unauthorized } from './http-error';
import { checkpointKeys, maxAttachmentSizeBytes } from './orders/order-operations';
import { isOrderStatus } from './orders/order-status';
import { OrdersService, type UploadedWorkerFile } from './orders/orders.service';
import type { CreateOrderInput, UpdateCheckpointInput, UpdateOrderInput } from './orders/order.types';
import { SupabaseService, type WorkerEnv } from './supabase/supabase.service';

type AppBindings = { Bindings: WorkerEnv };

const app = new Hono<AppBindings>();

app.use(
  '*',
  cors({
    origin: (origin, c) => {
      if (!origin) return null;
      const allowed = getAllowedOrigins(c.env);
      return allowed.includes(origin) ? origin : null;
    },
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    credentials: true,
    maxAge: 86400
  })
);

app.onError((error, c) => {
  const known = error instanceof HttpError;
  const status = known ? error.status : 500;
  return c.json(
    {
      error: {
        code: known ? error.code : 'internal_error',
        message: known ? error.message : 'Internal server error'
      }
    },
    status as never
  );
});

app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Route not found' } }, 404));

app.get('/', (c) =>
  c.json({
    service: 'lia-api',
    runtime: 'cloudflare-workers',
    framework: 'hono',
    api: '/api',
    docs: 'https://github.com/Malnati/lia-backend'
  })
);

app.get('/api/health', (c) =>
  c.json({
    status: 'ok',
    service: 'lia-api',
    runtime: 'cloudflare-workers',
    framework: 'hono',
    timestamp: new Date().toISOString()
  })
);

app.get('/api/db/health', async (c) => c.json(await services(c.env).supabase.checkConnection()));

app.get('/api/orders', async (c) => {
  const { auth, orders } = await requireServices(c.env, c.req.header('authorization'), 'orders:read');
  return c.json(await orders.findAll(auth));
});

app.post('/api/orders', async (c) => {
  const { auth, orders } = await requireServices(c.env, c.req.header('authorization'), 'orders:write');
  const input = await readJson<CreateOrderInput>(c.req.raw);
  validateCreateOrder(input);
  return c.json(await orders.create(input, auth), 201);
});

app.patch('/api/orders/:id', async (c) => {
  const { auth, orders } = await requireServices(c.env, c.req.header('authorization'), 'orders:write');
  const input = await readJson<UpdateOrderInput>(c.req.raw);
  return c.json(await orders.update(c.req.param('id'), input, auth));
});

app.patch('/api/orders/:id/status', async (c) => {
  const { auth, orders } = await requireServices(c.env, c.req.header('authorization'), 'orders:write');
  const input = await readJson<{ status?: string }>(c.req.raw);
  if (!input.status || !isOrderStatus(input.status)) throw badRequest('Unsupported order status');
  return c.json(await orders.updateStatus(c.req.param('id'), input.status, auth));
});

app.patch('/api/orders/:id/checkpoints/:checkpointKey', async (c) => {
  const { auth, orders } = await requireServices(c.env, c.req.header('authorization'), 'checkpoints:write');
  const checkpointKey = c.req.param('checkpointKey');
  if (!checkpointKeys.includes(checkpointKey as never)) throw badRequest(`Unsupported checkpoint ${checkpointKey}`);
  const input = await readJson<UpdateCheckpointInput>(c.req.raw);
  return c.json(await orders.updateCheckpoint(c.req.param('id'), checkpointKey, input, auth));
});

app.post('/api/orders/:id/attachments', async (c) => {
  const { auth, orders } = await requireServices(c.env, c.req.header('authorization'), 'attachments:write');
  const form = await c.req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw badRequest('Attachment file is required');
  const contentType = file.type || 'application/octet-stream';
  const data = await file.arrayBuffer();
  const upload: UploadedWorkerFile = {
    filename: file.name || 'attachment',
    contentType,
    size: data.byteLength,
    data
  };
  if (upload.size > maxAttachmentSizeBytes) throw badRequest(`Attachment exceeds ${maxAttachmentSizeBytes} bytes`);
  const kind = form.get('kind');
  if (kind !== 'photo' && kind !== 'signature') throw badRequest('Attachment kind must be photo or signature');
  return c.json(
    await orders.uploadAttachment(
      c.req.param('id'),
      upload,
      {
        kind,
        clientAttachmentId: stringFormValue(form.get('clientAttachmentId')),
        capturedAt: stringFormValue(form.get('capturedAt'))
      },
      auth
    ),
    201
  );
});

app.get('/api/orders/:id/attachments', async (c) => {
  const { auth, orders } = await requireServices(c.env, c.req.header('authorization'), 'attachments:read');
  return c.json(await orders.listAttachments(c.req.param('id'), auth));
});

app.get('/api/orders/:id/attachments/:attachmentId/file', async (c) => {
  const { auth, orders } = await requireServices(c.env, c.req.header('authorization'), 'attachments:read');
  const file = await orders.openAttachmentFile(c.req.param('id'), c.req.param('attachmentId'), auth);
  return new Response(file.data, {
    headers: {
      'content-type': file.contentType,
      'content-disposition': `inline; filename="${file.filename.replace(/"/g, '')}"`
    }
  });
});

app.post('/api/orders/:id/payment-intents', async (c) => {
  const { auth, orders } = await requireServices(c.env, c.req.header('authorization'), 'payments:write');
  const input = await readJson<{ amount?: number; currency?: 'PYG' | 'USD' }>(c.req.raw);
  if (input.currency && input.currency !== 'PYG' && input.currency !== 'USD') throw badRequest('Unsupported payment currency');
  if (input.amount !== undefined && (typeof input.amount !== 'number' || input.amount < 0)) throw badRequest('Payment amount must be non-negative');
  return c.json(await orders.createPaymentIntent(c.req.param('id'), input, auth), 201);
});

app.get('/api/users', async (c) => {
  const { auth, users } = await requireServices(c.env, c.req.header('authorization'), 'users:read');
  return c.json(await users.findAll(auth));
});

app.post('/api/users', async (c) => {
  const { auth, users } = await requireServices(c.env, c.req.header('authorization'), 'users:write');
  const input = await readJson(c.req.raw);
  return c.json(await users.create(auth, input as never), 201);
});

app.patch('/api/users/:id', async (c) => {
  const { auth, users } = await requireServices(c.env, c.req.header('authorization'), 'users:write');
  const input = await readJson(c.req.raw);
  return c.json(await users.update(auth, c.req.param('id'), input as never));
});

app.get('/api/access-profiles', async (c) => {
  const { auth, accessProfiles } = await requireServices(c.env, c.req.header('authorization'), 'profiles:read');
  return c.json(await accessProfiles.findAll(auth));
});

app.post('/api/access-profiles', async (c) => {
  const { auth, accessProfiles } = await requireServices(c.env, c.req.header('authorization'), 'profiles:write');
  const input = await readJson(c.req.raw);
  return c.json(await accessProfiles.create(auth, input as never), 201);
});

app.patch('/api/access-profiles/:id', async (c) => {
  const { auth, accessProfiles } = await requireServices(c.env, c.req.header('authorization'), 'profiles:write');
  const input = await readJson(c.req.raw);
  return c.json(await accessProfiles.update(auth, c.req.param('id'), input as never));
});

export function createApp() {
  return app;
}

export default app;

function services(env: WorkerEnv) {
  const supabase = new SupabaseService(env);
  return {
    supabase,
    authService: new AuthService(supabase),
    orders: new OrdersService(supabase),
    users: new UsersService(supabase),
    accessProfiles: new AccessProfilesService(supabase)
  };
}

async function requireServices(env: WorkerEnv, authorization: string | undefined, permission: AppPermission) {
  const built = services(env);
  const auth = await requireAuth(built.authService, authorization);
  assertPermission(auth, permission);
  return { ...built, auth };
}

async function requireAuth(authService: AuthService, authorization: string | undefined): Promise<AuthContext> {
  const token = extractBearerToken(authorization);
  if (!token) throw unauthorized('Missing bearer token');
  return authService.resolveContextFromToken(token);
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw badRequest('Expected JSON request body');
  }
}

function validateCreateOrder(input: CreateOrderInput): void {
  const missing = ['customerName', 'customerPhone', 'deliveryAddress'].filter((field) => {
    const value = (input as Record<string, unknown>)[field];
    return typeof value !== 'string' || value.trim().length === 0;
  });
  if (missing.length > 0) throw badRequest(`Order payload missing required fields: ${missing.join(', ')}`);
}

function stringFormValue(value: FormDataEntryValue | null): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function getAllowedOrigins(env: WorkerEnv): string[] {
  return (env.CORS_ORIGINS || 'https://aneety.com,https://core.aneety.com,https://pwa.aneety.com,https://desktop.aneety.com,https://dashboard.aneety.com')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
