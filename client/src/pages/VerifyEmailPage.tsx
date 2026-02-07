import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";
import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";

export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const status = params.get("status");

  const icon = status === "success"
    ? <CheckCircle2 className="w-12 h-12 text-green-500" />
    : status === "expired"
      ? <Clock className="w-12 h-12 text-yellow-500" />
      : status === "invalid" || status === "error"
        ? <XCircle className="w-12 h-12 text-destructive" />
        : <Loader2 className="w-12 h-12 animate-spin text-muted-foreground" />;

  const message = status === "success"
    ? t("authVerifySuccess")
    : status === "expired"
      ? t("authVerifyExpired")
      : status === "invalid"
        ? t("authVerifyInvalid")
        : status === "error"
          ? t("authVerifyError")
          : t("authVerifying");

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle data-testid="text-verify-title">{t("authVerifyEmail")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6 text-center">
          {icon}
          <p className="text-muted-foreground" data-testid="text-verify-message">{message}</p>
          {status === "success" && (
            <Button onClick={() => navigate("/app")} data-testid="button-go-to-app">
              {t("authGoToApp")}
            </Button>
          )}
          {(status === "expired" || status === "invalid" || status === "error") && (
            <Button variant="outline" onClick={() => navigate("/auth")} data-testid="button-back-to-auth">
              {t("authBackToLogin")}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
