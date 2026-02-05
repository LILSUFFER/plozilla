import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Users, DollarSign } from 'lucide-react';

type PlayerType = 'hero' | 'reg' | 'fish' | 'empty';

interface Seat {
  type: PlayerType;
  vpip?: number;
}

const POSITION_NAMES = ['BTN', 'CO', 'MP', 'UTG', 'BB', 'SB'];
const POSITION_COEFFICIENTS: Record<string, number> = {
  'BTN': 1.5,
  'CO': 1.1,
  'MP': 0.7,
  'UTG': 0.8,
  'SB': 0.9,
  'BB': 0.9,
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
  const [tableRake, setTableRake] = useState<number>(41);

  const heroSeatIndex = seats.findIndex(s => s.type === 'hero');

  const getPositionName = (seatIndex: number): string => {
    const offset = (seatIndex - heroSeatIndex + 6) % 6;
    return POSITION_NAMES[offset];
  };

  const getPositionCoefficient = (seatIndex: number): number => {
    const posName = getPositionName(seatIndex);
    return POSITION_COEFFICIENTS[posName] || 1;
  };

  const updateSeat = (index: number, updates: Partial<Seat>) => {
    setSeats(prev => {
      const newSeats = [...prev];
      if (updates.type === 'hero') {
        newSeats.forEach((s, i) => {
          if (s.type === 'hero' && i !== index) {
            newSeats[i] = { type: 'reg' };
          }
        });
      }
      newSeats[index] = { ...newSeats[index], ...updates };
      return newSeats;
    });
  };

  const evCalculation = useMemo(() => {
    const fishSeats = seats
      .map((seat, index) => ({ seat, index }))
      .filter(({ seat }) => seat.type === 'fish');
    
    if (fishSeats.length === 0) {
      return { totalEv: 0, contributions: [], regsCount: 0 };
    }

    const regsCount = seats.filter(s => s.type === 'reg' || s.type === 'hero').length;
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
        tableRake,
        lossAfterRake,
        sharePerReg,
        heroCoef,
        heroRake,
        evContribution,
      };
    });

    const totalEv = contributions.reduce((sum, c) => sum + c.evContribution, 0);

    return { totalEv, contributions, regsCount };
  }, [seats, heroRake, tableRake, heroSeatIndex]);

  const getPlayerColor = (type: PlayerType): string => {
    switch (type) {
      case 'hero': return 'bg-blue-500 dark:bg-blue-600';
      case 'reg': return 'bg-slate-400 dark:bg-slate-500';
      case 'fish': return 'bg-green-500 dark:bg-green-600';
      case 'empty': return 'bg-muted';
      default: return 'bg-muted';
    }
  };

  const getPlayerLabel = (type: PlayerType): string => {
    switch (type) {
      case 'hero': return 'HERO';
      case 'reg': return 'REG';
      case 'fish': return 'FISH';
      case 'empty': return 'Empty';
      default: return '';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Total Expected Value
              </CardTitle>
              <CardDescription>
                Calculate your EV based on table composition
              </CardDescription>
            </div>
            <div className={`text-3xl font-bold ${evCalculation.totalEv >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {evCalculation.totalEv >= 0 ? '+' : ''}{evCalculation.totalEv.toFixed(2)}bb/100
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Regs + Hero (N)
              </Label>
              <div className="text-2xl font-semibold">{evCalculation.regsCount}</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="table-rake">Table Rake (bb/100)</Label>
              <Input
                id="table-rake"
                type="number"
                value={tableRake}
                onChange={(e) => setTableRake(parseFloat(e.target.value) || 0)}
                className="w-full"
                data-testid="input-table-rake"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hero-rake">Hero Rake (bb/100)</Label>
              <Input
                id="hero-rake"
                type="number"
                value={heroRake}
                onChange={(e) => setHeroRake(parseFloat(e.target.value) || 0)}
                className="w-full"
                data-testid="input-hero-rake"
              />
            </div>
          </div>

          {evCalculation.contributions.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-4">
              <h4 className="text-sm font-medium">Calculation Details</h4>
              {evCalculation.contributions.map((contrib, i) => (
                <div key={i} className="space-y-2 p-3 bg-background rounded-md">
                  <div className="flex items-center justify-between">
                    <span className="font-medium flex items-center gap-2">
                      Against Fish (Seat {contrib.seatIndex + 1})
                      <Badge variant="secondary">VPIP {contrib.vpip}%</Badge>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div>Loss - Rake: {contrib.fishLoss.toFixed(0)} - {contrib.tableRake} = {contrib.lossAfterRake.toFixed(0)}</div>
                    <div>Share (N={evCalculation.regsCount}): {contrib.sharePerReg.toFixed(1)}</div>
                    <div>Position Coef: {contrib.heroCoef.toFixed(1)}x</div>
                    <div>My Rake: -{contrib.heroRake}</div>
                  </div>
                  <div className={`text-sm font-medium ${contrib.evContribution >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    Fish EV contribution: {contrib.evContribution >= 0 ? '+' : ''}{contrib.evContribution.toFixed(2)}
                  </div>
                </div>
              ))}
              <div className="text-sm text-muted-foreground pt-2 border-t">
                Final EV = Sum of all Fish EV contributions
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>6-MAX Table</CardTitle>
          <CardDescription>Click on seats to change player type. Click Hero's seat to move your position.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative w-full max-w-md mx-auto aspect-square">
            <div className="absolute inset-[15%] rounded-full bg-green-700 dark:bg-green-800 border-8 border-amber-900 dark:border-amber-950 shadow-lg" />
            
            {seats.map((seat, index) => {
              const angle = (index * 60 - 90) * (Math.PI / 180);
              const radius = 42;
              const x = 50 + radius * Math.cos(angle);
              const y = 50 + radius * Math.sin(angle);
              const posName = getPositionName(index);
              const coef = getPositionCoefficient(index);

              return (
                <div
                  key={index}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1"
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  <Badge variant="outline" className="text-xs mb-1">
                    {posName}
                  </Badge>
                  <div
                    className={`w-16 h-16 rounded-full ${getPlayerColor(seat.type)} flex flex-col items-center justify-center cursor-pointer shadow-md hover-elevate active-elevate-2`}
                    onClick={() => {
                      const types: PlayerType[] = ['hero', 'reg', 'fish', 'empty'];
                      const currentIndex = types.indexOf(seat.type);
                      const nextType = types[(currentIndex + 1) % types.length];
                      updateSeat(index, { 
                        type: nextType,
                        vpip: nextType === 'fish' ? 50 : undefined
                      });
                    }}
                    data-testid={`seat-${index}`}
                  >
                    <span className="text-white font-bold text-xs">
                      {getPlayerLabel(seat.type)}
                    </span>
                    {seat.type === 'fish' && (
                      <span className="text-white text-xs">{seat.vpip}%</span>
                    )}
                  </div>
                  <Badge 
                    variant={seat.type === 'hero' ? 'default' : 'secondary'} 
                    className="text-xs"
                  >
                    {coef.toFixed(1)}x
                  </Badge>
                  
                  {seat.type === 'fish' && (
                    <div className="mt-1 w-20">
                      <Slider
                        value={[seat.vpip || 50]}
                        onValueChange={([value]) => updateSeat(index, { vpip: value })}
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
        </CardContent>
      </Card>

      <div className="bg-muted/30 rounded-lg p-6">
        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          <div className="flex flex-col items-center gap-2">
            <div className={`w-8 h-8 rounded-full ${getPlayerColor('hero')}`} />
            <span>Hero (You)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className={`w-8 h-8 rounded-full ${getPlayerColor('reg')}`} />
            <span>Regular</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className={`w-8 h-8 rounded-full ${getPlayerColor('fish')}`} />
            <span>Fish (Weak)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
