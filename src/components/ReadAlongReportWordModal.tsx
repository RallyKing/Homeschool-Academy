"use client";

import { FormEvent, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button, Input, Message, Modal, Textarea } from "@/components/ui";

export function ReadAlongReportWordModal({
  open,
  word,
  studentId,
  sessionId,
  storyId,
  onClose,
}: {
  open: boolean;
  word: string;
  studentId?: Id<"students">;
  sessionId?: Id<"readAlongSessions">;
  storyId?: Id<"readAlongStories">;
  onClose: () => void;
}) {
  const access = useQuery(
    api.speechReports.reporterAccess,
    open ? { studentId } : "skip",
  );
  const createReport = useMutation(api.speechReports.create);
  const createWithAdult = useAction(
    api.speechReportsActions.createWithAdultPassword,
  );
  const [notes, setNotes] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const canDirect = access?.canSubmitDirectly === true;

  function resetAndClose() {
    setNotes("");
    setEmail("");
    setPassword("");
    setBusy(false);
    setError(null);
    setThanks(false);
    setConfirming(false);
    onClose();
  }

  async function submitDirect() {
    setBusy(true);
    setError(null);
    try {
      await createReport({
        word,
        notes: notes.trim() || undefined,
        studentId,
        sessionId,
        storyId,
      });
      setThanks(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not report word");
    } finally {
      setBusy(false);
    }
  }

  async function submitAdult(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createWithAdult({
        email: email.trim().toLowerCase(),
        password,
        word,
        notes: notes.trim() || undefined,
        studentId,
        sessionId,
        storyId,
      });
      setThanks(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not report word");
    } finally {
      setBusy(false);
    }
  }

  if (thanks) {
    return (
      <Modal
        open={open}
        onClose={resetAndClose}
        title="Thank you"
        size="md"
        className="read-along-kid-modal"
        footerClassName="justify-center"
        footer={
          <Button className="read-along-kid-btn" onClick={resetAndClose}>
            Back to Story
          </Button>
        }
      >
        <p className="text-lg font-semibold">
          We sent “{word}” to the backoffice. An adult will test it.
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      title="Report word"
      description={
        canDirect
          ? `Report “${word}” so backoffice can test how the mic hears it.`
          : `A parent, teacher, or tutor must sign in to report “${word}”.`
      }
      size="md"
      className="read-along-kid-modal"
      footerClassName="justify-center gap-3"
      footer={
        canDirect ? (
          <>
            <Button
              variant="secondary"
              className="read-along-kid-btn"
              onClick={resetAndClose}
            >
              Cancel
            </Button>
            <Button
              className="read-along-kid-btn"
              disabled={busy || access === undefined}
              onClick={() => {
                if (!confirming) {
                  setConfirming(true);
                  return;
                }
                void submitDirect();
              }}
            >
              {busy
                ? "Sending…"
                : confirming
                  ? "Yes, report it"
                  : "Report this word?"}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              className="read-along-kid-btn"
              onClick={resetAndClose}
            >
              Cancel
            </Button>
            <Button
              className="read-along-kid-btn"
              type="submit"
              form="report-word-adult-form"
              disabled={busy || access === undefined}
            >
              {busy ? "Sending…" : "Report word"}
            </Button>
          </>
        )
      }
    >
      {access === undefined ? (
        <p className="text-lg text-[var(--muted)]">Checking who can report…</p>
      ) : canDirect ? (
        <div className="space-y-3">
          <p className="text-lg font-semibold">
            {confirming
              ? `Report “${word}” to backoffice?`
              : `Word: ${word}`}
          </p>
          <Textarea
            label="Optional note"
            value={notes}
            className="read-along-kid-input"
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>
      ) : (
        <form
          id="report-word-adult-form"
          onSubmit={(e) => void submitAdult(e)}
          className="space-y-3"
        >
          <p className="text-lg font-semibold">
            Ask a parent, teacher, or tutor to sign in.
          </p>
          <Input
            label="Email"
            type="email"
            autoComplete="username"
            value={email}
            className="read-along-kid-input"
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            className="read-along-kid-input"
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Textarea
            label="Optional note"
            value={notes}
            className="read-along-kid-input"
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </form>
      )}
      <Message tone="error">{error}</Message>
    </Modal>
  );
}
