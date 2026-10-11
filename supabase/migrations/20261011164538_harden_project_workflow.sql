create or replace function public.validate_project_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() = old.seller_id then
    if old.status = 'completed'
      or old.status not in ('in_progress', 'revision')
      or new.status <> 'revision'
      or new.delivery_url is null
      or new.revision_request is not null then
      raise exception 'Sellers must submit a delivery link for an active project';
    end if;
  elsif auth.uid() = old.buyer_id then
    if old.status <> 'revision'
      or old.delivery_url is null
      or new.delivery_url is distinct from old.delivery_url then
      raise exception 'Buyers can only review a submitted project delivery';
    end if;

    if new.status = 'completed' then
      if new.revision_request is not null then
        raise exception 'Completed projects cannot have a revision request';
      end if;
    elsif new.status = 'revision' then
      if new.revision_request is null
        or char_length(btrim(new.revision_request)) not between 5 and 1000 then
        raise exception 'Revision requests must contain 5 to 1000 characters';
      end if;
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
