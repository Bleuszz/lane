-- Phone connect sessions, Stripe customer ids, keep vinted tokens on marketplace_accounts.oauth_*.

alter table user_settings add column if not exists stripe_customer_id text;
alter table user_settings add column if not exists stripe_subscription_id text;

create table if not exists vinted_connect_sessions (
  id text primary key,
  user_id text not null,
  secret text not null,
  status text not null default 'pending',
  account_id text,
  error text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz
);
create index if not exists vinted_connect_sessions_user_idx on vinted_connect_sessions (user_id);
