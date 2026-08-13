import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { fetchAllStarSystems, fetchStarSystemById } from '../../db/queries';

export function createGalaxyRouter(db: Pool): Router {
  const router = Router();

  router.get('/', fetchGalaxyGrid(db));
  router.get('/:systemId', fetchSingleSystem(db));

  return router;
}

/** Returns the full galaxy grid */
function fetchGalaxyGrid(db: Pool) {
  return async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const systems = await fetchAllStarSystems(db);
      res.json({ systems });
    } catch (err) {
      next(err);
    }
  };
}

/** Returns a single star system by ID */
function fetchSingleSystem(db: Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const systemId = parseSystemId(req.params.systemId);
      const system = await fetchStarSystemById(db, systemId);

      if (!system) {
        res.status(404).json({ error: 'System not found' });
        return;
      }

      res.json({ system });
    } catch (err) {
      next(err);
    }
  };
}

/** Parses and validates a system ID from a route param */
function parseSystemId(raw: string): number {
  const id = parseInt(raw, 10);
  if (isNaN(id) || id < 0) {
    throw Object.assign(new Error('Invalid system ID'), { statusCode: 400 });
  }
  return id;
}
