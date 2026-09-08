-- Lane core schema. Canonical item + N channel listings. No marketplace passwords.

create table if not exists user_settings (
  user_id text primary key,
  plan text not null default 'starter',
  ai_pack boolean not null default false,
  onboarding_step int not null default 0,
  onboarding_complete boolean not null default false,
  extension_enabled boolean not null default false,
  extension_awake boolean not null default true,
  actions_used_month int not null default 0,
  actions_month text,
  billing_status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists marketplace_accounts (
  id text primary key,
  user_id text not null,
  marketplace text not null,
  mode text not null,
  label text not null,
  remote_user_id text,
  remote_username text,
  status text not null default 'green',
  last_heartbeat_at timestamptz,
  last_error text,
  consecutive_errors int not null default 0,
  max_publishes_per_hour int not null default 30,
  publishes_this_hour int not null default 0,
  hour_window_start timestamptz,
  oauth_connected boolean not null default false,
  sandbox boolean not null default true,
  force_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketplace_accounts_user_idx on marketplace_accounts (user_id);

create table if not exists items (
  id text primary key,
  user_id text not null,
  sku text,
  title text not null,
  description text not null default '',
  brand text,
  category_canonical text,
  condition text not null default 'good',
  size_uk text,
  size_eu text,
  size_us text,
  colour text,
  material text,
  gender text,
  era text,
  cost_price_gbp numeric,
  base_price_gbp numeric not null,
  quantity int not null default 1,
  weight_g int,
  length_cm numeric,
  width_cm numeric,
  height_cm numeric,
  postage_profile_id text,
  notes text,
  status text not null default 'draft',
  sold_channel text,
  sold_price_gbp numeric,
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists items_user_idx on items (user_id);
create index if not exists items_user_status_idx on items (user_id, status);

create table if not exists item_tags (
  item_id text not null,
  user_id text not null,
  tag text not null,
  primary key (item_id, tag)
);

create table if not exists item_photos (
  id text primary key,
  item_id text not null,
  user_id text not null,
  url text not null,
  sort_order int not null default 0,
  is_primary boolean not null default false,
  phash text,
  created_at timestamptz not null default now()
);
create index if not exists item_photos_item_idx on item_photos (item_id);

create table if not exists channel_listings (
  id text primary key,
  item_id text not null,
  user_id text not null,
  marketplace text not null,
  marketplace_account_id text not null,
  remote_id text,
  url text,
  mapped_category text,
  mapped_category_id text,
  channel_price_gbp numeric,
  channel_shipping_gbp numeric,
  remote_status text not null default 'draft',
  last_synced_at timestamptz,
  last_error text,
  quantity_on_channel int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists channel_listings_item_idx on channel_listings (item_id);
create index if not exists channel_listings_user_idx on channel_listings (user_id);
create index if not exists channel_listings_account_idx on channel_listings (marketplace_account_id);

create table if not exists remote_listings (
  id text primary key,
  user_id text not null,
  account_id text not null,
  marketplace text not null,
  remote_id text not null,
  url text,
  title text not null,
  description text,
  price_gbp numeric not null,
  quantity int not null default 1,
  status text not null default 'live',
  photo_url text,
  category_name text,
  brand text,
  size_label text,
  colour text,
  condition_label text,
  phash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists remote_listings_account_idx on remote_listings (account_id);

create table if not exists jobs (
  id text primary key,
  user_id text not null,
  type text not null,
  status text not null,
  marketplace text,
  account_id text,
  item_id text,
  channel_listing_id text,
  request_id text not null,
  attempt int not null default 0,
  max_attempts int not null default 5,
  payload text not null default '{}',
  result text,
  error_message text,
  error_body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index if not exists jobs_user_idx on jobs (user_id, created_at desc);
create index if not exists jobs_status_idx on jobs (user_id, status);

create table if not exists templates (
  id text primary key,
  user_id text not null,
  name text not null,
  payload text not null,
  created_at timestamptz not null default now()
);

create table if not exists pricing_rules (
  id text primary key,
  user_id text not null,
  marketplace text not null,
  kind text not null,
  amount numeric,
  undercut_marketplace text,
  created_at timestamptz not null default now()
);

create table if not exists shipping_profiles (
  id text primary key,
  user_id text not null,
  name text not null,
  marketplace text,
  carrier text not null,
  service text not null,
  package_type text not null,
  buyer_pays boolean not null default true,
  price_gbp numeric not null default 0,
  collection boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists sales (
  id text primary key,
  user_id text not null,
  item_id text not null,
  marketplace text not null,
  account_id text,
  sold_price_gbp numeric not null,
  fees_gbp numeric,
  net_gbp numeric,
  quantity int not null default 1,
  detected_via text not null,
  created_at timestamptz not null default now()
);
create index if not exists sales_user_idx on sales (user_id, created_at desc);
