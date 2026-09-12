-- Separate from legacy jobs: no retained OAuth worker may consume these intents.
create table scheduler_settings(user_id text primary key references user_settings(user_id) on delete cascade,config jsonb not null,paused boolean not null default false,updated_at timestamptz not null default now());
create table scheduler_scopes(user_id text not null references user_settings(user_id) on delete cascade,scope text not null,paused boolean not null default false,reason text,hold_until timestamptz,failures int not null default 0,auth_failures int not null default 0,warnings int not null default 0,completed int not null default 0,next_at timestamptz,primary key(user_id,scope));
create table schedule_batches(id text primary key,user_id text not null references user_settings(user_id) on delete cascade,request_key text not null,fingerprint text not null,mode text not null,paused boolean not null default false,failures int not null default 0,created_at timestamptz not null default now(),unique(user_id,request_key));
create table scheduled_actions(
 id text primary key,user_id text not null references user_settings(user_id) on delete cascade,batch_id text not null references schedule_batches(id) on delete cascade,
 marketplace text not null,account_id text not null,item_id text not null,operation text not null,mode text not null,
 status text not null check(status in('DRAFT','QUEUED','SCHEDULED','WAITING','WAITING_FOR_DEVICE','RUNNING','SUCCEEDED','FAILED','RETRY_WAIT','PAUSED','CANCELLED','REQUIRES_RECONNECT','REQUIRES_USER_ACTION')),
 queued_at timestamptz not null default now(),scheduled_at timestamptz not null,started_at timestamptz,completed_at timestamptz,
 attempt_count int not null default 0,last_error text,remote_id text,idempotency_key text not null,snapshot_hash text not null,
 lease_token text,lease_expires_at timestamptz,expires_at timestamptz not null,unique(id,user_id));
create unique index scheduled_actions_active_intent on scheduled_actions(user_id,account_id,item_id)
 where status not in('SUCCEEDED','FAILED','CANCELLED');
create index scheduled_actions_due on scheduled_actions(user_id,scheduled_at);
create table scheduler_attempts(job_id text not null references scheduled_actions(id) on delete cascade,user_id text not null,account_id text not null,marketplace text not null,attempt int not null,started_at timestamptz not null,primary key(job_id,attempt));
create table scheduler_events(id text primary key,user_id text not null,job_id text,batch_id text,marketplace text,item_id text,operation text,status text not null,attempt int not null default 0,reason text,created_at timestamptz not null default now());
create index scheduler_events_owner on scheduler_events(user_id,created_at desc);
create table scheduler_notifications(id text primary key,user_id text not null,batch_id text,event text not null,job_id text,created_at timestamptz not null default now());
create table image_normalizations(
 id text primary key,user_id text not null references user_settings(user_id) on delete cascade,source_photo_id text not null,derivative_photo_id text not null,
 request_key text not null,fingerprint text not null,source_hash text not null,preset text not null,options jsonb not null,status text not null,
 review text not null default 'pending' check(review in('pending','accepted','rejected','deleted')),
 created_at timestamptz not null default now(),completed_at timestamptz,lease_expires_at timestamptz,
 width int,height int,format text,file_size int,processing_version text,output_data text,last_error text,
 unique(user_id,request_key),unique(derivative_photo_id));

-- The global/account/marketplace pause also guards retained legacy write claims.
-- It does not touch authentication, read operations or an already leased write.
create function lane_guard_legacy_schedule_claim() returns trigger language plpgsql as $$
declare all_paused boolean;
begin
 if new.lease_token is not null and new.lease_token is distinct from old.lease_token then
  select paused into all_paused from scheduler_settings where user_id=new.user_id for update;
  if coalesce(all_paused,false) or exists (
   select 1 from scheduler_scopes where user_id=new.user_id
   and scope in ('account:'||new.account_id,'marketplace:'||new.marketplace)
   and (paused or hold_until>now())
  ) or exists (
   select 1 from scheduled_actions where user_id=new.user_id and account_id=new.account_id
   and item_id=new.item_id and (status not in ('SUCCEEDED','FAILED','CANCELLED')
     or last_error in ('AMBIGUOUS_REMOTE_RESULT','LEASE_EXPIRED'))
  ) then return null; end if;
 end if;
 return new;
end $$;
create trigger lane_legacy_schedule_guard before update on jobs
 for each row execute function lane_guard_legacy_schedule_claim();
