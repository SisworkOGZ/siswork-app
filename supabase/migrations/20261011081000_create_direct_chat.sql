create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant_low_id uuid not null references public.profiles (id) on delete cascade,
  participant_high_id uuid not null references public.profiles (id) on delete cascade,
  service_title text not null,
  last_message_preview text,
  last_message_at timestamptz,
  last_message_sender_id uuid references public.profiles (id) on delete set null,
  participant_low_last_read_at timestamptz,
  participant_high_last_read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint conversations_distinct_participants
    check (participant_low_id < participant_high_id),
  constraint conversations_unique_participant_pair
    unique (participant_low_id, participant_high_id)
);

create index conversations_low_updated_at_idx
  on public.conversations (participant_low_id, updated_at desc);
create index conversations_high_updated_at_idx
  on public.conversations (participant_high_id, updated_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null
    check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default timezone('utc', now())
);

create index messages_conversation_created_at_idx
  on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

grant select, insert on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;

create policy "Participants can view conversations"
  on public.conversations
  for select
  to authenticated
  using (
    auth.uid() = participant_low_id
    or auth.uid() = participant_high_id
  );

create policy "Participants can create conversations"
  on public.conversations
  for insert
  to authenticated
  with check (
    auth.uid() = participant_low_id
    or auth.uid() = participant_high_id
  );

create policy "Participants can view messages"
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and (
          auth.uid() = c.participant_low_id
          or auth.uid() = c.participant_high_id
        )
    )
  );

create policy "Participants can send their own messages"
  on public.messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and (
          auth.uid() = c.participant_low_id
          or auth.uid() = c.participant_high_id
        )
    )
  );

create function public.update_conversation_after_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set last_message_preview = left(new.body, 160),
      last_message_at = new.created_at,
      last_message_sender_id = new.sender_id,
      updated_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_update_conversation
  after insert on public.messages
  for each row
  execute function public.update_conversation_after_message();

create function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set participant_low_last_read_at = timezone('utc', now())
  where id = p_conversation_id
    and participant_low_id = auth.uid();

  if not found then
    update public.conversations
    set participant_high_last_read_at = timezone('utc', now())
    where id = p_conversation_id
      and participant_high_id = auth.uid();
  end if;

  if not found then
    raise exception 'Conversation not found or access denied';
  end if;
end;
$$;

revoke all on function public.update_conversation_after_message() from public;
revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
