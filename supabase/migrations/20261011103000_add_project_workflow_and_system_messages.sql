alter table public.messages
  add column message_type text not null default 'text'
    check (message_type in ('text', 'image', 'file', 'invoice')),
  add column payload jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  false,
  15728640,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime', 'application/pdf'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Conversation participants can upload chat media"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'chat-media'
    and (storage.foldername(name))[2] = (select auth.uid()::text)
    and exists (
      select 1
      from public.conversations c
      where c.id = ((storage.foldername(name))[1])::uuid
        and auth.uid() in (c.buyer_id, c.seller_id)
        and exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.school_id = (select public.current_user_school_id())
        )
    )
  );

create policy "Conversation participants can read chat media"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'chat-media'
    and exists (
      select 1
      from public.conversations c
      where c.id = ((storage.foldername(name))[1])::uuid
        and auth.uid() in (c.buyer_id, c.seller_id)
        and exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.school_id = (select public.current_user_school_id())
        )
    )
  );

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 200),
  description text,
  amount numeric(12, 2) not null check (amount >= 0),
  status text not null default 'in_progress'
    check (status in ('in_progress', 'revision', 'completed')),
  delivery_url text,
  revision_request text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint projects_distinct_participants check (buyer_id <> seller_id),
  constraint projects_delivery_url_valid check (
    delivery_url is null or delivery_url ~* '^https?://'
  )
);

create index projects_buyer_status_updated_idx
  on public.projects (buyer_id, status, updated_at desc);
create index projects_seller_status_updated_idx
  on public.projects (seller_id, status, updated_at desc);
create index projects_school_id_idx on public.projects (school_id);

alter table public.projects enable row level security;
grant select on public.projects to authenticated;
grant update (status, delivery_url, revision_request, updated_at)
  on public.projects to authenticated;

create policy "Project participants can view projects"
  on public.projects
  for select
  to authenticated
  using (
    auth.uid() in (buyer_id, seller_id)
    and school_id = (select public.current_user_school_id())
  );

create policy "Project participants can update projects"
  on public.projects
  for update
  to authenticated
  using (
    auth.uid() in (buyer_id, seller_id)
    and school_id = (select public.current_user_school_id())
  )
  with check (
    auth.uid() in (buyer_id, seller_id)
    and school_id = (select public.current_user_school_id())
  );

drop policy "Participants can send their own messages" on public.messages;

create policy "Participants can send their own messages"
  on public.messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and (
      message_type <> 'invoice'
      or (
        payload ? 'project_id'
        and exists (
          select 1
          from public.projects p
          where p.id = (messages.payload ->> 'project_id')::uuid
            and p.conversation_id = messages.conversation_id
            and auth.uid() in (p.buyer_id, p.seller_id)
            and p.school_id = (select public.current_user_school_id())
        )
      )
    )
  );

create function public.create_project_invoice(
  p_conversation_id uuid,
  p_title text,
  p_description text,
  p_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  conversation public.conversations%rowtype;
  seller_school_id uuid;
  buyer_school_id uuid;
  new_project_id uuid;
  clean_title text := btrim(coalesce(p_title, ''));
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if char_length(clean_title) not between 3 and 200 then
    raise exception 'Project title must contain 3 to 200 characters';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'Invoice amount must be zero or greater';
  end if;

  select * into conversation
  from public.conversations c
  where c.id = p_conversation_id
    and c.seller_id = current_user_id;
  if not found then
    raise exception 'Only the seller can issue an invoice in this conversation';
  end if;

  select p.school_id into seller_school_id
  from public.profiles p where p.id = conversation.seller_id;
  select p.school_id into buyer_school_id
  from public.profiles p where p.id = conversation.buyer_id;
  if seller_school_id is null or seller_school_id is distinct from buyer_school_id then
    raise exception 'Project participants must belong to the same school';
  end if;

  insert into public.projects (
    conversation_id, school_id, buyer_id, seller_id, title, description, amount
  )
  values (
    conversation.id,
    seller_school_id,
    conversation.buyer_id,
    conversation.seller_id,
    clean_title,
    nullif(btrim(coalesce(p_description, '')), ''),
    p_amount
  )
  returning id into new_project_id;

  insert into public.messages (
    conversation_id, sender_id, message_text, message_type, payload
  )
  values (
    conversation.id,
    current_user_id,
    'Invoice proyek: ' || clean_title,
    'invoice',
    jsonb_build_object(
      'project_id', new_project_id,
      'title', clean_title,
      'amount', p_amount,
      'currency', 'IDR',
      'description', nullif(btrim(coalesce(p_description, '')), '')
    )
  );
  return new_project_id;
end;
$$;

revoke all on function public.create_project_invoice(uuid, text, text, numeric)
  from public;
grant execute on function public.create_project_invoice(uuid, text, text, numeric)
  to authenticated;

create function public.validate_project_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() = old.seller_id then
    if new.status <> 'revision'
      or new.delivery_url is null
      or new.revision_request is not null then
      raise exception 'Sellers must submit a delivery link for review';
    end if;
  elsif auth.uid() = old.buyer_id then
    if new.delivery_url is distinct from old.delivery_url then
      raise exception 'Only the seller can submit project delivery';
    end if;
    if new.status = 'completed'
      and (old.delivery_url is null or old.status <> 'revision') then
      raise exception 'A project can only be completed after delivery';
    end if;
  else
    raise exception 'Only project participants can update this project';
  end if;
  return new;
end;
$$;

create trigger projects_validate_update
  before update on public.projects
  for each row
  execute function public.validate_project_update();

revoke all on function public.validate_project_update() from public;
