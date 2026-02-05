import type { Express } from "express";
import { type Server } from "http";
import { setupCombinedAuth } from "./replit_integrations/auth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupCombinedAuth(app);
  return httpServer;
}
