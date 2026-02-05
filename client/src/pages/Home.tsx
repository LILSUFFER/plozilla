import { useState } from 'react';
import { type Card, evaluateHand, generateRandomHand, parseHand, handToString } from '@/lib/poker-evaluator';
import { HandDisplay } from '@/components/HandDisplay';
import { HandComparison } from '@/components/HandComparison';
import { InlineCardPicker } from '@/components/CardPicker';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PlayingCard } from '@/components/PlayingCard';
import { Card as UICard, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Shuffle, X, Calculator, Swords, BookOpen, Spade } from 'lucide-react';

export default function Home() {
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [textInput, setTextInput] = useState('');
  const [inputMode, setInputMode] = useState<'picker' | 'text'>('picker');
  
  const result = selectedCards.length === 5 ? evaluateHand(selectedCards) : null;
  
  const handleAddCard = (card: Card) => {
    if (selectedCards.length < 5) {
      const newCards = [...selectedCards, card];
      setSelectedCards(newCards);
      setTextInput(handToString(newCards));
    }
  };
  
  const handleRemoveCard = (index: number) => {
    const newCards = selectedCards.filter((_, i) => i !== index);
    setSelectedCards(newCards);
    setTextInput(handToString(newCards));
  };
  
  const handleTextChange = (value: string) => {
    setTextInput(value);
    const parsed = parseHand(value);
    if (parsed) {
      setSelectedCards(parsed);
    }
  };
  
  const handleRandomHand = () => {
    const hand = generateRandomHand();
    setSelectedCards(hand);
    setTextInput(handToString(hand));
  };
  
  const handleClear = () => {
    setSelectedCards([]);
    setTextInput('');
  };
  
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Spade className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Poker Hand Evaluator</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">5-Card Poker Mathematics</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6 space-y-6">
        <Tabs defaultValue="evaluate" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
            <TabsTrigger value="evaluate" className="flex items-center gap-2" data-testid="tab-evaluate">
              <Calculator className="w-4 h-4" />
              <span className="hidden sm:inline">Evaluate</span>
            </TabsTrigger>
            <TabsTrigger value="compare" className="flex items-center gap-2" data-testid="tab-compare">
              <Swords className="w-4 h-4" />
              <span className="hidden sm:inline">Compare</span>
            </TabsTrigger>
            <TabsTrigger value="learn" className="flex items-center gap-2" data-testid="tab-learn">
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Learn</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="evaluate" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <UICard>
                <CardHeader>
                  <CardTitle>Select Your Hand</CardTitle>
                  <CardDescription>
                    Pick 5 cards to evaluate your poker hand
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'picker' | 'text')}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="picker">Card Picker</TabsTrigger>
                      <TabsTrigger value="text">Text Input</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="picker" className="mt-4 space-y-4">
                      <div className="flex gap-2 flex-wrap">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleRandomHand}
                          data-testid="button-random"
                        >
                          <Shuffle className="w-4 h-4 mr-2" />
                          Random Hand
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleClear}
                          disabled={selectedCards.length === 0}
                          data-testid="button-clear"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Clear
                        </Button>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">
                          Selected: {selectedCards.length}/5
                        </Label>
                        <div className="flex gap-1 min-h-[60px] p-2 rounded-md border bg-muted/30 flex-wrap items-center">
                          {selectedCards.length === 0 ? (
                            <span className="text-sm text-muted-foreground mx-auto">
                              Click cards below to select
                            </span>
                          ) : (
                            selectedCards.map((card, i) => (
                              <div key={i} className="relative group">
                                <PlayingCard 
                                  card={card} 
                                  size="sm" 
                                  onClick={() => handleRemoveCard(i)} 
                                />
                                <button
                                  className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                  onClick={() => handleRemoveCard(i)}
                                  data-testid={`button-remove-card-${i}`}
                                >
                                  x
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                      
                      <InlineCardPicker
                        selectedCards={selectedCards}
                        onSelectCard={handleAddCard}
                        onRemoveCard={handleRemoveCard}
                        maxCards={5}
                      />
                    </TabsContent>
                    
                    <TabsContent value="text" className="mt-4 space-y-4">
                      <div className="space-y-2">
                        <Label>Enter hand notation</Label>
                        <div className="flex gap-2">
                          <Input
                            value={textInput}
                            onChange={(e) => handleTextChange(e.target.value)}
                            placeholder="Ah Ks Qd Jc Tc"
                            className="font-mono"
                            data-testid="input-hand-text"
                          />
                          <Button 
                            variant="outline" 
                            size="icon"
                            onClick={handleRandomHand}
                            data-testid="button-random-text"
                          >
                            <Shuffle className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Format: Rank (2-9, T, J, Q, K, A) + Suit (c, d, h, s)
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="p-2 rounded bg-muted/50">
                          <p className="font-mono">Ah</p>
                          <p className="text-xs text-muted-foreground">Ace of Hearts</p>
                        </div>
                        <div className="p-2 rounded bg-muted/50">
                          <p className="font-mono">Tc</p>
                          <p className="text-xs text-muted-foreground">Ten of Clubs</p>
                        </div>
                        <div className="p-2 rounded bg-muted/50">
                          <p className="font-mono">Ks</p>
                          <p className="text-xs text-muted-foreground">King of Spades</p>
                        </div>
                        <div className="p-2 rounded bg-muted/50">
                          <p className="font-mono">2d</p>
                          <p className="text-xs text-muted-foreground">Two of Diamonds</p>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </UICard>
              
              <HandDisplay
                cards={selectedCards}
                result={result}
                onCardClick={handleRemoveCard}
              />
            </div>
          </TabsContent>
          
          <TabsContent value="compare">
            <HandComparison />
          </TabsContent>
          
          <TabsContent value="learn" className="space-y-6">
            <UICard>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Poker Hand Rankings
                </CardTitle>
                <CardDescription>
                  Understanding the mathematics behind 5-card poker
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="rankings">
                    <AccordionTrigger>Hand Rankings (Best to Worst)</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3">
                        {[
                          { name: 'Royal Flush', count: 4, desc: 'A, K, Q, J, 10 all of the same suit', example: 'Ah Kh Qh Jh Th' },
                          { name: 'Straight Flush', count: 36, desc: 'Five cards in sequence, all of the same suit', example: '9h 8h 7h 6h 5h' },
                          { name: 'Four of a Kind', count: 624, desc: 'Four cards of the same rank', example: 'Ah Ac Ad As Kh' },
                          { name: 'Full House', count: 3744, desc: 'Three of a kind plus a pair', example: 'Ah Ac Ad Kh Ks' },
                          { name: 'Flush', count: 5108, desc: 'Five cards of the same suit (not in sequence)', example: 'Ah Jh 8h 5h 2h' },
                          { name: 'Straight', count: 10200, desc: 'Five cards in sequence (not same suit)', example: 'Ah Kd Qc Js Th' },
                          { name: 'Three of a Kind', count: 54912, desc: 'Three cards of the same rank', example: 'Ah Ac Ad Kh Qs' },
                          { name: 'Two Pair', count: 123552, desc: 'Two different pairs', example: 'Ah Ac Kh Ks Qd' },
                          { name: 'One Pair', count: 1098240, desc: 'Two cards of the same rank', example: 'Ah Ac Kh Qs Jd' },
                          { name: 'High Card', count: 1302540, desc: 'No matching cards', example: 'Ah Kd Qc Js 9h' },
                        ].map((hand, i) => (
                          <div key={hand.name} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-md bg-muted/50">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                                {i + 1}
                              </span>
                              <span className="font-semibold">{hand.name}</span>
                            </div>
                            <span className="text-sm text-muted-foreground flex-1">{hand.desc}</span>
                            <code className="text-xs bg-background px-2 py-1 rounded font-mono">{hand.example}</code>
                            <span className="text-xs text-muted-foreground">{hand.count.toLocaleString()} hands</span>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="math">
                    <AccordionTrigger>The Mathematics</AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      <p>
                        There are exactly <strong>2,598,960</strong> possible 5-card hands in a standard 52-card deck.
                        This is calculated as "52 choose 5" = 52! / (5! × 47!) = 2,598,960.
                      </p>
                      <p>
                        Each hand is ranked based on its category (Royal Flush being the best, High Card being the worst)
                        and then by the specific cards within that category. This evaluator correctly ranks all hands
                        using exact mathematics, not Monte Carlo simulation.
                      </p>
                      <p>
                        The percentile shows what percentage of all possible hands your hand beats.
                        A Royal Flush beats 99.9998% of hands, while the worst High Card beats 0.00004% of hands.
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="kickers">
                    <AccordionTrigger>Understanding Kickers</AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      <p>
                        When two hands have the same category (e.g., both are One Pair), the winner is determined by:
                      </p>
                      <ol className="list-decimal list-inside space-y-2 ml-4">
                        <li>The rank of the primary cards (e.g., pair of Aces beats pair of Kings)</li>
                        <li>The "kickers" - the remaining cards that don't form the hand</li>
                      </ol>
                      <p>
                        For example, Ah Ac Kh Qs 2d beats Ah Ac Kh Jd 3c because the Queen kicker beats the Jack.
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="notation">
                    <AccordionTrigger>Card Notation</AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      <p>
                        This evaluator uses standard poker notation:
                      </p>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div>
                          <p className="font-semibold mb-2">Ranks:</p>
                          <ul className="text-sm space-y-1">
                            <li><code>A</code> - Ace (highest)</li>
                            <li><code>K</code> - King</li>
                            <li><code>Q</code> - Queen</li>
                            <li><code>J</code> - Jack</li>
                            <li><code>T</code> - Ten</li>
                            <li><code>9-2</code> - Number cards</li>
                          </ul>
                        </div>
                        <div>
                          <p className="font-semibold mb-2">Suits:</p>
                          <ul className="text-sm space-y-1">
                            <li><code>s</code> - Spades ♠</li>
                            <li><code>h</code> - Hearts ♥</li>
                            <li><code>d</code> - Diamonds ♦</li>
                            <li><code>c</code> - Clubs ♣</li>
                          </ul>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </UICard>
          </TabsContent>
        </Tabs>
      </main>
      
      <footer className="border-t mt-12">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>
            Poker Hand Evaluator - Exact mathematical evaluation of all 2,598,960 5-card poker hands
          </p>
        </div>
      </footer>
    </div>
  );
}
