-- AI World Atlas — audited seed.
-- Every claim below is traceable to a primary source in `sources`.
-- No VERIFIED evidence, no invented figures, no invented relations.
--
-- Coordinate policy. st_makepoint takes (longitude, latitude). Named places use
-- the published centre of the city, which is a coarse but true statement. The
-- one point that is NOT a published centre is pucv-campus: it carries
-- geocode_precision 'approximate' and says in its metadata that the coordinate
-- was not derived from the address by a geocoding service. It was downgraded
-- from 'address' on review rather than asserted, because a seed whose whole
-- premise is traceability cannot carry a precision claim nobody checked.
-- projects.geometry for pucv-fondecyt-fuzzy reuses that same approximate point.

-- ---------------------------------------------------------------- locations
insert into locations (id, name, level, parent_id, country_code, geography, metadata) values
  ('world',          'World',            'WORLD',     null,             null,  st_setsrid(st_makepoint(0, 0), 4326),            '{}'::jsonb),
  ('south-america',  'South America',    'CONTINENT', 'world',          null,  st_setsrid(st_makepoint(-58, -14), 4326),        '{"kind":"approximate-continent-anchor"}'),
  ('chile',          'Chile',            'COUNTRY',   'south-america',  'CL',  st_setsrid(st_makepoint(-71.5, -35.7), 4326),    '{}'::jsonb),
  ('valparaiso-region','Valparaíso Region','REGION',   'chile',          'CL',  st_setsrid(st_makepoint(-71.35, -32.85), 4326),  '{}'::jsonb),
  ('valparaiso',     'Valparaíso',        'CITY',      'valparaiso-region','CL',st_setsrid(st_makepoint(-71.6127, -33.0472), 4326),'{}'::jsonb),
  ('vina-del-mar',   'Viña del Mar',      'CITY',      'valparaiso-region','CL',st_setsrid(st_makepoint(-71.5617, -33.0244), 4326),'{}'::jsonb),
  ('santiago',       'Santiago',         'CITY',      'chile',          'CL',  st_setsrid(st_makepoint(-70.6693, -33.4489), 4326),'{}'::jsonb),
  ('pucv-campus',    'PUCV campus',      'LOCAL_AREA','valparaiso',     'CL',  st_setsrid(st_makepoint(-71.5220, -33.0365), 4326), '{"geocode_precision":"approximate","address":"Avenida Brasil 525, Valparaiso, Chile","note":"city-level anchor. The address is the one the faculty publishes, but this coordinate was NOT geocoded from it and no geocoding service was consulted, so the point is approximate and must not be read as the building entrance."}'),
  ('india',          'India',            'COUNTRY',   'world',          'IN',  st_setsrid(st_makepoint(78.9629, 20.5937), 4326),  '{}'::jsonb),
  ('singapore',      'Singapore',        'COUNTRY',   'world',          'SG',  st_setsrid(st_makepoint(103.8198, 1.3521), 4326),  '{}'::jsonb),
  ('eu',             'European Union',   'COUNTRY',   'world',          null,  st_setsrid(st_makepoint(10.35, 50.85), 4326),     '{"aggregation":true,"note":"anchor for the EU-wide AI Factories block, not a territorial claim"}')
on conflict (id) do update set
  name = excluded.name,
  level = excluded.level,
  parent_id = excluded.parent_id,
  country_code = excluded.country_code,
  geography = excluded.geography,
  metadata = excluded.metadata,
  updated_at = now();

