create table if not exists desktop_pairings (
 id text primary key, challenge text not null, device_id text not null, code_hash text not null,
 user_id text, expires_at timestamptz not null default now()+interval '10 minutes', consumed_at timestamptz
);
create table if not exists desktop_devices (
 id text primary key, user_id text not null, label text not null default 'Lane Desktop',
 refresh_hash text not null unique, refresh_expires_at timestamptz not null,
 access_hash text unique, access_expires_at timestamptz,
 version text, last_seen_at timestamptz, capabilities jsonb not null default '{}'::jsonb,
 revoked_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists desktop_devices_user_idx on desktop_devices(user_id);
