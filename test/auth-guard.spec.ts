import { createApp } from '../src/index';

describe('Hono Supabase auth middleware contract', () => {
  it('returns 401 when bearer token is absent', async () => {
    const response = await createApp().request('/api/orders', undefined, {});
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: { code: 'unauthorized', message: 'Missing bearer token' } });
  });

  it('returns 400 when Supabase is not configured for authenticated routes', async () => {
    const response = await createApp().request('/api/orders', { headers: { authorization: 'Bearer token' } }, {});
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'bad_request',
        message: 'Supabase is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
      }
    });
  });
});
