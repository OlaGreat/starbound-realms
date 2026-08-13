import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { fetchRecentBattles, fetchBattleById } from '../../db/queries';

export function createBattleRouter(db: Pool): Router {
  const router = Router();

  router.get('/', fetchBattlesList(db));
  router.get('/:battleId', fetchSingleBattle(db));

  return router;
}

/** Returns paginated list of recent battles */
function fetchBattlesList(db: Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { limit, offset } = parsePaginationParams(req.query);
      const battles = await fetchRecentBattles(db, limit, offset);
      res.json({ battles, limit, offset });
    } catch (err) {
      next(err);
    }
  };
}

/** Returns a single battle by ID */
function fetchSingleBattle(db: Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const battleId = parseBattleId(req.params.battleId);
      const battle = await fetchBattleById(db, battleId);

      if (!battle) {
        res.status(404).json({ error: 'Battle not found' });
        return;
      }

      res.json({ battle });
    } catch (err) {
      next(err);
    }
  };
}

/** Parses and validates pagination query params */
function parsePaginationParams(query: Record<string, any>): { limit: number; offset: number } {
  const limit = Math.min(parseInt(query.limit ?? '20', 10) || 20, 100);
  const offset = parseInt(query.offset ?? '0', 10) || 0;
  return { limit, offset };
}

/** Parses and validates a battle ID from a route param */
function parseBattleId(raw: string): number {
  const id = parseInt(raw, 10);
  if (isNaN(id) || id < 0) {
    throw Object.assign(new Error('Invalid battle ID'), { statusCode: 400 });
  }
  return id;
}
