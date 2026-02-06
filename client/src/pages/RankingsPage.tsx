import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useQuery } from '@tanstack/react-query';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TrendingUp, DollarSign, BookOpen, LogOut, Loader2, Trophy, Info, Search, X, AlertTriangle, Copy, Check } from 'lucide-react';
import { SiTelegram } from 'react-icons/si';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/lib/i18n';
import { Link, useLocation } from 'wouter';
import { CardChips } from '@/components/CardChip';

const ROW_HEIGHT = 40;
const PAGE_SIZE = 200;
const RANKS_DECODE = '23456789TJQKA';
const SUITS_DECODE = 'cdhs';

function cardIndexToCard(idx: number) {
  return {
    rank: RANKS_DECODE[idx >> 2] as any,
    suit: SUITS_DECODE[idx & 3] as any,
  };
}

function cardIndicesToNotation(cards: number[]): string {
  const sorted = [...cards].sort((a, b) => (b >> 2) - (a >> 2));
  return sorted.map(c => RANKS_DECODE[c >> 2] + SUITS_DECODE[c & 3]).join('');
}

interface ApiHand {
  rank: number;
  cards: number[];
  equity: number;
  comboCount: number;
}

interface ApiResponse {
  hands: ApiHand[];
  total: number;
  totalHands: number;
  totalCombos: number;
  ready: boolean;
  error?: string;
}

export default function RankingsPage() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [location] = useLocation();
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setActiveSearch(value);
    }, 400);
  }, []);

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
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              {t('rankingsTitle')}
            </h2>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground gap-1" data-testid="button-rankings-info">
                  <Info className="w-4 h-4" />
                  {t('rankingsInfoButton')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t('rankingsInfoTitle')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 text-sm text-muted-foreground">
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">{t('rankingsInfoMethodTitle')}</h4>
                    <p>{t('rankingsInfoMethod')}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">{t('rankingsInfoCRNTitle')}</h4>
                    <p>{t('rankingsInfoCRN')}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">{t('rankingsInfoCanonTitle')}</h4>
                    <p>{t('rankingsInfoCanon')}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">{t('rankingsInfoColumnsTitle')}</h4>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>{t('rankingsInfoColumnRank')}</li>
                      <li>{t('rankingsInfoColumnHand')}</li>
                      <li>{t('rankingsInfoColumnCombos')}</li>
                      <li>{t('rankingsInfoColumnEQ')}</li>
                      <li>{t('rankingsInfoColumnRankPct')}</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">{t('rankingsInfoSearchTitle')}</h4>
                    <p>{t('rankingsInfoSearch')}</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {t('rankingsDesc')}
          </p>
        </div>

        <div className="mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
            <Input
              value={searchInput}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder={t('rankingsSearchPlaceholder')}
              className="pl-9 pr-9"
              data-testid="input-search-rankings"
            />
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
              onClick={() => { setSearchInput(''); setActiveSearch(''); }}
              style={{ visibility: searchInput ? 'visible' : 'hidden' }}
              data-testid="button-clear-search"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <RankingsTable search={activeSearch} t={t} />
    </div>
  );
}

