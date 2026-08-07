"use client";

import { FormEvent, useState } from "react";
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
    case "general":
      return "Note";
    default:
      return type;
  }
}

type FamilyWallFeedProps = {
  familyId: Id<"families">;
  /** When set, student can delete/edit their own posts. */
  viewerStudentId?: Id<"students">;
  /** Parent moderation + compose. */
  canModerate?: boolean;
  canCompose?: boolean;
  className?: string;
};

export function FamilyWallFeed({
  familyId,
  viewerStudentId,
  canModerate = false,
  canCompose = false,
  className,
}: FamilyWallFeedProps) {
  const me = useQuery(api.users.current);
  const { results, status, loadMore } = usePaginatedQuery(
    api.feed.list,
    { familyId },
    { initialNumItems: 20 },
  );

  const createPost = useMutation(api.feed.create);
  const updatePost = useMutation(api.feed.update);
  const removePost = useMutation(api.feed.remove);

  const [composeTitle, setComposeTitle] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [editId, setEditId] = useState<Id<"feedPosts"> | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">(
    "info",
  );

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

  async function onCompose(e: FormEvent) {
    e.preventDefault();
    if (!composeTitle.trim()) return;
    setBusy(true);
    try {
      await createPost({
        familyId,
        type: "general",
        actorStudentId: viewerStudentId,
        title: composeTitle,
        body: composeBody.trim() || undefined,
        href: "/family/cheers?tab=wall",
      });
      setComposeTitle("");
      setComposeBody("");
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

  return (
    <div className={cn("space-y-4", className)}>
      <Message tone={messageTone}>{message}</Message>

      {canCompose ? (
        <Section
          title="Share a celebration"
          description="Family-only — warm notes for everyone at home."
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
              placeholder="A little more warmth…"
            />
            <Button type="submit" size="sm" disabled={busy || !composeTitle.trim()}>
              Post to wall
            </Button>
          </form>
        </Section>
      ) : null}

      <Section
        title="Family wall"
        description="Cheers, finished work, badges, and celebrations — visible only to your family."
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
            {results.map(
              ({
                post,
                actorName,
                targetName,
                actorImageStorageId,
                stickerEmoji,
              }) => {
                const manage = canManage(post);
                return (
                  <li key={post._id} className="family-wall-item">
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
                          <div className="family-wall-avatar-fallback" aria-hidden>
                            ✦
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={typeTone(post.type)}>
                            {typeLabel(post.type)}
                          </Badge>
                          <span className="text-xs text-[var(--muted-fg)]">
                            {formatWhen(post.createdAt)}
                          </span>
                        </div>

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
                            {actorName && targetName && post.type !== "accolade" ? (
                              <p className="mt-1 text-xs text-[var(--muted-fg)]">
                                {actorName}
                                {targetName !== actorName
                                  ? ` → ${targetName}`
                                  : null}
                              </p>
                            ) : null}
                          </>
                        )}

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {post.href && editId !== post._id ? (
                            <Link href={post.href}>
                              <Button size="sm" variant="ghost">
                                Open
                              </Button>
                            </Link>
                          ) : null}
                          {manage && editId !== post._id ? (
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
                      </div>
                    </div>
                  </li>
                );
              },
            )}
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
