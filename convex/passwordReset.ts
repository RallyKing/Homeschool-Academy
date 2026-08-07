import {
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action } from "./_generated/server";
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
    throw new Error("Password must be at least 8 characters");
  }
}

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
  }),
  handler: async (ctx, args) => {
    if (!directResetAllowed()) {
      throw new Error(
        "Direct password reset is disabled. Set AUTH_ALLOW_DIRECT_PASSWORD_RESET=true on the Convex deployment, or configure Resend for email OTP reset.",
      );
    }

    const email = args.email.trim();
    if (!email || !email.includes("@")) {
      throw new Error("Enter a valid email address");
    }

    validatePassword(args.newPassword);

    const candidates = Array.from(
      new Set([email.toLowerCase(), email].filter(Boolean)),
    );

    let accountId: string | null = null;
    let userId: Id<"users"> | null = null;

    for (const id of candidates) {
      try {
        const retrieved = await retrieveAccount(ctx, {
          provider: "password",
          account: { id },
        });
        accountId = String(retrieved.account.providerAccountId);
        userId = retrieved.user._id as Id<"users">;
        break;
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (
          message === "InvalidAccountId" ||
          message.includes("InvalidAccountId")
        ) {
          continue;
        }
        throw err instanceof Error
          ? err
          : new Error("Could not look up account");
      }
    }

    if (accountId === null || userId === null) {
      throw new Error("No account found for that email");
    }

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: accountId, secret: args.newPassword },
    });
    await invalidateSessions(ctx, { userId });

    return { ok: true as const };
  },
});
