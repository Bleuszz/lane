-- New mock-only domain; legacy AI records remain intact for historical accounting.
create table ai_wallets (
 user_id text not null references user_settings(user_id) on delete cascade, month text not null,
 reserved int not null default 0 check(reserved>=0), consumed int not null default 0 check(consumed>=0),
 primary key(user_id,month)
);
-- Preserve historical used credits during the one-time ledger transition.
insert into ai_wallets(user_id,month,consumed)
 select a.user_id,a.month,a.used from ai_credit_usage a join user_settings u on u.user_id=a.user_id
 on conflict do nothing;
create table ai_batches (
 id text primary key, user_id text not null references user_settings(user_id) on delete cascade,
 request_key text not null, fingerprint text not null, created_at timestamptz not null default now(), unique(user_id,request_key)
);
create table ai_jobs (
 id text primary key, user_id text not null references user_settings(user_id) on delete cascade,
 batch_id text not null references ai_batches(id) on delete cascade, position int not null,
 item_id text not null, source_photo_id text, operation text not null, provider text not null, model text not null,
 tier text not null, month text not null, credit_cost int not null check(credit_cost>=0),
 status text not null check(status in ('QUEUED','RESERVED','PROCESSING','SUCCEEDED','FAILED','CANCELLED','REFUNDED')),
 input jsonb not null, settings jsonb not null, mock_mode text not null, mock boolean not null default true,
 lease_token text, expires_at timestamptz not null, error_code text, created_at timestamptz not null default now(), finished_at timestamptz,
 unique(batch_id,position), unique(id,user_id)
);
create index ai_jobs_owner_idx on ai_jobs(user_id,created_at desc);
create table ai_credit_ledger (
 id text primary key, job_id text not null, user_id text not null, month text not null,
 event text not null check(event in ('reserve','consume','refund')), credits int not null check(credits>=0),
 created_at timestamptz not null default now(), unique(job_id,event),
 foreign key(job_id,user_id) references ai_jobs(id,user_id) on delete cascade
);
create table ai_job_events (
 id text primary key, job_id text not null references ai_jobs(id) on delete cascade,
 state text not null, created_at timestamptz not null default now()
);
create table ai_cost_ledger (
 job_id text primary key, user_id text not null, provider text not null, model text not null,
 operation text not null, tier text not null, input_usage numeric, output_usage numeric, images_generated int,
 estimated_cost numeric, actual_cost numeric, currency text, credits_charged int not null default 0,
 created_at timestamptz not null default now(), foreign key(job_id,user_id) references ai_jobs(id,user_id) on delete cascade
);
create table ai_suggestions (
 id text primary key, job_id text not null, user_id text not null, field text not null,
 source_value text, saved_value text, user_value text, suggested_value text, confidence text not null,
 evidence text not null, safe boolean not null, state text not null default 'pending' check(state in ('pending','accepted','rejected')),
 decided_at timestamptz, unique(job_id,field), foreign key(job_id,user_id) references ai_jobs(id,user_id) on delete cascade
);
create table ai_generated_assets (
 id text primary key, job_id text not null, user_id text not null, source_photo_id text not null,
 operation text not null, provider text not null, model text not null, settings jsonb not null,
 status text not null default 'preview' check(status in ('preview','accepted','rejected','deleted')),
 preview_kind text not null, credit_cost int not null, provider_cost numeric,
 created_at timestamptz not null default now(), unique(job_id), foreign key(job_id,user_id) references ai_jobs(id,user_id) on delete cascade
);
-- No image bytes/URLs overwritten. Original IDs are immutable lineage references;
-- deliberately not cascaded when a seller later removes a photo from their listing.
