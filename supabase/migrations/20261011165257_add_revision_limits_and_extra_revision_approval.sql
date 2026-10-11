alter table public.projects
  add column revision_limit integer not null default 3
    check (revision_limit between 0 and 20),
  add column revision_count integer not null default 0
    check (revision_count >= 0),
  add column extra_revisions_granted integer not null default 0
    check (extra_revisions_granted >= 0);

create function public.create_project_invoice(
  p_conversation_id uuid,
  p_title text,
  p_description text,
  p_amount numeric,
  p_revision_limit integer
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
  clean_description text := nullif(btrim(coalesce(p_description, '')), '');
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if char_length(clean_title) not between 3 and 200 then
    raise exception 'Project title must contain 3 to 200 characters';
  end if;
  if char_length(coalesce(clean_description, '')) > 1000 then
    raise exception 'Project description must contain at most 1000 characters';
  end if;
  if p_amount is null or p_amount < 0 or p_amount > 9999999999.99 then
    raise exception 'Invoice amount must be between zero and 9999999999.99';
  end if;
  if p_revision_limit is null or p_revision_limit not between 0 and 20 then
    raise exception 'Free revision limit must be between 0 and 20';
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
  if seller_school_id is null
    or seller_school_id is distinct from buyer_school_id then
    raise exception 'Project participants must belong to the same school';
  end if;

  insert into public.projects (
    conversation_id,
    school_id,
    buyer_id,
    seller_id,
    title,
    description,
    amount,
    revision_limit
  )
  values (
    conversation.id,
    seller_school_id,
    conversation.buyer_id,
    conversation.seller_id,
    clean_title,
    clean_description,
    p_amount,
    p_revision_limit
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
      'revision_limit', p_revision_limit,
      'description', clean_description
    )
  );
  return new_project_id;
end;
$$;

revoke all on function public.create_project_invoice(
  uuid, text, text, numeric, integer
) from public;
grant execute on function public.create_project_invoice(
  uuid, text, text, numeric, integer
) to authenticated;

create function public.grant_extra_project_revision(p_project_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  project public.projects%rowtype;
  granted_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into project
  from public.projects p
  where p.id = p_project_id
    and p.seller_id = current_user_id
    and p.school_id = (select public.current_user_school_id())
  for update;

  if not found then
    raise exception 'Project not found or seller access denied';
  end if;
  if project.status <> 'revision'
    or project.delivery_url is null
    or project.revision_request is not null then
    raise exception 'Extra revisions can only be agreed on after a delivery';
  end if;
  if project.revision_count <
    project.revision_limit + project.extra_revisions_granted then
    raise exception 'Free or already granted revisions are still available';
  end if;

  update public.projects
  set extra_revisions_granted = extra_revisions_granted + 1
  where id = project.id
  returning extra_revisions_granted into granted_count;

  return granted_count;
end;
$$;

revoke all on function public.grant_extra_project_revision(uuid) from public;
grant execute on function public.grant_extra_project_revision(uuid)
  to authenticated;

create or replace function public.validate_project_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() = old.seller_id then
    if new.revision_limit is distinct from old.revision_limit
      or new.revision_count is distinct from old.revision_count then
      raise exception 'Only the project workflow can change revision counts';
    end if;

    if new.extra_revisions_granted is distinct from old.extra_revisions_granted then
      if old.status <> 'revision'
        or old.delivery_url is null
        or old.revision_request is not null
        or old.revision_count <
          old.revision_limit + old.extra_revisions_granted
        or new.extra_revisions_granted <> old.extra_revisions_granted + 1
        or new.status is distinct from old.status
        or new.delivery_url is distinct from old.delivery_url
        or new.revision_request is distinct from old.revision_request then
        raise exception 'An extra revision must be granted after manual agreement';
      end if;
    elsif old.status = 'completed'
      or new.status <> 'revision'
      or new.delivery_url is null
      or new.revision_request is not null
      or (
        new.delivery_url is not distinct from old.delivery_url
        and old.revision_request is null
      ) then
      raise exception 'Sellers must submit an updated delivery for an active project';
    end if;
  elsif auth.uid() = old.buyer_id then
    if new.revision_limit is distinct from old.revision_limit
      or new.extra_revisions_granted is distinct from old.extra_revisions_granted
      or new.delivery_url is distinct from old.delivery_url then
      raise exception 'Only the seller can change project delivery or revision terms';
    end if;

    if new.status = 'completed' then
      if old.status <> 'revision'
        or old.delivery_url is null
        or old.revision_request is not null
        or new.revision_request is not null
        or new.revision_count is distinct from old.revision_count then
        raise exception 'A project can only be completed after reviewing delivery';
      end if;
    elsif new.status = 'revision' then
      if old.status <> 'revision'
        or old.delivery_url is null
        or old.revision_request is not null
        or new.revision_request is null
        or char_length(btrim(new.revision_request)) not between 5 and 1000
        or new.revision_count is distinct from old.revision_count then
        raise exception 'Buyers can request one revision after reviewing a delivery';
      end if;
      if old.revision_count >=
        old.revision_limit + old.extra_revisions_granted then
        raise exception 'Revision limit reached; contact the seller to agree on an extra revision';
      end if;

      new.revision_count := old.revision_count + 1;
    else
      raise exception 'Buyers can only request a revision or complete a project';
    end if;
  else
    raise exception 'Only project participants can update this project';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

notify pgrst, 'reload schema';
