import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { DbHealthController } from './db/db-health.controller';
import { HealthController } from './health/health.controller';
import { OrdersModule } from './orders/orders.module';
import { SupabaseService } from './supabase/supabase.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, OrdersModule, AdminModule],
  controllers: [HealthController, DbHealthController],
  providers: [SupabaseService],
  exports: [SupabaseService]
})
export class AppModule {}
