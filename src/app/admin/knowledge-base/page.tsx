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

export default function AdminKnowledgeBasePage() {
  const user = useQuery(api.users.current);
  const articles = useQuery(
    api.knowledgeBase.list,
    user?.role === "superAdmin" ? {} : "skip",
  );
  const createArticle = useMutation(api.knowledgeBase.create);
  const updateArticle = useMutation(api.knowledgeBase.update);
  const removeArticle = useMutation(api.knowledgeBase.remove);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("");
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
    setSlug("");
    setBody("");
    setCategory("");
    setStatus("published");
    setEditId("");
  }

  function openCreate() {
    resetForm();
    setModalOpen(true);
  }

  function openEdit(a: {
    _id: Id<"knowledgeBaseArticles">;
    title: string;
    slug: string;
    body: string;
    category?: string;
    status: PublishStatus;
  }) {
    setEditId(a._id);
    setTitle(a.title);
    setSlug(a.slug);
    setBody(a.body);
    setCategory(a.category ?? "");
    setStatus(a.status);
    setModalOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    try {
      if (editId) {
        await updateArticle({
          articleId: editId as Id<"knowledgeBaseArticles">,
          title: title.trim(),
          body: body.trim(),
          slug: slug.trim() || undefined,
          category: category.trim() || undefined,
          status,
        });
        notify("Article updated.", "success");
      } else {
        await createArticle({
          title: title.trim(),
          body: body.trim(),
          slug: slug.trim() || undefined,
          category: category.trim() || undefined,
          status,
        });
        notify("Article created.", "success");
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
      <Link href="/admin/product-updates">
        <Button variant="secondary" size="sm">
          Product updates
        </Button>
      </Link>
      <Link href="/admin/speech-reports">
        <Button variant="secondary" size="sm">
          Speech reports
        </Button>
      </Link>
      <Link href="/help">
        <Button variant="ghost" size="sm">
          Public help
        </Button>
      </Link>
    </div>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Knowledge base"
        description="Durable help articles. Product upgrades also create entries here."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {navLinks}
            <Button size="sm" onClick={openCreate}>
              New article
            </Button>
          </div>
        }
      />

      <Message tone={messageTone}>{message}</Message>

      <Section title="All articles">
        {articles === undefined && (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        )}
        {articles?.length === 0 && (
          <EmptyState>No articles yet.</EmptyState>
        )}
        <div className="space-y-3">
          {articles?.map((a) => (
            <Card key={a._id} padding="md">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-semibold">{a.title}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    /help/{a.slug}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone={a.status === "published" ? "success" : "warning"}>
                      {a.status}
                    </Badge>
                    {a.category && <Badge tone="neutral">{a.category}</Badge>}
                    {a.productUpdateId && (
                      <Badge tone="accent">From product update</Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/help/${a.slug}`}>
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      if (!confirm("Delete this knowledge base article?")) {
                        return;
                      }
                      void removeArticle({ articleId: a._id })
                        .then(() => notify("Article deleted.", "success"))
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
        title={editId ? "Edit article" : "New article"}
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
            <Button type="submit" form="kb-form">
              {editId ? "Save" : "Create article"}
            </Button>
          </>
        }
      >
        <form id="kb-form" onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <Input
            label="Title"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <Input
            label="Slug"
            placeholder="Optional — auto from title"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <Textarea
            label="Body"
            placeholder="Article content"
            className="min-h-40"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
          <div className="flex flex-wrap gap-4">
            <Input
              label="Category"
              placeholder="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
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
