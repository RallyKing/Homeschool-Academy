"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { FamilyWallFeed } from "@/components/FamilyWallFeed";
import { usePageTab } from "@/hooks/usePageTab";
import {
  Badge,
  Button,
  EmptyState,
  Message,
  PageHeader,
  Section,
  Tabs,
  TabPanel,
} from "@/components/ui";

const CHEERS_TABS = ["wall", "moderate"] as const;

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

function FamilyCheersInner() {
  const [tab, setTab] = usePageTab(CHEERS_TABS, "wall");
  const family = useQuery(api.users.myFamily);
  const cheers = useQuery(
    api.social.listFamilyCheers,
    family && tab === "moderate"
      ? { familyId: family._id, limit: 50 }
      : "skip",
  );
  const moderateDelete = useMutation(api.social.moderateDeleteMessage);
  const seedCatalog = useMutation(api.social.seedCatalog);

  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">(
    "info",
  );

  function notify(text: string, tone: "info" | "error" | "success" = "success") {
    setMessage(text);
    setMessageTone(tone);
  }

  if (family === undefined) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (!family) {
    return (
      <div className="page-stack">
        <PageHeader
          compact
          eyebrow="Family"
          title="Family wall"
          description="Create a family first to see celebrations and cheers."
        />
        <Link href="/family/dashboard">
          <Button variant="secondary">Family home</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        compact
        eyebrow="Safety & warmth"
        title="Family wall"
        description="Celebrate finished work and sibling cheers together. Family-only — not rankings, not public."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                void seedCatalog({})
                  .then((r) =>
                    notify(
                      `Catalog ready (${r.packs} packs / ${r.stickers} stickers).`,
                      "success",
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
              Seed stickers
            </Button>
            <Link href="/family/dashboard">
              <Button size="sm" variant="ghost">
                Family home
              </Button>
            </Link>
          </div>
        }
      />

      <Message tone={messageTone}>{message}</Message>

      <Tabs
        tabs={[
          { id: "wall", label: "Wall" },
          { id: "moderate", label: "Moderate" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <TabPanel id="wall" active={tab === "wall"}>
        <FamilyWallFeed
          familyId={family._id}
          canModerate
          canCompose
        />
      </TabPanel>

      <TabPanel id="moderate" active={tab === "moderate"}>
        <Section
          title="Direct cheers"
          description="Private sibling messages. Remove if needed — the wall is separate."
        >
          {!cheers ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : cheers.length === 0 ? (
            <EmptyState>
              No direct cheers yet. Students send them from Cheer Hub.
            </EmptyState>
          ) : (
            <ul className="space-y-2">
              {cheers.map(({ message: m, fromName, toName, stickerEmoji }) => (
                <li key={m._id} className="list-row">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {fromName} → {toName}{" "}
                      <Badge tone="neutral">{m.kind}</Badge>
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--muted)]">
                      {stickerEmoji ? `${stickerEmoji} ` : ""}
                      {m.body ?? "Sticker cheer"}
                    </p>
                    <p className="text-xs text-[var(--muted-fg)]">
                      {formatWhen(m.createdAt)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (
                        !window.confirm(
                          "Remove this cheer from sibling messages?",
                        )
                      ) {
                        return;
                      }
                      void moderateDelete({
                        messageId: m._id as Id<"socialMessages">,
                      })
                        .then(() => notify("Cheer removed.", "info"))
                        .catch((err) =>
                          notify(
                            err instanceof Error ? err.message : "Failed",
                            "error",
                          ),
                        );
                    }}
                  >
                    Moderate
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </TabPanel>
    </div>
  );
}

export default function FamilyCheersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <FamilyCheersInner />
    </Suspense>
  );
}
