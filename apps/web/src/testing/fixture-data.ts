import type { Event, Location, ProjectDetail, Relation, Source } from '@atlas/contracts';

const location = (
  id: string,
  name: string,
  level: Location['level'],
  parentId: string | null,
  longitude: number,
  latitude: number,
  countryCode: string | null = null,
): Location => ({
  id,
  name,
  level,
  parentId,
  countryCode,
  longitude,
  latitude,
  childCount: 0,
  projectCount: 0,
  metadata: {},
});

const source = (
  id: string,
  name: string,
  url: string,
  snippet: string,
  publicationDate: string | null,
  confidence: Source['confidence'] = 'HIGH',
): Source => ({
  id,
  name,
  url,
  sourceType: 'GOVERNMENT',
  publicationDate,
  lastVerifiedAt: '2026-09-25T00:00:00.000Z',
  confidence,
  snippet,
  isPrimary: true,
});

const now = '2026-09-25T00:00:00.000Z';

export const locationsFixture: Location[] = [
  location('world', 'World', 'WORLD', null, 0, 0),
  location('south-america', 'South America', 'CONTINENT', 'world', -58, -14),
  location('chile', 'Chile', 'COUNTRY', 'south-america', -71.5, -35.7, 'CL'),
  location('valparaiso-region', 'Valparaiso Region', 'REGION', 'chile', -71.35, -32.85, 'CL'),
  location('valparaiso', 'Valparaiso', 'CITY', 'valparaiso-region', -71.6127, -33.0472, 'CL'),
  location('vina-del-mar', 'Vina del Mar', 'CITY', 'valparaiso-region', -71.5617, -33.0244, 'CL'),
  location('santiago', 'Santiago', 'CITY', 'chile', -70.6693, -33.4489, 'CL'),
  location('pucv-campus', 'PUCV campus', 'LOCAL_AREA', 'valparaiso', -71.522, -33.0365, 'CL'),
  location('india', 'India', 'COUNTRY', 'world', 78.9629, 20.5937, 'IN'),
  location('singapore', 'Singapore', 'COUNTRY', 'world', 103.8198, 1.3521, 'SG'),
  location('eu', 'European Union', 'COUNTRY', 'world', 10.35, 50.85),
];

export const sourcesFixture: Source[] = [
  source('src-pucv-fondecyt-2026', 'PUCV', 'https://www.ingenieria.pucv.cl/x', 'Snippet PUCV.', '2026-03-05'),
  source('src-minciencia-policy', 'MinCiencia', 'https://www.minciencia.gob.cl/x', 'Snippet politica.', null),
  source('src-indiaai-coe-2024', 'IndiaAI', 'https://indiaai.gov.in/x', 'Snippet IndiaAI.', '2024-10-16'),
  source('src-smartnation-odp', 'Smart Nation', 'https://www.smartnation.gov.sg/x', 'Snippet Singapur.', null, 'MEDIUM'),
  source('src-ec-ai-factories', 'European Commission', 'https://digital-strategy.ec.europa.eu/x', 'Snippet CE.', null),
];

const project = (
  id: string,
  name: string,
  type: ProjectDetail['type'],
  status: ProjectDetail['status'],
  evidence: ProjectDetail['evidence'],
  locationId: string,
  year: number | null,
  publishedAt: string | null,
  sourceIds: string[],
  eventIds: number[],
): ProjectDetail => {
  const anchor = locationsFixture.find((l) => l.id === locationId);
  if (!anchor) throw new Error(`fixture: unknown location ${locationId}`);
  return {
    id,
    name,
    type,
    status,
    evidence,
    sector: 'Sector',
    summary: `Summary of ${name}.`,
    impact: `Impact of ${name}.`,
    year,
    locationId,
    longitude: anchor.longitude,
    latitude: anchor.latitude,
    actors: ['Actor'],
    tags: ['ai'],
    publishedAt,
    lastVerifiedAt: now,
    sourceCount: sourceIds.length,
    eventCount: eventIds.length,
    location: anchor,
    sources: sourcesFixture.filter((s) => sourceIds.includes(s.id)),
    events: eventsFixture.filter((e) => eventIds.includes(e.id)),
    relations: [],
    statusHistory: [
      {
        id: eventIds[0] ?? 1,
        fromStatus: null,
        toStatus: status,
        changedAt: publishedAt ?? now,
        note: null,
        sourceId: sourceIds[0] ?? null,
      },
    ],
    impactRecords: [],
    geometrySource: 'project',
  };
};

export const eventsFixture: Event[] = [
  { id: 1, projectId: 'pucv-fondecyt-fuzzy', title: 'Proyecto Fondecyt publicado', occurredAt: '2026-03-05', kind: 'DATED', description: '', sourceId: 'src-pucv-fondecyt-2026' },
  { id: 2, projectId: 'chile-national-ai-policy', title: 'Politica publicada', occurredAt: '2021-01-01', kind: 'YEAR', description: '', sourceId: 'src-minciencia-policy' },
  { id: 3, projectId: 'chile-national-ai-policy', title: 'Actualizacion 2026', occurredAt: '2026-01-01', kind: 'YEAR', description: '', sourceId: 'src-minciencia-policy' },
  { id: 4, projectId: 'indiaai-mission', title: 'Centres of Excellence', occurredAt: '2024-10-16', kind: 'DATED', description: '', sourceId: 'src-indiaai-coe-2024' },
  { id: 5, projectId: 'indiaai-mission', title: 'Innovation Challenge', occurredAt: '2026-01-15', kind: 'DATED', description: '', sourceId: 'src-indiaai-challenge-2026' },
  { id: 6, projectId: 'punggol-digital-district', title: 'ODP smart city', occurredAt: '2026-01-01', kind: 'YEAR', description: '', sourceId: 'src-smartnation-odp' },
  { id: 7, projectId: 'eu-ai-factories', title: 'AI Factories', occurredAt: '2026-01-01', kind: 'YEAR', description: '', sourceId: 'src-ec-ai-factories' },
];

export const projectsFixture: ProjectDetail[] = [
  project('pucv-fondecyt-fuzzy', 'An Adaptive Fuzzy Control System', 'RESEARCH', 'RESEARCH', 'REPORTED', 'pucv-campus', 2026, '2026-03-05T00:00:00.000Z', ['src-pucv-fondecyt-2026'], [1]),
  project('chile-national-ai-policy', 'Politica Nacional de Inteligencia Artificial', 'POLICY', 'ACTIVE', 'REPORTED', 'chile', 2021, null, ['src-minciencia-policy'], [2, 3]),
  project('indiaai-mission', 'IndiaAI Mission', 'GOVERNMENT', 'ACTIVE', 'REPORTED', 'india', 2024, '2024-10-16T00:00:00.000Z', ['src-indiaai-coe-2024'], [4, 5]),
  project('punggol-digital-district', 'Punggol Digital District Open Digital Platform', 'INFRASTRUCTURE', 'ACTIVE', 'REPORTED', 'singapore', null, null, ['src-smartnation-odp'], [6]),
  project('eu-ai-factories', 'European AI Factories', 'INFRASTRUCTURE', 'DEPLOYING', 'ANNOUNCED', 'eu', 2026, null, ['src-ec-ai-factories'], [7]),
];

export const relationsFixture: Relation[] = [];

export const atlasDataFixture = {
  locations: locationsFixture,
  projects: projectsFixture,
  sources: sourcesFixture,
  events: eventsFixture,
  relations: relationsFixture,
};