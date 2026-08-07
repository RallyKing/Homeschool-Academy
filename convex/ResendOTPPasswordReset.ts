import Resend from "@auth/core/providers/resend";
import { Resend as ResendAPI } from "resend";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

function resendApiKey(): string | undefined {
  return process.env.AUTH_RESEND_KEY ?? process.env.RESEND_API_KEY;
}

function emailFrom(): string {
  return (
    process.env.AUTH_EMAIL_FROM ??
    "Homeschool Academy <onboarding@resend.dev>"
  );
}

/**
 * Password-reset OTP via Resend (legacy / secondary path).
 * Primary UX is direct reset via `passwordReset.setPasswordDirect`.
 *
 * Without AUTH_RESEND_KEY / RESEND_API_KEY, the code is logged to Convex logs
 * so reset still works in development (and as an emergency fallback).
 * Never throws on missing email provider — logs instead.
 */
export const ResendOTPPasswordReset = Resend({
  id: "password-reset",
  // Auth.js Resend requires a string; empty string avoids construction failures
  // when the key is unset. sendVerificationRequest still gates on a real key.
  apiKey: resendApiKey() ?? "",
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes) {
        crypto.getRandomValues(bytes);
      },
    };
    return generateRandomString(random, "0123456789", 8);
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    // Always log so operators can recover accounts when email isn't configured.
    console.log(`[password-reset] code for ${email}: ${token}`);

    const apiKey =
      (typeof provider.apiKey === "string" && provider.apiKey.length > 0
        ? provider.apiKey
        : undefined) ?? resendApiKey();

    if (!apiKey) {
      console.warn(
        "[password-reset] AUTH_RESEND_KEY / RESEND_API_KEY not set — email not sent; use Convex logs for the code, or use direct reset (AUTH_ALLOW_DIRECT_PASSWORD_RESET)",
      );
      return;
    }

    try {
      const resend = new ResendAPI(apiKey);
      const { error } = await resend.emails.send({
        from: emailFrom(),
        to: [email],
        subject: "Reset your Homeschool Academy password",
        text: [
          "Use this code to reset your Homeschool Academy password:",
          "",
          token,
          "",
          "This code expires in about one hour.",
          "If you did not request a reset, you can ignore this email.",
        ].join("\n"),
      });

      if (error) {
        console.error("[password-reset] Resend error:", error);
        // Do not throw — OTP remains in Convex logs for recovery.
        console.warn(
          "[password-reset] email send failed; code is in logs above",
        );
      }
    } catch (err) {
      console.error("[password-reset] unexpected send failure:", err);
      // Swallow so Auth does not surface a generic Server Error; code is logged.
    }
  },
});
