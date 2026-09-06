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
alter publication supabase_realtime add table public.frigoplan_rooms;
