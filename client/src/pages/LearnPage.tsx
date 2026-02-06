import { useEffect } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TrendingUp, DollarSign, BookOpen, LogOut, Loader2, Trophy } from 'lucide-react';
import { SiTelegram } from 'react-icons/si';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/lib/i18n';
import { Link, useLocation } from 'wouter';

export default function LearnPage() {
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
    { name: t('royalFlush'), count: 4, desc: t('royalFlushDesc'), example: 'AhKhQhJhTh' },
    { name: t('straightFlush'), count: 36, desc: t('straightFlushDesc'), example: '9h8h7h6h5h' },
    { name: t('fourOfKind'), count: 624, desc: t('fourOfKindDesc'), example: 'AhAcAdAsKh' },
    { name: t('fullHouse'), count: 3744, desc: t('fullHouseDesc'), example: 'AhAcAdKhKs' },
    { name: t('flush'), count: 5108, desc: t('flushDesc'), example: 'AhJh8h5h2h' },
    { name: t('straight'), count: 10200, desc: t('straightDesc'), example: 'AhKdQcJsTh' },
    { name: t('threeOfKind'), count: 54912, desc: t('threeOfKindDesc'), example: 'AhAcAdKhQs' },
    { name: t('twoPair'), count: 123552, desc: t('twoPairDesc'), example: 'AhAcKhKsQd' },
    { name: t('onePair'), count: 1098240, desc: t('onePairDesc'), example: 'AhAcKhQsJd' },
    { name: t('highCard'), count: 1302540, desc: t('highCardDesc'), example: 'AhKdQcJs9h' },
  ];

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
      
      <main className="container mx-auto px-4 py-6 flex-1 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              {t('learnTitle')}
            </CardTitle>
            <CardDescription>{t('learnDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="omaha">
                <AccordionTrigger>{t('omahaRules')}</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <p dangerouslySetInnerHTML={{ __html: t('omahaRulesP1') }} />
                  <p>{t('omahaRulesP2')}</p>
                  <div className="bg-muted/50 p-3 rounded-md">
                    <p className="font-semibold mb-2">{t('omahaExample')}</p>
                    <p className="text-sm" dangerouslySetInnerHTML={{ __html: t('omahaExampleText') }} />
                  </div>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="rankings">
                <AccordionTrigger>{t('handRankings')}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    {handRankings.map((hand, i) => (
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
                <AccordionTrigger>{t('understandingEquity')}</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <p dangerouslySetInnerHTML={{ __html: t('equityP1') }} />
                  <p>{t('equityP2')}</p>
                  <div className="bg-muted/50 p-3 rounded-md">
                    <p className="font-semibold mb-2">{t('calcMethod')}</p>
                    <ul className="text-sm space-y-1 list-disc list-inside">
                      <li>{t('calcStep1')}</li>
                      <li>{t('calcStep2')}</li>
                      <li>{t('calcStep3')}</li>
                      <li>{t('calcStep4')}</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="notation">
                <AccordionTrigger>{t('cardNotation')}</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <p>{t('cardNotationDesc')}</p>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <p className="font-semibold mb-2">{t('ranks')}</p>
                      <ul className="text-sm space-y-1">
                        <li><code>A</code> - {t('ace')}</li>
                        <li><code>K</code> - {t('king')}</li>
                        <li><code>Q</code> - {t('queen')}</li>
                        <li><code>J</code> - {t('jack')}</li>
                        <li><code>T</code> - {t('ten')}</li>
                        <li><code>9-2</code> - {t('numberCards')}</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold mb-2">{t('suits')}</p>
                      <ul className="text-sm space-y-1">
                        <li><code>s</code> - {t('spades')}</li>
                        <li><code>h</code> - {t('hearts')}</li>
                        <li><code>d</code> - {t('diamonds')}</li>
                        <li><code>c</code> - {t('clubs')}</li>
                      </ul>
                    </div>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-md mt-4">
                    <p className="font-semibold mb-2">{t('examples')}</p>
                    <ul className="text-sm space-y-1">
                      <li><code>6sKh7hKdAc</code> = {t('cardExample1')}</li>
                      <li><code>Th5d7c</code> = {t('cardExample2')}</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
