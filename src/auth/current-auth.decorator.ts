import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthContext, RequestWithAuth } from './auth.types';

export const CurrentAuth = createParamDecorator((_data: unknown, context: ExecutionContext): AuthContext => {
  const request = context.switchToHttp().getRequest<RequestWithAuth>();
  if (!request.liaAuth) throw new Error('Auth context missing; SupabaseAuthGuard must run first');
  return request.liaAuth;
});
