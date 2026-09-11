-- New child writes cannot race deletion and leave orphaned operational records.
-- NOT VALID preserves existing data; audit legacy orphans before VALIDATE CONSTRAINT.
create unique index if not exists items_owner_id_unique on items(user_id,id);
do $$
declare child text; constraint_name text;
begin
  foreach child in array array['item_photos','item_tags','channel_listings','jobs','sales','listing_snapshots'] loop
    constraint_name := child || '_owner_item_fk';
    if not exists(select 1 from pg_constraint where conname=constraint_name and conrelid=child::regclass) then
      execute format('alter table %I add constraint %I foreign key(user_id,item_id) references items(user_id,id) on delete restrict not valid',child,constraint_name);
    end if;
  end loop;
end $$;
