import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import type { AuthContext } from '../auth/auth.types';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(SupabaseAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @RequirePermissions('users:read')
  findAll(@CurrentAuth() auth: AuthContext) {
    return this.service.findAll(auth);
  }

  @Post()
  @RequirePermissions('users:write')
  create(@CurrentAuth() auth: AuthContext, @Body() dto: CreateUserDto) {
    return this.service.create(auth, dto);
  }

  @Patch(':id')
  @RequirePermissions('users:write')
  update(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.service.update(auth, id, dto);
  }
}
