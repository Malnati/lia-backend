-- Add leading-column indexes for foreign keys flagged by Supabase performance advisors.

create index if not exists app_users_auth_user_idx on public.app_users (auth_user_id);
create index if not exists app_users_access_profile_idx on public.app_users (access_profile_id);
create index if not exists orders_assigned_to_idx on public.orders (assigned_to);
create index if not exists order_checkpoints_order_idx on public.order_checkpoints (order_id);
create index if not exists attachments_order_idx on public.attachments (order_id);
create index if not exists payment_intents_order_idx on public.payment_intents (order_id);
create index if not exists sync_events_app_user_idx on public.sync_events (app_user_id);
