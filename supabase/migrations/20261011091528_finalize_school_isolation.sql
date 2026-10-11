drop policy "Master data viewable by everyone" on public.master_students;
alter table public.master_students
  drop column school_name,
  drop column default_class;

revoke all on function public.current_user_school_id() from public, anon;
grant execute on function public.current_user_school_id() to authenticated;
