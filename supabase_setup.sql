-- FrigoPlan: sincronización + notificaciones push
create table if not exists public.frigoplan_rooms (
  room_id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.frigoplan_rooms enable row level security;
grant select, insert, update on public.frigoplan_rooms to anon;

drop policy if exists "FrigoPlan anon read" on public.frigoplan_rooms;
create policy "FrigoPlan anon read" on public.frigoplan_rooms for select to anon using (true);
drop policy if exists "FrigoPlan anon insert" on public.frigoplan_rooms;
create policy "FrigoPlan anon insert" on public.frigoplan_rooms for insert to anon with check (true);
drop policy if exists "FrigoPlan anon update" on public.frigoplan_rooms;
create policy "FrigoPlan anon update" on public.frigoplan_rooms for update to anon using (true) with check (true);

-- Suscripciones Web Push. La clave privada VAPID NO se guarda aquí.
create table if not exists public.frigoplan_push_subscriptions (
  endpoint text primary key,
  room_id text not null,
  device_id text not null,
  device_name text not null default 'Otro dispositivo',
  subscription jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.frigoplan_push_subscriptions enable row level security;
grant select, insert, update, delete on public.frigoplan_push_subscriptions to anon;

drop policy if exists "FrigoPlan push anon read" on public.frigoplan_push_subscriptions;
create policy "FrigoPlan push anon read" on public.frigoplan_push_subscriptions for select to anon using (true);
drop policy if exists "FrigoPlan push anon insert" on public.frigoplan_push_subscriptions;
create policy "FrigoPlan push anon insert" on public.frigoplan_push_subscriptions for insert to anon with check (true);
drop policy if exists "FrigoPlan push anon update" on public.frigoplan_push_subscriptions;
create policy "FrigoPlan push anon update" on public.frigoplan_push_subscriptions for update to anon using (true) with check (true);
drop policy if exists "FrigoPlan push anon delete" on public.frigoplan_push_subscriptions;
create policy "FrigoPlan push anon delete" on public.frigoplan_push_subscriptions for delete to anon using (true);

-- Realtime para la sincronización normal. Idempotente: no falla si ya está añadida.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'frigoplan_rooms'
  ) then
    alter publication supabase_realtime add table public.frigoplan_rooms;
  end if;
end $$;
