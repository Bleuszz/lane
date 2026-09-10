-- Retain identifiers/outcomes only, never webhook payloads or payment details.
create table if not exists billing_webhook_events (
  event_id text primary key,
  event_type text not null,
  outcome text not null default 'processing',
  processed_at timestamptz not null default now()
);
create table if not exists billing_subscription_locks (
  subscription_id text primary key
);
-- One Stripe customer/subscription must never grant access to multiple Lane users.
create unique index if not exists user_settings_stripe_customer_unique
  on user_settings(stripe_customer_id) where stripe_customer_id is not null;
create unique index if not exists user_settings_stripe_subscription_unique
  on user_settings(stripe_subscription_id) where stripe_subscription_id is not null;
