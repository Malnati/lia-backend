-- Lia initial Supabase/Postgres schema.
-- Applies the REQ.md multi-tenant contract: Supabase Auth, RLS and tenant isolation.

create extension if not exists pgcrypto;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  brand_name text not null,
  colors jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.access_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  role text not null,
  permissions text[] not null default '{}',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  access_profile_id uuid references public.access_profiles(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  role text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, auth_user_id),
  unique (tenant_id, email)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id text,
  customer_name text not null,
  customer_phone text not null,
  delivery_address text not null,
  product text not null default 'Molde prótese',
  status text not null default 'draft',
  payment_status text not null default 'pending',
  pending_sync boolean not null default false,
  notes text not null default '',
  assigned_to uuid references public.app_users(id) on delete set null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, client_id),
  constraint orders_status_check check (status in (
    'draft', 'awaiting_payment', 'paid', 'pickup_scheduled', 'picked_up',
    'in_production', 'ready_for_delivery', 'delivery_scheduled', 'delivered', 'cancelled'
  )),
  constraint orders_payment_status_check check (payment_status in ('pending', 'authorized', 'paid', 'failed', 'cancelled'))
);

create table if not exists public.order_checkpoints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  key text not null,
  label text not null,
  completed boolean not null default false,
  actor text,
  occurred_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, order_id, key)
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  kind text not null,
  filename text not null,
  content_type text not null,
  size_bytes integer not null,
  storage_bucket text not null default 'order-attachments',
  storage_path text not null unique,
  client_attachment_id text,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint attachments_kind_check check (kind in ('photo', 'signature'))
);

create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'pending_gateway',
  amount numeric(14, 2) not null default 0,
  currency text not null default 'PYG',
  status text not null default 'pending',
  checkout_url text,
  provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_intents_currency_check check (currency in ('PYG', 'USD')),
  constraint payment_intents_status_check check (status in ('pending', 'authorized', 'paid', 'failed', 'cancelled'))
);

create table if not exists public.sync_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  app_user_id uuid references public.app_users(id) on delete set null,
  device_id text,
  entity text not null,
  entity_id uuid,
  operation text not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sync_events_status_check check (status in ('pending', 'applied', 'failed', 'conflict'))
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tenants_touch_updated_at on public.tenants;
create trigger tenants_touch_updated_at before update on public.tenants for each row execute function public.touch_updated_at();
drop trigger if exists access_profiles_touch_updated_at on public.access_profiles;
create trigger access_profiles_touch_updated_at before update on public.access_profiles for each row execute function public.touch_updated_at();
drop trigger if exists app_users_touch_updated_at on public.app_users;
create trigger app_users_touch_updated_at before update on public.app_users for each row execute function public.touch_updated_at();
drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at before update on public.orders for each row execute function public.touch_updated_at();
drop trigger if exists order_checkpoints_touch_updated_at on public.order_checkpoints;
create trigger order_checkpoints_touch_updated_at before update on public.order_checkpoints for each row execute function public.touch_updated_at();
drop trigger if exists payment_intents_touch_updated_at on public.payment_intents;
create trigger payment_intents_touch_updated_at before update on public.payment_intents for each row execute function public.touch_updated_at();
drop trigger if exists sync_events_touch_updated_at on public.sync_events;
create trigger sync_events_touch_updated_at before update on public.sync_events for each row execute function public.touch_updated_at();

create index if not exists access_profiles_tenant_role_idx on public.access_profiles (tenant_id, role);
create index if not exists app_users_tenant_auth_idx on public.app_users (tenant_id, auth_user_id);
create index if not exists app_users_tenant_active_idx on public.app_users (tenant_id, is_active);
create index if not exists orders_tenant_status_updated_idx on public.orders (tenant_id, status, updated_at desc);
create index if not exists orders_tenant_payment_status_idx on public.orders (tenant_id, payment_status);
create index if not exists orders_tenant_assigned_idx on public.orders (tenant_id, assigned_to);
create index if not exists order_checkpoints_tenant_order_key_idx on public.order_checkpoints (tenant_id, order_id, key);
create index if not exists attachments_tenant_order_idx on public.attachments (tenant_id, order_id);
create index if not exists payment_intents_tenant_status_idx on public.payment_intents (tenant_id, status, updated_at desc);
create index if not exists payment_intents_tenant_order_idx on public.payment_intents (tenant_id, order_id);
create index if not exists sync_events_tenant_status_idx on public.sync_events (tenant_id, status, updated_at desc);

create or replace function public.current_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select app_users.tenant_id
  from public.app_users
  where app_users.auth_user_id = (select auth.uid())
    and app_users.is_active = true;
$$;

create or replace function public.current_user_can(permission text, tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_users
    join public.access_profiles on access_profiles.id = app_users.access_profile_id
    where app_users.auth_user_id = (select auth.uid())
      and app_users.tenant_id = tenant
      and app_users.is_active = true
      and permission = any(access_profiles.permissions)
  );
$$;

alter table public.tenants enable row level security;
alter table public.tenants force row level security;
alter table public.access_profiles enable row level security;
alter table public.access_profiles force row level security;
alter table public.app_users enable row level security;
alter table public.app_users force row level security;
alter table public.orders enable row level security;
alter table public.orders force row level security;
alter table public.order_checkpoints enable row level security;
alter table public.order_checkpoints force row level security;
alter table public.attachments enable row level security;
alter table public.attachments force row level security;
alter table public.payment_intents enable row level security;
alter table public.payment_intents force row level security;
alter table public.sync_events enable row level security;
alter table public.sync_events force row level security;

drop policy if exists tenants_by_membership on public.tenants;
create policy tenants_by_membership on public.tenants
  for select to authenticated
  using (id in (select public.current_tenant_ids()));

drop policy if exists access_profiles_by_tenant on public.access_profiles;
create policy access_profiles_by_tenant on public.access_profiles
  for all to authenticated
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

drop policy if exists app_users_by_tenant on public.app_users;
create policy app_users_by_tenant on public.app_users
  for all to authenticated
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

drop policy if exists orders_by_tenant on public.orders;
create policy orders_by_tenant on public.orders
  for all to authenticated
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

drop policy if exists order_checkpoints_by_tenant on public.order_checkpoints;
create policy order_checkpoints_by_tenant on public.order_checkpoints
  for all to authenticated
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

drop policy if exists attachments_by_tenant on public.attachments;
create policy attachments_by_tenant on public.attachments
  for all to authenticated
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

drop policy if exists payment_intents_by_tenant on public.payment_intents;
create policy payment_intents_by_tenant on public.payment_intents
  for all to authenticated
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

drop policy if exists sync_events_by_tenant on public.sync_events;
create policy sync_events_by_tenant on public.sync_events
  for all to authenticated
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-attachments', 'order-attachments', false, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
