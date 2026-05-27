import { Module } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, SupabaseService]
})
export class OrdersModule {}
