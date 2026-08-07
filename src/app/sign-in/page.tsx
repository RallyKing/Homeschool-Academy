"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

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
    <div className="mx-auto max-w-sm space-y-4 py-8">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        <label className="block text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full border border-neutral-300 px-2 py-1.5"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            className="mt-1 w-full border border-neutral-300 px-2 py-1.5"
          />
        </label>
        <input name="flow" type="hidden" value="signIn" />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="text-sm text-neutral-600">
        No account?{" "}
        <Link href="/sign-up" className="underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
