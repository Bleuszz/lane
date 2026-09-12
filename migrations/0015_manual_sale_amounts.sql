-- Preserve what was entered at sale time; do not invent historical costs.
alter table sales add column if not exists reference text;
alter table sales add column if not exists amounts_basis text not null default 'estimated';
alter table sales add column if not exists cost_total_gbp numeric;
