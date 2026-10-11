create table public.services (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 100),
  category text not null check (
    category in ('Desain', 'Website', 'Video', 'Menulis', 'Tutor')
  ),
  description text not null check (
    char_length(btrim(description)) between 10 and 2000
  ),
  price integer not null check (price > 0),
  service_range text not null check (service_range in ('Online', 'Lokal')),
  location text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  constraint services_location_required_for_local
    check (service_range <> 'Lokal' or nullif(btrim(location), '') is not null)
);

create index services_active_created_at_idx
  on public.services (created_at desc)
  where is_active = true;
create index services_owner_created_at_idx
  on public.services (owner_id, created_at desc);

alter table public.services enable row level security;

revoke all on table public.services from public, anon, authenticated;
grant select on table public.services to anon, authenticated;
grant insert, update, delete on table public.services to authenticated;

create policy "Anyone can view active services"
  on public.services
  for select
  to anon, authenticated
  using (is_active or owner_id = (select auth.uid()));

create policy "Sellers can create their own services"
  on public.services
  for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_seller = true
    )
  );

create policy "Sellers can update their own services"
  on public.services
  for update
  to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_seller = true
    )
  )
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_seller = true
    )
  );

create policy "Sellers can delete their own services"
  on public.services
  for delete
  to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_seller = true
    )
  );
