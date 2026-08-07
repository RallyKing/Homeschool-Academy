"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button, Card, Input, Message, PageHeader } from "@/components/ui";

type Step = "request" | "verify";

export default function ResetPasswordPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onRequestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const submittedEmail = String(formData.get("email") ?? "").trim();
    try {
      await signIn("password", formData);
      setEmail(submittedEmail);
      setStep("verify");
      setInfo("If that email has an account, a reset code was sent. Check your inbox (and spam).");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not start password reset. Check the email and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function onVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    try {
      await signIn("password", formData);
      router.push("/");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Invalid or expired code. Request a new one and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md animate-fade-up">
      <PageHeader
        title="Reset password"
        description={
          step === "request"
            ? "Enter your account email and we’ll send a one-time code."
            : "Enter the code from your email and choose a new password."
        }
      />
      <Card>
        {step === "request" ? (
          <form onSubmit={(e) => void onRequestCode(e)} className="space-y-4">
            <Input
              name="email"
              type="email"
              label="Email"
              required
              autoComplete="email"
              defaultValue={email}
            />
            <input name="flow" type="hidden" value="reset" />
            <Message tone="error">{error}</Message>
            <Message tone="success">{info}</Message>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Sending…" : "Send reset code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={(e) => void onVerify(e)} className="space-y-4">
            <p className="text-sm text-[var(--muted)]">
              Code sent to <span className="font-medium text-[var(--foreground)]">{email}</span>
            </p>
            <Input
              name="code"
              type="text"
              label="Reset code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="8-digit code"
            />
            <Input
              name="newPassword"
              type="password"
              label="New password"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <input name="email" type="hidden" value={email} />
            <input name="flow" type="hidden" value="reset-verification" />
            <Message tone="error">{error}</Message>
            <Message tone="success">{info}</Message>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Updating…" : "Update password"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={loading}
              onClick={() => {
                setStep("request");
                setError(null);
                setInfo(null);
              }}
            >
              Use a different email
            </Button>
          </form>
        )}
        <p className="mt-5 text-sm text-[var(--muted)]">
          Remembered it?{" "}
          <Link href="/sign-in" className="font-medium text-[var(--accent)] hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
