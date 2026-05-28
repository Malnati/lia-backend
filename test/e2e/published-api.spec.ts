import { createClient } from '@supabase/supabase-js';
import { describe, expect, test } from 'vitest';

const requiredEnv = [
  'LIA_E2E_ADMIN_EMAIL',
  'LIA_E2E_ADMIN_PASSWORD',
  'LIA_E2E_LIMITED_EMAIL',
  'LIA_E2E_LIMITED_PASSWORD'
] as const;

const supabaseUrl = normalizeUrl(
  process.env.LIA_E2E_SUPABASE_URL ?? process.env.SUPABASE_PROJECT_URL ?? process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
);
const supabasePublishableKey = process.env.LIA_E2E_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_PUBLIC_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  '';
const apiUrl = normalizeUrl(process.env.LIA_E2E_API_URL ?? 'https://api.aneety.com');
const e2eEnabled = process.env.LIA_E2E_ENABLED === '1';

const runPublishedApiE2E = e2eEnabled ? describe : describe.skip;

runPublishedApiE2E('published Lia API E2E', () => {
  test('covers auth errors, order, checkpoint, attachment and payment intent on aneety.com', async () => {
    assertE2EConfig();

    const adminToken = await signIn(process.env.LIA_E2E_ADMIN_EMAIL!, process.env.LIA_E2E_ADMIN_PASSWORD!);
    const limitedToken = await signIn(process.env.LIA_E2E_LIMITED_EMAIL!, process.env.LIA_E2E_LIMITED_PASSWORD!);

    const missingToken = await fetch(`${apiUrl}/api/orders`);
    expect(missingToken.status).toBe(401);

    const limitedRead = await apiFetch('/api/orders', { token: limitedToken, expectedStatus: 403 });
    const limitedBody = await limitedRead.json() as { error?: { code?: string } };
    expect(limitedBody.error?.code).toBe('forbidden');

    const runId = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const clientId = 'lia-e2e-published-api';
    const clientAttachmentId = `lia-e2e-attachment-${runId}`;

    const created = await jsonApiFetch<OrderResponse>('/api/orders', {
      method: 'POST',
      token: adminToken,
      expectedStatus: 201,
      body: {
        clientId,
        customerName: 'Cliente E2E API publicada',
        customerPhone: '+595 21 000 000',
        deliveryAddress: 'Aneety E2E, Asunción',
        product: 'Molde prótese E2E',
        notes: `Criado pelo E2E publicado ${runId}`
      }
    });

    expect(created.id).toMatch(uuidPattern);
    expect(created.clientId).toBe(clientId);
    expect(created.status).toBe('draft');
    expect(created.checkpoints.map((checkpoint) => checkpoint.key)).toContain('pickup_checkin');

    const checkpointAt = new Date().toISOString();
    const checkpointed = await jsonApiFetch<OrderResponse>(`/api/orders/${created.id}/checkpoints/pickup_checkin`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        completed: true,
        actor: 'Codex E2E',
        timestamp: checkpointAt,
        notes: 'Checkpoint validado contra Worker publicado'
      }
    });
    const pickupCheckin = checkpointed.checkpoints.find((checkpoint) => checkpoint.key === 'pickup_checkin');
    expect(pickupCheckin?.completed).toBe(true);
    expect(pickupCheckin?.actor).toBe('Codex E2E');

    const paymentIntent = await jsonApiFetch<PaymentIntentResponse>(`/api/orders/${created.id}/payment-intents`, {
      method: 'POST',
      token: adminToken,
      expectedStatus: 201,
      body: {
        amount: 125000,
        currency: 'PYG'
      }
    });
    expect(paymentIntent.orderId).toBe(created.id);
    expect(paymentIntent.status).toBe('pending');
    expect(paymentIntent.amount).toBe(125000);
    expect(paymentIntent.currency).toBe('PYG');

    const attachment = await uploadAttachment(created.id, adminToken, clientAttachmentId, runId);
    expect(attachment.orderId).toBe(created.id);
    expect(attachment.kind).toBe('photo');
    expect(attachment.contentType).toBe('image/png');
    expect(attachment.clientAttachmentId).toBe(clientAttachmentId);

    const attachments = await jsonApiFetch<AttachmentResponse[]>(`/api/orders/${created.id}/attachments`, { token: adminToken });
    expect(attachments.some((item) => item.id === attachment.id && item.clientAttachmentId === clientAttachmentId)).toBe(true);

    const file = await apiFetch(`/api/orders/${created.id}/attachments/${attachment.id}/file`, { token: adminToken });
    expect(file.headers.get('content-type')).toContain('image/png');
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    expect(fileBytes.length).toBeGreaterThan(0);

    const orders = await jsonApiFetch<OrderResponse[]>('/api/orders', { token: adminToken });
    expect(orders.some((order) => order.id === created.id && order.clientId === clientId)).toBe(true);
  }, 60_000);
});

type ApiFetchOptions = {
  method?: string;
  token?: string;
  expectedStatus?: number;
  body?: unknown;
};

type OrderResponse = {
  id: string;
  clientId?: string;
  status: string;
  checkpoints: Array<{ key: string; completed: boolean; actor?: string }>;
};

type PaymentIntentResponse = {
  orderId: string;
  status: string;
  amount: number;
  currency: string;
};

type AttachmentResponse = {
  id: string;
  orderId: string;
  kind: string;
  contentType: string;
  clientAttachmentId?: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertE2EConfig(): void {
  const missing = [
    ...requiredEnv.filter((name) => !process.env[name]?.trim()),
    !supabaseUrl ? 'SUPABASE_PROJECT_URL' : '',
    !supabasePublishableKey ? 'SUPABASE_PUBLISHABLE_KEY' : ''
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`Missing E2E env vars: ${missing.join(', ')}`);
  }
}

async function signIn(email: string, password: string): Promise<string> {
  const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session?.access_token) {
    throw new Error(`Supabase Auth E2E sign-in failed: ${error?.message ?? 'missing access token'}`);
  }
  return data.session.access_token;
}

async function jsonApiFetch<T>(path: string, options: ApiFetchOptions): Promise<T> {
  const response = await apiFetch(path, options);
  return await response.json() as T;
}

async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const headers = new Headers();
  if (options.token) headers.set('authorization', `Bearer ${options.token}`);
  let body: BodyInit | undefined;

  if (options.body !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${apiUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body
  });

  expectApiStatus(response, options.expectedStatus ?? 200, path);
  return response;
}

async function uploadAttachment(orderId: string, token: string, clientAttachmentId: string, runId: string): Promise<AttachmentResponse> {
  const form = new FormData();
  form.set('kind', 'photo');
  form.set('clientAttachmentId', clientAttachmentId);
  form.set('capturedAt', new Date().toISOString());
  form.set('file', new File([onePixelPngArrayBuffer()], `lia-e2e-${runId}.png`, { type: 'image/png' }));

  const response = await fetch(`${apiUrl}/api/orders/${orderId}/attachments`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`
    },
    body: form
  });

  expectApiStatus(response, 201, `/api/orders/${orderId}/attachments`);
  return await response.json() as AttachmentResponse;
}

function expectApiStatus(response: Response, expectedStatus: number, path: string): void {
  if (response.status !== expectedStatus) {
    throw new Error(`${path} returned ${response.status}; expected ${expectedStatus}`);
  }
}

function onePixelPng(): Uint8Array {
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a,
    0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05,
    0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
    0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
  ]);
}

function onePixelPngArrayBuffer(): ArrayBuffer {
  const bytes = onePixelPng();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}
