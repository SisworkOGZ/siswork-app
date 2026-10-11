revoke all on table public.conversations
  from public, anon, authenticated;
grant select on table public.conversations to authenticated;

revoke all on table public.messages
  from public, anon, authenticated;
grant select, insert on table public.messages to authenticated;
