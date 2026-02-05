import { type Card, type HandResult } from '@/lib/poker-evaluator';
import { PlayingCard, CardPlaceholder } from './PlayingCard';
import { Card as UICard, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Trophy, TrendingUp, Hash, Percent } from 'lucide-react';

interface HandDisplayProps {
  cards: Card[];
  result: HandResult | null;
  onCardClick?: (index: number) => void;
  title?: string;
  className?: string;
}

export function HandDisplay({ cards, result, onCardClick, title = 'Your Hand', className }: HandDisplayProps) {
  const categoryColors: Record<string, string> = {
    'Royal Flush': 'bg-amber-500 text-white',
    'Straight Flush': 'bg-purple-500 text-white',
    'Four of a Kind': 'bg-pink-500 text-white',
    'Full House': 'bg-blue-500 text-white',
    'Flush': 'bg-cyan-500 text-white',
    'Straight': 'bg-green-500 text-white',
    'Three of a Kind': 'bg-orange-500 text-white',
    'Two Pair': 'bg-lime-600 text-white',
    'One Pair': 'bg-slate-500 text-white',
    'High Card': 'bg-gray-400 text-white',
  };
  
  return (
    <UICard className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="w-5 h-5 text-amber-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center gap-2 flex-wrap" data-testid="hand-cards">
          {Array.from({ length: 5 }).map((_, i) => (
            cards[i] ? (
              <PlayingCard
                key={`${cards[i].rank}${cards[i].suit}`}
                card={cards[i]}
                size="lg"
                onClick={onCardClick ? () => onCardClick(i) : undefined}
              />
            ) : (
              <CardPlaceholder
                key={i}
                size="lg"
                label={String(i + 1)}
                onClick={onCardClick ? () => onCardClick(i) : undefined}
              />
            )
          ))}
        </div>
        
        {result && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-center">
              <Badge 
                className={cn('text-base px-4 py-1.5 no-default-hover-elevate no-default-active-elevate', categoryColors[result.category] || 'bg-primary')}
                data-testid="hand-category"
              >
                {result.category}
              </Badge>
            </div>
            
            <p className="text-center text-sm text-muted-foreground" data-testid="hand-description">
              {result.description}
            </p>
            
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <Hash className="w-4 h-4" />
                  <span className="text-xs">Rank</span>
                </div>
                <p className="font-mono font-bold text-lg" data-testid="hand-rank">
                  {result.handRank.toLocaleString()}
                </p>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs">of</span>
                </div>
                <p className="font-mono text-lg text-muted-foreground">
                  {result.totalHands.toLocaleString()}
                </p>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                  <Percent className="w-4 h-4" />
                  <span className="text-xs">Percentile</span>
                </div>
                <p className="font-mono font-bold text-lg" data-testid="hand-percentile">
                  {result.percentile.toFixed(2)}%
                </p>
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Weaker hands</span>
                <span>Stronger hands</span>
              </div>
              <Progress value={result.percentile} className="h-3" />
            </div>
          </div>
        )}
        
        {!result && cards.length < 5 && (
          <p className="text-center text-sm text-muted-foreground">
            Select {5 - cards.length} more card{5 - cards.length !== 1 ? 's' : ''} to evaluate
          </p>
        )}
      </CardContent>
    </UICard>
  );
}

interface CompactHandDisplayProps {
  cards: Card[];
  result: HandResult | null;
  label?: string;
  isWinner?: boolean;
  isTie?: boolean;
  className?: string;
}

export function CompactHandDisplay({ cards, result, label, isWinner, isTie, className }: CompactHandDisplayProps) {
  return (
    <div className={cn(
      'p-4 rounded-lg border-2 transition-all',
      isWinner ? 'border-green-500 bg-green-500/10' : isTie ? 'border-amber-500 bg-amber-500/10' : 'border-transparent bg-card',
      className
    )}>
      {label && (
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold">{label}</span>
          {isWinner && <Badge className="bg-green-500">Winner</Badge>}
          {isTie && <Badge className="bg-amber-500">Tie</Badge>}
        </div>
      )}
      
      <div className="flex justify-center gap-1 mb-3" data-testid={`comparison-hand-${label?.toLowerCase().replace(' ', '-')}`}>
        {cards.map((card, i) => (
          <PlayingCard key={i} card={card} size="md" />
        ))}
      </div>
      
      {result && (
        <div className="text-center space-y-1">
          <p className="font-semibold">{result.category}</p>
          <p className="text-sm text-muted-foreground">{result.description}</p>
          <p className="text-xs text-muted-foreground">
            Rank: {result.handRank.toLocaleString()} ({result.percentile.toFixed(2)}%)
          </p>
        </div>
      )}
    </div>
  );
}
