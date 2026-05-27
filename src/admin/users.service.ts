import type { AuthContext } from '../auth/auth.types';
import { badRequest } from '../http-error';
import type { SupabaseService } from '../supabase/supabase.service';

export type AppUserView = {
  id: string;
  tenantId: string;
  authUserId: string;
  accessProfileId?: string;
  fullName: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
};

export type CreateUserInput = {
  authUserId?: string;
  email: string;
  password?: string;
  fullName: string;
  phone?: string;
  role: string;
  accessProfileId?: string;
  isActive?: boolean;
};

export type UpdateUserInput = Partial<Omit<CreateUserInput, 'password' | 'authUserId'>> & { accessProfileId?: string | null };

type AppUserRow = {
  id: string;
  tenant_id: string;
  auth_user_id: string;
  access_profile_id?: string | null;
  full_name: string;
  email: string;
  phone?: string | null;
  role: string;
  is_active: boolean;
};

export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  async findAll(auth: AuthContext): Promise<AppUserView[]> {
    const { data, error } = await this.supabase
      .getUserClient(auth)
      .from('app_users')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('full_name', { ascending: true });

    if (error) throw badRequest(error.message);
    return ((data ?? []) as AppUserRow[]).map(mapAppUser);
  }

  async create(auth: AuthContext, dto: CreateUserInput): Promise<AppUserView> {
    const serviceClient = this.supabase.getServiceClient();
    let authUserId = dto.authUserId;

    if (!authUserId) {
      const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: true
      });
      if (authError || !authData.user) throw badRequest(authError?.message ?? 'Supabase Auth user not created');
      authUserId = authData.user.id;
    }

    const { data, error } = await this.supabase
      .getUserClient(auth)
      .from('app_users')
      .insert({
        tenant_id: auth.tenantId,
        auth_user_id: authUserId,
        access_profile_id: dto.accessProfileId ?? null,
        full_name: dto.fullName,
        email: dto.email,
        phone: dto.phone ?? null,
        role: dto.role,
        is_active: dto.isActive ?? true
      })
      .select('*')
      .single<AppUserRow>();

    if (error) throw badRequest(error.message);
    return mapAppUser(data);
  }

  async update(auth: AuthContext, id: string, dto: UpdateUserInput): Promise<AppUserView> {
    const serviceClient = this.supabase.getServiceClient();
    if (dto.email) {
      const current = await this.findOneRow(auth, id);
      const { error: authError } = await serviceClient.auth.admin.updateUserById(current.auth_user_id, { email: dto.email });
      if (authError) throw badRequest(authError.message);
    }

    const patch: Record<string, unknown> = {};
    if (dto.fullName !== undefined) patch.full_name = dto.fullName;
    if (dto.email !== undefined) patch.email = dto.email;
    if (dto.phone !== undefined) patch.phone = dto.phone;
    if (dto.role !== undefined) patch.role = dto.role;
    if (dto.accessProfileId !== undefined) patch.access_profile_id = dto.accessProfileId;
    if (dto.isActive !== undefined) patch.is_active = dto.isActive;

    const { data, error } = await this.supabase
      .getUserClient(auth)
      .from('app_users')
      .update(patch)
      .eq('tenant_id', auth.tenantId)
      .eq('id', id)
      .select('*')
      .single<AppUserRow>();

    if (error) throw badRequest(error.message);
    return mapAppUser(data);
  }

  private async findOneRow(auth: AuthContext, id: string): Promise<AppUserRow> {
    const { data, error } = await this.supabase
      .getUserClient(auth)
      .from('app_users')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('id', id)
      .single<AppUserRow>();
    if (error) throw badRequest(error.message);
    return data;
  }
}

export function mapAppUser(row: AppUserRow): AppUserView {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    authUserId: row.auth_user_id,
    accessProfileId: row.access_profile_id ?? undefined,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone ?? undefined,
    role: row.role,
    isActive: row.is_active
  };
}
