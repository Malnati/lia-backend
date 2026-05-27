import type { SupabaseService } from '../supabase/supabase.service';
import { forbidden, unauthorized } from '../http-error';
import type { AppPermission, AuthContext } from './auth.types';

type AccessProfileRelation = { permissions?: string[] | null } | Array<{ permissions?: string[] | null }> | null;

type AppUserRow = {
  id: string;
  tenant_id: string;
  auth_user_id: string;
  email?: string | null;
  role: string;
  is_active: boolean;
  access_profiles?: AccessProfileRelation;
};

export class AuthService {
  constructor(private readonly supabase: SupabaseService) {}

  async resolveContextFromToken(token: string): Promise<AuthContext> {
    const client = this.supabase.getServiceClient();
    const { data: authData, error: authError } = await client.auth.getUser(token);
    const user = authData.user;

    if (authError || !user) {
      throw unauthorized('Invalid Supabase access token');
    }

    const { data: appUser, error: appUserError } = await client
      .from('app_users')
      .select('id, tenant_id, auth_user_id, email, role, is_active, access_profiles(permissions)')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle<AppUserRow>();

    if (appUserError) throw unauthorized(appUserError.message);
    if (!appUser) throw forbidden('Authenticated user has no active Lia profile');

    return {
      accessToken: token,
      authUserId: user.id,
      appUserId: appUser.id,
      tenantId: appUser.tenant_id,
      role: appUser.role,
      permissions: extractProfilePermissions(appUser.access_profiles ?? null),
      email: user.email ?? appUser.email ?? undefined
    };
  }
}

function extractProfilePermissions(profile: AccessProfileRelation): AppPermission[] {
  const first = Array.isArray(profile) ? profile[0] : profile;
  return ((first?.permissions ?? []) as string[]).filter(Boolean) as AppPermission[];
}
