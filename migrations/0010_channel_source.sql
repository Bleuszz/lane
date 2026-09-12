-- Neutral item record; destination payloads and source evidence are extensible.
alter table items add column if not exists channel_fields jsonb not null default '{}';
update items set channel_fields = jsonb_build_object('ebay_uk', jsonb_build_object('aspects', ebay_aspects))
where channel_fields = '{}'::jsonb and ebay_aspects <> '{}'::jsonb;
-- Keep legacy column for rolling-deploy rollback; new code uses channel_fields.
alter table channel_listings add column if not exists source_data jsonb not null default '{}';
alter table channel_listings add column if not exists destination_data jsonb not null default '{}';
alter table remote_listings add column if not exists source_attributes jsonb not null default '{}';
alter table remote_listings add column if not exists material text;
alter table remote_listings add column if not exists source_category_id text;
alter table remote_listings add column if not exists source_category_path text;
