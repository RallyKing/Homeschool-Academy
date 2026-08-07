import {
  invalidateSessions,
  modifyAccountCredentials,
} from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

function resendConfigured(): boolean {
  const key = process.env.AUTH_RESEND_KEY ?? process.env.RESEND_API_KEY;
  return typeof key === "string" && key.length > 0;
}

function directResetAllowed(): boolean {
  if (process.env.AUTH_ALLOW_DIRECT_PASSWORD_RESET === "true") {
    return true;
  }
  // Emergency fallback when email OTP cannot be delivered.
  return !resendConfigured();
}

function validatePassword(password: string): void {
  if (!password || password.length < 8) {
    throw new ConvexError("Password must be at least 8 characters");
  }
}

/**
 * Resolve a password auth account by email (case-insensitive).
 * Provider account IDs are stored with the signup casing, which often differs
 * from what users type on the reset form.
 */
export const findPasswordAccountByEmail = internalQuery({
  args: { email: v.string() },
  returns: v.union(
    v.object({
      accountId: v.id("authAccounts"),
      providerAccountId: v.string(),
      userId: v.id("users"),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const normalized = args.email.trim().toLowerCase();
    if (!normalized.includes("@")) {
      return null;
    }

    const exactEmails = Array.from(
      new Set([args.email.trim(), normalized].filter(Boolean)),
    );

    for (const email of exactEmails) {
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .unique();
      if (!user) {
        continue;
      }

      // Exact providerAccountId match (common case).
      if (user.email) {
        const byEmail = await ctx.db
          .query("authAccounts")
          .withIndex("providerAndAccountId", (q) =>
            q.eq("provider", "password").eq("providerAccountId", user.email!),
          )
          .unique();
        if (byEmail) {
          return {
            accountId: byEmail._id,
            providerAccountId: byEmail.providerAccountId,
            userId: byEmail.userId as Id<"users">,
          };
        }
      }

      // User found but account id casing differs from users.email.
      const accountsForUser = await ctx.db.query("authAccounts").take(500);
      const match = accountsForUser.find(
        (a) =>
          a.provider === "password" &&
          a.userId === user._id &&
          a.providerAccountId.toLowerCase() === normalized,
      );
      if (match) {
        return {
          accountId: match._id,
          providerAccountId: match.providerAccountId,
          userId: match.userId as Id<"users">,
        };
      }
    }

    // Case-insensitive user email fallback (signup casing ≠ typed email).
    const users = await ctx.db.query("users").take(500);
    const matchedUser = users.find(
      (u) => u.email?.toLowerCase() === normalized,
    );
    if (!matchedUser) {
      return null;
    }

    const accounts = await ctx.db.query("authAccounts").take(500);
    const passwordAccount = accounts.find(
      (a) =>
        a.provider === "password" &&
        (a.userId === matchedUser._id ||
          a.providerAccountId.toLowerCase() === normalized),
    );
    if (!passwordAccount) {
      return null;
    }
    return {
      accountId: passwordAccount._id,
      providerAccountId: passwordAccount.providerAccountId,
      userId: passwordAccount.userId as Id<"users">,
    };
  },
});

/**
 * Lowercase users.email + authAccounts.providerAccountId so later sign-in
 * works with the email the user actually types.
 */
export const normalizeAccountEmail = internalMutation({
  args: {
    accountId: v.id("authAccounts"),
    userId: v.id("users"),
    email: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const normalized = args.email.trim().toLowerCase();
    const account = await ctx.db.get("authAccounts", args.accountId);
    if (!account || account.provider !== "password") {
      throw new Error("Password account not found");
    }
    if (account.userId !== args.userId) {
      throw new Error("Account user mismatch");
    }

    if (account.providerAccountId !== normalized) {
      // Ensure we don't collide with another password account.
      const existing = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", "password").eq("providerAccountId", normalized),
        )
        .unique();
      if (existing && existing._id !== account._id) {
        throw new Error("Another account already uses this email");
      }
      await ctx.db.patch("authAccounts", account._id, {
        providerAccountId: normalized,
      });
    }

    const user = await ctx.db.get("users", args.userId);
    if (user && user.email !== normalized) {
      await ctx.db.patch("users", args.userId, { email: normalized });
    }

    return normalized;
  },
});

/**
 * Set a new password for an existing account by email — no OTP/email.
 *
 * Gated by AUTH_ALLOW_DIRECT_PASSWORD_RESET=true, or automatically when
 * AUTH_RESEND_KEY / RESEND_API_KEY is missing (so reset still works without email).
 *
 * Uses Convex Auth's official modifyAccountCredentials helper (Scrypt hash).
 */
export const setPasswordDirect = action({
  args: {
    email: v.string(),
    newPassword: v.string(),
  },
  returns: v.object({
    ok: v.literal(true),
    email: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: true; email: string }> => {
    if (!directResetAllowed()) {
      throw new ConvexError(
        "Direct password reset is disabled. Set AUTH_ALLOW_DIRECT_PASSWORD_RESET=true on the Convex deployment, or configure Resend for email OTP reset.",
      );
    }

    const email = args.email.trim();
    if (!email || !email.includes("@")) {
      throw new ConvexError("Enter a valid email address");
    }

    validatePassword(args.newPassword);

    const found: {
      accountId: Id<"authAccounts">;
      userId: Id<"users">;
      providerAccountId: string;
    } | null = await ctx.runQuery(
      internal.passwordReset.findPasswordAccountByEmail,
      { email },
    );

    if (found === null) {
      throw new ConvexError(
        "No password account found for that email. Check the address or sign up first.",
      );
    }

    try {
      // Normalize casing first so sign-in works with lowercase emails.
      const normalizedEmail: string = await ctx.runMutation(
        internal.passwordReset.normalizeAccountEmail,
        {
          accountId: found.accountId,
          userId: found.userId,
          email: found.providerAccountId,
        },
      );

      await modifyAccountCredentials(ctx, {
        provider: "password",
        account: { id: normalizedEmail, secret: args.newPassword },
      });
      await invalidateSessions(ctx, { userId: found.userId });

      return { ok: true as const, email: normalizedEmail };
    } catch (err) {
      const message =
        err instanceof ConvexError
          ? typeof err.data === "string"
            ? err.data
            : "Could not update password"
          : err instanceof Error
            ? err.message
            : "Could not update password";
      console.error("[passwordReset.setPasswordDirect] failed:", message);
      throw new ConvexError(message);
    }
  },
});
