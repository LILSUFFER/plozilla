import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { RotateCcw, Settings, Info } from 'lucide-react';

type PlayerType = 'Hero' | 'Reg' | 'Fish' | 'Empty';

interface SeatConfig {
  seatIndex: number;
  type: PlayerType;
  fishVpip?: string;
  fishRake?: number;
  fishLoserate?: number;
  fish3bet?: boolean;
}

const FISH_VPIP_PRESETS = [
  { label: '50%', value: '50', rake: 17, loserate: 35 },
  { label: '55%', value: '55', rake: 18, loserate: 45 },
  { label: '60%', value: '60', rake: 19, loserate: 45 },
  { label: '65%', value: '65', rake: 21, loserate: 60 },
  { label: '70%', value: '70', rake: 23, loserate: 70 },
  { label: '75%', value: '75', rake: 26, loserate: 100 },
  { label: '80%', value: '80', rake: 30, loserate: 130 },
  { label: '85%', value: '85', rake: 34, loserate: 160 },
  { label: '90%', value: '90', rake: 41, loserate: 200 },
  { label: '95%', value: '95', rake: 45, loserate: 240 },
  { label: '100%', value: '100', rake: 48, loserate: 280 },
];

type TableSize = 6 | 5 | 4 | 2;

const TABLE_CONFIGS: Record<TableSize, {
  label: string;
  seatPositions: { top: string; left: string }[];
  clockwiseIndices: number[];
  defaultFishIndex: number;
  defaultHeroIndex: number;
}> = {
  6: {
    label: '6-MAX',
    seatPositions: [
      { top: '12%', left: '32%' },
      { top: '12%', left: '68%' },
      { top: '50%', left: '92%' },
      { top: '82%', left: '68%' },
      { top: '82%', left: '32%' },
      { top: '50%', left: '8%' },
    ],
    clockwiseIndices: [3, 4, 5, 0, 1, 2],
    defaultFishIndex: 3,
    defaultHeroIndex: 4,
  },
  5: {
    label: '5-MAX',
    seatPositions: [
      { top: '12%', left: '50%' },
      { top: '45%', left: '90%' },
      { top: '82%', left: '72%' },
      { top: '82%', left: '28%' },
      { top: '45%', left: '10%' },
    ],
    clockwiseIndices: [2, 3, 4, 0, 1],
    defaultFishIndex: 2,
    defaultHeroIndex: 3,
  },
  4: {
    label: '4-MAX',
    seatPositions: [
      { top: '12%', left: '50%' },
      { top: '50%', left: '90%' },
      { top: '82%', left: '50%' },
      { top: '50%', left: '10%' },
    ],
    clockwiseIndices: [2, 3, 0, 1],
    defaultFishIndex: 2,
    defaultHeroIndex: 3,
  },
  2: {
    label: 'HU',
    seatPositions: [
      { top: '12%', left: '50%' },
      { top: '82%', left: '50%' },
    ],
    clockwiseIndices: [0, 1],
    defaultFishIndex: 0,
    defaultHeroIndex: 1,
  },
};

function getActiveDistanceClockwise(fromIndex: number, toIndex: number, seats: SeatConfig[], clockwiseIndices: number[]): number {
  const fromPos = clockwiseIndices.indexOf(fromIndex);
  const toPos = clockwiseIndices.indexOf(toIndex);
  if (fromPos === -1 || toPos === -1) return 0;
  
  const totalSeats = clockwiseIndices.length;
  let activeCount = 0;
  let currPos = fromPos;
  
  while (currPos !== toPos) {
    currPos = (currPos + 1) % totalSeats;
    const seatAtPos = seats.find(s => s.seatIndex === clockwiseIndices[currPos]);
    if (seatAtPos && seatAtPos.type !== 'Empty') {
      activeCount++;
    }
    if (activeCount > totalSeats) break;
  }
  
  return activeCount;
}

