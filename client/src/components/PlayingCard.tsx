import { type Card, getSuitSymbol, getSuitColor, getRankDisplay } from '@/lib/poker-evaluator';
import { cn } from '@/lib/utils';

interface PlayingCardProps {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PlayingCard({ card, selected, onClick, size = 'md', className }: PlayingCardProps) {
  const suitSymbol = getSuitSymbol(card.suit);
  const suitColor = getSuitColor(card.suit);
  const rankDisplay = getRankDisplay(card.rank);
  
  const sizeClasses = {
    sm: 'w-10 h-14 text-sm',
    md: 'w-14 h-20 text-lg',
    lg: 'w-20 h-28 text-2xl'
  };
  
  return (
    <div
      onClick={onClick}
      data-testid={`card-${card.rank}${card.suit}`}
      className={cn(
        'relative flex flex-col items-center justify-between rounded-md border-2 bg-white dark:bg-gray-100 transition-all duration-200',
        sizeClasses[size],
        onClick && 'cursor-pointer hover-elevate active-elevate-2',
        selected ? 'border-primary ring-2 ring-primary/50 scale-105' : 'border-gray-300',
        suitColor === 'red' ? 'text-red-600' : 'text-gray-900',
        className
      )}
    >
      <div className="absolute top-0.5 left-1 flex flex-col items-center leading-none">
        <span className="font-bold">{rankDisplay}</span>
        <span className="text-xs">{suitSymbol}</span>
      </div>
      <div className={cn(
        'flex items-center justify-center flex-1',
        size === 'sm' ? 'text-lg' : size === 'md' ? 'text-2xl' : 'text-4xl'
      )}>
        {suitSymbol}
      </div>
      <div className="absolute bottom-0.5 right-1 flex flex-col items-center leading-none rotate-180">
        <span className="font-bold">{rankDisplay}</span>
        <span className="text-xs">{suitSymbol}</span>
      </div>
    </div>
  );
}

interface CardPlaceholderProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  onClick?: () => void;
  className?: string;
}

export function CardPlaceholder({ size = 'md', label, onClick, className }: CardPlaceholderProps) {
  const sizeClasses = {
    sm: 'w-10 h-14',
    md: 'w-14 h-20',
    lg: 'w-20 h-28'
  };
  
  return (
    <div
      onClick={onClick}
      data-testid="card-placeholder"
      className={cn(
        'flex items-center justify-center rounded-md border-2 border-dashed transition-all duration-200',
        'border-muted-foreground/30 bg-muted/50 text-muted-foreground/50',
        sizeClasses[size],
        onClick && 'cursor-pointer hover:border-primary hover:bg-primary/10',
        className
      )}
    >
      {label && <span className="text-xs">{label}</span>}
    </div>
  );
}
