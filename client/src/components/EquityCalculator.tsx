import { useState, useCallback } from 'react';
import { type Card } from '@/lib/poker-evaluator';
import { parseCardsConcat, type PlayerInput, type CalculationResult } from '@/lib/equity-calculator';
import { calculateEquityFast } from '@/lib/wasm-equity';
import { getCachedEquity, setCachedEquity, getMemoryCacheSize } from '@/lib/equity-cache';
import { parseRange, getRandomHandFromRange, generateRandomHandFromPattern } from '@/lib/range-parser';
import { parseHandHistory, getStreetBoard, getStreetName, type ParsedHandHistory } from '@/lib/hand-history-parser';
import { Card as UICard, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PlayingCard } from './PlayingCard';
import { CardChips } from './CardChip';
import { Play, Trash2, Plus, RotateCcw, Calculator, ClipboardPaste } from 'lucide-react';
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
        {player.id === 1 ? 'Hero' : `Player ${player.id}`}
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
      
      <div className="flex gap-0.5 min-w-[140px] items-center">
        {player.isRange ? (
          <Badge variant="secondary" className="text-xs" data-testid={`badge-combo-${player.id}`}>
            {player.comboCount} combos
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
    if (id === 1) return; // Cannot remove Hero
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
  
  const handlePasteHand = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = parseHandHistory(text);
      
      if (!parsed) {
        setPasteError('Не удалось распознать формат истории раздачи');
        setParsedHistory(null);
        setPasteDialogOpen(true);
        return;
      }
      
      if (parsed.availableStreets.length === 0) {
        setPasteError('Не найдены руки игроков в истории');
        setParsedHistory(null);
        setPasteDialogOpen(true);
        return;
      }
      
      setPasteError(null);
      setParsedHistory(parsed);
      setPasteDialogOpen(true);
    } catch (err) {
      setPasteError('Не удалось прочитать буфер обмена. Разрешите доступ к буферу.');
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
    
    // Hero always goes first (id=1)
    if (parsedHistory.heroHand && parsedHistory.heroHand.length === 5) {
      newPlayers.push({
        id: 1,
        cards: parsedHistory.heroHand,
        input: cardsToString(parsedHistory.heroHand),
        isRange: false
      });
    }
    
    // Add other players (excluding hero duplicates)
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
    
    // Ensure at least 2 players (add empty slots if needed)
    while (newPlayers.length < 2) {
      newPlayers.push({ id: newPlayers.length + 1, cards: [], input: '' });
    }
    
    setPlayers(newPlayers);
    setResult(null);
    setResetKey(k => k + 1);
    setPasteDialogOpen(false);
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
        const TARGET_SAMPLES = 600000;
        const MAX_ATTEMPTS = 2000000; // Max attempts to reach target
        const BATCH_SIZE = 2000;
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
        
        let attempts = 0;
        while (totalSamples < TARGET_SAMPLES && attempts < MAX_ATTEMPTS) {
          const batchAttempts = Math.min(BATCH_SIZE, MAX_ATTEMPTS - attempts);
          
          for (let i = 0; i < batchAttempts && totalSamples < TARGET_SAMPLES; i++) {
            attempts++;
            
            // INDEPENDENT SAMPLING: sample each player from full deck (minus board)
            // Then reject if hands conflict. This gives uniform distribution over valid pairs.
            const sampledHands: Card[][] = [];
            let validSample = true;
            
            for (const p of validPlayers) {
              if (p.isRange && p.rangePattern) {
                // Generate random hand matching pattern (from full deck minus board only)
                const hand = generateRandomHandFromPattern(p.rangePattern, usedByBoard);
                if (!hand) {
                  validSample = false;
                  break;
                }
                sampledHands.push(hand);
              } else if (p.isRange && p.rangeHands) {
                const hand = getRandomHandFromRange(p.rangeHands, usedByBoard);
                if (!hand) {
                  validSample = false;
                  break;
                }
                sampledHands.push(hand);
              } else {
                // Specific hand
                if (p.cards.some(c => usedByBoard.has(`${c.rank}${c.suit}`))) {
                  validSample = false;
                  break;
                }
                const hand = [...p.cards];
                // Fill incomplete hands from remaining deck
                const used = new Set(usedByBoard);
                for (const c of hand) used.add(`${c.rank}${c.suit}`);
                while (hand.length < 5) {
                  const available = fullDeck.filter(c => !used.has(`${c.rank}${c.suit}`));
                  if (available.length === 0) {
                    validSample = false;
                    break;
                  }
                  const randomCard = available[Math.floor(Math.random() * available.length)];
                  hand.push(randomCard);
                  used.add(`${randomCard.rank}${randomCard.suit}`);
                }
                if (hand.length < 5) {
                  validSample = false;
                  break;
                }
                sampledHands.push(hand);
              }
            }
            
            if (!validSample || sampledHands.length !== validPlayers.length) continue;
            
            // Check for conflicts between hands
            const allHandCards = new Set<string>();
            let hasConflict = false;
            for (const hand of sampledHands) {
              for (const c of hand) {
                const key = `${c.rank}${c.suit}`;
                if (allHandCards.has(key)) {
                  hasConflict = true;
                  break;
                }
                allHandCards.add(key);
              }
              if (hasConflict) break;
            }
            
            if (hasConflict) continue;
            
            // Generate random board from remaining cards
            const randomBoard = [...board];
            const usedForBoard = new Set(allHandCards);
            for (const c of board) usedForBoard.add(`${c.rank}${c.suit}`);
            
            while (randomBoard.length < 5) {
              const available = fullDeck.filter(c => !usedForBoard.has(`${c.rank}${c.suit}`));
              if (available.length === 0) break;
              const randomCard = available[Math.floor(Math.random() * available.length)];
              randomBoard.push(randomCard);
              usedForBoard.add(`${randomCard.rank}${randomCard.suit}`);
            }
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
          
          // Yield to UI
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
  
  const validPlayerCount = players.filter(p => 
    (p.cards.length >= 2) || (p.isRange && (p.comboCount || 0) > 0)
  ).length;
  // Board must be 0 (preflop), 3 (flop), 4 (turn), or 5 (river) cards
  const isValidBoardSize = board.length === 0 || board.length === 3 || board.length === 4 || board.length === 5;
  const canCalculate = validPlayerCount >= 2 && !isCalculating && isValidBoardSize;
  
  const maxEquity = result ? Math.max(...result.results.map(r => r.equity)) : 0;
  
  return (
    <UICard>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          PLO5 Equity Calculator
        </CardTitle>
        <CardDescription>
          Enter hands (7s6hJdQc8c) or ranges (AA, KK+, AK$s). Ranges use Monte Carlo sampling.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>Board</Label>
            <span className="text-xs text-muted-foreground">
              (Preflop: 0 | Flop: 3 | Turn: 4 | River: 5)
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
                Invalid: need {board.length === 1 ? '2 more' : '1 more'} card{board.length === 1 ? 's' : ''}
              </span>
            )}
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
            onClick={handlePasteHand}
            disabled={isCalculating}
            data-testid="button-paste-hand"
          >
            <ClipboardPaste className="w-4 h-4 mr-1" />
            Paste Hand
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
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Progress value={progress} className="h-1.5 flex-1 max-w-[200px]" />
            <span className="tabular-nums">{progress.toFixed(0)}%</span>
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
                        {r.playerId === 1 ? 'Hero' : `Player ${r.playerId}`}: {player?.input || 'N/A'}
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
        
        <Dialog open={pasteDialogOpen} onOpenChange={setPasteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Импорт раздачи</DialogTitle>
              <DialogDescription>
                {pasteError 
                  ? pasteError 
                  : 'Выберите улицу для анализа'}
              </DialogDescription>
            </DialogHeader>
            
            {parsedHistory && !pasteError && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Найденные руки:</Label>
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
                    <Label className="text-sm font-medium">Борд:</Label>
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
                  <Label className="text-sm font-medium">Выберите улицу:</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {parsedHistory.availableStreets.map(street => (
                      <Button
                        key={street}
                        variant="outline"
                        onClick={() => applyParsedHand(street)}
                        className="w-full"
                        data-testid={`button-street-${street}`}
                      >
                        {getStreetName(street)}
                        {street !== 'preflop' && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({street === 'flop' ? '3' : street === 'turn' ? '4' : '5'} карт)
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
                Закрыть
              </Button>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </UICard>
  );
}
