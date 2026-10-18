import rateLimit from 'express-rate-limit';

/** Standard rate limiter — 100 requests per minute per IP */
export const standardLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

/** Strict rate limiter for heavy endpoints like leaderboard — 10 req/min */
export const strictLimiter = rateLimit({
  windowMs: Number(process.env.STRICT_RATE_LIMIT_WINDOW_MS) || 60_000,
  max: Number(process.env.STRICT_RATE_LIMIT_MAX_REQUESTS) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
