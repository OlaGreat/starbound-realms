import express from 'express';
import { Pool } from 'pg';
import { createGalaxyRouter } from './api/routes/galaxy';
import { createPlayerRouter } from './api/routes/player';
import { createBattleRouter } from './api/routes/battle';
import { createFleetRouter } from './api/routes/fleet';
import { standardLimiter, strictLimiter } from './api/middleware/rateLimit';
import { errorHandler } from './api/middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3000;

// ── Database ──────────────────────────────────────────────────────────────────

const db = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json());
app.use(standardLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/health', handleHealthCheck);
app.use('/galaxy', createGalaxyRouter(db));
app.use('/player', createPlayerRouter(db));
app.use('/battles', createBattleRouter(db));
app.use('/fleet', createFleetRouter(db));
app.get('/leaderboard', strictLimiter, handleLeaderboard(db));

// ── Error handler (must be last) ──────────────────────────────────────────────

app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Starbound Realms API running on port ${PORT}`);
});

export default app;

// ── Handlers ──────────────────────────────────────────────────────────────────

function handleHealthCheck(_req: express.Request, res: express.Response) {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
}

function handleLeaderboard(db: Pool) {
  return async (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const { fetchLeaderboard } = await import('./db/queries');
      const players = await fetchLeaderboard(db);
      res.json({ players });
    } catch (err) {
      next(err);
    }
  };
}