-- ----------------------------------------------------------------- sources
insert into sources (id, name, url, source_type, publication_date, last_verified_at, confidence) values
  ('src-pucv-fondecyt-2026', 'PUCV Facultad de Ingenieria',
    'https://www.ingenieria.pucv.cl/desarrollan-proyecto-de-inteligencia-artificial-con-algoritmos-capables-de-aprender-de-su-propio-desempeno/',
    'UNIVERSITY', date '2026-03-05', timestamptz '2026-09-25T00:00:00Z', 'HIGH'),
  ('src-minciencia-policy', 'Ministerio de Ciencia, Tecnologia y Conocimiento de Chile',
    'https://www.minciencia.gob.cl/areas/inteligencia-artificial/politica-nacional-de-inteligencia-artificial/',
    'GOVERNMENT', NULL, timestamptz '2026-09-25T00:00:00Z', 'HIGH'),
  ('src-minciencia-policy-2026', 'Ministerio de Ciencia, Tecnologia y Conocimiento de Chile',
    'https://www.minciencia.gob.cl/noticias/con-mas-de-100-acciones-comprometidas-para-2026-ministra-de-ciencia-presenta-nueva-politica-de-inteligencia-artificial/',
    'GOVERNMENT', NULL, timestamptz '2026-09-25T00:00:00Z', 'MEDIUM'),
  ('src-indiaai-coe-2024', 'IndiaAI (Government of India, MeitY)',
    'https://indiaai.gov.in/article/union-minister-dharmendra-pradhan-launches-three-ai-centres-of-excellence',
    'GOVERNMENT', date '2024-10-16', timestamptz '2026-09-25T00:00:00Z', 'HIGH'),
  ('src-indiaai-challenge-2026', 'IndiaAI (Government of India, MeitY)',
    'https://indiaai.gov.in/article/indiaai-innovation-challenge-2026',
    'GOVERNMENT', date '2026-01-15', timestamptz '2026-09-25T00:00:00Z', 'HIGH'),
  ('src-smartnation-odp', 'Smart Nation Singapore',
    'https://www.smartnation.gov.sg/initiatives/smart-city-solutions/',
    'GOVERNMENT', NULL, timestamptz '2026-09-25T00:00:00Z', 'MEDIUM'),
  ('src-ec-ai-factories', 'European Commission, DG CONNECT',
    'https://digital-strategy.ec.europa.eu/en/policies/ai-factories',
    'GOVERNMENT', NULL, timestamptz '2026-09-25T00:00:00Z', 'HIGH')
on conflict (id) do update set
  name = excluded.name,
  url = excluded.url,
  source_type = excluded.source_type,
  publication_date = excluded.publication_date,
  last_verified_at = excluded.last_verified_at,
  confidence = excluded.confidence,
  updated_at = now();

-- ---------------------------------------------------------------- projects
insert into projects (
  id, name, type, status, evidence, sector, summary, impact, year,
  location_id, geometry, actors, tags, published_at, last_verified_at
) values
  ('pucv-fondecyt-fuzzy',
   'An Adaptive Fuzzy Control System for Metaheuristic Configuration',
   'RESEARCH', 'RESEARCH', 'REPORTED', 'Research',
   'Proyecto Fondecyt Regular que aplica control difuso adaptativo a algoritmos metaheuristicos, entre los 31 proyectos Fondecyt adjudicados a academicos PUCV en 2026.',
   'Metodologia publicada para ajustar la parametrizacion de metaheuristicas en problemas de optimizacion.', 2026,
   'pucv-campus', st_setsrid(st_makepoint(-71.5220, -33.0365), 4326),
   ARRAY['Pontificia Universidad Catolica de Valparaiso'], ARRAY['Fondecyt', 'metaheuristics', 'fuzzy control', 'optimization'],
   timestamptz '2026-03-05T00:00:00Z', timestamptz '2026-09-25T00:00:00Z'),

  ('chile-national-ai-policy',
   'Politica Nacional de Inteligencia Artificial',
   'POLICY', 'ACTIVE', 'REPORTED', 'Policy',
   'Politica vigente desde 2021, con plan de accion y actualizacion del Eje 3. La version actualizada reporta 177 acciones, 100 comprometidas para 2026 y coordinacion con 14 ministerios.',
   'Marco de referencia para la planificacion y coordinacion de IA a nivel estatal.', 2021,
   'chile', NULL,
   ARRAY['Ministerio de Ciencia, Tecnologia y Conocimiento'], ARRAY['national policy', 'public sector', '2026 actions'],
   NULL, timestamptz '2026-09-25T00:00:00Z'),

  ('indiaai-mission',
   'IndiaAI Mission',
   'GOVERNMENT', 'ACTIVE', 'REPORTED', 'Public sector',
   'IndiaAI, implementado como India Business Development Agency bajo Digital India Corporation / MeitY, ejecuta la mission nacional de IA. Se documentan tres Centres of Excellence lanzados en octubre de 2024 con 990 crore rupias.',
   'Infraestructura institucional nacional para investigación y adopción de IA.', 2024,
   'india', NULL,
   ARRAY['MeitY', 'Digital India Corporation'], ARRAY['mission', 'centres of excellence', 'MeitY'],
   timestamptz '2024-10-16T00:00:00Z', timestamptz '2026-09-25T00:00:00Z'),

  ('punggol-digital-district',
   'Punggol Digital District Open Digital Platform',
   'INFRASTRUCTURE', 'ACTIVE', 'REPORTED', 'Smart city',
   'Plataforma del distrito que integra sistemas de smart city para monitoreo en tiempo real y optimizacion de recursos, segun la pagina oficial de Smart Nation.',
   'Integracion de sistemas urbanos para gestion de recursos en tiempo real.', NULL,
   'singapore', NULL,
   ARRAY['Smart Nation Singapore'], ARRAY['smart city', 'open digital platform', 'urban systems'],
   NULL, timestamptz '2026-09-25T00:00:00Z'),

  ('eu-ai-factories',
   'European AI Factories',
   'INFRASTRUCTURE', 'DEPLOYING', 'ANNOUNCED', 'Compute',
   'La Comision Europea reporta 19 AI Factories y 13 antennas en preparacion, al menos 9 supercomputadores optimizados, una llamada para hasta 7 AI Gigafactories y hasta 10 mil millones de euros de apoyo publico. La inversion privada esperada se declara como expectativa.',
   'Capacidad de calculo democratizada para la investigacion y la industria europea.', 2026,
   'eu', NULL,
   ARRAY['European Commission'], ARRAY['AI Factories', 'supercomputing', 'Gigafactories'],
   NULL, timestamptz '2026-09-25T00:00:00Z')
