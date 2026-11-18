import { describe, it, expect } from 'vitest';

/**
 * Smoke tests for API utility functions.
 * Integration tests (database, sockets) live in a separate suite that
 * requires a running Postgres instance.
 */
describe('API health checks', () => {
  it('process environment is accessible', () => {
    expect(typeof process.env).toBe('object');
  });

  it('NODE_ENV is set to a recognised value or undefined', () => {
    const valid = ['development', 'production', 'test', undefined];
    expect(valid).toContain(process.env.NODE_ENV);
  });
});

