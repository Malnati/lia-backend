import { Controller, Get } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('db')
export class DbHealthController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get('health')
  check() {
    return this.supabase.checkConnection();
  }
}
