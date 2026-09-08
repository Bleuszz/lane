-- Live adapters: store real OAuth tokens (encrypted at app layer) and the Lane Bridge pairing secret.
-- No marketplace passwords.

alter table marketplace_accounts add column if not exists oauth_access_token text;
alter table marketplace_accounts add column if not exists oauth_refresh_token text;
alter table marketplace_accounts add column if not exists oauth_expires_at timestamptz;
alter table marketplace_accounts add column if not exists merchant_location_key text;
alter table marketplace_accounts alter column sandbox set default false;

alter table user_settings add column if not exists extension_pairing_token text;

alter table channel_listings add column if not exists ebay_offer_id text;
alter table channel_listings add column if not exists ebay_sku text;

alter table jobs add column if not exists claimed_at timestamptz;
alter table jobs add column if not exists claimed_by text;
