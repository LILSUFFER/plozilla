import { spawn, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";

const BINARY_PATH = path.resolve("engine-rust/target/release/plo5_ranker");
const RANK_FILE = path.resolve(process.env.RANK_FILE_PATH || "public/rank_index_all_2598960.u32");
const PROD_BIN = path.resolve(process.env.PROD_BIN_PATH || "public/plo5_rankings_prod.bin");
const MAX_CONCURRENT = 2;
const TIMEOUT_MS = 120_000;
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_SIZE = 500;

const REMOTE_URL = process.env.EQUITY_ENGINE_URL || "";
const FORCE_REMOTE = process.env.FORCE_REMOTE_EQUITY === "true";

let activeJobs = 0;
let rankFileAvailable: boolean | null = null;

function isRankFileAvailable(): boolean {
  if (rankFileAvailable === null) {
    try {
      const stat = fs.statSync(RANK_FILE);
      rankFileAvailable = stat.size === 2598960 * 4;
    } catch {
      rankFileAvailable = false;
    }
  }
  return rankFileAvailable;
}

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
  villainRange?: string;
  engineMode?: "remote" | "local";
  engineElapsedMs?: number;
  threadsUsed?: number;
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

function parseVillainRange(v: string): { valid: boolean; pct: number; isRange: boolean } {
  const s = v.trim().toLowerCase();
  if (s === "100%") return { valid: true, pct: 100, isRange: false };
  const m = s.match(/^(\d+(?:\.\d+)?)%$/);
  if (m) {
    const pct = parseFloat(m[1]);
    if (pct === 100) return { valid: true, pct: 100, isRange: false };
    if (pct > 0 && pct < 100) return { valid: true, pct, isRange: true };
  }
  return { valid: false, pct: 0, isRange: false };
}

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

  if (!req.villain || typeof req.villain !== "string") {
    return "Missing or invalid 'villain' field";
  }
  const vr = parseVillainRange(req.villain);
  if (!vr.valid) {
    return `Invalid villain range: '${req.villain}'. Use 'N%' (e.g. '10%', '20%', '100%')`;
  }
  if (vr.isRange && !isRankFileAvailable()) {
    return "Rank index file not available. Range-based villain requires precomputed data.";
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

const SUIT_ORDER = ['h', 'd', 'c', 's'] as const;
const VALID_RANKS = new Set('23456789TJQKA'.split(''));

function normalizeBoardShorthand(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return '';
  const suited = parseCardString(trimmed);
  if (suited.length > 0) return suited.join('');

  const ranks: string[] = [];
  let i = 0;
  while (i < trimmed.length) {
    if (trimmed[i] === '1' && trimmed[i + 1] === '0') {
      ranks.push('T');
      i += 2;
    } else {
      const r = trimmed[i].toUpperCase();
      if (!VALID_RANKS.has(r)) return trimmed;
      ranks.push(r);
      i += 1;
    }
  }
  if (ranks.length < 3 || ranks.length > 5) return trimmed;

  const used = new Set<string>();
  const result: string[] = [];
  for (const rank of ranks) {
    let assigned = false;
    for (const suit of SUIT_ORDER) {
      const card = `${rank}${suit}`;
      if (!used.has(card)) {
        result.push(card);
        used.add(card);
        assigned = true;
        break;
      }
    }
    if (!assigned) return trimmed;
  }
  return result.join('');
}

export async function runEquity(req: EquityRequest): Promise<EquityResponse> {
  if (req.board) {
    req.board = normalizeBoardShorthand(req.board);
  }
  const validationError = validateRequest(req);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const trials = req.trials || 600000;
  const seed = req.seed ?? 12345;
  const board = req.board?.trim() || "";
  const dead = req.dead?.trim() || "";
  const villain = req.villain.trim();

  const key = cacheKey(req.hero, villain, board, dead, trials, seed);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  if (activeJobs >= MAX_CONCURRENT) {
    return { ok: false, error: "Server busy, please try again in a moment" };
  }

  if (FORCE_REMOTE && !REMOTE_URL) {
    return { ok: false, error: "FORCE_REMOTE_EQUITY is enabled but EQUITY_ENGINE_URL is not set. Cannot compute locally." };
  }

  activeJobs++;
  try {
    let result: EquityResponse;
    if (REMOTE_URL) {
      result = await remoteEquity(req.hero, villain, board, dead, trials, seed);
    } else {
      result = await spawnEquity(req.hero, villain, board, dead, trials, seed);
    }
    if (result.ok) {
      pruneCache();
      cache.set(key, { result, timestamp: Date.now() });
    }
    return result;
  } finally {
    activeJobs--;
  }
}

function toRemoteVillainFormat(villain: string): string {
  const vr = parseVillainRange(villain);
  if (!vr.valid) return villain;
  if (!vr.isRange) return "100%";
  return `top${vr.pct}%`;
}

async function remoteEquity(
  hero: string,
  villain: string,
  board: string,
  dead: string,
  trials: number,
  seed: number
): Promise<EquityResponse> {
  const url = REMOTE_URL.replace(/\/$/, "") + "/api/equity";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const remoteVillain = toRemoteVillainFormat(villain);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hero, villain: remoteVillain, board: board || undefined, dead: dead || undefined, trials, seed }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await resp.json() as any;
    if (data.ok) {
      data.engineMode = "remote";
      data.villainRange = villain;
    }
    return data as EquityResponse;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      return { ok: false, error: `Remote engine timed out (${TIMEOUT_MS / 1000}s limit)` };
    }
    return { ok: false, error: `Remote engine error: ${err.message}` };
  }
}

