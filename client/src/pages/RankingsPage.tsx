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
import {
  generateAllHandsAsync,
  getCachedAllHands,
  getHandCards,
  getHandSuitType,
  type AllHandsRankings,
  type RankingsProgress,
  TOTAL_5CARD_HANDS,
} from '@/lib/hand-rankings';
import { parseRankingsSearch, filterAllHands } from '@/lib/rankings-search';

const ROW_HEIGHT = 40;

export default function RankingsPage() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [location] = useLocation();
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  const [rankings, setRankings] = useState<AllHandsRankings | null>(() => getCachedAllHands());
  const [progress, setProgress] = useState<RankingsProgress | null>(null);
  const ready = rankings !== null;

  useEffect(() => {
    if (rankings) return;
    let cancelled = false;

    generateAllHandsAsync((p) => {
      if (!cancelled) setProgress(p);
    }).then((result) => {
      if (!cancelled) {
        setRankings(result);
        setProgress(null);
      }
    });

    return () => { cancelled = true; };
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  }, []);

  const parsed = useMemo(() => parseRankingsSearch(debouncedSearch), [debouncedSearch]);
  const isSearchActive = parsed !== null;

  const filteredRanks = useMemo((): number[] => {
    if (!rankings) return [];
    return filterAllHands(rankings, parsed);
  }, [rankings, parsed]);

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

  const progressPercent = progress?.current && progress?.total
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

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
          <p className="text-sm text-muted-foreground mt-1">
            {t('rankingsDesc').replace('{n}', TOTAL_5CARD_HANDS.toLocaleString())}
          </p>
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
              disabled={!ready}
            />
            {searchInput && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => { handleSearchChange(''); setDebouncedSearch(''); }}
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
                  {t('rankingsFound')}: <span className="font-semibold text-foreground">{filteredRanks.length.toLocaleString()}</span>
                </span>
              </>
            )}
            {!isSearchActive && ready && (
              <span className="text-muted-foreground">
                {t('rankingsTotal')}: <span className="font-semibold text-foreground">{TOTAL_5CARD_HANDS.toLocaleString()}</span>
                {filteredRanks.length < TOTAL_5CARD_HANDS && (
                  <span className="text-xs ml-2">({t('rankingsShowing')} {filteredRanks.length.toLocaleString()})</span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {!ready ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4" data-testid="rankings-loading">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <div className="text-center">
            <p className="text-muted-foreground font-medium">
              {progress?.stage === 'loading' ? t('rankingsLoadingWasm') : t('rankingsComputing')}
            </p>
            {progress?.stage === 'computing' && progress.current != null && progress.total != null && (
              <div className="mt-3 w-64 mx-auto">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                    data-testid="progress-bar"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1" data-testid="progress-text">
                  {progress.current.toLocaleString()} / {progress.total.toLocaleString()} ({progressPercent}%)
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <VirtualTable
          rankings={rankings}
          filteredRanks={filteredRanks}
          scrollRef={scrollRef}
          t={t}
        />
      )}
    </div>
  );
}

function VirtualTable({
  rankings,
  filteredRanks,
  scrollRef,
  t,
}: {
  rankings: AllHandsRankings;
  filteredRanks: number[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  t: (key: any) => string;
}) {
  const virtualizer = useVirtualizer({
    count: filteredRanks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 30,
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [filteredRanks]);

  if (filteredRanks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        {t('rankingsNoResults')}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 container mx-auto px-4 pb-4 flex flex-col">
      <div className="border rounded-md flex flex-col flex-1 min-h-0">
        <div className="grid grid-cols-[3.5rem_1fr_3.5rem_4rem] text-xs font-medium text-muted-foreground border-b bg-muted/30 shrink-0">
          <div className="px-2 py-2 text-center">{t('rankingsRank')}</div>
          <div className="px-2 py-2">{t('rankingsHand')}</div>
          <div className="px-2 py-2 text-center">{t('rankingsEquity')}</div>
          <div className="px-2 py-2 text-right">{t('rankingsPercentile')}</div>
        </div>

        <div ref={scrollRef as React.RefObject<HTMLDivElement>} className="flex-1 overflow-auto min-h-0" data-testid="rankings-scroll-container">
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const rank = filteredRanks[virtualRow.index];
              const origIdx = rankings.sortOrder[rank];
              const cards = getHandCards(rankings, origIdx);
              const equity = rankings.equities[origIdx].toFixed(1);
              const percentile = (((rank + 1) / rankings.totalHands) * 100).toFixed(2);
              const displayRank = rank + 1;

              return (
                <div
                  key={virtualRow.key}
                  data-testid={`ranking-row-${displayRank}`}
                  className="grid grid-cols-[3.5rem_1fr_3.5rem_4rem] items-center border-b last:border-b-0 text-sm"
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
                    {displayRank.toLocaleString()}
                  </div>
                  <div className="px-2">
                    <CardChips cards={cards} size="sm" />
                  </div>
                  <div className="px-2 text-center font-mono text-xs" data-testid={`equity-${displayRank}`}>
                    {equity}
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
