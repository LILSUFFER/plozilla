import { useEffect, useState, useMemo } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, DollarSign, BookOpen, LogOut, Loader2, Trophy, Info, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { SiTelegram } from 'react-icons/si';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/lib/i18n';
import { Link, useLocation } from 'wouter';
import { CardChips } from '@/components/CardChip';
import { generateRankedHands, type RankedHand } from '@/lib/hand-rankings';

export default function RankingsPage() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [location] = useLocation();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(100);
  const [ready, setReady] = useState(false);

  const hands = useMemo(() => {
    const result = generateRankedHands();
    setReady(true);
    return result;
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

  const totalHands = hands.length;
  const totalPages = Math.ceil(totalHands / perPage);
  const startIdx = (page - 1) * perPage;
  const endIdx = Math.min(startIdx + perPage, totalHands);
  const pageHands = hands.slice(startIdx, endIdx);

  const handlePerPageChange = (value: string) => {
    setPerPage(Number(value));
    setPage(1);
  };

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
      
      <main className="container mx-auto px-4 py-6 flex-1">
        <div className="mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            {t('rankingsTitle')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{t('rankingsDesc')}</p>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 text-sm text-muted-foreground mb-4">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{t('rankingsNote')}</span>
        </div>

        {!ready ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
            <span className="text-muted-foreground">{t('rankingsGenerating')}</span>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
              <div className="text-sm text-muted-foreground">
                {t('rankingsTotal')}: <span className="font-semibold text-foreground">{totalHands.toLocaleString()}</span>
                {' · '}
                {t('rankingsShowing')} <span className="font-semibold text-foreground">{startIdx + 1}-{endIdx}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t('rankingsPerPage')}:</span>
                <Select value={String(perPage)} onValueChange={handlePerPageChange}>
                  <SelectTrigger className="w-20" data-testid="select-per-page">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20 text-center">{t('rankingsRank')}</TableHead>
                    <TableHead>{t('rankingsHand')}</TableHead>
                    <TableHead className="w-16 text-center">{t('rankingsType')}</TableHead>
                    <TableHead className="w-20 text-center">{t('rankingsCombos')}</TableHead>
                    <TableHead className="w-20 text-right">{t('rankingsPercentile')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageHands.map((hand, idx) => {
                    const rank = startIdx + idx + 1;
                    const percentile = ((rank / totalHands) * 100).toFixed(1);
                    return (
                      <TableRow key={rank} data-testid={`ranking-row-${rank}`}>
                        <TableCell className="text-center font-mono text-muted-foreground">
                          {rank}
                        </TableCell>
                        <TableCell>
                          <CardChips cards={hand.cards} size="sm" />
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant={hand.suitType === 'ds' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {hand.suitType === 'ds' ? t('rankingsDS') : t('rankingsSS')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {hand.combos}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {percentile}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between gap-4 mt-4 flex-wrap">
              <div className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(1)}
                  disabled={page <= 1}
                  data-testid="button-first-page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  data-testid="button-next-page"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                  data-testid="button-last-page"
                >
                  <ChevronsRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
