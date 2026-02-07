import { useState, useCallback, useRef } from 'react';
import { type Card } from '@/lib/poker-evaluator';
import { parseCardsConcat, type PlayerInput, type CalculationResult } from '@/lib/equity-calculator';
import { calculateEquityFast } from '@/lib/wasm-equity';
import { getCachedEquity, setCachedEquity, getMemoryCacheSize } from '@/lib/equity-cache';
import { parseRange, getRandomHandFromRange, generateRandomHandFromPattern } from '@/lib/range-parser';
import { parseHandHistory, getStreetBoard, getStreetName, type ParsedHandHistory } from '@/lib/hand-history-parser';
import { mulberry32 } from '@/lib/seeded-rng';
import { Card as UICard, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PlayingCard } from './PlayingCard';
import { CardChips } from './CardChip';
import { Play, Trash2, Plus, RotateCcw, Calculator, ClipboardPaste, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

const ALL_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const ALL_SUITS = ['s', 'h', 'd', 'c'];

const FULL_DECK: Card[] = [];
for (const r of ALL_RANKS) {
  for (const s of ALL_SUITS) {
    FULL_DECK.push({ rank: r, suit: s } as Card);
  }
}

function cardKey(c: Card): string {
  return `${c.rank}${c.suit}`;
}

function buildAvailableDeck(usedKeys: Set<string>): Card[] {
  const avail: Card[] = [];
  for (let i = 0; i < FULL_DECK.length; i++) {
    if (!usedKeys.has(cardKey(FULL_DECK[i]))) {
      avail.push(FULL_DECK[i]);
    }
  }
  return avail;
}

function sampleCards(available: Card[], count: number, rng: () => number): Card[] {
  const arr = [...available];
  const result: Card[] = [];
  for (let i = 0; i < count && arr.length > 0; i++) {
    const idx = Math.floor(rng() * arr.length);
    result.push(arr[idx]);
    arr[idx] = arr[arr.length - 1];
    arr.pop();
  }
  return result;
}

const TRIAL_PRESETS = [
  { label: 'trialsShort100k', value: 100000 },
  { label: 'trialsShort300k', value: 300000 },
  { label: 'trialsShort600k', value: 600000 },
  { label: 'trialsShort2m', value: 2000000 },
] as const;

interface PlayerRowProps {
  player: PlayerInput;
  onInputChange: (id: number, input: string) => void;
  onRemove: (id: number) => void;
  equity?: number;
  isWinner?: boolean;
  disabled?: boolean;
  allUsedCards: Set<string>;
  heroLabel: string;
  playerLabel: string;
  combosLabel: string;
  need5CardsLabel: string;
}

function PlayerRow({ player, onInputChange, onRemove, equity, isWinner, disabled, allUsedCards, heroLabel, playerLabel, combosLabel, need5CardsLabel }: PlayerRowProps) {
  const handleChange = (value: string) => {
    onInputChange(player.id, value);
  };
  
  const hasError = player.input.length > 0 && player.cards.length === 0 && !player.isRange;
  const hasWrongCount = !player.isRange && player.cards.length > 0 && player.cards.length !== 5;
  
  return (
    <div className={cn(
      'flex items-center gap-2 p-2 rounded-md border transition-all',
      isWinner ? 'border-green-500 bg-green-500/10' : 'border-muted',
      (hasError || hasWrongCount) && 'border-destructive'
    )}>
      <div className="w-16 text-sm font-medium text-muted-foreground">
        {player.id === 1 ? heroLabel : `${playerLabel} ${player.id}`}
      </div>
      
      <div className="flex-1">
        <Input
          value={player.input}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="AA, AK$s, KK+"
          className={cn(
            'font-mono text-sm',
            (hasError || hasWrongCount) && 'border-destructive'
          )}
          disabled={disabled}
          data-testid={`input-player-${player.id}`}
        />
      </div>
      
      <div className="flex gap-0.5 min-w-[140px] items-center">
        {player.isRange ? (
          <Badge variant="secondary" className="text-xs" data-testid={`badge-combo-${player.id}`}>
            {player.comboCount} {combosLabel}
          </Badge>
        ) : (
          <>
            <CardChips cards={player.cards.slice(0, 5)} size="sm" />
            {Array.from({ length: Math.max(0, 5 - player.cards.length) }).map((_, i) => (
              <div 
                key={`empty-${i}`}
                className="w-6 h-7 rounded border border-dashed border-muted-foreground/30 bg-muted/30"
              />
            ))}
          </>
        )}
        {hasWrongCount && (
          <span className="text-xs text-destructive ml-1" data-testid={`text-need5-${player.id}`}>
            {need5CardsLabel}
          </span>
        )}
      </div>
      
      {equity !== undefined && (
        <div className="w-24 text-right">
          <span className={cn(
            'font-mono font-bold',
            isWinner && 'text-green-500'
          )}>
            {equity.toFixed(2)}%
          </span>
        </div>
      )}
      
      {player.id !== 1 && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(player.id)}
          disabled={disabled}
          className="shrink-0"
          data-testid={`button-remove-player-${player.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

export function EquityCalculator() {
  const { t } = useTranslation();
  const [board, setBoard] = useState<Card[]>([]);
  const [boardInput, setBoardInput] = useState('');
  const [players, setPlayers] = useState<PlayerInput[]>([
    { id: 1, cards: [], input: '' },
    { id: 2, cards: [], input: '' },
  ]);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [calcTime, setCalcTime] = useState<number | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false);
  const [parsedHistory, setParsedHistory] = useState<ParsedHandHistory | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [selectedTrials, setSelectedTrials] = useState(600000);
  const [seedInput, setSeedInput] = useState('12345');
  const [benchmarkResult, setBenchmarkResult] = useState<string | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  
  const allUsedCards = new Set<string>();
  for (const card of board) {
    allUsedCards.add(cardKey(card));
  }
  for (const player of players) {
    for (const card of player.cards) {
      allUsedCards.add(cardKey(card));
    }
  }
  
  const handleBoardChange = useCallback((input: string) => {
    setBoardInput(input);
    const parsed = parseCardsConcat(input);
    if (parsed && parsed.length <= 5) {
      setBoard(parsed);
    }
  }, []);
  
  const handlePlayerInput = useCallback((id: number, input: string) => {
    setPlayers(prev => prev.map(p => {
      if (p.id !== id) return p;
      
      const rangeResult = parseRange(input);
      
      if (rangeResult.isSpecificHand && rangeResult.hands.length === 1) {
        return {
          ...p,
          input,
          cards: rangeResult.hands[0],
          isRange: false,
          rangeHands: undefined,
          comboCount: 1
        };
      }
      
      if (rangeResult.isRange && rangeResult.comboCount > 0) {
        return {
          ...p,
          input,
          cards: rangeResult.hands.length > 0 ? rangeResult.hands[0] : [],
          isRange: true,
          rangeHands: rangeResult.hands.length > 0 ? rangeResult.hands : undefined,
          rangePattern: input.trim(),
          comboCount: rangeResult.comboCount
        };
      }
      
      const parsed = parseCardsConcat(input);
      return {
        ...p,
        input,
        cards: parsed && parsed.length <= 5 ? parsed : [],
        isRange: false,
        rangeHands: undefined,
        comboCount: parsed?.length ? 1 : 0
      };
    }));
  }, []);
  
  const addPlayer = () => {
    const maxId = Math.max(...players.map(p => p.id), 0);
    setPlayers(prev => [...prev, { id: maxId + 1, cards: [], input: '' }]);
  };
  
  const removePlayer = (id: number) => {
    if (id === 1) return;
    if (players.length <= 2) return;
    setPlayers(prev => prev.filter(p => p.id !== id));
  };
  
  const clearAll = () => {
    setBoard([]);
    setBoardInput('');
    setPlayers([
      { id: 1, cards: [], input: '' },
      { id: 2, cards: [], input: '' },
    ]);
    setResult(null);
    setProgress(0);
    setResetKey(k => k + 1);
    setBenchmarkResult(null);
  };
  
  const handlePasteHand = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = parseHandHistory(text);
      
      if (!parsed) {
        setPasteError(t('pasteError1'));
        setParsedHistory(null);
        setPasteDialogOpen(true);
        return;
      }
      
      if (parsed.availableStreets.length === 0) {
        setPasteError(t('pasteError2'));
        setParsedHistory(null);
        setPasteDialogOpen(true);
        return;
      }
      
      setPasteError(null);
      setParsedHistory(parsed);
      setPasteDialogOpen(true);
    } catch (err) {
      setPasteError(t('pasteError3'));
      setParsedHistory(null);
      setPasteDialogOpen(true);
    }
  };
  
  const cardsToString = (cards: Card[]): string => {
    return cards.map(c => `${c.rank}${c.suit}`).join('');
  };
  
  const applyParsedHand = (street: 'preflop' | 'flop' | 'turn' | 'river') => {
    if (!parsedHistory) return;
    
    const streetBoard = getStreetBoard(parsedHistory, street);
    setBoardInput(cardsToString(streetBoard));
    setBoard(streetBoard);
    
    const newPlayers: PlayerInput[] = [];
    
    if (parsedHistory.heroHand && parsedHistory.heroHand.length === 5) {
      newPlayers.push({
        id: 1,
        cards: parsedHistory.heroHand,
        input: cardsToString(parsedHistory.heroHand),
        isRange: false
      });
    }
    
    const otherPlayers = parsedHistory.players
      .filter(p => p.hand && p.hand.length === 5 && !p.isHero)
      .slice(0, 6);
    
    for (const p of otherPlayers) {
      newPlayers.push({
        id: newPlayers.length + 1,
        cards: p.hand!,
        input: cardsToString(p.hand!),
        isRange: false
      });
    }
    
    while (newPlayers.length < 2) {
      newPlayers.push({ id: newPlayers.length + 1, cards: [], input: '' });
    }
    
    setPlayers(newPlayers);
    setResult(null);
    setResetKey(k => k + 1);
    setPasteDialogOpen(false);
  };
  
  const getSeedValue = (): number | null => {
    const trimmed = seedInput.trim();
    if (trimmed === '') return null;
    const n = parseInt(trimmed, 10);
    return isNaN(n) ? null : n;
  };
  
  const calculate = () => {
    const hasRanges = players.some(p => p.isRange);
    
    const validPlayers = players.filter(p => {
      if (p.isRange && (p.comboCount || 0) > 0) return true;
      if (!p.isRange && p.cards.length === 5) return true;
      return false;
    });
    if (validPlayers.length < 2) return;
    
    setIsCalculating(true);
    
    const start = performance.now();
    const isPreflop = board.length === 0;
    const is2Player = validPlayers.length === 2;
    
    if (hasRanges) {
      const runRangeCalculation = async () => {
        const TARGET_SAMPLES = selectedTrials;
        const MAX_ATTEMPTS = selectedTrials * 4;
        const BATCH_SIZE = 2000;
        const equityTotals: Record<number, number> = {};
        let totalSamples = 0;
        
        for (const p of validPlayers) {
          equityTotals[p.id] = 0;
        }
        
        const usedByBoard = new Set(board.map(c => cardKey(c)));
        
        const seedVal = getSeedValue();
        const rng = seedVal !== null ? mulberry32(seedVal) : Math.random;
        
        let attempts = 0;
        while (totalSamples < TARGET_SAMPLES && attempts < MAX_ATTEMPTS) {
          const batchAttempts = Math.min(BATCH_SIZE, MAX_ATTEMPTS - attempts);
          
          for (let i = 0; i < batchAttempts && totalSamples < TARGET_SAMPLES; i++) {
            attempts++;
            
            const sampledHands: Card[][] = [];
            let validSample = true;
            
            const usedSoFar = new Set(usedByBoard);
            
            for (const p of validPlayers) {
              if (p.isRange && p.rangeHands && p.rangeHands.length > 0) {
                const hand = getRandomHandFromRange(p.rangeHands, usedSoFar, rng);
                if (!hand || hand.length !== 5) {
                  validSample = false;
                  break;
                }
                sampledHands.push(hand);
                for (const c of hand) usedSoFar.add(cardKey(c));
              } else if (p.isRange && p.rangePattern) {
                const isPercent = /^\d+(?:\.\d+)?\s*%/.test(p.rangePattern);
                if (isPercent) {
                  const available = buildAvailableDeck(usedSoFar);
                  if (available.length < 5) { validSample = false; break; }
                  const hand = sampleCards(available, 5, rng);
                  sampledHands.push(hand);
                  for (const c of hand) usedSoFar.add(cardKey(c));
                } else {
                  const hand = generateRandomHandFromPattern(p.rangePattern, usedSoFar, rng);
                  if (!hand || hand.length !== 5) {
                    validSample = false;
                    break;
                  }
                  sampledHands.push(hand);
                  for (const c of hand) usedSoFar.add(cardKey(c));
                }
              } else {
                if (p.cards.length !== 5) {
                  validSample = false;
                  break;
                }
                if (p.cards.some(c => usedSoFar.has(cardKey(c)))) {
                  validSample = false;
                  break;
                }
                sampledHands.push(p.cards);
                for (const c of p.cards) usedSoFar.add(cardKey(c));
              }
            }
            
            if (!validSample || sampledHands.length !== validPlayers.length) continue;
            
            const availableForBoard = buildAvailableDeck(usedSoFar);
            const boardRemaining = 5 - board.length;
            
            if (availableForBoard.length < boardRemaining) continue;
            
            const boardFill = sampleCards(availableForBoard, boardRemaining, rng);
            if (boardFill.length < boardRemaining) continue;
            
            const randomBoard = [...board, ...boardFill];
            
            const sampledPlayers: PlayerInput[] = validPlayers.map((p, idx) => ({
              ...p, cards: sampledHands[idx], isRange: false
            }));
            
            const sampleResult = calculateEquityFast(sampledPlayers, randomBoard);
            for (const r of sampleResult.results) {
              equityTotals[r.playerId] += r.equity;
            }
            totalSamples++;
          }
          
          const progressPercent = Math.min((totalSamples / TARGET_SAMPLES) * 100, 100);
          setProgress(progressPercent);
          
          if (totalSamples > 0) {
            setResult({
              results: validPlayers.map(p => ({
                playerId: p.id,
                wins: 0,
                ties: 0,
                total: totalSamples,
                equity: equityTotals[p.id] / totalSamples
              })),
              totalTrials: totalSamples,
              isExhaustive: false
            });
          }
          
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        const elapsed = performance.now() - start;
        const successRate = ((totalSamples / attempts) * 100).toFixed(1);
        console.log(`Range calc: ${elapsed.toFixed(0)}ms for ${totalSamples} trials (${attempts} attempts, ${successRate}% success rate)`);
        setCalcTime(elapsed);
        setIsCached(false);
        
        if (totalSamples > 0) {
          setResult({
            results: validPlayers.map(p => ({
              playerId: p.id,
              wins: 0,
              ties: 0,
              total: totalSamples,
              equity: equityTotals[p.id] / totalSamples
            })),
            totalTrials: totalSamples,
            isExhaustive: false
          });
        }
        setIsCalculating(false);
      };
      
      setTimeout(runRangeCalculation, 10);
      return;
    }
    
    if (isPreflop && is2Player) {
      getCachedEquity(validPlayers[0].cards, validPlayers[1].cards).then(cached => {
        if (cached) {
          const elapsed = performance.now() - start;
          console.log(`Cache hit! ${elapsed.toFixed(1)}ms (cache size: ${getMemoryCacheSize()})`);
          setCalcTime(elapsed);
          setIsCached(true);
          setResult({
            results: [
              { playerId: validPlayers[0].id, wins: 0, ties: 0, total: cached.runouts, equity: cached.equity1 },
              { playerId: validPlayers[1].id, wins: 0, ties: 0, total: cached.runouts, equity: cached.equity2 }
            ],
            totalTrials: cached.runouts,
            isExhaustive: true
          });
          setIsCalculating(false);
        } else {
          setTimeout(() => {
            const calcResult = calculateEquityFast(players, board);
            const elapsed = performance.now() - start;
            console.log(`WASM: ${elapsed.toFixed(0)}ms for ${calcResult.totalTrials} trials (caching...)`);
            setCalcTime(elapsed);
            setIsCached(false);
            setResult(calcResult);
            setIsCalculating(false);
            
            if (calcResult.results.length === 2) {
              setCachedEquity(
                validPlayers[0].cards,
                validPlayers[1].cards,
                calcResult.results[0].equity,
                calcResult.results[1].equity,
                calcResult.totalTrials
              );
            }
          }, 10);
        }
      });
    } else {
      setIsCached(false);
      setTimeout(() => {
        const calcResult = calculateEquityFast(players, board);
        const elapsed = performance.now() - start;
        console.log(`WASM: ${elapsed.toFixed(0)}ms for ${calcResult.totalTrials} trials`);
        setCalcTime(elapsed);
        setResult(calcResult);
        setIsCalculating(false);
      }, 10);
    }
  };
  
  const runBenchmark = async () => {
    setIsBenchmarking(true);
    setBenchmarkResult(null);
    
    const BENCH_TRIALS = 200000;
    const benchHands = [
      { label: 'JsTh5dTc4c vs 100%', hand: 'JsTh5dTc4c' },
      { label: '9cTdJhAdAh vs 100%', hand: '9cTdJhAdAh' },
    ];
    
    const lines: string[] = [];
    
    for (const bh of benchHands) {
      const heroCards = parseCardsConcat(bh.hand);
      if (!heroCards || heroCards.length !== 5) {
        lines.push(`${bh.label}: parse error`);
        continue;
      }
      
      const seedVal = getSeedValue() ?? 12345;
      const rng = mulberry32(seedVal);
      
      const usedByHero = new Set(heroCards.map(c => cardKey(c)));
      let totalEq = 0;
      let samples = 0;
      
      for (let trial = 0; trial < BENCH_TRIALS; trial++) {
        const available = buildAvailableDeck(usedByHero);
        const villainAndBoard = sampleCards(available, 10, rng);
        if (villainAndBoard.length < 10) continue;
        
        const villainCards = villainAndBoard.slice(0, 5);
        const boardCards = villainAndBoard.slice(5, 10);
        
        const trialPlayers: PlayerInput[] = [
          { id: 1, cards: heroCards, input: bh.hand },
          { id: 2, cards: villainCards, input: '' },
        ];
        
        const res = calculateEquityFast(trialPlayers, boardCards);
        const heroEq = res.results.find(r => r.playerId === 1);
        if (heroEq) {
          totalEq += heroEq.equity;
          samples++;
        }
      }
      
      const avgEq = samples > 0 ? (totalEq / samples).toFixed(3) : 'N/A';
      lines.push(`${bh.label}: ${avgEq}% (${samples} samples, seed=${seedVal})`);
      
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    setBenchmarkResult(lines.join('\n'));
    setIsBenchmarking(false);
  };
  
  const hasRanges = players.some(p => p.isRange);
  const validPlayerCount = players.filter(p => {
    if (p.isRange && (p.comboCount || 0) > 0) return true;
    if (!p.isRange && p.cards.length === 5) return true;
    return false;
  }).length;
  const isValidBoardSize = board.length === 0 || board.length === 3 || board.length === 4 || board.length === 5;
  const canCalculate = validPlayerCount >= 2 && !isCalculating && isValidBoardSize;
  
  const maxEquity = result ? Math.max(...result.results.map(r => r.equity)) : 0;
  
  return (
    <UICard>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          {t('subtitle')}
        </CardTitle>
        <CardDescription>
          {t('calcDesc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>{t('board')}</Label>
            <span className="text-xs text-muted-foreground">
              ({t('preflop')}: 0 | {t('flop')}: 3 | {t('turn')}: 4 | {t('river')}: 5)
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <Input
              key={`board-${resetKey}`}
              value={boardInput}
              onChange={(e) => handleBoardChange(e.target.value)}
              placeholder="e.g. AsKd5c"
              className={`font-mono max-w-xs ${!isValidBoardSize && board.length > 0 ? 'border-destructive' : ''}`}
              disabled={isCalculating}
              data-testid="input-board"
            />
            <div className="flex gap-0.5 items-center">
              <CardChips cards={board} size="md" />
              {Array.from({ length: 5 - board.length }).map((_, i) => (
                <div 
                  key={`empty-${i}`}
                  className="w-7 h-8 rounded border border-dashed border-muted-foreground/30 bg-muted/30"
                />
              ))}
            </div>
            {!isValidBoardSize && board.length > 0 && (
              <span className="text-xs text-destructive">
                {t('invalidBoard')}
              </span>
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t('playersLabel')}</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={addPlayer}
              disabled={isCalculating || players.length >= 7}
              data-testid="button-add-player"
            >
              <Plus className="w-4 h-4 mr-1" />
              {t('addPlayer')}
            </Button>
          </div>
          
          <div className="space-y-2">
            {players.map(player => {
              const playerResult = result?.results.find(r => r.playerId === player.id);
              return (
                <PlayerRow
                  key={`${player.id}-${resetKey}`}
                  player={player}
                  onInputChange={handlePlayerInput}
                  onRemove={removePlayer}
                  equity={playerResult?.equity}
                  isWinner={playerResult && playerResult.equity === maxEquity && maxEquity > 0}
                  disabled={isCalculating}
                  allUsedCards={allUsedCards}
                  heroLabel={t('hero')}
                  playerLabel={t('player')}
                  combosLabel={t('combos')}
                  need5CardsLabel={t('need5Cards')}
                />
              );
            })}
          </div>
        </div>
        
        {hasRanges && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Label className="text-sm shrink-0">{t('trialsLabel')}:</Label>
              <div className="flex gap-1">
                {TRIAL_PRESETS.map(preset => (
                  <Button
                    key={preset.value}
                    variant={selectedTrials === preset.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTrials(preset.value)}
                    disabled={isCalculating}
                    data-testid={`button-trials-${preset.value}`}
                  >
                    {t(preset.label)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-sm shrink-0">{t('seedLabel')}:</Label>
              <Input
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                placeholder={t('seedPlaceholder')}
                className="font-mono text-sm max-w-[140px]"
                disabled={isCalculating}
                data-testid="input-seed"
              />
            </div>
          </div>
        )}
        
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={calculate}
            disabled={!canCalculate}
            className="gap-2"
            data-testid="button-calculate"
          >
            <Play className="w-4 h-4" />
            {isCalculating ? t('calculating') : t('calculate')}
          </Button>
          <Button
            variant="outline"
            onClick={handlePasteHand}
            disabled={isCalculating}
            data-testid="button-paste-hand"
          >
            <ClipboardPaste className="w-4 h-4 mr-1" />
            {t('pasteHand')}
          </Button>
          <Button
            variant="outline"
            onClick={clearAll}
            disabled={isCalculating}
            data-testid="button-clear"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            {t('reset')}
          </Button>
          <Button
            variant="outline"
            onClick={runBenchmark}
            disabled={isCalculating || isBenchmarking}
            data-testid="button-benchmark"
          >
            <FlaskConical className="w-4 h-4 mr-1" />
            {isBenchmarking ? t('benchmarkRunning') : t('benchmark')}
          </Button>
        </div>
        
        {isCalculating && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Progress value={progress} className="h-1.5 flex-1 max-w-[200px]" />
            <span className="tabular-nums">{progress.toFixed(0)}%</span>
          </div>
        )}
        
        {benchmarkResult && !isBenchmarking && (
          <div className="p-3 rounded-md border bg-muted/30 space-y-1" data-testid="text-benchmark-result">
            <div className="text-sm font-medium">{t('benchmarkDone')}</div>
            {benchmarkResult.split('\n').map((line, i) => (
              <div key={i} className="text-xs font-mono text-muted-foreground">{line}</div>
            ))}
          </div>
        )}
        
        {result && !isCalculating && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-semibold">{t('equityResults')}</h3>
              <div className="flex items-center gap-2">
                {isCached && (
                  <Badge variant="default" className="bg-green-600" data-testid="badge-cached">
                    {t('cached')}
                  </Badge>
                )}
                {calcTime !== null && (
                  <Badge variant="outline" data-testid="badge-calc-time">
                    {calcTime < 1000 ? `${calcTime.toFixed(0)}ms` : `${(calcTime / 1000).toFixed(2)}s`}
                  </Badge>
                )}
                <Badge variant="secondary" data-testid="badge-trials">
                  {result.totalTrials.toLocaleString()} {result.isExhaustive ? `${t('runouts')} (${t('exact')})` : t('trials')}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-3">
              {result.results.map(r => {
                const player = players.find(p => p.id === r.playerId);
                const isWinner = r.equity === maxEquity && maxEquity > 0;
                
                return (
                  <div key={r.playerId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className={cn(isWinner && 'font-bold text-green-500')}>
                        {r.playerId === 1 ? t('hero') : `${t('player')} ${r.playerId}`}: {player?.input || '—'}
                      </span>
                      <span className={cn('font-mono font-bold', isWinner && 'text-green-500')}>
                        {r.equity.toFixed(4)}%
                      </span>
                    </div>
                    <div className="relative">
                      <div 
                        className={cn(
                          'h-6 rounded transition-all',
                          isWinner ? 'bg-green-500' : 'bg-primary/60'
                        )}
                        style={{ width: `${r.equity}%` }}
                      />
                      <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-white">
                        {r.equity.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('win')}: {r.wins.toLocaleString()} | {t('tie')}: {r.ties.toLocaleString()} | {t('total')}: {r.total.toLocaleString()}
                    </div>
                    {r.bestHand && (
                      <div className="text-xs text-muted-foreground">
                        {t('bestHand')}: {r.bestHand.description}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        <Dialog open={pasteDialogOpen} onOpenChange={setPasteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('handImport')}</DialogTitle>
              <DialogDescription>
                {pasteError 
                  ? pasteError 
                  : t('selectStreet')}
              </DialogDescription>
            </DialogHeader>
            
            {parsedHistory && !pasteError && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('foundHands')}</Label>
                  <div className="space-y-2">
                    {parsedHistory.players.map((p, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className={cn(
                          'text-sm font-medium min-w-[80px]',
                          p.isHero && 'text-green-600 dark:text-green-400'
                        )}>
                          {p.name}:
                        </span>
                        {p.hand && <CardChips cards={p.hand} size="sm" />}
                      </div>
                    ))}
                  </div>
                </div>
                
                {parsedHistory.board.flop && (
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">{t('boardLabel')}</Label>
                    <CardChips 
                      cards={[
                        ...parsedHistory.board.flop,
                        ...(parsedHistory.board.turn ? [parsedHistory.board.turn] : []),
                        ...(parsedHistory.board.river ? [parsedHistory.board.river] : [])
                      ]} 
                      size="sm" 
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('selectStreetLabel')}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {parsedHistory.availableStreets.map(street => (
                      <Button
                        key={street}
                        variant="outline"
                        onClick={() => applyParsedHand(street)}
                        className="w-full"
                        data-testid={`button-street-${street}`}
                      >
                        {street === 'preflop' ? t('preflop') : street === 'flop' ? t('flop') : street === 'turn' ? t('turn') : t('river')}
                        {street !== 'preflop' && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({street === 'flop' ? '3' : street === 'turn' ? '4' : '5'} {t('cards')})
                          </span>
                        )}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {pasteError && (
              <Button 
                variant="outline" 
                onClick={() => setPasteDialogOpen(false)}
                className="w-full"
                data-testid="button-paste-dialog-close"
              >
                {t('close')}
              </Button>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </UICard>
  );
}
