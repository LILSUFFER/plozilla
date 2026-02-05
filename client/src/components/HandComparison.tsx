import { useState } from 'react';
import { type Card, evaluateHand, compareHands, generateRandomHand, parseHand, handToString } from '@/lib/poker-evaluator';
import { CompactHandDisplay } from './HandDisplay';
import { InlineCardPicker } from './CardPicker';
import { Card as UICard, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Swords, Shuffle, X, ArrowRight } from 'lucide-react';
import { PlayingCard } from './PlayingCard';
import { cn } from '@/lib/utils';

export function HandComparison() {
  const [hand1, setHand1] = useState<Card[]>([]);
  const [hand2, setHand2] = useState<Card[]>([]);
  const [input1, setInput1] = useState('');
  const [input2, setInput2] = useState('');
  const [activeTab, setActiveTab] = useState<'picker' | 'text'>('picker');
  const [activeHand, setActiveHand] = useState<1 | 2>(1);
  
  const result1 = hand1.length === 5 ? evaluateHand(hand1) : null;
  const result2 = hand2.length === 5 ? evaluateHand(hand2) : null;
  
  let comparison: 'hand1' | 'hand2' | 'tie' | null = null;
  if (result1 && result2) {
    const cmp = compareHands(hand1, hand2);
    if (cmp > 0) comparison = 'hand1';
    else if (cmp < 0) comparison = 'hand2';
    else comparison = 'tie';
  }
  
  const allSelectedCards = [...hand1, ...hand2];
  
  const handleAddCard = (card: Card) => {
    if (activeHand === 1 && hand1.length < 5) {
      const newHand = [...hand1, card];
      setHand1(newHand);
      setInput1(handToString(newHand));
      if (newHand.length === 5) setActiveHand(2);
    } else if (activeHand === 2 && hand2.length < 5) {
      const newHand = [...hand2, card];
      setHand2(newHand);
      setInput2(handToString(newHand));
    }
  };
  
  const handleRemoveCard = (handNum: 1 | 2, index: number) => {
    if (handNum === 1) {
      const newHand = hand1.filter((_, i) => i !== index);
      setHand1(newHand);
      setInput1(handToString(newHand));
    } else {
      const newHand = hand2.filter((_, i) => i !== index);
      setHand2(newHand);
      setInput2(handToString(newHand));
    }
  };
  
  const handleTextInput = (handNum: 1 | 2, value: string) => {
    if (handNum === 1) {
      setInput1(value);
      const parsed = parseHand(value);
      if (parsed && parsed.length === 5) {
        const conflicts = parsed.some(c => 
          hand2.some(h => h.rank === c.rank && h.suit === c.suit)
        );
        if (!conflicts) setHand1(parsed);
      }
    } else {
      setInput2(value);
      const parsed = parseHand(value);
      if (parsed && parsed.length === 5) {
        const conflicts = parsed.some(c => 
          hand1.some(h => h.rank === c.rank && h.suit === c.suit)
        );
        if (!conflicts) setHand2(parsed);
      }
    }
  };
  
  const handleRandomize = (handNum: 1 | 2) => {
    const existingCards = handNum === 1 ? hand2 : hand1;
    let newHand: Card[];
    let attempts = 0;
    
    do {
      newHand = generateRandomHand();
      const hasConflict = newHand.some(c =>
        existingCards.some(e => e.rank === c.rank && e.suit === c.suit)
      );
      if (!hasConflict) break;
      attempts++;
    } while (attempts < 100);
    
    if (handNum === 1) {
      setHand1(newHand);
      setInput1(handToString(newHand));
    } else {
      setHand2(newHand);
      setInput2(handToString(newHand));
    }
  };
  
  const handleRandomizeBoth = () => {
    const h1 = generateRandomHand();
    let h2: Card[];
    let attempts = 0;
    
    do {
      h2 = generateRandomHand();
      const hasConflict = h2.some(c =>
        h1.some(e => e.rank === c.rank && e.suit === c.suit)
      );
      if (!hasConflict) break;
      attempts++;
    } while (attempts < 100);
    
    setHand1(h1);
    setHand2(h2);
    setInput1(handToString(h1));
    setInput2(handToString(h2));
  };
  
  const clearAll = () => {
    setHand1([]);
    setHand2([]);
    setInput1('');
    setInput2('');
    setActiveHand(1);
  };
  
  return (
    <UICard>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Swords className="w-5 h-5" />
          Compare Two Hands
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'picker' | 'text')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="picker" data-testid="tab-picker">Card Picker</TabsTrigger>
            <TabsTrigger value="text" data-testid="tab-text">Text Input</TabsTrigger>
          </TabsList>
          
          <TabsContent value="picker" className="space-y-4 mt-4">
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRandomizeBoth}
                data-testid="button-random-both"
              >
                <Shuffle className="w-4 h-4 mr-2" />
                Random Both
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearAll}
                data-testid="button-clear-all"
              >
                <X className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className={cn(
                    'text-sm font-medium',
                    activeHand === 1 && hand1.length < 5 && 'text-primary'
                  )}>
                    Hand 1 {activeHand === 1 && hand1.length < 5 && '(selecting)'}
                  </Label>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleRandomize(1)}
                    data-testid="button-random-hand1"
                  >
                    <Shuffle className="w-4 h-4" />
                  </Button>
                </div>
                <div 
                  className={cn(
                    'flex gap-1 p-2 rounded-md border-2 min-h-[80px] items-center justify-center flex-wrap cursor-pointer',
                    activeHand === 1 ? 'border-primary bg-primary/5' : 'border-muted'
                  )}
                  onClick={() => setActiveHand(1)}
                  data-testid="hand1-slot"
                >
                  {hand1.length === 0 ? (
                    <span className="text-sm text-muted-foreground">Click to select cards</span>
                  ) : (
                    hand1.map((card, i) => (
                      <div key={i} className="relative group">
                        <PlayingCard card={card} size="sm" onClick={() => handleRemoveCard(1, i)} />
                        <button
                          className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          onClick={(e) => { e.stopPropagation(); handleRemoveCard(1, i); }}
                        >
                          x
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className={cn(
                    'text-sm font-medium',
                    activeHand === 2 && hand2.length < 5 && 'text-primary'
                  )}>
                    Hand 2 {activeHand === 2 && hand2.length < 5 && '(selecting)'}
                  </Label>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleRandomize(2)}
                    data-testid="button-random-hand2"
                  >
                    <Shuffle className="w-4 h-4" />
                  </Button>
                </div>
                <div 
                  className={cn(
                    'flex gap-1 p-2 rounded-md border-2 min-h-[80px] items-center justify-center flex-wrap cursor-pointer',
                    activeHand === 2 ? 'border-primary bg-primary/5' : 'border-muted'
                  )}
                  onClick={() => setActiveHand(2)}
                  data-testid="hand2-slot"
                >
                  {hand2.length === 0 ? (
                    <span className="text-sm text-muted-foreground">Click to select cards</span>
                  ) : (
                    hand2.map((card, i) => (
                      <div key={i} className="relative group">
                        <PlayingCard card={card} size="sm" onClick={() => handleRemoveCard(2, i)} />
                        <button
                          className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          onClick={(e) => { e.stopPropagation(); handleRemoveCard(2, i); }}
                        >
                          x
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            
            <div className="pt-2">
              <Label className="text-sm text-muted-foreground mb-2 block">
                Click a card to add to {activeHand === 1 ? 'Hand 1' : 'Hand 2'}
              </Label>
              <InlineCardPicker
                selectedCards={allSelectedCards}
                onSelectCard={handleAddCard}
                onRemoveCard={() => {}}
                maxCards={10}
              />
            </div>
          </TabsContent>
          
          <TabsContent value="text" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Enter hands in format: <code className="bg-muted px-1 rounded">Ah Ks Qd Jc Tc</code>
            </p>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hand 1</Label>
                <div className="flex gap-2">
                  <Input
                    value={input1}
                    onChange={(e) => handleTextInput(1, e.target.value)}
                    placeholder="Ah Ks Qd Jc Tc"
                    data-testid="input-hand1"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => handleRandomize(1)}
                    data-testid="button-random-text-hand1"
                  >
                    <Shuffle className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Hand 2</Label>
                <div className="flex gap-2">
                  <Input
                    value={input2}
                    onChange={(e) => handleTextInput(2, e.target.value)}
                    placeholder="2c 2d 2h 2s 3c"
                    data-testid="input-hand2"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => handleRandomize(2)}
                    data-testid="button-random-text-hand2"
                  >
                    <Shuffle className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        {(result1 || result2) && (
          <div className="space-y-4 pt-4 border-t">
            <div className="grid md:grid-cols-2 gap-4">
              {hand1.length === 5 && (
                <CompactHandDisplay
                  cards={hand1}
                  result={result1}
                  label="Hand 1"
                  isWinner={comparison === 'hand1'}
                  isTie={comparison === 'tie'}
                />
              )}
              {hand2.length === 5 && (
                <CompactHandDisplay
                  cards={hand2}
                  result={result2}
                  label="Hand 2"
                  isWinner={comparison === 'hand2'}
                  isTie={comparison === 'tie'}
                />
              )}
            </div>
            
            {comparison && (
              <div className="text-center py-4">
                {comparison === 'tie' ? (
                  <p className="text-xl font-bold text-amber-500" data-testid="comparison-result">
                    It's a Tie!
                  </p>
                ) : (
                  <p className="text-xl font-bold text-green-500" data-testid="comparison-result">
                    {comparison === 'hand1' ? 'Hand 1' : 'Hand 2'} Wins!
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </UICard>
  );
}
