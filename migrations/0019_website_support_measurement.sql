create table if not exists support_requests (
  id text primary key,
  user_id text not null references user_settings(user_id) on delete cascade,
  topic text not null check (topic in ('account','desktop','privacy','other')),
  message text not null check (char_length(message) between 20 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists support_requests_user_created on support_requests(user_id,created_at);
-- Aggregate consented events only. No user, device, IP, URL, referrer or session identifiers.
create table if not exists website_daily_events (
  day date not null default current_date,
  event text not null check (event in ('page_view','signup_started','signup_completed','login_completed','trial_started','download_clicked','desktop_device_approval_started','desktop_device_approved','pricing_viewed','upgrade_clicked','contact_submitted')),
  total bigint not null default 0,
  primary key(day,event)
);
