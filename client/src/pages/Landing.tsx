import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Calculator, Zap, Target, TrendingUp, ChevronRight } from "lucide-react";
import { SiGoogle, SiTelegram } from "react-icons/si";
import { useTranslation } from "@/lib/i18n";

export default function Landing() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img 
              src="/godzilla-logo.png" 
              alt="Plozilla Logo" 
              className="w-10 h-10 rounded-lg"
            />
            <div>
              <h1 className="text-xl font-bold">Plozilla</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">{t('subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild data-testid="button-telegram">
              <a href="https://t.me/plozilla_chat" target="_blank" rel="noopener noreferrer">
                <SiTelegram className="w-4 h-4" />
              </a>
            </Button>
            <LanguageToggle />
            <ThemeToggle />
            <Button asChild data-testid="button-app">
              <a href="/api/auth/google">
                {t('appButton')}
                <ChevronRight className="w-4 h-4 ml-1" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="py-20 lg:py-32">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <h2 className="text-4xl lg:text-5xl font-serif font-bold leading-tight">
                  {t('heroTitle1')}
                  <span className="text-primary block">{t('heroTitle2')}</span>
                </h2>
                <p className="text-lg text-muted-foreground max-w-lg">
                  {t('heroDesc')}
                </p>
                <div className="flex flex-wrap gap-4">
                  <Button size="lg" asChild data-testid="button-google-signin">
                    <a href="/api/auth/google">
                      <SiGoogle className="w-4 h-4 mr-2" />
                      {t('signInGoogle')}
                    </a>
                  </Button>
                  <Button size="lg" variant="outline" asChild data-testid="button-replit-signin">
                    <a href="/api/login">
                      <img src="https://replit.com/public/images/sm-logo.svg" alt="Replit" className="w-4 h-4 mr-2" />
                      {t('signInReplit')}
                    </a>
                  </Button>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-2">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    {t('freePlan')}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    {t('noCreditCard')}
                  </span>
                </div>
              </div>
              <div className="relative">
                <div className="relative bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl p-8 ring-1 ring-black/5 dark:ring-white/10">
                  <img 
                    src="/godzilla-logo.png" 
                    alt="Plozilla Hero" 
                    className="w-48 h-48 mx-auto opacity-90 hover:scale-105 transition-transform duration-300"
                  />
                  <div className="text-center mt-6">
                    <p className="text-2xl font-bold">850,668</p>
                    <p className="text-muted-foreground">{t('preflopRunouts')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <h3 className="text-2xl font-bold text-center mb-12">{t('whyChoose')}</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="hover-elevate">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Calculator className="w-6 h-6 text-primary" />
                  </div>
                  <h4 className="font-semibold text-lg mb-2">{t('exhaustiveCalc')}</h4>
                  <p className="text-muted-foreground text-sm">{t('exhaustiveCalcDesc')}</p>
                </CardContent>
              </Card>
              
              <Card className="hover-elevate">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Zap className="w-6 h-6 text-primary" />
                  </div>
                  <h4 className="font-semibold text-lg mb-2">{t('wasmSpeed')}</h4>
                  <p className="text-muted-foreground text-sm">{t('wasmSpeedDesc')}</p>
                </CardContent>
              </Card>
              
              <Card className="hover-elevate">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Target className="w-6 h-6 text-primary" />
                  </div>
                  <h4 className="font-semibold text-lg mb-2">{t('fullRange')}</h4>
                  <p className="text-muted-foreground text-sm">{t('fullRangeDesc')}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-2xl font-bold mb-4">{t('features')}</h3>
                <ul className="space-y-3">
                  {[
                    t('feature1'),
                    t('feature2'),
                    t('feature3'),
                    t('feature4'),
                    t('feature5'),
                    t('feature6'),
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <TrendingUp className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-muted/50 rounded-xl p-6">
                <p className="font-mono text-sm mb-4">{t('exampleCalc')}</p>
                <div className="space-y-2 font-mono text-sm">
                  <p><span className="text-muted-foreground">{t('board')}:</span> 8cKs6d</p>
                  <p><span className="text-muted-foreground">{t('hero')}:</span> Jd7d5d4s2h</p>
                  <p><span className="text-muted-foreground">{t('villain')}:</span> AhKhKcQhJs</p>
                  <div className="border-t pt-2 mt-4">
                    <p><span className="text-muted-foreground">{t('result')}:</span> 561 {t('runouts')}</p>
                    <p className="text-primary font-bold">{t('hero')}: 27.72% | {t('villain')}: 50.98%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>{t('footer')}</p>
        </div>
      </footer>
    </div>
  );
}
