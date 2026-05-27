import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
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

@Injectable()
export class AuthService {
  constructor(private readonly supabase: SupabaseService) {}

  async resolveContextFromToken(token: string): Promise<AuthContext> {
    const client = this.supabase.getClient();
    const { data: authData, error: authError } = await client.auth.getUser(token);
    const user = authData.user;

    if (authError || !user) {
      throw new UnauthorizedException('Invalid Supabase access token');
    }

    const { data: appUser, error: appUserError } = await client
      .from('app_users')
      .select('id, tenant_id, auth_user_id, email, role, is_active, access_profiles(permissions)')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle<AppUserRow>();

    if (appUserError) throw new UnauthorizedException(appUserError.message);
    if (!appUser) throw new ForbiddenException('Authenticated user has no active Lia profile');

    return {
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
