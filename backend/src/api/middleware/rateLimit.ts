import rateLimit from 'express-rate-limit';

/** Standard rate limiter — 100 requests per minute per IP */
export const standardLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

/** Strict rate limiter for heavy endpoints like leaderboard — 10 req/min */
export const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
