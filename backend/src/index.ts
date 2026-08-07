import express from 'express';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Galaxy routes
app.get('/galaxy', (_req, res) => {
  // TODO: query indexed galaxy state from PostgreSQL
  res.json({
    message: 'Galaxy endpoint — implementation in progress',
    systems: [],
  });
});

app.get('/galaxy/:systemId', (req, res) => {
  const { systemId } = req.params;
  // TODO: query single system from PostgreSQL
  res.json({
    message: `System ${systemId} — implementation in progress`,
    system: null,
  });
});

// Player routes
app.get('/player/:address', (req, res) => {
  const { address } = req.params;
  // TODO: query player profile from PostgreSQL
  res.json({
    message: `Player ${address} — implementation in progress`,
    player: null,
  });
});

// Leaderboard
app.get('/leaderboard', (_req, res) => {
  // TODO: query top players from PostgreSQL
  res.json({ message: 'Leaderboard — implementation in progress', players: [] });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Starbound Realms API running on port ${PORT}`);
});

export default app;
