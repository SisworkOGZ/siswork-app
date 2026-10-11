create table public.schools (
  id uuid primary key default gen_random_uuid(),
  npsn text unique,
  name text not null,
  address text,
  is_partner boolean not null default false,
  constraint schools_name_not_blank check (char_length(btrim(name)) > 0)
);

create unique index schools_name_unique_idx
  on public.schools (lower(btrim(name)));

insert into public.schools (name)
select distinct btrim(school_name)
from public.master_students
where nullif(btrim(school_name), '') is not null
union
select distinct btrim(school_id)
from public.profiles
where nullif(btrim(school_id), '') is not null
on conflict do nothing;

alter table public.schools enable row level security;
grant select on public.schools to anon, authenticated;
create policy "Schools are publicly readable"
  on public.schools
  for select
  to anon, authenticated
  using (true);

alter table public.master_students
  add column school_id uuid,
  add column grade_level text,
  add column major text,
  add column class_group text;

update public.master_students m
set school_id = s.id,
    grade_level = coalesce(
      nullif(substring(m.default_class from '^\s*([0-9]+)'), ''),
      nullif(btrim(m.default_class), '')
    ),
    major = case
      when nullif(
        btrim(substring(m.default_class from '^\s*[0-9]+\s+(.+)$')),
        ''
      ) is null then null
      when upper(btrim(substring(m.default_class from '^\s*[0-9]+\s+(.+)$')))
        in ('SMA', 'SMK') then null
      else btrim(substring(m.default_class from '^\s*[0-9]+\s+(.+)$'))
    end
from public.schools s
where lower(btrim(s.name)) = lower(btrim(m.school_name));

alter table public.master_students
  alter column school_id set not null,
  alter column grade_level set not null,
  alter column is_registered drop default,
  alter column is_registered type boolean
    using (coalesce(is_registered, 0) <> 0),
  alter column is_registered set default false,
  alter column is_registered set not null,
  add constraint master_students_school_id_fkey
    foreign key (school_id) references public.schools (id);

create index master_students_school_id_idx
  on public.master_students (school_id);

alter table public.profiles add column school_uuid uuid;

update public.profiles p
set school_uuid = s.id
from public.schools s
where lower(btrim(s.name)) = lower(btrim(p.school_id));

alter table public.profiles
  alter column school_uuid set not null,
  add constraint profiles_school_id_fkey
    foreign key (school_uuid) references public.schools (id);

alter table public.profiles drop column school_id;
alter table public.profiles rename column school_uuid to school_id;
create index profiles_school_id_idx on public.profiles (school_id);

create function public.validate_student_nisn(p_nisn text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'full_name', m.full_name,
    'school_id', m.school_id,
    'school_name', s.name,
    'grade_level', m.grade_level,
    'major', m.major,
    'class_group', m.class_group,
    'is_registered', m.is_registered
  )
  from public.master_students m
  join public.schools s on s.id = m.school_id
  where p_nisn ~ '^[0-9]{10}$'
    and m.nisn = p_nisn
  limit 1;
$$;

revoke all on function public.validate_student_nisn(text) from public;
grant execute on function public.validate_student_nisn(text)
  to anon, authenticated;
revoke select on public.master_students from public, anon, authenticated;

create function public.complete_student_registration(p_nisn text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  metadata_nisn text;
  student public.master_students%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select u.raw_user_meta_data ->> 'nisn'
  into metadata_nisn
  from auth.users u
  where u.id = current_user_id;

  if metadata_nisn is distinct from p_nisn then
    raise exception 'NISN does not match the authenticated account';
  end if;

  select *
  into student
  from public.master_students m
  where m.nisn = p_nisn
  for update;

  if not found then
    raise exception 'Student NISN was not found';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id = current_user_id
      and p.nisn = p_nisn
  ) then
    return;
  end if;

  if student.is_registered then
    raise exception 'This NISN is already registered';
  end if;

  insert into public.profiles (
    id,
    nisn,
    school_id,
    full_name,
    major,
    grade_level,
    is_verified,
    is_seller
  )
  values (
    current_user_id,
    student.nisn,
    student.school_id,
    student.full_name,
    coalesce(student.major, 'UMUM'),
    student.grade_level,
    true,
    false
  );

  update public.master_students
  set is_registered = true
  where nisn = p_nisn;
end;
$$;

revoke all on function public.complete_student_registration(text) from public;
grant execute on function public.complete_student_registration(text)
  to authenticated;
revoke insert on public.profiles from public, anon, authenticated;

create function public.protect_profile_student_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.nisn is distinct from old.nisn
    or new.school_id is distinct from old.school_id
    or new.full_name is distinct from old.full_name
    or new.is_verified is distinct from old.is_verified then
    raise exception 'Verified student identity fields cannot be changed';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_student_identity
  before update on public.profiles
  for each row
  execute function public.protect_profile_student_identity();

alter table public.services rename column owner_id to seller_id;
alter table public.services add column thumbnail_url text;

