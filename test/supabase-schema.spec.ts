import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(join(process.cwd(), 'supabase/migrations/0001_initial_schema.sql'), 'utf8');

describe('supabase postgres schema contract', () => {
  it('declares all required Lia tables from REQ.md', () => {
    for (const table of [
      'tenants',
      'access_profiles',
      'app_users',
      'orders',
      'order_checkpoints',
      'attachments',
      'payment_intents',
      'sync_events'
    ]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
    }
  });

  it('enables and forces RLS on operational tables', () => {
    for (const table of ['orders', 'order_checkpoints', 'attachments', 'payment_intents', 'sync_events']) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
      expect(migration).toContain(`alter table public.${table} force row level security`);
    }
  });

  it('indexes tenant and workflow lookup columns', () => {
    expect(migration).toContain('create index if not exists orders_tenant_status_updated_idx');
    expect(migration).toContain('create index if not exists payment_intents_tenant_status_idx');
    expect(migration).toContain('create index if not exists order_checkpoints_tenant_order_key_idx');
  });
});
