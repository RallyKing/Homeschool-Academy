"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../../convex/_generated/api";
import { StudentPhotoEditor } from "@/components/StudentPhotoEditor";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Message,
  PageHeader,
  Section,
  TabPanel,
  Tabs,
} from "@/components/ui";
import { usePageTab } from "@/hooks/usePageTab";
import { cn } from "@/lib/cn";

const STUDENT_SETTINGS_TABS = [
  "profile",
  "customization",
  "notifications",
  "privacy",
  "account",
] as const;

function PrefToggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`list-row list-row-dense ${disabled ? "opacity-60" : "cursor-pointer"}`}
    >
      <div className="min-w-0">
        <p className="font-medium text-[var(--foreground)]">{label}</p>
        {description ? (
          <p className="text-xs text-[var(--muted)]">{description}</p>
        ) : null}
      </div>
      <input
        type="checkbox"
        className="h-4 w-4 accent-[var(--accent)]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function StudentSettingsInner() {
  const { signOut } = useAuthActions();
  const [tab, setTab] = usePageTab(STUDENT_SETTINGS_TABS, "profile");

  const user = useQuery(api.users.current);
  const profile = useQuery(api.students.myProfile);
  const family = useQuery(
    api.families.get,
    profile?.familyId ? { familyId: profile.familyId } : "skip",
  );
  const prefs = useQuery(api.settings.getMine);
  const progress = useQuery(
    api.social.getProgress,
    profile ? { studentId: profile._id } : "skip",
  );

  const updateStudent = useMutation(api.students.update);
  const updatePrefs = useMutation(api.settings.updateMine);
  const ensureProfile = useMutation(api.social.ensureProfile);
  const updateCustomization = useMutation(api.social.updateCustomization);

  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">(
    "info",
  );
  const [displayNameDraft, setDisplayNameDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    void ensureProfile({ studentId: profile._id }).catch(() => {
      // created on first cheer if this fails
    });
  }, [profile, ensureProfile]);

  const displayName = displayNameDraft ?? profile?.displayName ?? "";

  function notify(text: string, tone: "info" | "error" | "success" = "success") {
    setMessage(text);
    setMessageTone(tone);
  }

  if (user === undefined || profile === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (!user) {
    return <p className="text-sm text-[var(--muted)]">Please sign in.</p>;
  }

  if (!profile) {
    return (
      <div className="page-stack">
        <PageHeader
          compact
          eyebrow="Student"
          title="Settings"
          description="Your account isn’t linked to a student profile yet."
        />
        <EmptyState>
          Ask a parent to link your email from the family dashboard, then refresh
          this page.
        </EmptyState>
      </div>
    );
  }

  const student = profile;

  const effectivePublicCheer =
    student.defaultPublicCheer ?? family?.defaultPublicCheer ?? true;

  async function onSaveName(e: FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;
    setBusy(true);
    try {
      await updateStudent({
        studentId: student._id,
        displayName: displayName.trim(),
      });
      notify("Display name saved.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        compact
        eyebrow="Student"
        title="Settings"
        description="Profile, cheer style, notifications, and privacy."
      />

      <Message tone={messageTone}>{message}</Message>

      <Tabs
        size="sm"
        tabs={[
          { id: "profile", label: "Profile" },
          { id: "customization", label: "Customization" },
          { id: "notifications", label: "Notifications" },
          { id: "privacy", label: "Privacy" },
          { id: "account", label: "Account" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <TabPanel id="profile" active={tab === "profile"}>
        <Section title="Photo" description="Shown on the family wall and dashboards.">
          <StudentPhotoEditor
            studentId={profile._id}
            imageStorageId={profile.imageStorageId}
            name={profile.displayName}
            onError={(msg) => notify(msg, "error")}
            onSuccess={(msg) => notify(msg, "success")}
          />
        </Section>

        <Section title="Display name">
          <form
            onSubmit={(e) => void onSaveName(e)}
            className="flex flex-wrap items-end gap-2"
          >
            <div className="min-w-[12rem] flex-1">
              <Input
                label="Name"
                value={displayName}
                onChange={(e) => setDisplayNameDraft(e.target.value)}
                required
              />
            </div>
            <Button type="submit" size="sm" disabled={busy}>
              Save
            </Button>
          </form>
        </Section>

        <Section title="Academic level" description="Set by a parent.">
          <div className="list-row list-row-dense">
            <span className="text-sm text-[var(--muted)]">Level</span>
            <span className="text-sm font-medium">
              {profile.academicLevel ?? "Not set"}
            </span>
          </div>
        </Section>
      </TabPanel>

      <TabPanel id="customization" active={tab === "customization"}>
        <Section
          title="Your look"
          description="Unlock themes, frames, and bubbles by cheering siblings. Same options as Cheer → Customize."
        >
          {!progress ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-medium">Theme</p>
                <div className="flex flex-wrap gap-2">
                  {progress.themes.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      disabled={!t.unlocked || busy}
                      className={cn(
                        "cheer-option",
                        progress.customization.themeKey === t.key &&
                          "cheer-option-active",
                        !t.unlocked && "opacity-45",
                      )}
                      onClick={() => {
                        setBusy(true);
                        void updateCustomization({
                          studentId: profile._id,
                          themeKey: t.key,
                        })
                          .then(() => notify(`Theme: ${t.label}`))
                          .catch((err) =>
                            notify(
                              err instanceof Error ? err.message : "Failed",
                              "error",
                            ),
                          )
                          .finally(() => setBusy(false));
                      }}
                    >
                      <span className="font-medium">{t.label}</span>
                      <span className="block text-xs text-[var(--muted)]">
                        {t.unlocked ? t.description : "Locked"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Avatar frame</p>
                <div className="flex flex-wrap gap-2">
                  {progress.frames.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      disabled={!t.unlocked || busy}
                      className={cn(
                        "cheer-option",
                        progress.customization.frameKey === t.key &&
                          "cheer-option-active",
                        !t.unlocked && "opacity-45",
                      )}
                      onClick={() => {
                        setBusy(true);
                        void updateCustomization({
                          studentId: profile._id,
                          frameKey: t.key,
                        })
                          .then(() => notify(`Frame: ${t.label}`))
                          .catch((err) =>
                            notify(
                              err instanceof Error ? err.message : "Failed",
                              "error",
                            ),
                          )
                          .finally(() => setBusy(false));
                      }}
                    >
                      <span className="font-medium">{t.label}</span>
                      <span className="block text-xs text-[var(--muted)]">
                        {t.unlocked ? t.description : "Locked"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Chat bubble</p>
                <div className="flex flex-wrap gap-2">
                  {progress.bubbles.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      disabled={!t.unlocked || busy}
                      className={cn(
                        "cheer-option",
                        progress.customization.bubbleKey === t.key &&
                          "cheer-option-active",
                        !t.unlocked && "opacity-45",
                      )}
                      onClick={() => {
                        setBusy(true);
                        void updateCustomization({
                          studentId: profile._id,
                          bubbleKey: t.key,
                        })
                          .then(() => notify(`Bubble: ${t.label}`))
                          .catch((err) =>
                            notify(
                              err instanceof Error ? err.message : "Failed",
                              "error",
                            ),
                          )
                          .finally(() => setBusy(false));
                      }}
                    >
                      <span className="font-medium">{t.label}</span>
                      <span className="block text-xs text-[var(--muted)]">
                        {t.unlocked ? t.description : "Locked"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <Link
                href="/student/social?tab=customize"
                className="text-sm font-medium text-[var(--accent)] underline-offset-2 hover:underline"
              >
                Open full Cheer customize tab
              </Link>
            </div>
          )}
        </Section>
      </TabPanel>

      <TabPanel id="notifications" active={tab === "notifications"}>
        <Section
          title="Student notifications"
          description="What you hear about on your student account."
        >
          <div className="space-y-1.5">
            <PrefToggle
              label="Kudos & cheers"
              description="When someone cheers you."
              checked={profile.notifyKudos ?? true}
              onChange={(next) =>
                void updateStudent({
                  studentId: profile._id,
                  notifyKudos: next,
                })
                  .then(() => notify("Preference saved."))
                  .catch((err) =>
                    notify(
                      err instanceof Error ? err.message : "Failed",
                      "error",
                    ),
                  )
              }
            />
            <PrefToggle
              label="Chores"
              description="New chores and parent updates."
              checked={profile.notifyChores ?? true}
              onChange={(next) =>
                void updateStudent({
                  studentId: profile._id,
                  notifyChores: next,
                })
                  .then(() => notify("Preference saved."))
                  .catch((err) =>
                    notify(
                      err instanceof Error ? err.message : "Failed",
                      "error",
                    ),
                  )
              }
            />
            <PrefToggle
              label="Quests"
              description="Quest progress and completions."
              checked={profile.notifyQuests ?? true}
              onChange={(next) =>
                void updateStudent({
                  studentId: profile._id,
                  notifyQuests: next,
                })
                  .then(() => notify("Preference saved."))
                  .catch((err) =>
                    notify(
                      err instanceof Error ? err.message : "Failed",
                      "error",
                    ),
                  )
              }
            />
          </div>
        </Section>

        <Section
          title="Account alerts"
          description="Shared alert feed preferences for this login."
          action={
            <Link href="/alerts">
              <Button variant="ghost" size="sm">
                View alerts
              </Button>
            </Link>
          }
        >
          {prefs === undefined ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : (
            <PrefToggle
              label="General alerts"
              description="Schedule changes, verifications, and system notices."
              checked={prefs.notifyAlerts}
              onChange={(next) =>
                void updatePrefs({ notifyAlerts: next })
                  .then(() => notify("Preference saved."))
                  .catch((err) =>
                    notify(
                      err instanceof Error ? err.message : "Failed",
                      "error",
                    ),
                  )
              }
            />
          )}
        </Section>
      </TabPanel>

      <TabPanel id="privacy" active={tab === "privacy"}>
        <Section
          title="Cheer visibility"
          description="Default when you post to the family wall. You can still change it per message."
        >
          {family === undefined ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : (
            <>
              <PrefToggle
                label="Public to family wall by default"
                description={
                  profile.defaultPublicCheer === undefined
                    ? `Following family default (${family?.defaultPublicCheer ?? true ? "public" : "private"}).`
                    : "Your personal override is active."
                }
                checked={effectivePublicCheer}
                onChange={(next) =>
                  void updateStudent({
                    studentId: profile._id,
                    defaultPublicCheer: next,
                  })
                    .then(() => notify("Privacy default saved."))
                    .catch((err) =>
                      notify(
                        err instanceof Error ? err.message : "Failed",
                        "error",
                      ),
                    )
                }
              />
              {profile.defaultPublicCheer !== undefined ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() =>
                    void updateStudent({
                      studentId: profile._id,
                      // Clear override by setting to family default explicitly —
                      // backend stores boolean; re-apply family effective value
                      // then parents can change family default independently.
                      defaultPublicCheer:
                        family?.defaultPublicCheer ?? true,
                    })
                      .then(() =>
                        notify(
                          "Reset to match current family default.",
                        ),
                      )
                      .catch((err) =>
                        notify(
                          err instanceof Error ? err.message : "Failed",
                          "error",
                        ),
                      )
                  }
                >
                  Match family default
                </Button>
              ) : null}
            </>
          )}
        </Section>
      </TabPanel>

      <TabPanel id="account" active={tab === "account"}>
        <Section title="Account">
          <ul className="space-y-1.5">
            <li className="list-row list-row-dense">
              <span className="text-sm text-[var(--muted)]">Claim</span>
              <Badge tone={profile.userId ? "success" : "warning"}>
                {profile.userId ? "Linked" : "Not linked"}
              </Badge>
            </li>
            <li className="list-row list-row-dense">
              <span className="text-sm text-[var(--muted)]">Email</span>
              <span className="text-sm font-medium">
                {user.email ?? "—"}
              </span>
            </li>
            <li className="list-row list-row-dense">
              <span className="text-sm text-[var(--muted)]">Role</span>
              <Badge tone="neutral">{user.role ?? "student"}</Badge>
            </li>
            <li className="list-row list-row-dense">
              <span className="text-sm text-[var(--muted)]">Family</span>
              <span className="text-sm font-medium">
                {family?.name ?? "—"}
              </span>
            </li>
            <li className="list-row list-row-dense">
              <span className="text-sm text-[var(--muted)]">Profile name</span>
              <span className="text-sm font-medium">{profile.displayName}</span>
            </li>
          </ul>
        </Section>

        <Section title="Session">
          <div className="flex flex-wrap gap-2">
            <Link href="/student/dashboard">
              <Button variant="secondary" size="sm">
                Dashboard
              </Button>
            </Link>
            <Link href="/help">
              <Button variant="secondary" size="sm">
                Help
              </Button>
            </Link>
            <Button
              variant="danger"
              size="sm"
              onClick={() => void signOut()}
            >
              Sign out
            </Button>
          </div>
        </Section>
      </TabPanel>
    </div>
  );
}

export default function StudentSettingsPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}
    >
      <StudentSettingsInner />
    </Suspense>
  );
}
