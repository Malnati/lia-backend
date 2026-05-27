import { assertPermission, extractBearerToken, hasPermission } from '../src/auth/auth-operations';
import type { AuthContext } from '../src/auth/auth.types';
import { HttpError } from '../src/http-error';

const context: AuthContext = {
  accessToken: 'token',
  authUserId: 'auth-user-1',
  appUserId: 'app-user-1',
  tenantId: 'tenant-1',
  role: 'clinic_admin',
  permissions: ['orders:read', 'users:read'],
  email: 'admin@example.com'
};

describe('Supabase auth contract', () => {
  it('extracts bearer tokens and rejects malformed authorization headers', () => {
    expect(extractBearerToken('Bearer access-token')).toBe('access-token');
    expect(extractBearerToken('bearer access-token')).toBe('access-token');
    expect(extractBearerToken('Basic abc')).toBeUndefined();
    expect(extractBearerToken(undefined)).toBeUndefined();
  });

  it('checks permissions from the resolved tenant-bound user context', () => {
    expect(hasPermission(context, 'users:read')).toBe(true);
    expect(hasPermission(context, 'users:write')).toBe(false);
  });

  it('raises 403 for authenticated users without the required permission', () => {
    expect(() => assertPermission(context, 'users:write')).toThrow(HttpError);
    expect(() => assertPermission(context, 'users:write')).toThrow('Missing permission users:write');
  });
});
