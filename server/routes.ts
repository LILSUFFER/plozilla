import type { Express } from "express";
import { type Server } from "http";
import { setupGoogleAuth } from "./replit_integrations/auth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupGoogleAuth(app);
  return httpServer;
}
