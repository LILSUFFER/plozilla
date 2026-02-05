import { type Card, getRankDisplay } from '@/lib/poker-evaluator';
import { cn } from '@/lib/utils';

interface CardChipProps {
  card: Card;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function getSuitBgColor(suit: string): string {
  switch (suit) {
    case 'h': return 'bg-red-600';
    case 'd': return 'bg-red-700';
    case 's': return 'bg-blue-600';
    case 'c': return 'bg-gray-600';
    default: return 'bg-gray-500';
  }
}

export function CardChip({ card, size = 'md', className }: CardChipProps) {
  const rankDisplay = getRankDisplay(card.rank);
  const bgColor = getSuitBgColor(card.suit);
  
  const sizeClasses = {
    sm: 'w-6 h-7 text-xs',
    md: 'w-7 h-8 text-sm',
    lg: 'w-9 h-10 text-base'
  };
  
  return (
    <div
      data-testid={`card-chip-${card.rank}${card.suit}`}
      className={cn(
        'flex items-center justify-center rounded font-bold text-white',
        bgColor,
        sizeClasses[size],
        className
      )}
    >
      {rankDisplay}
    </div>
  );
}

interface CardChipsProps {
  cards: Card[];
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CardChips({ cards, size = 'md', className }: CardChipsProps) {
  return (
    <div className={cn('flex gap-0.5 flex-wrap', className)}>
      {cards.map((card, i) => (
        <CardChip key={`${card.rank}${card.suit}-${i}`} card={card} size={size} />
      ))}
    </div>
  );
}
