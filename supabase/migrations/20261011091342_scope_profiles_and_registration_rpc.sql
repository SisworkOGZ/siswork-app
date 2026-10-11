revoke all on function public.complete_student_registration(text)
  from public, anon;
grant execute on function public.complete_student_registration(text)
  to authenticated;

drop policy "Public profiles are viewable by everyone" on public.profiles;
drop policy "Allow users to insert their own profile" on public.profiles;
drop policy "Users can update own profile" on public.profiles;

create function public.current_user_school_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.school_id
  from public.profiles p
  where p.id = (select auth.uid());
$$;

revoke all on function public.current_user_school_id() from public, anon;
grant execute on function public.current_user_school_id() to authenticated;

create policy "Students can view profiles from their school"
  on public.profiles
  for select
  to authenticated
  using (
    school_id = (select public.current_user_school_id())
  );

create policy "Users can update their own non-identity profile fields"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
