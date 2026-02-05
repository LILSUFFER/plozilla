import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Calculator, Zap, Target, TrendingUp, ChevronRight } from "lucide-react";
import { SiGoogle } from "react-icons/si";

export default function Landing() {
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
              <p className="text-xs text-muted-foreground hidden sm:block">5-Card Omaha Equity Calculator</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button asChild data-testid="button-app">
              <a href="/api/auth/google">
                APP
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
                  Master PLO5 with
                  <span className="text-primary block">Precision Equity</span>
                </h2>
                <p className="text-lg text-muted-foreground max-w-lg">
                  Professional-grade 5-Card Omaha equity calculator. Analyze hands, study ranges, 
                  and make better decisions at the table with exhaustive calculations that match 
                  ProPokerTools Oracle.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Button size="lg" asChild data-testid="button-google-signin">
                    <a href="/api/auth/google">
                      <SiGoogle className="w-4 h-4 mr-2" />
                      Sign in with Google
                    </a>
                  </Button>
                  <Button size="lg" variant="outline" asChild data-testid="button-replit-signin">
                    <a href="/api/login">
                      <img src="https://replit.com/public/images/sm-logo.svg" alt="Replit" className="w-4 h-4 mr-2" />
                      Sign in with Replit
                    </a>
                  </Button>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-2">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    Free forever plan
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    No credit card required
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
                    <p className="text-muted-foreground">Preflop runouts calculated</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <h3 className="text-2xl font-bold text-center mb-12">Why Choose Plozilla?</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="hover-elevate">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Calculator className="w-6 h-6 text-primary" />
                  </div>
                  <h4 className="font-semibold text-lg mb-2">Exhaustive Calculations</h4>
                  <p className="text-muted-foreground text-sm">
                    Every calculation enumerates all possible runouts. No Monte Carlo approximations - 
                    get exact equity values that match ProPokerTools Oracle.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="hover-elevate">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Zap className="w-6 h-6 text-primary" />
                  </div>
                  <h4 className="font-semibold text-lg mb-2">WebAssembly Speed</h4>
                  <p className="text-muted-foreground text-sm">
                    Powered by a custom WASM evaluator with Two Plus Two lookup tables. 
                    Calculate 850K+ runouts in seconds, all in your browser.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="hover-elevate">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Target className="w-6 h-6 text-primary" />
                  </div>
                  <h4 className="font-semibold text-lg mb-2">Full Range Support</h4>
                  <p className="text-muted-foreground text-sm">
                    Use ProPokerTools Generic Syntax for ranges: AA, KK+, suited connectors, 
                    suit variables, and weighted ranges.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-2xl font-bold mb-4">Features</h3>
                <ul className="space-y-3">
                  {[
                    "5-Card Omaha (PLO5) equity calculations",
                    "Board states: Preflop, Flop, Turn, River",
                    "Up to 8 players with visual card display",
                    "Hand history import with street selection",
                    "Full ProPokerTools range syntax",
                    "Cached preflop calculations for instant results",
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <TrendingUp className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-muted/50 rounded-xl p-6">
                <p className="font-mono text-sm mb-4">Example calculation:</p>
                <div className="space-y-2 font-mono text-sm">
                  <p><span className="text-muted-foreground">Board:</span> 8cKs6d</p>
                  <p><span className="text-muted-foreground">Hero:</span> Jd7d5d4s2h</p>
                  <p><span className="text-muted-foreground">Villain:</span> AhKhKcQhJs</p>
                  <div className="border-t pt-2 mt-4">
                    <p><span className="text-muted-foreground">Result:</span> 561 runouts</p>
                    <p className="text-primary font-bold">Hero: 27.72% | Villain: 50.98%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Plozilla - Professional 5-Card Omaha Equity Calculator</p>
        </div>
      </footer>
    </div>
  );
}
