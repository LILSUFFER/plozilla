import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import AuthPage from "@/pages/AuthPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import AppPage from "@/pages/AppPage";
import TableEvPage from "@/pages/TableEvPage";
import RankingsPage from "@/pages/RankingsPage";
import LearnPage from "@/pages/LearnPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/app" component={AppPage} />
      <Route path="/app/table-ev" component={TableEvPage} />
      <Route path="/app/rankings" component={RankingsPage} />
      <Route path="/app/learn" component={LearnPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;