function spawnEquity(
  hero: string,
  villain: string,
  board: string,
  dead: string,
  trials: number,
  seed: number
): Promise<EquityResponse> {
  return new Promise((resolve) => {
    const vr = parseVillainRange(villain);
    const villainRangeArg = vr.isRange ? `${vr.pct}%` : "100%";

    const threadsArg = process.env.EQUITY_THREADS ?? "auto";
    const args = [
      "equity",
      "--hand", hero,
      "--trials", String(trials),
      "--seed", String(seed),
      "--villain-range", villainRangeArg,
      "--threads", threadsArg,
      "--json",
    ];
    if (vr.isRange) {
      args.push("--rank-file", RANK_FILE);
      args.push("--bin", PROD_BIN);
    }
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
        if (parsed.ok) {
          parsed.engineMode = "local";
        }
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

export interface BreakdownRequest {
  hero: string;
  board: string;
  dead?: string;
  trialsBudget?: number;
  seed?: number;
  villainRange?: string;
}

interface BreakdownItem {
  card: string;
  equity: number;
  trials: number;
}

interface BreakdownResult {
  ok: true;
  street: string;
  items: BreakdownItem[];
  excluded: string[];
  totalTrials: number;
  trialsPerCard: number;
  numCandidates: number;
  seed: number;
  elapsedMs: number;
  villainRange: string;
}

type BreakdownResponse = BreakdownResult | EquityError;

function validateBreakdownRequest(req: BreakdownRequest): string | null {
  if (!req.hero || typeof req.hero !== "string") {
    return "Missing or invalid 'hero' field";
  }
  const cardPattern = /^[2-9TJQKA][cdhs]$/;
  const heroCards = parseCardString(req.hero);
  if (heroCards.length !== 5) {
    return `Hero must have exactly 5 cards, got ${heroCards.length}`;
  }
  for (const c of heroCards) {
    if (!cardPattern.test(c)) return `Invalid card in hero: '${c}'`;
  }

  if (!req.board || typeof req.board !== "string") {
    return "Missing or invalid 'board' field";
  }
  const boardCards = parseCardString(req.board);
  if (boardCards.length !== 3 && boardCards.length !== 4) {
    return `Breakdown requires board of 3 (flop) or 4 (turn) cards, got ${boardCards.length}`;
  }

  if (req.villainRange) {
    const vr = parseVillainRange(req.villainRange);
    if (!vr.valid) {
      return `Invalid villain range: '${req.villainRange}'`;
    }
    if (vr.isRange && !isRankFileAvailable()) {
      return "Rank index file not available for range-based villain";
    }
  }

  if (req.trialsBudget !== undefined) {
    if (!Number.isInteger(req.trialsBudget) || req.trialsBudget < 1000 || req.trialsBudget > 5000000) {
      return "trialsBudget must be between 1,000 and 5,000,000";
    }
  }

  if (req.seed !== undefined) {
    if (!Number.isInteger(req.seed) || req.seed < 0) {
      return "Seed must be a non-negative integer";
    }
  }

  const allCards = [...heroCards, ...boardCards];
  if (req.dead && req.dead.trim()) {
    allCards.push(...parseCardString(req.dead));
  }
  const unique = new Set(allCards);
  if (unique.size !== allCards.length) {
    return "Duplicate cards found across hero, board, and dead cards";
  }

  return null;
}

export async function runBreakdown(req: BreakdownRequest): Promise<BreakdownResponse> {
  if (req.board) {
    req.board = normalizeBoardShorthand(req.board);
  }
  const validationError = validateBreakdownRequest(req);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  if (activeJobs >= MAX_CONCURRENT) {
    return { ok: false, error: "Server busy, please try again in a moment" };
  }

  if (FORCE_REMOTE && !REMOTE_URL) {
    return { ok: false, error: "FORCE_REMOTE_EQUITY is enabled but EQUITY_ENGINE_URL is not set. Cannot compute locally." };
  }

  activeJobs++;
  try {
    let result: BreakdownResponse;
    if (REMOTE_URL) {
      result = await remoteBreakdown(req);
    } else {
      result = await spawnBreakdown(req);
    }
    return result;
  } finally {
    activeJobs--;
  }
}

async function remoteBreakdown(req: BreakdownRequest): Promise<BreakdownResponse> {
  const url = REMOTE_URL.replace(/\/$/, "") + "/api/equity/breakdown";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const remoteReq = { ...req };
    if (remoteReq.villainRange) {
      remoteReq.villainRange = toRemoteVillainFormat(remoteReq.villainRange);
    }
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(remoteReq),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await resp.json() as BreakdownResponse;
    if (data.ok && req.villainRange) {
      data.villainRange = req.villainRange;
    }
    return data;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      return { ok: false, error: `Remote engine timed out` };
    }
    return { ok: false, error: `Remote engine error: ${err.message}` };
  }
}

function spawnBreakdown(req: BreakdownRequest): Promise<BreakdownResponse> {
  return new Promise((resolve) => {
    const trialsBudget = req.trialsBudget || 600000;
    const seed = req.seed ?? 12345;
    const board = req.board.trim();
    const dead = req.dead?.trim() || "";
    const villainRange = req.villainRange?.trim() || "100%";
    const vr = parseVillainRange(villainRange);
    const villainRangeArg = vr.isRange ? `${vr.pct}%` : "100%";

    const threadsArg = process.env.EQUITY_THREADS ?? "auto";
    const args = [
      "breakdown",
      "--hand", req.hero,
      "--board", board,
      "--trials-budget", String(trialsBudget),
      "--seed", String(seed),
      "--villain-range", villainRangeArg,
      "--threads", threadsArg,
      "--json",
    ];
    if (vr.isRange) {
      args.push("--rank-file", RANK_FILE);
      args.push("--bin", PROD_BIN);
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
      resolve({ ok: false, error: `Failed to start engine: ${err.message}` });
      return;
    }

    let stdout = "";
    let stderr = "";
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill("SIGKILL");
        resolve({ ok: false, error: "Breakdown timed out (120s limit)" });
      }
    }, TIMEOUT_MS);

    proc.stdout?.on("data", (data: Buffer) => { stdout += data.toString(); });
    proc.stderr?.on("data", (data: Buffer) => { stderr += data.toString(); });

    proc.on("error", (err: Error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({ ok: false, error: `Engine error: ${err.message}` });
      }
    });

    proc.on("close", (code: number | null) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      if (code !== 0 && !stdout.trim()) {
        resolve({ ok: false, error: `Engine exited with code ${code}. ${stderr.slice(0, 200)}` });
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed as BreakdownResponse);
      } catch {
        resolve({ ok: false, error: `Failed to parse engine output: ${stdout.slice(0, 200)}` });
      }
    });
  });
}

