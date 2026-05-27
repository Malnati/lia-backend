import type { AuthContext } from '../auth/auth.types';
import { badRequest } from '../http-error';
import type { SupabaseService } from '../supabase/supabase.service';

export type AccessProfileView = {
  id: string;
  tenantId: string;
  name: string;
  role: string;
  permissions: string[];
  isSystem: boolean;
};

export type CreateAccessProfileInput = {
  name: string;
  role: string;
  permissions: string[];
  isSystem?: boolean;
};

export type UpdateAccessProfileInput = Partial<CreateAccessProfileInput>;

type AccessProfileRow = {
  id: string;
  tenant_id: string;
  name: string;
  role: string;
  permissions: string[];
  is_system: boolean;
};

export class AccessProfilesService {
  constructor(private readonly supabase: SupabaseService) {}

  async findAll(auth: AuthContext): Promise<AccessProfileView[]> {
    const { data, error } = await this.supabase
      .getUserClient(auth)
      .from('access_profiles')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('name', { ascending: true });

    if (error) throw badRequest(error.message);
    return ((data ?? []) as AccessProfileRow[]).map(mapAccessProfile);
  }

  async create(auth: AuthContext, dto: CreateAccessProfileInput): Promise<AccessProfileView> {
    const { data, error } = await this.supabase
      .getUserClient(auth)
      .from('access_profiles')
      .insert({
        tenant_id: auth.tenantId,
        name: dto.name,
        role: dto.role,
        permissions: dto.permissions,
        is_system: dto.isSystem ?? false
      })
      .select('*')
      .single<AccessProfileRow>();

    if (error) throw badRequest(error.message);
    return mapAccessProfile(data);
  }

  async update(auth: AuthContext, id: string, dto: UpdateAccessProfileInput): Promise<AccessProfileView> {
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.role !== undefined) patch.role = dto.role;
    if (dto.permissions !== undefined) patch.permissions = dto.permissions;
    if (dto.isSystem !== undefined) patch.is_system = dto.isSystem;

    const { data, error } = await this.supabase
      .getUserClient(auth)
      .from('access_profiles')
      .update(patch)
      .eq('tenant_id', auth.tenantId)
      .eq('id', id)
      .select('*')
      .single<AccessProfileRow>();

    if (error) throw badRequest(error.message);
    return mapAccessProfile(data);
  }
}

export function mapAccessProfile(row: AccessProfileRow): AccessProfileView {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    role: row.role,
    permissions: row.permissions ?? [],
    isSystem: row.is_system
  };
}
