-- Immutable, owner-scoped content revisions shared by identical queued actions.
-- Retention must preserve any snapshot referenced by a queued/retryable job.
create table if not exists listing_snapshots (
  id text primary key,
  user_id text not null,
  item_id text not null,
  content jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists listing_snapshots_owner_item on listing_snapshots(user_id,item_id);
