export type AppPermission =
  | 'orders:read'
  | 'orders:write'
  | 'checkpoints:write'
  | 'attachments:read'
  | 'attachments:write'
  | 'payments:read'
  | 'payments:write'
  | 'users:read'
  | 'users:write'
  | 'profiles:read'
  | 'profiles:write'
  | 'tenants:read'
  | 'tenants:write'
  | 'production:read'
  | 'production:write'
  | 'dashboard:read';

export type AuthContext = {
  authUserId: string;
  appUserId: string;
  tenantId: string;
  role: string;
  permissions: AppPermission[];
  email?: string;
};

export type RequestWithAuth = {
  liaAuth?: AuthContext;
  headers?: Record<string, string | string[] | undefined>;
};
