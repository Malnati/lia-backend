import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { AuthContext } from '../auth/auth.types';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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

@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  async findAll(auth: AuthContext): Promise<AppUserView[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('app_users')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('full_name', { ascending: true });

    if (error) throw new BadRequestException(error.message);
    return ((data ?? []) as AppUserRow[]).map(mapAppUser);
  }

  async create(auth: AuthContext, dto: CreateUserDto): Promise<AppUserView> {
    const client = this.supabase.getClient();
    let authUserId = dto.authUserId;

    if (!authUserId) {
      const { data: authData, error: authError } = await client.auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: true
      });
      if (authError || !authData.user) throw new BadRequestException(authError?.message ?? 'Supabase Auth user not created');
      authUserId = authData.user.id;
    }

    const { data, error } = await client
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

    if (error) throw new BadRequestException(error.message);
    return mapAppUser(data);
  }

  async update(auth: AuthContext, id: string, dto: UpdateUserDto): Promise<AppUserView> {
    const client = this.supabase.getClient();
    if (dto.email) {
      const current = await this.findOneRow(auth, id);
      const { error: authError } = await client.auth.admin.updateUserById(current.auth_user_id, { email: dto.email });
      if (authError) throw new BadRequestException(authError.message);
    }

    const patch: Record<string, unknown> = {};
    if (dto.fullName !== undefined) patch.full_name = dto.fullName;
    if (dto.email !== undefined) patch.email = dto.email;
    if (dto.phone !== undefined) patch.phone = dto.phone;
    if (dto.role !== undefined) patch.role = dto.role;
    if (dto.accessProfileId !== undefined) patch.access_profile_id = dto.accessProfileId;
    if (dto.isActive !== undefined) patch.is_active = dto.isActive;

    const { data, error } = await client
      .from('app_users')
      .update(patch)
      .eq('tenant_id', auth.tenantId)
      .eq('id', id)
      .select('*')
      .single<AppUserRow>();

    if (error) throw new BadRequestException(error.message);
    return mapAppUser(data);
  }

  private async findOneRow(auth: AuthContext, id: string): Promise<AppUserRow> {
    const { data, error } = await this.supabase
      .getClient()
      .from('app_users')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('id', id)
      .single<AppUserRow>();
    if (error) throw new BadRequestException(error.message);
    return data;
  }
}

function mapAppUser(row: AppUserRow): AppUserView {
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
