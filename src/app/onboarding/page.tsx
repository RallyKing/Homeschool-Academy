"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../convex/_generated/api";

export default function OnboardingPage() {
  const user = useQuery(api.users.current);
  const status = useQuery(api.users.onboardingStatus);
  const ensureFamily = useMutation(api.families.ensureMine);
  const ensureAcademy = useMutation(api.academies.ensureMine);
  const setRole = useMutation(api.users.setRole);
  const seedSubjects = useMutation(api.subjects.seed);
  const router = useRouter();

  const [familyName, setFamilyName] = useState("");
  const [academyName, setAcademyName] = useState("");
  const [academyDesc, setAcademyDesc] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user === undefined || status === undefined) {
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }

  if (!user) {
    return <p className="text-sm">Please sign in.</p>;
  }

  if (!status.needsOnboarding) {
    router.replace(status.homePath);
    return <p className="text-sm text-neutral-500">Redirecting…</p>;
  }

  const role = user.role ?? "parent";

  async function createFamily(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (role !== "parent" && role !== "superAdmin") {
        await setRole({ role: "parent" });
      }
      await ensureFamily({
        name: familyName.trim() || undefined,
      });
      try {
        await seedSubjects({});
      } catch {
        // already seeded
      }
      router.replace("/family/dashboard");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function createAcademy(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (role !== "teacher" && role !== "superAdmin") {
        await setRole({ role: "teacher" });
      }
      await ensureAcademy({
        name: academyName.trim() || undefined,
        description: academyDesc.trim() || undefined,
      });
      try {
        await seedSubjects({});
      } catch {
        // already seeded
      }
      router.replace("/academy/dashboard");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Welcome — set up your space</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Signed in as {user.email ?? user.name}. Choose how you&apos;ll use Homeschool
          Academy.
        </p>
      </div>

      {(role === "parent" || role === "superAdmin" || !user.role) && (
        <section className="space-y-3 border-t border-neutral-200 pt-6">
          <h2 className="text-lg font-medium">I&apos;m a parent</h2>
          <p className="text-sm text-neutral-600">
            Create a family household to manage students, logs, and planners.
          </p>
          <form onSubmit={(e) => void createFamily(e)} className="space-y-3">
            <label className="block text-sm">
              Family name
              <input
                className="mt-1 w-full border border-neutral-300 px-2 py-1.5"
                placeholder="e.g. Rivera Household"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Create family
            </button>
          </form>
        </section>
      )}

      {(role === "teacher" || role === "superAdmin" || !user.role) && (
        <section className="space-y-3 border-t border-neutral-200 pt-6">
          <h2 className="text-lg font-medium">I&apos;m a teacher</h2>
          <p className="text-sm text-neutral-600">
            Create an academy to publish courses families can subscribe to.
          </p>
          <form onSubmit={(e) => void createAcademy(e)} className="space-y-3">
            <label className="block text-sm">
              Academy name
              <input
                className="mt-1 w-full border border-neutral-300 px-2 py-1.5"
                placeholder="e.g. Northside Learning Co-op"
                value={academyName}
                onChange={(e) => setAcademyName(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Description (optional)
              <textarea
                className="mt-1 w-full border border-neutral-300 px-2 py-1.5"
                rows={2}
                value={academyDesc}
                onChange={(e) => setAcademyDesc(e.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Create academy
            </button>
          </form>
        </section>
      )}

      {role === "student" && (
        <section className="space-y-2 border-t border-neutral-200 pt-6">
          <h2 className="text-lg font-medium">Student account</h2>
          <p className="text-sm text-neutral-600">
            Ask your parent to add you as a student and link your email, or claim
            your profile on the student dashboard.
          </p>
          <button
            type="button"
            className="border border-neutral-400 px-3 py-1.5 text-sm"
            onClick={() => router.replace("/student/dashboard")}
          >
            Go to student dashboard
          </button>
        </section>
      )}

      {message && <p className="text-sm text-red-700">{message}</p>}
    </div>
  );
}
