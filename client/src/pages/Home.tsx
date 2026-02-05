import { useState } from 'react';
import { type Card, evaluateHand, generateRandomHand, parseHand, handToString } from '@/lib/poker-evaluator';
import { HandDisplay } from '@/components/HandDisplay';
import { HandComparison } from '@/components/HandComparison';
import { InlineCardPicker } from '@/components/CardPicker';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PlayingCard } from '@/components/PlayingCard';
import { EquityCalculator } from '@/components/EquityCalculator';
import { Card as UICard, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Shuffle, X, Calculator, Swords, BookOpen, Spade, TrendingUp } from 'lucide-react';

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
              <h1 className="text-xl font-bold">Poker Tools</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Equity Calculator & Hand Evaluator</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6 space-y-6">
        <Tabs defaultValue="equity" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-lg mx-auto">
            <TabsTrigger value="equity" className="flex items-center gap-2" data-testid="tab-equity">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Equity</span>
            </TabsTrigger>
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
          
          <TabsContent value="equity" className="space-y-6">
            <EquityCalculator />
          </TabsContent>
          
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
                  Poker Hand Rankings & Omaha Rules
                </CardTitle>
                <CardDescription>
                  Understanding poker mathematics and 5-card Omaha
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="omaha">
                    <AccordionTrigger>5-Card Omaha Rules</AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      <p>
                        In 5-card Omaha, each player receives <strong>5 hole cards</strong> and must use 
                        <strong> exactly 2</strong> of them combined with <strong>exactly 3</strong> of the 
                        5 community board cards to make the best 5-card poker hand.
                      </p>
                      <p>
                        This is different from Texas Hold'em where you can use any combination of your 
                        hole cards and board cards.
                      </p>
                      <div className="bg-muted/50 p-3 rounded-md">
                        <p className="font-semibold mb-2">Example:</p>
                        <p className="text-sm">
                          If you have <code className="bg-background px-1 rounded">AhKhQhJhTh</code> (all hearts), 
                          you cannot make a flush unless 3 hearts appear on the board, because you must use 
                          exactly 2 hole cards and 3 board cards.
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="rankings">
                    <AccordionTrigger>Hand Rankings (Best to Worst)</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3">
                        {[
                          { name: 'Royal Flush', count: 4, desc: 'A, K, Q, J, 10 all of the same suit', example: 'AhKhQhJhTh' },
                          { name: 'Straight Flush', count: 36, desc: 'Five cards in sequence, all of the same suit', example: '9h8h7h6h5h' },
                          { name: 'Four of a Kind', count: 624, desc: 'Four cards of the same rank', example: 'AhAcAdAsKh' },
                          { name: 'Full House', count: 3744, desc: 'Three of a kind plus a pair', example: 'AhAcAdKhKs' },
                          { name: 'Flush', count: 5108, desc: 'Five cards of the same suit (not in sequence)', example: 'AhJh8h5h2h' },
                          { name: 'Straight', count: 10200, desc: 'Five cards in sequence (not same suit)', example: 'AhKdQcJsTh' },
                          { name: 'Three of a Kind', count: 54912, desc: 'Three cards of the same rank', example: 'AhAcAdKhQs' },
                          { name: 'Two Pair', count: 123552, desc: 'Two different pairs', example: 'AhAcKhKsQd' },
                          { name: 'One Pair', count: 1098240, desc: 'Two cards of the same rank', example: 'AhAcKhQsJd' },
                          { name: 'High Card', count: 1302540, desc: 'No matching cards', example: 'AhKdQcJs9h' },
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
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="equity">
                    <AccordionTrigger>Understanding Equity</AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      <p>
                        <strong>Equity</strong> represents your expected share of the pot based on 
                        your probability of winning. It's calculated by simulating all possible 
                        remaining board cards and determining how often each player wins.
                      </p>
                      <p>
                        For example, if you have 60% equity, you expect to win 60% of the pot on average.
                      </p>
                      <div className="bg-muted/50 p-3 rounded-md">
                        <p className="font-semibold mb-2">Calculation Method:</p>
                        <ul className="text-sm space-y-1 list-disc list-inside">
                          <li>Enumerate all possible remaining board cards</li>
                          <li>For each complete board, evaluate each player's best hand</li>
                          <li>Count wins, ties, and losses for each player</li>
                          <li>Equity = (Wins + Ties/2) / Total Trials × 100%</li>
                        </ul>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="notation">
                    <AccordionTrigger>Card Notation</AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      <p>
                        This tool uses standard poker notation in concatenated format:
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
                      <div className="bg-muted/50 p-3 rounded-md mt-4">
                        <p className="font-semibold mb-2">Examples:</p>
                        <ul className="text-sm space-y-1">
                          <li><code>6sKh7hKdAc</code> = 6♠ K♥ 7♥ K♦ A♣</li>
                          <li><code>Th5d7c</code> = 10♥ 5♦ 7♣ (board)</li>
                        </ul>
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
            Poker Tools - 5-Card Omaha Equity Calculator & Hand Evaluator
          </p>
        </div>
      </footer>
    </div>
  );
}