function getPositionCoefficient(distance: number, is3bet: boolean): number {
  if (is3bet) {
    switch (distance) {
      case 1: return 1.35;
      case 2: return 1.00;
      case 3: return 0.75;
      case 4: return 0.60;
      case 5: return 0.40;
      default: return 0;
    }
  }
  switch (distance) {
    case 1: return 1.5;
    case 2: return 1.1;
    case 3: return 0.9;
    case 4: return 0.8;
    case 5: return 0.7;
    default: return 0;
  }
}

function createInitialSeats(size: TableSize): SeatConfig[] {
  const config = TABLE_CONFIGS[size];
  return Array(size).fill(null).map((_, i) => ({
    seatIndex: i,
    type: i === config.defaultFishIndex ? 'Fish' as PlayerType : i === config.defaultHeroIndex ? 'Hero' as PlayerType : 'Reg' as PlayerType,
    fishVpip: i === config.defaultFishIndex ? '90' : undefined,
    fishRake: i === config.defaultFishIndex ? 41 : undefined,
    fishLoserate: i === config.defaultFishIndex ? 200 : undefined,
  }));
}

interface CalculationItem {
  fishIndex: number;
  vpip: string;
  loserate: number;
  rake: number;
  realLoserate: number;
  dist: number;
  posCoef: number;
  ev: number;
}

