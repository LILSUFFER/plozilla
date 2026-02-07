import { users, emailVerificationTokens, passwordResetTokens, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq, and, gt, sql } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleSub(googleSub: string): Promise<User | undefined>;
  getUserByYandexSub(yandexSub: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createEmailUser(email: string, passwordHash: string): Promise<User>;
  setEmailVerified(userId: string): Promise<void>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  addAuthProvider(userId: string, provider: string): Promise<void>;
  setGoogleSub(userId: string, googleSub: string): Promise<void>;
  setYandexSub(userId: string, yandexSub: string): Promise<void>;
  createVerificationToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findVerificationToken(tokenHash: string): Promise<{ userId: string; expiresAt: Date } | undefined>;
  deleteVerificationToken(tokenHash: string): Promise<void>;
  deleteVerificationTokensByUser(userId: string): Promise<void>;
  createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findPasswordResetToken(tokenHash: string): Promise<{ userId: string; expiresAt: Date } | undefined>;
  deletePasswordResetToken(tokenHash: string): Promise<void>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async getUserByGoogleSub(googleSub: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleSub, googleSub));
    return user;
  }

  async getUserByYandexSub(yandexSub: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.yandexSub, yandexSub));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    if (userData.email) {
      const existingUser = await this.getUserByEmail(userData.email);
      if (existingUser) {
        const [updatedUser] = await db
          .update(users)
          .set({
            id: userData.id,
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.email, userData.email.toLowerCase()))
          .returning();
        return updatedUser;
      }
    }

    if (userData.id) {
      const existingById = await this.getUser(userData.id);
      if (existingById) {
        const [updatedUser] = await db
          .update(users)
          .set({
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userData.id))
          .returning();
        return updatedUser;
      }
    }

    const [newUser] = await db
      .insert(users)
      .values({ ...userData, email: userData.email?.toLowerCase() })
      .returning();
    return newUser;
  }

  async createEmailUser(email: string, passwordHash: string): Promise<User> {
    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        emailVerified: false,
        authProviders: ["password"],
      })
      .returning();
    return newUser;
  }

  async setEmailVerified(userId: string): Promise<void> {
    await db.update(users).set({ emailVerified: true, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async addAuthProvider(userId: string, provider: string): Promise<void> {
    await db.update(users).set({
      authProviders: sql`array_append(COALESCE(auth_providers, '{}'), ${provider})`,
      updatedAt: new Date(),
    }).where(eq(users.id, userId));
  }

  async setGoogleSub(userId: string, googleSub: string): Promise<void> {
    await db.update(users).set({ googleSub, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async setYandexSub(userId: string, yandexSub: string): Promise<void> {
    await db.update(users).set({ yandexSub, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async createVerificationToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await db.insert(emailVerificationTokens).values({ userId, tokenHash, expiresAt });
  }

  async findVerificationToken(tokenHash: string): Promise<{ userId: string; expiresAt: Date } | undefined> {
    const [token] = await db
      .select({ userId: emailVerificationTokens.userId, expiresAt: emailVerificationTokens.expiresAt })
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, tokenHash));
    return token;
  }

  async deleteVerificationToken(tokenHash: string): Promise<void> {
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.tokenHash, tokenHash));
  }

  async deleteVerificationTokensByUser(userId: string): Promise<void> {
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
  }

  async createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await db.insert(passwordResetTokens).values({ userId, tokenHash, expiresAt });
  }

  async findPasswordResetToken(tokenHash: string): Promise<{ userId: string; expiresAt: Date } | undefined> {
    const [token] = await db
      .select({ userId: passwordResetTokens.userId, expiresAt: passwordResetTokens.expiresAt })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash));
    return token;
  }

  async deletePasswordResetToken(tokenHash: string): Promise<void> {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash));
  }
}

export const authStorage = new AuthStorage();
