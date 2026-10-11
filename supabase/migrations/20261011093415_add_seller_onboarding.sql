alter table public.profiles
  add column seller_category text;

create table public.seller_payout_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  provider text not null check (
    provider in ('DANA', 'OVO', 'GoPay', 'ShopeePay')
  ),
  account_number text not null check (
    account_number ~ '^[0-9]{8,20}$'
  ),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.seller_payout_accounts enable row level security;
revoke all on public.seller_payout_accounts from public, anon, authenticated;
grant select, insert, update on public.seller_payout_accounts to authenticated;

create policy "Sellers can view their own payout account"
  on public.seller_payout_accounts
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Sellers can add their own payout account"
  on public.seller_payout_accounts
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Sellers can update their own payout account"
  on public.seller_payout_accounts
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create function public.complete_seller_onboarding(
  p_bio text,
  p_category text,
  p_wallet_provider text,
  p_wallet_number text
)
returns table (is_seller boolean, bio text, seller_category text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_bio text := btrim(coalesce(p_bio, ''));
  normalized_number text := regexp_replace(
    coalesce(p_wallet_number, ''),
    '[^0-9]',
    '',
    'g'
  );
  updated_profile public.profiles%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if char_length(normalized_bio) < 20 or char_length(normalized_bio) > 500 then
    raise exception 'Bio keahlian harus terdiri dari 20 sampai 500 karakter';
  end if;
  if p_category not in ('Desain', 'Website', 'Video', 'Menulis', 'Tutor') then
    raise exception 'Kategori seller tidak valid';
  end if;
  if p_wallet_provider not in ('DANA', 'OVO', 'GoPay', 'ShopeePay') then
    raise exception 'Provider e-wallet tidak valid';
  end if;
  if normalized_number !~ '^[0-9]{8,20}$' then
    raise exception 'Nomor e-wallet harus terdiri dari 8 sampai 20 digit';
  end if;

  update public.profiles p
  set is_seller = true,
      bio = normalized_bio,
      seller_category = p_category
  where p.id = current_user_id
  returning p.* into updated_profile;

  if not found then
    raise exception 'Profil pelajar tidak ditemukan';
  end if;

  insert into public.seller_payout_accounts (
    user_id,
    provider,
    account_number,
    updated_at
  )
  values (
    current_user_id,
    p_wallet_provider,
    normalized_number,
    timezone('utc', now())
  )
  on conflict (user_id)
  do update set
    provider = excluded.provider,
    account_number = excluded.account_number,
    updated_at = excluded.updated_at;

  return query
  select updated_profile.is_seller, updated_profile.bio,
    updated_profile.seller_category;
end;
$$;

revoke all on function public.complete_seller_onboarding(text, text, text, text)
  from public, anon;
grant execute on function public.complete_seller_onboarding(text, text, text, text)
  to authenticated;
