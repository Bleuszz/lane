alter table user_settings add column if not exists trial_ends_at timestamptz;
alter table user_settings add column if not exists trial_started_at timestamptz;
