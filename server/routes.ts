import type { Express } from "express";
import { type Server } from "http";
import { setupCombinedAuth } from "./replit_integrations/auth";
import {
  loadRankingsFromFile,
  isRankingsReady,
  getRankingsError,
  getCalculationCallCount,
  getRankingsTotal,
  getTotalCombos,
  filterRankings,
  getRankingsPage,
  getAllHandCards,
  canonicalKey,
  lookupByCanonicalKey,
  getRankingsStatus,
} from "./rankings-cache";
import { runEquity, runBreakdown, getEquityCacheStats, getEngineStatus, logStartupStatus, type EquityRequest, type BreakdownRequest } from "./equity";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupCombinedAuth(app);

  loadRankingsFromFile();
  logStartupStatus();

  app.get('/api/rankings', (req, res) => {
    if (!isRankingsReady()) {
      const error = getRankingsError();
      return res.json({
        hands: [],
        total: 0,
        totalHands: 0,
        totalCombos: getTotalCombos(),
        ready: false,
        error: error || 'Rankings not available',
      });
    }

    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
    const maxLimit = req.query.search ? 200000 : 200;
    const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit as string) || 100));
    const search = (req.query.search as string) || '';

    if (search.trim()) {
      const result = filterRankings(search, offset, limit);
      return res.json({ ...result, totalHands: getRankingsTotal(), totalCombos: getTotalCombos(), ready: true });
    }

    const result = getRankingsPage(offset, limit);
    return res.json({ ...result, totalHands: getRankingsTotal(), totalCombos: getTotalCombos(), ready: true });
  });

  app.get('/api/rankings/status', (_req, res) => {
    res.json(getRankingsStatus());
  });

  app.get('/api/rankings/all', (_req, res) => {
    if (!isRankingsReady()) {
      return res.json({ ready: false, hands: [] });
    }
    const hands = getAllHandCards();
    return res.json({ ready: true, hands, totalHands: getRankingsTotal() });
  });

  app.get('/api/equity/status', (_req, res) => {
    const stats = getEquityCacheStats();
    const engine = getEngineStatus();
    res.json({ ...stats, ...engine });
  });

  app.post('/api/equity', async (req, res) => {
    try {
      const body = req.body as EquityRequest;
      const result = await runEquity(body);
      if (result.ok) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (err: any) {
      res.status(500).json({ ok: false, error: `Internal error: ${err.message}` });
    }
  });

  app.post('/api/equity/breakdown', async (req, res) => {
    try {
      const body = req.body as BreakdownRequest;
      const result = await runBreakdown(body);
      if (result.ok) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (err: any) {
      res.status(500).json({ ok: false, error: `Internal error: ${err.message}` });
    }
  });

  app.get('/api/rankings/lookup', (req, res) => {
    const cards = (req.query.cards as string) || '';
    const cardNums = cards.split(',').map(Number).filter(n => !isNaN(n) && n >= 0 && n < 52);
    if (cardNums.length !== 5) {
      return res.status(400).json({ error: 'Provide exactly 5 card indices (0-51) as ?cards=c0,c1,c2,c3,c4' });
    }

    if (!isRankingsReady()) {
      const error = getRankingsError();
      return res.json({ ready: false, error: error || 'Rankings not available' });
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
