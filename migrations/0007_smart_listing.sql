alter table items add column if not exists ebay_aspects jsonb not null default '{}';
alter table remote_listings add column if not exists photo_urls jsonb not null default '[]';
alter table user_settings add column if not exists ai_autofill_enabled boolean not null default false;
create table if not exists ai_credit_usage (
  user_id text not null,
  month text not null,
  used int not null default 0 check (used >= 0),
  attempts int not null default 0 check (attempts >= 0),
  primary key (user_id, month)
);

alter table ai_credit_usage add column if not exists attempts int not null default 0;
