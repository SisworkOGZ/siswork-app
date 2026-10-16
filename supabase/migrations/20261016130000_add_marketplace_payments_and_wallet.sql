alter table public.projects
  add column payment_status text not null default 'unpaid'
    check (payment_status in ('not_required', 'unpaid', 'pending', 'paid', 'failed', 'refunded'));

alter table public.projects disable trigger projects_validate_update;
update public.projects
set payment_status = 'not_required';
alter table public.projects enable trigger projects_validate_update;

create table public.project_payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null default 'midtrans' check (provider = 'midtrans'),
  order_id text not null unique,
  idempotency_key uuid not null,
  amount bigint not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded')),
  snap_token text,
  redirect_url text,
  provider_transaction_id text,
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (buyer_id, idempotency_key)
);

create unique index project_payments_one_open_payment_per_project_idx
  on public.project_payments (project_id)
  where status in ('pending', 'paid');
create index project_payments_buyer_created_idx
  on public.project_payments (buyer_id, created_at desc);

alter table public.project_payments enable row level security;
revoke all on public.project_payments from public, anon, authenticated;
grant select on public.project_payments to authenticated;

create policy "Project participants can view their payment status"
  on public.project_payments
  for select
  to authenticated
  using (
    auth.uid() in (buyer_id, seller_id)
    and exists (
      select 1
      from public.projects p
      where p.id = project_payments.project_id
        and p.school_id = (select public.current_user_school_id())
    )
  );

create table public.seller_withdrawals (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  amount bigint not null check (amount > 0),
  provider text not null check (provider in ('DANA', 'OVO', 'GoPay', 'ShopeePay')),
  account_number text not null check (account_number ~ '^(0[0-9]{9,12}|62[0-9]{9,12})$'),
  recipient_name text not null check (char_length(btrim(recipient_name)) between 1 and 200),
  provider_reference text,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  failure_reason text,
  idempotency_key uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (seller_id, idempotency_key)
);

create index seller_withdrawals_seller_created_idx
  on public.seller_withdrawals (seller_id, created_at desc);
create index seller_withdrawals_provider_reference_idx
  on public.seller_withdrawals (provider, provider_reference)
  where provider_reference is not null;

alter table public.seller_withdrawals enable row level security;
revoke all on public.seller_withdrawals from public, anon, authenticated;
grant select on public.seller_withdrawals to authenticated;

create policy "Sellers can view their own withdrawals"
  on public.seller_withdrawals
  for select
  to authenticated
  using (seller_id = (select auth.uid()));

create table public.seller_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  amount bigint not null check (amount <> 0),
  project_id uuid references public.projects (id) on delete restrict,
  payment_id uuid references public.project_payments (id) on delete restrict,
  withdrawal_id uuid references public.seller_withdrawals (id) on delete restrict,
  reversal_of uuid references public.seller_wallet_transactions (id) on delete restrict,
  description text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint seller_wallet_transaction_source_check
    check (num_nonnulls(project_id, payment_id, withdrawal_id, reversal_of) = 1)
);

create unique index seller_wallet_project_credit_idx
  on public.seller_wallet_transactions (project_id)
  where project_id is not null;
create unique index seller_wallet_withdrawal_debit_idx
  on public.seller_wallet_transactions (withdrawal_id)
  where withdrawal_id is not null;
create unique index seller_wallet_payment_refund_idx
  on public.seller_wallet_transactions (payment_id)
  where payment_id is not null;
create unique index seller_wallet_reversal_idx
  on public.seller_wallet_transactions (reversal_of)
  where reversal_of is not null;
create index seller_wallet_transactions_seller_created_idx
  on public.seller_wallet_transactions (seller_id, created_at desc);

alter table public.seller_wallet_transactions enable row level security;
revoke all on public.seller_wallet_transactions from public, anon, authenticated;
grant select on public.seller_wallet_transactions to authenticated;

create policy "Sellers can view their own wallet transactions"
  on public.seller_wallet_transactions
  for select
  to authenticated
  using (seller_id = (select auth.uid()));

create function public.enforce_paid_project_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() = old.seller_id
    and new.status = 'revision'
    and new.delivery_url is not null
    and new.payment_status not in ('paid', 'not_required') then
    raise exception 'Buyer must pay for the project before delivery';
  end if;

  if new.status = 'completed'
    and old.status is distinct from 'completed'
    and new.payment_status not in ('paid', 'not_required') then
    raise exception 'Buyer must pay for the project before completing it';
  end if;

  if new.status = 'completed'
    and old.status is distinct from 'completed'
    and new.payment_status = 'paid' then
    insert into public.seller_wallet_transactions (
      seller_id, amount, project_id, description
    )
    values (
      new.seller_id,
      trunc(new.amount)::bigint,
      new.id,
      'Penghasilan proyek selesai: ' || new.title
    )
    on conflict (project_id) where project_id is not null do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_paid_project_completion() from public, anon, authenticated;

