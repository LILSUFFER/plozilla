import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import { Lock, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 8) {
      setError(t("authPasswordMin"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("authPasswordMismatch"));
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "An error occurred.");
      } else {
        setSuccess(t("authResetSuccess"));
      }
    } catch {
      setError("Server error.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle data-testid="text-reset-title">{t("authResetPassword")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3" data-testid="text-reset-error">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 text-sm text-green-600 dark:text-green-400 bg-green-500/10 rounded-md p-3" data-testid="text-reset-success">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{success}</span>
              </div>
              <Button className="w-full" onClick={() => navigate("/auth")} data-testid="button-go-to-login">
                {t("authBackToLogin")}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">{t("authNewPassword")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    data-testid="input-reset-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={8}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t("authConfirmPassword")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    data-testid="input-reset-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={8}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-reset-submit">
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t("authResetButton")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
