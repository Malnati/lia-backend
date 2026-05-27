import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import type { AuthContext } from '../auth/auth.types';
import { AccessProfilesService } from './access-profiles.service';
import { CreateAccessProfileDto } from './dto/create-access-profile.dto';
import { UpdateAccessProfileDto } from './dto/update-access-profile.dto';

@Controller('access-profiles')
@UseGuards(SupabaseAuthGuard, PermissionsGuard)
export class AccessProfilesController {
  constructor(private readonly service: AccessProfilesService) {}

  @Get()
  @RequirePermissions('profiles:read')
  findAll(@CurrentAuth() auth: AuthContext) {
    return this.service.findAll(auth);
  }

  @Post()
  @RequirePermissions('profiles:write')
  create(@CurrentAuth() auth: AuthContext, @Body() dto: CreateAccessProfileDto) {
    return this.service.create(auth, dto);
  }

  @Patch(':id')
  @RequirePermissions('profiles:write')
  update(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Body() dto: UpdateAccessProfileDto) {
    return this.service.update(auth, id, dto);
  }
}