on conflict (id) do update set
  name = excluded.name,
  type = excluded.type,
  status = excluded.status,
  evidence = excluded.evidence,
  sector = excluded.sector,
  summary = excluded.summary,
  impact = excluded.impact,
  year = excluded.year,
  location_id = excluded.location_id,
  geometry = excluded.geometry,
  actors = excluded.actors,
  tags = excluded.tags,
  published_at = excluded.published_at,
  last_verified_at = excluded.last_verified_at,
  updated_at = now();

-- ------------------------------------------------------------- project_sources
insert into project_sources (project_id, source_id, snippet, is_primary) values
  ('pucv-fondecyt-fuzzy', 'src-pucv-fondecyt-2026',
   'Proyecto Fondecyt Regular sobre control difuso adaptativo para la configuracion de metaheuristicas, uno de los 31 proyectos adjudicados a academicos PUCV.', true),
  ('chile-national-ai-policy', 'src-minciencia-policy',
   'Pagina institucional de la Politica Nacional de Inteligencia Artificial: vigente, con plan de accion y actualizacion del Eje 3.', true),
  ('chile-national-ai-policy', 'src-minciencia-policy-2026',
   'La politica actualizada reporta 177 acciones, 100 comprometidas para 2026 y coordinacion con 14 ministerios.', false),
  ('indiaai-mission', 'src-indiaai-coe-2024',
   'Lanzamiento de tres Centres of Excellence con 990 crore rupias de presupuesto.', true),
  ('indiaai-mission', 'src-indiaai-challenge-2026',
   'IndiaAI opera como India Business Development Agency bajo Digital India Corporation / MeitY; el reto de innovacion 2026 se announce en enero de 2026.', false),
  ('punggol-digital-district', 'src-smartnation-odp',
   'El Open Digital Platform del Punggol Digital District integra sistemas de smart city para monitoreo y optimizacion de recursos.', true),
  ('eu-ai-factories', 'src-ec-ai-factories',
   '19 AI Factories y 13 antennas en preparacion, 9 supercomputadores optimizados, llamada para hasta 7 AI Gigafactories y hasta 10 mil millones de euros de apoyo publico.', true)
on conflict (project_id, source_id) do update set
  snippet = excluded.snippet,
  is_primary = excluded.is_primary;

