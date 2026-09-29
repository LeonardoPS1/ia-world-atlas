import type { Event, Location, ProjectDetail, Relation, Source } from '@atlas/contracts';

export interface AtlasData {
  locations: Location[];
  projects: ProjectDetail[];
  sources: Source[];
  events: Event[];
  relations: Relation[];
}
