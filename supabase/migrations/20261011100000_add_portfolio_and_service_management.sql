alter table public.services
  add column estimated_days integer not null default 3
  check (estimated_days between 1 and 365);

create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 100),
  description text not null check (
    char_length(btrim(description)) between 10 and 2000
  ),
  media_url text,
  media_path text,
  project_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint portfolios_media_pair
    check ((media_url is null) = (media_path is null)),
  constraint portfolios_project_url_valid
    check (
      project_url is null
      or project_url ~* '^https?://'
    )
);

create index portfolios_school_created_at_idx
  on public.portfolios (school_id, created_at desc);
create index portfolios_owner_created_at_idx
  on public.portfolios (owner_id, created_at desc);

alter table public.portfolios enable row level security;
revoke all on table public.portfolios from public, anon, authenticated;
grant select on table public.portfolios to authenticated;
grant insert, update, delete on table public.portfolios to authenticated;

create policy "Students can view portfolios from their school"
  on public.portfolios
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles viewer
      where viewer.id = (select auth.uid())
        and viewer.school_id = portfolios.school_id
    )
  );

create policy "Students can add their own portfolios"
  on public.portfolios
  for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles owner
      where owner.id = (select auth.uid())
        and owner.school_id = portfolios.school_id
    )
  );

create policy "Students can update their own portfolios"
  on public.portfolios
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles owner
      where owner.id = (select auth.uid())
        and owner.school_id = portfolios.school_id
    )
  );

create policy "Students can delete their own portfolios"
  on public.portfolios
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio-media',
  'portfolio-media',
  true,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Students can upload portfolio media to their folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'portfolio-media'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Students can update portfolio media in their folder"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'portfolio-media'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'portfolio-media'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Students can delete portfolio media in their folder"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'portfolio-media'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
