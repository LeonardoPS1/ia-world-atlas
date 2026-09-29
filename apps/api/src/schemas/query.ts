import {
  evidenceSchema,
  locationLevelSchema,
  projectStatusSchema,
  projectTypeSchema,
} from '@atlas/contracts';
import { z } from 'zod';
import { HttpError } from '../errors/HttpError.ts';

export function flattenQuery(raw: unknown): Record<string, string | string[]> {
  if (typeof raw !== 'object' || raw === null) return {};
  const output: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      const items = value.filter((item): item is string => typeof item === 'string');
      if (items.length > 0) output[key] = items;
      continue;
    }
    if (typeof value === 'string') {
      output[key] = value;
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      output[key] = String(value);
    }
  }
  return output;
}

export function parseListParam<T>(item: z.ZodType<T>) {
  return z.preprocess((value) => {
    if (value === undefined || value === null) return undefined;
    const raw = Array.isArray(value) ? value : [value];
    const items = raw
      .flatMap((entry) => String(entry).split(','))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    return items.length > 0 ? [...new Set(items)] : undefined;
  }, z.array(item).min(1).optional());
}

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
};

const yearBound = z.coerce.number().int().min(1900).max(2100);

export const locationsQuerySchema = z.object({
  ...pagination,
  parentId: z.string().min(1).optional(),
  level: locationLevelSchema.optional(),
});

export const projectsQuerySchema = z
  .object({
    ...pagination,
    q: z.string().trim().min(1).max(200).optional(),
    type: parseListParam(projectTypeSchema),
    status: parseListParam(projectStatusSchema),
    evidence: parseListParam(evidenceSchema),
    sector: z.string().trim().min(1).max(120).optional(),
    locationId: z.string().trim().min(1).max(120).optional(),
    yearFrom: yearBound.optional(),
    yearTo: yearBound.optional(),
    sort: z.enum(['publishedAt', 'name']).default('publishedAt'),
  })
  .refine(
    (value) => value.yearFrom === undefined || value.yearTo === undefined || value.yearFrom <= value.yearTo,
    { message: 'yearFrom must not be greater than yearTo', path: ['yearFrom'] },
  );

export const eventsQuerySchema = z.object({
  projectId: z.string().trim().min(1).max(120).optional(),
  yearFrom: yearBound.optional(),
  yearTo: yearBound.optional(),
});

export const relationsQuerySchema = z.object({
  projectId: z.string().trim().min(1).max(120),
});

/**
 * Parse `raw` and return the validated output, or throw a 400 naming `param`.
 *
 * The schema parameter pins Zod's *input* type to `unknown` on purpose. The obvious
 * `parseOr<T>(schema: z.ZodType<T>, ...): T` compiles, but `ZodType` declares both
 * `_input` and `_output`, so `T` is inferred from both and resolves to the input,
 * which is always the wider of the two. Since every schema here uses `.default()`,
 * `.coerce()` or `z.preprocess()`, callers then received `page?: number` and
 * `type?: unknown` instead of the validated output. Pinning the input to `unknown`
 * leaves the output as the only inference site, and keeps `result.data` precise
 * rather than `any`.
 */
export function parseOr<Output>(
  schema: z.ZodType<Output, z.ZodTypeDef, unknown>,
  raw: unknown,
  param: string,
): Output {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw HttpError.badRequest([
      {
        param,
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    ]);
  }
  return result.data;
}
