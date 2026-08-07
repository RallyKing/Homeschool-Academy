"use client";

import {
  FormEvent,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { StudentAvatar } from "@/components/StudentAvatar";
import { FamilyWallFeed } from "@/components/FamilyWallFeed";
import { useViewAsStudentId } from "@/hooks/useViewAsStudentId";
import { withViewAs } from "@/lib/viewAs";
import { usePageTab } from "@/hooks/usePageTab";
import {
  Badge,
  Button,
  EmptyState,
  Message,
  PageHeader,
  Section,
  Select,
  Tabs,
  TabPanel,
  Textarea,
} from "@/components/ui";
import { cn } from "@/lib/cn";

const CHEER_TABS = ["wall", "inbox", "send", "stickers", "customize"] as const;

type CheerKind = "encourage" | "motivate" | "congratulate" | "sticker";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function weekStartToday() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  return { today: isoDate(now), weekStart: isoDate(start) };
}

function formatWhen(ms: number): string {
  try {
    return new Date(ms).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function kindTone(kind: CheerKind): "success" | "neutral" | "warning" {
  if (kind === "congratulate") return "success";
  if (kind === "motivate") return "warning";
  return "neutral";
}

function StudentSocialInner() {
  const viewAsStudentId = useViewAsStudentId();
  const [tab, setTab] = usePageTab(CHEER_TABS, "wall");
  const week = useMemo(() => weekStartToday(), []);

  const myProfile = useQuery(
    api.students.myProfile,
    viewAsStudentId ? "skip" : {},
  );
  const viewAsContext = useQuery(
    api.students.getViewAsContext,
    viewAsStudentId ? { studentId: viewAsStudentId } : "skip",
  );

  const profile = viewAsStudentId
    ? (viewAsContext?.student ?? null)
    : (myProfile ?? null);

  const family = useQuery(api.users.myFamily);

  const siblings = useQuery(
    api.social.listSiblings,
    profile ? { studentId: profile._id } : "skip",
  );
  const threads = useQuery(
    api.social.listThreads,
    profile ? { studentId: profile._id } : "skip",
  );
  const progress = useQuery(
    api.social.getProgress,
    profile ? { studentId: profile._id } : "skip",
  );
  const catalog = useQuery(
    api.social.listCatalog,
    profile ? { studentId: profile._id } : "skip",
  );
  const recent = useQuery(
    api.social.listRecentForStudent,
    profile ? { studentId: profile._id, limit: 6 } : "skip",
  );

  const ensureProfile = useMutation(api.social.ensureProfile);
  const seedCatalog = useMutation(api.social.seedCatalog);
  const sendKudos = useMutation(api.social.sendKudos);
  const softDelete = useMutation(api.social.softDeleteMessage);
  const updateMessage = useMutation(api.social.updateMessage);
  const updateCustomization = useMutation(api.social.updateCustomization);

  const [activeThreadId, setActiveThreadId] =
    useState<Id<"socialThreads"> | null>(null);
  const [toStudentId, setToStudentId] = useState("");
  const [kind, setKind] = useState<CheerKind>("encourage");
  const [body, setBody] = useState("");
  const [stickerKey, setStickerKey] = useState("");
  const [publicToFeed, setPublicToFeed] = useState(true);
  const [editId, setEditId] = useState<Id<"socialMessages"> | null>(null);
  const [editBody, setEditBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">(
    "info",
  );
  const [busy, setBusy] = useState(false);

  const celebrate = Boolean(recent && recent.length > 0);

  const messages = useQuery(
    api.social.listMessages,
    profile && activeThreadId
      ? { studentId: profile._id, threadId: activeThreadId }
      : "skip",
  );

  useEffect(() => {
    if (!profile) return;
    void ensureProfile({ studentId: profile._id }).catch(() => {
      // profile will create on first send
    });
  }, [profile, ensureProfile]);

  useEffect(() => {
    // Stickers & encourage default to wall; motivate stays private unless opted in.
    setPublicToFeed(
      kind === "sticker" || kind === "encourage" || kind === "congratulate",
    );
  }, [kind]);

  function notify(text: string, tone: "info" | "error" | "success" = "success") {
    setMessage(text);
    setMessageTone(tone);
  }

  async function onSeed() {
    setBusy(true);
    try {
      const result = await seedCatalog({});
      notify(
        `Stickers ready (${result.packs} packs, ${result.stickers} stickers).`,
        "success",
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (!profile || !toStudentId) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await sendKudos({
        fromStudentId: profile._id,
        toStudentId: toStudentId as Id<"students">,
        kind,
        body: body.trim() || undefined,
        stickerKey: stickerKey || undefined,
        publicToFeed,
        today: week.today,
        weekStart: week.weekStart,
      });
      setBody("");
      setStickerKey("");
      setActiveThreadId(result.threadId);
      setTab(publicToFeed ? "wall" : "inbox");
      const unlockNote =
        result.newUnlocks.length > 0
          ? ` Unlocked: ${result.newUnlocks.length} new item(s)!`
          : "";
      const wallNote = result.feedPostId
        ? " Celebrated on the family wall."
        : "";
      notify(
        `Cheer sent · +${result.xpGained} XP · +${result.pointsGained} pts.${unlockNote}${wallNote}`,
        "success",
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEdit() {
    if (!profile || !editId) return;
    setBusy(true);
    try {
      await updateMessage({
        studentId: profile._id,
        messageId: editId,
        body: editBody,
      });
      setEditId(null);
      setEditBody("");
      notify("Message updated.", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setBusy(false);
    }
  }

  if (
    (viewAsStudentId && viewAsContext === undefined) ||
    (!viewAsStudentId && myProfile === undefined)
  ) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (!profile) {
    return (
      <div className="page-stack">
        <PageHeader
          compact
          eyebrow="Cheer Hub"
          title="Encouragement Circle"
          description="Link your student profile to cheer your siblings."
        />
        <Link href={withViewAs("/student/dashboard", viewAsStudentId)}>
          <Button variant="secondary">Back to Today</Button>
        </Link>
      </div>
    );
  }

  const themeKey = progress?.customization.themeKey ?? "default";
  const bubbleKey = progress?.customization.bubbleKey ?? "classic";
  const frameKey = progress?.customization.frameKey ?? "none";

  return (
    <div
      className={cn(
        "page-stack cheer-hub",
        `cheer-theme-${themeKey}`,
        celebrate && "cheer-celebrate",
      )}
    >
      <PageHeader
        compact
        eyebrow="Encouragement Circle"
        title="Cheer Hub"
        description="Send kindness to siblings. No rankings — just warmth, stickers, and unlocks you earn by cheering."
        actions={
          <Link href={withViewAs("/student/dashboard", viewAsStudentId)}>
            <Button variant="secondary" size="sm">
              Dashboard
            </Button>
          </Link>
        }
      />

      {celebrate ? (
        <div className="cheer-banner animate-fade-up" role="status">
          You have cheers waiting — open Inbox to enjoy them.
        </div>
      ) : null}

      <Message tone={messageTone}>{message}</Message>

      {progress ? (
        <div className="cheer-stats">
          <div>
            <p className="cheer-stat-value">{progress.stats.kindnessGiven}</p>
            <p className="cheer-stat-label">Kindness given</p>
          </div>
          <div>
            <p className="cheer-stat-value">{progress.stats.kindnessReceived}</p>
            <p className="cheer-stat-label">Cheers received</p>
          </div>
          <div>
            <p className="cheer-stat-value">{progress.stats.stickersSent}</p>
            <p className="cheer-stat-label">Stickers shared</p>
          </div>
        </div>
      ) : null}

      <Tabs
        tabs={[
          { id: "wall", label: "Wall" },
          { id: "inbox", label: "Inbox" },
          { id: "send", label: "Send kudos" },
          { id: "stickers", label: "Stickers" },
          { id: "customize", label: "Customize" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <TabPanel id="wall" active={tab === "wall"}>
        {profile.familyId || family?._id ? (
          <FamilyWallFeed
            familyId={(family?._id ?? profile.familyId) as Id<"families">}
            viewerStudentId={profile._id}
            canCompose
          />
        ) : (
          <EmptyState>Family wall will appear once your family is linked.</EmptyState>
        )}
      </TabPanel>

      <TabPanel id="inbox" active={tab === "inbox"}>
        <div className="cheer-inbox">
          <Section title="Conversations" description="Sibling threads in your family.">
            {!threads ? (
              <p className="text-sm text-[var(--muted)]">Loading…</p>
            ) : threads.length === 0 ? (
              <EmptyState>
                No cheers yet. Send the first kudos to a sibling.
              </EmptyState>
            ) : (
              <ul className="space-y-1.5">
                {threads.map((t) => (
                  <li key={t.thread._id}>
                    <button
                      type="button"
                      className={cn(
                        "list-row list-row-dense w-full text-left",
                        activeThreadId === t.thread._id && "cheer-thread-active",
                      )}
                      onClick={() => setActiveThreadId(t.thread._id)}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={cn("cheer-avatar-wrap", `cheer-frame-${frameKey}`)}>
                          <StudentAvatar
                            studentId={t.peer._id}
                            imageStorageId={t.peer.imageStorageId}
                            name={t.peer.displayName}
                            size="sm"
                          />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium">
                            {t.peer.displayName}
                          </span>
                          <span className="block truncate text-xs text-[var(--muted)]">
                            {t.lastMessage?.body ??
                              (t.lastMessage?.stickerKey
                                ? "Sticker"
                                : "Say hello")}
                          </span>
                        </span>
                      </span>
                      {t.lastMessage ? (
                        <span className="text-xs text-[var(--muted-fg)]">
                          {formatWhen(t.lastMessage.createdAt)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Thread"
            description={
              activeThreadId
                ? "Encourage, motivate, congratulate — edit or remove your own notes."
                : "Pick a conversation."
            }
          >
            {!activeThreadId ? (
              <EmptyState>Select a sibling thread.</EmptyState>
            ) : !messages ? (
              <p className="text-sm text-[var(--muted)]">Loading…</p>
            ) : messages.length === 0 ? (
              <EmptyState>No messages in this thread yet.</EmptyState>
            ) : (
              <ul className="space-y-2">
                {messages.map(({ message: m, fromName, stickerEmoji }) => {
                  const mine = m.fromStudentId === profile._id;
                  return (
                    <li
                      key={m._id}
                      className={cn(
                        "cheer-bubble",
                        `cheer-bubble-${bubbleKey}`,
                        mine ? "cheer-bubble-mine" : "cheer-bubble-theirs",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-[var(--muted)]">
                          {fromName}
                        </span>
                        <Badge tone={kindTone(m.kind)}>{m.kind}</Badge>
                        <span className="text-xs text-[var(--muted-fg)]">
                          {formatWhen(m.createdAt)}
                        </span>
                      </div>
                      {stickerEmoji ? (
                        <p className="cheer-sticker-emoji" aria-hidden>
                          {stickerEmoji}
                        </p>
                      ) : null}
                      {editId === m._id ? (
                        <div className="mt-2 space-y-2">
                          <Textarea
                            value={editBody}
                            onChange={(e) => setEditBody(e.target.value)}
                            rows={2}
                            maxLength={280}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() => void onSaveEdit()}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : m.body ? (
                        <p className="mt-1 text-sm">{m.body}</p>
                      ) : null}
                      {mine ? (
                        <div className="mt-2 flex gap-1.5">
                          {m.body ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditId(m._id);
                                setEditBody(m.body ?? "");
                              }}
                            >
                              Edit
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void softDelete({
                                studentId: profile._id,
                                messageId: m._id,
                              })
                                .then(() => notify("Removed.", "info"))
                                .catch((err) =>
                                  notify(
                                    err instanceof Error
                                      ? err.message
                                      : "Failed",
                                    "error",
                                  ),
                                )
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>
      </TabPanel>

      <TabPanel id="send" active={tab === "send"}>
        <Section
          title="Send kudos"
          description="Same-family siblings only. Generosity earns XP and unlocks."
        >
          {!siblings || siblings.length === 0 ? (
            <EmptyState>
              Add another student in your family to start cheering each other.
            </EmptyState>
          ) : (
            <form onSubmit={(e) => void onSend(e)} className="cheer-send-form">
              <Select
                label="To"
                value={toStudentId}
                onChange={(e) => setToStudentId(e.target.value)}
                required
              >
                <option value="">Choose a sibling</option>
                {siblings.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.displayName}
                  </option>
                ))}
              </Select>

              <div>
                <p className="mb-1.5 text-sm font-medium">Kind of cheer</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      "encourage",
                      "motivate",
                      "congratulate",
                      "sticker",
                    ] as CheerKind[]
                  ).map((k) => (
                    <button
                      key={k}
                      type="button"
                      className={cn(
                        "cheer-kind-chip",
                        kind === k && "cheer-kind-chip-active",
                      )}
                      onClick={() => setKind(k)}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>

              {kind !== "sticker" && progress ? (
                <div>
                  <p className="mb-1.5 text-sm font-medium">Suggested notes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {progress.presets[kind].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className="cheer-preset"
                        onClick={() => setBody(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {kind !== "sticker" ? (
                <Textarea
                  label="Your note"
                  rows={3}
                  maxLength={280}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write something warm…"
                />
              ) : (
                <Textarea
                  label="Optional note"
                  rows={2}
                  maxLength={280}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Add a short note with your sticker"
                />
              )}

              <div>
                <p className="mb-1.5 text-sm font-medium">
                  {kind === "sticker" ? "Sticker" : "Optional sticker"}
                </p>
                {!catalog || catalog.length === 0 ? (
                  <div className="space-y-2">
                    <EmptyState>
                      Sticker catalog not seeded yet.
                    </EmptyState>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => void onSeed()}
                    >
                      Seed stickers
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {catalog.map((pack) => (
                      <div key={pack.packKey}>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                          {pack.title}
                          {!pack.unlocked ? " · locked" : ""}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {pack.stickers.map((s) => (
                            <button
                              key={s.stickerKey}
                              type="button"
                              disabled={!pack.unlocked}
                              title={
                                pack.unlocked
                                  ? s.label
                                  : `${s.label} (locked)`
                              }
                              className={cn(
                                "cheer-sticker-btn",
                                stickerKey === s.stickerKey &&
                                  "cheer-sticker-btn-active",
                                !pack.unlocked && "opacity-40",
                              )}
                              onClick={() =>
                                setStickerKey(
                                  stickerKey === s.stickerKey
                                    ? ""
                                    : s.stickerKey,
                                )
                              }
                            >
                              <span aria-hidden>{s.emoji}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={publicToFeed}
                  onChange={(e) => setPublicToFeed(e.target.checked)}
                />
                <span>
                  Celebrate on the family wall
                  <span className="block text-xs text-[var(--muted)]">
                    Family-only. Uncheck to keep this cheer in your private
                    sibling thread.
                  </span>
                </span>
              </label>

              <Button type="submit" disabled={busy || !toStudentId}>
                Send cheer
              </Button>
            </form>
          )}
        </Section>
      </TabPanel>

      <TabPanel id="stickers" active={tab === "stickers"}>
        <Section
          title="Sticker packs"
          description="Unlock more by giving kindness — not by competing."
          action={
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void onSeed()}
            >
              Refresh catalog
            </Button>
          }
        >
          {!catalog ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : catalog.length === 0 ? (
            <EmptyState>
              No packs yet.{" "}
              <Button size="sm" onClick={() => void onSeed()}>
                Seed stickers
              </Button>
            </EmptyState>
          ) : (
            <div className="space-y-4">
              {catalog.map((pack) => (
                <div key={pack.packKey} className="cheer-pack">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{pack.title}</p>
                      <p className="text-sm text-[var(--muted)]">
                        {pack.description}
                      </p>
                    </div>
                    <Badge tone={pack.unlocked ? "success" : "neutral"}>
                      {pack.unlocked ? "Unlocked" : "Locked"}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pack.stickers.map((s) => (
                      <span
                        key={s.stickerKey}
                        className="cheer-sticker-btn"
                        title={s.label}
                      >
                        {s.emoji}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {progress ? (
          <Section title="Unlock path" description="Personal progress — never ranked against siblings.">
            <ul className="space-y-2">
              {progress.unlocks.map((u) => (
                <li key={u.unlockKey} className="cheer-unlock-row">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {u.title}{" "}
                      {u.unlocked ? (
                        <Badge tone="success">Unlocked</Badge>
                      ) : null}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {u.criterionLabel} · {u.progress}/{u.target}
                    </p>
                    <div className="cheer-progress-track mt-1.5">
                      <div
                        className="cheer-progress-fill"
                        style={{
                          width: `${Math.round((u.progress / u.target) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </TabPanel>

      <TabPanel id="customize" active={tab === "customize"}>
        <Section
          title="Your look"
          description="Customization is yours. Parents can see unlocks, but you choose the style."
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
                      onClick={() =>
                        void updateCustomization({
                          studentId: profile._id,
                          themeKey: t.key,
                        })
                          .then(() => notify(`Theme: ${t.label}`, "success"))
                          .catch((err) =>
                            notify(
                              err instanceof Error ? err.message : "Failed",
                              "error",
                            ),
                          )
                      }
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
                      onClick={() =>
                        void updateCustomization({
                          studentId: profile._id,
                          frameKey: t.key,
                        })
                          .then(() => notify(`Frame: ${t.label}`, "success"))
                          .catch((err) =>
                            notify(
                              err instanceof Error ? err.message : "Failed",
                              "error",
                            ),
                          )
                      }
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
                      onClick={() =>
                        void updateCustomization({
                          studentId: profile._id,
                          bubbleKey: t.key,
                        })
                          .then(() => notify(`Bubble: ${t.label}`, "success"))
                          .catch((err) =>
                            notify(
                              err instanceof Error ? err.message : "Failed",
                              "error",
                            ),
                          )
                      }
                    >
                      <span className="font-medium">{t.label}</span>
                      <span className="block text-xs text-[var(--muted)]">
                        {t.unlocked ? t.description : "Locked"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Section>
      </TabPanel>
    </div>
  );
}

export default function StudentSocialPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <StudentSocialInner />
    </Suspense>
  );
}
