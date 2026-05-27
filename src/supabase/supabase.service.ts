import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { badRequest } from '../http-error';
import type { AuthContext } from '../auth/auth.types';

export type WorkerEnv = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  CORS_ORIGINS?: string;
  LIA_DEFAULT_TENANT_ID?: string;
  PAYMENT_GATEWAY_PROVIDER?: string;
};

export type SupabaseHealth = {
  status: 'ok' | 'not_configured' | 'error';
  configured: boolean;
  checkedAt: string;
  error?: string;
};

export class SupabaseService {
  private serviceClient?: SupabaseClient;

  constructor(private readonly env: WorkerEnv) {}

  isConfigured(): boolean {
    return Boolean(this.env.SUPABASE_URL && this.env.SUPABASE_SERVICE_ROLE_KEY);
  }

  hasUserClientConfig(): boolean {
    return Boolean(this.env.SUPABASE_URL && this.env.SUPABASE_ANON_KEY);
  }

  getServiceClient(): SupabaseClient {
    if (!this.env.SUPABASE_URL || !this.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw badRequest('Supabase is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }

    if (!this.serviceClient) {
      this.serviceClient = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false
        }
      });
    }

    return this.serviceClient;
  }

  getUserClient(auth: AuthContext): SupabaseClient {
    if (this.env.SUPABASE_URL && this.env.SUPABASE_ANON_KEY) {
      return createClient(this.env.SUPABASE_URL, this.env.SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false
        },
        global: {
          headers: {
            Authorization: `Bearer ${auth.accessToken}`
          }
        }
      });
    }

    // Backend-only fallback: still enforces tenant filters in every query, but RLS validation is blocked until anon key exists.
    return this.getServiceClient();
  }

  async checkConnection(): Promise<SupabaseHealth> {
    const checkedAt = new Date().toISOString();
    if (!this.isConfigured()) {
      return { status: 'not_configured', configured: false, checkedAt };
    }

    const { error } = await this.getServiceClient().from('tenants').select('id', { head: true, count: 'exact' }).limit(1);

    if (error) {
      return { status: 'error', configured: true, checkedAt, error: error.message };
    }

    return { status: 'ok', configured: true, checkedAt };
  }
}
