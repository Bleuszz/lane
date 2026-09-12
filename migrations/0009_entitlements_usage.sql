alter table user_settings add column if not exists trial_actions_used integer not null default 0 check (trial_actions_used >= 0);
alter table user_settings alter column billing_status set default 'trialing';
alter table user_settings alter column trial_started_at set default now();
alter table user_settings alter column trial_ends_at set default (now() + interval '7 days');
-- Preserve the original trial clock; a migration must never restart expired access.
update user_settings set billing_status = 'trialing',
  trial_started_at = coalesce(trial_started_at, created_at),
  trial_ends_at = coalesce(trial_ends_at, coalesce(trial_started_at, created_at) + interval '7 days')
where billing_status = 'active' and stripe_subscription_id is null;
update user_settings set trial_started_at = coalesce(trial_started_at, created_at),
  trial_ends_at = coalesce(trial_ends_at, coalesce(trial_started_at, created_at) + interval '7 days')
where billing_status = 'trialing';

create table if not exists listing_action_usage (
  request_id text primary key, user_id text not null, action_type text not null check(action_type in ('publish','relist')),
  entitlement text not null, month text not null, created_at timestamptz not null default now()
);
-- Row lock + idempotency key protects concurrent workers and job retries.
create or replace function lane_reserve_listing_action(p_user text, p_request text, p_type text)
returns boolean language plpgsql as $$
declare s user_settings%rowtype; lim integer; current_month text := to_char(now() at time zone 'UTC', 'YYYY-MM');
begin
  if p_type not in ('publish','relist') then raise exception 'Unsupported billable action'; end if;
  select * into s from user_settings where user_id = p_user for update;
  if not found then return false; end if;
  if not (s.billing_status = 'active' or (s.billing_status = 'trialing' and s.trial_ends_at > now())) then return false; end if;
  if exists(select 1 from listing_action_usage where request_id = p_request and user_id = p_user and action_type = p_type) then return true; end if;
  if s.billing_status = 'trialing' and s.trial_ends_at > now() and s.trial_actions_used < 25 then
    update user_settings set trial_actions_used = trial_actions_used + 1 where user_id = p_user;
  elsif s.billing_status = 'active' then
    lim := case s.plan when 'pro' then 2000 when 'seller' then 600 else 150 end;
    if s.actions_month = current_month and s.actions_used_month >= lim then return false; end if;
    update user_settings set actions_used_month = case when actions_month = current_month then actions_used_month + 1 else 1 end,
      actions_month = current_month where user_id = p_user;
  else return false;
  end if;
  insert into listing_action_usage(request_id,user_id,action_type,entitlement,month)
    values(p_request,p_user,p_type,s.billing_status,current_month);
  return true;
end $$;

alter table ai_credit_usage add column if not exists budget_used_usd numeric(16,9) not null default 0;
create table if not exists ai_action_ledger (
  id text primary key, user_id text not null, tier text not null,
  request_type text not null check(request_type in ('field_autofill','listing_copy')),
  model text not null, month text not null, created_at timestamptz not null default now(), settled_at timestamptz,
  credits_reserved integer not null default 1, credits_consumed integer not null default 0, credits_restored integer not null default 0,
  status text not null default 'reserved' check(status in ('reserved','consumed','restored')),
  input_tokens integer, output_tokens integer, estimated_token_cost_usd numeric(16,9),
  cost_reserved_usd numeric(16,9) not null default 0.10, budget_charge_usd numeric(16,9) not null default 0.10,
  cost_basis text not null default 'unknown', failure_code text,
  check(credits_reserved = 1 and credits_consumed in (0,1) and credits_restored in (0,1)),
  check(credits_consumed + credits_restored <= credits_reserved)
);
create index if not exists ai_action_ledger_user_month_idx on ai_action_ledger(user_id,month);
create table if not exists activation_events (
  id text primary key, user_id text not null, event_name text not null,
  marketplace text, created_at timestamptz not null default now(), unique(user_id,event_name)
);
