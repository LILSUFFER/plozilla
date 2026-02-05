import { useState, useCallback } from 'react';
import { type Card, getSuitSymbol, getSuitColor, getRankDisplay } from '@/lib/poker-evaluator';
import { parseCardsConcat, type PlayerInput, type CalculationResult } from '@/lib/equity-calculator';
import { calculateEquityFast } from '@/lib/wasm-equity';
import { getCachedEquity, setCachedEquity, getMemoryCacheSize } from '@/lib/equity-cache';
import { parseRange, getRandomHandFromRange } from '@/lib/range-parser';
import { Card as UICard, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { PlayingCard } from './PlayingCard';
import { Play, Trash2, Plus, RotateCcw, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlayerRowProps {
  player: PlayerInput;
  onInputChange: (id: number, input: string) => void;
  onRemove: (id: number) => void;
  equity?: number;
  isWinner?: boolean;
  disabled?: boolean;
  allUsedCards: Set<string>;
}

function PlayerRow({ player, onInputChange, onRemove, equity, isWinner, disabled, allUsedCards }: PlayerRowProps) {
  const handleChange = (value: string) => {
    onInputChange(player.id, value);
  };
  
  const hasError = player.input.length > 0 && player.cards.length === 0 && !player.isRange;
  const hasConflict = player.cards.some(c => {
    const key = `${c.rank}${c.suit}`;
    let count = 0;
    for (const card of player.cards) {
      if (`${card.rank}${card.suit}` === key) count++;
    }
    return count > 1;
  });
  
  return (
    <div className={cn(
      'flex items-center gap-2 p-2 rounded-md border transition-all',
      isWinner ? 'border-green-500 bg-green-500/10' : 'border-muted',
      hasError && 'border-destructive'
    )}>
      <div className="w-16 text-sm font-medium text-muted-foreground">
        Player {player.id}
      </div>
      
      <div className="flex-1">
        <Input
          value={player.input}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="AA, AK$s, KK+"
          className={cn(
            'font-mono text-sm',
            hasError && 'border-destructive'
          )}
          disabled={disabled}
          data-testid={`input-player-${player.id}`}
        />
      </div>
      
      <div className="flex gap-0.5 min-w-[120px] items-center">
        {player.isRange ? (
          <Badge variant="secondary" className="text-xs" data-testid={`badge-combo-${player.id}`}>
            {player.comboCount} combos
          </Badge>
        ) : (
          <>
            {player.cards.slice(0, 5).map((card, i) => (
              <div 
                key={i} 
                className={cn(
                  'w-6 h-8 flex flex-col items-center justify-center rounded text-[10px] font-bold border',
                  'bg-white dark:bg-gray-100',
                  getSuitColor(card.suit) === 'red' ? 'text-red-600' : 'text-gray-900'
                )}
              >
                <span>{getRankDisplay(card.rank)}</span>
                <span className="text-[8px]">{getSuitSymbol(card.suit)}</span>
              </div>
            ))}
            {Array.from({ length: Math.max(0, 5 - player.cards.length) }).map((_, i) => (
              <div 
                key={`empty-${i}`}
                className="w-6 h-8 rounded border border-dashed border-muted-foreground/30 bg-muted/30"
              />
            ))}
          </>
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
    </div>
  );
}

export function EquityCalculator() {
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
  
  const allUsedCards = new Set<string>();
  for (const card of board) {
    allUsedCards.add(`${card.rank}${card.suit}`);
  }
  for (const player of players) {
    for (const card of player.cards) {
      allUsedCards.add(`${card.rank}${card.suit}`);
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
      
      if (rangeResult.isRange && rangeResult.hands.length > 0) {
        return {
          ...p,
          input,
          cards: rangeResult.hands[0],
          isRange: true,
          rangeHands: rangeResult.hands,
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
  };
  
  const calculate = () => {
    const validPlayers = players.filter(p => p.cards.length >= 2 || (p.isRange && (p.comboCount || 0) > 0));
    if (validPlayers.length < 2) return;
    
    setIsCalculating(true);
    
    const start = performance.now();
    const isPreflop = board.length === 0;
    const is2Player = validPlayers.length === 2;
    const hasRanges = validPlayers.some(p => p.isRange);
    
    if (hasRanges) {
      const runRangeCalculation = async () => {
        const NUM_SAMPLES = 100000;
        const BATCH_SIZE = 1000;
        const equityTotals: Record<number, number> = {};
        let totalSamples = 0;
        
        for (const p of validPlayers) {
          equityTotals[p.id] = 0;
        }
        
        const usedByBoard = new Set(board.map(c => `${c.rank}${c.suit}`));
        const allRanks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
        const allSuits = ['s', 'h', 'd', 'c'];
        const fullDeck: Card[] = [];
        for (const r of allRanks) {
          for (const s of allSuits) {
            fullDeck.push({ rank: r, suit: s } as Card);
          }
        }
        
        const generateRandomBoard = (usedCards: Set<string>): Card[] => {
          const boardCards: Card[] = [...board];
          while (boardCards.length < 5) {
            const available = fullDeck.filter(c => !usedCards.has(`${c.rank}${c.suit}`));
            if (available.length === 0) return [];
            const randomCard = available[Math.floor(Math.random() * available.length)];
            boardCards.push(randomCard);
            usedCards.add(`${randomCard.rank}${randomCard.suit}`);
          }
          return boardCards;
        };
        
        for (let batchStart = 0; batchStart < NUM_SAMPLES; batchStart += BATCH_SIZE) {
          const batchEnd = Math.min(batchStart + BATCH_SIZE, NUM_SAMPLES);
          
          for (let sample = batchStart; sample < batchEnd; sample++) {
            const usedCards = new Set(usedByBoard);
            let validSample = true;
            const sampledHands: Card[][] = [];
            
            for (const p of validPlayers) {
              let baseHand: Card[];
              
              if (p.isRange && p.rangeHands) {
                const hand = getRandomHandFromRange(p.rangeHands, usedCards);
                if (!hand) {
                  validSample = false;
                  break;
                }
                baseHand = [...hand];
              } else {
                if (p.cards.some(c => usedCards.has(`${c.rank}${c.suit}`))) {
                  validSample = false;
                  break;
                }
                baseHand = [...p.cards];
              }
              
              for (const c of baseHand) usedCards.add(`${c.rank}${c.suit}`);
              
              while (baseHand.length < 5) {
                const available = fullDeck.filter(c => !usedCards.has(`${c.rank}${c.suit}`));
                if (available.length === 0) {
                  validSample = false;
                  break;
                }
                const randomCard = available[Math.floor(Math.random() * available.length)];
                baseHand.push(randomCard);
                usedCards.add(`${randomCard.rank}${randomCard.suit}`);
              }
              
              if (!validSample) break;
              sampledHands.push(baseHand);
            }
            
            if (!validSample || sampledHands.length !== validPlayers.length) continue;
            
            const randomBoard = board.length === 5 ? board : generateRandomBoard(usedCards);
            if (randomBoard.length < 5) continue;
            
            const sampledPlayers: PlayerInput[] = validPlayers.map((p, i) => ({
              ...p, cards: sampledHands[i], isRange: false
            }));
            
            const sampleResult = calculateEquityFast(sampledPlayers, randomBoard);
            for (const r of sampleResult.results) {
              equityTotals[r.playerId] += r.equity;
            }
            totalSamples++;
          }
          
          // Update progress after each batch
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
          
          // Yield to UI
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        const elapsed = performance.now() - start;
        console.log(`Range calc: ${elapsed.toFixed(0)}ms for ${totalSamples} trials`);
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
  
  const validPlayerCount = players.filter(p => 
    (p.cards.length >= 2) || (p.isRange && (p.comboCount || 0) > 0)
  ).length;
  const canCalculate = validPlayerCount >= 2 && !isCalculating && board.length <= 5;
  
  const maxEquity = result ? Math.max(...result.results.map(r => r.equity)) : 0;
  
  return (
    <UICard>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          5-Card Omaha Equity Calculator
        </CardTitle>
        <CardDescription>
          Enter hands (7s6hJdQc8c) or ranges (AA, KK+, AK$s). Ranges use Monte Carlo sampling.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Board (0-5 cards)</Label>
          <div className="flex gap-2">
            <Input
              key={`board-${resetKey}`}
              value={boardInput}
              onChange={(e) => handleBoardChange(e.target.value)}
              placeholder="Th5d7c"
              className="font-mono max-w-xs"
              disabled={isCalculating}
              data-testid="input-board"
            />
            <div className="flex gap-0.5 items-center">
              {board.map((card, i) => (
                <div 
                  key={i} 
                  className={cn(
                    'w-8 h-11 flex flex-col items-center justify-center rounded border text-xs font-bold',
                    'bg-white dark:bg-gray-100',
                    getSuitColor(card.suit) === 'red' ? 'text-red-600' : 'text-gray-900'
                  )}
                >
                  <span>{getRankDisplay(card.rank)}</span>
                  <span className="text-[10px]">{getSuitSymbol(card.suit)}</span>
                </div>
              ))}
              {Array.from({ length: 5 - board.length }).map((_, i) => (
                <div 
                  key={`empty-${i}`}
                  className="w-8 h-11 rounded border border-dashed border-muted-foreground/30 bg-muted/30"
                />
              ))}
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Players (5 cards each, min 2 required)</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={addPlayer}
              disabled={isCalculating || players.length >= 7}
              data-testid="button-add-player"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Player
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
                />
              );
            })}
          </div>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={calculate}
            disabled={!canCalculate}
            className="gap-2"
            data-testid="button-calculate"
          >
            <Play className="w-4 h-4" />
            Calculate Equity
          </Button>
          <Button
            variant="outline"
            onClick={clearAll}
            disabled={isCalculating}
            data-testid="button-clear"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Clear
          </Button>
        </div>
        
        {isCalculating && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Calculating...</span>
              <span>{progress.toFixed(0)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
        
        {result && !isCalculating && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-semibold">Equity Results</h3>
              <div className="flex items-center gap-2">
                {isCached && (
                  <Badge variant="default" className="bg-green-600" data-testid="badge-cached">
                    Cached
                  </Badge>
                )}
                {calcTime !== null && (
                  <Badge variant="outline" data-testid="badge-calc-time">
                    {calcTime < 1000 ? `${calcTime.toFixed(0)}ms` : `${(calcTime / 1000).toFixed(2)}s`}
                  </Badge>
                )}
                <Badge variant="secondary" data-testid="badge-trials">
                  {result.totalTrials.toLocaleString()} {result.isExhaustive ? 'runouts (exact)' : 'trials'}
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
                        Player {r.playerId}: {player?.input || 'N/A'}
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
                      Wins: {r.wins.toLocaleString()} | Ties: {r.ties.toLocaleString()} | Total: {r.total.toLocaleString()}
                    </div>
                    {r.bestHand && (
                      <div className="text-xs text-muted-foreground">
                        Best hand: {r.bestHand.description}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </UICard>
  );
}