alter table public.conversations
  drop constraint conversations_distinct_participants,
  drop constraint conversations_unique_participant_pair;

alter table public.conversations
  rename column participant_low_id to buyer_id;
alter table public.conversations
  rename column participant_high_id to seller_id;
alter table public.conversations
  rename column participant_low_last_read_at to buyer_last_read_at;
alter table public.conversations
  rename column participant_high_last_read_at to seller_last_read_at;

update public.conversations c
set buyer_id = c.seller_id,
    seller_id = c.buyer_id,
    buyer_last_read_at = c.seller_last_read_at,
    seller_last_read_at = c.buyer_last_read_at
from public.profiles low_profile
where low_profile.id = c.buyer_id
  and low_profile.is_seller is true;

alter table public.conversations
  add constraint conversations_distinct_buyer_seller
    check (buyer_id <> seller_id),
  add constraint conversations_buyer_seller_unique
    unique (buyer_id, seller_id);

create unique index conversations_unique_profile_pair_idx
  on public.conversations (
    least(buyer_id, seller_id),
    greatest(buyer_id, seller_id)
  );

create index conversations_buyer_updated_at_idx
  on public.conversations (buyer_id, updated_at desc);
create index conversations_seller_updated_at_idx
  on public.conversations (seller_id, updated_at desc);

alter table public.messages rename column body to message_text;

create or replace function public.update_conversation_after_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set last_message_preview = left(new.message_text, 160),
      last_message_at = new.created_at,
      last_message_sender_id = new.sender_id,
      updated_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

create or replace function public.get_or_create_direct_conversation(
  p_peer_id uuid,
  p_service_title text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_is_seller boolean;
  peer_is_seller boolean;
  conversation_buyer_id uuid;
  conversation_seller_id uuid;
  direct_conversation_id uuid;
  normalized_service_title text;
  buyer_school_id uuid;
  seller_school_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_peer_id is null or p_peer_id = current_user_id then
    raise exception 'Choose another profile to start a conversation';
  end if;

  select p.is_seller
  into current_is_seller
  from public.profiles p
  where p.id = current_user_id;
  if not found then
    raise exception 'Current profile was not found';
  end if;

  select p.is_seller
  into peer_is_seller
  from public.profiles p
  where p.id = p_peer_id;
  if not found then
    raise exception 'Peer profile was not found';
  end if;

  if current_is_seller = peer_is_seller then
    raise exception 'A conversation requires one buyer and one seller';
  end if;

  if current_is_seller then
    conversation_buyer_id := p_peer_id;
    conversation_seller_id := current_user_id;
  else
    conversation_buyer_id := current_user_id;
    conversation_seller_id := p_peer_id;
  end if;

  select p.school_id into buyer_school_id
  from public.profiles p where p.id = conversation_buyer_id;
  select p.school_id into seller_school_id
  from public.profiles p where p.id = conversation_seller_id;

  if buyer_school_id is distinct from seller_school_id then
    raise exception 'Chat is only available between students of the same school';
  end if;

  normalized_service_title :=
    left(coalesce(nullif(btrim(p_service_title), ''), 'Percakapan langsung'), 200);

  insert into public.conversations (
    buyer_id,
    seller_id,
    service_title
  )
  values (
    conversation_buyer_id,
    conversation_seller_id,
    normalized_service_title
  )
  on conflict do nothing
  returning id into direct_conversation_id;

  if direct_conversation_id is null then
    select c.id
    into direct_conversation_id
    from public.conversations c
    where least(c.buyer_id, c.seller_id) =
        least(conversation_buyer_id, conversation_seller_id)
      and greatest(c.buyer_id, c.seller_id) =
        greatest(conversation_buyer_id, conversation_seller_id);
  end if;

  if direct_conversation_id is null then
    raise exception 'Conversation could not be created or reused';
  end if;

  return direct_conversation_id;
end;
$$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set buyer_last_read_at = timezone('utc', now())
  where id = p_conversation_id
    and buyer_id = auth.uid();

  if not found then
    update public.conversations
    set seller_last_read_at = timezone('utc', now())
    where id = p_conversation_id
      and seller_id = auth.uid();
  end if;

  if not found then
    raise exception 'Conversation not found or access denied';
  end if;
end;
$$;

revoke all on function public.get_or_create_direct_conversation(uuid, text)
  from public;
grant execute on function public.get_or_create_direct_conversation(uuid, text)
  to authenticated;
revoke all on function public.update_conversation_after_message() from public;
revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

drop policy "Anyone can view active services" on public.services;
create policy "Students can view services from their school"
  on public.services
  for select
  to authenticated
  using (
    is_active
    and exists (
      select 1
      from public.profiles seller
      join public.profiles viewer
        on viewer.id = (select auth.uid())
      where seller.id = services.seller_id
        and seller.school_id = viewer.school_id
    )
  );

create policy "Anonymous users cannot view services"
  on public.services
  for select
  to anon
  using (false);
