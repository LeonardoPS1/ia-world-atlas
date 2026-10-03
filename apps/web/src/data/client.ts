import {
  apiErrorSchema,
  eventListResponseSchema,
  healthResponseSchema,
  locationListResponseSchema,
  projectDetailSchema,
  projectListResponseSchema,
  relationListResponseSchema,
  statsResponseSchema,
} from '@atlas/contracts';
import type {
  EventListResponse,
  HealthResponse,
  LocationListResponse,
  ProjectDetail,
  ProjectListResponse,
  RelationListResponse,
  StatsResponse,
} from '@atlas/contracts';
import { z } from 'zod';
import { buildQueryString } from './query.ts';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;

  constructor(status: number, code: string, message: string, requestId: string | null) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export class ContractError extends Error {
  readonly endpoint: string;
  readonly issues: string[];

  constructor(endpoint: string, issues: string[]) {
    super(`Response for ${endpoint} does not match its contract: ${issues.join('; ')}`);
    this.name = 'ContractError';
    this.endpoint = endpoint;
    this.issues = issues;
  }
}

// HealthResponse extended with requestId from x-request-id header
export type HealthResponseWithRequestId = HealthResponse & { requestId: string | null };

export interface ApiClient {
  health(signal?: AbortSignal): Promise<HealthResponseWithRequestId>;
  locations(query: Record<string, unknown>, signal?: AbortSignal): Promise<LocationListResponse>;
  projects(query: Record<string, unknown>, signal?: AbortSignal): Promise<ProjectListResponse>;
  project(id: string, signal?: AbortSignal): Promise<ProjectDetail>;
  events(query: Record<string, unknown>, signal?: AbortSignal): Promise<EventListResponse>;
  relations(projectId: string, signal?: AbortSignal): Promise<RelationListResponse>;
  stats(signal?: AbortSignal): Promise<StatsResponse>;
}

export interface ApiClientOptions {
  fetchImpl?: typeof fetch;
  retryCount?: number;
  retryDelayMs?: number;
}

const RETRYABLE = new Set([502, 503, 504]);

function join(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Schema for the project detail envelope { data: ProjectDetail }
const projectDetailEnvelopeSchema = z.object({ data: projectDetailSchema });

export function createApiClient(baseUrl: string, options: ApiClientOptions = {}): ApiClient {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const retryCount = options.retryCount ?? 1;
  const retryDelayMs = options.retryDelayMs ?? 300;

  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    query: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<T> {
    const queryString = buildQueryString(query);
    const url = queryString ? `${join(baseUrl, path)}?${queryString}` : join(baseUrl, path);

    let attempt = 0;
    for (;;) {
      let response: Response;
      try {
        response = await fetchImpl(url, {
          headers: { accept: 'application/json' },
          signal,
        });
      } catch (error) {
        const isAbort = error instanceof DOMException && error.name === 'AbortError';
        if (isAbort || attempt >= retryCount) throw error;
        attempt += 1;
        await sleep(retryDelayMs);
        continue;
      }

      if (response.ok) {
        const json: unknown = await response.json();
        const parsed = schema.safeParse(json);
        if (!parsed.success) {
          throw new ContractError(
            path,
            parsed.error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`),
          );
        }
        return parsed.data;
      }

      if (RETRYABLE.has(response.status) && attempt < retryCount) {
        attempt += 1;
        await sleep(retryDelayMs);
        continue;
      }

      const errorBody: unknown = await response.json().catch(() => null);
      const parsedError = apiErrorSchema.safeParse(errorBody);
      if (parsedError.success) {
        throw new ApiRequestError(
          response.status,
          parsedError.data.error.code,
          parsedError.data.error.message,
          parsedError.data.error.requestId,
        );
      }
      throw new ApiRequestError(response.status, 'HTTP_ERROR', `Request to ${path} failed`, null);
    }
  }

  async function requestWithRequestId<T>(
    path: string,
    schema: z.ZodType<T>,
    query: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<T & { requestId: string | null }> {
    const queryString = buildQueryString(query);
    const url = queryString ? `${join(baseUrl, path)}?${queryString}` : join(baseUrl, path);

    let attempt = 0;
    for (;;) {
      let response: Response;
      try {
        response = await fetchImpl(url, {
          headers: { accept: 'application/json' },
          signal,
        });
      } catch (error) {
        const isAbort = error instanceof DOMException && error.name === 'AbortError';
        if (isAbort || attempt >= retryCount) throw error;
        attempt += 1;
        await sleep(retryDelayMs);
        continue;
      }

      if (response.ok) {
        const json: unknown = await response.json();
        const parsed = schema.safeParse(json);
        if (!parsed.success) {
          throw new ContractError(
            path,
            parsed.error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`),
          );
        }
        const requestId = response.headers.get('x-request-id');
        return { ...parsed.data, requestId };
      }

      if (RETRYABLE.has(response.status) && attempt < retryCount) {
        attempt += 1;
        await sleep(retryDelayMs);
        continue;
      }

      const errorBody: unknown = await response.json().catch(() => null);
      const parsedError = apiErrorSchema.safeParse(errorBody);
      if (parsedError.success) {
        throw new ApiRequestError(
          response.status,
          parsedError.data.error.code,
          parsedError.data.error.message,
          parsedError.data.error.requestId,
        );
      }
      throw new ApiRequestError(response.status, 'HTTP_ERROR', `Request to ${path} failed`, null);
    }
  }

  return {
    health: (signal) => requestWithRequestId('/health', healthResponseSchema, {}, signal),
    locations: (query, signal) => request('/locations', locationListResponseSchema, query, signal),
    projects: (query, signal) => request('/projects', projectListResponseSchema, query, signal),
    project: async (id, signal) => {
      const envelope = await request(`/projects/${encodeURIComponent(id)}`, projectDetailEnvelopeSchema, {}, signal);
      const project = envelope.data;
      if (project.id !== id) {
        throw new ContractError(`/projects/${id}`, [`id: expected "${id}", got "${project.id}"`]);
      }
      return project;
    },
    events: (query, signal) => request('/events', eventListResponseSchema, query, signal),
    relations: (projectId, signal) =>
      request('/relations', relationListResponseSchema, { projectId }, signal),
    stats: (signal) => request('/stats', statsResponseSchema, {}, signal),
  };
}