import { useEffect } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TrendingUp, DollarSign, BookOpen, LogOut, Loader2, Trophy, Info } from 'lucide-react';
import { SiTelegram } from 'react-icons/si';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/lib/i18n';
import { Link, useLocation } from 'wouter';
import { CardChips } from '@/components/CardChip';
import type { Card as PokerCard } from '@/lib/poker-evaluator';

function parseExample(notation: string): PokerCard[] {
  const cards: PokerCard[] = [];
  let i = 0;
  while (i < notation.length) {
    let rank: string;
    if (notation[i] === '1' && notation[i + 1] === '0') {
      rank = '10';
      i += 2;
    } else {
      rank = notation[i];
      i++;
    }
    const suit = notation[i];
    i++;
    cards.push({ rank: rank as PokerCard['rank'], suit: suit as PokerCard['suit'] });
  }
  return cards;
}

export default function RankingsPage() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [location] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: t('pleaseLogIn'),
        description: t('redirecting'),
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
    { path: '/app', label: t('navEquity'), icon: TrendingUp },
    { path: '/app/table-ev', label: t('navTableEv'), icon: DollarSign },
    { path: '/app/rankings', label: t('navRankings'), icon: Trophy },
    { path: '/app/learn', label: t('navLearn'), icon: BookOpen },
  ];

  const handRankings = [
    { 
      rank: 1, 
      name: t('royalFlush'), 
      desc: t('royalFlushDesc'), 
      example: 'AhKhQhJhTh', 
      combos: 4,
      color: 'from-yellow-500/20 to-amber-500/10 border-yellow-500/30'
    },
    { 
      rank: 2, 
      name: t('straightFlush'), 
      desc: t('straightFlushDesc'), 
      example: '9s8s7s6s5s', 
      combos: 36,
      color: 'from-purple-500/20 to-violet-500/10 border-purple-500/30'
    },
    { 
      rank: 3, 
      name: t('fourOfKind'), 
      desc: t('fourOfKindDesc'), 
      example: 'KhKdKcKsAh', 
      combos: 624,
      color: 'from-red-500/20 to-rose-500/10 border-red-500/30'
    },
    { 
      rank: 4, 
      name: t('fullHouse'), 
      desc: t('fullHouseDesc'), 
      example: 'AhAdAcKhKd', 
      combos: 3744,
      color: 'from-orange-500/20 to-amber-500/10 border-orange-500/30'
    },
    { 
      rank: 5, 
      name: t('flush'), 
      desc: t('flushDesc'), 
      example: 'AhJh8h5h2h', 
      combos: 5108,
      color: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30'
    },
    { 
      rank: 6, 
      name: t('straight'), 
      desc: t('straightDesc'), 
      example: 'AhKdQcJsTd', 
      combos: 10200,
      color: 'from-green-500/20 to-emerald-500/10 border-green-500/30'
    },
    { 
      rank: 7, 
      name: t('threeOfKind'), 
      desc: t('threeOfKindDesc'), 
      example: 'QhQdQcKhJs', 
      combos: 54912,
      color: 'from-teal-500/20 to-cyan-500/10 border-teal-500/30'
    },
    { 
      rank: 8, 
      name: t('twoPair'), 
      desc: t('twoPairDesc'), 
      example: 'AhAdKhKdQc', 
      combos: 123552,
      color: 'from-indigo-500/20 to-blue-500/10 border-indigo-500/30'
    },
    { 
      rank: 9, 
      name: t('onePair'), 
      desc: t('onePairDesc'), 
      example: 'AhAdKhQsJc', 
      combos: 1098240,
      color: 'from-slate-500/20 to-gray-500/10 border-slate-500/30'
    },
    { 
      rank: 10, 
      name: t('highCard'), 
      desc: t('highCardDesc'), 
      example: 'AhKdQc9s7h', 
      combos: 1302540,
      color: 'from-gray-500/20 to-stone-500/10 border-gray-500/30'
    },
  ];

  const totalCombos = 2598960;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3">
            <img 
              src="/godzilla-logo.png" 
              alt="Plozilla Logo" 
              className="w-9 h-9 rounded-lg"
            />
            <h1 className="text-lg font-bold hidden sm:block">Plozilla</h1>
          </a>
          
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <Button 
                  variant={location === item.path ? 'default' : 'ghost'}
                  size="sm"
                  className="flex items-center gap-2"
                  data-testid={`nav-${item.path.split('/').pop()}`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Button>
              </Link>
            ))}
          </nav>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild data-testid="button-telegram">
              <a href="https://t.me/plozilla_chat" target="_blank" rel="noopener noreferrer">
                <SiTelegram className="w-4 h-4" />
              </a>
            </Button>
            <LanguageToggle />
            <ThemeToggle />
            <Avatar className="w-8 h-8">
              <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || t('user')} />
              <AvatarFallback>{userInitials}</AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" onClick={() => logout()} data-testid="button-logout">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6 flex-1">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              {t('rankingsTitle')}
            </CardTitle>
            <CardDescription>{t('rankingsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 text-sm text-muted-foreground mb-4">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{t('rankingsNote')}</span>
            </div>

            {handRankings.map((hand) => (
              <div 
                key={hand.rank}
                className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-md border bg-gradient-to-r ${hand.color}`}
                data-testid={`ranking-${hand.rank}`}
              >
                <div className="flex items-center gap-3 shrink-0">
                  <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                    {hand.rank}
                  </span>
                  <div className="min-w-[140px]">
                    <div className="font-semibold">{hand.name}</div>
                    <div className="text-xs text-muted-foreground">{hand.desc}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-1 justify-between sm:justify-end">
                  <CardChips cards={parseExample(hand.example)} size="md" />
                  <Badge variant="secondary" className="shrink-0 tabular-nums">
                    {hand.combos.toLocaleString()} / {totalCombos.toLocaleString()}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
