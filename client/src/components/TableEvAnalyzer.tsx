import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';

type PlayerType = 'hero' | 'reg' | 'fish' | 'empty';

interface Seat {
  type: PlayerType;
  vpip?: number;
}

const POSITION_NAMES = ['BB', 'UTG', 'MP', 'CO', 'BTN', 'SB'];
const POSITION_COEFFICIENTS: Record<string, number> = {
  'BTN': 1.5,
  'CO': 1.1,
  'MP': 0.7,
  'UTG': 0.8,
  'BB': 0.9,
  'SB': 0.9,
};

const DEFAULT_SEATS: Seat[] = [
  { type: 'hero' },
  { type: 'reg' },
  { type: 'reg' },
  { type: 'fish', vpip: 90 },
  { type: 'reg' },
  { type: 'reg' },
];

export function TableEvAnalyzer() {
  const [seats, setSeats] = useState<Seat[]>(DEFAULT_SEATS);
  const [heroRake, setHeroRake] = useState<number>(11);
  const tableRake = 41;

  const heroSeatIndex = seats.findIndex(s => s.type === 'hero');
  const heroPosition = POSITION_NAMES[heroSeatIndex];
  const heroCoef = POSITION_COEFFICIENTS[heroPosition] || 1;

  const cyclePlayerType = (index: number) => {
    setSeats(prev => {
      const newSeats = [...prev];
      const current = newSeats[index].type;
      const types: PlayerType[] = ['hero', 'reg', 'fish', 'empty'];
      const currentIdx = types.indexOf(current);
      const nextType = types[(currentIdx + 1) % types.length];
      
      if (nextType === 'hero') {
        newSeats.forEach((s, i) => {
          if (s.type === 'hero') {
            newSeats[i] = { type: 'reg' };
          }
        });
      }
      
      newSeats[index] = { 
        type: nextType,
        vpip: nextType === 'fish' ? 50 : undefined
      };
      return newSeats;
    });
  };

  const updateVpip = (index: number, vpip: number) => {
    setSeats(prev => {
      const newSeats = [...prev];
      newSeats[index] = { ...newSeats[index], vpip };
      return newSeats;
    });
  };

  const evCalculation = useMemo(() => {
    const fishSeats = seats
      .map((seat, index) => ({ seat, index }))
      .filter(({ seat }) => seat.type === 'fish');
    
    const regsCount = seats.filter(s => s.type === 'reg' || s.type === 'hero').length;
    
    if (fishSeats.length === 0 || regsCount === 0) {
      return { totalEv: 0, contributions: [], regsCount };
    }
    
    const contributions = fishSeats.map(({ seat, index }) => {
      const vpip = seat.vpip || 50;
      const fishLoss = (vpip / 100) * 200;
      const lossAfterRake = fishLoss - tableRake;
      const sharePerReg = lossAfterRake / regsCount;
      const evContribution = sharePerReg * heroCoef - heroRake;
      
      return {
        seatIndex: index,
        vpip,
        fishLoss,
        lossAfterRake,
        sharePerReg,
        evContribution,
      };
    });

    const totalEv = contributions.reduce((sum, c) => sum + c.evContribution, 0);

    return { totalEv, contributions, regsCount };
  }, [seats, heroRake, heroCoef]);

  const getPlayerColor = (type: PlayerType): string => {
    switch (type) {
      case 'hero': return 'bg-blue-500 hover:bg-blue-600';
      case 'reg': return 'bg-slate-500 hover:bg-slate-600';
      case 'fish': return 'bg-emerald-500 hover:bg-emerald-600';
      case 'empty': return 'bg-slate-700 hover:bg-slate-600';
      default: return 'bg-slate-700';
    }
  };

  const getPlayerLabel = (type: PlayerType): string => {
    switch (type) {
      case 'hero': return 'HERO';
      case 'reg': return 'REG';
      case 'fish': return 'FISH';
      case 'empty': return '';
      default: return '';
    }
  };

  const seatPositions = [
    { x: 50, y: 5 },
    { x: 90, y: 25 },
    { x: 90, y: 75 },
    { x: 50, y: 95 },
    { x: 10, y: 75 },
    { x: 10, y: 25 },
  ];

  return (
    <div className="h-[calc(100vh-180px)] flex gap-8 p-2">
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <Card className="p-6">
          <div className="text-sm text-muted-foreground mb-1">Total Expected Value</div>
          <div className={`text-5xl font-bold tracking-tight ${evCalculation.totalEv >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {evCalculation.totalEv >= 0 ? '+' : ''}{evCalculation.totalEv.toFixed(2)}bb/100
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Regs + Hero (N-reg)</div>
            <div className="text-3xl font-bold">{evCalculation.regsCount}</div>
          </Card>
          <Card className="p-4">
            <Label htmlFor="hero-rake" className="text-sm text-muted-foreground">Hero Rake (bb/100)</Label>
            <Input
              id="hero-rake"
              type="number"
              value={heroRake}
              onChange={(e) => setHeroRake(parseFloat(e.target.value) || 0)}
              className="mt-1 text-xl font-bold h-10"
              data-testid="input-hero-rake"
            />
          </Card>
        </div>

        {evCalculation.contributions.length > 0 && (
          <Card className="p-4 flex-1 overflow-auto">
            <div className="text-sm font-semibold mb-3">Calculation Details</div>
            <div className="space-y-3">
              {evCalculation.contributions.map((contrib, i) => (
                <div key={i} className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-semibold">Against Fish (Seat {contrib.seatIndex + 1})</span>
                    <span className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium px-2 py-1 rounded-full">
                      VPIP {contrib.vpip}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Loss - Rake:</span>
                      <span className="font-medium">{contrib.fishLoss.toFixed(0)} - {tableRake} = {contrib.lossAfterRake.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Share (N={evCalculation.regsCount}):</span>
                      <span className="font-medium">{contrib.sharePerReg.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Position Coef:</span>
                      <span className="font-medium">{heroCoef.toFixed(1)}x</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">My Rake:</span>
                      <span className="font-medium">-{heroRake}</span>
                    </div>
                  </div>
                  <div className={`text-sm font-semibold mt-3 pt-2 border-t ${contrib.evContribution >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    Fish EV contribution: {contrib.evContribution >= 0 ? '+' : ''}{contrib.evContribution.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground mt-4 pt-3 border-t">
              Final EV = Sum of all Fish EV contributions
            </div>
          </Card>
        )}
      </div>

      <Card className="w-[420px] flex-shrink-0 p-6 flex flex-col">
        <div className="text-center font-bold text-lg mb-4">6-MAX Table</div>
        <div className="flex-1 flex items-center justify-center">
          <div className="relative w-[340px] h-[280px]">
            <div 
              className="absolute rounded-[50%] bg-gradient-to-b from-emerald-600 to-emerald-700 shadow-[inset_0_-8px_20px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.2)]"
              style={{
                left: '15%',
                right: '15%',
                top: '15%',
                bottom: '15%',
                border: '12px solid #5c4033',
                boxShadow: 'inset 0 -8px 20px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.1)'
              }}
            />
            
            {seats.map((seat, index) => {
              const pos = seatPositions[index];
              const posName = POSITION_NAMES[index];
              const coef = POSITION_COEFFICIENTS[posName];
              const isFish = seat.type === 'fish';
              const isHero = seat.type === 'hero';

              return (
                <div
                  key={index}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                >
                  <div className={`text-xs font-medium mb-1 ${isHero ? 'text-blue-400' : 'text-muted-foreground'}`}>
                    {coef.toFixed(1)}x
                  </div>
                  <div
                    className={`w-14 h-14 rounded-full ${getPlayerColor(seat.type)} flex flex-col items-center justify-center cursor-pointer shadow-lg transition-all duration-150 active:scale-95 ring-2 ${isHero ? 'ring-blue-400' : 'ring-white/20'}`}
                    onClick={() => cyclePlayerType(index)}
                    data-testid={`seat-${index}`}
                  >
                    <span className="text-white font-bold text-xs drop-shadow">
                      {getPlayerLabel(seat.type)}
                    </span>
                    {isFish && (
                      <span className="text-white/90 text-[10px] font-medium">{seat.vpip}%</span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">{posName}</div>
                  {isFish && (
                    <div className="mt-1 w-20">
                      <Slider
                        value={[seat.vpip || 50]}
                        onValueChange={([value]) => updateVpip(index, value)}
                        min={20}
                        max={100}
                        step={5}
                        className="w-full"
                        data-testid={`vpip-slider-${index}`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t">
          <div className="text-xs text-muted-foreground text-center mb-3">Click seats to change player type</div>
          <div className="flex justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500" />
              <span className="text-xs">Hero</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-slate-500" />
              <span className="text-xs">Reg</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-emerald-500" />
              <span className="text-xs">Fish</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