function RankingsTable({ search, t }: { search: string; t: (key: any) => string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageCacheRef = useRef<Map<string, ApiHand[]>>(new Map());
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set());
  const fetchingRef = useRef<Set<number>>(new Set());
  const prevSearchRef = useRef(search);
  const [filteredCount, setFilteredCount] = useState(0);
  const [globalTotal, setGlobalTotal] = useState(0);
  const [ready, setReady] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedRank, setCopiedRank] = useState<number | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleCopy = useCallback((hand: ApiHand) => {
    const notation = cardIndicesToNotation(hand.cards);
    navigator.clipboard.writeText(notation);
    setCopiedRank(hand.rank);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopiedRank(null), 1500);
  }, []);

  const { data: initialData, isLoading: initialLoading } = useQuery<ApiResponse>({
    queryKey: ['/api/rankings', 'initial', search],
    queryFn: async () => {
      const params = new URLSearchParams({ offset: '0', limit: String(PAGE_SIZE) });
      if (search.trim()) params.set('search', search);
      const res = await fetch(`/api/rankings?${params}`);
      return res.json();
    },
  });

  useEffect(() => {
    if (initialData) {
      setReady(initialData.ready);
      setFilteredCount(initialData.total);
      setGlobalTotal(initialData.totalHands);
      if (initialData.error) {
        setErrorMsg(initialData.error);
      } else {
        setErrorMsg(null);
      }
      if (prevSearchRef.current !== search) {
        pageCacheRef.current.clear();
        fetchingRef.current.clear();
        setLoadedPages(new Set());
        prevSearchRef.current = search;
      }
      if (initialData.ready && initialData.hands.length > 0) {
        const cacheKey = `${search}:0`;
        pageCacheRef.current.set(cacheKey, initialData.hands);
        setLoadedPages(prev => new Set(prev).add(0));
      }
    }
  }, [initialData, search]);

  const virtualizer = useVirtualizer({
    count: filteredCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 30,
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    virtualizer.scrollToOffset(0);
  }, [search]);

  const visibleItems = virtualizer.getVirtualItems();

  useEffect(() => {
    if (!ready || filteredCount === 0) return;

    const neededPages = new Set<number>();
    for (const item of visibleItems) {
      const page = Math.floor(item.index / PAGE_SIZE);
      const cacheKey = `${search}:${page}`;
      if (!pageCacheRef.current.has(cacheKey) && !fetchingRef.current.has(page)) {
        neededPages.add(page);
      }
    }

    neededPages.forEach((page) => {
      fetchingRef.current.add(page);
      const params = new URLSearchParams({
        offset: String(page * PAGE_SIZE),
        limit: String(PAGE_SIZE),
      });
      if (search.trim()) params.set('search', search);

      fetch(`/api/rankings?${params}`)
        .then(res => res.json())
        .then((data: ApiResponse) => {
          const cacheKey = `${search}:${page}`;
          pageCacheRef.current.set(cacheKey, data.hands);
          fetchingRef.current.delete(page);
          setLoadedPages(prev => new Set(prev).add(page));
        })
        .catch(() => {
          fetchingRef.current.delete(page);
        });
    });
  }, [visibleItems, ready, search, filteredCount]);

  if (ready === false) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4" data-testid="rankings-not-ready">
        <AlertTriangle className="w-8 h-8 text-destructive" />
        <p className="text-foreground font-medium" data-testid="text-rankings-error">
          {t('rankingsDbNotFound')}
        </p>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          {t('rankingsDbNotFoundDesc')}
        </p>
      </div>
    );
  }

  if (initialLoading || ready === null) {
    return (
      <div className="flex-1 flex items-center justify-center" data-testid="rankings-loading">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (filteredCount === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        {t('rankingsNoResults')}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 container mx-auto px-4 pb-4 flex flex-col">
      <div className="flex items-center gap-2 mb-2 text-sm flex-wrap">
        {search.trim() && (
          <>
            <Badge variant="secondary" data-testid="badge-search-label">{search.toUpperCase()}</Badge>
            <span className="text-muted-foreground" data-testid="text-search-count">
              {t('rankingsFound')}: <span className="font-semibold text-foreground">{filteredCount.toLocaleString()}</span>
            </span>
          </>
        )}
        {!search.trim() && (
          <span className="text-muted-foreground">
            {t('rankingsCanonicalTotal').replace('{n}', globalTotal.toLocaleString())}
          </span>
        )}
      </div>

      <div className="border rounded-md flex flex-col flex-1 min-h-0">
        <div className="grid grid-cols-[3.5rem_1fr_2rem_3.5rem_3.5rem_3.5rem] text-xs font-medium text-muted-foreground border-b bg-muted/30 shrink-0">
          <div className="px-2 py-2 text-center">{t('rankingsRank')}</div>
          <div className="px-2 py-2">{t('rankingsHand')}</div>
          <div className="py-2" />
          <div className="px-2 py-2 text-center">{t('rankingsCombos')}</div>
          <div className="px-2 py-2 text-center">{t('rankingsEquity')}</div>
          <div className="px-2 py-2 text-right">{t('rankingsPercentile')}</div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-auto min-h-0" data-testid="rankings-scroll-container">
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {visibleItems.map((virtualRow) => {
              const page = Math.floor(virtualRow.index / PAGE_SIZE);
              const cacheKey = `${search}:${page}`;
              const pageData = pageCacheRef.current.get(cacheKey);
              const hand = pageData?.[virtualRow.index % PAGE_SIZE];

              return (
                <div
                  key={virtualRow.key}
                  className="grid grid-cols-[3.5rem_1fr_2rem_3.5rem_3.5rem_3.5rem] items-center border-b last:border-b-0 text-sm"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  data-testid={hand ? `ranking-row-${hand.rank}` : undefined}
                >
                  {hand ? (
                    <>
                      <div className="px-2 text-center font-mono text-muted-foreground text-xs">
                        {hand.rank.toLocaleString()}
                      </div>
                      <div className="px-2">
                        <CardChips cards={hand.cards.map(cardIndexToCard)} size="sm" />
                      </div>
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => handleCopy(hand)}
                          className="p-0.5 rounded hover-elevate text-muted-foreground"
                          title={cardIndicesToNotation(hand.cards)}
                          data-testid={`button-copy-hand-${hand.rank}`}
                        >
                          {copiedRank === hand.rank ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <div className="px-2 text-center font-mono text-xs text-muted-foreground" data-testid={`combos-${hand.rank}`}>
                        {hand.comboCount}
                      </div>
                      <div className="px-2 text-center font-mono text-xs" data-testid={`equity-${hand.rank}`}>
                        {(hand.equity * 100).toFixed(2)}%
                      </div>
                      <div className="px-2 text-right font-mono text-xs">
                        {((hand.rank / globalTotal) * 100).toFixed(2)}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="px-2 text-center">
                        <div className="h-3 w-8 bg-muted rounded animate-pulse mx-auto" />
                      </div>
                      <div className="px-2">
                        <div className="h-5 w-32 bg-muted rounded animate-pulse" />
                      </div>
                      <div />
                      <div className="px-2 text-center">
                        <div className="h-3 w-6 bg-muted rounded animate-pulse mx-auto" />
                      </div>
                      <div className="px-2 text-center">
                        <div className="h-3 w-8 bg-muted rounded animate-pulse mx-auto" />
                      </div>
                      <div className="px-2 text-right">
                        <div className="h-3 w-10 bg-muted rounded animate-pulse ml-auto" />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