-- ----------------------------------------------------------------- events
-- kind 'DATED' means the exact day is documented by the source.
-- kind 'YEAR'   means only the year is documented; the UI renders the year alone.
-- The id is explicit so this insert upserts by primary key like every other
-- table in this seed. A guessed unique key on (project_id, title, occurred_at)
-- would be worse than a duplicate: two legitimately distinct events can share
-- a title and a date, and the constraint would silently drop a real one.
insert into events (id, project_id, title, occurred_at, kind, description, source_id) values
  (1, 'pucv-fondecyt-fuzzy', 'Proyecto Fondecyt publicado por la Facultad de Ingenieria PUCV',
   date '2026-03-05', 'DATED',
   'La Facultad de Ingenieria de la PUCV publica el proyecto Fondecyt Regular sobre control difuso adaptativo.', 'src-pucv-fondecyt-2026'),
  (2, 'chile-national-ai-policy', 'Publicacion de la Politica Nacional de Inteligencia Artificial',
   date '2021-01-01', 'YEAR',
   'Chile publica su Politica Nacional de Inteligencia Artificial, vigente desde 2021.', 'src-minciencia-policy'),
  (3, 'chile-national-ai-policy', 'Actualizacion con 177 acciones para 2026',
   date '2026-01-01', 'YEAR',
   'La politica actualizada informa 177 acciones, 100 comprometidas para 2026 y coordinacion con 14 ministerios.', 'src-minciencia-policy-2026'),
  (4, 'indiaai-mission', 'Lanzamiento de tres Centres of Excellence',
   date '2024-10-16', 'DATED',
   'El ministro Dharmendra Pradhan lanza tres Centres of Excellence con 990 crore rupias.', 'src-indiaai-coe-2024'),
  (5, 'indiaai-mission', 'IndiaAI Innovation Challenge 2026',
   date '2026-01-15', 'DATED',
   'Publicacion del reto de innovacion IndiaAI 2026.', 'src-indiaai-challenge-2026'),
  (6, 'punggol-digital-district', 'Open Digital Platform descrito como sistema de smart city',
   date '2026-01-01', 'YEAR',
   'Smart Nation describe el Open Digital Platform del Punggol Digital District como integracion de sistemas de smart city.', 'src-smartnation-odp'),
  (7, 'eu-ai-factories', 'Red de AI Factories en preparacion',
   date '2026-01-01', 'YEAR',
   'La Comision Europea reporta 19 AI Factories y 13 antennas en preparacion y una llamada para hasta 7 AI Gigafactories.', 'src-ec-ai-factories')
on conflict (id) do update set
  project_id = excluded.project_id,
  title = excluded.title,
  occurred_at = excluded.occurred_at,
  kind = excluded.kind,
  description = excluded.description,
  source_id = excluded.source_id;

-- ---------------------------------------------------------- status history
insert into status_history (id, project_id, from_status, to_status, changed_at, note, source_id) values
  (1, 'pucv-fondecyt-fuzzy', NULL, 'RESEARCH', timestamptz '2026-03-05T00:00:00Z', 'Inicio documentado del proyecto.', 'src-pucv-fondecyt-2026'),
  (2, 'chile-national-ai-policy', NULL, 'ANNOUNCED', timestamptz '2021-01-01T00:00:00Z', 'Publicacion de la politica.', 'src-minciencia-policy'),
  (3, 'chile-national-ai-policy', 'ANNOUNCED', 'ACTIVE', timestamptz '2026-01-01T00:00:00Z', 'Politica vigente con plan de accion en ejecucion.', 'src-minciencia-policy-2026'),
  (4, 'indiaai-mission', NULL, 'ANNOUNCED', timestamptz '2024-10-16T00:00:00Z', 'Lanzamiento de los Centres of Excellence.', 'src-indiaai-coe-2024'),
  (5, 'indiaai-mission', 'ANNOUNCED', 'ACTIVE', timestamptz '2026-01-15T00:00:00Z', 'Reto de innovacion 2026 en curso.', 'src-indiaai-challenge-2026'),
  (6, 'punggol-digital-district', NULL, 'ACTIVE', timestamptz '2026-01-01T00:00:00Z', 'Plataforma descrita como operativa.', 'src-smartnation-odp'),
  (7, 'eu-ai-factories', NULL, 'ANNOUNCED', timestamptz '2026-01-01T00:00:00Z', 'Red anunciada por la Comision Europea.', 'src-ec-ai-factories'),
  (8, 'eu-ai-factories', 'ANNOUNCED', 'DEPLOYING', timestamptz '2026-01-01T00:00:00Z', 'Factories y antennas en preparacion.', 'src-ec-ai-factories')
on conflict (id) do update set
  project_id = excluded.project_id,
  from_status = excluded.from_status,
  to_status = excluded.to_status,
  changed_at = excluded.changed_at,
  note = excluded.note,
  source_id = excluded.source_id;

-- --------------------------------------------------- id sequence realignment
-- events.id and status_history.id are bigserial. Inserting explicit ids does not
-- advance the sequence, so after this seed runs, the next plain insert into
-- either table would try id = 1 and collide with a row that already exists.
-- setval(..., false) makes the next nextval return max(id) + 1, which is also
-- correct on a rerun over an already-seeded database and on an empty table.
select setval(pg_get_serial_sequence('events', 'id'), coalesce((select max(id) from events), 0) + 1, false);
select setval(pg_get_serial_sequence('status_history', 'id'), coalesce((select max(id) from status_history), 0) + 1, false);

-- relations: intentionally empty. The audited sources do not document an
-- explicit relation between these five projects, so none is invented.

analyze locations;
analyze projects;
