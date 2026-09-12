-- Each distinct sale keeps a follow-up even while another channel job is running.
-- The sales event constraint still deduplicates delivery; channel leases serialize
-- execution. Existing jobs are preserved, with no automatic replay or data rewrite.
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
    jsonb_build_array('sale', p_sale, c.id)::text
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
