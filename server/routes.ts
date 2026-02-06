import type { Express } from "express";
import { type Server } from "http";
import { setupCombinedAuth } from "./replit_integrations/auth";
import {
  loadRankingsFromDB,
  isRankingsReady,
  isSeeding,
  getSeedProgress,
  getRankingsTotal,
  filterRankings,
  getRankingsPage,
  seedRankingsInProcess,
} from "./rankings-cache";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupCombinedAuth(app);

  loadRankingsFromDB().then((ok) => {
    if (ok) {
      console.log('Rankings data ready to serve');
    } else {
      console.log('Rankings not in DB - will start seed after server is ready...');
      setTimeout(() => {
        console.log('Starting in-process seed...');
        seedRankingsInProcess();
      }, 5000);
    }
  });

  app.get('/api/rankings', (req, res) => {
    if (!isRankingsReady()) {
      return res.json({
        hands: [],
        total: 0,
        ready: false,
        seeding: isSeeding(),
        seedProgress: getSeedProgress(),
      });
    }

    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 100));
    const search = (req.query.search as string) || '';

    if (search.trim()) {
      const result = filterRankings(search, offset, limit);
      return res.json({ ...result, ready: true });
    }

    const result = getRankingsPage(offset, limit);
    return res.json({ ...result, ready: true });
  });

  app.get('/api/rankings/status', (_req, res) => {
    res.json({
      ready: isRankingsReady(),
      total: getRankingsTotal(),
      seeding: isSeeding(),
      seedProgress: getSeedProgress(),
    });
  });

  return httpServer;
}
