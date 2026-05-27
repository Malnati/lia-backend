import { SetMetadata } from '@nestjs/common';
import type { AppPermission } from './auth.types';

export const PERMISSIONS_KEY = 'lia:permissions';
export const RequirePermissions = (...permissions: AppPermission[]) => SetMetadata(PERMISSIONS_KEY, permissions);
