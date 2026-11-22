import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../db/queries', () => ({
  fetchGalaxyStats: vi.fn(),
}));

import { fetchGalaxyStats } from '../../db/queries';
import { createStatsRouter } from './stats';

const db = {} as any;

function buildApp() {
  const app = express();
  app.use('/stats', createStatsRouter(db));
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.statusCode ?? 500).json({ error: err.message });
  });
  return app;
}

beforeEach(() => {
  vi.mocked(fetchGalaxyStats).mockReset();
});

describe('GET /stats', () => {
  it('returns aggregate galaxy counts', async () => {
    const stats = { systemsClaimed: 42, battlesFought: 17, players: 8 };
    vi.mocked(fetchGalaxyStats).mockResolvedValue(stats);

    const res = await request(buildApp()).get('/stats');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(stats);
    expect(fetchGalaxyStats).toHaveBeenCalledWith(db);
  });

  it('returns zero counts when the database has no records', async () => {
    vi.mocked(fetchGalaxyStats).mockResolvedValue({ systemsClaimed: 0, battlesFought: 0, players: 0 });

    const res = await request(buildApp()).get('/stats');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ systemsClaimed: 0, battlesFought: 0, players: 0 });
  });

  it('forwards database errors to the error handler', async () => {
    vi.mocked(fetchGalaxyStats).mockRejectedValue(new Error('db down'));

    const res = await request(buildApp()).get('/stats');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'db down' });
  });
});
