import type {
  Event,
  EvidenceLevel,
  Location,
  LocationLevel,
  Paginated,
  ProjectDetail,
  ProjectStatus,
  ProjectSummary,
  ProjectType,
  Relation,
  StatsResponse,
} from '@atlas/contracts';

export interface PaginationQuery {
  page: number;
  pageSize: number;
}

export interface LocationsQuery extends PaginationQuery {
  parentId?: string;
  level?: LocationLevel;
}

export interface ProjectsQuery extends PaginationQuery {
  q?: string;
  type?: ProjectType[];
  status?: ProjectStatus[];
  evidence?: EvidenceLevel[];
  sector?: string;
  locationIds?: string[];
  yearFrom?: number;
  yearTo?: number;
  sort: 'publishedAt' | 'name';
}

export interface EventsQuery {
  projectId?: string;
  yearFrom?: number;
  yearTo?: number;
}

export interface LocationRepository {
  all(): Promise<Location[]>;
  list(query: LocationsQuery): Promise<Paginated<Location>>;
  descendantIds(id: string): Promise<string[]>;
}

export interface ProjectRepository {
  list(query: ProjectsQuery): Promise<Paginated<ProjectSummary>>;
  findById(id: string): Promise<ProjectDetail | null>;
}

export interface EventRepository {
  list(query: EventsQuery): Promise<Event[]>;
}

export interface RelationRepository {
  listByProject(projectId: string): Promise<Relation[]>;
}

export interface StatsRepository {
  overview(): Promise<StatsResponse>;
}

export interface HealthRepository {
  ping(): Promise<boolean>;
}

export interface AtlasRepositories {
  locations: LocationRepository;
  projects: ProjectRepository;
  events: EventRepository;
  relations: RelationRepository;
  stats: StatsRepository;
  health: HealthRepository;
}
