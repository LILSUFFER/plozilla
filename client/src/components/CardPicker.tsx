import { useState } from 'react';
import { type Card, type Rank, type Suit, RANKS, SUITS, getSuitSymbol, getSuitColor, getRankDisplay } from '@/lib/poker-evaluator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CardPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectCard: (card: Card) => void;
  disabledCards?: Card[];
  title?: string;
}

export function CardPicker({ open, onOpenChange, onSelectCard, disabledCards = [], title = 'Select a Card' }: CardPickerProps) {
  const isDisabled = (rank: Rank, suit: Suit) => {
    return disabledCards.some(c => c.rank === rank && c.suit === suit);
  };
  
  const handleSelect = (rank: Rank, suit: Suit) => {
    if (!isDisabled(rank, suit)) {
      onSelectCard({ rank, suit });
      onOpenChange(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-13 gap-1">
          {RANKS.map((rank) => (
            <div key={rank} className="col-span-1">
              {SUITS.map((suit) => {
                const disabled = isDisabled(rank, suit);
                const suitColor = getSuitColor(suit);
                return (
                  <button
                    key={`${rank}${suit}`}
                    onClick={() => handleSelect(rank, suit)}
                    disabled={disabled}
                    data-testid={`picker-${rank}${suit}`}
                    className={cn(
                      'w-full aspect-[3/4] flex flex-col items-center justify-center rounded-sm border text-xs font-semibold transition-all',
                      disabled 
                        ? 'opacity-30 cursor-not-allowed bg-muted' 
                        : 'bg-white dark:bg-gray-100 hover:scale-110 hover:shadow-md cursor-pointer',
                      suitColor === 'red' ? 'text-red-600' : 'text-gray-900'
                    )}
                  >
                    <span>{getRankDisplay(rank)}</span>
                    <span>{getSuitSymbol(suit)}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface InlineCardPickerProps {
  selectedCards: Card[];
  onSelectCard: (card: Card) => void;
  onRemoveCard: (index: number) => void;
  maxCards?: number;
}

export function InlineCardPicker({ selectedCards, onSelectCard, onRemoveCard, maxCards = 5 }: InlineCardPickerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  
  const isDisabled = (rank: Rank, suit: Suit) => {
    return selectedCards.some(c => c.rank === rank && c.suit === suit);
  };
  
  const handleCardClick = (index: number) => {
    if (selectedCards[index]) {
      onRemoveCard(index);
    } else {
      setSelectedIndex(index);
      setPickerOpen(true);
    }
  };
  
  const handleSelectCard = (card: Card) => {
    onSelectCard(card);
    setPickerOpen(false);
    setSelectedIndex(null);
  };
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-13 gap-0.5 sm:gap-1">
        {RANKS.map((rank) => (
          <div key={rank} className="space-y-0.5 sm:space-y-1">
            {SUITS.map((suit) => {
              const disabled = isDisabled(rank, suit);
              const suitColor = getSuitColor(suit);
              return (
                <button
                  key={`${rank}${suit}`}
                  onClick={() => !disabled && onSelectCard({ rank, suit })}
                  disabled={disabled || selectedCards.length >= maxCards}
                  data-testid={`inline-picker-${rank}${suit}`}
                  className={cn(
                    'w-full aspect-[3/4] flex flex-col items-center justify-center rounded-sm border text-[8px] sm:text-xs font-semibold transition-all',
                    disabled 
                      ? 'opacity-20 cursor-not-allowed bg-primary/20 border-primary' 
                      : selectedCards.length >= maxCards
                        ? 'opacity-50 cursor-not-allowed bg-muted'
                        : 'bg-white dark:bg-gray-100 hover:scale-105 hover:shadow-md cursor-pointer hover:border-primary',
                    suitColor === 'red' ? 'text-red-600' : 'text-gray-900'
                  )}
                >
                  <span>{getRankDisplay(rank)}</span>
                  <span className="text-[6px] sm:text-[10px]">{getSuitSymbol(suit)}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      
      <CardPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelectCard={handleSelectCard}
        disabledCards={selectedCards}
        title={`Select Card ${(selectedIndex ?? 0) + 1}`}
      />
    </div>
  );
}
