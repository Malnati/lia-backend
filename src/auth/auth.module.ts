import { Module } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthService } from './auth.service';
import { PermissionsGuard } from './permissions.guard';
import { SupabaseAuthGuard } from './supabase-auth.guard';

@Module({
  providers: [AuthService, SupabaseAuthGuard, PermissionsGuard, SupabaseService],
  exports: [AuthService, SupabaseAuthGuard, PermissionsGuard, SupabaseService]
})
export class AuthModule {}
