import { useEffect } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TrendingUp, DollarSign, BookOpen, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Link, useLocation } from 'wouter';

export default function LearnPage() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Please log in",
        description: "Redirecting to login...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isLoading, isAuthenticated, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const userInitials = user?.firstName && user?.lastName 
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : user?.email?.[0]?.toUpperCase() || 'U';

  const navItems = [
    { path: '/app', label: 'Equity', icon: TrendingUp },
    { path: '/app/table-ev', label: 'Table EV', icon: DollarSign },
    { path: '/app/learn', label: 'Learn', icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3">
            <img 
              src="/godzilla-logo.png" 
              alt="Plozilla Logo" 
              className="w-10 h-10 rounded-lg"
            />
            <div>
              <h1 className="text-xl font-bold">Plozilla</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">5-Card Omaha Equity Calculator</p>
            </div>
          </a>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || 'User'} />
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
              <Button variant="ghost" size="icon" onClick={() => logout()} data-testid="button-logout">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6 flex-1 space-y-6">
        <Card>
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
                        <li><code>s</code> - Spades</li>
                        <li><code>h</code> - Hearts</li>
                        <li><code>d</code> - Diamonds</li>
                        <li><code>c</code> - Clubs</li>
                      </ul>
                    </div>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-md mt-4">
                    <p className="font-semibold mb-2">Examples:</p>
                    <ul className="text-sm space-y-1">
                      <li><code>6sKh7hKdAc</code> = 6 spades, K hearts, 7 hearts, K diamonds, A clubs</li>
                      <li><code>Th5d7c</code> = 10 hearts, 5 diamonds, 7 clubs (board)</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </main>
      
      <footer className="border-t bg-card sticky bottom-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex justify-center gap-2">
            {navItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <Button 
                  variant={location === item.path ? 'default' : 'ghost'}
                  className="flex items-center gap-2"
                  data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Button>
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
