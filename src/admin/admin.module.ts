import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccessProfilesController } from './access-profiles.controller';
import { AccessProfilesService } from './access-profiles.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule],
  controllers: [UsersController, AccessProfilesController],
  providers: [UsersService, AccessProfilesService]
})
export class AdminModule {}
