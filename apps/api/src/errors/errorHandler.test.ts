import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from '../config/logger.ts';
import { errorHandler, notFoundHandler } from './errorHandler.ts';
import { HttpError } from './HttpError.ts';
import { requestId } from '../middleware/requestId.ts';

function stubLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } satisfies Logger & Record<string, unknown>;
}

function build(logger: Logger, bodyLimit = '1mb') {
  const app = express();
  app.use(requestId);
  app.use(express.json({ limit: bodyLimit }));
  app.get('/boom', () => {
    throw new Error('connect ECONNREFUSED 127.0.0.1:5432');
  });
  app.get('/denied', () => {
    throw HttpError.internal(new Error('relation "projects_type_check" violates check constraint'));
  });
  app.get('/invalid', () => {
    throw HttpError.badRequest([{ path: 'yearFrom', message: 'not a number' }]);
  });
  app.get('/gone', () => {
    throw HttpError.notFound('No project with that id');
  });
  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}

describe('errorHandler', () => {
  let logger: ReturnType<typeof stubLogger>;

  beforeEach(() => {
    logger = stubLogger();
  });

  // Spec §11.6: a database message or a connection refusal must never reach the
  // client. This is the assertion that would catch a future edit swapping
  // `error.message` for the internal cause.
  it('never serialises the cause of a 500', async () => {
    const res = await request(build(logger)).get('/denied');
    expect(res.status).toBe(500);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('projects_type_check');
    expect(body).not.toContain('check constraint');
    expect(res.body.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Unexpected server error',
      details: [],
      requestId: expect.any(String),
    });
  });

  it('never serialises the message of an unexpected error', async () => {
    const res = await request(build(logger)).get('/boom');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
    expect(res.body.error.message).toBe('Unexpected server error');
  });

  it('logs the original message and stack of an unexpected error', async () => {
    await request(build(logger)).get('/boom');
    expect(logger.error).toHaveBeenCalledOnce();
    const meta = logger.error.mock.calls[0]![1] as Record<string, unknown>;
    expect(meta.message).toContain('ECONNREFUSED');
    expect(meta.stack).toBeTruthy();
  });

  it('does not log a deliberate HttpError as an unhandled error', async () => {
    await request(build(logger)).get('/invalid');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('preserves the code, message and details of a 400', async () => {
    const res = await request(build(logger)).get('/invalid');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual([{ path: 'yearFrom', message: 'not a number' }]);
  });

  it('preserves a custom 404 message', async () => {
    const res = await request(build(logger)).get('/gone');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toBe('No project with that id');
  });

  it('answers an unknown verb on a known path with 404, not 405', async () => {
    const res = await request(build(logger)).post('/invalid');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('names the method and path in the 404 envelope', async () => {
    const res = await request(build(logger)).get('/nowhere');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('No route for GET /nowhere');
  });

  it('normalises an oversized body into the shared envelope', async () => {
    const res = await request(build(logger, '10b'))
      .post('/invalid')
      .set('content-type', 'application/json')
      .send(JSON.stringify({ pad: 'x'.repeat(200) }));
    expect(res.status).toBe(413);
    expect(res.body.error).toEqual({
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body exceeds the 1mb limit',
      details: [],
      requestId: expect.any(String),
    });
  });

  it('echoes a short incoming request id into the envelope and the header', async () => {
    const res = await request(build(logger)).get('/gone').set('x-request-id', 'trace-42');
    expect(res.body.error.requestId).toBe('trace-42');
    expect(res.headers['x-request-id']).toBe('trace-42');
  });

  it('falls back to unknown when no request id middleware ran', async () => {
    const app = express();
    app.get('/gone', () => {
      throw HttpError.notFound();
    });
    app.use(notFoundHandler);
    app.use(errorHandler(logger));
    const res = await request(app).get('/gone');
    expect(res.body.error.requestId).toBe('unknown');
  });
});
