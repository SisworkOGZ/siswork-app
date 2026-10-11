revoke all on function public.update_conversation_after_message()
  from public, anon, authenticated;
revoke all on function public.mark_conversation_read(uuid)
  from public, anon;
revoke all on function public.get_or_create_direct_conversation(uuid, text)
  from public, anon;

grant execute on function public.mark_conversation_read(uuid)
  to authenticated;
grant execute on function public.get_or_create_direct_conversation(uuid, text)
  to authenticated;
