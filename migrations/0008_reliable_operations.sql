-- A job is durable intent. A lease grants one executor temporary ownership;
-- remote success must be reconciled before replaying an interrupted create.
alter table jobs add column if not exists idempotency_key text;
alter table jobs add column if not exists lease_token text;
alter table jobs add column if not exists lease_expires_at timestamptz;
alter table jobs add column if not exists retry_after timestamptz;
alter table jobs add column if not exists hourly_reserved boolean not null default false;
alter table jobs add column if not exists needs_reconciliation boolean not null default false;
-- Migrate pre-lease jobs without replaying multiple copies of the same intent.
with duplicates as (
  select id, row_number() over (partition by user_id, type, account_id, item_id,
    case when item_id is null then channel_listing_id else null end order by created_at, id) as position
  from jobs where status in ('queued', 'waiting_for_browser', 'uploading_photos', 'creating', 'running', 'error')
) update jobs set status = 'dead', needs_reconciliation = true,
  error_message = 'Duplicate legacy intent. Check the marketplace before creating another listing.'
  where id in (select id from duplicates where position > 1);
update jobs set idempotency_key = jsonb_build_array(type, account_id, item_id,
  case when item_id is null then channel_listing_id else null end)::text
  where idempotency_key is null and status in ('queued', 'waiting_for_browser', 'uploading_photos', 'creating', 'running', 'error');
create unique index if not exists jobs_active_intent_unique
  on jobs (user_id, idempotency_key)
  where idempotency_key is not null and status in
    ('queued', 'waiting_for_browser', 'uploading_photos', 'creating', 'running', 'error');
create index if not exists jobs_lease_expiry_idx on jobs (lease_expires_at)
  where lease_token is not null;
create unique index if not exists jobs_channel_lease_unique on jobs (user_id, channel_listing_id)
  where lease_token is not null and channel_listing_id is not null;
alter table marketplace_accounts add column if not exists connector_settings jsonb not null default '{}';
alter table sales add column if not exists remote_event_key text;
create unique index if not exists sales_event_unique on sales (user_id, remote_event_key)
  where remote_event_key is not null;

-- Each invocation is one transaction, including the delist outbox. A crash
-- cannot commit inventory depletion without committing the delist intent.
create or replace function lane_record_sale(
  p_user text, p_item text, p_channel text, p_marketplace text, p_account text,
  p_sale text, p_event text, p_price numeric, p_fee numeric, p_net numeric,
  p_via text, p_quantity integer
) returns boolean language plpgsql as $$
declare inventory items%rowtype; remaining integer; inserted integer;
begin
  select * into inventory from items where id = p_item and user_id = p_user for update;
  if not found then raise exception 'Item not found'; end if;
  if p_quantity < 1 then raise exception 'Sold quantity must be positive'; end if;
  if inventory.quantity < p_quantity or inventory.status in ('sold', 'archived') then return false; end if;
  if p_channel is not null and not exists (
    select 1 from channel_listings where id = p_channel and item_id = p_item and user_id = p_user
      and marketplace = p_marketplace and marketplace_account_id = p_account
  ) then raise exception 'Sale channel does not belong to this item'; end if;
  insert into sales (id, user_id, item_id, marketplace, account_id, sold_price_gbp, fees_gbp,
    net_gbp, quantity, detected_via, remote_event_key)
  values (p_sale, p_user, p_item, p_marketplace, p_account, p_price, p_fee, p_net, p_quantity, p_via, p_event)
  on conflict (user_id, remote_event_key) where remote_event_key is not null do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return false; end if;
  remaining := inventory.quantity - p_quantity;
  update items set quantity = remaining,
    status = case when remaining = 0 then 'sold' else status end,
    sold_channel = case when remaining = 0 then p_marketplace else sold_channel end,
    sold_price_gbp = case when remaining = 0 then p_price else sold_price_gbp end,
    sold_at = case when remaining = 0 then now() else sold_at end, updated_at = now()
  where id = p_item and user_id = p_user;
  update channel_listings set quantity_on_channel = greatest(0, quantity_on_channel - p_quantity),
    remote_status = case when quantity_on_channel <= p_quantity then 'sold' else remote_status end,
    last_synced_at = now(), updated_at = now() where id = p_channel and user_id = p_user;
  update remote_listings set quantity = greatest(0, quantity - p_quantity),
    status = case when quantity <= p_quantity then 'sold' else status end, updated_at = now()
    where user_id = p_user and account_id = p_account
      and remote_id = (select remote_id from channel_listings where id = p_channel and user_id = p_user);
  insert into jobs (id, user_id, type, status, marketplace, account_id, item_id, channel_listing_id,
    request_id, idempotency_key)
  select p_sale || ':' || c.id, p_user, case when remaining = 0 then 'delist' else 'update' end,
    case when a.mode = 'oauth' then 'queued' else 'waiting_for_browser' end,
    c.marketplace, c.marketplace_account_id, p_item, c.id, p_sale || ':' || c.id,
    jsonb_build_array(case when remaining = 0 then 'delist' else 'update' end, c.marketplace_account_id, p_item, null)::text
  from channel_listings c join marketplace_accounts a on a.id = c.marketplace_account_id and a.user_id = c.user_id
  where c.user_id = p_user and c.item_id = p_item and (p_channel is null or c.id <> p_channel)
    and c.remote_status in ('live', 'queued', 'waiting_for_browser', 'error')
    and (remaining = 0 or c.marketplace = 'ebay_uk')
  on conflict (user_id, idempotency_key) where idempotency_key is not null and status in
    ('queued', 'waiting_for_browser', 'uploading_photos', 'creating', 'running', 'error')
  do nothing;
  return true;
end;
$$;
