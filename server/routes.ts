import type { Express } from "express";
import { type Server } from "http";
import { setupCombinedAuth } from "./replit_integrations/auth";
import {
  loadRankingsFromDB,
  isRankingsReady,
  isSeeding,
  getSeedProgress,
  getRankingsTotal,
  getTotalCombos,
  filterRankings,
  getRankingsPage,
  seedRankingsInProcess,
  canonicalKey,
  lookupByCanonicalKey,
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
      console.log('Rankings not in DB or incomplete - will start seed after server is ready...');
      setTimeout(() => {
        console.log('Starting canonical rankings seed...');
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
      totalCombos: getTotalCombos(),
      seeding: isSeeding(),
      seedProgress: getSeedProgress(),
    });
  });

  app.get('/api/rankings/lookup', (req, res) => {
    const cards = (req.query.cards as string) || '';
    const cardNums = cards.split(',').map(Number).filter(n => !isNaN(n) && n >= 0 && n < 52);
    if (cardNums.length !== 5) {
      return res.status(400).json({ error: 'Provide exactly 5 card indices (0-51) as ?cards=c0,c1,c2,c3,c4' });
    }

    if (!isRankingsReady()) {
      return res.json({ ready: false, seeding: isSeeding(), seedProgress: getSeedProgress() });
    }

    const key = canonicalKey(cardNums[0], cardNums[1], cardNums[2], cardNums[3], cardNums[4]);
    const hand = lookupByCanonicalKey(key);
    if (!hand) {
      return res.status(404).json({ error: 'Hand not found', canonicalKey: key });
    }
    return res.json({ ready: true, canonicalKey: key, hand, totalHands: getRankingsTotal() });
  });

  return httpServer;
}
