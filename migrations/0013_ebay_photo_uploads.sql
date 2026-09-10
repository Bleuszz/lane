-- Content-addressed receipts only: source bytes remain in the saved listing.
create table if not exists ebay_photo_uploads (
  user_id text not null,
  account_id text not null,
  environment text not null check (environment in ('sandbox','production')),
  content_hash text not null,
  image_url text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key(user_id,account_id,environment,content_hash)
);
