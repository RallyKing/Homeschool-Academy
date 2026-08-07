"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import {
  Button,
  Card,
  Input,
  Message,
  PageHeader,
  Row,
  Col,
  Textarea,
} from "@/components/ui";

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

  useEffect(() => {
    if (status && !status.needsOnboarding) {
      router.replace(status.homePath);
    }
  }, [status, router]);

  if (user === undefined || status === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (!user) {
    return <p className="text-sm text-[var(--muted)]">Please sign in.</p>;
  }

  if (!status.needsOnboarding) {
    return <p className="text-sm text-[var(--muted)]">Redirecting…</p>;
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
    <div className="space-y-8">
      <PageHeader
        title="Welcome — set up your space"
        description={`Signed in as ${user.email ?? user.name}. Choose how you'll use Homeschool Academy.`}
      />

      <Row gap="lg" className="stagger-children">
        {(role === "parent" || role === "superAdmin" || !user.role) && (
          <Col span={12} md={6}>
            <Card className="animate-fade-up h-full" interactive>
              <h2 className="font-display text-lg font-semibold tracking-tight">
                I&apos;m a parent
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Create a family household to manage students, logs, and planners.
              </p>
              <form onSubmit={(e) => void createFamily(e)} className="mt-5 space-y-4">
                <Input
                  label="Family name"
                  placeholder="e.g. Rivera Household"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                />
                <Button type="submit" disabled={busy}>
                  Create family
                </Button>
              </form>
            </Card>
          </Col>
        )}

        {(role === "teacher" || role === "superAdmin" || !user.role) && (
          <Col span={12} md={6}>
            <Card className="animate-fade-up h-full" interactive>
              <h2 className="font-display text-lg font-semibold tracking-tight">
                I&apos;m a teacher
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Create an academy to publish courses families can subscribe to.
              </p>
              <form onSubmit={(e) => void createAcademy(e)} className="mt-5 space-y-4">
                <Input
                  label="Academy name"
                  placeholder="e.g. Northside Learning Co-op"
                  value={academyName}
                  onChange={(e) => setAcademyName(e.target.value)}
                />
                <Textarea
                  label="Description (optional)"
                  rows={2}
                  value={academyDesc}
                  onChange={(e) => setAcademyDesc(e.target.value)}
                />
                <Button type="submit" disabled={busy}>
                  Create academy
                </Button>
              </form>
            </Card>
          </Col>
        )}

        {role === "student" && (
          <Col span={12}>
            <Card className="animate-fade-up">
              <h2 className="font-display text-lg font-semibold tracking-tight">
                Student account
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Ask your parent to add you as a student and link your email, or claim
                your profile on the student dashboard.
              </p>
              <Button
                className="mt-5"
                variant="secondary"
                onClick={() => router.replace("/student/dashboard")}
              >
                Go to student dashboard
              </Button>
            </Card>
          </Col>
        )}
      </Row>

      <Message tone="error">{message}</Message>
    </div>
  );
}
