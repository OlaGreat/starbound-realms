import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from 'vitest';
import express from 'express';
import request from 'supertest';

function buildApp(limiter: express.RequestHandler) {
  const app = express();

  app.get('/ping', limiter, (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('standardLimiter', () => {
  it('allows requests under the 100-per-minute limit', async () => {
    const { standardLimiter } = await import('./rateLimit');
    const app = buildApp(standardLimiter);

    const res = await request(app).get('/ping');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('exposes RateLimit headers and not legacy X-RateLimit headers', async () => {
    const { standardLimiter } = await import('./rateLimit');
    const res = await request(buildApp(standardLimiter)).get('/ping');

    expect(res.headers).toHaveProperty('ratelimit-limit', '100');
    expect(res.headers).not.toHaveProperty('x-ratelimit-limit');
  });

  it('returns 429 when the standard limit is exceeded', async () => {
    const { standardLimiter } = await import('./rateLimit');
    const app = buildApp(standardLimiter);

    for (let i = 0; i < 100; i++) {
      await request(app).get('/ping');
    }

    const res = await request(app).get('/ping');

    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: 'Too many requests, please try again later.',
    });
  });

  it('uses the configured standard request limit', async () => {
    vi.stubEnv('RATE_LIMIT_MAX_REQUESTS', '2');

    const { standardLimiter } = await import('./rateLimit');
    const app = buildApp(standardLimiter);

    expect((await request(app).get('/ping')).status).toBe(200);
    expect((await request(app).get('/ping')).status).toBe(200);

    const res = await request(app).get('/ping');

    expect(res.status).toBe(429);
    expect(res.headers).toHaveProperty('ratelimit-limit', '2');
  });

  it('uses the configured standard window', async () => {
    vi.stubEnv('RATE_LIMIT_WINDOW_MS', '1000');
    vi.stubEnv('RATE_LIMIT_MAX_REQUESTS', '1');

    const { standardLimiter } = await import('./rateLimit');
    const res = await request(buildApp(standardLimiter)).get('/ping');

    expect(res.headers).toHaveProperty('ratelimit-limit', '1');
    expect(res.status).toBe(200);
  });

  it('resets the standard limit after the configured window', async () => {
    vi.stubEnv('RATE_LIMIT_WINDOW_MS', '100');
    vi.stubEnv('RATE_LIMIT_MAX_REQUESTS', '1');

    const { standardLimiter } = await import('./rateLimit');
    const app = buildApp(standardLimiter);

    const first = await request(app).get('/ping');
    expect(first.status).toBe(200);

    const second = await request(app).get('/ping');
    expect(second.status).toBe(429);

    await new Promise((resolve) => setTimeout(resolve, 200));

    const third = await request(app).get('/ping');
    expect(third.status).toBe(200);
  });
});

describe('strictLimiter', () => {
  it('allows requests under the 10-per-minute limit', async () => {
    const { strictLimiter } = await import('./rateLimit');
    const res = await request(buildApp(strictLimiter)).get('/ping');

    expect(res.status).toBe(200);
    expect(res.headers).toHaveProperty('ratelimit-limit', '10');
  });

  it('returns 429 when the strict limit is exceeded', async () => {
    const { strictLimiter } = await import('./rateLimit');
    const app = buildApp(strictLimiter);

    for (let i = 0; i < 10; i++) {
      await request(app).get('/ping');
    }

    const res = await request(app).get('/ping');

    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: 'Too many requests, please try again later.',
    });
  });

  it('uses the configured strict request limit', async () => {
    vi.stubEnv('STRICT_RATE_LIMIT_MAX_REQUESTS', '2');

    const { strictLimiter } = await import('./rateLimit');
    const app = buildApp(strictLimiter);

    await request(app).get('/ping');
    await request(app).get('/ping');

    const res = await request(app).get('/ping');

    expect(res.status).toBe(429);
    expect(res.headers).toHaveProperty('ratelimit-limit', '2');
  });
});