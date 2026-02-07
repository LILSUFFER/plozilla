import { spawn, type ChildProcess } from "child_process";
import path from "path";

const BINARY_PATH = path.resolve("engine-rust/target/release/plo5_ranker");
const MAX_CONCURRENT = 2;
const TIMEOUT_MS = 120_000;
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_SIZE = 500;

let activeJobs = 0;

interface EquityResult {
  ok: true;
  equity: number;
  equityPct: number;
  wins: number;
  ties: number;
  losses: number;
  trials: number;
  seed: number;
  elapsedMs: number;
}

interface EquityError {
  ok: false;
  error: string;
}

type EquityResponse = EquityResult | EquityError;

interface CacheEntry {
  result: EquityResult;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(hero: string, villain: string, board: string, dead: string, trials: number, seed: number): string {
  return `${hero}|${villain}|${board}|${dead}|${trials}|${seed}`;
}

function pruneCache() {
  const now = Date.now();
  const keysToDelete: string[] = [];
  cache.forEach((entry, key) => {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => cache.delete(key));
  if (cache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    for (const [key] of toRemove) {
      cache.delete(key);
    }
  }
}

export interface EquityRequest {
  game?: string;
  hero: string;
  villain: string;
  board?: string;
  dead?: string;
  trials?: number;
  seed?: number;
}

const VALID_TRIALS = [100000, 300000, 600000, 2000000];

function validateRequest(req: EquityRequest): string | null {
  if (!req.hero || typeof req.hero !== "string") {
    return "Missing or invalid 'hero' field";
  }

  const cardPattern = /^[2-9TJQKA][cdhs]$/;
  const heroCards = parseCardString(req.hero);
  if (heroCards.length !== 5) {
    return `Hero must have exactly 5 cards, got ${heroCards.length}`;
  }
  for (const c of heroCards) {
    if (!cardPattern.test(c)) {
      return `Invalid card in hero: '${c}'`;
    }
  }

  if (!req.villain || req.villain !== "100%") {
    return "Currently only villain='100%' is supported";
  }

  if (req.board && req.board.trim()) {
    const boardCards = parseCardString(req.board);
    if (boardCards.length !== 3 && boardCards.length !== 4 && boardCards.length !== 5) {
      return `Board must have 0, 3, 4, or 5 cards, got ${boardCards.length}`;
    }
  }

  if (req.trials !== undefined) {
    if (!Number.isInteger(req.trials) || req.trials < 1000 || req.trials > 5000000) {
      return "Trials must be an integer between 1,000 and 5,000,000";
    }
  }

  if (req.seed !== undefined) {
    if (!Number.isInteger(req.seed) || req.seed < 0) {
      return "Seed must be a non-negative integer";
    }
  }

  const allCards = [...heroCards];
  if (req.board && req.board.trim()) {
    allCards.push(...parseCardString(req.board));
  }
  if (req.dead && req.dead.trim()) {
    allCards.push(...parseCardString(req.dead));
  }
  const unique = new Set(allCards);
  if (unique.size !== allCards.length) {
    return "Duplicate cards found across hero, board, and dead cards";
  }

  return null;
}

function parseCardString(s: string): string[] {
  const trimmed = s.trim();
  if (!trimmed) return [];
  const cards: string[] = [];
  let i = 0;
  while (i < trimmed.length) {
    if (i + 1 < trimmed.length) {
      const two = trimmed.substring(i, i + 2);
      if (/^[2-9TJQKA][cdhs]$/.test(two)) {
        cards.push(two);
        i += 2;
        continue;
      }
    }
    i++;
  }
  return cards;
}

export async function runEquity(req: EquityRequest): Promise<EquityResponse> {
  const validationError = validateRequest(req);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const trials = req.trials || 600000;
  const seed = req.seed ?? 12345;
  const board = req.board?.trim() || "";
  const dead = req.dead?.trim() || "";

  const key = cacheKey(req.hero, req.villain, board, dead, trials, seed);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  if (activeJobs >= MAX_CONCURRENT) {
    return { ok: false, error: "Server busy, please try again in a moment" };
  }

  activeJobs++;
  try {
    const result = await spawnEquity(req.hero, board, dead, trials, seed);
    if (result.ok) {
      pruneCache();
      cache.set(key, { result, timestamp: Date.now() });
    }
    return result;
  } finally {
    activeJobs--;
  }
}

function spawnEquity(
  hero: string,
  board: string,
  dead: string,
  trials: number,
  seed: number
): Promise<EquityResponse> {
  return new Promise((resolve) => {
    const args = [
      "equity",
      "--hand", hero,
      "--trials", String(trials),
      "--seed", String(seed),
      "--json",
    ];
    if (board) {
      args.push("--board", board);
    }
    if (dead) {
      args.push("--dead", dead);
    }

    let proc: ChildProcess;
    try {
      proc = spawn(BINARY_PATH, args, {
        stdio: ["ignore", "pipe", "pipe"],
        timeout: TIMEOUT_MS,
      });
    } catch (err: any) {
      resolve({
        ok: false,
        error: `Failed to start equity engine: ${err.message}. Make sure the Rust binary is built (cd engine-rust && cargo build --release).`,
      });
      return;
    }

    let stdout = "";
    let stderr = "";
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill("SIGKILL");
        resolve({ ok: false, error: "Equity calculation timed out (120s limit)" });
      }
    }, TIMEOUT_MS);

    proc.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("error", (err: Error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({
          ok: false,
          error: `Engine error: ${err.message}. Make sure the binary exists at ${BINARY_PATH}.`,
        });
      }
    });

    proc.on("close", (code: number | null) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);

      if (code !== 0 && !stdout.trim()) {
        resolve({
          ok: false,
          error: `Engine exited with code ${code}. ${stderr.slice(0, 200)}`,
        });
        return;
      }

      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed as EquityResponse);
      } catch {
        resolve({
          ok: false,
          error: `Failed to parse engine output: ${stdout.slice(0, 200)}`,
        });
      }
    });
  });
}

export function getEquityCacheStats() {
  return {
    size: cache.size,
    activeJobs,
    maxConcurrent: MAX_CONCURRENT,
  };
}