export function TableEvAnalyzer() {
  const [tableSize, setTableSize] = useState<TableSize>(6);
  const [seats, setSeats] = useState<SeatConfig[]>(createInitialSeats(6));
  const [selectedSeatIndex, setSelectedSeatIndex] = useState<number | null>(null);
  const [heroRake, setHeroRake] = useState(16);
  const [rakeback, setRakeback] = useState(0);
  const [dialogConfig, setDialogConfig] = useState<SeatConfig | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const tableConfig = TABLE_CONFIGS[tableSize];

  const handleTableSizeChange = (size: TableSize) => {
    setTableSize(size);
    setSeats(createInitialSeats(size));
  };

  const calculation = useMemo(() => {
    const heroSeat = seats.find(s => s.type === 'Hero');
    if (!heroSeat) return { totalEv: 0, breakdowns: {} as Record<number, number>, nReg: 0, debug: [] as CalculationItem[], heroRake, effectiveHeroRake: 0, rakeback: 0 };

    const nReg = seats.filter(s => s.type === 'Reg' || s.type === 'Hero').length;

    let fishEvSum = 0;
    const breakdowns: Record<number, number> = {};
    const debug: CalculationItem[] = [];

    seats.forEach(seat => {
      if (seat.type === 'Fish') {
        const preset = FISH_VPIP_PRESETS.find(p => p.value === seat.fishVpip);
        const loserate = preset?.loserate || seat.fishLoserate || 0;
        const rake = preset?.rake || seat.fishRake || 0;
        
        const dist = getActiveDistanceClockwise(seat.seatIndex, heroSeat.seatIndex, seats, tableConfig.clockwiseIndices);
        const posCoef = getPositionCoefficient(dist, !!seat.fish3bet);
        
        const realLoserate = loserate - rake;
        const evFromThisFish = (realLoserate / nReg) * posCoef;
        
        fishEvSum += evFromThisFish;
        breakdowns[seat.seatIndex] = evFromThisFish;
        
        debug.push({
          fishIndex: seat.seatIndex,
          vpip: seat.fishVpip || '90',
          loserate,
          rake,
          realLoserate,
          dist,
          posCoef,
          ev: evFromThisFish
        });
      }
    });

    // Calculate effective hero rake after rakeback
    const effectiveHeroRake = heroRake * (1 - rakeback / 100);
    
    // Hero rake is subtracted only ONCE (not per fish)
    const totalEv = fishEvSum - effectiveHeroRake;

    return { totalEv, breakdowns, nReg, debug, heroRake, effectiveHeroRake, rakeback };
  }, [seats, heroRake, rakeback, tableConfig]);

  const handleSeatClick = (index: number) => {
    setSelectedSeatIndex(index);
    setDialogConfig({ ...seats[index] });
  };

  const handleSeatSave = () => {
    if (dialogConfig === null || selectedSeatIndex === null) return;
    
    setSeats(prev => {
      let updated = prev.map((s, i) => i === selectedSeatIndex ? dialogConfig : s);
      if (dialogConfig.type === 'Hero') {
        updated = updated.map((s, i) => 
          i !== selectedSeatIndex && s.type === 'Hero' ? { ...s, type: 'Reg' as PlayerType } : s
        );
      }
      return updated;
    });
    setSelectedSeatIndex(null);
    setDialogConfig(null);
  };

  const resetTable = () => {
    setSeats(createInitialSeats(tableSize));
    setHeroRake(16);
    setRakeback(0);
  };

  const handleTypeChange = (type: PlayerType) => {
    if (!dialogConfig) return;
    const preset = FISH_VPIP_PRESETS.find(p => p.value === '90');
    setDialogConfig({
      ...dialogConfig,
      type,
      fishVpip: type === 'Fish' ? '90' : undefined,
      fishRake: type === 'Fish' ? preset?.rake : undefined,
      fishLoserate: type === 'Fish' ? preset?.loserate : undefined,
      fish3bet: type === 'Fish' ? false : undefined,
    });
  };

  const handleVpipChange = (value: string) => {
    if (!dialogConfig) return;
    const preset = FISH_VPIP_PRESETS.find(p => p.value === value);
    setDialogConfig({
      ...dialogConfig,
      fishVpip: value,
      fishRake: preset?.rake || 0,
      fishLoserate: preset?.loserate || 0,
    });
  };

  return (
    <div className="h-[calc(100vh-160px)] flex gap-6">
      <Card className="w-[340px] flex-shrink-0 flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">
              Total Expected Value
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={resetTable} className="h-7 px-2">
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          <div className="flex items-baseline gap-2 mb-6">
            <span className={cn(
              "text-4xl font-mono font-bold tracking-tighter",
              calculation.totalEv > 0 ? "text-emerald-500" : calculation.totalEv < 0 ? "text-red-500" : "text-foreground"
            )}>
              {calculation.totalEv > 0 ? "+" : ""}{calculation.totalEv.toFixed(2)}
            </span>
            <span className="text-lg text-muted-foreground">bb/100</span>
          </div>
          
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Regs + Hero (N-reg)</span>
              <span className="font-mono font-semibold">{calculation.nReg}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-muted-foreground">Hero Rake (bb/100)</span>
              <Input 
                type="text"
                inputMode="numeric"
                value={heroRake}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setHeroRake(val === '' ? 0 : parseInt(val, 10));
                }}
                onFocus={(e) => e.target.select()}
                className="w-16 h-7 text-sm font-mono text-right"
                data-testid="input-hero-rake"
              />
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-muted-foreground">Rakeback (%)</span>
              <Input 
                type="text"
                inputMode="numeric"
                value={rakeback}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  const num = val === '' ? 0 : parseInt(val, 10);
                  setRakeback(Math.min(9999, num));
                }}
                onFocus={(e) => e.target.select()}
                className="w-16 h-7 text-sm font-mono text-right"
                data-testid="input-rakeback"
              />
            </div>
          </div>

          {calculation.debug.length > 0 && (
            <div className="space-y-4 pt-4 border-t">
              <div className="text-xs font-bold uppercase tracking-wider text-primary">Calculation Details</div>
              {calculation.debug.map((item, i) => (
                <div key={i} className="space-y-2 bg-muted/50 p-3 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-orange-500">Against Fish (Seat {item.fishIndex + 1})</span>
                    <span className="text-[10px] bg-orange-500/20 text-orange-500 px-1.5 py-0.5 rounded">VPIP {item.vpip}%</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Real Loserate:</span>
                      <span>{item.realLoserate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Share (N={calculation.nReg}):</span>
                      <span>{(item.realLoserate / calculation.nReg).toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <span className="text-muted-foreground">Position Coef:</span>
                      <span className="text-primary font-bold">{item.posCoef}x</span>
                    </div>
                  </div>
                  <div className="flex justify-between border-t pt-2 mt-2">
                    <span className="text-[11px] text-muted-foreground font-semibold">Fish EV contribution:</span>
                    <span className={cn("text-[11px] font-bold", item.ev > 0 ? "text-emerald-500" : "text-red-500")}>
                      {item.ev > 0 ? "+" : ""}{item.ev.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
              <div className="bg-muted/30 p-3 rounded-lg space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Sum of Fish EV:</span>
                  <span className="font-mono">{calculation.debug.reduce((sum, d) => sum + d.ev, 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Hero Rake:</span>
                  <span className="font-mono">{heroRake}</span>
                </div>
                {rakeback > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Rakeback ({rakeback}%):</span>
                    <span className="text-emerald-500 font-mono">+{(heroRake * rakeback / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Effective Rake:</span>
                  <span className="text-red-500 font-mono">-{calculation.effectiveHeroRake.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-1">
                  <span className="text-[11px] font-semibold">Final EV:</span>
                  <span className={cn("text-[11px] font-bold font-mono", calculation.totalEv > 0 ? "text-emerald-500" : "text-red-500")}>
                    {calculation.totalEv > 0 ? "+" : ""}{calculation.totalEv.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-center text-lg">Table</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            {([6, 5, 4, 2] as TableSize[]).map((size) => (
              <Button
                key={size}
                variant={tableSize === size ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTableSizeChange(size)}
                data-testid={`button-table-${size}`}
              >
                {TABLE_CONFIGS[size].label}
              </Button>
            ))}
          </div>
          <div className="relative w-full max-w-xl aspect-[16/10]">
            <div className="absolute inset-0 rounded-[100px] border-2 border-slate-700/50 bg-slate-800 shadow-2xl" />
            <div className="absolute inset-6 rounded-[80px] border border-slate-600/50 bg-slate-700 flex items-center justify-center">
              <span className="text-slate-600 font-bold text-3xl tracking-[0.3em] select-none">{tableConfig.label}</span>
            </div>

            {seats.map((seat, i) => {
              const ev = calculation.breakdowns[i];
              const isFish = seat.type === 'Fish';
              const isHero = seat.type === 'Hero';
              const isReg = seat.type === 'Reg';
              const isEmpty = seat.type === 'Empty';

              return (
                <button
                  key={i}
                  style={{
                    position: 'absolute',
                    top: tableConfig.seatPositions[i].top,
                    left: tableConfig.seatPositions[i].left,
                    transform: 'translate(-50%, -50%)',
                  }}
                  onClick={() => handleSeatClick(i)}
                  className="z-10 w-20 h-20 flex flex-col items-center justify-center group focus:outline-none"
                  data-testid={`seat-${i}`}
                >
                  <div className={cn(
                    "w-14 h-14 rounded-full flex flex-col items-center justify-center border-2 transition-all shadow-lg",
                    isHero ? "bg-emerald-500/20 border-emerald-500 text-emerald-500" :
                    isFish && seat.fish3bet ? "bg-red-500/20 border-red-500 text-red-500" :
                    isFish ? "bg-orange-500/20 border-orange-500 text-orange-500" :
                    isReg ? "bg-slate-400/20 border-slate-400 text-slate-400" :
                    "bg-slate-800 border-slate-600 text-slate-600 hover:border-slate-500"
                  )}>
                    <span className="text-[11px] font-bold uppercase">
                      {seat.type === 'Empty' ? 'EMPTY' : seat.type.toUpperCase()}
                    </span>
                    {isFish && (
                      <span className="text-[9px] font-medium">
                        {seat.fishVpip}%{seat.fish3bet ? ' 3b' : ''}
                      </span>
                    )}
                  </div>

                  {ev !== undefined && !isEmpty && !isFish && (
                    <div className={cn(
                      "mt-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700",
                      ev > 0 ? "text-emerald-500" : ev < 0 ? "text-red-500" : "text-slate-500"
                    )}>
                      {ev > 0 ? "+" : ""}{ev.toFixed(1)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
        <div className="px-6 pb-4">
          <button
            onClick={() => setShowInfo(true)}
            className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
            data-testid="link-how-it-works"
          >
            <Info className="w-3 h-3" />
            How does it work?
          </button>
        </div>
      </Card>

      <Dialog open={showInfo} onOpenChange={setShowInfo}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>How Table EV Calculator Works</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4 text-sm">
            <div className="space-y-2">
              <h3 className="font-bold text-base text-primary">Core Formula</h3>
              <div className="bg-muted/50 p-4 rounded-lg font-mono text-xs leading-relaxed">
                EV = Sum of Fish EV contributions - Effective Hero Rake
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-base text-primary">Step 1: Real Loserate</h3>
              <p className="text-muted-foreground">Each fish has a total loserate and a rake component. The real loserate is the net amount other players win from this fish:</p>
              <div className="bg-muted/50 p-3 rounded-lg font-mono text-xs">
                Real Loserate = Fish Loserate - Fish Rake
              </div>
              <p className="text-muted-foreground text-xs">Fish Rake goes to the poker room, not to other players.</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-base text-primary">Step 2: Share per Reg</h3>
              <p className="text-muted-foreground">The real loserate is split equally among all regs (including Hero) at the table:</p>
              <div className="bg-muted/50 p-3 rounded-lg font-mono text-xs">
                Share = Real Loserate / N_regs
              </div>
              <p className="text-muted-foreground text-xs">N_regs = number of Reg + Hero players.</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-base text-primary">Step 3: Position Coefficient</h3>
              <p className="text-muted-foreground">Your position relative to the fish matters. Sitting closer (to the left) gives you a higher coefficient because you act after the fish more often:</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs font-semibold mb-2 text-orange-500">Normal Fish</p>
                  <div className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between"><span>fish+1 (direct left):</span><span className="font-bold">1.50x</span></div>
                    <div className="flex justify-between"><span>fish+2:</span><span className="font-bold">1.10x</span></div>
                    <div className="flex justify-between"><span>fish+3:</span><span className="font-bold">0.90x</span></div>
                    <div className="flex justify-between"><span>fish+4:</span><span className="font-bold">0.80x</span></div>
                    <div className="flex justify-between"><span>fish+5:</span><span className="font-bold">0.70x</span></div>
                  </div>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs font-semibold mb-2 text-red-500">3bet 30%+ Fish</p>
                  <div className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between"><span>fish+1 (direct left):</span><span className="font-bold">1.35x</span></div>
                    <div className="flex justify-between"><span>fish+2:</span><span className="font-bold">1.00x</span></div>
                    <div className="flex justify-between"><span>fish+3:</span><span className="font-bold">0.75x</span></div>
                    <div className="flex justify-between"><span>fish+4:</span><span className="font-bold">0.60x</span></div>
                    <div className="flex justify-between"><span>fish+5:</span><span className="font-bold">0.40x</span></div>
                  </div>
                </div>
              </div>
              <p className="text-muted-foreground text-xs">3bet fish reduces positional advantage because aggressive 3-betting narrows the skill edge from position.</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-base text-primary">Step 4: EV per Fish</h3>
              <p className="text-muted-foreground">For each fish at the table, your EV contribution is:</p>
              <div className="bg-muted/50 p-3 rounded-lg font-mono text-xs">
                Fish EV = (Real Loserate / N_regs) * Position Coef
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-base text-primary">Step 5: Hero Rake & Rakeback</h3>
              <p className="text-muted-foreground">Your own rake is subtracted once from the total. Rakeback reduces the effective rake:</p>
              <div className="bg-muted/50 p-3 rounded-lg font-mono text-xs space-y-1">
                <div>Effective Rake = Hero Rake * (1 - Rakeback% / 100)</div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-base text-primary">Final Result</h3>
              <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg font-mono text-xs">
                <span className="text-primary font-bold">Total EV = Sum(Fish EV) - Effective Hero Rake</span>
              </div>
              <p className="text-muted-foreground text-xs">Result is in bb/100 (big blinds per 100 hands).</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-base text-primary">Example</h3>
              <div className="bg-muted/50 p-3 rounded-lg text-xs space-y-1">
                <p>1 Fish (VPIP 90%, Loserate 200, Rake 41), 4 Regs + Hero, Hero at fish+1</p>
                <p className="font-mono mt-2">Real Loserate = 200 - 41 = 159</p>
                <p className="font-mono">Share = 159 / 5 = 31.8</p>
                <p className="font-mono">Position Coef (fish+1) = 1.5x</p>
                <p className="font-mono">Fish EV = 31.8 * 1.5 = 47.7</p>
                <p className="font-mono">Hero Rake = 16, Rakeback = 0%</p>
                <p className="font-mono font-bold text-primary mt-2">Total EV = 47.7 - 16 = +31.70 bb/100</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={selectedSeatIndex !== null} onOpenChange={(open) => !open && setSelectedSeatIndex(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Configure Seat {(selectedSeatIndex ?? 0) + 1}
            </DialogTitle>
          </DialogHeader>

          {dialogConfig && (
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label>Player Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Hero', 'Reg', 'Fish', 'Empty'] as PlayerType[]).map((type) => (
                    <div
                      key={type}
                      onClick={() => handleTypeChange(type)}
                      className={cn(
                        "cursor-pointer rounded-lg border p-3 flex items-center justify-center transition-all",
                        dialogConfig.type === type
                          ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <span className="font-semibold">{type}</span>
                    </div>
                  ))}
                </div>
              </div>

              {dialogConfig.type === 'Fish' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>VPIP %</Label>
                    <Select value={dialogConfig.fishVpip} onValueChange={handleVpipChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select VPIP..." />
                      </SelectTrigger>
                      <SelectContent>
                        {FISH_VPIP_PRESETS.map((preset) => (
                          <SelectItem key={preset.value} value={preset.value}>
                            {preset.label} (Loss: {preset.loserate}, Rake: {preset.rake})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div
                    onClick={() => setDialogConfig({ ...dialogConfig, fish3bet: !dialogConfig.fish3bet })}
                    className={cn(
                      "cursor-pointer rounded-lg border p-3 flex items-center justify-between transition-all",
                      dialogConfig.fish3bet
                        ? "border-red-500 bg-red-500/10 text-red-500 ring-2 ring-red-500/20"
                        : "border-border hover:border-red-500/50"
                    )}
                    data-testid="toggle-fish-3bet"
                  >
                    <div>
                      <span className="font-semibold text-sm">3bet 30%+</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Reduced position coefficients</p>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                      dialogConfig.fish3bet
                        ? "border-red-500 bg-red-500"
                        : "border-muted-foreground/30"
                    )}>
                      {dialogConfig.fish3bet && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Lose Rate (bb/100)</Label>
                      <Input
                        type="number"
                        value={dialogConfig.fishLoserate || 0}
                        onChange={(e) => setDialogConfig({ ...dialogConfig, fishLoserate: Number(e.target.value) })}
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Rake (bb/100)</Label>
                      <Input
                        type="number"
                        value={dialogConfig.fishRake || 0}
                        onChange={(e) => setDialogConfig({ ...dialogConfig, fishRake: Number(e.target.value) })}
                        disabled
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedSeatIndex(null)}>Cancel</Button>
            <Button onClick={handleSeatSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
