"use client";

import {
  FormEvent,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import Link from "next/link";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { StudentAvatar } from "@/components/StudentAvatar";
import {
  Badge,
  Button,
  EmptyState,
  Message,
  Section,
  Textarea,
} from "@/components/ui";
import { cn } from "@/lib/cn";

const REACTIONS = [
  { type: "like" as const, emoji: "👍", label: "Like" },
  { type: "love" as const, emoji: "❤️", label: "Love" },
  { type: "celebrate" as const, emoji: "🎉", label: "Celebrate" },
  { type: "support" as const, emoji: "💪", label: "Support" },
  { type: "funny" as const, emoji: "😄", label: "Funny" },
];

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

function typeTone(
  type: string,
): "success" | "neutral" | "warning" | "accent" {
  switch (type) {
    case "badge_earned":
    case "level_up":
    case "accolade":
      return "success";
    case "chore_done":
    case "log_completed":
      return "accent";
    case "sticker":
    case "kudos":
    case "recheer":
      return "warning";
    default:
      return "neutral";
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case "kudos":
      return "Cheer";
    case "sticker":
      return "Sticker";
    case "log_completed":
      return "Learning";
    case "chore_done":
      return "Chore";
    case "badge_earned":
      return "Badge";
    case "level_up":
      return "Level";
    case "accolade":
      return "Accolade";
    case "recheer":
      return "Re-cheer";
    case "general":
      return "Note";
    default:
      return type;
  }
}

type FamilyWallFeedProps = {
  familyId: Id<"families">;
  viewerStudentId?: Id<"students">;
  canModerate?: boolean;
  canCompose?: boolean;
  /** Teacher composing a cheer for a specific student. */
  defaultTargetStudentId?: Id<"students">;
  className?: string;
};

export function FamilyWallFeed({
  familyId,
  viewerStudentId,
  canModerate = false,
  canCompose = false,
  defaultTargetStudentId,
  className,
}: FamilyWallFeedProps) {
  const me = useQuery(api.users.current);
  const [now] = useState(() => Date.now());
  const { results, status, loadMore } = usePaginatedQuery(
    api.feed.list,
    { familyId, asStudentId: viewerStudentId },
    { initialNumItems: 20 },
  );
  const cheerOfDay = useQuery(api.feed.cheerOfTheDay, { familyId, now });
  const stickers = useQuery(api.feed.listStickersForWall, { familyId });
  const students = useQuery(api.students.listForFamily, { familyId });

  const createPost = useMutation(api.feed.create);
  const updatePost = useMutation(api.feed.update);
  const removePost = useMutation(api.feed.remove);
  const setPinned = useMutation(api.feed.setPinned);
  const setReaction = useMutation(api.feed.setReaction);
  const removeReaction = useMutation(api.feed.removeReaction);
  const recheer = useMutation(api.feed.recheer);
  const generateUploadUrl = useMutation(api.feed.generateUploadUrl);
  const markWallRead = useMutation(api.feed.markWallRead);

  const [composeTitle, setComposeTitle] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeSticker, setComposeSticker] = useState("");
  const [composeTarget, setComposeTarget] = useState<Id<"students"> | "">("");
  const [composeFile, setComposeFile] = useState<File | null>(null);
  const [editId, setEditId] = useState<Id<"feedPosts"> | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [expandedComments, setExpandedComments] = useState<
    Record<string, boolean>
  >({});
  const [reactionOpen, setReactionOpen] = useState<Id<"feedPosts"> | null>(
    null,
  );
  const [whoReacted, setWhoReacted] = useState<Id<"feedPosts"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">(
    "info",
  );
  const markedRead = useRef(false);

  useEffect(() => {
    if (markedRead.current) return;
    markedRead.current = true;
    void markWallRead({ familyId }).catch(() => {
      /* ignore */
    });
  }, [familyId, markWallRead]);

  const selectedTarget =
    composeTarget || defaultTargetStudentId || ("" as Id<"students"> | "");

  function notify(text: string, tone: "info" | "error" | "success" = "success") {
    setMessage(text);
    setMessageTone(tone);
  }

  function canManage(post: {
    actorStudentId?: Id<"students">;
    createdByUserId?: Id<"users">;
  }): boolean {
    if (canModerate) return true;
    if (me && post.createdByUserId === me._id) return true;
    if (viewerStudentId && post.actorStudentId === viewerStudentId) return true;
    return false;
  }

  async function uploadImage(file: File): Promise<Id<"_storage">> {
    const uploadUrl = await generateUploadUrl({});
    const result = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!result.ok) throw new Error("Photo upload failed");
    const json = (await result.json()) as { storageId: Id<"_storage"> };
    return json.storageId;
  }

  async function onCompose(e: FormEvent) {
    e.preventDefault();
    if (!composeTitle.trim()) return;
    setBusy(true);
    try {
      let imageStorageId: Id<"_storage"> | undefined;
      if (composeFile) imageStorageId = await uploadImage(composeFile);
      await createPost({
        familyId,
        type: composeSticker ? "sticker" : "general",
        actorStudentId: viewerStudentId,
        targetStudentId: selectedTarget || undefined,
        title: composeTitle,
        body: composeBody.trim() || undefined,
        stickerKey: composeSticker || undefined,
        imageStorageId,
        href: "/family/cheers?tab=wall",
      });
      setComposeTitle("");
      setComposeBody("");
      setComposeSticker("");
      setComposeFile(null);
      notify("Posted to the family wall.", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEdit() {
    if (!editId) return;
    setBusy(true);
    try {
      await updatePost({
        postId: editId,
        title: editTitle,
        body: editBody,
      });
      setEditId(null);
      notify("Post updated.", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onReact(
    postId: Id<"feedPosts">,
    type: (typeof REACTIONS)[number]["type"],
    current: string | null,
  ) {
    try {
      if (current === type) {
        await removeReaction({ postId, asStudentId: viewerStudentId });
      } else {
        await setReaction({
          postId,
          type,
          asStudentId: viewerStudentId,
        });
      }
      setReactionOpen(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  const mentionHint =
    students && students.length > 0
      ? `Try @${students[0]!.displayName} to mention a sibling`
      : "Family-only — warm notes for everyone at home.";

  return (
    <div className={cn("space-y-4", className)}>
      <Message tone={messageTone}>{message}</Message>

      {cheerOfDay ? (
        <div className="cheer-of-day">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
            Cheer of the day
          </p>
          <p className="mt-1 text-sm font-medium">
            {cheerOfDay.stickerEmoji ? (
              <span className="mr-1.5 text-lg" aria-hidden>
                {cheerOfDay.stickerEmoji}
              </span>
            ) : null}
            {cheerOfDay.post.title}
          </p>
          {cheerOfDay.actorName ? (
            <p className="mt-0.5 text-xs text-[var(--muted-fg)]">
              {cheerOfDay.actorName}
              {cheerOfDay.reactionSummary.length > 0
                ? ` · ${cheerOfDay.reactionSummary.map((r) => `${r.emoji}${r.count}`).join(" ")}`
                : null}
            </p>
          ) : null}
        </div>
      ) : null}

      {canCompose ? (
        <Section
          title="Share a celebration"
          description={mentionHint}
        >
          <form onSubmit={(e) => void onCompose(e)} className="space-y-3">
            <Textarea
              label="Headline"
              rows={1}
              maxLength={160}
              value={composeTitle}
              onChange={(e) => setComposeTitle(e.target.value)}
              placeholder="Something to celebrate…"
              required
            />
            <Textarea
              label="Optional note"
              rows={2}
              maxLength={500}
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              placeholder="A little more warmth… mention siblings with @Name"
            />
            {students && students.length > 0 && !viewerStudentId ? (
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--muted)]">
                  Cheer for (optional)
                </span>
                <select
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                  value={selectedTarget}
                  onChange={(e) =>
                    setComposeTarget(
                      (e.target.value || "") as Id<"students"> | "",
                    )
                  }
                >
                  <option value="">Whole family</option>
                  {students.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.displayName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {stickers && stickers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {stickers.slice(0, 16).map((s) => (
                  <button
                    key={s.stickerKey}
                    type="button"
                    title={s.label}
                    className={cn(
                      "cheer-sticker-btn text-lg",
                      composeSticker === s.stickerKey &&
                        "cheer-sticker-btn-active",
                    )}
                    onClick={() =>
                      setComposeSticker(
                        composeSticker === s.stickerKey ? "" : s.stickerKey,
                      )
                    }
                  >
                    {s.emoji}
                  </button>
                ))}
              </div>
            ) : null}
            <label className="block text-sm text-[var(--muted)]">
              Photo (optional)
              <input
                type="file"
                accept="image/*"
                className="mt-1 block w-full text-xs"
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setComposeFile(e.target.files?.[0] ?? null)
                }
              />
            </label>
            <Button type="submit" size="sm" disabled={busy || !composeTitle.trim()}>
              Post to wall
            </Button>
          </form>
        </Section>
      ) : null}

      <Section
        title="Family wall"
        description="Cheers, finished work, badges, and celebrations — visible only to your circle."
      >
        {status === "LoadingFirstPage" ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : results.length === 0 ? (
          <EmptyState>
            The wall is quiet for now. Send a cheer or finish something to
            celebrate together.
          </EmptyState>
        ) : (
          <ul className="space-y-2.5">
            {results.map((item) => {
              const {
                post,
                actorName,
                targetName,
                actorImageStorageId,
                stickerEmoji,
                imageUrl,
                reactionSummary,
                reactionActors,
                myReaction,
                commentCount,
                originalPreview,
              } = item;
              const manage = canManage(post);
              const commentsOpen = !!expandedComments[post._id];
              return (
                <li
                  key={post._id}
                  className={cn(
                    "family-wall-item",
                    post.pinnedAt ? "family-wall-item-pinned" : undefined,
                  )}
                >
                  <div className="flex gap-3">
                    <div className="shrink-0 pt-0.5">
                      {post.actorStudentId ? (
                        <StudentAvatar
                          studentId={post.actorStudentId}
                          imageStorageId={actorImageStorageId}
                          name={actorName ?? "Student"}
                          size="sm"
                        />
                      ) : (
                        <div
                          className="family-wall-avatar-fallback"
                          aria-hidden
                        >
                          ✦
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {post.pinnedAt ? (
                          <Badge tone="accent">Pinned</Badge>
                        ) : null}
                        <Badge tone={typeTone(post.type)}>
                          {typeLabel(post.type)}
                        </Badge>
                        <span className="text-xs text-[var(--muted-fg)]">
                          {formatWhen(post.createdAt)}
                        </span>
                      </div>

                      {post.isRecheer || post.type === "recheer" ? (
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Re-cheered by {actorName ?? "someone"}
                        </p>
                      ) : null}

                      {editId === post._id ? (
                        <div className="mt-2 space-y-2">
                          <Textarea
                            rows={1}
                            maxLength={160}
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                          />
                          <Textarea
                            rows={2}
                            maxLength={500}
                            value={editBody}
                            onChange={(e) => setEditBody(e.target.value)}
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
                      ) : (
                        <>
                          <p className="mt-1 text-sm font-medium leading-snug">
                            {stickerEmoji ? (
                              <span className="mr-1.5 text-lg" aria-hidden>
                                {stickerEmoji}
                              </span>
                            ) : null}
                            {post.title}
                          </p>
                          {post.body ? (
                            <p className="mt-0.5 text-sm text-[var(--muted)]">
                              {post.body}
                            </p>
                          ) : null}
                          {imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imageUrl}
                              alt=""
                              className="family-wall-photo mt-2"
                            />
                          ) : null}
                          {originalPreview ? (
                            <div className="family-wall-original mt-2">
                              <p className="text-xs text-[var(--muted-fg)]">
                                Original
                                {originalPreview.actorName
                                  ? ` · ${originalPreview.actorName}`
                                  : ""}
                              </p>
                              <p className="mt-0.5 text-sm font-medium">
                                {originalPreview.stickerEmoji ? (
                                  <span className="mr-1" aria-hidden>
                                    {originalPreview.stickerEmoji}
                                  </span>
                                ) : null}
                                {originalPreview.title}
                              </p>
                              {originalPreview.body ? (
                                <p className="text-xs text-[var(--muted)]">
                                  {originalPreview.body}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                          {actorName &&
                          targetName &&
                          post.type !== "accolade" &&
                          post.type !== "recheer" ? (
                            <p className="mt-1 text-xs text-[var(--muted-fg)]">
                              {actorName}
                              {targetName !== actorName
                                ? ` → ${targetName}`
                                : null}
                            </p>
                          ) : null}
                        </>
                      )}

                      {/* Reaction bar */}
                      {editId !== post._id ? (
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          <div className="relative">
                            <Button
                              size="sm"
                              variant="ghost"
                              className={cn(
                                myReaction && "text-[var(--accent)]",
                              )}
                              onClick={() =>
                                setReactionOpen(
                                  reactionOpen === post._id ? null : post._id,
                                )
                              }
                            >
                              {myReaction
                                ? REACTIONS.find((r) => r.type === myReaction)
                                    ?.emoji
                                : "☺"}{" "}
                              React
                            </Button>
                            {reactionOpen === post._id ? (
                              <div
                                className="reaction-picker"
                                role="listbox"
                                aria-label="Choose a reaction"
                              >
                                {REACTIONS.map((r) => (
                                  <button
                                    key={r.type}
                                    type="button"
                                    className={cn(
                                      "reaction-picker-btn",
                                      myReaction === r.type &&
                                        "reaction-picker-btn-active",
                                    )}
                                    title={r.label}
                                    onClick={() =>
                                      void onReact(
                                        post._id,
                                        r.type,
                                        myReaction,
                                      )
                                    }
                                  >
                                    <span aria-hidden>{r.emoji}</span>
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>

                          {reactionSummary.length > 0 ? (
                            <button
                              type="button"
                              className="reaction-counts"
                              onClick={() =>
                                setWhoReacted(
                                  whoReacted === post._id ? null : post._id,
                                )
                              }
                            >
                              {reactionSummary.map((r) => (
                                <span key={r.type}>
                                  {r.emoji}
                                  <span className="ml-0.5">{r.count}</span>
                                </span>
                              ))}
                            </button>
                          ) : null}

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setExpandedComments((prev) => ({
                                ...prev,
                                [post._id]: !prev[post._id],
                              }))
                            }
                          >
                            💬 {commentCount > 0 ? commentCount : "Comment"}
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => {
                              void recheer({
                                postId: post._id,
                                asStudentId: viewerStudentId,
                              })
                                .then(() =>
                                  notify("Re-cheered to your wall!", "success"),
                                )
                                .catch((err) =>
                                  notify(
                                    err instanceof Error
                                      ? err.message
                                      : "Failed",
                                    "error",
                                  ),
                                );
                            }}
                          >
                            🔁 Re-cheer
                          </Button>

                          {post.href ? (
                            <Link href={post.href}>
                              <Button size="sm" variant="ghost">
                                Open
                              </Button>
                            </Link>
                          ) : null}

                          {canModerate ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                void setPinned({
                                  postId: post._id,
                                  pinned: !post.pinnedAt,
                                })
                                  .then(() =>
                                    notify(
                                      post.pinnedAt
                                        ? "Unpinned."
                                        : "Pinned to top.",
                                      "success",
                                    ),
                                  )
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
                              {post.pinnedAt ? "Unpin" : "Pin"}
                            </Button>
                          ) : null}

                          {manage ? (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditId(post._id);
                                  setEditTitle(post.title);
                                  setEditBody(post.body ?? "");
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      "Remove this from the family wall?",
                                    )
                                  ) {
                                    return;
                                  }
                                  void removePost({ postId: post._id })
                                    .then(() =>
                                      notify("Removed from the wall.", "info"),
                                    )
                                    .catch((err) =>
                                      notify(
                                        err instanceof Error
                                          ? err.message
                                          : "Failed",
                                        "error",
                                      ),
                                    );
                                }}
                              >
                                Remove
                              </Button>
                            </>
                          ) : null}
                        </div>
                      ) : null}

                      {whoReacted === post._id && reactionActors.length > 0 ? (
                        <ul className="mt-2 space-y-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)]">
                          {reactionActors.map((a, i) => (
                            <li key={`${a.name}-${a.type}-${i}`}>
                              {a.emoji} {a.name}
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {commentsOpen ? (
                        <PostComments
                          postId={post._id}
                          viewerStudentId={viewerStudentId}
                          canModerate={canModerate}
                          stickers={stickers ?? []}
                          meId={me?._id}
                          onNotify={notify}
                        />
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {status === "CanLoadMore" || status === "LoadingMore" ? (
          <div className="mt-3">
            <Button
              size="sm"
              variant="secondary"
              disabled={status === "LoadingMore"}
              onClick={() => loadMore(20)}
            >
              {status === "LoadingMore" ? "Loading…" : "Load more"}
            </Button>
          </div>
        ) : null}
      </Section>
    </div>
  );
}

function PostComments({
  postId,
  viewerStudentId,
  canModerate,
  stickers,
  meId,
  onNotify,
}: {
  postId: Id<"feedPosts">;
  viewerStudentId?: Id<"students">;
  canModerate: boolean;
  stickers: Array<{ stickerKey: string; label: string; emoji: string }>;
  meId?: Id<"users">;
  onNotify: (text: string, tone?: "info" | "error" | "success") => void;
}) {
  const comments = useQuery(api.feed.listComments, { postId });
  const addComment = useMutation(api.feed.addComment);
  const updateComment = useMutation(api.feed.updateComment);
  const removeComment = useMutation(api.feed.removeComment);
  const [body, setBody] = useState("");
  const [stickerKey, setStickerKey] = useState("");
  const [editId, setEditId] = useState<Id<"feedComments"> | null>(null);
  const [editBody, setEditBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim() && !stickerKey) return;
    setBusy(true);
    try {
      await addComment({
        postId,
        body: body.trim() || "✨",
        stickerKey: stickerKey || undefined,
        asStudentId: viewerStudentId,
      });
      setBody("");
      setStickerKey("");
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
      {comments === undefined ? (
        <p className="text-xs text-[var(--muted)]">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">
          Be the first to leave a warm note.
        </p>
      ) : (
        <ul className="space-y-2">
          {comments.map(({ comment, authorName, authorImageStorageId, stickerEmoji }) => {
            const canEdit =
              canModerate ||
              (meId && comment.authorUserId === meId) ||
              (viewerStudentId && comment.authorStudentId === viewerStudentId);
            return (
              <li key={comment._id} className="flex gap-2 text-sm">
                {comment.authorStudentId ? (
                  <StudentAvatar
                    studentId={comment.authorStudentId}
                    imageStorageId={authorImageStorageId}
                    name={authorName}
                    size="sm"
                  />
                ) : (
                  <div className="family-wall-avatar-fallback" aria-hidden>
                    ✦
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">
                    {authorName}{" "}
                    <span className="font-normal text-[var(--muted-fg)]">
                      {formatWhen(comment.createdAt)}
                    </span>
                  </p>
                  {editId === comment._id ? (
                    <div className="mt-1 space-y-1">
                      <Textarea
                        rows={2}
                        maxLength={400}
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                      />
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            void updateComment({
                              commentId: comment._id,
                              body: editBody,
                            })
                              .then(() => setEditId(null))
                              .catch((err) =>
                                onNotify(
                                  err instanceof Error
                                    ? err.message
                                    : "Failed",
                                  "error",
                                ),
                              );
                          }}
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
                  ) : (
                    <p className="text-[var(--fg)]">
                      {stickerEmoji ? (
                        <span className="mr-1" aria-hidden>
                          {stickerEmoji}
                        </span>
                      ) : null}
                      {comment.body}
                    </p>
                  )}
                  {canEdit && editId !== comment._id ? (
                    <div className="mt-0.5 flex gap-2">
                      <button
                        type="button"
                        className="text-xs text-[var(--muted)] hover:text-[var(--fg)]"
                        onClick={() => {
                          setEditId(comment._id);
                          setEditBody(comment.body);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-xs text-[var(--muted)] hover:text-[var(--fg)]"
                        onClick={() => {
                          if (!window.confirm("Delete this comment?")) return;
                          void removeComment({ commentId: comment._id }).catch(
                            (err) =>
                              onNotify(
                                err instanceof Error ? err.message : "Failed",
                                "error",
                              ),
                          );
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-2">
        <Textarea
          rows={2}
          maxLength={400}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Leave a kind comment…"
        />
        {stickers.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {stickers.slice(0, 12).map((s) => (
              <button
                key={s.stickerKey}
                type="button"
                className={cn(
                  "cheer-sticker-btn text-base",
                  stickerKey === s.stickerKey && "cheer-sticker-btn-active",
                )}
                title={s.label}
                onClick={() =>
                  setStickerKey(
                    stickerKey === s.stickerKey ? "" : s.stickerKey,
                  )
                }
              >
                {s.emoji}
              </button>
            ))}
          </div>
        ) : null}
        <Button
          type="submit"
          size="sm"
          disabled={busy || (!body.trim() && !stickerKey)}
        >
          Comment
        </Button>
      </form>
    </div>
  );
}
