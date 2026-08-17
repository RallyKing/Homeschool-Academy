"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  Button,
  Input,
  Textarea,
  Select,
  Modal,
  Section,
  Card,
  PageHeader,
  Badge,
  EmptyState,
  Message,
} from "@/components/ui";

type PublishStatus = "draft" | "published";

export default function AdminProductUpdatesPage() {
  const user = useQuery(api.users.current);
  const updates = useQuery(
    api.productUpdates.list,
    user?.role === "superAdmin" ? {} : "skip",
  );
  const createUpgrade = useMutation(api.productUpdates.createWithKnowledgeBase);
  const updateUpgrade = useMutation(api.productUpdates.update);
  const removeUpgrade = useMutation(api.productUpdates.remove);
  const seedSample = useMutation(api.productUpdates.seedSample);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [version, setVersion] = useState("");
  const [status, setStatus] = useState<PublishStatus>("published");
  const [editId, setEditId] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">("info");
  const [modalOpen, setModalOpen] = useState(false);

  function notify(text: string, tone: "info" | "error" | "success" = "info") {
    setMessage(text);
    setMessageTone(tone);
  }

  function resetForm() {
    setTitle("");
    setSummary("");
    setBody("");
    setVersion("");
    setStatus("published");
    setEditId("");
  }

  function openCreate() {
    resetForm();
    setModalOpen(true);
  }

  function openEdit(u: {
    _id: Id<"productUpdates">;
    title: string;
    summary: string;
    body: string;
    version?: string;
    status: PublishStatus;
  }) {
    setEditId(u._id);
    setTitle(u.title);
    setSummary(u.summary);
    setBody(u.body);
    setVersion(u.version ?? "");
    setStatus(u.status);
    setModalOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !summary.trim() || !body.trim()) return;
    try {
      if (editId) {
        await updateUpgrade({
          productUpdateId: editId as Id<"productUpdates">,
          title: title.trim(),
          summary: summary.trim(),
          body: body.trim(),
          version: version.trim().replace(/^v/i, "") || undefined,
          status,
          syncKnowledgeBase: true,
        });
        notify("Product update saved (KB synced).", "success");
      } else {
        const result = await createUpgrade({
          title: title.trim(),
          summary: summary.trim(),
          body: body.trim(),
          version: version.trim().replace(/^v/i, "") || undefined,
          status,
        });
        notify(
          `Upgrade created with KB article ${result.knowledgeBaseArticleId}.`,
          "success",
        );
      }
      resetForm();
      setModalOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  if (user === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }
  if (!user) {
    return <p className="text-sm text-[var(--muted)]">Please sign in.</p>;
  }
  if (user.role !== "superAdmin") {
    return <p className="text-sm text-[var(--muted)]">SuperAdmin access required.</p>;
  }

  const navLinks = (
    <div className="flex flex-wrap gap-2">
      <Link href="/admin">
        <Button variant="ghost" size="sm">
          Admin
        </Button>
      </Link>
      <Link href="/admin/knowledge-base">
        <Button variant="secondary" size="sm">
          Knowledge base
        </Button>
      </Link>
      <Link href="/admin/speech-reports">
        <Button variant="secondary" size="sm">
          Speech reports
        </Button>
      </Link>
      <Link href="/updates">
        <Button variant="ghost" size="sm">
          Public feed
        </Button>
      </Link>
    </div>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Product updates"
        description="New upgrades always create a linked knowledge base article."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {navLinks}
            <Button size="sm" onClick={openCreate}>
              New upgrade
            </Button>
          </div>
        }
      />

      <Message tone={messageTone}>{message}</Message>

      <Section
        title="All updates"
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              void seedSample()
                .then((r) =>
                  notify(
                    `Seeded ${r.created} published update${r.created === 1 ? "" : "s"} + KB (${r.skipped} already present, ${r.total} total).`,
                    "success",
                  ),
                )
                .catch((err) =>
                  notify(err instanceof Error ? err.message : "Failed", "error"),
                )
            }
          >
            Seed product updates
          </Button>
        }
      >
        {updates === undefined && (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        )}
        {updates?.length === 0 && (
          <EmptyState>No updates yet.</EmptyState>
        )}
        <div className="space-y-3">
          {updates?.map((u) => (
            <Card key={u._id} padding="md">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-semibold">{u.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{u.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone={u.status === "published" ? "success" : "warning"}>
                      {u.status}
                    </Badge>
                    {u.version && (
                      <Badge tone="neutral">
                        v{u.version.replace(/^v/i, "")}
                      </Badge>
                    )}
                    {u.knowledgeBaseArticleId && (
                      <Badge tone="accent">KB linked</Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      if (
                        !confirm(
                          "Delete this update? Linked draft KB articles are deleted; published KB articles are unlinked.",
                        )
                      ) {
                        return;
                      }
                      void removeUpgrade({ productUpdateId: u._id })
                        .then(() => notify("Update deleted.", "success"))
                        .catch((err) =>
                          notify(err instanceof Error ? err.message : "Failed", "error"),
                        );
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title={editId ? "Edit upgrade" : "New upgrade"}
        description={
          editId
            ? "Changes sync to the linked knowledge base article."
            : "Creates a product update and linked KB article."
        }
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setModalOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" form="update-form">
              {editId ? "Save" : "Create upgrade + KB"}
            </Button>
          </>
        }
      >
        <form id="update-form" onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <Input
            label="Title"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <Input
            label="Summary"
            placeholder="Shown in feed"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            required
          />
          <Textarea
            label="Body"
            placeholder="Markdown supported as plain text"
            className="min-h-32"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
          <div className="flex flex-wrap gap-4">
            <Input
              label="Version"
              placeholder="e.g. 1.2.0"
              hint="Don't include a leading v — it's shown automatically."
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
            <Select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as PublishStatus)}
            >
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </Select>
          </div>
        </form>
      </Modal>
    </div>
  );
}
