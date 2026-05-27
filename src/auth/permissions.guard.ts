import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { assertPermission } from './auth-operations';
import { PERMISSIONS_KEY } from './permissions.decorator';
import type { AppPermission, RequestWithAuth } from './auth.types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permissions =
      this.reflector.getAllAndOverride<AppPermission[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]) ?? [];
    if (permissions.length === 0) return true;

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    if (!request.liaAuth) throw new UnauthorizedException('Missing auth context');

    for (const permission of permissions) {
      assertPermission(request.liaAuth, permission);
    }
    return true;
  }
}
