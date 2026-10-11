drop policy "Participants can create conversations"
  on public.conversations;
revoke insert on public.conversations from authenticated;

create function public.get_or_create_direct_conversation(
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
  participant_low uuid;
  participant_high uuid;
  conversation_id uuid;
  normalized_service_title text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_peer_id is null or p_peer_id = current_user_id then
    raise exception 'Choose another profile to start a conversation';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = p_peer_id
  ) then
    raise exception 'Profile not found';
  end if;

  participant_low := least(current_user_id, p_peer_id);
  participant_high := greatest(current_user_id, p_peer_id);
  normalized_service_title :=
    left(coalesce(nullif(btrim(p_service_title), ''), 'Percakapan langsung'), 200);

  insert into public.conversations (
    participant_low_id,
    participant_high_id,
    service_title
  )
  values (
    participant_low,
    participant_high,
    normalized_service_title
  )
  on conflict (participant_low_id, participant_high_id)
  do update set service_title = excluded.service_title
  returning id into conversation_id;

  return conversation_id;
end;
$$;

revoke all on function public.get_or_create_direct_conversation(uuid, text)
  from public;
grant execute on function public.get_or_create_direct_conversation(uuid, text)
  to authenticated;
