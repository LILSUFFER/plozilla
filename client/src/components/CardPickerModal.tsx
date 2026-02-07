import { useState, useEffect } from 'react';
import { type Card, type Rank, type Suit, RANKS, SUITS, getRankDisplay } from '@/lib/poker-evaluator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CardChip } from '@/components/CardChip';
import { cn } from '@/lib/utils';

interface CardPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCards: Card[];
  onConfirm: (cards: Card[]) => void;
  disabledCards: Set<string>;
  maxCards: number;
  title: string;
}

const SUIT_ORDER: Suit[] = ['s', 'h', 'd', 'c'];
const RANK_ORDER: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

const SUIT_SYMBOLS: Record<Suit, string> = {
  s: '\u2660',
  h: '\u2665',
  d: '\u2666',
  c: '\u2663',
};

const SUIT_BG: Record<Suit, string> = {
  s: 'bg-slate-600',
  h: 'bg-red-500',
  d: 'bg-blue-500',
  c: 'bg-emerald-600',
};

const SUIT_TEXT_COLOR: Record<Suit, string> = {
  s: 'text-slate-400',
  h: 'text-red-500',
  d: 'text-blue-500',
  c: 'text-emerald-500',
};

function cardKey(card: Card): string {
  return `${card.rank}${card.suit}`;
}

export function CardPickerModal({
  open,
  onOpenChange,
  selectedCards,
  onConfirm,
  disabledCards,
  maxCards,
  title,
}: CardPickerModalProps) {
  const [selection, setSelection] = useState<Card[]>([]);

  useEffect(() => {
    if (open) {
      setSelection([...selectedCards]);
    }
  }, [open, selectedCards]);

  const selectionKeys = new Set(selection.map(cardKey));

  const toggleCard = (card: Card) => {
    const key = cardKey(card);
    if (disabledCards.has(key)) return;

    if (selectionKeys.has(key)) {
      setSelection((prev) => prev.filter((c) => cardKey(c) !== key));
    } else if (selection.length < maxCards) {
      setSelection((prev) => [...prev, card]);
    }
  };

  const handleConfirm = () => {
    onConfirm(selection);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleClear = () => {
    setSelection([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="card-picker-modal" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div data-testid="card-picker-selected" className="flex items-center gap-1 flex-wrap min-h-[2.5rem]">
          {selection.map((card) => (
            <CardChip key={cardKey(card)} card={card} size="md" />
          ))}
          {Array.from({ length: maxCards - selection.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="w-7 h-8 rounded border-2 border-dashed border-muted-foreground/30 bg-muted/50"
            />
          ))}
        </div>

        <div className="flex flex-col gap-1">
          {SUIT_ORDER.map((suit) => (
            <div key={suit} className="flex items-center gap-1">
              <span className={cn('w-5 text-center font-bold text-sm', SUIT_TEXT_COLOR[suit])}>
                {SUIT_SYMBOLS[suit]}
              </span>
              {RANK_ORDER.map((rank) => {
                const card: Card = { rank, suit };
                const key = cardKey(card);
                const isSelected = selectionKeys.has(key);
                const isDisabled = disabledCards.has(key);
                const display = getRankDisplay(rank);

                return (
                  <button
                    key={key}
                    data-testid={`card-picker-cell-${key}`}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => toggleCard(card)}
                    className={cn(
                      'w-9 h-8 rounded-md text-xs font-bold text-white transition-all duration-150 flex items-center justify-center',
                      SUIT_BG[suit],
                      isSelected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                      isDisabled && 'opacity-30 cursor-not-allowed',
                      !isDisabled && !isSelected && 'hover-elevate'
                    )}
                  >
                    {display}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap pt-2">
          <Button
            data-testid="card-picker-clear"
            variant="ghost"
            onClick={handleClear}
          >
            Clear
          </Button>
          <div className="flex items-center gap-2">
            <Button
              data-testid="card-picker-cancel"
              variant="outline"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              data-testid="card-picker-confirm"
              onClick={handleConfirm}
            >
              OK
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
