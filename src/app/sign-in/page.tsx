"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button, Card, Input, Message, PageHeader } from "@/components/ui";

export default function SignInPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    formData.set("email", email);
    try {
      await signIn("password", formData);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md animate-fade-up">
      <PageHeader
        title="Sign in"
        description="Welcome back to Homeschool Academy."
      />
      <Card>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <Input name="email" type="email" label="Email" required autoComplete="email" />
          <Input
            name="password"
            type="password"
            label="Password"
            required
            autoComplete="current-password"
          />
          <input name="flow" type="hidden" value="signIn" />
          <div className="flex justify-end">
            <Link
              href="/reset-password"
              className="text-sm font-medium text-[var(--accent)] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Message tone="error">{error}</Message>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="mt-5 text-sm text-[var(--muted)]">
          No account?{" "}
          <Link href="/sign-up" className="font-medium text-[var(--accent)] hover:underline">
            Sign up
          </Link>
        </p>
      </Card>
    </div>
  );
}
