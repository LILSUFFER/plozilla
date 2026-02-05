import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

type PlayerType = 'hero' | 'reg' | 'fish' | 'empty';

interface Seat {
  type: PlayerType;
  vpip?: number;
}

const POSITION_COEFFICIENTS = [0.9, 0.8, 0.7, 1.5, 1.1, 0.9];

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

  const getPositionCoefficient = (seatIndex: number): number => {
    const offset = (seatIndex - heroSeatIndex + 6) % 6;
    return POSITION_COEFFICIENTS[offset];
  };

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

    const heroCoef = getPositionCoefficient(heroSeatIndex);
    
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
        heroCoef,
        evContribution,
      };
    });

    const totalEv = contributions.reduce((sum, c) => sum + c.evContribution, 0);

    return { totalEv, contributions, regsCount };
  }, [seats, heroRake, heroSeatIndex]);

  const getPlayerColor = (type: PlayerType): string => {
    switch (type) {
      case 'hero': return 'bg-blue-500';
      case 'reg': return 'bg-gray-400';
      case 'fish': return 'bg-green-500';
      case 'empty': return 'bg-gray-600';
      default: return 'bg-gray-600';
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

  return (
    <div className="flex gap-6 items-start max-w-5xl mx-auto">
      <div className="flex-1 space-y-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-muted-foreground text-sm mb-1">Total Expected Value</div>
          <div className={`text-4xl font-bold ${evCalculation.totalEv >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {evCalculation.totalEv >= 0 ? '+' : ''}{evCalculation.totalEv.toFixed(2)}bb/100
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border rounded-lg p-4">
            <div className="text-muted-foreground text-sm mb-1">Regs + Hero (N-reg)</div>
            <div className="text-2xl font-bold">{evCalculation.regsCount}</div>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <Label htmlFor="hero-rake" className="text-muted-foreground text-sm">Hero Rake (bb/100)</Label>
            <Input
              id="hero-rake"
              type="number"
              value={heroRake}
              onChange={(e) => setHeroRake(parseFloat(e.target.value) || 0)}
              className="mt-1 text-lg font-semibold"
              data-testid="input-hero-rake"
            />
          </div>
        </div>

        {evCalculation.contributions.length > 0 && (
          <div className="bg-card border rounded-lg p-4">
            <div className="text-sm font-medium mb-3">Calculation Details</div>
            {evCalculation.contributions.map((contrib, i) => (
              <div key={i} className="bg-muted/50 rounded-md p-3 mb-2 last:mb-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">Against Fish (Seat {contrib.seatIndex + 1})</span>
                  <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded">VPIP {contrib.vpip}%</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <div>Loss - Rake:<span className="text-foreground ml-1">{contrib.fishLoss.toFixed(0)} - {tableRake} = {contrib.lossAfterRake.toFixed(0)}</span></div>
                  <div>Share (N={evCalculation.regsCount}):<span className="text-foreground ml-1">{contrib.sharePerReg.toFixed(1)}</span></div>
                  <div>Position Coef:<span className="text-foreground ml-1">{contrib.heroCoef.toFixed(1)}x</span></div>
                  <div>My Rake:<span className="text-foreground ml-1">-{heroRake}</span></div>
                </div>
                <div className={`text-sm font-medium mt-2 ${contrib.evContribution >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  Fish EV contribution: {contrib.evContribution >= 0 ? '+' : ''}{contrib.evContribution.toFixed(2)}
                </div>
              </div>
            ))}
            <div className="text-xs text-muted-foreground mt-3 pt-2 border-t">
              Final EV = Sum of all Fish EV contributions
            </div>
          </div>
        )}
      </div>

      <div className="bg-card border rounded-lg p-4">
        <div className="text-center font-medium mb-4">6-MAX</div>
        <div className="relative w-72 h-72">
          <div className="absolute inset-8 rounded-full bg-green-700 border-8 border-amber-800" />
          
          {seats.map((seat, index) => {
            const angle = (index * 60 - 90) * (Math.PI / 180);
            const radius = 42;
            const x = 50 + radius * Math.cos(angle);
            const y = 50 + radius * Math.sin(angle);
            const coef = getPositionCoefficient(index);

            return (
              <div
                key={index}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <div className="text-xs text-muted-foreground mb-1">{coef.toFixed(1)}x</div>
                <div
                  className={`w-14 h-14 rounded-full ${getPlayerColor(seat.type)} flex flex-col items-center justify-center cursor-pointer shadow-md hover:scale-105 transition-transform`}
                  onClick={() => cyclePlayerType(index)}
                  data-testid={`seat-${index}`}
                >
                  <span className="text-white font-bold text-xs">
                    {getPlayerLabel(seat.type)}
                  </span>
                  {seat.type === 'fish' && (
                    <span className="text-white text-xs">{seat.vpip}%</span>
                  )}
                </div>
                {seat.type === 'fish' && (
                  <div className="mt-1 w-16">
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
    </div>
  );
}
