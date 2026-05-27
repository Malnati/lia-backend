import { UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthGuard } from '../src/auth/supabase-auth.guard';
import type { AuthContext } from '../src/auth/auth.types';

function contextWithAuthHeader(authorization?: string) {
  const request: { headers: { authorization?: string }; liaAuth?: AuthContext } = { headers: { authorization } };
  return {
    request,
    executionContext: {
      switchToHttp: () => ({ getRequest: () => request })
    } as never
  };
}

describe('SupabaseAuthGuard', () => {
  it('returns 401 when bearer token is absent', async () => {
    const guard = new SupabaseAuthGuard({ resolveContextFromToken: async () => ({}) as AuthContext } as never);
    const { executionContext } = contextWithAuthHeader(undefined);

    await expect(guard.canActivate(executionContext)).rejects.toThrow(UnauthorizedException);
  });

  it('attaches resolved tenant auth context when token is valid', async () => {
    const auth: AuthContext = {
      authUserId: 'auth-1',
      appUserId: 'app-1',
      tenantId: 'tenant-1',
      role: 'clinic_admin',
      permissions: ['orders:read']
    };
    const guard = new SupabaseAuthGuard({ resolveContextFromToken: async () => auth } as never);
    const { request, executionContext } = contextWithAuthHeader('Bearer valid-token');

    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
    expect(request.liaAuth).toEqual(auth);
  });
});
