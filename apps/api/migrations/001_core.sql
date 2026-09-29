-- AI World Atlas — final core schema. Idempotent by design: applying it to a
-- partially migrated database converges to the target state.

create extension if not exists postgis;

create table if not exists locations (
  id           text primary key,
  name         text not null,
  level        text not null
                 check (level in ('WORLD','CONTINENT','COUNTRY','REGION','CITY','LOCAL_AREA')),
  parent_id    text references locations(id) on delete set null,
  country_code char(2),
  geography    geography(Point,4326) not null,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists sources (
  id                text primary key,
  name              text not null,
  url               text not null check (url ~ '^https?://'),
  source_type       text not null
                      check (source_type in ('GOVERNMENT','UNIVERSITY','ORGANIZATION','COMPANY','PAPER','MEDIA','OTHER')),
  publication_date  date,
  last_verified_at  timestamptz not null,
  confidence        text not null check (confidence in ('HIGH','MEDIUM','LOW')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists projects (
  id                 text primary key,
  name               text not null,
  type               text not null
                       check (type in ('PROJECT','NEWS','LAUNCH','COMPANY','GOVERNMENT','UNIVERSITY',
                                       'RESEARCH','INFRASTRUCTURE','ROBOTICS','POLICY','INVESTMENT',
                                       'EDUCATION','APPLICATION','IMPACT','SIGNAL','POSSIBILITY')),
  status             text not null
                       check (status in ('IDEA','RESEARCH','ANNOUNCED','FUNDED','PILOT','BUILDING',
                                         'DEPLOYING','ACTIVE','SCALING','COMPLETED','PAUSED','CANCELLED')),
  evidence           text not null
                       check (evidence in ('VERIFIED','REPORTED','ANNOUNCED','ANALYSIS','SIGNAL','POSSIBILITY')),
  sector             text,
  summary            text not null,
  impact             text,
  year               integer check (year between 1900 and 2100),
  location_id        text not null references locations(id) on delete restrict,
  geometry           geography(Point,4326),
  actors             text[] not null default '{}',
  tags               text[] not null default '{}',
  published_at       timestamptz,
  last_verified_at   timestamptz not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

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
  from_status text
                check (from_status is null or from_status in ('IDEA','RESEARCH','ANNOUNCED','FUNDED',
                  'PILOT','BUILDING','DEPLOYING','ACTIVE','SCALING','COMPLETED','PAUSED','CANCELLED')),
  to_status   text not null
                check (to_status in ('IDEA','RESEARCH','ANNOUNCED','FUNDED','PILOT','BUILDING',
                  'DEPLOYING','ACTIVE','SCALING','COMPLETED','PAUSED','CANCELLED')),
  changed_at  timestamptz not null,
  note        text,
  source_id   text references sources(id) on delete set null
);

create table if not exists impact_records (
  id          bigserial primary key,
  project_id  text not null references projects(id) on delete cascade,
  category    text not null
                check (category in ('ECONOMIC','SOCIAL','EDUCATIONAL','HEALTH','ENVIRONMENTAL',
                  'INFRASTRUCTURE','REGULATORY','OTHER')),
  description text not null,
  source_id   text references sources(id) on delete set null
);

create table if not exists events (
  id          bigserial primary key,
  project_id  text not null references projects(id) on delete cascade,
  title       text not null,
  occurred_at date not null,
  kind        text not null,
  description text not null default '',
  source_id   text references sources(id) on delete set null
);

create table if not exists relations (
  id           text primary key,
  from_project text not null references projects(id) on delete cascade,
  to_project   text not null references projects(id) on delete cascade,
  type         text not null
                 check (type in ('PARTNERSHIP','FUNDING','RESEARCH','INFRASTRUCTURE','GOVERNMENT',
                                 'SUPPLIER','UNIVERSITY','DEPLOYMENT','LOCATION','POLICY',
                                 'TECHNOLOGY','INVESTMENT')),
  description  text not null default '',
  source_id    text references sources(id) on delete set null,
  unique (from_project, to_project, type),
  check (from_project <> to_project)
);

create index if not exists locations_geography_gist on locations using gist (geography);
create index if not exists locations_parent_idx on locations (parent_id);
create index if not exists locations_level_idx on locations (level);

create index if not exists projects_geography_gist on projects using gist (geometry);
create index if not exists projects_type_idx on projects (type);
create index if not exists projects_status_idx on projects (status);
create index if not exists projects_evidence_idx on projects (evidence);
create index if not exists projects_location_idx on projects (location_id);
create index if not exists projects_published_idx on projects (published_at desc);
create index if not exists projects_last_verified_idx on projects (last_verified_at desc);

-- array_to_string is marked STABLE because, for an arbitrary element type, it may
-- have to call that type's input/output conversion routines. PostgreSQL therefore
-- refuses it inside an index expression, which is why this index cannot be built
-- with a bare array_to_string call.
--
-- For text[] -> text with a fixed delimiter the result really is immutable: the
-- text output function is immutable and nothing else is involved. So we wrap
-- exactly that case instead of promoting the anyarray overload, which would make
-- a genuinely unstable function look indexable and could leave the index
-- silently inconsistent for other element types.
create or replace function atlas_text_array_join(arr text[], delimiter text)
returns text
language sql
immutable
parallel safe
as $$
  select coalesce(array_to_string(arr, delimiter), '');
$$;

-- The regconfig cast must be a literal for the expression to be indexable.
create index if not exists projects_search_idx on projects using gin (
  to_tsvector(
    'spanish'::regconfig,
    coalesce(name, '') || ' ' || coalesce(summary, '') || ' ' || atlas_text_array_join(tags, ' ')
  )
);

create index if not exists sources_source_type_idx on sources (source_type);
create index if not exists project_sources_source_idx on project_sources (source_id);
create index if not exists status_history_project_idx on status_history (project_id, changed_at desc);
create index if not exists impact_records_project_idx on impact_records (project_id);
create index if not exists events_occurred_idx on events (occurred_at);
create index if not exists events_project_idx on events (project_id);

create or replace function atlas_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists locations_touch on locations;
create trigger locations_touch before update on locations
  for each row execute function atlas_touch_updated_at();

drop trigger if exists projects_touch on projects;
create trigger projects_touch before update on projects
  for each row execute function atlas_touch_updated_at();

drop trigger if exists sources_touch on sources;
create trigger sources_touch before update on sources
  for each row execute function atlas_touch_updated_at();
