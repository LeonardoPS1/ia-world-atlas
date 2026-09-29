import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from './logger.ts';

describe('createLogger', () => {
  let out: string[];
  let err: string[];
  // `process.stdout.write` is overloaded, so `ReturnType<typeof vi.spyOn>` does
  // not describe the instance that `spyOn` actually returns. A structural type is
  // all the test needs from it.
  let restore: Array<() => void>;

  beforeEach(() => {
    out = [];
    err = [];
    const capture =
      (sink: string[]) =>
      (chunk: unknown): boolean => {
        sink.push(String(chunk));
        return true;
      };
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(capture(out) as never);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(capture(err) as never);
    restore = [() => stdout.mockRestore(), () => stderr.mockRestore()];
  });

  afterEach(() => {
    for (const fn of restore) fn();
  });

  it('drops everything below the configured level', () => {
    const log = createLogger('warn');
    log.debug('d');
    log.info('i');
    expect(out).toEqual([]);
  });

  it('still emits the level itself and everything above it', () => {
    const log = createLogger('warn');
    log.warn('w');
    log.error('e');
    expect(out).toHaveLength(1);
    expect(err).toHaveLength(1);
  });

  it('lets everything through at debug', () => {
    const log = createLogger('debug');
    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');
    expect(out).toHaveLength(3);
    expect(err).toHaveLength(1);
  });

  // A logger that silently swallows errors costs an incident its evidence, and
  // nothing in the request path would notice. This is the assertion that fails
  // if the threshold comparison is ever inverted.
  it('never drops an error, whatever the level', () => {
    for (const level of ['debug', 'info', 'warn', 'error'] as const) {
      // `err.length = 0`, not `err = []`: the spy closed over the original array
      // in beforeEach, so reassigning the binding would leave it writing to an
      // array this test no longer reads.
      err.length = 0;
      createLogger(level).error('boom', { requestId: 'abc' });
      expect(err).toHaveLength(1);
    }
  });

  it('sends error to stderr and everything else to stdout', () => {
    const log = createLogger('debug');
    log.info('i');
    expect(err).toEqual([]);
    expect(out).toHaveLength(1);
  });

  it('serialises severity, message and metadata as one json line', () => {
    createLogger('info').info('hello', { requestId: 'abc', n: 2 });
    expect(JSON.parse(out[0]!)).toEqual({
      severity: 'info',
      message: 'hello',
      requestId: 'abc',
      n: 2,
    });
  });

  it('omits metadata entirely when none is given', () => {
    createLogger('info').info('bare');
    expect(JSON.parse(out[0]!)).toEqual({ severity: 'info', message: 'bare' });
  });
});
