-- Bounded, expiring HMAC keys only. No raw IP addresses, credentials or request content.
create table request_limits (
 key text primary key,
 count integer not null,
 expires_at timestamptz not null
);
create index request_limits_expiry on request_limits(expires_at);
