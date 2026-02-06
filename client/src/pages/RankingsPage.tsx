import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TrendingUp, DollarSign, BookOpen, LogOut, Loader2, Trophy, Info, Search, X } from 'lucide-react';
import { SiTelegram } from 'react-icons/si';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/lib/i18n';
import { Link, useLocation } from 'wouter';
import { CardChips } from '@/components/CardChip';
import { generateRankedHands, type RankedHand } from '@/lib/hand-rankings';
import { parseRankingsSearch, matchesHandGroup } from '@/lib/rankings-search';

const ROW_HEIGHT = 44;

export default function RankingsPage() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [location] = useLocation();
  const [searchInput, setSearchInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const hands = useMemo(() => generateRankedHands(), []);
  const ready = hands.length > 0;

  const parsed = useMemo(() => parseRankingsSearch(searchInput), [searchInput]);
  const isSearchActive = parsed !== null;

  const filteredHands = useMemo((): { hand: RankedHand; originalIndex: number }[] => {
    if (!parsed) return hands.map((hand, i) => ({ hand, originalIndex: i }));
    return hands
      .map((hand, i) => ({ hand, originalIndex: i }))
      .filter(({ hand, originalIndex }) => matchesHandGroup(hand, parsed, hands.length, originalIndex));
  }, [hands, parsed]);

  const totalAll = hands.length;
  const totalFiltered = filteredHands.length;

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, []);

  const searchLabel = useMemo(() => {
    if (!parsed) return '';
    if (parsed.type === 'percent') {
      if (parsed.lo === 0) return t('rankingsTopPercent').replace('{n}', String(parsed.hi));
      return t('rankingsPercentRange').replace('{a}', String(parsed.lo)).replace('{b}', String(parsed.hi));
    }
    return parsed.label;
  }, [parsed, t]);

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

  return (
    <div className="h-screen bg-background flex flex-col">
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
                  <span className="hidden sm:inline">{item.label}</span>
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
      
      <div className="container mx-auto px-4 py-4 shrink-0">
        <div className="mb-3">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            {t('rankingsTitle')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{t('rankingsDesc').replace('{n}', totalAll.toLocaleString())}</p>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 text-sm text-muted-foreground mb-3">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{t('rankingsNote')}</span>
        </div>

        <div className="mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchInput}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder={t('rankingsSearchPlaceholder')}
              className="pl-9 pr-9"
              data-testid="input-search-rankings"
            />
            {searchInput && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => handleSearchChange('')}
                data-testid="button-clear-search"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2 text-sm flex-wrap">
            {isSearchActive && (
              <>
                <Badge variant="secondary" data-testid="badge-search-label">{searchLabel}</Badge>
                <span className="text-muted-foreground" data-testid="text-search-count">
                  {t('rankingsFound')}: <span className="font-semibold text-foreground">{totalFiltered.toLocaleString()}</span>
                </span>
              </>
            )}
            {!isSearchActive && (
              <span className="text-muted-foreground">
                {t('rankingsTotal')}: <span className="font-semibold text-foreground">{totalAll.toLocaleString()}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {!ready ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
          <span className="text-muted-foreground">{t('rankingsGenerating')}</span>
        </div>
      ) : (
        <VirtualTable
          items={filteredHands}
          scrollRef={scrollRef}
          t={t}
        />
      )}
    </div>
  );
}

function VirtualTable({
  items,
  scrollRef,
  t,
}: {
  items: { hand: RankedHand; originalIndex: number }[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  t: (key: any) => string;
}) {
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 30,
  });

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        {t('rankingsNoResults')}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 container mx-auto px-4 pb-4 flex flex-col">
      <div className="border rounded-md flex flex-col flex-1 min-h-0">
        <div className="grid grid-cols-[4rem_1fr_3.5rem_4rem_4rem] text-xs font-medium text-muted-foreground border-b bg-muted/30 shrink-0">
          <div className="px-2 py-2 text-center">{t('rankingsRank')}</div>
          <div className="px-2 py-2">{t('rankingsHand')}</div>
          <div className="px-2 py-2 text-center">{t('rankingsType')}</div>
          <div className="px-2 py-2 text-center">{t('rankingsCombos')}</div>
          <div className="px-2 py-2 text-right">{t('rankingsPercentile')}</div>
        </div>

        <div ref={scrollRef as React.RefObject<HTMLDivElement>} className="flex-1 overflow-auto min-h-0" data-testid="rankings-scroll-container">
          <div
            style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const { hand, originalIndex } = items[virtualRow.index];
              const rank = originalIndex + 1;
              const percentile = hand.percentile.toFixed(1);
              return (
                <div
                  key={virtualRow.key}
                  data-testid={`ranking-row-${rank}`}
                  className="grid grid-cols-[4rem_1fr_3.5rem_4rem_4rem] items-center border-b last:border-b-0 text-sm"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="px-2 text-center font-mono text-muted-foreground text-xs">
                    {rank}
                  </div>
                  <div className="px-2">
                    <CardChips cards={hand.cards} size="sm" />
                  </div>
                  <div className="px-2 text-center">
                    <Badge 
                      variant={hand.suitType === 'ds' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {hand.suitType === 'ds' ? t('rankingsDS') : t('rankingsSS')}
                    </Badge>
                  </div>
                  <div className="px-2 text-center font-mono text-xs">
                    {hand.combos}
                  </div>
                  <div className="px-2 text-right font-mono text-xs">
                    {percentile}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
