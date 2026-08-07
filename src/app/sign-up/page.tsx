"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button, Card, Input, Message, PageHeader, Select } from "@/components/ui";

export default function SignUpPage() {
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
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md animate-fade-up">
      <PageHeader
        title="Create account"
        description="Set up Homeschool Academy for your family or academy."
      />
      <Card>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <Input name="name" type="text" label="Name" autoComplete="name" />
          <Input name="email" type="email" label="Email" required autoComplete="email" />
          <Input
            name="password"
            type="password"
            label="Password"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <Select name="role" label="Role" defaultValue="parent">
            <option value="parent">Parent</option>
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
          </Select>
          <input name="flow" type="hidden" value="signUp" />
          <Message tone="error">{error}</Message>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating…" : "Create account"}
          </Button>
        </form>
        <p className="mt-5 text-sm text-[var(--muted)]">
          Already have an account?{" "}
          <Link href="/sign-in" className="hover-link font-medium text-[var(--accent)] underline-offset-2">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
