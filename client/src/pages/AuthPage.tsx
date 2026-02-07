import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { SiGoogle, SiTelegram } from "react-icons/si";
import { Mail, Lock, User, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

type AuthTab = "login" | "signup";

export default function AuthPage() {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const [tab, setTab] = useState<AuthTab>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResend, setShowResend] = useState(false);

  if (!authLoading && isAuthenticated) {
    navigate("/app");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (showForgotPassword) {
      setIsLoading(true);
      try {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        setSuccess(data.message || t("authResetSent"));
      } catch {
        setError("Server error.");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (tab === "signup") {
      if (password.length < 8) {
        setError(t("authPasswordMin"));
        return;
      }
      if (password !== confirmPassword) {
        setError(t("authPasswordMismatch"));
        return;
      }
    }

    setIsLoading(true);
    try {
      const endpoint = tab === "login" ? "/api/auth/login" : "/api/auth/signup";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(tab === "signup" ? { email, password, name: name.trim() || undefined } : { email, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        if (data.code === "EMAIL_NOT_VERIFIED") {
          setError(t("authEmailNotVerified"));
          setShowResend(true);
        } else {
          setError(data.error || "An error occurred.");
        }
        return;
      }

      if (tab === "signup") {
        setSuccess(t("authSignupSuccess"));
        setTab("login");
        setPassword("");
        setConfirmPassword("");
      } else {
        window.location.href = "/app";
      }
    } catch {
      setError("Server error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setSuccess(data.message || "Verification email sent.");
      setShowResend(false);
    } catch {
      setError("Failed to resend.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3">
            <img src="/godzilla-logo.png" alt="Plozilla" className="w-10 h-10 rounded-lg" />
            <h1 className="text-xl font-bold">Plozilla</h1>
          </a>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild data-testid="button-telegram">
              <a href="https://t.me/plozilla_chat" target="_blank" rel="noopener noreferrer">
                <SiTelegram className="w-4 h-4" />
              </a>
            </Button>
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl" data-testid="text-auth-title">{t("authTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-2">
              <Button variant="outline" asChild data-testid="button-auth-google" className="w-full">
                <a href="/api/auth/google" className="flex items-center justify-center gap-2">
                  <SiGoogle className="w-4 h-4" />
                  {t("authGoogle")}
                </a>
              </Button>
              <Button variant="outline" asChild data-testid="button-auth-yandex" className="w-full">
                <a href="/api/auth/yandex/start" className="flex items-center justify-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                    <path d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12zm7.01-5.9c-1.8 0-3.2 1.24-3.2 3.6 0 1.64.72 2.72 2.2 4.08l-2.48 4.22h2.2l2.16-3.92.36.28v3.64h1.8V6.1H10.3c0 .01-.06 0-.14 0h-1.14zm.64 1.5h.4v4.24l-.68-.52c-1.12-.88-1.64-1.68-1.64-3.04 0-1.48.68-2.68 1.92-2.68z" />
                  </svg>
                  {t("authYandex")}
                </a>
              </Button>
              <Button variant="outline" asChild data-testid="button-auth-replit" className="w-full">
                <a href="/api/login" className="flex items-center justify-center gap-2">
                  <img src="https://replit.com/public/images/sm-logo.svg" alt="Replit" className="w-4 h-4" />
                  {t("authReplit")}
                </a>
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">{t("authOrDivider")}</span>
              </div>
            </div>

            {!showForgotPassword && (
              <div className="flex border rounded-md overflow-hidden">
                <button
                  type="button"
                  data-testid="tab-login"
                  onClick={() => { setTab("login"); setError(""); setSuccess(""); }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === "login" ? "bg-primary text-primary-foreground" : "hover-elevate"}`}
                >
                  {t("authLogin")}
                </button>
                <button
                  type="button"
                  data-testid="tab-signup"
                  onClick={() => { setTab("signup"); setError(""); setSuccess(""); }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === "signup" ? "bg-primary text-primary-foreground" : "hover-elevate"}`}
                >
                  {t("authSignup")}
                </button>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3" data-testid="text-auth-error">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-start gap-2 text-sm text-green-600 dark:text-green-400 bg-green-500/10 rounded-md p-3" data-testid="text-auth-success">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {tab === "signup" && !showForgotPassword && (
                <div className="space-y-2">
                  <Label htmlFor="name">{t("authName")}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="name"
                      data-testid="input-auth-name"
                      type="text"
                      placeholder={t("authNamePlaceholder")}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">{t("authEmail")}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    data-testid="input-auth-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {!showForgotPassword && (
                <div className="space-y-2">
                  <Label htmlFor="password">{t("authPassword")}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      data-testid="input-auth-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                      minLength={tab === "signup" ? 8 : undefined}
                    />
                  </div>
                </div>
              )}

              {tab === "signup" && !showForgotPassword && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t("authConfirmPassword")}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      data-testid="input-auth-confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      required
                      minLength={8}
                    />
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-auth-submit">
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {showForgotPassword
                  ? t("authResetButton")
                  : tab === "login"
                    ? t("authLoginButton")
                    : t("authSignupButton")}
              </Button>
            </form>

            {showResend && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleResendVerification}
                disabled={isLoading}
                data-testid="button-resend-verification"
              >
                {t("authResendVerification")}
              </Button>
            )}

            <div className="text-center text-sm text-muted-foreground">
              {showForgotPassword ? (
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => { setShowForgotPassword(false); setError(""); setSuccess(""); }}
                  data-testid="link-back-to-login"
                >
                  {t("authBackToLogin")}
                </button>
              ) : tab === "login" ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    className="text-primary hover:underline block mx-auto"
                    onClick={() => { setShowForgotPassword(true); setError(""); setSuccess(""); }}
                    data-testid="link-forgot-password"
                  >
                    {t("authForgotPassword")}
                  </button>
                  <p>
                    {t("authNoAccount")}{" "}
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => { setTab("signup"); setError(""); setSuccess(""); }}
                      data-testid="link-go-signup"
                    >
                      {t("authSignup")}
                    </button>
                  </p>
                </div>
              ) : (
                <p>
                  {t("authHaveAccount")}{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => { setTab("login"); setError(""); setSuccess(""); }}
                    data-testid="link-go-login"
                  >
                    {t("authLogin")}
                  </button>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
