-- No historic stock is changed and no poller is enabled by this migration.
create unique index if not exists marketplace_accounts_owner_id_idx on marketplace_accounts(user_id,id);
create table if not exists ebay_order_sync (
  user_id text not null, account_id text not null, environment text not null,
  started_at timestamptz not null default now(), cursor_at timestamptz not null default now(),
  window_to timestamptz, page_offset integer not null default 0,
  lease_token text, lease_until timestamptz, next_poll_at timestamptz not null default now(),
  last_success_at timestamptz, last_error text,
  primary key(user_id,account_id,environment),
  foreign key(user_id,account_id) references marketplace_accounts(user_id,id) on delete restrict,
  check(environment in ('sandbox','production')), check(page_offset>=0)
);
-- Deliberately store no buyer identity, address, payment details or raw order JSON.
create table if not exists ebay_order_events (
  user_id text not null, account_id text not null, environment text not null,
  line_id text not null, order_id text not null, listing_id text not null,
  quantity integer, item_amount_gbp numeric, order_created_at timestamptz,
  outcome text not null, reason text, observed_at timestamptz not null default now(),
  primary key(user_id,account_id,environment,line_id),
  foreign key(user_id,account_id,environment) references ebay_order_sync(user_id,account_id,environment) on delete restrict
);
