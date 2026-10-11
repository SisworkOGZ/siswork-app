revoke all on function public.create_project_invoice(
  uuid, text, text, numeric
) from public, anon;
grant execute on function public.create_project_invoice(
  uuid, text, text, numeric
) to authenticated;

revoke all on function public.create_project_invoice(
  uuid, text, text, numeric, integer
) from public, anon;
grant execute on function public.create_project_invoice(
  uuid, text, text, numeric, integer
) to authenticated;

revoke all on function public.grant_extra_project_revision(uuid)
  from public, anon;
grant execute on function public.grant_extra_project_revision(uuid)
  to authenticated;

notify pgrst, 'reload schema';
