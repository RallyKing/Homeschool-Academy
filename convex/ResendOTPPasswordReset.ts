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
 * Password-reset OTP via Resend.
 * Without AUTH_RESEND_KEY / RESEND_API_KEY, the code is logged to Convex logs
 * so reset still works in development (and as an emergency fallback).
 */
export const ResendOTPPasswordReset = Resend({
  id: "password-reset",
  apiKey: resendApiKey(),
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
        "[password-reset] AUTH_RESEND_KEY / RESEND_API_KEY not set — email not sent; use Convex logs for the code",
      );
      return;
    }

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
      throw new Error("Could not send password reset email");
    }
  },
});