create trigger projects_enforce_paid_completion
  before update on public.projects
  for each row
  execute function public.enforce_paid_project_completion();

create function public.reserve_seller_withdrawal(
  p_seller_id uuid,
  p_amount bigint,
  p_idempotency_key uuid
)
returns public.seller_withdrawals
language plpgsql
security definer
set search_path = ''
as $$
declare
  seller_profile public.profiles%rowtype;
  payout_account public.seller_payout_accounts%rowtype;
  existing_withdrawal public.seller_withdrawals%rowtype;
  available_balance bigint;
  new_withdrawal public.seller_withdrawals%rowtype;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Jumlah penarikan harus lebih besar dari nol';
  end if;

  select * into existing_withdrawal
  from public.seller_withdrawals
  where seller_id = p_seller_id
    and idempotency_key = p_idempotency_key;
  if found then
    return existing_withdrawal;
  end if;

  select * into seller_profile
  from public.profiles
  where id = p_seller_id
  for update;
  if not found or not seller_profile.is_seller then
    raise exception 'Akun seller tidak ditemukan';
  end if;

  if exists (
    select 1
    from public.seller_withdrawals
    where seller_id = p_seller_id
      and status = 'processing'
  ) then
    raise exception 'Penarikan sebelumnya masih diproses';
  end if;

  select * into payout_account
  from public.seller_payout_accounts
  where user_id = p_seller_id;
  if not found then
    raise exception 'Tambahkan akun e-wallet pada profil seller terlebih dahulu';
  end if;

  if payout_account.account_number !~ '^(0[0-9]{9,12}|62[0-9]{9,12})$' then
    raise exception 'Nomor e-wallet harus berupa nomor ponsel Indonesia yang valid';
  end if;

  select coalesce(sum(amount), 0)::bigint into available_balance
  from public.seller_wallet_transactions
  where seller_id = p_seller_id;
  if p_amount > available_balance then
    raise exception 'Saldo tersedia tidak mencukupi';
  end if;

  insert into public.seller_withdrawals (
    seller_id, amount, provider, account_number, recipient_name, idempotency_key
  )
  values (
    p_seller_id,
    p_amount,
    payout_account.provider,
    payout_account.account_number,
    seller_profile.full_name,
    p_idempotency_key
  )
  returning * into new_withdrawal;

  insert into public.seller_wallet_transactions (
    seller_id, amount, withdrawal_id, description
  )
  values (
    p_seller_id,
    -p_amount,
    new_withdrawal.id,
    'Penarikan saldo ke ' || payout_account.provider
  );

  return new_withdrawal;
end;
$$;

revoke all on function public.reserve_seller_withdrawal(uuid, bigint, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_seller_withdrawal(uuid, bigint, uuid)
  to service_role;

create function public.update_seller_withdrawal(
  p_withdrawal_id uuid,
  p_provider_reference text,
  p_status text,
  p_failure_reason text default null
)
returns public.seller_withdrawals
language plpgsql
security definer
set search_path = ''
as $$
declare
  withdrawal public.seller_withdrawals%rowtype;
  updated_withdrawal public.seller_withdrawals%rowtype;
  debit_entry public.seller_wallet_transactions%rowtype;
begin
  if p_status not in ('processing', 'completed', 'failed') then
    raise exception 'Status penarikan tidak valid';
  end if;

  select * into withdrawal
  from public.seller_withdrawals
  where id = p_withdrawal_id
  for update;
  if not found then
    raise exception 'Permintaan penarikan tidak ditemukan';
  end if;

  if withdrawal.status = 'completed' or withdrawal.status = 'failed' then
    return withdrawal;
  end if;

  update public.seller_withdrawals
  set provider_reference = coalesce(p_provider_reference, provider_reference),
      status = p_status,
      failure_reason = case
        when p_status = 'failed' then left(coalesce(p_failure_reason, 'Payout gagal'), 300)
        else null
      end,
      updated_at = timezone('utc', now())
  where id = p_withdrawal_id
  returning * into updated_withdrawal;

  if p_status = 'failed' then
    select * into debit_entry
    from public.seller_wallet_transactions
    where withdrawal_id = p_withdrawal_id;

    if found then
      insert into public.seller_wallet_transactions (
        seller_id, amount, reversal_of, description
      )
      values (
        withdrawal.seller_id,
        withdrawal.amount,
        debit_entry.id,
        'Pengembalian saldo karena penarikan gagal'
      )
      on conflict (reversal_of) where reversal_of is not null do nothing;
    end if;
  end if;

  return updated_withdrawal;
end;
$$;

revoke all on function public.update_seller_withdrawal(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.update_seller_withdrawal(uuid, text, text, text)
  to service_role;
