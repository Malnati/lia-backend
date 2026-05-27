import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type SupabaseHealth = {
  status: 'ok' | 'not_configured' | 'error';
  configured: boolean;
  checkedAt: string;
  error?: string;
};

@Injectable()
export class SupabaseService {
  private client?: SupabaseClient;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('SUPABASE_URL') && this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY'));
  }

  getClient(): SupabaseClient {
    if (!this.isConfigured()) {
      throw new InternalServerErrorException('Supabase is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }

    if (!this.client) {
      this.client = createClient(
        this.config.getOrThrow<string>('SUPABASE_URL'),
        this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );
    }

    return this.client;
  }

  async checkConnection(): Promise<SupabaseHealth> {
    const checkedAt = new Date().toISOString();
    if (!this.isConfigured()) {
      return { status: 'not_configured', configured: false, checkedAt };
    }

    const { error } = await this.getClient().from('tenants').select('id', { head: true, count: 'exact' }).limit(1);

    if (error) {
      return { status: 'error', configured: true, checkedAt, error: error.message };
    }

    return { status: 'ok', configured: true, checkedAt };
  }
}