export function getEquityCacheStats() {
  return {
    size: cache.size,
    activeJobs,
    maxConcurrent: MAX_CONCURRENT,
    mode: REMOTE_URL ? "remote" : "local",
    forceRemote: FORCE_REMOTE,
    rankFileAvailable: isRankFileAvailable(),
  };
}

let binaryAvailable: boolean | null = null;
let prodBinAvailable: boolean | null = null;

function checkBinaryAvailable(): boolean {
  if (binaryAvailable === null) {
    try {
      fs.accessSync(BINARY_PATH, fs.constants.X_OK);
      binaryAvailable = true;
    } catch {
      binaryAvailable = false;
    }
  }
  return binaryAvailable;
}

function checkProdBinAvailable(): boolean {
  if (prodBinAvailable === null) {
    try {
      const stat = fs.statSync(PROD_BIN);
      prodBinAvailable = stat.size > 0;
    } catch {
      prodBinAvailable = false;
    }
  }
  return prodBinAvailable;
}

export function getEngineStatus() {
  const binary = checkBinaryAvailable();
  const rankFile = isRankFileAvailable();
  const prodBin = checkProdBinAvailable();
  const rangeReady = binary && rankFile && prodBin;
  const baseReady = binary || !!REMOTE_URL;

  return {
    binary: { path: BINARY_PATH, available: binary },
    rankFile: { path: RANK_FILE, available: rankFile, expectedSize: 2598960 * 4 },
    prodBin: { path: PROD_BIN, available: prodBin },
    engine: {
      mode: REMOTE_URL ? "remote" : "local",
      remoteUrl: REMOTE_URL || null,
      forceRemote: FORCE_REMOTE,
      maxConcurrent: MAX_CONCURRENT,
      activeJobs,
    },
    capabilities: {
      baseEquity: baseReady,
      rangeEquity: rangeReady,
      rankIndexMode: rangeReady ? "concrete_combo_uniform" : null,
      totalConcrete: rangeReady ? 2598960 : null,
    },
    cache: {
      size: cache.size,
      maxSize: MAX_CACHE_SIZE,
      ttlMs: CACHE_TTL_MS,
    },
  };
}

export function logStartupStatus() {
  const status = getEngineStatus();
  console.log("[equity] Engine status:");
  console.log(`  Binary:     ${status.binary.available ? "OK" : "MISSING"} (${status.binary.path})`);
  console.log(`  Rank file:  ${status.rankFile.available ? "OK" : "MISSING"} (${status.rankFile.path})`);
  console.log(`  Prod bin:   ${status.prodBin.available ? "OK" : "MISSING"} (${status.prodBin.path})`);
  console.log(`  Mode:       ${status.engine.mode}${status.engine.forceRemote ? " (forced)" : ""}`);
  console.log(`  Range mode: ${status.capabilities.rangeEquity ? "READY (concrete_combo_uniform, 2,598,960 hands)" : "NOT AVAILABLE"}`);
  console.log(`  Base equity: ${status.capabilities.baseEquity ? "READY" : "NOT AVAILABLE"}`);
}
