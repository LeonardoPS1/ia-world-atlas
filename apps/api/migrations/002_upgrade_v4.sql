-- Upgrade path from the legacy V4 schema (apps/api/sql/001_schema.sql + 002_seed.sql).
-- Every statement is guarded, so on a database produced by 001_core.sql this is a no-op.

create extension if not exists postgis;

create table if not exists sources (
  id               text primary key,
  name             text not null,
  url              text not null check (url ~ '^https?://'),
  source_type      text not null
                     check (source_type in ('GOVERNMENT','UNIVERSITY','ORGANIZATION','COMPANY','PAPER','MEDIA','OTHER')),
  publication_date date,
  last_verified_at timestamptz not null,
  confidence       text not null check (confidence in ('HIGH','MEDIUM','LOW')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table locations add column if not exists country_code char(2);
alter table locations add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table locations add column if not exists created_at timestamptz not null default now();
alter table locations add column if not exists updated_at timestamptz not null default now();

alter table projects add column if not exists sector text;
alter table projects add column if not exists impact text;
alter table projects add column if not exists tags text[] not null default '{}';
alter table projects add column if not exists last_verified_at timestamptz not null default now();
alter table projects add column if not exists created_at timestamptz not null default now();
alter table projects add column if not exists updated_at timestamptz not null default now();

create table if not exists project_sources (
  project_id text not null references projects(id) on delete cascade,
  source_id  text not null references sources(id) on delete restrict,
  snippet    text not null,
  is_primary boolean not null default false,
  primary key (project_id, source_id)
);

create table if not exists status_history (
  id          bigserial primary key,
  project_id  text not null references projects(id) on delete cascade,
  from_status text,
  to_status   text not null,
  changed_at  timestamptz not null,
  note        text,
  source_id   text references sources(id) on delete set null
);

create table if not exists impact_records (
  id          bigserial primary key,
  project_id  text not null references projects(id) on delete cascade,
  category    text not null,
  description text not null,
  source_id   text references sources(id) on delete set null
);

alter table events add column if not exists kind text not null default 'DOCUMENTED';
alter table events add column if not exists description text not null default '';
alter table events add column if not exists source_id text references sources(id) on delete set null;

alter table relations add column if not exists id text;
alter table relations add column if not exists description text not null default '';
alter table relations add column if not exists source_id text references sources(id) on delete set null;
update relations set id = from_project || '->' || to_project || ':' || type where id is null;

-- The primary key is added only when the table has none. A fresh 001_core.sql already
-- creates relations with a primary key, so an unconditional `add constraint` would
-- abort the whole migration on a clean database instead of being a no-op.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conrelid = 'relations'::regclass and contype = 'p'
  ) then
    execute 'alter table relations alter column id set not null';
    execute 'alter table relations add constraint relations_pkey primary key (id)';
  end if;
end $$;

create unique index if not exists relations_from_to_type_key
  on relations (from_project, to_project, type);

-- Reject legacy rows that fall outside the closed vocabularies, and report the counts.
do $$
declare
  dropped_type     integer;
  dropped_status   integer;
  dropped_evidence integer;
begin
  delete from projects where type not in (
    'PROJECT','NEWS','LAUNCH','COMPANY','GOVERNMENT','UNIVERSITY','RESEARCH','INFRASTRUCTURE',
    'ROBOTICS','POLICY','INVESTMENT','EDUCATION','APPLICATION','IMPACT','SIGNAL','POSSIBILITY');
  get diagnostics dropped_type = row_count;

  delete from projects where status not in (
    'IDEA','RESEARCH','ANNOUNCED','FUNDED','PILOT','BUILDING','DEPLOYING','ACTIVE','SCALING',
    'COMPLETED','PAUSED','CANCELLED');
  get diagnostics dropped_status = row_count;

  delete from projects where evidence not in (
    'VERIFIED','REPORTED','ANNOUNCED','ANALYSIS','SIGNAL','POSSIBILITY');
  get diagnostics dropped_evidence = row_count;

  raise notice '002_upgrade_v4: dropped % projects with invalid type, % with invalid status, % with invalid evidence',
    dropped_type, dropped_status, dropped_evidence;
end;
$$;
