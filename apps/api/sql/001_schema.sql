CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE IF NOT EXISTS locations (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, level TEXT NOT NULL CHECK(level IN ('LOCAL','REGION','COUNTRY','CONTINENT','WORLD')),
 parent_id TEXT REFERENCES locations(id), country_code TEXT, geometry GEOGRAPHY(POINT,4326), metadata JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS projects (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, status TEXT NOT NULL, evidence TEXT NOT NULL,
 sector TEXT, summary TEXT, impact TEXT, year INT, location_id TEXT REFERENCES locations(id), geometry GEOGRAPHY(POINT,4326),
 actors JSONB DEFAULT '[]'::jsonb, tags JSONB DEFAULT '[]'::jsonb, source_url TEXT, source_name TEXT, published_at TIMESTAMPTZ,
 last_verified_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS events (
 id TEXT PRIMARY KEY, project_id TEXT REFERENCES projects(id), event_type TEXT NOT NULL, title TEXT NOT NULL,
 description TEXT, event_date DATE NOT NULL, source_url TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS relations (
 id BIGSERIAL PRIMARY KEY, from_project_id TEXT REFERENCES projects(id), to_project_id TEXT REFERENCES projects(id), relation_type TEXT NOT NULL,
 UNIQUE(from_project_id,to_project_id,relation_type)
);
CREATE INDEX IF NOT EXISTS projects_geo_idx ON projects USING GIST(geometry);
CREATE INDEX IF NOT EXISTS locations_geo_idx ON locations USING GIST(geometry);
CREATE INDEX IF NOT EXISTS projects_search_idx ON projects USING GIN(to_tsvector('simple', coalesce(name,'')||' '||coalesce(summary,'')||' '||coalesce(sector,'')));
