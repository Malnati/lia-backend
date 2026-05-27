import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { extractBearerToken } from './auth-operations';
import { AuthService } from './auth.service';
import type { RequestWithAuth } from './auth.types';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const token = extractBearerToken(request.headers?.authorization);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    request.liaAuth = await this.authService.resolveContextFromToken(token);
    return true;
  }
}
