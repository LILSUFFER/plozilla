import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendVerificationEmail, sendPasswordResetEmail } from "./email-service";
import rateLimit from "express-rate-limit";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtlMs = 7 * 24 * 60 * 60 * 1000;
  const sessionTtlSec = 7 * 24 * 60 * 60;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtlSec,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: sessionTtlMs,
    },
  });
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

export async function setupCombinedAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { ok: false, error: "Too many requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // === REPLIT AUTH SETUP ===
  const config = await getOidcConfig();

  const replitVerify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const claims = tokens.claims() as Record<string, unknown>;
    const user = await authStorage.upsertUser({
      id: String(claims["sub"] || ""),
      email: claims["email"] ? String(claims["email"]) : null,
      firstName: claims["first_name"] ? String(claims["first_name"]) : null,
      lastName: claims["last_name"] ? String(claims["last_name"]) : null,
      profileImageUrl: claims["profile_image_url"] ? String(claims["profile_image_url"]) : null,
    });
    const sessionUser = { ...user, claims, access_token: tokens.access_token, refresh_token: tokens.refresh_token, expires_at: claims?.exp };
    verified(null, sessionUser);
  };

  const registeredStrategies = new Set<string>();

  const ensureReplitStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        replitVerify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  // === GOOGLE AUTH SETUP ===
  const googleCallbackURL = process.env.GOOGLE_CALLBACK_URL || (
    process.env.NODE_ENV === "production"
      ? "https://plozilla.com/api/auth/google/callback"
      : process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/google/callback`
        : "http://localhost:5000/api/auth/google/callback"
  );

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: googleCallbackURL,
        scope: ["profile", "email"],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          const googleSub = profile.id;

          let user = await authStorage.getUserByGoogleSub(googleSub);
          if (!user && email) {
            user = await authStorage.getUserByEmail(email);
          }

          if (user) {
            if (!user.googleSub) {
              await authStorage.setGoogleSub(user.id, googleSub);
              await authStorage.addAuthProvider(user.id, "google");
            }
            const updated = await authStorage.getUser(user.id);
            done(null, updated!);
          } else {
            const newUser = await authStorage.upsertUser({
              email: email || null,
              firstName: profile.name?.givenName || null,
              lastName: profile.name?.familyName || null,
              profileImageUrl: profile.photos?.[0]?.value || null,
            });
            await authStorage.setGoogleSub(newUser.id, googleSub);
            await authStorage.addAuthProvider(newUser.id, "google");
            if (email) {
              await authStorage.setEmailVerified(newUser.id);
            }
            const finalUser = await authStorage.getUser(newUser.id);
            done(null, finalUser!);
          }
        } catch (error) {
          done(error as Error);
        }
      }
    )
  );

  // === PASSPORT SERIALIZATION ===
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await authStorage.getUser(id);
      done(null, user || null);
    } catch (error) {
      done(error);
    }
  });

  // === REPLIT AUTH ROUTES ===
  app.get("/api/login", (req, res, next) => {
    ensureReplitStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureReplitStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/app",
      failureRedirect: "/",
    })(req, res, next);
  });

  // === GOOGLE AUTH ROUTES ===
  app.get("/api/auth/google", passport.authenticate("google"));

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", {
      failureRedirect: "/auth?error=google_failed",
      successRedirect: "/app",
    })
  );

  // === YANDEX AUTH ROUTES ===
  app.get("/api/auth/yandex/start", (req, res) => {
    const clientId = process.env.YANDEX_CLIENT_ID;
    if (!clientId) {
      return res.redirect("/auth?error=yandex_not_configured");
    }
    const redirectUri = process.env.YANDEX_REDIRECT_URI || (
      process.env.NODE_ENV === "production"
        ? "https://plozilla.com/api/auth/yandex/callback"
        : process.env.REPLIT_DEV_DOMAIN
          ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/yandex/callback`
          : "http://localhost:5000/api/auth/yandex/callback"
    );
    const state = crypto.randomBytes(16).toString("hex");
    (req.session as any).yandexState = state;
    const url = `https://oauth.yandex.ru/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
    res.redirect(url);
  });

  app.get("/api/auth/yandex/callback", async (req, res) => {
    try {
      const { code } = req.query;
      if (!code || typeof code !== "string") {
        return res.redirect("/auth?error=yandex_no_code");
      }

      const clientId = process.env.YANDEX_CLIENT_ID!;
      const clientSecret = process.env.YANDEX_CLIENT_SECRET!;
      const redirectUri = process.env.YANDEX_REDIRECT_URI || (
        process.env.NODE_ENV === "production"
          ? "https://plozilla.com/api/auth/yandex/callback"
          : process.env.REPLIT_DEV_DOMAIN
            ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/yandex/callback`
            : "http://localhost:5000/api/auth/yandex/callback"
      );

      const tokenResponse = await fetch("https://oauth.yandex.ru/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        console.error("Yandex token error:", await tokenResponse.text());
        return res.redirect("/auth?error=yandex_token_failed");
      }

      const tokenData = await tokenResponse.json() as any;
      const accessToken = tokenData.access_token;

      const profileResponse = await fetch("https://login.yandex.ru/info?format=json", {
        headers: { Authorization: `OAuth ${accessToken}` },
      });

      if (!profileResponse.ok) {
        return res.redirect("/auth?error=yandex_profile_failed");
      }

      const profile = await profileResponse.json() as any;
      const yandexSub = String(profile.id);
      const email = profile.default_email?.toLowerCase() || null;
      const firstName = profile.first_name || null;
      const lastName = profile.last_name || null;
      const avatar = profile.default_avatar_id
        ? `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200`
        : null;

      let user = await authStorage.getUserByYandexSub(yandexSub);
      if (!user && email) {
        user = await authStorage.getUserByEmail(email);
      }

      if (user) {
        if (!user.yandexSub) {
          await authStorage.setYandexSub(user.id, yandexSub);
          await authStorage.addAuthProvider(user.id, "yandex");
        }
        user = (await authStorage.getUser(user.id))!;
      } else {
        user = await authStorage.upsertUser({
          email,
          firstName,
          lastName,
          profileImageUrl: avatar,
        });
        await authStorage.setYandexSub(user.id, yandexSub);
        await authStorage.addAuthProvider(user.id, "yandex");
        if (email) {
          await authStorage.setEmailVerified(user.id);
        }
        user = (await authStorage.getUser(user.id))!;
      }

      req.login(user, (err) => {
        if (err) {
          console.error("Yandex login session error:", err);
          return res.redirect("/auth?error=session_failed");
        }
        res.redirect("/app");
      });
    } catch (error) {
      console.error("Yandex auth error:", error);
      res.redirect("/auth?error=yandex_failed");
    }
  });

  // === EMAIL + PASSWORD ROUTES ===
  app.post("/api/auth/signup", authLimiter, async (req, res) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !EMAIL_REGEX.test(email)) {
        return res.status(400).json({ ok: false, error: "Invalid email address." });
      }
      if (!password || password.length < 8) {
        return res.status(400).json({ ok: false, error: "Password must be at least 8 characters." });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existing = await authStorage.getUserByEmail(normalizedEmail);
      if (existing) {
        return res.status(400).json({ ok: false, error: "An account with this email already exists." });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const displayName = typeof name === "string" && name.trim() ? name.trim() : undefined;
      const user = await authStorage.createEmailUser(normalizedEmail, passwordHash, displayName);

      const token = generateToken();
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await authStorage.createVerificationToken(user.id, tokenHash, expiresAt);

      try {
        await sendVerificationEmail(normalizedEmail, token);
      } catch (emailErr) {
        console.error("Failed to send verification email:", emailErr);
      }

      res.json({ ok: true, message: "Account created. Check your email to verify." });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ ok: false, error: "Server error. Please try again." });
    }
  });

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ ok: false, error: "Email and password are required." });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const user = await authStorage.getUserByEmail(normalizedEmail);

      if (!user || !user.passwordHash) {
        return res.status(401).json({ ok: false, error: "Invalid email or password." });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ ok: false, error: "Invalid email or password." });
      }

      if (!user.emailVerified) {
        return res.status(403).json({ ok: false, error: "Please verify your email before logging in.", code: "EMAIL_NOT_VERIFIED" });
      }

      req.login(user, (err) => {
        if (err) {
          console.error("Login session error:", err);
          return res.status(500).json({ ok: false, error: "Session error." });
        }
        res.json({ ok: true });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ ok: false, error: "Server error. Please try again." });
    }
  });

  app.get("/api/auth/verify-email", authLimiter, async (req, res) => {
    try {
      const { token, email } = req.query;

      if (!token || typeof token !== "string" || !email || typeof email !== "string") {
        return res.redirect("/verify-email?status=invalid");
      }

      const tokenHash = hashToken(token);
      const record = await authStorage.findVerificationToken(tokenHash);

      if (!record) {
        return res.redirect("/verify-email?status=invalid");
      }

      if (new Date() > record.expiresAt) {
        await authStorage.deleteVerificationToken(tokenHash);
        return res.redirect("/verify-email?status=expired");
      }

      await authStorage.setEmailVerified(record.userId);
      await authStorage.deleteVerificationTokensByUser(record.userId);

      const user = await authStorage.getUser(record.userId);
      if (user) {
        req.login(user, (err) => {
          if (err) console.error("Auto-login after verify error:", err);
          res.redirect("/verify-email?status=success");
        });
      } else {
        res.redirect("/verify-email?status=success");
      }
    } catch (error) {
      console.error("Verify email error:", error);
      res.redirect("/verify-email?status=error");
    }
  });

  app.post("/api/auth/resend-verification", authLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ ok: false, error: "Email required." });

      const normalizedEmail = email.toLowerCase().trim();
      const user = await authStorage.getUserByEmail(normalizedEmail);

      if (!user || user.emailVerified) {
        return res.json({ ok: true, message: "If the account exists, a verification email was sent." });
      }

      await authStorage.deleteVerificationTokensByUser(user.id);
      const token = generateToken();
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await authStorage.createVerificationToken(user.id, tokenHash, expiresAt);

      try {
        await sendVerificationEmail(normalizedEmail, token);
      } catch (emailErr) {
        console.error("Failed to resend verification email:", emailErr);
      }

      res.json({ ok: true, message: "If the account exists, a verification email was sent." });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ ok: false, error: "Server error." });
    }
  });

  app.post("/api/auth/forgot-password", authLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ ok: false, error: "Email required." });

      const normalizedEmail = email.toLowerCase().trim();
      const user = await authStorage.getUserByEmail(normalizedEmail);

      if (user && user.passwordHash) {
        const token = generateToken();
        const tokenHash = hashToken(token);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await authStorage.createPasswordResetToken(user.id, tokenHash, expiresAt);

        try {
          await sendPasswordResetEmail(normalizedEmail, token);
        } catch (emailErr) {
          console.error("Failed to send password reset email:", emailErr);
        }
      }

      res.json({ ok: true, message: "If the account exists, a password reset email was sent." });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ ok: false, error: "Server error." });
    }
  });

  app.post("/api/auth/reset-password", authLimiter, async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password || password.length < 8) {
        return res.status(400).json({ ok: false, error: "Invalid request." });
      }

      const tokenHash = hashToken(token);
      const record = await authStorage.findPasswordResetToken(tokenHash);

      if (!record || new Date() > record.expiresAt) {
        if (record) await authStorage.deletePasswordResetToken(tokenHash);
        return res.status(400).json({ ok: false, error: "Invalid or expired reset link." });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      await authStorage.updatePassword(record.userId, passwordHash);
      await authStorage.deletePasswordResetToken(tokenHash);

      res.json({ ok: true, message: "Password reset successful. You can now log in." });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ ok: false, error: "Server error." });
    }
  });

  // === SHARED ROUTES ===
  app.get("/api/auth/user", (req, res) => {
    if (req.isAuthenticated() && req.user) {
      const u = req.user as any;
      res.json({
        id: u.id,
        email: u.email,
        firstName: u.firstName || u.first_name,
        lastName: u.lastName || u.last_name,
        profileImageUrl: u.profileImageUrl || u.profile_image_url,
        emailVerified: u.emailVerified ?? u.email_verified,
        authProviders: u.authProviders ?? u.auth_providers ?? [],
      });
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  app.get("/api/auth/me", (req, res) => {
    if (req.isAuthenticated() && req.user) {
      const u = req.user as any;
      res.json({
        id: u.id,
        email: u.email,
        firstName: u.firstName || u.first_name,
        lastName: u.lastName || u.last_name,
        profileImageUrl: u.profileImageUrl || u.profile_image_url,
        emailVerified: u.emailVerified ?? u.email_verified,
        authProviders: u.authProviders ?? u.auth_providers ?? [],
      });
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) console.error("Logout error:", err);
      req.session.destroy((err2) => {
        if (err2) console.error("Session destroy error:", err2);
        res.clearCookie("connect.sid");
        res.json({ ok: true });
      });
    });
  });

  app.get("/api/logout", async (req, res) => {
    const user = req.user as any;
    const isReplitAuth = user?.claims?.iss?.includes('replit.com');
    
    req.logout(async (err) => {
      if (err) {
        console.error("Logout error:", err);
      }
      
      if (isReplitAuth) {
        try {
          const oidcConfig = await getOidcConfig();
          res.redirect(
            client.buildEndSessionUrl(oidcConfig, {
              client_id: process.env.REPL_ID!,
              post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
            }).href
          );
        } catch {
          res.redirect("/");
        }
      } else {
        res.redirect("/");
      }
    });
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};
