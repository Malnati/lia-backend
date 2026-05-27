import { createApp } from '../src/index';

describe('admin CRUD API contract from REQ.md', () => {
  it('exposes users and access profile endpoints through the Worker app', async () => {
    const app = createApp();
    const env = {};

    await expect(app.request('/api/users', undefined, env)).resolves.toMatchObject({ status: 401 });
    await expect(app.request('/api/access-profiles', undefined, env)).resolves.toMatchObject({ status: 401 });
    await expect(app.request('/api/users/user-1', { method: 'PATCH', body: '{}' }, env)).resolves.toMatchObject({ status: 401 });
    await expect(app.request('/api/access-profiles/profile-1', { method: 'PATCH', body: '{}' }, env)).resolves.toMatchObject({ status: 401 });
  });
});
