import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbHealthController } from './db/db-health.controller';
import { HealthController } from './health/health.controller';
import { OrdersModule } from './orders/orders.module';
import { SupabaseService } from './supabase/supabase.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), OrdersModule],
  controllers: [HealthController, DbHealthController],
  providers: [SupabaseService],
  exports: [SupabaseService]
})
export class AppModule {}
