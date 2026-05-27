import { forbidden } from '../http-error';
import type { AppPermission, AuthContext } from './auth.types';

export function extractBearerToken(header: string | string[] | undefined): string | undefined {
  const value = Array.isArray(header) ? header[0] : header;
  const match = value?.match(/^bearer\s+(.+)$/i);
  return match?.[1]?.trim() || undefined;
}

export function hasPermission(context: Pick<AuthContext, 'permissions'>, permission: AppPermission): boolean {
  return context.permissions.includes(permission);
}

export function assertPermission(context: Pick<AuthContext, 'permissions'>, permission: AppPermission): void {
  if (!hasPermission(context, permission)) {
    throw forbidden(`Missing permission ${permission}`);
  }
}
