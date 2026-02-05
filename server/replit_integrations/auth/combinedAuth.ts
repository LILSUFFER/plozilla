import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";

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
  const sessionTtlMs = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds
  const sessionTtlSec = 7 * 24 * 60 * 60; // 1 week in seconds
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
      maxAge: sessionTtlMs,
    },
  });
}

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
          const email = profile.emails?.[0]?.value;
          const user = await authStorage.upsertUser({
            id: profile.id,
            email: email || null,
            firstName: profile.name?.givenName || null,
            lastName: profile.name?.familyName || null,
            profileImageUrl: profile.photos?.[0]?.value || null,
          });
          done(null, user);
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
      failureRedirect: "/",
      successRedirect: "/app",
    })
  );

  // === SHARED ROUTES ===
  app.get("/api/auth/user", (req, res) => {
    if (req.isAuthenticated() && req.user) {
      res.json(req.user);
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
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
